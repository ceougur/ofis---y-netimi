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
//
// Belge düzeyi
//   genel iskonto      : her kalemin (kalem iskontosundan sonra kalan) tutarına aynı oran zincirleme uygulanır; KDV
//                        iskontolu matrahtan hesaplanır (VUK / KDV Kanunu md. 24: iskonto matrahtan düşer).
//   stopaj (SMM)       = matrah (brüt ücret) × gelir vergisi stopaj oranı; alıcı keser, vergi dairesine öder
//                        (GVK md. 94). Ödenecek = brüt + KDV − KDV tevkifatı − stopaj.
//   döviz              : tutarlar belgenin para biriminde hesaplanır; deftere (cari, Kasa, Ana Defter) TL karşılığı yazılır
//                        (matrah, KDV, tevkifat, stopaj ayrı ayrı kurla çevrilir; ödenecek bunlardan türetilir — böylece
//                        TL yevmiye maddesi kuruşu kuruşuna denk kalır).
import { roundMoney } from "./money.mjs";

export const VAT_RATES = Object.freeze([0, 1, 10, 20]);
// Fatura türleri: cariye etki yönü, stok yönü, UBL belge türü.
// own: numarayı biz veririz (seri + yıl + sıra); değilse belge karşı tarafındır (alış faturası; müşterinin kestiği iade
// faturası) ve numarası elle yazılır. send: e-Belge olarak biz göndeririz.
export const INVOICE_KINDS = Object.freeze({
  sale: { label: "Satış Faturası", short: "Satış", party: "debt", stock: "out", typeCode: "SATIS", return: false, own: true, send: true, side: "sale" },
  purchase: { label: "Alış Faturası", short: "Alış", party: "credit", stock: "in", typeCode: "SATIS", return: false, own: false, send: false, side: "purchase" },
  // Satıştan iade: malı geri veren alıcı (mükellefse) iade faturasını KENDİSİ keser; numara onun belgesidir. Nihai
  // tüketicide numara boş bırakılır, iç sıra numarası verilir (kayıt no).
  sale_return: { label: "Satıştan İade Faturası", short: "Satıştan İade", party: "credit", stock: "in", typeCode: "IADE", return: true, of: "sale", own: false, send: false, side: "sale" },
  // Alıştan iade: tedarikçiye malı geri veren biziz; iade faturasını biz keseriz.
  purchase_return: { label: "Alıştan İade Faturası", short: "Alıştan İade", party: "debt", stock: "out", typeCode: "IADE", return: true, of: "purchase", own: true, send: true, side: "purchase" },
  // Serbest meslek makbuzu (avukat, hekim, mali müşavir, mimar…): stok yok; stopaj alıcı tarafından kesilir.
  smm: { label: "Serbest Meslek Makbuzu", short: "SMM", party: "debt", stock: "", typeCode: "SATIS", return: false, own: true, send: false, side: "sale" },
});
export const CURRENCIES = Object.freeze({
  TRY: { label: "Türk Lirası", symbol: "₺", unit: "Türk Lirası", sub: "Kuruş" },
  USD: { label: "ABD Doları", symbol: "$", unit: "ABD Doları", sub: "Sent" },
  EUR: { label: "Avro", symbol: "€", unit: "Avro", sub: "Sent" },
  GBP: { label: "İngiliz Sterlini", symbol: "£", unit: "İngiliz Sterlini", sub: "Peni" },
});
// Gelir vergisi stopaj oranları (serbest meslek kazancı GVK md. 94/2-b: %20). Kullanıcı farklı oran yazabilir (0–40).
export const STOPPAGE_DEFAULT = 20;

