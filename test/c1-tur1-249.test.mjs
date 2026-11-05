// 2.4.9 C1 TUR 1 — C1 dar kontrolünün bulguları (docs/2.4.9-IS-LISTESI.md "C1 DAR KONTROL", 03.11.2026):
//   ORTA-1 (ders 47 hız gerilemesi): hareket sayacının "banka fişi" (H14) parçası her satırsız banka fişi başlığında pos_sales'i baştan tarıyordu
//     (idx_pos_sales_event kısmi indeks: yalnız etkin satış) → çok KDV'li masraf fişli bankanın carisinde kart açılışı ve fatura listesi saniyeler.
//     Düzeltme: POS kaydı yalnız POS İptal İadesi fişinin (pos_cancel_refund) tutar taşıyıcısıdır; tarama yalnız o türde. Fatura kapamasının cari
//     defteri okuması (detail withRemaining: false) silme engelini (deleteBlock → hareket sayacı) hesaplamaz.
//   DÜŞÜK-3: Silinenler'deki cari notu "Hareketleriyle Cari listesine geri döner; Kasa yeniden hesaplanır." C1'den sonra yanlış (silinen cari hareketsiz).
//   ORTA (taksit kartı yarışı): kart isteğin başında okunuyor, gövde beklenirken (await readJson) kart silinirse tahsilat / iade / tahsilat düzeltmesi /
//     taksit ekleme / taksit düzeltmesi SİLİNMİŞ KARTA yazılıyordu (yanıt 404, kayıt yazılmış). Düzeltme: yazım işleminin içinde kart yeniden denetlenir.
//   Madde 4 (aynı desen, stok hareketi): ürün gövde beklenirken silinirse satış / düzeltme silinmiş ürüne yazılıyordu (yanıt 404) — S1–S3.
// 2.4.9 C1 TUR 2 (C1 tur 1 dar kontrolü, docs/2.4.9-IS-LISTESI.md "C1 TUR 1 DAR KONTROL", 04.11.2026):
//   DÜŞÜK-1 (yalnız test; M2/M3 mutasyonları yaşıyordu): Y6 taksit kartı tahsilatı düzeltmesinde KÜÇÜLEN tutar ve yol değişimi (nakit → POS) — kart denetimi
//     K8'in "tutar büyüyor" dalına bağlı değil; S4 yalnız miktar stok girişi (`pay: "none"`, mobil stok girişi — lib/mobile-write.mjs) — ürün denetimi para
//     yoluna bağlı değil. Dişi: M2 (plans.mjs PUT entries'te assertPlanLive yalnız büyüyen dalda) → Y6 kırmızı; M3 (stock.mjs POST moves'ta itemRow yalnız
//     `input.pay !== "none"`) → S4 kırmızı (docs/kanit/2026-11-04/c1-tur2).
//   DÜŞÜK-2 (C1 tur 1'in getirdiği metin): eski sürümde (v2.4.7) hareketiyle silinmiş cari Silinenler'de kalabilir; geri yüklenince hareketleri ve Kasa döner.
//     Not tek cümle: "Cari listesine geri döner; varsa hareketleri de geri gelir ve Kasa yeniden hesaplanır." (D3; e2e senaryo-cari-243 Silinenler adımı).
// Kâhin: beklenen sayılar girilen kayıtların ELLE sayımıdır; eşdeğerlik denetimi düzeltmeden ÖNCEKİ tanımın (eaf6b988) SQL'idir (program kodundan değil).
// Eski kodda (eaf6b988) beklenen kırmızılar (ders 38): Y1–Y4 "silinmiş karta yazılmamalı" (satır yazılmış, yanıt 404); D3 not eski metin; E2 masraf
// başlığı POS kaydı yüzünden sayılır (1); E3 fatura listesi hareket sayacını çalıştırır (>0). E1 (eşdeğerlik) eski kodda da yeşildir (tanım aynı).
// Sahte saat (ders 13).
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { boot, must, rawRun } from "./banka-210-ortak.mjs";
import { BANK, bootBank, openAcceptanceAccounts, openPos, posInvoice, ziraatPos } from "./banka-220-pos-ortak.mjs";
import { accountMovements } from "../server/lib/account-movements.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const ACC = "/api/workspace/accounts";
const PLANS = "/api/workspace/plans";
const cashOf = async api => (await must("Kasa", api.get("/api/workspace/cash"))).totals.balance;

