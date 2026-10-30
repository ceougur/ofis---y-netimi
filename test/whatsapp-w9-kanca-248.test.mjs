// 2.4.8 W9 — WhatsApp durum bildirimi (web kancası) UÇTAN UCA: sahte Meta → GERÇEK kapıcı (bulut/kapi/kapi.mjs, yerel; test/kapi-yerel.mjs) → sahte "tünel" → GERÇEK
// programın uzak dinleyicisi → lib/whatsapp/hook.mjs → kuyruk (plan §3 C, §6 W9, §11 S1 A; §7a 3, 16–18). Tünel kuralı (lib/tunnel/manager.mjs, "WhatsApp bağlı").
// Ders 30: lisans servisi, Meta ve Cloudflare yalnız yerel sahteler (gerçek ağa istek yok). Ders 13: sahte saat. Sahte Meta ve beklentiler programı yazan elden
// (aynı el — kâhin DEĞİL, ders 5); beklenen davranış plandan: imzasız olay yalnız kaydındaki wamid'i yazar, Sonucu Belirsiz yalnız imzalı + iş kimliğiyle çözülür,
// Yol 2'de imzasız red, kapıcı saklamaz / çerez geçirmez / tünel yoksa 503, gövde ≤ 3 MB.
//
// "Nasıl bozulur": tüneli atlatan istek (işaretsiz / sahte işaret); kapıcının "wa1"i taklit edilir; Meta'nın çerezi / imza başlığı programa geçer; programın
// Set-Cookie'si Meta'ya döner; yanlış belirteçle doğrulama; başka şirketin / bilinmeyen wamid; yinelenen ve sırasız olay; büyük gövde; program kapalı; kanca kaydı
// düşer ve her turda Meta'ya yeniden gider; WhatsApp bağlıyken tünel açılmaz.
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { createTunnelManager } from "../server/lib/tunnel/manager.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { lisansAnahtari } from "./kapi-ortak.mjs";
import { kokeneIlet, startKapi } from "./kapi-yerel.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { OFFICE, PNID, PROGRAM_TEMPLATES, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const DEAD_LICENSE_URL = "http://127.0.0.1:9";
const MACHINE = "0123456789abcdef0123456789abcdef";
const APP_SECRET = "destekofis-uygulama-sirri-SAHTE-0123456789";
const HOUR = 3_600_000;
const sign = (body, secret = APP_SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const statusEvent = (statuses, pnid = PNID) => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: pnid }, statuses } }] }] });
/** Host başlığıyla ham istek (kapıcıya ofisin telefon adresiyle; Node fetch Host'u değiştirmez). */
function raw(base, method, pathAndQuery, { body = null, headers = {} } = {}) {
  const url = new URL(base);
  const payload = body === null ? null : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: pathAndQuery, headers: { ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}), ...headers } }, res => {
      const parts = [];
      res.on("data", chunk => parts.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(parts).toString("utf8");
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
        resolve({ status: res.statusCode, text, data, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const status = (id, value, extra = {}) => ({ id, status: value, timestamp: String(Math.floor(Date.parse("2026-11-03T09:05:00+03:00") / 1000)), recipient_id: "905370000001", ...extra });

/** Program + kapıcı + sahte Meta; kapıcının tünel iletimi kayda alınır (programa geçen başlıklar). */
async function kurulum() {
  const clock = createClock({ time: "2026-11-03T09:00:00+03:00", fixed: true });
  const lisans = lisansAnahtari();
  const belirtec = () => lisans.belirtec({ at: clock.ms(), machine: MACHINE, licenseId: "LIS-W9-TEST" });
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
  fake.state.templates.push(...PROGRAM_TEMPLATES());
  const origins = new Map();
  const forwarded = [];
  const kapi = await startKapi({
    now: () => clock.ms(),
    trustedKeys: lisans.trusted,
    lisansFetch: async () => ({ json: async () => ({ ok: true, token: belirtec() }) }),
    fetchOrigin: async (request, ofis) => {
      forwarded.push({ url: request.url, method: request.method, headers: Object.fromEntries(request.headers) });
      const base = origins.get(ofis);
      if (!base) throw new TypeError("fetch failed (tünel yok)");
      return kokeneIlet(request, base);
    },
  });
  let server;
  try {
    server = await startTestServer({
      now: clock,
      remoteNow: clock,
      mobileKapiUrl: kapi.base,
      env: { HUKUK_LICENSE_URL: DEAD_LICENSE_URL },
      license: { enforce: true, trustedKeys: lisans.trusted, services: ["https://lisans.w9.test/api/lisans"], fetchImpl: async () => ({ status: 200, json: async () => ({ ok: true, token: belirtec() }) }), machineId: MACHINE, now: () => clock.ms(), firstCheckDelayMs: 3_600_000, autoTrial: false },
      whatsappGraphUrl: fake.url,
      whatsappTimeoutMs: 800,
      whatsappGapMs: 0,
      tunnel: { enabled: false, tickMs: 3_600_000, firstTickMs: 3_600_000 },
    });
    await server.app.license.activateKey("DO-ABCDE-FGHJK-MNPQR-STVWX");
    const sync = server.app.mobileSync;
    const ofis = await sync.ofis();
    await sync.kayitGonder();
    const remote = await server.app.listenRemote(0, "127.0.0.1");
    const remoteBase = `http://127.0.0.1:${remote.port}`;
    origins.set(ofis.id, remoteBase);
    const host = kapi.ofisHost(ofis.id);
    server.app.mobileRemote.setPublicUrl(`http://${host}`);
    const api = await loginAdmin(server);
    server.app.store.setSetting("office.name", OFFICE);
    assert.equal((await api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
    assert.equal((await api.put(URLS.ack, { ack: true })).status, 200);
    const wa = server.app.whatsapp;
    const ctx = {
      clock,
      kapi,
      fake,
      server,
      api,
      wa,
      sync,
      ofis,
      host,
      remoteBase,
      origins,
      forwarded,
      store: server.app.store,
      drain: (o = {}) => wa.scheduler.drain(o),
      // Kanca kaydı doğrudan bağlantı nesnesinden (bakım turunun kendiliğinden kaydı ayrı testte): sınanan, kaydın ardından gelen bildirim yolu.
      register: () => server.app.context.whatsapp.connection.registerHook(null, `http://${host}`),
      detail: async id => (await api.get(`${URLS.batches}/${id}`)).data.data,
      secret: () => new URL(fake.state.subscriptions.at(-1).override_callback_uri).pathname.split("/").pop(),
      verifyToken: () => fake.state.subscriptions.at(-1).verify_token,
      /** Meta'nın isteği: kapıcıya, ofisin telefon adresiyle (Host). */
      meta: (method, pathAndQuery, { body = null, headers = {} } = {}) => raw(kapi.base, method, pathAndQuery, { body, headers: { host, ...headers } }),
      async close() {
        await server.close().catch(() => {});
        await kapi.close();
        await fake.close();
      },
    };
    return ctx;
  } catch (error) {
    await server?.close().catch(() => {});
    await kapi.close();
    await fake.close();
    throw error;
  }
}

async function account(ctx, name, phone) {
  const res = await ctx.api.post("/api/workspace/accounts", { name, phone, openingBalance: "10" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data.data.id;
}

describe("2.4.8 W9 — kanca adresinin kaydı ve doğrulaması (Meta → kapıcı → tünel → program)", () => {
  it("bakım turu adresi Meta'ya KENDİLİĞİNDEN kaydeder (bir kez); GET doğrulaması kapıcıdan geçer; yanlış belirteç 403, bilinmeyen gizli yol 404; düşen kayıt saatte bir yeniden; görünümde gizli değer YOK", async () => {
    const ctx = await kurulum();
    try {
      // Kayıt düşerse (Meta hata verir): durum "failed", bir saat içinde yeniden istek YOK, sonra yeniden.
      ctx.fake.state.failQueue.push({ match: /subscribed_apps$/, status: 400, body: { error: { message: "(#100) Invalid parameter", type: "OAuthException", code: 100, fbtrace_id: "x" } } });
      await ctx.drain();
      assert.equal(ctx.fake.state.subscriptions.length, 0);
      let view = (await ctx.api.get(URLS.conn)).data.data;
      assert.equal(view.hook.state, "failed");
      await ctx.drain();
      ctx.clock.advance(30 * 60_000);
      await ctx.drain();
      assert.equal(ctx.fake.requests.filter(item => item.path.endsWith("/subscribed_apps")).length, 1, "bir saat dolmadan Meta'ya yeniden gitmedi");
      ctx.clock.advance(31 * 60_000);
      await ctx.drain();
      assert.equal(ctx.fake.state.subscriptions.length, 1, "bir saat sonra yeniden kaydedildi");
      view = (await ctx.api.get(URLS.conn)).data.data;
      assert.equal(view.hook.state, "active");
      const callback = new URL(ctx.fake.state.subscriptions[0].override_callback_uri);
      assert.equal(callback.host, ctx.host, "adres ofisin telefon adresi");
      assert.match(callback.pathname, /^\/wa\/kanca\/[A-Za-z0-9_-]{43}$/);
      const secret = ctx.secret();
      const token = ctx.verifyToken();
      assert.ok(!JSON.stringify(view).includes(secret) && !JSON.stringify(view).includes(token), "görünümde gizli yol / belirteç yok");
      // Kayıtlı ve etkin: sonraki turlarda Meta'ya yeniden gitmez.
      ctx.clock.advance(2 * HOUR);
      await ctx.drain();
      assert.equal(ctx.fake.requests.filter(item => item.path.endsWith("/subscribed_apps")).length, 2);
      // GET doğrulaması.
      const ok = await ctx.meta("GET", `/wa/kanca/${secret}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=1158201444`);
      assert.equal(ok.status, 200, ok.text);
      assert.equal(ok.text, "1158201444");
      const wrong = await ctx.meta("GET", `/wa/kanca/${secret}?hub.mode=subscribe&hub.verify_token=yanlis&hub.challenge=1`);
      assert.equal(wrong.status, 403);
      assert.equal(wrong.data.code, "whatsapp-hook-verify");
      const unknown = await ctx.meta("GET", `/wa/kanca/${randomBytes(32).toString("base64url")}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=1`);
      assert.equal(unknown.status, 404);
      assert.equal((await ctx.meta("GET", "/wa/kanca/kisa")).status, 404, "biçimsiz yol kapıcıda düşer");
      // Elle "Yeniden Kaydet": yeni gizli yol; eskisi artık geçmez.
      const again = await ctx.api.post(`${URLS.conn}/hook`, {});
      assert.equal(again.status, 200, JSON.stringify(again.data));
      assert.notEqual(ctx.secret(), secret);
      assert.equal((await ctx.meta("GET", `/wa/kanca/${secret}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=1`)).status, 404, "eski gizli yol kapandı");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 W9 — durum bildirimi (POST): imza, belirsizin çözümü, yinelenen / sırasız olay", () => {
  it("imzasız (Yol 1) olay yalnız kaydındaki wamid'i yazar; Sonucu Belirsiz iş imzasız olayla ÇÖZÜLMEZ, yanlış imzayla çözülmez, DestekOfis sırrıyla imzalı + iş kimliğiyle çözülür; bilinmeyen / başka numaranın olayı düşer; gelen ileti saklanmaz; kapıcı Meta'nın başlıklarını geçirmez", async () => {
    const ctx = await kurulum();
    try {
      await ctx.register();
      const secret = ctx.secret();
      const ids = [await account(ctx, "Kanca Bir", "0537 000 00 01"), await account(ctx, "Kanca İki", "0537 000 00 02")];
      const res = await ctx.api.post(URLS.batches, { kind: "statement", ids, preset: "thisMonth" });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const batchId = res.data.data.batch.id;
      await ctx.wa.scheduler.runOnce();
      ctx.fake.state.dropAfter = /^POST \/106540352242922\/messages$/;
      await ctx.wa.scheduler.runOnce();
      ctx.fake.state.dropAfter = null;
      await ctx.drain();
      let jobs = (await ctx.detail(batchId)).jobs;
      const [first, second] = jobs;
      assert.equal(first.state, "accepted");
      assert.equal(second.state, "uncertain", "yanıtı düşen ileti belirsiz");
      const lost = ctx.fake.state.messages.find(item => item.opaque === second.id);
      assert.ok(lost?.wamid, "Meta iletiyi kabul etmişti (sahte Meta'nın kaydı)");
      const post = (body, headers = {}) => ctx.meta("POST", `/wa/kanca/${secret}`, { body, headers });
      // (1) imzasız: teslim → okundu → yinelenen teslim (sırasız) → okundu kalır.
      for (const [value, expected] of [["delivered", "delivered"], ["read", "read"], ["delivered", "read"], ["read", "read"]]) {
        const r = await post(statusEvent([status(first.wamid, value)]));
        assert.equal(r.status, 200, r.text);
        assert.equal((await ctx.detail(batchId)).jobs[0].state, expected, `${value} sonrası`);
      }
      // (2) belirsiz iş: imzasız olay (doğru wamid + iş kimliği) ÇÖZMEZ.
      const resolving = statusEvent([status(lost.wamid, "delivered", { biz_opaque_callback_data: second.id })]);
      assert.equal((await post(resolving)).status, 200);
      assert.equal((await ctx.detail(batchId)).jobs[1].state, "uncertain", "imzasız olay belirsizi çözmedi (§7a 3)");
      // (3) kapıcıda uygulama sırrı var ama imza yanlış → imzasız sayılır.
      ctx.kapi.env.WA_UYGULAMA_SIRRI = APP_SECRET;
      assert.equal((await post(resolving, { "x-hub-signature-256": sign(resolving, "baska-sir") })).status, 200);
      assert.equal((await ctx.detail(batchId)).jobs[1].state, "uncertain", "yanlış imza çözmedi");
      // (4) başka numaranın olayı (aynı wamid'le bile) düşer.
      assert.equal((await post(statusEvent([status(lost.wamid, "delivered", { biz_opaque_callback_data: second.id })], "999999999999999"), { "x-hub-signature-256": sign(statusEvent([status(lost.wamid, "delivered", { biz_opaque_callback_data: second.id })], "999999999999999")) })).status, 200);
      assert.equal((await ctx.detail(batchId)).jobs[1].state, "uncertain", "başka numaranın olayı düştü");
      // (5) imzalı + iş kimliği: çözülür, wamid yazılır, defterde geç kabul.
      assert.equal((await post(resolving, { "x-hub-signature-256": sign(resolving) })).status, 200);
      jobs = (await ctx.detail(batchId)).jobs;
      assert.equal(jobs[1].state, "delivered", "imzalı olay belirsizi çözdü");
      assert.equal(jobs[1].wamid, lost.wamid);
      // (6) bilinmeyen wamid ve gelen müşteri iletisi: 200, hiçbir iş değişmez, ileti içeriği hiçbir yere yazılmaz.
      const incoming = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { metadata: { phone_number_id: PNID }, messages: [{ from: "905370000001", id: "wamid.GELEN", type: "text", text: { body: "GİZLİ-MÜŞTERİ-YAZISI" } }] } }] }] });
      assert.equal((await post(incoming)).status, 200);
      assert.equal((await post(statusEvent([status("wamid.BILINMEYEN", "delivered")]))).status, 200);
      const dump = JSON.stringify(ctx.store.all("SELECT * FROM wa_jobs")) + JSON.stringify(ctx.store.all("SELECT * FROM audit_events ORDER BY rowid DESC LIMIT 50"));
      assert.ok(!dump.includes("GİZLİ-MÜŞTERİ-YAZISI"), "gelen ileti saklanmadı");
      assert.deepEqual((await ctx.detail(batchId)).jobs.map(job => job.state), ["read", "delivered"]);
      // (7) kapıcı Meta'nın başlıklarını programa geçirmez; programa giden istekte kapıcı işareti var.
      const hookForwards = ctx.forwarded.filter(item => new URL(item.url).pathname.startsWith("/wa/kanca/"));
      assert.ok(hookForwards.length >= 8);
      for (const item of hookForwards) {
        assert.ok(item.headers["x-do-kapi"], "kapıcı işareti");
        assert.equal(item.headers["x-hub-signature-256"], undefined, "Meta imza başlığı programa geçmez");
        assert.equal(item.headers.cookie, undefined, "çerez geçmez");
      }
    } finally {
      await ctx.close();
    }
  });

  it("Yol 2 (WhatsApp'ı Bağla) bağlantısında imzasız bildirim REDDEDİLİR (401), DestekOfis sırrıyla imzalı kabul edilir", async () => {
    const ctx = await kurulum();
    try {
      await ctx.register();
      const secret = ctx.secret();
      const id = await account(ctx, "Yol İki", "0537 000 00 05");
      const res = await ctx.api.post(URLS.batches, { kind: "statement", ids: [id], preset: "thisMonth" });
      await ctx.drain();
      const job = (await ctx.detail(res.data.data.batch.id)).jobs[0];
      assert.equal(job.state, "accepted");
      // Bağlantı kaydı Yol 2'ye çevrilir (W7'nin yazacağı "mode": "embedded").
      const raw = JSON.parse(ctx.store.setting("whatsapp.meta", "{}"));
      ctx.store.setSetting("whatsapp.meta", JSON.stringify({ ...raw, mode: "embedded" }));
      const body = statusEvent([status(job.wamid, "delivered")]);
      ctx.kapi.env.WA_UYGULAMA_SIRRI = APP_SECRET;
      const unsigned = await ctx.meta("POST", `/wa/kanca/${secret}`, { body });
      assert.equal(unsigned.status, 401, unsigned.text);
      assert.equal(unsigned.data.code, "whatsapp-hook-signature");
      const forged = await ctx.meta("POST", `/wa/kanca/${secret}`, { body, headers: { "x-hub-signature-256": sign(body, "sahte-sir") } });
      assert.equal(forged.status, 401);
      assert.equal((await ctx.detail(res.data.data.batch.id)).jobs[0].state, "accepted", "imzasız olay yazılmadı");
      const signed = await ctx.meta("POST", `/wa/kanca/${secret}`, { body, headers: { "x-hub-signature-256": sign(body) } });
      assert.equal(signed.status, 200, signed.text);
      assert.equal((await ctx.detail(res.data.data.batch.id)).jobs[0].state, "delivered");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 W9 — kapıcı geçişinin sınırları ve tüneli atlatma", () => {
  it("tünel yok → 503 kapi-ofis-kapali (Meta yeniden dener); gövde 3 MB üstü 413; işaretsiz / sahte işaretli doğrudan istek 401; programın Set-Cookie'si Meta'ya dönmez", async () => {
    const ctx = await kurulum();
    try {
      await ctx.register();
      const secret = ctx.secret();
      const body = statusEvent([status("wamid.X", "delivered")]);
      // Tüneli atlatan istek (uzak dinleyiciye doğrudan): işaretsiz ve sahte işaretli ("wa1" taklidi) → 401.
      const direct = await raw(ctx.remoteBase, "POST", `/wa/kanca/${secret}`, { body, headers: { host: ctx.host } });
      assert.equal(direct.status, 401);
      assert.equal(direct.data.code, "whatsapp-hook-mark");
      const fakeMark = `${ctx.clock.ms()}.wa1.${randomBytes(32).toString("base64url")}`;
      const forged = await raw(ctx.remoteBase, "POST", `/wa/kanca/${secret}`, { body, headers: { host: ctx.host, "x-do-kapi": fakeMark } });
      assert.equal(forged.status, 401, "kapıcının işareti taklit edilemez");
      // Gövde sınırı (kapıcıda).
      const large = await ctx.meta("POST", `/wa/kanca/${secret}`, { body: `{"x":"${"a".repeat(3 * 1024 * 1024)}"}` });
      assert.equal(large.status, 413);
      assert.equal(large.data.code, "kapi-buyuk");
      // Meta çerez gönderse de geçmez; yanıtta çerez yok.
      const withCookie = await ctx.meta("POST", `/wa/kanca/${secret}`, { body, headers: { cookie: "__Host-do-cihaz=dev-1.sir; diger=1" } });
      assert.equal(withCookie.status, 200, withCookie.text);
      assert.equal(withCookie.headers["set-cookie"], undefined);
      assert.equal(ctx.forwarded.at(-1).headers.cookie, undefined);
      // Program kapalı / tünel yok → 503 (JSON; Meta tarayıcı değildir).
      ctx.origins.delete(ctx.ofis.id);
      const closed = await ctx.meta("POST", `/wa/kanca/${secret}`, { body });
      assert.equal(closed.status, 503);
      assert.equal(closed.data.code, "kapi-ofis-kapali");
    } finally {
      await ctx.close();
    }
  });

  it("kapi.<alan>/wa/meta (uygulamanın varsayılan kanca ucu): doğrulama belirteciyle GET, DestekOfis sırrıyla imzalı POST 200 (saklanmaz); imzasız / yanlış / sır tanımsız reddedilir", async () => {
    const kapi = await startKapi({ now: () => Date.now() });
    try {
      const call = (method, pathAndQuery, { body = null, headers = {} } = {}) => raw(kapi.base, method, pathAndQuery, { body, headers: { host: "kapi.destekofis.test", ...headers } });
      const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "message_template_status_update", value: { event: "APPROVED" } }] }] });
      assert.equal((await call("GET", "/wa/meta?hub.mode=subscribe&hub.verify_token=x&hub.challenge=5")).status, 403, "belirteç tanımsız");
      assert.equal((await call("POST", "/wa/meta", { body, headers: { "x-hub-signature-256": sign(body) } })).status, 401, "sır tanımsız");
      kapi.env.WA_UYGULAMA_SIRRI = APP_SECRET;
      kapi.env.WA_META_DOGRULAMA = "meta-dogrulama-belirteci";
      const ok = await call("GET", "/wa/meta?hub.mode=subscribe&hub.verify_token=meta-dogrulama-belirteci&hub.challenge=42");
      assert.equal(ok.status, 200);
      assert.equal(ok.text, "42");
      assert.equal((await call("GET", "/wa/meta?hub.mode=subscribe&hub.verify_token=yanlis&hub.challenge=42")).status, 403);
      assert.equal((await call("POST", "/wa/meta", { body, headers: { "x-hub-signature-256": sign(body) } })).status, 200);
      assert.equal((await call("POST", "/wa/meta", { body })).status, 401, "imzasız");
      assert.equal((await call("POST", "/wa/meta", { body, headers: { "x-hub-signature-256": sign(body, "baska") } })).status, 401, "yanlış imza");
      assert.equal(kapi.r2.nesneler.size, 0, "kapıcı olayı saklamadı");
    } finally {
      await kapi.close();
    }
  });
});

describe("2.4.8 W9 — tünel kuralı: WhatsApp bağlıyken de açık (plan §6 W9, S1 A)", () => {
  const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sahte-cloudflared-dizi.mjs");
  const HOSTNAME = "oabcdefghijklmnop.destekofis.net";
  const TUNNEL_ID = "12345678-1234-4234-8234-123456789abc";
  const LINES = ["2026-10-30T06:52:01Z INF Starting tunnel tunnelID=12345678-1234-4234-8234-123456789abc", "2026-10-30T06:52:01Z INF Registered tunnel connection connIndex=0 connection=6f1c2b3a-0d4e-4f5a-8b6c-7d8e9f0a1b20 event=0 ip=198.41.192.27 location=ist01 protocol=quic"];
  const harness = ({ extra, writable = true }) => {
    const dir = mkdtempSync(path.join(tmpdir(), "w9-tunel-"));
    writeFileSync(path.join(dir, "dizi.json"), JSON.stringify(LINES));
    const settings = new Map();
    let provisions = 0;
    const manager = createTunnelManager({
      store: { setting: (key, fallback) => (settings.has(key) ? settings.get(key) : fallback), setSetting: (key, value) => settings.set(key, value), get: () => ({ n: 0 }) }, // eşli cihaz / karekod YOK
      license: { status: () => ({ writable }) },
      mobileRemote: { setPublicUrl() {} },
      listenRemote: async () => ({ port: 45679 }),
      gate: {
        provision: async () => {
          provisions += 1;
          return { tunnelId: TUNNEL_ID, hostname: HOSTNAME, publicUrl: `https://${HOSTNAME}`, token: "sahteBelirtec-w9" };
        },
      },
      root: path.join(dir, "bilesen"),
      runner: { command: process.execPath, argsPrefix: [FAKE, "--sahte-dizi", path.join(dir, "dizi.json"), "--sahte-klasor", dir], identity: FAKE },
      extraDemand: extra,
      tickMs: 3_600_000,
      firstTickMs: 3_600_000,
      stopGraceMs: 0,
      log: { info() {}, warn() {}, error() {} },
    });
    return { manager, provisions: () => provisions, cleanup: async () => { await manager.stop(); rmSync(dir, { recursive: true, force: true }); } };
  };

  it("eşli cihaz ve karekod YOKKEN: WhatsApp bağlı → tünel açılır; bağlı değil → kapalı (başvuru da yok); salt okunur lisansta WhatsApp bağlı olsa da kapalı", async () => {
    let connected = true;
    const on = harness({ extra: () => connected });
    try {
      await on.manager.tick();
      assert.equal(on.provisions(), 1, "kapıcıya başvuruldu");
      assert.ok(on.manager.pid(), "cloudflared çalışıyor");
      assert.notEqual(on.manager.status().state, "off");
      connected = false;
      await on.manager.tick();
      assert.equal(on.manager.pid(), null, "WhatsApp bağlantısı kalkınca tünel kapandı");
      assert.equal(on.manager.status().state, "off");
    } finally {
      await on.cleanup();
    }
    const off = harness({ extra: () => false });
    try {
      await off.manager.tick();
      assert.equal(off.provisions(), 0);
      assert.equal(off.manager.pid(), null);
    } finally {
      await off.cleanup();
    }
    const readOnly = harness({ extra: () => true, writable: false });
    try {
      await readOnly.manager.tick();
      assert.equal(readOnly.provisions(), 0, "salt okunur lisansta başvuru yok");
      assert.equal(readOnly.manager.pid(), null);
    } finally {
      await readOnly.cleanup();
    }
  });

  it("programda: belirteçli WhatsApp bağlantısı kaydedilince tünel yöneticisi tüneli ister; bağlantı kaldırılınca istemez (app.mjs → registry.anyConfigured)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "w9-tunel-uygulama-"));
    writeFileSync(path.join(dir, "dizi.json"), JSON.stringify(LINES));
    let provisions = 0;
    const gate = {
      provision: async () => {
        provisions += 1;
        return { tunnelId: TUNNEL_ID, hostname: HOSTNAME, publicUrl: `https://${HOSTNAME}`, token: "sahteBelirtec-w9" };
      },
    };
    const ctx = await startWa({ connect: false, ack: false, tunnel: { gate, runner: { command: process.execPath, argsPrefix: [FAKE, "--sahte-dizi", path.join(dir, "dizi.json"), "--sahte-klasor", dir], identity: FAKE }, root: path.join(dir, "bilesen"), tickMs: 3_600_000, firstTickMs: 3_600_000, stopGraceMs: 0 } });
    try {
      const tunnel = ctx.server.app.context.tunnel;
      assert.ok(tunnel, "tünel yöneticisi var");
      await tunnel.tick();
      assert.equal(provisions, 0, "WhatsApp bağlı değil, eşli cihaz yok → tünel istenmez");
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      await tunnel.tick();
      assert.equal(provisions, 1, "WhatsApp bağlandı → tünel istendi");
      assert.ok(tunnel.pid(), "cloudflared başladı");
      assert.equal((await ctx.api.del(URLS.conn)).status, 200);
      await tunnel.tick();
      assert.equal(tunnel.pid(), null, "bağlantı kaldırıldı → tünel kapandı");
    } finally {
      await ctx.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
