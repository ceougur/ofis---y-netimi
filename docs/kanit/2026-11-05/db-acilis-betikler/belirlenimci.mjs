// node belirlenimci.mjs <db.mjs yolu> <kip> <tutmaMs> [ro] — A (ayrı süreç) kilit tutarken B (ayrı süreç) openDatabase çağırır.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
const [lib, mode, holdMs, ro] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(path.dirname(here), "veri-"));
const file = path.join(dir, "d.sqlite");
const init = new DatabaseSync(file);
init.exec(`PRAGMA journal_mode = ${mode === "rollback-read" ? "DELETE" : "WAL"}; CREATE TABLE t(v TEXT); INSERT INTO t(v) VALUES ('x');`);
init.close();
const holder = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(here, "tutucu.mjs"), file, mode, holdMs], { stdio: ["ignore", "pipe", "inherit"] });
let out = "";
await new Promise(resolve =>
  holder.stdout.on("data", chunk => {
    out += chunk;
    if (out.includes("HAZIR")) resolve();
  })
);
const t0 = Date.now();
const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(here, "acici.mjs"), lib, file, ro || ""], { encoding: "utf8" });
if (holder.exitCode === null) await new Promise(resolve => holder.once("exit", resolve));
const released = Number((out.match(/BIRAKTI (\d+)/) || [])[1]);
const res = JSON.parse(r.stdout.trim() || "{}");
console.log(JSON.stringify({ mode, holdMs: Number(holdMs), ro: ro === "ro", ...res, sinceReady: res.at - t0, afterRelease: res.at - released, stderr: r.stderr.trim().slice(0, 200) }));
rmSync(dir, { recursive: true, force: true });
