// 2.5.0 WhatsApp TUR 2 — bildirim (web kancası) yolu: tur 1 dar kontrol ORTA-1 (v2.4.9 hook_seen), S58, S63 (KULLANICI KARARLARI AYNEN, docs/2.5.0-IS-LISTESI.md D) +
// tur 1 dk DÜŞÜK-2 (M12 test boşluğu). Tasarım: docs/erp/WA-TUR2-TASARIM.md (koddan önce). Beklenenler karar metinlerinden ve "kime kaç kez" genel ilkesinden (31.10) yazıldı:
//   ORTA-1 — v2.4.9'un WABA düzeyi hook_seen satırı (tanınmayan / imzasız bildirim de koyuyordu) yükseltmeden sonra "bildirim yolu çalışıyor" SAYILMAZ (S33 / S43'ün eski veriye
//            uygulanması; ilke 2 "almış olabilirse elenir") → teslim bilgisi gelmeyen iş TTL + 1 sa sonra "Meta Kabul Etti", kişi "Daha Önce Gönderildi".
//   S58 = A — bağlantı yolu (kip) değişince işaret sıfırlanır (her iki yön, geri dönüş; aynı kipte Bilgileri Değiştir işareti korur — karar yalnız kip der).
//   S63 = A — kanca kaydı WABA + UYGULAMA başına; adres denetimi yalnız kendi uygulamasının satırı; S41 denetimi yalnız Elle Bağla şirketiyle. Meta'nın listeleme davranışı
//             DOĞRULANMADI → iki model (hepsi / kendi) — ikisinde de iki şirketin teslimi 200, bir şirketin kaydı / denetimi öbürünü 404'e düşürmez.
// ESKİ SÜRÜM VERİSİ programın GERÇEK koduyla üretildi (CLAUDE.md TEST VERİSİ; ders 23): test/fixtures/whatsapp-kanca-v249-tek ve -iki (v2.4.9 = ccf0b0ca), whatsapp-kvkk-329d5d1b
// (tur 2'den önceki kod); üretim betikleri uret.mjs.txt, sonuçları bilgi.json. Gizli anahtar dosyası fikstürde YOK → bağlantı yeniden girilir (veri başka bilgisayardan gelmiş gibi).
// Düzenek: GERÇEK program + yerel SAHTE Meta + iki uygulamalı vekil (test/whatsapp-sahte-graph.mjs startTwoAppProxy — aynı el, kâhin DEĞİL, ders 5). Şablonun teslim süresi 12 sa
// (düzenek). Ders 13: sahte saat; TZ=UTC ve TZ=Europe/Istanbul. Ders 30: lisans servisi yerel ölü adres. Ders 48: fikstür geçici klasöre açılır (yalnız kendi tam yolu silinir).
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { OFFICE, PNID, PROGRAM_TEMPLATES, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";
import { startFakeGraph, startTwoAppProxy } from "./whatsapp-sahte-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOUR = 3_600_000;
const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const SENT_BEFORE = "Daha Önce Gönderildi";
const TOKEN_A = "SAHTE-UYGULAMA-A-musteri-belirteci-0123456789-abcdefABCDEF";
const TOKEN_B = "SAHTE-UYGULAMA-B-destekofis-belirteci-0123456789-abcdefXYZ";
const APP_A = "111111111111111"; // Elle Bağla — müşterinin uygulaması
const APP_B = "222222222222222"; // WhatsApp'ı Bağla — DestekOfis uygulaması
const EMBEDDED_EVENT = "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";
const ttl12 = fake => {
  for (const tpl of fake.state.templates) if (String(tpl.name).startsWith("destekofis_")) tpl.message_send_ttl_seconds = 43_200;
};
const statusEvent = (statuses, entryId = WABA) => JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: entryId, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] });
function raw(base, method, pathAndQuery, body = null) {
  const url = new URL(base);
  const payload = body === null ? null : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path: pathAndQuery, headers: payload ? { "content-type": "application/json", "content-length": payload.length } : {} }, res => {
      const parts = [];
      res.on("data", chunk => parts.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
async function ok(promise, label) {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data.data;
}
const adminOf = server => server.app.store.all("SELECT id, username, display_name FROM users WHERE username = ?", "admin")[0];
const embed = (app, server, token = TOKEN) => app.context.whatsapp.connection.saveEmbedded(adminOf(server), { token, wabaId: WABA, phoneNumberId: PNID, olay: EMBEDDED_EVENT });
const ledgerGet = (file, sql, ...args) => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare(sql).get(...args);
  } finally {
    db.close();
  }
};

