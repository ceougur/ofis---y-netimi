// Dinamik ve esnek raporlama (v2.0.2).
// Sabit rapor şablonu yoktur. Her oturumdaki (Excel/Sheets) veri, kolon analizinden gelen rollerle ortak bir omurgaya
// normalize edilir: cari (kişi/kurum), kimlik, tutar, kalan borç, vade, durum, telefon + kalan alanlar ("özel alanlar").
// Raporlar bu omurga üzerinde çalışır; kolonlar veriden türetilir (kullanıcı hangi Excel'i yüklerse yüklesin kod
// değişmez). Farklı dosyalardaki (oturumlardaki) kayıtlar cari anahtarıyla (katlanmış ad, yoksa telefon) birleştirilir
// (cross-match): "Ali Veli" hem icra listesinde hem taksit listesinde varsa ekstrede tek caridir.
//
//   Cari ekstre — cari başına: kayıtlar (borç = kalan ya da tutar), tahsilatlar (alacak), yürüyen bakiye.
//   Vade takip  — takvim motorunun kalemleri + son tarihler; durum (gecikmiş / bugün / yaklaşan / kapalı), gün farkı.
//   Nakit akış  — dönem (gün / hafta / ay) başına beklenen tahsilat (vadeler), gerçekleşen tahsilat, kasa giriş/çıkış,
//                 net ve birikimli.
// Süzgeçler her raporda ortaktır: tarih aralığı, cari metni, durum, oturum, sekme, en az tutar. Dışa aktarma için
// tablo biçimi (kolonlar + satırlar) da döner; PDF/Excel/yazdırma o tabloyu kullanır.
import { primaryColumns } from "./insight/columns.mjs";
import { isFlaggedRow, isTotalRow } from "./insight/cells.mjs";
import { amountCandidates, debtByRecord, debtPlan, isNotAmountHeader, rowDebt } from "./insight/debt-column.mjs";
import { foldText, parseAmount, parseDate } from "./insight/validators.mjs";
import { fromCents, toCents } from "./money.mjs";

// Para toplamları kuruş (tamsayı) üzerinden: kayan nokta kalıntısı (11362.720000000001) API'ye, bakiye satırlarına ve toplamlara taşınmaz (aday 13 yan bulgusu).
const addMoney = (total, value) => fromCents(toCents(total) + toCents(value || 0));
const sumMoney = values => fromCents(values.reduce((sum, value) => sum + toCents(value || 0), 0));

const DAY = 86_400_000;
const BACKBONE = ["cari", "id", "amount", "debt", "deadline", "status", "phone"];
const MONEY_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const REPORT_KINDS = ["cari-ekstre", "vade-takip", "nakit-akis"];

const phoneKey = value => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
};
export const cariKeyOf = (name, phone = "") => {
  const folded = foldText(name);
  if (folded && folded.length >= 3) return `n:${folded}`;
  const digits = phoneKey(phone);
  return digits ? `p:${digits}` : "";
};
const dayOf = date => (date ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) : null);
const isoDay = ms => (ms === null || ms === undefined ? "" : new Date(ms).toISOString().slice(0, 10));
export const dayText = ms => (ms === null || ms === undefined ? "" : `${String(new Date(ms).getUTCDate()).padStart(2, "0")}.${String(new Date(ms).getUTCMonth() + 1).padStart(2, "0")}.${new Date(ms).getUTCFullYear()}`);
const parseIsoDay = text => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(text || ""));
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};
// Takvim kalemi ve son tarih nesnelerinin tarihi: sayı (ms), ISO ("2026-10-05") ya da gg.aa.yyyy yazımı.
const itemDate = item => {
  if (!item) return null;
  if (typeof item.time === "number") return item.time;
  for (const key of ["due", "date", "dueDate", "at", "day"]) {
    const value = item[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value) {
      const iso = parseIsoDay(value);
      if (iso !== null) return iso;
      const parsed = parseDate(value);
      if (parsed) return dayOf(parsed);
    }
  }
  return null;
};

