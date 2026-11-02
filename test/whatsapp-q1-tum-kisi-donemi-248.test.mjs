// 2.4.8 İş Q1 (dar kontrol 10 DÜŞÜK-1; "KİME KAÇ KEZ" ilkesi 3 "dönem eşliğinde şüphede AYNI dönem"): "Tüm Hareketler"in iletideki dönemi KİŞİYE ÖZELDİR —
// "<carinin ilk hareketi> – <o gün>" (periodText). Bu tarihlerle birebir aynı özel aralık aynı dönemdir (R3 "Daha Önce Gönderildi", "Zaten Kuyrukta", "Sonucu Belirsiz";
// iki yön; taşınan veri). Önce "Tüm Hareketler"in başlangıcı boş sayılıp hiçbir özel aralıkla eşleşmiyordu (dar kontrol 10 b1/b1b: Excel'le aynı gün açılmış 3 cariye
// aynı dönem metniyle İKİŞER ileti — 6). Eşlik cari başınadır: başka carinin ilk hareketi karışmaz. Hareketsiz cari (ya da yalnız ileri tarihli hareketli): dönemi iletideki gibi "<o gün> – <o gün>" (İş R6).
// Seçimin 7 gün penceresi bu eşlikte de geçerli.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat, çok günlü (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { removeTestDir } from "./helpers.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const tum = ids => ({ kind: "statement", ids, preset: "all" });
const custom = (ids, from, to) => ({ kind: "statement", ids, from, to });
const PAIR = { status: 400, body: metaError(131056, "Pair rate limit hit") };

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
const previewSkip = async (ctx, body, label) => skipOf(await ok(await ctx.api.post(URLS.preview, body), label));
/** 15.10'da P (ilk hareketi 15.10; 25.10'da ikinci hareketi — ilk hareket İLK satırdır), 20.10'da Q (ilk hareketi 20.10) açılır; saat 03.11 10:00. */
async function start(extra = {}) {
  const ctx = await startWa({ now: { time: localIso(2026, 10, 15), fixed: true }, ...extra });
  const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
  ctx.clock.set(localIso(2026, 10, 20));
  const q = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
  ctx.clock.set(localIso(2026, 10, 25));
  await ok(await ctx.api.post(`/api/workspace/accounts/${p.id}/entries`, { kind: "debt", amount: "100", date: "2026-10-25", note: "Ek hizmet" }), "P'nin ikinci hareketi");
  ctx.clock.set(localIso(2026, 11, 3));
  return { ctx, p, q };
}
async function send(ctx, body, { error = null, drop = false } = {}) {
  if (error) for (const tel of ["+905334445566", "+905321112233"]) ctx.fake.state.recipientErrors[tel] = error;
  if (drop) ctx.fake.state.dropAfter = /\/messages$/;
  const o = await ok(await ctx.batch(body), "gönderim");
  await ctx.drain();
  ctx.fake.state.dropAfter = null;
  ctx.fake.state.recipientErrors = {};
  return ctx.jobs(o.batch.id);
}

