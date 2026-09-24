// Kalıcı çalışma verisi: devamı olarak ekleme, yerine koyma, bağlı Sheet eşitlemesi, Sheet'te olmayan satırlar,
// yapısal değişiklik emniyeti, yetkiler, veri kaldırma ve 1.4.0 veritabanından göç.
import assert from "node:assert/strict";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { rowIdentities } from "../server/lib/dataset-identity.mjs";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const rowsOf = response => response.data.result.data.json;
const view = async client => rowsOf(await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: { sheetUrl: "dataset://ofis" } }))}`));
const matrix = (header, rows) => [header, ...rows];
const excel = (fileName, sheets) => ({ kind: "excel", fileName, sheets: Object.entries(sheets).map(([name, lines]) => ({ name, matrix: lines })) });
async function stage(client, body) {
  const response = await client.post("/api/workspace/dataset/stage", body);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data.data;
}
async function commit(client, staged, mode, link = true) {
  const response = await client.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode, link });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data.data;
}

describe("çalışma verisi kimlikleri", () => {
  it("aynı dosya iki sekmede ayrı, aynı sekmede iki kez geçerse sırasıyla ayrılır; kimliksiz satır sırayla eşlenir", () => {
    const ids = rowIdentities([
      { __sheet: "A", "DOSYA NO": "2025/1", X: "1" },
      { __sheet: "B", "DOSYA NO": "2025/1", X: "2" },
      { __sheet: "A", "DOSYA NO": "2025/1", X: "3" },
      { __sheet: "A", AD: "Kimliksiz" },
      { __sheet: "A", AD: "Kimliksiz 2" },
    ]).map(item => item.id);
    assert.deepEqual(ids, ["k|A|2025/1#0", "k|B|2025/1#0", "k|A|2025/1#1", "p|A#0", "p|A#1"]);
  });
});

describe("devamı olarak ekle / yerine koy", () => {
  let server;
  let admin;
  let avukat;
  let personel;
  const header = ["DOSYA NO", "BORÇLU", "DURUM"];

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    avukat = await createUser(server, admin, { username: "avukat1", name: "Av. Deneme", role: "avukat" });
    personel = await createUser(server, admin, { username: "personel1", name: "Personel Bir", role: "personel" });
  });
  after(() => server.close());

  it("veri yüklemeyi yalnızca yönetici yapar; avukat ve personel yapamaz", async () => {
    const body = excel("ilk.xlsx", { Aktif: matrix(header, [["2025/1", "Ali", "Derdest"]]) });
    for (const client of [avukat, personel]) {
      assert.equal((await client.post("/api/workspace/dataset/stage", body)).status, 403);
      assert.equal((await client.post("/api/workspace/dataset/sync")).status, 403);
      assert.equal((await client.del("/api/workspace/dataset")).status, 403);
      assert.equal((await client.get("/api/workspace/dataset/missing")).status, 403);
    }
    const summary = (await personel.get("/api/workspace/dataset")).data.data;
    assert.equal(summary.hasData, false);
    assert.equal(summary.linkedSheetUrl, undefined, "ayrıntılar yalnızca yöneticiye");
  });

  it("ilk yükleme doğrudan uygulanır; önizleme sayıları doğru", async () => {
    const staged = await stage(admin, excel("ilk.xlsx", { Aktif: matrix(header, [["2025/1", "Ali", "Derdest"], ["2025/2", "Veli", "Derdest"], ["2025/3", "Can", "Kapalı"]]) }));
    assert.equal(staged.hasData, false);
    assert.deepEqual(staged.preview.merge, { added: 3, updated: 0, unchanged: 0, kept: 0 });
    const result = await commit(admin, staged, "merge");
    assert.equal(result.mode, "initial");
    assert.equal(result.backupName, null, "boş veride yedek gerekmez");
    assert.deepEqual((await view(personel)).rows.map(row => row.__hofKey), ["2025/1", "2025/2", "2025/3"]);
  });

  it("devamı olarak ekle: yeni satır sona eklenir, değişen güncellenir, olmayan korunur, ofisin düzeltmesi kalır", async () => {
    await admin.post("/api/workspace/overrides", { caseKey: "2025/1", field: "DURUM", value: "Haciz talebi (ofis)" });
    await personel.post(`/api/workspace/cases/${encodeURIComponent("2025/2")}/notes`, { note: "Borçlu arandı" });
    const staged = await stage(admin, excel("ekim.xlsx", { Aktif: matrix(header, [["2025/1", "Ali Kaya", "Derdest"], ["2025/4", "Deniz", "Derdest"]]) }));
    assert.equal(staged.hasData, true);
    assert.deepEqual(staged.preview.merge, { added: 1, updated: 1, unchanged: 0, kept: 2 });
    assert.deepEqual(staged.preview.replace, { added: 1, updated: 1, unchanged: 0, removed: 2 });
    assert.deepEqual(staged.preview.samples, { added: ["2025/4"], updated: ["2025/1"], removed: ["2025/2", "2025/3"] });
    const result = await commit(admin, staged, "merge");
    assert.equal(result.mode, "merge");
    assert.match(result.backupName, /veri-oncesi-ekleme/);
    assert.ok(readdirSync(server.backupDir).includes(result.backupName), "yedek diskte");
    const rows = (await view(personel)).rows;
    assert.deepEqual(rows.map(row => row.__hofKey), ["2025/1", "2025/2", "2025/3", "2025/4"]);
    assert.equal(rows[0]["BORÇLU"], "Ali Kaya", "dosyadaki yeni değer");
    assert.equal(rows[0].DURUM, "Haciz talebi (ofis)", "ofisin elle düzeltmesi korunur");
    assert.equal((await view(personel)).message, "ilk.xlsx · 4 kayıt", "verinin adı ilk yüklemede kalır");
  });

  it("yerine koy: olmayan satırlar kalkar; notlar ve düzeltmeler aynı dosya numarasıyla eşleşmeye devam eder", async () => {
    const staged = await stage(admin, excel("yeni-yil.xlsx", { Aktif: matrix(header, [["2025/1", "Ali Kaya", "Derdest"], ["2025/2", "Veli", "Kapalı"]]) }));
    const result = await commit(admin, staged, "replace");
    assert.deepEqual(result.counts, { added: 0, updated: 1, unchanged: 1, removed: 2, missing: 0 });
    assert.match(result.backupName, /veri-oncesi-degistirme/);
    const current = await view(personel);
    assert.deepEqual(current.rows.map(row => row.__hofKey), ["2025/1", "2025/2"]);
    assert.equal(current.rows[0].DURUM, "Haciz talebi (ofis)");
    assert.equal(current.message, "yeni-yil.xlsx · 2 kayıt");
    const activity = (await personel.get(`/api/workspace/cases/${encodeURIComponent("2025/2")}/activity`)).data.data.items;
    assert.ok(activity.some(item => item.text === "Borçlu arandı"), "not silinmez");
  });

  it("süresi dolan veya başkasının önizlemesi uygulanamaz; geçersiz seçim reddedilir", async () => {
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: "stage-yok", mode: "merge" })).status, 404);
    const staged = await stage(admin, excel("x.xlsx", { A: matrix(header, [["2025/9", "X", "Y"]]) }));
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "hepsi" })).status, 400);
    assert.equal((await admin.post("/api/workspace/dataset/stage", excel("bos.xlsx", { A: [["BAŞLIK"]] }))).status, 400);
  });

  it("veriyi kaldır: satırlar kalkar, yedek alınır, uygulamada oluşturulan kayıtlar ve notlar kalır", async () => {
    await personel.post("/api/workspace/records", { values: { "DOSYA NO": "2026/77", BORÇLU: "Elle girilen" } });
    const removed = await admin.del("/api/workspace/dataset");
    assert.equal(removed.status, 200);
    assert.equal(removed.data.data.removed, 2);
    assert.match(removed.data.data.backupName, /veri-kaldirma-oncesi/);
    assert.deepEqual((await view(personel)).rows.map(row => row.__hofKey), ["2026/77"]);
    const summary = (await admin.get("/api/workspace/dataset")).data.data;
    assert.equal(summary.rowCount, 0);
    assert.deepEqual(summary.imports.slice(0, 1).map(item => item.mode), ["remove"]);
  });
});

describe("bağlı Google Sheets eşitlemesi", () => {
  let server;
  let admin;
  let tabA;
  let reachable = true;
  const html = '<title>Takip - Google E-Tablolar</title><script>"gid":"0","name":"Aktif"</script>';
  const fetchImpl = async url => {
    if (!reachable) throw Object.assign(new Error("ağ yok"), { cause: { code: "ENOTFOUND" } });
    const target = String(url);
    if (target.includes("/edit")) return new Response(html, { status: 200 });
    return new Response(tabA, { status: 200, headers: { "content-type": "text/csv" } });
  };
  const url = "https://docs.google.com/spreadsheets/d/BAGLI/edit";
  const csv = rows => ["DOSYA NO,BORÇLU", ...rows].join("\n");

  before(async () => {
    server = await startTestServer({ fetchImpl });
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("Sheet bağlanır; değişiklikler eşitlemede eklenir/güncellenir, silinenler silinmez işaretlenir", async () => {
    tabA = csv(["2025/1,Ali", "2025/2,Veli", "2025/3,Can"]);
    const result = await commit(admin, await stage(admin, { kind: "sheets", url }), "replace");
    assert.equal(result.linked, true);
    tabA = csv(["2025/1,Ali Kaya", "2025/3,Can", "2025/4,Deniz"]);
    const sync = await admin.post("/api/workspace/dataset/sync");
    assert.equal(sync.status, 200, JSON.stringify(sync.data));
    assert.deepEqual(sync.data.data.counts, { added: 1, updated: 1, unchanged: 1, removed: 0, missing: 1 });
    const rows = (await view(admin)).rows;
    assert.deepEqual(rows.map(row => row.__hofKey), ["2025/1", "2025/3", "2025/4", "2025/2"]);
    assert.ok(rows[3].__hofMissing, "Sheet'te olmayan satır işaretli ama duruyor");
    const summary = (await admin.get("/api/workspace/dataset")).data.data;
    assert.equal(summary.missingCount, 1);
    assert.deepEqual(summary.missingKeys, ["2025/2"]);
    assert.equal(summary.imports[0].mode, "sync");
  });

  it("değişiklik yoksa eşitleme geçmişe kayıt düşmez", async () => {
    const before = (await admin.get("/api/workspace/dataset")).data.data.imports.length;
    await admin.post("/api/workspace/dataset/sync");
    assert.equal((await admin.get("/api/workspace/dataset")).data.data.imports.length, before);
  });

  it("Sheet'te olmayan satır: 'tut' denince bir daha işaretlenmez; 'kaldır' denince tablodan çıkar", async () => {
    const missing = (await admin.get("/api/workspace/dataset/missing")).data.data;
    assert.equal(missing.length, 1);
    assert.deepEqual(missing[0].preview, ["DOSYA NO: 2025/2", "BORÇLU: Veli"]);
    const kept = await admin.post("/api/workspace/dataset/missing", { action: "keep", rowIds: [missing[0].rowId] });
    assert.equal(kept.data.data.changed, 1);
    await admin.post("/api/workspace/dataset/sync");
    assert.equal((await admin.get("/api/workspace/dataset")).data.data.missingCount, 0, "tutulan satır yerel kabul edilir");
    tabA = csv(["2025/1,Ali Kaya", "2025/4,Deniz"]);
    await admin.post("/api/workspace/dataset/sync");
    const next = (await admin.get("/api/workspace/dataset/missing")).data.data;
    assert.deepEqual(next.map(item => item.caseKey), ["2025/3"]);
    const removed = await admin.post("/api/workspace/dataset/missing", { action: "remove", rowIds: next.map(item => item.rowId) });
    assert.equal(removed.data.data.changed, 1);
    assert.deepEqual((await view(admin)).rows.map(row => row.__hofKey).sort(), ["2025/1", "2025/2", "2025/4"]);
  });

  it("Google'a ulaşılamazsa son kaydedilen veri gösterilmeye devam eder", async () => {
    reachable = false;
    const sync = await admin.post("/api/workspace/dataset/sync");
    assert.equal(sync.status, 200);
    assert.equal(sync.data.data.ok, false);
    const current = await view(admin);
    assert.equal(current.connected, true);
    assert.equal(current.rows.length, 3);
    assert.match(current.message, /ulaşılamıyor/);
    reachable = true;
    await admin.post("/api/workspace/dataset/sync");
    assert.doesNotMatch((await view(admin)).message, /ulaşılamıyor/);
  });

  it("Sheet'in yapısı toptan değişmiş görünüyorsa eşitleme uygulanmaz, yönetici onayı beklenir", async () => {
    const many = Array.from({ length: 30 }, (_, index) => `2024/${index + 1},Kişi ${index + 1}`);
    tabA = csv(many);
    await commit(admin, await stage(admin, { kind: "sheets", url }), "replace");
    // Sekmenin başına bir başlık satırı eklenmiş gibi: tüm satırlar yeni bölüm etiketiyle gelir.
    tabA = ["TAKİP DOSYALARI", "DOSYA NO,BORÇLU", ...many.map(line => line.replace("2024/", "2023/"))].join("\n");
    const sync = await admin.post("/api/workspace/dataset/sync");
    assert.equal(sync.data.data.held, true, JSON.stringify(sync.data.data));
    const summary = (await admin.get("/api/workspace/dataset")).data.data;
    assert.ok(summary.syncHold && summary.syncHold.missing === 30);
    assert.equal((await view(admin)).rows.filter(row => row.__hofKey.startsWith("2024/")).length, 30, "hiçbir şey değişmedi");
    await commit(admin, await stage(admin, { kind: "sheets", url }), "replace");
    assert.equal((await admin.get("/api/workspace/dataset")).data.data.syncHold, null, "yönetici kararıyla bekleme kalkar");
  });

  it("bağlantı kaldırılınca veri kalır, eşitleme durur", async () => {
    const unlinked = await admin.post("/api/workspace/dataset/unlink");
    assert.equal(unlinked.data.data.linked, false);
    assert.equal((await admin.post("/api/workspace/dataset/sync")).status, 400);
    assert.ok((await view(admin)).rows.length > 0);
  });

  it("v1.0.0 tarayıcısından gelen Sheet bağlantısı, veri yokken çalışma verisine bağlanır", async () => {
    await admin.del("/api/workspace/dataset");
    tabA = csv(["2022/1,Eski"]);
    const adopted = await admin.put("/api/workspace/client-state", { key: "sheetUrl", value: url });
    assert.equal(adopted.status, 200, JSON.stringify(adopted.data));
    assert.equal(adopted.data.data.settings.sheetUrl, "dataset://ofis");
    assert.equal(adopted.data.data.settings.linkedSheetUrl, url);
    assert.deepEqual((await view(admin)).rows.map(row => row.__hofKey), ["2022/1"]);
  });
});

describe("zamanlanmış eşitleme", () => {
  let server;
  let admin;
  let tab = "DOSYA NO,BORÇLU\n2025/1,Ali";
  const fetchImpl = async target => (String(target).includes("/edit") ? new Response('<script>"gid":"0","name":"Aktif"</script>') : new Response(tab, { headers: { "content-type": "text/csv" } }));

  before(async () => {
    server = await startTestServer({ fetchImpl, env: { HUKUK_DATASET_AUTOSYNC: "1", HUKUK_DATASET_TICK_MS: "100" } });
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("sıklık dolunca kendiliğinden eşitler ve açık ekranları haberdar eder", async () => {
    const staged = await stage(admin, { kind: "sheets", url: "https://docs.google.com/spreadsheets/d/ZAMAN/edit" });
    await commit(admin, staged, "replace");
    await admin.put("/api/workspace/client-state", { key: "syncMinutes", value: "1" });
    tab = "DOSYA NO,BORÇLU\n2025/1,Ali\n2025/2,Yeni";
    // Son eşitleme zamanını geriye çek: bir sonraki denetimde süre dolmuş olur.
    server.app.store.setSetting("dataset.lastSyncAt", new Date(Date.now() - 120_000).toISOString());
    let rows = [];
    for (let attempt = 0; attempt < 40 && rows.length < 2; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      rows = (await view(admin)).rows;
    }
    assert.deepEqual(rows.map(row => row.__hofKey), ["2025/1", "2025/2"]);
    const imports = (await admin.get("/api/workspace/dataset")).data.data.imports;
    assert.equal(imports[0].actorName, "Otomatik eşitleme");
  });
});

describe("göç 4: 1.4.0 veritabanından kalıcı çalışma verisine", () => {
  const prepare14 = (setup, activeSource) => ({ dataDir }) => {
    mkdirSync(dataDir, { recursive: true });
    const db = openDatabase(path.join(dataDir, "hukuk-ofisi.sqlite"));
    const store = createStore(db);
    for (const migration of MIGRATIONS.filter(item => item.version <= 3)) {
      migration.up(store);
      store.exec(`PRAGMA user_version = ${migration.version}`);
    }
    store.setSetting("client.sheetUrl", activeSource);
    setup(store);
    db.close();
  };
  const at = "2026-09-01T10:00:00.000Z";
  const edits = (store, source) => {
    store.run("INSERT INTO overrides (id, source_name, case_key, field, value, version, updated_by, updated_at) VALUES ('o1', ?, '2025/1', 'DURUM', 'Ofis düzeltmesi', 1, 'user-x', ?)", source, at);
    store.run("INSERT INTO deleted_records (id, source_name, case_key, deleted_by, deleted_at) VALUES ('d1', ?, '2025/2', 'user-x', ?)", source, at);
    store.run("INSERT INTO records (id, source_name, case_key, values_json, created_by, created_at, updated_at) VALUES ('r1', ?, '2026/9', ?, 'user-x', ?, ?)", source, JSON.stringify({ "DOSYA NO": "2026/9", BORÇLU: "Elle" }), at, at);
  };

  it("etkin Excel kaynağı: satırlar veriye, düzeltme/silme/kayıtlar veriye bağlanır; görünüm değişmez", async () => {
    const source = "excel://Dosyalar.xlsx";
    const rows = [
      { __sheet: "Aktif", "DOSYA NO": "2025/1", DURUM: "Derdest" },
      { __sheet: "Aktif", "DOSYA NO": "2025/2", DURUM: "Derdest" },
      { __sheet: "Aktif", "DOSYA NO": "2025/3", DURUM: "Kapalı" },
    ];
    const server = await startTestServer({
      prepare: prepare14(store => {
        store.run("INSERT INTO source_snapshots (id, source_key, file_name, tabs_json, rows_json, row_count, size_bytes, uploaded_by, uploaded_at) VALUES ('s1', ?, 'Dosyalar.xlsx', '[\"Aktif\"]', ?, 3, 10, 'user-x', ?)", source, JSON.stringify(rows), at);
        edits(store, source);
      }, source),
    });
    try {
      assert.deepEqual(server.app.migration.applied, [4]);
      const admin = await loginAdmin(server);
      const current = await view(admin);
      assert.deepEqual(current.rows.map(row => row.__hofKey), ["2026/9", "2025/1", "2025/3"]);
      assert.equal(current.rows[1].DURUM, "Ofis düzeltmesi");
      assert.equal(current.message, "Dosyalar.xlsx · 3 kayıt");
      const summary = (await admin.get("/api/workspace/dataset")).data.data;
      assert.equal(summary.imports[0].mode, "migration");
      assert.equal((await admin.get("/api/workspace/client-state")).data.data.settings.sheetUrl, "dataset://ofis");
    } finally {
      await server.close();
    }
  });

  it("etkin Google Sheets kaynağı: düzeltmeler bağlanır, ilk açılışta Sheet okunup kaydedilir", async () => {
    const source = "https://docs.google.com/spreadsheets/d/GOC/edit";
    const fetchImpl = async target => (String(target).includes("/edit") ? new Response('<script>"gid":"0","name":"Aktif"</script>') : new Response("DOSYA NO,DURUM\n2025/1,Derdest\n2025/2,Derdest\n2025/3,Kapalı", { headers: { "content-type": "text/csv" } }));
    const server = await startTestServer({ fetchImpl, prepare: prepare14(store => edits(store, source), source) });
    try {
      const admin = await loginAdmin(server);
      assert.equal((await admin.get("/api/workspace/client-state")).data.data.settings.linkedSheetUrl, source);
      const current = await view(admin);
      assert.deepEqual(current.rows.map(row => row.__hofKey), ["2026/9", "2025/1", "2025/3"]);
      assert.equal(current.rows[1].DURUM, "Ofis düzeltmesi");
      assert.equal(server.app.store.get("SELECT COUNT(*) AS count FROM dataset_rows").count, 3, "Sheet satırları artık sunucuda");
    } finally {
      await server.close();
    }
  });

  it("kaynağı olmayan kurulum: yalnızca tablolar eklenir", async () => {
    const server = await startTestServer({ prepare: prepare14(() => {}, "") });
    try {
      const admin = await loginAdmin(server);
      assert.equal((await admin.get("/api/workspace/dataset")).data.data.hasData, false);
      assert.equal((await admin.get("/api/workspace/client-state")).data.data.settings.sheetUrl, "");
    } finally {
      await server.close();
    }
  });
});
