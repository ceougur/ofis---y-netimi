// 2.5.0 WhatsApp küçük işler TUR 1 — bildirim (web kancası) yolu: S33, S41, S43 (KULLANICI KARARLARI AYNEN, docs/2.5.0-IS-LISTESI.md D) + dar kontrol DÜŞÜK-2.
// Tasarım: docs/erp/WA-TUR1-TASARIM.md (koddan önce). Beklenenler karar metinlerinden ve "kime kaç kez" genel ilkesinden (31.10) yazıldı, programın çıktısından DEĞİL:
//   S33 = A — Yol 2'de "bildirim yolu çalışıyor" işaretini yalnız İMZALI bildirim koyar (ilke 2) → imzasız tek bildirimden sonra teslim bilgisi gelmeyen iş TTL + 1 sa'te
//             "Meta Kabul Etti"de kalır, kişi aynı dönemde "Daha Önce Gönderildi" (gönderilecek GÖRÜNMEZ).
//   S41 = A — Meta'da alternatif adres yokken uygulama düzeyi adrese (/wa/kanca/…) gelen bildirim kaydı olan WABA'nınsa alternatif adresle AYNI kurallarla işlenir (Yol 1
//             imzasız kabul, Yol 2 yalnız imzalı) ve Meta'daki adres hemen yeniden denetlenir.
//   S43 = A — wamid'i tanınmayan (bu kurulumun göndermediği) bildirim işareti koymaz; Y18-13 (kâhin okuması, BAŞ MİMAR KARARI listesinde): iş kimliğiyle tanınan (yanıtı
//             kaybolmuş) iletinin bildirimi koyar.
//   S33 ETKİLEŞİMİ (dar kontrol s5) + tasarım §2: işaret KİPE GÖRE, ŞİRKET + İMZA düzeyinde — bir şirketin bildirimi öbür şirketi işaretlemez (İLKEYLE ilke 2; BAŞ MİMAR KARARI).
//   DÜŞÜK-2 — kip şirket + WABA başına: özetteki kip yalnız o WABA'nınsa geçer (hub.modeOf).
// Düzenek: GERÇEK program + yerel SAHTE Meta (aynı el — kâhin DEĞİL, ders 5) + Yol 2 hücrelerinde GERÇEK kapıcı (test/whatsapp-wy-ortak.mjs: Meta imzası kapıcıda doğrulanır).
// Şablonun teslim süresi 12 sa (Meta listesinde) — TTL + 1 sa ufku testte kısa (kural değil, düzenek). Ders 13: sahte saat; TZ=UTC ve TZ=Europe/Istanbul. Ders 30: lisans servisi
// yerel ölü adres. Ders 48: dosyaya dokunan hücre YOK (veri dosyası yerinden alınmaz / değiştirilmez).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { sha256 } from "../server/lib/whatsapp/connection.mjs";
// Ad alanıyla (eski kodda — 3fe5a92d — APP_LEVEL_RECHECK_MS / rechecks yok: dosya yine yüklenir, hücre beklenen nedenle kırmızı olur — ders 38).
import * as appWebhookModule from "../server/lib/whatsapp/app-webhook.mjs";
import { createWhatsappHook } from "../server/lib/whatsapp/hook.mjs";
import { createWhatsappHub } from "../server/lib/whatsapp/hub.mjs";
import { removeTestDir } from "./helpers.mjs";
import { PNID, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";
import { kurulum, st } from "./whatsapp-wy-ortak.mjs";

const HOUR = 3_600_000;
const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const PUBLIC = "http://ofis-tur1.destekofis.test";
const SENT_BEFORE = "Daha Önce Gönderildi";
const silent = { info() {}, warn() {}, error() {} };
// Düzenek: program şablonlarının Meta'daki teslim süresi 12 saat (Meta'nın izin verdiği özel süre; kabul anında okunur).
const ttl12 = fake => {
  for (const tpl of fake.state.templates) if (String(tpl.name).startsWith("destekofis_")) tpl.message_send_ttl_seconds = 43_200;
};
const statusEvent = (statuses, entryId = WABA) => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: entryId, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });
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
const ledgerCount = (file, sql, ...args) => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare(sql).get(...args).n;
  } finally {
    db.close();
  }
};
const subscribedReads = fake => fake.requests.filter(item => item.method === "GET" && item.path.endsWith("/subscribed_apps")).length;
const subscribePosts = fake => fake.requests.filter(item => item.method === "POST" && item.path.endsWith("/subscribed_apps")).length;

