import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { canonicalCaseKey, columnOrder } from "../server/lib/sources.mjs";
import { csvToRecords, discoverTabs, parseCsv } from "../server/lib/sheets.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const trpcUrl = (sheetUrl = "dataset://ofis", batch = false) => {
  const input = batch ? { 0: { json: { sheetUrl } } } : { json: { sheetUrl } };
  return `/api/trpc/sheets.getRows?${batch ? "batch=1&" : ""}input=${encodeURIComponent(JSON.stringify(input))}`;
};
const rowsOf = response => (Array.isArray(response.data) ? response.data[0] : response.data).result.data.json;
// Excel satırlarını (sekme etiketli nesneler) içeri alma biçimine (sayfa matrisleri) çevirir.
const sheetsOf = rows => {
  const byTab = new Map();
  for (const row of rows) {
    const tab = row.__sheet || "Sayfa1";
    if (!byTab.has(tab)) byTab.set(tab, []);
    byTab.get(tab).push(row);
  }
  return [...byTab].map(([name, items]) => {
    const columns = [...new Set(items.flatMap(item => Object.keys(item).filter(key => key !== "__sheet")))];
    return { name, matrix: [columns, ...items.map(item => columns.map(column => item[column] ?? ""))] };
  });
};
async function importData(client, body, mode = "replace", link = true) {
  const staged = await client.post("/api/workspace/dataset/stage", body);
  if (staged.status !== 200) return staged;
  return client.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode, link });
}

describe("kaynak birleştirme birimleri", () => {
  it("dosya kimliğini ilk yyyy/sayı kalıbından çıkarır (v1.0.0 kuralı)", () => {
    const columns = ["SIRA", "DOSYA NO", "BORÇLU"];
    assert.equal(canonicalCaseKey({ SIRA: "1", "DOSYA NO": "İstanbul 2026/145 E.", BORÇLU: "A" }, columns), "2026/145");
    assert.equal(canonicalCaseKey({ SIRA: "1", "DOSYA NO": "E-55", BORÇLU: "A" }, columns), "E-55");
    const hashed = canonicalCaseKey({ SIRA: "1", BORÇLU: "A" }, ["SIRA", "BORÇLU"]);
    assert.match(hashed, /^satir:[0-9a-f]{16}$/);
    assert.equal(hashed, canonicalCaseKey({ SIRA: "1", BORÇLU: "A" }, ["SIRA", "BORÇLU"]), "aynı satır aynı kimliği alır");
  });

  it("kolon sırası ilk görülme sırasıdır ve iç alanları atlar", () => {
    assert.deepEqual(columnOrder([{ a: 1, __sheet: "x", b: 2 }, { c: 3, a: 4, __hofKey: "k" }]), ["a", "b", "c"]);
  });

  it("CSV ayrıştırıcı tırnak, virgül ve satır sonlarını doğru işler", () => {
    assert.deepEqual(parseCsv('A,B\n"x, y","çift ""tırnak"""\r\n\n1,2'), [["A", "B"], ["x, y", 'çift "tırnak"'], ["1", "2"]]);
    assert.deepEqual(csvToRecords("DOSYA NO,BORÇLU\n2026/1,Ali\n,\n", "Aktif"), [{ "DOSYA NO": "2026/1", BORÇLU: "Ali", __sheet: "Aktif" }]);
  });

  it("Sheets HTML'inden sekmeleri keşfeder", () => {
    const html = 'xx{"gid":"0","name":"Aktif"}yy{"title":"Kapanan","other":1,"gid":"77"}';
    assert.deepEqual(discoverTabs(html), [{ gid: "0", title: "Aktif" }, { gid: "77", title: "Kapanan" }]);
  });
});

