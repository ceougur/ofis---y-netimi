// 2.4.8 İş P1 (KULLANICI İSTEĞİ "2.5.0'a bırakmayalım"): şirket dosyası başka bir süreçte kilitliyken ARKA PLAN işleri olay döngüsünü tutmaz — turun başında kısa
// sınama (store.probeWritable, 150 ms) kilidi görür, şirket bellekte "kilitli" işaretlenir, o tur yazım yok. KULLANICI istekleri bugünkü 10 sn beklemeyi KORUR (sınama
// busy_timeout'u finally'de geri alır): kilit 2 sn sürerken kullanıcının yazımı bekler ve 200 alır.
// Değişmeyen: kilit kalkınca bekleyen iş gider, çift ileti yok; tur içinde başlayan kilit (İş N/O) test/whatsapp-dk11-kilit-248.test.mjs ve dk12'de.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); kilit ayrı bağlantıyla ya da ayrı iş parçacığında (gerçek SQLite kilidi; gerçek saat).
// İş P2: işçi kilidi gördüyse (son sınama) SÜREN toplu işin görünümünde (ayrıntı + liste) kullanıcının cümlesi "lockNote"; işaret konunca ve kalkınca canlı olay; duraklatılmış işte not yok.
// Dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

describe("2.4.8 İş P1 — kilitli şirket dosyasında arka plan işleri olay döngüsünü tutmaz", () => {
  it("kilitliyken işçi turları ≤ 1 sn (önce ~10 sn), ileti gitmez; kilit kalkınca (işaret süresi sonra) iş gider, çift ileti yok", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ now: NOW, __testWriteLockBackoffMs: 300 });
    let lock = null;
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const created = await ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const id = created.data.data.batch.id;
      lock = new DatabaseSync(ctx.server.app.config.dbPath);
      lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
      const turns = [];
      for (let i = 0; i < 3; i += 1) {
        const t0 = Date.now();
        await ctx.wa.scheduler.runOnce();
        turns.push(Date.now() - t0);
        await wait(350); // işaret süresi (300 ms) dolsun: her turda yeniden kısa sınama
      }
      assert.equal(ctx.messages().length, 0, "kilit sürerken ileti gitmedi");
      assert.ok(turns.every(ms => ms <= 1_000), `kilitliyken her işçi turu ≤ 1 sn (turlar ${JSON.stringify(turns)} ms)`);
      lock.exec("ROLLBACK");
      lock.close();
      lock = null;
      await wait(350);
      await ctx.drain();
      const detail = (await ctx.api.get(`${URLS.batches}/${id}`)).data.data;
      assert.deepEqual(detail.jobs.map(job => job.state), ["accepted"], "kilit kalkınca iş gitti");
      assert.equal(ctx.messages().filter(item => item.to === "+905334445566").length, 1, "çift ileti yok");
    } finally {
      try {
        lock?.exec("ROLLBACK");
        lock?.close();
      } catch {
        // kilit zaten kalktı
      }
      await ctx.close();
    }
  });

  it("c2: makine defteri (whatsapp-gonderim.sqlite) kilitliyken de işçi turları ≤ 1 sn, ileti gitmez; kilit kalkınca iş gider, çift ileti yok", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ now: NOW, __testWriteLockBackoffMs: 300 });
    let lock = null;
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const created = await ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const id = created.data.data.batch.id;
      lock = new DatabaseSync(ctx.wa.ledger.file);
      lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
      const turns = [];
      for (let i = 0; i < 3; i += 1) {
        const t0 = Date.now();
        await ctx.wa.scheduler.runOnce();
        turns.push(Date.now() - t0);
        await wait(350);
      }
      assert.equal(ctx.messages().length, 0, "defter kilitliyken ileti gitmedi");
      assert.ok(turns.every(ms => ms <= 1_000), `defter kilitliyken her işçi turu ≤ 1 sn (turlar ${JSON.stringify(turns)} ms)`);
      lock.exec("ROLLBACK");
      lock.close();
      lock = null;
      await wait(350);
      await ctx.drain();
      for (let i = 0; i < 3 && ctx.messages().length === 0; i += 1) {
        ctx.clock.advance(60_000);
        await ctx.drain();
      }
      const detail = (await ctx.api.get(`${URLS.batches}/${id}`)).data.data;
      assert.deepEqual(detail.jobs.map(job => job.state), ["accepted"], "kilit kalkınca iş gitti");
      assert.equal(ctx.messages().filter(item => item.to === "+905334445566").length, 1, "çift ileti yok");
    } finally {
      try {
        lock?.exec("ROLLBACK");
        lock?.close();
      } catch {
        // kilit zaten kalktı
      }
      await ctx.close();
    }
  });

  it("kullanıcı yazımı bugünkü beklemeyi korur: arka plan sınamasından SONRA dosya ayrı iş parçacığında 2 sn kilitliyken cari açma bekler ve 200 alır", { timeout: 60_000 }, async () => {
    const ctx = await startWa({ now: NOW });
    try {
      await ctx.wa.scheduler.runOnce(); // kilitsiz tur: kısa sınama çalıştı (busy_timeout geri alınmış olmalı)
      const worker = new Worker(path.join(HERE, "fixtures", "sqlite-kilit-isci.mjs"), { workerData: { file: ctx.server.app.config.dbPath, ms: 2_000 } });
      const exited = new Promise(resolve => worker.once("exit", resolve));
      await new Promise((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
      });
      const t0 = Date.now();
      const res = await ctx.api.post("/api/workspace/accounts", { name: "Kilitte Cari", phone: "0533 444 55 67" });
      const ms = Date.now() - t0;
      await exited;
      assert.equal(res.status, 200, `kullanıcı yazımı kilit kalkınca tamamlandı (geldi ${res.status} ${JSON.stringify(res.data)})`);
      assert.ok(ms >= 1_000, `yazım kilidi bekledi (${ms} ms) — busy_timeout kısa kalmadı`);
    } finally {
      await ctx.close();
    }
  });
});

