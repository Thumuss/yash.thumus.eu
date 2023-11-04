import { evaluate, lexer, parse, types } from "./import";

async function run(str: string, inter: types.Bridge) {
  const lexed = lexer(str);
  const parsed = parse(lexed).parsed;
  inter.out(await evaluate(parsed, inter));
}

const promptMessage = "yash >> ";
const helpMessage = "Welcome to the REPL of YASH\nType `?` to get help";
if (Bun) {
  const out = (...args: types.PrimitivesJS[]): void => {
    Bun.write(Bun.stdout, args.map(String).join(" "));
  };

  const exec = async (vals: string[]) => {
    const proc = Bun.spawn(vals);
    return await new Response(proc.stdout).text();
  };
 
  const bridge: types.Bridge = {
    out,
    exec,
  };

  console.log(helpMessage);
  Bun.write(Bun.stdout, promptMessage);
  for await (const entry of console) {
    await run(entry, bridge);
    Bun.write(Bun.stdout, promptMessage);
  }
} else {
}
