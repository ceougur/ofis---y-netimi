// 2.5.0 WE — "Elle Bağla"nın UYGULAMA DÜZEYİ webhook bilgileri (Callback URL + Verify token) programda (plan docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 WE; 2.4.9 teslim notu (d)).
// Hedef (plandan / görev metninden): program iki değeri kendisi gösterir — kurulum başına üretilen belirteç (yalnız yöneticiye görünür) ve kapıcıdan geçen adres; kılavuzdaki
// "DestekOfis desteğinden alın" kalkar. Belirteç gizli bilgidir: günlüğe, yedeğe / dosyaya (açık hâli), hata iletisine, başka uçların yanıtına girmez; yetkisiz kullanıcı göremez.
// Meta'nın "Verify and save" doğrulaması (GET hub.verify_token → hub.challenge) bu adreste geçer. Adrese düşen POST — 2.5.0 WhatsApp tur 1, KULLANICI KARARI S41 = A (06.11.2026;
// eski "İŞLENMEZ" beklentisinin yerine): kaydı olan WABA'nın bildirimi alternatif adresle AYNI kurallarla işlenir (Yol 1 imzasız kabul); ayrıntılı hücreler
// test/whatsapp-tur1-bildirim-yolu-250.test.mjs.
// Düzenek: GERÇEK program + yerel sahte Meta (aynı el — kâhin DEĞİL, ders 5) + programın uzak dinleyicisi (kapıcının geçirdiği istek; kapıcı yokken işaret denetimi yok).
// Ders 30: lisans servisi yerel ölü adres. Ders 13: sahte saat. TZ=UTC ve TZ=Europe/Istanbul. Eski kodda (taban f5b34f31) uç yok → 404 (beklenen neden: program göstermiyor).
// Ders 48 (Windows): bir hücre secret.key'i DEĞİŞTİRİR (program kapalıyken; veri başka bilgisayara taşındı benzetimi).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { createStore, openDatabase } from "../server/lib/db.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { createAppWebhook } from "../server/lib/whatsapp/app-webhook.mjs";
import { ADMIN_PASSWORD, createUser, removeTestDir } from "./helpers.mjs";
import { PNID, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const API = "/api/workspace/whatsapp/app-webhook";
const PUBLIC = "http://ofis-we.destekofis.test";
const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const NOT_READY = "Ofisin uzaktan bağlantı adresi henüz hazır değil; Yönetim → Mobil Cihazlar'da uzaktan bağlantı açılınca bildirim adresi burada görünür.";
const statusEvent = statuses => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });
function raw(base, method, pathAndQuery, body = null) {
  const url = new URL(base);
  const payload = body === null ? null : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: pathAndQuery, headers: payload ? { "content-type": "application/json", "content-length": payload.length } : {} }, res => {
      const parts = [];
      res.on("data", chunk => parts.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const files = dir => readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? files(full) : [full];
});
async function info(ctx, q = "") {
  const res = await ctx.api.get(`${API}${q}`);
  assert.equal(res.status, 200, `webhook bilgileri ucu (geldi ${res.status} ${JSON.stringify(res.data)})`);
  return res.data.data;
}
const pathOf = callbackUrl => new URL(callbackUrl).pathname.split("/").pop();
// 2.5.0 WE + BS-7 gerileme düzeltmesi: 001 yeni şemalıyken (şema sürüm kapısı) çift üretilmez; neden metni görev metnindeki karardan (cümle düzeni), koddan alınmaz.
const SCHEMA_AHEAD = "001 şirketinin verisi programın daha yeni bir sürümüyle açıldığı için webhook bilgileri hazırlanamıyor; programı güncelleyince burada görünür.";
const KEY = "whatsapp.appWebhook";
// Kapalı sunucuda 001 dosyasının şema numarası (BS-7 "yeni sürüm" benzetimi: LATEST + 1; geri alma: LATEST).
function setSchema(file, version) {
  const db = new DatabaseSync(file);
  try {
    db.exec(`PRAGMA user_version = ${version}`);
  } finally {
    db.close();
  }
}
// 001 dosyasındaki webhook ayar satırı (kapalı sunucuda): değer + yazım zamanı; yoksa null.
function webhookRow(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const row = db.prepare("SELECT value, updated_at FROM settings WHERE key = ?").get(KEY);
    return row ? `${row.value}|${row.updated_at}` : null;
  } finally {
    db.close();
  }
}
// Yeni hücrelerde sunucu yeniden açılır (kapalı sunucuda dosya değiştirilir): kapatma bir kez yapılır, finally'deki ikinci çağrı aynı sözü döner.
async function startOnce(options) {
  const ctx = await startWa(options);
  const close = ctx.close.bind(ctx);
  let closing = null;
  ctx.close = () => (closing ||= close());
  return ctx;
}
async function remoteOf(ctx) {
  return `http://127.0.0.1:${(await ctx.server.app.listenRemote(0, "127.0.0.1")).port}`;
}
const verifyGet = (base, info, challenge) => raw(base, "GET", `/wa/kanca/${pathOf(info.callbackUrl)}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(info.verifyToken)}&hub.challenge=${challenge}`);

