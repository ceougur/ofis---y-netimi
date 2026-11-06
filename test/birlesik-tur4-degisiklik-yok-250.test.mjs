// 2.5.0 BİRLEŞİK TUR 4 — tur 3 dar kontrolü ORTA-1 (gerileme; sakınca süzgeci): taksit düzelt (PUT /plans/:id/items/:itemId), taksit kartı (PUT /plans/:id) ve stok kartı
// (PUT /stock/:id) iyimser kilit aldıktan sonra (birleşik tur 3, a7118763) istek kimliği ve "değişiklik yok" kısa yolu taşımıyordu: yanıtı kopan KENDİ kaydının
// yeniden gönderimi (aynı form, formun eski sürümü) 409 "değişikliğiniz kaydedilmedi" alıyordu — kayıt yazılmıştı (dar kontrol betiği p3-yineleme: tur 3 kodunda
// 2. gönderim 409, 3360687f'de 200). Düzeltme (Kasa açılışındaki desen, routes/cash.mjs): yazım işleminin İÇİNDE, GÜNCEL satırla ve sürüm denetiminden ÖNCE — birleşmiş
// girdi yazılacak her alanda güncel satırla aynıysa hiçbir şey yazılmaz, 200 + güncel kayıt (lib/row-version.mjs sameFields).
// Dişler: (1) yanıtı kopan kendi kaydı → 200, tek yazım (Değişiklik Geçmişi ve sürüm ilerlemez); (2) öbür kişi FARKLI değer girdiyse yine 409 (koruma bozulmaz);
// (3) öbür kişi AYNI içeriği kaydetmişse 200, ikinci yazım yok; (4) gövde yoldayken öbür kişi değiştirir, A'nın gövdesi formun açıldığı hâliyle aynı → 409 (kısa yol
// isteğin başında okunan satırla değil, işlemin içindeki güncel satırla karşılaştırır); (5) kısa yol farklı içeriği "aynı" saymaz (her alan tek tek).
// Saat AKAN sahte saat (sabit saatte iki yazımın damgası aynı olurdu). Lisans servisi ölü adres (ders 30).
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";
import { apiOf, boot, must } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const PAST = "2026-09-01";
const ACC = "/api/workspace/accounts";
const STOCK = "/api/workspace/stock";
const PLANS = "/api/workspace/plans";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Yarış (zorla): başlıklar gider, gövde bekletilir; `during` BİTER, sonra gövde gönderilir. */
async function raceWrite(ctx, { method = "PUT", path, body, during }) {
  const text = JSON.stringify(body);
  const { port } = new URL(ctx.server.base);
  let mid = null;
  const reply = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers: { cookie: ctx.api.client.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = { error: data };
        }
        resolve({ status: res.statusCode, body: parsed || {} });
      });
    });
    req.on("error", reject);
    req.flushHeaders();
    setTimeout(async () => {
      try {
        mid = await during();
      } catch (error) {
        mid = { status: 0, error };
      }
      req.end(text);
    }, 300);
  });
  return { reply, mid };
}

