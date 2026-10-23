// Kâhin b3g (aday 18) yeniden üretimi: iki "Ali Veli" (100, 200) — t2'de E-posta kolonu eklenir + ilk Ali 110 olur. Onaysız ve onaylı yol ayrı.
// node b3g-yeniden.mjs [sürüm…]   (KOK = kod kökü; sürüm: CURRENT ya da v2.4.3)
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
const NB = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/r31e-f/tmp";
const { CURRENT, bootVersion } = await import(`${process.env.KOK}/test/guvenilirlik/surumler.mjs`);
const { createClock } = await import(`${process.env.KOK}/server/lib/clock.mjs`);
const T1 = [["Müşteri", "Telefon", "Tutar"], ["Nur Ak", "", "700"], ["Oya Er", "", "800"], ["Ali Veli", "", "100"], ["Ali Veli", "", "200"], ["Can Su", "0532 111 11 11", "300"], ["Deniz Ay", "", "400"], ["Ece Naz", "", "500"]];
const T2 = [["Müşteri", "E-posta", "Telefon", "Tutar"], ["Nur Ak", "", "", "750"], ["Oya Er", "", "", "800"], ["Ali Veli", "", "", "110"], ["Ali Veli", "", "", "200"], ["Can Su", "", "0532 111 11 11", "300"], ["Deniz Ay", "", "", "400"], ["Ece Naz", "", "", "500"]];
const T2b = [["Müşteri", "Telefon", "Tutar"], ["Nur Ak", "", "750"], ["Oya Er", "", "800"], ["Ali Veli", "", "110"], ["Ali Veli", "", "200"], ["Can Su", "0532 111 11 11", "300"], ["Deniz Ay", "", "400"], ["Ece Naz", "", "500"]];
const RANGE = "from=2000-01-01&to=2099-12-31";
const out = {};
for (const [label, next] of [["kolon-eklenir+Ali110", T2], ["kolonsuz+Ali110", T2b]]) {
  for (const confirm of [false, true]) {
    const root = mkdtempSync(path.join(NB, "b3g-"));
    const server = await bootVersion(process.argv[2] || CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: createClock({ time: new Date(2026, 5, 17, 10), fixed: true }) });
    try {
      const api = await server.login();
      await api.post("/api/workspace/bank/setup/dismiss", {});
      const load = async (m, mode, extra = {}) => { const s = await api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "b3g.xlsx", sheets: [{ name: "Aidat", matrix: m }] }); return api.post("/api/workspace/dataset/commit", { stageId: s.data.stageId, mode, ...extra }); };
      await load(T1, "replace");
      const store = server.app.store;
      const rows = store.all("SELECT case_key AS k, values_json AS v FROM dataset_rows ORDER BY position").map(r => ({ k: r.k, v: JSON.parse(r.v) }));
      const amounts = [50, 60, 10, 20, 30, 40];
      for (let i = 0; i < 6; i += 1) await api.post(`/api/workspace/cases/${encodeURIComponent(rows[i].k)}/payments`, { amount: String(amounts[i]), date: "2026-06-10", method: "cash" });
      const first = await load(next, "replace");
      const r = { onaysiz: [first.status, first.data?.code ?? null, first.data?.error?.slice(0, 120) ?? null] };
      if (first.status === 409 && confirm) { const c = await load(next, "replace", { confirm: true }); r.onayli = c.status; }
      const ce = await api.get(`/api/workspace/reports/cari-ekstre?${RANGE}`);
      r.aliAlacak = (ce.data?.report?.groups || []).filter(g => g.cari === "Ali Veli").map(g => g.credit);
      const now = store.all("SELECT case_key AS k, values_json AS v FROM dataset_rows ORDER BY position").map(x => ({ k: x.k, v: JSON.parse(x.v) }));
      r.tahsilatNerede = store.all("SELECT case_key AS k, amount FROM payments ORDER BY amount").map(p => `${p.amount}:${now.find(x => x.k === p.k) ? `${now.find(x => x.k === p.k).v["Müşteri"]} ${now.find(x => x.k === p.k).v.Tutar}` : "YOK"}`);
      out[`${label}${confirm ? " (onaylı)" : " (onaysız)"}`] = r;
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  }
}
console.log(JSON.stringify(out, null, 1));
