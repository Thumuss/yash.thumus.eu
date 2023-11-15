import { Token, TypeToken } from "../lexer";
import { Block, Parser } from "../parser";
import { AST } from "../../types";

const elseElif = (t: Token, i: number) =>
  (t.type === TypeToken.Elif || t.type === TypeToken.Else) && i == 1;
const fi = (t: Token) => t.type === TypeToken.Fi;
const iff = (t: Token) => t.type == TypeToken.If;
const rightB = (t: Token) => t.type === TypeToken.RightBracket;
const leftB = (t: Token) => t.type === TypeToken.LeftBracket;

class Keyword {
  type: TypeToken;

  constructor(type: TypeToken) {
    this.type = type;
  }

  toJSON(): any {
    return {
      type: this.type,
    };
  }
}

class If extends Keyword {
  p: Parser;
  block: Block;
  condition: Block;
  continue?: AST;
  constructor(p: Parser, type = TypeToken.If) {
    super(type);
    this.p = p;

    if (p.afterEqlTyp(TypeToken.LeftPar)) throw "if error leftPar";

    const bFirst = p.findNext(TypeToken.Then);
    const cLast = p.lastTokenBefore(TypeToken.RightPar, bFirst);

    this.condition = new Block(p.tokens.slice(p.id + 1, cLast + 1));

    const ferme = p.termination([iff], [elseElif, fi]);

    if (!ferme) throw this.type + " not closed";

    if (bFirst === -1) throw this.type + " error";
    this.block = new Block(p.tokens.slice(bFirst + 1, p.id));
  }

  toJSON(): any {
    return {
      type: this.type,
      condition: this.condition.toJSON(),
      block: this.block.toJSON(),
      continue: this.continue?.toJSON(),
    };
  }
}

class ElseIf extends If {
  constructor(p: Parser) {
    super(p, TypeToken.Elif);
  }
}

class Else extends Keyword {
  p: Parser;
  block: Block;
  constructor(p: Parser) {
    super(TypeToken.If);
    this.p = p;

    const bFirst = p.findNext(TypeToken.Then);

    const ferme = p.termination([iff], [elseElif, fi]);

    if (!ferme) throw "else not closed";

    if (bFirst === -1) throw "else error";
    this.block = new Block(p.tokens.slice(bFirst, p.id));
  }

  toJSON(): any {
    return {
      type: this.type,
      block: this.block.toJSON(),
    };
  }
}
function ifs(t: Token, p: Parser) {
  p.add(new If(p));
}

function elif(t: Token, p: Parser) {
  const newIf = new ElseIf(p);
  if (p.lItem?.type === TypeToken.If || p.lItem?.type === TypeToken.Elif) {
    (p.lItem as If).continue = newIf;
  } else {
    p.add(newIf);
  }
}

function elses(t: Token, p: Parser) {
  const newIf = new Else(p);
  if (p.lItem?.type === TypeToken.If || p.lItem?.type === TypeToken.Elif) {
    (p.lItem as If).continue = newIf;
  } else {
    p.add(newIf);
  }
}

class Functions extends Keyword {
  name?: string;
  p: Parser;
  block: Block;

  constructor(p: Parser, name?: string) {
    super(TypeToken.Function);
    this.name = name;
    this.p = p;

    const nbLeftBracket = p.findNext(TypeToken.LeftBracket);
    if (nbLeftBracket < 0) throw "function not started";

    p.id = nbLeftBracket;
    const ferme = p.termination([leftB], [rightB]);
    if (!ferme) throw "function not closed";

    this.block = new Block(p.tokens.slice(nbLeftBracket + 1, p.id));
  }
}

function functions(t: Token, p: Parser) {
  if (t.type === TypeToken.Argument && !p.afterEqlTyp(TypeToken.LeftPar))
    return false;

  const name = t.type === TypeToken.Argument ? t.value : p.after()?.value;
  const fnc = new Functions(p, name as string);
  p.add(fnc);
  p.next();
  return true;
}

export { ifs, If, ElseIf, Else, Keyword, elif, elses, Functions, functions };
