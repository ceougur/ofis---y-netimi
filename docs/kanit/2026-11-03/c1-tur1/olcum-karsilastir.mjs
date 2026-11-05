// C1 TUR 1 ölçüm karşılaştırması: olcum-sonuc-<etiket>-<tur>.json dosyalarından tablo + iki denetim.
//   EŞDEĞERLİK (ders 47): eaf6b988 (düzeltmesiz) ↔ fe5bcf27 (tur 1) her carinin kart çıktısı (SHA-256), fatura listeleri ve hareket sayacının tam çıktısı birebir aynı.
//   BÜTÇE (görev): kart açılışı (p50) C1 öncesi koda (35e90e47) göre ≤ +5 ms — her tur ayrı.
// Kullanım: node olcum-karsilastir.mjs <klasör>. Çıkış 0 = iki denetim de geçti.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] || ".");
const load = (etiket, tur) => JSON.parse(readFileSync(path.join(dir, `olcum-sonuc-${etiket}-${tur}.json`), "utf8"));
const TURLAR = [1, 2];
const SURUMLER = ["35e90e47", "eaf6b988", "fe5bcf27"];
const EVRELER = [["bankaKarti", "Banka carisi kartı (600 masraf + 600 fatura)"], ["faturaListesiAlis", "Fatura listesi (Alış)"], ["faturaListesiHepsi", "Fatura listesi (hepsi)"], ["iptalIadeliKart", "POS İptal İadeli cari kartı"], ["posMusteriKarti", "POS müşterisi kartı (100 POS tahsilatı)"]];
const data = Object.fromEntries(TURLAR.map(tur => [tur, Object.fromEntries(SURUMLER.map(s => [s, load(s, tur)]))]));
let ok = 0;
let bad = 0;
const check = (cond, text) => {
  if (cond) ok += 1;
  else bad += 1;
  console.log(`${cond ? "✓" : "✗"} ${text}`);
};
console.log("| Evre | Tur | 35e90e47 (C1 öncesi) p50 / en çok / döngü | eaf6b988 (C1) p50 / en çok / döngü | fe5bcf27 (tur 1) p50 / en çok / döngü |");
console.log("|---|---|---|---|---|");
for (const [key, label] of EVRELER) {
  for (const tur of TURLAR) {
    const cell = s => {
      const e = data[tur][s].evreler[key];
      return `${e.sure.p50} / ${e.sure.enCok} / ${e.donguEnCok} ms`;
    };
    console.log(`| ${label} | ${tur} | ${cell("35e90e47")} | ${cell("eaf6b988")} | ${cell("fe5bcf27")} |`);
  }
}
for (const tur of TURLAR) {
  const yeni = data[tur].fe5bcf27;
  const eski = data[tur].eaf6b988;
  console.log(`tur ${tur} yük (1/5/15 dk): 35e ${data[tur]["35e90e47"].yuk} · eaf ${eski.yuk} · fe5 ${yeni.yuk}; sayaç bütün cariler eaf ${eski.sayacTumCarilerMs} ms / fe5 ${yeni.sayacTumCarilerMs} ms; kalıcı silme sayımı eaf ${eski.sayacKaliciSilmeTumCarilerMs} / fe5 ${yeni.sayacKaliciSilmeTumCarilerMs} ms`);
  const cariler = Object.keys(eski.esdegerlik.kart);
  check(cariler.length === Object.keys(yeni.esdegerlik.kart).length && cariler.length > 0, `tur ${tur}: aynı cari kümesi (${cariler.length})`);
  const kartFark = cariler.filter(id => eski.esdegerlik.kart[id] !== yeni.esdegerlik.kart[id]);
  check(kartFark.length === 0, `tur ${tur}: her carinin kart çıktısı eaf6b988 ↔ fe5bcf27 birebir (fark: ${kartFark.length})`);
  let sayacAyni = true;
  try {
    assert.deepEqual(yeni.esdegerlik.sayac, eski.esdegerlik.sayac);
  } catch {
    sayacAyni = false;
  }
  check(sayacAyni, `tur ${tur}: hareket sayacının çıktısı (her cari, bütün sayaçlar) eaf6b988 ↔ fe5bcf27 birebir`);
  const iptal = Object.values(yeni.esdegerlik.sayac).filter(row => row.counts.vouchers > 0).length;
  check(iptal === 3, `tur ${tur}: POS İptal İadesi fişli 3 cari banka fişi sayılıyor (gelen ${iptal})`);
  check(eski.esdegerlik.faturaListesiAlis === yeni.esdegerlik.faturaListesiAlis && eski.esdegerlik.faturaListesiHepsi === yeni.esdegerlik.faturaListesiHepsi, `tur ${tur}: fatura listeleri birebir`);
  for (const key of ["bankaKarti", "iptalIadeliKart", "posMusteriKarti"]) {
    const once = data[tur]["35e90e47"].evreler[key].sure.p50;
    const simdi = yeni.evreler[key].sure.p50;
    check(simdi <= once + 5, `tur ${tur}: ${key} p50 ${simdi} ms ≤ C1 öncesi ${once} ms + 5 ms (fark ${Math.round((simdi - once) * 100) / 100} ms)`);
  }
}
console.log(`# tests ${ok + bad}\n# pass ${ok}\n# fail ${bad}`);
process.exit(bad ? 1 : 0);
