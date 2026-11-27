// Mutasyon betiğinin 36–55 metinleri kopyada tam bir kez mi geçiyor (çalıştırmadan; betiğin MUTASYONLAR dizisi metinden ayrıştırılır).
import { readFileSync } from "node:fs";
import path from "node:path";

const [script, copy] = process.argv.slice(2);
const text = readFileSync(script, "utf8");
const start = text.indexOf("const MUTASYONLAR = [");
const end = text.indexOf("\n];", start);
const body = text.slice(start + "const MUTASYONLAR = ".length, end + 3);
const consts = { LV: "server/lib/ledger-vouchers.mjs", MIG: "server/lib/migrations.mjs", GL: "server/lib/general-ledger.mjs", MAIN: "", LIFE: "", KORUMA: "", KAYIT: "", BANKA: "", LOGD: "server/lib/log-detail.mjs", BANKR: "server/lib/bank/repair.mjs", INTEG: "server/lib/integrity.mjs" };
const list = new Function(...Object.keys(consts), `return ${body};`)(...Object.values(consts));
for (const [no, , file, from] of list) {
  const src = readFileSync(path.join(copy, file), "utf8");
  const n = src.split(from).length - 1;
  if (n !== 1 || no >= 36) console.log(`${no} ${file}: ${n} kez${n === 1 ? "" : "  <-- SORUN"}`);
}
