#!/usr/bin/env node
// 2.5.0 Ç7b tur 2f — kitap türetme kurallarının (fatura / KDV / taksit / kayıt / Kasa) MUTASYON taraması (KANIT KURALI 3, ders 7, 20, 38; docs/devir/2.5.0-DEVAM/c7b2-istem.txt 'Kanıt').
// Programın ayrı bir kopyasında (ders 23 — `git worktree add --detach`: test/c7b-eski-surum-sinif-250 v2.4.9 etiketini ister, ders 54) her seferinde TEK bilerek hata açılır, o mutantın
// testi koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (değerle — beklenen satır / toplam iletisi) varsa YAKALANDI; kopya geri yazılır. Bu bir test değildir.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/c7b-kabul-250-mutasyon.mjs --kopya <worktree kopyası> [--yalniz 1,2]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
const GL = "server/lib/general-ledger.mjs";
const TAX = "server/routes/tax.mjs";
const SHIFT = "server/lib/ledger-rule-shift.mjs";
const D = "test/c7b-eski-surum-sinif-250.test.mjs";
const F = "test/c7b-degismez-250.test.mjs";
const KITAP = "test/c7b-kitap-turetme-250.test.mjs";
const KART = "test/c7b-kart-kapat-onay-250.test.mjs";
const DIFF = /madde sayısı|fark doğuran maddeler/;

// [no, ad, dosya, eski, yeni, test, beklenen neden]
const MUTASYONLAR = [
  [1, "gider türünü yok say → hep 770 (M14 / F-06)", "server/lib/invoice-math.mjs", 'return EXPENSES[expenseCode]?.account || "770";', 'return "770";', KITAP, /F-06: 770 \/ 760 \/ 255/],
  [2, "belgesizde KDV ayır (veresiye satışın 1/6'sı 391'e; KG-2 'KDV ayrılmaz')", GL, 'post(id, row.date, "Stok (veresiye satış)", row.note, control, UNCLASSIFIED_GL.sale, row.amount);', '(post(id, row.date, "Stok (veresiye satış)", row.note, control, UNCLASSIFIED_GL.sale, row.amount - Math.round(row.amount / 6)), post(`${id}:kdv`, row.date, "Stok (veresiye satış)", row.note, control, "391", Math.round(row.amount / 6)));', F, /600\.90 = belgesiz satış|Kapı eşdeğerlik ihlali.*gl:391/],
  [3, "belgesiz satışın .90 alt hesabı düşer (KG-2)", GL, 'sale: Object.freeze({ account: "600", sub: "600.90" }),', 'sale: "600",', D, DIFF],
  // 4: yazım yolunda programın kendi kapısı (gateVerify) reddeder — fark DEĞERLE (gl:336, beklenen −tutar ↔ defter 0); kapı geçseydi 336.90 denetimi yakalardı.
  [4, "kayıt tahsilatını 649'a yaz (KG-3)", GL, "UNCLASSIFIED_GL.collection, row.amount);", '"649", row.amount);', F, /336\.90 = kayıt tahsilatları|Kapı eşdeğerlik ihlali.*\(gl:336\).*"ledger":0,"subledger":-/],
  [5, "601 ↔ 600 (KG-24 ihracat ana hesapta)", GL, 'export const EXPORT_SALES_GL = "601";', 'export const EXPORT_SALES_GL = "600";', D, DIFF],
  [6, "satıştan iade KDV'si hep 391 (KG-8 yok)", GL, '{ account: oldReturnVat(shift, row.date) ? "391" : "191", side: "debit"', '{ account: "391", side: "debit"', D, /ters kayıttan sonra SR3 B 191/],
  [7, "alıştan iade KDV'si hep 191 (F-08 yok)", GL, '{ account: oldReturnVat(shift, row.date) ? "191" : "391", side: "credit"', '{ account: "191", side: "credit"', D, /PR3 A 391 \(F-08\)/],
  [8, "S4: mahsubu yapılmış aydan çıkan (AZALTAN) fark sonraki mahsuba taşınmaz", TAX, "const carried = Math.min(0, carriedBefore(table, active, month));", "const carried = 0;", D, /Kasım H 300 \/ İ 200/],
  [9, "KDV İndirim Dönemi'ni yok say (KG-7 → hep belge ayı)", TAX, "const period = periods.get(entry.id) || month;", "const period = month;", D, /Kasım H 300 \/ İ 200/],
  [10, "eski onayla Kartı Kapat kabul edilir (YB-1)", "server/routes/plans.mjs", "if (Math.round(current * 100) !== Math.round((Number(body.closeRemaining) || 0) * 100)) {", "if (false) {", KART, /expected: 409|plan-close-stale/],
  [11, "carisiz Kasa girişi 649 ana hesapta (K-01 / 649.90 yok)", GL, "cashIn: FREE_DOCUMENT_GL.received,", 'cashIn: "649",', D, DIFF],
  [12, "Borç Yaz 602 ana hesapta (C-01 / KG-4 yok)", GL, 'debtWrite: Object.freeze({ account: "602", sub: "602.90" }),', 'debtWrite: "602",', D, DIFF],
  [13, "taksit Yeni Borç 602'de kalır (H-03 / KG-2 yok)", GL, "UNCLASSIFIED_GL.sale, plan.total);", '"602", plan.total);', F, /600\.90 = belgesiz satış/],
  [14, "eski KDV mahsubunun işareti yok sayılır (B-6)", SHIFT, 'return Boolean(months?.size) && months.has(String(date || "").slice(0, 7));', "return false;", D, /B-6: Ekim mahsubu eski → SR3 B 391/],
  [15, "kural geçiş günü yok sayılır (B-8; hep yeni yön)", SHIFT, 'return Boolean(through) && String(date || "") <= through;', "return false;", D, /madde sayısı|Mutabakat Testi|Defter Mutabakatı|geçiş gününden önceki kayıt tahsilatı/],
  [16, "Defter Mutabakatı 336 beklenenine kayıt tahsilatları katılmaz (B-2)", "server/routes/ledger.mjs", 'if (has("payments")) out[336] = roundMoney(', 'if (false) out[336] = roundMoney(', F, /Defter Mutabakatı/],
];

