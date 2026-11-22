// 2.5.0 Ç6-HESAP tur 4 — ORTA-1 (dar kontrol docs/devir/2.5.0-DEVAM/dk-c6h-rapor.md; BAŞ MİMAR KARARI 21.11 09:49 (2); tasarım docs/erp/C6-HESAP-TASARIM.md §11.1): "Kural Değişikliği
// Farkı" ALT HESAP (Bilanço'da cari) düzeyinde. Kurgu dar kontrolün s3'ü: v2.4.9'un GERÇEK koduyla üretilmiş fikstür (test/fixtures/c6h-v249; kilit 30.06.2026) bugünkü kodla açılır — kilitli
// kopyada 2026'nın ilk yarısı 2.4.9 kuralıyla donar (602 / 600 / 610 / 770 alt hesapsız), güncel kural Ç7b'nin .90 alt hesaplarını yazar. BEKLENEN (ELLE, raporun sayıları; tutar = güncel −
// donmuş, borç artı): pos 2026 "602: 1.000,00" + "602 (602.90): −1.000,00"; stok 2026 "600: 400,00" + "600 (600.90): −400,00" + "610: −100,00" + "610 (610.90): 100,00"; kasa 2026
// "770: −300,00" + "770 (770.90): 300,00", 2025 "649: 1.000,00" + "649 (649.90): −1.000,00". Kilitli kopyada TABLO ve dipnot 3 / 6 donmuş tutarla kalır (Ç3); kilitsiz kopyada neden YOK.
// Eski kodda (5ee4d99e) kırmızı: neden yok (anahtar yalnız yıl × hesap — iki satır aynı hesapta birbirini götürür).
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
const OLD = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);

