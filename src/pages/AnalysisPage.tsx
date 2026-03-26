import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Github, Search, Code, Loader2, AlertCircle, ChevronLeft, Info, FileCode, FolderOpen, Sparkles, Terminal, Layers, FileSearch, CheckCircle2, Map, Maximize2, Minimize2, Copy, Check, X, Menu, PanelLeft, Layout, Activity, GitBranch } from 'lucide-react';
import { fetchRepoContents, fetchFileContent, parseGitHubUrl } from '../services/github';
import { analyzeProject, verifyEntryPoint, identifySubFunctions } from '../services/ai';
import { RepoItem, RepoInfo, ProjectAnalysis, LogEntry, FunctionNode } from '../types';
import { FileTree } from '../components/FileTree';
import { CodeViewer } from '../components/CodeViewer';
import { LogPanel } from '../components/LogPanel';
import { ThemeToggle } from '../components/ThemeToggle';
import { Panorama } from '../components/Panorama';
import { motion, AnimatePresence } from 'motion/react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { DndContext, rectIntersection, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PanelConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  isVisible: boolean;
}

const INITIAL_PANELS: PanelConfig[] = [
  { id: 'info', name: '项目分析', icon: <Sparkles size={18} />, isVisible: true },
  { id: 'tree', name: '文件列表', icon: <FolderOpen size={18} />, isVisible: true },
  { id: 'code', name: '源代码', icon: <FileCode size={18} />, isVisible: true },
  { id: 'panorama', name: '全景视图', icon: <Map size={18} />, isVisible: false },
];

