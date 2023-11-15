import type { Token, TypeToken } from "./interpretor/lexer";
import type { Binary, Block, Command, PrimitivesParsed, Unary } from "./interpretor/parser";
import type { Else, ElseIf, Functions, If } from "./interpretor/parser/keywords";

type FunctionsOperators = {
  [state in TypeToken]?: Function;
};

type TermFunc = ((token: Token, i: number) => boolean)

type ReturnYash =
  | Promised<PrimitivesJS>
  | Promised<void>
  | Promised<PrimitivesJS[]>;
type Promised<T> = Promise<T> | T;

interface FunctionsYash {
  [name: string]: (bridge: Bridge, variables: VariablesYash) => ReturnYash;
}

interface VariablesYash {
  [name: string]: PrimitivesJS;
}

interface Bridge {
  global_functions: FunctionsYash;
  global_variables: VariablesYash;
  out: (...args: PrimitivesJS[]) => Promised<void>;
  err: (...args: PrimitivesJS[]) => Promised<void>;
  exec: (vals: string[]) => Promised<any>;
}
type Keywords = If | ElseIf | Else | Functions;
type NonOperators = PrimitivesParsed | Command;
type Operators = Binary | Unary;
type AST = NonOperators | Operators | Block | Keywords;

type PrimitivesJS = string | boolean | number | null;

export type {
  Keywords,
  FunctionsOperators,
  Bridge,
  PrimitivesJS,
  AST,
  NonOperators,
  Operators,
  Promised,
  VariablesYash,
  FunctionsYash,
  TermFunc,
};
