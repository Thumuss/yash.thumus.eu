import { Token, TypeToken } from "./lexer";
import {
  keywords,
  operators,
  primitives,
} from "./parser/functions/exportParser";
import Parser from "./parser/classes/Parser";

const orderPriority: TypeToken[] = [
  TypeToken.If,
  TypeToken.Then,
  TypeToken.Elif,
  TypeToken.Else,
  TypeToken.Fi,
  TypeToken.Time,
  TypeToken.For,
  TypeToken.In,
  TypeToken.Until,
  TypeToken.While,
  TypeToken.Do,
  TypeToken.Done,
  TypeToken.Case,
  TypeToken.Esac,
  TypeToken.Select,
  TypeToken.Function,

  TypeToken.Semicolon,

  TypeToken.PipeOut,
  TypeToken.Ampersand,
  TypeToken.Pipe,

  TypeToken.Eq,
  TypeToken.NotEq,
  TypeToken.GrEq,
  TypeToken.LsEq,

  TypeToken.Or,
  TypeToken.And,
  TypeToken.Less,
  TypeToken.Greater,
  TypeToken.Not,

  TypeToken.Plus,
  TypeToken.Minus,
  TypeToken.Star,
  TypeToken.Slash,
  TypeToken.Modulo,
  TypeToken.Pow,

  TypeToken.PipeIn,
  TypeToken.DoubleLeftSqB,
  TypeToken.DoubleRightSqB,
  TypeToken.LeftBracket,
  TypeToken.RightBracket,

  TypeToken.Help,
];

function parse(tokens: Token[]): Parser {
  const p = new Parser(tokens);
  let i = 0;
  while (!p.end()) {
    const t = p.token();
    t.plus = i * 100;
    switch (t.type) {
      case TypeToken.Ampersand:
        operators.ampersand(t, p);
        break;
      case TypeToken.And:
        operators.and(t, p);
        break;
      case TypeToken.Argument:
        if (!keywords.functions(t, p)) {
          primitives.argument(t, p);
        }
        break;
      case TypeToken.Assignement:
        operators.assignement(t, p);
        break;
      case TypeToken.NewLine:
        operators.newline(t, p);
        break;
      case TypeToken.Bool:
        primitives.bool(t, p);
        break;
      case TypeToken.Eq:
        operators.equal(t, p);
        break;
      case TypeToken.Function:
        keywords.functions(t, p);
        break;
      case TypeToken.GrEq:
        operators.greaterequal(t, p);
        break;
      case TypeToken.Greater:
        operators.greater(t, p);
        break;
      case TypeToken.LeftPar:
        p.next();
        i++;
        break;
      case TypeToken.Less:
        operators.less(t, p);
        break;
      case TypeToken.LsEq:
        operators.lessequal(t, p);
        break;
      case TypeToken.Minus:
        operators.minus(t, p);
        break;
      case TypeToken.Modulo:
        operators.modulo(t, p);
        break;
      case TypeToken.Not:
        operators.not(t, p);
        break;
      case TypeToken.NotEq:
        operators.notequal(t, p);
        break;
      case TypeToken.Number:
        primitives.nums(t, p);
        break;
      case TypeToken.Or:
        operators.or(t, p);
        break;
      case TypeToken.Pipe:
        operators.pipe(t, p);
        break;
      case TypeToken.PipeIn:
        operators.pipein(t, p);
        break;
      case TypeToken.PipeOut:
        operators.pipeout(t, p);
        break;
      case TypeToken.Plus:
        operators.plus(t, p);
        break;
      case TypeToken.Pow:
        operators.pow(t, p);
        break;
      case TypeToken.RightPar:
        p.next();
        i--;
        break;
      case TypeToken.Semicolon:
        operators.semicolon(t, p);
        break;
      case TypeToken.Slash:
        operators.slash(t, p);
        break;
      case TypeToken.Star:
        operators.star(t, p);
        break;
      case TypeToken.Text:
        primitives.text(t, p);
        break;
      case TypeToken.If:
        keywords.ifs(t, p);
        break;
      case TypeToken.Elif:
        keywords.elif(t, p);
        break;
      case TypeToken.Else:
        keywords.elses(t, p);
        break;
      case TypeToken.Var:
        primitives.vars(t, p);
        break;
      default:
        p.next();
        break;
    }
  }
  return p;
}

export { parse, orderPriority };
