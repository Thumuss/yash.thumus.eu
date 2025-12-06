/**
 * Git integration for YASH using isomorphic-git
 * Provides a bridge between our VirtualFileSystem and isomorphic-git
 */

import git from 'isomorphic-git';
import { Buffer } from "buffer"; // Polyfill for Buffer in browser environments
import type { VirtualFileSystem } from './filesystem';

try {
window.Buffer = window.Buffer || Buffer;
} catch {}

/**
 * Adapter to make VirtualFileSystem compatible with isomorphic-git's fs interface
 * isomorphic-git expects a Node.js-like fs module with callback or promise-based methods
 */
export function createGitFsAdapter(vfs: VirtualFileSystem) {
  return {
    promises: {
      async readFile(filepath: string, options?: { encoding?: string } | string): Promise<string | Uint8Array> {
        const encoding = typeof options === 'string' ? options : options?.encoding;
        try {
          return await vfs.readFile(filepath, encoding === 'utf8' || encoding === 'utf-8' ? 'utf-8' : 'binary');
        } catch (e: any) {
          const err = new Error(`ENOENT: no such file or directory: ${filepath}`) as any;
          err.code = 'ENOENT';
          throw err;
        }
      },

      async writeFile(filepath: string, data: string | Uint8Array, options?: { mode?: number } | string): Promise<void> {
        const mode = typeof options === 'object' ? options?.mode : undefined;
        // Ensure parent directory exists
        const lastSlash = filepath.lastIndexOf('/');
        if (lastSlash > 0) {
          const dir = filepath.substring(0, lastSlash);
          try {
            await vfs.makeDir(dir, { recursive: true });
          } catch (e) {
            // Directory might already exist - that's fine
          }
        }
        await vfs.writeFile(filepath, data, mode ? { mode } : undefined);
      },

      async mkdir(filepath: string, options?: { recursive?: boolean; mode?: number }): Promise<void> {
        try {
          await vfs.makeDir(filepath, { recursive: true, ...options });
        } catch (e: any) {
          // Ignore if already exists
          if (!e.message?.includes('EEXIST')) {
            throw e;
          }
        }
      },

      async rmdir(filepath: string, options?: { recursive?: boolean }): Promise<void> {
        try {
          await vfs.removeDir(filepath, options);
        } catch (e: any) {
          const err = new Error(e.message) as any;
          err.code = e.message?.includes('ENOENT') ? 'ENOENT' : 'ENOTDIR';
          throw err;
        }
      },

      async unlink(filepath: string): Promise<void> {
        try {
          await vfs.deleteFile(filepath);
        } catch (e: any) {
          const err = new Error(e.message) as any;
          err.code = 'ENOENT';
          throw err;
        }
      },

      async stat(filepath: string): Promise<any> {
        try {
          const stats = await vfs.stat(filepath);
          return {
            isFile: () => stats.isFile(),
            isDirectory: () => stats.isDirectory(),
            isSymbolicLink: () => stats.isSymbolicLink(),
            size: stats.size,
            mode: stats.mode,
            mtimeMs: stats.mtime.getTime(),
            ctimeMs: stats.ctime?.getTime() || stats.mtime.getTime(),
            uid: stats.uid,
            gid: stats.gid,
          };
        } catch (e: any) {
          const err = new Error(`ENOENT: no such file or directory: ${filepath}`) as any;
          err.code = 'ENOENT';
          throw err;
        }
      },

      async lstat(filepath: string): Promise<any> {
        try {
          const stats = await vfs.lstat(filepath);
          return {
            isFile: () => stats.isFile(),
            isDirectory: () => stats.isDirectory(),
            isSymbolicLink: () => stats.isSymbolicLink(),
            size: stats.size,
            mode: stats.mode,
            mtimeMs: stats.mtime.getTime(),
            ctimeMs: stats.ctime?.getTime() || stats.mtime.getTime(),
            uid: stats.uid,
            gid: stats.gid,
          };
        } catch (e: any) {
          const err = new Error(`ENOENT: no such file or directory: ${filepath}`) as any;
          err.code = 'ENOENT';
          throw err;
        }
      },

      async readdir(filepath: string, options?: { withFileTypes?: boolean }): Promise<string[] | any[]> {
        try {
          const entries = await vfs.readDir(filepath);
          
          if (options?.withFileTypes) {
            // Return Dirent-like objects
            const result = [];
            for (const name of entries) {
              const fullPath = filepath.endsWith('/') ? filepath + name : filepath + '/' + name;
              try {
                const stats = await vfs.stat(fullPath);
                result.push({
                  name,
                  isFile: () => stats.isFile(),
                  isDirectory: () => stats.isDirectory(),
                  isSymbolicLink: () => stats.isSymbolicLink(),
                });
              } catch {
                result.push({
                  name,
                  isFile: () => true,
                  isDirectory: () => false,
                  isSymbolicLink: () => false,
                });
              }
            }
            return result;
          }
          
          return entries;
        } catch (e: any) {
          const err = new Error(`ENOENT: no such file or directory: ${filepath}`) as any;
          err.code = 'ENOENT';
          throw err;
        }
      },

      async readlink(filepath: string): Promise<string> {
        return await vfs.readlink(filepath);
      },

      async symlink(target: string, filepath: string): Promise<void> {
        await vfs.symlink(target, filepath);
      },

      async chmod(filepath: string, mode: number): Promise<void> {
        await vfs.chmod(filepath, mode);
      },

      async rename(oldPath: string, newPath: string): Promise<void> {
        await vfs.rename(oldPath, newPath);
      },
    },
  };
}

