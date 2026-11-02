// İŞ Z (2.4.8) — eşitlik koşularının (esitlik-kos.mjs) ESKİ ↔ YENİ çıktılarını adım adım DERİN eşitlikle karşılaştırır. Her adım bir denetim satırı (TAP biçimi;
// tools/kanit.mjs kos sayar). Fark varsa ilk farklı yolu ve iki değeri yazar. Kullanım: node test/isz-248/esitlik-karsilastir.mjs <eski.json> <yeni.json> [<eski2> <yeni2> …]
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const ilkFark = (a, b, yol = "") => {
  if (isDeepStrictEqual(a, b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    if (Array.isArray(a) && a.length !== b.length) return `${yol}.length ${a.length} ≠ ${b.length}`;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const f = ilkFark(a[k], b[k], `${yol}.${k}`);
      if (f) return f;
    }
  }
  return `${yol}: ${JSON.stringify(a)?.slice(0, 200)} ≠ ${JSON.stringify(b)?.slice(0, 200)}`;
};
const ciftler = process.argv.slice(2);
if (!ciftler.length || ciftler.length % 2) throw new Error("kullanım: esitlik-karsilastir.mjs <eski.json> <yeni.json> [...]");
let n = 0;
let basarisiz = 0;
const satir = (ok, ad, ayrinti = "") => {
  n += 1;
  if (!ok) basarisiz += 1;
  console.log(`${ok ? "ok" : "not ok"} ${n} - ${ad}${ayrinti ? ` # ${ayrinti}` : ""}`);
};
let kisiToplam = 0;
for (let i = 0; i < ciftler.length; i += 2) {
  const eski = JSON.parse(readFileSync(ciftler[i], "utf8"));
  const yeni = JSON.parse(readFileSync(ciftler[i + 1], "utf8"));
  const etiket = `${eski.kip}@${eski.saat}`;
  satir(eski.commit !== yeni.commit, `${etiket}: iki koşu ayrı kodda (eski ${eski.commit.slice(0, 8)} · yeni ${yeni.commit.slice(0, 8)})`);
  satir(eski.adimlar.length === yeni.adimlar.length && eski.adimlar.length > 0, `${etiket}: adım sayısı aynı (${eski.adimlar.length} / ${yeni.adimlar.length})`);
  satir(isDeepStrictEqual(eski.yurutulen, yeni.yurutulen), `${etiket}: işçinin yürüttüğü iş sayısı aynı (${eski.yurutulen} / ${yeni.yurutulen})`);
  for (let j = 0; j < Math.max(eski.adimlar.length, yeni.adimlar.length); j += 1) {
    const a = eski.adimlar[j];
    const b = yeni.adimlar[j];
    const ad = a?.adim || b?.adim;
    const fark = ilkFark(a, b);
    const kisi = a?.govde?.data?.people?.length ?? a?.govde?.data?.jobs?.length;
    if (Number.isFinite(kisi)) kisiToplam += kisi;
    satir(!fark, `${etiket}: ${ad} (HTTP ${a?.durum}${Number.isFinite(kisi) ? `, ${kisi} kişi` : ""})`, fark || "");
  }
}
console.log(`# karşılaştırılan kişi satırı: ${kisiToplam}`);
console.log(`# tests ${n}`);
console.log(`# pass ${n - basarisiz}`);
console.log(`# fail ${basarisiz}`);
process.exitCode = basarisiz ? 1 : 0;
