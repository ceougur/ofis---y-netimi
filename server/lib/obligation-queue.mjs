// 2.5.0 Ç5-B — TEK YÜKÜMLÜLÜK KUYRUĞU (TYK; B1 "tek gecikmiş tanımı"). Saf işlev; veri tabanına dokunmaz. Tasarım: docs/erp/C5B-TYK-TASARIM.md, docs/erp/C5-ACILIS-TASARIM.md §2.10.
//
// Kurallar (yalnız kullanıcı kararlarından — iş listesi D; kaynak her maddenin yanında):
//   S1 = A ......... vadesiz kalemin vadesi belge / işlem günü; ertesi gün gecikmiş. M1f: gecikmiş ⇔ vade < bugün (vade günü gecikmiş değil), tatil kaydırması yok.
//   S2 = A ......... bağlamadan yapılan ödeme "vadesi en önce gelen" borcu kapatır: sıra vade ↑ → belge tarihi ↑ → kayıt anı ↑ → yazım sırası ↑ (ders 31).
//   S68 = A ........ bizim bağlamadan yaptığımız ödeme de aynı sırayla (iki yön).
//   karar (1) = A .. bağsız ödeme KENDİ tarihinde (o gün dahil) açık olan borçlara dağılır; aynı gün önce borç kalemleri; artanı avanstır, sonra doğan kaleme doğduğu gün;
//                    kapanmış kalem sonradan doğan kalem yüzünden yeniden açılmaz.
//   karar (2) = A .. bağ (peşin, Kapatılacak Fatura, çek / senet bağı, iade → asıl fatura, iade geri ödemesi, kart tahsilatı, Mahsup Et) hedefini HER DURUMDA kapatır; hedefi
//                    önceden kapatmış bağsız ödeme serbest kalır ve kendi tarihinde yeniden dağılır (bağlar zamandan bağımsız ÖNCE ayrılır).
//   karar (3) = A .. kilitli dönemde bağsız kapanmış kalem kilitten sonraki bağla yeniden açılmaz; bağın o kısmı bağsız gibi dağılır (kapatanlarda "kilit" notu).
//   S8 = A ......... evrakın kapattığı fatura karşılıksızla yeniden açılır, KENDİ vadesiyle (UX18 netleştirmesi aynen).
//   S11 / S18 / S19  evrak kilitli dönemde alındıysa ve karşılıksız kilitten sonra yazıldıysa (kilit = karşılıksızın YAZILDIĞI andaki kilit, bir kez): kapanış değişmez,
//                    karşılıksızın TAMAMI ayrı borç kalemi (vade = karşılıksız günü).
//   S50 = A, M1a ... kart seçilmeden alınan tahsilat taksit kartlarının taksitlerini de kapatır (tek kuyruk); K8-3: vadesi gelmemiş taksit de S2 sırasıyla.
//   M1e ............ taksit kartı alttaki kalemi TÜKETİR, kuyrukta yalnız taksitler; "Carinin Mevcut Borcu" kartı açıldığı an açık borçları S2 sırasıyla tüketir.
//   karar (5) = A .. "Bakiyeden Netleşsin": NET görünümde alış faturası / Alacak Yaz satış borcuna kendi tarihinde uygulanır (gecikmiş ≤ net borç); FATURA DURUMU ayrı
//                    görünüm — karşı yönlü iki fatura birbirini yalnız Mahsup Et ile kapatır.
//   M13, S3 ........ şüpheli kaydın kalanı açık borç kalemlerinden S2 sırasıyla şüpheli kuyruğuna alınır (gecikmişe girmez).
//
// İki görünüm, tek motor (aynı olay sırası, aynı bağ / kart / karşılıksız / kilit kuralı):
//   "net"  (G1, TYK): her cari satırı borç (+) ya da alacak (−) kalemidir; gelen kalem karşı taraftaki açık kalemleri kapatır (iki taraf birden açık değil).
//   "side" (G2, fatura durumu): classifyLine rolleri (lib/invoice-settle.mjs) — yalnız ödeme rolündeki satır aynı tarafın yükümlülüğünü kapatır.
// Yazma yolları (taksitli faturanın kendi kartının hedefi, iade → kapsayan kartın küçülmesi, açılış onarımı) lib/invoice-settle.mjs'i AYNEN kullanır (defter kuralı değişmez).
import { roundMoney } from "./money.mjs";
import { classifyLine, PAY_STATES } from "./invoice-settle.mjs";

export { PAY_STATES };
// Kapatanlar listesinin yolu (fatura kartı "Bu Faturayı Kapatanlar").
export const CLOSER_MODES = Object.freeze({ linked: "Bağlı", auto: "Otomatik (vadesi en önce gelen)", offset: "Mahsup", locked: "Bağsız (kilitli dönemde kapanmıştı)" });

const cents = value => Math.round((Number(value) || 0) * 100);
const RECEIVABLE = new Set(["sale", "smm"]);
const PAYABLE = new Set(["purchase"]);
const RETURNS = new Set(["sale_return", "purchase_return"]);
const STOCK_RETURNS = new Set(["return", "preturn"]);
const EPS = 0; // kuruşla çalışılır

/** Denetim izinden kilit geçmişi: [{ at, value }] (yazım sırasıyla). rows: audit_events (ledger.period.locked / unlocked) { at, payload }. */
export function lockHistory(rows = []) {
  const out = [];
  for (const row of rows) {
    let payload = row.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload || "{}");
      } catch {
        payload = {};
      }
    }
    out.push({ at: String(row.at || ""), value: row.type === "ledger.period.unlocked" ? "" : String(payload?.lockedUntil || "") });
  }
  return out;
}
/** Verilen kayıt anındaki kilit günü (o andan önceki son kilit kaydı; yoksa ""). B12 (yazım anındaki kilit) — göç yerine iz okuması. */
export function lockAtOf(history = []) {
  if (!history.length) return Object.assign(() => "", { active: false });
  return Object.assign(at => {
    const when = String(at || "");
    let value = "";
    for (const row of history) {
      if (row.at > when) break;
      value = row.value;
    }
    return value;
  }, { active: true });
}

// S2 anahtarı: vade ↑ → belge tarihi ↑ → kayıt anı ↑ → yazım sırası ↑ → alt sıra (taksit no).
const s2 = (a, b) =>
  a.vade !== b.vade ? (a.vade < b.vade ? -1 : 1)
  : a.date !== b.date ? (a.date < b.date ? -1 : 1)
  : a.at !== b.at ? (a.at < b.at ? -1 : 1)
  : a.rank !== b.rank ? a.rank - b.rank
  : a.sub - b.sub;
// Olay anahtarı: tarih → gün sınıfı (0 borç / yükümlülük, 2 ödeme / alacak ve Mevcut Borç kartı açılışı) → kayıt anı → yazım sırası → alt sıra.
const eventOrder = (a, b) =>
  a.date !== b.date ? (a.date < b.date ? -1 : 1)
  : a.cls !== b.cls ? a.cls - b.cls
  : a.at !== b.at ? (a.at < b.at ? -1 : 1)
  : a.rank !== b.rank ? a.rank - b.rank
  : a.sub - b.sub;

/**
 * Takvim / zil / Vade Takip kaleminin günü ve durumu (S67, S69 = A; BAŞ MİMAR Y3-1, Y3-2; K6.3).
 * vade geçmişse (vade < bugün): durum "overdue", gün sayısı min(söz, vade)'den; değilse K6.3 aynen (tarih = söz varsa söz, gün sayısı ondan).
 */
export function calendarState({ vade, promise = "", day }) {
  const gap = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  const date = promise || vade;
  if (vade < day) {
    const from = promise && promise < vade ? promise : vade;
    return { date, days: gap(day, from), state: "overdue" };
  }
  const days = gap(day, date);
  return { date, days, state: days === 0 ? "today" : days < 0 ? "overdue" : "upcoming" };
}

/**
 * @param {object} input settleLedger girdisi + { schedules: Map<kartId, [{ id, seq, dueDate, amount }]>, dueDates: Map<satırId, gün>, promises: Map<satırId, gün>,
 *   doubtfulRecords: [{ date, remainingMinor }], lockAt: (an) → gün }
 * @returns {{ invoices, entries, items, installments, doubtful, overdue: (day) => object, cards }}
 */
