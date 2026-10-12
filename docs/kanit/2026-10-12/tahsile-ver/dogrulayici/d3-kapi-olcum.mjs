// Bağımsız doğrulayıcı (tur 1) — Bankaya Tahsile Ver yazımlarının kapı maliyeti (üretim yolu: gateVerify kapalı).
// integrity-scope.mjs FULL_TABLES cheque_collections içeriyor → tahsile ver / geri al / tahsildeki evrakın tahsili ve karşılıksızı TAM kapıdan
// geçer. Bu betik aynı veride, sırayı karıştırarak (iç içe) süre ölçer: dokunulan-varlık kapısıyla giden yazımlar ↔ tahsil kaydı yazımları.
// Veri: programın kendi API'sinden N Kasa nakit girişi (varsayılan 20.000) + 200 çek. Kullanım: node d3-kapi-olcum.mjs [N]
import { performance } from "node:perf_hooks";
import { apiOf } from "../../../../../test/banka-210-ortak.mjs";
import { loginAdmin, startTestServer } from "../../../../../test/helpers.mjs";

const N = Number(process.argv[2] || 20000);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const server = await startTestServer({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, gateVerify: false });
const api = apiOf(await loginAdmin(server));
try {
  const bank = await must("hesap", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-01-01", amount: "100.000", confirmed: true } }));
  const buyer = await must("cari", api.post("/api/workspace/accounts", { name: "Ölçüm Müşteri", type: "customer", registeredOn: "2026-01-01" }));
  const t0 = performance.now();
  const day = i => `2026-${String(1 + (i % 9)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`;
  for (let i = 0; i < N; i += 16) {
    await Promise.all(Array.from({ length: Math.min(16, N - i) }, (_, k) => must("kasa", api.post("/api/workspace/cash", { kind: "in", amount: String(10 + ((i + k) % 90)), date: day(i + k), description: `Ölçüm ${i + k}` }))));
  }
  const cheques = [];
  for (let i = 0; i < 60; i += 1) cheques.push(await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-01", dueDate: "2026-11-01", accountId: buyer.id, serialNo: `OL-${i}` })));
  console.log(`[d3] veri: ${N} Kasa girişi + 60 çek, ${Math.round((performance.now() - t0) / 1000)} sn`);
  const times = { cariNakitTahsilat: [], cekNormalTahsil: [], tahsileVer: [], bankadanGeriAl: [], tahsildekiTahsil: [] };
  const timed = async (key, label, promise) => {
    const start = performance.now();
    await must(label, promise);
    times[key].push(performance.now() - start);
  };
  for (let i = 0; i < 12; i += 1) {
    const a = cheques[i * 5];
    const b = cheques[i * 5 + 1];
    const c = cheques[i * 5 + 2];
    await timed("cariNakitTahsilat", "cari tahsilat", api.post(`/api/workspace/accounts/${buyer.id}/entries`, { kind: "in", amount: "5", date: "2026-10-08", method: "cash", note: `ölçüm ${i}` }));
    await timed("cekNormalTahsil", "normal tahsil", api.post(`/api/workspace/cheques/${a.id}/actions`, { action: "collect", date: "2026-10-08", method: "bank", bankAccountId: bank.id }));
    await timed("tahsileVer", "tahsile ver", api.post(`/api/workspace/cheques/${b.id}/actions`, { action: "bank-deposit", date: "2026-10-08", bankAccountId: bank.id }));
    await timed("bankadanGeriAl", "geri al", api.post(`/api/workspace/cheques/${b.id}/actions`, { action: "bank-withdraw", date: "2026-10-08" }));
    await must("tahsile ver c", api.post(`/api/workspace/cheques/${c.id}/actions`, { action: "bank-deposit", date: "2026-10-08", bankAccountId: bank.id }));
    await timed("tahsildekiTahsil", "tahsildeki tahsil", api.post(`/api/workspace/cheques/${c.id}/actions`, { action: "collect", date: "2026-10-08" }));
  }
  const median = list => {
    const s = [...list].sort((x, y) => x - y);
    return Math.round(s[Math.floor(s.length / 2)]);
  };
  const summary = Object.fromEntries(Object.entries(times).map(([key, list]) => [key, { n: list.length, medianMs: median(list), maxMs: Math.round(Math.max(...list)) }]));
  console.log(`[d3] süreler (ms, ${N} Kasa satırı): ${JSON.stringify(summary)}`);
  const integrity = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
  console.log(`[d3] mutabakat: ${integrity.ok}`);
} finally {
  await server.close();
}
