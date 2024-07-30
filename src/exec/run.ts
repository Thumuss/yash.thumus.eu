import { run, types } from "../runner";

if (Bun) {
  const out = (...args: types.PrimitivesJS[]): void => {
    let wri = args.map(String).join(" ");
    if (!wri.endsWith("\n")) wri += "\n";
    Bun.write(Bun.stdout, wri);
  };

  const exec = async (vals: types.PrimitivesJS[]) => {
    const proc = Bun.spawn(vals.map(String));
    return await new Response(proc.stdout).text();
  };

  const bridge: types.Bridge = {
    global_functions: {},
    global_variables: {},
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
