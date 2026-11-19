// 2.5.0 Ç7b tur 2c — KURAL GEÇİŞ GÜNÜ (BAŞ MİMAR KARARI 19.11 04:35 B-6 ve 05:07 B-8 = A; docs/erp/C7B-FATURA-TASARIM.md §13). KARAR METNİ: KG-3 (kayıt tahsilatı 602 → 336.90),
// KG-8 (satıştan iade KDV'si 391 → 191) ve F-08 (alıştan iade KDV'si 191 → 391) yeni yönü KURAL GEÇİŞ GÜNÜ'nden sonraki kayıtlara; geçiş günü güncellemedeki kilit tarihi (kilitsiz
// dosyada geçiş yok); geçişten önceki kayıtlar eski yönde (kilit sonradan açılıp kapansa da). B-6: güncellemeden önce KDV mahsubu yazılmış ayın iade KDV'si eski yönde; mahsup ters
// kaydedilip yeniden yazılırsa o ay yeni yöne geçer. Göç 51 yalnız işaret (tutar yok). Değişmez: kilitli eski veride 336 / 191 / 391 için Kural Değişikliği Farkı ÇIKMAZ; Defter
// Mutabakatı + Mutabakat Testi her adımda temiz.
// Veri v2.4.9'un GERÇEK koduyla API'den (ders 17); sahte saat (ders 13); lisans servisi yok (ders 30). BEKLENEN SAYILAR elle (faturaların KDV'si; ders 5):
//   Eylül: S1 2 × 1.000 (KDV 400), P1 2 × 500 (KDV 200), SR1 S1'in 1 adedi 30.09 (KDV 200), PR1 P1'in 1 adedi 29.09 (KDV 100) — Eylül mahsubu v2.4.9'da: H 200 / İ 100 / ödenecek 100.
//   Ekim: S2, P2, SR2 20.10, PR2 21.10 (aynı tutarlar) — Ekim mahsubu v2.4.9'da: H 200 / İ 100. Kasım: S3, P3, SR3 10.11, PR3 11.11 (mahsup YOK).
//   Kayıt tahsilatları: 29.09 100 TL, 30.09 200 TL (geçiş günü), 01.10 400 TL. Kilit (v2.4.9'da) 30.09.2026.
// NASIL BOZARIM (mutantlar): geçişi yok saymak (hep yeni kural → 30.09 tahsilatı 336.90, kural farkı uyarısı); '≤' yerine '<' (30.09 tahsilatı / SR1 yeni yöne); mahsup işaretini yok
// saymak (Ekim Güncel Değil, SR2 191); süzgeçte eski formül (iade yazımında süzgeç bulgusu — banka-210-gg-cari); göçte işaret yazmamak (geçiş yok → kural farkı).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-12-10T12:00:00+03:00", fixed: true };
const LOCK = "2026-09-30";
const TAX = "/api/workspace/tax";
const skip = tagsAvailable(["v2.4.9"]) ? false : "v2.4.9 etiketi yok";

const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};