/** Fikstürü (programın gerçek koduyla üretilmiş veri klasörü) yeni geçici köke açar. */
function unpack(name) {
  const dir = path.join(HERE, "fixtures", name);
  const info = JSON.parse(readFileSync(path.join(dir, "bilgi.json"), "utf8"));
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-tur2-"));
  const dataDir = path.join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  const put = (file, target) => {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, gunzipSync(readFileSync(path.join(dir, file))));
  };
  put("destekofis.sqlite.gz", path.join(dataDir, "destekofis.sqlite"));
  put("whatsapp-gonderim.sqlite.gz", path.join(dataDir, "whatsapp-gonderim.sqlite"));
  if (existsSync(path.join(dir, "002.sqlite.gz"))) put("002.sqlite.gz", path.join(dataDir, "sirketler", "002", "destekofis.sqlite"));
  if (existsSync(path.join(dir, "whatsapp-silme-talepleri.sqlite.gz"))) put("whatsapp-silme-talepleri.sqlite.gz", path.join(dataDir, "whatsapp-silme-talepleri.sqlite"));
  for (const file of ["sirketler.json", "sirketler.yedek.json"]) if (existsSync(path.join(dir, file))) copyFileSync(path.join(dir, file), path.join(dataDir, file));
  return { root, dataDir, backupDir: path.join(root, "backups"), info };
}

/** Sahte Meta (program şablonları, 12 sa) + iki uygulamalı vekil. subs: { [uygulama]: gizli yol } — Meta'da şu an kayıtlı alternatif adresler (fikstürden). */
async function twoApps({ listing, publicUrl, subs = {} }) {
  const backend = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
  backend.state.templates.push(...PROGRAM_TEMPLATES());
  ttl12(backend);
  const proxy = await startTwoAppProxy({ backend, backendToken: TOKEN, wabaId: WABA, apps: { [TOKEN_A]: { id: APP_A, name: "Müşterinin Uygulaması (A)" }, [TOKEN_B]: { id: APP_B, name: "DestekOfis Mesaj (B)" } }, listing });
  for (const [app, secret] of Object.entries(subs)) proxy.subs.set(app, { override: `${publicUrl}/wa/kanca/${secret}` });
  return {
    backend,
    proxy,
    /** Vekilin günlüğünden `from`'dan sonraki subscribed_apps istekleri: ["GET A", "POST B" …]. */
    since: from => proxy.log.slice(from).map(item => `${item.method} ${item.app === APP_A ? "A" : "B"}`),
    async close() {
      await proxy.close();
      await backend.close();
    },
  };
}

describe("2.5.0 WhatsApp tur 2 — İş 1 (tur 1 dk ORTA-1): v2.4.9'un WABA düzeyi hook_seen satırı yükseltmeden sonra işaret SAYILMAZ", () => {
  it("T2-1 v2.4.9 GERÇEK verisi (tanınmayan wamid'li imzasız bildirim → hook_seen 1, şirket işareti yok) → 13,5 sa sonra bakım turu: iş Meta Kabul Etti, kişi Daha Önce Gönderildi", { timeout: 180_000 }, async () => {
    const fx = unpack("whatsapp-kanca-v249-tek");
    assert.equal(fx.info.hookSeenRows, 1, "ön koşul: v2.4.9 defterinde WABA düzeyi işaret satırı");
    assert.equal(fx.info.companyMark, "", "ön koşul: v2.4.9'da şirket işareti YOK (bildirim tanınmadı)");
    assert.equal(fx.info.jobState, "accepted", "ön koşul: iş Meta Kabul Etti, teslim bilgisi yok");
    const at = Date.parse(fx.info.at) + 13.5 * HOUR;
    const ctx = await startWa({ env: DEAD, dataDir: fx.dataDir, backupDir: fx.backupDir, connect: false, ack: false, office: null, now: { time: new Date(at).toISOString(), fixed: true } });
    try {
      ttl12(ctx.fake);
      await ok(ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "bağlantı yeniden girildi (gizli anahtar fikstürde yok)");
      assert.equal(ledgerGet(ctx.wa.ledger.file, "SELECT COUNT(*) AS n FROM hook_seen").n, 1, "eski satır defterde duruyor (silinmez, okunmaz)");
      await ctx.drain();
      const job = (await ctx.jobs(fx.info.batchId))[0];
      assert.equal(job.state, "accepted", "v2.4.9'un WABA düzeyi işareti sayılmadı → Süresi Doldu DEĞİL (eski kod: expired)");
      const preview = await ok(ctx.api.post(URLS.preview, { kind: "statement", ids: [fx.info.accountId], preset: "thisMonth" }), "önizleme");
      assert.deepEqual((preview.people || []).map(p => p.skip || "gönderilecek"), [SENT_BEFORE], "almış olabilecek kişi aynı dönemde gönderilecek GÖRÜNMEZ (ilke 2)");
    } finally {
      await ctx.close();
      removeTestDir(fx.root);
    }
  });
});

