// Test yardımcısı (2.5.0 D2 tur 2, test/devir-d2-arsiv-goc-kesinti-250.test.mjs) — AYRI SÜREÇ. Programı verilen veri / yedek klasöründe açar (lisans servisi yerel
// kapalı adres — ders 30), 001'in <yıl> arşivini açar (eski şemalı → arşivin göçü) ve göçün verilen KESME NOKTASINDA süreci SIGKILL ile öldürür.
//   node devir-d2-arsiv-goc-isci.mjs <dataDir> <backupDir> <yıl> <kesme noktası> <not dosyası>
// Kesme iki yoldan:
//   (1) "kanca": programın test kancası (server/app.mjs __testArchiveStep) o adımı bildirince (kopya-goc-etti | bekleyen-yazildi | tasindi);
//   (2) "yoklama": kancası olmayan ESKİ kodda (ders 51: eski kopyaya yalnız bu yardımcı ve yeni test girer) aynı pencere — arşiv dosyası son şemaya geçmiş ve günlük
//       dosyası yokken (dosya yerinde göç etti, kayıt henüz yazılmadı: dar kontrol 06.11 p3'ün kesmesi). Yeni kodda dosya yalnız taşımada değişir ve "tasindi" kancası
//       aynı eşzamanlı adımda gelir; yoklama ancak kanca hiç gelmezse (yanlış adım adı) sonradan tetiklenir — test yolu "kanca" bekler.
// Ölmeden önce not dosyasına { yol, adim, dosyaSema, … } yazılır (eşzamanlı yazım). Kesme olmazsa { yol: "bitti" } yazıp 0 ile çıkar.
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const { closeSync, existsSync, openSync, readSync, writeFileSync } = await import("node:fs");
const path = (await import("node:path")).default;
const { createApp } = await import("../../server/app.mjs");
const { ROOT_COMPANY_ID } = await import("../../server/lib/companies.mjs");
const { LATEST_VERSION } = await import("../../server/lib/migrations.mjs");

const [dataDir, backupDir, year, stepName, noteFile] = process.argv.slice(2);
const file = path.join(dataDir, "arsiv", String(year), "destekofis.sqlite");
// SQLite başlığındaki user_version (60. bayt, 4 bayt büyük sonlu) — bağlantı açmadan.
const headerVersion = () => {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(4);
    readSync(fd, buf, 0, 4, 60);
    return buf.readUInt32BE(0);
  } finally {
    closeSync(fd);
  }
};
const die = (yol, extra = {}) => {
  writeFileSync(noteFile, JSON.stringify({ yol, adim: stepName, dosyaSema: headerVersion(), ...extra }));
  process.kill(process.pid, "SIGKILL");
};
const app = createApp({
  dataDir,
  backupDir,
  logLevel: "silent",
  scheduleBackups: false,
  license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false,
  whatsappWorker: "manual",
  env: { HUKUK_DATASET_AUTOSYNC: "0" },
  __testArchiveStep: name => {
    if (name === stepName) die("kanca");
  },
});
let ticks = 0;
const poll = () => {
  ticks += 1;
  if (headerVersion() === LATEST_VERSION && !existsSync(`${file}-wal`)) die("yoklama", { tur: ticks });
  else setImmediate(poll);
};
setImmediate(poll);
await app.openArchive(app.companies.get(ROOT_COMPANY_ID), String(year));
writeFileSync(noteFile, JSON.stringify({ yol: "bitti", adim: stepName, dosyaSema: headerVersion() }));
process.exit(0);
