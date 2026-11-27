// AH: yaşayan mutantların (M3, M4, M5, M6, M7) eşdeğerlik ön koşulları programın kendi verisinde sayılır (yeni kodla açılmış kopya; açılış onarımı yapılmış).
//   node yasayan-mutant.mjs <kod> <veri klasörü (data/ backups/)> <bugün> [--kopya]
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, source, today] = process.argv.slice(2);
const work = mkdtempSync(path.join(os.tmpdir(), "ah-yasayan-"));
if (source.startsWith("fikstur:")) {
  const { unpackFixture } = await import(pathToFileURL(path.join(path.resolve(root), "test", "guvenilirlik", "fikstur.mjs")).href);
  const unpacked = unpackFixture(source.slice(8));
  cpSync(path.dirname(unpacked.dataDir), work, { recursive: true });
  unpacked.cleanup();
} else cpSync(path.resolve(source), work, { recursive: true });
const { createApp } = await import(pathToFileURL(path.join(path.resolve(root), "server", "app.mjs")).href);
const app = createApp({ dataDir: path.join(work, "data"), backupDir: path.join(work, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "x-Yasayan-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: `${today}T12:00:00+03:00`, fixed: true } });
const store = app.store;
const inv = app.context.invoices;
const p = app.context.plans;
const out = { veri: source };
// M3: iptal edilmiş (issued olmayan) iadenin cariye yazılmış geri ödemesi ('out') kalıyor mu?
out.M3_iptalIadeGeriOdemeSatiri = store.get("SELECT COUNT(*) AS n FROM account_entries e JOIN invoices r ON r.id = e.source_id WHERE e.source = 'invoice' AND e.kind = 'out' AND r.kind = 'sale_return' AND r.status <> 'issued'").n;
// M7: satıştan iadenin 'in' satırı var mı?
out.M7_iadeGirisSatiri = store.get("SELECT COUNT(*) AS n FROM account_entries e JOIN invoices r ON r.id = e.source_id WHERE e.source = 'invoice' AND e.kind = 'in' AND r.kind = 'sale_return'").n;
const rows = store.all(`SELECT DISTINCT i.id, i.account_id AS accountId, i.plan_id AS planId FROM invoices i
      JOIN invoices r ON r.original_id = i.id AND r.kind = 'sale_return' AND r.status = 'issued'
      JOIN plans pl ON pl.id = i.plan_id AND pl.deleted_at IS NULL AND pl.status <> 'closed'
      WHERE i.status = 'issued' AND i.plan_id <> ''`);
const screen = inv.repairScreen(rows.map(row => row.id));
let bothPositive = 0;
let aboveBefore = 0;
let aboveTarget = 0;
const refundOf = id => store.all("SELECT e.amount FROM invoices r JOIN account_entries e ON e.source = 'invoice' AND e.source_id = r.id AND e.kind = 'out' WHERE r.kind = 'sale_return' AND r.status = 'issued' AND r.original_id = ?", id).reduce((sum, row) => sum + Number(row.amount), 0);
for (const row of rows) {
  const s = screen.get(row.id);
  const open = Number(s?.open) || 0;
  const excess = Number(s?.excess) || 0;
  if (open > 0.005 && excess > 0.005) bothPositive += 1;
  const refunds = Math.round(refundOf(row.id) * 100) / 100;
  if (!(refunds > 0.005)) continue;
  const signed = open - excess;
  const target = Math.max(0, signed);
  const before = Math.max(0, signed - refunds) + refunds;
  const left = p.leftOf(row.planId);
  if (left > before + 0.005) aboveBefore += 1;
  if (left > target + 0.005) aboveTarget += 1;
}
out.aday = rows.length;
out.M4_acikVeFazlaBirlikte = bothPositive;
out.M6_kalanEskiHedefiAsan = aboveBefore;
out.acilisSonrasiKalanHedeftenBuyuk = aboveTarget;
out.acilisOnarimi = { fixed: app.context.ownCardRepair?.fixed?.length, locked: app.context.ownCardRepair?.locked?.length };
console.log(JSON.stringify(out));
await app.close();
rmSync(work, { recursive: true, force: true });
