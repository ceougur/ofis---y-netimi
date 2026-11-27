// 2.5.1 D3 — DEVİR PLANI (saf hesap; docs/devir/D3-D4-TASARIM.md §3). HİÇBİR ŞEY YAZMAZ, veri tabanı bilmez: okuyucunun (plan-reader.mjs) verdiği
// "olgulardan" devrin bütün sonucunu tek nesne olarak üretir. Ön izleme sayıları, Devir Raporu (report.mjs) ve D4'ün yazımı AYNI nesneden gelir (§3.1).
// Belirlenimli: aynı olgular + aynı seçenek → bayt bayt aynı plan (diziler sıralı, kimlikler `devir-<yıl>-<varlık>-<kaynak kimliği>` — G7). Tutarlar kuruş tamsayı.
//
// Kaynak kurallar (karar metinleri; kodlanan her kural yanında):
//   K yalnız geçmiş bir yılın 31 Aralık'ı ........................... EK-1 M11 (BAŞ MİMAR 05.11 18:55)
//   kapanış sırası ve sınıfı ......................................... kitap N-01 … N-08, EK-1 M4, EK-2 S25 / S26 / S40, kitap §6.1
//   açılışlar K+1, karşı hesap 519 .................................... kitap 3-M, N-09 … N-13, EK-1 M3 (KG-17 A)
//   açık kalem (bütün TYK kalemleri, asıl vade; vadesizde belge günü) .. G2 + EK-1 M2 A + S1 A; BAŞ MİMAR KARARI 27.11 (2)
//   net satır(lar), sıfır satır yok, bakiyesi 0 + kalemsiz cariye satır yok ... EK-1 M12, EK-2 S27
//   Borç Toplamı / Alacak Toplamı kuyruğa girmeden netleşir ........... BAŞ MİMAR KARARI 27.11 (2) (tasarım §3.5 madde 4)
//   şüpheli kuyruğu açık kalem DEĞİL, 128 / 129 ayrı açılış ............ EK-1 M13
//   eksi stok: miktar eksi, değer 0; silinmiş ürün açılışsız .......... KG-9 A + EK-1 M5; S207 = A
//   KDV dönem boyutu ................................................... KG-7 A + EK-1 M8 (1)–(5)
//   590 / 591 yeni yıla AYNEN (S-1 = A) ................................ §11.1; kullanıcıya soruldu, öneri uygulanıyor (DEVIR_DECISIONS)
import { CHART, JOURNAL_CLASS, OPENING_GL, PLAN_SUBS, UNASSIGNED_SUBS, entryClass } from "../general-ledger.mjs";
import { balanceSheet, incomeStatement } from "../financial-statements.mjs";

export const DEVIR_PLAN_VERSION = 1;

/**
 * KULLANICIYA SORULMUŞ ÜÇ AÇIK SORUNUN (pd-rapor §5.3) BUGÜNKÜ YANITI — TEK YER. Öneri (A) uygulanıyor; kullanıcı değiştirirse yalnız burası değişir:
 *   S1: "A" 590 / 591 yeni yıla AYNEN açılır (openingTargetOf) · "B" 590 → 570.<K yılı>, 591 → 580.<K yılı>.
 *   S2: "A" "Açılış Olabilir" listesinde onay bekleyen kayıt varken devir DURUR (preflight.mjs) · "B" UYARIR · "C" hiç söylenmez.
 *   S3: "A" düzeltilmemiş "Kural Değişikliği Farkı" varken devir DURUR (preflight.mjs) · "B" UYARIR · "C" hiç söylenmez.
 */
export const DEVIR_DECISIONS = Object.freeze({ S1: "A", S2: "A", S3: "A" });

/** Cari bakiye tipi (DEVIR-PLANI §11.2; varsayılan "Borç ve Alacakları Aktar"). */
export const DEVIR_OPTIONS = Object.freeze({ "borc-alacak": "Borç ve Alacakları Aktar", "sadece-bakiye": "Sadece Bakiyeyi Aktar" });

/** Modül açılışının karşıladığı (alt defteri olan) hesaplar — N-13 fişi bunlara YAZMAZ (Ç2 K6; tasarım §3.7). Öbür bilanço hesapları N-13'le açılır. */
export const MODULE_ACCOUNTS = Object.freeze({
  100: "kasa", 101: "evrak", 102: "banka", 103: "evrak", 108: "banka", 120: "cari", 121: "evrak", 127: "kart", 128: "supheli", 129: "supheli", 153: "stok",
  190: "vergi", 191: "vergi", 193: "vergi", 300: "banka", 309: "banka", 320: "cari", 321: "evrak", 336: "cari", 360: "vergi", 391: "vergi",
});
const CH_OF_TYPE = Object.freeze({ customer: "120", supplier: "320", other: "336" });
const CH_ACCOUNTS = new Set(Object.values(CH_OF_TYPE));
const CLOSING_CLASS = JOURNAL_CLASS["voucher-close"];
const REFLECT = Object.freeze({ 760: { mirror: "761", target: "631" }, 770: { mirror: "771", target: "632" }, 780: { mirror: "781", target: "660" } });
const CLOSING_ACCOUNTS = new Set(["690", "691", "692"]);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isDay = value => typeof value === "string" && ISO.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const dayAfter = day => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const minorOf = value => Math.round((Number(value) || 0) * 100);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const accountName = code => CHART[code] || code;

/** Kesim tarihi denetimi (EK-1 M11). Hata { status: 400, code: DEVIR_K_31_ARALIK | DEVIR_K_GELECEK }. today: şirketin bugünü (YYYY-MM-DD). */
export function checkCutoff(K, today) {
  if (!isDay(K) || K.slice(5) !== "12-31") {
    throw Object.assign(new Error("Devir için son işlem tarihi yalnız bir yılın 31 Aralık'ı olabilir."), { status: 400, code: "DEVIR_K_31_ARALIK" });
  }
  if (!isDay(today) || Number(K.slice(0, 4)) >= Number(today.slice(0, 4))) {
    throw Object.assign(new Error("Devir yalnız geçmiş bir yıl için yapılabilir; bu yılın ya da gelecek yılın sonu seçilemez."), { status: 400, code: "DEVIR_K_GELECEK" });
  }
}

