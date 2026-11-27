// 2.5.0 Ç5-B tur 2b-1 — KALICI ESKİ SÜRÜM FARK TESTİ (ders 17, 53; S114 = A (ii); her Ç5-B turunun kabul koşulu). Fikstür test/fixtures/tyk-fark-v249: v2.4.9'un GERÇEK koduyla
// programın KENDİ API'sinden üretilmiş veri + v2.4.9'un o veriden KENDİ API'siyle okunan sayıları (v249.json; üretim ve yeniden üretim: uret.mjs.txt başı). CI'de etiket / eski kod
// gerekmez — test yalnız fikstürü kullanır. Fikstürün kopyası BUGÜNKÜ kodla (göç dahil) açılır; cari başına bakiye, Cari Listesi gecikmiş kolonu, kart durumu + Taksitler sekmesi,
// taksitler (tutar:kalan:durum), Vade Takip ve zil kalemleri v2.4.9 ile karşılaştırılır (test/tyk-fark-oku.mjs). Her FARK beklenen-farklar.json'da cari + alan + eski → yeni +
// KARAR NUMARASIYLA yazılı olmalı: yazılı olmayan fark, değeri değişen fark ve kapanmış ama listede duran fark KIRMIZI (yapım aşaması listesinin mantığı). Karar numarası
// verilemeyen fark bulgudur — listeye "AÇIKLANAMADI" diye yazılmaz. Sahte DURAĞAN saat = üretim günü (ders 13); iki saat dilimi (TZ=UTC, TZ=Europe/Istanbul) aynı sonuç.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { diffFacts, readFacts } from "./tyk-fark-oku.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "fixtures", "tyk-fark-v249");
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const keyOf = row => `${row.cari} · ${row.alan}`;

describe("2.5.0 Ç5-B — v2.4.9 GERÇEK verisinde sınıf sınıf fark testi (her fark karar numarasıyla)", () => {
  it("fikstür bugünkü kodla: bütün farklar beklenen-farklar.json'da, değerleri aynı; listede kapanmış fark yok", { timeout: 180_000 }, async () => {
    const old = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
    const expected = JSON.parse(readFileSync(path.join(DIR, "beklenen-farklar.json"), "utf8"));
    assert.equal(old.kod, "v2.4.9 (ccf0b0ca)", "ön koşul: fikstür v2.4.9'un gerçek koduyla üretildi");
    assert.ok(Object.keys(old.cariler).length >= 25, `ön koşul: sınıf sayısı ${Object.keys(old.cariler).length}`);
    const root = mkdtempSync(path.join(tmpdir(), "tyk-fark-v249-"));
    const dataDir = path.join(root, "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, "destekofis.sqlite.gz"))));
    copyFileSync(path.join(DIR, "sirketler.json"), path.join(dataDir, "sirketler.json"));
    const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: old.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    let now;
    try {
      const client = await loginAdmin(server);
      now = await readFacts(async url => {
        const res = await client.get(url);
        assert.equal(res.status, 200, `${url}: ${res.status}`);
        return unwrap(res);
      }, { today: old.today, prefix: "TYKF " });
    } finally {
      await server.close();
      removeTestDir(root);
    }
    assert.deepEqual(Object.keys(now.cariler).sort(), Object.keys(old.cariler).sort(), "aynı cariler (göçte cari kaybolmadı)");
    const actual = diffFacts(old, now);
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
    console.log(`fark testi: ${actual.length} fark (${Object.keys(now.cariler).length} cari); yazılı olmayan ${unknown.length}, değeri değişen ${changed.length}, kapanmış ama listede duran ${closed.length}`);
    const byDecision = new Map();
    for (const row of expected.farklar) byDecision.set(row.karar, (byDecision.get(row.karar) || 0) + 1);
    console.log(`  karar başına: ${[...byDecision].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    assert.equal(unknown.length, 0, `beklenen-farklar.json'da YAZILI OLMAYAN fark (karar numarasıyla açıklanmadı):\n${lines(unknown)}`);
    assert.equal(changed.length, 0, `DEĞERİ DEĞİŞEN fark:\n${lines(changed)}`);
    assert.equal(closed.length, 0, `KAPANMIŞ ama listede duran fark (listeden çıkarın):\n${lines(closed)}`);
  });
});
