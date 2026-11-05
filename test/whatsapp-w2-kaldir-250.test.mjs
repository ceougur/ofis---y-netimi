// 2.5.0 W-2 BAĞLANTIYI KALDIR META'DA DA — plan docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 W-2 ("abonelik (subscribed_apps) silinir + belirteç iptali; sonra yerel kayıt silinir.
// Yerel kaldırma HER ZAMAN yapılır (ilke 4: çıkmaz yok); Meta çağrısı düşerse 'Meta tarafında kaldırılamadı' uyarısı + destekofis.net/veri-silme adımı. İkinci 'Kaldır' etkisiz.
// Bekleyen işler 'Durduruldu' (ilke 1: almadıysa sayılmaz).") ve §3 "Nasıl bozulur" 1 (iki şirket aynı WABA: W-2 kapsamı yalnız kendi aboneliği). Meta belgesi (developers.facebook.com/
// docs/whatsapp/embedded-signup/webhooks, 05.11.2026): DELETE /<WABA_ID>/subscribed_apps → { success: true }; belirteci uygulama tarafından iptal eden uç belgede YOK (yalnız
// abonelik silinir). Beklenen sayılar bu metinlerden ve testin girdiği veriden yazıldı, programın kodundan değil (ders 5).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL; gerçek Meta'ya istek YOK — ders 30) + elle sürülen işçi (ders 20) + sahte saat (ders 13). Dosya TZ=UTC ve
// TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const NOW = { time: "2026-11-05T10:00:00+03:00", fixed: true };
const APP = "1505264761663625";
const VERI_SILME = "https://destekofis.net/veri-silme";
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const ts = ctx => String(Math.floor(ctx.clock.ms() / 1000));
const settingRow = ctx => ctx.store.get("SELECT value FROM settings WHERE key = 'whatsapp.meta'")?.value ?? null;
const unsubscribeRequests = fake => fake.requests.filter(item => item.method === "DELETE" && /\/subscribed_apps$/.test(item.path));
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");

