#!/usr/bin/env node
// 2.5.1 D3 tur 3 / tur 4 — İLETİ KATALOĞU üreticisi (test değildir; CI dışı). Testlerin GERÇEKTEN ürettiği iletiler (test/fixtures/devir-d3-ileti-katalog.mjs kaydedicisi, D3T3_KATALOG_DIR)
// okunur; her neden (iç kod) için ilk örnek dört alanıyla, hangi senaryodan ve hangi veri kaynağından çıktığıyla yazılır. Elle metin YOK — cümleler yanıt gövdesinden.
// Tur 4: KATALOG TARAMASI — yazılan her kullanıcı alanı (başlık, ne oldu, neden, adımlar, nereye) iletiDenetimi'nden (iç kod / İngilizce / alan adı / ISO tarih / nokta ondalık) ve şemanın
// tablo adlarından (plan-reader.mjs DEVIR_TABLE_CLASSES) geçer; ihlal varsa listelenir ve çıkış kodu 1.
// Kullanım: D3T3_KATALOG_DIR=<klasör> node --test test/devir-d3-*.test.mjs   (sıra fark etmez — D3 tur 5)
//           node test/devir-d3-ileti-katalog.mjs <klasör> <çıktı .md>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { iletiDenetimi } from "../server/lib/devir/iletiler.mjs";
import { DEVIR_TABLE_CLASSES } from "../server/lib/devir/plan-reader.mjs";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error("kullanım: node test/devir-d3-ileti-katalog.mjs <kayıt klasörü> <çıktı .md>");
const rows = [];
for (const file of readdirSync(dir).filter(name => name.endsWith(".jsonl")).sort()) {
  for (const line of readFileSync(path.join(dir, file), "utf8").split(/\r?\n/)) if (line.trim()) rows.push(JSON.parse(line));
}
// D3 tur 5 (tur 4 SONRAKİ SÜRÜME notu): "ilk örnek" ve sıra KOŞU SIRASINDAN BAĞIMSIZ — her neden için örnek, o nedenin bütün kayıtları arasından (test, senaryo, kaynak, metin) sırasıyla en
// küçüğü; nedenler seviye (önce durduranlar) ve iç kod sırasıyla. Karşılaştırma kod noktasıyla (yerel ayar sıralaması değil). Aynı kayıtlar hangi sırayla yazılmış olursa olsun katalog bayt bayt aynı.
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const keyOf = row => [row.test, row.senaryo, row.kaynak, row.metin].map(value => String(value ?? ""));
const byCode = new Map();
for (const row of rows) {
  const seen = byCode.get(row.kod);
  if (!seen) byCode.set(row.kod, { ...row, adet: 1 });
  else {
    seen.adet += 1;
    const [a, b] = [keyOf(row), keyOf(seen)];
    const smaller = a.findIndex((value, index) => value !== b[index]);
    if (smaller >= 0 && a[smaller] < b[smaller]) byCode.set(row.kod, { ...row, adet: seen.adet });
  }
}
const rank = level => (level === "durdurur" ? 0 : 1);
const order = [...byCode.values()].sort((a, b) => rank(a.seviye) - rank(b.seviye) || cmp(a.kod, b.kod));
// Katalog taraması (her kayıtlı ileti, yalnız ilk örnek değil).
const tables = new RegExp(`\\b(${Object.keys(DEVIR_TABLE_CLASSES).join("|")})\\b`);
const violations = [];
for (const row of rows) {
  for (const problem of iletiDenetimi(row)) violations.push(`${row.kod} · ${problem.alan}: ${problem.neden} — ${problem.metin}`);
  for (const value of [row.baslik, row.neOldu, row.neden, row.nereye?.ekran, ...(row.neYapmali || [])]) if (tables.test(String(value || ""))) violations.push(`${row.kod}: tablo adı — ${value}`);
}
violations.sort(cmp);
const lines = [
  "# Devir iletileri kataloğu (DEVİR NEDEN DURDU — 2.5.1 D3)",
  "",
  "Kaynak: testlerin ön izleme yanıtından KAYDETTİĞİ gerçek iletiler (elle yazılmış değil) — `test/devir-d3-ileti-katalog.mjs` üretti. Her neden için ilk örnek; \"Kaynak\" verinin nasıl kurulduğunu söyler",
  "(API: programın kendi API'si; ham veri: API'nin üretemediği eski sürüm / göç durumu; olgu: program tutarlı veride üretmediği için olgu düzeyinde). İç kod (`kod`) makine alanıdır, kullanıcıya gösterilmez.",
  "",
  `Neden sayısı: ${order.length} (durdurur ${order.filter(row => row.seviye === "durdurur").length}, uyarı ${order.filter(row => row.seviye === "uyarir").length}); kayıtlı ileti ${rows.length}.`,
  `Katalog taraması (iç kod / İngilizce / alan adı / tablo adı / ISO tarih / nokta ondalık — kayıtlı ${rows.length} iletinin bütün kullanıcı alanları): ${violations.length ? `${violations.length} İHLAL` : "0 ihlal"}.`,
  "",
];
let level = "";
for (const row of order) {
  if (row.seviye !== level) {
    level = row.seviye;
    lines.push(`## ${level === "durdurur" ? "Devri Durduran Nedenler" : "Uyarılar"}`, "");
  }
  lines.push(`### ${row.baslik} (\`${row.kod}\`)`, "");
  lines.push(`- **Ne oldu:** ${row.neOldu}`);
  lines.push(`- **${level === "durdurur" ? "Neden duruyor" : "Neden önemli"}:** ${row.neden}${row.guvence ? ` ${row.guvence}` : ""}`);
  lines.push(`- **Ne yapmalı:**`);
  row.neYapmali.forEach((step, index) => lines.push(`  ${index + 1}. ${step}`));
  lines.push(`- **Nereye:** ${row.nereye?.ekran || ""}${row.nereye?.kayit ? ` (kayıt: ${row.nereye.kayit.tur})` : ""}`);
  lines.push(`- Senaryo: ${row.senaryo} — kaynak: ${row.kaynak}; test: \`${row.test}\`; bu kodla kaydedilen ileti: ${row.adet}`);
  lines.push("");
}
if (violations.length) lines.push("## Tarama İhlalleri", "", ...violations.map(item => `- ${item}`), "");
writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`${order.length} neden, ${rows.length} ileti, tarama ihlali ${violations.length} → ${out}`);
if (violations.length) {
  for (const item of violations) console.error(item);
  process.exitCode = 1;
}
