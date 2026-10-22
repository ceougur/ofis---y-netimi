// 2.4.4 — uzman mali müşavir (31b) bulguları MM10, MM7/MM11, MM4 (+ alt kararı), MM1 ve uzman UI/UX (31f) U4/U6'nın SUNUCU tarafı. Rota düzeyinde, sahte EDM
// (test/einvoice-mock.mjs; e-SMM yolu test/esmm-mock.mjs), sahte saat (ders 13), lisans adresi yerel (ders 30). Ekran tarafı: test/e2e/gg244-esmm-gonder.mjs.
//
// "Nasıl bozulur?" (önce yazıldı; testler buradan):
//   B1 makbuz dili tek yüzde değişir (PDF / kart / form) ya da faturaya sızar (satış faturası PDF'i "Brüt Ücret" der)          → T3, T4
//   B2 ad değişirken tutar değişir: Net Ücret ≠ Brüt − Stopaj, Tahsil Edilen ≠ kayıtlı ödenecek, Tahsil Edilen KDV yanlış         → T3
//   B3 bırakılan makbuzun PDF'i "MÜŞTERİ FİŞİ … mali değeri yoktur" kalır; ya da faturada bırakılan Müşteri Fişi de değişir          → T6
//   B4 bırakılan makbuz tek Gönder / Tümünü / Seçilenleri Gönder ile yine e-SMM olur; engel seriyi bekletir; Müşteri Fişi'ninki de kapanır → T7, T8
//   B5 stopaj kalem başına olur ama UBL / defter / PDF / kart farklı kaynaktan okur (40,01 ↔ 40,02); eski kayıt UBL'de dağıtılamaz   → T1, T2
//   B6 e-SMM'de "e-Arşiv için VKN" kalır ya da e-Arşiv'in iletisi bozulur; makbuzda "iade faturasıyla düzeltin" kalır, faturada kaybolur → T5
//   B7 MM1 metni varsayılan stopajı değiştirir (gerçek kişi alıcıda otomatik oran 0 kalmalı)                                          → T9
//
// KÂHİN DEĞİLDİR (ders 5): bu dosya programla aynı elden yazıldı; beklenen sayılar GİB kuralından elle hesaplandı (aşağıdaki yorumlar). Bağımsız tutar kâhini
// test/bagimsiz/tutar (kodu görmeyen ayrı el) — stopaj ÇATAL'ı (B3.6) orada.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { find, parseXml, textOf, children } from "../server/lib/einvoice/xml-lite.mjs";
import { partyProblems } from "../server/lib/tax-id.mjs";
import { xsdErrors } from "../tools/ebelge/dogrula.mjs";
import { pdfText } from "./banka-210-ortak.mjs";
import { OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Hukuk Bürosu Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", email: "ayse@example.com" };
// Kimlik numarası yazılmamış müvekkil (MM11 a): e-SMM'de alıcı kimliği zorunlu.
const NO_ID = { name: "Kimliksiz Müvekkil", type: "customer", address: "Cumhuriyet Cd. 3", district: "Konak", city: "İzmir" };
const TODAY = "2026-06-17";
const flat = buffer => pdfText(buffer).replace(/\s+/g, " ");

async function boot() {
  resetEdmCaches();
  const edm = await startMockEdm();
  const fetchImpl = async (input, init = {}) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, esmmEnabled: true, fetchImpl, now: `${TODAY}T10:00:00`, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), raw: client.raw };
  const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const account = async body => {
    const created = await api.post("/api/workspace/accounts", body);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    return created.data.id || created.data.account?.id;
  };
  const ctx = { edm, server, api, clientId: await account(CLIENT), personId: await account(PERSON), noId: await account(NO_ID) };
  ctx.smm = async (extra = {}) => {
    const res = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: ctx.clientId, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, ...extra });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    return res.data;
  };
  ctx.sale = async (extra = {}) => {
    const res = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ctx.personId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, ...extra });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    return res.data;
  };
  ctx.card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  ctx.pdf = async id => {
    const res = await api.raw("GET", `/api/workspace/invoices/${id}/fatura.pdf`);
    assert.equal(res.status, 200, `PDF ${res.status}`);
    return flat(res.buffer);
  };
  ctx.xml = async id => {
    const res = await api.get(`/api/workspace/invoices/${id}/ubl.xml`);
    assert.equal(res.status, 200, `ubl.xml ${res.status}`);
    const xml = typeof res.data === "string" ? res.data : res.text;
    return { xml, tree: find(parseXml(xml), "Invoice") };
  };
  ctx.trial = async code => Number((await api.get("/api/workspace/ledger")).data.trial.accounts.find(row => row.code === code)?.balance || 0);
  ctx.smmCalls = () => ctx.edm.state.smm.calls.map(call => call.op);
  ctx.close = async () => {
    await server.close();
    await edm.close();
  };
  return ctx;
}
const subtotals = taxTotal => children(taxTotal, "TaxSubtotal").map(sub => [textOf(find(sub, "TaxCategory/TaxScheme/TaxTypeCode")), textOf(find(sub, "TaxableAmount")), textOf(find(sub, "TaxAmount"))]);
const totalsOf = tree => Object.fromEntries(find(tree, "LegalMonetaryTotal").children.map(item => [item.name, textOf(item)]));
const round2 = value => Math.round(value * 100) / 100;

