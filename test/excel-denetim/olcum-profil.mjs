// Ölçüm (2.0.22 madde 1/2): sunucu CPU profili (fatura rozeti / cari tahsilat / not düzeltme); kullanım: node olcum-profil.mjs tahsilat
// Kullanım: SP=<çalışma klasörü (canli/ içinde)> node olcum-profil.mjs
import fs from "node:fs"; import path from "node:path"; import inspector from "node:inspector/promises";
import { PASS, staff, startServer } from "./ortak.mjs";
const ROOT = path.join(process.env.SP, "canli"); const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const app = startServer(ROOT, { fresh: false }); const { port } = await app.listen(0, "127.0.0.1");
const a = staff(`http://127.0.0.1:${port}`, state.companies["001"]); await a.login("admin", PASS);
const acc = (await a.get("/api/workspace/accounts?limit=1")).data.accounts[0];
await a.get("/api/workspace/invoices?tab=sale&pay=overdue&limit=1");
const s = new inspector.Session(); s.connect(); await s.post("Profiler.enable"); await s.post("Profiler.setSamplingInterval", { interval: 200 }); await s.post("Profiler.start");
const which = process.argv[2];
const today = new Date().toISOString().slice(0, 10);
const ids = [];
for (let i = 0; i < 5; i++) {
  if (which === "fatura") await a.get("/api/workspace/invoices?tab=sale&pay=overdue&limit=1");
  else if (which === "tahsilat") ids.push((await a.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 1, date: today, method: "cash", note: "prof" })).data.entryId);
  else if (which === "durum") { const w = await a.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 1, date: today, method: "cash", note: "prof" }); ids.push(w.data.entryId); await a.get("/api/workspace/overview"); }
  else if (which === "vade") { const w = await a.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 1, date: today, method: "cash", note: "prof" }); ids.push(w.data.entryId); await a.get("/api/workspace/dues"); }
  else await a.put(`/api/workspace/accounts/${acc.id}`, { name: acc.name, type: acc.type, refNo: acc.refNo, note: `prof ${i}` });
}
const { profile } = await s.post("Profiler.stop");
const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
const dt = profile.timeDeltas; const counts = new Map(); profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
// toplam (alt çağrılar dahil) süre: her örnek yığınındaki her işleve eklenir
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const total = new Map();
for (const [id, us] of counts) { const seen = new Set(); let cur = id; while (cur) { const n = byId.get(cur); const k = `${n.callFrame.functionName || "(anon)"} ${path.basename(n.callFrame.url)}:${n.callFrame.lineNumber + 1}`; if (!seen.has(k)) { total.set(k, (total.get(k) || 0) + us); seen.add(k); } cur = parent.get(cur); } }
const sum = [...counts.values()].reduce((x, y) => x + y, 0);
console.log(`${which}: toplam ${Math.round(sum / 1000)} ms (5 istek)`);
for (const [k, us] of [...total].filter(([k]) => /server/.test(k) || /\.mjs/.test(k)).sort((x, y) => y[1] - x[1]).slice(0, 22)) console.log(`  ${String(Math.round(us / 1000)).padStart(6)} ms  ${k}`);
s.disconnect();
for (const id of ids) await a.del(`/api/workspace/accounts/${acc.id}/entries/${id}`);
await app.close();
