// Ayrıntılı Cari Ekstre (2.4.5 madde 6d; müşteri isteği M2 — eski programın "Ayrıntılı Cari Hareket Raporu"): Cari Ekstre'nin
// "Fatura Kalemlerini Göster" seçeneği. Saf: veri tabanına dokunmaz; Rapor Merkezi (routes/report-center.mjs cari-ekstre) defter
// satırlarını (finance-report statement), faturaların kalemlerini ve satırların belge no / ödeme yolunu verir, bu modül tablo modelini
// ({ headers, types, rows, marks, footers }) kurar. Ekran ön izlemesi, PDF ve Excel aynı modelden üretilir (aynı satır, aynı sayı).
//
// Düzen (yaygın muhasebe programlarının ayrıntılı cari hareket raporu: Logo / Mikro / Wolvox):
//   Devir satırı      : dönem başı bakiye; borçluysa Borç, alacaklıysa Alacak kolonunda (Genel Toplam = Devir + dönem).
//   Hareket satırı    : Tarih, Belge No, İşlem, Yol (Nakit / Havale / EFT / POS / Kredi Kartı / Çek / Senet), Açıklama, Borç, Alacak, yürüyen Bakiye.
//   Kalem satırları   : faturanın satırının ALTINDA, girintili ("› "): Ürün / Hizmet, Miktar, Birim, Birim Fiyat, İsk. %, KDV'siz Tutar
//                       (matrah, kalem ve genel iskontodan sonra), KDV %, Toplam (KDV dahil). Fatura düzeyindeki indirimler ayrı satırda ve
//                       Toplam kolonunda eksi: KDV Tevkifatı, Gelir Vergisi Stopajı. Böylece kalemlerin Toplam'ı = faturanın defterdeki
//                       borcu / alacağı (ödenecek tutar). Genel iskonto bilgi satırıdır (tutarı kalemlerin KDV'siz tutarına zaten dağıtılmıştır).
//   TOPLAM satırları  : "DÖNEM TOPLAMI" (dönem borç ve alacağı) ve "GENEL TOPLAM" (devir dahil borç, alacak ve dönem sonu bakiyesi).
// Kalem satırlarının Toplam'ı TOPLAM satırında toplanmaz (satış ve iade kalemleri karışık; para kolonları Borç / Alacak'tır).

// 2.4.7 (müşteri isteği 6b): "Kalem Açıklaması" — fatura satırının kendi açıklaması (invoice_lines.description; faturada kalemin yanındaki düğmeyle
// yazılan, o faturaya özel metin). Yalnız kalem satırında; boşsa boş. Stok kartının notu (stock_items.note) GELMEZ (kullanıcı kararı 28.10.2026).
export const DETAIL_HEADERS = Object.freeze(["Tarih", "Belge No", "İşlem", "Yol", "Açıklama / Ürün - Hizmet", "Kalem Açıklaması", "Miktar", "Birim", "Birim Fiyat", "İsk. %", "KDV'siz Tutar", "KDV %", "Toplam", "Borç", "Alacak", "Bakiye"]);
export const DETAIL_TYPES = Object.freeze(["", "", "", "", "", "", "number", "", "money", "", "money", "", "money", "money", "money", "money"]);
// TOPLAM satırlarının adının yazıldığı kolon (gizlenirse projectColumns adı ilk boş metin kolonuna taşır).
const LABEL_COLUMN = "Açıklama / Ürün - Hizmet";
const COL = Object.freeze(Object.fromEntries(DETAIL_HEADERS.map((header, index) => [header, index])));
const ITEM = "› ";
const EPS = 0.005;
const round = value => Math.round((Number(value) || 0) * 100) / 100;
const QTY = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const RATE = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
// Birim fiyat en çok dört ondalık (fatura kalemi böyle saklanır); iki ondalıktan az yazılmaz.
const PRICE = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const percent = value => `%${RATE.format(Number(value) || 0)}`;

