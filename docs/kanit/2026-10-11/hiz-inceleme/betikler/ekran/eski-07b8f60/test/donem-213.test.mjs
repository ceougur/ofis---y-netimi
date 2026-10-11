// 2.0.13 — dört çekirdeğin (Kasa, Cari, Stok, Taksit) tarih ve dönem kuralları, iade sınırı ve yerel mutabakat aracı.
//   · Tarih: alan yoksa bugün; boş/null/geçersiz/ileri tarih reddedilir (400), kilitli dönem 409.
//   · Vade Kayıt Tarihi'nden önce olamaz; Kayıt Tarihi ileri olamaz.
//   · Dönem kilidi: ekleme, düzeltme, silme ve kilitli döneme taşıma engellenir; ham yazım da kapıda geri alınır.
//   · Taksit iadesi net tahsilatı aşamaz.
//   · npm run mutabakat: veritabanını değiştirmeden denetler, sapmada çıkış kodu 1.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { IntegrityError } from "../server/lib/integrity.mjs";
import { createPeriod, isIsoDate } from "../server/lib/period.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = (response, label) => {
  assert.equal(response.status, 200, `${label}: ${JSON.stringify(response.data)}`);
  return response.data.data;
};
const rejected = (response, status, code, label) => {
  assert.equal(response.status, status, `${label}: ${JSON.stringify(response.data)}`);
  assert.equal(response.data.code, code, `${label}: ${JSON.stringify(response.data)}`);
};

describe("tarih kuralı (period.mjs)", () => {
  const settings = new Map();
  const store = { setting: key => settings.get(key) ?? "", setSetting: (key, value) => settings.set(key, value) };
  const period = createPeriod({ store, now: () => new Date(2026, 8, 30, 0, 30) }); // 30.09.2026 00:30 yerel
  const code = fn => {
    try {
      fn();
      return "ok";
    } catch (error) {
      return error.extra?.code || error.code || error.message;
    }
  };

  it("takvim: artık yıl, ay sonu, biçim", () => {
    assert.equal(isIsoDate("2028-02-29"), true);
    assert.equal(isIsoDate("2026-02-29"), false);
    assert.equal(isIsoDate("2026-04-31"), false);
    assert.equal(isIsoDate("2026-13-01"), false);
    assert.equal(isIsoDate("31.12.2026"), false);
    assert.equal(isIsoDate(null), false);
  });

  it("bugün yerel takvimle (gece yarısından sonra dün değil)", () => {
    assert.equal(period.today(), "2026-09-30");
    assert.equal(period.movementDate({}), "2026-09-30", "alan yoksa bugün");
  });

  it("boş, null, geçersiz ve ileri tarih reddedilir", () => {
    const cases = { "": "date-missing", "   ": "date-missing", "2026-02-30": "date-invalid", "30.09.2026": "date-invalid", abc: "date-invalid", "2026-10-01": "date-future", "2026-09-30": "ok", "2020-01-01": "ok" };
    for (const [value, want] of Object.entries(cases)) {
      const got = code(() => period.movementDate({ date: value }));
      assert.ok(got === want || (want !== "ok" && got !== "ok"), `${JSON.stringify(value)} → ${got}`);
    }
    assert.notEqual(code(() => period.movementDate({ date: null })), "ok");
  });

  it("vade işlem tarihinden önce olamaz; aynı gün olabilir", () => {
    assert.equal(code(() => period.dueDate("2026-09-29", { from: "2026-09-30" })), "due-before-start");
    assert.equal(period.dueDate("2026-09-30", { from: "2026-09-30" }), "2026-09-30");
    assert.equal(code(() => period.dueDate("2026-02-30", { from: "2026-01-01" })), "date-invalid");
  });

  it("kilit: gelecek kilitlenemez; kilit günü ve öncesi kapalı, ertesi gün açık", () => {
    assert.notEqual(code(() => period.setLock("2026-10-01")), "ok");
    period.setLock("2026-08-31");
    assert.equal(code(() => period.movementDate({ date: "2026-08-31" })), "period-locked");
    assert.equal(period.movementDate({ date: "2026-09-01" }), "2026-09-01");
    period.setLock("");
    assert.equal(period.movementDate({ date: "2026-08-31" }), "2026-08-31");
  });
});

