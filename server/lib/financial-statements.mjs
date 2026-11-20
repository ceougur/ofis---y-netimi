// Mali tabloların HESABI — ortak çekirdek (2.5.0 Ç6-HESAP; docs/erp/C6-HESAP-TASARIM.md §4, §5, §7).
// Tur 1: Gelir Tablosu (kural kitabı §4, §7.1; MSUGT, 7/A), satışların maliyeti tahmini (KG-11 A; EK-1 M6; §5.2 / N-01 defter biçimi), TEK "Kesin Değil" toplayıcısı (§7.4) ve dipnotlar
// (§7.5). Tur 2 Bilanço'yu AYNI toplayıcı ve AYNI incomeStatement çağrısıyla (hesaplanmış Dönem Net Kârı) buraya ekler.
//
// TEMEL İLKE (çekirdek planı §0): her tutar Ana Defter'in karma yevmiyesinden (routes/ledger.mjs book(): kilitli dönem donmuş defterden, açık dönem canlı türetmeden). Ayrı türetme,
// ikinci para motoru YOK; değerleme (lib/stock-valuation.mjs) yalnız dönem sonu stokunu (DSS) verir. Sınıflama HESAP ÖNEKİNDEN (Ç7b'nin 601'i ve .90 alt hesapları baştan karşılanır).
// Tutarlar kuruş tamsayı (…Minor).
import { bookTypeOf } from "./book-type.mjs";
import { BALANCE_SHEET_ITEMS, CHART, JOURNAL_CLASS, PLAN_SUBS, balanceSheetItemOf, entryClass, reverseBalanceOf } from "./general-ledger.mjs";
import { createStockValuation, loadValuationInput } from "./stock-valuation.mjs";

const CLOSING_CLASS = JOURNAL_CLASS["voucher-close"];
const PERIOD_END_CLASS = JOURNAL_CLASS["voucher-end"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** MSUGT gelir tablosu kalemleri (kural kitabı §7.1) — sıra rapordaki sıradır. gelir: alacak − borç; öbürleri borç − alacak (indirim / gider). */
export const INCOME_ITEMS = Object.freeze([
  Object.freeze({ kod: "A", ad: "Brüt Satışlar", gelir: true }),
  Object.freeze({ kod: "B", ad: "Satış İndirimleri (−)", gelir: false }),
  Object.freeze({ kod: "D", ad: "Satışların Maliyeti (−)", gelir: false }),
  Object.freeze({ kod: "E", ad: "Faaliyet Giderleri (−)", gelir: false }),
  Object.freeze({ kod: "F", ad: "Diğer Faaliyetlerden Olağan Gelir ve Kârlar", gelir: true }),
  Object.freeze({ kod: "G", ad: "Diğer Faaliyetlerden Olağan Gider ve Zararlar (−)", gelir: false }),
  Object.freeze({ kod: "H", ad: "Finansman Giderleri (−)", gelir: false }),
  Object.freeze({ kod: "I", ad: "Olağandışı Gelir ve Kârlar", gelir: true }),
  Object.freeze({ kod: "J", ad: "Olağandışı Gider ve Zararlar (−)", gelir: false }),
  Object.freeze({ kod: "K", ad: "Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−)", gelir: false }),
]);
const ITEM_BY_CODE = new Map(INCOME_ITEMS.map(item => [item.kod, item]));
/** Ara toplamlar (§7.1 / çekirdek §7). */
export const SUBTOTALS = Object.freeze([
  Object.freeze({ kod: "netSatislar", ad: "Net Satışlar", sonra: "B" }),
  Object.freeze({ kod: "brutSatisKari", ad: "Brüt Satış Kârı (Zararı)", sonra: "D" }),
  Object.freeze({ kod: "faaliyetKari", ad: "Faaliyet Kârı (Zararı)", sonra: "E" }),
  Object.freeze({ kod: "olaganKar", ad: "Olağan Kâr (Zarar)", sonra: "H" }),
  Object.freeze({ kod: "donemKari", ad: "Dönem Kârı (Zararı)", sonra: "J" }),
  Object.freeze({ kod: "donemNetKari", ad: "Dönem Net Kârı (Zararı)", sonra: "K" }),
]);
/** Gelir tablosunda satır adı kural kitabında verilmiş alt hesaplar (çekirdek §13; EK-2 S. 37 / E16). Öbürleri PLAN_SUBS adıyla. */
export const GT_SUB_NAMES = Object.freeze({ "770.90": "Sınıflandırılmamış Kasa / Banka Giderleri", "649.90": "Sınıflandırılmamış Kasa Gelirleri" });
/** 7/A gider ve yansıtma hesaplarının gelir tablosu satırı (çekirdek §13: 760 → 631, 770 → 632, 780 → 660). */
const REFLECT = Object.freeze({ 760: "631", 761: "631", 770: "632", 771: "632", 780: "660", 781: "660" });
const RANGES = Object.freeze([
  [600, 602, "A"], [610, 612, "B"], [620, 623, "D"], [630, 632, "E"], [640, 649, "F"], [653, 659, "G"], [660, 661, "H"], [671, 679, "I"], [680, 689, "J"], [691, 691, "K"],
]);

/**
 * Hesabın gelir tablosu yeri, HESAP ÖNEKİNDEN (kural kitabı §7.1): { kalem, satir } — satir, gelir tablosunda göründüğü hesap (7/A: 770 → 632). Gelir tablosu hesabı değilse null
 * (bilanço hesabı 1–5), 6 / 7 sınıfında sınıflanamayan hesap (690 / 692 kapanış, plan dışı kod) "unclassified".
 */
export function incomeLineOf(account) {
  const code = String(account ?? "").trim().slice(0, 3);
  if (!/^[67]\d\d$/.test(code)) return null;
  if (REFLECT[code]) {
    const satir = REFLECT[code];
    return { kalem: incomeLineOf(satir).kalem, satir };
  }
  const n = Number(code);
  for (const [low, high, kalem] of RANGES) if (n >= low && n <= high) return { kalem, satir: code };
  return "unclassified";
}

const isDay = value => typeof value === "string" && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const yearStart = day => `${day.slice(0, 4)}-01-01`;
const dayBefore = day => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};
/** Gelir Tablosu dönemi: geçerli iki gün, a ≤ b, aynı mali yıl (çapraz yıl tanımsız — tasarım §4 / §10 S-b). Hata { status: 400, code }. */
export function checkRange(from, to) {
  if (!isDay(from) || !isDay(to) || from > to) throw Object.assign(new Error("Geçerli bir tarih aralığı seçin."), { status: 400, code: "gelir-tablosu-aralik" });
  if (from.slice(0, 4) !== to.slice(0, 4)) {
    throw Object.assign(new Error("Gelir Tablosu dönemi tek mali yıl içinde olmalı (iki yıla taşan aralıkta satışların maliyeti tanımlı değil)."), { status: 400, code: "gelir-tablosu-tek-yil" });
  }
}
const accountName = code => CHART[code] || code;
const subName = sub => GT_SUB_NAMES[sub] || PLAN_SUBS[sub] || "Sınıflandırılmamış";
const isUnclassifiedSub = sub => typeof sub === "string" && sub.endsWith(".90");

