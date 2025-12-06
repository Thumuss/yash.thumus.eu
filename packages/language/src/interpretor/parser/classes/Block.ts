import { Token, TypeToken } from "../../lexer";
import { parse } from "../../parser";
import Parser from "./Parser";

class Block {
  type: TypeToken;
  parser: Parser;

  constructor(tokens: Token[]) {
    this.type = TypeToken.LeftBracket;
    this.parser = parse(tokens);
  }

  toJSON(): any {
    return this.parser.ASTs.map((a) => a.toJSON());
  }
}

export default Block;