// Senaryo: faturaya başlarken seçilir; ekranı (kalem türü, kolonlar, varsayılan hesaplar) belirler. Belge modeli tektir:
// bir senaryoda açılan faturaya gerekirse öbür türden kalem de eklenebilir (stoklu satışa nakliye hizmeti gibi).
export const SCENARIOS = Object.freeze({
  goods_sale: { kind: "sale", label: "Stoktan Satış", line: "goods", hint: "Stoktaki ürünü satarsınız; stok düşer, müşterinin carisine borç yazılır." },
  service_sale: { kind: "sale", label: "Hizmet Satışı", line: "service", hint: "Hizmet, abonelik, kira, servis, eğitim gibi stoksuz satışlar." },
  price_difference: { kind: "sale", label: "Fiyat Farkı Faturası", line: "service", hint: "Daha önce kesilen faturanın fiyat ya da kur farkı; stoksuz kalemle kesilir, müşterinin carisine borç yazılır." },
  smm: { kind: "smm", label: "Serbest Meslek Makbuzu", line: "service", hint: "Avukat, hekim, mali müşavir, mimar: brüt ücret, stopaj ve KDV." },
  sale_return: { kind: "sale_return", label: "Satıştan İade", line: "goods", hint: "Müşterinin geri getirdiği mal ya da iptal edilen hizmet; kesilen faturadan seçilir." },
  goods_purchase: { kind: "purchase", label: "Stoğa Mal Alışı", line: "goods", hint: "Tedarikçiden alınan ürün stoğa girer; tedarikçinin carisine alacak yazılır." },
  expense_purchase: { kind: "purchase", label: "Hizmet ve Gider Alışı", line: "expense", hint: "Kira, elektrik, internet, danışmanlık, kırtasiye, demirbaş gibi giderler." },
  purchase_return: { kind: "purchase_return", label: "Alıştan İade", line: "goods", hint: "Tedarikçiye geri verilen mal; alış faturasından seçilir." },
});
// Gider türleri (alışta stoksuz kalem). Tekdüzen: giderler 770 Genel Yönetim Giderleri, 760 Pazarlama Satış ve Dağıtım
// Giderleri; demirbaş alımı gider değil varlıktır (255 Demirbaşlar, amortismanla gidere döner).
export const EXPENSES = Object.freeze({
  rent: { label: "Kira", account: "770" },
  utilities: { label: "Elektrik, Su ve Doğalgaz", account: "770" },
  telecom: { label: "İnternet ve Telefon", account: "770" },
  office: { label: "Kırtasiye ve Ofis Malzemesi", account: "770" },
  fuel: { label: "Yakıt ve Ulaşım", account: "770" },
  repair: { label: "Bakım ve Onarım", account: "770" },
  advisory: { label: "Danışmanlık, Muhasebe ve Hukuk", account: "770" },
  food: { label: "Yemek ve İkram", account: "770" },
  insurance: { label: "Sigorta", account: "770" },
  software: { label: "Yazılım ve Abonelik", account: "770" },
  cleaning: { label: "Temizlik ve Güvenlik", account: "770" },
  marketing: { label: "Reklam ve Pazarlama", account: "760" },
  freight: { label: "Nakliye ve Kargo", account: "760" },
  asset: { label: "Demirbaş (Bilgisayar, Mobilya, Cihaz)", account: "255" },
  // v2.1.0 (banka planı §3.7 #13, K2): KDV'li banka masrafı ve ödeme kuruluşu komisyonu faturası (Banka → Masraf; faturalı kip). Hesabı
  // masraf türü belirler: banka masrafları 770, POS ve ödeme kuruluşu komisyonları 653.
  bank: { label: "Banka Masrafları", account: "770" },
  commission: { label: "POS ve Ödeme Kuruluşu Komisyonları", account: "653" },
  other: { label: "Diğer Giderler", account: "770" },
});
/**
 * Kalemin ana defter hesabı. Satış ve SMM: 600 Yurt İçi Satışlar (mal ve hizmet; ana faaliyet geliri). Satıştan iade:
 * 610. Alış ve alıştan iade: stoklu mal 153 Ticari Mallar; stoksuz kalem gider türünün hesabı (yoksa 770).
 */
export function lineAccount(kind, { goods = false, expenseCode = "" } = {}) {
  if (kind === "sale" || kind === "smm") return "600";
  if (kind === "sale_return") return "610";
  if (goods) return "153";
  return EXPENSES[expenseCode]?.account || "770";
}
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