describe("merkezi Excel ve birleşik görünüm", () => {
  let server;
  let admin;
  let personel;

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    personel = await createUser(server, admin, { username: "personel2", role: "personel" });
  });
  after(() => server.close());

  const excelRows = [
    { __sheet: "Aktif", "DOSYA NO": "2026/1", BORÇLU: "Ali Veli", "ÖDEME SÖZÜ": "01.10.2026" },
    { __sheet: "Aktif", "DOSYA NO": "2026/2", BORÇLU: "Ayşe Kaya", "ÖDEME SÖZÜ": "" },
    { __sheet: "Kapanan", "DOSYA NO": "2025/9", BORÇLU: "Can Demir", "ÖDEME SÖZÜ": "" },
  ];

  it("Excel tablosunu yükler; ofisin kalıcı çalışma verisi olur", async () => {
    const upload = await importData(admin, { kind: "excel", fileName: "Dosyalar.xlsx", sheets: sheetsOf(excelRows) });
    assert.equal(upload.status, 200, JSON.stringify(upload.data));
    assert.equal(upload.data.data.mode, "initial");
    assert.equal(upload.data.data.rowCount, 3);
    const state = await personel.get("/api/workspace/client-state");
    assert.equal(state.data.data.settings.sheetUrl, "dataset://ofis");
    assert.equal(state.data.data.settings.activeSourceLabel, "Dosyalar.xlsx");
  });

  it("tüm bilgisayarlar aynı satırları kimlikleriyle görür (arayüzün gönderdiği adres ne olursa olsun)", async () => {
    for (const address of ["dataset://ofis", "excel://Dosyalar.xlsx", ""]) {
      const result = rowsOf(await personel.get(trpcUrl(address)));
      assert.equal(result.connected, true);
      assert.deepEqual(result.rows.map(row => row.__hofKey), ["2026/1", "2026/2", "2025/9"]);
      assert.deepEqual(result.tabs.map(tab => tab.title), ["Aktif", "Kapanan"]);
    }
  });

  it("düzeltme, silme ve yeni kayıt birleşik görünüme yansır", async () => {
    const sourceName = "dataset://ofis";
    await personel.post("/api/workspace/overrides", { sourceName, caseKey: "2026/1", field: "ÖDEME SÖZÜ", value: "" });
    await admin.post("/api/workspace/deleted", { sourceName, caseKey: "2026/2" });
    // Güncelleme sırasında açık kalmış eski sayfa eski kaynak adını gönderse de kayıt çalışma verisine bağlanır.
    await personel.post("/api/workspace/records", { sourceName: "excel://Dosyalar.xlsx", values: { "DOSYA NO": "2026/3", BORÇLU: "Yeni Borçlu" } });
    const result = rowsOf(await personel.get(trpcUrl(sourceName, true)));
    assert.deepEqual(result.rows.map(row => row.__hofKey), ["2026/3", "2026/1", "2025/9"]);
    assert.equal(result.rows[1]["ÖDEME SÖZÜ"], "");
    assert.ok(result.rows[0].__hofRecord.startsWith("record-"));
    const restore = await admin.post("/api/workspace/deleted/restore", { sourceName, caseKey: "2026/2" });
    assert.equal(restore.status, 200);
    const restored = rowsOf(await personel.get(trpcUrl()));
    assert.equal(restored.rows.length, 4);
  });

  it("başka adla yüklenen dosya 'devamı olarak' eklenince düzeltmeler korunur", async () => {
    const updated = excelRows.map(row => ({ ...row, BORÇLU: `${row.BORÇLU} (güncel)` }));
    const upload = await importData(admin, { kind: "excel", fileName: "Dosyalar-Ekim.xlsx", sheets: sheetsOf(updated) }, "merge");
    assert.equal(upload.status, 200, JSON.stringify(upload.data));
    assert.deepEqual(upload.data.data.counts, { added: 0, updated: 3, unchanged: 0, removed: 0, missing: 0 });
    const result = rowsOf(await personel.get(trpcUrl()));
    const first = result.rows.find(row => row.__hofKey === "2026/1");
    assert.equal(first.BORÇLU, "Ali Veli (güncel)");
    assert.equal(first["ÖDEME SÖZÜ"], "", "önceki düzeltme yeni yüklemede de geçerli");
  });

  it("kolon listesini döndürür", async () => {
    const result = await personel.get("/api/workspace/sources/columns");
    assert.deepEqual(result.data.data.columns, ["DOSYA NO", "BORÇLU", "ÖDEME SÖZÜ"]);
  });

  it("oturumsuz tRPC isteği tRPC hata biçiminde 401 döner", async () => {
    const result = await server.client().get(trpcUrl("dataset://ofis", true));
    assert.equal(result.status, 401);
    assert.equal(result.data[0].error.json.data.code, "UNAUTHORIZED");
  });

  it("1.4.0 kaynak uçları veriyi değiştirmez, sayfanın yenilenmesini ister", async () => {
    const before = rowsOf(await admin.get(trpcUrl())).rows.length;
    assert.equal((await admin.post("/api/workspace/sources/excel", { fileName: "Eski.xlsx", rows: [{ A: "1" }] })).status, 409);
    assert.equal((await admin.del("/api/workspace/sources/active")).status, 409);
    assert.equal((await admin.put("/api/workspace/client-state", { key: "sheetUrl", value: "" })).status, 409);
    assert.equal(rowsOf(await admin.get(trpcUrl())).rows.length, before);
  });
});

