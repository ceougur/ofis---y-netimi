// dk-m1k5 hız: KDV Özeti (100 bin satır) — önce / sonra aynı veri kopyası. Önce kopyada mahsup fişleri + fişten sonra alış (İ artışı → 'güncel değil') + alış İptal Et,
// sonra ölçüm. Kullanım: flock -x -w 1800 <olcum.lock> node olc-kdv.mjs <kod kökü> <veri kopyası> [tekrar=5]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "5"] = process.argv.slice(2);
const repeat = Number(repeatText) || 5;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
console.log(`kod ${root} · veri ${dir} · yük (başta) ${load()}`);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const store = app.store;
const body = r => (r.data && r.data.ok === true ? r.data.data : r.data);
console.log(`veri: ${store.get("SELECT COUNT(*) AS n FROM invoices").n} fatura, ${store.get("SELECT COUNT(*) AS n FROM invoice_lines").n} fatura satırı`);
// Hazırlık (ölçüm dışı): Ocak–Haziran 2026 mahsup; sonra Şubat'a alış (İ artışı) + Mart'ın bir alışını İptal Et.
const prep = [];
for (const m of ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]) {
  const r = await client.post("/api/workspace/tax/vat-offset", { month: m });
  prep.push(`${m}:${r.status}${r.status === 200 ? "" : ` ${body(r)?.error || ""}`.slice(0, 80)}`);
}
const sup = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND type = 'supplier' LIMIT 1");
const add = sup ? await client.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: sup.id, issueDate: "2026-02-20", number: "OLC-DK-1", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 1500, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }) : { status: "tedarikçi yok" };
const marBuy = store.get("SELECT id FROM invoices WHERE kind = 'purchase' AND status = 'issued' AND issue_date LIKE '2026-03-%' LIMIT 1");
const can = marBuy ? await client.post(`/api/workspace/invoices/${marBuy.id}/cancel`, { reason: "Hatalı fatura", force: true }) : { status: "Mart alışı yok" };
console.log(`hazırlık: fişler ${prep.join(" ")} · Şubat alış ${add.status} · Mart alış iptal ${can.status}`);
const list = body(await client.get("/api/workspace/tax/vat-offset")).offsets.filter(o => o.status === "active");
console.log(`etkin fiş ${list.length}, güncel değil ${list.filter(o => o.stale).map(o => o.month).join(",")}`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r1 = v => Math.round(v * 10) / 10;
const RC = "/api/workspace/report-center/kdv-ozeti";
const paths = [["Bu Yıl (2026)", `${RC}?from=2026-01-01&to=2026-12-31`], ["Tüm Zamanlar", `${RC}`], ["Tek ay (Nisan)", `${RC}?from=2026-04-01&to=2026-04-30`], ["ön izleme Temmuz", "/api/workspace/tax/vat-offset?month=2026-07"]];
for (const [, url] of paths) await client.get(url);
const times = Object.fromEntries(paths.map(([l]) => [l, []]));
let sample = "";
for (let i = 0; i < repeat; i += 1) {
  for (const [label, url] of paths) {
    h.reset();
    const s = performance.now();
    const res = await client.get(url);
    times[label].push(performance.now() - s);
    if (label === "Bu Yıl (2026)" && !sample) sample = JSON.stringify(body(res)?.summary?.filter(([k]) => /KDV|Fiş|Ay/.test(k))).slice(0, 600);
    if (res.status !== 200) console.log(`  ${label}: ${res.status}`);
    console.log(`  tur ${i + 1} ${label}: ${r1(performance.now() - s)} ms · olay döngüsü en çok ${r1(h.max / 1e6)} ms · yük ${load()}`);
  }
}
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const [label, a] of Object.entries(times)) console.log(`ORTANCA ${label}: ${r1(med(a))} ms (en az ${r1(Math.min(...a))})`);
console.log(`özet: ${sample}`);
console.log(`yük (sonda) ${load()}`);
await app.close();
