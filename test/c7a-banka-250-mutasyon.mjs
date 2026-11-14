#!/usr/bin/env node
// 2.5.0 Ç7a — banka türetme kurallarının MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının nedeni okunur; tasarım notu
// docs/erp/C7A-BANKA-TASARIM.md §7). Programın ayrı bir kopyasında (ders 23; `git archive HEAD ':!docs/kanit'` + node_modules bağı) her seferinde TEK bilerek hata açılır, kopyanın
// testleri koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI. Kopya dosyası her mutasyondan sonra geri yazılır. Karşı mutantlar DEĞERLE yakalanır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/c7a-banka-250-mutasyon.mjs --kopya <kopya> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;

const VOUCHER = "server/lib/bank/voucher.mjs";
const VOUCHERS = "server/lib/bank/vouchers.mjs";
const D07 = "test/kart-faizi-250.test.mjs";
const LEDGER = "server/lib/general-ledger.mjs";
const COVER = "server/lib/bank/opening-cover.mjs";
const MONEY = "server/lib/bank/money-lines.mjs";
const OPENING = "server/lib/ledger-opening.mjs";
const K14 = "test/hesapsiz-acilis-250.test.mjs";

// [no, ad, dosya, eski metin, yeni metin, koşulacak testler, beklenen neden]
const MUTASYONLAR = [
  [
    1, "D-07: kart hesabı Faiz Gideri'nde yine reddedilir (kabul geri alınır)", VOUCHERS,
    'interest_out: { main: new Set([...BANK_KINDS, "card"]),',
    "interest_out: { main: BANK_KINDS,",
    [D07], /bank-account-invalid[\s\S]*400 !== 200|400 !== 200/,
  ],
  [
    2, "D-07: kart faizinin para satırı 309 yerine 102 (kart ↔ banka)", VOUCHER,
    "  const lines = [plainLine(\"expense\", gl, \"D\", amountMinor)];\n  if (taxMinor > 0) lines.push(plainLine(\"tax\", gl, \"D\", taxMinor, \"BSMV / KKDF\"));\n  lines.push(moneyLine(account, \"C\", amountMinor + taxMinor));",
    "  const lines = [plainLine(\"expense\", gl, \"D\", amountMinor)];\n  if (taxMinor > 0) lines.push(plainLine(\"tax\", gl, \"D\", taxMinor, \"BSMV / KKDF\"));\n  lines.push(account.kind === \"card\" ? { ...moneyLine(account, \"C\", amountMinor + taxMinor), role: \"bank\", gl: \"102\" } : moneyLine(account, \"C\", amountMinor + taxMinor));",
    [D07], /D-07: B 780 faiz \+ BSMV \/ A 309\.k|ledger-integrity[\s\S]*102\.00|mutabakat bozuk/,
  ],
  [
    3, "D-07: BSMV / KKDF satırı düşer (yalnız faiz yazılır)", VOUCHER,
    "  if (taxMinor > 0) lines.push(plainLine(\"tax\", gl, \"D\", taxMinor, \"BSMV / KKDF\"));\n  lines.push(moneyLine(account, \"C\", amountMinor + taxMinor));",
    "  lines.push(moneyLine(account, \"C\", amountMinor));",
    [D07], /D-07: B 780 faiz \+ BSMV \/ A 309\.k/,
  ],
  [
    4, "D-07: kart faizi Planlı İşlem'de de kabul edilir (planMain yok sayılır)", VOUCHERS,
    "    const planOnly = forPlan && rule.planMain;",
    "    const planOnly = false;",
    [D07], /kart faizi planlanmaz/,
  ],
  [
    5, "D-07: faiz gideri hesabı 780 yerine 770 (hesap eşlemesi)", VOUCHERS,
    "        return { lines: interestOutLines({ account: shape(account), amountMinor, taxMinor: optionalAmount(body.taxAmount, \"BSMV / KKDF\"), gl: values.gl.interestExpense }) };",
    "        return { lines: interestOutLines({ account: shape(account), amountMinor, taxMinor: optionalAmount(body.taxAmount, \"BSMV / KKDF\"), gl: account.kind === \"card\" ? \"770\" : values.gl.interestExpense }) };",
    [D07], /D-07: B 780 faiz \+ BSMV \/ A 309\.k/,
  ],
  // Ç7a tur 2 — K-14 / K-15 (S179 = A; tasarım notu §13.2). Karşı mutantlar DEĞERLE yakalanmalı.
  [
    6, "K-14: açılıştan önceki hesapsız satır banka tarafına yazılır (defterde 519'a geçmez)", LEDGER,
    "      if ((sub === \"102.00\" || sub === \"108.00\") && isCovered(",
    "      if ((sub === \"102.00\" || sub === \"108.00\") && false && isCovered(",
    [K14], /gate-equivalence[^\n]*gl:102|ledger-integrity|20\.09 tahsilat B 519 \/ A 120/,
  ],
  [
    7, "K-14: açılış günü sınırı '<' yerine '≤' (açılış günündeki satır da 519'a)", COVER,
    "  if (way === \"bank\") return Boolean(bounds.bank) && date < bounds.bank;",
    "  if (way === \"bank\") return Boolean(bounds.bank) && date <= bounds.bank;",
    [K14], /açılış günü \(01\.10\) açılıştan SONRA|gate-equivalence[^\n]*gl:102|ledger-integrity/,
  ],
  [
    8, "K-14: EN GEÇ yerine EN ERKEN açılış tarihi", COVER,
    "(SELECT MAX(opening_date) FROM bank_accounts WHERE deleted_at IS NULL AND currency = 'TRY' AND kind IN (${BANK_KINDS_SQL}))",
    "(SELECT MIN(opening_date) FROM bank_accounts WHERE deleted_at IS NULL AND currency = 'TRY' AND kind IN (${BANK_KINDS_SQL}))",
    [K14], /Garanti'nin açılışından \(05\.10\) önce|en geç/,
  ],
  [
    9, "K-14: kovanın ekran bakiyesi açılışta sayılmış satırları düşmez", MONEY,
    "w WHERE w.ref = '' AND NOT ${COVER_SQL} GROUP BY w.way`",
    "w WHERE w.ref = '' AND NOT (${COVER_SQL} AND 0) GROUP BY w.way`",
    [K14], /bankMinor: 670000|actual: 6700$/m,
  ],
  [
    10, "K-14: pasif hesabın açılışı sınırdan düşer (durum fark etmez kuralı bozulur)", COVER,
    "WHERE deleted_at IS NULL AND currency = 'TRY' AND kind IN (${BANK_KINDS_SQL}))",
    "WHERE deleted_at IS NULL AND status = 'active' AND currency = 'TRY' AND kind IN (${BANK_KINDS_SQL}))",
    [K14], /pasif hesabın açılışı sınırda kalır/,
  ],
  [
    11, "K-14: Devir Kapanışı maddesi netlenmez (B 519 / A 519 yevmiyede kalır)", LEDGER,
    "    if (covered) {\n      const net",
    "    if (false) {\n      const net",
    [K14], /B 519 \/ A 519 netlenir, madde yazılmaz/,
  ],
  [
    12, "K-15: kart yolunda yön ayrımı kalkar (kart ödemesi de POS sınırına — yalnız Devir Kapanışı)", COVER,
    "    const limit = kind === \"out\" ? bounds.card : bounds.pos;",
    "    const limit = bounds.pos;",
    [K14], /açılıştan önceki kart ödemesi A 519|gate-equivalence[^\n]*gl:108|ledger-integrity/,
  ],
  [
    13, "K-14: 519 ikinci yükleyicisi açılışta sayılmış satırları bilmez (Açılış Karşılığı yanlış alarm)", OPENING,
    "  const counterpart = parts.cash + parts.accounts + parts.plans + parts.stock + parts.bank + parts.unassigned + parts.cheques + parts.vouchers519;",
    "  const counterpart = parts.cash + parts.accounts + parts.plans + parts.stock + parts.bank + parts.cheques + parts.vouchers519;",
    [K14], /opening:519|Açılış Karşılığı|Mutabakat Testi/,
  ],
  [
    14, "K-14: defter beklenenleri (groups) açılışta sayılmış satırı 102.00'da bekler (yanlış alarm)", MONEY,
    "SELECT CASE WHEN ${COVER_SQL} THEN 'opening' ELSE w.way END AS way, w.ref AS ref, COALESCE(SUM(CASE WHEN w.kind = 'in' THEN w.cents ELSE -w.cents END), 0) AS cents, COUNT(*) AS count FROM (${waySql({ light: true, events, ids, ref, cover: true })})",
    "SELECT CASE WHEN (${COVER_SQL}) AND 0 THEN 'opening' ELSE w.way END AS way, w.ref AS ref, COALESCE(SUM(CASE WHEN w.kind = 'in' THEN w.cents ELSE -w.cents END), 0) AS cents, COUNT(*) AS count FROM (${waySql({ light: true, events, ids, ref, cover: true })})",
    [K14], /ledger-integrity|bank:sub:102\.00|gl:102/,
  ],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const files = [...new Set(MUTASYONLAR.filter(item => !ONLY || ONLY.has(item[0])).flatMap(item => item[5]))];
const taban = run(files);
console.log(`taban: ${taban.pass} geçti / ${taban.fail} kaldı (çıkış ${taban.status})`);
if (taban.status !== 0) {
  console.log(taban.out.slice(-4000));
  throw new Error("taban kırmızı — mutasyon taraması anlamsız");
}
let caught = 0;
let tried = 0;
for (const [no, name, file, before, after, tests, reason] of MUTASYONLAR) {
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
    result = run(tests);
  } finally {
    writeFileSync(target, original);
  }
  // MUT_OUT=<klasör>: her mutantın ham çıktısı ayrı dosyaya (kanıt; nedeni okumak için — ders 38).
  if (process.env.MUT_OUT) writeFileSync(path.join(process.env.MUT_OUT, `mutant-${no}.log`), result.out);
  const ok = result.status !== 0 && reason.test(result.out);
  if (ok) caught += 1;
  // Ç7a tur 2: kırmızının NEDENİ çıktıda (ders 38) — eşleşen ilk satır yazılır.
  const why = ok ? (result.out.split("\n").find(line => reason.test(line)) || "").trim().slice(0, 240) : "";
  console.log(`${ok ? "ok" : "not ok"} ${no} - ${name}: çıkış ${result.status}, ${result.pass} geçti / ${result.fail} kaldı${ok ? ` — neden: ${why}` : ` — beklenen neden görülmedi (${reason})`}`);
  if (!ok) console.log(result.out.split("\n").filter(line => /not ok|error:|Error|beklenen/.test(line)).slice(0, 12).join("\n"));
}
console.log(`\n# tests ${tried}\n# pass ${caught}\n# fail ${tried - caught}`);
process.exit(caught === tried ? 0 : 1);
