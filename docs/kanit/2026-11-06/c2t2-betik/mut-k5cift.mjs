// Mutasyon: K5 "kalan ters kaydın asıl fişi kaldırılmaz" satırı silinir (BAŞ MİMAR KARARI 5). Kullanım: node mut-k5cift.mjs <kopya kökü>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const file = path.join(path.resolve(process.argv[2]), "server/lib/ledger-vouchers.mjs");
const text = readFileSync(file, "utf8");
const line = '  for (const row of store.all("SELECT id, reversal_of AS of FROM ledger_vouchers WHERE reversal_of IS NOT NULL")) if (!removing.has(row.id)) removing.delete(row.of);\n';
if (text.split(line).length !== 2) throw new Error("satır tek değil");
writeFileSync(file, text.replace(line, ""));
console.log("mutasyon uygulandı");
