// Ana Defter (v2.0.13) — çift yönlü kayıt ve alt defter ↔ ana defter mutabakatı.
//
// Mimari karar: programın asıl kayıtları alt defterlerdir (Kasa ve Banka, cari, taksit, stok, çek/senet). Ana Defter bu
// kayıtlardan HER SEFERİNDE AYNI KURALLA türetilir; ikinci bir kopya olarak saklanmaz. Böylece alt defter ile ana defter
// arasında "biri yazıldı öbürü yazılmadı" sapması yapısal olarak imkânsızdır (SAP/Oracle'daki alt defter → ana defter
// entegrasyonunun yerel-öncelikli karşılığı). Her kaynak satırı bir yevmiye maddesi olur: borç toplamı = alacak toplamı.
// Mutabakat kapısı (reconcile) ana defter hesaplarının bakiyelerini alt defterlerin kendi hesabıyla kuruşu kuruşuna
// karşılaştırır; fark varsa hangi hesapta ve ne kadar olduğunu söyler.
//
// Hesap planı: Tekdüzen Hesap Planı'nın ilgili hesapları.
import { DOCUMENT_GL, documentGl } from "./cheque-gl.mjs";
import { DOUBTFUL_CHART, DOUBTFUL_GL, applyDoubtfulToJournal, doubtfulSkipOf } from "./doubtful-gl.mjs";
import { roundMoney } from "./money.mjs";

export const CHART = Object.freeze({
  100: "Kasa (Nakit)",
  // 2.2.0 İz 4.2 (plan §3.11a): çek ve senet ayrı Tekdüzen hesaplarında (lib/cheque-gl.mjs) — önceden 101 "Alınan Çekler ve Senetler (Portföy)"
  // ve 103 "Verilen Çekler ve Senetler" ikisini birlikte tutuyordu.
  101: "Alınan Çekler",
  102: "Bankalar (Havale / EFT)",
  103: "Verilen Çekler ve Ödeme Emirleri (−)",
  108: "Kredi Kartı Tahsilatları (POS)",
  120: "Alıcılar (Müşteri Carileri)",
  121: "Alacak Senetleri",
  127: "Carisiz Taksit Kartları",
  // 2.3.0 İz 1 (plan §3.11b; lib/doubtful-gl.mjs): şüpheli ticari alacaklar ve karşılığı (129 eksi bakiyeli), karşılık gideri (654) ve konusu
  // kalmayan karşılık geliri (644). 659 zaten var (karşılıksız değersiz alacak).
  128: DOUBTFUL_CHART[128],
  129: DOUBTFUL_CHART[129],
  153: "Ticari Mallar (Stok Alımları)",
  // 2.4.3 MM3: KDV Mahsup Fişi'nin devreden KDV'si (indirilecek KDV hesaplanandan büyükse; sonraki ayın mahsubunda kullanılır).
  190: "Devreden KDV",
  191: "İndirilecek KDV",
  193: "Peşin Ödenen Vergiler (Stopaj)",
  255: "Demirbaşlar",
  // v2.1.0 (§3.11): banka kredisi ve kurumsal kredi kartı borcu.
  300: "Banka Kredileri",
  309: "Diğer Mali Borçlar (Kredi Kartları)",
  320: "Satıcılar (Tedarikçi Carileri)",
  321: "Borç Senetleri",
  336: "Diğer Cariler (Personel vb.)",
  360: "Ödenecek Vergi ve Fonlar (Tevkifat, Stopaj)",
  391: "Hesaplanan KDV",
  500: "Açılış ve Devir Bakiyeleri",
  600: "Yurt İçi Satışlar (Stok)",
  602: "Diğer Gelirler (Hizmet, Taksitli Satış, Kayıt Tahsilatları)",
  610: "Satıştan İadeler",
  // v2.1.0 (§3.11): faiz geliri ve kambiyo kârı (banka fişi, döviz değerlemesi).
  642: "Faiz Gelirleri",
  644: DOUBTFUL_CHART[644],
  646: "Kambiyo Kârları",
  // v2.1.0 Aşama 4 (plan §3.11): Tekdüzen Hesap Planı'ndaki adı. Kasa'ya elle giriş ve Banka Fişi'nin "Diğer Gelir"i buraya yazar (2.0.26'daki
  // ad "Diğer Olağan Gelirler (Kasaya Elle)"; tutarlar değişmez). Aşama 2'de (gözden geçirme D3) ad bilinçli olarak eski kalmıştı.
  649: "Diğer Olağan Gelir ve Kârlar",
  // v2.1.0 (§3.11): POS komisyonu, kambiyo zararı, diğer olağan giderler, finansman giderleri.
  653: "Komisyon Giderleri",
  654: DOUBTFUL_CHART[654],
  656: "Kambiyo Zararları",
  659: "Diğer Olağan Gider ve Zararlar",
  // 2.4.3 MM3: Tekdüzen Hesap Planı adı. Kapatılan taksit kartlarının vazgeçilen kalanı ve vergi ödemesinin gecikme zammı / faizi (KKEG) buraya yazılır
  // (önceki ad "Kapatılan Kartlardan Vazgeçilen Alacaklar"; tutarlar değişmez).
  689: "Diğer Olağandışı Gider ve Zararlar",
  760: "Pazarlama, Satış ve Dağıtım Giderleri",
  770: "Genel Giderler ve Alış Faturaları",
  780: "Finansman Giderleri",
});
// 128 (2.3.0 İz 1): şüpheli alacak satırları da cariyi taşır — carinin defter bakiyesi 120 + 128 = cari kartı (Şüpheli Alacağa Al cari bakiyesini
// değiştirmez; lib/doubtful-gl.mjs).
const PARTY_ACCOUNTS = new Set(["120", "127", "320", "336", DOUBTFUL_GL.doubtful]);
const CONTROL = { customer: "120", supplier: "320", other: "336" };
const cents = value => Math.round((Number(value) || 0) * 100);
/**
 * Cari açılış (devir) kaydı mı: notu "Açılış" ile başlar (cari Borç/Alacak Yaz açılışı, v2.0.13). Karşı hesap 500 "Açılış ve Devir Bakiyeleri" —
 * banka hesabının açılışı (lib/bank/voucher.mjs openingLines) ve taksit açılışıyla aynı. Kasa açılışı metinden DEĞİL, satırın işaretinden
 * (cash_entries.is_opening; Yargıç 2.2.0 Y2/Y3) tanınır.
 */
