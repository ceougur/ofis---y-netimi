// 2.4.8 W2 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W2, §7a netleştirmeler, §8 "Nasıl bozulur?"): WhatsApp Business API gönderim çekirdeği — kuyruk + işçi + göç v40
// + makine defteri. Gerçek program + YEREL sahte Meta Graph (ders 30; test/whatsapp-sahte-graph.mjs — aynı el, kâhin DEĞİL: ders 5) + elle sürülen işçi (ders 20) +
// sahte saat (ders 13: gece yarısı, kayan 24 saat). Beklenen sayılar planın kurallarından (§6 W2, §7a) ve testin girdiği veriden yazılır (programın kodundan değil).
// "Nasıl bozulur" maddeleri: ÇİFT (zaman aşımı sonrası yeniden deneme, yanıt gelmeden kesinti, iki kullanıcı aynı cariye, çift tık / iki sekme, Başarısızları
// Yeniden Dene kabul edilmiş işte), YANLIŞ KİŞİ ("+" olmadan, aynı numaralı iki cari), YANLIŞ İÇERİK (başka carinin PDF'i, metin ≠ PDF, alacaklı bakiye),
// HESAP / META (190, 131026, 130429, 131056, 131049, 131048, kod 2, gövdesiz 5xx, bağlantı reddi, şablon onaysız / Pazarlama'ya alındı), 24 saatte farklı kişi
// sınırı (portföyün başka şirketi de sayar), GÜVENLİK (yetkisiz, onay kutusu), TARİH (gece yarısı).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createUser, removeTestDir } from "./helpers.mjs";
import { pdfText } from "./banka-210-ortak.mjs";
import { OFFICE, PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const toPhone = digits => `+90${digits}`;
const sentTo = (ctx, phone) => ctx.messages().filter(item => item.to === phone).length;
const requestsTo = (ctx, phone) => ctx.messageRequests().filter(item => item.body?.to === phone).length;
const metaError = (code, message = "hata") => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "Abc" } });
const byName = jobs => Object.fromEntries(jobs.map(job => [job.accountName, job]));

