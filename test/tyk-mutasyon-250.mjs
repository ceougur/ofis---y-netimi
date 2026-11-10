#!/usr/bin/env node
// 2.5.0 Ç5-B — TYK mutasyon testi (KANIT KURALI 3; ders 7): her kararın KARŞI seçeneği ve sınır kayması lib/obligation-queue.mjs'in AYRI kopyasına (ders 23, 25) enjekte edilir;
// test/tyk-250.test.mjs her mutantta KIRMIZI olmalı. Kullanım: node test/tyk-mutasyon-250.mjs [--klasor <boş geçici klasör>]
// Çıkış 0 yalnız bütün mutantlar öldüyse. Yük koşusudur: `flock -s scratchpad/olcum.lock` ile başlatılır (ders 52).
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const base = path.resolve(argv.includes("--klasor") ? argv[argv.indexOf("--klasor") + 1] : path.join(tmpdir(), `tyk-mutasyon-${process.pid}`));
const SOURCE = readFileSync(path.join(ROOT, "server/lib/obligation-queue.mjs"), "utf8");
// [kimlik, karar, eski metin, yeni metin]
const MUTANTS = [
  ["M01", "karar (1) B — havuz (ödeme sonradan doğan borca kayar)", "a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.cls !== b.cls ? a.cls - b.cls", "a.cls !== b.cls ? a.cls - b.cls\n  : a.date !== b.date ? (a.date < b.date ? -1 : 1)"],
  ["M02", "S2 B — belge tarihi sırası", "a.vade !== b.vade ? (a.vade < b.vade ? -1 : 1)\n  : a.date !== b.date", "a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.vade !== b.vade"],
  ["M03", "karar (2) B — bağ önceliği yok (bağlı ödeme bağsız gibi)", "  invoiceLinks(3);\n", "\n"],
  ["M04", "M1f B — vade günü gecikmiş", "item.side === \"receivable\" && item.vade < day", "item.side === \"receivable\" && item.vade <= day"],
  ["M05", "S1 B — vadesiz kalem gecikmez", "byId.get(line.sourceId)?.dueDate || line.date : kind === \"entry\" ? dueDates.get(line.id) || line.date", "byId.get(line.sourceId)?.dueDate || \"9999-12-31\" : kind === \"entry\" ? dueDates.get(line.id) || \"9999-12-31\""],
  ["M06", "S50 B — kart seçilmeden alınan tahsilat taksit kapatmaz", "        if (mode === \"side\" && other.linkedOnly) continue;\n", "        if (mode === \"side\" && other.linkedOnly) continue;\n        if (other.kind === \"installment\" || item.kind === \"installment\") continue;\n"],
  ["M07", "M1e B — Mevcut Borç kartı alttaki borcu tüketmez (çift sayım)", "  const coverEvent = card => {\n", "  const coverEvent = card => {\n    return;\n"],
  ["M08", "karar (5) B — net görünüm yok (yalnız Mahsup Et'le)", "const net = runQueue(input, \"net\", pieces);", "const net = runQueue(input, \"side\", pieces);"],
  ["M09", "S11 B — kilitli dönemde alınan evrakın karşılıksızı yine netleşir", "    if (lock && reversed.date <= lock) continue; // S11 / S18 / S19: kapanış değişmez, karşılıksız ayrı borç\n", "\n"],
  ["M10", "S19 B — karar güncel kilitle (yazım anındaki değil)", "    const lock = lockAt(bounce.at);", "    const lock = lockAt(\"9999-12-31T00:00:00Z\");"],
  ["M11", "M13 B — şüpheli kuyruğu gecikmişe girer", "item.vade < day && item.remaining - item.doubtful > 0.005);\n    const amount = roundMoney(list.reduce((sum, item) => sum + item.remaining - item.doubtful, 0));", "item.vade < day && item.remaining > 0.005);\n    const amount = roundMoney(list.reduce((sum, item) => sum + item.remaining, 0));"],
  ["M12", "karar (1) aynı gün B — önce ödeme sonra borç", "  : a.cls !== b.cls ? a.cls - b.cls", "  : a.cls !== b.cls ? b.cls - a.cls"],
  ["M13", "karar (3) B — kilitli dönem bağı yeniden açar", "      if (lock && target.date <= lock) {\n        if (lockCaps?.has(link.id))", "      if (false) {\n        if (lockCaps?.has(link.id))"],
  // M14: kayıt anı yerine GİRDİ sırası (ders 31) — yalnız s2'den kayıt anını çıkarmak eşdeğer mutanttır (yazım sırası zaten tarih + kayıt anıyla kurulur): s2, olay sırası
  // ve yazım sırası birlikte girdiden.
  ["M14", "S2 eşitlik B — kayıt anı yerine girdi sırası (ders 31)", [
    ["  : a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.at !== b.at ? (a.at < b.at ? -1 : 1)\n  : a.rank", "  : a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.rank"],
    ["  : a.cls !== b.cls ? a.cls - b.cls\n  : a.at !== b.at ? (a.at < b.at ? -1 : 1)\n  : a.rank", "  : a.cls !== b.cls ? a.cls - b.cls\n  : a.rank"],
    ["  const rank = new Map(sorted.map((line, index) => [line.id, index]));\n  const kindOf", "  const rank = new Map(lines.map((line, index) => [line.id, index]));\n  const kindOf"],
  ]],
  ["M15", "Y3-1 / S69 B — gün sayısı her zaman sözden", "const from = promise && promise < vade ? promise : vade;", "const from = promise || vade;"],
  ["M16", "S67 B — takvim durumu söz tarihine göre", "  if (vade < day) {\n    const from", "  if (false) {\n    const from"],
  ["M17", "K8-3 B — yalnız vadesi gelmiş taksit kapanır", "        if (mode === \"side\" && other.linkedOnly) continue;\n", "        if (mode === \"side\" && other.linkedOnly) continue;\n        if ((other.kind === \"installment\" && other.vade >= item.born) || (item.kind === \"installment\" && item.vade >= other.born)) continue;\n"],
  ["M18", "K8-3 / M1e B — Mevcut Borç kartı en yeni borçtan (eski kural)", "    pool.sort(s2);\n    // Kartın tüketebileceği", "    pool.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));\n    // Kartın tüketebileceği"],
  ["M19", "S2 sınır kayması — eşit vadede belge tarihi tersten", "  : a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.at !== b.at", "  : a.date !== b.date ? (a.date < b.date ? 1 : -1)\n  : a.at !== b.at"],
  ["M20", "M1e B — kart tahsilatı en geç vadeli taksitten", "    const ordered = [...card.installments].sort(s2);", "    const ordered = [...card.installments].sort(s2).reverse();"],
  ["M21", "v2.0.23 B — karttan SONRA kaydedilen borç da kapsanır", "      if (card.at && target.recorded && target.recorded > card.at) continue;\n", "\n"],
  ["M22", "kart kapsamı B — kartın anındaki bilinen satırlar okunmaz (sonraki karşılıksız kapsamı değiştirir)", "  const forced = coverForcing(input, mode, pieces);", "  const forced = null;"],
  ["M23", "kart açılışı gün sınıfı B — aynı gün karttan önce yazılan ödeme karttan sonra sayılır", "events.push({ type: \"cover\", card, date: card.date, cls: 2,", "events.push({ type: \"cover\", card, date: card.date, cls: 1,"],
  ["M24", "gecikmiş B — yalnız yükümlülük rolü (netleşmemiş bağsız ödeme açık borç kalemi sayılmaz)", "item => item.side === \"receivable\" && item.vade < day", "item => item.due && item.side === \"receivable\" && item.vade < day"],
  // Ç5-B birleşim düzeltmesi (mutabakat yıl dönümü tohum 39): fatura durumunda karar (3)'ün kilit ölçümü taksitli faturanın kendi kartını "bağsız kapanmış" saymaz.
  ["M25", "birleşim düzeltmesi geri — G2 kilit ölçümü taksitli faturanın kendi kartının bağsız kapanışını sayar (kart tahsilatı faturayı kapatmaz)", "const closedByL = target && !(mode === \"side\" && target.ownCard) ?", "const closedByL = target ?"],
  ["M26", "istisna iki görünümde — net görünümde de karar (3) kart tahsilatını kesmez (taksit yeniden açılır)", "const closedByL = target && !(mode === \"side\" && target.ownCard) ?", "const closedByL = target && !target.ownCard ?"],
  ["M27", "istisna ters görünümde — yalnız net görünümde", "const closedByL = target && !(mode === \"side\" && target.ownCard) ?", "const closedByL = target && !(mode === \"net\" && target.ownCard) ?"],
  ["M28", "v2.0.24 B — fatura durumu taksitli faturanın bağsız kapanışını da sayar (açık ≠ kartın kalanı)", "const linkedLeft = item => Math.max(0, item.amount - item.closures.filter(c => !c.reverse && c.mode !== \"auto\" && c.mode !== \"locked\").reduce((sum, c) => sum + c.amount, 0));", "const linkedLeft = item => Math.max(0, item.left);"],
];
rmSync(base, { recursive: true, force: true });
let killed = 0;
const rows = [];
for (const [id, label, from, to] of MUTANTS) {
  const pairs = Array.isArray(from) ? from : [[from, to]];
  let mutated = SOURCE;
  const bad = pairs.map(([a]) => SOURCE.split(a).length - 1).find(count => count !== 1);
  if (bad !== undefined) {
    rows.push(`${id} ENJEKTE EDİLEMEDİ (${bad} eşleşme) — ${label}`);
    continue;
  }
  for (const [a, b] of pairs) mutated = mutated.replace(a, b);
  const dir = path.join(base, id);
  mkdirSync(path.join(dir, "server/lib"), { recursive: true });
  mkdirSync(path.join(dir, "test"), { recursive: true });
  for (const file of ["money.mjs", "invoice-settle.mjs"]) cpSync(path.join(ROOT, "server/lib", file), path.join(dir, "server/lib", file));
  writeFileSync(path.join(dir, "server/lib/obligation-queue.mjs"), mutated);
  cpSync(path.join(ROOT, "test/tyk-250.test.mjs"), path.join(dir, "test/tyk-250.test.mjs"));
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module" }));
  const run = spawnSync(process.execPath, ["--test", path.join(dir, "test/tyk-250.test.mjs")], { cwd: dir, encoding: "utf8", timeout: 120_000 });
  const fail = Number((run.stdout.match(/^# fail (\d+)/m) || [])[1] || 0);
  const pass = Number((run.stdout.match(/^# pass (\d+)/m) || [])[1] || 0);
  const failed = [...run.stdout.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map(m => m[1]).filter(name => !/^TYK — /.test(name)).slice(0, 3);
  const dead = run.status !== 0 && fail > 0;
  if (dead) killed += 1;
  rows.push(`${id} ${dead ? "ÖLDÜ" : "YAŞADI"} (pass ${pass}, fail ${fail}) — ${label}${dead ? ` · öldüren: ${failed.join(" | ").slice(0, 300)}` : ""}`);
}
rmSync(base, { recursive: true, force: true });
for (const row of rows) console.log(row);
console.log(`# tests ${MUTANTS.length}\n# pass ${killed}\n# fail ${MUTANTS.length - killed}`);
process.exitCode = killed === MUTANTS.length ? 0 : 1;