const opening = note => /^açılış/i.test(String(note || "").trim());
/** Kasa satırının vergi ödemesi ayrıntısı (MM3; cash_entries.tax_json): { type, taxMinor, lateMinor } ya da null. */
export function taxOf(row) {
  const raw = row?.taxJson ?? row?.tax_json;
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? { type: String(value.type || "other"), taxMinor: Math.max(0, Math.round(Number(value.taxMinor) || 0)), lateMinor: Math.max(0, Math.round(Number(value.lateMinor) || 0)) } : null;
  } catch {
    return null;
  }
}
/**
 * KDV Mahsup Fişi'nin satırları (MM3; kuruş): o = ayın 391 neti (alacak artı), i = ayın 191 neti (borç artı), p = kullanılan devreden (190), fark
 * o − i − p artıysa A 360 (ödenecek), eksiyse B 190 (yeni devreden). İşaretli tutarlar ters tarafa yazılır (ör. iadesi satışından büyük ay). Denge: B = A.
 */
export function vatOffsetLines(row) {
  const o = Math.round(Number(row.outMinor ?? row.out_minor) || 0);
  const i = Math.round(Number(row.inMinor ?? row.in_minor) || 0);
  const p = Math.round(Number(row.carryInMinor ?? row.carry_in_minor) || 0);
  const payable = Math.round(Number(row.payableMinor ?? row.payable_minor) || 0);
  const carry = Math.round(Number(row.carryOutMinor ?? row.carry_out_minor) || 0);
  const lines = [
    { account: "391", debit: Math.max(o, 0), credit: Math.max(-o, 0) },
    { account: "191", debit: Math.max(-i, 0), credit: Math.max(i, 0) },
    { account: "190", debit: carry, credit: 0 },
    { account: "190", debit: 0, credit: p },
    { account: "360", debit: 0, credit: payable },
  ];
  return lines.filter(line => line.debit > 0 || line.credit > 0);
}
/** Açılış stoku hareketinin değeri (TL, kuruşa yuvarlı): miktar × birim fiyat (MM4; yevmiye ve Mutabakat Testi aynı kural). */
export const stockOpeningValue = row => roundMoney((Number(row.qty) || 0) * (Number(row.unitPrice) || 0));
/** Hesabı atanmamış (fin_ref '') eski ve yeni banka/POS hareketlerinin alt hesapları (§3.11). */
export const UNASSIGNED_SUBS = Object.freeze({ "102.00": "Hesabı Atanmamış Eski Hareketler", "108.00": "Hesabı Atanmamış Eski Hareketler" });

/**
 * Para hareketinin ana ve alt hesabı (v2.1.0, §3.11; 2.0.26'daki cashAccount'un yerine): yol + bağ (fin_ref).
 *   nakit → 100 · havale → 102 (banka hesabının alt hesabı; bağsız 102.00) · POS → 108 (POS'un alt hesabı; bağsız 108.00) ·
 *   kurumsal kartla ödeme (kart hesabına bağlı) → 309 (kartın alt hesabı). Tanınmayan yol 2.0.26'daki gibi 100'e yazılır (eski
 *   verinin mizanı değişmez; money:method bu satırı ayrıca yakalar).
 * refs: { accounts: { [id]: { kind, gl, glSub } }, pos: { [id]: { glSub } } } — banka hesabı ve POS kartları.
 */
export function moneyAccount(method, ref = "", refs = {}) {
  const account = ref ? refs?.accounts?.[ref] : null;
  if (method === "bank") return { account: "102", sub: account && !["card", "loan"].includes(account.kind) ? account.glSub : "102.00" };
  if (method === "card") {
    if (account?.kind === "card") return { account: "309", sub: account.glSub };
    const pos = ref ? refs?.pos?.[ref] : null;
    return { account: "108", sub: pos ? pos.glSub : "108.00" };
  }
  // Kredi (v2.1.0 Aşama 3): yalnız Banka Fişi satırında (rol "loan", kredi hesabına bağlı); modül satırında kredi yolu yoktur.
  if (method === "loan") return { account: "300", sub: account?.kind === "loan" ? account.glSub : "300.00" };
  return { account: "100", sub: "" };
}

