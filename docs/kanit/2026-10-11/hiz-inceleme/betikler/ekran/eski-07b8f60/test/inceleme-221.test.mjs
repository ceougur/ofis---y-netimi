// 2.0.21 bağımsız gözden geçirme bulguları (çalıştırılarak doğrulananlar) — her biri düzeltmeden önce kırmızıydı.
//  1. Aynı veri dosyasını paylaşan şirkette Geri Yükle / Sil / Sıfırla öbür şirketi de değiştiriyor ya da yok ediyordu.
//  2. 001'in klasörünü gösteren (bozuk kayıtlı) şirketin yedeği 001'in bütün veri tabanıydı; geri yüklemesi 001'i değiştiriyordu.
//  3. Şirket listesi diskten kurulurken "ayirma-oncesi" yedeği yanlış kimlik veriyordu (bir şirket düşüyor, öbürü onun verisini görüyordu).
//  4. Ayır unvanı düzeltmiyordu (iki şirket de öbürünün unvanını taşıyordu).
//  9. 2.0.21 öncesinden gelen şirketin veri dosyası kaybolunca ilk açılışta sessizce boş veri tabanı açılıyordu.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, test } from "node:test";
import { createApp } from "../server/app.mjs";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";

const data = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const roots = [];
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));
function layout(companies) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-inceleme-"));
  roots.push(root);
  const dataDir = path.join(root, "data");
  mkdirSync(path.join(dataDir, "sirketler", "002"), { recursive: true });
  if (companies) writeFileSync(path.join(dataDir, "sirketler.json"), JSON.stringify({ companies }));
  return { root, dataDir, backupDir: path.join(root, "backups") };
}
async function start({ dataDir, backupDir }) {
  const app = createApp({ dataDir, backupDir, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
  const { port } = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${port}`);
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  return { app, client, base: `http://127.0.0.1:${port}` };
}
const SHARED = [
  { id: "sirket-001", code: "001", name: "Ana", dir: "", createdAt: "2026-09-01T08:00:00.000Z", createdBy: "" },
  { id: "sirket-eski", code: "005", name: "Eski", dir: "sirketler/002", createdAt: "2026-10-01T08:00:00.000Z", createdBy: "" },
  { id: "sirket-yeni", code: "002", name: "Yeni", dir: "sirketler/002", createdAt: "2026-10-02T08:00:00.000Z", createdBy: "" },
];
const names = async (client, id) => data(await client.get(`/api/workspace/accounts?hofCompany=${id}`)).accounts.map(item => item.name).sort();

describe("bulgu 1 · paylaşan şirkette Geri Yükle / Sil / Sıfırla Ayır'dan önce yapılmaz", () => {
  test("üç işlem de 409 (company-shared); öbür şirketin verisi yerinde; Ayır'dan sonra yapılır", async () => {
    const dirs = layout(SHARED);
    const { app, client } = await start(dirs);
    try {
      await client.post("/api/workspace/accounts?hofCompany=sirket-eski", { name: "Eskinin Carisi", type: "customer" });
      const backup = data(await client.post("/api/admin/backups", { scope: "one", companyId: "sirket-yeni" }));
      await client.post("/api/workspace/accounts?hofCompany=sirket-eski", { name: "Eskiye Sonra Girilen", type: "customer" });
      const restore = await client.post("/api/admin/backups/restore", { name: backup.name, company: "sirket-yeni", confirm: "002", password: ADMIN_PASSWORD });
      assert.equal(restore.status, 409, JSON.stringify(restore.data));
      assert.equal(restore.data.code, "company-shared");
      const reset = await client.post("/api/companies/sirket-yeni/reset", { mode: "all", confirm: "002", password: ADMIN_PASSWORD });
      assert.equal(reset.status, 409);
      const removed = await client.raw("DELETE", "/api/companies/sirket-yeni", { body: JSON.stringify({ confirm: "002", password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } });
      assert.equal(removed.status, 409);
      assert.deepEqual(await names(client, "sirket-eski"), ["Eskinin Carisi", "Eskiye Sonra Girilen"]);
      // Ayır'dan sonra silme yapılır ve dosyayı koruyan şirket etkilenmez.
      assert.equal((await client.post("/api/companies/sirket-yeni/separate", { confirm: "002", password: ADMIN_PASSWORD })).status, 200);
      const later = await client.raw("DELETE", "/api/companies/sirket-yeni", { body: JSON.stringify({ confirm: "002", password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } });
      assert.equal(later.status, 200);
      assert.deepEqual(await names(client, "sirket-eski"), ["Eskinin Carisi", "Eskiye Sonra Girilen"]);
    } finally {
      await app.close();
    }
  });
});

describe("bulgu 2 · 001'in klasörünü gösteren şirket: yedeği alınmaz, geri yüklenmez", () => {
  test("Yedek Al 409; Tüm Şirketler'de o şirket hata ile atlanır; 001'in kullanıcıları ve verisi korunur", async () => {
    const dirs = layout([
      { id: "sirket-001", code: "001", name: "Ana", dir: "", createdAt: "2026-09-01T08:00:00.000Z", createdBy: "" },
      { id: "sirket-bozuk", code: "003", name: "Bozuk", dir: ".", createdAt: "2026-10-01T08:00:00.000Z", createdBy: "" },
    ]);
    const { app, client } = await start(dirs);
    try {
      assert.equal((await client.post("/api/admin/backups", { scope: "one", companyId: "sirket-bozuk" })).status, 409);
      const all = data(await client.post("/api/admin/backups", { scope: "all" }));
      assert.deepEqual(all.backups.map(item => item.code), ["001"], "001'in yedeği alınır");
      assert.ok(all.failed.some(item => item.companyId === "sirket-bozuk" && item.error.includes("ilk şirketin (001) veri dosyasını gösteriyor")), JSON.stringify(all.failed));
      const audit = data(await client.get("/api/admin/backups/audit"));
      assert.equal(audit.ok, false);
      assert.ok(audit.errors.some(item => item.includes("003 · Bozuk") && item.includes("001")));
    } finally {
      await app.close();
    }
  });
});

describe("bulgu 3 · liste diskten kurulurken ayırma öncesi yedeği kimlik vermez", () => {
  test("Ayır → üç kopya da yok → yeniden açılış: 005 ve 002 kendi kimlikleriyle, kendi verileriyle", async () => {
    const dirs = layout(SHARED);
    let run = await start(dirs);
    await run.client.post("/api/workspace/accounts?hofCompany=sirket-eski", { name: "Ortak", type: "customer" });
    assert.equal((await run.client.post("/api/companies/sirket-yeni/separate", { confirm: "002", password: ADMIN_PASSWORD })).status, 200);
    await run.client.post("/api/workspace/accounts?hofCompany=sirket-eski", { name: "Yalnız Eski", type: "customer" });
    await run.client.post("/api/workspace/accounts?hofCompany=sirket-yeni", { name: "Yalnız Yeni", type: "customer" });
    await run.app.close();
    writeFileSync(path.join(dirs.dataDir, "sirketler.json"), "bozuk");
    writeFileSync(path.join(dirs.dataDir, "sirketler.yedek.json"), "bozuk");
    const hub = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"));
    hub.prepare("DELETE FROM settings WHERE key = 'company.registry'").run();
    hub.close();
    run = await start(dirs);
    try {
      const all = data(await run.client.get("/api/companies")).all;
      const ids = all.map(item => item.id);
      assert.ok(!ids.includes("sirket-yeni") || (await names(run.client, "sirket-yeni")).includes("Yalnız Yeni"), "002'yi gören 005'in verisini görmez");
      for (const item of all) {
        const list = await names(run.client, item.id);
        if (item.id === "sirket-yeni") assert.deepEqual(list, ["Ortak", "Yalnız Yeni"]);
        if (item.id === "sirket-eski") assert.deepEqual(list, ["Ortak", "Yalnız Eski"]);
      }
      assert.equal(all.length, 3, JSON.stringify(all.map(item => [item.id, item.code])));
    } finally {
      await run.app.close();
    }
  });
});

describe("bulgu 4 · Ayır'dan sonra her şirket kendi unvanını taşır", () => {
  test("paylaşımda son yazılan unvan öbür şirkete geçmez", async () => {
    const dirs = layout(SHARED);
    const { app, client } = await start(dirs);
    try {
      await client.put("/api/companies/sirket-eski", { name: "Eski Unvan AŞ" });
      await client.put("/api/companies/sirket-yeni", { name: "Yeni Unvan Ltd" });
      assert.equal((await client.post("/api/companies/sirket-yeni/separate", { confirm: "002", password: ADMIN_PASSWORD })).status, 200);
      const office = async id => data(await client.get(`/api/admin/office?hofCompany=${id}`)).name;
      assert.equal(await office("sirket-eski"), "Eski Unvan AŞ");
      assert.equal(await office("sirket-yeni"), "Yeni Unvan Ltd");
    } finally {
      await app.close();
    }
  });
});

describe("bulgu 9 · 2.0.21 öncesinden gelen şirketin dosyası kaybolursa boş veri tabanı açılmaz", () => {
  test("işareti olmayan eski şirket: açılışta işaretlenir; dosyası silinince 503", async () => {
    const dirs = layout(null);
    let run = await start(dirs);
    const two = data(await run.client.post("/api/companies", { name: "İki" })).company;
    await run.client.post(`/api/workspace/accounts?hofCompany=${two.id}`, { name: "İkinin Carisi", type: "customer" });
    await run.app.close();
    // 2.0.20'den gelmiş gibi: "açılmış" işareti yok.
    const hub = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"));
    hub.prepare("DELETE FROM settings WHERE key LIKE 'company.opened.%'").run();
    hub.close();
    run = await start(dirs);
    await run.app.close();
    const dir = JSON.parse(readFileSync(path.join(dirs.dataDir, "sirketler.json"), "utf8")).companies.find(item => item.id === two.id).dir;
    for (const suffix of ["", "-wal", "-shm"]) rmSync(path.join(dirs.dataDir, dir, `destekofis.sqlite${suffix}`), { force: true });
    run = await start(dirs);
    try {
      const response = await run.client.get(`/api/workspace/accounts?hofCompany=${two.id}`);
      assert.equal(response.status, 503, JSON.stringify(response.data));
    } finally {
      await run.app.close();
    }
  });
});
