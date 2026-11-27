// Ç5-A tur 1c BULGU sondası: kilitli eski veride açılış tabanı (integrity.start) dondurmadan ÖNCE alınır → dondurmadan sonraki ilk tarama "Kural Değişikliği Farkı"nı YENİ SAPMA sayar mı?
// Kullanım: node taban-alarm.mjs <kod kökü> <depo kökü (fikstür)> [fikstür=surum-2.0.26-zincir]
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, repo, name = "surum-2.0.26-zincir"] = process.argv.slice(2);
const imp = p => import(pathToFileURL(path.join(root, p)).href);
const { CURRENT, bootVersion } = await imp("test/guvenilirlik/surumler.mjs");
const { readFixture, unpackFixture } = await import(pathToFileURL(path.join(repo, "test/guvenilirlik/fikstur.mjs")).href);
const fixture = unpackFixture(name, { root: `/dev/shm/c5a1c-alarm-${process.pid}` });
const today = readFixture(name).oncesi?.today || String(readFixture(name).now || "").slice(0, 10);
const events = [];
let server = null;
try {
  server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, integrityScan: false });
  const { app } = server;
  const unsubscribe = app.events?.subscribe?.((event) => events.push(event));
  const store = app.store;
  const pendingAtStart = app.ledger.snapshots.state().pending;
  const baseline = store.get("SELECT detail_json AS detail FROM integrity_log WHERE action = 'baseline' ORDER BY at DESC LIMIT 1");
  const baselineHas = String(baseline?.detail || "").includes("ledger:rule-diff") || String(baseline?.detail || "").includes("Kural Değişikliği");
  await app.ledger.snapshots.runPending();
  const logBefore = store.get("SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'scan'").n;
  const first = await app.integrity.scanInBackground();
  const logAfter = store.get("SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'scan'").n;
  const last = store.get("SELECT summary FROM integrity_log WHERE action = 'scan' ORDER BY at DESC LIMIT 1");
  const second = await app.integrity.scanInBackground();
  console.log(JSON.stringify({
    root, name, pendingAtStart: Boolean(pendingAtStart), baselineHasRuleDiff: baselineHas,
    firstScan: { findings: (first.findings || []).map(item => `${item.code} (${item.count})`), skipped: first.skipped || null },
    scanLogRows: { before: logBefore, after: logAfter, lastSummary: last?.summary || null },
    secondScan: { findings: (second.findings || []).map(item => item.code), skipped: second.skipped || null },
    ruleDiffInFirst: (first.result?.checks || []).some(item => item.code === "ledger:rule-diff"),
  }));
  unsubscribe?.();
} finally {
  await server?.close().catch(() => {});
  fixture.cleanup();
}
