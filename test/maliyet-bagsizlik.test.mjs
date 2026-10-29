// 2.4.6 madde 5 — Maliyet Hesap Kartı BAĞSIZLIK (kullanıcı kararı 24.10.2026: "sipariş, stok kaydı, satış fiyatı ya da başka hiçbir yere BAĞLANMAZ").
// Kaynak tarayan denetim:
//   1. Maliyet modülü (server/lib/maliyet/*, server/routes/maliyet.mjs) SQL'de YALNIZ maliyet_* tablolarını (ve sqlite_master'ı) anar; para / stok / cari /
//      kasa / fatura / defter tablolarına yazmaz, onlardan okumaz. Kendi dışında yalnız izinli yardımcıları içe alır (http, sektör listesi, saat).
//   2. Programın geri kalanı maliyet_* tablolarını anmaz; istisna: göç (şema), "Şirket Verisini Sıfırla" kart tablosu listesi (app.mjs CARD_TABLES).
// Dişi (ders 7, 38): kasıtlı bağ enjekte edilmiş kopyada kırmızı — MALIYET_BAGSIZLIK_KOK=<kopya> ile aynı test kopyayı tarar (kanıt docs/kanit/2026-10-25/
// 246-maliyet-cekirdek/). Ders 27: satırlar /\r?\n/ ile bölünür (Windows CRLF).
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = process.env.MALIYET_BAGSIZLIK_KOK ? path.resolve(process.env.MALIYET_BAGSIZLIK_KOK) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(path.join(ROOT, file), "utf8");
const MODULE_DIR = "server/lib/maliyet";
const ROUTE = "server/routes/maliyet.mjs";
const MALIYET_TABLE = /\bmaliyet_(?:sekmeler|kartlar|satirlar|adimlar|hucreler|basliklar)\b/;

function listMjs(dir) {
  const out = [];
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...listMjs(rel));
    else if (name.endsWith(".mjs")) out.push(rel);
  }
  return out;
}

// Yorumları çıkarır (satır ve blok yorum); dizgelerdeki "//" (adres) korunur. Satırlar CRLF'de de doğru bölünür.
function code(text) {
  const withoutBlocks = text.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split(/\r?\n/)
    .map(line => (/^\s*\/\//.test(line) ? "" : line.replace(/(^|[^:"'`\\])\/\/.*$/, "$1")))
    .join("\n");
}

// SQL'de anılan tablo adları (FROM / INTO / UPDATE / JOIN / TABLE / DELETE FROM …).
function sqlTables(src) {
  const names = new Set();
  for (const m of src.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN|TABLE(?:\s+IF\s+(?:NOT\s+)?EXISTS)?)\s+["`]?([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(m[1]);
  return [...names];
}

const moduleFiles = () => {
  const files = [...listMjs(MODULE_DIR), ROUTE];
  assert.ok(files.length >= 5, `maliyet modülü bulunamadı (${files.join(", ")}); okunamayan kaynak boş sayılmaz`);
  return files;
};

describe("2.4.6 Maliyet Hesap Kartı bağsızlığı (kaynak taraması)", () => {
  it("maliyet modülü SQL'de yalnız maliyet_* tablolarını anar (para / stok / cari / kasa / fatura / defter yok)", () => {
    const found = [];
    const seen = new Set();
    for (const file of moduleFiles()) {
      for (const table of sqlTables(code(read(file)))) {
        seen.add(table);
        if (!MALIYET_TABLE.test(table) && table !== "sqlite_master") found.push(`${file}: ${table}`);
      }
    }
    // Desen gerçekten SQL okuyor mu: modülün kendi altı tablosunun hepsi görülmeli (okunamayan veri boş sayılmaz, ders 4).
    const own = [...seen].filter(table => MALIYET_TABLE.test(table)).sort();
    assert.equal(own.length, 6, `maliyet modülünün SQL'i okunamadı (görülen: ${[...seen].join(", ")})`);
    assert.deepEqual(found, [], `maliyet modülü başka tabloya dokunuyor:\n${found.join("\n")}`);
  });

  it("maliyet modülü yalnız izinli yardımcıları içe alır (cari, kasa, stok, fatura, banka, defter, taksit, çek modülü yok)", () => {
    // 2.4.7: sekme PDF'i programın PDF yazıcısıyla (../pdf-write.mjs) ve rapor başlığıyla (Tabela Adı / firma adı; ../lib/report-header.mjs) — para modülü değil.
    const allowed = new Set(["../http.mjs", "./sablon.mjs", "./hesap.mjs", "./girdi.mjs", "../lib/http.mjs", "../lib/insight/sectors.mjs", "../lib/maliyet/depo.mjs", "../lib/clock.mjs", "../pdf-write.mjs", "../lib/maliyet/pdf.mjs", "../lib/report-header.mjs"]);
    const found = [];
    for (const file of moduleFiles()) {
      const src = code(read(file));
      for (const m of src.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g)) {
        if (!m[1].startsWith("node:") && !allowed.has(m[1])) found.push(`${file}: ${m[1]}`);
      }
      // Para yazımı ya da başka servislerin bağlamı (bank.post, context.money, accounts(), stock() …) kullanılmaz.
      for (const m of src.matchAll(/\b(bank\.post|money\.|accounts\(\)|stock\(\)|invoices\(\)|ledger\(\)|plans\(\)|cheques\(\)|cash\(\)|integrity)\b/g)) found.push(`${file}: ${m[1]}`);
    }
    assert.deepEqual(found, [], `maliyet modülü başka modüle bağlanıyor:\n${found.join("\n")}`);
  });

  it("programın geri kalanı maliyet_* tablolarını anmaz (yalnız göç ve Şirket Verisini Sıfırla listesi)", () => {
    const mine = new Set(moduleFiles());
    const files = listMjs("server").filter(file => !mine.has(file));
    assert.ok(files.length > 50, "sunucu kaynağı okunamadı");
    const found = [];
    for (const file of files) {
      let src = code(read(file));
      if (file === "server/lib/migrations.mjs") continue;
      if (file === "server/app.mjs") {
        // İzin: CARD_TABLES dizisinin içi (Tümünü Sıfırla kart verisini siler). Dizinin dışında anılırsa ihlal.
        const list = /const CARD_TABLES = \[[\s\S]*?\];/.exec(src);
        assert.ok(list && MALIYET_TABLE.test(list[0]), "app.mjs CARD_TABLES maliyet tablolarını içermeli (Tümünü Sıfırla)");
        src = src.replace(list[0], "");
      }
      src.split("\n").forEach((line, index) => {
        if (MALIYET_TABLE.test(line)) found.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    assert.deepEqual(found, [], `başka modül maliyet tablosuna dokunuyor:\n${found.join("\n")}`);
  });

  it("mutabakat kapısı ve para tabloları listesi maliyet tablolarını içermez (para tablosu değil)", () => {
    const db = code(read("server/lib/db.mjs"));
    const financial = /const FINANCIAL = new Set\(\[([\s\S]*?)\]\)/.exec(db);
    assert.ok(financial, "db.mjs FINANCIAL okunamadı");
    assert.doesNotMatch(financial[1], /maliyet_/);
  });
});