// ---- S58: tek şirket, programın kendi kancası (queue.applyStatuses — işareti koyan yol) ----
async function s58() {
  const ctx = await startWa({ env: DEAD });
  ttl12(ctx.fake);
  const s = {
    ctx,
    async sent(name, phone) {
      const account = await ctx.account(name, phone, 800);
      const batch = await ok(ctx.batch({ kind: "statement", ids: [account.id], preset: "thisMonth" }), "toplu iş");
      await ctx.drain();
      const job = (await ctx.jobs(batch.batch.id))[0];
      assert.equal(job.state, "accepted", "ön koşul: Meta Kabul Etti");
      ctx.clock.advance(60_000);
      return { batchId: batch.batch.id, job, accountId: account.id };
    },
    mark(job, signed = false) {
      ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock.ms() / 1000)), recipient_id: "905321112233" }], { signed });
      assert.notEqual(ctx.store.setting("whatsapp.hookSeen", ""), "", "ön koşul: bildirim yolu işareti kondu");
    },
    toEmbedded: () => embed(ctx.server.app, ctx.server),
    toManual: () => ok(ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "Elle Bağla"),
    async pastTtl(target) {
      ctx.clock.advance(13.5 * HOUR);
      await ctx.drain();
      const state = (await ctx.jobs(target.batchId))[0].state;
      const preview = await ok(ctx.api.post(URLS.preview, { kind: "statement", ids: [target.accountId], preset: "thisMonth" }), "önizleme");
      return { state, skip: (preview.people || []).map(p => p.skip || "gönderilecek") };
    },
    mode: () => ctx.server.app.context.whatsapp.connection.read()?.mode,
  };
  return s;
}

