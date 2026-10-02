// Kolon başlıklarını adlandırma (v2.0.1): yalnızca görünen ad değişir; veri, düzeltmeler ve eşitleme asıl adla çalışır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { isFullDate } from "../server/lib/insight/validators.mjs";
import { readZip } from "../server/lib/zip.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("kolon başlıklarını adlandırma", () => {
  let server;
  let admin;
  let staff;
  const rowsOf = async client => (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "liste.xlsx", sheets: [{ name: "Sayfa1", matrix: [["MUS_NO", "AD_SOYAD", "TKST_1"], ["M-1", "Ali Veli", "5.000,00 ₺"]] }] });
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" })).status, 200);
  });
  after(() => server.close());

  it("yönetici başlıkları adlandırır; profil adları verir, tüm kullanıcılar görür", async () => {
    const saved = await admin.put("/api/workspace/columns", { columns: { AD_SOYAD: "Müşteri", TKST_1: "  1. Taksit  " } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.deepEqual(saved.data.data.columns, { AD_SOYAD: "Müşteri", TKST_1: "1. Taksit" });
    assert.deepEqual((await staff.get("/api/workspace/profile")).data.data.columns, { AD_SOYAD: "Müşteri", TKST_1: "1. Taksit" });
  });

  it("veri ve düzeltmeler asıl kolon adıyla çalışmaya devam eder", async () => {
    const [row] = await rowsOf(admin);
    assert.equal(row.AD_SOYAD, "Ali Veli", "satır anahtarları değişmez");
    assert.equal((await staff.post("/api/workspace/overrides", { caseKey: row.__hofKey, field: "TKST_1", value: "6.000,00 ₺" })).status, 200);
    assert.equal((await rowsOf(admin))[0].TKST_1, "6.000,00 ₺");
  });

  it("Excel'e dışa aktarmada başlıklar ofisin verdiği adla yazılır", async () => {
    const response = await admin.raw("GET", "/api/workspace/export.xlsx");
    const sheet = readZip(response.buffer).find(entry => entry.name === "xl/worksheets/sheet1.xml").data.toString("utf8");
    assert.match(sheet, /<t>MUS_NO<\/t>.*<t>Müşteri<\/t>.*<t>1\. Taksit<\/t>/s);
  });

  it("çakışan ad, verideki olmayan kolon ve yetkisiz kullanıcı reddedilir; boş ad asıl ada döndürür", async () => {
    const clash = await admin.put("/api/workspace/columns", { columns: { MUS_NO: "Müşteri" } });
    assert.equal(clash.status, 400);
    assert.match(clash.data.error, /başka bir kolonda/);
    assert.equal((await admin.put("/api/workspace/columns", { columns: { MUS_NO: "ad_soyad" } })).status, 400, "başka kolonun asıl adıyla da çakışmaz");
    assert.equal((await admin.put("/api/workspace/columns", { columns: { YOK: "X" } })).status, 400);
    assert.equal((await staff.put("/api/workspace/columns", { columns: { MUS_NO: "No" } })).status, 403);
    const reset = await admin.put("/api/workspace/columns", { columns: { TKST_1: "", AD_SOYAD: "AD_SOYAD" } });
    assert.deepEqual(reset.data.data.columns, {});
    const audit = JSON.stringify((await admin.get("/api/admin/audit?type=profile.column")).data);
    assert.match(audit, /1\. Taksit/);
  });

  it("tarih kolon adı olamaz: değer sanılıp başlığa yazılan tarih reddedilir, ay-yıl başlığı kabul edilir (v2.0.6)", async () => {
    for (const value of ["30.09.2026", "29/09/2026", "2026-09-30", "30 Eylül 2026", "30.09.26"]) {
      const response = await admin.put("/api/workspace/columns", { columns: { TKST_1: value } });
      assert.equal(response.status, 400, value);
      assert.match(response.data.error, /bir tarih; kolon adı olamaz.*✎/, value);
      assert.equal(response.data.column, "TKST_1");
    }
    assert.equal((await admin.put("/api/workspace/columns", { columns: { TKST_1: "Mart 2027" } })).status, 200, "aylık ödeme kolonu adı");
    assert.equal((await admin.put("/api/workspace/columns", { columns: { TKST_1: "" } })).status, 200);
    assert.ok(!isFullDate("2026") && !isFullDate("Ocak 2027") && !isFullDate("31.02.2026") && !isFullDate("1. Taksit"));
  });

  it("adlar veri oturumuna özeldir", async () => {
    await admin.put("/api/workspace/columns", { columns: { AD_SOYAD: "Müşteri" } });
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "baska.xlsx", sheets: [{ name: "S", matrix: [["Plaka", "Model"], ["42 ABC 42", "X"]] }] });
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "session", name: "Araçlar" })).status, 200);
    assert.deepEqual((await admin.get("/api/workspace/profile")).data.data.columns, {}, "yeni oturum kendi adlarıyla başlar");
    assert.deepEqual((await staff.get("/api/workspace/profile")).data.data.columns, { AD_SOYAD: "Müşteri" }, "ilk oturumdaki personel kendi oturumunun adlarını görür");
  });
});

