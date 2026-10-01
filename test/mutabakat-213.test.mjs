// 2.0.13 — mutabakat testi ve doğrulama katmanı: para taşıyan her işlem COMMIT'ten önce alt defter ↔ ana defter
// denetiminden geçer; en küçük sapmada (kuruş dahil) işlem ROLLBACK edilir ve günlüğe yazılır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { IntegrityError } from "../server/lib/integrity.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const ok = (response, label) => {
  assert.equal(response.status, 200, `${label}: ${JSON.stringify(response.data)}`);
  return response.data.data;
};

describe("mutabakat kapısı", () => {
  let server;
  let admin;
  let store;
  let tulay;
  let item;
  const count = (table, where = "1 = 1", ...args) => store.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, ...args).n;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    store = server.app.store;
    tulay = ok(await admin.post("/api/workspace/accounts", { name: "Tülay Arıkan", openingBalance: "1.250" }), "cari");
    item = ok(await admin.post("/api/workspace/stock", { name: "Süt", unit: "Lt", unitPrice: "20", salePrice: "30", openingQty: "100" }), "ürün");
    ok(await admin.post("/api/workspace/cash", { kind: "in", amount: "5.000", description: "Açılış" }), "kasa");
    ok(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "3", unitPrice: "30", pay: "account", accountId: tulay.id }), "veresiye");
    ok(await admin.post(`/api/workspace/accounts/${tulay.id}/entries`, { kind: "in", amount: "500", method: "bank" }), "havale tahsilat");
    ok(await admin.post("/api/workspace/cheques", { direction: "in", accountId: tulay.id, amount: "700", dueDate: "2026-11-01", serialNo: "M-1" }), "çek");
  });
  after(async () => server?.close());

  it("günlük iş akışından sonra tüm denetimler tutarlı", async () => {
    const result = ok(await admin.get("/api/workspace/ledger/integrity"), "mutabakat");
    assert.equal(result.ok, true, JSON.stringify(result.failures));
    const codes = result.checks.map(check => check.code);
    for (const code of ["balance", "gl:100", "gl:102", "gl:120", "gl:127", "gl:101", "cents:cash_entries", "stock:account", "stock:orphan", "cheque:account"]) assert.ok(codes.includes(code), `denetim var: ${code}`);
    assert.equal(result.log.length, 0);
  });

  it("stok hareketi olmayan cari satırı (sızıntı) yazılamaz: işlem geri alınır, günlüğe düşer", () => {
    const before = count("account_entries");
    assert.throws(
      () => store.tx(() => store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, created_by, created_at) VALUES ('sizinti', ?, 'debt', 90, '2026-09-30', 'hayalet satış', 'stock', 'olmayan-hareket', 'test', '2026-09-30T10:00:00Z')", tulay.id)),
      error => error instanceof IntegrityError && error.status === 409 && /geri alındı/.test(error.message),
    );
    assert.equal(count("account_entries"), before, "satır yazılmadı (ROLLBACK)");
    const log = store.get("SELECT action, tables, summary FROM integrity_log ORDER BY at DESC LIMIT 1");
    assert.equal(log.action, "rolled-back");
    assert.match(log.tables, /account_entries/);
    assert.match(log.summary, /Stok hareketi silinmiş cari satırı/);
  });

  it("kuruştan küçük küsurat: işlem dışı tek satır yazımı da kapıdan geçer ve geri alınır", () => {
    const before = count("cash_entries");
    assert.throws(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('kusurat', 'in', 10.005, '2026-09-30', 'yarım kuruş', 'cash', 'test', '2026-09-30T10:00:00Z')"), IntegrityError);
    assert.equal(count("cash_entries"), before);
  });

  it("çok adımlı işlemde bir adım sapma yaratırsa önceki adımlar da yazılmaz", () => {
    const entries = count("account_entries");
    const cash = count("cash_entries");
    assert.throws(
      () =>
        store.tx(() => {
          store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('adim-1', 'in', 100, '2026-09-30', 'doğru adım', 'cash', 'test', '2026-09-30T10:00:00Z')");
          store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, created_by, created_at) VALUES ('adim-2', ?, 'credit', 700.01, '2026-09-30', 'çek tutarından farklı', 'cheque', (SELECT id FROM cheques LIMIT 1), 'test', '2026-09-30T10:00:00Z')", tulay.id);
        }),
      IntegrityError,
    );
    assert.equal(count("cash_entries"), cash, "ilk adım da geri alındı");
    assert.equal(count("account_entries"), entries);
  });

  it("eski sürümden kalan sapma ilgisiz işlemleri engellemez; ama büyütülemez", async () => {
    // Kapının dışından (eski sürüm verisi gibi) bir kuruş küsuratı: kapı yeniden başlatılınca "açılışta bulunan sapma".
    store.db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('eski', 'in', 3.333, '2026-09-01', 'eski sürüm', 'cash', 'test', '2026-09-01T10:00:00Z')").run();
    const restarted = server.app.integrity.start();
    assert.equal(restarted.baseline.ok, false, "açılışta sapma bulundu");
    assert.equal(store.get("SELECT action FROM integrity_log ORDER BY at DESC LIMIT 1").action, "baseline");
    ok(await admin.post(`/api/workspace/accounts/${tulay.id}/entries`, { kind: "in", amount: "50" }), "ilgisiz tahsilat yine yapılır");
    assert.throws(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('yeni-kusurat', 'in', 1.111, '2026-09-30', 'yeni', 'cash', 'test', '2026-09-30T10:00:00Z')"), IntegrityError, "yeni sapma engellenir");
    store.db.prepare("DELETE FROM cash_entries WHERE id = 'eski'").run();
  });

  it("taksitlendirilmiş veresiye satıştan iade: taksit kartı iade kadar küçülür (kart borçtan büyük kalmaz)", async () => {
    const deniz = ok(await admin.post("/api/workspace/accounts", { name: "Deniz Ak" }), "cari");
    ok(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "3", unitPrice: "30", pay: "account", accountId: deniz.id, installments: { count: 3, firstDue: "2026-10-10" } }), "taksitli satış");
    const back = ok(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "30", pay: "account", accountId: deniz.id, reason: "return" }), "iade");
    assert.equal(back.trimmedPlans.length, 1);
    assert.equal(back.trimmedPlans[0].to, 60);
    const card = ok(await admin.get(`/api/workspace/accounts/${deniz.id}`), "kart");
    assert.equal(card.totals.balance, 60);
    const plan = ok(await admin.get(`/api/workspace/plans/${card.plans[0].id}`), "taksit kartı");
    assert.equal(plan.total, 60);
    assert.deepEqual(plan.items.map(entry => entry.amount), [30, 30], "son taksit düşüldü");
    assert.equal(ok(await admin.get("/api/workspace/ledger/integrity"), "mutabakat").failures.filter(item => !item.code.startsWith("cents:cash")).length, 0);
  });

  it("Satış Yapma yetkisi: kasiyer ürün yönetimi olmadan nakit/kart satış ve iade girer; alım giremez", async () => {
    const role = ok(await admin.post("/api/admin/roles", { name: "Kasiyer", permissions: ["stock.view", "stock.move", "stock.sell", "accounts.view"] }), "rol");
    const kasiyer = await createUser(server, admin, { username: "kasiyer1", name: "Kasiyer Bir", role: role.id });
    ok(await kasiyer.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "2", unitPrice: "30", pay: "cash", method: "card" }), "kartla satış");
    ok(await kasiyer.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "30", pay: "account", accountId: tulay.id, reason: "return" }), "iade");
    const buy = await kasiyer.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "5", unitPrice: "20", pay: "cash" });
    assert.equal(buy.status, 403, "alım (Kasa'dan ödeme) yönetim yetkisidir");
    assert.equal((await kasiyer.post("/api/workspace/stock", { name: "Yeni Ürün", unit: "Adet" })).status, 403, "ürün kartı açamaz");
    const personel = await createUser(server, admin, { username: "personel9" });
    assert.equal((await personel.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "30", pay: "cash" })).status, 403, "yetkisi olmayan para yazamaz");
  });

  it("Raporlar: Defter Mutabakatı denetimleri ve Mutabakat Günlüğü", async () => {
    const report = ok(await admin.get("/api/workspace/report-center/mutabakat-gunlugu"), "günlük");
    assert.ok(report.rows.some(row => row[1] === "Geri Alındı"));
    const gl = ok(await admin.get("/api/workspace/report-center/defter-mutabakati"), "mutabakat raporu");
    assert.ok(gl.rows.some(row => row[0] === "127"), "taksit alt defteri (carisiz kartlar)");
    assert.ok(gl.rows.some(row => /Stok ↔ cari bağı/.test(row[1])));
  });
});
