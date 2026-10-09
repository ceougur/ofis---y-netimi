// v2.0.10: yetki havuzu, özel roller, kişiye özel ekle/çıkar, kullanıcı adı ve ad düzeltme, kullanıcı silme/geri alma,
// ANLIK DURUM kartının yalnız yöneticide olması ve eski (v2.0.7) ek yetki kayıtlarının göçü.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { ADMIN_ONLY, NOT_YET_PERMISSIONS, PERMISSIONS, PERMISSION_ORDER, parseGrants, resolvePermissions } from "../server/lib/permissions.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const SOURCE = "https://docs.google.com/spreadsheets/d/YETKI210/edit";
const byName = (list, username) => list.find(user => user.username === username);

describe("yetki modeli (birim)", () => {
  it("havuz her yetkiyi bir kez, açıklamasıyla listeler", () => {
    assert.deepEqual([...PERMISSION_ORDER].sort(), Object.keys(PERMISSIONS).sort());
    assert.equal(new Set(PERMISSION_ORDER).size, PERMISSION_ORDER.length);
  });
  it("v2.0.7 dizi biçimi eklenen sayılır; yönetime özgü ve bilinmeyen yetkiler atılır", () => {
    assert.deepEqual(parseGrants('["overview.view"]'), { add: ["overview.view"], remove: [] });
    assert.deepEqual(parseGrants({ add: ["users.manage", "cash.view", "yok.boyle"], remove: ["records.delete", "cash.view"] }), { add: ["cash.view"], remove: ["records.delete"] });
    assert.deepEqual(parseGrants("bozuk{"), { add: [], remove: [] });
  });
  it("yönetici her zaman tüm yetkilere sahip; kişiye özel ayar yöneticiye uygulanmaz", () => {
    const all = resolvePermissions({ role: "admin", grants_json: JSON.stringify({ remove: ["cash.view"] }) });
    assert.equal(all.length, Object.keys(PERMISSIONS).length);
  });
  it("personel: rol + eklenen − kaldırılan; yönetime özgü yetki eklenemez", () => {
    const list = resolvePermissions({ role: "personel", grants_json: JSON.stringify({ add: ["cash.view", "users.manage", "overview.card"], remove: ["records.create"] }) });
    assert.ok(list.includes("cash.view") && !list.includes("records.create"));
    for (const permission of ADMIN_ONLY) assert.ok(!list.includes(permission), permission);
  });
});

