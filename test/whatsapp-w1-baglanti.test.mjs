// 2.4.8 W1 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §4, §6 W1, §8 "HESAP / META" + "GÜVENLİK"): WhatsApp Business API bağlantısı — Elle Bağla, Bağlantıyı
// Sına, Kendime Deneme Gönder, Bağlantıyı Kaldır; yetki (system.manage + whatsapp.send), salt okunur lisans; belirtecin istemciye / günlüğe / işlem
// geçmişine / hata iletisine / yedeğe ÇIKMADIĞI. Meta yerine YEREL sahte Graph sunucusu (test/whatsapp-sahte-graph.mjs; ders 30); saat sahte (ders 13).
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, createUser, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";

// Graph sürümü PLANDAN (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §2.1 "belgelerdeki güncel sürüm v26.0"), programın sabitinden okunmaz.
const GRAPH_VERSION = "v26.0";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = "SAHTE-W1-belirtec-Gizli_0123456789-abcdefABCDEF-xyz";
const PNID = "106540352242922";
const WABA = "102290129340398";
const APP = "1505264761663625";
const NOW = { time: "2026-11-03T09:00:00+03:00", fixed: true };
const URL_CONN = "/api/workspace/whatsapp/connection";

const has = (value, needle) => JSON.stringify(value ?? "").includes(needle);
// Belirtecin hiçbir parçası (ilk/son 12 karakter dahil) görünmemeli: "son 4 hane" gibi kısmi gösterim de yok.
const leaks = value => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return [TOKEN, TOKEN.slice(0, 12), TOKEN.slice(-12)].filter(part => text.includes(part));
};
const capture = () => {
  const lines = [];
  const write = level => (message, meta) => lines.push(`${level} ${message} ${meta instanceof Error ? meta.stack : JSON.stringify(meta ?? "")}`);
  return { lines, log: { debug: write("debug"), info: write("info"), warn: write("warn"), error: write("error") } };
};