const LOCK_NOTE = "Şirket dosyası başka bir program tarafından kullanılıyor; gönderim bekliyor.";
describe("2.4.8 İş P2 — kilitte ekranda neden", () => {
  it("işçi kilidi görünce süren toplu işin ayrıntısında ve listede not; konunca ve kalkınca canlı olay; kilit kalkıp işaret süresi dolunca not kalkar; duraklatılmış işte not yok", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ now: NOW, __testWriteLockBackoffMs: 300 });
    let lock = null;
    const events = ctx.server.app.context.events;
    const publish = events.publish;
    const seen = [];
    events.publish = (event, data, ...rest) => {
      if (event === "whatsapp.changed" && data && "lock" in data) seen.push(data.lock);
      return publish.call(events, event, data, ...rest);
    };
    try {
      const a = await ctx.account("Not Bir", "0533 444 55 71", 800);
      const b = await ctx.account("Not İki", "0533 444 55 72", 900);
      const run = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      const held = (await ctx.batch({ kind: "statement", ids: [b.id], preset: "lastMonth" })).data.data.batch.id;
      assert.equal((await ctx.api.post(`${URLS.batches}/${held}/pause`, {})).status, 200, "ön koşul: ikinci iş duraklatıldı");
      const note = async id => (await ctx.api.get(`${URLS.batches}/${id}`)).data.data.lockNote;
      const listNotes = async () => Object.fromEntries((await ctx.api.get(URLS.batches)).data.data.map(item => [item.id, item.lockNote]));
      assert.ok(!(await note(run)), "kilitsizde not yok");
      lock = new DatabaseSync(ctx.server.app.config.dbPath);
      lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
      await ctx.wa.scheduler.runOnce();
      assert.equal(ctx.messages().length, 0, "ön koşul: kilitte ileti gitmedi");
      assert.equal(await note(run), LOCK_NOTE, "süren işin ayrıntısında not");
      assert.deepEqual(await listNotes(), { [run]: LOCK_NOTE, [held]: null }, "listede süren işte not, duraklatılmışta yok");
      assert.deepEqual(seen.map(Boolean), [true], "işaret konunca canlı olay");
      await wait(350); // işaret süresi (300 ms) doldu, işçi henüz yeniden sınamadı: not sönmez (kalıcı kilitte yanıp sönme yok)
      assert.equal(await note(run), LOCK_NOTE, "işaret süresi dolunca da (işçi yeniden sınayana dek) not durur");
      lock.exec("ROLLBACK");
      lock.close();
      lock = null;
      await wait(350);
      await ctx.wa.scheduler.runOnce();
      assert.deepEqual(seen.map(Boolean), [true, false], "işaret kalkınca canlı olay");
      await ctx.drain();
      assert.ok(!(await note(run)), "kilit kalkınca not kalktı");
      assert.equal(ctx.messages().length, 1, "iş gitti");
    } finally {
      events.publish = publish;
      try {
        lock?.exec("ROLLBACK");
        lock?.close();
      } catch {
        // kilit zaten kalktı
      }
      await ctx.close();
    }
  });
});