describe("2.5.0 WhatsApp tur 2 — S58 = A: kip değişince bildirim yolu işareti sıfırlanır (teslim süresi 12 sa)", () => {
  it("T2-2a Yol 1 → Yol 2: Yol 1'in işareti Yol 2'de sayılmaz — teslim bilgisi gelmeyen iş TTL + 1 sa sonra Meta Kabul Etti, Daha Önce Gönderildi", { timeout: 120_000 }, async () => {
    const s = await s58();
    try {
      const x = await s.sent("Ayşe Yılmaz", "0532 111 22 33");
      s.mark(x.job);
      const y = await s.sent("Bora Demir", "0533 444 55 66");
      s.toEmbedded();
      assert.equal(s.mode(), "embedded", "ön koşul: kip değişti");
      assert.deepEqual(await s.pastTtl(y), { state: "accepted", skip: [SENT_BEFORE] }, "eski kod: expired + gönderilecek");
      assert.equal(s.ctx.store.setting("whatsapp.hookSeen", ""), "", "kip değişince işaret silindi");
    } finally {
      await s.ctx.close();
    }
  });
  it("T2-2b Yol 2 → Yol 1 (ters yön): Yol 2'nin imzalı bildirimiyle konan işaret Yol 1'de sayılmaz", { timeout: 120_000 }, async () => {
    const s = await s58();
    try {
      s.toEmbedded();
      const x = await s.sent("Ayşe Yılmaz", "0532 111 22 33");
      s.mark(x.job, true);
      const y = await s.sent("Bora Demir", "0533 444 55 66");
      await s.toManual();
      assert.equal(s.mode(), "manual");
      assert.deepEqual(await s.pastTtl(y), { state: "accepted", skip: [SENT_BEFORE] }, "eski kod: expired + gönderilecek");
      assert.equal(s.ctx.store.setting("whatsapp.hookSeen", ""), "", "kip değişince işaret silindi");
    } finally {
      await s.ctx.close();
    }
  });
  it("T2-2c geri dönüş: Yol 1 → Yol 2 → Yol 1 — eski işaret DİRİLMEZ", { timeout: 120_000 }, async () => {
    const s = await s58();
    try {
      const x = await s.sent("Ayşe Yılmaz", "0532 111 22 33");
      s.mark(x.job);
      const y = await s.sent("Bora Demir", "0533 444 55 66");
      s.toEmbedded();
      await s.toManual();
      assert.equal(s.mode(), "manual");
      assert.deepEqual(await s.pastTtl(y), { state: "accepted", skip: [SENT_BEFORE] }, "eski kod: expired + gönderilecek");
      assert.equal(s.ctx.store.setting("whatsapp.hookSeen", ""), "");
      // Yeni yolun ilk tanınan bildirimi işareti yeniden koyar (tur 1 kuralı aynen): sonra gönderilen işin süresi dolunca Süresi Doldu.
      const z = await s.sent("Cem Kara", "0534 777 88 99");
      s.mark(y.job);
      assert.equal(s.ctx.store.setting("whatsapp.hookSeenMode", ""), "manual", "işaretle birlikte kipi yazıldı");
      assert.equal((await s.pastTtl(z)).state, "expired", "yeni yolun bildirimiyle işaret geçerli (Yol 1 aynen)");
    } finally {
      await s.ctx.close();
    }
  });
  it("T2-2d aynı kipte Bilgileri Değiştir: işaret KALIR (karar yalnız kip der) — iş TTL + 1 sa sonra Süresi Doldu (bugünkü kural)", { timeout: 120_000 }, async () => {
    const s = await s58();
    try {
      const x = await s.sent("Ayşe Yılmaz", "0532 111 22 33");
      s.mark(x.job);
      const y = await s.sent("Bora Demir", "0533 444 55 66");
      await s.toManual(); // aynı kip, belirteç yeniden yazıldı
      assert.notEqual(s.ctx.store.setting("whatsapp.hookSeen", ""), "", "aynı kipte işaret korundu");
      assert.deepEqual(await s.pastTtl(y), { state: "expired", skip: ["gönderilecek"] }, "Yol 1'in işareti Yol 1'de geçerli");
    } finally {
      await s.ctx.close();
    }
  });
  it("T2-2e Bağlantıyı Kaldır + başka kiple bağla: işaret silinir; Kaldır + aynı kiple bağla: işaretin kipi kayıtlı → KALIR", { timeout: 180_000 }, async () => {
    const s = await s58();
    try {
      const x = await s.sent("Ayşe Yılmaz", "0532 111 22 33");
      s.mark(x.job);
      const y = await s.sent("Bora Demir", "0533 444 55 66");
      await ok(s.ctx.api.del(URLS.conn), "Bağlantıyı Kaldır");
      s.toEmbedded();
      assert.deepEqual(await s.pastTtl(y), { state: "accepted", skip: [SENT_BEFORE] }, "eski kod: expired + gönderilecek");
      assert.equal(s.ctx.store.setting("whatsapp.hookSeen", ""), "", "Kaldır + Yol 2: işaret silindi");
    } finally {
      await s.ctx.close();
    }
    const t = await s58();
    try {
      const x = await t.sent("Ayşe Yılmaz", "0532 111 22 33");
      t.mark(x.job);
      const y = await t.sent("Bora Demir", "0533 444 55 66");
      await ok(t.ctx.api.del(URLS.conn), "Bağlantıyı Kaldır");
      await t.toManual();
      assert.notEqual(t.ctx.store.setting("whatsapp.hookSeen", ""), "", "Kaldır + Yol 1 (aynı kip, işaretin kipi kayıtlı): işaret korundu");
      assert.equal((await t.pastTtl(y)).state, "expired");
    } finally {
      await t.ctx.close();
    }
  });
  it("T2-2f tur 2'den ÖNCEKİ kodun işareti (kipi yazılmamış — whatsapp-kvkk-329d5d1b gerçek verisi): aynı kipte yeniden girişte kalır; Kaldır + yeniden bağlamada kipi bilinmediği için silinir", { timeout: 180_000 }, async () => {
    const fx = unpack("whatsapp-kvkk-329d5d1b");
    const ctx = await startWa({ env: DEAD, dataDir: fx.dataDir, backupDir: fx.backupDir, connect: false, ack: false, office: null, now: { time: fx.info.at, fixed: true } });
    try {
      assert.notEqual(ctx.store.setting("whatsapp.hookSeen", ""), "", "ön koşul: eski kodun işareti var");
      assert.equal(ctx.store.setting("whatsapp.hookSeenMode", ""), "", "ön koşul: eski kod işaretin kipini yazmıyordu");
      await ok(ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "aynı kip (Elle Bağla) yeniden giriş");
      assert.notEqual(ctx.store.setting("whatsapp.hookSeen", ""), "", "önceki bağlantının kipi aynı → işaret korundu");
      await ok(ctx.api.del(URLS.conn), "Bağlantıyı Kaldır");
      await ok(ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "yeniden bağla");
      assert.equal(ctx.store.setting("whatsapp.hookSeen", ""), "", "kipi bilinmeyen işaret (önceki bağlantı yok) silindi — güvenli yön");
    } finally {
      await ctx.close();
      removeTestDir(fx.root);
    }
  });
});

