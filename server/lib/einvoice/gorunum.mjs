// e-Belge görünüm tasarımı (kullanıcı kararı 16.10.2026: "önerini yap" — Wolvox "e-Fatura Script" karşılığı). e-Fatura / e-Arşiv
// faturanın alıcının ve GİB'in gördüğü sayfası, belgenin İÇİNE gömülen bir XSLT şablonuyla çizilir (GİB örnek faturalarındaki gibi:
// cac:AdditionalDocumentReference → cac:Attachment → cbc:EmbeddedDocumentBinaryObject, filename "<fatura no>.xslt"). Şablon yoksa
// entegratörün (EDM) varsayılan görünümü kullanılır — firma logosu ve banka hesapları görünmez.
//
// Şablon kodu bu programındır (dış kaynaklı şablon kopyalanmadı). XSLT 1.0: GİB/entegratör görüntüleyicileri, .NET XslCompiledTransform ve
// tarayıcılar (Entegratör Ayarları → Görünüm → Önizle) aynı şablonu işler. Firmaya özel içerik (logo, banka hesapları, alt not) şablona
// gömülür; geri kalan her şey faturanın kendi XML'inden okunur — ekranda görünen sayı belgedeki sayıdır.
import { createHash } from "node:crypto";
import { GIB_LOGO } from "./gib-logo.mjs";

const xml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

export const DEFAULT_VIEW = Object.freeze({ enabled: true, logo: true, banks: true, footer: true, stamp: true, stampEfatura: false });

// UN/ECE Rec. 20 birim kodu → görünen ad (ubl-tr.mjs UNIT_CODES'un tersi; yazım düzeni: her sözcüğün ilk harfi büyük).
const UNIT_NAMES = {
  C62: "Adet", KGM: "Kg", GRM: "Gr", TNE: "Ton", LTR: "Lt", MLT: "Ml", MTR: "M", CMT: "Cm", MMT: "Mm", MTK: "M²", MTQ: "M³", PA: "Paket", BX: "Kutu", CT: "Koli",
  PR: "Çift", SET: "Takım", HUR: "Saat", DAY: "Gün", MON: "Ay", ANN: "Yıl", MIN: "Dakika", WEE: "Hafta", RO: "Rulo", BO: "Şişe", BG: "Torba", SA: "Çuval",
};
const PROFILES = { TEMELFATURA: "Temel Fatura", TICARIFATURA: "Ticari Fatura", EARSIVFATURA: "e-Arşiv Fatura", IHRACAT: "İhracat", YOLCUBERABERFATURA: "Yolcu Beraber Fatura" };
const TYPES = { SATIS: "Satış", IADE: "İade", TEVKIFAT: "Tevkifat", ISTISNA: "İstisna", OZELMATRAH: "Özel Matrah", IHRACKAYITLI: "İhraç Kayıtlı", SGK: "SGK", KOMISYONCU: "Komisyoncu" };
// Ödeme şekli kodu (GİB PaymentMeansCodeTypeList = UN/ECE 4461; ubl-tr.mjs PAYMENT_MEANS_CODES) → görünen ad. Listede olmayan kod (1 = belirtilmemiş) basılmaz.
const PAYMENT_NAMES = { 10: "Nakit", 20: "Çek", 42: "Havale / EFT", 48: "Kredi Kartı", 60: "Senet" };
const choose = (select, map, fallback = `<xsl:value-of select="${select}"/>`) =>
  `<xsl:choose>${Object.entries(map)
    .map(([key, label]) => `<xsl:when test="${select}='${key}'">${xml(label)}</xsl:when>`)
    .join("")}<xsl:otherwise>${fallback}</xsl:otherwise></xsl:choose>`;

/**
 * Faturanın görünüm şablonu (XSLT 1.0 metni).
 * @param {{ logo?: string, banks?: {name: string, iban: string}[], footer?: string, view?: typeof DEFAULT_VIEW }} options
 *   logo: data:image/jpeg;base64,… (Fatura Ayarları'ndaki logo; sunucu JPEG ve boyutunu denetler), banks: belgedeki banka hesapları,
 *   footer: Fatura Ayarları → Fatura Alt Notu.
 */
