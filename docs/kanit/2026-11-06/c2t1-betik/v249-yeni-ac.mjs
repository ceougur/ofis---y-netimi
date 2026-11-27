// Ç2 tur 1 — G6: v2.4.9'un GERÇEK koduyla üretilmiş veri (kopyası) yeni kodla açılır: göç 46 / 47, yeni tetikleyici metni, kilit izi (2.4.9 tanımı = güncel),
// Mutabakat Testi, fiş yazımı (alt defter hesabı 400, serbest hesap 200; çok satırlı fiş), açılış onarımı yok.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node v249-yeni-ac.mjs <yeni kök> <veri klasörü (uret çıktısı)> <iş klasörü>
import { cpSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [ROOT, VERI, WORK] = process.argv.slice(2).map(p => path.resolve(p));
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const { lockDigestOf } = await import(pathToFileURL(path.join(ROOT, "server/lib/integrity.mjs")).href);
const saved = JSON.parse(readFileSync(path.join(VERI, "esdegerlik-saat.json"), "utf8"));
cpSync(path.join(VERI, "data"), path.join(WORK, "data"), { recursive: true });
let tests = 0;
let failed = 0;
const check = (ok, text) => {
  tests += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}`);
};
const server = await startTestServer({ dataDir: path.join(WORK, "data"), backupDir: path.join(WORK, "backups"), bankPickLegacy: true, now: { time: saved.now, fixed: true } });
try {
  const store = server.app.store;
  check(store.get("PRAGMA user_version").user_version === 47, `şema ${store.get("PRAGMA user_version").user_version} (47 bekleniyor); uygulanan göçler ${JSON.stringify(server.app.migration.applied)}`);
  const trig = store.get("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'ledger_voucher_lines_closed'")?.sql || "";
  check(/NEW\.seq > COALESCE/.test(trig) && !/COUNT\(\*\)/.test(trig), "göç 46'nın kurduğu 'kapanmış fiş' tetikleyicisi yeni metin (COUNT(*) yok)");
  check(server.app.context.voucherRepair === null, `açılış onarımı yok (${JSON.stringify(server.app.context.voucherRepair)})`);
  // Motorun koyduğu kilit günleri (veri üretimi sonunda kilit kalkmış olabilir) + bugünkü kilit: iz (güncel tanım) = iz (2.4.9 tanımı) — yeni girdiler satır üretmez.
  const days = [...new Set([...(saved.locks || []), server.app.period.lockedUntil()].filter(Boolean))];
  check(days.length > 0 && days.every(day => lockDigestOf(store, day) === lockDigestOf(store, day, { version: "2.4.9" })), `kilit izi ${days.join(", ")}: güncel tanım = 2.4.9 tanımı`);
  const admin = await loginAdmin(server);
  let scan = (await admin.get("/api/workspace/ledger/integrity")).data.data;
  check(scan.ok === true, `Mutabakat Testi tutarlı (${scan.checks.filter(item => !item.ok).map(item => item.code).join(",")})`);
  const V = server.app.ledger.vouchers;
  const today = server.app.period.today();
  let code = "";
  try {
    V.post({ id: "g6" }, { type: "opening-match", date: today, requestKey: "g6-v249-121-0001", lines: [{ account: "121", debit: 100 }, { account: "519", credit: 100 }] });
  } catch (error) {
    code = `${error.status} ${error.extra?.code}`;
  }
  check(code === "400 voucher-subledger-account", `alt defter hesabı (121) fişi reddedildi: ${code || "KABUL"}`);
  const n = 8000;
  const big = V.post({ id: "g6" }, { type: "opening-match", date: today, requestKey: "g6-v249-buyuk-0001", lines: Array.from({ length: n }, (_, i) => ({ account: i % 2 ? "519" : "590", debit: i % 2 ? 0 : 100, credit: i % 2 ? 100 : 0 })) });
  check(big.lineCount === n, `${n} satırlık fiş eski sürüm verisinde yazıldı (${big.noText})`);
  scan = (await admin.get("/api/workspace/ledger/integrity")).data.data;
  check(scan.ok === true, `fişten sonra Mutabakat Testi tutarlı (${scan.checks.filter(item => !item.ok).map(item => item.code).join(",")})`);
} finally {
  await server.close();
}
console.log(`1..${tests}\n# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}\n# cancelled 0\n# skipped 0\n# todo 0`);
process.exit(failed ? 1 : 0);
