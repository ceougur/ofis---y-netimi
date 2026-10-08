// 2.0.26 — Aşama 0'ın bağımsız gözden geçirmesinde doğrulanan bulgular (docs/2.0.26-KANIT.md → "Bağımsız gözden geçirme").
// Her bulgu önce bu dosyada KIRMIZI test olarak yeniden üretildi (düzeltmeden önceki dal: a25751f), sonra düzeltildi.
// Test kuralı (CLAUDE.md): her bulgu için "çalışıyor mu" (doğru kullanım, sayılar) + "nasıl bozarım" (kilitli döneme sızdırma,
// doğrudan SQL, arayüzün gerçek gövdesi, eski sürüm verisi).
//   G1 (yüksek)  kilitli günde kapatılmış taksit kartı: yeniden açma, silme, geri yükleme, tahsilat, çek karşılıksızı; kilit izi
//   G2 (yüksek)  kilitli dönemde tahsilatı olan kartın carisi değişimi; kilit izi
//   G3 (orta)    kilitli dönemdeki kuruşlu çekte arayüzden yalnız vade düzeltme (tutar "2500,5" ≠ "2500.5" sayılıyordu)
//   G4 (orta)    eski ileri tarihli / tanınmayan yollu satır Mutabakat Testi'nde, Defter Mutabakatı'nda ve Günlük'te görünür
//   G5 (düşük)   ileri tarihli eski hareketin Silinenler'den geri yüklenmesi: nedenli 400 (kapıdaki nedensiz 409 değil)
//   G6 (düşük)   Taksite Aktar / Excel'den taksit yükleme / aktarımı geri alma dönem kilidinde nedenli
//   G7 (düşük)   silmede eksi bakiye sorusunun metni (neden düştüğü; "çıkış" değil)
//   G8 (düşük)   mahsup ve geri yükleme mesajları (arayüzdeki gerçek yol; fatura numarası)
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const pad = n => String(n).padStart(2, "0");
const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = localDay(0);
const LOCK = "2025-06-30";
const OPEN_DAY = "2025-09-10";

const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error, failures: r.data?.failures });
async function boot() {
  const server = await startTestServer();
  const client = await loginAdmin(server);
  const api = {
    get: async url => unwrap(await client.get(url)),
    post: async (url, body) => unwrap(await client.post(url, body)),
    put: async (url, body) => unwrap(await client.put(url, body)),
    del: async url => unwrap(await client.del(url)),
  };
  return { server, api, store: server.app.store, db: server.app.db };
}
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${res.code || ""} ${String(res.error || JSON.stringify(res.data)).slice(0, 500)}`);
  return res.data;
};
const refusedWith = async (label, promise, status, code) => {
  const res = await promise;
  assert.equal(res.status, status, `${label}: ${status} beklendi, ${res.status} geldi (${res.code || ""}) ${String(res.error || JSON.stringify(res.data)).slice(0, 300)}`);
  if (code) assert.equal(res.code, code, `${label}: kod ${code} beklendi, ${res.code} geldi — ${String(res.error || "").slice(0, 300)}`);
  return res;
};
const integrityOk = async (api, label) => {
  const result = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
  assert.equal(result.ok, true, `${label}: mutabakat bozuk ${JSON.stringify(result.failures).slice(0, 600)}`);
};
const setLock = (api, date) => must(`kilit ${date || "kaldır"}`, api.put("/api/admin/period-lock", { lockedUntil: date }));
const cashBalance = async api => (await must("kasa", api.get("/api/workspace/cash"))).totals.balance;
async function drainCash(api, leave = 200) {
  const amount = Math.round(((await cashBalance(api)) - leave) * 100) / 100;
  if (amount > 0) await must("kira ödemesi", api.post("/api/workspace/cash", { kind: "out", amount, date: TODAY, description: "Kira" }));
  assert.equal(await cashBalance(api), leave, "Kasa hazırlandı");
}
const trashIdOf = (store, ref) => {
  const row = store.get("SELECT id FROM trash WHERE ref = ? AND restored_at IS NULL ORDER BY deleted_at DESC LIMIT 1", ref);
  assert.ok(row, `Silinenler'de ${ref} bulunmalı`);
  return row.id;
};
const lockFailure = error => error?.extra?.code === "ledger-integrity" && (error.failures || []).some(item => item.code === "period-lock");
// Kilit tarihindeki mizan: hesap kodu → bakiye (yalnız sorulan kodlar; olmayan 0).
async function trialAt(api, day, codes) {
  const result = await must(`mizan ${day}`, api.get(`/api/workspace/ledger?to=${day}`));
  const byCode = new Map((result.trial.accounts || []).map(row => [String(row.code), row.balance]));
  return Object.fromEntries(codes.map(code => [code, byCode.get(code) || 0]));
}
const account = (api, name, type = "customer", registeredOn = "2025-01-01") => must(`cari ${name}`, api.post("/api/workspace/accounts", { name, type, registeredOn }));
const debt = (api, id, amount, date) => must("Borç Yaz", api.post(`/api/workspace/accounts/${id}/entries`, { kind: "debt", amount, date, note: "Borç" }));
const coverCard = (api, accountId, name, total, registeredOn, firstDue) => must(`kart ${name}`, api.post("/api/workspace/plans", { accountId, name, total, registeredOn, coversBalance: true, mode: "auto", count: 2, firstDue }));
const newCard = (api, accountId, name, total, registeredOn) => must(`kart ${name}`, api.post("/api/workspace/plans", { accountId, name, total, registeredOn, mode: "auto", count: 1, firstDue: registeredOn }));

