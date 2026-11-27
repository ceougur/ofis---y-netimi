#!/usr/bin/env node
// 2.5.0 Ç5-K tur 2 — MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının NEDENİ okunur).
// Programın AYRI kopyasında (ders 23; `git archive HEAD | tar -x` + node_modules bağı) her seferinde tek bilerek hata açılır, ilgili test(ler) koşulur: çıkış ≠ 0 VE
// çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI. Kopya dosyaları her mutasyondan sonra asıl baytlarıyla geri yazılır.
// Kapsam: bu turun ürün değişiklikleri (ORTA-1 uyarı sunumu U1–U6, DÜŞÜK-1 işlem kapsamı izi U7–U9) + dar kontrol 10.11'in yaşayan mutantları (K5, K6, K7, K8, K14).
// K7 ("|| same[0]" yok) EŞDEĞER beklenir: önceki hâl bulunmayınca da aynı 409 cash-before-opening (yalnız ileti / change alanı farklı) — YAŞAR yazılır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=<tarayıcı> node test/kasa-acilis-tur2-250-mutasyon.mjs --kopya <kopya> [--yalniz U1,K5]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",")) : null;

const CO = "server/lib/cash-opening.mjs";
const IN = "server/lib/integrity.mjs";
const IS = "server/lib/integrity-scope.mjs";
const RC = "server/routes/report-center.mjs";
const AD = "client/assets/admin.js";
const DBF = "server/lib/db.mjs";
const UYARI = ["test/kasa-acilis-uyari-250.test.mjs"];
const IZ = ["test/kasa-acilis-iz-250.test.mjs"];
const EKRAN = "test/e2e/senaryo-kasa-acilis-uyari-250.mjs";

// [kimlik, ad, testler (dizi: node --test; metin: arayüz senaryosu), [[dosya, eski, yeni], …], neden, eşdeğer mi]
const M = [
  ["U1", "uyarı işareti yok (notice) — denetim sapma gibi", UYARI, [[IN, 'severity: "warning", notice: true, opening: early.opening,', 'severity: "warning", opening: early.opening,']], /not ok \d+ - Mutabakat Testi: denetim görünür/],
  ["U2", "Defter Mutabakatı uyarıyı ayırmaz (Fark Var / yöneticiye bildirin)", UYARI, [[RC, "const notice = check => !check.ok && check.notice === true;", "const notice = () => false;"]], /not ok \d+ - Defter Mutabakatı \(ekran verisi/],
  ["U3", "familyOf uyarıyı tanımaz (all)", UYARI, [[IS, '  if (code === "cash:before-opening") return null;\n', ""]], /not ok \d+ - kapı: uyarının alanı yok/],
  ["U4", "açılış tabanı / günlüğü uyarıyı sapma sayar", UYARI, [[IN, "    const drifts = result.failures.filter(item => !item.notice);\n    baseline = new Set(drifts.map(signature));", "    const drifts = result.failures;\n    baseline = new Set(drifts.map(signature));"]], /not ok \d+ - program yeniden açılınca/],
  ["U5", "tarama uyarıyı 'yeni sapma' sayar (günlük + zil)", UYARI, [[IN, "    const drifts = result.failures.filter(item => !item.notice);\n    const current = new Set(drifts.map(signature));", "    const drifts = result.failures;\n    const current = new Set(drifts.map(signature));"]], /not ok \d+ - tarama 'yeni sapma' kaydı ve zili üretmez/],
  ["U6", "Yönetim › Sistem uyarıyı sapma listesine katar (kırmızı)", EKRAN, [[AD, "      const failures = (result.failures || []).filter(item => !item.notice);", "      const failures = result.failures || [];"]], /✗ sarı uyarı, kırmızı hata değil/],
  ["U7", "önceki hâl eşlemesi 'bu işlemde eklendi' izini okumaz", IZ, [[CO, "    const insertedHere = (table, rowid) => Boolean(scope.born?.get(table)?.has(Number(rowid)));", "    const insertedHere = () => false;"]], /not ok \d+ - 1\) dış yazım yok → 409/],
  ["U8", "işlem kapsamı eklenen satırın önceki hâlini 'eklendiği hâl' diye işaretlemez (db.mjs born)", IZ, [[DBF, "          if (scope.inserted.get(table)?.has(row.__rowid)) setIn(scope.born, table).add(row.__rowid);\n", ""]], /not ok \d+ - 1\) dış yazım yok → 409/],
  ["U9", "işlem kapsamı eklenen satırları tutmaz (db.mjs inserted)", IZ, [[DBF, "        setIn(scope.inserted, table).add(last - changes + 1 + k);\n", ""]], /not ok \d+ - 1\) dış yazım yok → 409/],
  ["K5", "dar kontrol K5: açılışın SİLİNMESİ önbelleği düşürmez", IZ, [[CO, ' || [...(scope.before.get("cash_entries")?.values() || [])].some(openingRow)) state.openingTouched = true;', ") state.openingTouched = true;"]], /not ok \d+ - açılış 10\.03 → 11\.03 girişi/],
  ["K6", "dar kontrol K6: önceki hâl (d) olaysız satırın taşınması eşlenmez", IZ, [[CO, "      return loose.find(item => item.row.date === row.date && cents(item.row) === cents(row)) || null;", "      return null;"]], /not ok \d+ - ön koşul: olaysız tahsilat/],
  ["K7", "dar kontrol K7: önceki hâl (c) '|| same[0]' yok", [...IZ, ...UYARI], [[CO, " || same[0];", ";"]], /not ok/, true],
  ["K8", "dar kontrol K8: açılış önbelleği damgaya bakmaz", IZ, [[CO, "if (!fresh && state.opening && stamp && state.opening.stamp === stamp) return state.opening.date;", "if (!fresh && state.opening) return state.opening.date;"]], /not ok \d+ - (BAŞKA BAĞLANTI|STORE DIŞI)/],
  ["K14", "dar kontrol K14: uyarının örnek metni boş", UYARI, [[CO, 'sample: `${SOURCE_LABEL[source] || "Kasa Hareketi"} ${line.id} · ${dayText(line.date)}`', 'sample: ""']], /not ok \d+ - Mutabakat Testi: denetim görünür/],
];

