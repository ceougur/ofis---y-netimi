// 2.4.8 T2 bulgu 6 (ORTA; bağımsız gözden geçirme r3): aynı işin yeniden denemesinde (131056 → 1 dk sonra; aynı yol geçici hata / Bağlantı Bekleniyor / 131049 /
// Duraklat → Devam Et) iletinin değişkenleri GÖNDERİM ANINDA yeniden okunuyor ama ekteki PDF ilk denemenin yüklemesi yeniden kullanılıyordu → iletideki "Dönem sonu
// bakiyesi" ≠ ekteki PDF. Beklenen (plan §7a 1 "telefon, ad, bakiye, PDF aynı okumadan" = metin ile PDF aynı; §7a 14–15 "yeniden denemede medya geçerliyse
// aynısı"): iş hazırlanırken değişkenler ve PDF TEK anlık görüntüden üretilip dondurulur; her yeniden deneme aynı metni ve aynı PDF'i gönderir; Meta'daki kopyanın
// süresi dolmuşsa (30 gün) AYNI baytlar yeniden yüklenir. Dondurulmuş PDF iş kesinleşince programdan silinir (plan §5: iletinin içeriği saklanmaz).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat (ders 13). Bakiye ve PDF içeriği testin girdiği veriden.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pdfText } from "./banka-210-ortak.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const metaError = (code, message = "hata") => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "Abc" } });
const uploads = ctx => ctx.fake.requests.filter(item => item.method === "POST" && /\/media$/.test(item.path) && item.media);
const today = ctx => ctx.clock().toISOString().slice(0, 10);
async function pay(ctx, id, amount) {
  const res = await ctx.api.post(`/api/workspace/accounts/${id}/entries`, { kind: "in", amount: String(amount), date: today(ctx), note: "Tahsilat" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
}

describe("2.4.8 T2-6 — yeniden denemede ileti metni ile ekteki PDF AYNI anlık görüntüden", () => {
  it("131056 → 1 dk sonra yeniden deneme: arada tahsilat girilse de ileti ve PDF ilk hazırlıktaki bakiyeyi (1.250,00) taşır; PDF bir kez yüklenir", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") });
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal((await ctx.jobs(id))[0].state, "pending", "ön koşul: ilk deneme 131056 ile bekliyor");
      await pay(ctx, a.id, 250);
      ctx.clock.advance(61_000);
      await ctx.drain({ maintain: false });
      const job = (await ctx.jobs(id))[0];
      assert.equal(job.state, "accepted");
      const sent = ctx.messages().at(-1);
      const text = (await pdfText(ctx.fake.state.media.get(sent.document.id).data)).replace(/\s+/g, " ");
      const pdfHas = amount => text.includes(amount);
      assert.equal(sent.params[3], "1.250,00 TL (Borçlu)", `ileti ilk hazırlığın bakiyesini taşımalı (geldi ${sent.params[3]})`);
      assert.ok(pdfHas("1.250,00") && !pdfHas("1.000,00"), "PDF de 1.250,00 (aynı anlık görüntü)");
      assert.equal(uploads(ctx).length, 1, "PDF bir kez yüklendi (§7a 15)");
    } finally {
      await ctx.close();
    }
  });

  it("Duraklat → 31 gün → Devam Et: Meta'daki kopyanın süresi dolmuş; AYNI PDF baytları yeniden yüklenir, ileti aynı bakiyeyle gider; kesinleşince dondurulmuş PDF silinir", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") });
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal(uploads(ctx).length, 1);
      const first = uploads(ctx)[0].media;
      const firstBytes = Buffer.from(ctx.fake.state.media.get(first.id).data);
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/pause`, {})).status, 200);
      await pay(ctx, a.id, 250);
      ctx.clock.advance(31 * DAY);
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/resume`, {})).status, 200);
      await ctx.drain();
      const job = (await ctx.jobs(id))[0];
      assert.equal(job.state, "accepted", JSON.stringify(job));
      assert.equal(uploads(ctx).length, 2, "süresi dolan kopya yeniden yüklendi");
      const second = uploads(ctx)[1].media;
      const secondBytes = Buffer.from(ctx.fake.state.media.get(second.id).data);
      assert.ok(firstBytes.equals(secondBytes), "yeniden yüklenen PDF ilk hazırlıktakiyle BAYT BAYT aynı (dondurulmuş)");
      assert.equal(second.filename, first.filename);
      const sent = ctx.messages().at(-1);
      assert.equal(sent.document.id, second.id);
      assert.equal(sent.params[3], "1.250,00 TL (Borçlu)", `ileti dondurulmuş bakiyeyle (geldi ${sent.params[3]})`);
      // Kabul edildi: bakım turu dondurulmuş PDF'i programdan siler (değişkenler ve PDF adı kalır — plan §5).
      const row = ctx.store.get("SELECT id, pdf_blob, params_json, pdf_name FROM wa_jobs WHERE batch_id = ?", id);
      assert.equal(row.pdf_blob, null, "kabulden sonra dondurulmuş PDF şirket dosyasında kalmaz");
      // 2.4.9 B3 (göç v45): PDF'in kendisi wa_job_pdfs'te durur; kabulden sonra bakım o satırı siler.
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_job_pdfs WHERE job_id = ?", row.id).n, 0, "kabulden sonra wa_job_pdfs'te de yok");
      assert.ok(row.pdf_name && JSON.parse(row.params_json).length === 4);
    } finally {
      await ctx.close();
    }
  });

  it("ödeme hatırlatması: yeniden denemede değişkenler (vade, gecikmiş toplam, bakiye) ilk hazırlıktakiyle AYNI", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Taksitli Kişi", "0533 444 55 66");
      const plan = await ctx.api.post("/api/workspace/plans", { accountId: a.id, name: "Taksit", total: "3000", count: 3, firstDue: "2026-11-15", startDate: "2026-11-03" });
      assert.equal(plan.status, 200, JSON.stringify(plan.data).slice(0, 300));
      // İki taksitin vadesi geçti (15.11 ve 15.12): gecikmiş 2.000,00.
      ctx.clock.set("2026-12-20T10:00:00+03:00");
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") });
      const res = await ctx.batch({ kind: "reminder", ids: [a.id] });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const id = res.data.data.batch.id;
      await ctx.drain();
      const frozen = (await ctx.jobs(id))[0].params;
      assert.deepEqual(frozen, ["Taksitli Kişi", "Örnek Ticaret", "15.11.2026", "2.000,00 TL", "3.000,00 TL (Borçlu)"]);
      // Arada carinin bakiyesi değişir (borç dekontu 400): yeniden deneme yine ilk hazırlığın değişkenleriyle.
      const debt = await ctx.api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "400", date: today(ctx), note: "Borç" });
      assert.equal(debt.status, 200, JSON.stringify(debt.data));
      ctx.clock.advance(61_000);
      await ctx.drain({ maintain: false });
      assert.equal((await ctx.jobs(id))[0].state, "accepted");
      assert.deepEqual(ctx.messages().at(-1).params, frozen, "yeniden deneme aynı değişkenlerle");
    } finally {
      await ctx.close();
    }
  });
});
