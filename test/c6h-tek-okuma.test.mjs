// 2.5.0 Ç6-HESAP tur 5 — HIZ (BAŞ MİMAR KARARI 21.11 13:59 (1) seçenek (b); tasarım docs/erp/C6-HESAP-TASARIM.md §11.6): Kural Farkı Düzeltme Fişi'nden sonraki KALAN'ın kapsam okuması tablonun
// KENDİ donmuş toplam okumasıyla TEK çağrıda (frozenSums ruleThrough). DAVRANIŞ DEĞİŞMEZ → EŞDEĞERLİK: tur 4'ün iki okumalı yolu (f73f4f5a'nın incomeStatementOf / balanceSheetOf gövdesi, aynı
// dışa açık işlevlerle) burada BAŞVURU olarak yazılıdır; yeni kodun Gelir Tablosu ve Bilanço çıktısı onunla BAYT BAYT aynı olmalı (JSON). Kurgu: v2.4.9'un GERÇEK koduyla üretilmiş 13 KİLİTLİ
// fikstür (kilit 30.06.2026) × fişten önce / fişten sonra (programın ucuyla) / kilit 30.09.2026'ya ilerletilince (through < kapsam, fiş kapsamın içinde) + kasa: kilit 31.12.2025'e geri (KALAN ≠ 0)
// + taksit: fiş ters kaydı. Parça düzeyinde: tek çağrının groups / entries / firstSeen'i eski okumayla aynı; fullRuleDiff = tur 4'ün kapsam okumasının periodRuleDiff'i.
// Tur 4 kodunda (f73f4f5a) kırmızı: frozenSums'te ruleThrough / outside, fullRuleDiff dışa açık işlevi yok.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { waitForFreeze } from "./fixtures/donma-bekle.mjs";
import { bookTypeOf } from "../server/lib/book-type.mjs";
import * as financial from "../server/lib/financial-statements.mjs";
import { frozenSums } from "../server/lib/ledger-snapshots.mjs";
import { createStockValuation, loadValuationInput } from "../server/lib/stock-valuation.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "fixtures", "c6h-v249");
const OLD = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
const CLASSES = Object.keys(OLD.siniflar);
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const dayAfter = day => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
const emptyFrozenYear = (year, split) => ({ year, split, entries: 0, unbalanced: 0, income: [], flow153: [0, 0], has621: false, any67: false, rule: new Map(), unclassifiedOrder: [] });
const tur4Full = (store, live, cover) => financial.periodRuleDiff({ frozen: [], frozenSums: financial.frozenPartOf(frozenSums(store, { from: "", through: cover })), live, from: "", to: cover, accounts: () => true, party: true });
const tur4Subledger = ledger => new Set(Object.keys(ledger.expected([], [], { every: true })));

/** BAŞVURU — tur 4'ün (f73f4f5a) incomeStatementOf gövdesi AYNEN (iki donmuş toplam okuması). */
function tur4IncomeStatementOf({ store, ledger, from, to }) {
  const start = `${from.slice(0, 4)}-01-01`;
  const cover = ledger.snapshots?.state?.().coverage || "";
  let entries;
  let ruleDiff = null;
  let frozen = null;
  let correction = null;
  if (cover && cover >= start) {
    const live = ledger.build();
    const through = to < cover ? to : cover;
    const part = financial.frozenPartOf(frozenSums(store, { from: start, through, split: from }));
    entries = to > cover ? ledger.book({ from: dayAfter(cover), to, live }) : [];
    ruleDiff = financial.periodRuleDiff({ frozen: entries, frozenSums: part, live, from: start, to: through });
    frozen = part.years.get(Number(start.slice(0, 4))) || emptyFrozenYear(Number(start.slice(0, 4)), from);
    const posted = financial.postedCorrectionsAt(store, to);
    if (posted.active.some(voucher => voucher.date >= from)) {
      const lock = ledger.snapshots?.state?.().lock || "";
      correction = financial.ruleDiffRemainder({ diff: tur4Full(store, live, cover), posted, subledger: tur4Subledger(ledger), lock, cover, accounts: account => account === "153" || /^[67]/.test(account) });
    }
  } else entries = ledger.book({ from: start, to });
  return financial.incomeStatement({ entries, valuation: createStockValuation(loadValuationInput(store)), from, to, bookType: bookTypeOf(store), ruleDiff, frozen, correction });
}