export function buildObligations(input) {
  const pieces = implicitRefunds(input);
  const side = runQueue(input, "side", pieces);
  const net = runQueue(input, "net", pieces);
  return assemble(input, side, net);
}

// 2.4.6 K-b + KS8.1 (BAŞ MİMAR; lib/invoice-settle.mjs passes ile aynı iki aşama, fatura durumu kuralıyla ölçülür, iki görünüm de aynı parçaları kullanır): iadeye bağlanmamış para
// (cari kartı Tahsilat / Ödeme, çek / senet) (a) karşı tarafın AÇIK iadesini kendi tarafının yükümlülükleriyle TEK sırada kapatır; (b) yükümlülüklerden ARTANI, bir borcu kapatmış
// iadenin (en eski önce; üst sınır iadenin geri ödeme dışında kapattığı, taksitli faturaya mahsup hariç) geri ödemesidir. İkisi de açık bağ gibi iadenin geri ödemesi sayılır.
// Dönüş: ödeme satırı kimliği → [{ noteKey, amount (kuruş) }].
function implicitRefunds(input) {
  const out = new Map();
  const give = (lineId, noteKey, amount) => {
    if (!(amount > 0)) return;
    if (!out.has(lineId)) out.set(lineId, []);
    out.get(lineId).push({ noteKey, amount });
  };
  const isMoney = item => !item.linkedOnly && item.kind === "payment" && (item.line?.origin === "account" || item.line?.origin === "cheque");
  const first = queueOnce(input, "side", null);
  const noteKeyOf = item => (item.kind === "note" ? item.line.sourceId : item.line?.origin === "stock" ? item.line.sourceId || "" : "");
  const isNote = item => Boolean(noteKeyOf(item)) && !item.due;
  const openNotes = first.items.filter(item => isNote(item) && item.left > 0);
  const hasMoney = sideName => first.items.some(item => isMoney(item) && item.side === sideName);
  const pseudo = openNotes.filter(note => hasMoney(note.side === "r" ? "p" : "r")).map(note => ({ noteKey: noteKeyOf(note), side: note.side === "r" ? "p" : "r", amount: note.left, date: note.date, at: note.at, rank: note.rank }));
  const second = pseudo.length ? queueOnce(input, "side", null, { pseudo }) : first;
  for (const item of second.items) if (item.kind === "pseudo") for (const c of item.closures) if (!c.reverse && c.payer?.lineId) give(c.payer.lineId, item.noteKey, c.amount);
  for (const sideName of ["r", "p"]) {
    const otherSide = sideName === "r" ? "p" : "r";
    const notes = second.items.filter(item => isNote(item) && item.side === otherSide).map(item => ({ key: noteKeyOf(item), item, cap: item.closures.filter(c => c.reverse && c.payer?.due && !c.payer.ownCard && c.payer.kind !== "pseudo").reduce((sum, c) => sum + c.amount, 0) })).filter(note => note.cap > 0).sort((a, b) => eventOrder(a.item, b.item));
    if (!notes.length) continue;
    for (const money of second.items.filter(item => isMoney(item) && item.side === sideName && item.left > 0).sort(eventOrder)) {
      let rest = money.left;
      for (const note of notes) {
        if (!(rest > 0)) break;
        const take = Math.min(rest, note.cap);
        if (!(take > 0)) continue;
        note.cap -= take;
        rest -= take;
        give(money.lineId, note.key, take);
      }
    }
  }
  return out;
}

// Mevcut Borç kartının kapsamı (v2.0.23 kuralı AYNEN; invoice-settle.mjs coverPlans / known): kart, AÇILDIĞI ANA KADAR KAYDEDİLMİŞ satırlarla açık olan borcu tüketir —
// karttan sonra yazılan satır (geriye tarihli ödeme, kartın açıldığı anda portföyde olan evrakın sonraki karşılıksızı …) kartın neyi tükettiğini değiştirmez (UX18 T17 (i),
// T15). Bilinen satırlarla bir ön geçiş oynatılır; kartın o geçişte tükettiği kalemler (anahtar → tutar) asıl geçişte önce tüketilir. Bütün satırlar kartın anında
// biliniyorsa ön geçiş yapılmaz (asıl geçişle aynı sonuç).
// Ç5-B tur 2a (Y-1; beklenen v2.4.9'un gerçek kodu): Kayıt Tarihi tükettiği borcun gününden ÖNCE olan kart (stoktan veresiye satış → taksitlendir carinin Kayıt Tarihi'ni
// alır; Excel'den bakiyeli kart; elle geriye tarihli kart) Kayıt Tarihi'nde açık borç bulamıyor, taksitleri sıfıra kırpılıyordu. `late` kümesindeki kartlar (asıl geçişte
// kapasitesini Kayıt Tarihi'nde dolduramayan VE kartın anında bilinen, Kayıt Tarihi'nden sonra tarihli borç satırı olan — lateCovers) ön geçişte BİLİNEN SATIRLARIN SONUNDA
// açılır (kartın anındaki açık borç; v2.4.9'da kapsam bilinen satırların son durumuydu); asıl geçişte açılış günü (ve taksitlerinin doğduğu gün) Kayıt Tarihi ile tükettiği
// kalemlerin en geç doğduğu günün büyüğüdür — kart tükettiği borçtan önce açılamaz. Kayıt Tarihi'nde kapasitesini dolduran kartın davranışı değişmez. Kartlar kayıt anı
// sırasıyla: sonraki kartın ön geçişi öncekilerin kapsamını görür. Dönüş: kart kimliği → { entries: [{ key, take }], date } ya da null.
// KULLANICI KARARI BEKLENİYOR (ders 43; tur 2a raporu "KULLANICIYA SORULMALI"): kartın anında açık borç kart tutarından fazlaysa HANGİ borcun tükeneceği iki okumaya açık —
// S2 sırası (tasarım §9, C5-ACILIS §2.10 madde 2) ya da kartın kendi (en son kaydedilen) borcu (v2.0.23 / v2.4.9; test/bulgu-223 #4 "stoktan taksitli satışın kartı ilgisiz
// eski faturayı kapatmaz"). İki okuma farklı kalem seçiyorsa (`ambiguous`) kart kaydırılmaz — davranış bugünkü gibi kalır, karar gelince tek satırda değişir.
const END_OF_STREAM = "\uffff";
const coverLines = input => (input.lines || []).filter(line => line.origin === "plan" && line.kind === "plan" && line.covers && line.planId && line.at).sort((a, b) => (String(a.at) === String(b.at) ? 0 : String(a.at) < String(b.at) ? -1 : 1));
const bornOf = input => {
  const issued = new Map((input.invoices || []).map(invoice => [invoice.id, invoice.issuedAt || ""]));
  return line => String((line.origin === "invoice" ? issued.get(line.sourceId) : "") || line.at || "");
};
function coverForcing(input, mode, pieces, late = null, ambiguous = null) {
  const { lines = [], offsets = [] } = input;
  const covers = coverLines(input);
  if (!covers.length) return null;
  const born = bornOf(input);
  const forced = new Map();
  for (const cover of covers) {
    const at = String(cover.at);
    const known = lines.filter(line => born(line) <= at);
    const shift = Boolean(late?.has(cover.planId));
    if (known.length === lines.length && !shift) continue;
    const state = queueOnce({ ...input, lines: known, offsets: offsets.filter(offset => String(offset.createdAt || offset.date || "") <= at) }, mode, null, { pieces, forced: forced.size ? forced : null, endCover: shift ? cover.planId : "" });
    const card = state.cards.get(cover.planId);
    if (shift && card?.ambiguous) {
      ambiguous?.add(cover.planId); // tanı (tur 2b-1, DÜŞÜK-2): S110 sınıfı — davranış değişmez
      continue;
    }
    const consumed = card?.consumedFrom || [];
    if (!shift && !consumed.length) continue;
    const date = consumed.reduce((max, entry) => (entry.target.born > max ? entry.target.born : max), String(cover.date || ""));
    forced.set(cover.planId, { entries: consumed.map(entry => ({ key: entry.target.key, take: entry.take })), date });
  }
  return forced.size ? forced : null;
}
// Y-1: asıl geçişte Kayıt Tarihi'nde kapasitesini dolduramayan ve kartın anında bilinen, Kayıt Tarihi'nden sonra tarihli borç satırı olan Mevcut Borç kartları.
function lateCovers(input, state) {
  const born = bornOf(input);
  const out = new Set();
  for (const cover of coverLines(input)) {
    const card = state.cards.get(cover.planId);
    if (!card || card.kind !== "cover" || !(card.consumed < Math.min(card.coverTotal, card.capacity ?? 0))) continue;
    const at = String(cover.at);
    if ((input.lines || []).some(line => line.date > cover.date && line.origin !== "plan" && cents(line.debit) > 0 && born(line) <= at)) out.add(cover.planId);
  }
  return out;
}

