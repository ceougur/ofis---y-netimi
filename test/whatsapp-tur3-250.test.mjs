// 2.5.0 WhatsApp TUR 3 — S70, S71, S90 (KULLANICI KARARLARI AYNEN, docs/2.5.0-IS-LISTESI.md D) + BAŞ MİMAR KARARLARI 06.11 13:50 (1) ve 15:25 WT2-7 + WhatsApp tur 2 dar kontrol
// DÜŞÜK-1 / DÜŞÜK-2. Tasarım: docs/erp/WA-TUR3-TASARIM.md (koddan önce). Beklenenler karar metinlerinden ve "kime kaç kez" genel ilkesinden (31.10) yazıldı (ders 5 — programın kodundan
// okunmadı):
//   S70 = A — "K1′ genel — Atlandı olmuş işe geç teslim gelirse her Atlandı sırasında "Teslim Edildi" (zincir işin eski belirsiz iletisi; İstemiyor / Şüpheli Alacağı Var nedeniyle atlanan
//             Meta Bekletti işinin 1. iletisi dahil)." + Y20-3 (J10 ile "Daha Önce Gönderildi" olan işin öbür eski denemesine geç teslim de).
//   S71 = A — "içeriği ve kart telefonu silinmiş Ödeme Hatırlatma işinde "Yine de Gönder" → kişi "Telefon Yok" nedeniyle alınmaz, iş Sonucu Belirsiz kalır." + Y20-10 (telefon denetimi
//             "Zaten Kuyrukta" ve "Daha Önce Gönderildi"den ÖNCE).
//   S90 = A — "kip değişince sıfırlanan bildirim yolu işaretini yalnız şirketin ŞİMDİKİ kipinin uygulamasının adresinden (Yol 1'de uygulama düzeyi adres dahil) gelen bildirim koyar; eski
//             yolun geç bildirimi işi yine 'Teslim Edildi' yapar".
//   13:50 (1) — salt okunur lisansta Webhook çifti üretilmez (API düzeyi). WT2-7 — Kaldır'ın "aynı WABA başka şirkette bağlı" denetimi yalnız AYNI KİPTEKİ şirketlere bakar.
//   DÜŞÜK-1 — tur 2'den ÖNCEKİ kodun silinmiş işe yazdığı numaralı hata metni bir kez temizlenir. DÜŞÜK-2 — talepten SONRA açılan işin defter telefonu yeniden uygulamada silinmez.
// ESKİ KOD VERİSİ: test/fixtures/whatsapp-kvkk-hata-329d5d1b — tur 2'den önceki kodun (329d5d1b) GERÇEK koduyla, programın kendi API'siyle üretildi (uret.mjs.txt; bilgi.json).
// Düzenek: GERÇEK program + yerel sahte Graph + iki uygulamalı vekil (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13; TZ=UTC ve TZ=Europe/Istanbul); "istek Meta'dayken" ön koşulu
// KAPIYLA (hold / gate — ders 20, T35r yöntemi), süreyle değil; programın istek süre sınırı kapıdan uzun. Ders 30: lisans servisi yerel ölü adres. Ders 48: fikstür / veri klasörü geçici
// kökte, program kapandıktan sonra kendi tam yoluyla silinir.
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { OFFICE, PNID, PROGRAM_TEMPLATES, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";
import { startFakeGraph, startTwoAppProxy } from "./whatsapp-sahte-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const ERASE = "/api/workspace/whatsapp/kvkk-erase";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SENT_BEFORE = "Daha Önce Gönderildi";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const ts = ctx => String(Math.floor(ctx.clock.ms() / 1000));
const st = (ctx, wamid, status, extra = {}) => ({ id: wamid, status, timestamp: ts(ctx), recipient_id: "905000000000", ...extra });
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const waitFor = async (check, label, ms = 15_000) => {
  const until = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > until) throw new Error(`zaman aşımı: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
async function ok(res, label) {
  const done = await res;
  assert.equal(done.status, 200, `${label}: ${done.status} ${JSON.stringify(done.data).slice(0, 300)}`);
  return done.data.data;
}
const jobOf = async (ctx, batchId) => (await ctx.jobs(batchId))[0];
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const preview = async (ctx, ids, kind = "statement") => skipOf(await ok(ctx.api.post(URLS.preview, { kind, ids, ...(kind === "statement" ? { preset: "thisMonth" } : {}) }), "önizleme"));
const buAy = async ctx => (await ok(ctx.api.get(URLS.stats), "Bu Ay")).delivered;
const setCard = async (ctx, id, patch) => ok(ctx.api.put(`/api/workspace/accounts/${id}`, { ...(await ok(ctx.api.get(`/api/workspace/accounts/${id}`), "kart")), ...patch }), "kart güncelle");
/** Sonucu Belirsiz iş üretir: istek Meta'ya gider, yanıt hiç gelmez (istemci süre sınırı — startWa 800 ms; bu ön koşulun kendisi süredir ve yalnız "yanıt yok" olayıdır). */
async function uncertainBatch(ctx, ids, kind = "statement") {
  ctx.fake.state.hang = /messages/;
  const made = await ok(ctx.batch({ kind, ids, ...(kind === "statement" ? { preset: "thisMonth" } : {}) }), "toplu iş");
  await ctx.drain();
  ctx.fake.state.hang = null;
  return made.batch.id;
}
const anyway = (ctx, jobId) => ctx.api.post(`/api/workspace/whatsapp/jobs/${jobId}/send-anyway`, { confirm: true });

// =================================================================================================================================================
// S70 = A — her Atlandı sırasında geç teslim "Teslim Edildi"
// =================================================================================================================================================
describe("2.5.0 WhatsApp tur 3 — S70 = A: Atlandı işe geç teslim her sırada Teslim Edildi / Okundu (kime kaç kez aynen)", () => {
  it("W3T-70b zincir: işteki Yine de Gönder'in işi Silme Talebi / İstemiyor ile Atlandı → kaynağın ESKİ belirsiz iletisine geç teslim / okundu → zincir işi Teslim Edildi / Okundu; ileti 2, Bu Ay 2, aynı dönem Daha Önce; yinelenen ve sonraki failed etkisiz", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: NOW });
    try {
      const zs = await ctx.account("Zafer Silme", "0545 100 20 30", 300);
      const zi = await ctx.account("Zuhal İstemez", "0545 200 30 40", 400);
      const t1 = await uncertainBatch(ctx, [zs.id, zi.id]);
      const jobs = await ctx.jobs(t1);
      const src = Object.fromEntries(jobs.map(job => [job.accountId, job]));
      assert.deepEqual(jobs.map(job => job.state), ["uncertain", "uncertain"], "ön koşul: iki ileti Sonucu Belirsiz");
      const chain = {};
      for (const who of [zs, zi]) {
        const made = await ok(anyway(ctx, src[who.id].id), "işteki Yine de Gönder");
        await ok(ctx.api.post(`${URLS.batches}/${made.batch.id}/pause`, {}), "duraklat");
        chain[who.id] = made.batch.id;
      }
      await ok(ctx.api.post(ERASE, { accountId: zs.id, confirm: true }), "ZS silme talebi");
      await setCard(ctx, zi.id, { waOptOut: true });
      await ok(ctx.api.post(`${URLS.batches}/${chain[zi.id]}/resume`, {}), "ZI Devam Et");
      await ctx.drain();
      const before = { zs: await jobOf(ctx, chain[zs.id]), zi: await jobOf(ctx, chain[zi.id]) };
      assert.deepEqual([before.zs.state, before.zi.state], ["skipped", "skipped"], "ön koşul: iki zincir işi Atlandı");
      assert.match(before.zs.reason, /^Silme Talebi/, "ön koşul: ZS Silme Talebi");
      assert.equal(before.zi.reason, "WhatsApp Mesajı İstemiyor", "ön koşul: ZI İstemiyor");
      const posts = ctx.messageRequests().length;
      assert.equal(posts, 2, "ön koşul: zincir işleri gönderilmedi");
      ctx.clock.advance(HOUR);
      assert.equal(ctx.statuses([st(ctx, "wamid.GEC-ZS", "delivered", { biz_opaque_callback_data: src[zs.id].id })], { signed: true }).applied, 1, "ZS'nin eski iletisine imzalı geç teslim tanındı");
      ctx.clock.advance(HOUR);
      assert.equal(ctx.statuses([st(ctx, "wamid.GEC-ZI", "read", { biz_opaque_callback_data: src[zi.id].id })], { signed: true }).applied, 1, "ZI'nin eski iletisine imzalı geç okundu tanındı");
      const after = { zs: await jobOf(ctx, chain[zs.id]), zi: await jobOf(ctx, chain[zi.id]) };
      assert.deepEqual([after.zs.state, after.zi.state], ["delivered", "read"], "S70 (zincir): Atlandı zincir işleri Teslim Edildi / Okundu (eski kod: skipped, skipped)");
      assert.deepEqual([after.zs.errorCode, after.zi.errorCode], [null, null], "hata kodu yok");
      assert.ok(after.zs.contentErased, "ZS'nin içeriği silinmiş KALIR");
      assert.deepEqual([(await jobOf(ctx, t1)).state, (await ctx.jobs(t1))[1].state].sort(), ["delivered", "read"], "kaynak işler de Teslim Edildi / Okundu");
      assert.equal(ctx.messageRequests().length, posts, "iş gönderime DÖNMEDİ (yeni ileti yok)");
      assert.equal(await buAy(ctx), 2, "Bu Ay 2 (her kişi bir teslim — çift sayım yok)");
      // Yinelenen teslim / okundu ve sonraki failed (§7a 18) etkisiz.
      ctx.statuses([st(ctx, "wamid.GEC-ZS", "delivered", { biz_opaque_callback_data: src[zs.id].id }), st(ctx, "wamid.GEC-ZS", "failed", { errors: [{ code: 131026, title: "Message undeliverable" }] })], { signed: true });
      assert.equal((await jobOf(ctx, chain[zs.id])).state, "delivered", "yinelenen teslim ve sonraki failed etkisiz");
      assert.equal(await buAy(ctx), 2);
      await setCard(ctx, zi.id, { waOptOut: false });
      assert.deepEqual(await preview(ctx, [zs.id, zi.id]), [SENT_BEFORE, SENT_BEFORE], "aynı dönem ikisi Daha Önce Gönderildi (J1, ilke 3)");
    } finally {
      await ctx.close();
    }
  });

  it("W3T-70c eski deneme: Meta Bekletti işin 2. denemesi istek sürerken silme talebi + geçici hata ile Atlandı (S42) → 1. iletisine geç teslim → Teslim Edildi; ileti 2 (aynen), Bu Ay 1, Daha Önce", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: NOW, whatsappTimeoutMs: 60_000 });
    let release = () => {};
    try {
      const ms = await ctx.account("Murat Sürüyor", "0546 100 20 30", 500);
      const made = await ok(ctx.batch({ kind: "statement", ids: [ms.id], preset: "thisMonth" }), "toplu iş");
      await ctx.drain();
      const first = await jobOf(ctx, made.batch.id);
      assert.equal(first.state, "accepted", "ön koşul: 1. ileti Meta Kabul Etti");
      ctx.clock.advance(60_000);
      ctx.statuses([st(ctx, first.wamid, "failed", { errors: [{ code: 131049, title: "ecosystem" }] })]);
      assert.equal((await jobOf(ctx, made.batch.id)).state, "held", "ön koşul: Meta Bekletti");
      ctx.clock.advance(DAY + 60_000);
      ctx.fake.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
      ctx.fake.state.failQueue.push({ match: /messages/, status: 500, body: metaError(131000, "Something went wrong") });
      const run = ctx.drain();
      await waitFor(() => ctx.fake.state.held >= 1, "2. deneme Meta'da");
      assert.equal((await jobOf(ctx, made.batch.id)).state, "sending", "ön koşul: 2. deneme Gönderiliyor");
      await ok(ctx.api.post(ERASE, { accountId: ms.id, confirm: true }), "silme talebi");
      ctx.fake.state.hold = null;
      release();
      await run;
      const skipped = await jobOf(ctx, made.batch.id);
      assert.deepEqual([skipped.state, skipped.attempt], ["skipped", 2], "ön koşul: S42 — 2. deneme anında Atlandı — Silme Talebi");
      assert.equal(ctx.messageRequests().length, 2);
      ctx.clock.advance(HOUR);
      assert.equal(ctx.statuses([st(ctx, first.wamid, "delivered")]).applied, 1, "1. iletinin geç teslimi tanındı (eski deneme)");
      const done = await jobOf(ctx, made.batch.id);
      assert.deepEqual([done.state, done.errorCode], ["delivered", null], "S70 (son deneme olmayan ileti): Teslim Edildi, hata kodu kalktı (eski kod: skipped)");
      assert.equal(ctx.messageRequests().length, 2, "POST 2 aynen");
      assert.equal(await buAy(ctx), 1);
      assert.deepEqual(await preview(ctx, [ms.id]), [SENT_BEFORE]);
    } finally {
      ctx.fake.state.hold = null;
      release();
      await ctx.close();
    }
  });

  it("W3T-70d J10 (Y20-3): zincir işi kaynağın teslimiyle 'Atlandı — Daha Önce Gönderildi'; AYNI denemenin yinelenen teslimi değiştirmez; ÖBÜR eski denemesine teslim → Teslim Edildi; ileti 2, Bu Ay 2", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: NOW });
    try {
      const jd = await ctx.account("Jale Çift", "0547 100 20 30", 600);
      const t1 = await uncertainBatch(ctx, [jd.id]);
      const j0 = await jobOf(ctx, t1);
      ctx.fake.state.hang = /messages/;
      const y1 = await ok(anyway(ctx, j0.id), "1. Yine de Gönder");
      await ctx.drain();
      ctx.fake.state.hang = null;
      const j1 = await jobOf(ctx, y1.batch.id);
      assert.equal(j1.state, "uncertain", "ön koşul: ikinci ileti de Sonucu Belirsiz");
      const y2 = await ok(anyway(ctx, j1.id), "2. Yine de Gönder");
      await ok(ctx.api.post(`${URLS.batches}/${y2.batch.id}/pause`, {}), "duraklat");
      ctx.clock.advance(HOUR);
      ctx.statuses([st(ctx, "wamid.GEC-J0", "delivered", { biz_opaque_callback_data: j0.id })], { signed: true });
      await ok(ctx.api.post(`${URLS.batches}/${y2.batch.id}/resume`, {}), "Devam Et");
      await ctx.drain();
      const j2 = await jobOf(ctx, y2.batch.id);
      assert.deepEqual([j2.state, j2.reason], ["skipped", SENT_BEFORE], "ön koşul: J10 — kaynağın teslimi → Atlandı — Daha Önce Gönderildi");
      assert.equal(ctx.messageRequests().length, 2, "ön koşul: üçüncü ileti gitmedi");
      ctx.statuses([st(ctx, "wamid.GEC-J0", "delivered", { biz_opaque_callback_data: j0.id }), st(ctx, "wamid.GEC-J0", "read", { biz_opaque_callback_data: j0.id })], { signed: true });
      assert.equal((await jobOf(ctx, y2.batch.id)).state, "skipped", "Y20-3: aynı (teslim edilmiş) denemeye yinelenen bildirim yeni teslim değil");
      ctx.clock.advance(HOUR);
      assert.equal(ctx.statuses([st(ctx, "wamid.GEC-J1", "delivered", { biz_opaque_callback_data: j1.id })], { signed: true }).applied, 1, "öbür eski denemeye geç teslim tanındı");
      assert.equal((await jobOf(ctx, y2.batch.id)).state, "delivered", "Y20-3: J10 işi Teslim Edildi (eski kod: skipped)");
      assert.equal(ctx.messageRequests().length, 2);
      assert.equal(await buAy(ctx), 2, "kişi iki ileti aldı (J5 — iki teslim)");
      assert.deepEqual(await preview(ctx, [jd.id]), [SENT_BEFORE]);
    } finally {
      await ctx.close();
    }
  });

  it("W3T-70a Meta Bekletti işi 2. deneme anında İstemiyor ile Atlandı → kendi 1. iletisine geç okundu → Okundu, POST 1 (S59 düzeni — eski kodda da yeşil: yolun komşusu)", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: NOW });
    try {
      const d = await ctx.account("Hasan Çelik", "0535 444 55 66", 750);
      const made = await ok(ctx.batch({ kind: "statement", ids: [d.id], preset: "thisMonth" }), "toplu iş");
      await ctx.drain();
      const first = await jobOf(ctx, made.batch.id);
      ctx.clock.advance(60_000);
      ctx.statuses([st(ctx, first.wamid, "failed", { errors: [{ code: 131049, title: "ecosystem" }] })]);
      await setCard(ctx, d.id, { waOptOut: true });
      ctx.clock.advance(DAY + 60_000);
      await ctx.drain();
      assert.deepEqual([(await jobOf(ctx, made.batch.id)).state, ctx.messageRequests().length], ["skipped", 1], "ön koşul: 2. deneme anında Atlandı, ikinci ileti gitmedi");
      ctx.statuses([st(ctx, first.wamid, "read")]);
      assert.equal((await jobOf(ctx, made.batch.id)).state, "read");
      assert.equal(ctx.messageRequests().length, 1);
    } finally {
      await ctx.close();
    }
  });
});

// =================================================================================================================================================
// S71 = A — içeriği ve kart telefonu silinmiş Ödeme Hatırlatma'da işteki Yine de Gönder "Telefon Yok"
// =================================================================================================================================================
describe("2.5.0 WhatsApp tur 3 — S71 = A: içerik + kart telefonu silinmiş Hatırlatma'da Yine de Gönder kişiyi ALMAZ (Telefon yok), iş Sonucu Belirsiz", () => {
  it("W3T-71 işteki Yine de Gönder → 400 'Telefon yok' (bekleyen iş varken de — Zaten Kuyrukta'dan ÖNCE), iş Sonucu Belirsiz, ileti yok; telefon girilince Yine de Gönder alır, karttan gider (ilke 4)", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: NOW });
    try {
      const yb = await ctx.account("Yasemin Belirsiz", "0549 510 61 71");
      await ok(ctx.api.post("/api/workspace/plans", { accountId: yb.id, name: "Taksit", total: "1200", count: 3, firstDue: "2026-11-15", startDate: "2026-11-03" }), "taksit kartı");
      ctx.clock.set(localIso(2026, 12, 20, 10));
      const t1 = await uncertainBatch(ctx, [yb.id], "reminder");
      const job = await jobOf(ctx, t1);
      assert.equal(job.state, "uncertain", "ön koşul: hatırlatma Sonucu Belirsiz");
      await ok(ctx.api.post(ERASE, { accountId: yb.id, confirm: true }), "silme talebi");
      // Talepten SONRA, ertesi gün aynı kişiye yeni hatırlatma — duraklatılır (kuyrukta bekleyen iş: Zaten Kuyrukta adayı; talepten önceki bekleyen iş Atlandı olurdu — S35).
      ctx.clock.advance(DAY);
      const queued = await ok(ctx.batch({ kind: "reminder", ids: [yb.id] }), "kuyruktaki hatırlatma");
      await ok(ctx.api.post(`${URLS.batches}/${queued.batch.id}/pause`, {}), "duraklat");
      assert.equal((await jobOf(ctx, queued.batch.id)).state, "paused", "ön koşul: kuyrukta bekleyen iş (Duraklatıldı)");
      assert.deepEqual(await preview(ctx, [yb.id], "reminder"), ["Zaten Kuyrukta"], "ön koşul: telefon varken kişi 'Zaten Kuyrukta' adayı");
      await setCard(ctx, yb.id, { phone: "" });
      const posts = ctx.messageRequests().length;
      const r = await anyway(ctx, job.id);
      assert.equal(r.status, 400, `S71: kişi alınmaz (eski davranışın B yolu: 200) — ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
      assert.match(String(r.data.error), /Telefon yok: 1/, "neden 'Telefon yok' — 'Zaten Kuyrukta' DEĞİL (Y20-10)");
      assert.doesNotMatch(String(r.data.error), /Zaten Kuyrukta/);
      const still = ctx.store.get("SELECT state FROM wa_jobs WHERE id = ?", job.id);
      assert.equal(still.state, "uncertain", "iş Sonucu Belirsiz kalır");
      assert.equal(ctx.messageRequests().length, posts, "ileti gitmedi");
      // İlke 4 (çıkmaz yok): kuyruktaki iş iptal edilip telefon girilince işteki Yine de Gönder kişiyi alır; içerik ve telefon karttan (S37).
      await ok(ctx.api.post(`${URLS.batches}/${queued.batch.id}/cancel`, {}), "kuyruktaki işi iptal");
      await setCard(ctx, yb.id, { phone: "0549 510 61 71" });
      const again = await ok(anyway(ctx, job.id), "telefon girildikten sonra Yine de Gönder");
      await ctx.drain();
      const sent = await jobOf(ctx, again.batch.id);
      assert.deepEqual([sent.state, sent.phone, sent.params.length, Boolean(sent.contentErased)], ["accepted", "+905495106171", 5, false], "karttan yeni içerikle gitti");
    } finally {
      await ctx.close();
    }
  });
});

