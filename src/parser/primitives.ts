import { TypeToken, type Token } from "../lexer";
import { Command, Parser, PrimitivesParsed } from "../parser";
import type { NonOperators } from "../types";

function literal(t: Token, p: Parser, n?: NonOperators) {
    const obj = n || PrimitivesParsed.into(t);
    p.add(obj);
    p.next();
}

function nums (t: Token, p: Parser) {
    literal(t, p)
}

function text (t: Token, p: Parser) {
    literal(t, p)
}

function bool (t: Token, p: Parser) {
    literal(t, p)
}

function argument(t: Token, p: Parser) {
    if (p.before()?.type == TypeToken.Function) {
        // Ajout à la class fonction qui nomme donc la fonction
    } else if (p.after()?.type == TypeToken.LeftPar) {
        // créer une fonction littéralement
    } else if (p.before()?.type == TypeToken.Argument) {
        p.consume();
        (p.lastItem as Command).add(t as any);
    } else
    literal(t, p, new Command(t));
}

export { nums, text, bool, argument }