// ---- Yol 1 (Elle Bağla) düzeneği: kapıcısız program (bildirim imzasız — kapıcı yokken işaret denetimi yok; Yol 1'in imzasız bildirimi tasarım gereğidir) ----
async function yol1() {
  const ctx = await startWa({ env: DEAD });
  try {
    ttl12(ctx.fake);
    ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
    const base = `http://127.0.0.1:${(await ctx.server.app.listenRemote(0, "127.0.0.1")).port}`;
    assert.equal((await ctx.api.post(`${URLS.conn}/hook`, {})).status, 200, "ön koşul: WABA'nın bildirim adresi Meta'ya kaydedildi");
    const hookPath = () => new URL(ctx.fake.state.override).pathname.split("/").pop();
    const info = (await ctx.api.get("/api/workspace/whatsapp/app-webhook")).data.data;
    assert.equal(info.ready, true, "ön koşul: uygulama düzeyi adres hazır");
    const appPath = new URL(info.callbackUrl).pathname.split("/").pop();
    const ts = () => String(Math.floor(ctx.clock.ms() / 1000));
    const y = {
      ...ctx,
      base,
      hookPath,
      appPath,
      ts,
      /** WABA'nın alternatif adresine (Meta'da kayıtlı gizli yol) bildirim. */
      hook: (statuses, entryId) => raw(base, "POST", `/wa/kanca/${hookPath()}`, statusEvent(statuses, entryId)),
      /** Uygulama düzeyi adrese (Webhook Bilgileri'ndeki Callback URL) bildirim. */
      app: (statuses, entryId) => raw(base, "POST", `/wa/kanca/${appPath}`, statusEvent(statuses, entryId)),
      async sent(name, phone) {
        const account = await ctx.account(name, phone, 800);
        const batch = await ctx.batch({ kind: "statement", ids: [account.id], preset: "thisMonth" });
        assert.equal(batch.status, 200, JSON.stringify(batch.data));
        await ctx.drain();
        const job = (await ctx.jobs(batch.data.data.batch.id))[0];
        assert.equal(job.state, "accepted", "ön koşul: Meta Kabul Etti");
        ctx.clock.advance(60_000);
        return { batchId: batch.data.data.batch.id, job, accountId: account.id };
      },
      state: async batchId => (await ctx.jobs(batchId))[0].state,
      skip: async accountId => ((await ctx.api.post(URLS.preview, { kind: "statement", ids: [accountId], preset: "thisMonth" })).data.data.people || []).map(person => person.skip || "gönderilecek"),
      st: (wamid, status, extra = {}) => ({ id: wamid, status, timestamp: ts(), recipient_id: "905334445566", ...extra }),
      /** TTL (12 sa) + 1 sa + 30 dk pay geçer (sınırdan uzak — kabul anı bildirim anı olabilir, K6), bakım turu (Süresi Doldu kararı) koşar. */
      async pastTtl() {
        ctx.clock.advance(13.5 * HOUR);
        await ctx.drain();
      },
    };
    return y;
  } catch (error) {
    await ctx.close();
    throw error;
  }
}
// ---- kurulum (iki şirket AYNI WABA + gerçek kapıcı) yardımcıları ----
async function sent001(s, name, phone) {
  const account = (await s.api.post("/api/workspace/accounts", { name, phone, openingBalance: "800" })).data.data;
  const batch = (await s.api.post(URLS.batches, { kind: "statement", ids: [account.id], preset: "thisMonth" })).data.data;
  await s.server.app.whatsapp.scheduler.drain();
  const job = (await s.api.get(`${URLS.batches}/${batch.batch.id}`)).data.data.jobs[0];
  assert.equal(job.state, "accepted", "ön koşul: 001'in işi Meta Kabul Etti");
  return { batchId: batch.batch.id, job, accountId: account.id };
}
const state001 = async (s, batchId) => (await s.api.get(`${URLS.batches}/${batchId}`)).data.data.jobs[0].state;
const skip001 = async (s, accountId) => ((await s.api.post(URLS.preview, { kind: "statement", ids: [accountId], preset: "thisMonth" })).data.data.people || []).map(person => person.skip || "gönderilecek");
async function pastTtl(s) {
  s.clock.advance(13.5 * HOUR);
  await s.server.app.whatsapp.scheduler.drain();
}
const marks = s => ({
  waba: ledgerCount(s.ledgerFile, "SELECT COUNT(*) AS n FROM hook_seen"),
  root: s.server.app.store.setting("whatsapp.hookSeen", ""),
  child: s.child().context.store.setting("whatsapp.hookSeen", ""),
});

