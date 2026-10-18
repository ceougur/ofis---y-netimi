// Dar kontrol 2 (2.4.3) — iade e-Belgesi ve sıra iletileri. Sahte EDM; ağa çıkmaz; sahte saat (ders 13). Programın ürettiği UBL, depodaki UBL 2.1 XSD +
// GİB UBL-TR şematronu aracından (tools/ebelge/dogrula.mjs; programdan bağımsız kâhin) UYGUN geçmeli.
//   MM1 YÜKSEK  kâğıt (16 karakter olmayan) asıllı alış faturasına iade e-Belgesi hiçbir yoldan kesilemiyordu; ileti "asıl faturanın numarasını düzeltin"
//               diyordu (VUK 219/227: asıl kaydın numarası değiştirilmez). Karar: "İade Edilen Belge No (e-Belge Referansı)" — 16 karakterlik değer önerilir,
//               kullanıcı onaylar; BillingReference/ID'ye o, IssueDate'e asıl tarih; gerçek numara açıklamada; asıl kayda dokunulmaz.
//   MM2 YÜKSEK  Ticari profilli tedarikçiye alıştan iade TICARIFATURA + IADE kesiliyordu; GİB şematronu reddeder. Karar: iade belgesinde yalnız TEMELFATURA.
//   B5  ORTA    "Kes, Sonra Gönder" serinin son numaralısından eski tarihle kaydediliyor, doğar doğmaz kalıcı kronoloji engeline düşüyordu (D4 kuralı yok).
//   B7  DÜŞÜK   kronoloji engelli belgenin iletisi "Listeden Sil ile Müşteri Fişi olarak bırakın" diyordu; Müşteri Fişi sırası (K31) izin vermiyorsa o yol kapalı.
// Nasıl bozulur: asıl numara boşluklu/tireli/uzun, kullanıcı öneriyi bozar (15/17 karakter, işaret), asıl 16 haneli e-Belge (davranış aynı kalmalı),
// carinin ve ayarın varsayılanı Ticari, Düzenle'de eski Ticari iade; aynı gün / eski gün; Müşteri Fişi serisinde daha yeni fiş.
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { validateInvoice } from "../tools/ebelge/dogrula.mjs";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, SUPPLIER_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const describeErrors = result => [...result.xsd.map(error => `XSD: ${error}`), ...result.schematron.map(error => `GİB: ${error.text} [${error.location}]`)].join("\n");