describe("dört çekirdekte tarih, dönem kilidi ve iade sınırı (API)", () => {
  let server;
  let admin;
  let store;
  let today;
  let customer;
  let item;
  const shift = days => {
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().slice(0, 10);
  };
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    store = server.app.store;
    today = server.app.period.today();
    customer = data(await admin.post("/api/workspace/accounts", { name: "Nazlı Deniz", registeredOn: shift(-60) }), "cari");
    item = data(await admin.post("/api/workspace/stock", { name: "Un", unit: "Kg", unitPrice: "20", salePrice: "30", openingQty: "100", openingDate: shift(-60) }), "ürün");
    data(await admin.post("/api/workspace/cash", { kind: "in", amount: "10.000", date: shift(-60), description: "Açılış" }), "kasa");
  });
  after(async () => server?.close());

  it("Kasa: tarih yoksa bugün; boş, null, geçersiz ve ileri tarih 400", async () => {
    data(await admin.post("/api/workspace/cash", { kind: "in", amount: "5", description: "Tarihsiz" }), "tarihsiz");
    assert.equal(store.get("SELECT date FROM cash_entries WHERE description = 'Tarihsiz'").date, today, "alan gönderilmezse bugün yazılır");
    rejected(await admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: "", description: "x" }), 400, "date-missing", "boş");
    rejected(await admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: null, description: "x" }), 400, "date-missing", "null");
    rejected(await admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: "2026-02-30", description: "x" }), 400, "date-invalid", "30 Şubat");
    rejected(await admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: "31.12.2025", description: "x" }), 400, "date-invalid", "yerel biçim");
    rejected(await admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: shift(1), description: "x" }), 400, "date-future", "yarın");
  });

  it("Cari, Stok ve Taksit tahsilatı da ileri tarihi reddeder", async () => {
    rejected(await admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "100", date: shift(3) }), 400, "date-future", "cari");
    rejected(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "20", pay: "none", date: shift(3) }), 400, "date-future", "stok");
    const plan = data(await admin.post("/api/workspace/plans", { name: "Nazlı Deniz", accountId: customer.id, total: "300", count: 3, firstDue: shift(-30), registeredOn: shift(-30) }), "kart");
    rejected(await admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", date: shift(2) }), 400, "date-future", "taksit tahsilatı");
  });

  it("vade Kayıt Tarihi'nden önce olamaz; Kayıt Tarihi ileri olamaz; satışta vade satıştan önce olamaz", async () => {
    rejected(await admin.post("/api/workspace/plans", { name: "Erken Vade", total: "100", count: 2, registeredOn: shift(-5), firstDue: shift(-6) }), 400, "due-before-start", "vade < kayıt");
    const future = await admin.post("/api/workspace/plans", { name: "İleri Kayıt", total: "100", count: 2, registeredOn: shift(5), firstDue: shift(10) });
    assert.equal(future.status, 400, JSON.stringify(future.data));
    rejected(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "2", unitPrice: "30", pay: "account", accountId: customer.id, date: shift(-3), installments: { count: 2, firstDue: shift(-4) } }), 400, "due-before-start", "satış taksidi");
  });

  it("taksit iadesi yapılan tahsilatı aşamaz", async () => {
    const plan = data(await admin.post("/api/workspace/plans", { name: "İade Sınırı", total: "400", count: 2, firstDue: shift(-20), registeredOn: shift(-20) }), "kart");
    data(await admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "150", date: shift(-10) }), "tahsilat");
    rejected(await admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "out", amount: "150,01", date: shift(-1), cashForce: true }), 400, "refund-exceeds", "fazla iade");
    data(await admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "out", amount: "150", date: shift(-1), cashForce: true }), "tam iade");
  });

  it("dönem kilidi: yalnız yönetici; ekleme, düzeltme, silme ve kilitli döneme taşıma engellenir", async () => {
    const old = data(await admin.post("/api/workspace/cash", { kind: "out", amount: "40", date: shift(-20), description: "Kırtasiye" }), "eski gider");
    const oldId = old.id ?? store.get("SELECT id FROM cash_entries WHERE description = 'Kırtasiye'").id;
    const open = data(await admin.post("/api/workspace/cash", { kind: "out", amount: "25", date: shift(-2), description: "Çay" }), "açık gider");
    const openId = open.id ?? store.get("SELECT id FROM cash_entries WHERE description = 'Çay'").id;
    const personel = await createUser(server, admin, { username: "donemci" });
    assert.equal((await personel.put("/api/admin/period-lock", { lockedUntil: shift(-10) })).status, 403);
    rejected(await admin.put("/api/admin/period-lock", { lockedUntil: shift(1) }), 400, undefined, "ileri kilit");
    data(await admin.put("/api/admin/period-lock", { lockedUntil: shift(-10) }), "kilit");
    assert.equal(data(await admin.get("/api/workspace/ledger/lock"), "kilit oku").lockedUntil, shift(-10));

    rejected(await admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: shift(-10), description: "x" }), 409, "period-locked", "kilit günü ekleme");
    rejected(await admin.put(`/api/workspace/cash/${oldId}`, { kind: "out", amount: "41", date: shift(-20), description: "Kırtasiye" }), 409, "period-locked", "düzeltme");
    rejected(await admin.del(`/api/workspace/cash/${oldId}`), 409, "period-locked", "silme");
    rejected(await admin.put(`/api/workspace/cash/${openId}`, { kind: "out", amount: "25", date: shift(-15), description: "Çay" }), 409, "period-locked", "kilitli döneme taşıma");
    rejected(await admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "10", date: shift(-11) }), 409, "period-locked", "cari");
    rejected(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "20", pay: "none", date: shift(-11) }), 409, "period-locked", "stok");
    data(await admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: shift(-9), description: "Kilidin ertesi" }), "kilidin ertesi açık");

    // Ham yazımla kapalı döneme dokunmak (API'yi atlayan bir hata) da COMMIT'ten önce yakalanır.
    const before = store.get("SELECT amount FROM cash_entries WHERE id = ?", oldId).amount;
    assert.throws(() => store.run("UPDATE cash_entries SET amount = 99 WHERE id = ?", oldId), IntegrityError);
    assert.equal(store.get("SELECT amount FROM cash_entries WHERE id = ?", oldId).amount, before, "geri alındı");

    data(await admin.put("/api/admin/period-lock", { lockedUntil: "" }), "kilidi kaldır");
    data(await admin.put(`/api/workspace/cash/${oldId}`, { kind: "out", amount: "41", date: shift(-20), description: "Kırtasiye" }), "kilit kalkınca düzeltme");
    const result = data(await admin.get("/api/workspace/ledger/integrity"), "mutabakat");
    assert.equal(result.ok, true, JSON.stringify(result.failures));
  });

  it("npm run mutabakat: veritabanına dokunmadan denetler; sapmada çıkış kodu 1", () => {
    const dataDir = server.app.config.dataDir;
    const file = resolveDbPath(dataDir);
    const run = () => spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(root, "tools", "mutabakat.mjs")], { env: { ...process.env, HUKUK_DATA_DIR: dataDir }, encoding: "utf8" });
    const clean = run();
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /kuruşu kuruşuna tutarlı/);
    // Kapıyı atlayan eski sürüm bozulması: yarım kuruş.
    store.db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('eski-bozuk', 'in', 10.005, ?, 'Eski', 'cash', 'eski', ?)").run(shift(-1), new Date().toISOString());
    store.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
    const dirty = run();
    assert.equal(dirty.status, 1, dirty.stdout + dirty.stderr);
    assert.match(dirty.stdout, /Kuruş ve işaret \(Kasa Hareketleri\)/);
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), hash, "kaynak veritabanı değişmedi");
    store.db.prepare("DELETE FROM cash_entries WHERE id = 'eski-bozuk'").run();
  });
});

