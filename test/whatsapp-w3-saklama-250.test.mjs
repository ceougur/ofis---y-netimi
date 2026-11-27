// 2.5.0 W-3 — WhatsApp gönderim kayıtlarının SAKLAMA SÜRESİ ve KVKK SİLME TALEBİ (docs/erp/W3-SAKLAMA-TASARIM.md; plan docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 W-3).
// KULLANICI KARARLARI (AYNEN, docs/2.5.0-IS-LISTESI.md D): S-W3 "1 yıl + anonim iz" (içerik, telefon, PDF 1 takvim yılı sonra — son denemeden, yerel saat — ya da KVKK talebinde
// HEMEN silinir; tarih, dönem, cari kimliği, şablon + sonuç ve sayaçlar iz kalır → aynı kişiye aynı dönemde ikinci ileti gitmez); S30 / S35 = A + Y17-6 (bekleyen iş talep / dolum
// ANINDA "Atlandı — Silme Talebi" / "Saklama Süresi"; Sonucu Belirsiz izi kalır); S31 = A (silinmiş Ekstre aynı iş üzerinden yeniden gönderilmez, neden görünür); S32 = A
// (talepten önceki yedek geri yüklenince içerik / telefon GELMEZ, talepten sonraki kalır); S36 = A; S37 = B (silinmiş Ödeme Hatırlatma karttan yeniden hazırlanıp gider);
// S38 = A (taşımada talepler taşınır); S42 = A (Gönderiliyor anında içerik + telefon hemen silinir, sonuç ize yazılır, yeniden gönderim gerekirse Atlandı). İLKEYLE: silinmiş
// kayıtta R3 Yine de Gönder açık; kapanmış işin belirsiz izi eler.
// Düzenek: GERÇEK program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; beklenen sayılar karar metninden ve testin girdisinden) + sahte saat (ders 13); dosya TZ=UTC ve
// TZ=Europe/Istanbul ile koşulur (yerel gün / yıl dönümü). Ders 30: lisans servisi ölü yerel adres. Eski kodda (taban 75f1aad9) uç yok (404) / içerik silinmez → kırmızı.
// Ders 48 (Windows): bazı hücreler program KAPALIYKEN veri klasöründe dosya taşır / siler (taşıma benzetimi: gönderim defteri) ve yedeği geri yükler.
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD, createUser, removeTestDir } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const ERASE = "/api/workspace/whatsapp/kvkk-erase";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const localIso = (y, m, d, h = 10, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).toISOString();
// Yerel takvimde bir yıl sonrası (kararın "1 takvim yılı", yerel saat; 29 Şubat → 28 Şubat) — testin kendi hesabı (programdan okunmaz).
const yearAfter = iso => {
  const d = new Date(iso);
  const y = d.getFullYear() + 1;
  const last = new Date(y, d.getMonth() + 1, 0).getDate();
  return new Date(y, d.getMonth(), Math.min(d.getDate(), last), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()).toISOString();
};
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const ts = ctx => String(Math.floor(ctx.clock().getTime() / 1000));
const statusOf = (ctx, wamid, status, extra = {}) => ({ id: wamid, status, timestamp: ts(ctx), recipient_id: "905000000000", ...extra });
const h131049 = (ctx, wamid) => statusOf(ctx, wamid, "failed", { errors: [{ code: 131049, title: "This message was not delivered to maintain healthy ecosystem engagement." }] });
const skipOf = data => Object.fromEntries((data?.people || []).map(person => [person.id, person.skip || "gönderilecek"]));
const waitFor = async (check, label, ms = 8000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error(`zaman aşımı: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const files = dir => (existsSync(dir) ? readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? files(full) : [full];
}) : []);

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
const erase = (ctx, accountId, q = "") => ctx.api.post(`${ERASE}${q ? `?${q}` : ""}`, { accountId, confirm: true });
async function eraseOk(ctx, accountId, q = "") {
  const res = await erase(ctx, accountId, q);
  assert.equal(res.status, 200, `KVKK silme talebi ucu (geldi ${res.status} ${JSON.stringify(res.data)})`);
  return res.data.data;
}
const preview = async (ctx, body, q = "") => ok(await ctx.api.post(`${URLS.preview}${q ? `?${q}` : ""}`, body), "önizleme");
const jobsOf = async (ctx, batchId, q = "") => (await ok(await ctx.api.get(`${URLS.batches}/${batchId}${q ? `?${q}` : ""}`), "ayrıntı")).jobs;
const jobOf = async (ctx, batchId, accountId, q = "") => (await jobsOf(ctx, batchId, q)).find(job => job.accountId === accountId);
const sentTo = (ctx, tel) => ctx.messages().filter(item => item.to === tel).length;
const ledgerRows = (dataDir, sql, ...args) => {
  const db = new DatabaseSync(path.join(dataDir, "whatsapp-gonderim.sqlite"), { readOnly: true });
  try {
    return db.prepare(sql).all(...args);
  } finally {
    db.close();
  }
};
// İçerik görünümü (kâhinin icerik alanları): telefon, değişkenler, PDF adı, PDF baytları (dosyada), silindi işareti.
function contentOf(ctx, job, store = ctx.store) {
  const pdf = store.get("SELECT length(pdf) AS n FROM wa_job_pdfs WHERE job_id = ?", job.id)?.n || 0;
  return { phone: job.phone || "", params: job.params?.length || 0, pdfName: job.pdfName || "", pdfBytes: pdf, erased: Boolean(job.contentErased) };
}
const ERASED_VIEW = { phone: "", params: 0, pdfName: "", pdfBytes: 0, erased: true };

/** İkinci şirket (002): bağlantı + onay; q: istek eki; queue(): o şirketin kuyruğu (işçi kaydından). */
async function secondCompany(ctx) {
  const queues = new Map();
  const sch = ctx.server.app.whatsapp.scheduler;
  const reg = sch.register.bind(sch);
  sch.register = (key, queue) => {
    queues.set(String(key), queue);
    return reg(key, queue);
  };
  const created = await ok(await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
  const company = created.company || created;
  const q = `hofCompany=${encodeURIComponent(company.id)}`;
  await ok(await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "bağlantı");
  await ok(await ctx.api.put(`${URLS.ack}?${q}`, { ack: true }), "onay");
  return {
    company,
    q,
    queue: () => queues.get(company.id),
    account: async (name, phone, opening = 0) => ok(await ctx.api.post(`/api/workspace/accounts?${q}`, { name, phone, ...(opening ? { openingBalance: String(opening) } : {}) }), "cari"),
    batch: async body => ok(await ctx.api.post(`${URLS.batches}?${q}`, body), "toplu iş"),
    backup: async () => (await ok(await ctx.api.post("/api/admin/backups", { scope: "one", companyId: company.id }), "yedek")).backups[0].name,
    restore: async name => ok(await ctx.api.post("/api/admin/backups/restore", { name, company: company.id, confirm: company.code, password: ADMIN_PASSWORD }), "geri yükleme"),
  };
}
const deliverAll = async (ctx, batchId, q = "", app = undefined) => {
  for (const job of await jobsOf(ctx, batchId, q)) if (job.wamid) ctx.statuses([statusOf(ctx, job.wamid, "delivered")], app ? { app } : {});
};

describe("2.5.0 W-3 — saklama süresi (1 yıl + anonim iz) ve KVKK silme talebi", () => {
  it("S-W3 + S35: talep → içerik, telefon, PDF, ad, wamid HEMEN silinir, iz kalır; bekleyen (Duraklatıldı) iş 'Atlandı — Silme Talebi'; aynı dönem 'Daha Önce Gönderildi', R3 Yine de Gönder yeni içerikle gider; öbür cari ve kart değişmez; yetki / onay", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const b = await ctx.account("Bora Demir", "0532 444 55 66", 300);
      const first = await ok(await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" }), "Kasım ekstresi");
      await ctx.drain();
      await deliverAll(ctx, first.batch.id);
      const held = await ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "lastMonth" }), "Ekim ekstresi");
      await ok(await ctx.api.post(`${URLS.batches}/${held.batch.id}/pause`, {}), "duraklat");
      assert.equal((await jobOf(ctx, held.batch.id, a.id)).state, "paused", "ön koşul: A'nın Ekim işi Duraklatıldı");
      await ok(await ctx.api.post("/api/workspace/whatsapp/log", { accountId: a.id, kind: "message", phone: "905321112233", body: "Sayın Ayşe Yılmaz, bakiyeniz 500,00 TL.", status: "sent" }), "elle yol kaydı");
      const statsBefore = await ok(await ctx.api.get(URLS.stats), "Bu Ay (önce)");
      // Yetki ve onay: personel 403, onaysız 409 (hiçbir şey silinmez).
      const staff = await createUser(ctx.server, ctx.api, { username: "personel-w3" });
      assert.equal((await staff.post(ERASE, { accountId: a.id, confirm: true })).status, 403, "yönetici olmayan silemez");
      const unconfirmed = await ctx.api.post(ERASE, { accountId: a.id });
      assert.equal(unconfirmed.status, 409, `onaysız 409 (geldi ${unconfirmed.status})`);
      assert.equal((await jobOf(ctx, first.batch.id, a.id)).params.length, 4, "onaysız istek içeriği silmedi");

      const result = await eraseOk(ctx, a.id);
      assert.deepEqual([result.jobs, result.skipped, result.manual], [2, 1, 1], `silinen iş / atlanan bekleyen / elle yol kaydı (${JSON.stringify(result)})`);
      const aJob = await jobOf(ctx, first.batch.id, a.id);
      assert.deepEqual(contentOf(ctx, aJob), ERASED_VIEW, "A'nın Kasım işi: içerik + telefon + PDF silindi");
      assert.equal(aJob.state, "delivered", "iz: teslim durumu kalır");
      assert.match(aJob.wamid, /^h:[0-9a-f]{64}$/, "wamid özetlendi (numara taşıyabilir)");
      assert.equal(aJob.accountName, "Ayşe Yılmaz", "ad cari kartından gösterilir (iş satırında yok)");
      assert.equal(ctx.store.get("SELECT account_name FROM wa_jobs WHERE id = ?", aJob.id).account_name, "", "iş satırında ad yok");
      const bJob = await jobOf(ctx, first.batch.id, b.id);
      assert.deepEqual([bJob.phone, bJob.params.length, /\.pdf$/.test(bJob.pdfName), bJob.contentErased], ["+905324445566", 4, true, null], "B'nin işi DEĞİŞMEDİ");
      const heldJob = await jobOf(ctx, held.batch.id, a.id);
      assert.deepEqual([heldJob.state, heldJob.reason.startsWith("Silme Talebi")], ["skipped", true], `S35: bekleyen iş Atlandı — Silme Talebi (${heldJob.state} ${heldJob.reason})`);
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM message_sends WHERE account_id = ? AND (phone <> '' OR body <> '')", a.id).n, 0, "elle yol kaydının telefonu ve metni silindi");
      // Makine defteri: A'nın talebinin telefonu 'silinmis:<iş>', B'ninki durur; talep dosyası yalnız şirket + cari + an.
      const claims = ledgerRows(ctx.server.dataDir, "SELECT job_id, phone FROM claims");
      assert.deepEqual(claims.filter(row => row.job_id === aJob.id).map(row => row.phone), [`silinmis:${aJob.id}`], "defterde A'nın telefonu anonim");
      assert.deepEqual(claims.filter(row => row.job_id === bJob.id).map(row => row.phone), ["+905324445566"], "defterde B'nin telefonu durur");
      const reqDb = new DatabaseSync(path.join(ctx.server.dataDir, "whatsapp-silme-talepleri.sqlite"), { readOnly: true });
      try {
        const rows = reqDb.prepare("SELECT * FROM requests").all();
        assert.deepEqual(rows.map(row => Object.keys(row).sort()), [["account_id", "at", "company_id"]], "talep kaydında yalnız şirket + cari + an");
        assert.equal(rows[0].account_id, a.id);
      } finally {
        reqDb.close();
      }
      // Kart değişmez; "Bu Ay" azalmaz.
      assert.equal((await ok(await ctx.api.get(`/api/workspace/accounts/${a.id}`), "kart")).phone, "0532 111 22 33", "cari kartının telefonu değişmedi");
      assert.deepEqual(await ok(await ctx.api.get(URLS.stats), "Bu Ay (sonra)"), statsBefore, "Bu Ay sayısı değişmedi");
      // Kime / kaç kez (iz): aynı dönem A ve B "Daha Önce Gönderildi"; A'nın kapanan Ekim işi "Zaten Kuyrukta" saymaz ve iz bırakmaz → Ekim gider (Y17-8).
      ctx.clock.advance(HOUR);
      const same = await preview(ctx, { kind: "statement", ids: [a.id, b.id], preset: "thisMonth" });
      assert.deepEqual(skipOf(same), { [a.id]: "Daha Önce Gönderildi", [b.id]: "Daha Önce Gönderildi" }, "aynı dönem: iz eler (ikinci ileti yok)");
      const before = sentTo(ctx, "+905321112233");
      await ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "lastMonth" }), "Ekim ekstresi yeniden (talepten sonra)");
      await ctx.drain();
      assert.equal(sentTo(ctx, "+905321112233"), before + 1, "kapanan bekleyen iş kuyrukta sayılmadı: Ekim ekstresi gitti");
      // İLKEYLE (WK 15): silinmiş kayıtta R3 "Yine de Gönder" açık — yeni içerik ve karttaki telefonla.
      const again = await ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth", sendAgain: true }), "R3 Yine de Gönder");
      await ctx.drain();
      const fresh = await jobOf(ctx, again.batch.id, a.id);
      assert.deepEqual([fresh.state, fresh.phone, fresh.params.length, Boolean(fresh.contentErased)], ["accepted", "+905321112233", 4, false], "yeni gönderim yeni içerikle (talepten sonra yazılan içerik kalır)");
      assert.equal(sentTo(ctx, "+905321112233"), before + 2);
    } finally {
      await ctx.close();
    }
  });

  it("S-W3 1 yıl (yerel saat; gece yarısı yerel ≠ UTC) + Y17-6: sınırdan 1 sa önce içerik durur, sınırda silinir (bakım turu); 1 yılını dolduran bekleyen iş DOLUM ANINDA 'Atlandı — Saklama Süresi' (önce 'Zaten Kuyrukta' eler, sonra elemez); aynı dönem iz eler", { timeout: 120_000 }, async () => {
    const start = localIso(2026, 11, 1, 0, 30);
    const ctx = await startWa({ env: DEAD, now: { time: start, fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const b = await ctx.account("Bora Demir", "0532 444 55 66", 300);
      const sent = await ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "A Kasım");
      await ctx.drain();
      await deliverAll(ctx, sent.batch.id);
      const waiting = await ok(await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" }), "B Kasım");
      await ok(await ctx.api.post(`${URLS.batches}/${waiting.batch.id}/pause`, {}), "duraklat");
      const aJob0 = await jobOf(ctx, sent.batch.id, a.id);
      // Aynı dönem bir yıl sonra: toplu işin KAYITLI dönemiyle birebir özel aralık ("Bu Ay" = ayın başı – o gün).
      const period = (await ok(await ctx.api.get(`${URLS.batches}/${sent.batch.id}`), "dönem")).period;
      const custom = { kind: "statement", ids: [a.id, b.id], from: period.from, to: period.to };
      // Sınırdan 1 saat önce: içerik durur, bekleyen iş bekler ("Zaten Kuyrukta").
      ctx.clock.set(new Date(Date.parse(yearAfter(start)) - HOUR).toISOString());
      await ctx.drain();
      assert.deepEqual(contentOf(ctx, await jobOf(ctx, sent.batch.id, a.id)), { phone: "+905321112233", params: 4, pdfName: aJob0.pdfName, pdfBytes: 0, erased: false }, "1 yıl − 1 sa: içerik durur");
      assert.deepEqual(skipOf(await preview(ctx, custom)), { [a.id]: "Daha Önce Gönderildi", [b.id]: "Zaten Kuyrukta" }, "1 yıl − 1 sa: B'nin işi kuyrukta");
      // Sınır (+1 dk): önizleme anında bekleyen iş kapanır; bakım turu içeriği siler.
      ctx.clock.set(new Date(Date.parse(yearAfter(start)) + 60_000).toISOString());
      assert.deepEqual(skipOf(await preview(ctx, custom)), { [a.id]: "Daha Önce Gönderildi", [b.id]: "gönderilecek" }, "dolum anında: B kuyrukta değil (Y17-6), A iz ile elenir (S-W3)");
      const bJob = await jobOf(ctx, waiting.batch.id, b.id);
      assert.deepEqual([bJob.state, bJob.reason.startsWith("Saklama Süresi"), Boolean(bJob.contentErased)], ["skipped", true, true], `bekleyen iş Atlandı — Saklama Süresi (${bJob.state} ${bJob.reason})`);
      await ctx.drain();
      const aJob = await jobOf(ctx, sent.batch.id, a.id);
      assert.deepEqual(contentOf(ctx, aJob), ERASED_VIEW, "1 yıl + 1 dk: içerik + telefon silindi");
      assert.deepEqual([aJob.state, aJob.contentErased.kind], ["delivered", "sure"], "iz: Teslim Edildi kalır; neden saklama süresi");
      assert.deepEqual(ledgerRows(ctx.server.dataDir, "SELECT phone FROM claims WHERE job_id = ?", aJob.id).map(row => row.phone), [`silinmis:${aJob.id}`], "defterde de 1 yıl sonra anonim");
    } finally {
      await ctx.close();
    }
  });

  it("S-W3 29 Şubat (yerel gün; İstanbul'da UTC'nin bir gün gerisi): 29.02.2028 01:00'de gönderilen ekstrenin içeriği 28.02.2029 00:00'da durur, 01:00'de silinir; aynı anda açılan bekleyen iş 00:59'da kuyrukta, 01:00'de 'Atlandı — Saklama Süresi'", { timeout: 120_000 }, async () => {
    const start = localIso(2028, 2, 29, 1, 0);
    const ctx = await startWa({ env: DEAD, now: { time: start, fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const b = await ctx.account("Bora Demir", "0532 444 55 66", 300);
      const sent = await ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "A Şubat 2028");
      await ctx.drain();
      await deliverAll(ctx, sent.batch.id);
      const waiting = await ok(await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" }), "B Şubat 2028");
      await ok(await ctx.api.post(`${URLS.batches}/${waiting.batch.id}/pause`, {}), "duraklat");
      const period = (await ok(await ctx.api.get(`${URLS.batches}/${waiting.batch.id}`), "dönem")).period;
      const same = { kind: "statement", ids: [b.id], from: period.from, to: period.to };
      ctx.clock.set(localIso(2029, 2, 28, 0, 0));
      await ctx.drain();
      assert.equal((await jobOf(ctx, sent.batch.id, a.id)).params.length, 4, "28.02.2029 00:00: içerik durur (bakım turu koştu)");
      ctx.clock.set(localIso(2029, 2, 28, 0, 59));
      assert.deepEqual(skipOf(await preview(ctx, same)), { [b.id]: "Zaten Kuyrukta" }, "28.02.2029 00:59: bekleyen iş kuyrukta");
      ctx.clock.set(localIso(2029, 2, 28, 1, 0));
      assert.deepEqual(skipOf(await preview(ctx, same)), { [b.id]: "gönderilecek" }, "28.02.2029 01:00: bekleyen iş kapandı (29 Şubat → 28 Şubat, yerel)");
      assert.equal((await jobOf(ctx, waiting.batch.id, b.id)).reason.startsWith("Saklama Süresi"), true, "Atlandı — Saklama Süresi");
      await ctx.drain();
      assert.deepEqual(contentOf(ctx, await jobOf(ctx, sent.batch.id, a.id)), ERASED_VIEW, "28.02.2029 01:00: içerik silindi");
    } finally {
      await ctx.close();
    }
  });

  it("S-W3 takvim yılı ≠ 365 gün: 15.06.2027 10:00'da gönderilen ekstre (araya 29.02.2028 girer) 14.06.2028 10:30'da (365 gün + 30 dk) DURUR, 15.06.2028 10:00'da silinir", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2027, 6, 15, 10, 0), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const sent = await ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "Haziran 2027");
      await ctx.drain();
      await deliverAll(ctx, sent.batch.id);
      ctx.clock.set(localIso(2028, 6, 14, 10, 30));
      await ctx.drain();
      assert.equal((await jobOf(ctx, sent.batch.id, a.id)).params.length, 4, "365 gün geçti ama takvim yılı dolmadı: içerik durur");
      ctx.clock.set(localIso(2028, 6, 15, 10, 0));
      await ctx.drain();
      assert.deepEqual(contentOf(ctx, await jobOf(ctx, sent.batch.id, a.id)), ERASED_VIEW, "takvim yılı doldu: silindi");
    } finally {
      await ctx.close();
    }
  });

  it("S42: talep anında iş Gönderiliyor — içerik + telefon (dosya + defter) hemen silinir; kabul → wamid özetle iz; geçici hata → yeniden gönderilmez, 'Atlandı — Silme Talebi'; yanıt yok → Sonucu Belirsiz izi", { timeout: 120_000 }, async () => {
    // 2.5.0 WhatsApp tur 3 (kırılgan TERS kalıp — KAYIT 06.11 16:10 listesi): kapı varken istemci süre sınırı 800 ms'ydi — kapıda iken yapılan talep (yüklü makinede) bunu aşarsa "kabul"
    // ve "geçici hata" adımları zaman aşımına düşerdi. Süre sınırı kapıdan uzun (60 sn); "yanıt yok" adımı süreyle değil, kapı açılınca bağlantının KOPMASIYLA (yanıt hiç gelmez — programın
    // aynı "yanıtsız" dalı, §7a 10) kurulur. Beklenti aynen.
    const ctx = await startWa({ env: DEAD, whatsappTimeoutMs: 60_000, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const b = await ctx.account("Bora Demir", "0532 444 55 66", 300);
      const c = await ctx.account("Cem Kara", "0532 777 88 99", 200);
      const inFlight = async (accountId, setup, label) => {
        let release;
        ctx.fake.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
        setup?.();
        const made = await ok(await ctx.batch({ kind: "statement", ids: [accountId], preset: "thisMonth" }), label);
        const run = ctx.drain();
        await waitFor(() => ctx.fake.state.held >= 1, `${label}: istek Meta'da`);
        const during = await jobOf(ctx, made.batch.id, accountId);
        assert.equal(during.state, "sending", `ön koşul (${label}): iş Gönderiliyor`);
        const result = await eraseOk(ctx, accountId);
        const erasedNow = await jobOf(ctx, made.batch.id, accountId);
        assert.deepEqual([erasedNow.state, erasedNow.phone, erasedNow.params.length, Boolean(erasedNow.contentErased)], ["sending", "", 0, true], `${label}: Gönderiliyor korunur, içerik + telefon HEMEN silindi`);
        assert.equal(ledgerRows(ctx.server.dataDir, "SELECT phone FROM claims WHERE job_id = ?", erasedNow.id)[0]?.phone, `silinmis:${erasedNow.id}`, `${label}: defterdeki telefon da hemen`);
        ctx.fake.state.hold = null;
        release();
        await run;
        return { made, result, job: await jobOf(ctx, made.batch.id, accountId) };
      };
      // (1) Kabul: "gönderildi" izi, wamid özet; aynı dönem "Daha Önce Gönderildi".
      const accepted = await inFlight(a.id, null, "kabul");
      assert.deepEqual([accepted.job.state, /^h:[0-9a-f]{64}$/.test(accepted.job.wamid)], ["accepted", true], "kabul izi + wamid özeti");
      assert.ok(ledgerRows(ctx.server.dataDir, "SELECT wamid FROM outcomes WHERE job_id = ?", accepted.job.id).every(row => /^h:/.test(row.wamid)), "defterde açık wamid yok");
      // (2) Geçici hata (131000): yeniden deneme gerekirdi → o anda Atlandı — Silme Talebi; ikinci istek GİTMEZ.
      const temp = await inFlight(b.id, () => ctx.fake.state.failQueue.push({ match: /messages/, status: 500, body: metaError(131000, "Something went wrong") }), "geçici hata");
      assert.deepEqual([temp.job.state, temp.job.reason.startsWith("Silme Talebi")], ["skipped", true], `geçici hata → Atlandı — Silme Talebi (${temp.job.state} ${temp.job.reason})`);
      const requestsB = ctx.messageRequests().length;
      ctx.clock.advance(HOUR);
      await ctx.drain();
      assert.equal(ctx.messageRequests().length, requestsB, "kapanan işe yeniden deneme isteği gitmedi");
      // (3) Yanıt yok (bağlantı koptu — yanıtsız dal): Sonucu Belirsiz izi kalır; aynı dönem "Sonucu Belirsiz" ile elenir.
      const lost = await inFlight(c.id, () => ctx.fake.state.failQueue.push({ match: /messages/, destroy: true }), "yanıt yok");
      assert.deepEqual([lost.job.state, Boolean(lost.job.contentErased)], ["uncertain", true], "yanıtsız → Sonucu Belirsiz (iz)");
      ctx.clock.advance(HOUR);
      const same = await preview(ctx, { kind: "statement", ids: [a.id, c.id], preset: "thisMonth" });
      assert.deepEqual(skipOf(same), { [a.id]: "Daha Önce Gönderildi", [c.id]: "Sonucu Belirsiz" }, "iz eler: kabul → Daha Önce, belirsiz → Sonucu Belirsiz");
    } finally {
      await ctx.close();
    }
  });

  it("S35 + K7 düzeni: Meta Bekletti (131049) iş talep anında Atlandı — 24 sa sonraki deneme GİTMEZ, bırakılmış deneme 'Daha Önce' saymaz (aynı dönem yeni gönderim gider); geç teslim sayılır, sonra 'Daha Önce'", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const d = await ctx.account("Deniz Ak", "0532 222 33 44", 400);
      const made = await ok(await ctx.batch({ kind: "statement", ids: [d.id], preset: "thisMonth" }), "D Kasım");
      await ctx.drain();
      const first = await jobOf(ctx, made.batch.id, d.id);
      ctx.clock.advance(60_000);
      ctx.statuses([h131049(ctx, first.wamid)]);
      assert.equal((await jobOf(ctx, made.batch.id, d.id)).state, "held", "ön koşul: Meta Bekletti");
      await eraseOk(ctx, d.id);
      const closed = await jobOf(ctx, made.batch.id, d.id);
      assert.deepEqual([closed.state, closed.reason.startsWith("Silme Talebi")], ["skipped", true], "talep anında Atlandı — Silme Talebi");
      const requests = ctx.messageRequests().length;
      ctx.clock.advance(DAY + HOUR);
      await ctx.drain();
      assert.equal(ctx.messageRequests().length, requests, "24 saat sonraki 2. deneme gitmedi");
      assert.deepEqual(skipOf(await preview(ctx, { kind: "statement", ids: [d.id], preset: "thisMonth" })), { [d.id]: "gönderilecek" }, "bırakılmış (teslimsiz) deneme sayılmaz: aynı dönem yeni gönderim gider");
      ctx.statuses([statusOf(ctx, first.wamid, "delivered")]);
      assert.deepEqual(skipOf(await preview(ctx, { kind: "statement", ids: [d.id], preset: "thisMonth" })), { [d.id]: "Daha Önce Gönderildi" }, "geç teslim (özetlenmiş wamid eşleşti) sayılır");
    } finally {
      await ctx.close();
    }
  });

  it("S31 + S36 (Ekstre): silinmiş Başarısız → Başarısızları Yeniden Dene 'İçeriği Silindi' (öbürü alınır); silinmiş Sonucu Belirsiz → Yine de Gönder 'İçeriği Silindi' + neden; aynı dönem 'Sonucu Belirsiz' eler (Yine de Gönder bayrağı da), sonraki dönem gider; yeni gönderim (Başarısız) gider", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const b = await ctx.account("Bora Demir", "0532 444 55 66", 300);
      const u = await ctx.account("Ufuk Er", "0532 999 00 11", 100);
      ctx.fake.state.recipientErrors["+905321112233"] = { status: 400, body: metaError(131026, "Message undeliverable") };
      ctx.fake.state.recipientErrors["+905324445566"] = { status: 400, body: metaError(131026, "Message undeliverable") };
      const failed = await ok(await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" }), "A, B Başarısız");
      await ctx.drain();
      ctx.fake.state.recipientErrors = {};
      ctx.fake.state.hang = /messages/;
      const unsure = await ok(await ctx.batch({ kind: "statement", ids: [u.id], preset: "thisMonth" }), "U Sonucu Belirsiz");
      await ctx.drain();
      ctx.fake.state.hang = null;
      assert.deepEqual((await jobsOf(ctx, failed.batch.id)).map(job => job.state), ["failed", "failed"], "ön koşul: A, B Başarısız");
      const uJob = await jobOf(ctx, unsure.batch.id, u.id);
      assert.equal(uJob.state, "uncertain", "ön koşul: U Sonucu Belirsiz");
      await eraseOk(ctx, a.id);
      await eraseOk(ctx, u.id);
      ctx.clock.advance(HOUR);
      // Başarısızları Yeniden Dene: A "İçeriği Silindi" (E2'den önce, tek neden), B alınır ve gider.
      const retried = await ok(await ctx.api.post(`${URLS.batches}/${failed.batch.id}/retry-failed`, {}), "Başarısızları Yeniden Dene");
      assert.deepEqual(retried.summary.skipped, { "İçeriği Silindi": 1 }, `A elendi (${JSON.stringify(retried.summary.skipped)})`);
      assert.equal(retried.summary.sendable, 1, "B alındı");
      const toA = sentTo(ctx, "+905321112233");
      await ctx.drain();
      assert.equal(sentTo(ctx, "+905321112233"), toA, "A'ya aynı iş üzerinden gitmedi");
      // Yine de Gönder (U, silinmiş belirsiz Ekstre): 400 + neden; düğmenin işi (yeni iş) açılmaz.
      const anyway = await ctx.api.post(`/api/workspace/whatsapp/jobs/${uJob.id}/send-anyway`, { confirm: true });
      assert.equal(anyway.status, 400, `Yine de Gönder reddedildi (geldi ${anyway.status} ${JSON.stringify(anyway.data)})`);
      assert.match(anyway.data.error, /İçeriği Silindi: 1/);
      assert.match(anyway.data.error, /aynı ekstre yeniden gönderilemez/);
      // S36: aynı dönem yeni gönderim U'yu "Sonucu Belirsiz" ile eler — R3 "Yine de Gönder" bayrağı da aşmaz; A (Başarısız, iz R3'te sayılmaz) uyarısız gider.
      const same = await preview(ctx, { kind: "statement", ids: [a.id, u.id], preset: "thisMonth", sendAgain: true });
      assert.deepEqual(skipOf(same), { [a.id]: "gönderilecek", [u.id]: "Sonucu Belirsiz" }, "S36 + S31: aynı dönem");
      // Sonraki dönem (Aralık) U'ya gider.
      ctx.clock.set(localIso(2026, 12, 2, 10));
      assert.deepEqual(skipOf(await preview(ctx, { kind: "statement", ids: [u.id], preset: "thisMonth" })), { [u.id]: "gönderilecek" }, "sonraki dönem gider");
    } finally {
      await ctx.close();
    }
  });

  it("S37 = B (Ödeme Hatırlatma): silinmiş Başarısız → Yeniden Dene ve silinmiş Sonucu Belirsiz → Yine de Gönder karttan YENİ içerikle gider; kart telefonu da silindiyse 'Telefon yok'", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const f = await ctx.account("Ferda Uç", "0532 111 22 33");
      const t = await ctx.account("Tuna Ilgaz", "0532 444 55 66");
      const r = await ctx.account("Rana Öz", "0532 777 88 99");
      for (const who of [f, t, r]) await ok(await ctx.api.post("/api/workspace/plans", { accountId: who.id, name: "Taksit", total: "3000", count: 3, firstDue: "2026-11-15", startDate: "2026-11-03" }), "taksit kartı");
      ctx.clock.set(localIso(2026, 12, 20, 10));
      ctx.fake.state.recipientErrors["+905321112233"] = { status: 400, body: metaError(131026, "Message undeliverable") };
      ctx.fake.state.recipientErrors["+905324445566"] = { status: 400, body: metaError(131026, "Message undeliverable") };
      const failed = await ok(await ctx.batch({ kind: "reminder", ids: [f.id, t.id] }), "F, T Başarısız");
      await ctx.drain();
      ctx.fake.state.recipientErrors = {};
      ctx.fake.state.hang = /messages/;
      const unsure = await ok(await ctx.batch({ kind: "reminder", ids: [r.id] }), "R Sonucu Belirsiz");
      await ctx.drain();
      ctx.fake.state.hang = null;
      const rJob = await jobOf(ctx, unsure.batch.id, r.id);
      assert.equal(rJob.state, "uncertain", "ön koşul: R Sonucu Belirsiz");
      for (const who of [f, t, r]) await eraseOk(ctx, who.id);
      // T'nin kart telefonu da silinir (ayrı olay: kartı düzenleme).
      await ok(await ctx.api.put(`/api/workspace/accounts/${t.id}`, { ...(await ok(await ctx.api.get(`/api/workspace/accounts/${t.id}`), "kart")), phone: "" }), "T telefonu sil");
      ctx.clock.advance(HOUR);
      const retried = await ok(await ctx.api.post(`${URLS.batches}/${failed.batch.id}/retry-failed`, {}), "Başarısızları Yeniden Dene");
      assert.deepEqual(retried.summary.skipped, { "Telefon yok": 1 }, `F alınır; T 'Telefon yok' (${JSON.stringify(retried.summary.skipped)})`);
      await ctx.drain();
      const fNew = await jobOf(ctx, retried.batch.id, f.id);
      assert.deepEqual([fNew.state, fNew.phone, fNew.params.length, Boolean(fNew.contentErased)], ["accepted", "+905321112233", 5, false], "F karttan yeni içerikle gitti");
      const anyway = await ok(await ctx.api.post(`/api/workspace/whatsapp/jobs/${rJob.id}/send-anyway`, { confirm: true }), "R Yine de Gönder");
      await ctx.drain();
      const rNew = await jobOf(ctx, anyway.batch.id, r.id);
      assert.deepEqual([rNew.state, rNew.phone, rNew.params.length, Boolean(rNew.contentErased)], ["accepted", "+905327778899", 5, false], "R silinmiş içerik devralınmadan karttan gitti");
      assert.equal(rNew.params[0], "Rana Öz");
    } finally {
      await ctx.close();
    }
  });

  it("S32 (002, geri yükleme hemen): talepten ÖNCE alınmış yedek → silinmiş içerik / telefon GELMEZ; talepten SONRA açılan iş kalır; talepten sonraki yedek: o içerik durur", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const s = await secondCompany(ctx);
      const a = await s.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const b = await s.account("Bora Demir", "0532 444 55 66", 300);
      const oct = await s.batch({ kind: "statement", ids: [a.id, b.id], preset: "lastMonth" });
      await ctx.drain();
      for (const job of await jobsOf(ctx, oct.batch.id, s.q)) s.queue().applyStatuses([statusOf(ctx, job.wamid, "delivered")], { phoneNumberId: PNID });
      const y0 = await s.backup();
      ctx.clock.advance(HOUR);
      await eraseOk(ctx, a.id, s.q);
      ctx.clock.advance(HOUR);
      const nov = await s.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
      await ctx.drain();
      const y1 = await s.backup();
      // Y0 (talepten önce): A'nın Ekim içeriği GELMEZ, B'ninki durur.
      await s.restore(y0);
      const octA = await jobOf(ctx, oct.batch.id, a.id, s.q);
      const octB = await jobOf(ctx, oct.batch.id, b.id, s.q);
      assert.deepEqual([octA.phone, octA.params.length, Boolean(octA.contentErased), octA.state], ["", 0, true, "delivered"], "Y0 geri yüklendi: A'nın Ekim içeriği silinmiş (iz kalır)");
      assert.deepEqual([octB.phone, octB.params.length, Boolean(octB.contentErased)], ["+905324445566", 4, false], "B'ninki durur");
      // Y1 (talepten sonra): Ekim silinmiş, Kasım (talepten sonra yazılan) DURUR.
      await s.restore(y1);
      assert.equal(Boolean((await jobOf(ctx, oct.batch.id, a.id, s.q)).contentErased), true, "Y1: Ekim silinmiş");
      const novA = await jobOf(ctx, nov.batch.id, a.id, s.q);
      assert.deepEqual([novA.phone, novA.params.length, Boolean(novA.contentErased)], ["+905321112233", 4, false], "Y1: talepten sonraki Kasım içeriği durur");
      // Kime / kaç kez: aynı dönem (Ekim) A ve B "Daha Önce Gönderildi" (iz + defter).
      ctx.clock.advance(HOUR);
      assert.deepEqual(skipOf(await preview(ctx, { kind: "statement", ids: [a.id, b.id], preset: "lastMonth" }, s.q)), { [a.id]: "Daha Önce Gönderildi", [b.id]: "Daha Önce Gönderildi" }, "geri yüklemeden sonra da aynı dönem elenir");
    } finally {
      await ctx.close();
    }
  });

  it("S32 (001, geri yükleme yeniden açılışta) + S38 (taşıma: gönderim defteri yok, talep dosyası veri klasöründe) + zincirleme taşıma + yeni bilgisayarda yeni talep: talepten önceki yedek içeriği GELMEZ", { timeout: 180_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-w3-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    let ctx = await startWa({ env: DEAD, dataDir, backupDir, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    const move = async (from, label) => {
      // Başka bilgisayar: veri ve yedek klasörü kopyalanır, gönderim defteri (bilgisayara özgü) gitmez; talep dosyası veri klasörüyle gider.
      const to = path.join(root, label);
      cpSync(path.join(from, "data"), path.join(to, "data"), { recursive: true });
      cpSync(path.join(from, "backups"), path.join(to, "backups"), { recursive: true });
      for (const name of readdirSync(path.join(to, "data"))) if (name.startsWith("whatsapp-gonderim.sqlite")) renameSync(path.join(to, "data", name), path.join(to, `eski-${name}`));
      return to;
    };
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const c = await ctx.account("Cem Kara", "0532 777 88 99", 200);
      const oct = await ok(await ctx.batch({ kind: "statement", ids: [a.id, c.id], preset: "lastMonth" }), "Ekim");
      await ctx.drain();
      await deliverAll(ctx, oct.batch.id);
      const y0 = (await ok(await ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }), "Y0")).backups[0].name;
      ctx.clock.advance(HOUR);
      await eraseOk(ctx, a.id);
      // 001 geri yükleme: yeniden açılışta uygulanır; talep yeniden uygulanır.
      const staged = await ok(await ctx.api.post("/api/admin/backups/restore", { name: y0, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }), "001 geri yükle");
      assert.equal(staged.staged, true, "ön koşul: 001 yeniden açılışta geri yüklenir");
      await ctx.close();
      ctx = await startWa({ env: DEAD, dataDir, backupDir, connect: false, ack: false, now: { time: localIso(2026, 11, 3, 12), fixed: true } });
      const restoredA = await jobOf(ctx, oct.batch.id, a.id);
      assert.deepEqual([restoredA.phone, restoredA.params.length, Boolean(restoredA.contentErased)], ["", 0, true], "001: talepten önceki yedekten A'nın içeriği GELMEDİ");
      assert.equal((await jobOf(ctx, oct.batch.id, c.id)).params.length, 4, "001: C'ninki durur");
      await ctx.close();
      // Taşıma 1: yeni bilgisayarda Y0 geri yüklenir → yine gelmez (talep dosyası taşındı).
      const m1 = await move(root, "bilgisayar-2");
      ctx = await startWa({ env: DEAD, dataDir: path.join(m1, "data"), backupDir: path.join(m1, "backups"), connect: false, ack: false, now: { time: localIso(2026, 11, 3, 13), fixed: true } });
      assert.equal(existsSync(path.join(m1, "data", "whatsapp-silme-talepleri.sqlite")), true, "talep dosyası taşındı");
      await ok(await ctx.api.post("/api/admin/backups/restore", { name: y0, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }), "taşınan bilgisayarda Y0");
      await ctx.close();
      ctx = await startWa({ env: DEAD, dataDir: path.join(m1, "data"), backupDir: path.join(m1, "backups"), connect: false, ack: false, now: { time: localIso(2026, 11, 3, 14), fixed: true } });
      assert.equal(Boolean((await jobOf(ctx, oct.batch.id, a.id)).contentErased), true, "taşıma + Y0: A'nın içeriği GELMEDİ (S38)");
      // Yeni bilgisayarda C için yeni talep → zincirleme taşıma + Y0 → ikisi de gelmez.
      await eraseOk(ctx, c.id);
      await ctx.close();
      const m2 = await move(m1, "bilgisayar-3");
      ctx = await startWa({ env: DEAD, dataDir: path.join(m2, "data"), backupDir: path.join(m2, "backups"), connect: false, ack: false, now: { time: localIso(2026, 11, 3, 15), fixed: true } });
      await ok(await ctx.api.post("/api/admin/backups/restore", { name: y0, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }), "zincirleme taşımada Y0");
      await ctx.close();
      ctx = await startWa({ env: DEAD, dataDir: path.join(m2, "data"), backupDir: path.join(m2, "backups"), connect: false, ack: false, now: { time: localIso(2026, 11, 3, 16), fixed: true } });
      const jobs = await jobsOf(ctx, oct.batch.id);
      assert.deepEqual(jobs.map(job => Boolean(job.contentErased)), [true, true], "zincirleme taşıma: A ve C'nin içeriği gelmedi");
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });

  it("İki şirket: 002'deki talep yalnız 002'nin carisini siler (001'de aynı adlı / telefonlu cari etkilenmez); talep kaydı şirket kimliğiyle", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a1 = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const first = await ok(await ctx.batch({ kind: "statement", ids: [a1.id], preset: "thisMonth" }), "001");
      await ctx.drain();
      const s = await secondCompany(ctx);
      const a2 = await s.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const second = await s.batch({ kind: "statement", ids: [a2.id], preset: "thisMonth" });
      await ctx.drain();
      await eraseOk(ctx, a2.id, s.q);
      assert.equal(Boolean((await jobOf(ctx, second.batch.id, a2.id, s.q)).contentErased), true, "002'deki iş silindi");
      const keep = await jobOf(ctx, first.batch.id, a1.id);
      assert.deepEqual([keep.phone, keep.params.length, Boolean(keep.contentErased)], ["+905321112233", 4, false], "001'deki aynı kişinin işi durur");
      // 001'in carisi 002'de yok: 001 kimliğiyle 002'de talep → 404.
      assert.equal((await erase(ctx, a1.id, s.q)).status, 404, "başka şirketin carisi bu şirkette bulunamaz");
    } finally {
      await ctx.close();
    }
  });

  it("KVKK sızıntı denetimi: talepten sonra günlükte, veri klasöründeki BÜTÜN dosyalarda (şirket dosyası, WAL, makine defteri, talep dosyası) ve yeni yedekte silinen telefon, ad, ileti metni ve numarayı taşıyan wamid YOK", { timeout: 120_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-w3-sizinti-"));
    const lines = [];
    const write = level => (message, meta) => lines.push(`[${level}] ${message}${meta === undefined ? "" : ` ${meta instanceof Error ? meta.stack || meta.message : JSON.stringify(meta)}`}`);
    const ctx = await startWa({ env: DEAD, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: localIso(2026, 11, 3, 10), fixed: true }, log: { debug: write("DEBUG"), info: write("INFO"), warn: write("WARN"), error: write("ERROR") } });
    try {
      // Meta'nın gerçek wamid'i alıcının numarasını base64 taşır (Meta örnekleri) — sahte Meta da öyle üretir.
      ctx.fake.state.wamidOf = (to, n) => `wamid.${Buffer.from(`\x1c\x18\x0c${String(to).replace(/\D/g, "")}\x15\x02\x00\x11\x18\x12${String(n).padStart(18, "0")}`, "latin1").toString("base64")}`;
      const name = "Zümrüt Sızıntıoğlu";
      const z = await ctx.account(name, "0532 765 43 21", 1234.56);
      const k = await ctx.account("Kalan Kişi", "0532 111 00 99", 10);
      const made = await ok(await ctx.batch({ kind: "statement", ids: [z.id, k.id], preset: "thisMonth" }), "Kasım");
      await ctx.drain();
      await deliverAll(ctx, made.batch.id);
      const zJob = (await jobsOf(ctx, made.batch.id)).find(job => job.accountId === z.id);
      const wamid = zJob.wamid;
      assert.match(Buffer.from(wamid.slice(6), "base64").toString("latin1"), /905327654321/, "ön koşul: wamid numarayı taşıyor");
      // Silmeden önce değerler dosyada VAR (testin dişi). Dosya düzeyinde yalnız gönderim kaydına özgü biçimler (E.164 / wa.me numarası, PDF adı, bakiye metni, wamid): cari
      // kartının kendisi ve işlem geçmişi (audit_events — kartın açılış / düzenleme kaydı) karar gereği kalır (kart DEĞİŞMEZ; TTK); ad yalnız gönderim tablolarında ve
      // makine dosyalarında aranır.
      const needles = ["905327654321", "+905327654321", `Ekstre ${name}`, "1.234,56 TL", wamid];
      const machineFiles = () => files(path.join(root, "data")).filter(file => /whatsapp-(gonderim|silme-talepleri)\.sqlite/.test(path.basename(file)));
      const waTables = file => {
        const db = new DatabaseSync(file, { readOnly: true });
        try {
          return ["SELECT COUNT(*) AS n FROM wa_jobs WHERE account_name LIKE ?1 OR params_json LIKE ?1 OR pdf_name LIKE ?1", "SELECT COUNT(*) AS n FROM message_sends WHERE body LIKE ?1"].reduce((sum, sql) => sum + db.prepare(sql).get(`%${name}%`).n, 0);
        } finally {
          db.close();
        }
      };
      const hits = () => [
        ...needles.flatMap(needle => [...files(path.join(root, "data")), ...files(path.join(root, "backups"))].filter(file => readFileSync(file).includes(Buffer.from(needle))).map(file => `${needle} @ ${path.relative(root, file)}`)),
        ...machineFiles().filter(file => readFileSync(file).includes(Buffer.from(name))).map(file => `${name} @ ${path.relative(root, file)}`),
      ];
      assert.ok(hits().length > 0, "ön koşul: silmeden önce değerler dosyalarda");
      assert.ok(waTables(path.join(root, "data", "destekofis.sqlite")) > 0, "ön koşul: ad gönderim tablolarında");
      await ok(await ctx.api.put(`/api/workspace/accounts/${z.id}`, { ...(await ok(await ctx.api.get(`/api/workspace/accounts/${z.id}`), "kart")), name: "Z. S. (KVKK)", phone: "" }), "kart da düzenlendi (ayrı olay)");
      await eraseOk(ctx, z.id);
      await ctx.drain();
      const backup = await ok(await ctx.api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }), "yeni yedek");
      assert.ok(backup.backups[0].name, "yedek alındı");
      assert.deepEqual(hits(), [], "veri klasöründe (şirket dosyası, WAL, makine defteri, talep dosyası) ve yedekte silinen değer kalmadı");
      const backupFile = files(path.join(root, "backups")).find(file => file.endsWith(".sqlite") && file.includes(backup.backups[0].name));
      assert.ok(backupFile, `yedek dosyası bulundu (${backup.backups[0].name})`);
      assert.deepEqual([waTables(path.join(root, "data", "destekofis.sqlite")), waTables(backupFile)], [0, 0], "gönderim tablolarında ad yok (dosya + yedek)");
      assert.deepEqual(lines.filter(line => needles.some(needle => line.includes(needle))), [], "günlükte silinen değer yok");
      const keep = (await jobsOf(ctx, made.batch.id)).find(job => job.accountId === k.id);
      assert.equal(keep.params.length, 4, "öbür kişinin içeriği durur");
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });

  it("Makine defteri 'yalnız eklenir' kalır, tek istisna KVKK anonimleştirmesi: eski (2.4.9) tetikli defter açılınca yükseltilir; telefon → 'silinmis:<iş>' ve wamid → özet geçer, öbür her UPDATE / DELETE düşer", { timeout: 60_000 }, async () => {
    const { openWaLedger } = await import("../server/lib/whatsapp/defter.mjs");
    const dir = mkdtempSync(path.join(tmpdir(), "destekofis-w3-defter-"));
    try {
      let ledger = openWaLedger({ dir, log: { warn() {}, info() {} } });
      ledger.claim({ jobId: "waj-1", attempt: 1, batchId: "wab-1", companyId: "sirket-001", wabaId: WABA, phone: "+905321112233", accountId: "account-1", kind: "statement", periodKey: "ay|2026-11", at: "2026-11-03T07:00:00.000Z" });
      ledger.outcome({ jobId: "waj-1", attempt: 1, outcome: "accepted", wamid: "wamid.ABC", at: "2026-11-03T07:00:01.000Z", companyId: "sirket-001", wabaId: WABA });
      ledger.close();
      // 2.4.9 düzeni: koşulsuz "yalnız eklenir" tetikleri (eski defter).
      const file = path.join(dir, "whatsapp-gonderim.sqlite");
      let db = new DatabaseSync(file);
      for (const [name, table] of [["claims_no_update", "claims"], ["outcomes_no_update", "outcomes"], ["learned_wamids_no_update", "learned_wamids"]]) {
        db.exec(`DROP TRIGGER IF EXISTS ${name}; CREATE TRIGGER ${name} BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'gönderim defteri yalnız eklenir'); END;`);
      }
      db.close();
      ledger = openWaLedger({ dir, log: { warn() {}, info() {} } });
      ledger.close();
      db = new DatabaseSync(file);
      const tryRun = sql => {
        try {
          db.exec(sql);
          return "geçti";
        } catch (error) {
          return /yalnız eklenir/.test(error.message) ? "reddedildi" : `hata: ${error.message}`;
        }
      };
      try {
        assert.equal(tryRun("UPDATE claims SET phone = 'silinmis:waj-1' WHERE job_id = 'waj-1'"), "geçti", "telefonun anonimleştirilmesi geçer (yükseltilmiş tetik)");
        assert.equal(tryRun(`UPDATE outcomes SET wamid = 'h:${"a".repeat(64)}' WHERE job_id = 'waj-1'`), "geçti", "wamid özeti geçer");
        assert.deepEqual(
          [
            tryRun("UPDATE claims SET phone = '+905000000000'"),
            tryRun("UPDATE claims SET at = 'x'"),
            tryRun("UPDATE claims SET phone = 'silinmis:başka'"),
            tryRun(`UPDATE outcomes SET wamid = 'h:${"b".repeat(64)}'`),
            tryRun("UPDATE outcomes SET outcome = 'failed'"),
            tryRun("DELETE FROM claims"),
            tryRun("DELETE FROM outcomes"),
          ],
          Array(7).fill("reddedildi"),
          "öbür her değişiklik yine reddedilir",
        );
      } finally {
        db.close();
      }
    } finally {
      removeTestDir(dir);
    }
  });

  it("Yarıda kesilme: talep makineye yazılamazsa 503 ve HİÇBİR şey silinmez; talep yazılıp şirket dosyası yazılamazsa açılışta tamamlanır", { timeout: 120_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-w3-kesinti-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    let ctx = await startWa({ env: DEAD, dataDir, backupDir, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const made = await ok(await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "Kasım");
      await ctx.drain();
      const ledger = ctx.server.app.whatsapp.ledger;
      const original = ledger.addErasureRequest;
      ledger.addErasureRequest = () => {
        throw Object.assign(new Error("database or disk is full"), { code: "ERR_SQLITE_ERROR" });
      };
      const refused = await erase(ctx, a.id);
      ledger.addErasureRequest = original;
      assert.equal(refused.status, 503, `talep yazılamadı → 503 (geldi ${refused.status})`);
      assert.match(refused.data.error, /hiçbir kayıt silinmedi/);
      assert.equal((await jobOf(ctx, made.batch.id, a.id)).params.length, 4, "hiçbir şey silinmedi");
      // Talep yazıldı, şirket dosyası yazılamadı (benzetim: uç değil doğrudan defter) → açılışta tamamlanır.
      ledger.addErasureRequest("sirket-001", a.id, ctx.clock().toISOString());
      assert.equal((await jobOf(ctx, made.batch.id, a.id)).params.length, 4, "ön koşul: dosyada içerik duruyor");
      await ctx.close();
      ctx = await startWa({ env: DEAD, dataDir, backupDir, connect: false, ack: false, now: { time: localIso(2026, 11, 3, 11), fixed: true } });
      assert.equal(Boolean((await jobOf(ctx, made.batch.id, a.id)).contentErased), true, "açılışta talep uygulandı");
    } finally {
      await ctx.close();
      removeTestDir(root);
    }
  });
});