const run = tests => {
  const args = Array.isArray(tests) ? ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...tests] : ["--disable-warning=ExperimentalWarning", tests];
  const r = spawnSync(process.execPath, args, { cwd: COPY, encoding: "utf8", maxBuffer: 128 * 1024 * 1024, timeout: 15 * 60_000, killSignal: "SIGKILL", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};
const firstRed = out => (out.match(/^\s*not ok \d+ - (.*)$/m) || out.match(/^\s*✗ (.*)$/m) || [])[1] || "";

const bases = new Map();
let caught = 0;
let total = 0;
for (const [id, name, tests, edits, reason, equivalent = false] of M) {
  if (ONLY && !ONLY.has(id)) continue;
  const key = JSON.stringify(tests);
  if (!bases.has(key)) {
    const base = run(tests);
    console.log(`taban ${key}: ${base.pass}/${base.pass + base.fail} geçti (çıkış ${base.status})`);
    if (base.status !== 0) throw new Error(`taban yeşil değil — mutasyon anlamsız\n${base.out.slice(-3000)}`);
    bases.set(key, base);
  }
  const originals = new Map();
  try {
    let ready = true;
    for (const [file, from, to] of edits) {
      const full = path.join(COPY, file);
      if (!originals.has(full)) originals.set(full, readFileSync(full, "utf8"));
      const text = readFileSync(full, "utf8");
      const n = text.split(from).length - 1;
      if (n !== 1) {
        console.log(`${id} ${name}: KURULAMADI (${file} içinde metin ${n} kez)`);
        ready = false;
        break;
      }
      writeFileSync(full, text.replace(from, () => to));
    }
    if (!ready) continue;
    total += 1;
    const r = run(tests);
    const hit = r.status !== 0 && reason.test(r.out);
    if (hit) caught += 1;
    console.log(`${id} ${name}: ${hit ? "YAKALANDI" : equivalent ? "YAŞADI (EŞDEĞER beklenir)" : "KAÇTI"} (çıkış ${r.status}, ${r.pass} geçti / ${r.fail} kaldı${firstRed(r.out) ? `; ilk kırmızı: ${firstRed(r.out).slice(0, 110)}` : ""})`);
  } finally {
    for (const [full, text] of originals) writeFileSync(full, text);
  }
}
console.log(`SONUÇ: ${caught}/${total} mutasyon yakalandı (K7 eşdeğer beklenir)`);
