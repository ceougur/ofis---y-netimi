// İş 2 ÖZEL DİKKAT (S127 = A): v2.4.9 verisindeki eski kurala bağlı Excel kartı kural farkında nasıl görünür, fiş onu çift düzeltir mi. ROOT=<kod>.
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const { CURRENT, bootVersion } = await import(pathToFileURL(path.join(ROOT, "test/guvenilirlik/surumler.mjs")).href);
const { readFixture, unpackFixture } = await import(pathToFileURL(path.join(ROOT, "test/guvenilirlik/fikstur.mjs")).href);
const { oldRulePinnedPlans } = await import(pathToFileURL(path.join(ROOT, "server/lib/ledger-opening.mjs")).href);
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const FIX = "surum-2.4.9-s127";
const meta = readFixture(FIX);
const fixture = unpackFixture(FIX);
const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${String(meta.now).slice(0, 10)}T12:00:00+03:00`, fixed: true }, integrityScan: false });
const out = {};
try {
  const app = server.app;
  await app.ledger.snapshots.runPending();
  const api = await server.login();
  const pinned = oldRulePinnedPlans(app.store);
  out.eskiKuralaBagli = [...(pinned?.keys?.() || pinned || [])];
  out.kartlar = app.store.all("SELECT id, total, registered_on AS kayit, substr(created_at,1,10) AS yukleme, covers_balance AS mb FROM plans WHERE deleted_at IS NULL AND import_id <> '' ORDER BY rowid");
  const view = (await api.get("/api/admin/ledger/rule-diff-correction")).data;
  out.kaynaklar = view.sources.map(item => `${item.date} ${item.source} [${item.id.slice(0, 18)}] ${item.deltas.map(d => `${d.year}:${d.account} ${d.minor / 100}`).join(" · ")}`);
  out.fis = view.lines.map(l => `${l.debit ? "B" : "A"} ${l.account} ${(l.debit || l.credit) / 100}`);
  const post = await api.post("/api/admin/ledger/rule-diff-correction", { requestId: "c5a2b-s127-0000000001", digest: view.digest, confirm: true });
  out.kaydet = post.status;
  const sum = (entries, filter) => { const m = {}; for (const e of entries) for (const l of e.lines) if (filter(l.account)) m[l.account] = (m[l.account] || 0) + (l.debit - l.credit) / 100; return m; };
  const live = app.ledger.build().filter(e => !String(e.id).startsWith("voucher"));
  const karma = app.ledger.book({});
  out.bakiyeler = { karma: sum(karma, a => /^(1|2|3|4|5)/.test(a)), bastan: sum(live, a => /^(1|2|3|4|5)/.test(a)), karma6: sum(karma, a => /^6/.test(a)), bastan6: sum(live, a => /^6/.test(a)) };
} catch (e) { out.HATA = String(e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 1));
await server.close();
fixture.cleanup();
