#!/usr/bin/env node
// 2.5.0 Ç2 — saklanan fiş defterinin MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının nedeni okunur).
// Programın ayrı bir kopyasında (ders 23: çalışma ağacında değil) her seferinde TEK bilerek hata açılır, kopyanın kendi test/fis-defteri-250.test.mjs ve
// test/fis-defteri-yasam-250.test.mjs dosyaları koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI. Kopya dosyası her mutasyondan sonra geri yazılır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/fis-defteri-250-mutasyon.mjs --kopya <git archive HEAD kopyası> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;

const LV = "server/lib/ledger-vouchers.mjs";
const MIG = "server/lib/migrations.mjs";
const GL = "server/lib/general-ledger.mjs";
const MAIN = "test/fis-defteri-250.test.mjs";
const LIFE = "test/fis-defteri-yasam-250.test.mjs";
// [no, ad, dosya, eski metin (dosyada TAM BİR KEZ), yeni metin, koşulacak testler, çıktıda beklenen neden (düzenli ifade)]
const MUTASYONLAR = [
  [1, "fiş denkliği denetimi düşer (borç ≠ alacak kabul)", LV, "if (debit !== credit || debit <= 0) throw", "if (debit <= 0) throw", [MAIN], /not ok \d+ - N1–N3[\s\S]*beklenen 400, gelen 409/],
  [2, "sıfır satır denetimi düşer (iki tarafı sıfır satır kabul)", LV, "if ((dr > 0) === (cr > 0)) throw", "if (dr > 0 && cr > 0) throw", [MAIN], /not ok \d+ - N1–N3[\s\S]*beklenen 400, gelen undefined/],
  [3, "ters kayıt yönü (satırlar aynalanmaz)", LV, "debit: line.credit, credit: line.debit, note: line.note", "debit: line.debit, credit: line.credit, note: line.note", [MAIN], /satırlar aynanın tersi/],
  [4, "istek kimliği tekilliği (yinelenen kimlik aranmaz)", LV, "const existing = byKey(item.requestKey);", "const existing = null;", [MAIN, LIFE], /aynı fiş ikinci kez yazılamaz/],
  [5, "kilit 409 (kilit günü açık sayılır)", LV, "if (lock && item.date <= lock) throw", "if (lock && item.date < lock) throw", [MAIN], /beklenen kod period-locked/],
  [6, "UPDATE tetikleyicisi yok (başlık)", MIG, "  CREATE TRIGGER IF NOT EXISTS ledger_vouchers_no_update BEFORE UPDATE ON ledger_vouchers BEGIN SELECT RAISE(ABORT, 'ledger_vouchers değiştirilemez: düzeltme ters kayıt fişiyle'); END;\n", "", [MAIN], /Missing expected exception \(UPDATE başlık\)/],
  [7, "DELETE tetikleyicisi yok (satır)", MIG, "  CREATE TRIGGER IF NOT EXISTS ledger_voucher_lines_no_delete BEFORE DELETE ON ledger_voucher_lines BEGIN SELECT RAISE(ABORT, 'ledger_voucher_lines silinemez: düzeltme ters kayıt fişiyle'); END;\n", "", [MAIN], /Missing expected exception \(DELETE satır\)/],
  [8, "journal() sınıf sırası (kapanış günün sonunda değil)", GL, '  "voucher-close": 99,', '  "voucher-close": 30,', [MAIN], /not ok \d+ - N13[\s\S]*not ok \d+ - N20/],
  [9, "journal() sınıf sırası (açılış günün başında değil)", GL, '  "voucher-open": 1,', '  "voucher-open": 50,', [MAIN], /01\.01'in ilk maddesi açılış/],
  [10, "kapanış + kilit aynı işlemde değil (kilit konmaz)", LV, "          period.setLock(lockThrough);\n", "", [MAIN], /kilit fişlerle aynı işlemde kondu/],
  [11, "aynı fişin ikinci ters kaydı denetlenmez (yalnız indeks kalır)", LV, "if (original.reversedBy) throw", "if (false && original.reversedBy) throw", [MAIN], /beklenen 409, gelen undefined/],
  [12, "Şirket Verisini Sıfırla fişleri silmez", "server/app.mjs", "      Object.assign(counts, clearVouchers(store));\n", "", [LIFE], /sıfırlama raporu fiş sayısını taşır/],
  [13, "sıfırlama tetikleyicileri geri kurmaz", LV, "  const result = fn();\n  store.exec(LEDGER_VOUCHER_TRIGGERS_V46);", "  const result = fn();", [LIFE], /not ok \d+ - N17/],
  [14, "eski sürüm sıfırlamasının açılış onarımı yok", "server/app.mjs", "      context.voucherRepair = repairLegacyReset({ store, now: config.now, log });", "      context.voucherRepair = null;", [LIFE], /not ok \d+ - izi olmayan fiş/],
  [15, "kilit izinde fiş girdisi yok", "server/lib/integrity.mjs", "    requires: [\"ledger_vouchers\", \"ledger_voucher_lines\"],\n    since: \"2.5.0\",", "    requires: [\"ledger_vouchers_yok\"],\n    since: \"2.5.0\",", [MAIN], /kapanmış dönem sapması/],
  [16, "fiş tabloları kapıda değil (FINANCIAL)", "server/lib/db.mjs", '    "ledger_vouchers", "ledger_voucher_lines"]);', "    ]);", [MAIN], /not ok \d+ - N21/],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run([MAIN, LIFE]);
console.log(`taban: ${taban.pass} geçti / ${taban.fail} kaldı (çıkış ${taban.status})`);
if (taban.status !== 0 || taban.fail !== 0 || !(taban.pass > 0)) throw new Error("taban testi yeşil değil — mutasyon taraması anlamsız");
let yakalanan = 0;
let toplam = 0;
for (const [no, ad, dosya, eski, yeni, testler, neden] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  const yol = path.join(COPY, dosya);
  const asil = readFileSync(yol, "utf8");
  const adet = asil.split(eski).length - 1;
  if (adet !== 1) throw new Error(`mutasyon ${no} kurulamadı: eski metin ${adet} kez geçiyor (${dosya})`);
  writeFileSync(yol, asil.replace(eski, yeni));
  let r;
  try {
    r = run(testler);
  } finally {
    writeFileSync(yol, asil);
  }
  const kirmizi = r.status !== 0 && r.fail > 0;
  const nedenli = neden.test(r.out);
  toplam += 1;
  if (kirmizi && nedenli) yakalanan += 1;
  console.log(`${kirmizi && nedenli ? "ok" : "not ok"} ${no} - ${ad} · ${kirmizi ? `KIRMIZI (${r.fail} başarısız)` : "YEŞİL — kaçırdı"} · beklenen neden ${neden} ${nedenli ? "görüldü" : "GÖRÜLMEDİ"}`);
  if (!nedenli) console.log(r.out.split("\n").filter(line => /not ok|Error|beklenen|expected/i.test(line)).slice(0, 12).join("\n"));
}
const son = run([MAIN, LIFE]);
if (son.status !== 0) throw new Error("mutasyonlardan sonra kopya geri yazılamadı (taban kırmızı)");
console.log(`1..${toplam}\n# tests ${toplam}\n# pass ${yakalanan}\n# fail ${toplam - yakalanan}\n# cancelled 0\n# skipped 0\n# todo 0`);
console.log(`${yakalanan}/${toplam} mutasyon beklenen nedenle yakalandı`);
process.exit(yakalanan === toplam ? 0 : 1);
