// e-Belge XML uygunluğu (fatura modülü Adım 1, docs/fatura/E-BELGE-EDM.md §3): programın GERÇEK API'sinden kaydedilen faturaların
// UBL-TR XML'i, programdan BAĞIMSIZ iki kâhine karşı denetlenir — OASIS UBL 2.1 XSD'si ve GİB'in resmî UBL-TR şematronu (e-FaturaPaketi,
// 21.08.2026; tools/ebelge/sema/KAYNAK.md). Beklenen sonuç programın kodundan türetilmez: "hata yok" GİB'in kuralıdır.
// Aracın dişi ayrıca gösterilir: bilerek bozulan belge düşer (yanlış sürüm, numara biçimi, kur yok, boş saat, yanlış kip).
// Kırmızı kanıt: bu testler 2.3.0 kodunda (ec1ef3f) imza yuvası, 308 istisna kodu ve iade referansı yüzünden kırmızıdır
// (docs/kanit/2026-10-16/ebelge-uygunluk-eski).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { EXEMPTIONS, WITHHOLDING } from "../server/lib/invoice-math.mjs";
import { SEMA, oasisXsdErrors, renderView, schematronErrors, ublTrXsdErrors, validateInvoice, withSignatureSlot, xsdErrors } from "../tools/ebelge/dogrula.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

// VKN denetim hanesi (GİB algoritması) ile geçerli VKN.
function vkn(nine) {
  const digits = String(nine).padStart(9, "0").split("").map(Number);
  let sum = 0;
  digits.forEach((digit, index) => {
    const tmp = (digit + (9 - index)) % 10;
    let value = (tmp * 2 ** (9 - index)) % 9;
    if (tmp !== 0 && value === 0) value = 9;
    sum += value;
  });
  return `${digits.join("")}${(10 - (sum % 10)) % 10}`;
}
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const line = (extra = {}) => ({ name: "Danışmanlık", qty: 2, unitPrice: 500, vatRate: 20, ...extra });
const describeErrors = result => [...result.xsd.map(error => `XSD: ${error}`), ...result.schematron.map(error => `GİB: ${error.text} [${error.location}]`)].join("\n");

let server;
let api;
const ids = {};
async function xmlOf(invoiceId) {
  const response = await api.get(`/api/workspace/invoices/${invoiceId}/ubl.xml`);
  assert.equal(response.status, 200, `ubl.xml ${response.status}`);
  const xml = typeof response.data === "string" ? response.data : response.text;
  assert.match(xml, /^<\?xml/, "yanıt XML değil");
  return xml;
}
async function issue(body) {
  const response = await api.post("/api/workspace/invoices", body);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data;
}

