import type { Token, TypeToken } from "./interpretor/lexer";
import Binary from "./interpretor/parser/classes/Binary";
import Block from "./interpretor/parser/classes/Block";
import Command from "./interpretor/parser/classes/Command";
import Primitive from "./interpretor/parser/classes/Primitives";
import Unary from "./interpretor/parser/classes/Unary";
import type { Else, ElseIf, Functions, If } from "./interpretor/parser/functions/keywords";

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
  [name: string]: (bridge: Bridge, variables: VariablesYash, ast: AST, tokens: Token[]) => ReturnYash;
}

interface VariablesYash {
  [name: string]: PrimitivesJS | PrimitivesJS[];
}

interface Bridge {
  global_functions: FunctionsYash;
  global_variables: VariablesYash;
  out: (...args: PrimitivesJS[]) => Promised<void>;
  err: (...args: PrimitivesJS[]) => Promised<void>;
  exec: (vals: PrimitivesJS[]) => Promised<any>;
  
  // Optional extended system capabilities (for SystemBridge)
  fs?: any;           // FileSystemOperations
  process?: any;      // ProcessManager
  users?: any;        // UserManager
  cwd?: string;
  setCwd?: (path: string) => void;
  terminal?: any;     // TerminalInterface
  history?: string[];
  addHistory?: (command: string) => void;
}

type Keywords = If | ElseIf | Else | Functions;
type NonOperators = Primitive | Command;
type Operators = Binary | Unary;
type AST = NonOperators | Operators | Block | Keywords;

type PrimitivesJS = string | boolean | number | null;
type ArrayYash = PrimitivesJS[];

export type {
  Keywords,
  FunctionsOperators,
  Bridge,
  PrimitivesJS,
  ArrayYash,
  AST,
  NonOperators,
  Operators,
  Promised,
  VariablesYash,
  FunctionsYash,
  TermFunc,
};
