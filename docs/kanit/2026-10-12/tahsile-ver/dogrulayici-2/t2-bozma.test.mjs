// Bağımsız doğrulayıcı (tur 2) — Bankaya Tahsile Ver "nasıl bozarım": tur 1 testlerinde OLMAYAN yollar. Kod değiştirmez; yalnız API'den
// dener, yanıt kodu + gövde + veri tabanı sayısı + Mutabakat Testi okur. Sahte saat 08.10.2026 (test sunucusu; gateVerify açık: süzgeç ↔ tam kapı).
// Koşum (worktree kökünden): node --test --test-concurrency=1 docs/kanit/2026-10-12/tahsile-ver/dogrulayici-2/t2-bozma.test.mjs
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { subBalances as journalSubs } from "../../../../../server/lib/general-ledger.mjs";
import { ADMIN_PASSWORD } from "../../../../../test/helpers.mjs";
import { integrityOf } from "../../../../../test/banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, lockPeriod, must, openAcceptanceAccounts, openAccount } from "../../../../../test/banka-210-hesap-ortak.mjs";

const CHEQUES = "/api/workspace/cheques";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const count = (store, table, where = "1") => Number(store.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).n);
const TABLES = ["cheques", "cheque_events", "cheque_collections", "fin_events", "account_entries", "plan_entries", "invoices", "bank_accounts"];
const snapshot = store => Object.fromEntries(TABLES.map(table => [table, count(store, table)]));
const receive = (api, body) => must(`çek al ${body.serialNo || ""}`, api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", ...body }));
const log = (label, value) => console.log(`[t2] ${label}: ${JSON.stringify(value)}`);
const short = res => ({ status: res.status, code: res.code, error: res.error });
async function integrityState(api, label) {
  const result = await integrityOf(api);
  const bad = (result.checks || []).filter(item => item.ok === false).map(item => ({ code: item.code, sample: item.sample, items: (item.items || []).slice(0, 3) }));
  log(`mutabakat ${label}`, { ok: result.ok, bad });
  return result;
}
const subsOf = ctx => {
  const subs = journalSubs(ctx.app.ledger.build());
  return { "101.01": (subs.get("101.01") || 0) / 100, "101.02": (subs.get("101.02") || 0) / 100 };
};
async function setup(options = {}) {
  const ctx = await bootBank(options);
  const acc = await openAcceptanceAccounts(ctx.api);
  const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  return { ctx, acc, buyer, seller };
}

describe("A — hesap kartı: kapanmış tahsil kaydı olan hesabı sil / türünü / para birimini değiştir", () => {
  let t;
  before(async () => (t = await setup()));
  after(() => t.ctx.server.close());

  it("A1 deposit → withdraw → hesabı sil; A2 deposit → withdraw → tür Vadeli / para birimi USD; A22 deposit → bounce → hesabı sil → bounce Geri Al", async () => {
    const { api, store } = t.ctx;
    // Hareketsiz yeni hesaplar (açılış 0).
    const halk = await openAccount(api, { bankName: "Halkbank", name: "Çek Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const vakif = await openAccount(api, { bankName: "VakıfBank", name: "Çek Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const isb = await openAccount(api, { bankName: "İş Bankası", name: "Çek Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const a = await receive(api, { serialNo: "A1", accountId: t.buyer.id });
    await must("A1 ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: halk.id }));
    await must("A1 geri al", act(api, a.id, { action: "bank-withdraw", date: "2026-10-07" }));
    const del = await api.del(`${BANK}/accounts/${halk.id}`);
    log("A1 kapanmış kaydı olan hesabı sil", short(del));
    await integrityState(api, "A1 sonrası");
    // İşlem Kartı (silinmiş hesabın tahsile verme başlığı)
    const dep = store.get("SELECT no FROM fin_events WHERE type = 'cheque_deposit' AND cheque_id = ?", a.id);
    const card = await api.get(`${BANK}/events/${dep.no}`);
    log("A1 İşlem Kartı (silinmiş hesap)", { status: card.status, lines: card.data?.lines?.map(l => [l.sub, l.side, l.tryMinor]), source: card.data?.source });
    const detail = await api.get(`${CHEQUES}/${a.id}`);
    log("A1 çek kartı geçmişi", { status: detail.status, collections: detail.data?.collections?.map(c => [c.status, c.bankLabel]) });

    const b = await receive(api, { serialNo: "A2", accountId: t.buyer.id });
    await must("A2 ver", act(api, b.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: vakif.id }));
    await must("A2 geri al", act(api, b.id, { action: "bank-withdraw", date: "2026-10-07" }));
    const term = await api.put(`${BANK}/accounts/${vakif.id}`, { kind: "term" });
    log("A2 tür Vadeli", short(term));
    await integrityState(api, "A2 Vadeli sonrası");
    const usd = await api.put(`${BANK}/accounts/${vakif.id}`, { kind: "demand", currency: "USD" });
    log("A2 para birimi USD", short(usd));
    await integrityState(api, "A2 USD sonrası");

    const c = await receive(api, { serialNo: "A22", accountId: t.buyer.id, amount: "600" });
    await must("A22 ver", act(api, c.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: isb.id }));
    await must("A22 karşılıksız", act(api, c.id, { action: "bounce", date: "2026-10-07" }));
    const del2 = await api.del(`${BANK}/accounts/${isb.id}`);
    log("A22 karşılıksız kaydı olan hesabı sil", short(del2));
    await integrityState(api, "A22 sil sonrası");
    const undo = await api.post(`${CHEQUES}/${c.id}/undo`, {});
    log("A22 karşılıksızı geri al (hesap silinmiş)", short(undo));
    log("A22 kayıt", store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", c.id));
    await integrityState(api, "A22 sonrası");
    log("101 alt hesapları", subsOf(t.ctx));
  });
});

describe("B — dönem kilidi, açılışsız hesap, sıfırlama (Tümünü Sıfırla)", () => {
  let t;
  before(async () => (t = await setup()));
  after(() => t.ctx.server.close());

  it("A4 karşılıksız kilitli günde → Geri Al reddedilir; A21 kilit sonrası tahsil/geri al/geri al; A6 açılışsız hesap", async () => {
    const { api, store } = t.ctx;
    const a = await receive(api, { serialNo: "K1", accountId: t.buyer.id, issueDate: "2026-10-02" });
    await must("K1 ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: t.acc.ziraat.id }));
    await must("K1 karşılıksız", act(api, a.id, { action: "bounce", date: "2026-10-06" }));
    const b = await receive(api, { serialNo: "K2", accountId: t.buyer.id, issueDate: "2026-10-02", amount: "700" });
    await must("K2 ver", act(api, b.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: t.acc.ziraat.id }));
    await lockPeriod(api, "2026-10-06");
    const undo = await api.post(`${CHEQUES}/${a.id}/undo`, {});
    log("A4 kilitli karşılıksızı geri al", short(undo));
    log("A4 kayıt", store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", a.id));
    const before_ = snapshot(store);
    const due = await api.put(`${CHEQUES}/${b.id}`, { dueDate: "2026-11-30" });
    log("A21 kilitli verilişli tahsildeki çekin vadesi", short(due));
    const note = await api.put(`${CHEQUES}/${b.id}`, { note: "kilitten sonra açıklama", serialNo: "K2-b" });
    log("A21 açıklama/no", short(note));
    await must("A21 tahsil", act(api, b.id, { action: "collect", date: "2026-10-07" }));
    await must("A21 tahsili geri al", api.post(`${CHEQUES}/${b.id}/undo`, {}));
    log("A21 kayıt yeniden bekleyen", store.get("SELECT status, given_date AS g FROM cheque_collections WHERE cheque_id = ?", b.id));
    const wd = await act(api, b.id, { action: "bank-withdraw", date: "2026-10-06" });
    log("A21 kilitli güne geri al", short(wd));
    await must("A21 geri al 08.10", act(api, b.id, { action: "bank-withdraw", date: "2026-10-08" }));
    await integrityState(api, "kilit senaryosu");
    log("sayılar", { before_, after_: snapshot(store) });

    // A6: açılışsız hesap → verme → Açılış Bakiyesi Gir verişten sonraki güne
    const bare = await api.post(`${BANK}/accounts`, { bankName: "Denizbank", name: "Açılışsız", kind: "demand", currency: "TRY" });
    log("A6 açılışsız hesap", { status: bare.status, code: bare.code, openingDate: bare.data?.openingDate });
    if (bare.status === 200) {
      const c = await receive(api, { serialNo: "K3", accountId: t.buyer.id, issueDate: "2026-10-07", amount: "300" });
      const dep = await act(api, c.id, { action: "bank-deposit", date: "2026-10-07", bankAccountId: bare.data.id });
      log("A6 açılışsız hesaba ver", short(dep));
      const open = await api.post(`${BANK}/accounts/${bare.data.id}/opening`, { date: "2026-10-08", amount: "0", confirmed: true });
      log("A6 Açılış Bakiyesi Gir (verişten sonra)", short(open));
      await integrityState(api, "A6 sonrası");
    }
  });

  it("A7 Tümünü Sıfırla (mode all) tahsildeki evrakla", async () => {
    const { api, store } = t.ctx;
    const c = await receive(api, { serialNo: "R1", accountId: t.buyer.id, issueDate: "2026-10-07", amount: "450" });
    const dep = await act(api, c.id, { action: "bank-deposit", date: "2026-10-08", bankAccountId: t.acc.garanti.id });
    log("A7 ver", short(dep));
    const reset = await api.post("/api/companies/sirket-001/reset", { mode: "all", confirm: "001", password: ADMIN_PASSWORD });
    log("A7 sıfırla all", short(reset));
    log("A7 sayılar", { ...snapshot(store) });
    await integrityState(api, "A7 sonrası");
  });
});

describe("C — fatura yolu: alış faturasıyla tahsildeki çeki ciro (API)", () => {
  let t;
  before(async () => (t = await setup()));
  after(() => t.ctx.server.close());

  it("A5 alış faturası payment.endorse = tahsildeki çek → reddedilmeli; hiçbir şey yazılmamalı", async () => {
    const { api, store } = t.ctx;
    const a = await receive(api, { serialNo: "E1", accountId: t.buyer.id, amount: "1.200" });
    await must("E1 ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: t.acc.ziraat.id }));
    const before_ = snapshot(store);
    const doc = await api.post("/api/workspace/invoices", { kind: "purchase", accountId: t.seller.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 1200, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [a.id], rest: "open" }, force: true });
    log("A5 alış faturası ciro tahsildeki", short(doc));
    log("A5 sayılar önce/sonra", { before_, after_: snapshot(store) });
    log("A5 çek durumu", store.get("SELECT status, endorse_account_id AS e FROM cheques WHERE id = ?", a.id));
    // Taslak kaydı + taslağı kaydet (issue)
    const draft = await api.post("/api/workspace/invoices", { kind: "purchase", accountId: t.seller.id, issueDate: TODAY, pricesIncludeVat: true, draft: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 1200, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [a.id], rest: "open" }, force: true });
    log("A5 taslak", { ...short(draft), id: draft.data?.id, status: draft.data?.status });
    await integrityState(api, "A5 sonrası");
  });
});

describe("D — bozuk girdi", () => {
  let t;
  let cheque;
  before(async () => {
    t = await setup();
    cheque = await receive(t.ctx.api, { serialNo: "G1", accountId: t.buyer.id });
  });
  after(() => t.ctx.server.close());

  it("A9 bankAccountId / date / note / action bozuk", async () => {
    const { api, store } = t.ctx;
    const before_ = snapshot(store);
    const cases = [
      ["bankAccountId nesne", { action: "bank-deposit", date: TODAY, bankAccountId: { id: t.acc.ziraat.id } }],
      ["bankAccountId dizi", { action: "bank-deposit", date: TODAY, bankAccountId: [t.acc.ziraat.id] }],
      ["bankAccountId sayı", { action: "bank-deposit", date: TODAY, bankAccountId: 12345 }],
      ["bankAccountId uzun", { action: "bank-deposit", date: TODAY, bankAccountId: "x".repeat(5000) }],
      ["bankAccountId boş dize", { action: "bank-deposit", date: TODAY, bankAccountId: "" }],
      ["date 13. ay", { action: "bank-deposit", date: "2026-13-01", bankAccountId: t.acc.ziraat.id }],
      ["date sayı", { action: "bank-deposit", date: 20261008, bankAccountId: t.acc.ziraat.id }],
      ["date nesne", { action: "bank-deposit", date: { a: 1 }, bankAccountId: t.acc.ziraat.id }],
      ["date TR biçim", { action: "bank-deposit", date: "08.10.2026", bankAccountId: t.acc.ziraat.id }],
      ["note uzun", { action: "bank-deposit", date: TODAY, bankAccountId: t.acc.ziraat.id, note: "n".repeat(5000) }],
      ["note HTML", { action: "bank-deposit", date: TODAY, bankAccountId: t.acc.ziraat.id, note: "<img src=x onerror=alert(1)>" }],
      ["action boşluklu", { action: " bank-deposit", date: TODAY, bankAccountId: t.acc.ziraat.id }],
      ["action __proto__", { action: "__proto__", date: TODAY, bankAccountId: t.acc.ziraat.id }],
      ["action constructor", { action: "constructor", date: TODAY, bankAccountId: t.acc.ziraat.id }],
      ["action toString", { action: "toString", date: TODAY, bankAccountId: t.acc.ziraat.id }],
      ["withdraw portföyde", { action: "bank-withdraw", date: TODAY }],
    ];
    for (const [label, body] of cases) {
      const res = await act(api, cheque.id, body);
      log(`A9 ${label}`, { ...short(res), collection: res.data?.collection?.id ? "yazıldı" : undefined });
      if (res.status === 200 && body.action === "bank-deposit") {
        log(`A9 ${label} kayıt`, store.get("SELECT bank_account_id AS b, given_date AS g, status FROM cheque_collections WHERE cheque_id = ? ORDER BY rowid DESC", cheque.id));
        await must("geri al", act(api, cheque.id, { action: "bank-withdraw", date: TODAY }));
      }
    }
    log("A9 sayılar önce/sonra", { before_, after_: snapshot(store) });
    await integrityState(api, "A9 sonrası");
  });
});

describe("E — aynı anda (yarış): tahsile ver ↔ düzenle / sil / fatura iptal", () => {
  let t;
  before(async () => (t = await setup()));
  after(() => t.ctx.server.close());

  it("A12 eşzamanlı istekler: her yarışta yalnız biri geçer, Mutabakat tamam", async () => {
    const { api, store } = t.ctx;
    for (let round = 0; round < 6; round += 1) {
      const c = await receive(api, { serialNo: `Y${round}`, accountId: t.buyer.id, amount: "800" });
      const [dep, put, del] = await Promise.all([
        act(api, c.id, { action: "bank-deposit", date: TODAY, bankAccountId: t.acc.ziraat.id }),
        api.put(`${CHEQUES}/${c.id}`, { amount: "850" }),
        round % 2 ? api.del(`${CHEQUES}/${c.id}`) : Promise.resolve({ status: 0 }),
      ]);
      const row = store.get("SELECT amount, deleted_at AS d FROM cheques WHERE id = ?", c.id);
      const k = store.get("SELECT status FROM cheque_collections WHERE cheque_id = ? ORDER BY rowid DESC", c.id);
      log(`A12 tur ${round}`, { dep: short(dep).status, depCode: dep.code, put: put.status, putCode: put.code, del: del.status, delCode: del.code, amount: row.amount, deleted: Boolean(row.d), kayit: k?.status || null });
    }
    // Faturadan gelen çek: tahsile ver ↔ fatura iptal
    for (let round = 0; round < 4; round += 1) {
      const doc = await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: t.buyer.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 2000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "2.000", dueDate: "2026-11-20", serialNo: `F${round}`, bank: "İş Bankası" }], endorse: [], rest: "open" }, force: true }));
      const chequeId = store.get("SELECT id FROM cheques WHERE invoice_id = ?", doc.id).id;
      const [dep, cancel] = await Promise.all([
        act(api, chequeId, { action: "bank-deposit", date: TODAY, bankAccountId: t.acc.garanti.id }),
        api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "yarış" }),
      ]);
      log(`A12 fatura tur ${round}`, { dep: dep.status, depCode: dep.code, cancel: cancel.status, cancelCode: cancel.code, invoice: store.get("SELECT status FROM invoices WHERE id = ?", doc.id).status, cheque: store.get("SELECT deleted_at AS d FROM cheques WHERE id = ?", chequeId).d ? "silindi" : "duruyor", kayit: store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", chequeId)?.status || null });
    }
    await integrityState(api, "A12 sonrası");
  });
});

