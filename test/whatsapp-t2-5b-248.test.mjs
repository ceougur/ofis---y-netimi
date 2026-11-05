// 2.4.8 T2-5 GÜVENLİ TARAF (ana oturum, 31.10.2026): program "Süresi Doldu" anını ve PDF'in Meta'dan silinmesini ayardaki değere değil META'NIN teslim süresine bağlar;
// okunamazsa Meta'nın varsayılanı 30 gün; Meta'nın hâlâ teslim etmeye çalıştığı iletinin PDF'i hiçbir durumda önceden silinmez.
// 2.4.9 W-T — BEKLENTİ BİLEREK GÜNCELLENDİ (KULLANICI KARARI 03.11.2026 ~18:45 UTC; docs/2.4.9-tasarim/W-whatsapp-sablon.md §15, §10): program şablona teslim süresi
// YAZMAZ (ttlHours ayarı kalktı) → "Meta 259.200'ü reddeder" ve "ttlHours: 12 ile 43.200 kabul" senaryoları geçersiz. Kural: Meta listesinin BİLDİRDİĞİ değer varsa
// o (WhatsApp Yöneticisi'nde ayarlanmış ya da 2.4.8'de 72 saatle açılmış eski şablon — §15 "liste değeri geçerli"), yoksa 30 gün (+1 sa). Kartta teslim süresi
// uyarısı yok.
// Düzenek: gerçek program (şablonları kendisi açar) + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; listedTtl'i test şablona yazar, sahte Meta listede gösterir)
// + sahte saat (ders 13). Bildirim yolu çalışıyor (bir "sent" bildirimi), çünkü süre dolumu yalnız o zaman yazılır (§7a 16).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const APP = "1505264761663625";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ENSURE = "/api/workspace/whatsapp/templates/ensure";

// listedTtl: Meta'nın şablon listesinde bildirdiği teslim süresi (sn; programın yazdığı değil). Verilirse onaydan sonra Şablonları Denetle yeniden okur.
async function scenario({ ttlRange = [30, 43_200], listedTtl = null } = {}) {
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP });
  const ctx = await startWa({ fake, connect: false });
  try {
    if (ttlRange) fake.state.ttlRange = ttlRange;
    assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, appId: APP, token: TOKEN })).status, 200);
    let ensured = await ctx.api.post(ENSURE, {});
    assert.equal(ensured.status, 200, JSON.stringify(ensured.data));
    for (const tpl of fake.state.templates) tpl.status = "APPROVED"; // Meta onayladı
    if (listedTtl) {
      for (const tpl of fake.state.templates) if (tpl.name.startsWith("destekofis_")) tpl.message_send_ttl_seconds = listedTtl;
      ensured = await ctx.api.post(ENSURE, {});
      assert.equal(ensured.status, 200, JSON.stringify(ensured.data));
    }
    const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
    const res = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const id = res.data.data.batch.id;
    await ctx.drain();
    const job = (await ctx.jobs(id))[0];
    assert.equal(job.state, "accepted");
    ctx.statuses([{ id: job.wamid, status: "sent", timestamp: String(Math.floor(ctx.clock.ms() / 1000)) }]);
    const close = async () => {
      await ctx.close();
      await fake.close();
    };
    return { ctx, fake, id, ensured: ensured.data.data, state: async () => (await ctx.jobs(id))[0].state, close };
  } catch (error) {
    await ctx.close();
    await fake.close();
    throw error;
  }
}

describe("2.4.8 T2-5 güvenli taraf → 2.4.9 W-T — Süresi Doldu ve PDF silme Meta'nın teslim süresine (yoksa 30 güne) bağlı", () => {
  it("Meta listesi teslim süresi BİLDİRMİYOR (Meta varsayılanı): iş 73. saatte Süresi Doldu OLMAZ, PDF silinmez; kartta uyarı yok; 30 gün + 1 saatte Süresi Doldu + PDF silinir", async () => {
    const s = await scenario();
    try {
      s.ctx.clock.advance(73 * HOUR + MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent", "Meta hâlâ teslim etmeye çalışıyor: 73. saatte Süresi Doldu olmamalı");
      assert.equal(s.fake.state.deleted.length, 0, "Meta hâlâ teslim etmeye çalışırken PDF silinmemeli");
      assert.ok(s.ensured.items.every(item => !item.warnings.some(text => /teslim süresi/i.test(text))), JSON.stringify(s.ensured.items.map(item => item.warnings)));
      // 30. günün hemen öncesi: bildirim yolu hâlâ çalışıyor (son 7 günde bildirim geldi — §7a 16); süre yine dolmadı.
      s.ctx.clock.advance(30 * DAY - 73 * HOUR - 2 * HOUR);
      s.ctx.statuses([{ id: "wamid.BASKA0001", status: "sent", timestamp: String(Math.floor(s.ctx.clock.ms() / 1000)) }]);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent", "30 gün dolmadan Süresi Doldu yok");
      assert.equal(s.fake.state.deleted.length, 0);
      s.ctx.clock.advance(3 * HOUR + MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "expired", "Meta'nın varsayılanı 30 gün + 1 saatte Süresi Doldu");
      assert.equal(s.fake.state.deleted.length, 1, "30 günde PDF silinir");
    } finally {
      await s.close();
    }
  });

  it("Meta varsayılanı (30 gün) ve bildirim yolu 7 günden beri sessiz: iş Gönderildi'de kalır (§7a 16), PDF yine 30 gün + 1 saatte silinir (Meta artık teslim etmeye çalışmaz)", async () => {
    const s = await scenario();
    try {
      s.ctx.clock.advance(30 * DAY - MIN);
      await s.ctx.drain();
      assert.equal(s.fake.state.deleted.length, 0, "30 gün dolmadan PDF silinmez");
      s.ctx.clock.advance(HOUR + 2 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent");
      assert.equal(s.fake.state.deleted.length, 1);
    } finally {
      await s.close();
    }
  });

  it("Meta listede 43.200 sn (12 saat) BİLDİRİR (WhatsApp Yöneticisi'nde ayarlı): 13. saatte Süresi Doldu + PDF silinir (12 saat 30 dk'da henüz değil)", async () => {
    const s = await scenario({ listedTtl: 43_200 });
    try {
      s.ctx.clock.advance(12 * HOUR + 30 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent");
      assert.equal(s.fake.state.deleted.length, 0);
      s.ctx.clock.advance(31 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "expired", "Meta'nın bildirdiği 12 saat + 1 saatte Süresi Doldu");
      assert.equal(s.fake.state.deleted.length, 1);
    } finally {
      await s.close();
    }
  });

  it("Meta listede 259.200 sn BİLDİRİR (2.4.8'de 72 saatle açılmış eski şablon; §15 'liste değeri geçerli'): 73. saatte Süresi Doldu + PDF silinir (72 saat 30 dk'da henüz değil)", async () => {
    const s = await scenario({ ttlRange: null, listedTtl: 259_200 });
    try {
      s.ctx.clock.advance(72 * HOUR + 30 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "sent");
      s.ctx.clock.advance(31 * MIN);
      await s.ctx.drain();
      assert.equal(await s.state(), "expired");
      assert.equal(s.fake.state.deleted.length, 1);
    } finally {
      await s.close();
    }
  });
});