// ============================================================ G1 ============================================================
describe("G1 — kilitli günde kapatılmış taksit kartı (kilit bugün)", () => {
  let ctx;
  const cards = {};
  before(async () => {
    ctx = await boot();
    const { api } = ctx;
    const a = await account(api, "G1 Ali", "customer", "2025-03-01");
    await debt(api, a.id, "1000", "2025-03-01");
    cards.cover = await coverCard(api, a.id, "G1 Mevcut Borç", "1000", "2025-03-02", "2025-04-01");
    await must("kapat", api.put(`/api/workspace/plans/${cards.cover.id}`, { status: "closed" }));
    const b = await account(api, "G1 Veli", "customer", TODAY);
    cards.fresh = await newCard(api, b.id, "G1 Yeni Borç", "500", TODAY);
    await must("kapat", api.put(`/api/workspace/plans/${cards.fresh.id}`, { status: "closed" }));
    const c = await account(api, "G1 Can", "customer", "2025-03-01");
    await debt(api, c.id, "700", "2025-03-01");
    cards.gone = await coverCard(api, c.id, "G1 Silinen", "700", "2025-03-02", "2025-04-01");
    await must("kapat", api.put(`/api/workspace/plans/${cards.gone.id}`, { status: "closed" }));
    await must("sil (kilitten önce)", api.del(`/api/workspace/plans/${cards.gone.id}`));
    const d = await account(api, "G1 Dede", "customer", TODAY);
    cards.active = await newCard(api, d.id, "G1 Açık Kart", "300", TODAY);
    const e = await account(api, "G1 Ece", "customer", TODAY);
    cards.named = await newCard(api, e.id, "G1 Adı Düzelecek", "200", TODAY);
    await must("kapat", api.put(`/api/workspace/plans/${cards.named.id}`, { status: "closed" }));
    await setLock(api, TODAY);
    ctx.before = await trialAt(api, TODAY, ["120", "689"]);
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: kilitli günde kapatılmış yeni borç kartını yeniden aç → 409 period-locked", async () => {
    const res = await refusedWith("yeniden aç", ctx.api.put(`/api/workspace/plans/${cards.fresh.id}`, { status: "active" }), 409, "period-locked");
    assert.match(res.error, /kapatıldı/);
    assert.equal(ctx.store.get("SELECT status FROM plans WHERE id = ?", cards.fresh.id).status, "closed");
  });
  it("nasıl bozarım: kilitli günde kapatılmış Mevcut Borç kartını sil → 409 period-locked", async () => {
    await refusedWith("sil", ctx.api.del(`/api/workspace/plans/${cards.cover.id}`), 409, "period-locked");
    assert.equal(ctx.store.get("SELECT deleted_at FROM plans WHERE id = ?", cards.cover.id).deleted_at, null);
  });
  it("nasıl bozarım: kilitten önce silinmiş kapatılmış kartı kilitten sonra geri yükle → 409 period-locked", async () => {
    await refusedWith("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `plan:${cards.gone.id}` }), 409, "period-locked");
    assert.ok(ctx.store.get("SELECT deleted_at FROM plans WHERE id = ?", cards.gone.id).deleted_at);
  });
  it("nasıl bozarım: kilit bugünken açık kart kapatılırsa vazgeçilen kalan kilitli güne yazılırdı → 409 period-locked", async () => {
    await refusedWith("kapat", ctx.api.put(`/api/workspace/plans/${cards.active.id}`, { status: "closed" }), 409, "period-locked");
    assert.equal(ctx.store.get("SELECT status FROM plans WHERE id = ?", cards.active.id).status, "active");
  });
  it("çalışıyor mu: kilitli günde kapatılmış kartın adı ve notu düzeltilir (200)", async () => {
    const updated = await must("ad/not", ctx.api.put(`/api/workspace/plans/${cards.named.id}`, { name: "G1 Adı Düzeldi", note: "Kapandı" }));
    assert.equal(updated.name, "G1 Adı Düzeldi");
    assert.equal(updated.status, "closed");
  });
  it("nasıl bozarım: kilit izi kapanışı kapsar — doğrudan SQL ile yeniden açma, silme ya da tutar değişikliği kapıda geri alınır", () => {
    const { store } = ctx;
    assert.throws(() => store.tx(() => store.run("UPDATE plans SET status = 'active', closed_at = NULL WHERE id = ?", cards.fresh.id)), lockFailure, "yeniden açma");
    assert.throws(() => store.tx(() => store.run("UPDATE plans SET deleted_at = ?, deleted_by = 'saldirgan' WHERE id = ?", new Date().toISOString(), cards.cover.id)), lockFailure, "silme");
    assert.throws(() => store.tx(() => store.run("UPDATE plans SET total = 400 WHERE id = ?", cards.cover.id)), lockFailure, "tutar");
  });
  it("kilitli dönemin mizanı (120, 689) değişmedi; mutabakat 0", async () => {
    assert.deepEqual(await trialAt(ctx.api, TODAY, ["120", "689"]), ctx.before);
    assert.equal(ctx.before["689"], 1700, "vazgeçilen kalan 1.000 + 500 + 200");
    await integrityOk(ctx.api, "G1");
  });
});

describe("G1 — 01.05.2025'te kapatılmış kart (kilit 30.06.2025): tahsilat, çek karşılıksızı", () => {
  let ctx;
  const cards = {};
  let cheque;
  before(async () => {
    ctx = await boot();
    const { api, store } = ctx;
    const e = await account(api, "G1b Emre", "customer", "2025-03-01");
    cards.old = await newCard(api, e.id, "G1b Eski Kart", "1000", "2025-03-02");
    await must("kapat", api.put(`/api/workspace/plans/${cards.old.id}`, { status: "closed" }));
    const f = await account(api, "G1b Fatma", "customer", "2025-03-01");
    cards.chq = await newCard(api, f.id, "G1b Çekli Kart", "1000", "2025-03-02");
    cheque = await must("çek karta sayıldı", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "400", issueDate: "2025-03-05", dueDate: "2025-12-31", serialNo: "G1B-1", accountId: f.id, planId: cards.chq.id }));
    await must("kapat", api.put(`/api/workspace/plans/${cards.chq.id}`, { status: "closed" }));
    // Kart o gün kapatılmış gibi (rota kapatma gününü bugün yazar; geçmiş günde kapatılmış kartın verisi budur).
    store.run("UPDATE plans SET closed_at = '2025-05-01' WHERE id IN (?, ?)", cards.old.id, cards.chq.id);
    const g = await account(api, "G1b Gül", "customer", "2025-01-01");
    cards.later = await newCard(api, g.id, "G1b Sonradan Kapanan", "800", OPEN_DAY);
    await must("kapat", api.put(`/api/workspace/plans/${cards.later.id}`, { status: "closed" }));
    await setLock(api, LOCK);
    ctx.before = await trialAt(api, LOCK, ["120", "689", "101"]);
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: kilitli dönemde kapatılmış karta bugün tahsilat → 409 period-locked (689 kilitli günde küçülürdü)", async () => {
    await refusedWith("tahsilat", ctx.api.post(`/api/workspace/plans/${cards.old.id}/entries`, { kind: "in", amount: "200", date: TODAY, method: "cash" }), 409, "period-locked");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", cards.old.id).n, 0);
  });
  it("nasıl bozarım: karta sayılan çek bugün karşılıksız çıkarsa tahsilat karttan düşerdi → 409 period-locked", async () => {
    await refusedWith("karşılıksız", ctx.api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bounce", date: TODAY }), 409, "period-locked");
    assert.equal(ctx.store.get("SELECT status FROM cheques WHERE id = ?", cheque.id).status, "portfolio");
  });
  it("nasıl bozarım: doğrudan SQL ile kapatılmış karta açık dönemde tahsilat eklenirse kilit izi yakalar", () => {
    const { store } = ctx;
    assert.throws(
      () => store.tx(() => store.run("INSERT INTO plan_entries (id, plan_id, kind, amount, date, method, created_by, created_at) VALUES ('pe-saldiri', ?, 'in', 100, ?, 'cash', 'x', ?)", cards.old.id, TODAY, new Date().toISOString())),
      lockFailure,
    );
  });
  it("çalışıyor mu: kilitten sonra kapatılmış kart yeniden açılır, tahsilat alır, yeniden kapanır (200)", async () => {
    const { api } = ctx;
    await must("yeniden aç", api.put(`/api/workspace/plans/${cards.later.id}`, { status: "active" }));
    await must("tahsilat", api.post(`/api/workspace/plans/${cards.later.id}/entries`, { kind: "in", amount: "300", date: TODAY, method: "cash" }));
    const closed = await must("kapat", api.put(`/api/workspace/plans/${cards.later.id}`, { status: "closed" }));
    assert.equal(closed.status, "closed");
    await integrityOk(api, "G1b açık dönem kartı");
  });
  it("kilitli dönemin mizanı değişmedi", async () => {
    assert.deepEqual(await trialAt(ctx.api, LOCK, ["120", "689", "101"]), ctx.before);
  });
});

