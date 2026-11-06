// YAN ÖLÇÜM (WhatsApp tur 1; kod DEĞİŞTİRMEZ): salt okunur lisansta Webhook Bilgileri'nin ilk GET'i çifti üretip 001'e YAZIYOR mu?
// A: etkinleştirilmemiş kurulum (salt okunur); B: süresi dolmuş lisans (WY kurulumu, 31 gün sonra — lisans doğrulanamadı / salt okunur).
// Her ikisinde: önce lisansın yazma kuralı (PUT ofis adı → 403 mü), sonra GET app-webhook öncesi / sonrası 001'deki whatsapp.appWebhook satırı.
// Kullanım: node yan-olcum-salt-okunur.mjs <depo kökü>
import path from "node:path";

const REPO = process.argv[2];
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const { loginAdmin, startTestServer } = await import(path.join(REPO, "test", "helpers.mjs"));
const { kurulum } = await import(path.join(REPO, "test", "whatsapp-wy-ortak.mjs"));
const row = store => store.get("SELECT value, updated_at FROM settings WHERE key = 'whatsapp.appWebhook'") || null;
const status = app => {
  try {
    const s = app.license.status?.();
    return `${s?.state ?? "?"} writable=${s?.writable ?? app.license.writable?.()}`;
  } catch (error) {
    return `okunamadı (${error.message})`;
  }
};
async function measure(label, server, api) {
  server.app.mobileRemote.setPublicUrl("http://ofis-yan.destekofis.test");
  const before = row(server.app.store);
  const write = await api.put("/api/admin/office", { name: "Yazma Denemesi" });
  const get = await api.get("/api/workspace/whatsapp/app-webhook");
  const after = row(server.app.store);
  const get2 = await api.get("/api/workspace/whatsapp/app-webhook");
  const after2 = row(server.app.store);
  console.log(`[${label}] lisans: ${status(server.app)}`);
  console.log(`[${label}] PUT /api/admin/office → ${write.status} ${write.data?.code || ""} (${String(write.data?.error || "").slice(0, 90)})`);
  console.log(`[${label}] GET app-webhook #1 → ${get.status} ready=${get.data?.data?.ready} belirteç ${get.data?.data?.verifyToken ? "VAR" : "YOK"}; 001 satırı önce: ${before ? "VAR" : "YOK"}, sonra: ${after ? `VAR (updated_at ${after.updated_at})` : "YOK"}`);
  console.log(`[${label}] GET app-webhook #2 → ${get2.status}; satır aynı: ${JSON.stringify(after) === JSON.stringify(after2)}; değer aynı: ${get.data?.data?.verifyToken === get2.data?.data?.verifyToken}`);
}
// A
{
  const server = await startTestServer({ env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["http://127.0.0.1:9/api/lisans"], autoTrial: false, firstCheckDelayMs: 3_600_000 } });
  try {
    const api = await loginAdmin(server);
    await measure("A etkinleştirilmemiş", server, api);
  } catch (error) {
    console.log(`[A] HATA ${error.stack || error.message}`);
  } finally {
    await server.close();
  }
}
// B
{
  const s = await kurulum({ root: "manual", second: "embedded" });
  try {
    s.clock.advance(31 * 86_400_000);
    await s.server.app.license.verifyNow?.().catch?.(() => {});
    await measure("B süresi dolmuş (31 gün)", s.server, s.api);
  } catch (error) {
    console.log(`[B] HATA ${error.stack || error.message}`);
  } finally {
    await s.close();
  }
}
