// 2.4.8 İş Q2 (dar kontrol 10 DÜŞÜK-2; KULLANICI KARARI A; "KİME KAÇ KEZ" ilkesi 4 "çıkmaz yok" + 5 "taşınan veride aynı kural"): işteki "Yine de Gönder"in açtığı iş
// Meta'ca KABUL / teslim edilince kaynak Sonucu Belirsiz iş artık kişiyi "Sonucu Belirsiz" ile ELEMEZ — kişi "Daha Önce Gönderildi"ye düşer, R3'te "Yine de Gönder" ile
// gönderilebilir. Önce döngü vardı (dar kontrol 10 b2): yeni gönderim "Sonucu Belirsiz", işteki Yine de Gönder "Daha Önce Gönderildi" → aynı dönemde yeniden göndermenin
// yolu yoktu. Yine de Gönder işi Başarısız / Sonucu Belirsiz kalırsa kaynak eler (gerileme). Zincir: Yine de Gönder'in Yine de Gönder'i kabul edilince bütün kaynaklar.
// Bağ iki yerde: makine defteri (anyway_links) ve şirket dosyası (wa_jobs.inherit_of, göç v44 — taşınan veri).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { removeTestDir } from "./helpers.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = ctx => ctx.messages().filter(item => item.to === P_TEL).length;
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const anyway = (ctx, jobId) => ctx.api.post(`/api/workspace/whatsapp/jobs/${jobId}/send-anyway`, { confirm: true });

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
/** send Meta'ya ulaşır, yanıtı gelmez → Sonucu Belirsiz iş. */
async function uncertainVia(ctx, send) {
  ctx.fake.state.dropAfter = /\/messages$/;
  const o = await ok(await send(), "belirsiz kalacak gönderim");
  await ctx.drain();
  ctx.fake.state.dropAfter = null;
  const job = (await ctx.jobs(o.batch.id))[0];
  assert.equal(job.state, "uncertain", "ön koşul: Sonucu Belirsiz");
  return job;
}
/** Kaynak J belirsiz → işteki Yine de Gönder → K (outcome: accepted | failed | uncertain). */
async function sourceAndAnyway(ctx, body, outcome) {
  const J = await uncertainVia(ctx, () => ctx.batch(body));
  ctx.clock.advance(HOUR);
  let K;
  if (outcome === "uncertain") K = await uncertainVia(ctx, () => anyway(ctx, J.id));
  else {
    if (outcome === "failed") ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
    const sent = await ok(await anyway(ctx, J.id), "işteki Yine de Gönder");
    await ctx.drain();
    ctx.fake.state.recipientErrors = {};
    K = (await ctx.jobs(sent.batch.id))[0];
    assert.equal(K.state, outcome, `ön koşul: Yine de Gönder işi ${outcome}`);
  }
  ctx.clock.advance(HOUR);
  return { J, K };
}

