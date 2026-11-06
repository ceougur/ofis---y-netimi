// BİRLEŞİK TUR 1 — YB-1 yeniden üretme (ders 6): stok / taksit / Kasa düzeltme uçlarında isteğin başındaki okuma (previous) gövde beklenirken eskir mi?
// Kullanım: node yb1-uc-yol.mjs <program kökü>   (lisans ölü adres; sahte saat)
// S)  stok hareketi (peşin alım, Kasa'dan çıkış) — Kasa "Engelle": yöneticinin 100 → 650 düzeltmesi yoldayken muhasebe aynı hareketi 100 → 10 yapar.
// P)  taksit iadesi (Kasa'dan çıkış) — aynı.
// P2) taksit tahsilatı K8 (kartın kalanı): yöneticinin 600 → 500 düzeltmesi yoldayken muhasebe aynı tahsilatı 600 → 100 yapar ve 700 tahsilat ekler.
// K)  Kasa hareketi (ödeme) — Kasa "Engelle": aynı yarış.
// A2) cari hareketi: gövdede yalnız tutar; arada öbür kullanıcı açıklamayı değiştirir → açıklama geri döner mi (bayat satırla birleştirme)?
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.argv[2]);
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { boot, must, apiOf } = await imp("test/banka-210-ortak.mjs");
const { createUser } = await imp("test/helpers.mjs");

const NOW = "2026-10-08T12:00:00+03:00";
const DAY = "2026-10-08";
const ctx = await boot({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
const other = apiOf(await createUser(ctx.server, ctx.api.client, { username: "yb1muh", role: "muhasebe" }));
const kasa = async () => (await must("kasa", ctx.api.get("/api/workspace/cash"))).byMethod.cash;
const short = r => `${r.status} ${r.body?.code || ""} ${String(r.body?.error || "").slice(0, 150)}`;

async function raceWrite({ path: p, body, during }) {
  const text = JSON.stringify(body);
  const { port } = new URL(ctx.server.base);
  let mid = null;
  const reply = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method: "PUT", path: p, headers: { cookie: ctx.api.client.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: (() => { try { return JSON.parse(data); } catch { return data; } })() }));
    });
    req.on("error", reject);
    req.flushHeaders();
    setTimeout(async () => {
      try { mid = await during(); } catch (error) { mid = { status: 0, error: error.message }; }
      req.end(text);
    }, 300);
  });
  return { reply, mid };
}
// Kasa'yı hedef değere getirir (Kasa girişi ya da çıkışı; Kontrol Yok iken).
async function setKasa(target, label) {
  const now = await kasa();
  const delta = Math.round((target - now) * 100) / 100;
  if (Math.abs(delta) < 0.005) return;
  await must(`Kasa ${label}`, ctx.api.post("/api/workspace/cash", { kind: delta > 0 ? "in" : "out", amount: String(Math.abs(delta)), date: DAY, description: `Ayar ${label}` }));
}

