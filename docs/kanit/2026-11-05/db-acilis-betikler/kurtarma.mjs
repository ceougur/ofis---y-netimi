// node kurtarma.mjs <db.mjs yolu> <yineleme> <kip: temiz|kill> [satır] — her yinelemede taze dosya; (kill) yazar SIGKILL ile öldürülür;
// sonra iki süreç aynı anda openDatabase çağırır. Düşen açılışları sayar.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
const [lib, iterations, mode, rows = "5000"] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const run = (args, wantReady) =>
  new Promise(resolve => {
    const proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout.on("data", chunk => {
      out += chunk;
      if (wantReady && out.includes("HAZIR")) resolve(proc);
    });
    proc.once("exit", () => wantReady || resolve(out.trim()));
  });
const tally = { iterations: Number(iterations), mode, rows: Number(rows), openFailures: 0, iterationsWithFailure: 0, errcodes: {}, maxOkMs: 0 };
for (let i = 0; i < Number(iterations); i++) {
  const dir = mkdtempSync(path.join(path.dirname(here), "kurtarma-"));
  const file = path.join(dir, "d.sqlite");
  const init = new DatabaseSync(file);
  init.exec("PRAGMA journal_mode = WAL; CREATE TABLE t(v TEXT); INSERT INTO t(v) VALUES ('x');");
  init.close();
  if (mode === "kill") {
    const writer = await run([path.join(here, "yazici-kill.mjs"), file, rows], true);
    writer.kill("SIGKILL");
    await new Promise(resolve => (writer.exitCode !== null || writer.signalCode ? resolve() : writer.once("exit", resolve)));
  }
  const at = String(Date.now() + 400);
  const results = (await Promise.all([run([path.join(here, "yarisci.mjs"), lib, file, at]), run([path.join(here, "yarisci.mjs"), lib, file, at])])).map(text => JSON.parse(text));
  const failed = results.filter(item => !item.ok);
  tally.openFailures += failed.length;
  if (failed.length) tally.iterationsWithFailure++;
  for (const item of failed) tally.errcodes[item.errcode] = (tally.errcodes[item.errcode] || 0) + 1;
  for (const item of results) if (item.ok) tally.maxOkMs = Math.max(tally.maxOkMs, item.ms);
  rmSync(dir, { recursive: true, force: true });
}
console.log(JSON.stringify(tally));
