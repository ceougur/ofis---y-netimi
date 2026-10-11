// Ana iş parçacığının en uzun TEK çağrıları (olay döngüsünün en uzun tutulmaları) — CPU profilinden (node --cpu-prof).
// Her server/ işlevi için yığında o işlevin kesintisiz bulunduğu en uzun örnek dizisi (= o işlevin tek bir çağrısının süresi, aynı işlevin
// art arda iki çağrısı arasında yığından çıkılmadıysa birleşik) hesaplanır; istek yönlendirme çerçeveleri (app.mjs, session-scope, router)
// dışarıda bırakılır. Böylece yük testindeki "olay döngüsü en çok" değerinin hangi tek işten geldiği görülür (11.10.2026 hız düzeltmesi).
// Kullanım: node docs/kanit/2026-10-11/hiz-duzeltme/profil-bloklar.mjs <ana iş parçacığının .cpuprofile dosyası> [en çok 12] [--atla <sn>]
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const file = argv[0];
const top = Number(argv[1]) || 12;
const skipAt = argv.indexOf("--atla");
const skipSeconds = skipAt >= 0 ? Number(argv[skipAt + 1]) || 0 : 0;
const profile = JSON.parse(readFileSync(file, "utf8"));
const nodes = new Map(profile.nodes.map(node => [node.id, node]));
const parent = new Map();
for (const node of profile.nodes) for (const child of node.children || []) parent.set(child, node.id);
const label = frame => `${frame.functionName || "(anon)"} ${String(frame.url || "").replace(/^.*\/(server\/)/, "$1")}:${frame.lineNumber + 1}`;
const GENERIC = /server\/(app\.mjs|lib\/session-scope\.mjs|lib\/router\.mjs|lib\/http\.mjs)/;
const stackCache = new Map();
const stackOf = id => {
  if (stackCache.has(id)) return stackCache.get(id);
  const out = new Set();
  for (let at = id; at !== undefined; at = parent.get(at)) {
    const frame = nodes.get(at)?.callFrame;
    if (frame && /\/server\//.test(frame.url || "") && !GENERIC.test(frame.url || "")) out.add(label(frame));
  }
  stackCache.set(id, out);
  return out;
};
const open = new Map(); // işlev → başlangıç zamanı
const longest = new Map(); // işlev → { ms, at }
let clock = profile.startTime;
const skipUntil = profile.startTime + skipSeconds * 1e6;
const close = (name, end) => {
  const start = open.get(name);
  open.delete(name);
  if (start < skipUntil) return;
  const ms = (end - start) / 1000;
  if (!longest.has(name) || longest.get(name).ms < ms) longest.set(name, { ms, at: (start - profile.startTime) / 1e6 });
};
for (let i = 0; i < profile.samples.length; i += 1) {
  clock += profile.timeDeltas[i] || 0;
  const stack = stackOf(profile.samples[i]);
  for (const name of [...open.keys()]) if (!stack.has(name)) close(name, clock);
  for (const name of stack) if (!open.has(name)) open.set(name, clock);
}
for (const name of [...open.keys()]) close(name, clock);
const rows = [...longest.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, top);
console.log(`${file.split("/").pop()} · örnek ${profile.samples.length} · süre ${Math.round((profile.endTime - profile.startTime) / 1e6)} sn${skipSeconds ? ` · ilk ${skipSeconds} sn (açılış) dışarıda` : ""}`);
console.log("En uzun tek çağrı (ms) · başladığı an (sn) · işlev");
for (const [name, item] of rows) console.log(`${String(Math.round(item.ms)).padStart(6)} ms · t=${String(Math.round(item.at)).padStart(4)} sn · ${name}`);
