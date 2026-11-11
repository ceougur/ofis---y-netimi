#!/usr/bin/env node
// 2.5.0 Ç5-A tur 1 — açılış düzeninin MUTASYON taraması (KANIT KURALI 3, ders 7, 38; C5-ACILIS-TASARIM §5 karşı mutantlar): programın ayrı bir kopyasında (ders 23) her seferinde
// TEK bilerek hata açılır, kopyanın test/acilis-519-250.test.mjs dosyası koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI; kopya geri yazılır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/acilis-519-250-mutasyon.mjs --kopya <git archive HEAD kopyası> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
const GL = "server/lib/general-ledger.mjs";
const OPEN = "server/lib/ledger-opening.mjs";
const MIG = "server/lib/migrations.mjs";
const VOUCHER = "server/lib/bank/voucher.mjs";
const CHEQ = "server/routes/cheques.mjs";
const INT = "server/lib/integrity.mjs";
const TEST = "test/acilis-519-250.test.mjs";
// Ç5-A tur 1b (C5-ACILIS-TASARIM §12): S127 (v2.4.9 gerçek koduyla üretilmiş kilitli fikstür) ve carisiz evrak yaşlandırması.
const S127 = "test/s127-tek-kez-250.test.mjs";
const AGING = "test/yaslandirma-carisiz-evrak-250.test.mjs";
const RC = "server/routes/report-center.mjs";

