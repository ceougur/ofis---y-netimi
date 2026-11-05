// 2.5.0 W-1(a) BELİRTEÇ SÜRESİ — plan docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 W-1 (a) ("bağlantının belirteç süresini izle; bitişe 7 gün kala ve sonra her gün en çok bir kez
// 'WhatsApp bağlantınızın süresi doluyor — yeniden bağlayın' uyarısı (Yönetim → WhatsApp + bildirim); süre dolunca gönderim başlatılamaz, neden görünür yazı; 'Yeniden Bağla' her
// zaman açık"), docs/devir/2.5.0-DEVREDEN.md W-1 (Yol 2 yapılandırması 60 GÜN, değiştirilemez) ve görev metni (05.11.2026: süre Meta yanıtında varsa kaydedilir, yoksa Yol 2 için
// bağlanma anı + 60 gün, Yol 1 süresiz; Meta 190 / OAuthException → "Süresi Doldu"). Beklenen sayılar bu metinlerden ve testin girdiği veriden yazıldı, programın kodundan değil
// (ders 5). "Kime kaç kez" (plan §1 W-1): ileti göndermez → kişiye ileti etkisi yok; süre dolunca Meta'ya ileti isteği GİTMEZ; Yeniden Bağla → Devam Et aynı kişiye ikinci ileti
// göndermez (ilke 1, 3).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL; gerçek Meta'ya istek YOK — ders 30) + elle sürülen işçi (ders 20) + sahte saat (ders 13). Yol 2 bağlantısı
// programın kendi kaydetme yoluyla (connection.saveEmbedded — WhatsApp'ı Bağla rotasının çağırdığı işlev) ya da kapıcı taklidiyle rotanın tamamından kurulur. Dosya TZ=UTC ve
// TZ=Europe/Istanbul ile koşulur (gün dönümü — ders 13, 22).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";
import { waBaglam, waSifrele } from "../server/lib/kapi-protokol.mjs";

const DAY = 86_400_000;
const T0 = Date.parse("2026-11-05T10:00:00+03:00");
const iso = ms => new Date(ms).toISOString();
const NOTICE = `${URLS.conn}/expiry-notice`;
const APP = "1505264761663625";
const WARN_TEXT = "WhatsApp bağlantınızın süresi doluyor — yeniden bağlayın";
const metaError = (code, message, subcode = null) => ({ error: { message, type: "OAuthException", code, ...(subcode ? { error_subcode: subcode } : {}), fbtrace_id: "AbCdEf" } });

