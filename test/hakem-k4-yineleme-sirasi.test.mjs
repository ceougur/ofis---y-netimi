// Hakem K4 (10.10.2026; docs/kanit/2026-10-10/kahin/hakem-hukumleri.json → KAHIN-A-YINELEME-SIRASI, yan bulgu): Kasa'yı tam sıfırlayan
// nakit çıkış aynı istek kimliğiyle yinelenince program yinelemeyi tanımadan Kasa ön denetimine takılıyordu (Uyar: 409 cash-negative,
// Engelle: 409 cash-blocked). Kasa ön denetimi bank.post'taki istek kimliği bakışından ÖNCE çalışıyordu. Para çift yazılmıyordu ama kullanıcı
// kaydedilmiş ödemeyi kaydedilmedi sanıp yeni formla (yeni kimlik) yeniden girerse çift ödeme olurdu.
// Plan (docs/BANKA-MODULU-PLAN.md) §3.3: "1 requests.lookup … 2 prepare … 8 guardFinal"; "Hedef kuralları, eksi bakiye ve benzer işlem işlemin
// içindedir (C12)". Banka hesabında aynı durum doğru çalışıyordu (K7 bank.post adım 8'de) — karşılaştırma testi aşağıda.
//
// Nasıl bozarım (önce yazıldı; testler buradan):
//   B1 Cari nakit ödemesi Kasa'yı 0'a indirir; aynı kimlikle yeniden gönder → 409 "Kasa eksiye düşer"? (beklenen: 200 replayed, tek satır)
//   B2 Kasadan Bankaya Yatır aynı kimlikle yeniden (hesapsız eski kurulum gibi)
//   B3 Taksit iadesi kartın net tahsilatını ve Kasa'yı 0'a indirir; yeniden gönder → "iade tahsil edilenden fazla" ya da 409? (komşu: aynı sıra)
//   B4 Stok nakit alımı Kasa'yı 0'a indirir; yeniden gönder
//   B5 Kasa elle çıkış (K3'ten sonra kimlik alıyor) Kasa'yı 0'a indirir; yeniden gönder
//   B6 Stoğu bitiren satış (komşu: stok ön denetimi de lookup'tan önceydi) yeniden gönder → 409 stock-negative?
//   B7 Engelle politikasında B1 → 409 cash-blocked?
//   B8 Çek ödemesi (Kasa denetimi yazımın içinde, lookup'tan sonra) — karşılaştırma: zaten doğru olmalı
//   B9 Banka hesabında aynı durum (K7 adım 8) — karşılaştırma: zaten doğru olmalı (v2.0.26'da banka modülü yok → atlanır)
//   B10 Yinelemeden sonra YENİ kimlikle aynı ödeme hâlâ sorulur (ön denetim kaybolmadı)
// Bu dosya yalnız test/helpers.mjs kullanır: aynı dosya v2.0.26'nın gerçek koduyla da koşulur (canlı sürümde kimlik yoktu: çift yazım).
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const pad = n => String(n).padStart(2, "0");
const day = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const YESTERDAY = day(-1);
const EARLIER = day(-3);
const data = r => (r.data && r.data.ok === true ? r.data.data : r.data);
const show = r => `${r.status} ${JSON.stringify(r.data).slice(0, 400)}`;
const header = id => ({ "x-hof-request": id });

