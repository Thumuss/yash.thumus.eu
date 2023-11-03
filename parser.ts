import { PrimitivesJS, Token, TypeToken, lexer } from "./lexer";

type Objectss = Obj | Command;
type Opes = Binaire | Unaire;
type AST = Objectss | Opes;

const orderPriority = [
  TypeToken.PipeOut,
  TypeToken.Ampersand,
  TypeToken.Pipe,

  TypeToken.Eq,
  TypeToken.NotEq,
  TypeToken.GrEq,
  TypeToken.LsEq,

  TypeToken.Or,
  TypeToken.And,
  TypeToken.Less,
  TypeToken.Greater,
  TypeToken.Not,

  TypeToken.Plus,
  TypeToken.Minus,
  TypeToken.Star,
  TypeToken.Slash,
  TypeToken.Modulo,
  TypeToken.Pow,

  TypeToken.PipeIn,
];
class Obj {
  type: TypeToken;
  value: PrimitivesJS;

  constructor(type: TypeToken, value: PrimitivesJS) {
    this.type = type;
    this.value = value;
  }

  static into(token: Token): Obj {
    return new Obj(token.type, token.value);
  }

  toJSON() {
    return {
      type: this.type,
      value: this.value,
    };
  }
}

class Command {
  type: TypeToken = TypeToken.Argument;
  values: string[];

  constructor(token: Token) {
    this.values = (token.value as string).split(" ");
  }

  add(token: Objectss) {
    if (token instanceof Command) {
      this.values.concat(token.values);
    } else if (token.type == TypeToken.Argument) {
      this.values.push(...(token.value as string).split(" "));
    } else if (token.type == TypeToken.Text) {
      this.values.push(token.value as string);
    } else if (token.type == TypeToken.Bool) {
      this.values.push(token.value ? "true" : "false");
    } else if (token.type == TypeToken.Number) {
      this.values.push(token.value?.toString() as string);
    }
  }

  toJSON() {
    return {
      type: this.type,
      values: this.values,
    };
  }
}

class Binaire {
  type: TypeToken;
  left?: AST;
  right?: AST;
  priority: number;
  constructor(type: TypeToken, priority: number, right?: AST, left?: AST) {
    this.type = type;
    this.right = right;
    this.left = left;
    this.priority = priority;
  }

  toJSON(): any {
    return {
      type: this.type,
      left: this.left?.toJSON(),
      right: this.right?.toJSON(),
    };
  }

  static into(token: Token): Binaire {
    return new Binaire(
      token.type,
      token.plus + orderPriority.findIndex((a) => a == token.type)
    );
  }
}

class Unaire {
  type: TypeToken;
  right?: AST;
  priority: number;
  constructor(type: TypeToken, priority: number, right?: AST, left?: AST) {
    this.type = type;
    this.right = right;
    this.priority = priority;
  }

  static into(token: Token): Unaire {
    return new Unaire(
      token.type,
      token.plus + orderPriority.findIndex((a) => a == token.type)
    );
  }

  toJSON(): any {
    return {
      type: this.type,
      right: this.right?.toJSON(),
    };
  }
}

