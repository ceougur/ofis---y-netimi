// ANLIK DURUM raporları (v2.0.7) — saf rapor motoru: mizan, cari ekstre, nakit akış projeksiyonu. Veritabanına dokunmaz;
// yol (routes/overview.mjs) verileri toplar, burada hesaplanır. Tarihler "YYYY-AA-GG" metnidir; karşılaştırma metin
// sırasıyla yapılır (takvim günü; saat dilimi ve yaz saati sonucu değiştirmez). "Bugün" dışarıdan verilir.
//
// Mizan (cari bazında)
//   Devir     = başlangıç tarihinden ÖNCEKİ satırların (borç − alacak) toplamı.
//   Dönem     = başlangıç ≤ tarih ≤ bitiş satırlarının borç ve alacak toplamları.
//   Bakiye    = devir + dönem borcu − dönem alacağı. Artı: cari bize borçlu (alacağımız). Eksi: biz borçluyuz.
//   Satırlar carinin defterinden (accountLedger) gelir; Cari ekranındaki bakiye ile aynı kuraldır.
//
// Nakit akış projeksiyonu
//   Başlangıç kasası = Kasa'nın bugüne kadarki (bugün dahil) bakiyesi.
//   Beklenen hareketler = açık taksitlerin kalanları (giriş), portföydeki alınan çek/senet (giriş), ödenecek verilen
//   çek/senet (çıkış), Kasa'ya ileri tarihle girilmiş hareketler. Vadesi bugünden önce olup kapanmamışlar "gecikmiş"
//   olarak ayrı listelenir; istenirse başlangıç gününe eklenir.
//   Aynı günde önce çıkışlar yazılır (en düşük bakiye ihtiyatlı hesaplanır).
import { roundMoney } from "./money.mjs";

const EPS = 0.005;
const side = value => (value > EPS ? "debtor" : value < -EPS ? "creditor" : "zero");

/**
 * Mizan.
 * @param {Array<{ id, refNo?, name, type?, groupName?, subgroupName?, status? }>} accounts
 * @param {Map<string, Array<{ date, debit, credit }>>} linesByAccount  carinin defter satırları
 * @param {{ from?: string, to?: string, includeIdle?: boolean }} range
 */
export function trialBalance(accounts, linesByAccount, { from = "", to = "", includeIdle = false } = {}) {
  const rows = [];
  const totals = { opening: 0, debit: 0, credit: 0, closing: 0, openingDebtor: 0, openingCreditor: 0, closingDebtor: 0, closingCreditor: 0, count: 0 };
  for (const account of accounts) {
    let opening = 0;
    let debit = 0;
    let credit = 0;
    let moves = 0;
    for (const line of linesByAccount.get(account.id) || []) {
      if (from && line.date < from) {
        opening += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        continue;
      }
      if (to && line.date > to) continue;
      debit += Number(line.debit) || 0;
      credit += Number(line.credit) || 0;
      moves += 1;
    }
    opening = roundMoney(opening);
    debit = roundMoney(debit);
    credit = roundMoney(credit);
    const closing = roundMoney(opening + debit - credit);
    if (!includeIdle && Math.abs(opening) <= EPS && !moves) continue;
    rows.push({ id: account.id, refNo: account.refNo || "", name: account.name, type: account.type || "", groupName: account.groupName || "", subgroupName: account.subgroupName || "", status: account.status || "active", opening, debit, credit, closing, side: side(closing), moves });
    totals.count += 1;
    totals.opening = roundMoney(totals.opening + opening);
    totals.debit = roundMoney(totals.debit + debit);
    totals.credit = roundMoney(totals.credit + credit);
    totals.closing = roundMoney(totals.closing + closing);
    if (opening > EPS) totals.openingDebtor = roundMoney(totals.openingDebtor + opening);
    if (opening < -EPS) totals.openingCreditor = roundMoney(totals.openingCreditor - opening);
    if (closing > EPS) totals.closingDebtor = roundMoney(totals.closingDebtor + closing);
    if (closing < -EPS) totals.closingCreditor = roundMoney(totals.closingCreditor - closing);
  }
  return { rows, totals };
}

/**
 * Cari ekstre (tarih aralıklı): devir satırı, dönem satırları (yürüyen bakiyeyle), dönem sonu.
 * @param {Array<{ date, debit, credit, label, note, receiptNo?, origin? }>} lines  tarih sırasında
 */
