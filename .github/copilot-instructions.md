# YASH - Copilot Instructions

## Vue d'ensemble du projet

**YASH** (Yet Another SHell) est un interpréteur de shell complet écrit en TypeScript, conçu pour émuler Bash de manière portable, notamment sur le web. Le projet fait partie de l'écosystème du site [thumus.eu](https://thumus.eu).

### Objectifs principaux
- Fournir une version portable de Bash utilisable dans un CLI et sur le web
- Permettre l'exécution de scripts `.ysh` et `.yash` (format YASH) ainsi que `.sh` et `.bash` (mode strict Bash)
- Offrir un REPL (Read-Eval-Print-Loop) interactif et un mode d'exécution de fichiers
- Fournir un système virtuel complet (filesystem, processus, utilisateurs) pour le web
- Être entièrement exécutable dans un navigateur sans backend

### Fonctionnalités principales
- **Interpréteur complet** : lexer, parser, évaluateur avec support de l'asynchrone
- **Builtins shell** : 25+ commandes intégrées (echo, test, cd, export, etc.)
- **Commandes système** : 100+ commandes Unix simulées (ls, cat, grep, ps, etc.)
- **Système virtuel** : filesystem POSIX, gestion des processus, utilisateurs
- **Structures de contrôle** : if/elif/else, while, until, for, functions
- **Opérateurs** : arithmétiques, logiques, comparaisons, pipes, background
- **Arrays** : création `arr=(1 2 3)` et accès `$arr[0]`
- **Variables spéciales** : `$@`, `$*`, `$#`, `$?`, `$$`, `$!`, `$-`

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| **Runtime** | [Bun](https://bun.sh/) v1.3.1+ (runtime JavaScript/TypeScript rapide) |
| **Langage** | TypeScript (strict mode activé) |
| **Build** | Bun build avec minification |
| **Monorepo** | Bun workspaces |
| **Docker** | Image basée sur `oven/bun:1` |
| **Tests** | 230 tests unitaires avec Bun test |
| **CI/CD** | GitHub Actions |

### Commandes principales

```bash
# Installation
bun install

# Tests
bun test                    # Tous les tests (230)
bun test --watch           # Mode watch

# Build
bun run build              # Build tous les packages

# Exécution
bun src/exec/repl.ts       # Mode REPL interactif
bun src/exec/run.ts file.ysh  # Exécuter un fichier
```

---

## Architecture du projet (Monorepo)

Le projet est organisé en monorepo avec 3 packages :

```
yash/
├── package.json              # Config monorepo (workspaces)
├── packages/
│   ├── language/             # @yash/language - Interpréteur du langage
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts      # Exports: run, lexer, parse, evaluate
│   │       ├── runner.ts     # Point d'entrée - orchestre lexer → parser → eval
│   │       ├── types.ts      # Définitions de types TypeScript
│   │       ├── interpretor/
│   │       │   ├── lexer.ts      # Analyse lexicale (tokenization)
│   │       │   ├── parser.ts     # Analyse syntaxique (parsing)
│   │       │   ├── eval.ts       # Évaluation de l'AST
│   │       │   ├── builtins.ts   # Commandes built-in (echo, test, etc.)
│   │       │   ├── error.ts      # Gestion des erreurs
│   │       │   └── parser/
│   │       │       ├── classes/  # Classes AST
│   │       │       └── functions/ # Fonctions de parsing
│   │       └── test/             # Tests unitaires (199 tests)
│   │
│   ├── system/               # @yash/system - Système virtuel complet
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          # Exports: createSystemBridge, VFS, etc.
│   │       ├── filesystem.ts     # VirtualFileSystem - POSIX-like VFS avec mounts
│   │       ├── process.ts        # VirtualProcessManager - processus, jobs, signaux
│   │       ├── users.ts          # VirtualUserManager - utilisateurs, groupes, sessions
│   │       ├── system.ts         # createSystemBridge() - 100+ commandes système
│   │       └── test/             # Tests système (31 tests)
│   │
│   └── website/              # @yash/website - Interface web
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts          # WebTerminal, createWebTerminal()
│
├── src/                      # Sources legacy (compatibilité)
├── test/                     # Fichiers de test .ysh
├── build/                    # Fichiers compilés
└── Dockerfile                # Configuration Docker
```

### Dépendances entre packages

```
@yash/website
    └── @yash/system
            └── @yash/language
```

---

## Pipeline d'interprétation

Le flux d'exécution suit le pattern classique d'un interpréteur :

```
Code source (.ysh) → Lexer → Tokens → Parser → AST → Evaluator → Résultat
```

---

## 1. Lexer (`packages/language/src/interpretor/lexer.ts`)

Le lexer transforme le code source en une liste de tokens. Il fait 515 lignes.

### TypeToken Enum (70+ types)

```typescript
enum TypeToken {
  // Primitives
  Number,       // 42, 3.14
  Text,         // "hello", 'world', `template`
  Bool,         // true, false
  Argument,     // identifiants, chemins (/usr/bin)
  Var,          // $var, $1, $@, $*, $#, $?, $$, $!, $-
  
  // Opérateurs d'assignation
  Assignement,  // =
  
  // Opérateurs logiques
  And,          // &&
  Or,           // ||
  Not,          // !
  
  // Opérateurs de comparaison
  Eq,           // ==
  NotEq,        // !=
  Greater,      // >
  Less,         // <
  GrEq,         // >=
  LsEq,         // <=
  ApproxEq,     // =~
  
  // Opérateurs mathématiques
  Plus,         // +
  Minus,        // -
  Star,         // *
  Slash,        // /
  Modulo,       // %
  Pow,          // **
  
  // Opérateurs shell
  Pipe,         // |
  PipeOut,      // |>
  PipeIn,       // <|
  Ampersand,    // &
  Backslash,    // \
  
  // Délimiteurs
  Semicolon,    // ;
  NewLine,      // \n
  Comma,        // ,
  
  // Parenthèses et accolades
  LeftPar,      // (
  RightPar,     // )
  LeftBracket,  // {
  RightBracket, // }
  LeftSqB,      // [
  RightSqB,     // ]
  DoubleLeftSqB,  // [[
  DoubleRightSqB, // ]]
  
  // Mots-clés conditionnels
  If,           // if
  Then,         // then
  Elif,         // elif
  Else,         // else
  Fi,           // fi
  
  // Mots-clés de boucles
  While,        // while
  Until,        // until
  Do,           // do
  Done,         // done
  For,          // for
  In,           // in
  
  // Mots-clés de fonctions
  Function,     // function
  Local,        // local
  
  // Autres mots-clés
  Case,         // case
  Esac,         // esac
  Select,       // select
  Time,         // time
  Coproc,       // coproc
  
  // Spéciaux
  Help,         // pour debug
}
```

### Interface Position

```typescript
interface Position {
  lineStart: number;    // Ligne de début (1-indexed)
  lineEnd: number;      // Ligne de fin
  columnStart: number;  // Colonne de début
  columnEnd: number;    // Colonne de fin
}
```

### Classe Token

```typescript
class Token {
  type: TypeToken;
  value: PrimitivesJS;
  plus: number = 0;           // Modificateur de priorité (parenthèses)
  position: Position;
  
  constructor(type: TypeToken, value?: PrimitivesJS);
}
```

### Fonction lexer()

```typescript
function lexer(str: string): Token[]
```

Le lexer parcourt la chaîne caractère par caractère et gère :
- **Commentaires** : `#` jusqu'à la fin de ligne
- **Chaînes** : `"..."`, `'...'`, `` `...` `` avec gestion des échappements
- **Nombres** : entiers et flottants
- **Variables** : `$var`, `$1`, `$@`, `$*`, `$#`, `$?`, `$$`, `$!`, `$-`
- **Chemins** : `/usr/bin`, `~/Documents` (détectés par contexte)
- **Mots-clés** : `if`, `then`, `else`, `while`, `for`, etc.
- **Opérateurs** : multi-caractères (`&&`, `||`, `|>`, `**`, etc.)

### Variables spéciales supportées

| Variable | Description |
|----------|-------------|
| `$@` | Tous les paramètres positionnels (séparés) |
| `$*` | Tous les paramètres positionnels (concaténés) |
| `$#` | Nombre de paramètres positionnels |
| `$?` | Code de sortie de la dernière commande |
| `$$` | PID du shell courant |
| `$!` | PID du dernier processus en background |
| `$-` | Flags du shell |
| `$0` | Nom du script |
| `$1`-`$9` | Paramètres positionnels |

---

## 2. Parser (`packages/language/src/interpretor/parser.ts`)

Construit un AST (Abstract Syntax Tree) à partir des tokens. Le fichier fait 193 lignes.

### Fonction principale

```typescript
function parse(tokens: Token[]): Parser
```

### Priorité des opérateurs (orderPriority)

```typescript
const orderPriority: TypeToken[] = [
  // Groupe 1 : Arguments et mots-clés (priorité la plus basse)
  TypeToken.Argument,
  TypeToken.If, TypeToken.Then, TypeToken.Elif, TypeToken.Else, TypeToken.Fi,
  TypeToken.Time, TypeToken.For, TypeToken.In, TypeToken.Until,
  TypeToken.While, TypeToken.Do, TypeToken.Done,
  TypeToken.Case, TypeToken.Esac, TypeToken.Select, TypeToken.Function,
  TypeToken.Local,

  // Groupe 2 : Délimiteurs
  TypeToken.Semicolon,

  // Groupe 3 : Pipes et background
  TypeToken.PipeOut, TypeToken.PipeIn, TypeToken.Ampersand, TypeToken.Pipe,

  // Groupe 4 : Comparaisons d'égalité
  TypeToken.Eq, TypeToken.NotEq, TypeToken.GrEq, TypeToken.LsEq,

  // Groupe 5 : Opérateurs logiques et comparaisons
  TypeToken.Or, TypeToken.And, TypeToken.Less, TypeToken.Greater, TypeToken.Not,

  // Groupe 6 : Opérateurs mathématiques (priorité haute)
  TypeToken.Plus, TypeToken.Minus, TypeToken.Star, TypeToken.Slash,
  TypeToken.Modulo, TypeToken.Pow,

  // Groupe 7 : Blocs
  TypeToken.DoubleLeftSqB, TypeToken.DoubleRightSqB,
  TypeToken.LeftBracket, TypeToken.RightBracket,
];
```

### Classes AST

#### Primitive (`parser/classes/Primitives.ts`)

```typescript
class Primitive {
  type: TypeToken;
  value: PrimitivesJS;

  constructor(type: TypeToken, value: PrimitivesJS);
  static into(token: Token): Primitive;
  toJSON(): { type: TypeToken; value: PrimitivesJS };
}
```

#### Command (`parser/classes/Command.ts`)

```typescript
class Command {
  type: TypeToken = TypeToken.Argument;
  values: PrimitivesJS[];  // Arguments de la commande
  piped: boolean = false;

  constructor(token: Token);
  add(token: NonOperators): void;
  toJSON(): { type: TypeToken; values: PrimitivesJS[] };
}
```

#### Binary (`parser/classes/Binary.ts`)

```typescript
class Binary {
  type: TypeToken;
  left?: AST;
  right?: AST;
  priority: number;

  constructor(token: Token, right?: AST, left?: AST);
  toJSON(): { type: TypeToken; left: any; right: any };
}
```

#### Unary (`parser/classes/Unary.ts`)

```typescript
class Unary {
  type: TypeToken;
  right?: AST;
  priority: number;

  constructor(token: Token, right?: AST);
  toJSON(): { type: TypeToken; right: any };
}
```

#### Block (`parser/classes/Block.ts`)

```typescript
class Block {
  type: TypeToken = TypeToken.LeftBracket;
  parser: Parser;

  constructor(tokens: Token[]);
  toJSON(): any[];
}
```

#### ArrayLiteral et ArrayAccess (`parser/classes/Array.ts`)

```typescript
// Array literal: arr=(1 2 3 "hello")
class ArrayLiteral {
  type = TypeToken.LeftPar;
  elements: Parser;

  constructor(tokens: Token[]);
}

// Array access: $arr[0] ou $arr[$i]
class ArrayAccess {
  type = TypeToken.LeftSqB;
  varName: string;
  indexBlock: Block;

  constructor(varName: string, indexBlock: Block);
}
```

### Keywords (parser/functions/keywords.ts)

#### If / ElseIf / Else

```typescript
class If extends Keyword {
  p: Parser;
  block: Block;        // Code à exécuter si vrai
  condition: Block;    // Condition à évaluer
  continue?: AST;      // Prochain elif/else

  constructor(p: Parser, type = TypeToken.If);
}

class ElseIf extends If { /* ... */ }
class Else extends Keyword { block: Block; }
```

#### While / Until

```typescript
class While extends Keyword {
  p: Parser;
  block: Block;        // Corps de la boucle
  condition: Block;    // Condition de continuation

  constructor(p: Parser, type = TypeToken.While);
}

class Until extends While {
  // Même structure, mais exécute jusqu'à ce que condition soit vraie
}
```

#### For

```typescript
class For extends Keyword {
  p: Parser;
  block: Block;          // Corps de la boucle
  varName: string;       // Variable d'itération
  valueTokens: Token[];  // Valeurs à itérer

  constructor(p: Parser);
}
```

#### Functions

```typescript
class Functions extends Keyword {
  name?: string;
  p: Parser;
  block: Block;

  constructor(p: Parser, name?: string);
}
```

#### Local

```typescript
class Local extends Keyword {
  varName: string;
  valueBlock?: Block;

  constructor(p: Parser);
}
```

### Reader (parser/classes/Reader.ts)

Classe de base pour la navigation dans les tokens :

```typescript
abstract class Reader {
  tokens: Token[];
  id: number = 0;

  next(): void;                           // Avancer d'un token
  end(i?: number): boolean;               // Vérifier fin
  token(): Token;                         // Token courant
  before(nb?: number): Token;             // Token précédent
  after(nb?: number): Token;              // Token suivant
  findNext(type: TypeToken): number;      // Trouver prochain type
  termination(plus, minus): boolean;      // Trouver fermeture de bloc
  lastTokenBefore(type, nb): number;      // Dernier token avant index
}
```

### Parser (parser/classes/Parser.ts)

```typescript
class Parser extends Reader {
  ASTs: AST[] = [];
  idAST: number = 0;
  lItem?: AST;
  copy: Token[];

  get currentAst(): AST;
  changeIfNotEmpty(): void;
  add(obj: AST): void;
  
  // Méthodes privées pour construire l'AST
  _obj(obj: NonOperators, parsed?: AST): void;
  _binary(obj: Binary): void;
  _unary(obj: Unary): void;
  _block_keywords(obj: Block | Keywords): void;
  _findInsertPoint(obj, current, parent, direction): InsertPoint;
}
```

### Fonctions de parsing (`parser/functions/`)

#### operators.ts - Gestion des opérateurs

```typescript
// Création d'un opérateur binaire
function binary(token: Token, p: Parser) {
  const obj = new Binary(token);
  p.add(obj);
  p.next();
}

// Création d'un opérateur unaire
function unary(token: Token, p: Parser) {
  const obj = new Unary(token);
  p.add(obj);
  p.next();
}

// Opérateur postfixe (ex: &)
function postfixUnary(token: Token, p: Parser) {
  const obj = new Unary(token);
  obj.right = p.currentAst;
  p.ASTs[p.idAST] = obj;
  p.next();
}

// Assignation avec détection d'array literal
function assignement(t: Token, p: Parser) {
  // Détecte arr=(1 2 3) - pas d'espace entre = et (
  const nextToken = p.after();
  if (nextToken?.type === TypeToken.LeftPar) {
    // Array literal assignment
    // ...
  }
  binary(t, p);
}

// Exports des fonctions
export { and, or, not, equal, notequal, plus, minus, star, slash, ... };
```

#### primitives.ts - Gestion des primitives

```typescript
// Création d'un littéral
function literal(t: Token, p: Parser, n?: NonOperators) {
  const obj = n || Primitive.into(t);
  p.next();
  p.add(obj);
}

// Variables avec détection d'accès array
function vars(t: Token, p: Parser) {
  const nextToken = p.after();
  if (nextToken?.type === TypeToken.LeftSqB) {
    // Array access: $arr[index]
    const varName = t.value as string;
    // Parse index expression...
    const arrayAccess = new ArrayAccess(varName, indexBlock);
    p.add(arrayAccess);
  } else {
    literal(t, p);
  }
}

// Arguments (commandes)
function argument(t: Token, p: Parser) {
  if (p.lItem?.type === TypeToken.Argument && /* conditions */) {
    // Ajouter à la commande existante
    (p.lItem as Command).add(t);
  } else {
    // Nouvelle commande
    literal(t, p, new Command(t));
  }
}

export { nums, text, bool, argument, vars };
```

#### exportParser.ts - Exports centralisés

```typescript
import * as keywords from "./keywords";
import * as operators from "./operators";
import * as primitives from "./primitives";

export { keywords, operators, primitives };
```

---

## 3. Evaluator (`packages/language/src/interpretor/eval.ts`)

Évalue l'AST pour produire des résultats. Le fichier fait 640 lignes.

### Types de valeurs JS

```typescript
type PrimitivesJS = string | boolean | number | null;
```

### Opérateurs évalués

```typescript
const operators: FunctionsOperators = {
  // Logiques
  [TypeToken.And]: (a, b) => a && b,
  [TypeToken.Or]: (a, b) => a || b,
  [TypeToken.Not]: (a) => !a,
  
  // Mathématiques
  [TypeToken.Plus]: (a, b) => a + b,      // Aussi concaténation de strings
  [TypeToken.Minus]: (a, b) => a - b,
  [TypeToken.Star]: (a, b) => a * b,      // Aussi répétition de strings
  [TypeToken.Slash]: (a, b) => a / b,
  [TypeToken.Modulo]: (a, b) => a % b,
  [TypeToken.Pow]: (a, b) => a ** b,
  
  // Comparaisons
  [TypeToken.Eq]: (a, b) => a == b,
  [TypeToken.NotEq]: (a, b) => a != b,
  [TypeToken.Less]: (a, b) => a < b,
  [TypeToken.Greater]: (a, b) => a > b,
  [TypeToken.LsEq]: (a, b) => a <= b,
  [TypeToken.GrEq]: (a, b) => a >= b,
};
```

### Fonctions globales built-in

```typescript
const global_functions: FunctionsYash = {
  // Nombres aléatoires
  random: (_, vars) => {
    const min = parseInt(String(vars["1"]));
    const max = parseInt(String(vars["2"]));
    return Math.floor(Math.random() * (max - min) + min);
  },
  
  // Conversions
  nbr: (_, vars) => parseInt(String(vars["1"])),
  str: (_, vars) => String(vars["1"]),
  
  // Math
  max: (_, vars) => Math.max(vars["1"], vars["2"]),
  min: (_, vars) => Math.min(vars["1"], vars["2"]),
  pow: (_, vars) => Math.pow(vars["1"], vars["2"] ?? 2),
  
  // Debug
  type: (_, vars) => Object.entries(vars).map(([k, v]) => `${k}: ${typeof v}`).join(", "),
  tokens: (_, __, ___, tokens) => tokens.map(t => t.type.toString()).join(", "),
  ast: (_, __, ast) => JSON.stringify(ast.toJSON()),
};
```

### Variables spéciales

```typescript
function getSpecialVariable(name: string, bridge: Bridge, scoped_variables: VariablesYash): PrimitivesJS {
  switch (name) {
    case "@":
    case "*": {
      // Tous les paramètres positionnels
      const params: PrimitivesJS[] = [];
      let i = 1;
      while (allVars[String(i)] !== undefined) {
        params.push(allVars[String(i)]);
        i++;
      }
      return params.join(" ");
    }
    case "#": {
      // Nombre de paramètres
      let count = 0;
      while (allVars[String(count + 1)] !== undefined) count++;
      return count;
    }
    case "?":
      return bridge.global_variables["?"] ?? 0;  // Exit code
    case "$":
      return bridge.process?.getCurrentPid() ?? process?.pid ?? 1;  // PID
    case "!":
      return bridge.global_variables["!"] ?? 0;  // Background PID
    case "-":
      return bridge.global_variables["-"] ?? "";  // Shell flags
    case "_":
      return scoped_variables["_"] ?? "";  // Valeur du pipe
    default:
      return null;
  }
}
```

### Fonctions d'évaluation principales

```typescript
// Évalue une primitive (nombre, string, booléen, variable)
async function evalPrimitive({ ast, bridge, scoped_variables, tokens }): Promise<PrimitivesJS>

// Évalue une commande (echo, ls, etc.)
async function evalCommand({ ast, bridge, scoped_variables, tokens }): Promise<PrimitivesJS>

// Évalue une fonction YASH définie par l'utilisateur
async function evalFunctionYASH(name, values, bridge, scoped_variables, tokens): Promise<PrimitivesJS>

// Point d'entrée principal - évalue n'importe quel nœud AST
async function evaluate({ ast, bridge, scoped_variables, tokens }): Promise<PrimitivesJS>
```

### Évaluation des structures de contrôle

```typescript
// If/Elif/Else
if (ast instanceof If) {
  let conditionResult = null;
  for (const condition of ast.condition.parser.ASTs) {
    conditionResult = await evaluate({ ast: condition, bridge, scoped_variables, tokens });
  }
  const isTruthy = conditionResult !== false && conditionResult !== null && conditionResult !== 0 && conditionResult !== "";
  if (isTruthy) {
    // Exécuter le bloc then
  } else if (ast.continue) {
    // Évaluer elif/else
  }
}

// While/Until
if (ast instanceof While) {
  while (true) {
    let conditionResult = await evaluateCondition();
    const isTruthy = /* ... */;
    const isUntil = ast instanceof Until;
    if (isUntil ? isTruthy : !isTruthy) break;
    await executeBlock();
  }
}

// For
if (ast instanceof For) {
  for (const value of ast.valueTokens) {
    scoped_variables[ast.varName] = value;
    await executeBlock();
  }
}
```

### Gestion des pipes

```typescript
// Pipe standard |> - passe le résultat via $_
if (ast.type === TypeToken.Pipe || ast.type === TypeToken.PipeOut) {
  const leftResult = await evaluate({ ast: ast.left, bridge, scoped_variables, tokens });
  const pipedScope = { ...scoped_variables, "_": leftResult };
  return await evaluate({ ast: ast.right, bridge, scoped_variables: pipedScope, tokens });
}

// Pipe inversé <|
if (ast.type === TypeToken.PipeIn) {
  const rightResult = await evaluate({ ast: ast.right, bridge, scoped_variables, tokens });
  const pipedScope = { ...scoped_variables, "_": rightResult };
  return await evaluate({ ast: ast.left, bridge, scoped_variables: pipedScope, tokens });
}
```

### Gestion du background

```typescript
// Opérateur &
if (ast.type === TypeToken.Ampersand) {
  // Fire and forget - n'attend pas
  evaluate({ ast: ast.right, bridge, scoped_variables, tokens }).catch((e) => {
    bridge.err("Background job error:", e);
  });
  return null;
}
```

---

## 4. Builtins (`packages/language/src/interpretor/builtins.ts`)

Commandes shell intégrées. Le fichier fait 1303 lignes.

### Liste complète des builtins

#### Entrée/Sortie

| Commande | Usage | Description |
|----------|-------|-------------|
| `echo` | `echo [-n] [-e] [-E] [args...]` | Affiche les arguments |
| `printf` | `printf format [args...]` | Formatage avancé |

**Options echo :**
- `-n` : pas de newline à la fin
- `-e` : interprète les séquences d'échappement (`\n`, `\t`, `\\`, `\033[...]`)
- `-E` : désactive l'interprétation (par défaut)

**Formats printf :**
- `%s` : string
- `%d` : integer
- `%f` : float
- `%x` : hexadécimal
- `%o` : octal
- `%%` : littéral %

#### Navigation et environnement

| Commande | Usage | Description |
|----------|-------|-------------|
| `pwd` | `pwd` | Affiche le répertoire courant |
| `cd` | `cd [dir]` | Change de répertoire (`~`, `-` supportés) |
| `export` | `export [name[=value]]` | Exporte une variable |
| `unset` | `unset name...` | Supprime une variable |

#### Contrôle de flux

| Commande | Usage | Description |
|----------|-------|-------------|
| `exit` | `exit [code]` | Quitte le shell |
| `return` | `return [n]` | Retourne d'une fonction |
| `break` | `break [n]` | Sort d'une boucle |
| `continue` | `continue [n]` | Prochaine itération |

#### Variables et paramètres

| Commande | Usage | Description |
|----------|-------|-------------|
| `set` | `set [-- args...]` | Définit les paramètres positionnels |
| `shift` | `shift [n]` | Décale les paramètres positionnels |
| `local` | `local name[=value]` | Déclare une variable locale |

#### Tests et conditions

| Commande | Usage | Description |
|----------|-------|-------------|
| `test` / `[` | `test expr` ou `[ expr ]` | Évalue une expression |
| `true` | `true` | Retourne 0 (succès) |
| `false` | `false` | Retourne 1 (échec) |

**Opérateurs test :**

| Opérateur | Description |
|-----------|-------------|
| `-z str` | String vide |
| `-n str` | String non vide |
| `-e file` | Fichier existe |
| `-f file` | Est un fichier |
| `-d file` | Est un répertoire |
| `-r file` | Lisible |
| `-w file` | Inscriptible |
| `-x file` | Exécutable |
| `str1 = str2` | Égalité string |
| `str1 != str2` | Différence string |
| `n1 -eq n2` | Égalité numérique |
| `n1 -ne n2` | Différence numérique |
| `n1 -lt n2` | Inférieur |
| `n1 -le n2` | Inférieur ou égal |
| `n1 -gt n2` | Supérieur |
| `n1 -ge n2` | Supérieur ou égal |

#### Arithmétique

| Commande | Usage | Description |
|----------|-------|-------------|
| `let` | `let expr...` | Évalue des expressions arithmétiques |
| `declare` | `declare [-irx] name[=value]` | Déclare avec attributs |
| `typeset` | Alias de `declare` | |
| `readonly` | `readonly name[=value]` | Variable en lecture seule |

**Opérations let :**
- `var=expr` : assignation
- `var++`, `var--` : incrémentation/décrémentation
- `++var`, `--var` : pré-incrémentation
- `var+=n`, `var-=n` : assignation composée

#### Entrée utilisateur

| Commande | Usage | Description |
|----------|-------|-------------|
| `read` | `read [-p prompt] [-s] [-n count] [-t timeout] [names...]` | Lit une ligne |

**Options read :**
- `-p prompt` : affiche un prompt
- `-s` : mode silencieux (pas d'écho)
- `-n count` : lit exactement N caractères
- `-t timeout` : timeout en secondes

#### Exécution

| Commande | Usage | Description |
|----------|-------|-------------|
| `source` / `.` | `source file [args...]` | Exécute un fichier dans le shell courant |
| `eval` | `eval [args...]` | Évalue les arguments comme commande |
| `exec` | `exec [-c] [-l] command [args...]` | Remplace le shell par une commande |

#### Signaux et traps

| Commande | Usage | Description |
|----------|-------|-------------|
| `trap` | `trap [-lp] [cmd] [signals...]` | Gère les signaux |

**Options trap :**
- `-l` : liste tous les signaux
- `-p` : affiche les traps actuels
- `trap 'cmd' SIGNAL` : définit un handler
- `trap - SIGNAL` : réinitialise au défaut

#### Job control

| Commande | Usage | Description |
|----------|-------|-------------|
| `jobs` | `jobs [-lnprs]` | Liste les jobs |
| `fg` | `fg [job_spec]` | Met un job au premier plan |
| `bg` | `bg [job_spec]` | Reprend un job en arrière-plan |
| `wait` | `wait [-fn] [id...]` | Attend la fin d'un job |
| `disown` | `disown [-ar] [jobspec...]` | Retire un job de la table |
| `kill` | `kill [-signal] pid...` | Envoie un signal |

---

## Interface Bridge

Le `Bridge` est l'interface entre l'interpréteur et l'environnement d'exécution :

```typescript
interface Bridge {
  global_functions: FunctionsYash;   // Fonctions globales
  global_variables: VariablesYash;   // Variables globales
  out: (...args: PrimitivesJS[]) => Promised<void>;   // Sortie standard
  err: (...args: PrimitivesJS[]) => Promised<void>;   // Sortie erreur
  exec: (vals: PrimitivesJS[]) => Promised<any>;      // Exécution de commandes externes
  
  // Extensions optionnelles (SystemBridge)
  fs?: FileSystemOperations;          // Système de fichiers virtuel
  process?: ProcessManager;           // Gestionnaire de processus
  users?: UserManager;                // Gestionnaire d'utilisateurs
  cwd?: string;                       // Répertoire courant
  setCwd?: (path: string) => void;    // Changer de répertoire
  terminal?: TerminalInterface;       // Interface terminal
  history?: string[];                 // Historique des commandes
}
```

Cette abstraction permet d'utiliser YASH dans différents contextes (CLI, web, etc.).

### SystemBridge (@yash/system)

Le `SystemBridge` étend `Bridge` avec un système virtuel complet :

```typescript
import { createSystemBridge } from "@yash/system";
import { run } from "@yash/language";

const bridge = createSystemBridge({
  onOutput: (data) => console.log(data),
  onError: (data) => console.error(data),
});

await run("ls -la /home/user", bridge);
await run("cd /tmp && touch newfile.txt", bridge);
await run("ps aux", bridge);
await run("whoami", bridge);
```

---

## Système Virtuel Complet (@yash/system)

Le package `@yash/system` fournit un système Unix-like complet en mémoire (2544 lignes dans system.ts).

### VirtualFileSystem (`filesystem.ts` - 693 lignes)

Système de fichiers POSIX-like en mémoire avec :

#### Types de fichiers

```typescript
type FileType = "file" | "directory" | "symlink";

interface FileStats {
  type: FileType;
  size: number;
  mode: number;      // Unix-style permissions (e.g., 0o755)
  uid: number;       // Owner user ID
  gid: number;       // Owner group ID
  atime: Date;       // Access time
  mtime: Date;       // Modification time
  ctime: Date;       // Change time (metadata)
  birthtime: Date;   // Creation time
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

interface FileEntry {
  name: string;
  type: FileType;
  content?: string | Uint8Array;
  target?: string;   // For symlinks
  mode: number;
  uid: number;
  gid: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
  children?: Map<string, FileEntry>;  // For directories
}
```

#### Caractéristiques
- **Arborescence complète** : `/`, `/home`, `/tmp`, `/etc`, `/usr`, `/var`, `/bin`, `/dev`, `/proc`
- **Fichiers système** : `/etc/passwd`, `/etc/group`, `/etc/shadow`, `/etc/hostname`
- **Permissions POSIX** : lecture/écriture/exécution par owner/group/others
- **Liens symboliques** : support complet des symlinks et hard links
- **Simulation de disque** : mounts avec taille simulée (100MB par défaut)

#### Interface FileSystemOperations
```typescript
interface FileSystemOperations {
  // Lecture/Écriture
  readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  appendFile(path: string, content: string): Promise<void>;
  
  // Navigation
  readDir(path: string): Promise<string[]>;
  makeDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  removeDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  
  // Manipulation
  deleteFile(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copy(src: string, dest: string): Promise<void>;
  
  // Métadonnées
  stat(path: string): Promise<FileStats>;
  exists(path: string): Promise<boolean>;
  chmod(path: string, mode: number): Promise<void>;
  chown(path: string, uid: number, gid: number): Promise<void>;
  
  // Liens
  symlink(target: string, linkPath: string): Promise<void>;
  readlink(path: string): Promise<string>;
  link(target: string, linkPath: string): Promise<void>;
  
  // Utilitaires
  realpath(path: string): Promise<string>;
  truncate(path: string, length: number): Promise<void>;
  mktemp(prefix?: string): Promise<string>;
  getDiskUsage(mount: string): Promise<{ total: number; used: number; free: number }>;
  tree(path: string): string;
}
```

### VirtualProcessManager (`process.ts` - 604 lignes)

Gestionnaire de processus avec jobs et signaux :

#### Caractéristiques
- **Processus init** : PID 1 (`init`) automatiquement créé
- **Shell process** : PID 2 (`yash`) automatiquement créé
- **Groupes de processus** : pgid, sid pour job control
- **Signaux POSIX** : SIGHUP, SIGINT, SIGKILL, SIGTERM, SIGSTOP, SIGCONT, etc.
- **Job control** : jobs en foreground/background, suspend/resume
- **Nice values** : priorité des processus (-20 à 19)
- **Simulations** : CPU time, memory usage, uptime, load average

#### Interface ProcessInfo
```typescript
interface ProcessInfo {
  pid: number;
  ppid: number;           // Parent process ID
  pgid: number;           // Process group ID
  sid: number;            // Session ID
  uid: number;
  gid: number;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  status: "running" | "stopped" | "zombie" | "sleeping" | "disk-sleep";
  startTime: Date;
  cpuTime: number;        // Simulated CPU time in ms
  memUsage: number;       // Simulated memory usage in KB
  nice: number;           // Nice value (-20 to 19)
  exitCode?: number;
  tty?: string;
  isBackground?: boolean;
}
```

#### Interface JobInfo
```typescript
interface JobInfo {
  jobId: number;
  pid: number;
  status: "running" | "stopped" | "done";
  command: string;
  isBackground: boolean;
}
```

#### Méthodes principales
```typescript
interface ProcessManager {
  getCurrentPid(): number;
  getProcess(pid: number): ProcessInfo | undefined;
  listProcesses(): ProcessInfo[];
  spawn(command: string, args: string[], options?: SpawnOptions): number;
  kill(pid: number, signal?: number): boolean;
  wait(pid: number): Promise<number>;
  
  // Job control
  listJobs(): JobInfo[];
  getJob(jobId: number): JobInfo | undefined;
  foreground(jobId: number): ProcessInfo | undefined;
  background(jobId: number): ProcessInfo | undefined;
  disown(jobId: number): boolean;
  
  // Avancé
  fork(): number;
  exec(command: string, args: string[]): boolean;
  findProcesses(criteria: { uid?: number; command?: string; pattern?: RegExp }): ProcessInfo[];
  killAll(pattern: string | RegExp, signal?: number): number;
  setNice(pid: number, nice: number): boolean;
  trap(pid: number, signal: number, handler: () => void): void;
  untrap(pid: number, signal: number): void;
  
  // Système
  getUptime(): number;
  getLoadAverage(): [number, number, number];
  ps(options?: { all?: boolean; full?: boolean; aux?: boolean }): string;
  top(): string;
  
  // Environnement
  getEnv(name: string): string | undefined;
  setEnv(name: string, value: string): void;
  unsetEnv(name: string): void;
  getAllEnv(): Record<string, string>;
}
```

#### Signaux supportés
```typescript
const Signals = {
  SIGHUP: 1,    SIGINT: 2,    SIGQUIT: 3,   SIGILL: 4,
  SIGTRAP: 5,   SIGABRT: 6,   SIGBUS: 7,    SIGFPE: 8,
  SIGKILL: 9,   SIGUSR1: 10,  SIGSEGV: 11,  SIGUSR2: 12,
  SIGPIPE: 13,  SIGALRM: 14,  SIGTERM: 15,  SIGCHLD: 17,
  SIGCONT: 18,  SIGSTOP: 19,  SIGTSTP: 20,  SIGTTIN: 21,
  SIGTTOU: 22,
};
```

### VirtualUserManager (`users.ts` - 506 lignes)

Gestionnaire d'utilisateurs avec authentification et sessions :

#### Caractéristiques
- **Utilisateurs par défaut** : root, user, nobody, daemon, bin, www-data
- **Groupes par défaut** : root, sudo, users, adm, cdrom, audio, video, plugdev
- **Sessions** : suivi des connexions avec TTY, timestamp, host
- **Authentification** : mots de passe (simulés)
- **Stack UID** : pour su/sudo avec retour possible

#### Interface UserInfo
```typescript
interface UserInfo {
  uid: number;
  gid: number;
  username: string;
  home: string;
  shell: string;
  groups: number[];
  password?: string;      // Hashed password (simulated)
  lastLogin?: Date;
  loginCount?: number;
}
```

#### Interface GroupInfo
```typescript
interface GroupInfo {
  gid: number;
  name: string;
  members: string[];
}
```

#### Interface SessionInfo
```typescript
interface SessionInfo {
  sid: number;           // Session ID
  uid: number;
  tty: string;
  loginTime: Date;
  host: string;
}
```

#### Méthodes principales
```typescript
interface UserManager {
  // Lecture
  getCurrentUser(): UserInfo;
  getUser(uid: number): UserInfo | undefined;
  getUserByName(name: string): UserInfo | undefined;
  getGroup(gid: number): GroupInfo | undefined;
  getGroupByName(name: string): GroupInfo | undefined;
  listUsers(): UserInfo[];
  listGroups(): GroupInfo[];
  listSessions(): SessionInfo[];
  
  // Permissions
  checkPermission(uid: number, gid: number, mode: number, operation: "read" | "write" | "execute"): boolean;
  
  // Gestion utilisateurs (nécessite VirtualUserManager)
  addUser(username: string, options?: { uid?: number; gid?: number; home?: string; shell?: string; groups?: number[] }): UserInfo | null;
  removeUser(username: string): boolean;
  modifyUser(username: string, changes: Partial<UserInfo>): boolean;
  
  // Gestion groupes
  addGroup(name: string, gid?: number): GroupInfo | null;
  removeGroup(name: string): boolean;
  addUserToGroup(username: string, groupName: string): boolean;
  removeUserFromGroup(username: string, groupName: string): boolean;
  
  // Authentification
  authenticate(username: string, password: string): boolean;
  changePassword(username: string, newPassword: string): boolean;
  setCurrentUid(uid: number): boolean;
  exitToParentUser(): boolean;
  
  // Sessions
  createSession(uid: number, tty?: string, host?: string): SessionInfo;
  endSession(sid: number): boolean;
  getCurrentSession(): SessionInfo | undefined;
  
  // Formatage
  id(username?: string): string;
  whoami(): string;
}
```

---

## Commandes système implémentées

### 📁 Fichiers et répertoires

| Commande | Description | Options supportées |
|----------|-------------|-------------------|
| `ls` | Lister le contenu | `-a`, `-l` |
| `cat` | Afficher le contenu | Multiple files |
| `head` | Premières lignes | `-n <num>` |
| `tail` | Dernières lignes | `-n <num>` |
| `touch` | Créer fichier / MAJ timestamp | Multiple files |
| `rm` | Supprimer | `-r`, `-f`, `-rf` |
| `cp` | Copier | `-r`, `-R` |
| `mv` | Déplacer/renommer | - |
| `mkdir` | Créer répertoire | `-p` (recursive) |
| `rmdir` | Supprimer répertoire vide | - |
| `pwd` | Répertoire courant | - |
| `cd` | Changer répertoire | `~`, `-` |
| `tree` | Arborescence | - |
| `stat` | Infos fichier | - |
| `file` | Type fichier | - |
| `wc` | Compter | `-l`, `-w`, `-c` |
| `ln` | Créer lien | `-s` (symlink) |
| `readlink` | Lire lien symbolique | - |
| `realpath` | Chemin absolu | - |
| `basename` | Nom fichier | suffix |
| `dirname` | Chemin répertoire | - |
| `chmod` | Modifier permissions | mode |
| `chown` | Modifier propriétaire | uid:gid |
| `chgrp` | Modifier groupe | gid |
| `df` | Espace disque | mount |
| `du` | Utilisation disque | path |
| `truncate` | Tronquer | size |
| `mktemp` | Fichier temporaire | prefix |
| `shred` | Suppression sécurisée | - |
| `split` | Diviser fichier | `-l <lines>`, prefix |
| `unlink` | Supprimer fichier | - |
| `shuf` | Mélanger lignes | - |

### 📝 Traitement de texte

| Commande | Description | Options supportées |
|----------|-------------|-------------------|
| `grep` | Rechercher motif | pattern, file |
| `cut` | Extraire colonnes | `-d`, `-f` |
| `sort` | Trier lignes | `-r`, `-n`, `-u` |
| `uniq` | Supprimer doublons | `-c`, `-d` |
| `tr` | Traduire caractères | set1, set2 |
| `rev` | Inverser lignes | - |
| `tac` | Fichier inversé | - |
| `nl` | Numéroter lignes | - |
| `fold` | Replier lignes | `-w <width>` |
| `paste` | Fusionner lignes | `-d` |
| `join` | Joindre fichiers | - |
| `comm` | Comparer fichiers triés | - |
| `diff` | Comparer fichiers | - |
| `expand` | Tabs → espaces | `-t <size>` |
| `unexpand` | Espaces → tabs | `-t <size>` |
| `fmt` | Formater texte | `-w <width>` |
| `column` | Formater colonnes | `-s`, `-t` |
| `strings` | Extraire chaînes | `-n <length>` |
| `od` | Dump octal | `-x` |
| `hexdump` | Dump hexadécimal | `-C` |
| `xxd` | Dump hex + reverse | `-r` |
| `tee` | Dupliquer sortie | `-a` |

### 🔍 Recherche

| Commande | Description | Options supportées |
|----------|-------------|-------------------|
| `find` | Rechercher fichiers | `-name`, `-type` |
| `locate` | Recherche rapide | pattern |
| `which` | Localiser commande | command |
| `type` | Type de commande | command |
| `whereis` | Localiser binaire | command |
| `xargs` | Construire commandes | command |

### ⚙️ Processus et système

| Commande | Description | Options supportées |
|----------|-------------|-------------------|
| `ps` | Lister processus | `-a`, `-e`, `-f`, `aux` |
| `kill` | Envoyer signal | `-<signal>`, pid |
| `killall` | Tuer par nom | name |
| `pgrep` | Rechercher par motif | pattern |
| `pkill` | Tuer par motif | pattern |
| `pidof` | PID par nom | name |
| `uptime` | Temps fonctionnement | - |
| `free` | Mémoire disponible | - |
| `nice` | Modifier priorité | `-n <adj>`, command |
| `renice` | Changer priorité | priority, pid |
| `nohup` | Immuniser hangups | command |
| `timeout` | Limite de temps | duration, command |
| `watch` | Exécuter périodiquement | `-n <sec>`, command |
| `time` | Mesurer temps | command |

### 👤 Utilisateurs et groupes

| Commande | Description | Options supportées |
|----------|-------------|-------------------|
| `whoami` | Utilisateur courant | - |
| `id` | Identité utilisateur | username |
| `groups` | Groupes utilisateur | username |
| `users` | Liste utilisateurs | - |
| `who` | Utilisateurs connectés | - |
| `w` | Activité utilisateurs | - |
| `last` | Dernières connexions | - |
| `passwd` | Changer mot de passe | username |
| `su` | Changer utilisateur | username |
| `sudo` | Exécuter en root | command |

### 🌐 Réseau (simulé)

| Commande | Description | Options supportées |
|----------|-------------|-------------------|
| `ping` | Tester connectivité | host, `-c <count>` |
| `curl` | Requête HTTP | url |
| `wget` | Télécharger | url |
| `host` | Résolution DNS | domain |
| `dig` | Requête DNS | domain |
| `netstat` | Stats réseau | - |
| `ifconfig` | Config interface | - |
| `hostname` | Nom machine | - |

### 📊 Informations système

| Commande | Description | Options supportées |
|----------|-------------|-------------------|
| `uname` | Infos système | `-a` |
| `date` | Date et heure | `+%s`, `+%Y-%m-%d`, `+%H:%M:%S` |
| `cal` | Calendrier | month, year |
| `env` | Variables environnement | - |
| `printenv` | Afficher variable | name |
| `lscpu` | Infos CPU | - |
| `lsblk` | Infos blocs | - |
| `lsmem` | Infos mémoire | - |
| `dmesg` | Messages noyau | - |

### 🔧 Utilitaires

| Commande | Description | Options supportées |
|----------|-------------|-------------------|
| `echo` | Afficher texte | `-n`, `-e` (builtin) |
| `printf` | Afficher formaté | format, args (builtin) |
| `test` / `[` | Évaluer expression | (builtin) |
| `true` | Retourner succès | (builtin) |
| `false` | Retourner échec | (builtin) |
| `yes` | Répéter | text |
| `factor` | Factoriser | number |
| `expr` | Évaluer expression | expression |
| `bc` | Calculatrice | expression |
| `seq` | Générer séquence | start, [step], end |
| `sleep` | Attendre | seconds |
| `clear` | Effacer écran | - |
| `reset` | Réinitialiser terminal | - |
| `tty` | Nom terminal | - |
| `stty` | Paramètres terminal | `size` |
| `history` | Historique commandes | - |
| `base64` | Encoder/décoder | `-d` |
| `md5sum` | Calculer MD5 | file |
| `sha256sum` | Calculer SHA256 | file |
| `cksum` | Calculer CRC | file |
| `sum` | Calculer checksum | file |

**Total : ~100+ commandes implémentées**

### 🔲 Commandes à implémenter

| Catégorie | Commandes |
|-----------|-----------|
| **Texte avancé** | `sed`, `awk` |
| **Compression** | `tar`, `gzip`, `gunzip`, `zcat`, `bzip2`, `zip`, `unzip` |
| **Réseau avancé** | `ssh`, `scp`, `sftp`, `nc`, `traceroute` |
| **Gestion tâches** | `cron`, `crontab`, `at`, `batch` |

---

## Modes d'exécution

### Mode REPL (`src/exec/repl.ts`)
```bash
bun src/exec/repl.ts
```
Lance un shell interactif avec le prompt `yash >> `.

### Mode Run (`src/exec/run.ts`)
```bash
bun src/exec/run.ts fichier.ysh
```
Exécute un ou plusieurs fichiers YASH.

---

## Syntaxe YASH

### Variables
```bash
myvar = 42
echo $myvar
```

### Fonctions
```bash
function greet {
    echo "Hello" $1
}
greet "World"

# Ou syntaxe alternative :
myFunc() {
    echo $1 $2
}
```

### Conditionnelles
```bash
if ($a == 12)
then
    echo "Yes!"
else
then
    echo "No!"
fi
```

### Opérations mathématiques
```bash
result = 5 + 3 * 2
echo $result
```

### Commentaires
```bash
# Ceci est un commentaire
echo "Hello" # Commentaire en fin de ligne
```

### Boucles

#### While
```bash
i = 1
while ($i < 5) do
    echo $i
    i = $i + 1
done
```

#### Until (exécute jusqu'à ce que la condition soit vraie)
```bash
i = 1
until ($i > 5) do
    echo $i
    i = $i + 1
done
```

#### For (itère sur des valeurs)
```bash
for x in 1 2 3 4 5 do
    echo "Valeur:" $x
done

for name in "Alice" "Bob" "Charlie" do
    echo "Bonjour" $name
done
```

### Arrays
```bash
# Création d'un array
arr=(1 2 3 "hello" true)

# Accès par index (0-based)
echo $arr[0]      # 1
echo $arr[3]      # hello

# Accès avec variable
i = 2
echo $arr[$i]     # 3

# Accès avec expression
echo $arr[1 + 1]  # 3
```

### Pipes
```bash
# Pipe standard - passe le résultat via $_
5 |> $_ * 2       # 10

# Pipe inversé
$_ + 10 <| 5      # 15

# Chaînage de pipes
5 |> $_ * 2 |> $_ + 10  # 20
```

### Background
```bash
# Exécuter une commande en arrière-plan
long_task &
```

---

## Gestion des erreurs

La classe `ErrorYASH` gère trois types d'erreurs :
- `TypeErrors.Lexer` : erreurs de tokenization
- `TypeErrors.Parser` : erreurs de syntaxe
- `TypeErrors.Eval` : erreurs d'évaluation

Chaque erreur contient une position (ligne, colonne) pour le debugging.

---

## Compilation

### Build simple
```bash
bun run build
# Produit: build/runner.js
```

### Compilation en exécutable
```bash
# Version REPL
bun build --compile src/exec/repl.ts --outfile ./build/YASH_repl

# Version Run
bun build --compile src/exec/run.ts --outfile ./build/YASH_run
```

### Docker
```bash
docker build -t yash .
docker run -it yash  # Lance le REPL
```

---

## Points d'amélioration (TODO)

### ✅ Fonctionnalités implémentées

1. **Commandes built-in shell** (`@yash/language`) :
   - Core : `echo`, `printf`, `test`/`[`, `true`, `false`
   - Navigation : `cd`, `pwd`, `export`
   - Contrôle : `exit`, `return`, `break`, `continue`
   - Variables : `set`, `shift`, `unset`, `export`
   - Arithmétique : `let`, `declare`, `typeset`, `readonly`
   - Entrée/Sortie : `read`, `source`/`.`, `eval`
   - Variables locales : `local`
   - Processus : `exec`, `trap`
   - Job control : `jobs`, `fg`, `bg`, `wait`, `disown`, `kill`

2. **Sous-système virtuel** (`@yash/system`) :
   - `VirtualFileSystem` : POSIX-like avec mounts, permissions, liens
   - `VirtualProcessManager` : processus, jobs, signaux, sessions, nice
   - `VirtualUserManager` : utilisateurs, groupes, authentification, sessions
   - `createSystemBridge()` : 100+ commandes système

3. **Flow control** : pipes (`|`, `|>`, `<|`), opérateur background (`&`)

4. **Boucles** : `while`, `until`, `for ... in`

5. **Position tracking** : ligne, colonne dans les tokens

6. **Mots-clés** : `local`, `function()` syntax

7. **Structures de données** : Arrays (`arr=(1 2 3)`, `$arr[0]`, `$arr[$i]`)

8. **Variables spéciales** : `$@`, `$*`, `$#`, `$?`, `$$`, `$!`

### 🔲 À implémenter

1. **Séparation des concepts** :
   - Statement vs Expression
   - Bits : opérateurs bit à bit (`&`, `|`, `^`, `~`)

2. **Mode strict Bash** : compatibilité complète avec scripts Bash standards

3. **Commandes complexes** :
   - `sed` : éditeur de flux (nécessite parser complexe)
   - `awk` : traitement de texte avancé (nécessite interpréteur)
   - Compression : `tar`, `gzip`, `zip` (nécessite gestion binaire)

4. **Fonctions helper** : pour utilisation depuis C

5. **Convertisseur YASH → Bash**

6. **Structures de données avancées** : Dicts, Tuples

7. **Documentation complète**

---

## Conventions de code

- Structure monorepo avec `packages/`
- Classes AST dans `packages/language/src/interpretor/parser/classes/`
- Fonctions de parsing dans `packages/language/src/interpretor/parser/functions/`
- Export centralisé via `exportParser.ts`
- Utilisation de TypeScript strict
- Pattern de tokenization manuel (pas de générateur lexer)
- Pattern Visitor implicite pour l'évaluation
- Imports entre packages via `@yash/language`, `@yash/system`

---

## Types TypeScript (`packages/language/src/types.ts`)

```typescript
// Valeurs primitives JavaScript
type PrimitivesJS = string | boolean | number | null;

// Types de promesse
type Promised<T> = T | Promise<T>;

// Fonctions YASH
type FunctionsYash = Record<
  string,
  (
    bridge: Bridge,
    vars: VariablesYash,
    ast?: AST,
    tokens?: Token[]
  ) => Promised<PrimitivesJS>
>;

// Variables YASH
type VariablesYash = Record<string, PrimitivesJS>;

// Interface Bridge
interface Bridge {
  global_functions: FunctionsYash;
  global_variables: VariablesYash;
  out: (...args: PrimitivesJS[]) => Promised<void>;
  err: (...args: PrimitivesJS[]) => Promised<void>;
  exec: (vals: PrimitivesJS[]) => Promised<PrimitivesJS>;
  
  // Extensions optionnelles
  fs?: FileSystemOperations;
  process?: ProcessManager;
  users?: UserManager;
  cwd?: string;
  setCwd?: (path: string) => void;
  terminal?: TerminalInterface;
  history?: string[];
  addHistory?: (cmd: string) => void;
}

// Types AST
type NonOperators = Primitive | Command;
type Operators = Binary | Unary;
type Keywords = If | ElseIf | Else | While | Until | For | Functions | Local;
type AST = NonOperators | Operators | Block | Keywords | ArrayLiteral | ArrayAccess;

// Opérateurs
type FunctionsOperators = {
  [key in TypeToken]?: (...args: PrimitivesJS[]) => PrimitivesJS;
};

// Fonction de terminaison (pour parser)
type TermFunc = (t: Token, i?: number) => boolean;
```

---

## Runner (`packages/language/src/runner.ts`)

Point d'entrée principal pour l'exécution de code YASH :

```typescript
import { lexer } from "./interpretor/lexer";
import { parse } from "./interpretor/parser";
import { evaluate } from "./interpretor/eval";
import * as types from "./types";

async function run(str: string, inter: types.Bridge) {
  // 1. Créer le bridge avec valeurs par défaut
  const bridgeInstance: types.Bridge = {
    global_variables: inter.global_variables ?? {},
    global_functions: inter.global_functions ?? {},
    out: inter.out,
    err: inter.err,
    exec: inter.exec,
    fs: inter.fs,
    process: inter.process,
    users: inter.users,
    cwd: inter.cwd,
    setCwd: inter.setCwd,
    terminal: inter.terminal,
    history: inter.history,
    addHistory: inter.addHistory,
  };
  
  try {
    // 2. Lexer: code source → tokens
    const lexed = lexer(str);
    
    // 3. Parser: tokens → AST
    const { ASTs, copy: copyTokens } = parse(lexed);
    
    // 4. Créer scope partagé (sans paramètres positionnels)
    const scoped_variables: types.VariablesYash = {};
    for (const [key, value] of Object.entries(bridgeInstance.global_variables)) {
      if (!/^\d+$/.test(key)) {
        scoped_variables[key] = value;
      }
    }
    
    // 5. Évaluer chaque AST
    for (const tree of ASTs) {
      try {
        const evld = await evaluate({
          ast: tree,
          bridge: bridgeInstance,
          scoped_variables,
          tokens: copyTokens
        });
        if (evld !== undefined) {
          await bridgeInstance.out(evld);
        }
        // Synchroniser les variables globales
        for (const [key, value] of Object.entries(bridgeInstance.global_variables)) {
          if (!/^\d+$/.test(key)) {
            scoped_variables[key] = value;
          }
        }
      } catch (e) {
        await bridgeInstance.err(e as any);
      }
    }
  } catch (e) {
    await bridgeInstance.err(e as any);
  }
}

export { run, lexer, parse, evaluate, types }
```

---

## Tests

### Tests unitaires (Bun test)

```bash
# Tous les tests (230 tests)
bun test

# Tests du package language (199 tests)
cd packages/language && bun test

# Tests du package system (31 tests)
cd packages/system && bun test
```

### Fichiers de test YASH

Les fichiers de test `.ysh` sont dans `test/` :
- `function.ysh` : test des fonctions
- `if.ysh` : test des conditionnelles
- `guess_game.ysh` : jeu de devinette (exemple complet)
- `error.ysh` : fichier vide (placeholder pour tests d'erreurs)

Pour exécuter un fichier test :
```bash
bun src/exec/run.ts test/function.ysh
```

---

## Utilisation des packages

### @yash/language

```typescript
import { run, lexer, parse, evaluate } from "@yash/language";

// Créer un bridge simple
const bridge = {
  global_functions: {},
  global_variables: {},
  out: async (...args) => console.log(...args),
  err: async (...args) => console.error(...args),
  exec: async (vals) => vals.join(" "),
};

await run('echo "Hello World"', bridge);
```

### @yash/system

```typescript
import { createSystemBridge, VirtualFileSystem } from "@yash/system";
import { run } from "@yash/language";

// Bridge avec système virtuel complet
const bridge = createSystemBridge({
  onOutput: console.log,
  onError: console.error,
});

// Commandes système fonctionnelles
await run("mkdir -p /home/user/project", bridge);
await run("cd /home/user/project", bridge);
await run("touch README.md", bridge);
await run("ls -la", bridge);
await run("ps aux", bridge);
await run("df /", bridge);
await run("whoami && id", bridge);
```

### @yash/website

```typescript
import { createWebTerminal } from "@yash/website";

const terminal = createWebTerminal({
  onOutput: (data) => displayInUI(data),
  welcomeMessage: "Welcome to YASH Web Terminal",
});

await terminal.execute("whoami");
console.log(terminal.getCwd()); // /home/user
```

---

## Exemples avancés

### Script avec boucles et conditions
```bash
#!/bin/yash

# Calculer la factorielle
function factorial {
    n = $1
    result = 1
    while ($n > 1) do
        result = $result * $n
        n = $n - 1
    done
    echo $result
}

# Usage
factorial 5  # Affiche 120
```

### Manipulation de fichiers
```bash
# Créer une structure de projet
mkdir -p /tmp/project/src
mkdir -p /tmp/project/tests
touch /tmp/project/README.md
touch /tmp/project/src/main.ysh

# Afficher la structure
tree /tmp/project
```

### Gestion de processus
```bash
# Lancer un processus en background
sleep 10 &

# Voir les jobs
jobs

# Voir tous les processus
ps aux

# Tuer par nom
killall sleep
```

### Traitement de texte
```bash
# Créer un fichier
echo "apple" > fruits.txt
echo "banana" >> fruits.txt
echo "apple" >> fruits.txt
echo "cherry" >> fruits.txt

# Trier et supprimer doublons
sort -u fruits.txt

# Compter les lignes
wc -l fruits.txt

# Rechercher un motif
grep "app" fruits.txt
```
