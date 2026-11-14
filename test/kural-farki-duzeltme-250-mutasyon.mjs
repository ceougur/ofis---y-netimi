#!/usr/bin/env node
// 2.5.0 Ç5-A tur 2b İş 2 — Kural Farkı Düzeltme Fişi'nin MUTASYON taraması (KANIT KURALI 3, ders 7, 38; C5-ACILIS-TASARIM §17.8): programın ayrı bir kopyasında (ders 23)
// her seferinde TEK bilerek hata açılır, kopyanın test/kural-farki-duzeltme-250.test.mjs dosyası koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI
// (değerle — beklenen satır / durum iletisi); kopya geri yazılır. Bu bir test değildir.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/kural-farki-duzeltme-250-mutasyon.mjs --kopya <git archive kopyası> [--yalniz 1,2]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
const OPEN = "server/lib/ledger-opening.mjs";
const SNAP = "server/lib/ledger-snapshots.mjs";
const ROUTE = "server/routes/ledger.mjs";
const TEST = "test/kural-farki-duzeltme-250.test.mjs";

// [no, ad, dosya, eski, yeni, beklenen neden]
const MUTASYONLAR = [
  [1, "önceki yılın sonuç hesabı da aynı hesapta kalır (yıl yıl eşleme yok)", OPEN, "if (RESULT_CLASSES.has(delta.account[0]) && delta.year !== year)", "if (false)", /fiş satırları: 1–5 birikimli, önceki yılın 602 farkı 681|önceki yılın 602 farkı 681/],
  [2, "671 ↔ 681 ters", OPEN, 'Object.freeze({ debit: "681", credit: "671" })', 'Object.freeze({ debit: "671", credit: "681" })', /önceki yılın 602 farkı 681/],
  [3, "alt defter hesabı farkı fişe girer (dışlama yok)", OPEN, "const owned = account => subledger.has(account);", "const owned = () => false;", /120 farkı dışarıda|bozulan kayıt kaynak listesinde|fiş satırları değişmez/],
  [4, "Düzeltildi fiş toplamına bakmadan verilir", SNAP, "if (numbers.length && diff.count && !remainderMinor && !excludedMinor) {", "if (numbers.length && diff.count) {", /kararı değişen satır: kalan fark|alt defter farkı kaldığı/],
  [5, "sıra zorlaması (B16) kaldırılır", ROUTE, 'else if (candidates) [reason, code] =', 'else if (false) [reason, code] =', /false !== true|rule-diff-candidates|Önce Açılış Olabilir/],
  [6, "kilit bugünken düğme etkin (neden yok)", ROUTE, 'else if (date > today) [reason, code] =', 'else if (false) [reason, code] =', /rule-diff-lock-today|false !== true/],
  [7, "ön izleme imzası denetlenmez", ROUTE, 'if (text(body.digest) !== view.digest) throw', "if (false) throw", /200 !== 409|reddedilen istek fiş yazmaz|iki istek/],
  [8, "fazla düzeltme görünmez", SNAP, "const over = diff.count === 0 && remainderMinor > 0;", "const over = false;", /kilit kalkınca fiş fazla görünür/],
  [9, "kaynak farkının işareti ters (donmuş − güncel)", SNAP, "      put(a, -1);\n      put(b, 1);", "      put(a, 1);\n      put(b, -1);", /fiş satırları: 1–5 birikimli|aynı yıl: açılışların 500'ü 519'a/],
  [10, "kilit + 1 yerine kilit günü", OPEN, "at.setUTCDate(at.getUTCDate() + 1);", "at.setUTCDate(at.getUTCDate());", /fiş tarihi kilit \+ 1|'2026-01-01'|'2026-10-06'/],
];

const results = [];
for (const [no, name, file, from, to, reason] of MUTASYONLAR) {
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
    const run = spawnSync("timeout", ["-k", "5", "900", process.execPath, "--test", TEST], { cwd: COPY, env: { ...process.env, HUKUK_LICENSE_URL: process.env.HUKUK_LICENSE_URL || "http://127.0.0.1:9" }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const out = `${run.stdout || ""}${run.stderr || ""}`;
    const fail = /# fail (\d+)/.exec(out)?.[1] ?? "?";
    const caught = run.status !== 0 && reason.test(out);
    results.push({ no, name, exit: run.status, fail, outcome: caught ? "YAKALANDI" : run.status === 0 ? "SAĞ KALDI" : "KIRMIZI AMA NEDEN BEKLENEN DEĞİL" });
  } finally {
    writeFileSync(target, original);
  }
}
for (const row of results) console.log(`${row.no}. ${row.name}: ${row.outcome}${row.exit === undefined ? "" : ` (çıkış ${row.exit}, kırmızı ${row.fail})`}`);
const bad = results.filter(row => row.outcome !== "YAKALANDI");
console.log(`# mutasyon ${results.length}, yakalanan ${results.length - bad.length}, kaçan ${bad.length}`);
process.exit(bad.length ? 1 : 0);
