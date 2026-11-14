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
    [D07], /D-07: B 780 faiz \+ BSMV \/ A 309\.k|bağı\/alt hesabı|mutabakat bozuk/,
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
  const ok = result.status !== 0 && reason.test(result.out);
  if (ok) caught += 1;
  console.log(`${ok ? "ok" : "not ok"} ${no} - ${name}: çıkış ${result.status}, ${result.pass} geçti / ${result.fail} kaldı${ok ? "" : ` — beklenen neden görülmedi (${reason})`}`);
  if (!ok) console.log(result.out.split("\n").filter(line => /not ok|error:|Error|beklenen/.test(line)).slice(0, 12).join("\n"));
}
console.log(`\n# tests ${tried}\n# pass ${caught}\n# fail ${tried - caught}`);
process.exit(caught === tried ? 0 : 1);
