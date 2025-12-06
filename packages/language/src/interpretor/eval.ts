import type {
  AST,
  PrimitivesJS,
  FunctionsOperators,
  Bridge,
  Promised,
  VariablesYash,
  FunctionsYash,
} from "../types";
import { ErrorYASH } from "./error";
import { Token, TypeToken } from "./lexer";
import Binary from "./parser/classes/Binary";
import Command from "./parser/classes/Command";
import Primitive from "./parser/classes/Primitives";
import Unary from "./parser/classes/Unary";
import { ArrayLiteral, ArrayAccess } from "./parser/classes/Array";
import { Else, Functions, If, While, Until, For, Local } from "./parser/functions/keywords";
import { builtins } from "./builtins";

const operators: FunctionsOperators = {
  [TypeToken.Number]: () => null,
  [TypeToken.Text]: () => null,
  [TypeToken.Bool]: () => null,
  [TypeToken.Argument]: () => null,
  [TypeToken.And]: function (a: PrimitivesJS, b: PrimitivesJS) {
    return a && b;
  },

  [TypeToken.Or]: function (a: PrimitivesJS, b: PrimitivesJS) {
    return a || b;
  },

  [TypeToken.Not]: function (a: PrimitivesJS) {
    if (typeof a !== "boolean") {
      throw new Error(); //new ErrorYASH();
    }
    return !a;
  },

  [TypeToken.Plus]: function (a: PrimitivesJS, b: PrimitivesJS) {
    if (typeof a === "number" && typeof b === "number") return a + b;
    if (typeof a === "string" && typeof b === "string") return a + b;
    throw "I got nothing in my braiiin +";
  },

  [TypeToken.Minus]: function (a: PrimitivesJS, b: PrimitivesJS) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    throw "I got nothing in my braiiin -";
  },

  [TypeToken.Star]: function (a: PrimitivesJS, b: PrimitivesJS) {
    if (typeof a === "number" && typeof b === "number") return a * b;
    if (typeof a === "string" && typeof b === "number") return a.repeat(b);
    if (typeof a === "number" && typeof b === "string") return b.repeat(a);
    throw "I got nothing in my braiiin *";
  },

  [TypeToken.Slash]: function (a: PrimitivesJS, b: PrimitivesJS) {
    if (typeof a === "number" && typeof b === "number") return a / b;
    throw "I got nothing in my braiiin /";
  },

  [TypeToken.Modulo]: function (a: PrimitivesJS, b: PrimitivesJS) {
    if (typeof a === "number" && typeof b === "number") return a % b;
    throw "I got nothing in my braiiin %";
  },

  [TypeToken.Pow]: function (a: PrimitivesJS, b: PrimitivesJS) {
    if (typeof a === "number" && typeof b === "number") return a ** b;
    throw "I got nothing in my braiiin **";
  },

  [TypeToken.Ampersand]: function () {
    console.log("on verra");
  },

  [TypeToken.Pipe]: function () {
    console.log("on verra");
  },

  [TypeToken.PipeIn]: function () {
    console.log("on verra");
  },

  [TypeToken.PipeOut]: function () {
    console.log("on verra");
  },

  [TypeToken.Eq]: (a: PrimitivesJS, b: PrimitivesJS) => {
    return a == b;
  },
  [TypeToken.NotEq]: (a: PrimitivesJS, b: PrimitivesJS) => {
    return a != b;
  },
  [TypeToken.Less]: (a: PrimitivesJS, b: PrimitivesJS) => {
    if (typeof a === "number" && typeof b === "number") return a < b;
    throw "EVAL ERROR: You can't mix use < with ${}";
  },
  [TypeToken.Greater]: (a: PrimitivesJS, b: PrimitivesJS) => {
    if (typeof a === "number" && typeof b === "number") return a > b;
    throw "I got nothing in my braiiin >";
  },
  [TypeToken.GrEq]: (a: PrimitivesJS, b: PrimitivesJS) => {
    if (typeof a === "number" && typeof b === "number") return a >= b;
    throw "I got nothing in my braiiin >=";
  },
  [TypeToken.LsEq]: (a: PrimitivesJS, b: PrimitivesJS) => {
    if (typeof a === "number" && typeof b === "number") return a <= b;
    throw "I got nothing in my braiiin <=";
  },
};

