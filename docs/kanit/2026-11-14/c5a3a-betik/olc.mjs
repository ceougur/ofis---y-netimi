// Ç5-A tur 3a kabul E (hız; ders 47, 53 (a)): değişen yollar taban ↔ yeni, temiz 100 bin satırın TAZE kopyası, N tekrar; her yol için ortanca, en iyi, olay döngüsü en çok.
// Kullanım: flock -x -n <olcum.lock> node olc.mjs <kod kökü> <veri kopyası> <tekrar> <çıktı.json>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "5", out] = process.argv.slice(2);
const repeat = Number(repeatText) || 5;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
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
const busiest = store.get("SELECT account_id AS id, COUNT(*) AS n FROM account_entries GROUP BY account_id ORDER BY n DESC LIMIT 1");
const plan = store.get("SELECT p.id, p.account_id AS acc FROM plans p WHERE p.deleted_at IS NULL AND p.status = 'active' AND p.account_id <> '' ORDER BY (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = p.account_id) DESC LIMIT 1");
const buyer = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND type = 'customer' ORDER BY rowid LIMIT 1 OFFSET 10").id;
const svc = (await client.post("/api/workspace/stock", { kind: "service", code: "C5A3A-HIZ", name: "Hız Hizmet", unit: "Adet", salePrice: "10" })).data;
const itemId = (svc?.data || svc)?.id;
if (!itemId) throw new Error(`hizmet kartı: ${JSON.stringify(svc).slice(0, 200)}`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const samples = {};
const timed = async (label, call) => {
  h.reset();
  const s = performance.now();
  const res = await call();
  const ms = performance.now() - s;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  (samples[label] ||= []).push({ ms, loop: h.max / 1e6 });
};
const RANGE = "from=2026-01-01&to=2027-12-31";
// ısınma (ölçülmez)
await client.get("/api/workspace/accounts?status=all&limit=50");
await client.get(`/api/workspace/accounts/${busiest.id}`);
await client.get("/api/workspace/plans?status=active&limit=50");
await client.get(`/api/workspace/overview/vade-takip?${RANGE}`);
await client.get("/api/workspace/dues");
const loads = [load()];
for (let i = 0; i < repeat; i += 1) {
  await timed("karttan tahsilat yazımı", () => client.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1", date: "2026-10-08", method: "cash", cashForce: true }));
  await timed("Cari Listesi (yazımdan sonra ilk)", () => client.get("/api/workspace/accounts?status=all&limit=50"));
  await timed("Cari Listesi (ılık)", () => client.get("/api/workspace/accounts?status=all&limit=50"));
  await timed("cari kartı (kalabalık)", () => client.get(`/api/workspace/accounts/${busiest.id}`));
  await timed("Taksitler listesi", () => client.get("/api/workspace/plans?status=active&limit=50"));
  await timed("Vade Takip", () => client.get(`/api/workspace/overview/vade-takip?${RANGE}`));
  await timed("zil / takvim", () => client.get("/api/workspace/dues"));
  await timed("fatura kaydı", () => client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyer, issueDate: "2026-10-08", lines: [{ itemId, qty: 1, unitPrice: "10", vatRate: 0 }], payment: { rest: "open" } }));
  await timed("Cari Listesi (fatura yazımından sonra ilk)", () => client.get("/api/workspace/accounts?status=all&limit=50"));
  loads.push(load());
}
h.disable();
const r = v => Math.round(v * 10) / 10;
const result = {};
for (const [label, list] of Object.entries(samples)) {
  const ms = list.map(x => x.ms).sort((a, b) => a - b);
  result[label] = { n: ms.length, ortanca: r(ms[Math.floor(ms.length / 2)]), enIyi: r(ms[0]), olayDongusuEnCok: r(Math.max(...list.map(x => x.loop))) };
}
writeFileSync(out, `${JSON.stringify({ kod: root, yuk: loads, kalabalikCariSatir: busiest.n, sonuc: result }, null, 1)}\n`);
console.log(JSON.stringify({ yukBasta: loads[0], yukSonda: loads.at(-1) }));
await app.close();
