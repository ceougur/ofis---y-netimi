// 2.3.0 bitiş turu — eleştirmen E6: Silinenler'den not geri yüklemek, silmek gibi Kayıt Düzeltme (records.edit) yetkisi ister (simetri).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

describe("İşlem geçmişi geri yükleme yetkisi (records.edit)", () => {
  let server;
  let admin;
  let restricted;
  before(async () => {
    server = await startTestServer({ now: { time: "2026-10-08T09:00:00+03:00", fixed: true } });
    admin = await loginAdmin(server);
    const user = await admin.post("/api/admin/users", { username: "silici1", name: "Silici Bir", role: "avukat", password: "Avukat-2026!", mustChangePassword: false });
    assert.equal(user.status, 200);
    assert.equal((await admin.patch(`/api/admin/users/${user.data.data.id}`, { grants: { add: ["records.delete"], remove: ["records.edit"] } })).status, 200);
    restricted = server.client();
    assert.equal((await restricted.login("silici1", "Avukat-2026!")).status, 200);
  });
  after(() => server.close());

  it("records.edit yetkisi olmayan kullanıcı silinmiş notu geri yükleyemez (403); yönetici yükler", async () => {
    const created = await admin.post(`/api/workspace/cases/${encodeURIComponent("2026/901")}/notes`, { note: "geri yükleme yetkisi" });
    assert.equal(created.status, 200, JSON.stringify(created.data).slice(0, 200));
    const noteId = created.data.data?.id || created.data.data?.note?.id;
    assert.ok(noteId, `not kimliği — gelen ${JSON.stringify(created.data).slice(0, 200)}`);
    assert.equal((await admin.del(`/api/workspace/notes/${noteId}`)).status, 200, "not silindi");
    const bin = (await admin.get("/api/admin/trash")).data.data.find(item => item.ref === noteId);
    assert.ok(bin, "Silinenler'de");
    const denied = await restricted.post("/api/admin/trash/restore", { id: bin.id });
    assert.equal(denied.status, 403, `records.edit yok → 403 (gelen ${denied.status} ${JSON.stringify(denied.data).slice(0, 160)})`);
    assert.equal((await admin.post("/api/admin/trash/restore", { id: bin.id })).status, 200, "yönetici geri yükler");
  });
});
