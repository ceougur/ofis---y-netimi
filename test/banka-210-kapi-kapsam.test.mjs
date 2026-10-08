// 2.1.0 — Aşama 2, Dilim 5: mutabakat kapısının "dokunulan varlıklar" yolu (docs/BANKA-MODULU-PLAN.md §3.11 kararı; lib/integrity-scope.mjs).
//
// Ölçüm (tools/kapi-olcum.mjs): tam kapı her COMMIT'te bütün defteri kurar; 10.000 para satırında ~0,7 sn, 100.000'de ~9 sn (bütçe 150 ms).
// Karar: COMMIT'te önce yalnız işlemin dokunduğu varlıklar denetlenir (aynı kurallar); süzgeç temizse tam kapı çalışmaz. Süzgeç bir şey
// görürse (sapma, taban sapması olan alan, kilit izi, store dışı yazım, çözülemeyen yazım) karar 2.0.26'daki tam kapınındır.
//
// ÇALIŞIYOR MU (üretim kipi: gateVerify kapalı):
//  - Kasa, cari tahsilatı, peşin ve taksitli fatura, taksit tahsilatı, çek alış ve tahsili, Borç Yaz, stok satışı: 200; kapı süzgeç
//    yolundan geçer (tam kapı çalışmaz), Mutabakat Testi tutarlı.
//  - Kilitli dönemin satırında yalnız açıklama düzeltmesi: 200, süzgeç yolu (kilit izine giren alan değişmedi).
//  - Taban sapması olan bir alana (açılışta kuruşu bozuk Kasa satırı) dokunan yazım tam kapıya gider ve (sapma büyümediği için) geçer;
//    o alana dokunmayan yazım süzgeç yolundan geçer.
// NASIL BOZARIM (üretim kipinde; işlem içinde store üzerinden doğrudan SQL — hatalı bir modülün yazacağı gibi):
//  1. Tutar: kuruştan küçük küsurat → 409, satır yok.
//  2. Tutar: para satırının tutarını olaysız değiştir (işlem başlığı kopyası tutmaz) → 409.
//  3. Tarih: ileri tarihli ve 30 Şubat tarihli Kasa satırı → 409.
//  4. Yol: "bitcoin" yollu Kasa satırı → 409.
//  5. Kilitli satır: kilitli dönemdeki satırı sil / tutarını değiştir → 409 period-lock.
//  6. Kilitli dönemde hareketi olan carinin türünü değiştir → 409 period-lock.
//  7. Stok: açık hesap stok hareketinin tutarını cari satırından ayır; hareketi olmayan stok kaynaklı cari satırı → 409.
//  8. Çek: çek kaynaklı cari satırının tutarı çekten farklı → 409.
//  9. Fatura: faturanın cari satırını faturadan farklı yap → 409.
// 10. Olaysız para satırı: üretimde K6 günlüğe yazar (iş durmaz; dilim 3 kararı), tam tarama money:event bulur; test kipinde 500.
// 11. Store dışından (aynı bağlantı, db.prepare) bozuk satır, ardından ilgisiz API yazımı → tam kapıya döner → 409 (2.0.26 gibi).
// 12. Başka bağlantıdan (ikinci DatabaseSync) bozuk satır → data_version → tam kapı → 409.
// 13. Çözülemeyen yazım (upsert) → tam kapı (yol "full").
// 14. Eşdeğerlik koruması: süzgeci bilerek kör et (her zaman "temiz"), test kipinde bozuk yazım → 500 gate-equivalence (tam kapı yakalar).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { IntegrityError } from "../server/lib/integrity.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { boot, integrityOf, integrityOk, must } from "./banka-210-ortak.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const day = offset => {
  const d = new Date(Date.UTC(2026, 9, 8 + offset));
  return d.toISOString().slice(0, 10);
};
const PROD = { now: NOW, gateVerify: false, moneyStrict: false };
const gateOf = app => app.integrity.stats().gate;
const insertCash = (store, { id = `cash-${randomUUID()}`, amount = 10, date = TODAY, method = "cash", eventId = "" } = {}) =>
  store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at, event_id) VALUES (?, 'in', ?, ?, 'Test', ?, 'test', ?, ?)", id, amount, date, method, `${TODAY}T09:00:00.000Z`, eventId);
