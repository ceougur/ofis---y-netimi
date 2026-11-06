// 2.5.0 Ç3 TUR 3 — birleşik Ç3 tur 1-2 dar kontrolünün bulguları (06.11.2026 09:42; docs/erp/C3-DONDURMA-TASARIM.md §19) + Ç3 küçük işler.
//   T1 (YÜKSEK-1, dar kontrol p1): dondurma YAZIM adımındayken aynı güne yinelenen kilit — arka işin bayat satır temizliği süren koşunun yazdığı satırları siliyordu; koşu kendi
//       sayacıyla "tamam" oluyordu → donmuş defter eksik, Hesap Planı Mizanı / Yevmiye Defteri sessizce yanlış ("Borç = Alacak · Mutabakat tutarlı").
//   T2 (YÜKSEK-1, dar kontrol p5): aynısı açılışta süren ESKİ KURALLI (2.4.9) dondurmada (eski sürüm kilidi → açılış onarımının GAP_RULE koşusu).
//   T3 (YÜKSEK-1, savunma): koşunun satırı yazımdan sonra herhangi bir yoldan eksilirse (sayaç ↔ tablo farkı) koşu "tamam" sayılmaz — görünür hata, kapsam yerinde.
//   T4 (ORTA-1, dar kontrol p6): kilit geri çekilince bayat satır temizliği sürerken (1.000.000 satırda ~2,7 M satır) yeniden kilit 5 sn bütçesini aşmaz: 409 ledger-cleanup-running
//       + Türkçe neden; kilit ve koşular değişmez; temizlik arkada sürer, ilerleme görünür; bitince kilit 200 ve donar.
//   T5 (Ç3 küçük işler (a), tur 1 K4 ailesi): Defter Mutabakatı alt başlığı nedeni bilinmeyen ayrışmayı "Defter kuralı program sürümüyle değişti" diye adlandırmaz.
//   T6 (Ç3 küçük işler (b)): 2.4.9'un GERÇEK koduyla üretilmiş KESİK Mutabakat Günlüğü kaydı (2.0.26 "Tüm Hareketleri Sil" → 600 iptal başlığı → kayıt 20.000 karakterde kesik)
//       Mutabakat Testi'ni 500'e düşürmez; satır "okunamadı" diye işaretlenir (ders 4: okunamayan boş değildir).
// Gerçek program (startTestServer; kapı ve K6 test kipinde), sahte sabit saat (2027-01-10 10:00 +03:00; ders 13, 22). Ön koşullar KAPIYLA tutulur (YALNIZ TEST kancası __testFreezeHook:
// "batch" / "purge" adımında bekletir; süreye bağlı değil — ders 20); her ön koşul ayrıca denetlenir. Eski kodda (834cd0ad) T1–T6 beklenen nedenle kırmızıdır (ders 7, 38).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { LEDGER_RULE_VERSION, trialBalance } from "../server/lib/general-ledger.mjs";
import { GAP_RULE, ruleDiffHint } from "../server/lib/ledger-snapshots.mjs";
import { LEDGER_SNAPSHOT_TRIGGERS_V47 } from "../server/lib/migrations.mjs";
import { createClock } from "../server/lib/clock.mjs";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { lockAndWait, waitForFreeze } from "./fixtures/donma-bekle.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const NOW = "2027-01-10T10:00:00+03:00";
const LOCK = "2026-12-31";
const Q2026 = "?from=2026-01-01&to=2026-12-31";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 400)}`);
  return response.data.data;
};
const canon = entries => entries.map(entry => ({ id: entry.id, date: entry.date, source: entry.source || "", text: entry.text || "", lines: entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit]) }));
const upTo = (entries, day) => entries.filter(entry => entry.date <= day);
const lineCount = entries => entries.reduce((sum, entry) => sum + entry.lines.length, 0);
const rowsOf = async (admin, id, query) => (await must(id, admin.get(`/api/workspace/report-center/${id}${query}`))).rows;
// Kapı: açılınca (ya da 20 sn güvenlik süresi dolunca — eski kod / mutant beklerse test kilitlenmez) geçer.
function gate() {
  let open = null;
  const held = new Promise(resolve => {
    open = resolve;
  });
  const fallback = setTimeout(() => open(), 20000);
  return {
    wait: () => held,
    open: () => {
      clearTimeout(fallback);
      open();
    },
  };
}
const until = async (cond, what, tries = 1000) => {
  for (let i = 0; i < tries && !cond(); i += 1) await sleep(10);
  assert.ok(cond(), `ön koşul: ${what}`);
};
// Sunucu bir kez kapanır: denetim kapanıştan ÖNCE düşerse finally de kapatır (açık sunucu test sürecini bitirmez — eski kodda / mutantta kırmızı koşu asılı kalmasın).
const closeOnce = async server => {
  if (!server || server.closedOnce) return;
  server.closedOnce = true;
  await server.app.close();
};

// Programın kendi API'siyle: 2026'nın her ayına Kasa girişleri + bir cari (açılış, tahsilat) + 2027 başı.
async function seed(admin, count = 40) {
  const customer = await must("cari", admin.post("/api/workspace/accounts", { name: "Ece Tan", registeredOn: "2026-01-03" }));
  await must("açılış", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "700", date: "2026-01-03", note: "Açılış bakiyesi" }));
  for (let i = 1; i <= count; i += 1) await must(`kasa ${i}`, admin.post("/api/workspace/cash", { kind: "in", amount: String(10 + i), date: `2026-${String(1 + (i % 12)).padStart(2, "0")}-1${i % 9}`, description: `Giriş ${i}` }));
  await must("tahsilat", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "150", date: "2026-11-20", method: "cash", note: "Tahsilat" }));
  await must("yeni yıl", admin.post("/api/workspace/cash", { kind: "in", amount: "25", date: "2027-01-04", description: "Yeni yıl" }));
}

// Bitmiş dondurmanın bütünlüğü: kapsam = kilit; görünen donmuş satır = son koşunun kayıtlı satırı (state_lines) = canlı türetme; madde madde donmuş = canlı.
function assertWhole(server, label) {
  const store = server.app.store;
  const S = server.app.ledger.snapshots;
  assert.equal(S.coverage(), LOCK, `${label}: kapsam = kilit`);
  const last = store.get("SELECT no, rule_version, state_lines FROM ledger_snapshot_runs WHERE state = 'done' ORDER BY no DESC LIMIT 1");
  const visible = store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date <= ?", LOCK).n;
  const live = upTo(server.app.ledger.build(), LOCK);
  assert.equal(visible, Number(last.state_lines), `${label}: görünen donmuş satır = koşunun kayıtlı satırı (${visible} / ${last.state_lines}; süren koşunun satırları silindi)`);
  assert.equal(visible, lineCount(live), `${label}: görünen donmuş satır = canlı türetme (${visible} / ${lineCount(live)})`);
  assert.deepEqual(canon(S.entries()), canon(live), `${label}: donmuş = canlı (madde madde)`);
  return last;
}

describe("2.5.0 Ç3 tur 3 — YÜKSEK-1: süren dondurmanın satırları silinmez; koşu tablo doğrulanmadan tamamlanmaz", () => {
  let server;
  let admin;
  const hook = { fn: null };
  const rule = { fn: null };
  const S = () => server.app.ledger.snapshots;
  const store = () => server.app.store;
  const runRows = no => store().get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE run = ?", no).n;
  const runs = () => store().all("SELECT no, kind, state, through FROM ledger_snapshot_runs ORDER BY no").map(row => ({ ...row }));
  const unlockAll = async () => {
    hook.fn = null;
    await waitForFreeze(admin);
    await must("kilidi kaldır", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
    await waitForFreeze(admin);
  };
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, __testFreezeHook: hook, __testLedgerRule: rule, freezeBatchLines: 5 });
    admin = await loginAdmin(server);
    await seed(admin);
  });
  after(async () => {
    hook.fn = null;
    rule.fn = null;
    await server?.close();
  });

  it("T1 (p1): dondurma YAZIM adımındayken aynı güne yinelenen kilit süren koşunun satırlarını silmez — bitince görünen donmuş satır = kayıtlı = canlı; Hesap Planı Mizanı, Yevmiye Defteri ve karma mizan = canlı; Mutabakat Testi temiz", async () => {
    await unlockAll();
    const reference = { journal: await rowsOf(admin, "yevmiye", Q2026), trial: await rowsOf(admin, "hesap-mizani", Q2026) };
    const held = gate();
    let batches = 0;
    hook.fn = async phase => {
      if (phase === "batch" && ++batches >= 3) await held.wait();
    };
    try {
      const first = admin.put("/api/admin/period-lock", { lockedUntil: LOCK });
      await until(() => batches >= 3 && S().status().running && S().status().phase === "yazım", `dondurma yazım adımında tutuluyor (${JSON.stringify(S().status())})`);
      const runNo = S().status().run;
      const written = runRows(runNo);
      assert.ok(written >= 15, `ön koşul: ikinci istekten önce koşunun ${written} satırı yazılmış`);
      // Aynı gün, ikinci istek (kartın "Kilitle"si / API). Yanıt arka işi (temizlik + dondurma) bütçe kadar bekler: yanıt geldiğinde temizlik adımı koşmuştur.
      const again = await must("aynı gün", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      assert.equal(again.freeze.pending?.no, runNo, "aynı bekleyen koşu");
      assert.ok(runRows(runNo) >= written, `aynı güne yinelenen kilidin arka işi süren koşunun yazdığı satırları sildi (${runRows(runNo)} / ${written})`);
      held.open();
      hook.fn = null;
      assert.equal((await first).status, 200);
    } finally {
      held.open();
      hook.fn = null;
    }
    await waitForFreeze(admin);
    assertWhole(server, "T1");
    assert.deepEqual(await rowsOf(admin, "yevmiye", Q2026), reference.journal, "kilitli yılın Yevmiye Defteri = kilitten önceki (canlı)");
    assert.deepEqual(await rowsOf(admin, "hesap-mizani", Q2026), reference.trial, "kilitli yılın Hesap Planı Mizanı = kilitten önceki (canlı)");
    const mixed = await must("karma mizan", admin.get(`/api/workspace/ledger${Q2026}`));
    const live = trialBalance(server.app.ledger.build(), { from: "2026-01-01", to: LOCK });
    assert.deepEqual(mixed.trial.accounts, live.accounts, "karma mizan (donmuş) = canlı mizan");
    const scan = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
    assert.equal(scan.ok, true, `Mutabakat Testi temiz: ${JSON.stringify(scan.failures?.map(item => `${item.name}: ${(item.sample || []).join(" | ")}`))}`);
  });

  it("T3: koşunun satırı yazımdan sonra dışarıdan eksilirse (sayaç ↔ tablo farkı) koşu 'tamam' sayılmaz — görünür hata, kapsam yerinde, koşu bekler; aynı güne yeniden kilit baştan yazar ve tamamlar", async () => {
    await unlockAll();
    const held = gate();
    let batches = 0;
    hook.fn = async phase => {
      if (phase === "batch" && ++batches >= 2) await held.wait();
    };
    let runNo = 0;
    try {
      const first = admin.put("/api/admin/period-lock", { lockedUntil: LOCK });
      await until(() => batches >= 2 && S().status().phase === "yazım", `dondurma yazım adımında tutuluyor (${JSON.stringify(S().status())})`);
      runNo = S().status().run;
      // Bilinmeyen bir silme yolu (temizlik dışı): yazılmış ilk satır gider.
      assert.equal(Number(store().run("DELETE FROM ledger_snapshots WHERE run = ? AND run_seq = 1", runNo).changes), 1, "ön koşul: koşunun yazılmış bir satırı silindi");
      held.open();
      hook.fn = null;
      assert.equal((await first).status, 200);
    } finally {
      held.open();
      hook.fn = null;
    }
    const view = await waitForFreeze(admin);
    assert.equal(view.frozenThrough, "", `eksik satırlı koşu tamamlandı (kapsam ${view.frozenThrough || "boş"}; koşular ${JSON.stringify(runs())})`);
    assert.equal(view.freeze.pending?.no, runNo, `koşu bekliyor: ${JSON.stringify(view.freeze)}`);
    assert.equal(view.freeze.phase, "hata");
    assert.match(view.freeze.error, /koşunun tabloda \d+ satırı var, \d+ satır yazılmıştı/, "neden görünür (Türkçe)");
    assert.equal(store().get("SELECT COUNT(*) AS n FROM ledger_snapshot_runs WHERE no = ? AND state = 'pending'", runNo).n, 1);
    // Kilitli dönem bu arada bekleyen koşunun kuralıyla canlı okunur (K1): raporlar doğru.
    const live = trialBalance(server.app.ledger.build(), { from: "2026-01-01", to: LOCK });
    assert.deepEqual((await must("karma mizan", admin.get(`/api/workspace/ledger${Q2026}`))).trial.accounts, live.accounts, "hata sonrası kilitli dönem canlı okunur");
    await must("aynı güne yeniden kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    await waitForFreeze(admin);
    assertWhole(server, "T3 yeniden");
  });

  it("T4 (ORTA-1): kilit geri çekilince bayat satır temizliği sürerken yeniden kilit 5 sn bütçesini aşmaz — 409 ledger-cleanup-running + Türkçe neden; kilit ve koşular değişmez; ilerleme görünür; temizlik bitince kilit 200 ve donar", async () => {
    await unlockAll();
    await lockAndWait(admin, LOCK);
    const held = gate();
    hook.fn = async phase => {
      if (phase === "purge") await held.wait();
    };
    try {
      await must("kilidi aç", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
      const view = await must("kilit görünümü", admin.get("/api/workspace/ledger/lock"));
      assert.equal(view.freeze.cleanup?.running, true, `ön koşul: geri çekilen dönemin temizliği sürüyor (tutuldu): ${JSON.stringify(view.freeze)}`);
      assert.ok(view.freeze.cleanup.removed > 0, `temizliğin ilerlemesi görünür (${view.freeze.cleanup.removed} satır silindi)`);
      assert.equal(view.freeze.active, true, "süren iş");
      assert.ok(store().get(`SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date > ''`).n > 0, "ön koşul: bayat satır kaldı");
      const before = runs().length;
      const started = Date.now();
      const refused = await admin.put("/api/admin/period-lock", { lockedUntil: LOCK });
      const took = Date.now() - started;
      assert.ok(took < 8000, `uç 5 sn bütçesini aştı (${took} ms; istemci 30 sn'de keser)`);
      assert.equal(refused.status, 409, `temizlik sürerken yeniden kilit 409 almalı (${refused.status} ${JSON.stringify(refused.data).slice(0, 300)})`);
      assert.equal(refused.data.code, "ledger-cleanup-running");
      assert.match(refused.data.error, /^Önceki dönemin defter temizliği sürüyor; temizlik bitince yeniden kilitleyin\./);
      assert.equal(refused.data.freeze?.cleanup?.running, true, "yanıtta temizliğin durumu");
      assert.equal(server.app.context.period.lockedUntil(), "", "kilit değişmedi");
      assert.equal(runs().length, before, `koşu açılmadı: ${JSON.stringify(runs().slice(before))}`);
    } finally {
      held.open();
      hook.fn = null;
    }
    const done = await waitForFreeze(admin);
    assert.equal(done.freeze.cleanup.running, false, "temizlik bitti");
    assert.equal(store().get(`SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date > ''`).n, 0, "bayat satır kalmadı");
    await lockAndWait(admin, LOCK);
    assertWhole(server, "T4");
  });

  it("T6b (Ç3 küçük işler (b), etiketsiz): Mutabakat Günlüğü'nde 20.000 karakterde kesilmiş (geçersiz JSON) kayıt Mutabakat Testi'ni düşürmez — satır günlükte 'okunamadı' işaretiyle, öbür kayıtlar ayrıştırılır", async () => {
    hook.fn = null;
    // 2.4.9'un bank/repair kaydının biçimi (gerçek kodla üretileni T6'da): ayrıntı JSON.stringify(...).slice(0, 20000).
    const detail = JSON.stringify({ cancelledEvents: Array.from({ length: 800 }, (_, i) => `ev-${i}-${"x".repeat(30)}`) }).slice(0, 20000);
    assert.throws(() => JSON.parse(detail), SyntaxError, "ön koşul: kesik ayrıntı geçersiz JSON");
    const id = `kesik-kayit-tur3-${process.pid}`;
    store().run("INSERT INTO integrity_log (id, at, action, tables, summary, detail_json) VALUES (?, ?, 'repair', '', ?, ?)", id, "2027-01-10T07:00:00.999Z", "Açılış onarımı (eski sürümden): iptal edilen işlem başlığı 800", detail);
    const scan = await admin.get("/api/workspace/ledger/integrity");
    assert.equal(scan.status, 200, `Mutabakat Testi kesik kayıtla düştü: ${scan.status} ${JSON.stringify(scan.data).slice(0, 300)}`);
    const row = scan.data.data.log.find(item => item.id === id);
    assert.ok(row, "kesik kayıt günlükte görünür (atlanmadı)");
    assert.equal(row.detailUnreadable, true, "kesik kayıt okunamadı diye işaretli");
    assert.equal(row.detail, null, "okunamayan ayrıntı boş dizi değil");
    assert.equal(row.detailNote, "Kayıt ayrıntısı okunamadı (kesik ya da bozuk kayıt; 20000 karakter).");
    assert.equal(row.summary, "Açılış onarımı (eski sürümden): iptal edilen işlem başlığı 800");
    assert.ok(scan.data.data.log.filter(item => item.id !== id).every(item => !item.detailUnreadable && item.detail !== null), "geçerli kayıtlar ayrıştırılır");
  });

  it("T5 (Ç3 küçük işler (a), K4 ailesi): Defter Mutabakatı alt başlığı nedeni bilinmeyen ayrışmayı 'Defter kuralı program sürümüyle değişti' diye adlandırmaz — denetimin tarafsız iletisi + yeni işlemler engellenmez", async () => {
    hook.fn = null;
    if (S().coverage() !== LOCK) await lockAndWait(admin, LOCK);
    // Kural değişikliği benzetimi (F5 ile aynı): Kasa'ya elle girişin karşılığı 649 yerine 642.
    rule.fn = entries => entries.map(entry => (entry.id.startsWith("cash:") && entry.lines.some(line => line.account === "649") ? { ...entry, lines: entry.lines.map(line => (line.account === "649" ? { ...line, account: "642" } : line)) } : entry));
    try {
      const report = await must("Defter Mutabakatı", admin.get("/api/workspace/report-center/defter-mutabakati"));
      assert.ok(report.rows.some(row => row[5] === "Kural Değişikliği Farkı"), "ön koşul: kilitli dönemde ayrışma var");
      assert.doesNotMatch(report.subtitle, /Defter kuralı program sürümüyle değişti/, `alt başlık nedeni bilinmeyen ayrışmayı "kural değişti" diye adlandırıyor: ${report.subtitle}`);
      assert.ok(report.subtitle.includes(ruleDiffHint()), `alt başlık denetimin tarafsız iletisini taşır: ${report.subtitle}`);
      assert.match(report.subtitle, /Yeni işlemler engellenmez \(aşağıda “Kural Değişikliği Farkı”\)\./);
    } finally {
      rule.fn = null;
    }
  });
});

