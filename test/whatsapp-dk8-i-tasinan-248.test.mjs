// 2.4.8 İş I — KULLANICI KARARI (31.10.2026 ~11:30 UTC "a"; ★ soru 8): başka bilgisayara TAŞINAN veride şirket dosyasında Meta Kabul Etti / Teslim Edildi / Okundu duran
// ileti, yeni bilgisayarın defterinde yoksa R3'te sayılır ("Daha Önce Gönderildi", varsayılan Bunları Çıkar). Değişmeyenler: Başarısız ve Meta Bekletti / Durduruldu
// sayılmaz (P3, İş A); aynı bilgisayarda (defter) sayım tek (çift sayım yok); "Yine de Gönder" seçimiyle gider; Son 3 Ay'da R3'ün 7 gün penceresi dosyadaki kayda da.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); veri klasörü gönderim defteri OLMADAN kopyalanır (taşıma);
// dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { removeTestDir } from "./helpers.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const ts = ctx => String(Math.floor(ctx.clock().getTime() / 1000));

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

/**
 * Kaynak bilgisayarda P'ye gönderim yapılır (hazırla: ctx, p → durum), veri klasörü defter OLMADAN kopyalanır, kopya yeni bilgisayar gibi açılır (saat: +1 sa + extraMs).
 * Dönüş: { other (yeni bilgisayar), p, close }.
 */
async function moved(prepare, { extraMs = 0 } = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-dk8i-kaynak-"));
  const copy = mkdtempSync(path.join(tmpdir(), "destekofis-dk8i-tasindi-"));
  const ctx = await startWa({ dataDir, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
  const fake = ctx.fake;
  let other = null;
  try {
    const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
    await prepare(ctx, p);
    await ctx.server.close();
    cpSync(dataDir, copy, { recursive: true });
    for (const name of readdirSync(copy)) if (name.startsWith("whatsapp-gonderim.sqlite")) removeTestDir(path.join(copy, name));
    other = await startWa({ dataDir: copy, fake, connect: false, ack: false, now: { time: new Date(Date.parse(localIso(2026, 11, 3, 11)) + extraMs).toISOString(), fixed: true } });
    return {
      other,
      p,
      async close() {
        await other?.server.close();
        await fake.close();
        removeTestDir(dataDir);
        removeTestDir(copy);
      },
    };
  } catch (error) {
    await other?.server.close().catch(() => {});
    await fake.close().catch(() => {});
    removeTestDir(dataDir);
    removeTestDir(copy);
    throw error;
  }
}
async function sentTo(ctx, body, label) {
  const o = await ok(await ctx.batch(body), label);
  await ctx.drain();
  return { o, job: (await ctx.jobs(o.batch.id))[0] };
}

describe("2.4.8 İş I (★ soru 8) — taşınan veride dosyadaki kabul / teslim R3'te sayılır", () => {
  for (const state of ["accepted", "delivered", "read"]) {
    it(`Bu Ay: kaynakta P '${state}' → taşınan veride (defter yok) yeni gönderimde P 'Daha Önce Gönderildi'; 'Yine de Gönder' ile gider`, async () => {
      const body = p => ({ kind: "statement", ids: [p.id], preset: "thisMonth" });
      const m = await moved(async (ctx, p) => {
        const { job } = await sentTo(ctx, body(p), "kaynak gönderim");
        assert.equal(job.state, "accepted", "ön koşul: kabul");
        if (state !== "accepted") {
          ctx.clock.advance(60_000);
          const hook = ctx.statuses([{ id: job.wamid, status: state, timestamp: ts(ctx), recipient_id: "905334445566" }]);
          assert.equal(hook.applied, 1, `ön koşul: ${state} uygulandı`);
        }
      });
      try {
        const pv = await ok(await m.other.api.post(URLS.preview, body(m.p)), "taşınan veride önizleme");
        assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi"], `taşınan veride dosyadaki '${state}' ileti R3'te sayılır`);
        assert.equal(pv.alreadySent?.count, 1, `alreadySent 1 (geldi ${JSON.stringify(pv.alreadySent)})`);
        const again = await ok(await m.other.api.post(URLS.preview, { ...body(m.p), sendAgain: true }), "Yine de Gönder seçimi");
        assert.deepEqual(skipOf(again), ["gönderilecek"], "Yine de Gönder ile gönderilecek");
      } finally {
        await m.close();
      }
    });
  }

  it("Sayılmayanlar: kaynakta Başarısız (131026) ya da Meta Bekletti (taşınınca Durduruldu) olan ileti taşınan veride sayılmaz", async () => {
    for (const kind of ["failed", "held"]) {
      const body = p => ({ kind: "statement", ids: [p.id], preset: "thisMonth" });
      const m = await moved(async (ctx, p) => {
        if (kind === "failed") ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
        const { o, job } = await sentTo(ctx, body(p), "kaynak gönderim");
        ctx.fake.state.recipientErrors = {};
        if (kind === "held") {
          ctx.clock.advance(60_000);
          ctx.statuses([{ id: job.wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]);
        }
        assert.equal((await ctx.jobs(o.batch.id))[0].state, kind, `ön koşul: ${kind}`);
      });
      try {
        assert.deepEqual(skipOf(await ok(await m.other.api.post(URLS.preview, body(m.p)), `önizleme (${kind})`)), ["gönderilecek"], `${kind}: taşınan veride sayılmaz`);
      } finally {
        await m.close();
      }
    }
  });

  it("Son 3 Ay: dosyadaki kabul 7 günden eskiyse taşınan veride sayılmaz, 7 gün içindeyse sayılır (R3 penceresi)", async () => {
    const body = p => ({ kind: "statement", ids: [p.id], preset: "last3" });
    for (const [extraMs, want] of [[5 * DAY, "Daha Önce Gönderildi"], [8 * DAY, "gönderilecek"]]) {
      const m = await moved(async (ctx, p) => {
        const { job } = await sentTo(ctx, body(p), "kaynak Son 3 Ay");
        assert.equal(job.state, "accepted", "ön koşul: kabul");
      }, { extraMs });
      try {
        assert.deepEqual(skipOf(await ok(await m.other.api.post(URLS.preview, body(m.p)), `önizleme (+${extraMs / DAY} gün)`)), [want], `+${extraMs / DAY} gün: ${want}`);
      } finally {
        await m.close();
      }
    }
  });

  it("Aynı bilgisayar (gerileme, çift sayım yok): kabul edilen ileti defterden bir kez sayılır, alreadySent 1", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      await sentTo(ctx, body, "gönderim");
      ctx.clock.advance(HOUR);
      const pv = await ok(await ctx.api.post(URLS.preview, body), "önizleme");
      assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi"], "defterden sayılır");
      assert.equal(pv.alreadySent?.count, 1, "tek sayım");
    } finally {
      await ctx.close();
    }
  });
});
