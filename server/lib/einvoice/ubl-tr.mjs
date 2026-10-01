// e-Belge (v2.0.15): faturanın UBL 2.1 XML'i — GİB UBL-TR 1.2 (e-Fatura Temel/Ticari, e-Arşiv) ve isteğe bağlı PEPPOL
// BIS Billing 3.0 (yurt dışı alıcı). Saf fonksiyon: fatura ayrıntısından (routes/invoices.mjs detail) XML metni üretir.
//
// Kapsam ve sınır: XML faturanın içeriğidir (taraflar, kalemler, KDV, tevkifat, iskonto, döviz, referanslar). Mali mühür /
// e-imza (UBLExtensions içindeki imza) ve GİB zarfı belgeyi gönderen entegratör ya da GİB portalı tarafından eklenir;
// program imza anahtarı tutmaz. Tutarlar faturanın kendi kuruş hesabından gelir (lib/invoice-math.mjs) — ekranda, PDF'te,
// defterde ve XML'de aynı sayı.
const NS = {
  invoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
};
// Birimler → UN/ECE Rec. 20 kodları (UBL InvoicedQuantity/@unitCode).
const UNIT_CODES = {
  adet: "C62", ad: "C62", tane: "C62", kg: "KGM", gr: "GRM", g: "GRM", ton: "TNE", lt: "LTR", l: "LTR", ml: "MLT", m: "MTR", metre: "MTR", cm: "CMT", mm: "MMT",
  "m²": "MTK", m2: "MTK", "m³": "MTQ", m3: "MTQ", paket: "PA", kutu: "BX", koli: "CT", çift: "PR", takım: "SET", set: "SET", saat: "HUR", gün: "DAY", ay: "MON", yıl: "ANN",
  dakika: "MIN", hafta: "WEE", rulo: "RO", şişe: "BO", torba: "BG", çuval: "SA", top: "C62", porsiyon: "C62", kişi: "C62", seans: "C62", ders: "C62",
};
export const unitCode = unit => UNIT_CODES[String(unit || "").trim().toLocaleLowerCase("tr-TR")] || "C62";
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const amount = value => (Math.round((Number(value) || 0) * 100) / 100).toFixed(2);
const tag = (name, value, attrs = "") => (value === undefined || value === null || value === "" ? "" : `<${name}${attrs}>${escape(value)}</${name}>`);
// Birim fiyat 4 ondalığa kadar (en az 2): 33.3333, 12.50.
const priceText = value => {
  const fixed = (Math.round((Number(value) || 0) * 10000) / 10000).toFixed(4);
  return fixed.replace(/(\.\d\d)(\d*?)0+$/, "$1$2");
};
const money = (name, value, currency) => `<${name} currencyID="${escape(currency)}">${amount(value)}</${name}>`;

