// Ölçüm (2.0.22 madde 1/2): her ucun bir kayıttan SONRAKİ ilk yanıt süresi (önbellek bozulmuşken) ve ikinci istek.
// Kullanım: SP=<çalışma klasörü (canli/ içinde)> node olcum-soguk.mjs
// Ölçüm (geçici): her ucun bir kayıttan SONRAKİ ilk yanıt süresi (önbellek bozulmuşken) ve hemen ardından ikinci istek.
import fs from "node:fs"; import path from "node:path";
import { PASS, staff, startServer } from "./ortak.mjs";
const ROOT = path.join(process.env.SP, "canli"); const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const app = startServer(ROOT, { fresh: false }); const { port } = await app.listen(0, "127.0.0.1");
const a = staff(`http://127.0.0.1:${port}`, state.companies["001"]); await a.login("admin", PASS);
const urls = ["/api/workspace/overview", "/api/workspace/dues", "/api/workspace/plans?status=overdue&count=1", "/api/workspace/cheques?status=open&limit=1", "/api/workspace/invoices?tab=sale&pay=overdue&limit=1", "/api/workspace/stock/alerts", "/api/workspace/accounts?q=&status=active&balance=all&sort=refNo&limit=300&offset=0", "/api/workspace/accounts?q=C0123&status=active&balance=all&sort=refNo&limit=300&offset=0", "/api/workspace/cash?period=all"];
const acc = (await a.get("/api/workspace/accounts?limit=1&q=C0001")).data.accounts[0];
const today = new Date().toISOString().slice(0, 10);
for (const u of urls) {
  const cold = [], warm = [];
  for (let i = 0; i < 3; i++) {
    const w = await a.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 1, date: today, method: "cash", note: "ölçüm" });
    let t = performance.now(); await a.raw("GET", u); cold.push(Math.round(performance.now() - t));
    t = performance.now(); await a.raw("GET", u); warm.push(Math.round(performance.now() - t));
    await a.del(`/api/workspace/accounts/${acc.id}/entries/${w.data.entryId}`);
  }
  console.log(`soğuk ${cold.join("/").padStart(14)} ms · sıcak ${warm.join("/").padStart(10)} ms  ${u}`);
}
const wt = []; for (let i = 0; i < 5; i++) { const t = performance.now(); const w = await a.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 1, date: today, method: "cash", note: "ölçüm" }); wt.push(Math.round(performance.now() - t)); await a.del(`/api/workspace/accounts/${acc.id}/entries/${w.data.entryId}`); }
console.log("cari tahsilat yazma (ms):", wt.join(" "));
await app.close();
