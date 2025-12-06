import { PrimitivesJS } from "../../../types";
import { Token, TypeToken } from "../../lexer";

class Primitive {
  type: TypeToken;
  value: PrimitivesJS;

  constructor(type: TypeToken, value: PrimitivesJS) {
    this.type = type;
    this.value = value;
  }

  static into(token: Token): Primitive {
    return new Primitive(token.type, token.value);
  }

  toJSON() {
    return {
      type: this.type,
      value: this.value,
    };
  }
}

export default Primitive;