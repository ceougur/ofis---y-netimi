// S1: İki şirkette farklı banka verisi; iş parçacığı yolu (reportWorker true) ↔ yerinde yol (false) aynı veri dizininde karşılaştırılır.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import path from "node:path";
const R = "/home/user/ofis---y-netimi/test/";
const { startTestServer, loginAdmin, createUser } = await import(R + "helpers.mjs");
const { apiOf, xlsxSheets, pdfText } = await import(R + "banka-210-ortak.mjs");
const SCR = path.dirname(new URL(import.meta.url).pathname);
const dataDir = mkdtempSync(path.join(SCR, "veri-"));
let workers = 0;
process.on("worker", () => { workers += 1; });
const NOW = "2026-10-08T12:00:00+03:00";
const BANK = "/api/workspace/bank";
const RC = "/api/workspace/report-center";
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data ?? r.error).slice(0, 400)}`); return r.data; };
const opts = rw => ({ dataDir, reportWorker: rw, now: { time: NOW, fixed: true }, maxCompanies: 2, gateVerify: false });

let A = await startTestServer(opts(true));
let api = apiOf(await loginAdmin(A));
// 001
const p1 = await must("p1", api.post("/api/workspace/accounts", { name: "Bir Ltd", type: "customer", registeredOn: "2026-01-01" }));
const z = await must("ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Bir TL", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
const g = await must("garanti", api.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Bir İkinci", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } }));
for (let i = 0; i < 4; i++) await must("t1", api.post(`/api/workspace/accounts/${p1.id}/entries`, { kind: "in", amount: `${1000 + i}`, method: "bank", bankAccountId: i % 2 ? z.id : g.id, date: `2026-10-0${2 + i}`, similarOk: true }));
await must("tr1", api.post(`${BANK}/transfers`, { accountId: z.id, toAccountId: g.id, amount: "2.500", date: "2026-10-07", feeAmount: "5", feeTax: "bsmv_excl", feeType: "eft", similarOk: true }));
// 002
const created = await must("002", api.post("/api/companies", { name: "İkinci Şirket", select: false }));
const second = created.company || created;
const q = `hofCompany=${encodeURIComponent(second.id)}`;
const p2 = await must("p2", api.post(`/api/workspace/accounts?${q}`, { name: "İki Ltd", type: "customer", registeredOn: "2026-01-01" }));
// ileri tarihli eski hesapsız havale: saat ileri → kayıt → geri
await must("eski geçmiş", api.post(`/api/workspace/accounts/${p2.id}/entries?${q}`, { kind: "in", amount: "250", method: "bank", date: "2026-10-05" }));
A.clock.set("2026-10-20T12:00:00+03:00");
await must("eski ileri", api.post(`/api/workspace/accounts/${p2.id}/entries?${q}`, { kind: "in", amount: "333", method: "bank", date: "2026-10-20" }));
A.clock.set(NOW);
const ak = await must("akbank", api.post(`${BANK}/accounts?${q}`, { bankName: "Akbank", name: "İki TL", kind: "demand", opening: { date: "2026-10-01", amount: "7.777", confirmed: true } }));
const hb = await must("halk", api.post(`${BANK}/accounts?${q}`, { bankName: "Halkbank", name: "İki Ek", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } }));
for (let i = 0; i < 3; i++) await must("t2", api.post(`/api/workspace/accounts/${p2.id}/entries?${q}`, { kind: "in", amount: `${77 + i},5`, method: "bank", bankAccountId: i % 2 ? ak.id : hb.id, date: `2026-10-0${3 + i}`, similarOk: true }));
await must("tr2", api.post(`${BANK}/transfers?${q}`, { accountId: ak.id, toAccountId: hb.id, amount: "300", date: "2026-10-06", feeAmount: "3", feeTax: "bsmv_excl", feeType: "eft", similarOk: true }));

const QUERIES = co => {
  const acc = co === "001" ? [z.id, g.id] : [ak.id, hb.id];
  return [
    ["banka-bakiye", {}], ["banka-bakiye", { bankGroup: "all" }], ["banka-bakiye", { bankGroup: "unassigned", preset: "all" }], ["banka-bakiye", { bankGroup: "all", from: "2026-10-04", to: "2026-10-31" }],
    ["banka-hareket", {}], ["banka-hareket", { bankAccount: acc[0] }], ["banka-hareket", { bankAccount: acc[1], from: "2026-10-04", to: "2026-10-06" }], ["banka-hareket", { bankAccount: "unassigned", preset: "all" }], ["banka-hareket", { bankMove: "internal" }],
    ["banka-masraf", {}], ["banka-masraf", { feeAccount: acc[0] }],
    // başka şirketin hesabı → 404 beklenir
    ["banka-hareket", { bankAccount: (co === "001" ? ak : z).id }], ["banka-masraf", { feeAccount: (co === "001" ? ak : z).id }],
  ];
};
async function collect(api) {
  const out = {};
  for (const co of ["001", "002"]) {
    for (const [id, query] of QUERIES(co)) {
      const s = new URLSearchParams(query); if (co === "002") s.set("hofCompany", second.id);
      const key = `${co} ${id} ${new URLSearchParams(query)}`;
      const r = await api.get(`${RC}/${id}?${s}`);
      const x = await api.raw("GET", `${RC}/${id}/xlsx?${s}`);
      const pdf = await api.raw("GET", `${RC}/${id}/pdf?${s}`);
      out[key] = { status: r.status, code: r.code ?? null, error: r.error ?? null, data: r.status === 200 ? r.data : null, xlsx: x.status === 200 ? xlsxSheets(x.buffer) : x.status, pdf: pdf.status === 200 ? pdfText(pdf.buffer).replace(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/g, "<zaman>") : pdf.status };
    }
  }
  return out;
}
const w0 = workers;
const viaWorker = await collect(api);
const workerCount = workers - w0;
// iki şirketin audit kaydı (report.exported) worker yolunda
const auditOf = srv => srv.app.store.all("SELECT action, target, detail FROM audit_log WHERE action = 'report.exported' ORDER BY rowid").length;
let audit001 = null; try { audit001 = auditOf(A); } catch (e) { audit001 = String(e.message); }
await A.close();
const B = await startTestServer(opts(false));
const apiB = apiOf(await loginAdmin(B));
const w1 = workers;
const inline = await collect(apiB);
const inlineWorkers = workers - w1;
await B.close();
const diffs = [];
for (const key of Object.keys(viaWorker)) {
  try { assert.deepEqual(viaWorker[key], inline[key]); } catch (e) { diffs.push({ key, worker: JSON.stringify(viaWorker[key]).slice(0, 600), inline: JSON.stringify(inline[key]).slice(0, 600) }); }
}
const summary = Object.fromEntries(Object.entries(viaWorker).map(([k, v]) => [k, { status: v.status, code: v.code, total: v.data?.total, summary: v.data?.summary }]));
console.log(JSON.stringify({ workerCount, inlineWorkers, keys: Object.keys(viaWorker).length, diffs: diffs.length, audit001, diffsDetail: diffs, summary }, null, 1));
