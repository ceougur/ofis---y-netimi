// 2.4.4 iş listesi 29: 002 şirket ekranına yetki, kullanıcı, şirket listesi ve lisans değişiklikleri CANLI ulaşır.
// Kök neden (163dd5d): her şirket örneğinin kendi olay kanalı var; yönetim uçları (HUB_ONLY: kullanıcılar, roller, şirketler, lisans) ortak
// katmanın (001) kanalına yayınlar; 002'yi gösteren pencere /api/events?hofCompany=002 ile 002'nin kanalına bağlıdır → olay hiç gelmiyordu
// (ekran yenilenene kadar eski düğmeler/şerit; sunucu yetkiyi yine denetler). Düzeltme: ortak olaylar şirket kanallarına iletilir; şirkete özgü
// veri olayları (cari, kasa…) İLETİLMEZ — 001'in cari olayı 002 kanalına sızmaz (aşağıda ayrıca sınanır).
// Eski kodda kırmızı: 002 akışı yetki/lisans/kullanıcı/şirket olayını almıyor.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createReferenceLicenseService, keyIdForLicense } from "../tools/lib/license-service.mjs";
import { generateKeyPairSync } from "node:crypto";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const data = response => response.data?.data ?? response.data;

// Ham SSE okuyucu (test/events.test.mjs ile aynı düzen), yol parametreli.
function stream(base, client, pathname) {
  const controller = new AbortController();
  const frames = [];
  const ready = fetch(`${base}${pathname}`, { headers: { cookie: client.cookie }, signal: controller.signal }).then(async result => {
    if (result.status !== 200) return result.status;
    const reader = result.body.getReader();
    const decoder = new TextDecoder();
    (async () => {
      let buffer = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut;
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const type = /^event: (.+)$/m.exec(frame)?.[1];
            if (!type) continue;
            const body = /^data: (.+)$/m.exec(frame)?.[1];
            frames.push({ type, data: body ? JSON.parse(body) : null });
          }
        }
      } catch {
        // kapatıldı
      }
    })();
    return 200;
  });
  const waitFor = async (predicate, label, timeoutMs = 3000) => {
    const started = Date.now();
    for (;;) {
      const found = frames.find(predicate);
      if (found) return found;
      if (Date.now() - started > timeoutMs) throw new Error(`beklenen olay gelmedi: ${label} (gelenler: ${frames.map(item => `${item.type}/${item.data?.kind ?? ""}`).join(", ")})`);
      await sleep(20);
    }
  };
  return { ready, frames, waitFor, close: () => controller.abort() };
}
const isKind = kind => frame => frame.type === "workspace.changed" && frame.data?.kind === kind;

