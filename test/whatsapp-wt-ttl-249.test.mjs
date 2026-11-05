// 2.4.9 W-T + W-6 — KULLANICI KARARI (03.11.2026 ~18:45 UTC, SORU T0; docs/2.4.9-tasarim/W-whatsapp-sablon.md §15, docs/2.4.9-IS-LISTESI.md KARAR): Meta'nın
// utility şablonda izin verdiği en uzun özel teslim süresi 12 saat çıkınca kullanıcı "30 gün (Meta varsayılanı)" seçti. Beklenen (karar metninden, programın kodundan
// değil — ders 5):
//   (1) program şablon AÇARKEN teslim süresi (message_send_ttl_seconds) GÖNDERMEZ; onaylı şablonun teslim süresini DÜZENLEMEZ (Elle Bağla sonrası kendiliğinden denetim de);
//   (2) gönderim ayarındaki ttlHours (72 saat) KALKAR: PUT …/sending-settings { ttlHours } → 400 "Teslim süresi Meta'nın varsayılanıdır (30 gün); değiştirilemez.";
//       kayıtlı eski değer okunmaz;
//   (3) "Süresi Doldu" ve PDF silme: Meta listesinin bildirdiği değer varsa o, yoksa 30 gün (+1 sa);
//   (4) kayıtlı eski TTL ret / düzenleme kayıtları (2.4.8) okunmaz, zarar vermez; var olan TTL ret kaydı kartta gösterilmez.
// Düzenek: gerçek program + yerel sahte Graph (test/whatsapp-sahte-graph.mjs; aynı el — kâhin DEĞİL, ders 5; gerçek Meta'ya istek YOK — ders 30) + sahte saat (ders 13).
// "Süresi Doldu" yalnız bildirim yolu çalışırken yazılır (son 7 günde bir durum bildirimi, plan §7a 16): testler bir "sent" bildirimi verir.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const APP = "1505264761663625";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ENSURE = "/api/workspace/whatsapp/templates/ensure";
const TEMPLATES = "/api/workspace/whatsapp/templates";
const TTL_FIELD = "message_send_ttl_seconds";
const NO_CHANGE = "Teslim süresi Meta'nın varsayılanıdır (30 gün); değiştirilemez.";
const creates = fake => fake.requests.filter(item => item.method === "POST" && /\/message_templates$/.test(item.path));
// Şablon düzenlemesi: POST /<TEMPLATE_ID> (sahte Graph'ta şablon kimlikleri 9… ile başlar).
const edits = fake => fake.requests.filter(item => item.method === "POST" && /^\/9\d+$/.test(item.path));
const program = fake => fake.state.templates.filter(item => item.name.startsWith("destekofis_"));

// Programın şablonları Meta'da YOK; program açar (sahte Meta gerçek Meta gibi 12 saatten uzun TTL'i reddeder — D0 / BULGU 6).
async function fresh({ ttlRange = [30, 43_200] } = {}) {
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP });
  fake.state.ttlRange = ttlRange;
  const ctx = await startWa({ fake, connect: false });
  try {
    assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, appId: APP, token: TOKEN })).status, 200);
  } catch (error) {
    await ctx.close();
    await fake.close();
    throw error;
  }
  return { ctx, fake, close: async () => { await ctx.close(); await fake.close(); } };
}

// Bir ekstre gönderilir, Meta kabul eder, bildirim yolu çalışır ("sent" bildirimi). Dönüş: işin durumu okuyucusu.
async function sendOne(ctx, name = "Ayşe Yılmaz", phone = "0532 111 22 33") {
  const a = await ctx.account(name, phone, 1250);
  const res = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const id = res.data.data.batch.id;
  await ctx.drain();
  const job = (await ctx.jobs(id))[0];
  assert.equal(job.state, "accepted", "ön koşul: Meta kabul etti");
  ctx.statuses([{ id: job.wamid, status: "sent", timestamp: String(Math.floor(ctx.clock.ms() / 1000)) }]);
  return { id, state: async () => (await ctx.jobs(id))[0].state };
}
// Bildirim yolu canlı kalsın (son 7 günde bildirim — §7a 16): bilinmeyen bir iletinin bildirimi.
const keepHookAlive = (ctx, n) => ctx.statuses([{ id: `wamid.CANLI${String(n).padStart(4, "0")}`, status: "sent", timestamp: String(Math.floor(ctx.clock.ms() / 1000)) }]);

