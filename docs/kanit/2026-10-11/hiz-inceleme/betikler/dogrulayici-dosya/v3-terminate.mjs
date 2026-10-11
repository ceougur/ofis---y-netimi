// terminate, node:sqlite eşzamanlı sorgusunun ortasında ne kadar sürede etkili olur?
import { Worker } from "node:worker_threads";
const N = Number(process.argv[2] || 3000000);
const LOOP = process.argv[3] === "loop";
const code = `
const { DatabaseSync } = require("node:sqlite");
const { parentPort } = require("node:worker_threads");
const db = new DatabaseSync(":memory:");
const st = db.prepare("WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c WHERE x < ${N}) SELECT sum(x) s FROM c");
const t = Date.now(); st.get(); parentPort.postMessage({ one: Date.now() - t });
${LOOP ? "for(;;) st.get();" : "st.get(); parentPort.postMessage({ done: true });"}
`;
for (let i = 0; i < 3; i++) {
  const w = new Worker(code, { eval: true });
  const one = await new Promise(r => w.once("message", m => r(m.one)));
  await new Promise(r => setTimeout(r, Math.floor(one / 3)));
  const t = Date.now();
  const res = await Promise.race([w.terminate().then(c => "kod " + c), new Promise(r => setTimeout(() => r("ZAMAN AŞIMI 20sn"), 20000))]);
  console.log(`deneme ${i + 1}: sorgu ${one} ms, terminate ${res} ${Date.now() - t} ms`);
  if (res.startsWith("ZAMAN")) { process.exit(0); }
}
