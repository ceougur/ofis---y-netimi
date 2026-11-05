// BS-7 gerileme denetimi (ders 17): v2.4.9'un GERÇEK koduyla (ccf0b0ca = yayımlanan 2.4.9) API'den üretilen 001 + 002 verisi yeni kodla açılır:
// kapı kalkık (schemaGate null), göç yok, yazma ve okuma çalışır, sayılar aynı.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const OLD = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bs7-ccf0b0ca/eski-ccf0b0ca";
const NEW = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a03e5f6803e8339cb";
const { createApp: oldApp } = await import(pathToFileURL(path.join(OLD, "server", "app.mjs")).href);
const { createApp: newApp } = await import(pathToFileURL(path.join(NEW, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(NEW, "test", "helpers.mjs")).href);
const PASS = "Test-Admin-2026!";
const LICENSE = { enforce: false, machineId: "0123456789abcdef0123456789abcdef" };
const today = new Date().toISOString().slice(0, 10);
const data = r => (r.data?.ok ? r.data.data : r.data);

async function boot(createApp, dirs) {
  const app = createApp({ ...dirs, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: LICENSE, startLicenseTimers: false });
  const address = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${address.port}`);
  assert.equal((await client.login("admin", PASS)).status, 200);
  return { app, client };
}

test("v2.4.9 verisi (001 + 002) yeni kodla normal açılır; kapı yok, yazma çalışır", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bs7-eski-veri-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  try {
    let { app, client } = await boot(oldApp, dirs);
    for (let i = 0; i < 20; i += 1) assert.equal((await client.post("/api/workspace/cash", { kind: "in", amount: 10 + i, date: today, description: `001 giriş ${i}` })).status, 200);
    const second = data(await client.post("/api/companies", { name: "Eski İkinci" })).company;
    const q = `?hofCompany=${second.id}`;
    for (let i = 0; i < 20; i += 1) assert.equal((await client.post(`/api/workspace/accounts${q}`, { name: `Cari ${i}`, type: "customer" })).status, 200);
    assert.equal((await client.post(`/api/workspace/cash${q}`, { kind: "in", amount: 250, date: today, description: "002 girişi" })).status, 200);
    const before = { root: data(await client.get("/api/workspace/cash")).totals.balance, second: data(await client.get(`/api/workspace/cash${q}`)).totals.balance, accounts: data(await client.get(`/api/workspace/accounts${q}`)).accounts.length };
    await app.close();

    ({ app, client } = await boot(newApp, dirs));
    try {
      assert.equal(app.schemaGate, null);
      assert.deepEqual(app.migration.applied, []);
      assert.equal(data(await client.get("/api/workspace/client-state")).schemaGate, null);
      assert.equal(data(await client.get(`/api/workspace/client-state${q}`)).schemaGate, null);
      assert.equal(data(await client.get("/api/workspace/cash")).totals.balance, before.root);
      assert.equal(data(await client.get(`/api/workspace/cash${q}`)).totals.balance, before.second);
      assert.equal(data(await client.get(`/api/workspace/accounts${q}`)).accounts.length, before.accounts);
      assert.equal(app.openCompany(second.id).schemaGate, null);
      assert.equal(app.openCompany(second.id).context.canWriteInBackground(), true);
      assert.equal((await client.post("/api/workspace/cash", { kind: "in", amount: 1, date: today, description: "yeni kod 001" })).status, 200);
      assert.equal((await client.post(`/api/workspace/cash${q}`, { kind: "in", amount: 1, date: today, description: "yeni kod 002" })).status, 200);
    } finally {
      await app.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