describe("2.5.0 WhatsApp tur 1 — S33 / S43: bildirim yolu işareti yalnız imzalı (Yol 2) ve tanınan bildirimle, şirket düzeyinde", () => {
  it("T1-1 S33 · Yol 2 · İMZASIZ tek bildirim (kendi iletisi → 401, tanınmayan → 200) işaret koymaz: TTL + 1 sa'te iş Meta Kabul Etti, kişi Daha Önce Gönderildi (gönderilecek DEĞİL)", { timeout: 180_000 }, async () => {
    const s = await kurulum({ root: "manual", second: "embedded" });
    try {
      ttl12(s.fake);
      const efe = await s.sent("Efe Tan", "0533 444 55 71");
      const own = await s.post([st(s, efe.job.wamid, "sent")]);
      assert.equal(own.status, 401, `Yol 2'de imzasız kendi bildirimi yazılmaz (geldi ${own.status} ${own.text})`);
      const foreign = await s.post([st(s, "wamid.YABANCI-T1-0001", "delivered")]);
      assert.equal(foreign.status, 200, `tanınmayan imzasız bildirim kabul edilir ve düşer (geldi ${foreign.status} ${foreign.text})`);
      assert.deepEqual(marks(s), { waba: 0, root: "", child: "" }, "imzasız bildirim hiçbir düzeyde işaret koymadı");
      await pastTtl(s);
      assert.equal((await s.job(efe.batchId)).state, "accepted", "işaretsiz yol: iş TTL + 1 sa'te Süresi Doldu OLMAZ (Meta Kabul Etti)");
      assert.deepEqual(await s.skip(efe.accountId), [SENT_BEFORE], "almış olabilir → aynı dönemde elenir (ilke 2); yeniden gönderilecek GÖRÜNMEZ");
    } finally {
      await s.close();
    }
  });

  it("T1-2 S33 karşı yüzü · Yol 2 · İMZALI ve tanınan bildirim işareti koyar: teslim bilgisi gelmeyen iş TTL + 1 sa'te Süresi Doldu, kişi gönderilecek (K3)", { timeout: 180_000 }, async () => {
    const s = await kurulum({ root: "manual", second: "embedded" });
    try {
      ttl12(s.fake);
      const efe = await s.sent("Efe Tan", "0533 444 55 71");
      const signed = await s.post([st(s, efe.job.wamid, "sent")], { signed: true });
      assert.equal(signed.status, 200, signed.text);
      assert.notEqual(marks(s).child, "", "002'nin (şirket düzeyi) işareti kondu");
      assert.equal(marks(s).root, "", "001'in işareti konmadı (başka şirketin bildirimi)");
      await pastTtl(s);
      assert.equal((await s.job(efe.batchId)).state, "expired", "bildirim yolu çalışıyor + teslim yok → Süresi Doldu");
      assert.deepEqual(await s.skip(efe.accountId), ["gönderilecek"], "Süresi Doldu sayılmaz (kesin almadı — K3)");
    } finally {
      await s.close();
    }
  });

  it("T1-3 S43 · Yol 2 · wamid'i TANINMAYAN İMZALI delivered + read → 200 × 2 ama işaret yok: TTL + 1 sa'te Meta Kabul Etti, Daha Önce Gönderildi", { timeout: 180_000 }, async () => {
    const s = await kurulum({ root: "manual", second: "embedded" });
    try {
      ttl12(s.fake);
      const efe = await s.sent("Efe Tan", "0533 444 55 71");
      assert.equal((await s.post([st(s, "wamid.BASKA-UYGULAMA-0001", "delivered")], { signed: true })).status, 200);
      s.clock.advance(5 * HOUR);
      assert.equal((await s.post([st(s, "wamid.BASKA-UYGULAMA-0001", "read")], { signed: true })).status, 200);
      assert.deepEqual(marks(s), { waba: 0, root: "", child: "" }, "tanınmayan bildirim işaret koymadı");
      await pastTtl(s);
      assert.equal((await s.job(efe.batchId)).state, "accepted");
      assert.deepEqual(await s.skip(efe.accountId), [SENT_BEFORE]);
    } finally {
      await s.close();
    }
  });

  it("T1-4 Y18-13 · Yol 2 · yanıtı kaybolan (Sonucu Belirsiz) iletinin İMZALI sent'i iş kimliğiyle TANINIR ve işareti KOYAR: C Gönderildi; TTL + 1 sa'te A ve C Süresi Doldu, ikisi gönderilecek", { timeout: 180_000 }, async () => {
    const s = await kurulum({ root: "manual", second: "embedded" });
    try {
      ttl12(s.fake);
      const a = await s.sent("Ali Er", "0533 444 55 73");
      // C: istek Meta'da işlenir, yanıt gelmez (bağlantı kesilir) → Sonucu Belirsiz; Meta'daki iletinin wamid'i programda yok.
      const account = (await s.api.post(`/api/workspace/accounts${s.q}`, { name: "Cem Su", phone: "0533 444 55 74", openingBalance: "800" })).data.data;
      s.fake.state.dropAfter = /\/messages$/;
      const batch = (await s.api.post(`${URLS.batches}${s.q}`, { kind: "statement", ids: [account.id], preset: "thisMonth" })).data.data;
      await s.server.app.whatsapp.scheduler.drain();
      s.fake.state.dropAfter = null;
      const c = await s.job(batch.batch.id);
      assert.equal(c.state, "uncertain", `ön koşul: C Sonucu Belirsiz (geldi ${c.state})`);
      const meta = s.fake.state.messages.at(-1);
      assert.ok(meta?.wamid && meta.opaque, "ön koşul: Meta'da C'nin iletisi (wamid + iş kimliği)");
      assert.equal(marks(s).child, "", "ön koşul: işaret yok");
      s.clock.advance(HOUR);
      const res = await s.post([st(s, meta.wamid, "sent", { biz_opaque_callback_data: meta.opaque })], { signed: true });
      assert.equal(res.status, 200, res.text);
      assert.equal((await s.job(batch.batch.id)).state, "sent", "C iş kimliğiyle tanındı: Gönderildi");
      assert.notEqual(marks(s).child, "", "iş kimliğiyle tanınan bildirim işareti koydu (Y18-13)");
      s.clock.advance(13.5 * HOUR);
      await s.server.app.whatsapp.scheduler.drain();
      assert.equal((await s.job(a.batchId)).state, "expired", "A: bildirim yolu çalışıyor + teslim yok → Süresi Doldu");
      assert.equal((await s.job(batch.batch.id)).state, "expired", "C: Gönderildi + teslim yok → Süresi Doldu");
      assert.deepEqual(await s.skip(a.accountId), ["gönderilecek"]);
    } finally {
      await s.close();
    }
  });

  it("T1-5 S43 · Yol 1 · wamid'i tanınmayan İMZASIZ delivered → 200 ama işaret yok: TTL + 1 sa'te Meta Kabul Etti, Daha Önce Gönderildi", { timeout: 120_000 }, async () => {
    const y = await yol1();
    try {
      const a = await y.sent("Ayşe Yılmaz", "0532 111 22 33");
      const res = await y.hook([y.st("wamid.BASKA-ARAC-0001", "delivered")]);
      assert.equal(res.status, 200, res.text);
      assert.equal(y.store.setting("whatsapp.hookSeen", ""), "", "işaret yok");
      assert.equal(ledgerCount(y.wa.ledger.file, "SELECT COUNT(*) AS n FROM hook_seen"), 0, "WABA düzeyinde işaret yok");
      await y.pastTtl();
      assert.equal(await y.state(a.batchId), "accepted");
      assert.deepEqual(await y.skip(a.accountId), [SENT_BEFORE]);
    } finally {
      await y.close();
    }
  });

  it("T1-6 Yol 1 AYNEN · kendi iletisinin İMZASIZ sent'i kabul edilir ve işareti koyar: TTL + 1 sa'te Süresi Doldu, kişi gönderilecek", { timeout: 120_000 }, async () => {
    const y = await yol1();
    try {
      const a = await y.sent("Ayşe Yılmaz", "0532 111 22 33");
      const res = await y.hook([y.st(a.job.wamid, "sent")]);
      assert.equal(res.status, 200, res.text);
      assert.equal(await y.state(a.batchId), "sent");
      assert.notEqual(y.store.setting("whatsapp.hookSeen", ""), "", "şirketin işareti kondu");
      await y.pastTtl();
      assert.equal(await y.state(a.batchId), "expired");
      assert.deepEqual(await y.skip(a.accountId), ["gönderilecek"]);
    } finally {
      await y.close();
    }
  });
});

