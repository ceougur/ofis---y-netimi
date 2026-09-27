// Kolon başlıklarını adlandırma (v2.0.1): yalnızca görünen ad değişir; veri, düzeltmeler ve eşitleme asıl adla çalışır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
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

  it("adlar veri oturumuna özeldir", async () => {
    await admin.put("/api/workspace/columns", { columns: { AD_SOYAD: "Müşteri" } });
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "baska.xlsx", sheets: [{ name: "S", matrix: [["Plaka", "Model"], ["42 ABC 42", "X"]] }] });
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "session", name: "Araçlar" })).status, 200);
    assert.deepEqual((await admin.get("/api/workspace/profile")).data.data.columns, {}, "yeni oturum kendi adlarıyla başlar");
    assert.deepEqual((await staff.get("/api/workspace/profile")).data.data.columns, { AD_SOYAD: "Müşteri" }, "ilk oturumdaki personel kendi oturumunun adlarını görür");
  });
});