/** 153'ün [from, to] defter hareketi (borç − alacak), dönem sonu (N-01) ve kapanış sınıfı maddeleri HARİÇ (kitap §5.2 / EK-1 M4: "153 bakiyesi − DSS" önceki yıl fişlerinden ve N-01'den önce). */
function stockFlow(entries, from, to) {
  let minor = 0;
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    const cls = entryClass(entry);
    if (cls === CLOSING_CLASS || cls === PERIOD_END_CLASS) continue;
    for (const line of entry.lines) if (line.account === "153") minor += (Number(line.debit) || 0) - (Number(line.credit) || 0);
  }
  return minor;
}

/**
 * Satışların maliyeti (tahmini) — KG-11 A, EK-1 M6: T_Y(t) = DSS_(Y−1) + 153 defter hareketi [1 Ocak Y, t] − DSS_t (t = 31 Aralık'ta T = N-01); [a, b] için T(b) − T(a − 1), a = 1 Ocak ise
 * T(a − 1) = 0. B-a (BAŞ MİMAR KARARI 19.11 22:45; tasarım §7): N-01'in 621'i (yılda 621 hareketi) YALNIZ 31.12'yi içeren parçada geçerli — o parçada tahmin T(a − 1)'in eksisidir
 * (a = 1 Ocak ise 0 → yıllık kesin), 31.12'yi içermeyen parça her zaman T(b) − T(a − 1); aylar toplamı = çeyrek = yıl = 621. a ve b aynı mali yıl (çapraz yıl tanımsız — tasarım §10 S-b;
 * çağıran reddeder). Dönüş: { estimated, posted, minor, stockFlowMinor, stockMovesMinor, differenceMinor, negative, warnings }.
 */
export function estimatedCost({ entries, valuation, from, to }) {
  const start = yearStart(to);
  const year = Number(to.slice(0, 4));
  const yearEnd = `${year}-12-31`;
  const posted621 = to === yearEnd && entries.some(entry => entry.date >= start && entry.date <= yearEnd && entryClass(entry) !== CLOSING_CLASS && entry.lines.some(line => line.account === "621"));
  const prev = valuation.yearEnd(year - 1);
  const atB = valuation.at(to);
  const T = (day, at) => prev.totals.dssMinor + stockFlow(entries, start, day) - at.totals.dssMinor;
  const first = from <= start;
  const atA = first ? null : valuation.at(dayBefore(from));
  // Stok biçimiyle karşılaştırma (tasarım §4): 153 defter hareketi ↔ stok hareketlerinin tutarı (açılış + alış − alış iadesi), [1 Ocak, b].
  const flow = stockFlow(entries, start, to);
  const tBefore = first ? 0 : T(dayBefore(from), atA);
  const minor = posted621 ? -tBefore : prev.totals.dssMinor + flow - atB.totals.dssMinor - tBefore;
  const moves = atB.totals.openingMinor + atB.totals.purchaseMinor - atB.totals.returnMinor;
  const negative = new Map();
  for (const row of [...atB.negative, ...(atA ? atA.negative : [])]) if (!negative.has(row.id)) negative.set(row.id, row);
  // S209 = B: kırpılan ürünler (t = b ve a − 1 — eksi stok gibi); tutar b'nin (yoksa a − 1'in) kırpılan değeri.
  const clipped = new Map();
  for (const row of [...atB.clipped, ...(atA ? atA.clipped : [])]) if (!clipped.has(row.id)) clipped.set(row.id, row);
  // Stoksuz dönemde (önceki yıl sonu stoku, dönem 153 hareketi ve t stoku 0) tahmin yoktur: maliyet kesin 0 (hizmet işletmesi "Satışların Maliyeti Tahminidir" uyarısı görmez).
  const involved = prev.totals.dssMinor !== 0 || atB.totals.dssMinor !== 0 || flow !== 0 || negative.size > 0 || clipped.size > 0 || (atA ? atA.totals.dssMinor !== 0 || stockFlow(entries, start, dayBefore(from)) !== 0 : false);
  return {
    estimated: posted621 ? !first && involved : involved,
    posted: posted621,
    minor,
    dssPrevMinor: prev.totals.dssMinor,
    dssMinor: atB.totals.dssMinor,
    stockFlowMinor: flow,
    stockMovesMinor: moves,
    differenceMinor: flow - moves,
    negative: [...negative.values()],
    clipped: [...clipped.values()],
    warnings: atB.warnings,
  };
}

/**
 * TEK "Kesin Değil" toplayıcısı (kural kitabı §7.4; Gelir Tablosu ve Bilanço aynı işlevi çağırır). facts: raporun kendi bulguları — verilmeyen alan denetlenmemiş sayılır (neden yazılmaz).
 * Dönüş: [{ kod, baslik, aciklama, ayrinti? }] kitabın sırasıyla.
 */
