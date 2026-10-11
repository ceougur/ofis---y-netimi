// Türkiye takvimi (v2.1.0, banka modülü; docs/BANKA-MODULU-PLAN.md §4.5). İş günü servisi (business-days.mjs) bunu kullanır.
//
// KAYNAKLAR
//   · Sabit tatiller ve yarım günler: 2429 sayılı Ulusal Bayram ve Genel Tatiller Hakkında Kanun (1 Ocak; 23 Nisan; 1 Mayıs —
//     2009'dan; 19 Mayıs; 15 Temmuz — 2017'den, 6752 sayılı Kanun; 30 Ağustos; 29 Ekim tam gün; 28 Ekim saat 13.00'ten itibaren
//     yarım gün). Ramazan Bayramı 3 gün, Kurban Bayramı 4 gün; arifeleri saat 13.00'ten itibaren yarım gün.
//   · Dini bayram günleri: Diyanet İşleri Başkanlığı, Vakit Hesaplama "Dini Günler Listesi" sayfaları
//     (vakithesaplama.diyanet.gov.tr/icerik.php — 2026: icerik=153, 2027: 154, 2028: 185, 2029: 186, 2030: 187, 2031: 188;
//     08.10.2026'da okundu). 2024 ve 2025 gerçekleşen bayram günleridir. Diyanet listesi hesaplanmış takvimdir; resmî tarih o yıl
//     ilanla kesinleşir — fark olursa şirket Banka Ayarları'ndan günü ekler/çıkarır (bank_holidays) ve tablo güncellenir.
//   · Tablo dışı yılda sabit tatiller sürer; dini bayramlar bilinmez (covers(yıl) false). Tablonun son yılına girilince
//     needsUpdate(bugün) true → yöneticiye zil uyarısı (tabloyu güncelleyin).
//   · Bankalar idari izin (köprü) günlerinde açıktır; bu günler tatil sayılmaz (şirket isterse ekler).
import { addCalendarDays, createCalendar } from "../business-days.mjs";

/** Dini bayramların 1. günleri (yıl → { ramazan, kurban }); arife bir önceki gün. */
export const TR_RELIGIOUS = Object.freeze({
  2024: Object.freeze({ ramazan: "2024-04-10", kurban: "2024-06-16" }),
  2025: Object.freeze({ ramazan: "2025-03-30", kurban: "2025-06-06" }),
  2026: Object.freeze({ ramazan: "2026-03-20", kurban: "2026-05-27" }),
  2027: Object.freeze({ ramazan: "2027-03-09", kurban: "2027-05-16" }),
  2028: Object.freeze({ ramazan: "2028-02-26", kurban: "2028-05-05" }),
  2029: Object.freeze({ ramazan: "2029-02-14", kurban: "2029-04-24" }),
  2030: Object.freeze({ ramazan: "2030-02-04", kurban: "2030-04-13" }),
  2031: Object.freeze({ ramazan: "2031-01-24", kurban: "2031-04-02" }),
});
const years = Object.keys(TR_RELIGIOUS).map(Number);
export const TR_COVERAGE = Object.freeze({ from: Math.min(...years), to: Math.max(...years) });

// [ay-gün, ad, ilk yıl, yarım gün]
const FIXED = [
  ["01-01", "Yılbaşı", 0, false],
  ["04-23", "Ulusal Egemenlik ve Çocuk Bayramı", 0, false],
  ["05-01", "Emek ve Dayanışma Günü", 2009, false],
  ["05-19", "Atatürk'ü Anma, Gençlik ve Spor Bayramı", 0, false],
  ["07-15", "Demokrasi ve Millî Birlik Günü", 2017, false],
  ["08-30", "Zafer Bayramı", 0, false],
  ["10-28", "Cumhuriyet Bayramı Arifesi", 0, true],
  ["10-29", "Cumhuriyet Bayramı", 0, false],
];

function feast(first, name, days) {
  const out = [{ date: addCalendarDays(first, -1), name: `${name} Arifesi`, half: true }];
  for (let i = 0; i < days; i += 1) out.push({ date: addCalendarDays(first, i), name: `${name} ${i + 1}. Gün`, half: false });
  return out;
}

/** Yılın tatilleri (tarih sırası; aynı güne düşenler takvimde birleşir). */
export function trHolidays(year) {
  const list = FIXED.filter(([, , since]) => year >= since).map(([md, name, , half]) => ({ date: `${year}-${md}`, name, half }));
  // Bayram yıl dönümünü aşabilir (ör. arife önceki yılın son günü); her yılın bayramı komşu yıllarda da aranır.
  for (const y of [year - 1, year, year + 1]) {
    const entry = TR_RELIGIOUS[y];
    if (!entry) continue;
    for (const item of [...feast(entry.ramazan, "Ramazan Bayramı", 3), ...feast(entry.kurban, "Kurban Bayramı", 4)]) if (item.date.startsWith(`${year}-`)) list.push(item);
  }
  return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Türkiye takvimi: hafta sonu Cumartesi–Pazar, 2429 sayılı Kanun tatilleri, Diyanet bayram tablosu, yarım gün iş günü. */
export function createTrCalendar({ halfDayIsBusiness = true, added = [], removed = [], weekend = [6, 0] } = {}) {
  return createCalendar({ weekend, holidays: trHolidays, halfDayIsBusiness, added, removed, coverage: TR_COVERAGE });
}