describe("2.4.8 İş Q2 — kabul edilen 'Yine de Gönder' işinin kaynağı 'Sonucu Belirsiz' ile elemez", () => {
  it("genel (b2): J belirsiz → K kabul + teslim → yeni gönderim 'Daha Önce Gönderildi'; R3'te Yine de Gönder ile gider (çıkmaz yok); bağ dosyada ve defterde", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const { J, K } = await sourceAndAnyway(ctx, body, "accepted");
      assert.equal(ctx.store.get("SELECT inherit_of FROM wa_jobs WHERE id = ?", K.id)?.inherit_of, J.id, "dosyada bağ (v44)");
      const st = ctx.statuses([{ id: K.wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566" }]);
      assert.equal(st.applied, 1, "ön koşul: K teslim");
      const pv = await ok(await ctx.api.post(URLS.preview, body), "önizleme");
      assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi"], "kaynak belirsiz elemez → Daha Önce Gönderildi");
      assert.equal(pv.alreadySent?.count, 1, "R3 sayısında");
      const again = await anyway(ctx, J.id);
      assert.equal(again.status, 400, `işteki ikinci Yine de Gönder açılmaz (geldi ${again.status})`);
      assert.match(again.data.error, /yeni gönderimde "Yine de Gönder" seçin/, "ileti açık yolu söyler (yeni gönderimde Yine de Gönder)");
      const before = count(ctx);
      await ok(await ctx.batch({ ...body, sendAgain: true }), "R3'te Yine de Gönder seçimiyle yeni gönderim");
      await ctx.drain();
      assert.equal(count(ctx), before + 1, "kişiye gitti (döngü yok)");
    } finally {
      await ctx.close();
    }
  });

  it("Meta Bekletti kipi (b2 bekletti): J'nin 131049 sonrası 2. denemesi belirsiz → K kabul → 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const o = await ok(await ctx.batch(body), "ilk gönderim");
      await ctx.drain();
      const j1 = (await ctx.jobs(o.batch.id))[0];
      ctx.clock.advance(60_000);
      ctx.statuses([{ id: j1.wamid, status: "failed", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]);
      ctx.clock.advance(24 * HOUR + 60_000);
      ctx.fake.state.dropAfter = /\/messages$/;
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      const J = (await ctx.jobs(o.batch.id))[0];
      assert.deepEqual([J.state, J.attempt], ["uncertain", 2], "ön koşul: 2. deneme belirsiz");
      ctx.clock.advance(60_000);
      const sent = await ok(await anyway(ctx, J.id), "işteki Yine de Gönder");
      await ctx.drain();
      assert.equal((await ctx.jobs(sent.batch.id))[0].state, "accepted", "ön koşul: K kabul");
      ctx.clock.advance(HOUR);
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["Daha Önce Gönderildi"]);
      const before = count(ctx);
      await ok(await ctx.batch({ ...body, sendAgain: true }), "R3'te Yine de Gönder");
      await ctx.drain();
      assert.equal(count(ctx), before + 1, "kişiye gitti");
    } finally {
      await ctx.close();
    }
  });

  it("gerileme: Yine de Gönder işi Başarısız → kaynak yine 'Sonucu Belirsiz' ile eler; Yine de Gönder işi belirsiz → eler", async () => {
    for (const outcome of ["failed", "uncertain"]) {
      const ctx = await startWa({ now: NOW });
      try {
        const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
        await sourceAndAnyway(ctx, body, outcome);
        for (const extra of [{}, { sendAgain: true }]) {
          assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, { ...body, ...extra }), `önizleme ${outcome}`)), ["Sonucu Belirsiz"], `${outcome} ${JSON.stringify(extra)}: kaynak eler`);
        }
      } finally {
        await ctx.close();
      }
    }
  });

  it("zincir: J belirsiz → K belirsiz → K'nin Yine de Gönder'i L kabul → J ve K elemez, 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const { K } = await sourceAndAnyway(ctx, body, "uncertain");
      const sent = await ok(await anyway(ctx, K.id), "K'nin Yine de Gönder'i");
      await ctx.drain();
      assert.equal((await ctx.jobs(sent.batch.id))[0].state, "accepted", "ön koşul: L kabul");
      ctx.clock.advance(HOUR);
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["Daha Önce Gönderildi"], "zincirin bütün kaynakları elemez");
    } finally {
      await ctx.close();
    }
  });

  it("yalnız defterdeki bağ (dosyadaki bağ yok — eski yedek): kaynak yine elemez; yalnız dosyadaki bağ (taşınan veri, defter yok): kaynak elemez", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-q2-tasinan-"));
    const dataDir = path.join(root, "data");
    let ctx = await startWa({ now: NOW, dataDir });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const { K } = await sourceAndAnyway(ctx, body, "accepted");
      ctx.store.run("UPDATE wa_jobs SET inherit_of = '' WHERE id = ?", K.id);
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme (yalnız defter bağı)")), ["Daha Önce Gönderildi"], "defterdeki bağ yeter");
      ctx.store.run("UPDATE wa_jobs SET inherit_of = (SELECT id FROM wa_jobs WHERE state = 'uncertain') WHERE id = ?", K.id);
      await ctx.close();
      ctx = null;
      const moved = path.join(root, "tasindi");
      cpSync(dataDir, moved, { recursive: true });
      for (const name of readdirSync(moved)) if (name.startsWith("whatsapp-gonderim.sqlite")) rmSync(path.join(moved, name), { force: true });
      ctx = await startWa({ now: { time: localIso(2026, 11, 3, 14), fixed: true }, dataDir: moved, connect: false, ack: false });
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "taşınan veride önizleme")), ["Daha Önce Gönderildi"], "taşınan veride dosyadaki bağ: kaynak elemez, K'nin kabulü R3");
    } finally {
      await ctx?.close();
      removeTestDir(root);
    }
  });

  it("göç v44: v43 dosyası (inherit_of yok) açılınca sütun eklenir, eski satırlar bağsız (''); göç yarıda kalmış dosya (sütun var, sürüm 43) yeniden açılır", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-q2-goc-"));
    const dataDir = path.join(root, "data");
    let ctx = await startWa({ now: NOW, dataDir });
    let dbPath;
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      await uncertainVia(ctx, () => ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" }));
      dbPath = ctx.server.app.config.dbPath;
      await ctx.close();
      ctx = null;
      const db = new DatabaseSync(dbPath);
      db.exec("ALTER TABLE wa_jobs DROP COLUMN inherit_of; PRAGMA user_version = 43");
      db.close();
      ctx = await startWa({ now: NOW, dataDir, connect: false, ack: false });
      // 2.4.9 B3: v44'ten sonra v45 (wa_job_pdfs) da koşar — dosya en son şemaya çıkar (v44 dahil).
      assert.equal(ctx.store.get("PRAGMA user_version").user_version, LATEST_VERSION, "göç v44 (ve sonrakiler) uygulandı");
      assert.deepEqual(ctx.store.all("SELECT inherit_of FROM wa_jobs").map(row => row.inherit_of), [""], "eski satır bağsız");
      await ctx.close();
      ctx = null;
      const again = new DatabaseSync(dbPath);
      again.exec("PRAGMA user_version = 43");
      again.close();
      ctx = await startWa({ now: NOW, dataDir, connect: false, ack: false });
      assert.equal(ctx.store.get("PRAGMA user_version").user_version, LATEST_VERSION, "sütun varken (yarıda kalmış göç) yeniden açılır");
    } finally {
      await ctx?.close();
      removeTestDir(root);
    }
  });
});
