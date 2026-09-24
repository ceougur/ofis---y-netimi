import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { canonicalCaseKey, columnOrder } from "../server/lib/sources.mjs";
import { csvToRecords, discoverTabs, parseCsv } from "../server/lib/sheets.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const trpcUrl = (sheetUrl, batch = false) => {
  const input = batch ? { 0: { json: { sheetUrl } } } : { json: { sheetUrl } };
  return `/api/trpc/sheets.getRows?${batch ? "batch=1&" : ""}input=${encodeURIComponent(JSON.stringify(input))}`;
};
const rowsOf = response => (Array.isArray(response.data) ? response.data[0] : response.data).result.data.json;

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

  it("Excel tablosunu yükler ve ofis kaynağı yapar", async () => {
    const upload = await admin.post("/api/workspace/sources/excel", { fileName: "Dosyalar.xlsx", tabs: ["Aktif", "Kapanan"], rows: excelRows });
    assert.equal(upload.status, 200);
    assert.equal(upload.data.data.sourceKey, "excel://Dosyalar.xlsx");
    assert.equal(upload.data.data.rowCount, 3);
    const state = await personel.get("/api/workspace/client-state");
    assert.equal(state.data.data.settings.sheetUrl, "excel://Dosyalar.xlsx");
    assert.equal(state.data.data.settings.activeSourceLabel, "Dosyalar.xlsx");
  });

  it("tüm bilgisayarlar aynı satırları kimlikleriyle görür", async () => {
    const result = rowsOf(await personel.get(trpcUrl("excel://Dosyalar.xlsx")));
    assert.equal(result.connected, true);
    assert.equal(result.rows.length, 3);
    assert.deepEqual(result.rows.map(row => row.__hofKey), ["2026/1", "2026/2", "2025/9"]);
    assert.deepEqual(result.tabs.map(tab => tab.title), ["Aktif", "Kapanan"]);
  });

  it("düzeltme, silme ve yeni kayıt birleşik görünüme yansır", async () => {
    const sourceName = "excel://Dosyalar.xlsx";
    await personel.post("/api/workspace/overrides", { sourceName, caseKey: "2026/1", field: "ÖDEME SÖZÜ", value: "" });
    await admin.post("/api/workspace/deleted", { sourceName, caseKey: "2026/2" });
    await personel.post("/api/workspace/records", { sourceName, values: { "DOSYA NO": "2026/3", BORÇLU: "Yeni Borçlu" } });
    const result = rowsOf(await personel.get(trpcUrl(sourceName, true)));
    assert.deepEqual(result.rows.map(row => row.__hofKey), ["2026/3", "2026/1", "2025/9"]);
    assert.equal(result.rows[1]["ÖDEME SÖZÜ"], "");
    assert.ok(result.rows[0].__hofRecord.startsWith("record-"));
    const restore = await admin.post("/api/workspace/deleted/restore", { sourceName, caseKey: "2026/2" });
    assert.equal(restore.status, 200);
    const restored = rowsOf(await personel.get(trpcUrl(sourceName)));
    assert.equal(restored.rows.length, 4);
  });

  it("aynı dosya adıyla yeniden yükleme düzeltmeleri korur", async () => {
    const updated = excelRows.map(row => ({ ...row, BORÇLU: `${row.BORÇLU} (güncel)` }));
    await admin.post("/api/workspace/sources/excel", { fileName: "Dosyalar.xlsx", tabs: ["Aktif", "Kapanan"], rows: updated });
    const result = rowsOf(await personel.get(trpcUrl("excel://Dosyalar.xlsx")));
    const first = result.rows.find(row => row.__hofKey === "2026/1");
    assert.equal(first.BORÇLU, "Ali Veli (güncel)");
    assert.equal(first["ÖDEME SÖZÜ"], "", "önceki düzeltme yeni yüklemede de geçerli");
  });

  it("kolon listesini döndürür", async () => {
    const result = await personel.get("/api/workspace/sources/columns");
    assert.deepEqual(result.data.data.columns, ["DOSYA NO", "BORÇLU", "ÖDEME SÖZÜ"]);
  });

  it("oturumsuz tRPC isteği tRPC hata biçiminde 401 döner", async () => {
    const result = await server.client().get(trpcUrl("excel://Dosyalar.xlsx", true));
    assert.equal(result.status, 401);
    assert.equal(result.data[0].error.json.data.code, "UNAUTHORIZED");
  });

  it("bilinmeyen Excel kaynağı anlaşılır mesaj verir", async () => {
    const result = rowsOf(await personel.get(trpcUrl("excel://Yok.xlsx")));
    assert.equal(result.connected, false);
    assert.match(result.message, /bulunamadı/);
  });
});

