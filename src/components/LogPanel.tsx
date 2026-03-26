import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronRight, Clock, CheckCircle2, Info, AlertCircle, Sparkles, Maximize2, X } from 'lucide-react';
import { LogEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface LogPanelProps {
  logs: LogEntry[];
  hideHeader?: boolean;
  onMaximize?: () => void;
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs, hideHeader = false, onMaximize }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSubSections, setExpandedSubSections] = useState<Record<string, boolean>>({});

  const toggleSubSection = (logId: string, section: string) => {
    const key = `${logId}-${section}`;
    setExpandedSubSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const truncateLongStrings = (obj: any): any => {
    if (typeof obj === 'string') {
      if (obj.length > 500) {
        const remaining = new TextEncoder().encode(obj.substring(500)).length;
        return obj.substring(0, 500) + `···[后续还有 ${remaining} 字节]`;
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(truncateLongStrings);
    }
    if (typeof obj === 'object' && obj !== null) {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = truncateLongStrings(obj[key]);
      }
      return newObj;
    }
    return obj;
  };

  const getIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={12} className="text-green-600 dark:text-green-500" />;
      case 'error': return <AlertCircle size={12} className="text-red-600 dark:text-red-500" />;
      case 'ai': return <Sparkles size={12} className="text-blue-600 dark:text-blue-500" />;
      default: return <Info size={12} className="text-slate-500 dark:text-gray-500" />;
    }
  };

  const renderLogDetails = (log: LogEntry) => {
    const hasRawData = log.details?.raw;
    const isFilteredFiles = log.details?.filteredFiles;
    
    if (hasRawData) {
      const { request, response } = log.details.raw;
      return (
        <div className="space-y-2 p-2 bg-slate-50 dark:bg-muted/30">
          {/* Request Section */}
          <div className="border border-slate-200 dark:border-border rounded overflow-hidden">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleSubSection(log.id, 'request'); }}
              className="w-full flex items-center justify-between p-1.5 bg-slate-100 dark:bg-muted/50 hover:bg-slate-200 dark:hover:bg-muted text-[9px] font-medium text-blue-600 dark:text-blue-400"
            >
              <span className="flex items-center gap-1">
                {expandedSubSections[`${log.id}-request`] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                AI 请求 (Prompt & Config)
              </span>
            </button>
            <AnimatePresence>
              {expandedSubSections[`${log.id}-request`] && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <pre className="p-2 text-[9px] font-mono text-slate-600 dark:text-muted-foreground whitespace-pre-wrap break-all leading-relaxed border-t border-slate-200 dark:border-border">
                    {JSON.stringify(truncateLongStrings(request), null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Response Section */}
          <div className="border border-slate-200 dark:border-border rounded overflow-hidden">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleSubSection(log.id, 'response'); }}
              className="w-full flex items-center justify-between p-1.5 bg-slate-100 dark:bg-muted/50 hover:bg-slate-200 dark:hover:bg-muted text-[9px] font-medium text-green-700 dark:text-green-400"
            >
              <span className="flex items-center gap-1">
                {expandedSubSections[`${log.id}-response`] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                AI 响应 (Raw Text)
              </span>
            </button>
            <AnimatePresence>
              {expandedSubSections[`${log.id}-response`] && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <pre className="p-2 text-[9px] font-mono text-slate-600 dark:text-muted-foreground whitespace-pre-wrap break-all leading-relaxed border-t border-slate-200 dark:border-border">
                    {JSON.stringify(truncateLongStrings(response), null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Analysis Result Summary */}
          {log.details.result && (
            <div className="p-2 border border-blue-500/30 rounded bg-blue-500/5">
              <p className="text-[9px] font-bold text-blue-700 dark:text-blue-300 mb-1 uppercase">解析结果摘要</p>
              <pre className="text-[9px] font-mono text-slate-600 dark:text-muted-foreground whitespace-pre-wrap break-all">
                {JSON.stringify(log.details.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Verification Reason */}
          {log.details.reason && (
            <div className="p-2 border border-green-500/30 rounded bg-green-500/5">
              <p className="text-[9px] font-bold text-green-700 dark:text-green-300 mb-1 uppercase">研判理由</p>
              <p className="text-[9px] font-mono text-slate-600 dark:text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
                {log.details.reason}
              </p>
            </div>
          )}
        </div>
      );
    }

    if (isFilteredFiles) {
      return (
        <div className="p-2 bg-slate-50 dark:bg-muted/30">
          <p className="text-[9px] font-bold text-slate-500 dark:text-muted-foreground mb-2 uppercase tracking-wider">过滤后的代码文件清单 ({log.details.filteredFiles.length}):</p>
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
            {log.details.filteredFiles.map((file: string, idx: number) => (
              <div key={idx} className="text-[9px] font-mono text-slate-600 dark:text-muted-foreground py-0.5 border-b border-slate-200 dark:border-border last:border-0">
                {file}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="p-2 bg-slate-50 dark:bg-muted/30">
        <pre className="text-[9px] font-mono text-slate-600 dark:text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
          {JSON.stringify(truncateLongStrings(log.details), null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {!hideHeader && (
        <div className="p-3 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">工作日志</h3>
          </div>
          {onMaximize && (
            <button 
              onClick={onMaximize}
              className="p-1 hover:bg-foreground/10 rounded transition-colors text-muted-foreground hover:text-foreground"
              title="全屏查看"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {logs.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic text-center py-4">暂无操作日志</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="border border-border rounded-lg bg-card/50 overflow-hidden">
              <div 
                className={`p-2 flex items-start gap-2 cursor-pointer hover:bg-foreground/[0.05] transition-colors ${expandedId === log.id ? 'bg-foreground/[0.05]' : ''}`}
                onClick={() => log.details && setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="mt-0.5">{getIcon(log.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-medium text-foreground/80 truncate">{log.message}</span>
                    <span className="text-[8px] text-muted-foreground flex items-center gap-1">
                      <Clock size={8} />
                      {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  {log.details && (
                    <div className="flex items-center gap-1 text-[8px] text-blue-500/70 font-medium uppercase">
                      {expandedId === log.id ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
                      查看详情
                    </div>
                  )}
                </div>
              </div>
              
              <AnimatePresence>
                {expandedId === log.id && log.details && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-border"
                  >
                    {renderLogDetails(log)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
