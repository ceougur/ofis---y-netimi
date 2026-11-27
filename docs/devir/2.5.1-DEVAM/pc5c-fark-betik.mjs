// P-Ç5C fark tablosu (yalnız OKUMA; programın KENDİ ürettiği veri — temiz-100k kopyası). Bugünkü Ödeme Hatırlatma seçimi (lib/whatsapp/queue.mjs eligibility
// + overdueOf: totals.overdue ESKİ anlam + açık kartın next.dueDate < bugün) ↔ tek borç sırasına (TYK overdue(bugün)) göre seçim. Kod değiştirmez; veri yazmaz.
// Kullanım: node fark.mjs <kod kökü> <veri kopyası> <çıktı.json>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, out] = process.argv.slice(2);
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { e164Of } = await import(pathToFileURL(path.join(root, "server", "lib", "whatsapp", "alici.mjs")).href);
const t0 = performance.now();
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Pc5c-Okuma-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: NOW, moneyStrict: false,
});
await app.listen(0, "127.0.0.1");
const open = Math.round(performance.now() - t0);
const { store, context } = app;
const user = store.get("SELECT * FROM users WHERE username = 'admin'");
const ids = store.all("SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY rowid").map(r => r.id);
const r2 = v => Math.round(v * 100) / 100;

// Bugünkü kural (queue.mjs:145-150 + :542-550 ile birebir; yalnız okuma).
const oldOverdue = a => {
  const overdue = r2(Number(a.totals?.overdue) || 0);
  if (!(overdue > 0.005)) return null;
  const dates = (a.plans || []).filter(p => p.status === "active" && p.next && Number(p.next.remaining) > 0.005 && p.next.dueDate < TODAY).map(p => p.next.dueDate).sort();
  return dates.length ? { dueDate: dates[0], amount: overdue } : null;
};
const baseSkip = a => {
  if (Number(a.waOptOut) === 1) return "İstemiyor";
  if (a.status === "passive") return "Pasif";
  if (!e164Of(a.phone).valid) return "Telefon";
  return "";
};
const tc = performance.now();
const all = context.invoices.allObligations();
const tyCold = Math.round(performance.now() - tc);
const tw = performance.now();
const facts = ids.map(id => context.accounts.waFacts(id, user));
const tWa = Math.round(performance.now() - tw);
const closedPlans = new Set(store.all("SELECT id FROM plans WHERE status = 'closed'").map(r => r.id));
const kindOf = item => {
  if (item.planId) return closedPlans.has(item.planId) ? "kapali-kart" : "taksit";
  if (item.invoiceId || item.kind === "invoice") return "fatura";
  if (item.origin === "" && ["debt", "opening"].includes(item.lineKind)) return item.lineKind === "opening" ? "acilis" : "borc-yaz";
  return `diger:${item.kind}/${item.origin}/${item.lineKind}`;
};
const rows = [];
for (const a of facts) {
  const old = oldOverdue(a);
  const tyk = all?.get(a.id) || null;
  const ov = tyk ? tyk.overdue(TODAY) : { amount: 0, count: 0, since: "", items: [] };
  const promiseUntil = tyk ? tyk.items.filter(i => i.side === "receivable" && i.promise && i.promise >= TODAY).reduce((m, i) => (i.promise > m ? i.promise : m), "") : "";
  const dsum = context.doubtful?.summary ? context.doubtful.summary(a.id) : null;
  rows.push({
    id: a.id, type: a.type, base: baseSkip(a), balance: r2(a.totals?.balance || 0),
    old: old ? { amount: old.amount, due: old.dueDate } : null,
    oldTotalsOverdue: r2(Number(a.totals?.overdue) || 0),
    neu: ov.amount > 0.005 ? { amount: r2(ov.amount), since: ov.since, count: ov.count, kinds: [...new Set(ov.items.map(kindOf))].sort() } : null,
    doubtfulOpen: dsum ? Number(dsum.openMinor || 0) / 100 : 0, doubtfulQueue: tyk ? r2(tyk.doubtful.amount) : 0,
    promise: promiseUntil && ov.amount > 0.005 ? promiseUntil : "",
  });
}
writeFileSync(out, JSON.stringify({ now: NOW, open, tyCold, tWa, n: ids.length, rows }, null, 0));
console.log(`açılış ${open} ms · TYK önbelleği (soğuk) ${tyCold} ms · waFacts × ${ids.length} = ${tWa} ms · yük ${(await import("node:fs")).readFileSync("/proc/loadavg", "utf8").trim()}`);
await app.close();
