import { PrimitivesJS } from "../types";

enum TypeToken {
  // Primitives
  Number = "Number",
  Text = "Text",
  Bool = "Bool",
  Argument = "Args",

  // Vars
  Var = "Var",
  Assignement = "=",

  // End of a statement
  Semicolon = ";",
  NewLine = "\\n",
  Comma = ",", // TODO
  Backslash = "\\",

  // Pars
  LeftPar = "(",
  RightPar = ")",

  Comment = "#",

  // Logical
  And = "&&",
  Ampersand = "&",
  Or = "||",
  Not = "!",
  Eq = "==",
  ApproxEq = "=~",
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
  PipeOut = "|>", // Pipe output / redirect to file
  PipeAppend = ">>", // Append to file
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
  Select = "select",
  Function = "function", // fait
  Local = "local", // PAS DU TOUT FAIT
  LeftBracket = "{", // Fait ?
  RightBracket = "}", // Fait ?
  DoubleLeftSqB = "[[",
  DoubleRightSqB = "]]",
  LeftSqB = "[",
  RightSqB = "]",

  Help = "?",
}

interface Position {
  lineStart: number;
  lineEnd?: number;
  columnStart: number;
  columnEnd?: number;
}

class Token {
  type: TypeToken;
  value: PrimitivesJS;
  plus: number;
  position!: Position;
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
  let isComment = false;

  let charText = "";
  let stacker = "";
  
  // Track position where current token started
  let tokenStartLine = 1;
  let tokenStartCol = 1;
  
  function stopNumber() {
    isNumberActif = false;
    const token = new Token(TypeToken.Number, parseInt(stacker));
    token.position = {
      lineStart: tokenStartLine,
      lineEnd: nbLine,
      columnStart: tokenStartCol,
      columnEnd: nbCols,
    };
    objects.push(token);
    stacker = "";
  }

  function stopArgs() {
    isArgumentActif = false;
    const token = new Token(TypeToken.Argument, stacker);
    token.position = {
      lineStart: tokenStartLine,
      lineEnd: nbLine,
      columnStart: tokenStartCol,
      columnEnd: nbCols,
    };
    objects.push(token);
    stacker = "";
  }

  function stopVarName() {
    isVar = false;
    const token = new Token(TypeToken.Var, stacker);
    token.position = {
      lineStart: tokenStartLine,
      lineEnd: nbLine,
      columnStart: tokenStartCol,
      columnEnd: nbCols,
    };
    objects.push(token);
    stacker = "";
  }

  // Special variables: $@, $*, $#, $?, $$, $!, $0-$9
  const specialVarChars = "@*#?$!-";
  function isSpecialVarChar(char: string): boolean {
    return specialVarChars.includes(char);
  }

  function stopComment() {
    isComment = false;
    stacker = "";
  }

  // Check if a character can be part of a path
  function isPathChar(char: string): boolean {
    return /[a-zA-Z0-9_.\-\/~]/.test(char);
  }