/** BAŞVURU — tur 4'ün (f73f4f5a) balanceSheetOf gövdesi AYNEN. */
function tur4BalanceSheetOf({ store, ledger, date }) {
  const checked = ledger.check();
  const live = checked.entries;
  const cover = ledger.snapshots?.state?.().coverage || "";
  const through = cover ? (date < cover ? date : cover) : "";
  const frozen = cover ? financial.frozenPartOf(frozenSums(store, { from: "", through })) : null;
  const entries = !cover ? ledger.book({ to: date, live }) : date > cover ? ledger.book({ from: dayAfter(cover), to: date, live }) : [];
  const ruleDiff = cover ? financial.periodRuleDiff({ frozen: entries, frozenSums: frozen, live, from: "", to: through, accounts: () => true, party: true }) : null;
  let correction = null;
  if (cover) {
    const posted = financial.postedCorrectionsAt(store, date);
    if (posted.active.length) {
      const lock = ledger.snapshots?.state?.().lock || "";
      correction = financial.ruleDiffRemainder({ diff: through === cover ? ruleDiff : tur4Full(store, live, cover), posted, subledger: tur4Subledger(ledger), lock, cover });
    }
  }
  const names = new Map();
  const partyNames = { get: id => (names.has(id) ? names.get(id) : (names.set(id, store.get("SELECT name FROM accounts WHERE id = ?", id)?.name || ""), names.get(id))) };
  return financial.balanceSheet({ entries, valuation: createStockValuation(loadValuationInput(store)), date, bookType: bookTypeOf(store), closedOn: financial.closingDayOf(store, date), ruleDiff, reconciliation: checked.reconciliation, partyNames, frozen, correction });
}

const GT = [["2026-01-01", "2026-10-20"], ["2026-01-01", "2026-06-30"], ["2026-07-01", "2026-10-20"], ["2026-07-01", "2026-07-31"], ["2026-01-01", "2026-07-31"], ["2026-07-01", "2026-07-01"], ["2026-06-30", "2026-07-15"], ["2025-01-01", "2025-12-31"], ["2026-10-01", "2026-10-20"]];
const BS = ["2025-12-31", "2026-06-30", "2026-07-01", "2026-07-15", "2026-09-30", "2026-10-20"];

