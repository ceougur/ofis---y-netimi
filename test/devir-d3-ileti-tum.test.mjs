// 2.5.1 D3 TUR 4 — İLETİ EKSİKLERİ (kâhin ↔ plan karşılaştırması §9 — BAŞ MİMAR KARARI 27.11) + DEVİR NEDEN DURDU (KULLANICI 27.11.2026 11:39 UTC, AYNEN: "devir yapılırken bir sebeple
// duruyorya, nedenini kullanıcıya açıkça türkçe yazsın program, önerilerine ek olarak bunuda uygula."): programın ÜRETEBİLDİĞİ her neden (ön denetimin bütün maddeleri, planın bütün sorun
// türleri, bütün değişmezler, ön izlemenin redleri, beklenmeyen hata, ön izleme bayatladı) en az bir kez üretilir ve dört alanı temiz çıkar: iç kod / İngilizce / alan adı / TABLO ADI yok
// (tablo adları şemanın sınıf listesinden — server/lib/devir/plan-reader.mjs DEVIR_TABLE_CLASSES), nedenin "ne yapmalı"sı adım adım. Kaynak taraması: kaynaktaki her neden kodu bu testte
// üretilmiş olmalı (yeni neden eklenip iletisi sınanmazsa test kırılır); planın / okuyucunun her sorun türünün KENDİ iletisi olmalı (varsayılan "beklenmeyen tutarsızlık" iletisine düşmesin).
// Olgu düzeyinde (program tutarlı veride çoğunu üretmez); API ile üretilenler devir-d3-ileti / -olgu / -kural / -wa / -ikinci / -stok testlerinde.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { katalogaYaz } from "./fixtures/devir-d3-ileti-katalog.mjs";

const iletiModule = await import("../server/lib/devir/iletiler.mjs").catch(() => null);
const preflightModule = await import("../server/lib/devir/preflight.mjs").catch(() => null);
const readerModule = await import("../server/lib/devir/plan-reader.mjs").catch(() => null);
const K = "2026-12-31";
const source = file => readFileSync(new URL(`../server/lib/devir/${file}`, import.meta.url), "utf8");
const lines = text => text.split(/\r?\n/);

// Bütün nedenleri tetikleyen olgular (iki koşu: kural farkının iki dalı birbirini dışlar).
const FACTS = {
  K,
  devirYillari: { dosya: [{ yil: "2026", tarih: "2027-01-05T10:00:00.000Z" }, { yil: "2025", tarih: "" }], kayit: [{ yil: "2026", dosyaVar: false }, { yil: "2027", dosyaVar: true }] },
  eBelgeBekleyen: { adet: 2, ornek: [{ number: "TEA2026000000001", cari: "Ayşe Demir", date: "2026-12-31", tutarMinor: 120000 }, { number: "", cari: "Ayşe Demir", date: "2026-12-30", tutarMinor: 60000 }] },
  eBelgeListedenSilinen: { adet: 1, ornek: [{ number: "FIS2026000000001", cari: "Ayşe Demir", date: "2026-12-31", tutarMinor: 120000 }] },
  eBelgeBelirsiz: { adet: 1, ornek: [{ number: "EAR2026000000003", cari: "Ayşe Demir", date: "2026-12-31", tutarMinor: 120000 }] },
  taslakFatura: { adet: 1, ornek: [{ number: "", cari: "Ayşe Demir", date: "2026-12-15", tutarMinor: 120000 }] },
  bankaIsi: { adet: 1, enEski: "2026-12-31" },
  defterMutabakati: { ok: false, dengeli: false, farklar: [{ hesap: "120", fark: 5 }] },
  acilisOlabilir: { adet: 1 },
  kuralFarki: {
    dondurmaSuruyor: true, satir: 1, altDefter: 2, tutarMinor: 300000, kilit: K, kapsam: K, fisTarihi: "2027-01-01", kaynakSayisi: 2, kOncesiFark: true,
    fisSatirlari: [{ hesap: "600", alt: "", borc: 300000, alacak: 0 }],
    altDefterSatirlari: [{ hesap: "120", alt: "", cari: "c1", cariAd: "Kural Müşterisi", minor: 400000 }, { hesap: "128", alt: "", cari: "c1", cariAd: "Kural Müşterisi", minor: -400000 }],
    eskiYil: { fisTarihi: K, tutarMinor: 300000, karEtkisiMinor: -300000, satirlar: [] },
    yeniYilFisleri: [{ kimlik: "v1", no: "2027/1", tarih: "2027-01-02", tutarMinor: 300000 }],
  },
  aralikMahsubu: { ay: "2026-12", yapildi: false },
  iceAktarma: { adet: 1 },
  gelenKutusu: { adet: 1 },
  iptalSuresi: { adet: 1 },
  whatsapp: { isSayisi: 2, suren: 1, duraklatilmis: 1, kisiSayisi: 3, sinirda: 1 },
};
const PROBLEMS = [
  { kod: "yil-kapanmis", yil: "2026" },
  { kod: "donem-sonucu-farki", yil: "2026", beklenenMinor: 120000, bulunanMinor: 100000 },
  { kod: "onceki-yil-dengesiz", yil: "2025", farkMinor: -5000 },
  { kod: "sonuc-hesabi-kaldi", hesaplar: [{ hesap: "600", minor: -1500 }, { hesap: "770", minor: 200 }] },
  { kod: "yedi-sinifi-kaldi", hesap: "760", alt: "", minor: 300 },
  ...["100", "101", "102", "120", "127", "128", "153", "321"].map(hesap => ({ kod: "modul-farki", hesap, alt: "", cari: hesap === "120" ? "c1" : hesap === "127" ? "plan:p1" : "", beklenenMinor: 400000, bulunanMinor: 0 })),
  { kod: "cari-satir-farki", cari: "c1", hesap: "120", beklenenMinor: 70000, bulunanMinor: 50000 },
  { kod: "supheli-farki", cari: "c1", hesap: "128", beklenenMinor: 50000, bulunanMinor: 0 },
  { kod: "supheli-farki", cari: "", hesap: "129", beklenenMinor: -50000, bulunanMinor: 0 },
  { kod: "siniflandirilmamis-tablo", tablo: "integrity_log_v20" },
  { kod: "bilinmeyen-sorun" },
];
const INVARIANTS = ["donem-sonucu", "onceki-yillar", "stok-dss", "stok-acilis", "sonuc-sifir", "gecici-hesap", "denge", "vergi-190", "vergi-191", "vergi-193", "vergi-360", "vergi-391", "bilinmeyen-degismez"]
  .map(kod => ({ kod, ad: kod, ok: false, beklenenMinor: 100000, bulunanMinor: 90000 }))
  .concat([{ kod: "stok-urun", ad: "Her Ürün", ok: false, beklenenMinor: 0, bulunanMinor: 1, urunler: [{ urun: "u1", kod: "U1", ad: "Kalem", birim: "Adet", arsivMiktar: 6, arsivDegerMinor: 30000, acilisMiktar: 7, acilisDegerMinor: 35000 }] }]);
