import { lexer } from "./interpretor/lexer";
import { parse } from "./interpretor/parser";
import { evaluate } from "./interpretor/eval";
import * as types from "./types";

async function run(str: string, inter: types.Bridge) {
    try {
      const lexed = lexer(str);
      const ASTs = parse(lexed).ASTs;
      for (const tree of ASTs) {
        try {
          const evld = await evaluate(tree, inter);
          if (evld != undefined) {
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

export { run, lexer, parse, evaluate, types }