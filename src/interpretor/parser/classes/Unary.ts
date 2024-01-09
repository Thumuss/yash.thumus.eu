import { AST } from "../../../types";
import { Token, TypeToken } from "../../lexer";
import { orderPriority } from "../../parser";

class Unary {
    type: TypeToken;
    right?: AST;
    priority: number;
    constructor(token: Token, right?: AST) {
      this.type = token.type;
      this.right = right;
      this.priority =
        token.plus + orderPriority
        .findIndex((a) => a == token.type);
    }
  
    toJSON(): any {
      return {
        type: this.type,
        right: this.right?.toJSON(),
      };
    }
  }

export default Unary