// Kayıt omurgasının kolonları (kişi, kimlik, tutar, kalan borç, vade, durum, telefon) bir kolon analizinden.
// fallback (sekme düzeninde; rol → aday kolonlar, öncelik sırasıyla): sekmenin kendi analizi kişi / kimlik / telefon kolonunu bulamazsa, sekmede bulunan ilk
// aday kullanılır — önce oturumun seçtiği kolon, sonra öbür sekmelerin aynı başlıkla bulduğu kolon. Aynı kişinin birden çok satırı olan dönem sekmesinde
// ("2025 Aidat": 10 satırda 4 ad, tekillik 0,4) sekme analizi "Borçlu"yu kişi saymıyordu; satırlar adsız, dosya no ile ayrı grup oluyor, aynı kişi iki satıra
// bölünüyordu (aday 13 cari kâhini; kök 31a F4 sekme başına analiz).
const FALLBACK_ROLES = ["person", "id", "phone"];
function recordLayout(analyses, fallback = null) {
  const byColumn = new Map(analyses.map(item => [item.column, item]));
  const primary = { ...primaryColumns(analyses) };
  if (fallback) {
    for (const role of FALLBACK_ROLES) {
      if (primary[role]) continue;
      const column = (fallback[role] || []).find(candidate => byColumn.has(candidate) && !Object.values(primary).includes(candidate));
      if (column) primary[role] = column;
    }
  }
  // Borç düzeni Tahsilat Takvimi ile ORTAK (debt-column.mjs): Kalan / Bakiye → borç / alacak başlıklı → sekmenin tek tutarı (söz / taksit / kira tutarı
  // değilse). 30a: Kalan her zaman önce; 31d E3: gün / adet / oran kolonu tutar değil; 31f U2: söz tutarı borç değil (2.4.4 aday 6'da her sekmenin tutar
  // kolonu — "Söz Tutarı", "Kira bedeli", taksit "Toplam" — borç sayılıyordu; kapanmış dosya söz yüzünden borçlu görünüyordu).
  const moneyColumns = amountCandidates(analyses);
  const plan = debtPlan(moneyColumns);
  const debtColumn = plan.column;
  const money = primary.money && !isNotAmountHeader(primary.money) ? primary.money : null;
  const amountColumn = money && money !== debtColumn ? money : moneyColumns.find(column => column !== debtColumn) || money || null;
  const backbone = new Set([primary.person, primary.id, amountColumn, plan.remaining, plan.total, primary.deadline, primary.status, primary.phone].filter(Boolean));
  const columns = { cari: primary.person, id: primary.id, amount: amountColumn, debt: debtColumn, deadline: primary.deadline, status: primary.status, phone: primary.phone };
  return { primary, byColumn, debtColumn, plan, amountColumn, backbone, columns };
}

function recordOf(row, { primary, byColumn, plan, amountColumn, backbone }, { session, sessionName, tabs }) {
  if (!row || !row.__hofKey || isTotalRow(row) || isFlaggedRow(row) || String(row.__hofKey).startsWith("free:")) return null;
  const cari = String(row[primary.person] ?? "").trim();
  const phone = primary.phone ? String(row[primary.phone] ?? "").trim() : "";
  const deadlineDate = primary.deadline ? parseDate(row[primary.deadline]) : null;
  const fields = {};
  for (const [column, value] of Object.entries(row)) {
    if (column.startsWith("__") || backbone.has(column)) continue;
    const text = String(value ?? "").trim();
    if (!text) continue;
    const info = byColumn.get(column);
    if (info?.ignored) continue;
    fields[column] = text;
  }
  return {
    key: row.__hofKey,
    session,
    sessionName,
    tab: String(row.__sheet || tabs[0] || ""),
    cari,
    cariKey: cariKeyOf(cari, phone),
    id: primary.id ? String(row[primary.id] ?? "").trim() : "",
    amount: amountColumn ? parseAmount(row[amountColumn]) : null,
    // 31d E2: satır borcu takvimle AYNI fonksiyonla (Kalan sayıysa o, 0 dahil; boş / sayı değilse Toplam Borç).
    ...(debt => ({ debt: debt.amount, debtTier: debt.tier, debtColumn: debt.column, ...(debt.overpaid ? { overpaid: true } : {}) }))(rowDebt(plan, column => parseAmount(row[column]))),
    deadline: dayOf(deadlineDate),
    deadlineText: primary.deadline ? String(row[primary.deadline] ?? "").trim() : "",
    status: primary.status ? String(row[primary.status] ?? "").trim() : "",
    phone,
    fields,
  };
}

