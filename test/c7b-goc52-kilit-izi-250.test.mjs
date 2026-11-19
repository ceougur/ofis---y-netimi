// 2.5.0 Ç7b tur 2d — (a) göç 52 (KG-7: invoices.vat_period; boş = belge ayı) eski sürümün GERÇEK verisinde; (b) tur 2c kararı (2): kural geçiş günü ve eski KDV mahsubunun kural sürümü
// KİLİT İZİNDE (LOCK_SQL_VERSION 2.5.2; B-7 düzeni) — var olan kilitte yanlış alarm YOK, kapı dışı değişiklik görünür; (c) tur 2c kararı (3): "Tüm Hareketleri Sil" geçiş gününü siler.
// docs/erp/C7B-FATURA-TASARIM.md §14.1, §14.6, §14.7, §14.8 (8)–(10). Veri v2.4.9'un GERÇEK koduyla API'den (ders 17); sahte saat (ders 13); lisans servisi yok (ders 30). Beklenenler elle:
//   Eylül / Ekim / Kasım: satış 2 × 1.000 (KDV 400), alış 2 × 500 (KDV 200), satıştan iade 1 adet (KDV 200), alıştan iade 1 adet (KDV 100). Eylül ve Ekim mahsubu v2.4.9'da (H 200 / İ 100);
//   kilit 30.09.2026. Kasım (geçiş sonrası, mahsupsuz — yeni yön): H = 400 + alıştan iade 100 = 500, İ = 200 + satıştan iade 200 = 400, ödenecek 100.
// NASIL BOZARIM: göç sütunu varsayılansız (NULL) eklemek; göçte değer yazmak (belge ayı doldurmak); kilit izine eki koymamak (kapı dışı değişiklik izsiz); eki sürüme bağlamamak (2.5.1 koşusunda
//   yanlış alarm); Sıfırla'da geçiş gününü silmemek.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { LOCK_SQL_VERSION, lockDigestOf } from "../server/lib/integrity.mjs";
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