export const AnalysisPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialUrl = searchParams.get('url') || '';
  
  const [url, setUrl] = useState(initialUrl);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [treeData, setTreeData] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedFile, setSelectedFile] = useState<RepoItem | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);
  
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // AI Analysis state
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isCodeFullscreen, setIsCodeFullscreen] = useState(false);
  const [isPanoramaFullscreen, setIsPanoramaFullscreen] = useState(false);
  const [isLogsFullscreen, setIsLogsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Panel system state
  const [panels, setPanels] = useState<PanelConfig[]>(INITIAL_PANELS);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Log state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const lastAnalyzedUrl = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    
    if (over && active.id !== over.id) {
      const activeIdStr = active.id as string;
      const overIdStr = over.id as string;
      
      // Only sort if both are in the same context (sidebar or panel)
      const activeType = activeIdStr.split('-')[0];
      const overType = overIdStr.split('-')[0];
      
      if (activeType === overType) {
        const activeId = activeIdStr.replace(/^(sidebar|panel)-/, '');
        const overId = overIdStr.replace(/^(sidebar|panel)-/, '');
        
        setPanels((items) => {
          const oldIndex = items.findIndex((item) => item.id === activeId);
          const newIndex = items.findIndex((item) => item.id === overId);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
  };

  const togglePanel = (id: string) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, isVisible: !p.isVisible } : p));
  };

  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    setLogs(prev => [{
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      type,
      message,
      details
    }, ...prev]);
  };

  const filterCodeFiles = (items: RepoItem[]): string[] => {
    const codeExtensions = [
      '.js', '.ts', '.tsx', '.jsx', '.py', '.c', '.cpp', '.h', '.java', '.go', '.rs', '.rb', '.php', 
      '.html', '.css', '.json', '.md', '.yml', '.yaml', '.sh', '.swift', '.kt', '.sql', '.r', '.m', 
      '.mm', '.scala', '.hs', '.erl', '.ex', '.exs', '.clj', '.lua', '.pl', '.v', '.sv', '.vhdl', 
      '.toml', '.ini', '.dockerfile', '.makefile', '.cmake', '.gradle', '.sbt', '.pom', '.csproj', 
      '.sln', '.vbproj', '.fsproj', '.vcxproj'
    ];
    
    const result: string[] = [];
    const traverse = (list: RepoItem[]) => {
      for (const item of list) {
        if (item.type === 'file') {
          const ext = item.name.toLowerCase().substring(item.name.lastIndexOf('.'));
          if (codeExtensions.includes(ext) || !item.name.includes('.')) {
            result.push(item.path);
          }
        } else if (item.children) {
          traverse(item.children);
        }
      }
    };
    traverse(items);
    return result;
  };

  const analyzeRepo = useCallback(async (repoUrl: string) => {
    const info = parseGitHubUrl(repoUrl);
    if (!info) {
      const msg = '无效的 GitHub 链接。请使用格式：https://github.com/owner/repo';
      setError(msg);
      addLog('error', 'GitHub 链接校验失败', { url: repoUrl, error: msg });
      return;
    }

    addLog('success', 'GitHub 链接校验通过', info);
    setRepoInfo(info);
    setLoading(true);
    setError(null);
    setTreeData([]);
    setSelectedFile(null);
    setFileContent('');
    setExpandedDirs(new Set());
    setAnalysis(null);
    setLogs([]); // Clear logs for new analysis

    try {
      addLog('info', '正在获取仓库文件列表...');
      const contents = await fetchRepoContents(info.owner, info.repo);
      setTreeData(contents);
      addLog('success', `成功获取文件列表，共计 ${contents.length} 个根目录项`);
      
      // Start AI Analysis
      setAnalyzing(true);
      const codeFiles = filterCodeFiles(contents);
      addLog('info', `文件过滤完成：共 ${codeFiles.length} 个代码文件`, { filteredFiles: codeFiles });
      
      try {
        addLog('ai', '正在调用 AI 进行项目深度分析...');
        const { result: aiResult, request, response } = await analyzeProject(codeFiles);
        setAnalysis(aiResult);
        addLog('ai', 'AI 分析完成', { 
          result: aiResult,
          raw: { request, response }
        });

        // --- Entry Point Verification ---
        if (aiResult.entryPoints && aiResult.entryPoints.length > 0) {
          addLog('info', `开始研判潜在入口文件 (共 ${aiResult.entryPoints.length} 个)...`);
          
          const findFile = (items: RepoItem[], path: string): RepoItem | null => {
            for (const item of items) {
              if (item.path === path) return item;
              if (item.children) {
                const found = findFile(item.children, path);
                if (found) return found;
              }
            }
            return null;
          };

          for (const entryPath of aiResult.entryPoints) {
            const fileItem = findFile(contents, entryPath);
            if (!fileItem || !fileItem.download_url) {
              addLog('info', `跳过文件 ${entryPath}: 未找到下载链接`);
              continue;
            }

            addLog('info', `正在研判文件: ${entryPath}...`);
            try {
              let content = await fetchFileContent(fileItem.download_url);
              const lines = content.split('\n');
              if (lines.length > 4000) {
                const first2000 = lines.slice(0, 2000).join('\n');
                const last2000 = lines.slice(-2000).join('\n');
                content = `${first2000}\n\n... [中间内容已省略] ...\n\n${last2000}`;
                addLog('info', `文件 ${entryPath} 超过 4000 行，已截取首尾各 2000 行进行分析`);
              }

              const { result: verifyResult, request: vReq, response: vRes } = await verifyEntryPoint(
                repoUrl,
                aiResult.summary,
                aiResult.mainLanguages,
                entryPath,
                content
              );

              if (verifyResult.isEntryPoint) {
                addLog('success', `确认入口文件: ${entryPath}`, { reason: verifyResult.reason, raw: { request: vReq, response: vRes } });
                setAnalysis(prev => prev ? { 
                  ...prev, 
                  verifiedEntryPoint: entryPath, 
                  verificationReason: verifyResult.reason 
                } : null);

                // --- Sub-function Identification ---
                addLog('info', `正在识别入口文件 ${entryPath} 的关键子函数...`);
                try {
                  const getAllPaths = (items: RepoItem[]): string[] => {
                    let paths: string[] = [];
                    for (const item of items) {
                      paths.push(item.path);
                      if (item.children) {
                        paths = paths.concat(getAllPaths(item.children));
                      }
                    }
                    return paths;
                  };
                  const fileList = getAllPaths(contents);

                  const { result: subFuncResult, request: sReq, response: sRes } = await identifySubFunctions(
                    repoUrl,
                    aiResult.summary,
                    entryPath,
                    content,
                    fileList
                  );

                  const rootNode: FunctionNode = {
                    id: 'root',
                    name: `入口: ${entryPath.split('/').pop()}`,
                    file: entryPath,
                    description: aiResult.summary,
                    drillDown: 1,
                    isAnalyzed: true,
                    children: subFuncResult.subFunctions.map((sf, idx) => ({
                      id: `sub-${idx}`,
                      name: sf.name,
                      file: sf.file,
                      description: sf.description,
                      drillDown: sf.drillDown as -1 | 0 | 1,
                    }))
                  };

                  addLog('success', `识别出 ${subFuncResult.subFunctions.length} 个关键子函数`, { 
                    subFunctions: subFuncResult.subFunctions,
                    raw: { request: sReq, response: sRes }
                  });

                  setAnalysis(prev => prev ? { 
                    ...prev, 
                    functionTree: rootNode 
                  } : null);
                  
                  // Automatically show panorama panel when sub-functions are found
                  setPanels(prev => prev.map(p => p.id === 'panorama' ? { ...p, isVisible: true } : p));
                } catch (subErr) {
                  addLog('error', `识别子函数时出错`, subErr);
                }

                break; // Stop after finding the first valid entry point
              } else {
                addLog('info', `文件 ${entryPath} 不是入口文件`, { reason: verifyResult.reason });
              }
            } catch (err) {
              addLog('error', `研判文件 ${entryPath} 时出错`, err);
            }
          }
        }
      } catch (aiErr) {
        console.error('AI Analysis failed:', aiErr);
        addLog('error', 'AI 分析失败', aiErr);
      } finally {
        setAnalyzing(false);
      }
    } catch (err: any) {
      const msg = err.message || '获取仓库数据时出错。';
      setError(msg);
      addLog('error', '获取仓库数据失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUrl && initialUrl !== lastAnalyzedUrl.current) {
      lastAnalyzedUrl.current = initialUrl;
      analyzeRepo(initialUrl);
    }
  }, [initialUrl, analyzeRepo]);

  const updateTreeWithChildren = useCallback((items: RepoItem[], path: string, children: RepoItem[]): RepoItem[] => {
    return items.map(item => {
      if (item.path === path) {
        return { ...item, children };
      }
      if (item.children) {
        return { ...item, children: updateTreeWithChildren(item.children, path, children) };
      }
      return item;
    });
  }, []);

  const handleToggleDir = async (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
      setExpandedDirs(newExpanded);
    } else {
      newExpanded.add(path);
      setExpandedDirs(newExpanded);
      
      // Fetch sub-contents if not already fetched
      if (repoInfo) {
        try {
          const subContents = await fetchRepoContents(repoInfo.owner, repoInfo.repo, path);
          setTreeData(prev => updateTreeWithChildren(prev, path, subContents));
        } catch (err) {
          console.error('Failed to fetch sub-contents:', err);
        }
      }
    }
  };

  const handleFileClick = async (file: RepoItem) => {
    if (!file.download_url) return;
    
    setSelectedFile(file);
    setFileLoading(true);
    try {
      const content = await fetchFileContent(file.download_url);
      setFileContent(content);
    } catch (err) {
      console.error('Failed to fetch file content:', err);
      setFileContent('加载文件内容失败。');
    } finally {
      setFileLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      navigate(`/analyze?url=${encodeURIComponent(url.trim())}`);
    }
  };

  const handleCopy = () => {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Fullscreen Code Overlay */}
      <AnimatePresence>
        {isCodeFullscreen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[200] bg-background p-8 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCode size={20} className="text-blue-500" />
                <span className="text-sm font-bold uppercase tracking-wider">{selectedFile?.name || '源代码'}</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedFile && (
                  <button 
                    onClick={handleCopy}
                    className="p-2 hover:bg-foreground/10 rounded-md transition-colors text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    <span className="text-xs font-bold uppercase">{copied ? '已复制' : '复制全文'}</span>
                  </button>
                )}
                <button 
                  onClick={() => setIsCodeFullscreen(false)}
                  className="p-2 hover:bg-foreground/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden border border-border rounded-xl">
              <CodeViewer code={fileContent} fileName={selectedFile?.name || ''} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Panorama Overlay */}
      <AnimatePresence>
        {isPanoramaFullscreen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[200] bg-background p-8 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Map size={20} className="text-blue-500" />
                <span className="text-sm font-bold uppercase tracking-wider">项目函数全景图</span>
              </div>
              <button 
                onClick={() => setIsPanoramaFullscreen(false)}
                className="p-2 hover:bg-foreground/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 border border-border rounded-xl overflow-hidden">
              {analysis?.functionTree && <Panorama data={analysis.functionTree} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Logs Overlay */}
      <AnimatePresence>
        {isLogsFullscreen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[200] bg-background p-8 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal size={20} className="text-blue-500" />
                <span className="text-sm font-bold uppercase tracking-wider">工作日志详情</span>
              </div>
              <button 
                onClick={() => setIsLogsFullscreen(false)}
                className="p-2 hover:bg-foreground/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 border border-border rounded-xl overflow-hidden">
              <LogPanel logs={logs} hideHeader />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-card z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-foreground/5 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-4">
          <div className="relative flex items-center bg-background border border-border rounded-lg overflow-hidden px-3 py-1.5 focus-within:border-blue-500/50 transition-colors">
            <Github size={16} className="text-muted-foreground mr-2" />
            <input
              type="text"
              placeholder="分析另一个仓库..."
              className="bg-transparent border-none outline-none flex-1 text-sm py-0.5"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit" className="text-blue-500 hover:text-blue-400 p-1">
              <Search size={16} />
            </button>
          </div>
        </form>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {repoInfo && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-medium text-blue-500">
              <Github size={12} />
              {repoInfo.owner} / {repoInfo.repo}
            </div>
          )}
        </div>
      </header>

      {/* Main Content with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* VSCode Style Sidebar */}
          <aside 
            className={`border-r border-border bg-card flex flex-col transition-all duration-300 z-40 ${
              sidebarExpanded ? 'w-48' : 'w-14'
            }`}
          >
            <div className="p-3 flex items-center justify-center border-b border-border">
              <button 
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                className="p-2 hover:bg-foreground/5 rounded-lg transition-colors text-muted-foreground hover:text-foreground w-full flex items-center justify-center"
              >
                {sidebarExpanded ? <PanelLeft size={20} className="text-blue-500" /> : <Menu size={20} />}
              </button>
            </div>

            <SortableContext
              items={panels.map(p => `sidebar-${p.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex-1 py-4 flex flex-col gap-2">
                {panels.map(panel => (
                  <SortableSidebarItem
                    key={panel.id}
                    panel={panel}
                    sidebarExpanded={sidebarExpanded}
                    togglePanel={togglePanel}
                    isDragging={activeDragId === `sidebar-${panel.id}`}
                  />
                ))}
              </div>
            </SortableContext>

            <div className="p-4 border-t border-border">
              <div className={`flex items-center gap-3 ${sidebarExpanded ? 'justify-start' : 'justify-center'}`}>
                <Activity size={18} className="text-blue-500" />
                {sidebarExpanded && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">状态</span>
                    <span className="text-[10px] text-green-500 font-medium">在线</span>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Resizable & Reorderable Panels */}
          <div className="flex-1 flex overflow-hidden relative">
            <SortableContext
              items={panels.filter(p => p.isVisible).map(p => `panel-${p.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              <PanelGroup orientation="horizontal">
                {panels.filter(p => p.isVisible).map((panel, index, visiblePanels) => (
                  <React.Fragment key={panel.id}>
                    <Panel minSize={15} defaultSize={100 / visiblePanels.length}>
                      <SortablePanelItem 
                        panel={panel}
                        isDragging={activeDragId === `panel-${panel.id}`}
                      >
                        {panel.id === 'info' && (
                          <div className="flex flex-col h-full overflow-hidden">
                            <PanelGroup orientation="vertical">
                              <Panel defaultSize={60} minSize={30}>
                                <div className="h-full overflow-y-auto custom-scrollbar">
                                  <div className="p-4 border-b border-border">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
                                      <Info size={14} />
                                      项目信息
                                    </h3>
                                    {repoInfo ? (
                                      <div className="space-y-4">
                                        <div>
                                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">所有者</label>
                                          <p className="text-sm font-medium text-foreground">{repoInfo.owner}</p>
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">仓库名称</label>
                                          <p className="text-sm font-medium text-foreground">{repoInfo.repo}</p>
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">分支</label>
                                          <p className="text-sm font-medium text-foreground">{repoInfo.branch}</p>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic">尚未分析仓库。</p>
                                    )}
                                  </div>
                                  
                                  <div className="p-4">
                                    <div className="flex items-center justify-between mb-4">
                                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Sparkles size={14} className="text-blue-500" />
                                        AI 深度分析
                                      </h3>
                                      {analyzing && <Loader2 size={12} className="animate-spin text-blue-500" />}
                                    </div>

                                    <AnimatePresence mode="wait">
                                      {analyzing ? (
                                        <motion.div 
                                          key="analyzing"
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          exit={{ opacity: 0 }}
                                          className="space-y-4"
                                        >
                                          <div className="h-20 bg-foreground/5 rounded-xl animate-pulse" />
                                          <div className="h-32 bg-foreground/5 rounded-xl animate-pulse" />
                                        </motion.div>
                                      ) : analysis ? (
                                        <motion.div 
                                          key="analysis"
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="space-y-6"
                                        >
                                          <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                            <p className="text-xs text-blue-600 dark:text-blue-200/80 leading-relaxed italic">
                                              "{analysis.summary}"
                                            </p>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-muted-foreground uppercase block mb-2 flex items-center gap-1">
                                              <Terminal size={10} /> 主要语言
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                              {analysis.mainLanguages.map(lang => (
                                                <span key={lang} className="px-2 py-0.5 bg-foreground/5 border border-border rounded text-[10px] font-medium text-foreground/80">
                                                  {lang}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-muted-foreground uppercase block mb-2 flex items-center gap-1">
                                              <Layers size={10} /> 技术栈
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                              {analysis.techStack.map(tech => (
                                                <span key={tech} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                                  {tech}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-muted-foreground uppercase block mb-2 flex items-center gap-1">
                                              <FileSearch size={10} /> 潜在入口文件
                                            </label>
                                            <div className="space-y-1">
                                              {analysis.entryPoints.map(file => (
                                                <div 
                                                  key={file} 
                                                  className={`text-[10px] font-mono truncate p-1.5 rounded border transition-colors cursor-help ${
                                                    analysis.verifiedEntryPoint === file 
                                                      ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' 
                                                      : 'bg-foreground/5 border-border text-foreground/70 hover:border-blue-500/30'
                                                  }`}
                                                  title={file}
                                                >
                                                  <div className="flex items-center gap-2">
                                                    {analysis.verifiedEntryPoint === file ? <CheckCircle2 size={10} /> : <FileCode size={10} />}
                                                    {file}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          {analysis.verifiedEntryPoint && analysis.verificationReason && (
                                            <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                                              <label className="text-[10px] text-green-600 dark:text-green-400 uppercase block mb-2 flex items-center gap-1 font-bold">
                                                <CheckCircle2 size={10} /> 入口研判理由
                                              </label>
                                              <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                                {analysis.verificationReason}
                                              </p>
                                            </div>
                                          )}
                                        </motion.div>
                                      ) : (
                                        <div className="p-4 bg-foreground/5 rounded-xl border border-border text-center">
                                          <p className="text-xs text-muted-foreground italic">
                                            {loading ? "正在等待文件列表..." : "暂无分析结果。"}
                                          </p>
                                        </div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              </Panel>
                              
                              <PanelResizeHandle className="h-1.5 bg-border hover:bg-blue-500/50 transition-all cursor-row-resize relative z-10 group/resize flex items-center justify-center">
                                <div className="w-8 h-1 bg-foreground/10 rounded-full" />
                              </PanelResizeHandle>
                              
                              <Panel defaultSize={40} minSize={20}>
                                <div className="h-full border-t border-border bg-card/50">
                                  <LogPanel logs={logs} onMaximize={() => setIsLogsFullscreen(true)} />
                                </div>
                              </Panel>
                            </PanelGroup>
                          </div>
                        )}

                        {panel.id === 'tree' && (
                          <div className="flex flex-col h-full overflow-hidden">
                            <div className="flex-1 overflow-auto p-2 custom-scrollbar">
                              {loading ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                                  <Loader2 size={24} className="animate-spin text-blue-500" />
                                  <span className="text-xs">正在获取目录树...</span>
                                </div>
                              ) : error ? (
                                <div className="p-4 text-center">
                                  <AlertCircle size={32} className="text-red-500 mx-auto mb-2" />
                                  <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
                                </div>
                              ) : treeData.length > 0 ? (
                                <FileTree 
                                  items={treeData} 
                                  onFileClick={handleFileClick} 
                                  onToggleDir={handleToggleDir}
                                  expandedDirs={expandedDirs}
                                />
                              ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic">
                                  请输入 URL 开始分析
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {panel.id === 'code' && (
                          <div className="flex flex-col h-full overflow-hidden relative">
                            <div className="flex-1 overflow-hidden relative p-4">
                              <div className="flex items-center justify-between mb-2 shrink-0">
                                <div className="flex items-center gap-2">
                                  <FileCode size={16} className="text-blue-500" />
                                  <span className="text-xs font-bold uppercase tracking-wider">源代码</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {selectedFile && (
                                    <button 
                                      onClick={handleCopy}
                                      className="p-1.5 hover:bg-foreground/10 rounded-md transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1"
                                      title="复制全文"
                                    >
                                      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                      <span className="text-[10px] font-bold uppercase">{copied ? '已复制' : '复制'}</span>
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => setIsCodeFullscreen(!isCodeFullscreen)}
                                    className="p-1.5 hover:bg-foreground/10 rounded-md transition-colors text-muted-foreground hover:text-foreground"
                                    title={isCodeFullscreen ? "退出全屏" : "全屏查看"}
                                  >
                                    {isCodeFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                  </button>
                                </div>
                              </div>

                              <div className="flex-1 h-[calc(100%-2rem)] overflow-hidden relative">
                                <AnimatePresence mode="wait">
                                  {fileLoading ? (
                                    <motion.div 
                                      key="loading"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-background"
                                    >
                                      <Loader2 size={32} className="animate-spin text-blue-500" />
                                      <p className="text-sm">正在加载文件内容...</p>
                                    </motion.div>
                                  ) : selectedFile ? (
                                    <motion.div 
                                      key="code"
                                      initial={{ opacity: 0, x: 20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      className="h-full w-full"
                                    >
                                      <CodeViewer code={fileContent} fileName={selectedFile.name} />
                                    </motion.div>
                                  ) : (
                                    <motion.div 
                                      key="empty"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-center bg-background"
                                    >
                                      <div className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center mb-4 border border-border">
                                        <Code size={40} className="text-foreground/20" />
                                      </div>
                                      <h3 className="text-lg font-medium text-foreground/80 mb-2">未选择文件</h3>
                                      <p className="text-sm max-w-xs">从左侧树状图中选择一个文件，即可查看其带有语法高亮的内容。</p>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>
                        )}

                        {panel.id === 'panorama' && (
                          <div className="flex flex-col h-full overflow-hidden relative">
                            <div className="flex-1 flex flex-col overflow-hidden p-4">
                              <div className="flex items-center justify-between mb-2 shrink-0">
                                <div className="flex items-center gap-2">
                                  <Map size={16} className="text-blue-500" />
                                  <span className="text-xs font-bold uppercase tracking-wider">项目函数全景图</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => setIsPanoramaFullscreen(!isPanoramaFullscreen)}
                                    className="p-1.5 hover:bg-foreground/10 rounded-md transition-colors text-muted-foreground hover:text-foreground"
                                    title={isPanoramaFullscreen ? "退出全屏" : "全屏查看"}
                                  >
                                    {isPanoramaFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                  </button>
                                </div>
                              </div>
                              <div className="flex-1 border border-border rounded-lg overflow-hidden">
                                {analysis?.functionTree ? (
                                  <Panorama data={analysis.functionTree} />
                                ) : (
                                  <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic">
                                    分析完成后将显示全景图
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {panel.id === 'logs' && null}
                      </SortablePanelItem>
                    </Panel>
                    {index < visiblePanels.length - 1 && (
                      <PanelResizeHandle className="w-1.5 bg-border hover:bg-blue-500/50 transition-all cursor-col-resize relative z-10 group/resize">
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent group-hover/resize:bg-blue-500/50 transition-colors" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-border group-hover/resize:bg-blue-500 rounded-full opacity-0 group-hover/resize:opacity-100 transition-all" />
                      </PanelResizeHandle>
                    )}
                  </React.Fragment>
                ))}
              </PanelGroup>
            </SortableContext>
            
            <DragOverlay dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.5',
                  },
                },
              }),
            }}>
              {activeDragId ? (
                <div className={`shadow-2xl flex items-center gap-2 border border-white/20 backdrop-blur-md z-[300] ${
                  activeDragId.startsWith('sidebar-') 
                    ? 'bg-blue-600/90 text-white p-2 px-4 rounded-full' 
                    : 'bg-card/90 text-foreground p-3 px-5 rounded-lg border-blue-500/30 ring-2 ring-blue-500/20'
                }`}>
                  {(() => {
                    const id = activeDragId.replace(/^(sidebar|panel)-/, '');
                    const panel = panels.find(p => p.id === id);
                    return (
                      <>
                        <div className={activeDragId.startsWith('sidebar-') ? "text-white" : "text-blue-500"}>
                          {panel?.icon}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">{panel?.name}</span>
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </DragOverlay>
          </div>
        </DndContext>
      </div>
    </div>
  );
};

interface SortableSidebarItemProps {
  panel: PanelConfig;
  sidebarExpanded: boolean;
  togglePanel: (id: string) => void;
  isDragging?: boolean;
}

const SortableSidebarItem: React.FC<SortableSidebarItemProps> = ({ panel, sidebarExpanded, togglePanel, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `sidebar-${panel.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => togglePanel(panel.id)}
      className={`p-3 mx-2 rounded-lg transition-all flex items-center gap-3 cursor-grab active:cursor-grabbing ${
        panel.isVisible 
          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
      } ${sidebarExpanded ? 'justify-start px-4' : 'justify-center'}`}
      title={panel.name}
    >
      {panel.icon}
      {sidebarExpanded && <span className="text-xs font-medium truncate">{panel.name}</span>}
    </div>
  );
};

interface SortablePanelItemProps {
  panel: PanelConfig;
  children: React.ReactNode;
  isDragging?: boolean;
}

const SortablePanelItem: React.FC<SortablePanelItemProps> = ({ panel, children, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `panel-${panel.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1, // Make the original item invisible to create a "gap"
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex flex-col h-full bg-background relative group ${
        isDragging ? 'z-0' : 'z-10'
      }`}
    >
      {/* Placeholder for the gap effect */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/5 border-2 border-dashed border-blue-500/30 rounded-lg m-2 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-blue-500/40">
            {panel.icon}
            <span className="text-[10px] font-bold uppercase">{panel.name}</span>
          </div>
        </div>
      )}
      
      {/* Drag Handle Header */}
      <div 
        {...attributes}
        {...listeners}
        className="h-8 bg-card border-b border-border flex items-center px-3 gap-2 cursor-grab active:cursor-grabbing hover:bg-foreground/[0.02] shrink-0"
      >
        <div className="text-muted-foreground group-hover:text-blue-500 transition-colors">
          {panel.icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground truncate">
          {panel.name}
        </span>
        <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-0.5 h-3 bg-muted-foreground/30 rounded-full" />
          <div className="w-0.5 h-3 bg-muted-foreground/30 rounded-full" />
          <div className="w-0.5 h-3 bg-muted-foreground/30 rounded-full" />
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};
