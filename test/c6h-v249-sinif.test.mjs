// 2.5.0 Ç6-HESAP tur 3 — KALICI ESKİ SÜRÜM SINIF TESTİ (ders 17, 53 (b); docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §9 madde 1, 7, 10). Fikstür test/fixtures/c6h-v249: v2.4.9'un GERÇEK koduyla
// programın KENDİ API'sinden üretilmiş veri (sınıf başına ayrı veri dosyası; kilitsiz + v2.4.9'un kendi dönem kilidiyle kilitli) + v2.4.9'un o veriden KENDİ API'siyle okunan sayıları
// (v249.json; üretim ve yeniden üretim: uret.mjs.txt başı). CI'de etiket / eski kod gerekmez — test yalnız fikstürü kullanır. Fikstürün kopyası BUGÜNKÜ kodla (göç dahil; kilitlide 2.4.9
// kurallı bekleyen dondurma) açılır; 2.5.0'ın Bilanço'su (hesap başına defter bakiyesi, Kasa 100, Banka 102, brütleştirilmiş cari kalemleri), Gelir Tablosu (yıl başından t'ye hesap başına 6 / 7
// hareketi, satışların maliyeti tahmini, Dönem Net Kârı) ve dönem sonu stok değerlemesi v2.4.9'un Hesap Planı Mizanı, Kasa ekranı, stok değeri ve Cari Listesi ile karşılaştırılır.
// Her FARK beklenen-farklar.json'da sınıf + kip + tarih + alan + eski → yeni + KARAR NUMARASIYLA yazılı olmalı: yazılı olmayan fark, değeri değişen fark ve kapanmış ama listede duran fark
// KIRMIZI. Karar numarası verilemeyen fark bulgudur ("AÇIKLANAMADI" yazılmaz). Ayrıca her sınıfta Aktif = Pasif (fark 0). Sahte DURAĞAN saat = üretim günü (ders 13); iki saat dilimi aynı sonuç.
// C6H3_FARK_YAZ=<dosya> verilirse gerçek fark listesi o dosyaya yazılır (beklenen-farklar.json'u güncellemek için; değerler elle karar numarasıyla açıklanır).
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "fixtures", "c6h-v249");
const FS = "/api/workspace/financial-statements";
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const keyOf = row => `${row.sinif} · ${row.kip} · ${row.tarih} · ${row.alan}`;
const rowsOf = side => side.gruplar.flatMap(grup => grup.kalemler).flatMap(kalem => kalem.hesaplar.map(hesap => ({ kalem: kalem.kod, ...hesap })));

/** Bugünkü kodun sayıları (v249.json'un biçiminde). */
async function readNow(get, { dates, today }) {
  const out = { tarihler: {}, cari: {} };
  for (const date of dates) {
    const year = date.slice(0, 4);
    const bs = await get(`${FS}/balance-sheet?date=${date}`);
    const gt = await get(`${FS}/income-statement?from=${year}-01-01&to=${date}`);
    const val = await get(`${FS}/stock-valuation?date=${date}`);
    const mizan = {};
    for (const row of bs.accounts) if (row.defterMinor !== 0) mizan[row.hesap] = row.defterMinor;
    const donem = {};
    for (const item of gt.items) {
      for (const row of item.hesaplar) {
        if (row.tahmini) continue; // satışların maliyeti tahmini (621, kayıt değil) — "smm" alanında
        for (const part of row.altlar) {
          const account = part.hesap.slice(0, 3);
          donem[account] = (donem[account] || 0) + (item.gelir ? -part.tutarMinor : part.tutarMinor);
        }
      }
    }
    for (const [account, minor] of Object.entries(donem)) if (minor === 0) delete donem[account];
    out.tarihler[date] = {
      mizan, donem, kasa: mizan["100"] || 0, banka: mizan["102"] || 0, stok: val.totals.dssMinor,
      kar: gt.subtotals.donemNetKari, smm: gt.smm.estimated ? gt.smm.minor : 0, aktifPasifFarki: bs.toplamlar.farkMinor,
    };
  }
  // Cari Listesi'nin karşılığı (bugün): Bilanço'nun brütleştirilmiş cari kalemleri.
  const bs = await get(`${FS}/balance-sheet?date=${today}`);
  const rows = [...rowsOf(bs.aktif), ...rowsOf(bs.pasif)];
  const own = (kalem, hesap) => rows.find(row => row.kalem === kalem && row.hesap === hesap);
  const source = (kalem, hesap, from) => own(kalem, hesap)?.kaynaklar?.find(item => item.hesap === from);
  out.cari = {
    "musteri.borclu": own("I.C", "120")?.tutarMinor || 0,
    "musteri.borcluSayisi": own("I.C", "120")?.cariSayisi || 0,
    "musteri.alacakli": source("III.D", "340", "120")?.tutarMinor || 0,
    "musteri.alacakliSayisi": source("III.D", "340", "120")?.adet || 0,
    "tedarikci.alacakli": own("III.B", "320")?.tutarMinor || 0,
    "tedarikci.alacakliSayisi": own("III.B", "320")?.cariSayisi || 0,
    "tedarikci.borclu": source("I.E", "159", "320")?.tutarMinor || 0,
    "tedarikci.borcluSayisi": source("I.E", "159", "320")?.adet || 0,
  };
  return out;
}

