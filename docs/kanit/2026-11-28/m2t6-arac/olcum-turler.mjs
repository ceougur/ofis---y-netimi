// m2t6 ölçüm (TARAMA): aynı Düzenle yolundan geçen öbür türler — kodlanmaz, yalnız ölçülür. Kullanım: node olcum-turler.mjs <kök>
// (1) Alış Faturası peşin > tutar kabul ediliyor mu (cari değişiminde eski cari düşebilir mi — M30'un eşdeğerliği);
// (2) Alıştan İade ve (3) Satış Düzenle'sinde peşin TAHSİLAT artışı Değersiz'li cariyi eksiye götürüyor mu (BM-M2T4-3: tahsilat artışı kabul — kapsam dışı).
const ROOT = process.argv[2];
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const server = await h.startTestServer({ now: "2026-10-15T12:00:00+03:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = o.apiOf(await h.loginAdmin(server));
await api.post("/api/workspace/bank/setup/dismiss", {});
let ph = 0;
const phone = () => `0500 8${String((ph += 1) % 100).padStart(2, "0")} 22 ${String(ph).padStart(2, "0")}`;
const pay = (amount, date, invoiceId) => ({ kind: "in", amount, date, method: "cash", cashForce: true, similarOk: true, note: "t", ...(invoiceId ? { invoiceId } : {}) });
const bal = async id => (await api.get(`${ACC}/${id}`)).data.totals.balance;
const ok = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${r.error}`); return r.data; };
const short = r => `${r.status}${r.code ? " " + r.code : ""}${r.status !== 200 ? " «" + String(r.error).slice(0, 120) + "…»" : ""}`;
async function base(name) {
  const a = await ok("cari", api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: phone() }));
  const inv = await ok("fatura", api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
  await ok("borç", api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
  await ok("bağlı", api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-17", inv.id)));
  const s = (await ok("şüpheli", api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }))).record.id;
  await ok("Değersiz", api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  return { a, inv, s };
}
const force = { cashForce: true, force: { cash: true, negative: true, similar: true, stock: true } };
const cashPay = list => ({ cash: list.map(amount => ({ amount, method: "cash" })), cheques: [], endorse: [], rest: "open" });
const out = [];
const log = (...x) => out.push(x.join(" "));
{
  const b = await base("Ö1 Peşin Büyük");
  const r = await api.post(INV, { scenario: "expense_purchase", accountId: b.a.id, number: "ALS-O1", issueDate: "2026-10-01", lines: [{ name: "Gider", qty: 1, unitPrice: "500", vatRate: 0, expense: "rent" }], payment: cashPay([800]), ...force });
  log("(1) Alış 500 + peşin 800 (peşin > tutar):", short(r), "bakiye", await bal(b.a.id));
}
{
  const b = await base("Ö2 Alıştan İade");
  const item = await ok("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "O2", name: "Ürün O2", unit: "Adet" }));
  const p = await ok("mal alışı", api.post(INV, { scenario: "goods_purchase", accountId: b.a.id, number: "ALS-O2", issueDate: "2026-09-10", lines: [{ itemId: item.id, qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open" }, ...force }));
  const full = (await api.get(`${INV}/${p.id}`)).data;
  const lineId = (full.lines || full.invoice?.lines || [])[0]?.id;
  const body = cash => ({ kind: "purchase_return", originalId: p.id, issueDate: "2026-09-10", lines: [{ originLineId: lineId, qty: 5 }], payment: cashPay(cash), ...force });
  const ret = await api.post(INV, body([]));
  log("(2a) Alış 1.000 + Alıştan İade 500 (peşinsiz):", short(ret), "bakiye", await bal(b.a.id));
  if (ret.status === 200) {
    await ok("avans", api.post(`${ACC}/${b.a.id}/entries`, pay("1000", "2026-10-05")));
    log("(2a) + avans 1.000 → bakiye", await bal(b.a.id));
    const r = await api.post(`${INV}/${ret.data.id}/edit`, body([500]));
    log("(2b) Alıştan İade Düzenle: peşin tahsilat 0 → 500 (bakiye −500):", short(r), "bakiye", await bal(b.a.id));
  }
}
{
  const b = await base("Ö3 Satış Peşin Artışı");
  const body = cash => ({ scenario: "service_sale", accountId: b.a.id, issueDate: "2026-10-01", lines: [{ name: "Hizmet", qty: 1, unitPrice: "500", vatRate: 0 }], payment: cashPay(cash), ...force });
  const s = await ok("satış 500", api.post(INV, body([])));
  await ok("avans", api.post(`${ACC}/${b.a.id}/entries`, pay("1500", "2026-10-05")));
  log("(3a) T + satış 500 + avans 1.500 → bakiye", await bal(b.a.id));
  const r = await api.post(`${INV}/${s.id}/edit`, body([500]));
  log("(3b) Satış Düzenle: peşin tahsilat 0 → 500 (bakiye −500):", short(r), "bakiye", await bal(b.a.id));
}
console.log(out.join("\n"));
server.close();
process.exit(0);