/**
 * Git command implementations for YASH
 */
export class GitCommands {
  private fs: ReturnType<typeof createGitFsAdapter>;
  private vfs: VirtualFileSystem;
  
  constructor(vfs: VirtualFileSystem) {
    this.vfs = vfs;
    this.fs = createGitFsAdapter(vfs);
  }

  /**
   * Initialize a new git repository
   */
  async init(dir: string, options?: { defaultBranch?: string }): Promise<void> {
    await git.init({
      fs: this.fs,
      dir,
      defaultBranch: options?.defaultBranch || 'main',
    });
  }

  /**
   * Clone a repository
   */
  async clone(url: string, dir: string, options?: {
    depth?: number;
    singleBranch?: boolean;
    ref?: string;
    onProgress?: (progress: { phase: string; loaded: number; total: number }) => void;
  }): Promise<void> {
    
    await git.clone({
      fs: this.fs,
      http: await this.getHttpClient(),
      dir,
      url,
      depth: options?.depth,
      singleBranch: options?.singleBranch,
      ref: options?.ref,
      onProgress: options?.onProgress,
      corsProxy: 'https://cors.isomorphic-git.org',
    });
  }

  /**
   * Add files to staging area
   */
  async add(dir: string, filepath: string): Promise<void> {
    await git.add({
      fs: this.fs,
      dir,
      filepath,
    });
  }

  /**
   * Remove files from staging area or working tree
   */
  async remove(dir: string, filepath: string): Promise<void> {
    await git.remove({
      fs: this.fs,
      dir,
      filepath,
    });
  }

  /**
   * Commit staged changes
   */
  async commit(dir: string, message: string, author?: { name: string; email: string }): Promise<string> {
    const sha = await git.commit({
      fs: this.fs,
      dir,
      message,
      author: author || {
        name: 'YASH User',
        email: 'user@yash.local',
      },
    });
    return sha;
  }

  /**
   * Get repository status
   */
  async status(dir: string, filepath?: string): Promise<string> {
    if (filepath) {
      return await git.status({
        fs: this.fs,
        dir,
        filepath,
      });
    }
    
    // Get status for all files
    const statusMatrix = await git.statusMatrix({
      fs: this.fs,
      dir,
    });
    
    return this.formatStatusMatrix(statusMatrix);
  }

  /**
   * Get commit log
   */
  async log(dir: string, options?: { depth?: number; ref?: string }): Promise<Array<{
    oid: string;
    message: string;
    author: { name: string; email: string; timestamp: number };
  }>> {
    const commits = await git.log({
      fs: this.fs,
      dir,
      depth: options?.depth || 10,
      ref: options?.ref || 'HEAD',
    });
    
    return commits.map(c => ({
      oid: c.oid,
      message: c.commit.message,
      author: {
        name: c.commit.author.name,
        email: c.commit.author.email,
        timestamp: c.commit.author.timestamp,
      },
    }));
  }

  /**
   * List branches
   */
  async branch(dir: string): Promise<string[]> {
    return await git.listBranches({
      fs: this.fs,
      dir,
    });
  }