const global_functions: FunctionsYash = {
  random: (_, vars: VariablesYash) => {
    const v2 = parseInt(String(vars["2"]));
    const v1 = parseInt(String(vars["1"]));
    return !Number.isNaN(v2)
      ? Math.floor(
          Math.random() * (!Number.isNaN(v2) ? v2 : v1) +
            (!Number.isNaN(v1) ? v1 : 0)
        )
      : Math.random();
  },
  nbr: (_, vars: VariablesYash) => {
    return parseInt(String(vars["1"]));
  },

  max: (_, vars: VariablesYash) => {
    const v2 = parseInt(String(vars["2"]));
    const v1 = parseInt(String(vars["1"]));
    return Math.max(v1 || 0, v2 || v1 || 0);
  },

  min: (_, vars: VariablesYash) => {
    const v2 = parseInt(String(vars["2"]));
    const v1 = parseInt(String(vars["1"]));
    return Math.min(v1 || 0, v2 || v1 || 0);
  },

  pow: (_, vars: VariablesYash) => {
    const v2 = parseInt(String(vars["2"]));
    const v1 = parseInt(String(vars["1"]));
    return Number.isNaN(v2) ? Math.pow(v1, 2) : Math.pow(v1, v2);
  },

  str: (_, vars: VariablesYash): string => {
    return String(vars["1"]);
  },

  type: (_, vars: VariablesYash): string => {
    return Object.entries(vars)
      .slice(1)
      .map((a) => `${a[0]}: ${typeof a[1]}`)
      .join(", ");
  },

  tokens: (_, __, ___, tokens: Token[]): string => {
    return tokens.map(a => a.type.toString()).join(", ");
  },

  ast: (_, __, ast: AST): string => {
    return JSON.stringify(ast.toJSON());
  },
};

// For CLI usage, we can populate with process.argv if available
const getDefaultGlobalVariables = (): VariablesYash => {
  if (typeof process !== 'undefined' && process.argv) {
    return Object.fromEntries(process.argv.map((a, i) => [String(i), a]));
  }
  return {};
};

function undefined_to_null<T>(val: T) {
  if (typeof val === "undefined") return null;
  return val;
}

interface EvalParams<T = AST | undefined> {
  ast: T;
  bridge: Bridge;
  scoped_variables?: VariablesYash;
  tokens: Token[];
}

// Helper to get special variable values
function getSpecialVariable(name: string, bridge: Bridge, scoped_variables: VariablesYash): PrimitivesJS {
  switch (name) {
    case "@":
    case "*": {
      // All positional parameters (from $1 onwards)
      const allVars = { ...bridge.global_variables, ...scoped_variables };
      const positionalParams: PrimitivesJS[] = [];
      let i = 1;
      while (allVars[String(i)] !== undefined) {
        positionalParams.push(allVars[String(i)]);
        i++;
      }
      // $@ returns as space-separated string (in YASH, arrays not yet supported)
      return positionalParams.join(" ");
    }
    case "#": {
      // Number of positional parameters
      const allVars = { ...bridge.global_variables, ...scoped_variables };
      let count = 0;
      while (allVars[String(count + 1)] !== undefined) {
        count++;
      }
      return count;
    }
    case "?":
      // Exit status of last command (default to 0)
      return bridge.global_variables["?"] ?? 0;
    case "$":
      // Current process ID (use a dummy value for portability, or actual if available)
      if (typeof process !== "undefined" && process.pid) {
        return process.pid;
      }
      return 0;
    case "!":
      // PID of last background command
      return bridge.global_variables["!"] ?? 0;
    case "-":
      // Current shell options (not implemented, return empty)
      return "";
    default:
      return null;
  }
}

async function evalPrimitive({
  ast,
  bridge,
  scoped_variables = {},
}: EvalParams<Primitive>) {
  if (ast.type === TypeToken.Var) {
    const varName = ast.value as string;
    // Check for special variables first
    const specialVars = "@*#?$!-";
    if (specialVars.includes(varName)) {
      return getSpecialVariable(varName, bridge, scoped_variables);
    }
    
    const local = scoped_variables[varName];
    if (local === undefined) {
      return undefined_to_null(bridge.global_variables[varName]);
    }
    return local;
  } else {
    return undefined_to_null(ast.value);
  }
}

