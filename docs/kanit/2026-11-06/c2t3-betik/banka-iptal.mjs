// Ç2 tur 3 — bank/repair.mjs:261 ölçüsü (yan bulgu 2): güncel sürümde N tahsilat → GERÇEK 2.0.26 kodu "Tüm Hareketleri Sil" (fin_events'i bilmez) → güncel sürüm açılışı:
// iptal edilen işlem başlığı N → Mutabakat Günlüğü "repair" kaydının ayrıntısı geçerli JSON mu, Mutabakat Testi HTTP kaç?
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node banka-iptal.mjs <güncel taraf kod kökü> <N>
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const [root, nArg] = process.argv.slice(2);
const n = Number(nArg || 600);
const WT = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a7280bb16b4491d5b";
const h = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const { bootVersion } = await import(pathToFileURL(path.join(WT, "test", "guvenilirlik", "surumler.mjs")).href);
const base = `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c2t3-calisma/banka-${path.basename(root)}-${n}`;
rmSync(base, { recursive: true, force: true });
mkdirSync(base, { recursive: true });
const dirs = { dataDir: `${base}/data`, backupDir: `${base}/backups` };
const open = async fn => {
  const server = await h.startTestServer({ now: { time: "2027-01-10T10:00:00+03:00", fixed: true }, ...dirs });
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
};
const t0 = performance.now();
await open(async server => {
  const admin = await h.loginAdmin(server);
  const acc = (await admin.post("/api/workspace/accounts", { name: "İptal Cari", type: "customer", registeredOn: "2026-12-01" })).data.data;
  for (let i = 0; i < n; i += 1) {
    const r = await admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: String(10 + i), date: "2027-01-05" });
    if (r.status !== 200) throw new Error(`tahsilat ${i}: ${r.status}`);
  }
  console.log(`üretim: ${n} tahsilat, etkin işlem başlığı ${server.app.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE status = 'active'").n}, ${Math.round(performance.now() - t0)} ms`);
});
{
  const old = await bootVersion("v2.0.26", dirs);
  try {
    const api = await old.login();
    const r = await api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: h.ADMIN_PASSWORD });
    console.log(`v2.0.26 Tüm Hareketleri Sil: HTTP ${r.status} ${r.status === 200 ? "" : JSON.stringify(r.data).slice(0, 200)}`);
  } finally {
    await old.close();
  }
}
const valid = text => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};
for (const turn of [1, 2]) {
  await open(async server => {
    const rows = server.app.store.all("SELECT summary, detail_json AS detail FROM integrity_log WHERE action = 'repair' AND tables = '' ORDER BY rowid");
    const last = rows.at(-1);
    const parsed = last && valid(last.detail) ? JSON.parse(last.detail) : null;
    const admin = await h.loginAdmin(server);
    const scan = await admin.get("/api/workspace/ledger/integrity");
    const report = await admin.get("/api/workspace/report-center/mutabakat-gunlugu");
    console.log(`açılış ${turn}: ${JSON.stringify({ onarimSatiri: rows.length, ozet: last?.summary?.slice(0, 90), uzunluk: last?.detail.length, gecerli: last ? valid(last.detail) : null, iptalListesi: parsed?.cancelledEvents?.length, counts: parsed?.counts, mutabakatTestiHTTP: scan.status, raporHTTP: report.status })}`);
  });
}
rmSync(base, { recursive: true, force: true });
