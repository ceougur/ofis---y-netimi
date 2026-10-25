// Maliyet Hesap Kartı — HESAP ÇEKİRDEĞİ (2.4.6 madde 2). Saf işlevler: şablon (lib/maliyet/sablon.mjs) + kartın kayıtlı / taslak hâli → görünüm.
//
// Kurallar (formül tablosu §2–§4, §7; kullanıcı kararları 25.10.2026):
//  - Serbest formül YOK; kart türü zinciri belirler. İşlem SIRASI ve hangi satırın hangi toplama girdiği sabittir; eklenen satır yalnız kartın satır
//    kuralına (tutar = miktar × birim fiyat → ARA) girer.
//  - Excel'in işlem sırası bire bir (kayan nokta sonucu Excel'le aynı çıksın diye): yüzde = (ARA × p) / 100; toplama = ARA + yüzde; yüzde ekle =
//    ((T × q) / 100) + T; bölme = Y / k; matris hücresi = kaynak + fark. ARA satırları soldan sağa toplar.
//  - Ara değerler YUVARLANMAZ (gösterim ayrı). Boş girdi null kalır; hesapta 0 sayılır (Excel'de boş hücre 0'dır).
//  - Bölen 0 ya da boş olamaz (K1): bu denetim kaydı reddeder (lib/maliyet/girdi.mjs); burada yine de sonsuz / NaN üretilmez (hata işareti).
import { ZINCIR_SIRA, ZINCIR_ISLEM } from "./sablon.mjs";

const num = value => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Zincir kartı (10 maliyet kartı + yan panel). */
export function zincirHesap(sablon, durum) {
  const satirlar = durum.satirlar.map(satir => ({
    id: satir.id,
    ad: satir.ad,
    birim: satir.birim,
    miktar: satir.miktar ?? null,
    fiyat: satir.fiyat ?? null,
    tutar: num(satir.miktar) * num(satir.fiyat),
  }));
  let ara = 0;
  for (const satir of satirlar) ara += satir.tutar;
  const adimDurum = kod => durum.adimlar?.[kod] || {};
  const values = {};
  const adimlar = [];
  const tanimli = new Map(sablon.adimlar.map(adim => [adim.kod, adim]));
  for (const kod of ZINCIR_SIRA) {
    const tanim = tanimli.get(kod);
    if (!tanim) continue;
    const kayit = adimDurum(kod);
    const etiket = kayit.etiket ?? tanim.etiket;
    const adim = { kod, islem: ZINCIR_ISLEM[kod], etiket };
    if (kod === "ara") {
      values.ara = ara;
      adim.deger = ara;
    } else if (kod === "yuzde") {
      adim.oran = Object.hasOwn(kayit, "deger") ? kayit.deger : tanim.oran;
      values.yuzde = (values.ara * num(adim.oran)) / 100;
      adim.deger = values.yuzde;
    } else if (kod === "toplama") {
      values.toplama = values.ara + values.yuzde;
      adim.deger = values.toplama;
    } else if (kod === "yuzde_ekle") {
      adim.oran = Object.hasOwn(kayit, "deger") ? kayit.deger : tanim.oran;
      values.yuzde_ekle = (values.toplama * num(adim.oran)) / 100 + values.toplama;
      adim.deger = values.yuzde_ekle;
    } else if (kod === "bolme") {
      adim.bolen = Object.hasOwn(kayit, "deger") ? kayit.deger : tanim.bolen;
      const bolen = adim.bolen;
      const gecerli = typeof bolen === "number" && Number.isFinite(bolen) && bolen !== 0;
      values.bolme = gecerli ? values.yuzde_ekle / bolen : null;
      adim.deger = values.bolme;
      adim.hata = gecerli ? null : "SIFIRA_BOLME";
    } else if (kod === "cm_elle") {
      // Elle girdi (Excel'de formülsüz hücre): hiçbir adıma girmez, kartın sonucu değildir (tutarsızlık 4).
      adim.deger = Object.hasOwn(kayit, "deger") ? kayit.deger : null;
    }
    adimlar.push(adim);
  }
  return { tur: "zincir", ad: durum.ad, satirlar, adimlar, sonuc: values[sablon.sonuc] ?? null, sonucAdim: sablon.sonuc };
}

