/**
 * Virtual Filesystem for YASH
 * Provides a portable filesystem abstraction that can be used
 * both in Node.js/Bun and in the browser.
 */

export type FileType = "file" | "directory" | "symlink";

export interface FileStats {
  type: FileType;
  size: number;
  mode: number;      // Unix-style permissions (e.g., 0o755)
  uid: number;       // Owner user ID
  gid: number;       // Owner group ID
  atime: Date;       // Access time
  mtime: Date;       // Modification time
  ctime: Date;       // Change time (metadata)
  birthtime: Date;   // Creation time
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export interface FileEntry {
  name: string;
  type: FileType;
  content?: string | Uint8Array;
  target?: string;   // For symlinks
  mode: number;
  uid: number;
  gid: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
  children?: Map<string, FileEntry>;  // For directories
}

export interface FileSystemOperations {
  // File operations
  readFile(path: string, encoding?: "utf-8" | "binary"): Promise<string | Uint8Array>;
  writeFile(path: string, content: string | Uint8Array, options?: { mode?: number }): Promise<void>;
  appendFile(path: string, content: string | Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  
  // Directory operations
  readDir(path: string): Promise<string[]>;
  makeDir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<void>;
  removeDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  
  // Path operations
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStats>;
  lstat(path: string): Promise<FileStats>;  // Like stat but doesn't follow symlinks
  
  // Link operations
  symlink(target: string, path: string): Promise<void>;
  readlink(path: string): Promise<string>;
  
  // File manipulation
  rename(oldPath: string, newPath: string): Promise<void>;
  copy(src: string, dest: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  chown(path: string, uid: number, gid: number): Promise<void>;
  
  // Utility
  realpath(path: string): Promise<string>;
  access(path: string, mode?: number): Promise<boolean>;
}

/**
 * In-memory virtual filesystem implementation
 */
export class VirtualFileSystem implements FileSystemOperations {
  private root: FileEntry;
  private cwd: string = "/";
  // Simulated mounts and sizes (in bytes)
  private mounts: Map<string, { size: number }>; 

  constructor() {
    const now = new Date();
    this.root = {
      name: "",
      type: "directory",
      mode: 0o755,
      uid: 0,
      gid: 0,
      atime: now,
      mtime: now,
      ctime: now,
      birthtime: now,
      children: new Map(),
    };
    this.mounts = new Map();
    // Default root mount: 100 MB
    this.mounts.set("/", { size: 100 * 1024 * 1024 });

    // Create standard directories
    this.initStandardDirs();
  }

  /**
   * Compute total used bytes under a path
   */
  private getSizeRecursive(entry: FileEntry): number {
    if (!entry) return 0;
    if (entry.type === "file") {
      if (!entry.content) return 0;
      return typeof entry.content === "string" ? entry.content.length : entry.content.length;
    }
    let total = 0;
    if (entry.children) {
      for (const child of entry.children.values()) {
        total += this.getSizeRecursive(child);
      }
    }
    return total;
  }

  private initStandardDirs(): void {
    const dirs = [
      "/bin",
      "/etc",
      "/home",
      "/home/user",
      "/tmp",
      "/var",
      "/var/log",
      "/usr",
      "/usr/bin",
      "/usr/local",
      "/usr/local/bin",
    ];
    
    for (const dir of dirs) {
      this.makeDirSync(dir, { recursive: true });
    }
    
    // Create some default files
    this.writeFileSync("/etc/passwd", "root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:user:/home/user:/bin/bash\n");
    this.writeFileSync("/etc/hostname", "yash-virtual\n");
    this.writeFileSync("/home/user/.bashrc", "# YASH virtual shell\nexport PATH=/usr/local/bin:/usr/bin:/bin\n");
  }

  /**
   * Normalize and resolve a path
   */
  private normalizePath(path: string): string {
    // Handle relative paths
    if (!path.startsWith("/")) {
      path = this.cwd + "/" + path;
    }
    
    // Split and process
    const parts = path.split("/").filter(p => p.length > 0);
    const result: string[] = [];
    
    for (const part of parts) {
      if (part === ".") {
        continue;
      } else if (part === "..") {
        result.pop();
      } else {
        result.push(part);
      }
    }
    
    return "/" + result.join("/");
  }

  /**
   * Get a file entry by path
   */
  private getEntry(path: string, followSymlinks = true): FileEntry | null {
    const normalizedPath = this.normalizePath(path);
    
    if (normalizedPath === "/") {
      return this.root;
    }
    
    const parts = normalizedPath.split("/").filter(p => p.length > 0);
    let current: FileEntry = this.root;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (current.type !== "directory" || !current.children) {
        return null;
      }
      
      const next = current.children.get(part);
      if (!next) {
        return null;
      }
      
      // Handle symlinks
      if (followSymlinks && next.type === "symlink" && next.target) {
        const targetPath = next.target.startsWith("/") 
          ? next.target 
          : this.normalizePath("/" + parts.slice(0, i).join("/") + "/" + next.target);
        const resolved = this.getEntry(targetPath, true);
        if (!resolved) return null;
        current = resolved;
      } else {
        current = next;
      }
    }
    
    return current;
  }

  /**
   * Get parent directory entry
   */
  private getParentEntry(path: string): { parent: FileEntry; name: string } | null {
    const normalizedPath = this.normalizePath(path);
    const parts = normalizedPath.split("/").filter(p => p.length > 0);
    
    if (parts.length === 0) {
      return null; // Can't get parent of root
    }
    
    const name = parts.pop()!;
    const parentPath = "/" + parts.join("/");
    const parent = this.getEntry(parentPath);
    
    if (!parent || parent.type !== "directory") {
      return null;
    }
    
    return { parent, name };
  }

  private createStats(entry: FileEntry): FileStats {
    return {
      type: entry.type,
      size: entry.content ? 
        (typeof entry.content === "string" ? entry.content.length : entry.content.length) : 
        0,
      mode: entry.mode,
      uid: entry.uid,
      gid: entry.gid,
      atime: entry.atime,
      mtime: entry.mtime,
      ctime: entry.ctime,
      birthtime: entry.birthtime,
      isFile: () => entry.type === "file",
      isDirectory: () => entry.type === "directory",
      isSymbolicLink: () => entry.type === "symlink",
    };
  }

  // Sync helpers for initialization
  private makeDirSync(path: string, options?: { recursive?: boolean; mode?: number }): void {
    const normalizedPath = this.normalizePath(path);
    const parts = normalizedPath.split("/").filter(p => p.length > 0);
    
    let current = this.root;
    
    for (const part of parts) {
      if (!current.children) {
        current.children = new Map();
      }
      
      if (!current.children.has(part)) {
        if (!options?.recursive) {
          throw new Error(`ENOENT: no such file or directory: ${path}`);
        }
        
        const now = new Date();
        const newDir: FileEntry = {
          name: part,
          type: "directory",
          mode: options?.mode ?? 0o755,
          uid: 0,
          gid: 0,
          atime: now,
          mtime: now,
          ctime: now,
          birthtime: now,
          children: new Map(),
        };
        current.children.set(part, newDir);
      }
      
      current = current.children.get(part)!;
    }
  }

  private writeFileSync(path: string, content: string | Uint8Array): void {
    const parentInfo = this.getParentEntry(path);
    if (!parentInfo) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    
    const now = new Date();
    const existing = parentInfo.parent.children?.get(parentInfo.name);
    
    const entry: FileEntry = {
      name: parentInfo.name,
      type: "file",
      content,
      mode: existing?.mode ?? 0o644,
      uid: existing?.uid ?? 0,
      gid: existing?.gid ?? 0,
      atime: now,
      mtime: now,
      ctime: now,
      birthtime: existing?.birthtime ?? now,
    };
    
    parentInfo.parent.children!.set(parentInfo.name, entry);
  }

  // Public async API
  async readFile(path: string, encoding?: "utf-8" | "binary"): Promise<string | Uint8Array> {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (entry.type !== "file") {
      throw new Error(`EISDIR: illegal operation on a directory: ${path}`);
    }
    
    entry.atime = new Date();
    
    if (encoding === "binary" && typeof entry.content === "string") {
      return new TextEncoder().encode(entry.content);
    }
    if (encoding === "utf-8" && entry.content instanceof Uint8Array) {
      return new TextDecoder().decode(entry.content);
    }
    
    return entry.content ?? "";
  }

  async writeFile(path: string, content: string | Uint8Array, options?: { mode?: number }): Promise<void> {
    const parentInfo = this.getParentEntry(path);
    if (!parentInfo) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    
    const now = new Date();
    const existing = parentInfo.parent.children?.get(parentInfo.name);
    
    const entry: FileEntry = {
      name: parentInfo.name,
      type: "file",
      content,
      mode: options?.mode ?? existing?.mode ?? 0o644,
      uid: existing?.uid ?? 0,
      gid: existing?.gid ?? 0,
      atime: now,
      mtime: now,
      ctime: now,
      birthtime: existing?.birthtime ?? now,
    };
    
    parentInfo.parent.children!.set(parentInfo.name, entry);
  }

  async appendFile(path: string, content: string | Uint8Array): Promise<void> {
    const entry = this.getEntry(path);
    
    if (!entry) {
      return this.writeFile(path, content);
    }
    
    if (entry.type !== "file") {
      throw new Error(`EISDIR: illegal operation on a directory: ${path}`);
    }
    
    const existingContent = entry.content ?? "";
    if (typeof existingContent === "string" && typeof content === "string") {
      entry.content = existingContent + content;
    } else {
      const existingBytes = typeof existingContent === "string" 
        ? new TextEncoder().encode(existingContent)
        : existingContent;
      const newBytes = typeof content === "string"
        ? new TextEncoder().encode(content)
        : content;
      const combined = new Uint8Array(existingBytes.length + newBytes.length);
      combined.set(existingBytes);
      combined.set(newBytes, existingBytes.length);
      entry.content = combined;
    }
    
    entry.mtime = new Date();
  }

  async deleteFile(path: string): Promise<void> {
    const parentInfo = this.getParentEntry(path);
    if (!parentInfo) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    
    const entry = parentInfo.parent.children?.get(parentInfo.name);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (entry.type === "directory") {
      throw new Error(`EISDIR: illegal operation on a directory: ${path}`);
    }
    
    parentInfo.parent.children!.delete(parentInfo.name);
  }

  async readDir(path: string): Promise<string[]> {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (entry.type !== "directory") {
      throw new Error(`ENOTDIR: not a directory: ${path}`);
    }
    
    entry.atime = new Date();
    return Array.from(entry.children?.keys() ?? []);
  }

  async makeDir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<void> {
    this.makeDirSync(path, options);
  }

  async removeDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const parentInfo = this.getParentEntry(path);
    if (!parentInfo) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    
    const entry = parentInfo.parent.children?.get(parentInfo.name);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (entry.type !== "directory") {
      throw new Error(`ENOTDIR: not a directory: ${path}`);
    }
    
    if (entry.children && entry.children.size > 0 && !options?.recursive) {
      throw new Error(`ENOTEMPTY: directory not empty: ${path}`);
    }
    
    parentInfo.parent.children!.delete(parentInfo.name);
  }

