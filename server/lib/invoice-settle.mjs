// Fatura kapama (v2.0.15; v2.0.17 yöne göre) — hangi fatura ne kadar ödendi, neyle kapandı? Saf fonksiyon; veritabanına
// dokunmaz (yol, raporlar ve testler aynı kuralı kullanır).
//
// Kural (Logo / Mikro / SAP'deki "fatura kapama"nın otomatik FIFO karşılığı):
//   1. Faturaya bağlı ödeme önce kendi faturasını kapatır: fatura kesilirken alınan peşin tahsilat/ödeme, faturayla
//      alınan/verilen çek-senet ve ciro, faturanın taksit kartına yapılan tahsilatlar, iade faturasının alacağı (asıl
//      faturaya), cari kartından "Kapatılacak Fatura" seçilerek girilen tahsilat/ödeme, mahsup fişi. Bağlı ödeme faturadan
//      fazlaysa artanı genel havuza düşer.
//   2. Kalan ödemeler (bağsız tahsilat, artanlar) en eski yükümlülükten başlayarak dağıtılır (FIFO).
//
// v2.0.17 (müşteri: "hayalet kısmi ödeme"): ödeme YÖNE göre sayılır. Alacak tarafında (satış, SMM) yalnız ödeme
// niteliğindeki alacak satırları kapatır: tahsilat (Kasa/banka/POS), alınan çek/senet, satıştan iade, taksit tahsilatı.
// Aynı cariye kesilen ALIŞ faturası, elle yazılan "Alacak" ya da taksit kartı kapatma ödeme DEĞİLDİR. Borç tarafında
// (alış) simetrik: ödeme, verilen çek/senet (ciro dahil), alıştan iade; SATIŞ faturası, elle "Borç", stoktan satış
// ödeme değildir. Satış ↔ alış karşılıklı kapama yalnız açık "Mahsup Et" ile (offsets). Cari bakiyesi bundan etkilenmez;
// bakiye zaten net.
//
// v2.0.23 (haftalık ekran testi, docs/EKRAN-HAFTA-TESTI-2026-10-04.md Bulgu 2): fatura ile taksit kartı aynı parayı iki
// kez saymaz, hiçbir tahsilat kaybolmaz:
//   - Faturasız, AYRI borç yazan kart (Taksitler → "Yeni Borç", Taksit Excel'i / Tablodan Aktar, Toplu Taksitlendir) kendi
//     defteridir: borcu, tahsilatı, iadesi ve kapatılması (kalanın silinmesi) faturaları kapatmaz, en eski borç sırasına
//     girmez. Kartın borcunu aşan tahsilat (artan) genel havuza düşer.
//   - Taksitli fatura (faturanın kendi kartı) yalnız bağlı ödemelerle kapanır: peşinat, kartının tahsilatı (taksit iadesi
//     faturayı yeniden açar), iade. Bağsız tahsilat onu en eski borç sırasıyla kapatmaz; mahsup ve "Kapatılacak Fatura" bağı
//     reddedilir. Tahsilat ve kart iadesinde fatura açığı kartın kalanına eşit kalır (iade faturasının kartı küçültmesi
//     bilinen sınır, docs/2.0.23-KANIT.md).
//   - "Carinin Mevcut Borcu" kartı (cari kartından ya da stoktan taksitli satıştan; faturanın kendi kartı değil) açıldığı
//     anda AÇIK olan borçlardan en yeni tarihlisinden başlayarak kendi tutarı kadarını kapsar (ödenmiş borcu değil). Kartın
//     tahsilatı yalnız kapsadığı borcu kapatır; kapsanan kısım en eski borç sırasına girmez; sonradan doğan borç kapsanmaz.
//     Faturanın kapsanan açığı (covered) birleşik listelerde (yaşlandırma, nakit akış, vade takip, takvim) bir kez, kartın
//     taksitleriyle sayılır.
//
// v2.1.0 (K1, bağımsız kâhin + hakem "IADE-KAPAMA"; v2.0.26'da da vardı): iade belgesi bir alacak notudur — ya asıl faturaya mahsup edilir
// ya geri ödenir, ikisi birden olmaz (yaygın açık kalem kapaması; test/bagimsiz/SENARYO-DILI.md §7 kural 2 ve 5). Kuruşla:
//   mahsup = iade − geri ödenen;  asıl.açık = max(0, asılAçık − mahsup);  iade.açık = max(0, mahsup − asılAçık)
// (asılAçık: peşin ve faturaya bağlı öbür ödemelerden sonra kalan). Önceden iadenin tamamı asıl faturayı kapatıyor, geri ödenen kısım
// da ayrıca ödeniyordu (aynı alacak iki kez: faturada kimsenin ödemediği "Fatura" kapatanı, Σ açık ≠ cari bakiye) ve asıl faturayı aşan
// artan hiçbir belgede görünmüyordu (iade belgesinin açığı hep 0). Artan alacak notu 2.0.15'ten beri olduğu gibi carinin en eski açık
// borcunu kapatır (R1c); kapatamadığı kalan iade belgesinin açığıdır ve cariye yapılan bağsız ödeme/tahsilatla (müşteriye iade bedeli
// ödendi, tedarikçi borcunu ödedi) kapanır. Taksitli faturada kartın kalanı = faturanın açığı (routes/invoices.mjs ownTarget aynı formül).
import { roundMoney } from "./money.mjs";