describe("yetki havuzu ve kullanıcı yönetimi (API)", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("roller: 4 yerleşik rol ve gruplu havuz; yönetim yetkileri kilitli", async () => {
    const result = (await admin.get("/api/admin/roles")).data.data;
    assert.deepEqual(result.builtIn.map(role => role.key), ["admin", "avukat", "personel", "muhasebe"]);
    assert.ok(result.builtIn.every(role => role.builtIn && Array.isArray(role.permissions)));
    const items = result.groups.flatMap(group => group.items);
    // GG2: bu sürümde olmayan özelliklerin yetkileri (POS, Komisyon, Ekstre, Mutabakat) Roller ekranında görünmez.
    assert.equal(items.length, Object.keys(PERMISSIONS).length - NOT_YET_PERMISSIONS.size);
    assert.ok(items.every(item => !NOT_YET_PERMISSIONS.has(item.key)));
    assert.ok(items.filter(item => item.locked).map(item => item.key).sort().join() === [...ADMIN_ONLY].sort().join());
    assert.ok(items.every(item => item.label && item.help), "her yetkinin Türkçe adı ve açıklaması var");
  });

  it("özel rol: oluşturulur, yönetim yetkisi verilemez, ad çakışmaz; kullanıcıya atanınca yetkileri uygulanır", async () => {
    assert.equal((await admin.post("/api/admin/roles", { name: "Veznedar", permissions: ["cash.view", "users.manage"] })).status, 400, "yönetime özgü yetki reddedilir");
    assert.equal((await admin.post("/api/admin/roles", { name: "Personel", permissions: [] })).status, 409, "yerleşik rol adı alınamaz");
    const created = await admin.post("/api/admin/roles", { name: "Veznedar", description: "Kasa ve tahsilat", permissions: ["cash.view", "cash.manage", "payments.create", "accounts.view", "accounts.collect", "records.create"] });
    assert.equal(created.status, 200);
    const roleId = created.data.data.id;
    assert.equal((await admin.post("/api/admin/roles", { name: "veznedar", permissions: [] })).status, 409, "aynı ad (büyük/küçük harf farkı) tekrar açılmaz");
    const vezne = await createUser(server, admin, { username: "vezne1", name: "Vezne Bir", role: roleId });
    const me = (await vezne.get("/api/auth/me")).data.data;
    assert.equal(me.roleKey, roleId);
    assert.equal(me.roleLabel, "Veznedar");
    assert.equal(me.role, "personel", "users.role sütunu yerleşik tabanda kalır");
    assert.ok(me.permissions.includes("cash.manage") && !me.permissions.includes("stock.view") && !me.permissions.includes("records.edit"));
    assert.equal((await vezne.get("/api/workspace/cash")).status, 200, "rolden gelen Kasa yetkisi uygulanır");
    assert.equal((await vezne.get("/api/workspace/stock")).status, 403, "rolde olmayan Stok açılmaz");
    // Rol güncellenince kişinin bir sonraki isteği yeni yetkilerle çalışır.
    assert.equal((await admin.patch(`/api/admin/roles/${roleId}`, { permissions: ["cash.view", "stock.view"] })).status, 200);
    assert.equal((await vezne.get("/api/workspace/stock")).status, 200);
    assert.equal((await vezne.post("/api/workspace/cash", { kind: "in", amount: "10", description: "x", date: "2026-09-01" })).status, 403, "kaldırılan Kasa yönetimi");
    // Kullanımdaki rol silinemez; kişi başka role geçince silinir.
    const del = await admin.del(`/api/admin/roles/${roleId}`);
    assert.equal(del.status, 409);
    assert.equal(del.data.code, "ROLE_IN_USE");
    const users = (await admin.get("/api/admin/users")).data.data;
    assert.equal(byName(users, "vezne1").roleLabel, "Veznedar");
    assert.equal((await admin.patch(`/api/admin/users/${byName(users, "vezne1").id}`, { role: "muhasebe" })).status, 200);
    assert.equal((await admin.del(`/api/admin/roles/${roleId}`)).status, 200);
    assert.equal((await admin.del("/api/admin/roles/personel")).status, 400, "yerleşik rol silinemez");
    assert.equal((await admin.patch("/api/admin/roles/avukat", { permissions: [] })).status, 400, "yerleşik rol değiştirilemez");
  });

  it("kişiye özel: rolden yetki kaldırılır ve yetki eklenir; sunucu her uçta uygular", async () => {
    const staff = await createUser(server, admin, { username: "personel2", name: "Personel İki" });
    const target = byName((await admin.get("/api/admin/users")).data.data, "personel2");
    assert.equal((await staff.post("/api/workspace/records", { sourceName: SOURCE, values: { "DOSYA NO": "Y-1" } })).status, 200);
    assert.equal((await staff.get("/api/workspace/cash")).status, 403);
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: { add: ["cash.view"], remove: ["records.create", "records.export"] } })).status, 200);
    const view = byName((await admin.get("/api/admin/users")).data.data, "personel2");
    assert.deepEqual(view.grants, { add: ["cash.view"], remove: ["records.create", "records.export"] });
    assert.ok(view.permissions.includes("cash.view") && !view.permissions.includes("records.create"));
    assert.equal((await staff.post("/api/workspace/records", { sourceName: SOURCE, values: { "DOSYA NO": "Y-2" } })).status, 403, "kaldırılan yetki");
    assert.equal((await staff.get("/api/workspace/cash")).status, 200, "eklenen yetki");
    assert.equal((await staff.raw("GET", "/api/workspace/export.xlsx")).status, 403, "dışa aktarma kaldırıldı");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: { add: ["license.manage"] } })).status, 400);
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: [] } })).status, 200, "rol varsayılanına dönüş");
    assert.equal((await staff.post("/api/workspace/records", { sourceName: SOURCE, values: { "DOSYA NO": "Y-3" } })).status, 200);
  });

  it("ANLIK DURUM kartı yalnız yönetici; yeni kullanıcı formunda kişiye özel yetkiyle oluşturulur", async () => {
    const created = await admin.post("/api/admin/users", { username: "uzman2", name: "Uzman İki", role: "avukat", password: "Uzman-2026!xx", mustChangePassword: false, grants: { add: ["overview.view"], remove: ["records.delete"] } });
    assert.equal(created.status, 200);
    const expert = server.client();
    await expert.login("uzman2", "Uzman-2026!xx");
    const me = (await expert.get("/api/auth/me")).data.data;
    assert.ok(me.permissions.includes("overview.view") && !me.permissions.includes("records.delete") && !me.permissions.includes("overview.card"));
    assert.equal((await expert.get("/api/workspace/overview")).status, 403);
    assert.equal((await expert.get("/api/workspace/overview/mizan?preset=thisMonth")).status, 200);
    assert.equal((await admin.get("/api/workspace/overview")).status, 200);
  });

  it("✎ düzeltme: görünen ad ve kullanıcı adı değişir; yeni adla girilir, eski adla girilmez, oturum açık kalır", async () => {
    const typo = await createUser(server, admin, { username: "mehmt", name: "Mehmt Yılmz", password: "Mehmet-2026!x" });
    const target = byName((await admin.get("/api/admin/users")).data.data, "mehmt");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { username: "a b" })).status, 400, "geçersiz kullanıcı adı");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { username: "ADMIN" })).status, 409, "başkasının kullanıcı adı (büyük/küçük harf)");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { name: "Personel İki" })).status, 409, "başkasının adı");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { name: "" })).status, 400);
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { name: "Mehmet Yılmaz", username: "mehmet" })).status, 200);
    assert.equal((await typo.get("/api/auth/me")).data.data.name, "Mehmet Yılmaz", "oturum açık, ad yeni");
    const fresh = server.client();
    assert.equal((await fresh.login("mehmt", "Mehmet-2026!x")).status, 401);
    assert.equal((await fresh.login("mehmet", "Mehmet-2026!x")).status, 200);
    const audit = (await admin.get("/api/admin/audit?type=user.")).data.data;
    const list = Array.isArray(audit) ? audit : audit.items || audit.events || [];
    assert.ok(list.some(event => event.type === "user.renamed"), "işlem geçmişine yazılır");
  });

  it("silme: kendini ve son yöneticiyi silemez; açık görevde devir sorulur; geçmiş korunur; ad ve kullanıcı adı yeniden kullanılır; geri alınır", async () => {
    const me = (await admin.get("/api/auth/me")).data.data;
    assert.equal((await admin.del(`/api/admin/users/${me.id}`)).status, 400, "kendini silemez");
    const leaver = await createUser(server, admin, { username: "ayrilan", name: "Ayrılan Kişi", password: "Ayrilan-2026!x" });
    const heir = byName((await admin.get("/api/admin/users")).data.data, "mehmet");
    await admin.post("/api/workspace/tasks", { title: "Devredilecek iş", assigneeId: byName((await admin.get("/api/admin/users")).data.data, "ayrilan").id });
    await leaver.post("/api/workspace/cases/Y-1/notes", { note: "Ayrılan kişinin notu" });
    const target = byName((await admin.get("/api/admin/users")).data.data, "ayrilan");
    assert.equal(target.openTasks, 1);
    const ask = await admin.del(`/api/admin/users/${target.id}`);
    assert.equal(ask.status, 409);
    assert.equal(ask.data.code, "OPEN_TASKS");
    assert.equal((await admin.del(`/api/admin/users/${target.id}?reassignTo=${target.id}`)).status, 400, "kendisine devredilemez");
    const done = await admin.del(`/api/admin/users/${target.id}?reassignTo=${heir.id}`);
    assert.equal(done.status, 200);
    assert.equal(done.data.data.reassigned, 1);
    assert.equal((await leaver.get("/api/auth/me")).status, 401, "oturumu kapanır");
    assert.equal((await server.client().login("ayrilan", "Ayrilan-2026!x")).status, 401, "giriş yapamaz");
    assert.ok(!byName((await admin.get("/api/admin/users")).data.data, "ayrilan"), "listeden çıkar");
    assert.ok(!(await admin.get("/api/workspace/users")).data.data.some(user => user.id === target.id), "görev atama listesinden çıkar");
    const tasks = (await admin.get("/api/workspace/tasks?status=open")).data.data;
    assert.equal(tasks.find(task => task.title === "Devredilecek iş").assigneeId, heir.id, "görev devredildi");
    const activity = (await admin.get("/api/workspace/cases/Y-1/activity")).data.data.items;
    assert.ok(activity.some(item => /Ayrılan Kişi/.test(item.actorName || "")), "geçmişte adı kalır");
    const deleted = (await admin.get("/api/admin/users/deleted")).data.data;
    assert.equal(deleted[0].username, "ayrilan");
    assert.equal(deleted[0].name, "Ayrılan Kişi");
    // Aynı kullanıcı adı ve ad yeni hesapta kullanılabilir; bu durumda geri alma yeni ad ister.
    await createUser(server, admin, { username: "ayrilan", name: "Ayrılan Kişi", password: "Yeni-2026!xx" });
    const taken = await admin.post(`/api/admin/users/${target.id}/restore`, {});
    assert.equal(taken.status, 409);
    assert.equal(taken.data.code, "USERNAME_TAKEN");
    assert.equal((await admin.post(`/api/admin/users/${target.id}/restore`, { username: "ayrilan2" })).status, 409, "ad da dolu");
    assert.equal((await admin.post(`/api/admin/users/${target.id}/restore`, { username: "ayrilan2", name: "Ayrılan Kişi (eski)" })).status, 200);
    assert.equal((await server.client().login("ayrilan2", "Ayrilan-2026!x")).status, 200, "eski parolasıyla girer");
    // Son yönetici silinemez; ikinci yönetici varken silinebilir.
    const second = await admin.post("/api/admin/users", { username: "yonetici2", name: "Yönetici İki", role: "admin", password: "Yonetici-2026!x", mustChangePassword: false });
    const other = server.client();
    await other.login("yonetici2", "Yonetici-2026!x");
    assert.equal((await other.del(`/api/admin/users/${me.id}`)).status, 200, "ikinci yönetici ilkini silebilir");
    assert.equal((await other.del(`/api/admin/users/${second.data.data.id}`)).status, 400, "kendini silemez");
    assert.equal((await other.post(`/api/admin/users/${me.id}/restore`, {})).status, 200);
    assert.equal((await admin.get("/api/auth/me")).status, 401, "silinen yöneticinin oturumu kapanmıştı");
    admin = await loginAdmin(server);
    assert.equal((await admin.get("/api/admin/users")).status, 200, "geri alınan yönetici eski parolasıyla girer");
  });

  it("yetkisiz kullanıcı yönetim uçlarına erişemez", async () => {
    const staff = await createUser(server, admin, { username: "personel3", name: "Personel Üç" });
    for (const [method, url] of [["get", "/api/admin/roles"], ["post", "/api/admin/roles"], ["get", "/api/admin/users/deleted"], ["del", "/api/admin/users/x"], ["post", "/api/admin/users/x/restore"]]) {
      assert.equal((await staff[method](url, method === "get" || method === "del" ? undefined : {})).status, 403, `${method} ${url}`);
    }
  });

  it("Yönetim paneli yalnız yöneticide; işlem geçmişi yetkisi olan uzman denetim kaydını Raporlar'dan görür, finans raporlarını görmez", async () => {
    const expert = await createUser(server, admin, { username: "uzman1", name: "Uzman Bir", role: "avukat" });
    assert.equal((await expert.get("/api/admin/users")).status, 403, "uzman kullanıcı listesine erişemez");
    const list = await expert.get("/api/workspace/report-center");
    assert.equal(list.status, 200);
    assert.deepEqual(list.data.data.reports.map(report => report.id), ["islem-gecmisi"], "yalnız İşlem geçmişi");
    const log = await expert.get("/api/workspace/report-center/islem-gecmisi?preset=all");
    assert.equal(log.status, 200);
    assert.ok(log.data.data.total > 0, "denetim kaydı satırları gelir");
    assert.equal((await expert.get("/api/workspace/report-center/islem-gecmisi/xlsx")).status, 200);
    assert.equal((await expert.get("/api/workspace/report-center/mizan")).status, 403, "finans raporu kapalı");
    // İşlem geçmişi yetkisi kaldırılınca rapor merkezi tümden kapanır; personel hiç göremez.
    const users = (await admin.get("/api/admin/users")).data.data;
    await admin.patch(`/api/admin/users/${users.find(user => user.username === "uzman1").id}`, { grants: { remove: ["audit.view"] } });
    assert.equal((await expert.get("/api/workspace/report-center")).status, 403);
    const staff = await createUser(server, admin, { username: "personel4", name: "Personel Dört" });
    assert.equal((await staff.get("/api/workspace/report-center")).status, 403);
    assert.equal((await staff.get("/api/workspace/report-center/islem-gecmisi")).status, 403);
  });
});