// 2.4.7 (müşteri isteği 5): faturanın cari satırının açıklaması kayıtta "<tür adı> <numara>" diye SAKLI (routes/invoices.mjs: what = `${meta.label} ${number}`;
// faturanın borç / alacak satırı ve peşin tahsilat / ödeme satırı "… · peşin tahsilat"). Saklanan veri değişmez; yalnız bu raporda baştaki tam tür adı kısa
// adla yazılır ("Satış Faturası FIS2026…" → "Satış FIS2026…"). Yalnız faturanın kendi satırlarında (origin "invoice") ve yalnız BAŞTAKİ tür adı.
function shortNote(note, head) {
  const text = String(note ?? "");
  if (!head?.kindShort || !head.kindLabel || head.kindShort === head.kindLabel) return text;
  return text === head.kindLabel || text.startsWith(`${head.kindLabel} `) ? `${head.kindShort}${text.slice(head.kindLabel.length)}` : text;
}

const blank = () => DETAIL_HEADERS.map(() => "");
const put = (row, values) => {
  for (const [header, value] of Object.entries(values)) row[COL[header]] = value ?? "";
  return row;
};

/**
 * @param {{
 *   opening: number, openingDay: string,
 *   lines: Array<{ id, date, label, note, debit, credit, balance, origin, kind, sourceId?, receiptNo? }>,  // statement() satırları (dönem içi, yürüyen bakiyeli)
 *   invoices: Map<string, { number, kindLabel, kindShort?, currency, pricesIncludeVat, discountRate, stoppageRate, stoppage, lines: Array<{ name, code, description?, qty, unit, unitPrice, discountRate, net, vatRate, gross, withheld }> }>,
 *   extras: Map<string, { docNo?: string, way?: string }>,  // defter satırı kimliği → belge no, ödeme yolu
 *   dayText: (iso: string) => string, money: (value: number) => string, mark: (balance: number) => string,
 * }} input
 * @returns {{ headers: string[], types: string[], rows: string[][], marks: string[], footers: string[][], totals: { openingDebit, openingCredit, debit, credit, closing } }}
 */
export function detailedStatement({ opening = 0, openingDay = "", lines = [], invoices = new Map(), extras = new Map(), dayText, money, mark }) {
  const rows = [];
  const marks = [];
  const push = (row, kind = "") => {
    rows.push(row);
    marks.push(kind);
  };
  const openingDebit = opening > EPS ? round(opening) : 0;
  const openingCredit = opening < -EPS ? round(-opening) : 0;
  push(put(blank(), { Tarih: openingDay, İşlem: "Devir", "Açıklama / Ürün - Hizmet": "Dönem başı bakiye", Borç: openingDebit ? money(openingDebit) : "", Alacak: openingCredit ? money(openingCredit) : "", Bakiye: mark(opening) }), "opening");
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += Number(line.debit) || 0;
    credit += Number(line.credit) || 0;
    const extra = extras.get(line.id) || {};
    // Faturanın kendi satırı (borç / alacak; peşin tahsilatı ayrı satırdır): işlem adı belge türü, kalemler altında.
    const head = line.origin === "invoice" ? invoices.get(line.sourceId) : null;
    const invoice = head && (line.kind === "debt" || line.kind === "credit") ? head : null;
    const note = [shortNote(line.note, head), invoice?.pricesIncludeVat ? "fiyatlar KDV dahil" : ""].filter(Boolean).join(" · ");
    push(
      put(blank(), {
        Tarih: dayText(line.date),
        "Belge No": extra.docNo || "",
        // 2.4.7 (müşteri isteği 5): tür KISA adı ("Satış", "Alış", "Satıştan İade", "Alıştan İade") — fatura kesilmemiş Müşteri Fişi (FIS) de bu
        // raporda "… Faturası" diye görünmesin.
        İşlem: invoice ? invoice.kindShort || invoice.kindLabel : line.label,
        Yol: extra.way || "",
        "Açıklama / Ürün - Hizmet": note,
        Borç: line.debit ? money(line.debit) : "",
        Alacak: line.credit ? money(line.credit) : "",
        Bakiye: mark(line.balance),
      }),
      invoice ? "invoice" : "",
    );
    if (!invoice) continue;
    // Döviz faturasında kalem tutarları belgenin para birimindedir; defter (Borç / Alacak) TL karşılığıdır.
    const foreign = invoice.currency && invoice.currency !== "TRY";
    const cur = value => (foreign ? `${PRICE.format(round(value))} ${invoice.currency}` : money(round(value)));
    const price = value => (foreign ? `${PRICE.format(Number(value) || 0)} ${invoice.currency}` : `${PRICE.format(Number(value) || 0)} TL`);
    for (const item of invoice.lines) {
      push(
        put(blank(), {
          "Açıklama / Ürün - Hizmet": `${ITEM}${item.name}${item.code ? ` (${item.code})` : ""}`,
          "Kalem Açıklaması": String(item.description ?? "").trim(),
          Miktar: QTY.format(Number(item.qty) || 0),
          Birim: item.unit || "",
          "Birim Fiyat": price(item.unitPrice),
          "İsk. %": Number(item.discountRate) > 0 ? percent(item.discountRate) : "",
          "KDV'siz Tutar": cur(item.net),
          "KDV %": percent(item.vatRate),
          Toplam: cur(item.gross),
        }),
        "item",
      );
    }
    if (Number(invoice.discountRate) > 0) push(put(blank(), { "Açıklama / Ürün - Hizmet": `${ITEM}Genel İskonto ${percent(invoice.discountRate)} (kalemlerin KDV'siz tutarına dağıtıldı)` }), "item");
    const withheld = round(invoice.lines.reduce((sum, item) => sum + (Number(item.withheld) || 0), 0));
    if (withheld > EPS) push(put(blank(), { "Açıklama / Ürün - Hizmet": `${ITEM}KDV Tevkifatı`, Toplam: cur(-withheld) }), "item");
    if (Number(invoice.stoppage) > EPS) push(put(blank(), { "Açıklama / Ürün - Hizmet": `${ITEM}Gelir Vergisi Stopajı ${percent(invoice.stoppageRate)}`, Toplam: cur(-round(invoice.stoppage)) }), "item");
  }
  debit = round(debit);
  credit = round(credit);
  const closing = round(opening + debit - credit);
  const footers = [
    put(blank(), { "Açıklama / Ürün - Hizmet": "DÖNEM TOPLAMI", Borç: money(debit), Alacak: money(credit) }),
    put(blank(), { "Açıklama / Ürün - Hizmet": "GENEL TOPLAM", Borç: money(round(openingDebit + debit)), Alacak: money(round(openingCredit + credit)), Bakiye: mark(closing) }),
  ];
  return { headers: [...DETAIL_HEADERS], types: [...DETAIL_TYPES], rows, marks, footers, totals: { openingDebit, openingCredit, debit, credit, closing } };
}

