import { TermFunc } from "../../../types";
import { Token, TypeToken } from "../../lexer";

abstract class Reader {
  tokens: Token[];
  id: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  next(): void {
    this.id++;
  }

  end(i: number = 0): boolean {
    return this.tokens.length == this.id + i;
  }

  token(): Token {
    return this.tokens[this.id];
  }

  before(nb: number = 1): Token {
    return this.tokens[this.id - nb];
  }

  after(nb: number = 1): Token {
    return this.tokens[this.id + nb];
  }

  typeTokens(tokens = this.tokens) {
    return tokens.map((a) => a.type);
  }

  valTokens(tokens = this.tokens) {
    return tokens.map((a) => a.value);
  }

  consume() {
    this.tokens = this.tokens
      .slice(0, this.id)
      .concat(this.tokens.slice(this.id + 1));
  }

  findNext(type: TypeToken): number {
    return (
      this.tokens.slice(this.id).findIndex((a) => a.type == type) + this.id
    );
  }

  afterEqlTyp(type: TypeToken, nb = 0) {
    return this.after(nb)?.type === type;
  }

  beforeEqlTyp(type: TypeToken, nb = 0) {
    return this.before(nb)?.type === type;
  }

  termination(plus: TermFunc[], minus: TermFunc[]) {
    let i = 1;
    while (i != 0 && !this.end(1)) {
      this.next();
      const t = this.token();
      for (const onePlus of plus) {
        if (onePlus(t, i)) i++;
      }
      for (const oneMinus of minus) {
        if (oneMinus(t, i)) i--;
      }
    }
    return i == 0;
  }

  lastTokenBefore(type: TypeToken, nb: number = this.tokens.length - 1) {
    let i = 0;
    let last;
    do {
      last = nb - i;
      i++;
    } while (this.tokens[last]?.type != type);
    return last;
  }
}

export default Reader;
