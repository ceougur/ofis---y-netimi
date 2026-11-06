// DK-BT3: aynı formun aynı gövdeyi ikinci kez göndermesi (yanıt kaybolunca kullanıcının yeniden Kaydet'i). Kullanım: ROOT=<depo kökü> node p3-yineleme.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.env.ROOT;
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { boot, must } = await imp("test/banka-210-ortak.mjs");
const ctx = await boot({ now: { time: "2026-10-08T12:00:00+03:00" }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
try {
  await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  const acc = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "DK Yineleme", phone: "0532 250 33 44", type: "customer", registeredOn: "2026-09-01" }));
  const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: acc.id, name: "DK Yineleme Kartı", total: "1000", mode: "auto", count: 2, firstDue: "2026-10-20", registeredOn: "2026-10-01" }));
  const card = await must("kart oku", ctx.api.get(`/api/workspace/plans/${plan.id}`));
  const item = card.items[0];
  const body = { dueDate: item.dueDate, amount: "450", note: "yineleme", updatedAt: item.updatedAt ?? "" };
  const one = await ctx.api.put(`/api/workspace/plans/${plan.id}/items/${item.id}`, body);
  const two = await ctx.api.put(`/api/workspace/plans/${plan.id}/items/${item.id}`, body);
  console.log(`taksit düzelt: 1. ${one.status} ${one.code || ""}; aynı gövde 2. ${two.status} ${two.code || ""} — veri tabanı ${JSON.stringify(ctx.store.get("SELECT amount, note FROM plan_items WHERE id = ?", item.id))}`);
  const form = { name: card.name, refNo: card.refNo, registeredOn: card.registeredOn, phone: card.phone || "", total: "1000", note: "kart yineleme", accountId: card.accountId, updatedAt: card.updatedAt };
  const c1 = await ctx.api.put(`/api/workspace/plans/${plan.id}`, form);
  const c2 = await ctx.api.put(`/api/workspace/plans/${plan.id}`, form);
  console.log(`taksit kartı: 1. ${c1.status}; aynı gövde 2. ${c2.status} ${c2.code || ""} — not ${ctx.store.get("SELECT note FROM plans WHERE id = ?", plan.id).note}`);
  const stock = await must("ürün", ctx.api.post("/api/workspace/stock", { code: "DKY-1", name: "DK Yineleme Ürün", unit: "Adet", unitPrice: "10", salePrice: "15" }));
  const s = await must("ürün oku", ctx.api.get(`/api/workspace/stock/${stock.id}`));
  const sform = { kind: s.kind, code: s.code, name: s.name, unit: s.unit, category: "", minQty: "", unitPrice: "10", salePrice: "18", vatRate: "", note: "", updatedAt: s.updatedAt };
  const s1 = await ctx.api.put(`/api/workspace/stock/${stock.id}`, sform);
  const s2 = await ctx.api.put(`/api/workspace/stock/${stock.id}`, sform);
  console.log(`stok kartı: 1. ${s1.status}; aynı gövde 2. ${s2.status} ${s2.code || ""} — satış fiyatı ${ctx.store.get("SELECT sale_price AS p FROM stock_items WHERE id = ?", stock.id).p}`);
} finally {
  await ctx.server.close();
}
