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
import { Else, Functions, If } from "./parser/functions/keywords";

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

const global_variables: VariablesYash = {
  ...Object.fromEntries(process.argv.map((a, i) => [String(i), a])),
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

async function evalPrimitive({
  ast,
  bridge,
  scoped_variables = { ...global_variables, ...bridge.global_variables },
}: EvalParams<Primitive>) {
  if (ast.type === TypeToken.Var) {
    const local = scoped_variables[ast.value as any];
    if (local === undefined) {
      return undefined_to_null(bridge.global_variables[ast.value as any]);
    }
    return local;
  } else {
    return undefined_to_null(ast.value);
  }
}

async function evalCommand({
  ast,
  bridge,
  scoped_variables = { ...global_variables, ...bridge.global_variables },
}: EvalParams<Command>) {
  const func = await bridge.exec(
    ast.values.map((a) => {
      if (typeof a === "string" && a.startsWith("$")) {
        const glob = bridge.global_variables[a.slice(1)];
        const local = scoped_variables[a.slice(1)];
        return local === undefined ? (glob === undefined ? "" : glob) : local;
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
  scoped_variables = { ...global_variables, ...bridge.global_variables },
  tokens,
}: EvalParams<Command>) {
  const variables: VariablesYash = { ...scoped_variables };
  const values = ast.values.map((a) => {
    if (typeof a === "string" && a.startsWith("$")) {
      const glob = global_variables[a.slice(1)];
      const local = scoped_variables[a.slice(1)];
      return local === undefined ? (glob === undefined ? "" : glob) : local;
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
  scoped_variables = { ...global_variables, ...bridge.global_variables },
  tokens,
}: EvalParams<Command>) {
  const glob_funcs = { ...global_functions, ...bridge.global_functions };
  const func = ast.values[0] ? glob_funcs[ast.values[0].toString()] : undefined
  if (func) {
    return evalFunctionYASH({ ast, bridge, tokens, scoped_variables });
  } else {
    return evalCommand({ ast, bridge, tokens, scoped_variables });
  }
}

async function evaluate({
  ast,
  bridge,
  scoped_variables = { ...global_variables, ...bridge.global_variables },
  tokens,
}: EvalParams): Promise<PrimitivesJS> {
  if (ast instanceof Primitive) {
    return evalPrimitive({ ast, bridge, scoped_variables, tokens });
  }

  if (ast instanceof Command) {
    return evalFunction({ ast, bridge, scoped_variables, tokens });
  }
  if (ast instanceof Unary) {
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
      scoped_variables[
        (o instanceof Primitive
          ? o.value
          : (o as Command).values.join("_")) as any
      ] = value;
      return null;
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
    if (typeof vals !== "boolean") throw "bad if condition";
    if (vals) {
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
    global_functions[ast.name as string] = async (bridge, vars) => {
      let vals = null;
      for (const parsed of ast.block.parser.ASTs) {
        vals = await evaluate({
          ast: parsed,
          bridge,
          scoped_variables: vars,
          tokens,
        }); // vars
      }
      return vals;
    };
    return null;
  }

  return null;
}

export { evaluate };
