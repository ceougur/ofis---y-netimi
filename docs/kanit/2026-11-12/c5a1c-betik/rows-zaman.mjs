// Ç5-A tur 1c: build() içinde rows() sorgularının süresi (sorgu başına; satır dönüşümü dahil) ve journal() payı. Kullanım: node rows-zaman.mjs <kod kökü> <veri kopyası> [tekrar=3]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "3"] = process.argv.slice(2);
const repeat = Number(repeatText) || 3;
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const st = app.ledger.snapshots.state();
if (st.pending) await app.ledger.snapshots.runPending();
const per = new Map();
let on = false;
const { StatementSync } = await import("node:sqlite");
for (const prop of ["iterate", "all", "get"]) {
  const value = StatementSync.prototype[prop];
  StatementSync.prototype[prop] = function (...args) {
    if (!on) return value.apply(this, args);
    const label = String(this.sourceSQL || "?").replace(/\s+/g, " ").slice(0, 110);
    const t0 = performance.now();
    const book = n => {
      const row = per.get(label) || { ms: 0, n: 0, calls: 0 };
      row.ms += performance.now() - t0; row.calls += 1; row.n += n;
      per.set(label, row);
    };
    if (prop !== "iterate") {
      const out = value.apply(this, args);
      book(Array.isArray(out) ? out.length : 1);
      return out;
    }
    const it = value.apply(this, args);
    let n = 0;
    return {
      [Symbol.iterator]() { return this; },
      next() {
        const r = it.next();
        if (r.done) book(n);
        else n += 1;
        return r;
      },
      return(v) { book(n); return it.return ? it.return(v) : { done: true, value: v }; },
    };
  };
}
const builds = [];
for (let i = 0; i < repeat + 1; i += 1) {
  on = i > 0;
  if (i === 1) per.clear();
  const t0 = performance.now();
  const entries = app.ledger.build();
  if (i > 0) builds.push(Math.round(performance.now() - t0));
  if (i === repeat) console.log(`madde ${entries.length}`);
}
let sqlTotal = 0;
console.log(`kod ${root} · build ${JSON.stringify(builds)} ms · yük ${readFileSync("/proc/loadavg", "utf8").trim()}`);
for (const [label, row] of [...per].sort((a, b) => b[1].ms - a[1].ms)) {
  sqlTotal += row.ms;
  if (row.ms / repeat >= 2) console.log(`${(row.ms / repeat).toFixed(1).padStart(8)} ms/build · ${String(Math.round(row.n / repeat)).padStart(7)} satır · ${row.calls / repeat} çağrı · ${label}`);
}
console.log(`SQL toplam ${(sqlTotal / repeat).toFixed(0)} ms/build · geri kalan (journal + JS) ${(builds.reduce((a, b) => a + b, 0) / repeat - sqlTotal / repeat).toFixed(0)} ms/build`);
await app.close();
