// 2.4.7 M2: karekodlu cihaz eşleme, program başına eşli cihaz sınırı ve uzaktan erişimin program tarafındaki güvenlik sınırları
// (lib/mobile-remote.mjs; docs/mobil/M2-TASARIM.md; kullanıcı kararları P1–P13 docs/2.4.7-IS-LISTESI.md "KARARLAR — M2").
// Her denetim yeni davranışın varlığını iddia eder; eski kodda (uzak dinleyici yok → tünel doğrudan programın portuna bağlı) kırmızıdır.
// Saat: uzaktan erişimin saati sahte ve SABİT (config.remoteNow; ders 13, 22) — gerçek takvim gününe bağlı değil.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { normalizeClaims } from "../server/lib/license-token.mjs";
import * as http from "../server/lib/http.mjs";
import { isLocalAddress } from "../server/lib/auth.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { createPhone, rawRequest, remoteBase } from "./mobil-uzak-ortak.mjs";
import { DEVICE_COOKIE, REMOTE_SESSION_COOKIE } from "../server/lib/mobile-remote.mjs";

const PASSWORD = "Personel-2026!";
const T0 = "2026-11-30T23:58:00+03:00"; // ay sonu + gece yarısına 2 dk (karekod süresi gün ve ay dönümünü geçer)
const MIN = 60_000;

async function setup(options = {}) {
  const server = await startTestServer({ remoteNow: { time: T0, fixed: true }, ...options });
  const remote = await remoteBase(server);
  const admin = await loginAdmin(server);
  const clock = server.app.config.remoteNow;
  const usersById = async () => Object.fromEntries((await admin.get("/api/admin/users")).data.data.map(user => [user.username, user.id]));
  const ctx = {
    server,
    admin,
    clock,
    base: remote.base,
    legacy: remote.legacy,
    advance: ms => clock.advance?.(ms),
    async user(username, role = "personel") {
      await createUser(server, admin, { username, role, password: PASSWORD });
      return (await usersById())[username];
    },
    adminId: async () => (await usersById()).admin,
    allow: (userId, remote = true) => admin.put(`/api/admin/mobile/access/${userId}`, { remote }),
    code: userId => admin.post("/api/admin/mobile/codes", { userId }),
    devices: async () => (await admin.get("/api/admin/mobile/devices")).data?.data,
    remove: id => admin.del(`/api/admin/mobile/devices/${id}`),
    phone: options2 => createPhone(remote.base, options2),
    // Eşli ve girişli telefon (adım adım; her adımın yanıtı denetlenir — ders 3).
    async paired(userId, username, password = PASSWORD, options2 = {}) {
      const code = await ctx.code(userId);
      assert.equal(code.status, 200, `karekod üretilemedi: ${JSON.stringify(code.data)}`);
      const phone = ctx.phone(options2);
      const pair = await phone.pair(code.data.data.code);
      assert.equal(pair.status, 200, `eşleme reddedildi: ${pair.text}`);
      const login = await phone.login(username, password);
      assert.equal(login.status, 200, `uzak giriş reddedildi: ${login.text}`);
      return phone;
    },
  };
  return ctx;
}

