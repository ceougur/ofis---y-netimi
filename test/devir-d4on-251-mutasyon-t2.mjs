#!/usr/bin/env node
// 2.5.1 D4-ÖN tur 2 — devir yedeğinin yolu / yazma ve taşıma hataları için MUTASYON taraması (KANIT KURALI 3, ders 7, 38). test/devir-d4on-251-mutasyon.mjs düzeni:
// programın AYRI kopyasında (ders 23) her seferinde TEK bilerek hata açılır, ilgili test dosyası koşulur; çıkış ≠ 0 VE çıktıda beklenen neden varsa YAKALANDI.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/devir-d4on-251-mutasyon-t2.mjs --kopya <programın ayrı kopyası> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;

const DB = "server/lib/devir/devir-backups.mjs";
const BK = "server/lib/backup.mjs";
const YOL = "test/devir-d4on-yol-251.test.mjs";
const TASIMA = "test/devir-d4on-yedek-tasima-251.test.mjs";

// [no, ad, dosya, eski metin, yeni metin, test dosyaları, beklenen neden]
const MUTASYONLAR = [
  [1, "kopyayı yine yarım klasöre doğrudan yaz (uzun yol)", DB, "createBackup(db, work, {", "createBackup(db, partial, {", [YOL], /not ok \d+ - Y1 .*[\s\S]*günlük yolu 2[6-9]\d karakter/],
  [2, "kopyanın geçici adından asıl adına taşımada yeniden deneme yok", DB, "usageRows, moveRetry: true });", "usageRows, moveRetry: false });", [YOL], /not ok \d+ - Y3 /],
  [3, "çalışma klasöründen yarım klasöre taşımada yeniden deneme yok", DB, "renameWithRetry(staged, path.join(partial, database.name));", "renameWithRetry(staged, path.join(partial, database.name), 1);", [YOL], /not ok \d+ - Y3 /],
  [4, "özet akışın sonunda (end) döner, tutamak kapanmadan", DB, "        digest = hash.digest(\"hex\");", "        resolve((digest = hash.digest(\"hex\")));", [YOL], /not ok \d+ - Y4 [\s\S]*kapanmamış okuma akışı: \[".+"\]/],
  [5, "yazma hatası olduğu gibi (İngilizce SQLite iletisi) gider", DB, "    throw writeFailure(error, label);", "    throw error;", [YOL], /not ok \d+ - Y2 [\s\S]*undefined unable to open database file/],
  [6, "taşıma iletisine iç kod sızar", DB, "  return \"dosya sistemi taşımaya izin vermedi\";", "  return `dosya sistemi hatası ${code}`;", [YOL, TASIMA], /not ok \d+ - Y5 /],
  [7, "çalışma klasörü listede görünür", DB, " && entry.name !== DEVIR_BACKUP_WORK);", ");", [YOL], /çalışma klasörü listede görünmez/],
  [8, "açılamayan kopyanın nedeni genel iletiye düşer", DB, "} else if (sqlite === 14 || code === \"ENAMETOOLONG\") {", "} else if (code === \"ENAMETOOLONG\") {", [YOL], /not ok \d+ - Y2 /],
  [9, "iletide iş adı hep Devir", DB, "const operationOf = label => (", "const operationOf = label => \"Devir\" || (", [YOL], /not ok \d+ - Y[25] /],
  [10, "backup.mjs: devir yedeğinin iç taşıması yine tek deneme", BK, "(moveRetry ? renameWithRetry : renameSync)(partial, target);", "renameSync(partial, target);", [YOL], /not ok \d+ - Y3 /],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60_000, killSignal: "SIGKILL", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run([YOL, TASIMA]);
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
    console.log(`N${no} ${ad}: KURULAMADI (metin ${at} kez bulundu)`);
    continue;
  }
  writeFileSync(file, original.replace(eski, yeni));
  try {
    const result = run(testler);
    const caught = result.status !== 0 && neden.test(result.out);
    if (caught) yakalanan += 1;
    const firstFail = (result.out.match(/^ {4}not ok \d+ - (.*)$/m) || [])[1] || "";
    console.log(`N${no} ${ad}: ${caught ? "YAKALANDI" : "KAÇTI"} (çıkış ${result.status}, ${result.pass} geçti / ${result.fail} kaldı${firstFail ? `; ilk kırmızı: ${firstFail.slice(0, 90)}` : ""})`);
  } finally {
    writeFileSync(file, original);
  }
}
console.log(`SONUÇ: ${yakalanan}/${toplam} mutasyon yakalandı`);
process.exitCode = yakalanan === toplam ? 0 : 1;
