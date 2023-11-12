import type { AST, PrimitivesJS, FunctionsOperators, Bridge } from "./types";
import { TypeToken } from "./lexer";
import { Binary, Command, PrimitivesParsed, Unary } from "./parser";
import { Else, If } from "./parser/keywords";

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
    return a === b;
  },
  [TypeToken.NotEq]: (a: PrimitivesJS, b: PrimitivesJS) => {
    return a !== b;
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
  //[TypeToken.PipeOut]: undefined,
  //[TypeToken.PipeIn]: undefined,
  //[TypeToken.Var]: undefined,
  //[TypeToken.Assignement]: undefined,

  //[TypeToken.Semicolon]: undefined,
  //[TypeToken.LeftPar]: undefined,
  //[TypeToken.RightPar]: undefined,
};

function und<T>(val: T) {
  if (typeof val === "undefined") return null;
  return val;
}
async function evaluate(
  val: AST | undefined,
  bridge: Bridge,
): Promise<PrimitivesJS> {
  if (val instanceof PrimitivesParsed) return und(val.value);
  if (val instanceof Command)
    return val.piped
      ? und(await bridge.exec(val.values))
      : und(await bridge.out(await bridge.exec(val.values)));
  if (val instanceof Unary) {
    if (operators[val.type]) {
      return und(operators[val.type]?.(await evaluate(val.right, bridge)));
    }
  }
  if (val instanceof Binary) {
    if (val.type === TypeToken.Eq) {
      if (val.left?.type !== TypeToken.Var) throw "error eq"
      bridge.variables[(val.left as any).value] = await evaluate(val.right, bridge);
    }
    else if (operators[val.type]) {
      return und(
        operators[val.type]?.(
          await evaluate(val.left, bridge),
          await evaluate(val.right, bridge)
        )
      );
    }
  }

  if (val instanceof If) {
    let vals: PrimitivesJS = null;
    for (const condition of val.condition.parser.parsed) {
      vals = await evaluate(condition, bridge);
    }
    if (typeof vals !== "boolean") throw "bad if condition";
    if (vals) {
      vals = null;
      for (const returns of val.block.parser.parsed) {
        vals = await evaluate(returns, bridge);
      }
      return und(vals);
    } else if (val.continue && !vals) {
      return und(await evaluate(val.continue, bridge));
    }
  }

  if (val instanceof Else) {
    let vals: PrimitivesJS = null;
    for (const returns of val.block.parser.parsed) {
      vals = await evaluate(returns, bridge);
    }
    return und(vals);
  }

  return null;
}

export { evaluate };
