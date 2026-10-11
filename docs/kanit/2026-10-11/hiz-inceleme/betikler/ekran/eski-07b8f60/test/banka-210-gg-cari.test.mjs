// 2.1.0 — Aşama 2, bağımsız gözden geçirme B8: kapı süzgecinin süresi dokunulan carinin geçmişiyle büyümez (docs/2.1.0-KANIT.md
// "Aşama 2 — Bağımsız Gözden Geçirme").
//
// Kök neden: süzgecin cari denetimi dokunulan carinin BÜTÜN satırlarının yevmiye maddesini kuruyordu (30.000 satırlı caride ~300 ms,
// 100.000'de ~1,1 sn; bütçe 150 ms / 1 sn). Ölçüm verisinde her carinin az satırı vardı; gerçek veride "Perakende Müşteri" gibi tek cari
// hareketlerin büyük payını taşır. Düzeltme: yevmiyeye giren satırı eşikten (2.000) çok olan carinin defter bakiyesi yevmiye maddeleri
// kurulmadan, AYNI kuralın SQL toplamıyla (ledger.partyTotals) hesaplanır.
//
// ÇALIŞIYOR MU:
//  - İki yolun eşdeğerliği: rastgele mutabakat motoru verisinde (fatura türleri, iade, iptal, taksit, kapatılan kart, çek, stok) ve gerçek
//    2.0.26 verisinde HER carinin SQL toplamı = yevmiyeden hesaplanan bakiye; eşik 0 (her cari SQL yolu) ve eşdeğerlik denetimi açıkken
//    motorun her işlemi tutarlı, süzgeç hiçbir işlemde "bulgu" demez.
//  - Çok hareketli cari (2.100 satır): tahsilat süzgeç yolunda, cari SQL yolunda (yevmiye maddesi kurulmadı), Mutabakat Testi temiz.
// NASIL BOZARIM: çok hareketli carinin kesilmiş faturasının tutarını cari satırından ayır → 409; bulgu listesinde party:accounts (SQL yolu
// sapmayı görüyor).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partyBalances } from "../server/lib/general-ledger.mjs";
import { boot, integrityOk, must, rawRun } from "./banka-210-ortak.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { loginAdmin } from "./helpers.mjs";
import { runReconciliation } from "./mutabakat/motor.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";

function compareAll(app, label) {
  const ledger = app.context.ledger;
  const ids = app.store.all("SELECT id FROM accounts WHERE deleted_at IS NULL").map(row => row.id);
  const fromJournal = partyBalances(ledger.build());
  const fromSql = ledger.partyTotals(ids);
  const wrong = ids.filter(id => (fromJournal.get(id) || 0) !== (fromSql.get(id) || 0)).map(id => `${id}: yevmiye ${fromJournal.get(id) || 0} / SQL ${fromSql.get(id) || 0}`);
  assert.deepEqual(wrong, [], `${label}: SQL toplamı ≠ yevmiye`);
  return ids.length;
}

describe("B8 — carinin defter bakiyesi: SQL toplamı = yevmiye (iki yolun eşdeğerliği)", () => {
  it("rastgele mutabakat motoru (eşik 0: her cari SQL yolunda, eşdeğerlik denetimi açık): her işlem tutarlı, süzgeç bulgusu yok, her cari eşit", async () => {
    const ctx = await boot({ scopePartyRows: 0, bankPickLegacy: true });
    try {
      const report = await runReconciliation({ client: await loginAdmin(ctx.server), seed: 5, operations: 400, verifyEvery: 10, burst: 0 });
      assert.deepEqual(report.mismatches.slice(0, 3), [], "motor: her işlemde tutarlı");
      const tally = ctx.app.integrity.stats().tally;
      assert.equal(tally.bulgu || 0, 0, `süzgeç tam kapıyla aynı karar vermeli: ${JSON.stringify(tally)}`);
      assert.ok(compareAll(ctx.app, "motor") > 5);
    } finally {
      await ctx.server.close();
    }
  });

  it("gerçek 2.0.26 verisi (her şirket): her carinin SQL toplamı = yevmiye", async () => {
    const name = "surum-2.0.26-zincir";
    const fixture = unpackFixture(name);
    let server = null;
    try {
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: `${readFixture(name).oncesi.today}T12:00:00+03:00` });
      assert.ok(compareAll(server.app, "2.0.26 001") > 50);
    } finally {
      await server?.close().catch(() => {});
      fixture.cleanup();
    }
  });
});

