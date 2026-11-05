// 2.4.9 R2 — esitlik-kos.mjs çıktılarının karşılaştırması (TAP): her bölümde (forAccount, kesintiler, mizan, detail, waFacts, httpKart, alıcı listesi / önizleme
// gövdeleri) kalem sayısı + bölüm sha256'sı eski ↔ yeni AYNI olmalı; farklıysa ilk farklı kalemler yazılır. Ayrıca eşitlik boş geçmesin: kesintili kart > 0.
// --dis <beklenen fark>: karşılaştırıcının dişi — yeni çıktı "dis" koşusuysa forAccount ve kesintilerde tam 1 fark beklenir, öbür bölümler aynı.
// Kullanım: node test/r2-249/esitlik-karsilastir.mjs <eski.json> <yeni.json> [--dis]
import { readFileSync } from "node:fs";

const [ESKI, YENI, DIS] = process.argv.slice(2);
if (!ESKI || !YENI) throw new Error("kullanım: esitlik-karsilastir.mjs <eski.json> <yeni.json> [--dis]");
const E = JSON.parse(readFileSync(ESKI, "utf8"));
const Y = JSON.parse(readFileSync(YENI, "utf8"));
const dis = DIS === "--dis";
let n = 0;
let fail = 0;
const tap = (ok, ad) => {
  n += 1;
  if (!ok) fail += 1;
  console.log(`${ok ? "ok" : "not ok"} ${n} - ${ad}`);
};
console.log(`# eski ${E.commit} ${E.tz} ${E.veri}\n# yeni ${Y.commit} ${Y.tz} ${Y.veri}${Y.dis ? " (DİŞ koşusu)" : ""}`);
console.log(`# kesinti eski ${JSON.stringify(E.kesinti)} yeni ${JSON.stringify(Y.kesinti)}`);
tap(E.veri === Y.veri && E.saat === Y.saat, `aynı veri ve saat (${E.saat})`);
tap(E.kesinti?.kesintili > 0 && E.kesinti?.kart > 0, `eşitlik boş değil: ${E.kesinti?.kart} kart, ${E.kesinti?.kesintili} kesintili, ${E.kesinti?.kartliCari} kartlı cari / ${E.kesinti?.cari}`);
const adlar = [...new Set([...Object.keys(E.bolumler), ...Object.keys(Y.bolumler)])];
for (const ad of adlar) {
  const e = E.bolumler[ad];
  const y = Y.bolumler[ad];
  if (!e || !y) {
    tap(false, `${ad}: bölüm bir yanda yok`);
    continue;
  }
  const ek = new Set(e.kalemler);
  const farkli = y.kalemler.filter(k => !ek.has(k));
  const ayni = e.sha === y.sha && e.n === y.n && (e.durum ?? 200) === (y.durum ?? 200);
  const beklenenFark = dis && Y.dis && (ad === "forAccount" || ad === "kesintiler") ? 1 : 0;
  const tutan = beklenenFark ? !ayni && farkli.length === 1 && e.n === y.n : ayni;
  tap(tutan, `${ad}: kalem ${e.n} ↔ ${y.n}${e.durum ? `, durum ${e.durum} ↔ ${y.durum}` : ""}, farklı kalem ${farkli.length}${beklenenFark ? " (diş: beklenen 1)" : ""}${farkli.length ? ` — ilk: ${farkli.slice(0, 3).join(", ")}` : ""}`);
}
console.log(`1..${n}\n# tests ${n}\n# pass ${n - fail}\n# fail ${fail}`);
process.exitCode = fail ? 1 : 0;
