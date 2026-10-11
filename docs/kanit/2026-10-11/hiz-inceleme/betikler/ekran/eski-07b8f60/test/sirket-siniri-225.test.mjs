// Şirket sınırı (kullanıcı kararı, 05.10.2026): en fazla 2 şirket açılır; Standart ve Pro aynı. Sınırdan önce açılmış
// şirketler (3 ve üstü) kalır; yalnız yenisi açılmaz. Silinen şirket sayılmaz.
// Çalışıyor mu: 001 + 002 açılır, sınır durumu listede; silince yenisi açılır; 3 şirketli eski kurulumda hepsi çalışır.
// Nasıl bozarım: 3. şirketi doğrudan API'den, başka kodla, aynı anda iki istekle açmaya çalış; personel olarak dene.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  del: async (url, body) => unwrap(await client.raw("DELETE", url, { body: JSON.stringify(body), headers: { "content-type": "application/json" } })),
});
const registryCount = dataDir => JSON.parse(readFileSync(path.join(dataDir, "sirketler.json"), "utf8")).companies.length;
const message = response => String(response.data?.error || response.data?.message || JSON.stringify(response.data));

describe("Şirket sınırı: en fazla 2", () => {
  const servers = [];
  after(async () => {
    for (const server of servers) await server.close();
  });

  test("çalışıyor mu: 001 tek başına → 002 açılır; sınırda liste nedeni söyler; silince yenisi açılır", async () => {
    const server = await startTestServer();
    servers.push(server);
    const api = apiOf(await loginAdmin(server));
    let list = (await api.get("/api/companies")).data;
    assert.deepEqual(list.limit, { max: 2, count: 1, canCreate: true, reason: "" });
    const created = await api.post("/api/companies", { name: "İkinci Şirket" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    list = (await api.get("/api/companies")).data;
    assert.equal(list.limit.canCreate, false);
    assert.equal(list.limit.count, 2);
    assert.match(list.limit.reason, /En fazla 2 şirket kurulabilir/);

    const third = await api.post("/api/companies", { name: "Üçüncü Şirket" });
    assert.equal(third.status, 409);
    assert.match(message(third), /En fazla 2 şirket kurulabilir/);
    assert.equal(registryCount(server.dataDir), 2, "kayıt defterine 3. şirket yazılmadı");
    assert.equal(existsSync(path.join(server.dataDir, "sirketler", "003")), false, "3. şirketin veri klasörü açılmadı");

    // Silinen şirket sayılmaz: 002 silinince yenisi açılır.
    const removed = await api.del(`/api/companies/${created.data.company.id}`, { confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(removed.status, 200, JSON.stringify(removed.data));
    assert.equal((await api.get("/api/companies")).data.limit.canCreate, true);
    const again = await api.post("/api/companies", { name: "Yeni İkinci" });
    assert.equal(again.status, 200, JSON.stringify(again.data));
    assert.equal((await api.get("/api/companies")).data.limit.canCreate, false);
  });

  test("nasıl bozarım: başka kodla, aynı anda iki istekle, personel olarak 3. şirket açılmaz", async () => {
    const server = await startTestServer();
    servers.push(server);
    const admin = await loginAdmin(server);
    const api = apiOf(admin);
    // Aynı anda iki istek (çift tıklama / iki yönetici): yalnız biri açılır.
    const both = await Promise.all([api.post("/api/companies", { code: "002", name: "A" }), api.post("/api/companies", { code: "005", name: "B" })]);
    assert.deepEqual(both.map(item => item.status).sort(), [200, 409]);
    assert.equal(registryCount(server.dataDir), 2);
    // Başka kod, boş ad, kod olmadan: hepsi sınıra takılır.
    for (const body of [{ code: "009", name: "C" }, { name: "D" }, { code: "999", name: "E", select: true }]) {
      const response = await api.post("/api/companies", body);
      assert.equal(response.status, 409, JSON.stringify(body));
    }
    assert.equal(registryCount(server.dataDir), 2);
    // Personel yönetim yetkisi olmadan zaten açamaz (403, sınırdan önce).
    const created = await admin.post("/api/admin/users", { username: "personel9", name: "Personel Dokuz", role: "personel", password: "Personel-2026!", mustChangePassword: false });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const staff = server.client();
    assert.equal((await staff.post("/api/auth/login", { username: "personel9", password: "Personel-2026!" })).status, 200);
    assert.equal((await staff.post("/api/companies", { name: "Personelin Şirketi" })).status, 403);
    assert.equal(registryCount(server.dataDir), 2);
    // Gözden geçirme bulgusu (2.0.25): yalnız 001'e yetkili personel şirket sayısını görmez (gizli şirketin varlığı sızmaz).
    const seen = unwrap(await staff.get("/api/companies")).data;
    assert.deepEqual(seen.companies.map(item => item.code), ["001"]);
    assert.equal(seen.limit, undefined, "personele sınır/sayı dönmez");
    assert.equal(seen.all, undefined);
  });

  test("eski kurulum: sınırdan önce açılmış 3 şirket kalır ve çalışır; yenisi açılmaz", async () => {
    const dataDir = path.join(mkdtempSync(path.join(tmpdir(), "destekofis-sinir-")), "data");
    const old = await startTestServer({ dataDir, maxCompanies: 5 });
    let api = apiOf(await loginAdmin(old));
    assert.equal((await api.post("/api/companies", { name: "İki" })).status, 200);
    const third = (await api.post("/api/companies", { name: "Üç", select: true })).data.company;
    const cari = await api.post("/api/workspace/accounts", { name: "Üçüncüdeki Cari", type: "customer" });
    assert.equal(cari.status, 200);
    await old.close();

    const server = await startTestServer({ dataDir });
    servers.push(server);
    servers.push({ close: async () => rmSync(path.dirname(dataDir), { recursive: true, force: true }) });
    api = apiOf(await loginAdmin(server));
    const list = (await api.get("/api/companies")).data;
    assert.equal(list.companies.length, 3, "3 şirket de duruyor");
    assert.deepEqual([list.limit.count, list.limit.canCreate], [3, false]);
    assert.equal((await api.post("/api/companies/select", { id: third.id })).status, 200);
    assert.deepEqual((await api.get("/api/workspace/accounts")).data.accounts.map(item => item.name), ["Üçüncüdeki Cari"]);
    assert.equal((await api.post("/api/workspace/cash", { kind: "in", amount: 100, date: new Date().toISOString().slice(0, 10), description: "Çalışıyor" })).status, 200);
    const four = await api.post("/api/companies", { name: "Dört" });
    assert.equal(four.status, 409);
    // 3+ şirkette mesaj doğru yolu söyler (gözden geçirme bulgusu): "bir şirketi silin" yetmez.
    assert.match(message(four), /Şu an 3 şirket var/);
    assert.match(list.limit.reason, /Şu an 3 şirket var/);
    // Birini silmek yetmez (2 kalır, sınır dolu); ikisi silinince yenisi açılır.
    assert.equal((await api.del(`/api/companies/${third.id}`, { confirm: "003", password: ADMIN_PASSWORD })).status, 200);
    const two = await api.post("/api/companies", { name: "Dört" });
    assert.equal(two.status, 409);
    assert.match(message(two), /önce bir şirketi silin/);
    assert.equal(registryCount(dataDir), 2);
    const second = (await api.get("/api/companies")).data.companies.find(item => item.code === "002");
    assert.equal((await api.del(`/api/companies/${second.id}`, { confirm: "002", password: ADMIN_PASSWORD })).status, 200);
    const reopened = await api.post("/api/companies", { name: "Dört" });
    assert.equal(reopened.status, 200, JSON.stringify(reopened.data));
    assert.equal(registryCount(dataDir), 2);
  });
});
