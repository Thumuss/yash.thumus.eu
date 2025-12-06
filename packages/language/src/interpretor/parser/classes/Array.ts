import { TypeToken, Token } from "../../lexer";
import type { PrimitivesJS } from "../../../types";
import Block from "./Block";
import { parse } from "../../parser";
import Parser from "./Parser";

// Array literal: (1 2 3 "hello")
class ArrayLiteral {
  type = TypeToken.LeftPar;
  elements: Parser;

  constructor(tokens: Token[]) {
    // For array literals, we need to separate elements by spaces
    // Add semicolons between consecutive primitives to separate them
    const separatedTokens: Token[] = [];
    for (let i = 0; i < tokens.length; i++) {
      separatedTokens.push(tokens[i]);
      // If current and next token are both primitives/values, add a separator
      if (i < tokens.length - 1) {
        const curr = tokens[i].type;
        const next = tokens[i + 1].type;
        const valueTypes = [TypeToken.Number, TypeToken.Text, TypeToken.Bool, TypeToken.Argument, TypeToken.Var];
        if (valueTypes.includes(curr) && valueTypes.includes(next)) {
          const sepToken = new Token(TypeToken.Semicolon, ";");
          sepToken.position = tokens[i].position;
          separatedTokens.push(sepToken);
        }
      }
    }
    this.elements = parse(separatedTokens);
  }

  toJSON(): any {
    return {
      type: "Array",
      elements: this.elements.ASTs.map(a => a.toJSON()),
    };
  }
}

// Array access: ${arr[0]} or $arr[0]
class ArrayAccess {
  type = TypeToken.LeftSqB;
  varName: string;
  indexBlock: Block;

  constructor(varName: string, indexBlock: Block) {
    this.varName = varName;
    this.indexBlock = indexBlock;
  }

  toJSON(): any {
    return {
      type: "ArrayAccess",
      varName: this.varName,
      index: this.indexBlock.toJSON(),
    };
  }
}

export { ArrayLiteral, ArrayAccess };
