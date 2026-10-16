// e-Belge karekodu (kullanıcı isteği 16.10.2026; ZORUNLU alan): GİB "Karekod Standardı Kılavuzu" V.1.2 (Kasım 2023; ebelge.gib.gov.tr, sha256
// 0db9831a…). 509 Sıra No.lu VUK Genel Tebliği karekodu e-Fatura ve e-Arşiv faturada "bulunması gereken bilgi" sayar; karekod belgenin SAĞ ÜST
// köşesinde yer alır ve okutulduğunda kılavuzdaki JSON'u verir.
//
// İçerik belgenin KENDİ XML'inden okunur (programın başka bir hesabından değil): karekodda ne yazıyorsa belgede de o yazar. Alanlar (kılavuz §2.1
// e-Fatura, §2.2 e-Arşiv; sıra kılavuzdaki örnekle aynı): vkntckn, avkntckn, senaryo, tip, tarih, no, ettn, parabirimi, malhizmettoplam,
// kdvmatrah(oran) / hesaplanankdv(oran) (her KDV oranı için), vergidahil, odenecek. Kılavuzun e-Arşiv bölümünde "hesaplanankdv (8)" boşluklu
// yazılmış; e-Fatura bölümünde ve aynı tablodaki "kdvmatrah(8)"de boşluk yok — yazım hatası sayılıp tek biçim (boşluksuz) kullanılır.
import { qrSvg } from "../qr.mjs";
import { child, children, find, parseXml, textOf } from "./xml-lite.mjs";

const partyId = party => {
  const ids = children(find(party, "Party"), "PartyIdentification").map(node => child(node, "ID"));
  const id = ids.find(node => ["VKN", "TCKN"].includes(String(node?.attrs?.schemeID || "").toUpperCase()));
  return textOf(id);
};

/** UBL-TR fatura XML'inden karekod içeriği (sıralı nesne). e-Belge değilse (ProfileID yoksa) null. */
export function karekodData(xml) {
  const invoice = child(parseXml(xml), "Invoice");
  const profile = textOf(child(invoice, "ProfileID"));
  if (!invoice || !profile) return null;
  const total = child(invoice, "LegalMonetaryTotal");
  const data = {
    vkntckn: partyId(child(invoice, "AccountingSupplierParty")),
    avkntckn: partyId(child(invoice, "AccountingCustomerParty")),
    senaryo: profile,
    tip: textOf(child(invoice, "InvoiceTypeCode")),
    tarih: textOf(child(invoice, "IssueDate")),
    no: textOf(child(invoice, "ID")),
    ettn: textOf(child(invoice, "UUID")),
    parabirimi: textOf(child(invoice, "DocumentCurrencyCode")),
    malhizmettoplam: textOf(child(total, "LineExtensionAmount")),
  };
  // Belge düzeyindeki KDV (vergi kodu 0015) alt toplamları, oran sırasıyla (tevkifat ayrı bölümdedir, karekoda girmez).
  for (const subtotal of children(child(invoice, "TaxTotal"), "TaxSubtotal")) {
    const code = textOf(find(subtotal, "TaxCategory/TaxScheme/TaxTypeCode"));
    if (code && code !== "0015") continue;
    const rate = textOf(child(subtotal, "Percent"));
    data[`kdvmatrah(${rate})`] = textOf(child(subtotal, "TaxableAmount"));
    data[`hesaplanankdv(${rate})`] = textOf(child(subtotal, "TaxAmount"));
  }
  data.vergidahil = textOf(child(total, "TaxInclusiveAmount"));
  data.odenecek = textOf(child(total, "PayableAmount"));
  return data;
}

/** Karekod metni (JSON) ve SVG görseli (data URL); e-Belge değilse null. */
export function karekodOf(xml) {
  const data = karekodData(xml);
  if (!data) return null;
  const text = JSON.stringify(data);
  const svg = qrSvg(text);
  return { data, text, svg, dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}` };
}