/** Bir durumdaki BÜTÜN okumalar: yeni ↔ başvuru (JSON bayt bayt) + parça düzeyi. Dönüş: KALAN yolunun kaç kez koştuğu (sınamanın boş geçmediği). */
function assertSame(server, label) {
  assert.equal(typeof financial.fullRuleDiff, "function", "fullRuleDiff işlevi yok");
  const { store, ledger } = server.app;
  const state = ledger.snapshots.state();
  const cover = state.coverage;
  let remainderPaths = 0;
  for (const [from, to] of GT) {
    const fresh = JSON.stringify(financial.incomeStatementOf({ store, ledger, from, to }));
    const ref = JSON.stringify(tur4IncomeStatementOf({ store, ledger, from, to }));
    assert.equal(fresh, ref, `${label} · Gelir Tablosu ${from}..${to}: yeni = tur 4`);
    if (cover && financial.postedCorrectionsAt(store, to).active.some(voucher => voucher.date >= from) && cover >= `${from.slice(0, 4)}-01-01`) remainderPaths += 1;
  }
  for (const date of BS) {
    const fresh = JSON.stringify(financial.balanceSheetOf({ store, ledger, date }));
    const ref = JSON.stringify(tur4BalanceSheetOf({ store, ledger, date }));
    assert.equal(fresh, ref, `${label} · Bilanço ${date}: yeni = tur 4`);
    if (cover && date < cover && financial.postedCorrectionsAt(store, date).active.length) remainderPaths += 1;
  }
  if (!cover) return remainderPaths;
  // Parça düzeyi: tek çağrının içerisi eski okumayla aynı; dışarısı + içerinin rule'u = kapsamın tamamı.
  const live = ledger.build();
  const reference = tur4Full(store, live, cover);
  for (const [from, through, split] of [["2026-01-01", cover, "2026-01-01"], ["2026-01-01", cover, "2026-07-01"], ["", cover, ""], ["", "2026-06-30", ""], ["", "2025-12-31", ""], ["2026-01-01", "2026-07-31", "2026-07-01"], ["2025-01-01", "2025-12-31", "2025-01-01"]]) {
    if (through > cover) continue;
    const old = frozenSums(store, { from, through, split });
    const wide = frozenSums(store, { from, through, split, ruleThrough: cover });
    const where = `${label} · [${from || "''"}, ${through}] split ${split || "''"}`;
    assert.equal(old.outside, undefined, `${where}: ruleThrough verilmeyince outside alanı yok (çıktı eski)`);
    assert.ok(Array.isArray(wide.outside), `${where}: ruleThrough ile outside var`);
    assert.deepEqual(wide.groups, old.groups, `${where}: groups (sıra dahil) eski okumayla aynı`);
    assert.deepEqual(wide.entries, old.entries, `${where}: entries eski okumayla aynı`);
    const accounts = [...new Set(old.groups.map(row => row.account))];
    assert.deepEqual(wide.firstSeen(accounts), old.firstSeen(accounts), `${where}: firstSeen eski okumayla aynı`);
    assert.deepEqual(financial.fullRuleDiff(financial.frozenPartOf(wide), wide.outside, live, cover), reference, `${where}: içeri + dışarı = kapsamın tamamının periodRuleDiff'i (tur 4)`);
    // İçeri + dışarı = ["", kapsam] ('voucher' olmayan satırlar; from / through günü iki kez ya da hiç sayılmaz): yıl × hesap × alt × cari toplamları; dışarıda 'voucher' satırı yok.
    assert.equal(wide.outside.filter(row => row.voucher).length, 0, `${where}: dışarıda 'voucher' satırı yok`);
    const totalsOf = rows => {
      const map = new Map();
      for (const row of rows) {
        if (row.voucher) continue;
        const key = `${row.year}|${row.account}|${row.sub}|${row.party}`;
        map.set(key, (map.get(key) || 0) + row.net);
      }
      return [...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    };
    assert.deepEqual(totalsOf([...wide.groups, ...wide.outside]), totalsOf(frozenSums(store, { from: "", through: cover }).groups), `${where}: içeri + dışarı toplamları = kapsamın tamamı`);
  }
  return remainderPaths;
}

async function withFixture(sinif, fn) {
  const root = mkdtempSync(path.join(tmpdir(), `c6h5-tek-${sinif}-`));
  const dataDir = path.join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, `${sinif}-kilitli.sqlite.gz`))));
  copyFileSync(path.join(DIR, `${sinif}-kilitli.sirketler.json`), path.join(dataDir, "sirketler.json"));
  const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: OLD.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  try {
    await server.app.ledger.snapshots.runPending();
    assert.equal(server.app.ledger.snapshots.state().coverage, "2026-06-30", `ön koşul: ${sinif} 30.06.2026 dondu`);
    const client = await loginAdmin(server);
    await fn({ client, server });
  } finally {
    await server.close();
    removeTestDir(root);
  }
}

