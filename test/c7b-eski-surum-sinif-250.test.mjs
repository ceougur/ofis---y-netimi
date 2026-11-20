// 2.5.0 Ç7b tur 2f — kabul D: ESKİ SÜRÜM SINIF TESTİ (ders 17, 53 (b); docs/devir/2.5.0-DEVAM/c7b2-istem.txt 'Kabul koşulları' D; docs/erp/C7B-FATURA-TASARIM.md §1, §2, §11, §13, §14).
// Veri v2.4.9'un GERÇEK koduyla API'den (surumler.mjs bootVersion); sahte saat (ders 13); lisans servisi yok (ders 30). Kilit (v2.4.9'da) 30.09.2026 = göç 51'in KURAL GEÇİŞ GÜNÜ.
// SINIF LİSTESİ (her kural × kilitli / açık × iade / iptal / düzeltme) ve BEKLENENLER ELLE (kural kitabı satırı + karar metni; programın çıktısından DEĞİL — ders 5):
//   EYLÜL (kilitli, v2.4.9): L1 Kasa + 300 (K-01) · L2 Kasa − 200 (K-02) · L3 M1 Borç Yaz 500 (C-01 / KG-4) · L4 M1 Alacak Yaz 150 (C-02 / KG-4) · ürün alımı 10 × 100 (T1; 153 değişmez) ·
//     L5 veresiye satış 4 × 300 = 1.200 (KG-2) · L6 müşteri iadesi 240 (KG-2 iade) · L7 peşin satış 600 · L8 peşin iade 120 · L9 taksit Yeni Borç 6.000 (H-03 / KG-2) · L10 kayıt tahsilatı 1.000
//     (KG-3, geçiş gününden önce → ESKİ 602) · S1 satış 10.000 + 2.000 · E1 ihracat 5.000 (%0, 301; KG-24) · E2 ihracat 3.000 → DÜZENLE ile 4.000 (KG-24 × düzeltme) · S2 satış 2.000 + 400
//     İPTAL (G-7: iki kuralda madde yok) · P1 gider alışı (M14: 770 2.000 / 760 1.000 / 255 500; KDV 700) · SR S1'den 1 × 1.000 + 200 (KG-8, kilitli → ESKİ B 391) · PR P1'den 1 × 1.000 + 200
//     (F-08, kilitli → ESKİ A 191) · Eylül KDV mahsubu (v2.4.9; B-6): H = 2.000 − 200 = 1.800, İ = 700 − 200 = 500, ödenecek 1.300.
//   EKİM (açık, v2.4.9 verisi — güncellemeden sonra YENİ kuralla türer, kural farkı DOĞMAZ): O1 Kasa + 400 · O2 Borç Yaz 700 · O3 Yeni Borç 3.000 · O4 kayıt tahsilatı 250 (geçişten sonra → 336.90) ·
//     S3 3 × 1.000 + 600 · E3 ihracat 2.000 (sonra güncel kodda DÜZENLE ile 2.500) · E4 ihracat 1.500 İPTAL · P3 2 × 500 + 200 · P3b 1 × 500 + 100 (iadesiz — Düzenle'ye açık) · SR3 S3'ten
//     1 × 1.000 + 200 · PR3 P3'ten 1 × 500 + 100 · Ekim mahsubu v2.4.9'da: H 600 − 200 = 400, İ 300 − 100 = 200, ödenecek 200 (B-6: mahsuplu ay ESKİ yönde; ters kaydedilince YENİ: H 600 + 100 = 700,
//     İ 300 + 200 = 500, ödenecek 200).
//   KASIM (güncel kod, yeni kural): N1 Kasa + 100 · N2 Kasa − 50 · N3 Alacak Yaz 80 · N4 veresiye satış 1 × 300 · N5 kayıt tahsilatı 500 · S4 1 × 1.000 + 200 · SR4 S4'ün tamamı · P4 2 × 500 + 200,
//     KDV İndirim Dönemi Aralık 2026 (KG-7) · PR4 P4'ten 1 × 500 + 100 · E5 ihracat 1.000 · S5 500 + 100 İPTAL · P3b'nin dönemi DÜZENLE ile Kasım 2026 (KG-7 × açık × düzeltme; Ekim mahsuplu →
//     AZALTAN fark, S4) → Kasım ön izlemesi H = 200 + 100 = 300, İ = SR4 200 + P3b 100 − taşınan 100 = 200, ödenecek 100 (iki kez indirim yok). İadesi olan P3'te Düzenle 409 (bugünkü kural).
//   KURAL FARKI (kilitli 11 madde — L1, L2, L3, L4, L5, L6, L7, L8, L9, E1, E2; L10 / SR / PR B-8 ile ESKİ yönde — fark YOK; M14 / S1 / S2 değişmez) ve FİŞ (01.10.2026, aynı yıl → eski
//   hesabın tersi): B 649 300 · A 649.90 300 · A 770 350 · B 770.90 350 · B 602 6.500 · A 602.90 500 · B 600 10.800 · A 600.90 7.800 · A 601 9.000 · A 610 360 · B 610.90 360 (Σ 18.310).
//   SONDA (karma defter): 649.90 −800 · 770.90 480 · 602.90 −1.200 · 602 −2.200 (L10 1.000 ESKİ + 602.90) · 600.90 −11.100 · 610.90 360 · 601 −12.500 · 336 = 336.90 −750 (geçiş sonrası kayıt
//   tahsilatları) · Eylül sonu 191 = 391 = 0, 360 −1.300 · Kasım sonu 391 0, 191 +200 (P4 Aralık döneminde — mahsupsuz kalan; §14.3), 360 −1.300 − 200 − 100 = −1.600.
// Değişmezler (kabul F) her adımda: her maddede Σ borç = Σ alacak; Defter Mutabakatı temiz; Mutabakat Testi yalnız (fişten önce) Kural Değişikliği Farkı.
// NASIL BOZARIM: geçişi yok saymak (L10 / SR / PR kural farkına girer → madde 14, fiş dışı fark); .90 kuralını düşürmek (madde sayısı < 11, fiş satırı eksik); ihracatı 600'de bırakmak (E1 / E2 farkı yok);
//   donmuş defteri yeniden türetmek (Eylül maddeleri v2.4.9'unkinden ayrışır); mahsup işaretini yok saymak (Ekim Güncel Değil); KG-7'yi yok saymak (Kasım İ 400 / Aralık İ 0).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-12-10T12:00:00+03:00", fixed: true };
const LOCK = "2026-09-30";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const RULE_DIFF = "ledger:rule-diff";
const FIX = "/api/admin/ledger/rule-diff-correction";
const skip = tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok";
let seq = 0;
const rid = () => `c7b2f-d-${process.pid}-${String(++seq).padStart(6, "0")}`;

