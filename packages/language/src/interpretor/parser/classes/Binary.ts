import { AST } from "../../../types";
import { Token, TypeToken } from "../../lexer";
import { orderPriority } from "../../parser";

class Binary {
  type: TypeToken;
  left?: AST;
  right?: AST;
  priority: number;
  constructor(token: Token, right?: AST, left?: AST) {
    this.type = token.type;
    this.right = right;
    this.left = left;
    this.priority =
      token.plus + orderPriority.findIndex((a) => a == token.type);
  }

  toJSON(): any {
    return {
      type: this.type,
      left: this.left?.toJSON(),
      right: this.right?.toJSON(),
    };
  }
}

export default Binary;