// =================================================================================================================================================
// S90 = A — işareti yalnız şimdiki kipin uygulamasının adresi koyar (iki uygulamalı vekil, programın GERÇEK kanca ucu)
// =================================================================================================================================================
const TOKEN_A = "SAHTE-UYGULAMA-A-musteri-belirteci-0123456789-abcdefABCDEF";
const TOKEN_B = "SAHTE-UYGULAMA-B-destekofis-belirteci-0123456789-abcdefXYZ";
const APP_A = "111111111111111"; // Elle Bağla — müşterinin uygulaması
const APP_B = "222222222222222"; // WhatsApp'ı Bağla — DestekOfis uygulaması
const statusEvent = statuses => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });
function raw(base, method, pathAndQuery, body) {
  const url = new URL(base);
  const payload = Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: pathAndQuery, headers: { "content-type": "application/json", "content-length": payload.length } }, res => {
      const parts = [];
      res.on("data", chunk => parts.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
async function yollar({ listing = "kendi" } = {}) {
  const PUBLIC = "http://ofis-tur3.destekofis.test";
  const backend = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
  backend.state.templates.push(...PROGRAM_TEMPLATES());
  for (const tpl of backend.state.templates) if (String(tpl.name).startsWith("destekofis_")) tpl.message_send_ttl_seconds = 43_200; // 12 sa (S58'in koşulu: < 7 gün)
  const proxy = await startTwoAppProxy({ backend, backendToken: TOKEN, wabaId: WABA, apps: { [TOKEN_A]: { id: APP_A, name: "Müşteri (A)" }, [TOKEN_B]: { id: APP_B, name: "DestekOfis (B)" } }, listing });
  let server = null;
  try {
    server = await startTestServer({ now: { time: "2026-11-03T09:00:00+03:00", fixed: true }, maxCompanies: 2, env: DEAD, whatsappGraphUrl: proxy.url, whatsappTimeoutMs: 1500, whatsappGapMs: 0 });
    const api = await loginAdmin(server);
    server.app.store.setSetting("office.name", OFFICE);
    server.app.mobileRemote.setPublicUrl(PUBLIC);
    const base = `http://127.0.0.1:${(await server.app.listenRemote(0, "127.0.0.1")).port}`;
    const store = server.app.store;
    const admin = store.all("SELECT id, username, display_name FROM users WHERE username = ?", "admin")[0];
    const conn = () => server.app.context.whatsapp.connection;
    const t = {
      server,
      api,
      proxy,
      backend,
      mark: () => ({ seen: Boolean(store.setting("whatsapp.hookSeen", "")), mode: store.setting("whatsapp.hookSeenMode", "") }),
      mode: () => conn().read()?.mode,
      async toEmbedded() {
        conn().saveEmbedded(admin, { token: TOKEN_B, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" });
        await ok(api.put(URLS.ack, { ack: true }), "onay");
        await ok(api.post(`${URLS.conn}/hook`, {}), "Yol 2 Yeniden Kaydet");
      },
      async toManual() {
        await ok(api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN_A }), "Elle Bağla");
        await ok(api.put(URLS.ack, { ack: true }), "onay");
        await ok(api.post(`${URLS.conn}/hook`, {}), "Yol 1 Yeniden Kaydet");
      },
      async sent(name, phone) {
        const account = await ok(api.post("/api/workspace/accounts", { name, phone, openingBalance: "800" }), "cari");
        const batch = await ok(api.post(URLS.batches, { kind: "statement", ids: [account.id], preset: "thisMonth" }), "toplu iş");
        await server.app.whatsapp.scheduler.drain();
        const job = (await ok(api.get(`${URLS.batches}/${batch.batch.id}`), "iş")).jobs[0];
        assert.equal(job.state, "accepted", "ön koşul: Meta Kabul Etti");
        server.clock.advance(60_000);
        return { account, batchId: batch.batch.id, job };
      },
      state: async batchId => (await ok(api.get(`${URLS.batches}/${batchId}`), "iş")).jobs[0].state,
      /** Meta'nın bir uygulamanın alternatif adresine (A / B — vekildeki kaydı) ya da uygulama düzeyi adrese ("uygulama") yolladığı imzasız durum bildirimi. */
      async post(target, wamid, status = "delivered") {
        let secret = null;
        if (target === "uygulama") {
          const info = await ok(api.get("/api/workspace/whatsapp/app-webhook"), "Webhook Bilgileri");
          secret = new URL(info.callbackUrl).pathname.split("/").pop();
        } else secret = proxy.pathOf(target === "A" ? APP_A : APP_B);
        assert.ok(secret, `ön koşul: ${target} adresi Meta'da kayıtlı`);
        return raw(base, "POST", `/wa/kanca/${secret}`, statusEvent([{ id: wamid, status, timestamp: String(Math.floor(server.clock.ms() / 1000)), recipient_id: "905320000000" }]));
      },
      async pastTtl(target) {
        server.clock.advance(13.5 * HOUR);
        await server.app.whatsapp.scheduler.drain();
        const preview = await ok(api.post(URLS.preview, { kind: "statement", ids: [target.account.id], preset: "thisMonth" }), "önizleme");
        return { state: await t.state(target.batchId), skip: (preview.people || []).map(p => p.skip || "gönderilecek") };
      },
      async close() {
        await server.close().catch(() => {});
        await proxy.close();
        await backend.close();
      },
    };
    return t;
  } catch (error) {
    await server?.close().catch(() => {});
    await proxy.close();
    await backend.close();
    throw error;
  }
}

describe("2.5.0 WhatsApp tur 3 — S90 = A: işareti yalnız şirketin ŞİMDİKİ kipinin uygulamasının adresi koyar; eski yolun geç bildirimi işi yine Teslim Edildi yapar", () => {
  it("W3T-90a Yol 2 → Yol 1: ESKİ (B) adrese J1'in geç teslimi → J1 Teslim Edildi, işaret YOK → J2 TTL + 1 sa sonra Meta Kabul Etti + Daha Önce; sonra Yol 1'in kendi (A) adresi işareti koyar", { timeout: 120_000 }, async () => {
    const t = await yollar();
    try {
      await t.toEmbedded();
      const j1 = await t.sent("Ayşe Yılmaz", "0532 111 22 33");
      await t.toManual();
      assert.deepEqual([t.mode(), t.mark().seen], ["manual", false], "ön koşul: Yol 1, işaret yok");
      const j2 = await t.sent("Bora Demir", "0533 444 55 66");
      const late = await t.post("B", j1.job.wamid);
      assert.equal(late.status, 200, "eski yolun bildirimi kabul edildi");
      assert.equal(await t.state(j1.batchId), "delivered", "eski yolun geç bildirimi işi Teslim Edildi yaptı");
      assert.equal(t.mark().seen, false, "S90: eski (B) adresin bildirimi işaret KOYMADI (eski kod: işaret + kip manual)");
      assert.deepEqual(await t.pastTtl(j2), { state: "accepted", skip: [SENT_BEFORE] }, "S90: J2 Meta Kabul Etti, kişi Daha Önce (eski kod: expired + gönderilecek — dar kontrol 'gec')");
      const j3 = await t.sent("Cem Kara", "0534 777 88 99");
      assert.equal((await t.post("A", j2.job.wamid)).status, 200);
      assert.deepEqual(t.mark(), { seen: true, mode: "manual" }, "şimdiki kipin (A) adresi işareti koydu");
      assert.equal((await t.pastTtl(j3)).state, "expired", "Yol 1'in işaretiyle teslim bilgisi gelmeyen iş Süresi Doldu (aynen)");
    } finally {
      await t.close();
    }
  });
  it("W3T-90b Yol 2 → Yol 1: uygulama düzeyi adres (Elle Bağla'nın uygulaması) Yol 1'de işareti KOYAR; Yol 2'deyken gelen uygulama düzeyi bildirim koymaz, iş Teslim Edildi", { timeout: 120_000 }, async () => {
    const t = await yollar();
    try {
      await t.toManual();
      const j0 = await t.sent("Deniz Ak", "0532 222 33 44");
      await t.toEmbedded();
      assert.deepEqual([t.mode(), t.mark().seen], ["embedded", false], "ön koşul: Yol 2, işaret yok");
      // Yol 2'de uygulama düzeyi adrese imzasız bildirim WY kuralıyla 401 (yazılmaz — değişmedi); işaret yok.
      const blocked = await t.post("uygulama", j0.job.wamid);
      assert.equal(blocked.status, 401, `Yol 2'de imzasız bildirim yazılmaz (WY, aynen) — ${blocked.status}`);
      assert.equal(t.mark().seen, false);
      // İç çağrı (kanca adresi = Elle Bağla'nın uygulaması) imzalı olsa da şimdiki kip Yol 2 → işaret yok, iş Teslim Edildi.
      t.server.app.context.whatsapp.queue.applyStatuses([{ id: j0.job.wamid, status: "delivered", timestamp: String(Math.floor(t.server.clock.ms() / 1000)), recipient_id: "905322223344" }], { phoneNumberId: PNID, signed: true, via: "manual" });
      assert.deepEqual([await t.state(j0.batchId), t.mark().seen], ["delivered", false], "Yol 1 uygulamasının bildirimi Yol 2'de işaret koymaz, işi Teslim Edildi yapar");
      await t.toManual();
      const j1 = await t.sent("Ece Su", "0532 333 44 55");
      assert.equal((await t.post("uygulama", j1.job.wamid, "sent")).status, 200, "uygulama düzeyi adres Yol 1'de kabul");
      assert.deepEqual(t.mark(), { seen: true, mode: "manual" }, "S90 (Yol 1'de uygulama düzeyi adres dahil): işaret kondu");
    } finally {
      await t.close();
    }
  });
  it("W3T-90c geri dönüş Yol 1 → Yol 2 → Yol 1: her değişimde sıfırlanır; Yol 2 (B) adresinin geç bildirimi Yol 1'de işaret koymaz; tur 2 öncesi 'mixed' (sahibi bilinmeyen) yol koymaz (İLKEYLE); kipsiz iç çağrı eskisi gibi", { timeout: 120_000 }, async () => {
    const t = await yollar();
    try {
      await t.toManual();
      const a = await t.sent("Fatma Aydın", "0537 666 77 88");
      assert.equal((await t.post("A", a.job.wamid, "sent")).status, 200);
      assert.equal(t.mark().seen, true, "ön koşul: Yol 1 işareti");
      await t.toEmbedded();
      const b = await t.sent("Gül Yılmaz", "0537 777 88 99");
      assert.equal(t.mark().seen, false, "Yol 2'ye geçişte sıfırlandı (S58)");
      t.server.app.context.whatsapp.queue.applyStatuses([{ id: b.job.wamid, status: "sent", timestamp: String(Math.floor(t.server.clock.ms() / 1000)), recipient_id: "905377778899" }], { phoneNumberId: PNID, signed: true, via: "embedded" });
      assert.deepEqual(t.mark(), { seen: true, mode: "embedded" }, "şimdiki kipin (B) bildirimi işareti koyar");
      await t.toManual();
      assert.equal(t.mark().seen, false, "Yol 1'e dönüşte sıfırlandı");
      assert.equal((await t.post("B", b.job.wamid)).status, 200);
      assert.deepEqual([await t.state(b.batchId), t.mark().seen], ["delivered", false], "eski (B) adres işaret koymaz, iş Teslim Edildi");
      const queue = t.server.app.context.whatsapp.queue;
      queue.applyStatuses([{ id: a.job.wamid, status: "delivered", timestamp: String(Math.floor(t.server.clock.ms() / 1000)), recipient_id: "905376667788" }], { phoneNumberId: PNID, via: "" });
      assert.equal(t.mark().seen, false, "İLKEYLE (ilke 2): uygulaması bilinmeyen yol işaret koymaz");
      assert.equal(await t.state(a.batchId), "delivered", "iş Teslim Edildi");
      queue.applyStatuses([], { phoneNumberId: PNID });
      assert.equal(t.mark().seen, true, "kanca adresi bildirilmeyen iç çağrı (araç / test) eskisi gibi işaret koyar");
    } finally {
      await t.close();
    }
  });
  it("W3T-90d Kaldır + aynı kiple (Yol 1) yeniden bağla: işaret KALIR (WT2-4); kendi (A) adresi koymaya devam eder", { timeout: 120_000 }, async () => {
    const t = await yollar();
    try {
      await t.toManual();
      const a = await t.sent("Hakan Er", "0538 111 22 33");
      assert.equal((await t.post("A", a.job.wamid, "sent")).status, 200);
      assert.deepEqual(t.mark(), { seen: true, mode: "manual" }, "ön koşul: işaret ve kipi");
      await ok(t.api.del(URLS.conn), "Bağlantıyı Kaldır");
      await t.toManual();
      assert.equal(t.mark().seen, true, "WT2-4: aynı kiple yeniden bağlamada işaret kalır");
      const b = await t.sent("İpek Kar", "0538 222 33 44");
      assert.equal((await t.post("A", b.job.wamid)).status, 200);
      assert.deepEqual([await t.state(b.batchId), t.mark()], ["delivered", { seen: true, mode: "manual" }]);
    } finally {
      await t.close();
    }
  });
});

// =================================================================================================================================================
// BAŞ MİMAR KARARI 06.11 13:50 (1) — salt okunur lisansta Webhook çifti üretilmez (API düzeyi)
// =================================================================================================================================================
const READ_ONLY_LICENSE = { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 };
describe("2.5.0 WhatsApp tur 3 — salt okunur lisansta Webhook Bilgileri çifti ÜRETİLMEZ (GET /api/workspace/whatsapp/app-webhook)", () => {
  it("W3T-WE salt okunur: çift yokken ready false + neden, ayar satırı YOK; yazılabilir lisansta üretilir; salt okunurda var olan çift AYNEN gösterilir; KVKK talebi açık (S62)", { timeout: 180_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-tur3-we-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    const PUBLIC = "http://ofis-tur3-we.destekofis.test";
    const pairRow = ctx => ctx.store.get("SELECT value FROM settings WHERE key = 'whatsapp.appWebhook'")?.value ?? null;
    try {
      let accountId;
      {
        const ctx = await startWa({ env: DEAD, dataDir, backupDir, now: NOW });
        try {
          accountId = (await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500)).id;
          await ok(ctx.batch({ kind: "statement", ids: [accountId], preset: "thisMonth" }), "toplu iş");
          await ctx.drain();
        } finally {
          await ctx.close();
        }
      }
      let made;
      {
        const ctx = await startWa({ env: DEAD, dataDir, backupDir, connect: false, ack: false, office: null, now: NOW, license: READ_ONLY_LICENSE });
        try {
          ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
          const denied = await ctx.api.post("/api/workspace/accounts", { name: "Yeni Cari", phone: "0535 000 00 01" });
          assert.equal(denied.status, 403, "ön koşul: lisans salt okunur");
          const info = await ok(ctx.api.get("/api/workspace/whatsapp/app-webhook"), "Webhook Bilgileri (salt okunur)");
          assert.deepEqual([info.ready, info.callbackUrl, info.verifyToken], [false, "", ""], `çift üretilmedi (eski kod: ready true + yeni çift) — ${JSON.stringify(info)}`);
          assert.match(info.reason, /salt okunur/i);
          assert.equal(pairRow(ctx), null, "ayar satırı YAZILMADI");
          assert.equal((await ctx.api.post(ERASE, { accountId, confirm: true })).status, 200, "S62: salt okunurda KVKK talebi açık (komşu)");
        } finally {
          await ctx.close();
        }
      }
      {
        const ctx = await startWa({ env: DEAD, dataDir, backupDir, connect: false, ack: false, office: null, now: NOW });
        try {
          ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
          made = await ok(ctx.api.get("/api/workspace/whatsapp/app-webhook"), "Webhook Bilgileri (yazılabilir)");
          assert.equal(made.ready, true, "yazılabilir lisansta çift üretildi");
          assert.notEqual(pairRow(ctx), null);
        } finally {
          await ctx.close();
        }
      }
      {
        const ctx = await startWa({ env: DEAD, dataDir, backupDir, connect: false, ack: false, office: null, now: NOW, license: READ_ONLY_LICENSE });
        try {
          ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
          const shown = await ok(ctx.api.get("/api/workspace/whatsapp/app-webhook"), "Webhook Bilgileri (salt okunur, çift var)");
          assert.deepEqual(shown, made, "salt okunurda var olan çift AYNEN gösterilir (bugünkü davranış)");
        } finally {
          await ctx.close();
        }
      }
    } finally {
      removeTestDir(root);
    }
  });
});

// =================================================================================================================================================
// WT2-7 — Bağlantıyı Kaldır'ın paylaşım denetimi yalnız AYNI KİPTEKİ şirketlere bakar (abonelik uygulama başınadır)
// =================================================================================================================================================
async function ikiSirket({ listing, secondMode }) {
  const backend = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
  backend.state.templates.push(...PROGRAM_TEMPLATES());
  const proxy = await startTwoAppProxy({ backend, backendToken: TOKEN, wabaId: WABA, apps: { [TOKEN_A]: { id: APP_A, name: "Müşteri (A)" }, [TOKEN_B]: { id: APP_B, name: "DestekOfis (B)" } }, listing });
  let server = null;
  try {
    server = await startTestServer({ now: { time: "2026-11-03T09:00:00+03:00", fixed: true }, maxCompanies: 2, env: DEAD, whatsappGraphUrl: proxy.url, whatsappTimeoutMs: 1500, whatsappGapMs: 0 });
    const api = await loginAdmin(server);
    server.app.store.setSetting("office.name", OFFICE);
    server.app.mobileRemote.setPublicUrl("http://ofis-tur3-wt27.destekofis.test");
    await ok(api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN_A }), "001 Elle Bağla (A)");
    await ok(api.post(`${URLS.conn}/hook`, {}), "001 kanca (A)");
    const created = await ok(api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "002");
    const company = created.company || created;
    const q = `?hofCompany=${encodeURIComponent(company.id)}`;
    const admin = server.app.store.all("SELECT id, username, display_name FROM users WHERE username = ?", "admin")[0];
    if (secondMode === "embedded") server.app.openCompany(company.id).context.whatsapp.connection.saveEmbedded(admin, { token: TOKEN_B, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" });
    else await ok(api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN_A }), "002 Elle Bağla (A)");
    await ok(api.post(`${URLS.conn}/hook${q}`, {}), "002 kanca");
    return {
      server,
      api,
      q,
      proxy,
      deletes: () => proxy.log.filter(item => item.method === "DELETE").map(item => (item.app === APP_A ? "A" : "B")),
      async close() {
        await server.close().catch(() => {});
        await proxy.close();
        await backend.close();
      },
    };
  } catch (error) {
    await server?.close().catch(() => {});
    await proxy.close();
    await backend.close();
    throw error;
  }
}
for (const listing of ["hepsi", "kendi"]) {
  describe(`2.5.0 WhatsApp tur 3 — WT2-7 (Meta listeleme modeli: ${listing}): Kaldır'ın "başka şirkette bağlı" denetimi kipe göre`, () => {
    it(`W3T-27a ${listing} · 001 Elle Bağla + 002 WhatsApp'ı Bağla aynı WABA: 001 Kaldır → A'nın aboneliği SİLİNİR (DELETE A), 002'nin B aboneliği durur, 002 bağlı`, { timeout: 120_000 }, async () => {
      const t = await ikiSirket({ listing, secondMode: "embedded" });
      try {
        assert.ok(t.proxy.subs.has(APP_A) && t.proxy.subs.has(APP_B), "ön koşul: iki uygulamanın aboneliği");
        const removed = await ok(t.api.del(URLS.conn), "001 Kaldır");
        assert.deepEqual([removed.configured, removed.removal?.meta?.state], [false, "removed"], `farklı kipteki şirket aboneliği korumaz (eski kod: skipped / shared) — ${JSON.stringify(removed.removal?.meta)}`);
        assert.deepEqual(t.deletes(), ["A"], "Meta'da yalnız A'nın aboneliği silindi (A belirteciyle)");
        assert.deepEqual([t.proxy.subs.has(APP_A), t.proxy.subs.has(APP_B)], [false, true], "002'nin (B) aboneliği ve bildirim adresi duruyor");
        assert.equal((await ok(t.api.get(`${URLS.conn}${t.q}`), "002 bağlantı")).configured, true, "002 bağlı");
      } finally {
        await t.close();
      }
    });
    it(`W3T-27b ${listing} · iki şirket AYNI kip (Elle Bağla) aynı WABA: 001 Kaldır → abonelik SİLİNMEZ (002'nin teslimleri düşmez); 002 de kaldırınca silinir`, { timeout: 120_000 }, async () => {
      const t = await ikiSirket({ listing, secondMode: "manual" });
      try {
        const one = await ok(t.api.del(URLS.conn), "001 Kaldır");
        assert.deepEqual([one.removal?.meta?.state, one.removal?.meta?.reason], ["skipped", "shared"], `aynı kipte paylaşılıyor — ${JSON.stringify(one.removal?.meta)}`);
        assert.deepEqual(t.deletes(), [], "Meta'ya silme isteği GİTMEDİ");
        assert.equal(t.proxy.subs.has(APP_A), true, "abonelik duruyor");
        const two = await ok(t.api.del(`${URLS.conn}${t.q}`), "002 Kaldır");
        assert.equal(two.removal?.meta?.state, "removed");
        assert.deepEqual(t.deletes(), ["A"]);
      } finally {
        await t.close();
      }
    });
  });
}