describe("v2.0.7 ek yetki kayıtları göçü", () => {
  let server;
  after(() => server?.close());
  it("['overview.view'] → { add: ['overview.view'] }: raporlar açık kalır, kart kapanır", async () => {
    server = await startTestServer({
      prepare: ({ dataDir }) => {
        mkdirSync(dataDir, { recursive: true });
        const store = createStore(openDatabase(path.join(dataDir, "hukuk-ofisi.sqlite")));
        for (const migration of MIGRATIONS.filter(item => item.version <= 14)) {
          store.tx(() => {
            migration.up(store);
            store.exec(`PRAGMA user_version = ${migration.version}`);
          });
        }
        const at = new Date().toISOString();
        // Parola: "Eski-Personel-2026!" (scrypt özeti helpers ile aynı biçimde üretilir).
        store.run("INSERT INTO users (id, username, display_name, role, password_hash, active, created_at, updated_at, grants_json) VALUES ('user-eski', 'eskipersonel', 'Eski Personel', 'personel', 'x', 1, ?, ?, '[\"overview.view\"]')", at, at);
        store.db.close();
      },
    });
    assert.deepEqual(server.app.migration.applied, [15, 16, 17, 18, 19, 20]);
    const admin = await loginAdmin(server);
    const user = byName((await admin.get("/api/admin/users")).data.data, "eskipersonel");
    assert.deepEqual(user.grants, { add: ["overview.view"], remove: [] });
    assert.ok(user.permissions.includes("overview.view") && !user.permissions.includes("overview.card"));
    const raw = server.app.store.get("SELECT grants_json FROM users WHERE id = 'user-eski'").grants_json;
    // 2.1.0 gözden geçirme D5: göç kişiye "banka yetkileri verildi" işaretini (bank.granted) de yazar; katalogda olmadığı için hiçbir yetki
    // vermez ve yukarıdaki API yanıtında görünmez. Ham kayıtta işaret dışında değişiklik yok.
    assert.deepEqual(JSON.parse(raw), { add: ["overview.view", "bank.granted"], remove: [] });
  });
});