function runQueue(input, mode, pieces) {
  let forced = coverForcing(input, mode, pieces);
  let state = queueOnce(input, mode, null, { pieces, forced });
  const late = lateCovers(input, state);
  const ambiguous = new Set();
  if (late.size) {
    forced = coverForcing(input, mode, pieces, late, ambiguous);
    state = queueOnce(input, mode, null, { pieces, forced });
  }
  const tagged = result => Object.assign(result, { ambiguousCovers: ambiguous });
  // karar (3): kilit duyarlı bağlar varsa önce o bağlar SERBEST sayılarak oynatılır; hedefin kilit gününe kadar bağsız kapanmış kısmı ölçülür, ikinci geçişte bağ yalnız kalanı ayırır.
  if (state.lockLinks.length) {
    const probe = queueOnce(input, mode, new Map(state.lockLinks.map(link => [link.id, null])), { pieces, forced });
    const caps = new Map();
    for (const link of state.lockLinks) {
      const target = probe.itemByKey.get(link.targetKey);
      // FATURA DURUMU (G2, "side"): taksitli faturanın kendi kartı ve peşin kısmı yalnız BAĞLI ödemeyle kapanmış sayılır (assemble linkedLeft; v2.0.23 Bulgu 2, v2.0.24
      // "taksitli faturanın açığı = kartın kalanı") — G2'de bağsız kapanışları YOKTUR, karar (3)'ün koruyacağı "kilitli dönemde bağsız kapanmış" kısım da yoktur. Sayılsaydı
      // kart tahsilatı kilitten önceki bağsız avans yüzünden bağsız dağılır, fatura açık kalırdı (kart ödenmişken; mutabakat yıl dönümü tohum 39). NET görünüm (G1) aynen.
      const closedByL = target && !(mode === "side" && target.ownCard) ? target.freeClosures.filter(c => c.date <= link.lock).reduce((sum, c) => sum + c.amount, 0) : 0;
      caps.set(link.id, closedByL);
    }
    return tagged(queueOnce(input, mode, caps, { pieces, forced }));
  }
  return tagged(state);
}

