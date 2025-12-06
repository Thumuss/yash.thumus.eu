/**
 * Process management for YASH virtual system
 */

import type { PrimitivesJS } from "@yash/language";

export interface ProcessInfo {
  pid: number;
  ppid: number;           // Parent process ID
  pgid: number;           // Process group ID
  sid: number;            // Session ID
  uid: number;
  gid: number;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  status: "running" | "stopped" | "zombie" | "sleeping" | "disk-sleep";
  startTime: Date;
  cpuTime: number;        // Simulated CPU time in ms
  memUsage: number;       // Simulated memory usage in KB
  nice: number;           // Nice value (-20 to 19)
  exitCode?: number;
  tty?: string;
  isBackground?: boolean;
}

export interface JobInfo {
  jobId: number;
  pid: number;
  status: "running" | "stopped" | "done";
  command: string;
  isBackground: boolean;
}

export interface ProcessManager {
  getCurrentPid(): number;
  getProcess(pid: number): ProcessInfo | undefined;
  listProcesses(): ProcessInfo[];
  spawn(command: string, args: string[], options?: SpawnOptions): number;
  kill(pid: number, signal?: number): boolean;
  wait(pid: number): Promise<number>;
  getEnv(name: string): string | undefined;
  setEnv(name: string, value: string): void;
  unsetEnv(name: string): void;
  getAllEnv(): Record<string, string>;
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  detached?: boolean;
  background?: boolean;
  nice?: number;
  tty?: string;
}

/**
 * Virtual process manager with jobs, sessions, and advanced features
 */
export class VirtualProcessManager implements ProcessManager {
  private processes: Map<number, ProcessInfo> = new Map();
  private jobs: Map<number, JobInfo> = new Map();
  private nextPid: number = 1;
  private nextJobId: number = 1;
  private currentPid: number = 1;
  private env: Record<string, string> = {};
  private signalHandlers: Map<number, Map<number, () => void>> = new Map();
  private startTimestamp: Date;

  constructor() {
    this.startTimestamp = new Date();
    
    // Initialize with init process (PID 1)
    const now = new Date();
    const initProcess: ProcessInfo = {
      pid: 1,
      ppid: 0,
      pgid: 1,
      sid: 1,
      uid: 0,
      gid: 0,
      command: "init",
      args: [],
      cwd: "/",
      env: this.getDefaultEnv(),
      status: "running",
      startTime: now,
      cpuTime: 0,
      memUsage: 1024,
      nice: 0,
      tty: undefined,
    };
    this.processes.set(1, initProcess);
    
    // Shell process (PID 2)
    const shellProcess: ProcessInfo = {
      pid: 2,
      ppid: 1,
      pgid: 2,
      sid: 2,
      uid: 1000,
      gid: 1000,
      command: "yash",
      args: [],
      cwd: "/home/user",
      env: this.getDefaultEnv(),
      status: "running",
      startTime: now,
      cpuTime: 0,
      memUsage: 4096,
      nice: 0,
      tty: "pts/0",
    };
    this.processes.set(2, shellProcess);
    this.nextPid = 2;
    this.currentPid = 2;
    this.env = { ...shellProcess.env };
  }

  private getDefaultEnv(): Record<string, string> {
    return {
      HOME: "/home/user",
      USER: "user",
      LOGNAME: "user",
      SHELL: "/bin/yash",
      PATH: "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
      PWD: "/home/user",
      TERM: "xterm-256color",
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
      HOSTNAME: "yash-virtual",
      EDITOR: "vi",
      VISUAL: "vi",
      PAGER: "less",
      SHLVL: "1",
      _: "/bin/yash",
    };
  }

  getCurrentPid(): number {
    return this.currentPid;
  }

  getProcess(pid: number): ProcessInfo | undefined {
    return this.processes.get(pid);
  }

  listProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get processes by various criteria
   */
  findProcesses(criteria: { uid?: number; command?: string; pattern?: RegExp; status?: string }): ProcessInfo[] {
    return this.listProcesses().filter(p => {
      if (criteria.uid !== undefined && p.uid !== criteria.uid) return false;
      if (criteria.command && p.command !== criteria.command) return false;
      if (criteria.pattern && !criteria.pattern.test(p.command)) return false;
      if (criteria.status && p.status !== criteria.status) return false;
      return true;
    });
  }

