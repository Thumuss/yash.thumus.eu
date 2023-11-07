# YASH
> **Y**et **A**n other **SH**ell

YASH is a side project of my website [`thumus.eu`](https://thumus.eu). It emulates bash by calling an interface (a sort of bridge) 

# Why

I wanted a portable version of bash on the web.
There are projects who ports bash into a framework like NextJS but I wanted something usable in a CLI too. Typescript is the best choice for me there. It's more a fun project than a serious project for me.

# Run
You need `bun` for simplicity or anything that can compile typescript.

```sh
$ bun src/run.ts "1 + 1 == 2"
```

# Contributing & Bugs

You can open an issue at my [repository](https://github.com/ThumusLive/yash.thumus.eu), I don't accept PR (normally).

# Grammar

In a EBNF form:

```EBNF
literal ::= 'null' | number | text | bool | argument
text ::= "'" .* '"' | '"' .* '"' | '`' .* '`'
bool ::= 'true' | 'false'
int ::= digit+
float ::= digit+ ('.' digit+)?
number ::= int | float
digit = '0' | ... | '9'
```