// İş R3 (dar kontrol 12; KARAR Y1 5 dk yetkisiyle, Y2): makine defteri kilidinde ekranda / listede / canlı olayda defter cümlesi; kalıcı kilitte not sürekli, toplu iş Sürüyor;
// iki kilit birden → şirket cümlesi; Duraklatıldı işte not yok; tur içinde başlayan defter kilidi (talep anı) de defter cümlesi (deferLocal "Şirket dosyası" demez).
const LEDGER_NOTE = "WhatsApp gönderim defteri başka bir program tarafından kullanılıyor; gönderim bekliyor.";
function spyLock(ctx) {
  const events = ctx.server.app.context.events;
  const publish = events.publish;
  const seen = [];
  events.publish = (event, data, ...rest) => {
    if (event === "whatsapp.changed" && data && "lock" in data) seen.push(data.lock);
    return publish.call(events, event, data, ...rest);
  };
  return { seen, restore: () => (events.publish = publish) };
}
const exclusive = file => {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
  return () => {
    try {
      db.exec("ROLLBACK");
      db.close();
    } catch {
      // zaten kalktı
    }
  };
};
describe("2.4.8 İş R3 — makine defteri kilidinde ekranda neden", () => {
  it("kalıcı defter kilidi: ayrıntı + liste + canlı olay defter cümlesi; 6 turda not sürekli, toplu iş Sürüyor, ileti yok; kilit kalkınca not kalkar, tek ileti", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ now: NOW, __testWriteLockBackoffMs: 300 });
    const spy = spyLock(ctx);
    let release = null;
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const id = (await ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" })).data.data.batch.id;
      release = exclusive(ctx.wa.ledger.file);
      const notes = [];
      for (let i = 0; i < 6; i += 1) {
        await ctx.wa.scheduler.runOnce();
        const view = (await ctx.api.get(`${URLS.batches}/${id}`)).data.data;
        const listed = (await ctx.api.get(URLS.batches)).data.data.find(item => item.id === id);
        notes.push([view.state, view.lockNote, listed?.lockNote]);
        ctx.clock.advance(60_000);
        await wait(350);
      }
      assert.ok(notes.every(([state, a, b]) => state === "running" && a === LEDGER_NOTE && b === LEDGER_NOTE), `her turda Sürüyor + defter cümlesi (ayrıntı ve liste) (geldi ${JSON.stringify(notes)})`);
      assert.deepEqual(spy.seen, ["ledger"], "canlı olay bir kez (defter)");
      assert.equal(ctx.messages().length, 0, "kilitte ileti yok");
      release();
      release = null;
      await wait(350);
      await ctx.wa.scheduler.runOnce();
      assert.deepEqual(spy.seen, ["ledger", null], "kilit kalkınca canlı olay");
      await ctx.drain();
      const view = (await ctx.api.get(`${URLS.batches}/${id}`)).data.data;
      assert.ok(!view.lockNote, "not kalktı");
      assert.equal(ctx.messages().length, 1, "tek ileti");
    } finally {
      spy.restore();
      release?.();
      await ctx.close();
    }
  });

  it("iki kilit birden → şirket cümlesi (defter önce kilitlenmiş olsa da); Duraklatıldı işte not yok", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ now: NOW, __testWriteLockBackoffMs: 5_000 });
    const releases = [];
    try {
      const a = await ctx.account("Not Bir", "0533 444 55 71", 800);
      const b = await ctx.account("Not İki", "0533 444 55 72", 900);
      const run = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      const held = (await ctx.batch({ kind: "statement", ids: [b.id], preset: "lastMonth" })).data.data.batch.id;
      assert.equal((await ctx.api.post(`${URLS.batches}/${held}/pause`, {})).status, 200, "ön koşul: duraklatıldı");
      releases.push(exclusive(ctx.wa.ledger.file));
      await ctx.wa.scheduler.runOnce();
      const notesOf = async () => Object.fromEntries((await ctx.api.get(URLS.batches)).data.data.map(item => [item.id, item.lockNote || null]));
      assert.deepEqual(await notesOf(), { [run]: LEDGER_NOTE, [held]: null }, "defter kilidi: süren işte defter cümlesi, duraklatılmışta yok");
      // Defter işareti SÜRERKEN (5 sn) şirket dosyası da kilitlenir: işçinin sınaması şirketi de işaretler → iki işaret birden.
      releases.push(exclusive(ctx.server.app.config.dbPath));
      await ctx.wa.scheduler.runOnce();
      assert.deepEqual(await notesOf(), { [run]: "Şirket dosyası başka bir program tarafından kullanılıyor; gönderim bekliyor.", [held]: null }, "iki kilit: şirket cümlesi");
    } finally {
      for (const release of releases.reverse()) release();
      await ctx.close();
    }
  });

  it("defter kilidi tur İÇİNDE (talep anında) başlar → iş Bekliyor, not defter cümlesi (şirket cümlesi değil)", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ now: NOW, __testWriteLockProbe: false, __testWriteLockBackoffMs: 60_000 });
    let release = null;
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const id = (await ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" })).data.data.batch.id;
      release = exclusive(ctx.wa.ledger.file);
      await ctx.wa.scheduler.runOnce();
      const view = (await ctx.api.get(`${URLS.batches}/${id}`)).data.data;
      assert.equal(ctx.messages().length, 0, "talep yazılamadı → istek gitmedi");
      assert.deepEqual([view.jobs[0].state, view.lockNote], ["pending", LEDGER_NOTE], `iş Bekliyor + defter cümlesi (geldi ${JSON.stringify([view.jobs[0].state, view.lockNote])})`);
    } finally {
      release?.();
      await ctx.close();
    }
  });
});