  /**
   * Create a new branch
   */
  async createBranch(dir: string, name: string, ref?: string): Promise<void> {
    await git.branch({
      fs: this.fs,
      dir,
      ref: name,
      checkout: false,
    });
  }

  /**
   * Delete a branch
   */
  async deleteBranch(dir: string, name: string): Promise<void> {
    await git.deleteBranch({
      fs: this.fs,
      dir,
      ref: name,
    });
  }

  /**
   * Checkout a branch or commit
   */
  async checkout(dir: string, ref: string, options?: { force?: boolean }): Promise<void> {
    await git.checkout({
      fs: this.fs,
      dir,
      ref,
      force: options?.force,
    });
  }

  /**
   * Get current branch name
   */
  async currentBranch(dir: string): Promise<string | undefined> {
    return await git.currentBranch({
      fs: this.fs,
      dir,
    }) || undefined;
  }

  /**
   * Fetch from remote
   */
  async fetch(dir: string, options?: {
    remote?: string;
    ref?: string;
    depth?: number;
    onProgress?: (progress: { phase: string; loaded: number; total: number }) => void;
  }): Promise<void> {
    await git.fetch({
      fs: this.fs,
      http: await this.getHttpClient(),
      dir,
      remote: options?.remote || 'origin',
      ref: options?.ref,
      depth: options?.depth,
      onProgress: options?.onProgress,
      corsProxy: 'https://cors.isomorphic-git.org',
    });
  }

  /**
   * Pull from remote (fetch + merge)
   */
  async pull(dir: string, options?: {
    remote?: string;
    ref?: string;
    author?: { name: string; email: string };
    onProgress?: (progress: { phase: string; loaded: number; total: number }) => void;
  }): Promise<void> {
    await git.pull({
      fs: this.fs,
      http: await this.getHttpClient(),
      dir,
      remote: options?.remote || 'origin',
      ref: options?.ref,
      author: options?.author || { name: 'YASH User', email: 'user@yash.local' },
      onProgress: options?.onProgress,
      corsProxy: 'https://cors.isomorphic-git.org',
    });
  }

  /**
   * Push to remote
   */
  async push(dir: string, options?: {
    remote?: string;
    ref?: string;
    force?: boolean;
    onProgress?: (progress: { phase: string; loaded: number; total: number }) => void;
  }): Promise<void> {
    await git.push({
      fs: this.fs,
      http: await this.getHttpClient(),
      dir,
      remote: options?.remote || 'origin',
      ref: options?.ref,
      force: options?.force,
      onProgress: options?.onProgress,
      corsProxy: 'https://cors.isomorphic-git.org',
    });
  }

  /**
   * Show diff of a file
   */
  async diff(dir: string, filepath?: string): Promise<string> {
    // Get status matrix to find modified files
    const matrix = await git.statusMatrix({
      fs: this.fs,
      dir,
    });
    
    const output: string[] = [];
    
    for (const [file, head, workdir, stage] of matrix) {
      if (filepath && file !== filepath) continue;
      
      // File modified in working directory
      if (workdir !== head || stage !== head) {
        output.push(`diff --git a/${file} b/${file}`);
        
        // Try to show actual diff content
        try {
          if (head === 1 && workdir === 2) {
            // Modified file
            const content = await this.vfs.readFile(`${dir}/${file}`, 'utf-8');
            output.push(`--- a/${file}`);
            output.push(`+++ b/${file}`);
            output.push('@@ -1 +1 @@');
            output.push(`+${content.toString().substring(0, 100)}${content.toString().length > 100 ? '...' : ''}`);
          } else if (head === 0) {
            // New file
            output.push(`new file mode 100644`);
          } else if (workdir === 0) {
            // Deleted file
            output.push(`deleted file mode 100644`);
          }
        } catch (e) {
          output.push(`Binary files differ or file not readable`);
        }
      }
    }
    
    return output.join('\n');
  }

  /**
   * Add a remote
   */
  async remoteAdd(dir: string, name: string, url: string): Promise<void> {
    await git.addRemote({
      fs: this.fs,
      dir,
      remote: name,
      url,
    });
  }

  /**
   * List remotes
   */
  async remoteList(dir: string): Promise<Array<{ remote: string; url: string }>> {
    return await git.listRemotes({
      fs: this.fs,
      dir,
    });
  }

  /**
   * Remove a remote
   */
  async remoteRemove(dir: string, name: string): Promise<void> {
    await git.deleteRemote({
      fs: this.fs,
      dir,
      remote: name,
    });
  }

