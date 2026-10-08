// 2.0.26 — Aşama 0 (banka modülü öncesi ön düzeltmeler; docs/BANKA-MODULU-PLAN.md §11.1 ve §12.3).
// Her madde için iki tür test (CLAUDE.md test kuralı):
//   (1) çalışıyor mu — doğru kullanımda sonuç sayılarla (Kasa/banka toplamı, ödeme yolu, kart, mutabakat);
//   (2) nasıl bozarım — kilitli döneme/ileri tarihe yazdırma, eksiye düşüren silme, aynı anda iki silme, yazım ortasında arıza,
//       doğrudan SQL ile kilit altındaki satırı değiştirme, bozuk Silinenler yükü, tanınmayan ödeme yolu.
// Bu dosyadaki testler 2.0.25 kodunda (c2206bc) koşturulup kırmızı olanlar docs/2.0.26-KANIT.md'ye yazıldı.
// Saat ilerletmeli A13 testi ayrı dosyada (asama0-226-saat.test.mjs); gerçek SIGKILL testi asama0-226-kesinti.test.mjs.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const pad = n => String(n).padStart(2, "0");
const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = localDay(0);
const FUTURE = localDay(3);
const LOCK = "2025-06-30";
const LOCKED_DAY = "2025-03-10";
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
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
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
const byMethod = async api => (await must("kasa", api.get("/api/workspace/cash?method=all"))).byMethod;
const cashBalance = async api => (await must("kasa", api.get("/api/workspace/cash"))).totals.balance;
// Nakit Kasa'yı "leave" TL'ye indirir (bugün tarihli kira ödemesi): sonraki silme Kasa'yı eksiye düşürsün.
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
const restoreTrash = (api, store, ref) => api.post("/api/admin/trash/restore", { id: `trash:${trashIdOf(store, ref)}` });
const lockFailure = error => error?.extra?.code === "ledger-integrity" && (error.failures || []).some(item => item.code === "period-lock");