function party(p, { variant }) {
  const id = String(p.taxNo || "").replace(/\s+/g, "");
  const scheme = id.length === 11 ? "TCKN" : "VKN";
  const person = p.partyKind === "person" || id.length === 11;
  const address = [
    "<cac:PostalAddress>",
    tag("cbc:StreetName", p.address || "-"),
    tag("cbc:CitySubdivisionName", p.district || p.city || "-"),
    tag("cbc:CityName", p.city || "-"),
    tag("cbc:PostalZone", p.postalCode),
    `<cac:Country>${variant === "peppol" ? tag("cbc:IdentificationCode", "TR") : ""}${tag("cbc:Name", p.country || "Türkiye")}</cac:Country>`,
    "</cac:PostalAddress>",
  ].join("");
  if (variant === "peppol") {
    return [
      "<cac:Party>",
      id ? `<cbc:EndpointID schemeID="9952">${escape(id)}</cbc:EndpointID>` : "",
      tag("cbc:WebsiteURI", p.website),
      `<cac:PartyName>${tag("cbc:Name", p.name)}</cac:PartyName>`,
      address,
      id ? `<cac:PartyTaxScheme>${tag("cbc:CompanyID", `TR${id}`)}<cac:TaxScheme>${tag("cbc:ID", "VAT")}</cac:TaxScheme></cac:PartyTaxScheme>` : "",
      `<cac:PartyLegalEntity>${tag("cbc:RegistrationName", p.name)}</cac:PartyLegalEntity>`,
      p.phone || p.email ? `<cac:Contact>${tag("cbc:Telephone", p.phone)}${tag("cbc:ElectronicMail", p.email)}</cac:Contact>` : "",
      "</cac:Party>",
    ].join("");
  }
  return [
    "<cac:Party>",
    tag("cbc:WebsiteURI", p.website),
    id ? `<cac:PartyIdentification><cbc:ID schemeID="${scheme}">${escape(id)}</cbc:ID></cac:PartyIdentification>` : "",
    p.mersisNo ? `<cac:PartyIdentification><cbc:ID schemeID="MERSISNO">${escape(p.mersisNo)}</cbc:ID></cac:PartyIdentification>` : "",
    p.tradeRegistry ? `<cac:PartyIdentification><cbc:ID schemeID="TICARETSICILNO">${escape(p.tradeRegistry)}</cbc:ID></cac:PartyIdentification>` : "",
    person ? "" : `<cac:PartyName>${tag("cbc:Name", p.name)}</cac:PartyName>`,
    address,
    `<cac:PartyTaxScheme><cac:TaxScheme>${tag("cbc:Name", p.taxOffice || "-")}</cac:TaxScheme></cac:PartyTaxScheme>`,
    p.phone || p.email ? `<cac:Contact>${tag("cbc:Telephone", p.phone)}${tag("cbc:ElectronicMail", p.email)}</cac:Contact>` : "",
    person ? `<cac:Person>${tag("cbc:FirstName", p.firstName || p.name)}${tag("cbc:FamilyName", p.familyName || "-")}</cac:Person>` : "",
    "</cac:Party>",
  ].join("");
}

// KDV dahil girilen fiyatta UBL birim fiyatı KDV hariç yazılır: (matrah + iskonto) ÷ miktar.
const netUnitPrice = (line, includeVat) => {
  if (!includeVat) return Number(line.unitPrice) || 0;
  const discountNet = (Number(line.discount) || 0) * (100 / (100 + (Number(line.vatRate) || 0)));
  return Math.round((((Number(line.net) || 0) + discountNet) / (Number(line.qty) || 1)) * 10000) / 10000;
};
const discountNet = (line, includeVat) => (includeVat ? Math.round((Number(line.discount) || 0) * (100 / (100 + (Number(line.vatRate) || 0))) * 100) / 100 : Number(line.discount) || 0);

function taxCategory(rate, exemptionCode, exemptionLabel, variant) {
  if (variant === "peppol") return `<cac:TaxCategory>${tag("cbc:ID", rate > 0 ? "S" : exemptionCode && exemptionCode !== "351" ? "E" : "Z")}${tag("cbc:Percent", rate)}${rate > 0 ? "" : tag("cbc:TaxExemptionReason", exemptionLabel || "Exempt")}<cac:TaxScheme>${tag("cbc:ID", "VAT")}</cac:TaxScheme></cac:TaxCategory>`;
  return `<cac:TaxCategory>${rate === 0 ? `${tag("cbc:TaxExemptionReasonCode", exemptionCode || "351")}${tag("cbc:TaxExemptionReason", exemptionLabel || "")}` : ""}<cac:TaxScheme>${tag("cbc:Name", "KDV")}${tag("cbc:TaxTypeCode", "0015")}</cac:TaxScheme></cac:TaxCategory>`;
}
const EXEMPTION_LABELS = { 351: "KDV - İstisna Olmayan Diğer", 301: "11/1-a Mal İhracatı", 302: "11/1-a Hizmet İhracatı", 308: "13/a Deniz, Hava ve Demiryolu Taşıma Araçlarının Teslimi", 350: "Diğerleri" };

