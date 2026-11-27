// Kabul D (ders 17, 53 (b)): v2.4.9'un GERÇEK koduyla (git worktree v2.4.9) şüpheli kaydı OLAN carili, kilitli veri üretir — programın kendi API'siyle.
// Kullanım: ROOT=<v2.4.9 kökü> OUT=<veri klasörü (data/ backups/)> node v249-uret.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const OUT = process.env.OUT;
const helpers = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const TODAY = "2026-10-20";
const day = o => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await helpers.startTestServer({ dataDir: path.join(OUT, "data"), backupDir: path.join(OUT, "backups"), now: { time: `${TODAY}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const client = await helpers.loginAdmin(server);
const api = { get: async u => unwrap(await client.get(u)), post: async (u, b) => unwrap(await client.post(u, b)), put: async (u, b) => unwrap(await client.put(u, b)) };
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`); return r.data; };
await api.post("/api/workspace/bank/setup/dismiss", {});
const inv = async (acc, date, amount) => (await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open" } }))).id;
const cash = (acc, date, amount, extra = {}) => must(`tahsilat ${acc.name}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: String(amount), date, method: "cash", cashForce: true, similarOk: true, ...extra }));
let serial = 0;
const cheque = (acc, date, amount, invoiceId = "") => must(`çek ${acc.name}`, api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: `V249-${(serial += 1)}`, amount: String(amount), accountId: acc.id, issueDate: date, dueDate: day(60), ...(invoiceId ? { invoiceId } : {}) }));
const out = { kod: "v2.4.9", cariler: {} };
let n = 0;
// Her cari: F1 1.000 (B) → şüpheliye al `rec` (B+10) → F2 500 (B+20, kayıttan SONRA) → [Normal Cari Hesaba İşle 400 (B+25)] → son adım (B+30).
const cari = async (label, base, rec, normal, last) => {
  const acc = await must("cari", api.post("/api/workspace/accounts", { name: `V249 ${label}`, type: "customer", registeredOn: day(-900), phone: `0500 249 33 ${String((n += 1)).padStart(2, "0")}` }));
  const f1 = await inv(acc, day(base), 1000);
  await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: String(rec), date: day(base + 10), reason: "lawsuit", note: "v249" }));
  const f2 = await inv(acc, day(base + 20), 500);
  if (normal) await cash(acc, day(base + 25), normal, { doubtfulSkip: true });
  await last(acc, { f1, f2, at: o => day(base + o) });
  out.cariler[label] = { id: acc.id, f1, f2, base };
};
await cari("Kilitli F1 Bağlı Nakit", -300, 600, 0, (a, s) => cash(a, s.at(30), 400, { invoiceId: s.f1 }));
await cari("Kilitli F2 Bağlı Çek", -260, 600, 0, (a, s) => cheque(a, s.at(30), 400, s.f2));
await cari("Kilitli F1 Bağlı Çek", -220, 600, 0, (a, s) => cheque(a, s.at(30), 400, s.f1));
await cari("Kilitli Bağsız Nakit", -180, 600, 0, (a, s) => cash(a, s.at(30), 400));
await cari("Kilitli S168 F2 Nakit 100", -140, 1000, 400, (a, s) => cash(a, s.at(30), 100, { invoiceId: s.f2 }));
await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: day(-100) }));
await cari("Kilitsiz F1 Bağlı Nakit", -90, 600, 0, (a, s) => cash(a, s.at(30), 400, { invoiceId: s.f1 }));
await cari("Kilitsiz F2 Bağlı Çek", -50, 600, 0, (a, s) => cheque(a, s.at(30), 400, s.f2));
out.kilit = day(-100);
out.mutabakat = (server.app.integrity.scan().findings || []).map(f => f.code);
const b = {};
for (const e of server.app.ledger.build()) for (const l of e.lines || []) if ((l.account === "120" || l.account === "128") && l.party) { b[l.party] ||= { 120: 0, 128: 0 }; b[l.party][l.account] += l.debit - l.credit; }
for (const [label, c] of Object.entries(out.cariler)) c.defter249 = { b120: (b[c.id]?.[120] || 0) / 100, b128: (b[c.id]?.[128] || 0) / 100 };
console.log(JSON.stringify(out, null, 1));
await server.close();
