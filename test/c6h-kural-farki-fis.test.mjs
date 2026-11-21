// 2.5.0 Ç6-HESAP tur 4 — ORTA-2 (dar kontrol docs/devir/2.5.0-DEVAM/dk-c6h-rapor.md; BAŞ MİMAR KARARI 21.11 09:49 (2) metin seçimi + 10:19 (c) hız; tasarım docs/erp/C6-HESAP-TASARIM.md §11.2):
// Kural Farkı Düzeltme Fişi yazıldıktan sonra mali tabloların "Kural Değişikliği Farkı". Kurgu dar kontrolün s2'si: v2.4.9'un GERÇEK koduyla üretilmiş KİLİTLİ fikstür (kilit 30.06.2026; bugün
// 20.10.2026) → fiş programın KENDİ ucuyla (POST /api/admin/ledger/rule-diff-correction; tarih 01.07.2026). BEKLENEN (karar metninden): t ≥ fiş günü Bilanço'da neden YOK, yerine bilgi satırı
// "Kural Farkı Düzeltildi (Fiş 2026-000001)" — Yönetim "kalan 0" (rule-diff-nothing) ile AYNI; fişten önceki t'lerin tabloları AYNEN (neden dahil); Aktif = Pasif her t'de; Gelir Tablosu'nda fiş
// dönemin içindeyse neden düşer, dışındaysa AYNEN. KALAN ≠ 0: kasa sınıfında fişten sonra kilit 31.12.2025'e geri çekilir → fişin 770 / 770.90 satırı FAZLA (elle: 2026'nın donmuş 770'i çözüldü,
// güncel 770.90 300,00 + fişin 770.90 300,00) → neden KALAN ile "770: 300,00 TL" + "770 (770.90): −300,00 TL" = Yönetim ön izlemesinin satırları. Ters kayıt (taksit): ters kaydın gününden sonra
// neden geri gelir, arada bilgi satırı. EŞDEĞERLİK (hızlı yol ↔ Yönetim): kapsamın tamamının periodRuleDiff'i = snapshots.ruleDiff().balances; anahtar başına sahte maddeyle plan = gerçek maddelerle
// plan (satırlar, dışlananlar, fazla); postedCorrectionsAt(uzak gelecek) = postedRuleDiffCorrections. Eski kodda (5ee4d99e) kırmızı: fişten sonra neden aynı tutarlarla sürer.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { waitForFreeze } from "./fixtures/donma-bekle.mjs";
// Ad alanıyla (eski kodda — 5ee4d99e — yeni işlevler yok: dosya yine yüklenir, API sınamaları beklenen nedenle kırmızı olur; eşdeğerlik "işlev yok" der).
import * as financial from "../server/lib/financial-statements.mjs";
import { postedRuleDiffCorrections, ruleDiffCorrectionPlan, ruleDiffCorrectionYear } from "../server/lib/ledger-opening.mjs";
import { frozenSums } from "../server/lib/ledger-snapshots.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "fixtures", "c6h-v249");
const FS = "/api/workspace/financial-statements";
const OLD = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const reasonOf = out => out.kesinDegil.find(row => row.kod === "kural-farki") || null;
const noRule = out => JSON.stringify({ ...out, kesinDegil: out.kesinDegil.filter(row => row.kod !== "kural-farki").map(row => row.kod), bilgi: undefined });
const tl = minor => {
  const abs = Math.abs(minor);
  return `${minor < 0 ? "−" : ""}${String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(abs % 100).padStart(2, "0")} TL`;
};
const lineText = line => `${line.account}${line.sub ? ` (${line.sub})` : ""}: ${tl(line.debit - line.credit)}`;