describe("MM10 — stopaj KDV ile aynı kuralla kalem başına yuvarlanır; kart, defter, UBL ve PDF aynı sayı", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  // El hesabı (GİB UBL-TR: her vergi kalem düzeyinde, belge = Σ kalem): kalem 100,03 × %20 = 20,006 → 20,01 (yarım kuruş yukarı); KDV 20,01 + 20,01 = 40,02;
  // stopaj 20,01 + 20,01 = 40,02 (eski kural: 200,06 × %20 = 40,012 → 40,01); Net Ücret 200,06 − 40,02 = 160,04; Tahsil Edilen 160,04 + 40,02 = 200,06.
  test("T1 2 × 100,03 (KDV %20, stopaj %20): stopaj 40,02 = KDV 40,02; ödenecek 200,06; 193 defterde 40,02; UBL 0003 40,02 (kalem 20,01 + 20,01), XSD temiz", async () => {
    const before193 = await ctx.trial("193");
    const before120 = await ctx.trial("120");
    const doc = await ctx.smm({ lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 100.03, vatRate: 20 }, { name: "Dilekçe", qty: 1, unitPrice: 100.03, vatRate: 20 }], eSend: "now" });
    const card = await ctx.card(doc.id);
    assert.equal(card.vatTotal, 40.02, "KDV kalem başına");
    assert.equal(card.stoppageTotal, 40.02, `stopaj kalem başına (KDV ile aynı kural); program: ${card.stoppageTotal}`);
    assert.equal(card.payableTotal, 200.06, "Tahsil Edilen = brüt − stopaj + KDV");
    assert.equal(round2((await ctx.trial("193")) - before193), 40.02, "defter: 193 Peşin Ödenen Vergiler (stopaj) 40,02");
    assert.equal(round2((await ctx.trial("120")) - before120), 200.06, "defter: 120 Alıcılar 200,06");
    const { xml, tree } = await ctx.xml(doc.id);
    assert.deepEqual(subtotals(find(tree, "TaxTotal")), [["0003", "200.06", "40.02"], ["0015", "200.06", "40.02"]], "belge vergileri: 0003 ve 0015 aynı matrah, aynı tutar");
    assert.deepEqual(totalsOf(tree), { LineExtensionAmount: "200.06", TaxExclusiveAmount: "160.04", TaxInclusiveAmount: "40.02", PayableAmount: "200.06" });
    const lines = children(tree, "InvoiceLine");
    assert.deepEqual(lines.map(line => subtotals(find(line, "TaxTotal")).find(item => item[0] === "0003")[2]), ["20.01", "20.01"], "kalem stopajı = kalem matrahı × oran");
    assert.deepEqual(lines.map(line => [textOf(find(line, "InvoicedQuantity")), textOf(find(line, "Price/PriceAmount"))]), [["80.02", "100.03"], ["80.02", "100.03"]], "kalem Net Ücret ve Net Tahsilat");
    assert.deepEqual(await xsdErrors(xml), [], "UBL 2.1 + UBL-TR 1.2.1 XSD");
    assert.equal(ctx.edm.state.smm.sent.at(-1)?.id, card.number, "EDM'ye giden makbuz aynı numara");
    const pdf = await ctx.pdf(doc.id);
    assert.match(pdf, /Gelir Vergisi Stopajı %20 − 40,02 TL/, "PDF stopaj 40,02");
    assert.match(pdf, /KDV %20 40,02 TL/, "PDF KDV 40,02");
    assert.match(pdf, /Tahsil Edilen \(Net Alınan\) 200,06 TL/, "PDF tahsil edilen");
  });

  test("T2 Netten Brüte çok kalemde kalem başına stopajla çözer: kaydedilen makbuzun Net Ücreti yazılan tutara eşit", async () => {
    // İkinci kalem 100,03 (net ücreti 100,03 − 20,01 = 80,02); hedef 160,04 → ilk kalemin net ücreti 80,02: en küçük brüt 100,02 (100,02 − 20,00).
    const form = { scenario: "smm", accountId: ctx.clientId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 0, vatRate: 20 }, { name: "Dilekçe", qty: 1, unitPrice: 100.03, vatRate: 20 }], payment: { rest: "open" } };
    const found = await ctx.api.post("/api/workspace/invoices/gross-from-net", { ...form, net: "160,04" });
    assert.equal(found.status, 200, JSON.stringify(found.data));
    const doc = await ctx.smm({ ...form, lines: [{ ...form.lines[0], unitPrice: found.data.unitPrice }, form.lines[1]] });
    const card = await ctx.card(doc.id);
    assert.equal(round2(card.netTotal - card.stoppageTotal), 160.04, `Net Ücret = hedef (brüt ${card.netTotal}, stopaj ${card.stoppageTotal}, birim fiyat ${found.data.unitPrice})`);
    assert.equal(card.stoppageTotal, round2(card.lines.reduce((sum, line) => sum + Math.round(line.net * 20) / 100, 0)), "belge stopajı = Σ kalem (matrah × %20, kuruşa)");
  });
});

