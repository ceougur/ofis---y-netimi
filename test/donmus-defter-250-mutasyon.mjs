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
const NEW = "test/donmus-defter-bellek-250.test.mjs";
const LEAN = "server/lib/lean-rows.mjs";
// Ç3 tur 2 (kilit ucu: sıra + arkada dondurma; tasarım notu §18).
const ROUTE = "server/routes/ledger.mjs";
const KU = "test/donmus-defter-kilit-ucu-250.test.mjs";
const T2_ORDER_BEFORE = [
  "    beforeLock(target, body?.force === true);\n",
  "    const previous = period.lockedUntil();\n",
  "    // 2.5.0 Ç3 (§4): başka güne süren dondurma durdurulur; bayat satırlar (geri çekilmiş dönem) kilitten önce parça parça silinir.\n",
  "    const waiting = snapshots.state().pending;\n",
  "    let stopped = false;\n",
  "    if (waiting && waiting.through !== target) {\n",
  "      await snapshots.cancel();\n",
  "      stopped = true;\n",
  "    }\n",
].join("");
// İptal ön adımdan ÖNCE (eski sıra): POS'u reddedilen istek süren dondurmayı durdurur.
const T2_ORDER_AFTER = T2_ORDER_BEFORE.replace("    beforeLock(target, body?.force === true);\n", "").replace("      stopped = true;\n    }\n", "      stopped = true;\n    }\n    beforeLock(target, body?.force === true);\n");
// [no, ad, dosya, eski metin (dosyada TAM BİR KEZ), yeni metin, koşulacak testler, çıktıda beklenen neden (düzenli ifade)]
const MUTASYONLAR = [
  [1, "kilitli dönemde güncel türetmeye düşme (karma okuma donmuş defteri okumaz)", LS, "    if (!ready()) return live || build();\n    const cover = coverage();\n    if (cover && to && to <= cover)", "    return live || build();\n    const cover = coverage();\n    if (cover && to && to <= cover)", [MAIN], /kilitli yılın Yevmiye Defteri aynı/],
  // 2 (Ç3 tamamlama): satırlar artık parça parça üretilir (snapshotBatches) — aynı hata, yeni yerinde: son parçadan bir satır düşer.
  // 2 ve 5 (Ç3 tur 2): F1'in iletisi "uç dondurma bittikten sonra yanıt verir" → "dondurma bitti" (uç artık beklemez; beklenen neden aynı denetim).
  [2, "donmuş satır kaybı (son parçadan bir satır düşer)", LS, "  if (part.length) yield part;\n}", "  if (part.length) yield part.slice(0, -1);\n}", [MAIN], /dondurma bitti: |uç dondurma bittikten sonra yanıt verir/],
  [3, "donmuş satır kaybı (okuma kapsam gününü atlar)", LS, "FROM ledger_snapshots WHERE date <= ? AND date >= ? ORDER BY date, run, run_seq", "FROM ledger_snapshots WHERE date < ? AND date >= ? ORDER BY date, run, run_seq", [MAIN], /donmuş maddeler = canlı türetme/],
  [4, "kilit günü donmaz (aralık kilit gününü dışlar)", LS, "if (!(entry.date > from && entry.date <= through)) continue;", "if (!(entry.date > from && entry.date < through)) continue;", [MAIN], /donmuş maddeler = canlı türetme \(kilit günü dahil\)/],
  [5, "kilit ile donma ayrışması (kanca önceki kilidi dondurur)", "server/routes/ledger.mjs", "snapshots.lockChanged({ previous, next: value, user, reason: \"lock\" });", "snapshots.lockChanged({ previous, next: previous, user, reason: \"lock\" });", [MAIN], /dondurma bitti: |uç dondurma bittikten sonra yanıt verir|kapsam = kilit/],
  [6, "geri çekmede iz yok", LS, "    trace(THAWED_TRACE, run.no, user, { from: cover, through: next, reason });\n", "", [MAIN], /geri çekme izi/],
  // 7 (Ç3 tamamlama): fark denetimi akışlı (differ) — aynı hata, yeni yerinde.
  [7, "fark denetimi susuyor", LS, "if (a && b && contentOf(a) === contentOf(b)) return;", "return;", [MAIN], /Kural Değişikliği Farkı görünür/],
  [8, "göçte 2.5.0 kuralı kullanılıyor", MIG, "VALUES (1, ?, 'freeze', 'pending', '', ?, '2.4.9', 'migration', 'system', ?)", "VALUES (1, ?, 'freeze', 'pending', '', ?, '2.5.0', 'migration', 'system', ?)", [LIFE], /not ok \d+ - F11[\s\S]*rule: '2\.5\.0'/],
  [9, "UPDATE tetikleyicisi yok (satır)", MIG, "  CREATE TRIGGER IF NOT EXISTS ledger_snapshots_no_update BEFORE UPDATE ON ledger_snapshots BEGIN SELECT RAISE(ABORT, 'ledger_snapshots değiştirilemez: donmuş defter'); END;\n", "", [MAIN], /Missing expected exception \(UPDATE satır\)|UPDATE satır/],
  [10, "DELETE tetikleyicisi yok (satır)", MIG, "    BEGIN SELECT RAISE(ABORT, 'ledger_snapshots silinemez: donmuş defter (kilit geri çekilmeden)'); END;", "    BEGIN SELECT 1; END;", [MAIN], /DELETE satır \(kapsam içi, izli\)/],
  [11, "Şirket Verisini Sıfırla donmuş defteri silmez", "server/app.mjs", "      Object.assign(counts, clearSnapshots(store));\n", "", [MAIN, LIFE], /sıfırlama raporu donmuş satır sayısını taşır|ledger_snapshot_runs/],
  [12, "eski sürüm kilidinin açılış onarımı yok", "server/app.mjs", "      context.snapshotRepair = context.ledger.snapshots.repairOnOpen();", "      context.snapshotRepair = null;", [LIFE], /not ok \d+ - F12/],
  [13, "postAll lockThrough dondurmaz (kanca çağrılmaz)", "server/lib/ledger-vouchers.mjs", "          onLockChanged?.({ previous, next: lockThrough, user, reason: \"voucher-closing\" });\n", "", [MAIN], /kapsam aynı işlemde kilide geldi/],
  [14, "kaynak izi denetimi yok", LS, "if (last.kind === \"freeze\" && last.through === cover && last.source_digest &&", "if (false && last.kind === \"freeze\" && last.through === cover && last.source_digest &&", [MAIN], /Donmuş Defter bulgusu/],
  [15, "bayat satırlar temizlenmez", LS, "      if (halted()) return removed;\n      const n = store.tx(", "      return removed;\n      const n = store.tx(", [MAIN], /açılan dönemin donmuş satırları kalktı/],
  [16, "2.4.9 kopyası değişti (649 yerine 642)", "server/lib/ledger-rule-249/general-ledger.mjs", "moneyOf(row), \"649\", row.amount);", "moneyOf(row), \"642\", row.amount);", [MAIN, LIFE], /v2\.4\.9 kopyası değişti/],
  // Ç3 tamamlama (1.000.000 satırda bellek taşması; tasarım notu §16): sıkı okumanın her yeri.
  [17, "türetme kaynak satırlarını yine store.all ile okur (routes/ledger.mjs rows)", "server/routes/ledger.mjs", "(query ? leanAll(store, sql, ", "(query ? store.all(sql, ", [NEW], /güncel kural: kaynak sorguları store\.all'a düşmemeli/],
  [18, "2.4.9 kopyası ana iş parçacığında sıkı depo olmadan", LS, "[RULE_249]: () => buildRule249(leanStore(store))", "[RULE_249]: () => buildRule249(store)", [NEW], /sıkı depo olmadan çağrılıyor|dondurma \(2\.4\.9 kuralı, ana iş parçacığı\)/],
  [19, "2.4.9 kopyası iş parçacığında sıkı depo olmadan", WORKER, "entries = buildRule249(leanStore(store));", "entries = buildRule249(store);", [NEW], /sıkı depo olmadan çağrılıyor/],
  [20, "donmuş okuma yine store.all ile", LS, "    for (const row of leanRows(\n      store,\n", "    for (const row of ((s, sql, args) => s.all(sql, ...args))(\n      store,\n", [NEW], /donmuş okuma ve fark denetimi store\.all'a düşmemeli/],
  [21, "sıkı satırlar kopyalanmaz (sözlük kipli satır geçer)", LEAN, "    yield out;\n", "    yield row;\n", [NEW], /sıkı satırlar hızlı kipte olmalı/],
  [22, "kilit izi yine store.all ile (bütün kaynak satırları dizide)", "server/lib/integrity.mjs", "for (const row of eachRow(store, sql, [lock]))", "for (const row of store.all(sql, lock))", [NEW], /dondurma \(2\.4\.9 kuralı, ana iş parçacığı\): kaynak sorguları store\.all'a düşmemeli/],
  [23, "akışlı fark denetimi yalnız güncelde olan maddeleri saymaz", LS, "    for (const b of current.values()) differ(undefined, b);\n", "", [NEW], /akışlı fark denetimi = önceki/],
  // Ç3 tur 2 (201–207; tur 1'in numaralarıyla çakışmasın diye 200'lü): kilit ucu sırası (DÜŞÜK-1 → ORTA) ve arkada dondurma (plan §8 İLERLEME).
  [201, "sıra: doğrulama iptalden sonra (geçersiz istek süren dondurmayı durdurur)", ROUTE, "    const target = period.checkLock(body?.lockedUntil);\n", "    const target = String(body?.lockedUntil ?? \"\").trim();\n", [KU], /reddedilen istek süren dondurmayı durdurdu/],
  [202, "sıra: iptal POS ön adımından önce (ön adımı reddedilen istek süren dondurmayı durdurur)", ROUTE, T2_ORDER_BEFORE, T2_ORDER_AFTER, [KU], /ön adımı reddedilen istekten sonra dondurma sürüyor/],
  [203, "erken yanıt yok (uç dondurmayı bekler)", ROUTE, "    await settleWithin(afterLock(lockedUntil).traced, LOCK_TRACE_WAIT_MS);\n", "    await afterLock(lockedUntil).job;\n", [KU], /uç dondurmayı bekledi/],
  [208, "uç kilit izini beklemez (iz bekliyorken tam kapının ikinci katmanı yok; D8)", ROUTE, "    await settleWithin(afterLock(lockedUntil).traced, LOCK_TRACE_WAIT_MS);\n", "    afterLock(lockedUntil);\n", [KU], /kilit izi yanıttan önce benimsendi/],
  [209, "iz bütçesiz beklenir (büyük şirkette yanıt izi sonuna kadar bekler; 1 M'de ~29 sn)", ROUTE, "    await settleWithin(afterLock(lockedUntil).traced, LOCK_TRACE_WAIT_MS);\n", "    await afterLock(lockedUntil).traced;\n", [KU], /iz bütçesi dolunca yanıt/],
  [204, "durdurulan koşu sahipsiz kalır (kilit yazılamayınca önceki koşu sürdürülmez)", ROUTE, "      if (stopped) afterLock(period.lockedUntil());\n", "", [KU], /durdurulan koşu sahipsiz kaldı/],
  [205, "kapanış arka işi beklemez (iş kapalı bağlantıya çarpar)", ROUTE, "      closing = true;\n      await snapshots.close();\n      await Promise.allSettled([...lockJobs]);\n", "      await snapshots.close();\n", [KU], /kapanıştan sonra arka iş kapalı bağlantıya çarpmadı/],
  [206, "ilerleme görünümü arka işi saymaz (temizlik / iz sırasında 'bitti' görünür)", ROUTE, "active: Boolean(status.running || lockJobs.size)", "active: Boolean(status.running)", [KU, MAIN], /yanıtta süren iş/],
  [207, "gelecek tarih denetimi yok (kilit ucu yazmadan önce denetlemez)", "server/lib/period.mjs", "    if (date && date > today()) throw new HttpError(400, \"Gelecekteki bir dönem kilitlenemez.\");\n    return date;\n  }", "    return date;\n  }", [KU], /2099-01-01: 200|2099-01-01: \d+/],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run([MAIN, LIFE, NEW, KU]);
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
