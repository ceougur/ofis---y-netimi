import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { createBackup, listBackups, pruneBackups } from "../server/lib/backup.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("yedekleme", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    await admin.post("/api/workspace/messages", { to: "Ekip", message: "Yedek öncesi kayıt" });
  });
  after(() => server.close());

  it("çalışan veritabanının tutarlı kopyasını alır ve eski yedekleri temizler", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "yedek-"));
    try {
      for (let index = 0; index < 5; index += 1) createBackup(server.app.db, dir, { keep: 100, label: `t${index}` });
      assert.equal(listBackups(dir).length, 5);
      pruneBackups(dir, 3);
      assert.equal(listBackups(dir).length, 3);
      const copy = new DatabaseSync(path.join(dir, listBackups(dir)[0].name), { readOnly: true });
      assert.equal(copy.prepare("SELECT COUNT(*) AS count FROM messages").get().count, 1);
      copy.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("npm run backup aracı doğru klasörü kullanır (v1.0.0 hatası)", () => {
    const output = execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(root, "tools", "backup.mjs")], {
      env: { ...process.env, HUKUK_DATA_DIR: server.dataDir, HUKUK_BACKUP_DIR: server.backupDir },
      encoding: "utf8",
    }).trim();
    assert.ok(output.startsWith(server.backupDir), output);
    assert.ok(existsSync(output));
  });

  it("yönetici yedek alır, listeler ve indirir", async () => {
    const created = await admin.post("/api/admin/backups");
    assert.equal(created.status, 200);
    const list = await admin.get("/api/admin/backups");
    assert.ok(list.data.data.some(item => item.name === created.data.data.name));
    const response = await fetch(`${server.base}/api/admin/backups/${created.data.data.name}`, { headers: { cookie: admin.cookie } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), /attachment/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 15).toString(), "SQLite format 3");
    const invalid = await admin.get("/api/admin/backups/..%2Fhukuk-ofisi.sqlite");
    assert.equal(invalid.status, 400);
  });

  it("sistem bilgisini döndürür", async () => {
    const info = await admin.get("/api/admin/system");
    assert.equal(info.status, 200);
    assert.equal(info.data.data.schemaVersion, 2);
    assert.ok(info.data.data.lastBackup);
    assert.equal(info.data.data.port, server.app.config.publicPort);
    assert.ok(Array.isArray(info.data.data.addresses));
    for (const address of info.data.data.addresses) assert.match(address, /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/);
    assert.equal(typeof info.data.data.hostname, "string");
  });

  it("ofis adı kaydedilir, keşif bilgisine ve giriş ekranına yansır, geçmişe yazılır", async () => {
    let changes = 0;
    const stop = server.app.onInfoChange(() => (changes += 1));
    try {
      const saved = await admin.put("/api/admin/office", { name: "  Çetin Hukuk Bürosu  " });
      assert.equal(saved.status, 200);
      assert.equal(saved.data.data.name, "Çetin Hukuk Bürosu");
      assert.equal((await admin.get("/api/admin/office")).data.data.name, "Çetin Hukuk Bürosu");
      assert.equal(server.app.info().officeName, "Çetin Hukuk Bürosu");
      assert.ok(changes >= 1, "keşif yanıtı güncellenmeli");
      assert.equal((await admin.get("/api/auth/me")).data.data.office.name, "Çetin Hukuk Bürosu");
      const events = await admin.get("/api/admin/audit?type=settings.office");
      assert.equal(events.data.data[0].payload.name, "Çetin Hukuk Bürosu");
      const tooLong = await admin.put("/api/admin/office", { name: "x".repeat(121) });
      assert.equal(tooLong.status, 400);
    } finally {
      stop?.();
    }
  });
});
