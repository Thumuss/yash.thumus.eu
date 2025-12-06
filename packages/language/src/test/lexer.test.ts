import { describe, expect, test } from "bun:test";
import { lexer, Token, TypeToken } from "../interpretor/lexer";

describe("Lexer", () => {
  describe("Primitives", () => {
    test("should tokenize numbers", () => {
      const tokens = lexer("42");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Number);
      expect(tokens[0].value).toBe(42);
    });

    test("should tokenize negative numbers via minus operator", () => {
      const tokens = lexer("-42");
      expect(tokens.length).toBe(2);
      expect(tokens[0].type).toBe(TypeToken.Minus);
      expect(tokens[1].type).toBe(TypeToken.Number);
      expect(tokens[1].value).toBe(42);
    });

    test("should tokenize double-quoted strings", () => {
      const tokens = lexer('"hello world"');
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Text);
      expect(tokens[0].value).toBe("hello world");
    });

    test("should tokenize single-quoted strings", () => {
      const tokens = lexer("'hello world'");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Text);
      expect(tokens[0].value).toBe("hello world");
    });

    test("should tokenize backtick strings", () => {
      const tokens = lexer("`hello world`");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Text);
      expect(tokens[0].value).toBe("hello world");
    });

    test("should tokenize booleans", () => {
      const tokensTrue = lexer("true");
      expect(tokensTrue.length).toBe(1);
      expect(tokensTrue[0].type).toBe(TypeToken.Bool);
      expect(tokensTrue[0].value).toBe(true);

      const tokensFalse = lexer("false");
      expect(tokensFalse.length).toBe(1);
      expect(tokensFalse[0].type).toBe(TypeToken.Bool);
      expect(tokensFalse[0].value).toBe(false);
    });

    test("should tokenize arguments (identifiers)", () => {
      const tokens = lexer("echo");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Argument);
      expect(tokens[0].value).toBe("echo");
    });
  });

  describe("Variables", () => {
    test("should tokenize simple variables", () => {
      const tokens = lexer("$myvar");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Var);
      expect(tokens[0].value).toBe("myvar");
    });

    test("should tokenize positional variables", () => {
      const tokens = lexer("$1");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Var);
      expect(tokens[0].value).toBe("1");
    });

    test("should tokenize special variables", () => {
      // $@ - all positional parameters
      let tokens = lexer("$@");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Var);
      expect(tokens[0].value).toBe("@");
      
      // $* - all positional parameters as single word
      tokens = lexer("$*");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Var);
      expect(tokens[0].value).toBe("*");
      
      // $# - number of positional parameters
      tokens = lexer("$#");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Var);
      expect(tokens[0].value).toBe("#");
      
      // $? - exit status of last command
      tokens = lexer("$?");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Var);
      expect(tokens[0].value).toBe("?");
      
      // $$ - current process ID
      tokens = lexer("$$");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Var);
      expect(tokens[0].value).toBe("$");
      
      // $! - PID of last background command
      tokens = lexer("$!");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TypeToken.Var);
      expect(tokens[0].value).toBe("!");
    });
  });

  describe("Operators - Logical", () => {
    test("should tokenize &&", () => {
      const tokens = lexer("a && b");
      expect(tokens.some((t) => t.type === TypeToken.And)).toBe(true);
    });

    test("should tokenize ||", () => {
      const tokens = lexer("a || b");
      expect(tokens.some((t) => t.type === TypeToken.Or)).toBe(true);
    });

    test("should tokenize !", () => {
      const tokens = lexer("!true");
      expect(tokens[0].type).toBe(TypeToken.Not);
    });

    test("should tokenize ==", () => {
      const tokens = lexer("a == b");
      expect(tokens.some((t) => t.type === TypeToken.Eq)).toBe(true);
    });

    test("should tokenize !=", () => {
      const tokens = lexer("a != b");
      expect(tokens.some((t) => t.type === TypeToken.NotEq)).toBe(true);
    });

    test("should tokenize comparison operators", () => {
      expect(lexer("a > b").some((t) => t.type === TypeToken.Greater)).toBe(
        true
      );
      expect(lexer("a < b").some((t) => t.type === TypeToken.Less)).toBe(true);
      expect(lexer("a >= b").some((t) => t.type === TypeToken.GrEq)).toBe(true);
      expect(lexer("a <= b").some((t) => t.type === TypeToken.LsEq)).toBe(true);
    });
  });

  describe("Operators - Math", () => {
    test("should tokenize +", () => {
      const tokens = lexer("1 + 2");
      expect(tokens.some((t) => t.type === TypeToken.Plus)).toBe(true);
    });

    test("should tokenize -", () => {
      const tokens = lexer("1 - 2");
      expect(tokens.some((t) => t.type === TypeToken.Minus)).toBe(true);
    });

    test("should tokenize *", () => {
      const tokens = lexer("1 * 2");
      expect(tokens.some((t) => t.type === TypeToken.Star)).toBe(true);
    });

    test("should tokenize /", () => {
      const tokens = lexer("1 / 2");
      expect(tokens.some((t) => t.type === TypeToken.Slash)).toBe(true);
    });

    test("should tokenize %", () => {
      const tokens = lexer("1 % 2");
      expect(tokens.some((t) => t.type === TypeToken.Modulo)).toBe(true);
    });

    test("should tokenize **", () => {
      const tokens = lexer("2 ** 3");
      expect(tokens.some((t) => t.type === TypeToken.Pow)).toBe(true);
    });
  });

  describe("Operators - Bash", () => {
    test("should tokenize |", () => {
      const tokens = lexer("a | b");
      expect(tokens.some((t) => t.type === TypeToken.Pipe)).toBe(true);
    });

    test("should tokenize |>", () => {
      const tokens = lexer("a |> b");
      expect(tokens.some((t) => t.type === TypeToken.PipeOut)).toBe(true);
    });

    test("should tokenize <|", () => {
      const tokens = lexer("a <| b");
      expect(tokens.some((t) => t.type === TypeToken.PipeIn)).toBe(true);
    });

    test("should tokenize &", () => {
      const tokens = lexer("command &");
      expect(tokens.some((t) => t.type === TypeToken.Ampersand)).toBe(true);
    });
  });

  describe("Keywords", () => {
    test("should tokenize if/then/else/fi", () => {
      const tokens = lexer("if then else fi");
      expect(tokens.some((t) => t.type === TypeToken.If)).toBe(true);
      expect(tokens.some((t) => t.type === TypeToken.Then)).toBe(true);
      expect(tokens.some((t) => t.type === TypeToken.Else)).toBe(true);
      expect(tokens.some((t) => t.type === TypeToken.Fi)).toBe(true);
    });

    test("should tokenize elif", () => {
      const tokens = lexer("elif");
      expect(tokens[0].type).toBe(TypeToken.Elif);
    });

    test("should tokenize function", () => {
      const tokens = lexer("function");
      expect(tokens[0].type).toBe(TypeToken.Function);
    });

    test("should tokenize while/do/done", () => {
      const tokens = lexer("while do done");
      expect(tokens.some((t) => t.type === TypeToken.While)).toBe(true);
      expect(tokens.some((t) => t.type === TypeToken.Do)).toBe(true);
      expect(tokens.some((t) => t.type === TypeToken.Done)).toBe(true);
    });

    test("should tokenize for/in", () => {
      const tokens = lexer("for in");
      expect(tokens.some((t) => t.type === TypeToken.For)).toBe(true);
      expect(tokens.some((t) => t.type === TypeToken.In)).toBe(true);
    });

    test("should tokenize case/esac", () => {
      const tokens = lexer("case esac");
      expect(tokens.some((t) => t.type === TypeToken.Case)).toBe(true);
      expect(tokens.some((t) => t.type === TypeToken.Esac)).toBe(true);
    });

    test("should tokenize local", () => {
      const tokens = lexer("local");
      expect(tokens[0].type).toBe(TypeToken.Local);
    });
  });

  describe("Delimiters", () => {
    test("should tokenize semicolon", () => {
      const tokens = lexer("a; b");
      expect(tokens.some((t) => t.type === TypeToken.Semicolon)).toBe(true);
    });

    test("should tokenize newline", () => {
      const tokens = lexer("a\nb");
      expect(tokens.some((t) => t.type === TypeToken.NewLine)).toBe(true);
    });

    test("should tokenize parentheses", () => {
      const tokens = lexer("(a)");
      expect(tokens[0].type).toBe(TypeToken.LeftPar);
      expect(tokens[2].type).toBe(TypeToken.RightPar);
    });

    test("should tokenize braces", () => {
      const tokens = lexer("{ a }");
      expect(tokens[0].type).toBe(TypeToken.LeftBracket);
      expect(tokens[2].type).toBe(TypeToken.RightBracket);
    });
  });

  describe("Comments", () => {
    test("should ignore comments", () => {
      const tokens = lexer("echo # this is a comment\nhello");
      // The comment content should not appear as tokens
      expect(tokens.some((t) => t.value === "this")).toBe(false);
    });
  });

  describe("Complex expressions", () => {
    test("should tokenize assignment", () => {
      const tokens = lexer("x = 42");
      expect(tokens[0].type).toBe(TypeToken.Argument);
      expect(tokens[1].type).toBe(TypeToken.Assignement);
      expect(tokens[2].type).toBe(TypeToken.Number);
    });

    test("should tokenize command with arguments", () => {
      const tokens = lexer('echo "hello" $name');
      expect(tokens[0].type).toBe(TypeToken.Argument);
      expect(tokens[0].value).toBe("echo");
      expect(tokens[1].type).toBe(TypeToken.Text);
      expect(tokens[2].type).toBe(TypeToken.Var);
    });

    test("should tokenize math expression", () => {
      const tokens = lexer("1 + 2 * 3");
      expect(tokens.length).toBe(5);
      expect(tokens[0].type).toBe(TypeToken.Number);
      expect(tokens[1].type).toBe(TypeToken.Plus);
      expect(tokens[2].type).toBe(TypeToken.Number);
      expect(tokens[3].type).toBe(TypeToken.Star);
      expect(tokens[4].type).toBe(TypeToken.Number);
    });
  });

  describe("Position tracking", () => {
    test("should track line and column positions", () => {
      const tokens = lexer("a\nb");
      // First token 'a' is on line 1
      expect(tokens[0].type).toBe(TypeToken.Argument);
      expect(tokens[0].value).toBe("a");
      expect(tokens[0].position.lineStart).toBe(1);
      expect(tokens[0].position.columnStart).toBe(1);
      
      // Newline token
      expect(tokens[1].type).toBe(TypeToken.NewLine);
      expect(tokens[1].position.lineStart).toBe(1);
      
      // Second token 'b' is on line 2
      expect(tokens[2].type).toBe(TypeToken.Argument);
      expect(tokens[2].value).toBe("b");
      expect(tokens[2].position.lineStart).toBe(2);
      expect(tokens[2].position.columnStart).toBe(1);
    });
    
    test("should track column positions accurately", () => {
      const tokens = lexer("ab cd");
      expect(tokens[0].value).toBe("ab");
      expect(tokens[0].position.columnStart).toBe(1);
      expect(tokens[1].value).toBe("cd");
      expect(tokens[1].position.columnStart).toBe(4);
    });
  });
});
