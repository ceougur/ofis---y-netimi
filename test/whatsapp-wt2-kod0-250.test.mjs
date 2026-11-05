// 2.5.0 W TUR 2 — Meta kod 0 ("AuthException") da 190 gibi işlenir. KULLANICI KARARI (05.11.2026 21:08, S-W4 = A, aynen): "Kod 0 da 190 gibi işlensin": Meta belirteci 0 koduyla
// ("AuthException") reddederse bağlantı 'Süresi Doldu' olur, o anda iletisi gitmeyen kişi bekleyenlere döner, yeniden bağlanınca 'Devam Et' ile kalanlara gider (19:15 kararının 0'a
// genişletilmesi). 19:15 kararı: "o anda iletisi gitmeyen kişi … kalan kişilerle bekler, yeniden bağlanınca 'Devam Et' ile ona da gider"; 18:37 kararı: "Duraklasın, sonra sürsün …
// kimseye ikinci ileti gitmez". Genel ilke (31.10): (1) kesin almadıysa sayılmaz, (5) geri yüklenen veride aynı kurallar. Beklenen sayılar bu karar metinlerinden ve testin girdiği
// veriden (kişi başına Meta'nın kabul ettiği ileti = 1) yazıldı, programın kodundan değil (ders 5). Kod 102 kararın DIŞINDA (bu dosya 102'yi sınamaz).
// Dar kontrol W1W2-T1 DÜŞÜK-1'in ölçtüğü eski davranış (betik c-kod0-authexception): 0 bağlantıyı Süresi Doldu yapmıyordu, her yeniden bağlanmadan Devam Et bir kişiyi Başarısız
// yapıyordu, son kişi Başarısız olunca toplu iş "geri yüklenmiş / taşınmış" diye Durduruluyordu; neden Yol 2'de de "Elle Bağla ile girin" diyordu.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL; gerçek Meta'ya istek YOK — ders 30) + elle sürülen işçi (ders 20) + sahte saat (ders 13). Ön koşullar kapıyla
// kurulur, beklemeyle değil. Dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur. Geri yükleme testi dosyaları yeniden adlandırır / değiştirir (ders 48 — Windows CI'de erken görülür).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD, removeTestDir } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const T0 = Date.parse("2026-11-05T10:00:00+03:00");
const iso = ms => new Date(ms).toISOString();
const APP = "1505264761663625";
// Meta'nın kod 0 yanıtı (Graph hata biçimi; "AuthException" — belirteç süresi dolmuş / geçersiz).
const authException = (message = "We were unable to authenticate the app user.") => ({ error: { message, type: "OAuthException", code: 0, fbtrace_id: "AbCdEf0" } });
const MESSAGES = /^POST \/\d+\/messages$/;
const adminRow = ctx => ctx.store.get("SELECT * FROM users WHERE username = 'admin'");
const embedded = ctx => ctx.server.app.context.whatsapp.connection.saveEmbedded(adminRow(ctx), { token: TOKEN, wabaId: WABA, phoneNumberId: PNID, olay: "FINISH", appId: APP });
const perPerson = ctx => ctx.messages().reduce((out, item) => ({ ...out, [item.to]: (out[item.to] || 0) + 1 }), {});
const newBatch = (ctx, ids) => ctx.api.post(URLS.batches, { kind: "statement", ids, preset: "thisMonth" });
const tokenState = async ctx => (await ctx.api.get(URLS.conn)).data.data.tokenExpiry;
const expiredRefusal = (res, label) => {
  assert.equal(res.status, 409, `${label}: 409 bekleniyordu, geldi ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  assert.equal(res.data.code, "whatsapp-token-expired", `${label}: kod`);
  assert.match(res.data.error, /süresi doldu/, `${label}: Türkçe neden`);
};
const waitHeld = async ctx => {
  for (let i = 0; i < 1500 && !ctx.fake.state.held; i += 1) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(ctx.fake.state.held, 1, "ön koşul: istek Meta'da (kapıda) bekliyor");
};
const gate = ctx => {
  let release;
  const promise = new Promise(resolve => (release = resolve));
  return { promise, release, hold: match => ctx.fake.set({ hold: { match, promise } }) };
};

describe("2.5.0 W TUR 2 — Meta kod 0 (AuthException) 190 gibi (KULLANICI KARARI 05.11 21:08 S-W4 = A)", () => {
  for (const [stage, match, label, ownCode] of [
    ["check", /^GET \/\d+\/message_templates$/, "şablon okuması", false],
    ["media", /^POST \/\d+\/media$/, "PDF yükleme", true],
    ["send", MESSAGES, "ileti isteği", true],
  ]) {
    it(`Yol 2, kod 0 ${label} sırasında: bağlantı Süresi Doldu; iletisi gitmeyen kişi Başarısız DEĞİL, bekleyenlerle Duraklatıldı; neden 'Devam Et' der, 'Elle Bağla' demez; Yeniden Bağla → Devam Et → üç kişiye birer ileti`, async () => {
      const ctx = await startWa({ now: { time: iso(T0), fixed: true }, connect: false });
      try {
        embedded(ctx);
        const ids = [];
        for (let i = 1; i <= 3; i += 1) ids.push((await ctx.account(`Sıfır ${label} ${i}`, `0532 760 00 0${i}`, 100)).id);
        const res = await newBatch(ctx, ids);
        assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
        const batchId = res.data.data.batch.id;
        ctx.fake.state.failQueue.push({ match, status: 401, body: authException() });
        // Şablon okuması gönderim başlarken yapıldı; işçinin yeniden okuması için 11 dk (en geç 10 dk).
        if (stage === "check") ctx.clock.advance(11 * 60_000);
        await ctx.drain();
        assert.equal(ctx.fake.state.failQueue.length, 0, `ön koşul: kod 0 ${label} isteğine verildi`);
        assert.deepEqual([(await tokenState(ctx))?.state, (await tokenState(ctx))?.expiredBy], ["expired", "meta"], "kod 0: bağlantı Süresi Doldu (Meta)");
        const detail = await ctx.detail(batchId);
        assert.equal(detail.state, "paused", `toplu iş duraklatıldı (geldi ${detail.state})`);
        assert.deepEqual(detail.jobs.map(job => job.state), ["paused", "paused", "paused"], "kod 0 alan kişi Başarısız değil; üç kişi de Duraklatıldı");
        assert.equal(detail.counts.failed || 0, 0);
        if (ownCode) {
          assert.equal(detail.jobs[0].errorCode, 0, "kod 0 alan kişinin satırında kod");
          assert.match(detail.jobs[0].reason, /Meta hata kodu 0\b/, `satırdaki neden gerçek kodu söyler: ${detail.jobs[0].reason}`);
          assert.match(detail.jobs[0].reason, /Devam Et/, detail.jobs[0].reason);
        }
        assert.equal(detail.pauseCode, "token-expired", `duraklatma nedeni bağlantının: ${detail.pauseCode} ${detail.pauseReason}`);
        assert.match(detail.pauseReason, /Devam Et/, `neden 'Devam Et'i anar: ${detail.pauseReason}`);
        assert.doesNotMatch(detail.pauseReason, /Elle Bağla/, `Yol 2'de 'Elle Bağla' yönlendirmesi yok: ${detail.pauseReason}`);
        assert.equal(ctx.messages().length, 0, "Meta'nın kabul ettiği ileti yok");
        expiredRefusal(await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {}), "Devam Et (Süresi Doldu)");
        embedded(ctx); // Yeniden Bağla (WhatsApp'ı Bağla)
        assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200);
        await ctx.drain();
        const after = await ctx.detail(batchId);
        assert.deepEqual(after.jobs.map(job => job.state), ["accepted", "accepted", "accepted"], "Devam Et kod 0 alan kişiye de gönderdi");
        assert.deepEqual(Object.values(perPerson(ctx)), [1, 1, 1], `kişi başına kabul edilen ileti: ${JSON.stringify(perPerson(ctx))}`);
      } finally {
        await ctx.close();
      }
    });
  }

  it("Yol 1 (sınanmış belirteç), ileti isteklerinin HEPSİ kod 0 (belirteç Meta'da iptal): bir kişi gitti, kalan üçü bekler; yeniden bağlanmadan basılan Devam Et (3 kez) reddedilir — kimse Başarısız olmaz, 'geri yüklenmiş / taşınmış' Durdurması çıkmaz, Meta'ya yeni istek gitmez; yeniden bağlanınca Devam Et → kişi başına 1 ileti", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true } });
    try {
      assert.equal((await ctx.api.post(`${URLS.conn}/test`, {})).status, 200, "ön koşul: Bağlantıyı Sına (belirteç Meta'da çalıştı)");
      const ids = [];
      for (let i = 1; i <= 4; i += 1) ids.push((await ctx.account(`Kişi ${i}`, `0532 822 00 0${i}`, 100)).id);
      const res = await newBatch(ctx, ids);
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      const batchId = res.data.data.batch.id;
      await ctx.drain({ max: 1 }); // 1. kişi gider
      assert.equal(ctx.messages().length, 1, "ön koşul: birinci kişinin iletisi Meta'da");
      ctx.fake.set({ failNext: { match: MESSAGES, status: 401, body: authException(), sticky: true } });
      await ctx.drain();
      let detail = await ctx.detail(batchId);
      assert.deepEqual([detail.state, detail.pauseCode], ["paused", "token-expired"], `${detail.state} ${detail.pauseCode} ${detail.pauseReason}`);
      assert.deepEqual(detail.jobs.map(job => job.state), ["accepted", "paused", "paused", "paused"], "kod 0 alan kişi bekleyenlere döndü");
      assert.equal((await tokenState(ctx))?.state, "expired", "bağlantı Süresi Doldu");
      assert.doesNotMatch(detail.pauseReason, /Elle Bağla ile girin/, detail.pauseReason);
      const requestsBefore = ctx.messageRequests().length;
      for (let press = 1; press <= 3; press += 1) {
        expiredRefusal(await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {}), `yeniden bağlanmadan Devam Et ${press}`);
        await ctx.drain();
        detail = await ctx.detail(batchId);
        assert.deepEqual([detail.state, detail.pauseCode], ["paused", "token-expired"], `Devam Et ${press}: toplu iş duraklı kalır (Durdurulmaz): ${detail.state} ${detail.pauseCode} ${detail.pauseReason}`);
        assert.doesNotMatch(detail.pauseReason, /geri yüklenmiş|taşınmış/, detail.pauseReason);
        assert.equal(detail.counts.failed || 0, 0, `Devam Et ${press}: kimse Başarısız değil`);
      }
      assert.equal(ctx.messageRequests().length, requestsBefore, "Süresi Doldu bağlantıyla Meta'ya ileti isteği gitmedi");
      // Yeniden bağlan (Bilgileri Değiştir — yeni kalıcı belirteç) → Devam Et.
      const NEW = "SAHTE-wt2-yeni-belirtec-0123456789-abcdef";
      ctx.fake.set({ failNext: null, token: NEW });
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: NEW })).status, 200);
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200);
      await ctx.drain();
      detail = await ctx.detail(batchId);
      assert.deepEqual(detail.jobs.map(job => job.state), ["accepted", "accepted", "accepted", "accepted"]);
      assert.deepEqual(Object.values(perPerson(ctx)), [1, 1, 1, 1], `kişi başına kabul edilen ileti: ${JSON.stringify(perPerson(ctx))}`);
      const retry = await ctx.api.post(`${URLS.batches}/${batchId}/retry-failed`, {});
      assert.equal(retry.status, 400, "Başarısız ileti yok (Başarısızları Yeniden Dene'ye gerek kalmaz)");
      await ctx.drain();
      assert.deepEqual(Object.values(perPerson(ctx)), [1, 1, 1, 1]);
    } finally {
      await ctx.close();
    }
  });

  for (const mode of ["manual", "embedded"]) {
    it(`${mode === "manual" ? "Yol 1" : "Yol 2"}: ileti isteği Meta'dayken belirteç değiştirildi ve ESKİ belirteç kod 0 aldı → bağlantı Süresi Doldu olmaz; kişi bekleyenlere döner; neden kendi yolunu söyler ('${mode === "manual" ? "Bilgileri Değiştir" : "WhatsApp'ı Yeniden Bağla"}', 'Devam Et'); Devam Et yeni belirteçle gönderir`, async () => {
      const ctx = await startWa({ now: { time: iso(T0), fixed: true }, connect: mode === "manual" });
      try {
        if (mode === "embedded") embedded(ctx);
        else assert.equal((await ctx.api.post(`${URLS.conn}/test`, {})).status, 200);
        const a = await ctx.account("Pencere Bir", "0532 770 00 01", 100);
        const b = await ctx.account("Pencere İki", "0532 770 00 02", 100);
        const res = await newBatch(ctx, [a.id, b.id]);
        assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
        const batchId = res.data.data.batch.id;
        const door = gate(ctx);
        door.hold(MESSAGES);
        ctx.fake.state.failQueue.push({ match: MESSAGES, status: 401, body: authException() });
        const run = ctx.drain({ max: 1 });
        await waitHeld(ctx);
        // Başka pencerede yeniden bağlandı (aynı belirteç değeri de olsa yeniden kayıt yeni kayıttır).
        if (mode === "manual") {
          const FRESH = "SAHTE-wt2-pencere-belirteci_0123456789-yeni";
          assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: FRESH })).status, 200);
          ctx.fake.set({ token: FRESH });
        } else {
          embedded(ctx);
        }
        door.release();
        await run;
        ctx.fake.set({ hold: null });
        assert.equal(ctx.fake.state.failQueue.length, 0, "ön koşul: eski belirtecin isteği kod 0 aldı");
        const detail = await ctx.detail(batchId);
        assert.equal((await tokenState(ctx))?.state, "ok", "yeni belirteç Süresi Doldu değil");
        assert.equal(detail.state, "paused");
        assert.deepEqual(detail.jobs.map(job => job.state), ["paused", "paused"], "kod 0 alan kişi bekleyenlerle Duraklatıldı");
        assert.equal(detail.counts.failed || 0, 0);
        assert.match(detail.pauseReason, mode === "manual" ? /Bilgileri Değiştir/ : /WhatsApp'ı Yeniden Bağla/, detail.pauseReason);
        assert.match(detail.pauseReason, /Devam Et/, detail.pauseReason);
        assert.doesNotMatch(detail.pauseReason, /Elle Bağla ile girin/, detail.pauseReason);
        assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200);
        await ctx.drain();
        assert.deepEqual((await ctx.jobs(batchId)).map(job => job.state), ["accepted", "accepted"]);
        assert.deepEqual(Object.values(perPerson(ctx)), [1, 1], `kişi başına kabul edilen ileti: ${JSON.stringify(perPerson(ctx))}`);
      } finally {
        await ctx.close();
      }
    });
  }

  it("kodsuz Meta hatası (error nesnesinde code yok) belirteç reddi SAYILMAZ: bağlantı Süresi Doldu olmaz (kod 0 ile karışmaz)", async () => {
    const ctx = await startWa({ now: { time: iso(T0), fixed: true } });
    try {
      assert.equal((await ctx.api.post(`${URLS.conn}/test`, {})).status, 200);
      const a = await ctx.account("Kodsuz", "0532 780 00 01", 100);
      const res = await newBatch(ctx, [a.id]);
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      ctx.fake.state.failQueue.push({ match: MESSAGES, status: 400, body: { error: { message: "Unexpected error", type: "OAuthException", fbtrace_id: "AbCd" } } });
      await ctx.drain();
      assert.equal(ctx.fake.state.failQueue.length, 0, "ön koşul: kodsuz hata ileti isteğine verildi");
      assert.equal((await tokenState(ctx))?.state, "ok", "kodsuz hata bağlantıyı Süresi Doldu yapmaz");
    } finally {
      await ctx.close();
    }
  });

  it("geri yükleme (ilke 5): kod 0 alan kişi bekler → YEDEK → yeniden bağlan + Devam Et (gönderildi) → yedek geri yüklenir: eski toplu iş Durduruldu, Devam Et reddedilir, aynı kişilere yeni gönderim 'Daha Önce Gönderildi' — kişi başına 1 ileti", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "wt2-kod0-geri-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    const NOW = { time: iso(T0), fixed: true };
    let ctx = await startWa({ dataDir, backupDir, now: NOW });
    const fake = ctx.fake;
    try {
      assert.equal((await ctx.api.post(`${URLS.conn}/test`, {})).status, 200);
      const ids = [];
      for (const [name, phone] of [["Ali", "0532 844 10 01"], ["Berk", "0532 844 10 02"], ["Cem", "0532 844 10 03"]]) ids.push((await ctx.account(name, phone, 100)).id);
      const created = await newBatch(ctx, ids);
      assert.equal(created.status, 200, JSON.stringify(created.data).slice(0, 300));
      const batchId = created.data.data.batch.id;
      await ctx.drain({ max: 1 });
      fake.state.failQueue.push({ match: MESSAGES, status: 401, body: authException() });
      await ctx.drain();
      assert.equal(fake.state.failQueue.length, 0, "ön koşul: kod 0 ileti isteğine verildi");
      assert.deepEqual((await ctx.jobs(batchId)).map(job => job.state), ["accepted", "paused", "paused"], "kod 0 alan kişi bekleyenlerle");
      const backup = await ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
      assert.equal(backup.status, 200, JSON.stringify(backup.data).slice(0, 300));
      const backupName = backup.data.data.backups[0].name;
      const NEW = "SAHTE-wt2-geri-yukleme-belirteci-0123456789";
      fake.set({ token: NEW });
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: NEW })).status, 200);
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200);
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(batchId)).map(job => job.state), ["accepted", "accepted", "accepted"]);
      assert.deepEqual(Object.values(perPerson(ctx)), [1, 1, 1]);
      const staged = await ctx.api.post("/api/admin/backups/restore", { name: backupName, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(staged.status, 200, JSON.stringify(staged.data).slice(0, 300));
      await ctx.server.close();
      ctx = await startWa({ dataDir, backupDir, fake, connect: false, ack: false, now: NOW });
      const restored = await ctx.detail(batchId);
      assert.deepEqual([restored.state, restored.pauseCode], ["stopped", "restored"], `geri yüklenen eski toplu iş diriltilmez: ${restored.state} ${restored.pauseCode}`);
      assert.notEqual((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200, "geri yüklenen toplu iş sürdürülemez");
      await ctx.drain();
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: NEW })).status, 200);
      const again = await newBatch(ctx, ids);
      if (again.status === 200) {
        await ctx.drain();
        assert.ok((await ctx.jobs(again.data.data.batch.id)).every(job => job.state === "skipped"), "aynı dönemde zaten alan kişiler elenir");
      } else {
        assert.equal(again.data.code, "whatsapp-nothing", `gönderilecek kişi yok: ${JSON.stringify(again.data).slice(0, 200)}`);
      }
      assert.deepEqual(Object.values(perPerson({ messages: () => fake.state.messages })), [1, 1, 1], `kişi başına kabul edilen ileti: ${JSON.stringify(perPerson({ messages: () => fake.state.messages }))}`);
    } finally {
      await ctx.server.close().catch(() => {});
      await fake.close();
      removeTestDir(root);
    }
  });
});
