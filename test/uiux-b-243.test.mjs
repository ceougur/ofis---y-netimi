// 2.4.3 uzman UI / UX turu, B paketi (fatura ekranı; kullanıcı kararları 18.10.2026) — SUNUCU tarafı. Sahte EDM; ağa çıkmaz; sahte saat (ders 13).
// Bulgular (docs/kanit/2026-10-18/uiux-b-243/):
//   UX2  YÜKSEK tam iade faturası Düzenle'de hiç kaydedilemiyordu: ön hesap (/invoices/calc) düzenlenen iadenin kendi miktarını "önce iade edilen"
//               sayıyordu ("en çok 0 Adet iade edilebilir"). Kısmi iade düzenlemesi ve başka iadelerin miktarı bozulmamalı.
//   UX5  ORTA   gönderimde mükellefiyet geri konurken çok posta kutulu alıcıda önceden seçilmiş kutu korunsa da ileti "Mükellef Sorgula ile seçin"
//               diyordu; listede olmayan eski etiket ise kalıyordu (aliases geçirilmiyordu).
//   UX14 DÜŞÜK  kullanıcı iletisinde teknik kod ("EDM'ye bağlanılamadı: UND_ERR_SOCKET"); kod detail'de ve işlem geçmişinde kalır.
//   KÖ1  karar  "Nihai Tüketici" hızlı seçeneği: tek perakende carisi (11111111111), ilk kullanımda açılır, çift açılmaz; sınır üstü e-Arşiv engeli.
//   KÖ2  karar  "Listeden Sil" → "Müşteri Fişi Olarak Bırak": sunucu iletileri yeni adla.
// Nasıl bozulur: tam / kısmi iade, aynı asıl faturaya iki iade, başka asıl faturanın iadesinin kimliği (calc'ta dikkate alınmamalı), kutu listede yok,
// tek kutulu mükellef, iki istek aynı anda (Nihai Tüketici), Nihai Tüketici carisi önceden elle açılmış.
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { createEdmClient, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { MULTI_VKN, OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };

async function setup({ edoc = true } = {}) {
  resetEdmCaches();
  const edm = await startMockEdm();
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: edoc, fetchImpl, now: "2026-10-18T10:00:00", edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: edoc, earsiv: edoc })).status, 200);
  if (edoc) assert.equal((await api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
  const must = async (label, promise) => {
    const r = await promise;
    assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
    return r.data;
  };
  const db = (sql, ...args) => server.app.store.get(sql, ...args);
  const close = async () => {
    await server.close();
    await edm.close();
  };
  return { edm, server, api, must, db, close };
}

describe("uiux-b-243 sunucu", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("UX2: tam iade Düzenle'de ön hesap ve kayıt geçer; kısmi iade ve öbür iadenin miktarı korunur; başka faturanın iadesi kimliği sayılmaz", async () => {
    const ctx = await setup({ edoc: false });
    open.push(ctx);
    const { api, must } = ctx;
    const cust = await must("cari", api.post("/api/workspace/accounts", { name: "İade Müşterisi", type: "customer" }));
    const sale = await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: cust.id, issueDate: "2026-10-10", lines: [{ name: "Kurulum", qty: 2, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" } }));
    const full = await must("tam iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: sale.id, accountId: cust.id, issueDate: "2026-10-12", lines: [{ originLineId: sale.lines[0].id, qty: 2 }], payment: {} }));
    const body = { kind: "sale_return", originalId: sale.id, accountId: cust.id, issueDate: "2026-10-12", note: "not değişti", lines: [{ originLineId: sale.lines[0].id, qty: 2 }] };
    // Eski davranış (kimliksiz ön hesap) hâlâ reddeder — yeni iade için doğru kural.
    const plain = await api.post("/api/workspace/invoices/calc", body);
    assert.equal(plain.status, 400, "kimliksiz ön hesap yeni iade sayılır");
    const calc = await api.post("/api/workspace/invoices/calc", { ...body, existingId: full.id });
    assert.equal(calc.status, 200, `düzenlenen iadenin ön hesabı: ${JSON.stringify(calc.data).slice(0, 300)}`);
    assert.equal(calc.data.totals.payable, 720);
    const edited = await must("tam iade düzenle", api.post(`/api/workspace/invoices/${full.id}/edit`, { ...body }));
    assert.equal(edited.note, "not değişti");
    assert.equal(ctx.db("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return' AND status = 'issued'").n, 1);

    // Kısmi: 3 adetten 1 + 1 iade; ikinci iade düzenlenirken en çok 2 (3 − öbür iade 1).
    const sale2 = await must("satış 2", api.post("/api/workspace/invoices", { kind: "sale", accountId: cust.id, issueDate: "2026-10-10", lines: [{ name: "Malzeme", qty: 3, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } }));
    const lineId = sale2.lines[0].id;
    const r1 = await must("iade 1", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: sale2.id, accountId: cust.id, issueDate: "2026-10-12", lines: [{ originLineId: lineId, qty: 1 }], payment: {} }));
    const r2 = await must("iade 2", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: sale2.id, accountId: cust.id, issueDate: "2026-10-12", lines: [{ originLineId: lineId, qty: 1 }], payment: {} }));
    const b2 = qty => ({ kind: "sale_return", originalId: sale2.id, accountId: cust.id, issueDate: "2026-10-12", lines: [{ originLineId: lineId, qty }], existingId: r2.id });
    assert.equal((await api.post("/api/workspace/invoices/calc", b2(2))).status, 200, "kısmi iade 1 → 2 düzenlenebilir");
    const over = await api.post("/api/workspace/invoices/calc", b2(3));
    assert.equal(over.status, 400);
    assert.match(over.data.error || JSON.stringify(over.data), /en çok 2 Adet iade edilebilir \(faturada 3, önce iade edilen 1\)/);
    // Başka asıl faturanın iadesinin kimliği (full) bu asıl faturada dışarıda bırakılmaz: sonuç kimliksizle aynı.
    const foreign = await api.post("/api/workspace/invoices/calc", { ...b2(2), existingId: full.id });
    assert.equal(foreign.status, 400, "başka asıl faturanın iadesi kimliği sayılmaz");
    assert.equal((await api.post(`/api/workspace/invoices/${r1.id}/edit`, { kind: "sale_return", originalId: sale2.id, accountId: cust.id, issueDate: "2026-10-12", lines: [{ originLineId: lineId, qty: 2 }] })).status, 200, "iade 1 → 2 (toplam 3)");
    assert.equal((await api.post("/api/workspace/invoices/calc", b2(2))).status, 400, "toplam aşılınca yine reddedilir");
  });

  test("UX5: çok posta kutulu alıcıda gönderimde işaret geri konurken seçili kutu korunur ve ileti bunu söyler; listede olmayan etiket silinir", async () => {
    const ctx = await setup();
    open.push(ctx);
    const { api, must } = ctx;
    const base = { type: "customer", taxNo: MULTI_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 1", district: "Çankaya", city: "Ankara" };
    // Kullanıcı Mükellef Sorgula ile defaultpk'yı seçmiş, sonra işareti elle kaldırmış (etiket kartta kalır — A paketi).
    const acc = await must("cari", api.post("/api/workspace/accounts", { ...base, name: "Çoklu A.Ş.", eInvoice: false, eAlias: "urn:mail:defaultpk@coklu.com.tr" }));
    const sale = { kind: "sale", accountId: acc.id, issueDate: "2026-10-18", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" };
    const first = await ctx.api.post("/api/workspace/invoices", sale);
    assert.equal(first.status, 409, JSON.stringify(first.data).slice(0, 300));
    const msg = first.data.error;
    assert.match(msg, /Önceden seçtiğiniz posta kutusu \(urn:mail:defaultpk@coklu\.com\.tr\) korundu\./, msg);
    assert.doesNotMatch(msg, /Mükellef Sorgula ile doğru posta kutusunu seçin/);
    const row = ctx.db("SELECT e_invoice AS e, e_alias AS alias FROM accounts WHERE id = ?", acc.id);
    assert.deepEqual({ ...row }, { e: 1, alias: "urn:mail:defaultpk@coklu.com.tr" });
    // Form yeniden hesaplayınca e-Fatura ve kutu engeli yok; yeniden kaydedince e-Fatura olarak o kutuya gider.
    const calc = await must("calc", api.post("/api/workspace/invoices/calc", sale));
    assert.equal(calc.profile !== "EARSIVFATURA", true, `profil ${calc.profile}`);
    assert.equal(calc.aliasBlock, "");
    const saved = await must("yeniden kaydet", api.post("/api/workspace/invoices", sale));
    assert.notEqual(saved.profile, "EARSIVFATURA");
    // Listede olmayan eski etiket korunmaz; ileti kutu seçimini söyler.
    const stale = await must("cari 2", api.post("/api/workspace/accounts", { ...base, taxNo: MULTI_VKN, name: "Çoklu Eski Etiket", eInvoice: false, eAlias: "urn:mail:eski@baska.com.tr" }));
    const second = await ctx.api.post("/api/workspace/invoices", { ...sale, accountId: stale.id });
    assert.equal(second.status, 409);
    assert.match(second.data.error, /2 posta kutusu var: cari kartında Mükellef Sorgula ile doğru posta kutusunu seçin/);
    assert.equal(ctx.db("SELECT e_alias AS alias FROM accounts WHERE id = ?", stale.id).alias, "");
  });

  test("UX14: bağlantı hatası iletisinde teknik kod yok; kod detail'de", async () => {
    const edm = await startMockEdm();
    try {
      for (const [code, side] of [["UND_ERR_SOCKET", "uncertain"], ["ECONNREFUSED", "unreachable"]]) {
        resetEdmCaches();
        const fetchImpl = async (input, init) => {
          if (String(init?.body || "").includes("SendInvoice")) throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("other side closed"), { code }) });
          return globalThis.fetch(input, init);
        };
        const client = createEdmClient({ baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", fetchImpl });
        await client.ensureSession();
        let error;
        try {
          await client.send({ xml: '<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ProfileID>EARSIVFATURA</cbc:ProfileID></Invoice>', number: "TEA2026000000001", uuid: "11111111-2222-3333-4444-555555555555", earchive: true, senderVkn: "1234567890" });
        } catch (failure) {
          error = failure;
        }
        assert.ok(error, `${code}: hata bekleniyordu`);
        assert.equal(error.code, `integrator-${side}`);
        assert.doesNotMatch(error.message, /UND_ERR|ECONN|EPIPE|E[A-Z]{3,}/, error.message);
        assert.equal(error.detail, code);
      }
    } finally {
      await edm.close();
    }
  });

  test("KÖ1: Nihai Tüketici carisi ilk kullanımda açılır, sonra aynısı döner (çift açılmaz, eşzamanlı da); sınır üstü e-Arşiv engellenir", async () => {
    const ctx = await setup();
    open.push(ctx);
    const { api, must } = ctx;
    const [a, b] = await Promise.all([api.post("/api/workspace/invoices/retail-account", {}), api.post("/api/workspace/invoices/retail-account", {})]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(a.data.id, b.data.id, "aynı cari");
    const again = await must("üçüncü", api.post("/api/workspace/invoices/retail-account", {}));
    assert.equal(again.id, a.data.id);
    assert.equal(again.created, false);
    assert.equal(ctx.db("SELECT COUNT(*) AS n FROM accounts WHERE tax_no = '11111111111' AND deleted_at IS NULL").n, 1);
    const acc = ctx.db("SELECT name, type, party_kind AS kind, city FROM accounts WHERE id = ?", a.data.id);
    assert.equal(acc.name, "Nihai Tüketici");
    assert.equal(acc.city, "Ankara", "il firmanın adresinden (e-Arşiv alıcıda il zorunlu)");
    const small = { kind: "sale", accountId: a.data.id, issueDate: "2026-10-18", lines: [{ name: "Perakende", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } };
    const c1 = await must("calc küçük", api.post("/api/workspace/invoices/calc", small));
    assert.equal(c1.profile, "EARSIVFATURA");
    assert.deepEqual(c1.blockers, []);
    const big = { ...small, lines: [{ name: "Perakende", qty: 1, unitPrice: 30000, vatRate: 20 }] };
    const c2 = await must("calc büyük", api.post("/api/workspace/invoices/calc", big));
    assert.ok(c2.blockers.some(text => /30\.000 TL üstü e-Arşiv faturada nihai tüketicinin gerçek TC kimlik numarası/.test(text)), JSON.stringify(c2.blockers));
    const refused = await api.post("/api/workspace/invoices", { ...big, eSend: "now" });
    assert.notEqual(refused.status, 200, "sınır üstü kesilmez");
    // Önceden elle açılmış "Nihai Tüketici" carisi varsa o kullanılır. 2.4.4 (31f U1): başka adlı 11111111111'li cari ("Perakende Müşteri",
    // ya da adı belli bir kişi) artık seçilmez — önceden en eski 11111111111'li cari seçiliyordu; kural test/nihai-tuketici-u1-244.test.mjs.
    const ctx2 = await setup({ edoc: false });
    open.push(ctx2);
    const other = await ctx2.must("başka adlı", ctx2.api.post("/api/workspace/accounts", { name: "Perakende Müşteri", type: "customer", partyKind: "person", firstName: "Perakende", familyName: "Müşteri", taxNo: "11111111111" }));
    const manual = await ctx2.must("elle", ctx2.api.post("/api/workspace/accounts", { name: "Nihai Tüketici", type: "customer", partyKind: "person", firstName: "Nihai", familyName: "Tüketici", taxNo: "11111111111" }));
    const reuse = await ctx2.must("yeniden", ctx2.api.post("/api/workspace/invoices/retail-account", {}));
    assert.notEqual(reuse.id, other.id, `başka adlı cari seçildi: ${reuse.name}`);
    assert.equal(reuse.id, manual.id);
    assert.equal(reuse.name, "Nihai Tüketici");
    assert.equal(reuse.created, false);
  });

  test("KÖ2: Gönderilecekler'den fişe çevirme iletileri 'Müşteri Fişi olarak bırak' der", async () => {
    const ctx = await setup();
    open.push(ctx);
    const { api, must } = ctx;
    const person = await must("kişi", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", address: "Kordon 1", district: "Konak", city: "İzmir" }));
    const later = await must("sonra gönder", api.post("/api/workspace/invoices", { kind: "sale", accountId: person.id, issueDate: "2026-10-18", lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    await must("fişe çevir", api.post(`/api/workspace/invoices/${later.id}/withdraw`, {}));
    const again = await api.post(`/api/workspace/invoices/${later.id}/withdraw`, {});
    assert.equal(again.status, 409);
    assert.equal(again.data.error, "Yalnız Gönderilecekler'deki belge Müşteri Fişi olarak bırakılır.");
    void vkn;
  });
});