/** v2.4.9'un sayıları aynı biçimde (kar = 6 / 7 hareketinin alacak − borcu; v2.4.9'da satışların maliyeti tahmini yoktur). */
function oldShape(facts) {
  const out = { tarihler: {}, cari: {} };
  for (const [date, row] of Object.entries(facts.tarihler)) {
    // Bilanço yalnız 1–5 sınıfının hesap bakiyesini taşır; 6 / 7 dönem hareketiyle (donem) karşılaştırılır.
    const mizan = Object.fromEntries(Object.entries(row.mizan).filter(([account]) => /^[1-5]/.test(account)));
    out.tarihler[date] = { mizan, donem: row.donem, kasa: row.kasa, banka: row.banka, stok: row.stok, kar: -Object.values(row.donem).reduce((sum, minor) => sum + minor, 0), smm: 0, aktifPasifFarki: 0 };
  }
  const sum = (type, sign) => facts.cariler.filter(row => row.tur === type && Math.sign(row.bakiye) === sign);
  const customersDebt = sum("customer", 1);
  const customersCredit = sum("customer", -1);
  const suppliersCredit = sum("supplier", -1);
  const suppliersDebt = sum("supplier", 1);
  out.cari = {
    "musteri.borclu": customersDebt.reduce((s, row) => s + row.bakiye, 0),
    "musteri.borcluSayisi": customersDebt.length,
    "musteri.alacakli": -customersCredit.reduce((s, row) => s + row.bakiye, 0),
    "musteri.alacakliSayisi": customersCredit.length,
    "tedarikci.alacakli": -suppliersCredit.reduce((s, row) => s + row.bakiye, 0),
    "tedarikci.alacakliSayisi": suppliersCredit.length,
    "tedarikci.borclu": suppliersDebt.reduce((s, row) => s + row.bakiye, 0),
    "tedarikci.borcluSayisi": suppliersDebt.length,
  };
  return out;
}

function diffOf(sinif, kip, old, now) {
  const out = [];
  const add = (tarih, alan, a, b) => {
    if ((a || 0) !== (b || 0)) out.push({ sinif, kip, tarih, alan, eski: String(a || 0), yeni: String(b || 0) });
  };
  for (const [date, a] of Object.entries(old.tarihler)) {
    const b = now.tarihler[date];
    for (const group of ["mizan", "donem"]) {
      for (const account of [...new Set([...Object.keys(a[group]), ...Object.keys(b[group])])].sort()) add(date, `${group}.${account}`, a[group][account], b[group][account]);
    }
    for (const field of ["kasa", "banka", "stok", "kar", "smm", "aktifPasifFarki"]) add(date, field, a[field], b[field]);
  }
  for (const field of Object.keys(old.cari)) add("bugün", `cari.${field}`, old.cari[field], now.cari[field]);
  return out;
}

