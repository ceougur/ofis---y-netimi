import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeColumns } from "../server/lib/insight/columns.mjs";
import { computeDeadlines } from "../server/lib/insight/dues.mjs";
import { dateMeaning } from "../server/lib/insight/temporal.mjs";

// Tarih anlamı (v2.0.2): başlığın niteliği + konusu + değerlerin bugüne göre dağılımı. Tüm sektörler aynı kuralla.
describe("tarih kolonunun anlamı", () => {
  const cases = [
    // [başlık, ileri tarih oranı, beklenen anlam]
    // Bitiş / son gün: nitelik yeterli, dağılım fark etmez.
    ["Sigorta Bitiş", 0.1, "expiry"],
    ["Ehliyet Geçerlilik Tarihi", 0.9, "expiry"],
    ["Güzergâh İzni Vize", 0.5, "expiry"],
    ["Vade Tarihi", 0.2, "expiry"],
    ["Başvuru Son Tarihi", 0.3, "expiry"],
    ["Poliçe Yenileme", 0.8, "expiry"],
    ["Ödeme Sözü", 0.5, "expiry"],
    ["Sözleşme Bitiş", 0.7, "expiry"],
    ["Sonraki Muayene", 0.0, "expiry"],
    // Belge konusu, niteliksiz: veri karar verir.
    ["Muayene Tarihi", 0.05, "record"], // klinik: muayene olduğu gün
    ["Muayene Tarihi", 0.8, "expiry"], // araç listesi: sıradaki muayene
    ["Kasko", 0.7, "expiry"],
    ["Kalibrasyon Tarihi", 0.1, "record"],
    ["Aşı Tarihi", 0.9, "expiry"],
    // Planlı tarihler.
    ["Randevu", 0.6, "schedule"],
    ["Duruşma Tarihi", 0.1, "schedule"],
    ["Sınav Tarihi", 0.9, "schedule"],
    ["Teslim Tarihi", 0.5, "schedule"],
    ["Kontrol Tarihi", 0.7, "schedule"],
    // Kayıt / olay tarihleri (hiç uyarı üretmez).
    ["Kayıt Tarihi", 0.9, "record"],
    ["Üyelik Başlangıç", 0.9, "record"],
    ["Üyelik Tarihi", 0.9, "record"],
    ["İşe Giriş Tarihi", 0.8, "record"],
    ["Fatura Tarihi", 0.1, "record"],
    ["Son Görüşme", 0.0, "record"],
    ["Yapılan Muayene", 0.9, "record"],
    ["Haciz Tarihi", 0.8, "record"],
    ["Kaza Tarihi", 0.7, "record"],
    ["Sipariş Tarihi", 0.4, "record"],
    ["Doğum Tarihi", 0.0, "birth"],
    // Başlık ileriye dönük anlam taşımıyorsa uyarı yok (değerler ileride olsa bile); geçmiş tarihliyse olay tarihi.
    ["Tarih", 0.9, "other"],
    ["Görüşme Tarihi", 0.8, "other"],
    ["Tarih", 0.1, "record"],
    ["Mülakat Tarihi", 0.8, "schedule"],
    // Türkçe ekler: "-dığı / -mış" geçmiş, "-acak / -eceği" ileri.
    ["Yapıldığı Tarih", 0.9, "record"],
    ["Ödendiği Gün", 0.9, "record"],
    ["Tamamlanmış", 0.8, "record"],
    ["Teslim Edilen", 0.9, "record"],
    ["Yenilenecek Tarih", 0.0, "expiry"],
    ["Poliçe Biteceği", 0.0, "expiry"],
    ["Ödeme Yapılacak", 0.1, "schedule"],
    ["Planlanmış Ziyaret", 0.0, "schedule"],
    ["Hatırlatma", 0.3, "schedule"],
    ["Muayene Tarihi", 0.5, "record"],
  ];
  for (const [column, futureRate, expected] of cases) {
    it(`${column} (ileri %${Math.round(futureRate * 100)}) → ${expected}`, () => {
      assert.equal(dateMeaning(column, futureRate).meaning, expected);
    });
  }

  it("kolon analizi anlamı değerlerden hesaplar ve gerekçesini yazar", () => {
    const now = new Date(2026, 8, 27);
    const rows = Array.from({ length: 12 }, (_, i) => ({ "MUAYENE TARİHİ": `${String(1 + i).padStart(2, "0")}.09.2026`, RANDEVU: `${String(1 + i).padStart(2, "0")}.10.2026`, "ARAÇ MUAYENE": `${String(1 + i).padStart(2, "0")}.11.2026` }));
    const byColumn = Object.fromEntries(analyzeColumns(rows, Object.keys(rows[0]), { now }).map(item => [item.column, item]));
    assert.equal(byColumn["MUAYENE TARİHİ"].meaning, "record");
    assert.equal(byColumn["MUAYENE TARİHİ"].kind, "event");
    assert.match(byColumn["MUAYENE TARİHİ"].meaningReason, /yapıldığı gün/);
    assert.equal(byColumn.RANDEVU.meaning, "schedule");
    assert.equal(byColumn["ARAÇ MUAYENE"].meaning, "expiry");
  });
});

