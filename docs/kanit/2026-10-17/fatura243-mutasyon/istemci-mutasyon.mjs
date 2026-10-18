// İstemci kuralları için mutasyon (KANIT 3): kopyada (ders 23) düzeltmeler bilerek bozulur; sonra senaryo-fatura-243 ortak kilitle koşulur.
// Beklenen: bozulan her kuralın adımı kırmızı (B2 adım 4, B6 adım 6, B7 adım 5, B8 adım 2, B12/B13 adım 3), öbür adımlar yeşil.
// Kullanım: node istemci-mutasyon.mjs <kopya kökü>   (yalnız dosyaları bozar; koşuyu çağıran yapar)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2]);
const MUTANTS = [
  ["client/assets/hof-invoices.js", "B2", "const skippedReturnLine = (form, line) => isReturn(form.kind) && Boolean(line.originLineId) && !(amountNum(line.qty) > 0);", "const skippedReturnLine = () => false;"],
  ["client/assets/hof-invoices.js", "B7", "        if (blockers.length) return fail(`Fatura kaydedilemez: ${blockers.join(\" \")}`);", ""],
  ["client/assets/hof-invoices.js", "B8", "      if (qty > 0 && after < 0) return `<span", "      if (false) return `<span"],
  ["client/assets/hof-invoices.js", "B12", "    if (!isReturn(form.kind) && !usedLines(form).some(line => amountNum(line.unitPrice) > 0)) {", "    if (false) {"],
  ["client/assets/hof-invoices.js", "B13", "      if (NUMERIC_LINE_FIELDS.has(field)) {", "      if (false) {"],
  ["client/assets/hof-accounts.js", "B6", "              onClose: () => resolve(chosen),", "              onClose: () => resolve(chosen || preferred),"],
];
for (const [file, id, from, to] of MUTANTS) {
  const full = path.join(root, file);
  const text = readFileSync(full, "utf8");
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${id}: kalıp ${count} kez bulundu`);
  writeFileSync(full, text.replace(from, to));
  console.log(`${id} bozuldu (${file})`);
}
