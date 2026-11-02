// 2.4.8 SON ADAY T6/T8 (arıza ve yedek, güvenlik) ÇOCUK SÜREÇ: GERÇEK program (startTestServer → createApp; aynı kod, aynı göçler) ayrı süreçte açılır, işçi KENDİ
// zamanlayıcısıyla ("auto") gönderir; ebeveyn HTTP ile sürer ve gerektiğinde SIGKILL ile öldürür (yalnız KENDİ başlattığı pid — ders 36). Meta adresi yalnız
// ebeveynin YEREL sahte Graph'ı (ders 30); lisans servisi ölü yerel adres (HUKUK_LICENSE_URL=http://127.0.0.1:9 — ebeveyn verir), lisans zamanlayıcısı kapalı.
// Günlük GERÇEK günlükleyiciyle (debug) stdout/stderr'e — üretimde Windows servisi bu akışı günlük dosyasına yazar (T8 günlük taraması bu akışı okur).
// Argüman: JSON { dataDir, backupDir, graphUrl, timeoutMs, gapMs, now, kur: { office, pnid, waba, token } }
import { createLogger } from "../../server/lib/logger.mjs";
import { loginAdmin, startTestServer } from "../helpers.mjs";

const o = JSON.parse(process.argv[2]);
if (process.env.HUKUK_LICENSE_URL !== "http://127.0.0.1:9") throw new Error("ders 30: HUKUK_LICENSE_URL ölü yerel adres olmalı");
const server = await startTestServer({
  dataDir: o.dataDir,
  backupDir: o.backupDir,
  now: o.now || "2026-11-03T09:00:00+03:00",
  whatsappGraphUrl: o.graphUrl,
  whatsappTimeoutMs: o.timeoutMs || 3000,
  whatsappWorker: "auto",
  whatsappGapMs: o.gapMs ?? 200,
  log: createLogger("debug"),
});
if (o.kur) {
  const api = await loginAdmin(server);
  server.app.store.setSetting("office.name", o.kur.office);
  const c = await api.put("/api/workspace/whatsapp/connection", { phoneNumberId: o.kur.pnid, wabaId: o.kur.waba, token: o.kur.token });
  const a = await api.put("/api/workspace/whatsapp/ack", { ack: true });
  if (c.status !== 200 || a.status !== 200) throw new Error(`kurulum: ${c.status} ${a.status} ${JSON.stringify(c.data)}`);
}
process.stdout.write(`${JSON.stringify({ ready: true, base: server.base, pid: process.pid })}\n`);
process.on("SIGTERM", async () => {
  await server.app.close().catch(() => {});
  process.exit(0);
});
setInterval(() => {}, 1000);
