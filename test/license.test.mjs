// Lisans motoru (Faz 3): imzalı belirteç, durum hesabı, salt okunur mod, deneme/lisans/kod akışları, 7 günlük
// internetsiz tolerans, saat geri alma koruması, geçiş dönemi ve yerel kaydın bütünlüğü.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { evaluateLicense, normalizeLicenseKey, WRITE_PERMISSIONS } from "../server/lib/license.mjs";
import { TRUSTED_LICENSE_KEYS } from "../server/lib/license-keys.mjs";
import { decodeCode, encodeCode, formatInstallCode, normalizeMachineId, signToken, verifyToken } from "../server/lib/license-token.mjs";
import { resolveMachineId } from "../server/lib/machine.mjs";
import { createReferenceLicenseService, keyIdForLicense, newLicenseKey } from "../tools/lib/license-service.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const DAY = 86_400_000;
const here = path.dirname(fileURLToPath(import.meta.url));
const keyPair = () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { pem: privateKey.export({ format: "pem", type: "pkcs8" }), spki: publicKey.export({ format: "der", type: "spki" }).toString("base64") };
};
const TEST_KEY = keyPair();
const OTHER_KEY = keyPair();
const TRUSTED = { "test-lisans-1": TEST_KEY.spki };
const MACHINE_A = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const MACHINE_B = "ffeeddccbbaa99887766554433221100";
const T0 = Date.parse("2026-10-01T09:00:00Z");

const claims = (overrides = {}) => ({
  schema: 1,
  product: "DestekOfis",
  type: "license-token",
  kind: "license",
  status: "active",
  licenseId: "LIS-TEST-0001",
  customer: "Deneme Ofisi",
  machine: MACHINE_A,
  issuedAt: new Date(T0).toISOString(),
  startsAt: new Date(T0).toISOString(),
  expiresAt: new Date(T0 + 365 * DAY).toISOString(),
  offline: false,
  message: "",
  ...overrides,
});