/**
 * v2.0.16 (müşteri): KDV dahil fiyatta brüt tutar ve iskonto KDV dahildir; ekranda, fişte, PDF'te ve UBL'de "Ara Toplam −
 * İskonto = Matrah" satırları KDV HARİÇ tutarlarla gösterilir (yaygın muhasebe programlarındaki gibi; 2.000 TL KDV dahil,
 * %10 iskonto: 1.666,67 − 166,67 = 1.500,00; KDV 300,00). Kalem başına kuruş tamsayısı; iskonto = KDV hariç brüt − matrah,
 * böylece satırlar kuruşu kuruşuna toplar. base / net / vatRate kuruş tamsayısı ya da (scale = 100) TL ondalığı olabilir.
 */
export function exclusiveParts({ base = 0, net = 0, vatRate = 0 }, includeVat, scale = 1) {
  const baseC = scale === 1 ? Math.round(Number(base) || 0) : toCentsExact(base);
  const netC = scale === 1 ? Math.round(Number(net) || 0) : toCentsExact(net);
  const baseNet = includeVat ? mulDiv(baseC, 100, 100 + (Number(vatRate) || 0)) : baseC;
  const discountNet = Math.max(0, baseNet - netC);
  return scale === 1 ? { baseNet: netC + discountNet, discountNet } : { baseNet: (netC + discountNet) / 100, discountNet: discountNet / 100 };
}
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

/** Tek kalem. input: { qty, unitPrice, discountRate?, vatRate, withholdingCode?, exemptionCode? }; extraDiscountRate: genel iskonto. */
export function computeLine(input, { pricesIncludeVat = false, index = 0, extraDiscountRate = 0 } = {}) {
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
  const lineDiscount = Math.round(Number(((base * discountRate) / 100).toPrecision(15)));
  const docDiscount = extraDiscountRate > 0 ? Math.round(Number((((base - lineDiscount) * extraDiscountRate) / 100).toPrecision(15))) : 0;
  const discount = lineDiscount + docDiscount;
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
    lineDiscount,
    docDiscount,
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
 * options: { pricesIncludeVat, discountRate (genel iskonto %), stoppageRate (SMM stopaj %) }.
 * Dönüş: { lines, totals } — tutarlar belgenin para biriminde kuruş tamsayısı.
 */
export function computeInvoice(lines, { pricesIncludeVat = false, discountRate = 0, stoppageRate = 0 } = {}) {
  if (!Array.isArray(lines) || !lines.length) fail("Faturaya en az bir kalem ekleyin.", "lines");
  if (lines.length > 500) fail("Bir faturada en çok 500 kalem olabilir.", "lines");
  const extra = Number(discountRate || 0);
  if (!Number.isFinite(extra) || extra < 0 || extra >= 100) fail("Genel iskonto oranı 0 ile 100 arasında olmalı.", "discountRate");
  const stoppage = Number(stoppageRate || 0);
  if (!Number.isFinite(stoppage) || stoppage < 0 || stoppage > 40) fail("Stopaj oranı 0 ile 40 arasında olmalı.", "stoppageRate");
  const out = lines.map((line, index) => {
    const computed = computeLine(line, { pricesIncludeVat, index, extraDiscountRate: extra });
    return { ...computed, ...exclusiveParts(computed, pricesIncludeVat), goods: Boolean(line.goods), account: String(line.account || "600") };
  });
  const sum = key => out.reduce((total, line) => total + line[key], 0);
  const byRate = new Map();
  const byWithholding = new Map();
  const byAccount = new Map();
  for (const line of out) {
    byAccount.set(line.account, (byAccount.get(line.account) || 0) + line.net);
    const rate = byRate.get(line.vatRate) || { rate: line.vatRate, net: 0, vat: 0, exemptionCode: "" };
    rate.net += line.net;
    rate.vat += line.vat;
    if (line.exemptionCode && !rate.exemptionCode) rate.exemptionCode = line.exemptionCode;
    byRate.set(line.vatRate, rate);
    if (line.withholdingCode) {
      const item = byWithholding.get(line.withholdingCode) || { code: line.withholdingCode, num: line.withholdingNum, den: line.withholdingDen, net: 0, vat: 0, withheld: 0 };
      item.net += line.net;
      item.vat += line.vat;
      item.withheld += line.withheld;
      byWithholding.set(line.withholdingCode, item);
    }
  }
  const net = sum("net");
  // Stopaj belge toplamından hesaplanır (makbuzda tek satır: "Gelir Vergisi Stopajı %20").
  const stoppageTotal = stoppage > 0 ? mulDiv(net, Math.round(stoppage * 100), 10000) : 0;
  const totals = {
    base: sum("base"),
    discount: sum("discount"),
    // KDV hariç ara toplam ve iskonto (gösterim: Ara Toplam − İskonto = KDV Matrahı).
    baseNet: sum("baseNet"),
    discountNet: sum("discountNet"),
    lineDiscount: sum("lineDiscount"),
    docDiscount: sum("docDiscount"),
    net,
    vat: sum("vat"),
    withheld: sum("withheld"),
    stoppage: stoppageTotal,
    stoppageRate: stoppage,
    gross: sum("gross"),
    payable: sum("payable") - stoppageTotal,
    goodsNet: out.filter(line => line.goods).reduce((total, line) => total + line.net, 0),
    serviceNet: out.filter(line => !line.goods).reduce((total, line) => total + line.net, 0),
    byRate: [...byRate.values()].sort((a, b) => a.rate - b.rate),
    byWithholding: [...byWithholding.values()],
    byAccount: [...byAccount.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([account, amount]) => ({ account, net: amount })),
  };
  if (totals.payable <= 0) fail("Faturanın ödenecek tutarı sıfırdan büyük olmalı.", "lines");
  return { lines: out, totals };
}

/**
 * Döviz kuru: TL karşılıkları (kuruş). rate: 1 birim döviz = rate TL (en çok 6 ondalık). Matrah hesap bazında (600, 153,
 * 770…), KDV, tevkifat ve stopaj ayrı çevrilir; TL matrah hesapların toplamıdır, ödenecek bunlardan türetilir (TL yevmiye
 * maddesi kuruşu kuruşuna denk kalır). TL faturada (rate = 1) tutarlar aynen döner.
 */
export function toTry(totals, rate = 1) {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0 || r > 1e6) fail("Döviz kuru sıfırdan büyük olmalı.", "rate");
  const micro = BigInt(Math.round(r * 1e6));
  const conv = value => {
    const v = BigInt(Math.round(Number(value) || 0));
    if (v <= 0n) return 0;
    return Number((2n * v * micro + 1000000n) / 2000000n);
  };
  const byAccount = (totals.byAccount?.length ? totals.byAccount : [{ account: "600", net: totals.net }]).map(row => ({ account: row.account, net: conv(row.net) }));
  const net = byAccount.reduce((total, row) => total + row.net, 0);
  const vat = conv(totals.vat);
  const withheld = conv(totals.withheld);
  const stoppage = conv(totals.stoppage || 0);
  return { rate: r, byAccount, net, vat, withheld, stoppage, payable: net + vat - withheld - stoppage };
}