async function world() {
  const ctx = await boot({ now: { time: NOW }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  ctx.other = apiOf(await createUser(ctx.server, ctx.api.client, { username: "tur4yon", role: "admin", password: "Yonetici-Dort-2026!" }));
  let seq = 0;
  ctx.next = () => (seq += 1);
  ctx.audits = (type, ref) => ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = ? AND entity_id = ?", type, ref)?.n ?? -1;
  return ctx;
}

async function makePlan(ctx, total = "1000") {
  const account = await must("cari", ctx.api.post(ACC, { name: `Tur4 Cari ${ctx.next()}`, type: "customer", registeredOn: PAST }));
  return must("kart", ctx.api.post(PLANS, { accountId: account.id, name: `Tur4 Kart ${ctx.next()}`, total, mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: PAST }));
}
// Formların gövdeleri (istemcinin gönderdiği tam form; tur 3 testiyle aynı).
const planForm = p => ({ name: p.name, refNo: p.refNo, registeredOn: p.registeredOn, phone: p.phone || "", total: String(p.total), note: p.note || "", caseKey: p.caseKey || "", caseSource: p.caseSource || "", caseTitle: p.caseTitle || "", accountId: p.accountId, groupId: p.groupId || "", subgroupId: p.subgroupId || "", updatedAt: p.updatedAt || "" });
const itemForm = (item, change = {}) => ({ dueDate: item.dueDate, amount: String(item.amount), note: item.note || "", updatedAt: item.updatedAt || "", ...change });
async function makeStock(ctx) {
  return must("ürün", ctx.api.post(STOCK, { name: `Tur4 Ürün ${ctx.next()}`, unit: "Adet", unitPrice: "10", salePrice: "15" }));
}
const stockForm = s => ({ kind: s.kind, code: s.code || "", name: s.name, unit: s.unit, category: s.category || "", minQty: s.minQty ? String(s.minQty) : "", unitPrice: String(s.unitPrice || ""), salePrice: String(s.salePrice || ""), vatRate: s.vatRate ?? "", note: s.note || "", updatedAt: s.updatedAt || "" });

describe("2.5.0 BİRLEŞİK TUR 4 — taksit düzelt: 'değişiklik yok' kısa yolu", () => {
  let ctx;
  before(async () => {
    ctx = await world();
  });
  after(async () => ctx?.server.close());
  const row = id => ({ ...ctx.store.get("SELECT amount, due_date AS dueDate, note, updated_at AS updatedAt FROM plan_items WHERE id = ?", id) });

  test("yanıtı kopan kendi düzeltmesi: aynı gövde (formun eski sürümü) ikinci kez → 200; tek yazım — Değişiklik Geçmişi 1, sürüm ilerlemez", async () => {
    const plan = await makePlan(ctx);
    const item = plan.items[0];
    await sleep(5);
    const body = itemForm(item, { amount: "450", note: "yineleme" });
    await must("1. gönderim (yanıt koptu)", ctx.api.put(`${PLANS}/${plan.id}/items/${item.id}`, body));
    const first = row(item.id);
    await sleep(5);
    const again = await ctx.api.put(`${PLANS}/${plan.id}/items/${item.id}`, body);
    assert.equal(again.status, 200, `aynı gövdenin yeniden gönderimi 200 almalı (gelen ${again.status} ${again.data?.code || ""}: ${again.error || ""})`);
    assert.equal(again.data.items.find(entry => entry.id === item.id)?.updatedAt, first.updatedAt, "yanıt güncel kartı taşır (taksitin sürümü)");
    assert.deepEqual(row(item.id), first, "ikinci gönderim hiçbir şey yazmadı (sürüm aynı)");
    assert.equal(ctx.audits("plan.item.updated", item.id), 1, "Değişiklik Geçmişi'nde tek düzeltme kaydı");
  });

  test("koruma bozulmaz: yanıt koptuktan sonra B FARKLI değer girer → A'nın aynı gövdeli yeniden gönderimi 409, B'nin değeri durur", async () => {
    const plan = await makePlan(ctx);
    const item = plan.items[0];
    await sleep(5);
    const body = itemForm(item, { amount: "450" });
    await must("A 1. gönderim", ctx.api.put(`${PLANS}/${plan.id}/items/${item.id}`, body));
    const fresh = (await must("B kartı okur", ctx.other.get(`${PLANS}/${plan.id}`))).items.find(entry => entry.id === item.id);
    await sleep(5);
    await must("B 300", ctx.other.put(`${PLANS}/${plan.id}/items/${item.id}`, itemForm(fresh, { amount: "300" })));
    const again = await ctx.api.put(`${PLANS}/${plan.id}/items/${item.id}`, body);
    assert.equal(again.status, 409, `gelen ${again.status}; veri tabanında ${JSON.stringify(row(item.id))}`);
    assert.equal(again.data?.code, "plan-item-stale");
    assert.equal(row(item.id).amount, 300);
  });

  test("aynı içerik: A formu açar, B taksiti 300 yapar, A da (eskimiş formla) 300 kaydeder → 200, A hiçbir şey yazmaz", async () => {
    const plan = await makePlan(ctx);
    const item = plan.items[0];
    await sleep(5);
    await must("B 300", ctx.other.put(`${PLANS}/${plan.id}/items/${item.id}`, itemForm(item, { amount: "300" })));
    const byB = row(item.id);
    await sleep(5);
    const res = await ctx.api.put(`${PLANS}/${plan.id}/items/${item.id}`, itemForm(item, { amount: "300" }));
    assert.equal(res.status, 200, `aynı içerik 200 (gelen ${res.status} ${res.data?.code || ""})`);
    assert.deepEqual(row(item.id), byB, "B'nin yazımı tek");
    assert.equal(ctx.audits("plan.item.updated", item.id), 1);
  });

  test("GÖVDE YOLDAYKEN: A'nın gövdesi formun açıldığı hâliyle AYNI, B arada değiştirir → 409 (kısa yol güncel taksitle karşılaştırır, isteğin başındakiyle değil)", async () => {
    const plan = await makePlan(ctx);
    const item = plan.items[0];
    await sleep(5);
    const race = await raceWrite(ctx, {
      path: `${PLANS}/${plan.id}/items/${item.id}`,
      body: itemForm(item),
      during: async () => ctx.other.put(`${PLANS}/${plan.id}/items/${item.id}`, itemForm(item, { amount: "250" })),
    });
    assert.equal(race.mid.status, 200, "ön koşul: B'nin düzeltmesi gövde yoldayken bitti");
    assert.equal(race.reply.status, 409, `gelen ${race.reply.status}; veri tabanında ${JSON.stringify(row(item.id))}`);
    assert.equal(race.reply.body?.code, "plan-item-stale");
    assert.equal(row(item.id).amount, 250);
  });

  test("her alan tek tek: eskimiş formda yalnız vade ya da yalnız açıklama farklıysa 409 (farklı içerik 'aynı' sayılmaz)", async () => {
    const plan = await makePlan(ctx);
    const item = plan.items[0];
    await sleep(5);
    await must("B 300", ctx.other.put(`${PLANS}/${plan.id}/items/${item.id}`, itemForm(item, { amount: "300" })));
    for (const change of [{ amount: "300", dueDate: "2026-11-03" }, { amount: "300", note: "A" }]) {
      const res = await ctx.api.put(`${PLANS}/${plan.id}/items/${item.id}`, itemForm(item, change));
      assert.equal(res.status, 409, `${JSON.stringify(change)} → gelen ${res.status}`);
    }
    assert.deepEqual({ amount: row(item.id).amount, dueDate: row(item.id).dueDate, note: row(item.id).note }, { amount: 300, dueDate: item.dueDate, note: "" });
  });
});

describe("2.5.0 BİRLEŞİK TUR 4 — taksit kartı: 'değişiklik yok' kısa yolu", () => {
  let ctx;
  before(async () => {
    ctx = await world();
  });
  after(async () => ctx?.server.close());
  const row = id => ({ ...ctx.store.get("SELECT total, note, name, status, updated_at AS updatedAt FROM plans WHERE id = ?", id) });

  test("yanıtı kopan kendi kaydı: aynı form ikinci kez → 200; tek yazım — Değişiklik Geçmişi 1, sürüm ilerlemez", async () => {
    const plan = await makePlan(ctx);
    await sleep(5);
    const body = { ...planForm(plan), note: "kart yineleme" };
    await must("1. gönderim (yanıt koptu)", ctx.api.put(`${PLANS}/${plan.id}`, body));
    const first = row(plan.id);
    await sleep(5);
    const again = await ctx.api.put(`${PLANS}/${plan.id}`, body);
    assert.equal(again.status, 200, `aynı formun yeniden gönderimi 200 almalı (gelen ${again.status} ${again.data?.code || ""}: ${again.error || ""})`);
    assert.equal(again.data.updatedAt, first.updatedAt, "yanıt güncel kartı taşır");
    assert.deepEqual(row(plan.id), first, "ikinci gönderim hiçbir şey yazmadı");
    assert.equal(ctx.audits("plan.updated", plan.id), 1, "Değişiklik Geçmişi'nde tek düzenleme kaydı");
  });

  test("koruma bozulmaz: yanıt koptuktan sonra B tutarı 1.200 yapar → A'nın yeniden gönderimi 409, 1.200 durur", async () => {
    const plan = await makePlan(ctx);
    await sleep(5);
    const body = { ...planForm(plan), note: "A notu" };
    await must("A 1. gönderim", ctx.api.put(`${PLANS}/${plan.id}`, body));
    const fresh = await must("B kartı okur", ctx.other.get(`${PLANS}/${plan.id}`));
    await sleep(5);
    await must("B 1.200", ctx.other.put(`${PLANS}/${plan.id}`, { ...planForm(fresh), total: "1200" }));
    const again = await ctx.api.put(`${PLANS}/${plan.id}`, body);
    assert.equal(again.status, 409, `gelen ${again.status}; veri tabanında ${JSON.stringify(row(plan.id))}`);
    assert.equal(again.data?.code, "plan-stale");
    assert.equal(row(plan.id).total, 1200);
  });

  test("aynı içerik: B notu 'ortak' yapar, A da eskimiş formla 'ortak' kaydeder → 200, A yazmaz; Kartı Kapat iki kez → ikincisi yazmaz", async () => {
    const plan = await makePlan(ctx);
    await sleep(5);
    await must("B not", ctx.other.put(`${PLANS}/${plan.id}`, { ...planForm(plan), note: "ortak" }));
    const byB = row(plan.id);
    await sleep(5);
    const res = await ctx.api.put(`${PLANS}/${plan.id}`, { ...planForm(plan), note: "ortak" });
    assert.equal(res.status, 200, `aynı içerik 200 (gelen ${res.status} ${res.data?.code || ""})`);
    assert.deepEqual(row(plan.id), byB);
    assert.equal(ctx.audits("plan.updated", plan.id), 1);
    await must("Kartı Kapat", ctx.api.put(`${PLANS}/${plan.id}`, { status: "closed" }));
    const closed = row(plan.id);
    await sleep(5);
    await must("Kartı Kapat (yinelenen)", ctx.api.put(`${PLANS}/${plan.id}`, { status: "closed" }));
    assert.deepEqual(row(plan.id), closed, "kapalı karta yinelenen Kartı Kapat yazmaz");
    assert.equal(ctx.audits("plan.updated", plan.id), 2);
  });

  test("GÖVDE YOLDAYKEN: A'nın formu açıldığı hâliyle AYNI, B arada tutarı değiştirir → 409", async () => {
    const plan = await makePlan(ctx);
    await sleep(5);
    const race = await raceWrite(ctx, {
      path: `${PLANS}/${plan.id}`,
      body: planForm(plan),
      during: async () => ctx.other.put(`${PLANS}/${plan.id}`, { ...planForm(plan), total: "1300" }),
    });
    assert.equal(race.mid.status, 200, "ön koşul: B'nin düzeltmesi gövde yoldayken bitti");
    assert.equal(race.reply.status, 409, `gelen ${race.reply.status}; veri tabanında ${JSON.stringify(row(plan.id))}`);
    assert.equal(race.reply.body?.code, "plan-stale");
    assert.equal(row(plan.id).total, 1300);
  });

  test("carisiz eski kart (göç öncesinden kalma): değişmemiş form da kısa yola girmez — ilk düzenlemede cari açılır (önceki davranış)", async () => {
    const plan = await makePlan(ctx);
    ctx.store.run("UPDATE plans SET account_id = '' WHERE id = ?", plan.id);
    const legacy = await must("kart", ctx.api.get(`${PLANS}/${plan.id}`));
    assert.equal(legacy.accountId, "", "ön koşul: kartın carisi yok");
    const res = await ctx.api.put(`${PLANS}/${plan.id}`, planForm(legacy));
    assert.equal(res.status, 200, `gelen ${res.status} ${res.error || ""}`);
    const after = ctx.store.get("SELECT account_id AS accountId FROM plans WHERE id = ?", plan.id).accountId;
    assert.ok(after, `kartın carisi açıldı (account_id ${JSON.stringify(after)})`);
  });

  test("her alan tek tek: B tutarı değiştirdi; A'nın eskimiş formu tutarı B'ninkiyle aynı, yalnız adı / telefonu / Sıra No'su farklı → 409", async () => {
    const plan = await makePlan(ctx);
    await sleep(5);
    await must("B 1.100", ctx.other.put(`${PLANS}/${plan.id}`, { ...planForm(plan), total: "1100" }));
    for (const change of [{ name: `${plan.name} A` }, { phone: "0532 250 44 55" }, { refNo: "77" }]) {
      const res = await ctx.api.put(`${PLANS}/${plan.id}`, { ...planForm(plan), total: "1100", ...change });
      assert.equal(res.status, 409, `${JSON.stringify(change)} → gelen ${res.status}`);
    }
    assert.deepEqual({ total: row(plan.id).total, name: row(plan.id).name }, { total: 1100, name: plan.name });
  });
});

describe("2.5.0 BİRLEŞİK TUR 4 — stok kartı: 'değişiklik yok' kısa yolu", () => {
  let ctx;
  before(async () => {
    ctx = await world();
  });
  after(async () => ctx?.server.close());
  const row = id => ({ ...ctx.store.get("SELECT sale_price AS salePrice, unit_price AS unitPrice, note, vat_rate AS vatRate, updated_at AS updatedAt FROM stock_items WHERE id = ?", id) });

  test("yanıtı kopan kendi kaydı: aynı form ikinci kez → 200; tek yazım — Değişiklik Geçmişi 1, sürüm ilerlemez", async () => {
    const item = await makeStock(ctx);
    await sleep(5);
    const body = { ...stockForm(item), salePrice: "18", vatRate: "20" };
    await must("1. gönderim (yanıt koptu)", ctx.api.put(`${STOCK}/${item.id}`, body));
    const first = row(item.id);
    await sleep(5);
    const again = await ctx.api.put(`${STOCK}/${item.id}`, body);
    assert.equal(again.status, 200, `aynı formun yeniden gönderimi 200 almalı (gelen ${again.status} ${again.data?.code || ""}: ${again.error || ""})`);
    assert.equal(again.data.updatedAt, first.updatedAt, "yanıt güncel kartı taşır");
    assert.deepEqual(row(item.id), first, "ikinci gönderim hiçbir şey yazmadı");
    assert.equal(ctx.audits("stock.item.updated", item.id), 1, "Değişiklik Geçmişi'nde tek düzenleme kaydı");
  });

  test("koruma bozulmaz: yanıt koptuktan sonra B fiyatlı ALIM girer (Alış Fiyatı 10 → 12) → A'nın yeniden gönderimi 409, 12 durur", async () => {
    const item = await makeStock(ctx);
    await sleep(5);
    const body = { ...stockForm(item), note: "A notu" };
    await must("A 1. gönderim", ctx.api.put(`${STOCK}/${item.id}`, body));
    await sleep(5);
    await must("B alım 12", ctx.other.post(`${STOCK}/${item.id}/moves`, { kind: "in", qty: 1, unitPrice: "12", pay: "none", date: "2026-10-08" }));
    const again = await ctx.api.put(`${STOCK}/${item.id}`, body);
    assert.equal(again.status, 409, `gelen ${again.status}; veri tabanında ${JSON.stringify(row(item.id))}`);
    assert.equal(again.data?.code, "stock-item-stale");
    assert.equal(row(item.id).unitPrice, 12);
  });

  test("aynı içerik: B Satış Fiyatı'nı 20 yapar, A da eskimiş formla 20 kaydeder → 200, A yazmaz", async () => {
    const item = await makeStock(ctx);
    await sleep(5);
    await must("B 20", ctx.other.put(`${STOCK}/${item.id}`, { ...stockForm(item), salePrice: "20" }));
    const byB = row(item.id);
    await sleep(5);
    const res = await ctx.api.put(`${STOCK}/${item.id}`, { ...stockForm(item), salePrice: "20" });
    assert.equal(res.status, 200, `aynı içerik 200 (gelen ${res.status} ${res.data?.code || ""})`);
    assert.deepEqual(row(item.id), byB);
    assert.equal(ctx.audits("stock.item.updated", item.id), 1);
  });

  test("GÖVDE YOLDAYKEN: A'nın formu açıldığı hâliyle AYNI, B arada Satış Fiyatı'nı değiştirir → 409", async () => {
    const item = await makeStock(ctx);
    await sleep(5);
    const race = await raceWrite(ctx, {
      path: `${STOCK}/${item.id}`,
      body: stockForm(item),
      during: async () => ctx.other.put(`${STOCK}/${item.id}`, { ...stockForm(item), salePrice: "25" }),
    });
    assert.equal(race.mid.status, 200, "ön koşul: B'nin düzeltmesi gövde yoldayken bitti");
    assert.equal(race.reply.status, 409, `gelen ${race.reply.status}; veri tabanında ${JSON.stringify(row(item.id))}`);
    assert.equal(race.reply.body?.code, "stock-item-stale");
    assert.equal(row(item.id).salePrice, 25);
  });

  test("her alan tek tek: B Satış Fiyatı'nı 20 yaptı; A'nın eskimiş formu 20 ile aynı, yalnız KDV oranı / Alış Fiyatı / not farklı → 409", async () => {
    const item = await makeStock(ctx);
    await sleep(5);
    await must("B 20", ctx.other.put(`${STOCK}/${item.id}`, { ...stockForm(item), salePrice: "20" }));
    for (const change of [{ vatRate: "10" }, { unitPrice: "11" }, { note: "A" }]) {
      const res = await ctx.api.put(`${STOCK}/${item.id}`, { ...stockForm(item), salePrice: "20", ...change });
      assert.equal(res.status, 409, `${JSON.stringify(change)} → gelen ${res.status}`);
    }
    assert.deepEqual({ salePrice: row(item.id).salePrice, unitPrice: row(item.id).unitPrice, note: row(item.id).note, vatRate: row(item.id).vatRate }, { salePrice: 20, unitPrice: 10, note: "", vatRate: null });
  });
});
