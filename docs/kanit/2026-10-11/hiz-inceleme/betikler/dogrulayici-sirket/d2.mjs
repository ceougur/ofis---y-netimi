// Bağımsız doğrulama: iş parçacığında çalışan banka raporu sürerken şirket silme / geri yükleme → raporun yanıt kodu.
import { startTestServer, loginAdmin, ADMIN_PASSWORD } from "/home/user/ofis---y-netimi/test/helpers.mjs";
const RW = process.env.RW !== "0";
const N = Number(process.env.N || 400);
const server = await startTestServer({ reportWorker: RW, now: "2026-10-08T12:00:00+03:00" });
const client = await loginAdmin(server);
const base = server.base || `http://127.0.0.1:${server.app.address?.port}`;
const req = async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: { cookie: client.cookie, "content-type": "application/json", origin: base }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
};
const out = { reportWorker: RW, N, rounds: [] };
async function setupCompany(code) {
  const c = await req("POST", "/api/companies", { code, name: `Doğrulama ${code}` });
  if (c.status !== 200) throw new Error("şirket " + JSON.stringify(c));
  const id = c.data.data.company.id;
  const q = `?hofCompany=${id}`;
  const party = await req("POST", `/api/workspace/accounts${q}`, { name: "Cari X", type: "customer", registeredOn: "2026-01-01" });
  const acc = await req("POST", `/api/workspace/bank/accounts${q}`, { bankName: "Ziraat Bankası", name: "Ana", kind: "demand", opening: { date: "2026-01-02", amount: "1.000", confirmed: true } });
  if (acc.status !== 200) throw new Error("hesap " + JSON.stringify(acc).slice(0, 300));
  for (let i = 0; i < N; i++) {
    const r = await req("POST", `/api/workspace/accounts/${party.data.data.id}/entries${q}`, { kind: "in", amount: `${100 + i}`, method: "bank", bankAccountId: acc.data.data.id, date: `2026-0${1 + (i % 9)}-1${i % 9}`, similarOk: true });
    if (r.status !== 200) throw new Error("satır " + JSON.stringify(r).slice(0, 300));
  }
  return { id, q };
}
const t0 = performance.now();
const { id, q } = await setupCompany("002");
out.setupMs = Math.round(performance.now() - t0);
// önce tek başına rapor süresi
let s = performance.now();
let alone = await req("GET", `/api/workspace/report-center/banka-hareket${q}&preset=all`);
out.alone = { status: alone.status, ms: Math.round(performance.now() - s), total: alone.data?.data?.total };
out.started = server.app.context.reportRunner?.stats;
// yedek al (geri yükleme için)
const b = await req("POST", "/api/admin/backups", { scope: "one", companyId: id });
const backupName = b.data?.data?.name;
out.backup = { status: b.status, name: backupName };
// A) geri yükleme sırasında rapor
for (const delay of [0, 10, 30]) {
  const p = (async () => { const st = performance.now(); const r = await req("GET", `/api/workspace/report-center/banka-hareket${q}&preset=all`); return { status: r.status, ms: Math.round(performance.now() - st), error: r.data?.error, code: r.data?.code }; })();
  await new Promise(r => setTimeout(r, delay));
  const rr = await req("POST", "/api/admin/backups/restore", { name: backupName, company: id, confirm: "002", password: ADMIN_PASSWORD });
  const rep = await p;
  out.rounds.push({ op: "restore", delay, restore: { status: rr.status, error: rr.data?.error }, report: rep });
}
{ const fs = await import("node:fs"); const fds = fs.readdirSync("/proc/self/fd").map(f => { try { return fs.readlinkSync("/proc/self/fd/" + f); } catch { return ""; } }); out.fdsAfterRestore = fds.filter(l => /sirketler/.test(l)); }
// rapor yeniden açılıyor mu
alone = await req("GET", `/api/workspace/report-center/banka-hareket${q}&preset=all`);
out.afterRestore = { status: alone.status, total: alone.data?.data?.total };
// B) silme sırasında rapor
{
  const p = (async () => { const st = performance.now(); const r = await req("GET", `/api/workspace/report-center/banka-hareket${q}&preset=all`); return { status: r.status, ms: Math.round(performance.now() - st), error: r.data?.error, code: r.data?.code }; })();
  await new Promise(r => setTimeout(r, 10));
  const dd = await req("DELETE", `/api/companies/${id}`, { confirm: "002", password: ADMIN_PASSWORD });
  const rep = await p;
  out.rounds.push({ op: "delete", delay: 10, del: { status: dd.status, error: dd.data?.error }, report: rep });
}
{ const fs = await import("node:fs"); await new Promise(r => setTimeout(r, 300)); const fds = fs.readdirSync("/proc/self/fd").map(f => { try { return fs.readlinkSync("/proc/self/fd/" + f); } catch { return ""; } }); out.fdsAfterDelete = fds.filter(l => /sirketler|silinen/.test(l)); }
console.log(JSON.stringify(out, null, 1));
await server.close();
process.exit(0);
