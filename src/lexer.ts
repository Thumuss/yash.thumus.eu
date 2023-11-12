import { PrimitivesJS } from "./types";

enum TypeToken {
  // Primitives
  Number = "Number",
  Text = "Text",
  Bool = "Bool",
  Argument = "Args",

  // Vars
  Var = "Var", // TODO
  Assignement = "=", // TODO

  // End of a statement
  Semicolon = ";", // TODO
  Comma = ",", // TODO
  Backslash = "\\",

  // Pars
  LeftPar = "(",
  RightPar = ")",

  // Logical
  And = "&&",
  Ampersand = "&",
  Or = "||",
  Not = "!",
  Eq = "==",
  NotEq = "!=",
  GrEq = ">=",
  LsEq = "<=",
  Greater = ">",
  Less = "<",

  // Math
  Plus = "+",
  Minus = "-",
  Slash = "/",
  Star = "*",
  Modulo = "%",
  Pow = "**",

  // Bash
  Pipe = "|", // TODO: interface
  PipeOut = "|>", // TODO: interface
  PipeIn = "<|", // TODO: interface

  // Keywords of bash
  If = "if", // fait
  Then = "then", // Erreurs à faire
  Elif = "elif", // fait
  Else = "else", // fait
  Fi = "fi", // Erreurs à faire
  Time = "time",
  For = "for",
  In = "in",
  Until = "until",
  While = "while",
  Do = "do",
  Done = "done",
  Case = "case",
  Esac = "esac",
  Coproc = "coproc",
  Select = "select",
  Function = "function",
  LeftBracket = "{",
  RightBracket = "}",
  DoubleLeftSqB = "[[",
  DoubleRightSqB = "]]",

  Help = "?",
}

class Token {
  type: TypeToken;
  value: PrimitivesJS;
  plus: number;
  constructor(type: TypeToken, value?: PrimitivesJS) {
    this.plus = 0;
    this.type = type;
    this.value = typeof value === "undefined" ? type : value;
  }
}

