// AH: yeni onarımın soğuk koşusunun CPU profili (yalnız repairOwnCards çağrısı; node:inspector). node profil.mjs <kod> <veri kopyası klasörü> <çıktı.txt>
import { Session } from "node:inspector/promises";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, source, out] = process.argv.slice(2).map(item => path.resolve(item));
const work = `${out}.calisma`;
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
cpSync(source, work, { recursive: true });
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const app = createApp({ dataDir: path.join(work, "data"), backupDir: path.join(work, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false });
app.store.setSetting("ah.olcum.soguk", String(Date.now()));
const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 500 });
await session.post("Profiler.start");
const at = performance.now();
app.context.invoices.repairOwnCards({});
const ms = performance.now() - at;
const { profile } = await session.post("Profiler.stop");
const byId = new Map(profile.nodes.map(node => [node.id, node]));
const parent = new Map();
for (const node of profile.nodes) for (const child of node.children || []) parent.set(child, node.id);
const self = new Map();
const dt = profile.timeDeltas;
for (let k = 0; k < profile.samples.length; k += 1) self.set(profile.samples[k], (self.get(profile.samples[k]) || 0) + (dt[k] || 0));
const label = node => `${node.callFrame.functionName || "(anonim)"} ${node.callFrame.url.replace(/^.*\/(server\/)/, "$1")}:${node.callFrame.lineNumber + 1}`;
const selfBy = new Map();
const totalBy = new Map();
for (const [id, us] of self) {
  const node = byId.get(id);
  selfBy.set(label(node), (selfBy.get(label(node)) || 0) + us);
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const name = label(byId.get(cur));
    if (seen.has(name)) continue;
    seen.add(name);
    totalBy.set(name, (totalBy.get(name) || 0) + us);
  }
}
const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, us]) => `${(us / 1e6).toFixed(2)} sn  ${name}`).join("\n");
const text = `repairOwnCards soğuk: ${Math.round(ms)} ms\nKENDİ SÜRESİ:\n${top(selfBy, 12)}\nTOPLAM (server/ altı):\n${top(new Map([...totalBy].filter(([name]) => name.includes("server/"))), 18)}\n`;
writeFileSync(out, text);
console.log(text);
await app.close();
rmSync(work, { recursive: true, force: true });
