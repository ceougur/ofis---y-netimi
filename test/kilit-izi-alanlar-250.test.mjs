// 2.5.0 Ç5-A tur 1f — İş 4 (dar kontrol G-1'; S146 = A): Ana Defter türetmesinin okuduğu, tur 1e'de kilit izinde OLMAYAN alanlar (docs/erp/C5-ACILIS-TASARIM.md §16).
// Önceden (c5a1f-taban): kilitli dönemdeki bu alanlar ayrı bağlantıyla değişince kilitli dönemin CANLI türetmesi değişiyordu (§16.2 (a) — betikle), ama kilit izi görmediği için
// period-lock / ledger:snapshot bulgusu, Mutabakat Günlüğü satırı ve zil yoktu (çoğunda hiçbir denetim görmüyordu; yalnız "Kural Değişikliği Farkı"nın sayısı değişiyordu —
// tur 2'nin Kural Farkı Düzeltme Fişi bunu "kural farkı" diye açık döneme yazardı).
// YOL (§16.5): SINIF 1 alanları (kilitli satırda meşru yazımı olmayan) kilit izinde; SINIF 2'den yanlış alarmsız iki olgu (kilitli karşılıksızı olan evrağın durumu / karşılıksız günü,
// kilitli dönemin "cariye işlenmemiş" evrak kümesi) izde. Süzgeç aynı alanları bilir.
// NASIL BOZULUR (§16.6; testler buradan): [1] satır içi ve [2] arka plan tarama yolu (her alan; sayı / tutar aynı yalnız hesap dağılımı değişenler dahil); [3] program kapalıyken yazım
// açılışta bulunur; [4] meşru olaylar sessiz ve yanıt kodları tabandakiyle AYNI (eski tarihli evrakın bugünkü tahsili / cirosu / karşılıksızı — carili, carisiz, carisiz + cari seçimi;
// tahsile verilmiş evrağın tahsili; kilitli karşılıksızı geri alma 409; açık dönem fatura iptali; taksit kartı kapatma; kilitli kart silme 409; Silinenler'den geri alma; fatura
// numaralamanın ve POS kesinti bağlamanın kapıdan geçen yazımları); [5] kilidi ilerletme / kaldırma / yeniden koyma, yedek → geri yükleme, Şirket Verisini Sıfırla sessiz;
// [6] v2.0.26 ve v2.4.9 gerçek koduyla üretilmiş KİLİTLİ veriyle güncelleme (ilk açılış + ilk tarama + ikinci açılış) sessiz; [7] kapıdan geçen (mağaza) yazım kilitli satırın yeni
// alanını değiştiremez (süzgeç ↔ tam kapı eşdeğer).
// Veri: v2.4.9'un GERÇEK koduyla API'den (ders 17, 23); kilit v2.4.9'da konur. API'nin üretemediği tek kaynak durumu (Kayıt Tarihi boş kart — yalnız eski sürüm / dış araç) v2.4.9'da
// kilitten ÖNCE ayrı bağlantıyla kurulur. Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30). Kapı dışı yazım ayrı bağlantıyla.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const TODAY = "2026-10-20";
const LOCK = "2026-10-10";
const WAIT_MS = 60_000;
const OLD = "v2.4.9";
const SKIP = !tagsAvailable([OLD]) ? `${OLD} etiketi yok` : false;

const within = (promise, label) => {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} ${WAIT_MS / 1000} sn'de olmadı`)), WAIT_MS);
    timer.unref?.();
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
};
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const codesOf = list => (list || []).map(item => item.code);
const QUIET = { gunluk: 0, zil: [], sunucu: [] };