async function evalCommand({
  ast,
  bridge,
  scoped_variables = {},
}: EvalParams<Command>) {
  const func = await bridge.exec(
    ast.values.map((a) => {
      if (typeof a === "string" && a.startsWith("$")) {
        const local = scoped_variables[a.slice(1)];
        const glob = bridge.global_variables[a.slice(1)];
        return local !== undefined ? local : (glob !== undefined ? glob : "");
      }
      return a;
    })
  );

  return ast.piped
    ? undefined_to_null(func)
    : undefined_to_null(await bridge.out(func));
}

async function evalFunctionYASH({
  ast,
  bridge,
  scoped_variables = {},
  tokens,
}: EvalParams<Command>) {
  // Create a new scope for function arguments, inheriting from parent scope
  const variables: VariablesYash = { ...scoped_variables };
  const values = ast.values.map((a) => {
    if (typeof a === "string" && a.startsWith("$")) {
      const local = scoped_variables[a.slice(1)];
      const glob = bridge.global_variables[a.slice(1)];
      return local !== undefined ? local : (glob !== undefined ? glob : "");
    }
    return a;
  });
  for (const id in values) {
    variables[id] = values[id];
  }

  const glob_funcs = { ...global_functions, ...bridge.global_functions };
  const func = glob_funcs?.[ast.values?.[0]?.toString() || ""];
  return (await func(bridge, variables, ast, tokens)) as Promised<PrimitivesJS>;
}

async function evalFunction({
  ast,
  bridge,
  scoped_variables = {},
  tokens,
}: EvalParams<Command>) {
  const cmdName = ast.values[0]?.toString() ?? "";
  
  // Check user-defined functions first (they have priority over built-ins)
  const glob_funcs = { ...global_functions, ...bridge.global_functions };
  const func = glob_funcs[cmdName];
  if (func) {
    return evalFunctionYASH({ ast, bridge, tokens, scoped_variables });
  }
  
  // For built-ins, create a new scope with ONLY the command arguments
  // (not inheriting positional params from parent scope)
  const builtin = builtins[cmdName];
  if (builtin) {
    // Create variables with only the command arguments (not positional params from parent)
    const variables: VariablesYash = {};
    
    // Copy non-positional variables from scoped_variables (named variables, not positional params)
    for (const [key, value] of Object.entries(scoped_variables)) {
      // Skip positional parameters (numbers only)
      if (!/^\d+$/.test(key)) {
        variables[key] = value;
      }
    }
    
    // Resolve and add command arguments
    const values = ast.values.map((a) => {
      if (typeof a === "string" && a.startsWith("$")) {
        const local = scoped_variables[a.slice(1)];
        const glob = bridge.global_variables[a.slice(1)];
        return local !== undefined ? local : (glob !== undefined ? glob : "");
      }
      return a;
    });
    for (const id in values) {
      variables[id] = values[id];
    }
    
    try {
      const result = await builtin(bridge, variables, ast, tokens);
      return result;
    } catch (e: any) {
      // Handle special control flow exceptions
      if (e?.type === "EXIT" || e?.type === "RETURN" || e?.type === "BREAK" || e?.type === "CONTINUE") {
        throw e;
      }
      throw e;
    }
  }
  
  // Finally, try external command
  return evalCommand({ ast, bridge, tokens, scoped_variables });
}

