// 2.5.0 WE — "Elle Bağla"nın UYGULAMA DÜZEYİ webhook bilgileri (Callback URL + Verify token) programda (plan docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 WE; 2.4.9 teslim notu (d)).
// Hedef (plandan / görev metninden): program iki değeri kendisi gösterir — kurulum başına üretilen belirteç (yalnız yöneticiye görünür) ve kapıcıdan geçen adres; kılavuzdaki
// "DestekOfis desteğinden alın" kalkar. Belirteç gizli bilgidir: günlüğe, yedeğe / dosyaya (açık hâli), hata iletisine, başka uçların yanıtına girmez; yetkisiz kullanıcı göremez.
// Meta'nın "Verify and save" doğrulaması (GET hub.verify_token → hub.challenge) bu adreste geçer; adrese düşen POST kabul edilir ama İŞLENMEZ (teslim / sayaç / bildirim yolu
// işareti değişmez — "kime kaç kez" kuralları aynen).
// Düzenek: GERÇEK program + yerel sahte Meta (aynı el — kâhin DEĞİL, ders 5) + programın uzak dinleyicisi (kapıcının geçirdiği istek; kapıcı yokken işaret denetimi yok).
// Ders 30: lisans servisi yerel ölü adres. Ders 13: sahte saat. TZ=UTC ve TZ=Europe/Istanbul. Eski kodda (taban f5b34f31) uç yok → 404 (beklenen neden: program göstermiyor).
// Ders 48 (Windows): bir hücre secret.key'i DEĞİŞTİRİR (program kapalıyken; veri başka bilgisayara taşındı benzetimi).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
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

  it("WE-2 Meta doğrulaması: GET doğru belirteç → 200 challenge, yanlış / eksik → 403; POST 200 ama İŞLENMEZ (iş Meta Kabul Etti kalır, defterde teslim ve bildirim yolu işareti yok); WABA adresi aynen çalışır", { timeout: 120_000 }, async () => {
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
      assert.equal((await ctx.jobs(batch.data.data.batch.id))[0].state, "accepted", "POST işlenmedi: iş Meta Kabul Etti");
      assert.deepEqual(ledger(), before, "defterde teslim ve bildirim yolu işareti değişmedi");
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
});
