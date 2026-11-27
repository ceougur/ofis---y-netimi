// Ç5-A tur 1c: iki esdeger.mjs çıktısını karşılaştırır. Kullanım: node esdeger-karsilastir.mjs <taban.json> <uc.json> <etiket>. Çıkış 0 = hepsi birebir, 1 = fark var.
import { readFileSync } from "node:fs";

const [a, b, label] = process.argv.slice(2);
const A = JSON.parse(readFileSync(a, "utf8"));
const B = JSON.parse(readFileSync(b, "utf8"));
let bad = 0;
const lines = [];
for (const name of new Set([...Object.keys(A.outputs), ...Object.keys(B.outputs)])) {
  const x = A.outputs[name];
  const y = B.outputs[name];
  const same = x && y && x.status === y.status && x.sha === y.sha;
  if (!same) bad += 1;
  let where = "";
  if (!same && x?.text && y?.text) {
    let i = 0;
    while (i < x.text.length && x.text[i] === y.text[i]) i += 1;
    where = ` · ilk fark ${i}. karakter: taban «${x.text.slice(Math.max(0, i - 80), i + 120)}» · uç «${y.text.slice(Math.max(0, i - 80), i + 120)}»`;
  }
  lines.push(`${same ? "AYNI " : "FARK "} ${name}: ${x?.status ?? "—"}/${y?.status ?? "—"} · ${x?.sha?.slice(0, 16) ?? "—"} ${same ? "=" : "≠"} ${y?.sha?.slice(0, 16) ?? "—"} · ${x?.bytes ?? "—"} bayt${x?.count !== undefined ? ` · ${x.count} madde` : ""}${where}`);
}
console.log(`[eşdeğerlik] ${label} · TZ ${A.tz} · şema ${A.schema}/${B.schema} · dondurma ${JSON.stringify(A.freeze)} · ${bad ? `${bad} FARK` : "hepsi birebir"} (${lines.length} çıktı)`);
for (const line of lines) console.log(`  ${line}`);
process.exit(bad ? 1 : 0);
