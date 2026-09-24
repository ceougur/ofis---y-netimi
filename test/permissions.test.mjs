import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("rol bazlı yetkiler", () => {
  let server;
  let admin;
  let personel;
  let muhasebe;
  let avukat;
  const source = "https://docs.google.com/spreadsheets/d/YETKI/edit";

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    personel = await createUser(server, admin, { username: "personel1", role: "personel" });
    muhasebe = await createUser(server, admin, { username: "muhasebe1", role: "muhasebe" });
    avukat = await createUser(server, admin, { username: "avukat1", role: "avukat" });
  });
  after(() => server.close());

  it("personel dosya işlemi yapabilir ama kayıt silemez", async () => {
    assert.equal((await personel.post("/api/workspace/cases/2026%2F1/notes", { note: "Arandı" })).status, 200);
    assert.equal((await personel.post("/api/workspace/records", { sourceName: source, values: { "DOSYA NO": "2026/1" } })).status, 200);
    const deleted = await personel.post("/api/workspace/deleted", { sourceName: source, caseKey: "2026/1" });
    assert.equal(deleted.status, 403);
    assert.equal(deleted.data.code, "FORBIDDEN");
  });

  it("personel raporları, değişiklik geçmişini ve yönetimi göremez", async () => {
    assert.equal((await personel.get("/api/workspace/reports")).status, 403);
    assert.equal((await personel.get("/api/admin/users")).status, 403);
    assert.equal((await personel.get("/api/admin/audit")).status, 403);
    const state = await personel.get("/api/workspace/state");
    assert.equal(state.status, 200);
    assert.deepEqual(state.data.data.events, []);
  });

  it("personel veri kaynağını değiştiremez", async () => {
    assert.equal((await personel.put("/api/workspace/client-state", { key: "sheetUrl", value: source })).status, 403);
    assert.equal((await personel.post("/api/workspace/sources/excel", { fileName: "a.xlsx", rows: [] })).status, 403);
  });

  it("performans raporunu yalnızca avukat ve yönetici görür; avukat kayıt silebilir ama veri yükleyemez", async () => {
    assert.equal((await muhasebe.get("/api/workspace/reports")).status, 403);
    assert.equal((await avukat.get("/api/workspace/reports")).status, 200);
    assert.equal((await avukat.post("/api/workspace/deleted", { sourceName: source, caseKey: "2026/1" })).status, 200);
    // v1.5.0: veri yükleme, kaldırma ve eşitleme ayarları yalnızca yöneticide.
    assert.equal((await avukat.put("/api/workspace/client-state", { key: "syncMinutes", value: "15" })).status, 403);
    assert.equal((await avukat.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "a.xlsx", sheets: [] })).status, 403);
    assert.equal((await admin.put("/api/workspace/client-state", { key: "syncMinutes", value: "15" })).status, 200);
  });

  it("görev atama ve herkesin görevleri yalnızca avukat ve yöneticide; personel kendi görevini görür ve tamamlar", async () => {
    const me = name => ({ title: `Görev: ${name}`, assignee: name });
    assert.equal((await personel.post("/api/workspace/tasks", me("Personel Bir"))).status, 403, "personel görev atayamaz");
    assert.equal((await muhasebe.post("/api/workspace/tasks", me("Personel Bir"))).status, 403, "muhasebe görev atayamaz");
    const own = await avukat.post("/api/workspace/tasks", { title: "Tebligatı kontrol et", assignee: "personel1" });
    const other = await avukat.post("/api/workspace/tasks", { title: "Avukatın kendi işi", assignee: "Av. Test" });
    assert.equal(own.status, 200);
    assert.equal(other.status, 200);
    const personelOpen = (await personel.get("/api/workspace/tasks?status=open")).data.data.map(task => task.title);
    assert.ok(personelOpen.includes("Tebligatı kontrol et"));
    assert.ok(!personelOpen.includes("Avukatın kendi işi"), "personel başkasının görevini görmez");
    const state = (await personel.get("/api/workspace/state")).data.data;
    assert.ok(!state.tasks.some(task => task.title === "Avukatın kendi işi"), "uyumluluk ucu da süzer");
    const avukatOpen = (await avukat.get("/api/workspace/tasks?status=open")).data.data.map(task => task.title);
    assert.ok(avukatOpen.includes("Avukatın kendi işi") && avukatOpen.includes("Tebligatı kontrol et"));
    // Dosya geçmişi de aynı kurala uyar: personel dosyadaki başkasına ait görevi görmez.
    await avukat.post("/api/workspace/tasks", { title: "Dosyada avukat görevi", assignee: "Av. Test", caseKey: "2026/2" });
    await avukat.post("/api/workspace/tasks", { title: "Dosyada personel görevi", assignee: "personel1", caseKey: "2026/2" });
    const activityTasks = async client => (await client.get(`/api/workspace/cases/${encodeURIComponent("2026/2")}/activity`)).data.data.items.filter(item => item.type === "task").map(item => item.title).sort();
    assert.deepEqual(await activityTasks(personel), ["Dosyada personel görevi"]);
    assert.deepEqual(await activityTasks(avukat), ["Dosyada avukat görevi", "Dosyada personel görevi"]);
    assert.equal((await personel.post(`/api/workspace/tasks/${other.data.data.id}/complete`)).status, 404, "başkasının görevini tamamlayamaz");
    assert.equal((await personel.post(`/api/workspace/tasks/${own.data.data.id}/complete`)).status, 200);
    const me2 = (await personel.get("/api/auth/me")).data.data;
    assert.ok(!me2.permissions.includes("tasks.create") && !me2.permissions.includes("reports.view") && me2.permissions.includes("tasks.complete"));
  });

  it("yönetici kendini pasifleştiremez ve son yönetici korunur", async () => {
    const me = await admin.get("/api/auth/me");
    const self = await admin.patch(`/api/admin/users/${me.data.data.id}`, { active: false });
    assert.equal(self.status, 400);
    const demote = await admin.patch(`/api/admin/users/${me.data.data.id}`, { role: "avukat" });
    assert.equal(demote.status, 400);
  });

  it("yönetici rol değiştirir; pasifleştirilen kullanıcının oturumu kapanır", async () => {
    const users = (await admin.get("/api/admin/users")).data.data;
    const target = users.find(user => user.username === "muhasebe1");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { role: "personel" })).status, 200);
    assert.equal((await muhasebe.get("/api/workspace/reports")).status, 403);
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { active: false })).status, 200);
    assert.equal((await muhasebe.get("/api/auth/me")).status, 401);
  });

  it("yönetici parola sıfırlar; kullanıcı ilk girişte değiştirmek zorunda kalır", async () => {
    const users = (await admin.get("/api/admin/users")).data.data;
    const target = users.find(user => user.username === "personel1");
    const reset = await admin.post(`/api/admin/users/${target.id}/reset-password`, { password: "Gecici-Parola-11" });
    assert.equal(reset.status, 200);
    assert.equal((await personel.get("/api/auth/me")).status, 401, "eski oturum kapanmalı");
    const login = await personel.login("personel1", "Gecici-Parola-11");
    assert.equal(login.data.data.mustChangePassword, true);
  });

  it("zayıf parola ve tekrar eden kullanıcı adı reddedilir", async () => {
    assert.equal((await admin.post("/api/admin/users", { username: "yeni", name: "Yeni", role: "personel", password: "123" })).status, 400);
    assert.equal((await admin.post("/api/admin/users", { username: "PERSONEL1", name: "X", role: "personel", password: "Guclu-Parola-99" })).status, 409);
    assert.equal((await admin.post("/api/admin/users", { username: "rolsuz", name: "X", role: "patron", password: "Guclu-Parola-99" })).status, 400);
  });
});
