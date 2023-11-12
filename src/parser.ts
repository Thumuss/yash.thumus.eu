import { Token, TypeToken, lexer } from "./lexer";
import { keywords, operators, primitives } from "./parser/exportParser";
import { Keyword } from "./parser/keywords";
import { AST, Keywords, NonOperators, PrimitivesJS } from "./types";

const orderPriority: TypeToken[] = [
  TypeToken.If,
  TypeToken.Then,
  TypeToken.Elif,
  TypeToken.Else,
  TypeToken.Fi,
  TypeToken.Time,
  TypeToken.For,
  TypeToken.In,
  TypeToken.Until,
  TypeToken.While,
  TypeToken.Do,
  TypeToken.Done,
  TypeToken.Case,
  TypeToken.Esac,
  TypeToken.Coproc,
  TypeToken.Select,
  TypeToken.Function,

  TypeToken.Semicolon,

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
  TypeToken.DoubleLeftSqB,
  TypeToken.DoubleRightSqB,
  TypeToken.LeftBracket,
  TypeToken.RightBracket,

  TypeToken.Help,
];
class PrimitivesParsed {
  type: TypeToken;
  value: PrimitivesJS;

  constructor(type: TypeToken, value: PrimitivesJS) {
    this.type = type;
    this.value = value;
  }

