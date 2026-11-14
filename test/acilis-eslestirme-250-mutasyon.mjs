#!/usr/bin/env node
// 2.5.0 Ç5-A tur 2c İş 1 — Açılış Eşleştirme Fişi'nin MUTASYON taraması (KANIT KURALI 3, ders 7, 38; C5-ACILIS-TASARIM §17.10): programın ayrı bir kopyasında (ders 23) her seferinde TEK
// bilerek hata açılır, kopyanın test/acilis-eslestirme-250.test.mjs dosyası koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI (değerle); kopya geri yazılır.
// Bu bir test değildir.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/acilis-eslestirme-250-mutasyon.mjs --kopya <git archive kopyası> [--yalniz 1,2]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
const OPEN = "server/lib/ledger-opening.mjs";
const ROUTE = "server/routes/ledger.mjs";
const GATE = "server/lib/integrity.mjs";
const TEST = "test/acilis-eslestirme-250.test.mjs";

// [no, ad, dosya, eski, yeni, beklenen neden]
const MUTASYONLAR = [
  [1, "izinli hedeflere alt defter hesabı girer (K6 yok)", OPEN, "code !== OPENING_MATCH_ACCOUNT && !subledger.has(code) && !OPENING_MATCH_EXCLUDED.has(code)", "code !== OPENING_MATCH_ACCOUNT && !OPENING_MATCH_EXCLUDED.has(code)", /izinsiz: 1\d\d|hedef 1\d\d/],
  [2, "153 ve brüt gösterim hesapları izinli", OPEN, 'export const OPENING_MATCH_EXCLUDED = Object.freeze(new Set(["136", "153", "159", "198", "340"]));', "export const OPENING_MATCH_EXCLUDED = Object.freeze(new Set());", /izinsiz: (153|340|136)|hedef 153/],
  [3, "519'un ters bakiye denetimi yok", OPEN, "if (after && Math.sign(after) !== Math.sign(balance)) {", "if (false) {", /ters bakiye \(09\.03: 6\.300\)|opening-match-inverse|opening-match-nothing/],
  [4, "aynı günün açılışı gün sonu bakiyesine girmez", OPEN, "if (entry.date > date) continue;", "if (entry.date >= date) continue;", /aynı günün açılışı \(10\.03\) gün sonu bakiyesinde|-630000|aynı gün \(10\.03: 7\.300\)/],
  [5, "519'u büyüten fiş kabul edilir (yön denetimi yok)", OPEN, "if (Math.abs(after) > Math.abs(balance)) {", "if (false) {", /519'u büyütür/],
  [6, "519 karşı satırı ters yönde", OPEN, "const counter = net > 0 ? { account: OPENING_MATCH_ACCOUNT, sub: \"\", debit: 0, credit: net } : { account: OPENING_MATCH_ACCOUNT, sub: \"\", debit: -net, credit: 0 };", "const counter = net > 0 ? { account: OPENING_MATCH_ACCOUNT, sub: \"\", debit: net, credit: 0 } : { account: OPENING_MATCH_ACCOUNT, sub: \"\", debit: 0, credit: -net };", /519 karşı satırı kendiliğinden|voucher-unbalanced|dengede değil/],
  [7, "519 ters bakiye bilgi satırı yok", GATE, "if (match?.inverse) {", "if (false) {", /bilgi satırı:/],
  [8, "bilgi satırı sapma sayılır (ok false)", GATE, 'checks.push({ code: "opening:519-inverse", name: "Eşleştirilecek Açılış Bakiyeleri (519) Eşleştirme Fişlerinin Tersine Geçti", ok: true,', 'checks.push({ code: "opening:519-inverse", name: "Eşleştirilecek Açılış Bakiyeleri (519) Eşleştirme Fişlerinin Tersine Geçti", ok: false,', /bilgi satırı/],
  [9, "ön izleme verisi Muhasebe'ye açık", ROUTE, 'router.get("/api/admin/ledger/opening-match", async ({ req, res, url }) => {\n    auth.requirePermission(req, "system.manage");', 'router.get("/api/admin/ledger/opening-match", async ({ req, res, url }) => {\n    auth.requirePermission(req, "accounts.manage");', /Muhasebe GET/],
  [10, "kilitli tarih denetimi ön izlemede yok", ROUTE, 'if (state.code === "period-locked") throw new HttpError(409,', 'if (false) throw new HttpError(409,', /kilitli tarih ön izleme/],
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
