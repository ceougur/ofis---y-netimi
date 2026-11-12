#!/usr/bin/env node
// 2.5.0 Ç5-A tur 1d — İş A'nın MUTASYON taraması (KANIT KURALI 3, ders 7, 38; C5-ACILIS-TASARIM §14.4 madde 12): programın ayrı bir kopyasında (ders 23) her seferinde TEK
// bilerek hata açılır, kopyanın test/kural-farki-alarm-250.test.mjs dosyası koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI; kopya geri yazılır.
// Bu bir test değildir. Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/kural-farki-alarm-250-mutasyon.mjs --kopya <git archive kopyası> [--yalniz 1,2]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
const INT = "server/lib/integrity.mjs";
const TEST = "test/kural-farki-alarm-250.test.mjs";
const FIX = `const driftsOf = failures => failures.filter(item => !item.notice && item.code !== "ledger:rule-diff");`;
const FRESH = "const fresh = drifts.filter(item => !known.has(signature(item)));";

// [no, ad, dosya, eski, yeni, beklenen neden]
const MUTASYONLAR = [
  [1, "düzeltme geri alınır (kural farkı yine sapma kümesinde)", INT, FIX, "const driftsOf = failures => failures.filter(item => !item.notice);", /kural farkı yeni sapma sayılmamalı|taban satırında kural farkı olmamalı|satır içi ilk taramada bulgu yok|kural farkı bulgu değil/],
  [2, "genişletme: dondurmadan sonra hiçbir şey yeni sapma sayılmaz", INT, FRESH, "const fresh = ledger()?.snapshots?.coverage?.() ? [] : drifts.filter(item => !known.has(signature(item)));", /gerçek sapma yeni sapma olarak bulunmalı|kapı dışı değişimi .* bulunmalı/],
  [3, "genişletme: her uyarı düzeyli denetim (severity: warning) sapma kümesinin dışında", INT, FIX, `const driftsOf = failures => failures.filter(item => !item.notice && item.code !== "ledger:rule-diff" && item.severity !== "warning");`, /kapı dışı değişimi .* bulunmalı|gerçek sapma yeni sapma olarak bulunmalı/],
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
    const run = spawnSync("timeout", ["-k", "5", "600", process.execPath, "--test", TEST], { cwd: COPY, env: { ...process.env, HUKUK_LICENSE_URL: process.env.HUKUK_LICENSE_URL || "http://127.0.0.1:9" }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const out = `${run.stdout || ""}${run.stderr || ""}`;
    const fail = /# fail (\d+)/.exec(out)?.[1] ?? "?";
    const tests = /# tests (\d+)/.exec(out)?.[1] ?? "?";
    const caught = run.status !== 0 && reason.test(out);
    const why = out.split(/\r?\n/).filter(line => /error: /.test(line) && !/subtests failed/.test(line)).slice(0, 2).map(line => line.trim().slice(0, 200)).join(" ‖ ");
    results.push({ no, name, outcome: caught ? "YAKALANDI" : run.status !== 0 ? "KIRMIZI AMA BEKLENEN NEDEN YOK" : "YAŞADI", tests, fail, why });
  } finally {
    writeFileSync(target, original);
  }
}
for (const row of results) console.log(`[mutant ${row.no}] ${row.name} · ${row.outcome}${row.tests ? ` · tests ${row.tests} fail ${row.fail}` : ""}${row.why ? ` · ${row.why}` : ""}`);
const caught = results.filter(row => row.outcome === "YAKALANDI").length;
console.log(`\n[mutasyon özet] ${caught}/${results.length} yakalandı`);
process.exit(caught === results.length ? 0 : 1);