const PLAN = { meta: { K }, sorunlar: PROBLEMS, degismezler: INVARIANTS, newYear: { sablonlar: [{ tekrar: "r1" }], kasa: { minor: -10000 } }, sayilar: { stok: { eksi: 1 } } };

function allMessages() {
  const names = new Map([["c1", "Kural Müşterisi"]]);
  const run = facts => preflightModule.devirPreflight(facts, PLAN, { isRoot: true, today: "2027-01-10", names });
  const a = run(FACTS);
  const b = run({ ...FACTS, kuralFarki: { ...FACTS.kuralFarki, fisTarihi: K, kOncesiFark: false, yeniYilFisleri: [] } });
  const extra = [
    ...["DEVIR_K_31_ARALIK", "DEVIR_K_GELECEK", "DEVIR_SECENEK"].map(code => iletiModule.onIzlemeReddiIletisi(code, { cutoff: "2026-06-30", today: "2027-01-10" })),
    iletiModule.beklenmeyenHataIletisi(),
    // Tur 4'ün yeni iletisi (eski kodda yok — eski kodda kırmızının nedeni öbür iddialardan okunsun diye kapı değil).
    ...(iletiModule.onIzlemeBayatIletisi ? [iletiModule.onIzlemeBayatIletisi({ onIzlemeAni: "2027-01-05T10:15:00.000Z" })] : []),
  ];
  return { a, b, all: [...a.durdurur, ...a.uyarir, ...b.durdurur, ...extra] };
}

