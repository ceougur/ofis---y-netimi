// T6 (h) yardımcısı: v40 VERİSİNİ ESKİ SÜRÜMÜN GERÇEK KODUYLA üretir (ders 23: eski kod ayrı kopyada — git archive <v40 commit>; test kuralı: test verisi programın
// kendisinin ürettiği veri). Kuyrukta BEKLEYEN toplu gönderim bırakılır (işçi elle sürülür ve sürülmez → iş "Bekliyor"); program düzgün kapanır.
// Argüman: <eski kod kökü> <veri klasörü> <yedek klasörü> <sahte Graph adresi> <kişi sayısı>
const [eski, dataDir, backupDir, graphUrl, count] = process.argv.slice(2);
if (process.env.HUKUK_LICENSE_URL !== "http://127.0.0.1:9") throw new Error("ders 30");
const { loginAdmin, startTestServer } = await import(`${eski}/test/helpers.mjs`);
const server = await startTestServer({ dataDir, backupDir, now: { time: "2026-11-03T09:00:00+03:00", fixed: true }, whatsappGraphUrl: graphUrl, whatsappTimeoutMs: 3000, whatsappWorker: "manual", whatsappGapMs: 0 });
const api = await loginAdmin(server);
server.app.store.setSetting("office.name", "Örnek Ticaret");
const c = await api.put("/api/workspace/whatsapp/connection", { phoneNumberId: "106540352242922", wabaId: "102290129340398", token: "SAHTE-W2-belirtec-Gizli_0123456789-abcdefABCDEF-xyz" });
const a = await api.put("/api/workspace/whatsapp/ack", { ack: true });
const ids = [];
for (let i = 0; i < Number(count); i += 1) ids.push((await api.post("/api/workspace/accounts", { name: `Göç ${i}`, phone: `0554 000 ${String(Math.floor(i / 100)).padStart(2, "0")} ${String(i % 100).padStart(2, "0")}`, openingBalance: String(100 + i) })).data.data.id);
const b = await api.post("/api/workspace/whatsapp/batches", { kind: "statement", ids, preset: "thisMonth", requestId: "t6h-v40-000001" });
const version = server.app.store.get("PRAGMA user_version").user_version;
process.stdout.write(`${JSON.stringify({ ok: c.status === 200 && a.status === 200 && b.status === 200, version, batchId: b.data?.data?.batch?.id, status: [c.status, a.status, b.status], body: b.status === 200 ? null : b.data })}\n`);
await server.app.close();
