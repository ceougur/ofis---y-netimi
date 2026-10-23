// 2.4.4 r31e N1 (31e bağımsız dar kontrol, ORTA; karar 23.10.2026 03:12 UTC, kullanıcının 5 dk yetkisiyle): kâğıt / fiş / SMM / iç seride silinen belgenin
// NUMARASI kullanılmış kalır (E6 aynen), TARİHİ numara–tarih sırası tabanını BAĞLAMAZ. Önceki davranış (aday 11): fiş 1 bugün−5, fiş 2 yanlışlıkla bugün tarihli
// kesilip silinir, bugün−3 tarihli yeni fiş 400 "son belge FIS…002 (belge silindi; numara kullanılmış sayılır) … daha eski tarihli kaydedilemez" — çıkış yolu
// yoktu (Silinenler'den dönen belge de sırayı tutar, Numaralar yalnız ileri alır); v32 2.4.3'te silinmiş belgelerin tarihini de tabana yazıyordu.
// Silinen belgenin geri yüklenmesi sırayı bozacaksa 409 invoice-restore-chronology; belge Silinenler'de kalır. Sıra: numara (kalıcı) → kilit → sıra-tarih.
// e-Belge serileri bu kuralın DIŞINDA (değişmez).
//
// NASIL BOZULUR (koddan ÖNCE yazıldı; kanıt klasörü docs/kanit/2026-10-23/r31e-n1/NASIL-BOZULUR.md):
//  1. N1 kökü: bugün−3 yeni fiş 200 FIS…003 (002 yeniden verilmez); bugün−6 → 400 (canlı FIS…001'den eski)                        → A1
//  2. toplu silme: en geç tarihli silinen belge seriyi o güne bağlamaz; kâğıt makbuz (SMM) serisi de                             → A2
//  3. altta e-Belgeye taşınmış numara (belgesi duran) varken üstteki silinirse taşınanın tarihi taban kalır; v32 aynı kaydı üretir → B1
//  4. geri yükleme: büyük numaralı daha eski tarihli / küçük numaralı daha yeni tarihli belge → 409; sıra uyuyorsa 200; iptal edilmiş belge de sırada → A1, A3, A4
//  5. sıra: numara alınmış → invoice-number-taken; kilitli → period-locked; yalnız sıra bozuk → sıra iletisi                       → A5
//  6. Düzenle: canlı belgenin tarihi silinen komşuya bağlı değil                                                                 → A3
//  7. Müşteri Fişi Olarak Bırak: silinen fişin tarihi bırakmayı engellemez                                                      → B1
//  9/10. taslak / numarasız bekleyen silme ve 002 şirketi: test/numara-silinen-244 S4, S6 (aynen)
//  11. eski taban kaydı (kept alanı yok): silinmişse tarih bağlamaz                                                               → C1
// Sahte saat (config.now; ders 13). Bu dosya programla aynı elden (ders 5): kâhin kuralı raporda.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { apiOf } from "./banka-210-ortak.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-06-17";
const NOW = `${TODAY}T10:00:00`;
const LICENSE = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const day = offset => {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const tr = iso => iso.split("-").reverse().join(".");
const fis = seq => `FIS2026${String(seq).padStart(9, "0")}`;
const smm = seq => `SMM2026${String(seq).padStart(9, "0")}`;
const LINE = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const INV = "/api/workspace/invoices";
const floorRaw = store => JSON.parse(store.get("SELECT value FROM settings WHERE key = 'invoice.numberFloor'")?.value || "{}");

const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
  return res.data;
};
function helpers(ctx) {
  const { api, store } = ctx;
  ctx.saleBody = (date, extra = {}) => ({ scenario: "service_sale", accountId: ctx.customer.id, issueDate: date, lines: LINE, payment: { rest: "open" }, ...extra });
  ctx.sale = (date, extra = {}) => must(`satış ${date}`, api.post(INV, ctx.saleBody(date, extra)));
  ctx.remove = (label, id) => must(`${label} sil`, api.del(`${INV}/${id}?reason=${encodeURIComponent("test: yanlış tarih")}`));
  ctx.trashItem = invoiceId => store.get("SELECT id FROM trash WHERE kind = 'invoice' AND ref = ? AND restored_at IS NULL", invoiceId);
  ctx.restore = invoiceId => {
    const item = ctx.trashItem(invoiceId);
    assert.ok(item, `Silinenler'de yok: ${invoiceId}`);
    return api.post("/api/admin/trash/restore", { id: `trash:${item.id}` });
  };
  ctx.row = id => {
    const row = store.get("SELECT number, seq, status, issue_date AS issueDate FROM invoices WHERE id = ?", id);
    return row ? { ...row } : undefined;
  };
  ctx.refusedOrder = async (label, invoiceId, other, otherDate, side) => {
    const res = await ctx.restore(invoiceId);
    assert.equal(res.status, 409, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    assert.equal(res.code, "invoice-restore-chronology", `${label}: ${res.code} — ${res.error}`);
    assert.match(res.error, new RegExp(`geri yüklenmez: geri yüklenirse numara ve tarih sırası bozulur — ${other} ${tr(otherDate).replace(/\./g, "\\.")} tarihli \\(${side}\\)\\. Belge Silinenler'de kalır\\.$`), `${label}: ${res.error}`);
    assert.ok(ctx.trashItem(invoiceId), `${label}: belge Silinenler'de kalır`);
    assert.equal(ctx.row(invoiceId), undefined, `${label}: Fatura listesine dönmedi`);
    return res;
  };
  return ctx;
}
async function bootPlain() {
  const server = await startTestServer({ now: NOW, env: LICENSE });
  const api = apiOf(await loginAdmin(server));
  const ctx = { server, api, store: server.app.store };
  ctx.customer = await must("cari", api.post("/api/workspace/accounts", { name: "N1 Cari", type: "customer", registeredOn: "2026-01-01" }));
  return helpers(ctx);
}

describe("r31e N1 — silinen kâğıt / fiş belgenin tarihi sırayı bağlamaz; geri yükleme sırayı bozamaz (e-Belge kapalı: Müşteri Fişi serisi)", () => {
  test("A1 yanlış (ileri) tarihli fiş silinir → doğru (daha eski) tarihli fiş kesilir, numara yeniden verilmez; canlı fişten eskisi yine 400; silinen geri yüklenirse sıra bozulur → 409", async () => {
    const ctx = await bootPlain();
    try {
      const a = await ctx.sale(day(-5));
      assert.equal(a.number, fis(1));
      const wrong = await ctx.sale(day(0));
      assert.equal(wrong.number, fis(2));
      await ctx.remove("yanlış tarihli", wrong.id);
      assert.equal((await must("ayar", ctx.api.get(`${INV}/settings`))).nextNumbers.paper.number, fis(3), "E6: silinen FIS…002 yeniden verilmez");
      const right = await ctx.sale(day(-3));
      assert.equal(right.number, fis(3), "doğru tarihle yeniden kesilen fiş");
      const tooOld = await ctx.api.post(INV, ctx.saleBody(day(-6)));
      assert.equal(tooOld.status, 400, JSON.stringify(tooOld.data));
      assert.equal(tooOld.code, "chronology");
      assert.match(tooOld.error, new RegExp(`son belge ${fis(3)} ${tr(day(-3)).replace(/\./g, "\\.")} tarihli`), tooOld.error);
      assert.doesNotMatch(tooOld.error, /belge silindi/);
      await ctx.refusedOrder("sonraki numara daha eski tarihli", wrong.id, fis(3), day(-3), "sonraki numara, daha eski tarih");
      assert.match((await ctx.restore(wrong.id)).error, new RegExp(`^Satış Faturası ${fis(2)} \\(${tr(day(0)).replace(/\./g, "\\.")}\\) geri yüklenmez`));
      assert.equal((await ctx.sale(day(0))).number, fis(4), "geri yükleme reddi sırayı değiştirmez");
    } finally {
      await ctx.server.close();
    }
  });

  test("A2 toplu silme: en geç tarihli silinen fiş seriyi o güne bağlamaz; kâğıt makbuz (SMM) serisinde de", async () => {
    const ctx = await bootPlain();
    try {
      await ctx.sale(day(-5));
      const w1 = await ctx.sale(day(-1));
      const w2 = await ctx.sale(day(0));
      const bulk = await must("toplu sil", ctx.api.post(`${INV}/bulk-delete`, { ids: [w1.id, w2.id], reason: "test: toplu" }));
      assert.equal(bulk.deleted, 2, JSON.stringify(bulk.results));
      const c = await ctx.sale(day(-4));
      assert.equal(c.number, fis(4), "toplu silinen FIS…002 ve FIS…003 yeniden verilmez; tarih bağlamaz");
      await ctx.refusedOrder("toplu silinen 1", w1.id, fis(4), day(-4), "sonraki numara, daha eski tarih");
      await ctx.refusedOrder("toplu silinen 2", w2.id, fis(4), day(-4), "sonraki numara, daha eski tarih");
      const client = await must("makbuz carisi", ctx.api.post("/api/workspace/accounts", { name: "Müvekkil A.Ş.", type: "customer", taxNo: OUR_VKN, registeredOn: "2026-01-01" }));
      const makbuz = date => must(`makbuz ${date}`, ctx.api.post(INV, { scenario: "smm", accountId: client.id, issueDate: date, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));
      assert.equal((await makbuz(day(-5))).number, smm(1));
      const wrongSmm = await makbuz(day(0));
      assert.equal(wrongSmm.number, smm(2));
      await ctx.remove("yanlış tarihli makbuz", wrongSmm.id);
      assert.equal((await makbuz(day(-2))).number, smm(3));
      await ctx.refusedOrder("makbuz", wrongSmm.id, smm(3), day(-2), "sonraki numara, daha eski tarih");
    } finally {
      await ctx.server.close();
    }
  });

  test("A3 Düzenle silinen komşunun tarihine bağlı değil; küçük numaralı belge daha yeni tarihliyse geri yükleme 409; sıra uyunca 200 kendi numarasıyla", async () => {
    const ctx = await bootPlain();
    try {
      const a = await ctx.sale(day(-4));
      const b = await ctx.sale(day(-4));
      assert.equal(b.number, fis(2));
      await ctx.remove("B", b.id);
      await must("A ileri tarihe", ctx.api.post(`${INV}/${a.id}/edit`, ctx.saleBody(day(-2))));
      assert.equal(ctx.row(a.id).issueDate, day(-2));
      await ctx.refusedOrder("önceki numara daha yeni tarihli", b.id, fis(1), day(-2), "önceki numara, daha yeni tarih");
      await must("A eski tarihine", ctx.api.post(`${INV}/${a.id}/edit`, ctx.saleBody(day(-4))));
      const back = await must("B geri yükle (sıra uyuyor)", ctx.restore(b.id));
      assert.match(back.message, new RegExp(`${fis(2)} geri geldi`));
      assert.deepEqual(ctx.row(b.id), { number: fis(2), seq: 2, status: "cancelled", issueDate: day(-4) });
    } finally {
      await ctx.server.close();
    }
  });

  test("A4 iptal edilmiş belge de sırada yer tutar: daha eski tarihli büyük numaralı belge iptal edilse de geri yükleme 409", async () => {
    const ctx = await bootPlain();
    try {
      await ctx.sale(day(-5));
      const wrong = await ctx.sale(day(0));
      await ctx.remove("yanlış", wrong.id);
      const later = await ctx.sale(day(-3));
      await must("iptal", ctx.api.post(`${INV}/${later.id}/cancel`, { reason: "test: iptal" }));
      assert.equal(ctx.row(later.id).status, "cancelled");
      await ctx.refusedOrder("iptal edilmiş sonraki", wrong.id, fis(3), day(-3), "sonraki numara, daha eski tarih");
    } finally {
      await ctx.server.close();
    }
  });

  test("A5 sıra: dönem kilidi sıra-tarihten önce (period-locked); kilit açılınca sıra iletisi; numarası başkasında olan belgede önce invoice-number-taken", async () => {
    const ctx = await bootPlain();
    try {
      await ctx.sale(day(-5));
      const x = await ctx.sale(day(-1));
      await ctx.remove("X", x.id);
      await ctx.sale(day(-3));
      await must("kilit", ctx.api.put("/api/admin/period-lock", { lockedUntil: day(-1) }));
      const locked = await ctx.restore(x.id);
      assert.equal(locked.status, 409);
      assert.equal(locked.code, "period-locked", locked.error);
      await must("kilit kaldır", ctx.api.put("/api/admin/period-lock", { lockedUntil: "" }));
      await ctx.refusedOrder("kilitsiz", x.id, fis(3), day(-3), "sonraki numara, daha eski tarih");
      const holder = await ctx.sale(day(0), { paperNo: fis(2) });
      await must("kilit", ctx.api.put("/api/admin/period-lock", { lockedUntil: day(-1) }));
      const taken = await ctx.restore(x.id);
      assert.equal(taken.status, 409);
      assert.equal(taken.code, "invoice-number-taken", taken.error);
      assert.equal(taken.data.holderId, holder.id);
      assert.ok(ctx.trashItem(x.id));
    } finally {
      await ctx.server.close();
    }
  });
});

describe("r31e N1 — e-Belge açık: taşınan numaranın tarihi taban kalır; Müşteri Fişi Olarak Bırak; v32 aynı kaydı üretir", () => {
  let ctx;
  before(async () => {
    resetEdmCaches();
    const edm = await startMockEdm();
    const server = await startTestServer({ edocEnabled: true, esmmEnabled: true, now: NOW, edocStatusPollMs: [5, 5], env: LICENSE });
    const client = server.client();
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const api = apiOf(client);
    ctx = helpers({ edm, server, api, store: server.app.store });
    await must("ayar", api.put(`${INV}/settings`, { seller: { name: "Deneme Hukuk Bürosu Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    ctx.customer = await must("kişi", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" }));
    ctx.waiting = date => ctx.sale(date, { eSend: "later" });
    ctx.withdraw = id => api.post(`${INV}/${id}/withdraw`, {});
  });
  after(async () => {
    await ctx?.server.close();
    await ctx?.edm.close();
  });

  test("B1 FIS…001 (bugün−2) bırakılıp e-Arşiv olarak gönderilir, FIS…002 (bugün) bırakılıp silinir: taban taşınan FIS…001'in tarihi (bugün−3 kâğıt kayıt 400); bugün−1 bırakılır; v32 taraması aynı kaydı üretir; silinen geri yüklenmez", async () => {
    const m = await ctx.waiting(day(-2));
    assert.equal((await must("M bırak", ctx.withdraw(m.id))).number, fis(1));
    const sent = await must("M gönder", ctx.api.post(`${INV}/${m.id}/send`, {}));
    assert.equal(sent.paperNo, fis(1), "ön koşul: FIS…001 seriden ayrıldı, belge duruyor");
    const d = await ctx.waiting(day(0));
    assert.equal((await must("D bırak", ctx.withdraw(d.id))).number, fis(2));
    await ctx.remove("D", d.id);
    const expected = { seq: 2, number: fis(2), issueDate: day(0), deleted: true, kept: { seq: 1, number: fis(1), issueDate: day(-2) } };
    assert.deepEqual(floorRaw(ctx.store).FIS2026, expected, "taban: en büyük numara silinen FIS…002, sıra-tarih tabanı taşınan FIS…001");
    await must("e-Arşiv kapalı", ctx.api.put(`${INV}/settings`, { earsiv: false }));
    try {
      const refused = await ctx.api.post(INV, ctx.saleBody(day(-3), { profile: "KAGIT" }));
      assert.equal(refused.status, 400, JSON.stringify(refused.data));
      assert.equal(refused.code, "chronology");
      assert.match(refused.error, new RegExp(`son belge ${fis(1)} \\(belge sonra e-Belge olarak gönderildi; numara kullanılmış sayılır\\) ${tr(day(-2)).replace(/\./g, "\\.")} tarihli`), refused.error);
    } finally {
      await must("e-Arşiv açık", ctx.api.put(`${INV}/settings`, { earsiv: true }));
    }
    const ok = await ctx.waiting(day(-1));
    assert.equal((await must("bugün−1 bırak", ctx.withdraw(ok.id))).number, fis(3), "silinen FIS…002'nin tarihi (bugün) bırakmayı engellemez, numarası verilmez");
    const { scanPaperFloors } = await import("../server/lib/migrations.mjs");
    const saved = floorRaw(ctx.store);
    ctx.store.run("DELETE FROM settings WHERE key = 'invoice.numberFloor'");
    try {
      assert.deepEqual(scanPaperFloors(ctx.store).raised, ["FIS2026"]);
      assert.deepEqual(floorRaw(ctx.store).FIS2026, expected, "v32 (2.4.3 verisi yolu) aynı kaydı üretir: taşınan numaranın tarihi kaybolmaz");
      assert.deepEqual(scanPaperFloors(ctx.store).raised, [], "idempotent");
    } finally {
      ctx.store.run("INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('invoice.numberFloor', ?, ?, NULL) ON CONFLICT(key) DO UPDATE SET value = excluded.value", JSON.stringify(saved), new Date().toISOString());
    }
    assert.deepEqual(floorRaw(ctx.store), saved);
    await ctx.refusedOrder("silinen FIS…002", d.id, fis(3), day(-1), "sonraki numara, daha eski tarih");
  });
});

describe("r31e N1 — taban kaydının birleştirme kuralı (lib/number-floor.mjs)", () => {
  test("C1 sıradan bağımsız: en büyük numara + en büyük silinmemiş numara; eski kayıt (kept yok) silinmişse tarih bağlamaz; kayıt yalnız yükselir", async () => {
    // Dinamik içe aktarma: modül yoksa (eski kod) yalnız bu test kırmızı olur, dosyanın öbür testleri koşar (ders 38: kırmızının nedeni okunur).
    const { keptOf, mergeFloor } = await import("../server/lib/number-floor.mjs");
    const parts = [
      { seq: 3, number: fis(3), issueDate: day(-4) },
      { seq: 5, number: fis(5), issueDate: day(0), deleted: true },
      { seq: 2, number: fis(2), issueDate: day(-6) },
      { seq: 4, number: fis(4), issueDate: day(-1), deleted: true },
    ];
    const orders = [[0, 1, 2, 3], [3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1], [1, 0, 3, 2]];
    const results = orders.map(order => JSON.stringify(order.reduce((acc, i) => mergeFloor(acc, parts[i]), null)));
    assert.equal(new Set(results).size, 1, results.join("\n"));
    assert.deepEqual(JSON.parse(results[0]), { seq: 5, number: fis(5), issueDate: day(0), deleted: true, kept: { seq: 3, number: fis(3), issueDate: day(-4) } });
    assert.deepEqual(keptOf(JSON.parse(results[0])), { seq: 3, number: fis(3), issueDate: day(-4) });
    assert.equal(keptOf({ seq: 7, number: fis(7), issueDate: day(0), deleted: true }), null, "aday yapılarının kept'siz kaydı: silinmişse sıra-tarih tabanı yok");
    const top = { seq: 9, number: fis(9), issueDate: day(0) };
    assert.deepEqual(mergeFloor(top, { seq: 4, number: fis(4), issueDate: day(-3), deleted: true }), top, "küçük numara kaydı değiştirmez");
    assert.deepEqual(mergeFloor(top, { seq: 12, number: fis(12), issueDate: day(0), deleted: true }), { seq: 12, number: fis(12), issueDate: day(0), deleted: true, kept: top }, "silinmemiş eski tepe kept olur");
  });
});
