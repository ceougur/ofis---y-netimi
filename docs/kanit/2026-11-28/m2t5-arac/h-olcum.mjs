// M2T5 (dar kontrolün dk-m2t4/h-olcum.mjs'i AYNEN + GEREKLI=1: her caride aynı gün, Değersiz'den ÖNCE bağsız tahsilat 50 — taramanın gerçekten gereken sınıfı) — kaynak: DK-M2T4 H (dk-m2t3/h-olcum.mjs + SILME_ANI ortam değişkeni): değişmez (i) gevşemesinin Silinenler taraması (instr(payload_json)) — Değersiz satırlı cari sayısı × silinmiş fatura sayısı. node h-olcum.mjs <kök> <silinmiş fatura> <cari>
const ROOT = process.argv[2];
const TRASH = Number(process.argv[3] || 5000);
const CARI = Number(process.argv[4] || 10);
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const server = await h.startTestServer({ now: `2026-10-15T12:00:00+03:00`, gateVerify: process.env.KAPI_TAM !== "0", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = o.apiOf(await h.loginAdmin(server));
const store = server.app.store;
await api.post("/api/workspace/bank/setup/dismiss", {});
const pay = (amount, date, invoiceId) => ({ kind: "in", amount, date, method: "cash", cashForce: true, similarOk: true, note: "t", ...(invoiceId ? { invoiceId } : {}) });
const parties = [];
for (let c = 0; c < CARI; c += 1) {
  const a = (await api.post(ACC, { name: `H ${c}`, type: "customer", registeredOn: "2026-09-01", phone: `0500 66${c % 10} ${String(c).padStart(2, "0")} 01` })).data;
  const inv = (await api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } })).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" });
  await api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-17", inv.id));
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  if (process.env.GEREKLI === "1") await api.post(`${ACC}/${a.id}/entries`, pay("50", "2026-09-17"));
  const w = await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: process.env.GEREKLI === "1" ? "1000" : "3000", date: "2026-09-17" });
  if (w.status !== 200) throw new Error(`Değersiz ${w.status} ${w.error}`);
  parties.push(a.id);
}
const time = async (label, fn, n = 5) => {
  const xs = [];
  for (let i = 0; i < n; i += 1) { const t = performance.now(); await fn(); xs.push(performance.now() - t); }
  xs.sort((x, y) => x - y);
  return `${label} orta ${xs[Math.floor(n / 2)].toFixed(1)} ms`;
};
const measure = async () => [
  await time("Mutabakat", async () => { const r = await api.get("/api/workspace/ledger/integrity"); if (!r.data?.ok) throw new Error("kırmızı"); }),
  await time("tahsilat yazımı (kapı)", async () => { const r = await api.post(`${ACC}/${parties[0]}/entries`, pay("1", "2026-10-15")); if (r.status !== 200) throw new Error(r.error); }),
].join(" · ");
const before = await measure();
const pad = "x".repeat(3000);
store.db?.exec?.("BEGIN");
const ins = (store.db || server.app.db).prepare("INSERT INTO trash (id, kind, ref, payload_json, deleted_at) VALUES (?, 'invoice', ?, ?, ?)");
for (let i = 0; i < TRASH; i += 1) ins.run(`trash-h-${i}`, `invoice-h-${i}`, JSON.stringify({ accountId: `account-baska-${i}`, pad }), (process.env.SILME_ANI || "2026-08-01T10:00:00.000Z"));
store.db?.exec?.("COMMIT");
const after = await measure();
console.log(`kök ${ROOT.split("/").pop()} · ${CARI} Değersiz satırlı cari · Silinenler ${TRASH} fatura\n  önce:  ${before}\n  sonra: ${after}\n  yük ${(await import("node:fs")).readFileSync("/proc/loadavg", "utf8").trim()}`);
server.close();
process.exit(0);
