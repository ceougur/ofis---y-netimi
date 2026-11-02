// 2.4.8 dar kontrol 8 İş A — Meta Bekletti (131049; Meta teslim ETMEDİ) işin "Daha Önce Gönderildi" (R3) sayımı, geri yükleme / taşıma.
//   KULLANICI KARARI (31.10.2026 ~11:00 UTC "A", AYNEN): yedekten GERİ YÜKLEME ya da başka bilgisayara TAŞIMA ile durmuş Meta Bekletti ileti de (teslim edilmemiş,
//     yeniden denenmeyecek) "Daha Önce Gönderildi" SAYILMAZ — iptal kuralı aynen; geç teslim (delivered/read) gelirse SAYILIR.
//   DÜŞÜK-5: iptalden ÖNCEKİ yedek geri yüklenince dosyadaki iş "Durduruldu" olur; o işin kendi wamid'ine geç teslim yine uygulanır (iptaldeki gibi).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
// Zorla üretildi: dar kontrol 8 yoklaması p-sunucu.mjs s2.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD, removeTestDir } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const countTo = (ctx, tel = P_TEL) => ctx.messages().filter(item => item.to === tel).length;
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const ts = ctx => String(Math.floor(ctx.clock().getTime() / 1000));
const h131049 = (ctx, wamid, recipient = "905334445566") => ({
  id: wamid,
  status: "failed",
  timestamp: ts(ctx),
  recipient_id: recipient,
  errors: [{ code: 131049, title: "This message was not delivered to maintain healthy ecosystem engagement." }],
});

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

/** İkinci şirket (geri yükleme hemen uygulanır) + bağlantı + onay + P carisi; q: istek eki, queue(): o şirketin kuyruğu. */
async function secondCompany(ctx) {
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
  const s = {
    company,
    q,
    p,
    body,
    queue: () => queues.get(company.id),
    jobs: async id => (await ctx.api.get(`${URLS.batches}/${id}?${q}`)).data.data.jobs,
    preview: async extra => ok(await ctx.api.post(`${URLS.preview}?${q}`, { ...body, ...extra }), "önizleme"),
    statuses: list => s.queue().applyStatuses(list, { phoneNumberId: PNID }),
    stats: async () => (await ctx.api.get(`${URLS.stats}?${q}`)).data.data,
    backup: async () => (await ok(await ctx.api.post("/api/admin/backups", { scope: "one", companyId: company.id }), "yedek")).backups[0].name,
    restore: async name => ok(await ctx.api.post("/api/admin/backups/restore", { name, company: company.id, confirm: company.code, password: ADMIN_PASSWORD }), "geri yükleme"),
  };
  return s;
}

/** İkinci şirkette P'ye ekstre kabul → 131049 → Meta Bekletti (tek işlik toplu iş: "Tamamlandı" → 131049 yeniden açar). */
async function heldInSecond(ctx, s) {
  const o = await ok(await ctx.api.post(`${URLS.batches}?${s.q}`, s.body), "O");
  await ctx.drain();
  const pJob = (await s.jobs(o.batch.id))[0];
  assert.equal(pJob.state, "accepted", "ön koşul: P kabul");
  ctx.clock.advance(60_000);
  const hook = s.statuses([h131049(ctx, pJob.wamid)]);
  assert.equal(hook.applied, 1, `ön koşul: 131049 uygulandı (${JSON.stringify(hook)})`);
  assert.equal((await s.jobs(o.batch.id))[0].state, "held", "ön koşul: P Meta Bekletti");
  return { o, pJob };
}

