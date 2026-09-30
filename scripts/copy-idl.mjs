// Copia a IDL gerada pelo `anchor build` para o SDK. Rode via `npm run build:program`.
import { copyFileSync, existsSync } from "node:fs";

const from = "target/idl/tabbit.json";
const to = "sdk/src/idl/tabbit.json"; // + tipos em sdk/src/idl/tabbit.ts
if (!existsSync(from)) {
  console.error(`Não achei ${from}. Rode "anchor build" antes.`);
  process.exit(1);
}
copyFileSync(from, to);
copyFileSync("target/types/tabbit.ts", "sdk/src/idl/tabbit.ts");
console.log(`IDL copiada para ${to}`);
