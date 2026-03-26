import React, { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { RepoItem } from '../types';
import { cn } from '../lib/utils';

interface FileTreeProps {
  items: RepoItem[];
  onFileClick: (item: RepoItem) => void;
  onToggleDir: (path: string) => void;
  expandedDirs: Set<string>;
  level?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ 
  items, 
  onFileClick, 
  onToggleDir, 
  expandedDirs, 
  level = 0 
}) => {
  // Sort: directories first, then files
  const sortedItems = [...items].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  return (
    <div className="flex flex-col">
      {sortedItems.map((item) => {
        const isExpanded = expandedDirs.has(item.path);
        const isDir = item.type === 'dir';

        return (
          <div key={item.path} className="flex flex-col">
            <div
              className={cn(
                "flex items-center py-1 px-2 cursor-pointer hover:bg-foreground/5 transition-colors rounded-md text-sm",
                level > 0 && "ml-4"
              )}
              onClick={() => {
                if (isDir) {
                  onToggleDir(item.path);
                } else {
                  onFileClick(item);
                }
              }}
            >
              <div className="w-4 h-4 mr-1 flex items-center justify-center">
                {isDir ? (
                  isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                ) : null}
              </div>
              <div className="mr-2 text-blue-500">
                {isDir ? <Folder size={16} /> : <File size={16} className="text-muted-foreground" />}
              </div>
              <span className="truncate text-foreground/90">{item.name}</span>
            </div>
            
            {isDir && isExpanded && item.children && (
              <FileTree 
                items={item.children} 
                onFileClick={onFileClick} 
                onToggleDir={onToggleDir} 
                expandedDirs={expandedDirs}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