describe("eksi bakiye denetimi (v2.0.17): yalnız Nakit Kasa denetlenir; Kasa'ya yalnız nakit girilir; Kasa ↔ Banka transferi", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    data(await admin.post("/api/workspace/cash", { kind: "in", amount: "1.000", method: "cash", description: "Nakit açılış" }), "nakit");
  });
  after(async () => server?.close());
  const out = (method, amount, extra = {}) => admin.post("/api/workspace/cash", { kind: "out", amount, method, description: `${method} çıkış`, ...extra });

  it("varsayılan: Nakit Kasa Uyar; banka ve kart denetimi kapalı (Banka modülü gelene kadar), ayar gönderilse de okunmaz", async () => {
    assert.deepEqual(data(await admin.get("/api/admin/negative-policy"), "ayar"), { cash: "warn", bank: "off", card: "off" });
    rejected(await out("cash", "1.500"), 409, "cash-negative", "nakit eksiye");
    data(await admin.put("/api/admin/negative-policy", { bank: "warn", card: "block" }), "bank/card gönderildi");
    assert.deepEqual(data(await admin.get("/api/admin/negative-policy"), "ayar"), { cash: "warn", bank: "off", card: "off" }, "bank/card her zaman off");
  });

  it("Kasa'ya nakit dışı yol girilemez (400 cash-method); havale/POS cari ekranından girilir ve nakit kasayı değiştirmez", async () => {
    rejected(await out("bank", "100"), 400, "cash-method", "banka ile Kasa çıkışı");
    rejected(await admin.post("/api/workspace/cash", { kind: "in", amount: "100", method: "card", description: "POS" }), 400, "cash-method", "POS ile Kasa girişi");
    const cari = data(await admin.post("/api/workspace/accounts", { name: "Havaleci Ltd.", type: "customer" }), "cari");
    data(await admin.post(`/api/workspace/accounts/${cari.id}/entries`, { kind: "in", amount: "700", method: "bank", note: "Havale tahsilat" }), "havale");
    const kasa = data(await admin.get("/api/workspace/cash"), "kasa");
    assert.ok(kasa.entries.every(entry => entry.method === "cash"), "Kasa penceresi yalnız nakit");
    assert.equal(kasa.totals.balance, 1000, "nakit kasa 1.000");
    assert.equal(kasa.byMethod.bank, 700, "banka tarafı 700");
    const banka = data(await admin.get("/api/workspace/cash?method=noncash"), "banka tarafı");
    assert.ok(banka.entries.length === 1 && banka.entries[0].method === "bank" && banka.entries[0].amount === 700);
    const hepsi = data(await admin.get("/api/workspace/cash?method=all"), "hepsi");
    assert.equal(hepsi.entries.length, 2);
  });

  it("Engelle: onayla da yazılmaz; Kontrol Yok: sormaz; yetkisiz kullanıcı ayarı değiştiremez", async () => {
    const personel = await createUser(server, admin, { username: "eksici" });
    assert.equal((await personel.put("/api/admin/negative-policy", { cash: "off" })).status, 403);
    rejected(await admin.put("/api/admin/negative-policy", { cash: "belki" }), 400, undefined, "geçersiz değer");
    data(await admin.put("/api/admin/negative-policy", { cash: "block" }), "ayar");
    rejected(await out("cash", "1.500", { cashForce: true }), 409, "cash-blocked", "nakit engelli");
    data(await out("cash", "999"), "bakiye yetiyorsa engel yok");
    data(await admin.put("/api/admin/negative-policy", { cash: "off" }), "kontrol yok");
    data(await out("cash", "500"), "sormadan eksiye");
    data(await admin.put("/api/admin/negative-policy", { cash: "warn" }), "geri al");
    data(await admin.post("/api/workspace/cash", { kind: "in", amount: "2.000", description: "Toparla" }), "nakit giriş");
  });

  it("Kasa ↔ Banka transferi: tek işlem, iki bağlı hareket; kasadan bankaya yatırmada nakit denetimi; düzeltme/silme iki tarafı birlikte; Ana Defter 100 ↔ 102", async () => {
    const before = data(await admin.get("/api/workspace/cash?method=all"), "önce");
    const trial0 = data(await admin.get("/api/workspace/ledger"), "mizan önce").trial.accounts;
    const trialBefore = code => {
      const row = trial0.find(item => item.code === code);
      return row ? row.debit + row.credit : 0;
    };
    const toCash = data(await admin.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "300", description: "ATM" }), "bankadan kasaya");
    assert.ok(toCash.transferId && toCash.id);
    const after1 = data(await admin.get("/api/workspace/cash?method=all"), "sonra");
    assert.equal(after1.byMethod.cash, before.byMethod.cash + 300, "nakit +300");
    assert.equal(after1.byMethod.bank, before.byMethod.bank - 300, "banka −300");
    const kasa = data(await admin.get("/api/workspace/cash"), "kasa");
    const row = kasa.entries.find(entry => entry.transferId === toCash.transferId);
    assert.ok(row && row.kind === "in" && row.method === "cash" && row.amount === 300, "Kasa'da nakit giriş olarak görünür");
    const banka = data(await admin.get("/api/workspace/cash?method=noncash"), "banka");
    assert.ok(banka.entries.some(entry => entry.transferId === toCash.transferId && entry.kind === "out" && entry.method === "bank"), "bankada karşı hareket");
    // Kasadan bankaya: nakit kasadan fazlası sorulur; onayla yazılır.
    const tooMuch = await admin.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: String(after1.byMethod.cash + 1) });
    rejected(tooMuch, 409, "cash-negative", "nakit yetmiyor");
    assert.equal(tooMuch.data.method, "cash");
    const toBank = data(await admin.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "100" }), "kasadan bankaya");
    // Düzeltme iki tarafı birlikte günceller; yön değiştirilemez.
    data(await admin.put(`/api/workspace/cash/${toBank.id}`, { kind: "out", amount: "150", date: toBank.date, description: "Bankaya yatırıldı" }), "düzelt");
    const after2 = data(await admin.get("/api/workspace/cash?method=all"), "düzeltildi");
    const pair = after2.entries.filter(entry => entry.transferId === toBank.transferId);
    assert.equal(pair.length, 2);
    assert.ok(pair.every(entry => entry.amount === 150 && entry.description === "Bankaya yatırıldı"), "iki taraf 150");
    rejected(await admin.put(`/api/workspace/cash/${toBank.id}`, { kind: "in", amount: "150", date: toBank.date, description: "x" }), 400, "transfer-kind", "yön sabit");
    // Ana Defter: transfer gelir/gider değil, 100 ↔ 102; mutabakat tutar. Gelir (649) ve gider (770) transferle değişmez.
    const integrity = data(await admin.get("/api/workspace/ledger/integrity"), "mutabakat");
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures));
    const trialNow = data(await admin.get("/api/workspace/ledger"), "mizan").trial.accounts;
    const acc = code => trialNow.find(row => row.code === code) || { debit: 0, credit: 0, balance: 0 };
    assert.equal(acc("649").debit + acc("649").credit, trialBefore("649"), "649 transferle değişmedi");
    assert.equal(acc("770").debit + acc("770").credit, trialBefore("770"), "770 transferle değişmedi");
    assert.equal(acc("100").balance, after2.byMethod.cash, "100 = nakit kasa");
    assert.equal(acc("102").balance, after2.byMethod.bank, "102 = banka");
    // Silme: iki taraf birlikte gider; Silinenler'den birlikte döner.
    data(await admin.del(`/api/workspace/cash/${toBank.id}`), "sil");
    const after3 = data(await admin.get("/api/workspace/cash?method=all"), "silindi");
    assert.equal(after3.entries.filter(entry => entry.transferId === toBank.transferId).length, 0);
    const bin = data(await admin.get("/api/admin/trash"), "silinenler");
    const item = bin.find(row => row.kind === "cash" && row.title === "Bankaya yatırıldı");
    assert.ok(item, "transfer Silinenler'de");
    data(await admin.post("/api/admin/trash/restore", { id: item.id }), "geri yükle");
    const after4 = data(await admin.get("/api/workspace/cash?method=all"), "geri geldi");
    assert.equal(after4.entries.filter(entry => entry.transferId === toBank.transferId).length, 2, "iki taraf birlikte döndü");
  });

  it("düzeltmede eski nakit dışı kaydın yolu korunur, nakit kasa denetimi sürer", async () => {
    const entry = data(await admin.post("/api/workspace/cash", { kind: "in", amount: "300", description: "Taşınacak tahsilat" }), "tahsilat");
    data(await admin.post("/api/workspace/cash", { kind: "out", amount: "250", description: "Harcama" }), "harcama");
    const id = entry.id ?? server.app.store.get("SELECT id FROM cash_entries WHERE description = 'Taşınacak tahsilat'").id;
    const moved = await admin.put(`/api/workspace/cash/${id}`, { kind: "in", amount: "300", method: "bank", description: "Taşınacak tahsilat" });
    assert.equal(moved.status, 200, "yol gönderilse de nakit kalır");
    assert.equal(server.app.store.get("SELECT method FROM cash_entries WHERE id = ?", id).method, "cash");
    const result = data(await admin.get("/api/workspace/ledger/integrity"), "mutabakat");
    assert.equal(result.ok, true, JSON.stringify(result.failures));
  });
});
