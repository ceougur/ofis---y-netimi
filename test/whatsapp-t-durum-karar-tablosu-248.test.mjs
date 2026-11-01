// 2.4.8 İş T (dar kontrol 14) — DURUM BİLDİRİMİ KARAR TABLOSU (tasarım notu tasarim-t-248, onaylı; hücreler YALNIZ ilkeden + karar metinlerinden yazıldı). Her ulaşılabilir hücre
// bir alt test: kurulum (kabul / kabul dosyaya yazılamadı / belirsiz / Meta Bekletti / Süresi Doldu / sıfırlama / geri yükleme / taşıma / istek Meta'da / kilit) → bildirim
// → denetim (dosya satırı, defter son sonucu ve teslim, Bu Ay sayacı, sonraki gönderimde eleme, uygulama sonucu ya da kanca yanıtı).
// Kurallar: K0 kilitte 503 (yazım sırasında da) · K1 yalnız ileri, teslimden sonra failed yok sayılır, Süresi Doldu'yu geç teslim geçer (P3) · K2 bildirim yalnız wamid'in
// denemesini etkiler (eski 131049 denemesinin geç teslimi sayılır — K10:10/K11:00) · K3 satır o denemede sonucunu bilmiyorsa olağan yol (imzalı ve imzasız) · K4 satır o denemeyi
// bilmiyorsa yalnız defter · K5 bağsız: imzalı + iş kimliği Q yolu, imzasız tanınmaz (P5); yanıtı beklenen istek varken 503 · K6 accepted_at = defterdeki kabul anı ·
// K7 başarılı geçişte hata alanları temizlenir (§7a 32) · K8 toparlamanın "uncertain"ı sonraki kabulü yutmaz · eşgüçlülük (aynı bildirim ×2/×3, 503 sonrası yineleme).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { ADMIN_PASSWORD, removeTestDir } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TEL = "905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

/**
 * Düzenek: second = true → ikinci şirket (geri yükleme hemen uygulanır), aksi hâlde ana şirket. fault: { on } — "db-accept" kesintisi (kabul dosyaya yazılamaz).
 * Dönüş: s = { ctx, q, p, body, queue(), apply(list, signed), row(id), last(id), lastAt(id), delivered(id), buAy(), skip(), batch(), backup(), restore(), reset() }.
 */
