// Excel'e dışa aktarma (v2.0.1): tablodaki birleşik veri gerçek .xlsx olarak; sayılar ve tarihler Excel türünde.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readZip } from "../server/lib/zip.mjs";
import { typedCell } from "../server/lib/xlsx-write.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const sheetsOf = buffer => new Map(readZip(buffer).map(entry => [entry.name, entry.data.toString("utf8")]));

describe("Excel'e dışa aktarma", () => {
  let server;
  let admin;
  let staff;

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    const staged = await admin.post("/api/workspace/dataset/stage", {
      kind: "excel",
      fileName: "taksitler.xlsx",
      sheets: [
        { name: "Taksitler", matrix: [["Müşteri No", "Müşteri", "Tutar", "Tarih", "Telefon"], ["M-1", "Ali <Veli> & Oğl.", "20.000,00 ₺", "12.03.2026", "0532 111 22 01"], ["M-2", "Ayşe Kara", "1.250,50 ₺", "01.04.2026", ""]] },
        { name: "Giderler", matrix: [["Kalem", "Oran"], ["Kira", "%18"]] },
      ],
    });
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" })).status, 200);
  });
  after(() => server.close());

  it("hücre türleri: tutar, tarih ve yüzde sayı olur; telefon, kimlik, dosya no ve açıklamalı tutar metin kalır", () => {
    assert.deepEqual(typedCell("20.000,00 ₺"), { value: 20000, format: '#,##0.00" ₺"' });
    assert.deepEqual(typedCell("12.03.2026"), { value: 46093, format: "dd.mm.yyyy" });
    assert.deepEqual(typedCell("%18"), { value: 0.18, format: "0%" });
    for (const text of ["0532 111 22 01", "12345678901", "2025/1234", "1.500 TL + faiz", "007", "M-1"]) assert.deepEqual(typedCell(text), { text }, text);
    assert.equal(typedCell("  "), null);
  });

  it("açık sekme tek sayfa olarak iner: başlık kalın ve sabit, süzgeçli, düzeltmeler dahil", async () => {
    const rows = (await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const ali = rows.find(row => row["Müşteri"].startsWith("Ali"));
    await admin.post("/api/workspace/overrides", { caseKey: ali.__hofKey, field: "Tutar", value: "21.500,00 ₺" });

    const response = await staff.raw("GET", `/api/workspace/export.xlsx?tab=${encodeURIComponent("Taksitler")}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.match(response.headers.get("content-disposition"), /filename\*=UTF-8''taksitler%20-%20Taksitler\.xlsx/);
    assert.equal(response.headers.get("x-hof-rows"), "2");
    const files = sheetsOf(response.buffer);
    assert.match(files.get("xl/workbook.xml"), /<sheet name="Taksitler" sheetId="1"/);
    assert.ok(!files.has("xl/worksheets/sheet2.xml"), "yalnızca açık sekme");
    const sheet = files.get("xl/worksheets/sheet1.xml");
    assert.match(sheet, /state="frozen"/);
    assert.match(sheet, /<autoFilter ref="A1:E3"\/>/);
    assert.match(sheet, /<c r="C2" s="\d+"><v>21500<\/v><\/c>/, "düzeltilen tutar sayı olarak");
    assert.match(sheet, /<c r="D2" s="\d+"><v>46093<\/v><\/c>/, "tarih Excel tarihi olarak");
    assert.match(sheet, /<c r="E2" t="inlineStr"><is><t>0532 111 22 01<\/t><\/is><\/c>/, "telefon metin");
    assert.match(sheet, /Ali &lt;Veli&gt; &amp; Oğl\./, "özel karakterler kaçışlı");
    assert.ok(!/__hof/.test(sheet), "gizli alanlar dışarı çıkmaz");
    assert.match(files.get("xl/styles.xml"), /formatCode="#,##0.00&quot; ₺&quot;"/);
    assert.match(files.get("xl/styles.xml"), /formatCode="dd.mm.yyyy"/);
  });

  it("tüm sekmeler ayrı sayfalarda iner; dışa aktarma değişiklik geçmişine yazılır", async () => {
    const response = await admin.raw("GET", "/api/workspace/export.xlsx?all=1");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-hof-rows"), "3");
    const files = sheetsOf(response.buffer);
    assert.match(files.get("xl/workbook.xml"), /<sheet name="Taksitler"[^>]*\/><sheet name="Giderler"/);
    assert.match(files.get("xl/worksheets/sheet2.xml"), /<c r="B2" s="\d+"><v>0.18<\/v><\/c>/);
    const audit = (await admin.get("/api/admin/audit?type=dataset.exported")).data.data;
    const events = Array.isArray(audit) ? audit : audit.events || audit.items || [];
    assert.ok(events.length >= 2, JSON.stringify(audit).slice(0, 200));
  });

  it("olmayan sekme 404; oturum gerekir", async () => {
    assert.equal((await admin.raw("GET", "/api/workspace/export.xlsx?tab=Yok")).status, 404);
    assert.equal((await server.client().raw("GET", "/api/workspace/export.xlsx")).status, 401);
  });
});
