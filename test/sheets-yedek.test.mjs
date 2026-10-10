// Google Sheets bağlıyken yedek — kullanıcı (10.10.2026): "Sheets bağlanırsa programın oraya da yedek alıp almadığını da denetle."
// Koddan: program Sheets'i yalnız OKUR (lib/sheets.mjs: düzenleme sayfası, CSV/xlsx dışa aktarım adresleri; kimlik bilgisi yok);
// okunan satırlar şirketin veri tabanına (dataset_rows) kopyalanır; yedek o veri tabanının kopyasıdır. Bu test bunu ölçer:
//   1) eşitleme Google'a yalnız GET ile, kimlik bilgisi göndermeden gider; Sheets'e hiçbir yazma isteği (POST/PUT/PATCH/DELETE) yok;
//   2) Yedek Al / otomatik yedek Google'a HİÇ istek atmaz; yedek dosyasında Sheets satırları sayı sayı ve değer değer var;
//   3) Sheets erişilemezken (500, zaman aşımı, ağ yok) yerel yedek yine alınır, son kaydedilen satırları içerir;
//   4) iki şirket (001 Sheets'li, 002 Excel'li, Sheets'siz): yedekler karışmaz; 002 geri yüklemesi 001'in bağını bozmaz;
//   5) 001 yedekten geri yüklenince (yeniden açılışta) Sheets bağı (adres, sekmeler) ve satır sayısı yedektekiyle aynı; eşitleme
//      yeniden çalışır.
// Drive/bulut yedeğine BAĞIMLI DEĞİL (kullanıcı kararı 10.10.2026: Drive yedeği kaldırılıyor). Her adımda yanıt kodu + gövde +
// yedek dosyasının içi okunur (CLAUDE.md ders 3, 4).
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, test } from "node:test";
import { createApp } from "../server/app.mjs";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";

