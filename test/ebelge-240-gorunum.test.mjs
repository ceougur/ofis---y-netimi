// e-Belge görünümü ve şahıs firmasında ticari unvan (kullanıcı kararı 16.10.2026: "önerini yap"; Wolvox e-Fatura ayarlarıyla karşılaştırma).
// Programın GERÇEK API'sinden kaydedilen faturaların XML'i programdan bağımsız kâhinlere karşı denetlenir:
//   - OASIS UBL 2.1 XSD + GİB UBL-TR şematronu (tools/ebelge/dogrula.mjs) — şablon gömülü belge de, unvanlı şahıs belgesi de uygun mu;
//   - gömülü görünüm şablonu (XSLT) SaxonJS ile işlenir (renderView) — sayfada belgenin kendi sayıları, logo, banka hesabı, alt not var mı.
// Tarayıcının XSLT 1.0 işlemcisi (libxslt) e2e senaryo-entegrator-240 bölüm 7'de ayrıca denenir.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { embeddedXslt, renderView, validateInvoice } from "../tools/ebelge/dogrula.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

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
// 1×1 piksel JPEG (SOF0) — Fatura Ayarları logosu (sunucu JPEG ve boyutunu denetler).
const LOGO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const IBAN = "TR330006100519786457841326";
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const describeErrors = result => [...result.xsd.map(error => `XSD: ${error}`), ...result.schematron.map(error => `GİB: ${error.text} [${error.location}]`)].join("\n");
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;| /g, " ").replace(/\s+/g, " ");

let server;
let api;
const ids = {};
async function issue(body) {
  const response = await api.post("/api/workspace/invoices", body);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data;
}
async function xmlOf(id) {
  const response = await api.get(`/api/workspace/invoices/${id}/ubl.xml`);
  assert.equal(response.status, 200, `ubl.xml ${response.status}`);
  return typeof response.data === "string" ? response.data : response.text;
}
const line = (extra = {}) => ({ name: "Danışmanlık", qty: 2, unitPrice: 500, vatRate: 20, ...extra });