async function setup() {
  resetEdmCaches();
  const edm = await startMockEdm();
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, fetchImpl, now: "2026-10-18T10:00:00", edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true })).status, 200);
  assert.equal((await api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
  const account = async body => {
    const created = await api.post("/api/workspace/accounts", body);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    return created.data.id;
  };
  const ids = {
    paperSupplier: await account({ name: "Kâğıtçı Toptan Ltd.", type: "supplier", taxNo: vkn(444555666), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir" }),
    ticari: await account({ name: "Ticari Tedarik A.Ş.", type: "supplier", taxNo: SUPPLIER_VKN, taxOffice: "Ostim", address: "Ostim OSB", district: "Yenimahalle", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@tedarik.com.tr", eProfile: "TICARIFATURA" }),
    ayse: await account({ name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" }),
    retail: await account({ name: "Perakende Müşteri", type: "customer", partyKind: "person", firstName: "Perakende", familyName: "Müşteri", taxNo: "11111111111", address: "Kordon 1", district: "Konak", city: "İzmir" }),
  };
  const day = offset => new Date(Date.UTC(2026, 9, 18 + offset)).toISOString().slice(0, 10);
  const post = (url, body) => api.post(url, body);
  const must = async (label, promise) => {
    const r = await promise;
    assert.equal(r.status, 200, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
    return r.data;
  };
  const xmlOf = async id => {
    const r = await api.get(`/api/workspace/invoices/${id}/ubl.xml`);
    assert.equal(r.status, 200);
    return typeof r.data === "string" ? r.data : r.text;
  };
  const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
  const close = async () => {
    await server.close();
    await edm.close();
  };
  return { edm, server, api, ids, day, post, must, xmlOf, count, close };
}

describe("gg243 dar kontrol 2: kâğıt asıllı alış faturasının iadesi (MM1)", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("MM1: asıl no 'A 004512' — referanssız kayıt nedenli 400 (asıl kaydı düzeltin demez); önerilen referansla iade kesilir, UBL GİB'e UYGUN, asıl kayıt değişmez", async () => {
    const ctx = await setup();
    open.push(ctx);
    const purchase = await ctx.must("kâğıt alış", ctx.post("/api/workspace/invoices", { kind: "purchase", accountId: ctx.ids.paperSupplier, issueDate: ctx.day(-38), number: "A 004512", profile: "KAGIT", lines: [{ name: "Toner", qty: 4, unitPrice: 500, vatRate: 20, goods: true }], payment: { rest: "open" } }));
    const body = { kind: "purchase_return", originalId: purchase.id, accountId: ctx.ids.paperSupplier, issueDate: ctx.day(-3), lines: [{ originLineId: purchase.lines[0].id, qty: 1 }], payment: {} };
    // Form açılırken (hesap ucu) alan ve öneri bilinir.
    const calc = await ctx.must("calc", ctx.post("/api/workspace/invoices/calc", body));
    assert.deepEqual(calc.returnRef, { needed: true, original: "A 004512", suggested: "A000000000004512", value: "" });
    const before = ctx.count();
    const bare = await ctx.post("/api/workspace/invoices", body);
    assert.equal(bare.status, 400, JSON.stringify(bare.data));
    assert.equal(bare.data.code, "einvoice-return-reference");
    assert.equal(bare.data.error, "İade e-Belgesi asıl faturayı 16 karakterlik bir numarayla gösterir (GİB). Asıl faturanın numarası (A 004512) 16 karakter değil: İade Edilen Belge No (e-Belge Referansı) alanına 16 karakterlik değeri yazın (önerilen: A000000000004512). Asıl fatura kaydı değişmez; gerçek numarası belgenin açıklamasında yazar.");
    assert.doesNotMatch(bare.data.error, /numarasını düzeltin/);
    for (const [bad, why] of [["A00000000004512", /16 karakter/], ["A0000000000045123", /16 karakter/], ["A00000000000/512", /yalnız harf/]]) {
      const r = await ctx.post("/api/workspace/invoices", { ...body, returnRef: bad });
      assert.equal(r.status, 400, `${bad}: ${JSON.stringify(r.data)}`);
      assert.match(r.data.error, why);
    }
    assert.equal(ctx.count(), before, "reddedilen iade kayıt açmadı");
    // Kullanıcı öneriyi onaylar (boşluk/küçük harf atılır) ve Kaydet ve Gönder.
    const saved = await ctx.must("iade", ctx.post("/api/workspace/invoices", { ...body, returnRef: " a000000000004512 ", eSend: "now" }));
    assert.equal(saved.profile, "EARSIVFATURA");
    assert.equal(saved.typeCode, "IADE");
    assert.equal(saved.returnRef, "A000000000004512");
    assert.equal(saved.autoSend?.ok, true, JSON.stringify(saved.autoSend));
    const xml = await ctx.xmlOf(saved.id);
    assert.match(xml, new RegExp(`<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>A000000000004512</cbc:ID><cbc:IssueDate>${ctx.day(-38)}</cbc:IssueDate><cbc:DocumentTypeCode>IADE</cbc:DocumentTypeCode>`));
    assert.match(xml, /<cbc:Note>İade edilen fatura: A 004512<\/cbc:Note>/, "gerçek numara açıklamada");
    assert.equal(describeErrors(await validateInvoice(xml, { type: "earsiv" })), "", "UBL 2.1 XSD + GİB şematronu UYGUN");
    // EDM'ye giden belgede de aynı referans.
    const sent = ctx.edm.state.sent.at(-1);
    assert.match(sent.xml, /<cbc:ID>A000000000004512<\/cbc:ID>/);
    // Asıl kayıt değişmedi.
    const original = await ctx.must("asıl", ctx.api.get(`/api/workspace/invoices/${purchase.id}`));
    assert.equal(original.number, "A 004512");
  });

  test("MM1: kullanıcının düzelttiği referans (öneriden farklı) korunur; Düzenle'de referans kalır; asıl 16 haneli e-Belgede davranış aynı (referans yok sayılır)", async () => {
    const ctx = await setup();
    open.push(ctx);
    const purchase = await ctx.must("kâğıt alış", ctx.post("/api/workspace/invoices", { kind: "purchase", accountId: ctx.ids.paperSupplier, issueDate: ctx.day(-20), number: "KR-77/2026", profile: "KAGIT", lines: [{ name: "Kağıt", qty: 10, unitPrice: 50, vatRate: 20, goods: true }], payment: { rest: "open" } }));
    const calc = await ctx.must("calc", ctx.post("/api/workspace/invoices/calc", { kind: "purchase_return", originalId: purchase.id, lines: [{ originLineId: purchase.lines[0].id, qty: 1 }], payment: {} }));
    assert.equal(calc.returnRef.suggested, "KR00000000772026");
    const saved = await ctx.must("iade", ctx.post("/api/workspace/invoices", { kind: "purchase_return", originalId: purchase.id, issueDate: ctx.day(-2), lines: [{ originLineId: purchase.lines[0].id, qty: 1 }], payment: {}, returnRef: "KRS2026000000077", eSend: "later" }));
    assert.equal(saved.returnRef, "KRS2026000000077");
    const edited = await ctx.must("düzenle", ctx.post(`/api/workspace/invoices/${saved.id}/edit`, { kind: "purchase_return", originalId: purchase.id, issueDate: ctx.day(-2), lines: [{ originLineId: purchase.lines[0].id, qty: 2 }], payment: {}, eSend: "later" }));
    assert.equal(edited.returnRef, "KRS2026000000077", "referans alanı gönderilmeyen Düzenle'de kalır");
    assert.match(await ctx.xmlOf(saved.id), /<cbc:ID>KRS2026000000077<\/cbc:ID>/);
    // Asıl e-Belge (16 haneli): referans yok sayılır, UBL asıl numarayı taşır (önceki davranış).
    const ePurchase = await ctx.must("e-Fatura alış", ctx.post("/api/workspace/invoices", { kind: "purchase", accountId: ctx.ids.ticari, issueDate: ctx.day(-10), number: "TCR2026000000011", profile: "TEMELFATURA", lines: [{ name: "Toner", qty: 3, unitPrice: 500, vatRate: 20, goods: true }], payment: { rest: "open" } }));
    const calc2 = await ctx.must("calc", ctx.post("/api/workspace/invoices/calc", { kind: "purchase_return", originalId: ePurchase.id, lines: [{ originLineId: ePurchase.lines[0].id, qty: 1 }], payment: {} }));
    assert.equal(calc2.returnRef.needed, false);
    const back = await ctx.must("iade", ctx.post("/api/workspace/invoices", { kind: "purchase_return", originalId: ePurchase.id, issueDate: ctx.day(-1), lines: [{ originLineId: ePurchase.lines[0].id, qty: 1 }], payment: {}, returnRef: "XXX0000000000001", eSend: "later" }));
    assert.equal(back.returnRef, "");
    assert.match(await ctx.xmlOf(back.id), /<cac:InvoiceDocumentReference><cbc:ID>TCR2026000000011<\/cbc:ID>/);
  });
});

describe("gg243 dar kontrol 2: iade belgesinde e-Fatura profili yalnız Temel Fatura (MM2)", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("MM2: Ticari profilli tedarikçiye (ve varsayılan senaryo Ticari iken) alıştan iade TEMELFATURA kesilir; Ticari isteği Temel'e döner; UBL GİB'e UYGUN", async () => {
    const ctx = await setup();
    open.push(ctx);
    assert.equal((await ctx.api.put("/api/workspace/invoices/settings", { defaults: { efaturaProfile: "TICARIFATURA" } })).status, 200);
    const purchase = await ctx.must("ticari alış", ctx.post("/api/workspace/invoices", { kind: "purchase", accountId: ctx.ids.ticari, issueDate: ctx.day(-17), number: "TCR2026000000011", profile: "TICARIFATURA", lines: [{ name: "Toner", qty: 10, unitPrice: 500, vatRate: 20, goods: true }], payment: { rest: "open" } }));
    const body = { kind: "purchase_return", originalId: purchase.id, issueDate: ctx.day(-16), lines: [{ originLineId: purchase.lines[0].id, qty: 2 }], payment: {} };
    const calc = await ctx.must("calc", ctx.post("/api/workspace/invoices/calc", body));
    assert.equal(calc.profile, "TEMELFATURA");
    assert.deepEqual(calc.profiles.map(item => item.id), ["TEMELFATURA"]);
    const back = await ctx.must("iade", ctx.post("/api/workspace/invoices", { ...body, eSend: "now" }));
    assert.equal(back.profile, "TEMELFATURA");
    assert.equal(back.typeCode, "IADE");
    assert.equal(back.autoSend?.ok, true, JSON.stringify(back.autoSend));
    assert.equal(describeErrors(await validateInvoice(await ctx.xmlOf(back.id))), "", "UBL 2.1 XSD + GİB şematronu UYGUN");
    // Formda kalmış Ticari seçimi: Temel Fatura olur (400 değil).
    const asked = await ctx.must("iade (Ticari isteği)", ctx.post("/api/workspace/invoices", { ...body, issueDate: ctx.day(-15), profile: "TICARIFATURA", eSend: "later" }));
    assert.equal(asked.profile, "TEMELFATURA");
    // Satış faturasında Ticari seçimi sürer (yalnız iadede kural).
    const sale = await ctx.post("/api/workspace/invoices/calc", { scenario: "service_sale", accountId: ctx.ids.ticari, lines: LINES, payment: { rest: "open" } });
    assert.equal(sale.data.profile, "TICARIFATURA");
  });

  test("MM2: eski sürümde Ticari Fatura olarak kaydedilmiş iade gönderilmeden önce nedenli durur; Düzenle ile Temel Fatura olur (numara aynı) ve gönderilir", async () => {
    const ctx = await setup();
    open.push(ctx);
    const purchase = await ctx.must("ticari alış", ctx.post("/api/workspace/invoices", { kind: "purchase", accountId: ctx.ids.ticari, issueDate: ctx.day(-17), number: "TCR2026000000012", profile: "TICARIFATURA", lines: [{ name: "Toner", qty: 10, unitPrice: 500, vatRate: 20, goods: true }], payment: { rest: "open" } }));
    const back = await ctx.must("iade", ctx.post("/api/workspace/invoices", { kind: "purchase_return", originalId: purchase.id, issueDate: ctx.day(-16), lines: [{ originLineId: purchase.lines[0].id, qty: 2 }], payment: {} }));
    assert.ok(back.number.startsWith("TEF"));
    // 2.4.2 / 276f94e'nin yazdığı durum (TICARIFATURA + IADE, numaralı, gönderilmemiş).
    ctx.server.app.store.run("UPDATE invoices SET profile = 'TICARIFATURA' WHERE id = ?", back.id);
    const send = await ctx.post(`/api/workspace/invoices/${back.id}/send`, {});
    assert.equal(send.status, 409, JSON.stringify(send.data));
    assert.equal(send.data.code, "einvoice-return-reference");
    assert.match(send.data.error, /yalnız Temel Fatura senaryosuyla gönderilir .*Düzenle ile açıp kaydedin/);
    assert.equal(ctx.edm.state.sent.length, 0, "EDM'ye gitmedi");
    const edited = await ctx.must("düzenle", ctx.post(`/api/workspace/invoices/${back.id}/edit`, { kind: "purchase_return", originalId: purchase.id, issueDate: ctx.day(-16), profile: "TICARIFATURA", lines: [{ originLineId: purchase.lines[0].id, qty: 2 }], payment: {} }));
    assert.equal(edited.profile, "TEMELFATURA");
    assert.equal(edited.number, back.number, "numara değişmedi");
    assert.equal((await ctx.post(`/api/workspace/invoices/${back.id}/send`, {})).status, 200);
  });
});

describe("gg243 dar kontrol 2: Kes, Sonra Gönder kronolojisi (B5) ve kronoloji engelli belgenin iletisi (B7)", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("B5: serinin son numaralısından eski tarihli Kes, Sonra Gönder kaydedilmez (D4 iletisi); aynı gün ve daha yeni kaydedilir", async () => {
    const ctx = await setup();
    open.push(ctx);
    const numbered = await ctx.must("Kaydet ve Gönder", ctx.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.ids.ayse, issueDate: ctx.day(-2), lines: LINES, payment: { rest: "open" }, eSend: "now" }));
    assert.equal(numbered.number, "TEA2026000000001");
    const before = ctx.count();
    const old = await ctx.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.ids.ayse, issueDate: ctx.day(-5), lines: LINES, payment: { rest: "open" }, eSend: "later" });
    assert.equal(old.status, 400, JSON.stringify(old.data));
    assert.equal(old.data.code, "chronology");
    assert.equal(old.data.error, "TEA serisinde son gönderilen belge TEA2026000000001 16.10.2026 tarihli; numarası gönderimde verilecek bu belge ondan eski tarihli olamaz (numara ve tarih sırası).");
    assert.equal(ctx.count(), before, "kayıt açılmadı");
    for (const offset of [-2, -1]) await ctx.must(`Kes, Sonra Gönder ${offset}`, ctx.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.ids.ayse, issueDate: ctx.day(offset), lines: LINES, payment: { rest: "open" }, eSend: "later" }));
    // Başka seri (TEF) etkilenmez: TEF'de numara yok, eski tarih serbest.
    await ctx.must("TEF eski", ctx.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.ids.ticari, issueDate: ctx.day(-9), lines: LINES, payment: { rest: "open" }, eSend: "later" }));
  });

  test("B7: kronoloji engelli bekleyenin iletisi yalnız açık yolu söyler — Müşteri Fişi sırası izin vermiyorsa Listeden Sil önerilmez", async () => {
    const ctx = await setup();
    open.push(ctx);
    // Ön koşul (programın kendi yolu): kimliksiz cariye mükellef numaralı e-Arşiv bekleyen (kalıcı engelli; seriyi bekletmez), sonra seride daha yeni
    // numara verilir; ardından mükellef sorgusu "mükellef değil" der (kayıt defterinden düşer) → belge kronoloji engelli kalır.
    assert.equal((await ctx.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN })).status, 200);
    const stuck = await ctx.must("engelli bekleyen", ctx.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.ids.retail, issueDate: ctx.day(-5), lines: LINES, payment: { rest: "open" }, eSend: "later", buyer: { name: "Alıcı Ticaret", taxNo: BUYER_VKN } }));
    await ctx.must("daha yeni numaralı", ctx.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.ids.ayse, issueDate: ctx.day(-3), lines: LINES, payment: { rest: "open" }, eSend: "now" }));
    ctx.server.app.store.setSetting("einvoice.taxpayers", "{}");
    const head = "TEA serisinde son gönderilen belge TEA2026000000002 15.10.2026 tarihli; bu belge (13.10.2026) daha eski tarihli olduğu için e-Belge olarak gönderilemez.";
    // B4 (olderPending tek sorgu): kronoloji engelli (kalıcı) eski bekleyen yeni belgeyi BEKLETMEZ — sayım serinin son numaralısının tarihinden başlar.
    const fresh = await ctx.must("bugün Kaydet ve Gönder", ctx.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.ids.ayse, issueDate: ctx.day(-3), lines: LINES, payment: { rest: "open" }, eSend: "now" }));
    assert.equal(fresh.number, "TEA2026000000002", `kalıcı engelli eski belge bekletmedi: ${JSON.stringify(fresh.autoSend)}`);
    const card1 = await ctx.must("kart", ctx.api.get(`/api/workspace/invoices/${stuck.id}`));
    assert.equal(card1.sendBlock, `${head} Listeden Sil ile Müşteri Fişi olarak bırakın ya da İptal Et ile iptal edip bugünün tarihiyle yeniden kesin.`);
    // Müşteri Fişi serisine daha yeni fiş girer (başka bekleyen Listeden Silinir: FIS numarası 17.10).
    const other = await ctx.must("bekleyen", ctx.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.ids.ayse, issueDate: ctx.day(-1), lines: LINES, payment: { rest: "open" }, eSend: "later" }));
    await ctx.must("Listeden Sil", ctx.post(`/api/workspace/invoices/${other.id}/withdraw`, {}));
    const card2 = await ctx.must("kart", ctx.api.get(`/api/workspace/invoices/${stuck.id}`));
    assert.equal(card2.sendBlock, `${head} İptal Et ile iptal edip bugünün tarihiyle yeniden kesin.`);
    // İleti doğru: Listeden Sil gerçekten reddedilir (K31), İptal Et çalışır.
    const withdraw = await ctx.post(`/api/workspace/invoices/${stuck.id}/withdraw`, {});
    assert.equal(withdraw.status, 409);
    assert.equal(withdraw.data.code, "chronology");
    // Tümünü Gönder'in kalıcı engel sonucu da aynı ileti.
    const turn = await ctx.must("Tümünü Gönder", ctx.post("/api/workspace/invoices/send-pending", { all: true }));
    assert.equal(turn.results.find(item => item.id === stuck.id)?.message, card2.sendBlock);
    assert.equal((await ctx.post(`/api/workspace/invoices/${stuck.id}/cancel`, { reason: "Tarih sırası" })).status, 200);
  });
});
