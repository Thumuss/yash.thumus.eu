import { lexer } from "./interpretor/lexer";
import { parse } from "./interpretor/parser";
import { evaluate } from "./interpretor/eval";
import * as types from "./types";

async function run(str: string, inter: types.Bridge) {
    // Ensure bridge has all required properties with defaults
    const bridgeInstance: types.Bridge = {
      global_variables: inter.global_variables ?? {},
      global_functions: inter.global_functions ?? {},
      out: inter.out,
      err: inter.err,
      exec: inter.exec,
      // Pass through optional system bridge properties
      fs: inter.fs,
      process: inter.process,
      users: inter.users,
      cwd: inter.cwd,
      setCwd: inter.setCwd,
      terminal: inter.terminal,
      history: inter.history,
      addHistory: inter.addHistory,
    };
    
    try {
      const lexed = lexer(str);
      const { ASTs, copy: copyTokens } = parse(lexed);
      // Shared scoped variables across all ASTs in this run
      // Don't copy positional parameters - they should always be read from global_variables
      const scoped_variables: types.VariablesYash = {};
      for (const [key, value] of Object.entries(bridgeInstance.global_variables)) {
        // Skip positional parameters (numbers only)
        if (!/^\d+$/.test(key)) {
          scoped_variables[key] = value;
        }
      }
      for (const tree of ASTs) {
        try {
          const evld = await evaluate({ ast: tree, bridge: bridgeInstance, scoped_variables, tokens: copyTokens });
          if (evld !== undefined && evld !== null) {
            await bridgeInstance.out(evld);
          }
          // Sync global_variables changes back to scoped_variables
          // This allows builtins like 'let' to modify variables visible in subsequent commands
          for (const [key, value] of Object.entries(bridgeInstance.global_variables)) {
            if (!/^\d+$/.test(key)) {
              scoped_variables[key] = value;
            }
          }
        } catch (e) {
          await bridgeInstance.err(e as any);
        }
      }
    } catch (e) {
      await bridgeInstance.err(e as any);
    }
  }

export { run, lexer, parse, evaluate, types }