/** Profil gramaj tablosu: Giden Kğ = Boy × Br. Gramaj (elle satırda girdi); Satır Top. = Alış Ft × Giden Kğ; iki toplam. */
export function gramajHesap(sablon, durum) {
  let toplamKg = 0;
  let toplamTutar = 0;
  const satirlar = durum.satirlar.map(satir => {
    const elle = Boolean(satir.elle);
    // Giden Kğ sütunu hesapta kullanılan değerdir (elle satırda girdi, boşsa 0); elle satırın ham girdisi ayrıca giden_kg_girdi (null = boş).
    const gidenKg = elle ? num(satir.giden_kg) : num(satir.boy) * num(satir.br_gramaj);
    const satirTop = num(satir.alis_ft) * num(gidenKg);
    toplamKg += num(gidenKg);
    toplamTutar += satirTop;
    return {
      id: satir.id, parca: satir.parca, cins: satir.cins, giden_mt: satir.giden_mt ?? null, boy: satir.boy ?? null, br_gramaj: satir.br_gramaj ?? null,
      giden_kg: gidenKg, alis_ft: satir.alis_ft ?? null, satir_top: satirTop, elle_kg: elle, ...(elle ? { giden_kg_girdi: satir.giden_kg ?? null } : {}),
    };
  });
  return { tur: "gramaj", ad: durum.ad, sutunlar: durum.sutunlar, satirlar, toplam: { giden_kg: toplamKg, satir_top: toplamTutar } };
}

/** Bayi fiyat listesi: hücre TABAN ise değeri tabanıdır; değilse kaynak hücrenin değeri + kendi farkı (K2: hücre başına). */
export function matrisHesap(sablon, durum) {
  const values = new Map();
  const visiting = new Set();
  const degerOf = hucre => {
    if (values.has(hucre)) return values.get(hucre);
    if (visiting.has(hucre)) throw new Error(`Maliyet şablonunda döngü: ${sablon.kod} ${hucre}`);
    visiting.add(hucre);
    const kaynak = sablon.hucreler[hucre];
    const girdi = durum.hucreler?.[hucre] ?? null;
    const value = kaynak === "taban" ? num(girdi) : degerOf(kaynak) + num(girdi);
    visiting.delete(hucre);
    values.set(hucre, value);
    return value;
  };
  const hucreler = {};
  for (const [hucre, kaynak] of Object.entries(sablon.hucreler)) {
    const girdi = durum.hucreler?.[hucre] ?? null;
    hucreler[hucre] = kaynak === "taban" ? { tur: "taban", taban: girdi, deger: degerOf(hucre) } : { tur: "fark", kaynak, fark: girdi, deger: degerOf(hucre) };
  }
  return {
    tur: "matris",
    ad: durum.ad,
    olcuBasligi: durum.olcuBasligi,
    sutunlar: sablon.sutunlar.map(sutun => ({ kod: sutun.kod, ad: durum.sutunlar?.[sutun.kod] ?? sutun.ad })),
    olculer: sablon.olculer.map(olcu => ({ kod: olcu.kod, ad: durum.olculer?.[olcu.kod] ?? olcu.ad })),
    hucreler,
  };
}

/** Bilgi kartı: hesap yok; değerler olduğu gibi (sayı ya da metin). */
export function bilgiHesap(sablon, durum) {
  return {
    tur: "bilgi",
    ad: durum.ad,
    sutunlar: sablon.sutunlar.map(sutun => ({ kod: sutun.kod, ad: durum.sutunlar?.[sutun.kod] ?? sutun.ad })),
    satirlar: durum.satirlar.map(satir => ({ id: satir.id, ad: satir.ad, degerler: sablon.sutunlar.map((_, index) => satir.degerler?.[index] ?? null) })),
  };
}

const BY_TUR = { zincir: zincirHesap, gramaj: gramajHesap, matris: matrisHesap, bilgi: bilgiHesap };

/** Kartın görünümü (tür şablondan; durum kayıtlı ya da taslak). */
export function kartHesap(sablon, durum) {
  const hesap = BY_TUR[sablon.tur];
  if (!hesap) throw new Error(`Bilinmeyen maliyet kartı türü: ${sablon.tur}`);
  return hesap(sablon, durum);
}
