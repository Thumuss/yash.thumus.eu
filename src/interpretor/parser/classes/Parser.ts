import { AST, Keywords, NonOperators } from "../../../types";
import { Token, TypeToken } from "../../lexer";
import { Keyword } from "../functions/keywords";
import Binary from "./Binary";
import Block from "./Block";
import Command from "./Command";
import Primitive from "./Primitives";
import Reader from "./Reader";
import Unary from "./Unary";

class Parser extends Reader {
  ASTs: AST[] = [];
  idAST: number = 0;
  lItem?: AST;

  constructor(tokens: Token[]) {
    super(tokens);
  }

  get currentAst() {
    return this.ASTs[this.idAST];
  }

  changeIfNotEmpty() {
    if (this.currentAst !== undefined) {
      this.idAST++;
    }
  }

  add(obj: AST) {
    this.lItem = obj;
    if (obj instanceof Primitive || obj instanceof Command) {
      this._obj(obj);
    } else if (obj instanceof Binary) {
      this._binary(obj);
    } else if (obj instanceof Unary) {
      this._unary(obj);
    } else {
      this._block_keywords(obj);
    }
  }

  _obj(obj: NonOperators, parsed = this.currentAst) {
    if (
      parsed instanceof Primitive ||
      parsed instanceof Block ||
      parsed instanceof Keyword
    )
      throw "Error AddObj";
    if (
      parsed instanceof Command &&
      (obj.type == TypeToken.Argument ||
        obj.type == TypeToken.Text ||
        obj.type == TypeToken.Bool ||
        obj.type == TypeToken.Number ||
        obj.type == TypeToken.Var)
    )
      return parsed.add(obj);
    if (parsed instanceof Command) throw "Error";
    if (parsed === undefined) return (this.ASTs[this.idAST] = obj);
    if (!(parsed instanceof Unary) && !parsed.left) return (parsed.left = obj);
    if (!parsed.right) return (parsed.right = obj);
    this._obj(obj, parsed.right);
  }

  _binary(obj: Binary) {
    const parsed = this.currentAst;
    if (
      parsed === undefined ||
      parsed instanceof Block ||
      parsed instanceof Keyword
    )
      throw "Error Bin op";
    if (parsed instanceof Primitive || parsed instanceof Command) {
      obj.left = parsed;
      this.ASTs[this.idAST] = obj;
    } else {
      if (obj.priority > parsed.priority) {
        obj.left = parsed.right;
        (this.currentAst as Binary).right = obj;
      } else {
        obj.left = parsed;
        this.ASTs[this.idAST] = obj;
      }
    }
  }

  _unary(obj: Unary) {
    const parsed = this.currentAst;
    if (!(parsed instanceof Binary) && parsed != undefined) throw "Error una";
    if (parsed === undefined) return (this.ASTs[this.idAST] = obj);
    if (obj.priority > parsed.priority) {
      obj.right = parsed.right;
      (this.currentAst as Unary).right = obj;
    } else {
      obj.right = parsed;
      this.ASTs[this.idAST] = obj;
    }
  }

  _block_keywords(obj: Block | Keywords) {
    this.changeIfNotEmpty();
    this.ASTs[this.idAST] = obj;
    this.idAST++;
  }

  toJSON(): any {
    return this.ASTs.map((a) => a.toJSON());
  }
}

export default Parser;