async function boot() {
  const server = await startTestServer();
  const admin = await loginAdmin(server);
  const api = {
    server,
    admin,
    async must(label, promise) {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${show(res)}`);
      return data(res);
    },
    async cash() {
      return data(await admin.get("/api/workspace/cash?method=cash")).byMethod.cash;
    },
    async seedCash(amount) {
      await api.must("Kasa'ya giriş", admin.post("/api/workspace/cash", { kind: "in", amount, date: EARLIER, description: "Sermaye", method: "cash" }));
    },
  };
  return api;
}
/** İlk istek 200; aynı kimlik + aynı gövdeyle yineleme 200 replayed, aynı kayıt. */
async function replayOk(api, label, send, idOf) {
  const first = await send();
  assert.equal(first.status, 200, `${label} ilk istek: ${show(first)}`);
  const again = await send();
  assert.equal(again.status, 200, `${label} yineleme 200 olmalı (ön denetim — Kasa, stok, iade — istek kimliğinden önce çalışmamalı): ${show(again)}`);
  assert.equal(data(again).replayed, true, `${label} yineleme replayed:true: ${show(again)}`);
  if (idOf) assert.equal(idOf(data(again)), idOf(data(first)), `${label}: yineleme ilk kaydı döndürür`);
  return { first: data(first), again: data(again) };
}

describe("K4 — Kasa'yı sıfırlayan nakit çıkışın yinelemesi (Uyar)", () => {
  // Her test kendi boş şirketinde (bir testin kırmızısı öbürünün Kasa'sını bozmasın); her testten sonra Mutabakat Testi.
  let api;
  beforeEach(async () => {
    api = await boot();
  });
  afterEach(async () => {
    const result = data(await api.admin.get("/api/workspace/ledger/integrity"));
    await api.server.close();
    assert.equal(result.ok, true, `Mutabakat Testi: ${JSON.stringify(result.failures || result).slice(0, 600)}`);
  });

  it("B1: cari nakit ödemesi 100 (Kasa 100 → 0) aynı kimlikle yeniden → 200 replayed; Kasa 0, tek satır", async () => {
    await api.seedCash("100");
    const party = await api.must("tedarikçi", api.admin.post("/api/workspace/accounts", { name: "K4 Tedarikçi", type: "supplier", registeredOn: EARLIER }));
    const body = { kind: "out", amount: "100", method: "cash", date: YESTERDAY, note: "Ödeme" };
    await replayOk(api, "cari ödeme", () => api.admin.post(`/api/workspace/accounts/${party.id}/entries`, body, header("k4-cari-odeme-0000000001")), d => d.entryId);
    assert.equal(await api.cash(), 0);
    const detail = await api.must("cari", api.admin.get(`/api/workspace/accounts/${party.id}`));
    assert.equal((detail.entries || []).filter(entry => entry.kind === "out").length, 1, "tek ödeme satırı");
  });

  it("B10: Kasa 0 iken ödeme sorulur (409 cash-negative; ön denetim kaybolmadı); onayla (cashForce) yazılır; onaylı isteğin yinelemesi de yinelemedir", async () => {
    const party = await api.must("tedarikçi 2", api.admin.post("/api/workspace/accounts", { name: "K4 Tedarikçi 2", type: "supplier", registeredOn: EARLIER }));
    const res = await api.admin.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "10", method: "cash", date: YESTERDAY }, header("k4-cari-odeme-0000000002"));
    assert.equal(res.status, 409, show(res));
    assert.equal(res.data?.code, "cash-negative");
    await api.must("Yine de Kaydet", api.admin.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "10", method: "cash", date: YESTERDAY, cashForce: true }, header("k4-cari-odeme-0000000002")));
    assert.equal(await api.cash(), -10);
    // Onaylı isteğin yinelemesi de yineleme (cashForce içerik sayılmaz).
    const again = await api.admin.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "10", method: "cash", date: YESTERDAY }, header("k4-cari-odeme-0000000002"));
    assert.equal(again.status, 200, show(again));
    assert.equal(data(again).replayed, true);
    assert.equal(await api.cash(), -10);
  });

  it("B2: Kasadan Bankaya Yatır 50 (Kasa 50 → 0) aynı kimlikle yeniden → 200 replayed; tek transfer", async () => {
    await api.seedCash("50");
    const send = () => api.admin.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "50", date: YESTERDAY, description: "Yatırma" }, header("k4-kasadan-bankaya-000001"));
    await replayOk(api, "Kasadan Bankaya", send, d => d.id);
    assert.equal(await api.cash(), 0);
    const rows = data(await api.admin.get("/api/workspace/cash?method=all")).entries.filter(entry => entry.description === "Yatırma");
    assert.equal(rows.length, 2, "transferin iki bacağı (nakit + banka), bir kez");
  });

  it("B5: Kasa elle çıkış 40 (Kasa 40 → 0) aynı kimlikle yeniden → 200 replayed", async () => {
    await api.seedCash("40");
    const send = () => api.admin.post("/api/workspace/cash", { kind: "out", amount: "40", date: YESTERDAY, description: "Kira", method: "cash" }, header("k4-kasa-elle-cikis-000001"));
    await replayOk(api, "Kasa elle çıkış", send, d => d.id);
    assert.equal(await api.cash(), 0);
  });

  it("B4: stok nakit alımı 3 × 10 (Kasa 30 → 0) aynı kimlikle yeniden → 200 replayed; stok 3", async () => {
    await api.seedCash("30");
    const item = await api.must("ürün", api.admin.post("/api/workspace/stock", { name: "K4 Ürün", unit: "Adet", unitPrice: "10" }));
    const send = () => api.admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "3", unitPrice: "10", pay: "cash", method: "cash", date: YESTERDAY }, header("k4-stok-alim-0000000001"));
    await replayOk(api, "stok alımı", send, d => d.moveId);
    assert.equal(await api.cash(), 0);
    assert.equal((await api.must("ürün", api.admin.get(`/api/workspace/stock/${item.id}`))).qty, 3);
  });

  it("B6 (komşu): stoğu bitiren satış (3 → 0) aynı kimlikle yeniden → 200 replayed (409 stock-negative değil); stok 0", async () => {
    const item = await api.must("ürün", api.admin.post("/api/workspace/stock", { name: "K4 Ürün", unit: "Adet", unitPrice: "10" }));
    await api.must("stok girişi (parasız)", api.admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "3", unitPrice: "10", pay: "none", date: EARLIER }));
    const send = () => api.admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "3", unitPrice: "12", pay: "cash", method: "cash", date: YESTERDAY }, header("k4-stok-satis-0000000001"));
    await replayOk(api, "stok satışı", send, d => d.moveId);
    assert.equal((await api.must("ürün", api.admin.get(`/api/workspace/stock/${item.id}`))).qty, 0);
    assert.equal(await api.cash(), 36);
  });

  it("B3 (komşu): taksit iadesi 80 (kartın net tahsilatı ve Kasa 80 → 0) aynı kimlikle yeniden → 200 replayed", async () => {
    const plan = await api.must("kart", api.admin.post("/api/workspace/plans", { name: "K4 Öğrenci", total: "500", registeredOn: EARLIER }));
    await api.must("tahsilat", api.admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "80", method: "cash", date: EARLIER }));
    assert.equal(await api.cash(), 80);
    const send = () => api.admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "out", amount: "80", method: "cash", date: YESTERDAY }, header("k4-taksit-iade-000000001"));
    await replayOk(api, "taksit iadesi", send, d => d.entryId);
    assert.equal(await api.cash(), 0);
    const card = await api.must("kart", api.admin.get(`/api/workspace/plans/${plan.id}`));
    assert.equal((card.entries || []).filter(entry => entry.kind === "out").length, 1, "tek iade satırı");
  });

  it("B8 (karşılaştırma): verilen çekin nakit ödemesi (Kasa 70 → 0) yeniden → 200 replayed (Kasa denetimi yazımın içinde)", async () => {
    await api.seedCash("70");
    const party = await api.must("tedarikçi 3", api.admin.post("/api/workspace/accounts", { name: "K4 Çek Tedarikçisi", type: "supplier", registeredOn: EARLIER }));
    const cheque = await api.must("çek verildi", api.admin.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "70", issueDate: EARLIER, dueDate: day(10), accountId: party.id, serialNo: "K4-C-1" }));
    const send = () => api.admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "pay", date: YESTERDAY, method: "cash", status: cheque.status }, header("k4-cek-odeme-00000000001"));
    await replayOk(api, "çek ödemesi", send, d => d.id);
    assert.equal(await api.cash(), 0);
  });

});

describe("K4 — Engelle politikasında yineleme", () => {
  let api;
  before(async () => {
    api = await boot();
    await api.must("Engelle", api.admin.put("/api/admin/negative-policy", { cash: "block" }));
  });
  after(() => api.server.close());

  it("B7: Kasa Engelle; cari nakit ödemesi Kasa'yı 0'a indirir; aynı kimlikle yeniden → 200 replayed (409 cash-blocked değil)", async () => {
    await api.seedCash("100");
    const party = await api.must("tedarikçi", api.admin.post("/api/workspace/accounts", { name: "K4 Engelle", type: "supplier", registeredOn: EARLIER }));
    const body = { kind: "out", amount: "100", method: "cash", date: YESTERDAY };
    await replayOk(api, "Engelle cari ödeme", () => api.admin.post(`/api/workspace/accounts/${party.id}/entries`, body, header("k4-engelle-odeme-00000001")), d => d.entryId);
    // "Yine de Kaydet" (cashForce) ile yineleme de yineleme; Engelle'de yeni ödeme ise yazılmaz.
    const forced = await api.admin.post(`/api/workspace/accounts/${party.id}/entries`, { ...body, cashForce: true }, header("k4-engelle-odeme-00000001"));
    assert.equal(forced.status, 200, show(forced));
    assert.equal(data(forced).replayed, true);
    const fresh = await api.admin.post(`/api/workspace/accounts/${party.id}/entries`, body, header("k4-engelle-odeme-00000002"));
    assert.equal(fresh.status, 409, show(fresh));
    assert.equal(fresh.data?.code, "cash-blocked");
    assert.equal(await api.cash(), 0);
  });
});

describe("K4 — karşılaştırma: banka hesabında aynı durum (K7 bank.post adım 8)", () => {
  let api;
  let bankReady = false;
  before(async () => {
    api = await boot();
    const opened = await api.admin.post("/api/workspace/bank/accounts", { bankName: "K4 Bankası", name: "Vadesiz", kind: "demand", currency: "TRY", opening: { date: EARLIER, amount: "100", confirmed: true } });
    bankReady = opened.status === 200;
    api.account = data(opened);
  });
  after(() => api.server.close());

  it("B9: havale ödemesi hesabı 100 → 0 indirir; aynı kimlikle yeniden → 200 replayed", async t => {
    if (!bankReady) return t.skip("banka modülü yok (v2.0.26)");
    const party = await api.must("tedarikçi", api.admin.post("/api/workspace/accounts", { name: "K4 Banka Tedarikçisi", type: "supplier", registeredOn: EARLIER }));
    const body = { kind: "out", amount: "100", method: "bank", bankAccountId: api.account.id, date: YESTERDAY };
    await replayOk(api, "havale ödemesi", () => api.admin.post(`/api/workspace/accounts/${party.id}/entries`, body, header("k4-banka-odeme-000000001")), d => d.entryId);
    assert.equal((await api.must("hesap", api.admin.get(`/api/workspace/bank/accounts/${api.account.id}`))).balanceMinor, 0);
  });
});
