// 2.0.21 madde 1: veri dosyası paylaşan şirketler (2.0.17–2.0.19'da "kod değiştir + eski kodla yeni şirket aç" sırasını
// yaşamış kurulum ya da bozuk kayıt) açılışta bulunur, yöneticiye bildirilir ve "Ayır" ile kendi klasörüne alınır.
// Hiçbir kayıt silinmez; önce yedek alınır.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
});
const names = async api => (await api.get("/api/workspace/accounts")).data.accounts.map(item => item.name).sort();
const registryOf = server => JSON.parse(readFileSync(path.join(server.dataDir, "sirketler.json"), "utf8")).companies;

// 2.0.19'un bıraktığı kayıt: 002 açılmış, kodu 005 yapılmış (veri klasörü sirketler/002'de kalmış), sonra 002 koduyla
// yeni şirket açılmış ve ona da sirketler/002 verilmiş. (prepare: sunucu açılmadan önce veri klasörüne yazılır.)
const sharedLayout = ({ dataDir }) => {
  mkdirSync(path.join(dataDir, "sirketler", "002"), { recursive: true });
  writeFileSync(
    path.join(dataDir, "sirketler.json"),
    JSON.stringify({
      companies: [
        { id: "sirket-001", code: "001", name: "Ana Şirket", dir: "", createdAt: "2026-09-01T08:00:00.000Z", createdBy: "" },
        { id: "sirket-eski", code: "005", name: "Eski Şirket", dir: "sirketler/002", createdAt: "2026-10-01T08:00:00.000Z", createdBy: "" },
        { id: "sirket-yeni", code: "002", name: "Yeni Şirket", dir: "sirketler/002", createdAt: "2026-10-02T08:00:00.000Z", createdBy: "" },
      ],
    }),
  );
};

