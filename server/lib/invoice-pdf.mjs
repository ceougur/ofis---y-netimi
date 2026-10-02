// Fatura PDF'i (v2.0.15): kâğıt fatura, e-Arşiv / e-Fatura görseli, serbest meslek makbuzu ve proforma (taslak).
// Tek PDF'te birden çok fatura olabilir (toplu yazdırma). Bağımlılıksız PDF yazıcı (pdf-write.mjs) ve programın yazı tipi.
// Sayfaya sığmayan kalemler sonraki sayfaya taşar; başlık her sayfada tekrarlanır, toplamlar son sayfadadır.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { A4, PdfDocument, loadFont } from "./pdf-write.mjs";

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");
let fonts = null;
const loadFonts = () => {
  fonts ||= { regular: loadFont(join(FONT_DIR, "LiberationSans-Regular.ttf")), bold: loadFont(join(FONT_DIR, "LiberationSans-Bold.ttf")) };
  return fonts;
};
const numberFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const priceFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const qtyFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const unitOf = currency => (currency && currency !== "TRY" ? currency : "TL");
const money = (value, currency) => `${numberFormat.format(Number(value) || 0)} ${unitOf(currency)}`;
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const METHOD = { cash: "Nakit", bank: "Havale / EFT", card: "POS / Kredi Kartı" };
// v2.0.16: kart yolu yöne göre (satış tarafında tahsilat → POS; alışta ödeme → Kredi Kartı).
const METHOD_IN = { ...METHOD, card: "POS" };
const METHOD_OUT = { ...METHOD, card: "Kredi Kartı" };

// Kâğıt (e-Belge olmayan) belge programdan yazdırıldığında yasal fatura değildir (fatura ancak maliyeyle anlaşmalı
// matbaanın basılı formuna ya da e-Belge olarak düzenlenir): başlık "Müşteri Fişi" ve altta "resmî fatura yerine
// geçmez" yazar. e-Belge bağlantısı açılınca e-Fatura / e-Arşiv görseli kendi başlığıyla basılır.
const isFormal = doc => ["EARSIVFATURA", "TEMELFATURA", "TICARIFATURA", "ESMM"].includes(doc.profile);
const titleOf = doc => {
  if (doc.status === "draft") return "PROFORMA";
  if (!isFormal(doc)) return { sale: "MÜŞTERİ FİŞİ", smm: "MÜŞTERİ FİŞİ (SERBEST MESLEK)", sale_return: "İADE FİŞİ", purchase: "ALIŞ KAYDI", purchase_return: "İADE FİŞİ (ALIŞTAN)" }[doc.kind] || "MÜŞTERİ FİŞİ";
  if (doc.kind === "smm") return "e-SERBEST MESLEK MAKBUZU";
  const head = doc.profile === "EARSIVFATURA" ? "e-ARŞİV FATURA" : "e-FATURA";
  return doc.typeCode === "IADE" ? `${head} (İADE)` : head;
};
const partyLines = p => {
  const id = String(p?.taxNo || "");
  const idLabel = id.length === 11 ? "TCKN" : "VKN";
  return [
    [p?.address, [p?.district, p?.city].filter(Boolean).join(" / "), p?.postalCode].filter(Boolean).join(" "),
    [p?.country && p.country !== "Türkiye" ? p.country : ""].filter(Boolean).join(""),
    [p?.taxOffice ? `Vergi Dairesi: ${p.taxOffice}` : "", id ? `${idLabel}: ${id}` : ""].filter(Boolean).join("   "),
    [p?.mersisNo ? `MERSİS: ${p.mersisNo}` : "", p?.tradeRegistry ? `Ticaret Sicil: ${p.tradeRegistry}` : ""].filter(Boolean).join("   "),
    [p?.phone ? `Tel: ${p.phone}` : "", p?.email ? `E-Posta: ${p.email}` : ""].filter(Boolean).join("   "),
    p?.website || "",
  ].filter(Boolean);
};

