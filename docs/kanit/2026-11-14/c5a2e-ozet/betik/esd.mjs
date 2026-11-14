// K-e / gerileme: aynı veri kopyası birleşim öncesi (eski) ↔ sonrası (yeni) kodla açılır; fiş YOK / aday kararı YOK iken defter çıktıları dökülür (zaman alanları çıkarılır).
// Kullanım: node esd.mjs <kod kökü> <veri kökü (data/ backups/)> <bugün YYYY-AA-GG> <çıktı.json> [kilit YYYY-AA-GG|-] [olcum]
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, today, out, lockArg = "-", mode = ""] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: process.env.ESD_PASS || ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: `${today}T12:00:00+03:00`, fixed: true }, moneyStrict: true, gateVerify: true,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
const login = await client.login("admin", process.env.ESD_PASS || ADMIN_PASSWORD);
if (login.status !== 200) throw new Error(`giriş ${login.status}`);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const get = async url => { const r = await client.get(url); return { status: r.status, data: unwrap(r) }; };
await app.ledger.snapshots.runPending();
if (lockArg !== "-") {
  const r = await client.put("/api/admin/period-lock", { lockedUntil: lockArg });
  if (r.status !== 200) throw new Error(`kilit ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
  await app.ledger.snapshots.runPending();
}
const scrub = value => JSON.parse(JSON.stringify(value, (key, v) => (/^(ms|elapsed|took|durationMs|at|generatedAt|ranAt|checkedAt|startedAt|finishedAt|seconds|timing|createdAt|tookMs)$/.test(key) ? undefined : v)));
const result = { root, today, lock: app.period?.lockedUntil?.() || "" };
const urls = {
  integrity: "/api/workspace/ledger/integrity",
  ledger: "/api/workspace/ledger",
  yevmiye: "/api/workspace/report-center/yevmiye?from=2000-01-01&to=2099-12-31",
  hesapMizani: "/api/workspace/report-center/hesap-mizani?from=2000-01-01&to=2099-12-31",
  altHesap: "/api/workspace/report-center/alt-hesap-mizani?from=2000-01-01&to=2099-12-31",
  defterMut: "/api/workspace/report-center/defter-mutabakati",
  adaylar: "/api/workspace/opening-review",
};
const h = monitorEventLoopDelay({ resolution: 5 });
for (const [key, url] of Object.entries(urls)) {
  const times = [];
  let last;
  for (let i = 0; i < (mode === "olcum" ? 3 : 1); i += 1) {
    h.reset(); h.enable();
    const t0 = performance.now();
    last = await get(url);
    times.push(Math.round(performance.now() - t0));
    h.disable();
  }
  result[key] = { status: last.status, ms: times, loopMax: Math.round(h.max / 1e6), body: mode === "olcum" ? undefined : scrub(last.data) };
}
result.book = app.ledger.book({}).map(e => `${e.date}|${e.id}|${e.lines.map(l => `${l.account}:${l.sub || ""}:${l.party || ""}:${l.debit}:${l.credit}`).join(",")}`);
result.load = readFileSync("/proc/loadavg", "utf8").trim();
writeFileSync(out, JSON.stringify(result));
console.log(`${root.split("/").pop()} kilit=${result.lock} ` + Object.keys(urls).map(k => `${k} ${result[k].status} ${result[k].ms.join("/")}ms (döngü ${result[k].loopMax})`).join(" · ") + ` · madde ${result.book.length} · yük ${result.load}`);
await app.close();