describe("2.0.21 · aynı veri dosyasını paylaşan iki şirket: bulunur, bildirilir, ayrılır", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ prepare: sharedLayout });
    api = apiOf(await loginAdmin(server));
  });
  after(() => server.close());

  test("çakışma bulunur: dosyayı koruyan en eski şirket, ayrılacak yeni şirket", async () => {
    const list = (await api.get("/api/companies")).data;
    assert.equal(list.conflicts.length, 1, JSON.stringify(list.conflicts));
    const [group] = list.conflicts;
    assert.equal(group.keeper, "sirket-eski");
    assert.deepEqual(group.companies.map(item => [item.code, item.keeper]), [["005", true], ["002", false]]);
  });

  test("hata yeniden üretilir: birine girilen kayıt öbüründe görünür (ayırmadan önce)", async () => {
    await api.post("/api/companies/select", { id: "sirket-eski" });
    assert.equal((await api.post("/api/workspace/accounts", { name: "Ortak Kayıt", type: "customer" })).status, 200);
    await api.post("/api/companies/select", { id: "sirket-yeni" });
    assert.deepEqual(await names(api), ["Ortak Kayıt"]);
  });

  test("onaysız, yanlış parolalı, dosyayı koruyan şirkette ya da çakışmasız şirkette Ayır yapılmaz", async () => {
    assert.equal((await api.post("/api/companies/sirket-yeni/separate", { confirm: "999", password: ADMIN_PASSWORD })).status, 400);
    assert.equal((await api.post("/api/companies/sirket-yeni/separate", { confirm: "002", password: "yanlis" })).status, 403);
    const keeper = await api.post("/api/companies/sirket-eski/separate", { confirm: "005", password: ADMIN_PASSWORD });
    assert.equal(keeper.status, 409);
    assert.match(keeper.data.error, /koruyan/);
    const root = await api.post("/api/companies/sirket-001/separate", { confirm: "001", password: ADMIN_PASSWORD });
    assert.equal(root.status, 409);
    assert.match(root.data.error, /paylaşmıyor/);
    assert.equal(registryOf(server).find(item => item.id === "sirket-yeni").dir, "sirketler/002", "başarısız denemeler kaydı değiştirmez");
  });

  test("Ayır: önce yedek, yeni boş klasöre kopya; ayırma anındaki kayıtlar ikisinde de durur, sonrası ayrı", async () => {
    const result = await api.post("/api/companies/sirket-yeni/separate", { confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.match(result.data.backup, /^destekofis-002-.*-ayirma-oncesi-002\.sqlite$/);
    assert.deepEqual(result.data.conflicts, []);
    const registry = registryOf(server);
    const moved = registry.find(item => item.id === "sirket-yeni");
    assert.notEqual(moved.dir.toUpperCase(), "SIRKETLER/002");
    assert.ok(existsSync(path.join(server.dataDir, moved.dir, "destekofis.sqlite")), "yeni klasörde veri tabanı var");
    assert.equal(registry.find(item => item.id === "sirket-eski").dir, "sirketler/002", "dosyayı koruyan şirket yerinde");
    // Yedek ayrılan şirketin klasöründe ve içinde onun kimliği.
    const folder = readdirSync(server.backupDir).find(name => name.startsWith("002 - "));
    assert.ok(folder && readdirSync(path.join(server.backupDir, folder)).includes(result.data.backup));
    const copy = new DatabaseSync(path.join(server.backupDir, folder, result.data.backup), { readOnly: true });
    try {
      assert.equal(JSON.parse(copy.prepare("SELECT value FROM backup_meta WHERE key = 'company'").get()?.value || "{}").id, "sirket-yeni");
    } finally {
      copy.close();
    }
    // Ayırma anındaki kayıt ikisinde de; bundan sonrası ayrı.
    await api.post("/api/companies/select", { id: "sirket-yeni" });
    assert.deepEqual(await names(api), ["Ortak Kayıt"]);
    await api.post("/api/workspace/accounts", { name: "Yalnız Yeni", type: "customer" });
    await api.post("/api/companies/select", { id: "sirket-eski" });
    assert.deepEqual(await names(api), ["Ortak Kayıt"]);
    await api.post("/api/workspace/accounts", { name: "Yalnız Eski", type: "customer" });
    await api.post("/api/companies/select", { id: "sirket-yeni" });
    assert.deepEqual(await names(api), ["Ortak Kayıt", "Yalnız Yeni"]);
    // 001 hiç etkilenmedi.
    await api.post("/api/companies/select", { id: "sirket-001" });
    assert.deepEqual(await names(api), []);
    // İki kopyanın veri tabanı kimliği artık farklı.
    const ids = ["sirketler/002", moved.dir].map(dir => {
      const db = new DatabaseSync(path.join(server.dataDir, dir, "destekofis.sqlite"), { readOnly: true });
      try {
        return db.prepare("SELECT value FROM settings WHERE key = 'meta.instanceId'").get()?.value;
      } finally {
        db.close();
      }
    });
    assert.ok(ids[0] && ids[1] && ids[0] !== ids[1], JSON.stringify(ids));
  });

  test("ikinci kez Ayır yapılmaz; işlem geçmişine yazılır", async () => {
    const again = await api.post("/api/companies/sirket-yeni/separate", { confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(again.status, 409);
    const audit = (await api.get("/api/admin/audit?type=company.separated")).data;
    assert.equal(audit[0]?.payload?.code, "002");
  });
});

describe("2.0.21 · 001'in veri klasörünü gösteren şirket (bozuk kayıt) açılmaz; Ayır ile kendi klasörüne alınır", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({
      prepare: ({ dataDir }) => {
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(
          path.join(dataDir, "sirketler.json"),
          JSON.stringify({
            companies: [
              { id: "sirket-001", code: "001", name: "Ana Şirket", dir: "", createdAt: "2026-09-01T08:00:00.000Z", createdBy: "" },
              { id: "sirket-bozuk", code: "003", name: "Bozuk Kayıt", dir: "", createdAt: "2026-10-01T08:00:00.000Z", createdBy: "" },
            ],
          }),
        );
      },
    });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/accounts", { name: "001 Carisi", type: "customer" });
  });
  after(() => server.close());

  test("çakışma bildirilir; şirket seçilince 001'in verisi gösterilmez, açık hata verilir", async () => {
    const list = (await api.get("/api/companies")).data;
    assert.equal(list.conflicts[0]?.keeper, "sirket-001");
    await api.post("/api/companies/select", { id: "sirket-bozuk" });
    const blocked = await api.get("/api/workspace/accounts");
    assert.equal(blocked.status, 503);
    assert.match(blocked.data.error, /ilk şirketin \(001\) veri dosyasını/);
  });

  test("Ayır sonrası şirket açılır (001'in o günkü kopyasıyla); 001 ve kullanıcılar etkilenmez", async () => {
    const result = await api.post("/api/companies/sirket-bozuk/separate", { confirm: "003", password: ADMIN_PASSWORD });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const moved = registryOf(server).find(item => item.id === "sirket-bozuk");
    assert.ok(moved.dir && moved.dir.startsWith("sirketler"), moved.dir);
    // Kopyaya yalnız şirket dosyaları gider; 001'in kök klasöründeki ortak dosyalar (şirket listesi) gitmez.
    assert.ok(!existsSync(path.join(server.dataDir, moved.dir, "sirketler.json")));
    assert.deepEqual(await names(api), ["001 Carisi"]);
    await api.post("/api/workspace/accounts", { name: "003 Carisi", type: "customer" });
    await api.post("/api/companies/select", { id: "sirket-001" });
    assert.deepEqual(await names(api), ["001 Carisi"]);
    // Ortak kullanıcı tablosu sağlam: yönetici yeniden giriş yapar.
    assert.equal((await server.client().login("admin", ADMIN_PASSWORD)).status, 200);
  });
});
