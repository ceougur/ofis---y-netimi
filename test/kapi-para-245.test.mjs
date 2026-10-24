// 2.4.5 madde 1–2 (docs/2.4.5-IS-LISTESI.md, BAŞ MİMAR KARARLARI K1; ürün sahibi 23.10.2026: "Excel'den / Sheets'ten gelen verileri programın analizine
// bırakarak muhasebesel işleri riske atamayız"): tablodaki kayıttan yeni kayıt tahsilatı (POST /cases/:key/payments), eski kayıt tahsilatının düzeltmesi
// (PUT /payments/:id) ve Tablodan Aktar (POST /plans/from-table) programda KAPALI → 410 { error, code }; veri değişmez. Silme, Silinenler'den geri yükleme ve eski
// aktarımın Geri Al'ı AÇIK; eski satırlar Kasa'da ve defterde aynen. Anahtar (config.legacyCasePayments / legacyTableTransfer) üretimde YOK; testler açar.
// "Nasıl bozulur?" (iş başında yazıldı): anahtar canlıda açık; iki yoldan biri (PUT) unutulur; istek kimliği yinelemesi 410'u aşar; DELETE / geri yükleme de
// kapanır; eski sürüm verisinde Kasa / mizan değişir; 002 şirketi kapıyı devralmaz; yetkisiz / oturumsuz; başka yol (geri al, geri yükleme, bağ taşıma) yeni
// kayıt tahsilatı yazar; yükleme sonrası "aktarılsın mı?" sorusu açık kalır.
// Eski veri v2.4.4'ün GERÇEK koduyla (git etiketi) kendi API'sinden üretilir; beklenen sayılar programdan bağımsız: kapalı uç veri yazmaz → önce = sonra.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { loadConfig } from "../server/lib/config.mjs";
import { okulServisiWorkbook } from "./fixtures/okul-servisi-ornek.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD = "v2.4.4";
const CLOSED = { legacyCasePayments: false, legacyTableTransfer: false };
const CASE_CLOSED = { status: 410, code: "case-payments-closed", error: "Kayıt tahsilatı kapatıldı; tahsilat Cari'den girilir." };
const ENV = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const matrix = sheet => [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? ""))];
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
// Kapalı uç: yanıt kodu + gövde (ileti ve kod) birlikte okunur (ders 3).
const closed = (res, expected, label) => {
  assert.equal(res.status, expected.status, `${label}: ${expected.status} bekleniyordu, ${res.status} geldi (${JSON.stringify(res.data).slice(0, 200)})`);
  assert.equal(res.data?.code, expected.code, `${label}: kod ${JSON.stringify(res.data).slice(0, 200)}`);
  if (expected.error) assert.equal(res.data?.error, expected.error, `${label}: ileti`);
};
const tableClosed = { status: 410, code: "table-transfer-closed" };
// Para ve kayıt olguları: veri tabanından sayılar + programın Kasa ve mizan uçları (ders 3: reddedilen istekten sonra veri tabanı okunur).
async function facts(server, api) {
  const db = server.app.store;
  const n = sql => db.get(sql).n;
  const ledger = await must("mizan", api.get("/api/workspace/ledger"));
  return {
    payments: n("SELECT COUNT(*) AS n FROM payments"),
    paymentSum: db.get("SELECT COALESCE(SUM(amount), 0) AS s FROM payments").s,
    cashEntries: n("SELECT COUNT(*) AS n FROM cash_entries"),
    accountEntries: n("SELECT COUNT(*) AS n FROM account_entries"),
    planEntries: n("SELECT COUNT(*) AS n FROM plan_entries"),
    plans: n("SELECT COUNT(*) AS n FROM plans"),
    accounts: n("SELECT COUNT(*) AS n FROM accounts"),
    finEvents: n("SELECT COUNT(*) AS n FROM fin_events WHERE status = 'active'"),
    cash: (await must("kasa", api.get("/api/workspace/cash?period=all"))).totals.balance,
    trial: JSON.stringify(ledger.trial),
    journal: ledger.entryCount,
  };
}