// ---- S63: iki şirket AYNI WABA, iki uygulama (001 Elle Bağla = A, 002 WhatsApp'ı Bağla = B) — f2 düzeni ----
async function iki({ listing }) {
  const PUBLIC = "http://ofis-tur2-iki.destekofis.test";
  const meta = await twoApps({ listing, publicUrl: PUBLIC });
  let server;
  try {
    server = await startTestServer({ now: { time: "2026-11-03T09:00:00+03:00", fixed: true }, maxCompanies: 2, env: DEAD, whatsappGraphUrl: meta.proxy.url, whatsappTimeoutMs: 1500, whatsappGapMs: 0 });
    const api = await loginAdmin(server);
    server.app.store.setSetting("office.name", OFFICE);
    server.app.mobileRemote.setPublicUrl(PUBLIC);
    const base = `http://127.0.0.1:${(await server.app.listenRemote(0, "127.0.0.1")).port}`;
    await ok(api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN_A }), "001 bağlantı (A)");
    await ok(api.put(URLS.ack, { ack: true }), "001 onay");
    const created = await ok(api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "002");
    const company = created.company || created;
    const q = `?hofCompany=${encodeURIComponent(company.id)}`;
    await ok(api.put(`${URLS.ack}${q}`, { ack: true }), "002 onay");
    const child = () => server.app.openCompany(company.id);
    embed(child(), server, TOKEN_B);
    assert.equal(child().context.whatsapp.connection.read().mode, "embedded", "ön koşul: 002 WhatsApp'ı Bağla");
    assert.equal(server.app.context.whatsapp.connection.read().mode, "manual", "ön koşul: 001 Elle Bağla");
    const ts = () => String(Math.floor(server.clock.ms() / 1000));
    const ev = (wamid, status = "delivered") => statusEvent([{ id: wamid, status, timestamp: ts(), recipient_id: "905320000000" }]);
    const t = {
      server,
      api,
      q,
      base,
      meta,
      child,
      /** Meta'nın uygulamanın ŞU ANKİ alternatif adresine yolladığı bildirim (002 = Yol 2 → kapıcı imzası yok; programın kendi kanca ucuna doğrudan — Yol 2'nin imzasız bildirimi
       * 401 alır, bu yüzden 002'nin teslimi yerine 002'nin adresinin YAŞADIĞI 404 / 401 ayrımıyla okunur). */
      post: (app, wamid, status) => raw(base, "POST", `/wa/kanca/${meta.proxy.pathOf(app)}`, ev(wamid, status)),
      postPath: (secret, wamid, status) => raw(base, "POST", `/wa/kanca/${secret}`, ev(wamid, status)),
      async sent(name, phone, qs = "") {
        const account = await ok(api.post(`/api/workspace/accounts${qs}`, { name, phone, openingBalance: "800" }), "cari");
        const batch = await ok(api.post(`${URLS.batches}${qs}`, { kind: "statement", ids: [account.id], preset: "thisMonth" }), "toplu iş");
        await server.app.whatsapp.scheduler.drain();
        const job = (await ok(api.get(`${URLS.batches}/${batch.batch.id}${qs}`), "iş")).jobs[0];
        assert.equal(job.state, "accepted", "ön koşul: Meta Kabul Etti");
        server.clock.advance(60_000);
        return { batchId: batch.batch.id, job, accountId: account.id };
      },
      state: async (batchId, qs = "") => (await ok(api.get(`${URLS.batches}/${batchId}${qs}`), "iş")).jobs[0].state,
      async close() {
        await server.close().catch(() => {});
        await meta.close();
      },
    };
    return t;
  } catch (error) {
    await server?.close().catch(() => {});
    await meta.close();
    throw error;
  }
}

