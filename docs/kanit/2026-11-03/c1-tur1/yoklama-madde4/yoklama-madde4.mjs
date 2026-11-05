// C1 TUR 1 madde 4 yoklaması (ürün kodu değiştirmez): stok hareketi ve kart kalemleri yollarında silinmiş cari / kart (ve komşu: silinmiş stok hareketi,
// silinmiş ürün, silinmiş kart tahsilatı, silinmiş taksit) yarışı açık mı? Gövde bekletilir, bu arada hedef silinir, sonra gövde gönderilir (ders 20).
// Kullanım: node yoklama-madde4.mjs <depo kökü>
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] || ".");
const { boot, must } = await import(pathToFileURL(path.join(root, "test/banka-210-ortak.mjs")).href);
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const ACC = "/api/workspace/accounts";
const PLANS = "/api/workspace/plans";
const STOCK = "/api/workspace/stock";

async function raceWrite(ctx, { method, path: url, body, during }) {
  const text = JSON.stringify(body);
  const { port } = new URL(ctx.server.base);
  let removed = null;
  const reply = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: url, headers: { cookie: ctx.api.client.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: data }));
    });
    req.on("error", reject);
    req.flushHeaders();
    setTimeout(async () => {
      try {
        removed = await during();
      } catch (error) {
        removed = { status: 0, error: String(error) };
      }
      req.end(text);
    }, 300);
  });
  return { reply: { status: reply.status, text: reply.text.slice(0, 200) }, removed: { status: removed?.status, error: removed?.error || removed?.data?.error || "" } };
}