/**
 * Bir oturumun kayıtlarını ortak omurgaya çevirir.
 * analyzeTab (verilirse): çok sekmeli oturumda her sekmenin kendi kolon analizi (31a F4). Sekmeler farklı başlık taşır (İcra Takip "Borçlu", Taksitler
 * "Müşteri", Kiracılar "Kiracı"); oturumun tek analizi tek kişi / tutar kolonu seçtiği için öbür sekmelerin kişileri adsız (Tablodaki Kişiler'de dosya no ya
 * da iç anahtar "satir:…") ya da tutarsız (borç satırı yok, rapordan düşüyordu) kalıyordu. Kayıt sırası satır sırasıdır; dönen kolonlar oturumun analizinden.
 * @param {{ rows: object[], analyses: object[], session: string, sessionName: string, tabs?: string[], analyzeTab?: (rows: object[]) => object[] }} input
 */
export function normalizeRecords({ rows, analyses, session, sessionName = "", tabs = [], analyzeTab = null }) {
  const base = recordLayout(analyses);
  const sheetOf = row => String(row?.__sheet || "");
  const layouts = new Map();
  const sheets = analyzeTab ? [...new Set(rows.map(sheetOf))] : [];
  if (sheets.length > 1) {
    const analysed = sheets.map(sheet => [sheet, analyzeTab(rows.filter(row => sheetOf(row) === sheet))]);
    const own = analysed.map(([, analyses]) => primaryColumns(analyses));
    const fallback = Object.fromEntries(FALLBACK_ROLES.map(role => [role, [...new Set([base.primary[role], ...own.map(primary => primary[role])].filter(Boolean))]]));
    for (const [sheet, analyses] of analysed) layouts.set(sheet, recordLayout(analyses, fallback));
  }
  const context = { session, sessionName, tabs };
  const records = [];
  for (const row of rows) {
    const record = recordOf(row, layouts.get(sheetOf(row)) || base, context);
    if (record) records.push(record);
  }
  return { records, columns: base.columns };
}

// ---------- Süzgeçler ----------
export function normalizeFilters(input = {}) {
  const text = value => String(value ?? "").trim();
  const from = parseIsoDay(input.from);
  const to = parseIsoDay(input.to);
  return {
    from,
    to: to === null ? null : to + DAY - 1,
    cari: foldText(text(input.cari)),
    status: Array.isArray(input.status) ? input.status.map(foldText).filter(Boolean) : text(input.status) ? [foldText(text(input.status))] : [],
    sessions: Array.isArray(input.sessions) ? input.sessions.map(text).filter(Boolean) : [],
    tabs: Array.isArray(input.tabs) ? input.tabs.map(text).filter(Boolean) : [],
    minAmount: Number.isFinite(Number(input.minAmount)) && text(input.minAmount) ? Number(input.minAmount) : null,
    granularity: ["day", "week", "month"].includes(input.granularity) ? input.granularity : "month",
    limit: Math.min(20_000, Math.max(1, Number(input.limit) || 5_000)),
  };
}
const matchesRecord = (record, filters) => {
  if (filters.sessions.length && !filters.sessions.includes(record.session)) return false;
  if (filters.tabs.length && !filters.tabs.includes(record.tab)) return false;
  if (filters.cari && !foldText(`${record.cari} ${record.id} ${record.phone}`).includes(filters.cari)) return false;
  if (filters.status.length && !filters.status.includes(foldText(record.status))) return false;
  return true;
};
const inRange = (ms, filters) => ms === null || ms === undefined || ((filters.from === null || ms >= filters.from) && (filters.to === null || ms <= filters.to));

