// Yargıç 2.2.0 — p4: Kasa "Açılış …" kuralının (İz 1.3) gerilemesi.
//  (1) v2.1.0 (7c6405f, ayrı kopya) ile iki "Açılış …" girişi + sonraki hareketler (kilit YOK) → 2.2.0'da bu eski girişler düzeltilebiliyor mu?
//  (2) 2.2.0'da muhasebe (cash.manage, system.manage YOK) açıklaması "Açılış…" ile başlayan sıradan Kasa girişi girebiliyor mu (2.1.0'da girebiliyordu)?
//  (3) Yönetici ilk hareketten sonra "Açılış kampanyası hasılatı" girişi → 409 mu?
// Koşu: SP=<geçici klasör> node docs/kanit/2026-10-12/yargic-220/p4.mjs <eski-kod-klasörü>
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OLD_DIR = process.argv[2];
const NOW = "2026-10-08T12:00:00+03:00";
const ok = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data?.ok === true ? res.data.data : res.data;
};
const show = (label, res) => console.log(`${label}: ${res.status} ${JSON.stringify(res.data?.code || "")} ${String(res.data?.error || "").slice(0, 220)}`);
const trial = ledger => Object.fromEntries(ledger.trial.accounts.map(r => [r.code, r.balance]));

for (const which of ["v2.1.0", "2.2.0"]) {
  const root = mkdtempSync(path.join(process.env.SP || "/tmp", `yargic220-p4-${which}-`));
  const H = await import(pathToFileURL(which === "v2.1.0" ? path.join(OLD_DIR, "test", "helpers.mjs") : path.resolve("test/helpers.mjs")).href);
  const srv = await H.startTestServer({ dataDir: path.join(root, "data"), now: NOW });
  const api = await H.loginAdmin(srv);
  console.log(`\n===== ${which} =====`);
  const cash = body => api.post("/api/workspace/cash", { method: "cash", ...body });
  show("yönetici: 'Açılış bakiyesi' 5.000 (01.10)", await cash({ kind: "in", amount: "5.000", date: "2026-10-01", description: "Açılış bakiyesi" }));
  show("yönetici: 'Kırtasiye' çıkış 200 (02.10)", await cash({ kind: "out", amount: "200", date: "2026-10-02", description: "Kırtasiye" }));
  show("yönetici: 'Açılış kampanyası hasılatı' 1.000 (05.10, ilk hareketten sonra)", await cash({ kind: "in", amount: "1.000", date: "2026-10-05", description: "Açılış kampanyası hasılatı" }));
  const muh = await H.createUser(srv, api, { username: "y-muh", role: "muhasebe" });
  show("muhasebe: 'açılışta satılan ürün' 300 (06.10)", await muh.post("/api/workspace/cash", { method: "cash", kind: "in", amount: "300", date: "2026-10-06", description: "açılışta satılan ürün" }));
  show("muhasebe: 'Satış hasılatı' 300 (06.10)", await muh.post("/api/workspace/cash", { method: "cash", kind: "in", amount: "300", date: "2026-10-06", description: "Satış hasılatı" }));
  const list = await ok("kasa", api.get("/api/workspace/cash"));
  const rows = list.entries || list.rows || [];
  console.log("Kasa satırları:", JSON.stringify(rows.map(r => [r.date, r.kind, r.amount, r.description])));
  const tb = trial(await ok("mizan", api.get("/api/workspace/ledger")));
  console.log("mizan 100 / 500 / 649 / 770:", [tb["100"] ?? 0, tb["500"] ?? 0, tb["649"] ?? 0, tb["770"] ?? 0]);
  const integ = await ok("mutabakat", api.get("/api/workspace/ledger/integrity"));
  console.log("Mutabakat ok:", integ.ok, JSON.stringify((integ.failures || []).map(f => f.code)));
  await srv.app.close();
}

// ---------- (1) v2.1.0'da iki "Açılış" + sonraki hareket → 2.2.0'da düzeltme ----------
{
  const root = mkdtempSync(path.join(process.env.SP || "/tmp", "yargic220-p4-goc-"));
  const dataDir = path.join(root, "data");
  const OH = await import(pathToFileURL(path.join(OLD_DIR, "test", "helpers.mjs")).href);
  let srv = await OH.startTestServer({ dataDir, now: NOW });
  let api = await OH.loginAdmin(srv);
  console.log("\n===== v2.1.0 verisi → 2.2.0 =====");
  const cash = body => ok(body.description, api.post("/api/workspace/cash", { method: "cash", ...body }));
  await cash({ kind: "out", amount: "100", date: "2026-10-01", description: "Kırtasiye", cashForce: true });
  const a1 = await cash({ kind: "in", amount: "5.000", date: "2026-10-02", description: "Açılış bakiyesi (eski programdan)" });
  const a2 = await cash({ kind: "in", amount: "250", date: "2026-10-03", description: "Açılış farkı" });
  await srv.app.close();
  const NH = await import(pathToFileURL(path.resolve("test/helpers.mjs")).href);
  srv = await NH.startTestServer({ dataDir, now: NOW });
  api = await NH.loginAdmin(srv);
  const integ = await ok("mutabakat", api.get("/api/workspace/ledger/integrity"));
  console.log("2.2.0 açılışta Mutabakat ok:", integ.ok, JSON.stringify((integ.failures || []).map(f => f.code)));
  show("eski 1. 'Açılış' girişinin tutarını düzelt (5.000 → 5.100)", await api.put(`/api/workspace/cash/${a1.id}`, { kind: "in", amount: "5.100", date: "2026-10-02", description: "Açılış bakiyesi (eski programdan)", method: "cash" }));
  show("eski 2. 'Açılış' girişinin tutarını düzelt (250 → 260)", await api.put(`/api/workspace/cash/${a2.id}`, { kind: "in", amount: "260", date: "2026-10-03", description: "Açılış farkı", method: "cash" }));
  show("Kasa → Açılış Bakiyesi GET", await api.get("/api/workspace/cash/opening"));
  const op = await api.get("/api/workspace/cash/opening");
  console.log("açılış:", JSON.stringify(op.data?.data || op.data).slice(0, 300));
  await srv.app.close();
}
process.exit(0);
