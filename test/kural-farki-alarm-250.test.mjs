// 2.5.0 Ç5-A tur 1d — İş A: "Kural Değişikliği Farkı" (ledger:rule-diff) YANLIŞ ALARM DEĞİLDİR (docs/erp/C5-ACILIS-TASARIM.md §14).
// KARAR (BAŞ MİMAR 12.11.2026, AYNEN): "BULGU DÜZELTİLİR — kilitli dönemi olan her müşteri güncellemeyi kurduğunda ilk taramada 'yeni sapma' görmesi yanlış alarmdır; Ç3 tasarım
// notunun beklentisi kural farkının UYARI olarak görünmesi, sapma sayılmamasıdır: … uyarının kendisi (Mutabakat Testi'ndeki satır, Kural Değişikliği Farkı raporu) AYNEN kalır;
// günlüğe 'sapma' satırı ve zil YAZILMAZ. Gerçek yeni sapmalar (kural farkı dışı) bu düzeltmeden etkilenmemeli — testle."
// Önceden (c5a1d-taban): kilitli eski sürüm verisi açılınca açılışın bekleyen dondurması arkada biter; ilk tarama kural farkını "kapının görmediği yeni sapma" sayıp Mutabakat
// Günlüğü'ne yazıyor, zil çalıyor, sunucu günlüğüne hata yazıyordu; yeniden açılışta taban satırına "sapma" olarak giriyordu.
// NASIL BOZULUR (§14.4; testler buradan): dondurmadan sonraki ilk tarama (arka plan / satır içi ayrı ayrı) yanlış alarm verir; yeniden açılışta tabana sapma diye girer; düzeltme
// fazla geniş olur (gerçek sapma da susar — [2]); kilitli dönemin kapı dışı değişikliği susar ([3] kaynak değişimi); kilitsiz veri gerilemesi ([4]).
// Veri: programın kendi ürettiği eski sürüm fikstürleri (surum-2.0.26-zincir kilitli, surum-2.4.9-s127-kilitsiz kilitsiz). Dondurmanın bitişi ÜRÜNÜN DURUMUNDAN beklenir
// (runPending; SINIRLI bekleme, uyku yok — ders 20). Sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30). Kapı dışı yazım ayrı bağlantıyla (DatabaseSync).
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const LOCKED = "surum-2.0.26-zincir";
const UNLOCKED = "surum-2.4.9-s127-kilitsiz";
const RULE_DIFF = "ledger:rule-diff";
const WAIT_MS = 60_000;
const todayOf = name => readFixture(name).oncesi?.today || String(readFixture(name).now || "").slice(0, 10);

const within = (promise, label, state = () => null) => {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} ${WAIT_MS / 1000} sn'de olmadı — durum: ${JSON.stringify(state())}`)), WAIT_MS);
    timer.unref?.();
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
};