async function postCorrection(client, sinif) {
  const view = unwrap(await client.get("/api/admin/ledger/rule-diff-correction"));
  if (view.disabled) return null;
  const res = await client.post("/api/admin/ledger/rule-diff-correction", { requestId: `c6h5-tek-${sinif}-0000000001`, digest: view.digest, confirm: true });
  assert.equal(res.status, 200, `${sinif}: fiş ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res).voucher;
}

async function lockTo(client, server, day) {
  const put = await client.put("/api/admin/period-lock", { lockedUntil: day, force: true });
  assert.equal(put.status, 200, `kilit ${day}: ${put.status} ${JSON.stringify(put.data).slice(0, 300)}`);
  await waitForFreeze(client);
  assert.equal(server.app.ledger.snapshots.state().coverage, day, `kapsam ${day}`);
}

describe("2.5.0 Ç6-HESAP tur 5 — KALAN'ın kapsam okuması tek çağrıda: yanıtlar tur 4 ile BAYT BAYT aynı (13 kilitli fikstür)", () => {
  const totals = { fis: 0, kalanYolu: 0 };
  for (const sinif of CLASSES) {
    it(`${sinif}: fişten önce / sonra / kilit 30.09.2026 (through < kapsam) — Gelir Tablosu ve Bilanço yeni = tur 4; parçalar eşdeğer`, { timeout: 300_000 }, async () => {
      await withFixture(sinif, async ({ client, server }) => {
        assertSame(server, `${sinif} fişten önce`);
        const voucher = await postCorrection(client, sinif);
        if (!voucher) return;
        totals.fis += 1;
        totals.kalanYolu += assertSame(server, `${sinif} fişten sonra`);
        await lockTo(client, server, "2026-09-30");
        const paths = assertSame(server, `${sinif} kilit 30.09.2026`);
        assert.ok(paths > 0, `${sinif}: through < kapsam iken KALAN yolu koştu`);
        totals.kalanYolu += paths;
      });
    });
  }

  it("kasa: fişten sonra kilit 31.12.2025'e geri çekilir (KALAN ≠ 0) — yeni = tur 4", { timeout: 300_000 }, async () => {
    await withFixture("kasa", async ({ client, server }) => {
      assert.ok(await postCorrection(client, "kasa"));
      await lockTo(client, server, "2025-12-31");
      assertSame(server, "kasa kilit geri");
      const reason = financial.balanceSheetOf({ store: server.app.store, ledger: server.app.ledger, date: "2026-10-20" }).kesinDegil.find(row => row.kod === "kural-farki");
      assert.deepEqual(reason?.ayrinti, ["770: 300,00 TL", "770 (770.90): −300,00 TL"], "KALAN ≠ 0 kurgusu gerçekten kuruldu");
      await lockTo(client, server, "2026-09-30");
      assertSame(server, "kasa kilit yeniden 30.09.2026");
    });
  });

  it("taksit: fiş ters kaydedilir (20.10.2026) — fiş ile ters kayıt arası ve sonrası yeni = tur 4", { timeout: 300_000 }, async () => {
    await withFixture("taksit", async ({ client, server }) => {
      const voucher = await postCorrection(client, "taksit");
      assert.ok(voucher);
      const res = await client.post(`/api/admin/ledger/vouchers/${voucher.id}/reverse`, { requestId: "c6h5-ters-taksit-0000000001", date: "2026-10-20" });
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      assertSame(server, "taksit ters kayıt");
      await lockTo(client, server, "2026-09-30");
      assertSame(server, "taksit ters kayıt + kilit 30.09.2026");
    });
  });

  it("sınama boş geçmedi: fiş en az dört sınıfta yazıldı, KALAN yolu koştu", t => {
    t.diagnostic(`fiş yazılan sınıf ${totals.fis} · KALAN yolunun koştuğu okuma ${totals.kalanYolu}`);
    assert.ok(totals.fis >= 4, `fiş yazılan sınıf ${totals.fis}`);
    assert.ok(totals.kalanYolu >= 8, `KALAN yolu ${totals.kalanYolu}`);
  });
});

describe("2.5.0 Ç6-HESAP tur 5 — frozenSums ruleThrough sınırları", () => {
  it("ruleThrough < through reddedilir; kapsam yokken outside boş", () => {
    const store = { all: () => [], get: () => ({ found: 1 }) };
    assert.throws(() => frozenSums(store, { from: "2026-01-01", through: "2026-06-30", ruleThrough: "2026-05-31" }), /ruleThrough/);
    assert.deepEqual(frozenSums(store, { from: "2026-01-01", through: "", ruleThrough: "2026-06-30" }).outside, []);
  });
});
