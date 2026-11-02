// T6 (d) Meta 5xx / 429 / bağlantı kopması ve (e) internet yok — GERÇEK program ayrı süreçte, işçi kendi zamanlayıcısıyla. Plan: §7a 10 (yanıtsız ileti isteği →
// Sonucu Belirsiz, kendiliğinden yeniden gönderilmez), §7a 11–15 (geçici hata 30 sn → 2 dk → 15 dk; 131026 iş Başarısız), R1 (Meta'ya ulaşılamıyor → "Bağlantı
// Bekleniyor", Başarısız değil, bağlantı dönünce kendiliğinden sürer).
// (e2) ZORLA (T1 kuşkusu): kesinti iki ileti ARASINA (havuzdaki canlı soketin 4 sn'lik ömrü içine) denk getirilir. Gerçek kesintide (kablo, Wi-Fi) eski soket
// FIN/RST almaz → bunu yerel bir TCP ara sunucusu taklit eder: "kara delik" kipinde açık soketler AÇIK kalır ama veri iletilmez, yeni bağlantılar reddedilir.
import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import { describe, it } from "node:test";
import { account, fakeMeta, freshDir, jobStates, mediaReqs, messageReqs, perRecipient, phoneOf, rmrf, startChild, until, wait } from "./ortak.mjs";

function startProxy(targetPort) {
  const pairs = new Set();
  let mode = "normal";
  let server = null;
  let port = 0;
  const onConn = client => {
    if (mode !== "normal") return client.destroy();
    const upstream = net.connect(targetPort, "127.0.0.1");
    const pair = { client, upstream };
    pairs.add(pair);
    client.on("data", d => mode === "normal" && upstream.write(d));
    upstream.on("data", d => mode === "normal" && client.write(d));
    client.on("close", () => {
      upstream.destroy();
      pairs.delete(pair);
    });
    upstream.on("close", () => mode === "normal" && client.destroy());
    client.on("error", () => {});
    upstream.on("error", () => {});
  };
  const listen = () => new Promise(resolve => {
    server = net.createServer(onConn);
    server.listen(port, "127.0.0.1", () => {
      port = server.address().port;
      resolve();
    });
  });
  return {
    listen,
    get url() {
      return `http://127.0.0.1:${port}`;
    },
    live: () => [...pairs].filter(pair => !pair.client.destroyed).length,
    /** Kara delik: dinleyici kapanır (yeni bağlantı reddedilir), açık soketler açık kalır, veri iletilmez. */
    blackhole: () => new Promise(resolve => {
      mode = "blackhole";
      for (const pair of pairs) pair.upstream.destroy();
      server.close(() => resolve());
    }),
    async restore() {
      for (const pair of pairs) pair.client.destroy();
      mode = "normal";
      await listen();
    },
    close: () => new Promise(resolve => {
      for (const pair of pairs) pair.client.destroy();
      server.close(() => resolve());
    }),
  };
}

async function setup(label, { proxy = false } = {}) {
  const fake = await fakeMeta();
  const p = proxy ? startProxy(Number(new URL(fake.url).port)) : null;
  if (p) await p.listen();
  const root = freshDir(label);
  const prog = await startChild({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), fake: p ? { url: p.url } : fake, kur: true, gapMs: 1000, timeoutMs: 3000 });
  return { fake, p, root, prog, async close() {
    await this.prog.stop().catch(() => {});
    await p?.close().catch(() => {});
    await fake.close();
    rmrf(root);
  } };
}
const detail = async (prog, id) => (await prog.api.get(`/api/workspace/whatsapp/batches/${id}`)).data.data;

