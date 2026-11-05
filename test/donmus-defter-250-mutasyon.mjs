#!/usr/bin/env node
// 2.5.0 Ç3 — donmuş defterin MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının nedeni okunur).
// Programın ayrı bir kopyasında (ders 23) her seferinde TEK bilerek hata açılır, kopyanın test/donmus-defter-250.test.mjs ve test/donmus-defter-yasam-250.test.mjs dosyaları koşulur:
// çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI. Kopya dosyası her mutasyondan sonra geri yazılır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/donmus-defter-250-mutasyon.mjs --kopya <git archive HEAD kopyası> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;

const LS = "server/lib/ledger-snapshots.mjs";
const MIG = "server/lib/migrations.mjs";
const WORKER = "server/lib/ledger-freeze-worker.mjs";
const MAIN = "test/donmus-defter-250.test.mjs";
const LIFE = "test/donmus-defter-yasam-250.test.mjs";
// [no, ad, dosya, eski metin (dosyada TAM BİR KEZ), yeni metin, koşulacak testler, çıktıda beklenen neden (düzenli ifade)]
const MUTASYONLAR = [
  [1, "kilitli dönemde güncel türetmeye düşme (karma okuma donmuş defteri okumaz)", LS, "    if (!ready()) return live || build();\n    const cover = coverage();\n    if (cover && to && to <= cover)", "    return live || build();\n    const cover = coverage();\n    if (cover && to && to <= cover)", [MAIN], /kilitli yılın Yevmiye Defteri aynı/],
  [2, "donmuş satır kaybı (iş parçacığı son parçadan bir satır düşürür)", WORKER, "const part = rows.slice(at, at + size);", "const part = rows.slice(at, Math.min(at + size, rows.length - 1));", [MAIN], /uç dondurma bittikten sonra yanıt verir/],
  [3, "donmuş satır kaybı (okuma kapsam gününü atlar)", LS, "FROM ledger_snapshots WHERE date <= ? AND date >= ? ORDER BY date, run, run_seq", "FROM ledger_snapshots WHERE date < ? AND date >= ? ORDER BY date, run, run_seq", [MAIN], /donmuş maddeler = canlı türetme/],
  [4, "kilit günü donmaz (aralık kilit gününü dışlar)", LS, "if (!(entry.date > from && entry.date <= through)) continue;", "if (!(entry.date > from && entry.date < through)) continue;", [MAIN], /donmuş maddeler = canlı türetme \(kilit günü dahil\)/],
  [5, "kilit ile donma ayrışması (kanca önceki kilidi dondurur)", "server/routes/ledger.mjs", "snapshots.lockChanged({ previous, next: value, user, reason: \"lock\" });", "snapshots.lockChanged({ previous, next: previous, user, reason: \"lock\" });", [MAIN], /uç dondurma bittikten sonra yanıt verir|kapsam = kilit/],
  [6, "geri çekmede iz yok", LS, "    trace(THAWED_TRACE, run.no, user, { from: cover, through: next, reason });\n", "", [MAIN], /geri çekme izi/],
  [7, "fark denetimi susuyor", LS, "if (a && b && contentOf(a) === contentOf(b)) continue;", "continue;", [MAIN], /Kural Değişikliği Farkı görünür/],
  [8, "göçte 2.5.0 kuralı kullanılıyor", MIG, "VALUES (1, ?, 'freeze', 'pending', '', ?, '2.4.9', 'migration', 'system', ?)", "VALUES (1, ?, 'freeze', 'pending', '', ?, '2.5.0', 'migration', 'system', ?)", [LIFE], /not ok \d+ - F11[\s\S]*rule: '2\.5\.0'/],
  [9, "UPDATE tetikleyicisi yok (satır)", MIG, "  CREATE TRIGGER IF NOT EXISTS ledger_snapshots_no_update BEFORE UPDATE ON ledger_snapshots BEGIN SELECT RAISE(ABORT, 'ledger_snapshots değiştirilemez: donmuş defter'); END;\n", "", [MAIN], /Missing expected exception \(UPDATE satır\)|UPDATE satır/],
  [10, "DELETE tetikleyicisi yok (satır)", MIG, "    BEGIN SELECT RAISE(ABORT, 'ledger_snapshots silinemez: donmuş defter (kilit geri çekilmeden)'); END;", "    BEGIN SELECT 1; END;", [MAIN], /DELETE satır \(kapsam içi, izli\)/],
  [11, "Şirket Verisini Sıfırla donmuş defteri silmez", "server/app.mjs", "      Object.assign(counts, clearSnapshots(store));\n", "", [MAIN, LIFE], /sıfırlama raporu donmuş satır sayısını taşır|ledger_snapshot_runs/],
  [12, "eski sürüm kilidinin açılış onarımı yok", "server/app.mjs", "      context.snapshotRepair = context.ledger.snapshots.repairOnOpen();", "      context.snapshotRepair = null;", [LIFE], /not ok \d+ - F12/],
  [13, "postAll lockThrough dondurmaz (kanca çağrılmaz)", "server/lib/ledger-vouchers.mjs", "          onLockChanged?.({ previous, next: lockThrough, user, reason: \"voucher-closing\" });\n", "", [MAIN], /kapsam aynı işlemde kilide geldi/],
  [14, "kaynak izi denetimi yok", LS, "if (last.kind === \"freeze\" && last.through === cover && last.source_digest &&", "if (false && last.kind === \"freeze\" && last.through === cover && last.source_digest &&", [MAIN], /Donmuş Defter bulgusu/],
  [15, "bayat satırlar temizlenmez", LS, "      if (closed) return removed;\n      const n = store.tx(", "      return removed;\n      const n = store.tx(", [MAIN], /açılan dönemin donmuş satırları kalktı/],
  [16, "2.4.9 kopyası değişti (649 yerine 642)", "server/lib/ledger-rule-249/general-ledger.mjs", "moneyOf(row), \"649\", row.amount);", "moneyOf(row), \"642\", row.amount);", [MAIN, LIFE], /v2\.4\.9 kopyası değişti/],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run([MAIN, LIFE]);
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
