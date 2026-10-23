// test/ebelge-244-gonderim-izi.test.mjs'in çocuk süreci: programı (güncel kod ya da bir sürüm etiketinin GERÇEK kodu — test/guvenilirlik/surumler.mjs
// checkoutTag) verilen veri klasöründe açar ve dinlediği portu ebeveyne bildirir. Ebeveyn e-Belge isteği EDM'ye ulaşmışken (yanıt yoldayken) bu süreci
// SIGKILL ile öldürür (elektrik kesintisi / çökme). Ağ: yalnız 127.0.0.1 (sahte EDM'nin önündeki vekil); lisans servisi ölü yerel adreste (ders 30).
// node ebelge-244-gonderim-izi-cocuk.mjs <sürüm|guncel> <veri klasörü> <yedek klasörü> <saat (yerel ISO)> <yönetici parolası>
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkoutTag } from "./guvenilirlik/surumler.mjs";

const [version, dataDir, backupDir, now, password] = process.argv.slice(2);
const DEAD_LICENSE_URL = "http://127.0.0.1:9";
process.env.HUKUK_LICENSE_URL = DEAD_LICENSE_URL;
const current = version === "guncel";
const appFile = current ? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "app.mjs") : path.join(checkoutTag(version).dir, "server", "app.mjs");
const { createApp } = await import(pathToFileURL(appFile).href);
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
  return globalThis.fetch(input, init);
};
const app = createApp({
  dataDir,
  backupDir,
  logLevel: "silent",
  scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: password, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: DEAD_LICENSE_URL },
  license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false,
  fetchImpl,
  now,
  edocEnabled: true,
  // e-SMM gönderimi 2.4.4'te açıldı; eski sürüm (v2.4.3) e-Arşiv ile denenir.
  ...(current ? { esmmEnabled: true, moneyStrict: true, gateVerify: true } : {}),
  edocStatusPollMs: [5, 5],
  testSeriesStart: () => 1,
});
const address = await app.listen(0, "127.0.0.1");
process.send({ port: address.port });
