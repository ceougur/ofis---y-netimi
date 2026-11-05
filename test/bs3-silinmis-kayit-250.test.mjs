// 2.5.0 BS-3 (2.4.9 C1 TUR 1'den devreden DÜŞÜK; docs/2.4.9-IS-LISTESI.md satır 178, docs/2.5.0-IS-LISTESI.md A tablosu BS-3) — düzeltme isteği yoldayken
// KAYDIN KENDİSİ silinirse yanıt yanlıştı (2.4.7'den beri; veri yazmıyordu, yalnız yanıt yanlış — kullanıcı "kaydedildi" sanıyordu):
//   (d) stok hareketi düzeltmesi (PUT /stock/:id/moves/:moveId)    → 409 ledger-integrity ("İşlem geri alındı … yöneticinize bildirin")
//   (f) taksit kartı tahsilatı düzeltmesi (PUT /plans/:id/entries/:id) → 200 (silinmiş satıra UPDATE 0 satır; Değişiklik Geçmişi "düzeltildi" yazıyordu)
//   (g) taksit düzeltmesi (PUT /plans/:id/items/:id)                → 200 (aynı)
// BAŞ MİMAR KARARI: üçü de 404 + kayıt bulunamadı iletisi (C1 TUR 1 deseni — plans.mjs assertPlanLive / stock.mjs prepare itemRow: isteğin başındaki okuma
// yazım işleminin İÇİNDE, istek kimliği bakışından sonra yinelenir); ileti modülün mevcut "bulunamadı" iletisi ("… Başka biri silmiş olabilir.").
// Hiçbir tablo yazılmaz: yanıttan sonra BÜTÜN tabloların satır sayısı ve içeriği silmeden hemen sonraki hâliyle aynı (ders 3).
// Yarış zorla üretilir (ders 20): başlıklar gider, gövde bekletilir; bu arada kayıt silinir (ön koşulun GERÇEKTEN oluştuğu okunur), sonra gövde gönderilir.
// Eski kodda (e74eb6e7) beklenen kırmızı (ders 38): (d) "409 … ledger-integrity", (f)/(g) "200" — "yazım reddedilir (404)" denetiminde.
// Sahte saat (ders 13); lisans servisi ölü adres (ders 30).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const ACC = "/api/workspace/accounts";
const PLANS = "/api/workspace/plans";
const STOCK = "/api/workspace/stock";

/** Yarış (zorla): başlıklar gider, gövde bekletilir; `during` (kaydı silme) koşar, sonra gövde gönderilir. */
async function raceWrite(ctx, { method, path, body, during }) {
  const text = JSON.stringify(body);
  const { port } = new URL(ctx.server.base);
  let removed = null;
  const reply = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers: { cookie: ctx.api.client.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
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
        removed = { status: 0, error };
      }
      req.end(text);
    }, 300);
  });
  return { reply, removed };
}