function queueOnce(input, mode, lockCaps, { pieces = null, pseudo = null, forced = null, endCover = "" } = {}) {
  const { lines = [], invoices = [], links = new Map(), chequeEvents = new Map(), reversals = new Map(), offsets = [], schedules = new Map(), dueDates = new Map(), promises = new Map(), lockAt = () => "", linkTimes = new Map(), linkMoments = new Map() } = input;
  // Bağın kurulduğu an (O-1): düzeltmeyle kurulan / değişen bağda düzeltmenin anı, öbür durumda kaydın anı (routes/invoices.mjs linkTimesOf). Çek / senet satırında KESİN an
  // (tur 2b-1 ORTA-1; routes/invoices.mjs chequeLinkMoments): evrak düzeltmesi satırı yeniden yazsa da bağ değişmediyse an değişmez.
  const linkedAt = (lineId, at) => {
    if (linkMoments.has(lineId)) return linkMoments.get(lineId);
    const edited = linkTimes.get(lineId) || "";
    return edited > String(at || "") ? edited : String(at || "");
  };
  const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
  const planOwner = new Map(invoices.filter(invoice => invoice.planId).map(invoice => [invoice.planId, invoice.id]));
  const sorted = [...lines].sort((a, b) => (a.date === b.date ? String(a.at || "").localeCompare(String(b.at || "")) : a.date < b.date ? -1 : 1));
  const rank = new Map(sorted.map((line, index) => [line.id, index]));
  const kindOf = line => (line.origin === "invoice" ? byId.get(line.sourceId)?.kind || "" : "");
  // Karşılıksız ↔ alış / ciro çifti (UX18; lib/invoice-settle.mjs ile aynı süzgeç) — S11 / S18 / S19 kilit istisnası hariç birlikte çıkar.
  const netted = new Set();
  const lineById = new Map(lines.map(line => [line.id, line]));
  for (const [bounceId, reversedId] of reversals) {
    const bounce = lineById.get(bounceId);
    const reversed = lineById.get(reversedId);
    if (!bounce || !reversed || chequeEvents.get(bounceId) !== "bounce") continue;
    if (byId.get(links.get(reversedId) || "")?.planId) continue;
    if ((cents(bounce.debit) > 0) !== (cents(reversed.credit) > 0)) continue;
    if ((cents(bounce.debit) || cents(bounce.credit)) !== (cents(reversed.debit) || cents(reversed.credit))) continue;
    const lock = lockAt(bounce.at);
    if (lock && reversed.date <= lock) continue; // S11 / S18 / S19: kapanış değişmez, karşılıksız ayrı borç
    netted.add(bounceId);
    netted.add(reversedId);
  }
  const items = [];
  const itemByKey = new Map();
  const add = item => {
    item.left = item.amount;
    item.closures = [];
    item.freeClosures = [];
    item.covered = new Map();
    item.sub = item.sub || 0;
    items.push(item);
    itemByKey.set(item.key, item);
    return item;
  };
  const roleOf = line => classifyLine(line, { invoiceKind: kindOf(line), chequeEvent: chequeEvents.get(line.id) || "" });
  const sideOfRole = role => (role.recvDue || role.recvPay ? "r" : "p");
  const cards = new Map();
  // Kart: yapı satırı (kartın borç satırı / taksitli fatura) türünü ve gününü verir; ödemeler sırada önce gelse de kart bir kez kurulur.
  const cardOf = (planId, kind, base = null) => {
    if (!cards.has(planId)) cards.set(planId, { planId, kind: kind || "separate", installments: [], payments: [], consumed: 0 });
    const card = cards.get(planId);
    if (kind && base) Object.assign(card, { kind, ...base });
    return card;
  };
  // Kartın taksitleri: tutar `cap`'i aşarsa son taksitlerden kırpılır (plans.mjs capToRemaining ile aynı yön); azsa kalan tek kalem (vade = kart günü).
  const addInstallments = (card, cap, { date, at, rankValue }) => {
    const list = [...(schedules.get(card.planId) || [])].sort((a, b) => (a.dueDate === b.dueDate ? (a.seq || 0) - (b.seq || 0) : a.dueDate < b.dueDate ? -1 : 1));
    let room = cap;
    let sub = 1;
    for (const row of list) {
      const amount = Math.max(0, Math.min(cents(row.amount), room));
      room -= amount;
      if (!(amount > 0)) continue;
      card.installments.push(add({ key: `plan:${card.planId}:${row.id}`, kind: "installment", planId: card.planId, itemId: row.id, seq: row.seq, sign: 1, side: "r", due: true, amount, date, vade: row.dueDate || date, at, rank: rankValue, sub: sub++, cls: card.kind === "cover" ? 2 : 0, born: date }));
    }
    if (room > 0) card.installments.push(add({ key: `plan:${card.planId}:rest`, kind: "plan-rest", planId: card.planId, itemId: "", sign: 1, side: "r", due: true, amount: room, date, vade: date, at, rank: rankValue, sub: sub++, cls: card.kind === "cover" ? 2 : 0, born: date }));
  };
  const linkList = []; // { from: item, to: () => targets[], order, mode, lockable }
  const noteItems = new Map();
  for (const line of sorted) {
    if (netted.has(line.id)) continue;
    const amount = cents(line.debit) || cents(line.credit);
    const sign = cents(line.debit) > 0 ? 1 : -1;
    const at = String(line.at || "");
    const r = rank.get(line.id) ?? 0;
    const base = { lineId: line.id, line, sign, date: line.date, at, rank: r, born: line.date };
    if (line.origin === "plan") {
      if (line.kind === "plan") {
        if (planOwner.has(line.planId)) continue; // faturanın kendi kartı: fatura satırında kurulur
        if (line.covers) {
          // Açılış günü: ön geçişte bilinen satırların sonu; asıl geçişte Kayıt Tarihi ile tükettiği kalemlerin en geç doğduğu günün büyüğü (coverForcing; Y-1).
          const shifted = forced?.get(line.planId)?.date || "";
          const opened = endCover === line.planId ? END_OF_STREAM : shifted > line.date ? shifted : line.date;
          const card = cardOf(line.planId, "cover", { date: opened, at, rank: r, coverTotal: cents(line.coverTotal) });
          // Kapsam tutarı (coverTotal) kartın açıldığı andaki tutardır; kart sonradan küçültülmüşse (iade → coverState, Tutarı Düzenle) taksitleri bugünkü tutardır —
          // eksik kısım "kalan tek kalem" olarak geri EKLENMEZ (iade-210 K: kart 250, Vade Takip 250).
          const scheduled = (schedules.get(line.planId) || []).reduce((sum, row) => sum + cents(row.amount), 0);
          addInstallments(card, Math.min(cents(line.coverTotal), scheduled || cents(line.coverTotal)), { date: opened, at, rankValue: r });
          continue;
        }
        // Ayrı kart (Yeni Borç / Excel / Tablodan Aktar): kartın borç satırı kartça tüketilir; kuyruğa taksitler girer.
        const card = cardOf(line.planId, "separate", { date: line.date, at, rank: r });
        card.consumed = amount;
        addInstallments(card, amount, { date: line.date, at, rankValue: r });
        continue;
      }
      if (!amount) continue;
      // Kart tahsilatı / taksit iadesi / Kartı Kapat kalanı: kartın bağı.
      cardOf(line.planId, null).payments.push({ line, amount: sign < 0 ? amount : -amount });
      continue;
    }
    if (!amount) continue;
    const role = roleOf(line);
    const due = role.recvDue || role.payDue;
    const kind = line.origin === "invoice" && line.kind !== "in" && line.kind !== "out" ? (RETURNS.has(kindOf(line)) ? "note" : "invoice") : line.origin === "account" && (line.kind === "debt" || line.kind === "credit") ? "entry" : line.origin === "cheque" && chequeEvents.get(line.id) === "bounce" ? "bounce" : line.origin === "stock" ? "stock" : due ? "due" : "payment";
    const vade = kind === "invoice" ? byId.get(line.sourceId)?.dueDate || line.date : kind === "entry" ? dueDates.get(line.id) || line.date : line.date;
    // recorded: borcun DOĞDUĞU an (v2.0.23; fatura için kaydedildiği an, öbürleri satırın kaydı) — Mevcut Borç kartı yalnız kendisinden önce doğmuş borcu tüketir.
    const recorded = String((kind === "invoice" ? byId.get(line.sourceId)?.issuedAt : "") || at || "");
    const item = add({ ...base, key: kind === "invoice" ? `inv:${line.sourceId}` : `line:${line.id}`, kind, invoiceId: kind === "invoice" ? line.sourceId : "", role, side: sideOfRole(role), due, amount, vade, cls: due ? 0 : 2, promise: promises.get(line.id) || "", recorded });
    if (kind === "invoice") {
      const invoice = byId.get(line.sourceId);
      if (invoice?.planId) {
        // Taksitli fatura (M1e): kendi kartı faturanın kart kısmını tüketir; fatura kalemi peşin kısmıdır.
        const consumed = Math.min(cents(invoice.planTotal ?? 0), amount);
        item.amount -= consumed;
        item.left = item.amount;
        const card = cardOf(invoice.planId, "own", { date: line.date, at, rank: r, invoiceId: invoice.id });
        card.consumed = consumed;
        addInstallments(card, consumed, { date: line.date, at, rankValue: r });
        item.ownCard = true;
        for (const inst of card.installments) inst.ownCard = true;
      }
    }
    if (kind === "note") noteItems.set(line.sourceId, item);
    if (line.origin === "stock" && STOCK_RETURNS.has(line.stockReason) && line.sourceId) noteItems.set(line.sourceId, item);
    // Bağlar.
    if (line.origin === "pos-fee") {
      const owner = links.get(line.id) || "";
      item.linkedOnly = mode === "side";
      if (owner) linkList.push({ id: `pos:${line.id}`, from: item, targetKey: `inv:${owner}`, order: 5 });
      continue;
    }
    const documentRefund = line.origin === "invoice" && ((line.kind === "out" && kindOf(line) === "sale_return") || (line.kind === "in" && kindOf(line) === "purchase_return"));
    if (documentRefund) {
      linkList.push({ id: `ref:${line.id}`, from: item, noteKey: line.sourceId, order: 0 });
      continue;
    }
    if (line.origin === "account" && line.refundOf && (line.kind === "in" || line.kind === "out")) {
      linkList.push({ id: `ref:${line.id}`, from: item, noteKey: String(line.refundOf), order: 1, refundLeftRole: line.kind === "out" ? "payPay" : "recvPay", explicit: true });
      continue;
    }
    if (kind === "note") {
      const original = byId.get(line.sourceId)?.originalId || "";
      if (original) linkList.push({ id: `ret:${line.id}`, from: item, targetKey: `inv:${original}`, order: 4, lockable: true });
      continue;
    }
    const linked = links.get(line.id) || "";
    if (linked && kind !== "invoice") {
      const target = byId.get(linked);
      if (target && RETURNS.has(target.kind)) {
        linkList.push({ id: `ref:${line.id}`, from: item, noteKey: linked, order: 1 });
      } else {
        // Faturanın kendi ödemesi (peşin, kendi evrakı, ciro) faturayla birlikte yazılır; Kapatılacak Fatura / evrak bağı sonradan da kurulabilir (karar (3) için kilit duyarlı).
        const own = line.origin === "invoice" && line.sourceId === linked;
        linkList.push({ id: `lnk:${line.id}`, from: item, targetKey: `inv:${linked}`, order: 3, lockable: !own });
      }
    }
  }
  // Kapama yardımcıları.
  const close = (target, payer, amount, mode_, date = payer?.date) => {
    if (!(amount > 0)) return;
    target.left -= amount;
    if (payer) payer.left -= amount;
    const closure = { payer, amount, mode: mode_, date };
    target.closures.push(closure);
    if (payer) payer.closures.push({ payer: target, amount, mode: mode_, date, reverse: true });
    if (mode_ === "auto" || mode_ === "locked") target.freeClosures.push(closure);
  };
  const lockLinks = [];
  const linkCap = (link, target) => {
    if (!lockCaps || !lockCaps.has(link.id)) return Infinity;
    const closedByL = lockCaps.get(link.id);
    if (closedByL === null) return 0; // ölçüm geçişi: bağ serbest
    return Math.max(0, target.amount - closedByL - target.closures.filter(c => c.mode !== "auto" && c.mode !== "locked").reduce((sum, c) => sum + c.amount, 0));
  };
  const noteLink = link => {
    const note = noteItems.get(link.noteKey);
    if (!note) return;
    close(note, link.from, Math.min(note.left, link.from.left, link.cap ?? Infinity), "linked");
    // Açık bağın (iadeye bağlı geri ödeme) iadeyi aşan kısmı avanstır (K-a): kalemin Kalan'ında yükümlülük sayılmaz.
    if (link.explicit) link.from.refundExcess = link.from.left;
  };
  // R: iadenin geri ödemeleri önce (belgenin kendi geri ödemesi, sonra cari kartından / evrakla bağlananlar; K1, DB1 K-a).
  for (const order of [0, 1]) for (const link of linkList) if (link.order === order) noteLink(link);
  for (const link of linkList) {
    if (link.order === 1 && link.refundLeftRole && link.from.left > 0 && mode === "side") {
      // K-a: iadenin kalanını aşan geri ödeme avanstır (bağsız ödeme gibi) — karşı tarafta.
      link.from.role = { recvDue: false, recvPay: link.refundLeftRole === "recvPay", payDue: false, payPay: link.refundLeftRole === "payPay" };
      link.from.side = sideOfRole(link.from.role);
      link.from.due = false;
      link.from.cls = 2;
    }
  }
  // 0: Mahsup Et — iki belgeyi birlikte kapatır.
  for (const offset of offsets) {
    const amount = cents(offset.amount);
    if (!(amount > 0)) continue;
    const a = itemByKey.get(`inv:${offset.invoiceId}`);
    const b = offset.counterType === "invoice" ? itemByKey.get(`inv:${offset.counterId}`) : itemByKey.get(`line:${offset.counterId}`);
    if (!a || !b) continue;
    const lock = lockAt(offset.createdAt || offset.date);
    let take = Math.min(amount, a.left, b.left);
    if (lock && a.date <= lock && lockCaps?.has(`off:${offset.id}`)) take = Math.min(take, linkCap({ id: `off:${offset.id}` }, a));
    else if (lock && a.date <= lock && !lockCaps) lockLinks.push({ id: `off:${offset.id}`, targetKey: a.key, lock });
    const payer = { key: `offset:${offset.id}`, lineId: `offset:${offset.id}`, line: { id: `offset:${offset.id}`, date: offset.date, label: offset.label || "Mahsup", note: offset.note || "", method: "" }, left: Infinity, closures: [], date: offset.date };
    if (take > 0) {
      close(a, payer, take, "offset");
      close(b, payer, take, "offset");
    }
  }
  // 1: faturaya bağlı ödemeler; 1c kart tahsilatı (taksitli faturanın kart tahsilatı da faturaya bağlı ödemedir); en son iadelerin asıl faturaya mahsubu (K1: "iadeler bağlı
  // ödemelerden SONRA").
  const invoiceLinks = order => {
    for (const link of linkList) {
      if (link.order !== order) continue;
      const target = itemByKey.get(link.targetKey);
      if (!target || target === link.from) continue;
      const lock = link.lockable ? lockAt(linkedAt(link.from.lineId, link.from.at)) : "";
      const avail = Math.min(target.left, link.from.left);
      let take = avail;
      if (lock && target.date <= lock) {
        if (lockCaps?.has(link.id)) take = Math.min(take, linkCap(link, target));
        else if (!lockCaps) lockLinks.push({ id: link.id, targetKey: target.key, lock });
      }
      close(target, link.from, take, "linked");
      if (take < avail) link.from.lockFreed = true; // karar (3): kilitli dönemde bağsız kapanmış hedef açılmaz, bağın o kısmı bağsız dağılır
      // Faturaya bağlı ödemenin faturayı aşan kısmı (v2.1.0 "excess"; bağsız dağılır).
      if (link.from.left > 0) target.linkOverflow = (target.linkOverflow || 0) + link.from.left;
    }
  };
  invoiceLinks(3);
  // K-b / KS8.1: bağsız paranın iadenin geri ödemesi sayılan parçaları (implicitRefunds) — açık bağdan ve faturaya bağdan SONRA, iadenin asıl faturaya mahsubundan ÖNCE.
  if (pieces?.size) {
    for (const item of items) {
      const list = item.lineId ? pieces.get(item.lineId) : null;
      if (!list) continue;
      for (const piece of list) noteLink({ from: item, noteKey: piece.noteKey, cap: piece.amount });
    }
  }
  // 1c: kart tahsilatı / iadesi / Kartı Kapat kalanı — kartın vadesi ilk gelen açık taksitinden (M1e); taksitli faturanın kartında fazla önce faturanın kendisine (kart
  // iadeyle küçülmüş olsa da kart tahsilatı faturaya bağlı ödemedir — v2.1.0 K1), kalan fazla kartın son ödeme gününde bağsız alacak.
  for (const card of cards.values()) {
    if (!card.payments.length) continue;
    const ordered = [...card.installments].sort(s2);
    // Ç5-B tur 2a (O-2 kök nedeni): "Hangi Taksite" bağı (plan_entries.item_id) karar (2) bağıdır — bağlı tahsilat önce KENDİ taksitini kapatır, artanı kartın öbür
    // tahsilatlarıyla vade sırasına girer (kartın kendi hesabı lib/plans.mjs allocate ile aynı sıra). Önceden kuyruk bağı yok sayıyordu: kart ekranı (GET) bağlı tahsilattan
    // sonra seçilen taksiti açık, ilk taksiti kapalı gösteriyordu (yazım yanıtı kartın kendi hesabıydı — O-2).
    const byItem = new Map(card.installments.filter(inst => inst.itemId).map(inst => [inst.itemId, inst]));
    const targets = [];
    for (const p of card.payments) {
      const inst = p.amount > 0 && p.line.itemId ? byItem.get(p.line.itemId) : null;
      if (!inst) continue;
      const own = { key: `card:${card.planId}:${p.line.id}`, lineId: `card:${card.planId}`, line: { id: p.line.id, date: p.line.date, label: p.line.label || "Taksit Tahsilatı", note: p.line.note || "", method: p.line.method || "" }, left: p.amount, closures: [], date: p.line.date };
      let take = Math.min(inst.left, p.amount);
      const lock = lockAt(linkedAt(p.line.id, p.line.at));
      const linkId = `card:${card.planId}:${inst.key}:${p.line.id}`;
      if (lock && inst.date <= lock) {
        if (lockCaps?.has(linkId)) take = Math.min(take, linkCap({ id: linkId }, inst));
        else if (!lockCaps) lockLinks.push({ id: linkId, targetKey: inst.key, lock });
      }
      close(inst, own, take, "linked");
      p.targeted = take;
      targets.push({ p, inst, own });
    }
    let net = card.payments.reduce((sum, p) => sum + p.amount - (p.targeted || 0), 0);
    // Ç5-B tur 2a (komşu cheques-overview "karşılıksız çek taksiti yeniden açar"): kartın tahsilat havuzu eksiye düşerse (iade / karşılıksız çekin ters kaydı bağlı
    // tahsilattan çok) bağlı paylar EN YENİ taksitten geriye azalır — lib/plans.mjs allocate kural 3 ile aynı; kalan eksi Taksit İadesi kalemidir.
    if (net < 0 && targets.length) {
      const pos = new Map(ordered.map((inst, index) => [inst, index]));
      const newestFirst = targets.map((t, index) => ({ ...t, index })).sort((a, b) => pos.get(b.inst) - pos.get(a.inst) || b.index - a.index);
      for (const t of newestFirst) {
        if (net >= 0) break;
        const cut = Math.min(t.p.targeted, -net);
        if (!(cut > 0)) continue;
        const forward = t.inst.closures.find(c => c.payer === t.own);
        const reverse = t.own.closures.find(c => c.payer === t.inst);
        forward.amount -= cut;
        reverse.amount -= cut;
        if (!(forward.amount > 0)) t.inst.closures.splice(t.inst.closures.indexOf(forward), 1);
        if (!(reverse.amount > 0)) t.own.closures.splice(t.own.closures.indexOf(reverse), 1);
        t.inst.left += cut;
        t.own.left += cut;
        t.p.targeted -= cut;
        net += cut;
      }
    }
    const last = card.payments.filter(p => p.amount > 0).at(-1)?.line || card.payments.at(-1).line;
    // Bağlı tahsilatın kilitle kesilen ya da taksitini aşan payı kartın öbür tahsilatlarına katılır: o payın bağı bağlı tahsilatın bağ anındadır (düzeltmeyle değiştiyse sonra).
    const lock = lockAt(card.payments.reduce((max, p) => {
      const when = p.targeted !== undefined ? linkedAt(p.line.id, p.line.at) : "";
      return when > max ? when : max;
    }, String(last.at || "")));
    // Bağlı tahsilat varken (karar (3) ölçümü): ölçüm geçişinde bağlı tahsilatın kilitle kesilen payı kartın öbür tahsilatlarına katılır — o pay da kilitli dönemde bağsız
    // kapanmış taksiti yeniden açmasın diye kartın kilitli dönemdeki BÜTÜN taksitleri ilk geçişte ölçüme yazılır (yalnız ulaşılanlar değil).
    if (lock && !lockCaps && card.payments.some(p => p.targeted !== undefined)) for (const inst of ordered) if (inst.date <= lock) lockLinks.push({ id: `card:${card.planId}:${inst.key}`, targetKey: inst.key, lock });
    if (net > 0) {
      const payer = { key: `card:${card.planId}`, lineId: `card:${card.planId}`, line: { id: last.id, date: last.date, label: last.label || "Taksit Tahsilatı", note: last.note || "", method: last.method || "" }, left: net, closures: [], date: last.date };
      for (const inst of ordered) {
        if (!(payer.left > 0)) break;
        let take = Math.min(inst.left, payer.left);
        const linkId = `card:${card.planId}:${inst.key}`;
        if (lock && inst.date <= lock) {
          if (lockCaps?.has(linkId)) take = Math.min(take, linkCap({ id: linkId }, inst));
          else if (!lockCaps && !lockLinks.some(link => link.id === linkId)) lockLinks.push({ id: linkId, targetKey: inst.key, lock });
        }
        close(inst, payer, take, "linked");
      }
      if (payer.left > 0 && card.kind === "own" && card.invoiceId) {
        const doc = itemByKey.get(`inv:${card.invoiceId}`);
        if (doc && doc.left > 0) close(doc, payer, Math.min(doc.left, payer.left), "linked");
        if (doc && payer.left > 0) doc.linkOverflow = (doc.linkOverflow || 0) + payer.left;
      }
      card.paidByCard = net - payer.left;
      if (payer.left > 0) add({ key: `card-excess:${card.planId}`, kind: "payment", lineId: `plan-excess:${card.planId}`, line: { ...last, id: `plan-excess:${card.planId}`, label: "Taksit kartından artan ödeme" }, sign: -1, side: "r", due: false, role: { recvDue: false, recvPay: true, payDue: false, payPay: false }, amount: payer.left, date: last.date, vade: last.date, at: String(last.at || ""), rank: rank.get(last.id) ?? 0, cls: 2, born: last.date });
    } else if (net < 0) {
      // Ç5-B tur 2a (O-3; S1 "vadesiz kalemin vadesi işlem günü"): Taksit İadesi kaleminin günü son İADENİN günüdür (önceden son tahsilatın günüydü — kalem iadeden önce
      // gecikmiş görünebiliyordu).
      const back = card.payments.filter(p => p.amount < 0).at(-1)?.line || last;
      card.back = add({ key: `card-back:${card.planId}`, kind: "due", planId: card.planId, lineId: `plan-back:${card.planId}`, line: { ...back, id: `plan-back:${card.planId}`, label: "Taksit İadesi" }, sign: 1, side: "r", due: true, role: { recvDue: true, recvPay: false, payDue: false, payPay: false }, amount: -net, date: back.date, vade: back.date, at: String(back.at || ""), rank: rank.get(back.id) ?? 0, cls: 0, born: back.date });
      card.paidByCard = 0;
    }
  }
  invoiceLinks(4);
  // 1p: POS komisyonu yalnız bağlandığı komisyon faturasına.
  for (const link of linkList) {
    if (link.order !== 5) continue;
    const target = itemByKey.get(link.targetKey);
    if (target) close(target, link.from, Math.min(target.left, link.from.left), "linked");
  }
  // implicitRefunds 2. geçiş: karşı tarafın açık iadeleri bağsız paranın tarafında, kendi tarihleriyle yükümlülük gibi sıraya girer (yalnız bağsız para kapatır).
  if (pseudo) for (const row of pseudo) add({ key: `pseudo:${row.noteKey}`, kind: "pseudo", noteKey: row.noteKey, lineId: "", line: null, sign: row.side === "r" ? 1 : -1, side: row.side, due: true, role: {}, amount: row.amount, date: row.date, vade: row.date, at: row.at, rank: row.rank, cls: 0, born: row.date });
  // 2: bağsız dağılım — olay sırasıyla (karar (1)); kart açılışı (Mevcut Borç) o anda açık borçları S2 sırasıyla tüketir (M1e, K8-3).
  const events = [];
  for (const item of items) if (item.left > 0 && !(mode === "side" && item.linkedOnly)) events.push({ type: "item", item, date: item.born, cls: item.cls, at: item.at, rank: item.rank, sub: item.sub });
  // Kart açılışı gün içinde ÖDEME sınıfında, kayıt anıyla sıralanır (taksitleri hemen ardından, alt sıra 1…): aynı gün karttan ÖNCE yazılmış ödeme kartın tükettiği
  // borcu önce kapatır, sonra yazılan ödeme kartın taksitlerine düşer (v2.0.23 "kartın açıldığı ana kadar kaydedilmiş satırlar"; bulgu-223 3. tur).
  for (const card of cards.values()) if (card.kind === "cover") events.push({ type: "cover", card, date: card.date, cls: 2, at: card.at, rank: card.rank, sub: 0 });
  events.sort(eventOrder);
  const open = { netDebit: [], netCredit: [], rDue: [], rPay: [], pDue: [], pPay: [] };
  const listFor = (item, own) => {
    if (mode === "net") return own ? (item.sign > 0 ? open.netDebit : open.netCredit) : item.sign > 0 ? open.netCredit : open.netDebit;
    const s = item.side;
    if (own) return item.due ? open[`${s}Due`] : open[`${s}Pay`];
    return item.due ? open[`${s}Pay`] : open[`${s}Due`];
  };
  const coverEvent = card => {
    // Kartın taksitleri kuyrukta zaten (olay sırası); burada yalnız alttaki açık borçlar tüketilir.
    const pool = mode === "net" ? open.netDebit : open.rDue;
    pool.sort(s2);
    // Kartın tüketebileceği: kapsamı (kartın açıldığı andaki borç; iade kesintileri geri eklenmiş) ile kartın bugünkü taksitlerinin (iade küçültmesi sonrası) küçüğü.
    const capacity = card.installments.reduce((sum, inst) => sum + inst.amount, 0);
    let rest = Math.min(card.coverTotal, capacity);
    const want = rest;
    const consume = (target, limit) => {
      const take = Math.min(target.left, rest, limit);
      if (!(take > 0)) return;
      target.left -= take;
      target.covered.set(card.planId, (target.covered.get(card.planId) || 0) + take);
      card.consumedFrom = card.consumedFrom || [];
      card.consumedFrom.push({ target, take });
      rest -= take;
    };
    // Kartın açıldığı anda bilinen satırlarla tükettiği kalemler (coverForcing; v2.0.23 "kartın açıldığı ana kadar kaydedilmiş satırlar"): yalnız onlar — sonradan
    // yazılan satırın açtığı kalem (ör. karşılıksızla yeniden açılan fatura) kartın kapsamına girmez; artık kapanmış olanın payı son taksitlerden düşülür (aşağıda).
    const plan = forced?.get(card.planId)?.entries || null;
    // Y-1 ön geçişi (kart bilinen satırların sonunda): iki okuma (S2 ↔ en son kaydedilen borç önce) aynı kalemleri mi seçiyor — değilse kart kaydırılmaz (coverForcing).
    if (endCover === card.planId) {
      const candidates = pool.filter(target => target.kind !== "installment" && target.kind !== "plan-rest" && !(card.at && target.recorded && target.recorded > card.at));
      const takeBy = list => {
        let left = rest;
        const picked = new Map();
        for (const target of list) {
          if (!(left > 0)) break;
          const take = Math.min(target.left, left);
          if (take > 0) picked.set(target.key, take);
          left -= Math.max(0, take);
        }
        return picked;
      };
      const bySequence = takeBy(candidates);
      const byNewest = takeBy([...candidates].sort((a, b) => (a.recorded === b.recorded ? b.rank - a.rank : a.recorded < b.recorded ? 1 : -1)));
      card.ambiguous = bySequence.size !== byNewest.size || [...bySequence].some(([key, take]) => byNewest.get(key) !== take);
    }
    for (const entry of plan || []) {
      if (!(rest > 0)) break;
      const target = itemByKey.get(entry.key);
      if (target && pool.includes(target)) consume(target, entry.take);
    }
    for (const target of plan ? [] : pool) {
      if (!(rest > 0)) break;
      // Kart kartı tüketmez (taksitler kendi kartının; bugün de taksitli fatura kapsanmaz).
      if (target.kind === "installment" || target.kind === "plan-rest") continue;
      // Karttan SONRA doğan borç (aynı gün sonra kesilen fatura, geriye tarihli borç) kapsanmaz — v2.0.23 kuralı (invoice-settle.mjs coverPlans / bornAt); 2.5.0
      // kararları yalnız tüketim SIRASINI değiştirdi (S2; "açıldığı an açık borç kalemleri", C5-ACILIS §2.10 madde 2), kapsama giren borcu değil.
      if (card.at && target.recorded && target.recorded > card.at) continue;
      consume(target, Infinity);
    }
    card.consumed = want - rest;
    card.capacity = capacity; // lateCovers (Y-1): kırpmadan önceki taksit toplamı
    for (let i = pool.length - 1; i >= 0; i -= 1) if (!(pool[i].left > 0)) pool.splice(i, 1);
    // Açık borçtan büyük kart (EK-2B 32, BİLİNEN SINIR): tüketilmeyen kısım son taksitlerden düşülür (taksitler = tüketilen; Σ kalem = bakiye).
    let excess = capacity - card.consumed;
    for (const inst of [...card.installments].sort(s2).reverse()) {
      if (!(excess > 0)) break;
      const cut = Math.min(inst.left, excess);
      inst.left -= cut;
      inst.amount -= cut;
      excess -= cut;
    }
  };
  const arrive = item => {
    const against = listFor(item, false);
    if (against.length) {
      against.sort(s2);
      for (const other of against) {
        if (!(item.left > 0)) break;
        if (mode === "side" && other.linkedOnly) continue;
        // Açık iade kalemini (implicitRefunds) yalnız bağsız para kapatır.
        if ((item.kind === "pseudo" && !(other.kind === "payment" && (other.line?.origin === "account" || other.line?.origin === "cheque"))) || (other.kind === "pseudo" && !(item.kind === "payment" && (item.line?.origin === "account" || item.line?.origin === "cheque")))) continue;
        const take = Math.min(item.left, other.left);
        if (!(take > 0)) continue;
        // Kapanan: fatura durumunda yükümlülük, net görünümde borç (+) kalemi; kapatan öbürü.
        const [target, payer] = mode === "side" ? (item.due ? [item, other] : [other, item]) : item.sign > 0 ? [item, other] : [other, item];
        close(target, payer, take, payer.lockFreed ? "locked" : "auto", item.born > other.born ? item.born : other.born);
      }
      for (let i = against.length - 1; i >= 0; i -= 1) if (!(against[i].left > 0)) against.splice(i, 1);
    }
    if (item.left > 0) listFor(item, true).push(item);
  };
  for (const event of events) {
    if (event.type === "cover") coverEvent(event.card);
    else if (event.item.left > 0) arrive(event.item);
  }
  return { mode, items, itemByKey, cards, lockLinks };
}

