import { Token, TypeToken } from "../lexer";
import { Binary, Parser, Unary } from "../parser";

function binary(token: Token, p: Parser) {
  const obj = Binary.into(token);
  p.add(obj);
  p.next();
}

function unary(token: Token, p: Parser) {
  const obj = Unary.into(token);
  p.add(obj);
  p.next();
}

function and(t: Token, p: Parser) {
  binary(t, p);
}

function ampersand(t: Token, p: Parser) {
  unary(t, p);
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
    p.nextToken().type == TypeToken.Number
  ) {
    p.consume();
    (p.currentToken().value as number) *= -1;
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

function pipein(t: Token, p: Parser) {
  binary(t, p);
}

function semicolon(t: Token, p: Parser) {
  p.currentIdAst++;
  p.next()
}

export {
  and,
  ampersand,
  or,
  not,
  equal,
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
  pipein,
};
