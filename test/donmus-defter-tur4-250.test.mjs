// 2.5.0 Ç3 TUR 4 — Ç3 tur 3 dar kontrolünün bulguları (06.11.2026 ~14:40; docs/erp/C3-DONDURMA-TASARIM.md §20).
//   V (ORTA-1; S46 = A AYNEN — KULLANICI KARARI 06.11 10:14): açılış onarımının yeniden donma planı (eksilen donmuş dönem: izi duran koşunun KENDİ kuralı, izsizi GAP_RULE), planın
//     İLK dilimi güncel kurallıyken yarıda kesilince düşüyordu: yeniden açılışta (repairOnOpen'un "taşınan koşu" kararı yalnız kurala bakıyordu) ve aynı güne yeniden kaydetmede
//     (lockChanged, PUT'un durdurması ve lockNeedsCleanup yalnız bekleyen koşunun gününe bakıyordu) bütün dönem tek kuralla donuyordu. Dar kontrolün iki deseni (s46-plan.mjs kapanis /
//     aynigun) + yazım sürerken aynı gün (durdurma yok) + hatalı denemenin artığıyla aynı gün (409 yok). İki bileşim: "s46" (ilk dilim 2.5.0 — bulgu) ve "u3" (ilk dilim 2.4.9 —
//     tur 3 U3; önceden de korunuyordu, gerilemesin). v2.4.9 GERÇEK koduyla ilerletilmiş kilit (X).
//   W (ORTA-1'in eşi; S13 = A): eski kurallı koşu sürerken ESKİ SÜRÜM kilidi ilerletti, dondurma düştü, yönetici aynı günü yeniden kaydetti → eski sürümün ilerlettiği dönem GAP_RULE
//     (önceden carryLock kilidi "bu program ilerletti" diye işaretliyor, dönem güncel kuralla donuyordu).
//   D (DÜŞÜK-1, test dişi): yazım bayrağı iş parçacığı bitince, tablo doğrulamasından ÖNCE kalkarsa (mutant 901) "before-done" ve "doğrulama" pencerelerinde aynı güne yinelenen kilidin
//     arka işi koşunun satırlarını siler (dar kontrol: 100.000'de 6.500 satır, koşu "tamam" — sessiz kayıp). Koşu iki pencerede tutulur, aynı güne PUT atılır: satırlar = yazılan,
//     sonunda donmuş = canlı.
// Gerçek program (startTestServer), sahte sabit saat (2027-01-10 10:00 +03:00; ders 13, 22). Ön koşullar KAPIYLA tutulur (YALNIZ TEST kancası __testFreezeHook "batch" / "before-done" /
// "verify" / "purge"; süreye bağlı değil — ders 20); her ön koşul ayrıca denetlenir. Eski sürümün kilidi ve dış silme ham bağlantıyla (kapalı sunucunun dosyası; dondurma izleri DURUR).
// Eski kodda (f4a43cbd) V-s46 ve W beklenen nedenle kırmızıdır (ders 7, 38); D eski kodda da yeşil (davranış doğruydu; dişi mutant 901 / 902), "doğrulama" penceresinin kancası yok.
import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { createClock } from "../server/lib/clock.mjs";
import { LEDGER_RULE_VERSION } from "../server/lib/general-ledger.mjs";
import { GAP_RULE } from "../server/lib/ledger-snapshots.mjs";
import { LEDGER_SNAPSHOT_TRIGGERS_V47 } from "../server/lib/migrations.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { lockAndWait, waitForFreeze } from "./fixtures/donma-bekle.mjs";
import { bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const NOW = "2027-01-10T10:00:00+03:00";
const LOCK = "2026-12-31";
const MID = "2026-06-30";
const ENV = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 400)}`);
  return response.data.data;
};
const canon = entries => entries.map(entry => ({ id: entry.id, date: entry.date, source: entry.source || "", text: entry.text || "", lines: entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit]) }));
const upTo = (entries, day) => entries.filter(entry => entry.date <= day);
const lineCount = entries => entries.reduce((sum, entry) => sum + entry.lines.length, 0);
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
// Sunucu bir kez kapanır: denetim kapanıştan ÖNCE düşerse finally de kapatır (açık sunucu test sürecini bitirmez).
const closeOnce = async server => {
  if (!server || server.closedOnce) return;
  server.closedOnce = true;
  await server.app.close();
};

// Programın kendi API'siyle: 2026'nın her ayına Kasa girişleri + bir cari (açılış, tahsilat) + 2027 başı.
async function seed(admin, count = 40) {
  const customer = await must("cari", admin.post("/api/workspace/accounts", { name: "Ece Tan", registeredOn: "2026-01-03" }));
  await must("açılış", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "700", date: "2026-01-03", note: "Devir borcu" })); // 2.5.0 Ç5-A (G3): Ç3 mekaniği verisi iki kuralda da AYNI türetilsin diye açılış dışı açıklama ("Açılış…" Borç Yaz 2.4.9 kuralında 500, güncel kuralda 602 — K8-1; o ayrışma kural tuzağı ve test/acilis-*-250 testlerinin konusu)
  for (let i = 1; i <= count; i += 1) await must(`kasa ${i}`, admin.post("/api/workspace/cash", { kind: "in", amount: String(10 + i), date: `2026-${String(1 + (i % 12)).padStart(2, "0")}-1${i % 9}`, description: `Giriş ${i}` }));
  await must("tahsilat", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "150", date: "2026-11-20", method: "cash", note: "Tahsilat" }));
  await must("yeni yıl", admin.post("/api/workspace/cash", { kind: "in", amount: "25", date: "2027-01-04", description: "Yeni yıl" }));
}

const runsOf = store => store.all("SELECT no, kind, state, from_date AS fromDate, through, rule_version AS rule, reason FROM ledger_snapshot_runs ORDER BY no").map(row => ({ ...row }));
const rulesIn = (store, from, to) => store.get("SELECT GROUP_CONCAT(DISTINCT rule_version) AS v FROM ledger_snapshots WHERE date > ? AND date <= ?", from, to).v;
const planTraceOf = (store, no) => store.get("SELECT payload_json AS p FROM audit_events WHERE type = 'ledger.snapshot.plan' AND entity_id = ?", `ledger-snapshot-run:${no}`)?.p || null;
const raw = (dataDir, fn) => {
  const db = new DatabaseSync(path.join(dataDir, "destekofis.sqlite"));
  try {
    return fn(db);
  } finally {
    db.close();
  }
};
// Eski sürümün (≤ 2.4.9; BS-7 kapısını bilmez) kilidi: koşu açmadan yalnız ayar.
const setLockRaw = (dataDir, day) => raw(dataDir, db => db.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('ledger.lockedUntil', ?, ?, NULL) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(day, new Date().toISOString()));
// Dış silme (izler DURUR): silme tetikleyicisi kaldırılır, bütün donmuş satırlar silinir, tetikleyiciler yeniden kurulur (test/donmus-defter-tur3-250.test.mjs wipe ile aynı).
const wipe = dataDir => raw(dataDir, db => {
  db.exec("BEGIN IMMEDIATE");
  db.exec("DROP TRIGGER IF EXISTS ledger_snapshots_no_delete");
  const removed = Number(db.prepare("DELETE FROM ledger_snapshots WHERE date > ''").run().changes);
  db.exec(LEDGER_SNAPSHOT_TRIGGERS_V47);
  db.exec("COMMIT");
  return removed;
});
async function settle(server) {
  const S = server.app.ledger.snapshots;
  for (let i = 0; i < 20; i += 1) {
    await S.runPending();
    if (!S.state().pending) break;
  }
}

// Bitmiş dondurmanın bütünlüğü: kapsam = kilit; görünen donmuş satır = son koşunun kayıtlı satırı (state_lines) = canlı türetme; madde madde donmuş = canlı.
function assertWhole(server, label) {
  const store = server.app.store;
  const S = server.app.ledger.snapshots;
  assert.equal(S.coverage(), LOCK, `${label}: kapsam = kilit (${JSON.stringify(runsOf(store))})`);
  const last = store.get("SELECT no, rule_version, state_lines FROM ledger_snapshot_runs WHERE state = 'done' ORDER BY no DESC LIMIT 1");
  const visible = store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date <= ?", LOCK).n;
  const live = upTo(server.app.ledger.build(), LOCK);
  assert.equal(visible, Number(last.state_lines), `${label}: görünen donmuş satır = koşunun kayıtlı satırı (${visible} / ${last.state_lines})`);
  assert.equal(visible, lineCount(live), `${label}: görünen donmuş satır = canlı türetme (${visible} / ${lineCount(live)})`);
  assert.deepEqual(canon(S.entries()), canon(live), `${label}: donmuş = canlı (madde madde)`);
}

// S46 = A beklentisi: her dönem kendi kuralıyla. "s46": (…, 30.06] bu programın 2.5.0 koşusu (izli), (30.06, 31.12] eski sürümün ilerlettiği kilidin GAP_RULE onarım koşusu (bu
// program dondurdu → izli) — planın İLK dilimi güncel kurallı (dar kontrol ORTA-1). "u3": tersi (tur 3 U3) — ilk dilim 2.4.9.
const EXPECTED = { s46: [LEDGER_RULE_VERSION, GAP_RULE], u3: [GAP_RULE, LEDGER_RULE_VERSION] };
function assertPlan(server, order, label) {
  const store = server.app.store;
  const [head, tail] = EXPECTED[order];
  assert.equal(rulesIn(store, "", MID), head, `${label}: (…, 30.06] ${rulesIn(store, "", MID)} kuralıyla dondu (S46 = A: ${head}); koşular ${JSON.stringify(runsOf(store))}`);
  assert.equal(rulesIn(store, MID, LOCK), tail, `${label}: (30.06, 31.12] ${rulesIn(store, MID, LOCK)} kuralıyla dondu (S46 = A: ${tail}); koşular ${JSON.stringify(runsOf(store))}`);
  assertWhole(server, label);
}

/**
 * Bileşimi kurar, sunucuları kapatır, bütün donmuş satırları dışarıdan siler (izler durur). advance: eski sürümün kilit ilerletmesi — "raw" (yalnız ayar; T2 / U3 deseni) ya da
 * "v249" (v2.4.9 GERÇEK kodu: PUT period-lock + açık döneme Kasa). Dönüş: { first, dirs } (first kapalı; çağıran first.root'u siler).
 */
async function composed(order, { advance = "raw" } = {}) {
  const first = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV });
  const dirs = { dataDir: first.dataDir, backupDir: first.backupDir };
  let middle = null;
  try {
    const admin = await loginAdmin(first);
    await seed(admin);
    if (order === "s46") await lockAndWait(admin, MID);
    await closeOnce(first);
    const oldLock = order === "s46" ? LOCK : MID;
    if (advance === "v249") {
      const v249 = await bootVersion("v2.4.9", { ...dirs, env: ENV, now: createClock({ time: NOW, fixed: true }) });
      try {
        const api = await v249.login();
        const put = await api.put("/api/admin/period-lock", { lockedUntil: oldLock });
        assert.equal(put.status, 200, `ön koşul: v2.4.9 kilidi ${oldLock}: ${put.status} ${JSON.stringify(put.data).slice(0, 300)}`);
        const cash = await api.post("/api/workspace/cash", { kind: "in", amount: "77", date: "2027-01-06", description: "2.4.9 açık dönem" });
        assert.equal(cash.status, 200, `ön koşul: v2.4.9 açık döneme Kasa: ${cash.status}`);
      } finally {
        await v249.close();
      }
    } else setLockRaw(dirs.dataDir, oldLock);
    middle = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs });
    await settle(middle);
    if (order === "u3") await lockAndWait(await loginAdmin(middle), LOCK);
    assert.equal(middle.app.ledger.snapshots.coverage(), LOCK, `ön koşul: bileşim donmuş (${JSON.stringify(runsOf(middle.app.store))})`);
    assert.deepEqual([rulesIn(middle.app.store, "", MID), rulesIn(middle.app.store, MID, LOCK)], EXPECTED[order], "ön koşul: bileşimin kuralları");
    await closeOnce(middle);
    middle = null;
    assert.ok(wipe(dirs.dataDir) > 0, "ön koşul: donmuş satırlar dışarıdan silindi");
    const traces = raw(dirs.dataDir, db => db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'ledger.snapshot.frozen'").get().n);
    assert.ok(traces >= 2, `ön koşul: dondurma izleri duruyor (${traces})`);
    return { first, dirs };
  } catch (error) {
    await closeOnce(middle).catch(() => {});
    removeTestDir(first.root);
    throw error;
  }
}
// Açılış onarımının planı: ilk dilim bekleyen koşu, kalan dilim izde (ön koşul).
function assertPlanStarted(server, order) {
  assert.equal(server.app.context.snapshotRepair?.damaged, true, `ön koşul: açılış onarımı eksik satırı gördü (${JSON.stringify(server.app.context.snapshotRepair)})`);
  const pending = server.app.ledger.snapshots.state().pending;
  assert.deepEqual([pending?.from, pending?.through, pending?.rule], ["", MID, EXPECTED[order][0]], `ön koşul: planın ilk dilimi bekliyor (${JSON.stringify(pending)})`);
  assert.match(String(planTraceOf(server.app.store, pending.no)), /"rule":"/, "ön koşul: planın kalan dilimi koşunun izinde");
  return pending;
}

for (const order of ["s46", "u3"]) {
  describe(`2.5.0 Ç3 tur 4 — ORTA-1 (S46 = A): yeniden donma planı yarıda kesilince korunur — bileşim ${order} (ilk dilim ${EXPECTED[order][0]})`, () => {
    it(`V1 ${order} (dar kontrol "kapanis"): plan sürerken (ilk dilim yazım adımında) program kapanır → yeniden açılışta plan sürer; her dönem kendi kuralıyla, donmuş = canlı`, async () => {
      const { first, dirs } = await composed(order);
      const held = gate();
      let batches = 0;
      const hook = { fn: async phase => {
        if (phase === "batch" && ++batches >= 2) await held.wait();
      } };
      let server = null;
      let again = null;
      try {
        server = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
        assertPlanStarted(server, order);
        await until(() => batches >= 2 && server.app.ledger.snapshots.status().phase === "yazım", `planın ilk dilimi yazım adımında tutuluyor (${JSON.stringify(server.app.ledger.snapshots.status())})`);
        const closing = closeOnce(server);
        held.open();
        await closing;
        again = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs });
        await settle(again);
        assertPlan(again, order, "V1");
        assert.equal(runsOf(again.app.store).filter(run => run.state === "abandoned").length, 0, `yeniden açılış planın koşusunu bıraktı: ${JSON.stringify(runsOf(again.app.store))}`);
      } finally {
        held.open();
        hook.fn = null;
        await closeOnce(server).catch(() => {});
        await closeOnce(again).catch(() => {});
        removeTestDir(first.root);
      }
    });

    it(`V2 ${order} (dar kontrol "aynigun"): planın ilk dilimi hata verir (kart "kilidi yeniden kaydedin") → yönetici AYNI günü yeniden kaydeder → plan sürer; her dönem kendi kuralıyla`, async () => {
      const { first, dirs } = await composed(order);
      let batches = 0;
      const hook = { fn: async phase => {
        if (phase === "batch" && ++batches >= 2) throw new Error("test: dondurma düştü (disk / bellek benzetimi)");
      } };
      let server = null;
      try {
        server = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
        const S = server.app.ledger.snapshots;
        const pending = assertPlanStarted(server, order);
        await until(() => batches >= 2 && !S.status().running && S.status().phase === "hata", `planın ilk dilimi hata verdi (${JSON.stringify(S.status())})`);
        hook.fn = null;
        const admin = await loginAdmin(server);
        const card = await must("kart", admin.get("/api/workspace/ledger/lock"));
        assert.match(card.freeze.error, /test: dondurma düştü/, "ön koşul: kart hatayı gösteriyor");
        assert.equal(card.freeze.pending?.no, pending.no, "ön koşul: planın ilk dilimi bekliyor");
        const put = await admin.put("/api/admin/period-lock", { lockedUntil: LOCK });
        assert.equal(put.status, 200, `aynı güne yeniden kaydetme: ${put.status} ${JSON.stringify(put.data).slice(0, 300)}`);
        await waitForFreeze(admin);
        await settle(server);
        assertPlan(server, order, "V2");
        assert.equal(runsOf(server.app.store).find(run => run.no === pending.no)?.state, "done", `aynı güne yeniden kaydetme planın ilk dilimini bıraktı: ${JSON.stringify(runsOf(server.app.store))}`);
      } finally {
        hook.fn = null;
        await closeOnce(server).catch(() => {});
        removeTestDir(first.root);
      }
    });

    it(`V3 ${order}: planın ilk dilimi YAZILIRKEN aynı güne yeniden kaydetme süren dondurmayı durdurmaz (baştan başlamaz, satırları silinmez); plan sürer`, async () => {
      const { first, dirs } = await composed(order);
      const held = gate();
      let batches = 0;
      const hook = { fn: async phase => {
        if (phase === "batch" && ++batches >= 3) await held.wait();
      } };
      let server = null;
      try {
        server = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
        const S = server.app.ledger.snapshots;
        const pending = assertPlanStarted(server, order);
        await until(() => batches >= 3 && S.status().running && S.status().phase === "yazım", `planın ilk dilimi yazım adımında tutuluyor (${JSON.stringify(S.status())})`);
        const written = server.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE run = ?", pending.no).n;
        assert.ok(written >= 15, `ön koşul: ${written} satır yazılmış`);
        const admin = await loginAdmin(server);
        await must("aynı gün", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
        const now = S.status();
        assert.ok(now.running && now.run === pending.no && now.done >= written, `kilit değişmezken (aynı gün) planın dondurması durduruldu ya da baştan başladı: ${JSON.stringify(now)}; koşular ${JSON.stringify(runsOf(server.app.store))}`);
        const kept = server.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE run = ?", pending.no).n;
        assert.ok(kept >= written, `aynı güne yeniden kaydetme planın yazılan satırlarını sildi (${kept} / ${written})`);
        held.open();
        hook.fn = null;
        await waitForFreeze(admin);
        await settle(server);
        assertPlan(server, order, "V3");
      } finally {
        held.open();
        hook.fn = null;
        await closeOnce(server).catch(() => {});
        removeTestDir(first.root);
      }
    });

    it(`V4 ${order}: planın ilk dilimi hata verdi, denemenin artığı (bayat satırlar) duruyor → aynı güne yeniden kaydetme temizlik beklemez (409 yok; kilit değişmiyor, koşu açılmaz); plan sürer`, async () => {
      const { first, dirs } = await composed(order);
      const held = gate();
      let failing = true;
      let batches = 0;
      const hook = { fn: async phase => {
        if (phase === "batch" && failing && ++batches >= 3) throw new Error("test: dondurma düştü (disk / bellek benzetimi)");
        if (phase === "purge") await held.wait();
      } };
      let server = null;
      try {
        server = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
        const S = server.app.ledger.snapshots;
        const pending = assertPlanStarted(server, order);
        await until(() => batches >= 3 && !S.status().running && S.status().phase === "hata", `planın ilk dilimi hata verdi (${JSON.stringify(S.status())})`);
        failing = false;
        const left = server.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE run = ?", pending.no).n;
        assert.ok(left >= 10, `ön koşul: hatalı denemenin artığı duruyor (${left} satır; temizlik tutulacak)`);
        const admin = await loginAdmin(server);
        const put = await admin.put("/api/admin/period-lock", { lockedUntil: LOCK });
        assert.equal(put.status, 200, `kilit değişmezken (aynı gün) temizlik istendi: ${put.status} ${put.data?.code || ""} ${JSON.stringify(put.data).slice(0, 300)}`);
        assert.notEqual(runsOf(server.app.store).find(run => run.no === pending.no)?.state, "abandoned", `aynı güne yeniden kaydetme planın ilk dilimini bıraktı: ${JSON.stringify(runsOf(server.app.store))}`);
        held.open();
        hook.fn = null;
        await waitForFreeze(admin);
        await settle(server);
        assertPlan(server, order, "V4");
      } finally {
        held.open();
        hook.fn = null;
        await closeOnce(server).catch(() => {});
        removeTestDir(first.root);
      }
    });
  });
}

// X — v2.4.9 GERÇEK koduyla (git etiketi; test/guvenilirlik/surumler.mjs; ders 17): bu program kilit 30.06 (2.5.0, izli) → v2.4.9 kilidi 31.12'ye İLERLETİR + açık döneme Kasa →
// bu program (30.06, 31.12] GAP_RULE ile dondurur (izli) → dış silme (izler durur) → açılış planı [(…, 30.06] 2.5.0, (30.06, 31.12] 2.4.9]; plan sürerken kesinti / hata.
const OLD_TAGS = ["v2.4.9"];
describe("2.5.0 Ç3 tur 4 — ORTA-1: v2.4.9 GERÇEK koduyla ilerletilmiş kilit", { skip: tagsAvailable(OLD_TAGS) ? false : `${OLD_TAGS.join(", ")} etiketi yok (git fetch --tags)` }, () => {
  it("X1 (v249-s46 ilerlet kapanis): plan sürerken program kapanır → yeniden açılışta (…, 30.06] 2.5.0, (30.06, 31.12] 2.4.9; donmuş = canlı; Mutabakat Testi temiz", async () => {
    const { first, dirs } = await composed("s46", { advance: "v249" });
    const held = gate();
    let batches = 0;
    const hook = { fn: async phase => {
      if (phase === "batch" && ++batches >= 2) await held.wait();
    } };
    let server = null;
    let again = null;
    try {
      server = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
      assertPlanStarted(server, "s46");
      await until(() => batches >= 2 && server.app.ledger.snapshots.status().phase === "yazım", `planın ilk dilimi yazım adımında tutuluyor (${JSON.stringify(server.app.ledger.snapshots.status())})`);
      const closing = closeOnce(server);
      held.open();
      await closing;
      again = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs });
      await settle(again);
      assertPlan(again, "s46", "X1");
      const scan = await must("Mutabakat Testi", (await loginAdmin(again)).get("/api/workspace/ledger/integrity"));
      assert.equal(scan.ok, true, `Mutabakat Testi temiz: ${JSON.stringify(scan.failures?.map(item => `${item.name}: ${(item.sample || []).join(" | ")}`))}`);
    } finally {
      held.open();
      hook.fn = null;
      await closeOnce(server).catch(() => {});
      await closeOnce(again).catch(() => {});
      removeTestDir(first.root);
    }
  });

  it("X2 (v2.4.9 ilerletmesi + aynı gün): planın ilk dilimi hata verir → aynı güne yeniden kaydetme → (…, 30.06] 2.5.0, (30.06, 31.12] 2.4.9", async () => {
    const { first, dirs } = await composed("s46", { advance: "v249" });
    let batches = 0;
    const hook = { fn: async phase => {
      if (phase === "batch" && ++batches >= 2) throw new Error("test: dondurma düştü (disk / bellek benzetimi)");
    } };
    let server = null;
    try {
      server = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
      const S = server.app.ledger.snapshots;
      assertPlanStarted(server, "s46");
      await until(() => batches >= 2 && !S.status().running && S.status().phase === "hata", `planın ilk dilimi hata verdi (${JSON.stringify(S.status())})`);
      hook.fn = null;
      const admin = await loginAdmin(server);
      await must("aynı güne yeniden kaydetme", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      await waitForFreeze(admin);
      await settle(server);
      assertPlan(server, "s46", "X2");
    } finally {
      hook.fn = null;
      await closeOnce(server).catch(() => {});
      removeTestDir(first.root);
    }
  });
});

// W — S13 = A: eski kurallı (2.4.9) onarım koşusu (…, 30.06] yarıda kalır; eski sürüm kilidi 31.12'ye ilerletir; yeniden açılışta koşu sürer (taşınan koşu) ama hata verir; yönetici
// aynı günü (31.12) yeniden kaydeder. Bu program kilidi İLERLETMEDİ: (30.06, 31.12] eski sürümün ilerlettiği dönemdir → GAP_RULE (2.4.9). Eski kodda carryLock "ilerletme izi" yazıyor,
// dönem güncel kuralla donuyordu.
describe("2.5.0 Ç3 tur 4 — S13 = A: aynı güne yeniden kaydetme eski sürümün ilerlettiği dönemi güncel kurala geçirmez", () => {
  it("W1: eski kurallı koşu + eski sürüm ilerletmesi + hata + aynı gün → (…, 30.06] ve (30.06, 31.12] 2.4.9; ilerletme izi yazılmaz; donmuş = canlı", async () => {
    const first = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV });
    const dirs = { dataDir: first.dataDir, backupDir: first.backupDir };
    const held = gate();
    let mode = "hold";
    let batches = 0;
    const hook = { fn: async phase => {
      if (phase !== "batch") return;
      batches += 1;
      if (mode === "hold" && batches >= 2) await held.wait();
      if (mode === "fail" && batches >= 2) throw new Error("test: dondurma düştü (disk / bellek benzetimi)");
    } };
    let second = null;
    let third = null;
    try {
      await seed(await loginAdmin(first));
      await closeOnce(first);
      setLockRaw(dirs.dataDir, MID);
      second = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
      const pending = second.app.ledger.snapshots.state().pending;
      assert.deepEqual([pending?.through, pending?.rule], [MID, GAP_RULE], `ön koşul: eski sürüm kilidinin onarım koşusu (${JSON.stringify(pending)})`);
      await until(() => batches >= 2 && second.app.ledger.snapshots.status().phase === "yazım", "onarım koşusu yazım adımında tutuluyor");
      const closing = closeOnce(second);
      held.open();
      await closing;
      setLockRaw(dirs.dataDir, LOCK);
      mode = "fail";
      batches = 0;
      third = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, ...dirs, __testFreezeHook: hook, freezeBatchLines: 5 });
      const S = third.app.ledger.snapshots;
      assert.equal(S.state().pending?.no, pending.no, `ön koşul: eski kurallı koşu yeniden açılışta sürüyor (${JSON.stringify(runsOf(third.app.store))})`);
      await until(() => batches >= 2 && !S.status().running && S.status().phase === "hata", `ön koşul: koşu hata verdi (${JSON.stringify(S.status())})`);
      hook.fn = null;
      const admin = await loginAdmin(third);
      await must("aynı güne yeniden kaydetme", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      await waitForFreeze(admin);
      await settle(third);
      const store = third.app.store;
      assert.equal(rulesIn(store, "", MID), GAP_RULE, `(…, 30.06] ${rulesIn(store, "", MID)} kuralıyla dondu (koşunun kendi kuralı ${GAP_RULE})`);
      assert.equal(rulesIn(store, MID, LOCK), GAP_RULE, `eski sürümün ilerlettiği dönem (30.06, 31.12] ${rulesIn(store, MID, LOCK)} kuralıyla dondu (S13 = A: ${GAP_RULE}) — aynı güne yeniden kaydetme "bu program ilerletti" izi yazdı; koşular ${JSON.stringify(runsOf(store))}`);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'ledger.snapshot.extended'").n, 0, "kilit değişmezken ilerletme izi yazılmaz");
      assertWhole(third, "W1");
    } finally {
      held.open();
      hook.fn = null;
      await closeOnce(second).catch(() => {});
      await closeOnce(third).catch(() => {});
      await closeOnce(first).catch(() => {});
      removeTestDir(first.root);
    }
  });
});

// D — DÜŞÜK-1 (test dişi): koşu "before-done" (iş parçacığı bitti, tablo doğrulamasından önce) ve "doğrulama" (ilk parça özetlendi, parçalar arası) pencerelerinde tutulur; aynı güne
// yinelenen kilidin arka işi (bayat satır temizliği) yazılan koşunun satırlarına dokunmamalı. Dişi: mutant 901 (yazım bayrağı iş parçacığı bitince kalkar) ve 902 (doğrulama
// başlarken kalkar) — test/donmus-defter-250-mutasyon.mjs.
describe("2.5.0 Ç3 tur 4 — DÜŞÜK-1: 'before-done' ve 'doğrulama' pencerelerinde aynı güne kilit yazılan koşunun satırlarını silmez", () => {
  let server;
  let admin;
  const hook = { fn: null, verifyLines: 0 };
  const S = () => server.app.ledger.snapshots;
  const runRows = no => server.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE run = ?", no).n;
  const unlockAll = async () => {
    hook.fn = null;
    hook.verifyLines = 0;
    await waitForFreeze(admin);
    await must("kilidi kaldır", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
    await waitForFreeze(admin);
  };
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, env: ENV, __testFreezeHook: hook, freezeBatchLines: 5 });
    admin = await loginAdmin(server);
    await seed(admin);
  });
  after(async () => {
    hook.fn = null;
    await server?.close();
  });

  for (const [name, phaseName, setup] of [
    ["D1 before-done", "before-done", () => {}],
    ["D2 doğrulama (ilk parça özetlendi)", "verify", () => {
      hook.verifyLines = 20;
    }],
  ]) {
    it(`${name}: koşu bu pencerede tutulurken aynı güne yinelenen kilit yazılan satırları silmez — satırlar = yazılan; bitince görünen = kayıtlı = canlı; Mutabakat Testi temiz`, async () => {
      await unlockAll();
      setup();
      const held = gate();
      let reached = null;
      hook.fn = async (phase, info) => {
        if (phase !== phaseName || (phase === "verify" && !(info.low >= 20))) return;
        reached = { phase, low: info?.low ?? null };
        await held.wait();
      };
      let first = null;
      try {
        first = admin.put("/api/admin/period-lock", { lockedUntil: LOCK });
        await until(() => reached && S().status().running, `dondurma "${phaseName}" penceresinde tutuluyor (${JSON.stringify({ reached, status: S().status() })})`);
        if (phaseName === "verify") assert.equal(S().status().phase, "doğrulama", "ön koşul: tablo doğrulaması sürüyor");
        const runNo = S().status().run;
        const written = runRows(runNo);
        assert.equal(written, lineCount(upTo(server.app.ledger.build(), LOCK)), `ön koşul: koşunun bütün satırları yazılmış (${written})`);
        const again = await must("aynı gün", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
        assert.equal(again.freeze.pending?.no, runNo, "aynı bekleyen koşu");
        const kept = runRows(runNo);
        assert.equal(kept, written, `aynı güne yinelenen kilidin arka işi "${phaseName}" penceresinde yazılan koşunun satırlarını sildi (${kept} / ${written})`);
        held.open();
        hook.fn = null;
        assert.equal((await first).status, 200);
      } finally {
        held.open();
        hook.fn = null;
        await first?.catch(() => {});
      }
      const view = await waitForFreeze(admin);
      assert.equal(view.freeze.error, "", `dondurma hatasız bitti: ${JSON.stringify(view.freeze)}`);
      assertWhole(server, name);
      const scan = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
      assert.equal(scan.ok, true, `Mutabakat Testi temiz: ${JSON.stringify(scan.failures?.map(item => `${item.name}: ${(item.sample || []).join(" | ")}`))}`);
    });
  }
});