async function evaluate({
  ast,
  bridge,
  scoped_variables = {},
  tokens,
}: EvalParams): Promise<PrimitivesJS> {
  if (ast instanceof Primitive) {
    return evalPrimitive({ ast, bridge, scoped_variables, tokens });
  }

  // Array access: $arr[index]
  if (ast instanceof ArrayAccess) {
    // Evaluate the index expression
    let indexValue: PrimitivesJS = null;
    for (const stmt of ast.indexBlock.parser.ASTs) {
      indexValue = await evaluate({
        ast: stmt,
        bridge,
        scoped_variables,
        tokens,
      });
    }
    
    // Get the array from variables
    const local = scoped_variables[ast.varName];
    const glob = bridge.global_variables[ast.varName];
    const arr = local !== undefined ? local : glob;
    
    if (Array.isArray(arr)) {
      const index = typeof indexValue === "number" ? indexValue : parseInt(String(indexValue));
      return arr[index] ?? null;
    }
    // If it's a string, allow character access
    if (typeof arr === "string" && typeof indexValue === "number") {
      return arr[indexValue] ?? null;
    }
    return null;
  }

  // Array literal: (1 2 3)
  if (ast instanceof ArrayLiteral) {
    const elements: PrimitivesJS[] = [];
    for (const stmt of ast.elements.ASTs) {
      const value = await evaluate({
        ast: stmt,
        bridge,
        scoped_variables,
        tokens,
      });
      elements.push(value);
    }
    return elements as any; // Return as array
  }

  if (ast instanceof Command) {
    return evalFunction({ ast, bridge, scoped_variables, tokens });
  }
  if (ast instanceof Unary) {
    // Background operator - run asynchronously without waiting
    if (ast.type === TypeToken.Ampersand) {
      // Fire and forget - don't await
      evaluate({ ast: ast.right, bridge, scoped_variables, tokens }).catch((e) => {
        bridge.err("Background job error:", e);
      });
      return null;
    }
    if (operators[ast.type]) {
      return undefined_to_null(
        operators[ast.type]?.(
          await evaluate({ ast: ast.right, bridge, scoped_variables, tokens })
        )
      );
    }
  }
  if (ast instanceof Binary) {
    if (ast.type === TypeToken.Assignement) {
      if (
        ast.left?.type !== TypeToken.Var &&
        ast.left?.type !== TypeToken.Argument
      )
        throw "error eq";
      const value = await evaluate({
        ast: ast.right,
        bridge,
        scoped_variables,
        tokens,
      });
      const o = ast.left;
      const varName = (o instanceof Primitive
          ? o.value
          : (o as Command).values.join("_")) as string;
      scoped_variables[varName] = value;
      return null;
    } else if (ast.type === TypeToken.Pipe || ast.type === TypeToken.PipeOut) {
      // Pipe: evaluate left, pass result to right via $_ variable
      const leftResult = await evaluate({ ast: ast.left, bridge, scoped_variables, tokens });
      
      // Check if right side is a simple filename (for file redirection)
      // Pattern: "content" |> filename  or  command |> filename
      if (ast.right instanceof Command && ast.right.values.length === 1) {
        const filename = String(ast.right.values[0]);
        // If the filename looks like a path or simple name (not a known command)
        // and we have a filesystem, write to file
        const sysBridge = bridge as any;
        if (sysBridge.fs && !bridge.global_functions[filename] && !builtins[filename]) {
          try {
            const content = leftResult !== null && leftResult !== undefined ? String(leftResult) : "";
            const filepath = filename.startsWith("/") ? filename : `${sysBridge.cwd || "/"}/${filename}`;
            await sysBridge.fs.writeFile(filepath, content + "\n");
            return null;
          } catch (e: any) {
            await bridge.err(`redirect: cannot write to '${filename}': ${e.message}`);
            return 1;
          }
        }
      }
      
      // Normal pipe: pass result to right via $_ variable
      const pipedScope = { ...scoped_variables, "_": leftResult };
      return await evaluate({ ast: ast.right, bridge, scoped_variables: pipedScope, tokens });
    } else if (ast.type === TypeToken.PipeAppend) {
      // Append to file: evaluate left, append result to file on right
      const leftResult = await evaluate({ ast: ast.left, bridge, scoped_variables, tokens });
      
      // Right side should be a filename
      if (ast.right instanceof Command && ast.right.values.length === 1) {
        const filename = String(ast.right.values[0]);
        const sysBridge = bridge as any;
        if (sysBridge.fs) {
          try {
            const content = leftResult !== null && leftResult !== undefined ? String(leftResult) : "";
            const filepath = filename.startsWith("/") ? filename : `${sysBridge.cwd || "/"}/${filename}`;
            await sysBridge.fs.appendFile(filepath, content + "\n");
            return null;
          } catch (e: any) {
            await bridge.err(`redirect: cannot append to '${filename}': ${e.message}`);
            return 1;
          }
        }
      }
      await bridge.err(`>>: invalid file operand`);
      return 1;
    } else if (ast.type === TypeToken.PipeIn) {
      // Reverse pipe: evaluate right first, pass result to left via $_ variable
      const rightResult = await evaluate({ ast: ast.right, bridge, scoped_variables, tokens });
      const pipedScope = { ...scoped_variables, "_": rightResult };
      return await evaluate({ ast: ast.left, bridge, scoped_variables: pipedScope, tokens });
    } else if (operators[ast.type]) {
      return undefined_to_null(
        operators[ast.type]?.(
          await evaluate({ ast: ast.left, bridge, scoped_variables, tokens }),
          await evaluate({ ast: ast.right, bridge, scoped_variables, tokens })
        )
      );
    }
  }

  if (ast instanceof If) {
    let vals: PrimitivesJS = null;
    for (const condition of ast.condition.parser.ASTs) {
      vals = await evaluate({
        ast: condition,
        bridge,
        scoped_variables,
        tokens,
      });
    }
    // Convert to boolean: false, null, 0, "" are falsy; everything else is truthy
    const isTruthy = vals !== false && vals !== null && vals !== 0 && vals !== "";
    if (isTruthy) {
      vals = null;
      for (const returns of ast.block.parser.ASTs) {
        vals = await evaluate({
          ast: returns,
          bridge,
          scoped_variables,
          tokens,
        });
      }
      return undefined_to_null(vals);
    } else if (ast.continue && !vals) {
      return undefined_to_null(
        await evaluate({
          ast: ast.continue,
          bridge,
          scoped_variables,
          tokens,
        })
      );
    }
  }

  if (ast instanceof Else) {
    let vals: PrimitivesJS = null;
    for (const returns of ast.block.parser.ASTs) {
      vals = await evaluate({ ast: returns, bridge, scoped_variables, tokens });
    }
    return undefined_to_null(vals);
  }

  if (ast instanceof Functions) {
    bridge.global_functions[ast.name as string] = async (funcBridge, vars) => {
      let vals = null;
      for (const parsed of ast.block.parser.ASTs) {
        vals = await evaluate({
          ast: parsed,
          bridge: funcBridge,
          scoped_variables: vars,
          tokens,
        });
      }
      return vals;
    };
    return null;
  }

  // While loop: execute block while condition is truthy
  if (ast instanceof While) {
    let result: PrimitivesJS = null;
    const isUntil = ast instanceof Until;
    
    while (true) {
      // Evaluate condition
      let conditionResult: PrimitivesJS = null;
      for (const condition of ast.condition.parser.ASTs) {
        conditionResult = await evaluate({
          ast: condition,
          bridge,
          scoped_variables,
          tokens,
        });
      }
      
      // Check if we should continue
      const isTruthy = conditionResult !== false && conditionResult !== null && conditionResult !== 0 && conditionResult !== "";
      
      // For 'while': continue if truthy
      // For 'until': continue if falsy (until it becomes truthy)
      if (isUntil ? isTruthy : !isTruthy) {
        break;
      }
      
      // Execute block
      for (const stmt of ast.block.parser.ASTs) {
        result = await evaluate({
          ast: stmt,
          bridge,
          scoped_variables,
          tokens,
        });
      }
    }
    
    return result;
  }

  // For loop: iterate over values
  if (ast instanceof For) {
    let result: PrimitivesJS = null;
    
    // Get the values from tokens - each token is a value to iterate over
    const valuesToIterate: PrimitivesJS[] = [];
    for (const token of ast.valueTokens) {
      // Convert token to value
      if (token.type === TypeToken.Var) {
        const local = scoped_variables[token.value as string];
        const glob = bridge.global_variables[token.value as string];
        valuesToIterate.push(local !== undefined ? local : (glob !== undefined ? glob : null));
      } else if (token.type === TypeToken.Number) {
        valuesToIterate.push(token.value as number);
      } else if (token.type === TypeToken.Text) {
        valuesToIterate.push(token.value as string);
      } else if (token.type === TypeToken.Bool) {
        valuesToIterate.push(token.value as boolean);
      } else if (token.type === TypeToken.Argument) {
        valuesToIterate.push(token.value as string);
      }
      // Skip newlines and other non-value tokens
    }
    
    // Iterate over each value
    for (const value of valuesToIterate) {
      // Set the loop variable
      scoped_variables[ast.varName] = value;
      
      // Execute block
      for (const stmt of ast.block.parser.ASTs) {
        result = await evaluate({
          ast: stmt,
          bridge,
          scoped_variables,
          tokens,
        });
      }
    }
    
    return result;
  }

  // Local variable declaration - only sets in scoped_variables, not global
  if (ast instanceof Local) {
    let value: PrimitivesJS = null;
    
    if (ast.valueBlock) {
      // Evaluate the value expression
      for (const stmt of ast.valueBlock.parser.ASTs) {
        value = await evaluate({
          ast: stmt,
          bridge,
          scoped_variables,
          tokens,
        });
      }
    }
    
    // Set in scoped_variables only (not global)
    scoped_variables[ast.varName] = value;
    return null;
  }

  return null;
}

export { evaluate, global_functions, getDefaultGlobalVariables };
