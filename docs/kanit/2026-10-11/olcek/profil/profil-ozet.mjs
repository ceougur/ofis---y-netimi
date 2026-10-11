import { readFileSync } from "node:fs";
const profile = JSON.parse(readFileSync(process.argv[2], "utf8"));
const nodes = new Map(profile.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const counts = new Map();
for (const s of profile.samples) counts.set(s, (counts.get(s) || 0) + 1);
const total = profile.samples.length;
const key = n => `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.replace(/^.*\/(server|tools|test|node_modules)\//, "$1/")}:${n.callFrame.lineNumber + 1}`;
const self = new Map(), incl = new Map();
let idle = 0;
for (const [id, n] of counts) {
  const node = nodes.get(id);
  if (node.callFrame.functionName === "(idle)") idle += n;
  self.set(key(node), (self.get(key(node)) || 0) + n);
  const seen = new Set(); let cur = id;
  while (cur) { const k = key(nodes.get(cur)); if (!seen.has(k)) { incl.set(k, (incl.get(k) || 0) + n); seen.add(k); } cur = parent.get(cur); }
}
const busy = total - idle;
const top = (m, n, f = () => true) => [...m].filter(([k]) => f(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${((v / busy) * 100).toFixed(1).padStart(5)}%  ${k}`).join("\n");
const dur = (profile.endTime - profile.startTime) / 1e6;
console.log(`süre ${dur.toFixed(0)} sn · örnek ${total} · boşta ${(idle / total * 100).toFixed(1)}% · yüzdeler MEŞGUL süreye göre`);
console.log("--- öz süre ---\n" + top(self, 20, k => !k.startsWith("(idle)")));
console.log("--- kapsayıcı (server/) ---\n" + top(incl, Number(process.argv[3] || 45), k => k.includes("server/")));
