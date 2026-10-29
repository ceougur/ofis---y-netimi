// 2.4.7 (kullanıcı, 29.10.2026: "demosu biten kullanıcı mobili de kullanamasın lisans alana kadar"): deneme süresi dolan kurulumda telefon
// eşli kalsa da uzaktan hiçbir istek geçmez, yeni karekod üretilmez; lisans alınınca aynı telefon yeniden eşleme gerekmeden girer.
// Kapıcı tarafı (özet / canlı istek bitiş anında kapanır) test/kapi-247.test.mjs "süresi biten lisans bitiş ANINDA kapanır"; kapıcı belirteç türüne
// bakmaz (deneme de lisans da expiresAt ile kapanır).
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { signToken } from "../server/lib/license-token.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { createPhone, remoteBase } from "./mobil-uzak-ortak.mjs";

const T0 = Date.parse("2026-10-20T10:00:00+03:00");
const DAY = 86_400_000;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);

describe("2.4.7 deneme süresi dolunca mobil kapanır, lisans alınınca aynı telefon döner", () => {
  it("deneme bitişinde eşli telefonun oturumu, sayfası ve yeni karekod 403 remote-license; lisansla yeniden açılır, eşleme silinmez", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pem = privateKey.export({ format: "pem", type: "pkcs8" });
    const machine = `cd${"34".repeat(15)}`;
    let kind = "trial";
    const clock = createClock({ time: T0, fixed: true });
    const token = () => {
      const at = new Date(clock()).toISOString();
      const trial = kind === "trial";
      return signToken({ schema: 1, product: "DestekOfis", type: "license-token", kind, status: "active", licenseId: trial ? "DEN-247" : "LIS-247", customer: "Deneme Ofisi", machine, issuedAt: at, startsAt: new Date(T0).toISOString(), expiresAt: trial ? new Date(T0 + 30 * DAY).toISOString() : null, offline: false, message: "" }, pem, "deneme-247");
    };
    const server = await startTestServer({
      now: clock, remoteNow: clock, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
      license: { enforce: true, trustedKeys: { "deneme-247": publicKey.export({ format: "der", type: "spki" }).toString("base64") }, services: ["https://lisans.deneme247.test/api/lisans"], machineId: machine, now: () => clock(), firstCheckDelayMs: 3_600_000, autoTrial: false, fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: token() }) }) },
    });
    try {
      await server.app.license.startTrial({});
      assert.equal(server.app.license.status().state, "trial", "ön koşul: deneme sürüyor");
      const admin = await loginAdmin(server);
      const adminId = Object.fromEntries(unwrap(await admin.get("/api/admin/users")).map(u => [u.username, u.id])).admin;
      await admin.put(`/api/admin/mobile/access/${adminId}`, { remote: true });
      const remote = await remoteBase(server);
      const phone = createPhone(remote.base);
      assert.equal((await phone.pair(unwrap(await admin.post("/api/admin/mobile/codes", { userId: adminId })).code)).status, 200, "denemede eşleme açık");
      assert.equal((await phone.login("admin", ADMIN_PASSWORD)).status, 200, "denemede giriş açık");

      clock.set(T0 + 30 * DAY + 1000); // deneme bitti
      assert.equal(server.app.license.status().state, "expired", "ön koşul: deneme doldu");
      assert.equal(server.app.license.status().writable, false);
      const session = await phone.get("/api/mobil/session");
      assert.equal(session.status, 403, "deneme bitince eşli telefonun oturumu kapanmalı");
      assert.equal(session.code, "remote-license");
      const page = await phone.get("/mobil/index.html");
      assert.equal(page.status, 403, "deneme bitince mobil sayfa açılmamalı");
      assert.equal(page.code, "remote-license");
      assert.equal((await phone.login("admin", ADMIN_PASSWORD)).status, 403, "deneme bitince giriş yapılamamalı");
      const code = await admin.post("/api/admin/mobile/codes", { userId: adminId });
      assert.equal(code.status, 403, "deneme bitince yeni karekod üretilmemeli");
      assert.equal(code.data.code, "remote-license");
      assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM mobile_devices").n, 1, "eşleme silinmez (lisans alınınca döner)");

      kind = "license"; // lisans alındı
      await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
      assert.equal(server.app.license.status().writable, true, "ön koşul: lisans etkin");
      assert.equal((await phone.login("admin", ADMIN_PASSWORD)).status, 200, "lisans alınınca aynı telefon yeniden eşlemesiz girer");
      assert.equal((await phone.get("/api/mobil/session")).status, 200);
    } finally {
      await server.close();
    }
  });
});