/** Fiş satırı (kuruş; Ç2 assertVoucherLines biçimi): işaretli tutar → borç (artı) ya da alacak (eksi). */
function voucherLine(account, sub, signed, note = "", party = "") {
  return { account, sub: sub || "", party: party || "", debit: signed > 0 ? signed : 0, credit: signed < 0 ? -signed : 0, note };
}
const keyOf = (account, sub = "", party = "") => `${account}|${sub}|${party}`;
const splitKey = key => {
  const [account, sub, party] = key.split("|");
  return { account, sub, party };
};
const isBalanceAccount = code => /^[1-5]/.test(code);
const isResultAccount = code => /^[67]/.test(code);

/** Hücreler: (hesap, alt hesap, cari) → { borç, alacak } — K ve öncesi. */
function cellsOf(entries, K) {
  const cells = new Map();
  for (const entry of entries) {
    if (entry.date > K) continue;
    for (const line of entry.lines) {
      const key = keyOf(String(line.account), line.sub || "", line.party || "");
      const cell = cells.get(key) || { debit: 0, credit: 0 };
      cell.debit += Number(line.debit) || 0;
      cell.credit += Number(line.credit) || 0;
      cells.set(key, cell);
    }
  }
  return cells;
}
const netOf = cell => (cell ? cell.debit - cell.credit : 0);

/** Yılın sonuç hesabı (6 / 7) hareketleri, hesap + alt hesap başına (kapanış sınıfı HARİÇ — Gelir Tablosu'nun kümesi; kitap §4). */
function resultNets(entries, year) {
  const out = new Map();
  for (const entry of entries) {
    if (Number(entry.date.slice(0, 4)) !== year || entryClass(entry) === CLOSING_CLASS) continue;
    for (const line of entry.lines) {
      const account = String(line.account);
      if (!isResultAccount(account)) continue;
      const key = keyOf(account, line.sub || "");
      out.set(key, (out.get(key) || 0) + (Number(line.debit) || 0) - (Number(line.credit) || 0));
    }
  }
  return out;
}
const sortedEntries = map => [...map.entries()].sort(([a], [b]) => cmp(a, b));

/**
 * Kapanış fişleri (arşivde, K tarihli). Tutarlar YALNIZ Ç6-HESAP işlevlerinden (incomeStatement, balanceSheet.hesaplanmis, değerleme) ve aynı yevmiyenin hücrelerinden (BAŞ MİMAR
 * 06.11 (2); tek kaynak — ikinci kâr hesabı yok): önceki yıl sonucu fişleri (eskiden yeniye) → N-01 → N-02 / N-03 → N-04 → (N-05 = 0, yazılmaz) → N-06 → N-07.
 */
function closingVouchers({ entries, valuation, K, bookType, closedOn }) {
  const year = Number(K.slice(0, 4));
  const problems = [];
  const bs = balanceSheet({ entries, valuation, date: K, bookType, closedOn });
  const vouchers = [];
  const id = kod => `devir-${year}-fis-${kod}`;
  const push = (kod, type, journalClass, description, lines, extra = {}) => {
    const kept = lines.filter(line => line.debit > 0 || line.credit > 0);
    if (kept.length < 2) return null;
    const voucher = { id: id(kod), kod, type, journalClass, date: K, description, ...extra, lines: kept };
    vouchers.push(voucher);
    return voucher;
  };
  // (1) Önceki Yıl Sonucu Fişleri (EK-1 M4, EK-2 S26: 570.Y / 580.Y). Yıl listesi Bilanço'nun "Geçmiş Yıllar — Kapanmamış" satırından (tek kaynak).
  const priorResults = [];
  for (const { yil } of bs.hesaplanmis.gecmisYillar) {
    const out = incomeStatement({ entries, valuation, from: `${yil}-01-01`, to: `${yil}-12-31`, bookType });
    const lines = [];
    let sum = 0;
    for (const [key, net] of sortedEntries(resultNets(entries, yil))) {
      if (!net) continue;
      const { account, sub } = splitKey(key);
      lines.push(voucherLine(account, sub, -net));
      sum -= net;
    }
    const smm = out.smm.estimated && !out.smm.posted ? out.smm.minor : 0;
    if (smm) {
      lines.push(voucherLine("153", "", -smm, "Satışların Maliyeti"));
      sum -= smm;
    }
    const result = out.subtotals.donemNetKari;
    if (result > 0) lines.push(voucherLine("570", `570.${yil}`, -result));
    else if (result < 0) lines.push(voucherLine("580", `580.${yil}`, -result));
    sum -= result;
    // Denge = Ç6'nın yıl sonucu ile hücrelerin uyumu (sınıflandırılamayan sonuç hesabı ya da tutarsızlık varsa ≠ 0).
    if (sum !== 0) problems.push({ kod: "onceki-yil-dengesiz", yil, farkMinor: -sum });
    push(`onceki-yil-${yil}`, "prior-year-result", "closing", `Önceki Yıl Sonucu Fişi (${yil})`, lines, { yil });
    priorResults.push({ yil, tutarMinor: result, smmMinor: smm });
  }
  const current = bs.hesaplanmis.donemNetKari;
  if (!current) {
    problems.push({ kod: "yil-kapanmis", yil: year });
    return { vouchers, problems, priorResults, result: null, bs };
  }
  const is = incomeStatement({ entries, valuation, from: `${year}-01-01`, to: K, bookType });
  const nets = resultNets(entries, year);
  const add = (account, sub, signed) => {
    const key = keyOf(account, sub);
    nets.set(key, (nets.get(key) || 0) + signed);
  };
  // (2) N-01 dönem sonu stok değerlemesi: tutar = SMM_K (EK-1 M4; "153 bakiyesi − DSS" önceki yıl fişlerinden sonra buna eşit). Yılda 621 yazılmışsa (posted) yok.
  const smm = is.smm.estimated && !is.smm.posted ? is.smm.minor : 0;
  if (smm) {
    push("N-01", "closing", "period-end", "Dönem Sonu Stok Değerlemesi", [voucherLine("621", "", smm), voucherLine("153", "", -smm)]);
    add("621", "", smm);
  }
  // (3) N-02 / N-03: 7/A yansıtma (alt hesap kırılımıyla).
  const n02 = [];
  const n03 = [];
  for (const [key, net] of sortedEntries(nets)) {
    const { account, sub } = splitKey(key);
    const rule = REFLECT[account];
    if (!rule || !net) continue;
    n02.push(voucherLine(rule.target, "", net), voucherLine(rule.mirror, "", -net));
    n03.push(voucherLine(rule.mirror, "", net), voucherLine(account, sub, -net));
  }
  for (const line of n02) add(line.account, line.sub, line.debit - line.credit);
  for (const line of n03) add(line.account, line.sub, line.debit - line.credit);
  push("N-02", "closing", "closing", "7/A Gider Hesaplarının Yansıtılması", n02);
  push("N-03", "closing", "closing", "Yansıtma Hesaplarının Kapanması", n03);
  // (4) N-04: 6 sınıfı (690 / 691 / 692 HARİÇ) → 690; ters bakiyeli hesap ters yönde.
  const n04 = [];
  let toPl = 0;
  for (const [key, net] of sortedEntries(nets)) {
    const { account, sub } = splitKey(key);
    if (!net || CLOSING_ACCOUNTS.has(account)) continue;
    if (/^7/.test(account)) {
      problems.push({ kod: "yedi-sinifi-kaldi", hesap: account, alt: sub, minor: net });
      continue;
    }
    n04.push(voucherLine(account, sub, -net));
    toPl += net;
  }
  if (toPl) n04.push(voucherLine("690", "", toPl));
  push("N-04", "closing", "closing", "Sonuç Hesaplarının 690 Dönem Kârı veya Zararı Hesabına Devri", n04);
  // (5) N-05 vergi karşılığı: KG-13 A — tutar 0, satır yazılmaz. (6) N-06 690 → 692 ve 691 → 692 (EK-2 S40). (7) N-07 692 → 590 / 591.
  const pl = toPl + (nets.get(keyOf("690")) || 0);
  const tax = nets.get(keyOf("691")) || 0;
  const n06 = [];
  if (pl) n06.push(voucherLine("692", "", pl), voucherLine("690", "", -pl));
  if (tax) n06.push(voucherLine("692", "", tax), voucherLine("691", "", -tax));
  push("N-06", "closing", "closing", "690 ve 691 Hesaplarının 692 Dönem Net Kârı veya Zararı Hesabına Devri", n06);
  const net692 = pl + tax + (nets.get(keyOf("692")) || 0);
  if (net692 < 0) push("N-07", "closing", "closing", "Dönem Net Kârının 590 Hesabına Devri", [voucherLine("692", "", -net692), voucherLine("590", "", net692)]);
  else if (net692 > 0) push("N-07", "closing", "closing", "Dönem Net Zararının 591 Hesabına Devri", [voucherLine("591", "", net692), voucherLine("692", "", -net692)]);
  const result = -net692;
  if (result !== current.tutarMinor) problems.push({ kod: "donem-sonucu-farki", yil: year, beklenenMinor: current.tutarMinor, bulunanMinor: result });
  return { vouchers, problems, priorResults, result, bs, is };
}

