// Sürüm verisi üreticisi (2.0.21 güvenilirlik; kullanıcı: "uydurma verilerle değil").
//
// Eski sürümlerin GERÇEK kodunu (git etiketi) sırayla aynı veri klasöründe çalıştırır ve kullanıcı gibi o sürümün API'sinden
// veri girer (test/guvenilirlik/uretici.mjs). Etiketler gerekir: git fetch --tags (CI'nın sığ klonunda yoktur; CI depodaki
// fikstürleri kullanır).
//
//   Fikstürleri yeniden üret (depoya konanlar; küçük hacim, tohum 7; zincir adı verilirse yalnız o):
//     node --disable-warning=ExperimentalWarning tools/surum-verisi.mjs --fikstur [zincir,cakisma,eski]
//   → test/fixtures/surum-2.0.16-zincir … surum-2.0.20-zincir (2.0.16 → 2.0.17 → 2.0.18 → 2.0.19 → 2.0.20 zincirinin her
//     sürümden sonraki kesiti), test/fixtures/surum-2.0.19-cakisma (gerçek v2.0.19'da 002 → 005, sonra yeni 002: iki şirket
//     aynı sirketler/002 klasöründe) ve test/fixtures/surum-2.0.19-eski (v1.3.1 → v2.0.16 → v2.0.19: "hukuk-ofisi.sqlite"
//     adlı eski veri dosyası ve v1.3.1'in kendi aracıyla alınmış yedeği). İçerik deposu: test/fixtures/surum-nesneler
//     (Brotli, içerik başına bir kez).
//
//   Büyük hacimli yerel koşu (gerçek müşteri tablosu boyunda: 9.200 satırlık REHBER, binlerce cari, 15 ay) + güncel sürümle
//   doğrulama:
//     node --disable-warning=ExperimentalWarning tools/surum-verisi.mjs --zincir zincir --hacim buyuk --tohum 7 --dogrula
//   Seçenekler: --zincir zincir|cakisma|eski, --hacim kucuk|buyuk, --tohum N, --cikti <klasör> (verilmezse geçici), --dogrula,
//   --dur v2.0.19 (zinciri o sürümden sonra durdurur). Çıktı klasörü rastgele sıra testine taban olabilir:
//     npm run test:guvenilirlik -- --taban <klasör> --islem 1000
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FIXTURES, STORE, packFixture } from "../test/guvenilirlik/fikstur.mjs";
import { runChain } from "../test/guvenilirlik/uretici.mjs";

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const value = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
};
const log = line => console.log(line);
const started = performance.now();

if (flag("fikstur")) {
  // --fikstur [zincir,cakisma,eski]: verilen zincirlerin fikstürleri yeniden üretilir (öbürlerine dokunulmaz); sonda hiçbir
  // fikstürün kullanmadığı içerik nesneleri silinir.
  const seed = Number(value("tohum", 7));
  const chains = value("fikstur", "zincir,cakisma,eski").split(",").map(item => item.trim()).filter(Boolean);
  mkdirSync(STORE, { recursive: true });
  for (const chain of chains) {
    for (const name of readdirSync(FIXTURES).filter(item => item.startsWith("surum-") && item.endsWith(`-${chain}`))) rmSync(path.join(FIXTURES, name), { recursive: true, force: true });
    const root = mkdtempSync(path.join(tmpdir(), `surum-verisi-${chain}-`));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    await runChain({
      chain,
      dataDir,
      backupDir,
      seed,
      volume: "kucuk",
      log,
      // Zincirin her kesiti fikstür olur; çakışma ve eski kurulum zincirlerinde yalnız son hâl.
      onPhaseEnd: ({ version, last, manifest }) => {
        if (chain !== "zincir" && !last) return;
        const name = `surum-${version.slice(1)}-${chain}`;
        const packed = packFixture({ name, dataDir, backupDir, manifest: { ...manifest, generator: { command: `node tools/surum-verisi.mjs --fikstur ${chain}`, chain, seed, volume: "kucuk" } } });
        log(`  ▸ fikstür ${name}: ${packed.files} dosya, ${(packed.bytes / 1e6).toFixed(1)} MB açık`);
      },
    });
    rmSync(root, { recursive: true, force: true });
  }
  const used = new Set();
  for (const name of readdirSync(FIXTURES).filter(item => item.startsWith("surum-") && item !== "surum-nesneler")) {
    for (const item of JSON.parse(readFileSync(path.join(FIXTURES, name, "fikstur.json"), "utf8")).files) used.add(`${item.sha256}.br`);
  }
  let stored = 0;
  for (const name of readdirSync(STORE)) {
    if (!used.has(name)) rmSync(path.join(STORE, name));
    else stored += statSync(path.join(STORE, name)).size;
  }
  log(`İçerik deposu: ${used.size} nesne, ${(stored / 1e6).toFixed(2)} MB · ${((performance.now() - started) / 1000).toFixed(1)} sn`);
} else {
  const chain = value("zincir", "zincir");
  const volume = value("hacim", "kucuk");
  const seed = Number(value("tohum", 7));
  const root = path.resolve(value("cikti", mkdtempSync(path.join(tmpdir(), `surum-verisi-${chain}-${volume}-`))));
  mkdirSync(root, { recursive: true });
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const manifest = await runChain({ chain, dataDir, backupDir, seed, volume, log, stopAfter: value("dur", null) });
  writeFileSync(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
  log(`Üretildi: ${root} · ${((performance.now() - started) / 1000).toFixed(1)} sn · sürüm süreleri ${JSON.stringify(manifest.timings)}`);
  if (flag("dogrula")) {
    const { verifyUpgrade } = await import("../test/guvenilirlik/dogrula.mjs");
    // Doğrulama geri yükler ve veri ekler: üretilen klasör bozulmasın diye kopyasında yapılır (klasör rastgele sıra testine taban olur).
    const copy = mkdtempSync(path.join(tmpdir(), "surum-verisi-dogrula-"));
    cpSync(dataDir, path.join(copy, "data"), { recursive: true });
    cpSync(backupDir, path.join(copy, "backups"), { recursive: true });
    const report = await verifyUpgrade({ dataDir: path.join(copy, "data"), backupDir: path.join(copy, "backups"), manifest, log });
    rmSync(copy, { recursive: true, force: true });
    log(`Doğrulama: ${report.checks} denetim, ${report.failures.length} hata · ${(report.ms / 1000).toFixed(1)} sn`);
    for (const failure of report.failures) log(`  ✗ ${failure}`);
    process.exitCode = report.failures.length ? 1 : 0;
  }
}