/**
 * @param {object} doc  routes/invoices.mjs detail() çıktısı (kesilmiş fatura)
 * @param {{ variant?: 'tr' | 'peppol' }} options
 */
export function buildUbl(doc, { variant = "tr" } = {}) {
  const currency = doc.currency || "TRY";
  const includeVat = Boolean(doc.pricesIncludeVat);
  const lines = doc.lines || [];
  const seller = doc.kind === "purchase" || doc.kind === "sale_return" ? doc.party : doc.seller;
  const buyer = doc.kind === "purchase" || doc.kind === "sale_return" ? doc.seller : doc.party;
  const byRate = new Map();
  for (const line of lines) {
    const item = byRate.get(line.vatRate) || { rate: line.vatRate, net: 0, vat: 0, exemptionCode: line.exemptionCode };
    item.net += Number(line.net) || 0;
    item.vat += Number(line.vat) || 0;
    byRate.set(line.vatRate, item);
  }
  const byWithholding = new Map();
  for (const line of lines.filter(item => item.withholdingCode)) {
    const item = byWithholding.get(line.withholdingCode) || { code: line.withholdingCode, num: line.withholdingNum, den: line.withholdingDen, vat: 0, withheld: 0 };
    item.vat += Number(line.vat) || 0;
    item.withheld += Number(line.withheld) || 0;
    byWithholding.set(line.withholdingCode, item);
  }
  const percent = (num, den) => Math.round((num / (den || 1)) * 100);
  const taxTotal = [...byRate.values()].sort((a, b) => a.rate - b.rate);
  const discountTotal = lines.reduce((sum, line) => sum + discountNet(line, includeVat), 0);
  const lineExtension = lines.reduce((sum, line) => sum + (Number(line.net) || 0), 0);
  const notes = [doc.amountInWords, doc.note, doc.originalNumber ? `İade edilen fatura: ${doc.originalNumber}` : "", doc.stoppageTotal > 0 ? `Gelir Vergisi Stopajı %${doc.stoppageRate}: ${amount(doc.stoppageTotal)} ${currency}` : ""].filter(Boolean);
  const head =
    variant === "peppol"
      ? [tag("cbc:CustomizationID", "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"), tag("cbc:ProfileID", "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"), tag("cbc:ID", doc.number), tag("cbc:IssueDate", doc.issueDate), tag("cbc:DueDate", doc.dueDate || doc.issueDate), tag("cbc:InvoiceTypeCode", doc.typeCode === "IADE" ? "381" : "380"), ...notes.map(note => tag("cbc:Note", note)), tag("cbc:DocumentCurrencyCode", currency), tag("cbc:TaxCurrencyCode", currency === "TRY" ? "" : "TRY")]
      : [
          "<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>",
          tag("cbc:UBLVersionID", "2.1"),
          tag("cbc:CustomizationID", "TR1.2"),
          tag("cbc:ProfileID", doc.profile),
          tag("cbc:ID", doc.number),
          tag("cbc:CopyIndicator", "false"),
          tag("cbc:UUID", doc.ettn),
          tag("cbc:IssueDate", doc.issueDate),
          tag("cbc:IssueTime", `${doc.issueTime || "00:00"}:00`),
          tag("cbc:InvoiceTypeCode", doc.typeCode),
          ...notes.map(note => tag("cbc:Note", note)),
          tag("cbc:DocumentCurrencyCode", currency),
          tag("cbc:LineCountNumeric", lines.length),
        ];
  const references = [
    doc.orderNo ? `<cac:OrderReference>${tag("cbc:ID", doc.orderNo)}${variant === "peppol" ? "" : tag("cbc:IssueDate", doc.orderDate || doc.issueDate)}</cac:OrderReference>` : "",
    doc.originalNumber ? `<cac:BillingReference><cac:InvoiceDocumentReference>${tag("cbc:ID", doc.originalNumber)}${tag("cbc:IssueDate", doc.originalDate || "")}</cac:InvoiceDocumentReference></cac:BillingReference>` : "",
    doc.despatchNo ? `<cac:DespatchDocumentReference>${tag("cbc:ID", doc.despatchNo)}${variant === "peppol" ? "" : tag("cbc:IssueDate", doc.despatchDate || doc.issueDate)}</cac:DespatchDocumentReference>` : "",
  ];
  const bank = (doc.seller?.banks || []).find(item => item.iban);
  const payment = bank || doc.dueDate ? `<cac:PaymentMeans>${tag("cbc:PaymentMeansCode", bank ? (variant === "peppol" ? "58" : "42") : "1")}${variant === "peppol" ? "" : tag("cbc:PaymentDueDate", doc.dueDate || doc.issueDate)}${bank ? `<cac:PayeeFinancialAccount>${tag("cbc:ID", bank.iban)}${variant === "peppol" ? "" : tag("cbc:CurrencyCode", currency)}</cac:PayeeFinancialAccount>` : ""}</cac:PaymentMeans>` : "";
  const exchange = currency !== "TRY" && variant !== "peppol" ? `<cac:PricingExchangeRate>${tag("cbc:SourceCurrencyCode", currency)}${tag("cbc:TargetCurrencyCode", "TRY")}${tag("cbc:CalculationRate", doc.rate)}${tag("cbc:Date", doc.issueDate)}</cac:PricingExchangeRate>` : "";
  const vatTotal = taxTotal.reduce((sum, item) => sum + item.vat, 0);
  const tax = `<cac:TaxTotal>${money("cbc:TaxAmount", vatTotal, currency)}${taxTotal
    .map(item => `<cac:TaxSubtotal>${money("cbc:TaxableAmount", item.net, currency)}${money("cbc:TaxAmount", item.vat, currency)}${variant === "peppol" ? "" : tag("cbc:Percent", item.rate)}${taxCategory(item.rate, item.exemptionCode, EXEMPTION_LABELS[item.exemptionCode], variant)}</cac:TaxSubtotal>`)
    .join("")}</cac:TaxTotal>`;
  const withholding =
    byWithholding.size && variant !== "peppol"
      ? `<cac:WithholdingTaxTotal>${money("cbc:TaxAmount", [...byWithholding.values()].reduce((sum, item) => sum + item.withheld, 0), currency)}${[...byWithholding.values()]
          .map(item => `<cac:TaxSubtotal>${money("cbc:TaxableAmount", item.vat, currency)}${money("cbc:TaxAmount", item.withheld, currency)}${tag("cbc:Percent", percent(item.num, item.den))}<cac:TaxCategory><cac:TaxScheme>${tag("cbc:Name", "KDV TEVKİFAT")}${tag("cbc:TaxTypeCode", item.code)}</cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`)
          .join("")}</cac:WithholdingTaxTotal>`
      : "";
  const gross = lineExtension + vatTotal;
  const totals = `<cac:LegalMonetaryTotal>${money("cbc:LineExtensionAmount", lineExtension, currency)}${money("cbc:TaxExclusiveAmount", lineExtension, currency)}${money("cbc:TaxInclusiveAmount", gross, currency)}${discountTotal > 0 && variant !== "peppol" ? money("cbc:AllowanceTotalAmount", discountTotal, currency) : ""}${money("cbc:PayableAmount", variant === "peppol" ? gross : doc.payableTotal, currency)}</cac:LegalMonetaryTotal>`;
  const invoiceLines = lines
    .map((line, index) => {
      const price = netUnitPrice(line, includeVat);
      const discount = discountNet(line, includeVat);
      const lineWithholding =
        line.withholdingCode && variant !== "peppol"
          ? `<cac:WithholdingTaxTotal>${money("cbc:TaxAmount", line.withheld, currency)}<cac:TaxSubtotal>${money("cbc:TaxableAmount", line.vat, currency)}${money("cbc:TaxAmount", line.withheld, currency)}${tag("cbc:Percent", percent(line.withholdingNum, line.withholdingDen))}<cac:TaxCategory><cac:TaxScheme>${tag("cbc:Name", "KDV TEVKİFAT")}${tag("cbc:TaxTypeCode", line.withholdingCode)}</cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:WithholdingTaxTotal>`
          : "";
      return [
        "<cac:InvoiceLine>",
        tag("cbc:ID", index + 1),
        variant === "peppol" ? "" : tag("cbc:Note", line.description),
        `<cbc:InvoicedQuantity unitCode="${unitCode(line.unit)}">${escape(line.qty)}</cbc:InvoicedQuantity>`,
        money("cbc:LineExtensionAmount", line.net, currency),
        discount > 0 ? `<cac:AllowanceCharge>${tag("cbc:ChargeIndicator", "false")}${variant === "peppol" ? tag("cbc:AllowanceChargeReason", "İskonto") : tag("cbc:MultiplierFactorNumeric", (Math.round((discount / ((Number(line.net) || 0) + discount || 1)) * 10000) / 10000).toString())}${money("cbc:Amount", discount, currency)}${money("cbc:BaseAmount", (Number(line.net) || 0) + discount, currency)}</cac:AllowanceCharge>` : "",
        variant === "peppol" ? "" : `<cac:TaxTotal>${money("cbc:TaxAmount", line.vat, currency)}<cac:TaxSubtotal>${money("cbc:TaxableAmount", line.net, currency)}${money("cbc:TaxAmount", line.vat, currency)}${tag("cbc:Percent", line.vatRate)}${taxCategory(line.vatRate, line.exemptionCode, EXEMPTION_LABELS[line.exemptionCode], variant)}</cac:TaxSubtotal></cac:TaxTotal>`,
        lineWithholding,
        `<cac:Item>${variant === "peppol" ? tag("cbc:Description", line.description) : ""}${tag("cbc:Name", line.name)}${line.code ? `<cac:SellersItemIdentification>${tag("cbc:ID", line.code)}</cac:SellersItemIdentification>` : ""}${variant === "peppol" ? taxCategory(line.vatRate, line.exemptionCode, EXEMPTION_LABELS[line.exemptionCode], "peppol").replace("cac:TaxCategory", "cac:ClassifiedTaxCategory").replace("</cac:TaxCategory>", "</cac:ClassifiedTaxCategory>") : ""}</cac:Item>`,
        `<cac:Price><cbc:PriceAmount currencyID="${escape(currency)}">${priceText(price)}</cbc:PriceAmount></cac:Price>`,
        "</cac:InvoiceLine>",
      ].join("");
    })
    .join("");
  const body = [
    ...head,
    ...references,
    `<cac:AccountingSupplierParty>${party(seller || {}, { variant })}</cac:AccountingSupplierParty>`,
    `<cac:AccountingCustomerParty>${party(buyer || {}, { variant })}</cac:AccountingCustomerParty>`,
    payment,
    exchange,
    tax,
    withholding,
    totals,
    invoiceLines,
  ].join("");
  const ns = variant === "peppol" ? `xmlns="${NS.invoice}" xmlns:cac="${NS.cac}" xmlns:cbc="${NS.cbc}"` : `xmlns="${NS.invoice}" xmlns:cac="${NS.cac}" xmlns:cbc="${NS.cbc}" xmlns:ext="${NS.ext}"`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Invoice ${ns}>${body}</Invoice>\n`;
}

export const ublFileName = (doc, peppol = false) => `${String(doc.number || doc.id).replace(/[^A-Za-z0-9_-]/g, "")}${peppol ? "-peppol" : ""}.xml`;
