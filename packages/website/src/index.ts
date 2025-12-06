/**
 * YASH Web Terminal
 * 
 * A web-based terminal interface for the YASH shell.
 * This package combines @yash/language and @yash/system 
 * to provide a complete shell experience in the browser.
 */

import { run } from "@yash/language";
import { createSystemBridge, type SystemBridge, type SystemBridgeOptions } from "@yash/system";

export interface WebTerminalOptions extends SystemBridgeOptions {
  // DOM element to mount the terminal
  container?: HTMLElement;
  
  // Initial working directory
  initialCwd?: string;
  
  // Welcome message
  welcomeMessage?: string;
  
  // Prompt format (supports $USER, $CWD, etc.)
  prompt?: string;
}

export interface WebTerminal {
  bridge: SystemBridge;
  execute: (command: string) => Promise<void>;
  clear: () => void;
  getHistory: () => string[];
  getCwd: () => string;
  setCwd: (path: string) => void;
}

/**
 * Create a web terminal instance
 */
export function createWebTerminal(options: WebTerminalOptions = {}): WebTerminal {
  const outputBuffer: string[] = [];
  
  const bridge = createSystemBridge({
    onOutput: (data) => {
      outputBuffer.push(data);
      options.onOutput?.(data);
    },
    onError: (data) => {
      options.onError?.(data);
    },
    onClear: () => {
      outputBuffer.length = 0;
      options.onClear?.();
    },
    terminalSize: options.terminalSize ?? { rows: 24, cols: 80 },
  });
  
  // Set initial working directory
  if (options.initialCwd) {
    bridge.setCwd(options.initialCwd);
  }
  
  // Add welcome message
  if (options.welcomeMessage) {
    bridge.terminal.writeLine(options.welcomeMessage);
  }
  
  return {
    bridge,
    
    async execute(command: string) {
      bridge.addHistory(command);
      await run(command, bridge);
    },
    
    clear() {
      bridge.terminal.clear();
    },
    
    getHistory() {
      return [...bridge.history];
    },
    
    getCwd() {
      return bridge.cwd;
    },
    
    setCwd(path: string) {
      bridge.setCwd(path);
    },
  };
}

/**
 * Simple REPL for testing in Node.js/Bun
 */
export async function startRepl() {
  const terminal = createWebTerminal({
    welcomeMessage: "YASH Web Terminal v1.0.0",
    prompt: "yash >> ",
  });
  
  const prompt = "yash >> ";
  
  // Simple REPL loop using Bun's readline
  const stdin = Bun.stdin.stream();
  const reader = stdin.getReader();
  const decoder = new TextDecoder();
  
  process.stdout.write(`${terminal.bridge.cwd} ${prompt}`);
  
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value);
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "exit") {
        console.log("Goodbye!");
        return;
      }
      
      if (trimmed) {
        await terminal.execute(trimmed);
      }
      
      process.stdout.write(`${terminal.getCwd()} ${prompt}`);
    }
  }
}

// Export types
export type { SystemBridge, SystemBridgeOptions } from "@yash/system";

// Re-export useful items from other packages
export { run } from "@yash/language";
export { 
  createSystemBridge,
  VirtualFileSystem,
  VirtualProcessManager,
  VirtualUserManager,
} from "@yash/system";