describe("Google Sheets (sahte ağ ile)", () => {
  let server;
  let admin;
  const html = '<title>Takip Tablosu - Google E-Tablolar</title><script>"gid":"0","name":"Aktif" "gid":"12","name":"Kapanan"</script>';
  const csv = { 0: "DOSYA NO,BORÇLU\n2026/10,Hakan\n2026/11,Elif\n", 12: "DOSYA NO,BORÇLU\n2024/5,Kemal\n" };
  const fetchImpl = async url => {
    const target = String(url);
    if (target.includes("SIFIRYETKI")) return new Response("", { status: 403 });
    if (target.includes("/edit")) return new Response(html, { status: 200 });
    const gid = new URL(target).searchParams.get("gid");
    return new Response(csv[gid] ?? "", { status: 200 });
  };
  const sheetUrl = "https://docs.google.com/spreadsheets/d/ABC123/edit?gid=0";

  before(async () => {
    server = await startTestServer({ fetchImpl });
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("tüm sekmeleri okur; belgenin adı verinin adı olur", async () => {
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "sheets", url: sheetUrl });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal(staged.data.data.label, "Takip Tablosu");
    assert.equal(staged.data.data.rowCount, 3);
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
    const first = rowsOf(await admin.get(trpcUrl()));
    assert.equal(first.connected, true);
    assert.deepEqual(first.rows.map(row => `${row.__sheet}:${row.__hofKey}`), ["Aktif:2026/10", "Aktif:2026/11", "Kapanan:2024/5"]);
    const state = (await admin.get("/api/workspace/client-state")).data.data.settings;
    assert.equal(state.linkedSheetUrl, sheetUrl);
    assert.equal(state.activeSourceLabel, "Takip Tablosu");
  });

  it("geçersiz bağlantıda anlaşılır mesaj verir", async () => {
    const result = await admin.post("/api/workspace/dataset/stage", { kind: "sheets", url: "https://drive.google.com/klasor" });
    assert.equal(result.status, 400);
    assert.match(result.data.error, /Google Sheets bağlantısı/);
  });

  it("izin hatasını kullanıcıya açıklar", async () => {
    const result = await admin.post("/api/workspace/dataset/stage", { kind: "sheets", url: "https://docs.google.com/spreadsheets/d/SIFIRYETKI/edit" });
    assert.equal(result.status, 502);
    assert.match(result.data.error, /paylaşım/);
  });
});