  spawn(command: string, args: string[], options?: SpawnOptions): number {
    const pid = ++this.nextPid;
    const parentProcess = this.processes.get(this.currentPid);
    
    const process: ProcessInfo = {
      pid,
      ppid: this.currentPid,
      pgid: options?.detached ? pid : (parentProcess?.pgid ?? pid),
      sid: parentProcess?.sid ?? pid,
      uid: parentProcess?.uid ?? 1000,
      gid: parentProcess?.gid ?? 1000,
      command,
      args,
      cwd: options?.cwd ?? parentProcess?.cwd ?? "/",
      env: { ...this.env, ...options?.env },
      status: "running",
      startTime: new Date(),
      cpuTime: 0,
      memUsage: Math.floor(Math.random() * 10000) + 1000,
      nice: options?.nice ?? 0,
      tty: options?.tty ?? parentProcess?.tty,
      isBackground: options?.background,
    };
    
    this.processes.set(pid, process);
    
    // Create job if background process
    if (options?.background) {
      const jobId = this.nextJobId++;
      this.jobs.set(jobId, {
        jobId,
        pid,
        status: "running",
        command: `${command} ${args.join(" ")}`.trim(),
        isBackground: true,
      });
    }
    
    return pid;
  }

  /**
   * Fork the current process
   */
  fork(): number {
    const parent = this.processes.get(this.currentPid);
    if (!parent) return -1;
    
    const pid = ++this.nextPid;
    const child: ProcessInfo = {
      ...parent,
      pid,
      ppid: this.currentPid,
      startTime: new Date(),
      cpuTime: 0,
    };
    
    this.processes.set(pid, child);
    return pid;
  }

  /**
   * Execute a new program in the current process
   */
  exec(command: string, args: string[]): boolean {
    const proc = this.processes.get(this.currentPid);
    if (!proc) return false;
    
    proc.command = command;
    proc.args = args;
    proc.startTime = new Date();
    proc.cpuTime = 0;
    
    return true;
  }

  kill(pid: number, signal: number = 15): boolean {
    const process = this.processes.get(pid);
    if (!process) return false;
    
    // Check signal handlers
    const handlers = this.signalHandlers.get(pid);
    if (handlers?.has(signal)) {
      handlers.get(signal)!();
      return true;
    }
    
    switch (signal) {
      case Signals.SIGKILL: // 9 - SIGKILL - immediate termination
        process.status = "zombie";
        process.exitCode = 128 + signal;
        this.updateJob(pid, "done");
        break;
      case Signals.SIGTERM: // 15 - SIGTERM - graceful termination
        process.status = "zombie";
        process.exitCode = 128 + signal;
        this.updateJob(pid, "done");
        break;
      case Signals.SIGSTOP: // 19 - SIGSTOP
      case Signals.SIGTSTP: // 20 - SIGTSTP
        process.status = "stopped";
        this.updateJob(pid, "stopped");
        break;
      case Signals.SIGCONT: // 18 - SIGCONT
        if (process.status === "stopped") {
          process.status = "running";
          this.updateJob(pid, "running");
        }
        break;
      case Signals.SIGHUP: // 1 - SIGHUP
        process.status = "zombie";
        process.exitCode = 129;
        this.updateJob(pid, "done");
        break;
      case Signals.SIGINT: // 2 - SIGINT
        process.status = "zombie";
        process.exitCode = 130;
        this.updateJob(pid, "done");
        break;
      case Signals.SIGQUIT: // 3 - SIGQUIT
        process.status = "zombie";
        process.exitCode = 131;
        this.updateJob(pid, "done");
        break;
      default:
        // Other signals - just mark as received
        break;
    }
    
    return true;
  }

  /**
   * Kill all processes matching a pattern
   */
  killAll(pattern: string | RegExp, signal: number = 15): number {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    let count = 0;
    
    for (const proc of this.processes.values()) {
      if (regex.test(proc.command) && proc.pid !== 1 && proc.pid !== this.currentPid) {
        if (this.kill(proc.pid, signal)) count++;
      }
    }
    
    return count;
  }

  private updateJob(pid: number, status: "running" | "stopped" | "done"): void {
    for (const job of this.jobs.values()) {
      if (job.pid === pid) {
        job.status = status;
        break;
      }
    }
  }