describe("T6 (d) Meta 5xx / 429 / kopma — gerçek süreç", () => {
  it("d: PDF yüklemesi 503 (gövdesiz), ileti 500 (kod 2), 500 (HTML), 429 (130429), bağlantı kopması, 400 (131026) → çift yok, belirsizler gönderilmez", { timeout: 400_000 }, async () => {
    const s = await setup("d-meta");
    try {
      const ids = [];
      for (let i = 0; i < 8; i += 1) ids.push((await account(s.prog.api, `Meta Hata ${i}`, phoneOf(8000 + i), 20 + i)).id);
      const meta = (code, message) => ({ error: { message, type: "OAuthException", code, fbtrace_id: "Ab" } });
      s.fake.state.failQueue.push(
        { match: /^POST \/\d+\/media$/, status: 503, raw: "<html>Service Unavailable</html>" },
        { match: /^POST \/\d+\/messages$/, status: 500, body: meta(2, "(#2) Service temporarily unavailable") },
        { match: /^POST \/\d+\/messages$/, status: 500, raw: "<html>Internal Server Error</html>" },
        { match: /^POST \/\d+\/messages$/, status: 429, body: meta(130429, "(#130429) Rate limit hit") },
        { match: /^POST \/\d+\/messages$/, destroy: true },
        { match: /^POST \/\d+\/messages$/, status: 400, body: meta(131026, "(#131026) Message undeliverable") },
      );
      const created = await s.prog.api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids, preset: "thisMonth", requestId: "t6d-meta-000001" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const id = created.data.data.batch.id;
      const izlek = [];
      const t0 = Date.now();
      // Bekleyen geçici hatalar en çok 30 sn + 2 dk (iki kod-2/130429 denemesi) → en geç ~4 dk.
      await until(async () => {
        const d = await detail(s.prog, id);
        const tag = `${d.stateLabel}|${Object.entries(d.jobs.reduce((acc, job) => ((acc[job.state] = (acc[job.state] || 0) + 1), acc), {})).map(([k, v]) => `${k}:${v}`).join(",")}`;
        if (izlek.at(-1)?.tag !== tag) izlek.push({ sn: Math.round((Date.now() - t0) / 1000), tag });
        return d.state !== "running";
      }, 330_000, "toplu iş bitti");
      const d = await detail(s.prog, id);
      const counts = perRecipient(s.fake);
      const r = { izlek, toplu: d.stateLabel, isler: d.jobs.map(job => ({ ad: job.accountName.slice(-1), durum: job.state, kod: job.errorCode, neden: job.reason.slice(0, 90), ileti: counts[job.phone] || 0 })), iletiIstegi: messageReqs(s.fake).length, metaIsledi: s.fake.state.messages.length, medya: mediaReqs(s.fake).length };
      console.log(`# T6d ${JSON.stringify(r)}`);
      for (const job of r.isler) {
        assert.ok(job.ileti <= 1, `çift ileti ${JSON.stringify(job)}`);
        if (job.durum === "accepted") assert.equal(job.ileti, 1);
      }
      assert.ok(r.isler.some(job => job.durum === "failed" && job.kod === 131026), "131026 Başarısız");
      assert.ok(r.isler.filter(job => job.durum === "uncertain").length >= 2, "HTML 500 ve kopma → Sonucu Belirsiz");
    } finally {
      await s.close();
    }
  });
});

