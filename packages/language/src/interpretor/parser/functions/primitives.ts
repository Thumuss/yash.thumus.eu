import { TypeToken, type Token } from "../../lexer";
import type { NonOperators } from "../../../types";
import Parser from "../classes/Parser";
import Primitive from "../classes/Primitives";
import Command from "../classes/Command";
import Block from "../classes/Block";
import { ArrayAccess } from "../classes/Array";

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
  // Check if this is an array access: $arr[index]
  const nextToken = p.after();
  if (nextToken && nextToken.type === TypeToken.LeftSqB) {
    const varName = t.value as string;
    p.next(); // move past variable
    p.next(); // move past [
    
    // Find the closing ]
    let depth = 1;
    let endIndex = p.id;
    while (endIndex < p.tokens.length && depth > 0) {
      if (p.tokens[endIndex].type === TypeToken.LeftSqB) depth++;
      if (p.tokens[endIndex].type === TypeToken.RightSqB) depth--;
      if (depth > 0) endIndex++;
    }
    
    // Parse the index expression
    const indexTokens = p.tokens.slice(p.id, endIndex);
    const indexBlock = new Block(indexTokens);
    
    const arrayAccess = new ArrayAccess(varName, indexBlock);
    p.add(arrayAccess);
    p.id = endIndex + 1; // move past ]
  } else {
    literal(t, p);
  }
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