/**
 * 2.4.7 (müşteri isteği 6a): kullanıcının gizlediği kolonlar çıkarılır — ekran, PDF ve Excel aynı modelden (aynı kolonlar). En az bir kolon kalır
 * (hepsi gizliyse model değişmez). Gizlenen kolonun TOPLAM hücresi de gider; kalan toplamlar aynı sayıdır (yeniden hesaplanmaz, yalnız seçilir).
 * BAŞ MİMAR KARARI: TOPLAM satırının adı ("DÖNEM TOPLAMI" / "GENEL TOPLAM") "Açıklama / Ürün - Hizmet" kolonundadır; o kolon gizlenirse ad, TOPLAM
 * satırlarında boş olan ilk görünen metin kolonuna yazılır (yoksa — yalnız tutar kolonları açıksa — adsız kalır).
 * @param {{ headers: string[], types: string[], rows: string[][], footers: string[][] }} model
 * @param {string[]} hidden  gizlenecek kolon adları (bilinmeyen ad yok sayılır)
 * @returns {object} aynı model, kolonları seçilmiş; hidden = gerçekten gizlenen adlar
 */
export function projectColumns(model, hidden = []) {
  const drop = new Set((Array.isArray(hidden) ? hidden : []).filter(name => model.headers.includes(name)));
  const keep = model.headers.map((header, index) => (drop.has(header) ? -1 : index)).filter(index => index >= 0);
  if (!drop.size || !keep.length) return { ...model, hidden: [] };
  let footers = model.footers.map(line => line.slice());
  const labelAt = model.headers.indexOf(LABEL_COLUMN);
  if (labelAt >= 0 && drop.has(LABEL_COLUMN)) {
    const target = keep.find(index => model.types[index] !== "money" && model.types[index] !== "number" && footers.every(line => !line[index]));
    if (target !== undefined) footers = footers.map(line => Object.assign(line, { [target]: line[labelAt] }));
  }
  const pick = row => keep.map(index => row[index]);
  return { ...model, headers: pick(model.headers), types: pick(model.types), rows: model.rows.map(pick), footers: footers.map(pick), hidden: model.headers.filter(header => drop.has(header)) };
}