describe("T6 (e) internet yok — R1", () => {
  it("e1: ekstre gönderilirken internet kesildi (yeni bağlantı kurulamıyor, eski soket yok) → 'Bağlantı Bekleniyor', Başarısız yok; dönünce kendiliğinden biter", { timeout: 300_000 }, async () => {
    const s = await setup("e1-internet", { proxy: true });
    try {
      const ids = [];
      for (let i = 0; i < 4; i += 1) ids.push((await account(s.prog.api, `İnternet ${i}`, phoneOf(8100 + i), 15)).id);
      await s.p.blackhole();
      await wait(6000); // havuzdaki boşta soketin ömrü (4 sn) dolsun
      const created = await s.prog.api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids, preset: "thisMonth", requestId: "t6e-e1-0000001" });
      const r = { baslatma: { status: created.status, code: created.data?.code, error: created.data?.error } };
      // P2 A (31.10 KARAR): başlatırken Meta'ya ulaşılamıyorsa iş AÇILMAZ. O yüzden bağlantı açıkken başlatılır ve HEMEN ardından kesilir (gönderimin başında).
      await s.p.restore();
      const again = await s.prog.api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids, preset: "thisMonth", requestId: "t6e-e1-0000002" });
      assert.equal(again.status, 200, JSON.stringify(again.data));
      const id = again.data.data.batch.id;
      await s.p.blackhole();
      await wait(25_000);
      const during = await detail(s.prog, id);
      r.kesintide = { toplu: during.stateLabel, neden: during.pauseReason.slice(0, 140), isler: jobStates(path.join(s.root, "data"), id), metaIsledi: s.fake.state.messages.length };
      await s.p.restore();
      await until(async () => (await detail(s.prog, id)).state !== "running", 200_000, "dönünce bitti");
      const d = await detail(s.prog, id);
      r.son = { toplu: d.stateLabel, isler: d.jobs.map(job => job.state), aliciBasina: perRecipient(s.fake) };
      console.log(`# T6e1 ${JSON.stringify(r)}`);
      assert.notEqual(r.baslatma.status, 200, "P2: Meta'ya ulaşılamıyorken başlatılmadı");
      assert.equal(r.kesintide.toplu, "Bağlantı Bekleniyor");
      assert.ok(!r.kesintide.isler.failed && !r.kesintide.isler.uncertain, JSON.stringify(r.kesintide));
      assert.equal(d.state, "done");
      assert.deepEqual(Object.values(r.son.aliciBasina), [1, 1, 1, 1]);
    } finally {
      await s.close();
    }
  });

  for (const kind of ["reminder", "statement"]) {
    it(`e2 ZORLA (${kind}): kesinti iki ileti ARASINA, havuzdaki soket canlıyken (≤4 sn) → ilk istek ne oluyor`, { timeout: 300_000 }, async () => {
      const s = await setup(`e2-${kind}`, { proxy: true });
      try {
        const ids = [];
        for (let i = 0; i < 3; i += 1) {
          const a = await account(s.prog.api, `Arada ${kind} ${i}`, phoneOf(8200 + i + (kind === "reminder" ? 0 : 50)), kind === "reminder" ? 0 : 15);
          if (kind === "reminder") {
            const plan = await s.prog.api.post("/api/workspace/plans", { accountId: a.id, name: "Taksit", total: "900", count: 3, firstDue: "2026-11-05", startDate: "2026-11-03" });
            assert.equal(plan.status, 200, JSON.stringify(plan.data).slice(0, 300));
          }
          ids.push(a.id);
        }
        if (kind === "reminder") {
          // İlk taksitin vadesi (05.11) geçsin: program 20.11'de yeniden açılır (aynı veri).
          await s.prog.stop();
          s.prog = await startChild({ dataDir: path.join(s.root, "data"), backupDir: path.join(s.root, "backups"), fake: { url: s.p.url }, gapMs: 1000, timeoutMs: 3000, now: "2026-11-20T09:00:00+03:00" });
        }
        const created = await s.prog.api.post("/api/workspace/whatsapp/batches", { kind, ids, ...(kind === "statement" ? { preset: "thisMonth" } : {}), requestId: `t6e-e2-${kind}-01` });
        assert.equal(created.status, 200, JSON.stringify(created.data));
        const id = created.data.data.batch.id;
        await until(() => s.fake.state.messages.length >= 1, 30_000, "ilk ileti");
        await wait(80); // yanıt programa ulaşsın; soket havuza dönsün
        const canli = s.p.live();
        await s.p.blackhole();
        const t0 = Date.now();
        await wait(12_000);
        const during = await detail(s.prog, id);
        const r = { kind, kesintiAniCanliSoket: canli, kesintide: { toplu: during.stateLabel, isler: during.jobs.map(job => `${job.state}${job.reason ? `(${job.reason.slice(0, 100)})` : ""}`) } };
        await s.p.restore();
        await until(async () => (await detail(s.prog, id)).state !== "running", 200_000, "dönünce bitti").catch(error => (r.bitmedi = error.message));
        const d = await detail(s.prog, id);
        r.son = { toplu: d.stateLabel, isler: d.jobs.map(job => job.state), aliciBasina: perRecipient(s.fake), iletiIstegi: messageReqs(s.fake).length, sureSn: Math.round((Date.now() - t0) / 1000) };
        r.belirsizIletisiz = d.jobs.filter(job => job.state === "uncertain" && !perRecipient(s.fake)[job.phone]).length;
        console.log(`# T6e2 ${JSON.stringify(r)}`);
        for (const n of Object.values(r.son.aliciBasina)) assert.ok(n <= 1);
        // BULGU T6-E2 (T1 kuşkusu; beklenen R1: internet yok → "Bağlantı Bekleniyor", iş Başarısız / Belirsiz SAYILMAZ, dönünce kendiliğinden gider).
        assert.equal(r.belirsizIletisiz, 0, `BULGU T6-E2 (${kind}): Meta'ya hiç ulaşmayan ${r.belirsizIletisiz} ileti 'Sonucu Belirsiz' oldu ve gönderilmedi: ${JSON.stringify(r.kesintide.isler)}`);
      } finally {
        await s.close();
      }
    });
  }
});
