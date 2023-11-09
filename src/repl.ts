import { evaluate, lexer, parse, types } from "./import";

async function run(str: string, inter: types.Bridge) {
  try {
    const lexed = lexer(str);
    const parsed = parse(lexed).parsed;
    for (const tree of parsed) {
      try {
        const evld = await evaluate(tree, inter);
        if (evld) {
          await inter.out(evld);
        }
      } catch (e: any) {
        await inter.err(e);
      }
    }
  } catch (e: any) {
    await inter.err(e);
  }
}

const promptMessage = "yash >> ";
const helpMessage = "Welcome to the REPL of YASH\nType `?` to get help";
if (Bun) {
  const out = (...args: types.PrimitivesJS[]): void => {
    let wri = args.map(String).join(" ");
    if (!wri.endsWith("\n")) wri += "\n";
    Bun.write(Bun.stdout, wri);
  };

  const exec = async (vals: string[]) => {
    const proc = Bun.spawn(vals);
    return await new Response(proc.stdout).text();
  };

  const bridge: types.Bridge = {
    out,
    err: out,
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
