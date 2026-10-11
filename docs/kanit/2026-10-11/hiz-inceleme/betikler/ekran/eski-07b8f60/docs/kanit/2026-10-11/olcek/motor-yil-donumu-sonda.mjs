// Ölçek veri üretiminde görülen motor uyuşmazlığının yeniden üretimi (TEST ARACI hatası; ürün doğru — kod değiştirilmedi).
// test/mutabakat/motor.mjs "fatura-hatasi/kronoloji": d = kâğıt serisinin son faturasının tarihi − 1..10 gün; model bunu HER ZAMAN "chronology" ile
// reddedilmeli sayar. Program kronolojiyi seri + YIL içinde denetler (server/routes/invoices.mjs assertChronology: WHERE series = ? AND year = ?;
// VUK 231 / GİB: numara her yıl yeniden başlar). Son fatura yeni yılın ilk 10 gününde, d bir önceki yıldaysa program DOĞRU olarak kabul eder
// (FIS<önceki yıl>… numarasıyla), model "reddedilmeliydi" der ve sonraki doğrulamada belge "yetim" görünür.
// Zaman çizelgesi 1 Ocak'ı kesen her koşuda olur: span 365 (bu ölçek aracı) ya da test:mutabakat'ın span 120'si Ocak–Nisan arasında (ders 13).
// Koşu (sabit sahte saat, tarihe bağlı değil): node --disable-warning=ExperimentalWarning docs/kanit/2026-10-11/olcek/motor-yil-donumu-sonda.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const { runReconciliation } = await import(pathToFileURL(path.join(ROOT, "test", "mutabakat", "motor.mjs")).href);
const server = await startTestServer({ bankPickLegacy: true, now: "2026-10-11T06:00:00Z", gateVerify: false });
try {
  const admin = await loginAdmin(server);
  const report = await runReconciliation({ client: admin, seed: 2101, operations: 200, verifyEvery: 50, reportEvery: 0, burst: 40, span: 365 });
  const first = report.mismatches[0];
  console.log(`zaman çizelgesi ${report.timeline.from} → ${report.timeline.to}; uyuşmazlık ${report.mismatches.length}`);
  for (const m of report.mismatches.slice(0, 2)) console.log(`  ${m.at}: ${m.problems.slice(0, 3).join(" | ")}`);
  console.log(first && /kronoloji.*reddedilmesi gerekirken kaydedildi/.test(first.problems.join(" ")) ? "yeniden üretildi (model yıl sınırını bilmiyor)" : "üretilemedi");
} finally {
  await server.close();
}