// ---------- v2.4.9 verisi (bir kez; her durum kendi kopyasında) ----------
let template = "";
const ids = {};
async function makeTemplate() {
  template = mkdtempSync(path.join(tmpdir(), "c5a1f-iz-tpl-"));
  const old = await bootVersion(OLD, { dataDir: path.join(template, "data"), backupDir: path.join(template, "backups"), now: NOW });
  try {
    const api = await old.login();
    const q = (sql, ...args) => old.app.store.get(sql, ...args);
    await must("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
    const bank = await must("banka", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } }));
    ids.bank = bank.id || bank.account?.id;
    await must("çek kullan", api.put(`/api/workspace/bank/accounts/${ids.bank}`, { useCheque: true, useNote: true }));
    await must("kasa", api.post("/api/workspace/cash", { kind: "in", amount: "5000", date: "2026-10-01", description: "Kasa girişi" }));
    await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "1000", date: "2026-10-02", bankAccountId: ids.bank }));
    const A = await must("A", api.post("/api/workspace/accounts", { name: "Tur1f A", type: "customer", registeredOn: "2026-10-01" }));
    const S = await must("S", api.post("/api/workspace/accounts", { name: "Tur1f Kiraya Veren", type: "supplier", registeredOn: "2026-10-01" }));
    const T = await must("T", api.post("/api/workspace/accounts", { name: "Tur1f Temizlik", type: "supplier", registeredOn: "2026-10-01" }));
    Object.assign(ids, { A: A.id, S: S.id, T: T.id });
    await must("A borç", api.post(`/api/workspace/accounts/${A.id}/entries`, { kind: "debt", amount: "3000", date: "2026-10-02", note: "Hizmet" }));
    const cheque = body => must(`evrak ${body.serialNo}`, api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", dueDate: "2026-12-01", issueDate: "2026-10-03", ...body }));
    await cheque({ serialNo: "T1F-1", amount: "400", accountId: A.id });
    await cheque({ serialNo: "T1F-2", amount: "300" });
    await cheque({ serialNo: "T1F-3", amount: "250" });
    await cheque({ serialNo: "T1F-4", amount: "350", accountId: A.id });
    await cheque({ serialNo: "T1F-5", amount: "150", accountId: A.id });
    await cheque({ serialNo: "T1F-7", amount: "180" });
    await cheque({ serialNo: "T1F-8", amount: "170" });
    await cheque({ serialNo: "T1F-9", amount: "160", accountId: A.id });
    for (const n of [1, 2, 3, 4, 5, 7, 8, 9]) ids[`cheque${n}`] = q("SELECT id FROM cheques WHERE serial_no = ?", `T1F-${n}`).id;
    await must("T1F-2 karşılıksız (kilitte)", api.post(`/api/workspace/cheques/${ids.cheque2}/actions`, { action: "bounce", date: "2026-10-05" }));
    await must("T1F-4 tahsile ver (kilitte)", api.post(`/api/workspace/cheques/${ids.cheque4}/actions`, { action: "bank-deposit", date: "2026-10-05", bankAccountId: ids.bank }));
    await must("T1F-5 tahsile ver (kilitte)", api.post(`/api/workspace/cheques/${ids.cheque5}/actions`, { action: "bank-deposit", date: "2026-10-05", bankAccountId: ids.bank }));
    await must("T1F-5 tahsil (kilitte)", api.post(`/api/workspace/cheques/${ids.cheque5}/actions`, { action: "collect", date: "2026-10-07", method: "bank" }));
    const goods = await must("ürün", api.post("/api/workspace/stock", { name: "Tur1f Ürün", code: "URN-T1F", unit: "Adet", unitPrice: "10", salePrice: "100" }));
    await must("alım", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "100", unitPrice: "10", pay: "none", date: "2026-10-01" }));
    await must("cariye satış", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "5", unitPrice: "100", pay: "account", method: "cash", accountId: A.id, date: "2026-10-04" }));
    await must("peşin satış", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "2", unitPrice: "100", pay: "cash", method: "cash", date: "2026-10-04" }));
    await must("kira (stopaj)", api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: S.id, issueDate: "2026-10-02", number: "KIRA-10", profile: "KAGIT", stoppageRate: 20, lines: [{ name: "Ekim Kirası", qty: 1, unitPrice: 10000, vatRate: 0, exemptionCode: "351", expenseCode: "rent" }], payment: { rest: "open" } }));
    await must("temizlik (tevkifat)", api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: T.id, issueDate: "2026-10-03", number: "PRL-10", profile: "KAGIT", lines: [{ name: "Temizlik Hizmeti", qty: 1, unitPrice: 2000, vatRate: 20, withholdingCode: "612", expenseCode: "cleaning" }], payment: { rest: "open" } }));
    await must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: A.id, issueDate: "2026-10-04", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));
    const plan = await must("kart", api.post("/api/workspace/plans", { accountId: A.id, name: "Tur1f A", total: "900", mode: "auto", count: 3, firstDue: "2026-11-05", registeredOn: "2026-10-01" }));
    ids.plan = plan.id || q("SELECT id FROM plans WHERE account_id = ? ORDER BY rowid LIMIT 1", A.id).id;
    await must("kart tahsilatı", api.post(`/api/workspace/plans/${ids.plan}/entries`, { kind: "in", amount: "100", date: "2026-10-05", method: "cash" }));
    await cheque({ serialNo: "T1F-6", amount: "200", accountId: A.id, planId: ids.plan, issueDate: "2026-10-06" });
    const blank = await must("Kayıt Tarihi boş olacak kart", api.post("/api/workspace/plans", { accountId: S.id, name: "Tur1f Boş Tarih", total: "500", registeredOn: "2026-10-02" }));
    ids.blankPlan = blank.id || q("SELECT id FROM plans WHERE name = 'Tur1f Boş Tarih'").id;
    // DÜŞÜK-A (dar kontrol): Excel'den yüklenen kart (yükleme damgası) ve Açılış Olabilir adayı (KG-16; ikinci "Açılış devri" satırı — göç 48).
    await must("excel kart", api.post("/api/workspace/plans/import", { matrix: [["Ad Soyad", "Toplam", "Taksit", "İlk Vade", "Ödenen", "Kayıt"], ["Tur1f Excel", "1000", "2", "05.11.2026", "400", "01.10.2026"]], headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" }, fileName: "t1f.xlsx", linkRecords: false }));
    const O = await must("O", api.post("/api/workspace/accounts", { name: "Tur1f Açılış", type: "customer", registeredOn: "2026-10-01", openingBalance: "800" }));
    await must("O ikinci açılış", api.post(`/api/workspace/accounts/${O.id}/entries`, { kind: "debt", amount: "300", date: "2026-10-02", note: "Açılış devri (ikinci)" }));
    ids.O = O.id;
    await must("şüpheli", api.post(`/api/workspace/accounts/${A.id}/doubtful`, { amount: "1000", date: "2026-10-08", reason: "other" }));
    await must("A tahsilat", api.post(`/api/workspace/accounts/${A.id}/entries`, { kind: "in", amount: "500", date: "2026-10-09", method: "cash", note: "Tahsilat" }));
    // Eski sürüm / dış araçla oluşan kaynak durumu (API üretemez; §16.2): Kayıt Tarihi boş, oluşturma anı kilitli dönemde kart.
    const raw = new DatabaseSync(old.app.store.get("PRAGMA database_list").file);
    try {
      raw.exec("PRAGMA busy_timeout = 5000");
      raw.prepare("UPDATE plans SET registered_on = '', created_at = '2026-10-02T09:00:00.000Z' WHERE id = ?").run(ids.blankPlan);
    } finally {
      raw.close();
    }
    await must("kilit (v2.4.9)", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    const s = old.app.store;
    Object.assign(ids, {
      transferCash: s.get("SELECT id FROM cash_entries WHERE transfer_id <> '' ORDER BY rowid LIMIT 1").id,
      entryCheque: s.get("SELECT id FROM account_entries WHERE source = 'cheque' AND source_id = ?", ids.cheque1).id,
      entryIn: s.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in' AND note = 'Tahsilat'", ids.A).id,
      moveSale: s.get("SELECT id FROM stock_moves WHERE pay = 'account' AND kind = 'out'").id,
      planEntryCash: s.get("SELECT id FROM plan_entries WHERE plan_id = ? AND cheque_id = ''", ids.plan).id,
      planEntryCheque: s.get("SELECT id FROM plan_entries WHERE cheque_id <> '' ORDER BY rowid LIMIT 1").id,
      invSale: s.get("SELECT id FROM invoices WHERE account_id = ? AND kind = 'sale'", ids.A).id,
      invWithheld: s.get("SELECT id FROM invoices WHERE number = 'PRL-10'").id,
      invStoppage: s.get("SELECT id FROM invoices WHERE number = 'KIRA-10'").id,
      collection4: s.get("SELECT id FROM cheque_collections WHERE cheque_id = ?", ids.cheque4).id,
      collection5: s.get("SELECT id FROM cheque_collections WHERE cheque_id = ?", ids.cheque5).id,
      bounceEvent: s.get("SELECT id FROM cheque_events WHERE cheque_id = ? AND kind = 'bounce'", ids.cheque2).id,
      importId: s.get("SELECT import_id AS i FROM plans WHERE import_id <> '' LIMIT 1").i,
      candidate: s.get("SELECT id FROM account_entries WHERE account_id = ? AND note = 'Açılış devri (ikinci)'", ids.O).id,
    });
  } finally {
    await old.close();
  }
}
const copyOf = () => {
  const root = mkdtempSync(path.join(tmpdir(), "c5a1f-iz-"));
  cpSync(template, root, { recursive: true });
  return { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
};

/** Açılış + gözlemci (Mutabakat Günlüğü, zil, sunucu günlüğünün Mutabakat satırları — her adımda YALNIZ yeniler). */
async function open(dirs) {
  const lines = [];
  const log = { debug() {}, info() {}, warn: (...a) => lines.push(`warn: ${a.join(" ")}`), error: (...a) => lines.push(`error: ${a.join(" ")}`) };
  const server = await bootVersion(CURRENT, { dataDir: dirs.dataDir, backupDir: dirs.backupDir, now: NOW, integrityScan: false, log });
  const alerts = [];
  server.app.events.tap((event, payload) => {
    if (event === "integrity.alert") alerts.push(codesOf(payload.findings));
  });
  const logRows = () => server.app.store.all("SELECT action, summary FROM integrity_log");
  const opened = { rows: logRows(), lines: lines.filter(line => /Mutabakat/.test(line)) };
  let marks = { rows: opened.rows.length, alerts: 0, lines: lines.length };
  const fresh = () => {
    const rows = logRows();
    const out = { gunluk: rows.length - marks.rows, zil: alerts.slice(marks.alerts), sunucu: lines.slice(marks.lines).filter(line => /Mutabakat taraması/.test(line)) };
    marks = { rows: rows.length, alerts: alerts.length, lines: lines.length };
    return out;
  };
  return { server, app: server.app, opened, fresh };
}
const freezeDone = async app => {
  await within(app.ledger.snapshots.runPending(), "bekleyen dondurmanın bitmesi");
  const state = app.ledger.snapshots.state();
  assert.equal(state.pending, null, `dondurma bitmeli: ${JSON.stringify(state)}`);
  assert.equal(state.coverage, state.lock, `kilitli dönem donmuş olmalı: ${JSON.stringify(state)}`);
  return state;
};
const background = async app => {
  const outcome = await app.integrity.scanInBackground();
  assert.ok(outcome.result, `arka plan taraması koşmalı: ${JSON.stringify(outcome).slice(0, 300)}`);
  assert.equal(app.integrity.lastScan.via, "worker");
  return outcome;
};
async function settled(ctx) {
  await freezeDone(ctx.app);
  const first = await background(ctx.app);
  assert.deepEqual(first.findings, [], `ön koşul: dondurmadan sonraki ilk arka plan taraması sessiz: ${JSON.stringify(codesOf(first.findings))}`);
  assert.deepEqual(ctx.app.integrity.scan().findings, [], "ön koşul: satır içi tarama sessiz");
  assert.deepEqual(ctx.fresh(), QUIET, "ön koşul: günlük / zil / sunucu iletisi yok");
}
function outside(app, sql, ...args) {
  const other = new DatabaseSync(app.store.get("PRAGMA database_list").file);
  try {
    other.exec("PRAGMA busy_timeout = 5000");
    return other.prepare(sql).run(...args).changes;
  } finally {
    other.close();
  }
}
/** Kilitli dönemin canlı türetmesi (tarihi ≤ kilit madde satırlarının çoklu kümesi) — kapı dışı yazımın kilitli defteri gerçekten değiştirdiği ön koşulu. */
const lockedLines = app => {
  const out = [];
  for (const entry of app.ledger.build()) if (String(entry.date) <= LOCK) for (const line of entry.lines || []) out.push(`${entry.date}|${line.account}|${line.sub || ""}|${line.party || ""}|${line.debit || 0}|${line.credit || 0}`);
  return out.sort().join("\n");
};

// Kapı dışı yazımlar (§16.2'nin her izlenen alanı). Hepsi kilitli dönemin canlı türetmesini değiştirir (ön koşul olarak denetlenir).
const LOCKED_SOURCE = ["ledger:snapshot", "period-lock"];
const KINDS = [
  { name: "Kasa ↔ Banka transferinin bağı temizlenir", write: app => outside(app, "UPDATE cash_entries SET transfer_id = '' WHERE id = ?", ids.transferCash) },
  { name: "cari satırının kaynağı (evrak → elle)", write: app => outside(app, "UPDATE account_entries SET source = '' WHERE id = ?", ids.entryCheque) },
  { name: "cari satırının kaynak kimliği başka evrağa", write: app => outside(app, "UPDATE account_entries SET source_id = ? WHERE id = ?", ids.cheque3, ids.entryCheque) },
  { name: "şüpheli alacakta 'Normal Cariye İşlendi' işareti (128 → 120; sayı / tutar aynı)", write: app => outside(app, "UPDATE account_entries SET doubtful_skip = 1 WHERE id = ?", ids.entryIn) },
  { name: "taksit satırının evrak bağı temizlenir", write: app => outside(app, "UPDATE plan_entries SET cheque_id = '' WHERE id = ?", ids.planEntryCheque) },
  { name: "taksit satırının açılış alanı 0 → 1 (100 → 519)", write: app => outside(app, "UPDATE plan_entries SET opening = 1 WHERE id = ?", ids.planEntryCash) },
  { name: "stok hareketinin nedeni (satış → alış iadesi; 600 → 153)", write: app => outside(app, "UPDATE stock_moves SET reason = 'preturn' WHERE id = ?", ids.moveSale) },
  { name: "faturanın muhasebe kırılımı (600 → 602; tutar aynı, yalnız hesap dağılımı)", write: app => outside(app, "UPDATE invoices SET gl_json = replace(gl_json, '600', '602') WHERE id = ?", ids.invSale) },
  { name: "faturanın tevkifat tutarı", write: app => outside(app, "UPDATE invoices SET try_withheld = try_withheld + 10 WHERE id = ?", ids.invWithheld) },
  { name: "faturanın stopaj tutarı", write: app => outside(app, "UPDATE invoices SET try_stoppage = try_stoppage + 10 WHERE id = ?", ids.invStoppage) },
  { name: "tahsil kaydının işlem başlığı (101.01 / 101.02 tutarı)", write: app => outside(app, "UPDATE cheque_collections SET event_id = (SELECT event_id FROM cheque_collections WHERE id = ?) WHERE id = ?", ids.collection5, ids.collection4) },
  { name: "Kayıt Tarihi boş kartın oluşturma anı", write: app => outside(app, "UPDATE plans SET created_at = '2026-10-06T09:00:00.000Z' WHERE id = ?", ids.blankPlan) },
  { name: "kilitli karşılıksızı olan evrağın durumu (karşılıksız → portföyde)", write: app => outside(app, "UPDATE cheques SET status = 'portfolio' WHERE id = ?", ids.cheque2) },
  {
    name: "aynı evrakta kilit SONRASI tarihli ikinci karşılıksız olayı (en son oluşturulan; madde kilitli dönemden çıkar)",
    write: app => outside(app, "INSERT INTO cheque_events (id, cheque_id, kind, date, amount, account_id, from_status, to_status, note, effects_json, created_by, created_at) SELECT 't1f-bounce-2', cheque_id, 'bounce', '2026-10-15', amount, account_id, from_status, to_status, note, '[]', created_by, '2099-01-01T00:00:00.000Z' FROM cheque_events WHERE id = ?", ids.bounceEvent),
  },
  { name: "carili evrağın carisi silinir (cariye işlenmemiş sayılır; çift madde)", write: app => outside(app, "UPDATE cheques SET account_id = '' WHERE id = ?", ids.cheque1) },
];
const assertFound = (outcome, kind, seen, label) => {
  const found = codesOf(outcome.findings);
  for (const code of LOCKED_SOURCE) assert.ok(found.includes(code), `${label} — ${kind.name}: ${code} bulunmalı: ${JSON.stringify(found)}`);
  assert.ok(!found.includes("ledger:rule-diff"), `${label}: kural farkı yine bulgu değil (tur 1d)`);
  assert.equal(seen.gunluk, 1, `${label} — ${kind.name}: Mutabakat Günlüğü'ne bir "scan" satırı`);
  assert.equal(seen.zil.length, 1, `${label} — ${kind.name}: zil bir kez`);
  for (const code of LOCKED_SOURCE) assert.ok(seen.zil[0].includes(code), `${label}: zilde ${code}: ${JSON.stringify(seen.zil)}`);
  for (const code of LOCKED_SOURCE) assert.ok(codesOf(outcome.result.failures).includes(code), `${label}: Mutabakat Testi'nde sapma (${code})`);
};

describe("Ç5-A tur 1f — türetmenin okuduğu alanların kilitli dönemdeki kapı dışı değişikliği bulunur; meşru olaylar sessiz", { skip: SKIP }, () => {
  before(makeTemplate, { timeout: 240_000 });
  after(() => template && rmSync(template, { recursive: true, force: true }));

  for (const kind of KINDS) {
    it(`[1] satır içi tarama — ${kind.name}`, { timeout: 120_000 }, async () => {
      const dirs = copyOf();
      let ctx = null;
      try {
        ctx = await open(dirs);
        await settled(ctx);
        const before = lockedLines(ctx.app);
        assert.ok(kind.write(ctx.app) >= 1, "ön koşul: kapı dışı yazım satır değiştirdi");
        assert.notEqual(lockedLines(ctx.app), before, "ön koşul: kilitli dönemin canlı türetmesi değişti");
        assertFound(ctx.app.integrity.scan(), kind, ctx.fresh(), "satır içi");
        const again = ctx.app.integrity.scan();
        assert.deepEqual(again.findings, [], "aynı sapma ikinci taramada yeniden bildirilmez");
        for (const code of LOCKED_SOURCE) assert.ok(codesOf(again.result.failures).includes(code), `ikinci taramada da Mutabakat Testi'nde sapma (${code})`);
        assert.deepEqual(ctx.fresh(), QUIET);
      } finally {
        await ctx?.server.close().catch(() => {});
        dirs.cleanup();
      }
    });
    it(`[2] arka plan taraması — ${kind.name}; [3] program kapalıyken yapılan aynı yazım açılışta bulunur`, { timeout: 180_000 }, async () => {
      const dirs = copyOf();
      let ctx = null;
      try {
        ctx = await open(dirs);
        await settled(ctx);
        assert.ok(kind.write(ctx.app) >= 1, "ön koşul: kapı dışı yazım satır değiştirdi");
        assertFound(await background(ctx.app), kind, ctx.fresh(), "arka plan");
        await ctx.server.close();
        ctx = null;
      } finally {
        await ctx?.server.close().catch(() => {});
      }
      const closed = copyOf();
      try {
        ctx = await open(closed);
        await settled(ctx);
        const file = ctx.app.store.get("PRAGMA database_list").file;
        await ctx.server.close();
        ctx = null;
        assert.ok(kind.write({ store: { get: () => ({ file }) } }) >= 1, "ön koşul: kapalıyken kapı dışı yazım");
        ctx = await open(closed);
        assert.equal(ctx.app.ledger.snapshots.state().pending, null, "ön koşul: yeniden açılışta bekleyen dondurma yok");
        const fail = codesOf(ctx.app.integrity.scan().result.failures);
        assert.ok(fail.includes("ledger:snapshot"), `açılışta Mutabakat Testi'nde sapma (ledger:snapshot): ${JSON.stringify(fail)}`);
        const base = ctx.opened.rows.filter(row => row.action === "baseline").map(row => row.summary).join(" | ");
        assert.match(base, /Donmuş Defter/, `açılış taban satırı sapmayı taşır: ${base}`);
        assert.ok(ctx.opened.lines.some(line => /güncelleme öncesinden kalan/.test(line)), `sunucu iletisi: ${JSON.stringify(ctx.opened.lines)}`);
      } finally {
        await ctx?.server.close().catch(() => {});
        dirs.cleanup();
        closed.cleanup();
      }
    });
  }

  it("[4] meşru olaylar sessiz, yanıt kodları tabandakiyle aynı: eski tarihli evrakın bugünkü tahsili / cirosu / karşılıksızı, tahsile verilmiş evrağın tahsili, açık dönem fatura iptali, kart kapatma, Silinenler'den geri alma, numaralama ve POS bağlama yazımları", { timeout: 300_000 }, async () => {
    const dirs = copyOf();
    let ctx = null;
    try {
      ctx = await open(dirs);
      await settled(ctx);
      const api = await ctx.server.login();
      const locked = lockedLines(ctx.app);
      const quiet = async label => {
        const inline = ctx.app.integrity.scan();
        assert.deepEqual(inline.findings, [], `${label}: satır içi tarama sessiz: ${JSON.stringify(codesOf(inline.findings))}`);
        for (const code of LOCKED_SOURCE) assert.ok(!codesOf(inline.result.failures).includes(code), `${label}: ${code} sapması yok`);
        // Reddedilen (409) adımdan sonra veri değişmez: arka plan taraması "değişiklik yok" diye atlanır — bu da sessizdir.
        const bg = await ctx.app.integrity.scanInBackground();
        assert.ok(bg.result || bg.skipped === "unchanged", `${label}: arka plan taraması koştu ya da veri değişmediği için atlandı: ${JSON.stringify(bg).slice(0, 200)}`);
        assert.deepEqual(bg.findings || [], [], `${label}: arka plan taraması sessiz`);
        assert.deepEqual(ctx.fresh(), QUIET, `${label}: günlük / zil / sunucu iletisi yok`);
        assert.equal(lockedLines(ctx.app), locked, `${label}: kilitli dönemin canlı türetmesi değişmedi`);
      };
      const status = async (label, promise, want) => {
        const res = await promise;
        assert.equal(res.status, want, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
        await quiet(label);
        return res.data;
      };
      await status("carisiz evrak bugün tahsil", api.post(`/api/workspace/cheques/${ids.cheque7}/actions`, { action: "collect", date: TODAY, method: "cash" }), 200);
      await status("carisiz evrak bugün karşılıksız (cari seçilmeden)", api.post(`/api/workspace/cheques/${ids.cheque8}/actions`, { action: "bounce", date: TODAY }), 200);
      await status("carisiz evrak bugün karşılıksız + cari seçimi", api.post(`/api/workspace/cheques/${ids.cheque3}/actions`, { action: "bounce", date: TODAY, accountId: ids.A }), 200);
      assert.equal(ctx.app.store.get("SELECT account_id AS a FROM cheques WHERE id = ?", ids.cheque3).a, ids.A, "ön koşul: cari seçimi evrağa yazıldı");
      await status("carili evrak bugün karşılıksız", api.post(`/api/workspace/cheques/${ids.cheque9}/actions`, { action: "bounce", date: TODAY }), 200);
      await status("carili evrak bugün ciro", api.post(`/api/workspace/cheques/${ids.cheque1}/actions`, { action: "endorse", date: TODAY, accountId: ids.S }), 200);
      await status("kilitte tahsile verilen evrak bugün tahsil (kayıt kapanır)", api.post(`/api/workspace/cheques/${ids.cheque4}/actions`, { action: "collect", date: TODAY, method: "bank" }), 200);
      await status("kilitli karşılıksızı geri alma (taban da 409)", api.post(`/api/workspace/cheques/${ids.cheque2}/undo`, {}), 409);
      await status("kilitli taksit kartını bugün kapatma", api.put(`/api/workspace/plans/${ids.plan}`, { status: "closed" }), 200);
      const invoice = await status("açık dönem satış faturası", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.A, issueDate: TODAY, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 300, vatRate: 0 }], payment: { rest: "open" } }), 200);
      await status("açık dönem faturanın iptali", api.post(`/api/workspace/invoices/${invoice.id}/cancel`, { reason: "deneme" }), 200);
      await status("bugün transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "100", date: TODAY, bankAccountId: ids.bank }), 200);
      const leg = ctx.app.store.get("SELECT id FROM cash_entries WHERE transfer_id <> '' AND date = ? ORDER BY rowid LIMIT 1", TODAY).id;
      await status("bugünkü transferi sil", api.del(`/api/workspace/cash/${leg}?cashForce=1`), 200);
      const trash = (await must("Silinenler", api.get("/api/admin/trash")));
      const item = (Array.isArray(trash) ? trash : trash.items || []).find(entry => entry.kind === "cash");
      assert.ok(item, `ön koşul: silinen transfer Silinenler'de: ${JSON.stringify(trash).slice(0, 300)}`);
      await status("Silinenler'den geri al (transfer)", api.post("/api/admin/trash/restore", { id: item.id }), 200);
      assert.ok(ctx.app.store.get("SELECT 1 AS found FROM cash_entries WHERE transfer_id <> '' AND date = ?", TODAY), "ön koşul: transfer bağıyla geri döndü");
      // Fatura numaralamanın (routes/invoices renumberNotes: yalnız açıklama) ve POS kesinti bağlamanın (lib/bank/pos linkFees: bağ) kapıdan geçen yazımları kilitli satırda REDDEDİLMEZ
      // (taban ile aynı: iki alan izde değil — açıklama ve SINIF 2 kararı bekleyen bağ, §16.4).
      ctx.app.store.run("UPDATE account_entries SET note = note || ' (numara)' WHERE id = ?", ids.entryCheque);
      await quiet("numaralama yazımı (kilitli cari satırının açıklaması)");
      // §16.4 (BAŞ MİMAR KARARI GEREKİYOR): kilitli tahsilatın fatura bağının kapıdan geçen yazımı bugün de kabul edilir, sessizdir ve kilitli dönemin canlı türetmesini
      // DEĞİŞTİRİR (şüpheli kaydı olan caride 128 → 120) — bu tur bilerek dokunmadı; davranış tabandakiyle aynı.
      ctx.app.store.run("UPDATE account_entries SET invoice_id = ? WHERE id = ?", ids.invSale, ids.entryIn);
      const linked = ctx.app.integrity.scan();
      assert.deepEqual(linked.findings, [], "bağlama yazımı sessiz (§16.4)");
      assert.deepEqual(ctx.fresh(), QUIET, "bağlama yazımı: günlük / zil yok (§16.4)");
      assert.notEqual(lockedLines(ctx.app), locked, "§16.4 kanıtı: kapıdan geçen bağ yazımı kilitli dönemin canlı türetmesini değiştiriyor (karar bekliyor)");
    } finally {
      await ctx?.server.close().catch(() => {});
      dirs.cleanup();
    }
  });

  it("[5] kilidi ilerletme / kaldırma / yeniden koyma, yedek → geri yükleme ve Şirket Verisini Sıfırla sessiz; yeniden kilitlenmiş dönemde kapı dışı yazım yine bulunur", { timeout: 300_000 }, async () => {
    const dirs = copyOf();
    let ctx = null;
    const quiet = async label => {
      const inline = ctx.app.integrity.scan();
      assert.deepEqual(inline.findings, [], `${label}: satır içi tarama sessiz: ${JSON.stringify(codesOf(inline.findings))}`);
      assert.deepEqual((await background(ctx.app)).findings, [], `${label}: arka plan taraması sessiz`);
      assert.deepEqual(ctx.fresh(), QUIET, `${label}: günlük / zil / sunucu iletisi yok`);
    };
    try {
      ctx = await open(dirs);
      await settled(ctx);
      let api = await ctx.server.login();
      await must("kilidi ilerlet", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-15" }));
      await freezeDone(ctx.app);
      await quiet("kilit ilerledikten sonra");
      await must("kilidi kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
      await within(ctx.app.ledger.snapshots.runPending(), "kilit kaldırma");
      await quiet("kilit kaldırıldıktan sonra");
      await must("yeniden kilitle", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      await freezeDone(ctx.app);
      await quiet("yeniden kilitledikten sonra");
      outside(ctx.app, "UPDATE invoices SET gl_json = replace(gl_json, '600', '602') WHERE id = ?", ids.invSale);
      assertFound(ctx.app.integrity.scan(), KINDS[7], ctx.fresh(), "yeniden kilitledikten sonra kapı dışı yazım");
      outside(ctx.app, "UPDATE invoices SET gl_json = replace(gl_json, '602', '600') WHERE id = ?", ids.invSale);
      await ctx.server.close();
      ctx = await open(dirs);
      await freezeDone(ctx.app);
      ctx.app.integrity.scan();
      ctx.fresh();
      api = await ctx.server.login();
      const backup = (await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }))).backups[0].name;
      await must("kart kapat (yedekten sonra)", api.put(`/api/workspace/plans/${ids.plan}`, { status: "closed" }));
      await must("yedeği geri yükle", api.post("/api/admin/backups/restore", { name: backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
      await ctx.server.close();
      ctx = await open(dirs);
      await freezeDone(ctx.app);
      const restored = ctx.app.integrity.scan();
      assert.deepEqual(restored.findings, [], `geri yüklemeden sonra satır içi tarama sessiz: ${JSON.stringify(codesOf(restored.findings))}`);
      for (const code of ["period-lock", "ledger:snapshot"]) assert.ok(!codesOf(restored.result.failures).includes(code), `geri yüklemeden sonra ${code} sapması yok`);
      assert.deepEqual((await background(ctx.app)).findings, []);
      // Geri yüklenen dosyanın Mutabakat Günlüğü önceki (yukarıdaki kapı dışı yazımın) tarama satırını taşır; bakılan, bu açılışın taban satırıdır.
      const baseline = ctx.opened.rows.filter(row => row.action === "baseline").at(-1)?.summary || "";
      assert.ok(!/Donmuş Dönemin|Kapanmış dönem/.test(baseline), `geri yüklemeden sonra açılış tabanı temiz: ${baseline}`);
      ctx.fresh();
      api = await ctx.server.login();
      await must("sıfırla", api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
      await within(ctx.app.ledger.snapshots.runPending(), "sıfırlamadan sonra");
      const reset = ctx.app.integrity.scan();
      assert.deepEqual(reset.findings, [], `sıfırlamadan sonra sessiz: ${JSON.stringify(codesOf(reset.findings))}`);
      // Sıfırlama hareketlerle birlikte geri yüklenen dosyanın eski Mutabakat Günlüğü satırını da siler (sayı azalabilir); yeni satır / zil / ileti yok.
      const seen = ctx.fresh();
      assert.ok(seen.gunluk <= 0, `sıfırlamadan sonra yeni günlük satırı yok: ${seen.gunluk}`);
      assert.deepEqual([seen.zil, seen.sunucu], [[], []], "sıfırlamadan sonra zil / sunucu iletisi yok");
    } finally {
      await ctx?.server.close().catch(() => {});
      dirs.cleanup();
    }
  });

  for (const name of ["surum-2.0.26-zincir", "surum-2.4.9-s127"]) {
    it(`[6] eski sürümün gerçek koduyla üretilmiş KİLİTLİ veriyle güncelleme (${name}): ilk açılış + ilk tarama + ikinci açılış — yeni bulgu / günlük / zil yok`, { timeout: 300_000 }, async () => {
      const fx = readFixture(name);
      const today = fx.oncesi?.today || String(fx.now || "").slice(0, 10);
      const fixture = unpackFixture(name);
      let server = null;
      try {
        for (const boot of [1, 2]) {
          const alerts = [];
          server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, integrityScan: false, log: { debug() {}, info() {}, warn() {}, error() {} } });
          server.app.events.tap((event, payload) => {
            if (event === "integrity.alert") alerts.push(codesOf(payload.findings));
          });
          const lock = server.app.ledger.snapshots.state().lock;
          assert.ok(lock, `ön koşul: fikstür kilitli (${name})`);
          await within(server.app.ledger.snapshots.runPending(), "dondurma");
          const logBefore = server.app.store.get("SELECT COUNT(*) AS n FROM integrity_log").n;
          const inline = server.app.integrity.scan();
          const bg = await server.app.integrity.scanInBackground();
          assert.deepEqual(codesOf(inline.findings), [], `${boot}. açılış satır içi tarama yeni bulgu yok`);
          assert.deepEqual(codesOf(bg.findings), [], `${boot}. açılış arka plan taraması yeni bulgu yok`);
          assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM integrity_log").n, logBefore, `${boot}. açılış: Mutabakat Günlüğü'ne tarama satırı yok`);
          assert.deepEqual(alerts, [], `${boot}. açılış: zil yok`);
          for (const code of ["period-lock", "ledger:snapshot"]) assert.ok(!codesOf(inline.result.failures).includes(code), `${boot}. açılış: ${code} sapması yok`);
          await server.close();
          server = null;
        }
      } finally {
        await server?.close().catch(() => {});
        fixture.cleanup();
      }
    });
  }

  it("[7] kapıdan geçen (mağaza) yazım kilitli satırın yeni izlenen alanını değiştiremez: süzgeç de 'kilitli dönem' der → tam kapı reddeder (eşdeğerlik ihlali yok)", { timeout: 120_000 }, async () => {
    const dirs = copyOf();
    let ctx = null;
    try {
      ctx = await open(dirs);
      await settled(ctx);
      const store = ctx.app.store;
      // Fatura tablosu kapının para tabloları listesinde değildir (db.mjs FINANCIAL; 2.0.15'ten beri BİLİNEN SINIR): tek başına fatura yazımı kapıdan geçmez. Programın fatura
      // yolları her zaman bir para / cari satırıyla aynı işlemde yazar — burada da aynı işlemde bir cari kartına dokunulur (para alanı yok).
      const withParty = sql => () => store.tx(() => {
        store.run("UPDATE accounts SET updated_at = updated_at WHERE id = ?", ids.S);
        store.run(...sql);
      });
      const tries = [
        // İkiz bacakların ikisi birden başka bağa (para tutarlı; yalnız bağ değişir).
        ["transfer bağı", () => store.run("UPDATE cash_entries SET transfer_id = 'yeni-bag' WHERE transfer_id = (SELECT transfer_id FROM cash_entries WHERE id = ?)", ids.transferCash)],
        ["cari kaynağı", () => store.run("UPDATE account_entries SET source = '' WHERE id = ?", ids.entryCheque)],
        ["şüpheli işareti", () => store.run("UPDATE account_entries SET doubtful_skip = 1 WHERE id = ?", ids.entryIn)],
        ["taksit evrak bağı", () => store.run("UPDATE plan_entries SET cheque_id = '' WHERE id = ?", ids.planEntryCheque)],
        ["taksit açılış alanı", () => store.run("UPDATE plan_entries SET opening = 1 WHERE id = ?", ids.planEntryCash)],
        ["stok nedeni", () => store.run("UPDATE stock_moves SET reason = 'preturn' WHERE id = ?", ids.moveSale)],
        ["fatura kırılımı", withParty(["UPDATE invoices SET gl_json = replace(gl_json, '600', '602') WHERE id = ?", ids.invSale])],
        ["tahsil kaydının başlığı", () => store.run("UPDATE cheque_collections SET event_id = (SELECT event_id FROM cheque_collections WHERE id = ?) WHERE id = ?", ids.collection5, ids.collection4)],
        ["boş tarihli kartın oluşturma anı", () => store.run("UPDATE plans SET created_at = '2026-10-06T09:00:00.000Z' WHERE id = ?", ids.blankPlan)],
        ["kilitli karşılıksızın durumu", () => store.run("UPDATE cheques SET status = 'portfolio' WHERE id = ?", ids.cheque2)],
        ["carili evrağın carisi", () => store.run("UPDATE cheques SET account_id = '' WHERE id = ?", ids.cheque1)],
      ];
      // Tam kapının ilk bulduğu neden "Kapanmış dönem" (kilit izi) ya da yazımın aynı anda bozduğu başka bir denetim (ör. tahsil kaydının başlığı 101.02 tutarını değiştirir)
      // olabilir; ikisi de RED. Süzgeç alanı bilmeseydi gateVerify'da "eşdeğerlik ihlali" çıkardı (mutantlar).
      for (const [label, write] of tries) {
        assert.throws(write, error => error?.status === 409 && /Kapanmış dönem|sapma oluşturacaktı/.test(error.message) && !/eşdeğerlik/.test(error.message), `${label}: kapı reddetmeli (409; eşdeğerlik ihlali değil)`);
      }
      assert.equal(store.get("SELECT source AS v FROM account_entries WHERE id = ?", ids.entryCheque).v, "cheque", "yazım geri alındı");
      assert.deepEqual(ctx.app.integrity.scan().findings, [], "reddedilen yazımlardan sonra tarama sessiz");
    } finally {
      await ctx?.server.close().catch(() => {});
      dirs.cleanup();
    }
  });

  // Dar kontrol DÜŞÜK-A (yaşayan dört mutant; yalnız TEST): yükleme damgası (kaynak tarama testi + aşağıdaki süzgeç denetimi), süzgeçteki yükleme denetimi, tam tarama denetiminin
  // (opening:review) yazım kapısına girmemesi, karar ucunun "iki sütundan biri kararlı" koşulu.
  it("[8] DÜŞÜK-A: kapı dışı KG-16 sapmasından sonra sıradan yazımlar REDDEDİLMEZ (denetim yalnız tam taramada); durumu tanımsız ama kopyası kararlı satıra karar verilebilir ve sapma kalkar", { timeout: 180_000 }, async () => {
    const dirs = copyOf();
    let ctx = null;
    try {
      ctx = await open(dirs);
      await settled(ctx);
      const store = ctx.app.store;
      // Yükleme damgasının izden düşmesini (N3) kalıcı kaynak tarama testi yakalar (test/defter-kaynak-iz-250.test.mjs). Süzgeçteki yükleme denetimi (N7) ulaşılamaz bir dal:
      // kapının kapsamı (lib/db.mjs SCOPE_TABLES) plan_imports'u yakalamaz — eşdeğer mutant, rapor (KAPSAM DIŞI BULGU) ve §16.8.
      assert.equal(store.get("SELECT opening_review AS r, opening_review_gate AS g FROM account_entries WHERE id = ?", ids.candidate).r, "candidate", "ön koşul: Açılış Olabilir adayı");
      outside(ctx.app, "UPDATE account_entries SET opening_review = 'xyz' WHERE id = ?", ids.candidate);
      const api = await ctx.server.login();
      await must("KG-16 sapması varken sıradan yazım (Kasa girişi) reddedilmez", api.post("/api/workspace/cash", { kind: "in", amount: "10", date: TODAY, description: "Sıradan" }));
      await must("KG-16 sapması varken cari hareketi reddedilmez", api.post(`/api/workspace/accounts/${ids.A}/entries`, { kind: "debt", amount: "10", date: TODAY, note: "Sıradan" }));
      const drift = ctx.app.integrity.scan();
      assert.ok(codesOf(drift.findings).includes("opening:review"), `tam tarama sapmayı bulur: ${JSON.stringify(codesOf(drift.findings))}`);
      ctx.fresh();
      await must("durumu tanımsız ('xyz'), kopyası 'candidate' satıra karar", api.post(`/api/workspace/opening-review/${ids.candidate}`, { decision: "confirm" }));
      const row = store.get("SELECT opening_review AS r, opening_review_gate AS g FROM account_entries WHERE id = ?", ids.candidate);
      assert.deepEqual([row.r, row.g], ["confirmed", "confirmed"], "karar iki sütunu birlikte yazar");
      assert.ok(!codesOf(ctx.app.integrity.scan().result.failures).includes("opening:review"), "kararla sapma kalktı");
    } finally {
      await ctx?.server.close().catch(() => {});
      dirs.cleanup();
    }
  });
});
