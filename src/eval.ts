import { AST, Binaire, Command, Obj, Unaire, parse } from "./parser";
import { PrimitivesJS, TypeToken, lexer } from "./lexer";

type chokbar = {
  [state in TypeToken]?: Function;
};

const operators: chokbar = {
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

async function evals(val: AST | undefined, jsp: (val: string[]) => any): Promise<PrimitivesJS> {
  if (val instanceof Obj) return val.value;
  if (val instanceof Command) return await jsp(val.values);
  if (val instanceof Unaire) {
    if (operators[val.type]) {
        return operators[val.type]?.(await evals(val.right, jsp)) || null;
    }
  }
  if (val instanceof Binaire) {
    if (operators[val.type]) {
        return operators[val.type]?.(await evals(val.left, jsp), await evals(val.right, jsp)) || null;
    }
  }
  return null;
}

export { evals as evaluate };