// test: entegratörün test ortamına giden belge (seri TEF / TEA / TES) — sayfanın üstünde kırmızı "TEST ORTAMI" şeridi.
// qr: belgenin karekodu (karekod.mjs dataUrl; GİB Karekod Standardı — sağ üst köşe, zorunlu). GİB logosu "e-FATURA" başlığının üstünde.
// Düzen (kullanıcı isteği 16.10.2026, örnek e-Arşiv tasarımı): sol satıcı ve alıcı; ORTADA alt alta firma logosu, GİB logosu, başlık, kaşe / imza;
// sağ üstte karekod ve bilgi tablosu. e-Fatura ve e-Arşiv aynı düzende.
// stamp: kaşe / imza görseli (JPEG) — GİB logosu ve başlığın altında; varsayılan yalnız e-Arşivde (view.stampEfatura ile e-Faturada da).
export function viewXslt({ logo = "", banks = [], footer = "", view = DEFAULT_VIEW, test = false, qr = "", stamp = "" } = {}) {
  const showStamp = view.stamp !== false && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(stamp);
  const showLogo = view.logo !== false && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(logo);
  const bankRows = view.banks !== false ? banks.filter(bank => bank?.iban) : [];
  const footerText = view.footer !== false ? String(footer || "").trim() : "";
  const money = path => `<xsl:value-of select="format-number(number(${path}), '###.##0,00', 'tr')"/>&#160;<xsl:call-template name="currency"><xsl:with-param name="code" select="${path}/@currencyID"/></xsl:call-template>`;
  const date = path => `<xsl:call-template name="date"><xsl:with-param name="value" select="${path}"/></xsl:call-template>`;
  const row = (label, body, test = "") => (test ? `<xsl:if test="${test}"><tr><th>${xml(label)}</th><td>${body}</td></tr></xsl:if>` : `<tr><th>${xml(label)}</th><td>${body}</td></tr>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:n1="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  exclude-result-prefixes="n1 cac cbc">
<xsl:output method="html" encoding="UTF-8" indent="no"/>
<!-- Entegratörün PDF çizicisi (EDM: IronPdf/Chromium) çıktıyı DOCTYPE'sız, uyumluluk kipinde açar; o kipte tablolar yazı boyunu devralmaz
     (EDM test ortamı 16.10.2026: adres satırları addan büyük çıktı) — table{font-size:inherit} bunu giderir. -->
<xsl:decimal-format name="tr" decimal-separator="," grouping-separator="."/>
<xsl:template name="currency"><xsl:param name="code"/><xsl:choose><xsl:when test="$code='TRY' or $code='TRL' or $code=''">TL</xsl:when><xsl:otherwise><xsl:value-of select="$code"/></xsl:otherwise></xsl:choose></xsl:template>
<xsl:template name="date"><xsl:param name="value"/><xsl:if test="string-length($value) &gt;= 10"><xsl:value-of select="concat(substring($value,9,2),'.',substring($value,6,2),'.',substring($value,1,4))"/></xsl:if></xsl:template>
<xsl:template name="unit"><xsl:param name="code"/>${choose("$code", UNIT_NAMES, '<xsl:value-of select="$code"/>')}</xsl:template>
<xsl:template name="party"><xsl:param name="p"/>
  <xsl:choose>
    <xsl:when test="$p/cac:PartyName/cbc:Name and $p/cac:Person"><div class="ad"><xsl:value-of select="$p/cac:PartyName/cbc:Name"/></div><div><xsl:value-of select="concat($p/cac:Person/cbc:FirstName,' ',$p/cac:Person/cbc:FamilyName)"/></div></xsl:when>
    <xsl:when test="$p/cac:PartyName/cbc:Name"><div class="ad"><xsl:value-of select="$p/cac:PartyName/cbc:Name"/></div></xsl:when>
    <xsl:otherwise><div class="ad"><xsl:value-of select="concat($p/cac:Person/cbc:FirstName,' ',$p/cac:Person/cbc:FamilyName)"/></div></xsl:otherwise>
  </xsl:choose>
  <div><xsl:value-of select="$p/cac:PostalAddress/cbc:StreetName"/></div>
  <div><xsl:if test="$p/cac:PostalAddress/cbc:PostalZone"><xsl:value-of select="$p/cac:PostalAddress/cbc:PostalZone"/>&#160;</xsl:if><xsl:value-of select="$p/cac:PostalAddress/cbc:CitySubdivisionName"/> / <xsl:value-of select="$p/cac:PostalAddress/cbc:CityName"/></div>
  <xsl:if test="$p/cac:Contact/cbc:Telephone"><div>Tel: <xsl:value-of select="$p/cac:Contact/cbc:Telephone"/></div></xsl:if>
  <xsl:if test="$p/cac:Contact/cbc:ElectronicMail"><div>E-Posta: <xsl:value-of select="$p/cac:Contact/cbc:ElectronicMail"/></div></xsl:if>
  <xsl:if test="$p/cbc:WebsiteURI"><div>Web Sitesi: <xsl:value-of select="$p/cbc:WebsiteURI"/></div></xsl:if>
  <div>Vergi Dairesi: <xsl:value-of select="$p/cac:PartyTaxScheme/cac:TaxScheme/cbc:Name"/></div>
  <xsl:for-each select="$p/cac:PartyIdentification/cbc:ID"><div><xsl:choose><xsl:when test="@schemeID='MERSISNO'">MERSİS No</xsl:when><xsl:when test="@schemeID='TICARETSICILNO'">Ticaret Sicil No</xsl:when><xsl:otherwise><xsl:value-of select="@schemeID"/></xsl:otherwise></xsl:choose>: <xsl:value-of select="."/></div></xsl:for-each>
</xsl:template>
<xsl:template match="/">
<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/><title><xsl:value-of select="n1:Invoice/cbc:ID"/></title>
<style type="text/css">
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1d2622;margin:0;background:#fff}
.sayfa{max-width:800px;margin:12px auto;padding:0 8px}
table{border-collapse:collapse;font-size:inherit}
.ust{width:100%}.ust td{vertical-align:top}
.logo{margin-bottom:6px}.logo img{max-width:180px;max-height:80px}
.ad{font-weight:bold;font-size:12px}
.baslik{text-align:center;font-size:20px;font-weight:bold;letter-spacing:1px;color:#1f5f4a;padding-top:4px}
.bilgi{border:1px solid #9aa8a2;margin-left:auto}.bilgi th,.bilgi td{border:1px solid #9aa8a2;padding:3px 6px;text-align:left}.bilgi th{background:#eef3f0;white-space:nowrap}
.alici{margin:14px 0;border-top:1px solid #1f5f4a;border-bottom:1px solid #1f5f4a;padding:6px 0}
.ettn{margin:6px 0 10px}
.kalem{width:100%}.kalem th,.kalem td{border:1px solid #9aa8a2;padding:3px 5px}.kalem th{background:#eef3f0;text-align:center}.kalem td.s{text-align:right;white-space:nowrap}
.kalem .aciklama{color:#55615b;font-size:10px}
.toplam{margin-left:auto;margin-top:8px}.toplam th,.toplam td{border:1px solid #9aa8a2;padding:3px 6px}.toplam th{text-align:right;background:#eef3f0}.toplam td{text-align:right;white-space:nowrap;min-width:110px}
.odenecek th,.odenecek td{font-weight:bold;font-size:12px}
.notlar{margin-top:10px;border:1px solid #9aa8a2;padding:6px}
.bankalar{margin-top:10px}.bankalar th,.bankalar td{border:1px solid #9aa8a2;padding:3px 6px;text-align:left}.bankalar th{background:#eef3f0}
.alt{margin-top:10px;color:#55615b;white-space:pre-line}
.karekod{text-align:right;margin-bottom:4px}.karekod img{width:120px;height:120px}.gib img{width:80px;height:80px}.kase{margin-top:6px}.kase img{max-width:170px;max-height:90px}
.test{border:2px solid #b42318;color:#b42318;font-weight:bold;text-align:center;padding:6px;margin-bottom:10px}
</style></head>
<body><div class="sayfa">${test ? '<div class="test">TEST ORTAMI — Bu belge deneme amaçlıdır; yasal geçerliliği yoktur.</div>' : ""}<xsl:for-each select="n1:Invoice">
<table class="ust"><tr>
  <td style="width:38%"><xsl:call-template name="party"><xsl:with-param name="p" select="cac:AccountingSupplierParty/cac:Party"/></xsl:call-template></td>
  <td style="width:24%" class="baslik">${showLogo ? `<div class="logo"><img alt="" src="${xml(logo)}"/></div>` : ""}<div class="gib"><img alt="GİB" src="${GIB_LOGO}"/></div><xsl:choose><xsl:when test="cbc:ProfileID='EARSIVFATURA'">e-Arşiv Fatura</xsl:when><xsl:otherwise>e-FATURA</xsl:otherwise></xsl:choose>${showStamp ? `<xsl:if test="${view.stampEfatura === true ? "true()" : "cbc:ProfileID='EARSIVFATURA'"}"><div class="kase"><img alt="Kaşe / İmza" src="${xml(stamp)}"/></div></xsl:if>` : ""}</td>
  <td style="width:38%">${/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(qr) ? `<div class="karekod"><img alt="Karekod" src="${qr}"/></div>` : ""}<table class="bilgi">
    ${row("Özelleştirme No", '<xsl:value-of select="cbc:CustomizationID"/>')}
    ${row("Senaryo", choose("cbc:ProfileID", PROFILES))}
    ${row("Fatura Tipi", choose("cbc:InvoiceTypeCode", TYPES))}
    ${row("Fatura No", '<xsl:value-of select="cbc:ID"/>')}
    ${row("Fatura Tarihi", `${date("cbc:IssueDate")}<xsl:if test="cbc:IssueTime">&#160;<xsl:value-of select="substring(cbc:IssueTime,1,5)"/></xsl:if>`)}
    ${row("İrsaliye No", '<xsl:value-of select="cac:DespatchDocumentReference/cbc:ID"/>', "cac:DespatchDocumentReference")}
    ${row("İrsaliye Tarihi", date("cac:DespatchDocumentReference/cbc:IssueDate"), "cac:DespatchDocumentReference/cbc:IssueDate")}
    ${row("Sipariş No", '<xsl:value-of select="cac:OrderReference/cbc:ID"/>', "cac:OrderReference")}
    ${row("Sipariş Tarihi", date("cac:OrderReference/cbc:IssueDate"), "cac:OrderReference/cbc:IssueDate")}
    ${row("İade Edilen Fatura", `<xsl:value-of select="cac:BillingReference/cac:InvoiceDocumentReference/cbc:ID"/>&#160;${date("cac:BillingReference/cac:InvoiceDocumentReference/cbc:IssueDate")}`, "cac:BillingReference/cac:InvoiceDocumentReference")}
    ${row("Son Ödeme Tarihi", date("cac:PaymentMeans[cbc:PaymentDueDate != ../cbc:IssueDate][1]/cbc:PaymentDueDate"), "cac:PaymentMeans[cbc:PaymentDueDate != ../cbc:IssueDate]")}
    ${row("Ödeme Şekli", `<xsl:for-each select="cac:PaymentMeans[${Object.keys(PAYMENT_NAMES).map(code => `cbc:PaymentMeansCode='${code}'`).join(" or ")}]"><xsl:if test="position() > 1">, </xsl:if>${choose("cbc:PaymentMeansCode", PAYMENT_NAMES)}</xsl:for-each>`, Object.keys(PAYMENT_NAMES).map(code => `cac:PaymentMeans/cbc:PaymentMeansCode='${code}'`).join(" or "))}
    ${row("Gönderim Şekli", '<xsl:choose><xsl:when test="cac:AdditionalDocumentReference[cbc:DocumentTypeCode=\'SendingType\']/cbc:DocumentType=\'ELEKTRONIK\'">Elektronik</xsl:when><xsl:otherwise>Kâğıt</xsl:otherwise></xsl:choose>', "cbc:ProfileID='EARSIVFATURA'")}
  </table></td>
</tr></table>
<div class="alici"><div><b>SAYIN</b></div><xsl:call-template name="party"><xsl:with-param name="p" select="cac:AccountingCustomerParty/cac:Party"/></xsl:call-template></div>
<div class="ettn"><b>ETTN:</b>&#160;<xsl:value-of select="cbc:UUID"/></div>
<table class="kalem"><tr><th>Sıra No</th><th>Mal Hizmet</th><th>Miktar</th><th>Birim Fiyat</th><th>İskonto Oranı</th><th>İskonto Tutarı</th><th>KDV Oranı</th><th>KDV Tutarı</th><th>Diğer Vergiler</th><th>Mal Hizmet Tutarı</th></tr>
<xsl:for-each select="cac:InvoiceLine"><tr>
  <td class="s"><xsl:value-of select="cbc:ID"/></td>
  <td><xsl:value-of select="cac:Item/cbc:Name"/><xsl:if test="cac:Item/cac:SellersItemIdentification/cbc:ID"> (<xsl:value-of select="cac:Item/cac:SellersItemIdentification/cbc:ID"/>)</xsl:if><xsl:if test="cbc:Note"><div class="aciklama"><xsl:value-of select="cbc:Note"/></div></xsl:if><xsl:for-each select="cac:Item/cac:ItemInstance"><div class="aciklama"><xsl:if test="cbc:SerialID">Seri No: <xsl:value-of select="cbc:SerialID"/></xsl:if><xsl:if test="cbc:SerialID and cac:LotIdentification/cbc:LotNumberID"> · </xsl:if><xsl:if test="cac:LotIdentification/cbc:LotNumberID">Lot No: <xsl:value-of select="cac:LotIdentification/cbc:LotNumberID"/></xsl:if></div></xsl:for-each></td>
  <td class="s"><xsl:value-of select="format-number(number(cbc:InvoicedQuantity), '###.##0,####', 'tr')"/>&#160;<xsl:call-template name="unit"><xsl:with-param name="code" select="cbc:InvoicedQuantity/@unitCode"/></xsl:call-template></td>
  <td class="s"><xsl:value-of select="format-number(number(cac:Price/cbc:PriceAmount), '###.##0,00##', 'tr')"/>&#160;<xsl:call-template name="currency"><xsl:with-param name="code" select="cac:Price/cbc:PriceAmount/@currencyID"/></xsl:call-template></td>
  <td class="s"><xsl:if test="cac:AllowanceCharge/cbc:MultiplierFactorNumeric">%<xsl:value-of select="format-number(number(cac:AllowanceCharge/cbc:MultiplierFactorNumeric * 100), '##0,##', 'tr')"/></xsl:if></td>
  <td class="s"><xsl:if test="cac:AllowanceCharge/cbc:Amount">${money("cac:AllowanceCharge/cbc:Amount")}</xsl:if></td>
  <td class="s">%<xsl:value-of select="format-number(number(cac:TaxTotal/cac:TaxSubtotal/cbc:Percent), '##0,##', 'tr')"/></td>
  <td class="s">${money("cac:TaxTotal/cbc:TaxAmount")}</td>
  <td><xsl:for-each select="cac:WithholdingTaxTotal/cac:TaxSubtotal">KDV Tevkifatı (%<xsl:value-of select="cbc:Percent"/>) <xsl:value-of select="format-number(number(cbc:TaxAmount), '###.##0,00', 'tr')"/></xsl:for-each><xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory[cbc:TaxExemptionReasonCode]"><div class="aciklama">İstisna <xsl:value-of select="cbc:TaxExemptionReasonCode"/>: <xsl:value-of select="cbc:TaxExemptionReason"/></div></xsl:for-each></td>
  <td class="s">${money("cbc:LineExtensionAmount")}</td>
</tr></xsl:for-each></table>
<table class="toplam">
  <tr><th>Mal Hizmet Toplam Tutarı</th><td>${money("cac:LegalMonetaryTotal/cbc:LineExtensionAmount")}</td></tr>
  <xsl:if test="cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount"><tr><th>Toplam İskonto</th><td>${money("cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount")}</td></tr></xsl:if>
  <xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal"><tr><th>KDV Matrahı (%<xsl:value-of select="cbc:Percent"/>)</th><td>${money("cbc:TaxableAmount")}</td></tr><tr><th>Hesaplanan KDV (%<xsl:value-of select="cbc:Percent"/>)</th><td>${money("cbc:TaxAmount")}</td></tr></xsl:for-each>
  <xsl:for-each select="cac:WithholdingTaxTotal/cac:TaxSubtotal"><tr><th>Hesaplanan KDV Tevkifatı (%<xsl:value-of select="cbc:Percent"/>)</th><td>${money("cbc:TaxAmount")}</td></tr></xsl:for-each>
  <tr><th>Vergiler Dahil Toplam Tutar</th><td>${money("cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount")}</td></tr>
  <tr class="odenecek"><th>Ödenecek Tutar</th><td>${money("cac:LegalMonetaryTotal/cbc:PayableAmount")}</td></tr>
  <xsl:if test="cac:PricingExchangeRate/cbc:CalculationRate"><tr><th>Döviz Kuru</th><td><xsl:value-of select="format-number(number(cac:PricingExchangeRate/cbc:CalculationRate), '###.##0,0000', 'tr')"/></td></tr><tr class="odenecek"><th>Ödenecek Tutar (TL)</th><td><xsl:value-of select="format-number(number(cac:LegalMonetaryTotal/cbc:PayableAmount * cac:PricingExchangeRate/cbc:CalculationRate), '###.##0,00', 'tr')"/>&#160;TL</td></tr></xsl:if>
</table>
<xsl:if test="cbc:Note"><div class="notlar"><xsl:for-each select="cbc:Note"><div><xsl:value-of select="."/></div></xsl:for-each></div></xsl:if>
<xsl:if test="cbc:ProfileID='EARSIVFATURA' and cac:AdditionalDocumentReference[cbc:DocumentTypeCode='SendingType']/cbc:DocumentType='ELEKTRONIK'"><div class="notlar">e-Arşiv izni kapsamında elektronik ortamda iletilmiştir.</div></xsl:if>
${bankRows.length ? `<table class="bankalar"><tr><th>Banka</th><th>IBAN</th></tr>${bankRows.map(bank => `<tr><td>${xml(bank.name)}</td><td>${xml(String(bank.iban).replace(/(.{4})/g, "$1 ").trim())}</td></tr>`).join("")}</table>` : ""}
${footerText ? `<div class="alt">${xml(footerText)}</div>` : ""}
</xsl:for-each></div></body></html>
</xsl:template>
</xsl:stylesheet>
`;
}

/** Şablonun belgeye gömülen hâli (GİB örnek faturalarındaki biçim). Kimlik belgeden türetilir: aynı fatura her üretimde aynı XML. */
export function viewReference({ number, issueDate, ettn, xslt }) {
  const hex = createHash("sha256").update(`${ettn || number}:gorunum`).digest("hex");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  const file = `${String(number || "fatura").replace(/[^A-Za-z0-9_-]/g, "")}.xslt`;
  return `<cac:AdditionalDocumentReference><cbc:ID>${id}</cbc:ID><cbc:IssueDate>${xml(issueDate)}</cbc:IssueDate><cac:Attachment><cbc:EmbeddedDocumentBinaryObject characterSetCode="UTF-8" encodingCode="Base64" filename="${xml(file)}" mimeCode="application/xml">${Buffer.from(xslt, "utf8").toString("base64")}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>`;
}
