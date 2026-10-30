// 2.4.8 T2 bulgu 7 (ORTA; bağımsız gözden geçirme r6): müşteri WhatsApp Yöneticisi'nde programın şablonunun METNİNİ değiştirirse (Meta yeniden onaylar, kategori
// UTILITY kalır) Şablonlar kartı "içerik değiştirilmiş; program bu şablonla gönderim yapmaz" diyordu ama gönderim çekirdeği (queue.mjs judgeTemplate) yalnız
// durum / kategoriye bakıp iletiyi gönderiyordu. Beklenen (plan §1 ürün kararı "yalnız 2 sabit bilgilendirme şablonu; kampanya / serbest metin YOK", §2.4
// "metinde tanıtım dışı cümle yok", §7a 27 + R2 "başlarken ve sürerken her 100 iletide / en geç 10 dakikada okunur"): içeriği programın sabit metninden farklı
// şablonla toplu gönderim BAŞLAMAZ, sürerken değişirse DURUR; neden ekranda (ekrandaki "Gönderime Hazır: Hayır" ile aynı kural).
// Beklenen şablon metni PLANDAN (§7a 23 / K3 ekstre gövdesi, §1 KVKK alt satırı) yazıldı — programın kodundan okunmadı (ders 5).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const MIN = 60_000;
// Plan §7a 23 (K3) ve §1: ekstre şablonunun gövdesi ve alt satırı (belge başlıklı).
const PLAN_BODY = "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Dönem sonu bakiyesi: {{4}}. İyi günler dileriz.";
const PLAN_FOOTER = "KVKK aydınlatma metni için firmamıza başvurabilirsiniz.";
const planComponents = () => [{ type: "HEADER", format: "DOCUMENT" }, { type: "BODY", text: PLAN_BODY }, { type: "FOOTER", text: PLAN_FOOTER }];
const campaign = () => [{ type: "HEADER", format: "DOCUMENT" }, { type: "BODY", text: "Sayın {{1}}, {{2}} kampanyamızı kaçırmayın! {{3}} döneminde {{4}} indirim sizi bekliyor." }, { type: "FOOTER", text: PLAN_FOOTER }];
const statement = ctx => ctx.fake.state.templates.find(item => item.name === "destekofis_ekstre");

describe("2.4.8 T2-7 — içeriği değiştirilmiş şablonla gönderim yapılmaz (sunucuda; ekranla aynı kural)", () => {
  it("planın metniyle aynı şablon gönderir; içeriği değiştirilmiş şablonla toplu gönderim BAŞLAMAZ (409 + neden), önizleme nedeni söyler, kart da 'Gönderime Hazır Değil'", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const body = { kind: "statement", ids: [a.id], preset: "thisMonth" };
      // Olumlu denetim: Meta'daki içerik planın metniyle AYNI → gönderilir.
      statement(ctx).components = planComponents();
      const okRes = await ctx.batch(body);
      assert.equal(okRes.status, 200, JSON.stringify(okRes.data));
      await ctx.drain();
      assert.equal(ctx.messages().length, 1, "planın metniyle aynı şablon gönderir");
      // Program içeriği SUNUCUDA okur: şablon listesi isteği içerik alanını (components) ister.
      const listing = ctx.fake.requests.filter(item => item.method === "GET" && /\/message_templates$/.test(item.path));
      assert.ok(listing.length > 0 && listing.every(item => String(item.query.fields || "").split(",").includes("components")), `şablon listesi components alanıyla istenmeli: ${listing.map(item => item.query.fields).join(" | ")}`);
      // Müşteri WhatsApp Yöneticisi'nde metni kampanyaya çevirdi (Meta yeniden onayladı; kategori UTILITY).
      statement(ctx).components = campaign();
      const card = await ctx.api.post("/api/workspace/whatsapp/templates/ensure", {});
      assert.equal(card.status, 200, JSON.stringify(card.data));
      assert.equal(card.data.data.items.find(item => item.name === "destekofis_ekstre").usable, false, "kart: gönderime hazır değil");
      const preview = await ctx.api.post(URLS.preview, { ...body, sendAgain: true });
      assert.equal(preview.status, 200, JSON.stringify(preview.data));
      assert.equal(preview.data.data.template?.ok, false, `önizleme şablonu kullanılamaz demeli: ${JSON.stringify(preview.data.data.template)}`);
      assert.equal(preview.data.data.template?.code, "template-content");
      const res = await ctx.batch({ ...body, sendAgain: true });
      assert.equal(res.status, 409, `içeriği değiştirilmiş şablonla başlatma reddedilmeli (geldi ${res.status} ${JSON.stringify(res.data).slice(0, 200)})`);
      assert.equal(res.data.code, "whatsapp-template-content");
      assert.match(res.data.error, /içeriği WhatsApp Yöneticisi'nde değiştirilmiş/);
      await ctx.drain();
      assert.equal(ctx.messages().length, 1, "ikinci ileti gitmedi");
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_batches").n, 1, "reddedilen başlatma toplu iş kaydı açmaz");
    } finally {
      await ctx.close();
    }
  });

  it("gönderim SÜRERKEN içerik değişirse (R2: en geç 10 dk'da yeniden okunur) toplu iş DURUR, neden görünür; kalanlara gitmez", async () => {
    const ctx = await startWa();
    try {
      await ctx.api.put(URLS.sending, { dailyCap: 1 });
      const ids = [];
      for (const [name, phone] of [["Ayşe Yılmaz", "0532 111 22 33"], ["Burak Kaya", "0533 444 55 66"], ["Cem Ak", "0534 777 88 99"]]) ids.push((await ctx.account(name, phone, 500)).id);
      statement(ctx).components = planComponents();
      const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const batchId = res.data.data.batch.id;
      await ctx.drain();
      assert.equal(ctx.messages().length, 1, "sınır 1: ilk kişi gitti, öbürleri bekliyor");
      statement(ctx).components = campaign();
      // Sınır penceresi açılınca (24 saat) işçi sürer; şablon önbelleği (10 dk) çoktan doldu → yeniden okunur.
      ctx.clock.advance(24 * 60 * MIN + MIN);
      await ctx.drain();
      const detail = await ctx.detail(batchId);
      assert.equal(ctx.messages().length, 1, `içerik değişince kalanlara ileti gitmemeli (giden ${ctx.messages().length}; toplu iş ${detail.state}/${detail.pauseCode})`);
      assert.equal(detail.state, "paused");
      assert.equal(detail.pauseCode, "template-content");
      assert.match(detail.pauseReason, /içeriği WhatsApp Yöneticisi'nde değiştirilmiş/);
      // Meta'daki içerik plandaki metne döndürülünce Devam Et ile sürer.
      statement(ctx).components = planComponents();
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "içerik düzelince Devam Et ile sürer (sınır 1 → bir kişi daha)");
    } finally {
      await ctx.close();
    }
  });
});
