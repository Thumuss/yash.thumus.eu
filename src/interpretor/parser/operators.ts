import { Token, TypeToken } from "../lexer";
import { Binary, Parser, Unary } from "../parser";

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

function and(t: Token, p: Parser) {
  binary(t, p);
}

function ampersand(t: Token, p: Parser) {
  unary(t, p);
}

function assignement(t: Token, p: Parser) {
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
  pipein,
};
