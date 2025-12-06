/**
 * Shell built-in commands for YASH
 * These are commands that are executed directly by the shell,
 * not as external programs.
 */

import type { Bridge, FunctionsYash, PrimitivesJS, VariablesYash } from "../types";

/**
 * echo - display a line of text
 * Supports:
 *   -n    do not output the trailing newline
 *   -e    enable interpretation of backslash escapes
 *   -E    disable interpretation of backslash escapes (default)
 */
async function echo(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  const args: PrimitivesJS[] = [];
  let noNewline = false;
  let interpretEscapes = false;
  let i = 1;

  // Parse options
  while (vars[String(i)] !== undefined) {
    const arg = vars[String(i)];
    if (typeof arg === "string" && arg.startsWith("-") && args.length === 0) {
      if (arg === "-n") {
        noNewline = true;
        i++;
        continue;
      } else if (arg === "-e") {
        interpretEscapes = true;
        i++;
        continue;
      } else if (arg === "-E") {
        interpretEscapes = false;
        i++;
        continue;
      } else if (arg === "-ne" || arg === "-en") {
        noNewline = true;
        interpretEscapes = true;
        i++;
        continue;
      }
    }
    args.push(arg);
    i++;
  }

  let output = args.map(a => String(a ?? "")).join(" ");

  // Interpret escape sequences if -e is set
  if (interpretEscapes) {
    output = output
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\a/g, "\x07")
      .replace(/\\b/g, "\b")
      .replace(/\\f/g, "\f")
      .replace(/\\v/g, "\v")
      .replace(/\\\\/g, "\\");
  }

  // Output to bridge
  await bridge.out(output);

  return output;
}

/**
 * printf - format and print data
 * Basic implementation supporting %s, %d, %f, %x, %o, %%
 */
async function printf(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  const format = String(vars["1"] ?? "");
  let argIndex = 2;
  
  const result = format.replace(/%([sdxof%])/g, (match, specifier) => {
    if (specifier === "%") return "%";
    
    const arg = vars[String(argIndex++)];
    
    switch (specifier) {
      case "s":
        return String(arg ?? "");
      case "d":
        return String(parseInt(String(arg)) || 0);
      case "f":
        return String(parseFloat(String(arg)) || 0);
      case "x":
        return (parseInt(String(arg)) || 0).toString(16);
      case "o":
        return (parseInt(String(arg)) || 0).toString(8);
      default:
        return match;
    }
  });

  // Handle \n, \t escape sequences in format string
  const output = result
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");

  // Output to bridge
  await bridge.out(output);

  return output;
}

/**
 * true - do nothing, successfully
 * Returns 0 (success)
 */
function trueCmd(_bridge: Bridge, _vars: VariablesYash): PrimitivesJS {
  return 0;
}

/**
 * false - do nothing, unsuccessfully
 * Returns 1 (failure)
 */
function falseCmd(_bridge: Bridge, _vars: VariablesYash): PrimitivesJS {
  return 1;
}

/**
 * pwd - print name of current/working directory
 * Returns current working directory from bridge or process.cwd()
 */
function pwd(bridge: Bridge, _vars: VariablesYash): PrimitivesJS {
  // Check if bridge has a cwd property
  if ((bridge as any).cwd) {
    return (bridge as any).cwd;
  }
  // Fallback to process.cwd() if available
  if (typeof process !== "undefined" && process.cwd) {
    return process.cwd();
  }
  return "/";
}

/**
 * cd - change the shell working directory
 * Usage: cd [dir]
 * If no dir is given, changes to HOME
 */
function cd(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  const dir = vars["1"];
  const targetDir = dir !== undefined ? String(dir) : (bridge.global_variables["HOME"] as string ?? "/");
  
  // Update bridge's cwd if it exists
  if ((bridge as any).setCwd) {
    (bridge as any).setCwd(targetDir);
  }
  // Also update PWD variable
  bridge.global_variables["PWD"] = targetDir;
  bridge.global_variables["OLDPWD"] = (bridge as any).cwd ?? "/";
  
  return null;
}

/**
 * exit - cause the shell to exit
 * Usage: exit [n]
 * Exit with status n, or 0 if n is omitted
 */
function exit(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  const status = vars["1"] !== undefined ? parseInt(String(vars["1"])) : 0;
  
  // Set exit status
  bridge.global_variables["?"] = status;
  
  // If running in Node/Bun, we could actually exit
  // For web usage, we just return the status
  if (typeof process !== "undefined" && process.exit) {
    process.exit(status);
  }
  
  // For web/embedded usage, throw a special error that can be caught
  throw { type: "EXIT", status };
}

