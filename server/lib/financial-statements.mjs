// Mali tabloların HESABI — ortak çekirdek (2.5.0 Ç6-HESAP; docs/erp/C6-HESAP-TASARIM.md §4, §5, §7).
// Tur 1: Gelir Tablosu (kural kitabı §4, §7.1; MSUGT, 7/A), satışların maliyeti tahmini (KG-11 A; EK-1 M6; §5.2 / N-01 defter biçimi), TEK "Kesin Değil" toplayıcısı (§7.4) ve dipnotlar
// (§7.5). Tur 2 Bilanço'yu AYNI toplayıcı ve AYNI incomeStatement çağrısıyla (hesaplanmış Dönem Net Kârı) buraya ekler.
//
// TEMEL İLKE (çekirdek planı §0): her tutar Ana Defter'in karma yevmiyesinden (routes/ledger.mjs book(): kilitli dönem donmuş defterden, açık dönem canlı türetmeden). Ayrı türetme,
// ikinci para motoru YOK; değerleme (lib/stock-valuation.mjs) yalnız dönem sonu stokunu (DSS) verir. Sınıflama HESAP ÖNEKİNDEN (Ç7b'nin 601'i ve .90 alt hesapları baştan karşılanır).
// Tutarlar kuruş tamsayı (…Minor).
import { bookTypeOf } from "./book-type.mjs";
import { BALANCE_SHEET_ITEMS, CHART, JOURNAL_CLASS, PLAN_SUBS, balanceSheetItemOf, entryClass, reverseBalanceOf } from "./general-ledger.mjs";
import { ruleDiffCorrectionPlan, ruleDiffCorrectionYear } from "./ledger-opening.mjs";
import { frozenSums } from "./ledger-snapshots.mjs";
import { voucherNoText } from "./ledger-vouchers.mjs";
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
const dayAfter = day => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
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
export function estimatedCost({ entries, valuation, from, to, frozen = null }) {
  const start = yearStart(to);
  // B-g (b): donmuş dönemin yıl toplamı (frozenPartOf; kısım 0 = [1 Ocak, a − 1], kısım 1 = [a, …]) + kapsam sonrası maddeler.
  const flowOf = (day, list) => stockFlow(list, start, day) + (!frozen ? 0 : day >= frozen.split ? frozen.flow153[0] + frozen.flow153[1] : frozen.flow153[0]);
  const year = Number(to.slice(0, 4));
  const yearEnd = `${year}-12-31`;
  const posted621 = to === yearEnd && (Boolean(frozen?.has621) || entries.some(entry => entry.date >= start && entry.date <= yearEnd && entryClass(entry) !== CLOSING_CLASS && entry.lines.some(line => line.account === "621")));
  const prev = valuation.yearEnd(year - 1);
  const atB = valuation.at(to);
  const T = (day, at) => prev.totals.dssMinor + flowOf(day, entries) - at.totals.dssMinor;
  const first = from <= start;
  const atA = first ? null : valuation.at(dayBefore(from));
  // Stok biçimiyle karşılaştırma (tasarım §4): 153 defter hareketi ↔ stok hareketlerinin tutarı (açılış + alış − alış iadesi), [1 Ocak, b].
  const flow = flowOf(to, entries);
  const tBefore = first ? 0 : T(dayBefore(from), atA);
  const minor = posted621 ? -tBefore : prev.totals.dssMinor + flow - atB.totals.dssMinor - tBefore;
  const moves = atB.totals.openingMinor + atB.totals.purchaseMinor - atB.totals.returnMinor;
  const negative = new Map();
  for (const row of [...atB.negative, ...(atA ? atA.negative : [])]) if (!negative.has(row.id)) negative.set(row.id, row);
  // S209 = B: kırpılan ürünler (t = b ve a − 1 — eksi stok gibi); tutar b'nin (yoksa a − 1'in) kırpılan değeri.
  const clipped = new Map();
  for (const row of [...atB.clipped, ...(atA ? atA.clipped : [])]) if (!clipped.has(row.id)) clipped.set(row.id, row);
  // Stoksuz dönemde (önceki yıl sonu stoku, dönem 153 hareketi ve t stoku 0) tahmin yoktur: maliyet kesin 0 (hizmet işletmesi "Satışların Maliyeti Tahminidir" uyarısı görmez).
  const involved = prev.totals.dssMinor !== 0 || atB.totals.dssMinor !== 0 || flow !== 0 || negative.size > 0 || clipped.size > 0 || (atA ? atA.totals.dssMinor !== 0 || flowOf(dayBefore(from), entries) !== 0 : false);
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
  if (facts.ruleDiff?.length) {
    // Tur 4 (ORTA-2; tasarım §11.2): Kural Farkı Düzeltme Fişi'nden sonra kalan fark — ayrıntı Yönetim'in düzeltme planının KALANI (fiş satırı biçiminde).
    const text = facts.ruleDiffRemainder
      ? "Kilitli dönemin donmuş defteri ile güncel kural arasındaki farkın Kural Farkı Düzeltme Fişi'yle kapanmamış kısmı aşağıdadır (Yönetim › Sistem › Kural Farkı Düzeltme); tablo donmuş defterdendir."
      : "Kilitli dönemin donmuş defteri güncel kuralla türetilen defterden farklı; tablo donmuş defterdendir.";
    add("kural-farki", "Kural Değişikliği Farkı", text, facts.ruleDiff);
  }
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
export function incomeStatement({ entries, valuation, from, to, bookType = "unset", ruleDiff = null, frozen = null, correction = null }) {
  checkRange(from, to);
  // B-g (b): frozen = donmuş dönemin bu yılının toplamları (frozenPartOf); entries o zaman yalnız kapsam sonrası maddeler. Kısım ayracı a olmalı (a = 1 Ocak'ta "" de olur).
  if (frozen && frozen.split !== from && !(from === yearStart(from) && frozen.split <= from)) throw new Error(`donmuş toplamın kısım ayracı (${frozen.split}) dönem başı (${from}) değil`);
  const rows = new Map(); // satir hesabı → { kalem, hesap, parts: Map(kaynak → minor) }
  const unclassified = new Map();
  let unbalanced = frozen ? frozen.unbalanced : 0;
  let count = frozen ? frozen.entries : 0;
  const addLine = (account, sub, net) => {
    const place = incomeLineOf(account);
    if (!place) return;
    if (place === "unclassified") {
      unclassified.set(account, (unclassified.get(account) || 0) + net);
      return;
    }
    const source = isUnclassifiedSub(sub) ? sub : account;
    let row = rows.get(place.satir);
    if (!row) rows.set(place.satir, (row = { kalem: place.kalem, hesap: place.satir, parts: new Map() }));
    row.parts.set(source, (row.parts.get(source) || 0) + net);
  };
  if (frozen) {
    for (const account of frozen.unclassifiedOrder) unclassified.set(account, 0); // ilk görünüş sırası (eski okumayla aynı ayrıntı sırası)
    for (const { account, sub, net } of frozen.income) addLine(account, sub, net);
  }
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    count += 1;
    let own = 0;
    for (const line of entry.lines) own += (Number(line.debit) || 0) - (Number(line.credit) || 0);
    if (own !== 0) unbalanced += 1;
    // Kapanış sınıfı (N-02…N-07, önceki yıl sonucu — EK-2 E13) gelir tablosuna girmez; dönem sonu sınıfı (N-01) girer (kitap §4).
    if (entryClass(entry) === CLOSING_CLASS) continue;
    for (const line of entry.lines) addLine(line.account, line.sub, (Number(line.debit) || 0) - (Number(line.credit) || 0));
  }
  const cost = estimatedCost({ entries, valuation, from, to, frozen });
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
  // Tur 4 (ORTA-1): yıl × hesap × alt hesap (Bilanço'nun cari boyutlu satırları burada toplanır — Gelir Tablosu cari göstermez).
  const ruleSums = new Map();
  for (const row of ruleDiff?.balances || []) {
    if (!years.has(Number(row.year)) || !(/^[67]/.test(row.account) || row.account === "153")) continue;
    const key = `${row.year}|${row.account}|${row.sub || ""}`;
    const item = ruleSums.get(key) || { year: row.year, account: row.account, sub: row.sub || "", differenceMinor: 0 };
    item.differenceMinor += row.differenceMinor;
    ruleSums.set(key, item);
  }
  const ruleRows = [...ruleSums.values()].filter(row => row.differenceMinor !== 0);
  const rule = ruleFacts(ruleRows.map(row => `${row.year} · ${row.account}${row.sub ? ` (${row.sub})` : ""}: ${tlText(row.differenceMinor)}`), correction);
  const facts = {
    costEstimated: cost.estimated,
    unbalanced,
    ruleDiff: rule.ruleDiff,
    ruleDiffRemainder: rule.remainder,
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
    ...(rule.bilgi.length ? { bilgi: rule.bilgi } : {}),
    footnotes: footnotes({ cashExpenseMinor, unclassifiedIncomeMinor, unclassifiedCostMinor, bookType }),
    warnings,
  };
}