describe("B8 — çok hareketli cari: süzgeç süresi carinin geçmişiyle büyümez", () => {
  it("2.100 satırlı cari: tahsilat süzgeç yolunda, yevmiye maddesi kurulmadan (SQL); bozuk fatura tutarı 409 ve party:accounts", async () => {
    const ctx = await boot({ now: NOW, gateVerify: false, moneyStrict: false });
    try {
      const { api, app, db, store } = ctx;
      const heavy = await must("çok hareketli cari", api.post("/api/workspace/accounts", { name: "Perakende Müşteri", type: "customer", registeredOn: "2026-01-01" }));
      const light = await must("az hareketli cari", api.post("/api/workspace/accounts", { name: "Tek Müşteri", type: "customer", registeredOn: "2026-01-01" }));
      // Satırlar açılıştan önce (eski veri gibi; tutarlı): Borç Yaz.
      db.exec("BEGIN");
      const insert = db.prepare("INSERT INTO account_entries (id, account_id, kind, amount, date, note, method, source, source_id, created_by, created_at) VALUES (?, ?, 'debt', 10, ?, 'yük', '', '', '', 'admin', ?)");
      for (let i = 0; i < 2100; i += 1) insert.run(`agir-${i}`, heavy.id, `2026-0${1 + (i % 9)}-1${i % 9}`, "2026-01-01T00:00:00.000Z");
      db.exec("COMMIT");
      app.integrity.start();
      const invoice = await must("fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: heavy.id, issueDate: TODAY, lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
      await must("tahsilat", api.post(`/api/workspace/accounts/${heavy.id}/entries`, { kind: "in", amount: "50", method: "cash", date: TODAY }));
      const gate = app.integrity.stats().gate;
      assert.equal(gate.path, "scoped", JSON.stringify(gate));
      assert.equal(gate.scope.heavyParties, 1, "cari SQL yolunda");
      assert.ok(gate.scope.built < 20, `yevmiye maddesi carinin geçmişi kadar kurulmamalı: ${gate.scope.built}`);
      await must("az hareketli cari tahsilatı", api.post(`/api/workspace/accounts/${light.id}/entries`, { kind: "in", amount: "5", method: "cash", date: TODAY }));
      assert.equal(app.integrity.stats().gate.scope.heavyParties, 0, "az hareketli cari yevmiye yolunda (2.0.26 kuralı)");
      await integrityOk(api, "çok hareketli cari");
      // Nasıl bozarım: faturanın tutarı cari satırından ayrılır (cari kartı ≠ defter).
      // (Yalnız fatura tablosuna yazım kapıyı tetiklemez — bilinen sınır; aynı işlemde carinin bir para dışı kolonu da yazılır.)
      assert.throws(() => store.tx(() => {
        store.run("UPDATE invoices SET try_payable = try_payable + 1, payable_total = payable_total + 1 WHERE id = ?", invoice.id);
        store.run("UPDATE accounts SET type = type WHERE id = ?", heavy.id);
      }), error => error.status === 409);
      const reason = app.integrity.stats().gate.reason || "";
      assert.match(reason, /party:accounts/, `SQL yolu cari sapmasını görmeli: ${reason}`);
      rawRun(db, "DELETE FROM account_entries WHERE note = 'yük'");
    } finally {
      await ctx.server.close();
    }
  });
});