/**
 * export - set environment variables
 * Usage: export NAME=VALUE or export NAME
 * Also handles the case where the parser splits NAME=VALUE into separate tokens
 * Note: When called with just a name, it copies the value from scoped vars to global vars
 */
function exportCmd(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  let i = 1;
  while (vars[String(i)] !== undefined) {
    const arg = String(vars[String(i)]);
    const eqIndex = arg.indexOf("=");
    
    if (eqIndex !== -1) {
      // Case: NAME=VALUE in single argument
      const name = arg.substring(0, eqIndex);
      const value = arg.substring(eqIndex + 1);
      bridge.global_variables[name] = value;
      i++;
    } else if (vars[String(i + 1)] === "=" && vars[String(i + 2)] !== undefined) {
      // Case: NAME = VALUE split into separate arguments
      const name = arg;
      const value = vars[String(i + 2)];
      bridge.global_variables[name] = value;
      i += 3; // Skip NAME, =, VALUE
    } else {
      // Just a name - copy from current scope to global
      // vars already contains scoped_variables values
      const currentValue = vars[arg];
      if (currentValue !== undefined) {
        bridge.global_variables[arg] = currentValue;
      } else if (bridge.global_variables[arg] === undefined) {
        bridge.global_variables[arg] = "";
      }
      i++;
    }
  }
  return null;
}

/**
 * unset - unset values and attributes of shell variables
 * Usage: unset NAME...
 */
function unset(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  let i = 1;
  while (vars[String(i)] !== undefined) {
    const name = String(vars[String(i)]);
    delete bridge.global_variables[name];
    delete bridge.global_functions[name];
    i++;
  }
  return null;
}

/**
 * set - set or unset values of shell options and positional parameters
 * Basic implementation
 */
function set(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  // If no arguments, list all variables (simplified)
  if (vars["1"] === undefined) {
    return Object.entries(bridge.global_variables)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join("\n");
  }
  
  // Set positional parameters
  let i = 1;
  let pos = 1;
  while (vars[String(i)] !== undefined) {
    bridge.global_variables[String(pos)] = vars[String(i)];
    i++;
    pos++;
  }
  return null;
}

/**
 * shift - shift positional parameters
 * Usage: shift [n]
 * Shift positional parameters by n (default 1)
 */
function shift(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  const n = vars["1"] !== undefined ? parseInt(String(vars["1"])) : 1;
  
  // Gather all positional parameters
  const params: PrimitivesJS[] = [];
  let i = 1;
  while (bridge.global_variables[String(i)] !== undefined) {
    params.push(bridge.global_variables[String(i)] as PrimitivesJS);
    i++;
  }
  
  // Remove first n parameters
  const shifted = params.slice(n);
  
  // Clear all positional parameters
  for (let j = 1; j < i; j++) {
    delete bridge.global_variables[String(j)];
  }
  
  // Set new positional parameters
  shifted.forEach((val, idx) => {
    bridge.global_variables[String(idx + 1)] = val;
  });
  
  return null;
}

/**
 * test / [ - evaluate conditional expression
 * Supports: -z, -n, -f, -d, -e, -r, -w, -x, =, !=, -eq, -ne, -lt, -le, -gt, -ge
 * Sets $? to 0 (true) or 1 (false)
 */
async function test(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  const args: string[] = [];
  let i = 1;
  while (vars[String(i)] !== undefined) {
    const arg = vars[String(i)];
    // Skip trailing ] for [ command
    if (arg === "]") break;
    args.push(String(arg ?? ""));
    i++;
  }

  let result = 1; // default to false

  if (args.length === 0) {
    result = 1; // false
  } else if (args.length === 1) {
    // Single argument: true if non-empty string
    result = args[0].length > 0 ? 0 : 1;
  } else if (args.length === 2) {
    // Two arguments: unary operators
    const [op, val] = args;
    switch (op) {
      case "-z": result = val.length === 0 ? 0 : 1; break;
      case "-n": result = val.length > 0 ? 0 : 1; break;
      case "!": result = val ? 1 : 0; break;
      // File tests - use filesystem if available
      case "-e":
      case "-f":
      case "-d":
      case "-r":
      case "-w":
      case "-x":
        if ((bridge as any).fs) {
          try {
            const stat = await (bridge as any).fs.stat(val);
            if (op === "-e") result = 0; // exists
            else if (op === "-f") result = stat.isFile() ? 0 : 1;
            else if (op === "-d") result = stat.isDirectory() ? 0 : 1;
            else if (op === "-r") result = (stat.mode & 0o444) ? 0 : 1;
            else if (op === "-w") result = (stat.mode & 0o222) ? 0 : 1;
            else if (op === "-x") result = (stat.mode & 0o111) ? 0 : 1;
          } catch {
            result = 1; // file doesn't exist
          }
        } else {
          result = 1; // no filesystem, assume false
        }
        break;
    }
  } else if (args.length === 3) {
    // Three arguments: binary operators
    const [left, op, right] = args;
    switch (op) {
      case "=":
      case "==":
        result = left === right ? 0 : 1; break;
      case "!=":
        result = left !== right ? 0 : 1; break;
      case "-eq":
        result = parseInt(left) === parseInt(right) ? 0 : 1; break;
      case "-ne":
        result = parseInt(left) !== parseInt(right) ? 0 : 1; break;
      case "-lt":
        result = parseInt(left) < parseInt(right) ? 0 : 1; break;
      case "-le":
        result = parseInt(left) <= parseInt(right) ? 0 : 1; break;
      case "-gt":
        result = parseInt(left) > parseInt(right) ? 0 : 1; break;
      case "-ge":
        result = parseInt(left) >= parseInt(right) ? 0 : 1; break;
    }
  }

  // Set exit status
  bridge.global_variables["?"] = result;
  
  return result;
}