describe("zor değerler (v2.0.2)", async () => {
  const { parseDate } = await import("../server/lib/insight/validators.mjs");
  const { isBlank } = await import("../server/lib/insight/columns.mjs");
  const { analyzeColumn } = await import("../server/lib/insight/columns.mjs");
  it("ay adlı tarihler ve Amerikan sırası okunur; takvimde olmayan tarih okunmaz", () => {
    assert.equal(parseDate("10 Mart 2027").toISOString().slice(0, 10), "2027-03-10");
    assert.equal(parseDate("10 Mar 27").toISOString().slice(0, 10), "2027-03-10");
    assert.equal(parseDate("Mart 2027").toISOString().slice(0, 10), "2027-03-01");
    assert.equal(parseDate("Sept 2027").toISOString().slice(0, 10), "2027-09-01");
    assert.equal(parseDate("03/25/2027").toISOString().slice(0, 10), "2027-03-25", "gün/ay okunamayınca ay/gün");
    assert.equal(parseDate("11/02/2027").toISOString().slice(0, 10), "2027-02-11", "iki türlü okunan tarih gün/ay kalır");
    assert.equal(parseDate("31.02.2026"), null);
    assert.equal(parseDate("2024-13-01"), null);
    assert.equal(parseDate("Marka 2027"), null);
  });
  it("Excel hata değerleri boş sayılır; küçük tablolarda başlık destekliyorsa tür verilir", () => {
    for (const value of ["#DIV/0!", "#SAYI/0!", "#REF!", "#N/A", "#DEĞER!", "#BAŞV!", "#AD?", "#YOK"]) assert.ok(isBlank(value), value);
    assert.ok(!isBlank("#1 Öncelik"));
    const rows = [{ Plaka: "34 ABC 12", "Muayene bitiş": "01.10.2026", Tutar: "1.500", Ad: "Ali Veli" }, { Plaka: "06 DEF 34", "Muayene bitiş": "22.09.2026", Tutar: "#DIV/0!", Ad: "Can Er" }];
    assert.equal(analyzeColumn(rows, "Plaka").role, "plate");
    assert.equal(analyzeColumn(rows, "Muayene bitiş").role, "date");
    assert.equal(analyzeColumn(rows, "Tutar").role, "money", "tek dolu değer ve tutar başlığı");
    assert.equal(analyzeColumn(rows, "Ad").role, "person");
    // Başlık desteği yoksa tek değerden tür çıkarılmaz.
    assert.equal(analyzeColumn([{ X: "01.10.2026" }], "X").role, "text");
    assert.equal(analyzeColumn([{ X: "01.10.2026" }, { X: "02.10.2026" }], "X").role, "date", "iki değer de aynı türde");
    // Başlık tarih diyorsa "tarih + not" hücreleri de tarih sayılır.
    assert.equal(analyzeColumn([{ "Sözleşme bitiş": "30.09.2026 (uzatıldı)" }, { "Sözleşme bitiş": "10 Mart 2027" }, { "Sözleşme bitiş": "Mart 2027" }], "Sözleşme bitiş").role, "date");
  });
});

