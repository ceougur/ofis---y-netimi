// DK-M2 P6: şüpheli kayıt listesinin (cari kartı açılışında okunur) süresi — faturaya bağlı tahsilatı çok günlü carıde (aday günler = bağlı satır günleri × açık kayıt).
// ROOT=<kod> FATURA=300 KAYIT=3 node p6-liste-hiz.mjs
import { pathToFileURL } from "node:url";
import path from "node:path";
const ROOT = process.env.ROOT;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { startTestServer, loginAdmin } = await imp("test/helpers.mjs");
const { apiOf } = await imp("test/banka-210-ortak.mjs");
const TODAY = "2026-10-15";
const ACC = "/api/workspace/accounts";
const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = apiOf(await loginAdmin(server));
await api.post("/api/workspace/bank/setup/dismiss", {});
const N = Number(process.env.FATURA || 300), K = Number(process.env.KAYIT || 3);
const a = (await api.post(ACC, { name: "DK P6 Müşteri", type: "customer", registeredOn: "2026-01-01", phone: "0500 666 66 66" })).data;
const day = i => new Date(Date.parse("2026-01-05T00:00:00Z") + Math.floor(i * (280 / N)) * 86400000).toISOString().slice(0, 10);
await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: String(K * 6000), date: "2026-01-02", note: "Açılış borcu" });
const recs = [];
for (let k = 0; k < K; k += 1) { const r = await api.post(`${ACC}/${a.id}/doubtful`, { amount: "5000", date: "2026-01-03", reason: "lawsuit" }); if (r.status !== 200) console.log("take", r.status, r.error); recs.push(r.data?.record?.id); }
let t0 = Date.now();
for (let i = 0; i < N; i += 1) {
  const inv = (await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: day(i), lines: [{ name: "Hizmet", qty: 1, unitPrice: "1000", vatRate: 0 }], payment: { rest: "open" } })).data;
  const r = await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "999", date: day(i), method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id });
  if (r.status !== 200 && i < 3) console.log("tahsilat", r.status, r.code, r.error);
}
console.log("kurulum sn", ((Date.now() - t0) / 1000).toFixed(1));
const time = async (label, fn, n = 5) => { const xs = []; let out; for (let i = 0; i < n; i += 1) { const t = process.hrtime.bigint(); out = await fn(); xs.push(Number(process.hrtime.bigint() - t) / 1e6); } xs.sort((x, y) => x - y); console.log(label, "ms medyan", xs[Math.floor(n / 2)].toFixed(1), "en az", xs[0].toFixed(1), "en çok", xs[n - 1].toFixed(1)); return out; };
const list = await time("liste (GET doubtful)", () => api.get(`${ACC}/${a.id}/doubtful`));
console.log("liste durum", list.status, "kayıt", list.data?.records?.length, "writeOff", JSON.stringify(list.data?.records?.[0]?.writeOff || null).slice(0, 200));
await time("cari kartı (GET account)", () => api.get(`${ACC}/${a.id}`));
if (list.data?.records?.[0]?.writeOff !== undefined) await time("form ucu (GET write-off)", () => api.get(`${ACC}/${a.id}/doubtful/${recs[0]}/write-off?date=2026-03-01`));
const t = process.hrtime.bigint();
const w = await api.post(`${ACC}/${a.id}/doubtful/${recs[0]}/write-off`, { amount: "100", date: "2026-03-01" });
console.log("Değersiz Yaz ms", (Number(process.hrtime.bigint() - t) / 1e6).toFixed(1), w.status, w.code || "");
const t2 = process.hrtime.bigint();
const c = await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "1", date: TODAY, method: "cash", cashForce: true, similarOk: true, note: "Bağsız" });
console.log("bağsız tahsilat (kapı) ms", (Number(process.hrtime.bigint() - t2) / 1e6).toFixed(1), c.status, c.code || "");
console.log("loadavg", (await import("node:fs")).readFileSync("/proc/loadavg", "utf8").trim());
server.close();
