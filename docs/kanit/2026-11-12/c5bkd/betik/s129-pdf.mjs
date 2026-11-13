// S129 — ekstre / makbuz / liste PDF metinlerini ve rapor satırlarını döker (beklenti yazarken biçimi görmek için). Kullanım: ROOT=<kod> node s129-pdf.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";
import { boot, day } from "./k.mjs";
const { pdfText, xlsxRows } = await import(pathToFileURL(path.join(process.env.ROOT, "test/fixtures/rapor-dosya-oku.mjs")).href);
const h = await boot({ now: { time: "2026-10-20T12:00:00+03:00", fixed: false } });
try {
  const a = await h.account("S129 PDF");
  const plan = await h.cardOpen(a, 900, 3, { registeredOn: day(-40), firstDue: day(-10), coversBalance: false });
  await h.cardPay(plan.id, 300, day(-8));
  await h.entry(a, { kind: "in", amount: "200", date: day(-5) });
  const client = await (await import(pathToFileURL(path.join(process.env.ROOT, "test/helpers.mjs")).href)).loginAdmin(h.server);
  const raw = async url => (await client.raw("GET", url)).buffer;
  const p = (await h.api.get(`/api/workspace/plans/${plan.id}`)).data;
  console.log("== EKSTRE\n" + pdfText(await raw(`/api/workspace/plans/${plan.id}/ekstre.pdf`)));
  console.log("== MAKBUZ\n" + pdfText(await raw(`/api/workspace/plans/${plan.id}/entries/${p.entries[0].id}/makbuz.pdf`)));
  console.log("== LISTE\n" + pdfText(await raw(`/api/workspace/plans/liste.pdf?status=all`)));
  console.log("== XLSX\n" + JSON.stringify(xlsxRows(await raw("/api/workspace/accounts/export.xlsx?status=all")).slice(0, 3)));
  const rep = (await h.api.get("/api/workspace/report-center/taksit-kartlari?planStatus=all")).data;
  console.log("== RAPOR kartlar\n" + JSON.stringify({ headers: rep.headers, rows: rep.rows, summary: rep.summary }).slice(0, 900));
  const vade = (await h.api.get(`/api/workspace/report-center/taksit-vadeleri?from=${day(-60)}&to=${day(120)}`)).data;
  console.log("== RAPOR vade\n" + JSON.stringify({ headers: vade.headers, rows: vade.rows, summary: vade.summary }).slice(0, 900));
  const perf = (await h.api.get(`/api/workspace/report-center/taksit-performans?from=${day(-60)}&to=${day(120)}`)).data;
  console.log("== RAPOR performans\n" + JSON.stringify({ headers: perf.headers, rows: perf.rows, summary: perf.summary }).slice(0, 900));
} finally {
  await h.server.close();
}