async function withFixture(sinif, kip, fn) {
  const root = mkdtempSync(path.join(tmpdir(), `c6h4-alt-${sinif}-`));
  const dataDir = path.join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, `${sinif}-${kip}.sqlite.gz`))));
  copyFileSync(path.join(DIR, `${sinif}-${kip}.sirketler.json`), path.join(dataDir, "sirketler.json"));
  const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: OLD.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  try {
    await server.app.ledger.snapshots.runPending();
    if (kip === "kilitli") assert.equal(server.app.ledger.snapshots.state().coverage, "2026-06-30", `ön koşul: ${sinif} kilitli kopyada 30.06.2026 dondu`);
    const client = await loginAdmin(server);
    const get = async url => {
      const res = await client.get(url);
      assert.equal(res.status, 200, `${sinif} · ${kip} · ${url}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return unwrap(res);
    };
    await fn({ get, server });
  } finally {
    await server.close();
    removeTestDir(root);
  }
}

const reasonOf = out => out.kesinDegil.find(row => row.kod === "kural-farki")?.ayrinti || null;
const subsOf = (gt, kod) => gt.items.find(item => item.kod === kod).hesaplar.flatMap(row => row.altlar.map(part => [row.hesap, part.hesap, part.tutarMinor]));
const footOf = (gt, kod) => gt.footnotes.find(row => row.kod === kod) || null;

describe("2.5.0 Ç6-HESAP tur 4 — ORTA-1: kural farkı alt hesap düzeyinde (v2.4.9 kilitli veri)", () => {
  it("pos: kilitli 2026 ilk yarı Gelir Tablosu ve Bilanço 'Kural Değişikliği Farkı' 602 ↔ 602.90; tablo donmuş (602), kilitsizde neden yok", { timeout: 300_000 }, async () => {
    const want = ["2026 · 602: 1.000,00 TL", "2026 · 602 (602.90): −1.000,00 TL"];
    await withFixture("pos", "kilitli", async ({ get }) => {
      const gt = await get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`);
      assert.deepEqual(reasonOf(gt), want, "Gelir Tablosu nedeni alt hesap satırlarıyla");
      assert.deepEqual(subsOf(gt, "A"), [["602", "602", 100000]], "tablo donmuş defterden: alt satır 602 (2.4.9 kuralı)");
      assert.equal(footOf(gt, "siniflandirilmamis"), null, "dipnot 6 donmuş tutarla (alt hesap yok)");
      const bs = await get(`${FS}/balance-sheet?date=2026-10-20`);
      assert.deepEqual(reasonOf(bs), want, "Bilanço (bugün) aynı fark");
      assert.equal(bs.toplamlar.farkMinor, 0, "Aktif = Pasif");
      const view = await get("/api/admin/ledger/rule-diff-correction");
      assert.deepEqual(view.lines.map(line => [line.account, line.sub, line.debit - line.credit]), [["602", "", 100000], ["602", "602.90", -100000]], "Yönetim ön izlemesi aynı farkı görüyor");
    });
    await withFixture("pos", "kilitsiz", async ({ get }) => {
      const gt = await get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`);
      assert.equal(reasonOf(gt), null, "kilitsiz: neden yok");
      assert.deepEqual(subsOf(gt, "A"), [["602", "602.90", 100000]], "kilitsiz: güncel kural 602.90");
      assert.equal(footOf(gt, "siniflandirilmamis")?.gelirMinor, 100000);
    });
  });

  it("stok: 600 → 600.90 (400,00) ve 610 → 610.90 (100,00) kilitli kopyada neden; kilitsizde yok", { timeout: 300_000 }, async () => {
    const want = ["2026 · 600: 400,00 TL", "2026 · 600 (600.90): −400,00 TL", "2026 · 610: −100,00 TL", "2026 · 610 (610.90): 100,00 TL"];
    await withFixture("stok", "kilitli", async ({ get }) => {
      const gt = await get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`);
      assert.deepEqual(reasonOf(gt), want);
      assert.deepEqual(subsOf(gt, "A"), [["600", "600", 40000]]);
      assert.deepEqual(subsOf(gt, "B"), [["610", "610", 10000]]);
      const bs = await get(`${FS}/balance-sheet?date=2026-10-20`);
      assert.deepEqual(reasonOf(bs), want);
      assert.equal(bs.toplamlar.farkMinor, 0);
    });
    await withFixture("stok", "kilitsiz", async ({ get }) => {
      const gt = await get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`);
      assert.equal(reasonOf(gt), null);
      assert.deepEqual(subsOf(gt, "A"), [["600", "600.90", 40000]]);
    });
  });

  it("kasa: dipnot 3 kilitli kopyada donmuş (0), neden 770 ↔ 770.90 −300 / 300; 2025'te 649 ↔ 649.90; Bilanço bütün kilitli yılları alt hesapla yazar", { timeout: 300_000 }, async () => {
    await withFixture("kasa", "kilitli", async ({ get }) => {
      const h1 = await get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`);
      assert.deepEqual(reasonOf(h1), ["2026 · 770: −300,00 TL", "2026 · 770 (770.90): 300,00 TL"]);
      assert.equal(footOf(h1, "kasa-banka-gider").tutarMinor, 0, "dipnot 3 donmuş defterin tutarı (770.90 yok)");
      const y25 = await get(`${FS}/income-statement?from=2025-01-01&to=2025-12-31`);
      assert.deepEqual(reasonOf(y25), ["2025 · 649: 1.000,00 TL", "2025 · 649 (649.90): −1.000,00 TL"]);
      const bs = await get(`${FS}/balance-sheet?date=2026-10-20`);
      assert.deepEqual(reasonOf(bs), ["2025 · 500: 5.000,00 TL", "2025 · 519: −5.000,00 TL", "2025 · 649: 1.000,00 TL", "2025 · 649 (649.90): −1.000,00 TL", "2026 · 770: −300,00 TL", "2026 · 770 (770.90): 300,00 TL"]);
      const bs25 = await get(`${FS}/balance-sheet?date=2025-12-31`);
      assert.deepEqual(reasonOf(bs25), ["2025 · 500: 5.000,00 TL", "2025 · 519: −5.000,00 TL", "2025 · 649: 1.000,00 TL", "2025 · 649 (649.90): −1.000,00 TL"], "31.12.2025: yalnız o güne kadarki fark");
      for (const out of [bs, bs25]) assert.equal(out.toplamlar.farkMinor, 0);
    });
    await withFixture("kasa", "kilitsiz", async ({ get }) => {
      const h1 = await get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`);
      assert.equal(reasonOf(h1), null);
      assert.equal(footOf(h1, "kasa-banka-gider").tutarMinor, 30000, "kilitsiz: dipnot 3 = 770.90 300,00");
      const bs = await get(`${FS}/balance-sheet?date=2026-10-20`);
      assert.equal(reasonOf(bs), null);
    });
  });
});
