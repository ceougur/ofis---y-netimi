// Ölçüm (2.0.22 madde 1/2): fatura ödeme durumu — toplu yol (liste) = fatura kartı yolu, gerçek denetim verisinde.
// Kullanım: SP=<çalışma klasörü (canli/ içinde)> node olcum-esdeger.mjs
import fs from "node:fs"; import path from "node:path";
import { PASS, staff, startServer } from "./ortak.mjs";
const ROOT = path.join(process.env.SP, "canli"); const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const app = startServer(ROOT, { fresh: false }); const { port } = await app.listen(0, "127.0.0.1");
for (const code of ["001", "002"]) {
  const a = staff(`http://127.0.0.1:${port}`, state.companies[code]); await a.login("admin", PASS);
  let t = performance.now(); const list = (await a.get("/api/workspace/invoices?tab=all&limit=100000")).data; const first = performance.now() - t;
  t = performance.now(); await a.get("/api/workspace/invoices?tab=sale&pay=overdue&limit=1"); const cached = performance.now() - t;
  const docs = list.invoices.filter(d => d.status === "issued");
  let same = 0; const diff = [];
  for (const d of docs) {
    const one = (await a.get(`/api/workspace/invoices/${d.id}`)).data;
    const k = x => JSON.stringify([x.payState, x.paid, x.open, (x.closers || []).map(c => [c.mode, c.amount, c.date])]);
    if (k(d) === k(one)) same++; else if (diff.length < 5) diff.push({ no: d.displayNo, liste: k(d), kart: k(one) });
  }
  console.log(`${code}: ${docs.length} fatura; liste (toplu) = kart (cari başına): ${same}/${docs.length}; ilk liste ${Math.round(first)} ms, önbellekli rozet ${Math.round(cached)} ms`);
  for (const x of diff) console.log("  FARK", JSON.stringify(x));
}
await app.close();
