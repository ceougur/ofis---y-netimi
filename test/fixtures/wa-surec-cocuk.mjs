// 2.4.8 W2 arıza testi (test/whatsapp-w2-surec-olumu-248.test.mjs) çocuk süreci: GERÇEK program aynı veri klasörüyle açılır, toplu gönderim başlatır ve işçi
// KENDİ zamanlayıcısıyla (whatsappWorker "auto") gönderir; ebeveyn süreç istek Meta'dayken (sahte Graph yanıt vermiyor) bu süreci SIGKILL ile öldürür.
// Meta adresi yalnız ebeveynin yerel sahte sunucusu (ders 30); lisans servisi ölü yerel adres (HUKUK_LICENSE_URL, ebeveyn verir) ve lisans zamanlayıcısı kapalı.
// Argümanlar: <veri klasörü> <yedek klasörü> <sahte Graph adresi> <istek kimliği>
import { loginAdmin, startTestServer } from "../helpers.mjs";

const [dataDir, backupDir, graphUrl, requestId] = process.argv.slice(2);
const TOKEN = "SAHTE-W2-belirtec-Gizli_0123456789-abcdefABCDEF-xyz";
const server = await startTestServer({ dataDir, backupDir, now: { time: "2026-11-03T09:00:00+03:00", fixed: true }, whatsappGraphUrl: graphUrl, whatsappTimeoutMs: 120_000, whatsappWorker: "auto", whatsappGapMs: 0 });
const api = await loginAdmin(server);
server.app.store.setSetting("office.name", "Örnek Ticaret");
await api.put("/api/workspace/whatsapp/connection", { phoneNumberId: "106540352242922", wabaId: "102290129340398", token: TOKEN });
await api.put("/api/workspace/whatsapp/ack", { ack: true });
const account = (await api.post("/api/workspace/accounts", { name: "Süreç Ölümü", phone: "0553 000 00 01", openingBalance: "75" })).data.data;
const created = await api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids: [account.id], preset: "thisMonth", requestId });
process.stdout.write(`${JSON.stringify({ ready: true, status: created.status, batchId: created.data?.data?.batch?.id || null })}\n`);
// Ebeveyn öldürene dek açık kalır.
setInterval(() => {}, 1000);