describe("yaklaşan ve geçen işler bildirimleri tarih anlamına göre", () => {
  const now = new Date(2026, 8, 27, 10);
  const pad = n => String(n).padStart(2, "0");
  // Klinik: muayene olduğu gün (geçmiş) + sonraki randevu.
  const clinic = Array.from({ length: 18 }, (_, i) => ({ __hofKey: `H-${1001 + i}`, __sheet: "Hastalar", "HASTA NO": `H-${1001 + i}`, "AD SOYAD": `Hasta ${i + 1}`, "MUAYENE TARİHİ": `${pad(11 + i)}.09.2026`, RANDEVU: i < 3 ? `${28 + i}.09.2026` : `${pad(i - 2)}.10.2026` }));

  it("klinik: muayene günü hiç bildirilmez; randevu yalnız yaklaşırken (planlı tarih) bildirilir", () => {
    const items = computeDeadlines({ rows: clinic, tabs: ["Hastalar"], now });
    assert.ok(!items.some(item => item.label === "MUAYENE TARİHİ"), "muayene günü 'süresi geçti' değildir");
    assert.ok(items.length > 0 && items.every(item => item.label === "RANDEVU" && item.type === "event" && item.days >= 0 && item.days <= 7));
  });

  it("geçmiş randevu 'süresi geçti' diye bildirilmez; geçmiş belge bitişi bildirilir", () => {
    const rows = [
      { __hofKey: "a", __sheet: "Liste", Ad: "Ali", Randevu: "20.09.2026", "Sigorta Bitiş": "20.09.2026" },
      { __hofKey: "b", __sheet: "Liste", Ad: "Ayşe", Randevu: "21.09.2026", "Sigorta Bitiş": "10.12.2026" },
      { __hofKey: "c", __sheet: "Liste", Ad: "Can", Randevu: "22.09.2026", "Sigorta Bitiş": "10.12.2026" },
    ];
    const items = computeDeadlines({ rows, tabs: ["Liste"], now });
    assert.deepEqual(items.map(item => [item.label, item.type, item.days]), [["Sigorta Bitiş", "expiry", -7]]);
  });

  it("satır bağlamı: durum, evet/hayır kolonu ve aynı konuda daha yeni tarih uyarıyı susturur", () => {
    const base = { __sheet: "Araçlar" };
    const rows = [
      { ...base, __hofKey: "1", Plaka: "34 AB 101", Şoför: "Ali", "Muayene Bitiş": "20.09.2026", "Sigorta Bitiş": "29.09.2026", "Kasko Bitiş": "30.09.2026", "Sigorta yenilendi mi?": "Evet", "Yapılan Muayene": "22.09.2026", Durum: "Aktif" },
      { ...base, __hofKey: "2", Plaka: "34 AB 102", Şoför: "Ayşe", "Muayene Bitiş": "21.09.2026", "Sigorta Bitiş": "28.09.2026", "Kasko Bitiş": "01.10.2026", "Sigorta yenilendi mi?": "Hayır", "Yapılan Muayene": "", Durum: "Aktif" },
      { ...base, __hofKey: "3", Plaka: "34 AB 103", Şoför: "Can", "Muayene Bitiş": "22.09.2026", "Sigorta Bitiş": "28.09.2026", "Kasko Bitiş": "01.10.2026", "Sigorta yenilendi mi?": "", "Yapılan Muayene": "", Durum: "Satıldı - iptal" },
    ];
    const items = computeDeadlines({ rows, tabs: ["Araçlar"], now });
    const of = plate => items.filter(item => item.person === plate).map(item => item.label).sort();
    assert.deepEqual(of("34 AB 101"), ["Kasko Bitiş"], "sigorta yenilendi, muayene süresinden sonra yapıldı");
    assert.deepEqual(of("34 AB 102"), ["Kasko Bitiş", "Muayene Bitiş", "Sigorta Bitiş"]);
    assert.deepEqual(of("34 AB 103"), [], "durumu iptal olan araçtan uyarı yok");
  });

  it("satır bağlamı: ileri tarihli yeni bitiş varsa eski bitiş 'süresi geçti' sayılmaz", () => {
    const rows = [
      { __sheet: "Poliçeler", __hofKey: "a", Sigortalı: "Ali", "Eski Poliçe Bitiş": "15.09.2026", "Poliçe Bitiş": "15.09.2027" },
      { __sheet: "Poliçeler", __hofKey: "b", Sigortalı: "Veli", "Eski Poliçe Bitiş": "16.09.2026", "Poliçe Bitiş": "" },
      { __sheet: "Poliçeler", __hofKey: "c", Sigortalı: "Can", "Eski Poliçe Bitiş": "10.08.2026", "Poliçe Bitiş": "10.08.2027" },
    ];
    const items = computeDeadlines({ rows, tabs: ["Poliçeler"], now });
    assert.deepEqual(items.map(item => item.person), ["Veli"]);
  });
});
