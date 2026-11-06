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
// Ç3 tur 1 (dar kontrol ORTA-1/2/3, K4, DÜŞÜK-3, §5 kural kayıt defteri; tasarım notu §17).
const TUR1 = "test/donmus-defter-tur1-250.test.mjs";
// Ç3 tur 2 (kilit ucu: sıra + arkada dondurma; tasarım notu §18).
const ROUTE = "server/routes/ledger.mjs";
const KU = "test/donmus-defter-kilit-ucu-250.test.mjs";
// Ç3 tur 3 (birleşik Ç3 tur 1-2 dar kontrolünün bulguları + Ç3 küçük işler + S46; tasarım notu §19).
const T3 = "test/donmus-defter-tur3-250.test.mjs";
// Ç3 tur 4 (Ç3 tur 3 dar kontrolünün bulguları: ORTA-1 S46 planı, DÜŞÜK-1 test dişi; tasarım notu §20).
const T4 = "test/donmus-defter-tur4-250.test.mjs";
const E2E = "test/e2e/senaryo-donem-kilidi-ilerleme-250.mjs";
const RC = "server/routes/report-center.mjs";
const ADMIN = "client/assets/admin.js";
// 202 (Ç3 tur 4): durdurma koşuluna "kilit değişmiyorsa durdurma" eklendi — aynı hata, yeni metinde.
const T2_ORDER_BEFORE = [
  "    beforeLock(target, body?.force === true);\n",
  "    const previous = period.lockedUntil();\n",
  "    // 2.5.0 Ç3 (§4): başka güne süren dondurma durdurulur; bayat satırlar (geri çekilmiş dönem) kilitten önce parça parça silinir.\n",
  "    // Ç3 tur 4 (ORTA-1): kilit DEĞİŞMİYORSA (aynı güne yeniden kaydetme) bekleyen koşu — günü kilitten önce olsa da (yeniden donma planının ilk dilimi, ilerletilmiş kilitte\n",
  "    // eski kurallı koşu) — durdurulmaz; lockChanged onu sürdürür (aynı ayrım lockNeedsCleanup'ta).\n",
  "    const waiting = snapshots.state().pending;\n",
  "    let stopped = false;\n",
  "    if (waiting && waiting.through !== target && target !== previous) {\n",
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
  // 15 (Ç3 tur 3): temizlik tek döngü + yazılan koşu koruması — aynı hata, yeni yerinde.
  [15, "bayat satırlar temizlenmez", LS, "        if (halted()) return removed;\n        if (keptRun()) return removed;\n        const n = store.tx(", "        return removed;\n        const n = store.tx(", [MAIN], /açılan dönemin donmuş satırları kalktı/],
  [16, "2.4.9 kopyası değişti (649 yerine 642)", "server/lib/ledger-rule-249/general-ledger.mjs", "moneyOf(row), \"649\", row.amount);", "moneyOf(row), \"642\", row.amount);", [MAIN, LIFE], /v2\.4\.9 kopyası değişti/],
  // Ç3 tamamlama (1.000.000 satırda bellek taşması; tasarım notu §16): sıkı okumanın her yeri.
  [17, "türetme kaynak satırlarını yine store.all ile okur (routes/ledger.mjs rows)", "server/routes/ledger.mjs", "(query ? leanAll(store, sql, ", "(query ? store.all(sql, ", [NEW], /güncel kural: kaynak sorguları store\.all'a düşmemeli/],
  [18, "2.4.9 kopyası ana iş parçacığında sıkı depo olmadan", LS, "[RULE_249]: () => buildRule249(leanStore(store))", "[RULE_249]: () => buildRule249(store)", [NEW], /sıkı depo olmadan çağrılıyor|dondurma \(2\.4\.9 kuralı, ana iş parçacığı\)/],
  [19, "2.4.9 kopyası iş parçacığında sıkı depo olmadan", WORKER, "entries = buildRule249(leanStore(store));", "entries = buildRule249(store);", [NEW], /sıkı depo olmadan çağrılıyor/],
  [20, "donmuş okuma yine store.all ile", LS, "    for (const row of leanRows(\n      store,\n", "    for (const row of ((s, sql, args) => s.all(sql, ...args))(\n      store,\n", [NEW], /donmuş okuma ve fark denetimi store\.all'a düşmemeli/],
  [21, "sıkı satırlar kopyalanmaz (sözlük kipli satır geçer)", LEAN, "    yield out;\n", "    yield row;\n", [NEW], /sıkı satırlar hızlı kipte olmalı/],
  [22, "kilit izi yine store.all ile (bütün kaynak satırları dizide)", "server/lib/integrity.mjs", "for (const row of eachRow(store, sql, [lock]))", "for (const row of store.all(sql, lock))", [NEW], /dondurma \(2\.4\.9 kuralı, ana iş parçacığı\): kaynak sorguları store\.all'a düşmemeli/],
  [23, "akışlı fark denetimi yalnız güncelde olan maddeleri saymaz", LS, "    for (const b of current.values()) differ(undefined, b);\n", "", [NEW], /akışlı fark denetimi = önceki/],
  // Ç3 tur 1.
  [24, "ORTA-1: donmuş mizan önbelleği yine koşu numarasıyla (sıfırlamada 1'den başlar)", LS, "const key = `${lastDone()?.id || \"\"}|${cover}|${version}|${from}|${upper}`;", "const key = `${cover}|${store.get(\"SELECT COALESCE(MAX(no), 0) AS n FROM ledger_snapshot_runs\").n}|${version}|${from}|${upper}`;", [TUR1], /mizan eski veriyi gösteriyor \(önbellek\)/],
  [25, "ORTA-2: açılış onarımı eksik donmuş satırı görmez", LS, "    if (totalsMatch(seen, last)) return null;\n", "    return null;\n", [TUR1], /boş donmuş defterden okunuyor/],
  [26, "ORTA-2: onarımın geri çekmesi toplamı 'önceki − kaldırılan'la (satırlar zaten silinmiş)", LS, "thaw({ next: damaged.through, user: null, reason: \"repair\", known: visibleTotals(damaged.through) });", "thaw({ next: damaged.through, user: null, reason: \"repair\" });", [TUR1], /Donmuş Defterde Eksik Satır/],
  [27, "ORTA-2: sağlama noktası yok (her zaman baştan)", LS, "totalsMatch(visibleTotals(run.through), run)) return { ...found, through: run.through };", "totalsMatch(visibleTotals(run.through), run)) return { ...found, through: \"\" };", [TUR1], /sağlama noktası 30\.06 olmalı/],
  [28, "ORTA-3 ailesi: eski kurallı bekleyen koşu başka güne kilitte güncel kurala geçer", LS, "if (pending && pending.rule_version !== LEDGER_RULE_VERSION && target > cover) return carryLock(", "if (false && pending && pending.rule_version !== LEDGER_RULE_VERSION && target > cover) return carryLock(", [TUR1], /ilerletilen kilit eski kurallı dönemi güncel kurala geçirdi/],
  [29, "ORTA-3 ailesi: koşunun içine çekilen kilit güncel kuralla", LS, "through: target, rule, reason: pending.reason, user });", "through: target, rule: LEDGER_RULE_VERSION, reason: pending.reason, user });", [TUR1], /koşunun içine çekilen kilit güncel kurala geçti/],
  [30, "ORTA-3 ailesi (eşzamanlı): kalan dönem güncel kural yerine GAP_RULE", LS, "from: pending.through, through: target, rule: LEDGER_RULE_VERSION, reason, user });\n    freezeInTx(run, user);", "from: pending.through, through: target, rule: GAP_RULE, reason, user });\n    freezeInTx(run, user);", [TUR1], /eşzamanlı kilit eski kurallı dönemi güncel kurala geçirdi/],
  [31, "ORTA-3 ailesi: ilerletme izi okunmaz (kalan dönem GAP_RULE)", LS, "if (extended.through > run.through) return insertRun(", "if (false && extended.through > run.through) return insertRun(", [TUR1], /ilerletilen kilit eski kurallı dönemi güncel kurala geçirdi/],
  [32, "ORTA-3 ailesi: iş parçacığı yolunda kalan dönem açılmaz", LS, "          continueAfter(run);\n        });\n        // Kapının", "        });\n        // Kapının", [TUR1], /ilerletilen kilit eski kurallı dönemi güncel kurala geçirdi/],
  [33, "ORTA-3 ailesi: bilinmeyen kuralın nedeni ilerlemede görünmez", LS, "if (!ruleKnown(run.rule_version)) throw new Error(`bekleyen dondurmanın kuralı", "if (false) throw new Error(`bekleyen dondurmanın kuralı", [TUR1], /not ok \d+ - ORTA-3 ailesi: kuralı bu programda olmayan/],
  [34, "ORTA-3 ailesi: bilinmeyen kural Mutabakat Testi'nde görünmez", LS, "    if (unknownRule) {\n", "    if (false) {\n", [TUR1], /bilinmeyen kuralın bekleyen koşusu Mutabakat Testi'nde görünmüyor/],
  [35, "ORTA-3 ailesi (açılış): kilit ötesindeki eski kurallı koşu bırakılır", LS, "      if (pending && pending.through !== lock && !(carried && pending.through < lock)) {", "      if (pending && pending.through !== lock) {", [TUR1], /not ok \d+ - ORTA-3 ailesi \(yarıda kesilme\)/],
  [36, "K4: nedeni bilinmeyen ayrışma yine 'kural değişti'", LS, "  return `Kilitli dönemin donmuş defteri güncel türetmeden farklı: neden", "  return `Defter kuralı program sürümüyle değişti. Kilitli dönemin donmuş defteri güncel türetmeden farklı: neden", [TUR1], /nedeni bilinmeyen ayrışma "kural değişti" diye adlandırılıyor/],
  [37, "K4: eksik satır 'kural değişikliği' diye adlandırılır", LS, "  if (rowsBroken) return", "  if (false) return", [TUR1], /eksik satır "kural değişikliği" diye adlandırılıyor/],
  [38, "K4: denetim adı Yazım düzeni dışında", LS, "ve Öncesi` : \"Yok\"}", "ve öncesi` : \"yok\"}", [TUR1], /Yazım düzeni/],
  [39, "§5: kural geçmişinden sürüm silinir", LS, "export const RULE_HISTORY = Object.freeze([\"2.4.9\", \"2.5.0\"]);", "export const RULE_HISTORY = Object.freeze([\"2.5.0\"]);", [TUR1], /kural geçmişinden sürüm silindi/],
  [40, "§5: kayıt defterinden 2.4.9 kuralı düşer", LS, ", [RULE_249]: () => buildRule249(leanStore(store)) };", " };", [TUR1], /kayıt defteri = kural geçmişi/],
  [41, "DÜŞÜK-3: ara dilim her okumada yeniden kurulur", LS, "    if (key && middleCache?.key === key) {\n", "    if (false) {\n", [TUR1], /ara dilim her okumada yeniden kuruluyor/],
  [42, "DÜŞÜK-3: 'aynı' bilgisi güncel dilimin parmak izi sınanmadan kullanılır", LS, "      if (middleCache.print === printOf(freshRange)) return freshRange;\n", "      return freshRange;\n", [TUR1], /kural farkında ara dilim 2\.4\.9'dan/],
  [43, "DÜŞÜK-3: dondurmanın kendi yazımları önbellek anahtarını değiştirir", LS, "    ownChanges += Number(result?.changes) || 0;\n", "", [TUR1], /dondurma parçaları yazılırken ara dilim her parçada yeniden kuruldu/],
  [44, "DÜŞÜK-3: kilitli yılın Yevmiye Defteri güncel türetmeyi de kurar", LS, "    if (carried && to && to <= carried.through) return", "    if (false && carried && to && to <= carried.through) return", [TUR1], /iki tam türetme/],
  [45, "DÜŞÜK-3: ara dilim from'dan önce bitse de kurulur", LS, "    if (from && from > pending.through) return tail;\n", "", [TUR1], /from > bekleyen gün/],
  [46, "DÜŞÜK-3: işlem içinde okunan ara dilim saklanır (GG2)", LS, "    if (store.inTransaction) return \"\";\n    try {\n      const counters", "    try {\n      const counters", [TUR1], /işlem içinde okunan ara dilim saklanmamalı/],
  // Ç3 tur 2 (201–207; tur 1'in numaralarıyla çakışmasın diye 200'lü): kilit ucu sırası (DÜŞÜK-1 → ORTA) ve arkada dondurma (plan §8 İLERLEME).
  [201, "sıra: doğrulama iptalden sonra (geçersiz istek süren dondurmayı durdurur)", ROUTE, "    const target = period.checkLock(body?.lockedUntil);\n", "    const target = String(body?.lockedUntil ?? \"\").trim();\n", [KU], /reddedilen istek süren dondurmayı durdurdu/],
  [202, "sıra: iptal POS ön adımından önce (ön adımı reddedilen istek süren dondurmayı durdurur)", ROUTE, T2_ORDER_BEFORE, T2_ORDER_AFTER, [KU], /ön adımı reddedilen istekten sonra dondurma sürüyor/],
  // 203 / 208 / 209 (Ç3 tur 3): bekleme bütçesi bütün uca (bayat satır temizliği + arka iş) → budget(); aynı hatalar, yeni metinde.
  [203, "bütçe yok (uç dondurmanın bitmesini sınırsız bekler; 1 M'de 30 sn sınırı)", ROUTE, "    await settleWithin(afterLock(lockedUntil).job, budget());\n", "    await afterLock(lockedUntil).job;\n", [KU], /uç dondurmayı bekledi/],
  [208, "uç arka işi hiç beklemez (iz bekliyorken tam kapının ikinci katmanı yok — D8; kısa kilitte de yanıttan sonra yazım)", ROUTE, "    await settleWithin(afterLock(lockedUntil).job, budget());\n", "    afterLock(lockedUntil);\n", [KU], /kilit izi yanıttan önce benimsendi/],
  [209, "uç yalnız izi bekler (kısa dondurma da yanıttan sonra biter; kilitten hemen sonraki sayım fotoğrafı bozulur)", ROUTE, "    await settleWithin(afterLock(lockedUntil).job, budget());\n", "    await settleWithin(afterLock(lockedUntil).traced, budget());\n", [MAIN], /uç dondurma bittikten sonra yanıt verir/],
  [204, "durdurulan koşu sahipsiz kalır (kilit yazılamayınca önceki koşu sürdürülmez)", ROUTE, "      if (stopped) afterLock(period.lockedUntil());\n", "", [KU], /durdurulan koşu sahipsiz kaldı/],
  [205, "kapanış arka işi beklemez (iş kapalı bağlantıya çarpar)", ROUTE, "      closing = true;\n      await snapshots.close();\n      await Promise.allSettled([...lockJobs]);\n", "      await snapshots.close();\n", [KU], /kapanıştan sonra arka iş kapalı bağlantıya çarpmadı/],
  [206, "ilerleme görünümü arka işi saymaz (temizlik / iz sırasında 'bitti' görünür)", ROUTE, "active: Boolean(status.running || status.cleanup?.running || lockJobs.size)", "active: Boolean(status.running)", [KU, MAIN], /yanıtta süren iş/],
  [207, "gelecek tarih denetimi yok (kilit ucu yazmadan önce denetlemez)", "server/lib/period.mjs", "    if (date && date > today()) throw new HttpError(400, \"Gelecekteki bir dönem kilitlenemez.\");\n    return date;\n  }", "    return date;\n  }", [KU], /2099-01-01: 200|2099-01-01: \d+/],
  // Ç3 tur 3 (300'lü; tasarım notu §19): YÜKSEK-1 (yazılan koşunun satırları silinmez; koşu tablo doğrulanmadan tamamlanmaz), ORTA-1 (temizlik bütçesi + 409), DÜŞÜK-1 ve
  // Ç3 küçük işler (istemci: E2E), S46 = A (açılış onarımının yeniden donma kuralı).
  [301, "YÜKSEK-1: yazılan koşu korunmaz (temizlik süren koşunun satırlarını siler)", LS, "  const keptRun = () => (writing && stillPending(writing) ? writing : 0);", "  const keptRun = () => 0;", [KU, T3], /süren koşunun yazdığı satırları sildi|süren koşunun satırlarını sildi/],
  [302, "YÜKSEK-1: yazım bayrağı konmaz (temizlik süren koşuyu görmez)", LS, "        writing = run.no;\n", "", [KU, T3], /süren koşunun yazdığı satırları sildi|süren koşunun satırlarını sildi/],
  [303, "YÜKSEK-1: koşu sayaçla tamamlanır (tablo doğrulaması yok)", LS, "    if (!(table.lines === totals.lines && table.debit === totals.debit && table.credit === totals.credit && table.weight === totals.weight)) {", "    if (false) {", [T3], /eksik satırlı koşu tamamlandı/],
  [304, "YÜKSEK-1: iş parçacığı yolunda tablo yerine sayaç ölçülür", LS, "        const table = await runTotalsInParts(run.no, seq);", "        const table = { ...own };", [T3], /eksik satırlı koşu tamamlandı/],
  [311, "ORTA-1: temizlik bütçesiz beklenir (1 M'de 30 sn sınırı)", ROUTE, "), budget());\n        if (snapshots.lockNeedsCleanup(target)) {", "), 24 * 60 * 60 * 1000);\n        if (snapshots.lockNeedsCleanup(target)) {", [T3], /uç 5 sn bütçesini aştı/],
  [312, "ORTA-1: temizlik denetimi yok (kilit işleminin içinde büyük DELETE, 409 yok)", ROUTE, "      if (snapshots.lockNeedsCleanup(target)) {\n        await settleWithin", "      if (false) {\n        await settleWithin", [T3], /yeniden kilit 409 almalı/],
  [313, "ORTA-1: açılıştaki temizlik süren iş sayılmaz (kart 'bitti' görür, Kilitle açılır)", ROUTE, "active: Boolean(status.running || status.cleanup?.running || lockJobs.size)", "active: Boolean(status.running || lockJobs.size)", [T3], /açılıştaki temizlik süren iş sayılmıyor/],
  [314, "ORTA-1: temizliğin ilerlemesi görünmez", LS, "cleanup: { running: Boolean(cleanup), removed: cleanupRemoved }", "cleanup: { running: false, removed: 0 }", [T3], /temizliği sürüyor \(tutuldu\)|temizlik tutuluyor|açılışta temizlik sürüyor/],
  [321, "DÜŞÜK-1: kilit kaldırılınca da 'donduruldu' bildirimi", ADMIN, "if (!freeze?.pending && view?.lockedUntil && view.frozenThrough === view.lockedUntil) HOF.toast(", "if (!freeze?.pending) HOF.toast(", [E2E], /✗ kilit kaldırılınca "donduruldu"/],
  [322, "Kilitle dondurma / temizlik sürerken pasif değil", ADMIN, "    save.disabled = lockSaving || Boolean(lockBusy);", "    save.disabled = lockSaving;", [E2E], /✗ dondurma sürerken Kilitle pasif/],
  [323, "Ç3 küçük işler (c): Mutabakat Testi hatasında satır sessizce boşalır", ADMIN, "      health.textContent = `Mutabakat Testi çalıştırılamadı: ${error?.message || String(error)}`;", "      health.textContent = \"\";", [E2E], /✗ mutabakat satırı/],
  [324, "pasif düğmenin nedeni yazılmaz", ADMIN, "      note.textContent = lockBusy;", "      note.textContent = \"\";", [E2E], /✗ pasif düğmenin nedeni görünür|✗ temizlik sürerken Kilitle pasif, nedeni görünür/],
  [331, "Ç3 küçük işler (a): alt başlık yine 'Defter kuralı program sürümüyle değişti'", RC, "`${ruleDiff.hint || \"Kilitli dönemin donmuş defteri güncel türetmeden farklı.\"} Yeni işlemler engellenmez (aşağıda “Kural Değişikliği Farkı”).`", "\"Defter kuralı program sürümüyle değişti (aşağıda “Kural Değişikliği Farkı”). Kilitli dönemin raporları donmuş defterden okunur, değişmez; yeni işlemler engellenmez.\"", [T3], /"kural değişti" diye adlandırıyor/],
  [341, "Ç3 küçük işler (b): kesik kayıt Mutabakat Testi'ni düşürür (500)", ROUTE, "log: service.recent(50).map(logRow) });", "log: service.recent(50).map(row => ({ ...row, detail: JSON.parse(row.detail || \"[]\") })) });", [T3], /Mutabakat Testi kesik kayıtla düştü: 500/],
  [342, "Ç3 küçük işler (b): okunamayan ayrıntı boş sayılır (ders 4)", ROUTE, "detail: null, detailUnreadable: true, detailNote:", "detail: [], detailNote:", [T3], /okunamadı diye işaretli|boş dizi değil/],
  [351, "S46 karşı seçenek B: eksilen dönem her durumda 2.4.9 kopyasıyla", LS, "      const rule = traced ? segment.rule : GAP_RULE;", "      const rule = GAP_RULE;", [T3], /kuralıyla yeniden dondu \(S46 = A/],
  [352, "S46: izsiz dönem de koşunun kendi kuralıyla (S13 çiğnenir)", LS, "      const rule = traced ? segment.rule : GAP_RULE;", "      const rule = segment.rule;", [T3, TUR1], /izsiz dönem GAP_RULE ile donmalı|yeniden donan dönem GAP_RULE \(S13 = A\)/],
  [353, "S46: yeniden donma planı sürdürülmez (kalan dilimler GAP_RULE)", LS, "    if (plan.length) return insertPlanned(plan, run.through, { extended: extended.through > run.through ? extended : null });\n", "", [T3], /plan dilimleri kendi kurallarıyla donmalı/],
  // Ç3 tur 4 (400'lü; tasarım notu §20): ORTA-1 (S46 = A planı yeniden açılışta ve aynı güne yeniden kaydetmede korunur; S13 = A eşi) — dar kontrolün önerdiği bozulmalar.
  [401, "ORTA-1: açılış onarımının 'taşınan koşu' kararı yalnız kurala bakar (güncel kurallı plan dilimi bırakılır)", LS, "const carried = Boolean(pending && (pending.rule_version !== LEDGER_RULE_VERSION || planOf(pending.no).length || extendedOf(pending.no).through > pending.through));", "const carried = Boolean(pending && pending.rule_version !== LEDGER_RULE_VERSION);", [T4], /kuralıyla dondu \(S46 = A: 2\.5\.0\)/],
  [402, "ORTA-1: lockChanged kilit değişmezken (aynı gün) bekleyen koşuyu bırakır", LS, "    if (pending && !sync && previous !== undefined && target === String(previous || \"\") && pending.through < target) return { action: \"freeze\", run: pending };\n", "", [T4], /S46 = A: 2\.4\.9|S13 = A: 2\.4\.9|planın ilk dilimini bıraktı/],
  [403, "ORTA-1: PUT süren dondurmayı kilit değişmezken de durdurur", ROUTE, "    if (waiting && waiting.through !== target && target !== previous) {\n", "    if (waiting && waiting.through !== target) {\n", [T4], /planın dondurması durduruldu ya da baştan başladı/],
  [404, "ORTA-1: lockNeedsCleanup kilit değişmezken de temizlik ister (409)", LS, "    if (pending && target === lockNow() && pending.through < target) return false;\n", "", [T4], /kilit değişmezken \(aynı gün\) temizlik istendi: 409/],
  // DÜŞÜK-1 (test dişi): yazım bayrağı tablo doğrulaması bitmeden kalkar → aynı güne kilidin arka işi koşunun satırlarını siler (dar kontrol 100.000'de 6.500 satır, koşu "tamam").
  [901, "DÜŞÜK-1: yazım bayrağı iş parçacığı bitince, doğrulamadan önce kalkar", LS, "        const done = await handle.promise;\n", "        const done = await handle.promise;\n        writing = 0;\n", [T4], /"before-done" penceresinde yazılan koşunun satırlarını sildi|"verify" penceresinde yazılan koşunun satırlarını sildi/],
  [902, "DÜŞÜK-1: yazım bayrağı tablo doğrulaması başlarken kalkar", LS, "        progress.phase = \"doğrulama\";\n", "        progress.phase = \"doğrulama\";\n        writing = 0;\n", [T4], /"verify" penceresinde yazılan koşunun satırlarını sildi/],
];

// E2E (tarayıcı; PLAYWRIGHT_BROWSERS_PATH ve kopyada node_modules gerekir): betik olarak koşulur, çıktısında ✗ satırları ve "# fail" sayısı okunur.
const run = files => {
  const script = files.length === 1 && files[0].startsWith("test/e2e/");
  const args = script ? ["--disable-warning=ExperimentalWarning", files[0]] : ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files];
  const r = spawnSync(process.execPath, args, { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run([MAIN, LIFE, NEW, TUR1, KU, T3, T4]);
const tabanE2E = ONLY && ![...ONLY].some(no => MUTASYONLAR.find(item => item[0] === no)?.[5].includes(E2E)) ? null : run([E2E]);
console.log(`taban e2e: ${tabanE2E ? `${tabanE2E.pass} geçti / ${tabanE2E.fail} kaldı (çıkış ${tabanE2E.status})` : "koşulmadı (seçilen mutantlarda e2e yok)"}`);
if (tabanE2E && tabanE2E.status !== 0) {
  console.log(tabanE2E.out.slice(-4000));
  throw new Error("e2e tabanı kırmızı — istemci mutasyonları anlamsız");
}
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
