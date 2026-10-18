// Veri klasörünü açar, programın raporlarını JSON olarak döker. Kullanım: node oku.mjs <veri> <çıktı.json> [now] [url ...]
import { writeFileSync } from "node:fs";
import { boot } from "./ortak.mjs";

const [dataDir, out, now = "2026-09-30T17:00:00+03:00", ...urls] = process.argv.slice(2);
const { server, call } = await boot({ dataDir, now });
const result = {};
try {
  const list = urls.length ? urls : ["/api/workspace/ledger", "/api/workspace/ledger?from=2026-09-01&to=2026-09-30", "/api/workspace/ledger/integrity", "/api/workspace/report-center", "/api/workspace/accounts?status=all&limit=500", "/api/workspace/stock", "/api/workspace/cash?method=all", "/api/workspace/bank/accounts?status=all", "/api/workspace/bank/sub-trial", "/api/workspace/cheques?limit=500", "/api/workspace/doubtful?status=all", "/api/workspace/plans?status=all", "/api/workspace/invoices?tab=all&limit=500"];
  for (const url of list) result[url] = await call(url, "GET", url);
} finally {
  writeFileSync(out, JSON.stringify(result, null, 1));
  await server.app.close();
}
