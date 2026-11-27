#!/usr/bin/env node
// 2.5.1 D3 tur 3 — İLETİ KATALOĞU üreticisi (test değildir; CI dışı). Testlerin GERÇEKTEN ürettiği iletiler (test/fixtures/devir-d3-ileti-katalog.mjs kaydedicisi, D3T3_KATALOG_DIR)
// okunur; her neden (iç kod) için ilk örnek dört alanıyla, hangi senaryodan ve hangi veri kaynağından çıktığıyla yazılır. Elle metin YOK — cümleler yanıt gövdesinden.
// Kullanım: D3T3_KATALOG_DIR=<klasör> node --test test/devir-d3-ileti.test.mjs test/devir-d3-kural.test.mjs test/devir-d3-wa.test.mjs
//           node test/devir-d3-ileti-katalog.mjs <klasör> <çıktı .md>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error("kullanım: node test/devir-d3-ileti-katalog.mjs <kayıt klasörü> <çıktı .md>");
const rows = [];
for (const file of readdirSync(dir).filter(name => name.endsWith(".jsonl")).sort()) {
  for (const line of readFileSync(path.join(dir, file), "utf8").split(/\r?\n/)) if (line.trim()) rows.push(JSON.parse(line));
}
const byCode = new Map();
for (const row of rows) if (!byCode.has(row.kod)) byCode.set(row.kod, { ...row, adet: 0 });
for (const row of rows) byCode.get(row.kod).adet += 1;
const order = [...byCode.values()].sort((a, b) => (a.seviye === b.seviye ? 0 : a.seviye === "durdurur" ? -1 : 1));
const lines = [
  "# Devir iletileri kataloğu (DEVİR NEDEN DURDU — 2.5.1 D3 tur 3)",
  "",
  "Kaynak: testlerin ön izleme yanıtından KAYDETTİĞİ gerçek iletiler (elle yazılmış değil) — `test/devir-d3-ileti-katalog.mjs` üretti. Her neden için ilk örnek; \"Kaynak\" verinin nasıl kurulduğunu söyler",
  "(API: programın kendi API'si; ham veri: API'nin üretemediği eski sürüm / göç durumu; olgu: program tutarlı veride üretmediği için olgu düzeyinde). İç kod (`kod`) makine alanıdır, kullanıcıya gösterilmez.",
  "",
  `Neden sayısı: ${order.length} (durdurur ${order.filter(row => row.seviye === "durdurur").length}, uyarı ${order.filter(row => row.seviye === "uyarir").length}); kayıtlı ileti ${rows.length}.`,
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
writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`${order.length} neden → ${out}`);