/** Açılış + gözlemci: Mutabakat Günlüğü (bütün satırlar), zil (integrity.alert), sunucu günlüğünün Mutabakat satırları — her adımda YALNIZ yeniler. */
async function open(fixture, name) {
  const lines = [];
  const log = { debug() {}, info() {}, warn: (...a) => lines.push(`warn: ${a.join(" ")}`), error: (...a) => lines.push(`error: ${a.join(" ")}`) };
  const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${todayOf(name)}T12:00:00+03:00`, fixed: true }, integrityScan: false, log });
  const alerts = [];
  server.app.events.tap((event, payload) => {
    if (event === "integrity.alert") alerts.push(payload.findings.map(item => item.code));
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
  const snapshots = app.ledger.snapshots;
  await within(snapshots.runPending(), "açılıştaki bekleyen dondurmanın bitmesi", () => ({ ...snapshots.state(), freeze: snapshots.status() }));
  const state = snapshots.state();
  assert.equal(state.pending, null, `dondurma bitmeli: ${JSON.stringify(state)}`);
  assert.ok(state.coverage && state.coverage === state.lock, `kilitli dönem donmuş olmalı: ${JSON.stringify(state)}`);
  return state;
};
const ruleDiffOf = result => (result?.checks || []).find(item => item.code === RULE_DIFF) || null;
const codesOf = list => (list || []).map(item => item.code);
const QUIET = { gunluk: 0, zil: [], sunucu: [] };
/** Uyarı kaldı: denetim listesinde kural farkı satırı (ok false, madde sayısı, fark tutarı). */
const assertWarning = (result, label) => {
  const item = ruleDiffOf(result);
  assert.ok(item && item.ok === false && item.count > 0 && item.difference > 0 && item.severity === "warning", `${label}: Mutabakat Testi'nde Kural Değişikliği Farkı satırı (uyarı) kalmalı: ${JSON.stringify(item)}`);
  assert.ok(codesOf(result.failures).includes(RULE_DIFF), `${label}: kural farkı sonucun failures'ında (uyarı) kalmalı`);
  return item;
};
/** Kapı dışı (store dışı, ayrı bağlantı) gerçek sapma: açık dönemde kuruşu bozuk Kasa satırı. */
function injectRealDrift(app, day) {
  const other = new DatabaseSync(app.store.get("PRAGMA database_list").file);
  try {
    other.exec("PRAGMA busy_timeout = 5000");
    other.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('kural-farki-gercek', 'in', 1.005, ?, 'elle', 'cash', 'x', ?)").run(day, `${day}T09:00:00.000Z`);
  } finally {
    other.close();
  }
}
/** Kapı dışı: kilitli dönemin kaynak satırı değişir (kural farkının tutarını da kaydırabilir; kendi denetimleri bulmalı — §14.4 7 (i)). */
function changeLockedSource(app, lock) {
  const other = new DatabaseSync(app.store.get("PRAGMA database_list").file);
  try {
    other.exec("PRAGMA busy_timeout = 5000");
    const row = other.prepare("SELECT id FROM cash_entries WHERE date <= ? ORDER BY date, id LIMIT 1").get(lock);
    assert.ok(row, "ön koşul: kilitli dönemde Kasa satırı var");
    other.prepare("UPDATE cash_entries SET description = description || ' (dış düzenleme)', amount = amount + 1 WHERE id = ?").run(row.id);
    return row.id;
  } finally {
    other.close();
  }
}

