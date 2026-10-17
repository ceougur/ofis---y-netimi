// Zorla üretme (ders 20): sahte EDM (node:http, keepAliveTimeout 5 sn) ile programın EDM istemcisi aynı bağlantıyı ~5 sn boşta bıraktıktan sonra
// yeniden kullanınca UND_ERR_SOCKET olur mu? Bekleme 4.0–6.0 sn taranır; her bekleme için Durum Sorgula (e-refresh) çağrısı.
const R = "/home/user/ofis---y-netimi";
const { createApp } = await import(`${R}/server/app.mjs`);
const { createClient } = await import(`${R}/test/helpers.mjs`);
const { startMockEdm, OUR_VKN } = await import(`${R}/test/einvoice-mock.mjs`);
import { rmSync } from "node:fs";
const dir = "/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/hiz-fatura/keepalive-veri";
rmSync(dir, { recursive: true, force: true });
const mock = await startMockEdm();
const app = createApp({ dataDir: dir + "/data", backupDir: dir + "/b", logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Hiz-1-Yonetici!", HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, edocEnabled: true, edocLive: true });
const { port } = await app.listen(0, "127.0.0.1");
const api = createClient(`http://127.0.0.1:${port}`);
await api.login("admin", "Hiz-1-Yonetici!");
const u = r => (r.data && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
await api.post("/api/workspace/bank/setup/dismiss", {});
await api.put("/api/workspace/invoices/settings", { seller: { name: "K A.Ş.", taxNo: OUR_VKN, taxOffice: "X", address: "A", district: "B", city: "Ankara" }, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: mock.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
const p = u(await api.post("/api/workspace/accounts", { name: "Ali Veli", type: "customer", partyKind: "person", firstName: "Ali", familyName: "Veli", taxNo: "10000000146", taxOffice: "X", address: "a", district: "b", city: "Ankara" }));
const inv = u(await api.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", accountId: p.id, lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = [];
for (const wait of [1000, 4000, 4500, 4800, 4900, 4950, 5000, 5050, 5100, 5200, 5500, 6000]) {
  let bad = 0;
  for (let i = 0; i < 4; i += 1) {
    await api.post(`/api/workspace/invoices/${inv.id}/e-refresh`, {});
    await sleep(wait);
    const r = await api.post(`/api/workspace/invoices/${inv.id}/e-refresh`, {});
    if (r.status !== 200) bad += 1;
    if (r.status !== 200 && !rows.some(x => x.ornek)) rows.push({ ornek: `${r.status} ${JSON.stringify(r.data).slice(0, 160)}` });
  }
  rows.push({ beklemeMs: wait, deneme: 4, hata: bad });
  console.log(wait, bad);
}
console.log(JSON.stringify(rows));
await app.close(); await mock.close();
rmSync(dir, { recursive: true, force: true });