describe("2.5.0 Ç3 tur 3 — YÜKSEK-1 (p5): açılışta süren eski kurallı (2.4.9) dondurma + aynı güne kilit", () => {
  it("T2 (p5): eski sürüm kilidi → açılış onarımının 2.4.9 koşusu yazım adımındayken aynı güne kilit → satırlar silinmez; koşu 2.4.9 kuralıyla tamamlanır, görünen = kayıtlı = canlı", async () => {
    const first = await startTestServer({ now: { time: NOW, fixed: true } });
    const dirs = { dataDir: first.dataDir, backupDir: first.backupDir };
    const held = gate();
    let second = null;
    try {
      await seed(await loginAdmin(first));
      await closeOnce(first);
      // Eski sürümün kilidi (2.4.9 BS-7 kapısını bilmez; koşu açmadan ayar yazar).
      const raw = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"));
      raw.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('ledger.lockedUntil', ?, ?, NULL) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(LOCK, new Date().toISOString());
      raw.close();
      let batches = 0;
      const hook = { fn: async phase => {
        if (phase === "batch" && ++batches >= 3) await held.wait();
      } };
      second = await startTestServer({ now: { time: NOW, fixed: true }, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
      const S = second.app.ledger.snapshots;
      assert.equal(second.app.context.snapshotRepair?.action, "freeze", `ön koşul: açılış onarımı eski sürüm kilidi için bekleyen koşu açtı (${JSON.stringify(second.app.context.snapshotRepair)})`);
      await until(() => batches >= 3 && S.status().phase === "yazım", `açılıştaki dondurma yazım adımında tutuluyor (${JSON.stringify(S.status())})`);
      const pending = S.state().pending;
      assert.equal(pending?.rule, "2.4.9", `ön koşul: eski kurallı koşu (${JSON.stringify(pending)})`);
      const written = second.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE run = ?", pending.no).n;
      assert.ok(written >= 15, `ön koşul: ${written} satır yazılmış`);
      const admin = await loginAdmin(second);
      await must("aynı gün", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      const kept = second.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE run = ?", pending.no).n;
      assert.ok(kept >= written, `aynı güne kilidin arka işi eski kurallı süren koşunun satırlarını sildi (${kept} / ${written})`);
      held.open();
      hook.fn = null;
      await waitForFreeze(admin);
      const last = assertWhole(second, "T2");
      assert.equal(last.rule_version, "2.4.9", "koşu kendi (2.4.9) kuralıyla tamamlandı");
    } finally {
      held.open();
      if (second) await second.close();
      await closeOnce(first).catch(() => {});
      removeTestDir(first.root);
    }
  });
});

describe("2.5.0 Ç3 tur 3 — ORTA-1: program temizlik bitmeden kapanırsa temizlik açılışta sürer ve süren iş sayılır", () => {
  it("T4b: geri çekilen dönemin temizliği yarıda kalır (kapanış) → açılışta sürer; ilerleme görünümü 'süren iş' der, yeniden kilit 409; bitince kilit 200", async () => {
    let held = gate();
    let cut = false;
    // Tutulan temizlik; cut → bir sonraki parçada kesilir (kapanıştan önce bayat satır kalsın: kapanış ya da kesinti, ikisi de yarım bırakır).
    const hook = { fn: async phase => {
      if (phase !== "purge") return;
      if (cut) throw new Error("test: temizlik yarıda kesildi");
      await held.wait();
    } };
    const first = await startTestServer({ now: { time: NOW, fixed: true }, __testFreezeHook: hook, freezeBatchLines: 5 });
    const dirs = { dataDir: first.dataDir, backupDir: first.backupDir };
    let second = null;
    try {
      const admin = await loginAdmin(first);
      const saved = hook.fn;
      hook.fn = null;
      await seed(admin);
      await lockAndWait(admin, LOCK);
      hook.fn = saved;
      await must("kilidi aç", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
      assert.equal((await must("görünüm", admin.get("/api/workspace/ledger/lock"))).freeze.cleanup?.running, true, "ön koşul: temizlik tutuluyor");
      // Temizlik yarıda kalır, program kapanır (kalan bayat satırlar dosyada).
      cut = true;
      held.open();
      await closeOnce(first);
      cut = false;
      const stale = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"), { readOnly: true });
      const left = stale.prepare("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date > ''").get().n;
      stale.close();
      assert.ok(left > 0, `ön koşul: kapanıştan sonra bayat satır kaldı (${left})`);
      held = gate();
      second = await startTestServer({ now: { time: NOW, fixed: true }, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
      const admin2 = await loginAdmin(second);
      await until(() => second.app.ledger.snapshots.status().cleanup?.running, `açılışta temizlik sürüyor (${JSON.stringify(second.app.ledger.snapshots.status())})`);
      const view = await must("görünüm", admin2.get("/api/workspace/ledger/lock"));
      assert.equal(view.freeze.active, true, `açılıştaki temizlik süren iş sayılmıyor (kart "bitti" görür, Kilitle açılır): ${JSON.stringify(view.freeze)}`);
      assert.equal(view.freeze.cleanup.running, true);
      const refused = await admin2.put("/api/admin/period-lock", { lockedUntil: LOCK });
      assert.equal(refused.status, 409, `açılıştaki temizlik sürerken yeniden kilit 409 almalı (${refused.status})`);
      assert.equal(refused.data.code, "ledger-cleanup-running");
      held.open();
      hook.fn = null;
      const done = await waitForFreeze(admin2);
      assert.equal(done.freeze.cleanup.running, false);
      await lockAndWait(admin2, LOCK);
      assertWhole(second, "T4b");
    } finally {
      held.open();
      hook.fn = null;
      if (second) await second.close();
      await closeOnce(first).catch(() => {});
      removeTestDir(first.root);
    }
  });
});

// S46 (KULLANICI KARARI 06.11 = A; dar kontrol ORTA-2): açılış onarımı eksilen donmuş dönemi, o dönemi donduran koşunun dondurma izi (ledger.snapshot.frozen) duruyorsa
// koşunun KENDİ kuralıyla yeniden dondurur (eksilme eski sürüm DIŞI bir nedenle: dış silme, program hatası); iz yoksa (2.4.9'un Şirket Verisini Sıfırla'sı önce işlem geçmişini
// siler) S13 gereği GAP_RULE (2.4.9 kopyası). Dış silme ham bağlantıyla benzetilir: kapalı sunucunun dosyasında silme tetikleyicisi kaldırılır, satırlar silinir, tetikleyiciler
// yeniden kurulur (dışarıdan bir araç; dondurma izi DURUR). Eski kodda (834cd0ad) izli dönem de 2.4.9 kuralıyla donar (karşı seçenek B'nin davranışı) → U1 / U3 kırmızı.
describe("2.5.0 Ç3 tur 3 — S46 = A: eksilen donmuş dönem izi duruyorsa kendi kuralıyla, izsizse 2.4.9 kopyasıyla yeniden donar", () => {
  const runsOf = store => store.all("SELECT no, kind, state, from_date AS fromDate, through, rule_version AS rule, reason FROM ledger_snapshot_runs ORDER BY no").map(row => ({ ...row }));
  const raw = (dirs, fn) => {
    const db = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"));
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };
  // Dış silme (izler durur): tetikleyici kaldırılır, (after, ∞) donmuş satırları silinir, tetikleyiciler yeniden kurulur. traces false → 2.4.9'un deseni (önce dondurma izleri).
  const wipe = (dirs, { after: day = "", traces = true, runs = null } = {}) => raw(dirs, db => {
    db.exec("BEGIN IMMEDIATE");
    if (!traces) {
      if (runs) for (const no of runs) db.prepare("DELETE FROM audit_events WHERE entity_id = ?").run(`ledger-snapshot-run:${no}`);
      else db.exec("DELETE FROM audit_events WHERE type LIKE 'ledger.snapshot.%'");
    }
    db.exec("DROP TRIGGER IF EXISTS ledger_snapshots_no_delete");
    const removed = Number(db.prepare("DELETE FROM ledger_snapshots WHERE date > ?").run(day).changes);
    db.exec(LEDGER_SNAPSHOT_TRIGGERS_V47);
    db.exec("COMMIT");
    return removed;
  });
  const MID = "2026-06-30";
  async function reopen(dirs) {
    const server = await startTestServer({ now: { time: NOW, fixed: true }, ...dirs });
    await server.app.ledger.snapshots.runPending();
    for (let i = 0; i < 20 && server.app.ledger.snapshots.state().pending; i += 1) await server.app.ledger.snapshots.runPending();
    return server;
  }
  const rulesIn = (store, from, to) => store.get("SELECT GROUP_CONCAT(DISTINCT rule_version) AS v FROM ledger_snapshots WHERE date > ? AND date <= ?", from, to).v;

  it("U1: bu programın (2.5.0 kuralıyla) dondurduğu dönemin satırları dışarıdan silinir (iz durur) → açılışta aynı (2.5.0) kuralla yeniden donar; donmuş = canlı", async () => {
    const first = await startTestServer({ now: { time: NOW, fixed: true } });
    const dirs = { dataDir: first.dataDir, backupDir: first.backupDir };
    let server = null;
    try {
      const admin = await loginAdmin(first);
      await seed(admin);
      await lockAndWait(admin, LOCK);
      const frozen = first.app.store.get("SELECT no, rule_version AS rule FROM ledger_snapshot_runs WHERE state = 'done' ORDER BY no DESC LIMIT 1");
      assert.equal(frozen.rule, LEDGER_RULE_VERSION, "ön koşul: dönem güncel kuralla dondu");
      await closeOnce(first);
      assert.ok(wipe(dirs, { after: "2026-03-31" }) > 0, "ön koşul: donmuş satırlar silindi");
      assert.ok(raw(dirs, db => db.prepare("SELECT 1 AS found FROM audit_events WHERE entity_id = ? AND type = 'ledger.snapshot.frozen'").get(`ledger-snapshot-run:${frozen.no}`)), "ön koşul: dondurma izi duruyor");
      server = await reopen(dirs);
      assert.equal(server.app.context.snapshotRepair?.damaged, true, `ön koşul: açılış onarımı eksik satırı gördü (${JSON.stringify(server.app.context.snapshotRepair)})`);
      const refrozen = runsOf(server.app.store).filter(run => run.kind === "freeze" && run.reason === "repair" && run.state === "done");
      assert.ok(refrozen.length >= 1, `yeniden donma koşusu: ${JSON.stringify(runsOf(server.app.store))}`);
      assert.deepEqual(refrozen.map(run => run.rule), [LEDGER_RULE_VERSION], `eksilen 2.5.0 dönemi ${refrozen.map(run => run.rule).join(", ")} kuralıyla yeniden dondu (S46 = A: koşunun kendi kuralı ${LEDGER_RULE_VERSION}): ${JSON.stringify(runsOf(server.app.store))}`);
      assert.equal(rulesIn(server.app.store, "2026-03-31", LOCK), LEDGER_RULE_VERSION);
      assertWhole(server, "U1");
    } finally {
      if (server) await server.close();
      await closeOnce(first).catch(() => {});
      removeTestDir(first.root);
    }
  });

  it("U2: izsiz bozulma (2.4.9'un deseni: önce dondurma izi, sonra satırlar) → açılışta GAP_RULE (2.4.9 kopyası) ile yeniden donar (S13)", async () => {
    const first = await startTestServer({ now: { time: NOW, fixed: true } });
    const dirs = { dataDir: first.dataDir, backupDir: first.backupDir };
    let server = null;
    try {
      const admin = await loginAdmin(first);
      await seed(admin);
      await lockAndWait(admin, LOCK);
      await closeOnce(first);
      assert.ok(wipe(dirs, { traces: false }) > 0, "ön koşul: izler ve satırlar silindi");
      server = await reopen(dirs);
      const refrozen = runsOf(server.app.store).filter(run => run.kind === "freeze" && run.reason === "repair" && run.state === "done");
      assert.deepEqual(refrozen.map(run => run.rule), [GAP_RULE], `izsiz dönem GAP_RULE ile donmalı: ${JSON.stringify(runsOf(server.app.store))}`);
      assertWhole(server, "U2");
    } finally {
      if (server) await server.close();
      await closeOnce(first).catch(() => {});
      removeTestDir(first.root);
    }
  });

  it("U3: karışık bileşim — (…, 30.06] 2.4.9 göç / onarım koşusu (izli), (30.06, 31.12] 2.5.0 koşusu (izli); satırların hepsi silinir → plan iki dilim: her dönem kendi kuralıyla", async () => {
    const first = await startTestServer({ now: { time: NOW, fixed: true } });
    const dirs = { dataDir: first.dataDir, backupDir: first.backupDir };
    let middle = null;
    let server = null;
    try {
      await seed(await loginAdmin(first));
      await closeOnce(first);
      // Eski sürümün kilidi (30.06): açılış onarımı 2.4.9 koşusu açar ve dondurur (izli).
      raw(dirs, db => db.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('ledger.lockedUntil', ?, ?, NULL) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(MID, new Date().toISOString()));
      middle = await reopen(dirs);
      assert.equal(middle.app.ledger.snapshots.coverage(), MID, "ön koşul: 30.06'ya kadar 2.4.9 ile dondu");
      assert.equal(rulesIn(middle.app.store, "", MID), "2.4.9");
      await lockAndWait(await loginAdmin(middle), LOCK);
      assert.equal(rulesIn(middle.app.store, MID, LOCK), LEDGER_RULE_VERSION, "ön koşul: (30.06, 31.12] güncel kuralla dondu");
      await middle.app.close();
      middle = null;
      assert.ok(wipe(dirs) > 0, "ön koşul: bütün donmuş satırlar silindi (izler duruyor)");
      server = await reopen(dirs);
      const refrozen = runsOf(server.app.store).filter(run => run.kind === "freeze" && run.reason === "repair" && run.state === "done" && run.no > 2);
      assert.deepEqual(refrozen.map(run => [run.fromDate, run.through, run.rule]), [["", MID, "2.4.9"], [MID, LOCK, LEDGER_RULE_VERSION]], `plan dilimleri kendi kurallarıyla donmalı: ${JSON.stringify(runsOf(server.app.store))}`);
      assert.equal(rulesIn(server.app.store, "", MID), "2.4.9");
      assert.equal(rulesIn(server.app.store, MID, LOCK), LEDGER_RULE_VERSION, `(30.06, 31.12] ${rulesIn(server.app.store, MID, LOCK)} kuralıyla yeniden dondu (S46 = A: ${LEDGER_RULE_VERSION})`);
      assertWhole(server, "U3");
    } finally {
      if (middle) await middle.app.close();
      if (server) await server.close();
      await closeOnce(first).catch(() => {});
      removeTestDir(first.root);
    }
  });
});

// T6 — 2.4.9 GERÇEK koduyla (git etiketi; test/guvenilirlik/surumler.mjs) üretilmiş KESİK kayıt: 2.4.9'da 600 tahsilat (600 işlem başlığı) → 2.0.26 GERÇEK kodu "Tüm Hareketleri Sil"
// (fin_events'i bilmez) → 2.4.9 açılışı: banka açılış onarımı 600 başlığı iptal eder, Mutabakat Günlüğü kaydının ayrıntısını 20.000 karakterde keser (geçersiz JSON; 2.4.9'un kendi
// Mutabakat Testi bu kayıtla 500 — Ç2 tur 3 ölçümü) → güncel kod. Beklenen: Mutabakat Testi 200; kesik satır günlükte "okunamadı" işaretiyle, öbür alanları aynen.
const OLD_TAGS = ["v2.4.9", "v2.0.26"];
describe("2.5.0 Ç3 tur 3 — (b) 2.4.9'dan kalan kesik Mutabakat Günlüğü kaydı Mutabakat Testi'ni düşürmez", { skip: tagsAvailable(OLD_TAGS) ? false : `${OLD_TAGS.join(", ")} etiketi yok (git fetch --tags)` }, () => {
  it("T6: v2.4.9 + v2.0.26 gerçek koduyla kesik kayıt → güncel kodda Mutabakat Testi 200, kesik satır detailUnreadable + neden (boş değil)", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "donmus-defter-tur3-kesik-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } };
    const at = time => ({ ...dirs, now: createClock({ time, fixed: true }) });
    try {
      let app = await bootVersion("v2.4.9", at("2027-01-10T10:00:00+03:00"));
      try {
        const api = await app.login();
        const account = await api.post("/api/workspace/accounts", { name: "Kesik Cari", type: "customer", registeredOn: "2026-12-01" });
        assert.equal(account.status, 200, JSON.stringify(account.data).slice(0, 300));
        for (let i = 0; i < 600; i += 1) {
          const entry = await api.post(`/api/workspace/accounts/${account.data.id}/entries`, { kind: "in", amount: String(10 + i), date: "2027-01-05" });
          assert.equal(entry.status, 200, `tahsilat ${i}: ${entry.status}`);
        }
      } finally {
        await app.close();
      }
      app = await bootVersion("v2.0.26", at("2027-01-10T10:30:00+03:00"));
      try {
        const reset = await (await app.login()).post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD });
        assert.equal(reset.status, 200, `2.0.26 Tüm Hareketleri Sil: ${reset.status} ${JSON.stringify(reset.data).slice(0, 300)}`);
      } finally {
        await app.close();
      }
      app = await bootVersion("v2.4.9", at("2027-01-10T11:00:00+03:00"));
      await app.close();
      const raw = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"), { readOnly: true });
      const records = raw.prepare("SELECT id, length(detail_json) AS len, detail_json AS detail FROM integrity_log WHERE action = 'repair' ORDER BY rowid").all();
      raw.close();
      const cut = records.filter(row => {
        try {
          JSON.parse(row.detail);
          return false;
        } catch {
          return true;
        }
      });
      assert.ok(cut.length >= 1, `ön koşul: 2.4.9 kesik kayıt yazdı (${JSON.stringify(records.map(row => row.len))})`);
      app = await bootVersion(CURRENT, at("2027-01-10T12:00:00+03:00"));
      try {
        const scan = await (await app.login()).get("/api/workspace/ledger/integrity");
        assert.equal(scan.status, 200, `Mutabakat Testi kesik kayıtla düştü: ${scan.status} ${JSON.stringify(scan.data).slice(0, 300)}`);
        const row = scan.data.log.find(item => item.id === cut[0].id);
        assert.ok(row, "kesik kayıt günlükte görünür (atlanmadı)");
        assert.equal(row.detailUnreadable, true, "kesik kayıt okunamadı diye işaretli");
        assert.equal(row.detail, null, "okunamayan ayrıntı boş dizi değil");
        assert.match(row.detailNote, /^Kayıt ayrıntısı okunamadı \(kesik ya da bozuk kayıt; 20000 karakter\)\.$/);
        assert.match(row.summary, /Açılış onarımı \(eski sürümden\)/, "satırın öbür alanları aynen");
        assert.ok(scan.data.log.filter(item => item.id !== cut[0].id).every(item => !item.detailUnreadable), "geçerli kayıtlar ayrıştırılır");
      } finally {
        await app.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });
});