for (const listing of ["hepsi", "kendi"]) {
  describe(`2.5.0 WhatsApp tur 2 — S63 = A: kanca kaydı WABA + UYGULAMA başına (Meta listeleme modeli: ${listing})`, () => {
    it(`T2-3a ${listing} · iki şirket iki uygulama: kayıt, Bağlantıyı Sına (iki şirket), bakım turu (1 sa sonra) — her adımdan sonra iki uygulamanın adresi YAŞAR; Meta isteği yalnız ilgili uygulamanın belirteciyle`, { timeout: 240_000 }, async () => {
      const t = await iki({ listing });
      try {
        let from = t.meta.proxy.log.length;
        await ok(t.api.post(`${URLS.conn}/hook`, {}), "001 Yeniden Kaydet");
        await ok(t.api.post(`${URLS.conn}/hook${t.q}`, {}), "002 Yeniden Kaydet");
        assert.deepEqual(t.meta.since(from), ["POST A", "POST B"], "her şirket yalnız kendi uygulamasının adresini kaydetti");
        const a = await t.sent("Ayşe Yılmaz", "0532 111 22 33");
        const b = await t.sent("Bora Demir", "0533 444 55 66", t.q);
        const check = async label => {
          const ra = await t.post(APP_A, a.job.wamid, "sent");
          assert.equal(ra.status, 200, `${label}: A'nın Meta'daki adresine 001'in bildirimi (eski kod: 404 — tek kayıt öbür uygulamanın)`);
          const rb = await t.post(APP_B, b.job.wamid, "sent");
          assert.notEqual(rb.status, 404, `${label}: B'nin Meta'daki adresi YAŞIYOR (Yol 2 imzasız → 401; 404 = adres eskidi)`);
        };
        await check("kayıttan sonra");
        assert.equal(await t.state(a.batchId), "sent", "001'in bildirimi işlendi");
        from = t.meta.proxy.log.length;
        await ok(t.api.post(`${URLS.conn}/test`, {}), "001 Bağlantıyı Sına");
        assert.ok(t.meta.since(from).every(item => item.endsWith(" A")), `001'in denetimi yalnız A belirteciyle: ${JSON.stringify(t.meta.since(from))}`);
        assert.deepEqual(t.meta.since(from), ["GET A"], "A'nın adresi Meta'da bizimki → yeniden kaydedilmedi");
        await check("001 Bağlantıyı Sına'dan sonra");
        from = t.meta.proxy.log.length;
        await ok(t.api.post(`${URLS.conn}/test${t.q}`, {}), "002 Bağlantıyı Sına");
        assert.deepEqual(t.meta.since(from), ["GET B"], "002'nin denetimi yalnız B belirteciyle, kayıt yok");
        await check("002 Bağlantıyı Sına'dan sonra");
        t.server.clock.advance(61 * 60_000);
        from = t.meta.proxy.log.length;
        await t.server.app.whatsapp.scheduler.drain();
        assert.deepEqual(t.meta.since(from).filter(item => item.startsWith("POST")), [], "bakım turu iki adresi de Kayıtlı buldu (ping-pong yok)");
        await check("bakım turundan sonra");
        assert.equal((await ok(t.api.get(URLS.conn), "001 kartı")).hook?.state, "active", "001 kartı Çalışıyor");
        assert.equal((await ok(t.api.get(`${URLS.conn}${t.q}`), "002 kartı")).hook?.state, "active", "002 kartı Çalışıyor");
      } finally {
        await t.close();
      }
    });
    it(`T2-3b ${listing} · S41: A'nın alternatif adresi Meta'dan kalkar → uygulama düzeyi adrese gelen 001 bildirimi işlenir, adres YALNIZ Elle Bağla şirketiyle (A) yeniden kaydedilir, B'nin adresi değişmez; Elle Bağla şirketi denetleyemezse WhatsApp'ı Bağla şirketi DENETLEMEZ`, { timeout: 240_000 }, async () => {
      const t = await iki({ listing });
      try {
        await ok(t.api.post(`${URLS.conn}/hook`, {}), "001 Yeniden Kaydet");
        await ok(t.api.post(`${URLS.conn}/hook${t.q}`, {}), "002 Yeniden Kaydet");
        await ok(t.api.post(`${URLS.conn}/test`, {}), "001 Bağlantıyı Sına (belirteç çalıştı)");
        const pathB = t.meta.proxy.pathOf(APP_B);
        t.meta.proxy.subs.set(APP_A, { override: null }); // Meta'da A'nın alternatif adresi kalktı
        const info = await ok(t.api.get("/api/workspace/whatsapp/app-webhook"), "webhook bilgileri");
        const appPath = new URL(info.callbackUrl).pathname.split("/").pop();
        const v = await t.sent("Veli Kaya", "0532 111 22 44");
        let from = t.meta.proxy.log.length;
        const r = await t.postPath(appPath, v.job.wamid, "delivered");
        assert.equal(r.status, 200, "uygulama düzeyi adrese 001'in teslimi işlendi (S41)");
        await t.server.app.whatsapp.appWebhook.rechecks.settled();
        assert.equal(await t.state(v.batchId), "delivered");
        assert.deepEqual(t.meta.since(from), ["GET A", "POST A"], "adres yalnız A ile okundu ve yeniden kaydedildi");
        assert.equal(t.meta.proxy.pathOf(APP_B), pathB, "B'nin Meta'daki adresi DEĞİŞMEDİ");
        assert.notEqual((await t.postPath(pathB, "wamid.YABANCI-T23B", "delivered")).status, 404, "B'nin adresi yaşıyor");
        assert.equal((await t.post(APP_A, v.job.wamid, "read")).status, 200, "A'nın yeni adresi yaşıyor");
        // Elle Bağla şirketinin belirteci reddedildi (190 → Süresi Doldu): denetimi WhatsApp'ı Bağla şirketi YAPMAZ (S63 "S41 denetimi yalnız Elle Bağla şirketiyle").
        t.meta.backend.state.failQueue.push({ match: /^GET \/\d+\/phone_numbers/, status: 401, body: { error: { message: "Error validating access token: Session has expired", type: "OAuthException", code: 190, error_subcode: 463, fbtrace_id: "X" } } });
        assert.notEqual((await t.api.post(`${URLS.conn}/test`, {})).status, 200, "ön koşul: 001 Bağlantıyı Sına reddedildi");
        assert.equal((await ok(t.api.get(URLS.conn), "001 kartı")).tokenExpiry?.state, "expired", "ön koşul: 001'in belirteci Süresi Doldu");
        t.server.clock.advance(16 * 60_000); // 15 dk sıklık sınırı geçti
        t.meta.proxy.subs.set(APP_A, { override: null });
        from = t.meta.proxy.log.length;
        const r2 = await t.postPath(appPath, v.job.wamid, "read");
        assert.equal(r2.status, 200, "bildirim yine işlendi");
        await t.server.app.whatsapp.appWebhook.rechecks.settled();
        assert.deepEqual(t.meta.since(from), [], "Meta'ya istek YOK — WhatsApp'ı Bağla şirketi (B) uygulama düzeyi adres için denetim yapmadı (eski kod: GET B)");
        assert.equal(t.meta.proxy.pathOf(APP_B), pathB, "B'nin adresi aynen");
      } finally {
        await t.close();
      }
    });
    it(`T2-3c ${listing} · v2.4.9 GERÇEK verisi, TEK uygulama (Elle Bağla): eski WABA başına kayıt Elle Bağla'nın sayılır — eski adres yaşar, bakım turunda Meta'ya YENİ KAYIT GİTMEZ`, { timeout: 180_000 }, async () => {
      const fx = unpack("whatsapp-kanca-v249-tek");
      const meta = await twoApps({ listing, publicUrl: fx.info.publicUrl, subs: { [APP_A]: fx.info.secretPath } });
      const at = Date.parse(fx.info.at) + 2 * HOUR;
      let server;
      try {
        server = await startTestServer({ dataDir: fx.dataDir, backupDir: fx.backupDir, now: { time: new Date(at).toISOString(), fixed: true }, env: DEAD, whatsappGraphUrl: meta.proxy.url, whatsappTimeoutMs: 1500, whatsappGapMs: 0 });
        const api = await loginAdmin(server);
        server.app.mobileRemote.setPublicUrl(fx.info.publicUrl);
        const base = `http://127.0.0.1:${(await server.app.listenRemote(0, "127.0.0.1")).port}`;
        await ok(api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN_A }), "bağlantı yeniden girildi");
        const ts = String(Math.floor(at / 1000));
        const r1 = await raw(base, "POST", `/wa/kanca/${fx.info.secretPath}`, statusEvent([{ id: fx.info.wamid, status: "delivered", timestamp: ts, recipient_id: "905321112233" }]));
        assert.equal(r1.status, 200, "v2.4.9'da kaydedilmiş adres yükseltmeden sonra yaşıyor");
        assert.equal((await ok(api.get(`${URLS.batches}/${fx.info.batchId}`), "iş")).jobs[0].state, "delivered");
        const from = meta.proxy.log.length;
        await server.app.whatsapp.scheduler.drain();
        assert.deepEqual(meta.since(from), ["GET A"], "bakım turu Meta'daki adresi okudu, kendi yolunu buldu → yeniden KAYDETMEDİ");
        assert.equal((await ok(api.get(URLS.conn), "kart")).hook?.state, "active", "kart Çalışıyor");
        const r2 = await raw(base, "POST", `/wa/kanca/${fx.info.secretPath}`, statusEvent([{ id: fx.info.wamid, status: "read", timestamp: ts, recipient_id: "905321112233" }]));
        assert.equal(r2.status, 200, "eski adres hâlâ yaşıyor");
      } finally {
        await server?.close().catch(() => {});
        await meta.close();
        removeTestDir(fx.root);
      }
    });
    it(`T2-3d ${listing} · v2.4.9 GERÇEK verisi, İKİ uygulama (001 WhatsApp'ı Bağla = B, 002 Elle Bağla = A; v2.4.9'da B'nin adresi 404): ilk bakım turundan sonra iki uygulama da kendi adresini kaydeder, iki şirketin teslimi 200`, { timeout: 240_000 }, async () => {
      const fx = unpack("whatsapp-kanca-v249-iki");
      assert.deepEqual(fx.info.v249, { bAdresine001Teslimi: 404, aAdresine002Teslimi: 200 }, "ön koşul: v2.4.9'un S63 hatası fikstürde ölçülmüş");
      const meta = await twoApps({ listing, publicUrl: fx.info.publicUrl, subs: { [APP_A]: fx.info.meta.A, [APP_B]: fx.info.meta.B } });
      const at = Date.parse(fx.info.at) + 2 * HOUR;
      let server;
      try {
        server = await startTestServer({ dataDir: fx.dataDir, backupDir: fx.backupDir, now: { time: new Date(at).toISOString(), fixed: true }, maxCompanies: 2, env: DEAD, whatsappGraphUrl: meta.proxy.url, whatsappTimeoutMs: 1500, whatsappGapMs: 0 });
        const api = await loginAdmin(server);
        server.app.mobileRemote.setPublicUrl(fx.info.publicUrl);
        const base = `http://127.0.0.1:${(await server.app.listenRemote(0, "127.0.0.1")).port}`;
        const q = `?hofCompany=${encodeURIComponent(fx.info.company.id)}`;
        embed(server.app, server, TOKEN_B); // 001: WhatsApp'ı Bağla (belirteç yeniden; gizli anahtar fikstürde yok)
        await ok(api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN_A }), "002 Elle Bağla yeniden girildi");
        const ts = () => String(Math.floor(server.clock.ms() / 1000));
        const post = (secret, wamid, status) => raw(base, "POST", `/wa/kanca/${secret}`, statusEvent([{ id: wamid, status, timestamp: ts(), recipient_id: "905320000000" }]));
        // İlk bakım turundan ÖNCE: eski tek kaydın yolu (A — v2.4.9'da son kaydeden 002) bu uygulamalardan biri kendi kaydını yazana dek yaşar.
        assert.equal((await post(fx.info.meta.A, fx.info.jobs["002"].wamid, "sent")).status, 200, "eski tek kaydın son yolu (A) yaşıyor");
        const from = meta.proxy.log.length;
        await server.app.whatsapp.scheduler.drain();
        const calls = meta.since(from);
        assert.ok(calls.includes("POST A") && calls.includes("POST B"), `iki uygulama da kendi adresini kaydetti: ${JSON.stringify(calls)}`);
        const r001 = await post(meta.proxy.pathOf(APP_B), fx.info.jobs["001"].wamid, "sent");
        assert.notEqual(r001.status, 404, "B'nin (001, WhatsApp'ı Bağla) Meta'daki adresi YAŞIYOR (v2.4.9 + eski kod: 404; Yol 2 imzasız → 401)");
        const r002 = await post(meta.proxy.pathOf(APP_A), fx.info.jobs["002"].wamid, "delivered");
        assert.equal(r002.status, 200, "A'nın (002, Elle Bağla) Meta'daki adresine teslim 200");
        assert.equal((await ok(api.get(`${URLS.batches}/${fx.info.jobs["002"].batchId}${q}`), "002 işi")).jobs[0].state, "delivered");
        assert.equal((await post(fx.info.meta.A, fx.info.jobs["002"].wamid, "read")).status, 404, "eski tek kaydın yolu artık geçersiz (iki uygulama kendi kaydını yazdı; Meta'da da değişti)");
        server.clock.advance(61 * 60_000);
        const from2 = meta.proxy.log.length;
        await server.app.whatsapp.scheduler.drain();
        assert.deepEqual(meta.since(from2).filter(item => item.startsWith("POST")), [], "1 sa sonraki bakım turu iki adresi de Kayıtlı buldu");
        assert.notEqual((await post(meta.proxy.pathOf(APP_B), fx.info.jobs["001"].wamid, "read")).status, 404, "B yaşıyor");
        assert.equal((await post(meta.proxy.pathOf(APP_A), fx.info.jobs["002"].wamid, "read")).status, 200, "A yaşıyor");
      } finally {
        await server?.close().catch(() => {});
        await meta.close();
        removeTestDir(fx.root);
      }
    });
  });
}

