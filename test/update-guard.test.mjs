// Uygulama tarafı güncelleme koruması (2.0.7): eski servis yöneticisi (2.0.6 ve öncesi) yeniden başlamadan yeni
// sürüme geçtiğinde çalışan sürümü eski sanıp aynı sürümü "yeni" diye önerebilir. Yönetim paneli bu öneriyi
// göstermez, "Şimdi güncelle" ile kurdurmaz (sahada: çalışan app\<sürüm> klasörü silinmeye çalışıldı, EPERM).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

describe("güncelleme: kurulu sürüm yeniden önerilmez (uygulama tarafı)", () => {
  let server;
  let admin;
  let running;
  const calls = [];
  let offered = null; // eski servis yöneticisinin "bulduğu" sürüm
  const link = {
    supervised: true,
    async request(type) {
      calls.push(type);
      const status = { enabled: true, autoUpdate: true, channel: "stable", currentVersion: "2.0.5", state: "idle", available: offered ? { version: offered, notes: "", size: 1 } : null, lastCheck: offered ? { at: new Date().toISOString(), status: "available", version: offered } : { status: "up-to-date" }, history: [] };
      if (type === "update:apply") return { ...status, accepted: true, version: offered };
      return status;
    },
  };
  before(async () => {
    server = await startTestServer({ supervisorLink: link });
    admin = await loginAdmin(server);
    running = (await admin.get("/api/health")).data.data.version;
  });
  after(() => server.close());

  it("çalışan sürümle aynı öneri gizlenir ve kurulum başlatılmaz", async () => {
    offered = running;
    const status = await admin.get("/api/admin/update");
    assert.equal(status.status, 200);
    assert.equal(status.data.data.currentVersion, running, "kurulu sürüm çalışan uygulamanın sürümü");
    assert.equal(status.data.data.available, null);
    assert.equal(status.data.data.lastCheck.status, "up-to-date");
    const checked = await admin.post("/api/admin/update/check");
    assert.equal(checked.data.data.available, null);
    calls.length = 0;
    const applied = await admin.post("/api/admin/update/apply");
    assert.equal(applied.status, 409);
    assert.match(applied.data.error, /yeni bir sürüm yok/);
    assert.ok(!calls.includes("update:apply"), `servis yöneticisine kurulum isteği gitmemeli: ${calls}`);
  });

  it("gerçekten yeni sürüm önerilir ve kurulabilir", async () => {
    const [major, minor, patch] = running.split(".").map(Number);
    offered = `${major}.${minor}.${patch + 1}`;
    const checked = await admin.post("/api/admin/update/check");
    assert.equal(checked.data.data.available.version, offered);
    calls.length = 0;
    const applied = await admin.post("/api/admin/update/apply");
    assert.equal(applied.status, 200);
    assert.equal(applied.data.data.version, offered);
    assert.ok(calls.includes("update:apply"));
  });
});
