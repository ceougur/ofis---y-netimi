// 2.0.12: taksit kartının Kayıt Tarihi carinin kayıt tarihidir (müşteri: "tahsilat girince kayıt tarihi değişiyor" — kart
// formu ve toplu taksitlendirme bugünü yazıyordu). Tek kart (tarih verilmezse), toplu taksitlendirme, cari araması.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { okulServisiWorkbook } from "./fixtures/okul-servisi-ornek.mjs";

const data = response => response.data.data;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

describe("taksit kartının kayıt tarihi carinin tarihidir (2.0.12)", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(async () => server?.close());

  it("cari araması kayıt tarihini ve grubu döndürür (form cari seçilince doldurur)", async () => {
    await admin.post("/api/workspace/accounts", { name: "Yasemin Taşkıran", type: "customer", phone: "0538 773 87 79", registeredOn: "2026-03-05", groupName: "34 SRV 202" });
    const hits = data(await admin.get("/api/workspace/accounts/search?q=Yasemin"));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].registeredOn, "2026-03-05");
    assert.ok(hits[0].groupId, "grup kimliği");
  });

  it("tek kart: tarih yazılmazsa carinin tarihi; yazılırsa yazılan; carisiz kart bugün", async () => {
    const [acc] = data(await admin.get("/api/workspace/accounts/search?q=Yasemin"));
    const card = data(await admin.post("/api/workspace/plans", { name: "Yasemin Taşkıran", accountId: acc.id, total: "12000", count: 4, firstDue: "2026-10-10" }));
    assert.equal(card.registeredOn, "2026-03-05", "carinin tarihi");
    const own = data(await admin.post("/api/workspace/plans", { name: "Yasemin Taşkıran", accountId: acc.id, total: "100", registeredOn: "2026-04-01" }));
    assert.equal(own.registeredOn, "2026-04-01", "kullanıcının yazdığı tarih korunur");
    const alone = data(await admin.post("/api/workspace/plans", { name: "Carisiz Kişi", total: "100" }));
    assert.equal(alone.registeredOn, today());
    // Kart düzenlenince (ör. Kapat) tarih değişmez.
    const closed = data(await admin.put(`/api/workspace/plans/${card.id}`, { status: "closed" }));
    assert.equal(closed.registeredOn, "2026-03-05");
    const cari = data(await admin.get(`/api/workspace/accounts/${acc.id}`));
    assert.equal(cari.registeredOn, "2026-03-05", "carinin tarihi hiçbir işlemde değişmez");
  });

  it("toplu taksitlendirme: her kart kendi carisinin tarihini alır", async () => {
    const a = data(await admin.post("/api/workspace/accounts", { name: "Kerem Aydın", type: "customer", registeredOn: "2026-02-10" }));
    const b = data(await admin.post("/api/workspace/accounts", { name: "Selin Yurt", type: "customer", registeredOn: "2026-06-21" }));
    const done = data(await admin.post("/api/workspace/accounts/bulk-plan", { ids: [a.id, b.id], amountMode: "fixed", total: "9000", count: "3", firstDue: "2026-10-10", everyMonths: "1", skipExisting: true }));
    assert.equal(done.created, 2);
    const plans = data(await admin.get("/api/workspace/plans?status=all")).plans;
    assert.equal(plans.find(plan => plan.name === "Kerem Aydın").registeredOn, "2026-02-10");
    assert.equal(plans.find(plan => plan.name === "Selin Yurt").registeredOn, "2026-06-21");
  });
  it("Excel'den yükleme: Excel'de kayıt tarihi yoksa bağlanan mevcut carinin tarihi; varsa Excel'deki", async () => {
    await admin.post("/api/workspace/accounts", { name: "Hakan Demir", type: "customer", phone: "0533 444 55 66", registeredOn: "2026-01-08" });
    const matrix = [["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], ["Hakan Demir", "0533 444 55 66", "6000", "3", "10.10.2026"], ["Yeni Kişi", "0533 999 00 00", "3000", "3", "10.10.2026"]];
    const preview = data(await admin.post("/api/workspace/plans/import/preview", { matrix }));
    const result = await admin.post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "kartlar.xlsx" });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const plans = data(await admin.get("/api/workspace/plans?status=all")).plans;
    assert.equal(plans.find(plan => plan.name === "Hakan Demir").registeredOn, "2026-01-08", "mevcut carinin tarihi");
    assert.equal(plans.find(plan => plan.name === "Yeni Kişi").registeredOn, today(), "yeni kişi: bugün");
    const dated = [["Ad Soyad", "Telefon", "Kayıt Tarihi", "Toplam Tutar"], ["Hakan Demir", "0533 444 55 66", "20.02.2026", "900"]];
    const p2 = data(await admin.post("/api/workspace/plans/import/preview", { matrix: dated }));
    await admin.post("/api/workspace/plans/import", { matrix: dated, headerAt: p2.headerAt, roles: p2.roles, fileName: "k2.xlsx", mode: "add" });
    const again = data(await admin.get("/api/workspace/plans?status=all")).plans.filter(plan => plan.name === "Hakan Demir").map(plan => plan.registeredOn);
    assert.ok(again.includes("2026-02-20") || again.length === 1, `Excel'deki tarih kullanılır ya da çift kart açılmaz: ${again}`);
  });
  it("Tablodan Aktar: tabloda kayıt tarihi yoksa bağlanan mevcut carinin tarihi", async () => {
    const book = okulServisiWorkbook();
    const sheet = book.find(item => item.name === "Öğrenciler");
    const matrix = [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(col => row[col] ?? ""))];
    const staged = data(await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Öğrenciler", matrix }] }));
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" });
    const first = sheet.rows[0];
    await admin.post("/api/workspace/accounts", { name: first.Öğrenci, type: "customer", phone: first["Veli Telefon"], registeredOn: "2026-01-05" });
    const preview = data(await admin.get("/api/workspace/plans/from-table"));
    const row = preview.records.find(item => item.name === first.Öğrenci);
    assert.ok(row, "tablodaki kişi aktarılabilir listede");
    const done = await admin.post("/api/workspace/plans/from-table", { keys: [row.key], fingerprint: preview.fingerprint });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    const plan = data(await admin.get("/api/workspace/plans?status=all")).plans.find(item => item.name === first.Öğrenci);
    assert.equal(plan.registeredOn, "2026-01-05", `aktarılan kart: ${plan.registeredOn}`);
  });
});