// ---- Sahte Google Sheets: programın her isteği (yöntem, adres, başlıklar, gövde) kaydedilir. ----
const requests = [];
const google = { mode: "ok" }; // "ok" | "500" | "timeout" | "down"
const docs = new Map(); // belge kimliği → { title, tabs: [{ gid, title, rows: [[DOSYA NO, BORÇLU, TUTAR], …]}] }
const HEADER = ["DOSYA NO", "BORÇLU", "TUTAR"];
const csvOf = rows => [HEADER, ...rows].map(row => row.map(cell => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\n");
const htmlOf = doc => `<html><head><title>${doc.title} - Google E-Tablolar</title></head><body>${doc.tabs.map(tab => `<script>"gid":"${tab.gid}","name":"${tab.title}"</script>`).join("\n")}</body></html>`;
async function fakeGoogle(input, init = {}) {
  const url = String(input instanceof Request ? input.url : input);
  const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
  requests.push({ method: String(init.method || "GET").toUpperCase(), url, headers, body: init.body ?? null });
  if (google.mode === "down") throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
  if (google.mode === "timeout") throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  if (google.mode === "500") return new Response("Sunucu hatası", { status: 500, headers: { "content-type": "text/html" } });
  const match = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([^/?#]+)\/(edit|export|gviz\/tq)(?:\?(.*))?$/.exec(url);
  const doc = match && docs.get(match[1]);
  if (!doc) return new Response("Bulunamadı", { status: 404, headers: { "content-type": "text/html" } });
  if (match[2] === "edit") return new Response(htmlOf(doc), { status: 200, headers: { "content-type": "text/html" } });
  const query = new URLSearchParams(match[3] || "");
  if (query.get("format") === "xlsx") return new Response("xlsx yok", { status: 404, headers: { "content-type": "text/html" } }); // formüller alınamaz; değerler gelir
  const tab = doc.tabs.find(item => item.gid === (query.get("gid") || "0"));
  if (!tab) return new Response("Bulunamadı", { status: 404, headers: { "content-type": "text/html" } });
  return new Response(csvOf(tab.rows), { status: 200, headers: { "content-type": "text/csv" } });
}
// Program dışarıya global fetch ile de gitmesin (sahte fetchImpl'in dışından Sheets'e giden yol olmasın): yerel olmayan her istek kayda düşer.
const realFetch = globalThis.fetch;
const stray = [];
globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) return realFetch(input, init);
  stray.push(`${init.method || "GET"} ${url}`);
  throw Object.assign(new TypeError("fetch failed (test ağı)"), { cause: { code: "ENOTFOUND" } });
};
after(() => {
  globalThis.fetch = realFetch;
});

const ID1 = "1SheetsTakipBelgesi_AbCdEf";
const ID2 = "1BaskaBelge_ZyXwVu";
const URL1 = `https://docs.google.com/spreadsheets/d/${ID1}/edit#gid=0`;
const URL2 = `https://docs.google.com/spreadsheets/d/${ID2}/edit`;
docs.set(ID1, {
  title: "Takip Listesi",
  tabs: [
    { gid: "0", title: "Aktif", rows: Array.from({ length: 25 }, (_, index) => [`A-${index + 1}`, `Borçlu ${index + 1}`, String(1000 + index)]) },
    { gid: "777", title: "Arşiv", rows: Array.from({ length: 12 }, (_, index) => [`R-${index + 1}`, `Eski Borçlu ${index + 1}`, String(50 * (index + 1))]) },
  ],
});
docs.set(ID2, { title: "Başka Belge", tabs: [{ gid: "0", title: "Yeni", rows: [["Y-1", "Yeni 1", "1"], ["Y-2", "Yeni 2", "2"], ["Y-3", "Yeni 3", "3"]] }] });
// Sahte belgenin şu anki satırları: anahtar → { BORÇLU, TUTAR } (beklenen; programdan değil, sahte belgeden).
const expectedRows = id => new Map(docs.get(id).tabs.flatMap(tab => tab.rows.map(([key, name, amount]) => [key, { name, amount }])));

const LICENSE = { enforce: false, machineId: "0123456789abcdef0123456789abcdef" };
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
async function boot(dirs) {
  const app = createApp({ dataDir: dirs.dataDir, backupDir: dirs.backupDir, logLevel: "silent", scheduleBackups: false, fetchImpl: fakeGoogle, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_BACKUP_INTERVAL_HOURS: "0" }, license: LICENSE, startLicenseTimers: false });
  const address = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${address.port}`);
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const api = {
    get: async url => unwrap(await client.get(url)),
    post: async (url, body) => unwrap(await client.post(url, body)),
  };
  return { app, api };
}
// Yedek dosyasının (ya da canlı dosyanın) içi: tablo satırları, kaynağı, bağlı Sheet adresi.
function readDataset(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare("SELECT case_key AS key, tab, origin, values_json AS json FROM dataset_rows").all();
    const link = db.prepare("SELECT value FROM settings WHERE key = 'dataset.linkedSheetUrl'").get()?.value || "";
    return { rows, link, byKey: new Map(rows.map(row => [row.key, JSON.parse(row.json)])) };
  } finally {
    db.close();
  }
}
// Yedekteki satırlar sahte belgeyle sayı sayı ve değer değer aynı mı?
function assertSameAsSheet(content, id, what) {
  const expected = expectedRows(id);
  assert.equal(content.rows.length, expected.size, `${what}: satır sayısı`);
  assert.equal(content.rows.filter(row => row.origin === "sheets").length, expected.size, `${what}: hepsi Sheets kaynaklı`);
  for (const [key, value] of expected) {
    const row = content.byKey.get(key);
    assert.ok(row, `${what}: ${key} yok`);
    assert.equal(row["BORÇLU"], value.name, `${what}: ${key} BORÇLU`);
    assert.equal(String(row.TUTAR), value.amount, `${what}: ${key} TUTAR`);
  }
}
const writes = list => list.filter(item => item.method !== "GET" && item.method !== "HEAD");
const sync = async api => {
  const result = await api.post("/api/workspace/dataset/sync", {});
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
};
const summary = async api => (await api.get("/api/workspace/dataset")).data;

describe("Google Sheets bağlı şirkette yedek: Sheets'e yazılmaz, Sheets satırları yedeğin içinde", () => {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-sheets-yedek-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  let server;
  let second;
  let backup001; // 001'in Sheets'li hâli (5. adımda geri yüklenir)
  let tabsAtBackup;

  before(async () => {
    server = await boot(dirs);
    const { api } = server;
    // 001: Sheets bağlanır (Ayarlar → Veri → Google Sheets: önizleme + uygula, bağlı kalsın).
    const staged = await api.post("/api/workspace/dataset/stage", { kind: "sheets", url: URL1 });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    const committed = await api.post("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "replace", link: true });
    assert.equal(committed.status, 200, JSON.stringify(committed.data));
    assert.equal(committed.data.linked, true);
    // 002: Sheets'siz; tablo Excel'den (5 satır) + bir cari.
    const created = await api.post("/api/companies", { code: "002", name: "Excel Şirketi", select: true });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    second = created.data.company;
    const excel = await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "liste.xlsx", sheets: [{ name: "Liste", matrix: [HEADER, ...Array.from({ length: 5 }, (_, index) => [`E-${index + 1}`, `Excel ${index + 1}`, "10"])] }] });
    assert.equal(excel.status, 200, JSON.stringify(excel.data));
    assert.equal((await api.post("/api/workspace/dataset/commit", { stageId: excel.data.stageId, mode: "replace" })).status, 200);
    assert.equal((await api.post("/api/workspace/accounts", { name: "Cari 002", type: "customer" })).status, 200);
    assert.equal((await api.post("/api/companies/select", { id: "sirket-001" })).status, 200);
  });
  after(async () => {
    await server?.app.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("bağlantı ve eşitleme: Google'a yalnız GET, kimlik bilgisi/gövde yok; Sheets'e yazma isteği YOK", async () => {
    const before = await summary(server.api);
    assert.deepEqual([before.linked, before.linkedSheetUrl, before.rowCount], [true, URL1, 37]);
    // Sheet'te değişiklik: 3 satır eklenir, 1 satır değişir → eşitleme.
    const aktif = docs.get(ID1).tabs[0];
    aktif.rows.push(["A-26", "Yeni Borçlu 26", "2600"], ["A-27", "Yeni Borçlu 27", "2700"], ["A-28", "Yeni Borçlu 28", "2800"]);
    aktif.rows[0] = ["A-1", "Borçlu 1 (düzeltildi)", "1500"];
    const synced = await sync(server.api);
    assert.equal(synced.ok, true, JSON.stringify(synced));
    assert.deepEqual([synced.counts.added, synced.counts.updated], [3, 1]);
    assert.equal(synced.summary.rowCount, 40);
    assert.ok(requests.length > 0, "Google'a okuma istekleri gitti");
    assert.deepEqual(writes(requests), [], "Sheets'e POST/PUT/PATCH/DELETE yok");
    for (const item of requests) {
      assert.match(item.url, /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/(edit|export\?format=(csv&gid=\d+|xlsx)|gviz\/tq\?tqx=out:csv&gid=\d+)$/, item.url);
      assert.equal(item.body, null, `gövde yok: ${item.url}`);
      assert.ok(!("authorization" in item.headers) && !("cookie" in item.headers), `kimlik bilgisi yok: ${JSON.stringify(item.headers)}`);
    }
    assert.deepEqual(stray, [], "program dışarıya başka yoldan istek atmadı");
  });

  test("Şimdi Yedek Al (Tüm Şirketler): Google'a HİÇ istek gitmez; 001 yedeğinde Sheets'in 40 satırı değer değer, 002'ninkinde yalnız kendi 5 satırı", async () => {
    const count = requests.length;
    const taken = await server.api.post("/api/admin/backups", { scope: "all" });
    assert.equal(taken.status, 200, JSON.stringify(taken.data));
    assert.equal(requests.length, count, "yedek alırken Google'a istek yok");
    const byCode = Object.fromEntries(taken.data.backups.map(item => [item.code, item]));
    assert.deepEqual(Object.keys(byCode).sort(), ["001", "002"]);
    const one = readDataset(path.join(byCode["001"].folder, byCode["001"].name));
    assertSameAsSheet(one, ID1, "001 yedeği");
    assert.equal(one.byKey.get("A-1")["BORÇLU"], "Borçlu 1 (düzeltildi)", "eşitlemedeki son değer yedekte");
    assert.equal(one.link, URL1, "Sheets bağlantı adresi yedekte (geri yüklemede bağ geri gelir)");
    const two = readDataset(path.join(byCode["002"].folder, byCode["002"].name));
    assert.equal(two.rows.length, 5);
    assert.ok(two.rows.every(row => row.key.startsWith("E-") && row.origin !== "sheets"), "002'de Sheets satırı yok");
    assert.equal(two.link, "", "002'de Sheets bağı yok");
    assert.ok(![...one.byKey.keys()].some(key => key.startsWith("E-")), "001'de 002'nin satırı yok");
    backup001 = byCode["001"];
    tabsAtBackup = (await summary(server.api)).tabs;
    assert.ok(tabsAtBackup.length >= 2, JSON.stringify(tabsAtBackup));
  });

  test("otomatik yedek turu da Google'a istek atmaz; 001'in yedeğinde Sheets satırları var", async () => {
    assert.equal((await server.api.post("/api/workspace/accounts", { name: "Cari 001", type: "customer" })).status, 200);
    await new Promise(resolve => setTimeout(resolve, 30));
    const count = requests.length;
    const results = server.app.runDueBackups();
    const own = results.find(item => item.name.startsWith("destekofis-001-"));
    assert.ok(own, `001'in otomatik yedeği: ${results.map(item => item.name).join(", ")}`);
    assert.equal(requests.length, count, "otomatik yedekte Google'a istek yok");
    assertSameAsSheet(readDataset(own.path), ID1, "001 otomatik yedeği");
  });

  for (const mode of ["500", "timeout", "down"]) {
    test(`Sheets erişilemezken (${mode}): eşitleme hata der, veri yerinde kalır; Yedek Al yine alınır ve son kaydedilen 40 satırı içerir`, async () => {
      google.mode = mode;
      try {
        const synced = await sync(server.api);
        assert.equal(synced.ok, false, JSON.stringify(synced));
        assert.ok(synced.message, "neden yazıyor");
        assert.equal(synced.summary.rowCount, 40, "veri silinmedi");
        assert.ok(synced.summary.lastSyncError, "Ayarlar → Veri'de son hata");
        const taken = await server.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
        assert.equal(taken.status, 200, JSON.stringify(taken.data));
        const file = path.join(taken.data.backups[0].folder, taken.data.name);
        assert.ok(existsSync(file));
        const content = readDataset(file);
        assertSameAsSheet(content, ID1, `erişilemezken (${mode}) alınan yedek`);
        assert.equal(content.link, URL1);
      } finally {
        google.mode = "ok";
      }
    });
  }

  test("002 yedekten geri yüklenir (anında): 002 Sheets'siz döner; 001'in Sheets bağı ve 40 satırı etkilenmez", async () => {
    const taken = await server.api.post("/api/admin/backups", { scope: "one", companyId: second.id });
    assert.equal(taken.status, 200);
    await server.api.post("/api/companies/select", { id: second.id });
    const more = await server.api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "ek.xlsx", sheets: [{ name: "Liste", matrix: [HEADER, ["E-9", "Ek", "1"], ["E-10", "Ek", "1"]] }] });
    assert.equal((await server.api.post("/api/workspace/dataset/commit", { stageId: more.data.stageId, mode: "merge" })).status, 200);
    assert.equal((await summary(server.api)).rowCount, 7);
    const restored = await server.api.post("/api/admin/backups/restore", { name: taken.data.name, company: second.id, confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    assert.equal(restored.data.restored, true);
    const after002 = await summary(server.api);
    assert.deepEqual([after002.rowCount, after002.linked], [5, false]);
    await server.api.post("/api/companies/select", { id: "sirket-001" });
    const after001 = await summary(server.api);
    assert.deepEqual([after001.rowCount, after001.linked, after001.linkedSheetUrl], [40, true, URL1]);
  });

  test("001 yedekten geri yüklenir (yeniden açılışta): Sheets adresi, sekmeler ve 40 satır yedektekiyle aynı; eşitleme yeniden çalışır", async () => {
    // Yedekten sonra 001 başka bir belgeye bağlanır (adres, sekme ve satırlar değişir).
    const staged = await server.api.post("/api/workspace/dataset/stage", { kind: "sheets", url: URL2 });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal((await server.api.post("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "replace", link: true })).status, 200);
    const changed = await summary(server.api);
    assert.deepEqual([changed.linkedSheetUrl, changed.rowCount], [URL2, 3]);
    const staged001 = await server.api.post("/api/admin/backups/restore", { name: backup001.name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
    assert.equal(staged001.status, 200, JSON.stringify(staged001.data));
    assert.equal(staged001.data.staged, true);
    await server.app.close();
    server = await boot(dirs);
    assert.equal(server.app.stagedRestore?.ok, true, JSON.stringify(server.app.stagedRestore));
    const restored = await summary(server.api);
    assert.deepEqual([restored.linked, restored.linkedSheetUrl, restored.rowCount], [true, URL1, 40], "bağ ve satırlar yedektekiyle aynı");
    assert.deepEqual(restored.tabs, tabsAtBackup, "sekmeler aynı");
    assertSameAsSheet(readDataset(path.join(dirs.dataDir, "destekofis.sqlite")), ID1, "geri yüklenen canlı veri");
    // Eşitleme yeniden çalışır: Sheet'e 2 satır eklenir → eşitleme yalnız ID1 belgesine GET atar.
    docs.get(ID1).tabs[1].rows.push(["R-13", "Eski Borçlu 13", "650"], ["R-14", "Eski Borçlu 14", "700"]);
    const count = requests.length;
    const synced = await sync(server.api);
    assert.equal(synced.ok, true, JSON.stringify(synced));
    assert.equal(synced.counts.added, 2);
    assert.equal(synced.summary.rowCount, 42);
    const fresh = requests.slice(count);
    assert.ok(fresh.length > 0 && fresh.every(item => item.method === "GET" && item.url.includes(`/d/${ID1}/`)), fresh.map(item => `${item.method} ${item.url}`).join("\n"));
    assert.deepEqual(writes(requests), [], "testin tamamında Sheets'e yazma isteği yok");
    assert.deepEqual(stray, []);
  });
});