// ============================================================ G2 ============================================================
describe("G2 — kilitli dönemde tahsilatı olan kartın carisi değişmez", () => {
  let ctx;
  const ids = {};
  before(async () => {
    ctx = await boot();
    const { api } = ctx;
    ids.a = (await account(api, "G2 Müşteri A")).id;
    ids.b = (await account(api, "G2 Tedarikçi B", "supplier")).id;
    await debt(api, ids.a, "5000", "2025-01-05");
    await debt(api, ids.b, "5000", "2025-01-06");
    ids.card = (await must("kart", api.post("/api/workspace/plans", { accountId: ids.a, name: "G2 Kart", coversBalance: true, total: "5000", registeredOn: "2025-01-10", mode: "auto", count: 5, firstDue: "2025-02-10" }))).id;
    await must("tahsilat", api.post(`/api/workspace/plans/${ids.card}/entries`, { kind: "in", amount: "1000", date: "2025-02-10", method: "cash" }));
    // Hedefin kilitli dönemde hareketi yok: önceki kod nedensiz ledger-integrity dönüyordu.
    ids.c = (await account(api, "G2 Müşteri C")).id;
    ids.d = (await account(api, "G2 Müşteri D")).id;
    await debt(api, ids.c, "5000", "2025-01-05");
    await debt(api, ids.d, "5000", "2025-08-01");
    ids.card2 = (await must("kart 2", api.post("/api/workspace/plans", { accountId: ids.c, name: "G2 Kart 2", coversBalance: true, total: "5000", registeredOn: "2025-01-10", mode: "auto", count: 5, firstDue: "2025-02-10" }))).id;
    await must("tahsilat 2", api.post(`/api/workspace/plans/${ids.card2}/entries`, { kind: "in", amount: "1000", date: "2025-02-10", method: "cash" }));
    // Açık dönem kartı: kilitli dönemde hiçbir şeyi yok, başka cariye taşınabilir.
    ids.e = (await account(api, "G2 Müşteri E")).id;
    ids.f = (await account(api, "G2 Müşteri F")).id;
    await debt(api, ids.e, "2000", "2025-08-01");
    await debt(api, ids.f, "2000", "2025-08-01");
    ids.card3 = (await coverCard(api, ids.e, "G2 Açık Kart", "2000", "2025-08-02", "2025-09-01")).id;
    ids.g = (await account(api, "G2 Müşteri G")).id;
    await debt(api, ids.g, "3000", "2025-01-05");
    ids.card4 = (await must("kart 4", api.post("/api/workspace/plans", { accountId: ids.g, name: "G2 Kart 4", coversBalance: true, total: "3000", registeredOn: "2025-01-10", mode: "auto", count: 3, firstDue: "2025-02-10" }))).id;
    await must("tahsilat 4", api.post(`/api/workspace/plans/${ids.card4}/entries`, { kind: "in", amount: "500", date: "2025-02-10", method: "cash" }));
    await setLock(api, LOCK);
    ctx.before = await trialAt(api, LOCK, ["100", "120", "320"]);
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: müşterinin kartını tedarikçi cariye taşı → 409 period-locked; kart müşteride, kilitli mizan aynı", async () => {
    const res = await refusedWith("taşı", ctx.api.put(`/api/workspace/plans/${ids.card}`, { accountId: ids.b }), 409, "period-locked");
    assert.match(res.error, /carisi değiştirilemez/);
    assert.equal(ctx.store.get("SELECT account_id AS a FROM plans WHERE id = ?", ids.card).a, ids.a);
    assert.deepEqual(await trialAt(ctx.api, LOCK, ["100", "120", "320"]), ctx.before);
  });
  it("nasıl bozarım: hedef carinin kilitli dönemde hareketi yokken de nedenli 409 period-locked (ledger-integrity değil)", async () => {
    await refusedWith("taşı", ctx.api.put(`/api/workspace/plans/${ids.card2}`, { accountId: ids.d }), 409, "period-locked");
    assert.equal(ctx.store.get("SELECT account_id AS a FROM plans WHERE id = ?", ids.card2).a, ids.c);
  });
  it("nasıl bozarım: doğrudan SQL ile kartın carisi değişirse kilit izi yakalar (iki cari de kilitli dönemde hareketli)", () => {
    assert.throws(() => ctx.store.tx(() => ctx.store.run("UPDATE plans SET account_id = ? WHERE id = ?", ids.b, ids.card)), lockFailure);
  });
  it("çalışıyor mu: kilitli tahsilatlı kartın adı ve notu değişir; açık dönem kartı başka cariye taşınır (200)", async () => {
    const renamed = await must("ad", ctx.api.put(`/api/workspace/plans/${ids.card4}`, { name: "G2 Kart 4 (yeni ad)", note: "Not" }));
    assert.equal(renamed.accountId, ids.g);
    const moved = await must("taşı", ctx.api.put(`/api/workspace/plans/${ids.card3}`, { accountId: ids.f }));
    assert.equal(moved.accountId, ids.f);
    await integrityOk(ctx.api, "G2");
  });
});

