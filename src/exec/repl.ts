import { run, types } from "../runner";
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
    global_functions: {
      test1: (_, vars: types.VariablesYash) => {
        console.log(vars);
      },
    },
    global_variables: {},
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
