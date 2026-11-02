// 2.4.8 T1 (kâhin karşılaştırması) B3–B5 — GUV-03 / GUV-08, SINIR-02, SABLON-PAZARLAMA-ARADA / OLCEK-04: işçi lisansı, şablonu ve Meta sınır basamağını YALNIZ
// gönderilecek iş seçtiğinde denetliyordu; sınırda bekleyen işler bekleme bitene dek hiç denetlenmiyordu →
//   B3: lisans salt okunura düşünce bekleyenler "Lisans Nedeniyle Durdu" olmuyor, lisans dönünce Devam Et beklenmeden gidiyordu (plan §4, §7a 25: kendiliğinden SÜRMEZ);
//   B4: Meta basamağı yükselince 6 saatte bir okuma (§6 W2) bekleyenleri erken bırakmıyordu;
//   B5: şablon Pazarlama'ya alınınca (R2: her 100 iletide / EN GEÇ 10 DAKİKADA okunur; §7a 27) bekleyen toplu iş durmuyordu.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat (ders 13). Lisans: programın lisans nesnesinin yazılabilirlik yanıtı test
// içinde değiştirilir (kâhin sürücüsüyle aynı dış koşul; gerçek salt okunur lisans yolu whatsapp-w2-veri-248'de yeniden açılışla sınanır — ders 14).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const MIN = 60_000;
const HOUR = 60 * MIN;
const PEOPLE = [["Ayşe Yılmaz", "0532 111 22 33"], ["Burak Kaya", "0533 444 55 66"], ["Cem Ak", "0534 777 88 99"], ["Deniz Er", "0535 000 11 22"]];

async function waiting({ cap = 2, tier = null } = {}) {
  const ctx = await startWa();
  try {
    if (tier) ctx.fake.state.tier = tier;
    if (cap) assert.equal((await ctx.api.put(URLS.sending, { dailyCap: cap })).status, 200);
    const ids = [];
    for (const [name, phone] of PEOPLE) ids.push((await ctx.account(name, phone, 500)).id);
    const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    await ctx.drain();
    assert.equal(ctx.messages().length, 2, "ön koşul: iki kişi gitti, iki kişi sınırda bekliyor");
    return { ctx, id: res.data.data.batch.id };
  } catch (error) {
    await ctx.close();
    throw error;
  }
}
const states = async (ctx, id) => (await ctx.jobs(id)).map(job => job.state).sort();

describe("2.4.8 T1 B3–B5 — sınırda bekleyen toplu iş de denetlenir", () => {
  it("B3: lisans salt okunura düşünce bekleyen toplu iş 'Lisans Nedeniyle Durdu'; lisans dönünce KENDİLİĞİNDEN sürmez, Devam Et ile sürer", async () => {
    const { ctx, id } = await waiting();
    try {
      let writable = true;
      ctx.server.app.license.writable = () => writable;
      ctx.clock.advance(HOUR);
      writable = false;
      await ctx.drain();
      let detail = await ctx.detail(id);
      assert.equal(detail.state, "paused", `bekleyen toplu iş lisans düşünce durmalı (geldi ${detail.state})`);
      assert.equal(detail.pauseCode, "license");
      assert.match(detail.pauseReason, /Lisans Nedeniyle Durdu/);
      assert.deepEqual(await states(ctx, id), ["accepted", "accepted", "paused", "paused"]);
      ctx.clock.advance(HOUR);
      writable = true;
      ctx.clock.advance(24 * HOUR);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "lisans dönünce Devam Et beklenmeden ileti gitmez (§7a 25)");
      assert.equal((await ctx.detail(id)).state, "paused");
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/resume`, {})).status, 200);
      await ctx.drain();
      assert.equal(ctx.messages().length, 4, "Devam Et → bekleyenler gider");
    } finally {
      await ctx.close();
    }
  });

  it("B4: Meta sınır basamağı yükselince 6 saat içinde okunur ve sınırda bekleyenler (24 saati beklemeden) gider", async () => {
    // Elle sınır yok; Meta basamağı 2 (sahte değer — basamak adı kuralı TIER_<n>, D0-4).
    const { ctx, id } = await waiting({ cap: 0, tier: "TIER_2" });
    try {
      ctx.clock.advance(2 * HOUR);
      ctx.fake.state.tier = "TIER_10";
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "basamak 6 saatte bir okunur — 2. saatte henüz okunmadı");
      ctx.clock.advance(4 * HOUR + MIN);
      await ctx.drain();
      assert.equal(ctx.messages().length, 4, `6 saatlik okumada yükselen basamak bekleyenleri bırakmalı (giden ${ctx.messages().length})`);
      assert.deepEqual(await states(ctx, id), ["accepted", "accepted", "accepted", "accepted"]);
    } finally {
      await ctx.close();
    }
  });

  it("B5: bekleyen toplu işte şablon Pazarlama'ya alınınca en geç 10 dakikada toplu iş DURUR (bekleyenler Duraklatıldı, neden görünür)", async () => {
    const { ctx, id } = await waiting();
    try {
      ctx.clock.advance(30 * MIN);
      await ctx.drain();
      ctx.fake.state.templates.find(item => item.name === "destekofis_ekstre").category = "MARKETING";
      ctx.clock.advance(10 * MIN + 1000);
      await ctx.drain();
      const detail = await ctx.detail(id);
      assert.equal(detail.state, "paused", `şablon Pazarlama'ya alınınca bekleyen toplu iş 10 dk içinde durmalı (geldi ${detail.state})`);
      assert.equal(detail.pauseCode, "template-marketing");
      assert.match(detail.pauseReason, /Pazarlama'ya Alındı/);
      assert.deepEqual(await states(ctx, id), ["accepted", "accepted", "paused", "paused"]);
      ctx.clock.advance(24 * HOUR);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "pazarlama ücretiyle ileti gitmedi");
    } finally {
      await ctx.close();
    }
  });
});
