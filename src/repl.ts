import { evaluate, lexer, parse } from "./import";
import { PrimitivesJS } from "./lexer";

interface Bridge {
  out: (...args: PrimitivesJS[]) => void;
  exec: (vals: string[]) => any;
}

async function run(str: string, inter: Bridge) {
  const lexed = lexer(str);
  const parsed = parse(lexed).parsed;
  inter.out(await evaluate(parsed, inter.exec));
}

if (Bun) {
  const exec = async (vals: string[]) => {
    const proc = Bun.spawn(vals);
    return await new Response(proc.stdout).text();
  };
  const bridge: Bridge = {
    out: console.log,
    exec,
  };
  console.log("Welcome to the REPL of YASH\nType `?` to get help");
  Bun.write(Bun.stdout, "yash >> ");
  for await (const entry of console) {
    await run(entry, bridge);
    Bun.write(Bun.stdout, "yash >> ");
  }
} else {
}
