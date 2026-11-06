// Test yardımcısı (2.5.0 D2, test/devir-d2-bakim-250.test.mjs "yarıda kesilme") — AYRI SÜREÇ. Programı verilen veri / yedek klasöründe açar (lisans servisi yerel
// kapalı adres — ders 30: çağıran HUKUK_LICENSE_URL=http://127.0.0.1:9 verir; burada da zorlanır), verilen şirketleri BAKIM KİPİNE alır, "HAZIR <json>" yazar ve
// bekler. Ana süreç SIGKILL ile öldürür (kip açıkken süreç ölümü).
//   node devir-d2-bakim-isci.mjs <dataDir> <backupDir> <şirket kimlikleri virgüllü>
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const { createApp } = await import("../../server/app.mjs");
const [dataDir, backupDir, ids] = process.argv.slice(2);
const app = createApp({ dataDir, backupDir, logLevel: "silent", scheduleBackups: false, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, whatsappWorker: "manual", env: { HUKUK_DATASET_AUTOSYNC: "0" } });
await app.listen(0, "127.0.0.1");
const entered = [];
for (const id of String(ids || "").split(",").filter(Boolean)) entered.push(await app.maintenance.enter(id, { reason: "devir", runId: `isci-${id}`, label: id }));
process.stdout.write(`HAZIR ${JSON.stringify({ pid: process.pid, entered: entered.map(item => item.companyId) })}\n`);
setInterval(() => {}, 60_000);
