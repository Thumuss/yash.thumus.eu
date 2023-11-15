# YASH

> **Y**et **A**n other **SH**ell

YASH is a side project of my website [`thumus.eu`](https://thumus.eu). It emulates bash by calling an interface (a sort of bridge)

# Extensions

The extensions are `.ysh` and `.yash`. It supports `.sh` and `.bash` in a strict bash environnement.

# Why

I wanted a portable version of bash on the web.
There are projects who ports bash into a framework like NextJS but I wanted something usable in a CLI too. Typescript is the best choice for me there. It's more a fun project than a serious project for me.

# Read-Eval-Print-Loop (REPL)

You need `bun` for simplicity or anything that can compile typescript.

```sh
$ bun src/repl.ts
```

# Run

Same as REPL but the command is

```sh
$ bun src/run.ts [FILE1] [FILE2]...
```

Replace `FILE1`, etc... by your files.

# Install

For now on, YASH is compiled in two versions, REPL and RUN.

To compile the run version:

```sh
$ bun build --compile src/run.ts --outfile ./build/YASH_run
```

To compile the repl version:

```sh
$ bun build --compile src/repl.ts --outfile ./build/YASH_repl
```

and then to execute a command, it's the same as above but you replace `bun src/[NAME].ts` by `YASH_[NAME]`. `NAME` is `repl` or `run`

# Grammar

WORK IN PROGRESS

> The langage will change that's for sure.

In a EBNF form with a +:

White spaces are ommited

## YASH version

```EBNF

text = ('"' .* '"') | ("'" .* "'") | ('`' .* '`');
literal = "null" | number | text | bool | argument | var | regex;
bool = 'true' | 'false';
int = digit+;
float = digit+ ('.' digit+)?;
number = int | float;
digit = '0' | ... | '9';
argument = [a-zA-Z] ([a-zA-Z] | digit)*;
var = "$" ([a-zA-Z] | digit | "*" | "@")+;

list = "[" litteral? | ((literal ",")+ litteral) "]"

endstate = (";" | "\n")+;

leftUnary = "!" | "-";
rightUnary = "&";

unary-expr = (expr rightUnary) | (leftUnary expr);
binary-expr = (expr binary expr) ;

binary = logical | math;
logical = "&&" | "||" | "==" | "!=" | ">=" | "<=" | ">" | "<" | "|" | "|>" | "<|" | "=~";
math = "+" | "-" | "/" | "*" | "%" | "**";

math-block = ('((' expr '))') | ('(' expr ')') ;
string-block = ("[[" expr "]]") | ("[" expr "]") | ("(" expr ")");

condition-block = math-block | string-block;

if-expr = "if" condition-block endstate "then" expr endstate ("fi" | elfi-expr | else-expr);

elif-expr = "elif" condition-block endstate "then" endstate expr  ("fi" | elfi-expr | else-expr);

else-expr = "else" endstate "then" endstate expr "fi";

time-expr = "time" expr;

while-expr = "while" condition-block endstate "do" expr endstate "done";

until-expr = "until" condition-block endstate "do" expr endstate "done";

case-expr = "case" expr "in" endstate ((regex | litteral) ")" endstate expr endstate ";;" endstate  )* "*)" endstate expr endstate ";;" endstate "esac"; 

local-expr = "local" argument

keywords-expr = if-expr | elif-expr | else-expr | time-expr | while-expr | until-expr | case-expr  | select-expr | function-expr | local-expr;

one-expr = unary-expr | binary-expr | ltteral | keywords-expr;

expr = (one-expr) | ((one-expr endstate) one-expr);
```

## BASH version (strict mode)

wip

# Contributing & Bugs

You can open an issue at my [repository](https://github.com/ThumusLive/yash.thumus.eu/issues), I don't accept PR (normally).
