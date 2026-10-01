// Fatura matematiği (v2.0.15) — saf kural motoru; veritabanına dokunmaz. Yol (routes/invoices.mjs), UBL-TR üretici,
// mutabakat kapısı ve testler aynı fonksiyonu kullanır: ekranda görülen, deftere yazılan ve e-Belgeye giden tutar aynıdır.
//
// Kuruş tamsayısıyla çalışır (kayan nokta birikmez). Satır bazında yuvarlanır (GİB UBL-TR: her kalemin KDV'si ayrı
// hesaplanır, toplamlar kalemlerin toplamıdır), yarım kuruş sıfırdan uzağa (ticari kural, money.mjs ile aynı).
//
// Kalem
//   brüt (kuruş)       = miktar × birim fiyat
//   iskonto            = brüt × iskonto oranı
//   KDV hariç fiyatta  : matrah = brüt − iskonto;          KDV = matrah × oran
//   KDV dahil fiyatta  : tutar  = brüt − iskonto;          matrah = tutar ÷ (1 + oran);  KDV = tutar − matrah
//                        (KDV dahil yazılan tutar kuruşu kuruşuna korunur)
//   tevkifat           = KDV × (pay / payda)             (KDV Genel Uygulama Tebliği I/C-2.1.3; alıcı öder)
//   KDV dahil tutar    = matrah + KDV
//   ödenecek           = KDV dahil tutar − tevkifat       (cariye yazılan, faturanın "ödenecek tutarı")
import { roundMoney } from "./money.mjs";

export const VAT_RATES = Object.freeze([0, 1, 10, 20]);
// Fatura türleri: cariye etki yönü, stok yönü, UBL belge türü.
export const INVOICE_KINDS = Object.freeze({
  sale: { label: "Satış Faturası", short: "Satış", party: "debt", stock: "out", typeCode: "SATIS", return: false },
  purchase: { label: "Alış Faturası", short: "Alış", party: "credit", stock: "in", typeCode: "SATIS", return: false },
  sale_return: { label: "Satıştan İade Faturası", short: "Satıştan İade", party: "credit", stock: "in", typeCode: "IADE", return: true, of: "sale" },
  purchase_return: { label: "Alıştan İade Faturası", short: "Alıştan İade", party: "debt", stock: "out", typeCode: "IADE", return: true, of: "purchase" },
});
// KDV tevkifatı (GİB kod listesi; oran pay/payda). Kullanıcı faturada oranı değiştirmez; tebliğ değişirse liste güncellenir.
export const WITHHOLDING = Object.freeze({
  601: { label: "Yapım İşleri ile Bu İşlerle Birlikte İfa Edilen Mühendislik-Mimarlık ve Etüt-Proje Hizmetleri", num: 4, den: 10 },
  602: { label: "Etüt, Plan-Proje, Danışmanlık, Denetim ve Benzeri Hizmetler", num: 9, den: 10 },
  603: { label: "Makine, Teçhizat, Demirbaş ve Taşıtlara Ait Tadil, Bakım ve Onarım Hizmetleri", num: 7, den: 10 },
  604: { label: "Yemek Servis Hizmeti", num: 5, den: 10 },
  605: { label: "Organizasyon Hizmeti", num: 5, den: 10 },
  606: { label: "İşgücü Temin Hizmetleri", num: 9, den: 10 },
  607: { label: "Özel Güvenlik Hizmeti", num: 9, den: 10 },
  608: { label: "Yapı Denetim Hizmetleri", num: 9, den: 10 },
  609: { label: "Fason Olarak Yaptırılan Tekstil ve Konfeksiyon İşleri", num: 7, den: 10 },
  610: { label: "Turistik Mağazalara Verilen Müşteri Bulma / Götürme Hizmetleri", num: 9, den: 10 },
  611: { label: "Spor Kulüplerinin Yayın, Reklam ve İsim Hakkı Gelirleri", num: 9, den: 10 },
  612: { label: "Temizlik Hizmeti", num: 9, den: 10 },
  613: { label: "Çevre ve Bahçe Bakım Hizmetleri", num: 9, den: 10 },
  614: { label: "Servis Taşımacılığı Hizmeti", num: 5, den: 10 },
  615: { label: "Her Türlü Baskı ve Basım Hizmetleri", num: 7, den: 10 },
  616: { label: "Diğer Hizmetler", num: 5, den: 10 },
  617: { label: "Hurda Metalden Elde Edilen Külçe Teslimleri", num: 7, den: 10 },
  618: { label: "Hurda Metalden Elde Edilenler Dışındaki Bakır, Çinko ve Alüminyum Külçe Teslimleri", num: 7, den: 10 },
  619: { label: "Bakır, Çinko ve Alüminyum Ürünlerinin Teslimi", num: 7, den: 10 },
  620: { label: "İstisnadan Vazgeçenlerin Hurda ve Atık Teslimi", num: 7, den: 10 },
  621: { label: "Metal, Plastik, Lastik, Kauçuk, Kâğıt ve Cam Hurda ve Atıklardan Elde Edilen Hammadde Teslimi", num: 9, den: 10 },
  622: { label: "Pamuk, Tiftik, Yün ve Yapağı ile Ham Post ve Deri Teslimleri", num: 9, den: 10 },
  623: { label: "Ağaç ve Orman Ürünleri Teslimi", num: 5, den: 10 },
  624: { label: "Yük Taşımacılığı Hizmeti", num: 2, den: 10 },
  625: { label: "Ticari Reklam Hizmetleri", num: 3, den: 10 },
  626: { label: "Diğer Teslimler", num: 2, den: 10 },
  627: { label: "Demir-Çelik Ürünlerinin Teslimi", num: 5, den: 10 },
});
// %0 KDV'li kalemin istisna / muafiyet nedeni (UBL TaxExemptionReasonCode). 351: istisna olmayan diğer.
export const EXEMPTIONS = Object.freeze({
  351: "KDV - İstisna Olmayan Diğer",
  301: "11/1-a Mal İhracatı",
  302: "11/1-a Hizmet İhracatı",
  308: "13/a Deniz, Hava ve Demiryolu Taşıma Araçlarının Teslimi",
  350: "Diğerleri",
});