async function removeConn(api, q = "") {
  const res = await api.del(`${URLS.conn}${q}`);
  assert.equal(res.status, 200, `Bağlantıyı Kaldır ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
}
async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
}
const failedAtMeta = (data, reason, label) => {
  assert.equal(data.configured, false, `${label}: yerel bağlantı kaldırıldı (ilke 4)`);
  assert.equal(data.removal?.removed, true, `${label}: removal.removed`);
  assert.deepEqual([data.removal?.meta?.state, data.removal?.meta?.reason], ["failed", reason], `${label}: ${JSON.stringify(data.removal?.meta)}`);
  assert.match(data.removal.meta.message, /Meta tarafında kaldırılamadı/, `${label}: uyarı metni`);
  assert.match(data.removal.meta.message, /destekofis\.net\/veri-silme/, `${label}: veri silme adımı`);
  assert.equal(data.removal.meta.link, VERI_SILME, `${label}: bağlantı`);
};
const embedded = ctx =>
  ctx.server.app.context.whatsapp.connection.saveEmbedded(ctx.store.get("SELECT * FROM users WHERE username = 'admin'"), { token: TOKEN, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH", appId: APP });

describe("2.5.0 W-2 — Bağlantıyı Kaldır Meta'da da", () => {
  it("Yol 2: Kaldır → Meta'da abonelik silinir (DELETE /<WABA>/subscribed_apps, belirteç yalnız başlıkta), yerel kayıt silinir; ikinci Kaldır etkisiz (Meta'ya ikinci istek yok)", async () => {
    const ctx = await startWa({ now: NOW, connect: false });
    try {
      embedded(ctx);
      ctx.server.app.mobileRemote.setPublicUrl("http://ofisw2.destekofis.test");
      await ok(await ctx.api.post(`${URLS.conn}/test`, {}), "Bağlantıyı Sına");
      assert.match(String(ctx.fake.state.override), /^http:\/\/ofisw2\.destekofis\.test\/wa\/kanca\//, "ön koşul: Meta'da abonelik + bildirim adresi var");
      const data = await removeConn(ctx.api);
      assert.equal(data.configured, false);
      assert.deepEqual([data.removal?.removed, data.removal?.meta?.state], [true, "removed"], JSON.stringify(data.removal));
      const del = unsubscribeRequests(ctx.fake);
      assert.equal(del.length, 1, "Meta'ya bir abonelik silme isteği");
      assert.deepEqual([del[0].path, del[0].version, del[0].auth], [`/${WABA}/subscribed_apps`, "v26.0", `Bearer ${TOKEN}`]);
      assert.ok(!JSON.stringify(del[0].query).includes(TOKEN), "belirteç adreste yok");
      assert.deepEqual([ctx.fake.state.override, (ctx.fake.state.unsubscribes || []).length], [null, 1], "Meta'da abonelik ve adres gitti");
      assert.equal(settingRow(ctx), null, "yerel kayıt silindi");
      assert.ok(!JSON.stringify(data).includes(TOKEN), "yanıtta belirteç yok");
      const audits = ctx.store.all("SELECT payload_json AS p FROM audit_events WHERE type = 'whatsapp.connection.removed'").map(row => JSON.parse(row.p));
      assert.deepEqual(audits.map(item => item.meta), ["removed"], "işlem geçmişinde Meta sonucu");
      const again = await removeConn(ctx.api);
      assert.deepEqual([again.configured, again.removal?.already, again.removal?.meta?.state], [false, true, "skipped"], JSON.stringify(again.removal));
      assert.equal(unsubscribeRequests(ctx.fake).length, 1, "ikinci Kaldır Meta'ya istek göndermez");
    } finally {
      await ctx.close();
    }
  });

  it("aynı anda iki Kaldır: Meta'ya TEK silme isteği, ikisi aynı sonucu alır; Meta beklenirken yeni gönderim 409 'kaldırılıyor'", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const a = await ctx.account("Eş Zamanlı", "0532 500 00 01", 100);
      let release;
      ctx.fake.set({ hold: { match: /^DELETE \/\d+\/subscribed_apps$/, promise: new Promise(resolve => (release = resolve)) } });
      const first = ctx.api.del(URLS.conn);
      for (let i = 0; i < 200 && !ctx.fake.state.held; i += 1) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(ctx.fake.state.held, 1, "ön koşul: ilk Kaldır Meta'da bekliyor");
      const second = ctx.api.del(URLS.conn);
      const during = await ctx.api.post(URLS.batches, { kind: "statement", ids: [a.id], preset: "thisMonth" });
      assert.equal(during.status, 409, JSON.stringify(during.data).slice(0, 200));
      assert.equal(during.data.code, "whatsapp-removing");
      release();
      const [r1, r2] = await Promise.all([first, second]);
      assert.deepEqual([r1.status, r2.status], [200, 200]);
      assert.deepEqual([r1.data.data.removal?.meta?.state, r2.data.data.removal?.meta?.state], ["removed", "removed"]);
      assert.equal(unsubscribeRequests(ctx.fake).length, 1, "Meta'ya tek silme isteği");
      assert.equal(ctx.store.all("SELECT 1 FROM audit_events WHERE type = 'whatsapp.connection.removed'").length, 1, "tek kaldırma kaydı");
      assert.equal(settingRow(ctx), null);
    } finally {
      await ctx.close();
    }
  });

  it("Meta düşerse yerel kaldırma YİNE yapılır: Meta reddi, Meta'ya ulaşılamıyor, silme isteğinde 190, süresi dolmuş belirteç (istek gönderilmez) → 'Meta tarafında kaldırılamadı' + destekofis.net/veri-silme", async () => {
    const ctx = await startWa({ now: NOW });
    const reconnect = async () => {
      ctx.fake.set({ token: TOKEN });
      await ok(await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "Elle Bağla");
      await ok(await ctx.api.post(`${URLS.conn}/test`, {}), "Bağlantıyı Sına");
    };
    try {
      await ok(await ctx.api.post(`${URLS.conn}/test`, {}), "Bağlantıyı Sına");
      // (a) Meta reddetti.
      ctx.fake.set({ failNext: { match: /^DELETE \/\d+\/subscribed_apps$/, status: 400, body: metaError(100, "(#100) Invalid parameter") } });
      failedAtMeta(await removeConn(ctx.api), "meta", "Meta reddi");
      assert.equal(settingRow(ctx), null);
      // (b) Meta'ya ulaşılamıyor.
      await reconnect();
      await ctx.fake.offline();
      try {
        failedAtMeta(await removeConn(ctx.api), "unreachable", "ulaşılamıyor");
      } finally {
        await ctx.fake.online();
      }
      assert.equal(settingRow(ctx), null);
      // (c) Silme isteğinin kendisi 190 (belirteç Meta'da kaldırılmış, program henüz bilmiyor).
      await reconnect();
      ctx.fake.set({ token: "META-DA-KALDIRILMIS" });
      const c = await removeConn(ctx.api);
      failedAtMeta(c, "meta", "silmede 190");
      assert.match(c.removal.meta.message, /süresi dolmuş/);
      // (d) Belirteç zaten "Süresi Doldu" (Meta 190): Meta'ya istek gönderilmez.
      await reconnect();
      ctx.fake.set({ token: "IKINCI-KEZ-KALDIRILMIS" });
      assert.equal((await ctx.api.post(`${URLS.conn}/test`, {})).status, 502, "ön koşul: Meta 190");
      assert.equal((await ctx.api.get(URLS.conn)).data.data.tokenExpiry?.state, "expired", "ön koşul: Süresi Doldu");
      const before = unsubscribeRequests(ctx.fake).length;
      failedAtMeta(await removeConn(ctx.api), "expired", "süresi dolmuş belirteç");
      assert.equal(unsubscribeRequests(ctx.fake).length, before, "süresi dolmuş belirteçle Meta'ya istek gitmedi");
      assert.equal(settingRow(ctx), null);
    } finally {
      await ctx.close();
    }
  });

  it("Meta adresi tanımsız kurulum: yerel kaldırma yapılır, Meta tarafı 'kaldırılamadı' + veri silme adımı; dış istek YOK", async () => {
    const calls = [];
    const server = await startTestServer({ now: NOW, fetchImpl: async (...args) => { calls.push(String(args[0])); throw new TypeError("dış istek beklenmiyordu"); } });
    try {
      const api = await loginAdmin(server);
      assert.equal((await api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      const res = await api.del(URLS.conn);
      assert.equal(res.status, 200);
      failedAtMeta(res.data.data, "graph-off", "Meta adresi yok");
      assert.equal(server.app.store.get("SELECT value FROM settings WHERE key = 'whatsapp.meta'")?.value ?? null, null, "yerel kayıt silindi");
      assert.deepEqual(calls.filter(url => /graph|facebook|whatsapp/i.test(url)), [], "Meta'ya dış istek yok");
    } finally {
      await server.close();
    }
  });

  it("bekleyen gönderimler 'Durduruldu' (ilke 1): süren, duraklatılmış ve Meta Bekletti işi olan toplu işler; Meta Kabul Etti iş aynen; yeniden bağlanınca gönderilmemiş kişiler gönderilecek, kabul edilen kişi 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const A = await ctx.account("Ayşe Kabul", "0532 600 00 01", 100);
      const B = await ctx.account("Bora Bekleyen", "0532 600 00 02", 100);
      const C = await ctx.account("Cem Duraklatılan", "0532 600 00 03", 100);
      const P = await ctx.account("Pınar Bekletilen", "0532 600 00 04", 100);
      const body = ids => ({ kind: "statement", ids, preset: "thisMonth" });
      // Meta Bekletti: P'ye kabul → durum bildirimi 131049 → iş "Meta Bekletti (24 Saat Sonra Yeniden)" (toplu iş yeniden açılır).
      const held = await ok(await ctx.batch(body([P.id])), "P");
      await ctx.drain();
      const pJob = (await ctx.jobs(held.batch.id))[0];
      assert.equal(pJob.state, "accepted", "ön koşul: P kabul");
      ctx.clock.advance(60_000);
      const hook = ctx.statuses([{ id: pJob.wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905326000004", errors: [{ code: 131049, title: "This message was not delivered to maintain healthy ecosystem engagement." }] }]);
      assert.equal(hook.applied, 1, `ön koşul: 131049 bildirimi (${JSON.stringify(hook)})`);
      assert.equal((await ctx.jobs(held.batch.id))[0].state, "held", "ön koşul: P Meta Bekletti");
      // Süren toplu iş: A gitti, B sırada.
      const running = await ok(await ctx.batch(body([A.id, B.id])), "A+B");
      await ctx.drain({ max: 1 });
      const ab = await ctx.jobs(running.batch.id);
      assert.deepEqual(ab.map(job => job.state).sort(), ["accepted", "pending"], `ön koşul: A kabul, B sırada (${ab.map(job => job.state)})`);
      // Duraklatılmış toplu iş: C.
      const paused = await ok(await ctx.batch(body([C.id])), "C");
      await ok(await ctx.api.post(`${URLS.batches}/${paused.batch.id}/pause`, {}), "Duraklat");
      const sentBefore = ctx.messages().length;
      const data = await removeConn(ctx.api);
      assert.equal(data.removal?.stopped, 3, `üç toplu iş durduruldu (${JSON.stringify(data.removal)})`);
      for (const id of [held.batch.id, running.batch.id, paused.batch.id]) {
        const detail = await ctx.detail(id);
        assert.equal((detail.batch || detail).state, "stopped", `toplu iş Durduruldu (${id})`);
      }
      const after = [...(await ctx.jobs(running.batch.id)), ...(await ctx.jobs(paused.batch.id)), ...(await ctx.jobs(held.batch.id))];
      const byName = Object.fromEntries(after.map(job => [job.accountName, job]));
      assert.equal(byName["Ayşe Kabul"].state, "accepted", "Meta Kabul Etti iş değişmez");
      for (const name of ["Bora Bekleyen", "Cem Duraklatılan", "Pınar Bekletilen"]) {
        assert.equal(byName[name].state, "stopped", `${name}: Durduruldu`);
        assert.match(byName[name].reason, /Bağlantı Kaldırıldı/, `${name}: neden görünür`);
      }
      await ctx.drain();
      assert.equal(ctx.messages().length, sentBefore, "kaldırmadan sonra Meta'ya ileti gitmedi");
      // Yeniden bağlan: gönderilmemiş kişiler (B, C, P — Meta Bekletti teslim edilmedi) gönderilecek; A aldı (Meta Kabul Etti) → Daha Önce Gönderildi.
      await ok(await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "yeniden Elle Bağla");
      const pv = await ok(await ctx.api.post(URLS.preview, body([A.id, B.id, C.id, P.id])), "önizleme");
      const skips = Object.fromEntries(pv.people.map(person => [person.name || person.accountName || person.id, person.skip || "gönderilecek"]));
      assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi", "gönderilecek", "gönderilecek", "gönderilecek"], JSON.stringify(skips));
    } finally {
      await ctx.close();
    }
  });

  it("iki şirket aynı WhatsApp hesabı (WABA): biri kaldırınca Meta'daki abonelik SİLİNMEZ (öbürü kullanıyor), öbürünün bağlantısı sürer; ikincisi de kaldırınca silinir", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const created = await ok(await ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }), "ikinci şirket");
      const company = created.company || created;
      const q = `?hofCompany=${encodeURIComponent(company.id)}`;
      await ok(await ctx.api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "ikinci şirkette Elle Bağla");
      const one = await removeConn(ctx.api);
      assert.deepEqual([one.configured, one.removal?.meta?.state, one.removal?.meta?.reason], [false, "skipped", "shared"], JSON.stringify(one.removal));
      assert.match(one.removal.meta.message, /başka bir şirkette de bağlı/);
      assert.equal(unsubscribeRequests(ctx.fake).length, 0, "ortak abonelik silinmedi");
      assert.equal((await ctx.api.get(`${URLS.conn}${q}`)).data.data.configured, true, "ikinci şirketin bağlantısı sürüyor");
      const two = await removeConn(ctx.api, q);
      assert.deepEqual([two.configured, two.removal?.meta?.state], [false, "removed"], JSON.stringify(two.removal));
      assert.equal(unsubscribeRequests(ctx.fake).length, 1, "son şirket kaldırınca abonelik silindi");
    } finally {
      await ctx.close();
    }
  });

  it("Meta beklenirken bağlantı yeniden kurulursa (başka pencerede yeni belirteç) yeni bağlantı SİLİNMEZ", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      let release;
      ctx.fake.set({ hold: { match: /^DELETE \/\d+\/subscribed_apps$/, promise: new Promise(resolve => (release = resolve)) } });
      const pending = ctx.api.del(URLS.conn);
      for (let i = 0; i < 200 && !ctx.fake.state.held; i += 1) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(ctx.fake.state.held, 1, "ön koşul: Kaldır Meta'da bekliyor");
      const NEW = "SAHTE-W2-yeni-pencere-belirteci_0123456789";
      await ok(await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: NEW }), "başka pencerede yeniden bağla");
      release();
      const res = await pending;
      assert.equal(res.status, 200);
      assert.deepEqual([res.data.data.configured, res.data.data.removal?.removed, res.data.data.removal?.replaced], [true, false, true], JSON.stringify(res.data.data.removal));
      assert.ok(settingRow(ctx), "yeni bağlantının kaydı duruyor");
    } finally {
      await ctx.close();
    }
  });
});