describe("MM7 / MM11 / U4 — makbuz dili: GİB e-SMM adları, makbuzda iade yok; fatura aynen", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });

  // El hesabı: 10.000 brüt, stopaj %20 = 2.000 → Net Ücret 8.000; KDV %20 = 2.000; tevkifat 602 (9/10) = 1.800 → Tahsil Edilen KDV 200; Tahsil Edilen 8.200.
  test("T3 tevkifatlı e-SMM PDF'i: Makbuz No, Brüt Ücret 10.000, Gelir Vergisi Stopajı 2.000, Net Ücret 8.000, KDV 2.000, KDV Tevkifatı 1.800, Tahsil Edilen KDV 200, Tahsil Edilen 8.200; fatura dili yok", async () => {
    const doc = await ctx.smm({ lines: [{ name: "Hukuki Danışmanlık", qty: 1, unitPrice: 10000, vatRate: 20, withholdingCode: "602" }], eSend: "now" });
    const card = await ctx.card(doc.id);
    assert.deepEqual([card.netTotal, card.stoppageTotal, card.vatTotal, card.withheldTotal, card.payableTotal], [10000, 2000, 2000, 1800, 8200], "tutarlar değişmedi");
    const pdf = await ctx.pdf(doc.id);
    for (const [label, value] of [["Makbuz No", card.number], ["Brüt Ücret", "10.000,00 TL"], ["Gelir Vergisi Stopajı %20", "− 2.000,00 TL"], ["Net Ücret", "8.000,00 TL"], ["KDV %20", "2.000,00 TL"], ["KDV Tevkifatı", "− 1.800,00 TL"], ["Tahsil Edilen KDV", "200,00 TL"], ["Tahsil Edilen \\(Net Alınan\\)", "8.200,00 TL"]]) assert.match(pdf, new RegExp(`${label} ${value.replace(/[.()]/g, "\\$&")}`), `PDF satırı: ${label} ${value}`);
    for (const wrong of ["Fatura No", "Fatura Tipi", "Vergiler Dahil Toplam", "Mal / Hizmet Toplamı", "Ödenecek Tutar", "kalan vadeli"]) assert.ok(!pdf.includes(wrong), `PDF'te fatura dili yok: "${wrong}"`);
  });

  test("T4 komşu: satış faturası (e-Arşiv) PDF'i fatura dilinde kalır (Fatura No, Vergiler Dahil Toplam, Ödenecek Tutar, kalan vadeli)", async () => {
    const sale = await ctx.sale({ dueDate: "2026-07-17", eSend: "now" });
    const pdf = await ctx.pdf(sale.id);
    for (const right of ["Fatura No", "Vergiler Dahil Toplam", "Ödenecek Tutar", "kalan vadeli", "Mal / Hizmet"]) assert.ok(pdf.includes(right), `fatura PDF'inde "${right}"`);
    for (const wrong of ["Makbuz No", "Brüt Ücret", "Net Ücret", "Tahsil Edilen"]) assert.ok(!pdf.includes(wrong), `fatura PDF'inde makbuz dili yok: "${wrong}"`);
  });

  test("T5 MM11: e-SMM'de kimlik iletisi e-SMM der (e-Arşiv değil); e-Arşiv'inki aynen", async () => {
    const calc = async body => (await ctx.api.post("/api/workspace/invoices/calc", body)).data;
    const smmCalc = await calc({ scenario: "smm", accountId: ctx.noId, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }] });
    assert.equal(smmCalc.profile, "ESMM", "ön koşul: e-SMM");
    assert.ok(smmCalc.partyProblems.some(text => /^Cari \(alıcı\): e-SMM için VKN ya da TCKN zorunludur/.test(text)), `e-SMM iletisi: ${JSON.stringify(smmCalc.partyProblems)}`);
    assert.ok(!smmCalc.partyProblems.some(text => /e-Arşiv/.test(text)), "e-SMM iletisinde e-Arşiv yok");
    const saleCalc = await calc({ scenario: "service_sale", accountId: ctx.noId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }] });
    assert.equal(saleCalc.profile, "EARSIVFATURA", "ön koşul: e-Arşiv");
    assert.ok(saleCalc.partyProblems.some(text => /^Cari \(alıcı\): e-Arşiv için VKN ya da TCKN zorunludur/.test(text)), `e-Arşiv iletisi aynen: ${JSON.stringify(saleCalc.partyProblems)}`);
    // Doğrudan kural (tax-id.mjs): ESMM e-Arşiv'in kurallarıyla (nihai tüketici 11111111111 kabul) ama kendi adıyla.
    assert.deepEqual(partyProblems({ name: "Nihai Tüketici", taxNo: "11111111111", city: "Ankara" }, { profile: "ESMM", role: "buyer", payable: 100 }), [], "e-SMM'de 11111111111 e-Arşiv'deki gibi geçer");
  });

  test("T5b U4: gönderilmiş makbuzun Düzenle nedeni iade önermez (makbuzdan iade belgesi olmaz, yol İptal Et); faturada iade önerisi aynen", async () => {
    const sentSmm = await ctx.smm({ eSend: "now" });
    const smmCard = await ctx.card(sentSmm.id);
    assert.equal(smmCard.eStatus, "sent", smmCard.eMessage);
    assert.equal(smmCard.canModify, false);
    assert.ok(!/iade/i.test(smmCard.modifyBlock.replace("makbuzdan iade belgesi olmaz", "")), `makbuzun Düzenle nedeni iade önermez: "${smmCard.modifyBlock}"`);
    assert.match(smmCard.modifyBlock, /İptal Et ile iptal edip yeniden kesin/, smmCard.modifyBlock);
    const sentSale = await ctx.sale({ eSend: "now" });
    const saleCard = await ctx.card(sentSale.id);
    assert.match(saleCard.modifyBlock, /İptal ya da iade faturasıyla düzeltin/, `fatura aynen: ${saleCard.modifyBlock}`);
  });
});