/**
 * Yevmiye maddeleri.
 * @param {object} rows  { payments, cashEntries, accountEntries, plans, planEntries, stockMoves, chequeEvents }
 *   accountEntries: { id, kind, amount, date, note, source, sourceId?, method, accountType, chequeDirection?, chequeInstrument?, moveReason? }
 *   doubtful: { records, provisions } (2.3.0 İz 1; lib/doubtful-gl.mjs applyDoubtfulToJournal) — şüpheli alacak kayıtları: carinin alacak
 *               satırları önce 128'den düşer; al / karşılık / 644 / çıkar maddeleri eklenir
 *   plans: { id, total, status, coversBalance, date, accountType (''/null: carisiz), paid }
 *   planEntries: { id, planId, kind, amount, date, method, chequeId, chequeInstrument?, opening, accountType, bankReturned? }  (çekli 'out' = karşılıksız ters kaydı)
 *   stockMoves: { id, kind, amount, date, pay, method, reason }   (yalnız Kasa'ya/Banka'ya yazanlar; cariye yazanlar
 *               cari hareketinden gelir — iki kez sayılmaz)
 *   chequeEvents: { id, kind: 'collect'|'pay', amount, date, method, instrument? }
 *   chequeCollections: { id, status, givenDate, closedDate, amountMinor, instrument?, closedByCollect, serialNo }
 *   (instrument: 'cheque' | 'note' — 2.2.0 İz 4.2: çek 101 / 103, senet 121 / 321; yoksa çek)
 *   invoices: { id, kind, date, number, glJson ([{ account, net }] TL kuruş), tryVat, tryWithheld, tryStoppage, tryPayable,
 *               accountType, party }  (yalnız kesilmiş; taslak ve iptal deftere girmez)
 *
 * Fatura (v2.0.15) çok satırlı tek yevmiye maddesidir; cariye yazılan borç/alacak satırı (account_entries, source =
 * 'invoice') faturanın kendisinden gelir, ikinci kez sayılmaz. Faturanın peşin tahsilat/ödemesi ayrı cari satırıdır
 * (Kasa ↔ cari), normal tahsilat gibi işlenir.
 *   satış / SMM      : B 120 ödenecek, B 193 stopaj  ·  A 600 matrah, A 391 (KDV − tevkifat)
 *   satıştan iade    : B 610 matrah, B 391 (KDV − tevkifat)  ·  A 120 ödenecek
 *   alış             : B 153/770/760/255 matrah, B 191 KDV  ·  A 360 (tevkifat + stopaj), A 320 ödenecek
 *   alıştan iade     : B 320 ödenecek, B 360 (tevkifat + stopaj)  ·  A 153/770/… matrah, A 191 KDV
 */
