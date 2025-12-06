import { describe, expect, test } from "bun:test";
import { lexer, TypeToken } from "../interpretor/lexer";
import { parse } from "../interpretor/parser";
import Binary from "../interpretor/parser/classes/Binary";
import Command from "../interpretor/parser/classes/Command";
import Primitive from "../interpretor/parser/classes/Primitives";
import Unary from "../interpretor/parser/classes/Unary";
import { If, Else, Functions, Local } from "../interpretor/parser/functions/keywords";

describe("Parser", () => {
  describe("Primitives", () => {
    test("should parse a number", () => {
      const tokens = lexer("42");
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(1);
      expect(result.ASTs[0]).toBeInstanceOf(Primitive);
      expect((result.ASTs[0] as Primitive).value).toBe(42);
    });

    test("should parse a string", () => {
      const tokens = lexer('"hello"');
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(1);
      expect(result.ASTs[0]).toBeInstanceOf(Primitive);
      expect((result.ASTs[0] as Primitive).value).toBe("hello");
    });

    test("should parse a boolean", () => {
      const tokens = lexer("true");
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(1);
      expect(result.ASTs[0]).toBeInstanceOf(Primitive);
      expect((result.ASTs[0] as Primitive).value).toBe(true);
    });

    test("should parse a variable", () => {
      const tokens = lexer("$myvar");
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(1);
      expect(result.ASTs[0]).toBeInstanceOf(Primitive);
      expect((result.ASTs[0] as Primitive).type).toBe(TypeToken.Var);
    });
  });

  describe("Commands", () => {
    test("should parse a simple command", () => {
      const tokens = lexer("echo");
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(1);
      expect(result.ASTs[0]).toBeInstanceOf(Command);
      expect((result.ASTs[0] as Command).values).toContain("echo");
    });

    test("should parse a command with string argument", () => {
      const tokens = lexer('echo "hello"');
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(1);
      expect(result.ASTs[0]).toBeInstanceOf(Command);
      const cmd = result.ASTs[0] as Command;
      expect(cmd.values).toContain("echo");
      expect(cmd.values).toContain("hello");
    });

    test("should parse a command with variable argument", () => {
      const tokens = lexer("echo $name");
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(1);
      expect(result.ASTs[0]).toBeInstanceOf(Command);
      const cmd = result.ASTs[0] as Command;
      expect(cmd.values).toContain("echo");
      expect(cmd.values).toContain("$name");
    });

    test("should parse a command with multiple arguments", () => {
      const tokens = lexer("echo hello world");
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(1);
      expect(result.ASTs[0]).toBeInstanceOf(Command);
      const cmd = result.ASTs[0] as Command;
      expect(cmd.values.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Binary Operators", () => {
    test("should parse addition", () => {
      const tokens = lexer("1 + 2");
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(1);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      const bin = result.ASTs[0] as Binary;
      expect(bin.type).toBe(TypeToken.Plus);
      expect(bin.left).toBeInstanceOf(Primitive);
      expect(bin.right).toBeInstanceOf(Primitive);
    });

    test("should parse subtraction", () => {
      const tokens = lexer("5 - 3");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      expect((result.ASTs[0] as Binary).type).toBe(TypeToken.Minus);
    });

    test("should parse multiplication", () => {
      const tokens = lexer("2 * 3");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      expect((result.ASTs[0] as Binary).type).toBe(TypeToken.Star);
    });

    test("should parse division", () => {
      const tokens = lexer("6 / 2");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      expect((result.ASTs[0] as Binary).type).toBe(TypeToken.Slash);
    });

    test("should parse modulo", () => {
      const tokens = lexer("7 % 3");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      expect((result.ASTs[0] as Binary).type).toBe(TypeToken.Modulo);
    });

    test("should parse power", () => {
      const tokens = lexer("2 ** 3");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      expect((result.ASTs[0] as Binary).type).toBe(TypeToken.Pow);
    });

    test("should respect operator precedence (multiply before add)", () => {
      const tokens = lexer("1 + 2 * 3");
      const result = parse(tokens);
      // Should be parsed as 1 + (2 * 3)
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      const bin = result.ASTs[0] as Binary;
      expect(bin.type).toBe(TypeToken.Plus);
      expect(bin.right).toBeInstanceOf(Binary);
      expect((bin.right as Binary).type).toBe(TypeToken.Star);
    });

    test("should parse logical AND", () => {
      const tokens = lexer("true && false");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      expect((result.ASTs[0] as Binary).type).toBe(TypeToken.And);
    });

    test("should parse logical OR", () => {
      const tokens = lexer("true || false");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      expect((result.ASTs[0] as Binary).type).toBe(TypeToken.Or);
    });

    test("should parse equality", () => {
      const tokens = lexer("a == b");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      expect((result.ASTs[0] as Binary).type).toBe(TypeToken.Eq);
    });

    test("should parse inequality", () => {
      const tokens = lexer("a != b");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      expect((result.ASTs[0] as Binary).type).toBe(TypeToken.NotEq);
    });

    test("should parse comparison operators", () => {
      expect((parse(lexer("1 > 2")).ASTs[0] as Binary).type).toBe(
        TypeToken.Greater
      );
      expect((parse(lexer("1 < 2")).ASTs[0] as Binary).type).toBe(
        TypeToken.Less
      );
      expect((parse(lexer("1 >= 2")).ASTs[0] as Binary).type).toBe(
        TypeToken.GrEq
      );
      expect((parse(lexer("1 <= 2")).ASTs[0] as Binary).type).toBe(
        TypeToken.LsEq
      );
    });
  });

  describe("Unary Operators", () => {
    test("should parse logical NOT", () => {
      const tokens = lexer("!true");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Unary);
      expect((result.ASTs[0] as Unary).type).toBe(TypeToken.Not);
    });

    test("should parse background operator &", () => {
      const tokens = lexer("command &");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Unary);
      expect((result.ASTs[0] as Unary).type).toBe(TypeToken.Ampersand);
    });
  });

  describe("Assignments", () => {
    test("should parse variable assignment with number", () => {
      const tokens = lexer("x = 42");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      const bin = result.ASTs[0] as Binary;
      expect(bin.type).toBe(TypeToken.Assignement);
      expect(bin.right).toBeInstanceOf(Primitive);
      expect((bin.right as Primitive).value).toBe(42);
    });

    test("should parse variable assignment with expression", () => {
      const tokens = lexer("x = 1 + 2");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      const bin = result.ASTs[0] as Binary;
      expect(bin.type).toBe(TypeToken.Assignement);
      expect(bin.right).toBeInstanceOf(Binary);
    });
  });

  describe("Multiple Statements", () => {
    test("should parse statements separated by semicolon", () => {
      const tokens = lexer("a = 1; b = 2");
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(2);
    });

    test("should parse statements separated by newline", () => {
      const tokens = lexer("a = 1\nb = 2");
      const result = parse(tokens);
      expect(result.ASTs.length).toBe(2);
    });
  });

  describe("Functions", () => {
    test("should parse function definition with braces", () => {
      const tokens = lexer("function test { echo hello }");
      const result = parse(tokens);
      expect(result.ASTs.length).toBeGreaterThanOrEqual(1);
      expect(result.ASTs[0]).toBeInstanceOf(Functions);
      const func = result.ASTs[0] as Functions;
      expect(func.name).toBe("test");
    });

    test("should parse function definition with parentheses syntax", () => {
      const tokens = lexer("test() { echo hello }");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Functions);
    });
  });

  describe("Conditionals", () => {
    test("should parse if/then/fi", () => {
      const tokens = lexer("if (true)\nthen\necho yes\nfi");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(If);
    });

    test("should parse if/then/else/fi", () => {
      const tokens = lexer("if (true)\nthen\necho yes\nelse\nthen\necho no\nfi");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(If);
      const ifStmt = result.ASTs[0] as If;
      expect(ifStmt.continue).toBeInstanceOf(Else);
    });
  });

  describe("Local variables", () => {
    test("should parse local variable declaration", () => {
      const tokens = lexer("local x = 42");
      const result = parse(tokens);
      expect(result.ASTs.length).toBeGreaterThanOrEqual(1);
      expect(result.ASTs[0]).toBeInstanceOf(Local);
      const local = result.ASTs[0] as Local;
      expect(local.varName).toBe("x");
    });
    
    test("should parse local variable without value", () => {
      const tokens = lexer("local y");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Local);
      const local = result.ASTs[0] as Local;
      expect(local.varName).toBe("y");
      expect(local.valueBlock).toBeUndefined();
    });
  });

  describe("Parentheses for grouping", () => {
    test("should parse parenthesized expressions", () => {
      const tokens = lexer("(1 + 2) * 3");
      const result = parse(tokens);
      expect(result.ASTs[0]).toBeInstanceOf(Binary);
      const bin = result.ASTs[0] as Binary;
      expect(bin.type).toBe(TypeToken.Star);
      // Left should be the result of (1 + 2)
      expect(bin.left).toBeInstanceOf(Binary);
      expect((bin.left as Binary).type).toBe(TypeToken.Plus);
    });
  });

  describe("toJSON", () => {
    test("should serialize AST to JSON", () => {
      const tokens = lexer("1 + 2");
      const result = parse(tokens);
      const json = result.toJSON();
      expect(Array.isArray(json)).toBe(true);
      expect(json[0].type).toBe(TypeToken.Plus);
    });
  });
});
