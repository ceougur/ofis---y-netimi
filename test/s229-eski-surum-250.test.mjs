// 2.5.0 S229 = A + S230 = A — kabul D (ders 17, 53 (b)): v2.4.9'un GERÇEK koduyla (guvenilirlik/surumler.mjs bootVersion) girilmiş veride "Carinin Mevcut Borcu"
// kartının içine aldığı faturalar. v2.4.9 faturayı KENDİ açığıyla gösterir (bugünkü gösterim o sürümde de vardı — gerileme değil); aynı veri güncel kodla açılınca
// S229 / S230 = A gösterimi. Sınıf listesi: yol (Açık Faturalar, fatura kartı, Faturalar listesi, Anlık Durum) × (kısmi, tam, iki kart) × (yeni kapama, eski kapama).
// Sahte saat 08.10.2026 (durur). Beklenenler ELLE (kararların sözünden; kod koşulmadan):
//   P kısmi: F 50.000 (02.09, vade 20.09), Mevcut Borç kartı 30.000 (1 taksit, 01.11) → v2.4.9: F 50.000 · güncel: F 20.000, 'Taksit Kartında · 30.000', 'Vadesi Geçti'.
//   T tam:   F 50.000, kart 50.000 (2 × 25.000) → v2.4.9: F 50.000 (gecikmiş görünür) · güncel: Açık Faturalar'da yok, fatura 'Taksitte' (0).
//   I iki kart: F 50.000, kart 20.000 + kart 10.000 → v2.4.9: F 50.000 · güncel: F 20.000, iki 'Taksit Kartında' satırı (20.000 + 10.000).
//   Anlık Durum (yalnız bu veri): v2.4.9 açık satış 150.000 · güncel 40.000 (20.000 + 0 + 20.000); vadesi geçen aynı.
//   Eski kapama düzeni (legacyClosing) güncel kodda aynı gösterim. Bakiye (P 50.000, T 50.000, I 50.000) iki sürümde aynı.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { settleInvoices } from "../server/lib/invoice-settle.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-08T12:00:00+03:00", fixed: true };
const W = "/api/workspace";
const skip = tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok";
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Number(`${match[1] ? "-" : ""}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
};
// Ekranların okuduğu uçlardan bu verinin gösterimi.
async function views(api, ids) {
  const report = await must("Açık Faturalar", api.get(`${W}/report-center/acik-faturalar`));
  const kalan = report.headers.indexOf("Kalan");
  const no = report.headers.indexOf("Fatura No");
  const rows = Object.fromEntries(report.rows.map(row => [row[no], moneyOf(row[kalan])]));
  const out = { rapor: {}, kart: {}, liste: {}, plans: {}, bakiye: {} };
  const list = await must("Faturalar", api.get(`${W}/invoices?tab=all&limit=200`));
  for (const key of ["P", "T", "I"]) {
    const doc = await must("fatura kartı", api.get(`${W}/invoices/${ids[key]}`));
    out.rapor[key] = rows[doc.number] ?? null;
    out.kart[key] = [doc.open, doc.payState];
    out.plans[key] = (doc.inPlans || []).map(item => item.amount).sort((a, b) => b - a);
    out.liste[key] = list.invoices.find(item => item.id === ids[key])?.open;
    out.bakiye[key] = (await must("cari", api.get(`${W}/accounts/${ids[`A${key}`]}`))).totals.balance;
  }
  const overview = (await must("Anlık Durum", api.get(`${W}/overview`))).invoices;
  out.anlik = [overview.openSale, overview.overdueSale];
  return out;
}

describe("S229 / S230 — kabul D: v2.4.9 verisi (Mevcut Borç kartının içine aldığı faturalar)", { skip }, () => {
  let root;
  const ids = {};
  let dirs;
  let old249;
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "s229-eski-"));
    dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const old = await bootVersion("v2.4.9", { ...dirs, now: NOW });
    try {
      const o = await old.login();
      let n = 0;
      const acc = async name => (await must("cari (v2.4.9)", o.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id;
      const sale = async accountId => (await must("satış (v2.4.9)", o.post(`${W}/invoices`, { scenario: "service_sale", accountId, issueDate: "2026-09-02", lines: [{ name: "Hizmet", qty: 1, unitPrice: 50000 / 1.2, vatRate: 20 }], payment: { rest: "open", dueDate: "2026-09-20" } }))).id;
      const card = async (accountId, total, count) => (await must("Mevcut Borç kartı (v2.4.9)", o.post(`${W}/plans`, { accountId, name: `Eski Kart ${(n += 1)}`, total: String(total), registeredOn: "2026-09-25", mode: "auto", count, firstDue: "2026-11-01", coversBalance: true }))).id;
      ids.AP = await acc("Eski Kısmi");
      ids.P = await sale(ids.AP);
      await card(ids.AP, 30000, 1);
      ids.AT = await acc("Eski Tam");
      ids.T = await sale(ids.AT);
      await card(ids.AT, 50000, 2);
      ids.AI = await acc("Eski İki Kart");
      ids.I = await sale(ids.AI);
      await card(ids.AI, 20000, 1);
      await card(ids.AI, 10000, 1);
      old249 = await views(o, ids);
    } finally {
      await old.close();
    }
  });
  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("v2.4.9 faturayı kendi açığıyla gösterir (bugünkü gösterim o sürümde de vardı)", () => {
    assert.deepEqual(old249.rapor, { P: 50000, T: 50000, I: 50000 }, "v2.4.9 Açık Faturalar");
    assert.deepEqual(old249.liste, { P: 50000, T: 50000, I: 50000 }, "v2.4.9 Faturalar listesi Kalan");
    assert.deepEqual(old249.kart, { P: [50000, "overdue"], T: [50000, "overdue"], I: [50000, "overdue"] }, "v2.4.9 fatura kartı");
    assert.deepEqual(old249.anlik, [150000, 150000], "v2.4.9 Anlık Durum açık / vadesi geçen satış");
    assert.deepEqual(old249.bakiye, { P: 50000, T: 50000, I: 50000 });
  });

  for (const [mode, overrides] of [["yeni kapama (TYK)", {}], ["eski kapama düzeni (legacyClosing)", { legacyClosing: settleInvoices }]]) {
    it(`güncel kod, ${mode}: aynı veride S229 / S230 = A gösterimi`, async () => {
      const server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false, ...overrides });
      try {
        const api = await server.login();
        const now = await views(api, ids);
        assert.deepEqual(now.rapor, { P: 20000, T: null, I: 20000 }, `${mode}: Açık Faturalar ${JSON.stringify(now.rapor)}`);
        assert.deepEqual(now.liste, { P: 20000, T: 0, I: 20000 }, `${mode}: Faturalar listesi Kalan`);
        assert.deepEqual(now.kart, { P: [20000, "overdue"], T: [0, "installment"], I: [20000, "overdue"] }, `${mode}: fatura kartı`);
        assert.deepEqual(now.plans, { P: [30000], T: [50000], I: [20000, 10000] }, `${mode}: Taksit Kartında satırları`);
        assert.deepEqual(now.anlik, [40000, 40000], `${mode}: Anlık Durum`);
        assert.deepEqual(now.bakiye, old249.bakiye, `${mode}: bakiye değişmez`);
      } finally {
        await server.close();
      }
    });
  }
});
