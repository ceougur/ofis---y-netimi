#!/usr/bin/env node
// 2.5.0 Ç5-K — Kasa açılış kuralları MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının nedeni okunur).
// Programın AYRI bir kopyasında (ders 23: çalışma ağacında değil; `git archive <commit>` ile) her seferinde TEK bilerek hata açılır, kopyanın
// test/kasa-acilis-once-250.test.mjs'i koşulur: çıkış ≠ 0 VE çıktıda beklenen neden metni varsa YAKALANDI. Kopya dosyası her mutasyondan sonra asıl
// baytlarıyla geri yazılır. Her kararın karşı seçeneği + sınır kayması (aynı gün / bir gün önce).
// Kullanım: node test/kasa-acilis-once-250-mutasyon.mjs --kopya <git archive kopyası> [--yalniz 1,3]
// Kopyada S20 testleri (v2.4.9 gerçek kodu) için etiket gerekir: kopyanın kökünde depoya işaret eden .git dosyası ("gitdir: <depo>/.git") — yalnız okuma.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
// --dokum <klasör>: her mutasyonun ham çıktısı M<no>.txt (kırmızının nedeni okunur — ders 38).
const DUMP = opt("--dokum") ? path.resolve(opt("--dokum")) : null;

const TEST = ["--test", "test/kasa-acilis-once-250.test.mjs"];
const CO = "server/lib/cash-opening.mjs";
const CR = "server/routes/cash.mjs";
const TR = "server/routes/trash.mjs";
const IN = "server/lib/integrity.mjs";
const AC = "server/routes/accounts.mjs";
const RED = /beklenen 409 cash-before-opening, gelen 200/;
// [no, ad, [[dosya, eski metin (dosyada TAM BİR KEZ), yeni metin], …], çıktıda beklenen neden]
const MUTASYONLAR = [
  [1, "S12 B: denetim hiç kurulmaz (bugünkü 2.4.9 davranışı)", [[CR, "  installCashOpeningGuard(store);\n", ""]], RED],
  [2, "T9 kapsam: çek / senet olayı (cheque_events) denetim dışı", [[CO, 'const CASH_TABLES = Object.freeze(["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]);', 'const CASH_TABLES = Object.freeze(["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves"]);']], /9 çekin Kasa'dan tahsili açılıştan bir gün önce: beklenen 409 cash-before-opening, gelen 200/],
  [3, "T9 kapsam: stok hareketi (stock_moves) denetim dışı", [[CO, 'const CASH_TABLES = Object.freeze(["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]);', 'const CASH_TABLES = Object.freeze(["payments", "cash_entries", "account_entries", "plan_entries", "cheque_events"]);']], /10 nakit stok alımı açılıştan bir gün önce: beklenen 409 cash-before-opening, gelen 200/],
  [4, "T9 kapsam: kayıt tahsilatı (payments) denetim dışı", [[CO, 'const CASH_TABLES = Object.freeze(["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]);', 'const CASH_TABLES = Object.freeze(["cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]);']], /7 kayıt tahsilatı açılıştan bir gün önce: beklenen 409 cash-before-opening, gelen 200/],
  [5, "T9 kapsam: yalnız Kasa Giriş / Çıkış (kâhin B33d)", [[CO, 'const CASH_TABLES = Object.freeze(["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]);', 'const CASH_TABLES = Object.freeze(["cash_entries"]);']], /4 cari nakit tahsilat açılıştan bir gün önce: beklenen 409 cash-before-opening, gelen 200/],
  [6, "T10 sınır: aynı gün de reddedilir (kâhin B33b)", [[CO, "if (!date || date >= opening) continue;", "if (!date || date > opening) continue;"]], /aynı gün: 409 cash-before-opening/],
  [7, "T10 sınır: bir gün önce kabul (yalnız iki gün ve öncesi reddedilir)", [[CO, "if (!date || date >= opening) continue;", "if (!date || date >= new Date(Date.parse(`${opening}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)) continue;"]], RED],
  [8, "B11 B: düzeltmede S12 yok (tarihi önceye çeken düzeltme geçer; kâhin B33c)", [[CO, "          throw beforeOpeningError({ date, opening, change: true, converted: !wasCash && String(prior.row.date || \"\") === date, table, id: row.id });", "          continue;"]], /Kasa Giriş tarihi önceye: beklenen 409 cash-before-opening, gelen 200/],
  [9, "S26 / S40 / S44 B: tarihi değişmeyen düzeltme de reddedilir (önceki hâl yok sayılır)", [[CO, "        const prior = priorOf(table, row);", "        const prior = null;"]], /Kasa Giriş tutar \+ açıklama: 409 cash-before-opening/],
  [10, "Z9 B: Silinenler'den geri yükleme de reddedilir (geri yükleme kapsamı yok)", [[TR, "    return restoringCash(store, () => restoreItem(user, body, res));", "    return restoreItem(user, body, res);"]], /geri yükle [^:\n]*: 409 cash-before-opening/],
  [11, "önceki hâl (b): aynı İşlem No eşlenmez (Taksite Aktar / Geri Al yeni hareket sayılır)", [[CO, "      const event = row.event_id ? byEvent.get(String(row.event_id)) : null;", "      const event = null;"]], /Taksite Aktar: 409 cash-before-opening/],
  [12, "önceki hâl (c): fatura peşini aynı faturayla eşlenmez (peşin tutarı düzeltmesi yeni hareket sayılır)", [[CO, "        const same = byInvoice.get(String(row.source_id)) || [];", "        const same = [];"]], /peşin tutarı: 409 cash-before-opening/],
  [13, "önceki hâl: bu işlemde eklenip düzeltilen satırın eklendiği hâli önceki hâl sayılır (rowid sınırı yok)", [[CO, "        if (insertedHere(table, row.__rowid)) continue;", ""]], /ilk denetim Kasa açılış kuralı/],
  [14, "önbellek: açılış değişince düşmez (açılış öne alınınca eski tarihle karar)", [[CO, "      if (state.openingTouched) state.opening = null;\n", ""], [CO, "      const opening = openingDate(state.openingTouched);", "      const opening = openingDate(false);"]], /eski açılıştan önce, yeni açılıştan sonra: 409 cash-before-opening/],
  [15, "S20 B: Mutabakat Testi uyarısı yok", [[IN, '      if (early?.rows.length) {', '      if (early?.rows.length && false) {']], /Mutabakat Testi uyarısı var'/],
  [16, "S20: uyarı COMMIT kapısında da (geri yükleme ve düzeltme kapıda reddedilir)", [[IN, '    if (!touched && has("cash_entries")) {', '    if (has("cash_entries")) {']], /geri yükle [^:\n]*: (?:500 gate-equivalence|409 ledger-integrity)[^\n]*cash:before-opening/],
  [17, "S20 sınır: uyarı açılış GÜNÜNÜ de sayar (açılışın kendisi ve aynı gün hareketi)", [[CO, 'lines.lines({ ways: ["cash"], before: opening, light: true })', 'lines.lines({ ways: ["cash"], before: new Date(Date.parse(`${opening}T00:00:00Z`) + 86400000).toISOString().slice(0, 10), light: true })']], /6 !== 5/],
  [18, "S56 B: Normal Cari sınırı aşan düzeltme kabul (assertNormalRoom kapalı)", [[AC, "    if (!doubtfulSkipOf({ kind: \"in\", invoiceId: input.invoiceId, doubtfulSkip: input.doubtfulSkip })) return;", "    return;"]], /Normal Cari sınırı aşımı: (?:beklenen 409 doubtful-normal-exceeds, gelen 200|kod ledger-integrity \(beklenen doubtful-normal-exceeds\))/],
  [19, "T11 B: açılışsız Kasa'da nakit hareketi reddedilir", [[CO, "      if (!opening) return;\n      let priorOf = null;", "      if (!opening) throw beforeOpeningError({ date: String(moves[0].row.date || \"\"), opening: \"\" });\n      let priorOf = null;"]], /\(açılışsız\): 409 cash-before-opening/],
];

const run = args => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", ...args], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run(TEST);
console.log(`taban: ${taban.pass} geçti / ${taban.fail} kaldı (çıkış ${taban.status})`);
if (taban.status !== 0 || taban.fail !== 0 || !(taban.pass > 0)) throw new Error(`taban testi yeşil değil — mutasyon taraması anlamsız\n${taban.out.slice(-3000)}`);
let yakalanan = 0;
let toplam = 0;
for (const [no, ad, degisiklikler, neden] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  toplam += 1;
  const asillar = new Map();
  try {
    for (const [file, eski, yeni] of degisiklikler) {
      const full = path.join(COPY, file);
      const text = asillar.get(full) ?? readFileSync(full, "utf8");
      if (!asillar.has(full)) asillar.set(full, text);
      const current = readFileSync(full, "utf8");
      const n = current.split(eski).length - 1;
      if (n !== 1) throw new Error(`M${no}: "${eski.slice(0, 80)}" ${file} içinde ${n} kez (tam 1 olmalı)`);
      writeFileSync(full, current.replace(eski, yeni));
    }
    const r = run(TEST);
    if (DUMP) writeFileSync(path.join(DUMP, `M${no}.txt`), r.out);
    const caught = r.status !== 0 && neden.test(r.out);
    if (caught) yakalanan += 1;
    const ilk = (r.out.match(/AssertionError[^\n]*\n[^\n]*/) || [""])[0].replace(/\s+/g, " ").slice(0, 260);
    console.log(`M${no} ${caught ? "YAKALANDI" : "YAKALANMADI"} — ${ad} (${r.pass} geçti / ${r.fail} kaldı; neden "${neden}" ${neden.test(r.out) ? "var" : "YOK"}) ilk hata: ${ilk}`);
  } finally {
    for (const [full, text] of asillar) writeFileSync(full, text);
  }
}
// tools/kanit.mjs özeti: "geçti" = yakalanan mutasyon, "kaldı" = yakalanmayan.
console.log(`SONUÇ: ${yakalanan} geçti, ${toplam - yakalanan} kaldı (${toplam} mutasyonun ${yakalanan}'i yakalandı)`);
process.exitCode = yakalanan === toplam ? 0 : 1;