// Özel alan kolonları: süzülen kayıtlarda en az bir dolu değeri olan alanlar, doluluk sırasıyla (en çok 12).
export function dynamicColumns(records, max = 12) {
  const counts = new Map();
  for (const record of records) for (const column of Object.keys(record.fields)) counts.set(column, (counts.get(column) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr")).slice(0, max).map(([column]) => column);
}

// ---------- Tablo notları (2.4.4 31e) ----------
// Hesap uyarıları görünür not olur (ekran, yazdırma, PDF, Excel ve Tahsilat Takvimi aynı metni yazar; cümle düzeninde):
//   split: borcu birden çok sekmede olan dosya no — her sekme ayrı borç ve ayrı vade kalemi sayıldı (2.4.3 gibi; 31e A1); kopya sekme iki kez sayılır.
//   overpaid: ödenen toplamı aşan satır (borç 0 sayıldı).
export function tableNotes({ split = [], overpaid = 0 } = {}) {
  const notes = [];
  if (split.length) {
    const tabs = [...new Set(split.flatMap(item => item.tabs.map(entry => entry.tab)).filter(Boolean))];
    const list = split.slice(0, 5).map(item => `${item.meta?.id || item.meta?.caseNo || item.key}${item.meta?.cari || item.meta?.person ? ` (${item.meta.cari || item.meta.person})` : ""}`).join(", ");
    notes.push(`${split.length} dosya no birden çok sekmede; ayrı sayıldı (${tabs.join(", ")}). Aynı borçsa kopya sekmeyi kaldırın ya da Sekme süzgeciyle bakın. Dosya No: ${list}${split.length > 5 ? ` ve ${split.length - 5} dosya daha` : ""}.`);
  }
  if (overpaid) notes.push(`${overpaid} satırda ödenen tutar toplam tutarı aşıyor; o satırların borcu 0 sayıldı.`);
  return notes;
}

// ---------- Cari ekstre ----------
export function cariEkstre({ records, payments = [], filters = normalizeFilters(), now = new Date() }) {
  const matched = records.filter(record => matchesRecord(record, filters));
  const byKey = new Map(payments.map(item => [item.caseKey, item]));
  const paid = new Map(); // kayıt anahtarı → tahsilatlar
  for (const payment of payments) {
    if (!paid.has(payment.caseKey)) paid.set(payment.caseKey, []);
    paid.get(payment.caseKey).push(payment);
  }
  const groups = new Map();
  // 31a N5 (aynı adlı iki kişi): ad aynı, telefonlar FARKLIYSA iki ayrı kişidir (ayrı satır grubu); adın tek telefonu varsa (ya da hiç yoksa) bütün kayıtlar
  // tek kişidir — telefonsuz kayıt da (iki dosyadaki aynı cari, v2.0.2 cross-match). Birden çok telefonlu adın telefonsuz kaydı tahmin edilmez, ayrı
  // grupta kalır. Kişinin kimliği süzgeçten bağımsızdır (bütün kayıtlardan).
  const phonesByName = new Map();
  for (const record of records) {
    const phone = phoneKey(record.phone);
    if (!record.cariKey?.startsWith("n:") || !phone) continue;
    if (!phonesByName.has(record.cariKey)) phonesByName.set(record.cariKey, new Set());
    phonesByName.get(record.cariKey).add(phone);
  }
  const groupKeyOf = record => {
    if (!record.cariKey) return `k:${record.key}`;
    if ((phonesByName.get(record.cariKey)?.size || 0) < 2) return record.cariKey;
    return `${record.cariKey}|${phoneKey(record.phone)}`;
  };
  // 2.4.4 (5c): aynı kayıt anahtarı birden çok sekmede olabilir (İcra Takip + Ödeme Sözleri aynı dosya no); tahsilat anahtara bağlıdır ve rapora
  // BİR KEZ, süzgeçte kalan ilk kaydın satırına yazılır. 2.4.3'e kadar anahtarın her sekmedeki satırına ayrı yazılıyor, alacak iki kez sayılıyordu.
  const attached = new Set();
  // 31f U2 / 31e T4 / A1: satırın borcu Tahsilat Takvimi ile AYNI kuralla (debt-column.mjs): her satır kendi borcunu sayar — aynı sekmedeki satırlar (satır başına
  // taksit) ve FARKLI sekmelerdeki aynı dosya no ayrı borçtur (2.4.3 gibi); borcu birden çok sekmede olan dosya no görünür not olur (tableNotes). Söz tutarı borç
  // değildir (debtPlan). Not Sekme süzgecindeki kayıtlardan (öbür süzgeçlerden bağımsız).
  const slotOf = record => `${record.session || ""}\u0000${record.key}`;
  const inTabs = record => !filters.tabs.length || filters.tabs.includes(record.tab);
  const { split } = debtByRecord(records.filter(inTabs).map(record => ({ key: slotOf(record), tab: record.tab, amount: record.debt, tier: record.debtTier, meta: { cari: record.cari, id: record.id || record.key } })));
  for (const record of matched) {
    const key = groupKeyOf(record);
    if (!groups.has(key)) groups.set(key, { key, cari: record.cari || record.id || record.key, sessions: new Set(), lines: [] });
    const group = groups.get(key);
    group.sessions.add(record.sessionName || record.session);
    const debit = record.debt !== null && record.debt !== undefined ? record.debt : null;
    const date = record.deadline;
    if (debit !== null && inRange(date, filters) && (filters.minAmount === null || Math.abs(debit) >= filters.minAmount)) {
      group.lines.push({ date, kind: "borc", description: [record.tab, record.id].filter(Boolean).join(" · "), session: record.sessionName, tab: record.tab, borc: debit, alacak: null, status: record.status, fields: record.fields, key: record.key });
    }
    const slot = `${record.session || ""}\u0000${record.key}`;
    const own = attached.has(slot) ? [] : paid.get(record.key) || [];
    attached.add(slot);
    for (const payment of own) {
      // 2.4.4 (E8): kayda bağlı carinin tahsilatı yalnız bağın sayfasındaki kayda sayılır (kayıt tahsilatında sayfa yok; önceki gibi).
      if (payment.session && record.session && payment.session !== record.session) continue;
      const at = parseIsoDay(payment.date);
      if (!inRange(at, filters)) continue;
      group.lines.push({ date: at, kind: "alacak", description: ["Tahsilat", payment.note].filter(Boolean).join(" · "), session: record.sessionName, tab: record.tab, borc: null, alacak: Number(payment.amount) || 0, status: "", fields: {}, key: record.key });
    }
  }
  const columns = dynamicColumns(matched);
  const out = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const group of [...groups.values()].sort((a, b) => a.cari.localeCompare(b.cari, "tr"))) {
    group.lines.sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity) || (a.kind === "borc" ? -1 : 1));
    let balanceCents = 0;
    for (const line of group.lines) {
      balanceCents += toCents(line.borc || 0) - toCents(line.alacak || 0);
      line.bakiye = fromCents(balanceCents);
    }
    const balance = fromCents(balanceCents);
    const debit = sumMoney(group.lines.map(line => line.borc));
    const credit = sumMoney(group.lines.map(line => line.alacak));
    totalDebit = addMoney(totalDebit, debit);
    totalCredit = addMoney(totalCredit, credit);
    if (!group.lines.length) continue;
    out.push({ cari: group.cari, sessions: [...group.sessions], crossMatched: group.sessions.size > 1, debit, credit, balance, lines: group.lines });
    if (out.length >= filters.limit) break;
  }
  const table = {
    columns: [
      { key: "cari", label: "Cari" }, { key: "date", label: "Tarih", type: "date" }, { key: "description", label: "Açıklama" }, { key: "session", label: "Kaynak" },
      { key: "borc", label: "Borç", type: "money" }, { key: "alacak", label: "Alacak", type: "money" }, { key: "bakiye", label: "Bakiye", type: "money" }, { key: "status", label: "Durum" },
      ...columns.map(column => ({ key: `f:${column}`, label: column, dynamic: true })),
    ],
    rows: out.flatMap(group => group.lines.map(line => ({ cari: group.cari, date: line.date, description: line.description, session: line.session, borc: line.borc, alacak: line.alacak, bakiye: line.bakiye, status: line.status, ...Object.fromEntries(columns.map(column => [`f:${column}`, line.fields[column] || ""])) }))),
  };
  const notes = tableNotes({ split, overpaid: records.filter(record => record.overpaid && inTabs(record)).length });
  return { kind: "cari-ekstre", generatedAt: now.toISOString(), groups: out, split, notes, totals: { debit: totalDebit, credit: totalCredit, balance: addMoney(totalDebit, -totalCredit), caris: out.length, crossMatched: out.filter(group => group.crossMatched).length }, table };
}

