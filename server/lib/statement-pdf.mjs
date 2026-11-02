// Dönemli cari ekstre (2.4.8 W3; docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W3): ANLIK DURUM → Rapor Al → Cari Ekstre PDF'inin üreticisi tek yerde.
// Önceden routes/overview.mjs içindeydi (ekstre + ekstreRows + tablePdf çağrısı); davranış AYNEN taşındı (fark testi: test/ekstre-pdf-fark-248.test.mjs —
// eski ve yeni üretici aynı girdide bayt bayt aynı PDF). Aynı üreticiyi üç yol kullanır: ANLIK DURUM ekstresi (overview.mjs), WhatsApp'ın wa.me yolundaki
// "Cari Ekstre - PDF" (accounts.mjs, seçilen dönemle) ve WhatsApp Business API'ye yüklenen ekstre (lib/whatsapp/queue.mjs). Metin (ileti değişkenleri) ile
// PDF aynı cari okumasından ve aynı dönemden üretilir (ekran/PDF kuralı).
//
// Dönem: { from, to } (YYYY-AA-GG). Başlangıç boşsa "Tüm Hareketler" (WhatsApp penceresinin "Tüm Hareketler" seçeneği: ilk hareketten bitiş gününe — bugün;
// ileri tarihli hareket girmez, plan §7a madde 22); ANLIK DURUM her zaman iki tarihle çağırır (rangeOf), davranışı değişmez.
import { isAllTimeStart, statement } from "./finance-report.mjs";
import { dayText } from "./plans.mjs";
import { tablePdf, tl } from "./report-pdf.mjs";

export const sideText = value => (value > 0.005 ? "Borçlu" : value < -0.005 ? "Alacaklı" : "Kapalı");
const mark = value => (value > 0.005 ? " B" : value < -0.005 ? " A" : "");
const everything = ({ from, to }) => !from && !to;

/** Dönem yardımcıları (bugün: YYYY-AA-GG). */
export function statementRange(today) {
  const allTime = from => isAllTimeStart(from, today);
  const rangeText = range =>
    everything(range) ? "Tüm Hareketler" : !range.from ? `Tüm Hareketler · ${dayText(range.to)} tarihine kadar` : allTime(range.from) ? `Tüm Zamanlar · ${range.to ? dayText(range.to) : "bugün"} tarihine kadar` : `${dayText(range.from)} – ${range.to ? dayText(range.to) : "…"}`;
  const fileRange = ({ from, to }) => `${from && !allTime(from) ? dayText(from) : "baslangic"}-${to ? dayText(to) : "bugun"}`;
  const openingDay = from => (allTime(from) ? "" : dayText(from));
  return { allTime, rangeText, fileRange, openingDay };
}

/** Cari detayından (routes/accounts.mjs detail) dönemli ekstre verisi: devir + dönem hareketleri + dönem sonu bakiye. */
export function statementData(account, range) {
  const result = statement(account.ledger || [], range);
  return { from: range.from || "", to: range.to || "", account: { id: account.id, refNo: account.refNo, name: account.name, type: account.type, phone: account.phone }, ...result };
}

export const statementRows = (data, openingDay) => [
  [openingDay(data.from), "Devir", "Dönem başı bakiye", "", "", tl(Math.abs(data.opening)) + mark(data.opening)],
  ...data.lines.map(line => [dayText(line.date), line.label, [line.note, line.receiptNo ? `Makbuz ${line.receiptNo}` : ""].filter(Boolean).join(" · "), line.debit ? tl(line.debit) : "", line.credit ? tl(line.credit) : "", tl(Math.abs(line.balance)) + mark(line.balance)]),
];

/**
 * Ekstre PDF'i (Buffer). options: today (YYYY-AA-GG), now (Date; PDF'in üretim zamanı), userName, header (lib/report-header.mjs pdf() çıktısı).
 */
export function statementPdf(data, { today, now, userName = "", header = {} }) {
  const { rangeText, openingDay } = statementRange(today);
  return tablePdf({
    now,
    title: `Cari Ekstre · ${data.account.name}`,
    subtitle: [data.account.refNo ? `Cari No ${data.account.refNo}` : "", rangeText(data), "B: borçlu · A: alacaklı"].filter(Boolean).join(" · "),
    headers: ["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"],
    types: ["", "", "", "money", "money", "money"],
    rows: statementRows(data, openingDay),
    summary: [["Devir", tl(data.opening)], ["Dönem Borç", tl(data.debit)], ["Dönem Alacak", tl(data.credit)], ["Dönem Sonu Bakiye", `${tl(Math.abs(data.closing))} ${sideText(data.closing)}`]],
    footer: [dayText(data.to), "TOPLAM", "Dönem sonu", tl(data.debit), tl(data.credit), tl(Math.abs(data.closing)) + mark(data.closing)],
    userName,
    ...header,
  });
}

/** İndirme / belge adı: "Ekstre <Ad> <dönem>.pdf" (Türkçe karakter korunur). */
export const statementFileName = (data, today) => `Ekstre ${data.account.name} ${statementRange(today).fileRange(data)}.pdf`;