const EPS = 1e-9;
// x × 100'ü kayan nokta artığından arındırıp kuruşa yuvarlar (roundMoney ile aynı yöntem).
const toCentsExact = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return 0;
  return Math.sign(number) * Math.round(Number((Math.abs(number) * 100).toPrecision(15)));
};
// a × p / q, yarım yukarı (pozitif tamsayılar için tam bölme; kayan nokta yok).
const mulDiv = (a, p, q) => (a <= 0 ? 0 : Math.floor((2 * a * p + q) / (2 * q)));
export const cents = value => toCentsExact(value);
export const tl = value => roundMoney((Number(value) || 0) / 100);

export class InvoiceInputError extends Error {
  constructor(message, field = "") {
    super(message);
    this.field = field;
  }
}
const fail = (message, field) => {
  throw new InvoiceInputError(message, field);
};

/** Tek kalem. input: { qty, unitPrice, discountRate?, vatRate, withholdingCode?, exemptionCode? } */
export function computeLine(input, { pricesIncludeVat = false, index = 0 } = {}) {
  const at = `${index + 1}. kalem`;
  const qty = Number(input.qty);
  if (!Number.isFinite(qty) || qty <= 0) fail(`${at}: miktar sıfırdan büyük olmalı.`, "qty");
  if (Math.abs(qty * 1000 - Math.round(qty * 1000)) > 1e-6) fail(`${at}: miktar en çok üç ondalık basamak olabilir.`, "qty");
  const unitPrice = Number(input.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) fail(`${at}: birim fiyat eksi olamaz.`, "unitPrice");
  if (Math.abs(unitPrice * 10000 - Math.round(unitPrice * 10000)) > 1e-6) fail(`${at}: birim fiyat en çok dört ondalık basamak olabilir.`, "unitPrice");
  const discountRate = Number(input.discountRate || 0);
  if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) fail(`${at}: iskonto oranı 0 ile 100 arasında olmalı.`, "discountRate");
  const vatRate = Number(input.vatRate);
  if (!VAT_RATES.includes(vatRate)) fail(`${at}: KDV oranı ${VAT_RATES.map(rate => `%${rate}`).join(", ")} olabilir.`, "vatRate");
  const code = String(input.withholdingCode || "").trim();
  const withholding = code ? WITHHOLDING[code] : null;
  if (code && !withholding) fail(`${at}: tevkifat kodu (${code}) tanınmadı.`, "withholdingCode");
  if (withholding && vatRate === 0) fail(`${at}: KDV'siz kalemde tevkifat olmaz.`, "withholdingCode");
  const exemption = vatRate === 0 ? String(input.exemptionCode || "351").trim() : "";
  if (exemption && !EXEMPTIONS[exemption]) fail(`${at}: KDV istisna kodu (${exemption}) tanınmadı.`, "exemptionCode");

  const base = toCentsExact(qty * unitPrice);
  const discount = Math.round(Number(((base * discountRate) / 100).toPrecision(15)));
  const after = base - discount;
  let net;
  let vat;
  if (pricesIncludeVat) {
    net = mulDiv(after, 100, 100 + vatRate);
    vat = after - net;
  } else {
    net = after;
    vat = mulDiv(net, vatRate, 100);
  }
  const withheld = withholding ? mulDiv(vat, withholding.num, withholding.den) : 0;
  const gross = net + vat;
  return {
    qty: Math.round(qty * 1000) / 1000,
    unitPrice,
    discountRate,
    vatRate,
    withholdingCode: withholding ? code : "",
    withholdingNum: withholding?.num || 0,
    withholdingDen: withholding?.den || 0,
    exemptionCode: exemption,
    base,
    discount,
    net,
    vat,
    withheld,
    gross,
    payable: gross - withheld,
  };
}

