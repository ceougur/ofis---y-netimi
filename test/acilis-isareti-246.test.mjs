// 2.4.6 madde 12 (2.4.5 BAŞ MİMAR KARARI K6.5 (2)) — cari Açılış Bakiyesi satırının SAĞLAM İŞARETİ (account_entries.is_opening, göç v35):
//   - açılış satırı açıklamasıyla ("Açılış bakiyesi") değil işaretle tanınır (PUT /accounts openingDueDate / openingExpectedDate, kartın openingEntryId'si);
//     kullanıcı açıklamayı değiştirse de açılış kalır; sonradan elle "Açılış bakiyesi" açıklamasıyla yazılan Borç / Alacak açılış sayılmaz;
//   - işaret Yeni Cari (Açılış Bakiyesi) ve Excel'den cari yüklemede (Bakiye kolonu) konur; Borç ↔ Alacak yön düzeltmesinde kalır; Silinenler'den dönünce
//     kalır; cari başına en çok bir işaret;
//   - göç v35 eski satırları 2.4.5'in kuralıyla (açıklama + ilk satır) işaretler; para etkisi YOK (bakiye, hareketler, mizan aynı).
// "Nasıl bozulur?" listesi (iş başında yazıldı): açıklama değiştirilir; aynı açıklamalı ikinci elle borç; açılışsız caride elle "Açılış bakiyesi"; yön
// düzeltmesi; açılış silinir + geri yüklenir (2.4.6 yükü ve 2.4.5'te silinmiş yük); Excel'den yükleme; eski sürüm (v2.4.5 gerçek kodu) verisi + v2.4.5'te
// alınmış yedeğin güncel kodda geri yüklenmesi (göç geri yüklemede koşar); şirket verisini sıfırlama; ikinci açılış (göç bir kez).
// Eski sürüm verisi test/guvenilirlik/surumler.mjs ile etiketin AYRI kopyasında (git archive) üretilir (ders 17, 23). Sahte durağan saat (ders 13); ders 30.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it, test } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const flaggedOf = store => store.all("SELECT id, account_id AS accountId FROM account_entries WHERE is_opening = 1 ORDER BY rowid").map(row => ({ ...row }));
// Değişmez: işaretli her satır elle (source '') Borç / Alacak; cari başına en çok bir işaret.
const assertFlagShape = (store, label) => {
  const wrong = store.get("SELECT COUNT(*) AS n FROM account_entries WHERE is_opening = 1 AND (source <> '' OR kind NOT IN ('debt', 'credit'))").n;
  assert.equal(wrong, 0, `${label}: işaret yalnız elle Borç / Alacak satırında`);
  const twice = store.get("SELECT COUNT(*) AS n FROM (SELECT account_id FROM account_entries WHERE is_opening = 1 GROUP BY account_id HAVING COUNT(*) > 1)").n;
  assert.equal(twice, 0, `${label}: cari başına en çok bir açılış işareti`);
};