before(async () => {
  server = await startTestServer({ edocEnabled: true, fxEnabled: true });
  const client = server.client();
  api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const saved = await api.put("/api/workspace/invoices/settings", {
    seller: { name: "Deneme Ofis Ltd. Şti.", taxNo: vkn(123456789), taxOffice: "Çankaya", address: "Atatürk Blv. No:1", district: "Çankaya", city: "Ankara", postalCode: "06100", email: "bilgi@deneme.com.tr", phone: "03121234567" },
    efatura: true,
    earsiv: true,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const account = async body => {
    const response = await api.post("/api/workspace/accounts", body);
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.id || response.data.account?.id;
  };
  ids.eFirm = await account({ name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: vkn(987654321), taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
  ids.paperFirm = await account({ name: "Kâğıtçı Ltd.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir" });
  ids.person = await account({ name: "Ayşe Yılmaz", type: "customer", taxNo: "10000000146", city: "İzmir", address: "Alsancak 3", district: "Konak", email: "ayse@example.com" });
  ids.supplier = await account({ name: "Toptancı A.Ş.", type: "supplier", taxNo: vkn(555444333), taxOffice: "Kadıköy", address: "Bağdat Cd. 7", district: "Kadıköy", city: "İstanbul", eInvoice: true, eAlias: "urn:mail:defaultpk@toptanci.com.tr" });
});
after(async () => {
  await server?.close();
});

describe("Kâhin aracı: GİB şematronu ve UBL 2.1 XSD bozuk belgeyi yakalar (aracın dişi)", () => {
  let good;
  before(async () => {
    good = await xmlOf((await issue({ scenario: "service_sale", accountId: ids.eFirm, lines: [line()], payment: { rest: "open" } })).id);
  });
  test("bozulmamış belge iki denetimden de geçer ve şematron kural çalıştırır", async () => {
    const result = await validateInvoice(good);
    assert.equal(describeErrors(result), "");
  });
  const mutations = [
    ["CustomizationID TR1.0 (eski sürüm)", xml => xml.replace("<cbc:CustomizationID>TR1.2</cbc:CustomizationID>", "<cbc:CustomizationID>TR1.0</cbc:CustomizationID>"), /CustomizationID/],
    ["fatura numarası GİB biçiminde değil", xml => xml.replace(/(<\/cbc:ProfileID><cbc:ID>)[^<]+/, "$1FIS-1"), /ABC2009123456789/],
    ["döviz faturasında kur yok", xml => xml.replace(/<cbc:DocumentCurrencyCode>TRY</, "<cbc:DocumentCurrencyCode>USD<"), /kur bilgisi zorunludur/],
    ["geçersiz profil", xml => xml.replace("<cbc:ProfileID>TEMELFATURA</cbc:ProfileID>", "<cbc:ProfileID>OZELSENARYO</cbc:ProfileID>"), /ProfileID/],
  ];
  for (const [name, mutate, expected] of mutations) {
    test(`şematron düşürür: ${name}`, () => {
      const broken = mutate(good);
      assert.notEqual(broken, good, "bozma uygulanamadı");
      const errors = schematronErrors(broken);
      assert.ok(errors.some(error => expected.test(error.text)), `beklenen GİB hatası yok; gelen: ${errors.map(error => error.text).join(" | ") || "hiç"}`);
    });
  }
  test("XSD düşürür: boş IssueTime ve boş imza yuvası", async () => {
    const emptyTime = good.replace(/<cbc:IssueTime>[^<]*<\/cbc:IssueTime>/, "<cbc:IssueTime></cbc:IssueTime>");
    assert.ok((await xsdErrors(emptyTime)).some(error => /IssueTime/.test(error)));
    const emptyExtension = good.replace("<cbc:UBLVersionID>", "<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>");
    assert.ok((await xsdErrors(emptyExtension)).some(error => /ExtensionContent/.test(error)));
  });
  // 2.4.4 madde 24 (22.10.2026): EDM e-SMM'yi kendi UBL-TR şemasıyla reddetti (Person/FamilyName zorunlu, 11029); OASIS UBL 2.1 şeması geçirmişti — kâhin
  // GİB'in UBL-TR 1.2.1 XSD'siyle de denetler (tools/ebelge/sema/ubl-tr-1.2.1, KAYNAK.md).
  test("UBL-TR 1.2.1 XSD düşürür, OASIS geçirir: cac:Person'da FamilyName yok (EDM'nin 11029 ile reddettiği hâl)", async () => {
    const person = await xmlOf((await issue({ scenario: "service_sale", accountId: ids.person, lines: [line({ name: "Bakım" })], payment: { rest: "open" } })).id);
    assert.match(person, /<cac:Person><cbc:FirstName>[^<]+<\/cbc:FirstName><cbc:FamilyName>[^<]+<\/cbc:FamilyName>/, "ön koşul: kişi alıcıda Person");
    assert.deepEqual(await xsdErrors(person), [], "bozulmamış belge iki şemaya da uygun");
    const broken = person.replace(/<cbc:FamilyName>[^<]*<\/cbc:FamilyName>/, "");
    assert.notEqual(broken, person);
    assert.deepEqual(await oasisXsdErrors(broken), [], "OASIS UBL 2.1'de FamilyName isteğe bağlı");
    assert.ok((await ublTrXsdErrors(broken)).some(error => /FamilyName/.test(error)), "UBL-TR'de zorunlu");
    assert.ok((await xsdErrors(broken)).some(error => /^UBL-TR 1\.2\.1: .*FamilyName/.test(error)), "birleşik denetim de yakalar");
  });
  test("UBL-TR 1.2.1 XSD: imza yeri yalnız eklenir (belgenin başka yeri değişmez); UBL-TR'de zorunlu cac:Signature silinirse düşer", async () => {
    const slotted = withSignatureSlot(good);
    assert.equal(slotted.replace(/<ext:UBLExtensions\b[\s\S]*?<\/ext:UBLExtensions>/, ""), good, "yalnız imza yeri eklendi");
    assert.equal(withSignatureSlot(slotted), slotted, "imza yeri varsa ikinci kez eklenmez");
    const unsigned = good.replace(/<cac:Signature>[\s\S]*?<\/cac:Signature>/, "");
    assert.notEqual(unsigned, good, "ön koşul: belgede cac:Signature var");
    assert.deepEqual(await oasisXsdErrors(unsigned), [], "OASIS'te cac:Signature isteğe bağlı");
    assert.ok((await ublTrXsdErrors(unsigned)).some(error => /Signature|AccountingSupplierParty/.test(error)), "UBL-TR'de cac:Signature zorunlu");
  });
  test("e-Arşiv kipi: e-Fatura profili e-Arşiv kuralında, e-Arşiv profili e-Fatura kuralında düşer", () => {
    assert.ok(schematronErrors(good, { type: "earsiv" }).some(error => /ProfileIDTypeEarchive/.test(error.text)));
    const earsiv = good.replace("<cbc:ProfileID>TEMELFATURA</cbc:ProfileID>", "<cbc:ProfileID>EARSIVFATURA</cbc:ProfileID>");
    assert.ok(schematronErrors(earsiv, { type: "efatura" }).some(error => /ProfileIDType /.test(`${error.text} `)));
  });
});

describe("Programın kaydettiği faturalar GİB UBL-TR kurallarına ve UBL 2.1 şemasına uyar", () => {
  const cases = [
    ["Temel e-Fatura (hizmet)", () => ({ scenario: "service_sale", accountId: ids.eFirm, lines: [line()], payment: { rest: "open" } }), "TEMELFATURA", "efatura"],
    ["Ticari e-Fatura", () => ({ scenario: "service_sale", accountId: ids.eFirm, profile: "TICARIFATURA", lines: [line()], payment: { rest: "open" } }), "TICARIFATURA", "efatura"],
    ["e-Arşiv (kişi, e-postalı)", () => ({ scenario: "service_sale", accountId: ids.person, lines: [line({ name: "Bakım", qty: 1, unitPrice: 300 })], payment: { rest: "open" } }), "EARSIVFATURA", "earsiv"],
    ["e-Arşiv (firma, e-postasız → kâğıt gönderim)", () => ({ scenario: "service_sale", accountId: ids.paperFirm, lines: [line()], payment: { rest: "open" } }), "EARSIVFATURA", "earsiv"],
    ["çok KDV oranı, satır iskontosu, ondalık miktar ve birimler", () => ({ scenario: "service_sale", accountId: ids.eFirm, lines: [line({ vatRate: 1, discountRate: 10 }), line({ name: "Eğitim", vatRate: 10, unit: "Saat" }), line({ name: "Kırtasiye", qty: 3.5, unit: "Kg", discountRate: 5 })], payment: { rest: "open" } }), "TEMELFATURA", "efatura"],
    ["KDV dahil fiyat ve iskonto", () => ({ scenario: "service_sale", accountId: ids.eFirm, pricesIncludeVat: true, lines: [line({ unitPrice: 1200, discountRate: 10 })], payment: { rest: "open" } }), "TEMELFATURA", "efatura"],
    ["%0 KDV, 351 (istisna olmayan)", () => ({ scenario: "service_sale", accountId: ids.eFirm, lines: [line({ vatRate: 0, exemptionCode: "351" })], payment: { rest: "open" } }), "TEMELFATURA", "efatura"],
    ["döviz (USD, kur)", () => ({ scenario: "service_sale", accountId: ids.eFirm, currency: "USD", rate: 41.25, lines: [line()], payment: { rest: "open" } }), "TEMELFATURA", "efatura"],
    ["fiyat farkı faturası", () => ({ scenario: "price_difference", accountId: ids.eFirm, lines: [line({ name: "Fiyat Farkı" })], payment: { rest: "open" } }), "TEMELFATURA", "efatura"],
    ...Object.keys(EXEMPTIONS)
      .filter(code => code !== "351")
      .map(code => [`istisna ${code}`, () => ({ scenario: "service_sale", accountId: ids.eFirm, lines: [line({ vatRate: 0, exemptionCode: code })], payment: { rest: "open" } }), "TEMELFATURA", "efatura"]),
    ...Object.keys(WITHHOLDING).map(code => [`tevkifat ${code}`, () => ({ scenario: "service_sale", accountId: ids.eFirm, lines: [line({ withholdingCode: code })], payment: { rest: "open" } }), "TEMELFATURA", "efatura"]),
  ];
  for (const [name, body, profile, type] of cases) {
    test(name, async () => {
      const invoice = await issue(body());
      assert.equal(invoice.profile, profile);
      const xml = await xmlOf(invoice.id);
      const result = await validateInvoice(xml, { type });
      assert.equal(describeErrors(result), "", `${name}: GİB/XSD hataları`);
      // Gömülü görünüm şablonu (16.10.2026) her türde çizilir; sayfada belge numarası ve ödenecek tutar (NaN yok).
      const page = renderView(xml).replace(/<[^>]+>/g, " ");
      assert.ok(page.includes(invoice.number), `${name}: görünümde belge numarası yok`);
      assert.match(page, /Ödenecek Tutar/);
      assert.doesNotMatch(page, /NaN/, `${name}: görünümde sayı biçimlenemedi`);
    });
  }
  test("alıştan iade (e-Fatura): asıl faturaya DocumentTypeCode IADE ile 16 haneli numarayla bağlanır", async () => {
    const purchase = await issue({ scenario: "expense_purchase", accountId: ids.supplier, number: "TPT2026000000123", expenseCode: "office", lines: [line({ name: "Kırtasiye" })], payment: { rest: "open" } });
    const back = await issue({ kind: "purchase_return", originalId: purchase.id, lines: [{ originLineId: purchase.lines[0].id, qty: 1 }], payment: { rest: "open" }, force: true });
    assert.equal(back.typeCode, "IADE");
    const xml = await xmlOf(back.id);
    assert.match(xml, /<cac:InvoiceDocumentReference><cbc:ID>TPT2026000000123<\/cbc:ID><cbc:IssueDate>[^<]+<\/cbc:IssueDate><cbc:DocumentTypeCode>IADE<\/cbc:DocumentTypeCode>/);
    assert.equal(describeErrors(await validateInvoice(xml)), "");
  });
  test("alıştan iade: asıl faturanın numarası 16 hane değilse e-Belge iadesi kaydedilmeden söylenir (entegratörde reddedilmez)", async () => {
    const purchase = await issue({ scenario: "expense_purchase", accountId: ids.supplier, number: "A-4711", expenseCode: "office", lines: [line({ name: "Kırtasiye" })], payment: { rest: "open" } });
    const before = server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
    const back = await api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: purchase.id, lines: [{ originLineId: purchase.lines[0].id, qty: 1 }], payment: { rest: "open" }, force: true });
    assert.equal(back.status, 400, JSON.stringify(back.data));
    assert.match(JSON.stringify(back.data), /16 karakterlik/); // 2.4.3 (MM1): ileti "asıl faturanın numarasını düzeltin" demez; e-Belge referansını ister
    assert.match(JSON.stringify(back.data), /A-4711/);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n, before, "reddedilen iade kayıt açmamalı");
  });
  test("eski kayıttaki 308 (2.3.0'a dek 13/a) GİB'in 13/a kodu 304 olarak yazılır ve kurallara uyar", async () => {
    const invoice = await issue({ scenario: "service_sale", accountId: ids.eFirm, lines: [line({ vatRate: 0, exemptionCode: "308" })], payment: { rest: "open" } });
    assert.equal(server.app.store.get("SELECT exemption_code AS code FROM invoice_lines WHERE invoice_id = ?", invoice.id).code, "304", "yeni kayıtta 308 → 304");
    server.app.store.run("UPDATE invoice_lines SET exemption_code = '308' WHERE invoice_id = ?", invoice.id); // 2.3.0'dan kalan kayıt
    const xml = await xmlOf(invoice.id);
    assert.match(xml, /<cbc:TaxExemptionReasonCode>304<\/cbc:TaxExemptionReasonCode>/);
    assert.doesNotMatch(xml, /<cbc:TaxExemptionReasonCode>308</);
    assert.equal(describeErrors(await validateInvoice(xml)), "");
  });
});

describe("Programın kod tabloları GİB kod listesiyle aynı (UBL-TR_Codelist.xml)", () => {
  const codelist = readFileSync(join(SEMA, "gib", "UBL-TR_Codelist.xml"), "utf8");
  const list = name => {
    const match = codelist.match(new RegExp(`<sch:let name="${name}"\\s+value="'([^']*)'"`));
    assert.ok(match, `${name} kod listesinde yok`);
    return new Set(match[1].split(",").filter(Boolean));
  };
  test("her tevkifat kodu ve oranı GİB'in WithholdingTaxTypeWithPercent listesinde", () => {
    const allowed = list("WithholdingTaxTypeWithPercent");
    const wrong = Object.entries(WITHHOLDING).filter(([code, { num, den }]) => !allowed.has(`${code}${Math.round((num / den) * 100)}`));
    assert.deepEqual(wrong.map(([code, { num, den }]) => `${code} ${num}/${den}`), []);
  });
  test("her KDV istisna kodu GİB'in TaxExemptionReasonCodeType listesinde", () => {
    const allowed = list("TaxExemptionReasonCodeType");
    assert.deepEqual(Object.keys(EXEMPTIONS).filter(code => !allowed.has(code)), []);
  });
});

describe("Kâhin dosyaları kaynaktaki baytlarıyla duruyor (KAYNAK.md sha256; Windows CRLF dönüşümü yok)", () => {
  test("her dosyanın sha256'sı KAYNAK.md'deki değerle aynı", () => {
    const listed = [...readFileSync(join(SEMA, "KAYNAK.md"), "utf8").matchAll(/^([0-9a-f]{64}) {2}\.\/(\S+)$/gm)];
    assert.ok(listed.length >= 30, `KAYNAK.md'de ${listed.length} özet`);
    const wrong = listed.filter(([, hash, file]) => createHash("sha256").update(readFileSync(join(SEMA, file))).digest("hex") !== hash).map(([, , file]) => file);
    assert.deepEqual(wrong, []);
  });
});
