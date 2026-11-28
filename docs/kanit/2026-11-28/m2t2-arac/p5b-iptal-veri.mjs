// DK-M2 P5b: G1 (Değersiz 3.000 @17.09 S264 → fatura iptali) v2.5.0 kodunda üretilir, yeni kod aynı veriyi açar: hangi denetim, hangi ileti; carinin sonraki işlemleri.
import { pathToFileURL } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
const ROOT = process.env.ROOT, VERI = process.env.VERI;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { startTestServer, loginAdmin } = await imp("test/helpers.mjs");
const { apiOf } = await imp("test/banka-210-ortak.mjs");
const TODAY = "2026-10-15", ACC = "/api/workspace/accounts";
const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, dataDir: path.join(VERI, "data"), backupDir: path.join(VERI, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = apiOf(await loginAdmin(server));
const show = (label, r) => console.log(label, "→", r.status, r.code || "", String(r.error || "").slice(0, 380));
if (process.env.MODE === "uret") {
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const a = (await api.post(ACC, { name: "DK G1 Müşteri", type: "customer", registeredOn: "2026-09-01", phone: "0500 555 09 09" })).data;
  const inv = (await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } })).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" });
  await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id });
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  show("Değersiz 3000", await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  show("fatura iptali", await api.post(`/api/workspace/invoices/${inv.id}/cancel`, { reason: "Hatalı" }));
  console.log("bakiye", (await api.get(`${ACC}/${a.id}`)).data.totals.balance);
  writeFileSync(path.join(VERI, "ids.json"), JSON.stringify({ party: a.id, did: s }));
} else {
  const { party, did } = JSON.parse(readFileSync(path.join(VERI, "ids.json"), "utf8"));
  const integ = (await api.get("/api/workspace/ledger/integrity")).data;
  console.log("yeni kod Mutabakat", integ.ok, JSON.stringify((integ.failures || []).map(f => [f.code, f.sample])).slice(0, 900));
  show("Borç Yaz 10 (aynı cari)", await api.post(`${ACC}/${party}/entries`, { kind: "debt", amount: "10", date: TODAY, note: "Sonraki" }));
  const integ2 = (await api.get("/api/workspace/ledger/integrity")).data;
  console.log("sonra Mutabakat", integ2.ok, JSON.stringify((integ2.failures || []).map(f => [f.code, f.sample])).slice(0, 900));
  const r = (await api.get(`${ACC}/${party}/doubtful`)).data.records[0];
  show("Değersiz satırını sil", await api.del(`${ACC}/${party}/doubtful/${did}/write-offs/${r.writeOffs[0].entryId}`));
  const integ3 = (await api.get("/api/workspace/ledger/integrity")).data;
  console.log("silme sonrası Mutabakat", integ3.ok, "bakiye", (await api.get(`${ACC}/${party}`)).data.totals.balance);
}
server.close();
