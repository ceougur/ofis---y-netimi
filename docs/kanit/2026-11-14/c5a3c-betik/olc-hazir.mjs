// Hız ölçümünün ŞÜPHELİ + BAĞLI ALACAKLI carisini temiz 100 bin satırın kopyasına PROGRAMIN KENDİ API'siyle ekler (taban kodla; iki kuralda da kabul edilen tutarlar).
// Kullanım: node olc-hazir.mjs <kod kökü> <veri kopyası>
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const ok = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return r.data?.data ?? r.data; };
const acc = await ok("cari", client.post("/api/workspace/accounts", { name: "Ölçüm Şüpheli Bağlı", type: "customer", registeredOn: "2026-01-01", phone: "0500 900 11 22" }));
const D = "2026-10-08";
const invs = [];
for (let i = 0; i < 20; i += 1) invs.push((await ok("fatura", client.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: D, lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { rest: "open" } }))).id);
await ok("şüpheliye al", client.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "10000", date: D, reason: "lawsuit", note: "ölçüm" }));
for (let i = 0; i < 20; i += 1) await ok("bağlı tahsilat", client.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "400", date: D, method: "cash", cashForce: true, similarOk: true, invoiceId: invs[i] }));
for (let i = 0; i < 5; i += 1) await ok("bağlı çek", client.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: `OLCS-${i}`, amount: "100", accountId: acc.id, issueDate: D, dueDate: "2026-12-01", invoiceId: invs[i] }));
console.log(JSON.stringify({ cari: acc.id, faturalar: invs.length }));
await app.close();
