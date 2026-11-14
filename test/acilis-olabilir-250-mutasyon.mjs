#!/usr/bin/env node
// 2.5.0 Ç5-A tur 2c İş 3 — Açılış Olabilir Kayıtlar uçlarının MUTASYON taraması (KANIT KURALI 3, ders 7, 38; C5-ACILIS-TASARIM §17.10): programın ayrı bir kopyasında (ders 23)
// her seferinde TEK bilerek hata açılır, kopyanın test/acilis-olabilir-250.test.mjs dosyası koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI (değerle);
// kopya geri yazılır. Bu bir test değildir. Kopyada eski sürüm etiketi için GIT_DIR verilir (salt okuma).
// Kullanım: GIT_DIR=<depo>/.git HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/acilis-olabilir-250-mutasyon.mjs --kopya <git archive kopyası> [--yalniz 1,2]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
const OPEN = "server/lib/ledger-opening.mjs";
const ROUTE = "server/routes/opening-review.mjs";
const LEDGER = "server/routes/ledger.mjs";
const TEST = "test/acilis-olabilir-250.test.mjs";

// [no, ad, dosya, eski, yeni, beklenen neden]
const MUTASYONLAR = [
  [1, "toplu kararda listede olmayan kimlik atlanır (yarım toplu karar)", OPEN, "if (result.status !== 200) return { status: result.status, missing: id };", "if (result.status !== 200) continue;", /listede olmayan kimlik: ilk kimliğin kararı da geri alındı|404 !== 200|200 !== 404/],
  [2, "geri al ret yazar", OPEN, 'decision === "undo" ? OPENING_REVIEW.candidate', 'decision === "undo" ? OPENING_REVIEW.rejected', /'rejected'/],
  [3, "kilitli dönemdeki aday sayısı tarihe bakmaz", OPEN, "WHERE e.opening_review = 'candidate' AND e.date <= ?\", locked)", "WHERE e.opening_review = 'candidate' AND ? <> ''\", locked)", /lockedCandidate/],
  [4, "sayfalama başlangıcı yok sayılır", OPEN, "[limit, Math.max(0, Math.trunc(Number(offset) || 0))]", "[limit, 0]", /sayfalar sıralı listeyi eksiksiz, tekrarsız böler/],
  [5, "toplu karar yetkisi görme yetkisine düşer", ROUTE, 'router.post("/api/workspace/opening-review", async ({ req, res }) => {\n    const user = auth.requirePermission(req, "accounts.manage");', 'router.post("/api/workspace/opening-review", async ({ req, res }) => {\n    const user = auth.requirePermission(req, "accounts.view");', /toplu/],
  [6, "toplu karar yinelenen kimliği iki kez sayar", OPEN, "for (const id of [...new Set(ids.map(String))]) {", "for (const id of ids.map(String)) {", /yinelenen kimlik bir kez|kimlik/],
  [7, "Kural Farkı nedeni aday ekranının yerini söylemez (eski metin)", LEDGER, "(Yönetim › Sistem › Açılış Olabilir Kayıtlar).`", "(Cariler › Açılış Olabilir Kayıtlar).`", /Yönetim › Sistem › Açılış Olabilir Kayıtlar/],
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
