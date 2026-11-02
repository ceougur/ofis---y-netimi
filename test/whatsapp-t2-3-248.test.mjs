// 2.4.8 T2 bulgu 3 (ORTA; bağımsız gözden geçirme r2): iki şirket AYNI WhatsApp numarası / WABA ile bağlıyken her şirket kendi gizli kanca yolunu
// POST /<WABA>/subscribed_apps { override_callback_uri } ile kaydediyordu; Meta'da alternatif adres WABA + uygulama başına TEKTİR (plan §3 "Kanca adresi UYGULAMA
// düzeyinde tektir; messages alanı için WABA ya da numara başına başka adres"; webhooks/override) → son kaydeden kazanıyor, öbür şirketin durum bildirimleri hiç
// gelmiyordu ("active" görünen kayıt bakım turunda yeniden kaydedilmiyordu). Beklenen (plan §3 C, §7a 16–18): WABA başına TEK kayıt; gelen bildirim kendi
// şirketinin işine yazılır (wamid'le), bilinmeyen wamid düşer; iki şirketin de teslim bildirimi kendi işine.
// Düzenek: gerçek program (iki şirket) + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + programın uzak dinleyicisi (kapıcının geçirdiği yol) + sahte saat.
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const PUBLIC = "http://ofisx.destekofis.test";
function post(base, pathName, body) {
  const url = new URL(base);
  const payload = Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method: "POST", path: pathName, headers: { "content-type": "application/json", "content-length": payload.length } }, res => {
      const parts = [];
      res.on("data", chunk => parts.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(payload);
  });
}
const event = (ctx, statuses) =>
  JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses: statuses.map(([id, status]) => ({ id, status, timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905321112233", pricing: { billable: true } })) } }] }] });
const subscribes = ctx => ctx.fake.requests.filter(item => item.method === "POST" && item.path.endsWith("/subscribed_apps"));

async function twoCompanies() {
  const ctx = await startWa({ maxCompanies: 2 });
  try {
    const created = await ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const second = created.data.data.company || created.data.data;
    const q = `hofCompany=${encodeURIComponent(second.id)}`;
    assert.equal((await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
    assert.equal((await ctx.api.put(`${URLS.ack}?${q}`, { ack: true })).status, 200);
    assert.equal((await ctx.api.put(`/api/admin/office?${q}`, { name: "İkinci Şirket" })).status, 200);
    ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
    const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
    return { ctx, second, q, remoteBase: `http://127.0.0.1:${remote.port}` };
  } catch (error) {
    await ctx.close();
    throw error;
  }
}

describe("2.4.8 T2-3 — aynı WABA'yı kullanan iki şirketin ikisinin de durum bildirimi kendi işine", () => {
  it("bakım turu WABA başına TEK kayıt yapar; iki şirketten giden iletinin teslim bildirimi (tek istekte) her birinin kendi işine yazılır; bilinmeyen wamid düşer", async () => {
    const { ctx, q, remoteBase } = await twoCompanies();
    try {
      await ctx.wa.scheduler.maintain();
      await ctx.wa.scheduler.maintain();
      assert.equal(subscribes(ctx).length, 1, `aynı WABA için Meta'ya tek abonelik (geldi ${subscribes(ctx).length}); Meta'da adres WABA başına tektir`);
      const metaUri = ctx.fake.state.override;
      assert.match(metaUri, /^http:\/\/ofisx\.destekofis\.test\/wa\/kanca\/[A-Za-z0-9_-]{43}$/);
      for (const view of [(await ctx.api.get(URLS.conn)).data.data, (await ctx.api.get(`${URLS.conn}?${q}`)).data.data]) assert.equal(view.hook?.state, "active");
      // Her şirketten bir ekstre.
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const first = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
      assert.equal(first.status, 200, JSON.stringify(first.data));
      const b = (await ctx.api.post(`/api/workspace/accounts?${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" })).data.data;
      const secondBatch = await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: [b.id], preset: "thisMonth" });
      assert.equal(secondBatch.status, 200, JSON.stringify(secondBatch.data));
      await ctx.drain();
      const job1 = (await ctx.jobs(first.data.data.batch.id))[0];
      const job2 = (await ctx.api.get(`${URLS.batches}/${secondBatch.data.data.batch.id}?${q}`)).data.data.jobs[0];
      assert.equal(job1.state, "accepted");
      assert.equal(job2.state, "accepted");
      // Meta bildirimleri Meta'da KAYITLI (tek) adrese gönderir — iki şirketin iletileri aynı istekte + bilinmeyen bir wamid.
      const res = await post(remoteBase, new URL(metaUri).pathname, event(ctx, [[job1.wamid, "delivered"], [job2.wamid, "delivered"], ["wamid.BILINMEYEN0001", "delivered"]]));
      assert.equal(res.status, 200, res.text);
      const after1 = (await ctx.jobs(first.data.data.batch.id))[0];
      const after2 = (await ctx.api.get(`${URLS.batches}/${secondBatch.data.data.batch.id}?${q}`)).data.data.jobs[0];
      assert.equal(after1.state, "delivered", `001'in işi Teslim Edildi olmalı (geldi ${after1.state})`);
      assert.equal(after2.state, "delivered", `002'nin işi Teslim Edildi olmalı (geldi ${after2.state})`);
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE wamid = 'wamid.BILINMEYEN0001'").n, 0, "bilinmeyen wamid hiçbir işe yazılmadı");
      // Aylık sayım WABA kapsamı (§7a 19): iki teslim; şirket kırılımı her birinde 1.
      const s1 = (await ctx.api.get(URLS.stats)).data.data;
      const s2 = (await ctx.api.get(`${URLS.stats}?${q}`)).data.data;
      assert.equal(s1.delivered, 2);
      assert.equal(s1.company.delivered, 1);
      assert.equal(s2.company.delivered, 1);
    } finally {
      await ctx.close();
    }
  });
});
