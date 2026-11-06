// 2.5.0 Ç3 TUR 2 — dönem kilidi ucu (PUT /api/admin/period-lock; docs/erp/C3-DONDURMA-TASARIM.md §18, plan docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §8 "1.000.000: hedef ≤ 2 dk,
// İLERLEME; olay döngüsü ≤ 50 ms").
//   K1–K3 (Ç3 dar kontrol DÜŞÜK-1 → ORTA, sakınca süzgeci: defter): sıra DOĞRULA → ÖN ADIM (POS) → SÜREN DONDURMAYI DURDUR → KİLİT + KOŞU (tek işlem). Reddedilen istek (geçersiz /
//     gelecek tarih 400, POS ön adımı 409) süren dondurmayı durdurmaz, POS ön adımını çalıştırmaz; durdurduktan sonra kilit yazılamazsa (kapı / disk) durdurulan koşu sahipsiz kalmaz.
//   K4–K9 (PUT bekleme / İLERLEME; 1.000.000 satırda dondurma ~85 sn, istemci sınırı 30 sn — kanıt docs/kanit/2026-11-06/c3t2-yeniden-uret-1m-eski): uç arka işi (kapının kilit izi
//     ‖ dondurma) EN ÇOK 5 sn bekler (T2-2; kısa işte eski davranış — F1); uzun dondurma arkada sürer, kapının izi bütçe içinde gelir; bu arada kilitli dönem bekleyen koşunun kuralıyla
//     canlı okunur (K1 kararı), kilitli döneme yazım 409, açık döneme 200; ilerleme GET .../lock → freeze (pending, active, phase, done); geri çekmede bayat satırlar ve iz arkada;
//     kapanış süren işi bitirir (kapalı bağlantıya çarpan iş yok); aynı güne yinelenen istek süren dondurmayı durdurmaz; kilitli fişin Ters Kaydet'i dondurma sürerken 200 (K8); iz de
//     bütçeden uzunsa yanıt ~5 sn'de (K9).
// Gerçek program (startTestServer), sahte sabit saat (2027-01-10 10:00 +03:00; ders 13, 22), iki saat diliminde aynı yerel gün. Dondurmayı uzatmak için YALNIZ TEST kancası
// (__testFreezeHook: parça başına ya da bitişten önce bekleme; ürün davranışı değişmez, yalnız süre). Eski kodda (40473f17) K1 "reddedilen istek süren dondurmayı durdurdu",
// K3 "durdurulan koşu sahipsiz kaldı", K4 "uç dondurmayı bekledi" nedeniyle kırmızıdır (ders 7, 38).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { HttpError } from "../server/lib/http.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { waitForFreeze } from "./fixtures/donma-bekle.mjs";

const NOW = "2027-01-10T10:00:00+03:00";
const LOCK = "2026-12-31";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const must = async (label, promise) => {
  const response = await promise;
  assert.equal(response.status, 200, `${label}: ${response.status} ${JSON.stringify(response.data)}`);
  return response.data.data;
};
const canon = entries => entries.map(entry => ({ id: entry.id, date: entry.date, source: entry.source || "", text: entry.text || "", lines: entry.lines.map(line => [line.account, line.sub || "", line.party || "", line.debit, line.credit]) }));
const upTo = (entries, day) => entries.filter(entry => entry.date <= day);

// Programın kendi API'siyle: 2026'nın her ayına Kasa girişleri + bir cari (açılış, tahsilat) + 2027 başı.
async function seed(admin, count = 40) {
  const customer = await must("cari", admin.post("/api/workspace/accounts", { name: "Ece Tan", registeredOn: "2026-01-03" }));
  await must("açılış", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "700", date: "2026-01-03", note: "Açılış bakiyesi" }));
  for (let i = 1; i <= count; i += 1) await must(`kasa ${i}`, admin.post("/api/workspace/cash", { kind: "in", amount: String(10 + i), date: `2026-${String(1 + (i % 12)).padStart(2, "0")}-1${i % 9}`, description: `Giriş ${i}` }));
  await must("tahsilat", admin.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "150", date: "2026-11-20", method: "cash", note: "Tahsilat" }));
  await must("yeni yıl", admin.post("/api/workspace/cash", { kind: "in", amount: "25", date: "2027-01-04", description: "Yeni yıl" }));
  return customer;
}