describe("Şirket kanalları: ortak olaylar 002 ekranına ulaşır, şirket verisi sızmaz", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  const TRUSTED = { "test-lisans-1": publicKey.export({ format: "der", type: "spki" }).toString("base64") };
  const reference = createReferenceLicenseService({ privateKeyPem: pem, keyId: keyIdForLicense(pem, TRUSTED) });
  let server;
  let admin;
  let staff;
  let staffId;
  let second;
  const open = [];
  const watch = (client, company) => {
    const item = stream(server.base, client, `/api/events?hofCompany=${company}`);
    open.push(item);
    return item;
  };

  before(async () => {
    server = await startTestServer({
      license: { enforce: true, trustedKeys: TRUSTED, services: ["https://lisans.test/api/lisans"], fetchImpl: (url, init) => reference.fetch(url, init), machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f90", firstCheckDelayMs: 3_600_000 },
    });
    admin = await loginAdmin(server);
    assert.equal((await admin.post("/api/license/trial", { officeName: "Kanal Deneme", email: "kanal@example.com" })).status, 200);
    const created = await admin.post("/api/companies", { name: "Kanal İkinci Şirket" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    second = data(created).company;
    staff = await createUser(server, admin, { username: "kanalpersonel", name: "Kanal Personel", role: "personel" });
    staffId = data(await admin.get("/api/admin/users")).find(user => user.username === "kanalpersonel").id;
    assert.equal((await admin.put(`/api/companies/access/${staffId}`, { companies: ["sirket-001", second.id] })).status, 200);
  });
  after(async () => {
    for (const item of open) item.close();
    await server?.close();
  });

  it("yönetici yetkiyi değiştirince 002 penceresi (personel) 'permissions' olayını alır; /api/auth/me 002'de yeni yetkiyi verir", async () => {
    const live002 = watch(staff, second.id);
    assert.equal(await live002.ready, 200);
    await live002.waitFor(frame => frame.type === "hello", "hello");
    assert.equal((await admin.patch(`/api/admin/users/${staffId}`, { grants: { add: ["cash.view"], remove: [] } })).status, 200);
    const event = await live002.waitFor(isKind("permissions"), "002 permissions");
    assert.deepEqual(event.data.userIds, [staffId]);
    const me = data(await staff.get(`/api/auth/me?hofCompany=${second.id}`));
    assert.ok(me.permissions.includes("cash.view"), "002'de yeni yetki görünür");
  });

  it("yetki olayı yalnız ilgili kullanıcıya gider (002'de de): yöneticinin 002 akışı başkasının yetki olayını almaz", async () => {
    const admin002 = watch(admin, second.id);
    assert.equal(await admin002.ready, 200);
    await admin002.waitFor(frame => frame.type === "hello", "hello");
    const staff002 = watch(staff, second.id);
    assert.equal(await staff002.ready, 200);
    await staff002.waitFor(frame => frame.type === "hello", "hello");
    assert.equal((await admin.patch(`/api/admin/users/${staffId}`, { grants: { add: [], remove: [] } })).status, 200);
    await staff002.waitFor(isKind("permissions"), "personel 002 permissions");
    await sleep(300);
    assert.equal(admin002.frames.filter(isKind("permissions")).length, 0, "hedef dışı kullanıcıya yetki olayı gitmez");
  });

  it("lisans değişikliği (Denetle) 002 penceresine 'license.changed' olarak ulaşır", async () => {
    const live002 = watch(staff, second.id);
    assert.equal(await live002.ready, 200);
    await live002.waitFor(frame => frame.type === "hello", "hello");
    const checked = await admin.post("/api/license/check");
    assert.equal(checked.status, 200, JSON.stringify(checked.data));
    const event = await live002.waitFor(frame => frame.type === "license.changed", "002 license.changed");
    assert.equal(event.data.state, "trial");
  });

  it("kullanıcı adı değişikliği ('users') ve şirket listesi değişikliği ('companies') 002 penceresine ulaşır", async () => {
    const live002 = watch(staff, second.id);
    assert.equal(await live002.ready, 200);
    await live002.waitFor(frame => frame.type === "hello", "hello");
    assert.equal((await admin.patch(`/api/admin/users/${staffId}`, { name: "Kanal Personel İki" })).status, 200);
    await live002.waitFor(isKind("users"), "002 users");
    const renamed = await admin.put(`/api/companies/${second.id}`, { name: "Kanal İkinci Şirket Yeni" });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.data));
    await live002.waitFor(isKind("companies"), "002 companies");
  });

  it("şirkete özgü veri olayı sızmaz: 001'de açılan cari 001 akışına gelir, 002 akışına gelmez (ve tersi)", async () => {
    const live001 = watch(staff, "sirket-001");
    const live002 = watch(staff, second.id);
    assert.deepEqual(await Promise.all([live001.ready, live002.ready]), [200, 200]);
    await Promise.all([live001.waitFor(frame => frame.type === "hello", "hello 001"), live002.waitFor(frame => frame.type === "hello", "hello 002")]);
    assert.equal((await admin.post("/api/workspace/accounts?hofCompany=sirket-001", { name: "Bir Kanal Carisi", type: "customer" })).status, 200);
    await live001.waitFor(isKind("accounts"), "001 accounts");
    assert.equal((await admin.post(`/api/workspace/accounts?hofCompany=${second.id}`, { name: "İki Kanal Carisi", type: "customer" })).status, 200);
    await live002.waitFor(isKind("accounts"), "002 accounts");
    await sleep(400);
    assert.equal(live002.frames.filter(isKind("accounts")).length, 1, "001'in cari olayı 002 kanalına sızmadı");
    assert.equal(live001.frames.filter(isKind("accounts")).length, 1, "002'nin cari olayı 001 kanalına sızmadı");
    assert.equal(live002.frames.filter(frame => frame.type === "overview.changed").length, 1, "002'nin ANLIK DURUM olayı yalnız kendi carisinden");
  });

  it("geri yüklemede 002 örneği kapanıp yeniden açılır: eski köprü kalkar (dinleyici birikmez), yeni örnek ortak olayı yine alır", async () => {
    const taps = () => server.app.events.tapCount();
    const before = taps();
    const backup = await admin.post("/api/admin/backups", { scope: "one", companyId: second.id });
    assert.equal(backup.status, 200, JSON.stringify(backup.data));
    const restored = await admin.post("/api/admin/backups/restore", { name: data(backup).name, company: second.id, confirm: second.code, password: ADMIN_PASSWORD });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    const live002 = watch(staff, second.id);
    assert.equal(await live002.ready, 200);
    await live002.waitFor(frame => frame.type === "hello", "hello");
    assert.equal(taps(), before, "kapanan örneğin köprüsü kaldırıldı; yeni örnek tek köprü kurdu");
    assert.equal((await admin.patch(`/api/admin/users/${staffId}`, { grants: { add: ["stock.view"], remove: [] } })).status, 200);
    await live002.waitFor(isKind("permissions"), "geri yüklemeden sonra 002 permissions");
  });
});

