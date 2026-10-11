// E2: SQLite sorgusu dönen döngüde terminate ne kadar sürede etkili olur? (argv: N = özyinelemeli CTE satırı; 0 = basit sorgu)
import { Worker } from "node:worker_threads";
const N = Number(process.argv[2] || 0);
const q = N ? `WITH RECURSIVE r(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM r WHERE i<${N}) SELECT count(*) c FROM r` : "SELECT 1 c";
const code = `
const { parentPort } = require("node:worker_threads");
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(":memory:");
const st = db.prepare(${JSON.stringify(q)});
let n = 0; parentPort.postMessage("başladı");
while (true) { st.get(); n++; if (n % 1 === 0) globalThis.__n = n; }
`;
const w = new Worker(code, { eval: true });
await new Promise(r => w.once("message", r));
await new Promise(r => setTimeout(r, 300));
const t0 = Date.now();
const timer = setTimeout(() => { console.log(`N=${N}: terminate 20 sn'de ÇÖZÜLMEDİ (iş parçacığı durmadı)`); process.exit(2); }, 20000);
const code2 = await w.terminate();
clearTimeout(timer);
console.log(`N=${N}: terminate ${Date.now() - t0} ms, çıkış kodu ${code2}`);
