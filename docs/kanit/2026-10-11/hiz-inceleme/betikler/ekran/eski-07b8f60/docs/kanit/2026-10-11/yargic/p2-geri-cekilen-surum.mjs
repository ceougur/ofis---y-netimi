// Yargıç sondası 2: gün içinde hazırlanan sürüm yayından GERİ ÇEKİLİRSE (yayın silindi; kaynak çalışıyor, "güncel" diyor) ertesi açılışta
// yine de kurulur mu? Gerçek süreçler (test/guncelleme-gercek/ortak.mjs; test/guncelleme-hazir.test.mjs (c) kalıbı).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildTestRelease, prepareInstall, releaseEntry, startActivity, startFeed, startService, stopAllActivity, waitFor } from "../../../../test/guncelleme-gercek/ortak.mjs";

const work = mkdtempSync(path.join(tmpdir(), "yargic-geri-cekilen-"));
const DAY = { quiet: "never", retryDelays: [], timings: { idleMs: 600_000, periodicCheckMs: 600, periodicJitterMs: 0, deferRecheckMs: 600_000 } };
const root = path.join(work, "kurulum");
await prepareInstall(root, {});
const v901 = releaseEntry(buildTestRelease(work, "9.0.1"));
const feed = await startFeed({ releases: [] });
let service = null;
try {
  service = await startService(root, { feed: feed.url, ...DAY });
  console.log("ilk sürüm", await service.appVersion());
  await startActivity(service.base, { intervalMs: 300 });
  feed.setReleases([v901]);
  await waitFor(async () => {
    const value = await service.status();
    return value.updates.prepared?.version === "9.0.1" ? value : Promise.reject(new Error("hazır değil"));
  }, { timeoutMs: 60_000 });
  console.log("9.0.1 hazırlandı (gün içinde)");
  // Yayıncı 9.0.1'i geri çeker: yayın listesi boş, kaynak çalışıyor.
  feed.setReleases([]);
  await stopAllActivity();
  const offset = readFileSync(service.logFile, "utf8").length;
  await service.stop();
  service = await startService(root, { feed: feed.url, retryDelays: [] });
  const version = await service.appVersion();
  const bootLog = readFileSync(service.logFile, "utf8").slice(offset);
  console.log("yeniden açılış sonrası çalışan sürüm:", version);
  console.log("açılış günlüğü (ilgili satırlar):");
  for (const line of bootLog.split("\n").filter(l => /hazır|denetim|9\.0\.1|güncel/i.test(l)).slice(0, 12)) console.log("  ", line.slice(0, 220));
  const st = await service.status();
  console.log("lastCheck:", JSON.stringify(st.updates.lastCheck), "lastResult:", JSON.stringify(st.updates.lastResult));
} finally {
  await stopAllActivity();
  await service?.stop().catch(() => {});
  await feed.close();
  rmSync(work, { recursive: true, force: true });
}