const results = [];
for (const [no, name, file, from, to, test, reason] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  const target = path.join(COPY, file);
  const original = readFileSync(target, "utf8");
  const count = original.split(from).length - 1;
  if (count !== 1) {
    results.push({ no, name, outcome: `UYGULANAMADI (eşleşme ${count})` });
    continue;
  }
  writeFileSync(target, original.replace(from, to));
  try {
    const run = spawnSync("timeout", ["-k", "5", "900", process.execPath, "--test", test], { cwd: COPY, env: { ...process.env, HUKUK_LICENSE_URL: process.env.HUKUK_LICENSE_URL || "http://127.0.0.1:9" }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const out = `${run.stdout || ""}${run.stderr || ""}`;
    const tests = /# tests (\d+)/.exec(out)?.[1] ?? "?";
    const fail = /# fail (\d+)/.exec(out)?.[1] ?? "?";
    const caught = run.status !== 0 && reason.test(out);
    results.push({ no, name, test: path.basename(test), exit: run.status, tests, fail, outcome: caught ? "YAKALANDI" : run.status === 0 ? "SAĞ KALDI" : "KIRMIZI AMA NEDEN BEKLENEN DEĞİL" });
  } finally {
    writeFileSync(target, original);
  }
}
for (const row of results) console.log(`${row.no}. ${row.name}: ${row.outcome}${row.exit === undefined ? "" : ` (${row.test}; çıkış ${row.exit}, test ${row.tests}, kırmızı ${row.fail})`}`);
const bad = results.filter(row => row.outcome !== "YAKALANDI");
console.log(`# mutasyon ${results.length}, yakalanan ${results.length - bad.length}, kaçan ${bad.length}`);
process.exit(bad.length ? 1 : 0);
