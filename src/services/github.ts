import { RepoInfo, RepoItem } from '../types';

export function parseGitHubUrl(url: string): RepoInfo | null {
  try {
    const regex = /github\.com\/([^/]+)\/([^/]+)/;
    const match = url.match(regex);
    if (!match) return null;
    
    const owner = match[1];
    let repo = match[2];
    
    // Clean up repo name (remove .git or trailing slashes)
    repo = repo.replace(/\.git$/, '').split('/')[0];
    
    return {
      owner,
      repo,
      branch: 'main', // Default branch, can be improved to fetch default branch
    };
  } catch {
    return null;
  }
}

export async function fetchRepoContents(owner: string, repo: string, path: string = ''): Promise<RepoItem[]> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('Repository or path not found');
    throw new Error('Failed to fetch repository contents');
  }
  return response.json();
}

export async function fetchFileContent(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error('Failed to fetch file content');
  return response.text();
}

// Recursive fetch for full tree (optional, but requested "tree" visualization)
// Note: For large repos, recursive fetch might hit rate limits or be slow.
// Better to fetch on demand (expandable tree).
