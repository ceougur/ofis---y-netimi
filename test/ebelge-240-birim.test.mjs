// e-Belge ölçü birimi kodları (16.10.2026). İki şirket / on kullanıcı yük denemesinde gerçek EDM test ortamı Çuval'lı e-Faturaları "Geçersiz Ölçü
// Birim Kodu" (11059) ile reddetti; GİB şematronu bu kodları (SA…) geçerli sayıyordu — kâhinimiz entegratörü görmüyordu. KÂHİN: gerçek EDM'ye
// her aday kodla taslak yükleme sonucu (docs/kanit/2026-10-16/edm-birim/sonuc.txt) — programın kodundan değil, EDM'nin yanıtından.
//   Nasıl bozulur? Programın birim listesine (Çuval, Koli, Şişe, Rulo, Torba, Hafta…) EDM'nin kabul etmediği kod eşlenir → fatura numarası alınmış
//   belge EDM'de düşer; ya da Adet koduyla giden birimin adı kaybolur (alıcı "100 Adet" görür, "100 Çuval" değil).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { renderView, validateInvoice } from "../tools/ebelge/dogrula.mjs";
import { readUbl } from "../server/lib/einvoice/ubl-read.mjs";
import { UNITS } from "../server/lib/units.mjs";
import { unitCode } from "../server/lib/einvoice/ubl-tr.mjs";
import { BUYER_VKN, OUR_VKN } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

// Gerçek EDM test ortamında KABUL edilen kodlar (taslak yükleme 16.10.2026); RED: SA CT BO RO BG WEE KT CS CA CR JR TU BE BJ TN D97 BLL 26 GLL QT E54 IE KMT, X'li ambalaj kodları.
const EDM_KABUL = new Set(["C62", "KGM", "GRM", "TNE", "LTR", "MLT", "MTR", "CMT", "MMT", "MTK", "MTQ", "PA", "BX", "PR", "SET", "HUR", "DAY", "MON", "ANN", "MIN", "DZN", "NIU", "PK", "CMQ"]);
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

test("programın bütün birimleri entegratörün (EDM) kabul ettiği kodla gider", () => {
  const bad = UNITS.map(unit => [unit, unitCode(unit)]).filter(([, code]) => !EDM_KABUL.has(code));
  assert.deepEqual(bad, [], `EDM'nin reddettiği kod: ${JSON.stringify(bad)}`);
  for (const extra of ["Torba", "Porsiyon", "Ders", "Dakika", "Yıl"]) assert.ok(EDM_KABUL.has(unitCode(extra)), extra);
});

