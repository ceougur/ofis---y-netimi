import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe("silinenler ve geri yükleme (v2.0.2)", () => {
  let server;
  let admin;
  let staff;
  const rowsOf = async () => (await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
  const trash = async () => (await admin.get("/api/admin/trash")).data.data;
  const restore = id => admin.post("/api/admin/trash/restore", { id });

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    const matrix = [["Dosya No", "Borçlu", "Tutar"], ["2026/1", "Ali Veli", "1.000 TL"], ["2026/2", "Ayşe Kaya", "2.000 TL"], ["2026/3", "Can Er", "3.000 TL"]];
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "veri.xlsx", sheets: [{ name: "Aktif", matrix }] });
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
  });
  after(() => server.close());

  it("personel silinenleri göremez ve geri yükleyemez", async () => {
    assert.equal((await staff.get("/api/admin/trash")).status, 403);
    assert.equal((await staff.post("/api/admin/trash/restore", { id: "row:x" })).status, 403);
  });

  it("silinen tablo kaydı listede adıyla görünür; geri yüklenince eski yerine döner", async () => {
    const before = (await rowsOf()).map(row => row.__hofKey);
    const key = before[1];
    assert.equal((await admin.post("/api/workspace/deleted", { caseKey: key })).status, 200);
    assert.ok(!(await rowsOf()).some(row => row.__hofKey === key));
    const item = (await trash()).find(entry => entry.kind === "row");
    assert.equal(item.title, "2026/2 · Ayşe Kaya");
    assert.match(item.detail, /Aktif/);
    const result = await restore(item.id);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.deepEqual((await rowsOf()).map(row => row.__hofKey), before, "sıra değişmedi");
    assert.equal((await restore(item.id)).status, 404, "ikinci kez geri yüklenmez");
  });

  it("tahsilat ve kasa hareketi silinip geri yüklenir; Kasa yeniden hesaplanır", async () => {
    const key = encodeURIComponent("2026/1");
    const payment = (await admin.post(`/api/workspace/cases/${key}/payments`, { amount: "1.500", date: "2026-09-10", note: "Elden", caseTitle: "Ali Veli" })).data.data;
    const entry = (await admin.post("/api/workspace/cash", { kind: "out", amount: "200", date: "2026-09-11", description: "Kırtasiye" })).data.data;
    assert.equal((await admin.del(`/api/workspace/payments/${payment.id}`)).status, 200);
    assert.equal((await admin.del(`/api/workspace/cash/${entry.id}`)).status, 200);
    assert.equal((await admin.get("/api/workspace/cash")).data.data.totals.balance, 0);
    const items = await trash();
    const paid = items.find(item => item.kind === "payment");
    const cash = items.find(item => item.kind === "cash");
    assert.equal(paid.title, "Ali Veli");
    assert.match(paid.detail, /1\.500,00/);
    assert.match(cash.detail, /Ödeme/);
    assert.equal((await restore(paid.id)).status, 200);
    assert.equal((await restore(cash.id)).status, 200);
    assert.equal((await admin.get("/api/workspace/cash")).data.data.totals.balance, 1300);
    const activity = (await admin.get(`/api/workspace/cases/${key}/activity`)).data.data.items;
    assert.ok(activity.some(item => item.id === payment.id && item.amount === 1500), "aynı kimlikle geri geldi");
    assert.ok(!(await trash()).some(item => item.id === paid.id), "geri yüklenen listeden çıkar");
  });

  it("serbest sayfa satırı eski sırasına araya eklenir; o arada eklenen satırın üzerine yazılmaz", async () => {
    const created = (await admin.post("/api/workspace/free", { name: "Masraflar", columns: 2, rows: 3, names: ["Kalem", "Tutar"] })).data.data;
    const cellAt = (detail, r, c) => ({ row: detail.rows[r].id, col: detail.columns[c].id });
    let detail = (await admin.put(`/api/workspace/free/${created.id}/cells`, { cells: [
      { ...cellAt(created, 0, 0), raw: "Kira" }, { ...cellAt(created, 0, 1), raw: "100" },
      { ...cellAt(created, 1, 0), raw: "Yakıt" }, { ...cellAt(created, 1, 1), raw: "200" },
      { ...cellAt(created, 2, 0), raw: "Toplam" }, { ...cellAt(created, 2, 1), raw: "=TOPLA(B1:B2)" },
    ] })).data.data;
    assert.equal(detail.rows[2].cells[1].display, "300");
    // 2. satır (Yakıt) silinir; yerine yeni bir satır eklenip doldurulur.
    detail = (await admin.del(`/api/workspace/free/${created.id}/rows/${detail.rows[1].id}`)).data.data;
    detail = (await admin.post(`/api/workspace/free/${created.id}/rows`, { index: 1, count: 1 })).data.data;
    detail = (await admin.put(`/api/workspace/free/${created.id}/cells`, { cells: [{ ...cellAt(detail, 1, 0), raw: "Kargo" }, { ...cellAt(detail, 1, 1), raw: "50" }] })).data.data;
    const item = (await trash()).find(entry => entry.kind === "free-row");
    assert.equal(item.title, "Masraflar · 2. satır");
    assert.match(item.detail, /Yakıt/);
    const result = await restore(item.id);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.match(result.data.data.message, /2\. satır/);
    detail = (await admin.get(`/api/workspace/free/${created.id}`)).data.data;
    assert.deepEqual(detail.rows.map(row => row.cells[0].display), ["Kira", "Yakıt", "Kargo", "Toplam"], "Kargo aşağı kaydı, silinmedi");
    // Excel'deki gibi: satır silinince =TOPLA(B1:B2) aralığı B1:B1'e daralır; araya eklenen satırlar aralığa girmez.
    assert.equal(detail.rows[3].cells[1].display, "100");
    assert.ok(!detail.rows.some(row => row.cells.some(cell => /#BAŞV!/.test(cell.display))), "başvuru hatası yok");
  });

  it("serbest sayfa kolonu eski sırasına geri eklenir; adı alınmışsa '(geri yüklendi)'", async () => {
    const sheet = (await admin.get("/api/workspace/free")).data.data.sheets.find(item => item.name === "Masraflar");
    let detail = (await admin.get(`/api/workspace/free/${sheet.id}`)).data.data;
    const tutar = detail.columns[1].id;
    detail = (await admin.del(`/api/workspace/free/${sheet.id}/columns/${tutar}`)).data.data;
    detail = (await admin.post(`/api/workspace/free/${sheet.id}/columns`, { index: 1, count: 1, names: ["Tutar"] })).data.data;
    const item = (await trash()).find(entry => entry.kind === "free-column");
    assert.equal((await restore(item.id)).status, 200);
    detail = (await admin.get(`/api/workspace/free/${sheet.id}`)).data.data;
    assert.deepEqual(detail.columns.map(column => column.header || column.name), ["Kalem", "Tutar (geri yüklendi)", "Tutar"]);
    assert.equal(detail.rows[0].cells[1].display, "100");
  });

  it("silinen serbest sayfa geri gelir; adı başka bir sekmede kullanılıyorsa yeni adla", async () => {
    const sheet = (await admin.get("/api/workspace/free")).data.data.sheets.find(item => item.name === "Masraflar");
    assert.equal((await admin.del(`/api/workspace/free/${sheet.id}`)).status, 200);
    assert.equal((await admin.post("/api/workspace/free", { name: "Masraflar" })).status, 200);
    const item = (await trash()).find(entry => entry.kind === "free-sheet");
    const result = await restore(item.id);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.match(result.data.data.message, /Masraflar \(geri yüklendi\)/);
    const names = (await admin.get("/api/workspace/free")).data.data.sheets.map(entry => entry.name);
    assert.ok(names.includes("Masraflar") && names.includes("Masraflar (geri yüklendi)"));
  });

  it("silinen belge geri yüklenir", async () => {
    const key = encodeURIComponent("2026/3");
    const uploaded = await admin.raw("POST", `/api/workspace/cases/${key}/documents?name=${encodeURIComponent("vekalet.pdf")}`, { body: PDF, headers: { "content-type": "application/octet-stream", "x-hof-upload": "1" } });
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.data));
    assert.equal((await admin.del(`/api/workspace/documents/${uploaded.data.data.id}`)).status, 200);
    const item = (await trash()).find(entry => entry.kind === "document");
    assert.equal(item.title, "vekalet.pdf");
    assert.equal((await restore(item.id)).status, 200);
    const list = (await admin.get(`/api/workspace/cases/${key}/documents`)).data.data.documents;
    assert.ok(list.some(doc => doc.name === "vekalet.pdf"));
  });

  it("2.0.1'de silinmiş tahsilat göçle silinenlere alınır", () => {
    const store = server.app.store;
    store.run("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES ('ev-eski', 'case.payment.deleted', 'pay-eski', 'u1', 'Yönetici', ?, '2026-09-01T10:00:00.000Z')", JSON.stringify({ caseKey: "2026/1", amount: 750, date: "2026-08-30", note: "eski" }));
    MIGRATIONS.find(item => item.version === 6).up(store);
    const row = store.get("SELECT kind, ref, payload_json FROM trash WHERE id = 'trash-ev-eski'");
    assert.equal(row.kind, "payment");
    assert.equal(JSON.parse(row.payload_json).amount, 750);
  });
});