const adminRow = ctx => ctx.store.get("SELECT * FROM users WHERE username = 'admin'");
/** Yol 2 (WhatsApp'ı Bağla) kaydı programın kendi işleviyle (rota kapıcıdan gelen belirteçle bunu çağırır). extra: Meta'nın süre alanları (kapıcı aktarırsa). */
function embedded(ctx, extra = {}) {
  ctx.server.app.context.whatsapp.connection.saveEmbedded(adminRow(ctx), { token: TOKEN, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH", appId: APP, ...extra });
}
async function view(ctx) {
  const res = await ctx.api.get(URLS.conn);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data.data;
}
async function sina(ctx, expected = 200) {
  const res = await ctx.api.post(`${URLS.conn}/test`, {});
  assert.equal(res.status, expected, `Bağlantıyı Sına ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  return res;
}
const notice = async (api, expected = 200) => {
  const res = await api.post(NOTICE, {});
  assert.equal(res.status, expected, `bildirim ucu ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`);
  return res.data.data;
};
const newBatch = (ctx, ids) => ctx.api.post(URLS.batches, { kind: "statement", ids, preset: "thisMonth" });
const expiredRefusal = (res, label) => {
  assert.equal(res.status, 409, `${label}: 409 bekleniyordu, geldi ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  assert.equal(res.data.code, "whatsapp-token-expired", `${label}: kod`);
  assert.match(res.data.error, /süresi doldu/, `${label}: Türkçe neden`);
  assert.match(res.data.error, /Yeniden Bağla/, `${label}: ne yapılacağı yazılı`);
};

describe("2.5.0 W-1(a) — WhatsApp bağlantısının belirteç süresi", () => {
  it("Yol 1 (Elle Bağla): süresiz sayılır — 400 gün sonra da uyarı yok, gönderim açık; bildirim ucu göstermez ve gün yazmaz", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true } });
    try {
      await sina(ctx);
      let data = await view(ctx);
      assert.deepEqual([data.mode, data.tokenExpiry?.state, data.tokenExpiry?.expiresAt, data.tokenExpiry?.source], ["manual", "ok", null, ""], JSON.stringify(data.tokenExpiry));
      ctx.clock.set(T0 + 400 * DAY);
      data = await view(ctx);
      assert.equal(data.tokenExpiry?.state, "ok", "Yol 1 bitiş anı yok → 400 gün sonra da Süresi Doldu değil");
      assert.equal((await notice(ctx.api)).show, false, "uyarı yok");
      assert.equal(ctx.store.all("SELECT key FROM settings WHERE key LIKE 'whatsapp.expiryNotice.%'").length, 0, "uyarı yokken gün yazılmaz");
      const a = await ctx.account("Ali Veli", "0532 100 00 01", 100);
      assert.equal((await newBatch(ctx, [a.id])).status, 200, "gönderim başlatılır");
    } finally {
      await ctx.close();
    }
  });

  it("Yol 2 (WhatsApp'ı Bağla): bitiş = bağlanma + 60 gün; bitişe 7 gün kala 'doluyor' (gün sayısı), bitişte 'Süresi Doldu' — gönderim / önizleme / deneme 409 Türkçe neden, Meta'ya ileti yok; Bağlantıyı Sına açık; Yeniden Bağla yeni 60 gün", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true }, connect: false });
    try {
      embedded(ctx);
      let data = await view(ctx);
      assert.equal(data.mode, "embedded");
      assert.deepEqual([data.tokenExpiry?.expiresAt, data.tokenExpiry?.source, data.tokenExpiry?.state, data.tokenExpiry?.daysLeft], [iso(T0 + 60 * DAY), "default", "ok", 60], JSON.stringify(data.tokenExpiry));
      await sina(ctx);
      const [a, b, c] = [await ctx.account("Kişi Bir", "0532 200 00 01", 100), await ctx.account("Kişi İki", "0532 200 00 02", 100), await ctx.account("Kişi Üç", "0532 200 00 03", 100)];
      // Bitişe 7 günden fazla: uyarı yok.
      ctx.clock.set(T0 + 53 * DAY - 1);
      data = await view(ctx);
      assert.equal(data.tokenExpiry?.state, "ok", "53. günden 1 ms önce uyarı yok");
      assert.equal((await notice(ctx.api)).show, false);
      // Bitişe tam 7 gün: uyarı (gönderim yine açık).
      ctx.clock.set(T0 + 53 * DAY);
      data = await view(ctx);
      assert.equal(data.tokenExpiry?.state, "expiring", "bitişe 7 gün kala uyarı");
      assert.equal(data.tokenExpiry?.daysLeft, 7);
      assert.ok(data.tokenExpiry.message.startsWith(WARN_TEXT) && /7 gün kaldı/.test(data.tokenExpiry.message), data.tokenExpiry.message);
      assert.equal((await newBatch(ctx, [a.id])).status, 200, "süre dolmadan gönderim başlar");
      await ctx.drain();
      assert.equal(ctx.messageRequests().length, 1, "ön koşul: bir ileti Meta'ya gitti");
      ctx.clock.set(T0 + 60 * DAY - 1);
      assert.match((await view(ctx)).tokenExpiry.message, /1 günden az kaldı/);
      // Bitiş anı: Süresi Doldu.
      ctx.clock.set(T0 + 60 * DAY);
      data = await view(ctx);
      assert.deepEqual([data.tokenExpiry?.state, data.tokenExpiry?.expiredBy], ["expired", "clock"], JSON.stringify(data.tokenExpiry));
      const before = ctx.fake.requests.length;
      expiredRefusal(await ctx.api.post(URLS.preview, { kind: "statement", ids: [b.id], preset: "thisMonth" }), "önizleme");
      expiredRefusal(await newBatch(ctx, [b.id]), "yeni gönderim");
      expiredRefusal(await ctx.api.post(`${URLS.conn}/self-test`, { to: "0532 999 88 77" }), "Kendime Deneme Gönder");
      assert.equal(ctx.fake.requests.length, before, "süresi dolan bağlantıyla Meta'ya hiçbir istek gitmedi (okuma da)");
      const status = (await ctx.api.get("/api/workspace/whatsapp/sending-status")).data.data;
      assert.match(status.linkBlock, /süresi doldu/, `gönderim ekranının nedeni: ${status.linkBlock}`);
      // Bağlantıyı Sına açık kalır (Meta belirteci kabul etse de bitiş anı kaynaklı Süresi Doldu Sına ile kalkmaz — yeniden bağlanmak gerekir).
      await sina(ctx);
      assert.equal((await view(ctx)).tokenExpiry?.state, "expired", "bitiş anı geçti: Sına başarılı olsa da Süresi Doldu");
      assert.equal(ctx.messageRequests().length, 1, "Meta'ya yeni ileti gitmedi");
      // Yeniden Bağla (WhatsApp'ı Bağla yeniden): yeni 60 gün, gönderim açılır.
      embedded(ctx);
      data = await view(ctx);
      assert.deepEqual([data.tokenExpiry?.state, data.tokenExpiry?.expiresAt], ["ok", iso(T0 + 120 * DAY)], JSON.stringify(data.tokenExpiry));
      assert.equal((await newBatch(ctx, [c.id])).status, 200, "yeniden bağlandıktan sonra gönderim başlar");
    } finally {
      await ctx.close();
    }
  });

  it("süren toplu iş: bitiş anı gelince işçi Meta'ya ileti isteği göndermeden duraklatır (neden 'süresi doldu'); Devam Et 409; Yeniden Bağla → Devam Et → kalan kişilere gider, aynı kişiye ikinci ileti yok", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true }, connect: false });
    try {
      embedded(ctx);
      await sina(ctx);
      const ids = [];
      for (let i = 1; i <= 3; i += 1) ids.push((await ctx.account(`Süren ${i}`, `0532 300 00 0${i}`, 100)).id);
      ctx.clock.set(T0 + 60 * DAY - 10 * 60_000);
      const res = await newBatch(ctx, ids);
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      const batchId = res.data.data.batch.id;
      await ctx.drain({ max: 1 });
      assert.equal(ctx.messageRequests().length, 1, "ön koşul: süre dolmadan bir ileti gitti");
      ctx.clock.set(T0 + 60 * DAY);
      await ctx.drain();
      const detail = await ctx.detail(batchId);
      const batch = detail.batch || detail;
      assert.equal(batch.state, "paused", `toplu iş duraklatıldı (geldi ${batch.state})`);
      assert.equal(batch.pauseCode, "token-expired");
      assert.match(batch.pauseReason, /süresi doldu/);
      assert.match(batch.pauseReason, /Devam Et/);
      assert.equal(ctx.messageRequests().length, 1, "süre dolunca Meta'ya ileti isteği gitmedi");
      expiredRefusal(await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {}), "Devam Et");
      embedded(ctx); // Yeniden Bağla
      const resumed = await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {});
      assert.equal(resumed.status, 200, JSON.stringify(resumed.data).slice(0, 300));
      await ctx.drain();
      const sentTo = ctx.messageRequests().map(item => item.body?.to);
      assert.equal(sentTo.length, 3, "toplam 3 ileti (kişi başına bir)");
      assert.equal(new Set(sentTo).size, 3, `aynı kişiye ikinci ileti yok: ${sentTo.join(", ")}`);
    } finally {
      await ctx.close();
    }
  });

  it("Meta 190, Meta'nın daha önce kabul ettiği belirteçte: bağlantı 'Süresi Doldu' (Meta); toplu iş duraklar, yeni gönderim / Devam Et 409; yeni belirteçle Yeniden Bağla → Devam Et; Sına başarılıysa kalkar", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true } });
    try {
      await sina(ctx);
      const a = await ctx.account("Meta Bir", "0532 400 00 01", 100);
      const b = await ctx.account("Meta İki", "0532 400 00 02", 100);
      const res = await newBatch(ctx, [a.id, b.id]);
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      const batchId = res.data.data.batch.id;
      // Müşteri belirteci Meta'da kaldırdı / süresi doldu: Meta artık 190 verir.
      ctx.fake.set({ token: "META-ARTIK-BASKA-BELIRTEC" });
      await ctx.drain();
      let data = await view(ctx);
      assert.deepEqual([data.tokenExpiry?.state, data.tokenExpiry?.expiredBy], ["expired", "meta"], JSON.stringify(data.tokenExpiry));
      assert.match(data.tokenExpiry.message, /Meta erişim belirtecini artık kabul etmiyor/);
      assert.equal(ctx.messages().length, 0, "Meta'nın kabul ettiği ileti yok");
      assert.ok(ctx.store.all("SELECT type FROM audit_events WHERE type = 'whatsapp.token.expired'").length === 1, "işlem geçmişinde bir kez");
      const c = await ctx.account("Meta Üç", "0532 400 00 03", 100);
      expiredRefusal(await newBatch(ctx, [c.id]), "yeni gönderim");
      expiredRefusal(await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {}), "Devam Et");
      // Bağlantıyı Sına açık: Meta yine 190 → Süresi Doldu sürer.
      await sina(ctx, 502);
      assert.equal((await view(ctx)).tokenExpiry?.state, "expired");
      // Yeniden Bağla (Elle Bağla, yeni belirteç).
      const FRESH = "SAHTE-W1a-yeni-belirtec_0123456789-yenilendi";
      ctx.fake.set({ token: FRESH });
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: FRESH })).status, 200);
      data = await view(ctx);
      assert.deepEqual([data.tokenExpiry?.state, data.tokenExpiry?.expiresAt], ["ok", null], "yeni Yol 1 belirteci: süresiz, Süresi Doldu kalktı");
      const resumed = await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {});
      assert.equal(resumed.status, 200, JSON.stringify(resumed.data).slice(0, 300));
      await ctx.drain();
      const jobs = await ctx.jobs(batchId);
      const accepted = jobs.filter(job => job.state === "accepted").length;
      assert.ok(accepted >= 1 && jobs.every(job => ["accepted", "failed"].includes(job.state)), `190 reddi ileti sayılmaz (ilke 1); kalan yeni belirteçle gitti: ${jobs.map(job => job.state)}`);
      assert.equal(ctx.messages().length, accepted, "Meta'nın kabul ettiği ileti sayısı = kabul edilen iş sayısı (yalnız yeni belirteçle)");
      assert.equal(new Set(ctx.messages().map(item => item.to)).size, ctx.messages().length, "aynı kişiye ikinci ileti yok");
      // Meta 190 sonrası belirteç Meta'da yeniden kabul edilirse (ör. geçici iptal geri alındı): başarılı Sına Süresi Doldu'yu kaldırır.
      ctx.fake.set({ token: "IKINCI-KEZ-REDDEDILEN" });
      await sina(ctx, 502);
      assert.equal((await view(ctx)).tokenExpiry?.state, "expired", "çalışmış belirteç yeniden reddedildi");
      ctx.fake.set({ token: FRESH });
      await sina(ctx);
      assert.equal((await view(ctx)).tokenExpiry?.state, "ok", "Meta belirteci kabul etti → Süresi Doldu kalktı");
    } finally {
      await ctx.close();
    }
  });

  it("Meta 190 ama belirteç hiç çalışmamış (yeni yazılmış, yanlış): Süresi Doldu DEĞİL, 'Sınama Başarısız' kalır; Meta 'süresi doldu' derse (alt kod 463) çalışmamış belirteçte de Süresi Doldu", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true }, connect: false });
    try {
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: "YANLIS-YAZILMIS-BELIRTEC-1234" })).status, 200);
      const res = await sina(ctx, 502);
      assert.equal(res.data.meta?.code, 190, "ön koşul: Meta 190");
      let data = await view(ctx);
      assert.deepEqual([data.tokenExpiry?.state, data.lastTest?.ok], ["ok", false], "yanlış yazılmış belirteç: Sınama Başarısız (Süresi Doldu değil)");
      assert.equal(ctx.store.all("SELECT type FROM audit_events WHERE type = 'whatsapp.token.expired'").length, 0);
      ctx.fake.set({ failNext: { match: /^GET \/\d+\/phone_numbers$/, status: 401, body: metaError(190, "Error validating access token: Session has expired on Thursday, 05-Nov-26.", 463) } });
      await sina(ctx, 502);
      data = await view(ctx);
      assert.deepEqual([data.tokenExpiry?.state, data.tokenExpiry?.expiredBy], ["expired", "meta"], "alt kod 463: Meta açıkça 'süresi doldu' dedi");
    } finally {
      await ctx.close();
    }
  });

  it("bildirim: bitişe 7 gün kala ve sonra her gün EN ÇOK BİR KEZ, kullanıcı başına (programın yerel günü); süre dolunca da günde bir; yetkisiz kullanıcıya uç 403", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true }, connect: false });
    try {
      embedded(ctx);
      const second = await createUser(ctx.server, ctx.api, { username: "w1a-yonetici2", role: "admin" });
      const staff = await createUser(ctx.server, ctx.api, { username: "w1a-personel", role: "personel" });
      assert.equal((await notice(ctx.api)).show, false, "bitişe 60 gün: bildirim yok");
      ctx.clock.set(T0 + 53 * DAY);
      const first = await notice(ctx.api);
      assert.equal(first.show, true, "bitişe 7 gün kala ilk soruşta göster");
      assert.ok(first.message.startsWith(WARN_TEXT), first.message);
      assert.equal((await notice(ctx.api)).show, false, "aynı gün ikinci kez gösterilmez");
      ctx.clock.advance(5 * 3_600_000);
      assert.equal((await notice(ctx.api)).show, false, "aynı gün 5 saat sonra da gösterilmez");
      assert.equal((await notice(second)).show, true, "ikinci yönetici (ayrı kullanıcı) kendi gününde bir kez");
      assert.equal((await notice(second)).show, false);
      await notice(staff, 403);
      // Ertesi yerel gün (gece yarısından 1 sn sonra): yeniden bir kez.
      const local = new Date(ctx.clock.ms());
      ctx.clock.set(new Date(local.getFullYear(), local.getMonth(), local.getDate() + 1, 0, 0, 1).getTime());
      assert.equal((await notice(ctx.api)).show, true, "ertesi gün bir kez");
      assert.equal((await notice(ctx.api)).show, false);
      // Bitiş: Süresi Doldu bildirimi, yine günde bir.
      ctx.clock.set(T0 + 60 * DAY + 3_600_000);
      const done = await notice(ctx.api);
      assert.deepEqual([done.show, done.state], [true, "expired"], JSON.stringify(done));
      assert.match(done.message, /süresi doldu/);
      assert.equal((await notice(ctx.api)).show, false);
    } finally {
      await ctx.close();
    }
  });

  it("Yol 2 süresi Meta yanıtında varsa kaydedilir: expires_in → bağlanma + o süre; data_access_expires_at yalnız KISALTIR; geçersiz değer yok sayılır (60 gün)", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true }, connect: false });
    try {
      const cases = [
        [{ expiresIn: 3600 }, T0 + 3_600_000, "meta"],
        [{ expiresIn: 90 * 86_400 }, T0 + 90 * DAY, "meta"],
        [{ dataAccessExpiresAt: Math.floor((T0 + 30 * DAY) / 1000) }, T0 + 30 * DAY, "meta"],
        [{ dataAccessExpiresAt: Math.floor((T0 + 90 * DAY) / 1000) }, T0 + 60 * DAY, "default"],
        [{ expiresIn: 90 * 86_400, dataAccessExpiresAt: Math.floor((T0 + 45 * DAY) / 1000) }, T0 + 45 * DAY, "meta"],
        [{ expiresIn: -5 }, T0 + 60 * DAY, "default"],
        [{ expiresIn: "abc" }, T0 + 60 * DAY, "default"],
        [{ expiresIn: 1e12 }, T0 + 60 * DAY, "default"],
        [{ dataAccessExpiresAt: Math.floor((T0 - DAY) / 1000) }, T0 + 60 * DAY, "default"],
      ];
      for (const [extra, end, source] of cases) {
        embedded(ctx, extra);
        const data = await view(ctx);
        assert.deepEqual([data.tokenExpiry?.expiresAt, data.tokenExpiry?.source], [iso(end), source], `${JSON.stringify(extra)} → ${JSON.stringify(data.tokenExpiry)}`);
      }
    } finally {
      await ctx.close();
    }
  });

  it("WhatsApp'ı Bağla rotası uçtan uca (kapıcı taklidi): kapıcı Meta'nın expires_in'ini aktarırsa o süre, aktarmazsa (bugünkü kapıcı) bağlanma + 60 gün", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true }, connect: false });
    const realSync = ctx.server.app.context.mobileSync;
    try {
      for (const [forward, end] of [[{ expires_in: 5_184_000 - 86_400 }, T0 + 59 * DAY], [{}, T0 + 60 * DAY]]) {
        let publicKey = null;
        // Kapıcı taklidi (lib/mobile-sync.mjs waOturumAc / waOturumAl biçimi): belirteci programın geçici açık anahtarına şifreler (kapi-protokol waSifrele). Öbür
        // yöntemler (izle, kancaIsareti…) gerçek nesneden (prototip) — yalnız WhatsApp'ı Bağla'nın iki ucu taklit.
        ctx.server.app.context.mobileSync = Object.assign(Object.create(realSync), {
          enabled: () => true,
          waOturumAc: async jwk => {
            publicKey = jwk;
            return { ok: true, ofis: "ofis-w1a", data: { oturum: "S".repeat(43), adres: `https://kapi.destekofis.test/wa/bagla#o=${"S".repeat(43)}` } };
          },
          waOturumAl: async session => ({ ok: true, data: { durum: "hazir", sifreli: await waSifrele(publicKey, TOKEN, waBaglam("ofis-w1a", session)), wabaId: WABA, phoneNumberId: PNID, olay: "FINISH", appId: APP, ...forward } }),
        });
        const start = await ctx.api.post(`${URLS.conn}/embedded`, {});
        assert.equal(start.status, 200, JSON.stringify(start.data).slice(0, 300));
        const done = await ctx.api.post(`${URLS.conn}/embedded/${start.data.data.session}`, {});
        assert.equal(done.status, 200, JSON.stringify(done.data).slice(0, 300));
        assert.equal(done.data.data.state, "ready");
        const exp = done.data.data.connection.tokenExpiry;
        assert.deepEqual([exp?.expiresAt, exp?.source], [iso(end), forward.expires_in ? "meta" : "default"], JSON.stringify(exp));
      }
    } finally {
      ctx.server.app.context.mobileSync = realSync;
      await ctx.close();
    }
  });

  it("ek denetim — 2.5.0 öncesi Yol 2 kaydı (süre alanları yok): bağlanma anı + 60 gün sayılır; Yol 1 kaydı süresiz (gerçek eski kodla göç: test/whatsapp-w1a-goc-250.mjs)", async () => {
    const ctx = await startWa({ now: { time: iso(T0 + 10 * DAY), fixed: true }, connect: false });
    try {
      embedded(ctx);
      const strip = () => {
        const raw = JSON.parse(ctx.store.setting("whatsapp.meta", "{}"));
        for (const key of ["tokenExpiresAt", "tokenExpirySource", "tokenVerifiedAt", "tokenExpired"]) delete raw[key];
        raw.embedded.at = iso(T0);
        raw.savedAt = iso(T0 + 5 * DAY);
        ctx.store.setSetting("whatsapp.meta", JSON.stringify(raw));
      };
      strip();
      let data = await view(ctx);
      assert.deepEqual([data.tokenExpiry?.expiresAt, data.tokenExpiry?.source], [iso(T0 + 60 * DAY), "default"], "bağlanma anı (embedded.at) + 60 gün");
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      const raw = JSON.parse(ctx.store.setting("whatsapp.meta", "{}"));
      for (const key of ["tokenExpiresAt", "tokenExpirySource", "tokenVerifiedAt", "tokenExpired"]) delete raw[key];
      ctx.store.setSetting("whatsapp.meta", JSON.stringify(raw));
      data = await view(ctx);
      assert.deepEqual([data.mode, data.tokenExpiry?.expiresAt], ["manual", null], "eski Yol 1 kaydı süresiz");
    } finally {
      await ctx.close();
    }
  });
});
