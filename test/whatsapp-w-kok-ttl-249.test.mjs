// 2.4.9 W-KÖK — KULLANICI (03.11.2026 ~20:05 UTC, "2.5.0 bırakmasak büyük bir iş mi?"; docs/2.4.9-IS-LISTESI.md): bir iş KABUL EDİLDİĞİ ANDAKİ teslim süresiyle
// değerlendirilir. Meta listesindeki süre sonradan KISALIRSA önceden kabul edilmiş iş ESKİ süreyle değerlendirilir; kabul anında süre bilinmiyorsa (2.4.8'den gelen / geri yüklenen
// eski veri) 30 gün. KULLANICI KARARI (03.11.2026 ~21:00 UTC): süre kabulden sonra UZARSA önceden kabul edilmiş iş UZUN süreyle. "Süresi Doldu" (P3: sayılmaz), PDF silme ve
// "Daha Önce Gönderildi" sayımı bu kurala göre. W-T §15 (KULLANICI KARARI 03.11 ~18:45 UTC): "Meta listesinin bildirdiği değer varsa o, yoksa 30 gün (+1 sa)" — W kâhini A1
// (docs/kanit/2026-11-03/kahin-w/, dal is/kahin-w-249): Şablonları Denetle'ye basılmamış şirkette Meta'nın bildirdiği süre hiç uygulanmıyordu; gönderim çekirdeğinin taze
// okuması da süreyi öğretir. Beklenen sayılar bu kural metinlerinden ve testin girdiği veriden yazıldı, programın kodundan değil (ders 5).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL; gerçek Meta'ya istek YOK — ders 30) + elle sürülen işçi (ders 20) + sahte saat (ders 13). "Süresi Doldu" yalnız
// bildirim yolu çalışırken yazılır (son 7 günde bir durum bildirimi, plan §7a 16): testler "sent" bildirimi verir. Dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur (ders 13, 22).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";
import { deliveryTtlSeconds } from "../server/lib/whatsapp/templates.mjs";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const DEFAULT_TTL = 30 * 24 * 3600; // Meta'nın varsayılanı 30 gün (sn)
const TTL_FIELD = "message_send_ttl_seconds";
const ENSURE = "/api/workspace/whatsapp/templates/ensure";
const EKSTRE = "destekofis_ekstre";
const program = fake => fake.state.templates.filter(item => item.name.startsWith("destekofis_"));
// Meta'nın şablon listesinde bildirdiği teslim süresi (müşteri WhatsApp Yöneticisi'nde değiştirdi); null: Meta varsayılanı (listede alan yok).
function setListedTtl(fake, seconds) {
  for (const tpl of program(fake)) {
    if (seconds === null) delete tpl[TTL_FIELD];
    else tpl[TTL_FIELD] = seconds;
  }
}
const ts = ctx => String(Math.floor(ctx.clock.ms() / 1000));
const toPhone = (ctx, digits) => ctx.messages().filter(item => String(item.to || item.body?.to || "").endsWith(digits)).length;

