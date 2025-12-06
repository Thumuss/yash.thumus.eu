/**
 * Complete System Bridge for YASH
 * Provides a full virtual system with filesystem, processes, users, and environment.
 */

import type {
  Bridge,
  FunctionsYash,
  PrimitivesJS,
  VariablesYash,
} from "@yash/language";
import {
  VirtualFileSystem,
  type FileSystemOperations,
  type FileStats,
} from "./filesystem";
import {
  VirtualProcessManager,
  type ProcessManager,
  type ProcessInfo,
  Signals,
} from "./process";
import { VirtualUserManager, type UserManager, PermissionUtils } from "./users";
import { GitCommands } from "./git";

export interface SystemBridge extends Bridge {
  // Virtual system components
  fs: FileSystemOperations;
  process: ProcessManager;
  users: UserManager;

  // Working directory
  cwd: string;
  setCwd(path: string): void;

  // Terminal
  terminal: TerminalInterface;

  // History
  history: string[];
  addHistory(command: string): void;
}

export interface TerminalInterface {
  write(data: string): void;
  writeLine(data: string): void;
  writeError(data: string): void;
  clear(): void;
  getSize(): { rows: number; cols: number };
  setTitle(title: string): void;
  bell(): void;
}

export interface SystemBridgeOptions {
  onOutput?: (data: string) => void;
  onError?: (data: string) => void;
  onClear?: () => void;
  terminalSize?: { rows: number; cols: number };
}

/**
 * Create a complete system bridge with virtual filesystem, processes, and users
 */
