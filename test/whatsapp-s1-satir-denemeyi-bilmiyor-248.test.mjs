// 2.4.8 İş S1 (dar kontrol 13 DÜŞÜK; İLKEYLE ilke 1 "kesin ALMADIYSA sayılmaz … geri yükleme ile duran" + ilke 5): wamid defterde bu şirketin işinin SON denemesine bağlı
// ama şirket dosyasındaki satır o denemenin wamid'ini taşımıyor → geç bildirim (imzalı / imzasız) "unknown" düşüyordu; defter "accepted" kalıyor, kişi teslim edilmemiş
// iletiyle "Daha Önce Gönderildi" sayılıyordu. Şimdi: satır o denemede sonucunu yazmamışsa (Gönderiliyor / Sonucu Belirsiz, wamid'siz) bildirim satırı ilerletir;
// satır o denemeyi bilmiyorsa (geri yüklenmiş / durdurulmuş eski satır) yalnız defter. Koşullar (onay): istek Meta'dayken gelen bildirimi "Meta Kabul Etti" EZMEZ, çift
// ileti yok; satır daha YENİ denemedeyse eski denemenin "failed"ı hiçbir şey yapmaz; teslimden sonraki "failed" yok sayılır.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const ts = ctx => String(Math.floor(ctx.clock().getTime() / 1000));
async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

