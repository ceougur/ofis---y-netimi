// M2 tur 5 TARAMA yoklaması: Değersiz'li caride (taban T, bakiye 423,55) bakiyeyi düşüren ve görev metninin dosya sınırı DIŞINDA kalan yollar bugün ne yapıyor?
// Her yol: önce bakiyeyi −76,45'e getiren avans, sonra yolun işlemi; yanıt kodu + bakiye + Mutabakat okunur (ders 3). node yollar.mjs <kök>
const ROOT = process.argv[2];
const h = await import(`${ROOT}/test/helpers.mjs`);
const o = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
const server = await h.startTestServer({ now: "2026-10-15T12:00:00+03:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = o.apiOf(await h.loginAdmin(server));
const store = server.app.store;
await api.post("/api/workspace/bank/setup/dismiss", {});
const pay = (amount, date, invoiceId) => ({ kind: "in", amount, date, method: "cash", cashForce: true, similarOk: true, note: "t", ...(invoiceId ? { invoiceId } : {}) });
const sale = (accountId, price, date = "2026-09-10") => ({ scenario: "service_sale", accountId, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(price), vatRate: 0 }], payment: { rest: "open" } });
const bal = async id => (await api.get(`${ACC}/${id}`)).data.totals.balance;
let n = 0;
async function base(name) {
  n += 1;
  const a = (await api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: `0500 77${n} 00 0${n}` })).data;
  const inv = (await api.post(INV, sale(a.id, 2900))).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" });
  await api.post(`${ACC}/${a.id}/entries`, pay("2876,45", "2026-09-17", inv.id));
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" });
  return a;
}
const report = async (label, a, before, r) => {
  const after = await bal(a.id);
  const integ = (await api.get("/api/workspace/ledger/integrity")).data;
  console.log(`${label}: yanıt ${r.status}${r.code ? ` ${r.code}` : ""} · bakiye ${before} → ${after} · Mutabakat ${integ.ok ? "tamam" : `KIRMIZI ${JSON.stringify((integ.failures || []).map(f => f.code || f)).slice(0, 160)}`}${r.status !== 200 ? ` · ileti ${String(r.error).slice(0, 160)}` : ""}`);
};
// 1) stok satışı (açık hesap, cariye Borç) — silme
{
  const a = await base("Yol Stok");
  const item = (await api.post("/api/workspace/stock", { kind: "goods", code: "Y1", name: "Ürün", unit: "Adet", openingQty: "10" })).data;
  const mv = await api.post(`/api/workspace/stock/${item.id ?? item.data?.id}/moves`, { kind: "out", qty: "1", unitPrice: "500", pay: "account", accountId: a.id, date: "2026-10-01" });
  await api.post(`${ACC}/${a.id}/entries`, pay("1000", "2026-10-05"));
  const before = await bal(a.id);
  const moveId = store.get("SELECT source_id AS id FROM account_entries WHERE account_id = ? AND source = 'stock'", a.id)?.id;
  const r = await api.del(`/api/workspace/stock/${item.id ?? item.data?.id}/moves/${moveId}?cashForce=1`);
  await report(`stok satışı silme (hareket ${mv.status})`, a, before, r);
}
// 2) verilen senet (cariye Ödeme gibi) — silme
{
  const a = await base("Yol Senet");
  const ch = await api.post("/api/workspace/cheques", { direction: "out", instrument: "note", amount: "500", issueDate: "2026-10-01", dueDate: "2026-12-31", accountId: a.id, drawer: "Biz" });
  await api.post(`${ACC}/${a.id}/entries`, pay("1000", "2026-10-05"));
  const before = await bal(a.id);
  const r = await api.del(`/api/workspace/cheques/${ch.data?.id ?? ch.data?.cheque?.id}`);
  await report(`verilen senet silme (giriş ${ch.status}${ch.status !== 200 ? ` ${String(ch.error).slice(0, 80)}` : ""})`, a, before, r);
}
// 3) alış faturası (cariye Alacak) — Düzenle ile tutar artırma
{
  const a = await base("Yol Alış");
  const body = price => ({ scenario: "expense_purchase", accountId: a.id, number: "ALS-1", issueDate: "2026-10-01", lines: [{ name: "Gider", qty: 1, unitPrice: String(price), vatRate: 0, expense: "rent" }], payment: { rest: "open" } });
  const p = await api.post(INV, body(100));
  const before = await bal(a.id);
  const r = await api.post(`${INV}/${p.data?.id}/edit`, body(1000));
  await report(`alış faturası tutar artırma 100 → 1.000 (giriş ${p.status}${p.status !== 200 ? ` ${String(p.error).slice(0, 80)}` : ""})`, a, before, r);
}
// 4) Alacak Yaz satırını Değersiz'li cariye TAŞIMA (yeni cari için yeni Alacak gibi)
{
  const a = await base("Yol Taşı Hedef");
  const b = (await api.post(ACC, { name: "Yol Taşı Kaynak", type: "customer", registeredOn: "2026-09-01", phone: "0500 779 99 99" })).data;
  await api.post(`${ACC}/${b.id}/entries`, { kind: "credit", amount: "1000", date: "2026-10-01", note: "Alacak" });
  const id = store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'credit'", b.id).id;
  const before = await bal(a.id);
  const r = await api.put(`${ACC}/${b.id}/entries/${id}`, { accountId: a.id, kind: "credit", amount: "1000", date: "2026-10-01", note: "Alacak" });
  await report("Alacak satırını Değersiz'li cariye taşıma (hedef cari)", a, before, r);
}
// 5) yeni Alacak Yaz ve tahsilat artırma (BM-M2T4-3: kabul kalmalı)
{
  const a = await base("Yol Avans");
  let before = await bal(a.id);
  let r = await api.post(`${ACC}/${a.id}/entries`, { kind: "credit", amount: "1000", date: "2026-10-01", note: "Alacak" });
  await report("yeni Alacak Yaz 1.000 (BM-M2T4-3)", a, before, r);
  await api.post(`${ACC}/${a.id}/entries`, pay("10", "2026-10-02"));
  const id = store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in' AND invoice_id = '' ORDER BY rowid DESC LIMIT 1", a.id).id;
  before = await bal(a.id);
  r = await api.put(`${ACC}/${a.id}/entries/${id}`, pay("500", "2026-10-02"));
  await report("tahsilat 10 → 500 (BM-M2T4-3)", a, before, r);
}
// 6) Silinenler'den Alacak Yaz satırını geri yükleme (silinmiş alacak geri gelir — yeni Alacak gibi mi?)
{
  const a = await base("Yol Geri Yükle");
  await api.post(`${ACC}/${a.id}/entries`, { kind: "credit", amount: "1000", date: "2026-10-01", note: "Alacak" });
  const id = store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'credit' AND source = ''", a.id).id;
  await api.del(`${ACC}/${a.id}/entries/${id}`);
  const item = ((await api.get("/api/admin/trash")).data || []).find(x => x.kind === "account-entry" && x.ref === id);
  const before = await bal(a.id);
  const r = await api.post("/api/admin/trash/restore", { id: item?.id });
  await report("Silinenler'den Alacak Yaz geri yükleme", a, before, r);
}
server.close();
process.exit(0);