// Durum durum sonuç: biri kırmızı olsa da öbürleri koşar; sonuç ve nedeni tek iletide (eski kodda kırmızı kanıtı — ders 38).
async function check(outcomes, label, fn) {
  try {
    await fn();
    outcomes.push(`✓ ${label}`);
  } catch (error) {
    outcomes.push(`✗ ${label}: ${String(error?.message || error).split("\n")[0]}`);
  }
}
function verdict(name, outcomes) {
  const failed = outcomes.filter(line => line.startsWith("✗"));
  assert.equal(failed.length, 0, `${name}: ${failed.length}/${outcomes.length} durum kırmızı\n${outcomes.join("\n")}`);
}

/**
 * Yarış (zorla, ders 20): isteğin başlıkları gider, gövde bekletilir — sunucu kartı okudu ve gövdeyi bekliyor; bu arada `during` (kartı silme) koşar,
 * sonra gövde gönderilir. Dönüş: yazım isteğinin yanıtı + `during`'in sonucu (ön koşulun GERÇEKTEN oluştuğu okunur).
 */
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

describe("2.4.9 C1 TUR 1 — taksit kartı yarışı (zorla): gövde yoldayken kart silinirse hiçbir şey yazılmaz (404)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW });
    await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(async () => ctx?.server.close());

  const newPlan = async name => {
    const account = await must(`cari ${name}`, ctx.api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01" }));
    const plan = await must(`kart ${name}`, ctx.api.post(PLANS, { accountId: account.id, name, total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
    return { account, plan };
  };
  const deletedAt = id => ctx.store.get("SELECT deleted_at AS d FROM plans WHERE id = ?", id)?.d ?? "YOK";
  const receiptSeq = () => ctx.store.get("SELECT value FROM settings WHERE key = 'plans.receiptSeq'")?.value ?? "";
  const eventCount = () => ctx.store.get("SELECT COUNT(*) AS n FROM fin_events").n;
  const entriesOf = planId => ctx.store.all("SELECT kind, amount FROM plan_entries WHERE plan_id = ? ORDER BY rowid", planId).map(row => ({ kind: row.kind, amount: Number(row.amount) }));
  const itemsOf = planId => ctx.store.all("SELECT due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY seq", planId).map(row => ({ dueDate: row.dueDate, amount: Number(row.amount) }));
  // Ortak sonuç denetimi: ön koşul (kart gövde beklenirken silindi), yanıt 404 "Taksit kartı bulunamadı", kayıtlar ve Kasa aynen.
  const assertRaceRefused = async (label, plan, { reply, removed }, facts, before) => {
    assert.equal(removed?.status, 200, `${label}: ön koşul — kart gövde beklenirken silindi (${removed?.status} ${JSON.stringify(removed?.data || removed?.error?.message || "").slice(0, 160)})`);
    assert.ok(deletedAt(plan.id), `${label}: ön koşul — kart silinmiş`);
    const after = facts();
    assert.deepEqual(after, before, `${label}: silinmiş karta yazılmamalı (kayıtlar aynen) — önce ${JSON.stringify(before)}, sonra ${JSON.stringify(after)}`);
    assert.equal(reply.status, 404, `${label}: yazım reddedilir — ${reply.text.slice(0, 160)}`);
    assert.match(reply.text, /Taksit kartı bulunamadı/, `${label}: mevcut hata biçimi`);
  };

  it("Y1 kart tahsilatı ve iadesi (POST …/entries; mobil taksit tahsilatı da bu uç): silinmiş karta satır, makbuz numarası, işlem başlığı yazılmaz; Kasa aynı", async () => {
    const outcomes = [];
    await check(outcomes, "tahsilat (nakit)", async () => {
      const { plan } = await newPlan("Y1 Tahsilat Yarışı");
      const facts = () => ({ entries: entriesOf(plan.id), receipt: receiptSeq(), events: eventCount() });
      const before = facts();
      const cash = await cashOf(ctx.api);
      const race = await raceWrite(ctx, { method: "POST", path: `${PLANS}/${plan.id}/entries`, body: { kind: "in", amount: "100", date: TODAY, method: "cash" }, during: () => ctx.api.del(`${PLANS}/${plan.id}`) });
      await assertRaceRefused("tahsilat", plan, race, facts, before);
      assert.equal(await cashOf(ctx.api), cash, "tahsilat: Kasa değişmez");
    });
    await check(outcomes, "iade (nakit ödeme)", async () => {
      const { plan } = await newPlan("Y1 İade Yarışı");
      await must("tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "200", date: TODAY, method: "cash" }));
      const facts = () => ({ entries: entriesOf(plan.id), receipt: receiptSeq(), events: eventCount() });
      const before = facts();
      assert.deepEqual(before.entries, [{ kind: "in", amount: 200 }]);
      const race = await raceWrite(ctx, { method: "POST", path: `${PLANS}/${plan.id}/entries`, body: { kind: "out", amount: "50", date: TODAY, method: "cash", cashForce: true }, during: () => ctx.api.del(`${PLANS}/${plan.id}?cashForce=1`) });
      const cash = await cashOf(ctx.api);
      await assertRaceRefused("iade", plan, race, facts, before);
      assert.equal(await cashOf(ctx.api), cash, "iade: Kasa (kart silindikten sonraki) değişmez");
    });
    verdict("Y1", outcomes);
  });

  it("Y2 kart tahsilatını düzeltme (PUT …/entries/:id): silinmiş kartın tahsilatı değişmez", async () => {
    const { plan } = await newPlan("Y2 Düzeltme Yarışı");
    const made = await must("tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "100", date: TODAY, method: "cash" }));
    const facts = () => ({ entries: entriesOf(plan.id), updated: ctx.store.get("SELECT updated_at AS u FROM plan_entries WHERE id = ?", made.entryId)?.u ?? "YOK", events: eventCount() });
    const before = facts();
    assert.deepEqual(before.entries, [{ kind: "in", amount: 100 }]);
    const race = await raceWrite(ctx, { method: "PUT", path: `${PLANS}/${plan.id}/entries/${made.entryId}`, body: { amount: "150", cashForce: true }, during: () => ctx.api.del(`${PLANS}/${plan.id}?cashForce=1`) });
    await assertRaceRefused("tahsilat düzeltmesi", plan, race, facts, before);
  });

  it("Y3 taksit ekleme (POST …/items): silinmiş karta taksit eklenmez", async () => {
    const { plan } = await newPlan("Y3 Taksit Ekleme Yarışı");
    const facts = () => ({ items: itemsOf(plan.id) });
    const before = facts();
    assert.equal(before.items.length, 2);
    const race = await raceWrite(ctx, { method: "POST", path: `${PLANS}/${plan.id}/items`, body: { dueDate: "2027-01-01", amount: "300" }, during: () => ctx.api.del(`${PLANS}/${plan.id}`) });
    await assertRaceRefused("taksit ekleme", plan, race, facts, before);
  });

  it("Y4 taksit düzeltme (PUT …/items/:id): silinmiş kartın taksiti değişmez", async () => {
    const { plan } = await newPlan("Y4 Taksit Düzeltme Yarışı");
    const item = ctx.store.get("SELECT id FROM plan_items WHERE plan_id = ? ORDER BY seq LIMIT 1", plan.id);
    const facts = () => ({ items: itemsOf(plan.id) });
    const before = facts();
    const race = await raceWrite(ctx, { method: "PUT", path: `${PLANS}/${plan.id}/items/${item.id}`, body: { amount: "250" }, during: () => ctx.api.del(`${PLANS}/${plan.id}`) });
    await assertRaceRefused("taksit düzeltme", plan, race, facts, before);
  });

  it("Y5 yarış yokken aynı uçlar yazar (düzeltme olağan yolu bozmaz)", async () => {
    const { plan } = await newPlan("Y5 Olağan Yol");
    const made = await must("tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "100", date: TODAY, method: "cash" }));
    await must("tahsilat düzelt", ctx.api.put(`${PLANS}/${plan.id}/entries/${made.entryId}`, { amount: "120" }));
    await must("iade", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "out", amount: "20", date: TODAY, method: "cash" }));
    const added = await must("taksit ekle", ctx.api.post(`${PLANS}/${plan.id}/items`, { dueDate: "2027-01-01", amount: "300" }));
    const first = added.items.find(row => row.seq === 1);
    await must("taksit düzelt", ctx.api.put(`${PLANS}/${plan.id}/items/${first.id}`, { amount: "250" }));
    assert.deepEqual(entriesOf(plan.id), [{ kind: "in", amount: 120 }, { kind: "out", amount: 20 }]);
    assert.deepEqual(itemsOf(plan.id).map(row => row.amount), [250, 300, 300]);
  });

  it("D3 Silinenler'deki cari notu (C1 TUR 2 DÜŞÜK-2): tek cümle — eski sürümde hareketiyle silinmiş cari için hareketler ve Kasa da anılır (\"varsa\")", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "D3 Hareketsiz Silinen", type: "customer", registeredOn: "2026-09-01" }));
    await must("sil", ctx.api.del(`${ACC}/${account.id}`));
    const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    const item = trash.find(row => row.id === `account:${account.id}`);
    assert.ok(item, "silinen cari Silinenler'de");
    assert.equal(item.note, "Cari listesine geri döner; varsa hareketleri de geri gelir ve Kasa yeniden hesaplanır.", `not: “${item.note}”`);
  });
});