before(async () => {
  server = await startTestServer({ edocEnabled: true });
  const client = server.client();
  api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const saved = await api.put("/api/workspace/invoices/settings", {
    seller: { name: "Deneme Ofis Ltd. Şti.", taxNo: vkn(123456789), taxOffice: "Çankaya", address: "Atatürk Blv. No:1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr", logo: LOGO, banks: [{ name: "Örnek Bankası", iban: IBAN }] },
    efatura: true,
    earsiv: true,
    defaults: { footer: "Ödemelerinizi IBAN'a açıklamaya fatura numarasıyla yapınız. <script>alert(1)</script>" },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  ids.savedView = saved.data.eView;
  const account = async body => {
    const response = await api.post("/api/workspace/accounts", body);
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.id || response.data.account?.id;
  };
  ids.eFirm = await account({ name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: vkn(987654321), taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
  // Şahıs firması: ad-soyad ayrı alanlarda, cari adı ticari unvan.
  ids.soleTrader = await account({ name: "Ahmet Yılmaz İnşaat", type: "customer", partyKind: "person", firstName: "Ahmet", familyName: "Yılmaz", taxNo: "10000000146", taxOffice: "Konak", city: "İzmir", address: "Alsancak 3", district: "Konak", email: "ahmet@example.com" });
  // Unvansız gerçek kişi: adı ad-soyadın aynısı.
  ids.person = await account({ name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka" });
});
after(async () => {
  await server?.close();
});

describe("Şahıs firmasında ticari unvan e-Belgeye girer", () => {
  test("TCKN'li şahıs firması: ad-soyad Person'da, cari adı (ticari unvan) PartyName'de; GİB şematronu ve XSD temiz", async () => {
    const doc = await issue({ scenario: "service_sale", accountId: ids.soleTrader, profile: "EARSIVFATURA", lines: [line()], payment: { rest: "open" } });
    const xml = await xmlOf(doc.id);
    const buyer = xml.match(/<cac:AccountingCustomerParty>([\s\S]*?)<\/cac:AccountingCustomerParty>/)[1];
    assert.match(buyer, /<cac:PartyName><cbc:Name>Ahmet Yılmaz İnşaat<\/cbc:Name><\/cac:PartyName>/, "ticari unvan PartyName'de");
    assert.match(buyer, /<cac:Person><cbc:FirstName>Ahmet<\/cbc:FirstName><cbc:FamilyName>Yılmaz<\/cbc:FamilyName><\/cac:Person>/);
    assert.equal(describeErrors(await validateInvoice(xml, { type: "earsiv" })), "");
    assert.match(text(renderView(xml)), /Ahmet Yılmaz İnşaat Ahmet Yılmaz/, "görünümde unvan ve ad-soyad");
  });
  test("unvansız gerçek kişi: PartyName yazılmaz (ad-soyad tekrarlanmaz); belge temiz", async () => {
    const doc = await issue({ scenario: "service_sale", accountId: ids.person, profile: "EARSIVFATURA", lines: [line()], payment: { rest: "open" } });
    const xml = await xmlOf(doc.id);
    const buyer = xml.match(/<cac:AccountingCustomerParty>([\s\S]*?)<\/cac:AccountingCustomerParty>/)[1];
    assert.doesNotMatch(buyer, /<cac:PartyName>/);
    assert.equal(describeErrors(await validateInvoice(xml, { type: "earsiv" })), "");
  });
});

describe("e-Belge görünüm tasarımı (gömülü XSLT)", () => {
  let efatura;
  let efaturaXml;
  before(async () => {
    efatura = await issue({ scenario: "service_sale", accountId: ids.eFirm, lines: [line(), line({ name: "Kurulum", qty: 1, unitPrice: 250, vatRate: 10, description: "Yerinde kurulum" })], payment: { rest: "open" } });
    efaturaXml = await xmlOf(efatura.id);
  });
  test("görünüm ayarı varsayılanı açık (logo, banka, alt not; kaşe / imza e-Arşivde, e-Faturada kapalı)", () => {
    assert.deepEqual(ids.savedView, { enabled: true, logo: true, banks: true, footer: true, stamp: true, stampEfatura: false });
  });
  test("şablon GİB örnek biçiminde gömülür (fatura no .xslt, base64, application/xml); belge XSD + GİB şematronundan temiz", async () => {
    assert.match(efaturaXml, new RegExp(`<cac:AdditionalDocumentReference><cbc:ID>[0-9a-f-]{36}</cbc:ID><cbc:IssueDate>${efatura.issueDate}</cbc:IssueDate><cac:Attachment><cbc:EmbeddedDocumentBinaryObject characterSetCode="UTF-8" encodingCode="Base64" filename="${efatura.number}\\.xslt" mimeCode="application/xml">`));
    assert.match(embeddedXslt(efaturaXml), /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<xsl:stylesheet version="1\.0"/);
    assert.equal(describeErrors(await validateInvoice(efaturaXml)), "");
    assert.equal(await xmlOf(efatura.id), efaturaXml, "aynı belge her üretimde aynı XML (şablon kimliği belgeden türetilir)");
  });
  test("görünüm belgenin kendi sayılarını gösterir: numara, ETTN, alıcı, kalemler, KDV oranları, ödenecek tutar (Türkçe sayı biçimi)", () => {
    const page = text(renderView(efaturaXml));
    for (const expected of ["e-FATURA", efatura.number, efatura.ettn, "Alıcı Ticaret A.Ş.", "Deneme Ofis Ltd. Şti.", "Temel Fatura", "Satış", "Danışmanlık", "Kurulum", "Yerinde kurulum", "Hesaplanan KDV (%20) 200,00 TL", "Hesaplanan KDV (%10) 25,00 TL", "Mal Hizmet Toplam Tutarı 1.250,00 TL", "Vergiler Dahil Toplam Tutar 1.475,00 TL", "Ödenecek Tutar 1.475,00 TL", "Yalnız Bin Dört Yüz Yetmiş Beş", "2 Adet", "500,00 TL"]) {
      assert.ok(page.includes(expected), `görünümde yok: "${expected}"\n${page.slice(page.indexOf("Sıra No"))}`);
    }
  });
  test("alıcı (SAYIN) üst bölümün sol sütununda, satıcının altında; bilgi tablosunun yanındaki boşluk kalmaz (kullanıcı 16.10.2026)", () => {
    const html = renderView(efaturaXml);
    const top = html.match(/<table class="ust">[\s\S]*?class="baslik"/)?.[0] || "";
    assert.ok(top.includes('class="alici"') && text(top).includes("SAYIN") && text(top).includes("Alıcı Ticaret A.Ş."), "alıcı sol sütunda");
    assert.ok(text(top).indexOf("Deneme Ofis Ltd. Şti.") < text(top).indexOf("SAYIN"), "önce satıcı, altında alıcı");
    assert.equal((html.match(/class="alici"/g) || []).length, 1, "alıcı bloğu bir kez");
  });
  test("logo, banka hesabı (IBAN dörderli) ve alt not şablona gömülü; alt nottaki HTML metin olarak kalır (komut çalışmaz)", () => {
    const html = renderView(efaturaXml);
    assert.match(html, /class="baslik"><div class="logo"><img alt="" src="data:image\/jpeg;base64,\/9j\//, "firma logosu orta sütunun en üstünde (GİB logosunun üstünde)");
    assert.ok(text(html).includes("Örnek Bankası TR33 0006 1005 1978 6457 8413 26"), "banka hesabı");
    assert.ok(text(html).includes("Ödemelerinizi IBAN'a açıklamaya fatura numarasıyla yapınız."), "alt not");
    assert.doesNotMatch(html, /<script/i, "alt nottaki etiket öğe olmaz");
  });
  test("e-Arşiv: başlık GİB ibaresiyle \"e-Arşiv Fatura\", gönderim şekli ve elektronik iletim ibaresi; belge e-Arşiv şematronundan temiz", async () => {
    const doc = await issue({ scenario: "service_sale", accountId: ids.soleTrader, profile: "EARSIVFATURA", lines: [line()], payment: { rest: "open" } });
    const xml = await xmlOf(doc.id);
    assert.equal(describeErrors(await validateInvoice(xml, { type: "earsiv" })), "");
    const html = renderView(xml);
    // GİB ibaresi aynen "e-Arşiv Fatura" (EDM büyük harfli başlığı da bu ibareye çeviriyor — test ortamı 16.10.2026).
    // Orta sütun (İz 9): firma logosu, GİB logosu, sonra başlık.
    assert.match(html, /class="baslik"[^>]*>(?:<div class="logo">.*?<\/div>)?(?:<div class="gib">.*?<\/div>)?e-Arşiv Fatura</);
    const page = text(html);
    for (const expected of ["Gönderim Şekli Elektronik", "e-Arşiv izni kapsamında elektronik ortamda iletilmiştir."]) assert.ok(page.includes(expected), `görünümde yok: "${expected}"`);
  });
  test("alış faturasının XML'inde satıcı karşı taraftır: bizim logomuz ve IBAN'ımızla şablon gömülmez", async () => {
    const supplier = await api.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", taxNo: vkn(555444333), taxOffice: "Kadıköy", address: "Bağdat Cd. 7", district: "Kadıköy", city: "İstanbul" });
    const purchase = await issue({ scenario: "expense_purchase", accountId: supplier.data.id || supplier.data.account?.id, number: "TPT2026000000777", expenseCode: "office", lines: [line({ name: "Kırtasiye" })], payment: { rest: "open" } });
    const response = await api.get(`/api/workspace/invoices/${purchase.id}/ubl.xml`);
    if (response.status !== 200) return assert.equal(response.status, 409, "alış faturasının XML'i üretilmiyorsa sorun yok");
    const xml = typeof response.data === "string" ? response.data : response.text;
    assert.equal(embeddedXslt(xml), "", "alış faturasına şablon gömülmedi");
  });
  test("ayar: logo ve banka kapatılınca şablonda yok; görünüm kapatılınca belgeye şablon gömülmez (entegratörün varsayılanı)", async () => {
    assert.equal((await api.put("/api/workspace/invoices/settings", { eView: { logo: false, banks: false } })).status, 200);
    const plain = renderView(await xmlOf(efatura.id));
    // Firma logosu kapalı; GİB logosu ve karekod (zorunlu) bu ayardan bağımsız kalır (İz 9).
    assert.doesNotMatch(plain, /class="logo"/);
    assert.equal((plain.match(/<img/g) || []).length, 2, "yalnız GİB logosu ve karekod");
    assert.ok(!text(plain).includes(IBAN.slice(0, 4) + " " + IBAN.slice(4, 8)));
    assert.ok(text(plain).includes("Ödemelerinizi IBAN'a"), "alt not açık kaldı");
    const off = await api.put("/api/workspace/invoices/settings", { eView: { enabled: false } });
    assert.equal(off.status, 200);
    assert.equal(off.data.eView.enabled, false);
    const xml = await xmlOf(efatura.id);
    assert.equal(embeddedXslt(xml), "", "şablon gömülmedi");
    assert.equal(describeErrors(await validateInvoice(xml)), "");
    assert.equal((await api.put("/api/workspace/invoices/settings", { eView: { enabled: true, logo: true, banks: true } })).status, 200);
  });
});