describe("MM4 + alt karar — kâğıt makbuz olarak bırakılan makbuz Serbest Meslek Makbuzu olarak basılır ve e-SMM olarak gönderilmez; Müşteri Fişi aynen", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
    // Ön koşul (her testin kırmızısı kendi nedeniyle görünsün — ders 38): Gönderilecekler'den bırakılmış bir makbuz ve bir satış faturası.
    const makbuz = await ctx.smm({ eSend: "later" });
    const left = await ctx.api.post(`/api/workspace/invoices/${makbuz.id}/withdraw`, {});
    assert.equal(left.status, 200, JSON.stringify(left.data));
    assert.match(left.data.number, /^SMM2026\d{9}$/, "kâğıt makbuz serisi");
    ctx.paper = left.data;
    const sale = await ctx.sale({ eSend: "later" });
    const fis = await ctx.api.post(`/api/workspace/invoices/${sale.id}/withdraw`, {});
    assert.equal(fis.status, 200, JSON.stringify(fis.data));
    assert.match(fis.data.number, /^FIS2026\d{9}$/, "Müşteri Fişi serisi");
    ctx.fis = fis.data;
  });
  after(async () => {
    await ctx?.close();
  });

  test("T6 bırakılan makbuzun PDF'i: SERBEST MESLEK MAKBUZU, Makbuz No SMM…, mali değeri yoktur YAZMAZ; faturada bırakılan belge MÜŞTERİ FİŞİ kalır", async () => {
    const pdf = await ctx.pdf(ctx.paper.id);
    assert.ok(pdf.includes("SERBEST MESLEK MAKBUZU"), `başlık: ${pdf.slice(0, 160)}`);
    assert.ok(!pdf.includes("MÜŞTERİ FİŞİ") && !/mali değeri yoktur/.test(pdf), "Müşteri Fişi / mali değeri yoktur yazmaz");
    assert.match(pdf, new RegExp(`Makbuz No ${ctx.paper.number}`), "Makbuz No kâğıt makbuz numarası");
    assert.match(pdf, /Kâğıt serbest meslek makbuzu: e-SMM olarak gönderilmedi\./);
    const salePdf = await ctx.pdf(ctx.fis.id);
    assert.ok(salePdf.includes("MÜŞTERİ FİŞİ") && /resmî fatura yerine geçmez ve mali değeri yoktur/.test(salePdf), "faturada bırakılan belge Müşteri Fişi kalır");
  });

  test("T7 bırakılan makbuz e-SMM olarak gönderilmez: kartta Gönder yok ve nedeni yazar; tek Gönder 409 (EDM'ye istek yok); numara ve durum değişmez", async () => {
    const card = await ctx.card(ctx.paper.id);
    assert.equal(card.eStatus, "withdrawn");
    assert.equal(card.canSend, false, "Gönder düğmesi yok");
    assert.match(card.sendBlock, /^Kâğıt makbuz olarak düzenlendi; e-SMM gönderilmez/, `neden kartta: "${card.sendBlock}"`);
    const before = ctx.smmCalls().length;
    const sent = await ctx.api.post(`/api/workspace/invoices/${ctx.paper.id}/send`, {});
    assert.equal(sent.status, 409, JSON.stringify(sent.data));
    assert.equal(sent.data.code, "einvoice-paper-receipt");
    assert.deepEqual(ctx.smmCalls().slice(before), [], "e-SMM servisine istek yok (giriş dahil)");
    const row = ctx.server.app.store.get("SELECT profile, number, e_status AS eStatus, e_message AS eMessage FROM invoices WHERE id = ?", ctx.paper.id);
    assert.deepEqual([row.profile, row.number, row.eStatus], ["KAGIT", ctx.paper.number, "withdrawn"], "makbuz kâğıt makbuz olarak kaldı");
    assert.ok(!/Kâğıt makbuz olarak düzenlendi/.test(row.eMessage || ""), "engel belgenin e-Belge iletisine yazılmaz (kart nedeni sendBlock'tan okur)");
  });

  test("T8 Tümünü / Seçilenleri Gönder bırakılan makbuzu göndermez, seriyi bekletmez; Müşteri Fişi'nin yeniden gönderimi açık (değişmez)", async () => {
    const waiting = await ctx.smm({ eSend: "later" });
    const before = ctx.edm.state.smm.sent.length;
    const only = await ctx.api.post("/api/workspace/invoices/send-pending", { only: [ctx.paper.id, waiting.id] });
    assert.equal(only.status, 200, JSON.stringify(only.data));
    const byId = Object.fromEntries(only.data.results.map(item => [item.id, item]));
    assert.equal(byId[ctx.paper.id]?.ok, false, `bırakılan makbuz gönderilmedi: ${JSON.stringify(byId[ctx.paper.id])}`);
    assert.equal(byId[waiting.id]?.ok, true, `aynı turda bekleyen makbuz gitti (seri bekletilmedi): ${JSON.stringify(byId[waiting.id])}`);
    assert.deepEqual(ctx.edm.state.smm.sent.slice(before).map(item => item.id), [(await ctx.card(waiting.id)).number], "EDM'ye yalnız bekleyen makbuz");
    const all = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(all.status, 200, JSON.stringify(all.data));
    assert.ok(!all.data.results.some(item => item.id === ctx.paper.id && item.ok), "Tümünü Gönder bırakılan makbuzu göndermez");
    assert.equal((await ctx.card(ctx.paper.id)).eStatus, "withdrawn");
    const fisCard = await ctx.card(ctx.fis.id);
    assert.equal(fisCard.canSend, true, "Müşteri Fişi yine e-Belge olarak gönderilebilir");
    const resend = await ctx.api.post(`/api/workspace/invoices/${ctx.fis.id}/send`, {});
    assert.equal(resend.status, 200, JSON.stringify(resend.data));
    assert.equal(resend.data.profile, "EARSIVFATURA");
  });
});

describe("MM1 — yalnız metin: gerçek kişi alıcıda varsayılan stopaj değişmez", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(async () => {
    await ctx?.close();
  });
  test("T9 gerçek kişi alıcı, oran boş → stopaj 0 (eski davranış); tüzel alıcı → %20", async () => {
    const person = await ctx.smm({ accountId: ctx.personId });
    assert.equal((await ctx.card(person.id)).stoppageRate, 0);
    const firm = await ctx.smm();
    assert.equal((await ctx.card(firm.id)).stoppageRate, 20);
  });
});