/**
 * return - return from a shell function
 * Usage: return [n]
 */
function returnCmd(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  const status = vars["1"] !== undefined ? parseInt(String(vars["1"])) : 0;
  bridge.global_variables["?"] = status;
  throw { type: "RETURN", status };
}

/**
 * break - exit from a loop
 * Usage: break [n]
 */
function breakCmd(_bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  const n = vars["1"] !== undefined ? parseInt(String(vars["1"])) : 1;
  throw { type: "BREAK", levels: n };
}

/**
 * continue - resume the next iteration of a loop
 * Usage: continue [n]
 */
function continueCmd(_bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  const n = vars["1"] !== undefined ? parseInt(String(vars["1"])) : 1;
  throw { type: "CONTINUE", levels: n };
}

/**
 * read - read a line from standard input
 * Usage: read [-p prompt] [-s] [-n count] [-t timeout] [name...]
 * For web/virtual environments, this is async and may need special handling
 */
async function read(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  const args: string[] = [];
  let prompt = "";
  let silent = false;
  let count: number | null = null;
  let timeout: number | null = null;
  let i = 1;

  // Parse options
  while (vars[String(i)] !== undefined) {
    const arg = String(vars[String(i)]);
    if (arg === "-p" && vars[String(i + 1)] !== undefined) {
      prompt = String(vars[String(i + 1)]);
      i += 2;
      continue;
    } else if (arg === "-s") {
      silent = true;
      i++;
      continue;
    } else if (arg === "-n" && vars[String(i + 1)] !== undefined) {
      count = parseInt(String(vars[String(i + 1)]));
      i += 2;
      continue;
    } else if (arg === "-t" && vars[String(i + 1)] !== undefined) {
      timeout = parseInt(String(vars[String(i + 1)]));
      i += 2;
      continue;
    } else if (!arg.startsWith("-")) {
      args.push(arg);
    }
    i++;
  }

  // Variable name(s) to read into (default: REPLY)
  const varNames = args.length > 0 ? args : ["REPLY"];

  // Display prompt if any
  if (prompt) {
    await bridge.out(prompt);
  }

  // If bridge has a readLine method (for terminal input)
  if ((bridge as any).terminal?.readLine) {
    try {
      const input = await (bridge as any).terminal.readLine({ silent, timeout });
      
      if (input === null) {
        bridge.global_variables["?"] = 1;
        return 1;
      }

      // Split input into words and assign to variables
      const words = input.trim().split(/\s+/);
      
      if (varNames.length === 1) {
        // Single variable gets entire line
        bridge.global_variables[varNames[0]] = input.trim();
      } else {
        // Multiple variables: first N-1 get one word each, last gets remainder
        for (let j = 0; j < varNames.length; j++) {
          if (j === varNames.length - 1) {
            // Last variable gets the rest
            bridge.global_variables[varNames[j]] = words.slice(j).join(" ");
          } else {
            bridge.global_variables[varNames[j]] = words[j] ?? "";
          }
        }
      }

      bridge.global_variables["?"] = 0;
      return 0;
    } catch (e) {
      bridge.global_variables["?"] = 1;
      return 1;
    }
  }

  // Fallback: if no terminal, just set empty values
  for (const name of varNames) {
    bridge.global_variables[name] = "";
  }
  bridge.global_variables["?"] = 1;
  return 1;
}