  async exists(path: string): Promise<boolean> {
    return this.getEntry(path) !== null;
  }

  async stat(path: string): Promise<FileStats> {
    const entry = this.getEntry(path, true);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    return this.createStats(entry);
  }

  async lstat(path: string): Promise<FileStats> {
    const entry = this.getEntry(path, false);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    return this.createStats(entry);
  }

  async symlink(target: string, path: string): Promise<void> {
    const parentInfo = this.getParentEntry(path);
    if (!parentInfo) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    
    if (parentInfo.parent.children?.has(parentInfo.name)) {
      throw new Error(`EEXIST: file already exists: ${path}`);
    }
    
    const now = new Date();
    const entry: FileEntry = {
      name: parentInfo.name,
      type: "symlink",
      target,
      mode: 0o777,
      uid: 0,
      gid: 0,
      atime: now,
      mtime: now,
      ctime: now,
      birthtime: now,
    };
    
    parentInfo.parent.children!.set(parentInfo.name, entry);
  }

  /** Create a hard link (approximate) */
  async link(existingPath: string, newPath: string): Promise<void> {
    const entry = this.getEntry(existingPath);
    if (!entry) throw new Error(`ENOENT: no such file or directory: ${existingPath}`);

    const parentInfo = this.getParentEntry(newPath);
    if (!parentInfo) throw new Error(`ENOENT: no such file or directory: ${newPath}`);

    if (parentInfo.parent.children?.has(parentInfo.name)) {
      throw new Error(`EEXIST: file already exists: ${newPath}`);
    }

    // Shallow clone of entry (content reference preserved for files)
    const now = new Date();
    const clone: FileEntry = {
      name: parentInfo.name,
      type: entry.type,
      content: entry.content,
      target: entry.target,
      mode: entry.mode,
      uid: entry.uid,
      gid: entry.gid,
      atime: now,
      mtime: now,
      ctime: now,
      birthtime: entry.birthtime ?? now,
      children: entry.children ? new Map(entry.children) : undefined,
    };

    parentInfo.parent.children!.set(parentInfo.name, clone);
  }

