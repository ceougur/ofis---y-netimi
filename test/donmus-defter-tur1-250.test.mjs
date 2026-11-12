// 2.5.0 Ç3 TUR 1 — dar kontrol bulgularının düzeltmesi (docs/erp/C3-DONDURMA-TASARIM.md §17; iş listesi E "06.11 03:08 Ç3 DAR KONTROLÜ BİTTİ"):
//   ORTA-1 donmuş mizan önbelleği Şirket Verisini Sıfırla + aynı güne yeniden kilitten sonra eski verinin toplamını döndürüyordu;
//   ORTA-2 eski sürümün (2.4.9) Şirket Verisini Sıfırla'sı donmuş satırları siler, koşuları bilmez → yeniden kilitte kilitli yıl boş donmuş defterden okunuyordu
//          (açılış onarımı yalnız kilit ↔ kapsam farkına bakıyordu); gerçek v2.4.9 koduyla: test/donmus-defter-eski-sifirla-250.mjs;
//   ORTA-3 aynı güne yeniden kilit göçün / onarımın bekleyen 2.4.9 koşusunu bırakıp güncel kuralla yeni koşu açıyordu; aile: kilit başka güne gidince ve bilinmeyen kuralın
//          bekleyen koşusu da sessizce güncel kurala geçiyordu (plan §4 "göçte 2.4.9 KURALIYLA");
//   K4     nedeni bilinmeyen ayrışma "Defter kuralı program sürümüyle değişti" diye adlandırılıyordu; eksik satır ayrı iletiyle; denetim adları Yazım düzeninde;
//   DÜŞÜK-3 göç / onarım penceresinde her rapor ana iş parçacığında İKİ tam türetme kuruyordu (ders 47);
//   §5 kural sürümü kuralı: LEDGER_RULE_VERSION yükselince önceki kuralın kopyası kayıt defterinde kalır (kayıt defteri denetimi).
// Gerçek program (startTestServer) + HTTP uçları + iç API; veri programın kendi API'sinden. Saat SAHTE ve sabit (ders 13, 22); iki saat diliminde koşulur (TZ=UTC, Europe/Istanbul).
// Eski kodda (10ed14cf) her ORTA testi beklenen nedenle kırmızıdır (ders 7, 38) — nedenler iletilerde.
// WINDOWS (ders 48): "ORTA-2 / ORTA-3 açılış" bölümü dosyayı kapatıp ham bağlantıyla değiştirir ve yeniden açar; donmuş satırları silip yeniden yazan onarım yolu bu bölümdedir.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LEDGER_RULE_VERSION, trialBalance } from "../server/lib/general-ledger.mjs";
import { titleCase } from "../server/lib/text-case.mjs";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2027-01-10T10:00:00+03:00";
const LOCK = "2026-12-31";
const MID = "2026-06-30";
const USER = { id: "tur1-test", display_name: "Tur 1 Testi" };
const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data)}`);
  return response.data.data;
};
const canon = entries => entries.map(entry => ({ id: entry.id, date: entry.date, source: entry.source || "", text: entry.text || "", lines: entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit]) }));
const upTo = (entries, day) => entries.filter(entry => entry.date <= day);
const between = (entries, from, to) => entries.filter(entry => entry.date > from && entry.date <= to);
const snapshotsOf = app => {
  assert.ok(app?.ledger?.snapshots?.state, "donmuş defter yok (ledger.snapshots)");
  return app.ledger.snapshots;
};
const runsOf = store => store.all("SELECT no, kind, state, from_date AS fromDate, through, rule_version AS rule, reason FROM ledger_snapshot_runs ORDER BY no").map(row => ({ ...row }));
const doneRuns = store => runsOf(store).filter(run => run.state === "done");
const rule249 = async () => (await import("../server/lib/ledger-rule-249/index.mjs")).buildRule249;
// Göçün / onarımın bekleyen 2.4.9 koşusu (eski sürümün koyduğu kilit: yalnız ayar → açılış onarımı): kural GAP_RULE = 2.4.9 (KULLANICI KARARI 06.11 S13 = A).
const legacyPending = (server, lock) => {
  server.app.store.setSetting("ledger.lockedUntil", lock);
  snapshotsOf(server.app).repairOnOpen();
  const pending = snapshotsOf(server.app).state().pending;
  assert.equal(pending?.rule, "2.4.9", `ön koşul: bekleyen 2.4.9 koşusu (${JSON.stringify(pending)})`);
  return pending;
};

async function seed(admin) {
  const customer = await must("müşteri", admin.post("/api/workspace/accounts", { name: "Tur Bir", registeredOn: "2026-01-05" }));
  await must("açılış", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "900", date: "2026-01-05", note: "Devir borcu" })); // 2.5.0 Ç5-A (G3): Ç3 mekaniği verisi iki kuralda da AYNI türetilsin diye açılış dışı açıklama ("Açılış…" Borç Yaz 2.4.9 kuralında 500, güncel kuralda 602 — K8-1; o ayrışma kural tuzağı ve test/acilis-*-250 testlerinin konusu)
  const cash = {};
  for (const [day, amount] of [["2026-03-10", "1.000"], ["2026-05-05", "250"], ["2026-08-01", "300"], ["2026-12-31", "75"], ["2027-01-02", "60"]]) {
    cash[day] = (await must(`kasa ${day}`, admin.post("/api/workspace/cash", { kind: "in", amount, date: day, description: `Giriş ${day}` }))).id;
  }
  await must("tahsilat", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "200", date: "2026-10-15", method: "cash", note: "Tahsilat" }));
  return { customer, cash };
}

describe("2.5.0 Ç3 tur 1 — önbellek, aynı gün / başka gün yeniden kilit, iletiler, ara dilim", () => {
  const rule = { fn: null };
  const hook = { fn: null };
  let server;
  const open = async (extra = {}) => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, __testLedgerRule: rule, __testFreezeHook: hook, ...extra });
    const admin = await loginAdmin(server);
    return { admin, data: await seed(admin), S: snapshotsOf(server.app), store: server.app.store, L: server.app.ledger };
  };
  const close = async () => {
    rule.fn = null;
    hook.fn = null;
    await server?.close();
    server = null;
  };
  after(close);

  it("ORTA-1: Şirket Verisini Sıfırla + aynı güne yeniden kilitten sonra Hesap Planı Mizanı (uç ve Rapor Merkezi) YENİ verinin toplamını gösterir (önbellek son koşunun kimliğiyle)", async () => {
    const server_ = await startTestServer({ now: { time: NOW, fixed: true } });
    server = server_;
    try {
      const admin = await loginAdmin(server);
      const kasa = trial => trial.accounts.find(row => row.code === "100")?.balance ?? 0;
      const reportKasa = async () => (await must("rapor", admin.get(`/api/workspace/report-center/hesap-mizani?from=2026-01-01&to=${LOCK}`))).rows.find(row => row[0] === "100")?.[5] ?? null;
      await must("kasa eski", admin.post("/api/workspace/cash", { kind: "in", amount: "1.000", date: "2026-03-10", description: "Sıfırlamadan önce" }));
      await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      // Önbelleği doldur (uç + Rapor Merkezi).
      assert.equal(kasa((await must("mizan", admin.get(`/api/workspace/ledger?from=2026-01-01&to=${LOCK}`))).trial), 1000);
      assert.equal(await reportKasa(), "1.000,00 TL");
      await must("sıfırla", admin.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
      await must("kasa yeni", admin.post("/api/workspace/cash", { kind: "in", amount: "5.000", date: "2026-05-05", description: "Sıfırlamadan sonra" }));
      await must("aynı güne yeniden kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      assert.equal(doneRuns(server.app.store).at(-1).no, 1, "ön koşul: sıfırlamadan sonra koşu numarası yine 1 (aynı kapsam, aynı numara)");
      const live = trialBalance(server.app.ledger.build(), { from: "2026-01-01", to: LOCK });
      const after1 = (await must("mizan", admin.get(`/api/workspace/ledger?from=2026-01-01&to=${LOCK}`))).trial;
      assert.equal(kasa(after1), kasa(live), `Şirket Verisini Sıfırla + aynı güne yeniden kilitten sonra mizan eski veriyi gösteriyor (önbellek): ${kasa(after1)} ≠ canlı ${kasa(live)}`);
      assert.equal(kasa(after1), 5000);
      assert.deepEqual(after1, live, "mizan = canlı türetme (bütün hesaplar)");
      assert.equal(await reportKasa(), "5.000,00 TL", "Rapor Merkezi Hesap Planı Mizanı yeni tutar");
      // Geri çek + yeniden kilitle (aynı gün) de yeni koşu → yeni anahtar.
      await must("geri çek", admin.put("/api/admin/period-lock", { lockedUntil: MID }));
      await must("kasa temmuz", admin.post("/api/workspace/cash", { kind: "in", amount: "40", date: "2026-07-07", description: "Açılan dönem" }));
      await must("yeniden kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      assert.deepEqual((await must("mizan", admin.get(`/api/workspace/ledger?from=2026-01-01&to=${LOCK}`))).trial, trialBalance(server.app.ledger.build(), { from: "2026-01-01", to: LOCK }));
    } finally {
      await close();
    }
  });

  it("ORTA-3: göçün / onarımın bekleyen 2.4.9 koşusu varken AYNI güne yeniden kilit — koşu kendi kuralıyla (2.4.9) sürer, güncel kuralla yeni koşu açılmaz", async () => {
    const { admin, S, store, L } = await open();
    try {
      const pending = legacyPending(server, LOCK);
      await must("aynı gün", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      const runs = runsOf(store);
      assert.equal(runs.some(run => run.state === "abandoned"), false, `bekleyen 2.4.9 koşusu aynı güne yeniden kilitte bırakıldı: ${JSON.stringify(runs)}`);
      const done = doneRuns(store).at(-1);
      assert.equal(done.rule, "2.4.9", `göç / onarım dönemi ${done.rule} kuralıyla dondu (plan §4: 2.4.9)`);
      assert.equal(done.no, pending.no, "aynı koşu tamamlandı");
      assert.equal(store.get("SELECT GROUP_CONCAT(DISTINCT rule_version) AS v FROM ledger_snapshots").v, "2.4.9");
      assert.deepEqual(canon(S.entries()), canon(upTo((await rule249())(store), LOCK)), "donmuş = 2.4.9 kopyası");
      assert.deepEqual(canon(S.entries()), canon(upTo(L.build(), LOCK)), "bugün güncel kural = 2.4.9 (tutarda)");
    } finally {
      await close();
    }
  });

  it("ORTA-3 ailesi: bekleyen 2.4.9 koşusu varken kilit İLERLETİLİNCE koşu 2.4.9 ile tamamlanır, kalan dönem güncel kuralla; GERİ ÇEKİLİNCE (koşunun içine) kısa koşu yine 2.4.9", async () => {
    const { admin, S, store, L } = await open();
    try {
      const first = legacyPending(server, MID);
      await must("ilerlet", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      const done = doneRuns(store).map(run => ({ no: run.no, from: run.fromDate, through: run.through, rule: run.rule, reason: run.reason }));
      assert.deepEqual(done, [{ no: first.no, from: "", through: MID, rule: "2.4.9", reason: "repair" }, { no: first.no + 1, from: MID, through: LOCK, rule: LEDGER_RULE_VERSION, reason: "lock" }], `ilerletilen kilit eski kurallı dönemi güncel kurala geçirdi: ${JSON.stringify(runsOf(store))}`);
      assert.ok(store.get("SELECT 1 AS found FROM audit_events WHERE type = 'ledger.snapshot.extended' AND entity_id = ?", `ledger-snapshot-run:${first.no}`), "ilerletme izi");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date <= ? AND rule_version <> '2.4.9'", MID).n, 0);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date > ? AND rule_version <> ?", MID, LEDGER_RULE_VERSION).n, 0);
      assert.deepEqual(canon(S.entries()), canon(upTo(L.build(), LOCK)));
      assert.equal(S.state().coverage, LOCK);
      assert.equal((await must("tarama", admin.get("/api/workspace/ledger/integrity"))).ok, true);
      // Geri çekme koşunun içine: kapsam boşa iner, yeni onarım koşusu (''→31.12) → kilit 30.06'ya çekilince kısa koşu 2.4.9.
      await must("kaldır", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
      const wide = legacyPending(server, LOCK);
      await must("içine çek", admin.put("/api/admin/period-lock", { lockedUntil: MID }));
      const last = doneRuns(store).at(-1);
      assert.deepEqual({ from: last.fromDate, through: last.through, rule: last.rule }, { from: "", through: MID, rule: "2.4.9" }, `koşunun içine çekilen kilit güncel kurala geçti: ${JSON.stringify(runsOf(store))}`);
      assert.equal(runsOf(store).find(run => run.no === wide.no).state, "abandoned");
      assert.deepEqual(canon(S.entries()), canon(upTo(L.build(), MID)));
    } finally {
      await close();
    }
  });

  it("ORTA-3 ailesi (eşzamanlı): bekleyen 2.4.9 koşusu varken kapanış fişi kilidi ilerletir (postAll lockThrough) — koşu 2.4.9 ile, kalan dönem güncel kuralla, ikisi aynı işlemde", async () => {
    const { S, store, L } = await open();
    try {
      const first = legacyPending(server, MID);
      const lines = [{ account: "602", debit: 4321 }, { account: "690", credit: 4321 }];
      const [voucher] = L.vouchers.postAll(USER, [{ type: "closing", date: LOCK, description: "Yıl sonu kapanışı", requestKey: "tur1-kapanis", lines }], { lockThrough: LOCK });
      const done = doneRuns(store).map(run => ({ no: run.no, from: run.fromDate, through: run.through, rule: run.rule, reason: run.reason }));
      assert.deepEqual(done, [{ no: first.no, from: "", through: MID, rule: "2.4.9", reason: "repair" }, { no: first.no + 1, from: MID, through: LOCK, rule: LEDGER_RULE_VERSION, reason: "voucher-closing" }], `eşzamanlı kilit eski kurallı dönemi güncel kurala geçirdi: ${JSON.stringify(runsOf(store))}`);
      assert.equal(S.state().pending, null);
      assert.ok(S.entries().some(entry => entry.id === `voucher-close:${voucher.id}`), "kapanış fişi donmuş defterde");
      assert.deepEqual(canon(S.entries()), canon(upTo(L.build(), LOCK)));
    } finally {
      await close();
    }
  });

  it("ORTA-3 ailesi: kuralı bu programda olmayan bekleyen koşu güncel kurala GEÇMEZ, yarım donmaz — ilerlemede ve Mutabakat Testi'nde görünür; eşzamanlı kilit düşer; kilit kaldırılınca bırakılır", async () => {
    const { admin, S, store, L } = await open();
    try {
      store.setSetting("ledger.lockedUntil", LOCK);
      store.run("INSERT INTO ledger_snapshot_runs (no, id, kind, state, from_date, through, rule_version, reason, created_by, created_at) VALUES (1, 'lsr-gelecek', 'freeze', 'pending', '', ?, '9.9.9', 'lock', 'system', ?)", LOCK, new Date().toISOString());
      const status = await S.runPending();
      const runs = runsOf(store);
      assert.deepEqual(runs.map(run => [run.no, run.state, run.rule]), [[1, "pending", "9.9.9"]], `bilinmeyen kuralın bekleyen koşusu güncel kurala geçti: ${JSON.stringify(runs)}`);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_snapshots").n, 0, "yarım donmuş defter yok");
      assert.match(status.error, /9\.9\.9\) bu programda yok/, JSON.stringify(status));
      const scan = await must("tarama", admin.get("/api/workspace/ledger/integrity"));
      const snap = scan.checks.find(check => check.code === "ledger:snapshot");
      assert.ok(snap && !snap.ok, `bilinmeyen kuralın bekleyen koşusu Mutabakat Testi'nde görünmüyor: ${JSON.stringify(scan.checks.filter(check => !check.ok))}`);
      assert.equal(snap.name, "Donmuş Defter (Yok) · Dondurma Bekliyor");
      assert.match(snap.sample[0], /^Bekleyen Dondurmanın Kuralı Bu Programda Yok: 31\.12\.2026 ve öncesi 9\.9\.9 kuralıyla donacak/);
      // Raporlar o dönemi güncel kuralla okur (en iyi bilinen).
      assert.deepEqual(canon(L.book()), canon(L.build()));
      // Aynı gün ve ileri gün: koşu sürer (bırakılmaz).
      await must("aynı gün", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      await must("ileri gün", admin.put("/api/admin/period-lock", { lockedUntil: "2027-01-05" }));
      assert.deepEqual(runsOf(store).map(run => [run.no, run.state, run.rule]), [[1, "pending", "9.9.9"]]);
      // Eşzamanlı (kapanış fişi kilidi): dondurulamaz → işlem düşer, fiş ve kilit yazılmaz.
      const vouchers = store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n;
      assert.throws(() => L.vouchers.postAll(USER, [{ type: "closing", date: "2027-01-06", description: "Düşen", requestKey: "tur1-bilinmeyen", lines: [{ account: "602", debit: 10 }, { account: "690", credit: 10 }] }], { lockThrough: "2027-01-06" }), /9\.9\.9\) bu programda yok/);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n, vouchers);
      assert.equal(server.app.context.period.lockedUntil(), "2027-01-05");
      // Kilit kaldırılınca bekleyen koşu bırakılır (dönem açılır); yeniden kilit güncel kuralla donar.
      await must("kaldır", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
      assert.equal(S.state().pending, null);
      await must("yeniden kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      assert.equal(doneRuns(store).at(-1).rule, LEDGER_RULE_VERSION);
      assert.deepEqual(canon(S.entries()), canon(upTo(L.build(), LOCK)));
    } finally {
      await close();
    }
  });

  it("K4: eksik donmuş satır ayrı iletiyle; 'Kural Değişikliği Farkı' nedeni bilinmeyende tarafsız, nedeni biliniyorsa onu söyler; denetim adları Yazım düzeninde", async () => {
    const { admin, S, store, data } = await open();
    try {
      await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      const names = items => Object.fromEntries(items.map(item => [item.code, item]));
      let items = names(S.checks({ includeHidden: true }));
      for (const item of Object.values(items)) {
        assert.equal(titleCase(item.name), item.name, `Yazım düzeni: ${item.name}`);
        // Parantez içindeki ad parçaları da büyük harfle (bağlaç "ve" küçük; titleCase parantez içine dokunmaz).
        for (const word of (/\(([^)]*)\)/.exec(item.name)?.[1] || "").split(/\s+/)) if (/^\p{L}/u.test(word) && word !== "ve") assert.match(word, /^\p{Lu}/u, `Yazım düzeni (parantez içi): ${item.name}`);
      }
      assert.equal(items["ledger:snapshot"].name, "Donmuş Defter (31.12.2026 ve Öncesi)");
      assert.equal(items["ledger:rule-diff"].name, "Kural Değişikliği Farkı (Kilitli Dönem: 31.12.2026 ve Öncesi)");
      // (a) Nedeni bilinmeyen ayrışma (kural benzetimi): tarafsız açıklama.
      rule.fn = entries => entries.map(entry => (entry.id.startsWith("cash:") ? { ...entry, lines: entry.lines.map(line => (line.account === "649" ? { ...line, account: "642" } : line)) } : entry));
      let diff = (await must("tarama", admin.get("/api/workspace/ledger/integrity"))).checks.find(check => check.code === "ledger:rule-diff");
      assert.ok(diff && !diff.ok, "ön koşul: fark var");
      assert.doesNotMatch(diff.hint, /^Defter kuralı program sürümüyle değişti/, `nedeni bilinmeyen ayrışma "kural değişti" diye adlandırılıyor: ${diff.hint}`);
      assert.match(diff.hint, /neden defter kuralının program sürümüyle değişmesi ya da kilitli dönemin kaynak verisinin/);
      rule.fn = null;
      // (b) Kaynak izi değişti (dış yazım): açıklama bunu söyler.
      store.db.prepare("UPDATE cash_entries SET amount = 1100 WHERE id = ?").run(data.cash["2026-03-10"]);
      try {
        diff = (await must("tarama", admin.get("/api/workspace/ledger/integrity"))).checks.find(check => check.code === "ledger:rule-diff");
        assert.ok(diff && !diff.ok, "ön koşul: kaynak değişince fark var");
        assert.match(diff.hint, /^Kilitli dönemin kaynak kayıtları dondurmadan sonra değişti/, diff.hint);
      } finally {
        store.db.prepare("UPDATE cash_entries SET amount = 1000 WHERE id = ?").run(data.cash["2026-03-10"]);
      }
      // (c) Eksik donmuş satır (2.4.9'un sıfırlamasının deseni: önce iz, sonra satırlar) — çalışan programda (açılış onarımı koşmadan): ayrı ve doğru ileti.
      store.db.exec("DELETE FROM audit_events WHERE type = 'ledger.snapshot.frozen'");
      store.db.exec("DELETE FROM ledger_snapshots");
      items = names(S.checks({ includeHidden: true }));
      const snap = items["ledger:snapshot"];
      assert.equal(snap.ok, false);
      assert.ok(snap.sample.some(text => /^Donmuş Defterde Eksik Satır: 31\.12\.2026 ve öncesinde 0 satır görünüyor, \d+ satır donmuştu/.test(text)), `eksik satır iletisi: ${JSON.stringify(snap.sample)}`);
      assert.match(snap.hint, /eksik ya da değişmiş satır var/);
      assert.equal(items["ledger:rule-diff"].ok, false);
      assert.match(items["ledger:rule-diff"].hint, /^Fark donmuş defterdeki eksik ya da değişmiş satırlardan \(Donmuş Defter denetimi\); kural değişikliği değildir\./, `eksik satır "kural değişikliği" diye adlandırılıyor: ${items["ledger:rule-diff"].hint}`);
      // Kilidi Aç → Yeniden Kilitle tutarlı hâle getirir.
      await must("kaldır", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
      await must("yeniden kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      assert.equal((await must("tarama", admin.get("/api/workspace/ledger/integrity"))).ok, true);
      assert.equal(names(S.checks({ includeHidden: true }))["ledger:snapshot"].name, "Donmuş Defter (31.12.2026 ve Öncesi)");
    } finally {
      await close();
    }
  });

  it("§5 kural kayıt defteri: RULE_HISTORY'nin son öğesi güncel kural, önceki her kuralın kopyası (ledger-rule-<sürüm>/) ve kayıt defteri girdisi var; her kuralın bekleyen koşusu (iş parçacığında) kendi kuralıyla donar", async () => {
    const module = await import("../server/lib/ledger-snapshots.mjs");
    assert.ok(Array.isArray(module.RULE_HISTORY), "RULE_HISTORY yok (kural sürüm geçmişi)");
    // Geçmiş yalnız sonuna eklenir: bilinen önek silinemez.
    assert.deepEqual(module.RULE_HISTORY.slice(0, 2), ["2.4.9", "2.5.0"], "kural geçmişinden sürüm silindi");
    assert.equal(module.RULE_HISTORY.at(-1), LEDGER_RULE_VERSION, "LEDGER_RULE_VERSION yükseldi ama RULE_HISTORY'ye eklenmedi");
    assert.equal(new Set(module.RULE_HISTORY).size, module.RULE_HISTORY.length);
    // 2.5.0 Ç5-A tur 1 — BİLEREK DEĞİŞTİ (G3: C5-ACILIS-TASARIM §3.2 + BAŞ MİMAR KARARI B15): önceki her kuralın kopyası YA DA eşdeğerlik testli takma adı ("2.5.0" = 2.4.9
    // kopyası; eşdeğerlik test/donmus-defter-250 kural tuzağının Ç5-A'dan önceki hâli + aşağıdaki "donmuş = o kuralın türetmesi").
    const { LEDGER_RULE_ALIASES } = await import("../server/lib/general-ledger.mjs");
    for (const version of module.RULE_HISTORY.slice(0, -1)) {
      const target = LEDGER_RULE_ALIASES[version] || version;
      if (LEDGER_RULE_ALIASES[version]) assert.ok(module.RULE_HISTORY.includes(target) && !LEDGER_RULE_ALIASES[target], `${version} takma adının hedefi (${target}) kayıt defterinde gerçek kural değil`);
      assert.ok(existsSync(path.join(ROOT, "server/lib", `ledger-rule-${target.replace(/\./g, "")}`, "index.mjs")), `${version} kuralının kopyası yok (server/lib/ledger-rule-${target.replace(/\./g, "")}/)`);
    }
    const { admin, S, store, L } = await open();
    try {
      assert.deepEqual([...S.ruleVersions()].sort(), [...module.RULE_HISTORY].sort(), "kayıt defteri = kural geçmişi");
      for (const version of module.RULE_HISTORY) {
        await must("kaldır", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
        await S.runPending();
        store.setSetting("ledger.lockedUntil", LOCK);
        const no = Number(store.get("SELECT COALESCE(MAX(no), 0) AS n FROM ledger_snapshot_runs").n) + 1;
        store.run("INSERT INTO ledger_snapshot_runs (no, id, kind, state, from_date, through, rule_version, reason, created_by, created_at) VALUES (?, ?, 'freeze', 'pending', '', ?, ?, 'repair', 'system', ?)", no, `lsr-kural-${no}`, LOCK, version, new Date().toISOString());
        const status = await S.runPending();
        const run = runsOf(store).find(item => item.no === no);
        assert.equal(run.state, "done", `${version} kuralının bekleyen koşusu donmadı: ${JSON.stringify(status)}`);
        assert.equal(store.get("SELECT GROUP_CONCAT(DISTINCT rule_version) AS v FROM ledger_snapshots").v, version);
        // 2.5.0 Ç5-A (G3): "donmuş = canlı" yalnız güncel kural için; eski kural (ve takma adı) için "donmuş = o kuralın türetmesi" (kurallar artık tutarda ayrı).
        const own = version === LEDGER_RULE_VERSION ? L.build() : (await rule249())(store);
        assert.deepEqual(canon(S.entries()), canon(upTo(own, LOCK)), `${version}: donmuş = ${version === LEDGER_RULE_VERSION ? "canlı" : "2.4.9 kopyasının türetmesi"}`);
      }
    } finally {
      await close();
    }
  });

  it("DÜŞÜK-3 (ders 47): göç / onarım penceresinde ara dilim (2.4.9) koşu başına bir kez kurulur — çıktı önbelleksiz yolla birebir; yazım, kural farkı ve işlem içi okuma yeniden kurar; kilitli yılın Yevmiye Defteri güncel türetme kurmaz", async () => {
    // Parça 2 satır: dondurma birçok parçada yazılır (parçalar arasında okuma; bu nesnenin kendi yazımları önbelleği düşürmemeli).
    const { admin, S, store, L } = await open({ freezeBatchLines: 2 });
    try {
      const build249 = await rule249();
      let middles = 0;
      let builds = 0;
      hook.fn = phase => {
        if (phase === "middle") middles += 1;
      };
      rule.fn = entries => {
        builds += 1;
        return entries;
      };
      legacyPending(server, LOCK);
      const expected = () => [...upTo(build249(store), LOCK), ...L.build().filter(entry => entry.date > LOCK)];
      // Kilitli yılın Yevmiye Defteri (aralık bekleyen dönemin içinde): yalnız 2.4.9 kuralı, güncel türetme yok.
      builds = 0;
      const journal = L.book({ from: "2026-01-01", to: LOCK });
      assert.equal(builds, 0, "göç penceresinde kilitli yılın Yevmiye Defteri güncel türetme de kurdu (iki tam türetme)");
      assert.deepEqual(canon(journal.filter(entry => entry.date >= "2026-01-01")), canon(between(build249(store), "2025-12-31", LOCK)));
      // Karma yevmiye ve mizan: ilk okuma ara dilimi kurar, sonrakiler kurmaz; çıktı birebir.
      middles = 0;
      const first = L.book();
      assert.deepEqual(canon(first), canon(expected()));
      assert.equal(middles, 1, `ara dilim kurulmadı ya da birden çok kuruldu (${middles})`);
      assert.deepEqual(L.book(), first, "ikinci okuma birebir");
      assert.deepEqual(L.check({ from: "2026-01-01", to: LOCK, book: true }).trial, trialBalance(expected(), { from: "2026-01-01", to: LOCK }));
      const report = await must("rapor", admin.get(`/api/workspace/report-center/hesap-mizani?from=2026-01-01&to=${LOCK}`));
      assert.ok(report.rows.length > 0);
      assert.equal(middles, 1, `ara dilim her okumada yeniden kuruluyor (${middles} kez; ders 47)`);
      // Ara dilim from'dan önce bitiyorsa okunmaz.
      await must("açık döneme yazım", admin.post("/api/workspace/cash", { kind: "in", amount: "33", date: "2027-01-08", description: "Pencere" }));
      L.book({ from: "2027-01-01" });
      assert.equal(middles, 1, "from > bekleyen gün: ara dilim kurulmamalı");
      // Bu nesnenin dışındaki yazım önbelleği düşürür: yeniden kurulur, yeni madde görünür.
      const fresh = L.book();
      assert.equal(middles, 2, "yazımdan sonra ara dilim yeniden kurulmalı");
      assert.deepEqual(canon(fresh), canon(expected()));
      assert.ok(fresh.some(entry => entry.date === "2027-01-08"));
      // Güncel kural değişirse (veri aynı) ara dilim 2.4.9'dan okunur, açık dönem yeni kuralla — önbellek "aynı" bilgisiyle yanlış dilim vermez.
      const swap = entries => entries.map(entry => (entry.id.startsWith("cash:") ? { ...entry, lines: entry.lines.map(line => (line.account === "649" ? { ...line, account: "642" } : line)) } : entry));
      rule.fn = swap;
      const changed = L.book();
      assert.deepEqual(canon(changed), canon([...upTo(build249(store), LOCK), ...swap(L.build()).filter(entry => entry.date > LOCK)]), "kural farkında ara dilim 2.4.9'dan");
      assert.equal(middles, 3);
      assert.deepEqual(L.book(), changed);
      assert.equal(middles, 3, "farklı dilim de saklanır");
      assert.ok(changed.some(entry => entry.date <= LOCK && entry.lines.some(line => line.account === "649")), "kilitli dönemde 2.4.9 kuralı (649)");
      rule.fn = null;
      // İşlemin içinde saklanmaz (GG2).
      const before = middles;
      store.tx(() => {
        L.book();
        L.book();
      });
      assert.equal(middles, before + 2, "işlem içinde okunan ara dilim saklanmamalı");
      // Dondurma parça parça yazılırken (her parçadan sonra) rapor okunur: dondurmanın kendi yazımları ara dilimi yeniden kurdurmaz (bir kez kurulur), çıktı birebir.
      const during = { reads: 0, middles: middles, ok: true };
      hook.fn = phase => {
        if (phase === "middle") middles += 1;
        if (phase === "batch") {
          during.reads += 1;
          if (JSON.stringify(canon(L.book())) !== JSON.stringify(canon(expected()))) during.ok = false;
        }
      };
      await S.runPending();
      hook.fn = phase => {
        if (phase === "middle") middles += 1;
      };
      assert.ok(during.reads >= 3, `ön koşul: dondurma en az 3 parçada (${during.reads})`);
      assert.equal(during.ok, true, "dondurma sürerken karma yevmiye birebir");
      assert.equal(middles - during.middles, 1, `dondurma parçaları yazılırken ara dilim her parçada yeniden kuruldu (${middles - during.middles} kez / ${during.reads} okuma)`);
      // Dondurma bitince ara dilim yok.
      assert.equal(S.state().coverage, LOCK);
      const settled = middles;
      assert.deepEqual(canon(L.book()), canon(L.build()));
      assert.equal(middles, settled);
    } finally {
      await close();
    }
  });
});