describe("2.4.9 W-T — program şablon teslim süresi (TTL) GÖNDERMEZ, DÜZENLEMEZ; ttlHours kalktı", () => {
  it("şablon AÇILIRKEN istekte teslim süresi alanı YOK (iki şablon, tek istekte açılır); onaydan sonra Denetle hiçbir şablonu açmaz / düzenlemez", async () => {
    const { ctx, fake, close } = await fresh();
    try {
      const res = await ctx.api.post(ENSURE, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const sent = creates(fake);
      assert.equal(sent.length, 2, `iki şablon, her biri TEK açma isteğiyle (geldi ${sent.length})`);
      for (const request of sent) assert.ok(!Object.hasOwn(request.body || {}, TTL_FIELD), `${request.body?.name}: açma isteğinde teslim süresi alanı olmamalı (geldi ${request.body?.[TTL_FIELD]})`);
      assert.equal(program(fake).length, 2, "Meta'da iki şablon açıldı");
      for (const tpl of program(fake)) assert.equal(tpl[TTL_FIELD], undefined, `${tpl.name}: Meta'daki şablonda teslim süresi yok (Meta varsayılanı 30 gün)`);
      assert.ok(res.data.data.actions.every(action => action.ok), `kartta kırmızı işlem yok (${JSON.stringify(res.data.data.actions.map(a => a.message))})`);
      for (const tpl of program(fake)) tpl.status = "APPROVED"; // Meta onayladı
      fake.requests.length = 0;
      const again = await ctx.api.post(ENSURE, {});
      assert.equal(again.status, 200);
      assert.equal(creates(fake).length + edits(fake).length, 0, `onaydan sonra Denetle şablona dokunmaz (açma ${creates(fake).length}, düzenleme ${edits(fake).length})`);
      assert.ok(again.data.data.items.every(item => item.usable), "iki şablon gönderime hazır");
    } finally {
      await close();
    }
  });

  it("şablonlar Meta'da ZATEN ONAYLI, bu şirkette kayıt yok (başka şirket / bilgisayar / yeniden bağlama): Denetle (kendiliğinden ve düğmeyle) teslim süresi DÜZENLEMEZ, kartta kırmızı ileti yok", async () => {
    const ctx = await startWa();
    try {
      ctx.fake.state.ttlRange = [30, 43_200]; // gerçek Meta gibi
      ctx.fake.requests.length = 0;
      // Elle Bağla kaydından sonra istemcinin kendiliğinden çağrısı ve kullanıcının düğmesi aynı uçtur (hof-whatsapp-ayar.js → HOF.whatsappTemplates.ensure).
      for (const round of [1, 2]) {
        const res = await ctx.api.post(ENSURE, {});
        assert.equal(res.status, 200, JSON.stringify(res.data));
        const red = res.data.data.actions.filter(action => !action.ok).map(action => action.message);
        assert.deepEqual(red, [], `denetim ${round}: kartta kırmızı işlem iletisi olmamalı`);
        assert.ok(res.data.data.items.every(item => item.usable && !item.warnings.some(text => /teslim süresi/i.test(text))), `denetim ${round}: iki şablon hazır, teslim süresi uyarısı yok`);
      }
      assert.equal(edits(ctx.fake).length, 0, `onaylı şablona teslim süresi düzenlemesi gitmemeli (geldi ${edits(ctx.fake).length}: ${JSON.stringify(edits(ctx.fake).map(item => item.body))})`);
      assert.equal(creates(ctx.fake).length, 0);
      for (const tpl of program(ctx.fake)) assert.equal(tpl[TTL_FIELD], undefined, `${tpl.name}: Meta'daki teslim süresi değişmedi`);
    } finally {
      await ctx.close();
    }
  });

  it(`PUT …/sending-settings { ttlHours } → 400 (alan ttlHours, "${NO_CHANGE}"); GET'te ttlHours yok; günlük sınır ayarı çalışır`, async () => {
    const ctx = await startWa();
    try {
      const bad = await ctx.api.put(URLS.sending, { ttlHours: 48 });
      assert.equal(bad.status, 400, `teslim süresi değiştirilemez (geldi ${bad.status} ${JSON.stringify(bad.data)})`);
      assert.equal(bad.data.error, NO_CHANGE);
      assert.equal(bad.data.field, "ttlHours");
      // Birlikte gelen geçerli alan da yazılmaz (reddedilen istek başarı sayılmaz — ders 3).
      const mixed = await ctx.api.put(URLS.sending, { dailyCap: 7, ttlHours: 12 });
      assert.equal(mixed.status, 400);
      const view = (await ctx.api.get(URLS.sending)).data.data;
      assert.ok(!Object.hasOwn(view, "ttlHours"), `GET'te ttlHours olmamalı (${JSON.stringify(view)})`);
      assert.equal(view.dailyCap, null, "reddedilen istekteki günlük sınır yazılmadı");
      const cap = await ctx.api.put(URLS.sending, { dailyCap: 5 });
      assert.equal(cap.status, 200, JSON.stringify(cap.data));
      assert.deepEqual(cap.data.data, { dailyCap: 5 });
      assert.deepEqual((await ctx.api.get(URLS.sending)).data.data, { dailyCap: 5 });
    } finally {
      await ctx.close();
    }
  });

  it("2.4.8'den kalan kayıtlı ttlHours (12) okunmaz: GET'te yok, şablon açma isteğinde teslim süresi yok; günlük sınır kaydı eski alanı siler", async () => {
    const { ctx, fake, close } = await fresh({ ttlRange: null });
    try {
      ctx.store.setSetting("whatsapp.sending", JSON.stringify({ ttlHours: 12, dailyCap: null }));
      assert.ok(!Object.hasOwn((await ctx.api.get(URLS.sending)).data.data, "ttlHours"), "eski kayıtlı ttlHours okunmamalı");
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      for (const request of creates(fake)) assert.ok(!Object.hasOwn(request.body || {}, TTL_FIELD), `${request.body?.name}: eski ayardaki 12 saat Meta'ya gitmemeli (geldi ${request.body?.[TTL_FIELD]})`);
      assert.equal((await ctx.api.put(URLS.sending, { dailyCap: 3 })).status, 200);
      assert.deepEqual(JSON.parse(ctx.store.setting("whatsapp.sending", "{}")), { dailyCap: 3 }, "kayıtta eski ttlHours kalmadı");
    } finally {
      await close();
    }
  });
});

describe("2.4.9 W-T — Süresi Doldu ve PDF silme: Meta'nın bildirdiği değer, yoksa 30 gün + 1 saat", () => {
  it("program şablonları açtı, Meta listesi teslim süresi bildirmiyor: 73. saatte de 13. saatte de Süresi Doldu YOK; 30 gün + 1 sa − 1 dk Gönderildi, + 1 dk Süresi Doldu + PDF silindi", async () => {
    // Sahte Meta aralık sınırı koymaz (ttlRange yok): eski kodun gönderdiği 72 saat kabul edilip listede bildirilirdi.
    const { ctx, fake, close } = await fresh({ ttlRange: null });
    try {
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      for (const tpl of program(fake)) tpl.status = "APPROVED";
      const job = await sendOne(ctx);
      ctx.clock.advance(13 * HOUR + MIN);
      await ctx.drain();
      assert.equal(await job.state(), "sent", "13. saatte Süresi Doldu olmamalı");
      ctx.clock.advance(60 * HOUR); // kabulden 73 sa + 1 dk
      await ctx.drain();
      assert.equal(await job.state(), "sent", "73. saatte Süresi Doldu olmamalı (Meta 30 gün teslim etmeye çalışır)");
      assert.equal(fake.state.deleted.length, 0, "Meta hâlâ teslim etmeye çalışırken PDF silinmemeli");
      ctx.clock.advance(30 * DAY - 2 * HOUR - 73 * HOUR - MIN); // kabulden 30 gün − 2 sa
      keepHookAlive(ctx, 1);
      ctx.clock.advance(3 * HOUR - MIN); // kabulden 30 gün + 1 sa − 1 dk
      await ctx.drain();
      assert.equal(await job.state(), "sent", "30 gün + 1 saat dolmadan Süresi Doldu yok");
      assert.equal(fake.state.deleted.length, 0);
      ctx.clock.advance(2 * MIN); // kabulden 30 gün + 1 sa + 1 dk
      await ctx.drain();
      assert.equal(await job.state(), "expired", "Meta'nın varsayılanı 30 gün + 1 saatte Süresi Doldu");
      assert.equal(fake.state.deleted.length, 1, "Süresi Doldu'da PDF Meta'dan silinir");
    } finally {
      await close();
    }
  });

  it("Meta listesi teslim süresini BİLDİRİYORSA (WhatsApp Yöneticisi'nde 12 saat) o geçerli: program değeri değiştirmez; 13 sa − 1 dk Gönderildi, 13 sa + 1 dk Süresi Doldu + PDF silindi", async () => {
    const ctx = await startWa();
    try {
      for (const tpl of program(ctx.fake)) tpl[TTL_FIELD] = 43_200; // Meta'nın listede bildirdiği değer
      ctx.fake.requests.length = 0;
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      assert.equal(edits(ctx.fake).length, 0, `program Meta'daki teslim süresini düzenlememeli (geldi ${JSON.stringify(edits(ctx.fake).map(item => item.body))})`);
      for (const tpl of program(ctx.fake)) assert.equal(tpl[TTL_FIELD], 43_200);
      const job = await sendOne(ctx);
      ctx.clock.advance(13 * HOUR - MIN);
      await ctx.drain();
      assert.equal(await job.state(), "sent", "12 saat + 1 saat dolmadı");
      assert.equal(ctx.fake.state.deleted.length, 0);
      ctx.clock.advance(2 * MIN);
      await ctx.drain();
      assert.equal(await job.state(), "expired", "Meta'nın bildirdiği 12 saat + 1 saatte Süresi Doldu");
      assert.equal(ctx.fake.state.deleted.length, 1, "PDF Meta'dan silindi");
    } finally {
      await ctx.close();
    }
  });
});

// 2.4.8'in yazdığı şablon kaydı (biçim v1; TTL kaydı şablon kimliğiyle): ekstre için Meta'nın açma yanıtında yansıttığı 72 saat, ödeme hatırlatma için ret;
// son denetimin işlemlerinde TTL düzenleme reddi (kırmızı) ve TTL notlu açma iletisi.
const OLD_TTL_REJECTED = "Meta teslim süresini kabul etmedi; Meta 30 güne kadar teslim etmeyi dener.";
function seedOld248Record(ctx) {
  const meta = (id, name, extra = {}) => ({ id, name, language: "tr", status: "APPROVED", category: "UTILITY", ...extra });
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
        { name: "destekofis_ekstre", meta: meta("900000000000011", "destekofis_ekstre") },
        { name: "destekofis_odeme_hatirlatma", meta: meta("900000000000012", "destekofis_odeme_hatirlatma") },
      ],
      actions: [
        { name: "destekofis_ekstre", label: "Ekstre", ok: false, ttl: true, code: 100, message: "Ekstre şablonunun teslim süresi Meta'da ayarlanamadı: Meta isteği tanımadı: Telefon Numarası Kimliği (Phone Number ID) ya da WhatsApp Business Hesap Kimliği (WABA ID) yanlış olabilir. (Meta hata kodu 100: Invalid parameter: message_send_ttl_seconds)" },
        { name: "destekofis_odeme_hatirlatma", label: "Ödeme Hatırlatma", ok: true, created: true, message: `Ödeme Hatırlatma şablonu Meta'ya gönderildi; Meta onayı bekleniyor. ${OLD_TTL_REJECTED}` },
      ],
      complete: true,
      error: null,
      ttl: {
        900000000000011: { seconds: 259_200, at: new Date(ctx.clock.ms() - 2 * DAY).toISOString(), ok: true, echoed: 259_200 },
        900000000000012: { seconds: 259_200, at: new Date(ctx.clock.ms() - 2 * DAY).toISOString(), ok: false, rejected: true },
      },
    }),
  );
}

