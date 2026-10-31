// 2.4.8 T2 dar kontrol ORTA-1 (B2'nin yan etkisi; bağımsız dar kontrol DK-1 / DK-3 betiklerinden kalıcılaştırıldı): 131049 kancasıyla yeniden açılan ("Tamamlandı" →
// "Sürüyor") toplu iş defterde canlı DEĞİLDİ (defter "done" kalıyordu; istisna yalnız "Meta Bekletti" iş için) →
//   (a) yeniden denemede geçici hata → iş Bekliyor'a dönünce toplu iş "Durduruldu (Geri Yükleme)", tek yeniden deneme hakkı kayboluyordu;
//   (b, c) Duraklat → Devam Et 409 whatsapp-batch-moved;
//   (d) İptal Et defterde yok sayılıyordu → yedekten geri yüklenen eski dosyada iptal edilen ileti 24 saat sonra GİDİYORDU (plan §7a 26: geri yükleme sonrası
//       bekleyen işler kendiliğinden sürmez; defterdeki son karar geçerli).
// Beklenen: toplu işin defterdeki yaşam döngüsü yeniden açılmayı ve sonraki durdurma / iptali kaydeder.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + programın durum bildirimi çekirdeği / gerçek kanca + sahte saat (ders 13).
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const PUBLIC = "http://ofisx.destekofis.test";
const metaError = (code, message = "hata") => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "Abc" } });
const failed = (ctx, wamid, code) => ({ id: wamid, status: "failed", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905321112233", errors: [{ code, title: "x", message: "x", error_data: { details: "x" } }] });

async function revived() {
  const ctx = await startWa();
  try {
    const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
    const res = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const id = res.data.data.batch.id;
    await ctx.drain();
    assert.equal((await ctx.detail(id)).state, "done", "ön koşul: toplu iş Tamamlandı");
    assert.equal(ctx.statuses([failed(ctx, (await ctx.jobs(id))[0].wamid, 131049)]).applied, 1);
    const d = await ctx.detail(id);
    assert.equal(d.state, "running", "ön koşul: 131049 toplu işi yeniden Sürüyor yaptı");
    assert.equal(d.jobs[0].state, "held");
    return { ctx, id };
  } catch (error) {
    await ctx.close();
    throw error;
  }
}

describe("2.4.8 T2 dar kontrol ORTA-1 — 131049 ile yeniden açılan toplu iş defterde de canlı; sonraki durdurma / iptal kaydedilir", () => {
  it("defter: yeniden açılan toplu iş canlı; iptal edilince defterde 'canceled'", async () => {
    const { ctx, id } = await revived();
    try {
      assert.equal(ctx.wa.ledger.batchState(id).live, true, `defterde canlı olmalı (${JSON.stringify(ctx.wa.ledger.batchState(id))})`);
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/cancel`, {})).status, 200);
      const state = ctx.wa.ledger.batchState(id);
      assert.equal(state.live, false);
      assert.equal(state.reason, "canceled", `iptal defterde yazılmalı (${JSON.stringify(state)})`);
    } finally {
      await ctx.close();
    }
  });

  it("(a) yeniden denemede geçici Meta hatası (131000): toplu iş 'Durduruldu' OLMAZ, iş beklemeden sonra gider", async () => {
    const { ctx, id } = await revived();
    try {
      ctx.clock.advance(24 * HOUR + 60_000);
      ctx.fake.state.failQueue.push({ match: /^POST .*\/messages$/, status: 500, body: metaError(131000, "Something went wrong") });
      await ctx.drain();
      ctx.clock.advance(5 * 60_000);
      await ctx.drain();
      const d = await ctx.detail(id);
      assert.notEqual(d.state, "stopped", `geçici hata toplu işi 'Durduruldu' yapmamalı (geldi ${d.state}: ${d.pauseReason})`);
      assert.equal(d.jobs[0].state, "accepted", "yeniden deneme beklemeden sonra gitti");
      assert.equal(ctx.messages().length, 2);
    } finally {
      await ctx.close();
    }
  });

  for (const viaAck of [false, true]) it(viaAck ? "(c) Gönderim Onayı kaldırılıp yeniden işaretlenince Devam Et kabul edilir" : "(b) Duraklat → Devam Et kabul edilir", async () => {
    const { ctx, id } = await revived();
    try {
      if (viaAck) {
        assert.equal((await ctx.api.put(URLS.ack, { ack: false })).status, 200);
        ctx.clock.advance(24 * HOUR + 60_000);
        await ctx.drain();
        assert.equal((await ctx.detail(id)).pauseCode, "ack");
        assert.equal((await ctx.api.put(URLS.ack, { ack: true })).status, 200);
      } else assert.equal((await ctx.api.post(`${URLS.batches}/${id}/pause`, {})).status, 200);
      const r = await ctx.api.post(`${URLS.batches}/${id}/resume`, {});
      assert.equal(r.status, 200, `${viaAck ? "onay" : "duraklat"}: Devam Et kabul edilmeli (geldi ${r.status} ${JSON.stringify(r.data)})`);
      ctx.clock.advance(25 * HOUR);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "Meta Bekletti iş bir kez yeniden gitti");
    } finally {
      await ctx.close();
    }
  });

  it("(d) İptal Et → dosya iptalden önceki hâline dönerse (geri yükleme benzetimi): açılış toparlaması toplu işi durdurur, iptal edilen ileti GİTMEZ", async () => {
    const { ctx, id } = await revived();
    try {
      const batch = ctx.store.get("SELECT * FROM wa_batches WHERE id = ?", id);
      const job = ctx.store.get("SELECT * FROM wa_jobs WHERE batch_id = ?", id);
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/cancel`, {})).status, 200);
      ctx.store.run("UPDATE wa_batches SET state = ?, finished_at = ? WHERE id = ?", batch.state, batch.finished_at, id);
      ctx.store.run("UPDATE wa_jobs SET state = ?, closed_at = ? WHERE id = ?", job.state, job.closed_at, job.id);
      ctx.server.app.context.whatsapp.queue.recover();
      ctx.clock.advance(24 * HOUR + 60_000);
      await ctx.drain();
      assert.equal(ctx.messages().length, 1, "iptal edilmiş iletinin eski kopyası gönderilmemeli (§7a 26)");
      assert.equal((await ctx.detail(id)).state, "stopped");
    } finally {
      await ctx.close();
    }
  });

  it("GERÇEK yedek → İptal Et → yedekten geri yükle (ikinci şirket, gerçek kanca): iptal edilen ileti geri yüklemeden sonra GİTMEZ", async () => {
    const ctx = await startWa({ maxCompanies: 2 });
    try {
      const created = (await ctx.api.post("/api/companies", { name: "Tatbikat Şirketi", select: false })).data.data;
      const co = created.company || created;
      const q = `hofCompany=${encodeURIComponent(co.id)}`;
      assert.equal((await ctx.api.del(URLS.conn)).status, 200);
      assert.equal((await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      assert.equal((await ctx.api.put(`${URLS.ack}?${q}`, { ack: true })).status, 200);
      assert.equal((await ctx.api.put(`/api/admin/office?${q}`, { name: "Tatbikat Şirketi" })).status, 200);
      ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
      const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
      assert.equal((await ctx.api.post(`${URLS.conn}/hook?${q}`, {})).status, 200);
      const hookPath = new URL(ctx.fake.state.override).pathname;
      const acc = (await ctx.api.post(`/api/workspace/accounts?${q}`, { name: "Ayşe Yılmaz", phone: "0532 111 22 33", openingBalance: "1250" })).data.data;
      const id = (await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: [acc.id], from: "2026-11-01", to: "2026-11-03" })).data.data.batch.id;
      await ctx.drain();
      const get = async () => (await ctx.api.get(`${URLS.batches}/${id}?${q}`)).data.data;
      let d = await get();
      assert.equal(d.state, "done");
      const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses: [failed(ctx, d.jobs[0].wamid, 131049)] } }] }] });
      const hook = await new Promise((resolve, reject) => {
        const req = http.request({ host: "127.0.0.1", port: remote.port, method: "POST", path: hookPath, headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } }, res => {
          res.resume();
          res.on("end", () => resolve(res.statusCode));
        });
        req.on("error", reject);
        req.end(body);
      });
      assert.equal(hook, 200);
      assert.equal((await get()).jobs[0].state, "held");
      const backup = (await ctx.api.post("/api/admin/backups", { scope: "one", companyId: co.id })).data.data.backups[0].name;
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/cancel?${q}`, {})).status, 200);
      const restored = await ctx.api.post("/api/admin/backups/restore", { name: backup, company: co.id, confirm: co.code, password: ADMIN_PASSWORD });
      assert.equal(restored.status, 200, JSON.stringify(restored.data));
      // Geri yüklenen şirket ilk istekle yeniden açılır (açılış toparlaması o an koşar); okumadan önce sürülen işçi o şirketi görmez — test dişsiz kalırdı (ders 38).
      d = await get();
      assert.notEqual(d.jobs[0].state, "canceled", "ön koşul: geri yükleme gerçekten oldu — dosyadaki iş iptalden önceki hâlinde (eski kodda Meta Bekletti, yeni kodda toparlamayla Durduruldu)");
      ctx.clock.advance(24 * HOUR + 60_000);
      await ctx.drain();
      d = await get();
      assert.equal(ctx.messages().length, 1, `kullanıcının iptal ettiği ileti geri yüklemeden sonra gönderilmemeli (§7a 26; toplu iş ${d.state}, iş ${d.jobs[0].state})`);
      assert.equal(d.state, "stopped");
    } finally {
      await ctx.close();
    }
  });
});