// ============================================================ A1 + B5 ============================================================
describe("A1 — kayıt (detay kartı) tahsilatı: tarih, kilit, eksi bakiye, Silinenler yolu", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: Havale/EFT kayıt tahsilatı sil → geri yükle → yine Havale/EFT; Kasa ve banka toplamı aynı", async () => {
    const { api, store } = ctx;
    const created = await must("tahsilat", api.post("/api/workspace/cases/DOSYA-1/payments", { amount: "1.500", date: OPEN_DAY, method: "bank", note: "Havale", caseTitle: "Ali Veli" }));
    const before = await byMethod(api);
    await must("sil", api.del(`/api/workspace/payments/${created.id}`));
    const deleted = await byMethod(api);
    assert.equal(deleted.bank, before.bank - 1500, "silinince banka tarafından düştü");
    assert.equal(deleted.cash, before.cash, "nakit değişmedi");
    await must("geri yükle", restoreTrash(api, store, created.id));
    const row = store.get("SELECT method, amount, date FROM payments WHERE id = ?", created.id);
    assert.equal(row.method, "bank", "geri yüklenen tahsilat Havale/EFT kalır (nakde dönmez)");
    assert.deepEqual(await byMethod(api), before, "Kasa (nakit) ve banka toplamı silmeden önceki gibi");
    await integrityOk(api, "geri yükleme sonrası");
  });

  it("çalışıyor mu: düzeltme ve silmenin denetim kaydında eski ödeme yolu var", async () => {
    const { api, store } = ctx;
    const created = await must("tahsilat", api.post("/api/workspace/cases/DOSYA-2/payments", { amount: "800", date: OPEN_DAY, method: "card", caseTitle: "Ayşe" }));
    await must("düzelt", api.put(`/api/workspace/payments/${created.id}`, { amount: "700", date: OPEN_DAY, note: "", method: "card" }));
    const updated = JSON.parse(store.get("SELECT payload_json AS p FROM audit_events WHERE type = 'case.payment.updated' AND entity_id = ?", created.id).p);
    assert.equal(updated.previous.method, "card", "düzeltmenin denetim kaydında eski yol");
    await must("sil", api.del(`/api/workspace/payments/${created.id}`));
    const trashed = JSON.parse(store.get("SELECT payload_json AS p FROM trash WHERE ref = ?", created.id).p);
    assert.equal(trashed.method, "card", "Silinenler yükünde yol var");
    const deleted = JSON.parse(store.get("SELECT payload_json AS p FROM audit_events WHERE type = 'case.payment.deleted' AND entity_id = ?", created.id).p);
    assert.equal(deleted.method, "card", "silmenin denetim kaydında yol");
  });

  it("nasıl bozarım: ileri tarihli kayıt tahsilatı → 400 date-future (kapıdaki belirsiz 409 değil)", async () => {
    const { api, store } = ctx;
    const count = store.get("SELECT COUNT(*) AS n FROM payments").n;
    await refusedWith("ileri tarih", api.post("/api/workspace/cases/DOSYA-3/payments", { amount: "100", date: FUTURE, caseTitle: "X" }), 400, "date-future");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM payments").n, count, "satır yazılmadı");
  });

  it("nasıl bozarım: geçersiz tarih ve tanınmayan yol reddedilir, sessizce bugün/nakit yazılmaz", async () => {
    const { api } = ctx;
    await refusedWith("geçersiz tarih", api.post("/api/workspace/cases/DOSYA-3/payments", { amount: "100", date: "2025-02-30", caseTitle: "X" }), 400);
    await refusedWith("tanınmayan yol", api.post("/api/workspace/cases/DOSYA-3/payments", { amount: "100", date: OPEN_DAY, method: "bitcoin", caseTitle: "X" }), 400, "pay-method-invalid");
  });

  it("nasıl bozarım: Kasa'yı eksiye düşüren silme ve düzeltme Uyar'da 409 cash-negative; onaylanırsa 200", async () => {
    const { api, store } = ctx;
    const created = await must("nakit tahsilat", api.post("/api/workspace/cases/DOSYA-4/payments", { amount: "1.000", date: OPEN_DAY, method: "cash", caseTitle: "Nakit" }));
    await drainCash(api, 200);
    await refusedWith("eksiye düşüren silme", api.del(`/api/workspace/payments/${created.id}`), 409, "cash-negative");
    await refusedWith("eksiye düşüren düzeltme", api.put(`/api/workspace/payments/${created.id}`, { amount: "100", date: OPEN_DAY, note: "", method: "cash" }), 409, "cash-negative");
    await refusedWith("nakitten havaleye taşıma da Kasa'yı düşürür", api.put(`/api/workspace/payments/${created.id}`, { amount: "1.000", date: OPEN_DAY, note: "", method: "bank" }), 409, "cash-negative");
    assert.ok(store.get("SELECT 1 AS found FROM payments WHERE id = ?", created.id), "tahsilat duruyor");
    await must("onaylı silme", api.del(`/api/workspace/payments/${created.id}?cashForce=1`));
    assert.equal(await cashBalance(api), -800);
    await integrityOk(api, "onaylı silme");
  });

  it("nasıl bozarım: aynı tahsilatı iki kişi aynı anda siler → biri 200, öbürü 404; Silinenler'de tek kayıt", async () => {
    const { api, store } = ctx;
    const created = await must("tahsilat", api.post("/api/workspace/cases/DOSYA-5/payments", { amount: "50", date: OPEN_DAY, method: "bank", caseTitle: "Çift" }));
    const results = await Promise.all([api.del(`/api/workspace/payments/${created.id}`), api.del(`/api/workspace/payments/${created.id}`)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 404]);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM trash WHERE ref = ?", created.id).n, 1, "Silinenler'de tek kayıt");
  });

  it("nasıl bozarım (B5): Silinenler'e yazım arızalanırsa (disk hatası benzetimi) tahsilat da silinmez — yarım kayıt yok", async () => {
    const { api, store, db } = ctx;
    const created = await must("tahsilat", api.post("/api/workspace/cases/DOSYA-6/payments", { amount: "75", date: OPEN_DAY, method: "bank", caseTitle: "Arıza" }));
    db.exec("CREATE TEMP TRIGGER t226_trash BEFORE INSERT ON main.trash BEGIN SELECT RAISE(ABORT, 'disk dolu (benzetim)'); END;");
    try {
      const res = await api.del(`/api/workspace/payments/${created.id}`);
      assert.notEqual(res.status, 200, "silme başarısız olmalı");
    } finally {
      db.exec("DROP TRIGGER IF EXISTS temp.t226_trash");
    }
    assert.ok(store.get("SELECT 1 AS found FROM payments WHERE id = ?", created.id), "tahsilat yerinde (silme geri alındı)");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM trash WHERE ref = ?", created.id).n, 0);
    await integrityOk(api, "arıza sonrası");
  });

  it("nasıl bozarım (B5): Kasa hareketi silinirken Silinenler yazımı arızalanırsa hareket de silinmez", async () => {
    const { api, store, db } = ctx;
    const created = await must("kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "60", date: TODAY, description: "Danışmanlık" }));
    db.exec("CREATE TEMP TRIGGER t226_trash BEFORE INSERT ON main.trash BEGIN SELECT RAISE(ABORT, 'disk dolu (benzetim)'); END;");
    try {
      // cashForce: eksi bakiye sorusu bu testin konusu değil; silme yalnız Silinenler arızasıyla durmalı.
      const res = await api.del(`/api/workspace/cash/${created.id}?cashForce=1`);
      assert.notEqual(res.status, 200, "silme başarısız olmalı");
      assert.notEqual(res.data?.code, "cash-negative");
    } finally {
      db.exec("DROP TRIGGER IF EXISTS temp.t226_trash");
    }
    assert.ok(store.get("SELECT 1 AS found FROM cash_entries WHERE id = ?", created.id), "Kasa hareketi yerinde");
  });

  it("nasıl bozarım: kilitli döneme kayıt tahsilatı 409 period-locked (ledger-integrity değil); kilitlideki tahsilat düzeltilmez, silinmez, kilide taşınmaz", async () => {
    const { api, store } = ctx;
    const old = await must("kilitlenecek tahsilat", api.post("/api/workspace/cases/DOSYA-7/payments", { amount: "300", date: LOCKED_DAY, method: "cash", caseTitle: "Eski" }));
    const open = await must("açık dönem tahsilatı", api.post("/api/workspace/cases/DOSYA-7/payments", { amount: "300", date: OPEN_DAY, method: "cash", caseTitle: "Eski" }));
    await setLock(api, LOCK);
    try {
      await refusedWith("kilitli döneme yeni tahsilat", api.post("/api/workspace/cases/DOSYA-7/payments", { amount: "10", date: LOCKED_DAY, caseTitle: "Eski" }), 409, "period-locked");
      await refusedWith("kilitlideki tahsilatı düzelt", api.put(`/api/workspace/payments/${old.id}`, { amount: "301", date: LOCKED_DAY, note: "", method: "cash" }), 409, "period-locked");
      await refusedWith("kilitlideki tahsilatı sil", api.del(`/api/workspace/payments/${old.id}?cashForce=1`), 409, "period-locked");
      await refusedWith("açık tahsilatı kilitli tarihe taşı", api.put(`/api/workspace/payments/${open.id}`, { amount: "300", date: LOCKED_DAY, note: "", method: "cash" }), 409, "period-locked");
      assert.equal(store.get("SELECT amount FROM payments WHERE id = ?", old.id).amount, 300);
      // Silinenler'deki kilitli dönem tahsilatı da geri yüklenmez (A7).
      await setLock(api, "");
      await must("kilitli günlü tahsilatı sil (kilit açıkken)", api.del(`/api/workspace/payments/${old.id}?cashForce=1`));
      await setLock(api, LOCK);
      await refusedWith("kilitli günlü tahsilatı geri yükle", restoreTrash(api, store, old.id), 409, "period-locked");
    } finally {
      await setLock(api, "");
    }
    await integrityOk(api, "kilit denemeleri sonrası");
  });
});

