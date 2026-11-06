#!/usr/bin/env node
// 2.5.0 Ç2 — saklanan fiş defterinin MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının nedeni okunur).
// Programın ayrı bir kopyasında (ders 23: çalışma ağacında değil) her seferinde TEK bilerek hata açılır, kopyanın kendi test/fis-defteri-250.test.mjs ve
// test/fis-defteri-yasam-250.test.mjs dosyaları koşulur: çıkış ≠ 0 VE çıktıda beklenen neden (düzenli ifade) varsa YAKALANDI. Kopya dosyası her mutasyondan sonra geri yazılır.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/fis-defteri-250-mutasyon.mjs --kopya <git archive HEAD kopyası> [--yalniz 1,3]
// Ç2 tur 3: eski sürümün gerçek kodunu açan testler (v2.0.26, v2.4.9; test/guvenilirlik/surumler.mjs) etiketleri git'ten okur — kopya git deposu değildir; betik bu deponun
// git klasörünü (GIT_DIR, yalnız okuma: rev-parse + archive) koşulara verir. Tabanda atlanan test varsa tarama geçersizdir (atlanan test mutant yakalamaz).
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
// Ç2 tur 1 korumaları (test/fis-defteri-koruma-250.test.mjs).
const KORUMA = "test/fis-defteri-koruma-250.test.mjs";
// Ç2 tur 3: sınırlı kayıt ayrıntısı (lib/log-detail.mjs) + K5 test boşlukları (D1–D8) + integrity.mjs taban kaydı; banka açılış onarımının kaydı.
const KAYIT = "test/fis-defteri-kayit-250.test.mjs";
const BANKA = "test/banka-onarim-kayit-250.test.mjs";
const LOGD = "server/lib/log-detail.mjs";
const BANKR = "server/lib/bank/repair.mjs";
const INTEG = "server/lib/integrity.mjs";
const GIT_DIR = execFileSync("git", ["-C", path.dirname(fileURLToPath(import.meta.url)), "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
// [no, ad, dosya, eski metin (dosyada TAM BİR KEZ), yeni metin, koşulacak testler, çıktıda beklenen neden (düzenli ifade)]
// Not (3): aynalanmayan ters kaydı önce KAPI geri alır (tam taramanın "Fiş Defteri" denetimi: "ters kayıt asıl fişin aynası değil") — iki katman; beklenen neden kapınınki.
const MUTASYONLAR = [
  [1, "fiş denkliği denetimi düşer (borç ≠ alacak kabul)", LV, "if (debit !== credit || debit <= 0) throw", "if (debit <= 0) throw", [MAIN], /not ok \d+ - N1–N3[\s\S]*beklenen 400, gelen 409/],
  [2, "sıfır satır denetimi düşer (iki tarafı sıfır satır kabul)", LV, "if ((dr > 0) === (cr > 0)) throw", "if (dr > 0 && cr > 0) throw", [MAIN], /not ok \d+ - N1–N3[\s\S]*beklenen 400, gelen undefined/],
  [3, "ters kayıt yönü (satırlar aynalanmaz)", LV, "debit: line.credit, credit: line.debit, note: line.note", "debit: line.debit, credit: line.credit, note: line.note", [MAIN], /not ok \d+ - N9–N10[\s\S]*ters kaydı asıl fişin aynası[\s\S]*ters kayıt asıl fişin aynası değil/],
  [4, "istek kimliği tekilliği (yinelenen kimlik aranmaz)", LV, "const existing = byKey(item.requestKey);", "const existing = null;", [MAIN, LIFE], /aynı fiş ikinci kez yazılamaz/],
  [5, "kilit 409 (kilit günü açık sayılır)", LV, "if (lock && item.date <= lock) throw", "if (lock && item.date < lock) throw", [MAIN], /beklenen kod period-locked/],
  [6, "UPDATE tetikleyicisi yok (başlık)", MIG, "  CREATE TRIGGER IF NOT EXISTS ledger_vouchers_no_update BEFORE UPDATE ON ledger_vouchers BEGIN SELECT RAISE(ABORT, 'ledger_vouchers değiştirilemez: düzeltme ters kayıt fişiyle'); END;\n", "", [MAIN], /not ok \d+ - N8[\s\S]*Missing expected exception: UPDATE başlık/],
  [7, "DELETE tetikleyicisi yok (satır)", MIG, "  CREATE TRIGGER IF NOT EXISTS ledger_voucher_lines_no_delete BEFORE DELETE ON ledger_voucher_lines BEGIN SELECT RAISE(ABORT, 'ledger_voucher_lines silinemez: düzeltme ters kayıt fişiyle'); END;\n", "", [MAIN], /not ok \d+ - N8[\s\S]*Missing expected exception: DELETE satır/],
  [8, "journal() sınıf sırası (kapanış günün sonunda değil)", GL, '  "voucher-close": 99,', '  "voucher-close": 30,', [MAIN], /not ok \d+ - N13[\s\S]*not ok \d+ - N20/],
  [9, "journal() sınıf sırası (açılış günün başında değil)", GL, '  "voucher-open": 1,', '  "voucher-open": 50,', [MAIN], /01\.01'in ilk maddesi açılış/],
  [10, "kapanış + kilit aynı işlemde değil (kilit konmaz)", LV, "          period.setLock(lockThrough);\n", "", [MAIN], /kilit fişlerle aynı işlemde kondu/],
  [11, "aynı fişin ikinci ters kaydı denetlenmez (yalnız indeks kalır)", LV, "if (original.reversedBy) throw", "if (false && original.reversedBy) throw", [MAIN], /beklenen 409, gelen undefined/],
  [12, "Şirket Verisini Sıfırla fişleri silmez", "server/app.mjs", "      Object.assign(counts, clearVouchers(store));\n", "", [LIFE], /sıfırlama raporu fiş sayısını taşır/],
  [13, "sıfırlama tetikleyicileri geri kurmaz", LV, "  const result = fn();\n  store.exec(LEDGER_VOUCHER_TRIGGERS_V46);", "  const result = fn();", [LIFE], /not ok \d+ - N17/],
  [14, "eski sürüm sıfırlamasının açılış onarımı yok", "server/app.mjs", "      context.voucherRepair = repairLegacyReset({ store, now: config.now, log, companyId });", "      context.voucherRepair = null;", [LIFE], /not ok \d+ - izi olmayan fiş/],
  [15, "kilit izinde fiş girdisi yok", "server/lib/integrity.mjs", "    requires: [\"ledger_vouchers\", \"ledger_voucher_lines\"],\n    since: \"2.5.0\",", "    requires: [\"ledger_vouchers_yok\"],\n    since: \"2.5.0\",", [MAIN], /kapanmış dönem sapması/],
  [16, "fiş tabloları kapıda değil (FINANCIAL)", "server/lib/db.mjs", '    "ledger_vouchers", "ledger_voucher_lines"]);', "    ]);", [MAIN], /not ok \d+ - N21/],
  // ---- Ç2 TUR 1 (dar kontrol 05.11 22:00): DÜŞÜK-3'ün yaşayan dört mutasyonu (MA, MB, MC, MG) ve tur 1 düzeltmelerinin her biri ----
  [17, "MA bugün tarihli fiş reddedilir (> yerine >=)", LV, "if (item.date > today()) throw", "if (item.date >= today()) throw", [KORUMA], /not ok \d+ - MA:[\s\S]*İleri tarihli fiş yazılamaz/],
  [18, "MB kilit geri gidebilir (yinelenen kapanış kilidi önceki güne çeker)", LV, "if (!previous || lockThrough > previous) {", "if (true) {", [KORUMA], /kilit geri gitmedi/],
  [19, "MC istek kimliğinin içerik karşılaştırmasında sınıf yok", LV, "JSON.stringify([item.type, item.cls, item.date,", "JSON.stringify([item.type, item.date,", [KORUMA], /not ok \d+ - MC:[\s\S]*Missing expected exception/],
  [20, "MG yevmiyede fiş satırının alt hesabı düşer", GL, "...(line.sub ? { sub: String(line.sub) } : {}), ...(line.party", "...(line.party", [KORUMA], /not ok \d+ - MG:/],
  [21, "K6 alt defter koruması yok (fiş denetimi atlanır; yalnız kapı)", LV, "    assertNotSubledger(lines);\n", "", [KORUMA, MAIN], /KABUL edildi \(K6 iddiası\): 121/],
  [22, "K6 listesi kullanıma bağlı (every kipi senet satırını açmaz)", "server/routes/ledger.mjs", "if (every || Number(sums.notes)) {", "if (Number(sums.notes)) {", [KORUMA], /KABUL edildi \(K6 iddiası\): 121/],
  [23, "K5 şirket denetimi yok (her şirketin sıfırlama izi sayılır)", LV, "WHERE type = 'company.reset' AND entity_id = ? ORDER BY rowid DESC LIMIT 1\", String(companyId))", "WHERE type = 'company.reset' ORDER BY rowid DESC LIMIT 1\")", [KORUMA], /başka şirketin sıfırlaması 001'in fişini kaldırmamalı/],
  // Ç2 TUR 2 (dar kontrol B1): tur 1'in 24 / 25'i (an karşılaştırması, saat dilimi eki) duvar saati kuralıyla birlikte kalktı (G3); yerlerine yazım sırası mutasyonları.
  [24, "K5 yazım sırası denetimi yok (izi duran fişten sonra yazılan izsiz fiş de kaldırılır)", LV, "      else if (firstTraced !== null && Number(row.seq) > Number(firstTraced)) doubts.set(row.id, \"after-traced\");\n", "", [KORUMA], /izi duran fişten sonra yazılan izsiz fiş kalmalı/],
  [25, "K5 duvar saati geri gelir (yazım sırası yerine fişin anı ↔ sıfırlamanın anı)", LV, "      else if (firstTraced !== null && Number(row.seq) > Number(firstTraced)) doubts.set(row.id, \"after-traced\");\n", "      else if (Date.parse(store.get(\"SELECT created_at AS at FROM ledger_vouchers WHERE id = ?\", row.id).at) > Date.parse(reset.at)) doubts.set(row.id, \"after-traced\");\n", [KORUMA], /saat geri alınmış olsa da sıfırlamadan artakalan asıl fiş \+ ters kaydı birlikte kaldırılır/],
  [26, "kapanmış fiş tetikleyicisi yeniden COUNT(*) (O(n²))", MIG, "    WHEN NEW.seq > COALESCE((SELECT line_count FROM ledger_vouchers WHERE id = NEW.voucher_id), 0)\n      OR EXISTS (SELECT 1 FROM ledger_voucher_lines WHERE voucher_id = NEW.voucher_id AND seq = NEW.seq)\n", "    WHEN (SELECT COUNT(*) FROM ledger_voucher_lines WHERE voucher_id = NEW.voucher_id) >= COALESCE((SELECT line_count FROM ledger_vouchers WHERE id = NEW.voucher_id), 0)\n", [KORUMA], /O\(n²\)/],
  [27, "kapanmış fiş tetikleyicisi aynı sırayı denetlemez (INSERT OR REPLACE satır geçer)", MIG, "\n      OR EXISTS (SELECT 1 FROM ledger_voucher_lines WHERE voucher_id = NEW.voucher_id AND seq = NEW.seq)", "", [KORUMA, MAIN], /atlatan deneme: INSERT OR REPLACE satır/],
  [28, "metin alanı nesne alır ([object Object] saklanır)", LV, "  if (value !== null && value !== undefined && typeof value !== \"string\" && typeof value !== \"number\") throw bad(400, `${label} metin olmalı.`, \"voucher-text\", { field: label });\n", "", [KORUMA], /not ok \d+ - ters kayıt ucu: açıklama nesne/],
  [29, "postAll lockThrough kilit öncesi adımı (POS) çağırmaz", LV, "if (beforeLock && (!current || lockThrough > current)) beforeLock(lockThrough, force === true);", "", [KORUMA], /not ok \d+ - Elle Onay kipi/],
  [30, "fiş defterine kilit öncesi adım bağlanmaz (routes)", "server/routes/ledger.mjs", "ownedAccounts: subledgerAccounts, beforeLock });", "ownedAccounts: subledgerAccounts });", [KORUMA], /not ok \d+ - Elle Onay kipi/],
  // ---- Ç2 TUR 2 (dar kontrol 06.11 04:58): B2 — baş mimar kararı 5 (çift kuralı) satırının mutasyonu (dar kontrolün mut-k5cift.mjs'i tur 1 kodunda 40/40 YEŞİL kalıyordu) ve B1 ----
  [31, "B2 K5 çift kuralı yok (asıl fiş ile ters kaydı ayrı ayrı değerlendirilir; baş mimar kararı 5)", LV, "  for (let changed = true; changed; ) {", "  for (let changed = false; changed; ) {", [KORUMA], /ters kaydı kalan asıl fiş kaldırılmaz/],
  [32, "B1 K5 çift kuralı tek yöne döner (yalnız kalan ters kaydın asıl fişi korunur; tur 1 kuralı)", LV, "      if (removing.has(pair.id) === removing.has(pair.of)) continue;", "      if (removing.has(pair.id) || !removing.has(pair.of)) continue;", [KORUMA], /asıl fiş kalıyorsa ters kaydı da kalır/],
  [33, "B1 K5 sıfırlama izinin işlem geçmişini sildiği denetlenmez (izli fişten sonra eklenmiş iz de sayılır)", LV, "      if (firstTrace !== null && Number(firstTrace) < Number(reset.seq)) doubts.set(row.id, \"reset-without-wipe\");", "      if (false) doubts.set(row.id, \"reset-without-wipe\");", [KORUMA], /işlem geçmişini silmeyen sıfırlama izi fiş kaldırmamalı/],
  [34, "B1 kuşkulu fiş Mutabakat Günlüğü'ne yazılmaz (sessiz)", LV, "      if (keptLog) store.run(", "      if (false) store.run(", [KORUMA], /kuşkulu fişin görünür kaydı/],
  [35, "B1 kuşkulu fişin kaydı her açılışta yinelenir (tekilleştirme yok)", LV, "    if (!store.get(\"SELECT 1 AS found FROM integrity_log WHERE action = 'repair' AND tables = 'ledger_vouchers' AND detail_json = ?\", detail)) {", "    if (true) {", [KORUMA], /aynı kuşkulu fiş için kayıt her açılışta yinelenmez/],
  // ---- Ç2 TUR 3 (Ç2 tur 2 dar kontrolü DÜŞÜK-3: tur 2 kodunda YEŞİL kalan D1–D8 + yan bulgular). D7 (çift kuralı tek geçiş) EŞDEĞER: ters kaydın ters kaydı 409 → zincir tek halka. ----
  [36, "D1 K5 en son yerine EN ESKİ sıfırlama izi", LV, "ORDER BY rowid DESC LIMIT 1\", String(companyId))", "ORDER BY rowid ASC LIMIT 1\", String(companyId))", [KAYIT], /en son sıfırlama izi işlem geçmişini silmemiş: izsiz fiş kalmalı/],
  [37, "D2 K5 izli ilk yerine izli SON fiş", LV, "SELECT MIN(v.rowid) AS seq FROM ledger_vouchers v WHERE ${traced}", "SELECT MAX(v.rowid) AS seq FROM ledger_vouchers v WHERE ${traced}", [KAYIT], /izli İLK fişten sonra yazılan izsiz fiş kalmalı/],
  [38, "D3 K5 'işlem geçmişi silinmemiş' denetimi ilk yerine SON izle", LV, "SELECT MIN(a.rowid) AS seq FROM audit_events a WHERE a.type = '${CREATED_TRACE}'", "SELECT MAX(a.rowid) AS seq FROM audit_events a WHERE a.type = '${CREATED_TRACE}'", [KAYIT], /ilk iz sıfırlama izinden önce: iz işlem geçmişini silmemiş, fiş kalmalı/],
  [39, "D5 kuşku kaydında keptCount yazılmaz", LV, "boundedDetail({ kept, keptCount: kept.length, doubts: keptDoubts", "boundedDetail({ kept, doubts: keptDoubts", [KAYIT], /kuşku kaydının ayrıntısı \(Ç2 tur 2 biçimi\)/],
  [40, "D6 kuşku kaydında 50 sınırı kalkar", LV, "resetAt: reset?.at || \"\" }, { maxList: KEPT_LIST", "resetAt: reset?.at || \"\" }, { maxList: Infinity", [KAYIT], /kuşku kaydının ayrıntısı \(Ç2 tur 2 biçimi\)/],
  [41, "kaldırma kaydında removedCount yazılmaz", LV, "{ ids: orphans, removedCount: orphans.length, resetAt", "{ ids: orphans, resetAt", [KAYIT], /ilk 50 kimlik \(yazım sırasıyla\) \+ tam sayılar/],
  [42, "kaldırma kaydında 50 sınırı kalkar", LV, "kept, keptCount: kept.length }, { maxList: KEPT_LIST, maxChars: DETAIL_CHARS });", "kept, keptCount: kept.length }, { maxList: Infinity, maxChars: DETAIL_CHARS });", [KAYIT], /ilk 50 kimlik \(yazım sırasıyla\) \+ tam sayılar/],
  [43, "D8 kaldırma kaydı 200 karakterde kesilir", LV, "summary.slice(0, 500), removedDetail);", "summary.slice(0, 500), removedDetail.slice(0, 200));", [KAYIT], /kaldırma kaydı \(600\): kayıt ayrıntısı geçerli JSON değil/],
  [44, "yan bulgu 1 geri gelir (kaldırma kaydı JSON.stringify(...).slice(0, 20000))", LV, "boundedDetail({ ids: orphans, removedCount: orphans.length, resetAt: reset.at, kept, keptCount: kept.length }, { maxList: KEPT_LIST, maxChars: DETAIL_CHARS })", "JSON.stringify({ ids: orphans, resetAt: reset.at, kept }).slice(0, 20000)", [KAYIT], /kaldırma kaydı \(600\): kayıt ayrıntısı geçerli JSON değil/],
  [45, "boundedDetail boyut aşınca listeyi kısaltmaz (yalnız metni keser)", LOGD, "  while (text.length > cap && limit > 1) {", "  while (false) {", [KAYIT], /liste kısaldı/],
  [46, "boundedDetail kökün alanlarını da kısaltır (sayılar kaybolabilir)", LOGD, "      if (!atRoot && isPlainObject(item)) {", "      if (isPlainObject(item)) {", [KAYIT], /kökün 20 alanı/],
  [47, "boundedDetail kayıt nesnesinin alanlarını keser (az anahtarlı nesne de liste sayılır)", LOGD, "const RECORD_KEYS = 16;", "const RECORD_KEYS = 0;", [KAYIT], /her sapma kodu ve sayısıyla/],
  [48, "boundedDetail sığan değerde de metni kısaltır (JSON.stringify ile birebir değil)", LOGD, "  let text = render(limit, Infinity);", "  let text = render(limit, 1024);", [KAYIT], /sığan değer birebir olmalı/],
  [49, "boundedDetail listenin bütün öğelerini okur (öğe başına iş; ders 47)", LOGD, "return item.length > limit ? item.slice(0, limit) : item;", "return item.length > limit ? item.map(entry => entry).slice(0, limit) : item;", [KAYIT], /100\.000 öğeli listeden \d+ öğe okundu/],
  [50, "yan bulgu 2 geri gelir (banka onarımı kaydı JSON.stringify(...).slice(0, 20000))", BANKR, "boundedDetail({ ...report, unassignedIds: undefined, counts }, { maxList: 50, maxChars: 20_000 })", "JSON.stringify({ ...report, unassignedIds: undefined }).slice(0, 20000)", [BANKA], /onarım kaydının ayrıntısı geçerli JSON değil/],
  [51, "banka onarımı kaydında tam sayılar (counts) yazılmaz", BANKR, "unassignedIds: undefined, counts }", "unassignedIds: undefined }", [BANKA], /tam sayılar/],
  [52, "banka onarımı kaydında 50 sınırı kalkar", BANKR, "counts }, { maxList: 50, maxChars: 20_000 })", "counts }, { maxList: Infinity, maxChars: 20_000 })", [BANKA], /kayıtta ilk 50 başlık/],
  [53, "integrity günlük yazımı yine kesilir (JSON.stringify(...).slice(0, 20000))", INTEG, "failures.map(item => item.name).join(\"; \").slice(0, 500), detailOf(failures),", "failures.map(item => item.name).join(\"; \").slice(0, 500), JSON.stringify(failures).slice(0, 20000),", [KAYIT], /açılış 1: taban kaydı: kayıt ayrıntısı geçerli JSON değil/],
  [54, "integrity taban karşılaştırması sınırsız JSON'la (her açılışta yeni satır)", INTEG, "if (last?.detail !== detailOf(result.failures))", "if (last?.detail !== JSON.stringify(result.failures))", [KAYIT], /açılış 2: tek taban kaydı/],
  // Not: maxList Infinity → 50 bu veride EŞDEĞERE YAKIN (sapma listesi 50'den kısa, örnekler en çok 5); birebirliği bozan liste sınırı 4 ile denenir.
  [55, "integrity günlük ayrıntısına liste sınırı girer (sığan kayıt birebir değil)", INTEG, "boundedDetail(failures, { maxList: Infinity, maxChars: 20_000 })", "boundedDetail(failures, { maxList: 4, maxChars: 20_000 })", [KAYIT], /sığan kayıt birebir/],
];

const run = files => {
  // Zaman sınırı (Ç2 tur 1): mutasyonla asılı kalan koşu taramayı durdurmasın — süre dolan koşu "kaçırdı" sayılır (özet yok → kırmızı sayılmaz; ihtiyatlı yön).
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000, killSignal: "SIGKILL", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9", GIT_DIR } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail"), skipped: count("skipped") };
};

const ALL = [MAIN, LIFE, KORUMA, KAYIT, BANKA];
const taban = run(ALL);
console.log(`taban: ${taban.pass} geçti / ${taban.fail} kaldı / ${taban.skipped} atlandı (çıkış ${taban.status})`);
if (taban.status !== 0 || taban.fail !== 0 || taban.skipped !== 0 || !(taban.pass > 0)) throw new Error("taban testi yeşil değil ya da atlanan test var — mutasyon taraması anlamsız");
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
  if (!nedenli) console.log(r.out.split("\n").filter(line => /not ok|error:|Error|beklenen|expected/i.test(line)).slice(0, 20).join("\n"));
}
const son = run(ALL);
if (son.status !== 0) throw new Error("mutasyonlardan sonra kopya geri yazılamadı (taban kırmızı)");
console.log(`1..${toplam}\n# tests ${toplam}\n# pass ${yakalanan}\n# fail ${toplam - yakalanan}\n# cancelled 0\n# skipped 0\n# todo 0`);
console.log(`${yakalanan}/${toplam} mutasyon beklenen nedenle yakalandı`);
process.exit(yakalanan === toplam ? 0 : 1);