const cents = value => Math.round((Number(value) || 0) * 100);
const RECEIVABLE = new Set(["sale", "smm"]);
const PAYABLE = new Set(["purchase"]);
const RETURNS = new Set(["sale_return", "purchase_return"]);
export const PAY_STATES = Object.freeze({
  paid: "Ödendi",
  partial: "Kısmen Ödendi",
  open: "Açık",
  overdue: "Vadesi Geçti",
  installment: "Taksitte",
  return: "İade",
  draft: "Taslak",
  cancelled: "İptal",
});
export const CLOSER_MODES = Object.freeze({ linked: "Bağlı", auto: "Otomatik (en eski)", offset: "Mahsup" });

/**
 * Satırın kapamadaki rolü (yöne göre). Döndürülen nesnede yalnız geçerli roller true'dur:
 *   recvDue  alacak tarafında yükümlülük (müşteri bize borçlanır)   recvPay  alacak tarafında ödeme (müşteri öder)
 *   payDue   borç tarafında yükümlülük (biz tedarikçiye borçlanırız) payPay   borç tarafında ödeme (biz öderiz)
 * @param {object} line defter satırı; invoiceKind = origin "invoice" ise faturanın türü; chequeEvent = çek olayının türü
 */
export function classifyLine(line, { invoiceKind = "", chequeEvent = "" } = {}) {
  const debit = cents(line.debit) > 0;
  const credit = cents(line.credit) > 0;
  const role = { recvDue: false, recvPay: false, payDue: false, payPay: false };
  if (!debit && !credit) return role;
  switch (line.origin) {
    case "invoice":
      // v2.1.0 (R1): iadenin GERİ ÖDEMESİ ödeme değil, iadenin alacağını geri alan yükümlülüktür — satıştan iadede müşteriye ödenen para
      // (çıkış) alacak tarafında yükümlülük, alıştan iadede tedarikçiden geri alınan para (giriş) borç tarafında yükümlülük. Önceden karşı
      // tarafta ÖDEME sayılıyordu: iade alacağı en eski açık satışı FIFO ile kapatıp geri ödeme onu yeniden açmıyordu (bakiye var, açık
      // fatura yok) ve aynı carinin açık alış faturası müşteriye yapılan geri ödemeyle "Ödendi" görünüyordu.
      if (line.kind === "out" && invoiceKind === "sale_return") role.recvDue = true;
      else if (line.kind === "in" && invoiceKind === "purchase_return") role.payDue = true;
      else if (line.kind === "in") role.recvPay = true;
      else if (line.kind === "out") role.payPay = true;
      else if (invoiceKind === "sale_return") role.recvPay = credit;
      else if (invoiceKind === "purchase_return") role.payPay = debit;
      else if (debit) role.recvDue = true;
      else role.payDue = true;
      break;
    case "cheque":
      // Alınan çek alacak yazar (ödeme); karşılıksız dönen çek borç yazar (yükümlülük yeniden açılır). Verilen çek ve
      // ciro borç yazar (ödeme); cirolu çek karşılıksız dönünce ciro edilen caride alacak (borcumuz yeniden açılır).
      if (chequeEvent === "bounce") {
        if (debit) role.recvDue = true;
        else role.payDue = true;
      } else if (credit) role.recvPay = true;
      else role.payPay = true;
      break;
    case "plan":
      if (line.kind === "plan-in" || line.kind === "plan-close") role.recvPay = true;
      else role.recvDue = true; // plan (borç), plan-out (taksit iadesi: borç yeniden açılır)
      break;
    case "stock":
      if (debit) role.recvDue = true;
      else role.payDue = true;
      break;
    default:
      // Cari kartı: Tahsilat/Ödeme ödemedir; "Borç Yaz" / "Alacak Yaz" (açılış dahil) yükümlülüktür, ödeme değildir.
      if (line.kind === "in") role.recvPay = true;
      else if (line.kind === "out") role.payPay = true;
      else if (debit) role.recvDue = true;
      else role.payDue = true;
  }
  return role;
}

