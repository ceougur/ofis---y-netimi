// 2.5.0 Ç6-HESAP tur 4 — S236 = A (dar kontrol ORTA-3, docs/devir/2.5.0-DEVAM/dk-c6h-rapor.md; tasarım docs/erp/C6-HESAP-TASARIM.md §11.3, C3-DONDURMA-TASARIM §21): kilitli dönemin stok
// değerlemesi kilit ANINDA dondurulur (ürün kartının tür / kart alış fiyatı / silinme alanları koşu başına; göç 54). Kurgu dar kontrolün s5'i (kilit 31.12.2025, bugün 10.03.2026): K ürününde
// 2025'te yalnız miktar girişi 10 Adet (alış yok → KG-10 A kart alış fiyatı 50), H ürünü 4 × 25 açık hesap alışı.
// BEKLENEN (ELLE, kitap §5 / KG-10 A / S207 = A; tutar kuruş):
//   kilitli 2025: DSS = K 10 × 50 + H 100 = 600,00; satışların maliyeti = 0 + 100 (153 akışı) − 600 = −500,00 → Gelir Tablosu D −50000, dönem net kârı 50000; Bilanço 31.12.2025 153 = 60000;
//     bugünkü Bilanço "Geçmiş Yıllar 2025" 50000 — kilitten sonra K 50 → 80, H Ürün → Hizmet, K silinir / geri alınır: HİÇBİRİ değiştirmez (eski kod: −800 / −700 …).
//   açık yıl 2026 (01.01–10.03; dönem başı = donmuş dönem sonu 600): K'nın birim maliyeti dönem başından (500 / 10 = 50 — kart fiyatı devreye girmez); H Hizmet'e çevrilince açık yılda
//     değerlemeye girmez → DSS_t 500, satışların maliyeti 600 − 500 = 100 (D 10000, Bilanço 153 50000); K silinince (10.03) DSS_t 0 → D 60000; geri alınınca 50000.
//   kilit kaldırılınca 2025 güncel kartla: K 10 × 80 = 800, H Hizmet → DSS 800, satışların maliyeti 100 − 800 = −700 (D −70000, 153 80000); yeniden kilitlenince yeni dondurma o anın
//     kartıyla (80, Hizmet) → sonra K 80 → 60 kilitli 2025'i değiştirmez (−70000 kalır).
//   kapsam sınırı: değerleme 31.12.2025 donmuş kartla (H dahil 60000), 01.01.2026 güncel kartla (H hariç 50000).
// v2.4.9'dan göçle gelen kilitli veri (fikstür stok-kilitli): göç 54 göç anının kartını yazar; sonra bütün ürünler Hizmet'e çevrilince kilitli dönem (2025, 30.06.2026) değişmez — kilitsiz
// kopyada aynı değişiklik değerlemeyi düşürür (testin dişi aynı veride). Tetikleyiciler (UPDATE / DELETE / kapalı koşuya INSERT reddedilir), Şirket Verisini Sıfırla'nın clearSnapshots'ı, göçün
// yeniden koşusu. Aktif = Pasif her adımda. Eski kodda (5ee4d99e) kırmızı: kart değişikliği kilitli yılı değiştirir.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { boot, must } from "./banka-210-ortak.mjs";
import { lockAndWait } from "./fixtures/donma-bekle.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { clearSnapshots } from "../server/lib/ledger-snapshots.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "fixtures", "c6h-v249");
const FS = "/api/workspace/financial-statements";
const item153 = bs => bs.aktif.gruplar.flatMap(group => group.kalemler).flatMap(kalem => kalem.hesaplar).find(row => row.hesap === "153")?.tutarMinor ?? 0;

async function readAll(api) {
  const gt25 = await must("gt25", api.get(`${FS}/income-statement?from=2025-01-01&to=2025-12-31`));
  const gt26 = await must("gt26", api.get(`${FS}/income-statement?from=2026-01-01&to=2026-03-10`));
  const bs25 = await must("bs25", api.get(`${FS}/balance-sheet?date=2025-12-31`));
  const bs0101 = await must("bs0101", api.get(`${FS}/balance-sheet?date=2026-01-01`));
  const bsNow = await must("bsNow", api.get(`${FS}/balance-sheet?date=2026-03-10`));
  const v1231 = await must("v1231", api.get(`${FS}/stock-valuation?date=2025-12-31`));
  const v0101 = await must("v0101", api.get(`${FS}/stock-valuation?date=2026-01-01`));
  for (const [label, bs] of [["bs25", bs25], ["bs0101", bs0101], ["bsNow", bsNow]]) assert.equal(bs.toplamlar.farkMinor, 0, `${label}: Aktif = Pasif`);
  return {
    locked: { d: gt25.items.find(item => item.kod === "D").tutarMinor, kar: gt25.subtotals.donemNetKari, s153: item153(bs25), gecmis: bsNow.hesaplanmis.gecmisYillar.map(row => [row.yil, row.tutarMinor]), dss: v1231.totals.dssMinor },
    open: { d: gt26.items.find(item => item.kod === "D").tutarMinor, s153: item153(bsNow), dss0101: v0101.totals.dssMinor, kar: bsNow.hesaplanmis.donemNetKari?.tutarMinor ?? null },
  };
}