describe("2.4.5 madde 1–2: anahtar üretimde kapalı", () => {
  it("varsayılan kapalı; ortam değişkeniyle açılmaz; üretim girişi (server/server.mjs) anahtar vermez", () => {
    const plain = loadConfig({ dataDir: path.join(tmpdir(), "kapi-para-245-yok") });
    assert.equal(plain.legacyCasePayments, false, "legacyCasePayments varsayılanı kapalı olmalı");
    assert.equal(plain.legacyTableTransfer, false, "legacyTableTransfer varsayılanı kapalı olmalı");
    const env = loadConfig({ dataDir: path.join(tmpdir(), "kapi-para-245-yok"), env: { HUKUK_LEGACY_CASE_PAYMENTS: "1", HUKUK_LEGACY_TABLE_TRANSFER: "1", legacyCasePayments: "true" } });
    assert.equal(env.legacyCasePayments, false);
    assert.equal(env.legacyTableTransfer, false);
    assert.equal(loadConfig({ dataDir: path.join(tmpdir(), "kapi-para-245-yok"), legacyCasePayments: "true" }).legacyCasePayments, false, "yalnız true (boolean) açar");
    const entry = readFileSync(path.join(ROOT, "server", "server.mjs"), "utf8");
    assert.doesNotMatch(entry, /legacyCasePayments|legacyTableTransfer/, "server.mjs anahtarı açmamalı");
  });
});