describe("2.4.8 İş Q1 — 'Tüm Hareketler'in kişiye özel dönemi (ilk hareket – o gün) aynı tarihli özel aralıkla aynı dönem", () => {
  it("03.11 Tüm Hareketler P ve Q'ya → 05.11 özel 15.10–03.11: P 'Daha Önce Gönderildi' (iletideki dönem), Q 'gönderilecek' (Q'nun dönemi 20.10–03.11); 11.11 pencere dışı", async () => {
    const { ctx, p, q } = await start();
    try {
      const jobs = await send(ctx, tum([p.id, q.id]));
      assert.deepEqual(jobs.map(job => job.state), ["accepted", "accepted"], "ön koşul: kabul");
      assert.deepEqual(ctx.messages().map(item => item.params[2]), ["15.10.2026 – 03.11.2026", "20.10.2026 – 03.11.2026"], "ön koşul: iletideki kişiye özel dönem");
      ctx.clock.set(localIso(2026, 11, 5));
      assert.deepEqual(await previewSkip(ctx, custom([p.id, q.id], "2026-10-15", "2026-11-03"), "05.11 özel 15.10–03.11"), ["Daha Önce Gönderildi", "gönderilecek"], "kişi başına eşlik");
      assert.deepEqual(await previewSkip(ctx, custom([q.id], "2026-10-20", "2026-11-03"), "05.11 Q özel 20.10–03.11"), ["Daha Önce Gönderildi"], "Q kendi dönemiyle");
      ctx.clock.set(localIso(2026, 11, 11));
      assert.deepEqual(await previewSkip(ctx, custom([p.id], "2026-10-15", "2026-11-03"), "11.11 özel"), ["gönderilecek"], "seçimin 7 gün penceresi");
    } finally {
      await ctx.close();
    }
  });

  it("ters yön: 05.11 özel 15.10–05.11 P'ye gönderildi → aynı gün Tüm Hareketler 'Daha Önce Gönderildi' (Q gönderilecek); 06.11 Tüm (15.10–06.11) ayrı", async () => {
    const { ctx, p, q } = await start();
    try {
      ctx.clock.set(localIso(2026, 11, 5));
      assert.deepEqual((await send(ctx, custom([p.id], "2026-10-15", "2026-11-05"))).map(job => job.state), ["accepted"], "ön koşul: özel kabul");
      ctx.clock.set(localIso(2026, 11, 5, 18));
      assert.deepEqual(await previewSkip(ctx, tum([p.id, q.id]), "05.11 Tüm"), ["Daha Önce Gönderildi", "gönderilecek"], "aynı tarihler → aynı dönem, yalnız P");
      ctx.clock.set(localIso(2026, 11, 6));
      assert.deepEqual(await previewSkip(ctx, tum([p.id]), "06.11 Tüm"), ["gönderilecek"], "o günkü tarihler farklı → ayrı");
    } finally {
      await ctx.close();
    }
  });

  it("kişi başına süzme: Q'ya P'nin Tüm dönemiyle aynı tarihli özel aralık (15.10–05.11) gitti / belirsiz kaldı → 05.11 Tüm Hareketler'de Q elenmez (Q'nun dönemi 20.10–05.11)", async () => {
    const { ctx, p, q } = await start();
    try {
      ctx.clock.set(localIso(2026, 11, 5));
      assert.deepEqual((await send(ctx, custom([q.id], "2026-10-15", "2026-11-05"))).map(job => job.state), ["accepted"], "ön koşul: Q'ya özel kabul");
      ctx.clock.set(localIso(2026, 11, 5, 18));
      assert.deepEqual(await previewSkip(ctx, tum([p.id, q.id]), "05.11 Tüm (R3)"), ["gönderilecek", "gönderilecek"], "P'nin anahtarı Q'nun talebini eşlemez");
    } finally {
      await ctx.close();
    }
    const s = await start();
    try {
      s.ctx.clock.set(localIso(2026, 11, 5));
      assert.deepEqual((await send(s.ctx, custom([s.q.id], "2026-10-15", "2026-11-05"), { drop: true })).map(job => job.state), ["uncertain"], "ön koşul: Q'ya özel belirsiz");
      s.ctx.clock.set(localIso(2026, 11, 5, 18));
      assert.deepEqual(await previewSkip(s.ctx, tum([s.p.id, s.q.id]), "05.11 Tüm (belirsiz)"), ["gönderilecek", "gönderilecek"], "P'nin anahtarı Q'nun belirsiz talebini eşlemez");
    } finally {
      await s.ctx.close();
    }
  });

  it("b1b: aynı gün (Excel yükleme günü) açılmış 3 cariye 03.11 Tüm → 05.11 özel 15.10–03.11 toplu: üçü de elenir, ikinci ileti yok (önce 6 ileti)", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 10, 15), fixed: true } });
    try {
      const ids = [];
      for (const [name, tel] of [["Burak Kaya", "0533 444 55 66"], ["Ayşe Yılmaz", "0532 111 22 33"], ["Can Demir", "0535 222 33 44"]]) ids.push((await ctx.account(name, tel, 500)).id);
      ctx.clock.set(localIso(2026, 11, 3));
      await send(ctx, tum(ids));
      ctx.clock.set(localIso(2026, 11, 5));
      const res = await ctx.batch(custom(ids, "2026-10-15", "2026-11-03"));
      assert.equal(res.status, 400, `toplu iş açılmaz (geldi ${res.status} ${JSON.stringify(res.data)})`);
      assert.deepEqual(res.data.summary?.skipped, { "Daha Önce Gönderildi": 3 });
      const sendAgain = await ok(await ctx.batch({ ...custom(ids, "2026-10-15", "2026-11-03"), sendAgain: true }), "R3'te Yine de Gönder");
      await ctx.drain();
      assert.equal(sendAgain.summary.sendable, 3, "Yine de Gönder ile bilerek gider");
      assert.equal(ctx.messages().length, 6, "yalnız bilerek: 3 + 3");
    } finally {
      await ctx.close();
    }
  });

  // İş R6 (dar kontrol 12; ilke 3): BİLEREK DEĞİŞEN BEKLENTİ — önce "hareketsiz cari eşleşmez" (İş Q1 BAŞ MİMAR KARARI 8; GERİ ALINDI). Hareketsiz carinin kişiye özel
  // dönemi iletideki dönemle aynı: "<o gün> – <o gün>" (donem.mjs allPeriodStartOf).
  it("R6 hareketsiz cari: Tüm Hareketler (iletide 03.11 – 03.11) → 05.11 özel 03.11–03.11 'Daha Önce Gönderildi'; ters yön: özel 03.11–03.11 → aynı gün Tüm 'Daha Önce Gönderildi'", async () => {
    let ctx = await startWa({ now: { time: localIso(2026, 11, 3), fixed: true } });
    try {
      const r = await ctx.account("Hareketsiz Kişi", "0533 444 55 66");
      const jobs = await send(ctx, tum([r.id]));
      assert.deepEqual(jobs.map(job => job.state), ["accepted"], "ön koşul: kabul");
      assert.equal(ctx.messages().at(-1).params[2], "03.11.2026 – 03.11.2026", "ön koşul: iletideki dönem");
      ctx.clock.set(localIso(2026, 11, 5));
      assert.deepEqual(await previewSkip(ctx, custom([r.id], "2026-11-03", "2026-11-03"), "05.11 özel 03.11–03.11"), ["Daha Önce Gönderildi"]);
      assert.deepEqual(await previewSkip(ctx, custom([r.id], "2026-11-04", "2026-11-04"), "05.11 özel 04.11–04.11"), ["gönderilecek"], "başka gün ayrı");
    } finally {
      await ctx.close();
    }
    ctx = await startWa({ now: { time: localIso(2026, 11, 3), fixed: true } });
    try {
      const r = await ctx.account("Hareketsiz Kişi", "0533 444 55 66");
      assert.deepEqual((await send(ctx, custom([r.id], "2026-11-03", "2026-11-03"))).map(job => job.state), ["accepted"], "ön koşul: özel kabul");
      ctx.clock.set(localIso(2026, 11, 3, 18));
      assert.deepEqual(await previewSkip(ctx, tum([r.id]), "03.11 Tüm"), ["Daha Önce Gönderildi"], "ters yön");
    } finally {
      await ctx.close();
    }
  });

  it("Zaten Kuyrukta: Tüm işi sırada → aynı tarihli özel aralık 'Zaten Kuyrukta' (Q gönderilecek)", async () => {
    const s = await start();
    try {
      await send(s.ctx, tum([s.p.id]), { error: PAIR });
      assert.deepEqual(await previewSkip(s.ctx, custom([s.p.id, s.q.id], "2026-10-15", "2026-11-03"), "özel (Tüm sırada)"), ["Zaten Kuyrukta", "gönderilecek"]);
    } finally {
      await s.ctx.close();
    }
  });

  it("Zaten Kuyrukta ters yön: özel 15.10–03.11 işi sırada → aynı gün Tüm 'Zaten Kuyrukta' (Q gönderilecek)", async () => {
    const s = await start();
    try {
      await send(s.ctx, custom([s.p.id], "2026-10-15", "2026-11-03"), { error: PAIR });
      assert.deepEqual(await previewSkip(s.ctx, tum([s.p.id, s.q.id]), "Tüm (özel sırada)"), ["Zaten Kuyrukta", "gönderilecek"]);
    } finally {
      await s.ctx.close();
    }
  });

  it("Sonucu Belirsiz: Tüm belirsiz → ertesi gün aynı tarihli özel aralık 'Sonucu Belirsiz' (Q gönderilecek)", async () => {
    const s = await start();
    try {
      assert.deepEqual((await send(s.ctx, tum([s.p.id]), { drop: true })).map(job => job.state), ["uncertain"], "ön koşul: belirsiz");
      s.ctx.clock.set(localIso(2026, 11, 4));
      assert.deepEqual(await previewSkip(s.ctx, custom([s.p.id, s.q.id], "2026-10-15", "2026-11-03"), "özel (Tüm belirsiz)"), ["Sonucu Belirsiz", "gönderilecek"]);
    } finally {
      await s.ctx.close();
    }
  });

  it("taşınan veri (defter yok): eski bilgisayarda 03.11 Tüm P'ye kabul → yeni bilgisayarda 05.11 özel 15.10–03.11 'Daha Önce Gönderildi', Q 'gönderilecek'", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-q1-tasinan-"));
    const dataDir = path.join(root, "data");
    let s = await start({ dataDir });
    let ctx = s.ctx;
    try {
      await send(ctx, tum([s.p.id]));
      await ctx.close();
      ctx = null;
      const moved = path.join(root, "tasindi");
      cpSync(dataDir, moved, { recursive: true });
      for (const name of readdirSync(moved)) if (name.startsWith("whatsapp-gonderim.sqlite")) rmSync(path.join(moved, name), { force: true });
      ctx = await startWa({ now: { time: localIso(2026, 11, 5), fixed: true }, dataDir: moved, connect: false, ack: false });
      assert.deepEqual(await previewSkip(ctx, custom([s.p.id, s.q.id], "2026-10-15", "2026-11-03"), "taşınan veride özel"), ["Daha Önce Gönderildi", "gönderilecek"]);
    } finally {
      await ctx?.close();
      removeTestDir(root);
    }
  });

  // İş R5 (dar kontrol 12; İLKEYLE — ilke 3 + S1b + Q1): Tüm Hareketler'in kişiye özel dönemi o günün "Bu Ay"ına eşitse "Bu Ay" ile aynı dönem (iki yön); ilk hareketi
  // ay başında olmayan cari eşleşmez (kişi başına).
  async function monthStart(extra = {}) {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 1), fixed: true }, ...extra });
    const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800); // ilk hareketi 01.11
    ctx.clock.set(localIso(2026, 11, 2));
    const q = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500); // ilk hareketi 02.11
    return { ctx, p, q };
  }
  const buAy = ids => ({ kind: "statement", ids, preset: "thisMonth" });

  it("R5 A: 'Bu Ay' 02.11'de gitti → 03.11 Tüm Hareketler (P'nin dönemi 01.11–03.11 = o günün Bu Ay'ı) 'Daha Önce Gönderildi'; Q (02.11–03.11) gönderilecek", async () => {
    const { ctx, p, q } = await monthStart();
    try {
      assert.deepEqual((await send(ctx, buAy([p.id, q.id]))).map(job => job.state), ["accepted", "accepted"], "ön koşul: Bu Ay kabul");
      ctx.clock.set(localIso(2026, 11, 3));
      assert.deepEqual(await previewSkip(ctx, tum([p.id, q.id]), "03.11 Tüm"), ["Daha Önce Gönderildi", "gönderilecek"]);
    } finally {
      await ctx.close();
    }
  });

  it("R5 A2: Tüm Hareketler 02.11'de gitti (P: 01.11–02.11 = o günün Bu Ay'ı) → 03.11 'Bu Ay' P 'Daha Önce Gönderildi'; Q (02.11–02.11) gönderilecek", async () => {
    const { ctx, p, q } = await monthStart();
    try {
      assert.deepEqual((await send(ctx, tum([p.id, q.id]))).map(job => job.state), ["accepted", "accepted"], "ön koşul: Tüm kabul");
      ctx.clock.set(localIso(2026, 11, 3));
      assert.deepEqual(await previewSkip(ctx, buAy([p.id, q.id]), "03.11 Bu Ay"), ["Daha Önce Gönderildi", "gönderilecek"]);
    } finally {
      await ctx.close();
    }
  });

  it("R5 Zaten Kuyrukta iki yön: Bu Ay işi sırada → Tüm (P) 'Zaten Kuyrukta'; Tüm işi sırada → ertesi gün Bu Ay (P) 'Zaten Kuyrukta'", async () => {
    let s = await monthStart();
    try {
      s.ctx.clock.set(localIso(2026, 11, 3));
      await send(s.ctx, buAy([s.p.id]), { error: PAIR });
      assert.deepEqual(await previewSkip(s.ctx, tum([s.p.id, s.q.id]), "Tüm (Bu Ay sırada)"), ["Zaten Kuyrukta", "gönderilecek"]);
    } finally {
      await s.ctx.close();
    }
    s = await monthStart();
    try {
      await send(s.ctx, tum([s.p.id]), { error: PAIR });
      s.ctx.clock.set(localIso(2026, 11, 3));
      assert.deepEqual(await previewSkip(s.ctx, buAy([s.p.id, s.q.id]), "Bu Ay (Tüm sırada)"), ["Zaten Kuyrukta", "gönderilecek"]);
    } finally {
      await s.ctx.close();
    }
  });
});
