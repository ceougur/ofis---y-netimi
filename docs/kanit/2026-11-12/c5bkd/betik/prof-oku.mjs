// .cpuprofile özeti: işlev başına öz süre (en büyük N) + dosya başına toplam. Kullanım: node prof-oku.mjs <dosya.cpuprofile> [N=25]
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

let file = process.argv[2];
if (statSync(file).isDirectory()) file = path.join(file, readdirSync(file).filter(n => n.endsWith(".cpuprofile")).sort().pop());
const top = Number(process.argv[3]) || 25;
const prof = JSON.parse(readFileSync(file, "utf8"));
const self = new Map();
const byId = new Map(prof.nodes.map(n => [n.id, n]));
const dt = prof.timeDeltas;
for (let i = 0; i < prof.samples.length; i += 1) {
  const n = byId.get(prof.samples[i]);
  const f = n.callFrame;
  const key = `${f.functionName || "(anonim)"} ${path.basename(f.url || "")}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) || 0) + (dt[i] || 0));
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log(`${path.basename(file)} · toplam ${Math.round(total / 1000)} ms`);
for (const [key, us] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`${String(Math.round(us / 1000)).padStart(7)} ms  ${key}`);
