// 2.5.0 WhatsApp tur 3 HIZ — EŞDEĞERLİK + KORUMA (docs/erp/WA-TUR3-TASARIM.md §14; BAŞ MİMAR KARARI 11.11 11:21 "100 BİN SATIRLIK HIZ ÖLÇÜMÜ"; ders 47: hız düzeltmesi eşdeğerlik
// testiyle, davranış AYNI). REFERANS = tur 3'ün bildirim-başına GERÇEK kodu (sinama-wa3 028e1b76): test/wa3hiz-250/senaryo.mjs o kodun `git archive` kopyasına konup koşuldu (uret.mjs);
// çıktısı test/fixtures/wa3hiz-250/tur3-028e1b76.json (ders 5 / 6 / 23 / 51 — programla aynı elden çıkan model DEĞİL, eski kodun kendisi). Senaryo mutlak saatle başlar → çıktı iki saat diliminde
// aynı (fikstür UTC ve Europe/Istanbul'da ayrı üretilip karşılaştırıldı: fark 0). Gerçek program + sahte Meta + sahte saat (ders 13) + ölü lisans adresi (ders 30).
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PNID, startWa } from "./whatsapp-248-ortak.mjs";
import { runScenario } from "./wa3hiz-250/senaryo.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const FIXTURE = JSON.parse(readFileSync(path.join(HERE, "fixtures", "wa3hiz-250", "tur3-028e1b76.json"), "utf8"));
const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };

/** İlk farklı yollar (teşhis için; karşılaştırmanın kendisi deepEqual). */
function differences(a, b, at = "", out = []) {
  if (out.length >= 12) return out;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || a === null || b === null || typeof a !== "object") {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${at}: beklenen ${JSON.stringify(b)?.slice(0, 160)} ↔ program ${JSON.stringify(a)?.slice(0, 160)}`);
    return out;
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) differences(a[key], b[key], `${at}.${key}`, out);
  return out;
}

describe("2.5.0 WhatsApp tur 3 hız — eşdeğerlik: aynı tohumlu bildirim dizisi tur 3'ün bildirim-başına GERÇEK koduyla AYNI sonucu verir (iş durumları, atlanma nedenleri, defter, işaretler, Bu Ay)", () => {
  assert.equal(FIXTURE.kaynak, "sinama-wa3 028e1b76", "fikstür tur 3'ün gerçek kodundan");
  for (const seed of Object.keys(FIXTURE.senaryolar)) {
    it(`W3H-E tohum ${seed}: zincir / J10 / eski deneme / dizinin ortasında yeni zincir / zincirli yeniden dene / başka bağlantının yazımı / iki şirket / aynı çağrıda çift bildirim`, { timeout: 240_000 }, async () => {
      const expected = FIXTURE.senaryolar[seed];
      const actual = await runScenario({ seed: Number(seed) });
      // Dişin ön koşulu: senaryo gerçekten S70 yolunu yürüyor (zincir işi Atlandı → Teslim Edildi / Okundu, dizinin ORTASINDA açılan zincirde ve başka bağlantının yazımında da).
      const settled = expected.steps.flatMap(step => Object.values(step.changed || {})).filter(value => /^(delivered|read)\|/.test(value)).length;
      assert.ok(settled >= 5, `ön koşul: fikstürde Atlandı → Teslim Edildi / Okundu geçişi var (${settled})`);
      assert.deepEqual(actual, expected, `tur 3 ile fark:\n${differences(actual, expected).join("\n")}`);
    });
  }
});

describe("2.5.0 WhatsApp tur 3 hız — koruma", () => {
  it("W3H-K1 inherit_of'a yazan deyim server/ altında yalnız queue.mjs createBatch'te (2 yer) ve aynı işlemde zincir kaynak kümesi düşürülüyor — yeni yazar eklenirse küme ÜST KÜME olmaktan çıkar", () => {
    const files = [];
    const walk = dir => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.m?js$/.test(name)) files.push(full);
      }
    };
    walk(path.join(ROOT, "server"));
    const writers = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/^\s*\/\//.test(line)) return;
        if (/SET\s+(?:[\w\s=?,]*,\s*)?inherit_of\s*=|INSERT\s+INTO\s+wa_jobs\s*\([^)]*inherit_of|inherit_of\s*:/i.test(line)) writers.push({ file: path.relative(ROOT, file).split(path.sep).join("/"), index, lines });
      });
    }
    assert.deepEqual(writers.map(item => item.file), ["server/lib/whatsapp/queue.mjs", "server/lib/whatsapp/queue.mjs"], `inherit_of yazarları: ${JSON.stringify(writers.map(item => `${item.file}:${item.index + 1}`))}`);
    const [first, second] = writers;
    const block = first.lines.slice(first.index, second.index + 6).join("\n");
    assert.match(block, /if \(inherit \|\| chain\.length\) forgetChainSources\(\);\s*\n\s*\}\);/, "iki yazımın hemen ardından, aynı işlemin içinde küme düşürülüyor");
    // Göç (migrations.mjs addColumn) çalışma anı yazarı değildir — kuyruk açılmadan önce koşar.
    assert.match(readFileSync(path.join(ROOT, "server/lib/migrations.mjs"), "utf8"), /addColumn\(store, "wa_jobs", "inherit_of"/);
  });

  it("W3H-K2 zincirsiz olağan veride (ölçümün yolu) teslim / okundu bildirimi carinin zincir okumasını YAPMAZ; kaynak kümesi bir kez kurulur (ders 47: bildirim başına ek okuma yok)", { timeout: 120_000 }, async () => {
    const ctx = await startWa({ env: DEAD, now: { time: "2026-11-03T06:00:00.000Z", fixed: true } });
    try {
      const ids = [];
      for (let i = 0; i < 6; i += 1) ids.push((await ctx.account(`Olağan ${i}`, `0546 60${i} 00 0${i}`, 300)).id);
      const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
      assert.equal(res.status, 200);
      await ctx.drain();
      const jobs = ctx.store.all("SELECT id, wamid, state FROM wa_jobs ORDER BY rowid");
      assert.deepEqual(jobs.map(job => job.state), Array(6).fill("accepted"), "ön koşul: altı ileti Meta Kabul Etti");
      const seen = { chain: 0, sources: 0 };
      const all = ctx.store.all;
      ctx.store.all = (sql, ...args) => {
        if (/FROM wa_jobs WHERE account_id = \? AND inherit_of <> ''/.test(sql)) seen.chain += 1;
        if (/SELECT DISTINCT inherit_of/.test(sql)) seen.sources += 1;
        return all(sql, ...args);
      };
      try {
        const ts = String(Math.floor(ctx.clock.ms() / 1000));
        for (const job of jobs) ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: ts, recipient_id: "905000000000" }], { phoneNumberId: PNID });
        const out = ctx.statuses(jobs.map(job => ({ id: job.wamid, status: "read", timestamp: ts, recipient_id: "905000000000" })), { phoneNumberId: PNID });
        assert.equal(out.applied, 6, "altı okundu tek çağrıda işlendi");
      } finally {
        ctx.store.all = all;
      }
      assert.deepEqual(ctx.store.all("SELECT state FROM wa_jobs ORDER BY rowid").map(row => row.state), Array(6).fill("read"), "durumlar AYNEN işlendi");
      assert.deepEqual(seen, { chain: 0, sources: 1 }, "12 bildirimde cari zincir okuması 0, kaynak kümesi 1 kez (tur 3: 12 cari okuması)");
    } finally {
      await ctx.close();
    }
  });
});
