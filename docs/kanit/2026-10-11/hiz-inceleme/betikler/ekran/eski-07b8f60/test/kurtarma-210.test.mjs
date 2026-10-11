// v2.0.10: yönetici parolasını unutursa — kurtarma anahtarı ve sunucu bilgisayarından tek seferlik kod.
// Eski parola sorulmaz; yalnız aktif yönetici kurtarılır; kullanılan kod geçersizleşir; deneme sınırı vardır.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { LOCAL_FILE } from "../server/lib/recovery.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const KEY_FORMAT = /^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/;

describe("yönetici parolası kurtarma", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("anahtar yönetici tarafından oluşturulur; düz metin yalnız bir kez döner, programda özeti saklanır", async () => {
    const anon = server.client();
    assert.deepEqual((await anon.get("/api/auth/recovery")).data.data, { local: true, hasKey: false });
    assert.equal((await admin.get("/api/admin/recovery")).data.data.exists, false);
    const staff = await createUser(server, admin, { username: "personel1" });
    assert.equal((await staff.post("/api/admin/recovery", {})).status, 403, "personel anahtar oluşturamaz");
    const created = (await admin.post("/api/admin/recovery", {})).data.data;
    assert.match(created.key, KEY_FORMAT);
    assert.equal(created.exists, true);
    const stored = server.app.store.setting("auth.recovery", "");
    assert.ok(!stored.includes(created.key.replace(/-/g, "")), "anahtarın kendisi saklanmaz");
    assert.equal((await anon.get("/api/auth/recovery")).data.data.hasKey, true);
    const second = (await admin.post("/api/admin/recovery", {})).data.data.key;
    assert.notEqual(second, created.key);
    const old = await anon.post("/api/auth/recover", { username: "admin", code: created.key, newPassword: "Yeni-Parola-2026!" });
    assert.equal(old.status, 400, "yenilenince eski anahtar geçersiz");
  });

  it("anahtarla: eski parola sorulmadan yeni parola; doğrudan giriş; eski oturum ve parola geçersiz; yeni anahtar üretilir", async () => {
    const key = (await admin.post("/api/admin/recovery", {})).data.data.key;
    const anon = server.client();
    assert.equal((await anon.post("/api/auth/recover", { username: "admin", code: key, newPassword: "kisa" })).status, 400, "zayıf parola");
    assert.equal((await anon.post("/api/auth/recover", { username: "personel1", code: key, newPassword: "Personel-Yeni-2026!" })).status, 400, "personel kurtarılamaz");
    const done = await anon.post("/api/auth/recover", { username: "ADMIN", code: key.toLowerCase().replace(/-/g, " "), newPassword: "Kurtarildi-2026!" });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.data.method, "key");
    assert.match(done.data.data.newKey, KEY_FORMAT);
    assert.notEqual(done.data.data.newKey, key);
    const me = (await anon.get("/api/auth/me")).data.data;
    assert.equal(me.username, "admin");
    assert.equal(me.mustChangePassword, false, "parola değiştirme ekranı çıkmaz");
    assert.equal((await admin.get("/api/auth/me")).status, 401, "eski oturumlar kapanır");
    assert.equal((await server.client().login("admin", ADMIN_PASSWORD)).status, 401, "eski parola geçersiz");
    admin = server.client();
    assert.equal((await admin.login("admin", "Kurtarildi-2026!")).status, 200, "yeni parolayla girilir");
    assert.equal((await anon.post("/api/auth/recover", { username: "admin", code: key, newPassword: "Baska-Parola-2026!" })).status, 400, "kullanılan anahtar ikinci kez çalışmaz");
    const audit = (await admin.get("/api/admin/audit?type=auth.recover")).data.data;
    assert.ok(audit.some(event => event.type === "auth.recovered"), "işlem geçmişine yazılır");
  });

  it("sunucu bilgisayarından kod: veri klasörüne tek seferlik kod yazılır; kullanılınca dosya silinir", async () => {
    const anon = server.client();
    const created = await anon.post("/api/auth/recovery/local-code", {});
    assert.equal(created.status, 200);
    const file = path.join(server.dataDir, LOCAL_FILE);
    assert.equal(created.data.data.file, file);
    const text = readFileSync(file, "utf8");
    const code = /Kod: ([A-Z2-9]{5}-[A-Z2-9]{5})/.exec(text)?.[1];
    assert.ok(code, text);
    assert.equal((await anon.post("/api/auth/recovery/local-code", {})).status, 429, "art arda kod üretilmez");
    const done = await anon.post("/api/auth/recover", { code, newPassword: "Sunucudan-2026!x" });
    assert.equal(done.status, 200, "tek yönetici varken kullanıcı adı gerekmez");
    assert.equal(done.data.data.method, "local");
    assert.equal(done.data.data.newKey, null, "sunucu koduyla anahtar değişmez");
    assert.ok(!existsSync(file), "dosya silinir");
    assert.equal((await server.client().post("/api/auth/recover", { code, newPassword: "Tekrar-2026!xx" })).status, 400, "kod ikinci kez çalışmaz");
    admin = server.client();
    assert.equal((await admin.login("admin", "Sunucudan-2026!x")).status, 200);
  });

  it("deneme sınırı: art arda hatalı kod kilitlenir", async () => {
    const anon = server.client();
    let status = 0;
    for (let index = 0; index < 6; index += 1) status = (await anon.post("/api/auth/recover", { username: "admin", code: `YANLIS-${index}`, newPassword: "Deneme-Parola-2026!" })).status;
    assert.equal(status, 429);
  });
});

describe("kurtarma: ağdaki başka bilgisayardan sunucu kodu istenemez", () => {
  let server;
  before(async () => {
    server = await startTestServer({ env: { HUKUK_TRUST_PROXY: "1" } });
  });
  after(() => server.close());
  it("yerel olmayan istek reddedilir; anahtar yolu ağdan da çalışır", async () => {
    const remote = { "x-forwarded-for": "192.168.1.50" };
    const anon = server.client();
    assert.equal((await anon.get("/api/auth/recovery", remote)).data.data.local, false);
    const denied = await anon.post("/api/auth/recovery/local-code", {}, remote);
    assert.equal(denied.status, 403);
    assert.equal(denied.data.code, "NOT_LOCAL");
    assert.ok(!existsSync(path.join(server.dataDir, LOCAL_FILE)));
    const admin = await loginAdmin(server);
    const key = (await admin.post("/api/admin/recovery", {})).data.data.key;
    assert.equal((await anon.post("/api/auth/recover", { username: "admin", code: key, newPassword: "Agdan-Kurtarma-2026!" }, remote)).status, 200);
  });
});
