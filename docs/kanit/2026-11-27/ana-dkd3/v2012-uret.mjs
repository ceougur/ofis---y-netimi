// v2.0.12 GERÇEK koduyla veri: iki cari + taksit kartı + tahsilat; birinci kart kapatılır (status closed; 2.0.12'de closed_at sütunu yok).
import { rmSync, cpSync, mkdirSync } from "node:fs";
const H = await import("/dev/shm/dk-d3-v2012/test/helpers.mjs");
const out = "/dev/shm/dk-d3-v2012-veri";
rmSync(out, { recursive: true, force: true });
const srv = await H.startTestServer({});
const c = srv.client();
const lg = await c.login("admin", H.ADMIN_PASSWORD);
if (lg.status !== 200) throw new Error("login " + lg.status);
const mk = async name => {
  const r = await c.post("/api/workspace/plans", { name, total: 1000, count: 2, firstDue: "2026-06-15", registeredOn: "2026-05-01" });
  if (r.status !== 200) throw new Error("plan " + r.status + JSON.stringify(r.data));
  return r.data.data;
};
const a = await mk("Kapali Kart Musterisi");
const b = await mk("Acik Kart Musterisi");
for (const p of [a, b]) {
  const e = await c.post(`/api/workspace/plans/${p.id}/entries`, { kind: "in", amount: 300, date: "2026-06-20" });
  if (e.status !== 200) throw new Error("entry " + e.status + JSON.stringify(e.data));
}
const cl = await c.put(`/api/workspace/plans/${a.id}`, { status: "closed" });
if (cl.status !== 200) throw new Error("close " + cl.status + JSON.stringify(cl.data));
console.log("kartlar", a.id, b.id, "kapali durum:", cl.data.data?.status, "cari", a.accountId, b.accountId);
await srv.app.close();
mkdirSync(out, { recursive: true });
cpSync(srv.dataDir, out + "/data", { recursive: true });
rmSync(srv.root, { recursive: true, force: true });
console.log("veri:", out + "/data");
