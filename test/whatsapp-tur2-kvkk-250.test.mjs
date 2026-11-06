// 2.5.0 WhatsApp TUR 2 — KVKK: S62 (KULLANICI KARARI AYNEN, docs/2.5.0-IS-LISTESI.md D) + W-3 dar kontrol ORTA-1..4 + DÜŞÜK-1 (test boşluğu). Tasarım docs/erp/WA-TUR2-TASARIM.md
// §4–§9 (koddan önce); W-3'ün kuralı docs/erp/W3-SAKLAMA-TASARIM.md (S-W3 "1 yıl + anonim iz", S42) AYNEN — "kime kaç kez" değişmez. Beklenenler karar metinlerinden:
//   S62 = A — salt okunur lisansta KVKK silme talebi AÇIK; başka hiçbir WhatsApp yazması açılmaz.
//   ORTA-1 — talep anında makine defterinin anonimleştirmesi düşerse yeniden denenir (yeniden açılış + bakım turu); S42'de istek sürerken silinen işin kabulü özetle (defter ∪ dosya);
//            dosyada silinmiş ama wamid'i açık eski satır süpürmede özetlenir → defterde ve dosyada telefon / açık wamid 0.
//   ORTA-2 — silinmiş işe SONRADAN yazılan Meta hata metninde 10+ haneli sayı (telefon) kalmaz.
//   ORTA-3 — denetim noktası düşerse (dış okuyucu) bayrak kalır, bakım turu yeniden dener → WAL / ana dosyada silinen telefon 0.
//   ORTA-4 (BAŞ MİMAR KARARI A) — KVKK araması Silinenler'deki ama WhatsApp kaydı olan carileri de bulur; yalnız yönetici; telefon yanıtta yok.
//   DÜŞÜK-1 — talep anında hazırlanmış (PDF'i dondurulmuş) açık işin PDF satırı silinir.
// ESKİ KOD VERİSİ: test/fixtures/whatsapp-kvkk-329d5d1b — tur 2'den önceki kodun (329d5d1b) GERÇEK koduyla, programın kendi API'si ve kesinti kancasıyla üretildi (uret.mjs.txt).
// Düzenek: GERÇEK program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + programın kesinti kancası (whatsappLedgerFault — disk dolu benzetimi) + sahte saat (ders 13;
// TZ=UTC ve TZ=Europe/Istanbul). Ders 30: lisans servisi ölü yerel adres. Ders 20: ön koşulun gerçekten oluştuğu ayrıca denetlenir (defter yazılamadı / okuyucu açıkken WAL'da iz var).
// Ders 48 (Windows): dış okuyucu şirket dosyasını salt okunur açar (kapanmadan silinmez); fikstür / veri klasörü geçici kökte, program kapandıktan sonra kendi tam yoluyla silinir.
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { scrubDigits } from "../server/lib/whatsapp/saklama.mjs";
import { createUser, removeTestDir } from "./helpers.mjs";
import { PNID, PROGRAM_TEMPLATES, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const ERASE = "/api/workspace/whatsapp/kvkk-erase";
const DELETED = "/api/workspace/whatsapp/kvkk-deleted";
const HOUR = 3_600_000;
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const files = dir => (existsSync(dir) ? readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? files(full) : [full];
}) : []);
/** Veri klasörünün BÜTÜN dosyalarında (ana dosya, WAL, -shm, defter, talep dosyası) ham bayt araması. */
const hitsIn = (dir, needles) => needles.flatMap(needle => files(dir).filter(file => readFileSync(file).includes(Buffer.from(needle))).map(file => `${needle} @ ${path.relative(dir, file)}`));
const waitFor = async (check, label, ms = 8000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error(`zaman aşımı: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
async function ok(res, label) {
  const done = await res;
  assert.equal(done.status, 200, `${label}: ${done.status} ${JSON.stringify(done.data).slice(0, 300)}`);
  return done.data.data;
}
const ledgerAll = (dataDir, sql, ...args) => {
  const db = new DatabaseSync(path.join(dataDir, "whatsapp-gonderim.sqlite"), { readOnly: true });
  try {
    return db.prepare(sql).all(...args);
  } finally {
    db.close();
  }
};
/** Defterde AÇIK kalan kişisel veri: telefon (claims.phone '+…') ve özet olmayan wamid (outcomes / learned_wamids). */
const ledgerPlain = dataDir => ({
  telefon: ledgerAll(dataDir, "SELECT COUNT(*) AS n FROM claims WHERE phone <> 'silinmis:' || job_id")[0].n,
  wamid: ledgerAll(dataDir, "SELECT (SELECT COUNT(*) FROM outcomes WHERE wamid <> '' AND substr(wamid, 1, 2) <> 'h:') + (SELECT COUNT(*) FROM learned_wamids WHERE wamid <> '' AND substr(wamid, 1, 2) <> 'h:') AS n")[0].n,
});
const capture = () => {
  const lines = [];
  const write = level => (message, meta) => lines.push(`[${level}] ${message}${meta === undefined ? "" : ` ${meta instanceof Error ? meta.message : JSON.stringify(meta)}`}`);
  return { lines, log: { debug: write("DEBUG"), info: write("INFO"), warn: write("WARN"), error: write("ERROR") } };
};
// Sahte Meta'nın wamid'i gerçek Meta gibi alıcının numarasını base64 taşır (W-3 sızıntı düzeni; aynı el — kâhin değil).
const wamidOf = (to, n) => `wamid.${Buffer.from(`\x1c\x18\x0c${String(to).replace(/\D/g, "")}\x15\x02\x00\x11\x18\x12${String(n).padStart(18, "0")}`, "latin1").toString("base64")}`;
async function graphWithPhones() {
  const graph = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
  graph.state.templates.push(...PROGRAM_TEMPLATES());
  graph.state.wamidOf = wamidOf;
  return graph;
}
const statusOf = (ctx, wamid, status, extra = {}) => ({ id: wamid, status, timestamp: String(Math.floor(ctx.clock.ms() / 1000)), recipient_id: "905000000000", ...extra });
const metaBody = (code, details) => ({ error: { message: `(#${code}) Invalid parameter`, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details }, fbtrace_id: "x" } });

describe("2.5.0 WhatsApp tur 2 — S62 = A: salt okunur lisansta KVKK silme talebi AÇIK (yalnız bu uç)", () => {
  it("T2-4 salt okunur: talep 200, içerik + telefon silinir (dosya + defter); toplu gönderim / önizleme / Bildirim Yolu / bağlantı / Yine de Gönder / cari açma hâlâ 403", { timeout: 180_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-tur2-s62-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    try {
      const first = await startWa({ env: DEAD, dataDir, backupDir });
      let accountId;
      let batchId;
      try {
        const a = await first.account("Ayşe Yılmaz", "0532 111 22 33", 500);
        accountId = a.id;
        batchId = (await ok(first.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "toplu iş")).batch.id;
        await first.drain();
        assert.equal((await first.jobs(batchId))[0].state, "accepted", "ön koşul: Meta Kabul Etti");
      } finally {
        await first.close();
      }
      const ctx = await startWa({ env: DEAD, dataDir, backupDir, connect: false, ack: false, office: null, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
      try {
        const denied = await ctx.api.post("/api/workspace/accounts", { name: "Yeni Cari", phone: "0535 000 00 01" });
        assert.equal(denied.status, 403, "ön koşul: lisans salt okunur (cari açılamıyor)");
        assert.equal(denied.data.code, "LICENSE_READ_ONLY");
        const res = await ctx.api.post(ERASE, { accountId, confirm: true });
        assert.equal(res.status, 200, `salt okunurda KVKK talebi açık (eski kod: 403 LICENSE_READ_ONLY) — ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
        assert.equal(res.data.data.jobs, 1, "carinin işi silindi");
        const job = (await ctx.jobs(batchId))[0];
        assert.equal(job.phone, "", "telefon silindi (dosya)");
        assert.ok(job.contentErased, "içerik silindi işareti");
        assert.deepEqual(ledgerPlain(dataDir).telefon, 0, "defterde telefon yok");
        for (const [method, url, body] of [
          ["post", URLS.batches, { kind: "statement", ids: [accountId], preset: "thisMonth" }],
          ["post", URLS.preview, { kind: "statement", ids: [accountId], preset: "thisMonth" }],
          ["post", `${URLS.conn}/hook`, {}],
          ["put", URLS.conn, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }],
          ["post", `/api/workspace/whatsapp/jobs/${job.id}/send-anyway`, { confirm: true }],
          ["post", "/api/workspace/whatsapp/kvkk-erase/ek", { accountId, confirm: true }],
        ]) {
          const other = await ctx.api[method](url, body);
          assert.equal(other.status, 403, `${method.toUpperCase()} ${url} salt okunurda hâlâ 403 (yalnız talep ucu açıldı) — ${other.status}`);
          assert.equal(other.data.code, "LICENSE_READ_ONLY");
        }
      } finally {
        await ctx.close();
      }
    } finally {
      removeTestDir(root);
    }
  });
});

describe("2.5.0 WhatsApp tur 2 — W-3 dk ORTA-1: defter anonimleştirmesi düşerse yeniden denenir (yeniden açılış + bakım turu); S42 kabulü özetle", () => {
  /** Dar kontrol e2 kalıbı: A teslim edildi; B'nin isteği Meta'dayken iki talep — talep anında defter YAZILAMAZ (yalnız o an). */
  async function talepAnindaDefterYazilamaz() {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-tur2-o1-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    const graph = await graphWithPhones();
    let failAnon = false;
    const cap = capture();
    let ctx = null;
    try {
      ctx = await startWa({ fake: graph, env: DEAD, dataDir, backupDir, whatsappLedgerFault: op => failAnon && op === "anonymize", log: cap.log, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const b = await ctx.account("Bora Demir", "0533 444 55 66", 300);
      const madeA = await ok(ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "A");
      await ctx.drain();
      const jobA = (await ctx.jobs(madeA.batch.id))[0];
      ctx.statuses([statusOf(ctx, jobA.wamid, "delivered")]);
      let release;
      graph.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
      const madeB = await ok(ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" }), "B");
      const run = ctx.drain({ maintain: false }); // bakım turu testin denetiminde (ön koşul önce okunur)
      await waitFor(() => graph.state.held >= 1, "B isteği Meta'da");
      failAnon = true;
      assert.equal((await ctx.api.post(ERASE, { accountId: a.id, confirm: true })).status, 200, "A talebi");
      assert.equal((await ctx.api.post(ERASE, { accountId: b.id, confirm: true })).status, 200, "B talebi");
      failAnon = false;
      graph.state.hold = null;
      release();
      await run;
      const jobB = (await ctx.jobs(madeB.batch.id))[0];
      const wamidB = graph.state.messages.find(m => m.to === "+905334445566")?.wamid;
      assert.equal(jobB.state, "accepted", "ön koşul: B'nin isteği talepten sonra kabul edildi (S42)");
      assert.ok(cap.lines.some(line => /silinemedi .*sonra yeniden denenecek/.test(line)), "ön koşul: talep anında defter anonimleştirmesi DÜŞTÜ (kesinti kancası)");
      const needles = ["+905321112233", "+905334445566", jobA.wamid, wamidB];
      return { root, dataDir, backupDir, graph, ctx, cap, jobA, jobB, wamidB, needles };
    } catch (error) {
      // Kurulum düştü: açık sunucular kapanır, test süreci asılı kalmaz (ders 21: temizlik hatası asıl hatayı ezmez).
      await ctx?.close().catch(() => {});
      await graph.close().catch(() => {});
      removeTestDir(root);
      throw error;
    }
  }
  it("T2-5a bakım turu: defter yeniden anonimleştirilir; B'nin dosyadaki kabulü ÖZETLE yazılmıştı (S42 defter ∪ dosya) → defterde ve dosyada telefon / açık wamid 0", { timeout: 180_000 }, async () => {
    const t = await talepAnindaDefterYazilamaz();
    try {
      assert.ok(t.jobB.wamid.startsWith("h:"), `S42: istek sürerken silinen işin kabulü dosyaya ÖZETLE yazıldı (eski kod: açık wamid) — ${t.jobB.wamid.slice(0, 12)}`);
      const before = ledgerPlain(t.dataDir);
      assert.ok(before.telefon > 0, "ön koşul (ders 20): talep anında defterde telefon AÇIK kaldı");
      t.ctx.clock.advance(2 * HOUR);
      await t.ctx.server.app.context.whatsapp.queue.maintain();
      assert.deepEqual(ledgerPlain(t.dataDir), { telefon: 0, wamid: 0 }, "bakım turundan sonra defterde açık telefon / wamid yok (eski kod: kalıyor)");
      assert.deepEqual(hitsIn(t.dataDir, t.needles), [], "veri klasörünün hiçbir dosyasında (WAL dahil) telefon / açık wamid yok");
      assert.deepEqual(t.cap.lines.filter(line => t.needles.some(needle => line.includes(needle))), [], "günlükte telefon / wamid yok");
    } finally {
      await t.ctx.close();
      await t.graph.close();
      removeTestDir(t.root);
    }
  });
  it("T2-5b yeniden açılış: açılıştaki talep uygulaması (bakım turundan ÖNCE) defteri anonimleştirir", { timeout: 180_000 }, async () => {
    const t = await talepAnindaDefterYazilamaz();
    let again = null;
    let closed = false;
    try {
      assert.ok(ledgerPlain(t.dataDir).telefon > 0, "ön koşul (ders 20): defterde telefon açık");
      await t.ctx.close();
      closed = true;
      again = await startWa({ fake: t.graph, env: DEAD, dataDir: t.dataDir, backupDir: t.backupDir, connect: false, ack: false, office: null, now: { time: localIso(2026, 11, 3, 13), fixed: true } });
      assert.deepEqual(ledgerPlain(t.dataDir), { telefon: 0, wamid: 0 }, "açılışta (recover → talepler) defter temizlendi (eski kod: kalıyor)");
      await again.server.app.context.whatsapp.queue.maintain();
      assert.deepEqual(hitsIn(t.dataDir, t.needles), [], "veri klasöründe telefon / açık wamid yok");
    } finally {
      if (!closed) await t.ctx.close().catch(() => {});
      await again?.close();
      await t.graph.close();
      removeTestDir(t.root);
    }
  });
  it("T2-5c tur 2'den ÖNCEKİ kodun GERÇEK verisi (whatsapp-kvkk-329d5d1b: defterde 2 telefon + 2 açık wamid, dosyada silinmiş B satırında AÇIK wamid) → açılış + ilk bakım turu: hepsi özetlenir", { timeout: 180_000 }, async () => {
    const dir = path.join(HERE, "fixtures", "whatsapp-kvkk-329d5d1b");
    const info = JSON.parse(readFileSync(path.join(dir, "bilgi.json"), "utf8"));
    assert.deepEqual(info.defter, { telefonAcik: 2, wamidAcik: 2 }, "ön koşul: eski kodun defterinde açık veri");
    assert.equal(info.jobs.B.fileWamidAcik, true, "ön koşul: eski kod B'nin silinmiş satırına açık wamid yazmıştı");
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-tur2-o1fx-"));
    const dataDir = path.join(root, "data");
    mkdirSync(dataDir, { recursive: true });
    for (const name of ["destekofis.sqlite", "whatsapp-gonderim.sqlite", "whatsapp-silme-talepleri.sqlite"]) writeFileSync(path.join(dataDir, name), gunzipSync(readFileSync(path.join(dir, `${name}.gz`))));
    for (const name of ["sirketler.json", "sirketler.yedek.json"]) copyFileSync(path.join(dir, name), path.join(dataDir, name));
    let ctx = null;
    try {
      ctx = await startWa({ env: DEAD, dataDir, backupDir: path.join(root, "backups"), connect: false, ack: false, office: null, now: { time: new Date(Date.parse(info.at) + 2 * HOUR).toISOString(), fixed: true } });
      assert.deepEqual(ledgerPlain(dataDir), { telefon: 0, wamid: 0 }, "açılışta defter temizlendi");
      await ctx.server.app.context.whatsapp.queue.maintain();
      const row = ctx.store.get("SELECT wamid, phone_e164 AS phone FROM wa_jobs WHERE id = ?", info.jobs.B.id);
      assert.ok(String(row.wamid).startsWith("h:") && row.wamid.length === 66, `dosyadaki silinmiş B satırının wamid'i ÖZETLENDİ (eski kod: açık) — ${String(row.wamid).slice(0, 12)}`);
      assert.equal(row.phone, "");
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE params_json LIKE '{%' AND wamid IS NOT NULL AND substr(wamid, 1, 2) <> 'h:'").n, 0, "silinmiş satırlarda açık wamid kalmadı");
      // Geç bildirim özetle eşleşir (kime / kaç kez aynı): B'nin teslimi tanınır.
      const applied = ctx.statuses([statusOf(ctx, info.jobs.B.wamid, "delivered")]);
      assert.equal(applied.applied, 1, "geç teslim bildirimi özetlenmiş wamid'le eşleşti");
    } finally {
      await ctx?.close();
      removeTestDir(root);
    }
  });
});

describe("2.5.0 WhatsApp tur 2 — W-3 dk ORTA-2: silinmiş işe SONRADAN yazılan hata metni de numarasız (scrubDigits)", () => {
  it("T2-6a scrubDigits: boşluklu / tireli / parantezli / bitişik numara '…', Meta hata kodu (≤ 7 hane) kalır", () => {
    assert.equal(scrubDigits("Parameter value is not valid: to +90 532 111 22 33 (Meta hata kodu 131009)"), "Parameter value is not valid: to … (Meta hata kodu 131009)");
    assert.equal(scrubDigits("Recipient 905334445566 could not be reached"), "Recipient … could not be reached");
    assert.equal(scrubDigits("to 0532-111-22-33 failed"), "to … failed");
    assert.equal(scrubDigits("numara (0532) 111 22 33"), "numara (…");
    assert.equal(scrubDigits("Meta hata kodu 131026"), "Meta hata kodu 131026");
    assert.equal(scrubDigits("kod 2494100, deneme 3"), "kod 2494100, deneme 3");
  });
  it("T2-6b (a) S42 + Meta hatası (ayrıntıda '+90 532 111 22 33'), (b) kabul + talep + sonra 'failed' bildirimi (ayrıntıda '905334445566'), (c) talepten önce yazılmış hata — dosyada, veri klasöründe ve günlükte numara yok", { timeout: 180_000 }, async () => {
    const cap = capture();
    const ctx = await startWa({ env: DEAD, log: cap.log, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const b = await ctx.account("Bora Demir", "0533 444 55 66", 300);
      const c = await ctx.account("Cem Kara", "0534 777 88 99", 200);
      let release;
      ctx.fake.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
      ctx.fake.state.failQueue.push({ match: /messages/, status: 400, body: metaBody(131009, "Parameter value is not valid: to +90 532 111 22 33") });
      const madeA = await ok(ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "A");
      const run = ctx.drain();
      await waitFor(() => ctx.fake.state.held >= 1, "A Meta'da");
      assert.equal((await ctx.api.post(ERASE, { accountId: a.id, confirm: true })).status, 200);
      ctx.fake.state.hold = null;
      release();
      await run;
      const jobA = (await ctx.jobs(madeA.batch.id))[0];
      const textA = ctx.store.get("SELECT error_text FROM wa_jobs WHERE id = ?", jobA.id).error_text;
      assert.ok(jobA.contentErased, "ön koşul: A'nın içeriği talep anında silindi (S42)");
      assert.ok(/Parameter value is not valid/.test(textA), `ön koşul (ders 38): Meta'nın hata metni talepten SONRA yazıldı — ${textA}`);
      assert.ok(!/532 111 22 33/.test(textA) && textA.includes("…"), `(a) S42 sonrası hata metni numarasız (eski kod: '+90 532 111 22 33') — ${textA}`);
      const madeB = await ok(ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" }), "B");
      await ctx.drain();
      assert.equal((await ctx.api.post(ERASE, { accountId: b.id, confirm: true })).status, 200);
      ctx.clock.advance(60_000);
      const jobB0 = (await ctx.jobs(madeB.batch.id))[0];
      ctx.statuses([statusOf(ctx, jobB0.wamid, "failed", { errors: [{ code: 135999, title: "Unknown", message: "Unknown", error_data: { details: "Recipient 905334445566 could not be reached" } }] })]);
      const jobB = (await ctx.jobs(madeB.batch.id))[0];
      const textB = ctx.store.get("SELECT error_text FROM wa_jobs WHERE id = ?", jobB.id).error_text;
      assert.equal(jobB.state, "failed", "ön koşul: talepten sonra failed bildirimi işlendi");
      assert.ok(!/905334445566/.test(textB) && textB.includes("…"), `(b) failed bildiriminin metni numarasız (eski kod: '905334445566') — ${textB}`);
      ctx.fake.state.failQueue.push({ match: /messages/, status: 400, body: metaBody(131009, "Parameter value is not valid: to 0534-777-88-99") });
      const madeC = await ok(ctx.batch({ kind: "statement", ids: [c.id], preset: "thisMonth" }), "C");
      await ctx.drain();
      const jobC = (await ctx.jobs(madeC.batch.id))[0];
      assert.ok(/0534-777-88-99/.test(ctx.store.get("SELECT error_text FROM wa_jobs WHERE id = ?", jobC.id).error_text), "ön koşul: talepten ÖNCE yazılmış metin numaralı");
      assert.equal((await ctx.api.post(ERASE, { accountId: c.id, confirm: true })).status, 200);
      assert.ok(!/0534-777-88-99/.test(ctx.store.get("SELECT error_text FROM wa_jobs WHERE id = ?", jobC.id).error_text), "(c) talep anında metin temizlendi (W-3 aynen)");
      ctx.clock.advance(2 * HOUR);
      await ctx.server.app.context.whatsapp.queue.maintain();
      assert.deepEqual(hitsIn(ctx.server.dataDir, ["+90 532 111 22 33", "905334445566", "0534-777-88-99"]), [], "veri klasörünün hiçbir dosyasında Meta metnindeki numara yok");
      assert.deepEqual(cap.lines.filter(line => /532 111 22 33|905334445566|0534-777-88-99/.test(line)), [], "günlükte numara yok");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.5.0 WhatsApp tur 2 — W-3 dk ORTA-3: denetim noktası düşerse bakım turu yeniden dener", () => {
  it("T2-7 dış okuyucu (açık okuma işlemi) varken talep → WAL / dosyada iz kalır; okuyucu kapanınca BİR bakım turu sonra veri klasöründe silinen telefon 0", { timeout: 180_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const b = await ctx.account("Bora Demir", "0533 444 55 66", 300);
      const made = await ok(ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" }), "toplu iş");
      await ctx.drain();
      for (const job of await ctx.jobs(made.batch.id)) if (job.wamid) ctx.statuses([statusOf(ctx, job.wamid, "delivered")]);
      const dataDir = ctx.server.dataDir;
      const scan = () => hitsIn(dataDir, ["+905321112233"]);
      assert.ok(scan().length > 0, "ön koşul: telefon dosyada");
      const reader = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"), { readOnly: true });
      try {
        reader.exec("BEGIN");
        reader.prepare("SELECT COUNT(*) AS n FROM wa_jobs").get();
        assert.equal((await ctx.api.post(ERASE, { accountId: a.id, confirm: true })).status, 200, "talep");
        assert.ok(scan().length > 0, "ön koşul (ders 20): okuyucu açıkken denetim noktası DÜŞTÜ — telefon WAL / ana dosyada");
        reader.exec("COMMIT");
      } finally {
        reader.close();
      }
      ctx.clock.advance(60_000);
      await ctx.server.app.context.whatsapp.queue.maintain();
      assert.deepEqual(scan(), [], "okuyucu kapandıktan sonraki ilk bakım turunda iz kalmadı (eski kod: bir sonraki silmeye dek kalıyor)");
      assert.equal(ctx.store.get("SELECT phone_e164 FROM wa_jobs WHERE account_id = ?", b.id).phone_e164, "+905334445566", "talep edilmeyen kişinin kaydı aynen");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.5.0 WhatsApp tur 2 — W-3 dk ORTA-4 (BAŞ MİMAR KARARI A): KVKK araması Silinenler'deki ama WhatsApp kaydı olan carileri de bulur", () => {
  it("T2-8 silinmiş cari adla / telefonla bulunur (telefon yanıtta yok), talep yapılır; etkin cari ve kaydı olmayan silinmiş cari bu uçta yok; Muhasebe / Avukat / Personel 403", { timeout: 180_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      const z = await ctx.account("Zeki Hareketsiz", "0536 999 88 77", 0);
      const n = await ctx.account("Zeki Kayıtsız", "0536 999 88 00", 0);
      const made = await ok(ctx.batch({ kind: "statement", ids: [a.id, z.id], preset: "thisMonth" }), "toplu iş");
      await ctx.drain();
      assert.equal((await ctx.api.del(`/api/workspace/accounts/${z.id}`)).status, 200, "ön koşul: Zeki Hareketsiz Silinenler'de");
      assert.equal((await ctx.api.del(`/api/workspace/accounts/${n.id}`)).status, 200, "ön koşul: Zeki Kayıtsız (WhatsApp kaydı yok) Silinenler'de");
      assert.deepEqual(await ok(ctx.api.get(`/api/workspace/accounts/search?q=${encodeURIComponent("Zeki")}`), "cari araması"), [], "ön koşul: cari araması silinmiş cariyi bulmuyor");
      const byName = await ok(ctx.api.get(`${DELETED}?q=${encodeURIComponent("zeki")}`), "KVKK araması (ad)");
      assert.deepEqual(byName, [{ id: z.id, name: "Zeki Hareketsiz", refNo: z.refNo || "", deleted: true }], "silinmiş + WhatsApp kaydı olan cari bulundu (eski kod: uç yok — 404); telefon yanıtta YOK");
      assert.deepEqual((await ok(ctx.api.get(`${DELETED}?q=${encodeURIComponent("0536 999 88")}`), "KVKK araması (telefon)")).map(row => row.id), [z.id], "telefonla da bulunur");
      assert.deepEqual(await ok(ctx.api.get(`${DELETED}?q=${encodeURIComponent("Ayşe")}`), "etkin cari"), [], "etkin cari bu uçta yok (cari aramasından gelir)");
      for (const role of ["muhasebe", "avukat", "personel"]) {
        const user = await createUser(ctx.server, ctx.api, { username: `tur2-${role}`, role });
        assert.equal((await user.get(`${DELETED}?q=zeki`)).status, 403, `${role}: arama 403`);
        assert.equal((await user.post(ERASE, { accountId: z.id, confirm: true })).status, 403, `${role}: talep 403`);
      }
      assert.equal(ctx.store.get("SELECT phone_e164 FROM wa_jobs WHERE account_id = ?", z.id).phone_e164, "+905369998877", "ön koşul: yetkisiz talepler bir şey silmedi");
      const res = await ok(ctx.api.post(ERASE, { accountId: z.id, confirm: true }), "silinmiş carinin talebi");
      assert.equal(res.jobs, 1);
      assert.equal(ctx.store.get("SELECT phone_e164 FROM wa_jobs WHERE account_id = ?", z.id).phone_e164, "", "silinmiş carinin telefonu silindi");
      assert.equal((await ctx.jobs(made.batch.id)).find(job => job.accountId === a.id).phone, "+905321112233", "öbür carinin kaydı aynen");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.5.0 WhatsApp tur 2 — W-3 dk DÜŞÜK-1 (test boşluğu): talep anında açık işin dondurulmuş PDF'i silinir", () => {
  it("T2-9b 131056 ile Bekliyor'a dönen işin PDF'i dosyada (ön koşul) → talep → wa_job_pdfs satırı 0 (bakım turundan ÖNCE), iş Atlandı — Silme Talebi", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 500);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaBody(131056, "Pair rate limit") });
      const made = await ok(ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" }), "toplu iş");
      await ctx.drain({ maintain: false });
      const job = (await ctx.jobs(made.batch.id))[0];
      assert.equal(job.state, "pending", "ön koşul: 131056 → Bekliyor");
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_job_pdfs WHERE job_id = ?", job.id).n, 1, "ön koşul: PDF dondurulmuş (dosyada)");
      assert.equal((await ctx.api.post(ERASE, { accountId: a.id, confirm: true })).status, 200);
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_job_pdfs WHERE job_id = ?", job.id).n, 0, "talep anında PDF satırı silindi (MX2: kalırdı)");
      const after = (await ctx.jobs(made.batch.id))[0];
      assert.equal(after.state, "skipped");
    } finally {
      await ctx.close();
    }
  });
});
