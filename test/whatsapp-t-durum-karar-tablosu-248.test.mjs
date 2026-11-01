// 2.4.8 İş T (dar kontrol 14) — DURUM BİLDİRİMİ KARAR TABLOSU (tasarım notu tasarim-t-248, onaylı; hücreler YALNIZ ilkeden + karar metinlerinden yazıldı). Her ulaşılabilir hücre
// bir alt test: kurulum (kabul / kabul dosyaya yazılamadı / belirsiz / Meta Bekletti / Süresi Doldu / sıfırlama / geri yükleme / taşıma / istek Meta'da / kilit) → bildirim
// → denetim (dosya satırı, defter son sonucu ve teslim, Bu Ay sayacı, sonraki gönderimde eleme, uygulama sonucu ya da kanca yanıtı).
// Kurallar: K0 kilitte 503 (yazım sırasında da) · K1 yalnız ileri, teslimden sonra failed yok sayılır, Süresi Doldu'yu geç teslim geçer (P3) · K2 bildirim yalnız wamid'in
// denemesini etkiler (eski 131049 denemesinin geç teslimi sayılır — K10:10/K11:00) · K3 satır o denemede sonucunu bilmiyorsa olağan yol (imzalı ve imzasız) · K4 satır o denemeyi
// bilmiyorsa yalnız defter · K5 bağsız: imzalı + iş kimliği Q yolu, imzasız tanınmaz (P5); yanıtı beklenen istek varken 503 · K6 accepted_at = defterdeki kabul anı ·
// K7 başarılı geçişte hata alanları temizlenir (§7a 32) · K8 toparlamanın "uncertain"ı sonraki kabulü yutmaz · eşgüçlülük (aynı bildirim ×2/×3, 503 sonrası yineleme).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
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
async function harness({ second = false, dataDir = null, account = true } = {}) {
  const fault = { on: false };
  const ctx = await startWa({ maxCompanies: 2, now: NOW, ...(dataDir ? { dataDir } : {}), whatsappFault: point => fault.on && point === "db-accept" });
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
      await turn;
      s.ctx.fake.state.delayMs = 0;
      const wamid = s.ctx.messages().at(-1).wamid;
      assert.equal(s.ctx.server.app.whatsapp.ledger.attemptOfWamid(wamid)?.jobId, job.id, "kabul defterde öğrenildi (wamid bağlı)");
      assert.equal(s.apply([st(s, wamid, "delivered")]).applied, 1, "sonraki bildirim tanındı");
      assert.deepEqual(await s.skip(), ["Daha Önce Gönderildi"]);
    } finally {
      await s.close();
    }
  });
});

// ---------- kanca üzerinden: T17 (A6) ve K0 (kilit, A5) ----------
async function hookHarness() {
  const s = await harness();
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
});