// ---------- Vade takip ----------
/** items: takvim motorunun kalemleri (computeDues) + son tarihler (computeDeadlines), oturum adıyla zenginleştirilmiş. */
export function vadeTakip({ records, items = [], dormant = [], filters = normalizeFilters(), now = new Date() }) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const byKey = new Map(records.map(record => [`${record.session}\u0000${record.key}`, record]));
  const rows = [];
  for (const item of items) {
    const record = byKey.get(`${item.session}\u0000${item.caseKey}`) || null;
    const date = itemDate(item);
    if (!inRange(date, filters)) continue;
    const cari = record?.cari || item.person || item.caseKey;
    if (filters.cari && !foldText(`${cari} ${item.caseKey}`).includes(filters.cari)) continue;
    if (filters.sessions.length && !filters.sessions.includes(item.session)) continue;
    if (filters.tabs.length && item.tab && !filters.tabs.includes(item.tab)) continue;
    const amount = item.amount ?? item.remaining ?? null;
    if (filters.minAmount !== null && (amount === null || amount < filters.minAmount)) continue;
    const days = date === null ? null : Math.round((date - today) / DAY);
    const state = item.state === "paid" || item.settled ? "kapali" : days === null ? "belirsiz" : days < 0 ? "gecikmis" : days === 0 ? "bugun" : "yaklasan";
    if (filters.status.length && !filters.status.includes(state)) continue;
    rows.push({ cari, caseKey: item.caseKey, label: item.label || item.type || "Vade", date, days, amount, state, session: item.sessionName || item.session, tab: item.tab || record?.tab || "", status: record?.status || "", fields: record?.fields || {} });
    if (rows.length >= filters.limit) break;
  }
  rows.sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity) || a.cari.localeCompare(b.cari, "tr"));
  // Durgun kayıtlar (ay matrisinde son yazılı aydan sonra üst üste boş aylar): uyarı değil, "ödeme kesilmiş olabilir" satırı.
  if (!filters.status.length || filters.status.includes("durgun")) {
    for (const item of dormant) {
      const record = byKey.get(`${item.session}\u0000${item.caseKey}`) || null;
      const cari = record?.cari || item.person || item.caseKey;
      if (filters.cari && !foldText(`${cari} ${item.caseKey}`).includes(filters.cari)) continue;
      if (filters.sessions.length && !filters.sessions.includes(item.session)) continue;
      if (filters.tabs.length && item.tab && !filters.tabs.includes(item.tab)) continue;
      const date = parseIsoDay(item.lastPaid);
      if (!inRange(date, filters)) continue;
      rows.push({ cari, caseKey: item.caseKey, label: `Ödeme kesilmiş olabilir (son: ${item.lastPaidText}, ${item.emptyMonths} boş ay)`, date, days: null, amount: null, state: "durgun", session: item.sessionName || item.session, tab: item.tab || record?.tab || "", status: record?.status || "", fields: record?.fields || {} });
    }
  }
  const columns = dynamicColumns(rows.map(row => ({ fields: row.fields })));
  const STATE_TR = { gecikmis: "Gecikmiş", bugun: "Bugün", yaklasan: "Yaklaşan", kapali: "Kapalı", belirsiz: "Tarihsiz", durgun: "Durgun" };
  const totals = { count: rows.length, dormant: rows.filter(row => row.state === "durgun").length, overdue: rows.filter(row => row.state === "gecikmis").length, upcoming: rows.filter(row => row.state === "yaklasan" || row.state === "bugun").length, amount: sumMoney(rows.map(row => row.amount)), overdueAmount: sumMoney(rows.filter(row => row.state === "gecikmis").map(row => row.amount)) };
  const table = {
    columns: [
      { key: "cari", label: "Cari" }, { key: "label", label: "Kalem" }, { key: "date", label: "Vade", type: "date" }, { key: "days", label: "Gün", type: "number" },
      { key: "amount", label: "Tutar", type: "money" }, { key: "state", label: "Durum" }, { key: "session", label: "Kaynak" }, { key: "tab", label: "Sekme" },
      ...columns.map(column => ({ key: `f:${column}`, label: column, dynamic: true })),
    ],
    rows: rows.map(row => ({ cari: row.cari, label: row.label, date: row.date, days: row.days, amount: row.amount, state: STATE_TR[row.state] || row.state, session: row.session, tab: row.tab, ...Object.fromEntries(columns.map(column => [`f:${column}`, row.fields[column] || ""])) })),
  };
  return { kind: "vade-takip", generatedAt: now.toISOString(), rows, totals, table };
}

