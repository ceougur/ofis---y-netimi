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

  it("muhasebe raporları görebilir, avukat kayıt silebilir", async () => {
    assert.equal((await muhasebe.get("/api/workspace/reports")).status, 200);
    assert.equal((await avukat.post("/api/workspace/deleted", { sourceName: source, caseKey: "2026/1" })).status, 200);
    assert.equal((await avukat.put("/api/workspace/client-state", { key: "syncMinutes", value: "15" })).status, 200);
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
