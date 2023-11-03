enum TypeToken {
  Number = "Number",
  Text = "Text",
  Bool = "Bool",
  Argument = "Args",

  Var = "Var",       // TODO 
  Assignement = "=", // TODO
  Semicolon = ";", // TODO

  LeftPar = "(",
  RightPar = ")",

  And = "&&",
  Ampersand = "&",
  Or = "||",
  Not = "!",
  Eq = "==",    // TODO
  NotEq = "!=", // TODO
  GrEq = ">=",   // TODO
  LsEq = "<=",   // TODO
  Greater = ">",// TODO
  Less = "<",

  Plus = "+",
  Minus = "-",
  Slash = "/",
  Star = "*",
  Modulo = "%",
  Pow = "**",

  Pipe = "|",   // TODO: interface
  PipeOut = "|>",// TODO: interface
  PipeIn = "<|", // TODO: interface
}

type PrimitivesJS = string | boolean | number | null;

class Token {
  type: TypeToken;
  value: PrimitivesJS;
  plus: number;
  constructor(type: TypeToken, value?: PrimitivesJS) {
    this.plus = 0;
    this.type = type;
    this.value = value || type;
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

  while (str.length > i) {
    let element = str[i++];
    let obj: Token | undefined = undefined;
    if (!/\d/g.test(element) && !isTextActif && isNumberActif && !isArgumentActif && !isVar) stopNumber();
    if (!/[a-zA-Z\s]/g.test(element) && !isTextActif && !isNumberActif && isArgumentActif && !isVar) stopArgs();
    if (!/[a-zA-Z]/g.test(element) && !isTextActif && !isNumberActif && !isArgumentActif && isVar) stopVarName();
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
          if (str[i] == "&") {
            obj = new Token(TypeToken.And);
            i++;
          } else obj = new Token(TypeToken.Ampersand);
          break;
        case "|":
          if (str[i] == "|") {
            obj = new Token(TypeToken.Or);
            i++;
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
          if (str[i] == "*") {
            obj = new Token(TypeToken.Pow);
            i++;
          } else obj = new Token(TypeToken.Star);
          break;
        case ">":
          obj = new Token(TypeToken.Greater);
          break;
        case "<":
          obj = new Token(TypeToken.Less);
          break;
        case "!":
          obj = new Token(TypeToken.Not);
          break;
        case "%":
          obj = new Token(TypeToken.Modulo);
          break;
        case "$":
            isVar = true;
            stacker += element;
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
        case " ":
          if (!isArgumentActif || !/[a-zA-Z]/g.test(str[i]))
            break;
        default:
          if (/\d/.test(element)) {
            isNumberActif = true;
            stacker += element;
            break;
          }
          if (i + 2 < str.length && str.slice(i - 1, i + 3) == "true") {
            obj = new Token(TypeToken.Bool, true);
            i += 2;
            break;
          }
          if (i + 3 < str.length && str.slice(i - 1, i + 4) == "false") {
            i += 3;
            obj = new Token(TypeToken.Bool, false);
            break;
          }
          else {
            if (!isVar) {
              isArgumentActif = true;
            }
            stacker += element;
            break;
          }
      }
    //console.log(text, nb, element);
    if (obj) objects.push(obj);
  }
  if (isTextActif) objects.push(new Token(TypeToken.Text, stacker));
  if (isArgumentActif) objects.push(new Token(TypeToken.Argument, stacker));
  if (isNumberActif)
    objects.push(new Token(TypeToken.Number, parseInt(stacker)));
  return objects;
}

function test() {
  const b = (a: Token) => a.type;
  console.log(lexer("-1+1").map(b).join(" "));
  console.log(lexer(`1*(101+"eheh\\"eh1(2)))))'))")`).map(b).join(" "));
  console.log(lexer(`1 * 1`).map(b).join(" "));
  console.log(lexer(`!true / false`).map(b).join(" "));
  console.log(lexer(`true % 10-10%/|><||&`).map(b).join(" "));
  console.log(lexer(`aaaa + bbb`).map(b).join(" "));
  console.log(lexer(`$aaaa + bbb`).map(b).join(" "));
}

//test()

export { Token, TypeToken, lexer };
export type { PrimitivesJS };
