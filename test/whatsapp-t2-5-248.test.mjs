// 2.4.8 T2 bulgu 5 (ORTA; bağımsız gözden geçirme r4): S2 A ("utility şablonda teslim süresi 3 gün"; plan §11 S2, §2.2) Meta'ya hiç gitmiyordu — program
// şablonları kendisi açıyor (W5) ama açma isteğinde message_send_ttl_seconds yoktu → Meta varsayılanı (30 gün) geçerli kalırken program 73 saatte "Süresi Doldu"
// deyip PDF'i Meta'dan siliyordu. Beklenen: şablon AÇILIRKEN ve zaten açık şablonun süresi programın ayarından farklıysa GÜNCELLENİRKEN teslim süresi gönderilir
// (değer = programdaki teslim süresi ayarı; varsayılan S2 A 3 gün = 259.200 sn — plandan); aynı değer bir daha gönderilmez; Meta alanı reddederse şablon yine açılır
// (gönderim kapanmaz) ve kartta uyarı çıkar (D0-W5-8: izinli aralık belgede okunmadı).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; alanı kaydeder, test okur).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const APP = "1505264761663625";
const THREE_DAYS = 3 * 24 * 3600; // plan §11 S2 A
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

describe("2.4.8 T2-5 — şablonun teslim süresi (TTL) Meta'ya gider", () => {
  it("program şablonları AÇARKEN teslim süresini (3 gün = 259.200 sn) gönderir; sahte Meta kaydeder; ikinci denetim yeniden göndermez", async () => {
    const { ctx, fake, close } = await fresh();
    try {
      const res = await ctx.api.post(ENSURE, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const sent = creates(fake);
      assert.equal(sent.length, 2, "iki şablon açıldı");
      for (const request of sent) assert.equal(request.body.message_send_ttl_seconds, THREE_DAYS, `${request.body.name}: açma isteğinde teslim süresi (geldi ${request.body.message_send_ttl_seconds})`);
      for (const tpl of program(fake)) assert.equal(tpl.message_send_ttl_seconds, THREE_DAYS);
      fake.requests.length = 0;
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      assert.equal(edits(fake).length + creates(fake).length, 0, "ikinci denetimde şablon açılmadı / düzenlenmedi");
    } finally {
      await close();
    }
  });

  it("teslim süresi ayarı değişince (48 saat) mevcut şablonlar GÜNCELLENİRKEN yeni değer gönderilir (yalnız TTL alanı); aynı değer bir daha gitmez", async () => {
    const { ctx, fake, close } = await fresh();
    try {
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      for (const tpl of program(fake)) tpl.status = "APPROVED";
      assert.equal((await ctx.api.put(URLS.sending, { ttlHours: 48 })).status, 200);
      fake.requests.length = 0;
      const res = await ctx.api.post(ENSURE, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const sent = edits(fake);
      assert.equal(sent.length, 2, "iki şablonun teslim süresi güncellendi");
      for (const request of sent) assert.deepEqual(request.body, { message_send_ttl_seconds: 48 * 3600 }, "düzenleme yalnız teslim süresini taşır (içerik / kategori değişmez)");
      for (const tpl of program(fake)) assert.equal(tpl.message_send_ttl_seconds, 48 * 3600);
      fake.requests.length = 0;
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      assert.equal(edits(fake).length, 0, "aynı değer bir daha gönderilmez");
    } finally {
      await close();
    }
  });

  it("şablon Meta'da önceden (teslim süresiz) açılmışsa ilk denetimde teslim süresi güncellenir", async () => {
    const ctx = await startWa();
    try {
      const res = await ctx.api.post(ENSURE, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal(creates(ctx.fake).length, 0);
      assert.deepEqual(edits(ctx.fake).map(item => item.body.message_send_ttl_seconds), [THREE_DAYS, THREE_DAYS]);
      for (const tpl of program(ctx.fake)) assert.equal(tpl.message_send_ttl_seconds, THREE_DAYS);
    } finally {
      await ctx.close();
    }
  });

  it("Meta teslim süresini reddederse (D0) şablon YİNE açılır (Meta varsayılanı), kartta uyarı çıkar; reddedilen değer her denetimde yinelenmez", async () => {
    const { ctx, fake, close } = await fresh();
    try {
      fake.state.ttlRange = [30, 43_200];
      const res = await ctx.api.post(ENSURE, {});
      assert.equal(res.status, 200, JSON.stringify(res.data));
      for (const tpl of program(fake)) assert.ok(tpl && tpl.message_send_ttl_seconds === undefined, "şablon teslim süresiz açıldı");
      const items = res.data.data.items;
      assert.ok(items.every(item => item.warnings.includes("Meta teslim süresini kabul etmedi; Meta 30 güne kadar teslim etmeyi dener.")), JSON.stringify(items.map(item => item.warnings)));
      for (const tpl of program(fake)) tpl.status = "APPROVED";
      fake.requests.length = 0;
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
      assert.equal(edits(fake).length + creates(fake).length, 0, "reddedilen değer yeniden gönderilmedi");
    } finally {
      await close();
    }
  });
});