describe("2.5.0 Ç6-HESAP — v2.4.9 GERÇEK verisinde sınıf sınıf (kilitsiz / kilitli) Gelir Tablosu, Bilanço, değerleme ↔ v2.4.9'un kendi sayıları (her fark karar numarasıyla)", () => {
  it("fikstür bugünkü kodla: bütün farklar beklenen-farklar.json'da, değerleri aynı; listede kapanmış fark yok; her sınıfta Aktif = Pasif", { timeout: 600_000 }, async () => {
    const old = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
    const expected = JSON.parse(readFileSync(path.join(DIR, "beklenen-farklar.json"), "utf8"));
    assert.equal(old.kod, "v2.4.9 (ccf0b0ca)", "ön koşul: fikstür v2.4.9'un gerçek koduyla üretildi");
    const classes = Object.keys(old.siniflar);
    assert.ok(classes.length >= 13, `ön koşul: sınıf sayısı ${classes.length}`);
    const actual = [];
    for (const sinif of classes) {
      for (const kip of ["kilitsiz", "kilitli"]) {
        const root = mkdtempSync(path.join(tmpdir(), `c6h-v249-${sinif}-`));
        const dataDir = path.join(root, "data");
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, `${sinif}-${kip}.sqlite.gz`))));
        copyFileSync(path.join(DIR, `${sinif}-${kip}.sirketler.json`), path.join(dataDir, "sirketler.json"));
        const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: old.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
        try {
          if (kip === "kilitli") {
            await server.app.ledger.snapshots.runPending();
            assert.equal(server.app.ledger.snapshots.state().coverage, old.lock, `${sinif}: v2.4.9'un kilidi 2.5.0'da dondu`);
          }
          const client = await loginAdmin(server);
          const now = await readNow(async url => {
            const res = await client.get(url);
            assert.equal(res.status, 200, `${sinif} · ${kip} · ${url}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
            return unwrap(res);
          }, { dates: old.dates, today: old.today });
          for (const [date, row] of Object.entries(now.tarihler)) assert.equal(row.aktifPasifFarki, 0, `${sinif} · ${kip} · ${date}: Aktif = Pasif`);
          actual.push(...diffOf(sinif, kip, oldShape(old.siniflar[sinif][kip]), now));
        } finally {
          await server.close();
          removeTestDir(root);
        }
      }
    }
    if (process.env.C6H3_FARK_YAZ) writeFileSync(process.env.C6H3_FARK_YAZ, `${JSON.stringify(actual, null, 1)}\n`);
    const listed = new Map(expected.farklar.map(row => [keyOf(row), row]));
    const unknown = [];
    const changed = [];
    for (const row of actual) {
      const want = listed.get(keyOf(row));
      if (!want) unknown.push(row);
      else if (want.eski !== row.eski || want.yeni !== row.yeni) changed.push({ ...row, listede: `${want.eski} → ${want.yeni}` });
      else assert.ok(want.karar && !/AÇIKLANAMADI/i.test(want.karar), `${keyOf(row)}: karar numarası yok`);
    }
    const seen = new Set(actual.map(keyOf));
    const closed = expected.farklar.filter(row => !seen.has(keyOf(row)));
    const lines = rows => rows.map(row => `  ${keyOf(row)}: ${row.eski} → ${row.yeni}${row.listede ? ` (listede ${row.listede})` : ""}`).join("\n");
    const byDecision = new Map();
    for (const row of expected.farklar) byDecision.set(row.karar, (byDecision.get(row.karar) || 0) + 1);
    console.log(`sınıf testi: ${classes.length} sınıf × 2 kip; ${actual.length} fark; yazılı olmayan ${unknown.length}, değeri değişen ${changed.length}, kapanmış ama listede duran ${closed.length}`);
    console.log(`  karar başına: ${[...byDecision].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    assert.equal(unknown.length, 0, `beklenen-farklar.json'da YAZILI OLMAYAN fark (karar numarasıyla açıklanmadı):\n${lines(unknown)}`);
    assert.equal(changed.length, 0, `DEĞERİ DEĞİŞEN fark:\n${lines(changed)}`);
    assert.equal(closed.length, 0, `KAPANMIŞ ama listede duran fark (listeden çıkarın):\n${lines(closed)}`);
  });
});