describe("2.4.6 madde 12: Açılış Bakiyesi satırı işaretle tanınır (güncel kod)", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, legacyCasePayments: false, legacyTableTransfer: false });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(async () => server?.close());

  const editAccount = async (label, id, extra) => {
    const card = await must(`${label} kart`, api.get(`/api/workspace/accounts/${id}`));
    return api.put(`/api/workspace/accounts/${id}`, { name: card.name, type: card.type, registeredOn: card.registeredOn, updatedAt: card.updatedAt, ...extra });
  };

  it("açıklaması değiştirilen açılış satırı yine açılıştır: kart openingEntryId'si ve Düzenle'deki açılış Vade Tarihi aynı satıra gider", async () => {
    const created = await must("açılışlı cari", api.post("/api/workspace/accounts", { name: "İşaret Müşteri", type: "customer", registeredOn: day(-30), openingBalance: "2.500" }));
    const openingId = created.openingEntryId;
    assert.ok(openingId, "ön koşul: yeni caride açılış satırı tanınır");
    const opening = created.entries.find(row => row.id === openingId);
    await must("açıklamayı değiştir", api.put(`/api/workspace/accounts/${created.id}/entries/${openingId}`, { kind: opening.kind, amount: "2.500", date: opening.date, note: "2025'ten devreden borç" }));
    const card = await must("kart", api.get(`/api/workspace/accounts/${created.id}`));
    assert.equal(card.entries.find(row => row.id === openingId).note, "2025'ten devreden borç", "ön koşul: açıklama değişti");
    assert.equal(card.openingEntryId, openingId, "açıklaması kullanıcı tarafından değiştirilmiş açılış satırı açılış olarak tanınmadı (openingEntryId boş/başka)");
    const res = await editAccount("Düzenle", created.id, { openingDueDate: day(5), openingExpectedDate: day(7) });
    assert.equal(res.status, 200, `açıklaması değiştirilmiş açılışa Düzenle'den vade yazılamadı: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    const row = server.app.store.get("SELECT due_date AS dueDate, expected_date AS expectedDate, amount, kind FROM account_entries WHERE id = ?", openingId);
    assert.deepEqual({ ...row }, { dueDate: day(5), expectedDate: day(7), amount: 2500, kind: "debt" }, "vade açılış satırında; tutar ve yön aynı");
    assert.equal(card.totals.balance, 2500, "bakiye değişmez");
    // Borç ↔ Alacak yön düzeltmesi (v2.0.13) işareti korur.
    await must("yönü çevir", api.put(`/api/workspace/accounts/${created.id}/entries/${openingId}`, { kind: "credit", amount: "2.500", date: opening.date, note: "2025'ten devreden borç" }));
    assert.equal((await must("kart 2", api.get(`/api/workspace/accounts/${created.id}`))).openingEntryId, openingId, "yön düzeltmesinden sonra da açılış");
    assertFlagShape(server.app.store, "açıklama + yön");
  });

  it("sonradan elle 'Açılış bakiyesi' açıklamasıyla yazılan Borç açılış sayılmaz (açılışlı ve açılışsız caride)", async () => {
    const withOpening = await must("açılışlı", api.post("/api/workspace/accounts", { name: "İşaret İkinci", type: "customer", registeredOn: day(-20), openingBalance: "1.000" }));
    const after_ = await must("aynı açıklamalı borç", api.post(`/api/workspace/accounts/${withOpening.id}/entries`, { kind: "debt", amount: "300", date: day(-10), note: "Açılış bakiyesi" }));
    assert.equal(after_.openingEntryId, withOpening.openingEntryId, "ilk açılış kalır");
    const plain = await must("açılışsız", api.post("/api/workspace/accounts", { name: "İşaret Açılışsız", type: "customer", registeredOn: day(-20) }));
    assert.equal(plain.openingEntryId, "");
    const manual = await must("elle 'Açılış bakiyesi'", api.post(`/api/workspace/accounts/${plain.id}/entries`, { kind: "debt", amount: "200", date: day(-5), note: "Açılış bakiyesi" }));
    assert.equal(manual.openingEntryId, "", "elle yazılan satır açılış işareti almaz (2.4.6 kuralı; vade kendi Düzenle'sinden verilir)");
    const res = await editAccount("açılışsız Düzenle", plain.id, { openingDueDate: day(3) });
    assert.equal(res.status, 400, "açılışı olmayan caride açılış vadesi reddedilir");
    assert.equal((res.data?.data || res.data)?.code, "opening-missing");
    assertFlagShape(server.app.store, "elle borç");
  });

  it("Excel'den cari yüklemede Bakiye kolonu açılış işaretli satır yazar; bakiyesiz satırda işaret yok", async () => {
    const matrix = [["ADI SOYADI", "TELEFON", "BAKİYE"], ["Excel İşaret Bir", "0532 111 22 33", "1.500"], ["Excel İşaret İki", "0532 111 22 44", ""]];
    const preview = await must("ön izleme", api.post("/api/workspace/accounts/import/preview", { matrix }));
    const done = await must("yükle", api.post("/api/workspace/accounts/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "isaret.xlsx" }));
    assert.equal(done.balances, 1);
    const rows = server.app.store.all("SELECT a.name, e.is_opening AS flag, e.amount, e.note FROM accounts a LEFT JOIN account_entries e ON e.account_id = a.id WHERE a.name LIKE 'Excel İşaret%' ORDER BY a.name").map(row => ({ ...row }));
    assert.deepEqual(rows, [{ name: "Excel İşaret Bir", flag: 1, amount: 1500, note: "Açılış bakiyesi" }, { name: "Excel İşaret İki", flag: null, amount: null, note: null }]);
  });

  it("Silinenler: açıklaması değiştirilmiş açılış silinip geri yüklenince yine açılış; silinmişken kart açılışsız", async () => {
    const created = await must("cari", api.post("/api/workspace/accounts", { name: "İşaret Silinen", type: "supplier", registeredOn: day(-15), openingBalance: "800" }));
    const openingId = created.openingEntryId;
    const opening = created.entries.find(row => row.id === openingId);
    await must("açıklama", api.put(`/api/workspace/accounts/${created.id}/entries/${openingId}`, { kind: opening.kind, amount: "800", date: opening.date, note: "Eski programdan" }));
    const gone = await must("sil", api.del(`/api/workspace/accounts/${created.id}/entries/${openingId}`));
    assert.equal(gone.openingEntryId, "");
    const trash = await must("Silinenler", api.get("/api/admin/trash"));
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: trash.find(row => row.kind === "account-entry" && row.ref === openingId).id }));
    const back = await must("kart", api.get(`/api/workspace/accounts/${created.id}`));
    assert.equal(back.openingEntryId, openingId, "geri yüklenen açılış (açıklaması değişmiş) yine açılış");
    assert.equal(back.totals.balance, -800, "bakiye aynı (tedarikçi alacak)");
    assertFlagShape(server.app.store, "Silinenler");
  });

  it("Şirket Verisini Sıfırla (hareketler) sonrası yetim işaret yok; yeni açılış işaretli", async () => {
    await must("sıfırla", api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
    assertFlagShape(server.app.store, "sıfırlama");
    for (const row of flaggedOf(server.app.store)) assert.equal((await must("kart", api.get(`/api/workspace/accounts/${row.accountId}`))).openingEntryId, row.id);
    const created = await must("yeni cari", api.post("/api/workspace/accounts", { name: "İşaret Sıfır Sonrası", type: "customer", registeredOn: day(-1), openingBalance: "50" }));
    assert.equal(server.app.store.get("SELECT is_opening AS f FROM account_entries WHERE id = ?", created.openingEntryId).f, 1);
  });
});

const OLD = "v2.4.5";
describe("2.4.6 madde 12 göç v35: v2.4.5 verisi (gerçek kod) güncel kodla — işaret 2.4.5'in kuralıyla, para aynı", { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok (git fetch --tags)` }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-246-acilis-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } };
  after(() => rmSync(root, { recursive: true, force: true }));

  test("v2.4.5 verisi: göç açılışları işaretler (eski openingEntryId'lerle aynı), bakiye / hareket / mizan aynı; Silinenler ve v2.4.5 yedeği", async () => {
    const clock = createClock({ time: NOW, fixed: true });
    const ids = {};
    const before_ = { cards: {}, ledger: null };
    const names = ["A Açılışlı", "B Tedarikçi", "C Elle Açılış", "D Açıklaması Değişen", "E Silinen Açılış", "F Excel"];
    const old = await bootVersion(OLD, { ...dirs, now: clock });
    try {
      const api = await old.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      const a = await must("A", api.post("/api/workspace/accounts", { name: names[0], type: "customer", registeredOn: day(-60), openingBalance: "1.000" }));
      ids[names[0]] = a.id;
      await must("A borç", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "600", date: day(-40), note: "eski borç" }));
      await must("A tahsilat", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "300", date: day(-30), method: "cash" }));
      await must("A aynı açıklamalı borç", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "50", date: day(-20), note: "Açılış bakiyesi" }));
      ids[names[1]] = (await must("B", api.post("/api/workspace/accounts", { name: names[1], type: "supplier", registeredOn: day(-60), openingBalance: "700" }))).id;
      const c = await must("C", api.post("/api/workspace/accounts", { name: names[2], type: "customer", registeredOn: day(-60) }));
      ids[names[2]] = c.id;
      await must("C elle", api.post(`/api/workspace/accounts/${c.id}/entries`, { kind: "debt", amount: "200", date: day(-50), note: "Açılış bakiyesi" }));
      const d = await must("D", api.post("/api/workspace/accounts", { name: names[3], type: "customer", registeredOn: day(-60), openingBalance: "400" }));
      ids[names[3]] = d.id;
      const dOpening = d.entries.find(row => row.id === d.openingEntryId);
      await must("D açıklama", api.put(`/api/workspace/accounts/${d.id}/entries/${dOpening.id}`, { kind: "debt", amount: "400", date: dOpening.date, note: "Devreden" }));
      const e = await must("E", api.post("/api/workspace/accounts", { name: names[4], type: "customer", registeredOn: day(-60), openingBalance: "900" }));
      ids[names[4]] = e.id;
      ids.eOpening = e.openingEntryId;
      await must("E açılışı sil", api.del(`/api/workspace/accounts/${e.id}/entries/${e.openingEntryId}`));
      const matrix = [["ADI SOYADI", "TELEFON", "BAKİYE"], [names[5], "0532 999 88 77", "1.500"]];
      const preview = await must("Excel ön izleme", api.post("/api/workspace/accounts/import/preview", { matrix }));
      await must("Excel", api.post("/api/workspace/accounts/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "eski.xlsx" }));
      ids[names[5]] = old.app.store.get("SELECT id FROM accounts WHERE name = ?", names[5]).id;
      for (const name of names) {
        const card = await must(`${name} kart`, api.get(`/api/workspace/accounts/${ids[name]}`));
        before_.cards[name] = { openingEntryId: card.openingEntryId, balance: card.totals.balance, entries: card.entries.map(row => [row.id, row.kind, row.amount, row.date, row.note]) };
      }
      before_.ledger = (await must("mizan", api.get("/api/workspace/ledger"))).trial;
      ids.backup = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
      // Ön koşul (kâhin değil): v2.4.5'in kendi tanıması — D'nin açıklaması değişince açılışsız, C'nin elle satırı açılış; kolon yok.
      assert.equal(before_.cards[names[3]].openingEntryId, "");
      assert.ok(before_.cards[names[2]].openingEntryId);
      assert.equal(old.app.store.all("PRAGMA table_info(account_entries)").some(column => column.name === "is_opening"), false);
    } finally {
      await old.close();
    }

    let current = await bootVersion(CURRENT, { ...dirs, now: clock });
    try {
      const api = await current.login();
      const { store } = current.app;
      assert.equal(store.get("PRAGMA user_version").user_version, LATEST_VERSION);
      assertFlagShape(store, "göç");
      // Kâhin: v2.4.5'in kendi openingEntryId'leri (eski sürümün gerçek kodu). Göç tam onları işaretler.
      const expected = names.map(name => before_.cards[name].openingEntryId).filter(Boolean).sort();
      assert.deepEqual(flaggedOf(store).map(row => row.id).sort(), expected, "göç = v2.4.5'in tanıdığı açılışlar");
      for (const name of names) {
        const card = await must(`${name} kart`, api.get(`/api/workspace/accounts/${ids[name]}`));
        assert.equal(card.openingEntryId, before_.cards[name].openingEntryId, `${name}: açılış satırı aynı`);
        assert.equal(card.totals.balance, before_.cards[name].balance, `${name}: bakiye v2.4.5 ile aynı`);
        assert.deepEqual(card.entries.map(row => [row.id, row.kind, row.amount, row.date, row.note]), before_.cards[name].entries, `${name}: hareketler aynı`);
      }
      assert.deepEqual((await must("mizan", api.get("/api/workspace/ledger"))).trial, before_.ledger, "mizan v2.4.5 ile aynı");
      // Göçten sonra açıklama değişir → açılış kalır (A).
      const aCard = await must("A kart", api.get(`/api/workspace/accounts/${ids[names[0]]}`));
      const aOpening = aCard.entries.find(row => row.id === aCard.openingEntryId);
      await must("A açıklama", api.put(`/api/workspace/accounts/${aCard.id}/entries/${aOpening.id}`, { kind: "debt", amount: "1.000", date: aOpening.date, note: "Devir 2025" }));
      assert.equal((await must("A kart 2", api.get(`/api/workspace/accounts/${aCard.id}`))).openingEntryId, aOpening.id);
      // v2.4.5'te silinen açılış (yükünde isOpening yok; açıklaması "Açılış bakiyesi") geri gelince açılış.
      const trash = await must("Silinenler", api.get("/api/admin/trash"));
      await must("E geri yükle", api.post("/api/admin/trash/restore", { id: trash.find(row => row.kind === "account-entry" && row.ref === ids.eOpening).id }));
      const eCard = await must("E kart", api.get(`/api/workspace/accounts/${ids[names[4]]}`));
      assert.equal(eCard.openingEntryId, ids.eOpening, "v2.4.5'te silinen açılış geri gelince açılış");
      assert.equal(eCard.totals.balance, 900);
      assertFlagShape(store, "geri yükleme");
      // v2.4.5'te alınan yedek güncel kodda geri yüklenir: göç geri yüklemede koşar, işaretler v2.4.5 kuralıyla gelir.
      await must("yedeği geri yükle", api.post("/api/admin/backups/restore", { name: ids.backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    } finally {
      await current.close();
    }
    current = await bootVersion(CURRENT, { ...dirs, now: clock });
    try {
      const api = await current.login();
      const { store } = current.app;
      assert.equal(store.get("PRAGMA user_version").user_version, LATEST_VERSION);
      const expected = names.map(name => before_.cards[name].openingEntryId).filter(Boolean).sort();
      assert.deepEqual(flaggedOf(store).map(row => row.id).sort(), expected, "geri yüklenen v2.4.5 yedeğinde işaretler");
      for (const name of names) {
        const card = await must(`${name} kart`, api.get(`/api/workspace/accounts/${ids[name]}`));
        assert.equal(card.totals.balance, before_.cards[name].balance, `${name}: geri yüklemeden sonra bakiye`);
        assert.equal(card.openingEntryId, before_.cards[name].openingEntryId, `${name}: geri yüklemeden sonra açılış`);
      }
    } finally {
      await current.close();
    }
  });
});
