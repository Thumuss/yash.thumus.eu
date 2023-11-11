import { TypeToken } from "../lexer";
import { Block, Keyword, Parser } from "../parser";

class If extends Keyword {
    p: Parser;
    block: Block
    constructor(type: TypeToken, p: Parser) {
        super(type);
        this.p = p
        const first = p.findNext(TypeToken.Then);
        const last = p.findNext(TypeToken.Fi);

        if (first === -1 || last === -1) throw "if error";

        this.block = new Block(TypeToken.LeftBracket, p.tokens.slice(first, last+1))
    }
}