const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const lineSet = entry => entry.lines.map(line => `${line.account}${line.sub ? `/${line.sub}` : ""}:${line.debit}:${line.credit}`).sort();
const fixText = lines => lines.map(line => `${line.debit ? "B" : "A"} ${line.sub || line.account} ${(line.debit || line.credit) / 100}`).sort();
/** Hesap (ana) ve alt hesap bakiyeleri (kuruş → TL) — maddelerin kendisinden. */
function balances(entries, to = "9999") {
  const acc = {};
  const sub = {};
  for (const entry of entries) {
    if (entry.date > to) continue;
    for (const line of entry.lines) {
      acc[line.account] = (acc[line.account] || 0) + line.debit - line.credit;
      if (line.sub) sub[line.sub] = (sub[line.sub] || 0) + line.debit - line.credit;
    }
  }
  const tl = obj => Object.fromEntries(Object.entries(obj).map(([key, minor]) => [key, minor / 100]));
  return { acc: tl(acc), sub: tl(sub) };
}

/** v2.4.9'un gerçek koduyla eski veri. Dönüş: kimlikler + v2.4.9'un kendi türettiği Eylül maddeleri (kilitli dönemin "donmuş" olması gereken hâli). */
async function makeOld(dirs) {
  const old = await bootVersion("v2.4.9", { ...dirs, now: NOW, legacyCasePayments: true });
  const ids = {};
  try {
    const api = await old.login();
    const store = old.app.store;
    const last = (table, where = "1 = 1", ...args) => store.get(`SELECT id FROM ${table} WHERE ${where} ORDER BY rowid DESC LIMIT 1`, ...args).id;
    ids.M1 = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Sınıf Müşteri", type: "customer", registeredOn: "2026-08-01" }))).id;
    ids.T1 = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Sınıf Tedarikçi", type: "supplier", registeredOn: "2026-08-01" }))).id;
    const cash = async (key, kind, amount, date) => {
      await must(`Kasa ${key}`, api.post("/api/workspace/cash", { kind, amount, method: "cash", date, description: `Sınıf ${key}` }));
      ids[key] = last("cash_entries");
    };
    const entry = async (key, kind, amount, date) => {
      await must(`cari ${key}`, api.post(`/api/workspace/accounts/${ids.M1}/entries`, { kind, amount, date, note: `Sınıf ${key}` }));
      ids[key] = last("account_entries", "account_id = ?", ids.M1);
    };
    const plan = async (key, total, date) => {
      const res = await must(`kart ${key}`, api.post("/api/workspace/plans", { accountId: ids.M1, name: `Sınıf ${key}`, total, registeredOn: date, mode: "auto", count: 3, firstDue: "2027-01-05" }));
      ids[key] = res.id || res.plan?.id;
    };
    const collect = async (key, amount, date) => {
      await must(`kayıt tahsilatı ${key}`, api.post(`/api/workspace/cases/SINIF-${key}/payments`, { amount, date, method: "cash", caseTitle: `Sınıf ${key}` }));
      ids[key] = last("payments");
    };
    const inv = async (key, body) => (ids[key] = (await must(key, api.post(INV, body))).id);
    const sale = (key, date, qty, price, extra = {}) => inv(key, { scenario: "service_sale", accountId: ids.M1, issueDate: date, lines: [{ name: "Danışmanlık", qty, unitPrice: price, vatRate: 20 }], payment: { rest: "open" }, ...extra });
    const exportSale = (key, date, price) => inv(key, { scenario: "service_sale", accountId: ids.M1, issueDate: date, lines: [{ name: "Yurt Dışı Danışmanlık", qty: 1, unitPrice: price, vatRate: 0, exemptionCode: "301" }], payment: { rest: "open" } });
    let n = 0;
    const buy = (key, date, lines) => inv(key, { kind: "purchase", scenario: "expense_purchase", accountId: ids.T1, issueDate: date, number: `SA-${(n += 1)}`, lines, payment: { rest: "open" } });
    const card = id => must("fatura", api.get(`${INV}/${id}`));
    const saleReturn = async (key, of, date, qty) => inv(key, { kind: "sale_return", accountId: ids.M1, originalId: ids[of], issueDate: date, lines: [{ originLineId: (await card(ids[of])).lines[0].id, qty }], payment: { cash: [] }, force: true });
    const buyReturn = async (key, of, date, qty) => inv(key, { kind: "purchase_return", accountId: ids.T1, originalId: ids[of], issueDate: date, number: `SI-${(n += 1)}`, lines: [{ originLineId: (await card(ids[of])).lines[0].id, qty }], payment: { cash: [] }, force: true });
    const cancel = key => must(`${key} İptal Et`, api.post(`${INV}/${ids[key]}/cancel`, { reason: "Hatalı fatura", payments: "drop", refund: "none" }));
    // EYLÜL (kilitlenecek)
    await cash("L1", "in", "300", "2026-09-02");
    await cash("L2", "out", "200", "2026-09-02");
    await entry("L3", "debt", "500", "2026-09-03");
    await entry("L4", "credit", "150", "2026-09-03");
    const item = await must("ürün", api.post("/api/workspace/stock", { name: "Sınıf Ürün", unit: "Adet", kind: "product", code: "SU-1", unitPrice: "100", vatRate: "20" }));
    ids.item = item.id || item.item?.id;
    const move = body => must(`stok ${body.note}`, api.post(`/api/workspace/stock/${ids.item}/moves`, { date: "2026-09-04", ...body }));
    await move({ kind: "in", qty: "10", unitPrice: "100", pay: "account", accountId: ids.T1, note: "Açık hesap alım" });
    await move({ kind: "out", qty: "4", unitPrice: "300", pay: "account", accountId: ids.M1, note: "Veresiye satış" });
    ids.L5 = last("account_entries", "account_id = ? AND source = 'stock'", ids.M1);
    await move({ kind: "in", qty: "1", unitPrice: "240", pay: "account", accountId: ids.M1, reason: "return", note: "Müşteri iadesi" });
    ids.L6 = last("account_entries", "account_id = ? AND source = 'stock'", ids.M1);
    await move({ kind: "out", qty: "2", unitPrice: "300", pay: "cash", method: "cash", note: "Peşin satış" });
    ids.L7 = last("stock_moves");
    await move({ kind: "in", qty: "1", unitPrice: "120", pay: "cash", method: "cash", reason: "return", note: "Peşin iade" });
    ids.L8 = last("stock_moves");
    await plan("L9", "6.000", "2026-09-05");
    await collect("L10", "1.000", "2026-09-06");
    await sale("S1", "2026-09-10", 10, 1000);
    await exportSale("E1", "2026-09-11", 5000);
    await exportSale("E2", "2026-09-12", 3000);
    const e2 = await card(ids.E2);
    await must("E2 Düzenle", api.post(`${INV}/${ids.E2}/edit`, { kind: e2.kind, scenario: e2.scenario, accountId: e2.accountId, issueDate: e2.issueDate, issueTime: e2.issueTime, number: e2.number, lines: [{ name: "Yurt Dışı Danışmanlık", qty: 1, unitPrice: 4000, vatRate: 0, exemptionCode: "301" }], payment: { rest: "open" } }));
    await sale("S2", "2026-09-15", 1, 2000);
    await cancel("S2");
    await buy("P1", "2026-09-13", [
      { name: "Kırtasiye", qty: 2, unitPrice: 1000, vatRate: 20, expenseCode: "office" },
      { name: "Reklam", qty: 1, unitPrice: 1000, vatRate: 20, expenseCode: "marketing" },
      { name: "Bilgisayar", qty: 1, unitPrice: 500, vatRate: 20, expenseCode: "asset" },
    ]);
    await saleReturn("SR", "S1", "2026-09-20", 1);
    await buyReturn("PR", "P1", "2026-09-21", 1);
    await must("Eylül mahsubu", api.post(`${TAX}/vat-offset`, { month: "2026-09" }));
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    // EKİM (açık)
    await cash("O1", "in", "400", "2026-10-02");
    await entry("O2", "debt", "700", "2026-10-02");
    await plan("O3", "3.000", "2026-10-03");
    await collect("O4", "250", "2026-10-03");
    await sale("S3", "2026-10-05", 3, 1000);
    await exportSale("E3", "2026-10-07", 2000);
    await exportSale("E4", "2026-10-08", 1500);
    await cancel("E4");
    await buy("P3", "2026-10-06", [{ name: "Kırtasiye", qty: 2, unitPrice: 500, vatRate: 20, expenseCode: "office" }]);
    await buy("P3b", "2026-10-09", [{ name: "Kırtasiye", qty: 1, unitPrice: 500, vatRate: 20, expenseCode: "office" }]);
    await saleReturn("SR3", "S3", "2026-10-20", 1);
    await buyReturn("PR3", "P3", "2026-10-21", 1);
    await must("Ekim mahsubu", api.post(`${TAX}/vat-offset`, { month: "2026-10" }));
    const offsets = store.all("SELECT month, out_minor, in_minor, payable_minor, status FROM vat_offsets ORDER BY month");
    // v2.4.9'un KENDİ türetmesi: kilitli dönemin maddeleri (güncellemeden sonra donmuş defter bunlarla AYNI olmalı).
    const frozen = new Map(old.app.ledger.build().filter(item => item.date <= LOCK).map(item => [item.id, lineSet(item)]));
    return { ids, frozen, offsets };
  } finally {
    await old.close();
  }
}