const LOCKED_A = { d: -50000, kar: 50000, s153: 60000, gecmis: [[2025, 50000]], dss: 60000 };

describe("2.5.0 Ç6-HESAP tur 4 — S236 = A: kilitli dönemin değerlemesi kilit anında dondurulur", () => {
  it("kart fiyatı / tür / silme / geri alma kilitli 2025'i değiştirmez; açık yıl güncel kartla (dönem başı donmuş); kilit kaldır → güncel kart; yeniden kilit → yeni dondurma", { timeout: 300_000 }, async () => {
    const ctx = await boot({ now: { time: "2026-03-10T12:00:00+03:00", fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const { api, store } = ctx;
    try {
      const sup = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarikçi T", type: "supplier" }))).id;
      const K = await must("K", api.post("/api/workspace/stock", { name: "Ürün K", unit: "Adet", unitPrice: "50" }));
      const H = await must("H", api.post("/api/workspace/stock", { name: "Ürün H", unit: "Adet", unitPrice: "25" }));
      await must("K miktar girişi", api.post(`/api/workspace/stock/${K.id}/moves`, { kind: "in", qty: "10", unitPrice: "0", pay: "none", date: "2025-03-01" }));
      await must("H alış", api.post(`/api/workspace/stock/${H.id}/moves`, { kind: "in", qty: "4", unitPrice: "25", pay: "account", accountId: sup, date: "2025-04-01" }));
      const card = async (id, body) => {
        const current = await must("kart", api.get(`/api/workspace/stock/${id}`));
        return must("kart düzelt", api.put(`/api/workspace/stock/${id}`, { ...body, updatedAt: current.item?.updatedAt ?? current.updatedAt }));
      };
      await lockAndWait(api.client, "2025-12-31");
      const base = await readAll(api);
      assert.deepEqual(base.locked, LOCKED_A, "kilitten sonra (ELLE)");
      assert.deepEqual([base.open.d, base.open.s153, base.open.dss0101], [0, 60000, 60000], "açık yıl: dönem başı 600 = dönem sonu 600");

      await card(K.id, { unitPrice: "80" });
      const price = await readAll(api);
      assert.deepEqual(price.locked, LOCKED_A, "K 50 → 80: kilitli 2025 aynı");
      assert.deepEqual([price.open.d, price.open.s153], [0, 60000], "açık yıl: K'nın birim maliyeti dönem başından (kart fiyatı girmez)");

      await card(H.id, { kind: "service" });
      const kind = await readAll(api);
      assert.deepEqual(kind.locked, LOCKED_A, "H Ürün → Hizmet: kilitli 2025 aynı");
      assert.deepEqual([kind.open.d, kind.open.s153, kind.open.dss0101, kind.open.kar], [10000, 50000, 50000, -10000], "açık yıl güncel kartla: H değerlemeye girmez, dönem başı değeri maliyete");
      const v1231 = await must("değerleme 31.12", api.get(`${FS}/stock-valuation?date=2025-12-31`));
      assert.deepEqual(v1231.products.map(row => [row.name, row.valueMinor]), [["Ürün K", 50000], ["Ürün H", 10000]], "kapsam günü: donmuş kart (H dahil)");

      assert.equal((await api.del(`/api/workspace/stock/${K.id}`)).status, 200, "K silindi");
      const gone = await readAll(api);
      assert.deepEqual(gone.locked, LOCKED_A, "K silindi: kilitli 2025 aynı");
      assert.deepEqual([gone.open.d, gone.open.s153], [60000, 0], "açık yıl: silindiği günden değer 0 (S207 = A)");
      assert.equal((await api.post("/api/admin/trash/restore", { id: `stock:${K.id}` })).status, 200, "K geri alındı");
      const back = await readAll(api);
      assert.deepEqual(back.locked, LOCKED_A, "geri alındı: kilitli 2025 aynı");
      assert.deepEqual([back.open.d, back.open.s153], [10000, 50000]);

      await lockAndWait(api.client, "");
      const unlocked = await readAll(api);
      assert.deepEqual([unlocked.locked.d, unlocked.locked.kar, unlocked.locked.s153, unlocked.locked.dss], [-70000, 70000, 80000, 80000], "kilit kaldırıldı: 2025 güncel kartla (K 80, H Hizmet)");

      await lockAndWait(api.client, "2025-12-31");
      const relocked = await readAll(api);
      assert.deepEqual(relocked.locked, unlocked.locked, "yeniden kilit: o anın kartıyla dondu");
      await card(K.id, { unitPrice: "60" });
      const after = await readAll(api);
      assert.deepEqual(after.locked, unlocked.locked, "yeni dondurmadan sonra K 80 → 60: kilitli 2025 aynı (−700)");
      // Tablo düzeyi (göç 54; eski kodda tablo yok — buraya kadar API sınamaları beklenen nedenle kırmızı olur).
      const runs = store.all("SELECT r.no, r.kind, r.state, COUNT(s.item_id) AS n FROM ledger_snapshot_runs r LEFT JOIN ledger_valuation_cards s ON s.run = r.no GROUP BY r.no ORDER BY r.no").map(row => [row.kind, row.state, row.n]);
      assert.deepEqual(runs, [["freeze", "done", 2], ["thaw", "done", 0], ["freeze", "done", 2]], "her freeze koşusu kendi kartıyla");
      const frozen = store.all("SELECT run, kind, unit_price AS price FROM ledger_valuation_cards WHERE item_id = ? ORDER BY run", K.id).map(row => [row.run, row.kind, row.price]);
      assert.deepEqual(frozen, [[1, "product", 50], [3, "product", 80]], "K'nın donmuş kartları: kilit anındaki fiyatlar");

      // Değişmezlik (göç 54 tetikleyicileri) ve Şirket Verisini Sıfırla.
      assert.throws(() => store.run("UPDATE ledger_valuation_cards SET unit_price = 1 WHERE run = 3"), /değiştirilemez/);
      assert.throws(() => store.run("DELETE FROM ledger_valuation_cards WHERE run = 3"), /silinemez/);
      assert.throws(() => store.run("INSERT INTO ledger_valuation_cards (run, item_id, kind, unit_price) VALUES (3, 'yeni', 'product', 1)"), /eklenemez/);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_valuation_cards").n, 4);
      const rerun = MIGRATIONS.find(migration => migration.version === 54);
      rerun.up(store);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_valuation_cards").n, 4, "göç yeniden koşunca yazmaz");
      const counts = store.tx(() => clearSnapshots(store));
      assert.equal(counts.ledger_valuation_cards, 4);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_valuation_cards").n, 0, "sıfırlama tabloyu boşaltır");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'ledger_valuation_cards_%'").n, 3, "tetikleyiciler yeniden kuruldu");
    } finally {
      await ctx.server.close();
    }
  });

  it("v2.4.9'dan göçle gelen kilitli veri: göç 54 kartları yazar; ürünler Hizmet'e çevrilince kilitli dönem değişmez (kilitsiz kopyada değişir)", { timeout: 300_000 }, async () => {
    const old = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
    const results = {};
    for (const kip of ["kilitli", "kilitsiz"]) {
      const root = mkdtempSync(path.join(tmpdir(), `c6h4-dondurma-${kip}-`));
      const dataDir = path.join(root, "data");
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, `stok-${kip}.sqlite.gz`))));
      copyFileSync(path.join(DIR, `stok-${kip}.sirketler.json`), path.join(dataDir, "sirketler.json"));
      const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: old.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
      try {
        await server.app.ledger.snapshots.runPending();
        const { store } = server.app;
        const client = await loginAdmin(server);
        const get = async url => {
          const res = await client.get(url);
          assert.equal(res.status, 200, `${kip} ${url}: ${res.status}`);
          return res.data.data;
        };
        if (kip === "kilitli") {
          // Tablo düzeyi aşağıda (sayı sınamalarından SONRA — eski kodda tablo yok, kırmızının nedeni sayı farkı olsun).
          const table = store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'ledger_valuation_cards'");
          results.items = store.get("SELECT COUNT(*) AS n FROM stock_items").n;
          results.cards = table ? store.all("SELECT run, COUNT(*) AS n FROM ledger_valuation_cards GROUP BY run").map(row => [row.run, row.n]) : null;
        }
        const read = async () => ({
          gt25: (await get(`${FS}/income-statement?from=2025-01-01&to=2025-12-31`)).items.find(item => item.kod === "D").tutarMinor,
          gt26a: (await get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`)).items.find(item => item.kod === "D").tutarMinor,
          s153: item153(await get(`${FS}/balance-sheet?date=2026-06-30`)),
          dss: (await get(`${FS}/stock-valuation?date=2026-06-30`)).totals.dssMinor,
        });
        const before = await read();
        for (const row of store.all("SELECT id FROM stock_items WHERE deleted_at IS NULL AND kind <> 'service'")) {
          const current = (await client.get(`/api/workspace/stock/${row.id}`)).data.data;
          const res = await client.put(`/api/workspace/stock/${row.id}`, { kind: "service", updatedAt: current.item?.updatedAt ?? current.updatedAt });
          assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 200));
        }
        results[kip] = { before, after: await read() };
      } finally {
        await server.close();
        removeTestDir(root);
      }
    }
    assert.ok(results.kilitli.before.dss > 0, "ön koşul: kilitli dönemde stok değeri var");
    assert.deepEqual(results.kilitli.after, results.kilitli.before, "kilitli: tür değişikliği 2025 ve 30.06.2026'yı değiştirmez");
    assert.notDeepEqual(results.kilitsiz.after, results.kilitsiz.before, "kilitsiz: aynı değişiklik değerlemeyi değiştirir (dişi)");
    assert.equal(results.kilitsiz.after.dss, 0, "kilitsiz: bütün ürünler Hizmet → stok 0");
    assert.ok(results.items > 0);
    assert.deepEqual(results.cards, [[1, results.items]], "göç 54: göç 47'nin koşusuna göç anının kartları");
  });
});