describe("F — çok tur: ver / geri al / başka hesaba ver / tahsil / geri al; raporlar 101.02 ile", () => {
  let t;
  before(async () => (t = await setup()));
  after(() => t.ctx.server.close());

  it("A10/A15/A16/A23 döngü ve raporlar", async () => {
    const { api, store } = t.ctx;
    const c = await receive(api, { serialNo: "D1", accountId: t.buyer.id, amount: "1.234,56" });
    for (let i = 0; i < 5; i += 1) {
      await must(`ver ${i}`, act(api, c.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: i % 2 ? t.acc.garanti.id : t.acc.ziraat.id }));
      await must(`geri al ${i}`, act(api, c.id, { action: "bank-withdraw", date: "2026-10-06" }));
    }
    await must("son ver", act(api, c.id, { action: "bank-deposit", date: "2026-10-07", bankAccountId: t.acc.garanti.id }));
    const garantiBefore = (await must("garanti", api.get(`${BANK}/accounts/${t.acc.garanti.id}`))).balanceMinor;
    const mv = await api.get(`${BANK}/movements?account=${t.acc.garanti.id}`);
    log("A16 Garanti Hareketler (tahsile verme satırları?)", { status: mv.status, rows: (mv.data?.rows || mv.data?.movements || []).map(r => [r.no, r.type, r.typeLabel, r.amountMinor ?? r.tryMinor ?? r.amount, r.balanceMinor ?? r.balance]).slice(0, 20) });
    const rep = await api.get(`/api/workspace/report-center/banka-hareket?bankAccountId=${t.acc.garanti.id}&preset=thisYear`);
    log("A16 Banka Hareket raporu", { status: rep.status, rows: rep.data?.rows?.slice(0, 20), summary: rep.data?.summary });
    const tah = await api.get("/api/workspace/report-center/tahsildeki-cekler");
    log("A15 Tahsildeki raporu", { status: tah.status, rows: tah.data?.rows, summary: tah.data?.summary });
    log("A15 101 alt hesap (defter)", subsOf(t.ctx));
    await must("tahsil", act(api, c.id, { action: "collect", date: "2026-10-08" }));
    log("A10 tahsil sonrası kayıtlar", store.all("SELECT status, bank_account_id = ? AS garanti FROM cheque_collections WHERE cheque_id = ? ORDER BY rowid", t.acc.garanti.id, c.id).map(r => `${r.status}${r.garanti ? "(G)" : "(Z)"}`));
    const garantiAfter = (await must("garanti", api.get(`${BANK}/accounts/${t.acc.garanti.id}`))).balanceMinor;
    log("A10 Garanti bakiye önce/sonra (kuruş)", { garantiBefore, garantiAfter });
    await must("tahsili geri al", api.post(`${CHEQUES}/${c.id}/undo`, {}));
    log("A10 geri al sonrası kayıtlar", store.all("SELECT status FROM cheque_collections WHERE cheque_id = ? ORDER BY rowid", c.id).map(r => r.status));
    const hareket = await api.get("/api/workspace/report-center/cek-hareketleri?preset=thisYear");
    log("A23 Çek Hareketleri", { status: hareket.status, n: hareket.data?.rows?.length, kinds: hareket.data?.rows?.map(r => r[4]) });
    log("A15 101 alt hesap (defter) son", subsOf(t.ctx));
    await integrityState(api, "F sonrası");
  });
});