describe("Ç7b tur 2f — kabul D: v2.4.9 gerçek verisinde sınıf sınıf (kilitli / açık × iade / iptal / düzeltme; B-6, B-8, KG-7)", { skip }, () => {
  let root = "";
  let server = null;
  let app = null;
  let api = null;
  let old = null;
  const ids = {};
  const entries = () => app.ledger.build();
  const karma = () => app.ledger.book({});
  const entryOf = (id, list = entries()) => {
    const found = list.filter(item => item.id === id);
    assert.equal(found.length, 1, `${id}: tek madde (${found.length})`);
    return found[0];
  };
  const integrity = async () => {
    const r = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    return { ok: r.ok, failures: (r.failures || []).map(item => item.code), item: (r.checks || []).find(item => item.code === RULE_DIFF) || null };
  };
  /** Değişmezler (kabul F): her maddede Σ borç = Σ alacak; Defter Mutabakatı temiz; Mutabakat Testi'nde kural farkı DIŞINDA sapma yok. */
  const invariants = async (label, { ruleDiff = false } = {}) => {
    const bad = karma().filter(entry => entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0) !== 0).map(entry => entry.id);
    assert.deepEqual(bad, [], `${label}: dengesiz madde`);
    const ledger = await must("Defter Mutabakatı", api.get("/api/workspace/ledger"));
    const off = ledger.reconciliation.checks.filter(item => !item.ok).map(item => `${item.code} ${item.subledger} ↔ ${item.ledger}`);
    assert.deepEqual(off, [], `${label}: Defter Mutabakatı`);
    const scan = await integrity();
    assert.deepEqual(scan.failures, ruleDiff ? [RULE_DIFF] : [], `${label}: Mutabakat Testi`);
    return scan;
  };

  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "c7b2f-sinif-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    old = await makeOld(dirs);
    Object.assign(ids, old.ids);
    server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
    app = server.app;
    // Ön koşul ürünün durumundan (ders 20): açılıştaki dondurma bitti.
    await app.ledger.snapshots.runPending();
    assert.equal(app.ledger.snapshots.state().pending, null, "açılıştaki dondurma bitmeli");
    api = await server.login();
  }, { timeout: 300_000 });
  after(async () => {
    await server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("1. ön koşullar: v2.4.9 mahsupları elle (Eylül H 1.800 / İ 500 / 1.300; Ekim H 400 / İ 200 / 200); geçiş günü = kilit; iki eski mahsup '2.4.9' işaretli", () => {
    assert.deepEqual(old.offsets.map(row => `${row.month} ${row.out_minor / 100} ${row.in_minor / 100} ${row.payable_minor / 100} ${row.status}`), ["2026-09 1800 500 1300 active", "2026-10 400 200 200 active"]);
    assert.equal(app.store.get("SELECT value FROM settings WHERE key = 'ledger.ruleShiftThrough'").value, LOCK, "kural geçiş günü = güncellemedeki kilit");
    assert.deepEqual(app.store.all("SELECT month, rule_version AS v FROM vat_offsets ORDER BY month").map(row => `${row.month} ${row.v}`), ["2026-09 2.4.9", "2026-10 2.4.9"]);
  });

  it("2. güncelle → donmuş defter DEĞİŞMEDİ: kilitli dönemin her maddesi v2.4.9'un kendi türettiğiyle birebir", () => {
    const frozen = new Map(app.ledger.snapshots.entries({}).map(item => [item.id, lineSet(item)]));
    assert.deepEqual([...frozen.keys()].sort(), [...old.frozen.keys()].sort(), "donmuş madde kümesi = v2.4.9'un Eylül maddeleri");
    const changed = [...old.frozen].filter(([id, lines]) => JSON.stringify(frozen.get(id)) !== JSON.stringify(lines)).map(([id]) => id);
    assert.deepEqual(changed, [], "donmuş maddelerin satırları v2.4.9'unkiyle aynı");
    // Kilitli kayıtların ESKİ hâli (elle): Kasa + A 649, Borç Yaz A 602, Yeni Borç A 602, ihracat A 600, kayıt tahsilatı A 602, iade KDV'leri eski yön.
    const f = id => frozen.get(id);
    assert.deepEqual(f(`cash:${ids.L1}`), ["100:30000:0", "649:0:30000"]);
    assert.deepEqual(f(`account:${ids.L3}`), ["120:50000:0", "602:0:50000"]);
    assert.deepEqual(f(`plan:${ids.L9}`), ["120:600000:0", "602:0:600000"]);
    assert.deepEqual(f(`invoice:${ids.E2}`), ["120:400000:0", "600:0:400000"], "Düzenle'den sonraki tutar (4.000)");
    assert.equal(f(`invoice:${ids.S2}`), undefined, "iptal edilen fatura maddesiz (G-7)");
  });

  it("3. kural farkı TAM: 11 madde (Kasa ±, Borç / Alacak Yaz, stok ×4, Yeni Borç, iki ihracat); B-8'in üç kuralı (kayıt tahsilatı, iki iade KDV'si) ve M14 farksız; hesap farkları elle", async () => {
    await invariants("güncellemeden sonra", { ruleDiff: true });
    const scan = await integrity();
    assert.equal(scan.item?.ok, false);
    assert.equal(scan.item.count, 11, `madde sayısı: ${JSON.stringify(scan.item)}`);
    const diff = app.ledger.snapshots.ruleDiff({ detail: true });
    const expectedIds = [`cash:${ids.L1}`, `cash:${ids.L2}`, `account:${ids.L3}`, `account:${ids.L4}`, `account:${ids.L5}`, `account:${ids.L6}`, `stock:${ids.L7}`, `stock:${ids.L8}`, `plan:${ids.L9}`, `invoice:${ids.E1}`, `invoice:${ids.E2}`];
    assert.deepEqual(diff.entries.map(item => item.id).sort(), expectedIds.sort(), "fark doğuran maddeler");
    // Hesap / alt hesap başına fark (güncel − donmuş), kuruş → TL, elle:
    const sums = {};
    for (const item of diff.entries) for (const d of item.deltas) sums[d.sub || d.account] = (sums[d.sub || d.account] || 0) + d.minor;
    const tl = Object.fromEntries(Object.entries(sums).filter(([, v]) => v !== 0).map(([key, v]) => [key, v / 100]));
    assert.deepEqual(tl, { 649: 300, "649.90": -300, 770: -350, "770.90": 350, 602: 6500, "602.90": -500, 600: 10800, "600.90": -7800, 601: -9000, 610: -360, "610.90": 360 });
  });

  it("4. Kural Farkı Düzeltme Fişi (01.10.2026; aynı yıl → eski hesabın tersi) → 'Düzeltildi'; donmuş defter yine aynı", async () => {
    const view = (await must("fiş ön izleme", api.get(FIX))).data ?? (await must("fiş ön izleme", api.get(FIX)));
    assert.equal(view.disabled, false, view.reason);
    assert.equal(view.date, "2026-10-01");
    assert.deepEqual(view.excluded, [], "fiş dışında kalan (alt defter) fark yok — B-8");
    assert.deepEqual(fixText(view.lines), ["A 601 9000", "A 602.90 500", "A 600.90 7800", "A 610 360", "A 649.90 300", "A 770 350", "B 600 10800", "B 602 6500", "B 610.90 360", "B 649 300", "B 770.90 350"].sort());
    const post = await api.post(FIX, { requestId: rid(), digest: view.digest, confirm: true });
    assert.equal(post.status, 200, JSON.stringify(post.data));
    const scan = await invariants("fişten sonra");
    assert.equal(scan.ok, true);
    assert.match(scan.item.name, /— Düzeltildi \(Fiş 2026-\d{6}\)$/);
    const frozen = new Map(app.ledger.snapshots.entries({}).map(item => [item.id, lineSet(item)]));
    assert.deepEqual([...old.frozen].filter(([id, lines]) => JSON.stringify(frozen.get(id)) !== JSON.stringify(lines)).map(([id]) => id), [], "fişten sonra da donmuş defter aynı");
    const sep = balances(karma(), LOCK);
    assert.deepEqual([sep.acc["191"] ?? 0, sep.acc["391"] ?? 0, sep.acc["360"]], [0, 0, -1300], "Eylül sonu (B-6: eski mahsup eski yönle): 191 = 391 = 0, 360 −1.300");
  });

  it("5. açık dönem (v2.4.9'un Ekim verisi) YENİ kuralla; B-6: Ekim mahsuplu → iade KDV'si ESKİ yön, ters kayıt → YENİ yön, yeniden mahsup H 700 / İ 500 / 200", async () => {
    const list = entries();
    assert.deepEqual(lineSet(entryOf(`cash:${ids.O1}`, list)), ["100:40000:0", "649/649.90:0:40000"], "K-01");
    assert.deepEqual(lineSet(entryOf(`account:${ids.O2}`, list)), ["120:70000:0", "602/602.90:0:70000"], "C-01");
    assert.deepEqual(lineSet(entryOf(`plan:${ids.O3}`, list)), ["120:300000:0", "600/600.90:0:300000"], "H-03 / KG-2");
    assert.deepEqual(lineSet(entryOf(`payment:${ids.O4}`, list)), ["100:25000:0", "336/336.90:0:25000"], "KG-3 (geçişten sonra)");
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.E3}`, list)), ["120:200000:0", "601:0:200000"], "KG-24");
    assert.equal(list.filter(item => item.id === `invoice:${ids.E4}`).length, 0, "iptal edilen ihracat maddesiz");
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.SR3}`, list)), ["120:0:120000", "391:20000:0", "610:100000:0"], "B-6: Ekim mahsubu eski → SR3 B 391");
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.PR3}`, list)), ["191:0:10000", "320:60000:0", "770:0:50000"], "B-6: PR3 A 191");
    assert.deepEqual(lineSet(entryOf(`payment:${ids.L10}`, list)), ["100:100000:0", "602:0:100000"], "B-8: geçiş gününden önceki kayıt tahsilatı canlı türetmede de 602");
    let offs = (await must("mahsup listesi", api.get(`${TAX}/vat-offset`))).offsets;
    assert.deepEqual(offs.map(item => `${item.month} ${item.stale}`), ["2026-09 false", "2026-10 false"], "eski mahsuplar Güncel Değil değil");
    const oct = offs.find(item => item.month === "2026-10");
    await must("Ekim mahsubu ters", api.post(`${TAX}/vat-offset/${oct.id}/reverse`, {}));
    const after = entries();
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.SR3}`, after)), ["120:0:120000", "191:20000:0", "610:100000:0"], "ters kayıttan sonra SR3 B 191 (KG-8)");
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.PR3}`, after)), ["320:60000:0", "391:0:10000", "770:0:50000"], "PR3 A 391 (F-08)");
    const view = (await must("Ekim ön izleme", api.get(`${TAX}/vat-offset?month=2026-10`))).preview;
    assert.deepEqual([view.outMinor, view.inMinor, view.payableMinor], [70000, 50000, 20000], "Ekim yeni yön: H 700 / İ 500 / ödenecek 200 (eski ile aynı ödenecek)");
    await must("Ekim mahsubu yeniden", api.post(`${TAX}/vat-offset`, { month: "2026-10" }));
    offs = (await must("mahsup listesi", api.get(`${TAX}/vat-offset`))).offsets;
    assert.deepEqual(offs.filter(item => item.status !== "reversed").map(item => `${item.month} ${item.stale}`).sort(), ["2026-09 false", "2026-10 false"]);
    const octEnd = balances(karma(), "2026-10-31");
    assert.deepEqual([octEnd.acc["191"] ?? 0, octEnd.acc["391"] ?? 0], [0, 0], "Ekim sonu 191 = 391 = 0");
    await invariants("Ekim yeniden mahsup");
  });

  it("6. Kasım (güncel kod): yeni kayıtlar yeni kuralla; iptal maddesiz; açık düzeltme (E3 2.000 → 2.500, 601); KG-7 kilitli Düzenle 409, açık Düzenle ile dönem; Kasım H 300 / İ 200 / 100", async () => {
    const store = app.store;
    const last = (table, where = "1 = 1", ...args) => store.get(`SELECT id FROM ${table} WHERE ${where} ORDER BY rowid DESC LIMIT 1`, ...args).id;
    for (const [key, kind, amount] of [["N1", "in", "100"], ["N2", "out", "50"]]) {
      await must(`Kasa ${key}`, api.post("/api/workspace/cash", { kind, amount, method: "cash", date: "2026-11-02", description: `Sınıf ${key}` }));
      ids[key] = last("cash_entries");
    }
    await must("N3 Alacak Yaz", api.post(`/api/workspace/accounts/${ids.M1}/entries`, { kind: "credit", amount: "80", date: "2026-11-02", note: "Sınıf N3" }));
    ids.N3 = last("account_entries", "account_id = ?", ids.M1);
    await must("N4 veresiye", api.post(`/api/workspace/stock/${ids.item}/moves`, { date: "2026-11-03", kind: "out", qty: "1", unitPrice: "300", pay: "account", accountId: ids.M1, note: "Veresiye satış" }));
    ids.N4 = last("account_entries", "account_id = ? AND source = 'stock'", ids.M1);
    await must("N5 kayıt tahsilatı", api.post("/api/workspace/cases/SINIF-N5/payments", { amount: "500", date: "2026-11-05", method: "cash", caseTitle: "Sınıf N5" }));
    ids.N5 = last("payments");
    const inv = async (key, body) => (ids[key] = (await must(key, api.post(INV, body))).id);
    const card = id => must("fatura", api.get(`${INV}/${id}`));
    await inv("S4", { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-11-03", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } });
    await inv("SR4", { kind: "sale_return", accountId: ids.M1, originalId: ids.S4, issueDate: "2026-11-10", lines: [{ originLineId: (await card(ids.S4)).lines[0].id, qty: 1 }], payment: { cash: [] }, force: true });
    await inv("P4", { kind: "purchase", scenario: "expense_purchase", accountId: ids.T1, issueDate: "2026-11-04", number: "SA-K1", vatPeriod: "2026-12", lines: [{ name: "Kırtasiye", qty: 2, unitPrice: 500, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } });
    await inv("PR4", { kind: "purchase_return", accountId: ids.T1, originalId: ids.P4, issueDate: "2026-11-11", number: "SI-K1", lines: [{ originLineId: (await card(ids.P4)).lines[0].id, qty: 1 }], payment: { cash: [] }, force: true });
    await inv("E5", { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-11-12", lines: [{ name: "Yurt Dışı Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 0, exemptionCode: "301" }], payment: { rest: "open" } });
    await inv("S5", { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-11-15", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" } });
    await must("S5 İptal Et", api.post(`${INV}/${ids.S5}/cancel`, { reason: "Hatalı fatura", payments: "drop", refund: "none" }));
    const editBody = async (id, patch) => {
      const doc = await card(id);
      return { kind: doc.kind, scenario: doc.scenario, accountId: doc.accountId, issueDate: doc.issueDate, issueTime: doc.issueTime, number: doc.number, lines: doc.lines.map(line => ({ name: line.name, qty: line.qty, unitPrice: line.unitPrice, vatRate: line.vatRate, expenseCode: line.expenseCode, exemptionCode: line.exemptionCode })), payment: { rest: "open" }, vatPeriod: doc.vatPeriod, ...patch };
    };
    // Açık × düzeltme (KG-24): v2.4.9'un Ekim ihracatı güncel kodda Düzenle ile 2.500.
    await must("E3 Düzenle", api.post(`${INV}/${ids.E3}/edit`, await editBody(ids.E3, { lines: [{ name: "Yurt Dışı Danışmanlık", qty: 1, unitPrice: 2500, vatRate: 0, exemptionCode: "301" }] })));
    // Kilitli × düzeltme (KG-7): kilitli Eylül alış faturasının dönemi Düzenle ile değişmez (409; §14.2).
    const locked = await api.post(`${INV}/${ids.P1}/edit`, await editBody(ids.P1, { vatPeriod: "2026-10" }));
    assert.equal(locked.status, 409, `kilitli belgede Düzenle: ${locked.status} ${JSON.stringify(locked.data).slice(0, 200)}`);
    assert.equal(store.get("SELECT vat_period AS v FROM invoices WHERE id = ?", ids.P1).v, "", "kilitli faturanın dönemi değişmedi");
    // İadesi olan belge Düzenle'ye kapalı (bugünkü kural; alan da değişmez — §14.2 son madde).
    const returned = await api.post(`${INV}/${ids.P3}/edit`, await editBody(ids.P3, { vatPeriod: "2026-11" }));
    assert.equal(returned.status, 409, `iadesi olan P3: ${returned.status}`);
    assert.equal(store.get("SELECT vat_period AS v FROM invoices WHERE id = ?", ids.P3).v, "");
    // Açık × düzeltme (KG-7): v2.4.9'un Ekim alışı (Ekim mahsuplu) Kasım dönemine → Ekim'den AZALTAN fark, S4 ile Kasım'a taşınır (iki kez indirim yok).
    await must("P3b dönemi Kasım", api.post(`${INV}/${ids.P3b}/edit`, await editBody(ids.P3b, { vatPeriod: "2026-11" })));
    assert.equal(store.get("SELECT vat_period AS v FROM invoices WHERE id = ?", ids.P3b).v, "2026-11");
    const list = entries();
    assert.deepEqual(lineSet(entryOf(`cash:${ids.N1}`, list)), ["100:10000:0", "649/649.90:0:10000"]);
    assert.deepEqual(lineSet(entryOf(`cash:${ids.N2}`, list)), ["100:0:5000", "770/770.90:5000:0"]);
    assert.deepEqual(lineSet(entryOf(`account:${ids.N3}`, list)), ["120:0:8000", "770/770.90:8000:0"]);
    assert.deepEqual(lineSet(entryOf(`account:${ids.N4}`, list)), ["120:30000:0", "600/600.90:0:30000"]);
    assert.deepEqual(lineSet(entryOf(`payment:${ids.N5}`, list)), ["100:50000:0", "336/336.90:0:50000"]);
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.SR4}`, list)), ["120:0:120000", "191:20000:0", "610:100000:0"]);
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.PR4}`, list)), ["320:60000:0", "391:0:10000", "770:0:50000"]);
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.P4}`, list)), ["191:20000:0", "320:0:120000", "770:100000:0"], "KG-7: defter maddesi belge tarihinde (191 Kasım)");
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.E5}`, list)), ["120:100000:0", "601:0:100000"]);
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.E3}`, list)), ["120:250000:0", "601:0:250000"], "açık düzeltme yeni kuralla");
    assert.equal(list.filter(item => item.id === `invoice:${ids.S5}`).length, 0, "iptal maddesiz");
    const nov = (await must("Kasım ön izleme", api.get(`${TAX}/vat-offset?month=2026-11`))).preview;
    assert.deepEqual([nov.outMinor, nov.inMinor, nov.payableMinor], [30000, 20000, 10000], `Kasım H 300 / İ 200 / ödenecek 100: ${JSON.stringify(nov).slice(0, 300)}`);
    const offs = (await must("mahsup listesi", api.get(`${TAX}/vat-offset`))).offsets;
    assert.deepEqual(offs.filter(item => item.status !== "reversed").map(item => `${item.month} ${item.stale}`).sort(), ["2026-09 false", "2026-10 false"], "azaltan fark Ekim'i Güncel Değil yapmaz");
    await must("Kasım mahsubu", api.post(`${TAX}/vat-offset`, { month: "2026-11" }));
    await invariants("Kasım mahsubu");
  });

  it("7. sonda karma defter (elle): .90 alt hesapları, 601, 336.90 = geçiş sonrası kayıt tahsilatları, 600.90 / 610.90 = belgesiz satış / iade; ay sonu 191 / 391", () => {
    const all = balances(karma());
    assert.deepEqual(
      Object.fromEntries(["649.90", "770.90", "602.90", "600.90", "610.90", "336.90"].map(key => [key, all.sub[key] ?? 0])),
      { "649.90": -800, "770.90": 480, "602.90": -1200, "600.90": -11100, "610.90": 360, "336.90": -750 },
    );
    assert.deepEqual([all.acc["601"], all.acc["602"], all.acc["336"]], [-12500, -2200, -750], "601 · 602 (L10 1.000 eski + 602.90) · 336");
    const novEnd = balances(karma(), "2026-11-30");
    assert.deepEqual([novEnd.acc["191"] ?? 0, novEnd.acc["391"] ?? 0, novEnd.acc["360"]], [200, 0, -1600], "Kasım sonu: 391 0, 191 +200 (P4 Aralık döneminde), 360 −1.300 − 200 − 100");
  });
});