try {
  // ---------- S ----------
  console.log("S) stok hareketi (peşin alım) — Kasa Engelle");
  await must("politika", ctx.api.put("/api/admin/negative-policy", { cash: "off" }));
  const item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "YB1 Ürün", unit: "Adet", unitPrice: 10 }));
  const buy = await must("alım 100", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: 1, unitPrice: 100, pay: "cash", method: "cash", date: DAY }));
  await setKasa(500, "S");
  await must("politika", ctx.api.put("/api/admin/negative-policy", { cash: "block" }));
  console.log(`  başlangıç Kasa ${await kasa()}`);
  const sPlain = await ctx.api.put(`/api/workspace/stock/${item.id}/moves/${buy.moveId}`, { unitPrice: 650 });
  console.log(`  yarışsız 100 → 650: ${sPlain.status} ${sPlain.code || ""}`);
  const S = await raceWrite({
    path: `/api/workspace/stock/${item.id}/moves/${buy.moveId}`,
    body: { unitPrice: 650 },
    during: async () => {
      const r = await other.put(`/api/workspace/stock/${item.id}/moves/${buy.moveId}`, { unitPrice: 10 });
      return { status: r.status, kasa: await kasa() };
    },
  });
  console.log(`  arada muhasebe 100 → 10: ${S.mid.status}, Kasa ${S.mid.kasa}`);
  console.log(`  yöneticinin 650 düzeltmesi: ${short(S.reply)}`);
  console.log(`  SONUÇ S: hareket tutarı ${ctx.store.get("SELECT amount FROM stock_moves WHERE id = ?", buy.moveId).amount}, Kasa ${await kasa()} (Engelle; 0'ın altı olmamalı)`);

  // ---------- P ----------
  console.log("P) taksit iadesi — Kasa Engelle");
  await must("politika", ctx.api.put("/api/admin/negative-policy", { cash: "off" }));
  const acc = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "YB1 Kart Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
  const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: acc.id, name: "YB1 Kart", total: "1000", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: DAY }));
  await must("tahsilat 1000", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1000", date: DAY, method: "cash" }));
  const refund = await must("iade 100", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "out", amount: "100", date: DAY, method: "cash" }));
  await setKasa(500, "P");
  await must("politika", ctx.api.put("/api/admin/negative-policy", { cash: "block" }));
  console.log(`  başlangıç Kasa ${await kasa()}`);
  const pPlain = await ctx.api.put(`/api/workspace/plans/${plan.id}/entries/${refund.entryId}`, { amount: "650" });
  console.log(`  yarışsız 100 → 650: ${pPlain.status} ${pPlain.code || ""}`);
  const P = await raceWrite({
    path: `/api/workspace/plans/${plan.id}/entries/${refund.entryId}`,
    body: { amount: "650" },
    during: async () => {
      const r = await other.put(`/api/workspace/plans/${plan.id}/entries/${refund.entryId}`, { amount: "10" });
      return { status: r.status, kasa: await kasa() };
    },
  });
  console.log(`  arada muhasebe 100 → 10: ${P.mid.status}, Kasa ${P.mid.kasa}`);
  console.log(`  yöneticinin 650 düzeltmesi: ${short(P.reply)}`);
  console.log(`  SONUÇ P: iade tutarı ${ctx.store.get("SELECT amount FROM plan_entries WHERE id = ?", refund.entryId).amount}, Kasa ${await kasa()} (Engelle; 0'ın altı olmamalı)`);

  // ---------- P2 ----------
  console.log("P2) taksit tahsilatı — K8 kartın kalanı (Fazlasını Avans Yaz sorusu)");
  await must("politika", ctx.api.put("/api/admin/negative-policy", { cash: "off" }));
  const acc2 = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "YB1 K8 Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
  const plan2 = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: acc2.id, name: "YB1 K8 Kart", total: "1000", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: DAY }));
  const col = await must("tahsilat 600", ctx.api.post(`/api/workspace/plans/${plan2.id}/entries`, { kind: "in", amount: "600", date: DAY, method: "cash" }));
  const P2 = await raceWrite({
    path: `/api/workspace/plans/${plan2.id}/entries/${col.entryId}`,
    body: { amount: "500" },
    during: async () => {
      const a = await other.put(`/api/workspace/plans/${plan2.id}/entries/${col.entryId}`, { amount: "100" });
      const b = await other.post(`/api/workspace/plans/${plan2.id}/entries`, { kind: "in", amount: "700", date: DAY, method: "cash" });
      return { status: `${a.status}/${b.status}` };
    },
  });
  const paid2 = ctx.store.get("SELECT TOTAL(CASE WHEN kind = 'in' THEN amount ELSE -amount END) AS t FROM plan_entries WHERE plan_id = ?", plan2.id).t;
  console.log(`  arada muhasebe 600 → 100 + yeni 700: ${P2.mid.status}`);
  console.log(`  yöneticinin 500 düzeltmesi: ${short(P2.reply)}`);
  console.log(`  SONUÇ P2: kartın net tahsilatı ${paid2} / toplam 1000 (aşan kısım "Fazlasını Avans Yaz" onayı olmadan yazıldıysa > 1000)`);

  // ---------- K ----------
  console.log("K) Kasa hareketi (ödeme) — Kasa Engelle");
  await must("politika", ctx.api.put("/api/admin/negative-policy", { cash: "off" }));
  const pay = await must("Kasa ödemesi 100", ctx.api.post("/api/workspace/cash", { kind: "out", amount: "100", date: DAY, description: "YB1 Kasa ödemesi" }));
  const payId = pay.id || ctx.store.get("SELECT id FROM cash_entries WHERE description = 'YB1 Kasa ödemesi'").id;
  await setKasa(500, "K");
  await must("politika", ctx.api.put("/api/admin/negative-policy", { cash: "block" }));
  console.log(`  başlangıç Kasa ${await kasa()}`);
  const kPlain = await ctx.api.put(`/api/workspace/cash/${payId}`, { kind: "out", amount: "650", date: DAY, description: "YB1 Kasa ödemesi" });
  console.log(`  yarışsız 100 → 650: ${kPlain.status} ${kPlain.code || ""}`);
  const K = await raceWrite({
    path: `/api/workspace/cash/${payId}`,
    body: { kind: "out", amount: "650", date: DAY, description: "YB1 Kasa ödemesi" },
    during: async () => {
      const r = await other.put(`/api/workspace/cash/${payId}`, { kind: "out", amount: "10", date: DAY, description: "YB1 Kasa ödemesi" });
      return { status: r.status, kasa: await kasa() };
    },
  });
  console.log(`  arada muhasebe 100 → 10: ${K.mid.status}, Kasa ${K.mid.kasa}`);
  console.log(`  yöneticinin 650 düzeltmesi: ${short(K.reply)}`);
  console.log(`  SONUÇ K: hareket tutarı ${ctx.store.get("SELECT amount FROM cash_entries WHERE id = ?", payId).amount}, Kasa ${await kasa()} (Engelle; 0'ın altı olmamalı)`);

  // ---------- A2 ----------
  console.log("A2) cari hareketi — gövdede yalnız tutar; arada açıklama değişir");
  await must("politika", ctx.api.put("/api/admin/negative-policy", { cash: "off" }));
  const acc3 = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "YB1 Not Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
  const debt = await must("borç", ctx.api.post(`/api/workspace/accounts/${acc3.id}/entries`, { kind: "debt", amount: "300", date: DAY, note: "ilk not" }));
  const A2 = await raceWrite({
    path: `/api/workspace/accounts/${acc3.id}/entries/${debt.entryId}`,
    body: { amount: "350" },
    during: async () => {
      const r = await other.put(`/api/workspace/accounts/${acc3.id}/entries/${debt.entryId}`, { note: "muhasebenin notu" });
      return { status: r.status };
    },
  });
  const row = ctx.store.get("SELECT amount, note FROM account_entries WHERE id = ?", debt.entryId);
  console.log(`  arada not değişti: ${A2.mid.status}; tutar düzeltmesi: ${short(A2.reply)}`);
  console.log(`  SONUÇ A2: tutar ${row.amount}, açıklama “${row.note}” (öbür kullanıcının notu kalmalı)`);
  const last = ctx.store.get("SELECT payload_json AS p FROM audit_events WHERE type = 'account.entry.updated' AND entity_id = ? ORDER BY rowid DESC LIMIT 1", debt.entryId);
  console.log(`  Değişiklik Geçmişi "önceki": ${JSON.stringify(JSON.parse(last.p).previous ? { amount: JSON.parse(last.p).previous.amount, note: JSON.parse(last.p).previous.note } : null)}`);
} finally {
  await ctx.server.close();
}
