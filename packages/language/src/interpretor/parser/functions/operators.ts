import { Token, TypeToken } from "../../lexer";
import Binary from "../classes/Binary";
import Parser from "../classes/Parser";
import Unary from "../classes/Unary";
import Block from "../classes/Block";
import { ArrayLiteral } from "../classes/Array";

function binary(token: Token, p: Parser) {
  const obj = new Binary (token);
  p.add(obj);
  p.next();
}

function unary(token: Token, p: Parser) {
  const obj = new Unary(token);
  p.add(obj);
  p.next();
}

// Postfix unary - takes the current AST as its operand
function postfixUnary(token: Token, p: Parser) {
  const obj = new Unary(token);
  // For postfix operators, the current AST becomes the operand
  obj.right = p.currentAst;
  p.ASTs[p.idAST] = obj;
  p.next();
}

function and(t: Token, p: Parser) {
  binary(t, p);
}

function ampersand(t: Token, p: Parser) {
  postfixUnary(t, p);
}

function assignement(t: Token, p: Parser) {
  // Check if this is an array literal assignment: varname=(...)
  // Array literal requires NO space between = and ( (Bash convention)
  const nextToken = p.after();
  if (nextToken && nextToken.type === TypeToken.LeftPar) {
    // Check if ( is directly adjacent to = (no space)
    // = columnEnd should equal ( columnStart (no gap)
    const eqEnd = t.position.columnEnd;
    const parenStart = nextToken.position.columnStart;
    // Use lineStart for both since lineEnd can be buggy in lexer
    const sameLine = t.position.lineStart === nextToken.position.lineStart;
    
    if (sameLine && parenStart === eqEnd) {
      // This is an array literal assignment
      const obj = new Binary(t);
      p.add(obj);
      p.next(); // move past '='
      p.next(); // move past '('
      
      // Find the closing )
      let depth = 1;
      let endIndex = p.id;
      while (endIndex < p.tokens.length && depth > 0) {
        if (p.tokens[endIndex].type === TypeToken.LeftPar) depth++;
        if (p.tokens[endIndex].type === TypeToken.RightPar) depth--;
        if (depth > 0) endIndex++;
      }
      
      // Parse the array elements - pass tokens directly to ArrayLiteral
      const elementsTokens = p.tokens.slice(p.id, endIndex);
      const arrayLiteral = new ArrayLiteral(elementsTokens);
      
      // Set the array literal as the right side of the assignment
      obj.right = arrayLiteral;
      p.id = endIndex + 1; // move past )
      return;
    }
  }
  binary(t, p);
}

function or(t: Token, p: Parser) {
  binary(t, p);
}

function not(t: Token, p: Parser) {
  unary(t, p);
}

function equal(t: Token, p: Parser) {
  binary(t, p);
}

function notequal(t: Token, p: Parser) {
  binary(t, p);
}

function greaterequal(t: Token, p: Parser) {
  binary(t, p);
}

function lessequal(t: Token, p: Parser) {
  binary(t, p);
}

function greater(t: Token, p: Parser) {
  binary(t, p);
}

function less(t: Token, p: Parser) {
  binary(t, p);
}

function plus(t: Token, p: Parser) {
  binary(t, p);
}

function minus(t: Token, p: Parser) {
  if (
    p.before()?.type != TypeToken.Number &&
    p.after()?.type == TypeToken.Number
  ) {
    p.consume();
    (p.token().value as number) *= -1;
  } else if (
    p.before()?.type == TypeToken.Argument &&
    p.after()?.type == TypeToken.Argument
  ) {
    p.consume();
    p.token().value = "-" + p.token().value;
  } else {
    binary(t, p);
  }
}

function slash(t: Token, p: Parser) {
  binary(t, p);
}

function star(t: Token, p: Parser) {
  binary(t, p);
}

function modulo(t: Token, p: Parser) {
  binary(t, p);
}

function pow(t: Token, p: Parser) {
  binary(t, p);
}

function pipe(t: Token, p: Parser) {
  binary(t, p);
}

function pipeout(t: Token, p: Parser) {
  binary(t, p);
}

function pipeappend(t: Token, p: Parser) {
  binary(t, p);
}

function pipein(t: Token, p: Parser) {
  binary(t, p);
}

function semicolon(t: Token, p: Parser) {
  p.changeIfNotEmpty();
  p.next();
}

function newline(t: Token, p: Parser) {
  p.after()?.type != TypeToken.Backslash && p.changeIfNotEmpty();
  p.next();
}

export {
  and,
  ampersand,
  assignement,
  or,
  not,
  equal,
  newline,
  notequal,
  greaterequal,
  lessequal,
  greater,
  less,
  plus,
  minus,
  semicolon,
  slash,
  star,
  modulo,
  pow,
  pipe,
  pipeout,
  pipeappend,
  pipein,
};
