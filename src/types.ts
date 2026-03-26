export interface RepoItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  url: string;
  download_url: string | null;
  children?: RepoItem[];
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

export interface EntryPointVerification {
  isEntryPoint: boolean;
  reason: string;
}

export interface FunctionNode {
  id: string;
  name: string;
  file: string;
  description: string;
  drillDown: -1 | 0 | 1;
  children?: FunctionNode[];
  isAnalyzed?: boolean;
}

export interface ProjectAnalysis {
  mainLanguages: string[];
  techStack: string[];
  entryPoints: string[];
  summary: string;
  verifiedEntryPoint?: string;
  verificationReason?: string;
  functionTree?: FunctionNode;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'ai';
  message: string;
  details?: any;
}
