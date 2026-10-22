// GİB e-SMM belgesi (UBL, ProfileID ESMM) — 2.4.4, iş listesi 21. Makbuzlar programın GERÇEK API'sinden kaydedilir (kâğıt SMM ile aynı kuruş
// hesabı, invoice-math; para çekirdeği değişmedi), e-SMM XML'i /ubl.xml'den okunur.
// KÂHİN (ders 5) — beklenen sayılar programın kodundan değil, GİB kuralından elle hesaplandı:
//   GİB e-Arşiv Teknik Kılavuzu V1.19 §3.3.6 (serbestMeslekMakbuz: toplamTutar "vergi hariç toplam tutar", odenecekTutar, vergiBilgisi/vergi
//   matrah + vergiKodu + vergiTutari + vergiOrani, tevkifat) ve GİB UBL-TR Kod Listeleri v1.43 §1.9 (0003 Gelir Vergisi Stopajı "GV STOPAJI",
//   0015 Gerçek Usulde KDV "KDV GERCEK"); GVK md. 94 (stopaj = brüt ücret × oran; matrah brüt ücret); KDV = matrah × oran (kalem başına, GİB UBL-TR);
//   Net Ücret = brüt − stopaj; Tahsil Edilen KDV = KDV − KDV tevkifatı; Net Alınan = Net Ücret + Tahsil Edilen KDV. Kaynaklar ve sha256:
//   docs/kanit/2026-10-22/244-esmm/GIB-ESMM-KAYNAK.md. EDM'nin örnek sayıları (KDV %18, matrah 0, net > brüt) kâhin DEĞİLDİR; EDM örneği yalnız UBL
//   YAPISININ (hangi alan hangi anlamı taşır) kaynağıdır — örnek dosya depoya girmez (kullanıcının yüklediği EDM belgesi), yapısı aşağıda sabit.
// Eski kodda (163dd5d) kırmızı: stopaj yalnız Not'tu, 0003 vergi satırı ve e-SMM dip toplam anlamları yoktu (docs/kanit/2026-10-22/244-esmm).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { computeInvoice } from "../server/lib/invoice-math.mjs";
import { children, find, parseXml, textOf } from "../server/lib/einvoice/xml-lite.mjs";
// Ad alanıyla içe aktarılır: eski kodda (dışa aktarım yokken) dosyanın bütünü değil yalnız dağıtım testleri düşer — kırmızı kanıt testlerin kendisinden.
import * as ubl from "../server/lib/einvoice/ubl-tr.mjs";
import { xsdErrors } from "../tools/ebelge/dogrula.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
// Serbest meslek erbabı (avukat, gerçek kişi) ve müvekkiller.
const SELLER = { name: "Av. Deneme Ali", partyKind: "person", firstName: "Ali", familyName: "Deneme", taxNo: "10000000146", taxOffice: "Kadıköy", address: "Moda Cd. 1", district: "Kadıköy", city: "İstanbul", email: "ali@avukat.com" };
const FIRM = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "muhasebe@muvekkil.com" };
const PERSON = { name: "Ayşe Kaya", type: "customer", partyKind: "person", taxNo: "10000000078", address: "Bağdat Cd. 5", district: "Kadıköy", city: "İstanbul" };

let server;
let api;
const accounts = {};
const docs = {};
async function smm(key, accountId, lines, extra = {}) {
  const response = await api.post("/api/workspace/invoices", { scenario: "smm", accountId, lines, payment: { rest: "open" }, ...extra });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  const doc = (await api.get(`/api/workspace/invoices/${response.data.id}`)).data;
  const xmlResponse = await api.get(`/api/workspace/invoices/${response.data.id}/ubl.xml`);
  assert.equal(xmlResponse.status, 200, `ubl.xml ${xmlResponse.status} ${JSON.stringify(xmlResponse.data).slice(0, 300)}`);
  const xml = typeof xmlResponse.data === "string" ? xmlResponse.data : xmlResponse.text;
  docs[key] = { doc, xml, tree: find(parseXml(xml), "Invoice") };
  return docs[key];
}

