// 2.1.0 — Aşama 2, Dilim 1: iş günü servisi ve Türkiye takvimi (server/lib/business-days.mjs + server/lib/calendars/tr.mjs;
// docs/BANKA-MODULU-PLAN.md §4.5). Valör (POS geçişi), taksitli POS ödeme takvimi ve banka işlemlerinin tarih ötelemesi buradan.
//
// NASIL BOZARIM (bu testlerin kaynağı):
//   - Hafta sonu: Cuma + 2 iş günü; Cumartesi + 0; ay sonunda modified_following ayı geçmesin.
//   - Arife ve bayram: 27.10.2026 + 2 → 30.10 (28.10 yarım gün sayılır, 29.10 tatil); yarım gün sayılmazsa 02.11.
//   - Bayram tablosu yanlış yazılmış olabilir: gün adları Diyanet listesiyle, Ramazan–Kurban arası (67–70 gün) ve yıllar arası kayma
//     tutarlılık denetimiyle; tam tatil + arife çakışması (23.04.2029) tam tatil kalır.
//   - Ay sonu taksiti: 31.01 → 28/29.02, sonra yine 31.03 (28.03 değil); 29.02.2028 + 12 ay.
//   - Yıl dönümü: 31.12.2026 + 1 iş günü → 04.01.2027 (1 Ocak + hafta sonu).
//   - Geri sayma (eksi iş günü), tablonun kapsamadığı yıl (sabit tatiller sürer, kapsam uyarısı), şirketin eklediği/çıkardığı gün.
//   - Bozuk girdi: "2026-02-30", "31.12.2026", boş tarih, bilinmeyen kural, kesirli/aşırı gün sayısı, hiç iş günü olmayan
//     takvim (sonsuz döngü yerine hata).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addMonths as planAddMonths } from "../server/lib/plans.mjs";
import { addMonths, createCalendar } from "../server/lib/business-days.mjs";
import { TR_COVERAGE, TR_RELIGIOUS, createTrCalendar, trHolidays } from "../server/lib/calendars/tr.mjs";

const tr = createTrCalendar();

describe("Plandaki örnekler (§4.5, §12.5)", () => {
  it("02.10.2026 Cuma + 2 iş günü = 06.10.2026 Salı", () => {
    assert.equal(tr.addBusinessDays("2026-10-02", 2), "2026-10-06");
    assert.equal(tr.dayInfo("2026-10-02").weekdayName, "Cuma");
    assert.equal(tr.dayInfo("2026-10-06").weekdayName, "Salı");
  });
  it("27.10.2026 Salı + 2 iş günü: 28.10 yarım gün (1) → 29.10 tatil → 30.10.2026 Cuma; yarım gün sayılmazsa 02.11.2026", () => {
    assert.equal(tr.addBusinessDays("2026-10-27", 2), "2026-10-30");
    assert.equal(createTrCalendar({ halfDayIsBusiness: false }).addBusinessDays("2026-10-27", 2), "2026-11-02");
  });
  it("valör: 08.10.2026 Perşembe + 2 iş günü = 12.10.2026; açıklama İşlem Kartı biçiminde", () => {
    assert.equal(tr.valueDate("2026-10-08", "business", 2), "2026-10-12");
    const text = tr.explainValue("2026-10-08", "business", 2);
    assert.equal(text, "12.10.2026 (08.10 Perşembe + 2 iş günü)");
    assert.equal(tr.valueDate("2026-10-13", "business", 2), "2026-10-15", "iade kalemi valörü 15.10");
  });
  it("taksitli POS takvimi: 12.10.2026'dan her ay → 12.11.2026 · 14.12.2026 (12.12 Cumartesi) · 12.01.2027", () => {
    assert.deepEqual([1, 2, 3].map(k => tr.valueDate("2026-10-12", "month", k)), ["2026-11-12", "2026-12-14", "2027-01-12"]);
    assert.match(tr.explainValue("2026-10-12", "month", 2), /^14\.12\.2026 \(12\.10 Pazartesi \+ 2 ay; 12\.12\.2026 Cumartesi \(Hafta Sonu\) → sonraki iş günü\)$/);
  });
  it("tatil atlanınca açıklama nedeni söyler", () => {
    assert.equal(tr.explainValue("2026-10-27", "business", 2), "30.10.2026 (27.10 Salı + 2 iş günü; 29.10.2026 Cumhuriyet Bayramı atlandı)");
  });
});

