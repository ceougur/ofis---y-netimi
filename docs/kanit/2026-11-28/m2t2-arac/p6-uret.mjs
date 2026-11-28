// M2T2: p6 verisi (dar kontrol p6-liste-hiz.mjs'in kurulumu) — VERI klasörüne kalıcı; ROOT kodu (taban) API'siyle. FATURA=N gün, KAYIT=K, HEDEF=1 → kayıt 0'a bugünün tarihiyle 100 TL Değersiz.
import { pathToFileURL } from "node:url";
import path from "node:path";
import { writeFileSync } from "node:fs";
const ROOT = process.env.ROOT, VERI = process.env.VERI;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { startTestServer, loginAdmin } = await imp("test/helpers.mjs");
const { apiOf } = await imp("test/banka-210-ortak.mjs");
const TODAY = "2026-10-15", ACC = "/api/workspace/accounts";
const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, dataDir: path.join(VERI, "data"), backupDir: path.join(VERI, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = apiOf(await loginAdmin(server));
await api.post("/api/workspace/bank/setup/dismiss", {});
const N = Number(process.env.FATURA || 60), K = Number(process.env.KAYIT || 1);
const a = (await api.post(ACC, { name: "M2T2 P6 Müşteri", type: "customer", registeredOn: "2026-01-01", phone: "0500 666 66 61" })).data;
const day = i => new Date(Date.parse("2026-01-05T00:00:00Z") + Math.floor(i * (280 / Math.max(1, N))) * 86400000).toISOString().slice(0, 10);
await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: String(K * 6000), date: "2026-01-02", note: "Açılış borcu" });
const recs = [];
for (let k = 0; k < K; k += 1) { const r = await api.post(`${ACC}/${a.id}/doubtful`, { amount: "5000", date: "2026-01-03", reason: "lawsuit" }); if (r.status !== 200) console.log("take", r.status, r.error); recs.push(r.data?.record?.id); }
const t0 = Date.now();
for (let i = 0; i < N; i += 1) {
  const inv = (await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: day(i), lines: [{ name: "Hizmet", qty: 1, unitPrice: "1000", vatRate: 0 }], payment: { rest: "open" } })).data;
  const r = await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "999", date: day(i), method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id });
  if (r.status !== 200 && i < 3) console.log("tahsilat", r.status, r.code, r.error);
}
if (process.env.HEDEF === "1") { const w = await api.post(`${ACC}/${a.id}/doubtful/${recs[0]}/write-off`, { amount: "100", date: TODAY }); console.log("hedef Değersiz", w.status, w.code || ""); }
console.log("kurulum sn", ((Date.now() - t0) / 1000).toFixed(1), "N", N, "K", K);
writeFileSync(path.join(VERI, "ids.json"), JSON.stringify({ party: a.id, recs }));
server.close();
