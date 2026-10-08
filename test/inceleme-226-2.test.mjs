// 2.0.26 — Aşama 0 düzeltmelerinin İKİNCİ bağımsız gözden geçirmesinde doğrulanan bulgular (docs/2.0.26-KANIT.md → "İkinci bağımsız
// gözden geçirme"). Her bulgu önce bu dosyada KIRMIZI test olarak yeniden üretildi (düzeltmeden önceki dal: bdd1be6), sonra düzeltildi.
// Test kuralı (CLAUDE.md): her bulgu için "çalışıyor mu" (doğru kullanım, sayılar) + "nasıl bozarım" (kilitli döneme sızdırma, eski
// sürüm verisi, doğrudan SQL ile eski durum).
//   İ1 (orta)   Taksite Aktar: kilitli günde kapatılmış bağsız karta bağlanıp kayıt tahsilatını taşıma → bütün aktarım nedensiz 409
//               ledger-integrity (geri almada da). Beklenen: kişi nedeniyle atlanır / geri alma nedenli 409 period-locked.
//   İ2 (düşük)  Excel'den taksit yükleme: kilit yüzünden atlanan satırın grubu yine açılıyordu (boş grup, Geri Al'sız).
//   İ3 (düşük)  Çek formu: işlem görmüş/faturalı evrakta giriş metni yanlış yolu söylüyordu; kilitli evrakta Sil görünüyordu.
//   İ5 (düşük)  Tahsilat düzeltmesinde eksi bakiye sorusu "çıkış … yolu değiştirin" diyordu (düzeltmeye uymayan metin).
//   İ7 (düşük)  Mahsuplu Alacak Yaz satırında değişmeyen alan da sınanıyordu: 2.0.25'te tarihi/tutarı kaymış satırda yalnız açıklama
//               düzeltmesi 409 offset-linked.
//   İ8 (düşük)  Eski sürümden kalan ileri tarihli çek/senet hareketi: Mutabakat'ta tablo adı (cheque_events), yol söylenmiyor, kırmızı.
//   İ10 (düşük) Eksi bakiye denetimi Kasa özetini iki kez hesaplıyordu (büyük veride ~70 ms/işlem).
// (İ6 — silmede "Vazgeç" bildirimi — istemcide; test/e2e/senaryo-226.mjs. İ4 ve İ9 ölçüm; KANIT'ta.)
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const pad = n => String(n).padStart(2, "0");
const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error, failures: r.data?.failures, raw: r.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
async function boot() {
  const server = await startTestServer();
  const client = await loginAdmin(server);
  return { server, api: apiOf(client), store: server.app.store, db: server.app.db };
}
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${res.code || ""} ${String(res.error || JSON.stringify(res.data)).slice(0, 500)}`);
  return res.data;
};
const refusedWith = async (label, promise, status, code) => {
  const res = await promise;
  assert.equal(res.status, status, `${label}: ${status} beklendi, ${res.status} geldi (${res.code || ""}) ${String(res.error || JSON.stringify(res.data)).slice(0, 400)}`);
  if (code) assert.equal(res.code, code, `${label}: kod ${code} beklendi, ${res.code} geldi — ${String(res.error || "").slice(0, 400)}`);
  return res;
};
const integrityOk = async (api, label) => {
  const result = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
  assert.equal(result.ok, true, `${label}: mutabakat bozuk ${JSON.stringify(result.failures).slice(0, 600)}`);
};
const setLock = (api, date) => must(`kilit ${date || "kaldır"}`, api.put("/api/admin/period-lock", { lockedUntil: date }));
const cashBalance = async api => (await must("kasa", api.get("/api/workspace/cash?method=cash"))).totals.balance;
async function drainCash(api, leave = 200) {
  const amount = Math.round(((await cashBalance(api)) - leave) * 100) / 100;
  if (amount > 0) await must("kira ödemesi", api.post("/api/workspace/cash", { kind: "out", amount, date: localDay(0), description: "Kira" }));
  assert.equal(await cashBalance(api), leave, "Kasa hazırlandı");
}
async function trialAt(api, day, code) {
  const result = await must(`mizan ${day}`, api.get(`/api/workspace/ledger?to=${day}`));
  return (result.trial.accounts || []).find(row => String(row.code) === code)?.balance || 0;
}

// ============================================================ İ1 ============================================================
// Sahte saat (yalnız Date): 01.09.2026'da kart açılıp kapatılır, 10.09.2026'da tablo yüklenir ve kayda tahsilat girilir, kilit 05.09.2026.
const T0 = new Date(2026, 8, 1, 12, 0, 0);
const T1 = new Date(2026, 8, 10, 12, 0, 0);
const dayOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const LOCK1 = "2026-09-05";
async function closedCardWithTable() {
  mock.timers.enable({ apis: ["Date"], now: T0.getTime() });
  const server = await startTestServer();
  let api = apiOf(await loginAdmin(server));
  // Taksitler → Yeni Kart (bağsız; carisiz), sonra kalandan vazgeçilerek kapatılır (689'a 01.09'da 20.000).
  const card = await must("kart", api.post("/api/workspace/plans", { name: "Ayşe Kaya", phone: "0532 444 55 66", total: "20000", registeredOn: dayOf(T0), mode: "auto", count: 4, firstDue: dayOf(T0) }));
  await must("kapat", api.put(`/api/workspace/plans/${card.id}`, { status: "closed" }));
  mock.timers.setTime(T1.getTime());
  const client = await loginAdmin(server);
  api = apiOf(client);
  const matrix = [["Ad Soyad", "Telefon", "Eylül 2026 taksiti", "Ekim 2026 taksiti", "Kasım 2026 taksiti", "Aralık 2026 taksiti", "Toplam", "Ödenen"], ["Ayşe Kaya", "0532 444 55 66", "5.000", "5.000", "5.000", "5.000", "20.000", ""]];
  const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Okul", matrix }] }));
  await must("yükle", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
  const rows = (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
  const key = rows.find(row => row["Ad Soyad"] === "Ayşe Kaya").__hofKey;
  await must("kayıt tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "2500", date: dayOf(T1), method: "cash", caseTitle: "Ayşe Kaya" }));
  return { server, api, store: server.app.store, card, key };
}

describe("İ1 — Taksite Aktar: kilitli günde kapatılmış bağsız karta tahsilat taşınamaz; kişi nedeniyle atlanır", () => {
  let ctx;
  before(async () => {
    ctx = await closedCardWithTable();
    await setLock(ctx.api, LOCK1);
    ctx.waived = await trialAt(ctx.api, LOCK1, "689");
  });
  after(async () => {
    await ctx?.server.close();
    mock.timers.reset();
  });

  it("nasıl bozarım: ön izleme kişiyi aktarılamaz gösterir ve nedenini söyler (kart kilitli günde kapatıldı)", async () => {
    const preview = await must("ön izleme", ctx.api.get("/api/workspace/plans/from-table"));
    const record = preview.records.find(row => row.key === ctx.key);
    assert.equal(record.selected, false, `ön izleme seçili göstermemeli: ${record.status}`);
    const issue = record.issues.find(item => item.code === "link-closed-locked");
    assert.ok(issue, JSON.stringify(record.issues));
    assert.match(issue.text, /01\.09\.2026 tarihinde kapatıldı/);
    assert.match(issue.text, /taşımadan/);
  });
  it("nasıl bozarım: aktarım bütünüyle 409 değil; 200, kişi nedeniyle atlanır, tahsilat kayıtta, kilitli 689 aynı", async () => {
    const { api, store } = ctx;
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [ctx.key], fingerprint: preview.fingerprint }));
    assert.equal(result.linked, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /kapatıldı/);
    assert.equal(store.get("SELECT case_key AS k FROM plans WHERE id = ?", ctx.card.id).k, "", "kart bağlanmadı");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM payments WHERE case_key = ?", ctx.key).n, 1, "tahsilat kayıtta kaldı");
    assert.equal(await trialAt(api, LOCK1, "689"), ctx.waived);
    await integrityOk(api, "İ1 aktarım");
  });
  it("çalışıyor mu: tahsilatları taşımadan (payments: false) kart kayda bağlanır; kilitli 689 aynı", async () => {
    const { api, store } = ctx;
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table?payments=false"));
    const record = preview.records.find(row => row.key === ctx.key);
    assert.equal(record.status, "link");
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [ctx.key], fingerprint: preview.fingerprint, payments: false }));
    assert.equal(result.linked, 1, JSON.stringify(result.skipped));
    assert.equal(store.get("SELECT case_key AS k FROM plans WHERE id = ?", ctx.card.id).k, ctx.key);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM payments WHERE case_key = ?", ctx.key).n, 1);
    assert.equal(await trialAt(api, LOCK1, "689"), ctx.waived);
    await integrityOk(api, "İ1 tahsilatsız bağ");
  });
});

describe("İ1 — aktarımı geri alma: kapatılmış karta taşınan tahsilat, kart kilitli günde kapatıldıysa nedenli 409", () => {
  let ctx;
  before(async () => {
    ctx = await closedCardWithTable();
    const preview = await must("ön izleme", ctx.api.get("/api/workspace/plans/from-table"));
    const result = await must("aktar (kilitsiz)", ctx.api.post("/api/workspace/plans/from-table", { keys: [ctx.key], fingerprint: preview.fingerprint }));
    assert.equal(result.linked, 1);
    assert.equal(result.paymentsMoved, 1);
    ctx.importId = result.importId;
    await setLock(ctx.api, LOCK1);
    ctx.waived = await trialAt(ctx.api, LOCK1, "689");
  });
  after(async () => {
    await ctx?.server.close();
    mock.timers.reset();
  });

  it("nasıl bozarım: kilitten sonra geri al → 409 period-locked (nedenli; kapıdaki nedensiz ledger-integrity değil)", async () => {
    const res = await refusedWith("geri al", ctx.api.post(`/api/workspace/plans/imports/${ctx.importId}/undo`, {}), 409, "period-locked");
    assert.match(res.error, /01\.09\.2026/);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", ctx.card.id).n, 1, "tahsilat kartta kaldı");
    assert.equal(await trialAt(ctx.api, LOCK1, "689"), ctx.waived, "kilitli 689 aynı");
  });
  it("çalışıyor mu: kilit kalkınca geri alınır (tahsilat kayda döner)", async () => {
    await setLock(ctx.api, "");
    await must("geri al", ctx.api.post(`/api/workspace/plans/imports/${ctx.importId}/undo`, {}));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM payments WHERE case_key = ?", ctx.key).n, 1);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", ctx.card.id).n, 0);
    await integrityOk(ctx.api, "İ1 geri alma");
  });
});

// ============================================================ İ2 ============================================================
describe("İ2 — Excel'den taksit yükleme: kilit yüzünden atlanan satır boş grup bırakmaz", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
    await setLock(ctx.api, "2025-06-30");
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: grubu yeni olan ve ilk vadesi kilitli dönemde satır → kart, cari ve grup açılmaz; rapor groups 0", async () => {
    const matrix = [["Ad Soyad", "Grup", "Toplam", "Taksit Sayısı", "İlk Vade"], ["Eski Borçlu", "Kilitli Dönem Grubu", "3000", "3", "01.03.2025"]];
    const result = await must("yükle", ctx.api.post("/api/workspace/plans/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "group", 2: "total", 3: "count", 4: "firstDue" }, fileName: "taksit.xlsx", linkRecords: false }));
    assert.equal(result.created, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /kapatılmış \(kilitli\) dönem/);
    assert.equal(result.groups, 0, "rapor yeni grup saymamalı");
    assert.deepEqual(ctx.store.all("SELECT name FROM plan_groups"), [], "boş grup kalmamalı");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM accounts").n, 0);
  });
  it("çalışıyor mu: aynı grupta açık dönem satırı + atlanan satır → grup bir kez açılır, kart onda; Sıra No boşluksuz", async () => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1, 1);
    const due = `01.${pad(next.getMonth() + 1)}.${next.getFullYear()}`;
    const matrix = [["Ad Soyad", "Grup", "Toplam", "Taksit Sayısı", "İlk Vade"], ["Eski Borçlu 2", "Karma Grup", "3000", "3", "01.03.2025"], ["Yeni Borçlu", "Karma Grup", "3000", "3", due], ["Yeni Borçlu 2", "Karma Grup", "1500", "3", due]];
    const result = await must("yükle", ctx.api.post("/api/workspace/plans/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "group", 2: "total", 3: "count", 4: "firstDue" }, fileName: "taksit.xlsx", linkRecords: false }));
    assert.equal(result.created, 2);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.groups, 1);
    const groups = ctx.store.all("SELECT id, name FROM plan_groups");
    assert.deepEqual(groups.map(row => row.name), ["Karma Grup"]);
    const refs = ctx.store.all("SELECT ref_no AS ref, group_id AS g FROM plans ORDER BY CAST(ref_no AS INTEGER)");
    assert.deepEqual(refs.map(row => row.ref), ["1", "2"], "atlanan satır numara yemez");
    assert.ok(refs.every(row => row.g === groups[0].id));
    await integrityOk(ctx.api, "İ2");
  });
});

// ============================================================ İ3 ============================================================
describe("İ3 — çek formu: giriş metni doğru yolu söyler; kilitli evrakta Sil yok, nedeni yazılı", () => {
  let ctx;
  const ids = {};
  before(async () => {
    ctx = await boot();
    const { api } = ctx;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "Çek Ali", type: "customer", registeredOn: "2025-01-01" }));
    ids.acc = acc.id;
    // Kilitli dönemde alınmış ve kilitli dönemde tahsil edilmiş çek; kilitli dönemde alınıp kilit sonrası tahsil edilmiş çek;
    // kilitli dönemde alınmış, işlem görmemiş çek; faturayla alınmış çek (açık dönem).
    const collected = await must("çek 1", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1500", dueDate: "2025-06-05", issueDate: "2025-03-01", accountId: acc.id, serialNo: "İ3-1" }));
    await must("tahsil 1", api.post(`/api/workspace/cheques/${collected.id}/actions`, { action: "collect", date: "2025-03-10", method: "bank" }));
    ids.collectedLocked = collected.id;
    const later = await must("çek 2", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "900", dueDate: "2025-09-05", issueDate: "2025-03-02", accountId: acc.id, serialNo: "İ3-2" }));
    await must("tahsil 2", api.post(`/api/workspace/cheques/${later.id}/actions`, { action: "collect", date: "2025-09-10", method: "bank" }));
    ids.collectedOpen = later.id;
    const idle = await must("çek 3", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "700", dueDate: "2026-12-01", issueDate: "2025-03-03", accountId: acc.id, serialNo: "İ3-3" }));
    ids.idle = idle.id;
    const svc = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-İ3", name: "Danışmanlık", unit: "Adet", salePrice: "1000" }));
    const invoice = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: localDay(0), lines: [{ itemId: svc.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { cheques: [{ instrument: "cheque", amount: 1000, dueDate: localDay(60), serialNo: "İ3-F", bank: "Ziraat" }], rest: "open" } }));
    ids.invoiceNumber = invoice.number;
    ids.invoiceCheque = ctx.store.get("SELECT id FROM cheques WHERE invoice_id = ?", invoice.id).id;
    await setLock(api, "2025-06-30");
  });
  after(async () => ctx.server.close());

  const detail = id => must("çek", ctx.api.get(`/api/workspace/cheques/${id}`));
  it("nasıl bozarım: kilitli dönemde tahsil edilmiş çek → metin önce son işlemin geri alınmasını ve onun için kilidin açılmasını söyler", async () => {
    const c = await detail(ids.collectedLocked);
    assert.equal(c.canEditCore, false);
    assert.match(c.coreNote || "", /önce son işlemi geri alın/);
    assert.match(c.coreNote || "", /10\.03\.2025/);
    assert.match(c.coreNote || "", /dönem kilidini açmalı/);
    // Söylenen sıra işe yarar: kilit açılınca geri al 200, sonra tutar değişir 200.
    await setLock(ctx.api, "");
    await must("geri al", ctx.api.post(`/api/workspace/cheques/${ids.collectedLocked}/undo`, {}));
    const open = await detail(ids.collectedLocked);
    await must("tutar", ctx.api.put(`/api/workspace/cheques/${ids.collectedLocked}`, { amount: "1600", dueDate: open.dueDate, updatedAt: open.updatedAt }));
    await setLock(ctx.api, "2025-06-30");
  });
  it("nasıl bozarım: kilitli dönemde alınıp sonra tahsil edilmiş çek → geri alınabilir ama tutar için yine kilit gerekir (metin ikisini söyler)", async () => {
    const c = await detail(ids.collectedOpen);
    assert.match(c.coreNote || "", /önce son işlemi geri alın/);
    assert.match(c.coreNote || "", /kapatılmış \(kilitli\) dönemde alındı/);
  });
  it("nasıl bozarım: faturayla alınmış çek → metin faturayı söyler (geri al / kilit değil)", async () => {
    const c = await detail(ids.invoiceCheque);
    assert.equal(c.canEditCore, false);
    assert.match(c.coreNote || "", new RegExp(ids.invoiceNumber));
    assert.match(c.coreNote || "", /faturayı iptal edin/);
    assert.doesNotMatch(c.coreNote || "", /son işlemi geri alın|dönem kilidini/);
  });
  it("nasıl bozarım: kilitli dönemde alınmış, işlem görmemiş çek → Sil sunulmaz (canDelete false), nedeni kartta yazılı; DELETE yine 409", async () => {
    const c = await detail(ids.idle);
    assert.equal(c.canDelete, false);
    assert.match(c.coreNote || "", /kapatılmış \(kilitli\) dönemde alındı/);
    assert.match(c.lockNote || "", /silinemez/);
    await refusedWith("sil", ctx.api.del(`/api/workspace/cheques/${ids.idle}`), 409, "period-locked");
  });
  it("çalışıyor mu: açık dönemde işlem görmemiş çek → çekirdek açık, Sil var, not yok", async () => {
    const acc = ids.acc;
    const fresh = await must("çek 4", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", dueDate: localDay(30), issueDate: localDay(0), accountId: acc, serialNo: "İ3-4" }));
    const c = await detail(fresh.id);
    assert.equal(c.canEditCore, true);
    assert.equal(c.canDelete, true);
    assert.equal(c.coreNote || "", "");
    assert.equal(c.lockNote || "", "");
    await integrityOk(ctx.api, "İ3");
  });
});

// ============================================================ İ5 ============================================================
describe("İ5 — düzeltmede eksi bakiye sorusu düzeltmeyi anlatır (çıkış / yol önerisi değil)", () => {
  let ctx;
  const ids = {};
  before(async () => {
    ctx = await boot();
    const { api } = ctx;
    ids.pay = (await must("kayıt tahsilatı", api.post("/api/workspace/cases/K-1/payments", { amount: "1000", date: localDay(0), method: "cash", caseTitle: "Ali Kayıt" }))).id;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "Veli Cari", type: "customer" }));
    ids.acc = acc.id;
    ids.entry = (await must("cari tahsilat", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "800", date: localDay(0), method: "cash" }))).entryId;
    await drainCash(api, 200);
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: kayıt tahsilatı 1.000 → 500 → soru 'düzeltilince Nakit Kasa'dan 500,00 TL düşer', 'çıkış' yok, explained", async () => {
    const res = await refusedWith("düzelt", ctx.api.put(`/api/workspace/payments/${ids.pay}`, { amount: "500", date: localDay(0), note: "", method: "cash" }), 409, "cash-negative");
    assert.match(res.error, /Bu tahsilat 1\.000,00 TL'den 500,00 TL'ye düzeltilince Nakit Kasa'dan 500,00 TL düşer/);
    assert.match(res.error, /200,00 TL iken -300,00 TL olur/);
    assert.doesNotMatch(res.error, /çıkış/);
    assert.equal(res.raw.explained, true, "istemci yol önerisini eklemesin");
  });
  it("nasıl bozarım: kayıt tahsilatı nakit → havale → soru yol değişikliğini söyler", async () => {
    const res = await refusedWith("yol", ctx.api.put(`/api/workspace/payments/${ids.pay}`, { amount: "1000", date: localDay(0), note: "", method: "bank" }), 409, "cash-negative");
    assert.match(res.error, /Bu tahsilatın yolu Havale \/ EFT olarak değiştirilince Nakit Kasa'dan 1\.000,00 TL düşer/);
    assert.doesNotMatch(res.error, /çıkış/);
  });
  it("nasıl bozarım: cari tahsilatı 800 → 100 (2.0.25'ten beri aynı konusuz metin) → düzeltme metni", async () => {
    const res = await refusedWith("cari düzelt", ctx.api.put(`/api/workspace/accounts/${ids.acc}/entries/${ids.entry}`, { amount: "100" }), 409, "cash-negative");
    assert.match(res.error, /Bu tahsilat 800,00 TL'den 100,00 TL'ye düzeltilince Nakit Kasa'dan 700,00 TL düşer/);
    assert.equal(res.raw.explained, true);
  });
  it("çalışıyor mu: yeni Kasa ödemesinde (gerçek çıkış) metin ve yol önerisi aynı kalır (explained yok)", async () => {
    const res = await refusedWith("Kasa ödeme", ctx.api.post("/api/workspace/cash", { kind: "out", amount: "500", date: localDay(0), description: "Kira 2" }), 409, "cash-negative");
    assert.match(res.error, /Nakit kasada 200,00 TL var; 500,00 TL çıkış/);
    assert.notEqual(res.raw.explained, true);
  });
  it("çalışıyor mu: onayla (cashForce) düzeltme yazılır; Kasa -300", async () => {
    await must("düzelt onaylı", ctx.api.put(`/api/workspace/payments/${ids.pay}`, { amount: "500", date: localDay(0), note: "", method: "cash", cashForce: true }));
    assert.equal(await cashBalance(ctx.api), -300);
    await integrityOk(ctx.api, "İ5");
  });
});

// ============================================================ İ7 ============================================================
describe("İ7 — mahsuplu satırda yalnız değişen alan sınanır (2.0.25'ten kalan tutarsız satırda açıklama düzeltilir)", () => {
  let ctx;
  const ids = {};
  const D1 = localDay(-30);
  const D2 = localDay(-20);
  const D3 = localDay(-5);
  before(async () => {
    ctx = await boot();
    const { api, db } = ctx;
    const svc = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
    const cust = await must("cari", api.post("/api/workspace/accounts", { name: "Mahsup Müşteri", type: "customer", registeredOn: localDay(-60) }));
    ids.acc = cust.id;
    const inv = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: cust.id, issueDate: D1, lines: [{ itemId: svc.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open" } }));
    ids.a = (await must("Alacak Yaz A", api.post(`/api/workspace/accounts/${cust.id}/entries`, { kind: "credit", amount: "300", date: D1, note: "İndirim A" }))).entryId;
    ids.b = (await must("Alacak Yaz B", api.post(`/api/workspace/accounts/${cust.id}/entries`, { kind: "credit", amount: "200", date: D1, note: "İndirim B" }))).entryId;
    await must("mahsup A", api.post(`/api/workspace/invoices/${inv.id}/offsets`, { counterType: "entry", counterId: ids.a, amount: "300", date: D2 }));
    await must("mahsup B", api.post(`/api/workspace/invoices/${inv.id}/offsets`, { counterType: "entry", counterId: ids.b, amount: "200", date: D2 }));
    // 2.0.25'in izin verdiği düzeltmeler (bugünkü kod engeller): A'nın tarihi mahsuptan sonraya, B'nin tutarı mahsubun altına.
    // Eski sürüm verisi gibi doğrudan yazılır (2.0.25 ile üretilen aynı veride Mutabakat tutarlıydı).
    db.prepare("UPDATE account_entries SET date = ? WHERE id = ?").run(D3, ids.a);
    db.prepare("UPDATE account_entries SET amount = 150 WHERE id = ?").run(ids.b);
    ctx.server.app.integrity.start();
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: tarihi mahsuptan sonra kalmış satırda yalnız açıklama düzeltilir (200)", async () => {
    await must("A açıklama", ctx.api.put(`/api/workspace/accounts/${ids.acc}/entries/${ids.a}`, { note: "İndirim A (düzeltildi)" }));
    assert.equal(ctx.store.get("SELECT note FROM account_entries WHERE id = ?", ids.a).note, "İndirim A (düzeltildi)");
  });
  it("çalışıyor mu: tutarı mahsubun altında kalmış satırda yalnız açıklama düzeltilir (200)", async () => {
    await must("B açıklama", ctx.api.put(`/api/workspace/accounts/${ids.acc}/entries/${ids.b}`, { note: "İndirim B (düzeltildi)" }));
  });
  it("nasıl bozarım: tarihi başka bir mahsup sonrası güne taşımak ya da tutarı yine mahsubun altında değiştirmek 409", async () => {
    await refusedWith("A tarih", ctx.api.put(`/api/workspace/accounts/${ids.acc}/entries/${ids.a}`, { date: localDay(-4) }), 409, "offset-linked");
    await refusedWith("B tutar", ctx.api.put(`/api/workspace/accounts/${ids.acc}/entries/${ids.b}`, { amount: "160" }), 409, "offset-linked");
    await refusedWith("A yön", ctx.api.put(`/api/workspace/accounts/${ids.acc}/entries/${ids.a}`, { kind: "debt" }), 409, "offset-linked");
  });
  it("çalışıyor mu: tarihi mahsup gününe, tutarı mahsup tutarına geri almak 200", async () => {
    await must("A tarih geri", ctx.api.put(`/api/workspace/accounts/${ids.acc}/entries/${ids.a}`, { date: D2 }));
    await must("B tutar geri", ctx.api.put(`/api/workspace/accounts/${ids.acc}/entries/${ids.b}`, { amount: "200" }));
    await integrityOk(ctx.api, "İ7");
  });
});

// ============================================================ İ8 ============================================================
describe("İ8 — eski sürümden kalan ileri tarihli çek/senet: Mutabakat ne yapılacağını söyler, uyarı düzeyinde, tablo adı yok", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
    const stamp = new Date().toISOString();
    const future = localDay(10);
    // 2.0.25'te girilebilen ileri alış tarihli çek ve ileri veriliş tarihli senet (bugünkü kod engeller): doğrudan yazılır, sonra
    // güncellemeden sonraki açılış gibi kapı tabanı yeniden ölçülür.
    const cheque = ctx.db.prepare("INSERT INTO cheques (id, direction, instrument, serial_no, bank, drawer, account_id, plan_id, amount, issue_date, due_date, status, status_date, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, '', ?, '', '', ?, ?, ?, 'portfolio', ?, '', 'eski', ?, ?)");
    const event = ctx.db.prepare("INSERT INTO cheque_events (id, cheque_id, kind, date, amount, account_id, from_status, to_status, note, effects_json, method, created_by, created_at) VALUES (?, ?, ?, ?, ?, '', '', 'portfolio', '', '[]', 'cash', 'eski', ?)");
    cheque.run("cek-eski-1", "in", "cheque", "IL-1", "Portföy Müşterisi", 700, future, localDay(40), future, stamp, stamp);
    event.run("cev-eski-1", "cek-eski-1", "receive", future, 700, stamp);
    cheque.run("cek-eski-2", "out", "note", "IL-2", "Tedarikçi X", 300, future, localDay(40), future, stamp, stamp);
    event.run("cev-eski-2", "cek-eski-2", "issue", future, 300, stamp);
    ctx.server.app.integrity.start();
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: denetim adı kullanıcı diliyle (Çek/Senet Hareketleri), düzey uyarı, ne yapılacağı yazılı", async () => {
    const result = await must("mutabakat", ctx.api.get("/api/workspace/ledger/integrity"));
    const check = result.checks.find(item => item.code === "dates:future:cheque_events");
    assert.equal(check.ok, false, "gizlenmez (G4)");
    assert.equal(check.legacy, 2);
    assert.doesNotMatch(check.name, /cheque_events/);
    assert.match(check.name, /Çek\/Senet Hareketleri/);
    assert.equal(check.severity, "warning");
    assert.match(check.hint || "", /2 evrak/);
    assert.match(check.hint || "", /Düzenle/);
    assert.match(check.hint || "", /tarihi gelince kendiliğinden kalkar/);
    for (const item of result.checks) assert.doesNotMatch(item.name, /\((payments|cash_entries|account_entries|stock_moves|plan_entries|cheque_events)\)/, item.code);
  });
  it("çalışıyor mu: Defter Mutabakatı alt başlığı yolu söyler", async () => {
    const report = await must("rapor", ctx.api.get("/api/workspace/report-center/defter-mutabakati"));
    assert.match(report.subtitle, /Düzenle/);
    const row = report.rows.find(cells => String(cells[1]).includes("Çek/Senet Hareketleri") && String(cells[1]).includes("İleri tarihli"));
    assert.equal(row?.at(-1), "Eski Sürümden Kalan");
  });
  it("çalışıyor mu: söylenen yol işe yarar — alış tarihi bugüne çekilince satır kalkar; günlük iş engellenmez", async () => {
    const c = await must("çek", ctx.api.get("/api/workspace/cheques/cek-eski-1"));
    await must("alış tarihi bugün", ctx.api.put("/api/workspace/cheques/cek-eski-1", { issueDate: localDay(0), updatedAt: c.updatedAt }));
    const result = await must("mutabakat", ctx.api.get("/api/workspace/ledger/integrity"));
    assert.equal(result.checks.find(item => item.code === "dates:future:cheque_events").count, 1);
    await must("tahsilat", ctx.api.post("/api/workspace/cases/K-8/payments", { amount: "100", caseTitle: "A" }));
  });
  it("nasıl bozarım: yeni ileri tarihli çek olayı uyarı değil hata (kapı 409)", () => {
    const failed = error => error?.extra?.code === "ledger-integrity" && (error.failures || []).some(item => item.code === "dates:future:cheque_events");
    assert.throws(() => ctx.store.tx(() => ctx.store.run("INSERT INTO cheque_events (id, cheque_id, kind, date, amount, account_id, from_status, to_status, note, effects_json, method, created_by, created_at) VALUES ('cev-yeni', 'cek-eski-2', 'receive', ?, 0, '', 'portfolio', 'portfolio', '', '[]', 'cash', 'x', ?)", localDay(5), new Date().toISOString())), failed);
  });
});

// ============================================================ İ10 ============================================================
describe("İ10 — eksi bakiye denetimi Kasa özetini bir kez hesaplar", () => {
  let ctx;
  const ids = {};
  before(async () => {
    ctx = await boot();
    ids.pay = (await must("tahsilat", ctx.api.post("/api/workspace/cases/K-10/payments", { amount: "1000", date: localDay(0), method: "cash", caseTitle: "Ali" }))).id;
    await drainCash(ctx.api, 200);
  });
  after(async () => ctx.server.close());

  // Soru çıkan (409) istekte kapı çalışmaz; sayılan yalnız eksi bakiye denetiminin Kasa özeti sorgusudur.
  const countSummaries = async fn => {
    const { store } = ctx;
    const original = store.get;
    let n = 0;
    store.get = (sql, ...args) => {
      if (/AS cashAll/.test(sql)) n += 1;
      return original(sql, ...args);
    };
    try {
      await fn();
    } finally {
      store.get = original;
    }
    return n;
  };
  it("çalışıyor mu: tahsilat düzeltmesi ve silmesinde soru için Kasa özeti tek sorgu; soru ve sayılar aynı", async () => {
    const { api } = ctx;
    let edit;
    const editCount = await countSummaries(async () => {
      edit = await refusedWith("düzelt", api.put(`/api/workspace/payments/${ids.pay}`, { amount: "500", date: localDay(0), note: "", method: "cash" }), 409, "cash-negative");
    });
    assert.equal(editCount, 1, `düzeltmede Kasa özeti ${editCount} kez hesaplandı`);
    assert.match(edit.error, /200,00 TL iken -300,00 TL olur/);
    let remove;
    const removeCount = await countSummaries(async () => {
      remove = await refusedWith("sil", api.del(`/api/workspace/payments/${ids.pay}`), 409, "cash-negative");
    });
    assert.equal(removeCount, 1, `silmede Kasa özeti ${removeCount} kez hesaplandı`);
    assert.match(remove.error, /200,00 TL iken -800,00 TL olur/);
    assert.equal(ctx.store.get("SELECT amount FROM payments WHERE id = ?", ids.pay).amount, 1000);
  });
  it("nasıl bozarım: ileri tarihli ödeme ayrılmışken soru iki bakiyeden azını söyler (bugün 200, son 100)", async () => {
    const { api, db } = ctx;
    // Yarın tarihli 100 TL Kasa ödemesi (eski sürümden; bugünkü kod ileri tarih kabul etmez): bugünkü bakiye 200, son bakiye 100.
    db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-yarin', 'out', 100, ?, 'Eski ileri ödeme', 'cash', 'eski', ?)").run(localDay(1), new Date().toISOString());
    ctx.server.app.integrity.start();
    const res = await refusedWith("sil", api.del(`/api/workspace/payments/${ids.pay}`), 409, "cash-negative");
    assert.match(res.error, /Nakit Kasa 100,00 TL iken -900,00 TL olur/);
    const small = await must("küçük tahsilat", api.post("/api/workspace/cases/K-10/payments", { amount: "50", date: localDay(0), method: "cash", caseTitle: "Ali" }));
    await must("küçük tahsilatı sil (son bakiye 150 → 100, soru yok)", api.del(`/api/workspace/payments/${small.id}`));
  });
});
