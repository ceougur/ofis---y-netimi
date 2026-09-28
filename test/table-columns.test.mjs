// Ortadaki tabloda sütun ekleme ve silme (v2.0.6): bir sütunun tamamı (başlık ve sekmedeki her satırın hücresi) eklenir
// ya da silinir; silinen sütun görünümden kalkar, sağdakiler sola kayar, veri durur ve Silinenler'den geri gelir.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readZip } from "../server/lib/zip.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const HEADER = ["Dosya No", "Borçlu", "Durum", "9. sütun", "Son tarih", "Tutar"];
const soon = () => {
  const day = new Date(Date.now() + 3 * 86_400_000);
  return `${String(day.getDate()).padStart(2, "0")}.${String(day.getMonth() + 1).padStart(2, "0")}.${day.getFullYear()}`;
};

describe("tabloda sütun ekleme ve silme (v2.0.6)", () => {
  let server;
  let admin;
  let staff;
  const view = async client => (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json;
  const tabRows = async (client, tab) => (await view(client)).rows.filter(row => row.__sheet === tab);
  const keysOf = row => Object.keys(row).filter(key => !key.startsWith("__"));
  const sheets = () => [
    { name: "Aktif", matrix: [HEADER, ["2026/1", "Ali Veli", "Takipte", "", soon(), "1.000"], ["2026/2", "Ayşe Kaya", "Takipte", "x", "", "2.000"], ["2026/3", "Can Er", "Kapandı", "", "", "3.000"]] },
    { name: "Arşiv", matrix: [["Dosya No", "Borçlu", "9. sütun"], ["2025/9", "Eski Kişi", ""]] },
  ];

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "dosyalar.xlsx", sheets: sheets() });
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" })).status, 200);
  });
  after(() => server.close());

  it("sütun seçilen sütunun hemen sağına, sekmedeki her satıra boş hücreyle eklenir; diğer sekme etkilenmez", async () => {
    const added = await admin.post("/api/workspace/columns/add", { tab: "Aktif", after: "Borçlu", name: "Son Durum" });
    assert.equal(added.status, 200, JSON.stringify(added.data));
    assert.equal(added.data.data.name, "Son Durum");
    const rows = await tabRows(admin, "Aktif");
    assert.equal(rows.length, 3);
    for (const row of rows) {
      assert.deepEqual(keysOf(row), ["Dosya No", "Borçlu", "Son Durum", "Durum", "9. sütun", "Son tarih", "Tutar"]);
      assert.equal(row["Son Durum"], "");
    }
    assert.deepEqual(keysOf((await tabRows(admin, "Arşiv"))[0]), ["Dosya No", "Borçlu", "9. sütun"], "başka sekme değişmez");
  });

  it("eklenen sütuna yazılan değer o sütunda kalır (benzer adlı “Durum” kolonuna kaymaz)", async () => {
    const [first] = await tabRows(admin, "Aktif");
    assert.equal((await staff.post("/api/workspace/overrides", { caseKey: first.__hofKey, field: "Son Durum", value: "Görüşülecek" })).status, 200);
    const [again] = await tabRows(admin, "Aktif");
    assert.equal(again["Son Durum"], "Görüşülecek");
    assert.equal(again.Durum, "Takipte");
  });

  it("ad verilmezse “Yeni sütun”, sonra “Yeni sütun 2”; aynı ad reddedilir; eklenenin sağına da eklenir", async () => {
    assert.equal((await admin.post("/api/workspace/columns/add", { tab: "Aktif", after: "Son Durum" })).data.data.name, "Yeni sütun");
    assert.equal((await admin.post("/api/workspace/columns/add", { tab: "Aktif", after: "Tutar", name: "" })).data.data.name, "Yeni sütun 2");
    const clash = await admin.post("/api/workspace/columns/add", { tab: "Aktif", after: "Tutar", name: "borçlu" });
    assert.equal(clash.status, 409);
    assert.equal((await admin.post("/api/workspace/columns/add", { tab: "Aktif", after: "Yok böyle", name: "X" })).status, 404);
    assert.deepEqual(keysOf((await tabRows(admin, "Aktif"))[0]), ["Dosya No", "Borçlu", "Son Durum", "Yeni sütun", "Durum", "9. sütun", "Son tarih", "Tutar", "Yeni sütun 2"]);
  });

  it("silinen sütun tüm satırlardan kalkar, sağdakiler sola kayar; verisi durur ve Silinenler'den geri gelir", async () => {
    const hidden = await admin.post("/api/workspace/columns/hide", { tab: "Aktif", column: "9. sütun" });
    assert.equal(hidden.status, 200, JSON.stringify(hidden.data));
    assert.equal(hidden.data.data.filled, 1, "kaç kayıtta bilgi olduğu");
    for (const row of await tabRows(admin, "Aktif")) assert.ok(!("9. sütun" in row));
    assert.deepEqual(keysOf((await tabRows(admin, "Aktif"))[0]), ["Dosya No", "Borçlu", "Son Durum", "Yeni sütun", "Durum", "Son tarih", "Tutar", "Yeni sütun 2"]);
    assert.ok("9. sütun" in (await tabRows(admin, "Arşiv"))[0], "aynı adlı sütun başka sekmede durur");
    // Sekmenin Excel çıktısında da yok.
    const exported = readZip((await admin.raw("GET", `/api/workspace/export.xlsx?tab=${encodeURIComponent("Aktif")}`)).buffer).find(entry => entry.name === "xl/worksheets/sheet1.xml").data.toString("utf8");
    assert.ok(!exported.includes("9. sütun") && exported.includes("Son Durum"));
    // Silinenler: listelenir ve geri yüklenir.
    const trash = (await admin.get("/api/admin/trash")).data.data;
    const item = trash.find(entry => entry.kind === "column" && entry.title === "9. sütun");
    assert.ok(item && /Sekme: Aktif/.test(item.detail) && /1 kayıtta bilgi vardı/.test(item.detail), JSON.stringify(item));
    const restored = await admin.post("/api/admin/trash/restore", { id: item.id });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    const row = (await tabRows(admin, "Aktif")).find(entry => entry["Dosya No"] === "2026/2");
    assert.equal(row["9. sütun"], "x", "veri silinmemişti");
    assert.deepEqual(keysOf(row).slice(4, 6), ["Durum", "9. sütun"], "eski yerinde");
  });

  it("bağlı olduğu sütun silinse de eklenen sütun yerinde kalır; son tarih sütunu silinince uyarısı da kalkar", async () => {
    const before = (await admin.get("/api/workspace/dues")).data.data.deadlines;
    assert.ok(before.some(item => item.column === "Son tarih"), JSON.stringify(before));
    assert.equal((await admin.post("/api/workspace/columns/hide", { tab: "Aktif", column: "Borçlu" })).status, 200);
    assert.deepEqual(keysOf((await tabRows(admin, "Aktif"))[0]).slice(0, 3), ["Dosya No", "Son Durum", "Yeni sütun"]);
    assert.equal((await admin.post("/api/workspace/columns/hide", { tab: "Aktif", column: "Son tarih" })).status, 200);
    assert.ok(!(await admin.get("/api/workspace/dues")).data.data.deadlines.some(item => item.column === "Son tarih"), "silinen tarih sütunu uyarı vermez");
    assert.equal((await admin.post("/api/workspace/columns/unhide", { tab: "Aktif", column: "Son tarih" })).status, 200);
    assert.equal((await admin.post("/api/workspace/columns/unhide", { tab: "Aktif", column: "Borçlu" })).status, 200);
    assert.ok((await admin.get("/api/workspace/dues")).data.data.deadlines.some(item => item.column === "Son tarih"), "geri gelince uyarı döner");
  });

  it("yeniden yükleme ve eşitlemeden sonra düzen kalır", async () => {
    assert.equal((await admin.post("/api/workspace/columns/hide", { tab: "Aktif", column: "Tutar" })).status, 200);
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "dosyalar.xlsx", sheets: sheets() });
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "merge" })).status, 200);
    const [row] = await tabRows(admin, "Aktif");
    assert.ok(!("Tutar" in row) && row["Son Durum"] === "Görüşülecek", JSON.stringify(row));
  });

  it("yalnız yönetici; son sütun silinemez; olmayan sütun reddedilir", async () => {
    assert.equal((await staff.post("/api/workspace/columns/add", { tab: "Aktif", after: "Dosya No", name: "Z" })).status, 403);
    assert.equal((await staff.post("/api/workspace/columns/hide", { tab: "Aktif", column: "Durum" })).status, 403);
    assert.equal((await admin.post("/api/workspace/columns/hide", { tab: "Aktif", column: "Olmayan" })).status, 404);
    for (const column of ["Borçlu", "9. sütun"]) assert.equal((await admin.post("/api/workspace/columns/hide", { tab: "Arşiv", column })).status, 200);
    const last = await admin.post("/api/workspace/columns/hide", { tab: "Arşiv", column: "Dosya No" });
    assert.equal(last.status, 400);
    assert.match(last.data.error, /en az bir sütun/);
    const audit = JSON.stringify((await admin.get("/api/admin/audit?type=source.column")).data);
    assert.match(audit, /source\.column\.added/);
    assert.match(audit, /source\.column\.hidden/);
  });
});