describe("Google Sheets (sahte ağ ile)", () => {
  let server;
  let admin;
  let calls = 0;
  const html = '<script>"gid":"0","name":"Aktif" "gid":"12","name":"Kapanan"</script>';
  const csv = { 0: "DOSYA NO,BORÇLU\n2026/10,Hakan\n2026/11,Elif\n", 12: "DOSYA NO,BORÇLU\n2024/5,Kemal\n" };
  const fetchImpl = async url => {
    calls += 1;
    const target = String(url);
    if (target.includes("/edit")) return new Response(html, { status: 200 });
    if (target.includes("SIFIRYETKI")) return new Response("", { status: 403 });
    const gid = new URL(target).searchParams.get("gid");
    return new Response(csv[gid] ?? "", { status: 200 });
  };
  const sheetUrl = "https://docs.google.com/spreadsheets/d/ABC123/edit?gid=0";

  before(async () => {
    server = await startTestServer({ fetchImpl });
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("tüm sekmeleri okur ve sonucu kısa süre önbellekte tutar", async () => {
    const first = rowsOf(await admin.get(trpcUrl(sheetUrl)));
    assert.equal(first.connected, true);
    assert.deepEqual(first.rows.map(row => `${row.__sheet}:${row.__hofKey}`), ["Aktif:2026/10", "Aktif:2026/11", "Kapanan:2024/5"]);
    const before = calls;
    rowsOf(await admin.get(trpcUrl(sheetUrl)));
    assert.equal(calls, before, "ikinci istek önbellekten gelmeli");
  });

  it("geçersiz bağlantıda anlaşılır mesaj verir", async () => {
    const result = rowsOf(await admin.get(trpcUrl("https://drive.google.com/klasor")));
    assert.equal(result.connected, false);
    assert.match(result.message, /Geçerli bir Google Sheets/);
  });

  it("izin hatasını kullanıcıya açıklar", async () => {
    const result = rowsOf(await admin.get(trpcUrl("https://docs.google.com/spreadsheets/d/SIFIRYETKI/edit")));
    assert.equal(result.connected, false);
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
    const upload = await admin.post("/api/workspace/sources/excel", { fileName: "Bolumlu.xlsx", tabs: ["ÖNEMLİ"], sheets: [{ name: "ÖNEMLİ", matrix }] });
    assert.equal(upload.status, 200, JSON.stringify(upload.data));
    assert.equal(upload.data.data.rowCount, 3);
    assert.deepEqual(upload.data.data.tabs, [`ÖNEMLİ${S}GAYRİMENKUL SATIŞ DOSYALARI`, `ÖNEMLİ${S}ÇEK CEZASI DOSYALARI`]);
    const result = rowsOf(await admin.get(trpcUrl("excel://Bolumlu.xlsx")));
    assert.deepEqual(result.rows.map(row => `${row.__sheet}|${row.__hofKey}`), [`ÖNEMLİ${S}GAYRİMENKUL SATIŞ DOSYALARI|2018/10236`, `ÖNEMLİ${S}GAYRİMENKUL SATIŞ DOSYALARI|2017/12039`, `ÖNEMLİ${S}ÇEK CEZASI DOSYALARI|2024/170`]);
    assert.equal(result.rows[2].MÜVEKKİL, "Müvekkil C");
    assert.deepEqual(result.tabs.map(tab => tab.title), upload.data.data.tabs);
  });

  it("Google Sheets'i önce export CSV ile okur ve alt tabloları ayırır", async () => {
    requests.length = 0;
    const result = rowsOf(await admin.get(trpcUrl("https://docs.google.com/spreadsheets/d/BOLUM/edit")));
    assert.equal(result.connected, true, result.message);
    assert.deepEqual(requests, ["edit", "export"]);
    assert.deepEqual(result.tabs.map(tab => tab.title), [`ÖNEMLİ${S}GAYRİMENKUL SATIŞ DOSYALARI`, `ÖNEMLİ${S}ÇEK CEZASI DOSYALARI`]);
    assert.equal(result.rows.length, 3);
    assert.match(result.message, /alt tablolar/);
  });

  it("export alınamazsa (giriş sayfası) gviz CSV'sine düşer", async () => {
    requests.length = 0;
    const result = rowsOf(await admin.get(trpcUrl("https://docs.google.com/spreadsheets/d/GIRIS/edit")));
    assert.equal(result.connected, true, result.message);
    assert.deepEqual(requests, ["edit", "export", "gviz"]);
    assert.equal(result.rows.length, 3);
  });

  it("kolon adı değişince (eski birleşik başlık) ofisin düzeltmesi yeni kolona taşınır", async () => {
    const sourceName = "excel://Bolumlu.xlsx";
    await admin.post("/api/workspace/overrides", { sourceName, caseKey: "2018/10236", field: "GAYRİMENKUL SATIŞ DOSYALARI HACİZ TARİHİ", value: "09.11.2022" });
    const result = rowsOf(await admin.get(trpcUrl(sourceName, true)));
    const row = result.rows.find(item => item.__hofKey === "2018/10236");
    assert.equal(row["HACİZ TARİHİ"], "09.11.2022");
    assert.equal(row["GAYRİMENKUL SATIŞ DOSYALARI HACİZ TARİHİ"], undefined, "eski adla ayrı kolon oluşmamalı");
  });
});