before(async () => {
  server = await startTestServer({ edocEnabled: true, esmmEnabled: true });
  const client = server.client();
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  for (const [key, body] of Object.entries({ firm: FIRM, person: PERSON })) {
    const response = await api.post("/api/workspace/accounts", body);
    assert.equal(response.status, 200, JSON.stringify(response.data));
    accounts[key] = response.data.id || response.data.account?.id;
  }
  // A: tüzel alıcı, tek kalem, varsayılan stopaj %20, KDV %20.
  await smm("A", accounts.firm, [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }]);
  // B: iki kalem × 100,03 — belge düzeyi stopaj (200,06 × %20 = 40,012 → 40,01) ile kalem kalem yuvarlama (20,01 + 20,01 = 40,02) ayrışır.
  await smm("B", accounts.firm, [{ name: "Danışmanlık", qty: 1, unitPrice: 100.03, vatRate: 20 }, { name: "Dilekçe", qty: 1, unitPrice: 100.03, vatRate: 20 }]);
  // C: gerçek kişi alıcı — stopaj kesilmez (program varsayılanı 0).
  await smm("C", accounts.person, [{ name: "Hukuki Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }]);
  // D: KDV tevkifatı (616 Diğer Hizmetler 5/10) + stopaj %20.
  await smm("D", accounts.firm, [{ name: "Bilirkişi Raporu", qty: 1, unitPrice: 1000, vatRate: 20, withholdingCode: "616" }]);
  // E: elle %15 stopaj, iki saat × 750 (miktar 1'den farklı), farklı KDV oranları.
  await smm("E", accounts.firm, [{ name: "Duruşma", qty: 2, unit: "Saat", unitPrice: 750, vatRate: 20 }, { name: "Eğitim", qty: 1, unitPrice: 333.33, vatRate: 10 }], { stoppageRate: 15 });
});
after(async () => {
  await server?.close();
});

// XML okuma yardımcıları (yerel adla).
const amountOf = (node, path) => {
  const target = find(node, path);
  assert.ok(target, `${path} yok`);
  return textOf(target);
};
const subtotals = taxTotal => children(taxTotal, "TaxSubtotal").map(sub => ({ code: amountOf(sub, "TaxCategory/TaxScheme/TaxTypeCode"), name: amountOf(sub, "TaxCategory/TaxScheme/Name"), taxable: amountOf(sub, "TaxableAmount"), amount: amountOf(sub, "TaxAmount"), seq: textOf(find(sub, "CalculationSequenceNumeric")), percent: amountOf(sub, "Percent") }));
const totalsOf = tree => Object.fromEntries(find(tree, "LegalMonetaryTotal").children.map(item => [item.name, textOf(item)]));
const linesOf = tree => children(tree, "InvoiceLine").map(line => ({ qty: amountOf(line, "InvoicedQuantity"), unit: find(line, "InvoicedQuantity").attrs.unitCode, gross: amountOf(line, "LineExtensionAmount"), tax: subtotals(find(line, "TaxTotal")), taxAmount: amountOf(line, "TaxTotal/TaxAmount"), price: amountOf(line, "Price/PriceAmount"), notes: children(line, "Note").map(textOf), name: amountOf(line, "Item/Name") }));

describe("e-SMM UBL: GİB kuralından elle hesaplanan dip toplamlar (kâhin)", () => {
  test("A — 1.000 TL brüt, stopaj %20, KDV %20: stopaj 200, net ücret 800, KDV 200, tahsil edilen KDV 200, net alınan 1.000", () => {
    const { tree, doc } = docs.A;
    assert.equal(amountOf(tree, "ProfileID"), "ESMM");
    assert.equal(amountOf(tree, "ID"), doc.number);
    assert.match(doc.number, /^TES\d{13}$/, "test ortamı e-SMM serisi");
    assert.equal(amountOf(tree, "UUID"), doc.ettn);
    assert.equal(amountOf(tree, "InvoiceTypeCode"), "SATIS");
    assert.equal(amountOf(tree, "TaxTotal/TaxAmount"), "200.00", "belge TaxTotal/TaxAmount = KDV");
    assert.deepEqual(subtotals(find(tree, "TaxTotal")), [
      { code: "0003", name: "GV STOPAJI", taxable: "1000.00", amount: "200.00", seq: "1", percent: "20" },
      { code: "0015", name: "KDV GERCEK", taxable: "1000.00", amount: "200.00", seq: "2", percent: "20" },
    ]);
    assert.deepEqual(totalsOf(tree), { LineExtensionAmount: "1000.00", TaxExclusiveAmount: "800.00", TaxInclusiveAmount: "200.00", PayableAmount: "1000.00" });
    const [line] = linesOf(tree);
    assert.deepEqual({ qty: line.qty, unit: line.unit, gross: line.gross, price: line.price }, { qty: "800.00", unit: "NIU", gross: "1000.00", price: "1000.00" }, "kalem: miktar = net ücret, fiyat = net tahsilat (EDM düzeni)");
    assert.deepEqual(line.tax.map(item => [item.code, item.amount, item.seq]), [["0003", "200.00", "1"], ["0015", "200.00", "2"]]);
  });
  test("B — 2 × 100,03: belge stopajı matrah × oran = 40,01 (kalem yuvarlamasıyla 40,02 DEĞİL); kalemlere 20,01 + 20,00; KDV kalem başına 20,01 + 20,01", () => {
    const { tree } = docs.B;
    assert.deepEqual(subtotals(find(tree, "TaxTotal")).map(item => [item.code, item.taxable, item.amount]), [["0003", "200.06", "40.01"], ["0015", "200.06", "40.02"]]);
    assert.deepEqual(totalsOf(tree), { LineExtensionAmount: "200.06", TaxExclusiveAmount: "160.05", TaxInclusiveAmount: "40.02", PayableAmount: "200.07" });
    const lines = linesOf(tree);
    assert.deepEqual(lines.map(line => line.tax.find(item => item.code === "0003").amount), ["20.01", "20.00"], "kalan kuruş kesri büyük (eşitse önceki) kaleme");
    assert.deepEqual(lines.map(line => [line.qty, line.price]), [["80.02", "100.03"], ["80.03", "100.04"]]);
  });
  test("C — kişi alıcı, stopaj yok: 0003 satırı yazılmaz; net ücret = brüt 500, KDV 100, net alınan 600", () => {
    const { tree, doc } = docs.C;
    assert.equal(doc.stoppageRate, 0);
    assert.deepEqual(subtotals(find(tree, "TaxTotal")).map(item => item.code), ["0015"]);
    assert.deepEqual(totalsOf(tree), { LineExtensionAmount: "500.00", TaxExclusiveAmount: "500.00", TaxInclusiveAmount: "100.00", PayableAmount: "600.00" });
    assert.deepEqual(linesOf(tree)[0].tax.map(item => item.code), ["0015"]);
    assert.equal(linesOf(tree)[0].price, "600.00");
  });
  test("D — KDV tevkifatı 5/10: tahsil edilen KDV 200 − 100 = 100; net alınan 800 + 100 = 900; tevkifat ayrı satırda", () => {
    const { tree } = docs.D;
    assert.equal(amountOf(tree, "InvoiceTypeCode"), "TEVKIFAT");
    assert.deepEqual(totalsOf(tree), { LineExtensionAmount: "1000.00", TaxExclusiveAmount: "800.00", TaxInclusiveAmount: "100.00", PayableAmount: "900.00" });
    assert.equal(amountOf(tree, "WithholdingTaxTotal/TaxAmount"), "100.00");
    assert.equal(amountOf(tree, "WithholdingTaxTotal/TaxSubtotal/TaxCategory/TaxScheme/TaxTypeCode"), "616");
    assert.equal(linesOf(tree)[0].price, "900.00");
  });
  test("E — elle %15 stopaj, iki KDV oranı: stopaj (1.500 + 333,33) × %15 = 274,9995 → 275,00; KDV 300 + 33,33; net alınan 1.891,66", () => {
    const { tree } = docs.E;
    const tax = subtotals(find(tree, "TaxTotal"));
    assert.deepEqual(tax.map(item => [item.code, item.taxable, item.amount, item.percent]), [["0003", "1833.33", "275.00", "15"], ["0015", "333.33", "33.33", "10"], ["0015", "1500.00", "300.00", "20"]]);
    assert.equal(amountOf(tree, "TaxTotal/TaxAmount"), "333.33");
    assert.deepEqual(totalsOf(tree), { LineExtensionAmount: "1833.33", TaxExclusiveAmount: "1558.33", TaxInclusiveAmount: "333.33", PayableAmount: "1891.66" });
    const lines = linesOf(tree);
    // 1.500 × %15 = 225,00 (tam); 333,33 × %15 = 49,9995 → kalan kuruş bu kaleme: 50,00.
    assert.deepEqual(lines.map(line => line.tax.find(item => item.code === "0003").amount), ["225.00", "50.00"]);
    assert.deepEqual(lines.map(line => line.notes), [["Miktar: 2 Saat × 750,00 TRY"], []], "miktar 1'den farklıysa kalem notunda kalır");
  });
});

describe("e-SMM UBL: program tutarlarıyla aynı, yapı EDM'nin e-SMM örneğiyle aynı, UBL 2.1 şemasına uygun", () => {
  test("XML tutarları programın kaydettiği makbuzla kuruşu kuruşuna aynı; kalem stopajları toplamı = belge stopajı; Σ kalem fiyatı = net alınan", () => {
    for (const [key, { doc, tree }] of Object.entries(docs)) {
      const totals = totalsOf(tree);
      const cents = value => Math.round(Number(value) * 100);
      assert.equal(cents(totals.LineExtensionAmount), cents(doc.netTotal), `${key} brüt`);
      assert.equal(cents(totals.TaxExclusiveAmount), cents(doc.netTotal) - cents(doc.stoppageTotal), `${key} net ücret`);
      assert.equal(cents(totals.TaxInclusiveAmount), cents(doc.vatTotal) - cents(doc.withheldTotal), `${key} tahsil edilen KDV`);
      assert.equal(cents(totals.PayableAmount), cents(doc.payableTotal), `${key} net alınan = cari/defter tutarı`);
      const lines = linesOf(tree);
      const stoppage = lines.reduce((sum, line) => sum + cents(line.tax.find(item => item.code === "0003")?.amount || 0), 0);
      assert.equal(stoppage, cents(doc.stoppageTotal), `${key} Σ kalem stopajı`);
      assert.equal(lines.reduce((sum, line) => sum + cents(line.price), 0), cents(doc.payableTotal), `${key} Σ net tahsilat`);
      assert.equal(lines.reduce((sum, line) => sum + cents(line.qty), 0), cents(doc.netTotal) - cents(doc.stoppageTotal), `${key} Σ net ücret`);
    }
  });
  test("yapı: EDM e-SMM örneğindeki sıra ve öğeler (TaxTotal → 0003 sıra 1 + 0015 sıra 2; dip toplam dörtlüsü; kalemde NIU, vergi, ad, fiyat)", () => {
    const { tree } = docs.A;
    // EDM örneği (esmm-ubl-ornek-veri.xml) kök öğe sırası — yalnız örnekte bulunanlar, aynı göreli sırada.
    const order = ["UBLVersionID", "CustomizationID", "ProfileID", "ID", "CopyIndicator", "UUID", "IssueDate", "IssueTime", "InvoiceTypeCode", "Note", "DocumentCurrencyCode", "LineCountNumeric", "AccountingSupplierParty", "AccountingCustomerParty", "TaxTotal", "LegalMonetaryTotal", "InvoiceLine"];
    const names = tree.children.map(item => item.name).filter(name => order.includes(name));
    assert.deepEqual([...new Set(names)], order);
    assert.deepEqual(find(tree, "TaxTotal").children.map(item => item.name), ["TaxAmount", "TaxSubtotal", "TaxSubtotal"]);
    assert.deepEqual(find(tree, "LegalMonetaryTotal").children.map(item => item.name), ["LineExtensionAmount", "TaxExclusiveAmount", "TaxInclusiveAmount", "PayableAmount"]);
    const line = find(tree, "InvoiceLine");
    assert.deepEqual(line.children.map(item => item.name).filter(name => name !== "Note"), ["ID", "InvoicedQuantity", "LineExtensionAmount", "TaxTotal", "Item", "Price"]);
    assert.deepEqual(find(line, "TaxTotal").children.map(item => item.name), ["TaxAmount", "TaxSubtotal", "TaxSubtotal"]);
  });
  test("taraf adresi YALNIZ BuildingName'de (EDM e-SMM örneği): GİB eArsivVeri.xsd adresinde caddeSokak zorunlu ilk öğe; StreetName ile şema hatası, ikisi birlikte adres iki kez", () => {
    // 22.10.2026 gerçek EDM test ortamı (docs/kanit/2026-10-22/244-edm/g-toplu-gonderim.json): "The element 'adres' in namespace
    // 'http://earsiv.efatura.gov.tr' has invalid child element 'binaAd' … expected: caddeSokak". GİB e-Arşiv paketi v1.1_9 eArsivVeri.xsd: adres =
    // caddeSokak, binaAd, binaNo, kapiNo, kasabaKoy, semt, sehir, postaKod, ulke (hepsi zorunlu). EDM'nin e-SMM örneği adresi BuildingName'de verir;
    // StreetName + BuildingName birlikte verilince EDM gönderimi kabul etti (244-edm/gercek-2, 47/47) ama resmî PDF'te adres iki kez yazıldı ("Test Cd. 1
    // Test Cd. 1"; kullanıcı portal ekranında gördü). EDM örneğindeki gibi yalnız BuildingName (UBL 2.1 sırası BuildingName → CitySubdivisionName).
    for (const [key, { tree }] of Object.entries(docs)) {
      for (const role of ["AccountingSupplierParty", "AccountingCustomerParty"]) {
        const address = find(tree, `${role}/Party/PostalAddress`);
        assert.ok(address, `${key} ${role} adres yok`);
        assert.deepEqual(address.children.map(item => item.name).slice(0, 2), ["BuildingName", "CitySubdivisionName"], `${key} ${role}`);
        assert.ok(!find(address, "StreetName"), `${key} ${role}: StreetName yok (adres iki kez basılmasın)`);
        assert.ok(textOf(find(address, "BuildingName")).length > 1, `${key} ${role} bina adı = adres`);
      }
    }
  });
  test("stopaj artık Not değil (vergi satırında); programın fatura görünüm şablonu ve karekod gömülmez; gönderim şekli alıcının e-postasına göre", () => {
    for (const { xml } of Object.values(docs)) {
      assert.doesNotMatch(xml, /Gelir Vergisi Stopajı %/, "stopaj notu yok");
      assert.doesNotMatch(xml, /EmbeddedDocumentBinaryObject/, "gömülü XSLT / karekod yok");
    }
    const sending = key => textOf(children(docs[key].tree, "AdditionalDocumentReference").find(ref => textOf(find(ref, "DocumentTypeCode")) === "SendingType")?.children.find(item => item.name === "ID"));
    assert.equal(sending("A"), "ELEKTRONIK", "alıcının e-postası var");
    assert.equal(sending("C"), "KAGIT", "alıcının e-postası yok");
  });
  test("UBL 2.1 XSD'sine (OASIS; tools/ebelge/sema) uygun — GİB şematronu e-SMM'yi tanımlamaz (ESMM GİB UBL-TR profili değil)", async () => {
    for (const [key, { xml }] of Object.entries(docs)) assert.deepEqual(await xsdErrors(xml), [], key);
  });
});

describe("e-SMM dışı belgeler değişmedi", () => {
  test("kâğıt SMM (e-SMM işareti kapalı): stopaj Not'ta, 0003 satırı yok, dip toplamlar e-Fatura anlamında", async () => {
    const off = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: false });
    assert.equal(off.status, 200, JSON.stringify(off.data));
    const { doc, xml, tree } = await smm("K", accounts.firm, [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }]);
    assert.equal(doc.profile, "KAGIT");
    assert.match(xml, /Gelir Vergisi Stopajı %20: 200\.00 TRY/);
    assert.deepEqual(subtotals(find(tree, "TaxTotal")).map(item => item.code), ["0015"]);
    assert.deepEqual(totalsOf(tree), { LineExtensionAmount: "1000.00", TaxExclusiveAmount: "1000.00", TaxInclusiveAmount: "1200.00", PayableAmount: "1000.00" });
    assert.ok(!find(tree, "AccountingCustomerParty/Party/PostalAddress/BuildingName") && find(tree, "AccountingCustomerParty/Party/PostalAddress/StreetName"), "e-SMM dışı belgede adres yapısı değişmedi (yalnız StreetName)");
    delete docs.K;
  });
});

