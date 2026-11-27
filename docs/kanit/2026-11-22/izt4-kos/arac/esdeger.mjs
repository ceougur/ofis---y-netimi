// Temiz 100 bin veride bütün carilerin kuyruk sonucu dökümü (eski ↔ yeni karşılaştırma için). node esdeger.mjs <kod> <veri kopyası> > döküm.jsonl
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
await app.listen(0, "127.0.0.1");
const tyk = app.context.invoices.allObligations();
const r2 = v => Math.round(v * 100) / 100;
let n = 0;
for (const [id, r] of tyk) {
  const cards = {};
  for (const [planId, map] of r.installments) cards[planId] = r2([...map.values()].reduce((s, x) => s + (x.remaining || 0), 0));
  const inv = {};
  for (const [invId, st] of r.invoices) inv[invId] = [st.state, st.open, st.covered, st.excess ?? 0];
  console.log(JSON.stringify({ id, overdue: r.overdue().amount, items: r2(r.items.reduce((s, x) => s + (x.side === "receivable" ? 1 : -1) * x.remaining, 0)), passes: r.prepaidPasses?.count || 0, cards, inv }));
  n += 1;
}
console.error(`cari ${n}`);
await app.close();