describe("2.5.0 WhatsApp tur 2 — tur 1 dk DÜŞÜK-2 (test boşluğu): kilitli defter + kaydı OLMAYAN WABA'nın uygulama düzeyi bildirimi", () => {
  it("T2-9a defter başka süreçte kilitli (kısa sınama düşer) → kaydı olmayan WABA'nın bildirimi 200 (düşer, işlenmez), Meta'ya istek YOK; kaydı olan WABA'nınki 503", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD });
    try {
      ctx.server.app.mobileRemote.setPublicUrl("http://ofis-tur2-d2.destekofis.test");
      const base = `http://127.0.0.1:${(await ctx.server.app.listenRemote(0, "127.0.0.1")).port}`;
      await ok(ctx.api.post(`${URLS.conn}/hook`, {}), "Bildirim Yolu");
      const info = await ok(ctx.api.get("/api/workspace/whatsapp/app-webhook"), "webhook bilgileri");
      const appPath = new URL(info.callbackUrl).pathname.split("/").pop();
      const event = entryId => statusEvent([{ id: "wamid.YABANCI-T29A", status: "delivered", timestamp: "1793000000", recipient_id: "905320000000" }], entryId);
      const probe = ctx.wa.ledger.probeWritable;
      const requests = ctx.fake.requests.length;
      ctx.wa.ledger.probeWritable = () => false;
      try {
        assert.equal((await raw(base, "POST", `/wa/kanca/${appPath}`, event("999999999999999"))).status, 200, "kaydı olmayan WABA: 200 (M12 — denetim kalkarsa — 503)");
        assert.equal((await raw(base, "POST", `/wa/kanca/${appPath}`, event(WABA))).status, 503, "kaydı olan WABA: defter kilitli → 503 (Meta yeniden dener)");
      } finally {
        ctx.wa.ledger.probeWritable = probe;
      }
      await ctx.wa.appWebhook.rechecks?.settled();
      assert.equal(ctx.fake.requests.filter((item, index) => index >= requests && item.path.endsWith("/subscribed_apps") && /^\/999999999999999\//.test(item.path)).length, 0, "kaydı olmayan WABA için Meta'ya istek yok");
    } finally {
      await ctx.close();
    }
  });
});
