// Uzun mutabakat koşusu: npm run test:mutabakat -- --islem 5000 --tohum 7 --her 1 --tohumlar 3
// Geçici bir veritabanında programı başlatır, dört çekirdeği (Kasa, Stok, Cari, Taksit) rastgele ama tekrarlanabilir
// işlemlerle sürer, her işlemden sonra (--her N: her N işlemde bir) bağımsız modelle ve programın mutabakat kapısıyla
// karşılaştırır. Uyuşmazlıkta çıkış kodu 1 ve hangi işlemde, hangi hesapta, ne kadar fark olduğu yazılır.
import { loginAdmin, startTestServer } from "../helpers.mjs";
import { runReconciliation } from "./motor.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const operations = arg("islem", 2000);
const firstSeed = arg("tohum", 1);
const seeds = arg("tohumlar", 1);
const every = arg("her", 1);
const burst = arg("eszamanli", 60);
let failed = 0;
for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
  // bankPickLegacy (2.1.0 Aşama 5–6): motorun havalelerinin bir kısmı eski sürüm gibi hesap seçmeden yazılır (Hesabı Atanmamış). Aşama 7–8: cari
  // tahsilat/ödeme, taksit tahsilatı ve çek tahsilinde havalelerin %60'ı bir hesaba bağlanır; hesap bakiyesi ve K7 (bağlı cari ödemesi) modelde.
  const server = await startTestServer({ bankPickLegacy: true });
  const started = performance.now();
  try {
    const admin = await loginAdmin(server);
    const report = await runReconciliation({ client: admin, seed, operations, verifyEvery: every, burst, log: line => console.log(line) });
    const seconds = (performance.now() - started) / 1000;
    const ms = report.integrityMs.slice().sort((a, b) => a - b);
    console.log(`\nTohum ${seed}: ${report.operations} işlem, ${report.checks} doğrulama, ${report.rejectedAsExpected} beklenen ret (eksiye düşürme / aşım), eşzamanlı ${report.burst?.requests || 0} istek · ${seconds.toFixed(1)} sn`);
    console.log(`  Beklenen retler: ${Object.entries(report.rejections || {}).sort((a, b) => b[1] - a[1]).map(([code, n]) => `${code} ${n}`).join(", ")}`);
    console.log(`  İşlem türleri: ${Object.entries(report.byKind).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    console.log(`  Model: ${JSON.stringify(report.model)}`);
    console.log(`  Fatura: ${JSON.stringify(report.invoices)} · seriler ${JSON.stringify(report.invoiceSeries || {})} · tekil ETTN ${report.ettn ?? "-"}`);
    console.log(`  Mutabakat kapısı süresi: ortanca ${ms[Math.floor(ms.length / 2)] ?? 0} ms, en çok ${ms.at(-1) ?? 0} ms`);
    if (report.mismatches.length) {
      failed += 1;
      console.log(`  ✗ UYUŞMAZLIK (${report.mismatches.length}):`);
      for (const m of report.mismatches.slice(0, 10)) console.log(`    ${m.at}\n      ${m.problems.join("\n      ")}`);
    } else console.log("  ✓ Her işlemden sonra Kasa, cariler, stok, taksit kartları, faturalar, çek/senet ve ana defter kuruşu kuruşuna tutarlı.");
  } finally {
    await server.close();
  }
}
process.exit(failed ? 1 : 0);