async function denetle(ctx, q = "") {
  const res = await ctx.api.post(`${ENSURE}${q}`, {});
  assert.equal(res.status, 200, `Şablonları Denetle: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
}

/** Bir ekstre (thisMonth ya da verilen dönem) gönderilir, Meta kabul eder, "sent" bildirimi gelir. Dönüş: { body, batchId, wamid, state(), job() }. */
async function sendOne(ctx, account, { q = "", preset = "thisMonth", apply = null } = {}) {
  const body = { kind: "statement", ids: [account.id], preset };
  const res = await ctx.api.post(`${URLS.batches}${q}`, body);
  assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
  const batchId = res.data.data.batch.id;
  await ctx.drain();
  const job = async () => (await ctx.api.get(`${URLS.batches}/${batchId}${q}`)).data.data.jobs[0];
  const first = await job();
  assert.equal(first.state, "accepted", `ön koşul: Meta kabul etti (geldi ${first.state})`);
  const status = [{ id: first.wamid, status: "sent", timestamp: ts(ctx) }];
  if (apply) apply(status);
  else ctx.statuses(status);
  return { body, batchId, wamid: first.wamid, job, state: async () => (await job()).state };
}
// Bildirim yolu canlı kalsın (son 7 günde bildirim — §7a 16): bilinmeyen bir iletinin bildirimi.
let alive = 0;
const keepHookAlive = (ctx, apply = null) => {
  alive += 1;
  const list = [{ id: `wamid.KOKCANLI${String(alive).padStart(5, "0")}`, status: "sent", timestamp: ts(ctx) }];
  if (apply) apply(list);
  else ctx.statuses(list);
};
const preview = async (ctx, body, q = "") => {
  const res = await ctx.api.post(`${URLS.preview}${q}`, body);
  assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
  return res.data.data.people[0].skip || "gönderilecek";
};

/** İkinci şirket AYNI WhatsApp hesabında (WABA): bağlantı + onay + firma adı; kuyruğu (durum bildirimi için) yakalanır. */
async function secondCompany(ctx) {
  const queues = new Map();
  const sch = ctx.wa.scheduler;
  const reg = sch.register.bind(sch);
  sch.register = (key, queue) => {
    queues.set(String(key), queue);
    return reg(key, queue);
  };
  const created = await ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const company = created.data.data.company || created.data.data;
  const q = `?hofCompany=${encodeURIComponent(company.id)}`;
  assert.equal((await ctx.api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
  assert.equal((await ctx.api.put(`${URLS.ack}${q}`, { ack: true })).status, 200);
  assert.equal((await ctx.api.put(`/api/admin/office${q}`, { name: "İkinci Şirket" })).status, 200);
  const account = async (name, phone) => {
    const res = await ctx.api.post(`/api/workspace/accounts${q}`, { name, phone, openingBalance: "900" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    return res.data.data;
  };
  return { company, q, account, apply: list => queues.get(company.id).applyStatuses(list, { phoneNumberId: PNID }) };
}

describe("2.4.9 W-T §15 + kâhin A1 — Meta'nın listede bildirdiği süre Şablonları Denetle'ye basılmadan da uygulanır", () => {
  it("Denetle YOK, Meta ekstre şablonunda 12 sa bildirir: toplu işin taze okumasıyla bilinir — 13 sa − 1 dk Gönderildi, 13 sa + 1 dk Süresi Doldu + PDF silinir; aynı dönemde yeniden gönderilebilir (P3)", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      const one = await sendOne(ctx, await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250));
      ctx.clock.advance(13 * HOUR - MIN);
      await ctx.drain();
      assert.equal(await one.state(), "sent", "12 saat + 1 saat dolmadı");
      assert.equal(ctx.fake.state.deleted.length, 0);
      ctx.clock.advance(2 * MIN);
      await ctx.drain();
      assert.equal(await one.state(), "expired", "Meta'nın bildirdiği 12 saat + 1 saatte Süresi Doldu (Denetle'ye basılmamış şirkette de)");
      assert.equal(ctx.fake.state.deleted.length, 1, "PDF Meta'dan silindi");
      assert.equal(await preview(ctx, one.body), "gönderilecek", "Süresi Doldu 'Daha Önce Gönderildi' sayılmaz (P3)");
    } finally {
      await ctx.close();
    }
  });

  it("Denetle YOK: kabulde süre bildirilmiyor (30 gün) → 14. saatte Meta 12 sa bildirir → önizleme taze okur: önceki iş Süresi Doldu OLMAZ, 'Daha Önce Gönderildi'; sonra kabul edilen iş 12 sa'le Süresi Doldu", async () => {
    const ctx = await startWa();
    try {
      const a = await sendOne(ctx, await ctx.account("Önceki Kişi", "0532 110 00 01", 100));
      ctx.clock.advance(14 * HOUR);
      setListedTtl(ctx.fake, 43_200);
      assert.equal(await preview(ctx, a.body), "Daha Önce Gönderildi", "önizleme (taze okuma) — kişi elenir");
      await ctx.drain();
      assert.equal(await a.state(), "sent", "kabul anında süre 30 gündü");
      const c = await sendOne(ctx, await ctx.account("Sonraki Kişi", "0532 110 00 02", 100));
      ctx.clock.advance(13 * HOUR + MIN);
      await ctx.drain();
      assert.equal(await c.state(), "expired", "12 sa bilinirken kabul edilen iş 12 saat + 1 saatte Süresi Doldu");
      assert.equal(await a.state(), "sent", "önceki iş 30 günle");
      assert.equal(ctx.fake.state.deleted.length, 1, "yalnız sonraki işin PDF'i silindi");
    } finally {
      await ctx.close();
    }
  });

  // Dar kontrol (W-KÖK) boşluğu: SÜREN toplu işin R2 yeniden okuması (§7a 27: en geç 10 dk / her 100 iletide; önizleme/başlatma dışındaki okuma) da süreyi öğretir.
  // Mutasyon N11 (queue.mjs checkTemplate: süre yalnız `note` verilen okumalarda günlüğe) bu hücrede kırmızı olmalı.
  it("Denetle YOK, süren toplu iş: başta 12 sa, 1. iş kabul → Meta süreyi 30 güne uzatır → 11 dk sonra 2. iş (süren işin yeniden okuması) → 1. işin kabulünden 13 sa + 1 dk: hiçbir iş Süresi Doldu DEĞİL, günlükte 30 gün", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      const ids = [];
      ids.push((await ctx.account("Süren İş Bir", "0532 120 00 01", 100)).id);
      ids.push((await ctx.account("Süren İş İki", "0532 120 00 02", 100)).id);
      const templateReads = () => ctx.fake.requests.filter(item => item.method === "GET" && /^\/\d+\/message_templates$/.test(item.path)).length;
      const started = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" }); // başlatma: taze okuma (12 sa)
      assert.equal(started.status, 200, JSON.stringify(started.data).slice(0, 300));
      const batchId = started.data.data.batch.id;
      const readsAtStart = templateReads();
      const ttlLog = () => (JSON.parse(ctx.store.setting("whatsapp.ttlSince", "") || "{}").items?.[EKSTRE] || []).map(entry => entry.seconds);
      assert.deepEqual(ttlLog(), [43_200], "ön koşul: başlatmanın taze okuması 12 saati günlüğe yazdı (1. iş 12 sa bilinirken kabul edilecek)");
      await ctx.drain({ max: 1, maintain: false }); // yalnız 1. iş (önbellekteki karar; yeniden okuma yok)
      let jobs = await ctx.jobs(batchId);
      const first = jobs.find(job => job.state === "accepted");
      assert.ok(first, `ön koşul: 1. iş Meta Kabul Etti (durumlar ${jobs.map(job => job.state).join(",")})`);
      assert.equal(jobs.filter(job => job.state === "accepted").length, 1, `ön koşul: toplu iş SÜRÜYOR — yalnız 1 iş kabul edildi (durumlar ${jobs.map(job => job.state).join(",")})`);
      assert.equal(templateReads(), readsAtStart, "ön koşul: 1. işte şablon yeniden okunmadı (başlatmanın okuması önbellekte)");
      ctx.statuses([{ id: first.wamid, status: "sent", timestamp: ts(ctx) }]); // bildirim yolu canlı (§7a 16)
      setListedTtl(ctx.fake, DEFAULT_TTL); // müşteri WhatsApp Yöneticisi'nde süreyi 30 güne uzattı
      ctx.clock.advance(11 * MIN); // R2: en geç 10 dk'da bir yeniden okuma
      await ctx.drain({ maintain: false });
      assert.equal(templateReads(), readsAtStart + 1, "ön koşul (ders 20/38): süren işin yeniden okuması GERÇEKTEN Meta'ya gitti (tek okuma)");
      jobs = await ctx.jobs(batchId);
      assert.equal(jobs.filter(job => job.state === "accepted" || job.state === "sent").length, 2, `ön koşul: 2. iş de kabul edildi (durumlar ${jobs.map(job => job.state).join(",")})`);
      const second = jobs.find(job => job.wamid !== first.wamid);
      ctx.statuses([{ id: second.wamid, status: "sent", timestamp: ts(ctx) }]);
      ctx.clock.advance(13 * HOUR + MIN - 11 * MIN); // 1. işin kabulünden 13 sa + 1 dk
      await ctx.drain();
      jobs = await ctx.jobs(batchId);
      assert.equal(jobs.filter(job => job.state === "expired").length, 0, `süre kabulden sonra 30 güne uzadı: uzun olan geçer — Süresi Doldu olmamalı (durumlar ${jobs.map(job => job.state).join(",")})`);
      assert.equal(jobs.filter(job => job.state === "sent").length, 2);
      assert.equal(ctx.fake.state.deleted.length, 0, "PDF silinmedi");
      assert.deepEqual(ttlLog(), [43_200, DEFAULT_TTL], "süren işin yeniden okuması 30 günü günlüğe yazmalı");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.9 W-KÖK — iş kabul anındaki teslim süresiyle değerlendirilir (Şablonları Denetle yolu)", () => {
  it("p3 Denetle yolu: kabul → 14 sa → Meta listesi 12 sa bildirir → Şablonları Denetle → bakım: iş Süresi Doldu OLMAZ, PDF silinmez; kişi 'Daha Önce Gönderildi', aynı dönemde 2. ileti gitmez; 'Yine de Gönder' açık", async () => {
    const ctx = await startWa();
    try {
      await denetle(ctx); // Meta listesi teslim süresi bildirmiyor: 30 gün
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const one = await sendOne(ctx, a);
      ctx.clock.advance(14 * HOUR);
      setListedTtl(ctx.fake, 43_200); // müşteri WhatsApp Yöneticisi'nde 12 saat yaptı
      await denetle(ctx);
      await ctx.drain(); // bakım: süre dolumu
      assert.equal(await one.state(), "sent", "kabul anında süre 30 gündü: sonradan kısalan süre geriye dönük Süresi Doldu yapmamalı");
      assert.equal(ctx.fake.state.deleted.length, 0, `Meta hâlâ teslim etmeye çalışırken PDF silinmemeli (silinen ${ctx.fake.state.deleted.length})`);
      assert.equal(await preview(ctx, one.body), "Daha Önce Gönderildi", "aynı dönemde kişi elenir (ilke 2/3)");
      const second = await ctx.batch({ ...one.body, requestId: "w-kok-p3-ikinci" });
      assert.equal(second.status, 400, `ikinci toplu iş başlamamalı (geldi ${second.status} ${JSON.stringify(second.data).slice(0, 200)})`);
      await ctx.drain();
      assert.equal(toPhone(ctx, "5321112233"), 1, "aynı dönemde kişiye tek ekstre");
      // İlke 4 (çıkmaz yok): kullanıcı "Yine de Gönder" ile gönderebilir.
      assert.equal(await preview(ctx, { ...one.body, sendAgain: true }), "gönderilecek", "'Yine de Gönder' açık");
      const anyway = await ctx.batch({ ...one.body, sendAgain: true, requestId: "w-kok-p3-yine" });
      assert.equal(anyway.status, 200, JSON.stringify(anyway.data).slice(0, 200));
      await ctx.drain();
      assert.equal(toPhone(ctx, "5321112233"), 2, "Yine de Gönder ile (onaylı) ikinci ekstre gider");
    } finally {
      await ctx.close();
    }
  });

  it("Denetle'den SONRA kabul edilen iş yeni süreyle (12 sa) ölçülür; önceki iş 30 gün + 1 sa'te Süresi Doldu + PDF silinir", async () => {
    const ctx = await startWa();
    try {
      await denetle(ctx);
      const a = await sendOne(ctx, await ctx.account("Önceki Kişi", "0532 100 00 01", 100));
      ctx.clock.advance(14 * HOUR);
      setListedTtl(ctx.fake, 43_200);
      await denetle(ctx); // değişim anı D
      ctx.clock.advance(30 * MIN);
      const b = await sendOne(ctx, await ctx.account("Sonraki Kişi", "0532 100 00 02", 100)); // D + 30 dk
      ctx.clock.advance(13 * HOUR - MIN);
      await ctx.drain();
      assert.equal(await b.state(), "sent", "B: 12 sa + 1 sa dolmadı");
      ctx.clock.advance(2 * MIN); // B kabulünden 13 sa + 1 dk
      await ctx.drain();
      assert.equal(await b.state(), "expired", "B (değişimden sonra kabul): Meta'nın bildirdiği 12 saat + 1 saatte Süresi Doldu");
      assert.equal(await a.state(), "sent", "A (değişimden önce kabul): 30 gün");
      assert.equal(ctx.fake.state.deleted.length, 1, "yalnız B'nin PDF'i silindi");
      // Şu an A'nın kabulünden 27 sa 31 dk. A'nın kabulünden 30 gün − 1 sa 59 dk: bildirim yolu canlı tutulur; sonra 30 gün + 1 sa + 2 dk.
      ctx.clock.advance(30 * DAY - 29 * HOUR - 30 * MIN);
      keepHookAlive(ctx);
      ctx.clock.advance(3 * HOUR + MIN);
      await ctx.drain();
      assert.equal(await a.state(), "expired", "A: 30 gün + 1 saatte Süresi Doldu");
      assert.equal(ctx.fake.state.deleted.length, 2, "A'nın PDF'i de silindi");
    } finally {
      await ctx.close();
    }
  });

  it("süre iki kez KISALIRSA (30 gün → 1 gün → 12 sa): her iş kendi kabul anındaki süreyle — ilk değişimden önceki 30 gün, aradaki 1 gün", async () => {
    const ctx = await startWa();
    try {
      await denetle(ctx);
      ctx.clock.advance(2 * HOUR);
      const a = await sendOne(ctx, await ctx.account("Otuz Gün", "0532 200 00 01", 100)); // 30 gün
      ctx.clock.advance(HOUR);
      setListedTtl(ctx.fake, 86_400);
      await denetle(ctx); // D1
      ctx.clock.advance(HOUR);
      // Arada Meta okuması düşen bir Denetle (502): öğrenilmiş süreler korunur.
      ctx.fake.state.failQueue.push({ match: /^GET \/\d+\/message_templates$/, status: 500, raw: "<html>Bad Gateway</html>" });
      assert.equal((await ctx.api.post(ENSURE, {})).status, 502, "ön koşul: Denetle'nin Meta okuması düştü");
      ctx.clock.advance(HOUR);
      const b = await sendOne(ctx, await ctx.account("Bir Gün", "0532 200 00 02", 100)); // D1 + 2 sa: 1 gün
      ctx.clock.advance(HOUR);
      setListedTtl(ctx.fake, 43_200);
      await denetle(ctx); // D2
      ctx.clock.advance(12 * HOUR + MIN); // B kabulünden 13 sa + 1 dk
      await ctx.drain();
      assert.equal(await b.state(), "sent", "B 1 günlük süreyle kabul edildi: 13. saatte Süresi Doldu olmamalı");
      assert.equal(await a.state(), "sent", "A 30 günle kabul edildi");
      ctx.clock.advance(12 * HOUR); // B kabulünden 25 sa + 1 dk
      await ctx.drain();
      assert.equal(await b.state(), "expired", "B: kabul anındaki 1 gün + 1 saatte Süresi Doldu");
      assert.equal(await a.state(), "sent", "A: 30 gün dolmadı (ilk değişimden önceki iş)");
    } finally {
      await ctx.close();
    }
  });

  it("süre UZARSA (KULLANICI KARARI 03.11 ~21:00 UTC: uzun süre): 12 sa'le kabul edilen iş, süre 30 güne çıkınca 30 günle; sonra 6 saate kısalsa da 30 günle; yeni iş 6 sa'le", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      await denetle(ctx);
      ctx.clock.advance(2 * HOUR);
      const a = await sendOne(ctx, await ctx.account("Uzayan Süre", "0532 300 00 01", 100)); // 12 sa bilinirken
      ctx.clock.advance(HOUR);
      setListedTtl(ctx.fake, null); // Meta varsayılanı (30 gün)
      await denetle(ctx);
      ctx.clock.advance(12 * HOUR + MIN); // A kabulünden 13 sa + 1 dk
      await ctx.drain();
      assert.equal(await a.state(), "sent", "süre uzadı: uzun olan (30 gün) geçer");
      setListedTtl(ctx.fake, 21_600);
      await denetle(ctx); // 6 saate kısaldı
      await ctx.drain();
      assert.equal(await a.state(), "sent", "kabulden sonra görülen en uzun süre (30 gün) geçer; sonraki kısalma geriye işlemez");
      ctx.clock.advance(HOUR);
      const b = await sendOne(ctx, await ctx.account("Yeni Kişi", "0532 300 00 02", 100));
      ctx.clock.advance(7 * HOUR + MIN);
      await ctx.drain();
      assert.equal(await b.state(), "expired", "yeni iş Meta'nın bildirdiği 6 saat + 1 saatte Süresi Doldu");
      assert.equal(await a.state(), "sent");
    } finally {
      await ctx.close();
    }
  });

  it("2.4.8'den gelen veri (kabul anında süre bilinmiyor; şablon kaydında 12 sa): iş 30 günle; sonraki Denetle'den sonra kabul edilen iş 12 sa'le", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      const a = await sendOne(ctx, await ctx.account("Eski Kayıt", "0532 400 00 01", 100));
      // 2.4.8'in verisi: iş 2.4.8'de kabul edildi (2.4.9'un teslim süresi günlüğü yok); 2.4.8'in Şablonları Denetle kaydında Meta'nın 12 saati.
      ctx.store.setSetting("whatsapp.ttlSince", "");
      const meta = (id, name) => ({ id, name, language: "tr", status: "APPROVED", category: "UTILITY", [TTL_FIELD]: 43_200 });
      ctx.store.setSetting(
        "whatsapp.templates",
        JSON.stringify({
          v: 1,
          at: new Date(ctx.clock.ms() - DAY).toISOString(),
          wabaId: WABA,
          phoneNumberId: PNID,
          by: "",
          byName: "Yönetici",
          items: [
            { name: EKSTRE, meta: meta("900000000000011", EKSTRE) },
            { name: "destekofis_odeme_hatirlatma", meta: meta("900000000000012", "destekofis_odeme_hatirlatma") },
          ],
          actions: [],
          complete: true,
          error: null,
        }),
      );
      ctx.clock.advance(13 * HOUR + MIN);
      await ctx.drain();
      assert.equal(await a.state(), "sent", "kabul anında süre bilinmiyordu → 30 gün (eski kayıttaki 12 sa geriye işlemez)");
      assert.equal(ctx.fake.state.deleted.length, 0, "PDF silinmedi");
      await denetle(ctx); // aynı 12 sa — artık biliniyor
      await ctx.drain();
      assert.equal(await a.state(), "sent", "Denetle önceden kabul edilmiş işi yine 30 günle bırakır");
      ctx.clock.advance(HOUR);
      const b = await sendOne(ctx, await ctx.account("Yeni Kayıt", "0532 400 00 02", 100));
      ctx.clock.advance(13 * HOUR + MIN);
      await ctx.drain();
      assert.equal(await b.state(), "expired", "12 sa bilinirken kabul edilen iş 12 saat + 1 saatle");
      assert.equal(await a.state(), "sent");
    } finally {
      await ctx.close();
    }
  });

  it("iki şirket AYNI WhatsApp hesabında: 002'de kabul edilmiş iş; süre kısalınca önce 001'de, sonra 002'de Denetle → 002'nin işi Süresi Doldu OLMAZ, 002'de kişiye tek ekstre", async () => {
    const ctx = await startWa({ maxCompanies: 2 });
    try {
      const two = await secondCompany(ctx);
      await denetle(ctx);
      await denetle(ctx, two.q);
      const a = await two.account("Ortak Hesap Kişi", "0532 500 00 01");
      const one = await sendOne(ctx, a, { q: two.q, apply: two.apply });
      ctx.clock.advance(14 * HOUR);
      setListedTtl(ctx.fake, 43_200);
      await denetle(ctx); // 001
      await ctx.drain();
      assert.equal(await one.state(), "sent", "001'in Denetle'si 002'nin işini değiştirmez");
      await denetle(ctx, two.q); // 002
      await ctx.drain();
      assert.equal(await one.state(), "sent", "002'nin işi kabul anındaki 30 günle");
      assert.equal(await preview(ctx, one.body, two.q), "Daha Önce Gönderildi");
      const second = await ctx.api.post(`${URLS.batches}${two.q}`, { ...one.body, requestId: "w-kok-iki-sirket" });
      assert.equal(second.status, 400, `002'de ikinci toplu iş başlamamalı (geldi ${second.status})`);
      await ctx.drain();
      assert.equal(toPhone(ctx, "5325000001"), 1, "aynı dönemde kişiye tek ekstre");
    } finally {
      await ctx.close();
    }
  });

  it("geri yüklenen yedek (002): kabul → süre 12 saate kısaldı + Denetle → yedek → geri yükleme → bakım: iş Süresi Doldu OLMAZ, 'Daha Önce Gönderildi', 2. ileti gitmez", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ maxCompanies: 2 });
    try {
      const two = await secondCompany(ctx);
      await denetle(ctx, two.q);
      const a = await two.account("Yedek Kişi", "0532 600 00 01");
      const one = await sendOne(ctx, a, { q: two.q, apply: two.apply });
      ctx.clock.advance(2 * HOUR);
      setListedTtl(ctx.fake, 43_200);
      await denetle(ctx, two.q);
      const made = await ctx.api.post("/api/admin/backups", { scope: "one", companyId: two.company.id });
      assert.equal(made.status, 200, JSON.stringify(made.data).slice(0, 300));
      const name = made.data.data.backups[0].name;
      ctx.clock.advance(MIN);
      const restored = await ctx.api.post("/api/admin/backups/restore", { name, company: two.company.id, confirm: two.company.code, password: ADMIN_PASSWORD });
      assert.equal(restored.status, 200, JSON.stringify(restored.data).slice(0, 300));
      assert.equal(await one.state(), "sent", "ön koşul: geri yüklenen iş Gönderildi");
      ctx.clock.advance(12 * HOUR); // kabulden 14 sa + 1 dk
      keepHookAlive(ctx, two.apply);
      await ctx.drain();
      assert.equal(await one.state(), "sent", "geri yüklenen veride de kabul anındaki süre (30 gün)");
      assert.equal(await preview(ctx, one.body, two.q), "Daha Önce Gönderildi");
      const second = await ctx.api.post(`${URLS.batches}${two.q}`, { ...one.body, requestId: "w-kok-yedek" });
      assert.equal(second.status, 400, `ikinci toplu iş başlamamalı (geldi ${second.status})`);
      await ctx.drain();
      assert.equal(toPhone(ctx, "5326000001"), 1);
    } finally {
      await ctx.close();
    }
  });

  it("ay sonu / gece yarısı: 31.10 20:00 kabul (Ekim ekstresi) → 01.11 09:30 süre 12 saate kısaldı + Denetle → iş Süresi Doldu OLMAZ; 'Geçen Ay' önizlemesi 'Daha Önce Gönderildi', 2. Ekim ekstresi gitmez", async () => {
    const ctx = await startWa({ now: { time: "2026-10-31T20:00:00+03:00", fixed: true } });
    try {
      await denetle(ctx);
      const one = await sendOne(ctx, await ctx.account("Ay Sonu Kişi", "0532 700 00 01", 100));
      ctx.clock.set(new Date("2026-11-01T09:30:00+03:00").toISOString());
      setListedTtl(ctx.fake, 43_200);
      await denetle(ctx);
      await ctx.drain();
      assert.equal(await one.state(), "sent", "kabul anındaki 30 gün: ay dönümünde geriye dönük Süresi Doldu yok");
      const lastMonth = { ...one.body, preset: "lastMonth" };
      assert.equal(await preview(ctx, lastMonth), "Daha Önce Gönderildi", "Ekim ekstresi zaten gitti");
      const second = await ctx.batch({ ...lastMonth, requestId: "w-kok-ay-sonu" });
      assert.equal(second.status, 400, `ikinci Ekim ekstresi başlamamalı (geldi ${second.status})`);
      await ctx.drain();
      assert.equal(toPhone(ctx, "5327000001"), 1);
    } finally {
      await ctx.close();
    }
  });
});

