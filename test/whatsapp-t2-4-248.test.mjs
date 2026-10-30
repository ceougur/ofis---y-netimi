// 2.4.8 T2 bulgu 4 (ORTA; bağımsız gözden geçirme r7): kanca gizli yolu (whatsapp.meta.hook) şirket dosyasındaydı, Meta'daki kayıt ise dosyanın DIŞINDA. Yedek alınır →
// adres yeniden kaydedilir (yeni gizli yol; Meta'da artık YENİ adres) → yedek geri yüklenir → dosyada ESKİ yol "Kayıtlı" görünür; Meta yeni adrese gönderir, program
// 404 döner, bakım turu "active" gördüğü için yeniden kaydetmez → durum bildirimleri kalıcı olarak kaybolur. Beklenen (plan §3 C "program adresi kendisi kaydeder";
// §6 W2 "geri yükleme makine defterini değiştirmez"): geri yükleme / Şirket Verisini Sıfırla bildirim yolunu bozmaz; bakım turu ve Bağlantıyı Sına Meta'daki
// KAYITLI adresi okuyup (D0-17b) programınkiyle karşılaştırır, farklıysa yeniden kaydeder; aynı hesap iki kurulumda çekişirse sonsuz döngüye girmez (Çakışma).
// Düzenek: gerçek program (iki şirket) + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + programın uzak dinleyicisi + sahte saat (ders 13).
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
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
const delivered = (ctx, wamid) =>
  JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses: [{ id: wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905321112233" }] } }] }] });
const subscribes = ctx => ctx.fake.requests.filter(item => item.method === "POST" && item.path.endsWith("/subscribed_apps")).length;

async function setup() {
  const ctx = await startWa({ maxCompanies: 2 });
  try {
    const created = await ctx.api.post("/api/companies", { name: "Tatbikat Şirketi", select: false });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const second = created.data.data.company || created.data.data;
    const q = `hofCompany=${encodeURIComponent(second.id)}`;
    // 001'in bağlantısı kaldırılır: yalnız ikinci şirket WhatsApp'a bağlı (geri yükleme ikinci şirkette canlı yapılır).
    assert.equal((await ctx.api.del(URLS.conn)).status, 200);
    assert.equal((await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
    assert.equal((await ctx.api.put(`${URLS.ack}?${q}`, { ack: true })).status, 200);
    assert.equal((await ctx.api.put(`/api/admin/office?${q}`, { name: "Tatbikat Şirketi" })).status, 200);
    ctx.server.app.mobileRemote.setPublicUrl(PUBLIC);
    const remote = await ctx.server.app.listenRemote(0, "127.0.0.1");
    const sendOne = async name => {
      const acc = (await ctx.api.post(`/api/workspace/accounts?${q}`, { name, phone: "0532 111 22 33", openingBalance: "1250" })).data.data;
      const batch = (await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: [acc.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      const job = (await ctx.api.get(`${URLS.batches}/${batch}?${q}`)).data.data.jobs[0];
      assert.equal(job.state, "accepted");
      return { batch, job, state: async () => (await ctx.api.get(`${URLS.batches}/${batch}?${q}`)).data.data.jobs[0].state };
    };
    return { ctx, second, q, remoteBase: `http://127.0.0.1:${remote.port}`, sendOne };
  } catch (error) {
    await ctx.close();
    throw error;
  }
}

describe("2.4.8 T2-4 — geri yükleme / sıfırlama durum bildirimi yolunu bozmaz; Meta'daki adres denetlenir", () => {
  it("yedek → Yeniden Kaydet → yedekten geri yükle: Meta'nın KAYITLI adresine gelen bildirim kabul edilir (404 değil) ve işe yazılır; Şirket Verisini Sıfırla da bozmaz", async () => {
    const { ctx, second, q, remoteBase, sendOne } = await setup();
    try {
      assert.equal((await ctx.api.post(`${URLS.conn}/hook?${q}`, {})).status, 200);
      const backup = await ctx.api.post("/api/admin/backups", { scope: "one", companyId: second.id });
      assert.equal(backup.status, 200, JSON.stringify(backup.data));
      const name = backup.data.data.backups[0].name;
      assert.equal((await ctx.api.post(`${URLS.conn}/hook?${q}`, {})).status, 200, "Yeniden Kaydet → Meta'da yeni adres");
      const metaUri = ctx.fake.state.override;
      const restored = await ctx.api.post("/api/admin/backups/restore", { name, company: second.id, confirm: second.code, password: ADMIN_PASSWORD });
      assert.equal(restored.status, 200, JSON.stringify(restored.data));
      const sent = await sendOne("Ayşe Yılmaz");
      const res = await post(remoteBase, new URL(metaUri).pathname, delivered(ctx, sent.job.wamid));
      assert.equal(res.status, 200, `Meta'nın kayıtlı adresi geri yüklemeden sonra da açık olmalı (geldi ${res.status} ${res.text.slice(0, 120)})`);
      assert.equal(await sent.state(), "delivered");
      // Bakım turu Meta'daki adresi (saatte en çok bir kez) okur; aynı olduğu için yeniden KAYDETMEZ.
      const before = subscribes(ctx);
      ctx.clock.advance(2 * HOUR);
      await ctx.wa.scheduler.maintain();
      assert.equal(subscribes(ctx), before, "adres aynıyken yeniden abonelik yok");
      // Şirket Verisini Sıfırla (hareketler): bildirim yolu yine açık.
      const reset = await ctx.api.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: second.code, password: ADMIN_PASSWORD });
      assert.equal(reset.status, 200, JSON.stringify(reset.data));
      const again = await sendOne("Burak Kaya");
      const res2 = await post(remoteBase, new URL(ctx.fake.state.override).pathname, delivered(ctx, again.job.wamid));
      assert.equal(res2.status, 200, res2.text);
      assert.equal(await again.state(), "delivered");
    } finally {
      await ctx.close();
    }
  });

  it("Meta'daki adres değiştirilince bakım turu fark eder ve yeniden kaydeder; 24 saat içinde yine değişirse (iki kurulum çekişmesi) 'Çakışma' der, Bağlantıyı Sına bu bilgisayarı seçer", async () => {
    const { ctx, q, remoteBase, sendOne } = await setup();
    try {
      await ctx.wa.scheduler.maintain();
      assert.equal(subscribes(ctx), 1, "bakım turu kaydetti");
      const ours = ctx.fake.state.override;
      // Meta'da adres başka bir yere çevrildi (ör. müşteri panelden değiştirdi).
      ctx.fake.state.override = "https://baska.example.com/webhook";
      ctx.clock.advance(HOUR + 60_000);
      await ctx.wa.scheduler.maintain();
      assert.equal(subscribes(ctx), 2, "Meta'daki adres farklı görülünce yeniden kaydedildi");
      assert.notEqual(ctx.fake.state.override, ours);
      assert.match(ctx.fake.state.override, /^http:\/\/ofisx\.destekofis\.test\/wa\/kanca\//);
      const sent = await sendOne("Ayşe Yılmaz");
      assert.equal((await post(remoteBase, new URL(ctx.fake.state.override).pathname, delivered(ctx, sent.job.wamid))).status, 200);
      assert.equal(await sent.state(), "delivered");
      // 24 saat içinde YİNE başka (DestekOfis) bilgisayarın adresine çevrildi: iki kurulum sırayla birbirini ezmesin.
      const other = "https://baskaofis.destekofis.net/wa/kanca/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      ctx.fake.state.override = other;
      ctx.clock.advance(HOUR + 60_000);
      await ctx.wa.scheduler.maintain();
      ctx.clock.advance(HOUR + 60_000);
      await ctx.wa.scheduler.maintain();
      assert.equal(subscribes(ctx), 2, "çekişmede kendiliğinden yeniden kaydedilmedi");
      const view = (await ctx.api.get(`${URLS.conn}?${q}`)).data.data;
      assert.equal(view.hook.state, "conflict");
      assert.match(view.hook.error, /başka bir bilgisayarda/);
      // Bağlantıyı Sına: bu kurulum seçilir (Meta'ya yeniden kaydedilir).
      const tested = await ctx.api.post(`${URLS.conn}/test?${q}`, {});
      assert.equal(tested.status, 200, JSON.stringify(tested.data));
      assert.equal(subscribes(ctx), 3);
      assert.equal(tested.data.data.hook.state, "active");
      assert.match(ctx.fake.state.override, /^http:\/\/ofisx\.destekofis\.test\/wa\/kanca\//);
    } finally {
      await ctx.close();
    }
  });
});
