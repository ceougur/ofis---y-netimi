// K28 kurgusu için tanı: POS tam iade + valör sonrası banka kaynaklı cari satırları ve takvim kalemleri. Kullanım: node k28-bak.mjs <kod kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
const o = await import(pathToFileURL(path.join(root, "test", "banka-220-pos-ortak.mjs")).href);
const w = await o.bootBank();
try {
  const acc = await o.openAcceptanceAccounts(w.api);
  const abc = await o.must("ABC", w.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const provider = await o.must("sağlayıcı", w.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
  await o.openPos(w.api, o.ziraatPos(acc.ziraat.id, { name: "Ödeme Kuruluşu Sanal POS", kind: "virtual", providerKind: "payment_institution", tax: "vat_excl", providerAccountId: provider.id }));
  await o.must("satış", w.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", method: "card", date: o.TODAY, amount: "10.000" }));
  const sold = (await o.salesOf(w.api))[0];
  console.log("satış kalemleri:", JSON.stringify(sold.items.map(i => [i.valueDate, i.grossMinor, i.feeMinor, i.netMinor])));
  if (process.argv[3] === "iade") {
    w.server.clock.set("2026-10-09T10:00:00+03:00");
    await o.must("tam iade", w.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "out", method: "card", posRefund: true, amount: "10.000", date: "2026-10-09", posRefundOf: sold.id }));
  }
  w.server.clock.set("2026-10-12T10:00:00+03:00");
  await o.settle(w.api);
  const store = w.store || w.server.app.store;
  console.log("ctx anahtarları:", Object.keys(w).join(","));
  console.log("banka kaynaklı cari satırları:", JSON.stringify(store.all("SELECT account_id AS a, kind, method, amount, date, source, source_id AS sid, invoice_id AS inv, note FROM account_entries WHERE source NOT IN ('', 'invoice')")));
  console.log("cariler:", JSON.stringify(store.all("SELECT id, name, type FROM accounts")));
  const dues = await o.must("zil", w.api.get("/api/workspace/dues"));
  console.log("takvim:", JSON.stringify(dues.items.map(r => [r.source, r.accountId, r.amount, r.dueDate, r.direction, r.label])));
  for (const a of store.all("SELECT id, name FROM accounts")) {
    const c = await o.must("kart", w.api.get(`/api/workspace/accounts/${a.id}`));
    console.log(a.name, "bakiye", c.totals.balance, "gecikmiş", c.totals.overdueDebt, "satır", JSON.stringify(c.entries.map(e => [e.kind, e.method, e.amount, e.date, e.source, e.remaining])));
  }
} finally {
  await w.server.close();
}