describe("D3 tur 4 — her neden üretilir ve dört alanı temiz (iç kod / İngilizce / alan adı / tablo adı yok)", () => {
  it("bütün ön denetim maddeleri + bütün plan sorunları + bütün değişmezler + redler: dört alan, yasak kalıp yok, tablo adı yok, adımlar var", () => {
    assert.ok(iletiModule && preflightModule && readerModule?.DEVIR_TABLE_CLASSES, "ileti düzeni yok (eski kod)");
    const { all } = allMessages();
    const tables = new RegExp(`\\b(${Object.keys(readerModule.DEVIR_TABLE_CLASSES).join("|")})\\b`);
    for (const ileti of all) {
      assert.deepEqual(iletiModule.iletiDenetimi(ileti), [], `${ileti.kod}: yasak kalıp`);
      for (const [alan, value] of Object.entries({ baslik: ileti.baslik, neOldu: ileti.neOldu, neden: ileti.neden, metin: ileti.metin, ekran: ileti.nereye?.ekran, ...Object.fromEntries(ileti.neYapmali.map((step, index) => [`adim${index + 1}`, step])) })) {
        assert.equal(tables.test(String(value)), false, `${ileti.kod} ${alan}: tablo adı — ${value}`);
      }
      assert.ok(ileti.neYapmali.length >= 1, `${ileti.kod}: ne yapmalı`);
      katalogaYaz("devir-d3-ileti-tum", "olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027)", ileti, "olgu (program tutarlı veride çoğunu üretmez)");
    }
  });

  it("kâhin ↔ plan karşılaştırması §9'un EKSİK maddeleri tamam: plan sorunlarında adım adım + Ön İzleme'yi yeniden başlat; tutar yönüyle; modülün adı; şüphelide Şüpheli Alacaklar", () => {
    assert.ok(iletiModule && preflightModule, "ileti düzeni yok (eski kod)");
    const { a } = allMessages();
    const byKod = new Map();
    for (const row of a.durdurur) if (!byKod.has(row.kod)) byKod.set(row.kod, row);
    for (const kod of ["plan-donem-sonucu-farki", "plan-onceki-yil-dengesiz", "plan-sonuc-hesabi-kaldi", "plan-yedi-sinifi-kaldi", "plan-modul-farki", "plan-cari-satir-farki", "plan-supheli-farki", "plan-siniflandirilmamis-tablo", "plan-bilinmeyen-sorun", "degismez-stok-dss", "degismez-denge"]) {
      const row = byKod.get(kod);
      assert.ok(row, `${kod} üretilmedi`);
      assert.ok(row.neYapmali.length >= 2, `${kod}: en az iki adım`);
      assert.ok(row.neYapmali.some(step => /Ön İzleme'yi yeniden başlatın/.test(step)), `${kod}: Ön İzleme'yi yeniden başlat adımı`);
    }
    assert.match(byKod.get("plan-sonuc-hesabi-kaldi").neOldu, /600 Yurt İçi Satışlar \(Stok\) alacak yönünde 15,00 TL ve 770 .* borç yönünde 2,00 TL/);
    assert.doesNotMatch(byKod.get("plan-onceki-yil-dengesiz").neOldu, /-\d/, "eksi işaretli tutar yok");
    const modules = a.durdurur.filter(row => row.kod === "plan-modul-farki").map(row => /TL, (.+?) açılışında/.exec(row.neOldu)?.[1]);
    assert.deepEqual(modules, ["Kasa'nın", "Çek / Senet'in", "Banka'nın", "Cari'nin", "taksit kartlarının", "Şüpheli Alacaklar'ın", "Stok'un", "Çek / Senet'in"]);
    assert.equal(byKod.get("plan-supheli-farki").nereye.ekran, "Cari › Şüpheli Alacaklar");
    assert.equal(byKod.get("degismez-stok-dss").nereye.ekran, "Stok");
    assert.match(byKod.get("banka-isi").neOldu, /en eskisinin tarihi 31\.12\.2026/);
    assert.ok(byKod.get("defter-mutabakati").neYapmali.length >= 3, "Defter Mutabakatı: nasıl giderileceği");
  });

  it("KAYNAK TARAMASI: kaynaktaki her neden kodu üretildi; planın / okuyucunun her sorun türünün kendi iletisi var (varsayılana düşmez)", () => {
    assert.ok(iletiModule && preflightModule, "ileti düzeni yok (eski kod)");
    const { all } = allMessages();
    const produced = new Set(all.map(row => row.kod));
    const literal = new Set();
    for (const line of lines(source("preflight.mjs")).concat(lines(source("iletiler.mjs")))) for (const match of line.matchAll(/kod: "([a-z0-9-]+)"/g)) literal.add(match[1]);
    // "devir-nedeni": kurucunun boş kod yedeği; "degismez": plan değişmezinin sorun sarmalayıcısı (ileti kodu degismez-<kod> — aşağıda ayrıca).
    for (const kod of literal) if (kod !== "devir-nedeni" && kod !== "degismez") assert.ok(produced.has(kod), `kaynakta olup üretilmeyen neden: ${kod}`);
    const cases = new Set();
    const body = source("preflight.mjs").split("export function problemIletisi")[1].split("\n}\n")[0];
    for (const line of lines(body)) for (const match of line.matchAll(/case "([a-z0-9-]+)":/g)) cases.add(match[1]);
    const kinds = new Set();
    for (const file of ["plan.mjs", "plan-reader.mjs"]) for (const line of lines(source(file))) for (const match of line.matchAll(/problems\.push\(\{ kod: "([a-z0-9-]+)"/g)) kinds.add(match[1]);
    assert.ok(kinds.size >= 9, [...kinds].join(", "));
    for (const kind of kinds) assert.ok(cases.has(kind), `sorun türünün kendi iletisi yok: ${kind}`);
    const invariants = new Set();
    for (const line of lines(source("plan.mjs"))) for (const match of line.matchAll(/(?:check\("|invariants\.push\(\{ kod: ")([a-z][a-z0-9-]*)"/g)) invariants.add(match[1]);
    for (const kod of invariants) assert.ok(produced.has(`degismez-${kod}`), `değişmezin iletisi üretilmedi: ${kod}`);
    const text = source("preflight.mjs").split("function invariantText")[1];
    for (const kod of invariants) assert.ok(text.includes(`case "${kod}"`), `değişmezin kendi cümlesi yok: ${kod}`);
  });
});