describe("2.4.8 W2 — ön koşullar, yetki ve onay kutusu (sunucuda; §7a 28, 29, 31)", () => {
  it("ret sırası bağlı değil → yetki → lisans → onay → şablon; firma adı yok; şablon onaysız / Pazarlama'da → 409, Meta'ya ileti gitmez, toplu iş kaydı oluşmaz", async () => {
    const ctx = await startWa({ connect: false, ack: false });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const body = { kind: "statement", ids: [a.id], preset: "thisMonth" };
      const staff = await createUser(ctx.server, ctx.api, { username: "w2-personel", role: "personel" });
      // Bağlı değil: yetkisiz kullanıcı da önce "bağlı değil" görür (§7a 29).
      for (const client of [ctx.api, staff]) {
        const res = await client.post(URLS.batches, body);
        assert.equal(res.status, 409);
        assert.equal(res.data.code, "whatsapp-not-configured");
      }
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      // Yetki: whatsapp.send olmayan kullanıcı hiçbir gönderim ucunu kullanamaz; onayı yalnız yönetici verir.
      for (const [method, url, payload] of [["get", URLS.ack], ["put", URLS.ack, { ack: true }], ["post", URLS.batches, body], ["post", URLS.preview, body], ["get", URLS.batches], ["get", URLS.stats], ["put", URLS.sending, { dailyCap: 5 }]]) {
        const out = await staff[method](url, payload);
        assert.equal(out.status, 403, `${method} ${url} personel → 403`);
      }
      // ONAY KUTUSU (plan §1; §7a 28): "Aydınlatma metnimi okudum, carilerime ulaştıracağım." işaretlenmeden gönderim BAŞLAMAZ — istemci atlatılsa da.
      let res = await ctx.batch(body);
      assert.equal(res.status, 409);
      assert.equal(res.data.code, "whatsapp-ack-required", JSON.stringify(res.data));
      assert.equal((await ctx.api.post(URLS.preview, body)).data.code, "whatsapp-ack-required");
      const ackView = (await ctx.api.get(URLS.ack)).data.data;
      assert.equal(ackView.acknowledged, false);
      assert.equal(ackView.text, "Aydınlatma metnimi okudum, carilerime ulaştıracağım.");
      assert.equal((await ctx.api.put(URLS.ack, { ack: true })).status, 200);
      ctx.store.setSetting("office.name", "");
      res = await ctx.batch(body);
      assert.equal(res.data.code, "whatsapp-office-missing");
      ctx.store.setSetting("office.name", OFFICE);
      // Şablon (plan §2.4; §7a 27): yalnız APPROVED + UTILITY ile gönderilir.
      const template = ctx.fake.state.templates.find(item => item.name === "destekofis_ekstre");
      for (const [patch, code] of [[{ status: "PENDING" }, "whatsapp-template-pending"], [{ status: "REJECTED" }, "whatsapp-template-rejected"], [{ status: "PAUSED" }, "whatsapp-template-paused"], [{ status: "APPROVED", category: "MARKETING" }, "whatsapp-template-marketing"], [{ name: "baska_sablon" }, "whatsapp-template-missing"]]) {
        const saved = { ...template };
        Object.assign(template, patch);
        res = await ctx.batch(body);
        Object.assign(template, saved);
        assert.equal(res.status, 409, `${JSON.stringify(patch)} → 409`);
        assert.equal(res.data.code, code, `${JSON.stringify(patch)} → ${code}: ${JSON.stringify(res.data)}`);
        if (code === "whatsapp-template-marketing") assert.match(res.data.error, /Şablon Pazarlama'ya Alındı/);
      }
      // §7a 31: bütün seçilenler elenince toplu iş kaydı OLUŞMAZ; nedenler yanıtta.
      const none = await ctx.account("Numarasız", "");
      res = await ctx.batch({ ...body, ids: [none.id] });
      assert.equal(res.status, 400);
      assert.equal(res.data.code, "whatsapp-nothing");
      assert.deepEqual(res.data.summary.skipped, { "Telefon yok": 1 });
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_batches").n, 0, "hiçbir toplu iş açılmadı");
      assert.equal(ctx.messageRequests().length, 0, "Meta'ya ileti isteği gitmedi");
      res = await ctx.batch(body);
      assert.equal(res.status, 200, JSON.stringify(res.data));
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 W2 — gönderim: içerik, eleme nedenleri, durum makinesi", () => {
  it("ekstre: belge başlıklı şablon (PDF + 4 değişken, '+' ile); sabit hat ve yurt dışı ELENMEZ, aynı numaralı iki cariye iki ileti; numarasız / WhatsApp Mesajı İstemiyor elenir; sıra = seçim sırası", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const b = await ctx.account("Mehmet Kaya", "0212 555 00 11", 50);
      const c = await ctx.account("Zeynep Ak", "05441112233", 0, { waOptOut: true });
      const d = await ctx.account("Ali Veli", "", 10);
      const e = await ctx.account("Fatma Er", "5551234567", -300);
      const f = await ctx.account("Ayşe'nin Şirketi", "0532 111 22 33", 75);
      const g = await ctx.account("John Smith", "+44 20 7946 0958", 20);
      assert.equal(c.waOptOut, 1, "yeni caride işaret kaydedildi");
      const ids = [e.id, a.id, b.id, c.id, d.id, f.id, g.id];
      const preview = (await ctx.api.post(URLS.preview, { kind: "statement", ids, preset: "thisMonth" })).data.data;
      assert.equal(preview.total, 7);
      assert.equal(preview.sendable, 5);
      assert.deepEqual(preview.skipped, { "WhatsApp Mesajı İstemiyor": 1, "Telefon yok": 1 });
      assert.equal(preview.limit.limit, 250, "Meta basamağı TIER_250");
      assert.equal(ctx.messageRequests().length, 0, "önizleme ileti göndermez");
      const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth", requestId: "w2-mutlu-0001" });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const id = res.data.data.batch.id;
      assert.equal(res.data.data.batch.counts.pending, 5);
      assert.equal(res.data.data.batch.counts.skipped, 2);
      assert.equal(await ctx.drain(), 5, "beş iş yürütüldü");
      const messages = ctx.messages();
      assert.deepEqual(messages.map(item => item.to), [toPhone("5551234567"), toPhone("5321112233"), toPhone("2125550011"), toPhone("5321112233"), "+442079460958"], "sıra = seçim sırası; aynı numaraya iki cari, iki ileti");
      const ayse = messages[1];
      assert.equal(ayse.template, "destekofis_ekstre");
      assert.equal(ayse.language, "tr");
      // §6 W5 / §7a 21–23: {{1}} ad, {{2}} firma, {{3}} dönem, {{4}} dönem sonu bakiyesi. Bu Ay = 01.11.2026 – bugün (03.11.2026).
      assert.deepEqual(ayse.params, ["Ayşe Yılmaz", OFFICE, "01.11.2026 – 03.11.2026", "1.250,00 TL (Borçlu)"]);
      assert.equal(ayse.document.filename, "Ekstre Ayşe Yılmaz 01.11.2026-03.11.2026.pdf");
      assert.deepEqual(messages[0].params.slice(3), ["300,00 TL (Alacaklı)"], "eksi bakiye (§7a 22)");
      assert.equal(messages[3].params[0], "Ayşe'nin Şirketi", "aynı numaradaki ikinci cari kendi ekstresiyle");
      assert.equal(messages[3].params[3], "75,00 TL (Borçlu)");
      // PDF: kişinin kendi ekstresi, aynı dönem ve aynı bakiye (metin = PDF).
      const pdf = ctx.fake.state.media.get(ayse.document.id);
      assert.ok(pdf, "medya yüklenmiş");
      const text = pdfText(pdf.data);
      assert.match(text, /Cari Ekstre · Ayşe Yılmaz/);
      assert.match(text, /01\.11\.2026 – 03\.11\.2026/);
      assert.match(text, /1\.250,00 TL Borçlu/);
      assert.doesNotMatch(text, /Fatma Er|Şirketi/, "başka carinin PDF'i değil");
      assert.equal(new Set(messages.map(item => item.document.id)).size, 5, "her kişiye kendi medyası");
      const detail = await ctx.detail(id);
      assert.equal(detail.state, "done");
      const jobs = byName(detail.jobs);
      assert.equal(jobs["Ayşe Yılmaz"].state, "accepted");
      assert.equal(jobs["Ayşe Yılmaz"].stateLabel, "Meta Kabul Etti");
      assert.match(jobs["Ayşe Yılmaz"].wamid, /^wamid\./);
      assert.equal(jobs["Mehmet Kaya"].state, "accepted", "sabit hat elenmez (Meta karar verir)");
      assert.equal(jobs["Zeynep Ak"].reason, "WhatsApp Mesajı İstemiyor");
      assert.equal(jobs["Ali Veli"].reason, "Telefon yok");
      assert.equal(ayse.opaque, jobs["Ayşe Yılmaz"].id, "iş kimliği biz_opaque_callback_data'da");
      assert.deepEqual(jobs["Ayşe Yılmaz"].params, ayse.params, "ileti metni değil değişken değerleri saklanır");
      const history = (await ctx.api.get(`/api/workspace/whatsapp/history?accountId=${a.id}`)).data.data;
      assert.equal(history[0].channel, "api");
      assert.equal(history[0].state, "accepted");
    } finally {
      await ctx.close();
    }
  });

  it("ödeme hatırlatma (§7a 20): {{3}} en eski gecikmiş vade, {{4}} vadesi geçmiş toplam, {{5}} güncel bakiye; gecikmiş borcu olmayan elenir", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Taksitli Kişi", "0533 444 55 66");
      const plan = await ctx.api.post("/api/workspace/plans", { accountId: a.id, name: "Taksit", total: "3000", count: 3, firstDue: "2026-11-15", startDate: "2026-11-03" });
      assert.equal(plan.status, 200, `taksit kartı: ${JSON.stringify(plan.data).slice(0, 300)}`);
      const b = await ctx.account("Taksitsiz Borçlu", "0533 444 55 67", 500);
      const c = await ctx.account("Borçsuz", "0533 444 55 68");
      const early = await ctx.batch({ kind: "reminder", ids: [a.id, b.id, c.id] });
      assert.equal(early.status, 400, "vadesi gelmemiş taksitte gecikmiş borç yok");
      assert.deepEqual(early.data.summary.skipped, { "Gecikmiş Borç Yok": 3 });
      // İki taksitin vadesi geçti (15.11 ve 15.12), üçüncüsü (15.01) gelmedi.
      ctx.clock.set("2026-12-20T10:00:00+03:00");
      const res = await ctx.batch({ kind: "reminder", ids: [a.id, b.id, c.id] });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      await ctx.drain();
      const jobs = byName(await ctx.jobs(res.data.data.batch.id));
      assert.equal(jobs["Taksitsiz Borçlu"].reason, "Gecikmiş Borç Yok");
      assert.equal(jobs["Borçsuz"].reason, "Gecikmiş Borç Yok");
      const message = ctx.messages().find(item => item.to === toPhone("5334445566"));
      assert.ok(message, "taksitli kişiye gitti");
      assert.equal(message.template, "destekofis_odeme_hatirlatma");
      assert.equal(message.document, null, "hatırlatmada belge yok");
      assert.deepEqual(message.params, ["Taksitli Kişi", OFFICE, "15.11.2026", "2.000,00 TL", "3.000,00 TL (Borçlu)"]);
      // R3 (BAŞ MİMAR KARARI: hatırlatmanın dönemi gönderim GÜNÜ): aynı gün ikinci hatırlatma "Daha Önce Gönderildi"; ertesi gün serbest.
      ctx.clock.set("2026-12-20T23:50:00+03:00");
      const sameDay = await ctx.batch({ kind: "reminder", ids: [a.id] });
      assert.equal(sameDay.status, 400);
      assert.deepEqual(sameDay.data.summary.skipped, { "Daha Önce Gönderildi": 1 });
      ctx.clock.set("2026-12-21T09:00:00+03:00");
      const nextDay = await ctx.batch({ kind: "reminder", ids: [a.id] });
      assert.equal(nextDay.status, 200, JSON.stringify(nextDay.data));
      assert.equal(nextDay.data.data.summary.alreadySent.count, 0);
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 W2 — çift gönderim yok (§7a 9, 10)", () => {
  it("aynı istek kimliği → tek toplu iş; bekleyen iş varken aynı cari + şablon + dönem 'Zaten Kuyrukta' (iki sekme / iki kullanıcı); bittikten sonra 'Daha Önce Gönderildi' (R3: varsayılan Bunları Çıkar, sendAgain ile Yine de Gönder)", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Çift Tık", "0535 000 00 01", 100);
      const body = { kind: "statement", ids: [a.id], preset: "thisMonth", requestId: "w2-cift-tik-01" };
      const [one, two] = await Promise.all([ctx.batch(body), ctx.batch(body)]);
      assert.equal(one.status, 200, JSON.stringify(one.data));
      assert.equal(two.status, 200, JSON.stringify(two.data));
      assert.equal(one.data.data.batch.id, two.data.data.batch.id, "aynı toplu iş");
      assert.ok(one.data.data.reused || two.data.data.reused, "biri yeniden kullanıldı");
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_batches").n, 1);
      // Başka sekme / başka kullanıcı (yeni istek kimliği): iş beklerken aynı cari elenir.
      const other = await ctx.batch({ ...body, requestId: "w2-cift-tik-02" });
      assert.equal(other.status, 400);
      assert.equal(other.data.code, "whatsapp-nothing");
      assert.deepEqual(other.data.summary.skipped, { "Zaten Kuyrukta": 1 });
      // Başka dönem başka ileti: elenmez.
      const last = await ctx.batch({ ...body, preset: "lastMonth", requestId: "w2-cift-tik-03" });
      assert.equal(last.status, 200);
      await ctx.drain();
      assert.equal(sentTo(ctx, toPhone("5350000001")), 2, "bu ay + geçen ay");
      // R3 (plan §7a revizyonu): bekleyen iş kalmadı, ama bu dönem bu cariye Meta'ya kabul ettirildi → önizleme bildirir, açık bayrak olmadan elenir.
      const b = await ctx.account("Yeni Kişi", "0535 000 00 02", 100);
      const preview = (await ctx.api.post(URLS.preview, { ...body, ids: [a.id, b.id] })).data.data;
      assert.equal(preview.alreadySent.count, 1, "bir kişiye bu dönem daha önce gönderildi");
      assert.ok(preview.alreadySent.last, "son gönderim tarihi");
      assert.equal(preview.alreadySent.included, 0, "varsayılan: Bunları Çıkar");
      assert.deepEqual(preview.skipped, { "Daha Önce Gönderildi": 1 });
      const removed = await ctx.batch({ ...body, ids: [a.id, b.id], requestId: "w2-cift-tik-04" });
      assert.equal(removed.status, 200, JSON.stringify(removed.data));
      await ctx.drain();
      assert.equal(sentTo(ctx, toPhone("5350000001")), 2, "daha önce gönderilene ikinci ileti YOK");
      assert.equal(sentTo(ctx, toPhone("5350000002")), 1, "yeni kişiye gitti");
      const alone = await ctx.batch({ ...body, requestId: "w2-cift-tik-05" });
      assert.equal(alone.status, 400, "hepsi elendi → kayıt yok (§7a 31)");
      assert.deepEqual(alone.data.summary.skipped, { "Daha Önce Gönderildi": 1 });
      // Kullanıcı "Yine de Gönder" dedi (sendAgain): gider; süre penceresi yok (§7a 9).
      const again = await ctx.batch({ ...body, sendAgain: true, requestId: "w2-cift-tik-06" });
      assert.equal(again.status, 200, JSON.stringify(again.data));
      assert.equal(again.data.data.summary.alreadySent.included, 1);
      await ctx.drain();
      assert.equal(sentTo(ctx, toPhone("5350000001")), 3);
    } finally {
      await ctx.close();
    }
  });

  it("zaman aşımı / bağlantı kopması → Sonucu Belirsiz, kendiliğinden yeniden GÖNDERİLMEZ, toplu iş SÜRER; Yine de Gönder onay ister", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Zaman Aşımı", "0536 000 00 01", 10);
      const b = await ctx.account("Kopan Bağlantı", "0536 000 00 02", 10);
      const c = await ctx.account("Sonraki Kişi", "0536 000 00 03", 10);
      const res = await ctx.batch({ kind: "statement", ids: [a.id, b.id, c.id], preset: "thisMonth" });
      assert.equal(res.status, 200);
      ctx.fake.state.hang = /^POST \/106540352242922\/messages$/;
      await ctx.wa.scheduler.runOnce();
      ctx.fake.state.hang = null;
      ctx.fake.state.dropAfter = /^POST \/106540352242922\/messages$/;
      await ctx.wa.scheduler.runOnce();
      ctx.fake.state.dropAfter = null;
      await ctx.drain();
      let jobs = byName(await ctx.jobs(res.data.data.batch.id));
      assert.equal(jobs["Zaman Aşımı"].state, "uncertain");
      assert.equal(jobs["Zaman Aşımı"].stateLabel, "Sonucu Belirsiz");
      assert.equal(jobs["Kopan Bağlantı"].state, "uncertain", "işlendi ama yanıt gelmedi → belirsiz");
      assert.equal(jobs["Sonraki Kişi"].state, "accepted", "toplu iş sürdü (§7a 10)");
      for (let i = 0; i < 3; i += 1) {
        ctx.clock.advance(HOUR);
        await ctx.drain();
      }
      assert.equal(requestsTo(ctx, toPhone("5360000001")), 1, "belirsiz iş yeniden gönderilmedi");
      assert.equal(requestsTo(ctx, toPhone("5360000002")), 1, "belirsiz iş yeniden gönderilmedi");
      assert.equal((await ctx.detail(res.data.data.batch.id)).state, "done", "belirsiz iş toplu işin bitişine engel değil");
      const noConfirm = await ctx.api.post(`/api/workspace/whatsapp/jobs/${jobs["Zaman Aşımı"].id}/send-anyway`, {});
      assert.equal(noConfirm.status, 409);
      assert.equal(noConfirm.data.code, "whatsapp-confirm-required");
      const confirmed = await ctx.api.post(`/api/workspace/whatsapp/jobs/${jobs["Zaman Aşımı"].id}/send-anyway`, { confirm: true });
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data));
      await ctx.drain();
      assert.equal(requestsTo(ctx, toPhone("5360000001")), 2, "yalnız bilinçli 'Yine de Gönder' ile ikinci kez");
      jobs = byName(await ctx.jobs(res.data.data.batch.id));
      assert.equal(jobs["Zaman Aşımı"].state, "uncertain", "eski iş kayıtta belirsiz kalır");
    } finally {
      await ctx.close();
    }
  });

  it("kabul yazımı düştü (disk dolu): iş 'Gönderiliyor'da kalır, defterdeki kabulle çözülür; program yeniden açılınca da İKİNCİ ileti yok", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-w2-kabul-"));
    let fail = true;
    const ctx = await startWa({ dataDir, whatsappFault: point => fail && point === "db-accept" });
    const fake = ctx.fake;
    try {
      const a = await ctx.account("Kabul Yazımı", "0537 000 00 01", 10);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.wa.scheduler.runOnce();
      assert.equal((await ctx.jobs(id))[0].state, "sending", "kabul yazılamadı, iş Gönderiliyor'da");
      assert.equal(ctx.messages().length, 1);
      fail = false;
      await ctx.drain();
      assert.equal(ctx.messages().length, 1, "Gönderiliyor'daki iş yeniden gönderilmez");
      await ctx.server.close();
      const again = await startWa({ dataDir, fake, connect: false, ack: false });
      try {
        const job = (await again.jobs(id))[0];
        assert.equal(job.state, "accepted");
        assert.match(job.wamid, /^wamid\.SAHTE/);
        await again.drain();
        assert.equal(again.messages().length, 1, "yeniden açılışta ikinci ileti yok");
      } finally {
        await again.server.close();
      }
    } finally {
      await fake.close();
      removeTestDir(dataDir);
    }
  });
});

