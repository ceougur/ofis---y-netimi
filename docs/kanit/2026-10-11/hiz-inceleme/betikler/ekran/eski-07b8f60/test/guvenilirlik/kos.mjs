// Uzun rastgele sıra koşusu (2.0.21): npm run test:guvenilirlik -- --islem 3000 --tohum 7 --tohumlar 3 --taban surum-2.0.19-zincir
//   --islem N       her tohumda işlem sayısı (varsayılan 1000)
//   --tohum N       ilk tohum (varsayılan 1); --tohumlar K: ardışık K tohum
//   --taban ad      "bos" (boş kurulum) ya da bir sürüm fikstürü (ör. surum-2.0.19-zincir: gerçek v2.0.19 verisi); "hepsi" ikisi
//   --her N         değişmez kurallar her N işlemde bir (varsayılan 1: her işlemden sonra)
// Uyuşmazlıkta çıkış kodu 1; tohum ve bütün işlem günlüğü yazılır (aynı tohumla aynı sıra yeniden üretilir).
import { runRandom } from "./rastgele.mjs";

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const operations = Number(arg("islem", 1000));
const firstSeed = Number(arg("tohum", 1));
const seeds = Number(arg("tohumlar", 1));
const every = Number(arg("her", 1));
const baseArg = arg("taban", "hepsi");
const bases = baseArg === "hepsi" ? ["bos", "surum-2.0.19-zincir"] : [baseArg];
let failed = 0;
for (const base of bases) {
  for (let seed = firstSeed; seed < firstSeed + seeds; seed += 1) {
    try {
      const report = await runRandom({ seed, operations, base, verifyEvery: every, log: line => console.log(line) });
      console.log(`\n✓ Tohum ${seed} · taban ${base}: ${report.operations} işlem, ${report.checks} değişmez kural turu, ${report.backups} yedek, ${report.restores} geri yükleme, ${report.wrongRestores} yanlış şirkete deneme (hepsi 409), ${report.restarts} yeniden başlatma · ${(report.ms / 1000).toFixed(1)} sn`);
      console.log(`  İşlem türleri: ${Object.entries(report.byKind).map(([kind, n]) => `${kind} ${n}`).join(", ")}`);
      console.log(`  Son durum: ${report.companies.join(" | ")}`);
    } catch (error) {
      failed += 1;
      console.log(`\n✗ ${error.message}`);
      if (error.opLog) console.log(`\nBütün işlem günlüğü:\n${error.opLog.join("\n")}`);
    }
  }
}
process.exit(failed ? 1 : 0);
