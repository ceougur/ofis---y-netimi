// Tablodaki ödeme planları → taksit kartı taslakları (v2.0.8). Saf: veritabanına dokunmaz; yol (routes/plan-transfer.mjs)
// ve testler doğrudan kullanır.
//
// Takvim motoru (dues.mjs) Excel'deki ödeme kolonlarını bugüne kadarki kalemler olarak okur; burada aynı sekme bağlamıyla
// (tabContext, rowState) kişinin TÜM planı çıkarılır: her taksitin vadesi, tutarı ve Excel'e göre ödenmiş kısmı.
//
// Tablo biçimleri (sekme başına, öncelik sırasıyla)
//   months  — ay kolonları (Eylül … Haziran, "Ekim taksiti"). Plan kipi: hücre ödenecek tutar, ödeme işaretle ya da
//             Ödenen / Toplam − Kalan ile kapanır. Ödeme kipi: aylık ücret kolonu + hücreye yazılan ödeme; dönemin
//             kalan ayları da taksittir (seasonLedger).
//   series  — sıra sayılı vade kolonları ("1. Taksit Tarihi" / "1. Taksit Tutarı", "2. Ödeme" …).
//   summary — Taksitler'in Excel biçimi: toplam (ya da taksit tutarı) + taksit sayısı + ilk vade → eşit taksitler.
// Tek vadeli alacak ("Vade + Tutar"), ödeme sözü ve "her ayın 5'i" kira kolonları plan değildir; takvimde kalır.
//
// Ödenmiş kısım (yalnız Excel'e göre; programda girilen tahsilatları yol ekler)
//   ay hücresindeki ödeme / işaret, vade hücresindeki "ödendi", takvimde "Ödendi say" denen kalem, Ödenen kolonu ya da
//   Toplam − Kalan (en eski taksitten başlayarak). Takvimde "İptal" denen kalem taksit sayılmaz.
//
// Doğrulama (muhasebe programlarının açılış aktarımı gibi): her kişi için hata (aktarılmaz), uyarı (aktarılır, raporda)
// ve bilgi. Toplam kolonu taksitlerin toplamıyla, Kalan kolonu hesapla tutmuyorsa uyarı; ödenen toplamı aşıyorsa hata.
import { cell } from "./columns.mjs";
import { isEmptyCell } from "./cells.mjs";
import { amountInText, dueId, readDue, rowState, tabContext } from "./dues.mjs";
import { installmentLedger, paymentColumns, seasonLedger } from "./installments.mjs";
import { parseAmount } from "./validators.mjs";
import { addMonths, distribute, mapHeaders, parseDay } from "../plans.mjs";
import { roundMoney } from "../money.mjs";

const EPS = 0.005;
export const MAX_SCHEDULE_ITEMS = 360;
export const SHAPE_TEXT = Object.freeze({ months: "Ay kolonları", series: "Sıralı taksit kolonları", summary: "Toplam, taksit sayısı ve ilk vade" });
const MONEY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = value => MONEY.format(Number(value) || 0);
const pad = value => String(value).padStart(2, "0");
const text = value => String(value ?? "").trim();
const iso = time => new Date(time).toISOString().slice(0, 10);
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const monthName = time => `${MONTH_NAMES[new Date(time).getUTCMonth()]} ${new Date(time).getUTCFullYear()}`;