const rejected = (fn, pattern = /geri alındı/) =>
  assert.throws(fn, error => error instanceof IntegrityError && error.status === 409 && pattern.test(error.message), "kapı reddetmeli (409)");
const count = (store, table) => store.get(`SELECT COUNT(*) AS n FROM ${table}`).n;

async function seed(api) {
  const customer = await must("cari", api.post("/api/workspace/accounts", { name: "Kapsam Müşterisi", type: "customer", registeredOn: day(-60) }));
  const item = await must("ürün", api.post("/api/workspace/stock", { name: "Kapsam Ürünü", unit: "Adet", unitPrice: "10", salePrice: "20", openingQty: "100" }));
  return { customer, item };
}

describe("kapı süzgeci (dokunulan varlıklar) — çalışıyor mu", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot(PROD);
    data = await seed(ctx.api);
  });
  after(() => ctx.server.close());

  it("günlük işler süzgeç yolundan geçer; tam kapı çalışmaz; Mutabakat Testi tutarlı", async () => {
    const { api, app } = ctx;
    const steps = [
      ["Kasa", () => api.post("/api/workspace/cash", { kind: "in", amount: "125,50", date: TODAY, description: "Kasa" })],
      ["cari tahsilat", () => api.post(`/api/workspace/accounts/${data.customer.id}/entries`, { kind: "in", amount: "300", method: "bank", date: TODAY })],
      ["Borç Yaz", () => api.post(`/api/workspace/accounts/${data.customer.id}/entries`, { kind: "debt", amount: "900", date: TODAY, note: "Borç" })],
      ["peşin fatura", () => api.post("/api/workspace/invoices", { kind: "sale", accountId: data.customer.id, issueDate: TODAY, lines: [{ itemId: data.item.id, name: "", qty: 1, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: 120, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true })],
      ["taksitli fatura", () => api.post("/api/workspace/invoices", { kind: "sale", accountId: data.customer.id, issueDate: TODAY, lines: [{ itemId: data.item.id, name: "", qty: 3, unitPrice: 100, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "installments", installments: { count: 3, firstDue: day(30) } }, force: true })],
      ["stok satışı", () => api.post(`/api/workspace/stock/${data.item.id}/moves`, { kind: "out", qty: "2", unitPrice: "20", pay: "cash", method: "card", date: TODAY })],
    ];
    for (const [label, step] of steps) {
      await must(label, step());
      const gate = gateOf(app);
      assert.equal(gate.path, "scoped", `${label}: süzgeç yolu (${gate.reason || ""})`);
      assert.equal(gate.runMs, 0, `${label}: tam kapı çalışmadı`);
    }
    const plan = ctx.store.get("SELECT id FROM plans WHERE account_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1", data.customer.id);
    await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", method: "cash", date: TODAY }));
    assert.equal(gateOf(app).path, "scoped");
    const cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "750", issueDate: TODAY, dueDate: day(30), accountId: data.customer.id, serialNo: "KPS-1", bank: "Test" }));
    assert.equal(gateOf(app).path, "scoped");
    await must("çek tahsili", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: TODAY, method: "bank" }));
    assert.equal(gateOf(app).path, "scoped");
    await integrityOk(api, "günlük işler");
    assert.ok((app.integrity.stats().tally.temiz || 0) >= 9, JSON.stringify(app.integrity.stats().tally));
  });

  it("kilitli dönemin satırında yalnız açıklama: 200 ve süzgeç yolu; tutar değişirse 409 (aşağıda)", async () => {
    const { api, app, store } = ctx;
    const old = await must("eski Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "40", date: day(-20), description: "Eski" }));
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: day(-10) }));
    store.tx(() => store.run("UPDATE cash_entries SET description = 'Eski (açıklama)' WHERE id = ?", old.id));
    assert.equal(gateOf(app).path, "scoped", JSON.stringify(gateOf(app)));
    rejected(() => store.tx(() => store.run("UPDATE cash_entries SET amount = 41 WHERE id = ?", old.id)), /Kapanmış dönem/);
    assert.equal(store.get("SELECT amount FROM cash_entries WHERE id = ?", old.id).amount, 40);
    await must("kilidi kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
  });
});

