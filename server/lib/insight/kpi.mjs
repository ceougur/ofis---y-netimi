// Doğrulanmış göstergeler: yalnızca kolonu gerçekten o türde olan verilerden, kolonun kendi adıyla hesaplanır
// ("TUTAR toplamı", "ÖDEME SÖZÜ · 7 gün içinde"). Tüm veri ve her sekme için ayrı ayrı; tıklanınca açılacak kayıt
// listeleriyle. Tarih karşılaştırmaları sunucunun yerel takvim gününe göredir (ofis saati).
import { recordTitle } from "./quality.mjs";
import { currencyOf } from "./columns.mjs";
import { parseAmount, parseDate } from "./validators.mjs";

const DAY = 86_400_000;
const LIST_LIMIT = 200;

const emptyGroup = () => ({ total: 0, money: null, deadline: null, event: null, month: null, status: null, responsible: null, _status: null, _responsible: null });

export function computeKpis(rows, analyses, primary, { now = new Date() } = {}) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const month = now.getMonth();
  const year = now.getFullYear();
  const byColumn = new Map(analyses.map(item => [item.column, item]));
  const moneyInfo = primary.money ? byColumn.get(primary.money) : null;
  const currency = moneyInfo?.currency && moneyInfo.currency !== "mixed" ? moneyInfo.currency : "TRY";

  const groups = new Map([["", emptyGroup()]]);
  const groupOf = tab => {
    if (!groups.has(tab)) groups.set(tab, emptyGroup());
    return groups.get(tab);
  };
  const lists = { upcoming: [], passed: [], topAmount: [], month: [] };
  // "Bu ay": son tarih kolonu varsa o, yoksa olay tarihi (kayıt, sipariş…) kolonu.
  const monthColumn = primary.deadline || primary.event;

  for (const row of rows) {
    const tab = String(row.__sheet || "");
    const targets = tab ? [groups.get(""), groupOf(tab)] : [groups.get("")];
    for (const group of targets) group.total += 1;

    if (primary.money) {
      const raw = row[primary.money];
      const amount = raw == null || raw === "" ? null : parseAmount(raw);
      // Açıkça başka para birimiyle yazılmış değer toplanmaz.
      const other = amount !== null && currencyOf(raw) && currencyOf(raw) !== currency;
      if (amount !== null && !other) {
        for (const group of targets) {
          group.money ??= { column: primary.money, sum: 0, count: 0, currency };
          group.money.sum += amount;
          group.money.count += 1;
        }
        if (amount > 0) lists.topAmount.push({ key: String(row.__hofKey || ""), title: recordTitle(row, primary), amount, tab });
      }
    }
    if (primary.deadline) {
      const date = parseDate(row[primary.deadline]);
      if (date) {
        const days = Math.round((date.getTime() - today) / DAY);
        for (const group of targets) {
          group.deadline ??= { column: primary.deadline, today: 0, next7: 0, next30: 0, passed: 0, dated: 0 };
          group.deadline.dated += 1;
          if (days === 0) group.deadline.today += 1;
          if (days >= 0 && days <= 7) group.deadline.next7 += 1;
          if (days >= 0 && days <= 30) group.deadline.next30 += 1;
          if (days < 0) group.deadline.passed += 1;
        }
        const entry = { key: String(row.__hofKey || ""), title: recordTitle(row, primary), date: String(row[primary.deadline]).trim(), days, tab };
        if (days >= 0 && days <= 30) lists.upcoming.push(entry);
        else if (days < 0) lists.passed.push(entry);
      }
    }
    if (primary.event) {
      const date = parseDate(row[primary.event]);
      if (date) {
        const thisMonth = date.getUTCFullYear() === year && date.getUTCMonth() === month;
        for (const group of targets) {
          group.event ??= { column: primary.event, thisMonth: 0, dated: 0 };
          group.event.dated += 1;
          if (thisMonth) group.event.thisMonth += 1;
        }
      }
    }
    if (monthColumn) {
      const date = parseDate(row[monthColumn]);
      if (date && date.getUTCFullYear() === year && date.getUTCMonth() === month) {
        for (const group of targets) {
          group.month ??= { column: monthColumn, count: 0 };
          group.month.count += 1;
        }
        lists.month.push({ key: String(row.__hofKey || ""), title: recordTitle(row, primary), date: String(row[monthColumn]).trim(), day: date.getUTCDate(), tab });
      } else if (date) for (const group of targets) group.month ??= { column: monthColumn, count: 0 };
    }
    if (primary.status) {
      const value = String(row[primary.status] ?? "").trim();
      if (value) for (const group of targets) {
        group._status ??= new Map();
        group._status.set(value, (group._status.get(value) || 0) + 1);
      }
    }
    if (primary.responsible) {
      const value = String(row[primary.responsible] ?? "").trim();
      if (value) for (const group of targets) {
        group._responsible ??= new Map();
        group._responsible.set(value, (group._responsible.get(value) || 0) + 1);
      }
    }
  }

  const top = (map, limit) => [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr")).slice(0, limit).map(([value, count]) => ({ value, count }));
  const finish = group => {
    if (group._status) group.status = { column: primary.status, distinct: group._status.size, top: top(group._status, 4) };
    if (group._responsible) group.responsible = { column: primary.responsible, people: group._responsible.size, top: top(group._responsible, 3) };
    if (group.money) group.money.sum = Math.round(group.money.sum * 100) / 100;
    delete group._status;
    delete group._responsible;
    return group;
  };
  const all = finish(groups.get(""));
  const tabs = {};
  for (const [tab, group] of groups) if (tab) tabs[tab] = finish(group);

  lists.upcoming.sort((a, b) => a.days - b.days || a.title.localeCompare(b.title, "tr"));
  lists.passed.sort((a, b) => b.days - a.days || a.title.localeCompare(b.title, "tr"));
  lists.topAmount.sort((a, b) => b.amount - a.amount);
  lists.month.sort((a, b) => a.day - b.day || a.title.localeCompare(b.title, "tr"));
  return {
    today: new Date(today).toISOString().slice(0, 10),
    currency,
    all,
    tabs,
    lists: { upcoming: lists.upcoming.slice(0, LIST_LIMIT), passed: lists.passed.slice(0, LIST_LIMIT), topAmount: lists.topAmount.slice(0, 50), month: lists.month.slice(0, LIST_LIMIT) },
  };
}
