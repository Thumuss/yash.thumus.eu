import type { TypeToken } from "./lexer";
import type { Binary, Command, PrimitivesParsed, Unary } from "./parser";

type FunctionsOperators = {
  [state in TypeToken]?: Function;
};

interface Bridge {
  out: (...args: PrimitivesJS[]) => Promise<void> | void;
  err: (...args: PrimitivesJS[]) => Promise<void> | void;
  exec: (vals: string[]) => Promise<any> | any;
}

type NonOperators = PrimitivesParsed | Command;
type Operators = Binary | Unary;
type AST = NonOperators | Operators;

type PrimitivesJS = string | boolean | number | null;

export type { FunctionsOperators, Bridge, PrimitivesJS, AST, NonOperators, Operators }