// 2.4.2 (kullanıcı denemesi 17.10.2026, gerçek EDM test ortamı): TEA2026000000001 gönderilince EDM "Daha önce gönderdiğiniz bir faturayı tekrar
// göndermeye çalıştınız (11048)" dedi — EDM'nin test hesabı ORTAKTIR, 1'den başlayan test numarası başka firmanınkiyle çakışır; belge "Hata"da kaldı,
// İptal Et EDM'ye gidip "Fatura bulunamadı (11017)" ile düştü, Sil de kapalıydı (belge takıldı). Kullanıcı: "e-Faturada da olabilir aynısı, e-SMM'de de".
// "Nasıl bozulur?": her kurulum test serisine 1'den başlar; eski kurulumda TEA…001 zaten varken sıradaki 2 de çakışır; başlangıç her önizlemede
// değişir (önizleme ↔ kayıt numarası ayrışır); kısmi ayar kaydı başlangıçları siler; EDM'de olmayan "Hata"daki belge iptal edilemez.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const year = () => new Date().getFullYear();
const seqOf = number => Number(String(number).slice(7));
const SETTINGS = "/api/workspace/invoices/settings";

async function boot(edm, options) {
  const server = await startTestServer({ edocEnabled: true, ...options });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  return { server, api };
}
async function setup(api, edm) {
  const saved = await api.put(SETTINGS, {
    seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
    efatura: true,
    earsiv: true,
    integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const account = async body => {
    const response = await api.post("/api/workspace/accounts", body);
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.id || response.data.account?.id;
  };
  return {
    buyerId: await account({ name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }),
    personId: await account({ name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka" }),
  };
}
const sale = (api, accountId, price = 100) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: price, vatRate: 20 }], payment: { rest: "open" } });

describe("Test serisi üretimde firmaya özgü büyük numaradan başlar (EDM test hesabı ortak)", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "ebelge-242-"));
  const dataDir = path.join(root, "data");
  let edm;
  let ctx;
  let ids;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    ctx = await boot(edm, { dataDir, testSeriesStart: null }); // üretimdeki gibi
    ids = await setup(ctx.api, edm);
  });
  after(async () => {
    await ctx?.server.close();
    await edm?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("TEF, TEA (ve e-SMM açıkken TES) 1'den başlamaz; ayar ekranında görünen numara ile kaydedilen aynı, sonraki +1", async () => {
    const s = (await ctx.api.get(SETTINGS)).data;
    for (const key of ["efatura", "earsiv"]) {
      assert.ok(seqOf(s.testNumbers[key].number) > 100_000_000, `${key}: ${s.testNumbers[key].number} (1'den başlamamalı)`);
    }
    const again = (await ctx.api.get(SETTINGS)).data;
    assert.equal(again.testNumbers.earsiv.number, s.testNumbers.earsiv.number, "başlangıç kalıcı (her okumada değişmez)");
    const efatura = (await sale(ctx.api, ids.buyerId)).data;
    const earsiv = (await sale(ctx.api, ids.personId)).data;
    assert.equal(efatura.number, s.testNumbers.efatura.number);
    assert.equal(earsiv.number, s.testNumbers.earsiv.number);
    assert.equal(seqOf((await sale(ctx.api, ids.personId)).data.number), seqOf(earsiv.number) + 1);
    assert.equal(s.nextNumbers.efatura.number, `EFT${year()}000000001`, "firmanın kendi (canlı) serisi 1'den başlar");
  });

  test("kısmi ayar kaydı (yalnız bir seri) öbür serilerin başlangıcını silmez", async () => {
    const before = (await ctx.api.get(SETTINGS)).data.testNumbers.efatura.number;
    assert.equal((await ctx.api.put(SETTINGS, { start: { [`FIS${year()}`]: 50 } })).status, 200);
    assert.equal((await ctx.api.get(SETTINGS)).data.testNumbers.efatura.number, before);
  });

  test("test serisinin sıradaki numarası elle ileri alınabilir", async () => {
    const current = seqOf((await ctx.api.get(SETTINGS)).data.testNumbers.earsiv.number);
    assert.equal((await ctx.api.put(SETTINGS, { start: { [`TEA${year()}`]: current + 1000 } })).status, 200);
    assert.equal(seqOf((await ctx.api.get(SETTINGS)).data.testNumbers.earsiv.number), current + 1000);
  });
});

describe("Eski kurulum: TEA…001 zaten kesilmişken sıradaki numara da büyük başlangıçtan", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "ebelge-242-eski-"));
  const dataDir = path.join(root, "data");
  let edm;
  let ctx;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    const old = await boot(edm, { dataDir }); // 2.4.1 gibi: 1'den
    const ids = await setup(old.api, edm);
    assert.equal((await sale(old.api, ids.personId)).data.number, `TEA${year()}000000001`);
    await old.server.close();
    ctx = await boot(edm, { dataDir, testSeriesStart: null });
    // 2.4.1 başlangıcı ayara yazmazdı (yalnız MAX(seq)+1); helpers'ın sabit 1'i yazdığı kaydı silinir → gerçek 2.4.1 verisi.
    const stored = JSON.parse(ctx.server.app.store.setting("invoice.settings", "{}"));
    delete stored.start;
    ctx.server.app.store.setSetting("invoice.settings", JSON.stringify(stored));
    ctx.ids = ids;
  });
  after(async () => {
    await ctx?.server.close();
    await edm?.close();
    rmSync(root, { recursive: true, force: true });
  });
  test("sıradaki TEA numarası 2 değil, büyük başlangıç", async () => {
    const next = (await sale(ctx.api, ctx.ids.personId)).data.number;
    assert.ok(seqOf(next) > 100_000_000, next);
  });
});

describe("EDM'nin kabul etmediği (Hata) belge iptal edilir; 11048 iletisi yol gösterir", () => {
  let edm;
  let ctx;
  let ids;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    ctx = await boot(edm, {}); // numara 1'den (kullanıcının 2.4.1 durumu)
    ids = await setup(ctx.api, edm);
    edm.state.usedIds.add(`TEA${year()}000000001`);
    edm.state.usedIds.add(`TEF${year()}000000001`);
  });
  after(async () => {
    await ctx?.server.close();
    await edm?.close();
  });
  for (const [label, key] of [["e-Arşiv", "personId"], ["e-Fatura", "buyerId"]]) {
    test(`${label}: gönderim 11048 → Hata + yol gösteren ileti; İptal Et belgeyi programda iptal eder`, async () => {
      const doc = (await sale(ctx.api, ids[key])).data;
      const sent = await ctx.api.post(`/api/workspace/invoices/${doc.id}/send`, {});
      assert.notEqual(sent.status, 200);
      const message = JSON.stringify(sent.data);
      assert.match(message, /11048/);
      assert.match(message, /ortak/, "test hesabının ortak olduğu söylenir");
      assert.match(message, /İptal/, "ne yapılacağı söylenir");
      const card = (await ctx.api.get(`/api/workspace/invoices/${doc.id}`)).data;
      assert.equal(card.eStatus, "error");
      const cancelled = await ctx.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Numara çakıştı" });
      assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
      assert.equal(cancelled.data.status, "cancelled");
    });
  }
});