export function notFinalReasons(facts = {}) {
  const out = [];
  const add = (kod, baslik, aciklama, ayrinti) => out.push({ kod, baslik, aciklama, ...(ayrinti && ayrinti.length ? { ayrinti } : {}) });
  if (facts.openingMinor) add("tamamlanmamis-acilis", "Tamamlanmamış Açılış", "Eşleştirilecek Açılış Bakiyeleri (519) sıfır değil; açılış bakiyeleri öz sermayeye dağıtılmadı.");
  if (facts.costEstimated) add("smm-tahmini", "Satışların Maliyeti Tahminidir", "Dönem sonu stok değerlemesi yapılmadı; satışların maliyeti dönemsel ağırlıklı ortalama alış fiyatıyla tahmin edildi.");
  if (facts.reconciliation === false || facts.unbalanced > 0) {
    const parts = [];
    if (facts.unbalanced > 0) parts.push(`Dönemde borç ve alacak toplamı eşit olmayan ${facts.unbalanced} madde var.`);
    if (facts.reconciliation === false) parts.push("Ana defter ile alt defterler arasında fark var (Defter Mutabakatı).");
    add("defter-farki", "Defter Mutabakatı Farkı ya da Dengesiz Madde", parts.join(" "), facts.reconciliationDetail);
  }
  if (facts.balanceDiffMinor) add("aktif-pasif-farki", "Aktif ile Pasif Eşit Değil", `Aktif toplamı pasif toplamından ${tlText(facts.balanceDiffMinor)} farklı; fark ayrı satırda gösterildi (denkleştirme kaydı yapılmaz).`);
  if (facts.ruleDiff?.length) add("kural-farki", "Kural Değişikliği Farkı", "Kilitli dönemin donmuş defteri güncel kuralla türetilen defterden farklı; tablo donmuş defterdendir.", facts.ruleDiff);
  if (facts.negativeStock?.length) add("eksi-stok", "Eksi Stok", "Eksi miktarlı ürünler dönem sonu stokuna 0 değerle girdi.", facts.negativeStock.map(row => `${row.name} (${row.qty} ${row.unit})`.trim()));
  if (facts.clippedCost?.length) {
    add("eksi-birim-maliyet", "Eksi Birim Maliyet", "Alış iadesi alışlarından değerli olan ürünlerin birim maliyeti 0 alındı; formülün verdiği eksi değer (aşağıda) stok değerine katılmadı.", facts.clippedCost.map(row => `${row.name}: ${tlText(row.clippedMinor)}`));
  }
  if (facts.negativeBalances?.length) add("eksi-bakiye", "İmkânsız Ters Bakiye", "Eksi olamayacak hesaplarda eksi bakiye var.", facts.negativeBalances);
  if (facts.debitTax) add("borclu-360", "Borçlu Ödenecek Vergi", "Ödenecek Vergi ve Fonlar (360) borç bakiyeli; Diğer Çeşitli Dönen Varlıklar'da gösterildi.");
  if (facts.openYears?.length) add("kapanmamis-yil", "Kapanmamış Önceki Yıl", "Devri yapılmamış önceki yılların sonucu kapanış fişi görmedi.", facts.openYears.map(String));
  if (facts.vatMonths?.length) add("onceki-yil-kdv", "Önceki Yıl KDV Mahsubu Yapılmamış", "Önceki yılın bazı aylarında KDV mahsubu yapılmadı.", facts.vatMonths);
  if (facts.unclassified?.length) add("siniflandirilmamis-hesap", "Sınıflandırılmamış Hesap", "Bazı hesaplar gelir tablosunun hiçbir kalemine düşmedi; tutarları tabloya katılmadı.", facts.unclassified);
  if (facts.bookType && facts.bookType !== "balance") add("bilgi-amacli", "Bilgi Amaçlı", "Defter Türü Bilanço Esası değil; tablo resmî biçim yerine bilgi amaçlıdır.");
  return out;
}

const tlText = minor => {
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const lira = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "−" : ""}${lira},${String(abs % 100).padStart(2, "0")} TL`;
};

/** Kalıcı dipnotlar (kural kitabı §7.5; metinler AYNEN). facts: { unclassifiedExpenseMinor (770.90), unclassifiedIncomeMinor, unclassifiedCostMinor, bookType, balanceSheet }. */
export function footnotes(facts = {}) {
  const out = [
    { kod: "yasal-degil", metin: "Bu tablolar DestekOfis kayıtlarından üretilmiştir; yasal defter (e-Defter) ve beyannameye esas mali tablo, KÜMİ FRS / BOBİ FRS finansal tablosu değildir." },
    { kod: "donem-sonu", metin: "Amortisman, reeskont, gider / gelir tahakkuku, kur değerlemesi ve dönem kârı vergi karşılığı programda yapılmaz." },
    { kod: "kasa-banka-gider", metin: `Kasa ve banka 'Diğer Gider' çıkışları (${tlText(facts.cashExpenseMinor || 0)}) Genel Yönetim Giderleri'ne yazılmıştır; içinde demirbaş, ortak / sahip çekişi, müvekkil masraf avansı ya da borç ödemesi bulunabilir.`, tutarMinor: facts.cashExpenseMinor || 0 },
  ];
  if (facts.balanceSheet) out.push({ kod: "kredi-vade", metin: "Krediler vadeye bakılmaksızın Kısa Vadeli Mali Borçlar'da." });
  if (facts.bookType === "professional") out.push({ kod: "serbest-meslek", metin: "Bu tablo tahakkuk esasına göredir; serbest meslek kazancı tahsil esasına göre hesaplanır; müvekkilden harcanmak üzere alınan paralar kazanç sayılmaz." });
  if (facts.unclassifiedIncomeMinor || facts.unclassifiedCostMinor) {
    out.push({
      kod: "siniflandirilmamis",
      metin: `Faturasız / sınıflandırılmamış gelir ${tlText(facts.unclassifiedIncomeMinor || 0)}, gider ${tlText(facts.unclassifiedCostMinor || 0)} (.90 alt hesaplar).`,
      gelirMinor: facts.unclassifiedIncomeMinor || 0,
      giderMinor: facts.unclassifiedCostMinor || 0,
    });
  }
  return out;
}

/**
 * Gelir Tablosu (kural kitabı §4, §7.1). entries: book({ from: yılın 1 Ocak'ı, to }) maddeleri (fazlası süzülür); valuation: createStockValuation; bookType: Defter Türü kodu;
 * ruleDiff: snapshots.ruleDiff() sonucu (ya da null — kilit kapsamı döneme değmiyorsa). Dönüş: kalemler (hesap → alt satır), ara toplamlar, satışların maliyeti, Kesin Değil, dipnotlar.
 */
