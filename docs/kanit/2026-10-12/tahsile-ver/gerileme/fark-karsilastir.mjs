// fark-cek-akislari.mjs çıktılarını karşılaştırır (eski ↔ yeni). Her farkı yol + eski + yeni olarak yazar; "beklenen yeni alan" (yalnız yenide
// var olan anahtar: Bankaya Tahsile Ver'in eklediği alanlar) ayrı sayılır. Çıkış: 0 fark yok, 1 beklenmeyen fark var.
//   node fark-karsilastir.mjs <eski.json> <yeni.json> [--ozet]
import { readFileSync } from "node:fs";

const [oldPath, newPath] = process.argv.slice(2);
// Rastgele kimlikler (sıra numaralı takma adlar <idN>, ev-… olay kimlikleri, bl-/ae-… satır kimlikleri) tek simgeye indirilir: iki koşuda
// sıra numarası, yalnız yenide olan alanlar yüzünden kayabilir; kimliğin kendisi karşılaştırma konusu değildir.
const canon = value => {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, canon(item)]));
  if (typeof value === "string") return value.replace(/<id\d+>/g, "<id>").replace(/\b(?:ev|bl|ae|pe|ce|cash|entry|chq|chqcol|evt|mv|inv|pl|req)-[0-9a-z-]{10,}\b/gi, "<rid>");
  return value;
};
const A = canon(JSON.parse(readFileSync(oldPath, "utf8")));
const B = canon(JSON.parse(readFileSync(newPath, "utf8")));
const added = [];
const removed = [];
const changed = [];
const walk = (a, b, at) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) changed.push({ at: `${at}.length`, old: a.length, new: b.length });
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) walk(a[i], b[i], `${at}[${i}]`);
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(key in a)) added.push({ at: `${at}.${key}`, new: b[key] });
      else if (!(key in b)) removed.push({ at: `${at}.${key}`, old: a[key] });
      else walk(a[key], b[key], `${at}.${key}`);
    }
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) changed.push({ at, old: a, new: b });
};
walk(A.steps, B.steps, "steps");
walk(A.reads, B.reads, "reads");
const short = value => JSON.stringify(value)?.slice(0, 300);
console.log(`eski ${A.version} (${A.commit || "-"}) ↔ yeni ${B.version} (${B.commit || "çalışma ağacı"})`);
console.log(`\n== YALNIZ YENİDE OLAN ANAHTARLAR (${added.length}) ==`);
const addedKeys = new Map();
for (const item of added) {
  const key = item.at.replace(/\[\d+\]/g, "[]").replace(/^reads\.cekKart:[^.]+/, "reads.cekKart:*").replace(/^steps\[\]/, "steps[]");
  addedKeys.set(key, (addedKeys.get(key) || 0) + 1);
}
for (const [key, n] of addedKeys) console.log(`  ${key} ×${n}`);
console.log(`\n== YALNIZ ESKİDE OLAN ANAHTARLAR (${removed.length}) ==`);
for (const item of removed) console.log(`  ${item.at}: ${short(item.old)}`);
console.log(`\n== DEĞERİ DEĞİŞENLER (${changed.length}) ==`);
for (const item of changed) console.log(`  ${item.at}\n     eski: ${short(item.old)}\n     yeni: ${short(item.new)}`);
process.exit(removed.length || changed.length ? 1 : 0);
