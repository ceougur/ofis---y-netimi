// 2.4.8 MZ — yıl dönümü testinin tohum araması (TEST ARACI; ürün koşmaz, gerçek lisans servisine gitmez: startTestServer süreç içi, lisans kapalı).
// Bir motor kopyasını (kök) sabit sahte saatle koşar; her tohum için uyuşmazlık sayısını, ilk uyuşmazlığı ve motorun yıl dönümü sayaçlarını
// (report.yilDonumu; eski motorda yok → null) tek JSON satırı yazar. Sonuçlar: 248-mz-tohum-arama.txt.
//   node --disable-warning=ExperimentalWarning docs/kanit/2026-10-30/248-mz-tohum-ara.mjs <kök> <saat günü yyyy-mm-dd> <span> <işlem> <her> <tohum1,tohum2,…>
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, day, span, ops, every, seeds] = process.argv.slice(2);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const { runReconciliation, motorNow } = await import(pathToFileURL(path.join(root, "test", "mutabakat", "motor.mjs")).href);
const [y, m, d] = day.split("-").map(Number);
for (const seed of seeds.split(",").map(Number)) {
  const t0 = performance.now();
  const server = await startTestServer({ bankPickLegacy: true, now: motorNow(new Date(y, m - 1, d)) });
  try {
    const admin = await loginAdmin(server);
    const report = await runReconciliation({ client: admin, seed, operations: Number(ops), verifyEvery: Number(every), reportEvery: 0, burst: 20, span: Number(span) });
    const first = report.mismatches[0];
    console.log(JSON.stringify({ seed, sn: Math.round((performance.now() - t0) / 1000), zaman: report.timeline, uyusmazlik: report.mismatches.length, ilk: first ? `${first.at}: ${first.problems.join(" | ").slice(0, 300)}` : "", yil: report.yilDonumu ?? null, seriler: report.invoiceSeries }));
  } finally {
    await server.close();
  }
}
