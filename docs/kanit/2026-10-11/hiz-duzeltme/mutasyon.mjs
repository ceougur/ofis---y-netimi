// Mutasyon kanıtı (CLAUDE.md kanıt kuralı 3 "testin dişi"; ders 23 "eski kod ayrı kopyada"): eşdeğerlik testinin (test/banka-210-hiz-esdegerlik)
// yeni yoldaki bilinçli hataları yakaladığını gösterir. Her mutasyon depo ağacının AYRI bir kopyasında (server, client, test, package.json)
// uygulanır — çalışma ağacı ve commit'ler değişmez. Önce mutasyonsuz kontrol koşusu (yeşil olmalı), sonra her mutasyon (kırmızı olmalı).
// Kullanım: node docs/kanit/2026-10-11/hiz-duzeltme/mutasyon.mjs <kopyaların klasörü> [--json <çıktı>]
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const BASE = path.resolve(process.argv[2] || path.join(ROOT, "..", "mutasyon"));
const jsonAt = process.argv.indexOf("--json");
const OUT = jsonAt >= 0 ? process.argv[jsonAt + 1] : "";
const TEST = "test/banka-210-hiz-esdegerlik.test.mjs";
// İş parçacığı mutasyonları iki testle koşulur (eşdeğerlik testi iş parçacığı yolunu da sınar; ayrıntısı rapor-is-parcacigi testinde).
const TESTS_WORKER = [TEST, "test/banka-210-rapor-is-parcacigi.test.mjs"];
const ML = "server/lib/bank/money-lines.mjs";
const RC = "server/routes/report-center.mjs";
const AC = "server/routes/accounts.mjs";
const RW = "server/lib/report-worker.mjs";
const RR = "server/lib/report-runner.mjs";

const MUTATIONS = [
  { ad: "M0 kontrol (mutasyon yok)", file: "", find: "", replace: "", expect: "yeşil", tests: TESTS_WORKER },
  { ad: "M1 sınıflama: açılış/Devir/aktarma düzeltme sayılmaz (transfer/dış harekete düşer)", file: ML, find: "const adjust = `(${x.src} = 9 AND ${x.base} IN (${ADJUST_SQL}))`;", replace: "const adjust = `(0 = 1)`;" },
  { ad: "M2 sınıflama: gider payının yönü ters (çıkışta eksi ücret)", file: ML, find: "const feeOut = `CASE WHEN ${fee} > 0 THEN", replace: "const feeOut = `CASE WHEN ${fee} < 0 THEN" },
  { ad: "M3 gider payı: gönderen hesap koşulu yok (ücret alıcının bacağına da)", file: ML, find: "w.ref <> '' AND w.ref = ${bank} AND", replace: "w.ref <> '' AND" },
  { ad: "M4 devir sırası: aynı gün başlayan hesapların sırası ters", file: ML, find: "(rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0)", replace: "(rank.get(b.key) ?? 0) - (rank.get(a.key) ?? 0)" },
  { ad: "M5 ileri tarihli hesapsız satır: bugünkü satır da 'tarihi gelmemiş' sayılır", file: ML, find: "w.ref = '' AND w.date > :pday", replace: "w.ref = '' AND w.date >= :pday" },
  { ad: "M6 planlayıcı ipucu: eşitlik koşulunda yalnız ilk değer (cari hareketinde 'out' düşer)", file: ML, find: "`${a}.${column} IN (${values.map(quote).join(\", \")})`", replace: "`${a}.${column} IN (${values.slice(0, 1).map(quote).join(\", \")})`" },
  { ad: "M7 yol itme: kurumsal kart (ccard) havale yöntemine eşlenir", file: ML, find: "bank: [\"bank\"], card: [\"card\"], ccard: [\"card\"] }", replace: "bank: [\"bank\"], card: [\"card\"], ccard: [\"bank\"] }" },
  { ad: "M8 dönem başı devri: dönem başı günü de devre girer (<=)", file: ML, find: "if (before) where.push(`${date} < :before`);", replace: "if (before) where.push(`${date} <= :before`);" },
  { ad: "M9 Banka Hareket Raporu: dönem satırları dönem başından değil bir gün sonradan", file: RC, find: "lines: lines.classified({ ...scope, since: from, until: to }).filter(keep),", replace: "lines: lines.classified({ ...scope, since: from ? `${from.slice(0, 8)}${String(Number(from.slice(8)) + 1).padStart(2, \"0\")}` : from, until: to }).filter(keep)," },
  { ad: "M10 Banka Bakiye Raporu: ileri tarihli grup bakiyeye de eklenir", file: RC, find: "if (Number(item.ahead) === 1) {\n            ahead.count += Number(item.lines);", replace: "if (Number(item.ahead) === 1 && false) {\n            ahead.count += Number(item.lines);" },
  { ad: "M10b Kasa eksi bakiye denetimi: yolun bakiyesi gün sonu yerine bütün tarihler", file: ML, find: "SUM(CASE WHEN w.date <= :day THEN (${signed}) END)", replace: "SUM(CASE WHEN w.date <= '9999-12-31' THEN (${signed}) END)" },
  { ad: "M11 cari arama: tür önceliği (prefer) uygulanmaz", file: AC, find: "if (prefer) matched.sort(", replace: "if (false) matched.sort(" },
  { ad: "M12 cari arama: ilk 20 Cari No sırası yerine ad sırasıyla", file: AC, find: ".sort((a, b) => refCompare(a, b) || byName(a, b));", replace: ".sort((a, b) => byName(a, b));" },
  { ad: "M13 iş parçacığı: ön izleme sınırı TOPLAM'dan önce uygulanır (toplam sayı ve TOPLAM ilk n satırdan)", file: RW, find: "data = await center.run(user, id, new URLSearchParams(query), { inline: true });", replace: "data = await center.run(user, id, new URLSearchParams(query), { inline: true });\n    if (limit) data = { ...data, total: Math.min(data.total, limit) };", tests: TESTS_WORKER },
  { ad: "M14 iş parçacığı: sunucunun (sahte) saati yerine gerçek saat", file: RW, find: "const now = createClock({ time, fixed: true });", replace: "const now = createClock({});", tests: TESTS_WORKER },
  { ad: "M15 iş parçacığı: rapor hatası durum kodunu kaybeder (her hata 500)", file: RR, find: "finish(new HttpError(message?.status || 500,", replace: "finish(new HttpError(500,", tests: TESTS_WORKER },
  { ad: "M16 Kasa eksi bakiye denetimi: yolun bakiyesi iki kez okunur (İ10 gerilemesi)", file: "server/routes/cash.mjs", find: "const totals = lines.wayBalance ? lines.wayBalance(key, day || \"9999-12-31\") :", replace: "const totals = lines.wayBalance ? (lines.wayBalance(key, day || \"9999-12-31\"), lines.wayBalance(key, day || \"9999-12-31\")) :", tests: ["test/inceleme-226-2.test.mjs"] },
];

