// Ders 20 — CI 565 (c8d596b) Linux Node 24: mutabakat-cekirdek tohum 2, 23:59:56 UTC'de başlayıp 00:00:00'da kırmızı. Ön koşul zorla:
// sunucunun sahte saati gece yarısına SANIYE kala akar; motor "bugün"ü (T) başta bir kez okur. Kullanım: node test/mutabakat-gece-yarisi.mjs [saniye] [tohum]
import { runReconciliation } from "./mutabakat/motor.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
const lead = Number(process.argv[2] || 3) * 1000;
const seed = Number(process.argv[3] || 2);
const d = new Date();
const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime() - lead;
const server = await startTestServer({ bankPickLegacy: true, now: start });
let code = 0;
try {
  const admin = await loginAdmin(server);
  const before = server.clock.today();
  const report = await runReconciliation({ client: admin, seed, operations: 300, burst: 40, reportEvery: 60 });
  const after = server.clock.today();
  console.log(`ön koşul: gün ${before} → ${after} (${before !== after ? "GERÇEKLEŞTİ" : "GERÇEKLEŞMEDİ"})`);
  console.log(`uyuşmazlık: ${report.mismatches.length}`);
  if (report.mismatches.length) console.log(JSON.stringify(report.mismatches.slice(0, 3), null, 1).slice(0, 3000));
  code = before === after ? 2 : report.mismatches.length ? 1 : 0;
} finally {
  await server.close();
}
process.exit(code);
