// 2.1.0 — Aşama 2, bağımsız gözden geçirme B7: 15 dakikalık tam tarama sunucuyu kilitlemez (docs/2.1.0-KANIT.md "Aşama 2 — Bağımsız
// Gözden Geçirme").
//
// Kök neden: tarama (integrity.scan → run) ana iş parçacığında koşuyordu; 100.000 para satırında ~9 sn, 1.000.000'da ~139 sn boyunca hiçbir
// istek yanıtlanmıyordu (ölçüm: tarama sırasında ayrı süreçten istek 9.057 ms bekledi). Tarama boşta da koşuyordu.
// Düzeltme: zamanlayıcı taraması ayrı iş parçacığında (lib/integrity-scan-worker.mjs), salt okunur ayrı bağlantıyla ve tek okuma işleminde
// (WAL anlık görüntüsü) koşar; sonuç (günlük, zil) ana iş parçacığında işlenir. Veri, gün ve dönem kilidi değişmediyse atlanır.
// Ölçüm (n-100000 kopyası): tarama 9,5 sn sürerken ayrı süreçten isteklerin en uzunu 104 ms (önce 9.307 ms).
//
// ÇALIŞIYOR MU: arka plan taraması satır içi taramayla AYNI sonucu verir (gerçek 2.0.26 verisi, her denetim); tam çalışma ana iş parçacığında
// koşmaz; değişiklik yoksa atlanır, yazım ya da gün değişince yeniden koşar.
// NASIL BOZARIM: kapının görmediği (store dışı) bozuk satır → arka plan taraması bulur, günlüğe 'scan' yazılır; tarama sürerken yazım →
// yazımlar geçer, tarama tutarlı bir anı okur (yanlış sapma yok); iş parçacığı açılamazsa (veri dosyası yok) sunucu çalışmayı sürdürür.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boot, must, rawRun } from "./banka-210-ortak.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const signatureOf = result => JSON.stringify(result.checks.map(item => [item.code, item.ok, item.count ?? null, item.gateCount ?? null, item.difference ?? null]));
// 2.5.0 Ç5-A tur 1c: dondurmayı bekleyen her adım SINIRLI — süre dolunca nedeni (dondurmanın durumu) yazılarak KIRMIZI; asılı test CI'yi tutmaz.
const FREEZE_WAIT_MS = 60_000;
const within = (promise, label, state = () => null) => {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} ${FREEZE_WAIT_MS / 1000} sn'de olmadı — dondurma: ${JSON.stringify(state())}`)), FREEZE_WAIT_MS);
    timer.unref?.();
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
};

