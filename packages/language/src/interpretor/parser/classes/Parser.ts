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
  copy: Token[];

  constructor(tokens: Token[]) {
    super(tokens);
    this.copy = [...tokens]
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

  // Helper to find the insertion point for a binary operator
  // Returns { parent, direction } where we should insert
  _findInsertPoint(obj: Binary, current: Binary | Unary, parent: Binary | Unary | null, direction: 'left' | 'right' | null): { node: Binary | Unary, parent: Binary | Unary | null, direction: 'left' | 'right' | null } {
    // If obj has higher priority (deeper in tree), go right
    if (obj.priority > current.priority) {
      // Check if right child is also a Binary/Unary that we should compare against
      if (current.right instanceof Binary || current.right instanceof Unary) {
        return this._findInsertPoint(obj, current.right, current, 'right');
      }
      // Insert here - obj takes current.right as its left
      return { node: current, parent, direction };
    }
    // obj has lower or equal priority, should be inserted above current
    return { node: current, parent, direction };
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
    } else if (parsed instanceof Binary || parsed instanceof Unary) {
      // Find the correct insertion point by traversing the tree
      const { node, parent, direction } = this._findInsertPoint(obj, parsed, null, null);
      
      if (obj.priority > node.priority) {
        // Insert obj between node and node.right
        obj.left = node.right;
        node.right = obj;
      } else {
        // obj becomes the new parent of node
        if (parent === null) {
          // node is the root
          obj.left = parsed;
          this.ASTs[this.idAST] = obj;
        } else {
          // Insert obj between parent and node
          obj.left = node;
          if (direction === 'right') {
            parent.right = obj;
          }
        }
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