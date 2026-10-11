// Bağımsız doğrulayıcı: 002'de banka raporları açıkken 002 geri yükleme / silme → raporların yanıt kodları.
// Kullanım: node v1-geri-yukle.mjs <kök> <satır>
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = path.resolve(process.argv[2]);
const N = Number(process.argv[3] || 300);
const H = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const server = await H.startTestServer({ reportWorker: true, bankPickLegacy: true, now: "2026-10-08T12:00:00+03:00", moneyStrict: false, gateVerify: false });
const client = await H.loginAdmin(server);
const u = r => (r.data && r.data.ok === true ? r.data.data : r.data);
const post = async (url, b) => { const r = await client.post(url, b); if (r.status !== 200) throw new Error(url + " " + r.status + " " + JSON.stringify(r.data).slice(0, 300)); return u(r); };
const second = (await post("/api/companies", { code: "002", name: "İkinci", select: true })).company;
const party = await post("/api/workspace/accounts", { name: "Doğrulayıcı Ltd.", type: "customer", registeredOn: "2026-01-01" });
const acc = await post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", opening: { date: "2026-01-02", amount: "100.000", confirmed: true } });
for (let i = 0; i < N; i++) await post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: String(100 + i), method: "bank", bankAccountId: acc.id, date: `2026-0${1 + (i % 9)}-1${i % 9}`, similarOk: true });
const backup = (await post("/api/admin/backups", { scope: "one", companyId: second.id })).backups[0];
console.log("kök", ROOT, "satır", N, "yedek", backup.name, "runner", !!server.app.context.reportRunner, "children", typeof server.app.context.closeCompany);
const RC = "/api/workspace/report-center";
const rep = (id) => { const t = Date.now(); return client.get(`${RC}/${id}?preset=all&hofCompany=${second.id}`).then(r => `${r.status}${r.status !== 200 ? ":" + (r.data?.error || "") : ""}/${Date.now() - t}ms`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const tally = {};
for (let round = 1; round <= 5; round++) {
  const ps = ["banka-hareket", "banka-bakiye", "banka-hareket", "banka-masraf"].map(rep);
  await wait(10 + round * 15);
  const t = Date.now();
  const r = await client.post("/api/admin/backups/restore", { name: backup.name, company: second.id, confirm: "002", password: H.ADMIN_PASSWORD });
  const out = await Promise.all(ps);
  for (const o of out) { const k = o.split("/")[0]; tally[k] = (tally[k] || 0) + 1; }
  console.log(`[geri yükleme ${round}] ${r.status} ${Date.now() - t}ms | raporlar: ${out.join(", ")}`);
  const after = await client.get(`${RC}/banka-hareket?preset=all&hofCompany=${second.id}`);
  console.log(`   sonra rapor ${after.status} toplam ${u(after)?.total}`);
}
{
  const ps = ["banka-hareket", "banka-bakiye", "banka-masraf"].map(rep);
  await wait(20);
  const r = await client.raw("DELETE", `/api/companies/${second.id}`, { body: JSON.stringify({ confirm: "002", password: H.ADMIN_PASSWORD }), headers: { "content-type": "application/json" } });
  const out = await Promise.all(ps);
  for (const o of out) { const k = o.split("/")[0]; tally[k] = (tally[k] || 0) + 1; }
  console.log(`[silme] ${r.status} ${JSON.stringify(r.data).slice(0, 120)} | raporlar: ${out.join(", ")}`);
}
console.log("ÖZET", JSON.stringify(tally));
await server.close();