describe("2.4.8 W2 — Meta hata sınıfları (plan §6 W2 + §7a 11–15, 30, 32)", () => {
  it("190 (belirteç) → hatayı alan iş Başarısız (kodlu), toplu iş duraklar, bekleyenler Duraklatıldı, sonraki kişilere istek gitmez; Devam Et ile sürer", async () => {
    const ctx = await startWa();
    try {
      const ids = [];
      for (let i = 1; i <= 3; i += 1) ids.push((await ctx.account(`Belirteç ${i}`, `0538 000 00 0${i}`, 10)).id);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 401, body: metaError(190, "Error validating access token") });
      const id = (await ctx.batch({ kind: "statement", ids, preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      let detail = await ctx.detail(id);
      assert.equal(detail.state, "paused");
      assert.equal(detail.pauseCode, "meta-token");
      assert.match(detail.pauseReason, /süresi dolmuş/);
      assert.equal(ctx.messageRequests().length, 1, "yalnız ilk istek");
      assert.equal(detail.counts.failed, 1);
      assert.equal(detail.jobs[0].errorCode, 190);
      assert.equal(detail.counts.paused, 2, "bekleyenler Duraklatıldı");
      assert.equal(detail.jobs[1].stateLabel, "Duraklatıldı");
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/resume`, {})).status, 200);
      await ctx.drain();
      detail = await ctx.detail(id);
      assert.equal(detail.state, "done");
      assert.equal(detail.counts.accepted, 2);
      assert.equal(ctx.messages().length, 2);
      const retry = await ctx.api.post(`${URLS.batches}/${id}/retry-failed`, {});
      assert.equal(retry.status, 200);
      await ctx.drain();
      assert.equal(ctx.messages().length, 3, "hatayı alan iş yeniden denemede bir kez");
    } finally {
      await ctx.close();
    }
  });

  it("131026 (alıcı) ve tanınmayan kod → o iş Başarısız (kodlu), toplu iş sürer; Başarısızları Yeniden Dene yalnız onları YENİ işle gönderir", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Kullanmıyor", "0539 000 00 01", 10);
      const b = await ctx.account("Kullanıyor", "0539 000 00 02", 10);
      const c = await ctx.account("Tanınmayan Kod", "0539 000 00 03", 10);
      ctx.fake.state.recipientErrors[toPhone("5390000001")] = { status: 400, body: metaError(131026, "Message undeliverable") };
      ctx.fake.state.recipientErrors[toPhone("5390000003")] = { status: 400, body: metaError(999999, "Bilinmeyen") };
      const id = (await ctx.batch({ kind: "statement", ids: [a.id, b.id, c.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      const jobs = byName(await ctx.jobs(id));
      assert.equal(jobs["Kullanmıyor"].state, "failed");
      assert.equal(jobs["Kullanmıyor"].errorCode, 131026);
      assert.match(jobs["Kullanmıyor"].reason, /WhatsApp kullanmıyor/);
      assert.equal(jobs["Tanınmayan Kod"].state, "failed");
      assert.equal(jobs["Tanınmayan Kod"].errorCode, 999999);
      assert.equal(jobs["Kullanıyor"].state, "accepted");
      assert.equal((await ctx.detail(id)).state, "done");
      ctx.fake.state.recipientErrors = {};
      const retry = await ctx.api.post(`${URLS.batches}/${id}/retry-failed`, {});
      assert.equal(retry.status, 200, JSON.stringify(retry.data));
      assert.equal(retry.data.data.batch.total, 2, "yalnız başarısızlar");
      await ctx.drain();
      assert.equal(sentTo(ctx, toPhone("5390000001")), 1);
      assert.equal(sentTo(ctx, toPhone("5390000003")), 1);
      assert.equal(sentTo(ctx, toPhone("5390000002")), 1, "kabul edilmiş kişiye ikinci ileti yok");
    } finally {
      await ctx.close();
    }
  });

  it("geçici (130429): iş 30 sn → 2 dk → 15 dk bekler, 3 denemeden sonra Başarısız; toplu işte art arda 5 geçici → duraklar; kod 2 → bekleyip BİR kez; başarılı işin hata kodu temizlenir", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Geçici", "0540 000 00 01", 10);
      for (let i = 0; i < 4; i += 1) ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 429, body: metaError(130429, "Rate limit hit") });
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      const waits = [];
      for (let i = 0; i < 5; i += 1) {
        await ctx.drain({ maintain: false });
        const job = (await ctx.detail(id)).jobs[0];
        if (job.state !== "pending") break;
        waits.push(Math.round((Date.parse(job.nextAt) - ctx.clock.ms()) / 1000));
        ctx.clock.advance(Date.parse(job.nextAt) - ctx.clock.ms() + 1000);
      }
      assert.deepEqual(waits, [30, 120, 900], "30 sn → 2 dk → 15 dk");
      let job = (await ctx.detail(id)).jobs[0];
      assert.equal(job.state, "failed", "3 yeniden denemeden sonra Başarısız");
      assert.equal(job.errorCode, 130429);
      assert.equal(requestsTo(ctx, toPhone("5400000001")), 4);
      // Art arda 5 geçici (iki kişi): toplu iş duraklar.
      const b = await ctx.account("Ard Arda 1", "0540 000 00 02", 10);
      const c = await ctx.account("Ard Arda 2", "0540 000 00 03", 10);
      for (let i = 0; i < 5; i += 1) ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 429, body: metaError(130429, "Rate limit hit") });
      const id2 = (await ctx.batch({ kind: "statement", ids: [b.id, c.id], preset: "thisMonth" })).data.data.batch.id;
      for (let i = 0; i < 6; i += 1) {
        await ctx.drain({ maintain: false });
        if ((await ctx.detail(id2)).state === "paused") break;
        ctx.clock.advance(3 * MIN);
      }
      const paused = await ctx.detail(id2);
      assert.equal(paused.state, "paused");
      assert.equal(paused.pauseCode, "meta-unreachable");
      assert.equal(ctx.messageRequests().length, 4 + 5, "beşinci geçici hatada durdu");
      // Kod 2 (geçici kesinti) → bekler, sonra BİR kez gider; hata kodu temizlenir (§7a 32).
      ctx.fake.state.failQueue = [{ match: /\/messages$/, status: 503, body: metaError(2, "Service temporarily unavailable") }];
      await ctx.api.post(`${URLS.batches}/${id2}/resume`, {});
      for (let i = 0; i < 4; i += 1) {
        await ctx.drain();
        ctx.clock.advance(16 * MIN);
      }
      const done = byName((await ctx.detail(id2)).jobs);
      assert.equal(done["Ard Arda 1"].state, "accepted", JSON.stringify(done["Ard Arda 1"]));
      assert.equal(done["Ard Arda 1"].errorCode, null, "başarılı işin hata kodu temizlendi");
      assert.equal(done["Ard Arda 1"].reason, "");
      assert.equal(done["Ard Arda 2"].state, "accepted");
      assert.equal(sentTo(ctx, toPhone("5400000002")), 1);
      // Gövdesiz 5xx: Meta işledi mi bilinmez → belirsiz.
      const d = await ctx.account("Gövdesiz", "0540 000 00 04", 10);
      ctx.fake.state.failQueue = [{ match: /\/messages$/, status: 502, raw: "<html>Bad Gateway</html>" }];
      const id3 = (await ctx.batch({ kind: "statement", ids: [d.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      job = (await ctx.detail(id3)).jobs[0];
      assert.equal(job.state, "uncertain");
    } finally {
      await ctx.close();
    }
  });

  it("R1: Meta'ya HİÇ ulaşılamıyor (internet yok) → iş Başarısız SAYILMAZ, deneme sayacı artmaz; toplu iş 'Bağlantı Bekleniyor' (Devam Et gerekmez), kaç tur sürerse sürsün duraklamaz; bağlantı dönünce kendiliğinden BİR kez gider", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ulaşılamadı", "0541 000 00 01", 10);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      // Havuzdaki canlı soket (UND_ERR_SOCKET) kasıtlı olarak BELİRSİZ sayılır (istek gitmiş olabilir); bu sınama "hiç bağlanılamadı"yı ister → sahte sunucu
      // bağlantıyı her yanıtta kapatır.
      ctx.fake.state.closeConnections = true;
      await ctx.fake.offline();
      let detail;
      try {
        await ctx.drain({ maintain: false });
        detail = await ctx.detail(id);
        assert.equal(detail.state, "running", "toplu iş duraklamadı (Devam Et gerekmez)");
        assert.equal(detail.stateLabel, "Bağlantı Bekleniyor");
        assert.match(detail.pauseReason, /Meta'ya ulaşılamıyor/);
        assert.ok(detail.waitingUntil, "yeniden deneme anı");
        let job = detail.jobs[0];
        assert.equal(job.state, "pending", JSON.stringify(job));
        assert.equal(job.attempt, 0, "ekstre: PDF yüklenemedi, ileti denenmedi");
        assert.deepEqual(ctx.wa.ledger.attempts(job.id), [], "defterde talep yok");
        // Bekleme bitmeden yeniden denenmez.
        assert.equal(await ctx.drain({ maintain: false }), 0);
        // İnternet uzun süre yok: 3 deneme / 5 art arda sınırlarının çok ötesinde — iş Başarısız olmaz, toplu iş duraklamaz.
        for (let i = 0; i < 12; i += 1) {
          ctx.clock.advance(5 * MIN + 1_000);
          await ctx.drain({ maintain: false });
        }
        detail = await ctx.detail(id);
        job = detail.jobs[0];
        assert.equal(detail.state, "running");
        assert.equal(detail.stateLabel, "Bağlantı Bekleniyor");
        assert.equal(job.state, "pending", "Başarısız SAYILMADI");
        assert.equal(job.errorCode, null);
      } finally {
        await ctx.fake.online();
      }
      ctx.clock.advance(5 * MIN + 1_000);
      await ctx.drain();
      detail = await ctx.detail(id);
      assert.equal(detail.jobs[0].state, "accepted");
      assert.equal(detail.state, "done");
      assert.equal(detail.stateLabel, "Tamamlandı");
      assert.equal(sentTo(ctx, toPhone("5410000001")), 1);
      // İleti isteğinin kendisi bağlanamayınca (belgesiz hatırlatma): deneme "gitmedi" diye deftere yazılır, iş Bekliyor, toplu iş Bağlantı Bekleniyor.
      const r = await ctx.account("Hatırlatma Reddi", "0541 000 00 02");
      assert.equal((await ctx.api.post("/api/workspace/plans", { accountId: r.id, name: "Taksit", total: "900", count: 3, firstDue: "2026-11-20", startDate: "2026-11-03" })).status, 200);
      ctx.clock.set("2026-11-25T10:00:00+03:00");
      const rid = (await ctx.batch({ kind: "reminder", ids: [r.id] })).data.data.batch.id;
      // Şablon ve sınır önceden okundu (önbellek); ileti isteği bağlanamaz.
      await ctx.fake.offline();
      try {
        await ctx.drain({ maintain: false });
      } finally {
        await ctx.fake.online();
      }
      detail = await ctx.detail(rid);
      const job = detail.jobs[0];
      assert.equal(detail.stateLabel, "Bağlantı Bekleniyor");
      assert.equal(job.state, "pending", job.reason);
      assert.deepEqual(ctx.wa.ledger.attempts(job.id).map(item => item.outcome), ["failed"], "defterde 'gitmedi'");
      ctx.clock.advance(31_000);
      await ctx.drain();
      assert.equal((await ctx.detail(rid)).jobs[0].state, "accepted");
      assert.equal(sentTo(ctx, toPhone("5410000002")), 1, "bir kez");
    } finally {
      await ctx.close();
    }
  });

  it("131056 → o kişi 1 dk sonra; 131049 → 'Meta Bekletti (24 Saat Sonra Yeniden)', aynı medyayla bir kez, yine düşerse Başarısız (§7a 14)", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Çok İleti", "0542 000 00 01", 10);
      const b = await ctx.account("Ekosistem", "0542 000 00 02", 10);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") });
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal((await ctx.detail(id)).jobs[0].state, "pending");
      ctx.clock.advance(61_000);
      await ctx.drain();
      assert.equal((await ctx.detail(id)).jobs[0].state, "accepted");
      ctx.fake.state.recipientErrors[toPhone("5420000002")] = { status: 400, body: metaError(131049, "Healthy ecosystem") };
      const id2 = (await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      let job = (await ctx.detail(id2)).jobs[0];
      assert.equal(job.state, "held");
      assert.equal(job.stateLabel, "Meta Bekletti (24 Saat Sonra Yeniden)");
      const docOf = request => request.body.template.components.find(item => item.type === "header").parameters[0].document.id;
      const firstMedia = docOf(ctx.messageRequests().at(-1));
      assert.equal(job.mediaDeleted, false, "PDF silinmez");
      ctx.clock.advance(23 * HOUR);
      await ctx.drain();
      assert.equal(requestsTo(ctx, toPhone("5420000002")), 1, "24 saat dolmadan yeniden denenmez");
      ctx.clock.advance(HOUR + MIN);
      await ctx.drain();
      job = (await ctx.detail(id2)).jobs[0];
      assert.equal(requestsTo(ctx, toPhone("5420000002")), 2, "bir kez daha");
      assert.equal(docOf(ctx.messageRequests().at(-1)), firstMedia, "aynı medya yeniden kullanıldı");
      assert.equal(job.state, "failed");
      assert.equal(job.errorCode, 131049);
    } finally {
      await ctx.close();
    }
  });

  it("R2: şablon gönderim sürerken Pazarlama'ya alınırsa en geç 10 dakikada ve HER 100 İLETİDE yeniden okunur (§7a 27 revizyonu): toplu iş durur, ileti gitmez", async () => {
    const ctx = await startWa();
    try {
      // (a) 10 dakika: saat ilerler, ileti sayısı az.
      const a = await ctx.account("Kategori 1", "0555 000 00 01", 10);
      const b = await ctx.account("Kategori 2", "0555 000 00 02", 10);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" })).data.data.batch.id;
      assert.equal(await ctx.drain({ max: 1 }), 1);
      assert.equal(ctx.messages().length, 1);
      const template = ctx.fake.state.templates.find(item => item.name === "destekofis_ekstre");
      template.category = "MARKETING";
      ctx.clock.advance(10 * MIN + 1_000);
      await ctx.drain();
      let detail = await ctx.detail(id);
      assert.equal(detail.state, "paused");
      assert.equal(detail.pauseCode, "template-marketing");
      assert.match(detail.pauseReason, /Şablon Pazarlama'ya Alındı/);
      assert.equal(ctx.messages().length, 1, "pazarlamaya alınmış şablonla ileti yok");
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/cancel`, {})).status, 200);
      // (b) 100 ileti: saat HİÇ ilerlemez; 100. iletiden sonra kategori yeniden okunur.
      template.category = "UTILITY";
      const ids = [];
      for (let i = 0; i < 101; i += 1) ids.push((await ctx.account(`Yüz Kişi ${i}`, `0556 000 ${String(i).padStart(4, "0")}`, 10)).id);
      const big = await ctx.batch({ kind: "statement", ids, preset: "lastMonth" });
      assert.equal(big.status, 200, JSON.stringify(big.data));
      const before = ctx.messages().length;
      assert.equal(await ctx.drain({ max: 100 }), 100);
      assert.equal(ctx.messages().length - before, 100, "100 ileti gitti");
      template.category = "MARKETING";
      await ctx.drain();
      detail = await ctx.detail(big.data.data.batch.id);
      assert.equal(ctx.messages().length - before, 100, "101. ileti pazarlama şablonuyla GİTMEDİ");
      assert.equal(detail.pauseCode, "template-marketing");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 W2 — 24 saatte farklı kişi sınırı (makine defteri, WABA kimliğine göre; §7a 4, 30)", () => {
  it("sınır = min(Meta basamağı, elle sınır); fazlası 'Sınır Nedeniyle Bekliyor', pencere (en eski + 24 sa) açılınca sürer; gece yarısında SIFIRLANMAZ; pencerede sayılmış kişi GEÇER", async () => {
    // Gece yarısı PROGRAMIN günüdür (yerel saat; Türkiye kurulumunda Türkiye saati): test hangi saat diliminde koşarsa koşsun yerel 23:55'ten başlar.
    const ctx = await startWa({ now: { time: new Date(2026, 10, 3, 23, 55).toISOString(), fixed: true } });
    try {
      assert.equal((await ctx.api.put(URLS.sending, { dailyCap: 2 })).status, 200);
      const ids = [];
      for (let i = 1; i <= 3; i += 1) ids.push((await ctx.account(`Sınır ${i}`, `0543 000 00 0${i}`, 10)).id);
      const preview = (await ctx.api.post(URLS.preview, { kind: "statement", ids, preset: "thisMonth" })).data.data;
      assert.equal(preview.limit.limit, 2);
      assert.equal(preview.limit.later, 1, "biri yarına kalacak");
      const id = (await ctx.batch({ kind: "statement", ids, preset: "thisMonth" })).data.data.batch.id;
      const firstAt = ctx.clock.ms();
      await ctx.drain();
      let detail = await ctx.detail(id);
      assert.equal(detail.counts.accepted, 2);
      assert.equal(detail.counts.limited, 1);
      const waiting = detail.jobs.find(job => job.state === "limited");
      assert.equal(waiting.stateLabel, "Sınır Nedeniyle Bekliyor");
      assert.ok(Math.abs(Date.parse(waiting.nextAt) - (firstAt + DAY)) <= 2_000, `pencere en eski kabul + 24 sa (${waiting.nextAt})`);
      assert.equal(detail.state, "running", "toplu iş sürer");
      ctx.clock.advance(15 * MIN);
      assert.equal(ctx.server.app.config.now.today(), "2026-11-04", "programın günü değişti");
      assert.equal(await ctx.drain(), 0, "gece yarısı geçti, sayaç sıfırlanmadı");
      assert.equal(ctx.messages().length, 2);
      // Yeni günde açılan önizleme ve yeni kişi: pencere hâlâ dolu (kayan 24 saat, takvim günü değil).
      const fresh = (await ctx.account("Sınır Yeni Gün", "0543 000 00 09", 10)).id;
      const newDay = (await ctx.api.post(URLS.preview, { kind: "statement", ids: [fresh], preset: "lastMonth" })).data.data;
      assert.equal(newDay.limit.used, 2, "gece yarısından sonra da pencerede 2 kişi");
      assert.equal(newDay.limit.later, 1, "yeni kişi yarına (pencere açılınca)");
      const freshBatch = await ctx.batch({ kind: "statement", ids: [fresh], preset: "lastMonth" });
      assert.equal(freshBatch.status, 200);
      await ctx.drain();
      assert.equal(sentTo(ctx, toPhone("5430000009")), 0, "yeni kişiye sınır doluyken gitmedi");
      // Pencerede sayılmış kişi (Sınır 1) yeni dönem ekstresini sınır doluyken de alır (§7a 4).
      const again = await ctx.batch({ kind: "statement", ids: [ids[0]], preset: "lastMonth" });
      assert.equal(again.status, 200);
      await ctx.drain();
      assert.equal(ctx.messages().length, 3);
      assert.equal(sentTo(ctx, toPhone("5430000003")), 0, "sınırdaki kişi hâlâ bekliyor");
      ctx.clock.set(firstAt + DAY - MIN);
      await ctx.drain();
      assert.equal(sentTo(ctx, toPhone("5430000003")), 0, "pencere açılmadan gitmez");
      ctx.clock.set(firstAt + DAY + 5_000);
      await ctx.drain();
      assert.equal(sentTo(ctx, toPhone("5430000003")), 1, "pencere açılınca kendiliğinden");
      // Pencerede: Sınır 1'in 00:10'daki ikinci iletisi + Sınır 3 → yine 2; yeni gün kişisi 00:10 + 24 sa'te.
      assert.equal(sentTo(ctx, toPhone("5430000009")), 0, "pencere yine dolu");
      ctx.clock.set(firstAt + 15 * MIN + DAY + 5_000);
      await ctx.drain();
      assert.equal(sentTo(ctx, toPhone("5430000009")), 1, "00:10'daki ileti pencereden çıkınca yeni gün kişisine gitti");
      detail = await ctx.detail(id);
      assert.equal(detail.state, "done");
    } finally {
      await ctx.close();
    }
  });

  it("Meta basamağı TIER_2K ise elle sınır yoksa 2.000; Meta sınır kodu (131048, D0-10) → aynı WABA'nın BÜTÜN işleri 24 saat bekler", async () => {
    const ctx = await startWa();
    try {
      ctx.fake.state.tier = "TIER_2K";
      const ids = [];
      for (let i = 1; i <= 3; i += 1) ids.push((await ctx.account(`Basamak ${i}`, `0544 000 00 0${i}`, 10)).id);
      const preview = (await ctx.api.post(URLS.preview, { kind: "statement", ids, preset: "thisMonth" })).data.data;
      assert.equal(preview.limit.limit, 2000);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131048, "Spam rate limit hit") });
      const id = (await ctx.batch({ kind: "statement", ids, preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal((await ctx.detail(id)).counts.limited, 3, "hepsi bekliyor");
      // Bekleme sürerken açılan YENİ toplu iş de bekler (aynı WABA).
      const other = await ctx.account("Sonradan", "0544 000 00 09", 10);
      const id2 = (await ctx.batch({ kind: "statement", ids: [other.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal((await ctx.detail(id2)).counts.limited, 1);
      assert.equal(ctx.messages().length, 0);
      ctx.clock.advance(DAY + MIN);
      await ctx.drain();
      assert.equal(ctx.messages().length, 4);
    } finally {
      await ctx.close();
    }
  });

  it("iki şirket AYNI portföyü (WABA) kullanınca sayaç ortak: 001'in gönderdiği kişiler 002'nin sınırından düşer; aynı numaralı kişi yer tutmaz", async () => {
    const ctx = await startWa({ maxCompanies: 2 });
    try {
      const created = await ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const second = created.data.data.company || created.data.data;
      const q = `hofCompany=${encodeURIComponent(second.id)}`;
      await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN });
      await ctx.api.put(`${URLS.ack}?${q}`, { ack: true });
      await ctx.api.put(`${URLS.sending}?${q}`, { dailyCap: 2 });
      const a = await ctx.account("Bir", "0545 000 00 01", 10);
      const b = await ctx.account("İki", "0545 000 00 02", 10);
      await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" });
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "001 iki kişiye gönderdi (001'in sınırı Meta basamağı)");
      const c = (await ctx.api.post(`/api/workspace/accounts?${q}`, { name: "Üç", phone: "0545 000 00 03", openingBalance: "10" })).data.data;
      const same = (await ctx.api.post(`/api/workspace/accounts?${q}`, { name: "Bir (002)", phone: "0545 000 00 01", openingBalance: "10" })).data.data;
      const preview = (await ctx.api.post(`${URLS.preview}?${q}`, { kind: "statement", ids: [c.id, same.id], preset: "thisMonth" })).data;
      assert.equal(preview.ok, true, JSON.stringify(preview));
      assert.equal(preview.data.limit.used, 2, "002 de portföyün iki kişisini görür");
      assert.equal(preview.data.limit.left, 0);
      const created2 = await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: [c.id, same.id], preset: "thisMonth" });
      assert.equal(created2.status, 200, JSON.stringify(created2.data));
      await ctx.drain();
      const jobs = Object.fromEntries((await ctx.api.get(`${URLS.batches}/${created2.data.data.batch.id}?${q}`)).data.data.jobs.map(job => [job.accountName, job.state]));
      assert.equal(jobs["Üç"], "limited", "yeni kişi 002'nin sınırına takıldı (sayaç ortak)");
      assert.equal(jobs["Bir (002)"], "accepted", "pencerede olan kişi yeni hak harcamaz");
    } finally {
      await ctx.close();
    }
  });
});