  async wait(pid: number): Promise<number> {
    const process = this.processes.get(pid);
    if (!process) return -1;
    
    if (process.status === "zombie") {
      const exitCode = process.exitCode ?? 0;
      this.processes.delete(pid);
      // Remove associated job
      for (const [jobId, job] of this.jobs.entries()) {
        if (job.pid === pid) {
          this.jobs.delete(jobId);
          break;
        }
      }
      return exitCode;
    }
    
    return 0;
  }

  /**
   * Wait for any child process
   */
  async waitAny(): Promise<{ pid: number; exitCode: number } | null> {
    for (const proc of this.processes.values()) {
      if (proc.ppid === this.currentPid && proc.status === "zombie") {
        const exitCode = proc.exitCode ?? 0;
        this.processes.delete(proc.pid);
        return { pid: proc.pid, exitCode };
      }
    }
    return null;
  }

  /**
   * Set nice value for a process
   */
  setNice(pid: number, nice: number): boolean {
    const process = this.processes.get(pid);
    if (!process) return false;
    
    // Clamp nice value to valid range
    process.nice = Math.max(-20, Math.min(19, nice));
    return true;
  }

  /**
   * Register a signal handler
   */
  trap(pid: number, signal: number, handler: () => void): void {
    if (!this.signalHandlers.has(pid)) {
      this.signalHandlers.set(pid, new Map());
    }
    this.signalHandlers.get(pid)!.set(signal, handler);
  }

  /**
   * Remove a signal handler
   */
  untrap(pid: number, signal: number): void {
    this.signalHandlers.get(pid)?.delete(signal);
  }

  getEnv(name: string): string | undefined {
    return this.env[name];
  }

  setEnv(name: string, value: string): void {
    this.env[name] = value;
    const current = this.processes.get(this.currentPid);
    if (current) {
      current.env[name] = value;
    }
  }

  unsetEnv(name: string): void {
    delete this.env[name];
    const current = this.processes.get(this.currentPid);
    if (current) {
      delete current.env[name];
    }
  }

  getAllEnv(): Record<string, string> {
    return { ...this.env };
  }

  /**
   * Get all jobs
   */
  listJobs(): JobInfo[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job by ID
   */
  getJob(jobId: number): JobInfo | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Bring job to foreground
   */
  foreground(jobId: number): ProcessInfo | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    
    const proc = this.processes.get(job.pid);
    if (!proc) return undefined;
    
    // Resume if stopped
    if (proc.status === "stopped") {
      this.kill(proc.pid, Signals.SIGCONT);
    }
    
    job.isBackground = false;
    proc.isBackground = false;
    
    return proc;
  }

  /**
   * Send job to background
   */
  background(jobId: number): ProcessInfo | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    
    const proc = this.processes.get(job.pid);
    if (!proc) return undefined;
    
    // Resume if stopped
    if (proc.status === "stopped") {
      this.kill(proc.pid, Signals.SIGCONT);
    }
    
    job.isBackground = true;
    proc.isBackground = true;
    
