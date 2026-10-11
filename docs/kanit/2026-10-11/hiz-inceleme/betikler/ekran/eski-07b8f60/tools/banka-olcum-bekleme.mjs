// Banka ölçüm aracının yardımcısı (tools/banka-hareket-olcum.mjs; GG2): AYRI SÜREÇTE "başka bir kullanıcı". Sunucu tek iş parçacığında çalışır
// (eşzamanlı SQLite); ağır bir istek sürerken başka kullanıcının en hafif isteği (oturum bilgisi) ne kadar bekliyor? Aynı süreçte ölçülemez:
// ağır istek sunucuyla birlikte ölçüm saatini de durdurur. Ana süreç IPC ile "git" der; bu süreç 20 ms bekleyip isteği gönderir ve süreyi bildirir.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { createClient } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const [base, user, password] = process.argv.slice(2);
const client = createClient(base);
const login = await client.login(user, password);
if (login.status !== 200) throw new Error(`giriş: ${login.status}`);
process.send({ ready: true });
process.on("message", async message => {
  if (message === "kapat") return process.exit(0);
  await new Promise(resolve => setTimeout(resolve, 20));
  const at = performance.now();
  const res = await client.get("/api/auth/me");
  process.send({ ms: performance.now() - at, status: res.status });
});
