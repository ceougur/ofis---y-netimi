// 1.3.x / 1.4.x kurulumlarından doğrudan 1.6.0'a geçiş: kayıt kimliği kuralı eski kurala (dosya numarası ya da satır
// izi) sabitlenmeli; ilk Google Sheets eşitlemesi ve "yerine koy" ile yeniden yükleme ofisin düzeltmelerini, silmelerini
// ve notlarını satırlarından koparmamalı. (1.4.0 ve 1.5.0 yayımlanmadığı için sahadaki kurulumlar bu yoldan gelir.)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { detectIdentity, rowIdentities } from "../server/lib/dataset-identity.mjs";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { csvToRecords } from "../server/lib/sheets.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const AT = "2026-09-01T10:00:00.000Z";
const viewOf = async client => (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: { sheetUrl: "dataset://ofis" } }))}`)).data.result.data.json;

// Kontrol haneleri tutan T.C. kimlik numarası (deneme verisi).
const tckn = seed => {
  const d = String(100000000 + seed * 7919).slice(0, 9).split("").map(Number);
  if (d[0] === 0) d[0] = 1;
  const d10 = ((((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10) + 10) % 10;
  const d11 = (d.reduce((a, b) => a + b, 0) + d10) % 10;
  return d.join("") + d10 + d11;
};

// 1.3.x veritabanı: şema 2'ye kadar göçler, ardından verilen hazırlık.
const legacyDatabase = setup => ({ dataDir }) => {
  mkdirSync(dataDir, { recursive: true });
  const db = openDatabase(path.join(dataDir, "hukuk-ofisi.sqlite"));
  const store = createStore(db);
  for (const migration of MIGRATIONS.filter(item => item.version <= 2)) {
    migration.up(store);
    store.exec(`PRAGMA user_version = ${migration.version}`);
  }
  setup(store);
  db.close();
};

describe("1.3.x'ten 1.6.0'a geçişte kayıt kimliği", () => {
  it("Sheet bağlı kurulum: ilk eşitleme kimlik kuralını değiştirmez; düzeltme, silme ve notlar bağlı kalır", async () => {
    // Dosya numarası "yyyy/sayı" biçiminde değil: yeni kural olsaydı "TAKİP NO" kolonunu kimlik seçerdi.
    const url = "https://docs.google.com/spreadsheets/d/ESKI13/edit";
    const csv = ["TAKİP NO,MÜVEKKİL,BORÇLU,DURUM", ...Array.from({ length: 10 }, (_, i) => `${1001 + i},Banka A.Ş.,Borçlu ${i + 1},Derdest`)].join("\n");
    assert.equal(detectIdentity(csvToRecords(csv, "Aktif")).mode, "column", "yeni kurulumda bu veri kimlik kolonu alırdı");
    const keys = rowIdentities(csvToRecords(csv, "Aktif")).map(item => item.caseKey); // 1.3.x'in anahtarları (satır izi)
    const fetchImpl = async target => (String(target).includes("/edit") ? new Response('<title>Takip - Google E-Tablolar</title><script>"gid":"0","name":"Aktif"</script>') : new Response(csv, { headers: { "content-type": "text/csv" } }));
    const server = await startTestServer({
      fetchImpl,
      prepare: legacyDatabase(store => {
        store.setSetting("client.sheetUrl", url);
        store.run("INSERT INTO overrides (id, source_name, case_key, field, value, version, updated_by, updated_at) VALUES ('o1', ?, ?, 'DURUM', 'Haciz konuldu', 1, 'u', ?)", url, keys[0], AT);
        store.run("INSERT INTO deleted_records (id, source_name, case_key, deleted_by, deleted_at) VALUES ('d1', ?, ?, 'u', ?)", url, keys[1], AT);
        store.run("INSERT INTO notes (id, case_key, note, created_by, created_at) VALUES ('n1', ?, 'Önemli not', 'u', ?)", keys[2], AT);
      }),
    });
    try {
      assert.deepEqual(JSON.parse(server.app.store.setting("dataset.identity")), { mode: "legacy" }, "açılışta eski kurala sabitlendi");
      const admin = await loginAdmin(server);
      const view = await viewOf(admin); // ilk Sheet eşitlemesi burada yapılır
      assert.equal(view.rows.length, 9, "silinen satır geri gelmedi");
      assert.equal(view.rows.find(row => row.__hofKey === keys[0])?.DURUM, "Haciz konuldu", "düzeltme yerinde");
      assert.ok(view.rows.some(row => row.__hofKey === keys[2]), "notlu kayıt aynı anahtarla");
      assert.deepEqual(JSON.parse(server.app.store.setting("dataset.identity")), { mode: "legacy" }, "eşitleme kuralı değiştirmedi");
      const profile = (await admin.get("/api/workspace/profile")).data.data;
      assert.equal(profile.sector.id, "hukuk-buro");
    } finally {
      await server.close();
    }
  });

  it("Excel ile gelen kurulum: aynı dosyayı 'yerine koy' ile yeniden yüklemek kayıtları koparmaz (bir dosya birden çok satır)", async () => {
    const header = ["DOSYA NO", "TARAF", "AD SOYAD", "TC KİMLİK NO", "DURUM"];
    const matrix = [header];
    let n = 0;
    for (let file = 1; file <= 10; file += 1) for (const role of ["Asıl borçlu", "Kefil 1", "Kefil 2"]) matrix.push([`2025/${file}`, role, `Kişi ${++n}`, tckn(n), "Derdest"]);
    const rows = matrix.slice(1).map(line => Object.fromEntries([["__sheet", "Dosyalar"], ...header.map((name, index) => [name, line[index]])]));
    const source = "excel://Dosyalar.xlsx";
    const server = await startTestServer({
      prepare: legacyDatabase(store => {
        store.setSetting("client.sheetUrl", source);
        store.run("INSERT INTO source_snapshots (id, source_key, file_name, tabs_json, rows_json, row_count, size_bytes, uploaded_by, uploaded_at) VALUES ('s1', ?, 'Dosyalar.xlsx', '[\"Dosyalar\"]', ?, ?, 10, 'u', ?)", source, JSON.stringify(rows), rows.length, AT);
        store.run("INSERT INTO overrides (id, source_name, case_key, field, value, version, updated_by, updated_at) VALUES ('o1', ?, '2025/1', 'DURUM', 'Haciz konuldu', 1, 'u', ?)", source, AT);
        store.run("INSERT INTO deleted_records (id, source_name, case_key, deleted_by, deleted_at) VALUES ('d1', ?, '2025/2', 'u', ?)", source, AT);
      }),
    });
    try {
      const admin = await loginAdmin(server);
      assert.equal((await viewOf(admin)).rows.length, 27);
      const staged = (await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "Dosyalar.xlsx", sheets: [{ name: "Dosyalar", matrix }] })).data.data;
      assert.deepEqual(staged.identity, { mode: "legacy" });
      assert.equal(staged.preview.replace.added, 0);
      assert.equal(staged.preview.replace.removed, 0);
      assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" })).status, 200);
      const view = await viewOf(admin);
      assert.equal(view.rows.length, 27, "silinen dosyanın satırları geri gelmedi");
      assert.ok(view.rows.filter(row => row.__hofKey === "2025/1").every(row => row.DURUM === "Haciz konuldu"), "düzeltme yerinde");
    } finally {
      await server.close();
    }
  });

  it("yeni kurulumda da bir dosyası birden çok satır olan hukuk tablosu dosya numarasıyla eşleşir; tekrar eden dönem kolonu dosya numarası sayılmaz", () => {
    const parties = [];
    let n = 0;
    for (let file = 1; file <= 40; file += 1) for (const role of ["Asıl borçlu", "Kefil 1", "Kefil 2"]) parties.push({ __sheet: "Taraflar", "DOSYA NO": `2025/${file}`, TARAF: role, "AD SOYAD": `Kişi ${++n}`, "TC KİMLİK NO": tckn(n) });
    assert.deepEqual(detectIdentity(parties), { mode: "legacy" });
    const periods = Array.from({ length: 60 }, (_, i) => ({ __sheet: "Bordro", "SİCİL NO": `P-${1000 + i}`, "AD SOYAD": `Çalışan ${i}`, "DÖNEM": `2025/${1 + (i % 3)}`, "NET": `${1000 + i},00 TL` }));
    assert.deepEqual(detectIdentity(periods), { mode: "column", column: "SİCİL NO" });
  });
});