// ---------- Nakit akış ----------
const bucketOf = (ms, granularity) => {
  const date = new Date(ms);
  if (granularity === "day") return isoDay(ms);
  if (granularity === "week") {
    const day = (date.getUTCDay() + 6) % 7; // pazartesi 0
    return isoDay(ms - day * DAY);
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const bucketLabel = (bucket, granularity) => {
  if (granularity === "month") {
    const [year, month] = bucket.split("-");
    return `${["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][Number(month) - 1]} ${year}`;
  }
  const text = dayText(parseIsoDay(bucket));
  return granularity === "week" ? `${text} haftası` : text;
};
/**
 * @param {{ items: object[], payments: object[], cashEntries: object[], filters: object, now: Date }} input
 *   items: açık vadeler (beklenen tahsilat); payments: girilen tahsilatlar; cashEntries: kasa hareketleri ({kind, amount, date}).
 */
export function nakitAkis({ items = [], payments = [], cashEntries = [], filters = normalizeFilters(), now = new Date() }) {
  const granularity = filters.granularity;
  const buckets = new Map();
  const ensure = key => {
    if (!buckets.has(key)) buckets.set(key, { period: key, label: bucketLabel(key, granularity), expected: 0, expectedCount: 0, collected: 0, collectedCount: 0, cashIn: 0, cashOut: 0 });
    return buckets.get(key);
  };
  for (const item of items) {
    const date = itemDate(item);
    if (date === null || !inRange(date, filters) || item.state === "paid" || item.settled) continue;
    if (filters.sessions.length && !filters.sessions.includes(item.session)) continue;
    // 2.4.4 (30e): Sekme süzgeci Vade Takip ile aynı kuralla (sekmesi olmayan kalem geçer). 2.4.3'ten beri pencere Sekme'yi gönderiyor, burada yok sayılıyordu.
    // Gerçekleşen tahsilat ve Kasa giriş/çıkış sekme taşımaz; Sayfa süzgecinde olduğu gibi süzülmez.
    if (filters.tabs.length && item.tab && !filters.tabs.includes(item.tab)) continue;
    const amount = item.remaining ?? item.amount;
    if (amount === null || amount === undefined) continue;
    const bucket = ensure(bucketOf(date, granularity));
    bucket.expected = addMoney(bucket.expected, amount);
    bucket.expectedCount += 1;
  }
  for (const payment of payments) {
    const date = parseIsoDay(payment.date);
    if (date === null || !inRange(date, filters)) continue;
    const bucket = ensure(bucketOf(date, granularity));
    bucket.collected = addMoney(bucket.collected, Number(payment.amount) || 0);
    bucket.collectedCount += 1;
  }
  for (const entry of cashEntries) {
    const date = parseIsoDay(entry.date);
    if (date === null || !inRange(date, filters)) continue;
    const bucket = ensure(bucketOf(date, granularity));
    if (entry.kind === "in") bucket.cashIn = addMoney(bucket.cashIn, Number(entry.amount) || 0);
    else bucket.cashOut = addMoney(bucket.cashOut, Number(entry.amount) || 0);
  }
  const rows = [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
  let cumulative = 0;
  for (const row of rows) {
    row.net = addMoney(row.cashIn, -row.cashOut);
    cumulative = addMoney(cumulative, row.net);
    row.cumulative = cumulative;
    row.projected = addMoney(cumulative, row.expected);
  }
  const totals = Object.fromEntries(["expected", "collected", "cashIn", "cashOut"].map(key => [key, sumMoney(rows.map(row => row[key]))]));
  totals.net = addMoney(totals.cashIn, -totals.cashOut);
  const table = {
    columns: [
      { key: "label", label: granularity === "month" ? "Ay" : granularity === "week" ? "Hafta" : "Gün" }, { key: "expected", label: "Beklenen tahsilat", type: "money" }, { key: "expectedCount", label: "Açık kalem", type: "number" },
      { key: "collected", label: "Gerçekleşen tahsilat", type: "money" }, { key: "cashIn", label: "Kasa giriş", type: "money" }, { key: "cashOut", label: "Kasa çıkış", type: "money" }, { key: "net", label: "Net", type: "money" }, { key: "cumulative", label: "Birikimli", type: "money" }, { key: "projected", label: "Beklenenle birlikte", type: "money" },
    ],
    rows: rows.map(row => ({ label: row.label, expected: row.expected, expectedCount: row.expectedCount, collected: row.collected, cashIn: row.cashIn, cashOut: row.cashOut, net: row.net, cumulative: row.cumulative, projected: row.projected })),
  };
  return { kind: "nakit-akis", generatedAt: now.toISOString(), granularity, rows, totals, table };
}

/** Dışa aktarma için düz tablo: hücre değerleri metin (tarih gg.aa.yyyy, tutar 1.234,56). */
export function flattenTable(table) {
  const money = value => (value === null || value === undefined ? "" : MONEY_FORMAT.format(value));
  return {
    headers: table.columns.map(column => column.label),
    rows: table.rows.map(row => table.columns.map(column => {
      const value = row[column.key];
      if (column.type === "date") return dayText(value);
      if (column.type === "money") return money(value);
      return value === null || value === undefined ? "" : String(value);
    })),
  };
}