function drawInvoice(doc, invoice, { footer = "", logo = null, signatureArea = false }) {
  const M = 36;
  const W = A4.width - M * 2;
  const ink = "#111827";
  const muted = "#6b7280";
  const line = "#d1d5db";
  const accent = invoice.status === "cancelled" ? "#b91c1c" : "#1f3a5f";
  const currency = invoice.currency || "TRY";
  // Satıcı ve alıcı: alış faturasında ve müşterinin kestiği iade faturasında satıcı karşı taraftır.
  const incoming = invoice.kind === "purchase" || invoice.kind === "sale_return";
  const seller = incoming ? invoice.party : invoice.seller;
  const buyer = incoming ? invoice.seller : invoice.party;
  const withholding = (invoice.lines || []).some(item => item.withholdingCode);
  const cols = [
    { key: "seq", label: "Sıra", w: 26, align: "right" },
    // v2.0.16 (müşteri): Stok Kodu ayrı kolon (kalemlerden birinde kod varsa).
    ...((invoice.lines || []).some(item => item.code) ? [{ key: "code", label: "Stok Kodu", w: 62 }] : []),
    { key: "name", label: "Mal / Hizmet", w: 0 },
    { key: "qty", label: "Miktar", w: 58, align: "right" },
    { key: "price", label: "Birim Fiyat", w: 66, align: "right" },
    { key: "disc", label: "İsk. %", w: 34, align: "right" },
    { key: "vat", label: "KDV %", w: 34, align: "right" },
    { key: "vatAmount", label: "KDV", w: 58, align: "right" },
    { key: "net", label: "Tutar", w: 72, align: "right" },
  ];
  const nameCol = cols.find(col => col.key === "name");
  nameCol.w = W - cols.reduce((sum, col) => sum + col.w, 0);
  let page = null;
  let y = 0;
  let pageNo = 0;
  const pages = [];
  const header = () => {
    page = doc.addPage();
    pages.push(page);
    pageNo += 1;
    // Logo (yalnız firmanın kestiği belgede; alış ve müşterinin iade faturasında karşı tarafın belgesidir) ve satıcı (sol üst).
    let sellerX = M;
    const image = logo && !incoming ? logo() : null;
    if (image) {
      // En çok 44 nokta yüksek ve genişliğin %22'si kadar geniş; oran korunur.
      const ratio = image.width / image.height;
      const height = Math.min(44, (W * 0.22) / ratio);
      const width = height * ratio;
      page.image(image, M, 36, width, height);
      sellerX = M + width + 10;
    }
    const sellerW = W * 0.6 - (sellerX - M) - 8;
    page.text(sellerX, 50, doc.fit(seller?.name || "", sellerW, "bold", 12), { font: "bold", size: 12, color: ink });
    let top = 64;
    for (const text of partyLines(seller)) {
      for (const part of doc.wrap(text, sellerW, "regular", 8).slice(0, 2)) {
        page.text(sellerX, top, part, { size: 8, color: muted });
        top += 10;
      }
    }
    // Başlık kutusu (sağ üst).
    const boxX = M + W * 0.6;
    const boxW = W * 0.4;
    page.rect(boxX, 36, boxW, 24, { fill: accent, radius: 3 });
    page.text(boxX, 52, titleOf(invoice), { font: "bold", size: 11, color: "#ffffff", align: "center", width: boxW });
    const facts = [
      [isFormal(invoice) ? "Fatura No" : "Fiş No", invoice.displayNo || invoice.number || "Taslak"],
      invoice.paperNo ? ["Kâğıt Fatura No", invoice.paperNo] : null,
      ["Tarih / Saat", `${dayText(invoice.issueDate)} ${invoice.issueTime || ""}`.trim()],
      isFormal(invoice) ? ["Senaryo", invoice.profileLabel || ""] : null,
      isFormal(invoice) ? ["Fatura Tipi", invoice.typeCode || ""] : null,
      invoice.dueDate && invoice.dueDate !== invoice.issueDate ? ["Vade", dayText(invoice.dueDate)] : null,
      invoice.orderNo ? ["Sipariş", `${invoice.orderNo}${invoice.orderDate ? ` · ${dayText(invoice.orderDate)}` : ""}`] : null,
      invoice.despatchNo ? ["İrsaliye", `${invoice.despatchNo}${invoice.despatchDate ? ` · ${dayText(invoice.despatchDate)}` : ""}`] : null,
      invoice.originalNumber ? ["İade Edilen", `${invoice.originalNumber}${invoice.originalDate ? ` · ${dayText(invoice.originalDate)}` : ""}`] : null,
      currency !== "TRY" ? ["Döviz / Kur", `${currency} · ${String(invoice.rate).replace(".", ",")}`] : null,
      invoice.profile !== "KAGIT" && invoice.ettn ? ["ETTN", invoice.ettn] : null,
    ].filter(Boolean);
    let factTop = 74;
    for (const [label, value] of facts) {
      page.text(boxX + 4, factTop, label, { size: 7.5, color: muted });
      const strong = label === "Fatura No" || label === "Fiş No";
      page.text(boxX + 66, factTop, doc.fit(String(value), boxW - 70, strong ? "bold" : "regular", label === "ETTN" ? 6.5 : 8), { size: label === "ETTN" ? 6.5 : 8, font: strong ? "bold" : "regular", color: ink });
      factTop += 11;
    }
    // Alıcı.
    top = Math.max(top, factTop) + 8;
    page.rect(M, top, W, 1, { fill: line });
    top += 14;
    page.text(M, top, incoming ? "SATICI / DÜZENLEYEN" : "SAYIN", { font: "bold", size: 7.5, color: muted });
    top += 12;
    page.text(M, top, doc.fit(buyer?.name || "", W, "bold", 10.5), { font: "bold", size: 10.5, color: ink });
    top += 12;
    for (const text of partyLines(buyer)) {
      for (const part of doc.wrap(text, W, "regular", 8).slice(0, 2)) {
        page.text(M, top, part, { size: 8, color: muted });
        top += 10;
      }
    }
    top += 6;
    // Kalem başlıkları.
    page.rect(M, top, W, 16, { fill: "#f3f4f6" });
    let x = M;
    for (const col of cols) {
      page.text(x + 3, top + 11, col.label, { font: "bold", size: 7.5, color: ink, align: col.align || "left", width: col.w - 6 });
      x += col.w;
    }
    y = top + 16;
    if (invoice.status === "cancelled") page.text(M, 400, "İPTAL EDİLDİ", { font: "bold", size: 54, color: "#fca5a5", align: "center", width: W });
  };
  header();
  const bottom = A4.height - 60;
  for (const [index, item] of (invoice.lines || []).entries()) {
    const nameLines = doc.wrap(item.name, nameCol.w - 6, "regular", 8).slice(0, 4);
    const extra = [item.description, item.withholdingCode ? `Tevkifat ${item.withholdingCode} (${item.withholdingNum}/${item.withholdingDen}): ${money(item.withheld, currency)}` : "", item.vatRate === 0 && item.exemptionCode ? `İstisna ${item.exemptionCode}` : "", item.expenseLabel ? `Gider: ${item.expenseLabel}` : ""].filter(Boolean);
    const extraLines = extra.flatMap(text => doc.wrap(text, nameCol.w - 6, "regular", 7)).slice(0, 4);
    const height = Math.max(14, nameLines.length * 10 + extraLines.length * 9 + 5);
    if (y + height > bottom) header();
    let x = M;
    const values = {
      seq: String(index + 1),
      code: item.code || "",
      qty: `${qtyFormat.format(item.qty)} ${item.unit || ""}`.trim(),
      price: priceFormat.format(item.unitPrice),
      disc: item.discountRate ? numberFormat.format(item.discountRate) : "",
      vat: String(item.vatRate),
      vatAmount: numberFormat.format(item.vat),
      net: numberFormat.format(item.net),
    };
    for (const col of cols) {
      if (col.key === "name") {
        nameLines.forEach((part, at) => page.text(x + 3, y + 10 + at * 10, part, { size: 8, color: ink }));
        extraLines.forEach((part, at) => page.text(x + 3, y + 10 + nameLines.length * 10 + at * 9, part, { size: 7, color: muted }));
      } else page.text(x + 3, y + 10, doc.fit(values[col.key] || "", col.w - 6, "regular", 8), { size: 8, color: ink, align: col.align || "left", width: col.w - 6 });
      x += col.w;
    }
    y += height;
    page.line(M, y, M + W, y, { color: "#e5e7eb" });
  }
  // Toplamlar.
  const rows = [
    // v2.0.16 (müşteri): iskonto varsa Toplam ve İskonto KDV hariç (Toplam − İskonto = Matrah); iskonto yoksa KDV dahil
    // fiyatta Toplam girilen KDV dahil tutardır. Ekrandaki Toplamlar ile aynı kural (hof-invoices.js totalRows).
    ["Mal / Hizmet Toplamı", money((invoice.discountNetTotal ?? invoice.discountTotal) > 0 || !invoice.pricesIncludeVat ? (invoice.baseNetTotal ?? invoice.baseTotal) : invoice.baseTotal, currency)],
    (invoice.discountNetTotal ?? invoice.discountTotal) > 0 ? ["Toplam İskonto", money(invoice.discountNetTotal ?? invoice.discountTotal, currency)] : null,
    ["Matrah (KDV Hariç)", money(invoice.netTotal, currency)],
    ...(invoice.byRate || []).map(item => [`KDV %${item.rate} (Matrah ${numberFormat.format(item.net)})`, money(item.vat, currency)]),
    ["Vergiler Dahil Toplam", money(invoice.grossTotal, currency)],
    withholding ? ["KDV Tevkifatı (Alıcı Öder)", `− ${money(invoice.withheldTotal, currency)}`] : null,
    invoice.stoppageTotal > 0 ? [`Gelir Vergisi Stopajı %${String(invoice.stoppageRate).replace(".", ",")}`, `− ${money(invoice.stoppageTotal, currency)}`] : null,
    ["Ödenecek Tutar", money(invoice.payableTotal, currency)],
    currency !== "TRY" ? ["TL Karşılığı", money(invoice.tryPayable, "TRY")] : null,
  ].filter(Boolean);
  const notes = [
    invoice.amountInWords,
    invoice.note ? `Not: ${invoice.note}` : "",
    paymentText(invoice),
    (invoice.seller?.banks || []).filter(bank => bank.iban).map(bank => `${bank.name ? `${bank.name} ` : ""}IBAN: ${bank.iban.replace(/(.{4})/g, "$1 ").trim()}`).join("   "),
    invoice.profile === "EARSIVFATURA" ? "e-Arşiv izni kapsamında elektronik ortamda iletilmiştir." : "",
    invoice.status === "draft" ? "Bu belge proformadır; yasal fatura yerine geçmez." : !isFormal(invoice) ? "Bu belge bilgi amaçlıdır; resmî fatura yerine geçmez ve mali değeri yoktur." : "",
    invoice.status === "cancelled" ? `Bu fatura ${dayText((invoice.cancelledAt || "").slice(0, 10))} tarihinde iptal edildi${invoice.cancelReason ? `: ${invoice.cancelReason}` : ""}.` : "",
    footer,
  ].filter(Boolean);
  const noteLines = notes.flatMap(text => doc.wrap(text, W * 0.55, "regular", 8));
  const need = Math.max(rows.length * 14 + 10, noteLines.length * 10 + 10);
  if (y + need + 20 > bottom) header();
  y += 12;
  const totalsX = M + W * 0.58;
  const totalsW = W * 0.42;
  let ty = y;
  for (const [label, value] of rows) {
    const strong = label === "Ödenecek Tutar";
    if (strong) page.rect(totalsX, ty - 2, totalsW, 16, { fill: "#eef2f7" });
    page.text(totalsX + 4, ty + 10, label, { size: 8, font: strong ? "bold" : "regular", color: ink });
    page.text(totalsX, ty + 10, value, { size: strong ? 9.5 : 8.5, font: strong ? "bold" : "regular", color: ink, align: "right", width: totalsW - 4 });
    ty += 14;
  }
  let ny = y + 10;
  for (const part of noteLines) {
    page.text(M, ny, part, { size: 8, color: part.startsWith("Yalnız") ? ink : muted, font: part.startsWith("Yalnız") ? "bold" : "regular" });
    ny += 10;
  }
  // Kaşe / imza alanı (v2.0.15, QA A9): firmanın kestiği belgede "Teslim Alan" ve "Düzenleyen" kutuları; ıslak imza
  // ve kaşe için boşluk. Alış ve müşterinin iade faturasında (karşı tarafın belgesi) basılmaz.
  if (signatureArea && !incoming) {
    let sy = Math.max(ty, ny) + 14;
    const boxH = 58;
    if (sy + boxH + 10 > bottom) {
      header();
      sy = y + 12;
    }
    const boxW = W * 0.32;
    const boxes = [
      [M, "TESLİM ALAN", "Ad Soyad / İmza"],
      [M + W - boxW, "DÜZENLEYEN", "Kaşe / İmza"],
    ];
    for (const [bx, title, hint] of boxes) {
      page.rect(bx, sy, boxW, boxH, { stroke: line, lineWidth: 0.6, radius: 3 });
      page.text(bx + 6, sy + 11, title, { font: "bold", size: 7, color: muted });
      page.text(bx + 6, sy + boxH - 6, hint, { size: 6.5, color: muted });
    }
  }
  // Sayfa altbilgisi.
  pages.forEach((item, index) => item.text(M, A4.height - 30, `${invoice.displayNo || ""} · Sayfa ${index + 1} / ${pages.length}`, { size: 7, color: muted, align: "right", width: W }));
}

