// 2.4.8 W3 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W3, S3 A, S5; §7a 14, 15, 21, 22): dönemli ekstre üreticisi (lib/statement-pdf.mjs) üç yolda AYNI —
// ANLIK DURUM → Cari Ekstre PDF'i, WhatsApp penceresinin (wa.me, "Kendi WhatsApp'ımla") "Cari Ekstre - PDF"i (seçilen DÖNEMLE; önceden bütün hareketler) ve
// WhatsApp Business API'ye yüklenen PDF. Metin ile PDF aynı dönem ve aynı bakiye; dönem uçları dahil, ileri tarihli hareket dönem sonundan sonraysa girmez.
// Medya: kesin durumdan sonra Meta'dan silinir (S3 A), "Meta Bekletti"de silinmez, geçerliyse yeniden kullanılır, 30 günü geçmişse yeniden yüklenir.
// Gerçek program + yerel sahte Meta (ders 30; aynı el, kâhin değil — ders 5) + sahte saat (ders 13: ayın 1'i, ay sonu). Eski/yeni üreticinin bayt bayt aynılığı
// ayrıca eski sürümün GERÇEK koduyla: docs/kanit/2026-10-30/248-g5-betikler/ekstre-fark.mjs.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pdfText } from "./banka-210-ortak.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const DAY = 86_400_000;
const metaError = (code, message = "hata") => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "Abc" } });
const docOf = request => request.body.template.components.find(item => item.type === "header")?.parameters?.[0]?.document?.id;

// Ayın 1'i (ders 13): Bu Ay = tek gün; Geçen Ay = önceki ayın tamamı.
async function seed(ctx) {
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data.data;
  };
  const a = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Dönem Kişisi", phone: "0532 777 88 99", openingBalance: "1000", registeredOn: "2026-09-01" }));
  for (const body of [
    { kind: "debt", amount: "200", date: "2026-10-01", note: "Ekim ilk gün" },
    { kind: "in", amount: "350", date: "2026-10-31", note: "Ekim son gün" },
    { kind: "debt", amount: "40", date: "2026-11-01", note: "Kasım ilk gün" },
  ]) await must(body.note, ctx.api.post(`/api/workspace/accounts/${a.id}/entries`, body));
  return a;
}

