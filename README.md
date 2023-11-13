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

Using a ternary operator, we can express `if a then b else c` like this : `(a ?? b : c)`

## YASH version

```EBNF
literal ::= 'null' | number | text | bool | argument | var
text ::= "'" .* '"' | '"' .* '"' | '`' .* '`'
bool ::= 'true' | 'false'
int ::= digit+
float ::= digit+ ('.' digit+)?
number ::= int | float
digit = '0' | ... | '9'
argument ::= [a-zA-Z]+
var ::= "$" [a-zA-Z]+

endOfStatement ::= ";" | "\n"

operators ::= unary | binary | ternary

unary ::= leftUnary | rightUnary
leftUnary ::= "!" | "-"

rightUnary ::= "&"

binary ::= logical | math
logical ::= "&&" | 

```

## BASH version (strict mode)

wip

# Contributing & Bugs

You can open an issue at my [repository](https://github.com/ThumusLive/yash.thumus.eu/issues), I don't accept PR (normally).