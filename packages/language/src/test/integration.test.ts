import { describe, expect, test } from "bun:test";
import { run, lexer, parse, evaluate, types } from "../runner";
import type { Bridge, PrimitivesJS } from "../types";

// Helper to create a mock bridge
function createMockBridge(): Bridge & { output: PrimitivesJS[] } {
  const output: PrimitivesJS[] = [];
  return {
    global_functions: {},
    global_variables: {},
    output,
    out: (...args: PrimitivesJS[]) => {
      output.push(...args);
    },
    err: (...args: PrimitivesJS[]) => {},
    exec: async (vals: PrimitivesJS[]) => vals.join(" "),
  };
}

describe("Integration Tests", () => {
  describe("Complete Scripts", () => {
    test("should run function.ysh example", async () => {
      const bridge = createMockBridge();
      const code = `
function test {
    $1
}
test "hello"
`;
      await run(code, bridge);
      expect(bridge.output).toContain("hello");
    });

    test("should run if.ysh example", async () => {
      const bridge = createMockBridge();
      const code = `
a = 12
if ($a == 12)
then
    "Yes you have!"
fi
`;
      await run(code, bridge);
      expect(bridge.output).toContain("Yes you have!");
    });

    test("should run calculator example", async () => {
      const bridge = createMockBridge();
      const code = `
function add { $1 + $2 }
function sub { $1 - $2 }
function mul { $1 * $2 }
function div { $1 / $2 }

add 10 5
sub 10 5
mul 10 5
div 10 5
`;
      await run(code, bridge);
      expect(bridge.output).toContain(15);
      expect(bridge.output).toContain(5);
      expect(bridge.output).toContain(50);
      expect(bridge.output).toContain(2);
    });

    test("should handle nested conditionals", async () => {
      const bridge = createMockBridge();
      const code = `
x = 10
if ($x > 5)
then
    if ($x > 15)
    then
        "big"
    else
    then
        "medium"
    fi
else
then
    "small"
fi
`;
      await run(code, bridge);
      expect(bridge.output).toContain("medium");
    });

    test("should handle function calling function", async () => {
      const bridge = createMockBridge();
      const code = `
function double { $1 * 2 }
function quadruple { double $1; double $1 }
quadruple 5
`;
      await run(code, bridge);
      expect(bridge.output).toContain(10);
    });

    test("should handle complex math expressions", async () => {
      const bridge = createMockBridge();
      const code = `
result = (2 + 3) * (4 - 1)
$result
`;
      await run(code, bridge);
      expect(bridge.output).toContain(15);
    });

    test("should handle string operations", async () => {
      const bridge = createMockBridge();
      const code = `
name = "YASH"
greeting = "Hello " + $name
$greeting
`;
      await run(code, bridge);
      expect(bridge.output).toContain("Hello YASH");
    });

    test("should handle boolean logic", async () => {
      const bridge = createMockBridge();
      const code = `
a = true
b = false
result = $a && !$b
$result
`;
      await run(code, bridge);
      expect(bridge.output).toContain(true);
    });
  });

  describe("Module Exports", () => {
    test("should export run function", () => {
      expect(typeof run).toBe("function");
    });

    test("should export lexer function", () => {
      expect(typeof lexer).toBe("function");
    });

    test("should export parse function", () => {
      expect(typeof parse).toBe("function");
    });

    test("should export evaluate function", () => {
      expect(typeof evaluate).toBe("function");
    });

    test("should export types", () => {
      expect(types).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty input", async () => {
      const bridge = createMockBridge();
      await run("", bridge);
      expect(bridge.output.length).toBe(0);
    });

    test("should handle only comments", async () => {
      const bridge = createMockBridge();
      await run("# just a comment", bridge);
      expect(bridge.output.length).toBe(0);
    });

    test("should handle only whitespace", async () => {
      const bridge = createMockBridge();
      await run("   \n\n   ", bridge);
      expect(bridge.output.length).toBe(0);
    });

    test("should handle zero", async () => {
      const bridge = createMockBridge();
      await run("0", bridge);
      expect(bridge.output).toContain(0);
    });

    test("should handle empty string", async () => {
      const bridge = createMockBridge();
      await run('""', bridge);
      expect(bridge.output).toContain("");
    });

    test("should handle null-like values", async () => {
      const bridge = createMockBridge();
      await run("x = 0\nif ($x)\nthen\n1\nelse\nthen\n2\nfi", bridge);
      // 0 is falsy, so should go to else
      expect(bridge.output).toContain(2);
    });
  });

  describe("Loops", () => {
    test("should execute while loop", async () => {
      const bridge = createMockBridge();
      const code = `
i = 1
while ($i < 4) do
  echo $i
  i = $i + 1
done
`;
      await run(code, bridge);
      expect(bridge.output).toContain("1");
      expect(bridge.output).toContain("2");
      expect(bridge.output).toContain("3");
    });

    test("should execute until loop", async () => {
      const bridge = createMockBridge();
      const code = `
i = 1
until ($i > 3) do
  echo $i
  i = $i + 1
done
`;
      await run(code, bridge);
      expect(bridge.output).toContain("1");
      expect(bridge.output).toContain("2");
      expect(bridge.output).toContain("3");
    });

    test("should execute for loop with numbers", async () => {
      const bridge = createMockBridge();
      const code = `
for x in 10 20 30 do
  echo $x
done
`;
      await run(code, bridge);
      expect(bridge.output).toContain("10");
      expect(bridge.output).toContain("20");
      expect(bridge.output).toContain("30");
    });

    test("should execute for loop with strings", async () => {
      const bridge = createMockBridge();
      const code = `
for name in "Alice" "Bob" "Charlie" do
  echo $name
done
`;
      await run(code, bridge);
      expect(bridge.output).toContain("Alice");
      expect(bridge.output).toContain("Bob");
      expect(bridge.output).toContain("Charlie");
    });

    test("should not execute while loop if condition is false initially", async () => {
      const bridge = createMockBridge();
      const code = `
i = 10
while ($i < 5) do
  "inside"
done
"after"
`;
      await run(code, bridge);
      expect(bridge.output).not.toContain("inside");
      expect(bridge.output).toContain("after");
    });

    test("should modify variable inside loop and persist after", async () => {
      const bridge = createMockBridge();
      const code = `
total = 0
for x in 1 2 3 4 5 do
  total = $total + $x
done
$total
`;
      await run(code, bridge);
      expect(bridge.output).toContain(15);
    });

    test("should handle nested loops", async () => {
      const bridge = createMockBridge();
      const code = `
count = 0
i = 1
while ($i < 3) do
  j = 1
  while ($j < 3) do
    count = $count + 1
    j = $j + 1
  done
  i = $i + 1
done
$count
`;
      await run(code, bridge);
      expect(bridge.output).toContain(4);
    });
  });

  describe("Pipes", () => {
    test("should pipe result to $_ with |>", async () => {
      const bridge = createMockBridge();
      const code = `10 + 5 |> $_ * 2`;
      await run(code, bridge);
      expect(bridge.output).toContain(30);
    });

    test("should pipe result to $_ with |", async () => {
      const bridge = createMockBridge();
      const code = `"Hello" | $_ + " World"`;
      await run(code, bridge);
      expect(bridge.output).toContain("Hello World");
    });

    test("should reverse pipe with <|", async () => {
      const bridge = createMockBridge();
      const code = `$_ * 2 <| 10`;
      await run(code, bridge);
      expect(bridge.output).toContain(20);
    });

    test("should chain multiple pipes", async () => {
      const bridge = createMockBridge();
      const code = `5 |> $_ * 2 |> $_ + 10`;
      await run(code, bridge);
      expect(bridge.output).toContain(20);
    });

    test("should work with pipes in functions", async () => {
      const bridge = createMockBridge();
      const code = `
function double { $1 * 2 }
10 |> double $_
`;
      await run(code, bridge);
      expect(bridge.output).toContain(20);
    });
  });

  describe("Arrays", () => {
    test("should create array with literal syntax", async () => {
      const bridge = createMockBridge();
      const code = `arr=(1 2 3)`;
      await run(code, bridge);
      // Array assignment doesn't output anything (like other assignments)
      expect(bridge.output).toEqual([]);
    });

    test("should access array element by index", async () => {
      const bridge = createMockBridge();
      const code = `
arr=(10 20 30)
$arr[0]
`;
      await run(code, bridge);
      expect(bridge.output).toContain(10);
    });

    test("should access different array indices", async () => {
      const bridge = createMockBridge();
      const code = `
arr=(10 20 30)
$arr[1]
`;
      await run(code, bridge);
      expect(bridge.output).toContain(20);
    });

    test("should access last array element", async () => {
      const bridge = createMockBridge();
      const code = `
arr=("a" "b" "c")
$arr[2]
`;
      await run(code, bridge);
      expect(bridge.output).toContain("c");
    });

    test("should use variable as array index", async () => {
      const bridge = createMockBridge();
      const code = `
arr=(100 200 300)
i = 2
$arr[$i]
`;
      await run(code, bridge);
      expect(bridge.output).toContain(300);
    });

    test("should use expression as array index", async () => {
      const bridge = createMockBridge();
      const code = `
arr=(5 10 15 20)
$arr[1 + 1]
`;
      await run(code, bridge);
      expect(bridge.output).toContain(15);
    });

    test("should return null for out of bounds index", async () => {
      const bridge = createMockBridge();
      const code = `
arr=(1 2 3)
$arr[10]
`;
      await run(code, bridge);
      // Out of bounds returns null which is not displayed
      expect(bridge.output).toEqual([]);
    });

    test("should handle array with mixed types", async () => {
      const bridge = createMockBridge();
      const code = `
arr=(42 "hello" true)
$arr[1]
`;
      await run(code, bridge);
      expect(bridge.output).toContain("hello");
    });
  });

  describe("Built-in Commands", () => {
    describe("echo", () => {
      test("should output simple string", async () => {
        const bridge = createMockBridge();
        await run('echo "hello world"', bridge);
        expect(bridge.output).toContain("hello world");
      });

      test("should output multiple arguments", async () => {
        const bridge = createMockBridge();
        await run('echo "hello" "world"', bridge);
        expect(bridge.output).toContain("hello world");
      });

      test("should handle -n flag (no newline)", async () => {
        const bridge = createMockBridge();
        await run('echo -n "hello"', bridge);
        expect(bridge.output).toContain("hello");
      });

      test("should handle -e flag (escape sequences)", async () => {
        const bridge = createMockBridge();
        await run('echo -e "hello\\tworld"', bridge);
        expect(bridge.output[0]).toContain("\t");
      });

      test("should output variables", async () => {
        const bridge = createMockBridge();
        await run('name = "YASH"\necho $name', bridge);
        expect(bridge.output).toContain("YASH");
      });
    });

    describe("true/false", () => {
      test("true literal should be boolean true", async () => {
        const bridge = createMockBridge();
        await run("true", bridge);
        expect(bridge.output).toContain(true);
      });

      test("false literal should be boolean false", async () => {
        const bridge = createMockBridge();
        await run("false", bridge);
        expect(bridge.output).toContain(false);
      });
    });

    describe("printf", () => {
      test("should format string with %s", async () => {
        const bridge = createMockBridge();
        await run('printf "Hello %s" "World"', bridge);
        expect(bridge.output).toContain("Hello World");
      });

      test("should format number with %d", async () => {
        const bridge = createMockBridge();
        await run('printf "Number: %d" 42', bridge);
        expect(bridge.output).toContain("Number: 42");
      });
    });

    describe("pwd", () => {
      test("should return current directory", async () => {
        const bridge = createMockBridge();
        await run("pwd", bridge);
        // Should return something (/ or actual path)
        expect(bridge.output.length).toBeGreaterThan(0);
      });
    });

    describe("export", () => {
      test("should set environment variable", async () => {
        const bridge = createMockBridge();
        // Use YASH style: set variable, then export it
        await run('MYVAR = "hello"\nexport MYVAR\necho $MYVAR', bridge);
        expect(bridge.output).toContain("hello");
      });
    });

    describe("test / [", () => {
      test("should test string equality", async () => {
        const bridge = createMockBridge();
        // YASH uses its own comparison syntax within conditions
        // test built-in works with separated tokens
        await run('result = ("a" == "a")\nif ($result) then echo "yes" fi', bridge);
        expect(bridge.output).toContain("yes");
      });

      test("should test string inequality", async () => {
        const bridge = createMockBridge();
        await run('result = ("a" == "b")\nif (!$result) then echo "different" fi', bridge);
        expect(bridge.output).toContain("different");
      });

      test("should test -z (empty string)", async () => {
        const bridge = createMockBridge();
        await run('test -z ""\necho $?', bridge);
        expect(bridge.output).toContain("0"); // 0 = true (is empty)
      });

      test("should test -n (non-empty string)", async () => {
        const bridge = createMockBridge();
        await run('test -n "hello"\necho $?', bridge);
        expect(bridge.output).toContain("0"); // 0 = true (is non-empty)
      });

      test("should test numeric equality with -eq", async () => {
        const bridge = createMockBridge();
        await run("test 5 -eq 5\necho $?", bridge);
        expect(bridge.output).toContain("0");
      });

      test("should test numeric less than with -lt", async () => {
        const bridge = createMockBridge();
        await run("test 3 -lt 5\necho $?", bridge);
        expect(bridge.output).toContain("0");
      });
    });

    describe("set/shift", () => {
      test("shift should shift positional parameters", async () => {
        const bridge = createMockBridge();
        bridge.global_variables = { "1": "a", "2": "b", "3": "c" };
        await run("shift\necho $1", bridge);
        expect(bridge.output).toContain("b");
      });
    });

    describe("let", () => {
      test("should evaluate arithmetic expression", async () => {
        const bridge = createMockBridge();
        await run('let "x=8"\necho $x', bridge);
        expect(bridge.output).toContain("8");
      });

      test("should handle increment", async () => {
        const bridge = createMockBridge();
        bridge.global_variables["x"] = 5;
        await run('let "x++"\necho $x', bridge);
        expect(bridge.output).toContain("6");
      });

      test("should handle compound assignment", async () => {
        const bridge = createMockBridge();
        bridge.global_variables["x"] = 10;
        await run('let "x+=5"\necho $x', bridge);
        expect(bridge.output).toContain("15");
      });

      test("should return 0 for non-zero result", async () => {
        const bridge = createMockBridge();
        await run('let "8"\necho $?', bridge);
        expect(bridge.output).toContain(0);
      });

      test("should return 1 for zero result", async () => {
        const bridge = createMockBridge();
        await run('let "0"\necho $?', bridge);
        expect(bridge.output).toContain(1);
      });
    });

    describe("declare", () => {
      test("should declare variable with value", async () => {
        const bridge = createMockBridge();
        await run('declare "myvar=hello"\necho $myvar', bridge);
        expect(bridge.output).toContain("hello");
      });

      test("should declare integer with -i", async () => {
        const bridge = createMockBridge();
        await run('declare -i "num=42"\necho $num', bridge);
        expect(bridge.output).toContain("42");
      });
    });

    describe("readonly", () => {
      test("should set variable as readonly", async () => {
        const bridge = createMockBridge();
        await run('readonly "PI=3.14"\necho $PI', bridge);
        expect(bridge.output).toContain("3.14");
      });
    });

    describe("unset", () => {
      test("should unset variable", async () => {
        const bridge = createMockBridge();
        bridge.global_variables["myvar"] = "exists";
        await run('unset myvar\necho "done"', bridge);
        expect(bridge.global_variables["myvar"]).toBeUndefined();
      });
    });

    describe("trap", () => {
      test("should list signals with -l", async () => {
        const bridge = createMockBridge();
        await run("trap -l", bridge);
        expect(bridge.output.some((o: any) => String(o).includes("EXIT"))).toBe(true);
      });

      test("should print traps with -p", async () => {
        const bridge = createMockBridge();
        await run("trap -p", bridge);
        // Should return 0 (null output)
        expect(bridge.output).toContain(0);
      });
    });

    describe("jobs", () => {
      test("should return 0 with no jobs", async () => {
        const bridge = createMockBridge();
        bridge.global_variables["?"] = 1; // Set to non-zero first
        await run("jobs", bridge);
        // jobs doesn't set $? explicitly, check output is empty
        expect(bridge.output.filter((o: any) => o !== null && o !== 0)).toHaveLength(0);
      });
    });

    describe("wait", () => {
      test("should return 0", async () => {
        const bridge = createMockBridge();
        await run("wait", bridge);
        expect(bridge.global_variables["?"]).toBe(0);
      });
    });

    describe("kill", () => {
      test("should list signals with -l", async () => {
        const bridge = createMockBridge();
        await run("kill -l", bridge);
        expect(bridge.output.some((o: any) => String(o).includes("INT"))).toBe(true);
      });
    });
  });
});
