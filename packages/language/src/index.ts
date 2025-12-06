/**
 * @yash/language - YASH Language Interpreter
 * 
 * A portable Bash-like shell interpreter written in TypeScript.
 * Can be used in Node.js, Bun, and the browser.
 */

// Main runner
export { run } from "./runner";

// Interpreter components
export { lexer, Token, TypeToken } from "./interpretor/lexer";
export { parse } from "./interpretor/parser";
export { evaluate, global_functions, getDefaultGlobalVariables } from "./interpretor/eval";
export { builtins } from "./interpretor/builtins";

// Types
export type {
  Bridge,
  PrimitivesJS,
  ArrayYash,
  AST,
  VariablesYash,
  FunctionsYash,
  Promised,
} from "./types";

// Re-export everything for convenience
import * as types from "./types";
export { types };
