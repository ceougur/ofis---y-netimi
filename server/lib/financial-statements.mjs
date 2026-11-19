// Mali tabloların HESABI — ortak çekirdek (2.5.0 Ç6-HESAP; docs/erp/C6-HESAP-TASARIM.md §4, §5, §7).
// Tur 1: Gelir Tablosu (kural kitabı §4, §7.1; MSUGT, 7/A), satışların maliyeti tahmini (KG-11 A; EK-1 M6; §5.2 / N-01 defter biçimi), TEK "Kesin Değil" toplayıcısı (§7.4) ve dipnotlar
// (§7.5). Tur 2 Bilanço'yu AYNI toplayıcı ve AYNI incomeStatement çağrısıyla (hesaplanmış Dönem Net Kârı) buraya ekler.
//
// TEMEL İLKE (çekirdek planı §0): her tutar Ana Defter'in karma yevmiyesinden (routes/ledger.mjs book(): kilitli dönem donmuş defterden, açık dönem canlı türetmeden). Ayrı türetme,
// ikinci para motoru YOK; değerleme (lib/stock-valuation.mjs) yalnız dönem sonu stokunu (DSS) verir. Sınıflama HESAP ÖNEKİNDEN (Ç7b'nin 601'i ve .90 alt hesapları baştan karşılanır).
// Tutarlar kuruş tamsayı (…Minor).
import { bookTypeOf } from "./book-type.mjs";
import { CHART, JOURNAL_CLASS, PLAN_SUBS, entryClass } from "./general-ledger.mjs";
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
 * T(a − 1) = 0. Yılda 621 hareketi (N-01 yazılmış) varsa o yıl kesindir: tahmin YOK, defterdeki 621 (incomeStatement D kaleminde) geçerli. a ve b aynı mali yıl (çapraz yıl tanımsız —
 * tasarım §10 S-b; çağıran reddeder). Dönüş: { estimated, minor, stockFlowMinor, stockMovesMinor, differenceMinor, negative, warnings, at: { b, a1 } }.
 */
export function estimatedCost({ entries, valuation, from, to }) {
  const start = yearStart(to);
  const year = Number(to.slice(0, 4));
  const posted621 = entries.some(entry => entry.date >= start && entry.date <= `${year}-12-31` && entryClass(entry) !== CLOSING_CLASS && entry.lines.some(line => line.account === "621"));
  const prev = valuation.yearEnd(year - 1);
  const atB = valuation.at(to);
  const T = (day, at) => prev.totals.dssMinor + stockFlow(entries, start, day) - at.totals.dssMinor;
  const first = from <= start;
  const atA = first ? null : valuation.at(dayBefore(from));
  // Stok biçimiyle karşılaştırma (tasarım §4): 153 defter hareketi ↔ stok hareketlerinin tutarı (açılış + alış − alış iadesi), [1 Ocak, b].
  const flow = stockFlow(entries, start, to);
  const minor = posted621 ? 0 : prev.totals.dssMinor + flow - atB.totals.dssMinor - (first ? 0 : T(dayBefore(from), atA));
  const moves = atB.totals.openingMinor + atB.totals.purchaseMinor - atB.totals.returnMinor;
  const negative = new Map();
  for (const row of [...atB.negative, ...(atA ? atA.negative : [])]) if (!negative.has(row.id)) negative.set(row.id, row);
  // Stoksuz dönemde (önceki yıl sonu stoku, dönem 153 hareketi ve t stoku 0) tahmin yoktur: maliyet kesin 0 (hizmet işletmesi "Satışların Maliyeti Tahminidir" uyarısı görmez).
  const involved = prev.totals.dssMinor !== 0 || atB.totals.dssMinor !== 0 || flow !== 0 || negative.size > 0 || (atA ? atA.totals.dssMinor !== 0 || stockFlow(entries, start, dayBefore(from)) !== 0 : false);
  return {
    estimated: !posted621 && involved,
    minor,
    dssPrevMinor: prev.totals.dssMinor,
    dssMinor: atB.totals.dssMinor,
    stockFlowMinor: flow,
    stockMovesMinor: moves,
    differenceMinor: flow - moves,
    negative: [...negative.values()],
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
    add("defter-farki", "Defter Mutabakatı Farkı ya da Dengesiz Madde", facts.unbalanced > 0 ? `Dönemde borç ve alacak toplamı eşit olmayan ${facts.unbalanced} madde var.` : "Ana defter ile alt defterler arasında fark var.");
  }
  if (facts.ruleDiff?.length) add("kural-farki", "Kural Değişikliği Farkı", "Kilitli dönemin donmuş defteri güncel kuralla türetilen defterden farklı; tablo donmuş defterdendir.", facts.ruleDiff);
  if (facts.negativeStock?.length) add("eksi-stok", "Eksi Stok", "Eksi miktarlı ürünler dönem sonu stokuna 0 değerle girdi.", facts.negativeStock.map(row => `${row.name} (${row.qty} ${row.unit})`.trim()));
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
    if (item.kod === "D" && cost.estimated && cost.minor !== 0) hesaplar.push({ hesap: "621", ad: "Satışların Maliyeti (Tahmini)", tahmini: true, tutarMinor: cost.minor, altlar: [] });
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
    smm: { estimated: cost.estimated, minor: cost.estimated ? cost.minor : of("D"), dssPrevMinor: cost.dssPrevMinor, dssMinor: cost.dssMinor, stockFlowMinor: cost.stockFlowMinor, stockMovesMinor: cost.stockMovesMinor, differenceMinor: cost.differenceMinor },
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
export function periodRuleDiff({ frozen, live, from, to }) {
  const sums = new Map();
  const add = (list, side) => {
    for (const entry of list) {
      if (entry.date < from || entry.date > to || String(entry.id).startsWith("voucher")) continue;
      for (const line of entry.lines) {
        if (!(line.account === "153" || /^[67]/.test(line.account))) continue;
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

/** Değerleme okuma ucu (D3 / D4 / sürücü): t günü sonu, ürün ayrıntısıyla; önceki yıl sonunun toplamları (DBS). */
export function stockValuationOf({ store, date }) {
  if (!isDay(date)) throw Object.assign(new Error("Geçerli bir tarih seçin."), { status: 400, code: "degerleme-tarih" });
  const valuation = createStockValuation(loadValuationInput(store));
  return { ...valuation.at(date, { detail: true }), previousYearEnd: valuation.yearEnd(Number(date.slice(0, 4)) - 1).totals };
}