describe("2.5.0 Ç3 tur 1 — ORTA-2 / ORTA-3 açılış (dosya kapatılıp ham bağlantıyla değiştirilir, yeniden açılır)", () => {
  let root;
  let n = 0;
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "donma-tur1-"));
  });
  after(() => removeTestDir(root));
  const dirsOf = () => {
    n += 1;
    return { dataDir: path.join(root, `data-${n}`), backupDir: path.join(root, `backups-${n}`) };
  };
  const open = (dirs, extra = {}) => startTestServer({ now: { time: NOW, fixed: true }, ...dirs, ...extra });
  const raw = (dirs, fn) => {
    const db = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"));
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };
  // 2.4.9'un Şirket Verisini Sıfırla'sının donmuş defterdeki izi: MOVEMENT_TABLES sırasıyla önce audit_events (dondurma izleri gider), sonra ledger_snapshots — koşular kalır.
  const legacyWipe = (dirs, { runs = null, after: day = "" } = {}) => raw(dirs, db => {
    db.exec("BEGIN IMMEDIATE");
    if (runs) for (const no of runs) db.prepare("DELETE FROM audit_events WHERE entity_id = ?").run(`ledger-snapshot-run:${no}`);
    else db.exec("DELETE FROM audit_events WHERE type LIKE 'ledger.snapshot.%'");
    db.prepare("DELETE FROM ledger_snapshots WHERE date > ?").run(day);
    db.exec("COMMIT");
  });
  const setLock = (dirs, lock) => raw(dirs, db => db.prepare("UPDATE settings SET value = ? WHERE key = 'ledger.lockedUntil'").run(lock));

  async function reopenAndCheck(dirs, lock) {
    const server = await open(dirs);
    try {
      const S = snapshotsOf(server.app);
      await S.runPending();
      const admin = await loginAdmin(server);
      const live = server.app.ledger.build();
      const journal = (await must("yevmiye", admin.get(`/api/workspace/report-center/yevmiye?from=2026-01-01&to=${lock}`))).rows;
      const liveLines = upTo(live, lock).filter(entry => entry.date >= "2026-01-01").reduce((sum, entry) => sum + entry.lines.length, 0);
      const trial = (await must("mizan", admin.get(`/api/workspace/report-center/hesap-mizani?from=2026-01-01&to=${lock}`))).rows;
      const scan = await must("tarama", admin.get("/api/workspace/ledger/integrity"));
      return { server, S, store: server.app.store, live, journal, liveLines, trial, scan, repair: server.app.context?.snapshotRepair };
    } catch (error) {
      await server.close();
      throw error;
    }
  }

  it("ORTA-2: eski sürüm donmuş satırları silip AYNI güne yeniden kilitlediyse açılış onarımı kapsamı indirir, kilitli yıl GAP_RULE (2.4.9) ile yeniden donar — Yevmiye Defteri ve Hesap Planı Mizanı dolu, Mutabakat Testi tutarlı", async () => {
    const dirs = dirsOf();
    let server = await open(dirs);
    try {
      await seed(await loginAdmin(server));
      await must("kilit", (await loginAdmin(server)).put("/api/admin/period-lock", { lockedUntil: LOCK }));
    } finally {
      await server.close();
    }
    legacyWipe(dirs);
    const result = await reopenAndCheck(dirs, LOCK);
    server = result.server;
    try {
      assert.equal(result.journal.length, result.liveLines, `kilitli yılın Yevmiye Defteri boş donmuş defterden okunuyor (${result.journal.length} satır, canlı ${result.liveLines})`);
      assert.ok(result.trial.some(row => row[0] === "100"), "Hesap Planı Mizanı'nda Kasa var");
      assert.equal(result.scan.ok, true, JSON.stringify(result.scan.checks.filter(check => !check.ok)));
      assert.deepEqual(canon(result.S.entries()), canon(upTo(result.live, LOCK)));
      assert.equal(result.repair?.damaged, true, JSON.stringify(result.repair));
      const runs = runsOf(result.store).slice(-2).map(run => ({ kind: run.kind, state: run.state, from: run.fromDate, through: run.through, rule: run.rule, reason: run.reason }));
      assert.deepEqual(runs, [{ kind: "thaw", state: "done", from: LOCK, through: "", rule: "", reason: "repair" }, { kind: "freeze", state: "done", from: "", through: LOCK, rule: "2.4.9", reason: "repair" }]);
    } finally {
      await server.close();
    }
  });

  it("ORTA-2 (ileri kilit): eski sürüm satırları silip kilidi İLERLETTİYSE eski kapsamın satırları da yeniden donar (05.05 satırı kaybolmaz)", async () => {
    const dirs = dirsOf();
    let server = await open(dirs);
    try {
      const admin = await loginAdmin(server);
      await seed(admin);
      await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: MID }));
    } finally {
      await server.close();
    }
    legacyWipe(dirs);
    setLock(dirs, LOCK);
    const result = await reopenAndCheck(dirs, LOCK);
    server = result.server;
    try {
      assert.ok(result.S.entries().some(entry => entry.date === "2026-05-05"), "eski kapsamın (30.06'ya kadar) satırı kayıp");
      assert.equal(result.journal.length, result.liveLines);
      assert.equal(result.scan.ok, true, JSON.stringify(result.scan.checks.filter(check => !check.ok)));
      assert.deepEqual(canon(result.S.entries()), canon(upTo(result.live, LOCK)));
      assert.equal(result.store.get("SELECT GROUP_CONCAT(DISTINCT rule_version) AS v FROM ledger_snapshots").v, "2.4.9", "yeniden donan dönem GAP_RULE (S13 = A)");
    } finally {
      await server.close();
    }
  });

  it("ORTA-2 (sağlama noktası): yalnız son koşunun satırları silindiyse kapsam sağlam son koşunun gününe iner; önceki koşunun satırları (güncel kural) korunur, kalan dönem GAP_RULE ile donar", async () => {
    const dirs = dirsOf();
    let server = await open(dirs);
    let second = 0;
    let firstLines = 0;
    try {
      const admin = await loginAdmin(server);
      await seed(admin);
      await must("kilit 1", admin.put("/api/admin/period-lock", { lockedUntil: MID }));
      firstLines = server.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots").n;
      await must("kilit 2", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      second = doneRuns(server.app.store).at(-1).no;
    } finally {
      await server.close();
    }
    legacyWipe(dirs, { runs: [second], after: MID });
    const result = await reopenAndCheck(dirs, LOCK);
    server = result.server;
    try {
      assert.equal(result.journal.length, result.liveLines, `son koşunun satırları eksik okunuyor (${result.journal.length} / ${result.liveLines})`);
      assert.deepEqual(canon(result.S.entries()), canon(upTo(result.live, LOCK)));
      const thaw = runsOf(result.store).find(run => run.kind === "thaw" && run.reason === "repair");
      assert.equal(thaw?.through, MID, `sağlama noktası 30.06 olmalı: ${JSON.stringify(runsOf(result.store))}`);
      assert.equal(result.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date <= ? AND rule_version = ?", MID, LEDGER_RULE_VERSION).n, firstLines, "önceki koşunun satırları korunur");
      assert.equal(result.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date > ? AND rule_version <> '2.4.9'", MID).n, 0, "kalan dönem GAP_RULE");
      assert.equal(result.scan.ok, true, JSON.stringify(result.scan.checks.filter(check => !check.ok)));
    } finally {
      await server.close();
    }
  });

  it("ORTA-3 ailesi (yarıda kesilme): bekleyen 2.4.9 koşusu sürerken kilit ilerletildi ve dondurma kesildi → açılışta koşu 2.4.9 ile sürer, kalan dönem (ilerletme izi) güncel kuralla donar", async () => {
    const dirs = dirsOf();
    const hook = { fn: null };
    let server = await open(dirs, { __testFreezeHook: hook });
    let first = null;
    try {
      const admin = await loginAdmin(server);
      await seed(admin);
      first = legacyPending(server, MID);
      hook.fn = phase => {
        if (phase === "batch") throw new Error("test: dondurma kesintisi");
      };
      const result = await must("ilerlet", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      assert.match(result.freeze.error, /test: dondurma kesintisi/, `ön koşul: dondurma kesildi (${JSON.stringify(result.freeze)})`);
      assert.equal(server.app.ledger.snapshots.state().pending?.no, first.no, `bekleyen 2.4.9 koşusu ilerletilen kilitte bırakıldı: ${JSON.stringify(runsOf(server.app.store))}`);
    } finally {
      hook.fn = null;
      await server.close();
    }
    server = await open(dirs);
    try {
      const S = snapshotsOf(server.app);
      await S.runPending();
      const done = doneRuns(server.app.store).map(run => ({ no: run.no, from: run.fromDate, through: run.through, rule: run.rule, reason: run.reason }));
      assert.deepEqual(done, [{ no: first.no, from: "", through: MID, rule: "2.4.9", reason: "repair" }, { no: first.no + 1, from: MID, through: LOCK, rule: LEDGER_RULE_VERSION, reason: "lock" }], JSON.stringify(runsOf(server.app.store)));
      assert.deepEqual(canon(S.entries()), canon(upTo(server.app.ledger.build(), LOCK)));
      assert.equal((await must("tarama", (await loginAdmin(server)).get("/api/workspace/ledger/integrity"))).ok, true);
    } finally {
      await server.close();
    }
  });
});