/**
 * source / . - execute commands from a file in the current shell
 * Usage: source filename [arguments]
 * Note: Requires filesystem access via bridge
 */
async function source(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  const filename = vars["1"];
  
  if (filename === undefined) {
    await bridge.err("source: filename argument required");
    bridge.global_variables["?"] = 1;
    return 1;
  }

  const filepath = String(filename);

  // Check if bridge has filesystem access
  if (!(bridge as any).fs) {
    await bridge.err(`source: ${filepath}: no filesystem available`);
    bridge.global_variables["?"] = 1;
    return 1;
  }

  try {
    // Read the file content
    const content = await (bridge as any).fs.readFile(filepath, "utf-8");
    
    // Set positional parameters for the sourced script
    const savedParams: VariablesYash = {};
    let paramIdx = 1;
    while (bridge.global_variables[String(paramIdx)] !== undefined) {
      savedParams[String(paramIdx)] = bridge.global_variables[String(paramIdx)];
      delete bridge.global_variables[String(paramIdx)];
      paramIdx++;
    }

    // Set new positional parameters
    let argIdx = 2;
    let newParamIdx = 1;
    while (vars[String(argIdx)] !== undefined) {
      bridge.global_variables[String(newParamIdx)] = vars[String(argIdx)];
      argIdx++;
      newParamIdx++;
    }

    // Execute the file content - this requires the runner
    // For now, we'll expose a hook that can be set
    if ((bridge as any).execute) {
      await (bridge as any).execute(content);
    } else {
      // Fallback: just return the content (not executed)
      await bridge.err(`source: cannot execute ${filepath} (no execute hook)`);
      bridge.global_variables["?"] = 1;
      return 1;
    }

    // Restore positional parameters
    paramIdx = 1;
    while (bridge.global_variables[String(paramIdx)] !== undefined) {
      delete bridge.global_variables[String(paramIdx)];
      paramIdx++;
    }
    for (const [key, value] of Object.entries(savedParams)) {
      bridge.global_variables[key] = value;
    }

    bridge.global_variables["?"] = 0;
    return 0;
  } catch (e: any) {
    await bridge.err(`source: ${filepath}: ${e.message ?? "error reading file"}`);
    bridge.global_variables["?"] = 1;
    return 1;
  }
}

/**
 * eval - execute arguments as a shell command
 * Usage: eval [arg ...]
 */
async function evalCmd(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  // Concatenate all arguments
  const args: string[] = [];
  let i = 1;
  while (vars[String(i)] !== undefined) {
    args.push(String(vars[String(i)]));
    i++;
  }

  const command = args.join(" ");

  if (!command) {
    return 0;
  }

  // Execute the command - requires execute hook
  if ((bridge as any).execute) {
    try {
      await (bridge as any).execute(command);
      return bridge.global_variables["?"] ?? 0;
    } catch (e: any) {
      if (e?.type === "EXIT" || e?.type === "RETURN") {
        throw e;
      }
      await bridge.err(`eval: ${e.message ?? "error"}`);
      bridge.global_variables["?"] = 1;
      return 1;
    }
  }

  // Fallback: just return 0
  return 0;
}

/**
 * let - evaluate arithmetic expressions
 * Usage: let expression [expression ...]
 * Returns 0 if last expression is non-zero, 1 if zero
 */
