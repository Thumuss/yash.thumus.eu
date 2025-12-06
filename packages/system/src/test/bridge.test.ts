import { describe, test, expect } from "bun:test";
import { createSystemBridge, VirtualFileSystem, VirtualProcessManager, VirtualUserManager } from "../index";
import { run } from "@yash/language";

describe("System Bridge", () => {
  describe("Virtual Filesystem", () => {
    test("should create and read files", async () => {
      const fs = new VirtualFileSystem();
      
      await fs.writeFile("/home/user/test.txt", "Hello, World!");
      const content = await fs.readFile("/home/user/test.txt", "utf-8");
      
      expect(content).toBe("Hello, World!");
    });

    test("should list directory contents", async () => {
      const fs = new VirtualFileSystem();
      
      await fs.writeFile("/home/user/file1.txt", "content1");
      await fs.writeFile("/home/user/file2.txt", "content2");
      
      const files = await fs.readDir("/home/user");
      
      expect(files).toContain("file1.txt");
      expect(files).toContain("file2.txt");
    });

    test("should create directories recursively", async () => {
      const fs = new VirtualFileSystem();
      
      await fs.makeDir("/home/user/a/b/c", { recursive: true });
      
      expect(await fs.exists("/home/user/a/b/c")).toBe(true);
    });

    test("should delete files", async () => {
      const fs = new VirtualFileSystem();
      
      await fs.writeFile("/home/user/todelete.txt", "bye");
      expect(await fs.exists("/home/user/todelete.txt")).toBe(true);
      
      await fs.deleteFile("/home/user/todelete.txt");
      expect(await fs.exists("/home/user/todelete.txt")).toBe(false);
    });

    test("should provide file stats", async () => {
      const fs = new VirtualFileSystem();
      
      await fs.writeFile("/home/user/stats.txt", "content");
      const stat = await fs.stat("/home/user/stats.txt");
      
      expect(stat.isFile()).toBe(true);
      expect(stat.isDirectory()).toBe(false);
      expect(stat.size).toBe(7);
    });

    test("should handle symlinks", async () => {
      const fs = new VirtualFileSystem();
      
      await fs.writeFile("/home/user/original.txt", "original content");
      await fs.symlink("/home/user/original.txt", "/home/user/link.txt");
      
      const target = await fs.readlink("/home/user/link.txt");
      expect(target).toBe("/home/user/original.txt");
      
      // Reading through symlink should work
      const content = await fs.readFile("/home/user/link.txt", "utf-8");
      expect(content).toBe("original content");
    });

    test("should rename files", async () => {
      const fs = new VirtualFileSystem();
      
      await fs.writeFile("/home/user/old.txt", "content");
      await fs.rename("/home/user/old.txt", "/home/user/new.txt");
      
      expect(await fs.exists("/home/user/old.txt")).toBe(false);
      expect(await fs.exists("/home/user/new.txt")).toBe(true);
    });

    test("should copy files", async () => {
      const fs = new VirtualFileSystem();
      
      await fs.writeFile("/home/user/source.txt", "to copy");
      await fs.copy("/home/user/source.txt", "/home/user/dest.txt");
      
      expect(await fs.exists("/home/user/source.txt")).toBe(true);
      expect(await fs.exists("/home/user/dest.txt")).toBe(true);
      
      const content = await fs.readFile("/home/user/dest.txt", "utf-8");
      expect(content).toBe("to copy");
    });

    test("should have standard directories", async () => {
      const fs = new VirtualFileSystem();
      
      expect(await fs.exists("/bin")).toBe(true);
      expect(await fs.exists("/etc")).toBe(true);
      expect(await fs.exists("/home")).toBe(true);
      expect(await fs.exists("/tmp")).toBe(true);
      expect(await fs.exists("/usr")).toBe(true);
    });
  });

  describe("Process Manager", () => {
    test("should have initial shell process", () => {
      const pm = new VirtualProcessManager();
      
      const processes = pm.listProcesses();
      expect(processes.length).toBeGreaterThan(0);
      // Check that yash shell process exists (could be first or second after init)
      const shellProcess = processes.find(p => p.command === "yash");
      expect(shellProcess).toBeDefined();
    });

    test("should spawn new process", () => {
      const pm = new VirtualProcessManager();
      
      const pid = pm.spawn("test-command", ["arg1", "arg2"]);
      
      expect(pid).toBeGreaterThan(1);
      
      const process = pm.getProcess(pid);
      expect(process).toBeDefined();
      expect(process?.command).toBe("test-command");
      expect(process?.args).toEqual(["arg1", "arg2"]);
    });

    test("should kill process", () => {
      const pm = new VirtualProcessManager();
      
      const pid = pm.spawn("to-kill", []);
      const result = pm.kill(pid);
      
      expect(result).toBe(true);
      
      const process = pm.getProcess(pid);
      expect(process?.status).toBe("zombie");
    });

    test("should manage environment variables", () => {
      const pm = new VirtualProcessManager();
      
      pm.setEnv("MYVAR", "myvalue");
      expect(pm.getEnv("MYVAR")).toBe("myvalue");
      
      pm.unsetEnv("MYVAR");
      expect(pm.getEnv("MYVAR")).toBeUndefined();
    });
  });

  describe("User Manager", () => {
    test("should have default users", () => {
      const um = new VirtualUserManager();
      
      const currentUser = um.getCurrentUser();
      expect(currentUser.username).toBe("user");
      expect(currentUser.uid).toBe(1000);
      
      const root = um.getUser(0);
      expect(root?.username).toBe("root");
    });

    test("should check permissions", () => {
      const um = new VirtualUserManager();
      
      // User checking own file with mode 0o644 (rw-r--r--)
      expect(um.checkPermission(1000, 1000, 0o644, "read")).toBe(true);
      expect(um.checkPermission(1000, 1000, 0o644, "write")).toBe(true);
      
      // User checking another user's file
      expect(um.checkPermission(0, 0, 0o644, "read")).toBe(true);  // others can read
      expect(um.checkPermission(0, 0, 0o644, "write")).toBe(false); // others can't write
    });

    test("should provide id output", () => {
      const um = new VirtualUserManager();
      
      const id = um.id();
      expect(id).toContain("uid=1000");
      expect(id).toContain("user");
    });

    test("should provide whoami", () => {
      const um = new VirtualUserManager();
      
      expect(um.whoami()).toBe("user");
    });
  });

  describe("System Bridge Integration", () => {
    test("should create a working system bridge", () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      expect(bridge.fs).toBeDefined();
      expect(bridge.process).toBeDefined();
      expect(bridge.users).toBeDefined();
      expect(bridge.cwd).toBe("/home/user");
    });

    test("should run ls command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      // Create some test files
      await bridge.fs.writeFile("/home/user/test1.txt", "content1");
      await bridge.fs.writeFile("/home/user/test2.txt", "content2");
      
      await run("ls", bridge);
      
      expect(output.some(o => o.includes("test1.txt"))).toBe(true);
      expect(output.some(o => o.includes("test2.txt"))).toBe(true);
    });

    test("should run pwd command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await run("pwd", bridge);
      
      expect(output.some(o => o.includes("/home/user"))).toBe(true);
    });

    test("should run cd command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await run("cd /tmp", bridge);
      
      expect(bridge.cwd).toBe("/tmp");
    });

    test("should run cat command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await bridge.fs.writeFile("/home/user/hello.txt", "Hello from file!");
      
      await run('cat "/home/user/hello.txt"', bridge);
      
      expect(output.some(o => o.includes("Hello from file!"))).toBe(true);
    });

    test("should run touch command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await run('touch "/home/user/newfile.txt"', bridge);
      
      expect(await bridge.fs.exists("/home/user/newfile.txt")).toBe(true);
    });

    test("should run mkdir command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await run('mkdir -p "/home/user/new/nested/dir"', bridge);
      
      expect(await bridge.fs.exists("/home/user/new/nested/dir")).toBe(true);
    });

    test("should run whoami command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await run("whoami", bridge);
      
      expect(output.some(o => o.includes("user"))).toBe(true);
    });

    test("should run date command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await run("date", bridge);
      
      // Should have some date output
      expect(output.length).toBeGreaterThan(0);
    });

    test("should run uname command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await run("uname -a", bridge);
      
      expect(output.some(o => o.includes("YASH"))).toBe(true);
    });

    test("should run env command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await run("env", bridge);
      
      expect(output.some(o => o.includes("HOME="))).toBe(true);
      expect(output.some(o => o.includes("PATH="))).toBe(true);
    });

    test("should run grep command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await bridge.fs.writeFile("/home/user/grep_test.txt", "line one\nline two\nline three");
      
      await run('grep "two" "/home/user/grep_test.txt"', bridge);
      
      expect(output.some(o => o.includes("line two"))).toBe(true);
    });

    test("should support test -f for file existence", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      // Create a test file
      await bridge.fs.writeFile("/home/user/exists.txt", "content");
      
      await run('test -f "/home/user/exists.txt"\necho $?', bridge);
      
      expect(output.some(o => o.includes("0"))).toBe(true); // 0 = file exists
    });

    test("should support test -d for directory existence", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await run('test -d "/home/user"\necho $?', bridge);
      
      expect(output.some(o => o.includes("0"))).toBe(true); // 0 = is directory
    });

    test("should run sed substitution command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await bridge.fs.writeFile("/home/user/sed_test.txt", "hello world\nfoo bar");
      
      await run('sed "s/hello/hi/g" "/home/user/sed_test.txt"', bridge);
      
      expect(output.some(o => o.includes("hi world"))).toBe(true);
    });

    test("should run sed delete line command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await bridge.fs.writeFile("/home/user/sed_del.txt", "line1\nline2\nline3");
      
      await run('sed "2d" "/home/user/sed_del.txt"', bridge);
      
      const combined = output.join("\n");
      expect(combined).toContain("line1");
      expect(combined).not.toContain("line2");
      expect(combined).toContain("line3");
    });

    test("should run awk print command", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await bridge.fs.writeFile("/home/user/awk_test.txt", "one two three\nfour five six");
      
      await run('awk "{print $2}" "/home/user/awk_test.txt"', bridge);
      
      expect(output.some(o => o.includes("two"))).toBe(true);
      expect(output.some(o => o.includes("five"))).toBe(true);
    });

    test("should run awk with field separator", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await bridge.fs.writeFile("/home/user/awk_csv.txt", "a,b,c\n1,2,3");
      
      await run('awk -F "," "{print $2}" "/home/user/awk_csv.txt"', bridge);
      
      expect(output.some(o => o.includes("b"))).toBe(true);
      expect(output.some(o => o.includes("2"))).toBe(true);
    });

    test("should run awk with pattern matching", async () => {
      const output: string[] = [];
      const bridge = createSystemBridge({
        onOutput: (data) => output.push(data),
        onError: (data) => output.push(`ERROR: ${data}`),
      });
      
      await bridge.fs.writeFile("/home/user/awk_pattern.txt", "apple\nbanana\napricot");
      
      await run('awk "/^a/{print}" "/home/user/awk_pattern.txt"', bridge);
      
      expect(output.some(o => o.includes("apple"))).toBe(true);
      expect(output.some(o => o.includes("apricot"))).toBe(true);
      expect(output.every(o => !o.includes("banana"))).toBe(true);
    });
  });
});
