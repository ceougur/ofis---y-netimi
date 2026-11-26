// Hata ayıklama koşucusu: kos.mjs ile aynı koşu (aynı seçenekler); uyuşmazlıkta carinin kuyruğunu (önbellek + taze kurulum) ve defterini döker,
// veri klasörünü kopyalar; bütün yazma isteklerini (yöntem, adres, gövde, yanıt) ops.json'a yazar.
// Kullanım: ROOT=<kod kökü> OUT=<klasör> node dbg.mjs --islem 5000 --tohum 2
import { cpSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { loginAdmin, startTestServer } = await imp("test/helpers.mjs");
const { sigmaReader } = await imp("test/mutabakat/sigma.mjs");
const { motorNow, runReconciliation } = await imp("test/mutabakat/motor.mjs");
const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? Number(process.argv[i + 1]) : f; };
const operations = arg("islem", 5000), seed = arg("tohum", 1);
const OUT = process.env.OUT;
mkdirSync(OUT, { recursive: true });
const server = await startTestServer({ bankPickLegacy: true, now: motorNow() });
const ops = [];
let code = 0;
try {
  const admin = await loginAdmin(server);
  for (const m of ["post", "put", "del"]) {
    const f = admin[m];
    admin[m] = async (url, body) => {
      const r = await f(url, body);
      ops.push({ m, url, body, status: r.status, data: m === "del" ? undefined : r.data });
      return r;
    };
  }
  const started = performance.now();
  const report = await runReconciliation({ client: admin, seed, operations, verifyEvery: 1, burst: 60, pos: true, sigmaOf: sigmaReader(server), log: l => console.log(l) });
  console.log(`Tohum ${seed}: işlem ${report.operations}; uyuşmazlık ${report.mismatches.length}; ${((performance.now() - started) / 1000).toFixed(0)} sn`);
  for (const m of report.mismatches.slice(0, 5)) console.log(m.at, "\n  " + m.problems.join("\n  "));
  writeFileSync(path.join(OUT, "ops.json"), JSON.stringify(ops));
  if (report.mismatches.length) {
    code = 1;
    const ctx = server.app.context;
    const AUD = { id: "dbg", role: "admin", permissions: [] };
    const all = ctx.invoices.allObligations();
    const list = (await admin.get("/api/workspace/accounts?status=all&limit=500")).data;
    const accounts = (list.data ?? list).accounts;
    const dump = {};
    const sig = q => (q?.items || []).reduce((s, i) => s + (i.side === "receivable" ? 1 : -1) * Math.round(i.remaining * 100), 0);
    for (const m of report.mismatches) for (const p of m.problems) {
      const hit = /\(([^()]*)\): açık kalemlerin/.exec(p) || /^Cari .*\(([^()]+)\): program/.exec(p);
      if (!hit) continue;
      const a = accounts.find(x => x.refNo === hit[1]);
      if (!a || dump[a.id]) continue;
      const det = ctx.accounts.detail(a.id, AUD, { withRemaining: false });
      const fresh = ctx.invoices.obligationsFor(a.id, det.ledger || []);
      const cached = all?.get(a.id);
      dump[a.id] = { name: a.name, refNo: a.refNo, balance: a.balance, sigmaCached: sig(cached), sigmaFresh: sig(fresh), prepaid: fresh.prepaidPasses, items: fresh.items, cachedItems: cached?.items, entries: [...fresh.entries], installments: [...fresh.installments].map(([k, v]) => [k, [...v]]), invoices: [...fresh.invoices], doubtful: fresh.doubtful, ledger: det.ledger };
      console.log(`DÖKÜM ${a.name} ${a.refNo} kimlik ${a.id} bakiye ${a.balance} sigmaÖnbellek ${sig(cached)} sigmaTaze ${sig(fresh)} geçiş ${JSON.stringify(fresh.prepaidPasses)}`);
    }
    writeFileSync(path.join(OUT, "dump.json"), JSON.stringify(dump, null, 1));
    cpSync(server.dataDir, path.join(OUT, "data"), { recursive: true });
  }
} finally {
  await server.close();
}
process.exit(code);