// C1 TUR 1 madde 4 (KARAR "stok hareketi / kart kalemleri aynı desen → C1 TUR 1"): stok hareketinde silinmiş CARİ yarışı kapalı (400 "Seçilen cari
// bulunamadı", hiçbir şey yazılmaz — docs/kanit/2026-11-03/c1-tur1/yoklama-madde4); ama ÜRÜN gövde beklenirken silinince satış / düzeltme yazılıyor,
// yanıt 404 "Ürün bulunamadı" (yazımdan SONRA detail() düşüyor) — kullanıcı "olmadı" sanıp yineler → cariye çift borç / Kasa'ya çift giriş. Aynı desen:
// ürün isteğin başında okunur (itemRow), await readJson, yazım. Eski kodda (eaf6b988) beklenen kırmızı: S1/S2 "silinmiş ürüne yazılmamalı".
describe("2.4.9 C1 TUR 1 — stok hareketi yarışı (zorla): gövde yoldayken ürün silinirse hiçbir şey yazılmaz (404)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW });
    await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(async () => ctx?.server.close());
  const STOCK = "/api/workspace/stock";
  const newItem = name => must(`ürün ${name}`, ctx.api.post(STOCK, { name, unit: "Adet", unitPrice: 10, openingQty: "10" }));
  const itemDeletedAt = id => ctx.store.get("SELECT deleted_at AS d FROM stock_items WHERE id = ?", id)?.d ?? "YOK";
  const movesOf = itemId => ctx.store.all("SELECT kind, qty, amount, pay, account_id AS accountId FROM stock_moves WHERE item_id = ? ORDER BY rowid", itemId).map(row => ({ kind: row.kind, qty: Number(row.qty), amount: Number(row.amount), pay: row.pay, accountId: row.accountId }));
  const entriesOf = accountId => ctx.store.all("SELECT kind, amount, source FROM account_entries WHERE account_id = ? ORDER BY rowid", accountId).map(row => ({ kind: row.kind, amount: Number(row.amount), source: row.source }));
  const eventCount = () => ctx.store.get("SELECT COUNT(*) AS n FROM fin_events").n;
  const assertItemRaceRefused = (label, item, { reply, removed }, facts, before) => {
    assert.equal(removed?.status, 200, `${label}: ön koşul — ürün gövde beklenirken silindi (${removed?.status} ${JSON.stringify(removed?.data || removed?.error?.message || "").slice(0, 160)})`);
    assert.ok(itemDeletedAt(item.id) && itemDeletedAt(item.id) !== "YOK", `${label}: ön koşul — ürün silinmiş`);
    const after = facts();
    assert.deepEqual(after, before, `${label}: silinmiş ürüne yazılmamalı (kayıtlar aynen) — önce ${JSON.stringify(before)}, sonra ${JSON.stringify(after)}`);
    assert.equal(reply.status, 404, `${label}: yazım reddedilir — ${reply.text.slice(0, 160)}`);
    assert.match(reply.text, /Ürün bulunamadı/, `${label}: mevcut hata biçimi`);
  };

  it("S1 stok satışı (POST …/moves; açık hesap ve peşin): silinmiş ürüne hareket, cari borcu, Kasa girişi yazılmaz", async () => {
    const outcomes = [];
    await check(outcomes, "açık hesap satış", async () => {
      const account = await must("cari", ctx.api.post(ACC, { name: "S1 Açık Hesap Müşteri", type: "customer", registeredOn: "2026-09-01" }));
      const item = await newItem("S1 Açık Hesap Ürünü");
      const facts = () => ({ moves: movesOf(item.id), entries: entriesOf(account.id), events: eventCount() });
      const before = facts();
      const race = await raceWrite(ctx, { method: "POST", path: `${STOCK}/${item.id}/moves`, body: { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: account.id, date: TODAY }, during: () => ctx.api.del(`${STOCK}/${item.id}`) });
      assertItemRaceRefused("açık hesap satış", item, race, facts, before);
    });
    await check(outcomes, "peşin satış (nakit)", async () => {
      const item = await newItem("S1 Peşin Ürünü");
      const facts = () => ({ moves: movesOf(item.id), events: eventCount() });
      const before = facts();
      const cash = await cashOf(ctx.api);
      const race = await raceWrite(ctx, { method: "POST", path: `${STOCK}/${item.id}/moves`, body: { kind: "out", qty: 1, unitPrice: 70, pay: "cash", method: "cash", date: TODAY }, during: () => ctx.api.del(`${STOCK}/${item.id}`) });
      assertItemRaceRefused("peşin satış", item, race, facts, before);
      assert.equal(await cashOf(ctx.api), cash, "peşin satış: Kasa değişmez");
    });
    verdict("S1", outcomes);
  });

  it("S2 stok hareketi düzeltme (PUT …/moves/:id): silinmiş ürünün hareketi ve cari borcu değişmez", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "S2 Düzeltme Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
    const item = await newItem("S2 Düzeltme Ürünü");
    const made = await must("satış", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: account.id, date: TODAY }));
    const facts = () => ({ moves: movesOf(item.id), entries: entriesOf(account.id), events: eventCount() });
    const before = facts();
    assert.deepEqual(before.entries, [{ kind: "debt", amount: 50, source: "stock" }], "ön koşul: satış cariye borç yazdı");
    const race = await raceWrite(ctx, { method: "PUT", path: `${STOCK}/${item.id}/moves/${made.moveId}`, body: { unitPrice: 70 }, during: () => ctx.api.del(`${STOCK}/${item.id}`) });
    assertItemRaceRefused("stok düzeltme", item, race, facts, before);
  });

  it("S4 yalnız miktar stok girişi (pay: \"none\"; mobil stok girişi bu gövdeyi gönderir): silinmiş ürüne hareket, stok, Değişiklik Geçmişi yazılmaz", async () => {
    // C1 TUR 2 DÜŞÜK-1 (M3): ürün denetimi para yoluna bağlı değildir — parasız girişte de işlemin içinde yeniden denetlenir.
    const item = await newItem("S4 Yalnız Miktar Ürünü");
    const qtyOf = () => ctx.store.get("SELECT COALESCE(SUM(CASE kind WHEN 'in' THEN qty ELSE -qty END), 0) AS q FROM stock_moves WHERE item_id = ?", item.id).q;
    // Ürünün silinme kaydı (stock.item.deleted) dışında ürüne ait Değişiklik Geçmişi satırları (stock.in / stock.out …).
    const auditOf = () => ctx.store.all("SELECT type FROM audit_events WHERE type <> 'stock.item.deleted' AND (entity_id = ?1 OR payload_json LIKE '%' || ?1 || '%') ORDER BY rowid", item.id).map(row => row.type);
    const facts = () => ({ moves: movesOf(item.id), qty: Number(qtyOf()), audit: auditOf(), events: eventCount() });
    const before = facts();
    assert.equal(before.qty, 10, "ön koşul: açılış stoğu 10");
    const race = await raceWrite(ctx, { method: "POST", path: `${STOCK}/${item.id}/moves`, body: { kind: "in", qty: 5, pay: "none", date: TODAY }, during: () => ctx.api.del(`${STOCK}/${item.id}`) });
    assertItemRaceRefused("yalnız miktar giriş", item, race, facts, before);
  });

  it("S3 yarış yokken aynı uçlar yazar (düzeltme olağan yolu bozmaz)", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "S3 Olağan Müşteri", type: "customer", registeredOn: "2026-09-01" }));
    const item = await newItem("S3 Olağan Ürün");
    const made = await must("satış", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: account.id, date: TODAY }));
    await must("düzelt", ctx.api.put(`${STOCK}/${item.id}/moves/${made.moveId}`, { unitPrice: 70 }));
    assert.deepEqual(entriesOf(account.id), [{ kind: "debt", amount: 70, source: "stock" }]);
    assert.deepEqual(movesOf(item.id).filter(row => row.kind === "out").map(row => row.amount), [70]);
    // C1 TUR 2: yalnız miktar girişi (pay: "none") yarış yokken yazar.
    const inBefore = movesOf(item.id).filter(row => row.kind === "in").length;
    await must("yalnız miktar giriş", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: "in", qty: 5, pay: "none", date: TODAY }));
    const ins = movesOf(item.id).filter(row => row.kind === "in");
    assert.deepEqual([ins.length - inBefore, ins.at(-1).qty, ins.at(-1).pay], [1, 5, "none"], "parasız giriş yazıldı");
  });
});

