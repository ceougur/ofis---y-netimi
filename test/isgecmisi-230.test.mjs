// 2.3.0 İz 5.6 (müşteri talebi 6): kayıt detay kartındaki işlem geçmişi — not / telefon / haciz düzeltme (PUT) ve silme (DELETE),
// Silinenler'e düşme ve geri yükleme, yetki (kayıt düzeltme yetkisi kaldırılan kullanıcı 403), denetim kaydı, haciz düşüm tarihinin
// yeniden hesaplanması ve Haciz Uyarıları listesinin silinen/düzeltilen hacze uyması. Eski kodda (2.2.0, b24e0c2) PUT/DELETE uçları
// yoktur → 404/405 (kırmızı kanıt: docs/kanit/2026-10-15/iz5-isgecmisi-kirmizi).
// "Nasıl bozarım": başkasının notunu düzelt (yetkisi olan düzeltir — kayıt ofisindir), yetkisiz kullanıcı, olmayan kimlik, boş not,
// bozuk telefon, bozuk tarih, sil → geri yükle → ikinci geri yükleme (409 "zaten"), iki kez sil (404).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

// Sabit sahte saat (ders 13): haciz düşümü saat üzerinden hesaplanır; takvim gününe bağlı değildir.
const NOW = "2026-06-15T10:00:00+03:00";
const dayAfter = days => new Date(new Date(NOW).getTime() + days * 86_400_000).toISOString();