function letCmd(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  let lastResult = 0;
  let i = 1;

  while (vars[String(i)] !== undefined) {
    let expr = String(vars[String(i)]);
    // Remove surrounding quotes if present (from parser)
    if ((expr.startsWith('"') && expr.endsWith('"')) || 
        (expr.startsWith("'") && expr.endsWith("'"))) {
      expr = expr.slice(1, -1);
    }
    
    // Parse and evaluate arithmetic expression
    // Support: var=expr, var++, var--, ++var, --var, var+=n, var-=n, etc.
    
    // Handle assignment
    const assignMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([\+\-\*\/\%]?)=\s*(.+)$/);
    if (assignMatch) {
      const [, varName, op, valueExpr] = assignMatch;
      let value = evaluateArithExpr(valueExpr, bridge.global_variables);
      
      if (op) {
        const currentVal = parseInt(String(bridge.global_variables[varName] ?? 0));
        switch (op) {
          case "+": value = currentVal + value; break;
          case "-": value = currentVal - value; break;
          case "*": value = currentVal * value; break;
          case "/": value = Math.floor(currentVal / value); break;
          case "%": value = currentVal % value; break;
        }
      }
      
      bridge.global_variables[varName] = value;
      lastResult = value;
    }
    // Handle pre-increment
    else if (expr.match(/^\+\+([a-zA-Z_][a-zA-Z0-9_]*)$/)) {
      const varName = expr.slice(2);
      const newVal = parseInt(String(bridge.global_variables[varName] ?? 0)) + 1;
      bridge.global_variables[varName] = newVal;
      lastResult = newVal;
    }
    // Handle post-increment
    else if (expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\+\+$/)) {
      const varName = expr.slice(0, -2);
      const oldVal = parseInt(String(bridge.global_variables[varName] ?? 0));
      bridge.global_variables[varName] = oldVal + 1;
      lastResult = oldVal;
    }
    // Handle pre-decrement
    else if (expr.match(/^--([a-zA-Z_][a-zA-Z0-9_]*)$/)) {
      const varName = expr.slice(2);
      const newVal = parseInt(String(bridge.global_variables[varName] ?? 0)) - 1;
      bridge.global_variables[varName] = newVal;
      lastResult = newVal;
    }
    // Handle post-decrement
    else if (expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)--$/)) {
      const varName = expr.slice(0, -2);
      const oldVal = parseInt(String(bridge.global_variables[varName] ?? 0));
      bridge.global_variables[varName] = oldVal - 1;
      lastResult = oldVal;
    }
    // Just evaluate the expression
    else {
      lastResult = evaluateArithExpr(expr, bridge.global_variables);
    }

    i++;
  }

  // Return 0 if last result is non-zero, 1 if zero
  const exitStatus = lastResult !== 0 ? 0 : 1;
  bridge.global_variables["?"] = exitStatus;
  return exitStatus;
}

/**
 * Helper function to evaluate simple arithmetic expressions
 */
