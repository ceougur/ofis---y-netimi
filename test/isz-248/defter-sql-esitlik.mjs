// İŞ Z (2.4.8) — Z3 SQL EŞİTLİĞİ (ana oturum şartı): makine defterinin R3 sorgusu ESKİ metin (b2e7bf19 kopyasındaki defter.mjs'ten, kaynak metninden) ↔ YENİ metin
// (SENT_BEFORE_SQL_YALNIZ_TEST, `+k.period_key`) AYNI defter dosyasında, GERÇEK parametre kümeleriyle SATIR SATIR eşit mi? Parametreler defterin kendisinden:
// talep ve claim_keys'te geçen BÜTÜN dönem anahtarları (tek tek, ikişerli, hepsi birden; böylece eşleşen satırlar gerçekten üretilir), bütün şirket / tür çiftleri,
// pencereler (yok, eski, yeni) ve "Yine de Gönder" sınırı (yok / var). Her iki biçim (gruplanmış R3 ve İş Q1'in satır satır biçimi) koşulur; satırlar sıralanıp
// karşılaştırılır. Salt okunur. Kullanım: node test/isz-248/defter-sql-esitlik.mjs <defter dosyası> <eski defter.mjs> [json]
import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { SENT_BEFORE_SQL_YALNIZ_TEST } from "../../server/lib/whatsapp/defter.mjs";

const [DEFTER, ESKI, CIKTI] = process.argv.slice(2);
if (!DEFTER || !ESKI) throw new Error("kullanım: defter-sql-esitlik.mjs <defter> <eski defter.mjs> [json]");
const m = /const SENT_BEFORE_SQL = \(outer, tail\) => `([\s\S]*?)`;/.exec(readFileSync(ESKI, "utf8"));
if (!m) throw new Error("eski SENT_BEFORE_SQL bulunamadı");
const eskiSql = (outer, tail) => m[1].replace("${outer}", outer).replace("${tail}", tail);
if (eskiSql("X", "Y").includes("+k.period_key")) throw new Error("eski metin zaten + içeriyor (yanlış dosya)");
if (!SENT_BEFORE_SQL_YALNIZ_TEST("X", "Y").includes("+k.period_key")) throw new Error("yeni metinde + yok");
const db = new DatabaseSync(DEFTER, { readOnly: true });
const BICIM = [
  ["grup", "SELECT accountId, MAX(at) AS last", "GROUP BY accountId"],
  ["satır", "SELECT accountId, at, period_key AS ownKey, extra_keys AS extraKeys", ""],
];
const anahtarlar = [...new Set([...db.prepare("SELECT DISTINCT period_key AS k FROM claims").all(), ...db.prepare("SELECT DISTINCT period_key AS k FROM claim_keys").all()].map(r => r.k))].sort();
const ciftler = db.prepare("SELECT DISTINCT company_id AS c, kind AS k FROM claims ORDER BY 1, 2").all();
const anlar = db.prepare("SELECT MIN(at) AS a, MAX(at) AS b FROM claims").get();
const orta = anlar.a && anlar.b ? new Date((Date.parse(anlar.a) + Date.parse(anlar.b)) / 2).toISOString() : "";
// Süre sınırı (her sorgu 72.000 talepte ~0,5 sn): anahtarlardan eşit aralıklı 30 tekli + 10 ikili örnek, BÜTÜN anahtarlar birden (kişiye özel çok anahtarlı durum) ve
// olmayan anahtar; her tür (ay / seçim / aralık / gün) örneğe girer (sıralı listeden eşit aralık).
const ornek = (list, n) => (list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]));
const kumeler = [...ornek(anahtarlar, 30).map(k => [k]), ...ornek(anahtarlar.slice(0, -1).map((k, i) => [k, anahtarlar[i + 1]]), 10), anahtarlar, ["olmayan|anahtar"]];
const pencereler = [["", "", ""], ["", orta, ""], [orta, orta, orta]];
const sirala = rows => rows.map(r => JSON.stringify(r)).sort();
let n = 0;
let fark = 0;
let satir = 0;
let eskiMs = 0;
let yeniMs = 0;
const ilkFarklar = [];
for (const [ad, outer, tail] of BICIM) {
  const eski = db.prepare(eskiSql(outer, tail));
  const yeni = db.prepare(SENT_BEFORE_SQL_YALNIZ_TEST(outer, tail));
  for (const { c, k } of ciftler) {
    for (const kume of kumeler) {
      const json = JSON.stringify(kume);
      for (const [since, after, rolling] of pencereler) {
        const args = [c, k, json, json, since, after, rolling];
        let t = performance.now();
        const a = sirala(eski.all(...args));
        eskiMs += performance.now() - t;
        t = performance.now();
        const b = sirala(yeni.all(...args));
        yeniMs += performance.now() - t;
        n += 1;
        satir += a.length;
        if (!isDeepStrictEqual(a, b)) {
          fark += 1;
          if (ilkFarklar.length < 5) ilkFarklar.push({ ad, c, k, kume, since, after, rolling, eski: a.length, yeni: b.length });
        }
      }
    }
  }
}
const sonuc = { defter: DEFTER, anahtar: anahtarlar.length, sirketTur: ciftler.length, karsilastirma: n, eslesenSatirToplam: satir, fark, ilkFarklar, eskiMs: Math.round(eskiMs), yeniMs: Math.round(yeniMs) };
console.log(JSON.stringify(sonuc));
if (CIKTI) writeFileSync(CIKTI, `${JSON.stringify(sonuc, null, 1)}\n`);
console.log(`${fark === 0 && n > 0 && satir > 0 ? "ok" : "not ok"} 1 - R3 sorgusu eski ↔ yeni: ${n} parametre kümesi, ${satir} satır, fark ${fark}`);
console.log(`# tests 1\n# pass ${fark === 0 && n > 0 && satir > 0 ? 1 : 0}\n# fail ${fark === 0 && n > 0 && satir > 0 ? 0 : 1}`);
process.exitCode = fark === 0 && n > 0 && satir > 0 ? 0 : 1;