  /**
   * List tags
   */
  async listTags(dir: string): Promise<string[]> {
    return await git.listTags({
      fs: this.fs,
      dir,
    });
  }

  /**
   * Create a tag
   */
  async tag(dir: string, name: string, options?: { ref?: string; message?: string }): Promise<void> {
    await git.tag({
      fs: this.fs,
      dir,
      ref: name,
      object: options?.ref,
    });
  }

  /**
   * Delete a tag
   */
  async deleteTag(dir: string, name: string): Promise<void> {
    await git.deleteTag({
      fs: this.fs,
      dir,
      ref: name,
    });
  }

  /**
   * Stash changes (simplified - just saves to a temp location)
   */
  async stash(dir: string): Promise<string> {
    // isomorphic-git doesn't have native stash, so we simulate it
    const stashDir = `${dir}/.git/stash`;
    const stashId = Date.now().toString();
    
    try {
      await this.vfs.makeDir(stashDir, { recursive: true });
    } catch {}
    
    // Get modified files
    const matrix = await git.statusMatrix({ fs: this.fs, dir });
    const stashData: Record<string, string> = {};
    
    for (const [file, head, workdir] of matrix) {
      if (workdir !== head) {
        try {
          const content = await this.vfs.readFile(`${dir}/${file}`, 'utf-8');
          stashData[file] = content.toString();
          // Restore to HEAD version
          await git.checkout({ fs: this.fs, dir, filepaths: [file], force: true });
        } catch {}
      }
    }
    
    await this.vfs.writeFile(`${stashDir}/${stashId}.json`, JSON.stringify(stashData));
    return stashId;
  }

  /**
   * Get HTTP client for network operations
   */
  private async getHttpClient(): Promise<any> {
    // Use native fetch which works in browser
    return {
      async request({ url, method = 'GET', headers, body }: {
        url: string;
        method?: string;
        headers: Record<string, string>;
        body?: any;
      }) {
        const response = await fetch(url, {
          method,
          headers,
          body,
        });
        
        return {
          url: response.url,
          method,
          statusCode: response.status,
          statusMessage: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: response.body ? [new Uint8Array(await response.arrayBuffer())] : [],
        };
      },
    };
  }

  /**
   * Format status matrix into human-readable output
   */
  private formatStatusMatrix(matrix: [string, number, number, number][]): string {
    const lines: string[] = [];
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    
    for (const [file, head, workdir, stage] of matrix) {
      // HEAD, WORKDIR, STAGE meanings:
      // 0 = absent, 1 = present/same, 2 = modified/different
      
      if (head === 0 && workdir === 2 && stage === 0) {
        // New untracked file
        untracked.push(file);
      } else if (head === 0 && workdir === 2 && stage === 2) {
        // New file, staged
        staged.push(`new file:   ${file}`);
      } else if (head === 1 && workdir === 2 && stage === 1) {
        // Modified, not staged
        modified.push(`modified:   ${file}`);
      } else if (head === 1 && workdir === 2 && stage === 2) {
        // Modified, staged
        staged.push(`modified:   ${file}`);
      } else if (head === 1 && workdir === 0 && stage === 0) {
        // Deleted, staged
        staged.push(`deleted:    ${file}`);
      } else if (head === 1 && workdir === 0 && stage === 1) {
        // Deleted, not staged
        modified.push(`deleted:    ${file}`);
      }
    }
    
    if (staged.length > 0) {
      lines.push('Changes to be committed:');
      lines.push('  (use "git restore --staged <file>..." to unstage)');
      for (const s of staged) {
        lines.push(`\t${s}`);
      }
      lines.push('');
    }
    
    if (modified.length > 0) {
      lines.push('Changes not staged for commit:');
      lines.push('  (use "git add <file>..." to update what will be committed)');
      for (const m of modified) {
        lines.push(`\t${m}`);
      }
      lines.push('');
    }
    
    if (untracked.length > 0) {
      lines.push('Untracked files:');
      lines.push('  (use "git add <file>..." to include in what will be committed)');
      for (const u of untracked) {
        lines.push(`\t${u}`);
      }
      lines.push('');
    }
    
    if (lines.length === 0) {
      lines.push('nothing to commit, working tree clean');
    }
    
    return lines.join('\n');
  }
}

export { git };