async function harness({ second = false, dataDir = null, account = true, timeoutMs = 0, lockBackoffMs = null } = {}) {
  const fault = { on: false };
  // İş U6: defter kesintisi — eşzamanlı KABUL defterin outcomes'una yazılamaz (disk dolu / kilit benzetimi; whatsappLedgerFault).
  const ledgerFault = { on: false, times: Infinity, match: null }; // match(op, row): İş V4 talep kesintisi (op "claim")
  const ctx = await startWa({
    maxCompanies: 2,
    now: NOW,
    ...(dataDir ? { dataDir } : {}),
    ...(timeoutMs ? { whatsappTimeoutMs: timeoutMs } : {}),
    ...(lockBackoffMs !== null ? { __testWriteLockBackoffMs: lockBackoffMs } : {}),
    whatsappFault: point => fault.on && point === "db-accept",
    whatsappLedgerFault: (op, row) => {
      const hit = ledgerFault.match ? ledgerFault.match(op, row) : op === "outcome" && row?.outcome === "accepted";
      if (!ledgerFault.on || !hit || ledgerFault.times <= 0) return false;
      ledgerFault.times -= 1;
      return true;
    },
  });
  const queues = new Map();
  const sch = ctx.server.app.whatsapp.scheduler;
  const reg = sch.register.bind(sch);
  sch.register = (key, queue) => {
    queues.set(String(key), queue);
    return reg(key, queue);
  };
  let company = null;
  let q = "";
  if (second) {
    const created = await ok(await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
    company = created.company || created;
    q = `?hofCompany=${encodeURIComponent(company.id)}`;
    await ok(await ctx.api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "bağlantı");
    await ok(await ctx.api.put(`${URLS.ack}${q}`, { ack: true }), "onay");
  }
  const p = account ? await ok(await ctx.api.post(`/api/workspace/accounts${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" }), "cari") : null;
  const body = { kind: "statement", ids: p ? [p.id] : [], preset: "thisMonth" };
  const ledger = () => ctx.server.app.whatsapp.ledger;
  const s = {
    ctx,
    fault,
    ledgerFault,
    company,
    q,
    p,
    body,
    queue: () => (second ? queues.get(company.id) : ctx.server.app.context.whatsapp.queue),
    apply: (list, signed = false) => s.queue().applyStatuses(list, { phoneNumberId: PNID, signed }),
    job: async batchId => (await ctx.api.get(`${URLS.batches}/${batchId}${q}`)).data.data?.jobs?.[0] || null,
    last: id => ledger().attempts(id).at(-1)?.outcome ?? null,
    delivered: id => ledger().deliveredJob(id),
    buAy: async () => (await ctx.api.get(`${URLS.stats}${q}`)).data.data.delivered,
    skip: async () => skipOf(await ok(await ctx.api.post(`${URLS.preview}${q}`, body), "önizleme")),
    batch: async () => (await ok(await ctx.api.post(`${URLS.batches}${q}`, body), "toplu iş")).batch.id,
    backup: async () => (await ok(await ctx.api.post("/api/admin/backups", { scope: "one", companyId: company.id }), "yedek")).backups[0].name,
    restore: async name => ok(await ctx.api.post("/api/admin/backups/restore", { name, company: company.id, confirm: company.code, password: ADMIN_PASSWORD }), "geri yükleme"),
    reset: async () => ok(await ctx.api.post(`/api/companies/${company ? company.id : "sirket-001"}/reset`, { mode: "movements", confirm: company ? company.code : "001", password: ADMIN_PASSWORD }), "Şirket Verisini Sıfırla"),
    ts: () => String(Math.floor(ctx.clock().getTime() / 1000)),
    isoNow: () => new Date(Math.floor(ctx.clock().getTime() / 1000) * 1000).toISOString(),
    // Defter okumaları SQL ile (eski kodun API'sine bağlı değil — eski kodda kırmızının nedeni davranış olsun, eksik işlev değil; ders 38).
    ledgerSql: (query, ...args) => {
      const reader = new DatabaseSync(ledger().file, { readOnly: true });
      try {
        return reader.prepare(query).get(...args) || null;
      } finally {
        reader.close();
      }
    },
    outcomeSql: (id, attempt) => s.ledgerSql("SELECT outcome FROM outcomes WHERE job_id = ? AND attempt = ?", id, attempt)?.outcome ?? null,
    deliveredSql: id => Boolean(s.ledgerSql("SELECT 1 AS x FROM deliveries WHERE job_id = ?", id)),
    acceptedAtInLedger: id => {
      const reader = new DatabaseSync(ledger().file, { readOnly: true });
      try {
        return reader.prepare("SELECT at FROM outcomes WHERE job_id = ? AND outcome = 'accepted' ORDER BY attempt DESC").get(id)?.at || null;
      } finally {
        reader.close();
      }
    },
    close: () => ctx.close(),
  };
  return s;
}
const st = (s, wamid, status, extra = {}) => ({ id: wamid, status, timestamp: s.ts(), recipient_id: TEL, ...extra });
const failedSt = (s, wamid, code = 131026, extra = {}) => st(s, wamid, "failed", { errors: [{ code, title: "x" }], ...extra });
/** Kabul edilmiş iş: { batchId, job }. */
async function accepted(s) {
  const batchId = await s.batch();
  await s.ctx.drain();
  const job = await s.job(batchId);
  assert.equal(job.state, "accepted", "ön koşul: kabul");
  s.ctx.clock.advance(60_000);
  return { batchId, job };
}
/** Kabul dosyaya yazılamadı (iş Gönderiliyor, wamid'siz; defterde kabul). */
async function stuckSending(s) {
  const batchId = await s.batch();
  s.fault.on = true;
  await s.ctx.wa.scheduler.runOnce();
  s.fault.on = false;
  const job = await s.job(batchId);
  assert.deepEqual([job.state, job.wamid || ""], ["sending", ""], "ön koşul: kabul dosyaya yazılamadı");
  s.ctx.clock.advance(60_000);
  return { batchId, job, wamid: s.ctx.messages().at(-1).wamid };
}
/** Sonucu Belirsiz (yanıt kayboldu): { batchId, job, wamid }. */
async function uncertain(s) {
  const batchId = await s.batch();
  s.ctx.fake.state.dropAfter = /\/messages$/;
  await s.ctx.drain();
  s.ctx.fake.state.dropAfter = null;
  const job = await s.job(batchId);
  assert.equal(job.state, "uncertain", "ön koşul: belirsiz");
  s.ctx.clock.advance(60_000);
  return { batchId, job, wamid: s.ctx.messages().at(-1).wamid };
}
/** Süresi Doldu (bildirim yolu çalışıyor — "sent" geldi —, teslim gelmedi, Meta'nın kabul ettiği 3 günlük ömür + 1 sa; t2-p3 düzeneği). */
async function expire(s, wamid) {
  await ok(await s.ctx.api.post(`/api/workspace/whatsapp/templates/ensure${s.q}`, {}), "şablonlar (Meta'nın kabul ettiği ömür)");
  for (const tpl of s.ctx.fake.state.templates) tpl.status = "APPROVED";
  s.apply([st(s, wamid, "sent")]);
  s.ctx.clock.advance(74 * HOUR);
  await s.ctx.drain();
}

describe("2.4.8 İş T — durum bildirimi karar tablosu (tek dosya; her ulaşılabilir hücre bir alt test)", () => {
  // ---------- dosyadaki wamid (aynı bilgisayar) ----------
  for (const signed of [false, true]) {
    const tag = signed ? "imzalı" : "imzasız";
    it(`T1 sent (${tag}) · B1 · Meta Kabul Etti → Gönderildi; defter değişmez; Daha Önce Gönderildi`, async () => {
      const s = await harness();
      try {
        const { batchId, job } = await accepted(s);
        assert.equal(s.apply([st(s, job.wamid, "sent")], signed).applied, 1);
        assert.equal((await s.job(batchId)).state, "sent");
        assert.equal(s.last(job.id), "accepted");
        assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      } finally {
        await s.close();
      }
    });
    it(`T2 delivered (${tag}) · B1 · önceki denemenin hata metni temizlenir (A4, §7a 32); Bu Ay 1; Daha Önce`, async () => {
      const s = await harness();
      try {
        s.ctx.fake.state.recipientErrors[`+${TEL}`] = { status: 400, body: metaError(131056, "Pair rate limit hit") };
        const batchId = await s.batch();
        await s.ctx.wa.scheduler.runOnce();
        s.ctx.fake.state.recipientErrors = {};
        const first = await s.job(batchId);
        assert.ok(first.reason, "ön koşul: 1. deneme hata metni");
        s.ctx.clock.advance(5 * 60_000);
        await s.ctx.drain();
        const job = await s.job(batchId);
        assert.equal(job.state, "accepted", "ön koşul: 2. deneme kabul");
        s.ctx.clock.advance(60_000);
        assert.equal(s.apply([st(s, job.wamid, "delivered")], signed).applied, 1);
        const after = await s.job(batchId);
        assert.deepEqual([after.state, after.reason || "", after.errorCode ?? null], ["delivered", "", null], "hata alanları temiz");
        assert.equal(await s.buAy(), 1);
        assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      } finally {
        await s.close();
      }
    });
  }
  it("T3 read · teslimden sonra okundu; ×3 yinelenen → Bu Ay 1 (eşgüçlü)", async () => {
    const s = await harness();
    try {
      const { batchId, job } = await accepted(s);
      s.apply([st(s, job.wamid, "delivered")]);
      for (let i = 0; i < 3; i += 1) s.apply([st(s, job.wamid, "read")]);
      assert.equal((await s.job(batchId)).state, "read");
      assert.equal(await s.buAy(), 1, "Bu Ay 1");
    } finally {
      await s.close();
    }
  });
  it("T4 failed 131026 · B1 · S2 → Başarısız + teslim edilemedi; gönderilecek", async () => {
    const s = await harness();
    try {
      const { batchId, job } = await accepted(s);
      assert.equal(s.apply([failedSt(s, job.wamid)]).applied, 1);
      assert.equal((await s.job(batchId)).state, "failed");
      assert.equal(s.last(job.id), "failed");
      assert.deepEqual(await s.skip(), ["gönderilecek"]);
    } finally {
      await s.close();
    }
  });
  it("T5/T6 failed 131049 · ilk kez Meta Bekletti (Zaten Kuyrukta); 2. denemenin 131049'u Başarısız", async () => {
    const s = await harness();
    try {
      const { batchId, job } = await accepted(s);
      s.apply([failedSt(s, job.wamid, 131049)]);
      assert.equal((await s.job(batchId)).state, "held");
      assert.equal(s.last(job.id), "released");
      assert.deepEqual(await s.skip(), ["Zaten Kuyrukta"]);
      s.ctx.clock.advance(DAY + 60_000);
      await s.ctx.drain();
      const second = await s.job(batchId);
      assert.deepEqual([second.attempt, second.state], [2, "accepted"], "ön koşul: 2. deneme kabul");
      s.apply([failedSt(s, second.wamid, 131049)]);
      assert.equal((await s.job(batchId)).state, "failed");
    } finally {
      await s.close();
    }
  });
  it("T7 failed teslimden sonra yok sayılır (§7a 18)", async () => {
    const s = await harness();
    try {
      const { batchId, job } = await accepted(s);
      s.apply([st(s, job.wamid, "delivered")]);
      assert.equal(s.apply([failedSt(s, job.wamid)]).applied, 0);
      assert.equal((await s.job(batchId)).state, "delivered");
      assert.equal(s.last(job.id), "accepted");
    } finally {
      await s.close();
    }
  });
  it("T8 Süresi Doldu → geç delivered → Teslim Edildi, Bu Ay 1, Daha Önce (P3)", async () => {
    const s = await harness();
    try {
      const { batchId, job } = await accepted(s);
      await expire(s, job.wamid);
      assert.equal((await s.job(batchId)).state, "expired", "ön koşul: Süresi Doldu");
      assert.equal(s.apply([st(s, job.wamid, "delivered")]).applied, 1);
      assert.equal((await s.job(batchId)).state, "delivered");
      assert.equal(await s.buAy(), 1);
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
    } finally {
      await s.close();
    }
  });
  it("T9 Meta Bekletti → İptal Et → kendi wamid'ine geç delivered → Teslim Edildi (K10:10)", async () => {
    const s = await harness();
    try {
      const { batchId, job } = await accepted(s);
      s.apply([failedSt(s, job.wamid, 131049)]);
      await ok(await s.ctx.api.post(`${URLS.batches}/${batchId}/cancel${s.q}`, {}), "iptal");
      assert.equal(s.apply([st(s, job.wamid, "delivered")]).applied, 1);
      assert.equal((await s.job(batchId)).state, "delivered");
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
    } finally {
      await s.close();
    }
  });
  it("T10 Başarısız işe yinelenen failed → yok sayılır", async () => {
    const s = await harness();
    try {
      const { job } = await accepted(s);
      s.apply([failedSt(s, job.wamid)]);
      assert.equal(s.apply([failedSt(s, job.wamid)]).applied, 0);
    } finally {
      await s.close();
    }
  });

  // ---------- satır o denemede, sonucu bilmiyor (K3) ----------
  for (const signed of [false, true]) {
    const tag = signed ? "imzalı" : "imzasız";
    it(`T12 delivered (${tag}) · B1 · kabul dosyaya yazılamadı (S1) → Teslim Edildi, accepted_at defterdeki kabul anı (A3), hata alanı temiz; ×2 Bu Ay 1`, async () => {
      const s = await harness();
      try {
        const { batchId, job, wamid } = await stuckSending(s);
        const acceptedAt = s.acceptedAtInLedger(job.id);
        assert.ok(acceptedAt, "ön koşul: defterde kabul");
        s.ctx.clock.advance(DAY);
        for (let i = 0; i < 2; i += 1) s.apply([st(s, wamid, "delivered", signed ? { biz_opaque_callback_data: job.id } : {})], signed);
        const after = await s.job(batchId);
        assert.deepEqual([after.state, after.acceptedAt, after.reason || ""], ["delivered", acceptedAt, ""]);
        assert.equal(await s.buAy(), 1, "Bu Ay 1 (eşgüçlü)");
      } finally {
        await s.close();
      }
    });
    it(`T12 failed (${tag}) · S1 → Başarısız + teslim edilemedi; bakım sonra Meta Kabul Etti YAPMAZ; gönderilecek`, async () => {
      const s = await harness();
      try {
        const { batchId, job, wamid } = await stuckSending(s);
        s.apply([failedSt(s, wamid, 131026, signed ? { biz_opaque_callback_data: job.id } : {})], signed);
        s.ctx.clock.advance(10 * 60_000);
        await s.queue().maintain();
        assert.equal((await s.job(batchId)).state, "failed");
        assert.deepEqual(await s.skip(), ["gönderilecek"]);
      } finally {
        await s.close();
      }
    });
  }
  it("T14 imzalı iş kimliği · Sonucu Belirsiz (bağsız) → Teslim Edildi; belirsizlik metni temizlenir (A4, c1b); accepted_at bildirimin anı (öğrenilen wamid)", async () => {
    const s = await harness();
    try {
      const { batchId, job, wamid } = await uncertain(s);
      assert.ok((await s.job(batchId)).reason, "ön koşul: belirsizlik metni");
      const at = s.isoNow();
      assert.equal(s.apply([st(s, wamid, "delivered", { biz_opaque_callback_data: job.id })], true).applied, 1);
      const after = await s.job(batchId);
      assert.deepEqual([after.state, after.reason || "", after.acceptedAt], ["delivered", "", at]);
    } finally {
      await s.close();
    }
  });
  it("T15 imzasız · Sonucu Belirsiz (bağsız) → tanınmaz (P5); kişi Sonucu Belirsiz", async () => {
    const s = await harness();
    try {
      const { wamid } = await uncertain(s);
      assert.equal(s.apply([st(s, wamid, "delivered")]).unknown, 1);
      assert.deepEqual(await s.skip(), ["Sonucu Belirsiz"]);
    } finally {
      await s.close();
    }
  });

  // ---------- sıfırlama: satır yok (K4) ----------
  for (const signed of [false, true]) {
    const tag = signed ? "imzalı" : "imzasız";
    it(`T18 delivered (${tag}) · B1 · sıfırlama → yalnız defter teslim; Bu Ay 1; Daha Önce; ×2 eşgüçlü`, async () => {
      const s = await harness();
      try {
        const { job } = await accepted(s);
        await s.reset();
        for (let i = 0; i < 2; i += 1) s.apply([st(s, job.wamid, "delivered", signed ? { biz_opaque_callback_data: job.id } : {})], signed);
        assert.equal(await s.buAy(), 1);
        assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      } finally {
        await s.close();
      }
    });
    it(`T19 failed 131049 (${tag}) · B1 · sıfırlama → teslim edilemedi; gönderilecek`, async () => {
      const s = await harness();
      try {
        const { job } = await accepted(s);
        await s.reset();
        assert.equal(s.apply([failedSt(s, job.wamid, 131049, signed ? { biz_opaque_callback_data: job.id } : {})], signed).applied, 1);
        assert.equal(s.last(job.id), "failed");
        assert.deepEqual(await s.skip(), ["gönderilecek"]);
      } finally {
        await s.close();
      }
    });
    it(`T20 Süresi Doldu → sıfırlama → geç delivered (${tag}) → teslim sayılır, Bu Ay 1, Daha Önce (A2, P3)`, async () => {
      const s = await harness();
      try {
        const { job } = await accepted(s);
        await expire(s, job.wamid);
        assert.equal(s.last(job.id), "failed", "ön koşul: Süresi Doldu teslim edilemedi");
        await s.reset();
        assert.equal(s.apply([st(s, job.wamid, "delivered", signed ? { biz_opaque_callback_data: job.id } : {})], signed).applied, 1);
        assert.equal(s.delivered(job.id), true);
        assert.equal(await s.buAy(), 1);
        assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      } finally {
        await s.close();
      }
    });
  }
  it("T21 sıfırlama → delivered → failed yok sayılır (§7a 18)", async () => {
    const s = await harness();
    try {
      const { job } = await accepted(s);
      await s.reset();
      s.apply([st(s, job.wamid, "delivered")]);
      assert.equal(s.apply([failedSt(s, job.wamid)]).applied, 0);
      assert.equal(s.last(job.id), "accepted");
    } finally {
      await s.close();
    }
  });

  // ---------- geri yükleme: satır o denemeyi bilmiyor (K4) ----------
  /** İkinci şirket: yedek iş Bekliyor'dayken → kabul → (expired?) → geri yükleme. */
  async function restoredAccepted(s, { expired = false } = {}) {
    const batchId = await s.batch();
    const backup = await s.backup();
    await s.ctx.drain();
    const job = await s.job(batchId);
    assert.equal(job.state, "accepted", "ön koşul: kabul");
    if (expired) await expire(s, job.wamid);
    s.ctx.clock.advance(60_000);
    await s.restore(backup);
    const stale = await s.job(batchId);
    assert.notEqual(stale.wamid, job.wamid, "ön koşul: geri yüklenen satır denemeyi bilmiyor");
    return { batchId, job, stale };
  }
  for (const signed of [false, true]) {
    const tag = signed ? "imzalı" : "imzasız";
    it(`T22 delivered (${tag}) · geri yükleme → yalnız defter teslim; satır değişmez; Daha Önce`, { timeout: 120_000 }, async () => {
      const s = await harness({ second: true });
      try {
        const { batchId, job, stale } = await restoredAccepted(s);
        assert.equal(s.apply([st(s, job.wamid, "delivered", signed ? { biz_opaque_callback_data: job.id } : {})], signed).applied, 1);
        const after = await s.job(batchId);
        assert.deepEqual([after.state, after.attempt], [stale.state, stale.attempt], "satır değişmez");
        assert.equal(await s.buAy(), 1);
        assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      } finally {
        await s.close();
      }
    });
    it(`T23 failed (${tag}) · geri yükleme → teslim edilemedi; gönderilecek`, { timeout: 120_000 }, async () => {
      const s = await harness({ second: true });
      try {
        const { job } = await restoredAccepted(s);
        assert.equal(s.apply([failedSt(s, job.wamid, 131026, signed ? { biz_opaque_callback_data: job.id } : {})], signed).applied, 1);
        assert.deepEqual(await s.skip(), ["gönderilecek"]);
      } finally {
        await s.close();
      }
    });
    it(`T24 Süresi Doldu → geri yükleme → geç delivered (${tag}) → teslim sayılır (A2, c2b)`, { timeout: 120_000 }, async () => {
      const s = await harness({ second: true });
      try {
        const { job } = await restoredAccepted(s, { expired: true });
        assert.equal(s.apply([st(s, job.wamid, "delivered", signed ? { biz_opaque_callback_data: job.id } : {})], signed).applied, 1);
        assert.equal(await s.buAy(), 1);
        assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      } finally {
        await s.close();
      }
    });
  }
  it("T25 imzalı · geri yüklenen satır ESKİ denemede Sonucu Belirsiz (iş kimliği adayı) · son denemenin wamid'ine failed → T23 ile aynı (A1, c5)", { timeout: 120_000 }, async () => {
    const s = await harness({ second: true });
    try {
      const batchId = await s.batch();
      s.ctx.fake.state.dropAfter = /\/messages$/;
      await s.ctx.drain();
      s.ctx.fake.state.dropAfter = null;
      const j1 = await s.job(batchId);
      assert.equal(j1.state, "uncertain", "ön koşul: 1. deneme belirsiz");
      const backup = await s.backup();
      const w1 = s.ctx.messages().at(-1).wamid;
      s.ctx.clock.advance(60_000);
      await s.job(batchId); // yedekten sonra şirket bağlamı yeniden açılır (kuyruk yeniden kaydolur)
      s.apply([failedSt(s, w1, 131049, { biz_opaque_callback_data: j1.id })], true);
      s.ctx.clock.advance(DAY + 60_000);
      await s.ctx.drain();
      const j2 = await s.job(batchId);
      assert.deepEqual([j2.attempt, j2.state], [2, "accepted"], "ön koşul: 2. deneme kabul");
      await s.restore(backup);
      await s.job(batchId);
      const res = s.apply([failedSt(s, j2.wamid, 131026, { biz_opaque_callback_data: j1.id })], true);
      assert.equal(res.applied, 1, `imzalı geç failed defterde uygulandı (geldi ${JSON.stringify(res)})`);
      assert.equal(s.last(j1.id), "failed");
      assert.deepEqual(await s.skip(), ["gönderilecek"]);
    } finally {
      await s.close();
    }
  });
  it("T30 eski (131049 bırakılmış) denemenin geç teslimi, satır geri yüklemeyle ESKİ denemede → teslim sayılır (A8, K11:00)", { timeout: 120_000 }, async () => {
    const s = await harness({ second: true });
    try {
      const batchId = await s.batch();
      const backup = await s.backup();
      await s.ctx.drain();
      const j1 = await s.job(batchId);
      s.ctx.clock.advance(60_000);
      s.apply([failedSt(s, j1.wamid, 131049)]);
      assert.equal((await s.job(batchId)).state, "held", "ön koşul: Meta Bekletti");
      s.ctx.clock.advance(DAY + 60_000);
      s.ctx.fake.state.recipientErrors[`+${TEL}`] = { status: 400, body: metaError(131026, "Message undeliverable") };
      await s.ctx.drain();
      s.ctx.fake.state.recipientErrors = {};
      assert.equal((await s.job(batchId)).state, "failed", "ön koşul: 2. deneme eşzamanlı reddedildi");
      await s.restore(backup);
      await s.job(batchId);
      assert.equal(s.apply([st(s, j1.wamid, "delivered")]).applied, 1, "eski denemenin geç teslimi uygulandı");
      assert.equal(s.delivered(j1.id), true);
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
    } finally {
      await s.close();
    }
  });

  // ---------- eski deneme (K2 / L3) ----------
  it("T28/T29 131049 → 2. deneme kabul (satır daha yeni denemede) → 1. denemenin delivered'ı deftere teslim (L3), failed'ı yok sayılır; satır değişmez", async () => {
    const s = await harness();
    try {
      const { batchId, job } = await accepted(s);
      s.apply([failedSt(s, job.wamid, 131049)]);
      s.ctx.clock.advance(DAY + 60_000);
      await s.ctx.drain();
      const second = await s.job(batchId);
      assert.deepEqual([second.attempt, second.state], [2, "accepted"]);
      assert.equal(s.apply([failedSt(s, job.wamid)]).applied, 0, "eski deneme failed etkisiz");
      assert.equal(s.apply([st(s, job.wamid, "delivered")]).applied, 1, "eski deneme geç teslim sayılır");
      const after = await s.job(batchId);
      assert.deepEqual([after.attempt, after.state], [2, "accepted"], "satır değişmez");
    } finally {
      await s.close();
    }
  });

  // ---------- bağsız / öğrenilmiş / başka şirket / taşıma ----------
  it("T26/T27 imzalı iş kimliğiyle öğrenilmiş (B2) → sıfırlama → imzasız delivered → yalnız defter teslim; failed sonra yok sayılır", async () => {
    const s = await harness();
    try {
      const { job, wamid } = await uncertain(s);
      s.apply([st(s, wamid, "sent", { biz_opaque_callback_data: job.id })], true);
      await s.reset();
      assert.equal(s.apply([st(s, wamid, "delivered")]).applied, 1);
      assert.equal(s.delivered(job.id), true);
      assert.equal(s.apply([failedSt(s, wamid)]).applied, 0);
    } finally {
      await s.close();
    }
  });
  it("T31/T32 bağsız + sıfırlama: imzalı iş kimliği → Q4 (teslim); imzasız → tanınmaz (P5)", async () => {
    const s = await harness();
    try {
      const { job, wamid } = await uncertain(s);
      await s.reset();
      assert.equal(s.apply([st(s, wamid, "delivered", { biz_opaque_callback_data: job.id })]).unknown, 1, "imzasız tanınmaz");
      assert.equal(s.apply([st(s, wamid, "delivered", { biz_opaque_callback_data: job.id })], true).applied, 1, "imzalı Q4");
      assert.equal(s.delivered(job.id), true);
    } finally {
      await s.close();
    }
  });
  it("T33 başka şirketin wamid'i bu şirkette etkisiz (K9)", { timeout: 120_000 }, async () => {
    const s = await harness({ second: true });
    try {
      const batchId = await s.batch();
      await s.ctx.drain();
      const other = await s.job(batchId);
      const mainQueue = s.ctx.server.app.context.whatsapp.queue;
      const res = mainQueue.applyStatuses([st(s, other.wamid, "delivered")], { phoneNumberId: PNID });
      assert.equal(res.applied, 0, "ana şirket uygulamadı");
      assert.equal((await s.job(batchId)).state, "accepted", "002 değişmedi");
    } finally {
      await s.close();
    }
  });
  it("T34 taşıma (defter yok): dosyadaki wamid'le delivered → Teslim Edildi, yeni defterde Bu Ay 1", { timeout: 120_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-t34-"));
    const dataDir = path.join(root, "data");
    let s = await harness({ dataDir });
    try {
      const { batchId, job } = await accepted(s);
      await s.close();
      s = null;
      const moved = path.join(root, "tasindi");
      cpSync(dataDir, moved, { recursive: true });
      for (const name of readdirSync(moved)) if (name.startsWith("whatsapp-gonderim.sqlite")) rmSync(path.join(moved, name), { force: true });
      s = await harness({ dataDir: moved, account: false });
      assert.equal(s.apply([st(s, job.wamid, "delivered")]).applied, 1);
      assert.equal((await s.job(batchId)).state, "delivered");
      assert.equal(await s.buAy(), 1);
    } finally {
      await s?.close();
      removeTestDir(root);
    }
  });
  it("T34s taşıma (defter yok) · satır Sonucu Belirsiz · İMZALI iş kimliğiyle delivered → satır yolu: Teslim Edildi (defter işi bilmiyor — U2 istisnası; V6 mE)", { timeout: 120_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-t34s-"));
    const dataDir = path.join(root, "data");
    let s = await harness({ dataDir });
    try {
      const { batchId, job, wamid } = await uncertain(s);
      await s.close();
      s = null;
      const moved = path.join(root, "tasindi");
      cpSync(dataDir, moved, { recursive: true });
      for (const name of readdirSync(moved)) if (name.startsWith("whatsapp-gonderim.sqlite")) rmSync(path.join(moved, name), { force: true });
      s = await harness({ dataDir: moved, account: false });
      assert.equal((await s.job(batchId)).state, "uncertain", "ön koşul: taşınan satır belirsiz");
      assert.equal(s.apply([st(s, wamid, "delivered", { biz_opaque_callback_data: job.id })], true).applied, 1);
      assert.equal((await s.job(batchId)).state, "delivered");
    } finally {
      await s?.close();
      removeTestDir(root);
    }
  });

  // ---------- istek Meta'dayken (T16 / T35) ----------
  it("T16 imzalı bildirim istek Meta'dayken işi ilerletir; yanıt 'Meta Kabul Etti' ezmez; tek ileti", async () => {
    const s = await harness();
    try {
      const batchId = await s.batch();
      const wamid = `wamid.SAHTE${String(s.ctx.fake.state.sent + 1).padStart(4, "0")}`;
      s.ctx.fake.state.delayMs = 400;
      const turn = s.ctx.wa.scheduler.runOnce();
      let job = null;
      for (let i = 0; i < 200 && !(job?.state === "sending" && s.ctx.fake.requests.some(item => item.path.endsWith("/messages"))); i += 1) {
        job = s.ctx.store.get("SELECT id, state FROM wa_jobs WHERE batch_id = ?", batchId);
        await wait(20);
      }
      assert.equal(s.apply([st(s, wamid, "delivered", { biz_opaque_callback_data: job.id })], true).applied, 1);
      await turn;
      s.ctx.fake.state.delayMs = 0;
      assert.equal((await s.job(batchId)).state, "delivered");
      await s.ctx.drain();
      assert.equal(s.ctx.messages().length, 1);
    } finally {
      await s.close();
    }
  });
  it("T35 istek Meta'dayken toparlama denemeye 'uncertain' yazdı → yanıt gelince kabul öğrenilir (A7, K8); sonraki imzasız delivered uygulanır; Daha Önce", async () => {
    const s = await harness();
    try {
      const batchId = await s.batch();
      s.ctx.fake.state.delayMs = 400;
      const turn = s.ctx.wa.scheduler.runOnce();
      let job = null;
      for (let i = 0; i < 200 && !(job?.state === "sending" && s.ctx.fake.requests.some(item => item.path.endsWith("/messages"))); i += 1) {
        job = s.ctx.store.get("SELECT id, state, attempt FROM wa_jobs WHERE batch_id = ?", batchId);
        await wait(20);
      }
      // Açılış toparlamasının yaptığı (geri yükleme / yeniden açılış — istek sürerken): talepli, sonuçsuz denemeye "uncertain".
      s.ctx.server.app.whatsapp.ledger.outcome({ jobId: job.id, attempt: job.attempt, outcome: "uncertain", at: s.isoNow(), companyId: "sirket-001", wabaId: WABA });
      s.ctx.store.run("UPDATE wa_jobs SET state = 'uncertain', error_text = ? WHERE id = ?", "Gönderim sırasında program kapandı; iletinin Meta'ya ulaşıp ulaşmadığı bilinmiyor.", job.id);
      await turn;
      s.ctx.fake.state.delayMs = 0;
      const wamid = s.ctx.messages().at(-1).wamid;
      assert.equal(s.ctx.server.app.whatsapp.ledger.attemptOfWamid(wamid)?.jobId, job.id, "kabul defterde öğrenildi (wamid bağlı)");
      const row = await s.job(batchId);
      assert.deepEqual([row.state, row.wamid, row.reason || ""], ["accepted", wamid, ""], "İş U4: satır da Meta Kabul Etti (belirsizlik metni temiz)");
      assert.equal(s.apply([st(s, wamid, "delivered")]).applied, 1, "sonraki bildirim tanındı");
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
    } finally {
      await s.close();
    }
  });

  // =================================================================================================================================================
  // İş U (dar kontrol 15; tasarim-u-248, onaylı): K1′ "TESLİM HER YOLDA SAYILIR" + U1–U7 hücreleri.
  // =================================================================================================================================================
  for (const value of ["delivered", "read"]) {
    it(`T9b Meta Bekletti (iptal YOK) · kendi wamid'ine geç ${value} → ${value === "read" ? "Okundu" : "Teslim Edildi"}, Bu Ay 1, Daha Önce; yinelenen etkisiz; 24 sa sonra ikinci ileti YOK (U1, K1′)`, async () => {
      const s = await harness();
      try {
        const { batchId, job } = await accepted(s);
        s.apply([failedSt(s, job.wamid, 131049)]);
        assert.equal((await s.job(batchId)).state, "held", "ön koşul: Meta Bekletti");
        assert.equal(s.apply([st(s, job.wamid, value)]).applied, 1, "geç teslim uygulandı");
        assert.equal(s.apply([st(s, job.wamid, value)]).applied, 0, "yinelenen etkisiz");
        assert.equal((await s.job(batchId)).state, value);
        assert.equal(await s.buAy(), 1, "Bu Ay 1");
        assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
        s.ctx.clock.advance(DAY + 60_000);
        await s.ctx.drain();
        assert.equal(s.ctx.messages().length, 1, "24 saat sonra yeniden deneme yok");
        assert.equal((await s.job(batchId)).state, value, "iş yeniden açılmadı");
      } finally {
        await s.close();
      }
    });
    it(`T11 Başarısız (131026) · ${value} → ${value === "read" ? "Okundu" : "Teslim Edildi"}, Bu Ay 1, Daha Önce; ×2 etkisiz; iş yeniden açılmaz (K1′; eskiden ulaşılamaz sayılan hücre)`, async () => {
      const s = await harness();
      try {
        const { batchId, job } = await accepted(s);
        s.apply([failedSt(s, job.wamid)]);
        assert.equal((await s.job(batchId)).state, "failed", "ön koşul: Başarısız");
        assert.equal(s.apply([st(s, job.wamid, value)]).applied, 1);
        assert.equal(s.apply([st(s, job.wamid, value)]).applied, 0, "yinelenen etkisiz");
        const after = await s.job(batchId);
        assert.deepEqual([after.state, after.reason || ""], [value, ""], "teslim, hata metni temiz");
        assert.equal(await s.buAy(), 1);
        assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
        s.ctx.clock.advance(DAY);
        await s.ctx.drain();
        assert.equal(s.ctx.messages().length, 1, "iş yeniden açılmaz");
      } finally {
        await s.close();
      }
    });
  }
  it("T8x Süresi Doldu · delivered ×2 → Bu Ay 1, iş yeniden açılmaz (K1′ koşul c)", async () => {
    const s = await harness();
    try {
      const { batchId, job } = await accepted(s);
      await expire(s, job.wamid);
      assert.equal((await s.job(batchId)).state, "expired", "ön koşul: Süresi Doldu");
      assert.equal(s.apply([st(s, job.wamid, "delivered")]).applied, 1);
      assert.equal(s.apply([st(s, job.wamid, "delivered")]).applied, 0, "yinelenen etkisiz");
      assert.equal(await s.buAy(), 1);
      await s.ctx.drain();
      assert.equal(s.ctx.messages().length, 1);
    } finally {
      await s.close();
    }
  });
  it("T14-sent imzalı iş kimliği · Sonucu Belirsiz → sent: Gönderildi, belirsizlik metni ve hata kodu temiz (U7; K7 sent kolu)", async () => {
    const s = await harness();
    try {
      const { batchId, job, wamid } = await uncertain(s);
      assert.ok((await s.job(batchId)).reason, "ön koşul: belirsizlik metni");
      assert.equal(s.apply([st(s, wamid, "sent", { biz_opaque_callback_data: job.id })], true).applied, 1);
      const after = await s.job(batchId);
      assert.deepEqual([after.state, after.reason || "", after.errorCode ?? null], ["sent", "", null]);
    } finally {
      await s.close();
    }
  });
  for (const value of ["delivered", "failed"]) {
    it(`T25b imzalı · geri yüklenen satır ESKİ denemede (1) belirsiz, son deneme (2) de belirsiz (wamid defterde yok) · ${value} → yalnız defter SON denemeye; satır değişmez (U2)`, { timeout: 120_000 }, async () => {
      const s = await harness({ second: true });
      try {
        const batchId = await s.batch();
        s.ctx.fake.state.dropAfter = /\/messages$/;
        await s.ctx.drain();
        s.ctx.fake.state.dropAfter = null;
        const j1 = await s.job(batchId);
        assert.equal(j1.state, "uncertain", "ön koşul: 1. deneme belirsiz");
        const backup = await s.backup();
        const w1 = s.ctx.messages().at(-1).wamid;
        s.ctx.clock.advance(60_000);
        await s.job(batchId);
        s.apply([failedSt(s, w1, 131049, { biz_opaque_callback_data: j1.id })], true);
        assert.equal((await s.job(batchId)).state, "held", "ön koşul: Meta Bekletti (1. denemenin wamid'i öğrenildi)");
        s.ctx.clock.advance(DAY + 60_000);
        s.ctx.fake.state.dropAfter = /\/messages$/;
        await s.ctx.drain();
        s.ctx.fake.state.dropAfter = null;
        const j2 = await s.job(batchId);
        assert.deepEqual([j2.attempt, j2.state], [2, "uncertain"], "ön koşul: 2. deneme belirsiz");
        const w2 = s.ctx.messages().at(-1).wamid;
        await s.restore(backup);
        const stale = await s.job(batchId);
        assert.deepEqual([stale.attempt, stale.state], [1, "uncertain"], "ön koşul: geri yüklenen satır 1. denemede");
        const event = value === "failed" ? failedSt(s, w2, 131026, { biz_opaque_callback_data: j1.id }) : st(s, w2, "delivered", { biz_opaque_callback_data: j1.id });
        assert.equal(s.apply([event], true).applied, 1, "son denemeye uygulandı");
        assert.equal(s.apply([event], true).applied, 0, "yinelenen etkisiz");
        await s.ctx.wa.scheduler.maintain(); // İş V6 (mA): bakım turu da satırı değiştirmez (satırın denemesi defterin son denemesi değil)
        const after = await s.job(batchId);
        assert.deepEqual([after.attempt, after.state], [1, "uncertain"], "satır değişmez (bakımdan sonra da)");
        const attempts = s.ctx.wa.ledger.attempts(j1.id).map(item => `${item.attempt}:${item.outcome}`);
        assert.equal(attempts[0], "1:released", "1. deneme dokunulmadı");
        assert.equal(s.ctx.wa.ledger.attemptOfWamid(w2)?.attempt, 2, "wamid SON denemeye öğrenildi");
        if (value === "failed") {
          assert.equal(attempts[1], "2:failed");
          assert.deepEqual(await s.skip(), ["gönderilecek"]);
        } else {
          assert.equal(s.ctx.wa.ledger.deliveredAttempt(j1.id, 2), true);
          assert.equal(await s.buAy(), 1);
          assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
        }
      } finally {
        await s.close();
      }
    });
  }
  for (const order of ["eski-once", "yeni-once"]) {
    it(`T28b 131049 → 2. deneme kabul · İKİ deneme de teslim (${order}) → Bu Ay 2 (deneme başına), Daha Önce (kişi bir kez), satır 2. denemede Teslim (U5)`, async () => {
      const s = await harness();
      try {
        const { batchId, job } = await accepted(s);
        s.apply([failedSt(s, job.wamid, 131049)]);
        s.ctx.clock.advance(DAY + 60_000);
        await s.ctx.drain();
        const second = await s.job(batchId);
        assert.deepEqual([second.attempt, second.state], [2, "accepted"], "ön koşul: 2. deneme kabul");
        const events = [st(s, job.wamid, "delivered"), st(s, second.wamid, "delivered")];
        for (const event of order === "eski-once" ? events : [...events].reverse()) assert.equal(s.apply([event]).applied, 1);
        assert.equal(await s.buAy(), 2, "Bu Ay iki teslim");
        for (const event of events) assert.equal(s.apply([event]).applied, 0, "yinelenen etkisiz");
        assert.equal(await s.buAy(), 2, "yinelenenden sonra da 2");
        assert.equal((await s.job(batchId)).state, "delivered");
        assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      } finally {
        await s.close();
      }
    });
  }
  // =================================================================================================================================================
  // İş V (dar kontrol 16; tasarim-v-248, onaylı): defterdeki TESLİM her yerde okunur (V2), teslimi olan işe talep yok (V4), dişsiz testlerin hücreleri (V6).
  // =================================================================================================================================================
  it("T-uncertain-failed belirsiz → yedek → imzalı failed (satır Başarısız; defter teslim edilemedi + öğrenilen wamid) → geri yükleme → bakım: satır Meta Kabul Etti YAPILMAZ; gönderilecek (V6 mB)", { timeout: 120_000 }, async () => {
    const s = await harness({ second: true });
    try {
      const { batchId, job, wamid } = await uncertain(s);
      const backup = await s.backup();
      await s.job(batchId);
      assert.equal(s.apply([failedSt(s, wamid, 131026, { biz_opaque_callback_data: job.id })], true).applied, 1);
      assert.equal((await s.job(batchId)).state, "failed", "ön koşul: Başarısız");
      await s.restore(backup);
      assert.equal((await s.job(batchId)).state, "uncertain", "ön koşul: geri yüklenen satır belirsiz");
      await s.ctx.wa.scheduler.maintain();
      assert.notEqual((await s.job(batchId)).state, "accepted", "teslim edilemeyen deneme Meta Kabul Etti yazılmaz");
      assert.deepEqual(await s.skip(), ["gönderilecek"]);
    } finally {
      await s.close();
    }
  });
  it("T-settle-D belirsiz → yedek → imzalı delivered (Teslim) → geri yükleme → bakım: satır Teslim Edildi (defterdeki anla); +31 gün bakım değişmez, teslim edilemedi yazılmaz; Bu Ay 1 (V2, n1)", { timeout: 120_000 }, async () => {
    const s = await harness({ second: true });
    try {
      const { batchId, job, wamid } = await uncertain(s);
      const backup = await s.backup();
      await s.job(batchId);
      const at = s.isoNow();
      assert.equal(s.apply([st(s, wamid, "delivered", { biz_opaque_callback_data: job.id })], true).applied, 1);
      await s.restore(backup);
      assert.equal((await s.job(batchId)).state, "uncertain", "ön koşul: geri yüklenen satır belirsiz");
      await s.ctx.wa.scheduler.maintain();
      const settled = await s.job(batchId);
      assert.deepEqual([settled.state, settled.reason || ""], ["delivered", ""], "Teslim Edildi");
      assert.equal(settled.deliveredAt, at, "teslim anı defterdeki an");
      assert.equal(await s.buAy(), 1, "Bu Ay 1 (çift sayım yok)");
      await s.ctx.wa.scheduler.maintain();
      assert.equal(await s.buAy(), 1, "ikinci bakım da çift saymaz");
      await expire(s, wamid);
      s.ctx.clock.advance(31 * DAY);
      await s.ctx.wa.scheduler.maintain();
      assert.equal((await s.job(batchId)).state, "delivered", "süre dolumu Teslim Edildi'ye dokunmaz");
      assert.equal(s.ledgerSql("SELECT COUNT(*) AS n FROM failures WHERE job_id = ?", job.id).n, 0, "teslim edilemedi yazılmadı");
    } finally {
      await s.close();
    }
  });
  it("T-settleSending-D istek Meta'dayken yedek (satır Gönderiliyor) → kabul → delivered → geri yükleme → açılış toparlaması: Teslim Edildi (V2, n1b)", { timeout: 120_000 }, async () => {
    const s = await harness({ second: true, timeoutMs: 8_000 });
    try {
      const batchId = await s.batch();
      s.ctx.fake.state.delayMs = 2_500;
      const turn = s.ctx.wa.scheduler.runOnce();
      for (let i = 0; i < 400 && !s.ctx.fake.requests.some(item => item.path.endsWith("/messages")); i += 1) await wait(10);
      const backup = await s.backup();
      await turn;
      s.ctx.fake.state.delayMs = 0;
      const job = await s.job(batchId);
      assert.equal(job.state, "accepted", "ön koşul: kabul");
      assert.equal(s.apply([st(s, job.wamid, "delivered")]).applied, 1);
      await s.restore(backup);
      const after = await s.job(batchId);
      assert.equal(after.state, "delivered", `açılış toparlaması teslimi gördü (geldi ${after.state})`);
      assert.equal(await s.buAy(), 1);
      assert.equal(s.ctx.messages().length, 1);
    } finally {
      s.ctx.fake.state.delayMs = 0;
      await s.close();
    }
  });
  for (const kind of ["cift-sinir", "talep-yazilamadi"]) {
    it(`T-bekletti-2.deneme-düştü (${kind}) 131049 → 24 sa → 2. deneme ileti göndermeden düşer → 1. iletinin geç teslimi → sonraki tur talep AÇMAZ, iş Teslim Edildi; kişiye 1 ileti, Bu Ay 1 (V4, n9)`, async () => {
      const s = await harness();
      try {
        const { batchId, job } = await accepted(s);
        s.apply([failedSt(s, job.wamid, 131049)]);
        s.ctx.clock.advance(DAY + 60_000);
        if (kind === "cift-sinir") s.ctx.fake.state.recipientErrors[`+${TEL}`] = { status: 400, body: metaError(131056, "Pair rate limit hit") };
        else Object.assign(s.ledgerFault, { on: true, match: op => op === "claim" });
        await s.ctx.wa.scheduler.runOnce();
        s.ctx.fake.state.recipientErrors = {};
        Object.assign(s.ledgerFault, { on: false, match: null });
        const mid = await s.job(batchId);
        assert.ok(["pending", "limited"].includes(mid.state), `ön koşul: 2. deneme ileti göndermeden düştü, iş açık (geldi ${mid.state})`);
        assert.equal(s.ctx.messages().length, 1, "ön koşul: tek ileti");
        assert.equal(s.apply([st(s, job.wamid, "delivered")]).applied, 1, "1. iletinin geç teslimi");
        s.ctx.clock.advance(10 * 60_000);
        await s.ctx.wa.scheduler.runOnce(); // yalnız işçi turu (bakım YOK — V2'nin bakım ayağı V4'ü örtmesin)
        assert.equal((await s.job(batchId)).state, "delivered", "işçi talep açmadan işi Teslim Edildi yaptı");
        await s.ctx.drain();
        assert.equal(s.ctx.messages().length, 1, "ikinci ileti gitmedi");
        assert.equal((await s.job(batchId)).state, "delivered");
        assert.equal(await s.buAy(), 1);
      } finally {
        await s.close();
      }
    });
  }
  it("T36-önizleme kabul deftere yazılamadı → sorun kalkar → BAKIM YOKKEN önizleme onarır: Daha Önce Gönderildi (V6 mF, n12)", async () => {
    const s = await harness();
    try {
      s.ledgerFault.on = true;
      const batchId = await s.batch();
      await s.ctx.wa.scheduler.runOnce();
      assert.equal((await s.job(batchId)).state, "accepted", "ön koşul: dosyada kabul");
      assert.equal(s.outcomeSql((await s.job(batchId)).id, 1), null, "ön koşul: defterde sonuç yok");
      s.ledgerFault.on = false;
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"], "önizleme onardı");
    } finally {
      await s.close();
    }
  });
  it("T36-kilit onarım listesi dolu + defter BAŞKA SÜREÇTE kilitli → önizleme ve yeni gönderim BEKLEMEZ (< 1,5 sn); neden kilit notuyla aynı cümle; kilit kalkınca önizleme onarır (V3, n5)", { timeout: 120_000 }, async () => {
    const s = await harness({ lockBackoffMs: 200 });
    try {
      s.ledgerFault.on = true;
      const batchId = await s.batch();
      await s.ctx.wa.scheduler.runOnce();
      s.ledgerFault.on = false;
      assert.equal(s.outcomeSql((await s.job(batchId)).id, 1), null, "ön koşul: defterde sonuç yok (onarım listesinde)");
      const NOTE = "WhatsApp gönderim defteri başka bir program tarafından kullanılıyor; gönderim bekliyor.";
      const lock = new DatabaseSync(s.ctx.wa.ledger.file);
      lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
      try {
        for (let i = 0; i < 2; i += 1) {
          const t0 = Date.now();
          const res = await s.ctx.api.post(URLS.preview, s.body);
          const ms = Date.now() - t0;
          assert.equal(res.status, 200);
          assert.ok(ms < 1_500, `önizleme beklemedi (${ms} ms)`);
          assert.equal(res.data.data.startBlock?.message, NOTE, "başlatma engeli kilit notuyla aynı cümle");
        }
        const t0 = Date.now();
        const start = await s.ctx.api.post(URLS.batches, s.body);
        assert.ok(Date.now() - t0 < 1_500, "yeni gönderim beklemedi");
        assert.deepEqual([start.status, start.data.error], [503, NOTE]);
      } finally {
        lock.exec("ROLLBACK");
        lock.close();
      }
      await wait(300); // işaret süresi (testte 200 ms)
      const res = await s.ctx.api.post(URLS.preview, s.body);
      assert.equal(res.data.data.startBlock ?? null, null, "kilit kalkınca engel yok");
      assert.deepEqual(skipOf(res.data.data), ["Daha Önce Gönderildi"]);
    } finally {
      await s.close();
    }
  });
  it("T-local-neden kabul defteri yazılamazken toplu iş: 'bu bilgisayarda yürütülemedi' nedeniyle duraklar; kod adı / internet cümlesi yok (V5, n4)", async () => {
    const s = await harness();
    try {
      const ids = [s.p.id];
      for (const [name, phone] of [["Ayşe Yılmaz", "0532 111 22 33"], ["Can Demir", "0532 111 22 34"], ["Deniz Ak", "0532 111 22 35"], ["Ece Tan", "0532 111 22 36"], ["Fikret Er", "0532 111 22 37"], ["Gül Su", "0532 111 22 38"]]) {
        ids.push((await ok(await s.ctx.api.post("/api/workspace/accounts", { name, phone, openingBalance: "100" }), "cari")).id);
      }
      const batchId = (await ok(await s.ctx.api.post(URLS.batches, { kind: "statement", ids, preset: "thisMonth" }), "toplu iş")).batch.id;
      s.ledgerFault.on = true;
      for (let i = 0; i < 30; i += 1) {
        await s.ctx.wa.scheduler.runOnce();
        s.ctx.clock.advance(5 * 60_000);
        if ((await s.ctx.api.get(`${URLS.batches}/${batchId}`)).data.data.state === "paused") break;
      }
      const batch = (await s.ctx.api.get(`${URLS.batches}/${batchId}`)).data.data;
      assert.equal(batch.state, "paused", "ön koşul: toplu iş durdu");
      assert.equal(s.ctx.messages().length, 1, "onarılamazken ikinci kişiye gönderilmedi");
      assert.equal(batch.pauseCode, "local");
      assert.match(batch.pauseReason, /bu bilgisayarda yürütülemedi/);
      assert.match(batch.pauseReason, /önceki bir iletinin kabulü gönderim defterine yazılamadı/);
      assert.doesNotMatch(batch.pauseReason, /WA_LEDGER|ENOSPC|İnternet|Meta'ya/);
    } finally {
      s.ledgerFault.on = false;
      await s.close();
    }
  });
  // =================================================================================================================================================
  // İş W (KULLANICI KARARI S9-1, 01.11.2026; tasarim-w-248, onaylı): "Yine de Gönder" (belirsizlik onayı) zincirinin KAYNAĞINDAN teslim gelirse yeni ileti GİTMEZ —
  // iş "Atlandı" (neden "Daha Önce Gönderildi"); defter / Bu Ay değişmez. Kapsam: Sonucu Belirsiz işteki Yine de Gönder ve onun zincirinden gelen Başarısızları Yeniden
  // Dene; yeni gönderimde R3'e rağmen bilerek seçilen Yine de Gönder KAPSANMAZ (ikinci kopya gider).
  // =================================================================================================================================================
  /** Kaynak iş Sonucu Belirsiz → işteki Yine de Gönder (onaylı). Dönüş: { j1, w1, b2 }. */
  async function anyway(s, source = null) {
    const base = source || (await uncertain(s));
    const res = await s.ctx.api.post(`/api/workspace/whatsapp/jobs/${base.job.id}/send-anyway${s.q}`, { confirm: true });
    assert.equal(res.status, 200, `ön koşul: Yine de Gönder (${res.status} ${JSON.stringify(res.data)})`);
    return { j1: base.job, w1: base.wamid, b1: base.batchId, b2: res.data.data.batch.id };
  }
  const sourceDelivered = (s, a, value = "delivered") => s.apply([st(s, a.w1, value, { biz_opaque_callback_data: a.j1.id })], true);
  for (const [cell, value, mode] of [["W1 kuyrukta", "delivered", "queue"], ["W2 duraklatılmış → Devam Et", "delivered", "paused"], ["W4 kaynağa read (D'siz)", "read", "queue"]]) {
    it(`${cell} · kaynağın teslimi yeni ileti gitmeden gelir → yeni iş Atlandı — Daha Önce Gönderildi; ileti 1, Bu Ay 1 (S9-1)`, async () => {
      const s = await harness();
      try {
        const a = await anyway(s);
        if (mode === "paused") assert.equal((await s.ctx.api.post(`${URLS.batches}/${a.b2}/pause`, {})).status, 200);
        assert.equal(sourceDelivered(s, a, value).applied, 1, "kaynağın teslimi uygulandı");
        if (mode === "paused") assert.equal((await s.ctx.api.post(`${URLS.batches}/${a.b2}/resume`, {})).status, 200);
        s.ctx.clock.advance(60_000);
        await s.ctx.wa.scheduler.runOnce();
        const j2 = await s.job(a.b2);
        assert.deepEqual([j2.state, j2.reason, j2.stateLabel], ["skipped", "Daha Önce Gönderildi", "Atlandı"], "yeni iş Atlandı — Daha Önce Gönderildi");
        await s.ctx.drain();
        assert.equal(s.ctx.messages().length, 1, "yeni ileti gitmedi");
        assert.equal(await s.buAy(), 1, "Bu Ay değişmez");
        assert.equal(s.ledgerSql("SELECT COUNT(*) AS n FROM claims WHERE job_id = ?", j2.id).n, 0, "talep yazılmadı");
      } finally {
        await s.close();
      }
    });
  }
  it("W3 yeni iş 1. denemede kabul + 131049 (Meta Bekletti) → kaynağa teslim → 24 sa: 2. deneme YOK, iş Atlandı; ileti 2 (yeni işin 1. iletisi önlenemezdi) (S9-1)", async () => {
    const s = await harness();
    try {
      const a = await anyway(s);
      await s.ctx.drain();
      const j2 = await s.job(a.b2);
      assert.equal(j2.state, "accepted", "ön koşul: yeni iş kabul");
      s.ctx.clock.advance(60_000);
      s.apply([failedSt(s, j2.wamid, 131049)]);
      assert.equal((await s.job(a.b2)).state, "held", "ön koşul: Meta Bekletti");
      assert.equal(sourceDelivered(s, a).applied, 1);
      s.ctx.clock.advance(DAY + 60_000);
      await s.ctx.drain();
      const after = await s.job(a.b2);
      assert.deepEqual([after.state, after.reason], ["skipped", "Daha Önce Gönderildi"]);
      assert.equal(s.ctx.messages().length, 2, "2. deneme gitmedi");
      assert.equal(s.ledgerSql("SELECT COUNT(*) AS n FROM claims WHERE job_id = ?", j2.id).n, 1, "yalnız 1. denemenin talebi");
    } finally {
      await s.close();
    }
  });
  it("W5 zincir derinliği 2: J1 belirsiz → YdG J2 belirsiz → YdG J3 kuyrukta → J1'e teslim → J3 Atlandı (S9-1)", async () => {
    const s = await harness();
    try {
      const a = await anyway(s);
      s.ctx.fake.state.dropAfter = /\/messages$/;
      await s.ctx.drain();
      s.ctx.fake.state.dropAfter = null;
      const j2 = await s.job(a.b2);
      assert.equal(j2.state, "uncertain", "ön koşul: J2 belirsiz");
      s.ctx.clock.advance(60_000);
      const res = await s.ctx.api.post(`/api/workspace/whatsapp/jobs/${j2.id}/send-anyway`, { confirm: true });
      assert.equal(res.status, 200);
      const b3 = res.data.data.batch.id;
      assert.equal(sourceDelivered(s, a).applied, 1, "J1'e teslim");
      s.ctx.clock.advance(60_000);
      await s.ctx.drain();
      assert.deepEqual([(await s.job(b3)).state, (await s.job(b3)).reason], ["skipped", "Daha Önce Gönderildi"]);
      assert.equal(s.ctx.messages().length, 2, "J1 ve J2; J3 gitmedi");
    } finally {
      await s.close();
    }
  });
  it("W6 kaynağa failed (teslim edilemedi) → yeni iş GİDER (ilke 1) (S9-1)", async () => {
    const s = await harness();
    try {
      const a = await anyway(s);
      assert.equal(s.apply([failedSt(s, a.w1, 131026, { biz_opaque_callback_data: a.j1.id })], true).applied, 1);
      await s.ctx.drain();
      assert.equal((await s.job(a.b2)).state, "accepted");
      assert.equal(s.ctx.messages().length, 2);
    } finally {
      await s.close();
    }
  });
  it("W7 kaynağın teslimi yeni ileti GİTTİKTEN sonra gelir → ileti 2 (önlenemez; BİLİNEN SINIR); yeni iş kendi durumunda", async () => {
    const s = await harness();
    try {
      const a = await anyway(s);
      await s.ctx.drain();
      assert.equal(sourceDelivered(s, a).applied, 1);
      await s.ctx.drain();
      assert.equal((await s.job(a.b2)).state, "accepted");
      assert.equal(s.ctx.messages().length, 2);
    } finally {
      await s.close();
    }
  });
  it("W8 kaynağın teslimi ×2 → eşgüçlü: yeni iş Atlandı, Bu Ay 1 (S9-1)", async () => {
    const s = await harness();
    try {
      const a = await anyway(s);
      assert.equal(sourceDelivered(s, a).applied, 1);
      assert.equal(sourceDelivered(s, a).applied, 0, "yinelenen etkisiz");
      await s.ctx.drain();
      assert.equal((await s.job(a.b2)).state, "skipped");
      assert.equal(await s.buAy(), 1);
    } finally {
      await s.close();
    }
  });
  it("W9 başka kişinin kaynağı teslim edildi → bu kişinin Yine de Gönder işi GİDER (kapsam: zincir)", async () => {
    const s = await harness();
    try {
      const a = await anyway(s); // Burak: J1 belirsiz → J2 kuyrukta
      const other = await ok(await s.ctx.api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", phone: "0532 111 22 33", openingBalance: "500" }), "cari 2");
      const bOther = (await ok(await s.ctx.api.post(URLS.batches, { kind: "statement", ids: [other.id], preset: "thisMonth" }), "toplu iş 2")).batch.id;
      await s.ctx.wa.scheduler.runOnce(); // sıradaki işler: J2 (Burak) ya da Ayşe — ikisi de gider
      await s.ctx.drain();
      const jo = await s.job(bOther);
      assert.equal(s.apply([st(s, jo.wamid, "delivered")]).applied, 1, "başka kişinin teslimi");
      assert.equal((await s.job(a.b2)).state, "accepted", "Burak'ın Yine de Gönder işi gitti");
    } finally {
      await s.close();
    }
  });
  it("W-b yeni gönderimde R3'e rağmen BİLEREK seçilen Yine de Gönder KAPSANMAZ: önceki iletinin teslimi sonradan gelse de ikinci kopya gider (S9-1 b)", async () => {
    const s = await harness();
    try {
      const { job } = await accepted(s);
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"], "ön koşul: R3");
      const b2 = (await ok(await s.ctx.api.post(URLS.batches, { ...s.body, sendAgain: true }), "Yine de Gönder (R3)")).batch.id;
      assert.equal(s.apply([st(s, job.wamid, "delivered")]).applied, 1, "önceki iletinin teslimi");
      await s.ctx.drain();
      assert.equal((await s.job(b2)).state, "accepted", "ikinci kopya gitti");
      assert.equal(s.ctx.messages().length, 2);
    } finally {
      await s.close();
    }
  });
  it("W-c1 aynı bilgisayar: YdG J2 Başarısız → Başarısızları Yeniden Dene kaynak J1 belirsizken kişiyi ELER (KARAR 31.10 08:00 'A') — üçüncü ileti yolu yok (S9-1 c, önceden var)", async () => {
    const s = await harness();
    try {
      const a = await anyway(s);
      await s.ctx.drain();
      const j2 = await s.job(a.b2);
      s.apply([failedSt(s, j2.wamid)]);
      const retry = await s.ctx.api.post(`${URLS.batches}/${a.b2}/retry-failed`, {});
      assert.equal(retry.status, 400);
      assert.deepEqual(retry.data.summary?.skipped || retry.data.data?.summary?.skipped, { "Sonucu Belirsiz": 1 });
      assert.equal(s.ctx.messages().length, 2);
    } finally {
      await s.close();
    }
  });
  it("W-c2 taşınan veride de (defter yok) YdG zincirindeki Başarısız işin yeniden denemesi kaynak belirsizken kişiyi ELER — zincir bağının taşınması (savunma) ulaşılamaz yolda (S9-1 c)", { timeout: 120_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-wc2-"));
    const dataDir = path.join(root, "data");
    let s = await harness({ dataDir });
    try {
      const a = await anyway(s);
      await s.ctx.drain();
      const j2 = await s.job(a.b2);
      s.apply([failedSt(s, j2.wamid)]);
      assert.equal((await s.job(a.b2)).state, "failed", "ön koşul: J2 Başarısız");
      await s.close();
      s = null;
      const moved = path.join(root, "tasindi");
      cpSync(dataDir, moved, { recursive: true });
      for (const name of readdirSync(moved)) if (name.startsWith("whatsapp-gonderim.sqlite")) rmSync(path.join(moved, name), { force: true });
      s = await harness({ dataDir: moved, account: false });
      const retry = await s.ctx.api.post(`${URLS.batches}/${a.b2}/retry-failed`, {});
      assert.equal(retry.status, 400, "taşınan veride de elenir");
      assert.deepEqual(retry.data.summary?.skipped || retry.data.data?.summary?.skipped, { "Sonucu Belirsiz": 1 });
      assert.equal(s.ctx.messages().length, 0);
    } finally {
      await s?.close();
      removeTestDir(root);
    }
  });
  it("T35r GERÇEK yol: istek Meta'dayken yedek + geri yükleme (toparlama 'Sonucu Belirsiz' yazar) → yanıt gelince satır Meta Kabul Etti; aynı dönem Daha Önce; kişiye 1 ileti (U4)", { timeout: 120_000 }, async () => {
    const s = await harness({ second: true, timeoutMs: 8_000 });
    try {
      const batchId = await s.batch();
      s.ctx.fake.state.delayMs = 2_500;
      const turn = s.ctx.wa.scheduler.runOnce();
      for (let i = 0; i < 400 && !s.ctx.fake.requests.some(item => item.path.endsWith("/messages")); i += 1) await wait(10);
      assert.ok(s.ctx.fake.requests.some(item => item.path.endsWith("/messages")), "ön koşul: ileti isteği Meta'da");
      const backup = await s.backup();
      await s.restore(backup);
      const mid = await s.job(batchId);
      assert.equal(mid.state, "uncertain", `ön koşul: toparlama Sonucu Belirsiz yazdı (geldi ${mid.state})`);
      await turn;
      s.ctx.fake.state.delayMs = 0;
      // Yanıtı ESKİ örnek işledi (defter A7 kabulü öğrendi); yeni örneğin satırı bakım turunda defterden çözülür.
      await s.ctx.wa.scheduler.maintain();
      const after = await s.job(batchId);
      assert.deepEqual([after.state, Boolean(after.wamid), after.reason || ""], ["accepted", true, ""], "satır Meta Kabul Etti");
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      assert.equal(s.ctx.messages().length, 1);
      assert.equal(s.apply([st(s, after.wamid, "delivered")]).applied, 1);
      assert.equal(await s.buAy(), 1);
    } finally {
      s.ctx.fake.state.delayMs = 0;
      await s.close();
    }
  });
});

// ---------- kanca üzerinden: T17 (A6) ve K0 (kilit, A5) ----------
async function hookHarness(options = {}) {
  const s = await harness(options);
  const remote = await s.ctx.server.app.listenRemote(0, "127.0.0.1");
  s.ctx.server.app.mobileRemote.setPublicUrl("http://ofis-t.destekofis.test");
  await s.ctx.server.app.context.whatsapp.connection.registerHook(null, "http://ofis-t.destekofis.test");
  const secret = new URL(s.ctx.fake.state.subscriptions.at(-1).override_callback_uri).pathname.split("/").pop();
  s.post = statuses =>
    new Promise((resolve, reject) => {
      const payload = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "902125550102", phone_number_id: PNID }, statuses } }] }] }));
      const req = http.request(`http://127.0.0.1:${remote.port}/wa/kanca/${secret}`, { method: "POST", headers: { "content-type": "application/json", "content-length": payload.length } }, res => {
        const parts = [];
        res.on("data", chunk => parts.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
      });
      req.on("error", reject);
      req.end(payload);
    });
  return s;
}
describe("2.4.8 İş T — kanca yanıtı (K0 kilit / A5, K5 istisnası / A6)", () => {
  it("T17 imzasız bildirim yanıt işlenmeden gelir (istek Meta'da) → 503; yanıt işlenince yineleme 200 ve uygulanır; bekleyen istek yokken / pencere (5 dk) dışında tanınmayan → 200; pencere içinde yabancı ileti de 503 (BİLİNEN SINIR)", { timeout: 120_000 }, async () => {
    const s = await hookHarness();
    try {
      assert.equal((await s.post([st(s, "wamid.YABANCI1", "delivered")])).status, 200, "bekleyen istek yokken yabancı ileti 200");
      const batchId = await s.batch();
      const wamid = `wamid.SAHTE${String(s.ctx.fake.state.sent + 1).padStart(4, "0")}`;
      s.ctx.fake.state.delayMs = 600; // istemci zaman aşımı 800 ms (startWa) — istek yanıtlanır, yalnız gecikir
      const turn = s.ctx.wa.scheduler.runOnce();
      for (let i = 0; i < 200 && !s.ctx.fake.requests.some(item => item.path.endsWith("/messages")); i += 1) await wait(10);
      assert.ok(s.ctx.fake.requests.some(item => item.path.endsWith("/messages")), "ön koşul: ileti isteği Meta'da");
      const early = await s.post([st(s, wamid, "delivered")]);
      assert.equal(early.status, 503, `yanıtı beklenen istek varken tanınmayan bildirim 503 (geldi ${early.status} ${early.text})`);
      assert.equal((await s.post([st(s, "wamid.YABANCI2", "delivered")])).status, 503, "pencere içinde yabancı ileti de 503 (BİLİNEN SINIR)");
      s.ctx.clock.advance(6 * 60_000);
      assert.equal((await s.post([st(s, "wamid.YABANCI3", "delivered")])).status, 200, "talep 5 dk'dan eski → 200 (pencere sınırlı)");
      assert.equal((await s.job(batchId)).state, "sending", "ön koşul: yanıt henüz işlenmedi");
      await turn;
      s.ctx.fake.state.delayMs = 0;
      assert.equal((await s.job(batchId)).state, "accepted", "yanıt işlendi");
      const again = await s.post([st(s, wamid, "delivered")]);
      assert.equal(again.status, 200);
      assert.equal((await s.job(batchId)).state, "delivered", "yinelenen bildirim uygulandı");
      assert.equal((await s.post([st(s, "wamid.YABANCI4", "delivered")])).status, 200, "talep sonuçlandı → yabancı ileti 200");
    } finally {
      await s.close();
    }
  });
  it("T-K0c ön sınamadan SONRA dosya yazımı kilide takılır → 503, defter önce yazıldı; Meta'nın yinelemesi tamamlar, Bu Ay 1 (eşgüçlü)", { timeout: 120_000 }, async () => {
    const s = await hookHarness();
    try {
      const { batchId, job } = await accepted(s);
      const store = s.ctx.store;
      const run = store.run;
      let hit = false;
      store.run = (sql, ...args) => {
        if (!hit && /^UPDATE wa_jobs SET/.test(sql) && args.includes("delivered")) {
          hit = true;
          throw Object.assign(new Error("database is locked"), { code: "ERR_SQLITE_ERROR", errcode: 5 });
        }
        return run.call(store, sql, ...args);
      };
      try {
        const first = await s.post([st(s, job.wamid, "delivered")]);
        assert.equal(first.status, 503, `yazım kilitte 503 (geldi ${first.status} ${first.text})`);
      } finally {
        store.run = run;
      }
      assert.ok(hit, "ön koşul: kilit uygulandı");
      assert.equal((await s.job(batchId)).state, "accepted", "dosya yazılamadı");
      assert.equal(s.delivered(job.id), true, "defter dosyadan ÖNCE yazıldı (A5): yarım yazımda teslim defterde");
      for (let i = 0; i < 2; i += 1) assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 200, "yineleme 200");
      assert.equal((await s.job(batchId)).state, "delivered");
      assert.equal(await s.buAy(), 1, "Bu Ay 1 (iki kez değil)");
    } finally {
      await s.close();
    }
  });
  // İş T eki (prensip §4): defter yazımı YAZIM ORTASINDA başarısız — kanca 503, dosya satırı değişmez; yineleme gelince son durum tek yazımla aynı.
  /** Defterin bir yöntemini BİR kez bozar (fn(özgün, defter dosyası, ...argümanlar)); dönüş: { hits(), restore() }. */
  const breakOnce = (s, name, fn) => {
    const ledger = s.ctx.wa.ledger;
    const original = ledger[name];
    let hits = 0;
    ledger[name] = function (...args) {
      if (hits === 0) {
        hits += 1;
        return fn(original.bind(ledger), ledger.file, ...args);
      }
      return original.apply(ledger, args);
    };
    return { hits: () => hits, restore: () => (ledger[name] = original) };
  };
  const midWriteCells = [
    ["T-K0d defter teslimi yazılamadı (false)", "delivered", "delivered", () => false],
    ["T-K0e defter teslim edilemedi yazımı fırlatır (kilit)", "deliveryFailed", "failed", () => {
      throw Object.assign(new Error("database is locked"), { code: "ERR_SQLITE_ERROR", errcode: 5 });
    }],
    ["T-K0f yazım ortasında GERÇEK defter kilidi (ön sınamadan sonra, ayrı bağlantı)", "delivered", "delivered", (original, file, row) => {
      const lock = new DatabaseSync(file);
      lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
      try {
        return original(row);
      } finally {
        lock.exec("ROLLBACK");
        lock.close();
      }
    }],
  ];
  for (const [label, method, value, fn] of midWriteCells) {
    it(`${label} → 503, dosya satırı değişmez; Meta'nın yinelemesi (×2) tamamlar — tek yazımla aynı (Bu Ay ${value === "delivered" ? 1 : 0}, accepted_at değişmez)`, { timeout: 120_000 }, async () => {
      const s = await hookHarness();
      try {
        const { batchId, job } = await accepted(s);
        const before = await s.job(batchId);
        const broken = breakOnce(s, method, fn);
        const event = value === "failed" ? failedSt(s, job.wamid) : st(s, job.wamid, "delivered");
        try {
          const first = await s.post([event]);
          assert.equal(first.status, 503, `defter yazılamadı → 503 (geldi ${first.status} ${first.text})`);
        } finally {
          broken.restore();
        }
        assert.equal(broken.hits(), 1, "ön koşul: defter yazımı bozuldu");
        const mid = await s.job(batchId);
        assert.deepEqual([mid.state, mid.acceptedAt], ["accepted", before.acceptedAt], "dosya satırı değişmedi");
        for (let i = 0; i < 2; i += 1) assert.equal((await s.post([event])).status, 200, "yineleme 200");
        const after = await s.job(batchId);
        assert.deepEqual([after.state, after.acceptedAt], [value, before.acceptedAt], "son durum tek yazımla aynı");
        assert.equal(await s.buAy(), value === "delivered" ? 1 : 0, "Bu Ay");
        if (value === "delivered") assert.equal(s.delivered(job.id), true);
        else assert.equal(s.last(job.id), "failed", "defterde teslim edilemedi");
        assert.deepEqual(await s.skip(), [value === "delivered" ? "Daha Önce Gönderildi" : "gönderilecek"]);
      } finally {
        await s.close();
      }
    });
  }
  it("T-K0a/b ön sınamada şirket dosyası ya da defter kilitli → 503, yazım yok", { timeout: 120_000 }, async () => {
    const s = await hookHarness();
    try {
      const { batchId, job } = await accepted(s);
      for (const file of [s.ctx.server.app.config.dbPath, s.ctx.wa.ledger.file]) {
        const lock = new DatabaseSync(file);
        lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
        try {
          assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 503);
        } finally {
          lock.exec("ROLLBACK");
          lock.close();
        }
        assert.equal((await s.job(batchId)).state, "accepted", "yazım yok");
        await wait(1_100); // işaret süresi (testte varsayılan 30 sn değil — guard yalnız arka plan; kanca her istekte sınar)
      }
    } finally {
      await s.close();
    }
  });
  // ---------- İş U (dar kontrol 15) ----------
  for (const [label, errcode, message] of [["SQLITE_READONLY (salt okunur)", 8, "attempt to write a readonly database"], ["SQLITE_FULL (disk dolu)", 13, "database or disk is full"]]) {
    it(`T-K0g dosya yazımında KİLİT DIŞI hata — ${label} → kanca 500 (Meta yineler), defter önce yazıldı; yineleme tamamlar, Bu Ay 1 (U3)`, { timeout: 120_000 }, async () => {
      const s = await hookHarness();
      try {
        const { batchId, job } = await accepted(s);
        const store = s.ctx.store;
        const run = store.run;
        let hit = false;
        store.run = (sql, ...args) => {
          if (!hit && /^UPDATE wa_jobs SET/.test(sql) && args.includes("delivered")) {
            hit = true;
            throw Object.assign(new Error(message), { code: "ERR_SQLITE_ERROR", errcode });
          }
          return run.call(store, sql, ...args);
        };
        try {
          const first = await s.post([st(s, job.wamid, "delivered")]);
          assert.equal(first.status, 500, `kilit dışı yazım hatası yutulmaz → 500 (geldi ${first.status} ${first.text})`);
        } finally {
          store.run = run;
        }
        assert.ok(hit, "ön koşul: hata uygulandı");
        assert.equal((await s.job(batchId)).state, "accepted", "dosya yazılamadı");
        assert.equal(s.delivered(job.id), true, "defter önce yazıldı");
        for (let i = 0; i < 2; i += 1) assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 200);
        assert.equal((await s.job(batchId)).state, "delivered");
        assert.equal(await s.buAy(), 1);
      } finally {
        await s.close();
      }
    });
  }
  it("T-K0g′ dosya yazımında wamid tekil çakışması (SQLITE_CONSTRAINT_UNIQUE) → yalnız bu yutulur: 200, satır değişmez (U3)", { timeout: 120_000 }, async () => {
    const s = await hookHarness();
    try {
      const { batchId, job } = await accepted(s);
      const store = s.ctx.store;
      const run = store.run;
      let hit = false;
      store.run = (sql, ...args) => {
        if (!hit && /^UPDATE wa_jobs SET/.test(sql) && args.includes("delivered")) {
          hit = true;
          throw Object.assign(new Error("UNIQUE constraint failed: wa_jobs.wamid"), { code: "ERR_SQLITE_ERROR", errcode: 2067 });
        }
        return run.call(store, sql, ...args);
      };
      try {
        assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 200);
      } finally {
        store.run = run;
      }
      assert.ok(hit, "ön koşul: çakışma uygulandı");
      assert.equal((await s.job(batchId)).state, "accepted", "olay düştü (satır değişmedi)");
    } finally {
      await s.close();
    }
  });
  it("T36 eşzamanlı kabul DEFTERE yazılamadı (dosyada Meta Kabul Etti + wamid) → onarılamazken gönderim başlatılmaz (503), imzasız teslim 6 dk sonra da tanınır; defter düzelince onarım: Daha Önce Gönderildi, kişiye 1 ileti (U6)", { timeout: 120_000 }, async () => {
    const s = await hookHarness();
    try {
      s.ledgerFault.on = true;
      const batchId = await s.batch();
      await s.ctx.drain();
      const job = await s.job(batchId);
      assert.deepEqual([job.state, Boolean(job.wamid)], ["accepted", true], "ön koşul: dosyada kabul");
      assert.equal(s.outcomeSql(job.id, 1), null, "ön koşul: defterde sonuç yok");
      const blocked = await s.ctx.api.post(URLS.batches, s.body);
      assert.equal(blocked.status, 503, `onarılamazken yeni gönderim başlatılmaz (geldi ${blocked.status} ${JSON.stringify(blocked.data)})`);
      s.ctx.clock.advance(6 * 60_000);
      const hook = await s.post([st(s, job.wamid, "delivered")]);
      assert.equal(hook.status, 200, `imzasız teslim tanındı (geldi ${hook.status} ${hook.text})`);
      assert.equal((await s.job(batchId)).state, "delivered");
      assert.equal(await s.buAy(), 1);
      s.ledgerFault.on = false;
      await s.ctx.drain(); // bakım: onarım
      assert.equal(s.outcomeSql(job.id, 1), "accepted", "defter onarıldı");
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      assert.equal((await s.ctx.api.post(URLS.batches, s.body)).status, 400, "yeni gönderim kişiyi eler");
      await s.ctx.drain();
      assert.equal(s.ctx.messages().length, 1, "kişiye 1 ileti");
    } finally {
      await s.close();
    }
  });
  it("T36c talepten ÖNCE onarım: 1. kişinin kabulü deftere yazılamadı → defter düzelene dek 2. kişiye gönderilmez; düzelince ikisi de tek ileti (U6)", { timeout: 120_000 }, async () => {
    const s = await hookHarness();
    try {
      const a = await ok(await s.ctx.api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", phone: "0532 111 22 33", openingBalance: "500" }), "cari 2");
      const batchId = (await ok(await s.ctx.api.post(URLS.batches, { kind: "statement", ids: [s.p.id, a.id], preset: "thisMonth" }), "toplu iş")).batch.id;
      s.ledgerFault.on = true;
      await s.ctx.wa.scheduler.runOnce();
      assert.equal(s.ctx.messages().length, 1, "ön koşul: 1. kişi gönderildi");
      for (let i = 0; i < 3; i += 1) {
        s.ctx.clock.advance(5 * 60_000);
        await s.ctx.wa.scheduler.runOnce();
      }
      assert.equal(s.ctx.messages().length, 1, "onarılamazken 2. kişiye talep yazılmadı");
      s.ledgerFault.on = false;
      s.ctx.clock.advance(5 * 60_000);
      await s.ctx.drain();
      assert.equal(s.ctx.messages().length, 2, "defter düzelince 2. kişi");
      const jobs = (await s.ctx.api.get(`${URLS.batches}/${batchId}`)).data.data.jobs;
      for (const job of jobs) assert.equal(s.outcomeSql(job.id, job.attempt), "accepted", "ikisi de defterde kabul");
    } finally {
      await s.close();
    }
  });
  it("T-K0h sahibi yalnız dosyada bulunan wamid (U6 onarım listesi) · şirket GEÇİCİ açılamıyor (geri yükleme sürüyor) → 503; açılınca 200 ve uygulanır (U6)", { timeout: 120_000 }, async () => {
    const s = await hookHarness({ second: true });
    try {
      s.ledgerFault.on = true;
      const batchId = await s.batch();
      await s.ctx.drain();
      const job = await s.job(batchId);
      assert.deepEqual([job.state, s.ctx.wa.ledger.companyOfWamid(job.wamid)], ["accepted", null], "ön koşul: sahip yalnız dosyada");
      s.ctx.clock.advance(6 * 60_000); // A6 penceresi (bekleyen talep 503'ü) dışında — 503'ü yalnız "şirket meşgul" kuralı verebilir
      assert.equal((await s.post([st(s, "wamid.YABANCI9", "delivered")])).status, 200, "ön koşul: pencere dışında, meşgul şirket yokken yabancı ileti 200");
      s.ctx.server.app.context.busyCompanies.set(s.company.id, "“002” yedekten geri yükleniyor; birkaç saniye sonra yeniden deneyin.");
      try {
        const busy = await s.post([st(s, job.wamid, "delivered")]);
        assert.equal(busy.status, 503, `geçici açılamama → 503 (geldi ${busy.status} ${busy.text})`);
      } finally {
        s.ctx.server.app.context.busyCompanies.delete(s.company.id);
      }
      assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 200);
      assert.equal((await s.job(batchId)).state, "delivered");
    } finally {
      s.ledgerFault.on = false;
      await s.close();
    }
  });
  it("T-K0h2 sahibi DEFTERDE bilinen wamid · şirket GEÇİCİ açılamıyor (geri yükleme sürüyor) → 503, yalnız defter YAZILMAZ; açılınca 200 ve satır Teslim (U6 koşul a)", { timeout: 120_000 }, async () => {
    const s = await hookHarness({ second: true });
    try {
      const batchId = await s.batch();
      await s.ctx.drain();
      const job = await s.job(batchId);
      assert.equal(s.ctx.wa.ledger.companyOfWamid(job.wamid)?.companyId, s.company.id, "ön koşul: sahip defterde");
      s.ctx.server.app.context.busyCompanies.set(s.company.id, "“002” yedekten geri yükleniyor; birkaç saniye sonra yeniden deneyin.");
      try {
        const busy = await s.post([st(s, job.wamid, "delivered")]);
        assert.equal(busy.status, 503, `geçici açılamama → 503 (geldi ${busy.status} ${busy.text})`);
        assert.equal(s.deliveredSql(job.id), false, "geçicide yalnız defter yolu YOK");
      } finally {
        s.ctx.server.app.context.busyCompanies.delete(s.company.id);
      }
      assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 200);
      assert.equal((await s.job(batchId)).state, "delivered");
    } finally {
      await s.close();
    }
  });
  for (const kind of ["silinmiş", "veri dosyası yok"]) {
    it(`T-Ksil şirket ${kind} (KALICI) · wamid'ine delivered → 200 + yalnız defter teslim (o deneme); yinelenen etkisiz (onaylı koşul a)`, { timeout: 120_000 }, async () => {
      const s = await hookHarness({ second: true });
      try {
        const batchId = await s.batch();
        await s.ctx.drain();
        const job = await s.job(batchId);
        assert.equal(job.state, "accepted", "ön koşul: kabul");
        if (kind === "silinmiş") {
          const del = await s.ctx.api.raw("DELETE", `/api/companies/${s.company.id}`, { body: JSON.stringify({ confirm: s.company.code, password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } });
          assert.equal(del.status, 200, `ön koşul: şirket silindi (geldi ${del.status})`);
        } else {
          s.ctx.server.app.context.closeCompany(s.company.id);
          const root = path.join(s.ctx.server.app.config.dataDir, "sirketler");
          const dirs = readdirSync(root);
          assert.equal(dirs.length, 1, "ön koşul: tek ek şirket klasörü");
          const file = resolveDbPath(path.join(root, dirs[0]));
          assert.ok(existsSync(file), "ön koşul: veri dosyası var");
          for (const suffix of ["", "-wal", "-shm"]) if (existsSync(file + suffix)) renameSync(file + suffix, `${file + suffix}.yok`);
        }
        const res = await s.post([st(s, job.wamid, "delivered")]);
        assert.equal(res.status, 200, `kalıcı açılamama → 200 (geldi ${res.status} ${res.text})`);
        assert.equal(s.deliveredSql(job.id), true, "defterde teslim");
        assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 200, "yinelenen 200");
      } finally {
        await s.close().catch(() => {});
      }
    });
  }
  // ---------- İş V (dar kontrol 16) ----------
  /** İkinci şirketin veri dosyasını yerinden alır (kalıcı yokluk); dönüş: geri koyan işlev. */
  const hideCompanyFile = s => {
    s.ctx.server.app.context.closeCompany(s.company.id);
    const root = path.join(s.ctx.server.app.config.dataDir, "sirketler");
    const file = resolveDbPath(path.join(root, readdirSync(root)[0]));
    const moved = [];
    for (const suffix of ["", "-wal", "-shm"]) {
      if (existsSync(file + suffix)) {
        renameSync(file + suffix, `${file + suffix}.yok`);
        moved.push(file + suffix);
      }
    }
    assert.ok(moved.length, "ön koşul: veri dosyası yerinden alındı");
    return () => {
      for (const name of moved) renameSync(`${name}.yok`, name);
    };
  };
  for (const code of [131026, 131049]) {
    it(`T-Ksil-F${code === 131049 ? "49" : ""} veri dosyası YOK (kalıcı) · imzasız failed ${code} → 200 + defterde teslim edilemedi; dosya geri gelince kişi "gönderilecek" (V1 i, K4)`, { timeout: 120_000 }, async () => {
      const s = await hookHarness({ second: true });
      try {
        const batchId = await s.batch();
        await s.ctx.drain();
        const job = await s.job(batchId);
        assert.equal(job.state, "accepted", "ön koşul: kabul");
        const putBack = hideCompanyFile(s);
        const res = await s.post([failedSt(s, job.wamid, code)]);
        assert.equal(res.status, 200, `kalıcı açılamama → 200 (geldi ${res.status} ${res.text})`);
        assert.equal(s.ledgerSql("SELECT COUNT(*) AS n FROM failures WHERE job_id = ? AND attempt = 1", job.id).n, 1, "defterde teslim edilemedi");
        putBack();
        assert.deepEqual(await s.skip(), ["gönderilecek"], "kesin almadı → sayılmaz (ilke 1)");
      } finally {
        await s.close().catch(() => {});
      }
    });
  }
  it("T-Ksil-D+geri veri dosyası YOK · delivered → 200 + defter teslim; dosya geri gelince Daha Önce, Bu Ay 1; süre dolumu satırı Teslim Edildi yapar (Süresi Doldu / teslim edilemedi YOK) (V1 + V2)", { timeout: 120_000 }, async () => {
    const s = await hookHarness({ second: true });
    try {
      const batchId = await s.batch();
      await s.ctx.drain();
      const job = await s.job(batchId);
      const putBack = hideCompanyFile(s);
      assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 200);
      putBack();
      assert.equal((await s.job(batchId)).state, "accepted", "ön koşul: dosya geri geldi, satır Meta Kabul Etti");
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
      assert.equal(await s.buAy(), 1);
      await expire(s, job.wamid);
      assert.equal((await s.job(batchId)).state, "delivered", "süre dolumu teslimi gördü");
      assert.equal(s.ledgerSql("SELECT COUNT(*) AS n FROM failures WHERE job_id = ?", job.id).n, 0, "teslim edilemedi yazılmadı");
      assert.equal(await s.buAy(), 1, "Bu Ay çift saymaz");
    } finally {
      await s.close().catch(() => {});
    }
  });
  it("T-Kgecici şirket açılmamışken veri dosyası BAŞKA SÜREÇTE kilitli → 503 (geçici); kilit kalkınca yineleme 200 ve Teslim Edildi (V1 ii, V6 mD)", { timeout: 120_000 }, async () => {
    const s = await hookHarness({ second: true });
    try {
      const batchId = await s.batch();
      await s.ctx.drain();
      const job = await s.job(batchId);
      s.ctx.server.app.context.closeCompany(s.company.id);
      const root = path.join(s.ctx.server.app.config.dataDir, "sirketler");
      const lock = new DatabaseSync(resolveDbPath(path.join(root, readdirSync(root)[0])));
      lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
      try {
        const res = await s.post([st(s, job.wamid, "delivered")]);
        assert.equal(res.status, 503, `kilitli dosya geçicidir → 503 (geldi ${res.status} ${res.text})`);
        assert.equal(s.deliveredSql(job.id), false, "yalnız defter yolu YOK");
      } finally {
        lock.exec("ROLLBACK");
        lock.close();
      }
      assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 200);
      assert.equal((await s.job(batchId)).state, "delivered");
    } finally {
      await s.close().catch(() => {});
    }
  });
  it("T-Kbozuk şirket açılmamışken veri dosyası BOZUK (veri tabanı değil) → 503 (geçici; düzeltilince uygulanır); dosya düzelince yineleme 200 ve Teslim (V1 ii)", { timeout: 120_000 }, async () => {
    const s = await hookHarness({ second: true });
    try {
      const batchId = await s.batch();
      await s.ctx.drain();
      const job = await s.job(batchId);
      const putBack = hideCompanyFile(s); // asıl dosya kenara; yerine bozuk dosya
      const root = path.join(s.ctx.server.app.config.dataDir, "sirketler");
      const file = resolveDbPath(path.join(root, readdirSync(root)[0]));
      writeFileSync(file, "bu bir veri tabanı değil — bozuk dosya ".repeat(200));
      try {
        const res = await s.post([st(s, job.wamid, "delivered")]);
        assert.equal(res.status, 503, `bozuk dosya geçicidir → 503 (geldi ${res.status} ${res.text})`);
        assert.equal(s.deliveredSql(job.id), false, "yalnız defter yolu YOK");
      } finally {
        s.ctx.server.app.context.closeCompany(s.company.id);
        rmSync(file, { force: true });
        for (const suffix of ["-wal", "-shm"]) rmSync(file + suffix, { force: true });
        putBack();
      }
      assert.equal((await s.post([st(s, job.wamid, "delivered")])).status, 200);
      assert.equal((await s.job(batchId)).state, "delivered");
    } finally {
      await s.close().catch(() => {});
    }
  });
  it("T-restore-F geri yükleme SÜRERKEN (busyCompanies) gelen failed → 503 → yineleme 200: Başarısız, gönderilecek (onaylı koşul a)", { timeout: 120_000 }, async () => {
    const s = await hookHarness({ second: true });
    try {
      const batchId = await s.batch();
      await s.ctx.drain();
      const job = await s.job(batchId);
      s.ctx.server.app.context.busyCompanies.set(s.company.id, "“002” yedekten geri yükleniyor; birkaç saniye sonra yeniden deneyin.");
      try {
        assert.equal((await s.post([failedSt(s, job.wamid)])).status, 503);
        assert.equal(s.ledgerSql("SELECT COUNT(*) AS n FROM failures WHERE job_id = ?", job.id).n, 0, "geri yükleme sürerken yazım yok");
      } finally {
        s.ctx.server.app.context.busyCompanies.delete(s.company.id);
      }
      assert.equal((await s.post([failedSt(s, job.wamid)])).status, 200);
      assert.equal((await s.job(batchId)).state, "failed");
      assert.deepEqual(await s.skip(), ["gönderilecek"]);
    } finally {
      await s.close();
    }
  });
});