describe("2.4.8 dar kontrol 8 İş A — geri yükleme / taşıma ile durmuş Meta Bekletti 'Daha Önce Gönderildi' sayılmaz; geç teslim sayılır", () => {
  it("Meta Bekletti → yedek → geri yükleme (İptal Et yok): toplu iş 'Durduruldu (Geri Yükleme)', P 'gönderilecek' ve yeni gönderim gider", async () => {
    const ctx = await startWa({ maxCompanies: 2, now: NOW });
    try {
      const s = await secondCompany(ctx);
      const { o } = await heldInSecond(ctx, s);
      const backup = await s.backup();
      ctx.clock.advance(60_000);
      await s.restore(backup);
      const state = ctx.server.app.whatsapp.ledger.batchState(o.batch.id);
      assert.deepEqual([state.stopped, state.reason], [true, "restored"], `ön koşul: defterde geri yüklemeyle durdu (${JSON.stringify(state)})`);
      assert.equal((await s.jobs(o.batch.id))[0].state, "stopped", "ön koşul: dosyadaki iş Durduruldu");
      ctx.clock.advance(60_000);
      const pv = await s.preview();
      assert.deepEqual(skipOf(pv), ["gönderilecek"], "geri yüklemeyle durmuş Meta Bekletti teslim edilmedi → P 'Daha Önce Gönderildi' DEĞİL (kullanıcı kararı A)");
      assert.equal(pv.alreadySent?.count, 0, `alreadySent 0 (geldi ${JSON.stringify(pv.alreadySent)})`);
      const before = countTo(ctx);
      const fresh = await ok(await ctx.api.post(`${URLS.batches}?${s.q}`, s.body), "yeni gönderim");
      await ctx.drain();
      assert.deepEqual((await s.jobs(fresh.batch.id)).map(job => job.state), ["accepted"], "yeni gönderim kabul");
      assert.equal(countTo(ctx), before + 1, "P'ye ileti gitti");
    } finally {
      await ctx.close();
    }
  });

  it("Meta Bekletti → yedek → geri yükleme → 1. denemenin wamid'ine geç 'delivered': uygulanır, P 'Daha Önce Gönderildi', Bu Ay 1", async () => {
    const ctx = await startWa({ maxCompanies: 2, now: NOW });
    try {
      const s = await secondCompany(ctx);
      const { o, pJob } = await heldInSecond(ctx, s);
      const backup = await s.backup();
      ctx.clock.advance(60_000);
      await s.restore(backup);
      assert.equal((await s.jobs(o.batch.id))[0].state, "stopped", "ön koşul: dosyadaki iş Durduruldu");
      ctx.clock.advance(60_000);
      const late = s.statuses([{ id: pJob.wamid, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566" }]);
      assert.equal(late.applied, 1, `geç teslim uygulandı (geldi ${JSON.stringify(late)})`);
      assert.equal((await s.jobs(o.batch.id))[0].state, "delivered", "iş Teslim Edildi");
      assert.deepEqual(skipOf(await s.preview()), ["Daha Önce Gönderildi"], "geç teslim → P sayılır");
      assert.equal((await s.stats()).delivered, 1, "Bu Ay Gönderilen İleti Sayısı 1");
    } finally {
      await ctx.close();
    }
  });

  it("DÜŞÜK-5: Meta Bekletti → yedek → İptal Et → iptalden ÖNCEKİ yedeğin geri yüklenmesi → geç 'delivered' uygulanır ve P sayılır", async () => {
    const ctx = await startWa({ maxCompanies: 2, now: NOW });
    try {
      const s = await secondCompany(ctx);
      const { o, pJob } = await heldInSecond(ctx, s);
      const backup = await s.backup();
      ctx.clock.advance(60_000);
      await ok(await ctx.api.post(`${URLS.batches}/${o.batch.id}/cancel?${s.q}`, {}), "İptal Et");
      assert.deepEqual(skipOf(await s.preview()), ["gönderilecek"], "ön koşul: iptal edilen Meta Bekletti sayılmaz (İş 5)");
      await s.restore(backup);
      assert.equal((await s.jobs(o.batch.id))[0].state, "stopped", "ön koşul: geri yüklenen dosyada iş Durduruldu (İptal değil)");
      assert.deepEqual(skipOf(await s.preview()), ["gönderilecek"], "geri yüklemeden sonra da sayılmaz");
      ctx.clock.advance(60_000);
      const late = s.statuses([{ id: pJob.wamid, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566" }]);
      assert.equal(late.applied, 1, `iptalden önceki yedek geri yüklendikten sonra geç teslim uygulandı (geldi ${JSON.stringify(late)})`);
      assert.equal((await s.jobs(o.batch.id))[0].state, "delivered", "iş Teslim Edildi");
      assert.deepEqual(skipOf(await s.preview()), ["Daha Önce Gönderildi"], "geç teslim → P sayılır");
      assert.equal((await s.stats()).delivered, 1, "Bu Ay Gönderilen İleti Sayısı 1");
    } finally {
      await ctx.close();
    }
  });

  it("Taşıma (doğrulama ★6): Meta Bekletti iş olan veri gönderim defteri OLMADAN başka bilgisayara taşınınca 'Taşınan Veri — Durduruldu' ve P 'gönderilecek'", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-dk8-tasima-"));
    const moved = mkdtempSync(path.join(tmpdir(), "destekofis-dk8-tasindi-"));
    const ctx = await startWa({ dataDir, now: NOW });
    const fake = ctx.fake;
    let other = null;
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const o = await ok(await ctx.batch(body), "O");
      await ctx.drain();
      const pJob = (await ctx.jobs(o.batch.id))[0];
      ctx.clock.advance(60_000);
      assert.equal(ctx.statuses([h131049(ctx, pJob.wamid)]).applied, 1, "ön koşul: 131049");
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["Zaten Kuyrukta"], "ön koşul: kaynak bilgisayarda iş kuyrukta");
      await ctx.server.close();
      cpSync(dataDir, moved, { recursive: true });
      for (const name of readdirSync(moved)) if (name.startsWith("whatsapp-gonderim.sqlite")) removeTestDir(path.join(moved, name));
      other = await startWa({ dataDir: moved, fake, connect: false, ack: false, now: { time: localIso(2026, 11, 3, 11), fixed: true } });
      const detail = await other.detail(o.batch.id);
      assert.deepEqual([detail.state, detail.pauseCode], ["stopped", "moved"], "ön koşul: Taşınan Veri — Durduruldu");
      const pv = await ok(await other.api.post(URLS.preview, body), "taşınan veride önizleme");
      assert.deepEqual(skipOf(pv), ["gönderilecek"], "taşınan veride Meta Bekletti P 'Daha Önce Gönderildi' DEĞİL");
    } finally {
      await other?.server.close();
      await fake.close();
      removeTestDir(dataDir);
      removeTestDir(moved);
    }
  });
});
