// 2.0.21 (arıza testi bulgusu): şirket listesi (sirketler.json) bozulunca 002 ve sonraki şirketler listeden düşüyor, bozuk
// dosya üzerine yazılıyordu. Artık liste üç yerde tutulur (dosya, ikinci kopya, ortak veri tabanı); bozuk dosya yanına
// alınır; hepsi yoksa diskteki şirket klasörlerinden, şirketin asıl kimliği yedeklerinden okunarak kurulur.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, test } from "node:test";
import { createApp } from "../server/app.mjs";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";

const data = response => (response.data && typeof response.data === "object" && "ok" in response.data ? response.data.data : response.data);
const roots = [];
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));

async function boot(root) {
  const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, maxCompanies: 3 }); // 3 şirket: sınırdan (2) önceki kurulum
  const { port } = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${port}`);
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  return { app, client };
}
// İki ek şirket, her birinde cari, bir personelin yalnız 003'e yetkisi; yedek alınır.
async function setup() {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-liste-"));
  roots.push(root);
  const { app, client } = await boot(root);
  const two = data(await client.post("/api/companies", { name: "Demir İnşaat" })).company;
  const three = data(await client.post("/api/companies", { name: "Gayri Resmî" })).company;
  for (const [company, name] of [[two, "Demir Müşterisi"], [three, "Gayri Müşterisi"]]) await client.post(`/api/workspace/accounts?hofCompany=${company.id}`, { name, type: "customer" });
  const staff = data(await client.post("/api/admin/users", { username: "personel3", name: "Personel", role: "personel", password: "Personel-2026!", mustChangePassword: false }));
  await client.put(`/api/companies/access/${staff.id}`, { companies: [three.id] });
  assert.equal((await client.post("/api/admin/backups", { scope: "all" })).status, 200);
  await app.close();
  return { root, two, three };
}
const check = async (root, two, three) => {
  const { app, client } = await boot(root);
  try {
    const all = data(await client.get("/api/companies")).all;
    assert.deepEqual(all.map(item => [item.id, item.code, item.name]), [["sirket-001", "001", all[0].name], [two.id, "002", "Demir İnşaat"], [three.id, "003", "Gayri Resmî"]]);
    assert.deepEqual(data(await client.get(`/api/workspace/accounts?hofCompany=${three.id}`)).accounts.map(item => item.name), ["Gayri Müşterisi"]);
    // Personelin yetkisi korunur (şirket kimliği aynı): yalnız 003'ü görür.
    const staff = createClient(client.base || `http://127.0.0.1:${app.server?.address?.().port}`);
    return { app, client, staff };
  } catch (error) {
    await app.close();
    throw error;
  }
};

describe("2.0.21 · şirket listesi bozulursa şirketler kaybolmaz", () => {
  test("asıl dosya bozuk → ikinci kopyadan; bozuk dosya yanına alınır", async () => {
    const { root, two, three } = await setup();
    const file = path.join(root, "data", "sirketler.json");
    writeFileSync(file, '{"companies": [{"id": "sirket-001"');
    const { app } = await check(root, two, three);
    await app.close();
    const kept = readdirSync(path.join(root, "data")).filter(name => name.startsWith("sirketler.json.bozuk-"));
    assert.equal(kept.length, 1, "bozuk dosya saklandı");
  });

  test("asıl dosya ve ikinci kopya bozuk → ortak veri tabanındaki kopyadan", async () => {
    const { root, two, three } = await setup();
    writeFileSync(path.join(root, "data", "sirketler.json"), "");
    writeFileSync(path.join(root, "data", "sirketler.yedek.json"), '{"companies": []}');
    const { app } = await check(root, two, three);
    await app.close();
  });

  test("üçü de yok → diskteki şirket klasörlerinden; asıl kimlik, kod ve ad yedeklerinden", async () => {
    const { root, two, three } = await setup();
    writeFileSync(path.join(root, "data", "sirketler.json"), "bozuk");
    rmSync(path.join(root, "data", "sirketler.yedek.json"));
    const hub = new DatabaseSync(path.join(root, "data", "destekofis.sqlite"));
    hub.prepare("DELETE FROM settings WHERE key = 'company.registry'").run();
    hub.close();
    const { app } = await check(root, two, three);
    await app.close();
  });

  test("dosya hiç yoksa ve kopya varsa yeni liste yazılmaz, kopyadan kurulur", async () => {
    const { root, two, three } = await setup();
    rmSync(path.join(root, "data", "sirketler.json"));
    const { app } = await check(root, two, three);
    await app.close();
    assert.ok(existsSync(path.join(root, "data", "sirketler.json")));
  });
});