// ============================================================ G3 ============================================================
describe("G3 — kilitli dönemdeki kuruşlu çek: arayüzün gövdesiyle yalnız vade düzeltme", () => {
  let ctx;
  const ch = {};
  // hof-cheques.js chequeForm: formdaki bütün alanlar, tutar String(amount).replace(".", ",") ("2500,5").
  const formBody = (card, change) => ({ instrument: card.instrument, amount: String(card.amount).replace(".", ","), dueDate: card.dueDate, issueDate: card.issueDate, serialNo: card.serialNo, bank: card.bank, drawer: card.drawer, note: card.note, accountId: card.accountId || "", direction: card.direction, updatedAt: card.updatedAt, ...change });
  before(async () => {
    ctx = await boot();
    const { api } = ctx;
    const acc = await account(api, "G3 Müşteri");
    ch.plain = await must("carisiz", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "2.500,50", issueDate: "2025-03-10", dueDate: "2025-12-31", serialNo: "G3-1", drawer: "Keşideci" }));
    ch.party = await must("carili", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.200,25", issueDate: "2025-03-10", dueDate: "2025-12-31", serialNo: "G3-2", accountId: acc.id }));
    ch.open = await must("açık dönem", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "3.333,30", issueDate: OPEN_DAY, dueDate: "2025-12-31", serialNo: "G3-3", accountId: acc.id }));
    await setLock(api, LOCK);
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: arayüz gövdesiyle yalnız vade düzeltilir — carisiz ve carili (200); tutar ve cari satırı aynı", async () => {
    for (const key of ["plain", "party"]) {
      const card = await must("kart", ctx.api.get(`/api/workspace/cheques/${ch[key].id}`));
      const before = ctx.store.all("SELECT id, amount FROM account_entries WHERE source = 'cheque' AND source_id = ?", card.id);
      const updated = await must(`vade ${key}`, ctx.api.put(`/api/workspace/cheques/${card.id}`, formBody(card, { dueDate: "2026-01-15", note: "Vade uzadı" })));
      assert.equal(updated.dueDate, "2026-01-15");
      assert.equal(updated.amount, card.amount);
      assert.deepEqual(ctx.store.all("SELECT id, amount FROM account_entries WHERE source = 'cheque' AND source_id = ?", card.id), before, "cari satırı yeniden yazılmadı");
    }
    await integrityOk(ctx.api, "G3 vade");
  });
  it("çalışıyor mu: kilitli evrakta form tutar/tarih alanlarını açmaz (canEditCore false, coreLocked); açık dönemde açar", async () => {
    const locked = await must("kart", ctx.api.get(`/api/workspace/cheques/${ch.party.id}`));
    assert.equal(locked.canEditCore, false);
    assert.equal(locked.coreLocked, true);
    const open = await must("kart", ctx.api.get(`/api/workspace/cheques/${ch.open.id}`));
    assert.equal(open.canEditCore, true);
    assert.equal(open.coreLocked, false);
  });
  it("nasıl bozarım: virgüllü yeni tutar (1 kuruş fark) → 409 period-locked; tutar aynı", async () => {
    const card = await must("kart", ctx.api.get(`/api/workspace/cheques/${ch.plain.id}`));
    await refusedWith("tutar", ctx.api.put(`/api/workspace/cheques/${card.id}`, formBody(card, { amount: "2500,51" })), 409, "period-locked");
    assert.equal(ctx.store.get("SELECT amount FROM cheques WHERE id = ?", card.id).amount, 2500.5);
  });
  it("çalışıyor mu: açık dönemdeki kuruşlu çekte form gövdesi tutarı değiştirmeden kaydedilince cari satırı yeniden yazılmaz", async () => {
    const card = await must("kart", ctx.api.get(`/api/workspace/cheques/${ch.open.id}`));
    const before = ctx.store.all("SELECT id FROM account_entries WHERE source = 'cheque' AND source_id = ?", card.id).map(row => row.id);
    await must("not", ctx.api.put(`/api/workspace/cheques/${card.id}`, formBody(card, { note: "Not" })));
    assert.deepEqual(ctx.store.all("SELECT id FROM account_entries WHERE source = 'cheque' AND source_id = ?", card.id).map(row => row.id), before);
  });
});