function assemble(input, side, net) {
  const { invoices = [], today = "", doubtfulRecords = [] } = input;
  const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
  const tl = minor => roundMoney(minor / 100);
  const closerOf = (closure, mode = closure.mode) => {
    const line = closure.payer?.line || {};
    return { id: line.id || closure.payer?.lineId || "", date: line.date || closure.date || "", label: line.label || "", note: line.note || "", method: line.method || "", amount: tl(closure.amount), mode };
  };
  // Kapsanan (Mevcut Borç kartının tükettiği) kısmın ödenmeyen kalanı (K6.5 a): kartın taksitlerinden kapanan tutar tüketim sırasıyla kalemlere düşülür.
  const coveredLeftOf = state => {
    const out = new Map();
    for (const card of state.cards.values()) {
      if (card.kind !== "cover" || !card.consumedFrom) continue;
      let paid = card.installments.reduce((sum, inst) => sum + (inst.amount - inst.left), 0);
      const payers = card.installments.flatMap(inst => inst.closures);
      for (const { target, take } of card.consumedFrom) {
        const settled = Math.min(paid, take);
        paid -= settled;
        const row = out.get(target.key) || { left: 0, byCard: {}, closers: [] };
        row.left += take - settled;
        row.byCard[card.planId] = (row.byCard[card.planId] || 0) + (take - settled);
        let share = settled;
        for (const closure of payers) {
          if (!(share > 0)) break;
          const used = Math.min(share, closure.amount - (closure.usedForCover || 0));
          if (!(used > 0)) continue;
          closure.usedForCover = (closure.usedForCover || 0) + used;
          row.closers.push(closerOf({ ...closure, amount: used }, closure.mode === "auto" ? "auto" : "linked"));
          share -= used;
        }
        out.set(target.key, row);
      }
    }
    return out;
  };
  const sideCovered = coveredLeftOf(side);
  const netCovered = coveredLeftOf(net);
  // ---- Fatura durumu (G2) ----
  const out = new Map();
  const notesOf = new Map(side.items.filter(item => item.kind === "note").map(item => [item.line.sourceId, item]));
  for (const invoice of invoices) {
    const payable = cents(invoice.payable);
    let row;
    if (RETURNS.has(invoice.kind)) {
      const note = notesOf.get(invoice.id);
      const left = note ? note.left : 0;
      const open = Math.max(0, Math.min(payable, left));
      // İade belgesinin kapatanları: geri ödemesi ve alacağın kapattığı (asıl fatura, en eski borç).
      row = { payable: tl(payable), paid: tl(payable - open), open: tl(open), closers: note ? note.closures.map(c => closerOf(c, c.mode)) : [] };
    } else {
      const doc = side.itemByKey.get(`inv:${invoice.id}`);
      if (!doc) {
        out.set(invoice.id, { payable: tl(payable), paid: 0, open: tl(invoice.status === "issued" ? payable : 0), excess: 0, covered: 0, coveredBy: {}, closers: [], _missing: true });
        continue;
      }
      const card = invoice.planId ? side.cards.get(invoice.planId) : null;
      const cov = sideCovered.get(doc.key);
      // FATURA DURUMU (G2) taksitli faturada: kendi kartı ve peşin kısmı yalnız BAĞLI ödemeyle (kart tahsilatı, peşin, iade, Mahsup) kapanmış sayılır — v2.0.23 Bulgu 2,
      // v2.0.24 "taksitli faturanın açığı = kartın kalanı" (kartın hedefi, iade küçültmesi ve mutabakat motoru buna dayanır). Kart seçilmeden alınan tahsilatın bu taksitleri
      // kapatması (M1a / S50) NET görünümde (gecikmiş, zil, takvim, Vade Takip, kart ekranındaki taksit kalanı). Tasarım notu §8 (BAŞ MİMAR KARARI GEREKİYOR).
      const linkedLeft = item => Math.max(0, item.amount - item.closures.filter(c => !c.reverse && c.mode !== "auto" && c.mode !== "locked").reduce((sum, c) => sum + c.amount, 0));
      const docLeft = card ? linkedLeft(doc) : doc.left;
      const instLeft = card ? card.installments.reduce((sum, inst) => sum + linkedLeft(inst), 0) : 0;
      const open = Math.max(0, Math.min(payable, docLeft + (cov?.left || 0) + instLeft));
      const linkedOnly = closure => !card || (closure.mode !== "auto" && closure.mode !== "locked");
      const closers = [...doc.closures.filter(c => !c.reverse && linkedOnly(c)).map(c => closerOf(c)), ...(cov?.closers || []), ...(card ? card.installments.flatMap(inst => inst.closures.filter(c => !c.reverse && linkedOnly(c)).map(c => closerOf(c))) : [])];
      const excess = doc.linkOverflow || 0;
      const coveredBy = {};
      for (const [planId, value] of Object.entries(cov?.byCard || {})) if (value > 0) coveredBy[planId] = tl(value);
      row = { payable: tl(payable), paid: tl(payable - open), open: tl(open), excess: tl(excess), covered: tl(Math.min(open, cov?.left || 0)), coveredBy, closers, vade: doc.vade, overdueLeft: 0 };
      // Taksitli faturanın gecikmişi: vadesi geçmiş açık taksit (bugün vadeli değil) ya da açık peşin kısmı.
      if (card) row.overdueLeft = card.installments.filter(inst => inst.vade < today).reduce((sum, inst) => sum + linkedLeft(inst), 0) + (doc.vade < today ? docLeft : 0);
    }
    out.set(invoice.id, row);
  }
  for (const invoice of invoices) {
    let row = out.get(invoice.id);
    let state;
    if (invoice.status === "draft") state = "draft";
    else if (invoice.status === "cancelled") state = "cancelled";
    else if (RETURNS.has(invoice.kind)) state = "return";
    else if (row._missing) state = "open";
    else if (row.open <= 0.005) state = "paid";
    else if (invoice.planId) state = row.overdueLeft > 0 ? "overdue" : "installment";
    else if ((invoice.dueDate || row.vade || "") < today) state = "overdue"; // S1: vadesiz faturanın vadesi belge günü
    else state = row.paid > 0 ? "partial" : "open";
    const { _missing, overdueLeft, vade, ...clean } = row;
    out.set(invoice.id, { ...clean, state, label: PAY_STATES[state] });
  }
  // ---- Net kuyruk (G1) ----
  // M13: açık şüpheli kayıtların kalanı, kayıt gününe kadar doğmuş açık borç kalemlerinden S2 sırasıyla şüpheli kuyruğuna (yetmezse sonrakilerden).
  const doubtful = { amount: 0, items: [] };
  const held = new Map();
  const openDebit = net.items.filter(item => item.sign > 0 && item.left > 0).sort(s2);
  for (const record of [...doubtfulRecords].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))) {
    let rest = Math.max(0, Math.round(Number(record.remainingMinor) || 0));
    for (const pass of [true, false]) {
      for (const item of openDebit) {
        if (!(rest > 0)) break;
        if (pass && item.born > record.date) continue;
        const free = item.left - (held.get(item.key) || 0);
        const take = Math.min(free, rest);
        if (!(take > 0)) continue;
        held.set(item.key, (held.get(item.key) || 0) + take);
        rest -= take;
        doubtful.amount += take;
      }
    }
  }
  const viewItems = [];
  for (const item of net.items) {
    if (item.kind === "pseudo") continue;
    // Şüpheli kuyruğundaki kısım (M13) kalemde görünür (2.4.5 KS7: şüpheliye alma kalemi kapatmaz), gecikmişe girmez (S3 / S7).
    const remaining = item.left;
    if (held.get(item.key)) doubtful.items.push({ key: item.key, kind: item.kind, lineId: item.lineId, invoiceId: item.invoiceId || "", planId: item.planId || "", itemId: item.itemId || "", vade: item.vade, amount: tl(held.get(item.key)) });
    if (!(remaining > 0)) continue;
    viewItems.push({ key: item.key, kind: item.kind, side: item.sign > 0 ? "receivable" : "payable", lineId: item.lineId || "", invoiceId: item.invoiceId || "", planId: item.planId || "", itemId: item.itemId || "", seq: item.seq || 0, origin: item.line?.origin || (item.planId ? "plan" : ""), lineKind: item.line?.kind || "", date: item.date, vade: item.vade, at: item.at, rank: item.rank, sub: item.sub, amount: tl(item.amount), remaining: tl(remaining), promise: item.promise || "", due: Boolean(item.due), doubtful: tl(held.get(item.key) || 0) });
  }
  viewItems.sort(s2);
  const entries = new Map();
  for (const item of net.items) {
    if (!item.lineId || !item.due || item.kind === "invoice" || item.kind === "installment" || item.kind === "plan-rest" || item.kind === "pseudo") continue;
    const cov = netCovered.get(item.key);
    const sideName = item.sign > 0 ? "receivable" : "payable";
    // Kalan = yükümlülüğün açık kısmı (iadeye bağlı geri ödemenin iadeyi aşan avansı yükümlülük değildir — K-a).
    const left = Math.max(0, item.left - (item.refundExcess || 0));
    entries.set(item.lineId, { side: sideName, remaining: tl(left + (cov?.left || 0)), covered: tl(cov?.left || 0) });
  }
  const invoiceNet = new Map();
  for (const item of net.items) if (item.kind === "invoice") invoiceNet.set(item.invoiceId, { remaining: tl(item.left), doubtful: tl(held.get(item.key) || 0), covered: tl(netCovered.get(item.key)?.left || 0), vade: item.vade });
  const installments = new Map();
  for (const card of net.cards.values()) {
    const map = new Map();
    for (const inst of card.installments) {
      const byAccount = inst.closures.filter(c => !c.reverse && c.mode !== "linked").reduce((sum, c) => sum + c.amount, 0);
      map.set(inst.itemId || "rest", { remaining: tl(inst.left), doubtful: tl(held.get(inst.key) || 0), paid: tl(inst.amount - inst.left), byAccount: tl(byAccount), amount: tl(inst.amount), vade: inst.vade, seq: inst.seq || 0 });
    }
    // Ç5-B tur 2a (O-3, S91 = A): kartın "Taksit İadesi" kalemi (iadeler tahsilatı aşınca; kartın borcudur) — takvim / zil / Vade Takip / nakit akışı kalemi (routes/plans.mjs).
    if (card.back) map.set("back", { remaining: tl(card.back.left), doubtful: tl(held.get(card.back.key) || 0), paid: tl(card.back.amount - card.back.left), byAccount: 0, amount: tl(card.back.amount), vade: card.back.vade, seq: 0 });
    installments.set(card.planId, map);
  }
  // gecikmiş(t) = Σ açık BORÇ kalemi, vade < t (EK-1 §1 adım 5, M1f). Net kuyrukta her CH hareketi kalemdir (EK-1 §1 madde 1): netleşmemiş borç yönlü bağsız ödeme
  // (müşteriye para iadesi T-09; tedarikçiye avans) da açık borç kalemidir — vadesi kendi günü (S1). Önceden (yalnız yükümlülük rolü) aynı gün elle Alacak satış borcuyla
  // netleşip müşteriye yapılan ödeme açıkta kalınca vadesi geçmiş borç gecikmişte görünmüyordu (cari kâhini c13).
  const overdue = (day = today) => {
    const list = viewItems.filter(item => item.side === "receivable" && item.vade < day && item.remaining - item.doubtful > 0.005);
    const amount = roundMoney(list.reduce((sum, item) => sum + item.remaining - item.doubtful, 0));
    return { amount, count: list.length, since: list.reduce((min, item) => (!min || item.vade < min ? item.vade : min), ""), items: list };
  };
  // Mevcut Borç kartlarının kapsamı (NET görünüm; tanı alanı — değişmez testleri S101 sınıfını bununla adlandırır): tükettiği ↔ tüketebileceği (kapsam ile taksitlerin küçüğü).
  // ambiguous (tur 2b-1, DK-C5BT2A DÜŞÜK-2): Y-1'in iki okumalı kolu — kartın anında açık borç kart tutarından fazla, S2 ile 'kartın kendi borcu' farklı kalem seçiyor, kart
  // kaydırılmadı (S110 = A'nın kodu tur 2b-2'de; değişmez testi bu sınıfı S110 adıyla sayar).
  const coverage = new Map([...net.cards.values()].filter(card => card.kind === "cover").map(card => [card.planId, { consumed: tl(card.consumed || 0), capacity: tl(Math.min(card.coverTotal || 0, card.capacity ?? 0)), paid: card.payments.some(p => p.amount > 0), ambiguous: Boolean(net.ambiguousCovers?.has(card.planId)) }]));
  return { invoices: out, entries, items: viewItems, invoiceNet, installments, doubtful: { amount: tl(doubtful.amount), items: doubtful.items }, overdue, coverage };
}