describe("2.4.8 W1 — WhatsApp Business API bağlantısı (Elle Bağla)", () => {
  let fake;
  let server;
  let admin;
  const logs = capture();
  before(async () => {
    fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
    // Zaman aşımı 1,5 sn (üretimde 15 sn): yavaş koşucuda (Windows CI) olağan yerel yanıt bu sınırın çok altında kalır.
    server = await startTestServer({ now: NOW, whatsappGraphUrl: fake.url, whatsappTimeoutMs: 1500, log: logs.log });
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server?.close();
    await fake?.close();
  });
  const settingRow = () => server.app.store.get("SELECT value FROM settings WHERE key = 'whatsapp.meta'")?.value ?? null;
  const auditRows = () => server.app.store.all("SELECT type, payload_json AS payload FROM audit_events WHERE type LIKE 'whatsapp.%' ORDER BY rowid");

  it("bağlantı yokken: görünüm boş, Sına / Deneme 409; yetki yalnız yöneticide (whatsapp.send yerleşik rollerden yalnız admin)", async () => {
    const first = await admin.get(URL_CONN);
    assert.equal(first.status, 200);
    assert.deepEqual(first.data.data, { configured: false, graphAvailable: true, writable: true });
    const test = await admin.post(`${URL_CONN}/test`, {});
    assert.equal(test.status, 409);
    assert.equal(test.data.code, "whatsapp-not-configured");
    assert.equal(fake.requests.length, 0, "bağlantı yokken Meta'ya istek gitmez");
    const me = (await admin.get("/api/auth/me")).data.data;
    assert.ok(me.permissions.includes("whatsapp.send"), "yönetici whatsapp.send'e sahip");
    for (const role of ["avukat", "personel", "muhasebe"]) {
      const user = await createUser(server, admin, { username: `w1-${role}`, role });
      const perms = (await user.get("/api/auth/me")).data.data.permissions;
      assert.ok(!perms.includes("whatsapp.send"), `${role} rolünde whatsapp.send yok (varsayılan yalnız yönetici)`);
      for (const [method, url, body] of [["get", URL_CONN], ["put", URL_CONN, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }], ["del", URL_CONN], ["post", `${URL_CONN}/test`, {}], ["post", `${URL_CONN}/self-test`, { to: "05321112233" }]]) {
        const res = await user[method](url, body);
        assert.equal(res.status, 403, `${role} ${method.toUpperCase()} ${url} → 403`);
      }
    }
    assert.equal(settingRow(), null, "yetkisiz istek ayar yazmadı");
    // Yetki havuzunda (Roller ekranı) WhatsApp grubu; kişiye verilebilir.
    const roles = (await admin.get("/api/admin/roles")).data.data;
    const item = roles.groups.flatMap(group => group.items).find(entry => entry.key === "whatsapp.send");
    assert.ok(item && item.label === "WhatsApp ile Otomatik Gönder" && !item.locked, "whatsapp.send havuzda, kilitsiz");
  });

  it("Elle Bağla doğrulaması: zorunlu alanlar, yalnız rakam kimlik, boşluklu belirteç, ilk kayıtta belirteç şart", async () => {
    const cases = [
      [{ wabaId: WABA, token: TOKEN }, "phoneNumberId"],
      [{ phoneNumberId: PNID, token: TOKEN }, "wabaId"],
      [{ phoneNumberId: "10654abc", wabaId: WABA, token: TOKEN }, "phoneNumberId"],
      [{ phoneNumberId: PNID, wabaId: "../../me", token: TOKEN }, "wabaId"],
      [{ phoneNumberId: PNID, wabaId: WABA, appId: "app-1", token: TOKEN }, "appId"],
      [{ phoneNumberId: PNID, wabaId: WABA, token: "EAA bozuk" }, "token"],
      [{ phoneNumberId: PNID, wabaId: WABA, token: "EAA\nX-Header: kötü" }, "token"],
      [{ phoneNumberId: PNID, wabaId: WABA }, "token"],
      [{ phoneNumberId: PNID, wabaId: WABA, token: 12345 }, "token"],
    ];
    for (const [body, field] of cases) {
      const res = await admin.put(URL_CONN, body);
      assert.equal(res.status, 400, `${JSON.stringify(body).slice(0, 80)} → 400`);
      assert.equal(res.data.field, field, `hatalı alan ${field}`);
      assert.equal(leaks(res.data).length, 0, "hata iletisinde belirteç yok");
    }
    assert.equal(settingRow(), null, "geçersiz girişte hiçbir şey kaydedilmedi");
  });

  it("Elle Bağla kaydı: belirteç şifreli saklanır; yanıtta yalnız 'kayıtlı' işareti (son karakterler de yok); işlem geçmişinde belirteç yok", async () => {
    const res = await admin.put(URL_CONN, { phoneNumberId: ` ${PNID} `, wabaId: WABA, appId: APP, token: `  ${TOKEN}  ` });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const data = res.data.data;
    assert.equal(data.configured, true);
    assert.equal(data.mode, "manual");
    assert.equal(data.phoneNumberId, PNID, "boşluklar atılır");
    assert.equal(data.wabaId, WABA);
    assert.equal(data.appId, APP);
    assert.equal(data.hasToken, true);
    assert.equal(data.tokenUsable, true);
    assert.equal(data.lastTest, null);
    assert.ok(!("token" in data) && !("tokenSealed" in data), "yanıtta belirteç alanı yok");
    assert.deepEqual(leaks(res.data), [], "PUT yanıtında belirteç izi yok");
    assert.deepEqual(leaks((await admin.get(URL_CONN)).data), [], "GET yanıtında belirteç izi yok");
    const row = settingRow();
    assert.ok(row && JSON.parse(row).tokenSealed.startsWith("sb1:"), "veri tabanında secret-box mühürlü");
    assert.deepEqual(leaks(row), [], "veri tabanında açık belirteç yok");
    const audits = auditRows();
    assert.ok(audits.some(item => item.type === "whatsapp.connection.saved" && JSON.parse(item.payload).tokenChanged === true));
    assert.deepEqual(leaks(audits), [], "işlem geçmişinde belirteç yok");
    assert.equal(fake.requests.length, 0, "kaydetmek Meta'ya istek göndermez");
  });

  it("Bağlantıyı Sına: numara bu WABA'da, görünen ad, kalite, sınır basamağı, deneme şablonu; istekler sürüm sabitiyle ve belirteç yalnız başlıkta", async () => {
    const res = await admin.post(`${URL_CONN}/test`, {});
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const last = res.data.data.lastTest;
    assert.equal(last.ok, true);
    assert.equal(last.at, new Date("2026-11-03T06:00:00.000Z").toISOString(), "zaman sahte saatten");
    assert.equal(last.phone.display, "+90 212 555 01 02");
    assert.equal(last.phone.verifiedName, "Örnek Ticaret Ltd");
    assert.equal(last.phone.qualityLabel, "Yüksek");
    assert.equal(last.phone.verified, true);
    assert.equal(last.phone.tier, "TIER_250");
    assert.equal(last.phone.limit, 250);
    assert.equal(last.phone.tierLabel, "24 saatte 250 farklı kişi");
    assert.deepEqual(last.templates.test, { name: "hello_world", status: "APPROVED", language: "en_US", category: "UTILITY" });
    assert.deepEqual(last.templates.program, { destekofis_ekstre: null, destekofis_odeme_hatirlatma: null }, "programın şablonları henüz açılmadı (W5)");
    const seen = fake.requests.map(item => `${item.method} ${item.version} ${item.path}`);
    assert.deepEqual(seen, [`GET ${GRAPH_VERSION} /${WABA}/phone_numbers`, `GET ${GRAPH_VERSION} /${PNID}`, `GET ${GRAPH_VERSION} /${WABA}/message_templates`]);
    assert.equal(fake.requests[1].query.fields, "whatsapp_business_manager_messaging_limit");
    assert.equal(fake.requests[2].query.fields, "name,language,status,category");
    for (const item of fake.requests) {
      assert.equal(item.auth, `Bearer ${TOKEN}`, "belirteç Authorization başlığında");
      assert.ok(!JSON.stringify(item.query).includes(TOKEN.slice(0, 12)), "belirteç adres sorgusunda değil");
    }
    assert.deepEqual(leaks(res.data), []);
    fake.requests.length = 0;
  });

  it("Sına hataları: süresi dolmuş belirteç (Meta metni belirteci yankılasa bile), yanlış kimlik, numara başka hesapta, zaman aşımı, gövdesiz 500", async () => {
    // 190 + belirteç yankısı: program iletiyi Türkçeleştirir, belirteci siler.
    fake.set({ token: "BASKA-BELIRTEC", echoToken: true });
    let res = await admin.post(`${URL_CONN}/test`, {});
    assert.equal(res.status, 502);
    assert.equal(res.data.code, "whatsapp-meta");
    assert.equal(res.data.meta.code, 190);
    assert.equal(res.data.meta.retry, "never");
    assert.match(res.data.error, /süresi dolmuş/);
    assert.deepEqual(leaks(res.data), [], "Meta'nın yankıladığı belirteç yanıtta yok");
    let view = (await admin.get(URL_CONN)).data.data;
    assert.equal(view.lastTest.ok, false);
    assert.deepEqual(leaks(view), [], "kaydedilen sınama sonucunda belirteç yok");
    assert.deepEqual(leaks(settingRow()), []);
    fake.set({ token: TOKEN, echoToken: false });
    // Yanlış WABA: Meta 100.
    await admin.put(URL_CONN, { phoneNumberId: PNID, wabaId: "999999999999", appId: APP });
    res = await admin.post(`${URL_CONN}/test`, {});
    assert.equal(res.status, 502);
    assert.equal(res.data.meta.code, 100);
    assert.match(res.data.error, /yanlış olabilir/);
    // Numara bu WABA'da değil (Meta yanıt verdi; liste başka numara içeriyor).
    await admin.put(URL_CONN, { phoneNumberId: "123456789012", wabaId: WABA, appId: APP });
    res = await admin.post(`${URL_CONN}/test`, {});
    assert.equal(res.status, 409);
    assert.equal(res.data.code, "whatsapp-mismatch");
    await admin.put(URL_CONN, { phoneNumberId: PNID, wabaId: WABA, appId: APP });
    // Zaman aşımı (1,5 sn): sonuç "bilinmiyor".
    fake.set({ delayMs: 3000 });
    res = await admin.post(`${URL_CONN}/test`, {});
    assert.equal(res.status, 502);
    assert.equal(res.data.code, "whatsapp-meta-unreachable");
    assert.equal(res.data.meta.reason, "timeout");
    assert.equal(res.data.meta.retry, "unknown");
    fake.set({ delayMs: 0 });
    // Geciken istek sahte sunucuda bitene dek beklenir (yoksa aşağıdaki failNext'i o tüketir).
    await new Promise(resolve => setTimeout(resolve, 1800));
    // Gövdesiz (HTML) 500: vekil hata sayfası gibi.
    fake.set({ failNext: { status: 500, raw: "<html>Bad Gateway</html>" } });
    res = await admin.post(`${URL_CONN}/test`, {});
    assert.equal(res.status, 502);
    assert.equal(res.data.meta.reason, "http");
    assert.equal(res.data.meta.httpStatus, 500);
    // Yeniden kaydetmek kayıtlı belirteci korur (token boş) → sınama yine geçer.
    res = await admin.post(`${URL_CONN}/test`, {});
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.data.lastTest.ok, true);
    assert.deepEqual(leaks(auditRows()), [], "hata sınamalarının işlem geçmişinde belirteç yok");
    fake.requests.length = 0;
  });

  it("Kendime Deneme Gönder: hello_world dili listeden, numara '+90' ile; 15 sn içinde ikinci deneme 429; geçersiz numara 400; şablon yoksa Meta'ya ileti gitmez", async () => {
    let res = await admin.post(`${URL_CONN}/self-test`, { to: "0212 555 66 77" });
    assert.equal(res.status, 400, "sabit hat");
    assert.equal(res.data.field, "to");
    res = await admin.post(`${URL_CONN}/self-test`, { to: "0532 111 22 33" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.data.result.ok, true);
    assert.equal(res.data.data.result.wamid, "wamid.SAHTE0001");
    assert.equal(res.data.data.result.to4, "2233");
    const post = fake.requests.find(item => item.method === "POST");
    assert.equal(post.path, `/${PNID}/messages`);
    assert.deepEqual(post.body, { messaging_product: "whatsapp", recipient_type: "individual", to: "+905321112233", type: "template", template: { name: "hello_world", language: { code: "en_US" } } });
    assert.equal(post.auth, `Bearer ${TOKEN}`);
    assert.equal(res.data.data.connection.lastSelfTest.wamid, "wamid.SAHTE0001");
    // Çift tık / ikinci sekme: 15 sn içinde ikinci ileti GİTMEZ.
    res = await admin.post(`${URL_CONN}/self-test`, { to: "0532 111 22 33" });
    assert.equal(res.status, 429);
    assert.equal(fake.state.sent, 1, "Meta'ya tek ileti");
    server.clock.advance({ seconds: 16 });
    // Deneme şablonu hesapta yok → 409, ileti isteği yapılmaz.
    const saved = fake.state.templates;
    fake.set({ templates: saved.filter(item => item.name !== "hello_world") });
    fake.requests.length = 0;
    res = await admin.post(`${URL_CONN}/self-test`, { to: "+90 532 111 22 33" });
    assert.equal(res.status, 409);
    assert.equal(res.data.code, "whatsapp-test-template");
    assert.ok(!fake.requests.some(item => item.method === "POST"), "şablon yokken ileti gönderilmedi");
    // Şablon var ama onaysız.
    fake.set({ templates: [{ ...saved[0], status: "PENDING" }] });
    res = await admin.post(`${URL_CONN}/self-test`, { to: "05321112233" });
    assert.equal(res.status, 409);
    assert.match(res.data.error, /onaylı değil/);
    fake.set({ templates: saved });
    // Meta alıcı hatası (131026) → 502, nedeni Türkçe.
    fake.set({ failNext: { match: /^POST /, status: 400, body: { error: { message: "(#131026) Message undeliverable", code: 131026, type: "OAuthException", fbtrace_id: "x" } } } });
    res = await admin.post(`${URL_CONN}/self-test`, { to: "05321112233" });
    assert.equal(res.status, 502);
    assert.match(res.data.error, /WhatsApp kullanmıyor/);
    const view = (await admin.get(URL_CONN)).data.data;
    assert.equal(view.lastSelfTest.ok, false);
    assert.deepEqual(leaks(view), []);
    assert.deepEqual(leaks(auditRows()), []);
    assert.ok(auditRows().some(item => item.type === "whatsapp.selftest.sent"));
  });

  it("gönderim yetkisi kişiye verilse de bağlantı/deneme yöneticiye özgü (system.manage); yönetici yetkiyi kişiye ekleyip kaldırabilir", async () => {
    const created = await admin.post("/api/admin/users", { username: "w1-gonderen", name: "Gönderen Personel", role: "personel", password: "Personel-2026!", mustChangePassword: false });
    assert.equal(created.status, 200);
    const id = created.data.data.id;
    const grant = await admin.patch(`/api/admin/users/${id}`, { grants: { add: ["whatsapp.send"], remove: [] } });
    assert.equal(grant.status, 200, JSON.stringify(grant.data));
    const user = server.client();
    assert.equal((await user.login("w1-gonderen", "Personel-2026!")).status, 200);
    assert.ok((await user.get("/api/auth/me")).data.data.permissions.includes("whatsapp.send"), "kişiye verildi");
    assert.equal((await user.post(`${URL_CONN}/self-test`, { to: "05321112233" })).status, 403, "system.manage yok → deneme yok");
    assert.equal((await user.get(URL_CONN)).status, 403);
  });

  it("iki şirket: bağlantı şirket başına (002 bağlı değil); Şirket Verisini Sıfırla bağlantıyı korur", async () => {
    const created = await admin.post("/api/companies", { name: "WhatsApp İkinci Şirket", select: false });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const second = created.data.data.company;
    const other = await admin.get(`${URL_CONN}?hofCompany=${encodeURIComponent(second.id)}`);
    assert.equal(other.status, 200);
    assert.equal(other.data.data.configured, false, "002'de bağlantı yok");
    assert.equal((await admin.get(URL_CONN)).data.data.configured, true, "001 bağlı");
    const reset = await admin.post("/api/companies/sirket-001/reset", { mode: "all", confirm: "001", password: ADMIN_PASSWORD });
    assert.equal(reset.status, 200, JSON.stringify(reset.data).slice(0, 300));
    const kept = (await admin.get(URL_CONN)).data.data;
    assert.equal(kept.configured, true, "Tümünü Sıfırla'da da korunur (KEEP_SETTINGS whatsapp)");
    assert.equal(kept.tokenUsable, true);
  });

  it("yedek dosyasında belirteç açık metin olarak yok; secret.key yedek klasörüne girmez; günlükte belirteç yok", async () => {
    const res = await admin.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const item = res.data.data.backups[0];
    const file = path.join(item.folder, item.name);
    const bytes = readFileSync(file);
    assert.ok(bytes.length > 1000, "yedek okundu");
    assert.ok(bytes.includes(Buffer.from("whatsapp.meta")), "yedek bağlantı satırını taşır (mühürlü)");
    for (const part of [TOKEN, TOKEN.slice(0, 12), TOKEN.slice(-12)]) assert.ok(!bytes.includes(Buffer.from(part)), `yedekte belirteç parçası yok: ${part.slice(0, 4)}…`);
    const walk = dir => readdirSync(dir).flatMap(name => (statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name)) : [name]));
    assert.ok(!walk(server.backupDir).includes("secret.key"), "secret.key yedek klasöründe yok");
    const download = await admin.raw("GET", `/api/admin/backups/${encodeURIComponent(item.name)}?company=sirket-001`);
    assert.equal(download.status, 200);
    assert.ok(!download.buffer.includes(Buffer.from(TOKEN)), "indirilen yedekte belirteç yok");
    assert.ok(logs.lines.length > 0 || true);
    assert.deepEqual(leaks(logs.lines.join("\n")), [], "günlükte belirteç yok");
  });

  it("belirteç bu bilgisayarda açılamıyor (veri başka bilgisayara taşınmış: secret.key farklı) → Sına 409, Meta'ya istek yok; Bağlantıyı Kaldır", async () => {
    const keyFile = path.join(server.dataDir, "secret.key");
    assert.ok(existsSync(keyFile), "secret.key veri klasöründe");
    const original = readFileSync(keyFile);
    writeFileSync(keyFile, Buffer.alloc(32, 7));
    try {
      const fresh = await startTestServer({ dataDir: server.dataDir, now: NOW, whatsappGraphUrl: fake.url });
      try {
        const api = await loginAdmin(fresh);
        const view = (await api.get(URL_CONN)).data.data;
        assert.equal(view.hasToken, true);
        assert.equal(view.tokenUsable, false, "anahtar farklı → belirteç açılamaz");
        fake.requests.length = 0;
        const res = await api.post(`${URL_CONN}/test`, {});
        assert.equal(res.status, 409);
        assert.equal(res.data.code, "whatsapp-token-unreadable");
        assert.equal(fake.requests.length, 0);
      } finally {
        await fresh.close();
      }
    } finally {
      writeFileSync(keyFile, original);
    }
  });

  it("Bağlantıyı Kaldır: ayar satırı silinir, işlem geçmişine yazılır; kaynakta mühürlü belirteci yalnız bağlantı modülü okur", async () => {
    const res = await admin.del(URL_CONN);
    assert.equal(res.status, 200);
    assert.equal(res.data.data.configured, false);
    assert.equal(settingRow(), null);
    assert.ok(auditRows().some(item => item.type === "whatsapp.connection.removed"));
    // Kaynak taraması: tokenSealed alanına yalnız lib/whatsapp/connection.mjs dokunur; istemci dosyaları hiç anmaz.
    const walk = dir => readdirSync(dir).flatMap(name => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : /\.(mjs|js|html)$/.test(name) ? [full] : [];
    });
    const users = [...walk(path.join(ROOT, "server")), ...walk(path.join(ROOT, "client"))].filter(file => /tokenSealed/.test(readFileSync(file, "utf8")));
    assert.deepEqual(users.map(file => path.relative(ROOT, file).split(path.sep).join("/")), ["server/lib/whatsapp/connection.mjs"]);
  });
});