describe("lisans belirteci", () => {
  it("imzalı belirteci doğrular, değiştirilmiş veya tanınmayan anahtarla imzalanmışı reddeder", () => {
    const envelope = signToken(claims(), TEST_KEY.pem, "test-lisans-1");
    assert.equal(verifyToken(envelope, TRUSTED).claims.licenseId, "LIS-TEST-0001");
    const tampered = { ...envelope, payload: Buffer.from(JSON.stringify({ ...claims(), expiresAt: null })).toString("base64") };
    assert.throws(() => verifyToken(tampered, TRUSTED), { code: "SIGNATURE_INVALID" });
    const foreign = signToken(claims(), OTHER_KEY.pem, "test-lisans-1");
    assert.throws(() => verifyToken(foreign, TRUSTED), { code: "SIGNATURE_INVALID" });
    assert.throws(() => verifyToken(envelope, TRUSTED_LICENSE_KEYS), { code: "SIGNATURE_INVALID" }, "üretim anahtarı test imzasını kabul etmez");
  });

  it("biçim denetimi: deneme belirtecinin bitişi zorunlu, bilinmeyen tür ve durum reddedilir", () => {
    assert.throws(() => signToken(claims({ kind: "trial", expiresAt: null }), TEST_KEY.pem, "k"), /deneme/);
    assert.throws(() => signToken(claims({ kind: "free" }), TEST_KEY.pem, "k"), /tür/);
    assert.throws(() => signToken(claims({ status: "paused" }), TEST_KEY.pem, "k"), /durum/);
    assert.throws(() => signToken(claims({ machine: "kısa" }), TEST_KEY.pem, "k"), /bilgisayar/);
  });

  it("internetsiz etkinleştirme kodu zarfı taşır; bozuk kod anlaşılır hata verir", () => {
    const envelope = signToken(claims({ offline: true }), TEST_KEY.pem, "test-lisans-1");
    const code = encodeCode(envelope);
    assert.match(code, /^DOLIS1\.[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeCode(`  ${code.slice(0, 40)}\n${code.slice(40)} `), envelope, "boşluk ve satır sonu yok sayılır");
    assert.throws(() => decodeCode("ABC"), /DOLIS1/);
    assert.throws(() => decodeCode("DOLIS1.@@@"), /bozuk/);
  });

  it("kurulum kodu ve lisans anahtarı biçimleri", () => {
    assert.equal(formatInstallCode(MACHINE_A), "A1B2-C3D4-E5F6-0718-293A-4B5C-6D7E-8F90");
    assert.equal(normalizeMachineId("A1B2-C3D4-E5F6-0718-293A-4B5C-6D7E-8F90"), MACHINE_A);
    const key = newLicenseKey();
    assert.match(key, /^DO(-[0-9A-HJKMNP-TV-Z]{5}){4}$/);
    assert.equal(normalizeLicenseKey(key.toLowerCase()), key);
    assert.equal(normalizeLicenseKey(key.replace(/-/g, " ").slice(3)), key, "önek ve tireler yazılmasa da olur");
    assert.equal(normalizeLicenseKey("DO-12345"), null);
  });

  it("bilgisayar kimliği kalıcıdır; ham değer dışarı verilmez", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "makine-"));
    try {
      const first = resolveMachineId({ dataDir: dir, platform: "other" });
      const second = resolveMachineId({ dataDir: dir, platform: "other" });
      assert.equal(first.id, second.id);
      assert.equal(first.source, "file");
      assert.match(first.id, /^[a-f0-9]{32}$/);
      if (process.platform === "linux") assert.equal(resolveMachineId({ dataDir: dir }).source, "linux");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("lisans durumu (saf değerlendirme)", () => {
  const verified = overrides => verifyToken(signToken(claims(overrides), TEST_KEY.pem, "test-lisans-1"), TRUSTED).claims;
  const evaluate = (token, now, local = {}, extra = {}) => evaluateLicense({ token, machineId: MACHINE_A, local, now, ...extra });

  it("etkinleştirilmemiş kurulum salt okunurdur", () => {
    const status = evaluate(null, T0);
    assert.equal(status.state, "none");
    assert.equal(status.writable, false);
    assert.match(status.message, /ücretsiz denemeyi başlatmalı/);
  });

  it("deneme: kalan gün, son 7 günde uyarı, süre dolunca salt okunur", () => {
    const trial = verified({ kind: "trial", licenseId: "DEN-1", expiresAt: new Date(T0 + 30 * DAY).toISOString() });
    const fresh = evaluate(trial, T0 + 1000);
    assert.equal(fresh.state, "trial");
    assert.equal(fresh.writable, true);
    assert.equal(fresh.daysLeft, 30);
    assert.equal(fresh.severity, "info");
    assert.equal(evaluate(trial, T0 + 25 * DAY, { lastOnlineAt: T0 + 24 * DAY }).severity, "warn");
    const expired = evaluate(trial, T0 + 30 * DAY + 1, { lastOnlineAt: T0 + 29 * DAY });
    assert.equal(expired.state, "expired");
    assert.equal(expired.writable, false);
    assert.equal(expired.title, "Deneme süresi doldu");
    assert.match(expired.message, /durduruldu: kayıtlar görüntülenebilir/);
  });

  it("lisans: süresiz, bitişe yakın uyarı, engellenmiş lisans salt okunur", () => {
    const perpetual = evaluate(verified({ expiresAt: null }), T0 + 400 * DAY, { lastOnlineAt: T0 + 399 * DAY });
    assert.equal(perpetual.state, "licensed");
    assert.equal(perpetual.daysLeft, null);
    const ending = evaluate(verified({ expiresAt: new Date(T0 + 10 * DAY).toISOString() }), T0 + 5 * DAY, { lastOnlineAt: T0 + 5 * DAY });
    assert.equal(ending.severity, "warn");
    assert.match(ending.title, /5 gün kaldı/);
    const blocked = evaluate(verified({ status: "blocked", message: "Ödeme bekleniyor." }), T0);
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.writable, false);
    assert.match(blocked.message, /Ödeme bekleniyor/);
  });

  it("7 günden uzun internetsiz kalınca doğrulama ister; son 3 günde uyarır; internetsiz lisansta süre yok", () => {
    const online = verified({});
    const warn = evaluate(online, T0 + 5 * DAY, { lastOnlineAt: T0 });
    assert.equal(warn.state, "licensed");
    assert.equal(warn.severity, "warn");
    assert.equal(warn.reason, "grace");
    const verify = evaluate(online, T0 + 7 * DAY + 60_000, { lastOnlineAt: T0 });
    assert.equal(verify.state, "verify");
    assert.equal(verify.writable, false);
    const offline = evaluate(verified({ offline: true }), T0 + 90 * DAY);
    assert.equal(offline.state, "licensed");
    assert.equal(offline.writable, true);
  });

  it("saat geri alınınca süre geri gelmez ve program salt okunur olur", () => {
    const trial = verified({ kind: "trial", licenseId: "DEN-2", expiresAt: new Date(T0 + 30 * DAY).toISOString() });
    // 31. günde görülmüş, saat 20 gün geri alınmış: süre yine dolmuş sayılır.
    const back = evaluate(trial, T0 + 11 * DAY, { highWater: T0 + 31 * DAY, lastOnlineAt: T0 + 29 * DAY });
    assert.equal(back.state, "expired");
    // Süre dolmadan saat 3 gün geri alınmış: saat hatası.
    const clock = evaluate(trial, T0 + 5 * DAY, { highWater: T0 + 8 * DAY, lastOnlineAt: T0 + 8 * DAY });
    assert.equal(clock.state, "clock");
    assert.equal(clock.writable, false);
    // Birkaç saatlik düzeltme hata sayılmaz.
    assert.equal(evaluate(trial, T0 + 5 * DAY, { highWater: T0 + 5 * DAY + 3 * 3_600_000, lastOnlineAt: T0 + 5 * DAY }).state, "trial");
  });

  it("geçiş dönemi 30 gün yazılabilir, sonra salt okunur; başka bilgisayarın lisansı sayılmaz", () => {
    const during = evaluate(null, T0 + 10 * DAY, { transitionStart: T0 });
    assert.equal(during.state, "transition");
    assert.equal(during.writable, true);
    assert.equal(during.daysLeft, 20);
    const ended = evaluate(null, T0 + 31 * DAY, { transitionStart: T0 });
    assert.equal(ended.state, "none");
    assert.equal(ended.reason, "transition-ended");
    const foreign = evaluateLicense({ token: null, tokenProblem: "Kayıtlı lisans başka bir bilgisayara ait.", machineId: MACHINE_A, local: {}, now: T0 });
    assert.equal(foreign.reason, "machine");
    assert.equal(foreign.writable, false);
  });
});

describe("lisans motoru — sunucu", () => {
  const clock = { now: T0 };
  let online = true;
  let reference;
  let servers = [];
  const serviceFetch = async (url, init) => {
    if (!online) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    return reference.fetch(url, init);
  };
  const licenseOptions = (machineId = MACHINE_A) => ({ enforce: true, trustedKeys: TRUSTED, services: ["https://lisans.test/api/lisans"], fetchImpl: serviceFetch, machineId, now: () => clock.now, firstCheckDelayMs: 3_600_000 });
  const start = async (options = {}) => {
    const server = await startTestServer({ license: licenseOptions(options.machineId), ...options });
    servers.push(server);
    return server;
  };
  const writeNote = (client, key = "2026/1") => client.post("/api/workspace/records", { sourceName: "dataset://ofis", values: { "DOSYA NO": key, "AD SOYAD": "Deneme Kişi" } });

  before(() => {
    reference = createReferenceLicenseService({ privateKeyPem: TEST_KEY.pem, keyId: keyIdForLicense(TEST_KEY.pem, TRUSTED), now: () => clock.now });
  });
  after(async () => {
    for (const server of servers) await server.close().catch(() => {});
  });

  it("yeni kurulum etkinleştirilmeden salt okunurdur; yönetim, yedek ve giriş çalışır", async () => {
    clock.now = T0;
    const server = await start();
    const admin = await loginAdmin(server);
    const me = await admin.get("/api/auth/me");
    assert.equal(me.data.data.license.state, "none");
    assert.equal(me.data.data.license.installCode, formatInstallCode(MACHINE_A));
    assert.ok(!me.data.data.permissions.includes("records.create"), "yazma yetkileri ekrana gönderilmez");
    assert.ok(me.data.data.permissions.includes("license.manage"));
    const denied = await writeNote(admin);
    assert.equal(denied.status, 403);
    assert.equal(denied.data.code, "LICENSE_READ_ONLY");
    assert.equal((await admin.get("/api/workspace/records")).status, 200, "okuma serbest");
    assert.equal((await admin.post("/api/admin/backups")).status, 200, "yedek alınabilir");
    const staff = await createUser(server, admin, { username: "personel1", role: "personel" });
    const staffLicense = await staff.get("/api/license");
    assert.equal(staffLicense.data.data.state, "none");
    assert.equal(staffLicense.data.data.installCode, undefined, "kurulum kodu yalnızca yöneticiye");
    assert.equal((await staff.post("/api/license/trial", {})).status, 403, "denemeyi yalnızca yönetici başlatır");
    server.state = { admin, staff };
  });

  it("ücretsiz deneme 30 gün açar; süre dolunca durur, okuma ve yedek sürer", async () => {
    const server = servers[0];
    const { admin } = server.state;
    const started = await admin.post("/api/license/trial", { officeName: "Test Hukuk", email: "ofis@example.com" });
    assert.equal(started.status, 200, JSON.stringify(started.data));
    assert.equal(started.data.data.state, "trial");
    assert.equal(started.data.data.daysLeft, 30);
    assert.equal((await writeNote(admin)).status, 200, "denemede yazılabilir");
    const again = await admin.post("/api/license/trial", {});
    assert.equal(again.data.data.licenseId, started.data.data.licenseId, "ikinci istek aynı denemeyi döndürür");

    clock.now = T0 + 30 * DAY + 60_000;
    const me = await admin.get("/api/auth/me");
    assert.equal(me.data.data.license.state, "expired");
    assert.equal(me.data.data.license.title, "Deneme süresi doldu");
    const blocked = await writeNote(admin, "2026/2");
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.code, "LICENSE_READ_ONLY");
    assert.equal((await admin.get("/api/workspace/records")).status, 200);
    assert.equal((await admin.post("/api/admin/backups")).status, 200);
    const audit = await admin.get("/api/admin/audit?type=license.");
    const types = audit.data.data.map(event => event.type);
    assert.ok(types.includes("license.trial_started"));
    assert.ok(types.includes("license.state_changed"));
  });

  it("aynı bilgisayara ikinci deneme verilmez (yeniden kurulum dahil)", async () => {
    clock.now = T0 + 40 * DAY;
    const reinstall = await start();
    const admin = await loginAdmin(reinstall);
    const result = await admin.post("/api/license/trial", {});
    assert.equal(result.status, 200);
    assert.equal(result.data.data.state, "expired", "ilk denemenin süresi sayılır");
  });

  it("lisans anahtarı bilgisayara bağlanır; başka bilgisayarda reddedilir; engellenince salt okunur", async () => {
    clock.now = T0 + 41 * DAY;
    const server = servers[0];
    const { admin } = server.state;
    const { key, licenseId } = reference.admin.createLicense({ customer: "Test Hukuk Bürosu", expiresAt: new Date(T0 + 500 * DAY).toISOString() });
    assert.equal((await admin.post("/api/license/activate", { key: "DO-00000-00000-00000-00000" })).status, 409);
    const activated = await admin.post("/api/license/activate", { key: key.toLowerCase() });
    assert.equal(activated.status, 200, JSON.stringify(activated.data));
    assert.equal(activated.data.data.state, "licensed");
    assert.equal(activated.data.data.customer, "Test Hukuk Bürosu");
    assert.equal((await writeNote(admin, "2026/3")).status, 200);

    const other = await start({ machineId: MACHINE_B });
    const otherAdmin = await loginAdmin(other);
    const inUse = await otherAdmin.post("/api/license/activate", { key });
    assert.equal(inUse.status, 409);
    assert.match(inUse.data.error, /başka bir bilgisayarda/);

    reference.admin.setStatus(licenseId, "blocked", "Ödeme bekleniyor, lütfen arayın.");
    const checked = await admin.post("/api/license/check");
    assert.equal(checked.status, 200);
    assert.equal(checked.data.data.state, "blocked");
    assert.match(checked.data.data.message, /Ödeme bekleniyor/);
    assert.equal((await writeNote(admin, "2026/4")).status, 403);
    reference.admin.setStatus(licenseId, "active");
    assert.equal((await admin.post("/api/license/check")).data.data.state, "licensed");
    server.state.licenseId = licenseId;
  });

  it("internetsiz 7 gün tolerans: servis yoksa uyarır, 7 gün sonra durur, bağlantı gelince açılır", async () => {
    const { admin } = servers[0].state;
    online = false;
    clock.now = T0 + 46 * DAY;
    const failed = await admin.post("/api/license/check");
    assert.equal(failed.status, 502);
    assert.match(failed.data.error, /İnternet bağlantısı yok/);
    assert.equal(failed.data.license.severity, "warn");
    clock.now = T0 + 49 * DAY;
    assert.equal((await admin.get("/api/license")).data.data.state, "verify");
    assert.equal((await writeNote(admin, "2026/5")).status, 403);
    online = true;
    assert.equal((await admin.post("/api/license/check")).data.data.state, "licensed");
    assert.equal((await writeNote(admin, "2026/5")).status, 200);
  });

  it("saat geri alınırsa durur; servisin saati güvenilir zamandır", async () => {
    const { admin } = servers[0].state;
    clock.now = T0 + 44 * DAY;
    const status = (await admin.get("/api/license")).data.data;
    assert.equal(status.state, "clock");
    assert.equal((await writeNote(admin, "2026/6")).status, 403);
    clock.now = T0 + 49 * DAY + 60_000;
    assert.equal((await admin.get("/api/license")).data.data.state, "licensed");
  });

  it("internetsiz etkinleştirme kodu: yalnızca kendi bilgisayarında, doğrulama gerektirmez", async () => {
    clock.now = T0 + 60 * DAY;
    const server = await start({ machineId: MACHINE_B });
    const admin = await loginAdmin(server);
    const make = (machine, overrides = {}) => encodeCode(signToken(claims({ machine, licenseId: "LIS-KOD-0001", offline: true, issuedAt: new Date(clock.now).toISOString(), startsAt: new Date(clock.now).toISOString(), expiresAt: new Date(clock.now + 365 * DAY).toISOString(), ...overrides }), TEST_KEY.pem, "test-lisans-1"));
    const wrong = await admin.post("/api/license/code", { code: make(MACHINE_A) });
    assert.equal(wrong.status, 400);
    assert.match(wrong.data.error, /başka bir bilgisayar/);
    const forged = encodeCode(signToken(claims({ machine: MACHINE_B, offline: true }), OTHER_KEY.pem, "test-lisans-1"));
    assert.equal((await admin.post("/api/license/code", { code: forged })).status, 400, "sahte imzalı kod reddedilir");
    const applied = await admin.post("/api/license/code", { code: make(MACHINE_B) });
    assert.equal(applied.status, 200, JSON.stringify(applied.data));
    assert.equal(applied.data.data.state, "licensed");
    assert.equal(applied.data.data.offline, true);
    online = false;
    clock.now += 120 * DAY;
    assert.equal((await admin.get("/api/license")).data.data.state, "licensed", "internetsiz lisans doğrulama beklemez");
    online = true;
    const older = make(MACHINE_B, { issuedAt: new Date(T0).toISOString(), startsAt: new Date(T0).toISOString() });
    assert.equal((await admin.post("/api/license/code", { code: older })).status, 409, "eski kod yenisinin yerine geçmez");
  });

  it("ileri alınıp düzeltilen saat takılı kalmaz: daha yeni imzalı kod zamanı düzeltir, eski kod geri alamaz", async () => {
    clock.now = T0 + 200 * DAY;
    const server = await start({ machineId: MACHINE_B });
    const admin = await loginAdmin(server);
    const code = (issuedAt, licenseId) => encodeCode(signToken(claims({ machine: MACHINE_B, licenseId, offline: true, issuedAt: new Date(issuedAt).toISOString(), startsAt: new Date(issuedAt).toISOString(), expiresAt: null }), TEST_KEY.pem, "test-lisans-1"));
    const oldCode = code(T0 + 150 * DAY, "LIS-ESKI-0001");
    assert.equal((await admin.post("/api/license/code", { code: code(T0 + 200 * DAY, "LIS-SAAT-0001") })).data.data.state, "licensed");
    clock.now = T0 + 205 * DAY; // saat yanlışlıkla 5 gün ileri alındı
    assert.equal((await admin.get("/api/license")).data.data.state, "licensed");
    clock.now = T0 + 200 * DAY + 3_600_000; // saat düzeltildi
    assert.equal((await admin.get("/api/license")).data.data.state, "clock");
    assert.equal((await admin.post("/api/license/code", { code: oldCode })).data.data.state, "clock", "eski kod zamanı geri çekemez");
    const fresh = await admin.post("/api/license/code", { code: code(T0 + 200 * DAY + 3_000_000, "LIS-SAAT-0001") });
    assert.equal(fresh.data.data.state, "licensed", "satıcının yeni kodu saati düzeltir");
  });

  it("2.0 öncesinden gelen kullanılmış kurulum 30 günlük geçiş döneminde yazılabilir", async () => {
    clock.now = T0;
    const dataDir = mkdtempSync(path.join(tmpdir(), "gecis-"));
    mkdirSync(dataDir, { recursive: true });
    copyFileSync(path.join(here, "fixtures", "v1.0.0.sqlite"), path.join(dataDir, "hukuk-ofisi.sqlite"));
    const server = await start({ dataDir, adminPassword: ADMIN_PASSWORD });
    try {
      const admin = server.client();
      const login = await admin.login("admin", ADMIN_PASSWORD);
      if (login.status === 200) {
        assert.equal(login.data.data.license.state, "transition");
        assert.equal(login.data.data.license.daysLeft, 30);
      }
      const status = server.app.license.status();
      assert.equal(status.state, "transition");
      assert.equal(status.writable, true);
      clock.now = T0 + 31 * DAY;
      assert.equal(server.app.license.status().state, "none");
      assert.equal(server.app.license.status().reason, "transition-ended");
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("yerel kayıt elle değiştirilirse en sıkı varsayım kullanılır", async () => {
    clock.now = T0 + 70 * DAY;
    const dataDir = mkdtempSync(path.join(tmpdir(), "kurcalama-"));
    try {
      const first = await start({ dataDir });
      assert.equal(first.app.license.summary({ role: "admin" }).tampered, false);
      await first.close();
      servers = servers.filter(item => item !== first);
      // Görülen en ileri zaman elle geri çekilir: bütünlük özeti tutmaz.
      const { openDatabase, createStore } = await import("../server/lib/db.mjs");
      const db = openDatabase(path.join(dataDir, "destekofis.sqlite"));
      const store = createStore(db);
      const local = JSON.parse(store.setting("license.local"));
      store.setSetting("license.local", JSON.stringify({ ...local, highWater: T0 }));
      db.close();
      const second = await start({ dataDir });
      assert.equal(second.app.license.summary({ role: "admin" }).tampered, true);
      const audit = await (await loginAdmin(second)).get("/api/admin/audit?type=license.tamper");
      assert.equal(audit.data.data.length, 1);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("salt okunur modda yazma yetkileri gizlenir, okuma yetkileri kalır", () => {
    assert.ok(WRITE_PERMISSIONS.includes("records.create"));
    assert.ok(!WRITE_PERMISSIONS.includes("users.manage"));
    assert.ok(!WRITE_PERMISSIONS.includes("reports.view"));
  });
});