// ============================================================ G4 ============================================================
describe("G4 — eski sürümden kalan satır Mutabakat Testi'nde, Defter Mutabakatı'nda ve Günlük'te görünür", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
    const stamp = new Date().toISOString();
    ctx.db.prepare("INSERT INTO payments (id, case_key, amount, date, note, method, created_by, created_at) VALUES ('pay-eski-ileri', 'ESKI', 500, ?, 'Eski sürüm', 'cash', 'eski', ?)").run(localDay(20), stamp);
    ctx.db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-eski-yol', 'in', 25, ?, 'Eski sürüm', 'eski', 'x', ?)").run(OPEN_DAY, stamp);
    ctx.server.app.integrity.start(); // güncelleme sonrası açılış
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: Mutabakat Testi eski satırları gösterir (ok false; legacy sayısı), yeni işlemleri engellemez", async () => {
    const result = await must("mutabakat", ctx.api.get("/api/workspace/ledger/integrity"));
    const future = result.checks.find(check => check.code === "dates:future:payments");
    assert.equal(future.ok, false, "eski ileri tarihli satır gizlenmez");
    assert.equal(future.count, 1);
    assert.equal(future.legacy, 1);
    const method = result.checks.find(check => check.code === "money:method");
    assert.equal(method.ok, false, "eski tanınmayan yol gizlenmez");
    assert.equal(method.legacy, 1);
    assert.equal(result.ok, false);
    await must("yeni tahsilat", ctx.api.post("/api/workspace/cases/G4-1/payments", { amount: "50", caseTitle: "Yeni" }));
    await must("Kasa girişi", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "40", description: "Yeni" }));
  });
  it("çalışıyor mu: Defter Mutabakatı satırı 'Eski Sürümden Kalan' der; Mutabakat Günlüğü'nde açılış sapması (baseline) var", async () => {
    const report = await must("rapor", ctx.api.get("/api/workspace/report-center/defter-mutabakati"));
    const row = report.rows.find(cells => String(cells[1]).includes("İleri tarihli hareket (payments)"));
    assert.ok(row, JSON.stringify(report.rows).slice(0, 500));
    assert.equal(row.at(-1), "Eski Sürümden Kalan");
    assert.equal(report.summary.find(cells => cells[0] === "Sonuç")[1], "Fark Var");
    const log = ctx.store.all("SELECT action, summary FROM integrity_log WHERE action = 'baseline'");
    assert.ok(log.some(entry => /İleri tarihli hareket \(payments\)/.test(entry.summary) && /Tanınmayan ödeme yolu/.test(entry.summary)), JSON.stringify(log));
  });
  it("nasıl bozarım: eski satır varken yeni ileri tarihli / tanınmayan yollu satır kapıda yine 409", () => {
    const { store } = ctx;
    const failed = code => error => error?.extra?.code === "ledger-integrity" && (error.failures || []).some(item => item.code === code);
    assert.throws(() => store.tx(() => store.run("INSERT INTO payments (id, case_key, amount, date, note, method, created_by, created_at) VALUES ('pay-yeni-ileri', 'X', 10, ?, '', 'cash', 'x', ?)", localDay(5), new Date().toISOString())), failed("dates:future:payments"));
    assert.throws(() => store.tx(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-yeni-yol', 'in', 10, ?, 'x', 'bitcoin', 'x', ?)", OPEN_DAY, new Date().toISOString())), failed("money:method"));
  });
  it("çalışıyor mu: eski satırlar kalkınca Mutabakat Testi yeniden tutarlı", async () => {
    ctx.db.prepare("DELETE FROM payments WHERE id = 'pay-eski-ileri'").run();
    ctx.db.prepare("DELETE FROM cash_entries WHERE id = 'cash-eski-yol'").run();
    ctx.server.app.integrity.start();
    await integrityOk(ctx.api, "G4 sonrası");
  });
});