class Parser {
  tokens: Token[];
  current: number;
  parsed?: AST;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.current = 0;
    this.parsed = undefined;
  }

  pass(): void {
    this.current++;
  }

  end(): boolean {
    return this.tokens.length == this.current;
  }

  currentToken(): Token {
    return this.tokens[this.current];
  }

  before(nb: number = 1): Token {
    return this.tokens[this.current - nb];
  }

  next(nb: number = 1): Token {
    return this.tokens[this.current + nb];
  }

  consume() {
    this.tokens = this.tokens
      .slice(0, this.current)
      .concat(this.tokens.slice(this.current + 1));
  }

  findNext(type: TypeToken): number {
    return this.tokens.slice(this.current).findIndex((a) => a.type == type);
  }
  addObj(obj: Objectss, parsed = this.parsed) {
    if (parsed instanceof Obj) throw "Error";
    if (
      parsed instanceof Command &&
      (obj.type == TypeToken.Argument ||
        obj.type == TypeToken.Text ||
        obj.type == TypeToken.Bool ||
        obj.type == TypeToken.Number)
    )
      return parsed.add(obj);
    if (parsed instanceof Command) throw "Error";
    if (parsed === undefined) return (this.parsed = obj);
    if (!(parsed instanceof Unaire) && !parsed.left) return (parsed.left = obj);
    if (!parsed.right) return (parsed.right = obj);
    this.addObj(obj, parsed.right);
  }

  addOpBin(obj: Binaire) {
    if (this.parsed === undefined) throw "Error";
    if (this.parsed instanceof Obj || this.parsed instanceof Command) {
      obj.left = this.parsed;
      this.parsed = obj;
    } else {
      if (obj.priority > this.parsed.priority) {
        obj.left = this.parsed.right;
        this.parsed.right = obj;
      } else {
        obj.left = this.parsed;
        this.parsed = obj;
      }
    }
  }

  addOpUna(obj: Unaire) {
    if (this.parsed instanceof Obj || this.parsed instanceof Command)
      throw "Error";
    if (this.parsed === undefined) return (this.parsed = obj);
    if (obj.priority > this.parsed.priority) {
      obj.right = this.parsed.right;
      this.parsed.right = obj;
    } else {
      obj.right = this.parsed;
      this.parsed = obj;
    }
  }

  add(obj: AST) {
    if (obj instanceof Obj || obj instanceof Command) {
      this.addObj(obj);
    } else if (obj instanceof Binaire) {
      this.addOpBin(obj);
    } else {
      this.addOpUna(obj);
    }
  }
}

function baseObj(token: Token, p: Parser, priority: number = 1) {
  if (token.type === TypeToken.Argument) {
    const obj = new Command(token);
    p.add(obj);
    p.pass();
  } else {
    const obj = Obj.into(token);
    p.add(obj);
    p.pass();
  }
}

function baseOpeBinaire(token: Token, p: Parser) {
  const obj = Binaire.into(token);
  p.add(obj);
  p.pass();
}

function baseOpeUnaire(token: Token, p: Parser) {
  const obj = Unaire.into(token);
  p.add(obj);
  p.pass();
}

function minus(token: Token, p: Parser) {
  if (
    p.before()?.type != TypeToken.Number &&
    p.next().type == TypeToken.Number
  ) {
    p.consume();
    (p.currentToken().value as number) *= -1;
  } else {
    baseOpeBinaire(token, p);
  }
}

function consumeParen(p: Parser) {
  let i = 0;
  while (!p.end()) {
    const token = p.currentToken();
    if (token.type == TypeToken.LeftPar) {
      i++;
      p.consume();
    } else if (token.type == TypeToken.RightPar) {
      i--;
      if (i < 0) throw "< hm hm";
      p.consume();
    } else {
      token.plus += i * 100;
      p.pass();
    }
  }
  p.current = 0;
}

function parse(tokens: Token[]): Parser {
  const p = new Parser(tokens);
  consumeParen(p);
  while (!p.end()) {
    const currentToken = p.currentToken();
    if (
      [
        TypeToken.Argument,
        TypeToken.Text,
        TypeToken.Bool,
        TypeToken.Number,
      ].includes(currentToken.type)
    ) {
      baseObj(currentToken, p);
    } else if (currentToken.type == TypeToken.Minus) {
      minus(currentToken, p);
    } else if (
      [TypeToken.Ampersand, TypeToken.Not].includes(currentToken.type)
    ) {
      baseOpeUnaire(currentToken, p);
    } else {
      baseOpeBinaire(currentToken, p);
    }
  }
  return p;
}
function test() {
  const lexe = lexer(
    `echo a b "test a" 'aaaaa b b ' && echo "pzokookzqe kokoqze" && 1 + 1`
  );
  const parser = parse(lexe);
  console.log(parser.parsed?.toJSON());
}

//test();

export { orderPriority, Obj, Command, Binaire, Unaire, Parser, parse };
export type { Objectss, Opes, AST };