describe("B7 — arka plan taraması", () => {
  it("gerçek 2.0.26 verisi: arka plan sonucu = satır içi sonuç; tam çalışma ana iş parçacığında koşmaz", { timeout: 180_000 }, async () => {
    const name = "surum-2.0.26-zincir";
    const fixture = unpackFixture(name);
    let server = null;
    try {
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: `${readFixture(name).oncesi.today}T12:00:00+03:00`, integrityScan: false });
      const integrity = server.app.integrity;
      // 2.5.0 Ç5-A tur 1c (ders 6, 20, 38; kök neden docs/erp/C5-ACILIS-TASARIM.md §13): 2.0.26 verisi kilitli → açılışta göç 47'nin bekleyen 2.4.9 dondurması arkada
      // koşar (app.mjs setImmediate). Sürerken "Kural Değişikliği Farkı" denetimi listede yoktur (karşılaştırılacak donmuş dönem henüz yok — C3 §8 kapsam); bitince Ç5-A'nın
      // kural farkı (2.4.9 ↔ 2.5.0-defter) görünür. İki taramanın bu anın iki yanına düşmesi sahte fark doğuruyordu (zorla: test/b7-dondurma-yaris-zorla.mjs). Ön koşul
      // ÜRÜNÜN DURUMUNDAN kurulur: bekleyen koşu bitene kadar beklenir (ürünün kendi runPending'i: süren işi bekler, kalan koşuyu dondurur), sonra koşu kalmadığı denetlenir.
      // İddialar (iki yol aynı sonuç; tam çalışma ana iş parçacığında koşmaz) aynen.
      await within(server.app.ledger.snapshots.runPending(), "açılıştaki bekleyen dondurmanın bitmesi", () => ({ ...server.app.ledger.snapshots.state(), freeze: server.app.ledger.snapshots.status() }));
      const frozen = server.app.ledger.snapshots.state();
      assert.equal(frozen.pending, null, `açılıştaki bekleyen dondurma bitmeli: ${JSON.stringify(frozen)}`);
      assert.equal(frozen.coverage, frozen.lock, `kilitli dönem donmuş olmalı: ${JSON.stringify(frozen)}`);
      const before = integrity.stats().run;
      const background = await integrity.scanInBackground();
      assert.ok(background.result, JSON.stringify(background));
      assert.equal(integrity.lastScan.via, "worker");
      assert.equal(integrity.stats().run, before, "tam çalışma (run) ana iş parçacığında koşmamalı");
      const inline = integrity.scan();
      assert.equal(signatureOf(background.result), signatureOf(inline.result), "iki yol aynı sonucu vermeli");
    } finally {
      await server?.close().catch(() => {});
      fixture.cleanup();
    }
  });

  it("gerçek 2.0.26 verisi, açılıştaki bekleyen dondurma: sürerken iki yol aynı (kural farkı henüz yok); bitince arka plan taraması ATLANMADAN yeniden koşar ve kural farkını görür", { timeout: 180_000 }, async () => {
    // 2.5.0 Ç5-A tur 1c (docs/erp/C5-ACILIS-TASARIM.md §13): ön koşullar ürünün YALNIZ TEST kancasıyla (__testFreezeHook "before-done": dondurma son adımında tutulur) —
    // uyku / süre yok (ders 20). Sürerken: kapsam boş → "Kural Değişikliği Farkı" denetimi yok (C3 §8); bitince: donmuş 2.4.9 ↔ güncel 2.5.0-defter farkı görünür.
    const name = "surum-2.0.26-zincir";
    const fixture = unpackFixture(name);
    let server = null;
    let release = () => {};
    const opened = new Promise(resolve => {
      release = resolve;
    });
    let reached = () => {};
    const atGate = new Promise(resolve => {
      reached = resolve;
    });
    const hook = {
      async fn(phase) {
        if (phase !== "before-done") return;
        reached();
        await opened;
      },
    };
    const codes = result => result.checks.map(item => item.code);
    try {
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: `${readFixture(name).oncesi.today}T12:00:00+03:00`, integrityScan: false, __testFreezeHook: hook });
      const { integrity } = server.app;
      const snapshots = server.app.ledger.snapshots;
      await within(atGate, "dondurmanın son adıma (before-done) gelmesi", () => ({ ...snapshots.state(), freeze: snapshots.status() }));
      assert.ok(snapshots.state().pending, "ön koşul: açılışın bekleyen dondurması sürüyor");
      const during = await integrity.scanInBackground();
      assert.ok(during.result, JSON.stringify(during));
      assert.equal(integrity.lastScan.via, "worker");
      const duringInline = integrity.scan();
      assert.ok(snapshots.state().pending, "ön koşul iki tarama boyunca sürdü");
      assert.equal(signatureOf(during.result), signatureOf(duringInline.result), "dondurma sürerken iki yol aynı sonucu vermeli");
      assert.ok(!codes(during.result).includes("ledger:rule-diff"), "donmuş dönem yokken kural farkı denetimi listede yok (C3 §8 kapsam)");
      release();
      await within(snapshots.runPending(), "bırakılan dondurmanın bitmesi", () => ({ ...snapshots.state(), freeze: snapshots.status() }));
      assert.equal(snapshots.state().pending, null, "dondurma bitti");
      const after = await integrity.scanInBackground();
      assert.ok(after.result, `dondurmadan sonra arka plan taraması atlanmamalı: ${JSON.stringify(after)}`);
      const afterInline = integrity.scan();
      assert.equal(signatureOf(after.result), signatureOf(afterInline.result), "dondurmadan sonra iki yol aynı sonucu vermeli");
      const ruleDiff = after.result.checks.find(item => item.code === "ledger:rule-diff");
      assert.ok(ruleDiff && ruleDiff.ok === false && ruleDiff.count > 0, `Ç5-A'nın kural farkı görünmeli: ${JSON.stringify(ruleDiff)}`);
      assert.equal(after.result.checks.length, during.result.checks.length + 1, "fark yalnız Kural Değişikliği Farkı satırı");
    } finally {
      release();
      await server?.close().catch(() => {});
      fixture.cleanup();
    }
  });

  it("değişiklik yoksa atlanır; yazım ya da gün değişince yeniden koşar; tarama veri yazmaz", async () => {
    const ctx = await boot({ now: NOW, gateVerify: false, moneyStrict: false, integrityScan: false });
    try {
      const { api, app, store } = ctx;
      await must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: TODAY, description: "x" }));
      const first = await app.integrity.scanInBackground();
      assert.equal(first.result?.ok, true, JSON.stringify(first));
      const counters = store.changeCounters();
      assert.deepEqual(await app.integrity.scanInBackground(), { skipped: "unchanged" });
      assert.deepEqual(store.changeCounters(), counters, "tarama veri yazmaz");
      await must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "5", date: TODAY, description: "y" }));
      assert.ok((await app.integrity.scanInBackground()).result, "yazımdan sonra yeniden koşar");
      ctx.server.clock.advance({ days: 1 });
      assert.ok((await app.integrity.scanInBackground()).result, "gün değişince yeniden koşar (ileri tarih denetimleri güne bağlı)");
      assert.equal(app.integrity.scanStats.skipped, 1);
    } finally {
      await ctx.server.close();
    }
  });

  it("nasıl bozarım: store dışı bozuk satırı bulur; tarama sürerken yazımlar geçer ve yanlış sapma çıkmaz; iş parçacığı açılamazsa sunucu sürer", async () => {
    const ctx = await boot({ now: NOW, gateVerify: false, moneyStrict: false, integrityScan: false });
    try {
      const { api, app, db } = ctx;
      // Tarama sürerken yazımlar (WAL: okuyucu yazanı bekletmez; tarama tek anı okur).
      const scanning = app.integrity.scanInBackground();
      for (let i = 0; i < 5; i += 1) await must("eşzamanlı Kasa", api.post("/api/workspace/cash", { kind: "in", amount: String(10 + i), date: TODAY, description: `eş ${i}` }));
      const during = await scanning;
      assert.equal(during.result?.ok, true, `yanlış sapma olmamalı: ${JSON.stringify(during.result?.failures)}`);
      // Kapının görmediği bozuk satır (aynı bağlantı, store dışı): arka plan taraması bulur ve günlüğe yazar.
      rawRun(db, "INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('disari-kurus', 'in', 1.005, ?, 'elle', 'cash', 'x', ?)", TODAY, `${TODAY}T09:00:00.000Z`);
      const found = await app.integrity.scanInBackground();
      assert.ok(found.findings?.some(item => item.code === "cents:cash_entries"), JSON.stringify(found.findings));
      assert.ok(app.integrity.recent(5).some(row => row.action === "scan"), "tarama günlüğü");
      rawRun(db, "DELETE FROM cash_entries WHERE id = 'disari-kurus'");
    } finally {
      await ctx.server.close();
    }
  });

  it("iş parçacığı açılamazsa (veri dosyası yok) tarama 'çalışmadı' olur, sunucu ve sonraki tarama etkilenmez", async () => {
    const { createIntegrity } = await import("../server/lib/integrity.mjs");
    const ctx = await boot({ now: NOW, gateVerify: false, moneyStrict: false, integrityScan: false });
    try {
      const { app } = ctx;
      const broken = createIntegrity({ store: app.store, ledger: () => app.context.ledger, accounts: () => app.context.accounts, stock: () => app.context.stock, plans: () => app.context.plans, period: () => app.context.period, money: () => app.context.money, dbPath: "/yok/destekofis.sqlite", now: app.config.now });
      const outcome = await broken.scanInBackground();
      assert.ok(outcome.failed, JSON.stringify(outcome));
      assert.equal(broken.scanStats.failed, 1);
      assert.ok((await app.integrity.scanInBackground()).result, "asıl tarama çalışır");
    } finally {
      await ctx.server.close();
    }
  });
});
