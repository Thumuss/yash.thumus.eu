/**
 * User and permission management for YASH virtual system
 */

export interface UserInfo {
  uid: number;
  gid: number;
  username: string;
  home: string;
  shell: string;
  groups: number[];
  password?: string;      // Hashed password (simulated)
  lastLogin?: Date;
  loginCount?: number;
}

export interface GroupInfo {
  gid: number;
  name: string;
  members: string[];
}

export interface SessionInfo {
  sid: number;           // Session ID
  uid: number;
  tty: string;
  loginTime: Date;
  host: string;
}

export interface UserManager {
  getCurrentUser(): UserInfo;
  getUser(uid: number): UserInfo | undefined;
  getUserByName(name: string): UserInfo | undefined;
  getGroup(gid: number): GroupInfo | undefined;
  getGroupByName(name: string): GroupInfo | undefined;
  listUsers(): UserInfo[];
  listGroups(): GroupInfo[];
  checkPermission(uid: number, gid: number, mode: number, operation: "read" | "write" | "execute"): boolean;
}

/**
 * Virtual user manager with sessions, groups, and authentication
 */
export class VirtualUserManager implements UserManager {
  private users: Map<number, UserInfo> = new Map();
  private groups: Map<number, GroupInfo> = new Map();
  private sessions: Map<number, SessionInfo> = new Map();
  private currentUid: number = 1000;
  private currentSid: number = 1;
  private nextUid: number = 1001;
  private nextGid: number = 1001;
  private uidStack: number[] = [];  // For su/sudo to return to previous user

  constructor() {
    this.initDefaultUsers();
    this.initDefaultGroups();
    this.initDefaultSession();
  }

  private initDefaultUsers(): void {
    const defaultUsers: UserInfo[] = [
      { uid: 0, gid: 0, username: "root", home: "/root", shell: "/bin/bash", groups: [0], password: "root", lastLogin: new Date(), loginCount: 1 },
      { uid: 1000, gid: 1000, username: "user", home: "/home/user", shell: "/bin/bash", groups: [1000, 27, 100], password: "user", lastLogin: new Date(), loginCount: 1 },
      { uid: 65534, gid: 65534, username: "nobody", home: "/nonexistent", shell: "/usr/sbin/nologin", groups: [65534] },
      { uid: 1, gid: 1, username: "daemon", home: "/usr/sbin", shell: "/usr/sbin/nologin", groups: [1] },
      { uid: 2, gid: 2, username: "bin", home: "/bin", shell: "/usr/sbin/nologin", groups: [2] },
      { uid: 33, gid: 33, username: "www-data", home: "/var/www", shell: "/usr/sbin/nologin", groups: [33] },
    ];
    
    for (const user of defaultUsers) {
      this.users.set(user.uid, user);
    }
  }

  private initDefaultGroups(): void {
    const defaultGroups: GroupInfo[] = [
      { gid: 0, name: "root", members: ["root"] },
      { gid: 1, name: "daemon", members: ["daemon"] },
      { gid: 2, name: "bin", members: ["bin"] },
      { gid: 27, name: "sudo", members: ["user"] },
      { gid: 33, name: "www-data", members: ["www-data"] },
      { gid: 100, name: "users", members: ["user"] },
      { gid: 1000, name: "user", members: ["user"] },
      { gid: 65534, name: "nogroup", members: ["nobody"] },
      { gid: 4, name: "adm", members: ["root"] },
      { gid: 20, name: "dialout", members: [] },
      { gid: 24, name: "cdrom", members: ["user"] },
      { gid: 25, name: "floppy", members: [] },
      { gid: 29, name: "audio", members: ["user"] },
      { gid: 44, name: "video", members: ["user"] },
      { gid: 46, name: "plugdev", members: ["user"] },
    ];
    
    for (const group of defaultGroups) {
      this.groups.set(group.gid, group);
    }
  }

  private initDefaultSession(): void {
    const session: SessionInfo = {
      sid: 1,
      uid: 1000,
      tty: "pts/0",
      loginTime: new Date(),
      host: "localhost",
    };
    this.sessions.set(1, session);
  }

  getCurrentUser(): UserInfo {
    return this.users.get(this.currentUid) ?? this.users.get(1000)!;
  }

  getUser(uid: number): UserInfo | undefined {
    return this.users.get(uid);
  }

  getUserByName(name: string): UserInfo | undefined {
    for (const user of this.users.values()) {
      if (user.username === name) return user;
    }
    return undefined;
  }

  getGroup(gid: number): GroupInfo | undefined {
    return this.groups.get(gid);
  }

  getGroupByName(name: string): GroupInfo | undefined {
    for (const group of this.groups.values()) {
      if (group.name === name) return group;
    }
    return undefined;
  }

