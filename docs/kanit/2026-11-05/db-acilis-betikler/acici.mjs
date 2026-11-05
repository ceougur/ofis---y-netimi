// node acici.mjs <db.mjs yolu> <db> [ro]: openDatabase süresini ve sonucunu JSON yazar; açık tutamak sayısını (Linux /proc/self/fd) ölçer.
import { readdirSync, readlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";
const [lib, file, ro] = process.argv.slice(2);
const { openDatabase } = await import(pathToFileURL(lib).href);
const fds = () => {
  try {
    return readdirSync("/proc/self/fd").filter(fd => {
      try {
        return readlinkSync(`/proc/self/fd/${fd}`).startsWith(file);
      } catch {
        return false;
      }
    }).length;
  } catch {
    return -1;
  }
};
const t0 = Date.now();
try {
  const db = openDatabase(file, { readOnly: ro === "ro" });
  const n = db.prepare("SELECT COUNT(*) AS n FROM t").get().n;
  const ms = Date.now() - t0;
  db.close();
  console.log(JSON.stringify({ ok: true, ms, n, at: Date.now(), fdsAfterClose: fds() }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, ms: Date.now() - t0, code: error.code, errcode: error.errcode, message: error.message, at: Date.now(), fdsAfterFail: fds() }));
}
