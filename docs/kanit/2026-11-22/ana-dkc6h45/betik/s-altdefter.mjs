// DK-C6H45 s-altdefter: alt defter farkı olan kurgu (KAPI DIŞI yazım — yalnız dalı sınamak için; ürün yolu değil): kasa fikstürü → fiş → kilitli 15.02.2026 Kasa çıkışı 300 → 400 (SQL).
// Bilanço / Gelir Tablosu (fişten sonra) + KALAN'ın gerçek alt defter kümesiyle ve BOŞ kümeyle (mutant) hesabı + Yönetim ön izlemesi.
// Kullanım: node s-altdefter.mjs <ROOT> <çıktı.json>
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const [root, out] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { loginAdmin, removeTestDir, startTestServer } = await imp("test/helpers.mjs");
const fin = await imp("server/lib/financial-statements.mjs");
const { frozenSums } = await imp("server/lib/ledger-snapshots.mjs");
const DIR = path.join(root, "test", "fixtures", "c6h-v249");
const OLD = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
const FS = "/api/workspace/financial-statements";
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const tmp = mkdtempSync(path.join(tmpdir(), "dkc6h45-altdefter-"));
const dataDir = path.join(tmp, "data");
mkdirSync(dataDir, { recursive: true });
writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, "kasa-kilitli.sqlite.gz"))));
copyFileSync(path.join(DIR, "kasa-kilitli.sirketler.json"), path.join(dataDir, "sirketler.json"));
const server = await startTestServer({ dataDir, backupDir: path.join(tmp, "backups"), now: { time: OLD.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const R = {};
try {
  await server.app.ledger.snapshots.runPending();
  const client = await loginAdmin(server);
  const get = async url => unwrap(await client.get(url));
  const v0 = await get("/api/admin/ledger/rule-diff-correction");
  const p = await client.post("/api/admin/ledger/rule-diff-correction", { requestId: "dkc6h45-altdefter-000000001", digest: v0.digest, confirm: true });
  R.post = p.status;
  server.app.db.prepare("UPDATE cash_entries SET amount = 400 WHERE date = '2026-02-15'").run();
  const view = await get("/api/admin/ledger/rule-diff-correction");
  R.view = { code: view.code, lines: view.lines, excluded: view.excluded };
  const pickReason = o => ({ kural: o.kesinDegil?.find(r => r.kod === "kural-farki")?.ayrinti ?? null, bilgi: o.bilgi ?? null, fark: o.toplamlar?.farkMinor, full: JSON.stringify(o) });
  R.bsNow = pickReason(await get(`${FS}/balance-sheet?date=2026-10-20`));
  R.bs0801 = pickReason(await get(`${FS}/balance-sheet?date=2026-08-01`));
  R.gt26 = pickReason(await get(`${FS}/income-statement?from=2026-01-01&to=2026-10-20`));
  R.gt26b = pickReason(await get(`${FS}/income-statement?from=2026-07-01&to=2026-10-20`));
  if (typeof fin.ruleDiffRemainder === "function") {
    const store = server.app.store;
    const ledger = server.app.ledger;
    const st = ledger.snapshots.state();
    const live = ledger.build();
    const diff = fin.periodRuleDiff({ frozen: [], frozenSums: fin.frozenPartOf(frozenSums(store, { from: "", through: st.coverage })), live, from: "", to: st.coverage, accounts: () => true, party: true });
    const posted = fin.postedCorrectionsAt(store, "2026-10-20");
    const real = new Set(Object.keys(ledger.expected([], [], { every: true })));
    R.subledger = [...real];
    R.remainderReal = fin.ruleDiffRemainder({ diff, posted, subledger: real, lock: st.lock, cover: st.coverage });
    R.remainderEmpty = fin.ruleDiffRemainder({ diff, posted, subledger: new Set(), lock: st.lock, cover: st.coverage });
  }
} catch (e) {
  R.error = String(e?.stack || e).slice(0, 1200);
} finally {
  await server.close();
  removeTestDir(tmp);
}
writeFileSync(out, JSON.stringify(R, null, 1));
console.log("yazıldı", out);