describe("2.5.0 WhatsApp tur 1 — S33 ETKİLEŞİMİ: aynı WABA'da iki şirket; işaret kipe göre, şirket + imza düzeyinde", () => {
  it("T1-7 001 Yol 1 + 002 Yol 2 · 001'in meşru İMZASIZ teslimi 002'yi işaretlemez: 002'nin işi TTL + 1 sa'te Meta Kabul Etti + Daha Önce Gönderildi; 001'in teslimsiz işi kendi işaretiyle Süresi Doldu", { timeout: 180_000 }, async () => {
    const s = await kurulum({ root: "manual", second: "embedded" });
    try {
      ttl12(s.fake);
      const efe = await s.sent("Efe Tan", "0533 444 55 71");
      const ece = await sent001(s, "Ece Su", "0533 444 55 70");
      const ali = await sent001(s, "Ali Can", "0533 444 55 75");
      const deniz = await sent001(s, "Deniz Ak", "0533 444 55 76");
      // 2.5.0 WhatsApp tur 3 (KULLANICI KARARI S90 = A — "yalnız şirketin ŞİMDİKİ kipinin uygulamasının adresinden … gelen bildirim koyar"): 001'in (Elle Bağla = müşterinin uygulaması)
      // bildirimi WhatsApp'ı Bağla'nın (002 — DestekOfis uygulaması) adresinden gelirse işi Teslim Edildi yapar ama 001'i İŞARETLEMEZ; 001'in kendi teslimi KENDİ (Elle Bağla)
      // uygulamasının adresinden gelir (S63: kayıt uygulama başına). Tur 1'in tek yollu düzeneği (001'in bildirimi 002'nin yoluna) tur 3'te bu iki adıma ayrıldı; beklentiler aynen.
      const other = await s.post([st(s, deniz.job.wamid, "delivered")]);
      assert.equal(other.status, 200, `001 (Yol 1) imzasız teslimi öbür uygulamanın adresinde de kabul (geldi ${other.status} ${other.text})`);
      assert.equal(await state001(s, deniz.batchId), "delivered", "S90: eski / öbür yolun bildirimi işi yine Teslim Edildi yapar");
      assert.equal(marks(s).root, "", "S90: öbür uygulamanın (002 — Yol 2) adresinden gelen bildirim 001'i işaretlemez");
      const own = await s.registerRoot();
      const res = await s.post([st(s, ece.job.wamid, "delivered")], { path: own });
      assert.equal(res.status, 200, `001 (Yol 1) imzasız teslimi kabul (geldi ${res.status} ${res.text})`);
      assert.equal(await state001(s, ece.batchId), "delivered");
      const m = marks(s);
      assert.equal(m.waba, 0, "WABA düzeyinde işaret yok");
      assert.notEqual(m.root, "", "001'in işareti kondu");
      assert.equal(m.child, "", "002'nin işareti konmadı");
      await pastTtl(s);
      assert.equal((await s.job(efe.batchId)).state, "accepted", "002 (Yol 2): imzalı bildirim yok → Süresi Doldu OLMAZ");
      assert.deepEqual(await s.skip(efe.accountId), [SENT_BEFORE]);
      assert.equal(await state001(s, ali.batchId), "expired", "001 (Yol 1 aynen): kendi bildirim yolu çalışıyor → teslimsiz iş Süresi Doldu");
      assert.deepEqual(await skip001(s, ali.accountId), ["gönderilecek"]);
    } finally {
      await s.close();
    }
  });

  it("T1-8 ters yön · 002'nin (Yol 2) İMZALI bildirimi 001'i (Yol 1) işaretlemez: 001'in teslimsiz işi Meta Kabul Etti, 002'ninki Süresi Doldu (BAŞ MİMAR KARARI — şirketler arası işaret yok)", { timeout: 180_000 }, async () => {
    const s = await kurulum({ root: "manual", second: "embedded" });
    try {
      ttl12(s.fake);
      const efe = await s.sent("Efe Tan", "0533 444 55 71");
      const ece = await sent001(s, "Ece Su", "0533 444 55 70");
      assert.equal((await s.post([st(s, efe.job.wamid, "sent")], { signed: true })).status, 200);
      const m = marks(s);
      assert.deepEqual([m.waba, m.root === "", m.child === ""], [0, true, false], "yalnız 002 işaretli");
      await pastTtl(s);
      assert.equal(await state001(s, ece.batchId), "accepted", "001: kendi yolu kanıtlanmadı → Süresi Doldu OLMAZ");
      assert.deepEqual(await skip001(s, ece.accountId), [SENT_BEFORE]);
      assert.equal((await s.job(efe.batchId)).state, "expired");
    } finally {
      await s.close();
    }
  });
});