// ============================================================ G5 ============================================================
describe("G5 — ileri tarihli eski hareketin Silinenler'den geri yüklenmesi", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: ileri alış tarihli eski çek silinip geri yüklenirse nedenli 400 date-future (evrak silinmiş kalır)", async () => {
    const { api, db, server } = ctx;
    const acc = await account(api, "G5 Müşteri");
    await debt(api, acc.id, "5000", OPEN_DAY);
    const c = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "750", dueDate: localDay(60), serialNo: "G5-1", accountId: acc.id }));
    // 2.0.25 ileri alış tarihine izin veriyordu: veri o sürümün yazacağı hâle getirilir, sonra açılış (taban yeniden ölçülür).
    const day = localDay(5);
    db.prepare("UPDATE cheques SET issue_date = ?, status_date = ? WHERE id = ?").run(day, day, c.id);
    db.prepare("UPDATE cheque_events SET date = ? WHERE cheque_id = ?").run(day, c.id);
    db.prepare("UPDATE account_entries SET date = ? WHERE source = 'cheque' AND source_id = ?").run(day, c.id);
    server.app.integrity.start();
    await must("sil", api.del(`/api/workspace/cheques/${c.id}`));
    const res = await refusedWith("geri yükle", api.post("/api/admin/trash/restore", { id: `cheque:${c.id}` }), 400, "date-future");
    assert.match(res.error, /ileri tarih/i);
    assert.ok(ctx.store.get("SELECT deleted_at FROM cheques WHERE id = ?", c.id).deleted_at);
  });
  it("nasıl bozarım: ileri tarihli eski kayıt tahsilatı silinip yeniden başlatmadan sonra geri yüklenirse nedenli 400 date-future", async () => {
    const { api, db, server, store } = ctx;
    db.prepare("INSERT INTO payments (id, case_key, case_title, amount, date, note, method, created_by, created_at) VALUES ('pay-g5', 'G5', 'Eski', 300, ?, 'Eski sürüm', 'cash', 'eski', ?)").run(localDay(7), new Date().toISOString());
    server.app.integrity.start();
    await must("sil", api.del("/api/workspace/payments/pay-g5?cashForce=1"));
    server.app.integrity.start(); // yeniden başlatma: silinmiş satır artık tabanda değil
    await refusedWith("geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${trashIdOf(store, "pay-g5")}` }), 400, "date-future");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM payments WHERE id = 'pay-g5'").n, 0);
  });
});

