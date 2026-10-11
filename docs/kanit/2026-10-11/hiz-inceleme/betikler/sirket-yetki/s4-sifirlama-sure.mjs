// S3: 002'de büyük veri (iş parçacığı raporu uzun sürsün); rapor sürerken kod/ad değişimi, sıfırlama, geri yükleme, silme.
import { mkdtempSync, readdirSync, readlinkSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
const R = "/home/user/ofis---y-netimi/test/";
const { startTestServer, loginAdmin, ADMIN_PASSWORD } = await import(R + "helpers.mjs");
const { apiOf } = await import(R + "banka-210-ortak.mjs");
const SCR = path.dirname(new URL(import.meta.url).pathname);
const dataDir = mkdtempSync(path.join(SCR, "veri4-"));
let workers = 0; process.on("worker", () => { workers += 1; });
const NOW = "2026-10-08T12:00:00+03:00";
const BANK = "/api/workspace/bank", RC = "/api/workspace/report-center";
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data ?? r.error).slice(0, 400)}`); return r.data; };
const N = Number(process.env.N || 300000);
const A = await startTestServer({ dataDir, reportWorker: process.env.RW !== "0", now: { time: NOW, fixed: true }, maxCompanies: 3, gateVerify: false, moneyStrict: false });
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

// reset alone timing in company A (no report), reset with concurrent report in company B; event loop ping during reset
const c3 = await make("Büyük Üç");
const ping = async ms => { const t = Date.now(); const r = await api.get("/api/health"); return Date.now() - t; };
{ const t = Date.now(); const rs = await api.post(`/api/companies/${c2.co.id}/reset`, { confirm: c2.co.code, password: ADMIN_PASSWORD, mode: "movements" }); out.resetAlone = { status: rs.status, err: rs.error, ms: Date.now() - t }; }
{ const p = timed("rapor", url(c3)); await new Promise(r => setTimeout(r, 300)); const t = Date.now(); const rs = await api.post(`/api/companies/${c3.co.id}/reset`, { confirm: c3.co.code, password: ADMIN_PASSWORD, mode: "movements" }); out.resetWithReport = { status: rs.status, err: rs.error, ms: Date.now() - t, report: await p }; }
await A.close();
console.log(JSON.stringify(out, null, 1));