function lexer(str: string): Token[] {
  let objects: Token[] = [];
  let i = 0;

  let isTextActif = false;
  let isNumberActif = false;
  let isArgumentActif = false;
  let isVar = false;

  let charText = "";
  let stacker = "";
  function stopNumber() {
    isNumberActif = false;
    objects.push(new Token(TypeToken.Number, parseInt(stacker)));
    stacker = "";
  }

  function stopArgs() {
    isArgumentActif = false;
    objects.push(new Token(TypeToken.Argument, stacker));
    stacker = "";
  }

  function stopVarName() {
    isVar = false;
    objects.push(new Token(TypeToken.Var, stacker));
    stacker = "";
  }

  const keywords = [
    "true",
    "false",
    "if",
    "then",
    "elif",
    "else",
    "fi",
    "time",
    "for",
    "in",
    "until",
    "while",
    "do",
    "done",
    "case",
    "esac",
    "coproc",
    "select",
    "function",
  ];

  function matchKeyword(word: string) {
    const wl = word.length;
    return (i + wl - 2 < str.length && str.slice(i - 1, i + wl - 1) === word) && (!/[a-zA-Z]/g.test(str[i + wl - 1]) || str[i + wl - 1] === undefined);
  }

  while (str.length > i) {
    let element = str[i++];
    let obj: Token | undefined = undefined;
    if (!/\d/g.test(element) && isNumberActif) stopNumber();
    if (!/[a-zA-Z]/g.test(element) && isArgumentActif) stopArgs();
    if (!/[a-zA-Z]/g.test(element) && isVar) stopVarName();
    if (isTextActif && element != charText) {
      stacker += element;
    } else
      switch (element) {
        case "(":
          obj = new Token(TypeToken.LeftPar);
          break;
        case ")":
          obj = new Token(TypeToken.RightPar);
          break;
        case "&":
          if (str[i] == "&" && i++) {
            obj = new Token(TypeToken.And);
          } else obj = new Token(TypeToken.Ampersand);
          break;
        case "|":
          if (str[i] == "|" && i++) {
            obj = new Token(TypeToken.Or);
          } else if (str[i] == ">" && i++) {
            obj = new Token(TypeToken.PipeOut);
          } else {
            obj = new Token(TypeToken.Pipe);
          }
          break;
        case "+":
          obj = new Token(TypeToken.Plus);
          break;
        case "-":
          obj = new Token(TypeToken.Minus);
          break;
        case "/":
          obj = new Token(TypeToken.Slash);
          break;
        case "*":
          if (str[i] == "*" && i++) {
            obj = new Token(TypeToken.Pow);
          } else obj = new Token(TypeToken.Star);
          break;
        case "\\":
          obj = new Token(TypeToken.Backslash);
          break;
        case "\n":
          if (objects.at(-1)?.type != TypeToken.Backslash)
            obj = new Token(TypeToken.Semicolon);
          break;
        case ">":
          if (str[i] == "=" && i++) obj = new Token(TypeToken.GrEq);
          else obj = new Token(TypeToken.Greater);
          break;
        case "<":
          if (str[i] == "=" && i++) obj = new Token(TypeToken.LsEq);
          else if (str[i] == "|" && i++) obj = new Token(TypeToken.PipeIn);
          else obj = new Token(TypeToken.Less);
          break;
        case "=":
          if (str[i] == "=" && i++) obj = new Token(TypeToken.Eq);
          else obj = new Token(TypeToken.Assignement);
          break;
        case "!":
        case "<":
          if (str[i] == "=" && i++) obj = new Token(TypeToken.NotEq);
          else obj = new Token(TypeToken.Not);
          break;
        case ";":
          obj = new Token(TypeToken.Semicolon);
          break;
        case "{":
          obj = new Token(TypeToken.LeftBracket);
          break;
        case "}":
          obj = new Token(TypeToken.RightBracket);
          break;
        case "%":
          obj = new Token(TypeToken.Modulo);
          break;
        case "$":
          isVar = true;
          stacker += element;
          break;
        case "[":
          if (str[i] == "[") {
            obj = new Token(TypeToken.DoubleLeftSqB);
          }
          break;
        case "]":
          if (str[i] == "]") {
            obj = new Token(TypeToken.DoubleLeftSqB);
          }
          break;
        case '"':
          if (str[i - 2] != "\\" && (!isTextActif || charText == '"')) {
            isTextActif = !isTextActif;
            if (isTextActif) {
              charText = '"';
            } else {
              obj = new Token(TypeToken.Text, stacker);
              stacker = "";
            }
            break;
          }
        case "'":
          if (str[i - 2] != "\\" && (!isTextActif || charText == "'")) {
            isTextActif = !isTextActif;
            if (isTextActif) {
              charText = "'";
            } else {
              obj = new Token(TypeToken.Text, stacker);
              stacker = "";
            }
            break;
          }
        case "'":
          if (str[i - 2] != "\\" && (!isTextActif || charText == "`")) {
            isTextActif = !isTextActif;
            if (isTextActif) {
              charText = "`";
            } else {
              obj = new Token(TypeToken.Text, stacker);
              stacker = "";
            }
            break;
          }
        case ",":
          obj = new Token(TypeToken.Comma);
          break;
        case " ":
          if (!isArgumentActif) break;
        default:
          if (/\d/.test(element)) {
            isNumberActif = true;
            stacker += element;
            break;
          }
          let matched = false;
          for (let keyw of keywords) {
            if (matchKeyword(keyw)) {
              let o = keyw === "true" || keyw === "false" ? "bool" : keyw;
              const name = (TypeToken as any)[o[0].toUpperCase() + o.slice(1)];
              const value =
                keyw === "true" || keyw == "false" ? keyw === "true" : keyw;
              obj = new Token(name, value);
              i += keyw.length - 1;
              matched = true;
              break;
            }
          }

          if (!matched) {
            if (!isVar) {
              isArgumentActif = true;
            }
            stacker += element;
            break;
          }

          break;
      }
    if (obj) objects.push(obj);
  }
  if (isTextActif) objects.push(new Token(TypeToken.Text, stacker));
  if (isArgumentActif) objects.push(new Token(TypeToken.Argument, stacker));
  if (isNumberActif)
    objects.push(new Token(TypeToken.Number, parseInt(stacker)));
  console.log(objects.map(a => a.type))
  return objects;
}

export { Token, TypeToken, lexer };
