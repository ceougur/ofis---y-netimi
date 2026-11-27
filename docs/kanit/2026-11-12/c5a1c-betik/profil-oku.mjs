// Kaydedilmiş .cpuprofile'dan kapsayıcı / öz süre (desenle süzülmüş). Kullanım: node profil-oku.mjs <dosya> <desen>
import { readFileSync } from "node:fs";

const [file, pattern = "."] = process.argv.slice(2);
const profile = JSON.parse(readFileSync(file, "utf8"));
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const selfNode = new Map();
profile.samples.forEach((s, i) => selfNode.set(s, (selfNode.get(s) || 0) + (profile.timeDeltas[i] || 0)));
const keyOf = f => `${f.functionName || "(anon)"} ${String(f.url).replace(/^.*\/(server|test)\//, "$1/")}:${f.lineNumber + 1}`;
const total = new Map();
const self = new Map();
for (const [id, t] of selfNode) {
  const own = keyOf(byId.get(id).callFrame);
  self.set(own, (self.get(own) || 0) + t);
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const k = keyOf(byId.get(cur).callFrame);
    if (seen.has(k)) continue;
    seen.add(k);
    total.set(k, (total.get(k) || 0) + t);
  }
}
const re = new RegExp(pattern);
for (const [k, v] of [...total].filter(([k]) => re.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 50)) console.log(`${(v / 1000).toFixed(0).padStart(7)} kaps · ${((self.get(k) || 0) / 1000).toFixed(0).padStart(6)} öz  ${k}`);
