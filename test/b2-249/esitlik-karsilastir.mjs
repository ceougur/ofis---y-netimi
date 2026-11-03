// 2.4.9 B2 (tasarım notu §5 E1): esitlik-kos.mjs'in eski ↔ yeni çıktılarını gövde gövde karşılaştırır (TAP; kanit.mjs özet satırlarını tanır). Her gövdede durum kodu,
// üst alanlar (kind, office, range, today), ret gövdesi, yanıtın tamamının sha256'sı; fark varsa İLK FARKLI KİŞİ (sıra ya da içerik). Sınıf sayıları satıra yazılır
// (R4: 0 olan sınıf eksik kanıttır — ayrıca "sınıf" satırlarında denetlenir: seçili Bu Ay gövdesinde pasif, istemiyor, son gönderim, sıradaki taksit, gecikmiş,
// son tahsilat, devir > 0). Kullanım: node test/b2-249/esitlik-karsilastir.mjs <eski.json> <yeni.json> [<eski2.json> <yeni2.json> …]
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const args = process.argv.slice(2);
if (!args.length || args.length % 2) throw new Error("kullanım: esitlik-karsilastir.mjs <eski.json> <yeni.json> [...]");
let n = 0;
let fail = 0;
const tap = (okMu, ad) => {
  n += 1;
  if (!okMu) fail += 1;
  console.log(`${okMu ? "ok" : "not ok"} ${n} - ${ad}`);
};
for (let i = 0; i < args.length; i += 2) {
  const [E, Y] = [args[i], args[i + 1]].map(f => JSON.parse(readFileSync(f, "utf8")));
  const on = `[${E.tz} ${E.saat} ${E.kapsam}]`;
  tap(E.saat === Y.saat && E.tz === Y.tz && E.veri === Y.veri && E.adimlar.length === Y.adimlar.length, `${on} aynı koşul (saat, saat dilimi, veri, ${E.adimlar.length} ↔ ${Y.adimlar.length} adım; eski ${E.commit} ↔ yeni ${Y.commit})`);
  for (const [j, e] of E.adimlar.entries()) {
    const y = Y.adimlar[j] || {};
    let fark = "";
    if (e.ad !== y.ad) fark = `adım adı ${e.ad} ≠ ${y.ad}`;
    else if (e.durum !== y.durum) fark = `durum ${e.durum} ≠ ${y.durum}`;
    else if (!isDeepStrictEqual(e.ust, y.ust)) fark = `üst alanlar ${JSON.stringify(e.ust)} ≠ ${JSON.stringify(y.ust)}`;
    else if (!isDeepStrictEqual(e.govde, y.govde)) fark = `ret gövdesi ${JSON.stringify(e.govde)} ≠ ${JSON.stringify(y.govde)}`;
    else if (e.sha !== y.sha) {
      const ek = e.kisiler || [];
      const yk = y.kisiler || [];
      const k = ek.findIndex((x, idx) => x !== yk[idx]);
      fark = ek.length !== yk.length ? `alıcı sayısı ${ek.length} ≠ ${yk.length}` : k >= 0 ? `ilk farklı kişi #${k} ${ek[k]} ≠ ${yk[k]}` : "yanıt sha farklı (kişiler aynı)";
    }
    const s = e.siniflar;
    const ozet = s ? ` (alıcı ${s.alici}, geçerli ${s.gecerli}, pasif ${s.pasif}, istemiyor ${s.istemiyor}, sıradaki taksit ${s.siradakiTaksit}, gecikmiş ${s.gecikmis}, son tahsilat ${s.sonTahsilat}, son gönderim ${s.sonGonderim}, ekstreli ${s.ekstreli}, devirli ${s.devirli}; eski ${e.ms} ms ↔ yeni ${y.ms} ms)` : ` (durum ${e.durum}: ${JSON.stringify(e.govde?.error || e.govde).slice(0, 100)})`;
    tap(!fark, `${on} ${e.ad}${ozet}${fark ? ` İLK FARK ${fark}` : ""}`);
  }
  const ilk = E.adimlar.find(a => a.ad === "Ekstre Bu Ay (seçili)")?.siniflar;
  if (ilk) {
    const eksik = ["pasif", "istemiyor", "siradakiTaksit", "gecikmis", "sonTahsilat", "sonGonderim", "devirli"].filter(k => !(ilk[k] > 0));
    tap(!eksik.length, `${on} sınıflar dişli (seçili Bu Ay): ${eksik.length ? `0 olan sınıf: ${eksik.join(", ")}` : "hepsi > 0"}; nedenler ${JSON.stringify(ilk.nedenler)}`);
  }
}
console.log(`1..${n}\n# tests ${n}\n# pass ${n - fail}\n# fail ${fail}`);
process.exitCode = fail ? 1 : 0;
