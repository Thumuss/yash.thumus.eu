/**
 * YASH Bridge Module
 * 
 * Provides the complete virtual system infrastructure for YASH:
 * - Virtual Filesystem (VFS)
 * - Process Management
 * - User/Permission Management
 * - Complete System Bridge
 */

// Main system bridge
export { 
  createSystemBridge,
  type SystemBridge,
  type SystemBridgeOptions,
  type TerminalInterface,
} from "./system";

// Filesystem
export {
  VirtualFileSystem,
  type FileSystemOperations,
  type FileStats,
  type FileType,
  type FileEntry,
} from "./filesystem";

// Process management
export {
  VirtualProcessManager,
  Signals,
  type ProcessManager,
  type ProcessInfo,
  type SpawnOptions,
  type SignalName,
} from "./process";

// User management
export {
  VirtualUserManager,
  PermissionUtils,
  type UserManager,
  type UserInfo,
  type GroupInfo,
} from "./users";

// Git integration
export {
  GitCommands,
  createGitFsAdapter,
} from "./git";

/**
 * Quick start helper to create a fully configured system bridge
 * with console output
 */
export function createConsoleBridge() {
  const { createSystemBridge } = require("./system");
  return createSystemBridge({
    onOutput: (data: string) => console.log(data),
    onError: (data: string) => console.error(data),
  });
}

/**
 * Create a bridge for web usage with callback handlers
 */
export function createWebBridge(options: {
  onOutput: (data: string) => void;
  onError?: (data: string) => void;
  onClear?: () => void;
  terminalSize?: { rows: number; cols: number };
}) {
  const { createSystemBridge } = require("./system");
  return createSystemBridge({
    onOutput: options.onOutput,
    onError: options.onError ?? options.onOutput,
    onClear: options.onClear,
    terminalSize: options.terminalSize,
  });
}
