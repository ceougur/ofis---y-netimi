#!/usr/bin/env node
// 2.5.0 D2 — devir altyapısının MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test; kırmızının nedeni okunur).
// Programın ayrı bir kopyasında (ders 23: çalışma ağacında değil) her seferinde TEK bilerek hata açılır, ilgili test dosyası koşulur: çıkış ≠ 0 VE çıktıda beklenen
// neden (düzenli ifade) varsa YAKALANDI. Kopya dosyası her mutasyondan sonra geri yazılır. Her mekanizmanın en az bir mutantı var (docs/devir/D2-ALTYAPI-TASARIM.md §10).
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/devir-d2-250-mutasyon.mjs --kopya <git archive HEAD kopyası> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;

const APP = "server/app.mjs";
const CO = "server/lib/companies.mjs";
const CB = "server/lib/company-backups.mjs";
const UO = "server/lib/update-orchestrator.mjs";
const AR = "server/lib/devir/archives.mjs";
const AO = "server/lib/devir/archive-open.mjs";
const MA = "server/lib/devir/maintenance.mjs";
const DB = "server/lib/devir/devir-backups.mjs";
const BAKIM = "test/devir-d2-bakim-250.test.mjs";
const ARSIV = "test/devir-d2-arsiv-250.test.mjs";
const YEDEK = "test/devir-d2-yedek-250.test.mjs";
// [no, ad, dosya, eski metin (dosyada TAM BİR KEZ), yeni metin, koşulacak testler, çıktıda beklenen neden (düzenli ifade)]
const MUTASYONLAR = [
  [1, "bakım kipi istek kapısı yok", APP, "          assertNotInMaintenance(pathname);\n", "", [BAKIM], /001 bakımda[\s\S]*bakım kipi 503 değil/],
  [2, "001'in geçici koruma tetikleyicileri kurulmaz", APP, "    else if (!schemaGate) applyWriteGuard(db, on, {", "    else if (false) applyWriteGuard(db, on, {", [BAKIM], /koruma tetikleyicileri kuruldu|şirket verisi[^\n]*değişmemeli/],
  [3, "001 korumasında ortak ayar istisnası yok (giriş / lisans ayarı da kilitlenir)", MA, "          const when = table === \"settings\" ? ` WHEN NOT (${commonSettingsSql.replace(/\\bkey\\b/g, `${ref}.key`)})` : \"\";", "          const when = \"\";", [BAKIM], /not ok \d+ - 001 bakımda/],
  [4, "002 bakımda bağlantı query_only olmaz", APP, "    if (hub) db.exec(`PRAGMA query_only = ${on || schemaGate ? \"ON\" : \"OFF\"}`);", "    if (hub) db.exec(\"PRAGMA query_only = OFF\");", [BAKIM], /query_only/],
  [5, "bakımda açılan 002 örneği query_only almaz", APP, "  if (hub && !archive && inMaintenance()) db.exec(\"PRAGMA query_only = ON\");", "", [BAKIM], /bakımda açılan 002 örneği de query_only/],
  // 6: EŞDEĞER MUTANT beklenir (iki kat koruma: writeLock sarmalayıcısı da bakımdaki şirkete false verir) — 28 ikisini birlikte kaldırır.
  [6, "arka plan yazıcıları bakımda sürer (yalnız canWriteInBackground denetimi)", APP, "const canWriteInBackground = () => !writeGate && !inMaintenance() && writeLock.guard(companyId, store);", "const canWriteInBackground = () => !writeGate && writeLock.guard(companyId, store);", [BAKIM], /arka plan yazamaz/],
  [7, "WhatsApp işçisinin sınaması bakımı görmez", APP, "    guard: (key, target) => (key === companyId && inMaintenance() ? false : baseWriteLock.guard(key, target)),", "    guard: (key, target) => baseWriteLock.guard(key, target),", [BAKIM], /işçinin sınaması geçmez/],
  [8, "otomatik yedek bakımdaki şirketi atlamaz", CB, "!isBusy(company.id) && !isPaused(company.id) && ", "!isBusy(company.id) && ", [BAKIM], /otomatik yedek hedefi değil/],
  [9, "orkestratör tutmayı görmez (kendiliğinden kurar)", UO, "if (updater.config().enabled && !held() && (quietTime()", "if (updater.config().enabled && (quietTime()", [BAKIM], /tutma varken mesai dışında|ertelendi/],
  [10, "indirme sırasında gelen tutma kurulumu durdurmaz", UO, "        if (held()) {\n          status.lastResult = { outcome: \"held\"", "        if (false) {\n          status.lastResult = { outcome: \"held\"", [BAKIM], /eski sürüm durdurulmadı/],
  [11, "uygulama güncelleme tutması istemez", MA, "        held = await hold(id, true);", "        held = { supervised: false, held: false };", [BAKIM], /not ok \d+ - güncelleme tutması \(uygulama\)/],
  [12, "yarıda kalan kipin işareti silinmez", MA, "    try {\n      rmSync(marker, { force: true });\n    } catch {\n      // silinemedi; bir sonraki yazımda üzerine yazılır", "    try {\n      void 0;\n    } catch {\n      // silinemedi; bir sonraki yazımda üzerine yazılır", [BAKIM], /işaret dosyası silindi/],
  [13, "arşiv yazma yasağı (403) yok", APP, "          assertArchiveWritable();\n", "", [ARSIV], /arşive yazma 403 olmalı/],
  [14, "arşiv bütünlük (sha256) denetimi yok", AO, "  return { state: sha256 === entry.sha256 ? \"ok\" : \"changed\", sha256, size: stats.size };", "  return { state: \"ok\", sha256, size: stats.size };", [ARSIV], /not ok \d+ - bütünlük/],
  [15, "ad / kod değişince arşiv kaydı düşer", CO, "    if (Array.isArray(company.archives) && company.archives.length) entry.archives = company.archives;\n", "", [ARSIV], /ad \/ kod değişince arşiv kaydı/],
  [16, "diskten tanıma yok", CO, "  archiveApi.reconcileArchives();\n", "", [ARSIV], /diskten tanındı/],
  [17, "yarım devrin arşivi tanınır (çalışma dosyası denetimi yok)", AR, "  const live = (liveYears || []).find(row => row.year === item.year);", "  const live = (liveYears || []).find(row => row.year === item.year) || { year: item.year, runId: facts.mark.runId };", [ARSIV], /yarım devrin arşivi kayda girmez/],
  [18, "arşivin göçü yok", AO, "  if (integrity.state !== \"changed\" && facts.schemaVersion < LATEST_VERSION) {", "  if (false) {", [ARSIV], /not ok \d+ - arşivin göçü/],
  [19, "eşzamanlı iki istek ayrı göç (hazırlık paylaşılmaz)", APP, "    if (archiveOpening.has(key)) return archiveOpening.get(key);\n", "", [ARSIV], /not ok \d+ - arşivin göçü/],
  [20, "arşiv kapanınca canlı şirketin WhatsApp kuyruğu işçiden çıkar", APP, "      if (!archiveGate) whatsapp.scheduler.unregister(companyId);", "      whatsapp.scheduler.unregister(companyId);", [ARSIV], /canlı şirketin kuyruğunu işçiden çıkarmadı/],
  [21, "şirket kapanınca arşiv örnekleri açık kalır", APP, "    const archivesClosed = await closeArchives(id);", "    const archivesClosed = 0;", [ARSIV], /yalnız 002'nin arşivi kapandı/],
  [22, "devir yedeğinin veri tabanı kopyası rutin klasöre (budama sınıfı)", DB, "    const database = createBackup(db, partial, {", "    const database = createBackup(db, backupDir, {", [YEDEK], /veri tabanı kopyası/],
  [23, "geri yükleme arşiv kaydını bilmez (002 ve 001 hazırlığı)", CB, "    if (devirCheck !== false) assertDevirConsistent({ file, archives: registry.archivesOf?.(target.id) || [], label: labelOf(target) });\n", "", [YEDEK], /not ok \d+ - Yedekten Geri Yükle \(002/],
  [24, "001 hazırlığı açılışta arşiv kaydıyla denetlenmez", CB, "    if (job.devirCheck !== false) assertDevirConsistent({ file: job.source, archives: archivesOnDisk(dataDir, ROOT_COMPANY_ID), label: \"001\" });\n", "", [YEDEK], /hazırlanmış geri yükleme uygulanmadı/],
  [25, "geri alınmış devrin sonrası yedeği engellenmez", CB, "  if (after.length) {", "  if (false) {", [YEDEK], /not ok \d+ - Yedekten Geri Yükle \(002/],
  [26, "bakımdaki şirkete programdan geri yükleme", CB, "    if (isPaused(target.id)) throw", "    if (false) throw", [YEDEK], /not ok \d+ - Yedekten Geri Yükle \(002/],
  [27, "Tümünü Sıfırla devir işaretini siler (KEEP_SETTINGS)", APP, "    \"devir.\"];", "    ];", [YEDEK], /sıfırlamadan sonra çalışma dosyası devrini bilir/],
];
// Çok noktalı mutant: [no, ad, [[dosya, eski, yeni], …], testler, neden].
const COKLU = [
  [28, "arka plan yazıcıları bakımda sürer (canWriteInBackground + writeLock sarmalayıcısı birlikte)", [
    [APP, "const canWriteInBackground = () => !writeGate && !inMaintenance() && writeLock.guard(companyId, store);", "const canWriteInBackground = () => !writeGate && writeLock.guard(companyId, store);"],
    [APP, "    guard: (key, target) => (key === companyId && inMaintenance() ? false : baseWriteLock.guard(key, target)),", "    guard: (key, target) => baseWriteLock.guard(key, target),"],
  ], [BAKIM], /arka plan yazamaz/],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000, killSignal: "SIGKILL", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run([BAKIM, ARSIV, YEDEK]);
console.log(`taban: ${taban.pass} geçti / ${taban.fail} kaldı (çıkış ${taban.status})`);
if (taban.status !== 0 || taban.fail !== 0 || !(taban.pass > 0)) throw new Error("taban testi yeşil değil — mutasyon taraması anlamsız");
let yakalanan = 0;
let toplam = 0;
for (const [no, ad, dosya, eski, yeni, testler, neden] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  toplam += 1;
  const file = path.join(COPY, dosya);
  const original = readFileSync(file, "utf8");
  const at = original.split(eski).length - 1;
  if (at !== 1) {
    console.log(`M${no} ${ad}: KURULAMADI (metin ${at} kez bulundu)`);
    continue;
  }
  writeFileSync(file, original.replace(eski, yeni));
  try {
    const result = run(testler);
    const caught = result.status !== 0 && neden.test(result.out);
    if (caught) yakalanan += 1;
    const firstFail = (result.out.match(/^ {4}not ok \d+ - (.*)$/m) || [])[1] || "";
    console.log(`M${no} ${ad}: ${caught ? "YAKALANDI" : "KAÇTI"} (çıkış ${result.status}, ${result.pass} geçti / ${result.fail} kaldı${firstFail ? `; ilk kırmızı: ${firstFail.slice(0, 90)}` : ""})`);
  } finally {
    writeFileSync(file, original);
  }
}
for (const [no, ad, edits, testler, neden] of COKLU) {
  if (ONLY && !ONLY.has(no)) continue;
  toplam += 1;
  const originals = new Map();
  try {
    let ok = true;
    for (const [dosya, eski, yeni] of edits) {
      const file = path.join(COPY, dosya);
      const text = originals.get(file) ?? readFileSync(file, "utf8");
      if (!originals.has(file)) originals.set(file, text);
      const current = readFileSync(file, "utf8");
      if (current.split(eski).length - 1 !== 1) {
        console.log(`M${no} ${ad}: KURULAMADI (${dosya})`);
        ok = false;
        break;
      }
      writeFileSync(file, current.replace(eski, yeni));
    }
    if (!ok) continue;
    const result = run(testler);
    const caught = result.status !== 0 && neden.test(result.out);
    if (caught) yakalanan += 1;
    const firstFail = (result.out.match(/^ {4}not ok \d+ - (.*)$/m) || [])[1] || "";
    console.log(`M${no} ${ad}: ${caught ? "YAKALANDI" : "KAÇTI"} (çıkış ${result.status}, ${result.pass} geçti / ${result.fail} kaldı${firstFail ? `; ilk kırmızı: ${firstFail.slice(0, 90)}` : ""})`);
  } finally {
    for (const [file, text] of originals) writeFileSync(file, text);
  }
}
console.log(`SONUÇ: ${yakalanan}/${toplam} mutasyon yakalandı (6 numara eşdeğer mutant olarak beklenir: iki kat koruma)`);
process.exitCode = yakalanan === toplam || (yakalanan === toplam - 1 && (!ONLY || ONLY.has(6))) ? 0 : 1;
