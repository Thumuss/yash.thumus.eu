import { NonOperators, Operators } from "../../../types";

class Equations {
  operations: (NonOperators | Operators)[] = [];

  constructor() {}

  toString() {
    this.operations.map((a) => a.toJSON());
  }
}

export default Equations;