export function createSystemBridge(
  options: SystemBridgeOptions = {}
): SystemBridge {
  const fs = new VirtualFileSystem();
  const process = new VirtualProcessManager();
  const users = new VirtualUserManager();
  const gitCmd = new GitCommands(fs);

  let cwd = "/home/user";
  // Sync filesystem's cwd with bridge's cwd
  fs.setCwd(cwd);

  const history: string[] = [];
  const outputBuffer: PrimitivesJS[] = [];

  // Terminal interface
  const terminal: TerminalInterface = {
    write(data: string) {
      options.onOutput?.(data);
    },
    writeLine(data: string) {
      options.onOutput?.(data + "\n");
    },
    writeError(data: string) {
      options.onError?.(data);
    },
    clear() {
      options.onClear?.();
    },
    getSize() {
      return options.terminalSize ?? { rows: 24, cols: 80 };
    },
    setTitle(_title: string) {
      // Could be implemented for web terminal
    },
    bell() {
      // Could play a sound or flash
    },
  };

  // Built-in system functions
  const systemFunctions: FunctionsYash = {
    // File system commands
    ls: async (bridge, vars) => {
      // Collect all arguments
      const args: string[] = [];
      let i = 1;
      while (vars[String(i)] !== undefined) {
        args.push(String(vars[String(i)]));
        i++;
      }

      // Parse flags and path
      let showAll = false;
      let showLong = false;
      let targetPath = (bridge as SystemBridge).cwd;

      for (const arg of args) {
        if (arg === "-a" || arg === "--all") {
          showAll = true;
        } else if (arg === "-l") {
          showLong = true;
        } else if (arg === "-la" || arg === "-al") {
          showAll = true;
          showLong = true;
        } else if (!arg.startsWith("-")) {
          targetPath = arg.startsWith("/")
            ? arg
            : `${(bridge as SystemBridge).cwd}/${arg}`;
        }
      }

      try {
        const entries = await (bridge as SystemBridge).fs.readDir(targetPath);
        const filteredEntries = showAll
          ? entries
          : entries.filter((e) => !e.startsWith("."));

        if (showLong) {
          const lines: string[] = [];
          for (const entry of filteredEntries) {
            try {
              const entryPath =
                targetPath === "/" ? `/${entry}` : `${targetPath}/${entry}`;
              const stat = await (bridge as SystemBridge).fs.stat(entryPath);
              const mode = PermissionUtils.modeToString(stat.mode, stat.type);
              const user =
                (bridge as SystemBridge).users.getUser(stat.uid)?.username ??
                stat.uid;
              const group =
                (bridge as SystemBridge).users.getGroup(stat.gid)?.name ??
                stat.gid;
              const size = stat.size.toString().padStart(8);
              const date = stat.mtime.toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              lines.push(`${mode} 1 ${user} ${group} ${size} ${date} ${entry}`);
            } catch {
              lines.push(`?????????? ? ? ? ? ? ${entry}`);
            }
          }
          const output = lines.join("\n");
          await bridge.out(output);
          return null;
        } else {
          const output = filteredEntries.join("  ");
          await bridge.out(output);
          return null;
        }
      } catch (e: any) {
        await bridge.err(`ls: ${e.message}`);
        return null;
      }
    },

    cat: async (bridge, vars) => {
      const files: string[] = [];
      let i = 1;
      while (vars[String(i)] !== undefined) {
        files.push(String(vars[String(i)]));
        i++;
      }

      if (files.length === 0) {
        await bridge.err("cat: missing file operand");
        return null;
      }

      const outputs: string[] = [];
      for (const file of files) {
        try {
          const content = await (bridge as SystemBridge).fs.readFile(
            file,
            "utf-8"
          );
          outputs.push(content as string);
        } catch (e: any) {
          await bridge.err(`cat: ${file}: ${e.message}`);
        }
      }

      const output = outputs.join("");
      await bridge.out(output);
      return null;
    },

    head: async (bridge, vars) => {
      let lines = 10;
      let file = String(vars["1"] ?? "");

      if (vars["1"] === "-n" && vars["2"]) {
        lines = parseInt(String(vars["2"])) || 10;
        file = String(vars["3"] ?? "");
      }

      if (!file) {
        await bridge.err("head: missing file operand");
        return null;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const output = content.split("\n").slice(0, lines).join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`head: ${file}: ${e.message}`);
        return null;
      }
    },

    tail: async (bridge, vars) => {
      let lines = 10;
      let file = String(vars["1"] ?? "");

      if (vars["1"] === "-n" && vars["2"]) {
        lines = parseInt(String(vars["2"])) || 10;
        file = String(vars["3"] ?? "");
      }

      if (!file) {
        await bridge.err("tail: missing file operand");
        return null;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const allLines = content.split("\n");
        const output = allLines.slice(-lines).join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`tail: ${file}: ${e.message}`);
        return null;
      }
    },

    touch: async (bridge, vars) => {
      let i = 1;
      while (vars[String(i)] !== undefined) {
        const file = String(vars[String(i)]);
        try {
          const exists = await (bridge as SystemBridge).fs.exists(file);
          if (!exists) {
            await (bridge as SystemBridge).fs.writeFile(file, "");
          }
          // In a real implementation, we'd update the timestamp
        } catch (e: any) {
          await bridge.err(`touch: ${file}: ${e.message}`);
        }
        i++;
      }
      return null;
    },

    mkdir: async (bridge, vars) => {
      const recursive = vars["1"] === "-p";
      let i = recursive ? 2 : 1;

      while (vars[String(i)] !== undefined) {
        const dir = String(vars[String(i)]);
        try {
          await (bridge as SystemBridge).fs.makeDir(dir, { recursive });
        } catch (e: any) {
          await bridge.err(`mkdir: ${dir}: ${e.message}`);
        }
        i++;
      }
      return null;
    },

    rmdir: async (bridge, vars) => {
      let i = 1;
      while (vars[String(i)] !== undefined) {
        const dir = String(vars[String(i)]);
        try {
          await (bridge as SystemBridge).fs.removeDir(dir);
        } catch (e: any) {
          await bridge.err(`rmdir: ${dir}: ${e.message}`);
        }
        i++;
      }
      return null;
    },

    rm: async (bridge, vars) => {
      const recursive =
        vars["1"] === "-r" || vars["1"] === "-rf" || vars["2"] === "-r";
      const force =
        vars["1"] === "-f" || vars["1"] === "-rf" || vars["2"] === "-f";
      let i = vars["1"]?.toString().startsWith("-") ? 2 : 1;
      if (vars["2"]?.toString().startsWith("-")) i = 3;

      while (vars[String(i)] !== undefined) {
        const path = String(vars[String(i)]);
        try {
          const stat = await (bridge as SystemBridge).fs.stat(path);
          if (stat.isDirectory()) {
            if (recursive) {
              await (bridge as SystemBridge).fs.removeDir(path, {
                recursive: true,
              });
            } else {
              await bridge.err(`rm: ${path}: is a directory`);
            }
          } else {
            await (bridge as SystemBridge).fs.deleteFile(path);
          }
        } catch (e: any) {
          if (!force) {
            await bridge.err(`rm: ${path}: ${e.message}`);
          }
        }
        i++;
      }
      return null;
    },

    cp: async (bridge, vars) => {
      const recursive = vars["1"] === "-r" || vars["1"] === "-R";
      const srcIdx = recursive ? 2 : 1;
      const src = String(vars[String(srcIdx)] ?? "");
      const dest = String(vars[String(srcIdx + 1)] ?? "");

      if (!src || !dest) {
        await bridge.err("cp: missing file operand");
        return null;
      }

      try {
        await (bridge as SystemBridge).fs.copy(src, dest);
      } catch (e: any) {
        await bridge.err(`cp: ${e.message}`);
      }
      return null;
    },

    mv: async (bridge, vars) => {
      const src = String(vars["1"] ?? "");
      const dest = String(vars["2"] ?? "");

      if (!src || !dest) {
        await bridge.err("mv: missing file operand");
        return null;
      }

      try {
        await (bridge as SystemBridge).fs.rename(src, dest);
      } catch (e: any) {
        await bridge.err(`mv: ${e.message}`);
      }
      return null;
    },

    // Working directory
    pwd: async (bridge) => {
      const output = (bridge as SystemBridge).cwd;
      await bridge.out(output);
      return null;
    },

    cd: async (bridge, vars) => {
      const dir =
        vars["1"] !== undefined
          ? String(vars["1"])
          : (bridge.global_variables["HOME"] as string) ?? "/home/user";
      const targetDir =
        dir === "-"
          ? (bridge.global_variables["OLDPWD"] as string) ?? "/"
          : dir;

      try {
        const sb = bridge as SystemBridge;
        const stat = await sb.fs.stat(targetDir);
        if (!stat.isDirectory()) {
          await bridge.err(`cd: ${targetDir}: Not a directory`);
          bridge.global_variables["?"] = 1;
          return null;
        }

        bridge.global_variables["OLDPWD"] = sb.cwd;
        sb.setCwd(targetDir);
        bridge.global_variables["PWD"] = sb.cwd;
        bridge.global_variables["?"] = 0;
        return null;
      } catch (e: any) {
        await bridge.err(`cd: ${targetDir}: ${e.message}`);
        bridge.global_variables["?"] = 1;
        return null;
      }
    },

    // Process commands
    ps: async (bridge, vars) => {
      const all =
        vars["1"] === "-a" || vars["1"] === "-e" || vars["1"] === "aux";
      const full = vars["1"] === "-f" || vars["1"] === "aux";
      const output = (bridge as SystemBridge).process.ps({ all, full });
      await bridge.out(output);
      return null;
    },

    kill: async (bridge, vars) => {
      let signal = 15;
      let pidArg = vars["1"];

      if (typeof pidArg === "string" && pidArg.startsWith("-")) {
        const sigName = pidArg.slice(1).toUpperCase();
        const sigNum =
          (Signals as any)[sigName] ??
          (Signals as any)[`SIG${sigName}`] ??
          parseInt(pidArg.slice(1));
        signal = isNaN(sigNum) ? 15 : sigNum;
        pidArg = vars["2"];
      }

      const pid = parseInt(String(pidArg));
      if (isNaN(pid)) {
        await bridge.err("kill: invalid pid");
        return 1;
      }

      const success = (bridge as SystemBridge).process.kill(pid, signal);
      if (!success) {
        await bridge.err(`kill: (${pid}) - No such process`);
        return 1;
      }
      return 0;
    },

    // User commands
    whoami: async (bridge) => {
      const output = (bridge as SystemBridge).users.whoami();
      await bridge.out(output);
      return null;
    },

    id: async (bridge, vars) => {
      const username = vars["1"] !== undefined ? String(vars["1"]) : undefined;
      const output = (bridge as SystemBridge).users.id(username);
      await bridge.out(output);
      return null;
    },

    // Environment
    env: async (bridge) => {
      const env = (bridge as SystemBridge).process.getAllEnv();
      const output = Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      await bridge.out(output);
      return null;
    },

    printenv: async (bridge, vars) => {
      const name = vars["1"];
      if (name !== undefined) {
        const value = (bridge as SystemBridge).process.getEnv(String(name));
        if (value !== undefined) {
          await bridge.out(value);
          return value;
        }
        return null;
      }

      const env = (bridge as SystemBridge).process.getAllEnv();
      const output = Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      await bridge.out(output);
      return null;
    },

    // File info
    stat: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("stat: missing file operand");
        return null;
      }

      try {
        const stat = await (bridge as SystemBridge).fs.stat(file);
        const lines = [
          `  File: ${file}`,
          `  Size: ${stat.size}\tType: ${stat.type}`,
          `Access: (${stat.mode
            .toString(8)
            .padStart(4, "0")}/${PermissionUtils.modeToString(
            stat.mode,
            stat.type
          )})\tUid: ${stat.uid}\tGid: ${stat.gid}`,
          `Access: ${stat.atime.toISOString()}`,
          `Modify: ${stat.mtime.toISOString()}`,
          `Change: ${stat.ctime.toISOString()}`,
          ` Birth: ${stat.birthtime.toISOString()}`,
        ];
        const output = lines.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`stat: ${file}: ${e.message}`);
        return null;
      }
    },

    file: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("file: missing file operand");
        return null;
      }

      try {
        const stat = await (bridge as SystemBridge).fs.stat(file);
        let type = "unknown";
        if (stat.isDirectory()) type = "directory";
        else if (stat.isSymbolicLink()) type = "symbolic link";
        else {
          // Try to detect content type
          const content = (await (bridge as SystemBridge).fs.readFile(
            file,
            "utf-8"
          )) as string;
          if (content.startsWith("#!")) type = "script";
          else if (content.trim() === "") type = "empty";
          else type = "ASCII text";
        }

        const output = `${file}: ${type}`;
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`file: ${file}: ${e.message}`);
        return null;
      }
    },

    wc: async (bridge, vars) => {
      const countLines = vars["1"] === "-l";
      const countWords = vars["1"] === "-w";
      const countChars = vars["1"] === "-c";
      const file =
        countLines || countWords || countChars
          ? String(vars["2"] ?? "")
          : String(vars["1"] ?? "");

      if (!file) {
        await bridge.err("wc: missing file operand");
        return null;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const lines = content.split("\n").length;
        const words = content.split(/\s+/).filter((w) => w.length > 0).length;
        const chars = content.length;

        let output: string;
        if (countLines) output = `${lines} ${file}`;
        else if (countWords) output = `${words} ${file}`;
        else if (countChars) output = `${chars} ${file}`;
        else output = `${lines} ${words} ${chars} ${file}`;

        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`wc: ${file}: ${e.message}`);
        return null;
      }
    },

    // grep (basic)
    grep: async (bridge, vars) => {
      const pattern = String(vars["1"] ?? "");
      const file = String(vars["2"] ?? "");

      if (!pattern) {
        await bridge.err("grep: missing pattern");
        return null;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const regex = new RegExp(pattern);
        const matches = content.split("\n").filter((line) => regex.test(line));
        const output = matches.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`grep: ${file}: ${e.message}`);
        return null;
      }
    },

    // Tree view
    tree: async (bridge, vars) => {
      const path =
        vars["1"] !== undefined
          ? String(vars["1"])
          : (bridge as SystemBridge).cwd;
      try {
        const output = (fs as VirtualFileSystem).tree(path);
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`tree: ${e.message}`);
        return null;
      }
    },

    // History
    history: async (bridge) => {
      const sb = bridge as SystemBridge;
      const output = sb.history
        .map((cmd, i) => `${(i + 1).toString().padStart(5)}  ${cmd}`)
        .join("\n");
      await bridge.out(output);
      return null;
    },

    // Clear screen
    clear: async (bridge) => {
      (bridge as SystemBridge).terminal.clear();
      return null;
    },

    // Date/time
    date: async (bridge, vars) => {
      const format = vars["1"] !== undefined ? String(vars["1"]) : "";
      const now = new Date();

      let output: string;
      if (format === "+%s") {
        output = Math.floor(now.getTime() / 1000).toString();
      } else if (format === "+%Y-%m-%d") {
        output = now.toISOString().slice(0, 10);
      } else if (format === "+%H:%M:%S") {
        output = now.toTimeString().slice(0, 8);
      } else {
        output = now.toString();
      }

      await bridge.out(output);
      return null;
    },

    // Hostname
    hostname: async (bridge) => {
      const output =
        (bridge as SystemBridge).process.getEnv("HOSTNAME") ?? "localhost";
      await bridge.out(output);
      return null;
    },

    // uname
    uname: async (bridge, vars) => {
      const all = vars["1"] === "-a";

      const info = {
        sysname: "YASH",
        nodename:
          (bridge as SystemBridge).process.getEnv("HOSTNAME") ?? "localhost",
        release: "1.0.0",
        version: "#1 Virtual",
        machine: "virtual",
      };

      const output = all
        ? `${info.sysname} ${info.nodename} ${info.release} ${info.version} ${info.machine}`
        : info.sysname;

      await bridge.out(output);
      return null;
    },

    // sleep
    sleep: async (bridge, vars) => {
      const seconds = parseFloat(String(vars["1"] ?? "1"));
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return null;
    },

    // seq
    seq: async (bridge, vars) => {
      const arg1 = parseInt(String(vars["1"] ?? "1"));
      const arg2 =
        vars["2"] !== undefined ? parseInt(String(vars["2"])) : undefined;
      const arg3 =
        vars["3"] !== undefined ? parseInt(String(vars["3"])) : undefined;

      let start = 1,
        end = arg1,
        step = 1;

      if (arg2 !== undefined && arg3 !== undefined) {
        start = arg1;
        step = arg2;
        end = arg3;
      } else if (arg2 !== undefined) {
        start = arg1;
        end = arg2;
      }

      const numbers: number[] = [];
      if (step > 0) {
        for (let i = start; i <= end; i += step) numbers.push(i);
      } else {
        for (let i = start; i >= end; i += step) numbers.push(i);
      }

      const output = numbers.join("\n");
      await bridge.out(output);
      return null;
    },

    // basename
    basename: async (bridge, vars) => {
      const path = String(vars["1"] ?? "");
      const suffix = vars["2"] !== undefined ? String(vars["2"]) : "";

      let name = path.split("/").pop() ?? "";
      if (suffix && name.endsWith(suffix)) {
        name = name.slice(0, -suffix.length);
      }

      await bridge.out(name);
      return name;
    },

    // dirname
    dirname: async (bridge, vars) => {
      const path = String(vars["1"] ?? "");
      const parts = path.split("/");
      parts.pop();
      const output = parts.join("/") || "/";
      await bridge.out(output);
      return null;
    },

    // realpath
    realpath: async (bridge, vars) => {
      const path = String(vars["1"] ?? "");
      try {
        const resolved = await (bridge as SystemBridge).fs.realpath(path);
        await bridge.out(resolved);
        return resolved;
      } catch (e: any) {
        await bridge.err(`realpath: ${path}: ${e.message}`);
        return null;
      }
    },

    // which (simplified)
    which: async (bridge, vars) => {
      const cmd = String(vars["1"] ?? "");
      const paths = (
        (bridge as SystemBridge).process.getEnv("PATH") ?? ""
      ).split(":");

      for (const p of paths) {
        const fullPath = `${p}/${cmd}`;
        if (await (bridge as SystemBridge).fs.exists(fullPath)) {
          await bridge.out(fullPath);
          return fullPath;
        }
      }

      await bridge.err(`which: ${cmd}: not found`);
      return null;
    },

    // type (shell builtin check)
    type: async (bridge, vars) => {
      const cmd = String(vars["1"] ?? "");

      // Check builtins
      if (bridge.global_functions[cmd]) {
        const output = `${cmd} is a shell builtin`;
        await bridge.out(output);
        return null;
      }

      // Check path
      const paths = (
        (bridge as SystemBridge).process.getEnv("PATH") ?? ""
      ).split(":");
      for (const p of paths) {
        const fullPath = `${p}/${cmd}`;
        if (await (bridge as SystemBridge).fs.exists(fullPath)) {
          const output = `${cmd} is ${fullPath}`;
          await bridge.out(output);
          return null;
        }
      }

      await bridge.err(`type: ${cmd}: not found`);
      return null;
    },

    // Links
    ln: async (bridge, vars) => {
      // ln [-s] target linkname
      try {
        const sb = bridge as SystemBridge;
        if (vars["1"] === "-s") {
          const target = String(vars["2"] ?? "");
          const linkname = String(vars["3"] ?? "");
          if (!target || !linkname) {
            await bridge.err("ln: missing operand");
            return 1;
          }
          await sb.fs.symlink(target, linkname);
          return 0;
        } else {
          const target = String(vars["1"] ?? "");
          const linkname = String(vars["2"] ?? "");
          if (!target || !linkname) {
            await bridge.err("ln: missing operand");
            return 1;
          }
          // create hard link (approximate)
          await (sb.fs as VirtualFileSystem).link(target, linkname);
          return 0;
        }
      } catch (e: any) {
        await bridge.err(`ln: ${e.message}`);
        return 1;
      }
    },

    chmod: async (bridge, vars) => {
      const modeStr = String(vars["1"] ?? "");
      const path = String(vars["2"] ?? "");
      if (!modeStr || !path) {
        await bridge.err("chmod: missing operand");
        return 1;
      }
      try {
        const mode = PermissionUtils.parseMode(modeStr);
        await (bridge as SystemBridge).fs.chmod(path, mode);
        return 0;
      } catch (e: any) {
        await bridge.err(`chmod: ${e.message}`);
        return 1;
      }
    },

    chown: async (bridge, vars) => {
      const who = String(vars["1"] ?? "");
      const path = String(vars["2"] ?? "");
      if (!who || !path) {
        await bridge.err("chown: missing operand");
        return 1;
      }
      try {
        const sb = bridge as SystemBridge;
        let uid = parseInt(who);
        let gid = undefined as number | undefined;
        if (who.includes(":")) {
          const [u, g] = who.split(":");
          uid = parseInt(u);
          gid = parseInt(g);
        }
        if (isNaN(uid)) {
          const user = sb.users.getUserByName(who);
          if (!user) {
            await bridge.err(`chown: invalid user: ${who}`);
            return 1;
          }
          uid = user.uid;
        }
        await sb.fs.chown(path, uid, gid ?? 0);
        return 0;
      } catch (e: any) {
        await bridge.err(`chown: ${e.message}`);
        return 1;
      }
    },

    chgrp: async (bridge, vars) => {
      const group = String(vars["1"] ?? "");
      const path = String(vars["2"] ?? "");
      if (!group || !path) {
        await bridge.err("chgrp: missing operand");
        return 1;
      }
      try {
        const sb = bridge as SystemBridge;
        let gid = parseInt(group);
        if (isNaN(gid)) {
          const g = sb.users.getGroupByName(group);
          if (!g) {
            await bridge.err(`chgrp: invalid group: ${group}`);
            return 1;
          }
          gid = g.gid;
        }
        await sb.fs.chown(path, (await sb.fs.stat(path)).uid, gid);
        return 0;
      } catch (e: any) {
        await bridge.err(`chgrp: ${e.message}`);
        return 1;
      }
    },

    df: async (bridge, vars) => {
      try {
        const mount = String(vars["1"] ?? "/");
        const info = await (fs as VirtualFileSystem).getDiskUsage(mount);
        const output = `Filesystem\tSize\tUsed\tAvail\n${mount}\t${info.total}\t${info.used}\t${info.free}`;
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`df: ${e.message}`);
        return null;
      }
    },

    du: async (bridge, vars) => {
      try {
        const path = String(vars["1"] ?? ".");
        // Approximate: if file, show size, if dir, show root usage
        try {
          const stat = await (fs as VirtualFileSystem).stat(path);
          if (stat.isFile()) {
            const output = `${stat.size}\t${path}`;
            await bridge.out(output);
            return null;
          }
        } catch {
          // fallthrough
        }
        const info = await (fs as VirtualFileSystem).getDiskUsage("/");
        const output = `${info.used}\t${path}`;
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`du: ${e.message}`);
        return null;
      }
    },

    truncate: async (bridge, vars) => {
      const path = String(vars["1"] ?? "");
      const len = parseInt(String(vars["2"] ?? "0"));
      if (!path) {
        await bridge.err("truncate: missing operand");
        return 1;
      }
      try {
        await (fs as VirtualFileSystem).truncate(path, len);
        return 0;
      } catch (e: any) {
        await bridge.err(`truncate: ${e.message}`);
        return 1;
      }
    },

    mktemp: async (bridge, vars) => {
      const prefix = String(vars["1"] ?? "/tmp/tmp.");
      try {
        const p = await (fs as VirtualFileSystem).mktemp(prefix);
        await bridge.out(p);
        return p;
      } catch (e: any) {
        await bridge.err(`mktemp: ${e.message}`);
        return null;
      }
    },

    // Process helpers
    pidof: async (bridge, vars) => {
      const name = String(vars["1"] ?? "");
      if (!name) return null;
      const pids = (bridge as SystemBridge).process
        .listProcesses()
        .filter((p) => p.command === name)
        .map((p) => p.pid.toString());
      const out = pids.join(" ");
      await bridge.out(out);
      return out;
    },

    killall: async (bridge, vars) => {
      const name = String(vars["1"] ?? "");
      if (!name) {
        await bridge.err("killall: missing operand");
        return 1;
      }
      const procs = (bridge as SystemBridge).process
        .listProcesses()
        .filter((p) => p.command === name);
      for (const p of procs) {
        (bridge as SystemBridge).process.kill(p.pid, 15);
      }
      return 0;
    },

    pgrep: async (bridge, vars) => {
      const pattern = String(vars["1"] ?? "");
      if (!pattern) return null;
      const re = new RegExp(pattern);
      const pids = (bridge as SystemBridge).process
        .listProcesses()
        .filter((p) => re.test(p.command))
        .map((p) => p.pid.toString());
      const out = pids.join("\n");
      await bridge.out(out);
      return out;
    },

    pkill: async (bridge, vars) => {
      const pattern = String(vars["1"] ?? "");
      if (!pattern) {
        await bridge.err("pkill: missing operand");
        return 1;
      }
      const re = new RegExp(pattern);
      const procs = (bridge as SystemBridge).process
        .listProcesses()
        .filter((p) => re.test(p.command));
      for (const p of procs) {
        (bridge as SystemBridge).process.kill(p.pid, 15);
      }
      return 0;
    },

    uptime: async (bridge) => {
      const processes = (bridge as SystemBridge).process.listProcesses();
      const init = processes.find((p) => p.pid === 1);
      const uptimeMs = init ? Date.now() - init.startTime.getTime() : 0;
      const out = (uptimeMs / 1000).toFixed(0);
      await bridge.out(out);
      return out;
    },

    free: async (bridge) => {
      // Simulated: total 512MB
      const total = 512 * 1024 * 1024;
      const used = 128 * 1024 * 1024;
      const freeBytes = total - used;
      const output = `              total        used        free\nMem: ${total} ${used} ${freeBytes}`;
      await bridge.out(output);
      return null;
    },

    base64: async (bridge, vars) => {
      const decode = vars["1"] === "-d" || vars["1"] === "--decode";
      const input = String(vars[decode ? "2" : "1"] ?? "");
      if (!input) {
        await bridge.err("base64: missing operand");
        return 1;
      }
      try {
        let out: string;
        if (decode) {
          if (typeof Buffer !== "undefined")
            out = Buffer.from(input, "base64").toString("utf-8");
          else out = atob(input);
        } else {
          if (typeof Buffer !== "undefined")
            out = Buffer.from(input, "utf-8").toString("base64");
          else out = btoa(input);
        }
        await bridge.out(out);
        return out;
      } catch (e: any) {
        await bridge.err(`base64: ${e.message}`);
        return null;
      }
    },

    // ============= TEXT PROCESSING =============

    // cut - extract columns
    cut: async (bridge, vars) => {
      const delimiter = vars["1"] === "-d" ? String(vars["2"] ?? "\t") : "\t";
      const fieldArg = vars["1"] === "-d" ? vars["3"] : vars["1"];
      const fields =
        fieldArg === "-f"
          ? String(vars["1"] === "-d" ? vars["4"] : vars["2"] ?? "1")
          : "1";
      const file = String(vars["1"] === "-d" ? vars["5"] : vars["3"] ?? "");

      if (!file) {
        await bridge.err("cut: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const fieldNums = fields.split(",").map((f) => parseInt(f) - 1);
        const lines = content.split("\n").map((line) => {
          const parts = line.split(delimiter);
          return fieldNums.map((f) => parts[f] ?? "").join(delimiter);
        });
        const output = lines.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`cut: ${e.message}`);
        return null;
      }
    },

    // sort - sort lines
    sort: async (bridge, vars) => {
      const reverse = vars["1"] === "-r";
      const numeric = vars["1"] === "-n" || vars["2"] === "-n";
      const unique = vars["1"] === "-u" || vars["2"] === "-u";
      let file = String(vars["1"] ?? "");
      if (reverse || numeric || unique)
        file = String(vars["2"] ?? vars["3"] ?? "");

      if (!file) {
        await bridge.err("sort: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        let lines = content.split("\n");

        if (numeric) {
          lines.sort((a, b) => parseFloat(a) - parseFloat(b));
        } else {
          lines.sort();
        }

        if (reverse) lines.reverse();
        if (unique) lines = [...new Set(lines)];

        const output = lines.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`sort: ${e.message}`);
        return null;
      }
    },

    // uniq - remove duplicate lines
    uniq: async (bridge, vars) => {
      const count = vars["1"] === "-c";
      const duplicatesOnly = vars["1"] === "-d";
      const file = String(
        count || duplicatesOnly ? vars["2"] : vars["1"] ?? ""
      );

      if (!file) {
        await bridge.err("uniq: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const lines = content.split("\n");
        const result: string[] = [];
        const counts: Map<string, number> = new Map();

        let prev = "";
        for (const line of lines) {
          if (line !== prev) {
            if (count) {
              counts.set(line, 1);
            } else {
              result.push(line);
            }
            prev = line;
          } else if (count) {
            counts.set(line, (counts.get(line) ?? 0) + 1);
          }
        }

        let output: string;
        if (count) {
          output = Array.from(counts.entries())
            .map(([line, c]) => `${c.toString().padStart(7)} ${line}`)
            .join("\n");
        } else if (duplicatesOnly) {
          output = lines
            .filter(
              (line, i, arr) => arr.indexOf(line) !== arr.lastIndexOf(line)
            )
            .join("\n");
        } else {
          output = result.join("\n");
        }

        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`uniq: ${e.message}`);
        return null;
      }
    },

    // tr - translate characters
    tr: async (bridge, vars) => {
      const set1 = String(vars["1"] ?? "");
      const set2 = String(vars["2"] ?? "");
      const input = String(vars["3"] ?? "");

      if (!set1) {
        await bridge.err("tr: missing operand");
        return 1;
      }

      let output = input;
      for (let i = 0; i < set1.length; i++) {
        const from = set1[i];
        const to = set2[i] ?? set2[set2.length - 1] ?? "";
        output = output.split(from).join(to);
      }

      await bridge.out(output);
      return null;
    },

    // rev - reverse lines
    rev: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");

      if (!file) {
        await bridge.err("rev: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const output = content
          .split("\n")
          .map((line) => line.split("").reverse().join(""))
          .join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`rev: ${e.message}`);
        return null;
      }
    },

    // tac - reverse file (cat backwards)
    tac: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");

      if (!file) {
        await bridge.err("tac: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const output = content.split("\n").reverse().join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`tac: ${e.message}`);
        return null;
      }
    },

    // nl - number lines
    nl: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");

      if (!file) {
        await bridge.err("nl: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const output = content
          .split("\n")
          .map((line, i) => `${(i + 1).toString().padStart(6)}\t${line}`)
          .join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`nl: ${e.message}`);
        return null;
      }
    },

    // fold - wrap lines at specified width
    fold: async (bridge, vars) => {
      const width =
        vars["1"] === "-w" ? parseInt(String(vars["2"] ?? "80")) : 80;
      const file = String(vars["1"] === "-w" ? vars["3"] : vars["1"] ?? "");

      if (!file) {
        await bridge.err("fold: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const output = content
          .split("\n")
          .map((line) => {
            const wrapped: string[] = [];
            for (let i = 0; i < line.length; i += width) {
              wrapped.push(line.slice(i, i + width));
            }
            return wrapped.join("\n");
          })
          .join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`fold: ${e.message}`);
        return null;
      }
    },

    // paste - merge lines of files
    paste: async (bridge, vars) => {
      const delimiter = vars["1"] === "-d" ? String(vars["2"] ?? "\t") : "\t";
      const files: string[] = [];
      let i = vars["1"] === "-d" ? 3 : 1;
      while (vars[String(i)] !== undefined) {
        files.push(String(vars[String(i)]));
        i++;
      }

      if (files.length === 0) {
        await bridge.err("paste: missing file operand");
        return 1;
      }

      try {
        const contents = await Promise.all(
          files.map(
            (f) =>
              (bridge as SystemBridge).fs.readFile(
                f,
                "utf-8"
              ) as Promise<string>
          )
        );
        const lineArrays = contents.map((c) => c.split("\n"));
        const maxLines = Math.max(...lineArrays.map((l) => l.length));

        const result: string[] = [];
        for (let i = 0; i < maxLines; i++) {
          result.push(
            lineArrays.map((lines) => lines[i] ?? "").join(delimiter)
          );
        }

        const output = result.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`paste: ${e.message}`);
        return null;
      }
    },

    // join - join lines of two files on a common field
    join: async (bridge, vars) => {
      const file1 = String(vars["1"] ?? "");
      const file2 = String(vars["2"] ?? "");

      if (!file1 || !file2) {
        await bridge.err("join: missing file operand");
        return 1;
      }

      try {
        const content1 = (await (bridge as SystemBridge).fs.readFile(
          file1,
          "utf-8"
        )) as string;
        const content2 = (await (bridge as SystemBridge).fs.readFile(
          file2,
          "utf-8"
        )) as string;

        const map2 = new Map<string, string>();
        for (const line of content2.split("\n")) {
          const [key, ...rest] = line.split(/\s+/);
          if (key) map2.set(key, rest.join(" "));
        }

        const result: string[] = [];
        for (const line of content1.split("\n")) {
          const [key, ...rest] = line.split(/\s+/);
          if (key && map2.has(key)) {
            result.push(`${key} ${rest.join(" ")} ${map2.get(key)}`);
          }
        }

        const output = result.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`join: ${e.message}`);
        return null;
      }
    },

    // comm - compare two sorted files line by line
    comm: async (bridge, vars) => {
      const file1 = String(vars["1"] ?? "");
      const file2 = String(vars["2"] ?? "");

      if (!file1 || !file2) {
        await bridge.err("comm: missing file operand");
        return 1;
      }

      try {
        const content1 = (await (bridge as SystemBridge).fs.readFile(
          file1,
          "utf-8"
        )) as string;
        const content2 = (await (bridge as SystemBridge).fs.readFile(
          file2,
          "utf-8"
        )) as string;

        const set1 = new Set(content1.split("\n"));
        const set2 = new Set(content2.split("\n"));

        const result: string[] = [];
        const all = new Set([...set1, ...set2]);

        for (const line of Array.from(all).sort()) {
          const in1 = set1.has(line);
          const in2 = set2.has(line);
          if (in1 && in2) result.push(`\t\t${line}`);
          else if (in1) result.push(line);
          else result.push(`\t${line}`);
        }

        const output = result.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`comm: ${e.message}`);
        return null;
      }
    },

    // diff - compare files line by line
    diff: async (bridge, vars) => {
      const file1 = String(vars["1"] ?? "");
      const file2 = String(vars["2"] ?? "");

      if (!file1 || !file2) {
        await bridge.err("diff: missing file operand");
        return 1;
      }

      try {
        const content1 = (await (bridge as SystemBridge).fs.readFile(
          file1,
          "utf-8"
        )) as string;
        const content2 = (await (bridge as SystemBridge).fs.readFile(
          file2,
          "utf-8"
        )) as string;

        const lines1 = content1.split("\n");
        const lines2 = content2.split("\n");

        const result: string[] = [];
        const maxLen = Math.max(lines1.length, lines2.length);

        for (let i = 0; i < maxLen; i++) {
          const l1 = lines1[i];
          const l2 = lines2[i];
          if (l1 !== l2) {
            if (l1 !== undefined) result.push(`< ${l1}`);
            if (l2 !== undefined) result.push(`> ${l2}`);
          }
        }

        const output = result.join("\n");
        if (output) await bridge.out(output);
        return result.length > 0 ? 1 : 0;
      } catch (e: any) {
        await bridge.err(`diff: ${e.message}`);
        return 2;
      }
    },

    // expand - convert tabs to spaces
    expand: async (bridge, vars) => {
      const tabSize =
        vars["1"] === "-t" ? parseInt(String(vars["2"] ?? "8")) : 8;
      const file = String(vars["1"] === "-t" ? vars["3"] : vars["1"] ?? "");

      if (!file) {
        await bridge.err("expand: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const output = content.split("\t").join(" ".repeat(tabSize));
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`expand: ${e.message}`);
        return null;
      }
    },

    // unexpand - convert spaces to tabs
    unexpand: async (bridge, vars) => {
      const tabSize =
        vars["1"] === "-t" ? parseInt(String(vars["2"] ?? "8")) : 8;
      const file = String(vars["1"] === "-t" ? vars["3"] : vars["1"] ?? "");

      if (!file) {
        await bridge.err("unexpand: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const spaces = " ".repeat(tabSize);
        const output = content.split(spaces).join("\t");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`unexpand: ${e.message}`);
        return null;
      }
    },

    // fmt - simple text formatter
    fmt: async (bridge, vars) => {
      const width =
        vars["1"] === "-w" ? parseInt(String(vars["2"] ?? "75")) : 75;
      const file = String(vars["1"] === "-w" ? vars["3"] : vars["1"] ?? "");

      if (!file) {
        await bridge.err("fmt: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const words = content.split(/\s+/);
        const lines: string[] = [];
        let currentLine = "";

        for (const word of words) {
          if (currentLine.length + word.length + 1 <= width) {
            currentLine += (currentLine ? " " : "") + word;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);

        const output = lines.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`fmt: ${e.message}`);
        return null;
      }
    },

    // column - format output into columns
    column: async (bridge, vars) => {
      const delimiter = vars["1"] === "-s" ? String(vars["2"] ?? " ") : " ";
      const table = vars["1"] === "-t" || vars["3"] === "-t";
      const file = String(
        vars["1"] === "-s"
          ? vars["3"]
          : vars["1"] === "-t"
          ? vars["2"]
          : vars["1"] ?? ""
      );

      if (!file) {
        await bridge.err("column: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const lines = content.split("\n").map((line) => line.split(delimiter));

        if (table) {
          const colWidths: number[] = [];
          for (const cols of lines) {
            cols.forEach((col, i) => {
              colWidths[i] = Math.max(colWidths[i] ?? 0, col.length);
            });
          }

          const output = lines
            .map((cols) =>
              cols.map((col, i) => col.padEnd(colWidths[i] ?? 0)).join("  ")
            )
            .join("\n");
          await bridge.out(output);
          return null;
        }

        const output = content;
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`column: ${e.message}`);
        return null;
      }
    },

    // strings - extract printable strings
    strings: async (bridge, vars) => {
      const minLen =
        vars["1"] === "-n" ? parseInt(String(vars["2"] ?? "4")) : 4;
      const file = String(vars["1"] === "-n" ? vars["3"] : vars["1"] ?? "");

      if (!file) {
        await bridge.err("strings: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const regex = new RegExp(`[\\x20-\\x7E]{${minLen},}`, "g");
        const matches = content.match(regex) ?? [];
        const output = matches.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`strings: ${e.message}`);
        return null;
      }
    },

    // od - octal dump
    od: async (bridge, vars) => {
      const hex =
        vars["1"] === "-x" || (vars["1"] === "-A" && vars["2"] === "x");
      const file = String(hex ? vars["2"] ?? vars["3"] : vars["1"] ?? "");

      if (!file) {
        await bridge.err("od: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "binary"
        )) as Uint8Array;
        const lines: string[] = [];

        for (let i = 0; i < content.length; i += 16) {
          const offset = i.toString(8).padStart(7, "0");
          const bytes = Array.from(content.slice(i, i + 16));
          const values = hex
            ? bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ")
            : bytes.map((b) => b.toString(8).padStart(3, "0")).join(" ");
          lines.push(`${offset} ${values}`);
        }

        const output = lines.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`od: ${e.message}`);
        return null;
      }
    },

    // hexdump - hex dump
    hexdump: async (bridge, vars) => {
      const canonical = vars["1"] === "-C";
      const file = String(canonical ? vars["2"] : vars["1"] ?? "");

      if (!file) {
        await bridge.err("hexdump: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "binary"
        )) as Uint8Array;
        const lines: string[] = [];

        for (let i = 0; i < content.length; i += 16) {
          const offset = i.toString(16).padStart(8, "0");
          const bytes = Array.from(content.slice(i, i + 16));
          const hexPart = bytes
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ");

          if (canonical) {
            const ascii = bytes
              .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
              .join("");
            lines.push(`${offset}  ${hexPart.padEnd(48)}  |${ascii}|`);
          } else {
            lines.push(`${offset}  ${hexPart}`);
          }
        }

        const output = lines.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`hexdump: ${e.message}`);
        return null;
      }
    },

    // xxd - hex dump with reverse
    xxd: async (bridge, vars) => {
      const reverse = vars["1"] === "-r";
      const input = String(reverse ? vars["2"] : vars["1"] ?? "");

      if (!input) {
        await bridge.err("xxd: missing operand");
        return 1;
      }

      try {
        if (reverse) {
          // Convert hex back to text (simplified)
          const hex = input.replace(/[^0-9a-fA-F]/g, "");
          let output = "";
          for (let i = 0; i < hex.length; i += 2) {
            output += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
          }
          await bridge.out(output);
          return null;
        } else {
          const content = (await (bridge as SystemBridge).fs.readFile(
            input,
            "binary"
          )) as Uint8Array;
          const lines: string[] = [];

          for (let i = 0; i < content.length; i += 16) {
            const offset = i.toString(16).padStart(8, "0");
            const bytes = Array.from(content.slice(i, i + 16));
            const hexPart = bytes
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(" ");
            const ascii = bytes
              .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
              .join("");
            lines.push(`${offset}: ${hexPart.padEnd(48)}  ${ascii}`);
          }

          const output = lines.join("\n");
          await bridge.out(output);
          return null;
        }
      } catch (e: any) {
        await bridge.err(`xxd: ${e.message}`);
        return null;
      }
    },

    // tee - read from stdin and write to files
    tee: async (bridge, vars) => {
      const append = vars["1"] === "-a";
      const files: string[] = [];
      let i = append ? 2 : 1;
      while (vars[String(i)] !== undefined) {
        files.push(String(vars[String(i)]));
        i++;
      }

      // In YASH, tee works with piped input via $_
      const input = String(bridge.global_variables["_"] ?? "");

      try {
        for (const file of files) {
          if (append) {
            await (bridge as SystemBridge).fs.appendFile(file, input);
          } else {
            await (bridge as SystemBridge).fs.writeFile(file, input);
          }
        }
        await bridge.out(input);
        return input;
      } catch (e: any) {
        await bridge.err(`tee: ${e.message}`);
        return null;
      }
    },

    // ============= SEARCH =============

    // find - search for files
    find: async (bridge, vars) => {
      const startPath = String(vars["1"] ?? ".");
      const nameArg = vars["2"] === "-name" ? String(vars["3"] ?? "*") : "*";
      const typeArg =
        vars["2"] === "-type" || vars["4"] === "-type"
          ? String(vars["3"] === "-type" ? vars["4"] : vars["5"] ?? "")
          : "";

      const sb = bridge as SystemBridge;
      const results: string[] = [];

      async function searchDir(path: string): Promise<void> {
        try {
          const entries = await sb.fs.readDir(path);
          for (const entry of entries) {
            const fullPath = path === "/" ? `/${entry}` : `${path}/${entry}`;

            // Check name pattern
            const pattern = nameArg.replace(/\*/g, ".*").replace(/\?/g, ".");
            const regex = new RegExp(`^${pattern}$`);

            try {
              const stat = await sb.fs.stat(fullPath);
              const typeMatch =
                !typeArg ||
                (typeArg === "f" && stat.isFile()) ||
                (typeArg === "d" && stat.isDirectory()) ||
                (typeArg === "l" && stat.isSymbolicLink());

              if (regex.test(entry) && typeMatch) {
                results.push(fullPath);
              }

              if (stat.isDirectory()) {
                await searchDir(fullPath);
              }
            } catch {
              // Skip inaccessible entries
            }
          }
        } catch {
          // Skip inaccessible directories
        }
      }

      await searchDir(startPath);
      const output = results.join("\n");
      if (output) await bridge.out(output);
      return null;
    },

    // locate - find files by name (simplified - searches whole fs)
    locate: async (bridge, vars) => {
      const pattern = String(vars["1"] ?? "");
      if (!pattern) {
        await bridge.err("locate: missing pattern");
        return 1;
      }

      const sb = bridge as SystemBridge;
      const results: string[] = [];
      const regex = new RegExp(pattern);

      async function searchDir(path: string): Promise<void> {
        try {
          const entries = await sb.fs.readDir(path);
          for (const entry of entries) {
            const fullPath = path === "/" ? `/${entry}` : `${path}/${entry}`;
            if (regex.test(entry) || regex.test(fullPath)) {
              results.push(fullPath);
            }
            try {
              const stat = await sb.fs.stat(fullPath);
              if (stat.isDirectory()) {
                await searchDir(fullPath);
              }
            } catch {}
          }
        } catch {}
      }

      await searchDir("/");
      const output = results.join("\n");
      if (output) await bridge.out(output);
      return null;
    },

    // whereis - locate binary, source, manual
    whereis: async (bridge, vars) => {
      const cmd = String(vars["1"] ?? "");
      if (!cmd) {
        await bridge.err("whereis: missing command");
        return 1;
      }

      const paths = [
        "/bin",
        "/usr/bin",
        "/usr/local/bin",
        "/sbin",
        "/usr/sbin",
      ];
      const found: string[] = [];

      for (const p of paths) {
        const fullPath = `${p}/${cmd}`;
        if (await (bridge as SystemBridge).fs.exists(fullPath)) {
          found.push(fullPath);
        }
      }

      const output = `${cmd}: ${found.join(" ")}`;
      await bridge.out(output);
      return null;
    },

    // xargs - build commands from stdin
    xargs: async (bridge, vars) => {
      const cmd = String(vars["1"] ?? "echo");
      const input = String(bridge.global_variables["_"] ?? "");
      const args = input.trim().split(/\s+/);

      // Execute command with args
      const fullCmd = `${cmd} ${args.join(" ")}`;
      await bridge.out(fullCmd);
      return fullCmd;
    },

    // ============= USERS & GROUPS =============

    // groups - show user groups
    groups: async (bridge, vars) => {
      const username = vars["1"] !== undefined ? String(vars["1"]) : undefined;
      const sb = bridge as SystemBridge;
      const user = username
        ? sb.users.getUserByName(username)
        : sb.users.getCurrentUser();

      if (!user) {
        await bridge.err(`groups: '${username}': no such user`);
        return 1;
      }

      const groupNames = user.groups.map(
        (gid) => sb.users.getGroup(gid)?.name ?? String(gid)
      );
      const output = `${user.username} : ${groupNames.join(" ")}`;
      await bridge.out(output);
      return null;
    },

    // users - show logged in users
    users: async (bridge) => {
      const sb = bridge as SystemBridge;
      const output = sb.users
        .listUsers()
        .map((u) => u.username)
        .join(" ");
      await bridge.out(output);
      return null;
    },

    // who - show who is logged in
    who: async (bridge) => {
      const sb = bridge as SystemBridge;
      const user = sb.users.getCurrentUser();
      const output = `${user.username}\tpts/0\t${new Date().toLocaleString()}`;
      await bridge.out(output);
      return null;
    },

    // w - show who is logged in and what they are doing
    w: async (bridge) => {
      const sb = bridge as SystemBridge;
      const user = sb.users.getCurrentUser();
      const procs = sb.process.listProcesses();
      const currentProc = procs.find(
        (p) => p.pid === sb.process.getCurrentPid()
      );

      const header =
        " USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT";
      const line = `${user.username.padEnd(
        9
      )}pts/0    -               ${new Date()
        .toTimeString()
        .slice(0, 5)}    0.00s  0.00s  0.00s ${currentProc?.command ?? "yash"}`;

      const output = `${header}\n${line}`;
      await bridge.out(output);
      return null;
    },

    // last - show last logins
    last: async (bridge) => {
      const sb = bridge as SystemBridge;
      const user = sb.users.getCurrentUser();
      const output = `${
        user.username
      }  pts/0        -                ${new Date().toDateString()} - still logged in`;
      await bridge.out(output);
      return null;
    },

    // passwd - change password (simulated)
    passwd: async (bridge, vars) => {
      const username = vars["1"] !== undefined ? String(vars["1"]) : undefined;
      const sb = bridge as SystemBridge;
      const currentUser = sb.users.getCurrentUser();

      if (username && currentUser.uid !== 0) {
        await bridge.err("passwd: Only root can change other users' passwords");
        return 1;
      }

      await bridge.out("Password changed successfully (simulated)");
      return 0;
    },

    // su - switch user (simulated)
    su: async (bridge, vars) => {
      const username = String(vars["1"] ?? "root");
      const sb = bridge as SystemBridge;

      const user = sb.users.getUserByName(username);
      if (!user) {
        await bridge.err(`su: user ${username} does not exist`);
        return 1;
      }

      const success = (sb.users as VirtualUserManager).setCurrentUid(user.uid);
      if (!success) {
        await bridge.err("su: Authentication failure");
        return 1;
      }

      bridge.global_variables["USER"] = user.username;
      bridge.global_variables["HOME"] = user.home;
      return 0;
    },

    // sudo - execute as superuser (simulated)
    sudo: async (bridge, vars) => {
      const sb = bridge as SystemBridge;
      const currentUser = sb.users.getCurrentUser();

      // Check if user is in sudo group
      const sudoGroup = sb.users.getGroupByName("sudo");
      if (!sudoGroup || !currentUser.groups.includes(sudoGroup.gid)) {
        await bridge.err(
          `${currentUser.username} is not in the sudoers file. This incident will be reported.`
        );
        return 1;
      }

      // Temporarily switch to root
      const oldUid = currentUser.uid;
      (sb.users as VirtualUserManager).setCurrentUid(0);

      // Get the command to run
      const cmd = String(vars["1"] ?? "");
      if (!cmd) {
        await bridge.err("sudo: missing command");
        (sb.users as VirtualUserManager).setCurrentUid(oldUid);
        return 1;
      }

      // The actual command execution would happen via the shell
      await bridge.out(`[sudo] running as root: ${cmd}`);

      // Switch back
      (sb.users as VirtualUserManager).setCurrentUid(oldUid);
      return 0;
    },

    // ============= SYSTEM INFO =============

    // lscpu - display CPU info
    lscpu: async (bridge) => {
      const output = `Architecture:          virtual
CPU op-mode(s):        32-bit, 64-bit
CPU(s):                4
Model name:            YASH Virtual CPU
CPU MHz:               2400.000
Cache size:            8192 KB`;
      await bridge.out(output);
      return null;
    },

    // lsblk - list block devices
    lsblk: async (bridge) => {
      const info = await (fs as VirtualFileSystem).getDiskUsage("/");
      const sizeMB = Math.round(info.total / 1024 / 1024);
      const output = `NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT
vda      8:0    0   ${sizeMB}M  0 disk /`;
      await bridge.out(output);
      return null;
    },

    // lsmem - list memory
    lsmem: async (bridge) => {
      const output = `RANGE                                  SIZE  STATE REMOVABLE BLOCK
0x0000000000000000-0x000000001fffffff  512M online       yes  0-7

Memory block size:        64M
Total online memory:     512M
Total offline memory:      0B`;
      await bridge.out(output);
      return null;
    },

    // cal - display calendar
    cal: async (bridge, vars) => {
      const month =
        vars["1"] !== undefined
          ? parseInt(String(vars["1"]))
          : new Date().getMonth() + 1;
      const year =
        vars["2"] !== undefined
          ? parseInt(String(vars["2"]))
          : new Date().getFullYear();

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const firstDay = new Date(year, month - 1, 1).getDay();
      const daysInMonth = new Date(year, month, 0).getDate();

      let output = `     ${monthNames[month - 1]} ${year}\n`;
      output += "Su Mo Tu We Th Fr Sa\n";

      let line = "   ".repeat(firstDay);
      for (let day = 1; day <= daysInMonth; day++) {
        line += day.toString().padStart(2) + " ";
        if ((firstDay + day) % 7 === 0) {
          output += line.trimEnd() + "\n";
          line = "";
        }
      }
      if (line) output += line.trimEnd();

      await bridge.out(output);
      return null;
    },

    // dmesg - kernel ring buffer (simulated)
    dmesg: async (bridge) => {
      const output = `[    0.000000] YASH Virtual Kernel
[    0.000001] Command line: init=/bin/yash
[    0.000010] Memory: 512MB available
[    0.000100] CPU: YASH Virtual CPU
[    0.001000] VFS: Mounted root filesystem
[    0.010000] init: Starting YASH shell`;
      await bridge.out(output);
      return null;
    },

    // ============= MISC UTILITIES =============

    // yes - output string repeatedly
    yes: async (bridge, vars) => {
      const text = String(vars["1"] ?? "y");
      // Output 10 times to avoid infinite loop
      const output = Array(10).fill(text).join("\n");
      await bridge.out(output);
      return null;
    },

    // factor - factorize numbers
    factor: async (bridge, vars) => {
      const num = parseInt(String(vars["1"] ?? ""));
      if (isNaN(num) || num < 2) {
        await bridge.err("factor: invalid number");
        return 1;
      }

      const factors: number[] = [];
      let n = num;
      for (let d = 2; d * d <= n; d++) {
        while (n % d === 0) {
          factors.push(d);
          n /= d;
        }
      }
      if (n > 1) factors.push(n);

      const output = `${num}: ${factors.join(" ")}`;
      await bridge.out(output);
      return null;
    },

    // expr - evaluate expression
    expr: async (bridge, vars) => {
      const args: string[] = [];
      let i = 1;
      while (vars[String(i)] !== undefined) {
        args.push(String(vars[String(i)]));
        i++;
      }

      const expression = args.join(" ");
      try {
        // Simple arithmetic evaluation
        const result = eval(expression.replace(/x/g, "*"));
        await bridge.out(String(result));
        return result;
      } catch {
        await bridge.err(`expr: syntax error`);
        return 2;
      }
    },

    // bc - calculator (simplified)
    bc: async (bridge, vars) => {
      const expression = String(vars["1"] ?? "");
      if (!expression) {
        await bridge.err("bc: missing expression");
        return 1;
      }

      try {
        const result = eval(expression);
        await bridge.out(String(result));
        return result;
      } catch {
        await bridge.err("bc: syntax error");
        return 1;
      }
    },

    // tty - print terminal name
    tty: async (bridge) => {
      await bridge.out("/dev/pts/0");
      return "/dev/pts/0";
    },

    // stty - terminal settings (simplified)
    stty: async (bridge, vars) => {
      if (vars["1"] === "size") {
        const size = (bridge as SystemBridge).terminal.getSize();
        const output = `${size.rows} ${size.cols}`;
        await bridge.out(output);
        return null;
      }

      const output = "speed 38400 baud; rows 24; columns 80";
      await bridge.out(output);
      return null;
    },

    // reset - reset terminal
    reset: async (bridge) => {
      (bridge as SystemBridge).terminal.clear();
      await bridge.out("Terminal reset");
      return 0;
    },

    // ============= CHECKSUMS =============

    // md5sum - calculate MD5 (simplified - just returns a hash-like string)
    md5sum: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("md5sum: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        // Simple hash simulation
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
          hash = (hash << 5) - hash + content.charCodeAt(i);
          hash = hash & hash;
        }
        const output = `${Math.abs(hash)
          .toString(16)
          .padStart(32, "0")}  ${file}`;
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`md5sum: ${e.message}`);
        return 1;
      }
    },

    // sha256sum - calculate SHA256 (simplified)
    sha256sum: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("sha256sum: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        // Simple hash simulation
        let hash = 0n;
        for (let i = 0; i < content.length; i++) {
          hash = (hash << 5n) - hash + BigInt(content.charCodeAt(i));
        }
        const output = `${hash
          .toString(16)
          .slice(0, 64)
          .padStart(64, "0")}  ${file}`;
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`sha256sum: ${e.message}`);
        return 1;
      }
    },

    // cksum - CRC checksum
    cksum: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("cksum: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        let crc = 0;
        for (let i = 0; i < content.length; i++) {
          crc = crc ^ content.charCodeAt(i);
          for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
          }
        }
        const output = `${crc >>> 0} ${content.length} ${file}`;
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`cksum: ${e.message}`);
        return 1;
      }
    },

    // sum - BSD/SysV checksum
    sum: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("sum: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        let sum = 0;
        for (let i = 0; i < content.length; i++) {
          sum = (sum + content.charCodeAt(i)) & 0xffff;
        }
        const blocks = Math.ceil(content.length / 512);
        const output = `${sum} ${blocks} ${file}`;
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`sum: ${e.message}`);
        return 1;
      }
    },

    // ============= PROCESS CONTROL =============

    // nice - run with modified scheduling priority
    nice: async (bridge, vars) => {
      const adjustment =
        vars["1"] === "-n" ? parseInt(String(vars["2"] ?? "10")) : 10;
      const cmd = String(vars["1"] === "-n" ? vars["3"] : vars["1"] ?? "");

      if (!cmd) {
        await bridge.err("nice: missing command");
        return 1;
      }

      await bridge.out(`[nice ${adjustment}] ${cmd}`);
      return 0;
    },

    // renice - alter priority of running process
    renice: async (bridge, vars) => {
      const priority = parseInt(String(vars["1"] ?? "0"));
      const pid = parseInt(String(vars["2"] ?? ""));

      if (isNaN(pid)) {
        await bridge.err("renice: missing PID");
        return 1;
      }

      const proc = (bridge as SystemBridge).process.getProcess(pid);
      if (!proc) {
        await bridge.err(`renice: ${pid}: No such process`);
        return 1;
      }

      await bridge.out(`${pid}: old priority 0, new priority ${priority}`);
      return 0;
    },

    // nohup - run command immune to hangups
    nohup: async (bridge, vars) => {
      const cmd = String(vars["1"] ?? "");
      if (!cmd) {
        await bridge.err("nohup: missing command");
        return 1;
      }

      await bridge.out(
        `nohup: ignoring input and appending output to 'nohup.out'`
      );
      return 0;
    },

    // timeout - run command with time limit
    timeout: async (bridge, vars) => {
      const duration = parseFloat(String(vars["1"] ?? "0"));
      const cmd = String(vars["2"] ?? "");

      if (!cmd) {
        await bridge.err("timeout: missing command");
        return 1;
      }

      await bridge.out(`[timeout ${duration}s] ${cmd}`);
      return 0;
    },

    // watch - execute program periodically (just runs once)
    watch: async (bridge, vars) => {
      const interval =
        vars["1"] === "-n" ? parseFloat(String(vars["2"] ?? "2")) : 2;
      const cmd = String(vars["1"] === "-n" ? vars["3"] : vars["1"] ?? "");

      if (!cmd) {
        await bridge.err("watch: missing command");
        return 1;
      }

      await bridge.out(`Every ${interval}s: ${cmd}`);
      return 0;
    },

    // time - time a command (simplified)
    time: async (bridge, vars) => {
      const cmd = String(vars["1"] ?? "");
      if (!cmd) {
        await bridge.err("time: missing command");
        return 1;
      }

      const start = Date.now();
      // Command would execute here
      const elapsed = (Date.now() - start) / 1000;

      await bridge.out(
        `real    0m${elapsed.toFixed(3)}s\nuser    0m0.000s\nsys     0m0.000s`
      );
      return 0;
    },

    // ============= NETWORK (Simulated) =============

    // ping - simulated ping
    ping: async (bridge, vars) => {
      const host = String(vars["1"] ?? "");
      const count = vars["2"] === "-c" ? parseInt(String(vars["3"] ?? "4")) : 4;

      if (!host) {
        await bridge.err("ping: missing host operand");
        return 1;
      }

      const lines: string[] = [
        `PING ${host} (127.0.0.1) 56(84) bytes of data.`,
      ];
      for (let i = 0; i < Math.min(count, 4); i++) {
        const time = (Math.random() * 10 + 1).toFixed(3);
        lines.push(
          `64 bytes from ${host} (127.0.0.1): icmp_seq=${
            i + 1
          } ttl=64 time=${time} ms`
        );
      }
      lines.push(`\n--- ${host} ping statistics ---`);
      lines.push(
        `${count} packets transmitted, ${count} received, 0% packet loss`
      );

      const output = lines.join("\n");
      await bridge.out(output);
      return 0;
    },

    // curl - simulated HTTP request
    curl: async (bridge, vars) => {
      const url = vars ? String(vars["1"]) : "";
      console.log(url);
      if (!url) {
        await bridge.err("curl: missing URL");
        return 1;
      }
      const defaultHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      const output = await fetch(url, { headers: defaultHeaders })
        .then((res) => res.text())
        .catch(() => `curl: (6) Could not resolve host: ${url}`);
      await bridge.out(output);
      return 0;
    },

    // wget - simulated download
    wget: async (bridge, vars) => {
      const url = String(vars["1"] ?? "");
      if (!url) {
        await bridge.err("wget: missing URL");
        return 1;
      }
      const defaultHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      const data = await fetch(url, { headers: defaultHeaders })
        .then((res) => res.text())
        .catch(async () => {
          await bridge.err(`wget: unable to resolve host address '${url}'`);
          return 1;
        });

      if (data === 1) return 1;

      // Create a file with a realistic name
      const urlParts = url.split("/");
      const filename = urlParts[urlParts.length - 1] || "index.html";
      await (bridge as SystemBridge).fs.writeFile(filename, data as string);
      return 0;
    },

    // host - DNS lookup (simulated)
    host: async (bridge, vars) => {
      const domain = String(vars["1"] ?? "");
      if (!domain) {
        await bridge.err("host: missing domain");
        return 1;
      }

      const output = `${domain} has address 127.0.0.1\n${domain} has IPv6 address ::1`;
      await bridge.out(output);
      return 0;
    },

    // dig - DNS lookup detailed (simulated)
    dig: async (bridge, vars) => {
      const domain = String(vars["1"] ?? "");
      if (!domain) {
        await bridge.err("dig: missing domain");
        return 1;
      }

      const output = `; <<>> DiG 9.16.1-YASH <<>> ${domain}
;; QUESTION SECTION:
;${domain}.            IN    A

;; ANSWER SECTION:
${domain}.        300    IN    A    127.0.0.1

;; Query time: 0 msec
;; SERVER: 127.0.0.1#53(127.0.0.1)`;
      await bridge.out(output);
      return 0;
    },

    // netstat - network statistics (simulated)
    netstat: async (bridge) => {
      const output = `Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN
tcp        0      0 127.0.0.1:8080          0.0.0.0:*               LISTEN`;
      await bridge.out(output);
      return null;
    },

    // ifconfig - network interface config (simulated)
    ifconfig: async (bridge) => {
      const output = `lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>

eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.168.1.100  netmask 255.255.255.0  broadcast 192.168.1.255`;
      await bridge.out(output);
      return null;
    },

    // ============= READLINK =============
    readlink: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("readlink: missing file operand");
        return 1;
      }

      try {
        const target = await (bridge as SystemBridge).fs.readlink(file);
        await bridge.out(target);
        return target;
      } catch (e: any) {
        await bridge.err(`readlink: ${e.message}`);
        return 1;
      }
    },

    // shred - securely delete file
    shred: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("shred: missing file operand");
        return 1;
      }

      try {
        // Overwrite with random data, then delete
        const stat = await (bridge as SystemBridge).fs.stat(file);
        const randomData = new Uint8Array(stat.size);
        for (let i = 0; i < stat.size; i++) {
          randomData[i] = Math.floor(Math.random() * 256);
        }
        await (bridge as SystemBridge).fs.writeFile(file, randomData);
        await (bridge as SystemBridge).fs.deleteFile(file);
        return 0;
      } catch (e: any) {
        await bridge.err(`shred: ${e.message}`);
        return 1;
      }
    },

    // split - split file into pieces
    split: async (bridge, vars) => {
      const lines =
        vars["1"] === "-l" ? parseInt(String(vars["2"] ?? "1000")) : 1000;
      const file = String(vars["1"] === "-l" ? vars["3"] : vars["1"] ?? "");
      const prefix = String(vars["1"] === "-l" ? vars["4"] : vars["2"] ?? "x");

      if (!file) {
        await bridge.err("split: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const allLines = content.split("\n");
        let partNum = 0;

        for (let i = 0; i < allLines.length; i += lines) {
          const chunk = allLines.slice(i, i + lines).join("\n");
          const suffix =
            String.fromCharCode(97 + Math.floor(partNum / 26)) +
            String.fromCharCode(97 + (partNum % 26));
          await (bridge as SystemBridge).fs.writeFile(
            `${prefix}${suffix}`,
            chunk
          );
          partNum++;
        }

        return 0;
      } catch (e: any) {
        await bridge.err(`split: ${e.message}`);
        return 1;
      }
    },

    // unlink - remove file
    unlink: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("unlink: missing file operand");
        return 1;
      }

      try {
        await (bridge as SystemBridge).fs.deleteFile(file);
        return 0;
      } catch (e: any) {
        await bridge.err(`unlink: ${e.message}`);
        return 1;
      }
    },

    // shuf - shuffle lines
    shuf: async (bridge, vars) => {
      const file = String(vars["1"] ?? "");
      if (!file) {
        await bridge.err("shuf: missing file operand");
        return 1;
      }

      try {
        const content = (await (bridge as SystemBridge).fs.readFile(
          file,
          "utf-8"
        )) as string;
        const lines = content.split("\n");

        // Fisher-Yates shuffle
        for (let i = lines.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [lines[i], lines[j]] = [lines[j], lines[i]];
        }

        const output = lines.join("\n");
        await bridge.out(output);
        return null;
      } catch (e: any) {
        await bridge.err(`shuf: ${e.message}`);
        return null;
      }
    },

    // sed - stream editor for filtering and transforming text
    sed: async (bridge, vars) => {
      // Usage: sed [-n] [-i] 'script' [file...]
      // Supported commands: s/pattern/replacement/flags, d, p, q
      let inPlace = false;
      let silent = false;
      let script = "";
      const files: string[] = [];
      let i = 1;

      // Parse options
      while (vars[String(i)] !== undefined) {
        const arg = String(vars[String(i)]);
        if (arg === "-n") {
          silent = true;
        } else if (arg === "-i") {
          inPlace = true;
        } else if (arg === "-e" && vars[String(i + 1)] !== undefined) {
          script = String(vars[String(i + 1)]);
          i++;
        } else if (!script && !arg.startsWith("-")) {
          script = arg;
        } else if (script && !arg.startsWith("-")) {
          files.push(arg);
        }
        i++;
      }

      if (!script) {
        await bridge.err("sed: no script specified");
        return 1;
      }

      // Parse sed script - support s/pattern/replacement/flags and basic commands
      const parseSedScript = (
        script: string
      ): Array<{ type: string; args: any }> => {
        const commands: Array<{ type: string; args: any }> = [];

        // Handle substitution: s/pattern/replacement/flags
        const subMatch = script.match(/^s(.)(.+?)\1(.*?)\1([gi]*)$/);
        if (subMatch) {
          const [, , pattern, replacement, flags] = subMatch;
          commands.push({
            type: "substitute",
            args: {
              pattern: new RegExp(pattern, flags.includes("g") ? "g" : ""),
              replacement,
              global: flags.includes("g"),
              ignoreCase: flags.includes("i"),
            },
          });
          return commands;
        }

        // Handle delete: /pattern/d or just d
        const deleteMatch = script.match(/^\/(.+?)\/d$/);
        if (deleteMatch) {
          commands.push({
            type: "delete",
            args: { pattern: new RegExp(deleteMatch[1]) },
          });
          return commands;
        }
        if (script === "d") {
          commands.push({ type: "deleteAll", args: {} });
          return commands;
        }

        // Handle print: /pattern/p or just p
        const printMatch = script.match(/^\/(.+?)\/p$/);
        if (printMatch) {
          commands.push({
            type: "print",
            args: { pattern: new RegExp(printMatch[1]) },
          });
          return commands;
        }
        if (script === "p") {
          commands.push({ type: "printAll", args: {} });
          return commands;
        }

        // Handle line number: Nd (delete line N), Np (print line N)
        const lineDeleteMatch = script.match(/^(\d+)d$/);
        if (lineDeleteMatch) {
          commands.push({
            type: "deleteLine",
            args: { line: parseInt(lineDeleteMatch[1]) },
          });
          return commands;
        }
        const linePrintMatch = script.match(/^(\d+)p$/);
        if (linePrintMatch) {
          commands.push({
            type: "printLine",
            args: { line: parseInt(linePrintMatch[1]) },
          });
          return commands;
        }

        // Handle range: N,Md or N,Mp
        const rangeDeleteMatch = script.match(/^(\d+),(\d+)d$/);
        if (rangeDeleteMatch) {
          commands.push({
            type: "deleteRange",
            args: {
              start: parseInt(rangeDeleteMatch[1]),
              end: parseInt(rangeDeleteMatch[2]),
            },
          });
          return commands;
        }

        // Handle quit: q
        if (script === "q") {
          commands.push({ type: "quit", args: {} });
          return commands;
        }

        // Handle append: a\text
        const appendMatch = script.match(/^a\\(.*)$/);
        if (appendMatch) {
          commands.push({ type: "append", args: { text: appendMatch[1] } });
          return commands;
        }

        // Handle insert: i\text
        const insertMatch = script.match(/^i\\(.*)$/);
        if (insertMatch) {
          commands.push({ type: "insert", args: { text: insertMatch[1] } });
          return commands;
        }

        // Handle change: c\text
        const changeMatch = script.match(/^c\\(.*)$/);
        if (changeMatch) {
          commands.push({ type: "change", args: { text: changeMatch[1] } });
          return commands;
        }

        // Handle address + substitution: /pattern/s/old/new/g
        const addrSubMatch = script.match(
          /^\/(.+?)\/s(.)(.+?)\2(.*?)\2([gi]*)$/
        );
        if (addrSubMatch) {
          const [, addr, , pattern, replacement, flags] = addrSubMatch;
          commands.push({
            type: "addrSubstitute",
            args: {
              address: new RegExp(addr),
              pattern: new RegExp(pattern, flags.includes("g") ? "g" : ""),
              replacement,
            },
          });
          return commands;
        }

        return commands;
      };

      const executeOnContent = async (content: string): Promise<string> => {
        const commands = parseSedScript(script);
        const lines = content.split("\n");
        const output: string[] = [];
        let quit = false;

        for (let lineNum = 0; lineNum < lines.length && !quit; lineNum++) {
          let line = lines[lineNum];
          let shouldPrint = !silent;
          let deleted = false;

          for (const cmd of commands) {
            switch (cmd.type) {
              case "substitute":
                line = line.replace(cmd.args.pattern, cmd.args.replacement);
                break;
              case "addrSubstitute":
                if (cmd.args.address.test(line)) {
                  line = line.replace(cmd.args.pattern, cmd.args.replacement);
                }
                break;
              case "delete":
                if (cmd.args.pattern.test(line)) {
                  deleted = true;
                }
                break;
              case "deleteAll":
                deleted = true;
                break;
              case "deleteLine":
                if (lineNum + 1 === cmd.args.line) {
                  deleted = true;
                }
                break;
              case "deleteRange":
                if (
                  lineNum + 1 >= cmd.args.start &&
                  lineNum + 1 <= cmd.args.end
                ) {
                  deleted = true;
                }
                break;
              case "print":
                if (cmd.args.pattern.test(line)) {
                  output.push(line);
                }
                break;
              case "printAll":
                output.push(line);
                break;
              case "printLine":
                if (lineNum + 1 === cmd.args.line) {
                  output.push(line);
                }
                break;
              case "quit":
                quit = true;
                break;
              case "append":
                if (shouldPrint && !deleted) {
                  output.push(line);
                }
                output.push(cmd.args.text);
                shouldPrint = false;
                break;
              case "insert":
                output.push(cmd.args.text);
                break;
              case "change":
                line = cmd.args.text;
                break;
            }
          }

          if (shouldPrint && !deleted) {
            output.push(line);
          }
        }

        return output.join("\n");
      };

      try {
        let allOutput: string[] = [];

        if (files.length === 0) {
          // Read from stdin (use $_ if available)
          const input = String((bridge as any).global_variables?.["_"] ?? "");
          const result = await executeOnContent(input);
          allOutput.push(result);
        } else {
          for (const file of files) {
            const content = (await (bridge as SystemBridge).fs.readFile(
              file,
              "utf-8"
            )) as string;
            const result = await executeOnContent(content);

            if (inPlace) {
              await (bridge as SystemBridge).fs.writeFile(file, result);
            } else {
              allOutput.push(result);
            }
          }
        }

        if (!inPlace && allOutput.length > 0) {
          const output = allOutput.join("\n");
          await bridge.out(output);
          return null;
        }
        return 0;
      } catch (e: any) {
        await bridge.err(`sed: ${e.message}`);
        return 1;
      }
    },

    // awk - pattern scanning and text processing language
    awk: async (bridge, vars) => {
      // Usage: awk [-F sep] 'program' [file...]
      // Supported: BEGIN{}, END{}, /pattern/{action}, {action}
      // Variables: $0, $1-$NF, NR, NF, FS, OFS, RS, ORS
      // Functions: print, printf, length, substr, split, gsub, sub, match, tolower, toupper
      let fieldSep = " ";
      let program = "";
      const files: string[] = [];
      let i = 1;

      // Parse options
      while (vars[String(i)] !== undefined) {
        const arg = String(vars[String(i)]);
        if (arg === "-F" && vars[String(i + 1)] !== undefined) {
          fieldSep = String(vars[String(i + 1)]);
          i += 2;
          continue;
        } else if (!program && !arg.startsWith("-")) {
          program = arg;
        } else if (program && !arg.startsWith("-")) {
          files.push(arg);
        }
        i++;
      }

      if (!program) {
        await bridge.err("awk: no program specified");
        return 1;
      }

      // AWK built-in variables
      const awkVars: Record<string, string | number> = {
        FS: fieldSep,
        OFS: " ",
        RS: "\n",
        ORS: "\n",
        NR: 0,
        NF: 0,
        FILENAME: "",
      };

      // Parse AWK program into rules
      interface AwkRule {
        pattern: "BEGIN" | "END" | RegExp | null;
        action: string;
      }

      const parseAwkProgram = (prog: string): AwkRule[] => {
        const rules: AwkRule[] = [];
        let remaining = prog.trim();

        while (remaining.length > 0) {
          remaining = remaining.trim();

          // BEGIN block
          if (remaining.startsWith("BEGIN")) {
            remaining = remaining.slice(5).trim();
            if (remaining.startsWith("{")) {
              const endBrace = findMatchingBrace(remaining, 0);
              rules.push({
                pattern: "BEGIN",
                action: remaining.slice(1, endBrace),
              });
              remaining = remaining.slice(endBrace + 1).trim();
              continue;
            }
          }

          // END block
          if (remaining.startsWith("END")) {
            remaining = remaining.slice(3).trim();
            if (remaining.startsWith("{")) {
              const endBrace = findMatchingBrace(remaining, 0);
              rules.push({
                pattern: "END",
                action: remaining.slice(1, endBrace),
              });
              remaining = remaining.slice(endBrace + 1).trim();
              continue;
            }
          }

          // /pattern/ { action }
          if (remaining.startsWith("/")) {
            const patternEnd = remaining.indexOf("/", 1);
            if (patternEnd > 0) {
              const pattern = new RegExp(remaining.slice(1, patternEnd));
              remaining = remaining.slice(patternEnd + 1).trim();
              if (remaining.startsWith("{")) {
                const endBrace = findMatchingBrace(remaining, 0);
                rules.push({ pattern, action: remaining.slice(1, endBrace) });
                remaining = remaining.slice(endBrace + 1).trim();
                continue;
              }
            }
          }

          // { action } - default pattern (matches all)
          if (remaining.startsWith("{")) {
            const endBrace = findMatchingBrace(remaining, 0);
            rules.push({ pattern: null, action: remaining.slice(1, endBrace) });
            remaining = remaining.slice(endBrace + 1).trim();
            continue;
          }

          // Skip unknown characters
          remaining = remaining.slice(1);
        }

        return rules;
      };

      const findMatchingBrace = (str: string, start: number): number => {
        let depth = 0;
        let inString = false;
        let stringChar = "";

        for (let i = start; i < str.length; i++) {
          const char = str[i];

          if (inString) {
            if (char === stringChar && str[i - 1] !== "\\") {
              inString = false;
            }
            continue;
          }

          if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            continue;
          }

          if (char === "{") depth++;
          if (char === "}") {
            depth--;
            if (depth === 0) return i;
          }
        }
        return str.length;
      };

      // Execute AWK action
      const executeAction = async (
        action: string,
        fields: string[]
      ): Promise<string | null> => {
        const output: string[] = [];

        // Simple action parser - supports print, printf, and variable assignments
        const statements = action
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s);

        for (const stmt of statements) {
          // print statement
          if (stmt.startsWith("print")) {
            let printArgs = stmt.slice(5).trim();

            if (!printArgs) {
              // print alone prints $0
              output.push(fields[0]);
            } else {
              // Parse print arguments
              const result = evaluateExpression(printArgs, fields);
              output.push(result);
            }
          }
          // printf statement
          else if (stmt.startsWith("printf")) {
            const args = stmt.slice(6).trim();
            const formatMatch = args.match(/^"([^"]*)"(?:,\s*(.*))?$/);
            if (formatMatch) {
              let format = formatMatch[1];
              const argList = formatMatch[2]
                ? formatMatch[2].split(",").map((a) => a.trim())
                : [];

              let argIndex = 0;
              format = format.replace(
                /%(-?\d*\.?\d*)([sdfe%])/g,
                (_, width, type) => {
                  if (type === "%") return "%";
                  const val =
                    argIndex < argList.length
                      ? evaluateExpression(argList[argIndex++], fields)
                      : "";
                  if (type === "d") return String(parseInt(val) || 0);
                  if (type === "f") return String(parseFloat(val) || 0);
                  if (type === "e")
                    return String(parseFloat(val) || 0).toExponential();
                  return val;
                }
              );
              format = format.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
              output.push(format);
            }
          }
          // Variable assignment
          else if (stmt.includes("=") && !stmt.includes("==")) {
            const [varName, ...valueParts] = stmt.split("=");
            const value = evaluateExpression(
              valueParts.join("=").trim(),
              fields
            );
            awkVars[varName.trim()] = value;
          }
          // next statement
          else if (stmt === "next") {
            return null; // Skip to next record
          }
          // exit statement
          else if (stmt.startsWith("exit")) {
            throw { type: "EXIT", code: parseInt(stmt.slice(4).trim()) || 0 };
          }
        }

        return output.join(String(awkVars.ORS));
      };

      // Evaluate AWK expression
      const evaluateExpression = (expr: string, fields: string[]): string => {
        // Handle concatenation with space
        expr = expr.trim();

        // Handle string literals
        if (expr.startsWith('"') && expr.endsWith('"')) {
          return expr.slice(1, -1).replace(/\\n/g, "\n").replace(/\\t/g, "\t");
        }

        // Handle field references: $0, $1, $NF, $(expr)
        expr = expr.replace(/\$(\d+|NF|\([^)]+\))/g, (_, ref) => {
          if (ref === "NF") return fields[fields.length - 1] ?? "";
          if (ref.startsWith("(")) {
            const idx = parseInt(evaluateExpression(ref.slice(1, -1), fields));
            return fields[idx] ?? "";
          }
          return fields[parseInt(ref)] ?? "";
        });

        // Handle AWK variables
        for (const [name, value] of Object.entries(awkVars)) {
          const regex = new RegExp(`\\b${name}\\b`, "g");
          expr = expr.replace(regex, String(value));
        }

        // Handle functions
        // length()
        expr = expr.replace(/length\(([^)]*)\)/g, (_, arg) => {
          const val = arg ? evaluateExpression(arg, fields) : fields[0];
          return String(val.length);
        });

        // substr(s, start, len)
        expr = expr.replace(
          /substr\(([^,]+),\s*(\d+)(?:,\s*(\d+))?\)/g,
          (_, s, start, len) => {
            const str = evaluateExpression(s, fields);
            const startIdx = parseInt(start) - 1;
            return len
              ? str.substr(startIdx, parseInt(len))
              : str.substr(startIdx);
          }
        );

        // tolower()
        expr = expr.replace(/tolower\(([^)]+)\)/g, (_, arg) => {
          return evaluateExpression(arg, fields).toLowerCase();
        });

        // toupper()
        expr = expr.replace(/toupper\(([^)]+)\)/g, (_, arg) => {
          return evaluateExpression(arg, fields).toUpperCase();
        });

        // Handle arithmetic
        try {
          // Simple arithmetic evaluation for numeric expressions
          if (/^[\d\s\+\-\*\/\%\(\)\.]+$/.test(expr)) {
            return String(eval(expr));
          }
        } catch {}

        // Handle string concatenation (space-separated values)
        const parts = expr.split(/\s+/).filter((p) => p);
        if (parts.length > 1) {
          return parts
            .map((p) => evaluateExpression(p, fields))
            .join(String(awkVars.OFS));
        }

        return expr;
      };

      try {
        const rules = parseAwkProgram(program);
        const allOutput: string[] = [];
        let exitCode = 0;

        // Execute BEGIN blocks
        for (const rule of rules) {
          if (rule.pattern === "BEGIN") {
            const result = await executeAction(rule.action, [""]);
            if (result) allOutput.push(result);
          }
        }

        // Process input
        const processContent = async (content: string, filename: string) => {
          awkVars.FILENAME = filename;
          const records = content.split(String(awkVars.RS));

          for (const record of records) {
            if (!record && records.indexOf(record) === records.length - 1)
              continue;

            awkVars.NR = (awkVars.NR as number) + 1;
            const separator = fieldSep === " " ? /\s+/ : new RegExp(fieldSep);
            const fieldList = record.split(separator);
            const fields = [record, ...fieldList];
            awkVars.NF = fieldList.length;

            try {
              for (const rule of rules) {
                if (rule.pattern === "BEGIN" || rule.pattern === "END")
                  continue;

                let matches = false;
                if (rule.pattern === null) {
                  matches = true;
                } else if (rule.pattern instanceof RegExp) {
                  matches = rule.pattern.test(record);
                }

                if (matches) {
                  const result = await executeAction(rule.action, fields);
                  if (result !== null) allOutput.push(result);
                }
              }
            } catch (e: any) {
              if (e?.type === "EXIT") {
                exitCode = e.code;
                break;
              }
              throw e;
            }
          }
        };

        if (files.length === 0) {
          // Read from stdin
          const input = String((bridge as any).global_variables?.["_"] ?? "");
          await processContent(input, "");
        } else {
          for (const file of files) {
            const content = (await (bridge as SystemBridge).fs.readFile(
              file,
              "utf-8"
            )) as string;
            await processContent(content, file);
          }
        }

        // Execute END blocks
        for (const rule of rules) {
          if (rule.pattern === "END") {
            const result = await executeAction(rule.action, [""]);
            if (result) allOutput.push(result);
          }
        }

        const output = allOutput.filter((o) => o).join("");
        if (output) {
          await bridge.out(output);
        }
        return exitCode || output;
      } catch (e: any) {
        await bridge.err(`awk: ${e.message}`);
        return 1;
      }
    },

    // ==========================================
    // Git commands
    // ==========================================
    git: async (bridge, vars) => {
      const subcommand = vars["1"] !== undefined ? String(vars["1"]) : "";
      const sysBridge = bridge as SystemBridge;

      // Collect all additional arguments
      const args: string[] = [];
      let i = 2;
      while (vars[String(i)] !== undefined) {
        args.push(String(vars[String(i)]));
        i++;
      }

      // Find git root (look for .git directory)
      const findGitRoot = async (startPath: string): Promise<string | null> => {
        let current = startPath;
        while (current !== "/") {
          try {
            const stat = await sysBridge.fs.stat(`${current}/.git`);
            if (stat.isDirectory()) return current;
          } catch {}
          current = current.substring(0, current.lastIndexOf("/")) || "/";
        }
        return null;
      };

      try {
        switch (subcommand) {
          case "":
          case "--help":
          case "-h": {
            const helpText = [
              "usage: git <command> [<args>]",
              "",
              "These are common Git commands:",
              "",
              "start a working area:",
              "   init       Create an empty Git repository",
              "   clone      Clone a repository into a new directory",
              "",
              "work on the current change:",
              "   add        Add file contents to the index",
              "   rm         Remove files from the working tree and index",
              "   status     Show the working tree status",
              "",
              "examine the history and state:",
              "   log        Show commit logs",
              "   diff       Show changes between commits",
              "",
              "grow, mark and tweak your history:",
              "   commit     Record changes to the repository",
              "   branch     List, create, or delete branches",
              "   checkout   Switch branches or restore files",
              "   tag        Create, list, delete tags",
              "",
              "collaborate:",
              "   fetch      Download objects and refs from remote",
              "   pull       Fetch from and integrate with remote",
              "   push       Update remote refs along with objects",
              "   remote     Manage set of tracked repositories",
            ];
            await bridge.out(helpText.join("\n"));
            return null;
          }

          case "init": {
            const dir = args[0] || sysBridge.cwd;
            const targetDir = dir.startsWith("/")
              ? dir
              : `${sysBridge.cwd}/${dir}`;

            // Create directory if it doesn't exist
            try {
              await sysBridge.fs.makeDir(targetDir, { recursive: true });
            } catch {}

            await gitCmd.init(targetDir, {
              defaultBranch: args.includes("-b")
                ? args[args.indexOf("-b") + 1]
                : "main",
            });

            await bridge.out(
              `Initialized empty Git repository in ${targetDir}/.git/`
            );
            return null;
          }

          case "clone": {
            const url = args[0];
            if (!url) {
              await bridge.err(
                "fatal: You must specify a repository to clone."
              );
              return 128;
            }

            // Extract repo name from URL
            let targetDir = args[1];
            if (!targetDir) {
              targetDir = url.split("/").pop()?.replace(".git", "") || "repo";
            }
            const fullPath = targetDir.startsWith("/")
              ? targetDir
              : `${sysBridge.cwd}/${targetDir}`;

            await bridge.out(`Cloning into '${targetDir}'...`);

            await gitCmd.clone(url, fullPath, {
              depth: args.includes("--depth")
                ? parseInt(args[args.indexOf("--depth") + 1])
                : undefined,
              singleBranch: args.includes("--single-branch"),
              onProgress: (progress) => {
                // Could show progress
              },
            });

            await bridge.out("done.");
            return null;
          }

          case "add": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err(
                "fatal: not a git repository (or any of the parent directories): .git"
              );
              return 128;
            }

            if (args.length === 0) {
              await bridge.err("Nothing specified, nothing added.");
              return null;
            }

            for (const file of args) {
              if (file === ".") {
                // Add all files
                const entries = await sysBridge.fs.readDir(sysBridge.cwd);
                for (const entry of entries) {
                  if (entry !== ".git") {
                    const relativePath =
                      sysBridge.cwd === gitRoot
                        ? entry
                        : `${sysBridge.cwd.substring(
                            gitRoot.length + 1
                          )}/${entry}`;
                    try {
                      await gitCmd.add(gitRoot, relativePath);
                    } catch {}
                  }
                }
              } else {
                const relativePath = file.startsWith("/")
                  ? file.substring(gitRoot.length + 1)
                  : sysBridge.cwd === gitRoot
                  ? file
                  : `${sysBridge.cwd.substring(gitRoot.length + 1)}/${file}`;
                await gitCmd.add(gitRoot, relativePath);
              }
            }
            return null;
          }

          case "rm": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            for (const file of args.filter((a) => !a.startsWith("-"))) {
              const relativePath = file.startsWith("/")
                ? file.substring(gitRoot.length + 1)
                : file;
              await gitCmd.remove(gitRoot, relativePath);
            }
            return null;
          }

          case "status": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err(
                "fatal: not a git repository (or any of the parent directories): .git"
              );
              return 128;
            }

            const branch = (await gitCmd.currentBranch(gitRoot)) || "main";
            await bridge.out(`On branch ${branch}`);

            const status = await gitCmd.status(gitRoot);
            if (status) {
              await bridge.out(status);
            }
            return null;
          }

          case "commit": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            let message = "";
            const mIndex = args.indexOf("-m");
            if (mIndex !== -1 && args[mIndex + 1]) {
              message = args[mIndex + 1];
            } else {
              await bridge.err("error: please enter a commit message with -m");
              return 1;
            }

            // Get author info
            const user = users.getCurrentUser();
            const author = {
              name: args.includes("--author")
                ? args[args.indexOf("--author") + 1].split("<")[0].trim()
                : user.username,
              email: args.includes("--author")
                ? args[args.indexOf("--author") + 1].match(/<(.+)>/)?.[1] ||
                  `${user.username}@yash.local`
                : `${user.username}@yash.local`,
            };

            const sha = await gitCmd.commit(gitRoot, message, author);
            await bridge.out(
              `[${
                (await gitCmd.currentBranch(gitRoot)) || "main"
              } ${sha.substring(0, 7)}] ${message}`
            );
            return null;
          }

          case "log": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            const depth = args.includes("-n")
              ? parseInt(args[args.indexOf("-n") + 1])
              : args.includes("--oneline")
              ? 15
              : 10;

            const commits = await gitCmd.log(gitRoot, { depth });

            if (args.includes("--oneline")) {
              for (const c of commits) {
                await bridge.out(
                  `${c.oid.substring(0, 7)} ${c.message.split("\n")[0]}`
                );
              }
            } else {
              for (const c of commits) {
                await bridge.out(`commit ${c.oid}`);
                await bridge.out(
                  `Author: ${c.author.name} <${c.author.email}>`
                );
                await bridge.out(
                  `Date:   ${new Date(
                    c.author.timestamp * 1000
                  ).toLocaleString()}`
                );
                await bridge.out("");
                await bridge.out(`    ${c.message}`);
                await bridge.out("");
              }
            }
            return null;
          }

          case "branch": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            // Delete branch
            if (args.includes("-d") || args.includes("-D")) {
              const branchName = args.filter((a) => !a.startsWith("-"))[0];
              if (!branchName) {
                await bridge.err("error: branch name required");
                return 1;
              }
              await gitCmd.deleteBranch(gitRoot, branchName);
              await bridge.out(`Deleted branch ${branchName}`);
              return null;
            }

            // Create branch
            if (args.length > 0 && !args[0].startsWith("-")) {
              await gitCmd.createBranch(gitRoot, args[0]);
              return null;
            }

            // List branches
            const branches = await gitCmd.branch(gitRoot);
            const current = await gitCmd.currentBranch(gitRoot);

            for (const b of branches) {
              const prefix = b === current ? "* " : "  ";
              await bridge.out(`${prefix}${b}`);
            }
            return null;
          }

          case "checkout": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            const ref = args.filter((a) => !a.startsWith("-"))[0];
            if (!ref) {
              await bridge.err("error: please specify a branch or commit");
              return 1;
            }

            // Create and checkout new branch
            if (args.includes("-b")) {
              await gitCmd.createBranch(gitRoot, ref);
            }

            await gitCmd.checkout(gitRoot, ref, { force: args.includes("-f") });
            await bridge.out(`Switched to branch '${ref}'`);
            return null;
          }

          case "diff": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            const file = args.filter((a) => !a.startsWith("-"))[0];
            const diff = await gitCmd.diff(gitRoot, file);
            if (diff) {
              await bridge.out(diff);
            }
            return null;
          }

          case "remote": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            const subCmd = args[0];

            if (subCmd === "add") {
              const name = args[1];
              const url = args[2];
              if (!name || !url) {
                await bridge.err("usage: git remote add <name> <url>");
                return 1;
              }
              await gitCmd.remoteAdd(gitRoot, name, url);
              return null;
            }

            if (subCmd === "remove" || subCmd === "rm") {
              const name = args[1];
              if (!name) {
                await bridge.err("usage: git remote remove <name>");
                return 1;
              }
              await gitCmd.remoteRemove(gitRoot, name);
              return null;
            }

            // List remotes
            const remotes = await gitCmd.remoteList(gitRoot);
            const verbose = args.includes("-v");

            for (const r of remotes) {
              if (verbose) {
                await bridge.out(`${r.remote}\t${r.url} (fetch)`);
                await bridge.out(`${r.remote}\t${r.url} (push)`);
              } else {
                await bridge.out(r.remote);
              }
            }
            return null;
          }

          case "fetch": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            const remote =
              args.filter((a) => !a.startsWith("-"))[0] || "origin";
            await bridge.out(`Fetching ${remote}...`);

            try {
              await gitCmd.fetch(gitRoot, { remote });
              await bridge.out("done.");
            } catch (e: any) {
              await bridge.err(`error: ${e.message}`);
              return 1;
            }
            return null;
          }

          case "pull": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            const remote =
              args.filter((a) => !a.startsWith("-"))[0] || "origin";
            await bridge.out(`Pulling from ${remote}...`);

            try {
              await gitCmd.pull(gitRoot, { remote });
              await bridge.out("Already up to date.");
            } catch (e: any) {
              await bridge.err(`error: ${e.message}`);
              return 1;
            }
            return null;
          }

          case "push": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            const remote =
              args.filter((a) => !a.startsWith("-"))[0] || "origin";
            const force = args.includes("-f") || args.includes("--force");

            await bridge.out(`Pushing to ${remote}...`);

            try {
              await gitCmd.push(gitRoot, { remote, force });
              await bridge.out("done.");
            } catch (e: any) {
              await bridge.err(`error: ${e.message}`);
              await bridge.err(
                "hint: Make sure you have network access and proper credentials."
              );
              return 1;
            }
            return null;
          }

          case "tag": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            // Delete tag
            if (args.includes("-d")) {
              const tagName = args.filter((a) => !a.startsWith("-"))[0];
              if (!tagName) {
                await bridge.err("error: tag name required");
                return 1;
              }
              await gitCmd.deleteTag(gitRoot, tagName);
              await bridge.out(`Deleted tag '${tagName}'`);
              return null;
            }

            // Create tag
            const tagName = args.filter((a) => !a.startsWith("-"))[0];
            if (tagName) {
              await gitCmd.tag(gitRoot, tagName);
              return null;
            }

            // List tags
            const tags = await gitCmd.listTags(gitRoot);
            for (const t of tags) {
              await bridge.out(t);
            }
            return null;
          }

          case "stash": {
            const gitRoot = await findGitRoot(sysBridge.cwd);
            if (!gitRoot) {
              await bridge.err("fatal: not a git repository");
              return 128;
            }

            const stashId = await gitCmd.stash(gitRoot);
            await bridge.out(
              `Saved working directory and index state WIP on ${await gitCmd.currentBranch(
                gitRoot
              )}: ${stashId}`
            );
            return null;
          }

          case "--version": {
            await bridge.out("git version 2.43.0 (isomorphic-git)");
            return null;
          }

          default: {
            await bridge.err(
              `git: '${subcommand}' is not a git command. See 'git --help'.`
            );
            return 1;
          }
        }
      } catch (e: any) {
        await bridge.err(`fatal: ${e.message}`);
        return 128;
      }
    },

    // Help command
    help: async (bridge, vars) => {
      const topic = vars["1"] !== undefined ? String(vars["1"]) : "";

      const commands = {
        "File Commands": [
          "ls",
          "cat",
          "head",
          "tail",
          "touch",
          "mkdir",
          "rmdir",
          "rm",
          "cp",
          "mv",
          "ln",
          "chmod",
          "chown",
          "stat",
          "file",
          "tree",
        ],
        Navigation: ["cd", "pwd", "find", "locate", "which", "whereis"],
        "Text Processing": [
          "grep",
          "sed",
          "awk",
          "cut",
          "sort",
          "uniq",
          "tr",
          "rev",
          "tac",
          "nl",
          "wc",
          "diff",
          "comm",
        ],
        Process: [
          "ps",
          "kill",
          "killall",
          "pgrep",
          "pkill",
          "pidof",
          "jobs",
          "fg",
          "bg",
          "nice",
          "time",
        ],
        Users: [
          "whoami",
          "id",
          "groups",
          "users",
          "who",
          "w",
          "su",
          "sudo",
          "passwd",
        ],
        "System Info": [
          "uname",
          "hostname",
          "uptime",
          "free",
          "df",
          "du",
          "date",
          "cal",
          "env",
          "printenv",
        ],
        Network: ["ping", "curl", "wget", "host", "dig", "netstat", "ifconfig"],
        Git: [
          "git init",
          "git clone",
          "git add",
          "git commit",
          "git status",
          "git log",
          "git branch",
          "git checkout",
          "git push",
          "git pull",
          "git remote",
          "git diff",
          "git tag",
        ],
        Utilities: [
          "echo",
          "printf",
          "sleep",
          "seq",
          "yes",
          "true",
          "false",
          "test",
          "expr",
          "bc",
          "base64",
          "clear",
          "history",
        ],
      };

      if (!topic) {
        const helpText = [
          "YASH - Yet Another SHell",
          "",
          "Available command categories:",
          "",
        ];

        for (const [category, cmds] of Object.entries(commands)) {
          helpText.push(`  ${category}:`);
          helpText.push(`    ${cmds.join(", ")}`);
          helpText.push("");
        }

        helpText.push(
          "Type 'help <command>' for more information on a specific command."
        );
        helpText.push("Type 'help all' to list all available commands.");

        const output = helpText.join("\n");
        await bridge.out(output);
        return null;
      }

      if (topic === "all") {
        const allCommands = Object.values(commands).flat().sort();
        const output = allCommands.join("\n");
        await bridge.out(output);
        return null;
      }

      // Specific command help
      const helpTopics: Record<string, string> = {
        ls: "ls [-a] [-l] [path] - List directory contents\n  -a  Show hidden files\n  -l  Long format",
        cd: "cd [dir] - Change directory\n  cd ~   Go to home\n  cd -   Go to previous directory\n  cd ..  Go to parent directory",
        cat: "cat <file>... - Concatenate and display files",
        pwd: "pwd - Print working directory",
        mkdir:
          "mkdir [-p] <dir>... - Create directories\n  -p  Create parent directories as needed",
        rm: "rm [-r] [-f] <file>... - Remove files/directories\n  -r  Remove directories recursively\n  -f  Force removal",
        cp: "cp [-r] <src> <dest> - Copy files\n  -r  Copy directories recursively",
        mv: "mv <src> <dest> - Move/rename files",
        touch: "touch <file>... - Create empty files or update timestamps",
        grep: "grep <pattern> <file> - Search for pattern in file",
        sed: "sed '<script>' <file> - Stream editor\n  s/old/new/g  Substitute\n  Nd           Delete line N\n  /pat/d       Delete matching lines",
        awk: "awk [-F sep] '<program>' <file>... - Pattern processing\n  {print $1}   Print first field\n  /pat/{...}   Pattern matching\n  BEGIN{...}   Before processing\n  END{...}     After processing",
        ps: "ps [aux] - List processes",
        kill: "kill [-signal] <pid> - Send signal to process",
        whoami: "whoami - Print current username",
        id: "id [user] - Print user identity",
        echo: "echo [-n] [-e] <text>... - Display text\n  -n  No trailing newline\n  -e  Interpret escape sequences",
        test: "test <expr> or [ <expr> ] - Evaluate expression\n  -f file  File exists\n  -d dir   Is directory\n  -z str   String is empty\n  str1 = str2   String equality",
      };

      const help = helpTopics[topic];
      if (help) {
        await bridge.out(help);
        return null;
      }

      // Check if command exists
      const allCmds = Object.values(commands).flat();
      if (allCmds.includes(topic)) {
        await bridge.out(
          `${topic}: No detailed help available. Try 'man ${topic}' on a real system.`
        );
        return null;
      }

      await bridge.err(`help: no help topics match '${topic}'`);
      return null;
    },
  };

  // Create the bridge object
  const bridge: SystemBridge = {
    global_functions: systemFunctions,
    global_variables: {
      HOME: "/home/user",
      USER: "user",
      SHELL: "/bin/yash",
      PATH: "/usr/local/bin:/usr/bin:/bin",
      PWD: cwd,
      OLDPWD: cwd,
      TERM: "xterm-256color",
      "?": 0,
      $: process.getCurrentPid(),
    },

    out: async (...args: PrimitivesJS[]) => {
      const output = args.map((a) => String(a ?? "")).join(" ");
      outputBuffer.push(output);
      terminal.writeLine(output);
    },

    err: async (...args: PrimitivesJS[]) => {
      const output = args.map((a) => String(a ?? "")).join(" ");
      terminal.writeError(output + "\n");
    },

    exec: async (vals: PrimitivesJS[]) => {
      // For external commands, return the command and args
      return vals.join(" ");
    },

    fs,
    process,
    users,

    cwd,
    setCwd(path: string) {
      try {
        fs.setCwd(path);
        cwd = fs.getCwd();
        bridge.cwd = cwd;
        bridge.global_variables["PWD"] = cwd;
      } catch (e) {
        throw e;
      }
    },

    terminal,
    history,

    addHistory(command: string) {
      if (command.trim() && history[history.length - 1] !== command) {
        history.push(command);
      }
    },
  };

  return bridge;
}

// Export types and utilities
export {
  VirtualFileSystem,
  VirtualProcessManager,
  VirtualUserManager,
  PermissionUtils,
  Signals,
};
export type {
  FileSystemOperations,
  FileStats,
  ProcessManager,
  ProcessInfo,
  UserManager,
};
