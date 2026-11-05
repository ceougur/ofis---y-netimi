// 2.4.9 B3 (docs/2.4.9-tasarim/B3-B4.md §B3-5 T4 "2.4.9 yedeği 2.4.8'e → 409"): bu deponun (yeni) göçleriyle v45'e çıkarılmış şirket dosyası, ESKİ sürümün
// gerçek yedek denetimine (git archive ile ayrı kopya; ders 23) verilir → 409 "daha yeni bir sürümde alınmış". npm test'e girmez (eski kod kopyası gerekir).
// Kullanım: node test/t9-248/b3-eski-surume-yedek.mjs <eski kod kökü> <çalışma klasörü>
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [eski, is] = process.argv.slice(2);
let gecen = 0;
let toplam = 0;
const denetle = (ad, kosul, ayrinti = "") => {
  toplam += 1;
  if (kosul) gecen += 1;
  console.log(`${kosul ? "ok" : "not ok"} ${toplam} - ${ad}${ayrinti ? ` (${ayrinti})` : ""}`);
};
try {
  rmSync(is, { recursive: true, force: true });
  mkdirSync(is, { recursive: true });
  const file = path.join(is, "destekofis-002-b3.sqlite");
  writeFileSync(file, gunzipSync(readFileSync(path.join(KOK, "test/fixtures/whatsapp-pdf-v248/002.sqlite.gz"))));
  const { openDatabase, createStore } = await import(pathToFileURL(path.join(KOK, "server/lib/db.mjs")).href);
  const { runMigrations, LATEST_VERSION } = await import(pathToFileURL(path.join(KOK, "server/lib/migrations.mjs")).href);
  const db = openDatabase(file);
  const out = runMigrations(createStore(db), { backupDir: null });
  db.close();
  denetle("yeni kodla v45'e çıktı", out.to === 45 && LATEST_VERSION === 45, JSON.stringify(out));
  const old = await import(pathToFileURL(path.join(eski, "server/lib/company-backups.mjs")).href);
  const oldMig = await import(pathToFileURL(path.join(eski, "server/lib/migrations.mjs")).href);
  denetle("eski kodun en son şeması 44", oldMig.LATEST_VERSION === 44, String(oldMig.LATEST_VERSION));
  let error = null;
  try {
    old.inspectBackup(file);
  } catch (caught) {
    error = caught;
  }
  denetle("eski sürüm v45 yedeğini 409 ile reddeder", error?.status === 409 && /daha yeni bir sürümünde/.test(error?.message || ""), `${error?.status} ${error?.message}`);
} catch (error) {
  denetle("hatasız bitti", false, String(error?.stack || error));
} finally {
  rmSync(is, { recursive: true, force: true });
  console.log(`1..${toplam}\n# tests ${toplam}\n# pass ${gecen}\n# fail ${toplam - gecen}\n# cancelled 0\n# skipped 0\n# todo 0`);
  process.exitCode = gecen === toplam ? 0 : 1;
}