export function statement(lines, { from = "", to = "" } = {}) {
  let opening = 0;
  let debit = 0;
  let credit = 0;
  const out = [];
  let balance = 0;
  for (const line of lines) {
    const d = Number(line.debit) || 0;
    const c = Number(line.credit) || 0;
    if (from && line.date < from) {
      opening += d - c;
      balance = roundMoney(opening);
      continue;
    }
    if (to && line.date > to) continue;
    debit += d;
    credit += c;
    balance = roundMoney(balance + d - c);
    out.push({ ...line, debit: roundMoney(d), credit: roundMoney(c), balance });
  }
  opening = roundMoney(opening);
  return { opening, lines: out, debit: roundMoney(debit), credit: roundMoney(credit), closing: roundMoney(opening + debit - credit), side: side(roundMoney(opening + debit - credit)) };
}

/**
 * Nakit akış projeksiyonu.
 * @param {{ today: string, from?: string, to: string, cashToday: number, flows: Array<{ date, direction: "in"|"out", amount, source, label, party?, ref? }>, includeOverdue?: boolean }} input
 *   flows: kapanmamış tüm beklenen hareketler (vadesi geçenler dahil); ayrım burada yapılır.
 */
export function projection({ today, from = "", to, cashToday = 0, flows = [], includeOverdue = false }) {
  const start = from && from > today ? from : today;
  const overdue = [];
  const carried = { in: 0, out: 0 };
  const inRange = [];
  for (const flow of flows) {
    const amount = roundMoney(Number(flow.amount) || 0);
    if (!(amount > EPS) || !flow.date) continue;
    const item = { ...flow, amount };
    if (flow.date < today) overdue.push(item);
    else if (flow.date < start) carried[flow.direction === "out" ? "out" : "in"] = roundMoney(carried[flow.direction === "out" ? "out" : "in"] + amount);
    else if (!to || flow.date <= to) inRange.push(item);
  }
  const overdueTotals = overdue.reduce((acc, item) => ({ ...acc, [item.direction === "out" ? "out" : "in"]: roundMoney(acc[item.direction === "out" ? "out" : "in"] + item.amount) }), { in: 0, out: 0 });
  // Başlangıç: bugünkü kasa + (başlangıç bugünden sonraysa) aradaki beklenen hareketler (+ istenirse gecikmişler).
  let opening = roundMoney(cashToday + carried.in - carried.out);
  if (includeOverdue) opening = roundMoney(opening + overdueTotals.in - overdueTotals.out);
  const order = (a, b) => (a.date === b.date ? (a.direction === b.direction ? String(a.label).localeCompare(String(b.label), "tr") : a.direction === "out" ? -1 : 1) : a.date < b.date ? -1 : 1);
  inRange.sort(order);
  overdue.sort(order);
  let balance = opening;
  let lowest = { balance: opening, date: start };
  const totals = { in: 0, out: 0 };
  const days = new Map();
  const rows = inRange.map(item => {
    const signed = item.direction === "out" ? -item.amount : item.amount;
    balance = roundMoney(balance + signed);
    totals[item.direction === "out" ? "out" : "in"] = roundMoney(totals[item.direction === "out" ? "out" : "in"] + item.amount);
    if (balance < lowest.balance - EPS) lowest = { balance, date: item.date };
    const day = days.get(item.date) || { date: item.date, in: 0, out: 0, balance: 0 };
    day[item.direction === "out" ? "out" : "in"] = roundMoney(day[item.direction === "out" ? "out" : "in"] + item.amount);
    day.balance = balance;
    days.set(item.date, day);
    return { ...item, balance };
  });
  const bySource = {};
  for (const item of inRange) {
    const key = `${item.source}:${item.direction}`;
    bySource[key] = roundMoney((bySource[key] || 0) + item.amount);
  }
  return {
    today,
    from: start,
    to,
    cashToday: roundMoney(cashToday),
    carried,
    opening,
    rows,
    days: [...days.values()],
    totals: { ...totals, net: roundMoney(totals.in - totals.out) },
    closing: balance,
    lowest,
    negative: lowest.balance < -EPS,
    overdue,
    overdueTotals,
    includeOverdue: Boolean(includeOverdue),
    bySource,
  };
}

/** Hazır aralıklar: bugün temel alınır (takvim günü). */
export function presetRange(preset, today) {
  const [y, m, d] = today.split("-").map(Number);
  const iso = (year, month, day) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toISOString().slice(0, 10);
  };
  const addDays = days => iso(y, m, d + days);
  switch (preset) {
    case "next7":
      return { from: today, to: addDays(7) };
    case "next30":
      return { from: today, to: addDays(30) };
    case "next60":
      return { from: today, to: addDays(60) };
    case "next90":
      return { from: today, to: addDays(90) };
    case "thisMonth":
      return { from: iso(y, m, 1), to: iso(y, m + 1, 0) };
    case "lastMonth":
      return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
    case "thisYear":
      return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
    case "last30":
      return { from: addDays(-30), to: today };
    default:
      return null;
  }
}
