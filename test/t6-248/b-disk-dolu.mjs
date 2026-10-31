// T6 (b) — DİSK DOLU. GERÇEK disk dolu: programın veri klasörü küçük bir tmpfs'te (kök kullanıcı; mount -t tmpfs), toplu gönderim sürerken klasör bir dolgu dosyasıyla
// TAMAMEN doldurulur (ENOSPC / SQLITE_FULL). Dolum anı sahte Meta'nın isteği tuttuğu sürenin İÇİNE denk getirilir (ders 20: ön koşul zorla): b1 ilk PDF yüklemesi
// Meta'dayken (yükleme yanıtından SONRAKİ yazım düşer), b2 ilk Meta okuması (şablon) Meta'dayken (PDF'in dondurulması düşer). Dolu disk 20 sn izlenir (kaç PDF
// yüklendi, kaç ileti isteği gitti, işçi kaç kez hata verdi), sonra yer açılır ve 30 sn izlenir (toparlanma, çift ileti).
// b3 ZORLA (T2 kuşkusu: "PDF'ten sonraki yazımda hata olursa her turda Meta'ya yeni PDF yükler"): aynı program süreç İÇİNDE, şirket dosyasının yazım işlevi yalnız
// "UPDATE wa_jobs SET media_id" yazımında SQLITE_FULL atar (ürün kodu DEĞİŞMEZ; yalnız sınanan yazım düşer) — gerçek tmpfs bu tek yazımı her koşuda
// seçemediği için. Sayılar sahte Meta'nın istek kaydından.
import assert from "node:assert/strict";
import { closeSync, openSync, unlinkSync, writeSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { startWa } from "../whatsapp-248-ortak.mjs";
import { account, companyDb, fakeMeta, freeBytes, freshDir, jobStates, mediaReqs, messageReqs, mountTmpfs, perRecipient, phoneOf, query, rmrf, startChild, until, wait } from "./ortak.mjs";

const N = 4;
/** Klasörü TAMAMEN doldurur (ENOSPC gelene dek 1 MB, sonra 4 KB parçalar). */
function fill(file) {
  const fd = openSync(file, "a");
  try {
    for (const size of [1 << 20, 4096, 512]) {
      const chunk = Buffer.alloc(size);
      try {
        for (;;) writeSync(fd, chunk);
      } catch (error) {
        if (error.code !== "ENOSPC") throw error;
      }
    }
  } finally {
    closeSync(fd);
  }
}
const workerErrors = log => (log.match(/WhatsApp işçisi \(.*?\) hata verdi/g) || []).length;
const ledgerWarn = log => (log.match(/gönderim defteri yazılamadı/g) || []).length;

async function gercekDolu(label, holdMatch) {
  const root = freshDir(`b-${label}`);
  const dataDir = path.join(root, "data");
  const umount = mountTmpfs(dataDir, "48m");
  const backupDir = path.join(root, "backups");
  const fake = await fakeMeta();
  let prog = null;
  const filler = path.join(dataDir, "dolgu.bin");
  const r = { label };
  try {
    prog = await startChild({ dataDir, backupDir, fake, kur: true, gapMs: 200 });
    const ids = [];
    for (let i = 0; i < N; i += 1) ids.push((await account(prog.api, `Disk ${label} ${i}`, phoneOf(7000 + i), 50 + i)).id);
    r.bosYerBaslangic = freeBytes(dataDir);
    fake.state.delayMs = 1500; // her istek 1,5 sn Meta'da tutulur → dolum isteğin İÇİNE düşer
    const created = await prog.api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids, preset: "thisMonth", requestId: `t6b-${label}-0000001` });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const batchId = created.data.data.batch.id;
    await until(() => fake.requests.some(item => holdMatch.test(`${item.method} ${item.path}`)), 30_000, `${holdMatch} Meta'da`);
    fill(filler);
    r.dolumdanSonraBosYer = freeBytes(dataDir);
    r.dolumAni = { medya: mediaReqs(fake).length, ileti: messageReqs(fake).length };
    fake.state.delayMs = 0;
    const logAt = prog.log().length;
    await wait(20_000);
    const dolu = prog.log().slice(logAt);
    r.doluDisk20sn = { medyaYukleme: mediaReqs(fake).length - r.dolumAni.medya, iletiIstegi: messageReqs(fake).length - r.dolumAni.ileti, isciHatasi: workerErrors(dolu), defterUyarisi: ledgerWarn(dolu), metaIsledi: fake.state.messages.length };
    r.doluDiskGunlukOrnek = [...new Set(dolu.split("\n").filter(line => /WARN|ERROR/.test(line)).map(line => line.replace(/^\S+ /, "").slice(0, 220)))].slice(0, 8);
    // API durumu dolu diskte (okuma)
    const view = await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`);
    r.doluDiskApi = { status: view.status, state: view.data?.data?.state, pauseReason: view.data?.data?.pauseReason || "", jobs: (view.data?.data?.jobs || []).map(job => job.state) };
    unlinkSync(filler);
    r.yerAcildi = freeBytes(dataDir);
    const m0 = mediaReqs(fake).length;
    const i0 = messageReqs(fake).length;
    await until(async () => (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data?.data?.state !== "running", 90_000, "toplu iş bitti").catch(error => (r.bitmedi = error.message));
    await wait(1000);
    const after = (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data.data;
    r.toparlanma = { medyaYukleme: mediaReqs(fake).length - m0, iletiIstegi: messageReqs(fake).length - i0, toplamMedya: mediaReqs(fake).length, toplamIleti: messageReqs(fake).length, metaIsledi: fake.state.messages.length, toplu: after.state, isler: after.jobs.map(job => `${job.state}${job.reason ? `(${job.reason.slice(0, 80)})` : ""}`) };
    r.aliciBasina = perRecipient(fake);
    r.metadaKalanPdf = fake.state.media.size;
    const used = new Set(query(companyDb(dataDir), "SELECT media_id FROM wa_jobs WHERE media_id IS NOT NULL").map(row => row.media_id));
    r.sahipsizPdf = [...fake.state.media.keys()].filter(id => !used.has(id)).length;
    r.durumlar = jobStates(dataDir, batchId);
    r.butunluk = query(companyDb(dataDir), "PRAGMA integrity_check")[0];
    // Program yeniden açılır (kullanıcının "kapat-aç"ı): takılı iş toparlanıyor mu, ikinci ileti var mı.
    await prog.stop();
    prog = await startChild({ dataDir, backupDir, fake, gapMs: 200, now: "2026-11-03T09:20:00+03:00" });
    await until(async () => (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data?.data?.state !== "running", 60_000, "yeniden açılışta bitti").catch(error => (r.yenidenAcilistaBitmedi = error.message));
    const reopened = (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data.data;
    r.yenidenAcilis = { toplu: reopened.state, isler: reopened.jobs.map(job => job.state), toplamMedya: mediaReqs(fake).length, toplamIleti: messageReqs(fake).length, metaIsledi: fake.state.messages.length, metadaKalanPdf: fake.state.media.size };
    r.aliciBasina = perRecipient(fake);
    console.log(`# T6b ${JSON.stringify(r)}`);
    return r;
  } finally {
    await prog?.stop().catch(() => {});
    await fake.close();
    umount();
    rmrf(root);
  }
}

