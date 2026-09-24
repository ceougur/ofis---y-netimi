import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("çalışma alanı işlemleri", () => {
  let server;
  let admin;
  let personel;
  const source = "https://docs.google.com/spreadsheets/d/CALISMA/edit";

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    personel = await createUser(server, admin, { username: "zeynep", name: "Zeynep Ak", role: "personel" });
  });
  after(() => server.close());

  it("yeni kayıt oluşturur, aynı kimlikte ikinci kaydı reddeder", async () => {
    const created = await personel.post("/api/workspace/records", { sourceName: source, values: { "DOSYA NO": "2026/55", BORÇLU: "Ali Veli", __hofKey: "sizinti" } });
    assert.equal(created.status, 200);
    assert.equal(created.data.data.caseKey, "2026/55");
    assert.equal(created.data.data.values.__hofKey, undefined, "iç alanlar saklanmaz");
    const duplicate = await personel.post("/api/workspace/records", { sourceName: source, values: { "DOSYA NO": "2026/55" } });
    assert.equal(duplicate.status, 409);
    const empty = await personel.post("/api/workspace/records", { sourceName: source, values: { A: "  " } });
    assert.equal(empty.status, 400);
  });

  it("v1.0.0 uyumlu /cases ucu kayıt oluşturur", async () => {
    const result = await personel.post("/api/workspace/cases", { sourceName: source, client: "Can Demir", caseKey: "2026/77", court: "İstanbul 3. İcra" });
    assert.equal(result.status, 200);
    assert.equal(result.data.data.values["BORÇLU"], "Can Demir");
  });

  it("hücre düzeltmesinde sürüm çakışmasını 409 ile bildirir", async () => {
    const first = await personel.post("/api/workspace/overrides", { sourceName: source, caseKey: "2026/55", field: "DURUM", value: "Takipte" });
    assert.equal(first.data.data.version, 1);
    const conflict = await admin.post("/api/workspace/overrides", { sourceName: source, caseKey: "2026/55", field: "DURUM", value: "Kapandı", expectedVersion: 0 });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.currentValue, "Takipte");
    const overrides = await admin.get(`/api/workspace/overrides?sourceName=${encodeURIComponent(source)}&caseKey=2026%2F55`);
    assert.equal(overrides.data.data[0].actorName, "Zeynep Ak", "düzelten kişinin adı görünmeli (v1.0.0'da undefined idi)");
  });

  it("dosya işlemleri geçmişte işlemi yapan kişiyle görünür", async () => {
    const key = encodeURIComponent("2026/55");
    assert.equal((await personel.post(`/api/workspace/cases/${key}/notes`, { note: "Borçlu arandı" })).status, 200);
    assert.equal((await personel.post(`/api/workspace/cases/${key}/phones`, { phone: "0532 111 22 33", label: "Cep" })).status, 200);
    assert.equal((await personel.post(`/api/workspace/cases/${key}/payments`, { amount: "1.250,50", date: "2026-09-20", note: "Havale" })).status, 200);
    assert.equal((await personel.post(`/api/workspace/cases/${key}/liens`, { title: "Araç haczi", placedAt: "2026-09-01" })).status, 200);
    assert.equal((await personel.post(`/api/workspace/cases/${key}/payments`, { amount: "-5" })).status, 400);
    assert.equal((await personel.post(`/api/workspace/cases/${key}/phones`, { phone: "12" })).status, 400);
    const activity = await admin.get(`/api/workspace/cases/${key}/activity`);
    assert.equal(activity.status, 200);
    const types = activity.data.data.items.map(item => item.type).sort();
    assert.deepEqual(types, ["lien", "note", "payment", "phone"]);
    assert.ok(activity.data.data.items.every(item => item.actorName === "Zeynep Ak"));
    assert.equal(activity.data.data.paidTotal, 1250.5);
  });

  it("yaklaşan hacizler kaydı gireni gösterir", async () => {
    const soon = new Date(Date.now() - 360 * 86_400_000).toISOString().slice(0, 10);
    await personel.post(`/api/workspace/cases/${encodeURIComponent("2026/77")}/liens`, { title: "Banka haczi", placedAt: soon });
    const liens = await admin.get("/api/workspace/liens?days=7");
    assert.equal(liens.data.data.total, 1);
    assert.equal(liens.data.data.upcoming[0].actorName, "Zeynep Ak");
  });

  it("görev oluşturur, listeler ve tamamlar", async () => {
    const task = await admin.post("/api/workspace/tasks", { title: "Tebligatı kontrol et", assignee: "Zeynep Ak", caseKey: "2026/55", priority: "urgent", dueDate: "2026-10-01" });
    assert.equal(task.status, 200);
    const mine = await personel.get("/api/workspace/tasks?mine=1");
    assert.equal(mine.data.data.length, 1);
    assert.equal((await personel.post(`/api/workspace/tasks/${task.data.data.id}/complete`)).status, 200);
    const done = await admin.get("/api/workspace/tasks?status=completed");
    assert.equal(done.data.data[0].completedByName, "Zeynep Ak");
    const report = await admin.get("/api/workspace/reports");
    const row = report.data.data.report.find(item => item.userName === "Zeynep Ak");
    assert.equal(row.tasksCompleted, 1);
  });

  it("mesajlar gönderenin adı ve alıcı bilgisiyle listelenir", async () => {
    await admin.post("/api/workspace/messages", { to: "Zeynep Ak", message: "Dosyaya bakar mısın?" });
    const list = await personel.get("/api/workspace/messages");
    assert.equal(list.data.data[0].actorName, "Ofis yöneticisi");
    assert.equal(list.data.data[0].toMe, true);
  });

  it("merkezi dosya notlarını saklar, değişenleri döndürür ve içe aktarır", async () => {
    const saved = await personel.put(`/api/workspace/case-notes/${encodeURIComponent("2026/55")}`, { note: "Ödeme sözü alındı" });
    assert.equal(saved.status, 200);
    const all = await admin.get("/api/workspace/case-notes");
    assert.equal(all.data.data.notes[0].note, "Ödeme sözü alındı");
    const since = await admin.get(`/api/workspace/case-notes?since=${encodeURIComponent(all.data.data.serverTime)}`);
    assert.equal(since.data.data.notes.length, 0);
    const imported = await admin.post("/api/workspace/case-notes/import", { notes: { "2026/55": "ÜZERİNE YAZMAMALI", "2026/99": "Yerel not" } });
    assert.equal(imported.data.data.imported, 1);
    const after = await admin.get("/api/workspace/case-notes");
    const map = Object.fromEntries(after.data.data.notes.map(item => [item.caseKey, item.note]));
    assert.equal(map["2026/55"], "Ödeme sözü alındı");
    assert.equal(map["2026/99"], "Yerel not");
  });

  it("ofis geneli ayarları sürümleyerek saklar", async () => {
    const initial = await personel.get("/api/workspace/client-state");
    assert.equal(initial.data.data.sheetUrlSet, false);
    const { VERSION } = await import("../server/lib/config.mjs");
    assert.equal(initial.data.data.appVersion, VERSION, "açık ekranlar sunucu sürümünü görebilmeli");
    const updated = await admin.put("/api/workspace/client-state", { key: "sheetUrl", value: source });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.data.settings.sheetUrl, source);
    assert.equal(updated.data.data.settings.activeSourceLabel, "Google Sheets");
    assert.ok(updated.data.data.version > initial.data.data.version);
    assert.equal((await admin.put("/api/workspace/client-state", { key: "syncMinutes", value: "0" })).status, 400);
    assert.equal((await admin.put("/api/workspace/client-state", { key: "bilinmeyen", value: "x" })).status, 400);
    const cleared = await admin.del("/api/workspace/sources/active");
    assert.equal(cleared.data.data.settings.sheetUrl, "");
    assert.equal(cleared.data.data.sheetUrlSet, true);
  });

  it("personel adını değiştirebilir; işlemler yeni adla görünür", async () => {
    const renamed = await personel.post("/api/workspace/profile", { name: "Zeynep Ak Yılmaz" });
    assert.equal(renamed.status, 200);
    const activity = await admin.get(`/api/workspace/cases/${encodeURIComponent("2026/55")}/activity`);
    const own = activity.data.data.items.filter(item => item.type !== "task");
    assert.ok(own.length >= 4 && own.every(item => item.actorName === "Zeynep Ak Yılmaz"));
  });
});
