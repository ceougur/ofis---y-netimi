// W düzeltme turu 1 — DÜŞÜK-2 dişi: test/whatsapp-w2-onbellek-249.test.mjs "SÜRERKEN" hücresinin YENİ (kapılı) biçimi, dar kontrolün p2-surerken-dis senaryosuyla:
// Denetle'nin kendi Meta okuması +0 ve +450 ms geciktirilir (yavaş makine benzetimi). Hücrenin AYNEN iddiaları + ön koşul (workerDone === false).
// Beklenen: yeni kodda iki hücre de yeşil; templateEpoch koruması kaldırılmış kopyada (M08) iki hücre de kırmızı ("giden 3").
// Kullanım: KOK=<kod kopyası> node --test surerken-kapi-dis.test.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { it } from "node:test";

const root = path.resolve(process.env.KOK);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { URLS, startWa } = await imp("test/whatsapp-248-ortak.mjs");
const MIN = 60_000;
const ENSURE = "/api/workspace/whatsapp/templates/ensure";
const ekstre = fake => fake.state.templates.find(item => item.name === "destekofis_ekstre");
const lists = fake => fake.requests.filter(item => item.method === "GET" && /\/message_templates$/.test(item.path));

async function runningBatch(ctx) {
  const ids = [];
  for (let i = 0; i < 3; i += 1) ids.push((await ctx.api.post("/api/workspace/accounts", { name: `Kişi ${i + 1}`, phone: `0555 000 00 0${i + 1}`, openingBalance: "10" })).data.data.id);
  const res = await ctx.api.post(URLS.batches, { kind: "statement", ids, preset: "thisMonth" });
  await ctx.wa.scheduler.runOnce();
  assert.equal(ctx.messages().length, 1);
  return res.data.data.batch.id;
}

for (const ensureDelay of [0, 450]) {
  it(`SÜRERKEN (kapılı) hücresi, Denetle'nin Meta okuması +${ensureDelay} ms`, async () => {
    const ctx = await startWa({ whatsappTimeoutMs: 10_000 });
    let release = () => {};
    try {
      const id = await runningBatch(ctx);
      ctx.clock.advance(11 * MIN);
      const old = { data: ctx.fake.state.templates.map(item => ({ ...item })), paging: { cursors: { before: "QVFIUb", after: "QVFIUa" } } };
      const gate = new Promise(resolve => {
        release = resolve;
      });
      ctx.fake.state.failQueue.push({ match: /^GET \/\d+\/message_templates$/, status: 200, body: old, gate });
      const readsBefore = lists(ctx.fake).length;
      let workerDone = false;
      const worker = ctx.wa.scheduler.runOnce().finally(() => {
        workerDone = true;
      });
      for (let i = 0; i < 200 && lists(ctx.fake).length === readsBefore; i += 1) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(lists(ctx.fake).length, readsBefore + 1, "ön koşul: işçinin şablon okuması Meta'da bekliyor");
      ekstre(ctx.fake).category = "MARKETING";
      if (ensureDelay) {
        const now = { data: ctx.fake.state.templates.map(item => ({ ...item })), paging: { cursors: { before: "QVFIUb", after: "QVFIUa" } } };
        ctx.fake.state.failQueue.push({ match: /^GET \/\d+\/message_templates$/, status: 200, body: now, waitMs: ensureDelay });
      }
      const guard = setTimeout(() => release(), 5_000);
      const started = Date.now();
      const checked = await ctx.api.post(ENSURE, {});
      const ensureMs = Date.now() - started;
      clearTimeout(guard);
      const preconditionHeld = !workerDone;
      assert.equal(workerDone, false, "ön koşul (yarış): Denetle döndüğünde işçinin eski okuması hâlâ Meta'da bekliyor");
      assert.equal(checked.status, 200, JSON.stringify(checked.data));
      assert.equal(checked.data.data.items.find(item => item.name === "destekofis_ekstre").usable, false);
      release();
      await worker;
      await ctx.drain();
      const batch = (await ctx.api.get(`${URLS.batches}/${id}`)).data.data;
      console.log(`SONUC kok=${path.basename(root)} ensureDelay=${ensureDelay} denetleMs=${ensureMs} onKosulOlustu=${preconditionHeld} giden=${ctx.messages().length} durum=${batch.state}/${batch.pauseCode}`);
      assert.ok(ctx.messages().length <= 2, `giden ${ctx.messages().length}`);
      assert.equal(batch.state, "paused");
      assert.equal(batch.pauseCode, "template-marketing");
    } finally {
      release();
      await ctx.close();
    }
  });
}
