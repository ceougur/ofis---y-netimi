// 2.4.9 B2: olcum.mjs çıktılarından önce/sonra tablosu (süre / olay döngüsü en çok / başka kullanıcı en çok, ms; tekrarlar "/" ile) + bütçe (§6, §13 c) denetimi (TAP).
// Bütçe: 2.000 kişi ≤ 2.000 ms, Tümüne (≤ 4.100 kişi) ≤ 3.000 ms, 5.000 ≤ 5.000 ms, geçmişli 2.000 ≤ 2.500 ms; süre VE olay döngüsü en çok. Yalnız YENİ kod bütçeyle denetlenir.
// Kullanım: node test/b2-249/olcum-tablo.mjs <klasör> (içinde olcum-<eski|yeni>-<set>.json)
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const [DIR] = process.argv.slice(2);
const oku = ad => (existsSync(path.join(DIR, ad)) ? JSON.parse(readFileSync(path.join(DIR, ad), "utf8")) : null);
const butce = (set, ad, alici) => (set === "bes-bin" ? 5000 : set === "gecmis" ? 2500 : /2000$/.test(ad) ? 2000 : alici > 4100 ? 5000 : 3000);
let n = 0;
let fail = 0;
for (const set of ["taban", "bes-bin", "gecmis", "iade"]) {
  const E = oku(`olcum-eski-${set}.json`);
  const Y = oku(`olcum-yeni-${set}.json`);
  if (!Y) continue;
  console.log(`# --- ${set} (cari ${JSON.stringify(Y.cariSayisi)}; yeni ${Y.commit}${E ? `, eski ${E.commit}` : ""})`);
  for (const [ad, liste] of Object.entries(Y.olcum)) {
    const hucre = l => (l ? l.map(x => `${x.ms}/${x.olayDongusuEnCokMs}/${x.baskaEnCokMs}`).join(" ; ") : "ölçülmedi");
    const sinir = butce(set, ad, liste[0].alici);
    const asim = liste.filter(x => x.durum !== 200 || x.ms > sinir || x.olayDongusuEnCokMs > sinir);
    n += 1;
    if (asim.length) fail += 1;
    console.log(`${asim.length ? "not ok" : "ok"} ${n} - ${set} ${ad} alıcı ${liste[0].alici}: ESKİ ${hucre(E?.olcum?.[ad])} | YENİ ${hucre(liste)} | bütçe ≤ ${sinir} ms${asim.length ? ` AŞIM ${asim.length}/${liste.length}` : ""}`);
  }
}
console.log(`1..${n}\n# tests ${n}\n# pass ${n - fail}\n# fail ${fail}`);
process.exitCode = fail ? 1 : 0;
