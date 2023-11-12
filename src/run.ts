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
    functions: {},
    variables: {},
    out,
    err: out,
    exec,
  };

  const args = process.argv.slice(2)
  if (args[0]) {
    await run(await Bun.file(args[0]).text(), bridge)
  }
} else {
}
