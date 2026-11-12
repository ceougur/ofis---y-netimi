// 2.5.0 Ç5-A tur 1d — İş F HIZ DEĞİŞİKLİĞİNİN EŞDEĞERLİK testi (ders 47; docs/erp/C5-ACILIS-TASARIM.md §14.7). Bu bir EŞDEĞERLİK testidir: eski kodda (tur 1c ucu) da YEŞİL beklenir
// (davranış değişmedi); dişi mutantlarla gösterilir (kanıt docs/kanit/2026-11-12/c5a1d-isF-*).
// Değişiklik: S127 bağlılık kararı (lib/ledger-opening.mjs oldRulePinnedPlans) süzgeçli türetmede (kapının yolu: rows(filter)) yalnız OKUNAN kartlar için verilir; kart / taksit satırı
// okunmadıysa hiç sorulmaz. Önceden her süzgeçli türetme bütün yüklenen kartları + açılış satırlarını tarıyordu (100 bin satırda süzgeçli build başına ~2,5 ms; evrak yazımı ~+3 ms).
// İddialar: (1) karar kart başına — oldRulePinnedPlans(store, { ids }) = süzgeçsiz karar ∩ ids (her kart tek tek, hepsi birden, boş liste, olmayan kimlik, kapsayan kart);
// (2) süzgeçli türetme (evrak, kart, cari, taksit satırı) süzgeçsiz türetmeyle madde madde aynı — S127'ye bağlı kartın evrakı / taksit satırı dahil.
// Veri: programın kendi ürettiği eski sürüm fikstürleri (S127 kilitli + kilitsiz, 2.0.26 kilitli). Sahte saat (fikstürün günü; ders 13); iki TZ'de koşulur.
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { oldRulePinnedPlans } from "../server/lib/ledger-opening.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const servers = [];
after(async () => {
  for (const item of servers) {
    await item.server.close().catch(() => {});
    item.fixture.cleanup();
  }
});
async function open(name) {
  const fixture = unpackFixture(name);
  const manifest = readFixture(name);
  const today = manifest.oncesi?.today || String(manifest.now || "").slice(0, 10);
  const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, integrityScan: false });
  servers.push({ server, fixture });
  await server.app.ledger.snapshots.runPending();
  assert.equal(server.app.ledger.snapshots.state().pending, null, `${name}: açılıştaki dondurma bitmeli`);
  return server;
}
function assertSubset(label, filtered, byId, { expectIds = [] } = {}) {
  for (const entry of filtered) assert.deepEqual(entry, byId.get(entry.id), `${label}: ${entry.id} süzgeçli ↔ süzgeçsiz`);
  const ids = new Set(filtered.map(entry => entry.id));
  for (const id of expectIds) assert.ok(ids.has(id), `${label}: ${id} süzgeçli türetmede olmalı`);
}
const same = (a, b) => [...a].sort().join(",") === [...b].sort().join(",");

describe("İş F — S127 bağlılık kararı yalnız okunan kartlar için; sonuç süzgeçsizle aynı", () => {
  for (const name of ["surum-2.4.9-s127", "surum-2.4.9-s127-kilitsiz", "surum-2.0.26-zincir"]) {
    it(`${name}: karar kart başına (ids ∩); süzgeçli türetme (evrak, kart, cari, taksit satırı) = süzgeçsiz`, { timeout: 240_000 }, async () => {
      const { app } = await open(name);
      const store = app.store;
      const full = oldRulePinnedPlans(store);
      if (name === "surum-2.4.9-s127") assert.ok(full.size > 0, "ön koşul: kilitli S127 fikstüründe eski kurala bağlı kart var");
      const plans = store.all("SELECT id, account_id AS party, covers_balance AS covers FROM plans ORDER BY rowid");
      assert.ok(plans.length > 0, `${name}: ön koşul — kart var`);
      // (1) karar kart başına
      for (const plan of plans) {
        const one = oldRulePinnedPlans(store, { ids: [plan.id] });
        assert.deepEqual([...one], full.has(plan.id) ? [plan.id] : [], `${name}: kart ${plan.id} tek başına (bağlı: ${full.has(plan.id)})`);
      }
      assert.ok(same(oldRulePinnedPlans(store, { ids: plans.map(plan => plan.id) }), full), `${name}: bütün kartlar birden = süzgeçsiz`);
      assert.equal(oldRulePinnedPlans(store, { ids: [] }).size, 0, "boş liste → boş");
      assert.equal(oldRulePinnedPlans(store, { ids: ["plan-yok"] }).size, 0, "olmayan kart → boş");
      const pinnedFirst = [...full][0];
      if (pinnedFirst) assert.ok(same(oldRulePinnedPlans(store, { ids: [pinnedFirst, "plan-yok", pinnedFirst] }), [pinnedFirst]), "yinelenen ve olmayan kimlik karışık");
      // (2) süzgeçli türetme
      const entries = app.ledger.build();
      const byId = new Map(entries.map(entry => [entry.id, entry]));
      let checked = 0;
      for (const plan of plans) {
        const expectIds = full.has(plan.id) ? [`plan:${plan.id}`] : [];
        assertSubset(`${name} kart ${plan.id}`, app.ledger.build({ plans: [plan.id] }), byId, { expectIds });
        if (plan.party) assertSubset(`${name} kartın carisi ${plan.party}`, app.ledger.build({ parties: [plan.party] }), byId, { expectIds });
        for (const row of store.all("SELECT id, cheque_id AS cheque FROM plan_entries WHERE plan_id = ? ORDER BY rowid LIMIT 3", plan.id)) {
          assertSubset(`${name} taksit satırı ${row.id}`, app.ledger.build({ money: { plan_entries: [row.id] } }), byId, full.has(plan.id) && byId.has(`plan-entry:${row.id}`) ? { expectIds: [`plan-entry:${row.id}`] } : {});
          if (row.cheque) assertSubset(`${name} taksite sayılan evrak ${row.cheque}`, app.ledger.build({ cheques: [row.cheque] }), byId);
        }
        checked += 1;
      }
      // Karta bağlı olmayan evrak: süzgeçli türetmede kart / taksit satırı yok → karar sorulmaz; türetme yine aynı.
      for (const row of store.all("SELECT id FROM cheques WHERE id NOT IN (SELECT cheque_id FROM plan_entries WHERE cheque_id <> '') ORDER BY rowid LIMIT 10")) assertSubset(`${name} evrak ${row.id}`, app.ledger.build({ cheques: [row.id] }), byId);
      assert.ok(checked > 0, `${name}: sınanan kart ${checked}`);
    });
  }
});