export function journal(rows) {
  const out = [];
  // party: cari kimliği. Kontrol hesaplarına (120/127/320/336) düşen satır hangi cariye/karta aitse onu taşır; cari
  // bazında mutabakat (her carinin ana defter bakiyesi = cari kartındaki bakiye) bununla yapılır.
  let party = "";
  // at: maddenin kaynak satırının YAZIM SIRASI (kaynak tablonun rowid'i; routes/ledger.mjs rows "seq"). Aynı gün aynı sınıfta madde sırası bununla
  // (journalOrder; ders 31, MM8). Yazım sırası taşımayan satır (eski çağıran) sınıfının sonuna, kimlik sırasıyla.
  let at = null;
  const stamp = entry => (Number.isFinite(at) ? Object.assign(entry, { seq: at }) : entry);
  // debit/credit: hesap kodu ya da { account, sub } (para hesapları alt hesabı taşır: 102.01, 108.00 …).
  const post = (id, date, source, text, debit, credit, amount) => {
    const value = cents(amount);
    if (!value) return;
    const line = (target, dr, cr) => {
      const { account, sub } = typeof target === "string" ? { account: target, sub: "" } : target;
      const out = { account, debit: dr, credit: cr };
      // Bankaya Tahsile Ver (plan §3.14): alınan evrak 101.01 / 121.01 (portföy) ya da 101.02 / 121.02 (bankaya tahsile verilen) alt hesabında
      // izlenir; alt hesabı verilmemiş 101 / 121 satırı portföydür. Σ 101.* = 101, Σ 121.* = 121 (alt hesap mutabakatı: cheque:collections).
      if (sub) out.sub = sub;
      else if (account === DOCUMENT_GL.cheque.received) out.sub = DOCUMENT_GL.cheque.portfolio;
      else if (account === DOCUMENT_GL.note.received) out.sub = DOCUMENT_GL.note.portfolio;
      if (PARTY_ACCOUNTS.has(account) && party) out.party = party;
      return out;
    };
    out.push(stamp({ id, date, source, text, lines: [line(debit, value, 0), line(credit, 0, value)] }));
  };
  const refs = rows.refs || {};
  const moneyOf = row => moneyAccount(row.method, row.ref || "", refs);
  // 2.2.0 İz 4.2 (plan §3.11a; lib/cheque-gl.mjs): evrakın hesabı türüne göre — çek 101 / 103, senet 121 / 321. Türü olmayan satır (eski
  // çağıran, evrakı bulunamayan satır) çektir.
  const received = (instrument, atBank = false) => {
    const gl = documentGl(instrument);
    return { account: gl.received, sub: atBank ? gl.bank : gl.portfolio };
  };
  const given = instrument => documentGl(instrument).given;
  for (const row of rows.payments || []) (at = row.seq), post(`payment:${row.id}`, row.date, "Kayıt tahsilatı", row.note || "Tahsilat", moneyOf(row), "602", row.amount);
  for (const row of rows.cashEntries || []) {
    at = row.seq;
    // v2.0.17: Kasa ↔ Banka transferi gelir/gider değildir — tek fiş, 100 ↔ 102 (nakit tarafı yazılır, banka tarafı atlanır). v2.1.0: banka
    // tarafının hesabı ikiz satırdan (bankRef; routes/ledger.mjs rows).
    if (row.transferId) {
      if (row.method !== "cash") continue;
      const bank = moneyAccount("bank", row.bankRef || "", refs);
      const cash = moneyAccount("cash");
      if (row.kind === "in") post(`transfer:${row.transferId}`, row.date, "Kasa ↔ Banka", row.description || "Bankadan Kasaya Aktarım", cash, bank, row.amount);
      else post(`transfer:${row.transferId}`, row.date, "Kasa ↔ Banka", row.description || "Kasadan Bankaya Yatırma", bank, cash, row.amount);
      continue;
    }
    // 2.2.0 İz 1.3 (K6; plan susuyor → yaygın Tekdüzen açılış fişi): Kasa'ya devreden nakit (Kasa → Açılış Bakiyesi'nin işaretli satırı) gelir
    // değildir: B 100 / A 500, banka/cari/taksit açılışıyla aynı karşı hesap. Yargıç Y2/Y3: açıklaması "Açılış …" olan sıradan giriş 2.1.0'daki
    // gibi 649'da kalır (eski veride kilitli dönem değişmez).
    if (row.kind === "in" && Number(row.isOpening) === 1) post(`cash:${row.id}`, row.date, "Kasa açılışı", row.description, moneyOf(row), "500", row.amount);
    // 2.4.3 MM3: Kasa'dan nakit Vergi Ödemesi — B 360 vergi · B 689 gecikme zammı / faizi (KKEG) / A 100 toplam (gider değil: 360'ı kapatır).
    else if (row.kind === "out" && taxOf(row)) {
      const tax = taxOf(row);
      const money = moneyOf(row);
      const lines = [
        { account: "360", debit: tax.taxMinor, credit: 0 },
        { account: "689", debit: tax.lateMinor, credit: 0 },
        { account: money.account, debit: 0, credit: cents(row.amount), ...(money.sub ? { sub: money.sub } : {}) },
      ].filter(line => line.debit > 0 || line.credit > 0);
      out.push(stamp({ id: `cash:${row.id}`, date: row.date, source: "Vergi Ödemesi", text: row.description || "Vergi ödemesi", lines }));
    }
    else if (row.kind === "in") post(`cash:${row.id}`, row.date, "Kasa", row.description || "Kasaya giriş", moneyOf(row), "649", row.amount);
    else post(`cash:${row.id}`, row.date, "Kasa", row.description || "Kasadan ödeme", "770", moneyOf(row), row.amount);
  }
  for (const row of rows.accountEntries || []) {
    party = row.party || "";
    at = row.seq;
    const control = CONTROL[row.accountType] || CONTROL.customer;
    const id = `account:${row.id}`;
    if (row.source === "cheque") {
      // Alınan evrak portföyde (101 çek, 121 senet), verilen evrak ödenecekte (103 çek, 321 senet) izlenir; cariye yazılan etki karşı taraftır.
      // Bankada tahsildeki evrak karşılıksız dönünce (plan §3.14 "Yevmiye mevcut bounce maddesinde A 101.02"): karşılıksız maddesinin alacağı
      // 101.02 / 121.02'dir (bankReturned: routes/ledger.mjs rows; ayrı kapanış maddesi yazılmaz).
      const counter = row.chequeDirection === "out" ? given(row.chequeInstrument) : received(row.chequeInstrument, Boolean(row.bankReturned));
      if (row.kind === "debt") post(id, row.date, "Çek / Senet", row.note, control, counter, row.amount);
      else post(id, row.date, "Çek / Senet", row.note, counter, control, row.amount);
      continue;
    }
    // Faturanın borç/alacak satırı faturanın maddesinden gelir (yukarıda değil, aşağıda invoices döngüsünde).
    if (row.source === "invoice" && (row.kind === "debt" || row.kind === "credit")) continue;
    // 2.3.0 İz 1 (plan §3.11b/3 "Değersiz Alacak Yaz"): cari kartındaki alacak satırı (source 'doubtful', kaydı source_id) B 659 / A 120; ayırma
    // kuralı (applyDoubtfulToJournal) alacağı kendi kaydının 128'ine, borcu karşılık kadar 129'a taşır.
    if (row.source === "doubtful") {
      const n = out.length;
      post(id, row.date, "Değersiz Alacak", row.note || "Değersiz alacak", DOUBTFUL_GL.loss, control, row.amount);
      if (out.length > n) out[out.length - 1].doubtful = { record: String(row.sourceId || ""), writeOff: true };
      continue;
    }
    if (row.source === "stock") {
      if (row.kind === "debt") post(id, row.date, "Stok (veresiye satış)", row.note, control, "600", row.amount);
      else post(id, row.date, row.moveReason === "return" ? "Stok (satış iadesi)" : "Stok (açık hesap alım)", row.note, row.moveReason === "return" ? "610" : "153", control, row.amount);
      continue;
    }
    if (row.kind === "debt") post(id, row.date, "Cari (borç yaz)", row.note, control, opening(row.note) ? "500" : "602", row.amount);
    else if (row.kind === "credit") post(id, row.date, "Cari (alacak yaz)", row.note, opening(row.note) ? "500" : "770", control, row.amount);
    else if (row.kind === "in") {
      // Karar 15.10.2026 (plan §3.11b/2; lib/doubtful-gl.mjs doubtfulSkipOf): "Normal Cari Hesaba İşle" işaretli tahsilat, fatura peşini ve
      // Kapatılacak Fatura bağlı tahsilat şüpheliden düşmez (A 120 kalır); ayırma kuralı bu işareti okur. SQL ikizi doubtfulCredits.
      const n = out.length;
      post(id, row.date, "Cari tahsilat", row.note, moneyOf(row), control, row.amount);
      if (out.length > n && doubtfulSkipOf(row)) out[out.length - 1].doubtful = { skip: true };
    } else if (row.kind === "out") post(id, row.date, "Cari ödeme", row.note, control, moneyOf(row), row.amount);
  }
  for (const plan of rows.plans || []) {
    party = plan.party || (plan.accountType ? "" : `plan:${plan.id}`);
    at = plan.seq;
    const control = plan.accountType ? CONTROL[plan.accountType] || CONTROL.customer : "127";
    // Mevcut borcu taksitlendiren kart ana deftere yeni alacak getirmez (borç caride zaten yazılı).
    if (!plan.coversBalance) post(`plan:${plan.id}`, plan.date, "Taksit kartı", "Taksitli satış / hizmet", control, "602", plan.total);
    if (plan.status === "closed") {
      const n = out.length;
      post(`plan-close:${plan.id}`, plan.closedOn && plan.closedOn > plan.date ? plan.closedOn : plan.date, "Taksit kartı kapatıldı", "Kalan alacaktan vazgeçildi", "689", control, Math.max(0, roundMoney((Number(plan.total) || 0) - (Number(plan.paid) || 0))));
      // Karar 15.10.2026 (plan §3.11b/2): kartın açılış tarihi — şüpheli kaydından SONRA açılan kartın satırı o kayıttan düşmez (doubtful-gl openedOn).
      // Kontrol turu 2 K1: "Mevcut borcu taksitlendir" (coversBalance) kartı yeni alacak değildir → tarih kapısı yok (lib/bank/doubtful.mjs SQL ikizi).
      if (out.length > n && plan.date && !plan.coversBalance) out[out.length - 1].doubtful = { openedOn: plan.date };
    }
  }
  for (const row of rows.planEntries || []) {
    party = row.party || (row.accountType ? "" : `plan:${row.planId}`);
    at = row.seq;
    const control = row.accountType ? CONTROL[row.accountType] || CONTROL.customer : "127";
    const id = `plan-entry:${row.id}`;
    if (row.kind === "in") {
      const debit = row.opening ? "500" : row.chequeId ? received(row.chequeInstrument) : moneyOf(row);
      const n = out.length;
      post(id, row.date, row.opening ? "Taksit açılışı (devir)" : row.chequeId ? "Taksit (çek/senetle)" : "Taksit tahsilatı", row.note, debit, control, row.amount);
      // Karar 15.10.2026 (plan §3.11b/2): kartın açılış tarihi (planDate) — şüpheli kaydından SONRA açılan kartın taksiti o kayıttan düşmez.
      // Kontrol turu 2 K1: kapsayan kartta (planCovers) tarih kapısı yok — taksit şüpheliden düşer.
      if (out.length > n && row.planDate && !Number(row.planCovers)) out[out.length - 1].doubtful = { openedOn: row.planDate };
    } else if (row.chequeId) {
      // Doğrulama T11 (plan §3.14): taksite sayılmış evrak karşılıksız döndü — karşılıksız günü B kart carisi / A 101 ya da 121 (bankada
      // tahsildeyse 101.02 / 121.02).
      post(id, row.date, "Taksit (karşılıksız çek/senet)", row.note, control, received(row.chequeInstrument, Boolean(row.bankReturned)), row.amount);
    } else post(id, row.date, "Taksit iadesi", row.note, control, moneyOf(row), row.amount);
  }
  party = "";
  for (const row of rows.stockMoves || []) {
    at = row.seq;
    const id = `stock:${row.id}`;
    if (row.kind === "out") post(id, row.date, "Stok (peşin satış)", row.note, moneyOf(row), "600", row.amount);
    else if (row.reason === "return") post(id, row.date, "Stok (peşin satış iadesi)", row.note, "610", moneyOf(row), row.amount);
    else post(id, row.date, "Stok (peşin alım)", row.note, "153", moneyOf(row), row.amount);
  }
  // MM4 (2.4.3; kullanıcı kararı 18.10.2026): açılış stoku (ürün kartındaki açılış miktarı, Excel'den ürün yüklemedeki miktar) — B 153 / A 500, tutar
  // miktar × birim fiyat (kuruşa yuvarlanır). Karşı hesap Kasa / banka / cari / taksit açılışlarıyla aynı (500). Para satırı değildir (Kasa'ya yazmaz).
  for (const row of rows.stockOpenings || []) (at = row.seq), post(`stock-open:${row.id}`, row.date, "Stok açılışı", `Açılış stoku${row.itemName ? `: ${row.itemName}` : ""}`, "153", "500", stockOpeningValue(row));
  // Çok satırlı madde (kuruş). Borç ve alacak toplamı eşit değilse madde yine yazılır; mizan "dengesiz" der (kapı yakalar).
  const postLines = (id, date, source, text, lines) => {
    const kept = lines.filter(line => line.amount > 0).map(line => {
      const out = { account: line.account, debit: line.side === "debit" ? line.amount : 0, credit: line.side === "credit" ? line.amount : 0 };
      return PARTY_ACCOUNTS.has(line.account) && party ? { ...out, party } : out;
    });
    if (kept.length) out.push(stamp({ id, date, source, text, lines: kept }));
  };
  for (const row of rows.invoices || []) {
    party = row.party || "";
    at = row.seq;
    const control = CONTROL[row.accountType] || CONTROL.customer;
    let groups = [];
    try {
      groups = JSON.parse(row.glJson || "[]");
    } catch {
      groups = [];
    }
    const nets = (Array.isArray(groups) ? groups : []).map(group => ({ account: String(group.account || "600"), amount: Math.round(Number(group.net) || 0) }));
    const vat = cents(row.tryVat);
    const withheld = cents(row.tryWithheld);
    const stoppage = cents(row.tryStoppage);
    const payable = cents(row.tryPayable);
    const label = `${row.number || "Taslak"}`;
    if (row.kind === "sale" || row.kind === "smm") {
      postLines(`invoice:${row.id}`, row.date, row.kind === "smm" ? "Serbest meslek makbuzu" : "Satış faturası", label, [
        { account: control, side: "debit", amount: payable },
        { account: "193", side: "debit", amount: stoppage },
        ...nets.map(net => ({ ...net, side: "credit" })),
        { account: "391", side: "credit", amount: vat - withheld },
      ]);
    } else if (row.kind === "sale_return") {
      postLines(`invoice:${row.id}`, row.date, "Satıştan iade faturası", label, [
        ...nets.map(net => ({ ...net, side: "debit" })),
        { account: "391", side: "debit", amount: vat - withheld },
        { account: control, side: "credit", amount: payable },
      ]);
    } else if (row.kind === "purchase") {
      postLines(`invoice:${row.id}`, row.date, "Alış faturası", label, [
        ...nets.map(net => ({ ...net, side: "debit" })),
        { account: "191", side: "debit", amount: vat },
        { account: "360", side: "credit", amount: withheld + stoppage },
        { account: control, side: "credit", amount: payable },
      ]);
    } else if (row.kind === "purchase_return") {
      postLines(`invoice:${row.id}`, row.date, "Alıştan iade faturası", label, [
        { account: control, side: "debit", amount: payable },
        { account: "360", side: "debit", amount: withheld + stoppage },
        ...nets.map(net => ({ ...net, side: "credit" })),
        { account: "191", side: "credit", amount: vat },
      ]);
    }
  }
  party = "";
  // Bankaya Tahsile Ver (plan §3.14): tahsil kaydı (cheque_collections) verilişte B 101.02 / A 101.01; Bankadan Geri Al ve bankadan
  // karşılıksız dönüşte B 101.01 / A 101.02 (kapanış tarihinde); tahsilde paranın karşılığı 101.02'dir (aşağıda). Tutar verilme başlığının
  // kuruşu (tahsildeki evrakın tutarı değişemez: 409 cheque-deposited).
  // Eski sürümde (tahsil kaydını bilmeyen kodla) tahsil edilen evrakın kaydını açılış onarımı (repair h) kapanış başlığıyla kapatır; o tahsilin
  // satırı 101.01'dendir, bu yüzden kayıt 101.02'den kapanış tarihinde geri döner (Bankadan Geri Al gibi).
  // Karşılıksız dönen (returned) kaydın kapanışı ayrı madde DEĞİLDİR: karşılıksız maddesi (cari borcu, taksit tahsilatının ters kaydı ya da
  // carisiz evrakın gider maddesi) alacağını 101.02'ye yazar (yukarıda, bankReturned). Kayıt tahsil olayıyla kapandıysa (closedByCollect) tahsil maddesi A 101.02 (aşağıda,
  // closesDeposit). İki bayrak da satır bazında SQL'de hesaplanır (routes/ledger.mjs): süzgeçli kurulumda (İşlem Kartı, kapı) aynı sonuç.
  // 2.2.0 İz 4.2: senedin kaydı 121.01 ↔ 121.02 (çekin 101.01 ↔ 101.02).
  for (const row of rows.chequeCollections || []) {
    at = row.seq;
    const amount = (Number(row.amountMinor) || 0) / 100;
    const label = `Evrak${row.serialNo ? ` No ${row.serialNo}` : ""}`;
    const portfolio = received(row.instrument);
    const atBank = received(row.instrument, true);
    post(`cheque-deposit:${row.id}`, row.givenDate, "Bankaya Tahsile Ver", label, atBank, portfolio, amount);
    if (row.status === "pending" || row.status === "returned" || !row.closedDate) continue;
    if (row.status === "collected" && row.closedByCollect) continue;
    post(`cheque-withdraw:${row.id}`, row.closedDate, row.status === "collected" ? "Tahsil Edildi (eski sürüm)" : "Bankadan Geri Al", label, portfolio, atBank, amount);
  }
  for (const row of rows.chequeEvents || []) {
    at = row.seq;
    const id = `cheque:${row.id}`;
    if (row.kind === "collect") post(id, row.date, "Çek / senet tahsili", row.note, moneyOf(row), received(row.instrument, Boolean(row.closesDeposit)), row.amount);
    else post(id, row.date, "Çek / senet ödemesi", row.note, given(row.instrument), moneyOf(row), row.amount);
  }
  // Banka Fişi (v2.1.0, §3.11/3): her işlem başlığının satırları tek madde; THP kodu ve alt hesap yazım anında saklanmıştır, kuruş doğrudan.
  const fis = new Map();
  for (const row of rows.bankLines || []) {
    if (!fis.has(row.eventId)) fis.set(row.eventId, { date: row.date, text: row.description || row.no || "Banka fişi", seq: row.eventSeq, lines: [] });
    fis.get(row.eventId).lines.push(row);
  }
  for (const [eventId, item] of fis) {
    const lines = item.lines
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .filter(line => Number(line.tryMinor) > 0)
      .map(line => ({ account: String(line.gl), debit: line.side === "D" ? Number(line.tryMinor) : 0, credit: line.side === "C" ? Number(line.tryMinor) : 0, ...(line.sub ? { sub: String(line.sub) } : {}) }));
    at = item.seq;
    if (lines.length) out.push(stamp({ id: `bank:${eventId}`, date: item.date, source: "Banka fişi", text: item.text, lines }));
  }
  // 2.4.3 MM3: KDV Mahsup Fişi (ay sonu tarihli; vat_offsets): ayın 391'i ve 191'i kapanır, fark 360'a (ödenecek) ya da 190'a (devreden); önceki
  // devreden (190) kullanılır. Geri alınan fiş (reversed) ters kaydıyla AYNI GÜN yazılır (ay sonu mizanı sıfırlanır, iz görünür).
  for (const row of rows.vatOffsets || []) {
    const lines = vatOffsetLines(row);
    if (!lines.length) continue;
    const label = `KDV Mahsup Fişi · ${row.month}`;
    at = row.seq;
    out.push(stamp({ id: `vat-offset:${row.id}`, date: row.date, source: "KDV Mahsup Fişi", text: label, lines }));
    if (row.status === "reversed") out.push(stamp({ id: `vat-offset-reverse:${row.id}`, date: row.date, source: "KDV Mahsup Fişi (Ters Kayıt)", text: `${label} · Geri Alındı`, lines: lines.map(line => ({ ...line, debit: line.credit, credit: line.debit })) }));
  }
  // 2.3.0 İz 1 (plan §3.11b; lib/doubtful-gl.mjs): şüpheli alacak kayıtları varsa carinin alacak satırları önce 128'den düşer (A 120 → A 128),
  // al / karşılık / 644 / çıkar maddeleri eklenir. Kayıt yoksa (ya da süzgeç yüklemediyse) yevmiye 2.2.0'dakiyle aynıdır.
  if (rows.doubtful?.records?.length) applyDoubtfulToJournal(out, rows.doubtful);
  out.sort(journalOrder);
  return out;
}