// C1 TUR 2 DÜŞÜK-1 (M2): taksit kartı tahsilatı düzeltmesinde kart denetimi K8'in "tutar büyüyor" dalına bağlı değildir. KÜÇÜLEN tutar ve yol değişimi
// (nakit → POS) de gövde yoldayken kart silinirse 404 alır ve hiçbir şey yazmaz: tahsilat satırı, işlem başlığı, POS kaydı, Değişiklik Geçmişi
// ("plan.entry.updated") aynen; kart Silinenler'den geri yüklenince tahsilat eski hâliyle (500 nakit) döner, Kasa eski tutarı geri alır.
describe("2.4.9 C1 TUR 2 — taksit kartı tahsilatı düzeltmesi yarışı (zorla): küçülen tutar ve nakit → POS; gövde yoldayken kart silinirse 404, hiçbir şey yazılmaz", () => {
  let ctx;
  let pos;
  before(async () => {
    ctx = await bootBank({ now: NOW });
    const acc = await openAcceptanceAccounts(ctx.api);
    pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id));
  });
  after(async () => ctx?.server.close());

  const newPaidPlan = async name => {
    const account = await must(`cari ${name}`, ctx.api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01" }));
    const plan = await must(`kart ${name}`, ctx.api.post(PLANS, { accountId: account.id, name, total: "6000", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
    const made = await must(`tahsilat ${name}`, ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "500", date: TODAY, method: "cash" }));
    return { plan, entryId: made.entryId };
  };
  const n = (sql, ...args) => ctx.store.get(sql, ...args).n;
  const entryOf = entryId => {
    const row = ctx.store.get("SELECT amount, method, fin_ref AS finRef, event_id AS eventId, updated_at AS updatedAt FROM plan_entries WHERE id = ?", entryId);
    return row ? { amount: Number(row.amount), method: row.method, finRef: row.finRef, eventId: row.eventId, updatedAt: row.updatedAt ?? "" } : "YOK";
  };
  const facts = (planId, entryId) => ({
    entry: entryOf(entryId),
    entries: n("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", planId),
    updatedAudit: n("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'plan.entry.updated' AND entity_id = ?", entryId),
    events: n("SELECT COUNT(*) AS n FROM fin_events"),
    posSales: n("SELECT COUNT(*) AS n FROM pos_sales"),
    bankLines: n("SELECT COUNT(*) AS n FROM bank_lines"),
  });
  const deletedAt = id => ctx.store.get("SELECT deleted_at AS d FROM plans WHERE id = ?", id)?.d ?? "YOK";

  it("Y6 küçülen tutar (500 → 300), yol değişimi (nakit → POS) ve ikisi birlikte: silinmiş kartın tahsilatı değişmez; geri yüklenince 500 nakit döner", async () => {
    const outcomes = [];
    const cases = [
      ["küçülen tutar 500 → 300 (nakit)", () => ({ amount: "300", cashForce: true })],
      ["yol değişimi nakit → POS (500)", () => ({ method: "card", posId: pos.id, posInstallments: 1, authCode: "C1T2Y6B", cashForce: true })],
      ["küçülen tutar ve yol değişimi (500 nakit → 300 POS)", () => ({ amount: "300", method: "card", posId: pos.id, posInstallments: 1, authCode: "C1T2Y6C", cashForce: true })],
    ];
    let index = 0;
    for (const [label, bodyOf] of cases) {
      index += 1;
      await check(outcomes, label, async () => {
        const { plan, entryId } = await newPaidPlan(`Y6 Düzeltme Yarışı ${index}`);
        const cashWith = await cashOf(ctx.api);
        const before = facts(plan.id, entryId);
        assert.deepEqual([before.entry.amount, before.entry.method, before.updatedAudit], [500, "cash", 0], `${label}: ön koşul — 500 nakit tahsilat, düzeltilmemiş`);
        const { reply, removed } = await raceWrite(ctx, { method: "PUT", path: `${PLANS}/${plan.id}/entries/${entryId}`, body: bodyOf(), during: () => ctx.api.del(`${PLANS}/${plan.id}?cashForce=1`) });
        assert.equal(removed?.status, 200, `${label}: ön koşul — kart gövde beklenirken silindi (${removed?.status} ${JSON.stringify(removed?.data || removed?.error?.message || "").slice(0, 160)})`);
        assert.ok(deletedAt(plan.id) && deletedAt(plan.id) !== "YOK", `${label}: ön koşul — kart silinmiş`);
        const after = facts(plan.id, entryId);
        assert.deepEqual(after, before, `${label}: silinmiş kartın tahsilatı değişmemeli (satır, işlem başlığı, POS kaydı, plan.entry.updated aynen) — önce ${JSON.stringify(before)}, sonra ${JSON.stringify(after)}`);
        assert.equal(reply.status, 404, `${label}: yazım reddedilir — ${reply.status} ${reply.text.slice(0, 160)}`);
        assert.match(reply.text, /Taksit kartı bulunamadı/, `${label}: mevcut hata biçimi`);
        // Kart geri yüklenince tahsilat silinme anındaki hâliyle döner: 500 nakit; Kasa silinmeden önceki tutara döner.
        await must(`${label}: Silinenler'den geri yükle`, ctx.api.post("/api/admin/trash/restore", { id: `plan:${plan.id}` }));
        const restored = facts(plan.id, entryId);
        assert.deepEqual([restored.entry.amount, restored.entry.method, restored.updatedAudit], [500, "cash", 0], `${label}: geri yüklenen tahsilat 500 nakit`);
        assert.equal(await cashOf(ctx.api), cashWith, `${label}: geri yüklenince Kasa silinmeden önceki tutar`);
      });
    }
    verdict("Y6", outcomes);
  });

  it("Y7 yarış yokken küçülen tutar ve nakit → POS düzeltmesi yazar (düzeltme olağan yolu bozmaz)", async () => {
    const { plan, entryId } = await newPaidPlan("Y7 Olağan Düzeltme");
    await must("küçült", ctx.api.put(`${PLANS}/${plan.id}/entries/${entryId}`, { amount: "300", cashForce: true }));
    assert.deepEqual([entryOf(entryId).amount, entryOf(entryId).method], [300, "cash"]);
    const posBefore = facts(plan.id, entryId).posSales;
    await must("nakit → POS", ctx.api.put(`${PLANS}/${plan.id}/entries/${entryId}`, { method: "card", posId: pos.id, posInstallments: 1, authCode: "C1T2Y7", cashForce: true }));
    const done = facts(plan.id, entryId);
    assert.deepEqual([done.entry.amount, done.entry.method, done.updatedAudit, done.posSales - posBefore], [300, "card", 2, 1], "300 POS, iki düzeltme kaydı, bir POS kaydı");
  });
});

