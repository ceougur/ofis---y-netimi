import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

describe("kimlik doğrulama", () => {
  let server;
  before(async () => {
    server = await startTestServer();
  });
  after(() => server.close());

  it("sağlık ucu oturumsuz çalışır ve sürümü döndürür", async () => {
    const result = await server.client().get("/api/health");
    assert.equal(result.status, 200);
    assert.equal(result.data.data.status, "ok");
    assert.equal(result.data.data.version, server.app.config.version);
  });

  it("doğru parolayla giriş yapar, yetkileri döndürür", async () => {
    const client = server.client();
    const login = await client.login("admin", ADMIN_PASSWORD);
    assert.equal(login.status, 200);
    assert.ok(client.cookie.startsWith("hof_session="));
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /SameSite=Lax/);
    const me = await client.get("/api/auth/me");
    assert.equal(me.data.data.role, "admin");
    assert.ok(me.data.data.permissions.includes("users.manage"));
    assert.equal(me.data.data.product.name, "DestekOfis");
  });

  it("kullanıcı adı büyük/küçük harf duyarsız eşleşir", async () => {
    const login = await server.client().login("ADMIN", ADMIN_PASSWORD);
    assert.equal(login.status, 200);
  });

  it("hatalı parolada 401, 5 denemeden sonra 429 döner", async () => {
    const client = server.client();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await client.login("kilitlenecek", "yanlis-parola-1");
      assert.equal(result.status, 401);
    }
    const locked = await client.login("kilitlenecek", "yanlis-parola-1");
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers.get("retry-after")) > 0);
    assert.match(locked.data.error, /yöneticinizden parolanızı sıfırlamasını/);
  });

  it("yönetici parolayı sıfırlayınca kilit hemen kalkar", async () => {
    const admin = await loginAdmin(server);
    const created = await admin.post("/api/admin/users", { username: "Deneme1", name: "Deneme", role: "personel", password: "Ilk-Parola-2026", mustChangePassword: false });
    assert.equal(created.status, 200);
    const staff = server.client();
    for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await staff.login("deneme1", "yanlis-parola-9")).status, 401);
    assert.equal((await staff.login("DENEME1", "Ilk-Parola-2026")).status, 429, "doğru parola da kilit süresince reddedilir");
    const other = await server.client().login("kilitlenecek-degil", "yanlis");
    assert.equal(other.status, 401, "kilit yalnızca o kullanıcı adına uygulanır");
    const reset = await admin.post(`/api/admin/users/${created.data.data.id}/reset-password`, { password: "Yeni-Parola-2026", mustChangePassword: false });
    assert.equal(reset.status, 200);
    const login = await staff.login("deneme1", "Yeni-Parola-2026");
    assert.equal(login.status, 200, JSON.stringify(login.data));
  });

  it("oturumsuz korumalı uçlar 401 döner", async () => {
    const result = await server.client().get("/api/workspace/state");
    assert.equal(result.status, 401);
    assert.equal(result.data.code, "UNAUTHORIZED");
  });

  it("çıkış oturumu kapatır", async () => {
    const client = await loginAdmin(server);
    await client.post("/api/auth/logout");
    const me = await client.get("/api/auth/me");
    assert.equal(me.status, 401);
  });

  it("başka siteden gelen değiştirici istekleri reddeder", async () => {
    const client = await loginAdmin(server);
    const result = await client.post("/api/workspace/messages", { to: "x", message: "y" }, { origin: "http://kotu-site.example" });
    assert.equal(result.status, 403);
    const same = await client.post("/api/workspace/messages", { to: "x", message: "y" }, { origin: server.base });
    assert.equal(same.status, 200);
  });

  it("JSON olmayan gövdeyi reddeder", async () => {
    const client = await loginAdmin(server);
    const result = await client.post("/api/workspace/messages", "to=x&message=y", { "content-type": "application/x-www-form-urlencoded" });
    assert.equal(result.status, 415);
  });

  it("çok büyük gövdeyi 413 ile reddeder", async () => {
    const client = await loginAdmin(server);
    const result = await client.post("/api/workspace/messages", { to: "x", message: "a".repeat(1_100_000) });
    assert.equal(result.status, 413);
  });
});

describe("varsayılan parola zorunlu değişimi", () => {
  let server;
  before(async () => {
    server = await startTestServer({ adminPassword: "Ofis2026!" });
  });
  after(() => server.close());

  it("varsayılan parolayla açılan yönetici önce parolasını değiştirmek zorunda", async () => {
    const client = server.client();
    const login = await client.login("admin", "Ofis2026!");
    assert.equal(login.status, 200);
    assert.equal(login.data.data.mustChangePassword, true);
    const blocked = await client.get("/api/workspace/state");
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.code, "PASSWORD_CHANGE_REQUIRED");
    const rows = await client.get("/api/trpc/sheets.getRows?input=%7B%7D");
    assert.equal(rows.status, 401);

    const weak = await client.post("/api/auth/change-password", { currentPassword: "Ofis2026!", newPassword: "kisa" });
    assert.equal(weak.status, 400);
    const same = await client.post("/api/auth/change-password", { currentPassword: "Ofis2026!", newPassword: "Ofis2026!" });
    assert.equal(same.status, 400);

    const other = server.client();
    await other.login("admin", "Ofis2026!");

    const changed = await client.post("/api/auth/change-password", { currentPassword: "Ofis2026!", newPassword: "Yeni-Guclu-Parola-7" });
    assert.equal(changed.status, 200);
    const allowed = await client.get("/api/workspace/state");
    assert.equal(allowed.status, 200);
    const otherSession = await other.get("/api/auth/me");
    assert.equal(otherSession.status, 401, "diğer cihazdaki oturum kapatılmalı");
    const oldPassword = await server.client().login("admin", "Ofis2026!");
    assert.equal(oldPassword.status, 401);
  });
});

describe("ilk kurulum güvenliği", () => {
  let server;
  before(async () => {
    server = await startTestServer({ adminPassword: "Ofis2026!", env: { HUKUK_TRUST_PROXY: "1" } });
  });
  after(() => server.close());

  it("varsayılan parolayla ilk giriş yalnızca sunucu bilgisayarından yapılabilir", async () => {
    const remote = await server.client().post("/api/auth/login", { username: "admin", password: "Ofis2026!" }, { "x-forwarded-for": "192.168.1.44" });
    assert.equal(remote.status, 403);
    assert.equal(remote.data.code, "FIRST_LOGIN_LOCAL_ONLY");
    const local = await server.client().login("admin", "Ofis2026!");
    assert.equal(local.status, 200);
  });
});