// ---------- Tur 4 (ORTA-2; tasarım §11.2): Kural Farkı Düzeltme Fişi'nden sonra KALAN (Yönetim'in planıyla AYNI tanım; hızlı yol) ----------

/**
 * t gününe kadar yazılmış Kural Farkı Düzeltme Fişleri: lib/ledger-opening.mjs postedRuleDiffCorrections'ın sorgusu AYNEN + tarih süzgeci (fiş ve ters kaydı t'ye kadar; t'deki tablo
 * yalnız onları içerir). byYear: fişin KENDİ yılına göre hesap|alt hesap → kuruş (ters kaydın satırları asıl fişin yılına — S174 = A); active: ters kaydı t'ye kadar yazılmamış fişler.
 * t uzak gelecekken postedRuleDiffCorrections ile birebir (eşdeğerlik testi).
 */
export function postedCorrectionsAt(store, date) {
  const empty = { any: false, byYear: new Map(), active: [] };
  if (!hasTableIn(store, "ledger_vouchers") || !hasTableIn(store, "ledger_voucher_lines")) return empty;
  if (!store.get("SELECT 1 AS found FROM ledger_vouchers WHERE type = 'rule-diff-correction' AND date <= ? LIMIT 1", date)) return empty;
  const byYear = new Map();
  for (const row of store.all(
    `SELECT CAST(substr(COALESCE(o.date, v.date), 1, 4) AS INTEGER) AS year, l.account, l.sub, SUM(l.debit_minor - l.credit_minor) AS net
     FROM ledger_vouchers v CROSS JOIN ledger_voucher_lines l ON l.voucher_id = v.id LEFT JOIN ledger_vouchers o ON v.type = 'reversal' AND o.id = v.reversal_of
     WHERE v.date <= ?1 AND (v.type = 'rule-diff-correction' OR (v.type = 'reversal' AND o.type = 'rule-diff-correction'))
     GROUP BY 1, l.account, l.sub`,
    date,
  )) {
    if (!Number(row.net)) continue;
    const year = Number(row.year);
    if (!byYear.has(year)) byYear.set(year, new Map());
    byYear.get(year).set(`${row.account}|${row.sub || ""}`, Number(row.net));
  }
  const active = store
    .all("SELECT v.id, v.year, v.no, v.date FROM ledger_vouchers v WHERE v.type = 'rule-diff-correction' AND v.date <= ?1 AND NOT EXISTS (SELECT 1 FROM ledger_vouchers r WHERE r.reversal_of = v.id AND r.date <= ?1) ORDER BY v.date, v.rowid", date)
    .map(row => ({ id: row.id, year: Number(row.year), no: Number(row.no), date: row.date }));
  return { any: true, byYear, active };
}

