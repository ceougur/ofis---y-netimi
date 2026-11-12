// Ç5-B kapanış düzeltmesi madde 5 — PROFİL (kabul ölçümü DEĞİL): yalnız ILIK zil döngüsünün (ya da Borç Yaz döngüsünün) işlemci dökümü (node:inspector).
// Akış ana oturumun olc-kart.mjs'iyle aynı: kart tahsilatı YAZ → kart GET → zil (ilk) → Vade Takip → [profil: zil ılık × N].
// Kullanım: node prof-ilik.mjs <kod kökü> <veri kopyası> [zil|borc] [tekrar]
import { readFileSync } from "node:fs";
import inspector from "node:inspector/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, what = "zil", repeatText = "10"] = process.argv.slice(2);
const repeat = Number(repeatText) || 10;
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
const r = v => Math.round(v * 10) / 10;
const stats = list => { const s = [...list].sort((a, b) => a - b); return `en iyi ${r(s[0])} · ortanca ${r(s[Math.floor(s.length / 2)])} · en kötü ${r(s[s.length - 1])}`; };
console.log(`kod ${root} · yük ${load()}`);
const RANGE = "from=2026-01-01&to=2027-12-31";
const plan = store.get("SELECT p.id FROM plans p WHERE p.deleted_at IS NULL AND p.status = 'active' AND p.account_id <> '' ORDER BY (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = p.account_id) DESC LIMIT 1");
await client.get("/api/workspace/accounts?status=all&limit=50");
await client.get(`/api/workspace/overview/vade-takip?${RANGE}`);
await client.get("/api/workspace/dues");
const session = new inspector.Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 200 });
const profiled = async (label, body) => {
  await session.post("Profiler.start");
  const ms = await body();
  const { profile } = await session.post("Profiler.stop");
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i += 1) {
    const f = byId.get(profile.samples[i]).callFrame;
    const key = `${f.functionName || "(anonim)"} ${path.basename(f.url || "")}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + (profile.timeDeltas[i] || 0));
  }
  console.log(`${label} × ${ms.length}: ${stats(ms)} ms · ${ms.map(r).join(" ")}`);
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  console.log(`  profil toplam ${Math.round(total / 1000)} ms (çağrı başına ${r(total / 1000 / ms.length)} ms)`);
  for (const [key, us] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16)) console.log(`  ${String(r(us / 1000 / ms.length)).padStart(7)} ms/çağrı  ${key}`);
};
if (what === "zil") {
  await client.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "10", date: "2026-10-08", method: "cash", cashForce: true });
  await client.get(`/api/workspace/plans/${plan.id}`);
  const first = await client.get("/api/workspace/dues");
  const d0 = first.data?.data || first.data;
  console.log(`zil (yazımdan sonra ilk): kalem ${d0.items?.length} · yanıt ${JSON.stringify(first.data).length} bayt`);
  await client.get(`/api/workspace/overview/vade-takip?${RANGE}`);
  await profiled("ILIK ZİL", async () => {
    const ms = [];
    for (let i = 0; i < repeat; i += 1) { const s = performance.now(); await client.get("/api/workspace/dues"); ms.push(performance.now() - s); }
    return ms;
  });
  // İstemcinin gerçek yolu: elindeki sürümü gönderir — içerik değişmediyse büyük yanıt gelmez.
  const ms = [];
  for (let i = 0; i < repeat; i += 1) { const s = performance.now(); await client.get(`/api/workspace/dues?since=${encodeURIComponent(d0.version)}`); ms.push(performance.now() - s); }
  console.log(`ILIK ZİL (since=sürüm; ekranın gerçek çağrısı) × ${repeat}: ${stats(ms)} ms`);
} else {
  const other = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND type = 'customer' ORDER BY rowid LIMIT 1 OFFSET 10").id;
  await profiled("BORÇ YAZ", async () => {
    const ms = [];
    for (let i = 0; i < repeat; i += 1) {
      const s = performance.now();
      const res = await client.post(`/api/workspace/accounts/${other}/entries`, { kind: "debt", amount: "1", date: "2026-10-08", note: `hız ${i}` });
      ms.push(performance.now() - s);
      if (res.status !== 200) throw new Error(`Borç Yaz ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    }
    return ms;
  });
  console.log(`  lastTx ${JSON.stringify(store.lastTx)} · kapı ${JSON.stringify({ path: app.integrity.stats().gate?.path, ms: app.integrity.stats().gate?.ms })}`);
}
console.log(`yük (sonda) ${load()}`);
await app.close();