const results = [];
for (const mutation of MUTATIONS) {
  const dir = path.join(BASE, mutation.ad.split(" ")[0]);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const name of ["server", "client", "test", "package.json"]) cpSync(path.join(ROOT, name), path.join(dir, name), { recursive: true });
  if (mutation.file) {
    const file = path.join(dir, mutation.file);
    const source = readFileSync(file, "utf8");
    const hits = source.split(mutation.find).length - 1;
    if (hits !== 1) throw new Error(`${mutation.ad}: aranan metin ${hits} kez bulundu (1 olmalı)`);
    writeFileSync(file, source.replace(mutation.find, mutation.replace));
  }
  const started = Date.now();
  const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...(mutation.tests || [TEST])], { cwd: dir, encoding: "utf8", timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });
  const output = `${run.stdout || ""}${run.stderr || ""}`;
  writeFileSync(path.join(BASE, `${mutation.ad.split(" ")[0]}.log`), output);
  const count = name => Number((output.match(new RegExp(`^# ${name} (\\d+)`, "m")) || [])[1] ?? NaN);
  const failed = [...output.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(match => match[1]).filter(name => !/^(hız düzeltmesi eşdeğerliği|Banka raporlarının iş parçacığı)/.test(name));
  // Kurulum kancası (before) düşerse alt testler "cancelled" sayılır (fail 0): o da kırmızıdır (ör. M1'i mutabakat motorunun kendi banka raporu
  // denetimi veri üretirken yakalar). Nedeni (ilk hata) kayda yazılır.
  const hook = (output.match(/failureType: 'hookFailed'\s+error: \|-\s+([^\n]+)/) || [])[1] || "";
  const row = { ad: mutation.ad, beklenen: mutation.expect || "kırmızı", cikis: run.status, tests: count("tests"), pass: count("pass"), fail: count("fail"), cancelled: count("cancelled"), sn: Math.round((Date.now() - started) / 1000), kirmiziTestler: failed.slice(0, 6), ...(hook ? { kancaHatasi: hook.trim() } : {}) };
  row.sonuc = (row.beklenen === "yeşil" ? run.status === 0 && row.fail === 0 && row.cancelled === 0 && row.tests > 0 : run.status !== 0 && (row.fail > 0 || row.cancelled > 0)) ? "BEKLENDİĞİ GİBİ" : "BEKLENMEYEN";
  results.push(row);
  console.log(`${row.sonuc.padEnd(17)} ${row.ad} · çıkış ${row.cikis} · tests ${row.tests} pass ${row.pass} fail ${row.fail} cancelled ${row.cancelled} · ${row.sn} sn${hook ? ` · kanca: ${hook.trim().slice(0, 80)}` : ""}${failed.length ? ` · kırmızı: ${failed.slice(0, 3).join(" | ")}` : ""}`);
  rmSync(dir, { recursive: true, force: true });
}
if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 1));
const bad = results.filter(row => row.sonuc !== "BEKLENDİĞİ GİBİ");
console.log(`\n${results.length - bad.length} mutasyon beklendiği gibi, ${bad.length} beklenmeyen`);
process.exitCode = bad.length ? 1 : 0;