describe("Adet koduyla giden birimin adı belgede kalır; XML GİB/XSD'den geçer", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ edocEnabled: true });
    const client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), raw: url => client.raw("GET", url) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" }, efatura: true, earsiv: true });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
  });
  after(async () => server?.close());

  test("Çuval / Hafta / Kg kalemli e-Fatura", async () => {
    const account = await api.post("/api/workspace/accounts", { name: "Alıcı İnşaat A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
    const lines = [{ name: "Portland Çimento 50 Kg", unit: "Çuval", qty: 100, unitPrice: 285, vatRate: 20 }, { name: "Vinç Kiralama", unit: "Hafta", qty: 2, unitPrice: 5000, vatRate: 20 }, { name: "İnşaat Demiri", unit: "Kg", qty: 1000, unitPrice: 28.5, vatRate: 20 }];
    const doc = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.data.id, lines, payment: { rest: "open" } });
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    const xml = String((await api.raw(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).buffer || (await api.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).data);
    const codes = [...xml.matchAll(/unitCode="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(codes, ["C62", "C62", "KGM"]);
    assert.match(xml, /<cbc:Note>Birim: Çuval<\/cbc:Note>/);
    assert.match(xml, /<cbc:Note>Birim: Hafta<\/cbc:Note>/);
    assert.doesNotMatch(xml, /Birim: Kg/);
    const check = await validateInvoice(xml, { type: "efatura" });
    assert.deepEqual({ xsd: check.xsd.length, gib: check.schematron.map(item => item.text) }, { xsd: 0, gib: [] });
  });

  // Kontrol turu 5: açıklamalı kalemde birim notu görünümde çıkmıyordu (XSLT 1.0 value-of ilk Note'u yazar); Düzine (DZN) görünümde ham kod;
  // gelen e-Faturada birim notu açıklamaya karışıyordu.
  test("açıklamalı kalemde birim notu görünümde; Düzine adıyla; gelen e-Faturada birim geri okunur", async () => {
    const account = await api.post("/api/workspace/accounts", { name: "Alıcı Gıda A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
    const lines = [{ name: "Portland Çimento 50 Kg", description: "Teslim şantiyede", unit: "Çuval", qty: 10, unitPrice: 285, vatRate: 20 }, { name: "Yumurta", unit: "Düzine", qty: 2, unitPrice: 60, vatRate: 1 }];
    const doc = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.data.id, lines, payment: { rest: "open" } });
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    const xml = String((await api.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).data);
    const html = String(await renderView(xml)).replace(/\s+/g, " ");
    assert.match(html, /Teslim şantiyede/);
    assert.match(html, /Birim: Çuval/, "birim notu görünümde");
    assert.match(html, /2 Düzine/, "Düzine adıyla");
    const read = readUbl(xml);
    assert.deepEqual(read.lines.map(line => ({ unit: line.unit, description: line.description })), [{ unit: "Çuval", description: "Teslim şantiyede" }, { unit: "Düzine", description: "" }]);
  });
});

// Kontrol turu 6: gelen e-Fatura okuması — birim notu yalnız Adet kodlu kalemde ve SON not olarak; açıklama içe alma sınırında (300).
test("gelen e-Fatura: birim notu yalnız Adet kodunda, son not; uzun notlar kısaltılır", () => {
  const line = (code, notes) => `<cac:InvoiceLine><cbc:ID>1</cbc:ID>${notes.map(note => `<cbc:Note>${note}</cbc:Note>`).join("")}<cbc:InvoicedQuantity unitCode="${code}">10</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">100</cbc:LineExtensionAmount><cac:Item><cbc:Name>Kalem</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">10</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`;
  const doc = body => readUbl(`<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>ABC2026000000001</cbc:ID>${body}</Invoice>`).lines[0];
  const kg = doc(line("KGM", ["Birim: Koli"]));
  assert.deepEqual({ unit: kg.unit, description: kg.description }, { unit: "Kg", description: "Birim: Koli" });
  const own = doc(line("C62", ["Birim: Torba", "Birim: Çuval"]));
  assert.deepEqual({ unit: own.unit, description: own.description }, { unit: "Çuval", description: "Birim: Torba" });
  const long = doc(line("C62", ["a".repeat(200), "b".repeat(200)]));
  assert.ok(long.description.length <= 300, `açıklama ${long.description.length}`);
});

// Kontrol turu 7 (komşu, 2.3.0'dan): adı 200 / stok kodu 60 karakteri aşan gelen e-Fatura kalemi içe alınamıyordu (içe alma sınırları).
test("gelen e-Fatura: uzun kalem adı ve stok kodu içe alma sınırına kısaltılır; adın tamamı açıklamada", () => {
  const name = "Ad".repeat(150);
  const xml = `<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>ABC2026000000001</cbc:ID><cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">10</cbc:LineExtensionAmount><cac:Item><cbc:Name>${name}</cbc:Name><cac:SellersItemIdentification><cbc:ID>${"K".repeat(80)}</cbc:ID></cac:SellersItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">10</cbc:PriceAmount></cac:Price></cac:InvoiceLine></Invoice>`;
  const line = readUbl(xml).lines[0];
  assert.ok(line.name.length <= 200 && line.code.length <= 60 && line.description.length <= 300, JSON.stringify({ name: line.name.length, code: line.code.length, description: line.description.length }));
  assert.ok(line.description.startsWith(name.slice(0, 250)), "adın tamamı açıklamada (sınıra kadar)");
});

