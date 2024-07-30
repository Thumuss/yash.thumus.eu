import { NonOperators, PrimitivesJS } from "../../../types";
import { Token, TypeToken } from "../../lexer";

class Command {
  type: TypeToken = TypeToken.Argument;
  values: PrimitivesJS[];
  piped: boolean = false;

  constructor(token: Token) {
    this.values = (token.value as string).split(" ");
  }

  add(token: NonOperators) {
    if (token instanceof Command) {
      this.values.concat(token.values);
    } else if (token.type == TypeToken.Argument) {
      this.values.push(...(token.value as string).split(" "));
    } else if (token.type == TypeToken.Var) {
      this.values.push("$" + token.value); //todo: Adapter le var
    } else {
      this.values.push(token.value);
    }
  }

  toJSON() {
    return {
      type: this.type,
      values: this.values,
    };
  }
}

export default Command;
