// 2.4.4 G1 (madde 30 göç karşılaştırması, m30-yeniden-uret.mjs g1): Silinenler'den geri yükleme kapanmış (kilitli) dönemi aşmamalı.
// Önceki davranış (2.4.3 ve aday 10): açık dönemde silinmiş fatura, dönem kilitlendikten sonra Silinenler'den geri yükleniyordu (200). Belge kapıdan
// geçmeden kilitli döneme yazılıyordu (invoices, kapının izlediği tablolarda değil); Mutabakat Testi "Kapanmış dönem … değişemez" sapması veriyor,
// sonraki para işlemleri tam kapıda 409 (test kipinde 500 gate-equivalence) alıyordu. Öbür Silinenler kolları kilidi zaten denetliyor.
//
// NASIL BOZULUR (koddan ÖNCE yazıldı):
//  1. Sil (açık dönem) → kilit → geri yükle: kaydedilmiş satış, peşin satış, alış, satıştan iade, önce İptal sonra Sil, kilit günüyle aynı gün → 409
//     period-locked, öbür kollarla aynı ileti; belge Silinenler'de kalır, Fatura listesine dönmez.
//  2. Kilitli tarihli TASLAK → 200, taslak döner (kilit izi taslağı saymaz; silmede de serbest).
//  3. Kilit sonrası tarihli belge → 200, "İptal Edildi" (etkisiz) döner.
//  4. Kilit açılınca kilitli tarihli belge geri yüklenir; kilit yeniden konunca Mutabakat Testi temiz.
//  5. Reddedilen denemeden sonra Mutabakat Testi temiz; test kipinde (gateVerify) Kasa girişi ve peşin satış 200.
//  6. Öbür kollar aynı sırayla (sil → kilit → geri yükle): Kasa, kayıt tahsilatı, cari hareketi, stok hareketi, taksit hareketi, çek/senet, taksit kartı →
//     409 period-locked, aynı ileti kalıbı; kilit sonrası eşleri 200. (Cari: test/asama0-226 A3; şüpheli alacak: test/banka-230-supheli-bozma.)
//  7. Sıra: numarası başka belgede olan (kalıcı ret) kilitli belge → önce invoice-number-taken (kilidi açtırıp sonra reddetmeyiz).
//  8. Üretim kipi (gateVerify kapalı) aynı: 409, sonraki Kasa girişi 200, Mutabakat Testi temiz.
// Tarih sahte saatle (config.now) sabit: ders 13.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { apiOf } from "./banka-210-ortak.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-08";
const NOW = `${TODAY}T12:00:00+03:00`;
const LOCK = "2026-09-30";
const LOCKED_DAY = "2026-09-15";
const OPEN_DAY = "2026-10-05";
const day = iso => iso.split("-").reverse().join(".");
// Öbür kolların (period.assertOpen) ileti kalıbı: "Bu <ne> GG.AA.YYYY tarihli; 30.09.2026 ve öncesi kapatılmış (kilitli) dönemdir. …"
const LOCK_TEXT = new RegExp(`^Bu .+ \\d{2}\\.\\d{2}\\.\\d{4} tarihli; ${day(LOCK).replace(/\./g, "\\.")} ve öncesi kapatılmış \\(kilitli\\) dönemdir\\. Değişiklik için yönetici dönem kilidini açmalı\\.$`);
const LINE = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const REASON = encodeURIComponent("G1 deneme");

async function boot(options = {}) {
  const server = await startTestServer({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, ...options });
  const api = apiOf(await loginAdmin(server));
  return { server, api, store: server.app.store };
}
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
  return res.data;
};
const refused = async (label, promise, status, code) => {
  const res = await promise;
  assert.equal(res.status, status, `${label}: ${status} beklendi, ${res.status} geldi (${res.code || ""}) ${String(res.error || JSON.stringify(res.data)).slice(0, 400)}`);
  assert.equal(res.code, code, `${label}: kod ${code} beklendi, ${res.code} geldi — ${String(res.error || "").slice(0, 300)}`);
  return res;
};
const integrityOk = async (api, label) => {
  const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  assert.equal(result.ok, true, `${label}: Mutabakat Testi bozuk ${JSON.stringify(result.failures).slice(0, 700)}`);
};
const setLock = (api, date) => must(`kilit ${date || "kaldır"}`, api.put("/api/admin/period-lock", { lockedUntil: date }));
const openTrash = (store, ref) => store.get("SELECT id FROM trash WHERE ref = ? AND restored_at IS NULL ORDER BY deleted_at DESC LIMIT 1", ref);
const trashId = (store, ref) => {
  const row = openTrash(store, ref);
  assert.ok(row, `Silinenler'de ${ref} bulunmalı`);
  return `trash:${row.id}`;
};
const invoiceRow = (store, id) => {
  const row = store.get("SELECT status, issue_date AS issueDate FROM invoices WHERE id = ?", id);
  return row ? { ...row } : undefined;
};

