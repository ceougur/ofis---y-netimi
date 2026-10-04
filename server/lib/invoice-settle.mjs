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
//     anda var olan borçlardan en yenisinden başlayarak kendi tutarı kadarını kapsar. Kartın tahsilatı yalnız kapsadığı
//     borcu kapatır; kapsanan kısım en eski borç sırasına girmez; sonradan doğan borç kapsanmaz. Faturanın kapsanan açığı
//     (covered) birleşik listelerde (yaşlandırma, nakit akış, vade takip, takvim) bir kez, kartın taksitleriyle sayılır.
import { roundMoney } from "./money.mjs";

const cents = value => Math.round((Number(value) || 0) * 100);
const RECEIVABLE = new Set(["sale", "smm"]);
const PAYABLE = new Set(["purchase"]);
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
      if (line.kind === "in") role.recvPay = true;
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
  const offsetsOf = (invoiceId, side) => {
    const list = [];
    for (const offset of offsets) {
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
  // değil). Açıldığı anda var olan borçlardan en yenisinden başlayarak kendi tutarı kadarını kapsar: stoktan taksitli satışın
  // kartı o satışın borcunu, cari kartından açılan kart o günkü borcu. Kartın tahsilatı ve kapatılması yalnız kapsadığı kısmı
  // kapatır (artanı genel sıraya düşer); kapsanan kısım en eski borç sırasında atlanır. Sonradan doğan borcu kapsamaz.
  const coverPlans = lines
    .filter(line => line.origin === "plan" && line.kind === "plan" && line.covers && line.planId && !planOwner.has(line.planId) && cents(line.coverTotal) > 0)
    .map(line => ({ planId: line.planId, at: String(line.at || line.date || ""), total: cents(line.coverTotal) }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const coverIds = new Set(coverPlans.map(plan => plan.planId));
  // Borcun doğduğu an: fatura için kaydedildiği an (düzenleme ve taslak süresi değiştirmez), öbürleri için satırın kaydı.
  const bornAt = line => String((line.origin === "invoice" ? byId.get(line.sourceId)?.issuedAt : "") || line.at || line.date || "");
  const partsLeft = item => item.free + [...item.covered.values()].reduce((sum, value) => sum + value, 0);
  for (const side of ["receivable", "payable"]) {
    const kinds = side === "receivable" ? RECEIVABLE : PAYABLE;
    const dueKey = side === "receivable" ? "recvDue" : "payDue";
    const payKey = side === "receivable" ? "recvPay" : "payPay";
    // Yükümlülükler: sıra korunur; faturanınki fatura kimliğiyle işaretlenir. free: en eski borç sırasına açık kısım;
    // covered: Mevcut Borç kartlarının kapsadığı kısımlar (kart kimliği → tutar).
    const obligations = [];
    const pool = [];
    const planBooks = new Map();
    for (const line of ordered) {
      const role = classifyLine(line, { invoiceKind: kindOf(line), chequeEvent: chequeEvents.get(line.id) || "" });
      const amount = cents(line.debit) || cents(line.credit);
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
        obligations.push({ invoiceId: own, lineId: line.id, bornAt: bornAt(line), free: cover ? 0 : amount, covered: new Map(cover ? [[cover, amount]] : []), closers: [], planned: Boolean(own && byId.get(own)?.planId) });
      }
      if (role[payKey]) pool.push({ line, owner: ownerOf(line), cover: line.origin === "plan" && coverIds.has(line.planId) ? line.planId : "", amount, left: amount, mode: links.has(line.id) ? "linked" : "" });
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
    // Mevcut Borç kartlarının kapsamı: açılış sırasıyla, her kart kendinden önce doğmuş ve henüz kapsanmamış borcu en yeniden
    // başlayarak alır (taksitli faturanın borcu kendi kartınındır, kapsanmaz).
    if (side === "receivable") {
      for (const plan of coverPlans) {
        let rest = plan.total;
        const candidates = obligations
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => !item.planned && item.free > 0 && item.bornAt <= plan.at)
          .sort((a, b) => b.item.bornAt.localeCompare(a.item.bornAt) || b.index - a.index);
        for (const { item } of candidates) {
          if (rest <= 0) break;
          const take = Math.min(item.free, rest);
          item.free -= take;
          item.covered.set(plan.planId, (item.covered.get(plan.planId) || 0) + take);
          rest -= take;
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
      item.closers.push({ id: payment.line.id, date: payment.line.date, label: payment.line.label || "", note: payment.line.note || "", method: payment.line.method || "", amount: roundMoney(take / 100), mode });
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
    // 0. Mahsup fişleri: iki tarafı da bağlı kapatır (fatura ↔ karşı belge).
    for (const [invoiceId, items] of target) {
      for (const { offset, amount } of offsetsOf(invoiceId, side)) {
        const other = offset.invoiceId === invoiceId ? offset.counterId : offset.invoiceId;
        closeInvoice(items, { line: { id: `offset:${offset.id}`, date: offset.date, label: offset.label || "Mahsup", note: offset.note || other, method: "" }, left: amount }, "offset");
      }
    }
    // Mahsupta karşı taraf bir cari satırıysa (Alacak Yaz / Borç Yaz / açılış) o yükümlülük de aynı tutarda kapanır.
    for (const offset of offsets) {
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
    // 1. Bağlı ödemeler kendi faturasına.
    for (const payment of pool) {
      const own = payment.owner && target.get(payment.owner);
      if (own) closeInvoice(own, payment, payment.mode || "linked");
    }
    // 1b. Mevcut Borç kartının tahsilatı ve kapatılması kartın kapsadığı borca (en eskiden); artanı genel sıraya kalır.
    for (const payment of pool) {
      if (!payment.cover || payment.left <= 0) continue;
      for (const item of obligations) {
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
    for (const [invoiceId, items] of target) {
      const invoice = byId.get(invoiceId);
      const payable = cents(invoice.payable);
      const open = Math.max(0, Math.min(payable, items.reduce((sum, item) => sum + partsLeft(item), 0)));
      // covered: açığın Mevcut Borç kartlarınca kapsanan kısmı (birleşik listelerde kartın taksitleri gösterir; iki kez sayılmaz).
      const covered = Math.min(open, items.reduce((sum, item) => sum + [...item.covered.values()].reduce((total, value) => total + value, 0), 0));
      out.set(invoiceId, { payable: roundMoney(payable / 100), paid: roundMoney((payable - open) / 100), open: roundMoney(open / 100), covered: roundMoney(covered / 100), closers: items.flatMap(item => item.closers) });
    }
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