async function withFixture(sinif, fn) {
  const root = mkdtempSync(path.join(tmpdir(), `c6h4-fis-${sinif}-`));
  const dataDir = path.join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, `${sinif}-kilitli.sqlite.gz`))));
  copyFileSync(path.join(DIR, `${sinif}-kilitli.sirketler.json`), path.join(dataDir, "sirketler.json"));
  const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: OLD.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  try {
    await server.app.ledger.snapshots.runPending();
    assert.equal(server.app.ledger.snapshots.state().coverage, "2026-06-30", `ön koşul: ${sinif} 30.06.2026 dondu`);
    const client = await loginAdmin(server);
    const get = async url => {
      const res = await client.get(url);
      assert.equal(res.status, 200, `${sinif} · ${url}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return unwrap(res);
    };
    await fn({ get, client, server });
  } finally {
    await server.close();
    removeTestDir(root);
  }
}

/** Hızlı yol ↔ Yönetim'in planı (aynı süreç, aynı veri): girdinin toplamları ve plan BİREBİR. */
function assertSameAsAdmin(server, label) {
  for (const name of ["frozenPartOf", "periodRuleDiff", "postedCorrectionsAt", "ruleDiffRemainder"]) assert.equal(typeof financial[name], "function", `${name} işlevi yok`);
  const { frozenPartOf, periodRuleDiff, postedCorrectionsAt, ruleDiffRemainder } = financial;
  const { store } = server.app;
  const ledger = server.app.ledger;
  const state = ledger.snapshots.state();
  const live = ledger.build();
  const fast = periodRuleDiff({ frozen: [], frozenSums: frozenPartOf(frozenSums(store, { from: "", through: state.coverage })), live, from: "", to: state.coverage, accounts: () => true, party: true });
  const slow = ledger.snapshots.ruleDiff({ live, detail: true });
  assert.deepEqual(fast.balances, slow.balances, `${label}: kapsamın tamamının periodRuleDiff'i = snapshots.ruleDiff().balances`);
  const subledger = new Set(Object.keys(ledger.expected([], [], { every: true })));
  const year = ruleDiffCorrectionYear({ lock: state.lock, cover: state.coverage });
  const posted = postedRuleDiffCorrections(store);
  const real = ruleDiffCorrectionPlan({ diff: slow, subledger, year, postedByYear: posted.byYear });
  const synthetic = ruleDiffCorrectionPlan({ diff: { entries: fast.balances.map((row, index) => ({ id: `k${index}`, deltas: [{ year: row.year, account: row.account, sub: row.sub, party: row.party, minor: row.differenceMinor }] })) }, subledger, year, postedByYear: posted.byYear });
  assert.deepEqual([synthetic.lines, synthetic.excluded, synthetic.ownYearOver], [real.lines, real.excluded, real.ownYearOver], `${label}: anahtar başına plan = madde madde plan`);
  const at = postedCorrectionsAt(store, "9999-12-31");
  assert.deepEqual([at.any, at.byYear, at.active], [posted.any, posted.byYear, posted.active], `${label}: postedCorrectionsAt(uzak gelecek) = postedRuleDiffCorrections`);
  const remainder = ruleDiffRemainder({ diff: fast, posted: at, subledger, lock: state.lock, cover: state.coverage });
  if (remainder) assert.deepEqual(remainder.lines, real.lines, `${label}: KALAN satırları = Yönetim planının satırları`);
  return { real, remainder };
}

async function postCorrection(client, get, sinif, n = 1) {
  const view = await get("/api/admin/ledger/rule-diff-correction");
  assert.equal(view.disabled, false, `${sinif}: fiş yazılabilir (${view.code})`);
  const res = await client.post("/api/admin/ledger/rule-diff-correction", { requestId: `c6h4-istek-${sinif}-000000000${n}`, digest: view.digest, confirm: true });
  assert.equal(res.status, 200, `${sinif}: fiş ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return { view, voucher: unwrap(res).voucher };
}

const READS = {
  bs0630: `${FS}/balance-sheet?date=2026-06-30`, bs0701: `${FS}/balance-sheet?date=2026-07-01`, bsNow: `${FS}/balance-sheet?date=2026-10-20`, bs1231: `${FS}/balance-sheet?date=2025-12-31`,
  gt25: `${FS}/income-statement?from=2025-01-01&to=2025-12-31`, gt26a: `${FS}/income-statement?from=2026-01-01&to=2026-06-30`, gt26: `${FS}/income-statement?from=2026-01-01&to=2026-10-20`,
  gt26b: `${FS}/income-statement?from=2026-07-01&to=2026-10-20`,
};
const readAll = async get => Object.fromEntries(await Promise.all(Object.entries(READS).map(async ([key, url]) => [key, await get(url)])));

describe("2.5.0 Ç6-HESAP tur 4 — ORTA-2: Kural Farkı Düzeltme Fişi'nden sonra Kesin Değil (Yönetim'in KALAN'ı)", () => {
  for (const sinif of ["kasa", "satis-fatura", "banka", "taksit"]) {
    it(`${sinif}: fişten sonra t ≥ fiş günü neden yok + bilgi satırı (Yönetim kalan 0); fişten önceki t'ler AYNEN; Aktif = Pasif`, { timeout: 300_000 }, async () => {
      await withFixture(sinif, async ({ get, client }) => {
        const before = await readAll(get);
        assert.ok(reasonOf(before.bsNow), `${sinif}: fişten önce bugünkü Bilanço'da neden var`);
        for (const out of Object.values(before)) assert.equal(out.bilgi, undefined, "fişsiz yanıtta bilgi alanı yok (yanıt eskisi gibi)");
        const { view, voucher } = await postCorrection(client, get, sinif);
        assert.equal(voucher.date || view.date, "2026-07-01");
        const admin = await get("/api/admin/ledger/rule-diff-correction");
        assert.deepEqual([admin.lines.length, admin.code], [0, "rule-diff-nothing"], `${sinif}: Yönetim kalan 0`);
        const after = await readAll(get);
        for (const key of ["bsNow", "bs0701"]) {
          assert.equal(reasonOf(after[key]), null, `${sinif} ${key}: neden düştü`);
          assert.deepEqual(after[key].bilgi?.map(row => [row.kod, row.baslik]), [["kural-farki-duzeltildi", "Kural Farkı Düzeltildi (Fiş 2026-000001)"]], `${sinif} ${key}: bilgi satırı`);
        }
        for (const key of ["bs0630", "bs1231", "gt25", "gt26a"]) assert.deepEqual(after[key], before[key], `${sinif} ${key}: fişten önceki tarih / fişi içermeyen dönem AYNEN (neden dahil)`);
        for (const key of ["bs0630", "bs0701", "bsNow", "bs1231"]) assert.equal(after[key].toplamlar.farkMinor, 0, `${sinif} ${key}: Aktif = Pasif`);
        const pl = view.lines.filter(line => /^[67]/.test(line.account)).reduce((sum, line) => sum + line.credit - line.debit, 0);
        assert.equal(after.gt26b.subtotals.donemNetKari - before.gt26b.subtotals.donemNetKari, pl, `${sinif}: fişin dönemindeki kâr farkı = fişin 6 / 7 neti`);
        assert.equal(pl, 0, "programın yolunda 6 / 7 neti 0");
        // Gelir Tablosu fişi içeren dönem: neden (varsa) düşer + bilgi; fişin dönemi dışı AYNEN (yukarıda).
        if (reasonOf(before.gt26)) {
          assert.equal(reasonOf(after.gt26), null, `${sinif}: GT 2026 (fiş içinde) neden düştü`);
          assert.equal(after.gt26.bilgi?.[0]?.kod, "kural-farki-duzeltildi");
        } else assert.equal(after.gt26.bilgi, undefined, `${sinif}: GT 2026'da ham neden yoksa bilgi satırı da yok`);
        assert.equal(after.gt26.subtotals.donemNetKari - before.gt26.subtotals.donemNetKari, pl, `${sinif}: GT 2026 dönem net kârı farkı = fişin 6 / 7 neti`);
        assert.equal(noRule(after.bs0630), noRule(before.bs0630), "fişten önceki gün: neden dışında da aynı");
      });
    });
    it(`${sinif}: hızlı yol ↔ Yönetim planı EŞDEĞER (fişten önce ve sonra)`, { timeout: 300_000 }, async () => {
      await withFixture(sinif, async ({ get, client, server }) => {
        assertSameAsAdmin(server, `${sinif} fişten önce`);
        await postCorrection(client, get, sinif);
        const { remainder } = assertSameAsAdmin(server, `${sinif} fişten sonra`);
        assert.deepEqual([remainder.exact, remainder.corrected, remainder.vouchers], [true, true, ["Fiş 2026-000001"]]);
      });
    });
  }

  it("kasa: fişten sonra kilit 31.12.2025'e geri çekilir → fişin 770 / 770.90 satırı fazla → neden KALAN ile (Yönetim ön izlemesinin satırları)", { timeout: 300_000 }, async () => {
    await withFixture("kasa", async ({ get, client, server }) => {
      await postCorrection(client, get, "kasa");
      const put = await client.put("/api/admin/period-lock", { lockedUntil: "2025-12-31" });
      assert.equal(put.status, 200, JSON.stringify(put.data).slice(0, 300));
      await waitForFreeze(client);
      assert.equal(server.app.ledger.snapshots.state().coverage, "2025-12-31", "kapsam indi");
      const admin = await get("/api/admin/ledger/rule-diff-correction");
      assert.deepEqual(admin.lines.map(line => [line.account, line.sub, line.debit, line.credit]), [["770", "", 30000, 0], ["770", "770.90", 0, 30000]], "Yönetim: fazla düzeltmenin tersi önerilir (ELLE)");
      const bs = await get(`${FS}/balance-sheet?date=2026-10-20`);
      const reason = reasonOf(bs);
      assert.deepEqual(reason?.ayrinti, admin.lines.map(lineText), "neden KALAN tutarla (Yönetim'in satırları)");
      assert.deepEqual(reason.ayrinti, ["770: 300,00 TL", "770 (770.90): −300,00 TL"]);
      assert.match(reason.aciklama, /Kural Farkı Düzeltme Fişi'yle kapanmamış kısmı/);
      assert.equal(bs.bilgi, undefined);
      assert.equal(bs.toplamlar.farkMinor, 0);
      const gt = await get(`${FS}/income-statement?from=2025-01-01&to=2025-12-31`);
      assert.deepEqual(reasonOf(gt)?.ayrinti, ["2025 · 649: 1.000,00 TL", "2025 · 649 (649.90): −1.000,00 TL"], "kilitli 2025 (fiş dışında): ham fark AYNEN");
      const { remainder } = assertSameAsAdmin(server, "kasa kilit geri çekildi");
      assert.deepEqual([remainder.exact, remainder.corrected], [true, false]);
    });
  });

  it("taksit: fiş ters kaydedilince ters kaydın gününden itibaren neden geri gelir; fiş ile ters kayıt arasında bilgi satırı", { timeout: 300_000 }, async () => {
    await withFixture("taksit", async ({ get, client }) => {
      const before = await get(`${FS}/balance-sheet?date=2026-10-20`);
      const { voucher } = await postCorrection(client, get, "taksit");
      const res = await client.post(`/api/admin/ledger/vouchers/${voucher.id}/reverse`, { requestId: "c6h4-ters-taksit-0000000001", date: "2026-10-20" });
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      const back = await get(`${FS}/balance-sheet?date=2026-10-20`);
      assert.deepEqual(reasonOf(back), reasonOf(before), "ters kayıttan sonra ham neden AYNEN");
      assert.equal(back.bilgi, undefined);
      const between = await get(`${FS}/balance-sheet?date=2026-10-19`);
      assert.equal(reasonOf(between), null, "fiş ile ters kayıt arası: neden yok");
      assert.equal(between.bilgi?.[0]?.baslik, "Kural Farkı Düzeltildi (Fiş 2026-000001)");
      for (const out of [back, between]) assert.equal(out.toplamlar.farkMinor, 0);
    });
  });
});
