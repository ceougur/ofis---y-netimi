// DestekOfis merkezi sunucusu — komut satırı girişi.
// Çalıştırma: node --disable-warning=ExperimentalWarning server/server.mjs
import { createApp } from "./app.mjs";

const app = createApp();
const address = await app.listen().catch(error => {
  app.log.error(error.code === "EADDRINUSE" ? `Port ${app.config.port} kullanımda. Başka bir DestekOfis sunucusu çalışıyor olabilir.` : "Sunucu başlatılamadı", error);
  process.exit(1);
});
app.log.info(`${app.config.productName} ${app.config.version} merkezi sunucusu http://${app.config.host}:${address.port}`);

let stopping = false;
const shutdown = async signal => {
  if (stopping) return;
  stopping = true;
  app.log.info(`${signal} alındı, sunucu kapatılıyor…`);
  const force = setTimeout(() => process.exit(0), 5000);
  force.unref();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGBREAK", () => shutdown("SIGBREAK"));