describe("eşleme ekranı: kullanıcı rolleri (v2.0.2)", () => {
  it("seçilen rol otomatik kararın üstüne yazar; 'Yok Say' önemi sıfırlar; kanıt ve kesinlik bunu söyler", async () => {
    const { analyzeColumns } = await import("../server/lib/insight/columns.mjs");
    const rows = [
      { "Tarih 2": "01.10.2026", "Kolon 3": "Ali Veli", Not: "x" },
      { "Tarih 2": "02.10.2026", "Kolon 3": "Ayşe Kaya", Not: "y" },
      { "Tarih 2": "03.10.2026", "Kolon 3": "Can Er", Not: "z" },
    ];
    const auto = analyzeColumns(rows, ["Tarih 2", "Kolon 3", "Not"], { now: new Date("2026-09-27") });
    assert.notEqual(auto.find(item => item.column === "Tarih 2").kind, "deadline", "başlık belirsiz: otomatik karar son tarih değildir");
    const forced = analyzeColumns(rows, ["Tarih 2", "Kolon 3", "Not"], { now: new Date("2026-09-27"), forced: { "Tarih 2": "deadline", "Kolon 3": "person", Not: "ignore" } });
    const date = forced.find(item => item.column === "Tarih 2");
    assert.deepEqual([date.role, date.kind, date.meaning, date.strong, date.certainty], ["date", "deadline", "expiry", true, "kesin"]);
    assert.ok(date.evidence[0].includes("eşleme ekranında seçildi"));
    assert.equal(forced.find(item => item.column === "Kolon 3").role, "person");
    const note = forced.find(item => item.column === "Not");
    assert.deepEqual([note.role, note.ignored, note.importance], ["text", true, 0]);
  });
});

describe("göç 10: kolon adına yazılmış tarihler asıl adına döner (v2.0.6)", () => {
  let server;
  before(async () => {
    server = await startTestServer({
      prepare: ({ dataDir }) => {
        mkdirSync(dataDir, { recursive: true });
        const db = openDatabase(path.join(dataDir, "hukuk-ofisi.sqlite"));
        const store = createStore(db);
        for (const migration of MIGRATIONS.filter(item => item.version <= 9)) {
          migration.up(store);
          store.exec(`PRAGMA user_version = ${migration.version}`);
        }
        store.setSetting("ui.columns", JSON.stringify({ "MUAYENE BİTİŞ TARİHİ": "30.09.2026", "EGZOZ BİTİŞ TARİHİ": "29.09.2026", MARKA: "Marka / Model" }));
        store.setSetting("ui.columns@ikinci", JSON.stringify({ PLAKA: "Araç" }));
        db.close();
      },
    });
  });
  after(() => server.close());

  it("tarih adları kalkar, diğer adlar kalır; işlem geçmişine ve bir kerelik bildirime yazılır", async () => {
    assert.deepEqual(server.app.migration.applied, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    const { store } = server.app;
    assert.deepEqual(JSON.parse(store.setting("ui.columns")), { MARKA: "Marka / Model" });
    assert.deepEqual(JSON.parse(store.setting("ui.columns@ikinci")), { PLAKA: "Araç" }, "tarih olmayan oturuma dokunulmaz");
    assert.equal(store.setting("ui.columns.fixed@ikinci", ""), "");
    const audit = store.all("SELECT entity_id, actor_name, payload_json FROM audit_events WHERE type = 'profile.column' ORDER BY entity_id");
    assert.deepEqual(audit.map(item => item.entity_id), ["EGZOZ BİTİŞ TARİHİ", "MUAYENE BİTİŞ TARİHİ"]);
    assert.equal(JSON.parse(audit[1].payload_json).previous, "30.09.2026");

    const admin = await loginAdmin(server);
    const profile = (await admin.get("/api/workspace/profile")).data.data;
    assert.deepEqual(profile.columnsFixed.map(item => `${item.column}=${item.value}`).sort(), ["EGZOZ BİTİŞ TARİHİ=29.09.2026", "MUAYENE BİTİŞ TARİHİ=30.09.2026"]);
    const staff = await createUser(server, admin, { username: "ece", name: "Ece Ak", role: "personel" });
    assert.equal((await staff.del("/api/workspace/columns/fixed")).status, 403);
    const cleared = await admin.del("/api/workspace/columns/fixed");
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.data.data.columnsFixed, []);
  });
});
