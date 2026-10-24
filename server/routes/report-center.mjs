// Rapor merkezi (v2.0.7) — "Detaylı raporlar". Programa girilen her bilgi (Kasa, Cari, Taksit, Çek/Senet, Stok, kayıt
// tahsilatları, görevler, notlar, belgeler, işlem geçmişi, tablo verisi) hazır rapor olarak ekranda ön izlenir ve tek
// tıkla PDF ya da Excel olarak alınır.
//
// Mimari: her rapor, kayıttaki (REPORTS) bir tanımdır — kimlik, grup, başlık, parametreler ve bir "build" fonksiyonu.
// build ortak bir tablo modeli döndürür: { title, subtitle, headers, types, rows (dizi dizisi), summary }. Ekran ön izlemesi,
// PDF (tablePdf) ve Excel (buildXlsx) aynı modelden üretilir; bütün raporlar aynı kurumsal başlığı ve hizalamayı taşır.
// Rakamlar ilgili modülün kendi hesabından okunur (Kasa → cash.report, Cari → accounts.list/allLedgers, Taksit →
// allocate, Stok → stock.list, Çek → cheques.list); ekrandaki rakamla rapordaki rakam aynıdır.
import { accountLedger } from "../lib/accounts.mjs";
import { DIRECTIONS, EVENT_LABELS, INSTRUMENTS, STATUSES } from "../lib/cheques.mjs";
import { isAllTimeStart, presetRange, statement } from "../lib/finance-report.mjs";
import { methodLabel } from "../lib/pay-method.mjs";
import { HttpError, limited, ok, sendBuffer, text } from "../lib/http.mjs";
import { roundMoney } from "../lib/money.mjs";
import { canUser } from "../lib/permissions.mjs";
import { allocate, dayText, isoDay } from "../lib/plans.mjs";
import { tl } from "../lib/report-pdf.mjs";
import { createReportHeader } from "../lib/report-header.mjs";
import { reportFileBase, reportPdf, reportXlsx } from "../lib/report-files.mjs";
import { systemClock } from "../lib/clock.mjs";
import { K10_LABELS } from "../lib/bank/accounts.mjs";
import { STATUS_LABELS, typeLabel } from "../lib/bank/event-types.mjs";
import { waysFor } from "../lib/bank/money-lines.mjs";
import { TRANSFER_CHANNELS } from "../lib/bank/vouchers.mjs";
import { TAX_LABELS, taxChoiceOf } from "../lib/bank/pos-math.mjs";
import { CHART, stockOpeningValue } from "../lib/general-ledger.mjs";
import { INVOICE_KINDS } from "../lib/invoice-math.mjs";
import { detailedStatement } from "../lib/statement-detail.mjs";
import { reconcileReceivables } from "../lib/receivable-aging.mjs";
import { DOUBTFUL_REASONS, DOUBTFUL_STATUS_LABELS } from "../lib/doubtful-gl.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => {
  if (!DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};