describe("2.4.8 W3 — dönemli ekstre üç yolda aynı (metin = PDF)", () => {
  it("wa.me 'Cari Ekstre - PDF' seçilen dönemi basar (Geçen Ay: devir 1.000, Ekim hareketleri, dönem sonu 850); metindeki güncel bakiyeyle aynı; ANLIK DURUM ekstresiyle BAYT BAYT aynı", async () => {
    // wa.me yolu: WhatsApp Business API bağlantısı ve gönderim onayı gerekmez (eski kodda da yalnız dönem farkıyla kırmızı — ders 38).
    const ctx = await startWa({ connect: false, ack: false, now: { time: "2026-11-01T10:00:00+03:00", fixed: true } });
    try {
      const a = await seed(ctx);
      const prepared = (await ctx.api.post("/api/workspace/whatsapp/targets", { ids: [a.id], kind: "statement", preset: "lastMonth" })).data.data;
      assert.deepEqual(prepared.range, { from: "2026-10-01", to: "2026-10-31" });
      const text = prepared.recipients[0].statement;
      assert.match(text, /Güncel bakiye: 850,00 TL \(borcunuz\)/, "metin: 1.000 + 200 − 350");
      const query = new URLSearchParams({ donem: "1", from: prepared.range.from, to: prepared.range.to });
      const waPdf = await ctx.api.raw("GET", `/api/workspace/accounts/${a.id}/ekstre.pdf?${query}&download=1`);
      assert.equal(waPdf.status, 200);
      const content = pdfText(waPdf.buffer);
      assert.doesNotMatch(content, /Kasım ilk gün/, "dönem dışı hareket PDF'e girmez");
      assert.match(content, /850,00 TL Borçlu/, "PDF'in dönem sonu bakiyesi metindekiyle aynı");
      assert.match(content, /Cari Ekstre · Dönem Kişisi/);
      assert.match(content, /01\.10\.2026 – 31\.10\.2026/);
      assert.match(content, /Ekim ilk gün/, "dönem başı günü dahil");
      assert.match(content, /Ekim son gün/, "dönem sonu günü dahil");
      assert.match(content, /1\.000,00 TL B/, "devir");
      assert.match(decodeURIComponent(waPdf.headers.get("content-disposition")), /Ekstre Dönem Kişisi 01\.10\.2026-31\.10\.2026\.pdf/);
      const overview = await ctx.api.raw("GET", `/api/workspace/overview/ekstre.pdf?account=${a.id}&from=2026-10-01&to=2026-10-31&download=1`);
      assert.equal(overview.status, 200);
      assert.equal(Buffer.compare(overview.buffer, waPdf.buffer), 0, "aynı üretici, aynı bayt");
      // Parametresiz (cari kartı) PDF eskisi gibi bütün hareketleri basar.
      const card = pdfText((await ctx.api.raw("GET", `/api/workspace/accounts/${a.id}/ekstre.pdf?download=1`)).buffer);
      assert.match(card, /Kasım ilk gün/);
      assert.match(card, /Ekim ilk gün/);
      // Geçersiz dönem.
      assert.equal((await ctx.api.raw("GET", `/api/workspace/accounts/${a.id}/ekstre.pdf?donem=1&from=2026-13-01&to=2026-10-31`)).status, 400);
      assert.equal((await ctx.api.raw("GET", `/api/workspace/accounts/${a.id}/ekstre.pdf?donem=1&from=2026-11-01&to=2026-10-31`)).status, 400);
    } finally {
      await ctx.close();
    }
  });

  it("'Tüm Hareketler' bugüne kadar: ileri tarihli hareket metne de PDF'e de girmez (§7a 22); Bu Ay ayın 1'inde tek gün", async () => {
    const ctx = await startWa({ connect: false, ack: false, now: { time: "2026-11-01T10:00:00+03:00", fixed: true } });
    try {
      const a = await seed(ctx);
      const future = await ctx.api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "77", date: "2026-11-25", note: "İleri tarihli" });
      const all = (await ctx.api.post("/api/workspace/whatsapp/targets", { ids: [a.id], kind: "statement", preset: "all" })).data.data;
      assert.deepEqual(all.range, { from: "", to: "2026-11-01" });
      assert.match(all.recipients[0].statement, /Güncel bakiye: 890,00 TL \(borcunuz\)/, "1.000 + 200 − 350 + 40 (ileri tarihli 77 yok)");
      const pdf = pdfText((await ctx.api.raw("GET", `/api/workspace/accounts/${a.id}/ekstre.pdf?${new URLSearchParams({ donem: "1", from: "", to: all.range.to })}`)).buffer);
      assert.match(pdf, /Tüm Hareketler · 01\.11\.2026 tarihine kadar/);
      assert.match(pdf, /890,00 TL Borçlu/);
      if (future.status === 200) assert.doesNotMatch(pdf, /İleri tarihli/, "ileri tarihli hareket girmez");
      const thisMonth = (await ctx.api.post("/api/workspace/whatsapp/targets", { ids: [a.id], kind: "statement", preset: "thisMonth" })).data.data;
      assert.deepEqual(thisMonth.range, { from: "2026-11-01", to: "2026-11-01" }, "ayın 1'inde Bu Ay tek gün");
    } finally {
      await ctx.close();
    }
  });

  it("WhatsApp Business API'ye yüklenen PDF, wa.me yolunun aynı dönem PDF'iyle BAYT BAYT aynı; iletinin {{3}} ve {{4}}'ü PDF'le aynı", async () => {
    const ctx = await startWa({ now: { time: "2026-11-01T10:00:00+03:00", fixed: true } });
    try {
      const a = await seed(ctx);
      const res = await ctx.batch({ kind: "statement", ids: [a.id], preset: "lastMonth" });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      await ctx.drain({ maintain: false });
      const message = ctx.messages()[0];
      assert.deepEqual(message.params.slice(2), ["01.10.2026 – 31.10.2026", "850,00 TL (Borçlu)"]);
      assert.equal(message.document.filename, "Ekstre Dönem Kişisi 01.10.2026-31.10.2026.pdf");
      const uploaded = ctx.fake.state.media.get(message.document.id).data;
      const waPdf = (await ctx.api.raw("GET", `/api/workspace/accounts/${a.id}/ekstre.pdf?donem=1&from=2026-10-01&to=2026-10-31`)).buffer;
      assert.equal(Buffer.compare(uploaded, waPdf), 0, "metin = PDF, üç yol aynı üretici");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 W3 — gönderilen PDF Meta'da (S3 A; §7a 14, 15)", () => {
  it("kesin durumdan sonra (Teslim Edildi / Okundu / Başarısız / Süresi Doldu) PDF Meta'dan silinir; Meta Kabul Etti / Sonucu Belirsiz / Meta Bekletti'de silinmez; zaten silinmişse silinmiş sayılır", async () => {
    const ctx = await startWa();
    try {
      const people = [];
      for (const [name, phone] of [["Teslim", "0557 000 00 01"], ["Okundu", "0557 000 00 02"], ["Teslimsiz", "0557 000 00 03"], ["Kabul", "0557 000 00 04"], ["Bekletilen", "0557 000 00 05"], ["Belirsiz", "0557 000 00 06"], ["Zaten Silinmiş", "0557 000 00 07"]]) people.push(await ctx.account(name, phone, 10));
      ctx.fake.state.recipientErrors["+905570000005"] = { status: 400, body: metaError(131049, "Healthy ecosystem") };
      const id = (await ctx.batch({ kind: "statement", ids: people.map(item => item.id), preset: "thisMonth" })).data.data.batch.id;
      // Belirsiz kişi: işlendi, yanıt yok.
      for (let i = 0; i < 5; i += 1) await ctx.wa.scheduler.runOnce();
      ctx.fake.state.dropAfter = /\/messages$/;
      await ctx.wa.scheduler.runOnce();
      ctx.fake.state.dropAfter = null;
      await ctx.wa.scheduler.runOnce();
      const jobs = Object.fromEntries((await ctx.jobs(id)).map(job => [job.accountName, job]));
      const wamid = name => ctx.messages().find(item => item.opaque === jobs[name].id)?.wamid;
      const ts = String(Math.floor(ctx.clock.ms() / 1000));
      ctx.statuses([
        { id: wamid("Teslim"), status: "delivered", timestamp: ts },
        { id: wamid("Okundu"), status: "read", timestamp: ts },
        { id: wamid("Teslimsiz"), status: "failed", timestamp: ts, errors: [{ code: 131026, title: "Message undeliverable" }] },
        { id: wamid("Zaten Silinmiş"), status: "delivered", timestamp: ts },
      ]);
      const gone = ctx.messages().find(item => item.opaque === jobs["Zaten Silinmiş"].id).document.id;
      ctx.fake.state.media.delete(gone);
      await ctx.drain();
      const after = Object.fromEntries((await ctx.jobs(id)).map(job => [job.accountName, job]));
      for (const name of ["Teslim", "Okundu", "Teslimsiz", "Zaten Silinmiş"]) assert.equal(after[name].mediaDeleted, true, `${name}: PDF Meta'dan silindi`);
      for (const name of ["Kabul", "Bekletilen", "Belirsiz"]) assert.equal(after[name].mediaDeleted, false, `${name}: PDF silinmedi (${after[name].state})`);
      assert.equal(after["Bekletilen"].state, "held");
      assert.equal(after["Belirsiz"].state, "uncertain");
      assert.equal(after["Teslimsiz"].state, "failed");
      for (const name of ["Teslim", "Okundu", "Teslimsiz"]) assert.ok(ctx.fake.state.deleted.includes(ctx.messages().find(item => item.opaque === jobs[name].id).document.id), `${name}: Meta'ya DELETE gitti`);
      assert.ok(ctx.fake.state.media.has(ctx.messages().find(item => item.opaque === jobs["Kabul"].id).document.id), "kabul edilenin PDF'i Meta'da duruyor");
    } finally {
      await ctx.close();
    }
  });

  it("yeniden denemede medya geçerliyse AYNISI kullanılır, 30 günü geçmişse yeniden yüklenir (§7a 15)", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Medya Yeniden", "0558 000 00 01", 10);
      const b = await ctx.account("Medya Eski", "0558 000 00 02", 10);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 503, body: metaError(2, "Temporary") }, { match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate") });
      const id = (await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain({ maintain: false });
      const uploads = () => ctx.fake.requests.filter(item => item.method === "POST" && item.path.endsWith("/media")).length;
      assert.equal(uploads(), 2);
      ctx.clock.advance(31_000);
      await ctx.drain({ maintain: false });
      const sentA = ctx.messageRequests().filter(item => item.body.to === "+905580000001");
      assert.equal(sentA.length, 2);
      assert.equal(docOf(sentA[0]), docOf(sentA[1]), "geçici hatadan sonra aynı medya");
      assert.equal(uploads(), 2, "yeniden yüklenmedi");
      // İkinci kişi 131056 (1 dk sonra) — ama araya 30 gün girdi: medya süresi doldu → yeniden yüklenir.
      ctx.clock.advance(30 * DAY);
      await ctx.drain({ maintain: false });
      const sentB = ctx.messageRequests().filter(item => item.body.to === "+905580000002");
      assert.equal(sentB.length, 2);
      assert.notEqual(docOf(sentB[0]), docOf(sentB[1]), "30 günden eski medya yeniden yüklendi");
      assert.equal(uploads(), 3);
      assert.equal((await ctx.detail(id)).state, "done");
    } finally {
      await ctx.close();
    }
  });
});