/** İkinci şirket (geri yükleme hemen uygulanır) + bağlantı + onay + P carisi. */
async function second(ctx) {
  const queues = new Map();
  const sch = ctx.server.app.whatsapp.scheduler;
  const reg = sch.register.bind(sch);
  sch.register = (key, queue) => {
    queues.set(String(key), queue);
    return reg(key, queue);
  };
  const created = await ok(await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
  const company = created.company || created;
  const q = `hofCompany=${encodeURIComponent(company.id)}`;
  await ok(await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "bağlantı");
  await ok(await ctx.api.put(`${URLS.ack}?${q}`, { ack: true }), "onay");
  const p = await ok(await ctx.api.post(`/api/workspace/accounts?${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" }), "cari");
  const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
  return {
    q,
    body,
    queue: () => queues.get(company.id),
    jobs: async id => (await ctx.api.get(`${URLS.batches}/${id}?${q}`)).data.data?.jobs || [],
    preview: async () => ok(await ctx.api.post(`${URLS.preview}?${q}`, body), "önizleme"),
    stats: async () => (await ctx.api.get(`${URLS.stats}?${q}`)).data.data,
    backup: async () => (await ok(await ctx.api.post("/api/admin/backups", { scope: "one", companyId: company.id }), "yedek")).backups[0].name,
    restore: async name => ok(await ctx.api.post("/api/admin/backups/restore", { name, company: company.id, confirm: company.code, password: ADMIN_PASSWORD }), "geri yükleme"),
  };
}

/** when: "bekliyor" (yedek iş Bekliyor'dayken) | "bekletti" (yedek Meta Bekletti'deyken; 2. deneme kabul). Geri yükleme sonrası: { s, job, wamid, batchId }. */
async function restoredStale(ctx, when) {
  const s = await second(ctx);
  const o = await ok(await ctx.api.post(`${URLS.batches}?${s.q}`, s.body), "toplu iş");
  let backup = when === "bekliyor" ? await s.backup() : null;
  await ctx.drain();
  let job = (await s.jobs(o.batch.id))[0];
  if (when === "bekletti") {
    ctx.clock.advance(60_000);
    s.queue().applyStatuses([{ id: job.wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }], { phoneNumberId: PNID });
    backup = await s.backup();
    ctx.clock.advance(24 * HOUR + 60_000);
    await ctx.drain();
    job = (await s.jobs(o.batch.id))[0];
    assert.deepEqual([job.attempt, job.state], [2, "accepted"], "ön koşul: 2. deneme kabul");
  }
  assert.equal(job.state, "accepted", "ön koşul: kabul");
  ctx.clock.advance(60_000);
  await s.restore(backup);
  const stale = (await s.jobs(o.batch.id))[0];
  assert.notEqual(stale.wamid, job.wamid, `ön koşul: geri yüklenen satır o denemenin wamid'ini bilmiyor (${stale.state}:${stale.attempt}:${stale.wamid})`);
  ctx.clock.advance(60_000);
  return { s, job, wamid: job.wamid, batchId: o.batch.id, stale };
}

describe("2.4.8 İş S1 — satır o denemeyi bilmiyorken geç bildirim", () => {
  for (const [when, signed] of [["bekliyor", false], ["bekliyor", true], ["bekletti", false], ["bekletti", true]]) {
    it(`(${when === "bekliyor" ? "a" : "a2"}) yedek ${when === "bekliyor" ? "iş Bekliyor'dayken" : "Meta Bekletti'deyken"} → kabul → geri yükleme → ${signed ? "imzalı" : "imzasız"} failed → teslim edilemedi, kişi elenmez, eski satır değişmez`, { timeout: 120_000 }, async () => {
      const ctx = await startWa({ maxCompanies: 2, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
      try {
        const { s, job, wamid, batchId, stale } = await restoredStale(ctx, when);
        const status = { id: wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131026, title: "Message undeliverable" }], ...(signed ? { biz_opaque_callback_data: job.id } : {}) };
        const hook = s.queue().applyStatuses([status], { phoneNumberId: PNID, signed });
        assert.equal(hook.applied, 1, `geç failed uygulandı (geldi ${JSON.stringify(hook)})`);
        assert.equal(ctx.server.app.whatsapp.ledger.attempts(job.id).at(-1).outcome, "failed", "defterde teslim edilemedi");
        assert.deepEqual(skipOf(await s.preview()), ["gönderilecek"], "kişi elenmez");
        const after = (await s.jobs(batchId))[0];
        assert.deepEqual([after.state, after.attempt, after.wamid], [stale.state, stale.attempt, stale.wamid], "geri yüklenen eski satıra dokunulmadı");
        const sent = ctx.messages().length;
        await ok(await ctx.api.post(`${URLS.batches}?${s.q}`, s.body), "yeni gönderim");
        await ctx.drain();
        assert.equal(ctx.messages().length, sent + 1, "yeni gönderim gitti");
      } finally {
        await ctx.close();
      }
    });
  }

  it("(a) delivered imzasız → Bu Ay Gönderilen 1, kişi Daha Önce Gönderildi; sonra gelen failed yok sayılır (§7a 18)", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ maxCompanies: 2, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const { s, job, wamid } = await restoredStale(ctx, "bekliyor");
      const hook = s.queue().applyStatuses([{ id: wamid, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566" }], { phoneNumberId: PNID });
      assert.equal(hook.applied, 1, `geç teslim uygulandı (geldi ${JSON.stringify(hook)})`);
      assert.equal((await s.stats()).delivered, 1, "Bu Ay Gönderilen 1");
      assert.deepEqual(skipOf(await s.preview()), ["Daha Önce Gönderildi"]);
      const late = s.queue().applyStatuses([{ id: wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131026, title: "x" }] }], { phoneNumberId: PNID });
      assert.equal(late.applied, 0, "teslimden sonraki failed uygulanmaz");
      assert.equal(ctx.server.app.whatsapp.ledger.attempts(job.id).at(-1).outcome, "accepted", "defter teslim edilemedi yazmadı");
    } finally {
      await ctx.close();
    }
  });

  for (const signed of [false, true]) {
    it(`(b) aynı bilgisayar: kabul dosyaya yazılamadı (Gönderiliyor) → ${signed ? "imzalı" : "imzasız"} failed 131026 → iş Başarısız, kişi elenmez; bakım sonra Meta Kabul Etti YAPMAZ`, { timeout: 120_000 }, async () => {
      let fail = true;
      const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true }, whatsappFault: point => fail && point === "db-accept" });
      try {
        const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
        const o = await ok(await ctx.batch(body), "gönderim");
        await ctx.wa.scheduler.runOnce();
        fail = false;
        const stuck = (await ctx.jobs(o.batch.id))[0];
        assert.deepEqual([stuck.state, stuck.wamid || ""], ["sending", ""], "ön koşul: kabul dosyaya yazılamadı");
        const wamid = ctx.messages().at(-1).wamid;
        ctx.clock.advance(60_000);
        const hook = ctx.statuses([{ id: wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131026, title: "Message undeliverable" }], ...(signed ? { biz_opaque_callback_data: stuck.id } : {}) }], { signed });
        assert.equal(hook.applied, 1, `bildirim uygulandı (geldi ${JSON.stringify(hook)})`);
        ctx.clock.advance(10 * 60_000);
        await ctx.wa.scheduler.maintain();
        const after = (await ctx.jobs(o.batch.id))[0];
        assert.deepEqual([after.state, after.wamid], ["failed", wamid], "iş Başarısız (bakım Meta Kabul Etti yapmadı)");
        assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["gönderilecek"]);
      } finally {
        await ctx.close();
      }
    });
  }

  // İş T A3 (K6; ders 28 — BİLEREK DEĞİŞEN BEKLENTİ, önce "accepted_at bildirimin anı"): satır kolunda accepted_at o denemenin DEFTERDEKİ kabul anı (R4 ile tek kural).
  it("(b) imzasız delivered → iş Teslim Edildi, accepted_at defterdeki kabul anı (R4/K6), Bu Ay 1", { timeout: 120_000 }, async () => {
    let fail = true;
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true }, whatsappFault: point => fail && point === "db-accept" });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const o = await ok(await ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" }), "gönderim");
      await ctx.wa.scheduler.runOnce();
      fail = false;
      const wamid = ctx.messages().at(-1).wamid;
      ctx.clock.advance(60_000);
      const reader = new DatabaseSync(ctx.wa.ledger.file, { readOnly: true });
      let acceptedAt;
      try {
        acceptedAt = reader.prepare("SELECT at FROM outcomes WHERE outcome = 'accepted' AND wamid = ?").get(wamid)?.at;
      } finally {
        reader.close();
      }
      assert.ok(acceptedAt, "ön koşul: defterde eşzamanlı kabul");
      assert.equal(ctx.statuses([{ id: wamid, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566" }]).applied, 1, "uygulandı");
      const after = (await ctx.jobs(o.batch.id))[0];
      assert.deepEqual([after.state, after.acceptedAt], ["delivered", acceptedAt], "accepted_at defterdeki kabul anı (bildirimin anı değil)");
      assert.equal((await ctx.api.get(URLS.stats)).data.data.delivered, 1, "Bu Ay 1");
    } finally {
      await ctx.close();
    }
  });

  it("koşul (a): istek Meta'dayken imzalı bildirim işi Teslim Edildi yaptı → yanıt gelince 'Meta Kabul Etti' EZMEZ, çift ileti yok", { timeout: 120_000 }, async () => {
    // 2.5.0 WhatsApp tur 3 (kırılgan kalıp — KAYIT 06.11 16:10; T16 / T35r yöntemi, ders 20): "istek Meta'dayken" ön koşulu sahte Meta gecikmesiyle (400 ms) + istemci süre sınırıyla
    // (800 ms) DEĞİL, KAPIYLA kurulur; süre sınırı kapıdan uzun (60 sn). Yanıtın gerçekten geldiği defterden okunur (zaman aşımı bu hücrenin konusu değil).
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true }, whatsappTimeoutMs: 60_000 });
    let release = () => {};
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const o = await ok(await ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" }), "gönderim");
      const wamid = `wamid.SAHTE${String(ctx.fake.state.sent + 1).padStart(4, "0")}`;
      ctx.fake.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
      const turn = ctx.wa.scheduler.runOnce();
      for (let i = 0; i < 2_000 && !ctx.fake.state.held; i += 1) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(ctx.fake.state.held, 1, "ön koşul: istek Meta'da (yanıt kapıda)");
      const job = ctx.store.get("SELECT id, state, attempt FROM wa_jobs WHERE batch_id = ?", o.batch.id);
      assert.equal(job.state, "sending", "ön koşul: istek Meta'da");
      const hook = ctx.statuses([{ id: wamid, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566", biz_opaque_callback_data: job.id }], { signed: true });
      assert.equal(hook.applied, 1, "bildirim istek sürerken uygulandı");
      assert.equal(ctx.fake.state.held, 1, "ön koşul: bildirim uygulandığında yanıt henüz gelmedi");
      ctx.fake.state.hold = null;
      release();
      await turn;
      const reader = new DatabaseSync(ctx.wa.ledger.file, { readOnly: true });
      try {
        assert.equal(reader.prepare("SELECT outcome FROM outcomes WHERE job_id = ? AND attempt = ?").get(job.id, job.attempt)?.outcome, "accepted", "ileti isteği Meta'nın yanıtıyla sonuçlandı (zaman aşımı değil)");
      } finally {
        reader.close();
      }
      const after = (await ctx.jobs(o.batch.id))[0];
      assert.deepEqual([after.state, after.wamid], ["delivered", wamid], "durum geriye gitmedi (Meta Kabul Etti ezmedi)");
      await ctx.drain();
      assert.equal(ctx.messages().filter(item => item.to === P_TEL).length, 1, "çift ileti yok");
    } finally {
      await ctx.close();
    }
  });

  it("koşul (b): satır daha YENİ denemedeyse eski denemenin failed'ı hiçbir şey yapmaz (131049 → 2. deneme istek Meta'da)", { timeout: 120_000 }, async () => {
    // 2.5.0 WhatsApp tur 3 (kırılgan kalıp — aynı tarama; KAYIT 06.11 16:10 listesinin kalıbı): "2. deneme istek Meta'da" ön koşulu yanıtsız istek (hang) + 800 ms süre sınırıyla
    // kuruluyordu — denetimler süre dolmadan bitmezse (yüklü makine) satır Sonucu Belirsiz olur, "satır değişmedi" denetimi yanlış kırmızı verirdi. Artık KAPI (yanıt kapıda) + 60 sn.
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true }, whatsappTimeoutMs: 60_000 });
    let release = () => {};
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const o = await ok(await ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" }), "gönderim");
      await ctx.drain();
      const first = (await ctx.jobs(o.batch.id))[0];
      ctx.clock.advance(60_000);
      ctx.statuses([{ id: first.wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]);
      ctx.clock.advance(24 * HOUR + 60_000);
      ctx.fake.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
      const turn = ctx.wa.scheduler.runOnce();
      for (let i = 0; i < 2_000 && !ctx.fake.state.held; i += 1) await new Promise(resolve => setTimeout(resolve, 10));
      const row = ctx.store.get("SELECT state, attempt FROM wa_jobs WHERE batch_id = ?", o.batch.id);
      assert.deepEqual([ctx.fake.state.held, row.attempt, row.state], [1, 2, "sending"], "ön koşul: 2. deneme istek Meta'da (yanıt kapıda)");
      for (const signed of [false, true]) {
        const hook = ctx.statuses([{ id: first.wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131026, title: "x" }], ...(signed ? { biz_opaque_callback_data: first.id } : {}) }], { signed });
        assert.equal(hook.applied, 0, `${signed ? "imzalı" : "imzasız"} eski deneme failed uygulanmadı (geldi ${JSON.stringify(hook)})`);
      }
      const now = ctx.store.get("SELECT state, attempt FROM wa_jobs WHERE batch_id = ?", o.batch.id);
      assert.deepEqual([now.attempt, now.state], [2, "sending"], "satır değişmedi");
      assert.deepEqual(ctx.server.app.whatsapp.ledger.attempts(first.id).map(item => item.outcome), ["released", null], "defter değişmedi");
      ctx.fake.state.hold = null;
      release();
      await turn.catch(() => {});
    } finally {
      ctx.fake.state.hold = null;
      release();
      await ctx.close().catch(() => {});
    }
  });
});