  async truncate(path: string, len: number): Promise<void> {
    const entry = this.getEntry(path);
    if (!entry) throw new Error(`ENOENT: no such file or directory: ${path}`);
    if (entry.type !== "file") throw new Error(`EISDIR: illegal operation on a directory: ${path}`);

    const content = entry.content ?? "";
    if (typeof content === "string") {
      entry.content = content.slice(0, len).padEnd(len, "\0");
    } else {
      const buf = content as Uint8Array;
      const newBuf = new Uint8Array(len);
      newBuf.set(buf.subarray(0, Math.min(buf.length, len)));
      entry.content = newBuf;
    }
    entry.mtime = new Date();
    entry.ctime = new Date();
  }

  async mktemp(prefix: string = "/tmp/tmp."): Promise<string> {
    // Generate unique name
    const rnd = Math.floor(Math.random() * 1e9).toString(36);
    const path = `${prefix}${rnd}`;
    await this.writeFile(path, "");
    return path;
  }

  async readlink(path: string): Promise<string> {
    const entry = this.getEntry(path, false);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (entry.type !== "symlink") {
      throw new Error(`EINVAL: invalid argument: ${path}`);
    }
    return entry.target!;
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const oldParentInfo = this.getParentEntry(oldPath);
    const newParentInfo = this.getParentEntry(newPath);
    
    if (!oldParentInfo || !newParentInfo) {
      throw new Error(`ENOENT: no such file or directory`);
    }
    
    const entry = oldParentInfo.parent.children?.get(oldParentInfo.name);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${oldPath}`);
    }
    
    // Remove from old location
    oldParentInfo.parent.children!.delete(oldParentInfo.name);
    
    // Update name and add to new location
    entry.name = newParentInfo.name;
    entry.ctime = new Date();
    newParentInfo.parent.children!.set(newParentInfo.name, entry);
  }

  async copy(src: string, dest: string): Promise<void> {
    const srcEntry = this.getEntry(src);
    if (!srcEntry) {
      throw new Error(`ENOENT: no such file or directory: ${src}`);
    }
    
    if (srcEntry.type === "file") {
      await this.writeFile(dest, srcEntry.content ?? "");
    } else if (srcEntry.type === "directory") {
      await this.makeDir(dest, { recursive: true });
      const children = await this.readDir(src);
      for (const child of children) {
        await this.copy(`${src}/${child}`, `${dest}/${child}`);
      }
    } else if (srcEntry.type === "symlink") {
      await this.symlink(srcEntry.target!, dest);
    }
  }

  /** Return disk usage info for a mount point */
  async getDiskUsage(mountPoint: string = "/"): Promise<{ total: number; used: number; free: number }> {
    const mount = this.mounts.get(mountPoint) ?? this.mounts.get("/");
    const total = mount?.size ?? 0;
    const used = this.getSizeRecursive(this.root);
    const free = Math.max(0, total - used);
    return { total, used, free };
  }

  async chmod(path: string, mode: number): Promise<void> {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    entry.mode = mode;
    entry.ctime = new Date();
  }

  async chown(path: string, uid: number, gid: number): Promise<void> {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    entry.uid = uid;
    entry.gid = gid;
    entry.ctime = new Date();
  }

  async realpath(path: string): Promise<string> {
    const normalizedPath = this.normalizePath(path);
    const entry = this.getEntry(normalizedPath);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    return normalizedPath;
  }

  async access(path: string, _mode?: number): Promise<boolean> {
    return this.exists(path);
  }

  // Additional utility methods
  getCwd(): string {
    return this.cwd;
  }

  setCwd(path: string): void {
    const normalizedPath = this.normalizePath(path);
    const entry = this.getEntry(normalizedPath);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (entry.type !== "directory") {
      throw new Error(`ENOTDIR: not a directory: ${path}`);
    }
    this.cwd = normalizedPath;
  }

  /**
   * Get a tree representation of the filesystem
   */
  tree(path: string = "/", depth: number = Infinity): string {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    
    const lines: string[] = [this.normalizePath(path)];
    this.treeHelper(entry, "", depth, lines);
    return lines.join("\n");
  }

  private treeHelper(entry: FileEntry, prefix: string, depth: number, lines: string[]): void {
    if (depth <= 0 || entry.type !== "directory" || !entry.children) return;
    
    const children = Array.from(entry.children.entries());
    children.forEach(([name, child], index) => {
      const isLast = index === children.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const typeIndicator = child.type === "directory" ? "/" : (child.type === "symlink" ? "@" : "");
      lines.push(prefix + connector + name + typeIndicator);
      
      if (child.type === "directory") {
        const newPrefix = prefix + (isLast ? "    " : "│   ");
        this.treeHelper(child, newPrefix, depth - 1, lines);
      }
    });
  }
}
