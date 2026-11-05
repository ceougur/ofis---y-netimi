// BS-7 ders 48: Linux'ta /proc/self/fd ile — yeni şemalı 002 açılıp kapanınca, yedek alınınca (salt okunur geçici bağlantı) ve eski yedeğe geri yüklenince
// 002 dosyasına (ve silinmiş eski düğümüne) açık tutamak kalıyor mu.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const NEW = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a03e5f6803e8339cb";
const { startTestServer, loginAdmin, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(NEW, "test", "helpers.mjs")).href);
const { LATEST_VERSION } = await import(pathToFileURL(path.join(NEW, "server", "lib", "migrations.mjs")).href);
const { resolveDbPath } = await import(pathToFileURL(path.join(NEW, "server", "lib", "db-path.mjs")).href);
const today = new Date().toISOString().slice(0, 10);
const handlesTo = file => readdirSync("/proc/self/fd").map(fd => {
  try {
    return readlinkSync(`/proc/self/fd/${fd}`);
  } catch {
    return "";
  }
}).filter(target => target.startsWith(file));
const data = r => (r.data?.ok ? r.data.data : r.data);

test("yeni şemalı 002: açık / yedek / geri yükleme / kapanış tutamakları", { skip: process.platform !== "linux" }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bs7-fd-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  let server = null;
  try {
    server = await startTestServer(dirs);
    let admin = await loginAdmin(server);
    const second = data(await admin.post("/api/companies", { name: "Fd Şirketi" })).company;
    assert.equal((await admin.post(`/api/workspace/cash?hofCompany=${second.id}`, { kind: "in", amount: 5, date: today, description: "x" })).status, 200);
    const backup = data(await admin.post("/api/admin/backups", { scope: "one", companyId: second.id })).name;
    const file = resolveDbPath(server.app.companies.dirsOf(server.app.companies.get(second.id)).dataDir);
    await server.close();
    server = null;
    assert.deepEqual(handlesTo(file), [], "ilk kapanıştan sonra tutamak yok");
    const db = new DatabaseSync(file);
    db.exec(`PRAGMA user_version = ${LATEST_VERSION + 1}`);
    db.close();

    server = await startTestServer(dirs);
    admin = await loginAdmin(server);
    assert.equal((await admin.get(`/api/workspace/cash?hofCompany=${second.id}`)).status, 200);
    const open = handlesTo(file);
    console.log(`002 açıkken tutamaklar: ${open.length} (${[...new Set(open)].join(", ")})`);
    assert.equal((await admin.post("/api/admin/backups", { scope: "one", companyId: second.id })).status, 200);
    const afterOne = handlesTo(file).length;
    console.log(`1. yedekten sonra: ${afterOne}`);
    for (let i = 0; i < 5; i += 1) assert.equal((await admin.post("/api/admin/backups", { scope: "one", companyId: second.id })).status, 200);
    const afterSix = handlesTo(file).length;
    console.log(`6. yedekten sonra: ${afterSix}`);
    assert.ok(afterOne - open.length <= 1, `geçici bağlantı en çok 1 ertelenmiş tutamak bırakır (SQLite POSIX kilit kuralı): ${open.length} → ${afterOne}`);
    assert.equal(afterSix, afterOne, "yedek sayısıyla tutamak büyümez");
    const restored = await admin.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    const afterRestore = handlesTo(file);
    console.log(`geri yüklemeden sonra: ${afterRestore.length} (${[...new Set(afterRestore)].join(", ")})`);
    assert.ok(!afterRestore.some(target => target.includes("(deleted)")), "silinmiş eski düğüme açık tutamak yok");
    await server.close();
    server = null;
    assert.deepEqual(handlesTo(file), [], "kapanıştan sonra tutamak yok");
  } finally {
    if (server) await server.close().catch(() => {});
    rmSync(root, { recursive: true, force: true });
  }
});