describe("2.4.9 W-6 — 2.4.8'den kalan TTL kayıtları okunmaz, kartta gösterilmez", () => {
  it("kartta (GET …/templates) eski TTL reddi uyarısı ve TTL düzenleme işlemi YOK; TTL notu açma iletisinden düşer; başka uyarı / işlem korunur", async () => {
    const ctx = await startWa();
    try {
      seedOld248Record(ctx);
      const view = (await ctx.api.get(TEMPLATES)).data.data;
      for (const item of view.items) assert.ok(!item.warnings.some(text => /teslim süresi/i.test(text)), `${item.name}: eski TTL ret kaydı kartta gösterilmemeli (${JSON.stringify(item.warnings)})`);
      assert.ok(!view.actions.some(action => action.ttl || /teslim süresi/i.test(action.message)), `kartta eski TTL işlemi / notu olmamalı (${JSON.stringify(view.actions.map(a => a.message))})`);
      const created = view.actions.find(action => action.created);
      assert.equal(created?.message, "Ödeme Hatırlatma şablonu Meta'ya gönderildi; Meta onayı bekleniyor.", "açma iletisi TTL notsuz korunur");
      assert.ok(view.items.every(item => item.usable), "kayıttaki iki onaylı şablon gönderime hazır görünür");
      // Gönderim penceresi aynı kayıttan okur (Otomatik Gönder varsayılan).
      const status = (await ctx.api.get("/api/workspace/whatsapp/sending-status")).data.data;
      assert.equal(status.templates.statement?.usable, true);
    } finally {
      await ctx.close();
    }
  });

  it("eski kayıttaki 'Meta 72 saati yansıttı' bilgisi okunmaz (liste bildirmiyor): 73. saatte Süresi Doldu YOK; 30 gün + 1 sa + 1 dk Süresi Doldu", async () => {
    const ctx = await startWa();
    try {
      seedOld248Record(ctx);
      const job = await sendOne(ctx);
      ctx.clock.advance(73 * HOUR + MIN);
      await ctx.drain();
      assert.equal(await job.state(), "sent", "eski kayıttaki 72 saat okunmamalı: 73. saatte Süresi Doldu yok");
      assert.equal(ctx.fake.state.deleted.length, 0, "PDF silinmedi");
      ctx.clock.advance(30 * DAY - 73 * HOUR - 3 * HOUR);
      keepHookAlive(ctx, 2);
      ctx.clock.advance(4 * HOUR);
      await ctx.drain();
      assert.equal(await job.state(), "expired", "30 gün + 1 saatte Süresi Doldu");
      assert.equal(ctx.fake.state.deleted.length, 1);
    } finally {
      await ctx.close();
    }
  });
});