// ============================================================ G6 ============================================================
const NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const NOW = new Date();
const monthOf = offset => {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() + offset, 1);
  return { name: NAMES[d.getMonth()], year: d.getFullYear(), month: d.getMonth() + 1 };
};
const header = offset => `${monthOf(offset).name} ${monthOf(offset).year} taksiti`;
const iso = (offset, day = 1) => `${monthOf(offset).year}-${pad(monthOf(offset).month)}-${pad(day)}`;
const lastDayOfPrevMonth = () => {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
describe("G6 — Taksite Aktar, Excel'den taksit yükleme ve aktarımı geri alma: dönem kilidinde nedenli", () => {
  let ctx;
  let key;
  before(async () => {
    ctx = await boot();
    const { api, server } = ctx;
    const matrix = [["Ad Soyad", "Telefon", header(-2), header(-1), header(0), header(1), "Toplam", "Ödenen"], ["Ayşe Kaya", "0532 444 55 66", "5.000", "5.000", "5.000", "5.000", "20.000", ""], ["Mehmet Aksoy", "0532 777 88 99", "", "", "4.000", "4.000", "8.000", ""]];
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Okul", matrix }] }));
    await must("yükle", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const client = await loginAdmin(server);
    const rows = (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    key = rows.find(row => row["Ad Soyad"] === "Ayşe Kaya").__hofKey;
    ctx.mehmet = rows.find(row => row["Ad Soyad"] === "Mehmet Aksoy").__hofKey;
    await must("havale tahsilat", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "2.500", date: iso(-1, 3), method: "bank", caseTitle: "Ayşe Kaya" }));
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: ilk vadesi kilitli dönemde olan kişi Taksite Aktar'da nedeniyle atlanır; kart açılmaz, tahsilat kayıtta kalır", async () => {
    const { api, store } = ctx;
    await setLock(api, lastDayOfPrevMonth());
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [key], fingerprint: preview.fingerprint }));
    assert.equal(result.created, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /kapatılmış \(kilitli\) dönem/);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL").n, 0);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM payments WHERE case_key = ?", key).n, 1);
    await integrityOk(api, "G6 aktarım");
  });
  it("çalışıyor mu: kilitli dönemde hiçbir şeyi olmayan kişi aynı anda aktarılır (200)", async () => {
    const { api } = ctx;
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [ctx.mehmet], fingerprint: preview.fingerprint }));
    assert.equal(result.created, 1, JSON.stringify(result.skipped));
    ctx.importId = result.importId;
  });
  it("nasıl bozarım: Excel'den taksit yüklemede ilk vadesi kilitli dönemde olan satır nedeniyle atlanır (yükleme durmaz)", async () => {
    const { api } = ctx;
    const matrix = [["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade"], ["Eski Borçlu", "3000", "3", "01.03.2025"], ["Yeni Borçlu", "3000", "3", `01.${pad(monthOf(1).month)}.${monthOf(1).year}`]];
    const result = await must("yükle", api.post("/api/workspace/plans/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue" }, fileName: "taksit.xlsx", linkRecords: false }));
    assert.equal(result.created, 1);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /kapatılmış \(kilitli\) dönem/);
    await integrityOk(api, "G6 Excel");
  });
  it("nasıl bozarım: kilitten önce yapılmış aktarımı kilitten sonra geri al → 409 period-locked (taşınan tahsilat kilitli günde)", async () => {
    const { api, store } = ctx;
    await setLock(api, "");
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [key], fingerprint: preview.fingerprint }));
    assert.equal(result.created, 1);
    await setLock(api, lastDayOfPrevMonth());
    await refusedWith("geri al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}), 409, "period-locked");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL AND import_id = ?", result.importId).n, 1);
    await integrityOk(api, "G6 geri alma");
  });
});