/**
 * KALAN (saf). diff: periodRuleDiff({ party: true }) — kapsamın TAMAMI [başlangıç, kapsam], bütün hesaplar (snapshots.ruleDiff'in balances'ı ile aynı küme); posted: postedCorrectionsAt;
 * subledger: alt defter hesapları (routes/ledger.mjs subledgerAccounts'ın tanımı: expected([], [], { every: true }) anahtarları); lock / cover: dönem kilidi ve kapsam; accounts: tablonun
 * okuduğu hesaplar (Gelir Tablosu 6 / 7 ve 153). Planın girdisi anahtar başına tek "madde": plan toplamları (yıl, hesap, alt) bazında delta toplamıdır; madde ayrımı yalnız alt defter
 * dışlamasında kullanılır ve o yalnız bir alt defter anahtarının birikimli farkı ≠ 0 iken başlar → o durumda KALAN ≠ 0 kesin, ayrıntı madde düzeyi ister (yavaş yol) → exact: false (çağıran
 * ham farkı yazar). Etkin fiş yoksa null (davranış eski).
 * Dönüş: { exact, corrected, vouchers: ["Fiş 2026-000001"], lines: [{ account, sub, debit, credit }], over: [{ year, minor }] }.
 */
export function ruleDiffRemainder({ diff, posted, subledger, lock = "", cover = "", accounts = () => true }) {
  if (!posted?.active?.length) return null;
  const vouchers = posted.active.map(voucher => voucherNoText(voucher.year, voucher.no));
  const cumulative = new Map();
  for (const row of diff?.balances || []) {
    if (!subledger.has(row.account)) continue;
    const key = `${row.account}|${row.sub || ""}|${row.party || ""}`;
    cumulative.set(key, (cumulative.get(key) || 0) + row.differenceMinor);
  }
  if ([...cumulative.values()].some(minor => minor !== 0)) return { exact: false, corrected: false, vouchers, lines: [], over: [] };
  const entries = (diff?.balances || []).map((row, index) => ({ id: `rule-diff-key:${index}`, date: "", deltas: [{ year: row.year, account: row.account, sub: row.sub || "", party: row.party || "", minor: row.differenceMinor }] }));
  const plan = ruleDiffCorrectionPlan({ diff: { entries }, subledger, year: ruleDiffCorrectionYear({ lock, cover }), postedByYear: posted.byYear });
  const lines = plan.lines.filter(line => accounts(line.account));
  const over = plan.ownYearOver || [];
  return { exact: true, corrected: !lines.length && !over.length, vouchers, lines, over };
}