export function incomeStatement({ entries, valuation, from, to, bookType = "unset", ruleDiff = null }) {
  checkRange(from, to);
  const rows = new Map(); // satir hesabı → { kalem, hesap, parts: Map(kaynak → minor) }
  const unclassified = new Map();
  let unbalanced = 0;
  let count = 0;
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    count += 1;
    let own = 0;
    for (const line of entry.lines) own += (Number(line.debit) || 0) - (Number(line.credit) || 0);
    if (own !== 0) unbalanced += 1;
    // Kapanış sınıfı (N-02…N-07, önceki yıl sonucu — EK-2 E13) gelir tablosuna girmez; dönem sonu sınıfı (N-01) girer (kitap §4).
    if (entryClass(entry) === CLOSING_CLASS) continue;
    for (const line of entry.lines) {
      const place = incomeLineOf(line.account);
      if (!place) continue;
      const net = (Number(line.debit) || 0) - (Number(line.credit) || 0);
      if (place === "unclassified") {
        unclassified.set(line.account, (unclassified.get(line.account) || 0) + net);
        continue;
      }
      const source = isUnclassifiedSub(line.sub) ? line.sub : line.account;
      let row = rows.get(place.satir);
      if (!row) rows.set(place.satir, (row = { kalem: place.kalem, hesap: place.satir, parts: new Map() }));
      row.parts.set(source, (row.parts.get(source) || 0) + net);
    }
  }
  const cost = estimatedCost({ entries, valuation, from, to });
  const items = INCOME_ITEMS.map(item => {
    const sign = item.gelir ? -1 : 1; // gelir: alacak − borç
    const hesaplar = [...rows.values()]
      .filter(row => row.kalem === item.kod)
      .sort((a, b) => a.hesap.localeCompare(b.hesap))
      .map(row => {
        const altlar = [...row.parts.entries()]
          .map(([kaynak, net]) => ({ hesap: kaynak, ad: isUnclassifiedSub(kaynak) ? subName(kaynak) : accountName(kaynak), tutarMinor: sign * net }))
          .filter(part => part.tutarMinor !== 0)
          .sort((a, b) => a.hesap.localeCompare(b.hesap));
        return { hesap: row.hesap, ad: accountName(row.hesap), tutarMinor: altlar.reduce((sum, part) => sum + part.tutarMinor, 0), altlar };
      })
      .filter(row => row.altlar.length);
    // B-a: 621 yazılmış yılın 31.12 parçasında (a > 1 Ocak) tahmin, önceki parçalara dağıtılan maliyetin eksisidir.
    if (item.kod === "D" && cost.estimated && cost.minor !== 0) hesaplar.push({ hesap: "621", ad: cost.posted ? "Önceki Dönemlere Dağıtılan Maliyet (Tahmini)" : "Satışların Maliyeti (Tahmini)", tahmini: true, tutarMinor: cost.minor, altlar: [] });
    const out = { kod: item.kod, ad: item.ad, gelir: item.gelir, tutarMinor: hesaplar.reduce((sum, row) => sum + row.tutarMinor, 0), hesaplar };
    if (item.kod === "D" && cost.estimated) out.tahmini = true;
    if (item.kod === "K") out.aciklama = "Program dönem kârı vergi karşılığı ayırmaz; Dönem Net Kârı vergi öncesidir.";
    return out;
  });
  const of = kod => items.find(item => item.kod === kod).tutarMinor;
  const netSatislar = of("A") - of("B");
  const brutSatisKari = netSatislar - of("D");
  const faaliyetKari = brutSatisKari - of("E");
  const olaganKar = faaliyetKari + of("F") - of("G") - of("H");
  const donemKari = olaganKar + of("I") - of("J");
  const donemNetKari = donemKari - of("K");
  const subtotals = { netSatislar, brutSatisKari, faaliyetKari, olaganKar, donemKari, donemNetKari };
  // .90 alt satırların tutarları (dipnot 3, 6).
  let unclassifiedIncomeMinor = 0;
  let unclassifiedCostMinor = 0;
  let cashExpenseMinor = 0;
  for (const item of items) for (const row of item.hesaplar) for (const part of row.altlar) {
    if (!isUnclassifiedSub(part.hesap)) continue;
    if (item.gelir) unclassifiedIncomeMinor += part.tutarMinor;
    else unclassifiedCostMinor += part.tutarMinor;
    if (part.hesap === "770.90") cashExpenseMinor += part.tutarMinor;
  }
  const years = new Set([Number(from.slice(0, 4))]);
  const ruleRows = (ruleDiff?.balances || []).filter(row => years.has(Number(row.year)) && (/^[67]/.test(row.account) || row.account === "153"));
  const facts = {
    costEstimated: cost.estimated,
    unbalanced,
    ruleDiff: ruleRows.map(row => `${row.year} · ${row.account}${row.sub ? ` (${row.sub})` : ""}: ${tlText(row.differenceMinor)}`),
    negativeStock: cost.negative,
    clippedCost: cost.clipped,
    unclassified: [...unclassified.entries()].filter(([, net]) => net !== 0).map(([code, net]) => `${code}: ${tlText(net)}`),
    bookType,
  };
  const warnings = [...cost.warnings];
  if (cost.differenceMinor !== 0) warnings.push({ type: "stok-153-farki", differenceMinor: cost.differenceMinor, stockFlowMinor: cost.stockFlowMinor, stockMovesMinor: cost.stockMovesMinor });
  return {
    from,
    to,
    bookType,
    bilgiAmacli: bookType !== "balance",
    entryCount: count,
    items,
    subtotals,
    smm: { estimated: cost.estimated, posted: cost.posted, minor: cost.estimated && !cost.posted ? cost.minor : of("D"), dssPrevMinor: cost.dssPrevMinor, dssMinor: cost.dssMinor, stockFlowMinor: cost.stockFlowMinor, stockMovesMinor: cost.stockMovesMinor, differenceMinor: cost.differenceMinor },
    kesinDegil: notFinalReasons(facts),
    footnotes: footnotes({ cashExpenseMinor, unclassifiedIncomeMinor, unclassifiedCostMinor, bookType }),
    warnings,
  };
}

/**
 * Gelir Tablosu'nun Kural Değişikliği Farkı (Ç3; kitap §7.4): dönemin KİLİTLİ kısmında [from, to] (to ≤ kilit kapsamı) donmuş defterin ve güncel türetmenin gelir tablosu hesapları (6 / 7) ile
 * 153'ü (satışların maliyeti tahmini) için yıl × hesap toplamları. Tutar farkı olan satırlar döner (snapshots.ruleDiff'in balances biçimi). Madde eşleştirmesi yapılmaz — tabloyu değiştiren
 * yalnız hesap toplamıdır; bütün kilitli geçmişi karşılaştıran snapshots.ruleDiff 100.000 satırda ~2,7 sn (ölçüm: docs/kanit/2026-11-19/c6h1-hiz-parca) — Mutabakat Testi'nin "ledger:rule-diff"
 * denetimi o işi yapar. Saklanan fişler (voucher-*) iki tarafta da karşılaştırılmaz (snapshots.ruleDiff ile aynı).
 */