/** S-1 (DEVIR_DECISIONS.S1): açılışta 590 / 591'in hedefi. A: aynen; B: 570.<yıl> / 580.<yıl>. */
function openingTargetOf(account, sub, year) {
  if (DEVIR_DECISIONS.S1 === "B" && account === "590") return { account: "570", sub: `570.${year}` };
  if (DEVIR_DECISIONS.S1 === "B" && account === "591") return { account: "580", sub: `580.${year}` };
  return { account, sub };
}

/** TYK kaleminin devirdeki sınıfı. Kart taksiti (kart taşır) → null; Borçta Kalsın ile kapanmış kartın kalanı → "kart-kalani" (M2 A). */
function itemClassOf(item, cardById) {
  if (item.planId) {
    const card = cardById.get(item.planId);
    return card && card.closedAtK && card.closeRule === "keep" ? "kart-kalani" : null;
  }
  if (item.kind === "invoice") return "fatura";
  if (item.kind === "entry") return "elle";
  if (item.kind === "bounce") return "karsiliksiz";
  return "diger";
}
const ITEM_LABELS = Object.freeze({ fatura: "", elle: "", karsiliksiz: "Karşılıksız Evrak", "kart-kalani": "Taksit Kartı Kalanı", diger: "Cari Kalemi" });

/** Açık kalemin açıklaması: "Devir: <belge no / tür> (<belge tarihi>)" (G2, EK-1 M12). */
function itemText(item, cls, docs) {
  if (cls === "fatura") {
    const doc = docs.get(item.invoiceId);
    return `Devir: ${doc?.number || "Fatura"} (${dayText(item.date)})`;
  }
  if (cls === "elle") return `Devir: ${item.lineKind === "credit" ? "Alacak Yaz" : "Borç Yaz"} (${dayText(item.date)})`;
  return `Devir: ${ITEM_LABELS[cls]} (${dayText(item.date)})`;
}

/**
 * Bir carinin devir satırları (tasarım §3.5): açık kalemler (TYK'nın K'deki kalemleri, şüpheli pay düşülmüş — M13), Borç Toplamı / Alacak Toplamı ya da Devir Bakiyesi.
 * items: buildObligations(...).items (TL; program biçimi). debit / credit: CH'nin ≤K borç / alacak toplamı (kuruş). Dönüş: satırlar + özet.
 */