describe("2.5.0 WE — Elle Bağla webhook bilgileri: program gösterir, kurulum başına, gizli", () => {
  it("WE-1 yönetici: Callback URL = ofisin adresi + /wa/kanca/<43>, Verify token 43 karakter; yeniden sorulunca ve öbür şirkette AYNI (kurulum başına); WABA'nın bildirim adresinden farklı", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ maxCompanies: 2, env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const first = await info(ctx);
      assert.equal(first.ready, true);
      assert.match(first.callbackUrl, /^http:\/\/ofis-we\.destekofis\.test\/wa\/kanca\/[A-Za-z0-9_-]{43}$/);
      assert.match(first.verifyToken, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(first.reason, "");
      assert.deepEqual(await info(ctx), first, "ikinci soruşta aynı değerler");
      const created = await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const company = created.data.data.company || created.data.data;
      assert.deepEqual(await info(ctx, `?hofCompany=${encodeURIComponent(company.id)}`), first, "öbür şirkette aynı (kurulum başına)");
      assert.equal((await ctx.api.post(`${URLS.conn}/hook`, {})).status, 200, "WABA'nın bildirim adresi kaydı");
      const override = ctx.fake.state.subscriptions.at(-1);
      assert.notEqual(pathOf(override.override_callback_uri), pathOf(first.callbackUrl), "uygulama düzeyi adres WABA'nın gizli yolundan ayrı");
      assert.notEqual(override.verify_token, first.verifyToken);
    } finally {
      await ctx.close();
    }
  });

  it("WE-2 Meta doğrulaması: GET doğru belirteç → 200 challenge, yanlış / eksik → 403; POST (S41 = A) kaydı olan WABA'nınsa İŞLENİR (Yol 1: iş Teslim Edildi, defterde teslim; WABA düzeyinde işaret yok — tur 1); WABA adresi aynen çalışır", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ maxCompanies: 2, env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
      const base = `http://127.0.0.1:${remote.port}`;
      const we = await info(ctx);
      const appPath = pathOf(we.callbackUrl);
      const ok = await raw(base, "GET", `/wa/kanca/${appPath}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(we.verifyToken)}&hub.challenge=1158201444`);
      assert.deepEqual([ok.status, ok.text], [200, "1158201444"], "Meta'nın Verify and save doğrulaması geçer");
      assert.equal((await raw(base, "GET", `/wa/kanca/${appPath}?hub.mode=subscribe&hub.verify_token=yanlis&hub.challenge=1`)).status, 403, "yanlış belirteç");
      assert.equal((await raw(base, "GET", `/wa/kanca/${appPath}?hub.verify_token=${encodeURIComponent(we.verifyToken)}&hub.challenge=1`)).status, 403, "hub.mode yok");
      assert.equal((await raw(base, "GET", `/wa/kanca/${randomBytes(32).toString("base64url")}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(we.verifyToken)}&hub.challenge=1`)).status, 404, "bilinmeyen yol");
      // Kabul edilmiş bir iş + WABA'nın bildirim adresi.
      assert.equal((await ctx.api.post(`${URLS.conn}/hook`, {})).status, 200);
      const sub = ctx.fake.state.subscriptions.at(-1);
      const account = await ctx.account("Hande Ay", "0533 444 55 80", 500);
      const batch = await ctx.batch({ kind: "statement", ids: [account.id], preset: "thisMonth" });
      assert.equal(batch.status, 200, JSON.stringify(batch.data));
      await ctx.drain();
      const job = (await ctx.jobs(batch.data.data.batch.id))[0];
      assert.equal(job.state, "accepted", "ön koşul: Meta Kabul Etti");
      const ledger = () => {
        const db = new DatabaseSync(ctx.wa.ledger.file, { readOnly: true });
        try {
          return { teslim: db.prepare("SELECT COUNT(*) AS n FROM deliveries").get().n, isaret: db.prepare("SELECT COUNT(*) AS n FROM hook_seen").get().n };
        } finally {
          db.close();
        }
      };
      const before = ledger();
      const post = await raw(base, "POST", `/wa/kanca/${appPath}`, statusEvent([{ id: job.wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445580" }]));
      assert.deepEqual([post.status, post.text], [200, '{"ok":true}'], "uygulama düzeyi adrese POST kabul edilir");
      assert.equal((await ctx.jobs(batch.data.data.batch.id))[0].state, "delivered", "S41 = A: POST işlendi (Yol 1 imzasız kabul) — iş Teslim Edildi");
      assert.deepEqual(ledger(), { teslim: before.teslim + 1, isaret: before.isaret }, "defterde teslim +1; WABA düzeyinde bildirim yolu işareti yok (tur 1: işaret şirket düzeyinde)");
      await ctx.wa.appWebhook.rechecks?.settled(); // arka plandaki adres denetimi bitsin (sunucu kapanmadan)
      const hookGet = await raw(base, "GET", `/wa/kanca/${new URL(sub.override_callback_uri).pathname.split("/").pop()}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(sub.verify_token)}&hub.challenge=77`);
      assert.deepEqual([hookGet.status, hookGet.text], [200, "77"], "WABA'nın bildirim adresi aynen doğrulanır");
      // Uygulama düzeyi belirteç WABA adresini doğrulamaz; WABA belirteci uygulama düzeyi adresi doğrulamaz.
      assert.equal((await raw(base, "GET", `/wa/kanca/${new URL(sub.override_callback_uri).pathname.split("/").pop()}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(we.verifyToken)}&hub.challenge=1`)).status, 403);
      assert.equal((await raw(base, "GET", `/wa/kanca/${appPath}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(sub.verify_token)}&hub.challenge=1`)).status, 403);
    } finally {
      await ctx.close();
    }
  });

  it("WE-3 yetkisiz kullanıcı (Personel) göremez (403); belirteç ve gizli yol yöneticinin öbür yanıtlarında da yok (bağlantı, gönderim durumu, onay, sayaç, işlem geçmişi)", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ maxCompanies: 2, env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const we = await info(ctx);
      const appPath = pathOf(we.callbackUrl);
      const staff = await createUser(ctx.server, ctx.api, { username: "personel-we" });
      const denied = await staff.get(API);
      assert.equal(denied.status, 403, `Personel 403 (geldi ${denied.status})`);
      assert.ok(!JSON.stringify(denied.data).includes(we.verifyToken) && !JSON.stringify(denied.data).includes(appPath), "403 yanıtında değer yok");
      const bodies = [];
      for (const url of [URLS.conn, "/api/workspace/whatsapp/sending-status", URLS.ack, URLS.stats, URLS.batches, "/api/admin/audit?limit=500", "/api/auth/me"]) bodies.push([url, JSON.stringify((await ctx.api.get(url)).data)]);
      for (const url of ["/api/workspace/whatsapp/sending-status", "/api/auth/me"]) bodies.push([`personel ${url}`, JSON.stringify((await staff.get(url)).data)]);
      const leaks = bodies.filter(([, body]) => body.includes(we.verifyToken) || body.includes(appPath)).map(([url]) => url);
      assert.deepEqual(leaks, [], "başka yanıtta belirteç / gizli yol yok");
    } finally {
      await ctx.close();
    }
  });

  it("WE-4 sızıntı yok: günlük, veri klasöründeki BÜTÜN dosyalar (şirket dosyası, makine defteri, WAL) ve yedek belirteci / gizli yolu AÇIK hâlde taşımaz; ayar yazılamazsa 503 + Türkçe ileti (değer yok)", { timeout: 120_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-we-"));
    const lines = [];
    const write = level => (message, meta) => lines.push(`[${level}] ${message}${meta === undefined ? "" : ` ${meta instanceof Error ? meta.stack || meta.message : JSON.stringify(meta)}`}`);
    const ctx = await startWa({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), maxCompanies: 2, env: DEAD, log: { debug: write("DEBUG"), info: write("INFO"), warn: write("WARN"), error: write("ERROR") } });
    try {
      // Ayar yazılamıyor (disk dolu benzetimi): değer üretilmez, ileti Türkçe ve sabit.
      const store = ctx.server.app.store;
      const original = store.setSetting;
      store.setSetting = (key, ...rest) => {
        if (key === "whatsapp.appWebhook") throw Object.assign(new Error("database or disk is full"), { code: "ERR_SQLITE_ERROR" });
        return original.call(store, key, ...rest);
      };
      const failed = await ctx.api.get(API);
      store.setSetting = original;
      assert.equal(failed.status, 503, `yazılamayınca 503 (geldi ${failed.status})`);
      assert.match(failed.data.error, /^Webhook bilgileri hazırlanamadı; programı yeniden başlatıp tekrar deneyin\./);
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const we = await info(ctx);
      const appPath = pathOf(we.callbackUrl);
      const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
      const base = `http://127.0.0.1:${remote.port}`;
      assert.equal((await raw(base, "GET", `/wa/kanca/${appPath}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(we.verifyToken)}&hub.challenge=5`)).status, 200);
      assert.equal((await raw(base, "GET", `/wa/kanca/${appPath}?hub.mode=subscribe&hub.verify_token=yanlis&hub.challenge=5`)).status, 403);
      assert.equal((await raw(base, "POST", `/wa/kanca/${appPath}`, statusEvent([{ id: "wamid.X", status: "delivered", timestamp: "1", recipient_id: "905" }]))).status, 200);
      const backup = await ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
      assert.equal(backup.status, 200, JSON.stringify(backup.data));
      const secrets = [we.verifyToken, appPath];
      const logHits = lines.filter(line => secrets.some(secret => line.includes(secret)));
      assert.deepEqual(logHits, [], "günlükte belirteç / gizli yol yok");
      const fileHits = [...files(path.join(root, "data")), ...files(path.join(root, "backups"))].filter(file => {
        const content = readFileSync(file);
        return secrets.some(secret => content.includes(Buffer.from(secret)));
      });
      assert.deepEqual(fileHits, [], "veri klasöründe ve yedekte açık değer yok");
      const sealed = JSON.parse(store.setting("whatsapp.appWebhook", "{}"));
      assert.ok(String(sealed.verifySealed || "").length > 0 && String(sealed.pathSealed || "").length > 0, "ayarda mühürlü değerler var");
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });

  it("WE-5 kalıcılık: program yeniden açılınca ve Şirket Verisini Sıfırla'dan sonra AYNI değerler; secret.key değişince (veri başka bilgisayarda) yeni değerler, eski yol kapanır", { timeout: 120_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-we-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    let ctx = await startWa({ dataDir, backupDir, env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const first = await info(ctx);
      await ctx.close();
      ctx = await startWa({ dataDir, backupDir, env: DEAD, connect: false, ack: false });
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      assert.deepEqual(await info(ctx), first, "yeniden açılışta aynı");
      const reset = await ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(reset.status, 200, JSON.stringify(reset.data));
      assert.deepEqual(await info(ctx), first, "Şirket Verisini Sıfırla'dan sonra aynı");
      await ctx.close();
      writeFileSync(path.join(dataDir, "secret.key"), randomBytes(32).toString("base64"));
      ctx = await startWa({ dataDir, backupDir, env: DEAD, connect: false, ack: false });
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const moved = await info(ctx);
      assert.notEqual(moved.verifyToken, first.verifyToken, "anahtar değişince yeni belirteç");
      assert.notEqual(pathOf(moved.callbackUrl), pathOf(first.callbackUrl), "anahtar değişince yeni yol");
      const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
      const base = `http://127.0.0.1:${remote.port}`;
      assert.equal((await raw(base, "GET", `/wa/kanca/${pathOf(first.callbackUrl)}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(first.verifyToken)}&hub.challenge=1`)).status, 404, "eski yol kapandı");
      assert.equal((await raw(base, "GET", `/wa/kanca/${pathOf(moved.callbackUrl)}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(moved.verifyToken)}&hub.challenge=9`)).text, "9");
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });

  it("WE-6 ofisin uzaktan adresi hazır değil: ready false, adres boş, neden Türkçe cümle; belirteç yine gösterilir (aynı)", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl("");
      const none = await info(ctx);
      assert.deepEqual([none.ready, none.callbackUrl, none.reason], [false, "", NOT_READY]);
      assert.match(none.verifyToken, /^[A-Za-z0-9_-]{43}$/);
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const ready = await info(ctx);
      assert.equal(ready.ready, true);
      assert.equal(ready.verifyToken, none.verifyToken, "adres gelince belirteç değişmez");
    } finally {
      await ctx.close();
    }
  });

  // ---------- 2.5.0 WE + BS-7 gerileme düzeltmesi (baş mimar kararı (1)): kapılı (kendinden yeni şemalı) 001'e WE HİÇ yazmaz ----------
  // Nasıl bozulur: çift hiç üretilmemişken 001 yeni şemalı açılır (001'den ve 002'den sorulur); çift varken (okunur, gösterilir, Meta doğrulaması geçer); çift var ama bu bilgisayarda
  // açılamıyor (secret.key değişti — yeniden üretim yazma olurdu); kapı kalkınca çıkmaz yok (çift üretilir). Ders 48: hücreler program kapalıyken 001 dosyasının şema numarasını ve secret.key'i değiştirir.
  it("WE-7 001 yeni şemalı, çift YOK: 001'den ve 002'den sorulunca 200 + ready false + Türkçe neden, değer boş; 001'e webhook ayarı yazılmaz; kapı kalkınca çift üretilir (çıkmaz yok)", { timeout: 180_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-we-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    const rootFile = resolveDbPath(dataDir);
    let ctx = await startOnce({ dataDir, backupDir, maxCompanies: 2, env: DEAD });
    try {
      const created = await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const second = created.data.data.company || created.data.data;
      await ctx.close();
      assert.equal(webhookRow(rootFile), null, "ön koşul: çift hiç üretilmedi");
      setSchema(rootFile, LATEST_VERSION + 1);
      ctx = await startOnce({ dataDir, backupDir, maxCompanies: 2, env: DEAD, connect: false, ack: false, office: null });
      assert.equal(ctx.server.app.schemaGate?.version, LATEST_VERSION + 1, "ön koşul: 001 kapıda");
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      for (const q of ["", `?hofCompany=${encodeURIComponent(second.id)}`]) {
        const gated = await info(ctx, q);
        assert.deepEqual([gated.ready, gated.callbackUrl, gated.verifyToken, gated.reason], [false, "", "", SCHEMA_AHEAD], `kapıda çift üretilmez (${q || "001"})`);
      }
      assert.equal(ctx.store.setting(KEY, null), null, "çalışırken de 001'de webhook ayarı yok");
      await ctx.close();
      assert.equal(webhookRow(rootFile), null, "001 dosyasına webhook ayarı yazılmadı");
      // Kapı kalkar (program güncellendi benzetimi): çift üretilir, Meta doğrulaması geçer.
      setSchema(rootFile, LATEST_VERSION);
      ctx = await startOnce({ dataDir, backupDir, maxCompanies: 2, env: DEAD, connect: false, ack: false, office: null });
      assert.equal(ctx.server.app.schemaGate ?? null, null);
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const made = await info(ctx);
      assert.equal(made.ready, true);
      assert.match(made.verifyToken, /^[A-Za-z0-9_-]{43}$/);
      const res = await verifyGet(await remoteOf(ctx), made, 4242);
      assert.deepEqual([res.status, res.text], [200, "4242"]);
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });

  it("WE-8 001 yeni şemalı, çift VAR: aynı değerler gösterilir (001 ve 002), Meta doğrulaması geçer, ayar satırı aynen; secret.key değişince yeni çift ÜRETİLMEZ (ready false + neden, satır aynen)", { timeout: 180_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-we-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    const rootFile = resolveDbPath(dataDir);
    let ctx = await startOnce({ dataDir, backupDir, maxCompanies: 2, env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const first = await info(ctx);
      const created = await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const second = created.data.data.company || created.data.data;
      await ctx.close();
      const rowBefore = webhookRow(rootFile);
      assert.ok(rowBefore, "ön koşul: çift üretildi");
      setSchema(rootFile, LATEST_VERSION + 1);
      ctx = await startOnce({ dataDir, backupDir, maxCompanies: 2, env: DEAD, connect: false, ack: false, office: null });
      assert.equal(ctx.server.app.schemaGate?.version, LATEST_VERSION + 1, "ön koşul: 001 kapıda");
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      assert.deepEqual(await info(ctx), first, "var olan çift okunur, aynen gösterilir (001)");
      assert.deepEqual(await info(ctx, `?hofCompany=${encodeURIComponent(second.id)}`), first, "002'den de aynı");
      const res = await verifyGet(await remoteOf(ctx), first, 515);
      assert.deepEqual([res.status, res.text], [200, "515"], "Meta'nın doğrulaması kapıda da geçer (okuma)");
      await ctx.close();
      assert.equal(webhookRow(rootFile), rowBefore, "001'deki webhook ayarı değişmedi");
      // Veri başka bilgisayara taşındı (secret.key farklı): yeniden üretim YAZMA olurdu → kapıda üretilmez.
      writeFileSync(path.join(dataDir, "secret.key"), randomBytes(32).toString("base64"));
      ctx = await startOnce({ dataDir, backupDir, maxCompanies: 2, env: DEAD, connect: false, ack: false, office: null });
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const moved = await info(ctx);
      assert.deepEqual([moved.ready, moved.callbackUrl, moved.verifyToken, moved.reason], [false, "", "", SCHEMA_AHEAD], "açılamayan çift kapıda yeniden üretilmez");
      await ctx.close();
      assert.equal(webhookRow(rootFile), rowBefore, "secret.key değişse de 001'deki webhook ayarı aynen");
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });

  // ---------- 2.5.0 WE dar kontrol DÜŞÜK-1 (baş mimar kararı (2)): 001 geri yüklemesi kurulum başına çifti korur (company-backups.mjs COMMON_SETTINGS) ----------
  // Nasıl bozulur: yedek çift ilk gösterilmeden ÖNCE alınmış (yedekte satır yok) → geri yükleme satırı siler → yeni çift, Meta'daki eski adres 404. Ters sıra (yedek SONRA) da denenir.
  // Ders 48: 001 geri yüklemesi yeniden açılışta dosya takası yapar (applyStagedRestore: kopyala, -wal/-shm sil, yeniden adlandır).
  for (const order of ["ÖNCE", "SONRA"]) {
    it(`WE-9 001 yedekten geri yüklenir (yedek çift gösterilmeden ${order} alınmış): çift AYNI, Meta'ya girilmiş eski çiftle doğrulama 200`, { timeout: 180_000 }, async () => {
      const root = mkdtempSync(path.join(tmpdir(), "destekofis-we-"));
      const dataDir = path.join(root, "data");
      const backupDir = path.join(root, "backups");
      let ctx = await startOnce({ dataDir, backupDir, env: DEAD });
      try {
        ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
        let backupName = "";
        const takeBackup = async () => {
          const backup = await ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
          assert.equal(backup.status, 200, JSON.stringify(backup.data));
          backupName = backup.data.data.name;
        };
        if (order === "ÖNCE") await takeBackup();
        const first = await info(ctx);
        if (order === "SONRA") await takeBackup();
        const restore = await ctx.api.post("/api/admin/backups/restore", { name: backupName, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
        assert.equal(restore.status, 200, JSON.stringify(restore.data));
        await ctx.close();
        ctx = await startOnce({ dataDir, backupDir, env: DEAD, connect: false, ack: false });
        const applied = JSON.parse(ctx.store.setting("backup.lastRestore", "{}") || "{}");
        assert.deepEqual([applied.ok, applied.name], [true, backupName], `ön koşul: geri yükleme uygulandı (${JSON.stringify(applied)})`);
        ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
        const base = await remoteOf(ctx);
        const early = await verifyGet(base, first, 61);
        assert.deepEqual([early.status, early.text], [200, "61"], "geri yüklemeden sonra (yeniden gösterimden önce) eski çiftle doğrulama");
        assert.deepEqual(await info(ctx), first, "geri yüklemeden sonra aynı değerler");
        const late = await verifyGet(base, first, 62);
        assert.deepEqual([late.status, late.text], [200, "62"], "yeniden gösterimden sonra da eski çiftle doğrulama");
      } finally {
        await ctx.close();
        removeTestDir(root);
      }
    });
  }
});

// ---------- 2.5.0 BİRLEŞİK TUR 5 madde 5 (WE + BS-7 dar kontrol ORTA-1; gerileme + "kime kaç kez"): 001 geri yüklemesinde kurulum başına çift ----------
// BAŞ MİMAR KARARI (ders 40; gerekçe: kurulum başına çift + ilke (4) çıkmaz yok / (5) taşınan-geri yüklenen veri): canlıda çift VARSA canlınınki, YOKSA yedeğinki kalır.
// Nasıl bozulur (dar kontrol betiği dk-webs7-is/senaryo.mjs): 001'in veri dosyası kaybolur / bozulur, program boş 001 ile açılır, kullanıcı yedekten geri yükler → yedekteki
// DOĞRU çift silinir, Meta'daki adres 404 (07e7056f'de 200); veri başka bilgisayara secret.key ile taşınınca da aynı. Eski kodda (3fe5a92d / 578c12d4) WE-10 ve WE-11 404 ile
// kırmızı (beklenen neden). WE-12 kararın öbür yarısı (canlıda çift var, yedektekinden farklı → canlınınki) — eski kodda da yeşil (G3: korunan davranış).
// Ders 48 (Windows): WE-10 program kapalıyken 001 veri dosyasını (-wal / -shm dahil) SİLER; WE-11 yedek dosyasını ve secret.key'i başka veri klasörüne KOPYALAR; üçü de geri
// yüklemede dosya takası yapar (applyStagedRestore).
async function backup001(ctx) {
  const backup = await ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
  assert.equal(backup.status, 200, JSON.stringify(backup.data));
  return backup.data.data.name;
}
async function restore001Applied(ctx, name, options) {
  const restore = await ctx.api.post("/api/admin/backups/restore", { name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
  assert.equal(restore.status, 200, JSON.stringify(restore.data));
  await ctx.close();
  const next = await startOnce(options);
  const applied = JSON.parse(next.store.setting("backup.lastRestore", "{}") || "{}");
  assert.deepEqual([applied.ok, applied.name], [true, name], `ön koşul: geri yükleme uygulandı (${JSON.stringify(applied)})`);
  return next;
}
describe("2.5.0 BİRLEŞİK TUR 5 — 001 geri yüklemesinde webhook çifti: canlıda varsa canlınınki, yoksa yedeğinki", () => {
  it("WE-10 001'in veri dosyası kayboldu (secret.key duruyor) → boş 001 açıldı → yedekten geri yüklendi: Meta'ya girilmiş çiftle doğrulama 200, gösterilen çift AYNI", { timeout: 180_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-we-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    const rootFile = resolveDbPath(dataDir);
    let ctx = await startOnce({ dataDir, backupDir, env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const first = await info(ctx);
      assert.equal((await verifyGet(await remoteOf(ctx), first, 70)).status, 200, "ön koşul: çift Meta'da doğrulandı");
      const name = await backup001(ctx);
      await ctx.close();
      for (const suffix of ["", "-wal", "-shm"]) rmSync(`${rootFile}${suffix}`, { force: true });
      assert.equal(existsSync(rootFile), false, "ön koşul: 001 veri dosyası yok");
      assert.equal(existsSync(path.join(dataDir, "secret.key")), true, "ön koşul: secret.key duruyor");
      const options = { dataDir, backupDir, env: DEAD, connect: false, ack: false, office: null };
      ctx = await startOnce(options);
      assert.equal(ctx.store.setting(KEY, null), null, "ön koşul: boş 001'de çift yok (canlıda çift YOK)");
      ctx = await restore001Applied(ctx, name, options);
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const base = await remoteOf(ctx);
      const early = await verifyGet(base, first, 71);
      assert.deepEqual([early.status, early.text], [200, "71"], "geri yüklemeden sonra (yeniden gösterimden önce) Meta'daki çiftle doğrulama");
      assert.deepEqual(await info(ctx), first, "gösterilen çift yedektekiyle (Meta'daki) aynı");
      const late = await verifyGet(base, first, 72);
      assert.deepEqual([late.status, late.text], [200, "72"], "yeniden gösterimden sonra da doğrulama");
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });

  it("WE-11 veri başka bilgisayara secret.key ile taşındı (yeni kurulumda çift hiç gösterilmedi) → 001 yedeği geri yüklendi: Meta'daki çiftle doğrulama 200, gösterilen çift AYNI", { timeout: 180_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-we-"));
    const dataA = path.join(root, "dataA");
    const backupA = path.join(root, "backupsA");
    const dataB = path.join(root, "dataB");
    const backupB = path.join(root, "backupsB");
    let ctx = await startOnce({ dataDir: dataA, backupDir: backupA, env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const first = await info(ctx);
      const name = await backup001(ctx);
      await ctx.close();
      const optionsB = { dataDir: dataB, backupDir: backupB, env: DEAD, connect: false, ack: false, office: null };
      ctx = await startOnce(optionsB);
      const companies = ctx.server.app.companies;
      const folderB = companies.dirsOf(companies.get("sirket-001")).backupDir;
      const fromA = readdirSync(backupA, { recursive: true }).map(String).find(item => item.endsWith(name));
      assert.ok(fromA, "ön koşul: yedek A'nın yedek klasöründe");
      await ctx.close();
      mkdirSync(folderB, { recursive: true });
      copyFileSync(path.join(backupA, fromA), path.join(folderB, name));
      copyFileSync(path.join(dataA, "secret.key"), path.join(dataB, "secret.key"));
      ctx = await startOnce(optionsB);
      assert.equal(ctx.store.setting(KEY, null), null, "ön koşul: yeni kurulumda çift yok (canlıda çift YOK)");
      ctx = await restore001Applied(ctx, name, optionsB);
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const res = await verifyGet(await remoteOf(ctx), first, 81);
      assert.deepEqual([res.status, res.text], [200, "81"], "taşınan kurulumda Meta'daki (eski bilgisayarın) çiftle doğrulama");
      assert.deepEqual(await info(ctx), first, "gösterilen çift aynı");
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });

  it("WE-12 canlıda çift VAR ve yedektekinden farklı → geri yüklemede canlınınki kalır (yedekteki eski çift 404); kararın öbür yarısı", { timeout: 180_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-we-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    const options = { dataDir, backupDir, env: DEAD, connect: false, ack: false, office: null };
    let ctx = await startOnce({ dataDir, backupDir, env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const old = await info(ctx);
      const name = await backup001(ctx);
      // Canlıda yeni çift (Meta'ya yeniden girilmiş olan): eski satır kalkar, yeniden gösterimde yeni çift üretilir.
      ctx.store.run("DELETE FROM settings WHERE key = ?", KEY);
      const live = await info(ctx);
      assert.notEqual(live.verifyToken, old.verifyToken, "ön koşul: canlıdaki çift yedektekinden farklı");
      ctx = await restore001Applied(ctx, name, options);
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const base = await remoteOf(ctx);
      const kept = await verifyGet(base, live, 91);
      assert.deepEqual([kept.status, kept.text], [200, "91"], "canlıdaki çiftle doğrulama");
      assert.equal((await verifyGet(base, old, 92)).status, 404, "yedekteki eski çift geri gelmedi");
      assert.deepEqual(await info(ctx), live, "gösterilen çift canlınınki");
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });
});

// ---------- 2.5.0 BİRLEŞİK TUR 5 madde 7 (WhatsApp tur 1 yan ölçümü docs/kanit/2026-11-06/watur1-yan-olcum-salt-okunur.txt): salt okunur lisansta çift üretilmez ----------
// BAŞ MİMAR KARARI (ders 40; WE + BS-7 ile aynı düzen — "okuma yazma değildir"; salt okunurda tünel kapalı, Meta doğrulaması zaten geçemez): çift YOKSA ÜRETİLMEZ (ready false +
// Türkçe neden, ayar satırı yok); var olan çift OKUNUR ve gösterilir; bu bilgisayarda açılamayan çift yeniden üretilmez. Neden metni görev metninden (koddan değil).
// Düzenek: çifti üreten nesne (createAppWebhook) gerçek SQLite deposuyla; lisans durumu reveal'in ikinci bağımsız değişkeniyle ({ writable: false }). Eski kodda (578c12d4)
// ikinci değişken yok sayılır → çift üretilir (beklenen kırmızı neden: "salt okunurda çift üretilmez" denetimi).
// Ders 48 (Windows): hücre geçici klasörde secret.key'i DEĞİŞTİRİR (veri başka bilgisayara taşındı benzetimi); depo kapatılıp klasör silinir.
const READ_ONLY = "Lisans salt okunur; Webhook Bilgileri lisans etkinleşince gösterilir.";
describe("2.5.0 BİRLEŞİK TUR 5 — salt okunur lisansta Webhook Bilgileri çifti üretmez", () => {
  it("WE-13 salt okunur: çift YOK → ready false + neden, değer boş, ayar satırı yok; yazılabilir olunca üretilir; çift VARKEN salt okunur → aynı çift; açılamayan çift salt okunurda yeniden üretilmez", () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-we-ro-"));
    const db = openDatabase(path.join(root, "a.sqlite"));
    try {
      db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT, updated_by TEXT)");
      const store = createStore(db);
      const row = () => store.get("SELECT value, updated_at AS updatedAt FROM settings WHERE key = ?", KEY) || null;
      const hooks = createAppWebhook({ store, dataDir: root, now: () => new Date("2026-11-06T09:00:00Z") });
      const none = hooks.reveal(PUBLIC, { writable: false });
      assert.deepEqual([none.ready, none.callbackUrl, none.verifyToken, none.reason], [false, "", "", READ_ONLY], "salt okunurda çift üretilmez");
      assert.equal(row(), null, "salt okunurda ayar satırı yazılmadı");
      assert.deepEqual(hooks.reveal(PUBLIC, { writable: false }), none, "ikinci soruşta da üretilmez");
      assert.equal(row(), null);
      const made = hooks.reveal(PUBLIC, { writable: true });
      assert.equal(made.ready, true, "lisans yazılabilir olunca çift üretilir (çıkmaz yok)");
      assert.match(made.verifyToken, /^[A-Za-z0-9_-]{43}$/);
      const saved = row();
      assert.ok(saved, "ayar satırı yazıldı");
      assert.deepEqual(hooks.reveal(PUBLIC, { writable: false }), made, "çift varken salt okunurda aynı çift gösterilir");
      assert.deepEqual(row(), saved, "satır aynen");
      assert.deepEqual(hooks.reveal(PUBLIC), made, "lisans bilgisi verilmezse (bugünkü çağıran) davranış aynen");
      // Veri başka bilgisayara taşındı (secret.key farklı): yeniden üretim yazma olurdu → salt okunurda üretilmez.
      writeFileSync(path.join(root, "secret.key"), randomBytes(32));
      const moved = createAppWebhook({ store, dataDir: root, now: () => new Date("2026-11-06T09:00:00Z") });
      const gated = moved.reveal(PUBLIC, { writable: false });
      assert.deepEqual([gated.ready, gated.callbackUrl, gated.verifyToken, gated.reason], [false, "", "", READ_ONLY], "açılamayan çift salt okunurda yeniden üretilmez");
      assert.deepEqual(row(), saved, "satır aynen (secret.key değişse de)");
    } finally {
      db.close();
      removeTestDir(root);
    }
  });
});
