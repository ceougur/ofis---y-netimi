// DK-M2T3 C: değişmez (i)'nin 'sonradan değişmiş' gevşemesi — eksiye götürmeyen iptal (satış / alıştan iade / Sil / taslak silme) Değersiz'den sonra: durum + Mutabakat. node c-gevseme.mjs <kök>
const ROOT = process.argv[2];
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const short = r => `${r.status}${r.code ? " " + r.code : ""}${r.status !== 200 ? " | " + String(r.error || JSON.stringify(r.data)).slice(0, 500) : ""}`;
let n = 0;
async function boot() {
  const server = await h.startTestServer({ now: `2026-10-15T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const api = o.apiOf(await h.loginAdmin(server));
  await api.post("/api/workspace/bank/setup/dismiss", {});
  return { server, api };
}
const integ = async api => { const r = await api.get("/api/workspace/ledger/integrity"); return r.data?.ok ? "ok" : `KIRMIZI ${JSON.stringify(r.data?.failures).slice(0, 600)}`; };
const bal = async (api, id) => (await api.get(`${ACC}/${id}`)).data?.totals?.balance;
const fq = async (api, a, s, d) => { const q = (await api.get(`${ACC}/${a}/doubtful/${s}/write-off?date=${d}`)).data; return `${d} sınır ${q.limitMinor} öneri ${q.offerMinor} ${q.why}`; };
async function cari(api, name) { n += 1; return (await api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: `0500 481 ${String(n).padStart(2, "0")} 01` })).data; }
const sale = (accountId, price, date = "2026-09-10") => ({ scenario: "service_sale", accountId, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(price), vatRate: 0 }], payment: { rest: "open" } });
const pay = (amount, date, invoiceId) => ({ kind: "in", amount, date, method: "cash", cashForce: true, similarOk: true, note: "t", ...(invoiceId ? { invoiceId } : {}) });

// C1: 20.09 bağlı tahsilat (kayıttan sonra), Değersiz 3.000 @20.09 (S264), sonra fatura iptali; ek borç 4.000 → iptalden sonra bakiye artı kalır.
{
  const { server, api } = await boot();
  const a = await cari(api, "C1 Artı İptal");
  const inv = (await api.post(INV, sale(a.id, 2900))).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "7400", date: "2026-09-12", note: "Borç" });
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  const p = await api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-20", inv.id));
  console.log(`C1 bağlı 20.09: ${short(p)} · form ${await fq(api, a.id, s, "2026-09-20")} · ${await fq(api, a.id, s, "2026-10-15")}`);
  const w = await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-20" });
  console.log(`C1 Değersiz 3.000 @20.09: ${short(w)} · bakiye ${await bal(api, a.id)} · Mutabakat ${await integ(api)}`);
  const c = await api.post(`${INV}/${inv.id}/cancel`, { reason: "x" });
  console.log(`C1 iptal: ${short(c)} · bakiye ${await bal(api, a.id)} · Mutabakat ${await integ(api)} · form ${await fq(api, a.id, s, "2026-10-15")}`);
  // Aynı tahsilatın Değersiz'den SONRA bağsız olarak girildiği eşdeğer sıra (S270 'sonradan gelen bağsız'):
  const b = await cari(api, "C1b Sonra Bağsız");
  await api.post(`${ACC}/${b.id}/entries`, { kind: "debt", amount: "7400", date: "2026-09-12", note: "Borç" });
  const s2 = (await api.post(`${ACC}/${b.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  const w2 = await api.post(`${ACC}/${b.id}/doubtful/${s2}/write-off`, { amount: "3000", date: "2026-09-20" });
  const p2 = await api.post(`${ACC}/${b.id}/entries`, pay("2876,45", "2026-09-20"));
  console.log(`C1b Değersiz 3.000 sonra bağsız 2.876,45 @20.09: ${short(w2)} / ${short(p2)} · bakiye ${await bal(api, b.id)} · Mutabakat ${await integ(api)}`);
  server.close();
}
// C2: alıştan iadeye bağlı tahsilat (iade alacağı), Değersiz'den sonra alıştan iadenin İPTALİ (eksiye götürmez).
{
  const { server, api } = await boot();
  const a = await cari(api, "C2 Alıştan İade İptal");
  const inv = (await api.post(INV, sale(a.id, 2900))).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "7400", date: "2026-09-12", note: "Borç" });
  const pu = await api.post(INV, { scenario: "expense_purchase", accountId: a.id, number: "AL-9", issueDate: "2026-09-11", lines: [{ name: "Gider", qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open" } });
  const pd = (await api.get(`${INV}/${pu.data.id}`)).data;
  const pr = await api.post(INV, { kind: "purchase_return", originalId: pu.data.id, accountId: a.id, issueDate: "2026-09-11", lines: [{ originLineId: (pd.lines || pd.invoice?.lines)[0].id, qty: 10 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true });
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  const p = await api.post(`${ACC}/${a.id}/entries`, pay("1000", "2026-09-20", pr.data.id));
  console.log(`C2 alıştan iade ${short(pr)} · iadeye bağlı tahsilat 1.000 @20.09: ${short(p)} · form ${await fq(api, a.id, s, "2026-09-20")}`);
  const q = (await api.get(`${ACC}/${a.id}/doubtful/${s}/write-off?date=2026-09-20`)).data;
  const w = await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: (q.offerMinor / 100).toFixed(2).replace(".", ","), date: "2026-09-20" });
  console.log(`C2 Değersiz ${q.offerMinor} @20.09: ${short(w)} · bakiye ${await bal(api, a.id)} · Mutabakat ${await integ(api)}`);
  const c = await api.post(`${INV}/${pr.data.id}/cancel`, { reason: "x" });
  console.log(`C2 alıştan iade iptali: ${short(c)} · bakiye ${await bal(api, a.id)} · Mutabakat ${await integ(api)}`);
  // C3 aynı cari: satış faturası iptali (eksiye götürmez) — karşılaştırma
  const c3 = await api.post(`${INV}/${inv.id}/cancel`, { reason: "x" });
  console.log(`C3 aynı caride satış iptali: ${short(c3)} · bakiye ${await bal(api, a.id)} · Mutabakat ${await integ(api)}`);
  server.close();
}
// C4: Değersiz'den sonra BAŞKA bir (taslak) faturanın silinmesi — gevşeme tetiklenir mi; sonra yeni bağsız tahsilat yok — Mutabakat.
{
  const { server, api } = await boot();
  const a = await cari(api, "C4 Taslak Sil");
  const inv = (await api.post(INV, sale(a.id, 2900))).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" });
  await api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-17", inv.id));
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  const w = await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" });
  const d = await api.post(INV, { status: "draft", ...sale(a.id, 50, "2026-10-01") });
  const del = await api.del(`${INV}/${d.data?.id}`);
  console.log(`C4 Değersiz ${short(w)} · taslak ${short(d)} sil ${short(del)} · bakiye ${await bal(api, a.id)} · Mutabakat ${await integ(api)}`);
  server.close();
}
process.exit(0);