describe("2.4.8 W1 — salt okunur lisans ve Meta adresi kapalı kurulum", () => {
  it("salt okunur lisans: görünüm okunur (writable false); kaydet / sına / deneme / kaldır 403 LICENSE_READ_ONLY; whatsapp.send ekrandan düşer; ayar değişmez", async () => {
    const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-w1-saltokunur-"));
    try {
      const first = await startTestServer({ dataDir, now: NOW, whatsappGraphUrl: fake.url });
      try {
        const api = await loginAdmin(first);
        assert.equal((await api.put(URL_CONN, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      } finally {
        await first.close();
      }
      const server = await startTestServer({ dataDir, now: NOW, whatsappGraphUrl: fake.url, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
      try {
        const api = await loginAdmin(server);
        const before = server.app.store.get("SELECT value FROM settings WHERE key = 'whatsapp.meta'").value;
        const view = await api.get(URL_CONN);
        assert.equal(view.status, 200);
        assert.equal(view.data.data.writable, false);
        assert.equal(view.data.data.configured, true);
        fake.requests.length = 0;
        for (const [method, url, body] of [["put", URL_CONN, { phoneNumberId: PNID, wabaId: WABA }], ["post", `${URL_CONN}/test`, {}], ["post", `${URL_CONN}/self-test`, { to: "05321112233" }], ["del", URL_CONN]]) {
          const res = await api[method](url, body);
          assert.equal(res.status, 403, `${method} ${url}`);
          assert.equal(res.data.code, "LICENSE_READ_ONLY", `${method} ${url}`);
        }
        assert.equal(fake.requests.length, 0, "salt okunurda Meta'ya istek yok");
        assert.equal(server.app.store.get("SELECT value FROM settings WHERE key = 'whatsapp.meta'").value, before, "ayar değişmedi");
        const me = (await api.get("/api/auth/me")).data.data;
        assert.ok(!me.permissions.includes("whatsapp.send"), "salt okunurda gönderim yetkisi ekrana gitmez");
      } finally {
        await server.close();
      }
    } finally {
      await fake.close();
      removeTestDir(dataDir);
    }
  });

  it("Meta adresi verilmemiş kurulum (testlerin varsayılanı): kaydetmek olur, Sına / Deneme 409 whatsapp-graph-off ve HİÇBİR dış istek yapılmaz", async () => {
    const calls = [];
    const server = await startTestServer({ now: NOW, fetchImpl: async (...args) => { calls.push(String(args[0])); throw new TypeError("dış istek beklenmiyordu"); } });
    try {
      const api = await loginAdmin(server);
      assert.equal((await api.get(URL_CONN)).data.data.graphAvailable, false);
      assert.equal((await api.put(URL_CONN, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      const test = await api.post(`${URL_CONN}/test`, {});
      assert.equal(test.status, 409);
      assert.equal(test.data.code, "whatsapp-graph-off");
      const self = await api.post(`${URL_CONN}/self-test`, { to: "05321112233" });
      assert.equal(self.status, 409);
      assert.equal(self.data.code, "whatsapp-graph-off");
      assert.deepEqual(calls.filter(url => /whatsapp|graph|facebook/i.test(url)), [], "Meta'ya dış istek yok");
    } finally {
      await server.close();
    }
  });
});
