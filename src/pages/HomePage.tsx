import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Search, ArrowRight, Code } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { motion } from 'motion/react';

export const HomePage: React.FC = () => {
  const [url, setUrl] = useState('');
  const navigate = useNavigate();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      navigate(`/analyze?url=${encodeURIComponent(url.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 overflow-hidden relative transition-colors duration-300">
      {/* Theme Toggle in Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 flex flex-col items-center text-center max-w-2xl"
      >
        <div className="mb-8 p-4 bg-card rounded-2xl border border-border backdrop-blur-sm">
          <Code size={48} className="text-blue-500" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-foreground to-foreground/40 bg-clip-text text-transparent">
          GitVisualizer
        </h1>
        
        <p className="text-gray-500 dark:text-gray-400 text-lg md:text-xl mb-12 leading-relaxed">
          以清晰、互动的树形结构可视化 GitHub 仓库。
          分析代码，提供语法高亮和深度 AI 洞察。
        </p>

        <form onSubmit={handleAnalyze} className="w-full relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000 group-hover:duration-200" />
          
          <div className="relative flex items-center bg-card border border-border rounded-2xl overflow-hidden p-1">
            <div className="pl-4 text-gray-500">
              <Github size={20} />
            </div>
            <input
              type="text"
              placeholder="粘贴 GitHub 仓库链接 (例如: https://github.com/facebook/react)"
              className="flex-1 bg-transparent border-none outline-none px-4 py-4 text-foreground placeholder:text-gray-600"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 group/btn"
            >
              开始分析
              <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </form>
        
        <div className="mt-12 flex items-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            实时分析
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            语法高亮
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            树形可视化
          </div>
        </div>
      </motion.div>
      
      {/* Footer */}
      <div className="absolute bottom-8 left-0 right-0 text-center text-gray-500 text-xs">
        &copy; 2026 GitVisualizer. 为开发者而生。
      </div>
    </div>
  );
};