// Birim hücreleri 2.4.9'un teslim süresi günlüğünü (whatsapp.ttlSince) doğrudan kurar: eski kodda bu satır YOK — oradaki kırmızıları kanıt sayılmaz (ders 38); dişin kanıtı
// yukarıdaki program hücreleri ve mutasyonlar.
describe("2.4.9 W-KÖK — kural (birim): deliveryTtlSeconds(store, WABA, ad, kabulAnı) ve günlük", () => {
  const D1 = Date.parse("2026-11-03T06:00:00.000Z");
  const at = ms => new Date(ms).toISOString();
  const since = (seconds, ms) => ({ seconds, since: at(ms) });
  const fakeStore = (rows = new Map()) => ({ rows, setting: (key, fallback = "") => (rows.has(key) ? rows.get(key) : fallback), setSetting: (key, value) => rows.set(key, value) });
  const withLog = (log, wabaId = WABA) => fakeStore(new Map([["whatsapp.ttlSince", JSON.stringify({ v: 1, wabaId, items: { [EKSTRE]: log } })]]));

  it("günlük yok / başka hesabın günlüğü: kabul anında süre bilinmiyor → 30 gün", () => {
    assert.equal(deliveryTtlSeconds(fakeStore(), WABA, EKSTRE, at(D1)), DEFAULT_TTL);
    assert.equal(deliveryTtlSeconds(withLog([since(43_200, D1)], "999"), WABA, EKSTRE, at(D1 + 5 * HOUR)), DEFAULT_TTL);
  });

  it("değişim anı D: D'de ve sonra kabul → yeni süre; D'den önce → 30 gün; kabul anı verilmezse günlükteki son değer", () => {
    const s = withLog([since(43_200, D1)]);
    assert.equal(deliveryTtlSeconds(s, WABA, EKSTRE, at(D1)), 43_200);
    assert.equal(deliveryTtlSeconds(s, WABA, EKSTRE, at(D1 + 3 * DAY)), 43_200);
    assert.equal(deliveryTtlSeconds(s, WABA, EKSTRE, at(D1 - 1)), DEFAULT_TTL, "değişimden önce kabul: 30 gün");
    assert.equal(deliveryTtlSeconds(s, WABA, EKSTRE), 43_200);
    assert.equal(deliveryTtlSeconds(s, WABA, "destekofis_odeme_hatirlatma", at(D1 + HOUR)), DEFAULT_TTL, "süre şablon başına");
  });

  it("zincir (30 gün → 1 gün → 12 sa) ve uzama (12 sa → 30 gün → 6 sa): kabul anındaki ile sonradan görülen en uzun", () => {
    const D2 = D1 + 6 * HOUR;
    const chain = withLog([since(86_400, D1), since(43_200, D2)]);
    assert.equal(deliveryTtlSeconds(chain, WABA, EKSTRE, at(D1 - HOUR)), DEFAULT_TTL);
    assert.equal(deliveryTtlSeconds(chain, WABA, EKSTRE, at(D1 + 2 * HOUR)), 86_400);
    assert.equal(deliveryTtlSeconds(chain, WABA, EKSTRE, at(D2 + 2 * HOUR)), 43_200);
    const longer = withLog([since(43_200, D1), since(DEFAULT_TTL, D2), since(21_600, D2 + HOUR)]);
    assert.equal(deliveryTtlSeconds(longer, WABA, EKSTRE, at(D1 + 2 * HOUR)), DEFAULT_TTL, "süre uzadı: uzun olan; sonraki kısalma geriye işlemez");
    assert.equal(deliveryTtlSeconds(longer, WABA, EKSTRE, at(D2 + 2 * HOUR)), 21_600, "6 sa bilinirken kabul");
  });

  it("bozuk günlük (sırasız an / eksik değer): bilinmiyor → 30 gün", () => {
    const D2 = D1 + 6 * HOUR;
    assert.equal(deliveryTtlSeconds(withLog([since(43_200, D2), since(86_400, D1)]), WABA, EKSTRE, at(D2 + 2 * HOUR)), DEFAULT_TTL);
    assert.equal(deliveryTtlSeconds(withLog([{ seconds: "x", since: at(D1) }]), WABA, EKSTRE, at(D1 + 2 * HOUR)), DEFAULT_TTL);
  });

  it("noteDeliveryTtl: yalnız değer değişince yazar; geç dönen eski okuma yazmaz; başka hesapta günlük o hesapla yeniden başlar; en çok 12 değişim (düşen en eski: 30 gün)", async () => {
    const mod = await import("../server/lib/whatsapp/templates.mjs");
    assert.equal(typeof mod.noteDeliveryTtl, "function", "templates.mjs noteDeliveryTtl dışa açılmalı");
    const s = fakeStore();
    const list = seconds => [{ id: "900000000000011", name: EKSTRE, language: "tr", status: "APPROVED", category: "UTILITY", ...(seconds ? { [TTL_FIELD]: seconds } : {}) }];
    assert.equal(mod.noteDeliveryTtl(s, WABA, list(null), at(D1)), false, "30 gün (varsayılan) ilk okumada günlük açmaz");
    assert.equal(mod.noteDeliveryTtl(s, WABA, list(43_200), at(D1 + HOUR)), true);
    assert.equal(mod.noteDeliveryTtl(s, WABA, list(43_200), at(D1 + 2 * HOUR)), false, "aynı değer yeniden yazılmaz");
    assert.equal(mod.noteDeliveryTtl(s, WABA, list(86_400), at(D1 + 30 * MIN)), false, "son değişimden eski okuma yazılmaz");
    assert.equal(mod.noteDeliveryTtl(s, WABA, list(86_400), at(D1 + 3 * HOUR)), true);
    assert.equal(deliveryTtlSeconds(s, WABA, EKSTRE, at(D1 + 2 * HOUR)), 86_400, "12 sa'le kabul, sonra 1 gün görüldü: uzun olan");
    assert.equal(deliveryTtlSeconds(s, WABA, EKSTRE, at(D1 + 4 * HOUR)), 86_400);
    assert.equal(deliveryTtlSeconds(s, WABA, EKSTRE, at(D1 + 30 * MIN)), DEFAULT_TTL);
    assert.equal(mod.noteDeliveryTtl(s, "999999999999", list(43_200), at(D1 + 4 * HOUR)), true, "başka hesap");
    assert.equal(deliveryTtlSeconds(s, WABA, EKSTRE, at(D1 + 4 * HOUR)), DEFAULT_TTL, "eski hesabın işleri: 30 gün");
    const t = fakeStore();
    for (let i = 0; i < 14; i += 1) mod.noteDeliveryTtl(t, WABA, list(i % 2 ? 43_200 : 86_400), at(D1 + i * HOUR));
    assert.equal(JSON.parse(t.rows.get("whatsapp.ttlSince")).items[EKSTRE].length, 12);
    assert.equal(deliveryTtlSeconds(t, WABA, EKSTRE, at(D1 + 30 * MIN)), DEFAULT_TTL, "düşen en eski değişimin dönemi: 30 gün");
    assert.equal(deliveryTtlSeconds(t, WABA, EKSTRE, at(D1 + 13 * HOUR + 30 * MIN)), 43_200);
  });
});

