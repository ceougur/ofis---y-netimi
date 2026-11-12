// 2.5.0 Ç3 — kilitli dönemin defterini dondurma (docs/erp/C3-DONDURMA-TASARIM.md §14 "Nasıl bozulur?" F1–F6, F8–F10, F13, F14; plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §4, §9 madde 1–2).
// Gerçek program (startTestServer; kapı ve K6 test kipinde açık, kapı eşdeğerlik denetimi açık) + HTTP uçları + iç API (server.app.ledger.snapshots). Veri programın kendi
// API'sinden girilir. Saat SAHTE ve sabit (2027-01-10 10:00 +03:00; ders 13, 22): yıl dönümü (31.12.2026 / 01.01.2027) bu güne göre, iki saat diliminde aynı yerel gün.
// Kural değişikliği benzetimi: YALNIZ TEST kancası __testLedgerRule ({ fn }) — ana iş parçacığındaki canlı türetmenin çıktısını değiştirir (dondurma iş parçacığı kancayı görmez;
// kanca dondurmadan SONRA açılır = sürüm yükseltmesi). Gerçek kod kopyasıyla benzetim: test/donmus-defter-kural-250.mjs. Eski kodda (Ç2 ucu a2796dd4) donmuş defter yok:
// her test kendi başında "donmuş defter yok" nedeniyle kırmızıdır (ders 7, 38). Yaşam döngüsü (süreç öldürme, disk dolu, iki şirket, yedek, eski sürüm onarımı, göç):
// test/donmus-defter-yasam-250.test.mjs.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { trialBalance } from "../server/lib/general-ledger.mjs";
import { lockDigestOf } from "../server/lib/integrity.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { lockAndWait, waitForFreeze } from "./fixtures/donma-bekle.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2027-01-10T10:00:00+03:00";
const USER = { id: "donma-test", display_name: "Donma Testi" };
const LOCK_2026 = "2026-12-31";
const MID_2026 = "2026-06-30";
const TRIGGERS = ["ledger_snapshot_runs_no_delete", "ledger_snapshot_runs_no_replace", "ledger_snapshot_runs_state", "ledger_snapshots_insert", "ledger_snapshots_no_delete", "ledger_snapshots_no_update"];