describe("T6 (b) — disk dolu", () => {
  it("b1 GERÇEK tmpfs: ilk PDF yüklemesi Meta'dayken disk doldu → çift ileti yok; yer açılınca biter", { timeout: 200_000 }, async () => {
    const r = await gercekDolu("b1", /^POST \/\d+\/media$/);
    for (const [phone, n] of Object.entries(r.aliciBasina)) assert.ok(n <= 1, `${phone} ${n} ileti`);
    assert.equal(r.butunluk.integrity_check, "ok");
    // BULGU T6-B1 (beklenen: plan §6 W2 "disk dolu → iş bekler", yer açılınca kendiliğinden sürer — program yeniden başlatılmadan).
    assert.equal(r.bitmedi, undefined, `BULGU T6-B1: yer açıldıktan sonra toplu iş bitmedi; takılı iş: ${JSON.stringify(r.toparlanma.isler)}`);
  });
  it("b2 GERÇEK tmpfs: disk ZATEN doluyken toplu gönderim başlatılır → açık hata, toplu iş/ileti yok; yer açılınca aynı istek kimliğiyle tek toplu iş", { timeout: 200_000 }, async () => {
    const root = freshDir("b-b2");
    const dataDir = path.join(root, "data");
    const umount = mountTmpfs(dataDir, "48m");
    const fake = await fakeMeta();
    let prog = null;
    const r = {};
    try {
      prog = await startChild({ dataDir, backupDir: path.join(root, "backups"), fake, kur: true, gapMs: 200 });
      const ids = [];
      for (let i = 0; i < 3; i += 1) ids.push((await account(prog.api, `Dolu ${i}`, phoneOf(7100 + i), 30)).id);
      const filler = path.join(dataDir, "dolgu.bin");
      fill(filler);
      const body = { kind: "statement", ids, preset: "thisMonth", requestId: "t6b-b2-00000001" };
      const first = await prog.api.post("/api/workspace/whatsapp/batches", body);
      r.doluyken = { status: first.status, code: first.data?.code, error: first.data?.error };
      await wait(5000);
      r.doluyken.ileti = messageReqs(fake).length;
      r.doluyken.medya = mediaReqs(fake).length;
      r.doluyken.liste = (await prog.api.get("/api/workspace/whatsapp/batches")).data?.data?.length;
      unlinkSync(filler);
      const second = await prog.api.post("/api/workspace/whatsapp/batches", body);
      r.yerAcilinca = { status: second.status, error: second.data?.error || "" };
      const third = await prog.api.post("/api/workspace/whatsapp/batches", body);
      r.ayniIstekKimligi = { status: third.status, ayniToplu: third.data?.data?.batch?.id === second.data?.data?.batch?.id };
      if (second.status === 200) await until(async () => (await prog.api.get(`/api/workspace/whatsapp/batches/${second.data.data.batch.id}`)).data.data.state !== "running", 60_000, "bitti");
      r.topluSayisi = (await prog.api.get("/api/workspace/whatsapp/batches")).data.data.length;
      r.aliciBasina = perRecipient(fake);
      r.butunluk = query(companyDb(dataDir), "PRAGMA integrity_check")[0];
      console.log(`# T6b2 ${JSON.stringify(r)}`);
      assert.notEqual(r.doluyken.status, 200, "dolu diskte toplu iş açılmadı");
      assert.equal(r.doluyken.ileti, 0);
      for (const [phone, n] of Object.entries(r.aliciBasina)) assert.ok(n <= 1, `${phone} ${n}`);
      assert.equal(r.butunluk.integrity_check, "ok");
    } finally {
      await prog?.stop().catch(() => {});
      await fake.close();
      umount();
      rmrf(root);
    }
  });
  it("b3 ZORLA: PDF yüklendikten SONRAKİ yazım (media_id) düşüyor → kaç tur, kaç PDF yüklendi (T2 kuşkusu)", { timeout: 120_000 }, async () => {
    const root = freshDir("b3");
    const ctx = await startWa({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
    const store = ctx.server.app.store;
    const run = store.run;
    let dropped = 0;
    let full = true;
    store.run = (sql, ...args) => {
      if (full && /^UPDATE wa_jobs SET media_id = \?/.test(sql)) {
        dropped += 1;
        const error = new Error("database or disk is full");
        error.code = "ERR_SQLITE_ERROR";
        error.errcode = 13;
        throw error;
      }
      return run.call(store, sql, ...args);
    };
    try {
      const a = await ctx.account("Zorla PDF", "0553 999 00 01", 40);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      // İşçinin 20 turu (üretimde gapMs = 1 sn → ~20 sn); her tur arası işçinin kendi beklemesi yok sayılır (elle sürülür; ders 20).
      const turns = [];
      for (let i = 0; i < 20; i += 1) {
        await ctx.wa.scheduler.runOnce();
        turns.push((await ctx.jobs(id))[0].state);
      }
      const r = { turSayisi: 20, dusenYazim: dropped, medyaYukleme: mediaReqs(ctx.fake).length, metadaKalanPdf: ctx.fake.state.media.size, iletiIstegi: messageReqs(ctx.fake).length, isDurumlari: [...new Set(turns)], isDurumu: (await ctx.jobs(id))[0] };
      full = false;
      await ctx.drain();
      r.yerAcilincaIleti = ctx.messages().length;
      r.yerAcilincaMedya = mediaReqs(ctx.fake).length;
      r.yerAcilincaMetadaKalan = ctx.fake.state.media.size;
      r.sonIs = (await ctx.jobs(id))[0].state;
      console.log(`# T6b3 ${JSON.stringify(r)}`);
      assert.ok(r.yerAcilincaIleti <= 1);
      // BULGU T6-B2 (T2 kuşkusu; beklenen: plan §7a 15 geçici hata 30 sn → 2 dk → 15 dk, en çok 3 yeniden deneme; S3 A PDF Meta'da bırakılmaz).
      assert.ok(r.medyaYukleme <= 4, `BULGU T6-B2: 20 turda ${r.medyaYukleme} PDF yüklendi, Meta'da ${r.metadaKalanPdf} sahipsiz PDF kaldı (iş ${r.isDurumlari.join("/")}, bekleme yok)`);
    } finally {
      store.run = run;
      await ctx.close();
      rmrf(root);
    }
  });
});
