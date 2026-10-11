// ÖNCE ↔ SONRA tek istek tablosu (hız düzeltmesi, 11.10.2026). tek-istek.mjs'in iki JSON çıktısını Markdown tabloya çevirir; her rapor ve
// listede TAM çıktının özeti (sha256, ilk 16) iki kodda aynı mı (gerçek 100.000 satırlık veride eşdeğerlik) sütunu da yazılır.
// Kullanım: node docs/kanit/2026-10-11/hiz-duzeltme/karsilastir.mjs <once.json> <sonra.json>
import { readFileSync } from "node:fs";

const [onceFile, sonraFile] = process.argv.slice(2);
const once = JSON.parse(readFileSync(onceFile, "utf8"));
const sonra = JSON.parse(readFileSync(sonraFile, "utf8"));
const byName = list => new Map(list.map(item => [`${item.tur}|${item.ad}`, item]));
const a = byName([...once.olcumler, ...once.yazimlar.map(item => ({ ...item, tur: "yazim" }))]);
const b = byName([...sonra.olcumler, ...sonra.yazimlar.map(item => ({ ...item, tur: "yazim" }))]);
const ms = value => (value == null ? "—" : String(value));
const lines = [];
lines.push(`ÖNCE: ${once.kod} · SONRA: ${sonra.kod} · tekrar ${once.tekrar} (+1 ısınma) · sahte saat ${once.simdi}`);
lines.push("");
lines.push("| Tür | Uç | ÖNCE HTTP p50 (en çok) | SONRA HTTP p50 (en çok) | ÖNCE döngü en çok | SONRA döngü en çok | Satır | Çıktı aynı |");
lines.push("|---|---|---|---|---|---|---|---|");
let same = 0;
let differ = 0;
let unknown = 0;
for (const [key, item] of a) {
  const next = b.get(key);
  const verdict = item.tur === "yazim" ? "(yazım)" : !next ? "SONRA YOK" : item.ozet && next.ozet ? (item.ozet === next.ozet ? "aynı" : "FARKLI") : "bilinmiyor";
  if (verdict === "aynı") same += 1;
  else if (verdict === "FARKLI" || verdict === "SONRA YOK") differ += 1;
  else if (verdict === "bilinmiyor") unknown += 1;
  lines.push(`| ${item.tur} | ${item.ad} | ${ms(item.http?.p50)} (${ms(item.http?.max)}) | ${ms(next?.http?.p50)} (${ms(next?.http?.max)}) | ${ms(item.dongu?.max)} | ${ms(next?.dongu?.max)} | ${ms(item.satir)}${next && next.satir !== item.satir ? ` → ${next.satir}` : ""} | ${verdict} |`);
}
lines.push("");
lines.push(`Çıktı özeti: ${same} aynı, ${differ} farklı/eksik, ${unknown} bilinmiyor (yazımlar karşılaştırılmaz; ikisi de aynı veride ayrı kopyada yazar).`);
console.log(lines.join("\n"));
process.exitCode = differ ? 1 : 0;