// ============================================================ A2 ============================================================
describe("A2 — Taksite Aktar ödeme yolunu korur", () => {
  let ctx;
  const NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const NOW = new Date();
  const monthOf = offset => {
    const date = new Date(NOW.getFullYear(), NOW.getMonth() + offset, 1);
    return { name: NAMES[date.getMonth()], year: date.getFullYear(), month: date.getMonth() + 1 };
  };
  const header = offset => `${monthOf(offset).name} ${monthOf(offset).year} taksiti`;
  const iso = (offset, day = 1) => `${monthOf(offset).year}-${pad(monthOf(offset).month)}-${pad(day)}`;
  before(async () => {
    ctx = await boot();
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: Havale/EFT ve POS kayıt tahsilatı karta taşınınca yol aynı; geri alınca kayda yine aynı yolla döner; Kasa/banka toplamı değişmez", async () => {
    const { api, store, server } = ctx;
    const matrix = [
      ["Ad Soyad", "Telefon", header(-2), header(-1), header(0), header(1), "Toplam", "Ödenen"],
      ["Ayşe Kaya", "0532 444 55 66", "5.000", "5.000", "5.000", "5.000", "20.000", ""],
    ];
    const staged = await must("yükle", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Okul", matrix }] }));
    await must("onayla", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const client = await loginAdmin(server);
    const rows = (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const key = rows.find(row => row["Ad Soyad"] === "Ayşe Kaya").__hofKey;
    const bank = await must("havale", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "2.500", date: iso(-1, 3), method: "bank", note: "Havale", caseTitle: "Ayşe Kaya" }));
    const card = await must("POS", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "1.000", date: iso(-1, 4), method: "card", note: "POS", caseTitle: "Ayşe Kaya" }));
    const before = await byMethod(api);
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: [key], fingerprint: preview.fingerprint }));
    assert.equal(result.paymentsMoved, 2);
    const moved = store.all("SELECT e.amount, e.method FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE p.import_id = ? AND e.opening = 0 ORDER BY e.amount", result.importId);
    assert.deepEqual(moved.map(row => [row.amount, row.method]), [[1000, "card"], [2500, "bank"]], "karta taşınan tahsilatlar yolunu korur");
    assert.deepEqual(await byMethod(api), before, "Kasa (nakit) ve banka/POS toplamı aynı");
    await integrityOk(api, "aktarım sonrası");
    const undone = await must("geri al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    assert.equal(undone.payments, 2);
    assert.equal(store.get("SELECT method FROM payments WHERE id = ?", bank.id).method, "bank", "geri alınınca kayıt tahsilatı Havale/EFT");
    assert.equal(store.get("SELECT method FROM payments WHERE id = ?", card.id).method, "card", "geri alınınca kayıt tahsilatı POS");
    assert.deepEqual(await byMethod(api), before, "geri almadan sonra da toplamlar aynı");
    await integrityOk(api, "geri alma sonrası");
  });
});

// ============================================================ A3 ============================================================
describe("A3 — kilitli dönemde hareketi olan cari: silme, geri yükleme, tür değişikliği; cari silmede eksi bakiye", () => {
  let ctx;
  const acc = {};
  const account = async (label, type = "customer") => must(`cari ${label}`, ctx.api.post("/api/workspace/accounts", { name: `A3 ${label}`, type, registeredOn: "2025-01-01" }));
  const entry = (id, body) => must("cari hareketi", ctx.api.post(`/api/workspace/accounts/${id}/entries`, body));
  before(async () => {
    ctx = await boot();
    // Her test kendi carisiyle (eski kodda bir testin yanlışlıkla başarılı silmesi sonrakini zincirleme kırmasın).
    for (const key of ["debt", "debtType", "debtName", "debtSql"]) {
      acc[key] = await account(`Yalnız Borç Yaz ${key}`);
      await entry(acc[key].id, { kind: "debt", amount: "1.000", date: LOCKED_DAY, note: "Borç yaz" });
    }
    for (const key of ["paid", "paid2"]) {
      acc[key] = await account(`Kilitli Tahsilat ${key}`);
      await entry(acc[key].id, { kind: "in", amount: "500", date: LOCKED_DAY, method: "cash" });
    }
    acc.gone = await account("Silinmiş");
    await entry(acc.gone.id, { kind: "credit", amount: "250", date: LOCKED_DAY, note: "Alacak yaz" });
    await must("sil (kilitten önce)", ctx.api.del(`/api/workspace/accounts/${acc.gone.id}`));
    acc.free = await account("Açık Dönem");
    await entry(acc.free.id, { kind: "debt", amount: "100", date: OPEN_DAY });
    acc.free2 = await account("Açık Dönem 2");
    await entry(acc.free2.id, { kind: "debt", amount: "100", date: OPEN_DAY });
    acc.guard = await account("Nakit Tahsilatlı");
    await entry(acc.guard.id, { kind: "in", amount: "1.000", date: OPEN_DAY, method: "cash" });
    await setLock(ctx.api, LOCK);
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: kilitli dönemde yalnız Borç Yaz satırı olan cariyi sil → 409 period-locked", async () => {
    await refusedWith("sil", ctx.api.del(`/api/workspace/accounts/${acc.debt.id}`), 409, "period-locked");
    assert.equal(ctx.store.get("SELECT deleted_at FROM accounts WHERE id = ?", acc.debt.id).deleted_at, null);
  });
  it("nasıl bozarım: kilitli dönemde hareketi olan carinin türünü Müşteri'den Tedarikçi'ye çevir → 409 period-locked", async () => {
    await refusedWith("tür", ctx.api.put(`/api/workspace/accounts/${acc.debtType.id}`, { type: "supplier" }), 409, "period-locked");
    assert.equal(ctx.store.get("SELECT type FROM accounts WHERE id = ?", acc.debtType.id).type, "customer");
  });
  it("çalışıyor mu: kilitli carinin adı ve telefonu düzeltilir (200)", async () => {
    const updated = await must("ad", ctx.api.put(`/api/workspace/accounts/${acc.debtName.id}`, { name: "A3 Yalnız Borç Yaz (düzeltildi)", phone: "0532 000 00 01" }));
    assert.equal(updated.name, "A3 Yalnız Borç Yaz (düzeltildi)");
    assert.equal(updated.type, "customer");
  });
  it("nasıl bozarım: kilitli dönemde parası (tahsilatı) olan cariyi sil → 409 period-locked", async () => {
    await refusedWith("sil", ctx.api.del(`/api/workspace/accounts/${acc.paid.id}`), 409, "period-locked");
  });
  it("nasıl bozarım: kilitli dönem satırı olan silinmiş cariyi geri yükle → 409 period-locked", async () => {
    await refusedWith("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `account:${acc.gone.id}` }), 409, "period-locked");
    assert.ok(ctx.store.get("SELECT deleted_at FROM accounts WHERE id = ?", acc.gone.id).deleted_at, "cari silinmiş kalır");
  });
  it("nasıl bozarım: kilit altındaki cari doğrudan SQL ile silinir ya da türü değişirse kilit izi (party_lock) yakalar", () => {
    const { store } = ctx;
    assert.throws(() => store.tx(() => store.run("UPDATE accounts SET type = 'supplier' WHERE id = ?", acc.debtSql.id)), lockFailure, "tür değişikliği geri alınmalı");
    assert.throws(() => store.tx(() => store.run("UPDATE accounts SET deleted_at = ?, deleted_by = 'saldirgan' WHERE id = ?", new Date().toISOString(), acc.debtSql.id)), lockFailure, "silme geri alınmalı");
    const row = store.get("SELECT type, deleted_at AS deletedAt FROM accounts WHERE id = ?", acc.debtSql.id);
    assert.deepEqual({ ...row }, { type: "customer", deletedAt: null });
  });
  it("çalışıyor mu: kilitli dönemde satırı olmayan cari silinir ve türü değişir (200)", async () => {
    await must("sil", ctx.api.del(`/api/workspace/accounts/${acc.free.id}`));
    const changed = await must("tür", ctx.api.put(`/api/workspace/accounts/${acc.free2.id}`, { type: "supplier" }));
    assert.equal(changed.type, "supplier");
    await integrityOk(ctx.api, "açık dönem carileri");
  });
  it("nasıl bozarım: Kasa'yı eksiye düşüren cari silme Uyar'da 409 cash-negative; onaylanırsa 200", async () => {
    await drainCash(ctx.api, 200);
    await refusedWith("sil", ctx.api.del(`/api/workspace/accounts/${acc.guard.id}`), 409, "cash-negative");
    assert.equal(ctx.store.get("SELECT deleted_at FROM accounts WHERE id = ?", acc.guard.id).deleted_at, null);
    await must("onaylı sil", ctx.api.del(`/api/workspace/accounts/${acc.guard.id}?cashForce=1`));
    assert.equal(await cashBalance(ctx.api), -800);
    await integrityOk(ctx.api, "cari silme sonrası");
  });
  it("çalışıyor mu: kilit kaldırılınca kilitli günlü cari silinir ve geri yüklenir; sayılar aynı", async () => {
    await setLock(ctx.api, "");
    const before = await byMethod(ctx.api);
    await must("sil", ctx.api.del(`/api/workspace/accounts/${acc.paid2.id}?cashForce=1`));
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `account:${acc.paid2.id}` }));
    assert.deepEqual(await byMethod(ctx.api), before);
    await integrityOk(ctx.api, "kilit açıkken sil/geri yükle");
  });
});

