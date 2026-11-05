// 2.4.8 T2 bulgu 5 (ORTA; bağımsız gözden geçirme r4): S2 A ("utility şablonda teslim süresi 3 gün") için program şablonu açarken ve onaylı şablonda teslim süresini
// (message_send_ttl_seconds) gönderiyordu. 2.4.9 W-T — BEKLENTİ BİLEREK GÜNCELLENDİ (KULLANICI KARARI 03.11.2026 ~18:45 UTC, SORU T0; docs/2.4.9-tasarim/
// W-whatsapp-sablon.md §15): gerçek Meta 259.200 sn'yi hem açmada hem onaylı şablonun düzenlemesinde reddetti (utility'de izinli özel süre en çok 12 saat) →
// kullanıcı "30 gün (Meta varsayılanı)" seçti: program şablon açarken teslim süresi GÖNDERMEZ, onaylı şablonun teslim süresini DÜZENLEMEZ; gönderim ayarındaki
// ttlHours kalktı (PUT → 400). Ayrıntılı yeni testler: test/whatsapp-wt-ttl-249.test.mjs.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; alanı kaydeder, test okur).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const APP = "1505264761663625";
const TTL_FIELD = "message_send_ttl_seconds";
const ENSURE = "/api/workspace/whatsapp/templates/ensure";
const creates = fake => fake.requests.filter(item => item.method === "POST" && /\/message_templates$/.test(item.path));
const edits = fake => fake.requests.filter(item => item.method === "POST" && /^\/9\d+$/.test(item.path));
const program = fake => ["destekofis_ekstre", "destekofis_odeme_hatirlatma"].map(name => fake.state.templates.find(item => item.name === name));

async function fresh() {
  // Şablonları program açsın: sahte hesapta programın şablonları YOK.
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP });
  const ctx = await startWa({ fake, connect: false });
  assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, appId: APP, token: TOKEN })).status, 200);
  return { ctx, fake, close: async () => { await ctx.close(); await fake.close(); } };
}

describe("2.4.8 T2-5 → 2.4.9 W-T — şablonun teslim süresi (TTL) Meta'ya GİTMEZ (Meta varsayılanı 30 gün)", () => {
  it("program şablonları AÇARKEN teslim süresi göndermez; Meta'daki şablonda TTL yok; ikinci denetim açmaz / düzenlemez", async () => {
    const { ctx, fake, close } = await fresh();
    try {
      const res = await ctx.api.post(ENSURE, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const sent = creates(fake);
      assert.equal(sent.length, 2, "iki şablon açıldı");
      for (const request of sent) assert.ok(!Object.hasOwn(request.body, TTL_FIELD), `${request.body.name}: açma isteğinde teslim süresi yok (geldi ${request.body[TTL_FIELD]})`);
      for (const tpl of program(fake)) assert.equal(tpl[TTL_FIELD], undefined);
      fake.requests.length = 0;
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      assert.equal(edits(fake).length + creates(fake).length, 0, "ikinci denetimde şablon açılmadı / düzenlenmedi");
    } finally {
      await close();
    }
  });

  it("teslim süresi ayarı (ttlHours: 48) REDDEDİLİR (400); onaylı şablonlar denetimde düzenlenmez", async () => {
    const { ctx, fake, close } = await fresh();
    try {
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      for (const tpl of program(fake)) tpl.status = "APPROVED";
      const res = await ctx.api.put(URLS.sending, { ttlHours: 48 });
      assert.equal(res.status, 400, JSON.stringify(res.data));
      assert.equal(res.data.field, "ttlHours");
      fake.requests.length = 0;
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      assert.equal(edits(fake).length, 0, "onaylı şablonun teslim süresi düzenlenmez");
      for (const tpl of program(fake)) assert.equal(tpl[TTL_FIELD], undefined);
    } finally {
      await close();
    }
  });

  it("şablon Meta'da önceden (teslim süresiz) açılmışsa ilk denetimde DÜZENLENMEZ (Meta varsayılanı kalır)", async () => {
    const ctx = await startWa();
    try {
      const res = await ctx.api.post(ENSURE, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal(creates(ctx.fake).length, 0);
      assert.equal(edits(ctx.fake).length, 0, `düzenleme gitmemeli (geldi ${JSON.stringify(edits(ctx.fake).map(item => item.body))})`);
      for (const tpl of program(ctx.fake)) assert.equal(tpl[TTL_FIELD], undefined);
    } finally {
      await ctx.close();
    }
  });

  it("Meta 12 saatten uzun teslim süresini reddeden hesapta (gerçek Meta gibi) şablon TEK istekte açılır; kartta teslim süresi uyarısı yok; denetim yinelenince istek yok", async () => {
    const { ctx, fake, close } = await fresh();
    try {
      fake.state.ttlRange = [30, 43_200];
      const res = await ctx.api.post(ENSURE, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal(creates(fake).length, 2, "her şablon tek açma isteği");
      for (const tpl of program(fake)) assert.ok(tpl && tpl[TTL_FIELD] === undefined, "şablon teslim süresiz açıldı");
      const items = res.data.data.items;
      assert.ok(items.every(item => !item.warnings.some(text => /teslim süresi/i.test(text))), JSON.stringify(items.map(item => item.warnings)));
      for (const tpl of program(fake)) tpl.status = "APPROVED";
      fake.requests.length = 0;
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      assert.equal(edits(fake).length + creates(fake).length, 0, "yeniden istek gönderilmedi");
    } finally {
      await close();
    }
  });
});
