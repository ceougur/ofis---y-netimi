// 2.4.8 MZ yan bulgu (Şüpheli Alacak tutar seçimi) — kanıt koşucusu (TEST ARACI; süreç içi sunucu, lisans kapalı, gerçek lisans servisine gitmez).
// Bir kökteki motoru sabit sahte saatle bir tohumla koşar; uyuşmazlık varsa ilkini yazar ve çıkış 1. Özet (işlem türleri, beklenen retler, model)
// JSON satırı olarak yazılır; iki motorun aynı rastgele sırayı izlediği bu özetin aynılığından ve (motor kopyası çekim izliyse) iz özetinden okunur.
//   node --disable-warning=ExperimentalWarning docs/kanit/2026-10-30/248-mz-supheli-kos.mjs <kök> <motor (köke göre)> <saat yyyy-mm-dd> <span> <işlem> <her> <tohum>
// MZ_IZ=<dosya>: motor kopyası globalThis.__trace tutuyorsa ("tür@o ana kadarki çekim sayısı", işlem başına) dosyaya yazılır.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, motor, day, span, ops, every, seed] = process.argv.slice(2);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const { runReconciliation, motorNow } = await import(pathToFileURL(path.join(root, motor)).href);
const [y, m, d] = day.split("-").map(Number);
const server = await startTestServer({ bankPickLegacy: true, now: motorNow(new Date(y, m - 1, d)) });
let code = 0;
try {
  const admin = await loginAdmin(server);
  const report = await runReconciliation({ client: admin, seed: Number(seed), operations: Number(ops), verifyEvery: Number(every), reportEvery: 0, burst: 20, span: Number(span) });
  const first = report.mismatches[0];
  const trace = globalThis.__trace || null;
  if (trace && process.env.MZ_IZ) writeFileSync(process.env.MZ_IZ, `${trace.join("\n")}\n`);
  console.log(`ÖZET ${JSON.stringify({ seed: Number(seed), zaman: report.timeline, islem: report.operations, uyusmazlik: report.mismatches.length, turler: report.byKind, retler: report.rejections, model: report.model, seriler: report.invoiceSeries })}`);
  if (trace) console.log(`İZ ${trace.length} işlem, sha256 ${createHash("sha256").update(trace.join("\n")).digest("hex")}`);
  // Biçim tools/kanit.mjs parseSummary "mutabakat" (test:mutabakat ile aynı): "Tohum n:" + "✓ Her işlemden sonra" ya da "✗ UYUŞMAZLIK".
  console.log(`Tohum ${seed}: ${report.operations} işlem, ${report.checks} doğrulama, ${report.rejectedAsExpected} beklenen ret`);
  if (first) {
    console.log(`  ✗ UYUŞMAZLIK (${report.mismatches.length}): ${first.at}: ${first.problems.join(" | ").slice(0, 600)}`);
    code = 1;
  } else console.log("  ✓ Her işlemden sonra (her N işlemde) model ile program tutarlı; uyuşmazlık yok.");
} finally {
  await server.close();
}
process.exit(code);