describe("2.4.9 W-KÖK — bakım turu teslim süresi bilgisini satır başına okumaz (ders 47)", () => {
  it("40 kabul edilmiş iş, bildirim yolu canlı: bir bakım turundaki ayar okumaları iş sayısıyla artmaz", { timeout: 120_000 }, async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      await denetle(ctx);
      ctx.clock.advance(2 * HOUR);
      const ids = [];
      for (let i = 0; i < 40; i += 1) ids.push((await ctx.account(`Toplu ${i + 1}`, `0555 100 ${String(i).padStart(2, "0")} 00`, 10)).id);
      const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      await ctx.drain();
      const jobs = await ctx.jobs(res.data.data.batch.id);
      assert.equal(jobs.filter(job => job.state === "accepted").length, 40, "ön koşul: 40 iş Meta Kabul Etti");
      keepHookAlive(ctx);
      ctx.clock.advance(6 * HOUR); // süre dolmadı: her satır karşılaştırılır, hiçbiri Süresi Doldu olmaz
      const original = ctx.store.setting.bind(ctx.store);
      let reads = 0;
      ctx.store.setting = (key, ...rest) => {
        if (String(key).startsWith("whatsapp.")) reads += 1;
        return original(key, ...rest);
      };
      try {
        await ctx.wa.scheduler.maintain();
      } finally {
        ctx.store.setting = original;
      }
      assert.ok(reads > 0 && reads < 40, `bakım turunda ${reads} WhatsApp ayar okuması (satır başına okuma olmamalı; 40 iş)`);
      assert.equal((await ctx.jobs(res.data.data.batch.id)).filter(job => job.state === "expired").length, 0);
    } finally {
      await ctx.close();
    }
  });
});

