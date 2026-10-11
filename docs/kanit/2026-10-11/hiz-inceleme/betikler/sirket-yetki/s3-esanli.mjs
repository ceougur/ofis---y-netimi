// S3: 002'de büyük veri (iş parçacığı raporu uzun sürsün); rapor sürerken kod/ad değişimi, sıfırlama, geri yükleme, silme.
import { mkdtempSync, readdirSync, readlinkSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
const R = "/home/user/ofis---y-netimi/test/";
const { startTestServer, loginAdmin, ADMIN_PASSWORD } = await import(R + "helpers.mjs");
const { apiOf } = await import(R + "banka-210-ortak.mjs");
const SCR = path.dirname(new URL(import.meta.url).pathname);
const dataDir = mkdtempSync(path.join(SCR, "veri3-"));
let workers = 0; process.on("worker", () => { workers += 1; });
const NOW = "2026-10-08T12:00:00+03:00";
const BANK = "/api/workspace/bank", RC = "/api/workspace/report-center";
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data ?? r.error).slice(0, 400)}`); return r.data; };
const N = Number(process.env.N || 300000);
const A = await startTestServer({ dataDir, reportWorker: true, now: { time: NOW, fixed: true }, maxCompanies: 3, gateVerify: false, moneyStrict: false });
const api = apiOf(await loginAdmin(A));
const out = {};
async function make(name) {
  const created = await must(name, api.post("/api/companies", { name, select: false }));
  const co = created.company || created;
  const q = `hofCompany=${encodeURIComponent(co.id)}`;
  const p = await must("p", api.post(`/api/workspace/accounts?${q}`, { name: `${name} Cari`, type: "customer", registeredOn: "2026-01-01" }));
  const ak = await must("ak", api.post(`${BANK}/accounts?${q}`, { bankName: "Akbank", name: `${name} TL`, kind: "demand", opening: { date: "2026-01-02", amount: "7.777", confirmed: true } }));
  await must("e", api.post(`/api/workspace/accounts/${p.id}/entries?${q}`, { kind: "in", amount: "10", method: "bank", bankAccountId: ak.id, date: "2026-10-03", similarOk: true }));
  const file = path.join(dataDir, "sirketler", co.code, "destekofis.sqlite");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 10000");
  const row = db.prepare("SELECT * FROM account_entries WHERE fin_ref = ?").get(ak.id);
  db.exec("BEGIN");
  const ins = db.prepare("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, created_by, created_at, method, fin_ref, event_id) VALUES (?, ?, 'in', 1, ?, '', '', '', ?, ?, 'bank', ?, '')");
  for (let i = 0; i < N; i++) ins.run(`bulk-${i}`, row.account_id, `2026-0${1 + (i % 9)}-1${i % 10}`, row.created_by, row.created_at, ak.id);
  db.exec("COMMIT"); db.close();
  return { co, q, ak, file };
}
const c2 = await make("Büyük İki");
const fdsTo = file => { try { return readdirSync("/proc/self/fd").filter(fd => { try { return readlinkSync(`/proc/self/fd/${fd}`).startsWith(path.dirname(file)); } catch { return false; } }).length; } catch { return -1; } };
const timed = async (label, url) => { const t = Date.now(); const r = await api.get(url); return { label, ms: Date.now() - t, status: r.status, code: r.code, error: r.error, total: r.data?.total, summary: r.data?.summary?.find?.(x => x[0] === "Dönem Sonu" || x[0] === "Gerçek Banka") }; };
const url = (c, extra = "") => `${RC}/banka-hareket?preset=all&bankAccount=${c.ak.id}&${c.q}${extra}`;
out.baseline = await timed("taban", url(c2));
// (a) rapor sürerken kod/ad değişimi
{
  const p = timed("rapor", url(c2));
  await new Promise(r => setTimeout(r, 150));
  const ren = await api.put(`/api/companies/${c2.co.id}`, { code: "005", name: "Yeni Ad" });
  out.renameDuring = { report: await p, rename: ren.status, renameErr: ren.error };
  out.afterRename = await timed("sonra", url(c2));
}
// (b) rapor sürerken sıfırlama
{
  const p = timed("rapor", url(c2));
  await new Promise(r => setTimeout(r, 150));
  const t = Date.now();
  const rs = await api.post(`/api/companies/${c2.co.id}/reset`, { confirm: "005", password: ADMIN_PASSWORD, mode: "movements" });
  out.resetDuring = { report: await p, reset: rs.status, resetErr: rs.error, resetMs: Date.now() - t };
  out.afterReset = await timed("sonra", url(c2));
}
// (c) büyük veri yeniden + rapor sürerken geri yükleme (sıfırlama öncesi yedeğe)
{
  const list = await must("yedekler", api.get("/api/admin/backups"));
  const flat = JSON.stringify(list);
  const name = (flat.match(/"name":"([^"]*sifirlama-oncesi[^"]*)"/) || [])[1];
  out.backupName = name;
  // rapor hesabı sıfırlandı (açılış silindi) — yine de satır yok; geri yüklemede büyük veri döner. Önce geri yükle, sonra eşzamanlı ikinci geri yükleme sırasında rapor.
  const r1 = await api.post("/api/admin/backups/restore", { name, company: c2.co.id, confirm: "005", password: ADMIN_PASSWORD });
  out.restore1 = { status: r1.status, err: r1.error };
  out.afterRestore = await timed("geri yükleme sonrası", url(c2));
  const p = timed("rapor", url(c2));
  await new Promise(r => setTimeout(r, 150));
  const t = Date.now();
  const r2 = await api.post("/api/admin/backups/restore", { name, company: c2.co.id, confirm: "005", password: ADMIN_PASSWORD });
  out.restoreDuring = { report: await p, restore: r2.status, err: r2.error, restoreMs: Date.now() - t };
  out.afterRestore2 = await timed("sonra", url(c2));
}
// (d) rapor sürerken silme
{
  const p = timed("rapor", url(c2));
  await new Promise(r => setTimeout(r, 150));
  const t = Date.now();
  const d = await api.client.raw("DELETE", `/api/companies/${c2.co.id}`, { body: JSON.stringify({ confirm: "005", password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } }).catch(e => ({ status: String(e) }));
  out.deleteDuring = { report: await p, del: d?.status, delBody: d?.data ?? (d?.buffer ? d.buffer.toString().slice(0, 300) : null), ms: Date.now() - t, fileExists: existsSync(c2.file), fds: fdsTo(c2.file) };
}
out.workers = workers;
await A.close();
console.log(JSON.stringify(out, null, 1));