    return proc;
  }

  /**
   * Disown a job (remove from job table)
   */
  disown(jobId: number): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTimestamp.getTime()) / 1000);
  }

  /**
   * Get load average (simulated)
   */
  getLoadAverage(): [number, number, number] {
    const running = this.listProcesses().filter(p => p.status === "running").length;
    const load = running / 4; // Simulated based on 4 CPUs
    return [load, load * 0.9, load * 0.8];
  }

  /**
   * Generate ps-like output
   */
  ps(options?: { all?: boolean; full?: boolean; aux?: boolean }): string {
    const lines: string[] = [];
    
    if (options?.aux) {
      lines.push("USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND");
      for (const proc of this.processes.values()) {
        const user = proc.uid === 0 ? "root" : "user";
        const cpu = (Math.random() * 5).toFixed(1);
        const mem = (proc.memUsage / 51200).toFixed(1);
        const vsz = proc.memUsage * 4;
        const rss = proc.memUsage;
        const tty = proc.tty ?? "?";
        const stat = proc.status === "running" ? "R" : proc.status === "sleeping" ? "S" : proc.status === "stopped" ? "T" : "Z";
        const start = proc.startTime.toTimeString().slice(0, 5);
        const time = this.formatTime(proc.cpuTime);
        lines.push(`${user.padEnd(8)} ${proc.pid.toString().padStart(5)} ${cpu.padStart(4)} ${mem.padStart(4)} ${vsz.toString().padStart(6)} ${rss.toString().padStart(5)} ${tty.padEnd(8)} ${stat.padEnd(4)} ${start} ${time} ${proc.command}`);
      }
    } else if (options?.full) {
      lines.push("UID        PID  PPID  C STIME TTY          TIME CMD");
      for (const proc of this.processes.values()) {
        if (!options?.all && proc.pid !== this.currentPid) continue;
        const time = this.formatTime(proc.cpuTime);
        const stime = proc.startTime.toTimeString().slice(0, 5);
        const tty = proc.tty ?? "?";
        lines.push(`${proc.uid.toString().padStart(5)} ${proc.pid.toString().padStart(6)} ${proc.ppid.toString().padStart(5)}  0 ${stime} ${tty.padEnd(12)} ${time} ${proc.command} ${proc.args.join(" ")}`);
      }
    } else {
      lines.push("  PID TTY          TIME CMD");
      for (const proc of this.processes.values()) {
        if (!options?.all && proc.pid !== this.currentPid) continue;
        const time = this.formatTime(proc.cpuTime);
        const tty = proc.tty ?? "?";
        lines.push(`${proc.pid.toString().padStart(5)} ${tty.padEnd(12)} ${time} ${proc.command}`);
      }
    }
    
    return lines.join("\n");
  }

  /**
   * Generate top-like output
   */
  top(): string {
    const uptime = this.getUptime();
    const load = this.getLoadAverage();
    const procs = this.listProcesses();
    const running = procs.filter(p => p.status === "running").length;
    const sleeping = procs.filter(p => p.status === "sleeping").length;
    const stopped = procs.filter(p => p.status === "stopped").length;
    const zombie = procs.filter(p => p.status === "zombie").length;
    
    const lines: string[] = [
      `top - ${new Date().toTimeString().slice(0, 8)} up ${Math.floor(uptime / 60)} min,  1 user,  load average: ${load[0].toFixed(2)}, ${load[1].toFixed(2)}, ${load[2].toFixed(2)}`,
      `Tasks: ${procs.length} total,   ${running} running, ${sleeping} sleeping,   ${stopped} stopped,   ${zombie} zombie`,
      `%Cpu(s):  2.0 us,  1.0 sy,  0.0 ni, 96.5 id,  0.5 wa,  0.0 hi,  0.0 si,  0.0 st`,
      `MiB Mem :    512.0 total,    384.0 free,    100.0 used,     28.0 buff/cache`,
      ``,
      `  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND`,
    ];
    
    for (const proc of procs.slice(0, 10)) {
      const user = proc.uid === 0 ? "root" : "user";
      const pr = 20 + proc.nice;
      const virt = proc.memUsage * 4;
      const res = proc.memUsage;
      const shr = Math.floor(proc.memUsage / 2);
      const stat = proc.status[0].toUpperCase();
      const cpu = (Math.random() * 5).toFixed(1);
      const mem = (proc.memUsage / 5120).toFixed(1);
      const time = this.formatTime(proc.cpuTime);
      lines.push(`${proc.pid.toString().padStart(5)} ${user.padEnd(9)} ${pr.toString().padStart(3)} ${proc.nice.toString().padStart(3)} ${virt.toString().padStart(7)} ${res.toString().padStart(6)} ${shr.toString().padStart(6)} ${stat}  ${cpu.padStart(5)}  ${mem.padStart(4)} ${time.padStart(9)} ${proc.command}`);
    }
    
    return lines.join("\n");
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours.toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  }
}

/**
 * Signal definitions
 */
export const Signals = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGILL: 4,
  SIGTRAP: 5,
  SIGABRT: 6,
  SIGBUS: 7,
  SIGFPE: 8,
  SIGKILL: 9,
  SIGUSR1: 10,
  SIGSEGV: 11,
  SIGUSR2: 12,
  SIGPIPE: 13,
  SIGALRM: 14,
  SIGTERM: 15,
  SIGCHLD: 17,
  SIGCONT: 18,
  SIGSTOP: 19,
  SIGTSTP: 20,
  SIGTTIN: 21,
  SIGTTOU: 22,
} as const;

export type SignalName = keyof typeof Signals;