export function periodRuleDiff({ frozen, live, from, to, accounts = account => account === "153" || /^[67]/.test(account) }) {
  const sums = new Map();
  const add = (list, side) => {
    for (const entry of list) {
      if (entry.date < from || entry.date > to || String(entry.id).startsWith("voucher")) continue;
      for (const line of entry.lines) {
        if (!accounts(line.account)) continue;
        const key = `${entry.date.slice(0, 4)}|${line.account}`;
        const row = sums.get(key) || { frozen: 0, live: 0 };
        row[side] += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        sums.set(key, row);
      }
    }
  };
  add(frozen, "frozen");
  add(live, "live");
  const balances = [];
  for (const [key, row] of sums) {
    if (row.frozen === row.live) continue;
    const [year, account] = key.split("|");
    balances.push({ year: Number(year), account, sub: "", party: "", frozenMinor: row.frozen, liveMinor: row.live, differenceMinor: row.live - row.frozen });
  }
  balances.sort((a, b) => a.year - b.year || a.account.localeCompare(b.account));
  return { through: to, balances };
}

/**
 * Okuma ucunun ve rapor iş parçacığının ORTAK hesabı (tek kod yolu; sonuç iki yolda birebir). ledger: routes/ledger.mjs servis nesnesi (book, build, snapshots).
 * Kilit kapsamı dönemin yılına değiyorsa güncel türetme BİR kez kurulur; karma yevmiyeye ve Kural Değişikliği Farkı'na aynı nesne verilir (ikinci tam türetme yok).
 */
export function incomeStatementOf({ store, ledger, from, to }) {
  checkRange(from, to);
  const start = yearStart(from);
  const cover = ledger.snapshots?.state?.().coverage || "";
  let entries;
  let ruleDiff = null;
  if (cover && cover >= start) {
    const live = ledger.build();
    entries = ledger.book({ from: start, to, live });
    ruleDiff = periodRuleDiff({ frozen: entries, live, from: start, to: to < cover ? to : cover });
  } else entries = ledger.book({ from: start, to });
  const valuation = createStockValuation(loadValuationInput(store));
  return incomeStatement({ entries, valuation, from, to, bookType: bookTypeOf(store), ruleDiff });
}

// ---------- Bilanço (tur 2; docs/erp/C6-HESAP-TASARIM.md §6; kural kitabı §4, §7.2, §7.3, §7.4, §8; KG-11 A, KG-12 A, KG-14 A; EK-1 M4; EK-2 S. 36) ----------

/** MSUGT bilanço grupları (kitap §7.2; IV Uzun Vadeli kullanılmaz). Kalem sırası BALANCE_SHEET_ITEMS'ınkidir. */
const BALANCE_GROUPS = Object.freeze({ aktif: Object.freeze(["I", "II"]), pasif: Object.freeze(["III", "V"]) });
/** 127 (carisiz taksit kartı) alacak bakiyesi — planda "karar"; EK-2 S. 36 önerisi (tasarım §10 B-f): kart bazında Pasif III.D 340. */
const CARD_REVERSE = Object.freeze({ kural: "brut", bilanco: "III.D", hesap: "340", boyut: "cari", kesinDegil: false });
/** Hesaplanmış "Geçmiş Yıllar — Kapanmamış" satırının yeri (kitap §7.2: V.F'den sonra, V.G'den önce). */
const PRIOR_YEARS_ITEM = "V.GY";
const balanceAccount = code => /^[1-5]\d\d$/.test(String(code || ""));
const yearEndOf = year => `${String(year).padStart(4, "0")}-12-31`;

/** Hesabın Bilanço'daki ters bakiye kuralı (planın reverseBalanceOf'u; 127 için EK-2 S. 36). */
function reverseRule(account) {
  const rule = reverseBalanceOf(account);
  if (rule?.kural === "karar" && account === "127") return CARD_REVERSE;
  return rule;
}
/** Hesabın normal bakiyesi borç mu (aktif ve düzenleyici olmayan; pasif düzenleyici). */
const normalDebit = item => (item.taraf === "aktif") !== Boolean(item.duzenleyici);

/**
 * Kapanmış son yıl (tasarım §6 "KAPANMIŞ YIL"): closedOn = t'ye kadar ters kaydı yazılmamış kapanış sınıfı fişlerinin en geç tarihi (balanceSheetOf fiş tablosundan okur); verilmezse
 * maddelerin kapanış sınıfından. 31.12.K ise K (ve önceki bütün yıllar — EK-1 M4), değilse K − 1; kapanış yoksa −∞.
 */
function closedYearOf(entries, date, closedOn) {
  let day = typeof closedOn === "string" ? closedOn : "";
  if (typeof closedOn !== "string") for (const entry of entries) if (entry.date <= date && entryClass(entry) === CLOSING_CLASS && entry.date > day) day = entry.date;
  if (!day || day > date) return -Infinity;
  const year = Number(day.slice(0, 4));
  return day === yearEndOf(year) ? year : year - 1;
}

/**
 * Bilanço (asOf = date). entries: book({ to: date }) maddeleri (fazlası süzülür); valuation: createStockValuation; bookType: Defter Türü kodu; closedOn: tasarım §6 (verilmezse maddelerden);
 * ruleDiff: periodRuleDiff sonucu (kilitli dönem varsa) ya da null; reconciliation: ledger.check()'in mutabakatı (reconcile) ya da undefined (denetlenmedi); partyNames: cari kimliği → ad.
 * Dönüş: aktif / pasif (gruplar → kalemler → hesaplar), hesaplanmış iki satır, toplamlar ve fark, hesap başına defter ↔ bilanço tutarı, Kesin Değil, dipnotlar, uyarılar.
 */