describe("2.5.0 BS-3 — düzeltme gövdesi yoldayken kayıt silinirse 404 + kayıt bulunamadı iletisi; hiçbir tablo yazılmaz", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(async () => ctx?.server.close());

  // Bütün tabloların satır sayısı ve içerik özeti (sqlite_master; tablo eklense de kapsar).
  const snapshot = () => {
    const out = {};
    for (const { name } of ctx.store.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")) {
      // WITHOUT ROWID tablolar da var: satırlar metne çevrilip sıralanır (sıra bağımsız özet).
      const rows = ctx.store.all(`SELECT * FROM "${name}"`).map(row => JSON.stringify(row)).sort();
      out[name] = `${rows.length}:${createHash("sha256").update(rows.join("\n")).digest("hex").slice(0, 16)}`;
    }
    return out;
  };
  const diff = (before, after) => Object.keys({ ...before, ...after }).filter(key => before[key] !== after[key]).map(key => `${key} ${before[key] ?? "YOK"} → ${after[key] ?? "YOK"}`);
  // Ortak denetim: ön koşul (kayıt gövde beklenirken silindi), tablolar silmeden hemen sonraki hâliyle aynı, yanıt 404 + ileti.
  const assertRefused = (label, { reply, removed }, { gone, before, message }) => {
    assert.equal(removed?.status, 200, `${label}: ön koşul — kayıt gövde beklenirken silindi (${removed?.status} ${JSON.stringify(removed?.data || removed?.error?.message || "").slice(0, 160)})`);
    assert.equal(gone(), true, `${label}: ön koşul — kayıt veri tabanında yok`);
    // Üç denetim birlikte okunur (kırmızının bütün nedenleri tek iletide — ders 38).
    const problems = [];
    if (reply.status !== 404) problems.push(`yazım reddedilmeli (404) — yanıt ${reply.status} ${reply.text.slice(0, 200)}`);
    const error = (() => {
      try {
        return JSON.parse(reply.text).error;
      } catch {
        return reply.text;
      }
    })();
    if (error !== message) problems.push(`ileti “${error}” (beklenen “${message}”)`);
    const changed = diff(before, snapshot());
    if (changed.length) problems.push(`hiçbir tablo yazılmamalı — değişen: ${changed.join("; ")}`);
    assert.deepEqual(problems, [], `${label}: ${problems.join(" | ")}`);
  };

  it("(d) stok hareketi düzeltmesi: hareket silinmişse 404 \"Stok hareketi bulunamadı. Başka biri silmiş olabilir.\" (önceden 409 ledger-integrity)", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "BS3 Stok Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
    const item = await must("ürün", ctx.api.post(STOCK, { name: "BS3 Ürün", unit: "Adet", unitPrice: 10, openingQty: "10" }));
    const made = await must("satış", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: account.id, date: TODAY }));
    let before = null;
    const race = await raceWrite(ctx, {
      method: "PUT",
      path: `${STOCK}/${item.id}/moves/${made.moveId}`,
      body: { unitPrice: 70 },
      during: async () => {
        const res = await ctx.api.del(`${STOCK}/${item.id}/moves/${made.moveId}`);
        before = snapshot();
        return res;
      },
    });
    assertRefused("stok hareketi düzeltmesi", race, { gone: () => !ctx.store.get("SELECT 1 AS x FROM stock_moves WHERE id = ?", made.moveId), before, message: "Stok hareketi bulunamadı. Başka biri silmiş olabilir." });
    // Cari borcu silmeyle düştü, düzeltme geri getirmedi.
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND source = 'stock'", account.id).n, 0, "silinen satışın cari borcu yok");
  });

  it("(f) taksit kartı tahsilatı düzeltmesi: tahsilat silinmişse 404 \"Hareket bulunamadı. Başka biri silmiş olabilir.\" (önceden 200)", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "BS3 Kart Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
    const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name: "BS3 Tahsilat Kartı", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
    const made = await must("tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "100", date: TODAY, method: "cash" }));
    let before = null;
    const race = await raceWrite(ctx, {
      method: "PUT",
      path: `${PLANS}/${plan.id}/entries/${made.entryId}`,
      body: { amount: "150" },
      during: async () => {
        const res = await ctx.api.del(`${PLANS}/${plan.id}/entries/${made.entryId}?cashForce=1`);
        before = snapshot();
        return res;
      },
    });
    assertRefused("tahsilat düzeltmesi", race, { gone: () => !ctx.store.get("SELECT 1 AS x FROM plan_entries WHERE id = ?", made.entryId), before, message: "Hareket bulunamadı. Başka biri silmiş olabilir." });
  });

  it("(g) taksit düzeltmesi: taksit silinmişse 404 \"Taksit bulunamadı. Başka biri silmiş olabilir.\" (önceden 200)", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "BS3 Taksit Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
    const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name: "BS3 Taksit Kartı", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
    const item = ctx.store.get("SELECT id FROM plan_items WHERE plan_id = ? ORDER BY seq LIMIT 1", plan.id);
    let before = null;
    const race = await raceWrite(ctx, {
      method: "PUT",
      path: `${PLANS}/${plan.id}/items/${item.id}`,
      body: { amount: "250" },
      during: async () => {
        const res = await ctx.api.del(`${PLANS}/${plan.id}/items/${item.id}`);
        before = snapshot();
        return res;
      },
    });
    assertRefused("taksit düzeltmesi", race, { gone: () => !ctx.store.get("SELECT 1 AS x FROM plan_items WHERE id = ?", item.id), before, message: "Taksit bulunamadı. Başka biri silmiş olabilir." });
  });

  it("yarış yokken aynı üç düzeltme yazar; silinmiş kayda doğrudan düzeltme de aynı 404 iletisini alır (isteğin başındaki denetim)", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "BS3 Olağan Müşteri", type: "customer", registeredOn: "2026-09-01" }));
    const item = await must("ürün", ctx.api.post(STOCK, { name: "BS3 Olağan Ürün", unit: "Adet", unitPrice: 10, openingQty: "10" }));
    const sale = await must("satış", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: account.id, date: TODAY }));
    await must("stok düzelt", ctx.api.put(`${STOCK}/${item.id}/moves/${sale.moveId}`, { unitPrice: 70 }));
    assert.equal(Number(ctx.store.get("SELECT amount FROM stock_moves WHERE id = ?", sale.moveId).amount), 70);
    const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name: "BS3 Olağan Kart", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
    const paid = await must("tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "100", date: TODAY, method: "cash" }));
    await must("tahsilat düzelt", ctx.api.put(`${PLANS}/${plan.id}/entries/${paid.entryId}`, { amount: "120" }));
    assert.equal(Number(ctx.store.get("SELECT amount FROM plan_entries WHERE id = ?", paid.entryId).amount), 120);
    const first = ctx.store.get("SELECT id FROM plan_items WHERE plan_id = ? ORDER BY seq LIMIT 1", plan.id);
    await must("taksit düzelt", ctx.api.put(`${PLANS}/${plan.id}/items/${first.id}`, { amount: "250" }));
    assert.equal(Number(ctx.store.get("SELECT amount FROM plan_items WHERE id = ?", first.id).amount), 250);
    // Silinmiş kayda (yarışsız) düzeltme: isteğin başındaki okuma aynı iletiyi verir.
    await must("taksit sil", ctx.api.del(`${PLANS}/${plan.id}/items/${first.id}`));
    const late = await ctx.api.put(`${PLANS}/${plan.id}/items/${first.id}`, { amount: "260" });
    assert.deepEqual([late.status, late.error], [404, "Taksit bulunamadı. Başka biri silmiş olabilir."]);
  });
});