  // Check if current position looks like a path (starts after space/start and continues with path chars)
  function looksLikePath(): boolean {
    // Check if next char is a valid path character (not another / for division like // comments)
    const nextChar = str[i];
    if (!nextChar) return false;
    // If next char is a letter, digit, underscore, dot, or another /, it's likely a path
    return /[a-zA-Z0-9_.\-\/~]/.test(nextChar);
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
    "local",
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
    return (
      i + wl - 2 < str.length &&
      str.slice(i - 1, i + wl - 1) === word &&
      (!/[a-zA-Z]/g.test(str[i + wl - 1]) || str[i + wl - 1] === undefined)
    );
  }
  let nbLine = 1;
  let nbCols = 1;
  while (str.length > i) {
    let element = str[i++];
    let obj: Token | undefined = undefined;
    if (!/\d/g.test(element) && isNumberActif) stopNumber();
    if (!/[a-zA-Z0-9_.\-\/~]/g.test(element) && isArgumentActif) stopArgs();
    if (!/[a-zA-Z0-9_]/g.test(element) && isVar) stopVarName();
    if (/[\n]/g.test(element) && isComment) stopComment(); // change
    if ((isTextActif && element != charText) || isComment) {
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
          // Check if this is a path (starts with / followed by path chars)
          // and the previous token indicates this could be a command argument
          const lastToken = objects[objects.length - 1];
          const isAfterCommandContext = !lastToken || 
            lastToken.type === TypeToken.Argument ||
            lastToken.type === TypeToken.Semicolon ||
            lastToken.type === TypeToken.NewLine ||
            lastToken.type === TypeToken.Pipe ||
            lastToken.type === TypeToken.PipeOut ||
            lastToken.type === TypeToken.PipeIn ||
            lastToken.type === TypeToken.And ||
            lastToken.type === TypeToken.Or ||
            lastToken.type === TypeToken.LeftPar ||
            lastToken.type === TypeToken.LeftBrace;
          
          if (isAfterCommandContext && looksLikePath()) {
            // Parse as a path
            tokenStartLine = nbLine;
            tokenStartCol = nbCols;
            stacker = "/";
            while (i < str.length && isPathChar(str[i])) {
              stacker += str[i++];
              nbCols++;
            }
            const pathToken = new Token(TypeToken.Argument, stacker);
            pathToken.position = {
              lineStart: tokenStartLine,
              lineEnd: nbLine,
              columnStart: tokenStartCol,
              columnEnd: nbCols + 1,
            };
            objects.push(pathToken);
            stacker = "";
          } else {
            obj = new Token(TypeToken.Slash);
          }
          break;
        case "#":
          isComment = true;
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
          obj = new Token(TypeToken.NewLine);
          // Set position before incrementing line number
          obj.position = {
            lineStart: nbLine,
            lineEnd: nbLine,
            columnStart: nbCols,
            columnEnd: nbCols + 1,
          };
          nbLine++;
          nbCols = 0;
          // Skip normal position setting by pushing now
          objects.push(obj);
          obj = undefined;
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
          // Check if next char is a special variable character
          if (isSpecialVarChar(str[i])) {
            // Special variable like $@, $*, $#, $?, $$, $!
            obj = new Token(TypeToken.Var, str[i]);
            i++; // consume the special char
          } else {
            isVar = true;
            tokenStartLine = nbLine;
            tokenStartCol = nbCols;
          }
          break;
        case "[":
          if (str[i] == "[") {
            obj = new Token(TypeToken.DoubleLeftSqB);
            i++;
          } else {
            obj = new Token(TypeToken.LeftSqB);
          }
          break;
        case "]":
          if (str[i] == "]") {
            obj = new Token(TypeToken.DoubleRightSqB);
            i++;
          } else {
            obj = new Token(TypeToken.RightSqB);
          }
          break;
        case '"':
          if (str[i - 2] != "\\" && (!isTextActif || charText == '"')) {
            isTextActif = !isTextActif;
            if (isTextActif) {
              charText = '"';
              tokenStartLine = nbLine;
              tokenStartCol = nbCols;
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
              tokenStartLine = nbLine;
              tokenStartCol = nbCols;
            } else {
              obj = new Token(TypeToken.Text, stacker);
              stacker = "";
            }
            break;
          }
        case "`":
          if (str[i - 2] != "\\" && (!isTextActif || charText == "`")) {
            isTextActif = !isTextActif;
            if (isTextActif) {
              charText = "`";
              tokenStartLine = nbLine;
              tokenStartCol = nbCols;
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
          if (/\d/.test(element) && !isVar && !isArgumentActif) {
            if (!isNumberActif) {
              tokenStartLine = nbLine;
              tokenStartCol = nbCols;
            }
            isNumberActif = true;
            stacker += element;
            break;
          }
          if (isArgumentActif) {
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
              tokenStartLine = nbLine;
              tokenStartCol = nbCols;
            }
            stacker += element;
            break;
          }

          break;
      }
    if (obj) {
      obj.position = {
        lineStart: nbLine,
        lineEnd: nbLine + 1,
        columnStart: nbCols,
        columnEnd: nbCols + String(obj.value).length,
      };
      objects.push(obj);
    }
    nbCols++;
  }

  // Handle tokens still being captured at end of input
  if (isTextActif) {
    const token = new Token(TypeToken.Text, stacker);
    token.position = {
      lineStart: tokenStartLine,
      lineEnd: nbLine,
      columnStart: tokenStartCol,
      columnEnd: nbCols,
    };
    objects.push(token);
  }
  if (isArgumentActif) {
    const token = new Token(TypeToken.Argument, stacker);
    token.position = {
      lineStart: tokenStartLine,
      lineEnd: nbLine,
      columnStart: tokenStartCol,
      columnEnd: nbCols,
    };
    objects.push(token);
  }
  if (isVar) {
    const token = new Token(TypeToken.Var, stacker);
    token.position = {
      lineStart: tokenStartLine,
      lineEnd: nbLine,
      columnStart: tokenStartCol,
      columnEnd: nbCols,
    };
    objects.push(token);
  }
  if (isNumberActif) {
    const token = new Token(TypeToken.Number, parseInt(stacker));
    token.position = {
      lineStart: tokenStartLine,
      lineEnd: nbLine,
      columnStart: tokenStartCol,
      columnEnd: nbCols,
    };
    objects.push(token);
  }

  return objects;
}

export { Token, TypeToken, lexer };
