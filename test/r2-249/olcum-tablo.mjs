// 2.4.9 R2: önce/sonra ölçüm tablosu (süre / olay döngüsü en çok / başka kullanıcı en çok, ms; tekrarlar ";" ile) + bütçe denetimi (TAP). Yalnız YENİ kod bütçeyle
// denetlenir. Bütçe (görev metni; B2 §6, §13 c): 2.000 kişi ≤ 2.000 ms, Tümüne (4.000+ kişi) ≤ 3.000 ms — süre VE olay döngüsü en çok. Cari kartı (200 tek istek) bilgi için.
// Girdi: <klasör> içinde olcum-<eski|yeni>-iade.json (test/b2-249/olcum.mjs iade kümesi), olcum-ek-<eski|yeni>.json (test/r2-249/olcum-ek.mjs), *.uptime (yük).
// Kullanım: node test/r2-249/olcum-tablo.mjs <klasör>
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const [DIR] = process.argv.slice(2);
const oku = ad => (existsSync(path.join(DIR, ad)) ? JSON.parse(readFileSync(path.join(DIR, ad), "utf8")) : null);
const yuk = ad => (existsSync(path.join(DIR, ad)) ? readFileSync(path.join(DIR, ad), "utf8").split("\n").filter(l => /load average/.test(l)).map(l => l.replace(/^.*load average: /, "")).join(" → ") : "okunamadı");
let n = 0;
let fail = 0;
const butce = (ad, kalem) => (/cariKarti/.test(ad) ? null : kalem >= 4000 ? 3000 : 2000);
for (const [ek, kume] of [["olcum", "iade"], ["olcum-ek", ""]]) {
  const dosya = k => `${ek}-${k}${kume ? `-${kume}` : ""}`;
  const E = oku(`${dosya("eski")}.json`);
  const Y = oku(`${dosya("yeni")}.json`);
  if (!Y) {
    n += 1;
    fail += 1;
    console.log(`not ok ${n} - ${dosya("yeni")}.json okunamadı`);
    continue;
  }
  console.log(`# --- ${ek} (cari ${JSON.stringify(Y.cariSayisi)}; yeni ${Y.commit}${E ? `, eski ${E.commit}` : ""})`);
  console.log(`#     yük (load average 1/5/15 dk, önce → sonra): eski ${yuk(`${dosya("eski")}.uptime`)} | yeni ${yuk(`${dosya("yeni")}.uptime`)}`);
  for (const [ad, liste] of Object.entries(Y.olcum)) {
    const kalem = liste[0].alici ?? liste[0].kalem;
    const hucre = l => (l ? l.map(x => `${x.ms}/${x.olayDongusuEnCokMs}/${x.baskaEnCokMs}${x.istekP50Ms !== undefined ? ` (istek p50 ${x.istekP50Ms}, en çok ${x.istekEnCokMs})` : ""}`).join(" ; ") : "ölçülmedi");
    const sinir = butce(ad, kalem);
    const asim = liste.filter(x => x.durum !== 200 || (sinir !== null && (x.ms > sinir || x.olayDongusuEnCokMs > sinir)));
    n += 1;
    if (asim.length) fail += 1;
    console.log(`${asim.length ? "not ok" : "ok"} ${n} - ${ad} kalem ${kalem}: ESKİ ${hucre(E?.olcum?.[ad])} | YENİ ${hucre(liste)} | ${sinir === null ? "bütçe yok (bilgi)" : `bütçe ≤ ${sinir} ms`}${asim.length ? ` AŞIM ${asim.length}/${liste.length}` : ""}`);
  }
}
console.log(`1..${n}\n# tests ${n}\n# pass ${n - fail}\n# fail ${fail}`);
process.exitCode = fail ? 1 : 0;