/**
 * @param {{ lines: Array<{ id, origin, kind, sourceId?, planId?, date, at?, label?, note?, method?, debit, credit }>,
 *           invoices: Array<{ id, kind, status, payable, originalId?, dueDate?, planId?, schedule?: Array<{ dueDate, amount }> }>,
 *           links?: Map<string, string>, chequeEvents?: Map<string, string>,
 *           offsets?: Array<{ id, invoiceId, counterId, counterType: "invoice"|"entry", amount, date, note? }>, today: string }} input
 *   lines        : bir carinin defter satırları (accountLedger), tarih sırasında
 *   links        : defter satırı kimliği → fatura kimliği (peşin ödeme, çek/senet, ciro, seçilerek bağlanan tahsilat/ödeme)
 *   chequeEvents : çek/senet defter satırı kimliği → olay türü (receive/issue/endorse/bounce…)
 *   offsets      : mahsup fişleri (fatura ↔ karşı fatura ya da karşı cari satırı)
 * @returns {Map<string, { payable, paid, open, state, label, closers: Array<{ id, date, label, note, method, amount, mode }> }>}
 */
export function settleInvoices({ lines, invoices, links = new Map(), chequeEvents = new Map(), offsets = [], today }) {
  const out = new Map();
  const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
  const planOwner = new Map(invoices.filter(invoice => invoice.planId).map(invoice => [invoice.planId, invoice.id]));
  const ordered = [...lines].sort((a, b) => (a.date === b.date ? String(a.at || "").localeCompare(String(b.at || "")) : a.date < b.date ? -1 : 1));
  // v2.0.23: ayrı borç yazan (mevcut borcu taksitlendirmeyen) ve hiçbir faturanın kartı olmayan kartlar.
  const separatePlans = new Set(lines.filter(line => line.origin === "plan" && line.kind === "plan" && !line.covers && line.planId && !planOwner.has(line.planId)).map(line => line.planId));
  const kindOf = line => (line.origin === "invoice" ? byId.get(line.sourceId)?.kind || "" : "");
  // Satırın bağlı olduğu fatura (varsa): iade faturasının satırı asıl faturaya bağlıdır.
  const ownerOf = line => {
    let id = links.get(line.id) || (line.origin === "invoice" ? line.sourceId : "") || (line.planId ? planOwner.get(line.planId) : "") || "";
    const invoice = byId.get(id);
    if (invoice && (invoice.kind === "sale_return" || invoice.kind === "purchase_return")) id = invoice.originalId || "";
    return id;
  };
  const offsetsOf = (invoiceId, side, offsetList) => {
    const list = [];
    for (const offset of offsetList) {
      const amount = cents(offset.amount);
      if (!(amount > 0)) continue;
      if (offset.invoiceId === invoiceId) list.push({ offset, amount });
      else if (offset.counterType === "invoice" && offset.counterId === invoiceId) {
        // Karşı fatura öbür taraftadır: oradaki yükümlülüğü de aynı tutarda kapatır.
        const main = byId.get(offset.invoiceId);
        const counter = byId.get(invoiceId);
        if (main && counter && (side === "receivable" ? RECEIVABLE : PAYABLE).has(counter.kind)) list.push({ offset, amount });
      }
    }
    return list;
  };
  // v2.0.23: mevcut borcu taksitlendiren kartlar ("Carinin Mevcut Borcu", stoktan taksitli satış; faturanın kendi kartı
  // değil). Kart, açıldığı anda AÇIK olan borçlardan en yenisinden (en eski borç sırasının sonundan) başlayarak kendi tutarı
  // kadarını kapsar: stoktan taksitli satışın kartı o satışın borcunu, cari kartından açılan kart o günkü açık borcu. Hangi
  // borcun o an açık olduğu, kartın açıldığı ana kadar kaydedilmiş satırlarla aynı kuralla hesaplanır (2. gözden geçirme:
  // kapsam ödemelerden önce kurulunca kapsanan fatura iptal edilince ya da geriye tarihli borç girilince kart ödenmiş borcu
  // kapsıyor, ödenmiş fatura yeniden "Açık" görünüyordu). Kartın tahsilatı ve kapatılması yalnız kapsadığı kısmı kapatır
  // (artanı genel sıraya düşer); kapsanan kısım en eski borç sırasında atlanır; karttan sonra doğan borç kapsanmaz.
  const coverPlans = lines
    .filter(line => line.origin === "plan" && line.kind === "plan" && line.covers && line.planId && !planOwner.has(line.planId) && cents(line.coverTotal) > 0)
    .map(line => ({ planId: line.planId, at: String(line.at || line.date || ""), total: cents(line.coverTotal) }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const coverIds = new Set(coverPlans.map(plan => plan.planId));
  // Borcun doğduğu an: fatura için kaydedildiği an (düzenleme ve taslak süresi değiştirmez), öbürleri için satırın kaydı.
  const bornAt = line => String((line.origin === "invoice" ? byId.get(line.sourceId)?.issuedAt : "") || line.at || line.date || "");
  const partsLeft = item => item.free + [...item.covered.values()].reduce((sum, value) => sum + value, 0);
  // Satırın rolü, tutarı ve kayıt anı bir kez hesaplanır (kapsam her kart için kapamayı yeniden koşar).
  const factsOf = new Map();
  const facts = line => {
    let value = factsOf.get(line);
    if (!value) {
      value = { role: classifyLine(line, { invoiceKind: kindOf(line), chequeEvent: chequeEvents.get(line.id) || "" }), amount: cents(line.debit) || cents(line.credit), born: bornAt(line) };
      factsOf.set(line, value);
    }
    return value;
  };
  // Bir tarafın (alacak / borç) kapaması. coverage: kart kimliği → (yükümlülük satırı → kapsanan kuruş).
  function runSide(side, sideLines, coverage, offsetList, track = true) {
    const kinds = side === "receivable" ? RECEIVABLE : PAYABLE;
    const dueKey = side === "receivable" ? "recvDue" : "payDue";
    const payKey = side === "receivable" ? "recvPay" : "payPay";
    // Yükümlülükler: sıra korunur; faturanınki fatura kimliğiyle işaretlenir. free: en eski borç sırasına açık kısım;
    // covered: Mevcut Borç kartlarının kapsadığı kısımlar (kart kimliği → tutar).
    const obligations = [];
    const pool = [];
    const planBooks = new Map();
    for (const line of sideLines) {
      const { role, amount, born } = facts(line);
      // Ayrı kartın satırları kartın kendi defterinde toplanır (fatura sırasına girmez).
      if (line.planId && separatePlans.has(line.planId)) {
        const book = planBooks.get(line.planId) || { due: 0, paid: 0, last: null };
        if (role[dueKey]) book.due += amount;
        if (role[payKey]) {
          book.paid += amount;
          book.last = line;
        }
        planBooks.set(line.planId, book);
        continue;
      }
      if (role[dueKey]) {
        // Taksit iadesi (plan-out) kartın borcunu yeniden açar: faturanın kartıysa faturayı, Mevcut Borç kartıysa kapsadığını.
        const refund = line.origin === "plan" && line.kind === "plan-out";
        const own = line.origin === "invoice" && kinds.has(kindOf(line)) ? line.sourceId : refund ? planOwner.get(line.planId) || "" : "";
        const cover = refund && coverIds.has(line.planId) ? line.planId : "";
        // Taksitli fatura (kendi kartı var) yalnız bağlı ödemeyle kapanır; en eski borç sırasında atlanır.
        // R1 + K1: iadenin geri ödemesi (refundOf = iade belgesi) iade belgesinin kendi alacağıyla kapanır (adım R).
        const refundOf = line.origin === "invoice" && RETURNS.has(kindOf(line)) ? line.sourceId : "";
        obligations.push({ invoiceId: own, lineId: line.id, line, bornAt: born, free: cover ? 0 : amount, covered: new Map(cover ? [[cover, amount]] : []), closers: [], planned: Boolean(own && byId.get(own)?.planId), refundOf });
      }
      // K1: iade belgesinin alacak satırı (returnId): önce kendi geri ödemesini, sonra asıl faturayı kapatır; artanı en eski borca, kalanı iade açığı.
      const returnId = role[payKey] && line.origin === "invoice" && RETURNS.has(kindOf(line)) ? line.sourceId : "";
      if (role[payKey]) pool.push({ line, owner: ownerOf(line), returnId, uses: [], cover: line.origin === "plan" && coverIds.has(line.planId) ? line.planId : "", amount, left: amount, mode: links.has(line.id) ? "linked" : "" });
    }
    // Kartın borcunu aşan tahsilat (artan) genel havuza: son tahsilatın tarihiyle, tarih sırası korunarak.
    let excess = false;
    for (const [planId, book] of planBooks) {
      const extra = book.paid - book.due;
      if (extra > 0 && book.last) {
        pool.push({ line: { ...book.last, id: `plan-excess:${planId}`, label: "Taksit kartından artan ödeme" }, owner: "", cover: "", amount: extra, left: extra, mode: "" });
        excess = true;
      }
    }
    if (excess) pool.sort((a, b) => (a.line.date === b.line.date ? String(a.line.at || "").localeCompare(String(b.line.at || "")) : a.line.date < b.line.date ? -1 : 1));
    // Mevcut Borç kartlarının kapsamı (yalnız alacak tarafı; kartın açıldığı anda hesaplandı).
    if (coverage.size) {
      const byLine = new Map(obligations.map(item => [item.lineId, item]));
      for (const [planId, parts] of coverage) {
        for (const [lineId, take] of parts) {
          const item = byLine.get(lineId);
          if (!item) continue;
          const cut = Math.min(item.free, take);
          if (!(cut > 0)) continue;
          item.free -= cut;
          item.covered.set(planId, (item.covered.get(planId) || 0) + cut);
        }
      }
    }
    const target = new Map();
    for (const item of obligations) {
      if (!item.invoiceId) continue;
      if (!target.has(item.invoiceId)) target.set(item.invoiceId, []);
      target.get(item.invoiceId).push(item);
    }
    const close = (item, payment, take, mode, part = "") => {
      if (part) item.covered.set(part, item.covered.get(part) - take);
      else item.free -= take;
      payment.left -= take;
      if (track) item.closers.push({ id: payment.line.id, date: payment.line.date, label: payment.line.label || "", note: payment.line.note || "", method: payment.line.method || "", amount: roundMoney(take / 100), mode });
      // K1: iade belgesinin alacağının nereye kullanıldığı (iade belgesinin kendi kapatanları: geri ödeme, asıl fatura, en eski borç).
      if (track && payment.returnId) payment.uses.push({ item, take, mode });
    };
    // Faturaya bağlı ödeme: önce açık (kapsanmamış) kısım, sonra kartların kapsadığı kısımlar.
    const closeInvoice = (items, payment, mode) => {
      for (const item of items) {
        if (payment.left <= 0) return;
        if (item.free > 0) close(item, payment, Math.min(item.free, payment.left), mode);
        for (const [planId, left] of item.covered) {
          if (payment.left <= 0) return;
          if (left > 0) close(item, payment, Math.min(left, payment.left), mode, planId);
        }
      }
    };
    // R (v2.1.0, K1). İadenin geri ödemesi iade belgesini kapatır: iade alacağının geri ödenen kısmı asıl faturaya mahsup EDİLMEZ
    // (geri ödeme ≤ iade tutarı; fatura modülü aşanı reddeder). Kalan alacak (mahsup) 1. adımda asıl faturaya gider.
    for (const item of obligations) {
      if (!item.refundOf) continue;
      for (const payment of pool) {
        if (item.free <= 0) break;
        if (payment.returnId === item.refundOf && payment.left > 0) close(item, payment, Math.min(item.free, payment.left), "linked");
      }
    }
    // 0. Mahsup fişleri: iki tarafı da bağlı kapatır (fatura ↔ karşı belge).
    for (const [invoiceId, items] of target) {
      for (const { offset, amount } of offsetsOf(invoiceId, side, offsetList)) {
        const other = offset.invoiceId === invoiceId ? offset.counterId : offset.invoiceId;
        closeInvoice(items, { line: { id: `offset:${offset.id}`, date: offset.date, label: offset.label || "Mahsup", note: offset.note || other, method: "" }, left: amount }, "offset");
      }
    }
    // Mahsupta karşı taraf bir cari satırıysa (Alacak Yaz / Borç Yaz / açılış) o yükümlülük de aynı tutarda kapanır.
    for (const offset of offsetList) {
      if (offset.counterType !== "entry") continue;
      const item = obligations.find(entry => !entry.invoiceId && entry.lineId === offset.counterId);
      if (!item) continue;
      let rest = cents(offset.amount);
      const take = Math.min(item.free, rest);
      item.free -= take;
      rest -= take;
      for (const [planId, left] of item.covered) {
        if (rest <= 0) break;
        const cut = Math.min(left, rest);
        item.covered.set(planId, left - cut);
        rest -= cut;
      }
    }
    // 1. Bağlı ödemeler kendi faturasına: önce peşin, kart tahsilatı, çek/senet ve seçilerek bağlanan ödemeler; iadelerin mahsubu
    // (geri ödenmemiş kısım) en son, kalan açıktan (K1: asılAçık = peşin ve bağlı ödemelerden sonra kalan; iade.açık = artan).
    for (const returns of [false, true]) {
      for (const payment of pool) {
        if (Boolean(payment.returnId) !== returns) continue;
        const own = payment.owner && target.get(payment.owner);
        if (own) closeInvoice(own, payment, payment.mode || "linked");
      }
    }
    // v2.1.0 (Canlı Hata 2): faturaya bağlı ödemelerin ve iadelerin (mahsup edilen kısmının) faturayı AŞAN kısmı (fazla ödenen / avansa
    // dönen iade). İmzalı açık = açık − bu tutar (faturanın kendi kartının hedefi; geri ödenen iade adım R'de düşüldü, buraya girmez).
    const overpaid = new Map();
    for (const payment of pool) if (payment.left > 0 && payment.owner && target.has(payment.owner)) overpaid.set(payment.owner, (overpaid.get(payment.owner) || 0) + payment.left);
    // 1b. Mevcut Borç kartının tahsilatı ve kapatılması kartın kapsadığı borca (en eskiden); artanı genel sıraya kalır.
    const coveredBy = new Map();
    for (const item of obligations) {
      for (const planId of item.covered.keys()) {
        if (!coveredBy.has(planId)) coveredBy.set(planId, []);
        coveredBy.get(planId).push(item);
      }
    }
    for (const payment of pool) {
      if (!payment.cover || payment.left <= 0) continue;
      for (const item of coveredBy.get(payment.cover) || []) {
        const left = item.covered.get(payment.cover) || 0;
        if (left > 0) close(item, payment, Math.min(left, payment.left), "linked", payment.cover);
        if (payment.left <= 0) break;
      }
    }
    // 2. Kalanı en eski yükümlülükten başlayarak (ödemeler de tarih sırasında); yalnız kapsanmamış kısımlar.
    let cursor = 0;
    for (const item of obligations) {
      if (item.planned) continue;
      while (item.free > 0 && cursor < pool.length) {
        const payment = pool[cursor];
        if (payment.left <= 0) {
          cursor += 1;
          continue;
        }
        close(item, payment, Math.min(item.free, payment.left), "auto");
      }
      if (cursor >= pool.length) break;
    }
    return { obligations, target, overpaid, pool };
  }
  // Kapsam: kartlar açılış sırasıyla; her kart, kendi açıldığı ana kadar kaydedilmiş satırlarla (önceki kartların kapsamı
  // dahil) kapama yapılınca açık kalan, kapsanmamış borcu en son kaydedilenden başlayarak alır (stoktan taksitli satışın kartı,
  // satış geriye tarihli girilse de o satışı). Taksitli faturanın borcu kendi kartınındır, kapsanmaz.
  const newestFirst = obligations => obligations
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.planned && item.free > 0)
    .sort((a, b) => (a.item.bornAt === b.item.bornAt ? b.index - a.index : a.item.bornAt < b.item.bornAt ? 1 : -1))
    .map(({ item }) => item);
  const coverage = new Map();
  for (const plan of coverPlans) {
    const known = ordered.filter(line => facts(line).born <= plan.at);
    const knownOffsets = offsets.filter(offset => String(offset.createdAt || offset.date || "") <= plan.at);
    const parts = new Map();
    let rest = plan.total;
    for (const item of newestFirst(runSide("receivable", known, coverage, knownOffsets, false).obligations)) {
      if (rest <= 0) break;
      const take = Math.min(item.free, rest);
      parts.set(item.lineId, (parts.get(item.lineId) || 0) + take);
      rest -= take;
    }
    coverage.set(plan.planId, parts);
  }
  const pools = {};
  for (const side of ["receivable", "payable"]) {
    const { target, overpaid, pool } = runSide(side, ordered, side === "receivable" ? coverage : new Map(), offsets);
    pools[side] = pool;
    for (const [invoiceId, items] of target) {
      const invoice = byId.get(invoiceId);
      const payable = cents(invoice.payable);
      const open = Math.max(0, Math.min(payable, items.reduce((sum, item) => sum + partsLeft(item), 0)));
      // covered: açığın Mevcut Borç kartlarınca kapsanan kısmı (birleşik listelerde kartın taksitleri gösterir; iki kez sayılmaz).
      const covered = Math.min(open, items.reduce((sum, item) => sum + [...item.covered.values()].reduce((total, value) => total + value, 0), 0));
      // coveredBy (v2.0.24): kart kart kapsanan kısım; iade faturası faturayı kapsayan kartı bu farkla küçültür.
      const coveredBy = {};
      for (const item of items) for (const [planId, value] of item.covered) if (value > 0) coveredBy[planId] = roundMoney((coveredBy[planId] || 0) + value / 100);
      // excess (v2.1.0): bağlı ödeme ve iadelerin faturayı aşan kısmı (açık 0 iken); imzalı açık = open − excess.
      out.set(invoiceId, { payable: roundMoney(payable / 100), paid: roundMoney((payable - open) / 100), open: roundMoney(open / 100), excess: roundMoney((overpaid.get(invoiceId) || 0) / 100), covered: roundMoney(covered / 100), coveredBy, closers: items.flatMap(item => item.closers) });
    }
  }
  // K1: iade belgelerinin açığı. İadenin alacağından geri ödeme (adım R), asıl fatura (1) ve en eski borçlar (2) kapandıktan sonra kalan,
  // iade belgesinin açığıdır (satıştan iadede müşterinin alacağı, alıştan iadede tedarikçinin borcu). Karşı tarafta dağıtılamamış bağsız
  // ödeme/tahsilat (cari kartından müşteriye ödenen iade bedeli, tedarikçinin ödediği borç; verilen/alınan çek) onu en eskiden kapatır
  // (dil §7 kural 6: bağsız çıkış borç belgesini — satıştan iadeyi —, bağsız giriş alacak belgesini — alıştan iadeyi — kapatır).
  const freeMoney = payment => !payment.returnId && (payment.line.origin === "account" || payment.line.origin === "cheque") && payment.left > 0;
  for (const [side, other] of [["receivable", "payable"], ["payable", "receivable"]]) {
    const free = pools[other].filter(freeMoney);
    let cursor = 0;
    for (const note of pools[side]) {
      if (!note.returnId) continue;
      while (note.left > 0 && cursor < free.length) {
        const payment = free[cursor];
        if (payment.left <= 0) {
          cursor += 1;
          continue;
        }
        const take = Math.min(note.left, payment.left);
        note.left -= take;
        payment.left -= take;
        note.uses.push({ cross: payment, take, mode: "auto" });
      }
    }
  }
  const returnRows = new Map();
  for (const side of ["receivable", "payable"]) {
    for (const payment of pools[side]) {
      if (!payment.returnId) continue;
      const row = returnRows.get(payment.returnId) || { left: 0, closers: [] };
      row.left += payment.left;
      for (const use of payment.uses) {
        // Kapatan: geri ödeme satırı, karşı taraftaki ödeme ya da alacağın kapattığı borç (asıl fatura, en eski borç).
        const line = use.cross ? use.cross.line : use.item.line;
        const money = Boolean(use.cross || use.item.refundOf);
        row.closers.push({ id: line.id, date: line.date, label: line.label || "", note: line.note || "", method: money ? line.method || "" : "", amount: roundMoney(use.take / 100), mode: use.mode });
      }
      returnRows.set(payment.returnId, row);
    }
  }
  for (const [returnId, { left, closers }] of returnRows) {
    const invoice = byId.get(returnId);
    if (!invoice) continue;
    const payable = cents(invoice.payable);
    const open = Math.max(0, Math.min(payable, left));
    out.set(returnId, { payable: roundMoney(payable / 100), paid: roundMoney((payable - open) / 100), open: roundMoney(open / 100), closers });
  }
  for (const invoice of invoices) {
    let row = out.get(invoice.id) || { payable: roundMoney(Number(invoice.payable) || 0), paid: 0, open: 0, closers: [] };
    let state;
    if (invoice.status === "draft") state = "draft";
    else if (invoice.status === "cancelled") state = "cancelled";
    else if (invoice.kind === "sale_return" || invoice.kind === "purchase_return") state = "return";
    else if (!out.has(invoice.id)) {
      // Defterde satırı yok (olmamalı; mutabakat kapısı yakalar): açık say.
      row = { payable: row.payable, paid: 0, open: row.payable, closers: [] };
      state = "open";
    } else if (row.open <= 0.005) state = "paid";
    else if (Array.isArray(invoice.schedule) && invoice.schedule.length) {
      const dueByToday = invoice.schedule.filter(item => item.dueDate < today).reduce((sum, item) => sum + cents(item.amount), 0);
      // Bugüne kadar ödenmiş olması gereken: peşin kısım (fatura − taksit kartı) + vadesi geçmiş taksitler (bugün vadeli
      // taksit henüz gecikmiş sayılmaz).
      const expected = cents(Number(invoice.payable) - Number(invoice.planTotal ?? invoice.payable)) + dueByToday;
      state = expected - cents(row.paid) > 0 ? "overdue" : "installment";
    } else if (invoice.dueDate && invoice.dueDate < today) state = "overdue";
    else state = row.paid > 0 ? "partial" : "open";
    out.set(invoice.id, { ...row, state, label: PAY_STATES[state] });
  }
  return out;
}