/**
 * Yevmiye madde sırası (2.4.4 MM8, mali müşavir 31b; ders 31 "aynı tarihli kayıtlar kimlikle sıralanmaz"): tarih → olay sınıfı → yazım sırası (kaynak
 * tablonun rowid'i; madde "seq") → kimlik (yalnız yazım sırası taşımayan eski çağıran için belirlenimci son anahtar). Önceden aynı günün maddeleri
 * kimliğe (önek + rastgele UUID) göre diziliyordu: "Çek ciro edildi" "Çek alındı"dan ve tahsil edilen faturadan önce görünebiliyordu.
 * Sınıf sırası (aynı gün): şüpheli alacağa al → karşılık (kâhin dili §4.15 / lib/doubtful-gl.mjs ORDER: al → karşılık → … → çıkar) → belgeler (fatura,
 * taksit kartı açılışı, açılış stoku: alacak / borç doğar) → para ve cari hareketleri, 2.0.26 Kasa satır listesinin kaynak sırasıyla (lib/bank/money-lines.mjs
 * MONEY_SOURCES rank: kayıt tahsilatı 1, Kasa 2, taksit tahsilatı 3, cari satırı 4, stok 5, çek/senet 6; Banka Fişi 9) → kart kapanışı → şüpheliden
 * çıkar / konusu kalmayan karşılık (§4.15 "çıkar") → ay sonu KDV Mahsup Fişi ve ters kaydı. Sıra yalnız gösterim sırasıdır: mizan, cari bakiyesi ve şüpheli
 * ayırması maddelerin sırasından bağımsızdır (ayırma kendi sırasını doubtful-gl'de kurar; test/yevmiye-sira-244.test.mjs).
 */
