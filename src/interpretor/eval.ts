import type {
  AST,
  PrimitivesJS,
  FunctionsOperators,
  Bridge,
  Promised,
  VariablesYash,
  FunctionsYash,
} from "../types";
import { TypeToken } from "./lexer";
import { Binary, Command, PrimitivesParsed, Unary } from "./parser";
import { Else, Functions, If } from "./parser/keywords";

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
      throw "I got nothing in my braiiin !";
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
    throw "I got nothing in my braiiin <";
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
          (Math.random() * (!Number.isNaN(v2) ? v2 : v1)) +
            (!Number.isNaN(v1) ? v1 : 0)
        )
      : Math.random();
  },
  nbr: (_, vars: VariablesYash) => {
    return parseInt(String(vars["1"]));
  },

  str : (_, vars: VariablesYash) => {
    return String(vars["1"]);
  },
};

const global_variables: VariablesYash = Object.fromEntries(
  process.argv.map((a, i) => [String(i), a])
);

function undefined_to_null<T>(val: T) {
  if (typeof val === "undefined") return null;
  return val;
}
async function evaluate(
  objet: AST | undefined,
  bridge: Bridge,
  scoped_variables = { ...global_variables, ...bridge.global_variables }
): Promise<PrimitivesJS> {
  const glob_funcs = { ...global_functions, ...bridge.global_functions };
  if (objet instanceof PrimitivesParsed) {
    if (objet.type === TypeToken.Var) {
      const local = scoped_variables[objet.value as any];
      if (local === undefined) {
        return undefined_to_null(bridge.global_variables[objet.value as any]);
      }
      return local;
    } else {
      return undefined_to_null(objet.value);
    }
  }
  if (objet instanceof Command) {
    const func = glob_funcs?.[objet.values?.[0]];
    if (func !== undefined) {
      const variables: VariablesYash = { ...scoped_variables };
      const values = objet.values
        .map((a) => {
          if (a.startsWith("$")) {
            const glob = global_variables[a.slice(1)];
            const local = scoped_variables[a.slice(1)];
            return local === undefined
              ? glob === undefined
                ? ""
                : glob
              : local;
          }
          return a;
        })
        .map(String);
      for (const id in values) {
        variables[id] = values[id];
      }
      return (await func(bridge, variables)) as Promised<PrimitivesJS>;
    } else {
      const func = await bridge.exec(
        objet.values
          .map((a) => {
            if (a.startsWith("$")) {
              const glob = bridge.global_variables[a.slice(1)];
              const local = scoped_variables[a.slice(1)];
              return local === undefined
                ? glob === undefined
                  ? ""
                  : glob
                : local;
            }
            return a;
          })
          .map(String)
      );

      return objet.piped
        ? undefined_to_null(func)
        : undefined_to_null(await bridge.out(func));
    }
  }
  if (objet instanceof Unary) {
    if (operators[objet.type]) {
      return undefined_to_null(
        operators[objet.type]?.(
          await evaluate(objet.right, bridge, scoped_variables)
        )
      );
    }
  }
  if (objet instanceof Binary) {
    if (objet.type === TypeToken.Assignement) {
      if (
        objet.left?.type !== TypeToken.Var &&
        objet.left?.type !== TypeToken.Argument
      )
        throw "error eq";
      const value = await evaluate(objet.right, bridge, scoped_variables);
      const o = objet.left;
      scoped_variables[
        (o instanceof PrimitivesParsed
          ? o.value
          : (o as Command).values.join("_")) as any
      ] = value;
      return null;
    } else if (operators[objet.type]) {
      return undefined_to_null(
        operators[objet.type]?.(
          await evaluate(objet.left, bridge, scoped_variables),
          await evaluate(objet.right, bridge, scoped_variables)
        )
      );
    }
  }

  if (objet instanceof If) {
    let vals: PrimitivesJS = null;
    for (const condition of objet.condition.parser.ASTs) {
      vals = await evaluate(condition, bridge, scoped_variables);
    }
    if (typeof vals !== "boolean") throw "bad if condition";
    if (vals) {
      vals = null;
      for (const returns of objet.block.parser.ASTs) {
        vals = await evaluate(returns, bridge, scoped_variables);
      }
      return undefined_to_null(vals);
    } else if (objet.continue && !vals) {
      return undefined_to_null(
        await evaluate(objet.continue, bridge, scoped_variables)
      );
    }
  }

  if (objet instanceof Else) {
    let vals: PrimitivesJS = null;
    for (const returns of objet.block.parser.ASTs) {
      vals = await evaluate(returns, bridge, scoped_variables);
    }
    return undefined_to_null(vals);
  }

  if (objet instanceof Functions) {
    global_functions[objet.name as string] = async (bridge, vars) => {
      let vals = null;
      for (const parsed of objet.block.parser.ASTs) {
        vals = await evaluate(parsed, bridge, vars); // vars
      }
      return vals;
    };
    return null;
  }

  return null;
}

export { evaluate };