describe("alt tablolu kaynaklar (Excel matrisi ve Google export)", () => {
  let server;
  let admin;
  const S = " › ";
  const matrix = [
    ["GAYRİMENKUL SATIŞ DOSYALARI"],
    ["SIRA", "ALACAKLI", "DOSYA NO", "HACİZ TARİHİ"],
    ["1", "Alacaklı A", "2018/10236", "8.11.2022"],
    ["2", "Alacaklı B", "2017/12039", "19.01.2023"],
    ["ÇEK CEZASI DOSYALARI"],
    ["SIRA", "MÜVEKKİL", "ESAS", "SON DURUM"],
    ["1", "Müvekkil C", "2024/170", "ARANMASI VAR."],
  ];
  const exportCsv = matrix.map(line => line.map(cell => `"${cell}"`).join(",")).join("\n");
  const requests = [];
  const fetchImpl = async url => {
    const target = String(url);
    requests.push(target.includes("/export?") ? "export" : target.includes("/gviz/") ? "gviz" : "edit");
    if (target.includes("/edit")) return new Response('<script>"gid":"7","name":"ÖNEMLİ"</script>', { status: 200 });
    // İlk Sheet'te export HTML (giriş sayfası) döner → gviz'e düşülmeli.
    if (target.includes("GIRIS") && target.includes("/export?")) return new Response("<html>giriş</html>", { status: 200, headers: { "content-type": "text/html" } });
    return new Response(exportCsv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8" } });
  };

  before(async () => {
    server = await startTestServer({ fetchImpl });
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("Excel matrisindeki alt tabloları sunucuda ayırır; etiketler sekme listesine girer", async () => {
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "Bolumlu.xlsx", sheets: [{ name: "ÖNEMLİ", matrix }] });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal(staged.data.data.rowCount, 3);
    assert.deepEqual(staged.data.data.tabs, [`ÖNEMLİ${S}GAYRİMENKUL SATIŞ DOSYALARI`, `ÖNEMLİ${S}ÇEK CEZASI DOSYALARI`]);
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
    const result = rowsOf(await admin.get(trpcUrl()));
    assert.deepEqual(result.rows.map(row => `${row.__sheet}|${row.__hofKey}`), [`ÖNEMLİ${S}GAYRİMENKUL SATIŞ DOSYALARI|2018/10236`, `ÖNEMLİ${S}GAYRİMENKUL SATIŞ DOSYALARI|2017/12039`, `ÖNEMLİ${S}ÇEK CEZASI DOSYALARI|2024/170`]);
    assert.equal(result.rows[2].MÜVEKKİL, "Müvekkil C");
    assert.deepEqual(result.tabs.map(tab => tab.title), staged.data.data.tabs);
  });

  it("Google Sheets'i önce export CSV ile okur ve alt tabloları ayırır", async () => {
    requests.length = 0;
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "sheets", url: "https://docs.google.com/spreadsheets/d/BOLUM/edit" });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.deepEqual(requests, ["edit", "export"]);
    assert.deepEqual(staged.data.data.tabs, [`ÖNEMLİ${S}GAYRİMENKUL SATIŞ DOSYALARI`, `ÖNEMLİ${S}ÇEK CEZASI DOSYALARI`]);
    assert.equal(staged.data.data.rowCount, 3);
    assert.deepEqual(staged.data.data.preview.merge, { added: 0, updated: 0, unchanged: 3, kept: 0 }, "aynı içerik: değişiklik yok");
  });

  it("export alınamazsa (giriş sayfası) gviz CSV'sine düşer", async () => {
    requests.length = 0;
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "sheets", url: "https://docs.google.com/spreadsheets/d/GIRIS/edit" });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.deepEqual(requests, ["edit", "export", "gviz"]);
    assert.equal(staged.data.data.rowCount, 3);
  });

  it("kolon adı değişince (eski birleşik başlık) ofisin düzeltmesi yeni kolona taşınır", async () => {
    const sourceName = "dataset://ofis";
    await admin.post("/api/workspace/overrides", { sourceName, caseKey: "2018/10236", field: "GAYRİMENKUL SATIŞ DOSYALARI HACİZ TARİHİ", value: "09.11.2022" });
    const result = rowsOf(await admin.get(trpcUrl(sourceName, true)));
    const row = result.rows.find(item => item.__hofKey === "2018/10236");
    assert.equal(row["HACİZ TARİHİ"], "09.11.2022");
    assert.equal(row["GAYRİMENKUL SATIŞ DOSYALARI HACİZ TARİHİ"], undefined, "eski adla ayrı kolon oluşmamalı");
  });
});
