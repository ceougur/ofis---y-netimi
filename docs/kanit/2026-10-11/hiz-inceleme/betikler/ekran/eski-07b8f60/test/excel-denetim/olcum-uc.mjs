// Ölçüm (2.0.22 madde 1/2): boştaki uç süreleri ve cari notu düzeltme süresi (canlı denetim verisiyle).
// Kullanım: SP=<çalışma klasörü (canli/ içinde)> node olcum-uc.mjs
import fs from "node:fs"; import path from "node:path";
import { PASS, staff, startServer } from "./ortak.mjs";
const ROOT = path.join(process.env.SP, "canli"); const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const app = startServer(ROOT, { fresh: false }); const { port } = await app.listen(0, "127.0.0.1");
const a = staff(`http://127.0.0.1:${port}`, state.companies["001"]); await a.login("admin", PASS);
const urls = ["/api/workspace/overview", "/api/workspace/dues", "/api/workspace/plans?status=overdue", "/api/workspace/plans?status=overdue&count=1", "/api/workspace/cheques?status=open&limit=1", "/api/workspace/invoices?tab=sale&pay=overdue&limit=1", "/api/workspace/tasks?status=open&mine=1", "/api/workspace/liens?days=7", "/api/workspace/stock/alerts", "/api/workspace/accounts?q=&type=&group=&subgroup=&status=active&balance=all&sort=refNo&limit=200&offset=0", "/api/workspace/accounts?q=C0123&status=active&balance=all&sort=refNo&limit=200&offset=0", "/api/workspace/cash?period=all"];
const acc = (await a.get("/api/workspace/accounts?limit=1")).data.accounts[0];
for (const u of urls) { const ms = []; let kb = 0; for (let i = 0; i < 4; i++) { const t = performance.now(); const r = await a.raw("GET", u); ms.push(Math.round(performance.now() - t)); kb = Math.round(r.buffer.length / 1024); } console.log(`${String(ms.slice(1).sort((x,y)=>x-y)[1]).padStart(5)} ms  ${String(kb).padStart(6)} KB  ${u}`); }
const pm = []; for (let i = 0; i < 5; i++) { const t = performance.now(); await a.put(`/api/workspace/accounts/${acc.id}`, { name: acc.name, type: acc.type, refNo: acc.refNo, note: `ölçüm ${i}` }); pm.push(Math.round(performance.now() - t)); }
console.log("PUT cari not düzeltme (ms):", pm.join(" "));
await app.close();