// ============================================================ A4 ============================================================
describe("A4 — taksit kartı silmede eksi bakiye; kilitli kartın geri yüklenmesi", () => {
  let ctx;
  const plans = {};
  const plan = (name, registeredOn, total = "3.000") => must(`kart ${name}`, ctx.api.post("/api/workspace/plans", { name, total, mode: "auto", count: 3, firstDue: registeredOn, registeredOn }));
  before(async () => {
    ctx = await boot();
    plans.cash = await plan("A4 Nakit Tahsilatlı", OPEN_DAY);
    await must("tahsilat", ctx.api.post(`/api/workspace/plans/${plans.cash.id}/entries`, { kind: "in", amount: "1.000", date: OPEN_DAY, method: "cash" }));
    plans.locked = await plan("A4 Kilitli Kart", LOCKED_DAY, "2.000");
    await must("sil (kilitten önce)", ctx.api.del(`/api/workspace/plans/${plans.locked.id}`));
    plans.open = await plan("A4 Açık Kart", OPEN_DAY, "1.200");
    await must("sil", ctx.api.del(`/api/workspace/plans/${plans.open.id}`));
    await setLock(ctx.api, LOCK);
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: Kasa'yı eksiye düşüren kart silme Uyar'da 409 cash-negative; onaylanırsa 200", async () => {
    await drainCash(ctx.api, 200);
    await refusedWith("kart sil", ctx.api.del(`/api/workspace/plans/${plans.cash.id}`), 409, "cash-negative");
    assert.equal(ctx.store.get("SELECT deleted_at FROM plans WHERE id = ?", plans.cash.id).deleted_at, null);
    await must("onaylı sil", ctx.api.del(`/api/workspace/plans/${plans.cash.id}?cashForce=1`));
    assert.equal(await cashBalance(ctx.api), -800);
    await integrityOk(ctx.api, "kart silme sonrası");
  });
  it("nasıl bozarım: Kayıt Tarihi kilitli dönemde olan silinmiş kartı geri yükle → 409 period-locked", async () => {
    await refusedWith("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `plan:${plans.locked.id}` }), 409, "period-locked");
    assert.ok(ctx.store.get("SELECT deleted_at FROM plans WHERE id = ?", plans.locked.id).deleted_at);
  });
  it("çalışıyor mu: açık dönemdeki silinmiş kart geri yüklenir (200)", async () => {
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `plan:${plans.open.id}` }));
    assert.equal(ctx.store.get("SELECT deleted_at FROM plans WHERE id = ?", plans.open.id).deleted_at, null);
    await integrityOk(ctx.api, "kart geri yükleme");
  });
});