describe("M2 uzak dinleyici: eşlenmemiş istemci (tünelin öbür ucu) hiçbir veri ve yerel işlem alamaz", () => {
  it("eşli cihaz yoksa: /api/companies, /api/auth/me, yerel kurtarma kodu ve mobil uçlar reddedilir (127.0.0.1'den gelse de)", async () => {
    const ctx = await setup();
    try {
      const stranger = ctx.phone();
      const spoof = { "x-forwarded-for": "127.0.0.1", "x-real-ip": "127.0.0.1" };
      const code = await stranger.post("/api/auth/recovery/local-code", {}, { headers: spoof });
      assert.notEqual(code.status, 200, `uzaktan sunucu kurtarma kodu üretilmemeli (gelen ${code.status} ${code.text.slice(0, 80)})`);
      const seen = [];
      for (const path of ["/api/companies", "/api/auth/me", "/api/auth/recovery", "/api/mobil/session", "/api/mobil/cash"]) seen.push(`${path} ${(await stranger.get(path, { headers: spoof })).code}`);
      assert.deepEqual(seen, ["/api/companies", "/api/auth/me", "/api/auth/recovery", "/api/mobil/session", "/api/mobil/cash"].map(path => `${path} remote-device`), "eşli cihaz olmadan her uç 'cihaz yok' ile reddedilmeli");
      // Uzak giriş denemesi yerel kullanıcıyı kilitlemez (P12): eski düzende tünelin bütün istekleri 127.0.0.1'den geldiği için IP sayacı herkesi kilitliyordu.
      for (let i = 0; i < 25; i += 1) await stranger.post("/api/auth/login", { username: "admin", password: "Yanlis-Parola-1" }, { headers: spoof });
      const local = ctx.server.client();
      assert.equal((await local.login("admin", ADMIN_PASSWORD)).status, 200, "uzaktaki 25 hatalı deneme ofisteki yöneticiyi kilitlememeli");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("M2 uzak dinleyici: güven sınırı (yol beyaz listesi, 'yerel' taklidi)", () => {
  let ctx;
  let phone;
  before(async () => {
    ctx = await setup();
    const adminId = await ctx.adminId();
    await ctx.allow(adminId);
    phone = await ctx.paired(adminId, "admin", ADMIN_PASSWORD);
  });
  after(() => ctx?.server.close());

  it("yalnız /mobil/ ve /api/mobil/ geçer: kodlanmış .., ters bölü, çift bölü, büyük harf, önek hilesi, kurtarma yolu 404 remote-path", async () => {
    const forbidden = [
      "/api/companies", "/api/auth/me", "/api/auth/login", "/api/auth/recovery/local-code", "/admin.html", "/", "//api/companies",
      "/api/mobil/../companies", "/api/mobil/%2e%2e/companies", "/api/mobil/%252e%252e/companies", "/mobil/..%2f..%2fapi/companies",
      "/api/mobil\\..\\companies", "/API/MOBIL/session", "/api/mobilx/session", "/mobil-eski/index.html", "/api/workspace/cash", "/api/mobil/./session",
    ];
    const seen = [];
    for (const path of forbidden) {
      const response = await phone.get(path);
      seen.push(`${path} → ${response.status} ${response.code}`);
    }
    assert.deepEqual(seen, forbidden.map(path => `${path} → 404 remote-path`), "uzaktan yasak yollar reddedilmeli");
    const allowed = await phone.get("/api/mobil/session");
    assert.equal(allowed.status, 200, `izinli yol açılmalı: ${allowed.text}`);
  });

  it("uzak istek 127.0.0.1'den gelse de yerel sayılmaz: kurtarma kodu ve X-Forwarded-For taklidi işe yaramaz", async () => {
    const spoof = { "x-forwarded-for": "127.0.0.1", "x-real-ip": "127.0.0.1", host: "127.0.0.1:3000" };
    const code = await phone.post("/api/auth/recovery/local-code", {}, { headers: spoof });
    assert.notEqual(code.status, 200, "uzaktan sunucu kurtarma kodu üretilmemeli");
    assert.equal(code.code, "remote-path");
    const viaMobile = await phone.post("/api/mobil/../auth/recovery/local-code", {}, { headers: spoof });
    assert.equal(viaMobile.status, 404);
    // Kurtarma durumu ucu (yalnız ana dinleyicide) yerelden "local: true" der; uzak dinleyicide yol kapalı.
    const status = await phone.get("/api/auth/recovery", { headers: spoof });
    assert.equal(status.code, "remote-path");
  });

  it("savunma derinliği: uzak işaretli istekte clientIp 'uzak' (127.0.0.1 ve X-Forwarded-For olsa da) → yerel sayılmaz", () => {
    assert.equal(typeof http.isRemoteRequest, "function", "uzak istek işareti yok");
    const req = { [http.REMOTE_REQUEST]: true, socket: { remoteAddress: "127.0.0.1" }, headers: { "x-forwarded-for": "127.0.0.1" } };
    assert.equal(http.clientIp(req, true), "uzak");
    assert.equal(isLocalAddress(http.clientIp(req, true)), false);
    assert.equal(http.clientIp({ socket: { remoteAddress: "127.0.0.1" }, headers: {} }), "127.0.0.1", "yerel istek değişmez");
  });

  it("uzak oturum cihaza bağlı: başka cihazın çereziyle aynı oturum geçmez", async () => {
    const veliId = await ctx.user("veli-bag");
    await ctx.allow(veliId);
    const veli = await ctx.paired(veliId, "veli-bag");
    const mixed = await rawRequest(ctx.base, "GET", "/api/mobil/session", { headers: { cookie: `${DEVICE_COOKIE}=${phone.jar.get(DEVICE_COOKIE)}; ${REMOTE_SESSION_COOKIE}=${veli.jar.get(REMOTE_SESSION_COOKIE)}` } });
    assert.equal(mixed.status, 401, "başka cihazın oturumu bu cihazda geçmemeli");
    assert.equal(mixed.code, "remote-session");
    assert.equal((await veli.get("/api/mobil/session")).status, 200, "oturum kendi cihazında sürer");
    const view = await ctx.devices();
    await ctx.remove(view.devices.find(device => device.userId === veliId).id);
  });

  it("uzak oturum çerezi ofis ağı dinleyicisinde, ofisin hof_session çerezi uzak dinleyicide geçmez", async () => {
    const mobileCookie = phone.jar.get(REMOTE_SESSION_COOKIE);
    assert.ok(mobileCookie, "uzak girişte uzak oturum çerezi verilmeli");
    const onLan = await rawRequest(ctx.server.base, "GET", "/api/auth/me", { headers: { cookie: `hof_session=${mobileCookie}; ${REMOTE_SESSION_COOKIE}=${mobileCookie}` } });
    assert.equal(onLan.status, 401, "uzak oturum belirteci ofis ağında oturum açmamalı");
    const lanCookie = ctx.admin.cookie;
    const stranger = ctx.phone();
    stranger.jar.set(DEVICE_COOKIE, phone.jar.get(DEVICE_COOKIE));
    const withLan = await stranger.get("/api/mobil/session", { headers: { cookie: `${DEVICE_COOKIE}=${phone.jar.get(DEVICE_COOKIE)}; ${lanCookie}` } });
    assert.equal(withLan.status, 401, "ofisin yerel oturumu uzaktan geçmemeli");
    assert.equal(withLan.code, "remote-session");
  });

  it("başka siteden gelen uzak eşleme / giriş isteği reddedilir (Origin denetimi; çerezler SameSite=Strict)", async () => {
    const foreign = await phone.post("/api/mobil/session/login", { username: "admin", password: ADMIN_PASSWORD }, { headers: { origin: "https://saldirgan.example" } });
    assert.equal(foreign.status, 403);
    const pairForeign = await ctx.phone().post("/api/mobil/eslesme", { kod: "x" }, { headers: { origin: "https://saldirgan.example" } });
    assert.equal(pairForeign.status, 403);
    const flags = String(phone.jar.size && (await phone.login("admin", ADMIN_PASSWORD)).headers["set-cookie"]);
    assert.match(flags, /HttpOnly/);
    assert.match(flags, /SameSite=Strict/);
  });

  it("mobilde yazma yok: uzak yazma isteği 405 (M5'e kadar)", async () => {
    const write = await phone.post("/api/mobil/cash", { amount: 1 });
    assert.equal(write.status, 405);
    assert.equal(write.code, "mobile-read-only");
  });
});

describe("M2 eşleme: karekod (P1 5 dk, tek kullanım, P2), yalnız yönetici, uzak izin", () => {
  let ctx;
  let aliId;
  before(async () => {
    ctx = await setup();
    aliId = await ctx.user("ali");
  });
  after(() => ctx?.server.close());

  it("uzak izni olmayana karekod yok (403 remote-permission); personel karekod üretemez (403)", async () => {
    const denied = await ctx.code(aliId);
    assert.equal(denied.status, 403);
    assert.equal(denied.data.code, "remote-permission");
    await ctx.allow(aliId);
    const staff = ctx.server.client();
    await staff.login("ali", PASSWORD);
    const byStaff = await staff.post("/api/admin/mobile/codes", { userId: aliId });
    assert.equal(byStaff.status, 403, "yönetici olmayan karekod üretmemeli");
    const list = await staff.get("/api/admin/mobile/devices");
    assert.equal(list.status, 403);
  });

  it("P1: karekod 4 dk 59 sn'de geçer, tam 5. dakikada (gece yarısı ve ay dönümünde) geçmez", async () => {
    ctx.clock.set(T0);
    const late = await ctx.code(aliId);
    assert.equal(late.status, 200);
    ctx.advance(5 * MIN);
    const expired = await ctx.phone().pair(late.data.data.code);
    assert.equal(expired.status, 400, "süresi dolan karekod reddedilmeli");
    assert.equal(expired.data.code, "remote-code");
    ctx.clock.set(T0);
    const fresh = await ctx.code(aliId);
    ctx.advance(5 * MIN - 1000);
    const ok = await ctx.phone().pair(fresh.data.data.code);
    assert.equal(ok.status, 200, `süresi içindeki karekod geçmeli: ${ok.text}`);
    // Tek kullanım: aynı kod ikinci cihazda geçmez.
    const again = await ctx.phone().pair(fresh.data.data.code);
    assert.equal(again.status, 400);
    assert.equal(again.data.code, "remote-code");
    const cleanup = await ctx.devices();
    for (const device of cleanup.devices) await ctx.remove(device.id);
  });

  it("P2: aynı kişiye yeni karekod öncekini geçersiz kılar", async () => {
    const first = await ctx.code(aliId);
    const second = await ctx.code(aliId);
    const old = await ctx.phone().pair(first.data.data.code);
    assert.equal(old.status, 400, "eski karekod geçersiz olmalı");
    const current = await ctx.phone().pair(second.data.data.code);
    assert.equal(current.status, 200);
  });

  it("karekodun içeriği uzak adres + #eslesme=<kod> (kod adres satırının # kısmında; sunucuya gitmez); veri tabanında kod düz metin değil", async () => {
    ctx.server.app.mobileRemote.setPublicUrl("https://ofis-ornek.destekofis.net/");
    const result = await ctx.code(aliId);
    assert.equal(result.data.data.url, `https://ofis-ornek.destekofis.net/mobil/#eslesme=${result.data.data.code}`);
    assert.match(result.data.data.qr, /^<svg /);
    const rows = ctx.server.app.store.all("SELECT code_hash FROM mobile_codes");
    assert.ok(rows.length > 0 && rows.every(row => row.code_hash !== result.data.data.code && /^[0-9a-f]{64}$/.test(row.code_hash)));
  });
});

describe("P14 eşleme bağlantısı (karekod okuyamayan uzak bilgisayar): aynı tek kullanımlık kod, aynı kurallar", () => {
  it("bağlantı = uzak adres/mobil/#eslesme=<kod>; tarayıcıda açılan sayfa çerezsiz gelir, kod # kısmında (istek satırında yok); uzak bilgisayar eşlenir; tek kullanım, P2, P4", async () => {
    const ctx = await setup();
    try {
      ctx.server.app.mobileRemote.setPublicUrl(ctx.base);
      const veliId = await ctx.user("veli");
      await ctx.allow(veliId);
      const first = await ctx.code(veliId);
      assert.equal(first.status, 200);
      const link = new URL(first.data.data.url);
      assert.equal(`${link.origin}${link.pathname}`, `${ctx.base}/mobil/`, "bağlantı uzak adresin /mobil/ sayfası");
      assert.match(link.hash, /^#eslesme=[A-Za-z0-9_-]{16,}$/, "kod adresin # kısmında");
      assert.equal(link.search, "", "kod sorgu dizgesinde değil (sunucu günlüğü, Referer)");
      // Tarayıcının sunucuya gönderdiği istek satırı # kısmını taşımaz: sayfa çerezsiz açılır.
      const pc = ctx.phone({ name: "Ofis Dışı Bilgisayar", kind: "tarayici" });
      const page = await pc.get(link.pathname);
      assert.equal(page.status, 200, "eşleme sayfası açılır");
      // P2: aynı kişiye yeni kod üretilince eski bağlantı geçersiz.
      const second = await ctx.code(veliId);
      const code2 = new URL(second.data.data.url).hash.slice("#eslesme=".length);
      assert.equal(code2, second.data.data.code, "bağlantıdaki kod karekoddakiyle aynı");
      assert.equal((await pc.pair(link.hash.slice("#eslesme=".length))).code, "remote-code", "eski bağlantı geçersiz (P2)");
      const paired = await pc.pair(code2);
      assert.equal(paired.status, 200, paired.text);
      assert.equal((await pc.login("veli", PASSWORD)).status, 200);
      assert.equal((await pc.get("/api/mobil/session")).status, 200);
      const device = (await ctx.devices()).devices.find(item => item.userId === veliId);
      assert.equal(device.kind, "tarayici");
      assert.equal(device.kindLabel, "Uzak Tarayıcı");
      assert.equal((await ctx.phone().pair(code2)).code, "remote-code", "bağlantı tek kullanımlık");
      // P4: sınır doluyken bağlantı da üretilmez (aynı uç).
      for (const name of ["ali", "ayse"]) {
        const id = await ctx.user(name);
        await ctx.allow(id);
        await ctx.paired(id, name);
      }
      const full = await ctx.code(veliId);
      assert.equal(full.status, 409);
      assert.equal(full.data.code, "remote-limit");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("M2 sınır: program başına 3 eşli cihaz, iki şirket birlikte (P3, P4, P5); silince yer açılır", () => {
  let ctx;
  const ids = {};
  before(async () => {
    ctx = await setup();
    const company = await ctx.admin.post("/api/companies", { name: "İkinci Şirket" });
    assert.equal(company.status, 200, JSON.stringify(company.data));
    const second = company.data.data.company.id;
    for (const name of ["ali", "veli", "ayse", "fatma"]) {
      ids[name] = await ctx.user(name);
      await ctx.allow(ids[name]);
    }
    // ali ve ayşe yalnız 002'yi, veli işaretsiz (001) görür: cihazlar şirket başına değil program başına sayılır.
    await ctx.admin.put(`/api/companies/access/${ids.ali}`, { companies: [second] });
    await ctx.admin.put(`/api/companies/access/${ids.ayse}`, { companies: [second] });
  });
  after(() => ctx?.server.close());

  it("telefon + tablet + uzak tarayıcı (iki şirketin kullanıcıları) = 3; 4. karekod üretilmez (P4), elde kalan kodla eşleme reddedilir (P3) ve kod harcanmaz", async () => {
    const pending = await ctx.code(ids.fatma); // sınır dolmadan alınmış kod
    assert.equal(pending.status, 200);
    await ctx.paired(ids.ali, "ali", PASSWORD, { kind: "telefon" });
    await ctx.paired(ids.veli, "veli", PASSWORD, { kind: "tablet" });
    await ctx.paired(ids.ayse, "ayse", PASSWORD, { kind: "tarayici" });
    const view = await ctx.devices();
    assert.equal(view.used, 3);
    assert.equal(view.full, true);
    const fourthCode = await ctx.code(ids.fatma);
    assert.equal(fourthCode.status, 409, "sınır doluyken karekod üretilmemeli");
    assert.equal(fourthCode.data.code, "remote-limit");
    const fourth = ctx.phone();
    const rejected = await fourth.pair(pending.data.data.code);
    assert.equal(rejected.status, 409, `4. cihaz reddedilmeli: ${rejected.text}`);
    assert.equal(rejected.data.code, "remote-limit");
    assert.equal((await ctx.devices()).used, 3, "ret sonrası sayı değişmez");
    // Yer açılınca aynı (harcanmamış) kod geçer.
    const veliDevice = view.devices.find(device => device.username === "veli");
    assert.equal((await ctx.remove(veliDevice.id)).status, 200);
    const accepted = await fourth.pair(pending.data.data.code);
    assert.equal(accepted.status, 200, `yer açılınca eşleme geçmeli: ${accepted.text}`);
    assert.equal((await ctx.devices()).used, 3);
  });

  it("aynı anda iki eşleme son yer için: yalnız biri kazanır", async () => {
    const view = await ctx.devices();
    await ctx.remove(view.devices[0].id);
    const a = await ctx.code(ids.veli);
    const b = await ctx.code(ids.ali);
    const [first, second] = await Promise.all([ctx.phone().pair(a.data.data.code), ctx.phone().pair(b.data.data.code)]);
    assert.deepEqual([first.status, second.status].sort(), [200, 409], `${first.text} | ${second.text}`);
    assert.equal((await ctx.devices()).used, 3);
  });

  it("P5: lisanstaki sayı mevcudun altına düşerse eşli cihazlar sürer, yalnız yeni eşleme engellenir; sayı alanı belirteçten okunur (yoksa 3)", async () => {
    const license = ctx.server.app.license;
    const original = license.mobileDeviceLimit;
    try {
      license.mobileDeviceLimit = () => 2;
      const view = await ctx.devices();
      assert.equal(view.limit, 2);
      assert.equal(view.used, 3, "fazla cihaz silinmez");
      const code = await ctx.code(ids.fatma);
      assert.equal(code.status, 409);
    } finally {
      license.mobileDeviceLimit = original;
    }
    assert.equal(normalizeClaims({ schema: 1, product: "DestekOfis", type: "license-token", kind: "license", licenseId: "LIS-1", machine: "0123456789abcdef0123456789abcdef", issuedAt: "2026-10-01T00:00:00Z", expiresAt: null, mobileDevices: 5 }).mobileDevices, 5);
    assert.equal(normalizeClaims({ schema: 1, product: "DestekOfis", type: "license-token", kind: "license", licenseId: "LIS-1", machine: "0123456789abcdef0123456789abcdef", issuedAt: "2026-10-01T00:00:00Z", expiresAt: null, mobileDevices: -1 }).mobileDevices, undefined);
    assert.equal(license.mobileDeviceLimit(), 3, "belirteçte alan yoksa 3");
  });
});

describe("M2 silme, izin, kullanıcı: erişim HEMEN kesilir", () => {
  let ctx;
  let aliId;
  let veliId;
  before(async () => {
    ctx = await setup();
    aliId = await ctx.user("ali");
    veliId = await ctx.user("veli");
    await ctx.allow(aliId);
    await ctx.allow(veliId);
  });
  after(() => ctx?.server.close());

  it("cihaz silinince açık uzak oturumu sonraki istekte düşer (sayfa dosyası dahil); yeniden eşleme gerekir", async () => {
    const phone = await ctx.paired(aliId, "ali");
    assert.equal((await phone.get("/api/mobil/session")).status, 200);
    const view = await ctx.devices();
    await ctx.remove(view.devices.find(device => device.username === "ali").id);
    const after1 = await phone.get("/api/mobil/session");
    assert.equal(after1.status, 401, "silinen cihazın oturumu sürmemeli");
    assert.equal(after1.code, "remote-device");
    const page = await phone.get("/mobil/index.html", { headers: { cookie: `${DEVICE_COOKIE}=${phone.jar.get(DEVICE_COOKIE) || "x"}` } });
    assert.equal(ctx.server.app.store.get("SELECT COUNT(*) AS n FROM mobile_sessions WHERE user_id = ?", aliId).n, 0, "oturum satırı silinmeli");
    assert.ok([200, 401].includes(page.status));
  });

  it("uzak izin kalkınca kişinin bütün cihazları, oturumları ve bekleyen karekodu düşer; başkası etkilenmez", async () => {
    const one = await ctx.paired(aliId, "ali", PASSWORD, { kind: "telefon" });
    const two = await ctx.paired(aliId, "ali", PASSWORD, { kind: "tablet" });
    const pending = await ctx.code(aliId); // 2/3 iken alınır (3/3'te karekod üretilmez — P4)
    assert.equal(pending.status, 200);
    const other = await ctx.paired(veliId, "veli");
    const revoke = await ctx.allow(aliId, false);
    assert.equal(revoke.status, 200);
    assert.equal(revoke.data.data.revokedDevices, 2);
    for (const phone of [one, two]) assert.equal((await phone.get("/api/mobil/session")).code, "remote-device");
    assert.equal((await other.get("/api/mobil/session")).status, 200, "başka kullanıcının cihazı sürer");
    await ctx.allow(aliId, true);
    const late = await ctx.phone().pair(pending.data.data.code);
    assert.equal(late.status, 400, "izin kalkarken bekleyen karekod da geçersiz olmalı");
  });

  it("kullanıcı silinince cihazı silinir (yer açılır); pasifleşince uzak oturumu kapanır", async () => {
    const before1 = (await ctx.devices()).used;
    const phone = await ctx.paired(veliId, "veli", PASSWORD, { kind: "tablet" });
    assert.equal((await ctx.devices()).used, before1 + 1);
    await ctx.admin.patch(`/api/admin/users/${veliId}`, { active: false });
    assert.equal((await phone.get("/api/mobil/session")).status, 401);
    await ctx.admin.patch(`/api/admin/users/${veliId}`, { active: true });
    assert.equal((await ctx.admin.del(`/api/admin/users/${veliId}`)).status, 200);
    assert.equal((await ctx.devices()).devices.filter(device => device.userId === veliId).length, 0);
    assert.equal((await phone.get("/api/mobil/session")).code, "remote-device");
  });
});

describe("M2 giriş: cihaza bağlı (P6), imza, deneme sınırı kullanıcı başına (P11–P13), oturum ömrü (P7, P8)", () => {
  let ctx;
  let aliId;
  let veliId;
  let aliPhone;
  before(async () => {
    ctx = await setup();
    aliId = await ctx.user("ali");
    veliId = await ctx.user("veli");
    await ctx.allow(aliId);
    await ctx.allow(veliId);
    aliPhone = await ctx.paired(aliId, "ali");
  });
  after(() => ctx?.server.close());

  it("P6: cihazdan yalnız eşlendiği kullanıcı girer; imzasız ya da yeniden oynatılan meydan okuma reddedilir", async () => {
    const other = await aliPhone.login("veli", PASSWORD);
    assert.equal(other.status, 403);
    assert.equal(other.code, "remote-device-user");
    const unsigned = await aliPhone.login("ali", PASSWORD, { proof: false });
    assert.equal(unsigned.status, 401);
    assert.equal(unsigned.code, "remote-proof");
    const challenge = await aliPhone.get("/api/mobil/session/challenge");
    const { nonce, device } = challenge.data.data;
    const signature = aliPhone.sign(device, nonce);
    assert.equal((await aliPhone.post("/api/mobil/session/login", { username: "ali", password: PASSWORD, nonce, signature })).status, 200);
    const replay = await aliPhone.post("/api/mobil/session/login", { username: "ali", password: PASSWORD, nonce, signature });
    assert.equal(replay.code, "remote-proof", "aynı meydan okuma ikinci kez geçmemeli");
    // Başka cihazın anahtarıyla imza geçmez.
    const foreign = ctx.phone();
    const c2 = await aliPhone.get("/api/mobil/session/challenge");
    const forged = await aliPhone.post("/api/mobil/session/login", { username: "ali", password: PASSWORD, nonce: c2.data.data.nonce, signature: foreign.sign(c2.data.data.device, c2.data.data.nonce) });
    assert.equal(forged.code, "remote-proof");
  });

  it("P11–P13: 5. yanlış parola kilitler (o deneme 'parola yanlış'), kilitliyken doğru parola da reddedilir, 15 dk sonra açılır; yerel giriş ve başka kullanıcı etkilenmez", async () => {
    ctx.clock.set(T0);
    const codes = [];
    for (let i = 0; i < 5; i += 1) codes.push((await aliPhone.login("ali", "Yanlis-Parola-1")).code);
    assert.deepEqual(codes, Array(5).fill("remote-password"));
    const locked = await aliPhone.login("ali", PASSWORD);
    assert.equal(locked.status, 429);
    assert.equal(locked.code, "remote-locked");
    const local = ctx.server.client();
    assert.equal((await local.login("ali", PASSWORD)).status, 200, "uzaktaki denemeler ofisteki girişi kilitlememeli (P12)");
    const veliPhone = await ctx.paired(veliId, "veli");
    assert.equal((await veliPhone.get("/api/mobil/session")).status, 200);
    ctx.advance(15 * MIN - 1000);
    assert.equal((await aliPhone.login("ali", PASSWORD)).code, "remote-locked");
    ctx.advance(1000);
    assert.equal((await aliPhone.login("ali", PASSWORD)).status, 200, "kilit 15 dk sonra açılmalı");
  });

  it("parolası doğru ama uzak izni olmayan giriş sayılmaz; başarılı giriş sayacı sıfırlar", async () => {
    ctx.clock.set(T0);
    for (let i = 0; i < 4; i += 1) await aliPhone.login("ali", "Yanlis-Parola-1");
    assert.equal((await aliPhone.login("ali", PASSWORD)).status, 200);
    for (let i = 0; i < 4; i += 1) assert.equal((await aliPhone.login("ali", "Yanlis-Parola-1")).code, "remote-password");
    assert.equal((await aliPhone.login("ali", PASSWORD)).status, 200, "başarılı giriş sayacı sıfırlamış olmalı");
  });

  it("P7: 15 dk işlem yoksa oturum kapanır (14:59 geçer); P8: işlem sürse de en çok 12 saat", async () => {
    ctx.clock.set(T0);
    assert.equal((await aliPhone.login("ali", PASSWORD)).status, 200);
    ctx.advance(15 * MIN - 1000);
    assert.equal((await aliPhone.get("/api/mobil/session")).status, 200, "14:59'da oturum açık");
    ctx.advance(15 * MIN);
    const idle = await aliPhone.get("/api/mobil/session");
    assert.equal(idle.status, 401);
    assert.equal(idle.code, "remote-session");
    ctx.clock.set(T0);
    assert.equal((await aliPhone.login("ali", PASSWORD)).status, 200);
    for (let minute = 10; minute < 12 * 60; minute += 10) {
      ctx.clock.set(Date.parse(T0) + minute * MIN);
      assert.equal((await aliPhone.get("/api/mobil/session")).status, 200, `${minute}. dakikada açık olmalı`);
    }
    ctx.clock.set(Date.parse(T0) + 12 * 60 * MIN);
    assert.equal((await aliPhone.get("/api/mobil/session")).code, "remote-session", "12. saatte kapanmalı");
  });
});

describe("M2 şirket erişimi ve lisans", () => {
  it("mobilde şirket kuralı aynı: işaretli şirket, işaretsiz yalnız 001, yönetici hepsi, olmayan şirket 409", async () => {
    const ctx = await setup();
    try {
      const company = await ctx.admin.post("/api/companies", { name: "İkinci Şirket" });
      const second = company.data.data.company.id;
      const first = (await ctx.admin.get("/api/companies")).data.data.companies.find(item => item.code === "001").id;
      const aliId = await ctx.user("ali", "muhasebe");
      const veliId = await ctx.user("veli", "muhasebe");
      await ctx.admin.put(`/api/companies/access/${aliId}`, { companies: [second] });
      for (const id of [aliId, veliId, await ctx.adminId()]) await ctx.allow(id);
      const ali = await ctx.paired(aliId, "ali");
      const veli = await ctx.paired(veliId, "veli");
      const boss = await ctx.paired(await ctx.adminId(), "admin", ADMIN_PASSWORD);
      const cash = (phone, company2) => phone.get(`/api/mobil/cash?company=${company2}`);
      assert.deepEqual([(await cash(ali, second)).status, (await cash(ali, first)).code], [200, "company-forbidden"]);
      assert.deepEqual([(await cash(veli, first)).status, (await cash(veli, second)).code], [200, "company-forbidden"]);
      assert.deepEqual([(await cash(boss, first)).status, (await cash(boss, second)).status], [200, 200]);
      assert.equal((await cash(boss, "sirket-003-yok")).code, "company-missing");
      // Ortak katman ucunda da (oturum özeti) şirket denetimi mobil katmanda: görmediği şirket 403, olmayan şirket 409.
      assert.equal((await ali.get(`/api/mobil/session?company=${first}`)).code, "company-forbidden");
      assert.equal((await veli.get("/api/mobil/session?company=sirket-003-yok")).code, "company-missing");
      assert.equal((await veli.get(`/api/mobil/session?company=${first}`)).status, 200);
      // ANLIK DURUM yalnız yönetici.
      assert.equal((await veli.get(`/api/mobil/overview?company=${first}`)).status, 403);
      assert.equal((await boss.get(`/api/mobil/overview?company=${first}`)).status, 200);
    } finally {
      await ctx.server.close();
    }
  });

  it("lisans geçersizken (salt okunur) uzaktan hiçbir istek geçmez, karekod üretilmez; eşleme silinmez", async () => {
    const ctx = await setup({ license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef" } });
    try {
      assert.equal(ctx.server.app.license.status().writable, false, "ön koşul: etkinleştirilmemiş kurulum salt okunur");
      const adminId = await ctx.adminId();
      const allow = await ctx.allow(adminId);
      assert.equal(allow.status, 200, "izin lisanstan bağımsız verilir (yönetim)");
      const code = await ctx.code(adminId);
      assert.equal(code.status, 403);
      assert.equal(code.data.code, "remote-license");
      const page = await ctx.phone().get("/mobil/index.html");
      assert.equal(page.status, 403);
      assert.equal(page.code, "remote-license");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("M2 ortak katman: yedekten geri yükleme cihazı geri getirmez", () => {
  it("001 yedeği geri yüklense de silinmiş cihaz ve kaldırılmış uzak izin canlıdaki gibi kalır (COMMON_TABLES)", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "mobil-eslesme-247-yedek-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } };
    let cur = await bootVersion(CURRENT, dirs);
    try {
      const api = await cur.login();
      const raw = cur.app.listenRemote ? await cur.app.listenRemote(0, "127.0.0.1") : null;
      const base = raw ? `http://127.0.0.1:${raw.port}` : cur.base;
      const adminId = (await api.get("/api/admin/users")).data.find(user => user.username === "admin").id;
      await api.put(`/api/admin/mobile/access/${adminId}`, { remote: true });
      const code = await api.post("/api/admin/mobile/codes", { userId: adminId });
      const phone = createPhone(base);
      const paired = await phone.pair(code.data?.code || "");
      assert.equal(paired.status, 200, `eşleme: ${paired.text}`);
      const backup = await api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
      await api.del(`/api/admin/mobile/devices/${phone.deviceId}`);
      await api.put(`/api/admin/mobile/access/${adminId}`, { remote: false });
      const staged = await api.post("/api/admin/backups/restore", { name: backup.data.name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(staged.data.staged, true, JSON.stringify(staged.data));
      await cur.close();
      cur = await bootVersion(CURRENT, dirs);
      assert.equal(cur.app.stagedRestore?.ok, true, JSON.stringify(cur.app.stagedRestore));
      const after1 = await cur.login();
      const view = (await after1.get("/api/admin/mobile/devices")).data;
      assert.equal(view.used, 0, "silinmiş cihaz eski yedekle geri gelmemeli");
      assert.equal(view.users.find(user => user.username === "admin").remote, false, "kaldırılmış izin geri gelmemeli");
      const address = await cur.app.listenRemote(0, "127.0.0.1");
      phone.base = `http://127.0.0.1:${address.port}`;
      assert.equal((await phone.get("/mobil/index.html")).code, "remote-device", "eski cihaz çerezi geçmemeli");
    } finally {
      await cur?.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