describe("2.5.0 WhatsApp tur 1 — S41: uygulama düzeyi adrese gelen bildirim (kaydı olan WABA) aynı kurallarla işlenir, Meta'daki adres hemen yeniden denetlenir", () => {
  it("T1-9 Yol 1 · Meta'da alternatif adres YOK · uygulama düzeyi adrese İMZASIZ delivered → 200, iş Teslim Edildi, defterde teslim; adres Meta'ya YENİDEN kaydedilir (yeni gizli yol); TTL + 1 sa sonra Daha Önce Gönderildi", { timeout: 120_000 }, async () => {
    const y = await yol1();
    try {
      const a = await y.sent("Ayşe Yılmaz", "0532 111 22 33");
      const oldPath = y.hookPath();
      y.fake.state.override = null; // Meta'da alternatif adres kalktı (ör. gövdesiz subscribed_apps adımı yinelendi)
      const reads = subscribedReads(y.fake);
      const posts = subscribePosts(y.fake);
      const res = await y.app([y.st(a.job.wamid, "delivered")]);
      assert.equal(res.status, 200, res.text);
      assert.equal(await y.state(a.batchId), "delivered", "uygulama düzeyi bildirim işlendi (Yol 1 imzasız kabul)");
      assert.equal(ledgerCount(y.wa.ledger.file, "SELECT COUNT(*) AS n FROM deliveries WHERE job_id = ?", a.job.id), 1, "defterde teslim");
      await y.wa.appWebhook.rechecks?.settled();
      assert.equal(subscribedReads(y.fake) - reads, 1, "Meta'daki adres okundu (GET subscribed_apps)");
      assert.equal(subscribePosts(y.fake) - posts, 1, "alternatif adres yeniden kaydedildi (POST subscribed_apps)");
      assert.match(String(y.fake.state.override || ""), /^http:\/\/ofis-tur1\.destekofis\.test\/wa\/kanca\/[A-Za-z0-9_-]{43}$/);
      assert.notEqual(y.hookPath(), oldPath, "yeni gizli yol");
      assert.equal(y.wa.ledger.hookOf(WABA).state, "active");
      await y.pastTtl();
      assert.deepEqual(await y.skip(a.accountId), [SENT_BEFORE], "aldı → aynı dönemde elenir (ilke 3); teslim bilgisi adres yüzünden kaybolmadı");
    } finally {
      await y.close();
    }
  });

  it("T1-10 Yol 2 · uygulama düzeyi adrese İMZASIZ delivered → 401, yazılmaz; İMZALI delivered → 200, Teslim Edildi (işaret YOK — tur 3 S90); adres denetimi iki bildirimde TEK kez", { timeout: 180_000 }, async () => {
    const s = await kurulum({ root: "manual", second: "embedded" });
    try {
      ttl12(s.fake);
      const efe = await s.sent("Efe Tan", "0533 444 55 71");
      const reads = subscribedReads(s.fake);
      const unsigned = await s.postApp([st(s, efe.job.wamid, "delivered")]);
      assert.equal(unsigned.status, 401, `Yol 2 yalnız imzalı (geldi ${unsigned.status} ${unsigned.text})`);
      assert.equal(s.delivered(efe.job.id), false, "imzasız teslim deftere yazılmadı");
      assert.equal((await s.job(efe.batchId)).state, "accepted");
      assert.equal(marks(s).child, "", "imzasız uygulama düzeyi bildirim işaret koymadı");
      const signed = await s.postApp([st(s, efe.job.wamid, "delivered")], { signed: true });
      assert.equal(signed.status, 200, signed.text);
      assert.equal((await s.job(efe.batchId)).state, "delivered");
      assert.equal(s.delivered(efe.job.id), true);
      // 2.5.0 WhatsApp tur 3 — KULLANICI KARARI S90 = A ("işaretini yalnız şirketin ŞİMDİKİ kipinin uygulamasının adresinden (Yol 1'de uygulama düzeyi adres dahil) gelen bildirim
      // koyar"): uygulama düzeyi adres Yol 1'in (Elle Bağla) adresidir → Yol 2 şirketinde imzalı bildirim işi Teslim Edildi yapar ama işaret KOYMAZ (tur 1'de "koydu" bekleniyordu;
      // BAŞ MİMAR teyidi tur 3 raporunda).
      assert.equal(marks(s).child, "", "S90: uygulama düzeyi adres Yol 2'nin adresi değil → işaret konmadı");
      await s.server.app.whatsapp.appWebhook.rechecks?.settled();
      assert.equal(subscribedReads(s.fake) - reads, 1, "15 dk içinde iki bildirim → Meta'ya tek adres okuması");
      assert.deepEqual(await s.skip(efe.accountId), [SENT_BEFORE]);
    } finally {
      await s.close();
    }
  });

  it("T1-11 kaydı OLMAYAN WABA (zarftaki WABA bu kurulumda yok) · uygulama düzeyi adrese gelen bildirim düşer: 200, iş Meta Kabul Etti, defterde teslim yok, Meta'ya istek yok", { timeout: 120_000 }, async () => {
    const y = await yol1();
    try {
      const a = await y.sent("Ayşe Yılmaz", "0532 111 22 33");
      const before = y.fake.requests.length;
      const res = await y.app([y.st(a.job.wamid, "delivered")], "999999999999999");
      assert.equal(res.status, 200, res.text);
      await y.wa.appWebhook.rechecks?.settled();
      assert.equal(await y.state(a.batchId), "accepted");
      assert.equal(ledgerCount(y.wa.ledger.file, "SELECT COUNT(*) AS n FROM deliveries WHERE job_id = ?", a.job.id), 0);
      assert.equal(y.fake.requests.length, before, "Meta'ya istek gitmedi");
    } finally {
      await y.close();
    }
  });

  it("T1-12 adres denetiminin sıklığı · adres Meta'da BİZİMKİ: okunur, dokunulmaz; 15 dk içinde ikinci bildirimde yeniden okunmaz, 16. dakikada yine okunur", { timeout: 120_000 }, async () => {
    const y = await yol1();
    try {
      const a = await y.sent("Ayşe Yılmaz", "0532 111 22 33");
      const reads = subscribedReads(y.fake);
      const posts = subscribePosts(y.fake);
      const path0 = y.hookPath();
      assert.equal((await y.app([y.st(a.job.wamid, "sent")])).status, 200);
      await y.wa.appWebhook.rechecks?.settled();
      assert.equal(subscribedReads(y.fake) - reads, 1, "ilk bildirimde hemen okundu");
      assert.equal(subscribePosts(y.fake) - posts, 0, "adres bizimki → yeniden kaydedilmedi");
      assert.equal(y.hookPath(), path0);
      y.clock.advance(10 * 60_000);
      assert.equal((await y.app([y.st(a.job.wamid, "delivered")])).status, 200);
      await y.wa.appWebhook.rechecks?.settled();
      assert.equal(subscribedReads(y.fake) - reads, 1, "10. dakikada yeniden okunmadı");
      y.clock.advance(6 * 60_000);
      assert.equal((await y.app([y.st(a.job.wamid, "read")])).status, 200);
      await y.wa.appWebhook.rechecks?.settled();
      assert.equal(subscribedReads(y.fake) - reads, 2, "16. dakikada yine okundu");
      assert.equal(await y.state(a.batchId), "read");
    } finally {
      await y.close();
    }
  });

  it("T1-13 salt okunur lisans · uygulama düzeyi bildirim YİNE işlenir (kanca kabulü sürer) ama Meta'daki adres denetlenmez; şirket arka planda yazılamıyorsa (yazma kilidi / şema kapısı) 503 ve denetim yok", { timeout: 120_000 }, async () => {
    const y = await yol1();
    const license = y.server.app.license;
    const writable = license.writable;
    const context = y.server.app.context;
    const canWrite = context.canWriteInBackground;
    try {
      const a = await y.sent("Ayşe Yılmaz", "0532 111 22 33");
      y.fake.state.override = null;
      const before = y.fake.requests.length;
      license.writable = () => false; // salt okunur lisansın dış koşulu (sürücü düzeni)
      assert.equal((await y.app([y.st(a.job.wamid, "delivered")])).status, 200);
      await y.wa.appWebhook.rechecks?.settled();
      assert.equal(await y.state(a.batchId), "delivered", "bildirim işlendi");
      assert.equal(y.fake.requests.length, before, "salt okunur lisansta Meta'ya istek gitmedi");
      license.writable = writable;
      y.clock.advance(16 * 60_000);
      context.canWriteInBackground = () => false; // yazma kilidi / şema kapısı (BS-7: kapılı şirkete yazılmaz)
      const res = await y.app([y.st(a.job.wamid, "read")]);
      assert.equal(res.status, 503, `arka planda yazılamayan şirket → 503 (geldi ${res.status})`);
      await y.wa.appWebhook.rechecks?.settled();
      assert.equal(y.fake.requests.length, before, "yazılamayan şirket adres denetimi yapmadı");
    } finally {
      license.writable = writable;
      context.canWriteInBackground = canWrite;
      await y.close();
    }
  });
});