function evaluateArithExpr(expr: string, vars: VariablesYash): number {
  // Replace variable references
  let processed = expr.replace(/\$?([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
    if (match.startsWith("$")) {
      varName = match.slice(1);
    }
    const val = vars[varName];
    return String(parseInt(String(val ?? 0)));
  });

  // Evaluate using a simple parser (for safety, avoid eval())
  try {
    // Support basic operations: +, -, *, /, %, (, )
    // This is a simplified implementation
    processed = processed.replace(/\s+/g, "");
    
    // Simple recursive descent parser
    return parseAddSub(processed, { pos: 0 });
  } catch {
    return 0;
  }
}

function parseAddSub(expr: string, ctx: { pos: number }): number {
  let left = parseMulDiv(expr, ctx);
  
  while (ctx.pos < expr.length) {
    const op = expr[ctx.pos];
    if (op !== "+" && op !== "-") break;
    ctx.pos++;
    const right = parseMulDiv(expr, ctx);
    left = op === "+" ? left + right : left - right;
  }
  
  return left;
}

function parseMulDiv(expr: string, ctx: { pos: number }): number {
  let left = parsePrimary(expr, ctx);
  
  while (ctx.pos < expr.length) {
    const op = expr[ctx.pos];
    if (op !== "*" && op !== "/" && op !== "%") break;
    ctx.pos++;
    const right = parsePrimary(expr, ctx);
    if (op === "*") left = left * right;
    else if (op === "/") left = Math.floor(left / right);
    else left = left % right;
  }
  
  return left;
}

function parsePrimary(expr: string, ctx: { pos: number }): number {
  // Handle negative numbers
  if (expr[ctx.pos] === "-") {
    ctx.pos++;
    return -parsePrimary(expr, ctx);
  }
  
  // Handle parentheses
  if (expr[ctx.pos] === "(") {
    ctx.pos++;
    const result = parseAddSub(expr, ctx);
    if (expr[ctx.pos] === ")") ctx.pos++;
    return result;
  }
  
  // Parse number
  let numStr = "";
  while (ctx.pos < expr.length && /[0-9]/.test(expr[ctx.pos])) {
    numStr += expr[ctx.pos++];
  }
  
  return parseInt(numStr) || 0;
}

/**
 * declare / typeset - declare variables and give them attributes
 * Usage: declare [-aAfFgilnrtux] [-p] [name[=value] ...]
 * Basic implementation supporting -i (integer), -r (readonly), -x (export)
 */
function declare(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  let isInteger = false;
  let isReadonly = false;
  let isExport = false;
  let printAll = false;
  const names: string[] = [];
  let i = 1;

  while (vars[String(i)] !== undefined) {
    let arg = String(vars[String(i)]);
    // Remove surrounding quotes if present (from parser)
    if ((arg.startsWith('"') && arg.endsWith('"')) || 
        (arg.startsWith("'") && arg.endsWith("'"))) {
      arg = arg.slice(1, -1);
    }
    
    if (arg.startsWith("-")) {
      for (const char of arg.slice(1)) {
        switch (char) {
          case "i": isInteger = true; break;
          case "r": isReadonly = true; break;
          case "x": isExport = true; break;
          case "p": printAll = true; break;
        }
      }
    } else {
      names.push(arg);
    }
    i++;
  }

  if (printAll && names.length === 0) {
    // Print all declared variables
    return Object.entries(bridge.global_variables)
      .map(([k, v]) => `declare -- ${k}="${v}"`)
      .join("\n");
  }

  for (const name of names) {
    const eqIndex = name.indexOf("=");
    let varName: string;
    let value: PrimitivesJS;

    if (eqIndex !== -1) {
      varName = name.substring(0, eqIndex);
      value = name.substring(eqIndex + 1);
    } else {
      varName = name;
      value = bridge.global_variables[varName] ?? "";
    }

    if (isInteger) {
      value = parseInt(String(value)) || 0;
    }

    bridge.global_variables[varName] = value;

    // Store metadata (simplified - just use a naming convention)
    if (isReadonly) {
      (bridge as any)._readonly = (bridge as any)._readonly || new Set();
      (bridge as any)._readonly.add(varName);
    }
    if (isExport) {
      (bridge as any)._exported = (bridge as any)._exported || new Set();
      (bridge as any)._exported.add(varName);
    }
  }

  return null;
}

/**
 * readonly - mark variables as read-only
 * Usage: readonly [-p] [name[=value] ...]
 */
function readonly(bridge: Bridge, vars: VariablesYash): PrimitivesJS {
  let printAll = false;
  const names: string[] = [];
  let i = 1;

  while (vars[String(i)] !== undefined) {
    let arg = String(vars[String(i)]);
    // Remove surrounding quotes if present (from parser)
    if ((arg.startsWith('"') && arg.endsWith('"')) || 
        (arg.startsWith("'") && arg.endsWith("'"))) {
      arg = arg.slice(1, -1);
    }
    
    if (arg === "-p") {
      printAll = true;
    } else {
      names.push(arg);
    }
    i++;
  }

  if (printAll && names.length === 0) {
    const readonlySet = (bridge as any)._readonly as Set<string> | undefined;
    if (readonlySet) {
      return Array.from(readonlySet)
        .map(k => `readonly ${k}="${bridge.global_variables[k] ?? ""}"`)
        .join("\n");
    }
    return "";
  }

  (bridge as any)._readonly = (bridge as any)._readonly || new Set();

  for (const name of names) {
    const eqIndex = name.indexOf("=");
    let varName: string;
    let value: PrimitivesJS;

    if (eqIndex !== -1) {
      varName = name.substring(0, eqIndex);
      value = name.substring(eqIndex + 1);
      bridge.global_variables[varName] = value;
    } else {
      varName = name;
    }

    (bridge as any)._readonly.add(varName);
  }

  return null;
}

/**
 * local - declare local variables in a function
 * Usage: local [name[=value] ...]
 * Note: Actual scoping is handled by the evaluator
 */
function local(_bridge: Bridge, _vars: VariablesYash): PrimitivesJS {
  // Local variables are handled by the parser/evaluator
  // This builtin is a no-op but recognized
  return null;
}

/**
 * exec - replace the shell with the given command
 * Usage: exec [-c] [-l] [-a name] [command [arguments]]
 * In a virtual environment, this just executes the command
 */
async function exec(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  const args: string[] = [];
  let clearEnv = false;
  let i = 1;

  // Parse options
  while (vars[String(i)] !== undefined) {
    const arg = String(vars[String(i)]);
    if (arg === "-c") {
      clearEnv = true;
      i++;
      continue;
    } else if (arg === "-l" || arg === "-a") {
      // -l: login shell, -a name: set argv[0]
      // These are mostly no-ops in virtual environment
      if (arg === "-a" && vars[String(i + 1)] !== undefined) {
        i += 2;
      } else {
        i++;
      }
      continue;
    } else if (!arg.startsWith("-")) {
      // Rest are command and arguments
      while (vars[String(i)] !== undefined) {
        args.push(String(vars[String(i)]));
        i++;
      }
      break;
    }
    i++;
  }

  // If no command, just return (exec with no args does nothing but can modify redirections)
  if (args.length === 0) {
    return null;
  }

  // Clear environment if -c was specified
  if (clearEnv) {
    const keysToDelete = Object.keys(bridge.global_variables).filter(k => !/^\d+$/.test(k) && k !== "?");
    for (const key of keysToDelete) {
      delete bridge.global_variables[key];
    }
  }

  // Execute the command - in virtual environment, we just run it
  if ((bridge as any).execute) {
    try {
      await (bridge as any).execute(args.join(" "));
      return bridge.global_variables["?"] ?? 0;
    } catch (e: any) {
      if (e?.type === "EXIT") {
        throw e;
      }
      await bridge.err(`exec: ${args[0]}: ${e.message ?? "execution failed"}`);
      bridge.global_variables["?"] = 127;
      return 127;
    }
  }

  // Fallback: try bridge.exec
  if (bridge.exec) {
    try {
      const result = await bridge.exec(args);
      return result;
    } catch (e: any) {
      await bridge.err(`exec: ${args[0]}: ${e.message ?? "not found"}`);
      bridge.global_variables["?"] = 127;
      return 127;
    }
  }

  await bridge.err(`exec: ${args[0]}: command not found`);
  bridge.global_variables["?"] = 127;
  return 127;
}

/**
 * trap - trap signals and execute commands
 * Usage: trap [-lp] [[arg] signal_spec ...]
 * Stores trap handlers in bridge._traps
 */
async function trap(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  // Initialize traps storage if not exists
  if (!(bridge as any)._traps) {
    (bridge as any)._traps = new Map<string, string>();
  }
  const traps = (bridge as any)._traps as Map<string, string>;

  let listSignals = false;
  let printTraps = false;
  const args: string[] = [];
  let i = 1;

  // Parse options
  while (vars[String(i)] !== undefined) {
    const arg = String(vars[String(i)]);
    if (arg === "-l") {
      listSignals = true;
      i++;
      continue;
    } else if (arg === "-p") {
      printTraps = true;
      i++;
      continue;
    } else if (!arg.startsWith("-")) {
      while (vars[String(i)] !== undefined) {
        args.push(String(vars[String(i)]));
        i++;
      }
      break;
    }
    i++;
  }

  // List all signals
  if (listSignals) {
    const signals = [
      "EXIT", "SIGHUP", "SIGINT", "SIGQUIT", "SIGILL", "SIGTRAP", "SIGABRT",
      "SIGBUS", "SIGFPE", "SIGKILL", "SIGUSR1", "SIGSEGV", "SIGUSR2", "SIGPIPE",
      "SIGALRM", "SIGTERM", "SIGSTKFLT", "SIGCHLD", "SIGCONT", "SIGSTOP",
      "SIGTSTP", "SIGTTIN", "SIGTTOU", "SIGURG", "SIGXCPU", "SIGXFSZ",
      "SIGVTALRM", "SIGPROF", "SIGWINCH", "SIGIO", "SIGPWR", "SIGSYS"
    ];
    await bridge.out(signals.join(" "));
    return 0;
  }

  // Print current traps
  if (printTraps || args.length === 0) {
    for (const [signal, handler] of traps) {
      await bridge.out(`trap -- '${handler}' ${signal}`);
    }
    return 0;
  }

  // Set traps
  if (args.length >= 1) {
    const handler = args[0];
    const signals = args.slice(1);

    // If handler is '-', reset to default
    // If handler is '', ignore signal
    // Otherwise, set handler

    for (const signal of signals.length > 0 ? signals : ["EXIT"]) {
      const normalizedSignal = signal.toUpperCase().replace(/^SIG/, "");
      if (handler === "-") {
        traps.delete(normalizedSignal);
      } else {
        traps.set(normalizedSignal, handler);
      }
    }
  }

  return 0;
}

/**
 * jobs - display status of jobs
 * Usage: jobs [-lnprs] [job_spec ...]
 * Lists background jobs (stored in bridge._jobs)
 */
async function jobs(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  // Initialize jobs storage if not exists
  if (!(bridge as any)._jobs) {
    (bridge as any)._jobs = new Map<number, { pid: number; status: string; command: string }>();
  }
  const jobsList = (bridge as any)._jobs as Map<number, { pid: number; status: string; command: string }>;

  let showPids = false;
  let i = 1;

  while (vars[String(i)] !== undefined) {
    const arg = String(vars[String(i)]);
    if (arg === "-l" || arg === "-p") {
      showPids = true;
    }
    i++;
  }

  if (jobsList.size === 0) {
    return 0;
  }

  let jobNum = 1;
  for (const [, job] of jobsList) {
    if (showPids) {
      await bridge.out(`[${jobNum}]  ${job.pid} ${job.status}    ${job.command}`);
    } else {
      await bridge.out(`[${jobNum}]  ${job.status}    ${job.command}`);
    }
    jobNum++;
  }

  return 0;
}

/**
 * fg - bring job to foreground
 * Usage: fg [job_spec]
 */
async function fg(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  // In a virtual environment, this is mostly a no-op
  // Real implementation would require actual process control
  const jobSpec = vars["1"];
  
  if (!(bridge as any)._jobs || (bridge as any)._jobs.size === 0) {
    await bridge.err("fg: no current job");
    return 1;
  }

  await bridge.out("fg: job control not fully implemented in virtual environment");
  return 0;
}

/**
 * bg - resume job in background
 * Usage: bg [job_spec ...]
 */
async function bg(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  // In a virtual environment, this is mostly a no-op
  const jobSpec = vars["1"];
  
  if (!(bridge as any)._jobs || (bridge as any)._jobs.size === 0) {
    await bridge.err("bg: no current job");
    return 1;
  }

  await bridge.out("bg: job control not fully implemented in virtual environment");
  return 0;
}

/**
 * wait - wait for job to complete
 * Usage: wait [-fn] [-p var] [id ...]
 * Returns immediately in virtual environment (no real background jobs)
 */
async function wait(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  // In a virtual environment, background jobs are simulated
  // Just return success
  bridge.global_variables["?"] = 0;
  return 0;
}

/**
 * disown - remove jobs from job table
 * Usage: disown [-ar] [-h] [jobspec ... | pid ...]
 */
async function disown(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  if (!(bridge as any)._jobs) {
    return 0;
  }
  
  const jobsList = (bridge as any)._jobs as Map<number, any>;
  let removeAll = false;
  let i = 1;

  while (vars[String(i)] !== undefined) {
    const arg = String(vars[String(i)]);
    if (arg === "-a" || arg === "-r") {
      removeAll = true;
    }
    i++;
  }

  if (removeAll) {
    jobsList.clear();
  }

  return 0;
}

/**
 * kill - send signal to process
 * Usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ...
 */
async function kill(bridge: Bridge, vars: VariablesYash): Promise<PrimitivesJS> {
  let signal = "TERM";
  const pids: number[] = [];
  let i = 1;

  while (vars[String(i)] !== undefined) {
    const arg = String(vars[String(i)]);
    
    if (arg === "-l" || arg === "-L") {
      // List signals
      const signals = ["HUP", "INT", "QUIT", "ILL", "TRAP", "ABRT", "BUS", "FPE", "KILL", "USR1"];
      await bridge.out(signals.join(" "));
      return 0;
    } else if (arg === "-s" && vars[String(i + 1)] !== undefined) {
      signal = String(vars[String(i + 1)]).toUpperCase();
      i += 2;
      continue;
    } else if (arg === "-n" && vars[String(i + 1)] !== undefined) {
      // Signal by number - convert to name (simplified)
      const sigNum = parseInt(String(vars[String(i + 1)]));
      const sigNames = ["", "HUP", "INT", "QUIT", "ILL", "TRAP", "ABRT", "BUS", "FPE", "KILL"];
      signal = sigNames[sigNum] ?? "TERM";
      i += 2;
      continue;
    } else if (arg.startsWith("-") && !arg.startsWith("--")) {
      // -SIGNAL format
      signal = arg.slice(1).toUpperCase();
      i++;
      continue;
    } else {
      // PID
      const pid = parseInt(arg);
      if (!isNaN(pid)) {
        pids.push(pid);
      }
    }
    i++;
  }

  // Try to kill processes using process manager
  if ((bridge as any).process) {
    for (const pid of pids) {
      try {
        await (bridge as any).process.kill(pid, signal);
      } catch (e: any) {
        await bridge.err(`kill: (${pid}) - ${e.message ?? "No such process"}`);
        bridge.global_variables["?"] = 1;
        return 1;
      }
    }
    bridge.global_variables["?"] = 0;
    return 0;
  }

  // No process manager
  if (pids.length > 0) {
    await bridge.err("kill: no process manager available");
    bridge.global_variables["?"] = 1;
    return 1;
  }

  return 0;
}

/**
 * All shell built-in commands
 */
const builtins: FunctionsYash = {
  echo,
  printf,
  true: trueCmd,
  false: falseCmd,
  pwd,
  cd,
  exit,
  export: exportCmd,
  unset,
  set,
  shift,
  test,
  "[": test,
  return: returnCmd,
  break: breakCmd,
  continue: continueCmd,
  // Input/Output
  read,
  source,
  ".": source,
  eval: evalCmd,
  // Arithmetic/Variables
  let: letCmd,
  declare,
  typeset: declare,
  readonly,
  local,
  // Process control
  exec,
  trap,
  // Job control
  jobs,
  fg,
  bg,
  wait,
  disown,
  kill,
};

export { builtins };
