#!/usr/bin/env node
// 2.5.1 D4-ÖN — devir yedeği taşıması ve arşivi gören belge temizliğinin MUTASYON taraması (KANIT KURALI 3, ders 7, 38: yakalanmayan mutasyon = eksik test;
// kırmızının nedeni okunur). Programın AYRI kopyasında (ders 23) her seferinde TEK bilerek hata açılır, ilgili test dosyası koşulur: çıkış ≠ 0 VE çıktıda beklenen neden
// (düzenli ifade) varsa YAKALANDI. Kopya dosyası her mutasyondan sonra geri yazılır. (test/devir-d2-250-mutasyon.mjs düzeni.)
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/devir-d4on-251-mutasyon.mjs --kopya <programın ayrı kopyası> [--yalniz 1,3]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;

const DB = "server/lib/devir/devir-backups.mjs";
const DOC = "server/lib/documents.mjs";
const ROUTE = "server/routes/documents.mjs";
const TASIMA = "test/devir-d4on-yedek-tasima-251.test.mjs";
const BELGE = "test/devir-d4on-belge-temizligi-251.test.mjs";

// [no, ad, dosya, eski metin, yeni metin, test dosyaları, beklenen neden]
const MUTASYONLAR = [
  [1, "yeniden denemeyi kaldır (tek deneme)", DB, "    renameWithRetry(partial, final);", "    renameWithRetry(partial, final, 1);", [TASIMA], /not ok \d+ - geçici hata \(EPERM, EBUSY, EACCES, ENOTEMPTY/],
  [2, "kalıcı taşıma hatasını yut (yedek başarılı sayılır)", DB, "  } catch (error) {\n    throw new HttpError(503,", "  } catch (error) {\n    if (error) return { name, path: final, ...written };\n    throw new HttpError(503,", [TASIMA], /not ok \d+ - kalıcı geçici hata/],
  [3, "taşıma düşünce yazılmış klasörü sil (listede Yarım kalmaz)", DB, "  } catch (error) {\n    throw new HttpError(503,", "  } catch (error) {\n    rmSync(partial, { recursive: true, force: true });\n    throw new HttpError(503,", [TASIMA], /yazılmış klasör listede yarım/],
  [4, "arşiv başvurusunu yok say", DOC, "!archived.shown.has(name)", "true", [BELGE], /not ok \d+ - iki arşiv yılı/],
  [5, "açılamayan arşivi 'göstermiyor' say", DOC, "const keepAll = archived.unreadable.length > 0;", "const keepAll = false;", [BELGE], /not ok \d+ - açılamayan \(bozuk\) arşiv kaydı/],
  [6, "yalnız ilk arşive bak", DOC, "for (const { year, file } of list) {", "for (const { year, file } of list.slice(0, 1)) {", [BELGE], /p2025: false/],
  [7, "arşiv bağlantısını kapatma (açık tutamak)", DOC, "          db?.close();", "          void db;", [BELGE], /arşive açık tutamak yok/],
  [8, "arşivin 30 günü geçmemiş silinmiş kaydını sayma", DOC, "WHERE deleted_at IS NULL OR deleted_at >= ?\").all(cutoff)", "WHERE deleted_at IS NULL\").all()", [BELGE], /prec: false/],
  [9, "arşivin 30 günü geçmiş silinmiş kaydını da say", DOC, "WHERE deleted_at IS NULL OR deleted_at >= ?\").all(cutoff)", "\").all()", [BELGE], /002 PNONE ve 001 D001 silinir/],
  [10, "bağlama: temizliğe arşiv listesi verilmez", ROUTE, "archives: () => (companies?.archivesOf?.(companyId) || [])", "archives: () => ([])", [BELGE], /not ok \d+ - iki arşiv yılı/],
  [11, "bağlama: arşiv dosyası yanlış şirket klasöründen (ortak kök)", ROUTE, "file: archiveFileOf(config.dataDir, entry.year)", "file: archiveFileOf(path.dirname(config.dataDir), entry.year)", [BELGE], /not ok \d+ - (iki arşiv yılı|açılamayan)/],
];

const run = files => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...files], { cwd: COPY, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60_000, killSignal: "SIGKILL", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = key => Number((out.match(new RegExp(`^# ${key} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { status: r.status, out, pass: count("pass"), fail: count("fail") };
};

const taban = run([TASIMA, BELGE]);
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
console.log(`SONUÇ: ${yakalanan}/${toplam} mutasyon yakalandı`);
process.exitCode = yakalanan === toplam ? 0 : 1;