export function accountRows({ party, account, debit, credit, items, option, year, nextDay, cardById, docs }) {
  const balance = debit - credit;
  const open = [];
  for (const item of items) {
    const cls = itemClassOf(item, cardById);
    if (!cls) continue;
    const amount = minorOf(item.remaining) - minorOf(item.doubtful);
    if (!(amount > 0)) continue;
    const receivable = item.side === "receivable";
    // Alacak tarafındaki yükümlülük olmayan kalem (avans, fazla ödeme, açık iade belgesi) net satıra girer (EK-1 M2 A: "Net açılış satırı … K'de açık ALACAK"); alacak tarafındaki
    // yükümlülükler (alış faturası, Alacak Yaz) ve borç tarafındaki her kalem (gecikmişe girer — EK-1 §1 adım 5) ayrı açık kalem (türetildi: M2 A değişmezi).
    if (!receivable && !item.due) continue;
    open.push({ item, cls, amount, receivable });
  }
  // Aynı gün sırası: açık kalemler vade sırasıyla, eşitse belge tarihi, eşitse kuyruğun kendi sırası (EK-1 M12; ders 31).
  open.sort((a, b) => cmp(a.item.vade, b.item.vade) || cmp(a.item.date, b.item.date) || cmp(a.item.at || "", b.item.at || "") || (a.item.rank || 0) - (b.item.rank || 0) || (a.item.sub || 0) - (b.item.sub || 0) || cmp(a.item.key, b.item.key));
  const openDebt = open.filter(row => row.receivable).reduce((sum, row) => sum + row.amount, 0);
  const openCredit = open.filter(row => !row.receivable).reduce((sum, row) => sum + row.amount, 0);
  const net = balance - openDebt + openCredit;
  const rows = [];
  const base = (tur, yon, tutarMinor, aciklama, extra = {}) => ({ kimlik: `devir-${year}-cari-${party}-${tur}`, tur, tarih: nextDay, yon, tutarMinor, aciklama, kaynak: "devir", acilis: true, vade: "", ...extra });
  // M12 (EK-1, AYNEN): "Bakiyesi 0 ve açık kalemi olmayan cariye HİÇ satır yazılmaz — iki seçenekte de." (D3 tur 2: hareketli ama K'de bakiyesi 0 olan caride iki eşit toplam satırı yazılıyordu.)
  if (balance === 0 && !open.length) return { rows: [], open, balance, openDebt: 0, openCredit: 0, net: 0 };
  if (option === "sadece-bakiye") {
    if (net) rows.push(base("devir-bakiyesi", net > 0 ? "debt" : "credit", Math.abs(net), "Devir Bakiyesi", { kuyrugaGirenMinor: net }));
  } else {
    // M12: Borç Toplamı = ≤K bütün borç hareketleri − devreden açık BORÇ kalemleri; Alacak Toplamı = ≤K bütün alacak hareketleri − devreden açık ALACAK kalemleri.
    // BAŞ MİMAR KARARI 27.11 (2): iki satır tek borç sırasına girmeden ÖNCE netleşir — kuyruğa yalnız net (`kuyrugaGirenMinor`, Borç Toplamı satırında) girer.
    const borc = debit - openDebt;
    const alacak = credit - openCredit;
    if (borc) rows.push(base("borc-toplami", borc > 0 ? "debt" : "credit", Math.abs(borc), "Devir — Borç Toplamı", { kuyrugaGirenMinor: net }));
    if (alacak) rows.push(base("alacak-toplami", alacak > 0 ? "credit" : "debt", Math.abs(alacak), "Devir — Alacak Toplamı", { kuyrugaGirenMinor: borc ? 0 : net }));
  }
  for (const { item, cls, amount, receivable } of open) {
    rows.push({
      kimlik: `devir-${year}-kalem-${item.key}`,
      tur: "acik-kalem",
      tarih: nextDay,
      yon: receivable ? "debt" : "credit",
      tutarMinor: amount,
      aciklama: itemText(item, cls, docs),
      kaynak: "devir",
      kaynakKimlik: item.key,
      acilis: false,
      // §1.2 madde 1 (türetildi): vade = asıl vade; vadesizde asıl belge günü (TYK'nın vadesi — S1 A, S91 A). Boş BIRAKILMAZ.
      vade: item.vade || item.date,
      beklenenTarih: item.promise || "",
      kalemSinifi: cls,
      // Kalemin tek borç sırasındaki ROLÜ (D4a ŞARTI — koddan türetildi, raporda BM-6): yükümlülük (fatura, Borç / Alacak Yaz, karşılıksız, kart kalanı) ya da ödeme (netleşmemiş borç
      // yönlü bağsız ödeme: tedarikçiye avans, müşteriye para iadesi — EK-1 §1 adım 5'e göre gecikmişe girer). Ödeme rolündeki kalem yeni yılda ÖDEME satırı olarak yazılmalı ve kuyrukta
      // vadesi asıl tarihi olmalı; yükümlülük olarak (Borç Yaz) yazılırsa sonraki alış faturasıyla netleşme sırası değişir (gerçek veride görüldü).
      rol: item.due ? "yukumluluk" : "odeme",
      belge: { tarih: item.date, ...(item.invoiceId ? { faturaId: item.invoiceId, no: docs.get(item.invoiceId)?.number || "" } : {}), ...(item.lineId ? { satirId: item.lineId } : {}), ...(item.planId ? { kartId: item.planId } : {}) },
    });
  }
  return { rows, open, balance, openDebt, openCredit, net };
}

/** Bütün sayıların kaynağı olan hücre özeti: hesap → { kuruş, alt hesaplar }. */
function accountTotals(cells) {
  const out = new Map();
  for (const [key, cell] of cells) {
    const { account } = splitKey(key);
    out.set(account, (out.get(account) || 0) + netOf(cell));
  }
  return out;
}

/**
 * DEVİR PLANI. facts: plan-reader.mjs readDevirFacts() çıktısı (testler elle de kurar). options: { option: "borc-alacak" | "sadece-bakiye" }.
 * Dönüş biçimi raporun "DEVİR PLANI nesnesinin TAM biçimi" bölümünde (docs/devir/2.5.1-DEVAM/d3-rapor.md).
 */