// 2.4.9 W-KÖK TUR 2 — bağımsız gözden geçirme GERİLEMESİ (04.11.2026 ~00:55 UTC, docs/2.4.9-IS-LISTESI.md "BAĞIMSIZ GÖZDEN GEÇİRME" DÜŞÜK-2): Meta 12 sa bildirir, iş kabul
// edilir, 1 sa sonra Meta'da süre 30 güne çıkar ama program bu arada Meta'yı OKUMAZ (süren toplu iş / önizleme / Denetle yok) → 13 sa + 1 dk'da Süresi Doldu, PDF silinir,
// aynı dönemde kişiye 2. ileti (v2.4.8'de 1). KARAR (S-A, 03.11 yetkisiyle İLKEYLE — ilke 2 "almış olabilirse elenir"; BAŞ MİMAR KARARI): bakım, 30 günden KISA etkin süreyle
// Süresi Doldu yazacağı iş varsa o WABA / şablon için turda BİR KEZ taze Meta şablon okuması yapar (süre günlüğe), kuralı yeniden değerlendirir; okuma düşerse (ağ, Meta
// hatası, bağlantı yok) o tur Süresi Doldu YAZILMAZ, sonraki turda yeniden denenir. Tur başına WABA + şablon başına en çok bir okuma (ders 47); 30 günlük işlerde okuma yok.
// Beklenen sayılar karar metninden ve testin girdiği veriden (ders 5). Eski kod (be58d92b): (a), (a2), (c), (c2), (c3) beklenen nedenle ("Süresi Doldu yazılmamalı") kırmızı;
// (b) ve (d) eski kodda yalnız okuma sayısında kırmızı (Süresi Doldu kararı eski kodla aynı — eski davranış korunur); (e) eski kodda ön koşulda (bakım Meta'yı okumuyor).
const templateReads = ctx => ctx.fake.requests.filter(item => item.method === "GET" && /^\/\d+\/message_templates$/.test(item.path)).length;
const ttlLogOf = ctx => (JSON.parse(ctx.store.setting("whatsapp.ttlSince", "") || "{}").items?.[EKSTRE] || []).map(entry => entry.seconds);
const TEMPLATE_GET = /^GET \/\d+\/message_templates$/;
/** Bir bakım turu (yalnız bakım; iş yürütülmez). Dönüş: o turdaki şablon okuması sayısı. */
async function maintainTurn(ctx) {
  const before = templateReads(ctx);
  await ctx.wa.scheduler.maintain();
  return templateReads(ctx) - before;
}