// ============================================================ A6 ============================================================
describe("A6 — çek/senet: alış/veriliş tarihi, dönem kilidi, kilit izi, ileri tarih", () => {
  let ctx;
  const ch = {};
  let serial = 0;
  const cheque = (issueDate, extra = {}) => ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.500", issueDate, dueDate: "2026-12-31", drawer: "Keşideci A", serialNo: `A6-${(serial += 1)}`, bank: "Ziraat", ...extra });
  before(async () => {
    ctx = await boot();
    // Her test kendi evrakıyla (eski kodda bir testin yanlışlıkla başarılı silmesi sonrakini zincirleme kırmasın).
    ch.locked = await must("kilitlenecek çek", cheque(LOCKED_DAY));
    ch.edit = await must("düzenlenecek çek", cheque(LOCKED_DAY));
    ch.note = await must("notu düzeltilecek çek", cheque(LOCKED_DAY));
    ch.sql = await must("SQL ile denenecek çek", cheque(LOCKED_DAY));
    ch.gone = await must("silinecek çek", cheque(LOCKED_DAY));
    await must("sil (kilitten önce)", ctx.api.del(`/api/workspace/cheques/${ch.gone.id}`));
    ch.collect = await must("tahsil edilecek çek", cheque(LOCKED_DAY));
    await setLock(ctx.api, LOCK);
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: bugün tarihli çek 200; alış tarihi yazılmazsa bugün", async () => {
    const today = await must("bugün", cheque(TODAY));
    assert.equal(today.issueDate, TODAY);
    const plain = await must("tarihsiz", ctx.api.post("/api/workspace/cheques", { direction: "out", instrument: "note", amount: "200", dueDate: "2026-12-31", drawer: "Lehtar B" }));
    assert.equal(plain.issueDate, TODAY);
    await integrityOk(ctx.api, "bugünkü çek");
  });
  it("nasıl bozarım: ileri tarihli alış tarihi → 400 date-future", async () => {
    const count = ctx.store.get("SELECT COUNT(*) AS n FROM cheques").n;
    await refusedWith("ileri tarihli çek", cheque(FUTURE), 400, "date-future");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM cheques").n, count);
  });
  it("nasıl bozarım: kilitli dönem alış tarihiyle yeni çek → 409 period-locked", async () => {
    await refusedWith("kilitli çek", cheque(LOCKED_DAY), 409, "period-locked");
  });
  it("nasıl bozarım: kilitli dönemdeki çeki sil → 409 period-locked", async () => {
    await refusedWith("sil", ctx.api.del(`/api/workspace/cheques/${ch.locked.id}`), 409, "period-locked");
    assert.equal(ctx.store.get("SELECT deleted_at FROM cheques WHERE id = ?", ch.locked.id).deleted_at, null);
  });
  it("nasıl bozarım: kilitli dönemdeki çekin tutarını ya da alış tarihini düzenle → 409 period-locked", async () => {
    await refusedWith("tutar", ctx.api.put(`/api/workspace/cheques/${ch.edit.id}`, { amount: "2.000" }), 409, "period-locked");
    await refusedWith("tarihi açık döneme taşı", ctx.api.put(`/api/workspace/cheques/${ch.edit.id}`, { issueDate: OPEN_DAY }), 409, "period-locked");
    const row = ctx.store.get("SELECT amount, issue_date AS issueDate FROM cheques WHERE id = ?", ch.edit.id);
    assert.deepEqual({ ...row }, { amount: 1500, issueDate: LOCKED_DAY });
  });
  it("çalışıyor mu: kilitli dönemdeki çekin vadesi, notu ve seri bilgisi düzeltilir (para değil)", async () => {
    const updated = await must("vade/not", ctx.api.put(`/api/workspace/cheques/${ch.note.id}`, { dueDate: "2027-01-15", note: "Vade ertelendi" }));
    assert.equal(updated.dueDate, "2027-01-15");
  });
  it("çalışıyor mu: kilitli ayda alınan çek bugün tahsil edilir ve geri alınır", async () => {
    const collected = await must("tahsil", ctx.api.post(`/api/workspace/cheques/${ch.collect.id}/actions`, { action: "collect", date: TODAY, method: "bank" }));
    assert.equal(collected.status, "collected");
    await integrityOk(ctx.api, "tahsil");
    const undone = await must("geri al", ctx.api.post(`/api/workspace/cheques/${ch.collect.id}/undo`, {}));
    assert.equal(undone.status, "portfolio");
  });
  it("nasıl bozarım: kilitli dönemdeki silinmiş çeki geri yükle → 409 period-locked", async () => {
    await refusedWith("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `cheque:${ch.gone.id}` }), 409, "period-locked");
  });
  it("nasıl bozarım: kilitli dönemdeki çek ya da olayı doğrudan SQL ile değişirse kilit izi yakalar", () => {
    const { store } = ctx;
    assert.throws(() => store.tx(() => store.run("UPDATE cheque_events SET amount = 999 WHERE cheque_id = ?", ch.sql.id)), lockFailure, "çek olayı tutarı");
    assert.throws(() => store.tx(() => store.run("UPDATE cheques SET amount = 999 WHERE id = ?", ch.sql.id)), lockFailure, "çek tutarı");
    assert.throws(() => store.tx(() => store.run("UPDATE cheques SET deleted_at = ?, deleted_by = 'saldirgan' WHERE id = ?", new Date().toISOString(), ch.sql.id)), lockFailure, "çek silme");
  });
  it("nasıl bozarım: ileri tarihli çek olayı doğrudan SQL ile eklenirse kapı yakalar (dates:future:cheque_events)", () => {
    const { store } = ctx;
    const futureFailure = error => error?.extra?.code === "ledger-integrity" && (error.failures || []).some(item => item.code === "dates:future:cheque_events");
    assert.throws(
      () => store.tx(() => store.run("INSERT INTO cheque_events (id, cheque_id, kind, date, amount, to_status, created_by, created_at) VALUES ('cev-ileri', ?, 'bounce', ?, 1500, 'bounced', 'x', ?)", ch.locked.id, FUTURE, new Date().toISOString())),
      futureFailure,
    );
  });
  it("nasıl bozarım: Excel'den toplu alımda ileri tarihli ya da kilitli dönem alış tarihi olan satır nedeniyle atlanır", async () => {
    const day = iso => iso.split("-").reverse().join(".");
    const matrix = [["Vade", "Tutar", "Keşideci", "Alış Tarihi", "Seri No"], ["31.12.2026", "100", "Toplu A", day(FUTURE), "T-1"], ["31.12.2026", "200", "Toplu B", day(LOCKED_DAY), "T-2"], ["31.12.2026", "300", "Toplu C", day(OPEN_DAY), "T-3"]];
    const result = await must("toplu alım", ctx.api.post("/api/workspace/cheques/import", { matrix, headerAt: 0, roles: { 0: "due", 1: "amount", 2: "drawer", 3: "issue", 4: "serial" } }));
    assert.equal(result.created, 1, "yalnız açık dönemdeki satır alındı");
    assert.equal(result.skippedTotal, 2);
    assert.ok(result.skipped.some(item => /ileri tarihli/i.test(item.reason)), JSON.stringify(result.skipped));
    assert.ok(result.skipped.some(item => /kilitli|kapatılmış/i.test(item.reason)), JSON.stringify(result.skipped));
    await integrityOk(ctx.api, "toplu alım");
  });
});

// ============================================================ A7 ============================================================
describe("A7 — Silinenler'den geri yükleme: bütün kolonlar, kuruş, dönem kilidi", () => {
  let ctx;
  let svc;
  let customer;
  const old = {};
  before(async () => {
    ctx = await boot();
    const { api } = ctx;
    svc = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
    customer = await must("cari", api.post("/api/workspace/accounts", { name: "A7 Müşteri", type: "customer", registeredOn: "2025-01-01" }));
    // Kilitlenecek dönemde: Kasa girişi, kayıt tahsilatı, cari borcu, taksit tahsilatı (hepsi silinir, sonra kilit konur).
    old.cash = await must("kasa", api.post("/api/workspace/cash", { kind: "in", amount: "300", date: LOCKED_DAY, description: "Eski giriş" }));
    old.payment = await must("tahsilat", api.post("/api/workspace/cases/ESKI-1/payments", { amount: "200", date: LOCKED_DAY, caseTitle: "Eski" }));
    const debt = await must("borç", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "150", date: LOCKED_DAY }));
    old.entry = { id: debt.entryId };
    const plan = await must("kart", api.post("/api/workspace/plans", { name: "A7 Kart", total: "900", mode: "auto", count: 3, firstDue: LOCKED_DAY, registeredOn: "2025-01-05" }));
    const planEntry = await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", date: LOCKED_DAY }));
    old.planEntry = { id: planEntry.entryId, planId: plan.id };
    await must("kasa sil", api.del(`/api/workspace/cash/${old.cash.id}`));
    await must("tahsilat sil", api.del(`/api/workspace/payments/${old.payment.id}`));
    await must("borç sil", api.del(`/api/workspace/accounts/${customer.id}/entries/${old.entry.id}`));
    await must("taksit tahsilatı sil", api.del(`/api/workspace/plans/${plan.id}/entries/${old.planEntry.id}`));
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: Kapatılacak Fatura'ya bağlı tahsilat sil → geri yükle → fatura bağı, yolu ve kaynağı aynı; faturanın açığı eski hâline döner", async () => {
    const { api, store } = ctx;
    const invoice = await must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: OPEN_DAY, lines: [{ itemId: svc.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open" } }));
    const paid = await must("bağlı tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "400", date: OPEN_DAY, method: "bank", invoiceId: invoice.id }));
    const openBefore = (await must("fatura", api.get(`/api/workspace/invoices/${invoice.id}`))).open;
    assert.equal(openBefore, 600);
    await must("sil", api.del(`/api/workspace/accounts/${customer.id}/entries/${paid.entryId}`));
    await must("geri yükle", restoreTrash(api, store, paid.entryId));
    const row = store.get("SELECT invoice_id AS invoiceId, method, source, amount FROM account_entries WHERE id = ?", paid.entryId);
    assert.deepEqual({ ...row }, { invoiceId: invoice.id, method: "bank", source: "", amount: 400 }, "bütün kolonlar geri geldi");
    assert.equal((await must("fatura", api.get(`/api/workspace/invoices/${invoice.id}`))).open, openBefore, "fatura yine 400 kapanmış");
    await integrityOk(api, "bağlı tahsilat geri yükleme");
  });
  it("nasıl bozarım: Silinenler yükündeki tutar kuruş artığı taşırsa (100,004) geri yüklemede kuruşa yuvarlanır, kapı 409 vermez", async () => {
    const { api, store } = ctx;
    const created = await must("tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "100", date: OPEN_DAY, method: "cash" }));
    await must("sil", api.del(`/api/workspace/accounts/${customer.id}/entries/${created.entryId}`));
    const trashId = trashIdOf(store, created.entryId);
    const payload = JSON.parse(store.get("SELECT payload_json AS p FROM trash WHERE id = ?", trashId).p);
    store.run("UPDATE trash SET payload_json = ? WHERE id = ?", JSON.stringify({ ...payload, amount: 100.004 }), trashId);
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${trashId}` }));
    assert.equal(store.get("SELECT amount FROM account_entries WHERE id = ?", created.entryId).amount, 100);
  });
  it("çalışıyor mu: Kasa ↔ Banka transferi silinip geri yüklenince iki tarafı birlikte döner", async () => {
    const { api, store } = ctx;
    const before = await byMethod(api);
    const transfer = await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "500", date: TODAY }));
    await must("sil", api.del(`/api/workspace/cash/${transfer.id}`));
    await must("geri yükle", restoreTrash(api, store, transfer.id));
    const after = await byMethod(api);
    assert.equal(after.cash, before.cash + 500);
    assert.equal(after.bank, before.bank - 500);
    await integrityOk(api, "transfer geri yükleme");
  });
  describe("kilit konduktan sonra kilitli dönemdeki satırlar geri yüklenmez (409 period-locked, ledger-integrity değil)", () => {
    before(async () => setLock(ctx.api, LOCK));
    it("Kasa hareketi", async () => refusedWith("kasa", restoreTrash(ctx.api, ctx.store, old.cash.id), 409, "period-locked"));
    it("kayıt tahsilatı", async () => refusedWith("tahsilat", restoreTrash(ctx.api, ctx.store, old.payment.id), 409, "period-locked"));
    it("cari hareketi", async () => refusedWith("cari", restoreTrash(ctx.api, ctx.store, old.entry.id), 409, "period-locked"));
    it("taksit hareketi", async () => refusedWith("taksit", restoreTrash(ctx.api, ctx.store, old.planEntry.id), 409, "period-locked"));
    it("mutabakat bozulmadı", async () => integrityOk(ctx.api, "kilitli geri yükleme denemeleri"));
  });
});

// ============================================================ A9 ============================================================
describe("A9 — mahsupta kullanılan Alacak Yaz satırı", () => {
  let ctx;
  let customer;
  let invoice;
  let credit;
  let offsetId;
  before(async () => {
    ctx = await boot();
    const { api } = ctx;
    const svc = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
    customer = await must("cari", api.post("/api/workspace/accounts", { name: "A9 Müşteri", type: "customer", registeredOn: "2025-01-01" }));
    invoice = await must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: OPEN_DAY, lines: [{ itemId: svc.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open" } }));
    credit = await must("alacak yaz", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "credit", amount: "300", date: OPEN_DAY, note: "İndirim" }));
    const offset = await must("mahsup", api.post(`/api/workspace/invoices/${invoice.id}/offsets`, { counterType: "entry", counterId: credit.entryId, amount: "300", date: OPEN_DAY }));
    offsetId = offset.offsetId;
  });
  after(async () => ctx.server.close());

  it("nasıl bozarım: mahsuptaki satırı sil → 409 offset-linked, nedeni 'Önce mahsubu kaldırın'", async () => {
    const res = await refusedWith("sil", ctx.api.del(`/api/workspace/accounts/${customer.id}/entries/${credit.entryId}`), 409, "offset-linked");
    assert.match(res.error, /mahsubu kaldırın/i);
    assert.ok(ctx.store.get("SELECT 1 AS found FROM account_entries WHERE id = ?", credit.entryId));
  });
  it("nasıl bozarım: mahsuptaki satırın tutarını mahsubun altına indir ya da yönünü çevir → 409 offset-linked", async () => {
    await refusedWith("tutar", ctx.api.put(`/api/workspace/accounts/${customer.id}/entries/${credit.entryId}`, { amount: "200" }), 409, "offset-linked");
    await refusedWith("yön", ctx.api.put(`/api/workspace/accounts/${customer.id}/entries/${credit.entryId}`, { kind: "debt" }), 409, "offset-linked");
    assert.equal(ctx.store.get("SELECT kind, amount FROM account_entries WHERE id = ?", credit.entryId).amount, 300);
  });
  it("çalışıyor mu: mahsuptaki satırın açıklaması düzeltilir; tutar mahsuptan büyük kalacak şekilde artırılır", async () => {
    await must("açıklama", ctx.api.put(`/api/workspace/accounts/${customer.id}/entries/${credit.entryId}`, { note: "İndirim (düzeltildi)" }));
    await must("artır", ctx.api.put(`/api/workspace/accounts/${customer.id}/entries/${credit.entryId}`, { amount: "350" }));
    await integrityOk(ctx.api, "açıklama/tutar");
  });
  it("çalışıyor mu: mahsubu kaldırıp satırı silme 200; mutabakat 0", async () => {
    await must("mahsubu kaldır", ctx.api.del(`/api/workspace/invoices/${invoice.id}/offsets/${offsetId}`));
    await must("sil", ctx.api.del(`/api/workspace/accounts/${customer.id}/entries/${credit.entryId}`));
    assert.equal((await must("fatura", ctx.api.get(`/api/workspace/invoices/${invoice.id}`))).open, 1000);
    await integrityOk(ctx.api, "mahsup kaldırıldıktan sonra");
  });
});

// ============================================================ B7 ============================================================
describe("B7 — tanınmayan ödeme yolu: iç yazıcılarda hata (sessiz nakit yok), kapıda money:method; eski veri okunur", () => {
  let ctx;
  let customer;
  before(async () => {
    ctx = await boot();
    customer = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "B7 Cari", type: "customer", registeredOn: "2025-01-01" }));
  });
  after(async () => ctx.server.close());
  const methodError = error => error?.extra?.code === "pay-method-invalid";

  it("nasıl bozarım: iç yazıcıya (cari satırı yazan servis) 'bitcoin' yolu → hata; satır yazılmaz", () => {
    const { server, store } = ctx;
    const admin = store.get("SELECT * FROM users WHERE username = 'admin'");
    const count = store.get("SELECT COUNT(*) AS n FROM account_entries").n;
    assert.throws(() => store.tx(() => server.app.context.accounts.invoiceEntry.add(admin, customer.id, { kind: "in", amount: 10, date: OPEN_DAY, note: "x", invoiceId: "", method: "bitcoin" })), methodError);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM account_entries").n, count);
  });
  it("nasıl bozarım: Silinenler yükündeki yol bozuksa (stok hareketi 'bitcoin') geri yükleme 400; nakit sayılmaz", async () => {
    const { api, store } = ctx;
    const item = await must("ürün", api.post("/api/workspace/stock", { kind: "product", code: "B7", name: "B7 Ürün", unit: "Adet", salePrice: "50" }));
    const moved = await must("satış", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: 2, unitPrice: 50, pay: "cash", method: "bank", date: OPEN_DAY }));
    await must("sil", api.del(`/api/workspace/stock/${item.id}/moves/${moved.moveId}`));
    const trashId = trashIdOf(store, moved.moveId);
    const payload = JSON.parse(store.get("SELECT payload_json AS p FROM trash WHERE id = ?", trashId).p);
    store.run("UPDATE trash SET payload_json = ? WHERE id = ?", JSON.stringify({ ...payload, method: "bitcoin" }), trashId);
    await refusedWith("geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${trashId}` }), 400, "pay-method-invalid");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM stock_moves WHERE id = ?", moved.moveId).n, 0, "hareket yazılmadı");
  });
  it("nasıl bozarım: kayıt tahsilatı yükünde yol bozuksa geri yükleme 400 (kapıdaki gl:100 sapması değil)", async () => {
    const { api, store } = ctx;
    const created = await must("tahsilat", api.post("/api/workspace/cases/B7-1/payments", { amount: "40", date: OPEN_DAY, method: "card", caseTitle: "B7" }));
    await must("sil", api.del(`/api/workspace/payments/${created.id}`));
    const trashId = trashIdOf(store, created.id);
    const payload = JSON.parse(store.get("SELECT payload_json AS p FROM trash WHERE id = ?", trashId).p);
    store.run("UPDATE trash SET payload_json = ? WHERE id = ?", JSON.stringify({ ...payload, method: "bitcoin" }), trashId);
    await refusedWith("geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${trashId}` }), 400, "pay-method-invalid");
  });
  it("nasıl bozarım: para tablosuna tanınmayan yolla satır yazan işlemi kapı 'money:method' adıyla geri alır", () => {
    const { store } = ctx;
    const named = error => error?.extra?.code === "ledger-integrity" && (error.failures || []).some(item => item.code === "money:method");
    assert.throws(() => store.tx(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-btc', 'in', 10, ?, 'x', 'bitcoin', 'x', ?)", OPEN_DAY, new Date().toISOString())), named);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'cash-btc'").n, 0);
  });
  it("çalışıyor mu: geçerli yollar (Nakit, Havale/EFT, POS) her yazıcıda aynen yazılır", async () => {
    const { api, store } = ctx;
    for (const method of ["cash", "bank", "card"]) {
      const created = await must(`cari ${method}`, api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "10", date: OPEN_DAY, method }));
      assert.equal(store.get("SELECT method FROM account_entries WHERE id = ?", created.entryId).method, method);
      const payment = await must(`kayıt ${method}`, api.post("/api/workspace/cases/B7-2/payments", { amount: "10", date: OPEN_DAY, method, caseTitle: "B7" }));
      assert.equal(store.get("SELECT method FROM payments WHERE id = ?", payment.id).method, method);
    }
    await integrityOk(api, "geçerli yollar");
  });
  it("çalışıyor mu: eski veride tanınmayan yolla kalmış satır açılışta taban sayılır; yeni işlemler engellenmez, Kasa okunmaya devam eder", async () => {
    const { api, server, db } = ctx;
    db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-eski', 'in', 25, ?, 'Eski sürüm', 'eski', 'x', ?)").run(OPEN_DAY, new Date().toISOString());
    server.app.integrity.start();
    await must("yeni tahsilat", api.post("/api/workspace/cases/B7-3/payments", { amount: "15", date: OPEN_DAY, method: "bank", caseTitle: "B7" }));
    const cash = await must("kasa", api.get("/api/workspace/cash?method=all"));
    assert.ok(cash.entries.some(entry => entry.id === "cash-eski"), "eski satır Kasa'da okunur");
    db.prepare("DELETE FROM cash_entries WHERE id = 'cash-eski'").run();
    server.app.integrity.start();
  });
});

// ============================================================ A12 ============================================================
describe("A12 — dönem kilidi varken 'Tüm Hareketleri Sil'", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
    const { api } = ctx;
    const customer = await must("cari", api.post("/api/workspace/accounts", { name: "A12 Cari", type: "customer", registeredOn: "2025-01-01" }));
    await must("borç", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "1.000", date: LOCKED_DAY }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "400", date: OPEN_DAY, method: "bank" }));
    await must("kasa", api.post("/api/workspace/cash", { kind: "in", amount: "250", date: LOCKED_DAY, description: "Eski" }));
    await setLock(api, LOCK);
  });
  after(async () => ctx.server.close());

  it("çalışıyor mu: kilit varken Tüm Hareketleri Sil 200; kilit kalkar, denetim kaydı yazılır, mutabakat 0, kartlar kalır", async () => {
    const { api, store } = ctx;
    const result = await must("sıfırla", api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal(result.unlocked, LOCK, "yanıtta kaldırılan kilit");
    assert.equal((await must("kilit", api.get("/api/workspace/ledger/lock"))).lockedUntil, "", "kilit kalktı");
    const types = store.all("SELECT type, payload_json AS p FROM audit_events WHERE type IN ('ledger.period.unlocked', 'company.reset')").map(row => row.type);
    assert.ok(types.includes("ledger.period.unlocked"), "kilidin kalktığı denetim kaydında");
    assert.ok(types.includes("company.reset"));
    const unlocked = JSON.parse(store.get("SELECT payload_json AS p FROM audit_events WHERE type = 'ledger.period.unlocked'").p);
    assert.equal(unlocked.previous, LOCK);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM account_entries").n, 0);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").n, 1, "cari kartı kalır");
    assert.deepEqual(await byMethod(api), { cash: 0, bank: 0, card: 0 });
    await integrityOk(api, "sıfırlama sonrası");
    await must("yeni hareket", api.post("/api/workspace/cash", { kind: "in", amount: "10", date: LOCKED_DAY, description: "Kilit kalktı" }));
  });
  it("çalışıyor mu: kilit yokken de aynı (yanıtta kilit boş, kilit kaydı yazılmaz)", async () => {
    const { api, store } = ctx;
    await setLock(api, "");
    const result = await must("sıfırla", api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal(result.unlocked || "", "");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'ledger.period.unlocked'").n, 0);
  });
  it("çalışıyor mu: kilit varken Tümünü Sıfırla da 200", async () => {
    const { api } = ctx;
    await setLock(api, "");
    await must("kasa", api.post("/api/workspace/cash", { kind: "in", amount: "10", date: LOCKED_DAY, description: "Eski" }));
    await setLock(api, LOCK);
    await must("tümünü sıfırla", api.post("/api/companies/sirket-001/reset", { mode: "all", confirm: "001", password: ADMIN_PASSWORD }));
    assert.equal((await must("kilit", api.get("/api/workspace/ledger/lock"))).lockedUntil, "");
    await integrityOk(api, "tümünü sıfırla");
  });
});
