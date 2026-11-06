// BİRLEŞİK TUR 3 yeniden üretim (ders 6): iki yönetici, tam form (formun açıldığı andaki değerler) — YAN-A, YAN-B, 3(a) kart (plans PUT), stok kartı (stock_items PUT).
// Kullanım: node probe-bt3.mjs <kod kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2]);
const { boot, must, apiOf } = await import(pathToFileURL(path.join(root, "test/banka-210-ortak.mjs")).href);
const { createUser } = await import(pathToFileURL(path.join(root, "test/helpers.mjs")).href);
const ctx = await boot({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const db = ctx.store;
try {
  await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  const b = apiOf(await createUser(ctx.server, ctx.api.client, { username: "bt3yon", role: "admin", password: "Yonetici-Iki-2026!" }));
  const a = ctx.api;
  // YAN-A
  await must("açılış", a.post("/api/workspace/cash/opening", { amount: "5.000", date: "2026-09-01" }));
  const formA = (await must("A açar", a.get("/api/workspace/cash/opening"))).opening;
  await must("B 4.000", b.post("/api/workspace/cash/opening", { amount: "4.000", date: formA.date }));
  const rA = await a.post("/api/workspace/cash/opening", { amount: String(formA.amount), date: "2026-08-31" });
  const op = db.get("SELECT amount, date FROM cash_entries WHERE is_opening = 1");
  console.log(`YAN-A Kasa açılışı: A (yalnız tarih) → ${rA.status} ${rA.data?.code || ""} · son ${JSON.stringify(op)} · ${op.amount === 4000 ? "B duruyor" : "B SESSİZCE EZİLDİ"}`);
  // YAN-A' (açılış yokken açılan form, B arada girer)
  await must("açılışı sil", a.del(`/api/workspace/cash/${db.get("SELECT id FROM cash_entries WHERE is_opening = 1").id}`));
  const empty = (await must("A boş formu açar", a.get("/api/workspace/cash/opening"))).opening;
  await must("B 3.000 girer", b.post("/api/workspace/cash/opening", { amount: "3.000", date: "2026-09-01" }));
  const rA2 = await a.post("/api/workspace/cash/opening", { amount: "7.000", date: "2026-09-01" });
  const op2 = db.get("SELECT amount FROM cash_entries WHERE is_opening = 1");
  console.log(`YAN-A' boş form (form açılışında açılış ${empty === null ? "yok" : "var"}): B 3.000 girdi, A 7.000 gönderdi → ${rA2.status} ${rA2.data?.code || ""} · son ${JSON.stringify(op2)} · ${op2.amount === 3000 ? "B duruyor" : "B SESSİZCE EZİLDİ"}`);
  // YAN-B + kart
  const acc = await must("cari", a.post("/api/workspace/accounts", { name: "Bt3 Müşteri", type: "customer", registeredOn: "2026-09-01" }));
  const plan = await must("kart", a.post("/api/workspace/plans", { accountId: acc.id, name: "Bt3 Kartı", total: "1000", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: "2026-09-01" }));
  const item = plan.items[0];
  await must("B taksit 300", b.put(`/api/workspace/plans/${plan.id}/items/${item.id}`, { dueDate: item.dueDate, amount: "300", note: "" }));
  const rB = await a.put(`/api/workspace/plans/${plan.id}/items/${item.id}`, { dueDate: "2026-11-03", amount: String(item.amount), note: "" });
  const it = db.get("SELECT amount, due_date AS dueDate FROM plan_items WHERE id = ?", item.id);
  console.log(`YAN-B taksit: A (yalnız vade) → ${rB.status} ${rB.data?.code || ""} · son ${JSON.stringify(it)} · ${it.amount === 300 ? "B duruyor" : "B SESSİZCE EZİLDİ"}`);
  const fresh = await must("kart", a.get(`/api/workspace/plans/${plan.id}`));
  const full = p => ({ name: p.name, refNo: p.refNo, registeredOn: p.registeredOn, phone: p.phone, total: String(p.total), note: p.note, caseKey: p.caseKey || "", caseSource: p.caseSource || "", caseTitle: p.caseTitle || "", accountId: p.accountId, groupId: p.groupId || "", subgroupId: p.subgroupId || "" });
  const formPlan = full(fresh);
  await must("B kart tutarı 1.200", b.put(`/api/workspace/plans/${plan.id}`, { ...full(fresh), total: "1200" }));
  const rP = await a.put(`/api/workspace/plans/${plan.id}`, { ...formPlan, note: "A'nın notu" });
  const pr = db.get("SELECT total, note FROM plans WHERE id = ?", plan.id);
  console.log(`3a kart (plans PUT): A (yalnız not) → ${rP.status} ${rP.data?.code || ""} · son ${JSON.stringify(pr)} · ${pr.total === 1200 ? "B duruyor" : "B SESSİZCE EZİLDİ"}`);
  // stok kartı
  const st = await must("ürün", a.post("/api/workspace/stock", { name: "Bt3 Ürün", unit: "Adet", unitPrice: "10", salePrice: "15" }));
  const fs = s => ({ kind: s.kind, code: s.code, name: s.name, unit: s.unit, category: s.category, minQty: String(s.minQty || ""), unitPrice: String(s.unitPrice), salePrice: String(s.salePrice), vatRate: s.vatRate ?? "", note: s.note });
  const formStock = fs(st);
  await must("B satış fiyatı 20", b.put(`/api/workspace/stock/${st.id}`, { ...fs(st), salePrice: "20" }));
  const rS = await a.put(`/api/workspace/stock/${st.id}`, { ...formStock, note: "A'nın notu" });
  const sr = db.get("SELECT sale_price AS salePrice, note FROM stock_items WHERE id = ?", st.id);
  console.log(`3a stok kartı (stock_items PUT): A (yalnız not) → ${rS.status} ${rS.data?.code || ""} · son ${JSON.stringify(sr)} · ${sr.salePrice === 20 ? "B duruyor" : "B SESSİZCE EZİLDİ"}`);
  // stok kartı: alım fiyatı arada değişir (alım hareketi kartın Birim Fiyatını günceller)
  const formStock2 = fs(await must("ürün", a.get(`/api/workspace/stock/${st.id}`)));
  await must("B alım 12", b.post(`/api/workspace/stock/${st.id}/moves`, { kind: "in", qty: 1, unitPrice: "12", pay: "none", date: "2026-10-08" }));
  const mid = db.get("SELECT unit_price AS unitPrice FROM stock_items WHERE id = ?", st.id);
  const rS2 = await a.put(`/api/workspace/stock/${st.id}`, { ...formStock2, note: "A'nın ikinci notu" });
  const sr2 = db.get("SELECT unit_price AS unitPrice FROM stock_items WHERE id = ?", st.id);
  console.log(`3a stok kartı / alım: alımdan sonra birim fiyat ${mid.unitPrice}; A (yalnız not) → ${rS2.status} ${rS2.data?.code || ""} · son ${JSON.stringify(sr2)} · ${sr2.unitPrice === 12 ? "alım fiyatı duruyor" : "ALIM FİYATI SESSİZCE EZİLDİ"}`);
} catch (e) {
  console.log("YARIDA KALDI", e?.stack || e);
} finally {
  await ctx.server.close();
}