const PREVIEW_ROWS = 200;
const PDF_ROWS = 20_000;
const MAX_ROWS = 500_000;
const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
// Kalıtımsız (v2.0.22): süzgeçteki "constructor" gibi adlar tür sayılmaz.
const TYPE_TEXT = Object.freeze(Object.assign(Object.create(null), { customer: "Müşteri", supplier: "Tedarikçi", other: "Diğer" }));
const CASH_SOURCE = { payment: "Kayıt tahsilatı", manual: "Kasa", plan: "Taksit", account: "Cari", stock: "Stok", cheque: "Çek / senet", invoice: "Fatura", bankLine: "Banka Fişi" };
const PRIORITY = { high: "Yüksek", normal: "Normal", low: "Düşük", urgent: "Acil" };
// Bankaya Tahsile Ver / Bankadan Geri Al (plan §3.14; fin_events başlıkları, cheque_events'te yok): Çek / Senet Hareketleri'nde işlem adı.
const BANK_EVENT_LABELS = { "bank-deposit": "Bankaya Tahsile Verildi", "bank-withdraw": "Bankadan Geri Alındı" };
const TASK_STATUS = { open: "Açık", done: "Tamamlandı", completed: "Tamamlandı", cancelled: "İptal" };
const money = value => (value === "" || value === null || value === undefined ? "" : tl(value));
const QTY_FORMAT = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const qty = value => QTY_FORMAT.format(Number(value) || 0);
const stamp = value => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${dayText(isoDay(date))} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
// Durum (v2.0.10): yalın — Borçlu (cari bize borçlu) · Alacaklı (biz cariye borçluyuz) · Kapalı.
const sideText = value => (value > 0.005 ? "Borçlu" : value < -0.005 ? "Alacaklı" : "Kapalı");
const SIDE_FILTER = { debtor: "Borçlular", creditor: "Alacaklılar", nonzero: "Sadece bakiyesi olanlar", zero: "Bakiyesi sıfır", overdue: "Geciken taksiti olan" };
const SEQUENCE = /^(sıra|sira|sıra no|no|#|sn|s\.?\s?no|nr)$/i;
// Ay anahtarı (YYYY-AA) → "Eylül 2026"; aralıktaki aylar (v2.0.9 aylık raporlar).
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const monthLabel = key => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
function monthsBetween(first, last, max = 600) {
  const out = [];
  let [year, month] = first.split("-").map(Number);
  const [endYear, endMonth] = last.split("-").map(Number);
  while ((year < endYear || (year === endYear && month <= endMonth)) && out.length < max) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
const percent = (part, whole) => (whole > 0.005 ? `%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format((part / whole) * 100)}` : "");

// ---------- TOPLAM satırı (v2.0.20, kullanıcı: "alt toplamları getirmiyor") ----------
// Her raporun tablosunun altında, yaygın muhasebe programlarındaki gibi kalın bir TOPLAM satırı: ekran, PDF ve Excel aynı
// satırı gösterir ve TÜM satırlardan (ön izlemedeki ilk 200 değil) hesaplanır. Kurallar:
//   - yalnız tutar ("money") ve sayı ("number") kolonları toplanır; yürüyen bakiye, birim fiyat, oran gibi toplanması
//     anlamsız kolonlar (NO_SUM) boş kalır;
//   - miktar kolonları yalnız bütün satırlar aynı birimdeyse toplanır (Adet + Kg toplanmaz);
//   - rapor, yönü karışık satırlarda (alınan/verilen, satış/alış) footerUniform ile toplamı yalnız tek yön süzülünce
//     gösterir; footer: false toplamı kapatır; footer: { Kolon: değer } hesaplanan satırın üstüne yazar (ör. net bakiye).
// 2.3.0 İz 3.3 (plan §8.10 kuralı): banka raporlarının yürüyen bakiye kolonları da (Gün Sonu / Ay Başı / Ay Sonu Bakiye, Beklenen Gerçek Banka).
const NO_SUM = /^(Bakiye|Gün Sonu Kasa|Ay Başı Kasa|Ay Sonu Kasa|Gün Sonu Bakiye|Ay Başı Bakiye|Ay Sonu Bakiye|Beklenen Gerçek Banka|Birim Fiyat|KDV %|Stopaj %|Kesinti %|Kritik Seviye|Vade Gecikme \(Gün\))$/;
const MONEY_CELL = /^(-?)((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/;
const NUMBER_CELL = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/;
// Mutabakat Günlüğü olay adları (integrity_log.action).
const INTEGRITY_ACTIONS = { "rolled-back": "Geri Alındı", baseline: "Açılışta Bulunan Sapma", scan: "Taramada Bulunan Sapma", repair: "Açılış Onarımı" };

export function cellNumber(value, type) {
  const raw = String(value ?? "").trim().replace(/−/g, "-");
  if (!raw) return null;
  if (type === "money") {
    const match = MONEY_CELL.exec(raw);
    return match ? Number(`${match[1]}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
  }
  if (!NUMBER_CELL.test(raw)) return null;
  return Number(raw.replace(/\./g, "").replace(",", "."));
}
// Cari bakiyelerinde (Bakiye mutlak değer + Durum) TOPLAM net bakiyedir: borçlular − alacaklılar, yönüyle.
const netFooter = net => ({ Bakiye: tl(Math.abs(roundMoney(net))), Durum: sideText(roundMoney(net)) });
export function footerRow({ headers = [], types = [], rows = [], footer, footerUniform }) {
  if (footer === false || !rows.length) return null;
  if (footerUniform) {
    const index = headers.indexOf(footerUniform);
    if (index >= 0 && new Set(rows.map(row => String(row[index] ?? "").trim())).size > 1) return null;
  }
  const unitIndex = headers.indexOf("Birim");
  const oneUnit = unitIndex < 0 || new Set(rows.map(row => String(row[unitIndex] ?? "").trim()).filter(Boolean)).size <= 1;
  const out = headers.map(() => "");
  let any = false;
  headers.forEach((header, index) => {
    const type = types[index];
    if ((type !== "money" && type !== "number") || NO_SUM.test(header)) return;
    if (type === "number" && unitIndex >= 0 && !oneUnit) return;
    let total = 0;
    let seen = false;
    for (const row of rows) {
      const value = cellNumber(row[index], type);
      if (value === null) continue;
      total += value;
      seen = true;
    }
    if (!seen) return;
    any = true;
    out[index] = type === "money" ? tl(roundMoney(total)) : QTY_FORMAT.format(Math.round(total * 1000) / 1000);
  });
  if (footer && typeof footer === "object") {
    for (const [header, value] of Object.entries(footer)) {
      const index = headers.indexOf(header);
      if (index >= 0) {
        out[index] = value;
        any = true;
      }
    }
  }
  if (!any) return null;
  const label = out.findIndex((value, index) => !value && types[index] !== "money" && types[index] !== "number");
  out[label >= 0 ? label : 0] = out[label >= 0 ? label : 0] || "TOPLAM";
  return out;
}
// 2.4.3 UX24: yönü karışık raporda (satış/alış, alacak/borç) tek TOPLAM yerine her yön için ayrı TOPLAM satırı ve bir Net satırı. footerGroups:
// { column, groups: [{ label, values }], net?: { label, cells: { Kolon: değer } } }. Gruplar satırlardan (yukarıdaki kural) hesaplanır, etiket
// grup kolonuna yazılır; Net satırının hücrelerini rapor verir (yön işaretleri rapora özgü). Tek yön kalırsa (süzgeç) tek TOPLAM satırı döner.
// Dönen: TOPLAM satırları dizisi (boş dizi = TOPLAM yok). Ekran, PDF ve Excel bu dizinin hepsini aynı sırayla yazar.
export function footerRows({ headers = [], types = [], rows = [], footer, footerUniform, footerGroups }) {
  if (footer === false || !rows.length) return [];
  const index = footerGroups ? headers.indexOf(footerGroups.column) : -1;
  const mixed = index >= 0 && new Set(rows.map(row => String(row[index] ?? "").trim())).size > 1;
  if (!mixed) {
    const single = footerRow({ headers, types, rows, footer, footerUniform: footerGroups ? undefined : footerUniform });
    return single ? [single] : [];
  }
  const out = [];
  for (const group of footerGroups.groups || []) {
    const values = new Set(group.values);
    const subset = rows.filter(row => values.has(String(row[index] ?? "").trim()));
    if (!subset.length) continue;
    const line = footerRow({ headers, types, rows: subset });
    if (!line) continue;
    const auto = line.indexOf("TOPLAM");
    if (auto >= 0) line[auto] = "";
    line[index] = group.label;
    out.push(line);
  }
  const net = footerGroups.net;
  if (net && out.length > 1) {
    const line = headers.map(() => "");
    line[index] = net.label;
    for (const [header, value] of Object.entries(net.cells || {})) {
      const at = headers.indexOf(header);
      if (at >= 0) line[at] = value;
    }
    out.push(line);
  }
  return out;
}

export function registerReportCenter(router, { store, auth, audit, dataset, tax = () => null, company = () => null, cash = () => null, accounts = () => null, plans = () => null, stock = () => null, cheques = () => null, invoices = () => null, overview = () => null, ledger = () => null, integrity = () => null, doubtful = () => null, money: moneyApi = null, bankAccounts = null, now: clock = systemClock, offload = null }) {
  const today = () => isoDay(clock());
  const office = () => store.setting("office.name", "");
  // Rapor başlığındaki şirket (2.2.0 İz 1.1; 2.0.17 m2 kararı "rapor/PDF/Excel başlığında 001 · Unvan"): bu örneğin şirketinin kodu (kayıt defteri)
  // ve unvanı (office.name; PDF'in başlığında da bu yazıyordu; boşsa şirketin adı). İstek pencerenin şirketine gider (?hofCompany=, app.mjs
  // dispatch), dolayısıyla etiket de o şirketindir. Önceden Excel'de şirket hiç yoktu, PDF'te yalnız unvan vardı.
  // 2.4.5 madde 6c: etiket ve Tabela Adı başlığı tek yardımcıda (lib/report-header.mjs; önceden üç rotada aynı kopya).
  const header = createReportHeader({ store, company: company });
  const companyLabel = header.companyLabel;
  const admin = { id: "", role: "admin" };

  // ---------- Ortak yardımcılar ----------
  const rangeOf = (query, preset) => {
    const named = presetRange(query.preset || preset, today());
    const from = query.from || named?.from || "";
    const to = query.to || named?.to || "";
    if (from && !validDate(from)) throw new HttpError(400, "Başlangıç tarihi geçerli değil.");
    if (to && !validDate(to)) throw new HttpError(400, "Bitiş tarihi geçerli değil.");
    if (from && to && from > to) throw new HttpError(400, "Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    return { from, to };
  };
  const inRange = (date, { from, to }) => (!from || date >= from) && (!to || date <= to);
  // Vade raporlarında (çek/senet portföyü, taksit vadeleri) "Tüm Zamanlar" sınırsızdır: vadesi henüz gelmemiş evrak ve
  // taksitler de listelenir (v2.0.20; önceden aralık bugünde bitiyor, ileri vadeli çekler portföyde görünmüyordu).
  const dueRangeOf = (query, preset) => (query.preset === "all" ? { from: "", to: "" } : rangeOf(query, preset));
  const allTime = from => isAllTimeStart(from, today());
  const rangeText = ({ from, to }) =>
    allTime(from) ? `Tüm Zamanlar · ${to ? dayText(to) : "bugün"} tarihine kadar` : from || to ? `${from ? dayText(from) : "…"} – ${to ? dayText(to) : "…"}` : "Tüm Zamanlar";
  const openingDay = from => (from && !allTime(from) ? dayText(from) : "");
  // Kayıt anahtarı → okunur ad (tablodaki satırın ilk iki anlamlı değeri; tahsilat/taksit kaydındaki ad önce).
  function caseTitles(keys) {
    const out = new Map();
    const wanted = [...new Set(keys.filter(Boolean))];
    for (let index = 0; index < wanted.length; index += 400) {
      const chunk = wanted.slice(index, index + 400);
      const marks = chunk.map(() => "?").join(", ");
      const rows = [...store.all(`SELECT case_key AS key, values_json AS json FROM dataset_rows WHERE case_key IN (${marks})`, ...chunk), ...store.all(`SELECT case_key AS key, values_json AS json FROM records WHERE case_key IN (${marks})`, ...chunk)];
      for (const row of rows) {
        if (out.has(row.key)) continue;
        let values = {};
        try {
          values = JSON.parse(row.json || "{}");
        } catch {
          values = {};
        }
        const parts = [];
        for (const [column, value] of Object.entries(values)) {
          if (column.startsWith("__") || SEQUENCE.test(column.trim())) continue;
          const textValue = String(value ?? "").trim();
          if (!textValue || /^[-–—]+$/.test(textValue)) continue;
          parts.push(textValue.length > 40 ? `${textValue.slice(0, 38)}…` : textValue);
          if (parts.length === 2) break;
        }
        if (parts.length) out.set(row.key, parts.join(" · "));
      }
    }
    return key => out.get(key) || (String(key || "").startsWith("satir:") ? "" : String(key || ""));
  }
  const cashLabel = entry => {
    if (entry.source === "payment") return [entry.caseTitle, entry.description].filter(Boolean).join(" · ") || "Tahsilat";
    if (entry.source === "plan") return [entry.planName, entry.description].filter(Boolean).join(" · ");
    if (entry.source === "account") return [entry.accountName, entry.description].filter(Boolean).join(" · ");
    return entry.description || "";
  };

  // ---------- Banka raporları (v2.1.0 Aşama 14; plan §8.10, §3.4, K10) ----------
  // Kaynak tek kaynaktır (moneyLines, K5): satırlar ve Giriş / Çıkış / Transfer / Açılış ve Devir payları money.classified'dan (Banka penceresinin
  // "Bugün ve Bu Ay"ı ile aynı kural, flows); Banka Masraf Raporu Banka penceresinin masraf verisinden (movements.feeReport), Alt Hesap Mizanı
  // Banka penceresindeki Alt Hesap Mizanı'nın verisinden (subTrialData).
  const bankService = () => (typeof bankAccounts === "function" ? bankAccounts() : bankAccounts);
  const moneyLines = () => (typeof moneyApi === "function" ? moneyApi() : moneyApi);
  // Kuruş tamsayısında roundMoney(k / 100) === k / 100 (|k| < 1e13; −0 üretilmez): yuvarlama atlanır (büyük raporda satır başına iki-üç çağrı;
  // 11.10.2026 hız düzeltmesi). Tamsayı olmayan değer eskisi gibi yuvarlanır.
  const cents = value => {
    const number = Number(value) || 0;
    return money(Number.isSafeInteger(number) && Math.abs(number) < 1e13 ? (number === 0 ? 0 : number / 100) : roundMoney(number / 100));
  };
  const BANK_MOVES = Object.freeze({ external: "Dış Hareketler", internal: "Transfer (İç Hareketler)" });
  const BANK_GROUPS = Object.freeze({ real: K10_LABELS.realBank, debt: K10_LABELS.debt, unassigned: K10_LABELS.unassigned, all: "Tümü" });
  const UNASSIGNED_CHOICE = "unassigned";
  // POS Ödeme Takvimi'nin Tür süzgeci (lib/bank/pos.mjs calendarView kind).
  const POS_KINDS = Object.freeze({ pos: "POS", blocked: K10_LABELS.posBlocked, fee: "Komisyon Tahsili" });
  const isRealKind = kind => kind !== "card" && kind !== "loan";
  const bankRows = () => {
    try {
      return store.all("SELECT id, code, kind, gl, gl_sub AS glSub, bank_name AS bankName, name, status FROM bank_accounts WHERE deleted_at IS NULL ORDER BY position, created_at");
    } catch {
      return []; // banka tabloları yoksa (göç öncesi veri) banka raporları boş
    }
  };
  const bankLabel = row => `${row.bankName} · ${row.name}${row.status === "passive" ? " (Pasif)" : ""}`;
  const UNASSIGNED_WAYS = Object.freeze({ bank: { sub: "102.00", label: "Havale / EFT" }, card: { sub: "108.00", label: "POS / Kart" } });
  // Satırın işlem türü (İşlem No'su olmayan eski satırda kaynağından).
  const lineType = line => {
    if (line.event_type) {
      if (line.event_type === "reversal") return `${typeLabel("reversal")} · ${typeLabel(line.base_type || "", line.kind === "in" ? "out" : "in")}`;
      return typeLabel(line.event_type, line.kind);
    }
    switch (Number(line.src)) {
      case 1:
        return typeLabel("record_in");
      case 2:
        return Number(line.internal) === 1 ? typeLabel("cash_transfer") : typeLabel(line.kind === "out" ? "cash_out" : "cash_in");
      case 3:
        return typeLabel(line.kind === "out" ? "party_out" : "party_in");
      case 4:
        return typeLabel("invoice_cash", line.kind);
      case 6:
        return typeLabel(line.kind === "out" ? "plan_out" : "plan_in");
      case 7:
        return typeLabel("stock_cash", line.kind);
      case 8:
        return typeLabel(line.kind === "out" ? "cheque_pay" : "cheque_collect");
      default:
        return "Banka Fişi";
    }
  };
  function bankChoice(value) {
    const rows = bankRows();
    const choice = String(value || "");
    if (!choice) return { rows, refs: new Set(rows.filter(row => isRealKind(row.kind)).map(row => row.id)), title: `${K10_LABELS.realBank} (Tüm Hesaplar)`, single: null };
    if (choice === UNASSIGNED_CHOICE) return { rows, refs: null, unassigned: true, title: K10_LABELS.unassigned, single: null };
    const row = rows.find(item => item.id === choice);
    if (!row) throw new HttpError(404, "Banka hesabı bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", { code: "bank-account-missing" });
    return { rows, refs: new Set([row.id]), title: `${bankLabel(row)} (${row.glSub})`, single: row };
  }
  // Seçimin satırları (tarih sırasıyla; to'dan sonrası okunmaz): Hesabı Atanmamış = bağsız havale ve POS satırları (102.00 / 108.00).
  // 11.10.2026 hız düzeltmesi (§3.11 madde 5): dönem başından ÖNCEKİ satırlar okunmaz — anahtar (hesap) bazında devirleri ve ilk görünme sırası
  // SQL toplamıyla (moneyLines.keyTotals); satırlar yalnız dönem içinden (since). Hesap süzgeci kaynağa itilir (refs / unbound). Önceden her
  // açılışta hesabın bütün satırları okunup sınıflanıyordu. Dönüş: { before: [{ key, cents }] (ilk görünme sırasıyla), lines: dönem satırları }.
  function bankLinesOf(choice, from, to) {
    const lines = moneyLines();
    const scope = choice.unassigned ? { ways: ["bank", "card"], unbound: true } : choice.single ? { ref: choice.single.id } : choice.refs.size ? { ways: ["bank"], refs: [...choice.refs] } : null;
    if (!lines?.classified || !scope) return { before: [], lines: [] };
    const keep = line => (choice.unassigned ? !line.ref : choice.single ? true : Boolean(line.ref) && choice.refs.has(line.ref));
    return {
      before: from && lines.keyTotals ? lines.keyTotals({ ...scope, before: from, until: to }) : [],
      lines: lines.classified({ ...scope, since: from, until: to }).filter(keep),
    };
  }
  const keyOf = (choice, line) => (choice.unassigned ? `u:${line.way}` : line.ref);
  const keyLabel = (choice, key) => {
    if (choice.unassigned) {
      const way = UNASSIGNED_WAYS[key.slice(2)] || { sub: "", label: key };
      return `${K10_LABELS.unassigned} · ${way.label} (${way.sub})`;
    }
    const row = choice.rows.find(item => item.id === key);
    return row ? bankLabel(row) : key;
  };

  // ---------- 2.3.0 İz 3.3: §8.10 kalan banka raporları (docs/2.3.0-RAPORLAR-KABUL.md; 2.1.0 eşleme 130, 293–301) ----------
  // Kaynak yine tek kaynaktır (moneyLines.classified / keyTotals; Banka Hareket Raporu'yla aynı sınıflama). Transfer raporları işlem başlığından
  // (fin_events + bank_lines) ve Kasa ↔ Banka transferinin iki bacağından (cash_entries.transfer_id) okur; Banka Nakit Akış Raporu POS valör
  // kalemleri (pos.flows), tahsildeki evrak (cheques.flows deposit) ve planlı işlemlerle (vouchers.planFlows) kurulur — iş parçacığında değil.
  const NONCASH_WAYS = Object.freeze(["bank", "card", "ccard", "loan"]);
  const toCents = value => Math.round((Number(value) || 0) * 100);
  const cell = value => (value ? cents(value) : "");
  // Yol adı (görünen metinde "Kurumsal" yok — 12.10.2026): havale / POS ya da kredi kartı (yöne göre, pay-method) / kurumsal kart 309 → Kredi Kartı /
  // kredi 300 → Kredi.
  const wayText = line => (line.way === "ccard" ? "Kredi Kartı" : line.way === "loan" ? "Kredi" : methodLabel(line.method, line.kind));
  const posRows = () => {
    try {
      return store.all("SELECT id, name, code FROM pos_terminals");
    } catch {
      return [];
    }
  };
  // Satırın hesabı: hesaba bağlı → "Banka · Hesap (102.01)"; POS'a bağlı (fin_ref = POS) → "POS · Ad"; bağsız → Hesabı Atanmamış … (102.00 / 108.00).
  function lineAccountText(line, banks, poses) {
    if (!line.ref) return keyLabel({ unassigned: true, rows: banks }, `u:${line.way}`);
    const bank = banks.find(row => row.id === line.ref);
    if (bank) return `${bankLabel(bank)} (${bank.glSub})`;
    const pos = poses.find(row => row.id === line.ref);
    return pos ? `POS · ${pos.name}` : line.ref;
  }
  const userNames = () => new Map(store.all("SELECT id, display_name AS name FROM users").map(row => [row.id, row.name || ""]));
  const partyNames = () => new Map(store.all("SELECT id, name FROM accounts").map(row => [row.id, row.name]));
  // Satırın açıklaması: cari / taksit / komisyon satırında yalnız not (cari ve kart adı kendi kolonunda); öbürlerinde Kasa penceresindeki metin.
  const lineText = entry => (entry.source === "account" || entry.source === "bank" || entry.source === "plan" ? entry.description || "" : cashLabel(entry) || entry.description || "");
  const LINE_SOURCE = Object.freeze({ account: "Cari", invoice: "Fatura", bank: "POS Komisyonu", plan: "Taksit", stock: "Stok", cheque: "Çek / Senet", bankLine: "Banka Fişi", payment: "Kayıt Tahsilatı", manual: "Kasa" });
  // Hesap süzgeci (anyAccount; Banka ve POS Hareketleri, Cari / Fatura / Taksit ve Banka Hareketleri): "" → bütün banka tarafı (hesaplı, POS'lu ve
  // hesabı atanmamış satırlar), hesap → yalnız o hesap (kart ve kredi dahil), unassigned → yalnız bağsız eski hareketler.
  function anyAccountChoice(value) {
    const rows = bankRows();
    const choice = String(value || "");
    if (!choice) return { rows, scope: {}, title: "Tüm Hesaplar", single: null, unassigned: false };
    if (choice === UNASSIGNED_CHOICE) return { rows, scope: { unbound: true }, title: K10_LABELS.unassigned, single: null, unassigned: true };
    const row = rows.find(item => item.id === choice);
    if (!row) throw new HttpError(404, "Banka hesabı bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", { code: "bank-account-missing" });
    return { rows, scope: { ref: row.id }, title: `${bankLabel(row)} (${row.glSub})`, single: row, unassigned: false };
  }
  // Seçimin dönem satırları (sınıflanmış; tarih sırasıyla). ways verilmezse bütün banka tarafı yolları.
  function scopedLines(choice, range, ways = NONCASH_WAYS) {
    const lines = moneyLines();
    if (!lines?.classified) return [];
    const list = lines.classified({ ways, ...choice.scope, since: range.from, until: range.to });
    return choice.unassigned ? list.filter(line => !line.ref) : list;
  }
  // Günlük / Aylık Banka Raporu: seçimin (Banka Hareket Raporu'yla aynı kapsam) dönem satırları anahtara (gün ya da ay) toplanır; devir dönem
  // başından önceki satırların toplamı. Paylar sınıflamadan (dış giriş/çıkış, iç transfer, açılış ve devir düzeltmesi); Net = anahtarın bakiye değişimi.
  function bankPeriodTotals(choice, range, keyOf) {
    const source = bankLinesOf(choice, range.from, range.to);
    const opening = source.before.reduce((sum, item) => sum + item.cents, 0);
    const buckets = new Map();
    for (const line of source.lines) {
      const key = keyOf(line.date);
      const bucket = buckets.get(key) || { count: 0, extIn: 0, extOut: 0, trIn: 0, trOut: 0, adjust: 0 };
      bucket.count += 1;
      bucket.extIn += Number(line.ext_in) || 0;
      bucket.extOut += Number(line.ext_out) || 0;
      bucket.trIn += Number(line.tr_in) || 0;
      bucket.trOut += Number(line.tr_out) || 0;
      bucket.adjust += Number(line.adjust) || 0;
      buckets.set(key, bucket);
    }
    return { opening, buckets, count: source.lines.length, first: source.lines[0]?.date || "", last: source.lines.at(-1)?.date || "" };
  }
  const netOf = bucket => bucket.extIn - bucket.extOut + bucket.trIn - bucket.trOut + bucket.adjust;
  const periodSummary = (choice, opening, totals, closing, countLabel, count) => [
    ["Hesap", choice.title],
    ["Devir", cents(opening)],
    ["Giriş", cents(totals.extIn)],
    ["Çıkış", cents(totals.extOut)],
    ["Transfer Giriş", cents(totals.trIn)],
    ["Transfer Çıkış", cents(totals.trOut)],
    ...(totals.adjust ? [["Açılış ve Devir Düzeltmeleri", cents(totals.adjust)]] : []),
    ["Dönem Sonu", cents(closing)],
    [countLabel, String(count)],
  ];
  // Hesap bazında dönem sonu bakiyeleri (kuruş; Banka Bakiye Raporu'nun toplam yoluyla aynı: classifiedTotals). day: hesabı atanmamış ileri tarihli
  // eski satır (ahead) bakiyeye girmez. Dönüş: Map anahtar (hesap ya da u:yol) → kapanış.
  function closingByKey(to) {
    const out = new Map();
    const lines = moneyLines();
    if (!lines?.classifiedTotals) return out;
    for (const item of lines.classifiedTotals({ ways: [...NONCASH_WAYS], until: to, day: today() })) if (Number(item.ahead) !== 1) out.set(item.key, (out.get(item.key) || 0) + Number(item.closing));
    return out;
  }
  // Banka Bazında / Para Birimi Bazında Bakiye: aynı tablo, farklı gruplama anahtarı.
  function groupedBalances(range, groupOf, groupHeader, { uniform = false } = {}) {
    const closing = closingByKey(range.to);
    const groups = new Map();
    const rows = bankRows().map(row => ({ ...row, currency: row.currency || "TRY" }));
    for (const row of rows) {
      const key = groupOf(row);
      const group = groups.get(key) || { count: 0, real: 0, debt: 0 };
      group.count += 1;
      const value = closing.get(row.id) || 0;
      if (isRealKind(row.kind)) group.real += value;
      else group.debt -= value;
      groups.set(key, group);
    }
    const list = [...groups.entries()].sort(([a], [b]) => collator.compare(a, b));
    const total = { real: 0, debt: 0 };
    for (const [, group] of list) {
      total.real += group.real;
      total.debt += group.debt;
    }
    const unassigned = (closing.get("u:bank") || 0) + (closing.get("u:card") || 0);
    return {
      subtitle: `Dönem sonu bakiyeleri ${range.to ? dayText(range.to) : "bugün"} itibarıyla${uniform ? " · Tutarlar TL karşılığı" : ""}`,
      headers: [groupHeader, "Hesap", K10_LABELS.realBank, K10_LABELS.debt, "Net"],
      types: ["", "number", "money", "money", "money"],
      rows: list.map(([name, group]) => [name, String(group.count), cents(group.real), cents(group.debt), cents(group.real - group.debt)]),
      summary: [
        [K10_LABELS.realBank, rows.some(row => isRealKind(row.kind)) ? cents(total.real) : "Banka Hesabı Tanımlanmadı"],
        ...(rows.some(row => !isRealKind(row.kind)) ? [[K10_LABELS.debt, cents(total.debt)]] : []),
        ["Net", cents(total.real - total.debt)],
        ...(unassigned || closing.has("u:bank") || closing.has("u:card") ? [[K10_LABELS.unassigned, cents(unassigned)]] : []),
        [groupHeader, String(list.length)],
      ],
      ...(uniform ? { footerUniform: groupHeader } : {}),
    };
  }
  const BANK_FLOW_SOURCE = Object.freeze({ pos: "POS", posBlocked: K10_LABELS.posBlocked, posFee: "Komisyon Tahsili", deposit: "Tahsildeki Çek ve Senet", givenCheque: "Verilen Çek ve Senet", plan: "Planlı Banka İşlemi", transfer: "Planlanan Transfer", cardDue: "Kart Borcu (Son Ödeme Günü)" });
  // Rapor Merkezi grup sırası (2.3.0 İz 5.4; kullanıcı kararı 15.10.2026): tek sıralama listesi — tanım sırasından bağımsız, kararlı sıralama
  // (grubun içindeki rapor sırası tanım sırasıdır). Listede olmayan grup sona gider.
  const GROUP_ORDER = Object.freeze(["Cari", "Kasa", "Stok", "Fatura", "Çek / Senet", "Taksit", "Banka", "Ana Defter", "Kayıtlar", "Ofis"]);
  const groupRank = name => (GROUP_ORDER.includes(name) ? GROUP_ORDER.indexOf(name) : GROUP_ORDER.length);
  // ---------- 2.3.0 İz 5.3: POS Satış / POS Komisyon raporları (tek kaynak pos_sales) ----------
  const POS_SALE_KINDS = Object.freeze({ sale: "POS Satışı", refund: "POS İadesi", cancel: "POS İptal İadesi" });
  const POS_PERIODS = Object.freeze({ month: "Aylık", year: "Yıllık", range: "Dönem Toplamı" });
  const installmentText = n => (Number(n) > 1 ? `${n} Taksit` : "Tek Çekim");
  // Kesinti oranı iki ondalıkla (%2,50 gibi; komisyon oranlarının kendisi iki ondalık yazılır).
  const rateText = (part, whole) => (whole > 0 ? `%${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((part / whole) * 100)}` : "");
  const posSaleKind = row => (row.kind === "sale" ? "sale" : row.src === "cancel" ? "cancel" : "refund");
  const posTitle = posId => (posId ? bankService()?.pos?.list?.().find(item => item.id === posId)?.name || "POS" : "Tüm POS'lar");
  /**
   * Satırın işaretli tutarları (kuruş): satış artı; iade ve iptal iadesi eksi (iadede komisyon = bankanın geri verdiği komisyon, eksi). Kayıtta
   * (lib/bank/pos-math.mjs commissionOf) "dahil" kipinde commission_minor vergiyi İÇERİR (tax_minor içindeki pay), "hariç" kipinde vergi üstüne
   * eklenir; raporda Komisyon her zaman vergisiz matrah, BSMV / KDV ayrı kolon, Net = Brüt − Komisyon − Vergi (Banka Masraf Raporu'yla aynı ayrım).
   */
  function posSaleAmounts(row) {
    const sign = row.kind === "sale" ? 1 : -1;
    const recorded = row.kind === "sale" ? Number(row.commission) || 0 : Number(row.commissionRefund) || 0;
    const tax = Number(row.tax) || 0;
    const commission = row.taxMode === "excluded" ? recorded : recorded - tax;
    const vat = row.taxKind === "vat";
    return { gross: sign * (Number(row.gross) || 0), commission: sign * commission, bsmv: vat ? 0 : sign * tax, vat: vat ? sign * tax : 0, net: sign * (Number(row.net) || 0) };
  }
  function posSalesRows(range, posId) {
    try {
      return store.all(
        `SELECT s.id, s.kind, s.src, s.status, s.date, s.pos_id AS posId, s.installments, s.tax_kind AS taxKind, s.tax_mode AS taxMode, s.gross_minor AS gross, s.commission_minor AS commission,
                s.tax_minor AS tax, s.net_minor AS net, s.commission_refund_minor AS commissionRefund, s.blocked, e.no AS eventNo, COALESCE(e.party_id, '') AS partyId, p.name AS posName
         FROM pos_sales s LEFT JOIN fin_events e ON e.id = s.event_id LEFT JOIN pos_terminals p ON p.id = s.pos_id
         WHERE s.status <> 'void' AND (:pos = '' OR s.pos_id = :pos) AND (:from = '' OR s.date >= :from) AND (:to = '' OR s.date <= :to)
         ORDER BY s.date, s.created_at, s.rowid`,
        { pos: posId, from: range.from, to: range.to },
      );
    } catch {
      return []; // POS tabloları yoksa (göç öncesi veri)
    }
  }
  // ---------- Rapor kaydı ----------
  // params: "range" (tarih aralığı), "asOf", "account", "type", "side", "status", "direction", "category", "state", "planStatus", "taskStatus", "tab"
  const REPORTS = [
    // ===== Kasa =====
    {
      id: "kasa-hareketleri",
      group: "Kasa",
      title: "Kasa Hareketleri",
      description: "Nakit kasanın seçilen aralıktaki giriş ve çıkışları; devir, yürüyen bakiye ve kaynağı (kayıt tahsilatı, taksit, cari, stok, çek/senet, elle, banka transferi). Havale/EFT ve POS hareketleri Banka ve POS Hareketleri raporunda.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const data = cash().report(admin, range.from, range.to, "cash");
        const rows = [[openingDay(range.from), "Devir", "Dönem başı kasa", "", "", money(data.opening), ""]];
        for (const entry of data.entries) rows.push([dayText(entry.date), CASH_SOURCE[entry.source] || entry.source, cashLabel(entry), entry.kind === "in" ? money(entry.amount) : "", entry.kind === "out" ? money(entry.amount) : "", money(entry.balance), entry.actorName || ""]);
        const closing = roundMoney(data.opening + data.period.in - data.period.out);
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Kaynak", "Açıklama", "Giriş", "Çıkış", "Bakiye", "Giren"],
          types: ["", "", "", "money", "money", "money", ""],
          rows,
          summary: [["Devir", money(data.opening)], ["Dönem Giriş", money(data.period.in)], ["Dönem Çıkış", money(data.period.out)], ["Dönem Net", money(data.period.net)], ["Dönem Sonu Kasa", money(closing)], ["Güncel Kasa (tüm hareketler)", money(data.totals.balance)]],
        };
      },
    },
    {
      id: "kasa-gunluk",
      group: "Kasa",
      title: "Günlük Kasa Özeti",
      description: "Her gün için toplam giriş, çıkış, net ve gün sonu kasa.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const data = cash().report(admin, range.from, range.to, "cash");
        const days = new Map();
        for (const entry of data.entries) {
          const day = days.get(entry.date) || { in: 0, out: 0, count: 0, balance: 0 };
          day[entry.kind] = roundMoney(day[entry.kind] + entry.amount);
          day.count += 1;
          day.balance = entry.balance;
          days.set(entry.date, day);
        }
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Hareket", "Giriş", "Çıkış", "Net", "Gün Sonu Kasa"],
          types: ["", "number", "money", "money", "money", "money"],
          rows: [...days.entries()].map(([date, day]) => [dayText(date), String(day.count), money(day.in), money(day.out), money(roundMoney(day.in - day.out)), money(day.balance)]),
          summary: [["Devir", money(data.opening)], ["Dönem Giriş", money(data.period.in)], ["Dönem Çıkış", money(data.period.out)], ["Gün Sayısı", String(days.size)]],
        };
      },
    },
    {
      id: "kasa-kaynak",
      group: "Kasa",
      title: "Gelir / Gider Kaynağa Göre",
      description: "Giriş ve çıkışların kaynağına göre dağılımı: kayıt tahsilatı, taksit, cari, stok, çek/senet, elle girilen.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const data = cash().report(admin, range.from, range.to, "cash");
        const groups = new Map();
        for (const entry of data.entries) {
          const group = groups.get(entry.source) || { in: 0, out: 0, count: 0 };
          group[entry.kind] = roundMoney(group[entry.kind] + entry.amount);
          group.count += 1;
          groups.set(entry.source, group);
        }
        return {
          subtitle: rangeText(range),
          headers: ["Kaynak", "Hareket", "Giriş", "Çıkış", "Net"],
          types: ["", "number", "money", "money", "money"],
          rows: [...groups.entries()].sort((a, b) => b[1].in + b[1].out - (a[1].in + a[1].out)).map(([source, group]) => [CASH_SOURCE[source] || source, String(group.count), money(group.in), money(group.out), money(roundMoney(group.in - group.out))]),
          summary: [["Toplam Giriş", money(data.period.in)], ["Toplam Çıkış", money(data.period.out)], ["Net", money(data.period.net)]],
        };
      },
    },
    {
      id: "kasa-aylik",
      group: "Kasa",
      title: "Aylık Kasa Özeti",
      description: "Her ay için toplam giriş, çıkış, net ve ay sonu kasa; kasanın yıl içindeki seyri (hareketsiz ay da yazılır).",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const data = cash().report(admin, range.from, range.to, "cash");
        const months = new Map();
        for (const entry of data.entries) {
          const key = entry.date.slice(0, 7);
          const month = months.get(key) || { in: 0, out: 0, count: 0, closing: 0 };
          month[entry.kind] = roundMoney(month[entry.kind] + entry.amount);
          month.count += 1;
          month.closing = entry.balance;
          months.set(key, month);
        }
        // Aylar: aralığın başından bugünkü aya (ya da son harekete) kadar; aralık sonunu geçmez.
        // "Tüm Zamanlar" (v2.0.20): 50 yıl öncesinden değil, ilk kasa hareketinin ayından başlar (600 boş ay yazılmasın).
        const first = range.from && !allTime(range.from) ? range.from.slice(0, 7) : data.entries[0]?.date.slice(0, 7) || today().slice(0, 7);
        const lastMove = data.entries.at(-1)?.date.slice(0, 7) || "";
        let last = today().slice(0, 7) > lastMove ? today().slice(0, 7) : lastMove;
        if (range.to && range.to.slice(0, 7) < last) last = range.to.slice(0, 7);
        let balance = data.opening;
        const rows = [];
        for (const key of first <= last ? monthsBetween(first, last) : []) {
          const month = months.get(key);
          const opening = balance;
          if (month) balance = month.closing;
          rows.push([monthLabel(key), month ? String(month.count) : "0", money(opening), money(month?.in || 0), money(month?.out || 0), money(roundMoney((month?.in || 0) - (month?.out || 0))), money(balance)]);
        }
        return {
          subtitle: rangeText(range),
          headers: ["Ay", "Hareket", "Ay Başı Kasa", "Giriş", "Çıkış", "Net", "Ay Sonu Kasa"],
          types: ["", "number", "money", "money", "money", "money", "money"],
          rows,
          summary: [["Devir", money(data.opening)], ["Toplam Giriş", money(data.period.in)], ["Toplam Çıkış", money(data.period.out)], ["Net", money(data.period.net)], ["Dönem Sonu Kasa", money(roundMoney(data.opening + data.period.in - data.period.out))]],
        };
      },
    },
    // ===== Ana Defter (v2.0.13) =====
    {
      id: "hesap-mizani",
      group: "Ana Defter",
      title: "Hesap Planı Mizanı",
      description: "Tekdüzen hesap planına göre her hesabın devir, dönem borç, dönem alacak ve bakiyesi. Çift yönlü kayıt: borç toplamı alacak toplamına eşittir.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const { trial, reconciliation } = ledger().check({ from: range.from, to: range.to });
        return {
          subtitle: `${rangeText(range)} · ${trial.balanced ? "Borç = Alacak" : "DENGESİZ KAYIT VAR"} · Mutabakat ${reconciliation.ok ? "tutarlı" : "farklı"}`,
          headers: ["Hesap", "Hesap Adı", "Devir", "Borç", "Alacak", "Bakiye", "Yön"],
          types: ["", "", "money", "money", "money", "money", ""],
          rows: trial.accounts.map(row => [row.code, row.name, money(row.opening), money(row.debit), money(row.credit), money(Math.abs(row.balance)), row.balance > 0.005 ? "Borç" : row.balance < -0.005 ? "Alacak" : ""]),
          summary: [["Dönem Borç", money(trial.totals.debit)], ["Dönem Alacak", money(trial.totals.credit)], ["Fark", money(trial.totals.difference)]],
        };
      },
    },
    {
      id: "yevmiye",
      group: "Ana Defter",
      title: "Yevmiye Defteri",
      description: "Aralıktaki her işlemin çift yönlü kaydı: hangi hesap borçlandı, hangi hesap alacaklandı (Kasa, Banka, Cari, Stok, Çek/Senet, Taksit).",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const rows = [];
        // MM8 (2.4.3): özetteki madde sayısı gerçek madde (fiş) sayısıdır — önceden satır / 2 ("Madde 2,5": üç satırlı POS gün sonu maddesi yarım sayılıyordu).
        let entries = 0;
        for (const entry of ledger().build()) {
          if ((range.from && entry.date < range.from) || (range.to && entry.date > range.to)) continue;
          entries += 1;
          // Alt hesap (102.01, 101.02 …) varsa o yazılır (doğrulama T3: Bankaya Tahsile Ver maddesi "101 / 101" görünüyordu; evrakın 101.01'den
          // 101.02'ye geçtiği okunamıyordu). Ana hesap kodu alt hesabın başındadır (Hesap Planı Mizanı ana hesapla toplar).
          for (const line of entry.lines) rows.push([dayText(entry.date), entry.source, entry.text || "", line.sub || line.account, money(line.debit / 100), money(line.credit / 100)].map((cell, index) => (index >= 4 && cell === money(0) ? "" : cell)));
        }
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "İşlem", "Açıklama", "Hesap", "Borç", "Alacak"],
          types: ["", "", "", "", "money", "money"],
          rows,
          summary: [["Madde", String(entries)], ["Satır", String(rows.length)]],
        };
      },
    },
    {
      id: "defter-mutabakati",
      group: "Ana Defter",
      title: "Defter Mutabakatı",
      description: "Ana defter bakiyeleri ile alt defterlerin (Nakit Kasa, Banka, Kredi Kartı, cariler, taksit, çek/senet portföyü) kendi bakiyesinin kuruşu kuruşuna karşılaştırması; kuruş, stok ↔ cari ve çek/senet ↔ cari bağ denetimleri.",
      params: [],
      build() {
        const { reconciliation } = ledger().check();
        const extra = integrity()?.run ? integrity().run().checks.filter(check => !check.code.startsWith("gl:") && check.code !== "balance") : [];
        const ok = reconciliation.ok && extra.every(check => check.ok);
        // Gözden geçirme G4: eski sürümden kalan satır (ileri tarihli, tanınmayan yol) "Fark Var" yerine kendi adıyla görünür;
        // yeni işlemler onu büyütemez, engellenmez de.
        const legacyOnly = check => !check.ok && check.legacy > 0 && check.legacy >= check.count;
        const onlyLegacy = !ok && reconciliation.ok && extra.filter(check => !check.ok).every(legacyOnly);
        // 2. gözden geçirme İ8: eski satırda ne yapılacağı (ör. çek/senette Düzenle ile alış tarihini gerçek güne çekmek).
        const hints = extra.filter(check => legacyOnly(check) && check.hint).map(check => check.hint).join(" ");
        return {
          subtitle: `${ok ? "Tüm hesaplar tutarlı; borç toplamı alacak toplamına eşit. Her kayıt yazılmadan önce bu denetimden geçer." : onlyLegacy ? "Eski sürümden kalan satır var (aşağıda “Eski Sürümden Kalan”). Yeni işlemler engellenmez ve bu satırları büyütemez." : "Fark bulunan hesap var; yöneticiye bildirin. Yeni işlemler bu farkı büyütemez."}${hints ? ` ${hints}` : ""}`,
          headers: ["Hesap", "Hesap Adı", "Ana Defter", "Alt Defter", "Fark", "Durum"],
          types: ["", "", "money", "money", "money", ""],
          rows: [
            ...reconciliation.checks.map(check => [check.code, check.name, money(check.ledger), money(check.subledger), money(check.difference), check.ok ? "Tutarlı" : "Fark Var"]),
            ...extra.map(check => ["Denetim", check.name, "", "", check.ok ? "" : `${check.count} satır`, check.ok ? "Tutarlı" : legacyOnly(check) ? "Eski Sürümden Kalan" : "Fark Var"]),
          ],
          summary: [["Çift Yönlü Denge", reconciliation.balanced ? "Borç = Alacak" : "Dengesiz"], ["Sonuç", ok ? "Tutarlı" : "Fark Var"]],
          footer: false, // farklı hesapların (Kasa, Banka, Cari…) bakiyeleri toplanmaz
        };
      },
    },
    {
      id: "mutabakat-gunlugu",
      group: "Ana Defter",
      title: "Mutabakat Günlüğü",
      description: "Defterler arasında sapma yaratacağı için otomatik geri alınan (hiç yazılmayan) işlemler ve güncelleme öncesinden kalan sapmalar.",
      params: [],
      build() {
        const rows = integrity()?.recent ? integrity().recent(500) : [];
        return {
          subtitle: rows.length ? `${rows.length} kayıt. Geri alınan işlemlerin hiçbir satırı yazılmadı.` : "Geri alınan işlem yok.",
          headers: ["Zaman", "Olay", "Etkilenen Tablolar", "Denetim"],
          types: ["", "", "", ""],
          // v2.1.0: tam tarama ("scan", kapının görmediği değişiklik) ve eski sürümden dönüşte açılış onarımı ("repair") da bu günlükte.
          rows: rows.map(row => [row.at.replace("T", " ").slice(0, 19), INTEGRITY_ACTIONS[row.action] || "Açılışta Bulunan Sapma", row.tables, row.summary]),
          summary: [["Geri Alınan", String(rows.filter(row => row.action === "rolled-back").length)]],
        };
      },
    },
    // ===== Banka (v2.1.0 Aşama 14; plan §8.10 "Banka" grubu, bank.reports) =====
    // 2.1.0'da (daraltılmış kapsam) Banka Bakiye, Banka Hareket, Banka Masraf Raporu ve Alt Hesap Mizanı. POS, döviz ve ekstre raporları
    // kendi sürümlerinde (2.2.0 / 2.3.0) gelir; bu sürümde görünmez.
    {
      id: "banka-bakiye",
      group: "Banka",
      title: "Banka Bakiye Raporu",
      description: "Her banka hesabının dönem başı ve dönem sonu bakiyesi; dönemdeki giriş, çıkış ve transferleri. Gerçek Banka, Kart ve Kredi Borcu ve Hesabı Atanmamış Eski Hareketler ayrı gruplardır; kart ve kredi borcu ile hesabı atanmamış hareketler Gerçek Banka toplamına girmez. Eski sürümden kalan, tarihi gelmemiş hesapsız hareketler bakiyeye girmez; özette Tarihi Gelince Atanabilir olarak ayrı yazılır.",
      params: ["range", "bankGroup"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      // 11.10.2026 hız düzeltmesi: ayrı iş parçacığında, salt okunur bağlantıyla (lib/report-worker.mjs); yalnız veri tabanı ve tek kaynak okur.
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const group = query.bankGroup || "real";
        if (!Object.hasOwn(BANK_GROUPS, group)) throw new HttpError(400, "Hesap grubu Gerçek Banka, Kart ve Kredi Borcu, Hesabı Atanmamış Eski Hareketler ya da Tümü olmalı.", { code: "bank-filter", field: "bankGroup" });
        const rows = bankRows();
        const sums = new Map();
        // Ek iş D (2.1.0 temel sürüm; plan §8.4 K10 "Hesabı Atanmamış … bugüne kadar", A13 / karar 42): eski sürümden kalan, hesaba atanmamış
        // İLERİ TARİHLİ satır (dönem sonu bugünden sonraysa ya da Tüm Zamanlar) bakiyeye ve giriş/çıkışa karışmaz; Banka Genel Bakış'la aynı
        // kuralla ayrı bilgi ("Tarihi Gelince Atanabilir"; toplamlara girmez). Önceden "Bu Yıl" raporu Hesabı Atanmamış'a ileri tarihli satırı
        // katıyor, Banka Genel Bakış aynı anda bugüne kadarki tutarı gösteriyordu.
        // 11.10.2026 hız düzeltmesi (§3.11 madde 5; ölçek: 100.000 satırda rapor ~4,8 sn, o sürede bütün istekler bekliyordu): hesap bazında
        // toplamlar SQL'de, satırlar JS'e çekilmeden (moneyLines.classifiedTotals: satır yoluyla AYNI sınıflama — CLASS_SQL). Sonuç aynı.
        const day = today();
        const ahead = { count: 0, cents: 0, first: "" };
        const totals = moneyLines()?.classifiedTotals ? moneyLines().classifiedTotals({ ways: ["bank", "card", "ccard", "loan"], until: range.to, from: range.from, day }) : [];
        for (const item of totals) {
          if (Number(item.ahead) === 1) {
            ahead.count += Number(item.lines);
            ahead.cents += Number(item.closing);
            if (!ahead.first || item.first < ahead.first) ahead.first = item.first;
            continue;
          }
          sums.set(item.key, { opening: Number(item.opening), in: Number(item.ext_in), out: Number(item.ext_out), trIn: Number(item.tr_in), trOut: Number(item.tr_out), adjust: Number(item.adjust), closing: Number(item.closing), lines: Number(item.lines) });
        }
        const out = [];
        const add = (groupName, bankName, accountName, sub, b) => out.push([groupName, bankName, accountName, sub, cents(b.opening), cents(b.in), cents(b.out), cents(b.trIn), cents(b.trOut), cents(b.adjust), cents(b.closing)]);
        const empty = { opening: 0, in: 0, out: 0, trIn: 0, trOut: 0, adjust: 0, closing: 0, lines: 0 };
        const total = { real: 0, debt: 0, unassigned: 0 };
        for (const row of rows) {
          const b = sums.get(row.id) || empty;
          const real = isRealKind(row.kind);
          if (real) total.real += b.closing;
          else total.debt -= b.closing;
          if (group === "all" || group === (real ? "real" : "debt")) add(real ? K10_LABELS.realBank : K10_LABELS.debt, row.bankName, `${row.name}${row.status === "passive" ? " (Pasif)" : ""}`, row.glSub, b);
        }
        for (const [way, spec] of Object.entries(UNASSIGNED_WAYS)) {
          const b = sums.get(`u:${way}`);
          if (!b?.lines) continue;
          total.unassigned += b.closing;
          if (group === "all" || group === "unassigned") add(K10_LABELS.unassigned, "—", spec.label, spec.sub, b);
        }
        const hasDebt = rows.some(row => !isRealKind(row.kind));
        const hasReal = rows.some(row => isRealKind(row.kind));
        return {
          subtitle: `${BANK_GROUPS[group]} · ${rangeText(range)} · Dönem sonu bakiyeleri ${range.to ? dayText(range.to) : "bugün"} itibarıyla`,
          headers: ["Grup", "Banka", "Hesap", "Alt Hesap", "Dönem Başı", "Giriş", "Çıkış", "Transfer Giriş", "Transfer Çıkış", "Açılış ve Devir Düzeltmesi", "Dönem Sonu"],
          types: ["", "", "", "", "money", "money", "money", "money", "money", "money", "money"],
          rows: out,
          summary: [
            [K10_LABELS.realBank, hasReal ? cents(total.real) : "Banka Hesabı Tanımlanmadı"],
            ...(hasDebt ? [[K10_LABELS.debt, cents(total.debt)]] : []),
            ...(total.unassigned || sums.has("u:bank") || sums.has("u:card") ? [[K10_LABELS.unassigned, cents(total.unassigned)]] : []),
            // PDF özet hücresi kısa tutulur (uzun değer "…" ile kesiliyordu): tutar ve sayı/ilk gün iki satır.
            ...(ahead.count ? [["Tarihi Gelince Atanabilir", cents(ahead.cents)], ["Tarihi Gelmemiş Eski Hareket", `${ahead.count} · ilk ${dayText(ahead.first)}`]] : []),
            ["Hesap", String(rows.length)],
          ],
          // Gruplar (varlık, borç, hesabı atanmamış) birbirine toplanmaz: TOPLAM yalnız tek grup gösterilirken.
          footerUniform: "Grup",
        };
      },
    },
    {
      id: "banka-hareket",
      group: "Banka",
      title: "Banka Hareket Raporu",
      description: "Seçilen banka hesabının (ya da bütün Gerçek Banka hesaplarının) hareketleri: İşlem No, işlem türü, giriş, çıkış, transfer ve hesabın yürüyen bakiyesi. Kendi hesaplarınız arasındaki para (Kasa ile Banka Arası, Bankalar Arası Transfer, kredi, kart borcu) Transfer kolonlarındadır.",
      params: ["range", "bankAccount", "bankMove"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const move = query.bankMove || "";
        if (move && !Object.hasOwn(BANK_MOVES, move)) throw new HttpError(400, "Hareket süzgeci Dış Hareketler ya da Transfer olmalı.", { code: "bank-filter", field: "bankMove" });
        const choice = bankChoice(query.bankAccount);
        const balance = new Map();
        const opening = new Map();
        const order = [];
        const body = [];
        const totals = { in: 0, out: 0, trIn: 0, trOut: 0, adjust: 0, allIn: 0, allOut: 0, adjusted: false };
        const source = bankLinesOf(choice, range.from, range.to);
        // Dönem başından önceki satırlar: anahtar bazında devir (ilk görünme sırasıyla; önceden satır satır toplanıyordu).
        for (const item of source.before) {
          balance.set(item.key, item.cents);
          opening.set(item.key, item.cents);
          order.push(item.key);
        }
        for (const line of source.lines) {
          const key = keyOf(choice, line);
          if (!balance.has(key)) {
            balance.set(key, 0);
            opening.set(key, 0);
            order.push(key);
          }
          const signed = line.kind === "in" ? Number(line.cents) : -Number(line.cents);
          balance.set(key, balance.get(key) + signed);
          if (range.from && line.date < range.from) {
            opening.set(key, opening.get(key) + signed);
            continue;
          }
          totals.in += line.ext_in;
          totals.out += line.ext_out;
          totals.trIn += line.tr_in;
          totals.trOut += line.tr_out;
          totals.adjust += line.adjust;
          if (line.adjust) totals.adjusted = true;
          if (line.kind === "in") totals.allIn += Number(line.cents);
          else totals.allOut += Number(line.cents);
          if (line.adjust ? Boolean(move) : move === "external" ? !(line.ext_in || line.ext_out) : move === "internal" ? !(line.tr_in || line.tr_out) : false) continue;
          const entry = moneyLines().shape(line);
          let label = cashLabel(entry) || entry.description || "";
          if (line.adjust) label = `${label} (Açılış ve Devir Düzeltmesi: ${line.adjust > 0 ? "+" : "−"}${cents(Math.abs(line.adjust))})`;
          const cell = value => (value ? cents(value) : "");
          body.push([dayText(line.date), line.event_no || "", keyLabel(choice, key), lineType(line), label, cell(line.ext_in), cell(line.ext_out), cell(line.tr_in), cell(line.tr_out), cents(balance.get(key))]);
        }
        // Single hesapta hareket yoksa da devir satırı (bakiyesi) görünür.
        if (choice.single && !order.length) {
          order.push(choice.single.id);
          opening.set(choice.single.id, 0);
          balance.set(choice.single.id, 0);
        }
        const devir = order.map(key => [openingDay(range.from), "", keyLabel(choice, key), "Devir", "Dönem başı bakiye", "", "", "", "", cents(opening.get(key))]);
        const openingTotal = [...opening.values()].reduce((sum, value) => sum + value, 0);
        const closingTotal = [...balance.values()].reduce((sum, value) => sum + value, 0);
        return {
          subtitle: `${choice.title} · ${rangeText(range)}${move ? ` · ${BANK_MOVES[move]}` : ""}`,
          headers: ["Tarih", "İşlem No", "Hesap", "İşlem Türü", "Açıklama", "Giriş", "Çıkış", "Transfer Giriş", "Transfer Çıkış", "Bakiye"],
          types: ["", "", "", "", "", "money", "money", "money", "money", "money"],
          rows: [...devir, ...body],
          summary: [
            ["Hesap", choice.title],
            ["Devir", cents(openingTotal)],
            ["Giriş", cents(totals.in)],
            ["Çıkış", cents(totals.out)],
            ["Transfer Giriş", cents(totals.trIn)],
            ["Transfer Çıkış", cents(totals.trOut)],
            ...(totals.adjusted ? [["Açılış ve Devir Düzeltmeleri", cents(totals.adjust)]] : []),
            ["Dönem Sonu", cents(closingTotal)],
            // Tek hesapta banka ekstresi gibi: hesaba giren ve çıkan her tutar (transfer ve açılış dahil).
            ...(choice.single ? [["Hesaba Giren (Tümü)", cents(totals.allIn)], ["Hesaptan Çıkan (Tümü)", cents(totals.allOut)]] : []),
          ],
        };
      },
    },
    {
      id: "banka-masraf",
      group: "Banka",
      title: "Banka Masraf Raporu",
      description: "Banka masrafları (BSMV'li, vergisiz ve faturalı KDV'li), bankalar arası transfer ücretleri ve POS komisyonları (gün sonunda kesilen; faturalı kipte kaydedilen komisyon faturası): matrah, BSMV ve KDV ayrı kolonlarda; gider hesabı (770 / 653) ve banka hesabı bazında toplamlar. Ters kaydedilen masraf ve iade edilen komisyon eksi yazılır.",
      params: ["range", "feeAccount"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      // 11.10.2026 hız düzeltmesi: 100.000 para satırında Bu Yıl ~0,8 sn ana iş parçacığını tutuyordu → ayrı iş parçacığında (banka hareketleri
      // okuyucusu orada salt okunur kurulur; lib/report-worker.mjs).
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const service = bankService()?.movements;
        const empty = { subtitle: rangeText(range), headers: ["Tarih", "İşlem No", "Banka Hesabı", "Masraf Türü", "Hesap Kodu", "Matrah", "BSMV", "KDV", "Toplam", "Fatura No", "Açıklama"], types: ["", "", "", "", "", "money", "money", "money", "money", "", ""], rows: [], summary: [] };
        if (!service?.feeReport) return empty;
        const account = query.feeAccount || "";
        const report = service.feeReport({ from: range.from, to: range.to, account });
        const label = bankRows().find(row => row.id === account);
        const typeOf = row => `${row.feeTypeName || "Banka Masrafı"}${row.type === "transfer" ? " (Transfer Ücreti)" : row.type === "reversal" ? " (Ters Kayıt)" : ""}`;
        const glText = gl => (gl ? `${gl} ${CHART[gl] || ""}`.trim() : "");
        return {
          ...empty,
          subtitle: `${label ? bankLabel(label) : "Tüm Banka Hesapları"} · ${rangeText(range)}`,
          rows: report.rows.map(row => [dayText(row.date), row.no, row.accountLabel, typeOf(row), glText(row.gl), cents(row.baseMinor), cents(row.bsmvMinor), cents(row.vatMinor), cents(row.totalMinor), row.invoiceNo || "", row.description || ""]),
          summary: [
            ["Kayıt", String(report.rows.length)],
            ["Matrah", cents(report.totals.baseMinor)],
            ["BSMV", cents(report.totals.bsmvMinor)],
            ["KDV", cents(report.totals.vatMinor)],
            ["Toplam", cents(report.totals.totalMinor)],
            ...Object.entries(report.totals.byGl).sort(([a], [b]) => a.localeCompare(b)).map(([gl, item]) => [glText(gl) || "Hesapsız", cents(item.totalMinor)]),
            ...Object.entries(report.totals.byAccount).map(([id, item]) => [bankRows().find(row => row.id === id) ? bankLabel(bankRows().find(row => row.id === id)) : id, cents(item.totalMinor)]),
          ],
        };
      },
    },
    {
      id: "alt-hesap-mizani",
      group: "Banka",
      title: "Alt Hesap Mizanı",
      description: "Banka hesaplarının Tekdüzen alt hesapları (102.01, 102.02 …, POS 108, kredi kartı 309, kredi 300, Hesabı Atanmamış 102.00 / 108.00) ve alınan evrakın alt hesapları (101.01 Portföydeki Çekler, 101.02 Tahsile Verilen Çekler, 121.01 Portföydeki Senetler, 121.02 Tahsile Verilen Senetler): devir, dönem borç, dönem alacak ve bakiye; her ana hesap alt hesaplarının toplamına eşittir.",
      params: ["range"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const service = bankService();
        const data = service?.subTrialData ? service.subTrialData({ from: range.from, to: range.to }) : { rows: [], mains: [] };
        const yon = value => (value > 0.005 ? "Borç" : value < -0.005 ? "Alacak" : "");
        const allOk = data.mains.every(main => main.ok);
        return {
          subtitle: `${rangeText(range)} · Ana hesaplar alt hesaplarının toplamına ${allOk ? "eşit" : "EŞİT DEĞİL"}`,
          headers: ["Alt Hesap", "Hesap Adı", "Ana Hesap", "Devir", "Borç", "Alacak", "Bakiye", "Yön"],
          types: ["", "", "", "money", "money", "money", "money", ""],
          rows: data.rows.map(row => [row.sub, row.name || "", `${row.account} ${CHART[row.account] || ""}`.trim(), money(row.opening), money(row.debit), money(row.credit), money(Math.abs(row.balance)), yon(row.balance)]),
          summary: [...data.mains.map(main => [`${main.account} ${main.name}`, `${money(Math.abs(main.balance))}${main.balance < -0.005 ? " (Alacak)" : ""}`]), ["Alt Hesap Mutabakatı", allOk ? "Tutarlı" : "Fark Var"]],
        };
      },
    },
    {
      // Plan §8.10 "Ek: … Tahsildeki Çekler" (doğrulama T9): bankaya tahsile verilmiş, sonucu bekleyen alınan çek ve senetler (101.02); beklenen gün
      // vade + iş günü takvimi (Nakit Akış ve Vade Takip ile aynı kural, routes/cheques.mjs flows). TOPLAM = Alt Hesap Mizanı'ndaki 101.02 (çek) +
      // 121.02 (senet; 2.2.0 İz 4.2, plan §3.11a) bakiyeleri; özet ikisini ayrı da verir.
      id: "tahsildeki-cekler",
      group: "Banka",
      title: "Tahsildeki Çek ve Senetler",
      description: "Bankaya tahsile verilmiş, tahsil edilmeyi bekleyen alınan çek ve senetler: veriliş tarihi, banka hesabı, vade ve bankadan beklenen gün (vade hafta sonu ya da tatile düşerse sonraki iş günü). Çeklerin toplamı Alt Hesap Mizanı'ndaki 101.02, senetlerinki 121.02 bakiyesine eşittir.",
      params: [],
      permission: "bank.reports",
      standalone: true,
      build() {
        const has = Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'"));
        const list = has
          ? store.all(
            `SELECT k.given_date AS givenDate, COALESCE(b.bank_name || ' · ' || b.name, '') AS bankLabel, COALESCE(b.code, '') AS bankCode, c.id, c.instrument, c.serial_no AS serialNo,
                    c.due_date AS dueDate, c.amount, COALESCE(a.name, c.drawer, '') AS party
             FROM cheque_collections k JOIN cheques c ON c.id = k.cheque_id AND c.deleted_at IS NULL AND c.direction = 'in' AND c.status = 'portfolio'
               LEFT JOIN bank_accounts b ON b.id = k.bank_account_id LEFT JOIN accounts a ON a.id = c.account_id
             WHERE k.status = 'pending' ORDER BY k.given_date, c.due_date, k.rowid`,
          )
          : [];
        const expected = new Map((cheques()?.flows ? cheques().flows({ expected: true }) : []).filter(flow => flow.flow === "deposit").map(flow => [flow.ref.id, flow.date]));
        const byBank = new Map();
        let total = 0;
        const byKind = { cheque: 0, note: 0 };
        for (const row of list) {
          total = roundMoney(total + row.amount);
          const kind = row.instrument === "note" ? "note" : "cheque";
          byKind[kind] = roundMoney(byKind[kind] + row.amount);
          byBank.set(row.bankLabel, roundMoney((byBank.get(row.bankLabel) || 0) + row.amount));
        }
        return {
          subtitle: `${dayText(today())} itibarıyla · ${list.length} evrak`,
          headers: ["Veriliş Tarihi", "Banka Hesabı", "Evrak", "No", "Kimden", "Vade", "Beklenen Gün", "Tutar"],
          types: ["", "", "", "", "", "", "", "money"],
          rows: list.map(row => [dayText(row.givenDate), row.bankLabel, INSTRUMENTS[row.instrument] || "Çek", row.serialNo, row.party, dayText(row.dueDate), dayText(expected.get(row.id) || row.dueDate), money(row.amount)]),
          summary: [["Evrak Sayısı", String(list.length)], ["Toplam (101.02 + 121.02)", tl(total)], ["Çekler (101.02)", tl(byKind.cheque)], ["Senetler (121.02)", tl(byKind.note)], ...[...byBank].map(([label, amount]) => [label || "Banka Hesabı", tl(amount)])],
        };
      },
    },
    // 2.2.0 (İz 3.5; plan §4.7, §8.10): POS raporları — POS Ödeme Takvimi (bekleyen valör kalemleri) ve Faturası Beklenen Komisyonlar (KDV'li kip).
    {
      id: "pos-odeme-takvimi",
      group: "Banka",
      title: "POS Ödeme Takvimi",
      description: "Bankaya geçmemiş POS tahsilatları valör gününe göre: bankaya geçecek net tutar ve brüt. Blokeli POS ve Komisyon Tahsili (iade sonrası bankadan çekilecek komisyon) ayrı satırdır. Aralık valör gününe göredir; Tüm Zamanlar bütün bekleyenleri gösterir.",
      params: ["range", "posTerminal", "posKind"],
      permission: "bank.reports",
      standalone: true,
      emptyHint: { text: "Bekleyen POS kalemi yok; bankaya geçenler Banka → Hareketler'de.", bankTab: "movements", label: "Banka → Hareketler" },
      build(query) {
        const range = dueRangeOf(query, "");
        const pos = bankService()?.pos;
        const posId = query.posTerminal || "";
        const kind = POS_KINDS[query.posKind] ? query.posKind : "";
        const data = pos?.calendarView ? pos.calendarView({ from: range.from, to: range.to, posId }) : { rows: [] };
        const rows = data.rows.filter(row => !kind || row.kind === kind);
        const state = row => (row.error ? "Aktarılamadı" : row.awaiting ? "Onay Bekliyor" : row.due ? "Valörü Geldi" : "Bekliyor");
        const sum = (list, key) => list.reduce((total, row) => total + (Number(row[key]) || 0), 0);
        const of = name => rows.filter(row => row.kind === name);
        const posName = posId ? pos?.list?.().find(item => item.id === posId)?.name || "" : "";
        return {
          subtitle: [posName || "Tüm POS'lar", POS_KINDS[kind] || "", range.from || range.to ? `valör ${rangeText(range)}` : "Bütün bekleyenler"].filter(Boolean).join(" · "),
          headers: ["Valör Günü", "POS", "Tür", "Kalem", "Brüt", "Net (Bankaya Geçecek)", "Durum"],
          types: ["", "", "", "", "money", "money", ""],
          rows: rows.map(row => [dayText(row.valueDate), row.posName, row.kindLabel, String(row.count), cents(row.grossMinor), cents(row.netMinor), state(row)]),
          summary: [
            [K10_LABELS.posPending, cents(sum(of("pos"), "netMinor"))],
            [K10_LABELS.posBlocked, cents(sum(of("blocked"), "netMinor"))],
            ["Komisyon Tahsili", cents(-sum(of("fee"), "netMinor"))],
            ["Toplam (Net)", cents(sum(rows, "netMinor"))],
          ],
        };
      },
    },
    {
      id: "faturasi-beklenen-komisyonlar",
      group: "Banka",
      title: "Faturası Beklenen Komisyonlar",
      description: "Faturalı (KDV'li) POS komisyonu: ödeme kuruluşunun her ay kestiği komisyon, komisyon iadeleri ve net tutar; durum Faturası Beklenen, Taslak Hazır, İade Alacağı ya da Faturalandı. Kaydedilen komisyon faturasında Fark = fatura − bağlı kesinti.",
      params: ["range", "posTerminal"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const pos = bankService()?.pos;
        const posId = query.posTerminal || "";
        const data = pos?.commissionReport ? pos.commissionReport({ from: range.from, to: range.to, posId }) : { rows: [] };
        const monthText = month => (month ? `${month.slice(5, 7)}.${month.slice(0, 4)}` : "");
        const total = (key, filter = () => true) => data.rows.filter(filter).reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
        const posName = posId ? pos?.list?.().find(item => item.id === posId)?.name || "" : "";
        return {
          subtitle: `${posName || "Tüm POS'lar"} · ${rangeText(range)}`,
          headers: ["Ay", "POS", "Sağlayıcı", "Kesinti", "Komisyon İadesi", "Net", "Durum", "Fatura No", "Fatura Tutarı", "Fark"],
          types: ["", "", "", "money", "money", "money", "", "", "money", "money"],
          rows: data.rows.map(row => [monthText(row.month), row.posName, row.providerName, cents(row.outMinor), cents(row.inMinor), cents(row.netMinor), row.stateLabel, row.invoiceNo, row.invoiceNo ? cents(row.invoiceMinor) : "", row.invoiceNo ? cents(row.differenceMinor) : ""]),
          summary: [
            ["Faturası Beklenen", cents(total("netMinor", row => row.stateLabel === "Faturası Beklenen" || row.stateLabel === "Taslak Hazır"))],
            ["İade Alacağı", cents(-total("netMinor", row => row.stateLabel === "İade Alacağı"))],
            ["Faturalandı", cents(total("netMinor", row => /^Faturalandı/.test(row.stateLabel)))],
            ["Fark", cents(total("differenceMinor"))],
          ],
        };
      },
    },
    {
      // 2.3.0 İz 5.3 (plan §8.10 "POS Satış Raporu / POS Komisyon Raporu — kip ve vergi ayrımıyla; İptal İadeleri ayrı satır"; müşteri: "provizyon
      // kesintisi"): tek kaynak pos_sales (2.2.0; komisyon kalemleri satışla birlikte yazılır). Void edilen (hiç gerçekleşmemiş) satış girmez.
      id: "pos-satis",
      group: "Banka",
      title: "POS Satış Raporu",
      description: "Kartla yapılan tahsilatlar (satış faturası, cari, taksit, kayıt ve stok ekranlarından) işlem işlem: POS, taksit sayısı, komisyon kipi, brüt, komisyon, BSMV / KDV ve bankaya geçecek net. POS İadesi ve POS İptal İadesi ayrı satırdır (eksi); iadede bankanın geri verdiği komisyon eksi Komisyon'dur. İptal edilen (void) satış girmez.",
      params: ["range", "posTerminal", "posSale"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const posId = query.posTerminal || "";
        const kind = POS_SALE_KINDS[query.posSale] ? query.posSale : "";
        const list = posSalesRows(range, posId).filter(row => !kind || posSaleKind(row) === kind);
        const names = partyNames();
        const totals = { sale: 0, refund: 0, cancel: 0, gross: 0, commission: 0, bsmv: 0, vat: 0, net: 0, count: { sale: 0, refund: 0, cancel: 0 } };
        const rows = list.map(row => {
          const amounts = posSaleAmounts(row);
          const which = posSaleKind(row);
          totals[which] += amounts.gross;
          totals.count[which] += 1;
          for (const key of ["gross", "commission", "bsmv", "vat", "net"]) totals[key] += amounts[key];
          return [dayText(row.date), row.eventNo || "", row.posName || "", POS_SALE_KINDS[which], names.get(row.partyId) || "", installmentText(row.installments), TAX_LABELS[taxChoiceOf(row)] || "", cents(amounts.gross), cell(amounts.commission), cell(amounts.bsmv), cell(amounts.vat), cents(amounts.net), row.status === "cancelled" ? "İptal İadesi Yapıldı" : row.blocked ? "Blokeli" : "Etkin"];
        });
        return {
          subtitle: `${posTitle(posId)} · ${kind ? `${POS_SALE_KINDS[kind]} · ` : ""}${rangeText(range)}`,
          headers: ["Tarih", "İşlem No", "POS", "Tür", "Cari", "Taksit", "Kip", "Brüt", "Komisyon", "BSMV", "KDV", "Net", "Durum"],
          types: ["", "", "", "", "", "", "", "money", "money", "money", "money", "money", ""],
          rows,
          summary: [
            ["POS Satışı", `${totals.count.sale} · ${cents(totals.sale)}`],
            ["POS İadesi", `${totals.count.refund} · ${cents(totals.refund)}`],
            ["POS İptal İadesi", `${totals.count.cancel} · ${cents(totals.cancel)}`],
            ["Brüt (Net)", cents(totals.gross)],
            ["Komisyon (Net)", cents(totals.commission)],
            ["BSMV", cents(totals.bsmv)],
            ["KDV", cents(totals.vat)],
            ["Bankaya Geçecek (Net)", cents(totals.net)],
          ],
        };
      },
    },
    {
      id: "pos-komisyon",
      group: "Banka",
      title: "POS Komisyon Raporu",
      description: "POS başına ve döneme göre (aylık, yıllık ya da dönem toplamı) kesilen komisyon (provizyon kesintisi): brüt, komisyon, BSMV / KDV ve bankaya geçen net; komisyon kipi (BSMV Dahil / Hariç, KDV'li faturalı) ayrı satır. POS İadesi ve İptal İadesi ayrı satırdır: iadede geri alınan komisyon eksi yazılır. Oran, dönemin gerçekleşen komisyonunun brüte oranıdır.",
      params: ["range", "posTerminal", "posPeriod", "posSale"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const posId = query.posTerminal || "";
        const period = POS_PERIODS[query.posPeriod] ? query.posPeriod : "month";
        const kind = POS_SALE_KINDS[query.posSale] ? query.posSale : "";
        const list = posSalesRows(range, posId).filter(row => !kind || posSaleKind(row) === kind);
        const periodKey = date => (period === "month" ? date.slice(0, 7) : period === "year" ? date.slice(0, 4) : "");
        const periodText = key => (period === "month" ? monthLabel(key) : period === "year" ? key : rangeText(range));
        const groups = new Map();
        for (const row of list) {
          const which = posSaleKind(row);
          const tax = TAX_LABELS[taxChoiceOf(row)] || "";
          const key = [periodKey(row.date), row.posName || "", which, tax].join("\u0000");
          const group = groups.get(key) || { period: periodKey(row.date), pos: row.posName || "", which, tax, count: 0, gross: 0, commission: 0, bsmv: 0, vat: 0, net: 0 };
          const amounts = posSaleAmounts(row);
          group.count += 1;
          for (const name of ["gross", "commission", "bsmv", "vat", "net"]) group[name] += amounts[name];
          groups.set(key, group);
        }
        const order = { sale: 0, refund: 1, cancel: 2 };
        const sorted = [...groups.values()].sort((a, b) => collator.compare(a.period, b.period) || collator.compare(a.pos, b.pos) || order[a.which] - order[b.which] || collator.compare(a.tax, b.tax));
        const totals = { gross: 0, commission: 0, bsmv: 0, vat: 0, net: 0, refund: 0 };
        const rows = sorted.map(group => {
          for (const name of ["gross", "commission", "bsmv", "vat", "net"]) totals[name] += group[name];
          if (group.which !== "sale") totals.refund += group.commission;
          return [periodText(group.period), group.pos, POS_SALE_KINDS[group.which], group.tax, String(group.count), cents(group.gross), cell(group.commission), cell(group.bsmv), cell(group.vat), cents(group.net), group.gross ? rateText(Math.abs(group.commission + group.bsmv + group.vat), Math.abs(group.gross)) : ""];
        });
        return {
          subtitle: `${posTitle(posId)} · ${POS_PERIODS[period]} · ${kind ? `${POS_SALE_KINDS[kind]} · ` : ""}${rangeText(range)}`,
          headers: ["Dönem", "POS", "Tür", "Kip", "İşlem", "Brüt", "Komisyon", "BSMV", "KDV", "Net", "Kesinti %"],
          types: ["", "", "", "", "number", "money", "money", "money", "money", "money", ""],
          rows,
          summary: [["Brüt (Net)", cents(totals.gross)], ["Komisyon (Net)", cents(totals.commission)], ["İadede Geri Alınan Komisyon", cents(-totals.refund)], ["BSMV", cents(totals.bsmv)], ["KDV", cents(totals.vat)], ["Bankaya Geçen (Net)", cents(totals.net)], ["Satır", String(rows.length)]],
        };
      },
    },
    // ===== Banka — 2.3.0 İz 3.3: §8.10 kalan raporlar =====
    {
      id: "banka-gunluk",
      group: "Banka",
      title: "Günlük Banka Raporu",
      description: "Seçilen banka hesabının (ya da bütün Gerçek Banka hesaplarının) gün gün toplamları: dış giriş ve çıkış ayrı; iç hareketler (Kasa ile Banka arası, bankalar arası transfer, kredi, kart borcu) Transfer kolonlarında; transfer ücreti ve kredi faizi dış çıkıştır. Net günün bakiye değişimi, Gün Sonu Bakiye o günün sonundaki bakiyedir.",
      params: ["range", "bankAccount"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const choice = bankChoice(query.bankAccount);
        const data = bankPeriodTotals(choice, range, date => date);
        let balance = data.opening;
        const totals = { extIn: 0, extOut: 0, trIn: 0, trOut: 0, adjust: 0 };
        const rows = [...data.buckets.entries()].map(([date, day]) => {
          const net = netOf(day);
          balance += net;
          for (const key of Object.keys(totals)) totals[key] += day[key];
          return [dayText(date), String(day.count), cell(day.extIn), cell(day.extOut), cell(day.trIn), cell(day.trOut), cell(day.adjust), cents(net), cents(balance)];
        });
        return {
          subtitle: `${choice.title} · ${rangeText(range)}`,
          headers: ["Tarih", "Hareket", "Giriş", "Çıkış", "Transfer Giriş", "Transfer Çıkış", "Açılış ve Devir Düzeltmesi", "Net", "Gün Sonu Bakiye"],
          types: ["", "number", "money", "money", "money", "money", "money", "money", "money"],
          rows,
          summary: periodSummary(choice, data.opening, totals, balance, "Gün Sayısı", rows.length),
        };
      },
    },
    {
      id: "banka-aylik",
      group: "Banka",
      title: "Aylık Banka Raporu",
      description: "Seçilen banka hesabının (ya da bütün Gerçek Banka hesaplarının) ay ay toplamları: dış giriş ve çıkış ayrı, iç hareketler Transfer kolonlarında, açılış ve devir düzeltmeleri ayrı; Ay Başı ve Ay Sonu Bakiye ile hesabın yıl içindeki seyri (hareketsiz ay da yazılır).",
      params: ["range", "bankAccount"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const choice = bankChoice(query.bankAccount);
        const data = bankPeriodTotals(choice, range, date => date.slice(0, 7));
        // Aylar: aralığın başından bugünkü aya (ya da son harekete) kadar; aralık sonunu geçmez. "Tüm Zamanlar" ilk hareketin ayından başlar.
        const first = range.from && !allTime(range.from) ? range.from.slice(0, 7) : data.first.slice(0, 7) || today().slice(0, 7);
        const lastMove = data.last.slice(0, 7);
        let last = today().slice(0, 7) > lastMove ? today().slice(0, 7) : lastMove;
        if (range.to && range.to.slice(0, 7) < last) last = range.to.slice(0, 7);
        let balance = data.opening;
        const totals = { extIn: 0, extOut: 0, trIn: 0, trOut: 0, adjust: 0 };
        const rows = [];
        // Boş dönem (hareket yok, devir de yok — ör. boş şirket, açılıştan önceki yıl): satır yok, ipucu. Devirli hareketsiz dönemde aylar devirle yazılır.
        for (const key of first <= last && (data.count || data.opening) ? monthsBetween(first, last) : []) {
          const month = data.buckets.get(key) || { count: 0, extIn: 0, extOut: 0, trIn: 0, trOut: 0, adjust: 0 };
          const opening = balance;
          const net = netOf(month);
          balance += net;
          for (const name of Object.keys(totals)) totals[name] += month[name];
          rows.push([monthLabel(key), String(month.count), cents(opening), cell(month.extIn), cell(month.extOut), cell(month.trIn), cell(month.trOut), cell(month.adjust), cents(net), cents(balance)]);
        }
        return {
          subtitle: `${choice.title} · ${rangeText(range)}`,
          headers: ["Ay", "Hareket", "Ay Başı Bakiye", "Giriş", "Çıkış", "Transfer Giriş", "Transfer Çıkış", "Açılış ve Devir Düzeltmesi", "Net", "Ay Sonu Bakiye"],
          types: ["", "number", "money", "money", "money", "money", "money", "money", "money", "money"],
          rows,
          summary: periodSummary(choice, data.opening, totals, balance, "Ay Sayısı", rows.length),
        };
      },
    },
    {
      id: "banka-bazinda-bakiye",
      group: "Banka",
      title: "Banka Bazında Bakiye",
      description: "Her bankanın (aynı bankadaki bütün hesaplar birlikte) dönem sonu bakiyesi: Gerçek Banka (102 hesapları) ile Kart ve Kredi Borcu (309 / 300) ayrı kolonda, Net ikisinin farkı. Hesabı Atanmamış Eski Hareketler bir bankaya ait değildir; özette ayrı yazılır, satırlara ve TOPLAM'a girmez.",
      params: ["range"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        return groupedBalances(rangeOf(query, "thisYear"), row => row.bankName, "Banka");
      },
    },
    {
      id: "para-birimi-bazinda-bakiye",
      group: "Banka",
      title: "Para Birimi Bazında Bakiye",
      description: "Banka hesaplarının para birimine göre dönem sonu bakiyeleri (TL karşılığı; Gerçek Banka ile Kart ve Kredi Borcu ayrı, Net farkı). TOPLAM satırı yalnız tek para birimi varken yazılır; döviz hesapları açıldığında her para biriminin kendi tutarı da eklenir.",
      params: ["range"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        return groupedBalances(rangeOf(query, "thisYear"), row => (row.currency === "TRY" ? "TL" : row.currency), "Para Birimi", { uniform: true });
      },
    },
    {
      id: "bankalar-arasi-transfer",
      group: "Banka",
      title: "Bankalar Arası Transfer Raporu",
      description: "Şirketin kendi banka hesapları arasındaki transferler (Banka → Transfer): gönderen ve alıcı hesap, tutar, ücret (BSMV dahil), gönderenden çıkan toplam, kanal, valör ve durum. Ters kaydedilen transfer iki satırdır: asıl kayıt (Ters Kaydedildi) ve eksi tutarlı Ters Kayıt; TOPLAM net tutardır. Hesap seçilince o hesabın gönderdiği ve aldığı transferler.",
      params: ["range", "bankAccount"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const choice = bankChoice(query.bankAccount);
        const label = id => {
          const row = choice.rows.find(item => item.id === id);
          return row ? bankLabel(row) : "—";
        };
        let list = [];
        try {
          list = store.all(
            `SELECT e.id, e.no, e.date, e.value_date AS valueDate, e.status, e.type, e.channel, e.description,
                    COALESCE(o.bank_ref, e.bank_ref) AS fromRef, COALESCE(o.counter_ref, e.counter_ref) AS toRef, COALESCE(o.no, '') AS originNo,
                    (SELECT COALESCE(SUM(CASE WHEN l.side = 'D' THEN l.try_minor ELSE -l.try_minor END), 0) FROM bank_lines l WHERE l.event_id = e.id AND l.role = 'bank' AND l.ref = COALESCE(o.counter_ref, e.counter_ref)) AS amountMinor,
                    (SELECT COALESCE(SUM(CASE WHEN l.side = 'D' THEN l.try_minor ELSE -l.try_minor END), 0) FROM bank_lines l WHERE l.event_id = e.id AND l.role IN ('expense', 'tax')) AS feeMinor
             FROM fin_events e LEFT JOIN fin_events o ON e.type = 'reversal' AND o.id = e.reversal_of
             WHERE (e.type = 'transfer' OR (e.type = 'reversal' AND o.type = 'transfer')) AND (:from = '' OR e.date >= :from) AND (:to = '' OR e.date <= :to)
             ORDER BY e.date, e.created_at, e.rowid`,
            { from: range.from, to: range.to },
          );
        } catch {
          list = []; // banka tabloları yoksa (göç öncesi veri) transfer yok
        }
        if (choice.unassigned) list = [];
        else if (choice.single) list = list.filter(row => row.fromRef === choice.single.id || row.toRef === choice.single.id);
        const stateOf = row => (row.type === "reversal" ? `Ters Kayıt · ${row.originNo}` : STATUS_LABELS[row.status] === "Etkin" ? "Gerçekleşti" : STATUS_LABELS[row.status] || row.status);
        const totals = { amount: 0, fee: 0, transfers: 0, reversals: 0 };
        const rows = list.map(row => {
          const amount = Number(row.amountMinor) || 0;
          const fee = Number(row.feeMinor) || 0;
          totals.amount += amount;
          totals.fee += fee;
          if (row.type === "reversal") totals.reversals += 1;
          else totals.transfers += 1;
          return [dayText(row.date), row.no, label(row.fromRef), label(row.toRef), cents(amount), cell(fee), cents(amount + fee), TRANSFER_CHANNELS[row.channel] || row.channel || "", row.valueDate ? dayText(row.valueDate) : "", stateOf(row), row.description || ""];
        });
        return {
          subtitle: `${choice.title} · ${rangeText(range)}`,
          headers: ["Tarih", "İşlem No", "Gönderen Hesap", "Alıcı Hesap", "Tutar", "Ücret", "Gönderenden Çıkan", "Kanal", "Valör", "Durum", "Açıklama"],
          types: ["", "", "", "", "money", "money", "money", "", "", "", ""],
          rows,
          summary: [["Transfer", String(totals.transfers)], ...(totals.reversals ? [["Ters Kayıt", String(totals.reversals)]] : []), ["Tutar (Net)", cents(totals.amount)], ["Ücret (Net)", cents(totals.fee)], ["Gönderenden Çıkan (Net)", cents(totals.amount + totals.fee)]],
        };
      },
    },
    {
      id: "kasa-banka-transfer",
      group: "Banka",
      title: "Kasa ve Banka Transfer Raporu",
      description: "Kasa ile banka arasındaki para geçişleri (Kasa → Kasadan Bankaya Yatır / Bankadan Kasaya Aktar): her transfer tek satır, yönü, banka hesabı, tutarı ve kim girdiği. Eski sürümde hesap seçilmeden yapılan transferler Hesabı Atanmamış Eski Hareketler satırıdır.",
      params: ["range", "bankAccount"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const choice = bankChoice(query.bankAccount);
        let list = [];
        try {
          list = store.all(
            `SELECT c.id, c.transfer_id AS transferId, c.kind, c.amount, c.date, c.description, c.method, COALESCE(c.fin_ref, '') AS finRef, COALESCE(c.created_by, '') AS createdBy, c.created_at AS createdAt,
                    (SELECT f.no FROM fin_events f WHERE f.id = c.event_id) AS eventNo
             FROM cash_entries c WHERE COALESCE(c.transfer_id, '') <> '' AND (:from = '' OR c.date >= :from) AND (:to = '' OR c.date <= :to) ORDER BY c.date, c.created_at, c.rowid`,
            { from: range.from, to: range.to },
          );
        } catch {
          list = []; // banka kolonları yoksa (göç öncesi veri)
        }
        const users = userNames();
        const transfers = new Map();
        for (const leg of list) {
          const item = transfers.get(leg.transferId) || { date: leg.date, legs: [] };
          item.legs.push(leg);
          transfers.set(leg.transferId, item);
        }
        const totals = { toBank: 0, toCash: 0 };
        const rows = [];
        for (const item of transfers.values()) {
          const bankLeg = item.legs.find(leg => leg.method !== "cash") || item.legs[0];
          const finRef = bankLeg.finRef || "";
          if (choice.single ? finRef !== choice.single.id : choice.unassigned ? finRef !== "" : false) continue;
          const toBank = bankLeg.kind === "in";
          const amount = toCents(bankLeg.amount);
          totals[toBank ? "toBank" : "toCash"] += amount;
          const account = finRef ? choice.rows.find(row => row.id === finRef) : null;
          rows.push([dayText(item.date), bankLeg.eventNo || "", toBank ? "Kasadan Bankaya Yatır" : "Bankadan Kasaya Aktar", account ? `${bankLabel(account)} (${account.glSub})` : finRef ? finRef : keyLabel({ unassigned: true, rows: choice.rows }, "u:bank"), toBank ? cents(amount) : "", toBank ? "" : cents(amount), bankLeg.description || item.legs.find(leg => leg.description)?.description || "", users.get(bankLeg.createdBy) || ""]);
        }
        return {
          subtitle: `${choice.title} · ${rangeText(range)}`,
          headers: ["Tarih", "İşlem No", "Yön", "Banka Hesabı", "Kasadan Bankaya", "Bankadan Kasaya", "Açıklama", "Giren"],
          types: ["", "", "", "", "money", "money", "", ""],
          rows,
          summary: [["Transfer", String(rows.length)], ["Kasadan Bankaya", cents(totals.toBank)], ["Bankadan Kasaya", cents(totals.toCash)], ["Net (Bankaya)", cents(totals.toBank - totals.toCash)]],
        };
      },
    },
    {
      id: "cari-banka-hareketleri",
      group: "Banka",
      title: "Cari ve Banka Hareketleri",
      description: "Carilerle banka üzerinden yapılan tahsilat ve ödemeler (havale / EFT, POS, kredi kartı): cari tahsilatı ve ödemesi, fatura peşini, taksit tahsilatı, stok peşini, çek / senet tahsili ve ödemesi, POS komisyonu. Cari ve hesap süzgeçleriyle; TOPLAM giriş ve çıkış.",
      params: ["range", "anyAccount", "account"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const choice = anyAccountChoice(query.anyAccount);
        const accountId = limited(query.account || "", 120, "Cari");
        const names = partyNames();
        if (accountId && !names.has(accountId)) throw new HttpError(404, "Cari bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", { code: "account-missing" });
        const users = userNames();
        const poses = posRows();
        const lines = scopedLines(choice, range).filter(line => line.party_id && (!accountId || line.party_id === accountId));
        const totals = { in: 0, out: 0, parties: new Set() };
        const rows = lines.map(line => {
          const entry = moneyLines().shape(line);
          const amount = Number(line.cents) || 0;
          totals[line.kind === "in" ? "in" : "out"] += amount;
          totals.parties.add(line.party_id);
          return [dayText(line.date), line.event_no || "", names.get(line.party_id) || entry.accountName || "", lineAccountText(line, choice.rows, poses), wayText(line), LINE_SOURCE[entry.source] || entry.source, lineText(entry), line.kind === "in" ? cents(amount) : "", line.kind === "in" ? "" : cents(amount), users.get(line.actor_id) || ""];
        });
        return {
          subtitle: `${accountId ? names.get(accountId) : "Tüm Cariler"} · ${choice.title} · ${rangeText(range)}`,
          headers: ["Tarih", "İşlem No", "Cari", "Hesap", "Yol", "Kaynak", "Açıklama", "Giriş", "Çıkış", "Giren"],
          types: ["", "", "", "", "", "", "", "money", "money", ""],
          rows,
          summary: [["Hareket", String(rows.length)], ["Cari", String(totals.parties.size)], ["Giriş", cents(totals.in)], ["Çıkış", cents(totals.out)], ["Net", cents(totals.in - totals.out)]],
        };
      },
    },
    {
      id: "fatura-banka-hareketleri",
      group: "Banka",
      title: "Fatura ve Banka Hareketleri",
      description: "Faturayla ilişkili banka hareketleri ve bağ türü: Peşin (faturanın peşin satırı), Kapatılacak Fatura (cari kartında fatura seçilerek girilen tahsilat / ödeme), Otomatik (En Eski) (fatura seçilmeden girilen cari tahsilatı / ödemesi; fatura modülü en eski açık faturaya sayar, fatura numarası fatura kartında), Komisyon Kesintisi (Bağlı) (komisyon faturasına bağlanmış POS kesintisi ve iadesi).",
      params: ["range", "anyAccount"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const choice = anyAccountChoice(query.anyAccount);
        const LINK = Object.freeze({ cash: "Peşin", linked: "Kapatılacak Fatura", auto: "Otomatik (En Eski)", fee: "Komisyon Kesintisi (Bağlı)" });
        let links = new Map();
        let invoiced = new Set();
        let numbers = new Map();
        try {
          links = new Map(store.all("SELECT id, invoice_id AS invoiceId FROM account_entries WHERE COALESCE(invoice_id, '') <> ''").map(row => [row.id, row.invoiceId]));
          invoiced = new Set(store.all("SELECT DISTINCT account_id AS id FROM invoices WHERE status = 'issued'").map(row => row.id));
          numbers = new Map(store.all("SELECT id, number FROM invoices").map(row => [row.id, row.number]));
        } catch {
          // fatura tabloları yoksa yalnız peşin satırları (shape'teki fatura numarasıyla)
        }
        const names = partyNames();
        const users = userNames();
        const poses = posRows();
        const totals = { in: 0, out: 0, byLink: Object.fromEntries(Object.values(LINK).map(name => [name, 0])) };
        const rows = [];
        for (const line of scopedLines(choice, range)) {
          const src = Number(line.src);
          const entry = moneyLines().shape(line);
          let link = "";
          let invoiceId = "";
          if (src === 4) {
            link = "cash";
            invoiceId = entry.invoiceId || "";
          } else if (src === 3) {
            invoiceId = links.get(line.id) || "";
            link = invoiceId ? "linked" : invoiced.has(line.party_id) ? "auto" : "";
          } else if (src === 5) {
            invoiceId = links.get(line.id) || "";
            link = invoiceId ? "fee" : "";
          }
          if (!link) continue;
          const amount = Number(line.cents) || 0;
          const signed = line.kind === "in" ? amount : -amount;
          totals[line.kind === "in" ? "in" : "out"] += amount;
          totals.byLink[LINK[link]] += signed;
          rows.push([dayText(line.date), line.event_no || "", numbers.get(invoiceId) || "", LINK[link], names.get(line.party_id) || entry.accountName || "", lineAccountText(line, choice.rows, poses), wayText(line), lineText(entry), line.kind === "in" ? cents(amount) : "", line.kind === "in" ? "" : cents(amount), users.get(line.actor_id) || ""]);
        }
        return {
          subtitle: `${choice.title} · ${rangeText(range)}`,
          headers: ["Tarih", "İşlem No", "Fatura No", "Bağ Türü", "Cari", "Hesap", "Yol", "Açıklama", "Giriş", "Çıkış", "Giren"],
          types: ["", "", "", "", "", "", "", "", "money", "money", ""],
          rows,
          summary: [["Hareket", String(rows.length)], ...Object.values(LINK).map(name => [name, cents(totals.byLink[name])]), ["Giriş", cents(totals.in)], ["Çıkış", cents(totals.out)]],
        };
      },
    },
    {
      id: "taksit-banka-hareketleri",
      group: "Banka",
      title: "Taksit ve Banka Hareketleri",
      description: "Taksit kartlarına banka üzerinden (havale / EFT, POS) girilen tahsilatlar ve iadeler: kart, cari, banka hesabı, yol; TOPLAM giriş ve çıkış.",
      params: ["range", "anyAccount"],
      preset: "thisYear",
      permission: "bank.reports",
      standalone: true,
      worker: true,
      build(query) {
        const range = rangeOf(query, "thisYear");
        const choice = anyAccountChoice(query.anyAccount);
        const names = partyNames();
        const users = userNames();
        const poses = posRows();
        const totals = { in: 0, out: 0, plans: new Set() };
        const rows = scopedLines(choice, range).filter(line => Number(line.src) === 6).map(line => {
          const entry = moneyLines().shape(line);
          const amount = Number(line.cents) || 0;
          totals[line.kind === "in" ? "in" : "out"] += amount;
          totals.plans.add(entry.planId);
          return [dayText(line.date), line.event_no || "", entry.planName || "", names.get(line.party_id) || "", lineAccountText(line, choice.rows, poses), wayText(line), lineText(entry), line.kind === "in" ? cents(amount) : "", line.kind === "in" ? "" : cents(amount), users.get(line.actor_id) || ""];
        });
        return {
          subtitle: `${choice.title} · ${rangeText(range)}`,
          headers: ["Tarih", "İşlem No", "Taksit Kartı", "Cari", "Hesap", "Yol", "Açıklama", "Giriş", "Çıkış", "Giren"],
          types: ["", "", "", "", "", "", "", "money", "money", ""],
          rows,
          summary: [["Hareket", String(rows.length)], ["Taksit Kartı", String(totals.plans.size)], ["Giriş", cents(totals.in)], ["Çıkış", cents(totals.out)], ["Net", cents(totals.in - totals.out)]],
        };
      },
    },
    // v2.0.17 (müşteri): Kasa yalnız nakit; havale/EFT, POS ve kredi kartı hareketleri burada. 2.4.3 (C14): Banka grubunda, öbür "… ve Banka
    // Hareketleri" raporlarının yanında (tanım sırası = grup içi sıra).
    {
      id: "banka-pos-hareketleri",
      // 2.4.3 (C14): banka tarafı raporu Banka grubunda (önceden Kasa'daydı; Banka raporlarını Banka grubunda arayan bulamıyordu). Yetkisi değişmez
      // (yalnız Finans Raporları; Banka Raporları istenmez).
      group: "Banka",
      title: "Banka ve POS Hareketleri",
      description: "Havale/EFT, POS ve kredi kartıyla yapılan tahsilat ve ödemeler (cari, fatura, taksit, stok, çek/senet ekranlarından girilenler ve Kasa ↔ Banka transferleri); devir, yürüyen bakiye, kaynağı. Şirketin kendi hesapları arasındaki para (Kasa ile Banka Arası, Bankalar Arası Transfer) giriş ve çıkışa sayılmaz, Transfer satırındadır.",
      params: ["range", "payMethod", "anyAccount"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        // 2.3.0 İz 3.3 (plan §8.10 kuralı, eşleme 299): Yol seçenekleri Kredi Kartı (309) ve Kredi (300) + Hesap süzgeci. Bu seçimlerde satırlar
        // doğrudan tek kaynaktan (moneyLines.classified, hesap kaynağa itilir; banka raporlarıyla aynı sınıflama); eski üç seçim ve "Tüm Hesaplar"
        // önceki yoldan (cash.report) — satırlar ve sayılar değişmez.
        const method = ["bank", "card", "ccard", "loan"].includes(query.payMethod) ? query.payMethod : "noncash";
        const choice = anyAccountChoice(query.anyAccount);
        const which = { bank: "Banka (Havale / EFT)", card: "POS / Kredi Kartı", ccard: "Kredi Kartı", loan: "Kredi" }[method] || "Banka ve POS";
        if (choice.scope.ref || choice.unassigned || method === "ccard" || method === "loan") {
          const lines = moneyLines();
          // Hesap seçiliyken yol seçilmemişse (Banka ve POS (Tümü)) hesabın bütün satırları (kart hesabında 309 kart yolu, kredi hesabında 300).
          const ways = method === "noncash" && choice.scope.ref ? [...NONCASH_WAYS] : waysFor(method) || ["bank", "card"];
          const before = range.from && lines?.keyTotals ? lines.keyTotals({ ways, ...choice.scope, before: range.from, until: range.to }) : [];
          const opening = before.filter(item => !choice.unassigned || item.key.startsWith("u:")).reduce((sum, item) => sum + item.cents, 0);
          const users = userNames();
          const rows = [[openingDay(range.from), "", "Devir", `Dönem başı ${which.toLocaleLowerCase("tr-TR")} · ${choice.title}`, "", "", cents(opening), ""]];
          const period = { in: 0, out: 0, trIn: 0, trOut: 0, adjust: 0, transfers: 0, adjusted: false };
          let balance = opening;
          for (const line of scopedLines(choice, range, ways)) {
            const entry = lines.shape(line);
            balance += line.kind === "in" ? Number(line.cents) : -Number(line.cents);
            let label = cashLabel(entry) || entry.description || "";
            if (line.adjust) {
              period.adjust += line.adjust;
              period.adjusted = true;
              label = `${label} (Açılış ve Devir Düzeltmesi: ${line.adjust > 0 ? "+" : "−"}${cents(Math.abs(line.adjust))})`;
            } else if (line.tr_in || line.tr_out) {
              period.transfers += 1;
              period.trIn += line.tr_in;
              period.trOut += line.tr_out;
              label = `${label} (Transfer ${line.tr_in ? "Giriş" : "Çıkış"}: ${cents(line.tr_in || line.tr_out)})`;
            }
            period.in += line.ext_in;
            period.out += line.ext_out;
            rows.push([dayText(line.date), wayText(line), entry.transferId ? "Kasa ↔ Banka" : CASH_SOURCE[entry.source] || entry.source, label, cell(line.ext_in), cell(line.ext_out), cents(balance), users.get(line.actor_id) || ""]);
          }
          return {
            subtitle: `${which} · ${choice.title} · ${rangeText(range)}`,
            headers: ["Tarih", "Yol", "Kaynak", "Açıklama", "Giriş", "Çıkış", "Bakiye", "Giren"],
            types: ["", "", "", "", "money", "money", "money", ""],
            rows,
            summary: [["Hesap", choice.title], ["Devir", cents(opening)], ["Dönem Giriş", cents(period.in)], ["Dönem Çıkış", cents(period.out)], ["Dönem Net", cents(period.in - period.out)], ...(period.transfers ? [["Transfer Giriş", cents(period.trIn)], ["Transfer Çıkış", cents(period.trOut)]] : []), ...(period.adjusted ? [["Açılış ve Devir Düzeltmeleri", cents(period.adjust)]] : []), ["Dönem Sonu", cents(balance)]],
          };
        }
        const data = cash().report(admin, range.from, range.to, method);
        // v2.1.0 Aşama 14 (§3.4, K10; Aşama 9 bilinen sınırı): iç hareket (Kasa ↔ Banka, bankalar arası transfer, kredi, kart borcu ve ters kayıtları)
        // Giriş / Çıkış kolonuna yazılmaz — tutarı açıklamada "(Transfer Giriş / Çıkış: …)", bakiyede; özetin "Transfer Giriş / Çıkış" satırlarında.
        // İç hareketin gider payı (transfer ücreti, kredi faizi) dış çıkıştır: o satırın Çıkış kolonunda. Payların kuralı Banka penceresinin
        // "Bugün ve Bu Ay"ı ile aynı (moneyLines.classified ↔ flows).
        const parts = new Map();
        // Paylar yalnız dönem satırları için okunur (raporun satırları dönem içinden; 11.10.2026 hız düzeltmesi).
        for (const line of moneyLines()?.classified ? moneyLines().classified({ ways: waysFor(method), since: range.from, until: range.to, light: true }) : []) parts.set(`${moneyLines().sourceName(line.src)}|${line.id}`, line);
        const rows = [[openingDay(range.from), "", "Devir", `Dönem başı ${which.toLocaleLowerCase("tr-TR")}`, "", "", money(data.opening), ""]];
        const period = { in: 0, out: 0, trIn: 0, trOut: 0, transfers: 0 };
        // GG2: açılış ve Devir Kapanışı satırları giriş/çıkış kolonuna yazılmaz (TOPLAM = dönem giriş/çıkış); tutarı açıklamada, bakiyede.
        for (const entry of data.entries) {
          const part = parts.get(`${entry.source}|${entry.id}`);
          let label = cashLabel(entry);
          let inCents = entry.kind === "in" ? Math.round(entry.amount * 100) : 0;
          let outCents = entry.kind === "out" ? Math.round(entry.amount * 100) : 0;
          if (entry.adjust) {
            label = `${label} (Açılış ve Devir Düzeltmesi: ${entry.kind === "in" ? "+" : "−"}${money(entry.amount)})`;
            inCents = 0;
            outCents = 0;
          } else if (part && (part.tr_in || part.tr_out)) {
            period.transfers += 1;
            period.trIn += part.tr_in;
            period.trOut += part.tr_out;
            label = `${label} (Transfer ${part.tr_in ? "Giriş" : "Çıkış"}: ${cents(part.tr_in || part.tr_out)})`;
            inCents = part.ext_in;
            outCents = part.ext_out;
          }
          period.in += inCents;
          period.out += outCents;
          rows.push([dayText(entry.date), methodLabel(entry.method, entry.kind), entry.transferId ? "Kasa ↔ Banka" : CASH_SOURCE[entry.source] || entry.source, label, inCents ? cents(inCents) : "", outCents ? cents(outCents) : "", money(entry.balance), entry.actorName || ""]);
        }
        const adjust = data.period.adjust || 0;
        const closing = roundMoney(data.opening + data.period.in - data.period.out + adjust);
        const transferLines = period.transfers ? [["Transfer Giriş", cents(period.trIn)], ["Transfer Çıkış", cents(period.trOut)]] : [];
        return {
          subtitle: `${which} · ${rangeText(range)}`,
          headers: ["Tarih", "Yol", "Kaynak", "Açıklama", "Giriş", "Çıkış", "Bakiye", "Giren"],
          types: ["", "", "", "", "money", "money", "money", ""],
          rows,
          summary: [["Devir", money(data.opening)], ["Dönem Giriş", cents(period.in)], ["Dönem Çıkış", cents(period.out)], ["Dönem Net", cents(period.in - period.out)], ...transferLines, ...(adjust || data.entries.some(entry => entry.adjust) ? [["Açılış ve Devir Düzeltmeleri", money(adjust)]] : []), ["Dönem Sonu", money(closing)], ["Banka (tüm hareketler)", money(data.byMethod.bank)], ["POS / Kredi Kartı (tüm hareketler)", money(data.byMethod.card)]],
        };
      },
    },
    {
      // Plan §8.10 "Banka Nakit Akış Raporu — Planlanan Transferler ayrı satır" ve §8.9 akış kaynakları; başlangıç K10 (Gerçek Banka). Nakit Akış
      // projeksiyonuyla (routes/overview.mjs) aynı kaynaklardan okur, yalnız banka tarafı: nakit, taksit, fatura ve tablo kalemleri girmez.
      id: "banka-nakit-akis",
      group: "Banka",
      title: "Banka Nakit Akış Raporu",
      // 2.4.3 (C15): ileriye dönük rapor — ekranda geçmiş dönem düğmeleri (Geçen Ay, Son 30 Gün) yerine ileriye dönük dönemler.
      presets: "future",
      description: "Gerçek Banka'nın (hesaba atanmış 102) önümüzdeki günlerdeki beklenen seyri: bugünkü Gerçek Banka ile başlar; bankaya geçecek POS tutarları valör gününde (Blokeli POS ve Komisyon Tahsili ayrı), tahsildeki çek ve senetler beklenen gün, Çek Hesabı seçili verilen çek ve senetler vadesinde çıkış, planlı banka işlemleri (masraf, faiz, diğer, kart borcu, kredi) planlı tarihinde, kart borcu son ödeme gününde. Planlanan bankalar arası transferler ayrı kolondur: iki hesap arasında yer değiştirir, toplamı değiştirmez. Hesabı Atanmamış Eski Hareketler ve bekleyen POS başlangıca girmez; tarihi geçmiş bekleyen kalemler projeksiyona girmez, özette sayılır.",
      params: ["range"],
      permission: "bank.reports",
      standalone: true,
      build(query) {
        const range = dueRangeOf(query, "");
        const day = today();
        const service = bankService();
        const summary = service?.summary ? service.summary() : null;
        const rows = bankRows();
        const label = id => {
          const row = rows.find(item => item.id === id);
          return row ? bankLabel(row) : "";
        };
        const flows = [];
        const push = (kind, flow) => flows.push({ kind, source: BANK_FLOW_SOURCE[kind], in: 0, out: 0, transfer: 0, ...flow });
        const posBank = new Map((service?.pos?.list?.() || []).map(item => [item.id, item.bankAccountId]));
        for (const flow of service?.pos?.flows?.() || []) push(flow.source, { date: flow.date, label: flow.label, account: label(posBank.get(flow.ref?.id)), [flow.direction === "out" ? "out" : "in"]: toCents(flow.amount) });
        // MM6 (2.4.3, uzman mali müşavir): Çek Hesabı (verilen senette ödeme hesabı) bağlı verilen evrak vadesinde o hesaptan çıkıştır — Genel Nakit Akışı
        // aynı evrakı zaten çıkış sayıyordu; bu rapor saymıyordu (bankadaki karşılık riski 2.000 fazla görünüyordu). Yalnız Gerçek Banka'ya giren (102,
        // silinmemiş) hesap; hesabı seçilmemiş verilen evrak bankaya bağlanmaz (Genel Nakit Akışı'nda kalır).
        const realBank = new Set(rows.filter(row => String(row.gl) === "102" && !["card", "loan"].includes(row.kind)).map(row => row.id));
        for (const flow of cheques()?.flows ? cheques().flows({ expected: true }) : []) {
          if (flow.flow === "deposit") push("deposit", { date: flow.date, label: flow.label, account: label(flow.bankAccountId), in: toCents(flow.amount) });
          else if (flow.direction === "out" && flow.bankAccountId && realBank.has(flow.bankAccountId)) push("givenCheque", { date: flow.date, label: flow.label, account: label(flow.bankAccountId), out: toCents(flow.amount) });
        }
        for (const plan of service?.plans?.flows?.() || []) {
          if (plan.internal) push("transfer", { date: plan.date, label: plan.label, account: `${plan.accountLabel} → ${plan.toAccountLabel}`, transfer: toCents(plan.amount) });
          else push("plan", { date: plan.date, label: plan.label, account: plan.accountLabel, [plan.direction === "out" ? "out" : "in"]: toCents(plan.amount) });
        }
        // Kart borcu son ödeme günü (plan §8.9; lib/bank/vouchers.mjs cardDueFlows — Nakit Akış'la aynı kalem): planlı Kart Borcu Ödemesi olan kart atlanır.
        for (const flow of service?.plans?.cardDues?.(day) || []) push("cardDue", { date: flow.date, label: flow.label, account: flow.accountLabel, out: toCents(flow.amount) });
        const start = summary ? Number(summary.realBank.minor) || 0 : 0;
        const startDay = range.from && range.from > day ? range.from : day;
        const overdue = flows.filter(flow => flow.date < day);
        const carried = { in: 0, out: 0 };
        for (const flow of flows) {
          if (flow.date < day || flow.date >= startDay) continue;
          carried.in += flow.in;
          carried.out += flow.out;
        }
        const opening = start + carried.in - carried.out;
        const rank = flow => (flow.out ? 0 : flow.transfer ? 1 : 2);
        const list = flows.filter(flow => flow.date >= startDay && (!range.to || flow.date <= range.to)).sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : rank(a) - rank(b) || collator.compare(a.label, b.label)));
        let balance = opening;
        let lowest = { balance: opening, date: startDay };
        const totals = { in: 0, out: 0, transfer: 0 };
        const body = list.map(flow => {
          balance += flow.in - flow.out;
          totals.in += flow.in;
          totals.out += flow.out;
          totals.transfer += flow.transfer;
          if (balance < lowest.balance) lowest = { balance, date: flow.date };
          return [dayText(flow.date), flow.source, flow.label, flow.account, cell(flow.in), cell(flow.out), cell(flow.transfer), cents(balance)];
        });
        const overdueNet = overdue.reduce((sum, flow) => sum + flow.in - flow.out, 0);
        return {
          subtitle: `${dayText(day)} itibarıyla · ${range.from || range.to ? rangeText(range) : "Bütün beklenenler"} · Başlangıç: ${K10_LABELS.realBank} (hesabı atanmamış eski hareketler ve bekleyen POS girmez)`,
          headers: ["Tarih", "Kaynak", "Açıklama", "Hesap", "Giriş", "Çıkış", "Planlanan Transfer", "Beklenen Gerçek Banka"],
          types: ["", "", "", "", "money", "money", "money", "money"],
          rows: [[dayText(startDay), "Başlangıç", `Bugünkü ${K10_LABELS.realBank}${carried.in || carried.out ? " + başlangıca kadar beklenenler" : ""}`, "", "", "", "", cents(opening)], ...body],
          summary: [
            [`Bugünkü ${K10_LABELS.realBank}`, summary && !summary.realBank.defined ? "Banka Hesabı Tanımlanmadı" : cents(start)],
            ...(summary && summary.unassigned.totalMinor ? [[K10_LABELS.unassigned, cents(summary.unassigned.totalMinor)]] : []),
            ...(summary && summary.posPending?.netMinor ? [[K10_LABELS.posPending, cents(summary.posPending.netMinor)]] : []),
            ...(carried.in || carried.out ? [["Başlangıca Kadar Beklenen", `+${cents(carried.in)} / −${cents(carried.out)}`]] : []),
            ["Başlangıç", cents(opening)],
            ["Beklenen Giriş", cents(totals.in)],
            ["Beklenen Çıkış", cents(totals.out)],
            ["Planlanan Transferler", cents(totals.transfer)],
            [`Dönem Sonu Tahmini ${K10_LABELS.realBank}`, cents(balance)],
            [`En Düşük Tahmini ${K10_LABELS.realBank}`, `${cents(lowest.balance)} (${dayText(lowest.date)})`],
            ...(overdue.length ? [["Tarihi Geçmiş Bekleyen Kalem", `${overdue.length} · ${cents(overdueNet)}`]] : []),
          ],
        };
      },
    },
    // ===== Cari =====
    {
      id: "mizan",
      group: "Cari",
      title: "Cari Mizanı",
      description: "Her cari için devir, dönem borç, dönem alacak ve dönem sonu bakiye (Cari ekranıyla aynı defter).",
      params: ["range", "type", "side"],
      preset: "thisYear",
      build(query) {
        const params = new URLSearchParams({ ...query, preset: query.preset || "thisYear" });
        const data = overview().mizan(params);
        return {
          subtitle: [rangeText(data), data.type ? TYPE_TEXT[data.type] : "Tüm cariler", SIDE_FILTER[data.side] || ""].filter(Boolean).join(" · "),
          headers: ["Cari No", "Cari", "Tür", "Devir", "Borç", "Alacak", "Bakiye", "Durum"],
          types: ["", "", "", "money", "money", "money", "money", ""],
          rows: data.rows.map(row => [row.refNo, row.name, TYPE_TEXT[row.type] || "", money(row.opening), money(row.debit), money(row.credit), money(Math.abs(row.closing)), sideText(row.closing)]),
          summary: [["Cari Sayısı", String(data.totals.count)], ["Dönem Borç", money(data.totals.debit)], ["Dönem Alacak", money(data.totals.credit)], ["Borçlular Toplamı", money(data.totals.closingDebtor)], ["Alacaklılar Toplamı", money(data.totals.closingCreditor)]],
          footer: netFooter(data.rows.reduce((sum, row) => sum + (Number(row.closing) || 0), 0)),
        };
      },
    },
    {
      id: "cari-listesi",
      group: "Cari",
      title: "Cari Listesi ve Bakiyeler",
      description: "Tüm cariler (aktif ve pasif): iletişim, grup, borç, alacak, bakiye ve geciken taksit.",
      params: ["type", "side"],
      build(query) {
        const data = accounts().list(admin, { status: "all", type: TYPE_TEXT[query.type] ? query.type : "", balance: ["debtor", "creditor", "zero", "nonzero", "overdue"].includes(query.side) ? query.side : "all", sort: "no" });
        return {
          subtitle: [query.type && TYPE_TEXT[query.type] ? TYPE_TEXT[query.type] : "Tüm cariler", SIDE_FILTER[query.side] || "", `${data.totals.count} cari`].filter(Boolean).join(" · "),
          headers: ["Cari No", "Cari", "Tür", "Telefon", "Grup", "Borç", "Alacak", "Bakiye", "Durum", "Geciken"],
          types: ["", "", "", "", "", "money", "money", "money", "", "money"],
          rows: data.accounts.map(row => [row.refNo, row.name, TYPE_TEXT[row.type] || "", row.phone, [row.groupName, row.subgroupName].filter(Boolean).join(" › "), money(row.debit), money(row.credit), money(Math.abs(row.balance)), sideText(row.balance), row.overdue ? money(row.overdue) : ""]),
          // v2.0.20 (kullanıcı: "100 bin toplam, ödenen 10 bin, kalan 90 bin görmek istiyorum"): toplam borç, toplam alacak ve net yan yana.
          // MM9 (2.4.3, uzman mali müşavir; kullanıcı kararı 18.10.2026): ticari işletmeye uyan adlar — "Anlaşılan / Ödenen" kalktı (tedarikçi faturası
          // "ödenen" değildir); bakiyeler ayrı: Müşteri Alacakları (borçlu carilerin bakiyesi) ve Tedarikçi Borçları (alacaklı carilerin bakiyesi); net
          // ayrıca, ne olduğu adında yazılı (önceki "Kalan (Alacaklı)" müşteri ve tedarikçiyi adsız netliyordu).
          summary: (() => {
            const debit = roundMoney(data.accounts.reduce((sum, row) => sum + (Number(row.debit) || 0), 0));
            const credit = roundMoney(data.accounts.reduce((sum, row) => sum + (Number(row.credit) || 0), 0));
            const net = roundMoney(data.accounts.reduce((sum, row) => sum + (Number(row.balance) || 0), 0));
            return [["Cari", String(data.totals.count)], ["Toplam Borç", money(debit)], ["Toplam Alacak", money(credit)], ["Müşteri Alacakları (Borçlu Cariler)", money(data.totals.debtor)], ["Tedarikçi Borçları (Alacaklı Cariler)", money(data.totals.creditor)], ["Net Bakiye (Müşteri Alacakları − Tedarikçi Borçları)", money(net)], ["Geciken Taksit", money(data.totals.overdue)]];
          })(),
          footer: netFooter(data.accounts.reduce((sum, row) => sum + (Number(row.balance) || 0), 0)),
        };
      },
    },
    {
      id: "cari-ekstre",
      group: "Cari",
      title: "Cari Ekstre",
      description: "Seçilen carinin tarih aralıklı ekstresi: devir satırı, hareketler ve yürüyen bakiye. Fatura Kalemlerini Göster işaretlenince faturaların kalemleri, belge no ve ödeme yolu da yazar.",
      // 2.4.5 madde 6d (müşteri isteği M2): "items" = Fatura Kalemlerini Göster (Ayrıntılı Cari Ekstre). Seçenek kapalıyken ekstre değişmez.
      params: ["account", "range", "items"],
      // Ekstre tek bir carinin defteridir: cari seçilmeden çalışmaz. Öbür raporlarda cari isteğe bağlı süzgeçtir.
      accountRequired: true,
      preset: "thisYear",
      build(query, user) {
        const range = rangeOf(query, "thisYear");
        if (!query.account) throw new HttpError(400, "Ekstresi alınacak cariyi seçin.");
        const account = accounts().detail(query.account, user);
        const result = statement(account.ledger, range);
        const mark = value => `${tl(Math.abs(value))}${value > 0.005 ? " B" : value < -0.005 ? " A" : ""}`;
        if (query.items === "1") return detailedEkstre(account, range, result, mark);
        return {
          title: `Cari Ekstre · ${account.name}`,
          subtitle: [account.refNo ? `Cari No ${account.refNo}` : "", rangeText(range), "B: borçlu · A: alacaklı"].filter(Boolean).join(" · "),
          headers: ["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"],
          types: ["", "", "", "money", "money", "money"],
          rows: [[openingDay(range.from), "Devir", "Dönem başı bakiye", "", "", mark(result.opening)], ...result.lines.map(line => [dayText(line.date), line.label, [line.note, line.receiptNo ? `Makbuz ${line.receiptNo}` : ""].filter(Boolean).join(" · "), line.debit ? money(line.debit) : "", line.credit ? money(line.credit) : "", mark(line.balance)])],
          summary: [["Devir", money(result.opening)], ["Dönem Borç", money(result.debit)], ["Dönem Alacak", money(result.credit)], ["Dönem Sonu", `${tl(Math.abs(result.closing))} ${sideText(result.closing)}`]],
        };
      },
    },
    {
      id: "cari-hareketleri",
      group: "Cari",
      title: "Tüm Cari Hareketleri",
      description: "Aralıktaki bütün cari defter satırları: borç, alacak, tahsilat, ödeme, taksit, stok ve çek/senet kaynaklı.",
      params: ["range", "type"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const ledgers = accounts().allLedgers();
        const rows = [];
        let debit = 0;
        let credit = 0;
        for (const account of ledgers.accounts) {
          if (query.type && TYPE_TEXT[query.type] && account.type !== query.type) continue;
          for (const line of ledgers.lines.get(account.id) || []) {
            if (!inRange(line.date, range)) continue;
            debit += line.debit;
            credit += line.credit;
            rows.push({ date: line.date, at: line.at || "", cells: [dayText(line.date), account.name, line.label, [line.note, line.receiptNo ? `Makbuz ${line.receiptNo}` : ""].filter(Boolean).join(" · "), line.debit ? money(line.debit) : "", line.credit ? money(line.credit) : ""] });
          }
        }
        rows.sort((a, b) => (a.date === b.date ? (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) : a.date < b.date ? -1 : 1));
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Cari", "İşlem", "Açıklama", "Borç", "Alacak"],
          types: ["", "", "", "", "money", "money"],
          rows: rows.map(row => row.cells),
          summary: [["Satır", String(rows.length)], ["Toplam Borç", money(roundMoney(debit))], ["Toplam Alacak", money(roundMoney(credit))]],
        };
      },
    },
    {
      id: "cari-tahsilat",
      group: "Cari",
      title: "Cari Bazında Tahsilat",
      description: "Aralıkta her cariden alınan para: nakit / havale tahsilat, taksit tahsilatı, alınan çek / senet ve Excel'den yüklenen önceden ödenmiş tutar (açılış); toplam ve son tahsilat tarihi.",
      params: ["range", "type"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const ledgers = accounts().allLedgers();
        const list = [];
        const total = { cash: 0, plan: 0, cheque: 0, opening: 0, all: 0 };
        for (const account of ledgers.accounts) {
          if (query.type && TYPE_TEXT[query.type] && account.type !== query.type) continue;
          const row = { account, cash: 0, plan: 0, cheque: 0, opening: 0, count: 0, last: "" };
          for (const line of ledgers.lines.get(account.id) || []) {
            if (!inRange(line.date, range) || !(line.credit > 0)) continue;
            // Açılış (devir): Excel'den yüklenen taksit kartının "Ödenen" kısmı (programa girmeden önce alınmış, Kasa dışı).
            // v2.0.20 (kullanıcı: "hepsini toplasın"): kendi kolonunda görünür ve Toplam'a dahildir; tarihi yükleme günüdür.
            let key = "";
            if (line.kind === "in") key = "cash";
            else if (line.kind === "plan-in") key = line.opening ? "opening" : line.cheque ? "cheque" : "plan";
            else if (line.origin === "cheque" && line.kind === "credit") key = "cheque";
            if (!key) continue;
            row[key] = roundMoney(row[key] + line.credit);
            row.count += 1;
            if (line.date > row.last) row.last = line.date;
          }
          const sum = roundMoney(row.cash + row.plan + row.cheque + row.opening);
          if (!(sum > 0)) continue;
          list.push({ ...row, sum });
          for (const key of ["cash", "plan", "cheque", "opening"]) total[key] = roundMoney(total[key] + row[key]);
          total.all = roundMoney(total.all + sum);
        }
        list.sort((a, b) => b.sum - a.sum || collator.compare(a.account.name, b.account.name));
        return {
          subtitle: [rangeText(range), query.type && TYPE_TEXT[query.type] ? TYPE_TEXT[query.type] : "Tüm cariler"].join(" · "),
          headers: ["Cari No", "Cari", "Nakit / Havale", "Taksit Tahsilatı", "Çek / Senet (alınan)", "Önceden Ödenen (Açılış)", "Toplam", "İşlem", "Son Tahsilat"],
          types: ["", "", "money", "money", "money", "money", "money", "number", ""],
          rows: list.map(row => [row.account.refNo || "", row.account.name, row.cash ? money(row.cash) : "", row.plan ? money(row.plan) : "", row.cheque ? money(row.cheque) : "", row.opening ? money(row.opening) : "", money(row.sum), String(row.count), dayText(row.last)]),
          summary: [["Cari", String(list.length)], ["Nakit / Havale", money(total.cash)], ["Taksit Tahsilatı", money(total.plan)], ["Çek / Senet (alınan)", money(total.cheque)], ["Önceden Ödenen (Açılış)", money(total.opening)], ["Toplam", money(total.all)]],
        };
      },
    },
    {
      id: "alacak-yaslandirma",
      group: "Cari",
      title: "Alacak Yaşlandırma",
      description: "Borçlu carilerin bakiyesi ve portföydeki alınan çek/senetler gecikme süresine göre: taksit ve vadeli satış faturası vadesiyle, faturasız cari borcu (devir, Borç Yaz, karşılıksız çek, veresiye satış) hareket tarihiyle; 1–30, 31–60, 61–90, 90+ gün. Carinin dilimlerinin toplamı borç bakiyesidir.",
      params: [],
      build() {
        const day = today();
        const rows = new Map();
        const bucket = days => (days <= 0 ? "notDue" : days <= 30 ? "b30" : days <= 60 ? "b60" : days <= 90 ? "b90" : "b90p");
        const lateOf = date => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
        const blank = name => ({ name, gap: 0, notDue: 0, b30: 0, b60: 0, b90: 0, b90p: 0, unbilled: 0 });
        // Karar 15.10.2026: "Vade Gecikme (Gün)" = carinin en eski AÇIK kaleminin bugüne göre gecikmesi (gecikmiş kalem yoksa boş; TOPLAM'da
        // toplanmaz — NO_SUM).
        const add = (key, name, lateDays, amount) => {
          const row = rows.get(key) || blank(name);
          row[bucket(lateDays)] = roundMoney(row[bucket(lateDays)] + amount);
          if (lateDays > row.gap) row.gap = lateDays;
          rows.set(key, row);
        };
        const names = new Map(store.all("SELECT id, name FROM accounts").map(row => [row.id, row.name]));
        // MM5 (2.4.3, uzman mali müşavir; kullanıcı kararı 18.10.2026): carinin kalemleri (açık taksit, açık vadeli satış faturası) cari bakiyesiyle
        // uzlaştırılır (lib/receivable-aging.mjs): bakiyeden kalemler düşülünce kalan "Faturasız" kalem olarak hareket tarihiyle yaşlanır; kaleme
        // bağlanmamış tahsilat en eski kalemden düşer. Önceden faturasız borç (devir, karşılıksız çek…) hiçbir dilime girmiyordu.
        const items = [];
        for (const item of plans().openItems(day)) {
          const plan = store.get("SELECT account_id AS accountId FROM plans WHERE id = ?", item.ref.id);
          items.push({ accountId: plan?.accountId && names.has(plan.accountId) ? plan.accountId : "", key: plan?.accountId || `plan:${item.ref.id}`, name: names.get(plan?.accountId) || item.party, date: item.date, amount: item.amount });
        }
        // v2.0.15: vadeli (açık hesap) satış faturalarının ödenmemiş kısmı; taksitli fatura taksit kartından gelir.
        for (const item of invoices()?.openItems ? invoices().openItems(day, { net: true }) : []) {
          if (item.side !== "sale") continue;
          items.push({ accountId: item.accountId, key: item.accountId, name: names.get(item.accountId) || item.accountName, date: item.dueDate, amount: item.open });
        }
        const live = accounts()?.list ? accounts().list(admin, { status: "all" }).accounts : [];
        const settled = reconcileReceivables(store, { accounts: live.map(account => ({ id: account.id, name: account.name, balance: account.balance })), items, day });
        for (const item of settled.items) add(item.key, item.name, lateOf(item.date), item.amount);
        for (const item of settled.unbilled) {
          add(item.accountId, item.name, lateOf(item.date), item.amount);
          rows.get(item.accountId).unbilled = roundMoney(rows.get(item.accountId).unbilled + item.amount);
        }
        for (const flow of cheques().flows()) {
          if (flow.direction !== "in") continue;
          const cheque = store.get("SELECT account_id AS accountId FROM cheques WHERE id = ?", flow.ref.id);
          const key = cheque?.accountId || `party:${flow.party}`;
          add(key, names.get(cheque?.accountId) || flow.party, lateOf(flow.date), flow.amount);
        }
        // 2.3.0 İz 1.6 (plan §3.11b/5 "Alacak Yaşlandırma şüpheli tutarı ayrı gösterir"): carinin açık şüpheli alacağı (128) ayrı kolon. Şüpheli alacak
        // carinin bakiyesindedir (120 + 128 = kart): MM5'ten beri altındaki kalem (fatura, taksit ya da faturasız borç — ör. karşılıksız çek) dilimlerde
        // yaşlanır; Toplam'a ikinci kez GİRMEZ. Kolon Toplam Gecikmiş'ten önce: son kolon "Toplam" kalır.
        const doubtfulMap = doubtful()?.openByAccount ? doubtful().openByAccount().byAccount : new Map();
        for (const [accountId, item] of doubtfulMap) {
          if (!rows.has(accountId)) rows.set(accountId, blank(names.get(accountId) || ""));
          rows.get(accountId).doubtful = roundMoney(item.openMinor / 100);
        }
        const list = [...rows.values()].map(row => ({ ...row, doubtful: row.doubtful || 0, late: roundMoney(row.b30 + row.b60 + row.b90 + row.b90p) })).map(row => ({ ...row, total: roundMoney(row.late + row.notDue) })).sort((a, b) => b.late - a.late || collator.compare(a.name, b.name));
        const sum = key => roundMoney(list.reduce((total, row) => total + row[key], 0));
        return {
          subtitle: `${dayText(day)} itibarıyla · taksit, vadeli fatura, faturasız cari borcu (hareket tarihiyle) ve portföydeki alınan çek/senet · Vade Gecikme: en eski açık kalemin gecikmesi · Faturasız ve Şüpheli Alacak dilimlere dahildir, Toplam'a ikinci kez girmez`,
          headers: ["Cari / Kişi", "Vade Gecikme (Gün)", "Vadesi Gelmemiş", "1–30 Gün", "31–60 Gün", "61–90 Gün", "90+ Gün", "Faturasız Alacak (dilimlere dahil)", "Şüpheli Alacak (dilimlere dahil)", "Toplam Gecikmiş", "Toplam"],
          types: ["", "number", "money", "money", "money", "money", "money", "money", "money", "money", "money"],
          rows: list.map(row => [row.name, row.gap > 0 ? String(row.gap) : "", money(row.notDue), money(row.b30), money(row.b60), money(row.b90), money(row.b90p), row.unbilled ? money(row.unbilled) : "", row.doubtful ? money(row.doubtful) : "", money(row.late), money(row.total)]),
          summary: [["Vadesi Gelmemiş", money(sum("notDue"))], ["1–30 gün", money(sum("b30"))], ["31–60 gün", money(sum("b60"))], ["61–90 gün", money(sum("b90"))], ["90+ gün", money(sum("b90p"))], ["Toplam Gecikmiş", money(sum("late"))], ["Toplam", money(sum("total"))], ["Faturasız Alacak (dilimlere dahil)", money(sum("unbilled"))], ["Şüpheli Alacak (dilimlere dahil)", money(sum("doubtful"))]],
        };
      },
    },
    // 2.3.0 İz 1.7 (plan §3.11b/5): Şüpheli Alacaklar — kayıt tarihine göre dönem; Durum (Açık / Kapanan / Tümü) ve Neden süzgeçleri. Veri
    // lib/bank/doubtful.mjs report (cari kartı ve Mutabakat Testi ile aynı ayırma kuralı). Yetki: Şüpheli Alacak İşlemleri YA DA finans raporları.
    {
      id: "supheli-alacaklar",
      group: "Cari",
      title: "Şüpheli Alacaklar",
      description: "Şüpheli alacağa alınan kayıtlar (128): cari, neden, tarih, tutar, ayrılan karşılık (129), tahsil edilen, değersiz yazılan, kalan ve durum. Dönem kayıt tarihine göredir; Durum süzgeci Açık (kalanı olan), Kapanan (tahsil edildi, değersiz yazıldı ya da şüpheliden çıkarıldı) ya da Tümü.",
      params: ["range", "doubtfulStatus", "doubtfulReason"],
      preset: "thisYear",
      anyOf: ["accounts.doubtful", "overview.view"],
      build(query) {
        const range = rangeOf(query, "thisYear");
        const status = ["open", "closed", "all"].includes(query.doubtfulStatus) ? query.doubtfulStatus : "open";
        const reason = Object.hasOwn(DOUBTFUL_REASONS, query.doubtfulReason || "") ? query.doubtfulReason : "";
        if (query.doubtfulReason && !reason) throw new HttpError(400, "Neden süzgeci Karşılıksız Çek, Protestolu Senet, Dava, İcra ya da Diğer olmalı.", { code: "doubtful-filter", field: "doubtfulReason" });
        const data = doubtful()?.report ? doubtful().report({ from: range.from, to: range.to, status }) : { rows: [], totals: {} };
        const rows = data.rows.filter(row => !reason || row.reason === reason);
        const sum = key => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
        const STATUS_TEXT = { open: "Açık", closed: "Kapanan", all: "Tümü" };
        return {
          subtitle: [rangeText(range), `Durum: ${STATUS_TEXT[status]}`, reason ? `Neden: ${DOUBTFUL_REASONS[reason]}` : "Tüm nedenler"].join(" · "),
          headers: ["Cari No", "Cari", "Neden", "Tarih", "Tutar", "Karşılık", "Tahsil Edilen", "Değersiz", "Kalan", "Durum"],
          types: ["", "", "", "", "money", "money", "money", "money", "money", ""],
          rows: rows.map(row => [row.accountRefNo || "", row.accountName, row.reasonLabel + (row.chequeSerialNo ? ` · No ${row.chequeSerialNo}` : ""), dayText(row.date), cents(row.amountMinor), cents(row.provisionMinor), cents(row.collectedMinor), cents(row.writtenOffMinor), cents(row.remainingMinor), DOUBTFUL_STATUS_LABELS[row.stateKey] || row.statusLabel || ""]),
          summary: [["Kayıt", String(rows.length)], ["Tutar", cents(sum("amountMinor"))], ["Karşılık", cents(sum("provisionMinor"))], ["Tahsil Edilen", cents(sum("collectedMinor"))], ["Değersiz", cents(sum("writtenOffMinor"))], ["Şüpheliden Çıkarılan", cents(sum("releasedMinor"))], ["Kalan", cents(sum("remainingMinor"))]],
        };
      },
    },
    // ===== Fatura (v2.0.15) =====
    // Yalnız kesilmiş faturalar (taslak ve iptal hariç); tutarlar TL karşılığıdır (dövizli faturada kurla çevrilmiş).
    {
      id: "fatura-satis",
      group: "Fatura",
      title: "Satış Faturaları",
      description: "Aralıkta kesilen satış faturaları ve serbest meslek makbuzları: matrah, KDV, tevkifat, stopaj, ödenecek; ödenen ve kalan (kapama).",
      params: ["range", "account"],
      preset: "thisYear",
      build: query => invoiceListReport(query, ["sale", "smm"], "Satış"),
    },
    {
      id: "fatura-alis",
      group: "Fatura",
      title: "Alış Faturaları",
      description: "Aralıkta girilen alış faturaları (mal, hizmet ve gider): matrah, KDV, tevkifat, stopaj, ödenecek; ödenen ve kalan.",
      params: ["range", "account"],
      preset: "thisYear",
      build: query => invoiceListReport(query, ["purchase"], "Alış"),
    },
    {
      id: "fatura-iade",
      group: "Fatura",
      title: "İade Faturaları",
      description: "Satıştan ve alıştan iade faturaları; iade edilen faturanın numarası ve tutarlar.",
      params: ["range", "account"],
      preset: "thisYear",
      build: query => invoiceListReport(query, ["sale_return", "purchase_return"], "İade"),
    },
    {
      id: "kdv-ozeti",
      group: "Fatura",
      title: "KDV Özeti (Beyanname Hazırlığı)",
      description: "Aylara ve oranlara göre hesaplanan KDV (satış), indirilecek KDV (alış), iadeler ve tevkifat; ödenecek ya da devreden KDV. Ay sonu KDV Mahsup Fişi buradan oluşturulur.",
      params: ["range"],
      preset: "thisYear",
      // 2.4.3 MM3: ekranda rapor başlığının yanında "KDV Mahsup Fişi Oluştur" (Vergi Ödemesi ve KDV Mahsubu yetkisi; yönetici ve muhasebe).
      actions: [{ id: "vat-offset", label: "KDV Mahsup Fişi Oluştur", permission: "tax.manage" }],
      build(query) {
        const range = rangeOf(query, "thisYear");
        const list = store.all(
          `SELECT substr(i.issue_date, 1, 7) AS month, i.kind, l.vat_rate AS rate, SUM(l.net * i.rate) AS net, SUM(l.vat * i.rate) AS vat, SUM(l.withheld * i.rate) AS withheld, COUNT(DISTINCT i.id) AS count
           FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id AND i.status = 'issued'
           WHERE (? = '' OR i.issue_date >= ?) AND (? = '' OR i.issue_date <= ?) GROUP BY month, i.kind, l.vat_rate ORDER BY month, i.kind, l.vat_rate`,
          range.from, range.from, range.to, range.to,
        );
        const KIND = { sale: "Satış", smm: "Serbest Meslek Makbuzu", sale_return: "Satıştan İade", purchase: "Alış", purchase_return: "Alıştan İade" };
        // Hesaplanan (391) ve indirilecek (191) KDV — Ana Defter'deki tutarların aynısı (faturanın TL başlığından).
        const heads = store.get(
          `SELECT COALESCE(SUM(CASE WHEN kind IN ('sale', 'smm') THEN try_vat - try_withheld WHEN kind = 'sale_return' THEN -(try_vat - try_withheld) ELSE 0 END), 0) AS output,
                  COALESCE(SUM(CASE WHEN kind = 'purchase' THEN try_vat WHEN kind = 'purchase_return' THEN -try_vat ELSE 0 END), 0) AS input,
                  COALESCE(SUM(CASE WHEN kind = 'purchase' THEN try_withheld WHEN kind = 'purchase_return' THEN -try_withheld ELSE 0 END), 0) AS withheld2
           FROM invoices WHERE status = 'issued' AND (? = '' OR issue_date >= ?) AND (? = '' OR issue_date <= ?)`,
          range.from, range.from, range.to, range.to,
        );
        const result = roundMoney(heads.output - heads.input);
        return {
          subtitle: rangeText(range),
          headers: ["Ay", "Belge Türü", "KDV %", "Belge", "Matrah", "KDV", "Tevkifat"],
          types: ["", "", "number", "number", "money", "money", "money"],
          rows: list.map(row => [monthLabel(row.month), KIND[row.kind] || row.kind, `%${row.rate}`, String(row.count), money(roundMoney(row.net)), money(roundMoney(row.vat)), money(roundMoney(row.withheld))]),
          // 2.4.3 UX24: hesaplanan (satış) ve indirilecek (alış) KDV tek TOPLAM'da toplanmaz; her belge yönü kendi TOPLAM satırında, altta Net KDV
          // (satış KDV'si − alıcının kestiği tevkifat − satıştan iade; eksi alış KDV'si, artı alıştan iade) = özetteki Ödenecek / Devreden KDV.
          footerGroups: {
            column: "Belge Türü",
            groups: [
              { label: "TOPLAM Satış", values: [KIND.sale, KIND.smm] },
              { label: "TOPLAM Satıştan İade", values: [KIND.sale_return] },
              { label: "TOPLAM Alış", values: [KIND.purchase] },
              { label: "TOPLAM Alıştan İade", values: [KIND.purchase_return] },
            ],
            net: (() => {
              const net = roundMoney(list.reduce((sum, row) => {
                const vat = roundMoney(row.vat);
                const withheld = roundMoney(row.withheld);
                if (row.kind === "sale" || row.kind === "smm") return sum + vat - withheld;
                if (row.kind === "sale_return") return sum - (vat - withheld);
                if (row.kind === "purchase") return sum - vat;
                if (row.kind === "purchase_return") return sum + vat;
                return sum;
              }, 0));
              return { label: net >= 0 ? "Net KDV (Ödenecek)" : "Net KDV (Devreden)", cells: { KDV: money(Math.abs(net)) } };
            })(),
          },
          summary: [
            ["Hesaplanan KDV (391)", money(roundMoney(heads.output))],
            ["İndirilecek KDV (191)", money(roundMoney(heads.input))],
            ["Alıcı Olarak Kesilen Tevkifat (2 No.lu)", money(roundMoney(heads.withheld2))],
            [result >= 0 ? "Ödenecek KDV" : "Devreden KDV", money(Math.abs(result))],
            // 2.4.3 MM3: aralıktaki aylardan mahsup edilenler ve mahsuptan sonra KDV'li kaydı değişen aylar (geri alıp yeniden yapılır).
            ...(() => {
              const list = (tax()?.offsetList ? tax().offsetList() : []).filter(item => item.status === "active" && (!range.from || item.date >= range.from) && (!range.to || item.month <= range.to.slice(0, 7)));
              if (!list.length) return [];
              const stale = list.filter(item => item.stale);
              return [["KDV Mahsup Fişi", list.map(item => item.label).join(", ")], ...(stale.length ? [["Mahsuptan Sonra Değişen Ay", `${stale.map(item => item.label).join(", ")} (mahsubu geri alıp yeniden yapın)`]] : [])];
            })(),
          ],
        };
      },
    },
    {
      id: "ba-bs",
      group: "Fatura",
      title: "Ba-Bs Formu",
      description: "Aylık Form Ba (alışlar) ve Form Bs (satışlar): aynı kişiyle KDV hariç 5.000 TL ve üzeri belgeler; belge sayısı ve tutar.",
      params: ["range"],
      preset: "lastMonth",
      build(query) {
        const range = rangeOf(query, "lastMonth");
        const LIMIT = 5000;
        const list = store.all(
          `SELECT substr(i.issue_date, 1, 7) AS month, CASE WHEN i.kind IN ('sale', 'smm', 'purchase_return') THEN 'Bs' ELSE 'Ba' END AS form, i.account_id AS accountId,
                  MAX(json_extract(i.party_json, '$.name')) AS name, MAX(json_extract(i.party_json, '$.taxNo')) AS taxNo, COUNT(*) AS count, SUM(i.try_net) AS net
           FROM invoices i WHERE i.status = 'issued' AND (? = '' OR i.issue_date >= ?) AND (? = '' OR i.issue_date <= ?)
           GROUP BY month, form, i.account_id HAVING SUM(i.try_net) >= ? ORDER BY month, form, net DESC`,
          range.from, range.from, range.to, range.to, LIMIT,
        );
        return {
          subtitle: `${rangeText(range)} · sınır ${money(LIMIT)} (KDV hariç)`,
          headers: ["Ay", "Form", "Cari", "VKN / TCKN", "Belge Sayısı", "Tutar (KDV Hariç)"],
          types: ["", "", "", "", "number", "money"],
          rows: list.map(row => [monthLabel(row.month), row.form, row.name || "", row.taxNo || "", String(row.count), money(roundMoney(row.net))]),
          summary: [["Form Ba Satırı", String(list.filter(row => row.form === "Ba").length)], ["Form Bs Satırı", String(list.filter(row => row.form === "Bs").length)]],
          footerUniform: "Form",
        };
      },
    },
    {
      id: "urun-satis-karlilik",
      group: "Fatura",
      title: "Ürün Bazında Satış ve Kârlılık",
      description: "Faturalı satışlarda her ürün ve hizmet için net miktar, net satış (iadeler düşülmüş), satış anındaki maliyet, brüt kâr ve kâr oranı.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const list = store.all(
          `SELECT COALESCE(NULLIF(l.item_id, ''), 'ad:' || lower(l.name)) AS key, MAX(l.name) AS name, MAX(l.code) AS code, MAX(l.unit) AS unit, MAX(l.goods) AS goods,
                  SUM(CASE WHEN i.kind = 'sale_return' THEN -l.qty ELSE l.qty END) AS qty,
                  SUM(CASE WHEN i.kind = 'sale_return' THEN -l.net ELSE l.net END * i.rate) AS net,
                  SUM(CASE WHEN i.kind = 'sale_return' THEN -l.qty * COALESCE(o.unit_cost, 0) ELSE l.qty * l.unit_cost END) AS cost
           FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id AND i.status = 'issued' AND i.kind IN ('sale', 'smm', 'sale_return')
             LEFT JOIN invoice_lines o ON o.id = l.origin_line_id
           WHERE (? = '' OR i.issue_date >= ?) AND (? = '' OR i.issue_date <= ?) GROUP BY key ORDER BY net DESC`,
          range.from, range.from, range.to, range.to,
        );
        const total = list.reduce((acc, row) => ({ net: acc.net + row.net, cost: acc.cost + row.cost }), { net: 0, cost: 0 });
        return {
          subtitle: `${rangeText(range)} · maliyet: satış anında ürün kartındaki son alış fiyatı (hizmette maliyet yok)`,
          headers: ["Stok Kodu", "Ürün / Hizmet", "Net Miktar", "Birim", "Net Satış", "Maliyet", "Brüt Kâr", "Kâr %"],
          types: ["", "", "number", "", "money", "money", "money", ""],
          rows: list.map(row => [row.code || "", row.name, qty(row.qty), row.unit, money(roundMoney(row.net)), row.goods ? money(roundMoney(row.cost)) : "", row.goods ? money(roundMoney(row.net - row.cost)) : "", row.goods ? percent(row.net - row.cost, row.net) : ""]),
          // v2.0.24: özet de TOPLAM satırı gibi — Brüt Kâr yalnız maliyeti bilinen (stoklu) kalemlerden; hizmet satışı ayrı
          // satırda (maliyeti yok, kâr sayılmaz). Önceden özet hizmeti %100 kâr sayıyor, TOPLAM'la çelişiyordu.
          summary: (() => {
            const goods = list.filter(row => row.goods);
            const net = goods.reduce((sum, row) => sum + row.net, 0);
            const cost = goods.reduce((sum, row) => sum + row.cost, 0);
            const services = roundMoney(total.net - net);
            return [["Net Satış", money(roundMoney(total.net))], ...(services > 0.005 ? [["Hizmet Satışı (Maliyetsiz)", money(services)]] : []), ["Maliyet", money(roundMoney(cost))], ["Brüt Kâr (Stoklu Ürünler)", money(roundMoney(net - cost))]];
          })(),
          // Toplam kâr oranı: maliyeti bilinen (stoklu) kalemlerin brüt kârı / net satışı.
          footer: (() => {
            const goods = list.filter(row => row.goods);
            const net = goods.reduce((sum, row) => sum + row.net, 0);
            const cost = goods.reduce((sum, row) => sum + row.cost, 0);
            return { "Kâr %": percent(net - cost, net) };
          })(),
        };
      },
    },
    {
      id: "cari-satis-alis",
      group: "Fatura",
      title: "Cari Bazında Satış ve Alış",
      description: "Her cari için faturalı satış, satıştan iade, net satış; alış, alıştan iade, net alış (KDV hariç) ve KDV.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const list = store.all(
          `SELECT i.account_id AS accountId, MAX(COALESCE(a.name, json_extract(i.party_json, '$.name'))) AS name,
                  SUM(CASE WHEN i.kind IN ('sale', 'smm') THEN i.try_net ELSE 0 END) AS sale, SUM(CASE WHEN i.kind = 'sale_return' THEN i.try_net ELSE 0 END) AS saleReturn,
                  SUM(CASE WHEN i.kind = 'purchase' THEN i.try_net ELSE 0 END) AS purchase, SUM(CASE WHEN i.kind = 'purchase_return' THEN i.try_net ELSE 0 END) AS purchaseReturn,
                  SUM(CASE WHEN i.kind IN ('sale', 'smm', 'purchase_return') THEN i.try_vat ELSE -i.try_vat END) AS vat, COUNT(*) AS count
           FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id WHERE i.status = 'issued' AND (? = '' OR i.issue_date >= ?) AND (? = '' OR i.issue_date <= ?)
           GROUP BY i.account_id ORDER BY (sale - saleReturn) DESC, name`,
          range.from, range.from, range.to, range.to,
        );
        const sum = key => roundMoney(list.reduce((total, row) => total + (Number(row[key]) || 0), 0));
        return {
          subtitle: rangeText(range),
          headers: ["Cari", "Belge", "Satış", "Satıştan İade", "Net Satış", "Alış", "Alıştan İade", "Net Alış"],
          types: ["", "number", "money", "money", "money", "money", "money", "money"],
          rows: list.map(row => [row.name || "", String(row.count), money(roundMoney(row.sale)), money(roundMoney(row.saleReturn)), money(roundMoney(row.sale - row.saleReturn)), money(roundMoney(row.purchase)), money(roundMoney(row.purchaseReturn)), money(roundMoney(row.purchase - row.purchaseReturn))]),
          summary: [["Net Satış", money(roundMoney(sum("sale") - sum("saleReturn")))], ["Net Alış", money(roundMoney(sum("purchase") - sum("purchaseReturn")))]],
        };
      },
    },
    {
      id: "gider-raporu",
      group: "Fatura",
      title: "Gider Raporu (Türüne Göre)",
      description: "Hizmet ve gider alış faturalarının gider türüne (kira, elektrik, internet, danışmanlık, demirbaş…) ve aya göre KDV hariç toplamı.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const EXPENSE = { rent: "Kira", utilities: "Elektrik, Su ve Doğalgaz", telecom: "İnternet ve Telefon", office: "Kırtasiye ve Ofis Malzemesi", fuel: "Yakıt ve Ulaşım", repair: "Bakım ve Onarım", advisory: "Danışmanlık, Muhasebe ve Hukuk", food: "Yemek ve İkram", insurance: "Sigorta", software: "Yazılım ve Abonelik", cleaning: "Temizlik ve Güvenlik", marketing: "Reklam ve Pazarlama", freight: "Nakliye ve Kargo", asset: "Demirbaş (Bilgisayar, Mobilya, Cihaz)", bank: "Banka Masrafları", commission: "POS ve Ödeme Kuruluşu Komisyonları", other: "Diğer Giderler" };
        // v2.1.0 (R2): gruplama l.expense_code ile ("GROUP BY code" takma ad yerine invoice_lines.code kolonunu alıyor, bütün türler tek satırda
        // birleşiyordu); KDV'li banka masrafı ve komisyon faturasının türleri adıyla.
        const list = store.all(
          `SELECT substr(i.issue_date, 1, 7) AS month, l.expense_code AS code, l.gl_account AS account, SUM(CASE WHEN i.kind = 'purchase_return' THEN -l.net ELSE l.net END * i.rate) AS net,
                  SUM(CASE WHEN i.kind = 'purchase_return' THEN -l.vat ELSE l.vat END * i.rate) AS vat, COUNT(DISTINCT i.id) AS count
           FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id AND i.status = 'issued' AND i.kind IN ('purchase', 'purchase_return')
           WHERE l.goods = 0 AND (? = '' OR i.issue_date >= ?) AND (? = '' OR i.issue_date <= ?) GROUP BY month, l.expense_code ORDER BY month, net DESC`,
          range.from, range.from, range.to, range.to,
        );
        const total = roundMoney(list.reduce((sum, row) => sum + row.net, 0));
        return {
          subtitle: rangeText(range),
          headers: ["Ay", "Gider Türü", "Hesap", "Belge", "Tutar (KDV Hariç)", "KDV", "Pay"],
          types: ["", "", "", "number", "money", "money", ""],
          rows: list.map(row => [monthLabel(row.month), EXPENSE[row.code] || "Diğer Giderler", row.account, String(row.count), money(roundMoney(row.net)), money(roundMoney(row.vat)), percent(row.net, total)]),
          summary: [["Toplam Gider", money(total)]],
        };
      },
    },
    {
      id: "stopaj-tevkifat",
      group: "Fatura",
      title: "Stopaj ve Tevkifat Özeti",
      description: "Müşterinin bizden kestiği stopaj (193, mahsup edilir) ve alıcı olarak bizim kestiğimiz stopaj ile KDV tevkifatı (360, muhtasar ve 2 No.lu KDV); iadeler asıl belgenin tarafında eksi yazılır.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        // 2.4.4 MM3 (uzman mali müşavir 31b): taraf ve işaret belgenin yönünden, defterin kuralıyla (general-ledger.mjs journal()):
        //   satış / SMM   : müşterinin bizden kestiği — stopaj B 193; KDV tevkifatını alıcı öder (A 391 o kadar az)  → artı
        //   satıştan iade : aynı taraf, EKSİ — asıl satışın tevkifatı ters yönde azalır (B 391 (KDV − tevkifat)); 360'a dokunmaz
        //   alış          : bizim kestiğimiz — A 360 (tevkifat + stopaj)                                              → artı
        //   alıştan iade  : aynı taraf, EKSİ — B 360 (tevkifat + stopaj)
        // Böylece özet defterle (193 / 360 hareketi) ve KDV Özeti'yle ("Alıcı Olarak Kesilen Tevkifat (2 No.lu)") aynı sayıyı verir. Önceden (2.4.3'te de)
        // satıştan iade "Bizim kestiğimiz (360)", alıştan iade "Bizden kesilen (193)" sayılıp ikisi de artı toplanıyordu (tevkifatlı satış + iadesi →
        // defterde 360 yokken "Bizim Ödeyeceğimiz Tevkifat 1.800").
        const THEIRS = "Bizden kesilen (193)";
        const OURS = "Bizim kestiğimiz (360)";
        const SIDE = { sale: [THEIRS, 1], smm: [THEIRS, 1], sale_return: [THEIRS, -1], purchase: [OURS, 1], purchase_return: [OURS, -1] };
        const list = store
          .all(
            `SELECT i.issue_date AS date, i.number, i.kind, COALESCE(json_extract(i.party_json, '$.name'), '') AS name, COALESCE(json_extract(i.party_json, '$.taxNo'), '') AS taxNo,
                    i.try_net AS net, i.stoppage_rate AS stoppageRate, i.try_stoppage AS stoppage, i.try_withheld AS withheld
             FROM invoices i WHERE i.status = 'issued' AND (i.try_stoppage > 0 OR i.try_withheld > 0) AND (? = '' OR i.issue_date >= ?) AND (? = '' OR i.issue_date <= ?) ORDER BY i.issue_date, i.number`,
            range.from, range.from, range.to, range.to,
          )
          .filter(row => SIDE[row.kind])
          .map(row => {
            const [side, sign] = SIDE[row.kind];
            // "|| 0": eksi sıfır "-0,00 TL" yazılmaz.
            const signed = value => roundMoney(sign * (Number(value) || 0)) || 0;
            return { ...row, side, net: signed(row.net), stoppage: signed(row.stoppage), withheld: signed(row.withheld) };
          });
        const sum = (side, key) => roundMoney(list.filter(row => row.side === side).reduce((total, row) => total + row[key], 0)) || 0;
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Belge No", "Cari", "VKN / TCKN", "Taraf", "Matrah", "Stopaj %", "Stopaj", "KDV Tevkifatı"],
          types: ["", "", "", "", "", "money", "", "money", "money"],
          rows: list.map(row => [dayText(row.date), row.number, row.name, row.taxNo, row.side, money(row.net), row.stoppageRate ? `%${row.stoppageRate}` : "", money(row.stoppage), money(row.withheld)]),
          summary: [["Bizden Kesilen Stopaj", money(sum(THEIRS, "stoppage"))], ["Bizim Ödeyeceğimiz Stopaj", money(sum(OURS, "stoppage"))], ["Bizim Ödeyeceğimiz Tevkifat", money(sum(OURS, "withheld"))]],
          // İki taraf karışınca her tarafın kendi TOPLAM satırı (2.4.3 UX24 düzeni; 193 ile 360 toplanmaz, Net satırı yok); tek taraf kalınca tek TOPLAM.
          // Önceki footerUniform karışık dönemde TOPLAM'ı hiç göstermiyordu (raporun taraf süzgeci yok).
          footerGroups: {
            column: "Taraf",
            groups: [
              { label: "TOPLAM Bizden Kesilen (193)", values: [THEIRS] },
              { label: "TOPLAM Bizim Kestiğimiz (360)", values: [OURS] },
            ],
          },
        };
      },
    },
    {
      id: "acik-faturalar",
      group: "Fatura",
      title: "Açık Faturalar ve Yaşlandırma",
      description: "Ödenmemiş (kısmen ödenmiş dahil) satış ve alış faturaları ve mahsup edilmemiş iade alacakları; vade ve gecikme günü (kapama: bağlı ödeme önce kendi faturasına, kalan en eskiye).",
      params: ["account"],
      build(query) {
        const day = today();
        // v2.1.0 (K1): iade belgesinin açığı da (satıştan iade: müşterinin alacağı → Açık Borç; alıştan iade: tedarikçinin borcu → Açık Alacak).
        const list = (invoices()?.openItems ? invoices().openItems(day, { returns: true }) : []).filter(item => !query.account || item.accountId === query.account).sort((a, b) => a.days - b.days);
        const bucket = days => (days >= 0 ? "Vadesi Gelmemiş" : days >= -30 ? "1–30 Gün" : days >= -60 ? "31–60 Gün" : days >= -90 ? "61–90 Gün" : "90+ Gün");
        const sum = side => roundMoney(list.filter(item => item.side === side).reduce((total, item) => total + item.open, 0));
        return {
          subtitle: `${dayText(day)} itibarıyla · taksitli faturalar taksit kartında izlenir`,
          headers: ["Vade", "Fatura No", "Taraf", "Cari", "Fatura Tarihi", "Fatura Tutarı", "Kalan", "Gecikme", "Dilim"],
          types: ["", "", "", "", "", "money", "money", "", ""],
          rows: list.map(item => [dayText(item.dueDate), item.number, item.isReturn ? (item.side === "sale" ? "Alacak (Alıştan İade)" : "Borç (Satıştan İade)") : item.side === "sale" ? "Alacak (Satış)" : "Borç (Alış)", item.accountName, dayText(item.issueDate), money(item.payable), money(item.open), item.days < 0 && !item.isReturn ? `${-item.days} gün` : "", bucket(item.days)]),
          summary: [["Açık Alacak", money(sum("sale"))], ["Açık Borç", money(sum("purchase"))]],
          // 2.4.3 UX24: alacak (satış, alıştan iade) ve borç (alış, satıştan iade) tek TOPLAM'da toplanmaz; her yön kendi TOPLAM satırında
          // (= özetteki Açık Alacak / Açık Borç), altta Net (Alacak − Borç). Cari ya da tek yön kalınca tek TOPLAM satırı.
          footerGroups: {
            column: "Taraf",
            groups: [
              { label: "TOPLAM Alacak", values: ["Alacak (Satış)", "Alacak (Alıştan İade)"] },
              { label: "TOPLAM Borç", values: ["Borç (Alış)", "Borç (Satıştan İade)"] },
            ],
            net: (() => {
              const net = roundMoney(sum("sale") - sum("purchase"));
              return { label: net >= 0 ? "Net (Alacak Fazlası)" : "Net (Borç Fazlası)", cells: { Kalan: money(Math.abs(net)) } };
            })(),
          },
        };
      },
    },
    // ===== Taksit =====
    {
      id: "taksit-kartlari",
      group: "Taksit",
      title: "Taksit Kartları",
      description: "Kartların toplamı, ödenen, kalan, geciken ve sıradaki vadesi.",
      params: ["planStatus"],
      build(query) {
        const status = ["active", "closed", "all"].includes(query.planStatus) ? query.planStatus : "active";
        const data = plans().list(admin, { status, sort: "no" });
        const stateText = { active: "Açık", done: "Bitti", overdue: "Gecikmiş", closed: "Kapatıldı" };
        return {
          subtitle: { active: "Açık kartlar", closed: "Kapatılan kartlar", all: "Tüm kartlar" }[status],
          headers: ["No", "Ad", "Cari", "Grup", "Kayıt", "Toplam", "Ödenen", "Kalan", "Geciken", "Sıradaki Vade", "Durum"],
          types: ["", "", "", "", "", "money", "money", "money", "money", "", ""],
          rows: data.plans.map(plan => [plan.refNo, plan.name, plan.accountName, [plan.groupName, plan.subgroupName].filter(Boolean).join(" › "), dayText(plan.registeredOn), money(plan.totals.total), money(plan.totals.paid), money(plan.totals.remaining), plan.totals.overdue ? money(plan.totals.overdue) : "", plan.next ? `${dayText(plan.next.dueDate)} · ${tl(plan.next.remaining)}` : "", stateText[plan.state] || plan.state]),
          summary: [["Kart", String(data.totals.count)], ["Toplam", money(data.totals.total)], ["Ödenen", money(data.totals.paid)], ["Kalan", money(data.totals.remaining)], ["Geciken", money(data.totals.overdue)]],
        };
      },
    },
    {
      id: "taksit-vadeleri",
      group: "Taksit",
      title: "Taksit Vade Listesi",
      description: "Vadesi seçilen aralıkta olan tüm taksitler; ödenen, kalan ve durumu (ödendi, kısmen, gecikmiş, açık).",
      params: ["range"],
      preset: "thisMonth",
      build(query) {
        const range = dueRangeOf(query, "thisMonth");
        return installmentReport(item => inRange(item.dueDate, range), range.from || range.to ? rangeText(range) : "Tüm vadeler");
      },
    },
    {
      id: "geciken-taksitler",
      group: "Taksit",
      title: "Geciken Taksitler",
      description: "Bugün itibarıyla vadesi geçmiş, ödenmemiş taksitler; kaç gün geciktiği ve telefonu.",
      params: [],
      build() {
        return installmentReport(item => item.state === "overdue", `${dayText(today())} itibarıyla`, { lateFirst: true });
      },
    },
    {
      id: "taksit-performans",
      group: "Taksit",
      title: "Taksit Tahsilat Performansı",
      description: "Ay ay vadesi gelen taksit tutarı, bunun ne kadarının ödendiği, kalan, geciken ve tahsilat oranı (açık kartlar).",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const day = today();
        const list = store.all("SELECT id, name, total, status FROM plans WHERE deleted_at IS NULL AND status = 'active'");
        const items = new Map();
        for (const item of store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate, amount FROM plan_items ORDER BY due_date, seq")) {
          if (!items.has(item.planId)) items.set(item.planId, []);
          items.get(item.planId).push(item);
        }
        const entries = new Map();
        for (const entry of store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date FROM plan_entries ORDER BY date, created_at, rowid")) {
          if (!entries.has(entry.planId)) entries.set(entry.planId, []);
          entries.get(entry.planId).push(entry);
        }
        const months = new Map();
        for (const plan of list) {
          for (const item of allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day }).items) {
            if (!inRange(item.dueDate, range)) continue;
            const key = item.dueDate.slice(0, 7);
            const month = months.get(key) || { count: 0, amount: 0, paid: 0, remaining: 0, overdue: 0 };
            month.count += 1;
            month.amount = roundMoney(month.amount + item.amount);
            month.paid = roundMoney(month.paid + item.paid);
            month.remaining = roundMoney(month.remaining + item.remaining);
            if (item.state === "overdue") month.overdue = roundMoney(month.overdue + item.remaining);
            months.set(key, month);
          }
        }
        const keys = [...months.keys()].sort();
        const sum = key => roundMoney([...months.values()].reduce((total, month) => total + month[key], 0));
        // Oran, vadesi gelmiş aylar için anlamlıdır; gelecek ayda "—" (henüz beklenmiyor).
        const due = [...months.entries()].filter(([key]) => key <= day.slice(0, 7));
        const dueAmount = roundMoney(due.reduce((total, [, month]) => total + month.amount, 0));
        const duePaid = roundMoney(due.reduce((total, [, month]) => total + month.paid, 0));
        return {
          subtitle: `${rangeText(range)} · açık kartlar · ${dayText(day)} itibarıyla`,
          headers: ["Ay", "Taksit", "Vadesi Gelen", "Ödenen", "Kalan", "Geciken", "Tahsilat Oranı"],
          types: ["", "number", "money", "money", "money", "money", ""],
          rows: keys.map(key => {
            const month = months.get(key);
            return [monthLabel(key), String(month.count), money(month.amount), money(month.paid), money(month.remaining), month.overdue ? money(month.overdue) : "", key <= day.slice(0, 7) ? percent(month.paid, month.amount) : "— (vadesi gelmedi)"];
          }),
          summary: [["Taksit", String(keys.reduce((total, key) => total + months.get(key).count, 0))], ["Vadesi Gelen", money(sum("amount"))], ["Ödenen", money(sum("paid"))], ["Geciken", money(sum("overdue"))], ["Tahsilat Oranı (vadesi gelmiş aylar)", percent(duePaid, dueAmount) || "—"]],
          footer: { "Tahsilat Oranı": percent(duePaid, dueAmount) ? `${percent(duePaid, dueAmount)} (vadesi gelmiş)` : "" },
        };
      },
    },
    {
      id: "taksit-tahsilatlari",
      group: "Taksit",
      title: "Taksit Tahsilatları",
      description: "Aralıktaki taksit tahsilatları, iadeler ve Excel'den yüklenen önceden ödenmiş tutarlar (açılış); makbuz numarası, nakit ya da çek/senetle alındığı.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const list = store.all(
          `SELECT e.date, e.kind, e.amount, e.note, e.receipt_no AS receiptNo, e.cheque_id AS chequeId, e.opening, p.name AS planName, COALESCE(a.name, '') AS accountName, i.seq, COALESCE(u.display_name, '') AS actorName
           FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL LEFT JOIN accounts a ON a.id = p.account_id LEFT JOIN plan_items i ON i.id = e.item_id LEFT JOIN users u ON u.id = e.created_by
           WHERE (? = '' OR e.date >= ?) AND (? = '' OR e.date <= ?) ORDER BY e.date, e.created_at`,
          range.from, range.from, range.to, range.to,
        );
        // Açılış (devir, v2.0.8): programa girmeden önce ödenmiş kısım (Excel'den yüklenen "Ödenen"). Kasa'ya hiç girmedi.
        // v2.0.20 (kullanıcı: "hepsini toplasın raporlar da"): ayrı kalemde görünür VE toplam tahsil edilene dahildir.
        const total = { in: 0, out: 0, opening: 0 };
        for (const row of list) {
          const key = row.opening ? "opening" : row.kind;
          total[key] = roundMoney(total[key] + row.amount);
        }
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Makbuz", "Kart", "Cari", "Taksit", "Tür", "Yöntem", "Tutar", "Açıklama", "Giren"],
          types: ["", "", "", "", "", "", "", "money", "", ""],
          // İade / ödeme satırı eksi yazılır: TOPLAM satırı doğrudan net tahsil edilendir.
          rows: list.map(row => [dayText(row.date), row.receiptNo ? String(row.receiptNo) : "", row.planName, row.accountName, row.seq ? `${row.seq}. taksit` : "", row.opening ? "Önceden Ödenen (Açılış)" : row.kind === "in" ? "Tahsilat" : "İade / Ödeme", row.opening ? "Excel'den" : row.chequeId ? "Çek / senet" : "Nakit / havale", money(!row.opening && row.kind !== "in" ? -row.amount : row.amount), row.note, row.actorName]),
          summary: [["Tahsilat", money(total.in)], ...(total.opening ? [["Önceden Ödenen (Açılış)", money(total.opening)]] : []), ["İade / Ödeme", money(total.out)], ["Toplam Tahsil Edilen", money(roundMoney(total.in + total.opening - total.out))]],
        };
      },
    },
    // ===== Çek / Senet =====
    {
      id: "cek-portfoy",
      group: "Çek / Senet",
      title: "Çek / Senet Portföyü",
      description: "Alınan ve verilen evrak; vade, banka, kimden/kime, durum ve tutar. Yön, durum ve vade aralığıyla süzülür.",
      params: ["direction", "status", "range"],
      build(query) {
        const range = query.from || query.to || query.preset ? dueRangeOf(query, "") : { from: "", to: "" };
        // Doğrulama T7 (ders 11): "Bankada Tahsilde" (deposited) süzgeci kabul listesinde yoktu, sessizce düşüyordu; "Portföyde" süzgecinin satırları
        // tahsildekini içermezken özetteki "Portföyde (alınan)" içeriyordu. Özet artık ikisini ayrı yazar (plan §3.14 "Portföyde ile Bankada
        // Tahsilde ayrı").
        const status = Object.hasOwn(STATUSES, String(query.status ?? "")) || ["open", "closed", "overdue", "soon", "deposited"].includes(query.status) ? query.status : "";
        const data = cheques().list(admin, { direction: ["in", "out"].includes(query.direction) ? query.direction : "", status, from: range.from, to: range.to, sort: "due" });
        const deposited = data.summary.deposited || { count: 0, amount: 0 };
        return {
          subtitle: [query.direction ? DIRECTIONS[query.direction] : "Alınan ve verilen", STATUSES[status]?.label || (status === "deposited" ? "Bankada Tahsilde" : ""), range.from || range.to ? `vade ${rangeText(range)}` : ""].filter(Boolean).join(" · "),
          headers: ["Vade", "Yön", "Tür", "No", "Banka", "Kimden / Kime", "Durum", "Tutar"],
          types: ["", "", "", "", "", "", "", "money"],
          rows: data.cheques.map(row => [dayText(row.dueDate), row.directionLabel, row.instrumentLabel, row.serialNo, row.bank, row.status === "endorsed" ? `${row.party} → ${row.endorseAccountName}` : row.party, row.statusLabel, money(row.amount)]),
          summary: [["Listelenen", `${data.listed.count} · ${tl(data.listed.amount)}`], ["Portföyde (alınan)", tl(data.summary.in.open.amount)], ["Bankada Tahsilde", tl(deposited.amount)], ["Ödenecek (verilen)", tl(data.summary.out.open.amount)], ["Vadesi Geçmiş Alınan", tl(data.summary.in.overdue.amount)]],
          footerUniform: "Yön", // alınan ve verilen evrak toplanmaz; Yön süzülünce toplam çıkar
        };
      },
    },
    {
      id: "cek-hareketleri",
      group: "Çek / Senet",
      title: "Çek / Senet Hareketleri",
      description: "Aralıktaki tüm evrak işlemleri: alındı, verildi, tahsil, ciro, karşılıksız, ödeme.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const list = store.all(
          `SELECT ev.date, ev.kind, ev.amount, ev.note, c.direction, c.instrument, c.serial_no AS serialNo, c.drawer, COALESCE(a.name, '') AS accountName, COALESCE(ea.name, '') AS eventAccount, COALESCE(u.display_name, '') AS actorName, ev.created_at AS createdAt
           FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id AND c.deleted_at IS NULL LEFT JOIN accounts a ON a.id = c.account_id LEFT JOIN accounts ea ON ea.id = ev.account_id LEFT JOIN users u ON u.id = ev.created_by
           WHERE (? = '' OR ev.date >= ?) AND (? = '' OR ev.date <= ?) ORDER BY ev.date, ev.created_at`,
          range.from, range.from, range.to, range.to,
        );
        // Doğrulama T9: Bankaya Tahsile Ver ve Bankadan Geri Al (plan §3.14; cheque_events'e yazılmaz, iz fin_events başlıklarında) da evrakın
        // hareketidir. "İlgili Cari" kolonunda evrakın verildiği banka hesabı. Karşılıksız ve tahsil zaten cheque_events'ten gelir; açılış onarımının
        // eski sürüm kapanışları ("eski-surum") "Bankadan Geri Alındı" yazılır. Tutar (doğrulama tur 2 T12): yevmiyedeki gibi verilme başlığının kuruşu —
        // geri alınmış evrakın tutarı sonradan düzeltilse de o günkü işlem o günkü tutarla görünür (Yevmiye ve İşlem Kartı ile aynı).
        if (store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'")) {
          for (const row of store.all(
            `SELECT e.date, e.type, e.created_at AS createdAt, c.direction, c.instrument, c.serial_no AS serialNo, c.drawer,
                    COALESCE(NULLIF((SELECT d.try_minor FROM fin_events d WHERE d.id = k.event_id), 0), CAST(ROUND(c.amount * 100) AS INTEGER)) / 100.0 AS amount, COALESCE(a.name, '') AS accountName,
                    COALESCE(b.bank_name || ' · ' || b.name, '') AS bankLabel, COALESCE(u.display_name, '') AS actorName, e.description AS note
             FROM fin_events e JOIN cheque_collections k ON k.id = e.src_id JOIN cheques c ON c.id = k.cheque_id AND c.deleted_at IS NULL
               LEFT JOIN accounts a ON a.id = c.account_id LEFT JOIN bank_accounts b ON b.id = k.bank_account_id LEFT JOIN users u ON u.id = e.created_by
             WHERE e.type IN ('cheque_deposit', 'cheque_withdraw') AND e.status = 'active' AND e.src_table = 'cheque_collections' AND e.origin_key NOT LIKE 'cheque-return:%'
               AND (? = '' OR e.date >= ?) AND (? = '' OR e.date <= ?)`,
            range.from, range.from, range.to, range.to,
          )) list.push({ date: row.date, kind: row.type === "cheque_deposit" ? "bank-deposit" : "bank-withdraw", amount: row.amount, note: row.note, direction: row.direction, instrument: row.instrument, serialNo: row.serialNo, drawer: row.drawer, accountName: row.accountName, eventAccount: row.bankLabel, actorName: row.actorName, createdAt: row.createdAt });
          list.sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) : a.date < b.date ? -1 : 1));
        }
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Evrak", "No", "Kimden / Kime", "İşlem", "İlgili Cari", "Tutar", "Açıklama", "Giren"],
          types: ["", "", "", "", "", "", "money", "", ""],
          rows: list.map(row => [dayText(row.date), `${DIRECTIONS[row.direction]} ${INSTRUMENTS[row.instrument].toLocaleLowerCase("tr-TR")}`, row.serialNo, row.accountName || row.drawer, EVENT_LABELS[row.kind] || BANK_EVENT_LABELS[row.kind] || row.kind, row.eventAccount, money(row.amount), row.note, row.actorName]),
          summary: [["İşlem", String(list.length)]],
          footerUniform: "İşlem",
        };
      },
    },
    {
      id: "cek-vade-dagilimi",
      group: "Çek / Senet",
      title: "Çek / Senet Vade Dağılımı",
      description: "Açık evrakın vade ayına göre dağılımı: tahsil edilecek (portföydeki alınan) ve ödenecek (verilen); vadesi geçmişler ilk satırda.",
      params: [],
      build() {
        const day = today();
        const buckets = new Map();
        for (const flow of cheques().flows()) {
          const key = flow.date < day ? "late" : flow.date.slice(0, 7);
          const bucket = buckets.get(key) || { inCount: 0, in: 0, outCount: 0, out: 0 };
          if (flow.direction === "out") {
            bucket.outCount += 1;
            bucket.out = roundMoney(bucket.out + flow.amount);
          } else {
            bucket.inCount += 1;
            bucket.in = roundMoney(bucket.in + flow.amount);
          }
          buckets.set(key, bucket);
        }
        const keys = [...buckets.keys()].sort((a, b) => (a === "late" ? -1 : b === "late" ? 1 : a < b ? -1 : 1));
        const sum = key => roundMoney([...buckets.values()].reduce((total, bucket) => total + bucket[key], 0));
        return {
          subtitle: `${dayText(day)} itibarıyla açık evrak (portföydeki alınan, ödenecek verilen)`,
          headers: ["Vade", "Alınan (adet)", "Tahsil Edilecek", "Verilen (adet)", "Ödenecek", "Net"],
          types: ["", "number", "money", "number", "money", "money"],
          rows: keys.map(key => {
            const bucket = buckets.get(key);
            return [key === "late" ? "Vadesi geçmiş" : monthLabel(key), String(bucket.inCount), money(bucket.in), String(bucket.outCount), money(bucket.out), money(roundMoney(bucket.in - bucket.out))];
          }),
          summary: [["Tahsil Edilecek", money(sum("in"))], ["Ödenecek", money(sum("out"))], ["Net", money(roundMoney(sum("in") - sum("out")))], ["Vadesi Geçmiş", money(roundMoney((buckets.get("late")?.in || 0) + (buckets.get("late")?.out || 0)))]],
        };
      },
    },
    // ===== Stok =====
    {
      id: "stok-durumu",
      group: "Stok",
      title: "Stok Durumu",
      description: "Ürün ve hizmet kalemleri: mevcut, kritik seviye, birim fiyat, stok değeri ve durum.",
      params: ["state", "category"],
      build(query) {
        const data = stock().list(admin, { state: ["low", "out", "negative", "product", "service"].includes(query.state) ? query.state : "all", category: limited(query.category, 80, "Kategori"), sort: "name" });
        return {
          subtitle: [{ low: "Kritik seviyedekiler", out: "Tükenenler", negative: "Eksi stoktakiler", product: "Ürünler", service: "Hizmetler" }[query.state] || "Tüm kalemler", query.category || ""].filter(Boolean).join(" · "),
          headers: ["Stok Kodu", "Kalem", "Tür", "Kategori", "Mevcut", "Birim", "Kritik Seviye", "Birim Fiyat", "Değer", "Durum"],
          types: ["", "", "", "", "number", "", "number", "money", "money", ""],
          rows: data.items.map(item => [item.code, item.name, item.kind === "service" ? "Hizmet" : "Ürün", item.category, item.kind === "service" ? "" : qty(item.qty), item.unit, item.minQty ? qty(item.minQty) : "", money(item.unitPrice), item.kind === "service" ? "" : money(item.value), item.kind === "service" ? "Hizmet" : item.qty < 0 ? `Eksi (${qty(item.qty)} ${item.unit})` : item.qty <= 0 ? "Tükendi" : item.low ? "Kritik" : ""]),
          summary: [["Kalem", String(data.totals.count)], ["Kritik", String(data.totals.low)], ["Tükenen", String(data.totals.out)], ["Eksi Stok", String(data.totals.negative)], ["Stok Değeri", money(data.totals.value)]],
        };
      },
    },
    {
      id: "stok-hareketleri",
      group: "Stok",
      title: "Stok Hareketleri",
      description: "Aralıktaki giriş ve çıkışlar; miktar, birim fiyat, tutar ve paranın nereye yazıldığı (Kasa, cari, yok).",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        // MM4 (2.4.3): açılış stoku (işaretli, yalnız miktar) "Açılış Stoku" adıyla ve değeriyle (miktar × birim fiyat; Ana Defter B 153 / A 500 ile aynı
        // kural) görünür; Para kolonu "Açılış Bakiyesi". Giriş Tutarı açılışı da kapsar; açılış ayrıca özetlenir (yevmiyedeki 153 açılışıyla aynı).
        const opening = store.all("PRAGMA table_info(stock_moves)").some(column => column.name === "is_opening") ? "m.is_opening" : "0";
        const list = store.all(
          `SELECT m.date, m.kind, m.reason, m.qty, m.unit_price AS unitPrice, m.amount, m.pay, m.note, ${opening} AS isOpening, i.name, i.code, i.unit, COALESCE(a.name, '') AS accountName, COALESCE(u.display_name, '') AS actorName
           FROM stock_moves m JOIN stock_items i ON i.id = m.item_id LEFT JOIN accounts a ON a.id = m.account_id LEFT JOIN users u ON u.id = m.created_by
           WHERE (? = '' OR m.date >= ?) AND (? = '' OR m.date <= ?) ORDER BY m.date, m.created_at`,
          range.from, range.from, range.to, range.to,
        ).map(row => (Number(row.isOpening) === 1 && row.kind === "in" && row.pay === "none" ? { ...row, opening: true, amount: stockOpeningValue(row) } : row));
        const pay = { none: "Yalnız miktar", cash: "Kasa", account: "Cari" };
        const total = { in: 0, out: 0, opening: 0 };
        for (const row of list) {
          total[row.kind] = roundMoney(total[row.kind] + row.amount);
          if (row.opening) total.opening = roundMoney(total.opening + row.amount);
        }
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Stok Kodu", "Kalem", "Hareket", "Miktar", "Birim", "Birim Fiyat", "Tutar", "Para", "Cari", "Açıklama", "Giren"],
          types: ["", "", "", "", "number", "", "money", "money", "", "", "", ""],
          rows: list.map(row => [dayText(row.date), row.code, row.name, row.opening ? "Açılış Stoku" : row.reason === "return" ? "Satış İadesi" : row.reason === "preturn" ? "Alıştan İade" : row.kind === "in" ? "Giriş" : "Çıkış", qty(row.qty), row.unit, money(row.unitPrice), row.amount ? money(row.amount) : "", row.opening ? "Açılış Bakiyesi" : pay[row.pay] || row.pay, row.accountName, row.note, row.actorName]),
          summary: [["Hareket", String(list.length)], ["Giriş Tutarı", money(total.in)], ["Çıkış Tutarı", money(total.out)], ...(total.opening ? [["Açılış Stoku Değeri", money(total.opening)]] : [])],
          footerUniform: "Hareket", // giriş ve çıkış toplanmaz
        };
      },
    },
    {
      id: "stok-ozet",
      group: "Stok",
      title: "Stok Hareket Özeti (envanter)",
      description: "Her ürün için dönem başı miktar, dönem girişi, dönem çıkışı ve dönem sonu miktar; birim fiyat ve dönem sonu değer (miktar × birim fiyat; eksi stokta eksi değer, Stok Durumu ile aynı kural).",
      params: ["range", "category"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const category = limited(query.category, 80, "Kategori");
        const items = stock().list(admin, { category, sort: "name" }).items.filter(item => item.kind !== "service");
        const moves = new Map();
        for (const row of store.all(
          `SELECT item_id AS itemId,
                  COALESCE(SUM(CASE WHEN ? <> '' AND date < ? THEN (CASE WHEN kind = 'in' THEN qty ELSE -qty END) END), 0) AS opening,
                  COALESCE(SUM(CASE WHEN (? = '' OR date >= ?) AND (? = '' OR date <= ?) AND kind = 'in' THEN qty END), 0) AS qtyIn,
                  COALESCE(SUM(CASE WHEN (? = '' OR date >= ?) AND (? = '' OR date <= ?) AND kind = 'out' THEN qty END), 0) AS qtyOut
           FROM stock_moves GROUP BY item_id`,
          range.from, range.from, range.from, range.from, range.to, range.to, range.from, range.from, range.to, range.to,
        ))
          moves.set(row.itemId, row);
        const out = [];
        let value = 0;
        let negatives = 0;
        for (const item of items) {
          const move = moves.get(item.id) || { opening: 0, qtyIn: 0, qtyOut: 0 };
          const opening = Math.round(move.opening * 1000) / 1000;
          const closing = Math.round((move.opening + move.qtyIn - move.qtyOut) * 1000) / 1000;
          if (!opening && !move.qtyIn && !move.qtyOut) continue;
          // MM7 (2.4.3, uzman mali müşavir): değer kuralı Stok Durumu, Kategoriye Göre Stok Değeri ve Stok ekranıyla AYNI — dönem sonu miktar × birim fiyat,
          // eksi stokta eksi değer (v2.0.17 müşteri kararı: eksiye düşen ürün kaça düştüğünü gösterir; değeri eksi miktar × son maliyet, yaygın
          // programlardaki gibi — girilmemiş alış ya da sayım farkı kadar). Önceden bu rapor eksiyi 0 sayıyordu: aynı gün iki rapor farklı toplam veriyordu.
          const worth = roundMoney(closing * (Number(item.unitPrice) || 0));
          value = roundMoney(value + worth);
          if (closing < 0) negatives += 1;
          out.push([item.code, item.name, item.category, item.unit, qty(opening), qty(move.qtyIn), qty(move.qtyOut), qty(closing), money(item.unitPrice), money(worth)]);
        }
        return {
          subtitle: [rangeText(range), category || "Tüm kategoriler"].join(" · "),
          headers: ["Stok Kodu", "Ürün", "Kategori", "Birim", "Dönem Başı", "Giriş", "Çıkış", "Dönem Sonu", "Birim Fiyat", "Dönem Sonu Değer"],
          types: ["", "", "", "", "number", "number", "number", "number", "money", "money"],
          rows: out,
          summary: [["Ürün", String(out.length)], ...(negatives ? [["Eksi Stok", String(negatives)]] : []), ["Dönem Sonu Değer", money(value)]],
        };
      },
    },
    {
      id: "stok-kategori",
      group: "Stok",
      title: "Kategoriye Göre Stok Değeri",
      description: "Her kategoride kalem sayısı, kritik/tükenen ve toplam stok değeri.",
      params: [],
      build() {
        const data = stock().list(admin, {});
        const groups = new Map();
        for (const item of data.items) {
          const key = item.category || "Kategorisiz";
          const group = groups.get(key) || { count: 0, low: 0, out: 0, negative: 0, value: 0 };
          group.count += 1;
          if (item.low) group.low += 1;
          if (item.kind !== "service" && item.qty <= 0) group.out += 1;
          if (item.kind !== "service" && item.qty < 0) group.negative += 1;
          group.value = roundMoney(group.value + (item.value || 0));
          groups.set(key, group);
        }
        return {
          subtitle: `${dayText(today())} itibarıyla`,
          headers: ["Kategori", "Kalem", "Kritik", "Tükenen", "Eksi Stok", "Stok Değeri"],
          types: ["", "number", "number", "number", "number", "money"],
          rows: [...groups.entries()].sort((a, b) => b[1].value - a[1].value).map(([name, group]) => [name, String(group.count), String(group.low), String(group.out), String(group.negative), money(group.value)]),
          summary: [["Kalem", String(data.totals.count)], ["Stok Değeri", money(data.totals.value)]],
        };
      },
    },
    // ===== Kayıtlar (tablo) =====
    {
      id: "kayit-tahsilatlari",
      group: "Kayıtlar",
      title: "Kayıt Tahsilatları",
      // 2.4.3 (keşif A2): kayıt bir cariye bağlıysa kayıt kartından girilen tahsilat cari defterine yazılır; o carinin tahsilatları da burada
      // (Kayıt kolonunda Cari No ile). Taksit tahsilatları Taksit Tahsilatları raporunda. 2.4.4 (E8): kayıttan Kasa'ya doğrudan tahsilat ekrandan kalktı
      // (zil ve Tahsilat Takvimi cariye yazar); rapor kimliği ve içeriği aynı — eski kayıt tahsilatları ve kayda bağlı carinin tahsilatları.
      description: "Tablodaki kişilerin tahsilatları: kayda bağlı carinin tahsilatları ve eski sürümlerde kayıt kartından girilenler (taksit hariç).",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const list = store.all(
          `SELECT p.date, p.amount, p.note, p.case_key AS caseKey, p.case_title AS caseTitle, COALESCE(u.display_name, '') AS actorName, p.created_at AS createdAt, '' AS refNo FROM payments p LEFT JOIN users u ON u.id = p.created_by
           WHERE (? = '' OR p.date >= ?) AND (? = '' OR p.date <= ?)
           UNION ALL
           SELECT e.date, e.amount, e.note, a.case_key AS caseKey, a.case_title AS caseTitle, COALESCE(u.display_name, '') AS actorName, e.created_at AS createdAt, CASE WHEN a.ref_no <> '' THEN a.ref_no ELSE '—' END AS refNo
           FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL AND a.case_key <> '' LEFT JOIN users u ON u.id = e.created_by
           WHERE e.kind = 'in' AND (? = '' OR e.date >= ?) AND (? = '' OR e.date <= ?)
           ORDER BY 1, 7`,
          range.from, range.from, range.to, range.to, range.from, range.from, range.to, range.to,
        );
        const title = caseTitles(list.filter(row => !row.caseTitle).map(row => row.caseKey));
        const total = roundMoney(list.reduce((sum, row) => sum + row.amount, 0));
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Kayıt", "Tutar", "Açıklama", "Giren"],
          types: ["", "", "money", "", ""],
          rows: list.map(row => [dayText(row.date), `${row.caseTitle || title(row.caseKey)}${row.refNo ? ` · Cari No ${row.refNo}` : ""}`, money(row.amount), row.note, row.actorName]),
          summary: [["Tahsilat", String(list.length)], ["Toplam", money(total)]],
        };
      },
    },
    {
      id: "notlar",
      group: "Kayıtlar",
      title: "Kayıt Notları",
      description: "Kayıtlara yazılan notlar; kim, ne zaman.",
      params: ["range"],
      preset: "thisYear",
      build(query) {
        const range = rangeOf(query, "thisYear");
        const list = store.all(
          `SELECT n.note, n.case_key AS caseKey, n.created_at AS createdAt, COALESCE(u.display_name, '') AS actorName FROM notes n LEFT JOIN users u ON u.id = n.created_by
           WHERE (? = '' OR substr(n.created_at, 1, 10) >= ?) AND (? = '' OR substr(n.created_at, 1, 10) <= ?) ORDER BY n.created_at`,
          range.from, range.from, range.to, range.to,
        );
        const title = caseTitles(list.map(row => row.caseKey));
        return { subtitle: rangeText(range), headers: ["Zaman", "Kayıt", "Not", "Yazan"], types: ["", "", "", ""], rows: list.map(row => [stamp(row.createdAt), title(row.caseKey), row.note, row.actorName]), summary: [["Not", String(list.length)]] };
      },
    },
    {
      id: "gorevler",
      group: "Kayıtlar",
      title: "Görevler",
      description: "Atanan görevler; kime, son tarih, öncelik ve durum.",
      params: ["taskStatus"],
      build(query) {
        const status = ["open", "done", "all"].includes(query.taskStatus) ? query.taskStatus : "all";
        const list = store.all(
          `SELECT t.title, t.case_key AS caseKey, t.assignee, t.due_date AS dueDate, t.priority, t.status, t.created_at AS createdAt, t.completed_at AS completedAt, COALESCE(u.display_name, '') AS actorName
           FROM tasks t LEFT JOIN users u ON u.id = t.created_by ORDER BY (t.status = 'open') DESC, t.due_date, t.created_at`,
        ).filter(row => status === "all" || (status === "open" ? row.status === "open" : row.status !== "open"));
        const title = caseTitles(list.map(row => row.caseKey));
        return {
          subtitle: { all: "Tüm görevler", open: "Açık görevler", done: "Tamamlananlar" }[status],
          headers: ["Görev", "Kayıt", "Atanan", "Son Tarih", "Öncelik", "Durum", "Oluşturan", "Oluşturma", "Tamamlanma"],
          types: ["", "", "", "", "", "", "", "", ""],
          rows: list.map(row => [row.title, title(row.caseKey), row.assignee, dayText(String(row.dueDate || "").slice(0, 10)), PRIORITY[row.priority] || row.priority, TASK_STATUS[row.status] || row.status, row.actorName, stamp(row.createdAt), stamp(row.completedAt)]),
          summary: [["Görev", String(list.length)], ["Açık", String(list.filter(row => row.status === "open").length)]],
        };
      },
    },
    {
      id: "belgeler",
      group: "Kayıtlar",
      title: "Belgeler",
      description: "Kayıtlara eklenen belgeler; adı, türü, boyutu, ekleyen ve tarih.",
      params: ["range"],
      build(query) {
        const range = query.from || query.to || query.preset ? rangeOf(query, "") : { from: "", to: "" };
        const list = store.all(
          `SELECT d.name, d.kind, d.size, d.case_key AS caseKey, d.case_title AS caseTitle, d.created_at AS createdAt, COALESCE(u.display_name, '') AS actorName FROM case_documents d LEFT JOIN users u ON u.id = d.created_by
           WHERE d.deleted_at IS NULL AND (? = '' OR substr(d.created_at, 1, 10) >= ?) AND (? = '' OR substr(d.created_at, 1, 10) <= ?) ORDER BY d.created_at`,
          range.from, range.from, range.to, range.to,
        );
        const title = caseTitles(list.filter(row => !row.caseTitle).map(row => row.caseKey));
        const size = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
        return { subtitle: rangeText(range), headers: ["Eklenme", "Kayıt", "Belge", "Tür", "Boyut", "Ekleyen"], types: ["", "", "", "", "", ""], rows: list.map(row => [stamp(row.createdAt), row.caseTitle || title(row.caseKey), row.name, row.kind, size(row.size), row.actorName]), summary: [["Belge", String(list.length)]] };
      },
    },
    {
      id: "tablo-verisi",
      group: "Kayıtlar",
      title: "Tablo Verisi (açık veri oturumu)",
      description: "Ortadaki tablonun tüm kayıtları, programda yapılan düzeltmelerle; sekme seçilebilir.",
      params: ["tab"],
      async build(query) {
        const view = await dataset.view();
        const tab = limited(query.tab, 120, "Sekme");
        const rows = (view.rows || []).filter(row => !tab || row.__sheet === tab);
        const headers = [];
        for (const row of rows) for (const key of Object.keys(row)) if (!key.startsWith("__") && !headers.includes(key)) headers.push(key);
        const withTab = !tab && (view.tabs || []).length > 1;
        return {
          title: "Tablo Verisi",
          subtitle: [dataset.info?.()?.fileName || "", tab ? `Sekme: ${tab}` : withTab ? "Tüm sekmeler" : "", `${rows.length} kayıt`].filter(Boolean).join(" · "),
          headers: [...(withTab ? ["Sekme"] : []), ...headers],
          types: [],
          rows: rows.map(row => [...(withTab ? [row.__sheet || ""] : []), ...headers.map(key => String(row[key] ?? ""))]),
          summary: [["Kayıt", String(rows.length)], ["Kolon", String(headers.length)]],
          tabs: (view.tabs || []).map(item => item.title),
        };
      },
    },
    // ===== Ofis =====
    {
      id: "islem-gecmisi",
      group: "Ofis",
      title: "İşlem Geçmişi (denetim kaydı)",
      description: "Programda kim, ne zaman, ne yaptı: kayıt, düzeltme, silme, tahsilat, dışa aktarma…",
      params: ["range"],
      preset: "last30",
      permission: "audit.view",
      standalone: true,
      build(query) {
        const range = rangeOf(query, "last30");
        const list = store.all(
          `SELECT type, entity_id AS entityId, actor_name AS actorName, payload_json AS payload, created_at AS createdAt FROM audit_events
           WHERE (? = '' OR substr(created_at, 1, 10) >= ?) AND (? = '' OR substr(created_at, 1, 10) <= ?) ORDER BY created_at DESC LIMIT ?`,
          range.from, range.from, range.to, range.to, MAX_ROWS,
        );
        const detail = json => {
          try {
            const value = JSON.parse(json || "{}");
            return Object.entries(value)
              .filter(([, item]) => item !== null && item !== undefined && item !== "" && typeof item !== "object")
              .slice(0, 6)
              .map(([key, item]) => `${key}: ${String(item).slice(0, 60)}`)
              .join(" · ");
          } catch {
            return "";
          }
        };
        return { subtitle: rangeText(range), headers: ["Zaman", "Kişi", "İşlem", "Nesne", "Ayrıntı"], types: ["", "", "", "", ""], rows: list.map(row => [stamp(row.createdAt), row.actorName, row.type, row.entityId, detail(row.payload)]), summary: [["Kayıt", String(list.length)]] };
      },
    },
  ];
  const REGISTRY = new Map(REPORTS.map(report => [report.id, report]));

  // Ayrıntılı Cari Ekstre (2.4.5 madde 6d; müşteri isteği M2): Cari Ekstre + "Fatura Kalemlerini Göster". Hareketler ve yürüyen bakiye seçeneği kapalı
  // ekstreyle AYNI defterden (statement); her satıra Belge No ve ödeme yolu, faturanın satırının altına kalemleri (lib/statement-detail.mjs). Kalemler
  // faturanın kendi kayıtlı satırlarıdır (invoice_lines; Düzenle'den sonra güncel); iptal edilen ve taslak faturanın defter satırı olmadığından kalemi de
  // görünmez (seçenek kapalı ekstreyle aynı).
  function detailedEkstre(account, range, result, mark) {
    const chunks = (ids, size = 400) => {
      const list = [...new Set(ids.filter(Boolean))];
      const out = [];
      for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
      return out;
    };
    const marks = list => list.map(() => "?").join(", ");
    const invoiceIds = result.lines.filter(line => line.origin === "invoice").map(line => line.sourceId);
    const heads = new Map();
    const items = new Map();
    for (const chunk of chunks(invoiceIds)) {
      for (const row of store.all(`SELECT id, kind, number, currency, prices_include_vat AS pricesIncludeVat, discount_rate AS discountRate, stoppage_rate AS stoppageRate, stoppage_total AS stoppage FROM invoices WHERE id IN (${marks(chunk)})`, ...chunk)) heads.set(row.id, row);
      for (const line of store.all(`SELECT invoice_id AS invoiceId, name, code, qty, unit, unit_price AS unitPrice, discount_rate AS discountRate, net, vat_rate AS vatRate, gross, withheld FROM invoice_lines WHERE invoice_id IN (${marks(chunk)}) ORDER BY invoice_id, seq`, ...chunk)) {
        if (!items.has(line.invoiceId)) items.set(line.invoiceId, []);
        items.get(line.invoiceId).push(line);
      }
    }
    const invoices = new Map([...heads.values()].map(row => [row.id, { number: row.number || "", kindLabel: INVOICE_KINDS[row.kind]?.label || "Fatura", currency: row.currency || "TRY", pricesIncludeVat: Number(row.pricesIncludeVat) === 1, discountRate: Number(row.discountRate) || 0, stoppageRate: Number(row.stoppageRate) || 0, stoppage: Number(row.stoppage) || 0, lines: items.get(row.id) || [] }]));
    // Taksit tahsilatının yolu ve evrakı (defter satırı "plan-entry:<kimlik>"); çek / senet satırının evrakı (kaynak kimliği = evrak).
    const planEntryIds = result.lines.filter(line => String(line.id).startsWith("plan-entry:")).map(line => String(line.id).slice("plan-entry:".length));
    const planEntries = new Map();
    for (const chunk of chunks(planEntryIds)) for (const row of store.all(`SELECT id, method, cheque_id AS chequeId FROM plan_entries WHERE id IN (${marks(chunk)})`, ...chunk)) planEntries.set(row.id, row);
    const chequeIds = [...result.lines.filter(line => line.origin === "cheque").map(line => line.sourceId), ...[...planEntries.values()].map(row => row.chequeId)];
    const cheques = new Map();
    for (const chunk of chunks(chequeIds)) for (const row of store.all(`SELECT id, instrument, serial_no AS serialNo FROM cheques WHERE id IN (${marks(chunk)})`, ...chunk)) cheques.set(row.id, row);
    const instrument = cheque => (cheque ? (cheque.instrument === "note" ? "Senet" : "Çek") : "Çek / Senet");
    const receipt = line => (line.receiptNo ? `Makbuz ${line.receiptNo}` : "");
    const extras = new Map();
    for (const line of result.lines) {
      const cash = line.kind === "in" || line.kind === "out";
      if (line.origin === "invoice") extras.set(line.id, { docNo: invoices.get(line.sourceId)?.number || "", way: cash ? methodLabel(line.method, line.kind) : "" });
      else if (line.origin === "cheque") {
        const cheque = cheques.get(line.sourceId);
        extras.set(line.id, { docNo: cheque?.serialNo || "", way: instrument(cheque) });
      } else if (String(line.id).startsWith("plan-entry:")) {
        const entry = planEntries.get(String(line.id).slice("plan-entry:".length));
        const cheque = entry?.chequeId ? cheques.get(entry.chequeId) : null;
        extras.set(line.id, { docNo: receipt(line) || cheque?.serialNo || "", way: entry?.chequeId ? instrument(cheque) : entry ? methodLabel(entry.method || "cash", line.kind === "plan-in" ? "in" : "out") : "" });
      } else extras.set(line.id, { docNo: receipt(line), way: cash ? methodLabel(line.method, line.kind) : "" });
    }
    const model = detailedStatement({ opening: result.opening, openingDay: openingDay(range.from), lines: result.lines, invoices, extras, dayText, money, mark });
    return {
      title: `Ayrıntılı Cari Ekstre · ${account.name}`,
      subtitle: [account.refNo ? `Cari No ${account.refNo}` : "", rangeText(range), "Fatura kalemleriyle", "B: borçlu · A: alacaklı"].filter(Boolean).join(" · "),
      headers: model.headers,
      types: model.types,
      rows: model.rows,
      rowMarks: model.marks,
      footers: model.footers,
      summary: [["Devir", money(result.opening)], ["Dönem Borç", money(result.debit)], ["Dönem Alacak", money(result.credit)], ["Genel Toplam (Bakiye)", `${tl(Math.abs(result.closing))} ${sideText(result.closing)}`]],
    };
  }

  // Fatura listesi raporları (satış / alış / iade): rakamlar fatura modülünün listesiyle aynı (ödenen ve kalan kapamadan).
  function invoiceListReport(query, kinds, label) {
    const range = rangeOf(query, "thisYear");
    const service = invoices();
    if (!service?.list) return { subtitle: rangeText(range), headers: [], types: [], rows: [], summary: [] };
    const data = service.list(admin, { side: "", kind: "", status: "issued", pay: "", profile: "", from: range.from, to: range.to, account: limited(query.account || "", 120, "Cari"), item: "", q: "", ids: [], sort: "date" });
    const list = data.invoices.filter(row => kinds.includes(row.kind)).sort((a, b) => (a.issueDate === b.issueDate ? (a.issueTime < b.issueTime ? -1 : 1) : a.issueDate < b.issueDate ? -1 : 1));
    const detail = new Map(store.all(`SELECT id, try_withheld AS withheld, try_stoppage AS stoppage, COALESCE(json_extract(party_json, '$.taxNo'), '') AS taxNo FROM invoices WHERE id IN (${list.map(() => "?").join(", ") || "''"})`, ...list.map(row => row.id)).map(row => [row.id, row]));
    const sum = key => roundMoney(list.reduce((total, row) => total + (Number(row[key]) || 0), 0));
    const sumDetail = key => roundMoney(list.reduce((total, row) => total + (Number(detail.get(row.id)?.[key]) || 0), 0));
    const returns = kinds.some(kind => kind.endsWith("return"));
    return {
      subtitle: rangeText(range),
      headers: ["Tarih", "Saat", "Fatura No", "Tür", "Cari", "VKN / TCKN", returns ? "İade Edilen" : "Senaryo", "Matrah", "KDV", "Tevkifat", "Stopaj", "Ödenecek", "Ödenen", "Kalan", "Durum"],
      types: ["", "", "", "", "", "", "", "money", "money", "money", "money", "money", "money", "money", ""],
      rows: list.map(row => [dayText(row.issueDate), row.issueTime, row.displayNo, row.kindLabel, row.accountName, detail.get(row.id)?.taxNo || "", returns ? row.originalNumber : row.scenarioLabel, money(row.tryNet), money(row.tryVat), money(detail.get(row.id)?.withheld || 0), money(detail.get(row.id)?.stoppage || 0), money(row.tryPayable), returns ? "" : money(row.paid), returns ? "" : money(row.open), row.payStateLabel]),
      summary: [[`${label} Faturası`, String(list.length)], ["Matrah", money(sum("tryNet"))], ["KDV", money(sum("tryVat"))], ["Tevkifat", money(sumDetail("withheld"))], ["Ödenecek", money(sum("tryPayable"))], ...(returns ? [] : [["Kalan", money(sum("open"))]])],
      // İade raporunda satıştan ve alıştan iade aynı listede: toplam yalnız tek tür varken anlamlıdır.
      footerUniform: returns ? "Tür" : undefined,
    };
  }

  // Taksitler (vade listesi ve gecikenler) tek geçişte: kartlar, taksitler ve hareketler toplu okunur, allocate ile dağıtılır.
  function installmentReport(filter, subtitle, { lateFirst = false } = {}) {
    const day = today();
    const list = store.all(
      `SELECT p.id, p.name, p.phone, p.total, p.status, COALESCE(a.name, '') AS accountName FROM plans p LEFT JOIN accounts a ON a.id = p.account_id WHERE p.deleted_at IS NULL AND p.status = 'active'`,
    );
    const items = new Map();
    for (const item of store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate, amount FROM plan_items ORDER BY due_date, seq")) {
      if (!items.has(item.planId)) items.set(item.planId, []);
      items.get(item.planId).push(item);
    }
    const entries = new Map();
    for (const entry of store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date FROM plan_entries ORDER BY date, created_at, rowid")) {
      if (!entries.has(entry.planId)) entries.set(entry.planId, []);
      entries.get(entry.planId).push(entry);
    }
    const out = [];
    for (const plan of list) {
      const ledger = allocate(plan, items.get(plan.id) || [], entries.get(plan.id) || [], { today: day });
      for (const item of ledger.items) if (filter(item)) out.push({ plan, item });
    }
    out.sort((a, b) => (lateFirst ? a.item.days - b.item.days : 0) || (a.item.dueDate < b.item.dueDate ? -1 : a.item.dueDate > b.item.dueDate ? 1 : 0) || collator.compare(a.plan.name, b.plan.name));
    const stateText = item => (item.state === "paid" ? "Ödendi" : item.state === "overdue" ? `${Math.abs(item.days)} gün gecikti` : item.state === "today" ? "Bugün" : item.partial ? "Kısmen ödendi" : "Açık");
    const sum = key => roundMoney(out.reduce((total, row) => total + row.item[key], 0));
    return {
      subtitle,
      headers: ["Vade", "Ad", "Cari", "Telefon", "Taksit", "Tutar", "Ödenen", "Kalan", "Durum"],
      types: ["", "", "", "", "", "money", "money", "money", ""],
      rows: out.map(({ plan, item }) => [dayText(item.dueDate), plan.name, plan.accountName, plan.phone, `${item.seq}. taksit`, money(item.amount), money(item.paid), money(item.remaining), stateText(item)]),
      summary: [["Taksit", String(out.length)], ["Tutar", money(sum("amount"))], ["Ödenen", money(sum("paid"))], ["Kalan", money(sum("remaining"))]],
    };
  }

  // ---------- Uçlar ----------
  // Finans raporları "overview.view" ister. Kendi izniyle tek başına açılan rapor (standalone: İşlem geçmişi → audit.view)
  // finans yetkisi olmayana da açılır (v2.0.10): Yönetim paneli yalnız yöneticiye kaldığından uzman işlem geçmişini
  // Raporlar → Tüm raporlar'dan görür.
  // anyOf (2.3.0 İz 1.7): listelenen yetkilerden biri yeter (Şüpheli Alacaklar: Şüpheli Alacak İşlemleri ya da finans raporları).
  const allowed = (user, report) =>
    report.anyOf ? report.anyOf.some(permission => canUser(user, permission)) : report.standalone ? canUser(user, report.permission) : canUser(user, "overview.view") && (!report.permission || canUser(user, report.permission));
  const enter = req => {
    const user = auth.requireUser(req);
    if (!REPORTS.some(report => allowed(user, report))) throw new HttpError(403, "Bu işlem için yetkiniz yok.", { code: "FORBIDDEN", permission: "overview.view" });
    return user;
  };
  const queryOf = params => {
    const query = {};
    // v2.0.23 (Bulgu 4): payMethod (Banka ve POS Hareketleri → Yol) listede yoktu; süzgeç 2.0.17'den beri yok sayılıyordu.
    // v2.1.0 Aşama 14: Banka raporlarının süzgeçleri (bankAccount, bankMove, bankGroup, feeAccount) — Bulgu 4 dersi: listede olmayan parametre düşer.
    // 2.2.0 (İz 3.5): POS raporlarının süzgeçleri (posTerminal, posKind). 2.3.0 (İz 1.7): Şüpheli Alacaklar (doubtfulStatus, doubtfulReason).
    // 2.3.0 İz 3.3: anyAccount (Banka ve POS Hareketleri, Cari / Fatura / Taksit ve Banka Hareketleri: Hesap süzgeci).
    for (const key of ["preset", "from", "to", "account", "type", "side", "status", "direction", "category", "state", "planStatus", "taskStatus", "tab", "payMethod", "bankAccount", "bankMove", "bankGroup", "feeAccount", "posTerminal", "posKind", "anyAccount", "posSale", "posPeriod", "doubtfulStatus", "doubtfulReason", "items"]) {
      const value = text(params.get(key));
      if (value) query[key] = value.slice(0, 200);
    }
    return query;
  };
  // İş parçacığına giden kullanıcı: yetki kümesi ve kimlik (yapılandırılmış kopya; işlev taşımaz).
  const workerUser = user => ({ id: user?.id || "", username: user?.username || "", display_name: user?.display_name || "", role: user?.role || "", role_key: user?.role_key ?? null, roleKey: user?.roleKey ?? null, grants_json: user?.grants_json ?? null, ...(user?.perms instanceof Set ? { perms: user.perms } : {}) });
  // limit (yalnız iş parçacığında): ilk n satır taşınır; toplam sayı ve TOPLAM satırı bütün satırlardan. inline: iş parçacığının kendisi.
  async function run(user, id, params, { limit = 0, inline = false } = {}) {
    const report = REGISTRY.get(String(id || ""));
    if (!report) throw new HttpError(404, "Rapor bulunamadı.");
    if (!allowed(user, report)) throw new HttpError(403, "Bu rapor için yetkiniz yok.");
    const query = queryOf(params);
    // 11.10.2026 hız düzeltmesi: büyük banka raporu ayrı iş parçacığında (aynı kod, salt okunur anlık görüntü); ana iş parçacığı bu sürede
    // öbür isteklere yanıt verir. İşlem içinde (yazımın ortasında) çağrılırsa yerinde hazırlanır.
    if (report.worker && offload && !inline && !store.inTransaction) return offload({ id: report.id, query, user: workerUser(user), limit, time: clock().toISOString() });
    const result = await report.build(query, user);
    const rows = result.rows.slice(0, MAX_ROWS);
    // 2.4.3 UX24: footers (bir ya da birden çok TOPLAM satırı); footer yalnız tek satırlık TOPLAM için (eski okurlar).
    // 2.4.5 madde 6d: rapor kendi TOPLAM satırlarını verebilir (Ayrıntılı Cari Ekstre: Dönem Toplamı + Genel Toplam; kalem satırları toplanmaz).
    const footers = Array.isArray(result.footers) ? (rows.length ? result.footers : []) : footerRows({ headers: result.headers, types: result.types || [], rows, footer: result.footer, footerUniform: result.footerUniform, footerGroups: result.footerGroups });
    const footer = footers.length === 1 ? footers[0] : null;
    // rowMarks (2.4.5 madde 6d): satır türü ("item" = fatura kalemi; ekranda girintili). Yalnız veren raporda döner.
    return { id: report.id, group: report.group, title: result.title || report.title, subtitle: result.subtitle || "", headers: result.headers, types: result.types || [], rows, total: result.rows.length, footer, footers, summary: result.summary || [], tabs: result.tabs || null, query, ...(Array.isArray(result.rowMarks) ? { rowMarks: result.rowMarks.slice(0, MAX_ROWS) } : {}) };
  }
  router.get("/api/workspace/report-center", async ({ req, res }) => {
    const user = enter(req);
    const list = REPORTS.filter(report => allowed(user, report)).sort((a, b) => groupRank(a.group) - groupRank(b.group));
    // Banka raporlarının hesap seçenekleri (yalnız Banka Raporları yetkisiyle; bakiye dönmez): Gerçek Banka hesapları, kart ve kredi hesapları,
    // Hesabı Atanmamış Eski Hareketler. Banka Masraf Raporu'nda yalnız hesaplar (masraf her zaman bir hesabın satırıdır).
    // 2.4.3 (C14): Banka ve POS Hareketleri Banka grubuna taşındı ama yalnız Finans Raporları ister; seçenekler yine yalnız Banka Raporları yetkisine
    // (önceki koşul "Banka grubunda rapor var" bu yetkiyle aynıydı).
    let choices = null;
    if (canUser(user, "bank.reports") && list.some(report => report.group === "Banka")) {
      const rows = bankRows();
      const accountsOf = filter => rows.filter(filter).map(row => [row.id, `${bankLabel(row)} · ${row.glSub}${isRealKind(row.kind) ? "" : row.kind === "card" ? " (Kredi Kartı)" : " (Kredi Hesabı)"}`]);
      choices = {
        bankAccount: [["", `${K10_LABELS.realBank} (Tüm Hesaplar)`], ...accountsOf(row => isRealKind(row.kind)), ...accountsOf(row => !isRealKind(row.kind)), [UNASSIGNED_CHOICE, K10_LABELS.unassigned]],
        feeAccount: [["", "Tüm Banka Hesapları"], ...accountsOf(row => isRealKind(row.kind))],
        // 2.3.0 İz 3.3: "Tüm Hesaplar" = hesaplı, POS'lu ve hesabı atanmamış bütün banka tarafı satırları (Banka Hareket Raporu'nun "Gerçek Banka (Tüm
        // Hesaplar)"ından farklı: kart, kredi ve bağsız satırlar da girer).
        anyAccount: [["", "Tüm Hesaplar"], ...accountsOf(row => isRealKind(row.kind)), ...accountsOf(row => !isRealKind(row.kind)), [UNASSIGNED_CHOICE, K10_LABELS.unassigned]],
        posTerminal: [["", "Tüm POS'lar"], ...(bankService()?.pos?.list?.() || []).map(item => [item.id, `${item.name} (${item.code})${item.status === "passive" ? " (Pasif)" : ""}`])],
      };
    }
    ok(res, {
      // emptyHint (2.3.0 İz 5.2): boş sonuçta raporun kendi ipucu ve bağı (ör. POS Ödeme Takvimi → Banka → Hareketler).
      // presets (2.4.3 C15): "future" → ekranın dönem düğmeleri ileriye dönük (Önümüzdeki 7/30/90 Gün, Bu Ay, Tüm Beklenenler).
      // actions (2.4.3 MM3): raporun yanındaki iş düğmeleri (ör. KDV Özeti → KDV Mahsup Fişi Oluştur) — yalnız yetkisi olana.
      reports: list.map(({ id, group, title, description, params, preset, presets, accountRequired, emptyHint, actions }) => {
        const own = (actions || []).filter(item => canUser(user, item.permission)).map(({ id: key, label }) => ({ id: key, label }));
        return { id, group, title, description, params, preset: preset || "", ...(presets ? { presets } : {}), accountRequired: accountRequired === true, ...(emptyHint ? { emptyHint } : {}), ...(own.length ? { actions: own } : {}) };
      }),
      ...(choices ? { choices } : {}),
      today: today(),
    });
  });
  router.get("/api/workspace/report-center/:id", async ({ req, res, params, url }) => {
    const user = enter(req);
    const data = await run(user, params.id, url.searchParams, { limit: PREVIEW_ROWS });
    ok(res, { ...data, rows: data.rows.slice(0, PREVIEW_ROWS), ...(data.rowMarks ? { rowMarks: data.rowMarks.slice(0, PREVIEW_ROWS) } : {}), total: data.total });
  });
  // PDF ve Excel üretimi tek yerden (lib/report-files.mjs; 2.3.0 İz 5.1): Banka → Hareketler'in PDF / Excel düğmeleri de aynı üreticiyi kullanır.
  const fileCtx = user => ({ now: clock(), companyLabel: companyLabel(), userName: user.display_name || user.username || "", brand: office() || "DestekOfis", header });
  router.get("/api/workspace/report-center/:id/pdf", async ({ req, res, params, url }) => {
    const user = enter(req);
    // PDF_ROWS + 1: kırpılıp kırpılmadığı (alt başlık) satır sayısından anlaşılır; kırpılsa da TOPLAM satırı TÜM satırların toplamıdır.
    const data = await run(user, params.id, url.searchParams, { limit: PDF_ROWS + 1 });
    const pdf = reportPdf(data, { ...fileCtx(user), pdfRows: PDF_ROWS });
    audit(user, "report.exported", data.id, { format: "pdf", rows: data.total, ...data.query });
    sendBuffer(res, pdf, { type: "application/pdf", name: `${reportFileBase(data.title, today())}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/report-center/:id/xlsx", async ({ req, res, params, url }) => {
    const user = enter(req);
    const data = await run(user, params.id, url.searchParams);
    const buffer = reportXlsx(data, fileCtx(user));
    audit(user, "report.exported", data.id, { format: "xlsx", rows: data.total, ...data.query });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${reportFileBase(data.title, today())}.xlsx` });
  });

  return { reports: () => REPORTS.map(report => report.id), run };
}