/** Ham fark satırları + KALAN → Kesin Değil ayrıntısı ve bilgi satırı (Gelir Tablosu ve Bilanço AYNI işlev). */
function ruleFacts(rawRows, correction) {
  if (!correction?.exact) return { ruleDiff: rawRows, remainder: false, bilgi: [] };
  if (correction.corrected) {
    if (!rawRows.length) return { ruleDiff: [], remainder: false, bilgi: [] };
    return {
      ruleDiff: [],
      remainder: false,
      bilgi: [{ kod: "kural-farki-duzeltildi", baslik: `Kural Farkı Düzeltildi (${correction.vouchers.join(", ")})`, aciklama: "Kilitli dönemin kural değişikliği farkı Kural Farkı Düzeltme Fişi ile düzeltildi; kilitli dönemin tutarları donmuş defterdendir, düzeltme fişin tarihindedir." }],
    };
  }
  const lines = correction.lines.map(line => `${line.account}${line.sub ? ` (${line.sub})` : ""}: ${tlText(line.debit - line.credit)}`);
  for (const row of correction.over) lines.push(`${row.year} · Fazla Düzeltme (${correction.vouchers.join(", ")}): ${tlText(row.minor)}`);
  return { ruleDiff: lines, remainder: true, bilgi: [] };
}

/** Kapsamın TAMAMININ kural farkı (bütün hesaplar, cari boyutlu) — KALAN'ın girdisi. */
const fullRuleDiff = (store, live, cover) => periodRuleDiff({ frozen: [], frozenSums: frozenPartOf(frozenSums(store, { from: "", through: cover })), live, from: "", to: cover, accounts: () => true, party: true });
const subledgerOf = ledger => new Set(Object.keys(ledger.expected ? ledger.expected([], [], { every: true }) : {}));

/**
 * Gelir Tablosu'nun Kural Değişikliği Farkı (Ç3; kitap §7.4): dönemin KİLİTLİ kısmında [from, to] (to ≤ kilit kapsamı) donmuş defterin ve güncel türetmenin gelir tablosu hesapları (6 / 7) ile
 * 153'ü (satışların maliyeti tahmini) için yıl × hesap × alt hesap (party: × cari — Bilanço) toplamları. Tutar farkı olan satırlar döner (snapshots.ruleDiff'in balances biçimi). Madde
 * eşleştirmesi yapılmaz — tabloyu değiştiren hesap, alt hesap (.90 satırları, dipnot 3 / 6) ve Bilanço'da cari toplamıdır (tur 4, ORTA-1: önceki "yalnız hesap toplamı" okuması yanlıştı); bütün kilitli geçmişi karşılaştıran snapshots.ruleDiff 100.000 satırda ~2,7 sn (ölçüm: docs/kanit/2026-11-19/c6h1-hiz-parca) — Mutabakat Testi'nin "ledger:rule-diff"
 * denetimi o işi yapar. Saklanan fişler (voucher-*) iki tarafta da karşılaştırılmaz (snapshots.ruleDiff ile aynı).
 */