describe("Ç5-A tur 1d — Kural Değişikliği Farkı uyarıdır, yeni sapma değildir", () => {
  it("[1] kilitli eski veri: dondurmadan sonraki İLK ARKA PLAN taraması sessiz (günlük / zil / sunucu yok), uyarı satırı var; ardından satır içi de sessiz", { timeout: 240_000 }, async () => {
    const fixture = unpackFixture(LOCKED);
    let ctx = null;
    try {
      ctx = await open(fixture, LOCKED);
      assert.ok(ctx.app.ledger.snapshots.state().pending, "ön koşul: açılışta bekleyen dondurma var (taban dondurmadan önce alındı)");
      assert.ok(!ctx.opened.rows.some(row => /Kural Değişikliği/.test(row.summary)), "ön koşul: açılış tabanında kural farkı yok");
      await freezeDone(ctx.app);
      const first = await ctx.app.integrity.scanInBackground();
      assert.ok(first.result, `ilk arka plan taraması koşmalı: ${JSON.stringify(first).slice(0, 300)}`);
      assert.equal(ctx.app.integrity.lastScan.via, "worker");
      assert.ok(!codesOf(first.findings).includes(RULE_DIFF), `kural farkı yeni sapma sayılmamalı: ${JSON.stringify(codesOf(first.findings))}`);
      assert.deepEqual(first.findings, [], "dondurmadan sonraki ilk taramada bulgu yok");
      assert.deepEqual(ctx.fresh(), QUIET, "ilk arka plan taraması: Mutabakat Günlüğü satırı, zil ve 'kapının görmediği yeni sapma' YOK");
      assertWarning(first.result, "ilk arka plan taraması");
      const inline = ctx.app.integrity.scan();
      assert.deepEqual(inline.findings, []);
      assert.deepEqual(ctx.fresh(), QUIET, "ardından satır içi tarama da sessiz");
      assertWarning(inline.result, "ardından satır içi tarama");
    } finally {
      await ctx?.server.close().catch(() => {});
      fixture.cleanup();
    }
  });

  it("[3] dondurmadan sonra yeniden açılış: taban satırı / sunucu 'kalan sapma' iletisi kural farkını taşımaz, ilk taramalar sessiz; kapı dışı kilitli kaynak değişimi yine bulunur", { timeout: 240_000 }, async () => {
    const fixture = unpackFixture(LOCKED);
    let ctx = null;
    try {
      ctx = await open(fixture, LOCKED);
      assert.ok(ctx.app.ledger.snapshots.state().pending, "ön koşul: ilk açılışta bekleyen dondurma var");
      const state = await freezeDone(ctx.app);
      await ctx.server.close();
      ctx = null;
      // Yeniden açılış (dondurma artık bitmiş; kural farkı açılışın tam taramasında görünür) — taban satırına / sunucu "kalan sapma" iletisine GİRMEZ.
      ctx = await open(fixture, LOCKED);
      assert.equal(ctx.app.ledger.snapshots.state().pending, null, "ön koşul: yeniden açılışta bekleyen dondurma yok");
      assert.ok(!ctx.opened.rows.some(row => /Kural Değişikliği/.test(row.summary)), `yeniden açılışın taban satırında kural farkı olmamalı: ${JSON.stringify(ctx.opened.rows.map(row => row.summary))}`);
      assert.ok(!ctx.opened.lines.some(line => /Kural Değişikliği/.test(line)), `sunucu 'kalan sapma' iletisinde kural farkı olmamalı: ${JSON.stringify(ctx.opened.lines)}`);
      const again = await ctx.app.integrity.scanInBackground();
      assert.ok(again.result, JSON.stringify(again).slice(0, 300));
      assert.deepEqual(again.findings, [], "yeniden açılıştan sonraki ilk arka plan taraması sessiz");
      assert.deepEqual(ctx.fresh(), QUIET);
      assertWarning(again.result, "yeniden açılıştan sonra");
      const againInline = ctx.app.integrity.scan();
      assert.deepEqual(againInline.findings, []);
      assert.deepEqual(ctx.fresh(), QUIET);
      // §14.4 7 (i): kilitli dönemin kaynağı kapı dışından değişir → kendi denetimleri (period-lock / ledger:snapshot) yeni sapma olarak bulur, günlük + zil.
      const changed = changeLockedSource(ctx.app, state.lock);
      const outside = await ctx.app.integrity.scanInBackground();
      const found = codesOf(outside.findings);
      // İki kendi denetimi de (kapının kilit izi ve donmuş defterin kaynak izi — uyarı düzeyli) yeni sapma olarak bulunur: düzeltme yalnız kural farkını dışarıda bırakır.
      assert.ok(found.includes("period-lock") && found.includes("ledger:snapshot"), `kilitli kaynağın kapı dışı değişimi (${changed}) bulunmalı (period-lock + ledger:snapshot): ${JSON.stringify(found)}`);
      assert.ok(!found.includes(RULE_DIFF), "kural farkı yine bulgu değil");
      const seen = ctx.fresh();
      assert.equal(seen.gunluk, 1, "kapı dışı değişim günlüğe yazılır");
      assert.equal(seen.zil.length, 1, "kapı dışı değişim zile düşer");
      assert.ok(seen.sunucu.some(line => /kapının görmediği/.test(line)), JSON.stringify(seen.sunucu));
    } finally {
      await ctx?.server.close().catch(() => {});
      fixture.cleanup();
    }
  });

  it("[1] kilitli eski veri: dondurmadan sonraki İLK tarama SATIR İÇİ yoldan (Mutabakat Testi ucu) sessiz, uyarı satırı yanıtta", { timeout: 240_000 }, async () => {
    const fixture = unpackFixture(LOCKED);
    let ctx = null;
    try {
      ctx = await open(fixture, LOCKED);
      assert.ok(ctx.app.ledger.snapshots.state().pending, "ön koşul: açılışta bekleyen dondurma var");
      await freezeDone(ctx.app);
      const api = await ctx.server.login();
      const res = await api.get("/api/workspace/ledger/integrity");
      assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
      assert.equal(ctx.app.integrity.lastScan.via, "inline", "ilk tarama satır içi yoldan");
      assert.deepEqual(ctx.app.integrity.lastScan.findings, [], "satır içi ilk taramada bulgu yok");
      assert.deepEqual(ctx.fresh(), QUIET, "Mutabakat Testi: günlük satırı, zil, sunucu 'yeni sapma' YOK");
      const item = assertWarning(res.data, "Mutabakat Testi yanıtı");
      assert.ok(/Kural Değişikliği Farkı \(Kilitli Dönem: .* ve Öncesi\)/.test(item.name), item.name);
      assert.ok(!(res.data.log || []).some(row => /Kural Değişikliği/.test(JSON.stringify(row))), "yanıttaki Mutabakat Günlüğü'nde kural farkı satırı yok");
      const back = await ctx.app.integrity.scanInBackground();
      assert.deepEqual(back.findings || [], []);
      assert.deepEqual(ctx.fresh(), QUIET);
    } finally {
      await ctx?.server.close().catch(() => {});
      fixture.cleanup();
    }
  });

  it("[2] GERÇEK yeni sapma (kural farkı dışı) dondurmadan SONRA, kural farkıyla AYNI taramada: bulunur, günlüğe yazılır, zil + sunucu iletisi; kural farkı bulgu değil", { timeout: 240_000 }, async () => {
    const fixture = unpackFixture(LOCKED);
    let ctx = null;
    try {
      ctx = await open(fixture, LOCKED);
      assert.ok(ctx.app.ledger.snapshots.state().pending, "ön koşul: açılışta bekleyen dondurma var");
      await freezeDone(ctx.app);
      injectRealDrift(ctx.app, todayOf(LOCKED));
      const scan = await ctx.app.integrity.scanInBackground();
      assert.ok(scan.result, JSON.stringify(scan).slice(0, 300));
      assertWarning(scan.result, "aynı tarama");
      const found = codesOf(scan.findings);
      assert.ok(found.includes("cents:cash_entries"), `gerçek sapma yeni sapma olarak bulunmalı: ${JSON.stringify(found)}`);
      assert.ok(!found.includes(RULE_DIFF), `kural farkı bulgu değil: ${JSON.stringify(found)}`);
      const seen = ctx.fresh();
      assert.equal(seen.gunluk, 1, "gerçek sapma Mutabakat Günlüğü'ne yazılır");
      assert.equal(seen.zil.length, 1, "gerçek sapma zile düşer");
      assert.ok(seen.zil[0].includes("cents:cash_entries") && !seen.zil[0].includes(RULE_DIFF), JSON.stringify(seen.zil));
      assert.ok(seen.sunucu.some(line => /kapının görmediği \d+ yeni sapma/.test(line) && /Kuruş/.test(line) && !/Kural Değişikliği/.test(line)), JSON.stringify(seen.sunucu));
      const summary = ctx.app.store.get("SELECT summary FROM integrity_log WHERE action = 'scan' AND summary LIKE '%Kuruş%'");
      assert.ok(summary && !/Kural Değişikliği/.test(summary.summary), JSON.stringify(summary));
    } finally {
      await ctx?.server.close().catch(() => {});
      fixture.cleanup();
    }
  });

  it("[4] kilitsiz veri: kural farkı denetimi yok, ilk tarama sessiz; gerçek sapma eskisi gibi bulunur (gerileme yok)", { timeout: 240_000 }, async () => {
    const fixture = unpackFixture(UNLOCKED);
    let ctx = null;
    try {
      ctx = await open(fixture, UNLOCKED);
      assert.equal(ctx.app.ledger.snapshots.state().pending, null, "ön koşul: kilitsiz — bekleyen dondurma yok");
      assert.equal(ctx.app.ledger.snapshots.state().coverage, "", "ön koşul: donmuş dönem yok");
      const quiet = await ctx.app.integrity.scanInBackground();
      assert.ok(quiet.result, JSON.stringify(quiet).slice(0, 300));
      assert.equal(ruleDiffOf(quiet.result), null, "kilitsiz veride kural farkı denetimi yok");
      assert.deepEqual(quiet.findings, []);
      assert.deepEqual(ctx.fresh(), QUIET);
      injectRealDrift(ctx.app, todayOf(UNLOCKED));
      const scan = await ctx.app.integrity.scanInBackground();
      assert.ok(codesOf(scan.findings).includes("cents:cash_entries"), JSON.stringify(codesOf(scan.findings)));
      const seen = ctx.fresh();
      assert.equal(seen.gunluk, 1);
      assert.equal(seen.zil.length, 1);
      assert.ok(seen.sunucu.some(line => /kapının görmediği/.test(line)), JSON.stringify(seen.sunucu));
      const inline = ctx.app.integrity.scan();
      assert.deepEqual(inline.findings, [], "aynı sapma bir sonraki taramada yinelenmez (eski davranış)");
    } finally {
      await ctx?.server.close().catch(() => {});
      fixture.cleanup();
    }
  });
});