const ctx = await boot({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const out = [];
try {
  await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  const rows = (sql, ...args) => ctx.store.all(sql, ...args).map(row => ({ ...row }));

  // (a) Stok hareketi (açık hesap satış) — cari gövde beklenirken silinir.
  {
    const account = await must("cari", ctx.api.post(ACC, { name: "M4a Hareketsiz", type: "customer", registeredOn: "2026-09-01" }));
    const item = await must("ürün", ctx.api.post(STOCK, { name: "M4a Ürün", unit: "Adet", unitPrice: 10, openingQty: "10" }));
    const race = await raceWrite(ctx, { method: "POST", path: `${STOCK}/${item.id}/moves`, body: { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: account.id, date: TODAY }, during: () => ctx.api.del(`${ACC}/${account.id}`) });
    out.push({ durum: "(a) stok satışı (açık hesap) + cari silinir", ...race, cariSatirlari: rows("SELECT kind, amount, source FROM account_entries WHERE account_id = ?", account.id), stokHareketleri: rows("SELECT kind, qty, pay, account_id AS accountId FROM stock_moves WHERE item_id = ? AND is_opening = 0", item.id) });
  }
  // (b) Stok hareketi düzeltme — yeni cari gövde beklenirken silinir.
  {
    const first = await must("cari", ctx.api.post(ACC, { name: "M4b Asıl", type: "customer", registeredOn: "2026-09-01" }));
    const second = await must("cari", ctx.api.post(ACC, { name: "M4b Hareketsiz", type: "customer", registeredOn: "2026-09-01" }));
    const item = await must("ürün", ctx.api.post(STOCK, { name: "M4b Ürün", unit: "Adet", unitPrice: 10, openingQty: "10" }));
    const made = await must("satış", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: first.id, date: TODAY }));
    const race = await raceWrite(ctx, { method: "PUT", path: `${STOCK}/${item.id}/moves/${made.moveId}`, body: { accountId: second.id }, during: () => ctx.api.del(`${ACC}/${second.id}`) });
    out.push({ durum: "(b) stok düzeltme (cari değişir) + yeni cari silinir", ...race, yeniCariSatirlari: rows("SELECT kind, amount, source FROM account_entries WHERE account_id = ?", second.id), asilCariSatirlari: rows("SELECT kind, amount, source FROM account_entries WHERE account_id = ?", first.id) });
  }
  // (c) Stok satışını taksitlendirme (kart açar) — cari gövde beklenirken silinir.
  {
    const account = await must("cari", ctx.api.post(ACC, { name: "M4c Hareketsiz", type: "customer", registeredOn: "2026-09-01" }));
    const item = await must("ürün", ctx.api.post(STOCK, { name: "M4c Ürün", unit: "Adet", unitPrice: 10, openingQty: "10" }));
    const race = await raceWrite(ctx, { method: "POST", path: `${STOCK}/${item.id}/moves`, body: { kind: "out", qty: 1, unitPrice: 600, pay: "account", accountId: account.id, date: TODAY, installments: { count: 2, firstDue: "2026-11-01" } }, during: () => ctx.api.del(`${ACC}/${account.id}`) });
    out.push({ durum: "(c) stok satışı taksitli + cari silinir", ...race, kartlar: rows("SELECT total, deleted_at AS deletedAt FROM plans WHERE account_id = ?", account.id), cariSatirlari: rows("SELECT kind, amount FROM account_entries WHERE account_id = ?", account.id) });
  }
  // (d) KOMŞU: stok hareketi düzeltme — hareketin kendisi gövde beklenirken silinir (açık hesap).
  {
    const account = await must("cari", ctx.api.post(ACC, { name: "M4d Cari", type: "customer", registeredOn: "2026-09-01" }));
    const item = await must("ürün", ctx.api.post(STOCK, { name: "M4d Ürün", unit: "Adet", unitPrice: 10, openingQty: "10" }));
    const made = await must("satış", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: account.id, date: TODAY }));
    const race = await raceWrite(ctx, { method: "PUT", path: `${STOCK}/${item.id}/moves/${made.moveId}`, body: { unitPrice: 70 }, during: () => ctx.api.del(`${STOCK}/${item.id}/moves/${made.moveId}`) });
    const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    out.push({ durum: "(d) KOMŞU: stok düzeltme + hareket silinir", ...race, cariSatirlari: rows("SELECT kind, amount, source, source_id AS sourceId FROM account_entries WHERE account_id = ?", account.id), hareket: rows("SELECT id FROM stock_moves WHERE id = ?", made.moveId), silinenlerde: trash.filter(row => String(row.id).includes(made.moveId)).map(row => row.id) });
    const trashItem = trash.find(row => String(row.id).includes(made.moveId));
    if (trashItem) {
      const restored = await ctx.api.post("/api/admin/trash/restore", { id: trashItem.id });
      out.push({ durum: "(d2) KOMŞU: Silinenler'den hareketi geri yükle", status: restored.status, error: restored.error || "", cariSatirlari: rows("SELECT kind, amount, source, source_id AS sourceId FROM account_entries WHERE account_id = ?", account.id) });
    }
  }
  // (e) KOMŞU: ürün gövde beklenirken silinir, hareket eklenir (açık hesap).
  {
    const account = await must("cari", ctx.api.post(ACC, { name: "M4e Cari", type: "customer", registeredOn: "2026-09-01" }));
    await must("borç", ctx.api.post(`${ACC}/${account.id}/entries`, { kind: "debt", amount: "1", date: TODAY, method: "cash" }));
    const item = await must("ürün", ctx.api.post(STOCK, { name: "M4e Ürün", unit: "Adet", unitPrice: 10, openingQty: "10" }));
    const race = await raceWrite(ctx, { method: "POST", path: `${STOCK}/${item.id}/moves`, body: { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: account.id, date: TODAY }, during: () => ctx.api.del(`${STOCK}/${item.id}`) });
    out.push({ durum: "(e) KOMŞU: stok satışı + ürün silinir", ...race, cariSatirlari: rows("SELECT kind, amount, source FROM account_entries WHERE account_id = ?", account.id), urun: rows("SELECT deleted_at AS deletedAt FROM stock_items WHERE id = ?", item.id) });
  }
  // (f) KOMŞU: kart tahsilatını düzeltme — tahsilatın kendisi gövde beklenirken silinir.
  {
    const account = await must("cari", ctx.api.post(ACC, { name: "M4f Cari", type: "customer", registeredOn: "2026-09-01" }));
    const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name: "M4f", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
    const made = await must("tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "100", date: TODAY, method: "cash" }));
    const cashBefore = (await must("Kasa", ctx.api.get("/api/workspace/cash"))).totals.balance;
    const race = await raceWrite(ctx, { method: "PUT", path: `${PLANS}/${plan.id}/entries/${made.entryId}`, body: { amount: "150" }, during: () => ctx.api.del(`${PLANS}/${plan.id}/entries/${made.entryId}?cashForce=1`) });
    const cashAfter = (await must("Kasa", ctx.api.get("/api/workspace/cash"))).totals.balance;
    out.push({ durum: "(f) KOMŞU: kart tahsilatı düzeltme + tahsilat silinir", ...race, tahsilatlar: rows("SELECT amount FROM plan_entries WHERE plan_id = ?", plan.id), kasaOnce: cashBefore, kasaSonra: cashAfter, olaylar: rows("SELECT e.status, e.amount_minor AS amountMinor FROM fin_events e WHERE e.src_id = ?", made.entryId) });
  }
  // (g) KOMŞU: taksit düzeltme — taksitin kendisi gövde beklenirken silinir.
  {
    const account = await must("cari", ctx.api.post(ACC, { name: "M4g Cari", type: "customer", registeredOn: "2026-09-01" }));
    const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name: "M4g", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
    const item = ctx.store.get("SELECT id FROM plan_items WHERE plan_id = ? ORDER BY seq LIMIT 1", plan.id);
    const race = await raceWrite(ctx, { method: "PUT", path: `${PLANS}/${plan.id}/items/${item.id}`, body: { amount: "250" }, during: () => ctx.api.del(`${PLANS}/${plan.id}/items/${item.id}`) });
    out.push({ durum: "(g) KOMŞU: taksit düzeltme + taksit silinir", ...race, taksitler: rows("SELECT seq, amount FROM plan_items WHERE plan_id = ? ORDER BY seq", plan.id) });
  }
  const integrity = await ctx.api.get("/api/workspace/ledger/integrity");
  out.push({ durum: "mutabakat (sonda)", ok: integrity.data?.ok, failures: JSON.stringify(integrity.data?.failures || []).slice(0, 600) });
} finally {
  await ctx.server.close();
}
console.log(JSON.stringify(out, null, 1));
