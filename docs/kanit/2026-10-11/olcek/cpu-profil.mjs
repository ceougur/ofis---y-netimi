// Çalışan doldurma sürecinin (kendi sürecim) 20 sn CPU profili: SIGUSR1 → denetçi → Profiler.
import { writeFileSync } from "node:fs";
const pid = Number(process.argv[2]);
const seconds = Number(process.argv[3] || 20);
process.kill(pid, "SIGUSR1");
await new Promise(r => setTimeout(r, 1500));
const list = await (await fetch("http://127.0.0.1:9229/json/list")).json();
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
};
await new Promise(r => (ws.onopen = r));
const send = (method, params = {}) => new Promise(resolve => {
  id += 1;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
await send("Profiler.enable");
await send("Profiler.setSamplingInterval", { interval: 1000 });
await send("Profiler.start");
await new Promise(r => setTimeout(r, seconds * 1000));
const { profile } = await send("Profiler.stop");
writeFileSync(process.argv[4] || "/tmp/claude-0/-home-user/f3fde27e-cd8e-54af-b1ca-43dd7d833c3d/scratchpad/profil.cpuprofile", JSON.stringify(profile));
// Öz süre (self) ve kapsayıcı süre (total) — işlev + dosya:satır.
const nodes = new Map(profile.nodes.map(node => [node.id, node]));
const self = new Map();
const counts = new Map();
for (const sample of profile.samples) counts.set(sample, (counts.get(sample) || 0) + 1);
const total = profile.samples.length;
const key = node => `${node.callFrame.functionName || "(anon)"} ${node.callFrame.url.replace(/^.*\/(server|tools|test)\//, "$1/")}:${node.callFrame.lineNumber + 1}`;
for (const [nodeId, n] of counts) {
  const node = nodes.get(nodeId);
  self.set(key(node), (self.get(key(node)) || 0) + n);
}
const parent = new Map();
for (const node of profile.nodes) for (const child of node.children || []) parent.set(child, node.id);
const incl = new Map();
for (const [nodeId, n] of counts) {
  const seen = new Set();
  let cur = nodeId;
  while (cur) {
    const k = key(nodes.get(cur));
    if (!seen.has(k)) {
      incl.set(k, (incl.get(k) || 0) + n);
      seen.add(k);
    }
    cur = parent.get(cur);
  }
}
const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${((v / total) * 100).toFixed(1)}%  ${k}`).join("\n");
console.log(`örnek ${total}\n--- öz süre ---\n${top(self, 25)}\n--- kapsayıcı (server/) ---\n${top(new Map([...incl].filter(([k]) => k.includes("server/"))), 40)}`);
ws.close();
process.exit(0);
