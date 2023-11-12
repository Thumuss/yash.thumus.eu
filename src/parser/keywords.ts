import { Token, TypeToken } from "../lexer";
import { Block, Parser } from "../parser";
import { AST } from "../types";

class Keyword {
  type: TypeToken;

  constructor(type: TypeToken) {
    this.type = type;
  }

  static into(token: Token): Keyword {
    return new Keyword(token.type);
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
  constructor(p: Parser) {
    super(TypeToken.If);
    this.p = p;

    if (p.after()?.type !== TypeToken.LeftPar) {
      throw "if error leftPar";
    }
    const bFirst = p.findNext(TypeToken.Then);

    let l = 0;
    let cLast;
    do {
      cLast = bFirst - 1 - l;
      l++;
    } while (p.tokens[cLast].type == TypeToken.Semicolon);

    this.condition = new Block(p.tokens.slice(p.currentIdToken + 1, cLast + 1));

    let i = 1;
    while (i != 0 && !p.end(1)) {
      p.next();
      const tk = p.currentToken();
      if (tk.type === TypeToken.Fi) {
        i--;
      } else if (
        (tk.type === TypeToken.Elif || tk.type === TypeToken.Else) &&
        i == 1
      ) {
        i--;
      } else if (tk.type === TypeToken.If) {
        i++;
      }
    }
    if (i > 0) throw this.type + " not closed";

    if (bFirst === -1) throw this.type + " error";
    this.block = new Block(p.tokens.slice(bFirst + 1, p.currentIdToken));

    const s = p.currentIdToken;
    p.currentIdToken = 0;
    for (let i = 0; i < s; i++) {
      p.consume();
    }
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
    super(p);
    this.type = TypeToken.Elif;
  }
}

class Else extends Keyword {
  p: Parser;
  block: Block;
  constructor(p: Parser) {
    super(TypeToken.If);
    this.p = p;

    const bFirst = p.findNext(TypeToken.Then);

    let i = 1;
    while (i != 0 && !p.end(1)) {
      p.next();
      const tk = p.currentToken();
      if (tk.type === TypeToken.Fi) {
        i--;
      } else if (
        (tk.type === TypeToken.Elif || tk.type === TypeToken.Else) &&
        i == 1
      ) {
        i--;
      } else if (tk.type === TypeToken.If) {
        i++;
      }
    }
    
    if (i > 0) throw "else not closed";
    if (bFirst === -1) throw "else error";
    this.block = new Block(p.tokens.slice(bFirst, p.currentIdToken));

    const s = p.currentIdToken;
    p.currentIdToken = 0;
    for (let i = 0; i < s; i++) {
      p.consume();
    }
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
  if (
    p.lastItem?.type === TypeToken.If ||
    p.lastItem?.type === TypeToken.Elif
  ) {
    (p.lastItem as If).continue = newIf;
  } else {
    p.add(newIf);
  }
}

function elses(t: Token, p: Parser) {
  const newIf = new Else(p);
  if (
    p.lastItem?.type === TypeToken.If ||
    p.lastItem?.type === TypeToken.Elif
  ) {
    (p.lastItem as If).continue = newIf;
  } else {
    p.add(newIf);
  }
}

export { ifs, If, ElseIf, Else, Keyword, elif, elses };