describe("2.4.9 W-KÖK TUR 2 — bakım, kısa süreyle Süresi Doldu yazmadan önce şablonu turda bir kez taze okur (ilke 2)", () => {
  it("(a) süre kabulden SONRA 30 güne uzar, program bu arada Meta'yı okumaz: bakımın taze okuması 30 gün görür → 13 sa + 1 dk'da iş Süresi Doldu DEĞİL, PDF silinmez; aynı dönem 'Daha Önce Gönderildi', 2. toplu iş 400, kişiye 1 ileti", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200); // müşteri WhatsApp Yöneticisi'nde 12 sa ayarlamış
      const one = await sendOne(ctx, await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250));
      assert.deepEqual(ttlLogOf(ctx), [43_200], "ön koşul: iş 12 sa bilinirken kabul edildi (başlatmanın taze okuması)");
      ctx.clock.advance(HOUR);
      setListedTtl(ctx.fake, DEFAULT_TTL); // müşteri süreyi 30 güne uzattı; program bu arada Meta'yı okumaz
      ctx.clock.advance(12 * HOUR + MIN); // kabulden 13 sa + 1 dk
      keepHookAlive(ctx); // bildirim yolu canlı (§7a 16)
      const reads = await maintainTurn(ctx);
      assert.equal(await one.state(), "sent", "süre kabulden sonra 30 güne uzadı (uzun olan geçer): Süresi Doldu yazılmamalı");
      assert.equal(ctx.fake.state.deleted.length, 0, "Meta hâlâ teslim etmeye çalışırken PDF silinmemeli");
      assert.equal(reads, 1, "ön koşul (ders 20/38): bakım şablonu bu turda GERÇEKTEN bir kez taze okudu");
      assert.deepEqual(ttlLogOf(ctx), [43_200, DEFAULT_TTL], "bakımın taze okuması 30 günü günlüğe yazdı");
      assert.equal(await maintainTurn(ctx), 0, "sonraki tur: kısa süreli iş kalmadı → okuma yok");
      assert.equal(await one.state(), "sent");
      assert.equal(await preview(ctx, one.body), "Daha Önce Gönderildi", "aynı dönemde kişi elenir (ilke 2/3)");
      const second = await ctx.batch({ ...one.body, requestId: "w-kok-tur2-a" });
      assert.equal(second.status, 400, `ikinci toplu iş başlamamalı (geldi ${second.status} ${JSON.stringify(second.data).slice(0, 200)})`);
      await ctx.drain();
      assert.equal(toPhone(ctx, "5321112233"), 1, "aynı dönemde kişiye tek ekstre");
    } finally {
      await ctx.close();
    }
  });

  it("(a2) süre kabulden SONRA Meta varsayılanına döner (alan kaldırıldı = 30 gün): aynı karar — Süresi Doldu DEĞİL, günlükte 30 gün", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      const one = await sendOne(ctx, await ctx.account("Varsayılan Dönüş", "0532 111 22 44", 100));
      ctx.clock.advance(2 * HOUR);
      setListedTtl(ctx.fake, null);
      ctx.clock.advance(11 * HOUR + MIN);
      keepHookAlive(ctx);
      const reads = await maintainTurn(ctx);
      assert.equal(await one.state(), "sent", "Meta varsayılanı 30 gün: Süresi Doldu yazılmamalı");
      assert.equal(ctx.fake.state.deleted.length, 0);
      assert.equal(reads, 1);
      assert.deepEqual(ttlLogOf(ctx), [43_200, DEFAULT_TTL]);
    } finally {
      await ctx.close();
    }
  });

  it("(b) Meta'da süre GERÇEKTEN 12 sa kalmış: 13 sa − 1 dk'da okuma yok; 13 sa + 1 dk'da bakımın taze okuması 12 sa görür → Süresi Doldu + PDF silinir; aynı dönem 'gönderilecek' (P3); sonraki turda okuma yok", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      const one = await sendOne(ctx, await ctx.account("Gerçek On İki", "0532 111 22 55", 100));
      ctx.clock.advance(13 * HOUR - MIN);
      keepHookAlive(ctx);
      assert.equal(await maintainTurn(ctx), 0, "süre dolmadı: okuma yok");
      assert.equal(await one.state(), "sent");
      ctx.clock.advance(2 * MIN);
      const reads = await maintainTurn(ctx);
      assert.equal(await one.state(), "expired", "Meta'nın bildirdiği 12 saat + 1 saatte Süresi Doldu (eski davranış korunur)");
      assert.equal(ctx.fake.state.deleted.length, 1, "PDF Meta'dan silindi");
      assert.equal(reads, 1, "Süresi Doldu yazılmadan önce bir taze okuma");
      assert.deepEqual(ttlLogOf(ctx), [43_200], "günlük değişmedi (aynı değer)");
      assert.equal(await maintainTurn(ctx), 0, "sonraki tur: okuma yok");
      assert.equal(await preview(ctx, one.body), "gönderilecek", "Süresi Doldu 'Daha Önce Gönderildi' sayılmaz (P3)");
    } finally {
      await ctx.close();
    }
  });

  it("(c) taze okuma DÜŞER (Meta 500, sonra yanıtsız): o turlar Süresi Doldu YAZILMAZ, PDF silinmez, günlük değişmez; sonraki başarılı turda Meta hâlâ 12 sa → Süresi Doldu + PDF silinir", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      const one = await sendOne(ctx, await ctx.account("Okuma Düştü", "0532 111 22 66", 100));
      ctx.clock.advance(13 * HOUR + MIN);
      keepHookAlive(ctx);
      ctx.fake.state.failQueue.push({ match: TEMPLATE_GET, status: 500, raw: "<html>Bad Gateway</html>" });
      const first = await maintainTurn(ctx);
      assert.equal(await one.state(), "sent", "taze okuma düştü (Meta 500): bu tur Süresi Doldu yazılmamalı");
      assert.equal(ctx.fake.state.deleted.length, 0, "PDF silinmemeli");
      assert.equal(first, 1, "ön koşul (ders 20/38): okuma GERÇEKTEN denendi ve düştü (tek okuma)");
      assert.equal(ctx.fake.state.failQueue.length, 0, "ön koşul: 500 yanıtı tüketildi");
      ctx.fake.state.hang = TEMPLATE_GET; // ağ: yanıt gelmez (istemci zaman aşımı)
      ctx.clock.advance(MIN);
      const second = await maintainTurn(ctx);
      ctx.fake.state.hang = null;
      assert.equal(await one.state(), "sent", "taze okuma yanıtsız kaldı: bu tur da Süresi Doldu yazılmamalı");
      assert.equal(second, 1, "sonraki turda yeniden denendi (tek okuma)");
      assert.deepEqual(ttlLogOf(ctx), [43_200], "düşen okumalar günlüğe bir şey yazmaz");
      ctx.clock.advance(MIN);
      const third = await maintainTurn(ctx);
      assert.equal(third, 1);
      assert.equal(await one.state(), "expired", "okuma başarılı, Meta hâlâ 12 sa: Süresi Doldu");
      assert.equal(ctx.fake.state.deleted.length, 1, "PDF silindi");
    } finally {
      await ctx.close();
    }
  });

  it("(c2) okuma YAPILAMIYOR — salt okunur lisans (program Meta'dan şablon okumaz): okuma da yazma da yok; lisans yazılabilir olunca ilk turda okur → Meta 30 gün → Süresi Doldu DEĞİL", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      const one = await sendOne(ctx, await ctx.account("Salt Okunur", "0532 111 22 77", 100));
      ctx.clock.advance(HOUR);
      setListedTtl(ctx.fake, DEFAULT_TTL);
      ctx.clock.advance(12 * HOUR + MIN);
      keepHookAlive(ctx);
      const license = ctx.server.app.license;
      const original = license.writable;
      let writable = false;
      license.writable = () => writable;
      try {
        const reads = await maintainTurn(ctx);
        assert.equal(await one.state(), "sent", "salt okunur: okuma yapılamadı → Süresi Doldu yazılmamalı");
        assert.equal(reads, 0, "salt okunur: Meta'ya şablon okuması yok");
        assert.equal(ctx.fake.state.deleted.length, 0);
        writable = true;
        assert.equal(await maintainTurn(ctx), 1, "lisans yazılabilir: turda bir taze okuma");
        assert.equal(await one.state(), "sent", "Meta 30 gün bildiriyor: Süresi Doldu yazılmamalı");
        assert.deepEqual(ttlLogOf(ctx), [43_200, DEFAULT_TTL]);
      } finally {
        license.writable = original;
      }
    } finally {
      await ctx.close();
    }
  });

  it("(c3) okuma YAPILAMIYOR — bağlantı kaldırıldı: 13 sa + 1 dk'da okuma yok, Süresi Doldu yazılmaz; Meta'nın en uzun süresi (30 gün) + 1 sa geçince okumasız Süresi Doldu", async () => {
    const ctx = await startWa();
    try {
      setListedTtl(ctx.fake, 43_200);
      const one = await sendOne(ctx, await ctx.account("Bağlantısız", "0532 111 22 88", 100));
      assert.equal((await ctx.api.del(URLS.conn)).status, 200, "Bağlantıyı Kaldır");
      ctx.clock.advance(13 * HOUR + MIN);
      keepHookAlive(ctx);
      const reads = await maintainTurn(ctx);
      assert.equal(await one.state(), "sent", "bağlantı yok, okuma yapılamadı: Süresi Doldu yazılmamalı");
      assert.equal(reads, 0, "bağlantı yok: okuma yok");
      ctx.clock.advance(30 * DAY - 12 * HOUR - 2 * MIN); // kabulden 30 gün + 59 dk
      keepHookAlive(ctx);
      await maintainTurn(ctx);
      assert.equal(await one.state(), "sent", "30 gün + 1 sa dolmadı");
      ctx.clock.advance(2 * MIN); // kabulden 30 gün + 1 sa + 1 dk
      assert.equal(await maintainTurn(ctx), 0, "Meta'nın en uzun süresi geçti: okuma gerekmez");
      assert.equal(await one.state(), "expired", "30 gün + 1 sa: Meta artık teslim etmeye çalışmaz → Süresi Doldu");
    } finally {
      await ctx.close();
    }
  });

  // Tur 2'nin bakıma eklediği BEKLEME (taze okuma) sırasında satırın durumu değişebilir: karar okumadan SONRA yeniden okunan satırlarla verilir. Eski kodda bakım Meta'yı
  // okumadığı için ön koşul kurulamaz (kapıda bekleyen okuma yok); dişi mutasyonla (okumadan önceki satırla karar) gösterilir.
  it("(e) taze okuma SÜRERKEN kişi iletiyi okur ('read' bildirimi): bakım kararı okumadan sonraki satırla verir — iş 'Okundu' kalır, Süresi Doldu / Teslim Edildi'ye düşmez", async () => {
    const ctx = await startWa();
    let release = () => {};
    try {
      setListedTtl(ctx.fake, 43_200);
      const one = await sendOne(ctx, await ctx.account("Okurken Okudu", "0532 111 22 99", 100));
      ctx.clock.advance(13 * HOUR + MIN);
      keepHookAlive(ctx);
      ctx.fake.state.hold = { match: TEMPLATE_GET, promise: new Promise(resolve => (release = resolve)) };
      const turn = ctx.wa.scheduler.maintain();
      for (let i = 0; i < 500 && !ctx.fake.state.held; i += 1) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(ctx.fake.state.held, 1, "ön koşul (ders 20): bakımın taze okuması Meta'da (kapıda) bekliyor");
      ctx.statuses([{ id: one.wamid, status: "read", timestamp: ts(ctx) }]);
      assert.equal(await one.state(), "read", "ön koşul: 'read' bildirimi okuma sürerken işlendi");
      release();
      await turn;
      assert.equal(await one.state(), "read", "okuma beklenirken gelen 'Okundu' bakımın okumadan önceki satırıyla ezilmemeli");
    } finally {
      release();
      ctx.fake.state.hold = null;
      await ctx.close();
    }
  });

  it("(d) okuma sayısı (ders 47): aynı şablonda 5 iş (12 sa) → turda TAM 1 okuma, 5'i Süresi Doldu; ayrı kurulumda 30 günlük 5 iş → 13 sa + 1 dk'da, 30 gün − 1 dk'da ve 30 gün + 1 sa + 1 dk'da 0 okuma", { timeout: 120_000 }, async () => {
    const make = async (ctx, prefix) => {
      const ids = [];
      for (let i = 0; i < 5; i += 1) ids.push((await ctx.account(`${prefix} ${i + 1}`, `0555 200 ${String(i).padStart(2, "0")} 00`, 10)).id);
      const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      await ctx.drain({ maintain: false });
      const jobs = await ctx.jobs(res.data.data.batch.id);
      assert.equal(jobs.filter(job => job.state === "accepted").length, 5, "ön koşul: 5 iş Meta Kabul Etti");
      return res.data.data.batch.id;
    };
    const shortCtx = await startWa();
    try {
      setListedTtl(shortCtx.fake, 43_200);
      const batchId = await make(shortCtx, "Kısa Süre");
      shortCtx.clock.advance(13 * HOUR + MIN);
      keepHookAlive(shortCtx);
      const reads = await maintainTurn(shortCtx);
      assert.equal((await shortCtx.jobs(batchId)).filter(job => job.state === "expired").length, 5, "Meta 12 sa: 5'i Süresi Doldu");
      assert.equal(reads, 1, `aynı WABA + şablon: turda tek okuma (iş başına değil; ${reads} okuma)`);
      assert.equal(await maintainTurn(shortCtx), 0, "sonraki tur: okuma yok");
    } finally {
      await shortCtx.close();
    }
    const longCtx = await startWa();
    try {
      const batchId = await make(longCtx, "Uzun Süre"); // Meta süre bildirmiyor: 30 gün
      longCtx.clock.advance(13 * HOUR + MIN);
      keepHookAlive(longCtx);
      assert.equal(await maintainTurn(longCtx), 0, "30 günlük iş: okuma yok");
      longCtx.clock.advance(30 * DAY - 13 * HOUR - 2 * MIN);
      keepHookAlive(longCtx);
      assert.equal(await maintainTurn(longCtx), 0, "30 gün − 1 dk: okuma yok");
      assert.equal((await longCtx.jobs(batchId)).filter(job => job.state === "expired").length, 0);
      longCtx.clock.advance(HOUR + 2 * MIN);
      keepHookAlive(longCtx);
      assert.equal(await maintainTurn(longCtx), 0, "30 gün + 1 sa + 1 dk: okumasız Süresi Doldu");
      assert.equal((await longCtx.jobs(batchId)).filter(job => job.state === "expired").length, 5);
    } finally {
      await longCtx.close();
    }
  });
});
