import { Token, TypeToken } from "../../lexer";
import { AST } from "../../../types";
import Parser from "../classes/Parser";
import Block from "../classes/Block";

const elseElif = (t: Token, i: number) =>
  (t.type === TypeToken.Elif || t.type === TypeToken.Else) && i == 1;
const fi = (t: Token) => t.type === TypeToken.Fi;
const iff = (t: Token) => t.type == TypeToken.If;
const rightB = (t: Token) => t.type === TypeToken.RightBracket;
const leftB = (t: Token) => t.type === TypeToken.LeftBracket;
const done = (t: Token) => t.type === TypeToken.Done;
const whileUntilFor = (t: Token) => 
  t.type === TypeToken.While || t.type === TypeToken.Until || t.type === TypeToken.For;

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

  toJSON(): any {
    return {
      type: this.type,
      name: this.name,
      block: this.block.toJSON(),
    };
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

// While loop: while (condition) do ... done
class While extends Keyword {
  p: Parser;
  block: Block;
  condition: Block;

  constructor(p: Parser, type = TypeToken.While) {
    super(type);
    this.p = p;

    // Find 'do' keyword
    const doIndex = p.findNext(TypeToken.Do);
    if (doIndex === -1) throw "while: 'do' not found";

    // Find the condition between while and do
    // The condition is between ( and ) before do
    // Skip the opening (
    const startCond = p.id + 2; // skip 'while' and '('
    const cLast = p.lastTokenBefore(TypeToken.RightPar, doIndex);
    
    this.condition = new Block(p.tokens.slice(startCond, cLast));

    // Find matching 'done'
    p.id = doIndex;
    const ferme = p.termination([whileUntilFor], [done]);
    if (!ferme) throw "while not closed with 'done'";

    this.block = new Block(p.tokens.slice(doIndex + 1, p.id));
  }

  toJSON(): any {
    return {
      type: this.type,
      condition: this.condition.toJSON(),
      block: this.block.toJSON(),
    };
  }
}

function whiles(t: Token, p: Parser) {
  p.add(new While(p));
}

// Until loop: until (condition) do ... done (runs until condition is true)
class Until extends While {
  constructor(p: Parser) {
    super(p, TypeToken.Until);
  }
}

function untils(t: Token, p: Parser) {
  p.add(new Until(p));
}

// For loop: for var in values do ... done
class For extends Keyword {
  p: Parser;
  block: Block;
  varName: string;
  valueTokens: Token[];  // Store raw tokens for values

  constructor(p: Parser) {
    super(TypeToken.For);
    this.p = p;

    // Get variable name (next token after 'for')
    const varToken = p.after();
    if (!varToken || varToken.type !== TypeToken.Argument) {
      throw "for: variable name expected";
    }
    this.varName = varToken.value as string;

    // Find 'in' keyword
    const inIndex = p.findNext(TypeToken.In);
    if (inIndex === -1) throw "for: 'in' not found";

    // Find 'do' keyword
    const doIndex = p.findNext(TypeToken.Do);
    if (doIndex === -1) throw "for: 'do' not found";

    // Values are between 'in' and 'do' - store as raw tokens
    this.valueTokens = p.tokens.slice(inIndex + 1, doIndex);

    // Find matching 'done'
    p.id = doIndex;
    const ferme = p.termination([whileUntilFor], [done]);
    if (!ferme) throw "for not closed with 'done'";

    this.block = new Block(p.tokens.slice(doIndex + 1, p.id));
  }

  toJSON(): any {
    return {
      type: this.type,
      varName: this.varName,
      values: this.valueTokens.map(t => t.value),
      block: this.block.toJSON(),
    };
  }
}

function fors(t: Token, p: Parser) {
  p.add(new For(p));
}

// Local variable declaration: local varname = value
class Local extends Keyword {
  varName: string;
  valueBlock?: Block;

  constructor(p: Parser) {
    super(TypeToken.Local);

    // Get variable name (next token after 'local')
    const varToken = p.after();
    if (!varToken || (varToken.type !== TypeToken.Argument && varToken.type !== TypeToken.Var)) {
      throw "local: variable name expected";
    }
    this.varName = varToken.value as string;
    
    // Skip the variable name
    p.next();

    // Check if there's an assignment
    const assignToken = p.after();
    if (assignToken && assignToken.type === TypeToken.Assignement) {
      p.next(); // skip '='
      
      // Find the end of the value (newline or semicolon or end of tokens)
      let endIndex = p.id + 1;
      while (endIndex < p.tokens.length) {
        const t = p.tokens[endIndex];
        if (t.type === TypeToken.NewLine || t.type === TypeToken.Semicolon) {
          break;
        }
        endIndex++;
      }
      
      // Parse the value expression
      if (endIndex > p.id + 1) {
        this.valueBlock = new Block(p.tokens.slice(p.id + 1, endIndex));
        // Position parser at the end of the value (after last token of value)
        p.id = endIndex;
      }
    } else {
      // No assignment - skip past the variable name token
      p.next();
    }
  }

  toJSON(): any {
    return {
      type: this.type,
      varName: this.varName,
      value: this.valueBlock?.toJSON(),
    };
  }
}

function locals(t: Token, p: Parser) {
  p.add(new Local(p));
}

export { 
  ifs, If, ElseIf, Else, Keyword, elif, elses, Functions, functions,
  While, whiles, Until, untils, For, fors, Local, locals
};