// ============================================================ G7 ============================================================
describe("G7 — silmede eksi bakiye sorusu nedenini söyler", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: kayıt tahsilatı ve cari silmede soru 'silinince Nakit Kasa'dan … düşer' der ('çıkış' değil)", async () => {
    const { api } = ctx;
    const payment = await must("tahsilat", api.post("/api/workspace/cases/G7/payments", { amount: "1.000", date: OPEN_DAY, method: "cash", caseTitle: "Ali" }));
    const acc = await account(api, "G7 Cari");
    await must("cari tahsilat", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "500", date: OPEN_DAY, method: "cash" }));
    await drainCash(api, 200);
    const first = await refusedWith("tahsilat sil", api.del(`/api/workspace/payments/${payment.id}`), 409, "cash-negative");
    assert.match(first.error, /Bu tahsilat silinince Nakit Kasa'dan 1\.000,00 TL düşer/);
    assert.match(first.error, /200,00 TL iken -?−?800,00 TL olur/);
    assert.doesNotMatch(first.error, /çıkış/);
    const second = await refusedWith("cari sil", api.del(`/api/workspace/accounts/${acc.id}`), 409, "cash-negative");
    assert.match(second.error, /Bu carinin tahsilat ve ödemeleri silinince Nakit Kasa'dan 500,00 TL düşer/);
  });
  it("çalışıyor mu: kayıtta çıkış sorusu (yeni ödeme) eski metniyle kalır", async () => {
    const res = await refusedWith("ödeme", ctx.api.post("/api/workspace/cash", { kind: "out", amount: "5000", description: "Büyük ödeme" }), 409, "cash-negative");
    assert.match(res.error, /çıkış/);
  });
});

// ============================================================ G8 ============================================================
describe("G8 — mahsup ve geri yükleme mesajları", () => {
  let ctx;
  let svc;
  let customer;
  before(async () => {
    ctx = await boot();
    svc = await must("hizmet", ctx.api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
    customer = await account(ctx.api, "G8 Müşteri");
  });
  after(async () => ctx.server.close());
  const invoice = () => must("fatura", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: OPEN_DAY, lines: [{ itemId: svc.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open" } }));

  it("çalışıyor mu: mahsuptaki satır silinirken mesaj arayüzdeki yolu söyler (faturanın kartı → Bu Faturayı Kapatanlar → Kaldır)", async () => {
    const inv = await invoice();
    const credit = await must("alacak", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "credit", amount: "300", date: OPEN_DAY, note: "İndirim" }));
    await must("mahsup", ctx.api.post(`/api/workspace/invoices/${inv.id}/offsets`, { counterType: "entry", counterId: credit.entryId, amount: "300", date: OPEN_DAY }));
    const res = await refusedWith("sil", ctx.api.del(`/api/workspace/accounts/${customer.id}/entries/${credit.entryId}`), 409, "offset-linked");
    assert.match(res.error, new RegExp(`${inv.number} faturasını açın`));
    assert.match(res.error, /Bu Faturayı Kapatanlar/);
    assert.match(res.error, /Kaldır/);
    assert.doesNotMatch(res.error, /Fatura → Mahsup/);
  });
  it("çalışıyor mu: iptal edilen faturaya bağlı tahsilat geri yüklenince mesaj fatura numarasını ve nedeni söyler", async () => {
    const inv = await invoice();
    const pay = await must("bağlı tahsilat", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "400", date: OPEN_DAY, method: "bank", invoiceId: inv.id }));
    await must("sil", ctx.api.del(`/api/workspace/accounts/${customer.id}/entries/${pay.entryId}`));
    await must("iptal", ctx.api.post(`/api/workspace/invoices/${inv.id}/cancel`, { reason: "Deneme" }));
    const result = await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `trash:${trashIdOf(ctx.store, pay.entryId)}` }));
    assert.match(result.message, new RegExp(`${inv.number} faturası iptal edildiği için faturaya bağlanmadı`));
    assert.match(result.message, /otomatik kapamaya girer/);
  });
});
