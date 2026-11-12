// DK-C5BT2A ölçüm (ana oturumun ölçmediği yollar): kart yazım YANITI (O-2), hemen ardından kart GET, zil / takvim (dues), Vade Takip, nakit akışı (O-3) — önce / sonra aynı veri kopyası.
// Kullanım: flock -x -n <olcum.lock> node olc-kart.mjs <kod kökü> <veri kopyası> [tekrar=3]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "3"] = process.argv.slice(2);
const repeat = Number(repeatText) || 3;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
console.log(`kod ${root} · veri ${dir} · yük (başta) ${load()}`);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const t0 = performance.now();
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
console.log(`açılış ${Math.round(performance.now() - t0)} ms`);
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const store = app.store;
const plan = store.get("SELECT p.id, p.account_id AS acc, (SELECT COUNT(*) FROM plan_items i WHERE i.plan_id = p.id) AS n FROM plans p WHERE p.deleted_at IS NULL AND p.status = 'active' AND p.account_id <> '' ORDER BY (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = p.account_id) DESC LIMIT 1");
const counts = store.get("SELECT (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL) AS a, (SELECT COUNT(*) FROM account_entries) AS e, (SELECT COUNT(*) FROM invoices) AS i, (SELECT COUNT(*) FROM plans) AS p");
console.log(`veri: ${counts.a} cari, ${counts.e} cari satırı, ${counts.i} fatura, ${counts.p} kart; ölçülen kart ${plan.id} (${plan.n} taksit; carisinin satırı ${store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", plan.acc).n})`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r = v => Math.round(v * 10) / 10;
const timed = async (label, call) => {
  h.reset();
  const s = performance.now();
  const res = await call();
  const ms = performance.now() - s;
  const gate = app.integrity?.stats?.().gate || {};
  console.log(`  ${label}: ${res.status} · ${r(ms)} ms · olay döngüsü en çok ${r(h.max / 1e6)} ms${label.includes("YAZIM") ? ` · kapı yolu ${gate.path}${gate.reason ? ` (neden: ${gate.reason})` : ""} · kapı ${r(gate.ms || 0)} ms` : ""}`);
  return res;
};
const RANGE = "from=2026-01-01&to=2027-12-31";
await client.get("/api/workspace/accounts?status=all&limit=50");
await client.get(`/api/workspace/overview/vade-takip?${RANGE}`);
await client.get("/api/workspace/dues");
for (let i = 0; i < repeat; i += 1) {
  console.log(`tur ${i + 1} · yük ${load()}`);
  await timed("YAZIM kart tahsilatı", () => client.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "10", date: "2026-10-08", method: "cash", cashForce: true }));
  await timed("kart GET (yazımdan hemen sonra)", () => client.get(`/api/workspace/plans/${plan.id}`));
  await timed("zil / takvim (yazımdan sonra ilk)", () => client.get("/api/workspace/dues"));
  await timed("Vade Takip (yazımdan sonra ilk)", () => client.get(`/api/workspace/overview/vade-takip?${RANGE}`));
  await timed("zil / takvim (ılık)", () => client.get("/api/workspace/dues"));
  await timed("Vade Takip (ılık)", () => client.get(`/api/workspace/overview/vade-takip?${RANGE}`));
  await timed("nakit akışı (ılık)", () => client.get(`/api/workspace/overview/nakit-akisi?${RANGE}`));
}
console.log(`yük (sonda) ${load()}`);
await app.close();