  static into(token: Token): PrimitivesParsed {
    return new PrimitivesParsed(token.type, token.value);
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
  piped: boolean = false;

  constructor(token: Token) {
    this.values = (token.value as string).split(" ");
  }

  add(token: NonOperators) {
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

class Binary {
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

  static into(token: Token): Binary {
    return new Binary(
      token.type,
      token.plus + orderPriority.findIndex((a) => a == token.type)
    );
  }
}

class Unary {
  type: TypeToken;
  right?: AST;
  priority: number;
  constructor(type: TypeToken, priority: number, right?: AST, left?: AST) {
    this.type = type;
    this.right = right;
    this.priority = priority;
  }

  static into(token: Token): Unary {
    return new Unary(
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
  currentIdToken: number = 0;
  parsed: AST[] = [];
  currentIdAst: number = 0;
  lastItem?: AST;
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  count(
    type: TypeToken,
    start: number = this.currentIdToken,
    end: number = this.tokens.length
  ): number {
    return this.tokens.slice(start, end).filter((a) => a.type === type).length;
  }

  next(): void {
    this.currentIdToken++;
  }

  end(i: number = 0): boolean {
    return this.tokens.length == this.currentIdToken + i;
  }

  currentToken(): Token {
    return this.tokens[this.currentIdToken];
  }

  isToken(...args: TypeToken[]): boolean {
    return args.includes(this.currentToken().type);
  }

  before(nb: number = 1): Token {
    return this.tokens[this.currentIdToken - nb];
  }

  after(nb: number = 1): Token {
    return this.tokens[this.currentIdToken + nb];
  }

  consume() {
    this.tokens = this.tokens
      .slice(0, this.currentIdToken)
      .concat(this.tokens.slice(this.currentIdToken + 1));
  }

  findNext(type: TypeToken): number {
    return this.tokens
      .slice(this.currentIdToken)
      .findIndex((a) => a.type == type);
  }
  addObj(obj: NonOperators, parsed = this.currentAst) {
    console.log(parsed, obj)
    if (
      parsed instanceof PrimitivesParsed ||
      parsed instanceof Block ||
      parsed instanceof Keyword
    )
      throw "Error AddObj";
    if (
      parsed instanceof Command &&
      (obj.type == TypeToken.Argument ||
        obj.type == TypeToken.Text ||
        obj.type == TypeToken.Bool ||
        obj.type == TypeToken.Var ||
        obj.type == TypeToken.Number)
    )
      return parsed.add(obj);
    if (parsed instanceof Command) throw "Error";
    if (parsed === undefined) return (this.parsed[this.currentIdAst] = obj);
    if (!(parsed instanceof Unary) && !parsed.left) return (parsed.left = obj);
    if (!parsed.right) return (parsed.right = obj);
    this.addObj(obj, parsed.right);
  }

  get currentAst() {
    return this.parsed[this.currentIdAst];
  }

  addOpBin(obj: Binary) {
    const parsed = this.currentAst;
    if (
      parsed === undefined ||
      parsed instanceof Block ||
      parsed instanceof Keyword
    )
      throw "Error Bin op";
    if (parsed instanceof PrimitivesParsed || parsed instanceof Command) {
      obj.left = parsed;
      this.parsed[this.currentIdAst] = obj;
    } else {
      if (obj.priority > parsed.priority) {
        obj.left = parsed.right;
        (this.currentAst as Binary).right = obj;
      } else {
        obj.left = parsed;
        this.parsed[this.currentIdAst] = obj;
      }
    }
  }

  addOpUna(obj: Unary) {
    const parsed = this.currentAst;
    if (!(parsed instanceof Binary) && parsed != undefined) throw "Error una";
    if (parsed === undefined) return (this.parsed[this.currentIdAst] = obj);
    if (obj.priority > parsed.priority) {
      obj.right = parsed.right;
      (this.currentAst as Unary).right = obj;
    } else {
      obj.right = parsed;
      this.parsed[this.currentIdAst] = obj;
    }
  }

  addBlockKeywords(obj: Block | Keywords) {
    this.changeIfNotEmpty();
    this.parsed[this.currentIdAst] = obj;
    this.currentIdAst++;
  }

  isEmpty(): boolean {
    return this.currentAst === undefined;
  }

  changeIfNotEmpty() {
    if (!this.isEmpty()) {
      this.currentIdAst++;
    }
  }

  add(obj: AST) {
    this.lastItem = obj;
    if (obj instanceof PrimitivesParsed || obj instanceof Command) {
      this.addObj(obj);
    } else if (obj instanceof Binary) {
      this.addOpBin(obj);
    } else if (obj instanceof Unary) {
      this.addOpUna(obj);
    } else {
      this.addBlockKeywords(obj);
    }
  }

  toJSON(): any {
    return this.parsed.map((a) => a.toJSON());
  }
}

class Block {
  type: TypeToken;
  parser: Parser;

  constructor(tokens: Token[]) {
    this.type = TypeToken.LeftBracket;
    this.parser = parse(tokens);
  }

  toJSON(): any {
    return this.parser.parsed.map((a) => a.toJSON());
  }
}

function parse(tokens: Token[]): Parser {
  const p = new Parser(tokens);
  //consumeParen(p);
  let i = 0;
  let y = 0;
  while (!p.end()) {
    const t = p.currentToken();
    t.plus = i * 100;
    switch (t.type) {
      case TypeToken.Ampersand:
        operators.ampersand(t, p);
        break;
      case TypeToken.And:
        operators.and(t, p);
        break;
      case TypeToken.Argument:
        primitives.argument(t, p);
        break;
      case TypeToken.Assignement:
        break;
      case TypeToken.Bool:
        primitives.bool(t, p);
        break;
      case TypeToken.Eq:
        operators.equal(t, p);
        break;
      case TypeToken.GrEq:
        operators.greaterequal(t, p);
        break;
      case TypeToken.Greater:
        operators.greater(t, p);
        break;
      case TypeToken.LeftPar:
        p.next();
        i++;
        break;
      case TypeToken.Less:
        operators.less(t, p);
        break;
      case TypeToken.LsEq:
        operators.lessequal(t, p);
        break;
      case TypeToken.Minus:
        operators.minus(t, p);
        break;
      case TypeToken.Modulo:
        operators.modulo(t, p);
        break;
      case TypeToken.Not:
        operators.not(t, p);
        break;
      case TypeToken.NotEq:
        operators.notequal(t, p);
        break;
      case TypeToken.Number:
        primitives.nums(t, p);
        break;
      case TypeToken.Or:
        operators.or(t, p);
        break;
      case TypeToken.Pipe:
        operators.pipe(t, p);
        break;
      case TypeToken.PipeIn:
        operators.pipein(t, p);
        break;
      case TypeToken.PipeOut:
        operators.pipeout(t, p);
        break;
      case TypeToken.Plus:
        operators.plus(t, p);
        break;
      case TypeToken.Pow:
        operators.pow(t, p);
        break;
      case TypeToken.RightPar:
        p.next();
        i--;
        break;
      case TypeToken.Semicolon:
        operators.semicolon(t, p);
        break;
      case TypeToken.Slash:
        operators.slash(t, p);
        break;
      case TypeToken.Star:
        operators.star(t, p);
        break;
      case TypeToken.Text:
        primitives.text(t, p);
        break;
      case TypeToken.If:
        keywords.ifs(t, p);
        break;
      case TypeToken.Elif:
        keywords.elif(t, p);
        break;
      case TypeToken.Else:
        keywords.elses(t, p);
        break;
      case TypeToken.Var:
        primitives.vars(t, p);
        break;
      default:
        p.next();
        break;
    }
    console.log(t)
  }
  return p;
}

export { PrimitivesParsed, Command, Binary, Unary, Parser, Block, parse };
