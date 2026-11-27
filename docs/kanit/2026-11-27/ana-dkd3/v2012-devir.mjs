// v2.0.12 GERÇEK verisi (closed_at sütunu yokken kapatılmış kart) yeni kodla (ROOT) açılır; 05.01.2027 sahte saatle devir ön izlemesi (K = 31.12.2026).
import { cpSync, rmSync } from "node:fs";
const ROOT = process.env.ROOT;
const H = await import(`${ROOT}/test/helpers.mjs`);
const dataDir = "/dev/shm/dk-d3-v2012-kopya";
rmSync(dataDir, { recursive: true, force: true });
cpSync("/dev/shm/dk-d3-v2012-veri/data", dataDir, { recursive: true });
const srv = await H.startTestServer({ dataDir, now: { time: "2027-01-05T10:00:00+03:00", fixed: true } });
const c = await H.loginAdmin(srv);
const store = srv.app.store;
console.log("plans:", JSON.stringify(store.all("SELECT name, status, closed_at, close_rule, total FROM plans ORDER BY name")));
const accts = store.all("SELECT id, name FROM accounts ORDER BY name");
for (const a of accts) {
  const r = await c.get(`/api/workspace/accounts/${a.id}`);
  const d = r.data?.data || {};
  console.log("cari", a.name, "bakiye", JSON.stringify(d.balance ?? d.account?.balance ?? d.totals ?? null).slice(0, 200));
}
const integ = await c.get("/api/workspace/ledger/integrity");
console.log("mutabakat ok:", integ.data?.data?.ok);
const start = await c.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: "2026-12-31", option: "borc-alacak" });
if (start.status !== 200) throw new Error("preview " + start.status + JSON.stringify(start.data));
let job;
for (let i = 0; i < 600; i += 1) {
  job = (await c.get(`/api/admin/devir/preview/${start.data.data.id}`)).data.data;
  if (job.state !== "running") break;
  await new Promise(r => setTimeout(r, 50));
}
console.log("durum", job.state, job.error ? JSON.stringify(job.error).slice(0, 300) : "");
const plan = job.result?.plan;
if (plan) {
  for (const k of plan.newYear.kartlar) console.log("kart", k.kart, k.cari.slice(0, 16), k.durum, "toplam", k.toplamMinor, "odenen", k.odenenMinor, "kalan", k.kalanMinor);
  for (const row of plan.newYear.cariler) console.log("cari-satir", row.ad, "K bakiye", row.kBakiyeMinor, JSON.stringify(row.satirlar.map(s => [s.tur, s.yon, s.tutarMinor])));
  console.log("sayilar.taksitKarti", JSON.stringify(plan.sayilar.taksitKarti));
  console.log("sorunlar", JSON.stringify(plan.sorunlar));
  const raporText = JSON.stringify(job.result.rapor);
  for (const m of raporText.matchAll(/"[^"]*Taksit Kart[^"]*"(,"[^"]*"){0,2}/g)) console.log("rapor:", m[0].slice(0, 200));
  console.log("durdurur", JSON.stringify(job.result.onDenetim.durdurur.map(m => m.kod)));
}
await srv.close();
rmSync(dataDir, { recursive: true, force: true });