export const JOURNAL_CLASS = Object.freeze({
  "doubtful-take": 10,
  "doubtful-provision": 11,
  invoice: 20,
  plan: 21,
  "stock-open": 22,
  payment: 31,
  cash: 32,
  transfer: 32,
  "plan-entry": 33,
  account: 34,
  stock: 35,
  cheque: 36,
  "cheque-deposit": 36,
  "cheque-withdraw": 36,
  bank: 39,
  "plan-close": 50,
  "doubtful-644": 60,
  "doubtful-release": 61,
  "vat-offset": 70,
  "vat-offset-reverse": 71,
});
const classOf = id => JOURNAL_CLASS[String(id).slice(0, String(id).indexOf(":"))] ?? 90;
export function journalOrder(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const byClass = classOf(a.id) - classOf(b.id);
  if (byClass) return byClass;
  const sa = Number.isFinite(a.seq) ? a.seq : Infinity;
  const sb = Number.isFinite(b.seq) ? b.seq : Infinity;
  if (sa !== sb) return sa < sb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Alt hesap bakiyeleri (v2.1.0, §3.11): alt hesap kodu (102.01, 108.00 …) → kuruş (borç artı). Σ alt hesap = ana hesap. */
export function subBalances(entries, mains = null) {
  const out = new Map();
  for (const entry of entries) for (const line of entry.lines) if (line.sub && (!mains || mains.has(line.account))) out.set(line.sub, (out.get(line.sub) || 0) + line.debit - line.credit);
  return out;
}

/** Alt Hesap Mizanı (v2.1.0; rapor ekranı Aşama 3): alt hesap başına devir, dönem borç/alacak ve bakiye (TL). names: alt hesap → ad. */
export function subTrial(entries, { from = "", to = "", names = {} } = {}) {
  const subs = new Map();
  for (const entry of entries) {
    if (to && entry.date > to) continue;
    const before = from && entry.date < from;
    for (const line of entry.lines) {
      if (!line.sub) continue;
      const row = subs.get(line.sub) || { sub: line.sub, account: line.account, opening: 0, debit: 0, credit: 0 };
      if (before) row.opening += line.debit - line.credit;
      else {
        row.debit += line.debit;
        row.credit += line.credit;
      }
      subs.set(line.sub, row);
    }
  }
  const tl = value => roundMoney(value / 100);
  return [...subs.values()]
    .sort((a, b) => a.sub.localeCompare(b.sub))
    .map(row => ({ sub: row.sub, account: row.account, name: names[row.sub] || UNASSIGNED_SUBS[row.sub] || "", opening: tl(row.opening), debit: tl(row.debit), credit: tl(row.credit), balance: tl(row.opening + row.debit - row.credit) }));
}

/** Cari (ve carisiz kart) bazında kontrol hesabı bakiyeleri: party → kuruş (borç artı). */
export function partyBalances(entries) {
  const out = new Map();
  for (const entry of entries) for (const line of entry.lines) if (line.party) out.set(line.party, (out.get(line.party) || 0) + line.debit - line.credit);
  return out;
}

/** Hesap bazında mizan (kuruş tamsayısıyla toplanır; yuvarlama birikmez). */
export function trialBalance(entries, { from = "", to = "" } = {}) {
  const accounts = new Map();
  let debit = 0;
  let credit = 0;
  let unbalanced = 0;
  for (const entry of entries) {
    if (to && entry.date > to) continue;
    const before = from && entry.date < from;
    let own = 0;
    for (const line of entry.lines) {
      own += line.debit - line.credit;
      const row = accounts.get(line.account) || { code: line.account, name: CHART[line.account] || line.account, opening: 0, debit: 0, credit: 0 };
      if (before) row.opening += line.debit - line.credit;
      else {
        row.debit += line.debit;
        row.credit += line.credit;
        debit += line.debit;
        credit += line.credit;
      }
      accounts.set(line.account, row);
    }
    if (own !== 0) unbalanced += 1;
  }
  const rows = [...accounts.values()].sort((a, b) => a.code.localeCompare(b.code)).map(row => ({ ...row, balance: row.opening + row.debit - row.credit }));
  const tl = value => roundMoney(value / 100);
  return {
    accounts: rows.map(row => ({ code: row.code, name: row.name, opening: tl(row.opening), debit: tl(row.debit), credit: tl(row.credit), balance: tl(row.balance) })),
    totals: { debit: tl(debit), credit: tl(credit), difference: tl(debit - credit) },
    balanced: debit === credit && unbalanced === 0,
    unbalanced,
  };
}

/**
 * Mutabakat kapısı: ana defter bakiyesi = alt defterin kendi hesabı. expected: { code: tutar } (borç bakiyesi artı).
 * Kuruş farkı bile raporlanır.
 */
export function reconcile(trial, expected) {
  const balanceOf = code => trial.accounts.find(row => row.code === code)?.balance || 0;
  const checks = Object.entries(expected).map(([code, want]) => {
    const got = balanceOf(code);
    const difference = roundMoney(got - (Number(want) || 0));
    return { code, name: CHART[code] || code, ledger: got, subledger: roundMoney(Number(want) || 0), difference, ok: Math.abs(difference) < 0.005 };
  });
  return { ok: trial.balanced && checks.every(check => check.ok), balanced: trial.balanced, checks };
}