const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data)}`);
  return response.data.data;
};
const rejected = async (label, promise, status, code) => {
  const response = await promise;
  assert.equal(response.status, status, `${label}: ${response.status} ${JSON.stringify(response.data)}`);
  if (code) assert.equal(response.data.code, code, `${label}: ${JSON.stringify(response.data)}`);
  return response.data;
};
// Maddenin karşılaştırılabilir biçimi: kimlik, tarih, işlem, açıklama ve satırlar (hesap, alt hesap, cari, borç, alacak). Yazım sırası (seq) ve iç işaretler (doubtful) girmez.
const canon = entries => entries.map(entry => ({ id: entry.id, date: entry.date, source: entry.source || "", text: entry.text || "", lines: entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit]) }));
const upTo = (entries, day) => entries.filter(entry => entry.date <= day);
const after_ = (entries, day) => entries.filter(entry => entry.date > day);
const reportRows = async (admin, id, query) => (await must(id, admin.get(`/api/workspace/report-center/${id}${query}`))).rows;
const lineCount = entries => entries.reduce((sum, entry) => sum + entry.lines.length, 0);

// Programın kendi API'siyle girilen veri: 2026 boyunca ve 2027'nin ilk günlerinde Kasa, cari (açılış, tahsilat, Alacak Yaz), stok (açılış, veresiye satış), taksit kartı ve tahsilatı.
async function seed(admin) {
  const out = {};
  out.customer = await must("müşteri", admin.post("/api/workspace/accounts", { name: "Arda Yıldız", registeredOn: "2026-01-05" }));
  out.supplier = await must("tedarikçi", admin.post("/api/workspace/accounts", { name: "Bora Tedarik", type: "supplier", registeredOn: "2026-01-05" }));
  await must("açılış borcu", admin.post(`/api/workspace/accounts/${out.customer.id}/entries`, { kind: "debt", amount: "1.000", date: "2026-01-05", note: "Açılış bakiyesi" }));
  out.item = await must("ürün", admin.post("/api/workspace/stock", { name: "Un", unit: "Kg", unitPrice: "20", salePrice: "30", openingQty: "50", openingDate: "2026-01-05" }));
  out.cashMarch = (await must("kasa mart", admin.post("/api/workspace/cash", { kind: "in", amount: "2.500", date: "2026-03-10", description: "Kasaya giriş" }))).id;
  await must("kasa haziran", admin.post("/api/workspace/cash", { kind: "out", amount: "400", date: "2026-06-15", description: "Kira" }));
  await must("tahsilat", admin.post(`/api/workspace/accounts/${out.customer.id}/entries`, { kind: "in", amount: "300", date: "2026-06-30", method: "cash", note: "Tahsilat" }));
  out.cashJuly = (await must("kasa temmuz", admin.post("/api/workspace/cash", { kind: "in", amount: "150", date: "2026-07-01", description: "Temmuz girişi" }))).id;
  await must("veresiye satış", admin.post(`/api/workspace/stock/${out.item.id}/moves`, { kind: "out", qty: "5", unitPrice: "30", pay: "account", accountId: out.customer.id, date: "2026-09-01" }));
  out.plan = await must("taksit kartı", admin.post("/api/workspace/plans", { name: "Arda Yıldız", accountId: out.customer.id, total: "600", count: 3, firstDue: "2026-10-15", registeredOn: "2026-10-01" }));
  await must("taksit tahsilatı", admin.post(`/api/workspace/plans/${out.plan.id}/entries`, { kind: "in", amount: "200", date: "2026-11-01" }));
  await must("yıl sonu", admin.post("/api/workspace/cash", { kind: "in", amount: "75", date: "2026-12-31", description: "Yıl sonu" }));
  await must("yeni yıl", admin.post("/api/workspace/cash", { kind: "in", amount: "60", date: "2027-01-01", description: "Yeni yıl" }));
  await must("alacak yaz", admin.post(`/api/workspace/accounts/${out.supplier.id}/entries`, { kind: "credit", amount: "250", date: "2027-01-05", note: "Hizmet bedeli" }));
  return out;
}

describe("2.5.0 Ç3 — donmuş defter: kilit, ilerletme, geri çekme, kural değişikliği", () => {
  let server;
  let admin;
  let store;
  let data;
  const rule = { fn: null };
  const hook = { fn: null };
  const S = () => server.app.ledger?.snapshots;
  const L = () => server.app.ledger;
  const count = (table, where = "") => store.get(`SELECT COUNT(*) AS n FROM ${table}${where ? ` WHERE ${where}` : ""}`).n;
  // Ç3 tur 2: uç dondurmayı beklemez (kilit + koşu yazılınca yanıt); donmuş defteri okuyan adımlar dondurmanın bitmesini bekler (test/fixtures/donma-bekle.mjs).
  // Dönüş: bitmiş görünüm (frozenThrough, freeze) + ucun kendi yanıtı (put).
  const lock = async date => {
    const { put, view } = await lockAndWait(admin, date);
    return { lockedUntil: put.lockedUntil, frozenThrough: view.frozenThrough, freeze: view.freeze, put };
  };
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, __testLedgerRule: rule, __testFreezeHook: hook });
    admin = await loginAdmin(server);
    store = server.app.store;
    data = await seed(admin);
  });
  after(() => server?.close());

  it("F1: kilit konunca kilit gününe kadarki türetilmiş yevmiye satır satır donar; donmuş = canlı (madde madde, mizan yıl yıl); koşu başlığı kural sürümü ve kaynak iziyle", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    // 2.5.0 Ç5-A (G3): göç 48 (KG-16 adayları) ve 49 (açılış evrakı işareti) eklendi; donmuş defter tabloları göç 47'de. Ç5-A tur 1e: göç 50 (KG-16 durumunun kapının yazdığı kopyası).
    assert.equal(LATEST_VERSION, 50, "göç 50 (donmuş defter göç 47'de; 48 / 49 / 50 Ç5-A)");
    const live = L().build();
    const result = await lock(LOCK_2026);
    assert.equal(result.lockedUntil, LOCK_2026);
    // Ç3 tur 2 (tasarım notu §18, T2-2): uç arka işi (dondurma + kilit izi) EN ÇOK 5 sn bekler — kısa dondurma (bu veri) bütçe içinde biter: yanıt dondurma bittikten sonra (eski
    // beklenti aynen). Uzun dondurmanın arkada sürmesi ve ilerleme test/donmus-defter-kilit-ucu-250.test.mjs K4 / K9'da.
    assert.equal(result.put.frozenThrough, LOCK_2026, `uç dondurma bittikten sonra yanıt verir (kısa dondurma bütçe içinde): ${JSON.stringify(result.put)}`);
    assert.equal(result.put.freeze?.pending, null, "yanıtta bekleyen koşu yok");
    assert.equal(result.put.freeze?.running, false);
    assert.equal(result.frozenThrough, LOCK_2026, `dondurma bitti: ${JSON.stringify(result)}`);
    assert.equal(result.freeze?.running, false);
    assert.equal(result.freeze?.pending, null);
    assert.equal(result.freeze?.active, false);
    const state = S().state();
    assert.equal(state.coverage, LOCK_2026);
    assert.equal(state.lock, LOCK_2026);
    assert.equal(state.pending, null);
    // Satır satır: kilit gününe kadarki her madde ve satırı (31.12 dahil, 01.01.2027 hariç).
    const frozen = S().entries();
    assert.deepEqual(canon(frozen), canon(upTo(live, LOCK_2026)), "donmuş maddeler = canlı türetme (kilit günü dahil)");
    assert.ok(frozen.some(entry => entry.date === LOCK_2026), "31.12 maddesi donmuş");
    assert.equal(frozen.some(entry => entry.date > LOCK_2026), false, "01.01.2027 donmamış");
    assert.equal(count("ledger_snapshots"), lineCount(upTo(live, LOCK_2026)), "satır sayısı");
    // Karma okuma (Yevmiye Defteri, Hesap Planı Mizanı): kural değişmeden canlıyla birebir.
    assert.deepEqual(canon(L().book()), canon(live), "karma yevmiye = canlı");
    const trialOf = entries => trialBalance(entries, { from: "2026-01-01", to: "2026-12-31" });
    assert.deepEqual(trialOf(L().book()), trialOf(live), "2026 mizanı");
    assert.deepEqual(trialBalance(L().book()), trialBalance(live), "bütün zamanlar mizanı");
    // Karma mizanın SQL yolu (snapshots.trial) = trialBalance(karma yevmiye), her aralıkta (kilit günü, yıl dönümü, açık dönem, boş, tek gün).
    for (const [from, to] of [["", ""], ["2026-01-01", "2026-12-31"], ["2026-06-30", "2027-01-05"], ["2027-01-01", "2027-01-31"], ["2026-12-31", "2026-12-31"], ["", "2026-03-10"], ["2025-01-01", "2025-12-31"]]) {
      assert.deepEqual(S().trial({ from, to }), trialBalance(L().book(), { from, to }), `karma mizan ${from || "baş"} → ${to || "son"}`);
    }
    assert.deepEqual(L().check({ from: "2026-01-01", to: "2026-12-31", book: true }).trial, trialOf(live), "check(book) mizanı");
    // Aralık başından okunan donmuş yevmiye = süzülmüş karma yevmiye.
    assert.deepEqual(canon(L().book({ from: "2026-07-01", to: "2027-01-31" }).filter(entry => entry.date >= "2026-07-01" && entry.date <= "2027-01-31")), canon(live.filter(entry => entry.date >= "2026-07-01" && entry.date <= "2027-01-31")));
    // Koşu başlığı: kural sürümü güncel kural ("2.5.0-defter" — 2.5.0 Ç5-A G3: B15 yeni etiket; önceden "2.5.0"), neden lock, kaynak izi = kilit izinin LOCK_SQL_VERSION tanımı.
    const run = store.get("SELECT * FROM ledger_snapshot_runs WHERE kind = 'freeze' AND state = 'done' ORDER BY no DESC LIMIT 1");
    assert.equal(run.rule_version, "2.5.0-defter");
    assert.equal(run.reason, "lock");
    assert.equal(run.from_date, "");
    assert.equal(run.through, LOCK_2026);
    assert.equal(run.line_count, count("ledger_snapshots"));
    assert.equal(run.state_lines, run.line_count);
    assert.equal(run.source_digest, lockDigestOf(store, LOCK_2026, { version: run.digest_version }), "kaynak izi");
    assert.equal(store.get("SELECT COUNT(DISTINCT rule_version) AS n FROM ledger_snapshots").n, 1);
    assert.equal(store.get("SELECT rule_version FROM ledger_snapshots LIMIT 1").rule_version, "2.5.0-defter");
    // İz: dondurma işlem geçmişinde (silme tetikleyicisinin dayanağı).
    assert.equal(store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'ledger.snapshot.frozen' AND entity_id = ?", `ledger-snapshot-run:${run.no}`).n, 1);
    // GET kilit ucu kapsamı gösterir; Mutabakat Testi temiz.
    const lockView = await must("kilit", admin.get("/api/workspace/ledger/lock"));
    assert.equal(lockView.frozenThrough, LOCK_2026);
    assert.equal((await must("tarama", admin.get("/api/workspace/ledger/integrity"))).ok, true);
  });

  it("F2 / F3 / F4: kilit geri çekilince açılan dönemin donmuş satırları izle kalkar; değişen kayıtla yeniden kilitlenince yeniden donar; ilerletme ardışık iki koşu", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    if (S().state().coverage !== LOCK_2026) await lock(LOCK_2026);
    // Geri çek: kapsam 30.06'ya iner, 30.06'dan sonraki donmuş satırlar görünmez ve silinir; iz.
    const back = await lock(MID_2026);
    assert.equal(back.frozenThrough, MID_2026);
    assert.equal(S().state().coverage, MID_2026);
    assert.equal(count("ledger_snapshots", `date > '${MID_2026}'`), 0, "açılan dönemin donmuş satırları kalktı");
    const thaw = store.get("SELECT * FROM ledger_snapshot_runs ORDER BY no DESC LIMIT 1");
    assert.equal(thaw.kind, "thaw");
    assert.equal(thaw.through, MID_2026);
    assert.equal(thaw.from_date, LOCK_2026, "geri çekilen kapsam");
    assert.ok(store.get("SELECT 1 AS found FROM audit_events WHERE type = 'ledger.snapshot.thawed' AND entity_id = ?", `ledger-snapshot-run:${thaw.no}`), "geri çekme izi");
    // Açılan dönemde kayıt değişir (kilit 30.06; 01.07'deki Kasa girişi 150 → 175).
    await must("düzelt", admin.put(`/api/workspace/cash/${data.cashJuly}`, { kind: "in", amount: "175", date: "2026-07-01", description: "Temmuz girişi" }));
    // Yeniden kilitle (ilerlet): ikinci freeze koşusu (30.06, 31.12]; yeni tutar donar.
    await lock(LOCK_2026);
    const runs = store.all("SELECT kind, state, from_date AS fromDate, through FROM ledger_snapshot_runs WHERE kind = 'freeze' AND state = 'done' ORDER BY no");
    assert.deepEqual({ ...runs.slice(-1)[0] }, { kind: "freeze", state: "done", fromDate: MID_2026, through: LOCK_2026 }, "ardışık aralık");
    const july = S().entries().find(entry => entry.id === `cash:${data.cashJuly}`);
    assert.equal(july.lines[0].debit, 17500, "değişen tutar yeniden dondu");
    assert.deepEqual(canon(S().entries()), canon(upTo(L().build(), LOCK_2026)));
    assert.deepEqual(canon(L().book()), canon(L().build()));
    // Kilidi tamamen kaldır: kapsam boş, donmuş satır yok; sonra yeniden kilitle.
    await lock("");
    assert.equal(S().state().coverage, "");
    assert.equal(count("ledger_snapshots"), 0);
    await lock(LOCK_2026);
    assert.deepEqual(canon(S().entries()), canon(upTo(L().build(), LOCK_2026)));
    assert.equal((await must("tarama", admin.get("/api/workspace/ledger/integrity"))).ok, true);
  });

  it("F5: kural değişikliği benzetimi — kilitli dönemin Yevmiye Defteri ve Hesap Planı Mizanı DEĞİŞMEZ, açık dönem yeni kuralla; Mutabakat Testi ve Defter Mutabakatı 'Kural Değişikliği Farkı'; ruleDiff tutarları; yeni işlemler engellenmez", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    if (S().state().coverage !== LOCK_2026) await lock(LOCK_2026);
    const q2026 = "?from=2026-01-01&to=2026-12-31";
    const q2027 = "?from=2027-01-01&to=2027-12-31";
    const journal2026 = await reportRows(admin, "yevmiye", q2026);
    const trial2026 = await reportRows(admin, "hesap-mizani", q2026);
    const trial2027 = await reportRows(admin, "hesap-mizani", q2027);
    // Yeni kural (sürüm yükseltmesi benzetimi): Kasa'ya elle girişin karşılığı 649 yerine 642.
    rule.fn = entries => entries.map(entry => (entry.id.startsWith("cash:") && entry.lines.some(line => line.account === "649") ? { ...entry, lines: entry.lines.map(line => (line.account === "649" ? { ...line, account: "642" } : line)) } : entry));
    try {
      assert.deepEqual(await reportRows(admin, "yevmiye", q2026), journal2026, "kilitli yılın Yevmiye Defteri aynı");
      assert.deepEqual(await reportRows(admin, "hesap-mizani", q2026), trial2026, "kilitli yılın Hesap Planı Mizanı aynı");
      // Açık dönem: 01.01.2027'deki giriş yeni kuralla (642); 649'un devri (2026, donmuş) aynı.
      const journal2027 = await reportRows(admin, "yevmiye", q2027);
      assert.ok(journal2027.some(row => row[3] === "642"), "açık dönem yeni kuralla");
      assert.equal(journal2027.some(row => row[3] === "649"), false);
      const now2027 = await reportRows(admin, "hesap-mizani", q2027);
      const row649 = rows => rows.find(row => row[0] === "649");
      assert.deepEqual(row649(now2027)?.[2], row649(trial2027)?.[2], "649'un 2026 devri (donmuş) aynı");
      assert.ok(now2027.some(row => row[0] === "642"), "642 açık dönemde");
      // Mutabakat Testi: uyarı düzeyinde "Kural Değişikliği Farkı" — 3 madde (31.12.2026'ya kadar 649'lu üç Kasa girişi).
      const scan = await must("tarama", admin.get("/api/workspace/ledger/integrity"));
      const diff = scan.checks.find(check => check.code === "ledger:rule-diff");
      assert.ok(diff, `Kural Değişikliği Farkı görünür: ${JSON.stringify(scan.checks.map(check => check.code))}`);
      assert.equal(diff.ok, false);
      assert.equal(diff.severity, "warning");
      assert.equal(diff.count, 3);
      assert.match(diff.name, /Kural Değişikliği Farkı/);
      // Defter Mutabakatı raporu: fark satırları (hesap bazında) kendi durumuyla.
      const report = await reportRows(admin, "defter-mutabakati", "");
      assert.ok(report.some(row => row[5] === "Kural Değişikliği Farkı" && /Kural Değişikliği Farkı/.test(row[1])), "Defter Mutabakatı denetim satırı");
      assert.ok(report.some(row => row[0] === "649" && row[5] === "Kural Değişikliği Farkı"), "Defter Mutabakatı 649 satırı");
      // İç API (Ç5'in Kural Farkı Düzeltme Fişi): yıl / hesap bazında tutar.
      // 649'lu Kasa girişleri 2026'da (10.03 2.500 + 01.07 + 31.12 75; 01.07 F2'de 175'e düzeltildi): tutar veriden okunur.
      const sum2026 = Math.round(store.get("SELECT SUM(amount) AS n FROM cash_entries WHERE kind = 'in' AND date BETWEEN '2026-01-01' AND '2026-12-31' AND description <> 'Açılış'").n * 100);
      assert.ok(sum2026 >= 272500, `ön koşul: ${sum2026}`);
      const balances = S().ruleDiff().balances.filter(row => row.year === 2026).map(row => [row.account, row.frozenMinor, row.liveMinor, row.differenceMinor]).sort();
      assert.deepEqual(balances, [["642", 0, -sum2026, -sum2026], ["649", -sum2026, 0, sum2026]]);
      // Kural farkı yeni işlemleri engellemez.
      await must("açık döneme yazım", admin.post("/api/workspace/cash", { kind: "in", amount: "10", date: "2027-01-06", description: "Kural sonrası" }));
    } finally {
      rule.fn = null;
    }
    // Kural geri dönünce fark kalmaz.
    const clean = await must("tarama", admin.get("/api/workspace/ledger/integrity"));
    assert.equal(clean.checks.some(check => check.code === "ledger:rule-diff" && !check.ok), false);
  });

  it("F5b: aralığın tamamı donmuş dönemdeyse Yevmiye Defteri canlı türetme yapmaz (yan kazanç); açık dönemi kapsayan aralıkta yapar", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    if (S().state().coverage !== LOCK_2026) await lock(LOCK_2026);
    let calls = 0;
    rule.fn = entries => {
      calls += 1;
      return entries;
    };
    try {
      await reportRows(admin, "yevmiye", "?from=2026-01-01&to=2026-12-31");
      assert.equal(calls, 0, "kilitli yılın yevmiyesi yalnız tablodan");
      await reportRows(admin, "yevmiye", "?from=2026-12-01&to=2027-01-31");
      assert.equal(calls, 1, "açık dönemi kapsayan aralık canlı türetir");
    } finally {
      rule.fn = null;
    }
  });

  it("F6: değişmezlik — donmuş satır değiştirilemez, kapsam içinde silinemez, REPLACE ile ezilemez, kapanmış koşuya satır eklenemez; koşu başlığı değiştirilemez / silinemez", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    if (S().state().coverage !== LOCK_2026) await lock(LOCK_2026);
    const db = store.db;
    const row = db.prepare("SELECT * FROM ledger_snapshots ORDER BY date, run, run_seq LIMIT 1").get();
    assert.throws(() => db.exec("UPDATE ledger_snapshots SET debit_minor = debit_minor + 1"), /değiştirilemez/, "UPDATE satır");
    assert.throws(() => db.exec("DELETE FROM ledger_snapshots"), /silinemez/, "DELETE satır (kapsam içi, izli)");
    assert.throws(
      () => db.prepare("INSERT OR REPLACE INTO ledger_snapshots (run, run_seq, entry_id, line_no, date, cls, seq, account, sub, party, debit_minor, credit_minor, source, text, rule_version) VALUES (?, ?, 'x', 1, ?, 1, NULL, '100', '', '', 1, 0, '', '', '2.5.0')").run(row.run, row.run_seq, row.date),
      /eklenemez/,
      "REPLACE satır",
    );
    const last = db.prepare("SELECT no FROM ledger_snapshot_runs WHERE kind = 'freeze' AND state = 'done' ORDER BY no DESC LIMIT 1").get().no;
    assert.throws(
      () => db.prepare("INSERT INTO ledger_snapshots (run, run_seq, entry_id, line_no, date, cls, seq, account, sub, party, debit_minor, credit_minor, source, text, rule_version) VALUES (?, 999999, 'x', 1, ?, 1, NULL, '100', '', '', 1, 0, '', '', '2.5.0')").run(last, LOCK_2026),
      /eklenemez/,
      "kapanmış koşuya satır",
    );
    assert.throws(() => db.exec(`UPDATE ledger_snapshot_runs SET through = '2026-11-30' WHERE no = ${last}`), /değiştirilemez/, "UPDATE başlık");
    assert.throws(() => db.exec(`UPDATE ledger_snapshot_runs SET state = 'pending' WHERE no = ${last}`), /değiştirilemez/, "done → pending");
    assert.throws(() => db.exec("DELETE FROM ledger_snapshot_runs"), /silinemez/, "DELETE başlık");
    assert.throws(() => db.prepare("INSERT OR REPLACE INTO ledger_snapshot_runs (no, id, kind, state, from_date, through, rule_version, reason, created_by, created_at) VALUES (?, 'x', 'freeze', 'pending', '', '2026-01-01', '2.5.0', 'lock', 'x', 'x')").run(last), /yazılamaz|eklenemez/, "REPLACE başlık");
    assert.deepEqual(store.all("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'ledger_snapshot%' ORDER BY name").map(item => item.name), TRIGGERS);
    assert.deepEqual(canon(S().entries()), canon(upTo(L().build(), LOCK_2026)), "veri bozulmadı");
  });

  it("F8: kilit sırasında yazım (kilitli döneme 409, açık döneme 200) ve aynı anda iki kilit isteği → son kilit; tek bekleyen koşu yok, donmuş = canlı", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    await lock("");
    // İki istek aynı anda: ikisi de 200; sonuçta kilit = kapsam, bekleyen koşu yok, donmuş = canlı.
    const [one, two] = await Promise.all([admin.put("/api/admin/period-lock", { lockedUntil: MID_2026 }), admin.put("/api/admin/period-lock", { lockedUntil: LOCK_2026 })]);
    assert.equal(one.status, 200, JSON.stringify(one.data));
    assert.equal(two.status, 200, JSON.stringify(two.data));
    await waitForFreeze(admin);
    const state = S().state();
    assert.equal(state.coverage, state.lock, `kapsam = kilit: ${JSON.stringify(state)}`);
    assert.equal(state.pending, null);
    assert.equal(count("ledger_snapshot_runs", "state = 'pending'"), 0);
    assert.deepEqual(canon(S().entries()), canon(upTo(L().build(), state.lock)));
    // Kilitli döneme yazım 409, açık döneme 200.
    await rejected("kilitli döneme", admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: "2026-12-30", description: "Geç" }), 409, "period-locked");
    await must("açık döneme", admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: "2027-01-07", description: "Açık" }));
  });

  it("F9: gün / yıl dönümü — 01.01.2027'ye kadar kilit 31.12 ve 01.01 maddelerini dondurur; 01.01 geri çekilince yalnız o gün açılır", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    await lock("2027-01-01");
    const live = L().build();
    assert.deepEqual(canon(S().entries()), canon(upTo(live, "2027-01-01")));
    assert.ok(S().entries().some(entry => entry.date === "2027-01-01"), "01.01 donmuş");
    await lock(LOCK_2026);
    assert.equal(S().entries().some(entry => entry.date === "2027-01-01"), false, "01.01 açıldı");
    assert.ok(S().entries().some(entry => entry.date === LOCK_2026), "31.12 donmuş kaldı");
    assert.deepEqual(canon(L().book()), canon(L().build()));
  });

  it("F10: kapanış fişi kilitle aynı işlemde (postAll lockThrough) — fiş donmuş defterde, koşu eşzamanlı ve tek işlemde; dondurma düşerse fiş de kilit de yok", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    await lock(MID_2026);
    const V = L().vouchers;
    const before = { vouchers: count("ledger_vouchers"), runs: count("ledger_snapshot_runs") };
    const lines = [{ account: "602", debit: 12345 }, { account: "690", credit: 12345 }];
    const [voucher] = V.postAll(USER, [{ type: "closing", date: LOCK_2026, description: "Yıl sonu kapanışı", requestKey: "donma-f10-kapanis", lines }], { lockThrough: LOCK_2026 });
    assert.equal(server.app.context.period.lockedUntil(), LOCK_2026);
    const state = S().state();
    assert.equal(state.coverage, LOCK_2026, "kapsam aynı işlemde kilide geldi");
    assert.equal(state.pending, null);
    const run = store.get("SELECT * FROM ledger_snapshot_runs ORDER BY no DESC LIMIT 1");
    assert.equal(run.reason, "voucher-closing");
    assert.equal(run.state, "done");
    const frozen = S().entries().find(entry => entry.id === `voucher-close:${voucher.id}`);
    assert.ok(frozen, "kapanış fişi donmuş defterde");
    assert.deepEqual(frozen.lines.map(line => [line.account, line.debit, line.credit]), [["602", 12345, 0], ["690", 0, 12345]]);
    assert.deepEqual(canon(S().entries()), canon(upTo(L().build(), LOCK_2026)), "fiş maddeleri dahil donmuş = canlı");
    // Fişler saklanan satırdır: kural değişse de fark denetimi onları yeniden türetmez (kural kancası fiş maddesine dokunsa bile donmuş kopyayla aynı kalır).
    rule.fn = entries => entries.map(entry => (entry.id.startsWith("voucher") ? { ...entry, lines: entry.lines.map(line => ({ ...line, account: line.account === "602" ? "600" : line.account })) } : entry));
    try {
      assert.equal(S().ruleDiff().count, 0, "fiş maddesi saklanan satır sayılır");
    } finally {
      rule.fn = null;
    }
    // Dondurma düşerse (iç hata) fiş ve kilit yazılmaz.
    await lock(MID_2026);
    const runsBefore = count("ledger_snapshot_runs");
    const vouchersBefore = count("ledger_vouchers");
    hook.fn = phase => {
      if (phase === "sync") throw new Error("test: dondurma kesintisi");
    };
    try {
      assert.throws(() => V.postAll(USER, [{ type: "closing", date: LOCK_2026, description: "Düşen kapanış", requestKey: "donma-f10-duser", lines }], { lockThrough: LOCK_2026 }), /test: dondurma kesintisi/);
    } finally {
      hook.fn = null;
    }
    assert.equal(count("ledger_vouchers"), vouchersBefore, "fiş yok");
    assert.equal(server.app.context.period.lockedUntil(), MID_2026, "kilit değişmedi");
    assert.equal(count("ledger_snapshot_runs"), runsBefore, "koşu yok");
    assert.ok(before.runs >= 0);
  });

  it("F14: kaynak izi — kilitli dönemin kaynak satırı kapının görmediği bir yolla değişirse Mutabakat Testi 'Donmuş Defter' bulgusu verir; donmuş defter aynen kalır (düzeltme yok)", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    await lock(LOCK_2026);
    const frozenBefore = canon(S().entries());
    // Dış yazım (store dışı; eski sürüm ya da elle düzenleme): kilitli Mart Kasa girişi 2.500 → 2.600.
    store.db.prepare("UPDATE cash_entries SET amount = 2600 WHERE id = ?").run(data.cashMarch);
    try {
      const scan = await must("tarama", admin.get("/api/workspace/ledger/integrity"));
      const snap = scan.checks.find(check => check.code === "ledger:snapshot");
      assert.ok(snap && !snap.ok, `Donmuş Defter bulgusu: ${JSON.stringify(scan.checks.filter(check => !check.ok))}`);
      assert.match(JSON.stringify(snap), /Kaynağı Değişti/);
      assert.deepEqual(canon(S().entries()), frozenBefore, "donmuş defter değişmedi");
      // Kilitli yılın raporu donmuş defterden: değişen 2.600 değil 2.500.
      const rows = await reportRows(admin, "yevmiye", "?from=2026-03-10&to=2026-03-10");
      assert.ok(rows.some(row => row[4] === "2.500,00 TL"), JSON.stringify(rows));
      assert.equal(rows.some(row => /2\.600/.test(row.join(" "))), false, "değişen tutar kilitli yılın raporunda yok");
    } finally {
      store.db.prepare("UPDATE cash_entries SET amount = 2500 WHERE id = ?").run(data.cashMarch);
    }
  });

  it("F13 / yetki: Şirket Verisini Sıfırla donmuş defteri ve koşuları siler, tetikleyiciler yeniden kurulu; Muhasebe rolü kilit koyamaz (403)", async () => {
    assert.ok(S()?.state, "donmuş defter yok (ledger.snapshots)");
    await lock(LOCK_2026);
    assert.ok(count("ledger_snapshots") > 0);
    const muhasebe = await createUser(server, admin, { username: "donma.muhasebe", role: "muhasebe" });
    assert.equal((await muhasebe.put("/api/admin/period-lock", { lockedUntil: MID_2026 })).status, 403);
    const result = await must("sıfırla", admin.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
    assert.ok(result.counts.ledger_snapshots > 0, `sıfırlama raporu donmuş satır sayısını taşır: ${JSON.stringify(result.counts)}`);
    assert.equal(count("ledger_snapshots"), 0);
    assert.equal(count("ledger_snapshot_runs"), 0);
    assert.equal(S().state().coverage, "");
    assert.deepEqual(store.all("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'ledger_snapshot%' ORDER BY name").map(item => item.name), TRIGGERS);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'ledger_vou%'").n, 6, "Ç2 fiş tetikleyicileri de yerinde");
    assert.equal((await must("tarama", admin.get("/api/workspace/ledger/integrity"))).ok, true);
    // Sıfırlamadan sonra kilit yeniden donar.
    await must("kasa", admin.post("/api/workspace/cash", { kind: "in", amount: "40", date: "2026-11-11", description: "Sıfırlama sonrası" }));
    await lock(LOCK_2026);
    assert.deepEqual(canon(S().entries()), canon(upTo(L().build(), LOCK_2026)));
  });
});

describe("2.5.0 Ç3 — 2.4.9 kural kopyası (dondurulmuş) ve kural tuzağı", () => {
  // tools/kural-kopyasi-249.mjs'in v2.4.9'dan (ccf0b0ca) ürettiği dosyalar; değişirse kopya artık 2.4.9 değildir (§5).
  const PINNED = {
    "general-ledger.mjs": "0bef69c0912050bed08c70efe3e5a9446e5a2a00312e77cedc9a756940828d96",
    "cheque-gl.mjs": "cd417e5567a2157447a2a36b667f3a819abce9e2f004a2baf62eef08f63b727e",
    "doubtful-gl.mjs": "d6c6d8fa8e6ec4b6aaecca02942960f52055d12a5ba6f2a4f654dab8214f4df4",
    "money.mjs": "32a9b242da44fccb6b9d92d3b35ce6cd73f96e92c56bb56527e65912fcebe5a4",
    "ledger-rows.mjs": "c9a6c371f0ccb0f964ec4abcd899067792dfcf6d18bc6929d34e3fd3fadfd24b",
    "doubtful-rows.mjs": "3c412a715b8ee0d153154b1b0162c0caf0ab31c19503f4d0c5dfc5cec581c49d",
  };
  it("kopya dosyaları sabit (sha256); kopya yalnız kendi klasörünü içe aktarır", async () => {
    const dir = path.join(ROOT, "server/lib/ledger-rule-249");
    const rule = await import("../server/lib/ledger-rule-249/index.mjs").catch(() => null);
    assert.ok(rule?.buildRule249, "2.4.9 kural kopyası yok");
    for (const [name, digest] of Object.entries(PINNED)) {
      // Ders 27: Windows'ta git CRLF ile çıkarabilir — sağlama LF'ye çevrilmiş metinden.
      const text = readFileSync(path.join(dir, name), "utf8").replace(/\r\n/g, "\n");
      assert.equal(createHash("sha256").update(text).digest("hex"), digest, `${name} v2.4.9 kopyası değişti`);
      const imports = [...text.matchAll(/^import .* from "([^"]+)";$/gm)].map(match => match[1]);
      if (name !== "cheque-gl.mjs" && name !== "money.mjs") assert.ok(imports.length > 0, `${name}: içe aktarma okunamadı (dişsiz denetim)`);
      for (const from of imports) assert.match(from, /^\.\/[\w-]+\.mjs$/, `${name}: ${from} kopyanın dışına bakıyor`);
    }
  });
  it("LOCK_SQL_VERSION kilit izinin en yeni girdisinin sürümüdür (koşunun kaynak izi = kapının kilit izi tanımı)", async () => {
    const integrity = await import("../server/lib/integrity.mjs");
    assert.ok(integrity.LOCK_SQL_VERSION, "LOCK_SQL_VERSION yok");
    const text = readFileSync(path.join(ROOT, "server/lib/integrity.mjs"), "utf8").replace(/\r\n/g, "\n");
    const versions = [...text.matchAll(/since: "(\d+\.\d+\.\d+)"/g)].map(match => match[1]);
    assert.ok(versions.length >= 5, `since girdileri okunamadı (${versions.length})`);
    const key = value => value.split(".").map(part => part.padStart(4, "0")).join(".");
    const newest = versions.sort((a, b) => key(a).localeCompare(key(b))).at(-1);
    assert.equal(integrity.LOCK_SQL_VERSION, newest, "yeni kilit izi girdisi eklenince LOCK_SQL_VERSION yükselir");
  });
  // 2.5.0 Ç5-A tur 1 — BİLEREK DEĞİŞTİ (G3: docs/erp/C5-ACILIS-TASARIM.md §3.2 + BAŞ MİMAR KARARI B15): "2.5.0" kuralı 2.4.9 kopyasının takma adıdır (Ç5-A'dan önce bu test
  // güncel = 2.4.9'u madde madde kanıtlıyordu — o kanıt takma adın dayanağı); güncel kural "2.5.0-defter" ve 2.4.9'dan farkı YALNIZ Ç5-A kural kimliklerinde: açılış karşı hesabı
  // 500 → 519 (M-01 / M-07 stok açılışı), açılış açıklamadan değil işaretten (P1 / M-02: işaretsiz "Açılış bakiyesi" açıklamalı Borç Yaz 500 → 602). Öbür her madde AYNEN.
  it("kural tuzağı: güncel kural 2.5.0-defter; güncel türetme ↔ 2.4.9 kopyası farkı yalnız Ç5-A kural kimliklerinde (500 → 519 açılış, açıklamalı Borç Yaz 500 → 602); öbür maddeler aynen", async () => {
    const gl = await import("../server/lib/general-ledger.mjs");
    const rule = await import("../server/lib/ledger-rule-249/index.mjs").catch(() => null);
    assert.ok(rule?.buildRule249, "2.4.9 kural kopyası yok");
    assert.equal(gl.LEDGER_RULE_VERSION, "2.5.0-defter");
    assert.deepEqual({ ...gl.LEDGER_RULE_ALIASES }, { "2.5.0": "2.4.9" }, "2.5.0 = 2.4.9 kopyasının takma adı (B15)");
    const server = await startTestServer({ now: { time: NOW, fixed: true } });
    try {
      const admin = await loginAdmin(server);
      await seed(admin);
      const old = new Map(canon(rule.buildRule249(server.app.store)).map(entry => [entry.id, entry]));
      const live = new Map(canon(server.app.ledger.build()).map(entry => [entry.id, entry]));
      assert.deepEqual([...live.keys()].sort(), [...old.keys()].sort(), "madde kimlikleri aynı (B9: açılış sınıfı kimliği değiştirmez)");
      const explained = [];
      for (const [id, entry] of old) {
        const want = structuredClone(entry);
        // Ç5-A kural kimlikleri: stok açılışı M-07 (500 → 519); "Açılış bakiyesi" açıklamalı, açılış İŞARETSİZ Borç Yaz C-01 (500 → 602; P1 / M-02 "açıklamadan değil").
        if (id.startsWith("stock-open:")) for (const line of want.lines) if (line[0] === "500") line[0] = "519";
        if (id.startsWith("account:") && want.text.startsWith("Açılış")) for (const line of want.lines) if (line[0] === "500") line[0] = "602";
        if (JSON.stringify(want) !== JSON.stringify(entry)) explained.push(id);
        assert.deepEqual(live.get(id), want, `${id}: güncel türetme ↔ 2.4.9 farkı Ç5-A kural kimliklerinin dışında`);
      }
      assert.equal(explained.length, 2, `beklenen iki fark (stok açılışı + açıklamalı Borç Yaz) görülmedi: ${explained.join(", ")}`);
      // 2.4.9 kopyası değişmedi: açılışlar orada hâlâ 500'de.
      assert.ok([...old.values()].some(entry => entry.lines.some(line => line[0] === "500")), "2.4.9 kopyası açılışı 500'e yazmıyor");
    } finally {
      await server.close();
    }
  });
});