describe("Türkiye takvimi", () => {
  it("2026 tatilleri (2429 sayılı Kanun + Diyanet): sabit günler, arifeler yarım gün, bayram günleri", () => {
    const list = trHolidays(2026);
    const full = list.filter(item => !item.half).map(item => item.date);
    const half = list.filter(item => item.half).map(item => item.date);
    assert.deepEqual(half, ["2026-03-19", "2026-05-26", "2026-10-28"]);
    assert.deepEqual(full, ["2026-01-01", "2026-03-20", "2026-03-21", "2026-03-22", "2026-04-23", "2026-05-01", "2026-05-19", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30", "2026-07-15", "2026-08-30", "2026-10-29"]);
    assert.equal(tr.dayInfo("2026-10-29").holiday.name, "Cumhuriyet Bayramı");
    assert.equal(tr.isBusinessDay("2026-10-29"), false);
    assert.equal(tr.isBusinessDay("2026-10-28"), true, "yarım gün varsayılan olarak iş günü");
    assert.equal(tr.dayInfo("2026-10-28").holiday.half, true);
    assert.equal(tr.isBusinessDay("2026-05-27"), false, "Kurban Bayramı 1. gün");
    assert.equal(tr.isBusinessDay("2026-03-20"), false, "Ramazan Bayramı 1. gün");
    assert.equal(tr.isBusinessDay("2026-10-08"), true);
    assert.equal(tr.isBusinessDay("2026-10-10"), false, "Cumartesi");
  });
  it("bayram tablosu Diyanet listesiyle aynı gün adlarında (kaynak: calendars/tr.mjs başlığı)", () => {
    const expected = {
      2024: ["Çarşamba", "Pazar"],
      2025: ["Pazar", "Cuma"],
      2026: ["Cuma", "Çarşamba"],
      2027: ["Salı", "Pazar"],
      2028: ["Cumartesi", "Cuma"],
      2029: ["Çarşamba", "Salı"],
      2030: ["Pazartesi", "Cumartesi"],
      2031: ["Cuma", "Çarşamba"],
    };
    assert.deepEqual(Object.keys(TR_RELIGIOUS).map(Number), Object.keys(expected).map(Number));
    for (const [year, [ramazanDay, kurbanDay]] of Object.entries(expected)) {
      const entry = TR_RELIGIOUS[year];
      assert.equal(tr.dayInfo(entry.ramazan).weekdayName, ramazanDay, `${year} Ramazan 1. gün`);
      assert.equal(tr.dayInfo(entry.kurban).weekdayName, kurbanDay, `${year} Kurban 1. gün`);
    }
  });
  it("tablo tutarlılığı: Ramazan → Kurban 67–70 gün (Şevval + Zilkade + 9); yıldan yıla 10–12 gün öne kayar; Ramazan 3, Kurban 4 gün + arifeler", () => {
    const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
    const years = Object.keys(TR_RELIGIOUS).map(Number);
    for (const year of years) {
      const { ramazan, kurban } = TR_RELIGIOUS[year];
      const gap = days(ramazan, kurban);
      assert.ok(gap >= 67 && gap <= 70, `${year}: Ramazan→Kurban ${gap} gün`);
      const list = trHolidays(year);
      assert.equal(list.filter(item => /^Ramazan Bayramı \d\. Gün/.test(item.name)).length, 3, `${year} Ramazan 3 gün`);
      assert.equal(list.filter(item => /Kurban Bayramı \d\. Gün/.test(item.name)).length, 4, `${year} Kurban 4 gün`);
      if (TR_RELIGIOUS[year + 1]) {
        const shift = days(TR_RELIGIOUS[year + 1].kurban, `${year + 1}${kurban.slice(4)}`);
        assert.ok(shift >= 10 && shift <= 12, `${year}→${year + 1} Kurban kayması ${shift} gün`);
      }
    }
  });
  it("tam tatil + arife çakışması (23.04.2029) tam tatil; aynı güne iki tatil (19.05.2027) iki adla", () => {
    const day = tr.dayInfo("2029-04-23");
    assert.equal(day.holiday.half, false);
    assert.match(day.holiday.name, /Ulusal Egemenlik ve Çocuk Bayramı/);
    assert.match(day.holiday.name, /Kurban Bayramı Arifesi/);
    const both = tr.dayInfo("2027-05-19").holiday.name;
    assert.match(both, /Kurban Bayramı 4\. Gün/);
    assert.match(both, /Gençlik ve Spor Bayramı/);
  });
  it("15 Temmuz 2017'den önce tatil değil; tablo dışı yılda sabit tatiller sürer ve kapsam uyarısı", () => {
    assert.equal(trHolidays(2016).some(item => item.date === "2016-07-15"), false);
    assert.equal(tr.isBusinessDay("2032-10-29"), false);
    assert.deepEqual(TR_COVERAGE, { from: 2024, to: 2031 });
    assert.equal(tr.covers(2031), true);
    assert.equal(tr.covers(2032), false);
    assert.equal(tr.needsUpdate("2030-12-31"), false);
    assert.equal(tr.needsUpdate("2031-01-02"), true, "tablonun son yılına girilince zil uyarısı");
  });
  it("şirketin eklediği (idari izin) ve çıkardığı gün", () => {
    const own = createTrCalendar({ added: [{ date: "2026-10-09", name: "İdari İzin" }], removed: ["2026-10-29"] });
    assert.equal(own.addBusinessDays("2026-10-08", 2), "2026-10-13");
    assert.equal(own.dayInfo("2026-10-09").holiday.name, "İdari İzin");
    assert.equal(own.isBusinessDay("2026-10-29"), true);
    assert.equal(own.addBusinessDays("2026-10-27", 2), "2026-10-29");
    assert.equal(tr.isBusinessDay("2026-10-29"), false, "başka takvim etkilenmez");
  });
});

describe("İş günü servisi", () => {
  it("adjust: following / modified_following / preceding / none", () => {
    assert.equal(tr.adjust("2026-10-10", "following"), "2026-10-12");
    assert.equal(tr.adjust("2026-10-10", "preceding"), "2026-10-09");
    assert.equal(tr.adjust("2026-10-31", "following"), "2026-11-02");
    assert.equal(tr.adjust("2026-10-31", "modified_following"), "2026-10-30", "ay dışına taşmaz");
    assert.equal(tr.adjust("2026-10-10", "none"), "2026-10-10");
    assert.equal(tr.adjust("2026-10-08"), "2026-10-08");
  });
  it("addBusinessDays: 0 gün (iş günü değilse sonraki), eksi gün, yıl dönümü", () => {
    assert.equal(tr.addBusinessDays("2026-10-10", 0), "2026-10-12");
    assert.equal(tr.addBusinessDays("2026-10-03", 2), "2026-10-06", "Cumartesi + 2");
    assert.equal(tr.addBusinessDays("2026-10-06", -2), "2026-10-02");
    assert.equal(tr.addBusinessDays("2026-12-31", 1), "2027-01-04");
    assert.equal(tr.addCalendarDays("2026-12-31", 1), "2027-01-01");
    assert.equal(tr.valueDate("2026-12-31", "calendar", 1), "2027-01-04", "takvim günü + sonraki iş günü");
    assert.equal(tr.valueDate("2026-10-10", "business", 0), "2026-10-12");
  });
  it("addMonths ay sonu güvenli ve taksit motorundaki addMonths ile aynı", () => {
    assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
    assert.equal(addMonths("2026-01-31", 2), "2026-03-31");
    assert.equal(addMonths("2028-02-29", 12), "2029-02-28");
    assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
    assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
    for (let y = 2024; y <= 2032; y += 1) {
      for (let m = 1; m <= 12; m += 1) {
        for (const d of [1, 15, 28, 29, 30, 31]) {
          const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          if (Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) || new Date(`${iso}T00:00:00Z`).getUTCDate() !== d) continue;
          for (const k of [-13, -1, 1, 2, 3, 6, 12, 24]) assert.equal(addMonths(iso, k), planAddMonths(iso, k), `${iso} ${k}`);
        }
      }
    }
  });
  it("genel takvim: başka hafta sonu (Cuma–Cumartesi) ve tatilsiz", () => {
    const gulf = createCalendar({ weekend: [5, 6] });
    assert.equal(gulf.isBusinessDay("2026-10-09"), false, "Cuma");
    assert.equal(gulf.isBusinessDay("2026-10-11"), true, "Pazar");
    assert.equal(gulf.addBusinessDays("2026-10-08", 1), "2026-10-11");
  });
  it("explain: gün türü ve nedeni", () => {
    assert.equal(tr.explain("2026-10-29"), "29.10.2026 Perşembe: Resmî Tatil (Cumhuriyet Bayramı)");
    assert.equal(tr.explain("2026-10-28"), "28.10.2026 Çarşamba: Yarım Gün (Cumhuriyet Bayramı Arifesi; iş günü sayılır)");
    assert.equal(tr.explain("2026-10-10"), "10.10.2026 Cumartesi: Hafta Sonu");
    assert.equal(tr.explain("2026-10-08"), "08.10.2026 Perşembe: İş Günü");
  });
});

describe("İş günü servisi — nasıl bozarım", () => {
  it("geçersiz tarih, kural ve gün sayısı RangeError (sessizce düzeltilmez)", () => {
    for (const bad of ["2026-02-30", "31.12.2026", "", null, undefined, "2026-13-01", "2026-1-5", 20261008]) {
      assert.throws(() => tr.isBusinessDay(bad), RangeError, String(bad));
      assert.throws(() => tr.addBusinessDays(bad, 1), RangeError, String(bad));
      assert.throws(() => addMonths(bad, 1), RangeError, String(bad));
    }
    assert.throws(() => tr.adjust("2026-10-10", "sonraki"), RangeError);
    assert.throws(() => tr.valueDate("2026-10-10", "hafta", 1), RangeError);
    assert.throws(() => tr.addBusinessDays("2026-10-10", 1.5), RangeError);
    assert.throws(() => tr.addBusinessDays("2026-10-10", 100_000), RangeError);
    assert.throws(() => addMonths("2026-10-10", 0.5), RangeError);
    assert.throws(() => createTrCalendar({ added: [{ date: "2026-02-30" }] }), RangeError);
    assert.throws(() => createCalendar({ weekend: [7] }), RangeError);
  });
  it("hiç iş günü kalmayan takvim sonsuz döngüye girmez", () => {
    const added = [];
    for (let i = 0; i < 400; i += 1) added.push({ date: addDays("2026-10-01", i), name: "Kapalı" });
    const closed = createTrCalendar({ added });
    assert.throws(() => closed.adjust("2026-10-02", "following"), RangeError);
    assert.throws(() => closed.addBusinessDays("2026-10-02", 1), RangeError);
  });
});

function addDays(iso, n) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