/** Faturalar ve öbür kollar: hepsi açık dönemde silinir, SONRA kilit konur (G1'in sırası). */
async function prepare(ctx) {
  const { api } = ctx;
  const customer = await must("müşteri", api.post("/api/workspace/accounts", { name: "G1 Müşteri", type: "customer", registeredOn: "2026-01-01" }));
  const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "G1 Tedarikçi", type: "supplier", registeredOn: "2026-01-01" }));
  const sale = (issueDate, extra = {}) => must(`satış ${issueDate}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate, lines: LINE, payment: { rest: "open" }, force: true, ...extra }));
  const remove = (label, id) => must(`${label} sil`, api.del(`/api/workspace/invoices/${id}?reason=${REASON}&force=1&cashForce=1`));
  const inv = {};
  // Seri kronolojisi: belgeler tarih sırasıyla kaydedilir (numara ve tarih sırası uyuşmalı).
  const base = await sale("2026-09-10");
  inv.sale = await sale(LOCKED_DAY);
  inv.cashSale = await sale(LOCKED_DAY, { payment: { cash: [{ amount: 600, method: "cash" }], rest: "open" }, cashForce: true });
  inv.cancelled = await sale(LOCKED_DAY);
  await must("iptal", api.post(`/api/workspace/invoices/${inv.cancelled.id}/cancel`, { reason: "G1 iptal", force: true, cashForce: true }));
  inv.unlock = await sale(LOCKED_DAY);
  inv.taken = await sale(LOCKED_DAY);
  inv.purchase = await must("alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: supplier.id, number: "G1-AL-1", issueDate: LOCKED_DAY, lines: [{ name: "Kira", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, force: true }));
  const baseLine = (await must("iadenin satışı", api.get(`/api/workspace/invoices/${base.id}`))).lines[0].id;
  inv.ret = await must("satıştan iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: base.id, issueDate: LOCKED_DAY, number: "", lines: [{ originLineId: baseLine, qty: 1 }], payment: { rest: "open" }, force: true }));
  inv.draft = await sale(LOCKED_DAY, { status: "draft" });
  inv.edge = await sale(LOCK);
  inv.open = await sale(OPEN_DAY);
  for (const [key, doc] of Object.entries(inv)) await remove(key, doc.id);
  // Kalıcı ret sırası (madde 7): silinen belgenin numarası sonradan başka belgenin Kâğıt Fatura No'suna yazıldı (eski veride olabilen durum).
  ctx.takenNumber = inv.taken.number;
  if (ctx.takenNumber) ctx.holder = await sale(TODAY, { paperNo: ctx.takenNumber });

  // Öbür kollar: kilitli günlü ve kilit sonrası eşler.
  const other = { locked: {}, open: {} };
  const item = await must("ürün", api.post("/api/workspace/stock", { name: "G1 Ürün", unit: "Adet", unitPrice: "10" }));
  const plan = await must("kart", api.post("/api/workspace/plans", { name: "G1 Kart", total: "900", mode: "auto", count: 3, firstDue: "2026-09-01", registeredOn: "2026-09-01" }));
  let serial = 0;
  for (const [side, date] of [["locked", LOCKED_DAY], ["open", OPEN_DAY]]) {
    const out = other[side];
    const cash = await must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "300", date, description: `G1 ${side}` }));
    await must("Kasa sil", api.del(`/api/workspace/cash/${cash.id}?cashForce=1`));
    out.cash = { label: "Kasa hareketi", id: () => trashId(ctx.store, cash.id) };
    const payment = await must("kayıt tahsilatı", api.post(`/api/workspace/cases/G1-${side}/payments`, { amount: "200", date, caseTitle: "G1" }));
    await must("tahsilat sil", api.del(`/api/workspace/payments/${payment.id}?cashForce=1`));
    out.payment = { label: "kayıt tahsilatı", id: () => trashId(ctx.store, payment.id) };
    const entry = await must("cari borcu", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "150", date }));
    await must("cari borcu sil", api.del(`/api/workspace/accounts/${customer.id}/entries/${entry.entryId}`));
    out.entry = { label: "cari hareketi", id: () => trashId(ctx.store, entry.entryId) };
    const move = await must("stok girişi", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "5", unitPrice: "10", pay: "none", date }));
    await must("stok girişi sil", api.del(`/api/workspace/stock/${item.id}/moves/${move.moveId}?cashForce=1`));
    out.move = { label: "stok hareketi", id: () => trashId(ctx.store, move.moveId) };
    const planEntry = await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", date }));
    await must("taksit tahsilatı sil", api.del(`/api/workspace/plans/${plan.id}/entries/${planEntry.entryId}?cashForce=1`));
    out.planEntry = { label: "taksit hareketi", id: () => trashId(ctx.store, planEntry.entryId) };
    const cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.500", issueDate: date, dueDate: "2026-12-31", drawer: "Keşideci", serialNo: `G1-${(serial += 1)}`, bank: "Ziraat" }));
    await must("çek sil", api.del(`/api/workspace/cheques/${cheque.id}`));
    out.cheque = { label: "çek/senet", id: () => `cheque:${cheque.id}` };
    const card = await must("silinecek kart", api.post("/api/workspace/plans", { name: `G1 Silinen Kart ${side}`, total: "600", mode: "auto", count: 2, firstDue: date, registeredOn: date }));
    await must("kart sil", api.del(`/api/workspace/plans/${card.id}?cashForce=1`));
    out.plan = { label: "taksit kartı", id: () => `plan:${card.id}` };
  }
  await setLock(api, LOCK);
  return { customer, inv, other };
}

describe("G1 — Silinenler'den geri yükleme kapanmış (kilitli) döneme belge döndürmez (test kipi: kapı eşdeğerlik denetimi açık)", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot();
    data = await prepare(ctx);
  });
  after(async () => ctx?.server.close());
  const restore = id => ctx.api.post("/api/admin/trash/restore", { id });

  it("kilitli tarihli kaydedilmiş belge (satış, peşin satış, alış, satıştan iade, iptal edilmiş, kilit günü) → 409 period-locked, öbür kollarla aynı ileti; Silinenler'de kalır", async () => {
    const cases = [
      ["sale", "Bu satış faturası", LOCKED_DAY],
      ["cashSale", "Bu satış faturası", LOCKED_DAY],
      ["purchase", "Bu alış faturası", LOCKED_DAY],
      ["ret", "Bu satıştan iade faturası", LOCKED_DAY],
      ["cancelled", "Bu satış faturası", LOCKED_DAY],
      ["edge", "Bu satış faturası", LOCK],
    ];
    for (const [key, what, date] of cases) {
      const doc = data.inv[key];
      const res = await refused(`${key} geri yükle`, restore(trashId(ctx.store, doc.id)), 409, "period-locked");
      assert.match(res.error, LOCK_TEXT, `${key}: ileti öbür kollarla aynı kalıpta`);
      assert.ok(res.error.startsWith(`${what} ${day(date)} tarihli;`), `${key}: ileti belgenin türünü ve tarihini söyler — ${res.error}`);
      assert.equal(res.data?.lockedUntil, LOCK, `${key}: kilit tarihi yanıtta`);
      assert.ok(openTrash(ctx.store, doc.id), `${key}: belge Silinenler'de kalır`);
      assert.equal(invoiceRow(ctx.store, doc.id), undefined, `${key}: Fatura listesine dönmedi`);
    }
  });

  it("reddedilen denemelerden sonra Mutabakat Testi temiz; Kasa girişi ve peşin satış geçer (kapı 500/409 vermez)", async () => {
    await integrityOk(ctx.api, "kilitli geri yükleme denemeleri");
    await must("Kasa girişi", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "10", date: TODAY, description: "G1 sonrası" }));
    await must("peşin satış", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: data.customer.id, issueDate: TODAY, lines: LINE, payment: { cash: [{ amount: 600, method: "cash" }], rest: "open" }, force: true, cashForce: true }));
    await integrityOk(ctx.api, "sonraki işlemler");
  });

  it("öbür kollar aynı sırayla (sil → kilit → geri yükle): Kasa, kayıt tahsilatı, cari hareketi, stok hareketi, taksit hareketi, çek/senet, taksit kartı → 409 aynı ileti kalıbıyla", async () => {
    for (const [key, branch] of Object.entries(data.other.locked)) {
      const res = await refused(`${branch.label} geri yükle`, restore(branch.id()), 409, "period-locked");
      assert.match(res.error, LOCK_TEXT, `${branch.label}: ileti kalıbı (${key})`);
    }
    await integrityOk(ctx.api, "öbür kolların kilitli denemeleri");
  });

  it("kilit sonrası tarihli eşler 200; belge “İptal Edildi” (etkisiz) döner; Mutabakat Testi temiz", async () => {
    for (const branch of Object.values(data.other.open)) await must(`${branch.label} geri yükle (açık dönem)`, restore(branch.id()));
    await must("açık dönem belgesi geri yükle", restore(trashId(ctx.store, data.inv.open.id)));
    assert.deepEqual(invoiceRow(ctx.store, data.inv.open.id), { status: "cancelled", issueDate: OPEN_DAY });
    await integrityOk(ctx.api, "açık dönem geri yüklemeleri");
  });

  it("kilitli tarihli TASLAK geri yüklenir (200, taslak); kilit izi taslağı saymaz", async () => {
    const res = await must("taslak geri yükle", restore(trashId(ctx.store, data.inv.draft.id)));
    assert.match(res.message, /taslak/);
    assert.deepEqual(invoiceRow(ctx.store, data.inv.draft.id), { status: "draft", issueDate: LOCKED_DAY });
    await integrityOk(ctx.api, "taslak geri yükleme");
  });

  it("numarası başka belgede olan kilitli belge: önce kalıcı ret (invoice-number-taken), kilit iletisi değil", async t => {
    if (!ctx.takenNumber) return t.skip("ön koşul yok: numarasız seri");
    const res = await refused("numarası alınmış belge", restore(trashId(ctx.store, data.inv.taken.id)), 409, "invoice-number-taken");
    assert.equal(res.data?.holderId, ctx.holder.id);
  });

  it("kilit açılınca kilitli tarihli belge geri yüklenir (iptal edilmiş, etkisiz); kilit yeniden konunca Mutabakat Testi temiz, Kasa girişi geçer", async () => {
    await setLock(ctx.api, "");
    await must("kilitsiz geri yükle", restore(trashId(ctx.store, data.inv.unlock.id)));
    assert.deepEqual(invoiceRow(ctx.store, data.inv.unlock.id), { status: "cancelled", issueDate: LOCKED_DAY });
    await setLock(ctx.api, LOCK);
    await integrityOk(ctx.api, "kilit yeniden konunca");
    await must("Kasa girişi", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "5", date: TODAY, description: "G1 yeniden kilit" }));
    await integrityOk(ctx.api, "son");
  });
});

