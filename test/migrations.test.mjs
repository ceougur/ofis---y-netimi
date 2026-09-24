import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { startTestServer } from "./helpers.mjs";

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "v1.0.0.sqlite");

describe("v1.0.0 veritabanından yükseltme", () => {
  let server;
  before(async () => {
    server = await startTestServer({
      adminPassword: "Ofis2026!",
      prepare: ({ dataDir }) => {
        mkdirSync(dataDir, { recursive: true });
        copyFileSync(fixture, path.join(dataDir, "hukuk-ofisi.sqlite"));
      },
    });
  });
  after(() => server.close());

  it("şemayı son sürüme yükseltir ve öncesinde yedek alır", () => {
    assert.equal(server.app.store.get("PRAGMA user_version").user_version, LATEST_VERSION);
    assert.deepEqual(server.app.migration.applied, [1, 2]);
    const backups = readdirSync(server.backupDir);
    assert.ok(backups.some(name => name.includes("pre-migration")), `yedekler: ${backups}`);
  });

  it("mevcut verileri korur", () => {
    const { store } = server.app;
    assert.equal(store.get("SELECT COUNT(*) AS count FROM users").count, 2);
    assert.equal(store.get("SELECT COUNT(*) AS count FROM records").count, 1);
    assert.equal(store.get("SELECT value FROM overrides WHERE case_key = '2025/7'").value, "Haciz aşamasında");
    assert.equal(store.get("SELECT COUNT(*) AS count FROM deleted_records").count, 1);
    assert.equal(store.get("SELECT amount FROM payments").amount, 1500);
    assert.equal(store.get("SELECT COUNT(*) AS count FROM messages").count, 1);
  });

  it("tamamlanan görevlerde adı kullanıcı kimliğine çevirir", () => {
    const task = server.app.store.get("SELECT completed_by FROM tasks");
    assert.match(task.completed_by, /^user-/);
  });

  it("varsayılan parolalı yöneticiye zorunlu değişim işaretler, diğer kullanıcıya dokunmaz", async () => {
    const client = server.client();
    const login = await client.login("admin", "Ofis2026!");
    assert.equal(login.status, 200);
    assert.equal(login.data.data.mustChangePassword, true);
    const lawyer = server.client();
    const lawyerLogin = await lawyer.login("ayse", "Avukat-2026!");
    assert.equal(lawyerLogin.data.data.mustChangePassword, false);
    const state = await lawyer.get("/api/workspace/state");
    assert.equal(state.status, 200);
    assert.equal(state.data.data.tasks[0].completedByName, "Ofis yöneticisi");
  });

  it("ikinci açılışta göç tekrar çalışmaz", async () => {
    const dataDir = server.dataDir;
    await server.app.close();
    const reopened = await startTestServer({ dataDir, adminPassword: "Ofis2026!" });
    try {
      assert.deepEqual(reopened.app.migration.applied, []);
    } finally {
      await reopened.close();
    }
    server = await startTestServer({ adminPassword: "Ofis2026!" });
  });
});
