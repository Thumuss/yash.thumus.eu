import { TypeToken, type Token } from "../../lexer";
import type { NonOperators } from "../../../types";
import Parser from "../classes/Parser";
import Primitive from "../classes/Primitives";
import Command from "../classes/Command";

function literal(t: Token, p: Parser, n?: NonOperators) {
  const obj = n || Primitive.into(t);
  p.next();
  p.add(obj);
}

function nums(t: Token, p: Parser) {
  literal(t, p);
}

function text(t: Token, p: Parser) {
  literal(t, p);
}

function bool(t: Token, p: Parser) {
  literal(t, p);
}

function vars(t: Token, p: Parser) {
  literal(t, p);
}

function argument(t: Token, p: Parser) {
  if (p.lItem?.type === TypeToken.Argument && p.before()?.type != TypeToken.Semicolon && p.before()?.type != TypeToken.NewLine) {
    p.next();
    (p.lItem as Command).add(t as any);
  } else {
    literal(t, p, new Command(t));
  }
}

export { nums, text, bool, argument, vars };