describe("işlem geçmişi düzelt / sil / geri yükle (2.3.0 İz 5.6)", () => {
  let server;
  let admin;
  let staff;
  let restricted;
  const CASE = "2026/501";
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "personel1", name: "Personel Bir" });
    // Kayıt düzeltme yetkisi kaldırılmış kullanıcı: not ekleyebilir ama geçmişi düzeltip silemez.
    const kisitli = await admin.post("/api/admin/users", { username: "kisitli1", name: "Kısıtlı Bir", role: "personel", password: "Personel-2026!", mustChangePassword: false });
    assert.equal(kisitli.status, 200);
    assert.equal((await admin.patch(`/api/admin/users/${kisitli.data.data.id}`, { grants: { add: [], remove: ["records.edit"] } })).status, 200);
    restricted = server.client();
    assert.equal((await restricted.login("kisitli1", "Personel-2026!")).status, 200);
  });
  after(() => server.close());

  const activity = async (client = admin) => {
    const result = await client.get(`/api/workspace/cases/${encodeURIComponent(CASE)}/activity`);
    assert.equal(result.status, 200);
    return result.data.data.items;
  };
  const auditTypes = entityId => server.app.store.all("SELECT type FROM audit_events WHERE entity_id = ? ORDER BY created_at, rowid", entityId).map(row => row.type);
  const trashOf = async ref => (await admin.get("/api/admin/trash")).data.data.find(item => item.ref === ref);

  it("not: personel ekler, yönetici düzeltir (düzeltme izi), siler, Silinenler'den geri gelir; denetim kaydı tam", async () => {
    const created = await staff.post(`/api/workspace/cases/${encodeURIComponent(CASE)}/notes`, { note: "İlk görüşme yapıldı" });
    assert.equal(created.status, 200);
    const id = created.data.data.id;

    const edited = await admin.put(`/api/workspace/notes/${id}`, { note: "İlk görüşme yapıldı; evrak istendi" });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    let note = (await activity()).find(item => item.type === "note" && item.id === id);
    assert.equal(note.text, "İlk görüşme yapıldı; evrak istendi");
    assert.equal(note.actorName, "Personel Bir", "giren değişmez");
    assert.ok(note.updatedAt, "düzeltme zamanı");
    assert.equal(note.updatedByName, "Ofis yöneticisi");

    assert.equal((await admin.put(`/api/workspace/notes/${id}`, { note: "   " })).status, 400, "boş not reddedilir");
    assert.equal((await admin.put("/api/workspace/notes/yok-boyle-bir-not", { note: "x" })).status, 404);

    const deleted = await admin.del(`/api/workspace/notes/${id}`);
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
    assert.equal((await activity()).filter(item => item.type === "note").length, 0, "geçmişten düştü");
    assert.equal((await admin.del(`/api/workspace/notes/${id}`)).status, 404, "ikinci silme 404");
    const bin = await trashOf(id);
    assert.ok(bin, "Silinenler'de");
    assert.equal(bin.kind, "note");
    assert.equal(bin.kindLabel, "Not");
    assert.equal(bin.title, "İlk görüşme yapıldı; evrak istendi");
    assert.equal(bin.restorable, true);

    const restored = await admin.post("/api/admin/trash/restore", { id: bin.id });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    note = (await activity()).find(item => item.type === "note" && item.id === id);
    assert.ok(note, "aynı kimlikle geri geldi");
    assert.equal(note.text, "İlk görüşme yapıldı; evrak istendi");
    assert.equal(note.actorName, "Personel Bir", "ilk giren korunur");
    assert.equal((await admin.post("/api/admin/trash/restore", { id: bin.id })).status, 404, "ikinci geri yükleme: zaten geri yüklenmiş");
    assert.deepEqual(auditTypes(id), ["case.note.created", "case.note.updated", "case.note.deleted", "case.note.restored"]);
    const updatedAudit = server.app.store.get("SELECT payload_json FROM audit_events WHERE entity_id = ? AND type = 'case.note.updated'", id);
    assert.equal(JSON.parse(updatedAudit.payload_json).previous.note, "İlk görüşme yapıldı", "eski değer denetim kaydında");
  });

  it("telefon: düzeltme numarayı temizler, bozuk numara 400; silme Silinenler'e gider ve geri gelir", async () => {
    const created = await admin.post(`/api/workspace/cases/${encodeURIComponent(CASE)}/phones`, { phone: "0532 111 22 33", label: "Cep" });
    assert.equal(created.status, 200);
    const id = created.data.data.id;
    assert.equal((await admin.put(`/api/workspace/phones/${id}`, { phone: "123", label: "Cep" })).status, 400, "kısa numara reddedilir");
    const edited = await admin.put(`/api/workspace/phones/${id}`, { phone: "0533 444 55 66", label: "İş" });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    let phone = (await activity()).find(item => item.type === "phone" && item.id === id);
    assert.equal(phone.phone, "05334445566");
    assert.equal(phone.label, "İş");
    assert.equal(phone.updatedByName, "Ofis yöneticisi");
    assert.equal((await admin.del(`/api/workspace/phones/${id}`)).status, 200);
    const bin = await trashOf(id);
    assert.equal(bin.kind, "phone");
    assert.equal(bin.title, "İş: 05334445566");
    assert.equal((await admin.post("/api/admin/trash/restore", { id: bin.id })).status, 200);
    phone = (await activity()).find(item => item.type === "phone" && item.id === id);
    assert.equal(phone.phone, "05334445566");
    assert.deepEqual(auditTypes(id), ["case.phone.created", "case.phone.updated", "case.phone.deleted", "case.phone.restored"]);
  });

  it("haciz: düzeltmede düşüm tarihi yeniden hesaplanır; Haciz Uyarıları (7 gün) düzeltilen ve silinen hacze uyar", async () => {
    // Konulduğu tarih: bir yıl önce + 3 gün → düşüm 3 gün sonra → 7 günlük uyarı listesinde.
    const placedSoon = new Date(new Date(NOW).getTime() + 3 * 86_400_000);
    placedSoon.setFullYear(placedSoon.getFullYear() - 1);
    const created = await admin.post(`/api/workspace/cases/${encodeURIComponent(CASE)}/liens`, { title: "Araç haczi", placedAt: placedSoon.toISOString() });
    assert.equal(created.status, 200);
    const id = created.data.data.id;
    const upcoming = async () => (await admin.get("/api/workspace/liens?days=7")).data.data.upcoming.map(item => item.id);
    assert.ok((await upcoming()).includes(id), "3 gün sonra düşecek haciz uyarıda");

    assert.equal((await admin.put(`/api/workspace/liens/${id}`, { title: "Araç haczi", placedAt: "bozuk" })).status, 400);
    // Konulduğu tarih bugüne çekilir → düşüm bir yıl sonra → uyarıdan çıkar.
    const edited = await admin.put(`/api/workspace/liens/${id}`, { title: "Taşınmaz haczi", placedAt: NOW });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal(edited.data.data.expiresAt.slice(0, 10), dayAfter(365).slice(0, 10), "düşüm = konulduğu tarih + 1 yıl");
    let lien = (await activity()).find(item => item.type === "lien" && item.id === id);
    assert.equal(lien.title, "Taşınmaz haczi");
    assert.equal(lien.expiresAt, edited.data.data.expiresAt);
    assert.equal(lien.updatedByName, "Ofis yöneticisi");
    assert.ok(!(await upcoming()).includes(id), "düzeltilen haciz artık 7 gün uyarısında değil");

    // Geri eski tarihe → yeniden uyarıda; silinince uyarıdan düşer; geri yüklenince döner.
    assert.equal((await admin.put(`/api/workspace/liens/${id}`, { title: "Taşınmaz haczi", placedAt: placedSoon.toISOString() })).status, 200);
    assert.ok((await upcoming()).includes(id));
    assert.equal((await admin.del(`/api/workspace/liens/${id}`)).status, 200);
    assert.ok(!(await upcoming()).includes(id), "silinen haciz uyarıda değil");
    const bin = await trashOf(id);
    assert.equal(bin.kind, "lien");
    assert.equal(bin.kindLabel, "Haciz");
    assert.equal((await admin.post("/api/admin/trash/restore", { id: bin.id })).status, 200);
    lien = (await activity()).find(item => item.type === "lien" && item.id === id);
    assert.equal(lien.status, "active");
    assert.ok((await upcoming()).includes(id), "geri yüklenen haciz yeniden uyarıda");
    assert.deepEqual(auditTypes(id), ["case.lien.created", "case.lien.updated", "case.lien.updated", "case.lien.deleted", "case.lien.restored"]);
  });

  it("yetki: kayıt düzeltme yetkisi kaldırılan kullanıcı not ekler ama düzeltemez / silemez (403); oturumsuz 401", async () => {
    const created = await restricted.post(`/api/workspace/cases/${encodeURIComponent(CASE)}/notes`, { note: "Kısıtlının notu" });
    assert.equal(created.status, 200, "not ekleme yetkisi duruyor");
    const id = created.data.data.id;
    const edit = await restricted.put(`/api/workspace/notes/${id}`, { note: "değişti" });
    assert.equal(edit.status, 403, JSON.stringify(edit.data));
    assert.equal((await restricted.del(`/api/workspace/notes/${id}`)).status, 403);
    assert.equal((await restricted.put(`/api/workspace/liens/x`, { title: "x", placedAt: NOW })).status, 403);
    assert.equal((await restricted.del(`/api/workspace/phones/x`)).status, 403);
    assert.equal((await server.client().put(`/api/workspace/notes/${id}`, { note: "x" })).status, 401);
    assert.equal((await activity()).find(item => item.id === id).text, "Kısıtlının notu", "not değişmedi, silinmedi");
    // Yetkili personel (records.edit duruyor) başkasının notunu düzeltebilir: kayıt ofisindir.
    assert.equal((await staff.put(`/api/workspace/notes/${id}`, { note: "Kısıtlının notu — personel düzeltti" })).status, 200);
  });
});