describe("kapı süzgeci — nasıl bozarım (üretim kipi; işlem içinde doğrudan SQL)", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot(PROD);
    data = await seed(ctx.api);
  });
  after(() => ctx.server.close());

  it("1. kuruştan küçük küsurat → 409, satır yazılmaz", () => {
    const before = count(ctx.store, "cash_entries");
    rejected(() => ctx.store.tx(() => insertCash(ctx.store, { amount: 10.005 })), /Kuruş/);
    assert.equal(count(ctx.store, "cash_entries"), before);
    assert.equal(gateOf(ctx.app).path, "full", "süzgeç sapmayı gördü, karar tam kapının");
  });

  it("2. para satırının tutarını bank.post dışında değiştir (işlem başlığı kopyası tutmaz): üretimde 2.0.26/dilim 3 gibi K6 günlüğü, tam tarama bank:event bulur; test kipinde 500", async () => {
    const entry = await must("Kasa", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "200", date: TODAY, description: "Kopya" }));
    ctx.store.tx(() => ctx.store.run("UPDATE cash_entries SET amount = 201 WHERE id = ?", entry.id));
    assert.equal(gateOf(ctx.app).path, "full", "süzgeç kopya sapmasını gördü; karar tam kapının (üretimde olay bazlı denetim bank.post'un dokunduğu olaylara bakar)");
    assert.match(JSON.stringify(JSON.parse(ctx.store.setting("meta.bank.integrity", "[]") || "[]")), /money-raw/, "K6 günlüğü");
    const result = await integrityOf(ctx.api);
    assert.ok(result.failures.some(item => item.code.startsWith("bank:event")), JSON.stringify(result.failures.map(item => item.code)));
    ctx.store.raw("test: geri al", () => ctx.store.tx(() => ctx.store.run("UPDATE cash_entries SET amount = 200 WHERE id = ?", entry.id)));
    ctx.app.integrity.start();
    const strict = await boot({ now: NOW });
    try {
      const other = await must("Kasa", strict.api.post("/api/workspace/cash", { kind: "in", amount: "200", date: TODAY, description: "Kopya" }));
      assert.throws(() => strict.store.tx(() => strict.store.run("UPDATE cash_entries SET amount = 201 WHERE id = ?", other.id)), error => error.status === 500 && error.extra?.code === "money-guard");
    } finally {
      await strict.server.close();
    }
  });

  it("3. ileri tarihli ve 30 Şubat tarihli Kasa satırı → 409", () => {
    rejected(() => ctx.store.tx(() => insertCash(ctx.store, { date: day(5) })), /İleri tarihli/);
    rejected(() => ctx.store.tx(() => insertCash(ctx.store, { date: "2026-02-30" })), /geçersiz tarihli/);
  });

  it("4. tanınmayan yol (bitcoin) → 409", () => {
    rejected(() => ctx.store.tx(() => insertCash(ctx.store, { method: "bitcoin" })));
  });

  it("5–6. kilitli satırı sil / tutarını değiştir; kilitli dönemde hareketi olan carinin türünü değiştir → 409 period-lock", async () => {
    const { api, store } = ctx;
    const old = await must("eski Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "30", date: day(-20), description: "Eski" }));
    await must("eski tahsilat", api.post(`/api/workspace/accounts/${data.customer.id}/entries`, { kind: "debt", amount: "500", date: day(-20), note: "Eski borç" }));
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: day(-10) }));
    try {
      rejected(() => store.tx(() => store.run("DELETE FROM cash_entries WHERE id = ?", old.id)), /Kapanmış dönem/);
      rejected(() => store.tx(() => store.run("UPDATE cash_entries SET amount = 31 WHERE id = ?", old.id)), /Kapanmış dönem/);
      assert.ok(store.get("SELECT id FROM cash_entries WHERE id = ? AND amount = 30", old.id));
      rejected(() => store.tx(() => store.run("UPDATE accounts SET type = 'supplier' WHERE id = ?", data.customer.id)), /Kapanmış dönem/);
      assert.equal(store.get("SELECT type FROM accounts WHERE id = ?", data.customer.id).type, "customer");
    } finally {
      await must("kilidi kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
    }
  });

  it("7. stok: açık hesap hareketinin tutarı carideki satırdan ayrı; hareketi olmayan stok kaynaklı cari satırı → 409", async () => {
    const { api, store } = ctx;
    const move = await must("veresiye satış", api.post(`/api/workspace/stock/${data.item.id}/moves`, { kind: "out", qty: "1", unitPrice: "20", pay: "account", accountId: data.customer.id, date: TODAY }));
    rejected(() => store.tx(() => store.run("UPDATE stock_moves SET amount = 25 WHERE id = ?", move.moveId)), /Stok ↔ cari/);
    rejected(() => store.tx(() => store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, created_by, created_at) VALUES (?, ?, 'debt', 90, ?, 'hayalet', 'stock', 'olmayan-hareket', 'test', ?)", `ae-${randomUUID()}`, data.customer.id, TODAY, `${TODAY}T09:00:00Z`)), /Stok hareketi silinmiş/);
  });

  it("8. çek kaynaklı cari satırı çekten farklı tutarda → 409", async () => {
    const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "700", issueDate: TODAY, dueDate: day(20), accountId: data.customer.id, serialNo: "BOZ-1", bank: "Test" }));
    rejected(() => ctx.store.tx(() => ctx.store.run("UPDATE account_entries SET amount = 700.01 WHERE source = 'cheque' AND source_id = ?", cheque.id)));
  });

  it("9. faturanın cari satırı faturadan farklı → 409", async () => {
    const invoice = await must("fatura", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: data.customer.id, issueDate: TODAY, lines: [{ itemId: data.item.id, name: "", qty: 1, unitPrice: 50, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    rejected(() => ctx.store.tx(() => ctx.store.run("UPDATE account_entries SET amount = amount + 10 WHERE source = 'invoice' AND source_id = ? AND kind = 'debt'", invoice.id)));
  });

  it("10. olaysız para satırı: üretimde K6 günlüğe yazar ve iş durmaz; tam tarama money:event bulur", async () => {
    ctx.store.tx(() => insertCash(ctx.store, { amount: 12 }));
    const logged = JSON.parse(ctx.store.setting("meta.bank.integrity", "[]") || "[]");
    assert.ok(logged.some(item => item.violations?.some?.(v => v.code === "money-event") || /money-event/.test(JSON.stringify(item))), "K6 günlüğe yazdı");
    const result = await integrityOf(ctx.api);
    assert.ok(result.checks.some(item => item.code === "money:event" && !item.ok), "tam tarama olaysız para satırını bulur");
    ctx.store.raw("test: temizlik", () => ctx.store.tx(() => ctx.store.run("DELETE FROM cash_entries WHERE event_id = '' AND amount = 12")));
  });
});

// Süzgecin kapanışı: sapma, yazılan satırın kendisinde değil ona bağlı bir varlıkta çıkar (görünürlük, çek portföyü, Kasa ↔ Banka ikizi).
describe("kapı süzgeci — nasıl bozarım: bağlı varlıkta çıkan sapma (üretim kipi)", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot(PROD);
    data = await seed(ctx.api);
  });
  after(() => ctx.server.close());

  it("15. peşin satışı olan ürünü ham DELETE ile sil → tek kaynak ürünsüz hareketi görmez, yevmiye görür (100) → 409", async () => {
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Silinecek Ürün", unit: "Adet", unitPrice: "10", salePrice: "20", openingQty: "10" }));
    await must("peşin satış", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "20", pay: "cash", method: "cash", date: TODAY }));
    rejected(() => ctx.store.tx(() => ctx.store.run("DELETE FROM stock_items WHERE id = ?", item.id)));
    assert.ok(ctx.store.get("SELECT id FROM stock_items WHERE id = ?", item.id));
  });

  it("16. tahsil edilmiş çeki ham UPDATE ile sil → cari satırının 101 karşılığı kalır, portföy değişmez → 409", async () => {
    const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "320", issueDate: TODAY, dueDate: day(20), accountId: data.customer.id, serialNo: "GOR-2", bank: "Test" }));
    rejected(() => ctx.store.tx(() => ctx.store.run("UPDATE cheques SET deleted_at = ? WHERE id = ?", `${TODAY}T10:00:00Z`, cheque.id)));
  });

  it("17. peşinli faturayı ham DELETE ile sil (aynı işlemde bir para yazımıyla) → tek kaynak peşin satırını görmez, yevmiye görür → 409", async () => {
    const invoice = await must("fatura", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: data.customer.id, issueDate: TODAY, lines: [{ itemId: data.item.id, name: "", qty: 1, unitPrice: 80, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: 80, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    rejected(() => ctx.store.tx(() => {
      ctx.store.run("DELETE FROM invoices WHERE id = ?", invoice.id);
      ctx.store.run("UPDATE accounts SET type = type WHERE id = ?", data.customer.id);
    }));
    assert.ok(ctx.store.get("SELECT id FROM invoices WHERE id = ?", invoice.id));
  });

  it("BİLİNEN SINIR (2.0.15'ten beri, değişmedi): YALNIZ fatura tablosuna yazan işlem kapıyı tetiklemez; Mutabakat Testi (tam tarama) bulur", async () => {
    const invoice = await must("fatura", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: data.customer.id, issueDate: TODAY, lines: [{ itemId: data.item.id, name: "", qty: 1, unitPrice: 70, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: 70, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    const saved = ctx.store.get("SELECT * FROM invoices WHERE id = ?", invoice.id);
    ctx.store.tx(() => ctx.store.run("DELETE FROM invoices WHERE id = ?", invoice.id));
    const result = await integrityOf(ctx.api);
    assert.ok(result.failures.some(item => item.code === "invoice:orphan"), JSON.stringify(result.failures.map(item => item.code)));
    const columns = Object.keys(saved);
    ctx.store.tx(() => ctx.store.run(`INSERT INTO invoices (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, ...columns.map(column => saved[column])));
    await integrityOk(ctx.api, "fatura geri konunca");
  });

  it("18. Kasa ↔ Banka transferinin banka bacağını ham UPDATE ile değiştir → 102 kayar → 409", async () => {
    const transfer = await must("transfer", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "50", date: TODAY, description: "Yatırma", cashForce: true }));
    rejected(() => ctx.store.tx(() => ctx.store.run("UPDATE cash_entries SET amount = 55 WHERE transfer_id = ? AND method = 'bank'", transfer.transferId)));
  });

  it("19. fatura kalemini ham UPDATE ile değiştir (aynı işlemde bir cari yazımıyla) → başlık ≠ kalemler, kalem ≠ stok hareketi → 409", async () => {
    const invoice = await must("fatura", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: data.customer.id, issueDate: TODAY, lines: [{ itemId: data.item.id, name: "", qty: 2, unitPrice: 30, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    rejected(() => ctx.store.tx(() => {
      ctx.store.run("UPDATE invoice_lines SET qty = 3, net = 90, payable = 90 WHERE invoice_id = ?", invoice.id);
      ctx.store.run("UPDATE accounts SET type = type WHERE id = ?", data.customer.id);
    }));
    assert.equal(ctx.store.get("SELECT qty FROM invoice_lines WHERE invoice_id = ?", invoice.id).qty, 2);
  });

  it("20. kapatılmış (kilitli dönemde) kartın tahsilatı: karta bugün tahsilat → kilit izi (vazgeçilen kalan) → 409", async () => {
    const owner = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Kapalı Kartlı", type: "customer", registeredOn: day(-60) }));
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { name: "Kapanan Kart", accountId: owner.id, total: "500", registeredOn: day(-40), count: 1, firstDue: day(-30) }));
    // Kart, sahte saatle 20 gün önce kapatılır (kapanış günü = o günün tarihi), saat geri alınır.
    ctx.server.clock.set(`${day(-20)}T12:00:00+03:00`);
    try {
      await must("kapat", ctx.api.put(`/api/workspace/plans/${plan.id}`, { status: "closed" }));
    } finally {
      ctx.server.clock.set(NOW);
    }
    assert.equal(ctx.store.get("SELECT closed_at AS c FROM plans WHERE id = ?", plan.id).c, day(-20));
    await must("kilit", ctx.api.put("/api/admin/period-lock", { lockedUntil: day(-10) }));
    try {
      rejected(() => ctx.store.tx(() => ctx.store.run("INSERT INTO plan_entries (id, plan_id, kind, amount, date, note, method, created_by, created_at) VALUES (?, ?, 'in', 50, ?, 'ham', 'cash', 'test', ?)", `pe-${randomUUID()}`, plan.id, TODAY, `${TODAY}T09:00:00Z`)), /Kapanmış dönem|geri alındı/);
    } finally {
      await must("kilidi kaldır", ctx.api.put("/api/admin/period-lock", { lockedUntil: "" }));
    }
  });

  it("süzgeç her durumda sapmayı gördü (karar tam kapının) ve normal işler yine süzgeç yolunda", async () => {
    await must("Kasa", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "1", date: TODAY, description: "son" }));
    assert.equal(gateOf(ctx.app).path, "scoped");
    await integrityOk(ctx.api, "bozma denemelerinden sonra");
  });
});

describe("kapı süzgeci — store dışı yazım, çözülemeyen yazım, taban sapması", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot(PROD);
    data = await seed(ctx.api);
  });
  after(() => ctx.server.close());

  it("11. aynı bağlantıdan store dışı bozuk satır → ilgisiz API yazımı tam kapıya döner → 409 (2.0.26 gibi); satır silinince geçer", async () => {
    const { api, app, db } = ctx;
    db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('dis-yazim', 'in', 3.333, ?, 'dışarıdan', 'cash', 'test', ?)").run(TODAY, `${TODAY}T09:00:00Z`);
    const res = await api.post(`/api/workspace/accounts/${data.customer.id}/entries`, { kind: "debt", amount: "10", date: TODAY, note: "ilgisiz" });
    assert.equal(res.status, 409, JSON.stringify(res.data));
    assert.equal(gateOf(app).path, "full");
    assert.match(gateOf(app).reason, /store dışı/);
    db.prepare("DELETE FROM cash_entries WHERE id = 'dis-yazim'").run();
    await must("sonra geçer", api.post(`/api/workspace/accounts/${data.customer.id}/entries`, { kind: "debt", amount: "10", date: TODAY, note: "ilgisiz" }));
    await must("ardından süzgeç yolu", api.post(`/api/workspace/accounts/${data.customer.id}/entries`, { kind: "debt", amount: "11", date: TODAY, note: "ilgisiz 2" }));
    assert.equal(gateOf(app).path, "scoped");
  });

  it("12. başka bağlantıdan (ikinci DatabaseSync) bozuk satır → data_version → tam kapı → 409", async () => {
    const { api, app, server } = ctx;
    const other = new DatabaseSync(resolveDbPath(server.dataDir));
    try {
      other.exec("PRAGMA busy_timeout = 5000");
      other.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('baska-baglanti', 'in', 1.111, ?, 'başka bağlantı', 'cash', 'test', ?)").run(TODAY, `${TODAY}T09:00:00Z`);
    } finally {
      other.close();
    }
    const res = await api.post(`/api/workspace/accounts/${data.customer.id}/entries`, { kind: "debt", amount: "10", date: TODAY, note: "ilgisiz" });
    assert.equal(res.status, 409, JSON.stringify(res.data));
    assert.match(gateOf(app).reason, /başka bağlantı/);
    ctx.db.prepare("DELETE FROM cash_entries WHERE id = 'baska-baglanti'").run();
  });

  it("13. çözülemeyen yazım (upsert) → tam kapı", async () => {
    const { store, app, api } = ctx;
    await must("eşitle", api.post(`/api/workspace/accounts/${data.customer.id}/entries`, { kind: "debt", amount: "1", date: TODAY, note: "eşitle" }));
    store.tx(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('upsert-1', 'in', 5, ?, 'upsert', 'cash', 'test', ?) ON CONFLICT(id) DO UPDATE SET amount = excluded.amount", TODAY, `${TODAY}T09:00:00Z`));
    assert.equal(gateOf(app).path, "full");
    assert.match(gateOf(app).reason, /upsert/);
    store.raw("test: temizlik", () => store.tx(() => store.run("DELETE FROM cash_entries WHERE id = 'upsert-1'")));
  });

  it("taban sapması: açılışta kuruşu bozuk Kasa satırı → Kasa'ya dokunan yazım tam kapıda geçer (sapma büyümedi), cari yazımı süzgeç yolunda", async () => {
    const { api, app, db } = ctx;
    db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('eski-kurus', 'in', 2.222, ?, 'eski sürüm', 'cash', 'test', ?)").run(day(-3), `${TODAY}T09:00:00Z`);
    const restarted = app.integrity.start();
    assert.equal(restarted.baseline.ok, false, "açılışta sapma bulundu");
    await must("Kasa yazımı", api.post("/api/workspace/cash", { kind: "in", amount: "5", date: TODAY, description: "taban alanı" }));
    assert.equal(gateOf(app).path, "full");
    assert.match(gateOf(app).reason, /taban sapması/);
    await must("cari yazımı", api.post(`/api/workspace/accounts/${data.customer.id}/entries`, { kind: "debt", amount: "7", date: TODAY, note: "başka alan" }));
    assert.equal(gateOf(app).path, "scoped");
    rejected(() => ctx.store.tx(() => insertCash(ctx.store, { amount: 1.111 })), /Kuruş/);
    db.prepare("DELETE FROM cash_entries WHERE id = 'eski-kurus'").run();
    app.integrity.start();
  });
});

describe("kapı süzgeci — eşdeğerlik koruması (test kipi)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW });
  });
  after(() => ctx.server.close());

  it("14. süzgeç bilerek kör edilirse bozuk yazım 500 gate-equivalence ile kırılır (tam kapı her işlemde çalışır)", async () => {
    const { store, app, api } = ctx;
    await must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "10", date: TODAY, description: "x" }));
    const engine = app.integrity.scopedGate();
    const original = engine.evaluate;
    engine.evaluate = () => ({ full: "", findings: [], sections: {}, ms: 0 });
    try {
      assert.throws(() => store.raw("test: kör süzgeç", () => store.tx(() => insertCash(store, { amount: 10.005, eventId: "" }))), error => error.status === 500 && error.extra?.code === "gate-equivalence");
    } finally {
      engine.evaluate = original;
    }
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE amount = 10.005").n, 0);
  });

  it("test kipinde temiz işlemler tam kapıyla aynı karar (süzgeç sayacı)", async () => {
    const { api, app } = ctx;
    await must("Kasa", api.post("/api/workspace/cash", { kind: "out", amount: "3", date: TODAY, description: "y" }));
    assert.equal(gateOf(app).path, "full", "test kipinde tam kapı da çalışır");
    assert.ok((app.integrity.stats().tally.temiz || 0) >= 1);
  });
});