describe("2.5.0 Ç3 tur 2 — dönem kilidi ucu: sıra (DÜŞÜK-1) ve arkada dondurma (İLERLEME)", () => {
  let server;
  let admin;
  const hook = { fn: null };
  const warns = [];
  const log = { info() {}, debug() {}, error: (...args) => warns.push(`error ${args.map(String).join(" ")}`), warn: (...args) => warns.push(args.map(String).join(" ")) };
  const S = () => server.app.ledger.snapshots;
  const pos = () => server.app.context.bankAccounts.pos;
  const runs = () => server.app.store.all("SELECT no, kind, state, through FROM ledger_snapshot_runs ORDER BY no").map(row => ({ ...row }));
  // Dondurma kancası: ilk parça yazılınca dondurma TUTULUR (süreye değil kapıya bağlı — ders 20: uç kilit izini beklerken süreli dondurma bitebiliyordu; zorla üretildi:
  // iz 3 sn → K6 ön koşulu düştü). Bırakılınca (ya da 20 sn güvenlik süresi dolunca — uç arka işi 5 sn bekler, iki istek sığar — uç dondurmayı beklerse, eski kod / mutant, test kilitlenmez) sürer. Parça boyu 5 satır.
  let releaseBatches = () => {};
  const holdBatches = () => {
    let release = null;
    const held = new Promise(resolve => {
      release = resolve;
    });
    const fallback = setTimeout(() => release(), 20000);
    releaseBatches = () => {
      clearTimeout(fallback);
      release();
    };
    hook.fn = async phase => {
      if (phase === "batch") await held;
    };
  };
  const untilWriting = async () => {
    for (let i = 0; i < 400 && !(S().status().running && S().status().phase === "yazım"); i += 1) await sleep(10);
    assert.ok(S().status().running && S().status().phase === "yazım", `ön koşul: dondurma yazım adımında sürüyor (${JSON.stringify(S().status())})`);
  };
  const unlockAll = async () => {
    releaseBatches();
    hook.fn = null;
    await waitForFreeze(admin);
    await must("kilidi kaldır", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
    await waitForFreeze(admin);
  };
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, __testFreezeHook: hook, freezeBatchLines: 5, log });
    admin = await loginAdmin(server);
    await seed(admin);
  });
  after(async () => {
    hook.fn = null;
    await server?.close();
  });

  it("K1: dondurma sürerken geçersiz ya da gelecek tarihli kilit isteği 400 alır; süren dondurma DURMAZ, POS ön adımı çalışmaz; sonunda kapsam = kilit, tek koşu", async () => {
    await unlockAll();
    const before = runs().length;
    let posCalls = 0;
    const original = pos().beforeLock;
    pos().beforeLock = (...args) => {
      posCalls += 1;
      return original(...args);
    };
    try {
      holdBatches();
      const first = admin.put("/api/admin/period-lock", { lockedUntil: LOCK });
      await untilWriting();
      const callsBefore = posCalls;
      const runNo = S().status().run;
      let lastDone = S().status().done;
      for (const [value, pattern] of [["2099-01-01", /Gelecekteki bir dönem kilitlenemez/], ["31.12.2026", /geçerli bir tarih/], ["abc", /geçerli bir tarih/]]) {
        const bad = await admin.put("/api/admin/period-lock", { lockedUntil: value });
        assert.equal(bad.status, 400, `${value}: ${bad.status} ${JSON.stringify(bad.data)}`);
        assert.match(bad.data.error, pattern);
        // Süren dondurma DURMADI ve BAŞTAN BAŞLAMADI (durdurulup yeniden açılsa yazılan satır sayısı sıfırlanırdı — boşa iş; kurtarma yolu bunu gizlerdi).
        const now = S().status();
        assert.ok(now.running && now.run === runNo && now.done >= lastDone, `${value} reddedildikten sonra dondurma sürüyor (reddedilen istek süren dondurmayı durdurdu: önce ${lastDone} satır, şimdi ${JSON.stringify(now)})`);
        lastDone = now.done;
      }
      assert.equal(posCalls, callsBefore, "reddedilen istek POS ön adımını çalıştırmadı");
      releaseBatches();
      hook.fn = null;
      assert.equal((await first).status, 200);
      const view = await waitForFreeze(admin);
      assert.equal(view.frozenThrough, LOCK, `kapsam = kilit: ${JSON.stringify(view)}`);
      assert.equal(view.freeze.pending, null);
      assert.equal(server.app.context.period.lockedUntil(), LOCK);
      const added = runs().slice(before);
      assert.deepEqual(added.map(run => `${run.kind}:${run.state}:${run.through}`), [`freeze:done:${LOCK}`], `tek koşu, bırakılan yok: ${JSON.stringify(added)}`);
      assert.deepEqual(canon(S().entries()), canon(upTo(server.app.ledger.build(), LOCK)), "donmuş = canlı");
    } finally {
      pos().beforeLock = original;
      releaseBatches();
      hook.fn = null;
    }
  });

  it("K2: ön adımı (POS, 409 bank-pending-before-lock) reddedilen istek de süren dondurmayı durdurmaz", async () => {
    await unlockAll();
    const original = pos().beforeLock;
    pos().beforeLock = (target, force) => {
      if (target === "2026-11-30" && !force) throw new HttpError(409, "Kilitlenecek döneme düşen 1 POS valör günü bankaya aktarılmadı (test).", { code: "bank-pending-before-lock", pending: [] });
      return original(target, force);
    };
    try {
      holdBatches();
      const first = admin.put("/api/admin/period-lock", { lockedUntil: LOCK });
      await untilWriting();
      const refused = await admin.put("/api/admin/period-lock", { lockedUntil: "2026-11-30" });
      assert.equal(refused.status, 409, JSON.stringify(refused.data));
      assert.equal(refused.data.code, "bank-pending-before-lock");
      assert.equal(S().status().running, true, `ön adımı reddedilen istekten sonra dondurma sürüyor: ${JSON.stringify(S().status())}`);
      releaseBatches();
      hook.fn = null;
      assert.equal((await first).status, 200);
      const view = await waitForFreeze(admin);
      assert.equal(view.frozenThrough, LOCK);
      assert.equal(server.app.context.period.lockedUntil(), LOCK, "kilit değişmedi");
    } finally {
      pos().beforeLock = original;
      releaseBatches();
      hook.fn = null;
    }
  });

  it("K3: süren dondurma durdurulduktan sonra kilit yazılamazsa (işlem düşer) önceki bekleyen koşu sahipsiz kalmaz — arkada sürer, kapsam = kilit", async () => {
    await unlockAll();
    const period = server.app.context.period;
    const original = period.setLock;
    const originalPos = pos().beforeLock;
    try {
      holdBatches();
      const first = admin.put("/api/admin/period-lock", { lockedUntil: LOCK });
      await untilWriting();
      // Tutulan dondurma, ikinci isteğin ön adımında (POS; durdurmadan hemen ÖNCE, aynı turda) bırakılır: durdurma süren dondurmaya denk gelir (ön koşul), dondurma arada bitemez.
      pos().beforeLock = (target, force) => {
        if (target === "2026-11-30") releaseBatches();
        return originalPos(target, force);
      };
      let thrown = 0;
      period.setLock = value => {
        if (value === "2026-11-30") {
          thrown += 1;
          throw new HttpError(409, "Kilit yazılamadı (test: işlem düştü).", { code: "test-lock-write" });
        }
        return original(value);
      };
      const refused = await admin.put("/api/admin/period-lock", { lockedUntil: "2026-11-30" });
      assert.equal(thrown, 1, "ön koşul: istek süren dondurmayı durdurduktan sonra kilit işleminde düştü");
      assert.equal(refused.status, 409, JSON.stringify(refused.data));
      hook.fn = null;
      assert.equal((await first).status, 200);
      const view = await waitForFreeze(admin, { timeoutMs: 20000 });
      assert.equal(period.lockedUntil(), LOCK, "kilit önceki gününde");
      assert.equal(view.frozenThrough, LOCK, `durdurulan koşu sahipsiz kaldı (kapsam ${view.frozenThrough || "boş"}, bekleyen ${JSON.stringify(view.freeze.pending)})`);
      assert.equal(view.freeze.pending, null);
      assert.deepEqual(canon(S().entries()), canon(upTo(server.app.ledger.build(), LOCK)));
    } finally {
      period.setLock = original;
      pos().beforeLock = originalPos;
      releaseBatches();
      hook.fn = null;
    }
  });

  it("K4: uç uzun dondurmayı BEKLEMEZ — en çok 5 sn sonra yanıt, kilit izi yanıttan önce; ilerleme GET ile; arada kilitli dönem canlı okunur (raporlar aynı), kilitli döneme 409, açık döneme 200; bitince durum temiz", async () => {
    await unlockAll();
    const reference = { journal: (await must("yevmiye", admin.get("/api/workspace/report-center/yevmiye?from=2026-01-01&to=2026-12-31"))).rows, trial: (await must("mizan", admin.get("/api/workspace/report-center/hesap-mizani?from=2026-01-01&to=2026-12-31"))).rows };
    let release = null;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    // Güvenlik: uç dondurmayı BEKLERSE (eski kod) bitiş kancası 20 sn sonra kendiliğinden bırakılır — test kilitlenmez, aşağıdaki denetim nedeniyle kırmızı olur.
    const fallback = setTimeout(() => release(), 20000);
    hook.fn = async phase => {
      if (phase === "before-done") await gate;
    };
    try {
      const started = Date.now();
      const put = await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      const answered = Date.now() - started;
      // Yanıt dondurma bitmeden geldi (bitiş kancada tutuluyor): uç beklemedi.
      assert.equal(put.lockedUntil, LOCK);
      assert.equal(put.frozenThrough, "", `uç dondurmayı bekledi (yanıtta kapsam ${put.frozenThrough}; ${answered} ms)`);
      assert.equal(put.freeze?.pending?.through, LOCK, `yanıtta bekleyen koşu: ${JSON.stringify(put.freeze)}`);
      assert.equal(put.freeze?.active, true, "yanıtta süren iş");
      // Kapının kilit izi YANITTAN ÖNCE (ayrı iş parçacığında, dondurmayı beklemeden): tam kapının iz karşılaştırması (ikinci katman) dondurma sürerken de çalışır (D8).
      assert.equal(server.app.context.integrity.lockPending(LOCK), false, "kilit izi yanıttan önce benimsendi (dondurma sürerken)");
      // İlerleme görünür: süren iş, aşama, yazılan satır.
      let view = null;
      for (let i = 0; i < 400; i += 1) {
        view = await must("kilit görünümü", admin.get("/api/workspace/ledger/lock"));
        if (view.freeze.done > 0 && view.freeze.phase === "yazım") break;
        await sleep(10);
      }
      assert.equal(view.lockedUntil, LOCK);
      assert.equal(view.freeze.active, true);
      assert.equal(view.freeze.running, true);
      assert.equal(view.freeze.pending.through, LOCK);
      assert.ok(view.freeze.done > 0, `yazılan satır sayısı görünür: ${JSON.stringify(view.freeze)}`);
      assert.equal(view.frozenThrough, "", "dondurma bitmedi");
      // Arada: kilitli yılın raporları (bekleyen koşunun kuralıyla canlı) kilitten önceki / sonraki ile aynı; yazımlar.
      assert.deepEqual((await must("yevmiye arada", admin.get("/api/workspace/report-center/yevmiye?from=2026-01-01&to=2026-12-31"))).rows, reference.journal, "kilitli yılın Yevmiye Defteri arada aynı");
      assert.deepEqual((await must("mizan arada", admin.get("/api/workspace/report-center/hesap-mizani?from=2026-01-01&to=2026-12-31"))).rows, reference.trial, "kilitli yılın Hesap Planı Mizanı arada aynı");
      const locked = await admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: "2026-12-30", description: "Kilitli" });
      assert.equal(locked.status, 409, JSON.stringify(locked.data));
      assert.equal(locked.data.code, "period-locked");
      await must("açık döneme", admin.post("/api/workspace/cash", { kind: "in", amount: "5", date: "2027-01-08", description: "Açık dönem (dondurma sürerken)" }));
    } finally {
      clearTimeout(fallback);
      release();
      hook.fn = null;
    }
    const done = await waitForFreeze(admin);
    assert.equal(done.frozenThrough, LOCK);
    assert.equal(done.freeze.pending, null);
    assert.equal(done.freeze.active, false);
    assert.equal(done.freeze.running, false);
    assert.equal(done.freeze.phase, "tamam");
    assert.deepEqual(canon(S().entries()), canon(upTo(server.app.ledger.build(), LOCK)), "donmuş = canlı");
    assert.deepEqual((await must("yevmiye sonra", admin.get("/api/workspace/report-center/yevmiye?from=2026-01-01&to=2026-12-31"))).rows, reference.journal, "kilitli yılın Yevmiye Defteri donduktan sonra aynı");
    assert.deepEqual((await must("mizan sonra", admin.get("/api/workspace/report-center/hesap-mizani?from=2026-01-01&to=2026-12-31"))).rows, reference.trial);
    // Kapının izi dondurmanın anlık görüntüsünden benimsendi (bekleyen iz kalmadı); Mutabakat Testi temiz.
    assert.equal(server.app.context.integrity.lockPending(LOCK), false, "kilit izi benimsendi");
    assert.equal((await must("tarama", admin.get("/api/workspace/ledger/integrity"))).ok, true);
  });

  it("K5: kilit geri çekilince uç hemen yanıt verir; bayat satırlar ve kapının izi arkada — iş bitince açılan dönemde donmuş satır yok, iz benimsenmiş; yeniden kilit donar", async () => {
    hook.fn = null;
    if (S().state().coverage !== LOCK) {
      await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      await waitForFreeze(admin);
    }
    const back = await must("geri çek", admin.put("/api/admin/period-lock", { lockedUntil: "2026-06-30" }));
    assert.equal(back.lockedUntil, "2026-06-30");
    assert.equal(back.frozenThrough, "2026-06-30", "kapsam geri çekmeyle aynı işlemde iner");
    assert.equal(back.freeze.pending, null, "geri çekmede bekleyen koşu yok");
    const view = await waitForFreeze(admin);
    assert.equal(view.freeze.active, false);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM ledger_snapshots WHERE date > '2026-06-30'").n, 0, "bayat satırlar silindi");
    assert.equal(server.app.context.integrity.lockPending("2026-06-30"), false, "geri çekilen kilidin izi arkada benimsendi");
    assert.deepEqual(canon(S().entries()), canon(upTo(server.app.ledger.build(), "2026-06-30")));
    await must("yeniden kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    await waitForFreeze(admin);
    assert.deepEqual(canon(S().entries()), canon(upTo(server.app.ledger.build(), LOCK)));
    // Büyük şirket benzetimi: geri çekmede iz bütçeden uzun → yanıt ~5 sn'de; dondurma yok ama arka iş (iz) sürüyor → ilerleme görünümü "süren iş" der (kart yoklamayı bırakmaz).
    let release = null;
    const held = new Promise(resolve => {
      release = resolve;
    });
    const fallback = setTimeout(() => release(), 20000);
    hook.fn = async phase => {
      if (phase === "trace") await held;
    };
    try {
      const slow = await must("geri çek (iz yavaş)", admin.put("/api/admin/period-lock", { lockedUntil: "2026-06-30" }));
      assert.equal(slow.freeze.pending, null);
      assert.equal(slow.freeze.running, false, "dondurma yok");
      assert.equal(slow.freeze.active, true, `yanıtta süren iş (kilit izi arkada): ${JSON.stringify(slow.freeze)}`);
      assert.equal((await must("kilit görünümü", admin.get("/api/workspace/ledger/lock"))).freeze.active, true, "GET de süren iş der");
    } finally {
      clearTimeout(fallback);
      release();
      hook.fn = null;
    }
    const after2 = await waitForFreeze(admin);
    assert.equal(after2.freeze.active, false);
    assert.equal(server.app.context.integrity.lockPending("2026-06-30"), false, "iz arkada geldi");
  });

  it("K6: aynı güne yinelenen istek süren dondurmayı durdurmaz (koşu kaldığı yerden sürer, yenisi açılmaz)", async () => {
    await unlockAll();
    const before = runs().length;
    try {
      holdBatches();
      const first = await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      await untilWriting();
      const runNo = S().status().run;
      const again = await must("aynı gün", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
      assert.equal(again.freeze.pending.no, first.freeze.pending.no, "aynı bekleyen koşu");
      const now = S().status();
      assert.ok(now.running && now.run === runNo && now.done > 0, `dondurma sürüyor, baştan başlamadı: ${JSON.stringify(now)}`);
    } finally {
      releaseBatches();
      hook.fn = null;
    }
    const view = await waitForFreeze(admin);
    assert.equal(view.frozenThrough, LOCK);
    assert.deepEqual(runs().slice(before).map(run => `${run.kind}:${run.state}`), ["freeze:done"]);
  });

  it("K7: kapanış (app.close) dondurma arkada sürerken süren işi bitirir — kapalı bağlantıya çarpan iş / uyarı yok; yeniden açılışta bekleyen koşu sürer, kapsam = kilit", async () => {
    await unlockAll();
    const dirs = { dataDir: server.dataDir, backupDir: server.backupDir };
    let release = null;
    const held = new Promise(resolve => {
      release = resolve;
    });
    const fallback = setTimeout(() => release(), 20000); // uç beklerse (eski kod) kilitlenme yok
    // İz de tutulur (büyük şirket: iz bütçeden uzun): kapanış başladığında iz işi hâlâ sürüyor — kapanış onu beklemeli, iz kapalı bağlantıya çarpmamalı (mutant 205).
    hook.fn = async phase => {
      if (phase === "before-done" || phase === "trace") await held;
    };
    const put = await must("kilit", admin.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    clearTimeout(fallback);
    assert.equal(put.freeze.active, true, "ön koşul: dondurma arkada sürüyor");
    assert.equal(server.app.context.integrity.lockPending(LOCK), true, "ön koşul: kilit izi de arkada sürüyor");
    for (let i = 0; i < 400 && !S().status().running; i += 1) await sleep(10);
    warns.length = 0;
    const closed = server;
    server = null; // after() bu sunucuyu yeniden kapatmaz; klasörü aşağıda silinir
    const closing = closed.app.close();
    await sleep(50);
    release();
    await closing;
    // Kapanıştan sonra arka iş sürseydi kilit izini iş parçacığında ölçüp kapalı bağlantıya çarpardı ("database is not open" uyarısı): bir süre beklenir.
    await sleep(1500);
    assert.deepEqual(warns.filter(text => /tamamlanamadı|not open|kapalı|closed/i.test(text)), [], "kapanıştan sonra arka iş kapalı bağlantıya çarpmadı");
    hook.fn = null;
    // Yeniden aç (aynı dosya): bekleyen koşu açılışta sürer.
    const reopened = await startTestServer({ now: { time: NOW, fixed: true }, ...dirs, log });
    try {
      await reopened.app.ledger.snapshots.runPending();
      assert.equal(reopened.app.ledger.snapshots.state().coverage, LOCK, "yeniden açılışta kapsam = kilit");
      assert.equal(reopened.app.ledger.snapshots.state().pending, null);
      assert.deepEqual(canon(reopened.app.ledger.snapshots.entries()), canon(upTo(reopened.app.ledger.build(), LOCK)));
    } finally {
      await reopened.close();
      removeTestDir(closed.root);
    }
  });
});

// K8 — dondurma sürerken kilitli dönemdeki banka fişinin Ters Kaydet'i (bugün tarihli ayna fiş; test/banka-210-ters-kayit) kilitten HEMEN sonra 200 alır; kilitli tarihe Düzelt
// 409. Uç dondurmayı beklemediği için aynı kullanıcı bu pencerede çalışır; düzeltmenin yolu açık kalmalı (gerileme koruması). Kilit izi değişmez; dondurma sonra tamamlanır.
// (Yeniden üretildi: iz "bekliyor"ken de 200 — bugün tarihli düzeltme kapsam süzgecinin kilit sınıfında değil.)
// K9 — büyük şirket benzetimi: iz bütçeden (5 sn) uzun sürerse uç bütçe dolunca yanıt verir (sınırsız beklemez: 1.000.000'da iz ~29 sn); iz arkada gelir (BİLİNEN SINIR penceresi).
describe("2.5.0 Ç3 tur 2 — dondurma sürerken kilitli fişin Ters Kaydet'i", () => {
  let ctx;
  const hook = { fn: null };
  before(async () => {
    const { bootBank } = await import("./banka-210-fis-ortak.mjs");
    ctx = await bootBank({ __testFreezeHook: hook, freezeBatchLines: 5 });
  });
  after(async () => {
    hook.fn = null;
    await ctx?.server.close();
  });

  it("K8: kilitten hemen sonra (dondurma ve iz bekliyor) kilitli fişin Ters Kaydet'i 200, ters fiş bugün tarihli, kilit izi aynı; Düzelt'te kilitli tarih 409; dondurma sonra tamamlanır, Mutabakat Testi temiz", async () => {
    const { BANK, openBankSet, voucher } = await import("./banka-210-fis-ortak.mjs");
    const { lockDigestOf } = await import("../server/lib/integrity.mjs");
    const set = await openBankSet(ctx.api);
    const old = await voucher(ctx.api, { type: "other_out", accountId: set.ziraat.id, date: "2026-10-02", amount: "40" });
    const old2 = await voucher(ctx.api, { type: "other_out", accountId: set.ziraat.id, date: "2026-10-02", amount: "41" });
    let release = null;
    const held = new Promise(resolve => {
      release = resolve;
    });
    const fallback = setTimeout(() => release(), 20000); // uç beklerse (eski kod) kilitlenme yok
    hook.fn = async phase => {
      if (phase === "before-done") await held;
    };
    try {
      const put = await ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-03" });
      assert.equal(put.status, 200, JSON.stringify(put.data));
      const digest = lockDigestOf(ctx.store, "2026-10-03");
      assert.equal(put.data.freeze?.active, true, "ön koşul: dondurma arkada sürüyor");
      const reversed = await ctx.api.post(`${BANK}/events/${old.id}/reverse`, {});
      assert.equal(reversed.status, 200, `kilitli fişin Ters Kaydet'i kilitten hemen sonra: ${reversed.status} ${JSON.stringify(reversed.data).slice(0, 300)}`);
      assert.equal(reversed.data.reversal.date, "2026-10-08", "ters fiş bugün tarihli");
      assert.equal(lockDigestOf(ctx.store, "2026-10-03"), digest, "kilit izi aynı");
      const moved = await ctx.api.post(`${BANK}/events/${old2.id}/correct`, { amount: "42", date: "2026-10-02" });
      assert.equal(moved.status, 409, JSON.stringify(moved.data).slice(0, 300));
      assert.equal(moved.data.code, "period-locked", "kilitli tarihe düzeltme 409 period-locked");
    } finally {
      clearTimeout(fallback);
      release();
      hook.fn = null;
    }
    const view = await waitForFreeze(ctx.api.client);
    assert.equal(view.frozenThrough, "2026-10-03");
    assert.equal(view.freeze.pending, null);
    assert.equal(ctx.app.context.integrity.lockPending("2026-10-03"), false, "kilit izi geldi");
    assert.equal((await ctx.api.get("/api/workspace/ledger/integrity")).data.ok, true, "Mutabakat Testi temiz");
  });

  it("K9 (büyük şirket benzetimi): iz bütçeden (5 sn) uzun sürerse uç bütçe dolunca yanıt verir — sınırsız beklemez; iz ve dondurma arkada gelir", async () => {
    await ctx.api.put("/api/admin/period-lock", { lockedUntil: "" });
    await waitForFreeze(ctx.api.client);
    let release = null;
    const held = new Promise(resolve => {
      release = resolve;
    });
    const fallback = setTimeout(() => release(), 20000);
    // İz de dondurma da (dondurmanın kendi izi) tutulur: büyük şirkette ikisi de bütçeden uzun.
    hook.fn = async phase => {
      if (phase === "trace" || phase === "before-done") await held;
    };
    try {
      const started = Date.now();
      const put = await ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-03" });
      const answered = Date.now() - started;
      assert.equal(put.status, 200, JSON.stringify(put.data));
      assert.ok(answered >= 4500 && answered < 9000, `iz bütçesi dolunca yanıt (~5 sn; ${answered} ms)`);
      assert.equal(ctx.app.context.integrity.lockPending("2026-10-03"), true, "yanıtta iz henüz gelmedi (arkada)");
      assert.equal(put.data.freeze?.active, true, "dondurma arkada sürüyor");
    } finally {
      clearTimeout(fallback);
      release();
      hook.fn = null;
    }
    const view = await waitForFreeze(ctx.api.client);
    assert.equal(view.frozenThrough, "2026-10-03");
    assert.equal(ctx.app.context.integrity.lockPending("2026-10-03"), false, "iz arkada geldi");
  });
});
