// Gelen e-Faturayı okur (v2.0.15): UBL-TR XML → alış faturası taslağına girdi. Satıcı (bize kesen) tarafın kimliği, adres
// ve vergi dairesi; kalemler (ad, kod, miktar, birim, birim fiyat, iskonto, KDV oranı, tevkifat); toplamlar ve notlar.
// Tutarlar belgedeki gibi alınır; taslak programın hesap motorundan geçince kalem toplamları belgeyle karşılaştırılır.
import { child, children, deep, deepAll, find, parseXml, textOf } from "./xml-lite.mjs";

const UNIT_NAMES = { C62: "Adet", NIU: "Adet", KGM: "Kg", GRM: "Gr", TNE: "Ton", LTR: "Lt", MLT: "Ml", MTR: "M", CMT: "Cm", MMT: "Mm", MTK: "M²", MTQ: "M³", PA: "Paket", BX: "Kutu", CT: "Koli", PR: "Çift", SET: "Takım", HUR: "Saat", DAY: "Gün", MON: "Ay", ANN: "Yıl", MIN: "Dakika", WEE: "Hafta", RO: "Rulo", BO: "Şişe", BG: "Torba", SA: "Çuval" };
const num = value => {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};

function party(node) {
  const p = find(node, "Party") || node;
  const ids = deepAll(p, "PartyIdentification").map(item => child(item, "ID")).filter(Boolean);
  const idOf = scheme => textOf(ids.find(item => (item.attrs.schemeID || "").toUpperCase() === scheme));
  const taxNo = idOf("VKN") || idOf("TCKN");
  const person = find(p, "Person");
  const address = find(p, "PostalAddress");
  const name = textOf(find(p, "PartyName/Name")) || [textOf(find(person, "FirstName")), textOf(find(person, "FamilyName"))].filter(Boolean).join(" ");
  return {
    name,
    taxNo,
    partyKind: idOf("TCKN") ? "person" : taxNo ? "company" : "",
    firstName: textOf(find(person, "FirstName")),
    familyName: textOf(find(person, "FamilyName")),
    taxOffice: textOf(find(p, "PartyTaxScheme/TaxScheme/Name")),
    mersisNo: idOf("MERSISNO"),
    tradeRegistry: idOf("TICARETSICILNO"),
    address: [textOf(find(address, "StreetName")), textOf(find(address, "BuildingNumber"))].filter(Boolean).join(" "),
    district: textOf(find(address, "CitySubdivisionName")),
    city: textOf(find(address, "CityName")),
    postalCode: textOf(find(address, "PostalZone")),
    country: textOf(find(address, "Country/Name")) || "Türkiye",
    phone: textOf(find(p, "Contact/Telephone")),
    email: textOf(find(p, "Contact/ElectronicMail")),
    website: textOf(find(p, "WebsiteURI")),
  };
}

export function readUbl(xml) {
  const root = parseXml(xml);
  const invoice = child(root, "Invoice") || deep(root, "Invoice");
  if (!invoice) throw new Error("Belge bir UBL faturası değil.");
  const lines = children(invoice, "InvoiceLine").map(line => {
    const qty = child(line, "InvoicedQuantity");
    const price = num(textOf(find(line, "Price/PriceAmount")));
    const net = num(textOf(child(line, "LineExtensionAmount")));
    const allowance = children(line, "AllowanceCharge").filter(item => textOf(child(item, "ChargeIndicator")) !== "true");
    const discount = allowance.reduce((sum, item) => sum + num(textOf(child(item, "Amount"))), 0);
    const base = allowance.reduce((sum, item) => sum + num(textOf(child(item, "BaseAmount"))), 0) || net + discount;
    const tax = find(line, "TaxTotal/TaxSubtotal");
    const withholding = find(line, "WithholdingTaxTotal/TaxSubtotal");
    const quantity = num(textOf(qty)) || 1;
    return {
      name: textOf(find(line, "Item/Name")) || textOf(find(line, "Item/Description")) || "Kalem",
      code: textOf(find(line, "Item/SellersItemIdentification/ID")),
      description: textOf(child(line, "Note")),
      qty: quantity,
      unit: UNIT_NAMES[qty?.attrs?.unitCode] || "Adet",
      unitPrice: price || (quantity ? (net + discount) / quantity : 0),
      discountRate: base > 0 && discount > 0 ? Math.round((discount / base) * 10000) / 100 : 0,
      vatRate: num(textOf(child(tax, "Percent"))),
      vat: num(textOf(child(tax, "TaxAmount"))),
      net,
      exemptionCode: textOf(find(tax, "TaxCategory/TaxExemptionReasonCode")),
      withholdingCode: textOf(find(withholding, "TaxCategory/TaxScheme/TaxTypeCode")),
    };
  });
  const totals = find(invoice, "LegalMonetaryTotal");
  return {
    number: textOf(child(invoice, "ID")),
    uuid: textOf(child(invoice, "UUID")),
    issueDate: textOf(child(invoice, "IssueDate")),
    issueTime: textOf(child(invoice, "IssueTime")).slice(0, 5),
    profile: textOf(child(invoice, "ProfileID")),
    typeCode: textOf(child(invoice, "InvoiceTypeCode")),
    currency: textOf(child(invoice, "DocumentCurrencyCode")) || "TRY",
    rate: num(textOf(find(invoice, "PricingExchangeRate/CalculationRate"))) || 1,
    notes: children(invoice, "Note").map(textOf).filter(Boolean),
    orderNo: textOf(find(invoice, "OrderReference/ID")),
    despatchNo: textOf(find(invoice, "DespatchDocumentReference/ID")),
    supplier: party(find(invoice, "AccountingSupplierParty")),
    customer: party(find(invoice, "AccountingCustomerParty")),
    lines,
    totals: {
      net: num(textOf(child(totals, "TaxExclusiveAmount"))),
      gross: num(textOf(child(totals, "TaxInclusiveAmount"))),
      payable: num(textOf(child(totals, "PayableAmount"))),
      vat: num(textOf(find(invoice, "TaxTotal/TaxAmount"))),
    },
  };
}