export function periodRuleDiff({ frozen, live, from, to, accounts = account => account === "153" || /^[67]/.test(account), frozenSums: summary = null, party = false }) {
  const sums = new Map();
  // Tur 4 (ORTA-1; tasarım §11.1): anahtar yıl × hesap × ALT HESAP (party: Bilanço — × cari); snapshots.ruleDiff'in balances anahtarıyla aynı.
  const keyOf = (year, account, sub, who) => `${year}|${account}|${sub || ""}${party ? `|${who || ""}` : ""}`;
  // B-g (b): donmuş taraf toplamlardan (frozenPartOf — [from, to] aralığının TAMAMI; kimliği "voucher" ile başlayan maddeler hariç); frozen o zaman yalnız kapsam sonrası maddeler (aralık dışı).
  if (summary) {
    for (const [year, part] of summary.years) {
      for (const [cell, net] of part.rule) {
        const [account, sub, who] = cell.split("|");
        if (!accounts(account)) continue;
        const key = keyOf(String(year).padStart(4, "0"), account, sub, who);
        const row = sums.get(key) || { frozen: 0, live: 0 };
        row.frozen += net;
        sums.set(key, row);
      }
    }
  }
  const add = (list, side) => {
    for (const entry of list) {
      if (entry.date < from || entry.date > to || String(entry.id).startsWith("voucher")) continue;
      for (const line of entry.lines) {
        if (!accounts(line.account)) continue;
        const key = keyOf(entry.date.slice(0, 4), line.account, line.sub, line.party);
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
    const [year, account, sub, who = ""] = key.split("|");
    balances.push({ year: Number(year), account, sub, party: who, frozenMinor: row.frozen, liveMinor: row.live, differenceMinor: row.live - row.frozen });
  }
  balances.sort((a, b) => a.year - b.year || a.account.localeCompare(b.account) || a.sub.localeCompare(b.sub) || a.party.localeCompare(b.party));
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
  let frozen = null;
  let correction = null;
  if (cover && cover >= start) {
    const live = ledger.build();
    // B-g (b) (tasarım §8): dönemin kilitli kısmı [1 Ocak, min(b, kapsam)] donmuş TOPLAMLARDAN (kısım ayracı a), kapsamın sonrası karma yevmiyenin kuyruğundan.
    const through = to < cover ? to : cover;
    const part = frozenPartOf(frozenSums(store, { from: start, through, split: from }));
    entries = to > cover ? ledger.book({ from: dayAfter(cover), to, live }) : [];
    ruleDiff = periodRuleDiff({ frozen: entries, frozenSums: part, live, from: start, to: through });
    frozen = part.years.get(Number(start.slice(0, 4))) || emptyFrozenYear(Number(start.slice(0, 4)), from);
    // Tur 4 (ORTA-2; tasarım §11.2): Kural Farkı Düzeltme Fişi [a, b] İÇİNDEYSE KALAN (tablonun hesapları: 6 / 7 ve 153); dışındaysa neden AYNEN.
    const posted = postedCorrectionsAt(store, to);
    if (posted.active.some(voucher => voucher.date >= from)) {
      const lock = ledger.snapshots?.state?.().lock || "";
      correction = ruleDiffRemainder({ diff: fullRuleDiff(store, live, cover), posted, subledger: subledgerOf(ledger), lock, cover, accounts: account => account === "153" || /^[67]/.test(account) });
    }
  } else entries = ledger.book({ from: start, to });
  const valuation = createStockValuation(loadValuationInput(store));
  return incomeStatement({ entries, valuation, from, to, bookType: bookTypeOf(store), ruleDiff, frozen, correction });
}

// ---------- B-g (b): donmuş dönemin toplamları (tur 3; tasarım §8 "B-g (b) TASARIMI") ----------

const emptyFrozenYear = (year, split) => ({ year, split, entries: 0, unbalanced: 0, income: [], flow153: [0, 0], has621: false, any67: false, rule: new Map(), unclassifiedOrder: [] });

/**
 * ledger-snapshots frozenSums() çıktısından raporların girdisi: yıl başına { madde ve dengesiz madde sayısı (kısım 1), Gelir Tablosu satırları (6 / 7, kapanış sınıfı hariç, kısım 1:
 * hesap × alt hesap), 153 akışı (kapanış ve dönem sonu sınıfı hariç; [kısım 0, kısım 1]), 621 satırı var mı (kapanış hariç), 6 / 7 satırı var mı (her sınıf), Kural Değişikliği Farkı'nın donmuş
 * tarafı (hesap → net; kimliği "voucher" ile başlayanlar hariç), sınıflandırılmamış 6 / 7 hesaplarının ilk görünüş sırası }, Bilanço hücreleri (hesap × alt hesap × cari → net; bütün yıllar),
 * kapanış sınıfının en geç günü, planda olmayan 1–5 hesaplarının ilk görünüş sırası. Sınıf = kimlik önekinden (donmuş maddenin entryClass'ı gibi).
 */
export function frozenPartOf(sums) {
  const years = new Map();
  const yearOf = year => {
    let part = years.get(year);
    if (!part) years.set(year, (part = emptyFrozenYear(year, sums.split)));
    return part;
  };
  const cells = new Map();
  const income = new Map(); // yıl|hesap|alt → { account, sub, net }
  const candidates = new Set();
  let closingDay = "";
  for (const row of sums.groups) {
    const part = yearOf(row.year);
    const cls = JOURNAL_CLASS[row.prefix] ?? 90;
    const key = `${row.account}|${row.sub}|${row.party}`;
    const cell = cells.get(key);
    if (cell) cell.net += row.net;
    else cells.set(key, { account: row.account, sub: row.sub, party: row.party, net: row.net });
    if (/^[67]/.test(row.account)) part.any67 = true;
    if (balanceAccount(row.account) && !balanceSheetItemOf(row.account)) candidates.add(row.account);
    if (!row.voucher) {
      const ruleKey = `${row.account}|${row.sub}|${row.party}`; // tur 4 (ORTA-1): alt hesap ve cari boyutu (periodRuleDiff seçer)
      part.rule.set(ruleKey, (part.rule.get(ruleKey) || 0) + row.net);
    }
    if (cls === CLOSING_CLASS) {
      if (row.last > closingDay) closingDay = row.last;
      continue;
    }
    if (row.account === "621") part.has621 = true;
    if (cls !== PERIOD_END_CLASS && row.account === "153") part.flow153[row.part === 1 ? 1 : 0] += row.net;
    if (row.part !== 1) continue;
    const place = incomeLineOf(row.account);
    if (!place) continue;
    if (place === "unclassified") candidates.add(row.account);
    const incomeKey = `${row.year}|${row.account}|${row.sub}`;
    const line = income.get(incomeKey);
    if (line) line.net += row.net;
    else income.set(incomeKey, { year: row.year, account: row.account, sub: row.sub, net: row.net });
  }
  for (const line of income.values()) yearOf(line.year).income.push({ account: line.account, sub: line.sub, net: line.net });
  for (const row of sums.entries) {
    if (row.part !== 1) continue;
    const part = yearOf(row.year);
    part.entries += row.entries;
    part.unbalanced += row.unbalanced;
  }
  // Sınıflandırılmamış hesapların ilk görünüş sırası (Kesin Değil ayrıntısının sırası eski okumayla aynı; seyrek — çoğu veride sorgu yok).
  const unknownOrder = [];
  if (candidates.size) {
    const seenUnknown = new Set();
    const seenIncome = new Set();
    for (const row of sums.firstSeen([...candidates])) {
      if (balanceAccount(row.account) && !balanceSheetItemOf(row.account) && !seenUnknown.has(row.account)) {
        seenUnknown.add(row.account);
        unknownOrder.push(row.account);
      }
      const cls = JOURNAL_CLASS[row.prefix] ?? 90;
      if (row.part !== 1 || cls === CLOSING_CLASS || incomeLineOf(row.account) !== "unclassified") continue;
      const key = `${row.year}|${row.account}`;
      if (seenIncome.has(key)) continue;
      seenIncome.add(key);
      yearOf(row.year).unclassifiedOrder.push(row.account);
    }
  }
  return { from: sums.from, through: sums.through, split: sums.split, years, cells: [...cells.values()], closingDay, unknownOrder };
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
function closedYearOf(entries, date, closedOn, frozenDay = "") {
  let day = typeof closedOn === "string" ? closedOn : frozenDay;
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
export function balanceSheet({ entries, valuation, date, bookType = "unset", closedOn, ruleDiff = null, reconciliation, partyNames = null, frozen = null, correction = null }) {
  if (!isDay(date)) throw Object.assign(new Error("Geçerli bir tarih seçin."), { status: 400, code: "bilanco-tarih" });
  const year = Number(date.slice(0, 4));
  const upto = entries.filter(entry => entry.date <= date);
  // Tek geçiş: (hesap, alt hesap, cari) → borç − alacak; dengesiz madde; 6 / 7 hareketli yıllar; planda olmayan 1–5 hesabı.
  const cells = new Map();
  const unknown = new Map();
  const activeYears = new Set();
  const byYear = new Map(); // yıl → o yılın maddeleri (Gelir Tablosu çağrıları yalnız kendi yılını okur — sonuç aynı, geçiş sayısı yıl başına bir)
  let unbalanced = 0;
  let firstYear = Infinity;
  let frozenEntries = 0;
  // B-g (b): frozen = donmuş dönemin [başlangıç, min(t, kapsam)] toplamları (frozenPartOf; kısım ayracı ""), entries o zaman yalnız kapsam sonrası maddeler.
  if (frozen) {
    for (const account of frozen.unknownOrder) unknown.set(account, 0); // ilk görünüş sırası
    for (const { account, sub, party, net } of frozen.cells) {
      if (!balanceAccount(account)) continue;
      if (!balanceSheetItemOf(account)) {
        unknown.set(account, (unknown.get(account) || 0) + net);
        continue;
      }
      const key = `${account}|${sub}|${party}`;
      cells.set(key, (cells.get(key) || 0) + net);
    }
    for (const [frozenYear, part] of frozen.years) {
      if (part.any67) activeYears.add(frozenYear);
      unbalanced += part.unbalanced;
      frozenEntries += part.entries;
      if (frozenYear < firstYear) firstYear = frozenYear;
    }
  }
  for (const entry of upto) {
    let own = 0;
    const entryYear = Number(entry.date.slice(0, 4));
    let bucket = byYear.get(entryYear);
    if (!bucket) byYear.set(entryYear, (bucket = []));
    bucket.push(entry);
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
  const closedYear = closedYearOf(upto, date, closedOn, frozen?.closingDay || "");
  const currentOpen = year > closedYear;
  // Hesaplanmış satırlar — Gelir Tablosu'nun KENDİSİ (iki formül YOK; kitap §8, YÜKSEK-1): t'nin yılı 1 Ocak–t; kapanmamış önceki yıllar yıl yıl (KG-12 A).
  const current = currentOpen ? incomeStatement({ entries: byYear.get(year) || [], valuation, from: `${year}-01-01`, to: date, bookType, ruleDiff, frozen: frozen?.years.get(year) || null }) : null;
  const priorYears = [];
  for (let y = Math.max(closedYear + 1, Number.isFinite(firstYear) ? firstYear : year); y < year; y += 1) {
    const out = incomeStatement({ entries: byYear.get(y) || [], valuation, from: `${y}-01-01`, to: yearEndOf(y), bookType, ruleDiff, frozen: frozen?.years.get(y) || null });
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
      if (extra.count !== false) source.adet += 1; // grup (cari / alt hesap) başına bir kez
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
          place(account, kalemKod, hesap, minor, { sub, party: first ? party : "", count: first });
          if (minor) first = false;
          rest -= minor;
        }
        place(account, kalemKod, hesap, rest, { party: first ? party : "", count: first });
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
  // Tur 4 (ORTA-2): t'ye kadar yazılmış Kural Farkı Düzeltme Fişi varsa KALAN (Yönetim'in planı) — 0 ise neden yerine bilgi satırı.
  const rule = ruleFacts((ruleDiff?.balances || []).filter(row => Number(row.year) <= year).map(row => `${row.year} · ${row.account}${row.sub ? ` (${row.sub})` : ""}${row.party ? ` · ${nameOf(row.party)}` : ""}: ${tlText(row.differenceMinor)}`), correction);
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
    ruleDiff: rule.ruleDiff,
    ruleDiffRemainder: rule.remainder,
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
    entryCount: frozenEntries + upto.length,
    aktif,
    pasif,
    hesaplanmis,
    toplamlar: { aktifMinor: aktif.tutarMinor, pasifMinor: pasif.tutarMinor, farkMinor },
    fark: farkMinor ? { ad: "Aktif ile Pasif Arasındaki Fark", tutarMinor: farkMinor } : null,
    accounts: accountRows,
    smm: { kesin: stockKesin, dssMinor: stockAt.totals.dssMinor, defter153Minor: accounts.get("153")?.minor || 0, closedYear: Number.isFinite(closedYear) ? closedYear : null },
    kesinDegil: notFinalReasons(facts),
    ...(rule.bilgi.length ? { bilgi: rule.bilgi } : {}),
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
  const cover = ledger.snapshots?.state?.().coverage || "";
  // B-g (b) (tasarım §8): kilitli kısım [başlangıç, min(t, kapsam)] donmuş TOPLAMLARDAN (madde madde okunmaz), kapsamın sonrası karma yevmiyenin kuyruğundan (book; bekleyen koşunun ara dilimi dahil).
  const through = cover ? (date < cover ? date : cover) : "";
  const frozen = cover ? frozenPartOf(frozenSums(store, { from: "", through })) : null;
  const entries = !cover ? ledger.book({ to: date, live }) : date > cover ? ledger.book({ from: dayAfter(cover), to: date, live }) : [];
  // Kural Değişikliği Farkı (Ç3): kilitli kısmın [başlangıç, min(t, kapsam)] donmuş ↔ güncel türetme yıl × hesap toplamı, BÜTÜN hesaplar (Bilanço 1–5'i, hesaplanmış satırlar 6 / 7'yi okur).
  const ruleDiff = cover ? periodRuleDiff({ frozen: entries, frozenSums: frozen, live, from: "", to: through, accounts: () => true, party: true }) : null;
  // Tur 4 (ORTA-2; tasarım §11.2): t'ye kadar yazılmış Kural Farkı Düzeltme Fişi varsa KALAN; t ≥ kapsam ise ruleDiff zaten kapsamın tamamı.
  let correction = null;
  if (cover) {
    const posted = postedCorrectionsAt(store, date);
    if (posted.active.length) {
      const lock = ledger.snapshots?.state?.().lock || "";
      correction = ruleDiffRemainder({ diff: through === cover ? ruleDiff : fullRuleDiff(store, live, cover), posted, subledger: subledgerOf(ledger), lock, cover });
    }
  }
  const valuation = createStockValuation(loadValuationInput(store));
  const names = new Map();
  const partyNames = {
    get(id) {
      if (!names.has(id)) names.set(id, hasTableIn(store, "accounts") ? store.get("SELECT name FROM accounts WHERE id = ?", id)?.name || "" : "");
      return names.get(id);
    },
  };
  return balanceSheet({ entries, valuation, date, bookType: bookTypeOf(store), closedOn: closingDayOf(store, date), ruleDiff, reconciliation: checked.reconciliation, partyNames, frozen, correction });
}

/** Değerleme okuma ucu (D3 / D4 / sürücü): t günü sonu, ürün ayrıntısıyla; önceki yıl sonunun toplamları (DBS). */
export function stockValuationOf({ store, date }) {
  if (!isDay(date)) throw Object.assign(new Error("Geçerli bir tarih seçin."), { status: 400, code: "degerleme-tarih" });
  const valuation = createStockValuation(loadValuationInput(store));
  return { ...valuation.at(date, { detail: true }), previousYearEnd: valuation.yearEnd(Number(date.slice(0, 4)) - 1).totals };
}
