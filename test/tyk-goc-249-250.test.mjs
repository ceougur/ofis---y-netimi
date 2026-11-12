// 2.5.0 Ç5-B — v2.4.9 GERÇEK koduyla üretilmiş veri (ders 17, G6) güncel kodla açılınca Tek Yükümlülük Kuyruğu'nun sayıları. Göç (v2.4.9 → güncel) aynı veri klasöründe.
// ELLE beklenen (karar metninden; yorumda): S2 vade sırası, karar (1) kendi tarihinde, S50 ayrı kartın taksiti cari tahsilatıyla kapanır, S1 vadesiz borç ertesi gün.
// v2.4.9'un kendi sayıları (en eski belge, ayrı kart kendi defteri) önce okunup "eski kural" olarak yazılır (ön koşul; aynı veri iki kuralla farklı).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { must } from "./banka-210-ortak.mjs";
import { bootVersion, CURRENT, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { removeTestDir } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const v249 = tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok (git fetch --tags)";

describe("2.5.0 Ç5-B — v2.4.9 verisi güncel kodun kuyruğunda", () => {
  test("v2.4.9: iki fatura (vade belge sırasına ters) + bağsız tahsilat + Yeni Borç kartı + bağsız tahsilat + vadesiz Borç Yaz → güncel kod TYK sayıları", { skip: v249, timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "c5b-tyk-249-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const ids = {};
    try {
      let server = await bootVersion("v2.4.9", { ...dirs, now: { time: NOW, fixed: true } });
      try {
        const api = await server.login();
        await api.post("/api/workspace/bank/setup/dismiss", {});
        const item = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-249", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
        const acc = await must("cari", api.post("/api/workspace/accounts", { name: "TYK 249 Müşteri", type: "customer", registeredOn: day(-400), phone: "0500 249 00 01" }));
        ids.account = acc.id;
        const sale = (date, dueDate) => must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id ?? item.item?.id, qty: 1, unitPrice: "1000", vatRate: 0 }], payment: { rest: "open", dueDate } }));
        ids.f1 = (await sale(day(-40), day(-5))).id;
        ids.f2 = (await sale(day(-30), day(-25))).id;
        await must("tahsilat 1", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "1000", date: day(-20), method: "cash" }));
        ids.plan = (await must("Yeni Borç kartı", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-18), total: "600", accountId: acc.id, mode: "auto", count: "2", firstDue: day(-15), everyMonths: "1" }))).id;
        await must("tahsilat 2", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "300", date: day(-10), method: "cash" }));
        await must("Borç Yaz", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "200", date: day(-3), note: "vadesiz" }));
        // Ön koşul (v2.4.9 kuralı: en eski belge, ayrı kart kendi defteri): F1 kapalı, F2 700 açık, kartın 1. taksiti 300 açık.
        const f1 = await must("F1 (v2.4.9)", api.get(`/api/workspace/invoices/${ids.f1}`));
        const f2 = await must("F2 (v2.4.9)", api.get(`/api/workspace/invoices/${ids.f2}`));
        const plan = await must("kart (v2.4.9)", api.get(`/api/workspace/plans/${ids.plan}`));
        assert.deepEqual([f1.open, f2.open, plan.items.map(i => i.remaining)], [0, 700, [300, 300]], "ön koşul: v2.4.9'un kendi kuralı");
      } finally {
        await server.close();
      }
      server = await bootVersion(CURRENT, { ...dirs, now: { time: NOW, fixed: true } });
      try {
        const api = await server.login();
        // ELLE (güncel kural): −20 tahsilat 1.000 → açık F1 (vade −5), F2 (vade −25) → S2: F2 kapanır, F1 1.000 açık.
        // −10 tahsilat 300 → açık F1 (−5), 1. taksit (−15), 2. taksit (+15) → S2: 1. taksit kapanır (S50, cari tahsilatıyla 300).
        // −3 Borç Yaz 200 vadesiz (S1: vade −3). gecikmiş(bugün) = F1 1.000 + Borç Yaz 200 = 1.200 (2 kalem); bakiye 2.000 + 600 − 1.300 + 200 = 1.500.
        const f1 = await must("F1", api.get(`/api/workspace/invoices/${ids.f1}`));
        const f2 = await must("F2", api.get(`/api/workspace/invoices/${ids.f2}`));
        assert.deepEqual([f1.open, f1.payState, f2.open, f2.payState], [1000, "overdue", 0, "paid"]);
        const plan = await must("kart", api.get(`/api/workspace/plans/${ids.plan}`));
        assert.deepEqual(plan.items.map(i => [i.remaining, i.accountPaid]), [[0, 300], [300, 0]]);
        // S129 = A (kapanış düzeltme turu): gösterilen Kalan / Tahsil Edilen tek kuyruktan (300 / 300); kartın kendi hesabı ownRemaining'de.
        assert.deepEqual([plan.totals.ownRemaining, plan.totals.ownPaid, plan.totals.remaining, plan.totals.paid], [600, 0, 300, 300], "kartın kendi hesabı (kart tahsilatı yok) değişmez; gösterilen sayı kuyruktan");
        const card = await must("cari kartı", api.get(`/api/workspace/accounts/${ids.account}`));
        assert.deepEqual([card.totals.overdueDebt, card.totals.overdueDebtCount, card.totals.balance], [1200, 2, 1500]);
        const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
        assert.equal(integrity.ok, true, JSON.stringify(integrity.failures || integrity.checks?.filter(c => !c.ok)).slice(0, 600));
      } finally {
        await server.close();
      }
    } finally {
      removeTestDir(root);
    }
  });
});