// =================================================================================================================================================
// WhatsApp tur 2 dar kontrol DÜŞÜK-1 / DÜŞÜK-2 — eski W-3 verisi ve talepten sonraki iş
// =================================================================================================================================================
const files = dir => (existsSync(dir) ? readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? files(full) : [full];
}) : []);
const hitsIn = (dir, needle) => files(dir).filter(file => readFileSync(file).includes(Buffer.from(needle))).map(file => path.relative(dir, file));
describe("2.5.0 WhatsApp tur 3 — dar kontrol DÜŞÜK-1 / DÜŞÜK-2 (W-3 KVKK yeniden uygulaması)", () => {
  it("W3T-D1 tur 2'den ÖNCEKİ kodun GERÇEK verisi (whatsapp-kvkk-hata-329d5d1b: silinmiş işin hata metninde numara) → açılış + ilk bakım turu: metin numarasız, veri klasörünün HİÇBİR dosyasında numara yok; talepsiz işe dokunulmaz", { timeout: 180_000 }, async () => {
    const dir = path.join(HERE, "fixtures", "whatsapp-kvkk-hata-329d5d1b");
    const info = JSON.parse(readFileSync(path.join(dir, "bilgi.json"), "utf8"));
    const NEEDLE = "+90 532 111 22 33";
    assert.deepEqual([info.talep, info.jobs.A.erased, info.jobs.A.numberInText, info.dosyadaNumara], [200, true, true, true], "ön koşul: eski kod silinmiş satıra numaralı metin yazmıştı");
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-tur3-d1-"));
    const dataDir = path.join(root, "data");
    mkdirSync(dataDir, { recursive: true });
    for (const name of ["destekofis.sqlite", "whatsapp-gonderim.sqlite", "whatsapp-silme-talepleri.sqlite"]) writeFileSync(path.join(dataDir, name), gunzipSync(readFileSync(path.join(dir, `${name}.gz`))));
    for (const name of ["sirketler.json", "sirketler.yedek.json"]) copyFileSync(path.join(dir, name), path.join(dataDir, name));
    let ctx = null;
    try {
      assert.deepEqual(hitsIn(dataDir, NEEDLE), ["destekofis.sqlite"], "ön koşul: numara şirket dosyasında");
      ctx = await startWa({ env: DEAD, dataDir, backupDir: path.join(root, "backups"), connect: false, ack: false, office: null, now: { time: new Date(Date.parse(info.at) + 2 * HOUR).toISOString(), fixed: true } });
      const textB = ctx.store.get("SELECT error_text FROM wa_jobs WHERE id = ?", info.jobs.B.id).error_text;
      await ctx.server.app.context.whatsapp.queue.maintain();
      const textA = ctx.store.get("SELECT error_text FROM wa_jobs WHERE id = ?", info.jobs.A.id).error_text;
      assert.ok(/Parameter value is not valid/.test(textA) && textA.includes("…") && !/532 111 22 33/.test(textA), `DÜŞÜK-1: eski metin bir kez temizlendi (eski kod: numara kalıyor) — ${textA}`);
      assert.equal(ctx.store.get("SELECT error_text FROM wa_jobs WHERE id = ?", info.jobs.B.id).error_text, textB, "talepsiz cari B'nin satırı değişmedi");
      assert.deepEqual(hitsIn(dataDir, NEEDLE), [], "program AÇIKKEN de (temizlik turundan hemen sonra) ana dosyada / WAL'da eski sayfa yok — denetim noktası");
      await ctx.server.app.context.whatsapp.queue.maintain();
      assert.equal(ctx.store.get("SELECT error_text FROM wa_jobs WHERE id = ?", info.jobs.A.id).error_text, textA, "eşgüçlü (ikinci tur aynı)");
      await ctx.close();
      ctx = null;
      assert.deepEqual(hitsIn(dataDir, NEEDLE), [], "veri klasörünün bütün dosyalarında (WAL dahil) numara YOK");
    } finally {
      await ctx?.close();
      removeTestDir(root);
    }
  });
  it("W3T-D2 (DK9): talepten SONRA açılan işin defter telefonu yeniden açılıştaki yeniden uygulamada SİLİNMEZ; talepten önceki iş silinmiş kalır", { timeout: 180_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-tur3-d2-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    const claimPhone = jobId => {
      const db = new DatabaseSync(path.join(dataDir, "whatsapp-gonderim.sqlite"), { readOnly: true });
      try {
        return db.prepare("SELECT phone FROM claims WHERE job_id = ?").get(jobId)?.phone ?? null;
      } finally {
        db.close();
      }
    };
    try {
      let before;
      let after;
      {
        const ctx = await startWa({ env: DEAD, dataDir, backupDir, now: NOW });
        try {
          const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
          const first = await ok(ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "talepten önceki iş");
          await ctx.drain();
          before = await jobOf(ctx, first.batch.id);
          ctx.clock.advance(HOUR);
          await ok(ctx.api.post(ERASE, { accountId: a.id, confirm: true }), "silme talebi");
          ctx.clock.advance(HOUR);
          const second = await ok(ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth", sendAgain: true }), "talepten SONRA iş");
          await ctx.drain();
          after = await jobOf(ctx, second.batch.id);
          assert.equal(after.state, "accepted", "ön koşul: talepten sonraki iş gitti");
        } finally {
          await ctx.close();
        }
      }
      assert.equal(claimPhone(before.id), `silinmis:${before.id}`, "ön koşul: talepten önceki işin defter telefonu silinmiş");
      assert.equal(claimPhone(after.id), "+905321112233", "ön koşul: talepten sonraki işin defter telefonu açık");
      const ctx = await startWa({ env: DEAD, dataDir, backupDir, connect: false, ack: false, office: null, now: { time: new Date(Date.parse(NOW.time) + 3 * HOUR).toISOString(), fixed: true } });
      try {
        await ctx.server.app.context.whatsapp.queue.maintain();
      } finally {
        await ctx.close();
      }
      assert.equal(claimPhone(after.id), "+905321112233", "DÜŞÜK-2 (DK9): talepten sonraki iş yeniden uygulamada silinmedi (mutant: silinir)");
      assert.equal(claimPhone(before.id), `silinmis:${before.id}`);
    } finally {
      removeTestDir(root);
    }
  });
});