describe("G1 — üretim kipi (kapı eşdeğerlik denetimi kapalı)", () => {
  it("kilitli tarihli silinmiş satış → 409 period-locked; Mutabakat Testi temiz; sonraki Kasa girişi 200", async () => {
    const ctx = await boot({ gateVerify: false, moneyStrict: false });
    try {
      const { api, store } = ctx;
      const customer = await must("müşteri", api.post("/api/workspace/accounts", { name: "G1 Üretim", type: "customer", registeredOn: "2026-01-01" }));
      const doc = await must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: LOCKED_DAY, lines: LINE, payment: { rest: "open" }, force: true }));
      await must("sil", api.del(`/api/workspace/invoices/${doc.id}?reason=${REASON}&force=1&cashForce=1`));
      await setLock(api, LOCK);
      const res = await refused("geri yükle", api.post("/api/admin/trash/restore", { id: trashId(store, doc.id) }), 409, "period-locked");
      assert.match(res.error, LOCK_TEXT);
      assert.equal(invoiceRow(store, doc.id), undefined);
      await integrityOk(api, "üretim kipi");
      await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "10", date: TODAY, description: "G1 üretim" }));
      await integrityOk(api, "üretim kipi sonrası");
    } finally {
      await ctx.server.close();
    }
  });
});