  listUsers(): UserInfo[] {
    return Array.from(this.users.values());
  }

  listGroups(): GroupInfo[] {
    return Array.from(this.groups.values());
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Check if a user has permission for an operation on a file
   */
  checkPermission(uid: number, gid: number, mode: number, operation: "read" | "write" | "execute"): boolean {
    const currentUser = this.getCurrentUser();
    
    // Root can do anything
    if (currentUser.uid === 0) return true;
    
    const opBit = operation === "read" ? 4 : operation === "write" ? 2 : 1;
    
    // Check owner permissions
    if (currentUser.uid === uid) {
      return ((mode >> 6) & opBit) !== 0;
    }
    
    // Check group permissions
    if (currentUser.groups.includes(gid)) {
      return ((mode >> 3) & opBit) !== 0;
    }
    
    // Check others permissions
    return (mode & opBit) !== 0;
  }

  /**
   * Format user info like id command
   */
  id(username?: string): string {
    const user = username ? this.getUserByName(username) : this.getCurrentUser();
    if (!user) return `id: '${username}': no such user`;
    
    const groups = user.groups.map(gid => {
      const group = this.getGroup(gid);
      return `${gid}(${group?.name ?? "unknown"})`;
    }).join(",");
    
    return `uid=${user.uid}(${user.username}) gid=${user.gid}(${this.getGroup(user.gid)?.name ?? "unknown"}) groups=${groups}`;
  }

  /**
   * Format like whoami command
   */
  whoami(): string {
    return this.getCurrentUser().username;
  }

  /**
   * Switch user (for su/sudo simulation)
   */
  setCurrentUid(uid: number): boolean {
    const currentUser = this.getCurrentUser();
    
    // Root can switch to any user
    if (currentUser.uid === 0) {
      if (!this.users.has(uid)) return false;
      this.uidStack.push(this.currentUid);
      this.currentUid = uid;
      return true;
    }
    
    // User in sudo group can switch to root with password
    const sudoGroup = this.getGroupByName("sudo");
    if (sudoGroup && currentUser.groups.includes(sudoGroup.gid) && uid === 0) {
      this.uidStack.push(this.currentUid);
      this.currentUid = uid;
      return true;
    }
    
    // Regular users can only switch back to themselves
    if (uid !== currentUser.uid) {
      return false;
    }
    
    return true;
  }

  /**
   * Return to previous user (exit from su/sudo)
   */
  exitToParentUser(): boolean {
    if (this.uidStack.length === 0) return false;
    this.currentUid = this.uidStack.pop()!;
    return true;
  }

  /**
   * Add a new user
   */
  addUser(username: string, options: { uid?: number; gid?: number; home?: string; shell?: string; groups?: number[] } = {}): UserInfo | null {
    if (this.getUserByName(username)) return null;
    
    const uid = options.uid ?? this.nextUid++;
    const gid = options.gid ?? this.nextGid++;
    
    // Create user's primary group if it doesn't exist
    if (!this.groups.has(gid)) {
      this.groups.set(gid, { gid, name: username, members: [username] });
    }
    
    const user: UserInfo = {
      uid,
      gid,
      username,
      home: options.home ?? `/home/${username}`,
      shell: options.shell ?? "/bin/bash",
      groups: options.groups ?? [gid],
      lastLogin: new Date(),
      loginCount: 0,
    };
    
    this.users.set(uid, user);
    return user;
  }

  /**
   * Remove a user
   */
  removeUser(username: string): boolean {
    const user = this.getUserByName(username);
    if (!user) return false;
    if (user.uid === 0 || user.uid === this.currentUid) return false;
    
    this.users.delete(user.uid);
    return true;
  }

  /**
   * Modify a user
   */
  modifyUser(username: string, changes: Partial<UserInfo>): boolean {
    const user = this.getUserByName(username);
    if (!user) return false;
    
    if (changes.username) user.username = changes.username;
    if (changes.home) user.home = changes.home;
    if (changes.shell) user.shell = changes.shell;
    if (changes.groups) user.groups = changes.groups;
    if (changes.gid !== undefined) user.gid = changes.gid;
    
    return true;
  }

  /**
   * Add a new group
   */
  addGroup(name: string, gid?: number): GroupInfo | null {
    if (this.getGroupByName(name)) return null;
    
    const id = gid ?? this.nextGid++;
    const group: GroupInfo = { gid: id, name, members: [] };
    this.groups.set(id, group);
    return group;
  }

  /**
   * Remove a group
   */
  removeGroup(name: string): boolean {
    const group = this.getGroupByName(name);
    if (!group) return false;
    if (group.gid === 0) return false;
    
    this.groups.delete(group.gid);
    return true;
  }

  /**
   * Add user to group
   */
  addUserToGroup(username: string, groupName: string): boolean {
    const user = this.getUserByName(username);
    const group = this.getGroupByName(groupName);
    if (!user || !group) return false;
    
    if (!user.groups.includes(group.gid)) {
      user.groups.push(group.gid);
    }
    if (!group.members.includes(username)) {
      group.members.push(username);
    }
    return true;
  }

  /**
   * Remove user from group
   */
  removeUserFromGroup(username: string, groupName: string): boolean {
    const user = this.getUserByName(username);
    const group = this.getGroupByName(groupName);
    if (!user || !group) return false;
    
    user.groups = user.groups.filter(g => g !== group.gid);
    group.members = group.members.filter(m => m !== username);
    return true;
  }

  /**
   * Authenticate user (simplified - just checks password string match)
   */
  authenticate(username: string, password: string): boolean {
    const user = this.getUserByName(username);
    if (!user) return false;
    return user.password === password;
  }

  /**
   * Change password
   */
  changePassword(username: string, newPassword: string): boolean {
    const user = this.getUserByName(username);
    if (!user) return false;
    user.password = newPassword;
    return true;
  }

  /**
   * Create a new session
   */
  createSession(uid: number, tty: string = "pts/0", host: string = "localhost"): SessionInfo {
    const sid = ++this.currentSid;
    const session: SessionInfo = {
      sid,
      uid,
      tty,
      loginTime: new Date(),
      host,
    };
    this.sessions.set(sid, session);
    
    // Update user's last login
    const user = this.users.get(uid);
    if (user) {
      user.lastLogin = new Date();
      user.loginCount = (user.loginCount ?? 0) + 1;
    }
    
    return session;
  }

  /**
   * End a session
   */
  endSession(sid: number): boolean {
    return this.sessions.delete(sid);
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionInfo | undefined {
    for (const session of this.sessions.values()) {
      if (session.uid === this.currentUid) return session;
    }
    return undefined;
  }

  /**
   * Generate /etc/passwd format
   */
  generatePasswd(): string {
    const lines: string[] = [];
    for (const user of this.users.values()) {
      lines.push(`${user.username}:x:${user.uid}:${user.gid}:${user.username}:${user.home}:${user.shell}`);
    }
    return lines.join("\n");
  }

  /**
   * Generate /etc/group format
   */
  generateGroup(): string {
    const lines: string[] = [];
    for (const group of this.groups.values()) {
      lines.push(`${group.name}:x:${group.gid}:${group.members.join(",")}`);
    }
    return lines.join("\n");
  }

  /**
   * Generate /etc/shadow format (simulated)
   */
  generateShadow(): string {
    const lines: string[] = [];
    const today = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    for (const user of this.users.values()) {
      lines.push(`${user.username}:$6$simulated$hash:${today}:0:99999:7:::`);
    }
    return lines.join("\n");
  }
}

/**
 * Permission mode utilities
 */
export const PermissionUtils = {
  /**
   * Convert mode number to string (like ls -l)
   */
  modeToString(mode: number, type: "file" | "directory" | "symlink" = "file"): string {
    const typeChar = type === "directory" ? "d" : type === "symlink" ? "l" : "-";
    
    const perms = [
      (mode & 0o400) ? "r" : "-",
      (mode & 0o200) ? "w" : "-",
      (mode & 0o100) ? "x" : "-",
      (mode & 0o040) ? "r" : "-",
      (mode & 0o020) ? "w" : "-",
      (mode & 0o010) ? "x" : "-",
      (mode & 0o004) ? "r" : "-",
      (mode & 0o002) ? "w" : "-",
      (mode & 0o001) ? "x" : "-",
    ];
    
    return typeChar + perms.join("");
  },

  /**
   * Parse symbolic mode string to number
   */
  parseMode(str: string): number {
    // Handle octal
    if (/^[0-7]{3,4}$/.test(str)) {
      return parseInt(str, 8);
    }
    
    // Handle symbolic (simplified)
    let mode = 0;
    const parts = str.split(",");
    
    for (const part of parts) {
      const match = part.match(/^([ugoa]*)([+\-=])([rwx]*)$/);
      if (!match) continue;
      
      let [, who, op, perms] = match;
      if (!who || who === "a") who = "ugo";
      
      let bits = 0;
      if (perms.includes("r")) bits |= 4;
      if (perms.includes("w")) bits |= 2;
      if (perms.includes("x")) bits |= 1;
      
      for (const w of who) {
        const shift = w === "u" ? 6 : w === "g" ? 3 : 0;
        if (op === "+") {
          mode |= bits << shift;
        } else if (op === "-") {
          mode &= ~(bits << shift);
        } else if (op === "=") {
          mode = (mode & ~(7 << shift)) | (bits << shift);
        }
      }
    }
    
    return mode;
  },
};