// [no, ad, dosya, eski, yeni, koşulacak testler, beklenen neden]
const MUTASYONLAR = [
  [1, "Kasa açılışı 500'e döner (M-01)", GL, `post(\`cash:\${row.id}\`, row.date, "Kasa açılışı", row.description, moneyOf(row), OPENING_GL, row.amount);`, `post(\`cash:\${row.id}\`, row.date, "Kasa açılışı", row.description, moneyOf(row), "500", row.amount);`, [TEST], /A 519 1000|opening:519/],
  [2, "cari açılışı açıklamadan tanınır (P1 geri)", GL, `export const isOpeningEntry = row => Number(row?.isOpening) === 1 || OPENING_REVIEW_OPEN.includes(String(row?.openingReview || ""));`, `export const isOpeningEntry = row => /^açılış/i.test(String(row?.note || "").trim());`, [TEST], /A 602 70|A 320 30|onaya kadar 519/],
  [3, "KG-16 katlamasında Türkçe ı / ç / ş katlanmaz (B6)", MIG, `.toLocaleLowerCase("tr-TR").replace(/ç/g, "c").replace(/ı/g, "i").replace(/ş/g, "s");`, `.toLocaleLowerCase("tr-TR");`, [TEST], /AÇILIŞ|Açilış|ACILIS/],
  [4, "adaylık göç dışında da verilir (yeni 'Açılış…' Borç Yaz açılış sayılır; K8-1)", GL, `export const isOpeningEntry = row => Number(row?.isOpening) === 1 || OPENING_REVIEW_OPEN.includes(String(row?.openingReview || ""));`, `export const isOpeningEntry = row => Number(row?.isOpening) === 1 || OPENING_REVIEW_OPEN.includes(String(row?.openingReview || "")) || (!row?.source && /^\\s*a[cç][iı]l[iı][sş]/i.test(String(row?.note || "")));`, [TEST], /A 602 70|B 770 30/],
  [5, "açılış portföyü 602 / 770'te kalır (M-08 / M-09)", GL, `const target = row.free ? (Number(row.isOpening) === 1 ? OPENING_GL :`, `const target = row.free ? (Number(row.isOpening) === 1 ? (row.chequeDirection === "out" ? "770" : "602") :`, [TEST], /free-in\|A 519 800|free-out\|A 103 120/],
  [6, "formdan carisiz evrak 519'a (S49 B)", GL, `const target = row.free ? (Number(row.isOpening) === 1 ? OPENING_GL :`, `const target = row.free ? (true ? OPENING_GL :`, [TEST], /649\.90/],
  [7, "ikinci yükleyiciden KG-5 düşer", OPEN, `)) parts.plans -= cents(roundMoney((Number(row.total) || 0) - (Number(row.paid) || 0)));`, `)) parts.plans -= 0 * cents(roundMoney((Number(row.total) || 0) - (Number(row.paid) || 0)));`, [TEST], /opening:519|subledger|-12950|Açılış Karşılığı/],
  [8, "KG-5: P maddeye eklenir (açılış satırı ayrıca yazılır)", GL, `      if (row.opening && row.planImported && !Number(row.planCovers) && !Number(row.planPinned)) continue;\n`, "", [TEST], /P maddesiz/],
  [9, "KG-5 tarihi kartın Kayıt Tarihi (yükleme günü değil; B5)", GL, `post(\`plan:\${plan.id}\`, localDayOf(plan.importedAt) || plan.date,`, `post(\`plan:\${plan.id}\`, plan.date,`, [TEST], /yerel günü/],
  [10, "açılış sınıfı yazılmaz (B9)", GL, `    if (out.length > before) out[out.length - 1].cls = OPENING_CLASS;\n`, "", [TEST], /açılış sınıfı|olağanlardan önce|cls/],
  [11, "banka açılışı türetmede 500 kalır (B3)", VOUCHER, `export const effectiveGl = line => (OPENING_ROLES.has(line?.role) && String(line?.gl) === "500" ? "519" : String(line?.gl ?? ""));`, `export const effectiveGl = line => String(line?.gl ?? "");`, [TEST], /B 519 400|A 519 5000|Eşleştirilecek Açılış Bakiyeleri/],
  [12, "KG-16 onayı is_opening'e yazılır (B7)", OPEN, `store.run("UPDATE account_entries SET opening_review = ? WHERE id = ?", next, id)`, `store.run("UPDATE account_entries SET opening_review = ?, is_opening = CASE WHEN ? = 'confirmed' THEN 1 ELSE is_opening END WHERE id = ?", next, next, id)`, [TEST], /onay is_opening'e yazılmaz|deepStrictEqual|Expected values to be strictly deep-equal/],
  [13, "S48: seçilen cari evraka bağlanmaz (çift karşılıksız)", CHEQ, `          store.run("UPDATE cheques SET account_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", chosen, user.id, now(), cheque.id);\n`, "", [TEST], /karşılıksız \+ cari|free-bounce|cari seçilen|610/],
  [14, "stock:opening denetimi 500'e bakar", INT, `const credit = entry.lines.filter(line => line.account === "519").reduce((sum, line) => sum + line.credit - line.debit, 0);`, `const credit = entry.lines.filter(line => line.account === "500").reduce((sum, line) => sum + line.credit - line.debit, 0);`, [TEST], /stock:opening|Açılış Stoku/],
  [15, "S53 uyarısı kilitli yılda da çıkar", OPEN, `if (entry.date >= yearStart || (lock && entry.date <= lock)) continue;`, `if (entry.date >= yearStart) continue;`, [TEST], /unlocked-years|false !== true|true !== false/],
  // Tur 1b — S127 = A ("bir olay tek kez yazılır"): koruma kaldırılır → çift (ileri) / eksik (ters); koruma fazla geniş → açık dönem (iv) ve kilitli yıl (iii) kartı da eski yapıya.
  [16, "S127 koruması yok (kart iki kez / ters yönde hiç yazılır)", OPEN, `    if (freshInside || inside.some(item => present(item.id, item.date))) out.add(card.id);`, `    if (false) out.add(card.id);`, [S127], /1990000|120 = müşteri carileri|120 = cariler/],
  [17, "S127 koruması fazla geniş (eski kurallı dönem varsa BÜTÜN yüklenen kartlar eski yapıda)", OPEN, `    if (freshInside ? inside.length === legacy.length : inside.length === 0) continue;`, `    out.add(card.id);\n    continue;`, [S127], /Açık Kart|Kilitli Kart|beklenen farklar/],
  // Tur 1b — carisiz evrak Alacak Yaşlandırması'na girmez (BAŞ MİMAR KARARI 11.11; S49 = A + MM5 "müşteri başına").
  [18, "carisiz evrak yaşlandırmada kalır (karar geri)", RC, `          if (!cheque?.accountId && !Number(cheque?.planLinked)) continue;`, ``, [AGING], /carisiz|—|Carisiz/],
  [19, "carili evrak da yaşlandırmadan düşer (fazla geniş)", RC, `          if (!cheque?.accountId && !Number(cheque?.planLinked)) continue;`, `          continue;`, [AGING], /carili|Carili|seçilen/],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};
const taban = run([TEST]);
console.log(`taban: ${taban.pass} geçti / ${taban.fail} kaldı (çıkış ${taban.status})`);
if (taban.status !== 0) {
  console.log(taban.out.slice(-4000));
  throw new Error("taban kırmızı — mutasyon taraması anlamsız");
}
let caught = 0;
let tried = 0;
for (const [no, name, file, before, after, files, reason] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  tried += 1;
  const target = path.join(COPY, file);
  const original = readFileSync(target, "utf8");
  const hits = original.split(before).length - 1;
  if (hits !== 1) {
    console.log(`not ok ${no} - ${name}: eski metin dosyada ${hits} kez (beklenen 1)`);
    continue;
  }
  writeFileSync(target, original.replace(before, after));
  let result;
  try {
    result = run(files);
  } finally {
    writeFileSync(target, original);
  }
  const ok = result.status !== 0 && reason.test(result.out);
  if (ok) caught += 1;
  console.log(`${ok ? "ok" : "not ok"} ${no} - ${name}: çıkış ${result.status}, ${result.pass} geçti / ${result.fail} kaldı${ok ? "" : ` — beklenen neden görülmedi (${reason})`}`);
  if (!ok) console.log(result.out.split("\n").filter(line => /not ok|error:|Error|beklenen/.test(line)).slice(0, 12).join("\n"));
}
console.log(`\n# tests ${tried}\n# pass ${caught}\n# fail ${tried - caught}`);
process.exit(caught === tried ? 0 : 1);