describe("e-SMM, VKN'li düzenleyen (ör. adi ortaklık)", () => {
  test("unvan Person'da da (son sözcük FamilyName): EDM'nin e-SMM görüntüsü düzenleyenin adını yalnız Person'dan basar, FamilyName zorunlu (22.10.2026 gerçek EDM); VUK 236", async () => {
    // Gerçek EDM test ortamı: PartyName'li, Person'sız VKN düzenleyende resmî PDF'te unvan YOKTU; Person eklenince basıldı. Alıcının unvanı PartyName'den basılır.
    const firm = { name: "Deneme ve Ortakları Avukatlık Ortaklığı", taxNo: "1234567890", taxOffice: "Kadıköy", address: "Moda Cd. 1", district: "Kadıköy", city: "İstanbul", email: "ortaklik@deneme.com.tr" };
    const on = await api.put("/api/workspace/invoices/settings", { seller: firm, efatura: true, earsiv: true, esmm: true });
    assert.equal(on.status, 200, JSON.stringify(on.data));
    try {
      const { doc, xml, tree } = await smm("V", accounts.firm, [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }]);
      assert.equal(doc.profile, "ESMM");
      const supplier = find(tree, "AccountingSupplierParty/Party");
      assert.equal(textOf(find(supplier, "PartyName/Name")), firm.name, "PartyName korunur");
      // EDM görüntüsü FirstName + " " + FamilyName basar; EDM'nin UBL-TR şeması FamilyName'i zorunlu tutar (11029, 22.10.2026).
      assert.equal(`${textOf(find(supplier, "Person/FirstName"))} ${textOf(find(supplier, "Person/FamilyName"))}`, firm.name, "unvan Person'da (ad + soyad = unvan)");
      assert.ok(!find(find(tree, "AccountingCustomerParty/Party"), "Person"), "VKN'li alıcıya Person eklenmez (adı PartyName'den basılır)");
      assert.deepEqual(await xsdErrors(xml), [], "UBL 2.1 XSD");
    } finally {
      delete docs.V;
      const back = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true });
      assert.equal(back.status, 200, JSON.stringify(back.data));
    }
  });
});