describe("2.5.0 WhatsApp tur 1 — DÜŞÜK-2: kip şirket + WABA başına (hub.modeOf); adres denetimi sıklığı (app-webhook rechecks)", () => {
  it("T1-14 hub.modeOf: özet (Yol 2, W2) yalnız W2'de geçer; W1'de makine defterindeki kip (Yol 1), bilinmeyen WABA'da null", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "destekofis-tur1-hub-"));
    const hub = createWhatsappHub({ dataDir: dir, log: silent, manual: true });
    try {
      hub.registry.set("c2", { configured: true, mode: "embedded", wabaId: "W2", phoneNumberId: "P2" });
      assert.equal(hub.ledger.noteMode("c2", "W1", "manual"), true, "ön koşul: eski WABA'daki kip defterde");
      assert.equal(hub.modeOf("c2", "W2"), "embedded");
      assert.equal(hub.modeOf("c2", "W1"), "manual", "özet başka WABA'nın → defterdeki kip (özetin kipi DEĞİL)");
      assert.equal(hub.modeOf("c2", "W3"), null, "bilinmeyen WABA → null (Yol 1 sayılır), özetin kipi değil");
      assert.equal(hub.modeOf("c9", "W2"), null);
    } finally {
      await hub.close();
      removeTestDir(dir);
    }
  });

  it("T1-15 kanca · şirket ŞİMDİ başka WABA'da Yol 2; ESKİ WABA'daki Yol 1 iletisinin İMZASIZ teslimi, şirket dosyası açılamazken (kalıcı) → 200 + defterde teslim (kip o WABA'nın)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "destekofis-tur1-kanca-"));
    const hub = createWhatsappHub({ dataDir: dir, log: silent, manual: true });
    const at = "2026-11-03T06:00:00.000Z";
    const secret = "A".repeat(43);
    const server = http.createServer();
    try {
      const ledger = hub.ledger;
      ledger.claim({ jobId: "j1", attempt: 1, batchId: "b1", companyId: "c2", wabaId: "W1", phone: "905330000001", at });
      assert.equal(ledger.outcome({ jobId: "j1", attempt: 1, outcome: "accepted", wamid: "wamid.D2-0001", companyId: "c2", wabaId: "W1", at }), true);
      ledger.hookEvent({ wabaId: "W1", pathHash: sha256(secret), verifyHash: sha256("v"), base: "http://x.test", state: "active", reason: "auto", error: "", at });
      ledger.noteMode("c2", "W1", "manual");
      hub.registry.set("c2", { configured: true, mode: "embedded", wabaId: "W2", phoneNumberId: "P2" });
      const hook = createWhatsappHook({
        hooks: ledger,
        companyOf: id => (id === "c2" ? { id: "c2", code: "002" } : null),
        companies: () => [{ id: "c2", code: "002" }],
        appFor: () => {
          throw Object.assign(new Error("veri dosyası yok"), { dataMissing: true });
        },
        verifyMark: () => ({ ok: true, signed: false }),
        modeOf: (id, wabaId) => hub.modeOf(id, wabaId),
        log: silent,
        now: () => new Date(at),
      });
      server.on("request", (req, res) => hook.handle(req, res));
      await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "W1", changes: [{ field: "messages", value: { metadata: { phone_number_id: "P1" }, statuses: [{ id: "wamid.D2-0001", status: "delivered", timestamp: String(Date.parse(at) / 1000), recipient_id: "905330000001" }] } }] }] });
      const res = await raw(base, "POST", `/wa/kanca/${secret}`, body);
      assert.equal(res.status, 200, `Yol 1 iletisinin imzasız teslimi (geldi ${res.status} ${res.text})`);
      assert.equal(ledger.deliveredJob("j1"), true, "defterde teslim (R3 sayar)");
    } finally {
      await new Promise(resolve => server.close(() => resolve()));
      await hub.close();
      removeTestDir(dir);
    }
  });

  it("T1-16 rechecks: WABA başına ilk istek hemen; 15 dk içinde ve uçuştayken yok; öbür WABA ayrı; 15 dk sonra yine; görev hatası yutulur", async () => {
    let ms = Date.parse("2026-11-03T06:00:00.000Z");
    const { APP_LEVEL_RECHECK_MS, createAppWebhook } = appWebhookModule;
    const app = createAppWebhook({ store: { setting: () => "", setSetting() {} }, dataDir: ".", now: () => new Date(ms) });
    let release;
    const gate = new Promise(resolve => (release = resolve));
    const ran = [];
    assert.equal(typeof app.rechecks?.request, "function", "adres denetimi sıklık izleyicisi var (S41)");
    assert.equal(app.rechecks.request("W1", async () => { ran.push("W1-a"); await gate; }), true);
    assert.equal(app.rechecks.request("W1", async () => ran.push("W1-b")), false, "uçuşta ikinci yok");
    assert.equal(app.rechecks.request("W2", async () => ran.push("W2-a")), true, "öbür WABA ayrı");
    release();
    await app.rechecks?.settled();
    ms += APP_LEVEL_RECHECK_MS - 1;
    assert.equal(app.rechecks.request("W1", async () => ran.push("W1-c")), false, "15 dk dolmadan yok");
    ms += 1;
    assert.equal(app.rechecks.request("W1", async () => { ran.push("W1-d"); throw new Error("Meta'ya ulaşılamadı"); }), true, "15 dk sonra yine");
    await app.rechecks?.settled();
    ms += APP_LEVEL_RECHECK_MS;
    assert.equal(app.rechecks.request("W1", async () => ran.push("W1-e")), true, "görev hatasından sonra da sürer");
    await app.rechecks?.settled();
    assert.deepEqual(ran, ["W1-a", "W2-a", "W1-d", "W1-e"]);
    assert.equal(APP_LEVEL_RECHECK_MS, 15 * 60_000);
  });
});