export function buildDevirPlan(facts, { option = "borc-alacak" } = {}) {
  if (!DEVIR_OPTIONS[option]) throw Object.assign(new Error("Cari bakiye tipi geçerli değil."), { status: 400, code: "DEVIR_SECENEK" });
  const { K } = facts;
  if (!isDay(K) || K.slice(5) !== "12-31") throw Object.assign(new Error("Devir için son işlem tarihi yalnız bir yılın 31 Aralık'ı olabilir."), { status: 400, code: "DEVIR_K_31_ARALIK" });
  const year = Number(K.slice(0, 4));
  const nextDay = dayAfter(K);
  const entries = (facts.entries || []).filter(entry => entry.date <= K);
  const problems = [...(facts.readProblems || [])];
  // ---------- Arşiv: kapanış ----------
  const closing = closingVouchers({ entries, valuation: facts.valuation, K, bookType: facts.bookType || "unset", closedOn: facts.closedOn || "" });
  problems.push(...closing.problems);
  const before = cellsOf(entries, K);
  const after = new Map([...before].map(([key, cell]) => [key, { debit: cell.debit, credit: cell.credit }]));
  for (const voucher of closing.vouchers) {
    for (const line of voucher.lines) {
      const key = keyOf(line.account, line.sub, line.party);
      const cell = after.get(key) || { debit: 0, credit: 0 };
      cell.debit += line.debit;
      cell.credit += line.credit;
      after.set(key, cell);
    }
  }
  // Kapanışın hesap hesap etkisi (Devir Raporu 2. bölüm): fişlerin dokunduğu her hesap + alt hesap için kapanış öncesi ↔ sonrası.
  const touched = new Set();
  for (const voucher of closing.vouchers) for (const line of voucher.lines) touched.add(keyOf(line.account, line.sub));
  const sumBySub = cells => {
    const out = new Map();
    for (const [key, cell] of cells) {
      const { account, sub } = splitKey(key);
      const short = keyOf(account, sub);
      if (touched.has(short)) out.set(short, (out.get(short) || 0) + netOf(cell));
    }
    return out;
  };
  const beforeBySub = sumBySub(before);
  const afterBySub = sumBySub(after);
  const closingEffect = [...touched].sort(cmp).map(key => {
    const { account, sub } = splitKey(key);
    return { hesap: account, alt: sub, onceMinor: beforeBySub.get(key) || 0, sonraMinor: afterBySub.get(key) || 0 };
  });
  // Kapanıştan sonra 6 / 7 sınıfı = 0 (kitap §6.1).
  const leftover = [];
  for (const [account, minor] of sortedEntries(accountTotals(after))) if (isResultAccount(account) && minor !== 0) leftover.push({ hesap: account, minor });
  if (leftover.length && closing.result !== null) problems.push({ kod: "sonuc-hesabi-kaldi", hesaplar: leftover });
  // Arşivin K kapanış bakiyeleri (bilanço hesapları; alt hesap ve cari boyutuyla) — Devir Raporu'nun 1. bölümü ve D4'ün değişmezi.
  const closingBalances = [];
  for (const [key, cell] of sortedEntries(after)) {
    const { account, sub, party } = splitKey(key);
    if (!isBalanceAccount(account)) continue;
    const minor = netOf(cell);
    if (!minor) continue;
    closingBalances.push({ hesap: account, alt: sub, cari: party, minor });
  }
  const cellOf = (account, sub = "", party = "") => netOf(after.get(keyOf(account, sub, party)));
  const sumWhere = test => closingBalances.filter(test).reduce((sum, row) => sum + row.minor, 0);

  // ---------- Yeni yıl: modül açılışları (K+1, karşı 519) ----------
  const covered = new Map(); // hücre anahtarı → modül açılışının karşıladığı (kuruş, borç artı)
  const cover = (account, sub, party, minor) => {
    if (!minor) return;
    const key = keyOf(account, sub, party);
    covered.set(key, (covered.get(key) || 0) + minor);
  };
  const parties = new Map((facts.parties || []).map(party => [party.id, party]));
  const cardById = new Map((facts.cards || []).map(card => [card.id, card]));
  const docs = facts.invoiceDocs || new Map();
  // Kasa (N-09 / M-01).
  const cash = { kimlik: `devir-${year}-kasa`, tarih: nextDay, minor: sumWhere(row => row.hesap === "100") };
  for (const row of closingBalances) if (row.hesap === "100") cover(row.hesap, row.alt, row.cari, row.minor);
  // Banka / POS / kart / kredi (M-04 … M-06, N-11): alt hesap boyutunda; hesabı atanmamış 102.00 / 108.00 dahil (değişmez 2).
  const bankBySub = new Map((facts.bankAccounts || []).map(item => [item.sub, item]));
  const bank = [];
  for (const row of closingBalances) {
    if (!["102", "108", "300", "309"].includes(row.hesap)) continue;
    const owner = bankBySub.get(row.alt);
    bank.push({ kimlik: `devir-${year}-banka-${row.alt || row.hesap}`, hesap: row.hesap, alt: row.alt, ad: owner?.name || UNASSIGNED_SUBS[row.alt] || PLAN_SUBS[row.alt] || accountName(row.hesap), bankaHesabi: owner?.id || "", tur: owner?.kind || "", tarih: nextDay, minor: row.minor, atanmamis: !owner });
    cover(row.hesap, row.alt, row.cari, row.minor);
  }
  // Carisiz cari kontrol hücreleri (ör. 336.90 kayıt / dosya tahsilatları — KG-3 A; cari boyutu yok): alt defterleri kayıt tahsilatlarıdır (payments, ≤K budanır); açılışın alt defter
  // yeri D4a'da (raporda BAŞ MİMAR KARARI GEREKİYOR BM-2). Planda ayrı liste — tutar K bakiyesi.
  const other = [];
  for (const row of closingBalances) {
    if (!CH_ACCOUNTS.has(row.hesap) || row.cari) continue;
    other.push({ kimlik: `devir-${year}-altdefter-${row.alt || row.hesap}`, hesap: row.hesap, alt: row.alt, tarih: nextDay, minor: row.minor, neden: row.alt === "336.90" ? "kayit-tahsilati" : "carisiz" });
    cover(row.hesap, row.alt, "", row.minor);
  }
  // Cariler (tasarım §3.5): CH hücresi cari başına; açık kalemler TYK'dan.
  const chByParty = new Map();
  for (const [key, cell] of sortedEntries(before)) {
    const { account, party } = splitKey(key);
    if (!CH_ACCOUNTS.has(account) || !party) continue;
    let list = chByParty.get(party);
    if (!list) chByParty.set(party, (list = new Map()));
    const row = list.get(account) || { debit: 0, credit: 0 };
    row.debit += cell.debit;
    row.credit += cell.credit;
    list.set(account, row);
  }
  const accounts = [];
  const allParties = [...new Set([...parties.keys(), ...chByParty.keys(), ...(facts.obligations ? facts.obligations.keys() : [])])].sort(cmp);
  const doubtfulByParty = new Map();
  for (const record of facts.doubtful || []) {
    const row = doubtfulByParty.get(record.party) || { remainingMinor: 0, provisionMinor: 0, records: [] };
    row.remainingMinor += record.remainingMinor;
    row.provisionMinor += record.provisionMinor;
    if (record.remainingMinor || record.provisionMinor) row.records.push(record);
    doubtfulByParty.set(record.party, row);
  }
  for (const id of allParties) {
    const info = parties.get(id) || { id, name: "", type: "customer", deleted: false };
    const own = CH_OF_TYPE[info.type] || "120";
    const list = chByParty.get(id) || new Map();
    const items = facts.obligations?.get(id) || [];
    const kinds = [...new Set([own, ...list.keys()])].sort(cmp);
    for (const account of kinds) {
      const cell = list.get(account) || { debit: 0, credit: 0 };
      const mine = account === own;
      const out = accountRows({ party: account === own ? id : `${id}-${account}`, account, debit: cell.debit, credit: cell.credit, items: mine ? items : [], option, year, nextDay, cardById, docs });
      // Kartlı / şüpheli olmayan … : CH hücresi (K kapanışı) = satırların toplamı (yön işaretli) — değişmez (M13: CH açılışı + Σ CH açık kalemleri = CH bakiyesi, 128 hariç).
      const rowsMinor = out.rows.reduce((sum, row) => sum + (row.yon === "debt" ? row.tutarMinor : -row.tutarMinor), 0);
      if (rowsMinor !== out.balance) problems.push({ kod: "cari-satir-farki", cari: id, hesap: account, beklenenMinor: out.balance, bulunanMinor: rowsMinor });
      cover(account, "", id, out.balance);
      const doubtful = mine ? doubtfulByParty.get(id) : null;
      if (!out.rows.length && !doubtful?.remainingMinor && !doubtful?.provisionMinor && !mine) continue;
      accounts.push({
        cari: id,
        ad: info.name || "",
        tur: info.type || "",
        silinmis: Boolean(info.deleted),
        hesap: account,
        kBakiyeMinor: out.balance,
        borcMinor: cell.debit,
        alacakMinor: cell.credit,
        acikBorcMinor: out.openDebt,
        acikAlacakMinor: out.openCredit,
        netMinor: out.net,
        acikKalemSayisi: out.open.length,
        supheliMinor: doubtful?.remainingMinor || 0,
        karsilikMinor: doubtful?.provisionMinor || 0,
        satirlar: out.rows,
      });
    }
  }
  // Şüpheli (N-12): 128 / 129 K bakiyeleri cari boyutunda; kaydın fatura başvurusu korunur (M13).
  const doubtful = [];
  for (const [party, row] of [...doubtfulByParty.entries()].sort(([a], [b]) => cmp(a, b))) {
    for (const record of row.records.sort((a, b) => cmp(a.date, b.date) || cmp(a.id, b.id))) {
      doubtful.push({ kimlik: `devir-${year}-supheli-${record.id}`, kayit: record.id, cari: party, tarih: nextDay, kayitTarihi: record.date, kalanMinor: record.remainingMinor, karsilikMinor: record.provisionMinor, ...(record.invoiceNo ? { faturaNo: record.invoiceNo } : {}) });
    }
    cover("128", "", party, row.remainingMinor);
    cover("129", "", party, -row.provisionMinor);
  }
  for (const row of closingBalances) {
    if (row.hesap !== "128" && row.hesap !== "129") continue;
    const own = doubtfulByParty.get(row.cari);
    const want = row.hesap === "128" ? own?.remainingMinor || 0 : -(own?.provisionMinor || 0);
    if (want !== row.minor) problems.push({ kod: "supheli-farki", cari: row.cari, hesap: row.hesap, beklenenMinor: row.minor, bulunanMinor: want });
  }
  // Taksit kartları (tasarım §3.8): ≤K tahsilat tek açılış; taksit dağılımı korunur; kapalı kart da tek açılış alır. Carisiz kart 127 (cari boyutu plan:<kimlik>).
  const cards = [];
  for (const card of [...(facts.cards || [])].sort((a, b) => cmp(a.id, b.id))) {
    const remaining = card.coversBalance ? 0 : card.totalMinor - card.paidMinor - (card.closedAtK && card.closeRule !== "keep" ? Math.max(0, card.totalMinor - card.paidMinor) : 0);
    cards.push({
      kimlik: `devir-${year}-kart-${card.id}`,
      kart: card.id,
      cari: card.party || "",
      tarih: nextDay,
      toplamMinor: card.totalMinor,
      odenenMinor: card.paidMinor,
      kalanMinor: card.closedAtK ? 0 : Math.max(0, card.totalMinor - card.paidMinor),
      durum: card.closedAtK ? "kapali" : "acik",
      kapanisKurali: card.closeRule || "",
      mevcutBorc: Boolean(card.coversBalance),
      faturaId: card.invoiceId || "",
      taksitler: (card.installments || []).map(inst => ({ taksit: inst.itemId, sira: inst.seq, vade: inst.vade, kalanMinor: inst.remainingMinor })),
    });
    if (!card.party) cover("127", "", `plan:${card.id}`, remaining);
  }
  // Çek / senet (M-08 / M-09; tasarım §3.8): K'deki durum bazında; ciroda / kapanmış evrakın defter bakiyesi yok (yalnız iz).
  const cheques = [];
  for (const item of [...(facts.cheques || [])].sort((a, b) => cmp(a.id, b.id))) {
    const gl = item.instrument === "note" ? { portfolio: "121.01", bank: "121.02", given: "321" } : { portfolio: "101.01", bank: "101.02", given: "103" };
    const place = item.direction === "in" ? (item.stateK === "portfolio" ? gl.portfolio : item.stateK === "bank" ? gl.bank : "") : item.stateK === "pending" ? gl.given : "";
    cheques.push({ kimlik: `devir-${year}-evrak-${item.id}`, evrak: item.id, yon: item.direction, tur: item.instrument === "note" ? "senet" : "cek", durum: item.stateK, cari: item.party || "", tarih: nextDay, minor: item.amountMinor, hesap: place ? place.split(".")[0] : "", alt: place.includes(".") ? place : "", seriNo: item.serial || "", vade: item.due || "" });
    if (place) cover(place.split(".")[0], place.includes(".") ? place : "", "", item.direction === "in" ? item.amountMinor : -item.amountMinor);
  }
  // Stok (KG-9 / KG-10, M5, S207): ürün bazında yearEnd(K); miktar eksi dahil, eksi / silinmiş üründe değer 0; silinmiş ürüne açılış YAZILMAZ.
  const stock = [];
  const valuationK = facts.valuation.at(K, { detail: true });
  for (const product of [...(valuationK.products || [])].sort((a, b) => cmp(a.id, b.id))) {
    if (product.deleted || product.qty === 0) continue;
    stock.push({ kimlik: `devir-${year}-stok-${product.id}`, urun: product.id, kod: product.code, ad: product.name, birim: product.unit, tarih: nextDay, miktar: product.qty, birimMaliyet: product.qty > 0 ? product.unitCost : 0, degerMinor: product.qty > 0 ? product.valueMinor : 0, dayanak: product.basis, eksi: product.qty < 0 });
  }
  const dssK = valuationK.totals.dssMinor;
  cover("153", "", "", stock.reduce((sum, row) => sum + row.degerMinor, 0));
  // KDV ve vergiler (M8 1–5): 191 dönem (KDV İndirim Dönemi; boşsa belge ayı) ve 391 belge ayı boyutuyla; 190, 360, 193 aynen. Mahsup fişinin satırları kendi ayına.
  const vatCells = new Map();
  for (const entry of entries) {
    const offsetMonth = facts.vatOffsetMonths?.get(entry.id) || "";
    const month = String(entry.date).slice(0, 7);
    for (const line of entry.lines) {
      const account = String(line.account);
      if (!["190", "191", "193", "360", "391"].includes(account)) continue;
      const period = account === "191" ? offsetMonth || facts.vatPeriods?.get(entry.id) || month : account === "391" ? offsetMonth || month : "";
      const key = `${account}|${period}`;
      vatCells.set(key, (vatCells.get(key) || 0) + (Number(line.debit) || 0) - (Number(line.credit) || 0));
    }
  }
  const vat = [];
  for (const [key, minor] of sortedEntries(vatCells)) {
    if (!minor) continue;
    const [account, period] = key.split("|");
    vat.push({ kimlik: `devir-${year}-vergi-${account}${period ? `-${period}` : ""}`, hesap: account, donem: period, tarih: nextDay, minor, oncekiYil: Boolean(period) && period <= `${year}-12` });
  }
  for (const row of closingBalances) if (MODULE_ACCOUNTS[row.hesap] === "vergi") cover(row.hesap, row.alt, row.cari, row.minor);
  // ---------- N-13 tamamlayıcı açılış fişi (alt defteri olmayan bilanço hesapları; karşı 519) ----------
  const n13 = [];
  let n13Counter = 0;
  for (const row of closingBalances) {
    if (MODULE_ACCOUNTS[row.hesap] || row.hesap === OPENING_GL) continue;
    const target = openingTargetOf(row.hesap, row.alt, year);
    n13.push(voucherLine(target.account, target.sub, row.minor, "", row.cari));
    n13Counter -= row.minor;
  }
  if (n13Counter) n13.push(voucherLine(OPENING_GL, "", n13Counter));
  const openingVoucher = n13.length >= 2 ? { id: `devir-${year}-fis-N-13`, kod: "N-13", type: "opening", journalClass: "opening", date: nextDay, description: "Devir Açılış Fişi", lines: n13 } : null;
  // Alt defter hesaplarında modül açılışının karşılamadığı fark → devir DURUR (fiş alt defter hesabına yazamaz — K6; tasarım §3.7). K yılı kapanmamışsa (yıl zaten kapanmış — sorun
  // yukarıda) karşılaştırma anlamsızdır (153 değerlenmedi).
  for (const row of closing.result === null ? [] : closingBalances) {
    if (!MODULE_ACCOUNTS[row.hesap] || MODULE_ACCOUNTS[row.hesap] === "vergi") continue;
    const got = covered.get(keyOf(row.hesap, row.alt, row.cari)) || 0;
    if (got !== row.minor) problems.push({ kod: "modul-farki", hesap: row.hesap, alt: row.alt, cari: row.cari, beklenenMinor: row.minor, bulunanMinor: got });
  }
  for (const [key, minor] of closing.result === null ? [] : sortedEntries(covered)) {
    const { account, sub, party } = splitKey(key);
    if (MODULE_ACCOUNTS[account] === "vergi" || !minor) continue;
    if (!closingBalances.some(row => row.hesap === account && row.alt === sub && row.cari === party)) problems.push({ kod: "modul-farki", hesap: account, alt: sub, cari: party, beklenenMinor: 0, bulunanMinor: minor });
  }
  // ---------- Değişmezler (kitap §6; EK-1 §4) ----------
  const invariants = [];
  const check = (kod, ad, beklenen, bulunan) => invariants.push({ kod, ad, ok: beklenen === bulunan, beklenenMinor: beklenen, bulunanMinor: bulunan });
  const totalAfter = accountTotals(after);
  check("donem-sonucu", "590 / 591 = Ç6 Dönem Net Kârı (Zararı)", closing.bs.hesaplanmis.donemNetKari?.tutarMinor ?? 0, closing.result ?? 0);
  check("onceki-yillar", "Σ Önceki Yıl Sonucu = Ç6 Geçmiş Yıllar — Kapanmamış", closing.bs.hesaplanmis.gecmisYillar.reduce((sum, row) => sum + row.tutarMinor, 0), closing.priorResults.reduce((sum, row) => sum + row.tutarMinor, 0));
  check("stok-dss", "Kapanıştan sonra 153 = Dönem Sonu Stok (DSS)", dssK, totalAfter.get("153") || 0);
  check("stok-acilis", "Σ Stok Açılış Değeri = Arşiv 153", totalAfter.get("153") || 0, stock.reduce((sum, row) => sum + row.degerMinor, 0));
  check("sonuc-sifir", "Kapanıştan sonra 6 / 7 sınıfı bakiyesi", 0, leftover.reduce((sum, row) => sum + Math.abs(row.minor), 0));
  let newG = 0;
  for (const [key, minor] of covered) if (splitKey(key).account !== OPENING_GL) newG -= minor;
  newG += n13Counter;
  check("gecici-hesap", "Yeni Yıl 519 = Arşiv 519", totalAfter.get(OPENING_GL) || 0, newG);
  for (const account of ["190", "191", "193", "360", "391"]) check(`vergi-${account}`, `Vergi Açılışı ${account} = Arşiv ${account}`, totalAfter.get(account) || 0, vat.filter(row => row.hesap === account).reduce((sum, row) => sum + row.minor, 0));
  const balanceTotal = closingBalances.reduce((sum, row) => sum + row.minor, 0);
  check("denge", "Arşiv Kapanış Bilançosu Dengede (Σ Borç − Σ Alacak)", 0, balanceTotal);
  // ---------- Bağlar, şablonlar, budama (tasarım §2, §3.5 madde 7) ----------
  const openInvoices = new Set();
  for (const row of accounts) for (const line of row.satirlar) if (line.kalemSinifi === "fatura" && line.belge?.faturaId) openInvoices.add(line.belge.faturaId);
  const links = [...(facts.links || [])]
    .sort((a, b) => cmp(a.table, b.table) || cmp(a.rowId, b.rowId) || cmp(a.field, b.field))
    .map(link => {
      const doc = docs.get(link.invoiceId);
      return openInvoices.has(link.invoiceId)
        ? { tablo: link.table, satir: link.rowId, alan: link.field, tarih: link.date, eskiHedef: link.invoiceId, yeniHedef: `devir-${year}-kalem-inv:${link.invoiceId}`, tur: "acik-kalem" }
        : { tablo: link.table, satir: link.rowId, alan: link.field, tarih: link.date, eskiHedef: link.invoiceId, yeniHedef: "", tur: "arsiv-basvurusu", arsiv: { yil: year, no: doc?.number || "", tarih: doc?.date || "" } };
    });
  const repeats = [...(facts.repeats || [])].sort((a, b) => cmp(a.id, b.id)).map(row => ({ tekrar: row.id, sablon: row.templateId, sablonNo: row.templateNumber || "", sonrakiTarih: row.nextDate || "", taslakKimlik: `devir-${year}-sablon-${row.templateId}` }));
  const prune = [...(facts.counts || [])].sort((a, b) => cmp(a.table, b.table));
  // ---------- Ön izleme sayıları (tasarım §3.3) — hepsi yukarıdaki listelerden SAYILIR ----------
  const sumOf = (list, field) => list.reduce((sum, row) => sum + (row[field] || 0), 0);
  const openLines = accounts.flatMap(row => row.satirlar.filter(line => line.tur === "acik-kalem"));
  const invoiceLines = openLines.filter(line => line.kalemSinifi === "fatura");
  const otherLines = openLines.filter(line => line.kalemSinifi !== "fatura");
  const withLines = accounts.filter(row => row.satirlar.length);
  const counts = {
    cariKarti: (facts.parties || []).length,
    cariAcilis: withLines.length,
    cariBorcluMinor: sumOf(accounts.filter(row => row.kBakiyeMinor > 0), "kBakiyeMinor"),
    cariAlacakliMinor: -sumOf(accounts.filter(row => row.kBakiyeMinor < 0), "kBakiyeMinor"),
    acikFatura: { satis: invoiceLines.filter(line => line.yon === "debt").length, satisMinor: sumOf(invoiceLines.filter(line => line.yon === "debt"), "tutarMinor"), alis: invoiceLines.filter(line => line.yon === "credit").length, alisMinor: sumOf(invoiceLines.filter(line => line.yon === "credit"), "tutarMinor") },
    acikKalem: { borc: otherLines.filter(line => line.yon === "debt").length, borcMinor: sumOf(otherLines.filter(line => line.yon === "debt"), "tutarMinor"), alacak: otherLines.filter(line => line.yon === "credit").length, alacakMinor: sumOf(otherLines.filter(line => line.yon === "credit"), "tutarMinor") },
    taksitKarti: { acik: cards.filter(row => row.durum === "acik" && row.kalanMinor > 0).length, kalanMinor: sumOf(cards.filter(row => row.durum === "acik"), "kalanMinor"), kapali: cards.filter(row => !(row.durum === "acik" && row.kalanMinor > 0)).length },
    evrak: Object.fromEntries(["portfolio", "bank", "endorsed", "bounced", "pending"].map(state => [state, { adet: cheques.filter(row => row.durum === state).length, minor: sumOf(cheques.filter(row => row.durum === state), "minor") }])),
    banka: { hesap: bank.filter(row => row.hesap === "102").length, minor: sumOf(bank.filter(row => row.hesap === "102"), "minor"), kart: sumOf(bank.filter(row => row.hesap === "309"), "minor"), kredi: sumOf(bank.filter(row => row.hesap === "300"), "minor"), posBekleyenMinor: sumOf(bank.filter(row => row.hesap === "108"), "minor") },
    stok: { urun: stock.length, degerMinor: sumOf(stock, "degerMinor"), eksi: stock.filter(row => row.eksi).length },
    kasaMinor: cash.minor,
    supheli: { kayit: doubtful.length, kalanMinor: sumOf(doubtful, "kalanMinor"), karsilikMinor: sumOf(doubtful, "karsilikMinor") },
    // Hareket = budanır (B) ve açık olan kalır (A) tablolarının satırları; dokunulmaz (D) tablolar hareket sayılmaz (yeni yılda aynen; arşivde kopya).
    hareket: { budanacak: sumOf(prune.filter(row => row.sinif !== "D"), "kOncesi"), tasinacak: sumOf(prune.filter(row => row.sinif !== "D"), "kSonrasi") },
  };
  return {
    surum: DEVIR_PLAN_VERSION,
    meta: {
      sirket: facts.company || null,
      K,
      acilisGunu: nextDay,
      yil: year,
      secenek: option,
      secenekAd: DEVIR_OPTIONS[option],
      calismaKimligi: `devir-${year}`,
      veriSurumu: facts.dataVersion || "",
      defterTuru: facts.bookType || "unset",
      kuralSurumu: facts.ruleVersion || "",
      kararlar: { ...DEVIR_DECISIONS },
    },
    archive: {
      lockThrough: K,
      kapanisFisleri: closing.vouchers,
      kapanisBakiyeleri: closingBalances,
      kapanisEtkisi: closingEffect,
      donemSonucuMinor: closing.result,
      oncekiYillar: closing.priorResults,
    },
    newYear: { kasa: cash, banka: bank, cariler: accounts, digerAltDefter: other, kartlar: cards, evraklar: cheques, stok: stock, supheli: doubtful, vergi: vat, acilisFisi: openingVoucher, baglar: links, sablonlar: repeats, budama: prune },
    degismezler: invariants,
    sorunlar: problems,
    sayilar: counts,
  };
}
