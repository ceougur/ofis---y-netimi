// K1 mutasyon denetimi: her mutasyon kaynağa bilerek hata enjekte eder, ilgili testler koşar, kaynak geri yüklenir.
// Kullanım: node mutasyon-k1.mjs <worktree> <çıktı.json>
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2]);
const out = process.argv[3];
const TESTS = ["test/iade-kapama-k1.test.mjs", "test/iade-210.test.mjs", "test/iade-210-onarim.test.mjs", "test/banka-210-rapor-bulgu.test.mjs"];
const MUTATIONS = [
  { id: "M1", ne: "adım R yok (geri ödeme iade belgesinin alacağıyla kapanmaz)", file: "server/lib/invoice-settle.mjs", from: "      if (!item.refundOf) continue;\n      for (const payment of pool) {", to: "      continue;\n      for (const payment of pool) {" },
  { id: "M2", ne: "iadeler bağlı ödemelerle aynı (tarih) sırada mahsup (önce değil sonra kuralı yok)", file: "server/lib/invoice-settle.mjs", from: "if (Boolean(payment.returnId) !== returns) continue;", to: "if (returns) continue;" },
  { id: "M3", ne: "karşı taraftaki bağsız ödeme iade açığını kapatmaz", file: "server/lib/invoice-settle.mjs", from: "const free = pools[other].filter(freeMoney);", to: "const free = [];" },
  { id: "M4", ne: "iade belgesinin açığı hep 0", file: "server/lib/invoice-settle.mjs", from: "    const open = Math.max(0, Math.min(payable, left));\n    out.set(returnId", to: "    const open = 0;\n    out.set(returnId" },
  { id: "M5", ne: "kartın hedefine geri ödeme yine eklenir (ownTarget)", file: "server/routes/invoices.mjs", from: "(legacyClosing ? refundsFor(originalId) : 0)", to: "refundsFor(originalId)" },
  { id: "M6", ne: "Açık Faturalar iade belgesini göstermez", file: "server/routes/report-center.mjs", from: "openItems(day, { returns: true })", to: "openItems(day)" },
  { id: "M7", ne: "retarget geri ödemeyi Mevcut Borç kartının azalışından yine düşer", file: "server/routes/invoices.mjs", from: "let refund = legacyClosing && returnId ? refundOf(returnId) : 0;", to: "let refund = returnId ? refundOf(returnId) : 0;" },
  { id: "M8", ne: "açılış onarımı eski imzalı açıkla (geri ödeme eklenir)", file: "server/routes/invoices.mjs", from: "state.open - state.excess + (legacyClosing ? refunds : 0)", to: "state.open - state.excess + refunds" },
];
const results = [];
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
for (const m of MUTATIONS) {
  const file = path.join(root, m.file);
  const original = readFileSync(file, "utf8");
  const count = original.split(m.from).length - 1;
  if (count !== 1) {
    results.push({ ...m, hata: `kalıp ${count} kez bulundu` });
    continue;
  }
  writeFileSync(file, original.replace(m.from, m.to));
  try {
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...TESTS], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 900_000 });
    const text = `${run.stdout}\n${run.stderr}`;
    const num = key => Number((text.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
    const failed = [...text.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(x => x[1]).filter(name => !/^(K1 —|2\.1\.0 Canlı Hata 2|R1 —)/.test(name));
    results.push({ id: m.id, ne: m.ne, dosya: m.file, cikis: run.status, tests: num("tests"), pass: num("pass"), fail: num("fail"), yakalandi: run.status !== 0 && num("fail") > 0, kirmiziTestler: failed });
  } finally {
    writeFileSync(file, original);
  }
  console.log(`${m.id} ${results.at(-1).yakalandi ? "YAKALANDI" : "YAKALANMADI"} · başarısız ${results.at(-1).fail} · ${m.ne}`);
}
const clean = execFileSync("git", ["status", "--porcelain", "server"], { cwd: root, encoding: "utf8" }).trim();
writeFileSync(out, JSON.stringify({ commit, testler: TESTS, kaynakTemiz: clean === "", sonuclar: results }, null, 2));
console.log(`kaynak geri yüklendi: ${clean === "" ? "evet" : clean}`);