export function balanceSheet({ entries, valuation, date, bookType = "unset", closedOn, ruleDiff = null, reconciliation, partyNames = null }) {
  if (!isDay(date)) throw Object.assign(new Error("Geçerli bir tarih seçin."), { status: 400, code: "bilanco-tarih" });
  const year = Number(date.slice(0, 4));
  const upto = entries.filter(entry => entry.date <= date);
  // Tek geçiş: (hesap, alt hesap, cari) → borç − alacak; dengesiz madde; 6 / 7 hareketli yıllar; planda olmayan 1–5 hesabı.
  const cells = new Map();
  const unknown = new Map();
  const activeYears = new Set();
  let unbalanced = 0;
  let firstYear = Infinity;
  for (const entry of upto) {
    let own = 0;
    const entryYear = Number(entry.date.slice(0, 4));
    if (entryYear < firstYear) firstYear = entryYear;
    for (const line of entry.lines) {
      const net = (Number(line.debit) || 0) - (Number(line.credit) || 0);
      own += net;
      const account = String(line.account);
      if (/^[67]/.test(account)) activeYears.add(entryYear);
      if (!balanceAccount(account)) continue;
      if (!balanceSheetItemOf(account)) {
        unknown.set(account, (unknown.get(account) || 0) + net);
        continue;
      }
      const key = `${account}|${line.sub || ""}|${line.party || ""}`;
      cells.set(key, (cells.get(key) || 0) + net);
    }
    if (own !== 0) unbalanced += 1;
  }
  if (valuation.firstYear !== null && valuation.firstYear !== undefined && valuation.firstYear < firstYear) firstYear = valuation.firstYear;
  const closedYear = closedYearOf(upto, date, closedOn);
  const currentOpen = year > closedYear;
  // Hesaplanmış satırlar — Gelir Tablosu'nun KENDİSİ (iki formül YOK; kitap §8, YÜKSEK-1): t'nin yılı 1 Ocak–t; kapanmamış önceki yıllar yıl yıl (KG-12 A).
  const current = currentOpen ? incomeStatement({ entries: upto, valuation, from: `${year}-01-01`, to: date, bookType, ruleDiff }) : null;
  const priorYears = [];
  for (let y = Math.max(closedYear + 1, Number.isFinite(firstYear) ? firstYear : year); y < year; y += 1) {
    const out = incomeStatement({ entries: upto, valuation, from: `${y}-01-01`, to: yearEndOf(y), bookType, ruleDiff });
    if (activeYears.has(y) || out.smm.estimated || out.subtotals.donemNetKari !== 0) priorYears.push({ yil: y, out });
  }
  // 153: t'nin yılının satışların maliyeti kesin değilse DSS_t (tahmini değerleme — kitap §5.3), kesinse (yıl kapanmış ya da N-01 yazılmış) defter.
  const stockAt = valuation.at(date);
  const stockKesin = !currentOpen || current.smm.posted;
  // Hesap bazında topla; boyut grupları (ters bakiye kuralının boyutunda).
  const accounts = new Map(); // hesap → { item, rule, minor, subs: Map, groups: Map }
  // Anahtar sırasıyla (girdi sırasından bağımsız çıktı — ders 31).
  for (const [key, minor] of [...cells.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const [account, sub, party] = key.split("|");
    let row = accounts.get(account);
    if (!row) accounts.set(account, (row = { account, item: balanceSheetItemOf(account), rule: reverseRule(account), minor: 0, subs: new Map(), groups: new Map(), parties: new Set() }));
    row.minor += minor;
    if (sub) row.subs.set(sub, (row.subs.get(sub) || 0) + minor);
    if (party) row.parties.add(party);
    const rule = row.rule;
    const dim = rule?.kural === "brut" ? (rule.boyut === "cari" ? party : rule.boyut === "altHesap" ? sub : "") : `${sub || party || ""}`;
    const group = row.groups.get(dim) || { minor: 0, sub, party, subs: new Map() };
    group.minor += minor;
    if (sub) group.subs.set(sub, (group.subs.get(sub) || 0) + minor);
    row.groups.set(dim, group);
  }
  if (!accounts.has("153") && stockAt.totals.dssMinor !== 0 && !stockKesin) {
    accounts.set("153", { account: "153", item: balanceSheetItemOf("153"), rule: reverseRule("153"), minor: 0, subs: new Map(), groups: new Map(), parties: new Set() });
  }
  // Kalemler.
  const kalemler = new Map(Object.entries(BALANCE_SHEET_ITEMS).map(([kod, item]) => [kod, { kod, ad: item.ad, taraf: item.taraf, grup: item.grup, grupAd: item.grupAd, rows: new Map() }]));
  const sideSign = taraf => (taraf === "aktif" ? 1 : -1); // aktif: borç − alacak; pasif: alacak − borç
  const rowIn = (kalemKod, hesap) => {
    const kalem = kalemler.get(kalemKod);
    let row = kalem.rows.get(hesap);
    if (!row) kalem.rows.set(hesap, (row = { hesap, ad: accountName(hesap), tutarMinor: 0, altlar: new Map(), kaynaklar: new Map(), cariSayisi: 0 }));
    return { kalem, row };
  };
  const impossible = [];
  const nameOf = party => (party.startsWith("plan:") ? "Taksit Kartı" : partyNames?.get?.(party) || "Cari");
  const distribution = new Map(); // hesap → [{ kalem, minor }] (borç − alacak yönüyle)
  const place = (account, kalemKod, hesap, minor, extra = {}) => {
    if (!minor) return;
    const { kalem, row } = rowIn(kalemKod, hesap);
    const value = sideSign(kalem.taraf) * minor;
    row.tutarMinor += value;
    if (extra.sub) row.altlar.set(extra.sub, (row.altlar.get(extra.sub) || 0) + value);
    if (hesap !== account) {
      const source = row.kaynaklar.get(account) || { hesap: account, ad: accountName(account), adet: 0, tutarMinor: 0 };
      source.adet += 1;
      source.tutarMinor += value;
      row.kaynaklar.set(account, source);
    }
    if (extra.party) row.cariSayisi += 1;
    const list = distribution.get(account) || [];
    const found = list.find(part => part.kalem === kalemKod && part.hesap === hesap);
    if (found) found.minor += minor;
    else list.push({ kalem: kalemKod, hesap, minor });
    distribution.set(account, list);
  };
  let debitTax = false;
  for (const row of [...accounts.values()].sort((a, b) => a.account.localeCompare(b.account))) {
    const { account, item, rule } = row;
    if (account === "153" && !stockKesin) {
      // KG-11 A: Ticari Mallar (Tahmini Değerleme) = DSS_t; defter bakiyesi ile fark hesaplanmış dönem sonucundadır (eksi stok ürün bazında KG-9 — değerleme).
      place(account, item.kod, "153", stockAt.totals.dssMinor);
      continue;
    }
    if (rule?.kural === "brut") {
      for (const [dim, group] of row.groups) {
        if (!group.minor) continue;
        const reversed = normalDebit(item) ? group.minor < 0 : group.minor > 0;
        const [kalemKod, hesap] = reversed ? [rule.bilanco, rule.hesap] : [item.kod, account];
        if (reversed && account === "360") debitTax = true;
        // Grup (cari / alt hesap / hesap) tek karar; tutar alt hesap kırılımıyla yerleşir. Cari sayısı satır başına bir kez.
        const party = rule.boyut === "cari" && dim ? dim : "";
        let rest = group.minor;
        let first = true;
        for (const [sub, minor] of group.subs) {
          place(account, kalemKod, hesap, minor, { sub, party: first ? party : "" });
          if (minor) first = false;
          rest -= minor;
        }
        place(account, kalemKod, hesap, rest, { party: first ? party : "" });
      }
      continue;
    }
    if (rule?.kural === "kesinDegil") {
      for (const [, group] of row.groups) {
        if (!group.minor) continue;
        if (normalDebit(item) ? group.minor < 0 : group.minor > 0) impossible.push({ account, sub: group.sub, party: group.party, minor: group.minor });
      }
    }
    // Kendi kaleminde (işaretli; düzenleyici hesap eksi görünür): alt hesap kırılımıyla.
    if (row.subs.size) {
      let rest = row.minor;
      for (const [sub, minor] of row.subs) {
        place(account, item.kod, account, minor, { sub });
        rest -= minor;
      }
      place(account, item.kod, account, rest);
    } else place(account, item.kod, account, row.minor);
    if (row.parties.size) rowIn(item.kod, account).row.cariSayisi = row.parties.size;
  }
  // Hesaplanmış satırlar (kayıt değil).
  const hesaplanmis = { donemNetKari: null, gecmisYillar: [] };
  if (current) {
    hesaplanmis.donemNetKari = { yil: year, from: current.from, to: current.to, tutarMinor: current.subtotals.donemNetKari, tahmini: current.smm.estimated };
  }
  for (const { yil, out } of priorYears) hesaplanmis.gecmisYillar.push({ yil, tutarMinor: out.subtotals.donemNetKari, tahmini: out.smm.estimated });
  // Gruplar → kalemler → hesaplar (çıktı biçimi).
  const shapeRow = row => ({
    hesap: row.hesap,
    ad: row.hesap === "153" && !stockKesin ? "Ticari Mallar (Tahmini Değerleme)" : row.ad,
    tutarMinor: row.tutarMinor,
    ...(row.hesap === "153" && !stockKesin ? { tahmini: true } : {}),
    altlar: [...row.altlar.entries()].filter(([, minor]) => minor !== 0).sort(([a], [b]) => a.localeCompare(b)).map(([hesap, tutarMinor]) => ({ hesap, ad: PLAN_SUBS[hesap] || "", tutarMinor })),
    ...(row.kaynaklar.size ? { kaynaklar: [...row.kaynaklar.values()].sort((a, b) => a.hesap.localeCompare(b.hesap)) } : {}),
    ...(row.cariSayisi ? { cariSayisi: row.cariSayisi } : {}),
  });
  const shapeItem = kalem => {
    const hesaplar = [...kalem.rows.values()].filter(row => row.tutarMinor !== 0 || row.altlar.size || row.kaynaklar.size).sort((a, b) => a.hesap.localeCompare(b.hesap)).map(shapeRow);
    const out = { kod: kalem.kod, ad: kalem.ad, hesaplar, tutarMinor: hesaplar.reduce((sum, row) => sum + row.tutarMinor, 0) };
    if (kalem.kod === "V.F" && hesaplanmis.donemNetKari) {
      hesaplar.push({ hesap: "", hesaplanmis: true, ad: "Dönem Net Kârı (Zararı)", tutarMinor: hesaplanmis.donemNetKari.tutarMinor, ...(hesaplanmis.donemNetKari.tahmini ? { tahmini: true } : {}), altlar: [] });
      out.tutarMinor += hesaplanmis.donemNetKari.tutarMinor;
    }
    return out;
  };
  const priorItem = () => {
    const kar = hesaplanmis.gecmisYillar.filter(row => row.tutarMinor > 0);
    const zarar = hesaplanmis.gecmisYillar.filter(row => row.tutarMinor < 0);
    const hesaplar = [];
    if (kar.length) hesaplar.push({ hesap: "570", ad: "Geçmiş Yıllar Kârları", hesaplanmis: true, tutarMinor: kar.reduce((sum, row) => sum + row.tutarMinor, 0), yillar: kar, altlar: [] });
    if (zarar.length) hesaplar.push({ hesap: "580", ad: "Geçmiş Yıllar Zararları (−)", hesaplanmis: true, tutarMinor: zarar.reduce((sum, row) => sum + row.tutarMinor, 0), yillar: zarar, altlar: [] });
    return { kod: PRIOR_YEARS_ITEM, ad: "Geçmiş Yıllar Kârları (Zararları) — Kapanmamış", hesaplanmis: true, hesaplar, tutarMinor: hesaplar.reduce((sum, row) => sum + row.tutarMinor, 0) };
  };
  const side = taraf => {
    const gruplar = BALANCE_GROUPS[taraf].map(grup => {
      const items = [];
      for (const kalem of kalemler.values()) {
        if (kalem.taraf !== taraf || kalem.grup !== grup) continue;
        if (kalem.kod === "V.G") items.push(priorItem());
        items.push(shapeItem(kalem));
      }
      const first = [...kalemler.values()].find(kalem => kalem.taraf === taraf && kalem.grup === grup);
      return { grup, ad: first?.grupAd || grup, kalemler: items, tutarMinor: items.reduce((sum, row) => sum + row.tutarMinor, 0) };
    });
    return { gruplar, tutarMinor: gruplar.reduce((sum, row) => sum + row.tutarMinor, 0) };
  };
  const aktif = side("aktif");
  const pasif = side("pasif");
  const farkMinor = aktif.tutarMinor - pasif.tutarMinor;
  // Hesap başına defter ↔ bilanço (borç − alacak yönüyle; brütleştirme yalnız kalem değiştirir — Σ dağılım = defter; 153 tahminiyse DSS_t).
  const accountRows = [...accounts.values()].sort((a, b) => a.account.localeCompare(b.account)).map(row => {
    const parts = distribution.get(row.account) || [];
    return { hesap: row.account, ad: accountName(row.account), defterMinor: row.minor, bilancoMinor: parts.reduce((sum, part) => sum + part.minor, 0), dagilim: [...parts].sort((x, y) => x.kalem.localeCompare(y.kalem) || x.hesap.localeCompare(y.hesap)) };
  });
  // Kesin Değil (TEK toplayıcı; kitap §7.4 sırası).
  const fmt = row => `${row.account} ${accountName(row.account)}${row.sub ? ` (${row.sub})` : ""}${row.party ? ` · ${nameOf(row.party)}` : ""}: ${tlText(row.minor)}`;
  const negativeStock = new Map();
  for (const item of stockAt.negative) negativeStock.set(item.id, item);
  const unclassified = [...unknown.entries()].filter(([, net]) => net !== 0).map(([code, net]) => `${code}: ${tlText(net)}`);
  for (const out of [current, ...priorYears.map(row => row.out)]) {
    if (!out) continue;
    for (const reason of out.kesinDegil) if (reason.kod === "siniflandirilmamis-hesap") for (const text of reason.ayrinti || []) if (!unclassified.includes(text)) unclassified.push(text);
  }
  const failedChecks = reconciliation ? (reconciliation.checks || []).filter(check => !check.ok) : [];
  const facts = {
    openingMinor: (accounts.get("519")?.minor || 0) !== 0,
    costEstimated: Boolean(current?.smm.estimated) || priorYears.some(row => row.out.smm.estimated),
    unbalanced,
    // B-d (BAŞ MİMAR 19.11 22:45): Defter Mutabakatı'nın sonucu (ledger.check() → reconcile) okunur; verilmezse denetlenmemiştir (neden yazılmaz).
    reconciliation: reconciliation ? reconciliation.ok === true : undefined,
    reconciliationDetail: [
      ...(reconciliation && reconciliation.balanced === false ? ["Ana defter dengesiz (borç ≠ alacak)."] : []),
      ...failedChecks.map(check => `${check.code} ${check.name}: defter ${tlText(Math.round(Number(check.ledger) * 100))}, alt defter ${tlText(Math.round(Number(check.subledger) * 100))} (fark ${tlText(Math.round(Number(check.difference) * 100))})`),
    ],
    balanceDiffMinor: farkMinor,
    ruleDiff: (ruleDiff?.balances || []).filter(row => Number(row.year) <= year).map(row => `${row.year} · ${row.account}${row.sub ? ` (${row.sub})` : ""}: ${tlText(row.differenceMinor)}`),
    negativeStock: [...negativeStock.values()],
    clippedCost: stockAt.clipped,
    negativeBalances: impossible.map(fmt),
    debitTax,
    openYears: priorYears.map(row => row.yil),
    unclassified,
    bookType,
  };
  const warnings = [...stockAt.warnings];
  for (const out of [current, ...priorYears.map(row => row.out)]) for (const warning of out?.warnings || []) if (warning.type === "stok-153-farki") warnings.push({ ...warning, year: Number(out.from.slice(0, 4)) });
  const gtFoot = current?.footnotes || [];
  const cashExpenseMinor = gtFoot.find(row => row.kod === "kasa-banka-gider")?.tutarMinor || 0;
  const other = gtFoot.find(row => row.kod === "siniflandirilmamis");
  return {
    date,
    year,
    bookType,
    bilgiAmacli: bookType !== "balance",
    entryCount: upto.length,
    aktif,
    pasif,
    hesaplanmis,
    toplamlar: { aktifMinor: aktif.tutarMinor, pasifMinor: pasif.tutarMinor, farkMinor },
    fark: farkMinor ? { ad: "Aktif ile Pasif Arasındaki Fark", tutarMinor: farkMinor } : null,
    accounts: accountRows,
    smm: { kesin: stockKesin, dssMinor: stockAt.totals.dssMinor, defter153Minor: accounts.get("153")?.minor || 0, closedYear: Number.isFinite(closedYear) ? closedYear : null },
    kesinDegil: notFinalReasons(facts),
    footnotes: footnotes({ cashExpenseMinor, unclassifiedIncomeMinor: other?.gelirMinor || 0, unclassifiedCostMinor: other?.giderMinor || 0, bookType, balanceSheet: true }),
    warnings,
  };
}

const hasTableIn = (store, table) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
/** Kapanmış son gün (tasarım §6): t'ye kadar ters kaydı t'ye kadar yazılmamış Kapanış / Önceki Yıl Sonucu fişlerinin (kapanış sınıfı) en geç tarihi; fiş tablosu yoksa "". */
export function closingDayOf(store, date) {
  if (!hasTableIn(store, "ledger_vouchers")) return "";
  const row = store.get(
    `SELECT MAX(v.date) AS day FROM ledger_vouchers v
     WHERE v.journal_class = 'closing' AND v.type IN ('closing', 'prior-year-result') AND v.date <= ?1
       AND NOT EXISTS (SELECT 1 FROM ledger_vouchers r WHERE r.reversal_of = v.id AND r.date <= ?1)`,
    date,
  );
  return row?.day || "";
}

/**
 * Okuma ucunun ve rapor iş parçacığının ORTAK Bilanço hesabı (tek kod yolu). ledger: routes/ledger.mjs servis nesnesi — check() (Defter Mutabakatı'nın / Mutabakat Testi'nin AYNI mutabakatı:
 * canlı türetme + alt defter beklenenleri) BİR kez; onun canlı türetmesi karma yevmiyeye (book) ve Kural Değişikliği Farkı'na verilir (ikinci tam türetme yok).
 */
export function balanceSheetOf({ store, ledger, date }) {
  if (!isDay(date)) throw Object.assign(new Error("Geçerli bir tarih seçin."), { status: 400, code: "bilanco-tarih" });
  const checked = ledger.check();
  const live = checked.entries;
  const entries = ledger.book({ to: date, live });
  // Kural Değişikliği Farkı (Ç3): kilitli kısmın [başlangıç, min(t, kapsam)] donmuş ↔ güncel türetme yıl × hesap toplamı, BÜTÜN hesaplar (Bilanço 1–5'i, hesaplanmış satırlar 6 / 7'yi okur).
  const cover = ledger.snapshots?.state?.().coverage || "";
  const ruleDiff = cover ? periodRuleDiff({ frozen: entries, live, from: "", to: date < cover ? date : cover, accounts: () => true }) : null;
  const valuation = createStockValuation(loadValuationInput(store));
  const names = new Map();
  const partyNames = {
    get(id) {
      if (!names.has(id)) names.set(id, hasTableIn(store, "accounts") ? store.get("SELECT name FROM accounts WHERE id = ?", id)?.name || "" : "");
      return names.get(id);
    },
  };
  return balanceSheet({ entries, valuation, date, bookType: bookTypeOf(store), closedOn: closingDayOf(store, date), ruleDiff, reconciliation: checked.reconciliation, partyNames });
}

/** Değerleme okuma ucu (D3 / D4 / sürücü): t günü sonu, ürün ayrıntısıyla; önceki yıl sonunun toplamları (DBS). */
export function stockValuationOf({ store, date }) {
  if (!isDay(date)) throw Object.assign(new Error("Geçerli bir tarih seçin."), { status: 400, code: "degerleme-tarih" });
  const valuation = createStockValuation(loadValuationInput(store));
  return { ...valuation.at(date, { detail: true }), previousYearEnd: valuation.yearEnd(Number(date.slice(0, 4)) - 1).totals };
}