/**
 * Faturanın tamamı. lines: computeLine girdileri + { goods: true|false } (stoklu mal mı, hizmet mi).
 * Dönüş: { lines, totals } — tutarlar kuruş tamsayısı; totals.tl aynı tutarların TL karşılığı.
 */
export function computeInvoice(lines, { pricesIncludeVat = false } = {}) {
  if (!Array.isArray(lines) || !lines.length) fail("Faturaya en az bir kalem ekleyin.", "lines");
  if (lines.length > 500) fail("Bir faturada en çok 500 kalem olabilir.", "lines");
  const out = lines.map((line, index) => ({ ...computeLine(line, { pricesIncludeVat, index }), goods: Boolean(line.goods) }));
  const sum = key => out.reduce((total, line) => total + line[key], 0);
  const byRate = new Map();
  const byWithholding = new Map();
  for (const line of out) {
    const rate = byRate.get(line.vatRate) || { rate: line.vatRate, net: 0, vat: 0 };
    rate.net += line.net;
    rate.vat += line.vat;
    byRate.set(line.vatRate, rate);
    if (line.withholdingCode) {
      const item = byWithholding.get(line.withholdingCode) || { code: line.withholdingCode, num: line.withholdingNum, den: line.withholdingDen, vat: 0, withheld: 0 };
      item.vat += line.vat;
      item.withheld += line.withheld;
      byWithholding.set(line.withholdingCode, item);
    }
  }
  const totals = {
    base: sum("base"),
    discount: sum("discount"),
    net: sum("net"),
    vat: sum("vat"),
    withheld: sum("withheld"),
    gross: sum("gross"),
    payable: sum("payable"),
    goodsNet: out.filter(line => line.goods).reduce((total, line) => total + line.net, 0),
    serviceNet: out.filter(line => !line.goods).reduce((total, line) => total + line.net, 0),
    byRate: [...byRate.values()].sort((a, b) => a.rate - b.rate),
    byWithholding: [...byWithholding.values()],
  };
  if (totals.payable <= 0) fail("Faturanın ödenecek tutarı sıfırdan büyük olmalı.", "lines");
  return { lines: out, totals };
}

/** GİB fatura tipi: iade → IADE; tevkifatlı → TEVKIFAT; tüm kalemler istisnalı (%0, 351 dışı) → ISTISNA; yoksa SATIS. */
export function typeCode(kind, lines) {
  if (INVOICE_KINDS[kind]?.return) return "IADE";
  if (lines.some(line => line.withholdingCode)) return "TEVKIFAT";
  if (lines.length && lines.every(line => line.vatRate === 0 && line.exemptionCode && line.exemptionCode !== "351")) return "ISTISNA";
  return "SATIS";
}

/** Tutar yazıyla (e-Fatura ve kâğıt faturada zorunlu not: "Yalnız …"). */
export function amountInWords(value) {
  const ones = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
  const tens = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
  const groups = ["", "Bin", "Milyon", "Milyar", "Trilyon"];
  const three = n => {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const o = n % 10;
    return [h ? (h === 1 ? "Yüz" : `${ones[h]} Yüz`) : "", tens[t], ones[o]].filter(Boolean).join(" ");
  };
  const words = n => {
    if (n === 0) return "Sıfır";
    let out = "";
    let index = 0;
    while (n > 0) {
      const part = n % 1000;
      if (part) out = [index === 1 && part === 1 ? "" : three(part), groups[index], out].filter(Boolean).join(" ");
      n = Math.floor(n / 1000);
      index += 1;
    }
    return out;
  };
  const total = Math.round(Math.abs(Number(value) || 0) * 100);
  const lira = Math.floor(total / 100);
  const kurus = total % 100;
  return `Yalnız ${words(lira)} Türk Lirası${kurus ? ` ${words(kurus)} Kuruş` : ""}`;
}

export const EPSILON = EPS;