// Bu describe'daki son test (E2) veri tabanına ham satır yazar (eski veri / elle düzenleme benzetimi); sonrasında yalnız okuma.
describe("2.4.9 C1 TUR 1 — hareket sayacı H14 (banka fişi): POS kaydı yalnız POS İptal İadesi fişinde aranır; fatura kapaması silme engelini hesaplamaz", () => {
  let ctx;
  let acc;
  let pos;
  let bankParty;
  let buyer;
  let feeHeads = [];
  const FEES = 6;
  // Düzeltmeden ÖNCEKİ tanım (eaf6b988 account-movements.mjs vouchersSql): satırı ya da POS kaydı olan, modülsüz (src_table '') ve carinin taraf olduğu fiş.
  const OLD_VOUCHERS = "SELECT COUNT(*) AS n FROM fin_events e WHERE e.party_id = ?1 AND +e.src_table = '' AND (EXISTS (SELECT 1 FROM bank_lines l WHERE l.event_id = e.id) OR EXISTS (SELECT 1 FROM pos_sales s WHERE s.event_id = e.id))";
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id));
    bankParty = await must("banka carisi", ctx.api.post(ACC, { name: "Ziraat Bankası A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
    // Programın kendi yolu: KDV'li EFT masraf fişleri (fatura + satırsız başlık — vouchers.mjs writeSpec), gerçek POS tahsilatları ve POS'lu fatura.
    for (let i = 1; i <= FEES; i += 1) {
      const fee = await must(`KDV'li masraf ${i}`, ctx.api.post(`${BANK}/vouchers`, { type: "fee", accountId: acc.ziraat.id, amount: String(100 + i), feeType: "eft", tax: "vat_incl", partyId: bankParty.id, invoiceNo: `C1T1-${i}`, date: TODAY, similarOk: true }));
      feeHeads.push(fee.id);
    }
    const payer = await must("POS müşterisi", ctx.api.post(ACC, { name: "E POS Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
    for (let i = 1; i <= 3; i += 1) await must(`POS tahsilatı ${i}`, ctx.api.post(`${ACC}/${payer.id}/entries`, { kind: "in", amount: String(400 + i), method: "card", posId: pos.id, posInstallments: 1, authCode: `C1T1${i}`, date: TODAY }));
    buyer = await must("POS iadeli", ctx.api.post(ACC, { name: "E POS İadeli", type: "customer", registeredOn: "2026-09-01" }));
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "C1T1", name: "C1 Tur1 Ürünü", unit: "Adet", openingQty: "10" }));
    const invoice = await must("POS'lu fatura", posInvoice(ctx.api, { accountId: buyer.id, itemId: item.id, name: "C1 Tur1 Ürünü", qty: 1, unitPrice: 1200, date: TODAY, posId: pos.id }));
    // Provizyon günü geçince fatura silme POS İptal İadesi yapar (pos.mjs cancelRefund). Saat geri alınmaz.
    ctx.server.clock.set("2026-10-09T10:00:00+03:00");
    await must("faturayı sil (Müşteriye İade Edildi)", ctx.api.del(`/api/workspace/invoices/${invoice.id}?reason=C1T1`));
  });
  after(async () => ctx?.server.close());

  it("E1 eşdeğerlik: her carinin banka fişi sayısı düzeltmeden önceki tanımla birebir aynı (POS İptal İadesi fişli cari, masraf fişli banka carisi dahil)", () => {
    const facts = ctx.store.get("SELECT (SELECT COUNT(*) FROM fin_events WHERE type = 'pos_cancel_refund' AND party_id = ?1) AS cancel, (SELECT COUNT(*) FROM fin_events WHERE type = 'fee' AND src_table = '' AND party_id = ?2) AS fees, (SELECT COUNT(*) FROM pos_sales) AS sales", buyer.id, bankParty.id);
    assert.deepEqual({ ...facts }, { cancel: 1, fees: FEES, sales: 5 }, "ön koşul: 1 İptal İadesi fişi, 6 satırsız masraf başlığı, 3 tahsilat + 1 satış + 1 iptal iadesi POS kaydı");
    const ids = ctx.store.all("SELECT id FROM accounts").map(row => row.id);
    assert.ok(ids.length >= 3, "ön koşul: banka carisi, POS müşterisi, POS iadeli cari");
    for (const id of ids) {
      const now = accountMovements(ctx.store, id).counts.vouchers;
      assert.equal(now, ctx.store.get(OLD_VOUCHERS, id).n, `banka fişi sayısı eski tanımla aynı (${id})`);
      assert.deepEqual(accountMovements(ctx.store, id, { includeDeleted: true }).counts, accountMovements(ctx.store, id).counts, `kalıcı silme sayımı aynı sayaçları verir (${id})`);
    }
    // Elle sayım: İptal İadesi fişi carinin tek hareketi; banka carisinin masraf başlıkları satırsız (tutarı faturasında: 6 fatura).
    assert.deepEqual(accountMovements(ctx.store, buyer.id).counts.vouchers, 1, "POS İptal İadesi fişi banka fişi sayılır (İLKEYLE H14)");
    assert.deepEqual([accountMovements(ctx.store, bankParty.id).counts.vouchers, accountMovements(ctx.store, bankParty.id).counts.invoices], [0, FEES], "masraf başlığı sayılmaz, faturaları sayılır");
  });

  it("E3 fatura listesi (ödeme durumu: cari defteri, withRemaining: false) hareket sayacını çalıştırmaz; cari kartının Sil nedeni aynen", async () => {
    const get = ctx.store.get;
    let counted = 0;
    ctx.store.get = function spy(sql, ...args) {
      if (String(sql).includes("AS allEntries")) counted += 1;
      return get.call(this, sql, ...args);
    };
    let list;
    try {
      list = await must("fatura listesi", ctx.api.get("/api/workspace/invoices?limit=50"));
    } finally {
      ctx.store.get = get;
    }
    assert.ok(list.items?.length || list.rows?.length || list.total, `ön koşul: listede fatura var ${JSON.stringify(Object.keys(list))}`);
    assert.equal(counted, 0, "fatura listesinin cari defteri okuması silme engelini (hareket sayacı) hesaplamamalı");
    const auditor = { id: "c1-tur1", role: "admin", permissions: [] };
    assert.equal(ctx.app.context.accounts.detail(bankParty.id, auditor, { withRemaining: false }).deleteBlock, "", "yalnız defter okuması: silme engeli yok");
    const card = await must("cari kartı", ctx.api.get(`${ACC}/${bankParty.id}`));
    assert.match(card.deleteBlock, /^Bu carinin .*6 fatura.* var\./, "kart açılışında Sil nedeni aynen (hareket sayacı kartta çalışır)");
  });

  it("E2 satırsız KDV'li masraf başlığı POS kaydına bakılmadan sayılmaz (tarama yalnız POS İptal İadesi fişinde — ders 47); son test: ham satır", () => {
    // Elle düzenleme / bozuk veri benzetimi: bir masraf başlığına bağlı (iptal edilmiş) POS kaydı. Doğru veride olmaz (pos_sales.event_id = modül olayı ya da
    // İptal İadesi fişi; pos.mjs mutabakatı "İptal İadesinin başlığı pos_cancel_refund değil"). Eski tanım bu başlığı POS kaydı yüzünden tarar ve sayardı.
    const columns = ctx.store.all("PRAGMA table_info(pos_sales)").map(row => row.name);
    const source = ctx.store.get("SELECT id FROM pos_sales WHERE kind = 'sale' ORDER BY rowid LIMIT 1").id;
    const values = columns.map(name => (name === "id" ? "'ps-c1t1-yapay'" : name === "event_id" ? "?" : name === "status" ? "'void'" : name));
    rawRun(ctx.db, `INSERT INTO pos_sales (${columns.join(", ")}) SELECT ${values.join(", ")} FROM pos_sales WHERE id = ?`, feeHeads[0], source);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM pos_sales WHERE event_id = ?", feeHeads[0]).n, 1, "ön koşul: masraf başlığına bağlı POS kaydı var");
    assert.equal(accountMovements(ctx.store, bankParty.id).counts.vouchers, 0, "masraf başlığı (fee) POS kaydı taşısa da banka fişi sayılmaz: POS kaydı yalnız İptal İadesi fişinde aranır");
    assert.equal(accountMovements(ctx.store, buyer.id).counts.vouchers, 1, "İptal İadesi fişi yine sayılır");
  });
});
