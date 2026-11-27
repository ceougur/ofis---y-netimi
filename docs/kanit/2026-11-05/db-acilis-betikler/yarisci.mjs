// node yarisci.mjs <db.mjs yolu> <db> <başlamaAnıMs> — o ana kadar meşgul bekler, openDatabase + bir yazma; sonucu JSON yazar.
import { pathToFileURL } from "node:url";
const [lib, file, at] = process.argv.slice(2);
const { openDatabase } = await import(pathToFileURL(lib).href);
while (Date.now() < Number(at)) {
  // iki süreç aynı anda
}
const t0 = Date.now();
try {
  const db = openDatabase(file);
  db.exec("INSERT INTO t(v) VALUES ('y')");
  db.close();
  console.log(JSON.stringify({ ok: true, ms: Date.now() - t0 }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, ms: Date.now() - t0, errcode: error.errcode, message: error.message }));
}