describe("Stopajın kalemlere dağıtımı (en büyük kalan)", () => {
  test("Σ pay = belge stopajı; her pay tam payın aşağı yuvarlaması ya da bir fazlası; aynı girdi aynı sonuç", () => {
    let seed = 20261022;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let run = 0; run < 2000; run += 1) {
      const count = 1 + Math.floor(random() * 6);
      const rate = [20, 15, 17.5, 10, 0, 40][Math.floor(random() * 6)];
      const lines = Array.from({ length: count }, () => ({ qty: 1, unitPrice: Math.round(random() * 500000) / 100 + 0.01, vatRate: 20 }));
      const { lines: computed, totals } = computeInvoice(lines, { stoppageRate: rate });
      const nets = computed.map(line => line.net);
      const shares = ubl.stoppageShares(nets, rate, totals.stoppage);
      assert.equal(shares.reduce((a, b) => a + b, 0), totals.stoppage, `koşu ${run}`);
      shares.forEach((share, index) => {
        const exact = (nets[index] * rate) / 100;
        assert.ok(share >= Math.floor(exact + 1e-9) && share <= Math.floor(exact + 1e-9) + 1, `koşu ${run} kalem ${index}: ${share} / ${exact}`);
      });
      assert.deepEqual(ubl.stoppageShares(nets, rate, totals.stoppage), shares);
    }
  });
  test("kayıtlı tutarlar GİB kimliğini (Net Alınan = Net Ücret + Tahsil Edilen KDV) ya da kalem toplamlarını tutmazsa belge üretilmez", () => {
    const doc = { stoppageRate: 20, netTotal: 1000, stoppageTotal: 200, vatTotal: 200, withheldTotal: 0, payableTotal: 1000, lines: [{ net: 1000, vat: 200, withheld: 0 }] };
    assert.equal(ubl.esmmAmounts(doc).payable, 100000);
    assert.throws(() => ubl.esmmAmounts({ ...doc, payableTotal: 1200 }), /tutarsız/);
    assert.throws(() => ubl.esmmAmounts({ ...doc, lines: [{ net: 999.99, vat: 200, withheld: 0 }] }), /kalem toplamları/);
  });
  test("tutarsız girdide (kalan kuruş kalem sayısını aşar ya da eksi) belge üretilmez", () => {
    assert.throws(() => ubl.stoppageShares([10003, 10003], 20, 4003), /dağıtılamadı/);
    assert.throws(() => ubl.stoppageShares([10003, 10003], 20, 3999), /dağıtılamadı/);
    assert.deepEqual(ubl.stoppageShares([10003, 10003], 20, 4001), [2001, 2000]);
  });
});
