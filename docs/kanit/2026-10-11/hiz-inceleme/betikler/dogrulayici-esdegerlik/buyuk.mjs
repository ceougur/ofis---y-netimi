// Bağımsız doğrulayıcı: bulgu 1 — bir hesaba API'den N × 1e12 TL havale girilince banka raporları.
// Kullanım: node buyuk.mjs <depo kökü> <N> <worker 0/1>
import path from "node:path";
const [root, nStr, w] = process.argv.slice(2);
const N = Number(nStr);
const { bootBank, openAccount, must } = await import(path.join(root, "test/banka-210-hesap-ortak.mjs"));
const ctx = await bootBank({ reportWorker: w === "1", gateVerify: false });
const api = ctx.api;
const out = { root, N, worker: w };
try {
  const abc = await must("cari", api.post("/api/workspace/accounts", { name: "Büyük Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const Z = await openAccount(api, { bankName: "Z", name: "Z", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  let ok = 0, fail = null;
  for (let i = 0; i < N; i++) {
    const r = await api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "1.000.000.000.000", method: "bank", bankAccountId: Z.id, date: "2026-10-02", similarOk: true });
    if (r.status === 200) ok++; else { fail = { i, status: r.status, code: r.code, error: r.error }; break; }
  }
  out.posted = ok; out.postFail = fail;
  const rows = ctx.db ? null : null;
  for (const id of ["banka-bakiye", "banka-hareket", "banka-masraf", "alt-hesap-mizani"]) {
    const r = await api.get(`/api/workspace/report-center/${id}?preset=all`);
    out[id] = { status: r.status, code: r.code, error: r.error, totals: JSON.stringify(r.data?.summary ?? r.data?.totals ?? r.data?.footer ?? "").slice(0, 300) };
  }
  for (const q of ["from=2026-10-03&to=2026-10-08", "preset=thisMonth", `preset=all&bankAccount=${Z.id}`, `from=2026-10-03&to=2026-10-08&bankAccount=${Z.id}`]) {
    const r = await api.get(`/api/workspace/report-center/banka-hareket?${q}`);
    out["banka-hareket?" + q.slice(0, 40)] = { status: r.status, error: r.error, totals: JSON.stringify(r.data?.summary ?? "").slice(0, 200) };
  }
  for (const q of ["from=2026-10-03&to=2026-10-08", "bankGroup=real&preset=all"]) {
    const r = await api.get(`/api/workspace/report-center/banka-bakiye?${q}`);
    out["banka-bakiye?" + q] = { status: r.status, error: r.error };
  }
  for (const p of ["/api/workspace/bank/summary", "/api/workspace/overview", `/api/workspace/bank/accounts/${Z.id}`]) {
    const r = await api.get(p);
    out[p] = { status: r.status, code: r.code, error: r.error };
  }
} catch (e) { out.err = String(e?.stack || e).slice(0, 600); }
finally { await ctx.server.close(); }
console.log(JSON.stringify(out, null, 1));
process.exit(0);
