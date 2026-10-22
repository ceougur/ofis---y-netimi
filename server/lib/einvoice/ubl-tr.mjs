// e-Belge (v2.0.15): faturanın UBL 2.1 XML'i — GİB UBL-TR 1.2 (e-Fatura Temel/Ticari, e-Arşiv) ve isteğe bağlı PEPPOL
// BIS Billing 3.0 (yurt dışı alıcı). Saf fonksiyon: fatura ayrıntısından (routes/invoices.mjs detail) XML metni üretir.
//
// Kapsam ve sınır: XML faturanın içeriğidir (taraflar, kalemler, KDV, tevkifat, iskonto, döviz, referanslar). Mali mühür /
// e-imza (UBLExtensions içindeki imza) ve GİB zarfı belgeyi gönderen entegratör ya da GİB portalı tarafından eklenir;
// program imza anahtarı tutmaz. Tutarlar faturanın kendi kuruş hesabından gelir (lib/invoice-math.mjs) — ekranda, PDF'te,
// defterde ve XML'de aynı sayı.
import { EXEMPTIONS, cents, exclusiveParts, normalizeExemption } from "../invoice-math.mjs";
import { viewReference } from "./gorunum.mjs";
const NS = {
  invoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
};
// Birimler → UN/ECE Rec. 20 kodları (UBL InvoicedQuantity/@unitCode). Yalnız entegratörün KABUL ETTİĞİ kodlar: gerçek EDM test ortamı (16.10.2026,
// docs/kanit/2026-10-16/edm-birim) GİB kod listesinde olan Çuval SA, Koli CT, Şişe BO, Rulo RO, Torba BG ve Hafta WEE kodlarını "Geçersiz Ölçü Birim
// Kodu" (11059/11047) ile reddetti (iki şirket / on kullanıcı yük denemesinde Çuval'lı e-Faturalar düştü). Karşılığı kabul edilmeyen birim Adet (C62)
// gider; birimin adı kalem notuna yazılır (unitNote).
const UNIT_CODES = {
  adet: "C62", ad: "C62", tane: "C62", kg: "KGM", gr: "GRM", g: "GRM", ton: "TNE", lt: "LTR", l: "LTR", ml: "MLT", m: "MTR", metre: "MTR", cm: "CMT", mm: "MMT",
  "m²": "MTK", m2: "MTK", "m³": "MTQ", m3: "MTQ", paket: "PA", kutu: "BX", çift: "PR", takım: "SET", set: "SET", saat: "HUR", gün: "DAY", ay: "MON", yıl: "ANN",
  dakika: "MIN", düzine: "DZN",
};
// Gerçek EDM'nin kabul ettiği kodlar (aynı kanıt; test/ebelge-240-birim.test.mjs program birimlerini buna karşı denetler).
export const EDM_ACCEPTED_UNIT_CODES = Object.freeze(["C62", "KGM", "GRM", "TNE", "LTR", "MLT", "MTR", "CMT", "MMT", "MTK", "MTQ", "PA", "BX", "PR", "SET", "HUR", "DAY", "MON", "ANN", "MIN", "DZN", "NIU", "PK", "CMQ"]);
// Kendi koduyla giden birimler (küçük harf): istemci, Adet koduyla gidecek birimde ipucu gösterir (tek kaynak bu liste).
export const UNIT_CODE_KEYS = Object.freeze(Object.keys(UNIT_CODES));
export const unitCode = unit => UNIT_CODES[String(unit || "").trim().toLocaleLowerCase("tr-TR")] || "C62";
// Adet dışında olup Adet koduyla giden birimin (Çuval, Koli, Şişe, Teneke, Hafta, Seans…) adı: alıcı belgede gerçek birimi görür.
export const unitNote = unit => {
  const name = String(unit || "").trim();
  return name && unitCode(name) === "C62" && !["adet", "ad", "tane"].includes(name.toLocaleLowerCase("tr-TR")) ? `Birim: ${name}` : "";
};
// XML 1.0'da geçersiz karakterler (C0 denetim, U+FFFE/U+FFFF, eşsiz vekil yarısı) ayıklanır (2.4.0 bitiş turu, eleştirmen E5: belge şemadan düşüyordu).
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "");
const amount = value => (Math.round((Number(value) || 0) * 100) / 100).toFixed(2);
const tag = (name, value, attrs = "") => (value === undefined || value === null || value === "" ? "" : `<${name}${attrs}>${escape(value)}</${name}>`);
// Birim fiyat 4 ondalığa kadar (en az 2): 33.3333, 12.50.
const priceText = value => {
  const fixed = (Math.round((Number(value) || 0) * 10000) / 10000).toFixed(4);
  return fixed.replace(/(\.\d\d)(\d*?)0+$/, "$1$2");
};
const money = (name, value, currency) => `<${name} currencyID="${escape(currency)}">${amount(value)}</${name}>`;

