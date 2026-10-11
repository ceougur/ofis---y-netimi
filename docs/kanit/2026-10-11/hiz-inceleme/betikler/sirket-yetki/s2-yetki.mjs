// S2: yetki matrisi iş parçacığı yolunda (002 dahil): personel, muhasebe, muhasebe − bank.reports, personel + bank.reports, özel rol, 002'ye erişimsiz kullanıcı.
import { mkdtempSync } from "node:fs";
import path from "node:path";
const R = "/home/user/ofis---y-netimi/test/";
const { startTestServer, loginAdmin, createUser } = await import(R + "helpers.mjs");
const { apiOf } = await import(R + "banka-210-ortak.mjs");
const SCR = path.dirname(new URL(import.meta.url).pathname);
let workers = 0; process.on("worker", () => { workers += 1; });
const BANK = "/api/workspace/bank", RC = "/api/workspace/report-center";
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data ?? r.error).slice(0, 400)}`); return r.data; };
const res = {};
for (const rw of [true, false]) {
  const S = await startTestServer({ dataDir: mkdtempSync(path.join(SCR, "veri2-")), reportWorker: rw, now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, maxCompanies: 2 });
  const adminC = await loginAdmin(S); const api = apiOf(adminC);
  const co = (await must("002", api.post("/api/companies", { name: "Yetki İki", select: false })));
  const c2 = co.company || co; const q = `hofCompany=${encodeURIComponent(c2.id)}`;
  const ak = await must("ak", api.post(`${BANK}/accounts?${q}`, { bankName: "Akbank", name: "Y TL", kind: "demand", opening: { date: "2026-10-01", amount: "1.234", confirmed: true } }));
  const pas = await must("pas", api.post(`${BANK}/accounts?${q}`, { bankName: "Pasifbank", name: "Kapanan", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
  const passiveRes = await api.put(`${BANK}/accounts/${pas.id}?${q}`, { status: "passive" });
  const role = await api.post("/api/admin/roles", { name: "Rapor Okur", permissions: ["bank.reports"] });
  const users = {
    personel: { role: "personel" },
    muhasebe: { role: "muhasebe" },
    muhasebeEksi: { role: "muhasebe", grants: { remove: ["bank.reports"] } },
    personelArti: { role: "personel", grants: { add: ["bank.reports"] } },
    ozelRol: { role: role.data?.id || role.data?.key },
    muhasebe002siz: { role: "muhasebe", only001: true },
  };
  const out = { passiveRes: passiveRes.status, role: role.status };
  for (const [name, spec] of Object.entries(users)) {
    let client = await createUser(S, adminC, { username: `u${name}`.toLowerCase(), role: spec.role || "personel" });
    const id = (await adminC.get("/api/admin/users")).data.data.users?.find?.(u => u.username === `u${name}`.toLowerCase())?.id || (await adminC.get("/api/admin/users")).data.data.find?.(u => u.username === `u${name}`.toLowerCase())?.id;
    if (spec.grants) out[`${name}.grant`] = (await adminC.patch(`/api/admin/users/${id}`, { grants: spec.grants })).status;
    out[`${name}.access`] = (await adminC.put(`/api/companies/access/${id}`, { companies: spec.only001 ? ["sirket-001"] : ["sirket-001", c2.id] })).status;
    client = S.client(); await client.login(`u${name}`.toLowerCase(), "Personel-2026!"); const u = apiOf(client);
    for (const rep of ["banka-bakiye", "banka-hareket", "banka-masraf"]) {
      const r = await u.get(`${RC}/${rep}?${q}&bankGroup=all`);
      const x = await u.raw("GET", `${RC}/${rep}/xlsx?${q}`);
      out[`${name} ${rep}`] = `${r.status}/${x.status} ${r.code || ""} ${r.status === 200 ? JSON.stringify(r.data.rows.map(row => row.slice(1, 3))) : ""}`;
    }
  }
  out.adminBakiye = JSON.stringify((await api.get(`${RC}/banka-bakiye?${q}&bankGroup=all`)).data.rows.map(r => r.slice(1, 3)));
  res[rw ? "worker" : "inline"] = out;
  await S.close();
}
const diffs = Object.keys(res.worker).filter(k => res.worker[k] !== res.inline[k]);
console.log(JSON.stringify({ workers, diffs, res }, null, 1));
