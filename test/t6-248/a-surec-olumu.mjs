// T6 (a) — TOPLU gönderimin ORTASINDA süreç ölümü (SIGKILL; yalnız kendi başlattığımız çocuk). GERÇEK program ayrı süreçte, işçi kendi zamanlayıcısıyla gönderir;
// sahte Meta her isteği gecikmeyle işler (öldürme anı isteğin içine / arasına rastgele düşer). Tohum başına öldürme noktası: K'ıncı ileti isteği görülünce +
// rastgele 0–400 ms. Sonra aynı veriyle yeniden açılır, toplu iş bitene dek sürer.
// DEĞİŞMEZLER (plan §6 W2 "ÇİFT GÖNDERİM YOK", §7a 10; §9 "'Gönderiliyor' anında süreç öldürülür → çift yok, kayıp yok"):
//   D1 hiçbir alıcıya Meta'nın işlediği ileti > 1;  D2 "Meta Kabul Etti" işin alıcısına tam 1 ileti;  D3 Meta'nın işlediği iletinin işi kabul / Sonucu Belirsiz
//   (Bekliyor / Başarısız DEĞİL — yoksa yeniden gönderilirdi);  D4 Sonucu Belirsiz iş kendiliğinden yeniden gönderilmez (D1 ile);  D5 toplu iş biter (açık iş kalmaz),
//   ileti almayan ve belirsiz olmayan alıcı kalmaz (kayıp yok);  D6 defterde her işin en çok bir "accepted" sonucu.
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { account, e164Of, fakeMeta, freshDir, jobStates, ledgerDb, mediaReqs, messageReqs, perRecipient, phoneOf, query, companyDb, rmrf, startChild, until, wait } from "./ortak.mjs";

const N = 12;
const START = Date.parse("2026-11-03T09:00:00+03:00");
const TOHUMLAR = (process.env.T6_TOHUM || "1,2,3,4,5,6,7,8,9,10").split(",").map(Number);
const rnd = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

async function birTohum(seed) {
  const r = rnd(seed * 7919 + 13);
  const K = Math.floor(r() * N); // 0 → ilk PDF / ilk ileti sırasında
  const extra = Math.floor(r() * 400);
  const fake = await fakeMeta({ delayMs: 120 });
  const root = freshDir(`a-olum-${seed}`);
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const t0 = Date.now();
  let prog = await startChild({ dataDir, backupDir, fake, kur: true, gapMs: 150 });
  let batchId;
  const rapor = { seed, K, extra };
  try {
    const ids = [];
    for (let i = 0; i < N; i += 1) ids.push((await account(prog.api, `Ölüm ${seed}-${i}`, phoneOf(1000 * seed + i), 10 + i)).id);
    const created = await prog.api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids, preset: "thisMonth", requestId: `t6a-${seed}-000001` });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    batchId = created.data.data.batch.id;
    await until(() => messageReqs(fake).length >= K && (K > 0 || mediaReqs(fake).length > 0), 60_000, `K=${K} ileti isteği`);
    await wait(extra);
    const end = await prog.kill();
    assert.ok(process.platform === "win32" ? end.code !== 0 : end.signal === "SIGKILL", JSON.stringify(end));
    rapor.olumAni = { mesajIstek: messageReqs(fake).length, medyaIstek: mediaReqs(fake).length, metaIsledi: fake.state.messages.length };
    rapor.olumdeDurumlar = jobStates(dataDir, batchId);
    await wait(400); // sahte Meta'nın gecikmeli işlediği son istek de kayda girsin
    prog = await startChild({ dataDir, backupDir, fake, gapMs: 150, now: new Date(START + (Date.now() - t0) + 1000).toISOString() });
    await until(async () => (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data.data.state !== "running", 90_000, "toplu iş bitti");
    await wait(500);
    const detail = (await prog.api.get(`/api/workspace/whatsapp/batches/${batchId}`)).data.data;
    rapor.sonDurum = detail.state;
    rapor.sonDurumlar = jobStates(dataDir, batchId);
    const counts = perRecipient(fake);
    rapor.metaIsledi = fake.state.messages.length;
    rapor.mesajIstek = messageReqs(fake).length;
    rapor.medyaYukleme = mediaReqs(fake).length;
    const jobs = detail.jobs;
    const ledger = query(ledgerDb(dataDir), "SELECT job_id, outcome, COUNT(*) AS n FROM outcomes GROUP BY job_id, outcome");
    const ihlal = [];
    for (const job of jobs) {
      const n = counts[job.phone] || 0;
      if (n > 1) ihlal.push(`D1 ${job.phone} ${n} ileti`);
      if (job.state === "accepted" && n !== 1) ihlal.push(`D2 ${job.phone} kabul ama ${n} ileti`);
      if (n === 1 && !["accepted", "uncertain", "sent", "delivered", "read"].includes(job.state)) ihlal.push(`D3 ${job.phone} iletisi Meta'da ama iş ${job.state}`);
      if (n === 0 && job.state !== "uncertain") ihlal.push(`D5 ${job.phone} ileti yok, iş ${job.state}`);
    }
    for (const row of ledger) if (row.outcome === "accepted" && row.n > 1) ihlal.push(`D6 ${row.job_id} ${row.n} kabul`);
    if (detail.state !== "done") ihlal.push(`D5 toplu iş ${detail.state}`);
    rapor.belirsizIletisiz = jobs.filter(job => job.state === "uncertain" && !(counts[job.phone] || 0)).length;
    rapor.belirsizIletili = jobs.filter(job => job.state === "uncertain" && (counts[job.phone] || 0) === 1).length;
    rapor.ihlal = ihlal;
    // Meta'da kalan PDF'ler (S3 A: kesinleşince silinir; Meta Kabul Etti kesin değil). Sahipsiz = yüklendi, hiçbir işin medyası değil (öldürülen yükleme).
    const used = new Set(query(companyDb(dataDir), "SELECT media_id FROM wa_jobs WHERE batch_id = ? AND media_id IS NOT NULL", batchId).map(row => row.media_id));
    rapor.metadaKalanPdf = fake.state.media.size;
    rapor.sahipsizPdf = [...fake.state.media.keys()].filter(id => !used.has(id)).length;
    console.log(`# T6a ${JSON.stringify(rapor)}`);
    assert.deepEqual(ihlal, [], JSON.stringify(rapor));
    return rapor;
  } finally {
    await prog.stop().catch(() => {});
    await fake.close();
    rmrf(root);
  }
}

describe("T6 (a) — toplu gönderimin ortasında SIGKILL → yeniden açılış: çift yok, kayıp yok, Sonucu Belirsiz doğru", () => {
  for (const seed of TOHUMLAR) it(`tohum ${seed}`, { timeout: 240_000 }, () => birTohum(seed).then(() => {}));
});
void e164Of;
