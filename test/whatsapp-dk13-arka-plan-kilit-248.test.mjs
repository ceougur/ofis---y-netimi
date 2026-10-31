// 2.4.8 İş P1 (KULLANICI İSTEĞİ "2.5.0'a bırakmayalım"): şirket dosyası başka bir süreçte kilitliyken ARKA PLAN işleri olay döngüsünü tutmaz — turun başında kısa
// sınama (store.probeWritable, 150 ms) kilidi görür, şirket bellekte "kilitli" işaretlenir, o tur yazım yok. KULLANICI istekleri bugünkü 10 sn beklemeyi KORUR (sınama
// busy_timeout'u finally'de geri alır): kilit 2 sn sürerken kullanıcının yazımı bekler ve 200 alır.
// Değişmeyen: kilit kalkınca bekleyen iş gider, çift ileti yok; tur içinde başlayan kilit (İş N/O) test/whatsapp-dk11-kilit-248.test.mjs ve dk12'de.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); kilit ayrı bağlantıyla ya da ayrı iş parçacığında (gerçek SQLite kilidi; gerçek saat).
// İş P2: kilit işaretliyken SÜREN toplu işin görünümünde (ayrıntı + liste) kullanıcının cümlesi "lockNote"; işaret konunca ve kalkınca canlı olay; duraklatılmış işte not yok.
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
      assert.deepEqual(seen, [true], "işaret konunca canlı olay");
      lock.exec("ROLLBACK");
      lock.close();
      lock = null;
      await wait(350);
      await ctx.wa.scheduler.runOnce();
      assert.deepEqual(seen, [true, false], "işaret kalkınca canlı olay");
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