/** v2.4.9'un gerçek koduyla veri: iki cari, kayıt tahsilatları, üç ayın satış / alış / iadeleri, Eylül ve Ekim mahsupları; isteğe bağlı kilit. */
async function makeOld(dirs, { lock = LOCK, months = ["2026-09", "2026-10", "2026-11"], offsets = ["2026-09", "2026-10"] } = {}) {
  // legacyCasePayments: kayıt tahsilatı 2.4.5'ten beri üretimde kapalı (410); 2.4.5 öncesinden kalan tahsilatı v2.4.9'un kendi API'siyle üretmek için testlerdeki anahtar (surumler.mjs).
  const old = await bootVersion("v2.4.9", { ...dirs, now: NOW, legacyCasePayments: true });
  try {
    const api = await old.login();
    const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Geçiş Müşteri", type: "customer", registeredOn: "2026-08-01" }))).id;
    const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Geçiş Tedarikçi", type: "supplier", registeredOn: "2026-08-01" }))).id;
    for (const [key, amount, date] of [["GECIS-1", "100", "2026-09-29"], ["GECIS-2", "200", "2026-09-30"], ["GECIS-3", "400", "2026-10-01"]]) {
      await must(`kayıt tahsilatı ${date}`, api.post(`/api/workspace/cases/${key}/payments`, { amount, date, method: "cash", caseTitle: key }));
    }
    const card = async id => must("fatura", api.get(`/api/workspace/invoices/${id}`));
    const days = { "2026-09": ["10", "05", "30", "29"], "2026-10": ["05", "06", "20", "21"], "2026-11": ["03", "04", "10", "11"] };
    let n = 0;
    const month = async m => {
      const [s, p, sr, pr] = days[m];
      const S = (await must(`satış ${m}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: M, issueDate: `${m}-${s}`, lines: [{ name: "Danışmanlık", qty: 2, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }))).id;
      const P = (await must(`alış ${m}`, api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: `${m}-${p}`, number: `GA-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 2, unitPrice: 500, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id;
      const sLine = (await card(S)).lines[0].id;
      await must(`satıştan iade ${m}`, api.post("/api/workspace/invoices", { kind: "sale_return", accountId: M, originalId: S, issueDate: `${m}-${sr}`, lines: [{ originLineId: sLine, qty: 1 }], payment: { cash: [] }, force: true }));
      const pLine = (await card(P)).lines[0].id;
      await must(`alıştan iade ${m}`, api.post("/api/workspace/invoices", { kind: "purchase_return", accountId: T, originalId: P, issueDate: `${m}-${pr}`, number: `GI-${n}`, lines: [{ originLineId: pLine, qty: 1 }], payment: { cash: [] }, force: true }));
      if (offsets.includes(m)) await must(`KDV mahsubu ${m}`, api.post(`${TAX}/vat-offset`, { month: m }));
      if (lock && m === lock.slice(0, 7)) await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: lock }));
    };
    for (const m of months) await month(m);
  } finally {
    await old.close();
  }
}

/** Yevmiyeden kaynak kaydın vergi / tahsilat satırının hesabı. */
function accountsOf(app) {
  const store = app.store;
  const entries = app.ledger.build();
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const payment = date => {
    const row = store.get("SELECT id FROM payments WHERE date = ? ORDER BY rowid LIMIT 1", date);
    const line = byId.get(`payment:${row.id}`).lines.find(item => item.credit > 0);
    return line.sub || line.account;
  };
  const vat = (kind, date) => {
    const row = store.get("SELECT id FROM invoices WHERE kind = ? AND issue_date = ? AND status = 'issued'", kind, date);
    const entry = byId.get(`invoice:${row.id}`);
    const line = entry.lines.find(item => (item.account === "191" || item.account === "391") && (kind === "sale_return" ? item.debit > 0 : item.credit > 0));
    return line.account;
  };
  return { payment, vat, entries };
}
const balanceOf = (entries, account) => entries.reduce((sum, entry) => sum + entry.lines.filter(line => line.account === account).reduce((s, line) => s + line.debit - line.credit, 0), 0);

async function cleanScan(api, label) {
  const scan = await must(`Mutabakat Testi (${label})`, api.get("/api/workspace/ledger/integrity"));
  const failures = (scan.failures || []).map(item => item.code);
  assert.deepEqual(failures, [], `${label}: Mutabakat Testi temiz (Defter Mutabakatı + kural farkı yok): ${JSON.stringify(scan.failures || []).slice(0, 600)}`);
  assert.equal(scan.ok, true, label);
  const diff = (scan.checks || []).find(item => item.code === "ledger:rule-diff");
  assert.ok(!diff || diff.ok === true, `${label}: Kural Değişikliği Farkı yok: ${String(JSON.stringify(diff)).slice(0, 400)}`);
  return scan;
}

