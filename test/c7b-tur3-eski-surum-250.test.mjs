// 2.5.0 Ç7b tur 3 — kabul D (ders 17, 53 (b); docs/erp/C7B-FATURA-TASARIM.md §16.7 (8)): v2.4.9'un GERÇEK koduyla (surumler.mjs bootVersion) üretilmiş kartlar güncellemeden sonra AYNEN.
// Bu tur yalnız YENİ yazımları değiştirir (küçülme sırası, S15 / S206 iptali); eski veride kartın takvimi, kapatılmış kartın düşülen kalanı ve bakiyeler değişmez.
// Sahte saat 08.10.2026 (durur). Beklenenler ELLE (v2.4.9'un bilinen kuralı + kararlar):
//   K1 Yeni Borç kartı 900 (3 × 300; 01.10 / 01.11 / 01.12), 01.10 tahsilat 300, v2.4.9'da Kartı Kapat → bakiye 0, Mizan 689 = 600 (eski kural — "önceden kapatılmış kartlar olduğu gibi kalır").
//   K2 taksitli fatura 900 (3 × 300; 06.10 / 06.11 / 06.12), 06.10 tahsilat 300 → bakiye 600, kart açık.
//   K3 taksitli fatura 900 (aynı takvim), 06.10 tahsilat 300, 07.10 iade 1 × 300 (v2.4.9: SONDAN küçülür) → takvim 06.10 300 (ödendi) · 06.11 300 açık; bakiye 300.
//   Güncel kodda: K1 / K2 / K3 aynen; sonra K2 İptal Et (S15) → 200, kart kapalı tutar 0 (faturadan ayrılır), bakiye −300; K1 Mizan 689 600 aynen; Mutabakat Testi temiz.
// NASIL BOZARIM: göçte eski kartların takvimini yeni sıraya çevirmek; kapalı kartın düşülen kalanını kaldırmak; S15'i eski veride reddetmek.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-08T12:00:00+03:00", fixed: true };
const W = "/api/workspace";
const skip = tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok";
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
async function snapshot(api, ids) {
  const balance = async id => (await must("cari", api.get(`${W}/accounts/${id}`))).totals.balance;
  const items = async id => (await must("kart", api.get(`${W}/plans/${id}`))).items.map(i => `${i.dueDate}:${i.amount}`);
  const trial = Object.fromEntries((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]));
  return { b1: await balance(ids.A1), b2: await balance(ids.A2), b3: await balance(ids.A3), k1: await items(ids.K1), k2: await items(ids.K2), k3: await items(ids.K3), m689: trial["689"] || 0, m120: trial["120"] || 0 };
}

describe("Ç7b tur 3 — kabul D: v2.4.9 verisindeki kartlar güncellemeden sonra aynen", { skip }, () => {
  let root;
  let server;
  let api;
  let app;
  const ids = {};
  let before249;
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "c7b3-eski-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const old = await bootVersion("v2.4.9", { ...dirs, now: NOW });
    try {
      const o = await old.login();
      const store = old.app.store;
      const acc = async name => (await must("cari", o.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id;
      const pay = (planId, amount, date) => must("tahsilat", o.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date, method: "cash" }));
      const sale = async (accountId, qty) => (await must("satış", o.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: "2026-10-06", lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment: { rest: "installments", installments: { count: 3, firstDue: "2026-10-06" } } }))).id;
      ids.A1 = await acc("Eski Kapalı");
      ids.K1 = (await must("kart", o.post(`${W}/plans`, { accountId: ids.A1, name: "Eski K1", total: "900", registeredOn: "2026-09-20", mode: "auto", count: 3, firstDue: "2026-10-01" }))).id;
      await pay(ids.K1, 300, "2026-10-01");
      await must("Kartı Kapat (v2.4.9)", o.put(`${W}/plans/${ids.K1}`, { status: "closed" }));
      ids.A2 = await acc("Eski Tahsilatlı");
      ids.F2 = await sale(ids.A2, 3);
      ids.K2 = store.get("SELECT plan_id AS p FROM invoices WHERE id = ?", ids.F2).p;
      await pay(ids.K2, 300, "2026-10-06");
      ids.A3 = await acc("Eski Küçülmüş");
      ids.F3 = await sale(ids.A3, 3);
      ids.K3 = store.get("SELECT plan_id AS p FROM invoices WHERE id = ?", ids.F3).p;
      await pay(ids.K3, 300, "2026-10-06");
      const line = (await must("fatura", o.get(`${W}/invoices/${ids.F3}`))).lines[0].id;
      await must("iade (v2.4.9)", o.post(`${W}/invoices`, { kind: "sale_return", accountId: ids.A3, originalId: ids.F3, issueDate: "2026-10-07", lines: [{ originLineId: line, qty: 1 }], payment: { cash: [] }, force: true }));
      before249 = await snapshot(o, ids);
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
    app = server.app;
    await app.ledger.snapshots.runPending();
    api = await server.login();
  }, { timeout: 300_000 });
  after(async () => {
    await server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("v2.4.9'un kendi değerleri elle beklenenle aynı (üreticinin doğruluğu)", () => {
    assert.deepEqual(before249, { b1: 0, b2: 600, b3: 300, k1: ["2026-10-01:300", "2026-11-01:300", "2026-12-01:300"], k2: ["2026-10-06:300", "2026-11-06:300", "2026-12-06:300"], k3: ["2026-10-06:300", "2026-11-06:300"], m689: 600, m120: 900 });
  });

  it("güncellemeden sonra kartlar, bakiyeler ve 689 aynen; Mutabakat Testi temiz", async () => {
    assert.deepEqual(await snapshot(api, ids), before249);
    const integrity = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures || "").slice(0, 600));
  });

  it("eski verideki tahsilatlı kartın faturası güncel kodda İptal Et ile kapanır (S15); eski kapalı kart eski kuralda kalır", async () => {
    await must("S15 iptal", api.post(`${W}/invoices/${ids.F2}/cancel`, { reason: "eski veri S15" }));
    const row = app.store.get("SELECT status, total FROM plans WHERE id = ?", ids.K2);
    assert.deepEqual({ ...row }, { status: "closed", total: 0 });
    const now = await snapshot(api, ids);
    assert.equal(now.b2, -300, "tahsilat avans");
    assert.equal(now.m689, 600, "K1'in v2.4.9'da düşülen kalanı aynen (eski kural)");
    assert.equal(now.b1, 0);
    const integrity = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures || "").slice(0, 600));
  });
});