async function makeOld(dirs) {
  const old = await bootVersion("v2.4.9", { ...dirs, now: NOW });
  const before = {};
  try {
    const api = await old.login();
    const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Göç52 Müşteri", type: "customer", registeredOn: "2026-08-01" }))).id;
    const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Göç52 Tedarikçi", type: "supplier", registeredOn: "2026-08-01" }))).id;
    const card = async id => must("fatura", api.get(`/api/workspace/invoices/${id}`));
    const days = { "2026-09": ["10", "05", "30", "29"], "2026-10": ["05", "06", "20", "21"], "2026-11": ["03", "04", "10", "11"] };
    let n = 0;
    for (const m of ["2026-09", "2026-10", "2026-11"]) {
      const [s, p, sr, pr] = days[m];
      const S = (await must(`satış ${m}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: M, issueDate: `${m}-${s}`, lines: [{ name: "Danışmanlık", qty: 2, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }))).id;
      const P = (await must(`alış ${m}`, api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: `${m}-${p}`, number: `GA-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 2, unitPrice: 500, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id;
      await must(`satıştan iade ${m}`, api.post("/api/workspace/invoices", { kind: "sale_return", accountId: M, originalId: S, issueDate: `${m}-${sr}`, lines: [{ originLineId: (await card(S)).lines[0].id, qty: 1 }], payment: { cash: [] }, force: true }));
      await must(`alıştan iade ${m}`, api.post("/api/workspace/invoices", { kind: "purchase_return", accountId: T, originalId: P, issueDate: `${m}-${pr}`, number: `GI-${n}`, lines: [{ originLineId: (await card(P)).lines[0].id, qty: 1 }], payment: { cash: [] }, force: true }));
      if (m !== "2026-11") await must(`KDV mahsubu ${m}`, api.post(`${TAX}/vat-offset`, { month: m }));
      if (m === "2026-09") await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    }
    before.offsets = old.app.store.all("SELECT id, month, out_minor, in_minor, carry_in_minor, carry_out_minor, payable_minor, status FROM vat_offsets ORDER BY id");
    before.invoices = old.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
  } finally {
    await old.close();
  }
  return before;
}

describe("Ç7b tur 2d — göç 52, kilit izi eki, Sıfırla eki (v2.4.9 gerçek verisi)", { skip }, () => {
  let root = "";
  let server = null;
  let old = null;
  let store = null;
  let api = null;
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "c7b2d-goc52-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    old = await makeOld(dirs);
    server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
    store = server.app.store;
    await server.app.ledger.snapshots.runPending();
    assert.equal(server.app.ledger.snapshots.state().pending, null, "açılıştaki dondurma bitmeli");
    api = await server.login();
  }, { timeout: 300_000 });
  after(async () => {
    await server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("(a) göç 52 değer yazmaz ('' = belge ayı), NOT NULL DEFAULT '', eşgüçlü; saklı mahsuplar aynen; Kasım ön izlemesi elle", async () => {
      const before = old;
      // (a) Göç 52: sütun NOT NULL DEFAULT '', her eski fatura '' (değer YAZILMADI); saklı mahsuplar aynen; yeniden koşu eşgüçlü.
      const column = store.all("PRAGMA table_info(invoices)").find(item => item.name === "vat_period");
      assert.ok(column, "göç 52 sütunu ekledi");
      assert.deepEqual([column.notnull, column.dflt_value], [1, "''"], "NOT NULL DEFAULT ''");
      assert.deepEqual(store.all("SELECT DISTINCT vat_period AS v FROM invoices").map(row => row.v), [""], "eski faturalar: boş (belge ayı)");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM invoices").n, before.invoices);
      assert.deepEqual(store.all("SELECT id, month, out_minor, in_minor, carry_in_minor, carry_out_minor, payable_minor, status FROM vat_offsets ORDER BY id"), before.offsets, "saklı mahsuplar değişmedi");
      MIGRATIONS.find(item => item.version === 52).up(store);
      assert.deepEqual(store.all("SELECT DISTINCT vat_period AS v FROM invoices").map(row => row.v), [""], "yeniden koşu eşgüçlü");
      const nov = (await must("Kasım ön izleme", api.get(`${TAX}/vat-offset?month=2026-11`))).preview;
      assert.deepEqual([nov.outMinor, nov.inMinor, nov.payableMinor], [50000, 40000, 10000], "Kasım: H 500 / İ 400 / ödenecek 100 (elle)");
      const list = (await must("liste", api.get(`${TAX}/vat-offset`))).offsets;
      assert.deepEqual(list.map(item => `${item.month} ${item.stale}`), ["2026-09 false", "2026-10 false"], "eski mahsuplar Güncel Değil değil");
  });

  it("(b) kilit izi 2.5.2 geçiş gününü ve kilitli mahsubun kural sürümünü izler, 2.5.1 tanımı izlemez; güncellemede yanlış alarm yok; kapı dışı değişiklik görünür", async () => {
      // (b1) Güncellemede yanlış alarm yok (kilit izi / donmuş defter kaynağı) — yeni tanımla.
      const scan = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
      const failures = (scan.failures || []).map(item => item.code);
      assert.equal(failures.includes("period-lock"), false, `kilit izi alarmı: ${JSON.stringify(failures)}`);
      assert.equal(failures.includes("ledger:snapshot"), false, `donmuş defter kaynağı: ${JSON.stringify(failures)}`);
      const run = store.get("SELECT digest_version AS v, source_digest AS d FROM ledger_snapshot_runs WHERE state = 'done' ORDER BY no DESC LIMIT 1");
      assert.equal(lockDigestOf(store, LOCK, { version: run.v }), run.d, "koşunun kaynak izi");
      // Ön koşul: geçiş günü = güncellemedeki kilit; Eylül mahsubu (kilitli) '2.4.9' işaretli.
      assert.equal(store.get("SELECT value FROM settings WHERE key = 'ledger.ruleShiftThrough'").value, LOCK);
      const sep = store.get("SELECT id, rule_version AS v FROM vat_offsets WHERE month = '2026-09'");
      assert.equal(sep.v, "2.4.9");
      // (b2) Kapı dışı değişiklik (ayrı bağlantı): güncel iz değişir, 2.5.1 tanımının izi değişmez (önceki koşu yanlış alarm vermez).
      const digests = () => ({ now: lockDigestOf(store, LOCK, { version: LOCK_SQL_VERSION }), v251: lockDigestOf(store, LOCK, { version: "2.5.1" }) });
      const base = digests();
      const other = new DatabaseSync(store.get("PRAGMA database_list").file);
      try {
        other.exec("PRAGMA busy_timeout = 5000");
        for (const [label, sql, args, undo] of [
          ["geçiş günü", "UPDATE settings SET value = '2026-09-15' WHERE key = 'ledger.ruleShiftThrough'", [], ["UPDATE settings SET value = ? WHERE key = 'ledger.ruleShiftThrough'", [LOCK]]],
          ["geçiş günü silindi", "UPDATE settings SET value = '' WHERE key = 'ledger.ruleShiftThrough'", [], ["UPDATE settings SET value = ? WHERE key = 'ledger.ruleShiftThrough'", [LOCK]]],
          ["kilitli mahsubun kural sürümü", "UPDATE vat_offsets SET rule_version = '' WHERE id = ?", [sep.id], ["UPDATE vat_offsets SET rule_version = '2.4.9' WHERE id = ?", [sep.id]]],
        ]) {
          other.prepare(sql).run(...args);
          try {
            const after = digests();
            assert.notEqual(after.now, base.now, `${label}: güncel kilit izi değişmeli`);
            assert.equal(after.v251, base.v251, `${label}: 2.5.1 tanımının izi değişmemeli`);
            if (label === "geçiş günü") {
              const bad = await must("Mutabakat Testi (kapı dışı)", api.get("/api/workspace/ledger/integrity"));
              const snap = [...(bad.failures || []), ...(bad.checks || [])].find(item => item.code === "ledger:snapshot" && item.ok === false);
              assert.ok(snap, `kapı dışı geçiş günü değişikliği donmuş dönemin kaynağı değişti diye görünür: ${JSON.stringify((bad.failures || []).map(item => item.code))}`);
            }
          } finally {
            other.prepare(undo[0]).run(...undo[1]);
          }
        }
        // Açık dönemdeki (Ekim, 31.10 > kilit) mahsubun işareti kilitli izde değil.
        const oct = store.get("SELECT id FROM vat_offsets WHERE month = '2026-10'");
        other.prepare("UPDATE vat_offsets SET rule_version = '' WHERE id = ?").run(oct.id);
        try {
          assert.equal(digests().now, base.now, "kilit gerisindeki mahsup yalnız");
        } finally {
          other.prepare("UPDATE vat_offsets SET rule_version = '2.4.9' WHERE id = ?").run(oct.id);
        }
      } finally {
        other.close();
      }
      assert.deepEqual(digests(), base, "geri alındı");
      assert.equal(LOCK_SQL_VERSION, "2.5.2", "kilit izi tanımının sürümü arttı (tur 2c kararı (2))");
      assert.equal(run.v, "2.5.2", "güncellemedeki dondurma koşusu güncel tanımla");
  });

  it("(c) Tüm Hareketleri Sil kural geçiş gününü siler", async () => {
      assert.equal(store.get("SELECT value FROM settings WHERE key = 'ledger.ruleShiftThrough'")?.value, LOCK, "ön koşul: geçiş günü var");
      // (c) Tüm Hareketleri Sil: geçiş günü silinir (kilit de kalkar).
      await must("sıfırla", api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
      assert.equal(store.get("SELECT value FROM settings WHERE key = 'ledger.ruleShiftThrough'"), undefined, "geçiş günü silindi");
      assert.equal(store.get("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'")?.value || "", "", "kilit kalktı");
  });
});