// Şahıs firmasının ticari unvanı (16.10.2026, Wolvox karşılaştırması): TCKN'li tarafta GİB ad ve soyadı Person'da ister; cari adı ad-soyaddan
// farklıysa ("Ahmet Yılmaz İnşaat") o ad ticari unvandır ve PartyName'e de yazılır — yoksa e-Belgede yalnız ad-soyad görünür, unvan kaybolur.
const folded = text => String(text || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
export function tradeNameOf(p) {
  const name = String(p.name || "").replace(/\s+/g, " ").trim();
  if (!name) return "";
  return folded(name) === folded(`${p.firstName || ""} ${p.familyName || ""}`) ? "" : name;
}

// VKN'li e-SMM düzenleyeninin unvanı Person'a: son sözcük FamilyName, kalanı FirstName (tek sözcükte FamilyName "-").
export function issuerPerson(name) {
  const words = String(name || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return "";
  const family = words.length > 1 ? words.pop() : "-";
  return `<cac:Person>${tag("cbc:FirstName", words.join(" "))}${tag("cbc:FamilyName", family)}</cac:Person>`;
}

function party(p, { variant, esmm = false, issuer = false }) {
  const id = String(p.taxNo || "").replace(/\s+/g, "");
  const scheme = id.length === 11 ? "TCKN" : "VKN";
  const person = p.partyKind === "person" || id.length === 11;
  const address = [
    "<cac:PostalAddress>",
    // e-SMM: adres EDM'nin e-SMM örneğindeki gibi YALNIZ BuildingName'de (EDM GİB biçiminde caddeSokak'ı ondan doldurur; StreetName de verilirse
    // resmî PDF'te adres iki kez yazılır — 22.10.2026 gerçek EDM: "Test Cd. 1 Test Cd. 1"). e-Fatura / e-Arşiv StreetName ile (EDM kabul ediyor).
    esmm ? tag("cbc:BuildingName", p.address || "-") : tag("cbc:StreetName", p.address || "-"),
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
    person && !tradeNameOf(p) ? "" : `<cac:PartyName>${tag("cbc:Name", person ? tradeNameOf(p) : p.name)}</cac:PartyName>`,
    address,
    `<cac:PartyTaxScheme><cac:TaxScheme>${tag("cbc:Name", p.taxOffice || "-")}</cac:TaxScheme></cac:PartyTaxScheme>`,
    p.phone || p.email ? `<cac:Contact>${tag("cbc:Telephone", p.phone)}${tag("cbc:ElectronicMail", p.email)}</cac:Contact>` : "",
    person ? `<cac:Person>${tag("cbc:FirstName", p.firstName || p.name)}${tag("cbc:FamilyName", p.familyName || "-")}</cac:Person>` : "",
    // e-SMM, VKN'li düzenleyen (ör. adi ortaklık): EDM'nin e-SMM görüntüsü düzenleyenin adını YALNIZ Person'dan basar (FirstName + " " + FamilyName;
    // PartyName basılmaz) ve EDM'nin UBL-TR şeması FamilyName'i zorunlu tutar (11029) — 22.10.2026 gerçek EDM test ortamında denendi. Makbuzda
    // düzenleyenin adı/unvanı bulunmalı (VUK 236): unvan son sözcüğünden bölünür, EDM boşlukla birleştirip unvanı aynen basar.
    esmm && issuer && !person ? issuerPerson(p.name) : "",
    "</cac:Party>",
  ].join("");
}

// KDV dahil girilen fiyatta UBL birim fiyatı ve iskonto KDV hariç yazılır; ekran, fiş ve PDF ile aynı kuralla
// (invoice-math exclusiveParts): KDV hariç brüt − iskonto = matrah, kuruşu kuruşuna.
const netUnitPrice = (line, includeVat) => (includeVat ? Math.round((exclusiveParts(line, true, 100).baseNet / (Number(line.qty) || 1)) * 10000) / 10000 : Number(line.unitPrice) || 0);
const discountNet = (line, includeVat) => (includeVat ? exclusiveParts(line, true, 100).discountNet : Number(line.discount) || 0);

function taxCategory(rate, exemptionCode, exemptionLabel, variant, schemeName = "KDV") {
  if (variant === "peppol") return `<cac:TaxCategory>${tag("cbc:ID", rate > 0 ? "S" : exemptionCode && exemptionCode !== "351" ? "E" : "Z")}${tag("cbc:Percent", rate)}${rate > 0 ? "" : tag("cbc:TaxExemptionReason", exemptionLabel || "Exempt")}<cac:TaxScheme>${tag("cbc:ID", "VAT")}</cac:TaxScheme></cac:TaxCategory>`;
  return `<cac:TaxCategory>${rate === 0 ? `${tag("cbc:TaxExemptionReasonCode", normalizeExemption(exemptionCode) || "351")}${tag("cbc:TaxExemptionReason", exemptionLabel || "")}` : ""}<cac:TaxScheme>${tag("cbc:Name", schemeName)}${tag("cbc:TaxTypeCode", "0015")}</cac:TaxScheme></cac:TaxCategory>`;
}
// İstisna adları tek kaynaktan (invoice-math EXEMPTIONS, GİB kod listesi); eski kayıttaki 308 → 304 (aynı anlam, 13/a).
const exemptionLabel = code => EXEMPTIONS[normalizeExemption(code)] || "";

// ---------- e-SMM (2.4.4, iş listesi 21) ----------
// e-SMM'yi GİB UBL-TR profili olarak tanımlamaz (Kod Listeleri v1.43 ProfileID: e-Fatura/e-Arşiv); GİB'in e-SMM veri tanımı e-Arşiv raporudur
// (e-Arşiv Teknik Kılavuzu V1.19 §3.3.6 serbestMeslekMakbuz: toplamTutar = "vergi hariç toplam tutar", odenecekTutar = "ödenecek tutar",
// vergiBilgisi/vergi = matrah + vergiKodu + vergiTutari + vergiOrani, tevkifat ayrı). EDM e-SMM'yi UBL olarak (ProfileID ESMM) alır, GİB'e
// raporu kendisi üretir; UBL'deki anlamlar EDM'nin örnek belgesinden ve Ek_bilgi'sinden (kullanıcının yüklediği EDM belgeleri, 21.10.2026):
//   LegalMonetaryTotal: LineExtensionAmount = Brüt Ücret, TaxExclusiveAmount = Net Ücret (brüt − GV stopajı), TaxInclusiveAmount = Tahsil Edilen
//   KDV (KDV − KDV tevkifatı), PayableAmount = Toplam Net Alınan (net ücret + tahsil edilen KDV);
//   TaxTotal: TaxAmount = KDV; TaxSubtotal 0003 (GV stopajı, CalculationSequenceNumeric 1) + 0015 (KDV, 2) — belge ve kalem düzeyinde;
//   InvoiceLine: InvoicedQuantity (NIU) = kalemin Net Ücreti, LineExtensionAmount = Brüt, Price = kalemin Net Tahsilatı (EDM'nin e-SMM görünümü bu
//   alanları böyle okur).
// Vergi kodları GİB Kod Listeleri v1.43 §1.9: 0003 Gelir Vergisi Stopajı (GV STOPAJI), 0015 Gerçek Usulde KDV (KDV GERCEK). Matrah (TaxableAmount)
// GİB raporundaki gibi brüt ücrettir (EDM örneğindeki 0 değil). TUTARLAR programın kâğıt SMM hesabından gelir (invoice-math; ekranda, PDF'te, defterde
// ve cari'de aynı kuruş): stopaj belge toplamından TEK kez hesaplanır (GİB raporunda belge düzeyinde matrah × oran) ve kalemlere aşağıdaki kuralla
// kuruşu kuruşuna dağıtılır — kalem stopajlarının toplamı belge stopajına eşittir.
const STOPPAGE_TAX = Object.freeze({ code: "0003", name: "GV STOPAJI" });
const ESMM_VAT_NAME = "KDV GERCEK";
/**
 * Belge stopajının (kuruş) kalemlere dağıtımı — en büyük kalan yöntemi: her kalemin tam payı net × oran; önce kuruşa aşağı yuvarlanır, belge
 * toplamına kalan kuruşlar kesir kısmı en büyük kalemlerden başlayarak (eşitlikte önceki kalem) birer birer eklenir. Belge stopajı programın
 * hesabıdır (yuvarlanmış matrah × oran); dağıtım onu DEĞİŞTİRMEZ. Tutarsız girdide (kalan kuruş < 0 ya da > kalem sayısı) hata.
 * @param {number[]} netsMinor kalem matrahları (kuruş), @param {number} rate stopaj oranı (%; en çok 2 ondalık), @param {number} totalMinor belge stopajı (kuruş)
 */
export function stoppageShares(netsMinor, rate, totalMinor) {
  const bp = Math.round((Number(rate) || 0) * 100);
  const exact = netsMinor.map(net => Math.round(Number(net) || 0) * bp);
  const shares = exact.map(value => Math.floor(value / 10000));
  const rest = Math.round(Number(totalMinor) || 0) - shares.reduce((sum, value) => sum + value, 0);
  if (rest < 0 || rest > shares.length) throw new Error(`e-SMM stopajı kalemlere dağıtılamadı (belge stopajı ${totalMinor} kuruş, kalem payları toplamı ${shares.reduce((a, b) => a + b, 0)} kuruş).`);
  const order = exact.map((value, index) => ({ index, remainder: value % 10000 })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order.slice(0, rest)) shares[index] += 1;
  return shares;
}
// e-SMM tutarları (belgenin para biriminde, kuruş): programın kayıtlı toplamlarından; GİB kimliği Net Alınan = Net Ücret + Tahsil Edilen KDV
// denetlenir (tutmazsa belge üretilmez — yanlış tutarlı resmî makbuz gitmesin).
export function esmmAmounts(doc) {
  const lines = doc.lines || [];
  const gross = cents(doc.netTotal);
  const stoppage = cents(doc.stoppageTotal);
  const vat = cents(doc.vatTotal);
  const withheld = cents(doc.withheldTotal);
  const payable = cents(doc.payableTotal);
  const nets = lines.map(line => cents(line.net));
  const sum = values => values.reduce((total, value) => total + value, 0);
  if (sum(nets) !== gross || sum(lines.map(line => cents(line.vat))) !== vat || sum(lines.map(line => cents(line.withheld))) !== withheld) throw new Error("e-SMM kalem toplamları belge toplamlarıyla tutmuyor; belge üretilmedi.");
  const netFee = gross - stoppage;
  const collectedVat = vat - withheld;
  if (netFee + collectedVat !== payable) throw new Error("e-SMM tutarları tutarsız (Net Alınan ≠ Net Ücret + Tahsil Edilen KDV); belge üretilmedi.");
  const shares = stoppageShares(nets, doc.stoppageRate, stoppage);
  return { gross, stoppage, netFee, vat, withheld, collectedVat, payable, shares };
}

// Ödeme şekli (Wolvox karşılaştırması, kullanıcı kararı 16.10.2026: isteğe bağlı): faturanın peşin satırlarının yolu ve bağlı çek/senet → GİB kod listesi
// PaymentMeansCodeTypeList (UN/ECE 4461) kodu. Kalan (vadeli) kısım ayrıca açık ödeme olarak yazılır (IBAN varsa 42 + son ödeme tarihi).
export const PAYMENT_MEANS_CODES = Object.freeze({ cash: "10", bank: "42", card: "48", cheque: "20", note: "60" });
export function paymentMeansOf(doc) {
  const codes = [];
  let covered = 0;
  const add = (code, value) => {
    if (!codes.includes(code)) codes.push(code);
    covered += Number(value) || 0;
  };
  for (const entry of doc.payments || []) add(PAYMENT_MEANS_CODES[entry.method] || PAYMENT_MEANS_CODES.cash, entry.amount);
  for (const cheque of doc.cheques || []) add(PAYMENT_MEANS_CODES[cheque.instrument] || PAYMENT_MEANS_CODES.cheque, cheque.amount);
  const payable = Number(doc.tryPayable ?? doc.payableTotal) || 0;
  return { codes, rest: Math.round((payable - covered) * 100) > 0 };
}

/**
 * @param {object} doc  routes/invoices.mjs detail() çıktısı (kesilmiş fatura)
 * @param {{ variant?: 'tr' | 'peppol' }} options
 */
// xslt: görünüm şablonu (gorunum.mjs viewXslt); verilirse belgeye gömülür ve alıcının gördüğü sayfayı o çizer. Yalnız UBL-TR.
// notes: ek cbc:Note satırları (ör. cari bakiyesi). paymentMeans: ödeme şekli kodları yazılsın mı (kapalıyken eski davranış: IBAN varsa 42, yoksa 1).
export function buildUbl(doc, { variant = "tr", earchiveEmail = true, xslt = "", notes: extraNotes = [], paymentMeans = false } = {}) {
  const currency = doc.currency || "TRY";
  const includeVat = Boolean(doc.pricesIncludeVat);
  const lines = doc.lines || [];
  const seller = doc.kind === "purchase" || doc.kind === "sale_return" ? doc.party : doc.seller;
  const buyer = doc.kind === "purchase" || doc.kind === "sale_return" ? doc.seller : doc.party;
  // e-SMM (ProfileID ESMM): vergi ve dip toplamlar EDM'nin e-SMM anlamıyla (yukarıda); stopaj Not değil, 0003 vergi satırıdır.
  const esmm = variant !== "peppol" && doc.profile === "ESMM";
  const smm = esmm ? esmmAmounts(doc) : null;
  // KDV alt toplamı oran + istisna koduna göre (2.4.0 bitiş turu, yargıç Y4): %0'da iki ayrı istisna kodu (ör. 351 ve 301) ayrı satırda; önceden
  // ilk kalemin kodu hepsine yazılıyor, ikincisi kayboluyordu.
  const byRate = new Map();
  for (const line of lines) {
    const key = Number(line.vatRate) === 0 ? `0|${line.exemptionCode || ""}` : String(line.vatRate);
    const item = byRate.get(key) || { rate: line.vatRate, net: 0, vat: 0, exemptionCode: line.exemptionCode };
    item.net += Number(line.net) || 0;
    item.vat += Number(line.vat) || 0;
    byRate.set(key, item);
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
  const notes = [doc.amountInWords, doc.note, doc.originalNumber ? `İade edilen fatura: ${doc.originalNumber}` : "", doc.stoppageTotal > 0 && !esmm ? `Gelir Vergisi Stopajı %${doc.stoppageRate}: ${amount(doc.stoppageTotal)} ${currency}` : "", ...(variant === "peppol" ? [] : extraNotes)].filter(Boolean);
  const head =
    variant === "peppol"
      ? [tag("cbc:CustomizationID", "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"), tag("cbc:ProfileID", "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"), tag("cbc:ID", doc.number), tag("cbc:IssueDate", doc.issueDate), tag("cbc:DueDate", doc.dueDate || doc.issueDate), tag("cbc:InvoiceTypeCode", doc.typeCode === "IADE" ? "381" : "380"), ...notes.map(note => tag("cbc:Note", note)), tag("cbc:DocumentCurrencyCode", currency), tag("cbc:TaxCurrencyCode", currency === "TRY" ? "" : "TRY")]
      : [
          // ext:UBLExtensions (mali mühür / e-imza) yazılmaz: imzayı entegratör ekler (EDM örnek belgelerinde de yok); boş
          // ext:ExtensionContent UBL 2.1 şemasına aykırıdır (en az bir öğe ister) — test/ebelge-uygunluk.test.mjs.
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
    // GİB (IADEInvioceCheck): iade faturasında asıl fatura DocumentTypeCode "IADE" ile gösterilir.
    // MM1 (2.4.3): asıl numara 16 karakter değilse iade formundaki e-Belge referansı (returnRef) yazılır; gerçek numara açıklamada (Note) kalır.
    doc.originalNumber ? `<cac:BillingReference><cac:InvoiceDocumentReference>${tag("cbc:ID", doc.returnRef || doc.originalNumber)}${tag("cbc:IssueDate", doc.originalDate || "")}${variant !== "peppol" && doc.typeCode === "IADE" ? tag("cbc:DocumentTypeCode", "IADE") : ""}</cac:InvoiceDocumentReference></cac:BillingReference>` : "",
    doc.despatchNo ? `<cac:DespatchDocumentReference>${tag("cbc:ID", doc.despatchNo)}${variant === "peppol" ? "" : tag("cbc:IssueDate", doc.despatchDate || doc.issueDate)}</cac:DespatchDocumentReference>` : "",
    // e-Arşiv gönderim şekli (GİB e-Arşiv kılavuzu): alıcının e-postası varsa ELEKTRONIK (entegratör e-postayla iletir),
    // yoksa KAGIT (çıktısı verilir).
    // Entegratör Ayarları "e-Arşiv faturasında PDF'i müşteriye e-postayla gönder" kapalıysa KAGIT (çıktısı verilir).
    // e-SMM de: GİB e-SMM raporunda gonderimSekli (KAGIT/ELEKTRONIK) zorunludur (e-Arşiv Teknik Kılavuzu V1.19 §3.3.6.2); aynı kural.
    variant !== "peppol" && (doc.profile === "EARSIVFATURA" || esmm) ? `<cac:AdditionalDocumentReference>${tag("cbc:ID", buyer?.email && earchiveEmail ? "ELEKTRONIK" : "KAGIT")}${tag("cbc:IssueDate", doc.issueDate)}${tag("cbc:DocumentTypeCode", "SendingType")}${tag("cbc:DocumentType", buyer?.email && earchiveEmail ? "ELEKTRONIK" : "KAGIT")}</cac:AdditionalDocumentReference>` : "",
    variant !== "peppol" && xslt ? viewReference({ number: doc.number, issueDate: doc.issueDate, ettn: doc.ettn, xslt }) : "",
    // İmzalayan taraf (UBL-TR'de zorunlu cac:Signature): belgeyi entegratör mali mühürle imzalar; burada imzanın kime ait
    // olduğu ve imzanın yeri (#Signature) bildirilir.
    variant !== "peppol" && seller?.taxNo
      ? `<cac:Signature>${`<cbc:ID schemeID="VKN_TCKN">${escape(seller.taxNo)}</cbc:ID>`}<cac:SignatoryParty><cac:PartyIdentification><cbc:ID schemeID="${String(seller.taxNo).length === 11 ? "TCKN" : "VKN"}">${escape(seller.taxNo)}</cbc:ID></cac:PartyIdentification><cac:PostalAddress>${tag("cbc:StreetName", seller.address)}${tag("cbc:CitySubdivisionName", seller.district)}${tag("cbc:CityName", seller.city)}${tag("cbc:PostalZone", seller.postalCode)}<cac:Country>${tag("cbc:Name", seller.country || "Türkiye")}</cac:Country></cac:PostalAddress></cac:SignatoryParty><cac:DigitalSignatureAttachment><cac:ExternalReference>${tag("cbc:URI", `#Signature_${doc.number}`)}</cac:ExternalReference></cac:DigitalSignatureAttachment></cac:Signature>`
      : "",
  ];
  const bank = (doc.seller?.banks || []).find(item => item.iban);
  const openMeans = `<cac:PaymentMeans>${tag("cbc:PaymentMeansCode", bank ? (variant === "peppol" ? "58" : "42") : "1")}${variant === "peppol" ? "" : tag("cbc:PaymentDueDate", doc.dueDate || doc.issueDate)}${bank ? `<cac:PayeeFinancialAccount>${tag("cbc:ID", bank.iban)}${variant === "peppol" ? "" : tag("cbc:CurrencyCode", currency)}</cac:PayeeFinancialAccount>` : ""}</cac:PaymentMeans>`;
  let payment = bank || doc.dueDate ? openMeans : "";
  if (paymentMeans && variant !== "peppol") {
    // Ödenen kısım yoluyla (son ödeme tarihi yazılmaz: ödenmiştir), kalan kısım açık ödeme olarak (son ödeme tarihi + IBAN). Hiç peşin yoksa
    // eski davranış. Peşine belge tarihi yazılınca görüntüleyiciler "Son Ödeme Tarihi"ni ilk satırdan okuyup vadeyi yanlış gösteriyordu
    // (gerçek EDM denemesi 16.10.2026).
    const { codes, rest } = paymentMeansOf(doc);
    if (codes.length) payment = codes.map(code => `<cac:PaymentMeans>${tag("cbc:PaymentMeansCode", code)}</cac:PaymentMeans>`).join("") + (rest ? openMeans : "");
  }
  const exchange = currency !== "TRY" && variant !== "peppol" ? `<cac:PricingExchangeRate>${tag("cbc:SourceCurrencyCode", currency)}${tag("cbc:TargetCurrencyCode", "TRY")}${tag("cbc:CalculationRate", doc.rate)}${tag("cbc:Date", doc.issueDate)}</cac:PricingExchangeRate>` : "";
  const vatTotal = taxTotal.reduce((sum, item) => sum + item.vat, 0);
  const minor = value => value / 100;
  const stoppageSubtotal = (taxable, stoppage) =>
    `<cac:TaxSubtotal>${money("cbc:TaxableAmount", taxable, currency)}${money("cbc:TaxAmount", stoppage, currency)}${tag("cbc:CalculationSequenceNumeric", 1)}${tag("cbc:Percent", doc.stoppageRate)}<cac:TaxCategory><cac:TaxScheme>${tag("cbc:Name", STOPPAGE_TAX.name)}${tag("cbc:TaxTypeCode", STOPPAGE_TAX.code)}</cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`;
  const vatSubtotal = (taxable, vat, rate, exemptionCode) =>
    `<cac:TaxSubtotal>${money("cbc:TaxableAmount", taxable, currency)}${money("cbc:TaxAmount", vat, currency)}${tag("cbc:CalculationSequenceNumeric", 2)}${tag("cbc:Percent", rate)}${taxCategory(rate, exemptionCode, exemptionLabel(exemptionCode), variant, ESMM_VAT_NAME)}</cac:TaxSubtotal>`;
  // Stopaj oranı 0 (kişi alıcı: stopaj kesilmez) ise 0003 satırı yazılmaz.
  const withStoppage = esmm && (Number(doc.stoppageRate) > 0 || smm.stoppage > 0);
  const tax = esmm
    ? `<cac:TaxTotal>${money("cbc:TaxAmount", minor(smm.vat), currency)}${withStoppage ? stoppageSubtotal(minor(smm.gross), minor(smm.stoppage)) : ""}${taxTotal.map(item => vatSubtotal(item.net, item.vat, item.rate, item.exemptionCode)).join("")}</cac:TaxTotal>`
    : `<cac:TaxTotal>${money("cbc:TaxAmount", vatTotal, currency)}${taxTotal
    .map(item => `<cac:TaxSubtotal>${money("cbc:TaxableAmount", item.net, currency)}${money("cbc:TaxAmount", item.vat, currency)}${variant === "peppol" ? "" : tag("cbc:Percent", item.rate)}${taxCategory(item.rate, item.exemptionCode, exemptionLabel(item.exemptionCode), variant)}</cac:TaxSubtotal>`)
    .join("")}</cac:TaxTotal>`;
  const withholding =
    byWithholding.size && variant !== "peppol"
      ? `<cac:WithholdingTaxTotal>${money("cbc:TaxAmount", [...byWithholding.values()].reduce((sum, item) => sum + item.withheld, 0), currency)}${[...byWithholding.values()]
          .map(item => `<cac:TaxSubtotal>${money("cbc:TaxableAmount", item.vat, currency)}${money("cbc:TaxAmount", item.withheld, currency)}${tag("cbc:Percent", percent(item.num, item.den))}<cac:TaxCategory><cac:TaxScheme>${tag("cbc:Name", "KDV TEVKİFAT")}${tag("cbc:TaxTypeCode", item.code)}</cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`)
          .join("")}</cac:WithholdingTaxTotal>`
      : "";
  const gross = lineExtension + vatTotal;
  const totals = esmm
    ? `<cac:LegalMonetaryTotal>${money("cbc:LineExtensionAmount", minor(smm.gross), currency)}${money("cbc:TaxExclusiveAmount", minor(smm.netFee), currency)}${money("cbc:TaxInclusiveAmount", minor(smm.collectedVat), currency)}${discountTotal > 0 ? money("cbc:AllowanceTotalAmount", discountTotal, currency) : ""}${money("cbc:PayableAmount", minor(smm.payable), currency)}</cac:LegalMonetaryTotal>`
    : `<cac:LegalMonetaryTotal>${money("cbc:LineExtensionAmount", lineExtension, currency)}${money("cbc:TaxExclusiveAmount", lineExtension, currency)}${money("cbc:TaxInclusiveAmount", gross, currency)}${discountTotal > 0 && variant !== "peppol" ? money("cbc:AllowanceTotalAmount", discountTotal, currency) : ""}${money("cbc:PayableAmount", variant === "peppol" ? gross : doc.payableTotal, currency)}</cac:LegalMonetaryTotal>`;
  const invoiceLines = lines
    .map((line, index) => {
      const price = netUnitPrice(line, includeVat);
      const discount = discountNet(line, includeVat);
      const lineWithholding =
        line.withholdingCode && variant !== "peppol"
          ? `<cac:WithholdingTaxTotal>${money("cbc:TaxAmount", line.withheld, currency)}<cac:TaxSubtotal>${money("cbc:TaxableAmount", line.vat, currency)}${money("cbc:TaxAmount", line.withheld, currency)}${tag("cbc:Percent", percent(line.withholdingNum, line.withholdingDen))}<cac:TaxCategory><cac:TaxScheme>${tag("cbc:Name", "KDV TEVKİFAT")}${tag("cbc:TaxTypeCode", line.withholdingCode)}</cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:WithholdingTaxTotal>`
          : "";
      if (esmm) {
        // e-SMM kalemi (EDM düzeni): miktar alanı Net Ücret, fiyat alanı Net Tahsilat taşır; programdaki miktar × birim ücret 1'den farklıysa
        // kalem notunda kalır (resmî makbuzda kaybolmasın).
        const share = smm.shares[index];
        const lineNet = cents(line.net);
        const netFee = lineNet - share;
        const collected = cents(line.vat) - cents(line.withheld);
        const qty = Number(line.qty) || 0;
        const quantityNote = qty !== 1 ? `Miktar: ${String(qty).replace(".", ",")} ${String(line.unit || "Adet").trim()} × ${priceText(line.unitPrice).replace(".", ",")} ${currency}` : "";
        return [
          "<cac:InvoiceLine>",
          tag("cbc:ID", index + 1),
          tag("cbc:Note", line.description),
          tag("cbc:Note", quantityNote),
          `<cbc:InvoicedQuantity unitCode="NIU">${amount(minor(netFee))}</cbc:InvoicedQuantity>`,
          money("cbc:LineExtensionAmount", line.net, currency),
          discount > 0 ? `<cac:AllowanceCharge>${tag("cbc:ChargeIndicator", "false")}${tag("cbc:MultiplierFactorNumeric", (Math.round((discount / ((Number(line.net) || 0) + discount || 1)) * 10000) / 10000).toString())}${money("cbc:Amount", discount, currency)}${money("cbc:BaseAmount", (Number(line.net) || 0) + discount, currency)}</cac:AllowanceCharge>` : "",
          `<cac:TaxTotal>${money("cbc:TaxAmount", line.vat, currency)}${withStoppage ? stoppageSubtotal(line.net, minor(share)) : ""}${vatSubtotal(line.net, line.vat, line.vatRate, line.exemptionCode)}</cac:TaxTotal>`,
          lineWithholding,
          `<cac:Item>${tag("cbc:Name", line.name)}${line.code ? `<cac:SellersItemIdentification>${tag("cbc:ID", line.code)}</cac:SellersItemIdentification>` : ""}</cac:Item>`,
          `<cac:Price>${money("cbc:PriceAmount", minor(netFee + collected), currency)}</cac:Price>`,
          "</cac:InvoiceLine>",
        ].join("");
      }
      return [
        "<cac:InvoiceLine>",
        tag("cbc:ID", index + 1),
        variant === "peppol" ? "" : tag("cbc:Note", line.description),
        variant === "peppol" ? "" : tag("cbc:Note", unitNote(line.unit)),
        `<cbc:InvoicedQuantity unitCode="${unitCode(line.unit)}">${escape(line.qty)}</cbc:InvoicedQuantity>`,
        money("cbc:LineExtensionAmount", line.net, currency),
        discount > 0 ? `<cac:AllowanceCharge>${tag("cbc:ChargeIndicator", "false")}${variant === "peppol" ? tag("cbc:AllowanceChargeReason", "İskonto") : tag("cbc:MultiplierFactorNumeric", (Math.round((discount / ((Number(line.net) || 0) + discount || 1)) * 10000) / 10000).toString())}${money("cbc:Amount", discount, currency)}${money("cbc:BaseAmount", (Number(line.net) || 0) + discount, currency)}</cac:AllowanceCharge>` : "",
        variant === "peppol" ? "" : `<cac:TaxTotal>${money("cbc:TaxAmount", line.vat, currency)}<cac:TaxSubtotal>${money("cbc:TaxableAmount", line.net, currency)}${money("cbc:TaxAmount", line.vat, currency)}${tag("cbc:Percent", line.vatRate)}${taxCategory(line.vatRate, line.exemptionCode, exemptionLabel(line.exemptionCode), variant)}</cac:TaxSubtotal></cac:TaxTotal>`,
        lineWithholding,
        `<cac:Item>${variant === "peppol" ? tag("cbc:Description", line.description) : ""}${tag("cbc:Name", line.name)}${line.code ? `<cac:SellersItemIdentification>${tag("cbc:ID", line.code)}</cac:SellersItemIdentification>` : ""}${variant !== "peppol" && (line.serialNo || line.lotNo) ? `<cac:ItemInstance>${tag("cbc:SerialID", line.serialNo)}${line.lotNo ? `<cac:LotIdentification>${tag("cbc:LotNumberID", line.lotNo)}</cac:LotIdentification>` : ""}</cac:ItemInstance>` : ""}${variant === "peppol" ? taxCategory(line.vatRate, line.exemptionCode, exemptionLabel(line.exemptionCode), "peppol").replace("cac:TaxCategory", "cac:ClassifiedTaxCategory").replace("</cac:TaxCategory>", "</cac:ClassifiedTaxCategory>") : ""}</cac:Item>`,
        `<cac:Price><cbc:PriceAmount currencyID="${escape(currency)}">${priceText(price)}</cbc:PriceAmount></cac:Price>`,
        "</cac:InvoiceLine>",
      ].join("");
    })
    .join("");
  const body = [
    ...head,
    ...references,
    `<cac:AccountingSupplierParty>${party(seller || {}, { variant, esmm, issuer: true })}</cac:AccountingSupplierParty>`,
    `<cac:AccountingCustomerParty>${party(buyer || {}, { variant, esmm })}</cac:AccountingCustomerParty>`,
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
