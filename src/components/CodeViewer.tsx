import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeViewerProps {
  code: string;
  fileName: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ code, fileName }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const extension = fileName.split('.').pop() || 'text';
  
  // Map common extensions to syntax highlighter languages
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'bash',
  };

  const language = languageMap[extension] || 'text';

  return (
    <div className="h-full flex flex-col bg-card rounded-lg overflow-hidden border border-border">
      <div className="bg-muted px-4 py-2 text-xs text-muted-foreground border-b border-border flex items-center justify-between">
        <span>{fileName}</span>
        <span className="uppercase">{language}</span>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <SyntaxHighlighter
          language={language}
          style={isDark ? vscDarkPlus : prism}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '13px',
            background: 'transparent',
            height: '100%',
          }}
          showLineNumbers={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