// Kâhin ve 2.4.5 testleri test/helpers.mjs startTestServer'ı kullanır: seçenek config'e iletilir; false AÇIKÇA verilince kapı kapalı, verilmeyince yardımcı
// (eski testler için) açık, config'in kendi varsayılanı (üretim) kapalı.
describe("2.4.5 madde 1–2: test/helpers.mjs startTestServer anahtarı config'e iletir", () => {
  it("{ legacyCasePayments: false, legacyTableTransfer: false } → 410; seçenek verilmezse yardımcının varsayılanı açık (eski testler)", async () => {
    const closedServer = await startTestServer({ legacyCasePayments: false, legacyTableTransfer: false, env: ENV });
    const openServer = await startTestServer({ env: ENV });
    try {
      assert.deepEqual([closedServer.app.config.legacyCasePayments, closedServer.app.config.legacyTableTransfer], [false, false]);
      assert.deepEqual([openServer.app.config.legacyCasePayments, openServer.app.config.legacyTableTransfer], [true, true]);
      const closedAdmin = await loginAdmin(closedServer);
      closed(await closedAdmin.post(`/api/workspace/cases/${encodeURIComponent("K-YARDIMCI")}/payments`, { amount: "100", date: day(0), method: "cash" }), CASE_CLOSED, "yardımcı false → POST");
      closed(await closedAdmin.put(`/api/workspace/payments/${encodeURIComponent("payment-x")}`, { amount: "100" }), CASE_CLOSED, "yardımcı false → PUT");
      closed(await closedAdmin.post("/api/workspace/plans/from-table", { keys: ["x"] }), tableClosed, "yardımcı false → Tablodan Aktar");
      assert.equal(closedServer.app.store.get("SELECT COUNT(*) AS n FROM payments").n, 0);
      const openAdmin = await loginAdmin(openServer);
      const created = await openAdmin.post(`/api/workspace/cases/${encodeURIComponent("K-YARDIMCI")}/payments`, { amount: "100", date: day(0), method: "cash" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
    } finally {
      await closedServer.close();
      await openServer.close();
    }
  });
});

describe(`2.4.5 madde 1–2: eski sürüm verisi (${OLD} gerçek kodu) yeni kodla — kapılar kapalı, eski satırlar aynen, sil / geri yükle / geri al açık`, { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok (git fetch --tags)` }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "kapi-para-245-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  let server;
  let api;
  let old;
  const keys = {};
  const ids = {};

  before(async () => {
    // 1) v2.4.4 (gerçek kod): okul servisi tablosu, üç kayıt tahsilatı (nakit), biri Tablodan Aktar'la karta taşınır; aktarım kaydı tutulur.
    const prev = await bootVersion(OLD, { ...dirs, env: ENV });
    try {
      await seedOld(prev);
    } finally {
      await prev.close();
    }
    // 2) 2.4.5 (güncel kod, üretim varsayılanı: kapılar kapalı) aynı veriyle.
    server = await bootVersion(CURRENT, { ...dirs, env: ENV, ...CLOSED });
    api = await server.login();
  });
  async function seedOld(prev) {
    const oldApi = await prev.login();
    const book = okulServisiWorkbook(new Date());
    const staged = await must("tablo", oldApi.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
    await must("tablo kaydet", oldApi.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const preview = await must("ön izleme", oldApi.get("/api/workspace/plans/from-table"));
    for (const name of ["Efe Kaya", "Zeynep Demir", "Mert Çelik", "Ada Yılmaz"]) keys[name] = preview.records.find(record => record.name.includes(name))?.key;
    assert.ok(Object.values(keys).every(Boolean), `tablodaki kişiler: ${JSON.stringify(preview.records.map(record => record.name))}`);
    const pay = (name, amount, offset) => must(`kayıt tahsilatı ${name}`, oldApi.post(`/api/workspace/cases/${encodeURIComponent(keys[name])}/payments`, { amount, date: day(offset), method: "cash", note: "Elden", caseTitle: name }));
    ids.efe = (await pay("Efe Kaya", "750", -3)).id;
    ids.ada = (await pay("Ada Yılmaz", "400", -2)).id;
    ids.zeynep = (await pay("Zeynep Demir", "300", -1)).id;
    const moved = await must("Tablodan Aktar (eski sürüm)", oldApi.post("/api/workspace/plans/from-table", { keys: [keys["Zeynep Demir"], keys["Mert Çelik"]] }));
    assert.equal(moved.created, 2, `iki kart açıldı: ${JSON.stringify(moved).slice(0, 300)}`);
    assert.equal(moved.paymentsMoved, 1, "Zeynep'in kayıt tahsilatı karta taşındı");
    ids.importId = moved.importId;
    old = await facts(prev, oldApi);
    assert.deepEqual([old.payments, old.plans], [2, 2], "eski veride 2 kayıt tahsilatı (Efe, Ada) + 2 kart");
  }
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("eski satırlar aynen: kayıt tahsilatı, Kasa, cari/kart satırları, işlem başlıkları, mizan ve yevmiye madde sayısı", async () => {
    assert.deepEqual(await facts(server, api), old);
  });

  it("POST kayıt tahsilatı 410 (istek kimliğiyle de); veri değişmez", async () => {
    closed(await api.client.post(`/api/workspace/cases/${encodeURIComponent(keys["Efe Kaya"])}/payments`, { amount: "500", date: day(0), method: "cash", caseTitle: "Efe Kaya" }), CASE_CLOSED, "POST");
    closed(await api.client.post(`/api/workspace/cases/${encodeURIComponent("YENI-KAYIT")}/payments`, { amount: "500", date: day(0), method: "cash" }, { "x-hof-request": randomUUID() }), CASE_CLOSED, "POST + istek kimliği");
    assert.deepEqual(await facts(server, api), old);
  });

  it("PUT eski kayıt tahsilatı 410; satırın tutarı, tarihi ve yolu aynı", async () => {
    const before0 = server.app.store.get("SELECT amount, date, method, note, updated_at AS updatedAt FROM payments WHERE id = ?", ids.efe);
    closed(await api.client.put(`/api/workspace/payments/${encodeURIComponent(ids.efe)}`, { amount: "1.000", date: day(-3), method: "cash", note: "Düzeltme" }), CASE_CLOSED, "PUT");
    closed(await api.client.put(`/api/workspace/payments/${encodeURIComponent("payment-yok")}`, { amount: "1.000" }), CASE_CLOSED, "PUT (olmayan satır)");
    assert.deepEqual(server.app.store.get("SELECT amount, date, method, note, updated_at AS updatedAt FROM payments WHERE id = ?", ids.efe), before0);
    assert.deepEqual(await facts(server, api), old);
  });

  it("oturumsuz 401; personel de 410 alır (Tablodan Aktar yetkisi olmasa da 410: kapı yetkiden önce); veri değişmez", async () => {
    const anon = await fetch(`${server.base}/api/workspace/cases/${encodeURIComponent(keys["Efe Kaya"])}/payments`, { method: "POST", headers: { "content-type": "application/json", origin: server.base }, body: JSON.stringify({ amount: "500" }) });
    assert.equal(anon.status, 401);
    await must("personel", api.post("/api/admin/users", { username: "personel245", name: "Personel 245", password: "Personel-2026!", role: "personel", mustChangePassword: false }));
    const staff = await server.login("personel245", "Personel-2026!");
    closed(await staff.client.post(`/api/workspace/cases/${encodeURIComponent(keys["Efe Kaya"])}/payments`, { amount: "500", date: day(0), method: "cash" }), CASE_CLOSED, "personel POST");
    closed(await staff.client.put(`/api/workspace/payments/${encodeURIComponent(ids.efe)}`, { amount: "1" }), CASE_CLOSED, "personel PUT");
    closed(await staff.client.post("/api/workspace/plans/from-table", { keys: [keys["Efe Kaya"]] }), tableClosed, "personel Tablodan Aktar");
    assert.deepEqual(await facts(server, api), old);
  });

  it("Tablodan Aktar POST 410; yükleme sonrası özet sormaz; veri değişmez; eski aktarım listede", async () => {
    closed(await api.client.post("/api/workspace/plans/from-table", { keys: [keys["Efe Kaya"]] }), tableClosed, "Tablodan Aktar");
    closed(await api.client.post("/api/workspace/plans/from-table", {}), tableClosed, "Tablodan Aktar (boş gövde)");
    const summary = await must("özet", api.get("/api/workspace/plans/from-table/summary"));
    assert.deepEqual({ count: summary.count, ask: summary.ask }, { count: 0, ask: false }, `yükleme sonrası soru yok: ${JSON.stringify(summary)}`);
    const imports = (await must("aktarımlar", api.get("/api/workspace/plans/imports"))).imports;
    assert.ok(imports.some(item => item.id === ids.importId && !item.undoneAt), "eski aktarım Son Aktarımlar'da, geri alınmamış");
    assert.deepEqual(await facts(server, api), old);
  });

  it("DELETE açık (→ Silinenler), Silinenler'den geri yükleme açık: Kasa ve mizan eski hâline döner", async () => {
    const del = await api.client.del(`/api/workspace/payments/${encodeURIComponent(ids.ada)}?cashForce=1`);
    assert.equal(del.status, 200, JSON.stringify(del.data));
    const afterDelete = await facts(server, api);
    assert.equal(afterDelete.payments, old.payments - 1);
    assert.equal(afterDelete.cash, old.cash - 400);
    const item = (await must("Silinenler", api.get("/api/admin/trash"))).find(row => row.kind === "payment");
    assert.ok(item, "silinen kayıt tahsilatı Silinenler'de");
    const restored = await api.client.post("/api/admin/trash/restore", { id: item.id });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    assert.deepEqual(await facts(server, api), old, "geri yükleme eski hâli verir (aynı kimlik, tutar, Kasa, mizan)");
    assert.equal(server.app.store.get("SELECT amount FROM payments WHERE id = ?", ids.ada)?.amount, 400, "aynı kimlikle geri geldi");
  });

  it("eski aktarımın Geri Al'ı açık: kartlar kalkar, karta taşınan kayıt tahsilatı kayda döner, Kasa aynı", async () => {
    const undo = await api.client.post(`/api/workspace/plans/imports/${encodeURIComponent(ids.importId)}/undo`, {});
    assert.equal(undo.status, 200, JSON.stringify(undo.data));
    const now = await facts(server, api);
    assert.equal(now.plans, 0, "aktarımın iki kartı kalktı");
    assert.equal(now.payments, old.payments + 1, "Zeynep'in kayıt tahsilatı kayıt kartına döndü (geri alma eski veriyi geri koyar, yeni giriş değil)");
    assert.equal(server.app.store.get("SELECT amount FROM payments WHERE id = ?", ids.zeynep)?.amount, 300, "aynı kimlikle");
    assert.equal(now.cash, old.cash, "Kasa toplamı değişmedi");
  });
});

describe("2.4.5 madde 1–2: istek kimliği yinelemesi kapıyı aşmaz; anahtar açıkken eski davranış (testlerin ve üreticilerin yolu)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "kapi-para-245-yineleme-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  let server;
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("açıkken POST / PUT / Tablodan Aktar 200 ve yineleme 'replayed'; kapalı sunucuda aynı istek kimliği 410, satır sayısı aynı", async () => {
    const r1 = randomUUID();
    const r2 = randomUUID();
    server = await bootVersion(CURRENT, { ...dirs, env: ENV, legacyCasePayments: true, legacyTableTransfer: true });
    let api = await server.login();
    const body = { amount: "250", date: day(0), method: "cash", caseTitle: "Yineleme" };
    const first = await api.client.post(`/api/workspace/cases/${encodeURIComponent("K-245")}/payments`, body, { "x-hof-request": r1 });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    const again = await api.client.post(`/api/workspace/cases/${encodeURIComponent("K-245")}/payments`, body, { "x-hof-request": r1 });
    assert.equal(again.status, 200);
    assert.equal(again.data.data.replayed, true, "anahtar açıkken aynı istek kimliği ikinci kez yazılmaz (yineleme)");
    const id = first.data.data.id;
    const edit = await api.client.put(`/api/workspace/payments/${encodeURIComponent(id)}`, { amount: "300", date: day(0), method: "cash", note: "Düzeltildi" }, { "x-hof-request": r2 });
    assert.equal(edit.status, 200, JSON.stringify(edit.data));
    const book = okulServisiWorkbook(new Date());
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const summary = await must("özet", api.get("/api/workspace/plans/from-table/summary"));
    assert.ok(summary.count > 0, "anahtar açıkken yükleme sonrası özet planları sayar (eski davranış)");
    const key = preview.records.find(record => record.name.includes("Mert Çelik"))?.key;
    const moved = await must("Tablodan Aktar (anahtar açık)", api.post("/api/workspace/plans/from-table", { keys: [key] }));
    assert.equal(moved.created, 1);
    const counts = () => ({ payments: server.app.store.get("SELECT COUNT(*) AS n FROM payments").n, amount: server.app.store.get("SELECT amount FROM payments WHERE id = ?", id)?.amount, plans: server.app.store.get("SELECT COUNT(*) AS n FROM plans").n });
    const before0 = counts();
    assert.deepEqual(before0, { payments: 1, amount: 300, plans: 1 });
    await server.close();
    server = null;

    server = await bootVersion(CURRENT, { ...dirs, env: ENV, ...CLOSED });
    api = await server.login();
    closed(await api.client.post(`/api/workspace/cases/${encodeURIComponent("K-245")}/payments`, body, { "x-hof-request": r1 }), CASE_CLOSED, "aynı istek kimliği (POST) kapalı sunucuda");
    closed(await api.client.put(`/api/workspace/payments/${encodeURIComponent(id)}`, { amount: "300", date: day(0), method: "cash", note: "Düzeltildi" }, { "x-hof-request": r2 }), CASE_CLOSED, "aynı istek kimliği (PUT) kapalı sunucuda");
    closed(await api.client.post("/api/workspace/plans/from-table", { keys: [key] }), tableClosed, "Tablodan Aktar kapalı sunucuda");
    assert.deepEqual(counts(), before0);
  });
});

describe("2.4.5 madde 1–2: 002 şirketi de kapalı (alt şirket aynı yapılandırmayla açılır)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "kapi-para-245-002-"));
  let server;
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("002'de POST / PUT / Tablodan Aktar 410; 002'nin Kasa'sı ve kaydın işlem geçmişi boş", async () => {
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: ENV, ...CLOSED });
    const api = await server.login();
    const company = (await must("002", api.post("/api/companies", { name: "İkinci Şirket" }))).company;
    assert.ok(company?.id && company.code === "002", JSON.stringify(company));
    const q = `?hofCompany=${encodeURIComponent(company.id)}`;
    closed(await api.client.post(`/api/workspace/cases/${encodeURIComponent("K-002")}/payments${q}`, { amount: "500", date: day(0), method: "cash" }), CASE_CLOSED, "002 POST");
    closed(await api.client.put(`/api/workspace/payments/${encodeURIComponent("payment-x")}${q}`, { amount: "500" }), CASE_CLOSED, "002 PUT");
    closed(await api.client.post(`/api/workspace/plans/from-table${q}`, { keys: ["x"] }), tableClosed, "002 Tablodan Aktar");
    assert.equal((await must("002 kasa", api.get(`/api/workspace/cash${q}&period=all`))).totals.balance, 0);
    const activity = await must("002 işlem geçmişi", api.get(`/api/workspace/cases/${encodeURIComponent("K-002")}/activity${q}`));
    assert.equal(activity.items.filter(item => item.type === "payment").length, 0);
  });
});

// Kaynak tarayan değişmez (ders 27: satırlar /\r?\n/): kayıt tahsilatı (payments) yazan her yol kapının arkasında ya da eski veriyi geri koyan izinli yolda.
describe("2.4.5 madde 1–3: kaynakta kapılar", () => {
  const read = rel => readFileSync(path.join(ROOT, rel), "utf8").split(/\r?\n/).join("\n");
  const walk = dir => readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".mjs") ? [full] : [];
  });
  // Bir konumun içinde bulunduğu yönlendirici işleyicisi (en yakın önceki router.<yöntem>("…")).
  const handlerOf = (src, index) => {
    const head = src.slice(0, index);
    const matches = [...head.matchAll(/router\.(get|post|put|delete|patch)\("([^"]+)"/g)];
    const last = matches.at(-1);
    return last ? `${last[1].toUpperCase()} ${last[2]}` : "";
  };
  const handlerBody = (src, method, route) => {
    const start = src.indexOf(`router.${method}("${route}"`);
    assert.ok(start >= 0, `${method.toUpperCase()} ${route} bulunamadı`);
    const next = src.slice(start + 10).search(/\n {2}router\.(get|post|put|delete|patch)\(/);
    return src.slice(start, next < 0 ? undefined : start + 10 + next);
  };

  it("payments'a satır ekleyen her yer izinli: kapılı POST, Silinenler'den geri yükleme, eski aktarımın Geri Al'ı", () => {
    const allowed = new Set(["server/routes/workspace.mjs POST /api/workspace/cases/:key/payments", "server/routes/trash.mjs POST /api/admin/trash/restore", "server/routes/plan-transfer.mjs POST /api/workspace/plans/imports/:id/undo"]);
    const found = [];
    for (const file of walk(path.join(ROOT, "server"))) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      if (rel === "server/lib/migrations.mjs") continue;
      const src = read(rel);
      for (const match of src.matchAll(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+payments\b/gi)) found.push(`${rel} ${handlerOf(src, match.index)}`);
    }
    assert.ok(found.length >= 3, `tarama bir şey bulmalı: ${found.join(" | ")}`);
    assert.deepEqual(found.filter(item => !allowed.has(item)), [], `izinsiz kayıt tahsilatı yazımı: ${found.join(" | ")}`);
  });

  it("payments'ın tutarını / tarihini değiştiren UPDATE yalnız kapılı PUT'ta (B1 bağ taşıma yalnız case_key, banka eşlemesi yalnız fin_ref değiştirir)", () => {
    const found = [];
    for (const file of walk(path.join(ROOT, "server"))) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      if (rel === "server/lib/migrations.mjs") continue;
      const src = read(rel);
      for (const match of src.matchAll(/UPDATE\s+payments\s+SET\s+([^"`]*)/gi)) if (/\b(amount|date|method)\s*=/.test(match[1])) found.push(`${rel} ${handlerOf(src, match.index)}`);
    }
    assert.deepEqual(found, ["server/routes/workspace.mjs PUT /api/workspace/payments/:id"], `tutar/tarih değiştiren yazım: ${found.join(" | ")}`);
  });

  it("POST /cases/:key/payments ve PUT /payments/:id ilk iş kapıya bakar; DELETE kapısız; kapı 410 case-payments-closed", () => {
    const src = read("server/routes/workspace.mjs");
    for (const [method, route] of [["post", "/api/workspace/cases/:key/payments"], ["put", "/api/workspace/payments/:id"]]) {
      const body = handlerBody(src, method, route);
      const first = body.split("\n")[1]?.trim();
      assert.equal(first, "assertCasePaymentsOpen(req);", `${method.toUpperCase()} ${route} ilk satırı kapı olmalı: ${first}`);
    }
    assert.doesNotMatch(handlerBody(src, "delete", "/api/workspace/payments/:id"), /assertCasePaymentsOpen/, "silme açık kalmalı");
    assert.match(src, /HttpError\(410, "Kayıt tahsilatı kapatıldı; tahsilat Cari'den girilir\.", \{ code: "case-payments-closed" \}\)/);
    assert.match(src, /config\?\.legacyCasePayments === true/);
  });

  it("POST /plans/from-table analizden önce kapıya bakar; özet kapalıyken sormaz; Geri Al kapısız", () => {
    const src = read("server/routes/plan-transfer.mjs");
    const body = handlerBody(src, "post", "/api/workspace/plans/from-table");
    const gate = body.indexOf('code: "table-transfer-closed"');
    assert.ok(gate > 0 && gate < body.indexOf("analyze("), "kapı analizden önce");
    assert.ok(body.indexOf("if (!tableTransferOpen) throw new HttpError(410") > 0);
    assert.match(handlerBody(src, "get", "/api/workspace/plans/from-table/summary"), /if \(!tableTransferOpen \|\| !canUser\(user, "plans\.manage"\)\) return ok\(res, \{ count: 0, tabs: \[\], ask: false \}\);/);
    assert.doesNotMatch(handlerBody(src, "post", "/api/workspace/plans/imports/:id/undo"), /tableTransferOpen/, "Geri Al açık kalmalı");
  });

  it("istemci: kayıt kartında Tahsilat düğmesi yok; Tablodan Aktar düğmesi yok (Son Aktarımlar var); ön dolumlar boş; eski tahsilatta düzelt yok", () => {
    const workspace = read("client/assets/hof-workspace.js");
    assert.doesNotMatch(workspace, /data-case-action="payment"/, "kayıt kartındaki Tahsilat düğmesi HTML'den kalkmalı");
    const accountFirst = workspace.slice(workspace.indexOf("function accountFirst("), workspace.indexOf("// ---------- Kayda bağlı taksit planı"));
    assert.doesNotMatch(accountFirst, /openingBalance|target\?\.debt/, "Açılış Bakiyesi tablo borcuyla dolmamalı");
    const payment = workspace.slice(workspace.indexOf("async payment(target) {"), workspace.indexOf("    lien() {"));
    assert.doesNotMatch(payment, /target\.amount/, "tahsilat formu tablo tutarıyla dolmamalı");
    assert.match(payment, /\{ amount: null, note: target\.note \}/);
    const activity = workspace.slice(workspace.indexOf("const itemActions = item => {"), workspace.indexOf('if (HISTORY_PATH[item.type])', workspace.indexOf("const itemActions = item => {")));
    assert.doesNotMatch(activity, /data-edit/, "İşlem Geçmişi'nde eski kayıt tahsilatı düzeltilmez");
    assert.match(workspace, /\$\{payment \? "" : `<button type="button" class="hof-mini" data-edit=/, "Kasa'da eski kayıt tahsilatı düzeltilmez");
    const plans = read("client/assets/hof-plans.js");
    assert.doesNotMatch(plans, /data-act="transfer"/, "Taksitler'de Tablodan Aktar düğmesi kalkmalı");
    assert.match(plans, /data-act="imports"[^>]*>Son Aktarımlar</);
    assert.doesNotMatch(plans, /Tablodan aktar → /i, "Excel yüklemesinin iletisi kalkan düğmeyi göstermemeli");
    const transfer = read("client/assets/hof-plan-transfer.js");
    assert.match(transfer, /const TRANSFER_OPEN = false;/);
    assert.match(transfer, /if \(!TRANSFER_OPEN \|\| !HOF\.can\("plans\.manage"\)\) return;/, "yükleme sonrası soru sorulmamalı");
    assert.doesNotMatch(read("client/assets/hof-ui.css"), /data-case-action="payment"/, "gizleyen CSS kuralı da kalkmalı");
  });
});
