// DestekOfis merkezi sunucusu — komut satırı girişi.
// Tek başına: node --disable-warning=ExperimentalWarning server/server.mjs
// Servis yöneticisi (supervisor.mjs) altında: IPC kanalı üzerinden "hazır" bildirir ve kapat komutunu dinler.
import { createApp } from "./app.mjs";

const app = createApp();
const address = await app.listen().catch(error => {
  app.log.error(error.code === "EADDRINUSE" ? `Port ${app.config.port} kullanımda. Başka bir DestekOfis sunucusu çalışıyor olabilir.` : "Sunucu başlatılamadı", error);
  process.exit(1);
});
app.log.info(`${app.config.productName} ${app.config.version} merkezi sunucusu http://${app.config.host}:${address.port}`);

let stopping = false;
const shutdown = async reason => {
  if (stopping) return;
  stopping = true;
  app.log.info(`${reason}: sunucu kapatılıyor…`);
  const force = setTimeout(() => process.exit(0), 5000);
  force.unref();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGBREAK", () => shutdown("SIGBREAK"));
// Beklenmedik hatalar (v2.0.2): sahipsiz bir söz reddi günlüğe yazılır, sunucu çalışmayı sürdürür; yakalanmamış
// istisna ise süreç durumunu güvenilmez kılar — günlüğe yazılıp düzgün kapanılır, servis yöneticisi yeniden başlatır.
process.on("unhandledRejection", reason => {
  app.log.error("Sahipsiz söz reddi (istek sürüyor)", reason instanceof Error ? reason : new Error(String(reason)));
});
process.on("uncaughtException", error => {
  app.log.error("Yakalanmamış hata; sunucu yeniden başlatılmak üzere kapanıyor", error);
  if (stopping) return;
  stopping = true;
  const force = setTimeout(() => process.exit(1), 3000);
  force.unref();
  app.close().catch(() => {}).finally(() => process.exit(1));
});

if (process.send) {
  const report = () => process.send?.({ type: "info", ...app.info() });
  process.send({ type: "ready", port: address.port, ...app.info() });
  app.onInfoChange(report);
  process.on("message", message => {
    if (message && message.type === "shutdown") shutdown("Servis yöneticisi kapatma istedi");
  });
  // Servis yöneticisi beklenmedik biçimde kapanırsa sunucu da kapanır (öksüz süreç kalmaz, veritabanı kilitli kalmaz).
  process.on("disconnect", () => shutdown("Servis yöneticisi bağlantısı koptu"));
}