/** SMM'de alıcının ödeyeceği net tutardan brüt ücret: brüt = net ÷ (1 − stopaj) (KDV ayrıca eklenir). */
export function grossFromNet(netAmount, stoppageRate = STOPPAGE_DEFAULT) {
  const net = Number(netAmount);
  const r = Number(stoppageRate);
  if (!Number.isFinite(net) || net <= 0 || !Number.isFinite(r) || r < 0 || r >= 100) return 0;
  return roundMoney(net / (1 - r / 100));
}

/** GİB fatura tipi: iade → IADE; tevkifatlı → TEVKIFAT; tüm kalemler istisnalı (%0, 351 dışı) → ISTISNA; yoksa SATIS. */
export function typeCode(kind, lines) {
  if (INVOICE_KINDS[kind]?.return) return "IADE";
  if (lines.some(line => line.withholdingCode)) return "TEVKIFAT";
  if (lines.length && lines.every(line => line.vatRate === 0 && line.exemptionCode && line.exemptionCode !== "351")) return "ISTISNA";
  return "SATIS";
}

/** Tutar yazıyla (e-Fatura ve kâğıt faturada zorunlu not: "Yalnız …"); döviz faturasında döviz cinsinden. */
export function amountInWords(value, currency = "TRY") {
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
  const unit = CURRENCIES[currency] || CURRENCIES.TRY;
  return `Yalnız ${words(lira)} ${unit.unit}${kurus ? ` ${words(kurus)} ${unit.sub}` : ""}`;
}

export const EPSILON = EPS;
