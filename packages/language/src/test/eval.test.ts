import { describe, expect, test } from "bun:test";
import { run } from "../runner";
import type { Bridge, PrimitivesJS, VariablesYash } from "../types";

// Helper to create a mock bridge that captures output
function createMockBridge(): Bridge & { output: PrimitivesJS[]; errors: PrimitivesJS[] } {
  const output: PrimitivesJS[] = [];
  const errors: PrimitivesJS[] = [];
  
  return {
    global_functions: {},
    global_variables: {},
    output,
    errors,
    out: (...args: PrimitivesJS[]) => {
      output.push(...args);
    },
    err: (...args: PrimitivesJS[]) => {
      errors.push(...args);
    },
    exec: async (vals: PrimitivesJS[]) => {
      // Mock exec - just return the command as string for testing
      return vals.join(" ");
    },
  };
}

describe("Evaluator", () => {
  describe("Primitives", () => {
    test("should evaluate numbers", async () => {
      const bridge = createMockBridge();
      await run("42", bridge);
      expect(bridge.output).toContain(42);
    });

    test("should evaluate strings", async () => {
      const bridge = createMockBridge();
      await run('"hello"', bridge);
      expect(bridge.output).toContain("hello");
    });

    test("should evaluate booleans", async () => {
      const bridge = createMockBridge();
      await run("true", bridge);
      expect(bridge.output).toContain(true);
    });
  });

  describe("Variables", () => {
    test("should assign and retrieve variables", async () => {
      const bridge = createMockBridge();
      await run("x = 42\n$x", bridge);
      expect(bridge.output).toContain(42);
    });

    test("should assign expression result to variable", async () => {
      const bridge = createMockBridge();
      await run("x = 1 + 2\n$x", bridge);
      expect(bridge.output).toContain(3);
    });

    test("should access global variables from bridge", async () => {
      const bridge = createMockBridge();
      bridge.global_variables["myvar"] = "test";
      await run("$myvar", bridge);
      expect(bridge.output).toContain("test");
    });
    
    test("should evaluate $# (argument count)", async () => {
      const bridge = createMockBridge();
      bridge.global_variables["1"] = "a";
      bridge.global_variables["2"] = "b";
      bridge.global_variables["3"] = "c";
      await run("$#", bridge);
      expect(bridge.output).toContain(3);
    });
    
    test("should evaluate $@ (all arguments)", async () => {
      const bridge = createMockBridge();
      bridge.global_variables["1"] = "arg1";
      bridge.global_variables["2"] = "arg2";
      await run("$@", bridge);
      expect(bridge.output).toContain("arg1 arg2");
    });
    
    test("should evaluate $* (all arguments)", async () => {
      const bridge = createMockBridge();
      bridge.global_variables["1"] = "first";
      bridge.global_variables["2"] = "second";
      await run("$*", bridge);
      expect(bridge.output).toContain("first second");
    });
    
    test("should evaluate $? (exit status)", async () => {
      const bridge = createMockBridge();
      bridge.global_variables["?"] = 0;
      await run("$?", bridge);
      expect(bridge.output).toContain(0);
    });
  });

  describe("Math Operations", () => {
    test("should evaluate addition", async () => {
      const bridge = createMockBridge();
      await run("1 + 2", bridge);
      expect(bridge.output).toContain(3);
    });

    test("should evaluate subtraction", async () => {
      const bridge = createMockBridge();
      await run("5 - 3", bridge);
      expect(bridge.output).toContain(2);
    });

    test("should evaluate multiplication", async () => {
      const bridge = createMockBridge();
      await run("4 * 3", bridge);
      expect(bridge.output).toContain(12);
    });

    test("should evaluate division", async () => {
      const bridge = createMockBridge();
      await run("10 / 2", bridge);
      expect(bridge.output).toContain(5);
    });

    test("should evaluate modulo", async () => {
      const bridge = createMockBridge();
      await run("7 % 3", bridge);
      expect(bridge.output).toContain(1);
    });

    test("should evaluate power", async () => {
      const bridge = createMockBridge();
      await run("2 ** 3", bridge);
      expect(bridge.output).toContain(8);
    });

    test("should evaluate complex expression with precedence", async () => {
      const bridge = createMockBridge();
      await run("2 + 3 * 4", bridge);
      expect(bridge.output).toContain(14); // 2 + (3 * 4) = 14
    });

    test("should evaluate parenthesized expressions", async () => {
      const bridge = createMockBridge();
      await run("(2 + 3) * 4", bridge);
      expect(bridge.output).toContain(20); // (2 + 3) * 4 = 20
    });

    test("should concatenate strings with +", async () => {
      const bridge = createMockBridge();
      await run('"hello" + " " + "world"', bridge);
      expect(bridge.output).toContain("hello world");
    });

    test("should repeat strings with *", async () => {
      const bridge = createMockBridge();
      await run('"ab" * 3', bridge);
      expect(bridge.output).toContain("ababab");
    });
  });

  describe("Logical Operations", () => {
    test("should evaluate AND", async () => {
      const bridge = createMockBridge();
      await run("true && true", bridge);
      expect(bridge.output).toContain(true);

      const bridge2 = createMockBridge();
      await run("true && false", bridge2);
      expect(bridge2.output).toContain(false);
    });

    test("should evaluate OR", async () => {
      const bridge = createMockBridge();
      await run("false || true", bridge);
      expect(bridge.output).toContain(true);

      const bridge2 = createMockBridge();
      await run("false || false", bridge2);
      expect(bridge2.output).toContain(false);
    });

    test("should evaluate NOT", async () => {
      const bridge = createMockBridge();
      await run("!true", bridge);
      expect(bridge.output).toContain(false);

      const bridge2 = createMockBridge();
      await run("!false", bridge2);
      expect(bridge2.output).toContain(true);
    });
  });

  describe("Comparison Operations", () => {
    test("should evaluate equality", async () => {
      const bridge = createMockBridge();
      await run("1 == 1", bridge);
      expect(bridge.output).toContain(true);

      const bridge2 = createMockBridge();
      await run("1 == 2", bridge2);
      expect(bridge2.output).toContain(false);
    });

    test("should evaluate inequality", async () => {
      const bridge = createMockBridge();
      await run("1 != 2", bridge);
      expect(bridge.output).toContain(true);
    });

    test("should evaluate greater than", async () => {
      const bridge = createMockBridge();
      await run("5 > 3", bridge);
      expect(bridge.output).toContain(true);

      const bridge2 = createMockBridge();
      await run("3 > 5", bridge2);
      expect(bridge2.output).toContain(false);
    });

    test("should evaluate less than", async () => {
      const bridge = createMockBridge();
      await run("3 < 5", bridge);
      expect(bridge.output).toContain(true);
    });

    test("should evaluate greater than or equal", async () => {
      const bridge = createMockBridge();
      await run("5 >= 5", bridge);
      expect(bridge.output).toContain(true);

      const bridge2 = createMockBridge();
      await run("5 >= 3", bridge2);
      expect(bridge2.output).toContain(true);
    });

    test("should evaluate less than or equal", async () => {
      const bridge = createMockBridge();
      await run("3 <= 5", bridge);
      expect(bridge.output).toContain(true);

      const bridge2 = createMockBridge();
      await run("5 <= 5", bridge2);
      expect(bridge2.output).toContain(true);
    });
  });

  describe("Built-in Functions", () => {
    test("should evaluate nbr function", async () => {
      const bridge = createMockBridge();
      await run('nbr "42"', bridge);
      expect(bridge.output).toContain(42);
    });

    test("should evaluate str function", async () => {
      const bridge = createMockBridge();
      await run("str 42", bridge);
      expect(bridge.output).toContain("42");
    });

    test("should evaluate max function", async () => {
      const bridge = createMockBridge();
      await run("max 5 10", bridge);
      expect(bridge.output).toContain(10);
    });

    test("should evaluate min function", async () => {
      const bridge = createMockBridge();
      await run("min 5 10", bridge);
      expect(bridge.output).toContain(5);
    });

    test("should evaluate pow function", async () => {
      const bridge = createMockBridge();
      await run("pow 2 3", bridge);
      expect(bridge.output).toContain(8);
    });

    test("should evaluate random function (returns a number)", async () => {
      const bridge = createMockBridge();
      await run("random", bridge);
      expect(typeof bridge.output[0]).toBe("number");
    });
  });

  describe("Conditionals", () => {
    test("should evaluate if/then/fi with true condition", async () => {
      const bridge = createMockBridge();
      await run("if (true)\nthen\n42\nfi", bridge);
      expect(bridge.output).toContain(42);
    });

    test("should not evaluate if block with false condition", async () => {
      const bridge = createMockBridge();
      await run("if (false)\nthen\n42\nfi", bridge);
      expect(bridge.output).not.toContain(42);
    });

    test("should evaluate else block with false condition", async () => {
      const bridge = createMockBridge();
      await run("if (false)\nthen\n42\nelse\nthen\n99\nfi", bridge);
      expect(bridge.output).toContain(99);
    });

    test("should evaluate condition with comparison", async () => {
      const bridge = createMockBridge();
      await run("a = 10\nif ($a == 10)\nthen\n\"yes\"\nfi", bridge);
      expect(bridge.output).toContain("yes");
    });
  });

  describe("User-defined Functions", () => {
    test("should define and call a function", async () => {
      const bridge = createMockBridge();
      await run("function greet {\n\"hello\"\n}\ngreet", bridge);
      expect(bridge.output).toContain("hello");
    });

    test("should pass arguments to function", async () => {
      const bridge = createMockBridge();
      await run("function double {\n$1 * 2\n}\ndouble 5", bridge);
      expect(bridge.output).toContain(10);
    });

    test("should support multiple arguments", async () => {
      const bridge = createMockBridge();
      await run("function add {\n$1 + $2\n}\nadd 3 7", bridge);
      expect(bridge.output).toContain(10);
    });
  });

  describe("Local Variables", () => {
    test("should evaluate local variable assignment", async () => {
      const bridge = createMockBridge();
      await run("function test {\nlocal x = 42\n$x\n}\ntest", bridge);
      expect(bridge.output).toContain(42);
    });

    test("should not leak local variables to global scope", async () => {
      const bridge = createMockBridge();
      await run("function test {\nlocal mylocal = 99\n}\ntest\n$mylocal", bridge);
      // $mylocal should be null/undefined outside the function
      expect(bridge.output).not.toContain(99);
    });
    
    test("should allow local variable without initial value", async () => {
      const bridge = createMockBridge();
      await run("function test {\nlocal y\n$y\n}\ntest", bridge);
      // Uninitialized variable returns null which is not displayed
      expect(bridge.output).toEqual([]);
    });
  });

  describe("Multiple Statements", () => {
    test("should evaluate multiple statements with semicolon", async () => {
      const bridge = createMockBridge();
      await run("1; 2; 3", bridge);
      expect(bridge.output).toContain(1);
      expect(bridge.output).toContain(2);
      expect(bridge.output).toContain(3);
    });

    test("should evaluate multiple statements with newlines", async () => {
      const bridge = createMockBridge();
      await run("1\n2\n3", bridge);
      expect(bridge.output).toContain(1);
      expect(bridge.output).toContain(2);
      expect(bridge.output).toContain(3);
    });
  });

  describe("Bridge Integration", () => {
    test("should use custom global function from bridge", async () => {
      const bridge = createMockBridge();
      bridge.global_functions["custom"] = (b, vars) => {
        return (vars["1"] as number) * 100;
      };
      await run("custom 5", bridge);
      expect(bridge.output).toContain(500);
    });

    test("should use custom global variable from bridge", async () => {
      const bridge = createMockBridge();
      bridge.global_variables["PI"] = 3.14159;
      await run("$PI", bridge);
      expect(bridge.output).toContain(3.14159);
    });
  });

  describe("Comments", () => {
    test("should ignore comments", async () => {
      const bridge = createMockBridge();
      await run("42 # this is a comment", bridge);
      expect(bridge.output).toContain(42);
      expect(bridge.output.length).toBe(1);
    });
  });

  describe("Error Handling", () => {
    test("should report errors to bridge.err", async () => {
      const bridge = createMockBridge();
      // This should cause an error - comparing string with < operator
      await run("\"a\" < \"b\"", bridge);
      expect(bridge.errors.length).toBeGreaterThan(0);
    });
  });
});
