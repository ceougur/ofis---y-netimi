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
import { HttpError, limited, ok, sendBuffer, text } from "../lib/http.mjs";
import { roundMoney } from "../lib/money.mjs";
import { canUser } from "../lib/permissions.mjs";
import { allocate, dayText, isoDay } from "../lib/plans.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";

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
const TYPE_TEXT = { customer: "Müşteri", supplier: "Tedarikçi", other: "Diğer" };
const CASH_SOURCE = { payment: "Kayıt tahsilatı", manual: "Kasa", plan: "Taksit", account: "Cari", stock: "Stok", cheque: "Çek / senet" };
const PRIORITY = { high: "Yüksek", normal: "Normal", low: "Düşük", urgent: "Acil" };
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

export function registerReportCenter(router, { store, auth, audit, dataset, cash = () => null, accounts = () => null, plans = () => null, stock = () => null, cheques = () => null, overview = () => null, ledger = () => null, integrity = () => null, now: clock = () => new Date() }) {
  const today = () => isoDay(clock());
  const office = () => store.setting("office.name", "");
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
  const allTime = from => isAllTimeStart(from, today());
  const rangeText = ({ from, to }) =>
    allTime(from) ? `Tüm hareketler · ${to ? dayText(to) : "bugün"} tarihine kadar` : from || to ? `${from ? dayText(from) : "…"} – ${to ? dayText(to) : "…"}` : "Tüm zamanlar";
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

  // ---------- Rapor kaydı ----------
  // params: "range" (tarih aralığı), "asOf", "account", "type", "side", "status", "direction", "category", "state", "planStatus", "taskStatus", "tab"
  const REPORTS = [
    // ===== Kasa =====
    {
      id: "kasa-hareketleri",
      group: "Kasa",
      title: "Kasa Hareketleri",
      description: "Seçilen aralıktaki tüm giriş ve çıkışlar; devir, yürüyen bakiye ve kaynağı (kayıt tahsilatı, taksit, cari, stok, çek/senet, elle).",
      params: ["range"],
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
        const data = cash().report(admin, range.from, range.to);
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
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
        const data = cash().report(admin, range.from, range.to);
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
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
        const data = cash().report(admin, range.from, range.to);
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
        const data = cash().report(admin, range.from, range.to);
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
        const first = range.from ? range.from.slice(0, 7) : data.entries[0]?.date.slice(0, 7) || today().slice(0, 7);
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
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
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
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
        const rows = [];
        for (const entry of ledger().build()) {
          if ((range.from && entry.date < range.from) || (range.to && entry.date > range.to)) continue;
          for (const line of entry.lines) rows.push([dayText(entry.date), entry.source, entry.text || "", line.account, money(line.debit / 100), money(line.credit / 100)].map((cell, index) => (index >= 4 && cell === money(0) ? "" : cell)));
        }
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "İşlem", "Açıklama", "Hesap", "Borç", "Alacak"],
          types: ["", "", "", "", "money", "money"],
          rows,
          summary: [["Madde", String(rows.length / 2)]],
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
        return {
          subtitle: ok ? "Tüm hesaplar tutarlı; borç toplamı alacak toplamına eşit. Her kayıt yazılmadan önce bu denetimden geçer." : "Fark bulunan hesap var; yöneticiye bildirin. Yeni işlemler bu farkı büyütemez.",
          headers: ["Hesap", "Hesap Adı", "Ana Defter", "Alt Defter", "Fark", "Durum"],
          types: ["", "", "money", "money", "money", ""],
          rows: [
            ...reconciliation.checks.map(check => [check.code, check.name, money(check.ledger), money(check.subledger), money(check.difference), check.ok ? "Tutarlı" : "Fark Var"]),
            ...extra.map(check => ["Denetim", check.name, "", "", check.ok ? "" : `${check.count} satır`, check.ok ? "Tutarlı" : "Fark Var"]),
          ],
          summary: [["Çift Yönlü Denge", reconciliation.balanced ? "Borç = Alacak" : "Dengesiz"], ["Sonuç", ok ? "Tutarlı" : "Fark Var"]],
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
          rows: rows.map(row => [row.at.replace("T", " ").slice(0, 19), row.action === "rolled-back" ? "Geri Alındı" : "Açılışta Bulunan Sapma", row.tables, row.summary]),
          summary: [["Geri Alınan", String(rows.filter(row => row.action === "rolled-back").length)]],
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
      preset: "thisMonth",
      build(query) {
        const params = new URLSearchParams({ ...query, preset: query.preset || "thisMonth" });
        const data = overview().mizan(params);
        return {
          subtitle: [rangeText(data), data.type ? TYPE_TEXT[data.type] : "Tüm cariler", SIDE_FILTER[data.side] || ""].filter(Boolean).join(" · "),
          headers: ["Cari No", "Cari", "Tür", "Devir", "Borç", "Alacak", "Bakiye", "Durum"],
          types: ["", "", "", "money", "money", "money", "money", ""],
          rows: data.rows.map(row => [row.refNo, row.name, TYPE_TEXT[row.type] || "", money(row.opening), money(row.debit), money(row.credit), money(Math.abs(row.closing)), sideText(row.closing)]),
          summary: [["Cari Sayısı", String(data.totals.count)], ["Dönem Borç", money(data.totals.debit)], ["Dönem Alacak", money(data.totals.credit)], ["Borçlular Toplamı", money(data.totals.closingDebtor)], ["Alacaklılar Toplamı", money(data.totals.closingCreditor)]],
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
          summary: [["Cari", String(data.totals.count)], ["Borçlular", money(data.totals.debtor)], ["Alacaklılar", money(data.totals.creditor)], ["Geciken Taksit", money(data.totals.overdue)]],
        };
      },
    },
    {
      id: "cari-ekstre",
      group: "Cari",
      title: "Cari Ekstre",
      description: "Seçilen carinin tarih aralıklı ekstresi: devir satırı, hareketler ve yürüyen bakiye.",
      params: ["account", "range"],
      preset: "thisYear",
      build(query, user) {
        const range = rangeOf(query, "thisYear");
        if (!query.account) throw new HttpError(400, "Ekstresi alınacak cariyi seçin.");
        const account = accounts().detail(query.account, user);
        const result = statement(account.ledger, range);
        const mark = value => `${tl(Math.abs(value))}${value > 0.005 ? " B" : value < -0.005 ? " A" : ""}`;
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
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
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
      description: "Aralıkta her cariden alınan para: nakit / havale tahsilat, taksit tahsilatı, alınan çek / senet; toplam ve son tahsilat tarihi.",
      params: ["range", "type"],
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
        const ledgers = accounts().allLedgers();
        const list = [];
        const total = { cash: 0, plan: 0, cheque: 0, all: 0 };
        for (const account of ledgers.accounts) {
          if (query.type && TYPE_TEXT[query.type] && account.type !== query.type) continue;
          const row = { account, cash: 0, plan: 0, cheque: 0, count: 0, last: "" };
          for (const line of ledgers.lines.get(account.id) || []) {
            if (!inRange(line.date, range) || !(line.credit > 0)) continue;
            // Açılış (devir) Excel'de ödenmiş kısımdır; bu dönemin tahsilatı değildir.
            let key = "";
            if (line.kind === "in") key = "cash";
            else if (line.kind === "plan-in" && !line.opening) key = line.cheque ? "cheque" : "plan";
            else if (line.origin === "cheque" && line.kind === "credit") key = "cheque";
            if (!key) continue;
            row[key] = roundMoney(row[key] + line.credit);
            row.count += 1;
            if (line.date > row.last) row.last = line.date;
          }
          const sum = roundMoney(row.cash + row.plan + row.cheque);
          if (!(sum > 0)) continue;
          list.push({ ...row, sum });
          for (const key of ["cash", "plan", "cheque"]) total[key] = roundMoney(total[key] + row[key]);
          total.all = roundMoney(total.all + sum);
        }
        list.sort((a, b) => b.sum - a.sum || collator.compare(a.account.name, b.account.name));
        return {
          subtitle: [rangeText(range), query.type && TYPE_TEXT[query.type] ? TYPE_TEXT[query.type] : "Tüm cariler"].join(" · "),
          headers: ["Cari No", "Cari", "Nakit / Havale", "Taksit Tahsilatı", "Çek / Senet (alınan)", "Toplam", "İşlem", "Son Tahsilat"],
          types: ["", "", "money", "money", "money", "money", "number", ""],
          rows: list.map(row => [row.account.refNo || "", row.account.name, row.cash ? money(row.cash) : "", row.plan ? money(row.plan) : "", row.cheque ? money(row.cheque) : "", money(row.sum), String(row.count), dayText(row.last)]),
          summary: [["Cari", String(list.length)], ["Nakit / Havale", money(total.cash)], ["Taksit Tahsilatı", money(total.plan)], ["Çek / Senet (alınan)", money(total.cheque)], ["Toplam", money(total.all)]],
        };
      },
    },
    {
      id: "alacak-yaslandirma",
      group: "Cari",
      title: "Alacak Yaşlandırma",
      description: "Vadesi gelen alacakların (taksit ve portföydeki çek/senet) gecikme süresine göre dağılımı: 1–30, 31–60, 61–90, 90+ gün.",
      params: [],
      build() {
        const day = today();
        const rows = new Map();
        const bucket = days => (days <= 0 ? "notDue" : days <= 30 ? "b30" : days <= 60 ? "b60" : days <= 90 ? "b90" : "b90p");
        const add = (key, name, lateDays, amount) => {
          const row = rows.get(key) || { name, notDue: 0, b30: 0, b60: 0, b90: 0, b90p: 0 };
          row[bucket(lateDays)] = roundMoney(row[bucket(lateDays)] + amount);
          rows.set(key, row);
        };
        const names = new Map(store.all("SELECT id, name FROM accounts").map(row => [row.id, row.name]));
        for (const item of plans().openItems(day)) {
          const plan = store.get("SELECT account_id AS accountId FROM plans WHERE id = ?", item.ref.id);
          const key = plan?.accountId || `plan:${item.ref.id}`;
          const late = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${item.date}T00:00:00Z`)) / 86_400_000);
          add(key, names.get(plan?.accountId) || item.party, late, item.amount);
        }
        for (const flow of cheques().flows()) {
          if (flow.direction !== "in") continue;
          const cheque = store.get("SELECT account_id AS accountId FROM cheques WHERE id = ?", flow.ref.id);
          const key = cheque?.accountId || `party:${flow.party}`;
          const late = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${flow.date}T00:00:00Z`)) / 86_400_000);
          add(key, names.get(cheque?.accountId) || flow.party, late, flow.amount);
        }
        const list = [...rows.values()].map(row => ({ ...row, late: roundMoney(row.b30 + row.b60 + row.b90 + row.b90p) })).sort((a, b) => b.late - a.late || collator.compare(a.name, b.name));
        const sum = key => roundMoney(list.reduce((total, row) => total + row[key], 0));
        return {
          subtitle: `${dayText(day)} itibarıyla · taksit ve portföydeki alınan çek/senet vadelerine göre`,
          headers: ["Cari / Kişi", "Vadesi Gelmemiş", "1–30 Gün", "31–60 Gün", "61–90 Gün", "90+ Gün", "Toplam Gecikmiş", "Toplam"],
          types: ["", "money", "money", "money", "money", "money", "money", "money"],
          rows: list.map(row => [row.name, money(row.notDue), money(row.b30), money(row.b60), money(row.b90), money(row.b90p), money(row.late), money(roundMoney(row.late + row.notDue))]),
          summary: [["Vadesi Gelmemiş", money(sum("notDue"))], ["1–30 gün", money(sum("b30"))], ["31–60 gün", money(sum("b60"))], ["61–90 gün", money(sum("b90"))], ["90+ gün", money(sum("b90p"))], ["Toplam Gecikmiş", money(sum("late"))]],
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
        const range = rangeOf(query, "thisMonth");
        return installmentReport(item => inRange(item.dueDate, range), rangeText(range));
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
        };
      },
    },
    {
      id: "taksit-tahsilatlari",
      group: "Taksit",
      title: "Taksit Tahsilatları",
      description: "Aralıktaki taksit tahsilatları ve iadeler; makbuz numarası, nakit ya da çek/senetle alındığı.",
      params: ["range"],
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
        const list = store.all(
          `SELECT e.date, e.kind, e.amount, e.note, e.receipt_no AS receiptNo, e.cheque_id AS chequeId, e.opening, p.name AS planName, COALESCE(a.name, '') AS accountName, i.seq, COALESCE(u.display_name, '') AS actorName
           FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL LEFT JOIN accounts a ON a.id = p.account_id LEFT JOIN plan_items i ON i.id = e.item_id LEFT JOIN users u ON u.id = e.created_by
           WHERE (? = '' OR e.date >= ?) AND (? = '' OR e.date <= ?) ORDER BY e.date, e.created_at`,
          range.from, range.from, range.to, range.to,
        );
        // Açılış (devir, v2.0.8): programa girmeden önce ödenmiş kısım. Listede görünür, tahsilat toplamına girmez (Kasa'da yok).
        const total = { in: 0, out: 0, opening: 0 };
        for (const row of list) {
          const key = row.opening ? "opening" : row.kind;
          total[key] = roundMoney(total[key] + row.amount);
        }
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Makbuz", "Kart", "Cari", "Taksit", "Tür", "Yöntem", "Tutar", "Açıklama", "Giren"],
          types: ["", "", "", "", "", "", "", "money", "", ""],
          rows: list.map(row => [dayText(row.date), row.receiptNo ? String(row.receiptNo) : "", row.planName, row.accountName, row.seq ? `${row.seq}. taksit` : "", row.opening ? "Açılış (devir)" : row.kind === "in" ? "Tahsilat" : "İade / ödeme", row.opening ? "Excel'den" : row.chequeId ? "Çek / senet" : "Nakit / havale", money(row.amount), row.note, row.actorName]),
          summary: [["Tahsilat", money(total.in)], ["İade / Ödeme", money(total.out)], ["Net", money(roundMoney(total.in - total.out))], ...(total.opening ? [["Açılış (devir, Kasa dışı)", money(total.opening)]] : [])],
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
        const range = query.from || query.to || query.preset ? rangeOf(query, "") : { from: "", to: "" };
        const data = cheques().list(admin, { direction: ["in", "out"].includes(query.direction) ? query.direction : "", status: STATUSES[query.status] || ["open", "closed", "overdue", "soon"].includes(query.status) ? query.status : "", from: range.from, to: range.to, sort: "due" });
        return {
          subtitle: [query.direction ? DIRECTIONS[query.direction] : "Alınan ve verilen", STATUSES[query.status]?.label || "", range.from || range.to ? `vade ${rangeText(range)}` : ""].filter(Boolean).join(" · "),
          headers: ["Vade", "Yön", "Tür", "No", "Banka", "Kimden / Kime", "Durum", "Tutar"],
          types: ["", "", "", "", "", "", "", "money"],
          rows: data.cheques.map(row => [dayText(row.dueDate), row.directionLabel, row.instrumentLabel, row.serialNo, row.bank, row.status === "endorsed" ? `${row.party} → ${row.endorseAccountName}` : row.party, row.statusLabel, money(row.amount)]),
          summary: [["Listelenen", `${data.listed.count} · ${tl(data.listed.amount)}`], ["Portföyde (alınan)", tl(data.summary.in.open.amount)], ["Ödenecek (verilen)", tl(data.summary.out.open.amount)], ["Vadesi Geçmiş Alınan", tl(data.summary.in.overdue.amount)]],
        };
      },
    },
    {
      id: "cek-hareketleri",
      group: "Çek / Senet",
      title: "Çek / Senet Hareketleri",
      description: "Aralıktaki tüm evrak işlemleri: alındı, verildi, tahsil, ciro, karşılıksız, ödeme.",
      params: ["range"],
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
        const list = store.all(
          `SELECT ev.date, ev.kind, ev.amount, ev.note, c.direction, c.instrument, c.serial_no AS serialNo, c.drawer, COALESCE(a.name, '') AS accountName, COALESCE(ea.name, '') AS eventAccount, COALESCE(u.display_name, '') AS actorName
           FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id AND c.deleted_at IS NULL LEFT JOIN accounts a ON a.id = c.account_id LEFT JOIN accounts ea ON ea.id = ev.account_id LEFT JOIN users u ON u.id = ev.created_by
           WHERE (? = '' OR ev.date >= ?) AND (? = '' OR ev.date <= ?) ORDER BY ev.date, ev.created_at`,
          range.from, range.from, range.to, range.to,
        );
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Evrak", "No", "Kimden / Kime", "İşlem", "İlgili Cari", "Tutar", "Açıklama", "Giren"],
          types: ["", "", "", "", "", "", "money", "", ""],
          rows: list.map(row => [dayText(row.date), `${DIRECTIONS[row.direction]} ${INSTRUMENTS[row.instrument].toLocaleLowerCase("tr-TR")}`, row.serialNo, row.accountName || row.drawer, EVENT_LABELS[row.kind] || row.kind, row.eventAccount, money(row.amount), row.note, row.actorName]),
          summary: [["İşlem", String(list.length)]],
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
        const data = stock().list(admin, { state: ["low", "out", "product", "service"].includes(query.state) ? query.state : "all", category: limited(query.category, 80, "Kategori"), sort: "name" });
        return {
          subtitle: [{ low: "Kritik seviyedekiler", out: "Tükenenler", product: "Ürünler", service: "Hizmetler" }[query.state] || "Tüm kalemler", query.category || ""].filter(Boolean).join(" · "),
          headers: ["Kod", "Kalem", "Tür", "Kategori", "Mevcut", "Birim", "Kritik Seviye", "Birim Fiyat", "Değer", "Durum"],
          types: ["", "", "", "", "number", "", "number", "money", "money", ""],
          rows: data.items.map(item => [item.code, item.name, item.kind === "service" ? "Hizmet" : "Ürün", item.category, item.kind === "service" ? "" : qty(item.qty), item.unit, item.minQty ? qty(item.minQty) : "", money(item.unitPrice), item.kind === "service" ? "" : money(item.value), item.kind === "service" ? "Hizmet" : item.qty <= 0 ? "Tükendi" : item.low ? "Kritik" : ""]),
          summary: [["Kalem", String(data.totals.count)], ["Kritik", String(data.totals.low)], ["Tükenen", String(data.totals.out)], ["Stok Değeri", money(data.totals.value)]],
        };
      },
    },
    {
      id: "stok-hareketleri",
      group: "Stok",
      title: "Stok Hareketleri",
      description: "Aralıktaki giriş ve çıkışlar; miktar, birim fiyat, tutar ve paranın nereye yazıldığı (Kasa, cari, yok).",
      params: ["range"],
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
        const list = store.all(
          `SELECT m.date, m.kind, m.reason, m.qty, m.unit_price AS unitPrice, m.amount, m.pay, m.note, i.name, i.code, i.unit, COALESCE(a.name, '') AS accountName, COALESCE(u.display_name, '') AS actorName
           FROM stock_moves m JOIN stock_items i ON i.id = m.item_id LEFT JOIN accounts a ON a.id = m.account_id LEFT JOIN users u ON u.id = m.created_by
           WHERE (? = '' OR m.date >= ?) AND (? = '' OR m.date <= ?) ORDER BY m.date, m.created_at`,
          range.from, range.from, range.to, range.to,
        );
        const pay = { none: "Yalnız miktar", cash: "Kasa", account: "Cari" };
        const total = { in: 0, out: 0 };
        for (const row of list) total[row.kind] = roundMoney(total[row.kind] + row.amount);
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Kod", "Kalem", "Hareket", "Miktar", "Birim", "Birim Fiyat", "Tutar", "Para", "Cari", "Açıklama", "Giren"],
          types: ["", "", "", "", "number", "", "money", "money", "", "", "", ""],
          rows: list.map(row => [dayText(row.date), row.code, row.name, row.reason === "return" ? "Satış İadesi" : row.kind === "in" ? "Giriş" : "Çıkış", qty(row.qty), row.unit, money(row.unitPrice), row.amount ? money(row.amount) : "", pay[row.pay] || row.pay, row.accountName, row.note, row.actorName]),
          summary: [["Hareket", String(list.length)], ["Giriş Tutarı", money(total.in)], ["Çıkış Tutarı", money(total.out)]],
        };
      },
    },
    {
      id: "stok-ozet",
      group: "Stok",
      title: "Stok Hareket Özeti (envanter)",
      description: "Her ürün için dönem başı miktar, dönem girişi, dönem çıkışı ve dönem sonu miktar; birim fiyat ve dönem sonu değer.",
      params: ["range", "category"],
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
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
        for (const item of items) {
          const move = moves.get(item.id) || { opening: 0, qtyIn: 0, qtyOut: 0 };
          const opening = Math.round(move.opening * 1000) / 1000;
          const closing = Math.round((move.opening + move.qtyIn - move.qtyOut) * 1000) / 1000;
          if (!opening && !move.qtyIn && !move.qtyOut) continue;
          const worth = roundMoney(Math.max(0, closing) * (Number(item.unitPrice) || 0));
          value = roundMoney(value + worth);
          out.push([item.code, item.name, item.category, item.unit, qty(opening), qty(move.qtyIn), qty(move.qtyOut), qty(closing), money(item.unitPrice), money(worth)]);
        }
        return {
          subtitle: [rangeText(range), category || "Tüm kategoriler"].join(" · "),
          headers: ["Kod", "Ürün", "Kategori", "Birim", "Dönem Başı", "Giriş", "Çıkış", "Dönem Sonu", "Birim Fiyat", "Dönem Sonu Değer"],
          types: ["", "", "", "", "number", "number", "number", "number", "money", "money"],
          rows: out,
          summary: [["Ürün", String(out.length)], ["Dönem Sonu Değer", money(value)]],
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
          const group = groups.get(key) || { count: 0, low: 0, out: 0, value: 0 };
          group.count += 1;
          if (item.low) group.low += 1;
          if (item.kind !== "service" && item.qty <= 0) group.out += 1;
          group.value = roundMoney(group.value + (item.value || 0));
          groups.set(key, group);
        }
        return {
          subtitle: `${dayText(today())} itibarıyla`,
          headers: ["Kategori", "Kalem", "Kritik", "Tükenen", "Stok Değeri"],
          types: ["", "number", "number", "number", "money"],
          rows: [...groups.entries()].sort((a, b) => b[1].value - a[1].value).map(([name, group]) => [name, String(group.count), String(group.low), String(group.out), money(group.value)]),
          summary: [["Kalem", String(data.totals.count)], ["Stok Değeri", money(data.totals.value)]],
        };
      },
    },
    // ===== Kayıtlar (tablo) =====
    {
      id: "kayit-tahsilatlari",
      group: "Kayıtlar",
      title: "Kayıt Kartından Tahsilatlar",
      description: "Tablodaki kişilerin kartından girilen tahsilatlar (taksit ve cari dışındaki).",
      params: ["range"],
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
        const list = store.all(
          `SELECT p.date, p.amount, p.note, p.case_key AS caseKey, p.case_title AS caseTitle, COALESCE(u.display_name, '') AS actorName FROM payments p LEFT JOIN users u ON u.id = p.created_by
           WHERE (? = '' OR p.date >= ?) AND (? = '' OR p.date <= ?) ORDER BY p.date, p.created_at`,
          range.from, range.from, range.to, range.to,
        );
        const title = caseTitles(list.filter(row => !row.caseTitle).map(row => row.caseKey));
        const total = roundMoney(list.reduce((sum, row) => sum + row.amount, 0));
        return {
          subtitle: rangeText(range),
          headers: ["Tarih", "Kayıt", "Tutar", "Açıklama", "Giren"],
          types: ["", "", "money", "", ""],
          rows: list.map(row => [dayText(row.date), row.caseTitle || title(row.caseKey), money(row.amount), row.note, row.actorName]),
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
      preset: "thisMonth",
      build(query) {
        const range = rangeOf(query, "thisMonth");
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
  const allowed = (user, report) =>
    report.standalone ? canUser(user, report.permission) : canUser(user, "overview.view") && (!report.permission || canUser(user, report.permission));
  const enter = req => {
    const user = auth.requireUser(req);
    if (!REPORTS.some(report => allowed(user, report))) throw new HttpError(403, "Bu işlem için yetkiniz yok.", { code: "FORBIDDEN", permission: "overview.view" });
    return user;
  };
  const queryOf = params => {
    const query = {};
    for (const key of ["preset", "from", "to", "account", "type", "side", "status", "direction", "category", "state", "planStatus", "taskStatus", "tab"]) {
      const value = text(params.get(key));
      if (value) query[key] = value.slice(0, 200);
    }
    return query;
  };
  async function run(user, id, params) {
    const report = REGISTRY.get(String(id || ""));
    if (!report) throw new HttpError(404, "Rapor bulunamadı.");
    if (!allowed(user, report)) throw new HttpError(403, "Bu rapor için yetkiniz yok.");
    const query = queryOf(params);
    const result = await report.build(query, user);
    const rows = result.rows.slice(0, MAX_ROWS);
    return { id: report.id, group: report.group, title: result.title || report.title, subtitle: result.subtitle || "", headers: result.headers, types: result.types || [], rows, total: result.rows.length, summary: result.summary || [], tabs: result.tabs || null, query };
  }
  router.get("/api/workspace/report-center", async ({ req, res }) => {
    const user = enter(req);
    ok(res, {
      reports: REPORTS.filter(report => allowed(user, report)).map(({ id, group, title, description, params, preset }) => ({ id, group, title, description, params, preset: preset || "" })),
      today: today(),
    });
  });
  router.get("/api/workspace/report-center/:id", async ({ req, res, params, url }) => {
    const user = enter(req);
    const data = await run(user, params.id, url.searchParams);
    ok(res, { ...data, rows: data.rows.slice(0, PREVIEW_ROWS), total: data.total });
  });
  const fileBase = data => `${data.title.replace(/[\\/:*?"<>|]+/g, " ").trim()} ${dayText(today())}`;
  router.get("/api/workspace/report-center/:id/pdf", async ({ req, res, params, url }) => {
    const user = enter(req);
    const data = await run(user, params.id, url.searchParams);
    const clipped = data.rows.length > PDF_ROWS;
    const pdf = tablePdf({
      title: data.title,
      subtitle: [data.subtitle, clipped ? `ilk ${PDF_ROWS.toLocaleString("tr-TR")} satır (tamamı Excel'de)` : ""].filter(Boolean).join(" · "),
      headers: data.headers,
      types: data.types,
      rows: data.rows.slice(0, PDF_ROWS),
      summary: data.summary,
      officeName: office(),
      userName: user.display_name || user.username || "",
      brand: office() || "DestekOfis",
    });
    audit(user, "report.exported", data.id, { format: "pdf", rows: data.total, ...data.query });
    sendBuffer(res, pdf, { type: "application/pdf", name: `${fileBase(data)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/report-center/:id/xlsx", async ({ req, res, params, url }) => {
    const user = enter(req);
    const data = await run(user, params.id, url.searchParams);
    const unique = data.headers.map((header, index) => (data.headers.indexOf(header) === index && header ? header : `${header || "Kolon"} ${index + 1}`));
    const rows = data.rows.map(row => Object.fromEntries(unique.map((header, index) => [header, row[index] ?? ""])));
    const sheets = [{ name: data.title.slice(0, 31), columns: unique, rows }];
    if (data.summary.length) sheets.push({ name: "Özet", columns: ["Kalem", "Değer"], rows: [{ Kalem: "Rapor", Değer: data.title }, { Kalem: "Kapsam", Değer: data.subtitle }, { Kalem: "Hazırlanma", Değer: stamp(new Date().toISOString()) }, ...data.summary.map(([label, value]) => ({ Kalem: label, Değer: value }))] });
    const buffer = buildXlsx(sheets, { title: data.title });
    audit(user, "report.exported", data.id, { format: "xlsx", rows: data.total, ...data.query });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${fileBase(data)}.xlsx` });
  });

  return { reports: () => REPORTS.map(report => report.id), run };
}
