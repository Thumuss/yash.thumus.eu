import { Token, TypeToken, lexer } from "./lexer";
import { keywords, operators, primitives } from "./parser/exportParser";
import { Keyword } from "./parser/keywords";
import { AST, Keywords, NonOperators, PrimitivesJS, TermFunc } from "../types";

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
    } else if (token.type == TypeToken.Var) {
      this.values.push("$" + token.value);
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
  constructor(token: Token, right?: AST, left?: AST) {
    this.type = token.type;
    this.right = right;
    this.left = left;
    this.priority =
      token.plus + orderPriority.findIndex((a) => a == token.type);
  }

  toJSON(): any {
    return {
      type: this.type,
      left: this.left?.toJSON(),
      right: this.right?.toJSON(),
    };
  }
}

class Unary {
  type: TypeToken;
  right?: AST;
  priority: number;
  constructor(token: Token, right?: AST) {
    this.type = token.type;
    this.right = right;
    this.priority =
      token.plus + orderPriority.findIndex((a) => a == token.type);
  }

  toJSON(): any {
    return {
      type: this.type,
      right: this.right?.toJSON(),
    };
  }
}

abstract class Reader {
  tokens: Token[];
  id: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  next(): void {
    this.id++;
  }

  end(i: number = 0): boolean {
    return this.tokens.length == this.id + i;
  }

  token(): Token {
    return this.tokens[this.id];
  }

  before(nb: number = 1): Token {
    return this.tokens[this.id - nb];
  }

  after(nb: number = 1): Token {
    return this.tokens[this.id + nb];
  }

  typeTokens(tokens = this.tokens) {
    return tokens.map((a) => a.type);
  }

  valTokens(tokens = this.tokens) {
    return tokens.map((a) => a.value);
  }

  consume() {
    this.tokens = this.tokens
      .slice(0, this.id)
      .concat(this.tokens.slice(this.id + 1));
  }

  findNext(type: TypeToken): number {
    return (
      this.tokens.slice(this.id).findIndex((a) => a.type == type) + this.id
    );
  }

  afterEqlTyp(type: TypeToken, nb = 0) {
    return this.after(nb)?.type === type
  }

  beforeEqlTyp(type: TypeToken, nb = 0) {
    return this.before(nb)?.type === type
  }

  termination(plus: TermFunc[], minus: TermFunc[]) {
    let i = 1;
    while (i != 0 && !this.end(1)) {
      this.next();
      const t = this.token();
      for (const onePlus of plus) {
        if (onePlus(t, i)) i++;
      }
      for (const oneMinus of minus) {
        if (oneMinus(t, i)) i--;
      }
    }
    return i == 0;
  }

  lastTokenBefore(type: TypeToken, nb: number = this.tokens.length - 1) {
    let i = 0;
    let last;
    do {
      last = nb - i;
      i++;
    } while (this.tokens[last]?.type != type);
    return last;
  }
}

class Parser extends Reader {
  ASTs: AST[] = [];
  idAST: number = 0;
  lItem?: AST;

  constructor(tokens: Token[]) {
    super(tokens);
  }

  get currentAst() {
    return this.ASTs[this.idAST];
  }

  changeIfNotEmpty() {
    if (this.currentAst !== undefined) {
      this.idAST++;
    }
  }

  add(obj: AST) {
    this.lItem = obj;
    if (obj instanceof PrimitivesParsed || obj instanceof Command) {
      this._obj(obj);
    } else if (obj instanceof Binary) {
      this._binary(obj);
    } else if (obj instanceof Unary) {
      this._unary(obj);
    } else {
      this._block_keywords(obj);
    }
  }

  _obj(obj: NonOperators, parsed = this.currentAst) {
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
        obj.type == TypeToken.Number ||
        obj.type == TypeToken.Var)
    )
      return parsed.add(obj);
    if (parsed instanceof Command) throw "Error";
    if (parsed === undefined) return (this.ASTs[this.idAST] = obj);
    if (!(parsed instanceof Unary) && !parsed.left) return (parsed.left = obj);
    if (!parsed.right) return (parsed.right = obj);
    this._obj(obj, parsed.right);
  }

  _binary(obj: Binary) {
    const parsed = this.currentAst;
    if (
      parsed === undefined ||
      parsed instanceof Block ||
      parsed instanceof Keyword
    )
      throw "Error Bin op";
    if (parsed instanceof PrimitivesParsed || parsed instanceof Command) {
      obj.left = parsed;
      this.ASTs[this.idAST] = obj;
    } else {
      if (obj.priority > parsed.priority) {
        obj.left = parsed.right;
        (this.currentAst as Binary).right = obj;
      } else {
        obj.left = parsed;
        this.ASTs[this.idAST] = obj;
      }
    }
  }

  _unary(obj: Unary) {
    const parsed = this.currentAst;
    if (!(parsed instanceof Binary) && parsed != undefined) throw "Error una";
    if (parsed === undefined) return (this.ASTs[this.idAST] = obj);
    if (obj.priority > parsed.priority) {
      obj.right = parsed.right;
      (this.currentAst as Unary).right = obj;
    } else {
      obj.right = parsed;
      this.ASTs[this.idAST] = obj;
    }
  }

  _block_keywords(obj: Block | Keywords) {
    this.changeIfNotEmpty();
    this.ASTs[this.idAST] = obj;
    this.idAST++;
  }

  toJSON(): any {
    return this.ASTs.map((a) => a.toJSON());
  }
}

class Block {
  type: TypeToken;
  parser: Parser;

  constructor(tokens: Token[]) {
    this.type = TypeToken.LeftBracket;
    //console.log(tokens.map((a) => a.type));
    this.parser = parse(tokens);
  }

  toJSON(): any {
    return this.parser.ASTs.map((a) => a.toJSON());
  }
}

function parse(tokens: Token[]): Parser {
  const p = new Parser(tokens);
  let i = 0;
  while (!p.end()) {
    const t = p.token();
    t.plus = i * 100;
    switch (t.type) {
      case TypeToken.Ampersand:
        operators.ampersand(t, p);
        break;
      case TypeToken.And:
        operators.and(t, p);
        break;
      case TypeToken.Argument:
        if (!keywords.functions(t, p)) {
          primitives.argument(t, p);
        }
        break;
      case TypeToken.Assignement:
        operators.assignement(t, p);
        break;
      case TypeToken.NewLine:
        operators.newline(t, p);
        break;
      case TypeToken.Bool:
        primitives.bool(t, p);
        break;
      case TypeToken.Eq:
        operators.equal(t, p);
        break;
      case TypeToken.Function:
        keywords.functions(t, p);
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
  }
  return p;
}

export { PrimitivesParsed, Command, Binary, Unary, Parser, Block, parse };