// Ay kalemi (yalnız ay bilinir) için vade günü: ayın `dueDay`'i; ay o kadar uzun değilse son günü.
export function dueDateIn(time, dueDay = 1) {
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(Math.max(1, Math.trunc(dueDay) || 1), last))}`;
}

// Ödenen tutarı en eski taksitten başlayarak dağıtır (kısmen ödenmiş taksit kalır). Artan kısım döner.
export function spreadPaid(items, amount) {
  let left = roundMoney(Math.max(0, Number(amount) || 0));
  for (const item of items) {
    if (left <= EPS) break;
    if (item.amount === null) continue;
    const room = roundMoney(item.amount - item.paid);
    if (room <= EPS) continue;
    const used = Math.min(room, left);
    item.paid = roundMoney(item.paid + used);
    left = roundMoney(left - used);
  }
  return left;
}

const intIn = value => {
  const digits = text(value).replace(/[^\d]/g, "");
  if (!digits || digits.length > 3) return 0;
  return Math.trunc(Number(digits));
};

// Sekmenin plan biçimi (yoksa null). Toplam + taksit sayısı biçimi ancak taksit sayısı hücrelerinin çoğu 1–360 arası tam
// sayıysa kabul edilir ("Taksit" başlıklı başka bir kolon plan sanılmasın).
function shapeOf(context, scope, roles) {
  if (context.monthly.length >= 2) return "months";
  const numbers = new Set(context.due.filter(entry => entry.installment !== null).map(entry => entry.installment));
  if (numbers.size >= 2) return "series";
  if (roles.count && (roles.total || roles.installment)) {
    let filled = 0;
    let counts = 0;
    for (const row of scope) {
      const value = text(cell(row, roles.count));
      if (!value || isEmptyCell(value)) continue;
      filled += 1;
      const n = intIn(value);
      if (n >= 1 && n <= MAX_SCHEDULE_ITEMS && /^\s*\d{1,3}\s*(taksit|ay|adet)?\s*$/i.test(value)) counts += 1;
    }
    if (filled && counts / filled >= 0.6) return "summary";
  }
  return null;
}

/**
 * @param {object} input
 * @param {Array<object>} input.rows  birleşik görünümün satırları (__sheet, __hofKey, __hofSheet)
 * @param {string[]} [input.tabs]
 * @param {Record<string, {reason?: string}>} [input.settled]  takvimde "Ödendi say" / "İptal" denen kalemler
 * @param {Date} [input.now]
 * @param {object|null} [input.forced]  eşleme ekranında seçilen kolon rolleri
 * @param {number} [input.dueDay]  yalnız ayı bilinen taksitlerin vade günü (1–28)
 * @param {string} [input.defaultFirstDue]  ilk vadesi yazılmayan satırlar için (toplam + taksit sayısı biçimi)
 */
export function extractSchedules({ rows, tabs = [], settled = {}, now = new Date(), forced = null, dueDay = 1, defaultFirstDue = "" }) {
  const groups = new Map();
  for (const row of rows || []) {
    if (!row || !row.__hofKey) continue;
    const tab = String(row.__sheet || "");
    if (!groups.has(tab)) groups.set(tab, []);
    groups.get(tab).push(row);
  }
  const order = [...tabs.filter(tab => groups.has(tab)), ...[...groups.keys()].filter(tab => !tabs.includes(tab))];
  const outTabs = [];
  const records = [];
  for (const tab of order) {
    const scope = groups.get(tab);
    const context = tabContext(scope, { now, forced });
    const roles = {};
    for (const [index, role] of Object.entries(mapHeaders(context.columns))) roles[role] = context.columns[Number(index)];
    const shape = shapeOf(context, scope, roles);
    if (!shape) continue;
    const series = shape === "series" ? context.due.filter(entry => entry.installment !== null).sort((a, b) => a.installment - b.installment) : [];
    const scheduleColumns = shape === "months" ? context.monthly.map(entry => entry.column) : shape === "series" ? series.flatMap(entry => [entry.column, entry.amountColumn].filter(Boolean)) : [roles.total, roles.installment, roles.count, roles.firstDue].filter(Boolean);
    // Ödenen / kalan / toplam kolonları: plan kipindeki ay tablosunda takvim motorunun seçtiği, diğerlerinde plan kolonları dışı.
    const paying = shape === "months" && context.plan?.plan ? { totalColumn: context.plan.totalColumn, paidColumn: context.plan.paidColumn, remainingColumn: context.plan.remainingColumn } : paymentColumns({ rows: scope, columns: context.columns, exclude: scheduleColumns });
    const nameColumn = context.primary.person || roles.name || null;
    const phoneColumn = context.primary.phone || roles.phone || null;
    const tabInfo = { tab, shape, shapeText: SHAPE_TEXT[shape], columns: scheduleColumns, paidColumn: paying.paidColumn, remainingColumn: paying.remainingColumn, totalColumn: paying.totalColumn, monthMode: shape === "months" ? (context.plan?.plan ? "plan" : "payment") : null, count: 0 };
    for (const row of scope) {
      const state = rowState(row, context);
      if (!state) continue;
      const sheet = row.__hofSheet || tab;
      const name = text(nameColumn ? cell(row, nameColumn) : "") || state.person || state.caseNo;
      const record = {
        key: row.__hofKey,
        tab,
        sheet,
        name: name.slice(0, 160),
        caseNo: state.caseNo,
        phone: text(phoneColumn ? cell(row, phoneColumn) : "").slice(0, 60),
        note: text(roles.note ? cell(row, roles.note) : "").slice(0, 1000),
        refNo: text(roles.seq ? cell(row, roles.seq) : "").slice(0, 30),
        registeredOn: parseDay(roles.registered ? cell(row, roles.registered) : context.startColumn ? cell(row, context.startColumn) : ""),
        groupName: text(roles.group ? cell(row, roles.group) : "").slice(0, 80),
        subgroupName: text(roles.subgroup ? cell(row, roles.subgroup) : "").slice(0, 80),
        shape,
        items: [],
        total: 0,
        paid: 0,
        remaining: 0,
        excel: { total: null, paid: null, remaining: null },
        closed: state.closed || state.paidOff,
        inactive: state.inactive,
        issues: [],
      };
      const issue = (level, code, message) => record.issues.push({ level, code, text: message });
      const excelAmount = column => (column ? parseAmount(cell(row, column)) : null);
      record.excel = { total: excelAmount(paying.totalColumn), paid: excelAmount(paying.paidColumn), remaining: excelAmount(paying.remainingColumn) };
      const settledOf = (column, time) => settled?.[dueId(sheet, row.__hofKey, column, time)] || null;
      let cancelled = 0;
      let extraPaid = 0;
      let paidFromColumns = false;

      if (shape === "months") {
        if (context.plan?.plan) {
          // Plan kipi: hücreler taksit tutarıdır. Ödenen / Kalan kolonu aşağıda (tüm biçimler için aynı kuralla) dağıtılır.
          const ledger = installmentLedger({ row, months: context.monthly, startColumn: context.startColumn, endColumn: context.endColumn, now, plan: { ...context.plan, paidColumn: null, remainingColumn: null } });
          for (const line of ledger.rows) {
            const mark = settledOf(line.column, line.time);
            if (mark?.reason === "cancelled") {
              cancelled += 1;
              continue;
            }
            const amount = line.fee;
            const paid = mark ? amount ?? 0 : line.state === "paid" ? amount ?? 0 : line.paidAmount ?? 0;
            record.items.push({ label: monthName(line.time), column: line.column, dueDate: dueDateIn(line.time, dueDay), amount, paid: roundMoney(paid), source: mark ? "settled" : "cell" });
          }
        } else {
          const ledger = seasonLedger({ row, months: context.monthly, startColumn: context.startColumn, endColumn: context.endColumn, now });
          extraPaid = ledger.extraPaid;
          if (ledger.dormant) issue("warning", "dormant", `Son ${ledger.dormant.emptyMonths} ay boş: ayrılmış olabilir. Taksitler son yazılı aya (${monthName(ledger.dormant.lastWritten)}) kadar alındı.`);
          for (const line of ledger.rows) {
            const mark = settledOf(line.column, line.time);
            if (mark?.reason === "cancelled") {
              cancelled += 1;
              continue;
            }
            record.items.push({ label: monthName(line.time), column: line.column, dueDate: dueDateIn(line.time, dueDay), amount: line.amount, paid: mark && line.amount !== null ? line.amount : line.paid, source: mark ? "settled" : "cell" });
          }
        }
      } else if (shape === "series") {
        for (const entry of series) {
          const value = cell(row, entry.column);
          const ownAmount = entry.amountColumn ? parseAmount(cell(row, entry.amountColumn)) : null;
          const read = readDue(value, now);
          if (!read && !(ownAmount > 0)) continue; // bu kişinin planında bu sırada taksit yok
          const label = `${entry.installment}. taksit`;
          if (read?.settled) {
            record.items.push({ label, column: entry.column, dueDate: "", amount: ownAmount > 0 ? ownAmount : amountInText(value), paid: -1, source: "cell" });
            continue;
          }
          const time = read?.time ?? null;
          const mark = time !== null ? settledOf(entry.column, time) : null;
          if (mark?.reason === "cancelled") {
            cancelled += 1;
            continue;
          }
          const amount = ownAmount > 0 ? ownAmount : read ? amountInText(read.rest) : null;
          const dueDate = time === null ? "" : read.kind === "month" ? dueDateIn(time, dueDay) : iso(time);
          record.items.push({ label, column: entry.column, dueDate, amount, paid: mark && amount ? amount : 0, source: mark ? "settled" : "cell" });
        }
        // "Ödendi" yazılan (tarihsiz) taksit: tarihi komşu taksitlerden bir ay aralıkla tahmin edilir.
        let guessed = 0;
        record.items.forEach((item, index) => {
          if (item.paid === -1) item.paid = item.amount ?? 0;
          if (item.dueDate) return;
          const before = record.items.slice(0, index).reverse().find(other => other.dueDate);
          const after = record.items.slice(index + 1).find(other => other.dueDate);
          const steps = before ? record.items.indexOf(before) - index : after ? record.items.indexOf(after) - index : 0;
          const anchor = before || after;
          if (anchor) {
            item.dueDate = addMonths(anchor.dueDate, -steps);
            guessed += 1;
          }
        });
        if (guessed) issue("warning", "guessed-date", `${guessed} ödenmiş taksitin tarihi yazılmamış; komşu taksitlere göre aylık aralıkla yazıldı.`);
        if (record.items.some(item => !item.dueDate)) issue("error", "no-date", "Taksitlerin vade tarihi okunamadı.");
      } else {
        const installment = roles.installment ? parseAmount(cell(row, roles.installment)) : null;
        let total = roles.total ? parseAmount(cell(row, roles.total)) : null;
        let count = roles.count ? intIn(cell(row, roles.count)) : 0;
        if (!count && installment > 0 && total > 0) count = Math.max(1, Math.round(total / installment));
        if (!(total > 0) && installment > 0 && count > 0) total = roundMoney(installment * count);
        const firstDue = parseDay(roles.firstDue ? cell(row, roles.firstDue) : "") || text(defaultFirstDue);
        if (!(total > 0)) issue("error", "no-total", "Toplam tutar (ya da taksit tutarı) okunamadı.");
        else if (!(count >= 1 && count <= MAX_SCHEDULE_ITEMS)) issue("error", "no-count", "Taksit sayısı okunamadı.");
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDue)) issue("error", "no-first-due", "İlk vade yazılmamış. Aşağıdan tüm satırlar için bir ilk vade seçin.");
        else {
          for (const item of distribute({ total, count, firstDue })) record.items.push({ label: `${item.seq}. taksit`, column: "", dueDate: item.dueDate, amount: item.amount, paid: 0, source: "plan" });
          if (installment > 0 && Math.abs(roundMoney(installment * count) - total) > 0.01) issue("warning", "installment-mismatch", `Taksit tutarı × taksit sayısı (${money(installment * count)}) toplamdan (${money(total)}) farklı; toplam eşit bölündü.`);
        }
      }

      // Tutarı okunamayan taksit: kart kurulamaz (tahmin edilmez).
      const unknown = record.items.filter(item => item.amount === null || !(item.amount > 0));
      if (unknown.length) issue("error", "no-amount", `${unknown.slice(0, 3).map(item => item.label).join(", ")}${unknown.length > 3 ? ` ve ${unknown.length - 3} taksit daha` : ""}: tutar okunamadı${shape === "months" ? " (aylık ücret kolonu boş)" : ""}.`);
      if (cancelled) issue("info", "cancelled", `Takvimde iptal edilen ${cancelled} taksit alınmadı.`);
      record.items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
      record.items.forEach((item, index) => {
        item.seq = index + 1;
        item.amount = item.amount === null ? null : roundMoney(item.amount);
        item.paid = roundMoney(Math.min(Math.max(0, item.paid || 0), item.amount ?? 0));
      });
      if (!record.items.length && !record.issues.some(entry => entry.level === "error")) issue("error", "no-items", "Bu kişide taksit bulunamadı.");
      if (record.items.length > MAX_SCHEDULE_ITEMS) issue("error", "too-many", `Bir kartta en fazla ${MAX_SCHEDULE_ITEMS} taksit olabilir (${record.items.length}).`);

      // Ödenen kolonu (ya da Toplam − Kalan; Toplam yoksa taksitlerin toplamı − Kalan) o güne kadar ödenen TOPLAM'dır:
      // hücrede "ödendi" yazan taksitler bunun içindedir; kalanı en eski açık taksitten başlayarak düşülür.
      const ownPaid = roundMoney(record.items.reduce((sum, item) => sum + item.paid, 0));
      const planned = roundMoney(record.items.reduce((sum, item) => sum + (item.amount || 0), 0));
      let columnPaid = null;
      if (record.excel.paid !== null) columnPaid = record.excel.paid;
      else if (record.excel.remaining !== null) {
        const base = record.excel.total ?? planned;
        if (record.excel.remaining <= base + 0.01) columnPaid = Math.max(0, roundMoney(base - record.excel.remaining));
      }
      if (shape === "months" && !context.plan?.plan) {
        // Ödeme kipinde ay hücreleri ödemenin kendisidir; Ödenen kolonu (çoğu zaman hücrelerin TOPLA'sı) yalnız karşılaştırılır.
        if (columnPaid !== null && Math.abs(columnPaid - ownPaid - extraPaid) > 0.01) issue("warning", "paid-mismatch", `Ay hücrelerindeki ödemeler ${money(ownPaid + extraPaid)}; "${paying.paidColumn || paying.remainingColumn}" kolonuna göre ${money(columnPaid)}. Ay hücreleri esas alındı.`);
      } else if (columnPaid !== null) {
        const extra = roundMoney(columnPaid - ownPaid);
        if (extra > EPS) {
          extraPaid = roundMoney(extraPaid + extra);
          paidFromColumns = true;
        } else if (extra < -EPS) issue("warning", "paid-below-marks", `"${paying.paidColumn || paying.remainingColumn}" kolonuna göre ödenen ${money(columnPaid)}; "ödendi" yazan taksitlerin toplamı ${money(ownPaid)}. İşaretli taksitler esas alındı.`);
      }
      if (extraPaid > EPS) {
        const left = spreadPaid(record.items, extraPaid);
        if (left > EPS) issue("error", "overpaid", `Excel'e göre ödenen tutar taksitlerin toplamından ${money(left)} fazla.`);
      }
      record.total = roundMoney(record.items.reduce((sum, item) => sum + (item.amount || 0), 0));
      record.paid = roundMoney(record.items.reduce((sum, item) => sum + item.paid, 0));
      record.remaining = roundMoney(Math.max(0, record.total - record.paid));
      if (!record.name) issue("error", "no-name", "Ad yazılmamış.");
      // Excel'deki toplam ve kalanla karşılaştırma (tutmazsa aktarılır ama raporda sarı).
      if (record.excel.total !== null && record.items.length && Math.abs(record.excel.total - record.total) > 0.01) issue("warning", "total-mismatch", `Taksitlerin toplamı ${money(record.total)}; "${paying.totalColumn}" kolonunda ${money(record.excel.total)} yazıyor.`);
      if (record.excel.remaining !== null && record.items.length && !record.issues.some(entry => entry.code === "overpaid") && Math.abs(record.excel.remaining - record.remaining) > 0.01) issue("warning", "remaining-mismatch", `Kalan tutmuyor: hesaplanan ${money(record.remaining)}, "${paying.remainingColumn}" kolonunda ${money(record.excel.remaining)}.`);
      if (paidFromColumns && record.paid > EPS) issue("info", "paid-from-column", `Ödenen ${money(record.paid)} en eski taksitten başlayarak düşüldü.`);
      if (record.total > EPS && record.remaining <= EPS) record.closed = true;
      tabInfo.count += 1;
      records.push(record);
    }
    if (tabInfo.count) outTabs.push(tabInfo);
  }
  return { tabs: outTabs, records };
}
