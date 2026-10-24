// Ölçüm (2.4.4 iş listesi 21): programın belge düzeyi stopajı (invoice-math, değişmedi) ile "her kalemin stopajı ayrı yuvarlanıp toplansa" sonucu
// ne sıklıkla ayrışır? Ayrışma, alıcı/EDM satırdan yeniden hesaplarsa resmî makbuz ile defter arasında oluşabilecek farktır. Tohumlu, tekrarlanabilir.
// Kullanım: node docs/kanit/2026-10-22/244-esmm/betikler/stopaj-yuvarlama-olcum.mjs [deneme sayısı]
import { computeInvoice } from "../../../../../server/lib/invoice-math.mjs";
import { stoppageShares } from "../../../../../server/lib/einvoice/ubl-tr.mjs";
const runs = Number(process.argv[2] || 100000);
let seed = 4242;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const byLines = new Map();
let maxDiff = 0;
let shareFail = 0;
for (let run = 0; run < runs; run += 1) {
  const count = 1 + Math.floor(random() * 5);
  const rate = [20, 20, 20, 15, 17.5][Math.floor(random() * 5)];
  const lines = Array.from({ length: count }, () => ({ qty: 1, unitPrice: Math.round(random() * 1000000) / 100 + 0.01, vatRate: 20 }));
  const { lines: out, totals } = computeInvoice(lines, { stoppageRate: rate });
  const perLine = out.reduce((sum, line) => sum + Math.floor((2 * line.net * Math.round(rate * 100) + 10000) / 20000), 0);
  const diff = Math.abs(perLine - totals.stoppage);
  const shares = stoppageShares(out.map(line => line.net), rate, totals.stoppage);
  if (shares.reduce((a, b) => a + b, 0) !== totals.stoppage) shareFail += 1;
  const row = byLines.get(count) || { runs: 0, differ: 0 };
  row.runs += 1;
  if (diff) row.differ += 1;
  byLines.set(count, row);
  maxDiff = Math.max(maxDiff, diff);
}
console.log(`deneme ${runs}, tohum 4242; oranlar %20 (3/5), %15, %17,5; kalem fiyatı 0,01–10.000 TL`);
for (const [count, row] of [...byLines].sort((a, b) => a[0] - b[0])) console.log(`${count} kalem: ${row.runs} makbuz, kalem kalem yuvarlama belge stopajından ${row.differ} makbuzda ayrışıyor (%${((100 * row.differ) / row.runs).toFixed(2)})`);
console.log(`en büyük fark: ${maxDiff} kuruş; en büyük kalan dağıtımında Σ pay ≠ belge stopajı: ${shareFail}`);