describe("Ç7b tur 2c — kural geçiş günü (B-8 = A + B-6; v2.4.9 gerçek kodunun verisi)", () => {
  it("kilitli eski dosya: geçiş günü = güncellemedeki kilit; gün sınırı (29.09 / 30.09 / 01.10); eski mahsup ayı; ters kayıt → yeni yön; kilit ileri / geri / açık; göç yeniden; geri yükleme", { timeout: 300_000, skip }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "c7b-gecis-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    let server = null;
    try {
      await makeOld(dirs);
      server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
      let app = server.app;
      await app.ledger.snapshots.runPending();
      assert.equal(app.ledger.snapshots.state().pending, null, "açılıştaki dondurma bitmeli");
      let api = await server.login();
      // (1) Göç 51'in işaretleri (yalnız işaret; tutar yok).
      assert.equal(app.store.get("SELECT value FROM settings WHERE key = 'ledger.ruleShiftThrough'").value, LOCK, "geçiş günü = güncellemedeki kilit");
      assert.deepEqual(app.store.all("SELECT month, rule_version AS v, out_minor AS o, in_minor AS i, payable_minor AS p FROM vat_offsets ORDER BY month").map(row => `${row.month} ${row.v} ${row.o}/${row.i}/${row.p}`), ["2026-09 2.4.9 20000/10000/10000", "2026-10 2.4.9 20000/10000/10000"], "eski mahsuplar işaretli, saklı tutarlar DEĞİŞMEDİ (elle: H 200 / İ 100 / ödenecek 100)");
      // (2) Gün sınırı ve ay kuralı.
      let at = accountsOf(app);
      assert.deepEqual([at.payment("2026-09-29"), at.payment("2026-09-30"), at.payment("2026-10-01")], ["602", "602", "336.90"], "KG-3: geçiş gününde ve öncesinde 602, sonraki gün 336.90");
      assert.deepEqual([at.vat("sale_return", "2026-09-30"), at.vat("purchase_return", "2026-09-29")], ["391", "191"], "geçiş gününde / öncesinde iade KDV'si eski yönde");
      assert.deepEqual([at.vat("sale_return", "2026-10-20"), at.vat("purchase_return", "2026-10-21")], ["391", "191"], "B-6: güncellemeden önce mahsup edilmiş Ekim eski yönde");
      assert.deepEqual([at.vat("sale_return", "2026-11-10"), at.vat("purchase_return", "2026-11-11")], ["191", "391"], "mahsupsuz Kasım yeni yönde (KG-8 / F-08)");
      // Elle: Kasım 191 = P3 200 + SR3 200 = 400; 391 = −(S3 400 + PR3 100) = −500; 336 = −400 (yalnız 01.10 tahsilatı); Eylül ve Ekim mahsupla kapalı.
      assert.deepEqual([balanceOf(at.entries, "191"), balanceOf(at.entries, "391"), balanceOf(at.entries, "336")], [40000, -50000, -40000], "191 / 391 / 336 bakiyeleri (elle)");
      const expected = app.ledger.expected();
      assert.deepEqual([expected[191], expected[391], expected[336]], [400, -500, -400], "Defter Mutabakatı'nın beklenenleri aynı kuralla");
      await cleanScan(api, "güncelleme sonrası");
      let list = (await must("mahsup listesi", api.get(`${TAX}/vat-offset`))).offsets;
      assert.deepEqual(list.map(item => `${item.month} ${item.stale}`), ["2026-09 false", "2026-10 false"], "eski mahsuplar Güncel Değil DEĞİL");
      // (3) Ekim mahsubu ters kaydedilir → Ekim yeni yöne geçer; yeniden mahsup yeni yönle (elle: H = 400 + PR2 100 = 500, İ = 200 + SR2 200 = 400, ödenecek aynı 100).
      const oct = list.find(item => item.month === "2026-10");
      await must("Ekim Geri Al", api.post(`${TAX}/vat-offset/${oct.id}/reverse`, {}));
      at = accountsOf(app);
      assert.deepEqual([at.vat("sale_return", "2026-10-20"), at.vat("purchase_return", "2026-10-21")], ["191", "391"], "ters kaydedilen ay yeni yönde");
      await cleanScan(api, "Ekim ters kaydı sonrası");
      const view = (await must("Ekim ön izleme", api.get(`${TAX}/vat-offset?month=2026-10`))).preview;
      assert.deepEqual([view.outMinor, view.inMinor, view.payableMinor], [50000, 40000, 10000], "Ekim yeniden: yeni yönle H 500 / İ 400 / ödenecek 100");
      await must("Ekim yeniden mahsup", api.post(`${TAX}/vat-offset`, { month: "2026-10" }));
      assert.equal(app.store.get("SELECT rule_version AS v FROM vat_offsets WHERE month = '2026-10' AND status = 'active'").v, "", "yeni mahsup güncel kuralla (işaretsiz)");
      at = accountsOf(app);
      assert.deepEqual([balanceOf(at.entries, "191"), balanceOf(at.entries, "391")], [40000, -50000], "Ekim yeniden kapandı; yalnız Kasım açık");
      await cleanScan(api, "Ekim yeniden mahsup sonrası");
      // (4) Kilit İLERİ (31.10): geçiş günü sabit; yeni yön donar, kural farkı yok. Göç 51 yeniden koşarsa (sürüm elle düşürülmüş dosya) işaretler DEĞİŞMEZ.
      await must("kilit ileri", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-31" }));
      await app.ledger.snapshots.runPending();
      await cleanScan(api, "kilit ileri");
      MIGRATIONS.find(item => item.version === 51).up(app.store, { now: () => new Date(NOW.time) });
      assert.equal(app.store.get("SELECT value FROM settings WHERE key = 'ledger.ruleShiftThrough'").value, LOCK, "yeniden koşan göç geçiş gününü değiştirmez (kilit artık 31.10)");
      assert.deepEqual(app.store.all("SELECT month, status, rule_version AS v FROM vat_offsets ORDER BY month, rowid").map(row => `${row.month} ${row.status} ${row.v}`), ["2026-09 active 2.4.9", "2026-10 reversed 2.4.9", "2026-10 active "], "yeniden koşan göç yeni mahsubu eski saymaz");
      // (5) Kilit kalkar; geçiş gününden önce tarihli YENİ kayıt eski yönde (tek tanım), sonrası yeni; yeniden kilit (güncel kuralla donar) temiz.
      await must("kilidi kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
      await app.ledger.snapshots.runPending();
      // Programın kendi yolundan geçiş öncesi tarihli kayıt: yeni kayıt tahsilatı üretimde kapalı (2.4.5; 410), iade faturası belge serisinin tarih sırasıyla geriye yazılamaz — kalan yol
      // Silinenler: 29.09 tahsilatı silinip geri yüklenir (kendi tarihiyle döner → eski yön, tek tanım); Kasım'a S3'ün ikinci iadesi (yeni yön).
      const M = app.store.get("SELECT id FROM accounts WHERE name = 'Geçiş Müşteri'").id;
      const early = app.store.get("SELECT id FROM payments WHERE date = '2026-09-29'").id;
      await must("29.09 tahsilatını sil", api.del(`/api/workspace/payments/${early}?cashForce=1`));
      assert.equal(app.ledger.expected()[336], -400, "silinen tahsilat 336'yı değiştirmez (602'deydi)");
      const trashId = app.store.get("SELECT id FROM trash WHERE ref = ? AND restored_at IS NULL ORDER BY deleted_at DESC LIMIT 1", early).id;
      await must("Silinenler'den geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${trashId}` }));
      const s3 = app.store.get("SELECT id FROM invoices WHERE kind = 'sale' AND issue_date = '2026-11-03'").id;
      const s3Line = (await must("fatura", api.get(`/api/workspace/invoices/${s3}`))).lines[0].id;
      await must("Kasım ikinci iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: M, originalId: s3, issueDate: "2026-11-20", lines: [{ originLineId: s3Line, qty: 1 }], payment: { cash: [] }, force: true }));
      at = accountsOf(app);
      assert.deepEqual([at.payment("2026-09-29"), at.vat("sale_return", "2026-11-20")], ["602", "191"], "kilit açıkken geri gelen kayıt: tarihi geçiş gününde / öncesindeyse eski yön (tek tanım)");
      // Elle: 191 = Kasım 400 + ikinci iade 200 = 600; 391 = Kasım −500; 336 = −400.
      assert.deepEqual([app.ledger.expected()[191], app.ledger.expected()[391], app.ledger.expected()[336]], [600, -500, -400], "beklenen 191 / 391 / 336 (elle)");
      await cleanScan(api, "kilit kalktı, yeni kayıtlar");
      await must("yeniden kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      await app.ledger.snapshots.runPending();
      await cleanScan(api, "yeniden kilit");
      // (6) Geri yükleme: göç öncesi (v2.4.9) yedeği → göç 51 o yedeğin kilidiyle yeniden; işaretler ve yönler güncelleme anındaki gibi.
      const listing = await must("yedekler", api.get("/api/admin/backups"));
      const backups = Array.isArray(listing) ? listing : listing.backups || [];
      const pre = backups.find(item => /pre-migration/.test(item.name));
      assert.ok(pre, `göç öncesi yedek: ${JSON.stringify(backups.map(item => item.name))}`);
      await must("göç öncesi yedeği geri yükle", api.post("/api/admin/backups/restore", { name: pre.name, company: pre.companyId || "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
      await server.close();
      server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
      app = server.app;
      await app.ledger.snapshots.runPending();
      api = await server.login();
      assert.equal(app.store.get("SELECT value FROM settings WHERE key = 'ledger.ruleShiftThrough'").value, LOCK, "geri yüklemede geçiş günü = yedeğin kilidi");
      assert.equal(app.store.get("SELECT COUNT(*) AS n FROM invoices WHERE issue_date = '2026-11-20'").n, 0, "ön koşul: yedekteki veri (sonraki iade yok)");
      assert.deepEqual(app.store.all("SELECT month, rule_version AS v FROM vat_offsets ORDER BY month, rowid").map(row => `${row.month} ${row.v}`), ["2026-09 2.4.9", "2026-10 2.4.9"], "geri yüklemede eski mahsuplar yeniden işaretli");
      at = accountsOf(app);
      assert.deepEqual([at.payment("2026-09-30"), at.payment("2026-10-01"), at.vat("sale_return", "2026-10-20"), at.vat("sale_return", "2026-11-10")], ["602", "336.90", "391", "191"], "geri yüklemeden sonra aynı yönler");
      await cleanScan(api, "geri yükleme sonrası");
    } finally {
      await server?.close().catch(() => {});
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("kilitsiz eski dosya: geçiş yok (bütün tahsilatlar 336.90); güncellemeden önce mahsup edilmiş ay yine eski yönde (B-6)", { timeout: 240_000, skip }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "c7b-gecis-k-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    let server = null;
    try {
      await makeOld(dirs, { lock: "", months: ["2026-10", "2026-11"], offsets: ["2026-10"] });
      server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
      const app = server.app;
      await app.ledger.snapshots.runPending();
      const api = await server.login();
      assert.equal(app.store.get("SELECT value FROM settings WHERE key = 'ledger.ruleShiftThrough'").value, "", "kilitsiz dosyada geçiş yok ('' yazılır)");
      const at = accountsOf(app);
      assert.deepEqual([at.payment("2026-09-29"), at.payment("2026-09-30"), at.payment("2026-10-01")], ["336.90", "336.90", "336.90"], "kilitsiz: hepsi yeni kural");
      assert.deepEqual([at.vat("sale_return", "2026-10-20"), at.vat("purchase_return", "2026-10-21"), at.vat("sale_return", "2026-11-10"), at.vat("purchase_return", "2026-11-11")], ["391", "191", "191", "391"], "Ekim (eski mahsup) eski, Kasım yeni");
      assert.equal(app.ledger.expected()[336], -700, "336: 100 + 200 + 400");
      await cleanScan(api, "kilitsiz güncelleme sonrası");
      assert.equal((await must("liste", api.get(`${TAX}/vat-offset`))).offsets.find(item => item.month === "2026-10").stale, false, "Ekim Güncel Değil değil");
    } finally {
      await server?.close().catch(() => {});
      rmSync(root, { recursive: true, force: true });
    }
  });
});