function paymentText(invoice) {
  const p = invoice.payment || {};
  const parts = [];
  const names = ["sale", "smm", "purchase_return"].includes(invoice.kind) ? METHOD_IN : METHOD_OUT;
  for (const item of p.cash || []) parts.push(`${names[item.method] || "Nakit"} ${money(item.amount, "TRY")}`);
  if ((p.cheques || []).length) parts.push(`${p.cheques.length} çek/senet ${money(p.cheques.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), "TRY")}`);
  if ((p.endorse || []).length) parts.push(`${p.endorse.length} çek cirosu`);
  if (p.mode === "installments" && p.installments) parts.push(`kalan ${p.installments.count} taksit (ilk vade ${dayText(p.installments.firstDue)})`);
  else if (p.mode === "open" && invoice.dueDate) parts.push(`kalan vadeli (vade ${dayText(invoice.dueDate)})`);
  return parts.length ? `Ödeme: ${parts.join(" · ")}` : "";
}

/**
 * Ayarlardaki logo (data:image/jpeg;base64,…) → PDF görseli. Görsel ilk basıldığında belgeye kaydedilir (yalnız alış
 * belgeleri içeren PDF'e girmez); bozuksa logosuz basılır (belge hiç kesilmez olmasın).
 */
const logoOf = (doc, value) => {
  if (!value) return null;
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(String(value).replace(/^data:image\/jpeg;base64,/i, ""), "base64");
  let image;
  return () => {
    if (image === undefined) {
      try {
        image = doc.image(raw);
      } catch {
        image = null;
      }
    }
    return image;
  };
};

/** docs: routes/invoices.mjs detail() çıktıları. logo: JPEG data URL ya da Buffer; signatureArea: kaşe / imza kutuları. */
export function invoicePdf(docs, { footer = "", officeName = "", logo = "", signatureArea = false } = {}) {
  const list = Array.isArray(docs) ? docs : [docs];
  const doc = new PdfDocument({ fonts: loadFonts(), size: A4, title: list.length === 1 ? `${list[0].kindLabel} ${list[0].displayNo || ""}`.trim() : `Faturalar (${list.length})`, author: officeName || "DestekOfis", subject: "Fatura" });
  const image = logoOf(doc, logo);
  for (const invoice of list) drawInvoice(doc, invoice, { footer, logo: image, signatureArea: signatureArea === true });
  return doc.toBuffer();
}
