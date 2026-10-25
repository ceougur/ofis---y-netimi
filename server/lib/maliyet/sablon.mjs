// Maliyet Hesap Kartı — BOŞ ŞABLON (2.4.6 madde 1–2; kullanıcı kararları 24–25.10.2026).
//
// Kaynak: müşterinin Excel'inden çıkarılmış FİYATSIZ formül tablosu (2.4.6 iş listesi madde 0b; tablo not defterinde, müşteri sekme adlarını taşıdığı
// için depoya girmez). Ürünle YALNIZ yapı gelir: 4 sekme, kartlar, kart / malzeme / sütun / ölçü adları, birimler, adım etiketleri, oranlar ve bölenler.
// Miktar, birim fiyat, matris taban fiyatı ve fiyat listesi FARK TUTARLARI (TL) BOŞ gelir; müşteri kendisi doldurur. Müşteri markası ve yıl hiçbir
// adda yoktur (sekme adları nötr: "Cam Maliyet", "Bayi Fiyat Listesi 1", "Mika Maliyet", "Bayi Fiyat Listesi 2"; sıra Excel'deki gibi).
//
// Adlar yazım düzeniyle (her sözcük büyük, ölçü / kod aynen: "100X100 Köşe Kabin", "170 2S2Ç H:182"); Excel'deki yazım farkları AYNEN (ör. "Tekerlek
// Köşe", "Masraf%" / "Masraf %", "Mıka", "Plastık ve Vıda"). Bütün adlar ✎ ile değişir (veri), şablon yalnız ilk hâlidir.
//
// HESAP ZİNCİRİ SABİTTİR (serbest formül motoru YOK): kart türü işlem sırasını ve hangi satırın hangi toplama girdiğini belirler (lib/maliyet/hesap.mjs).
// Excel'deki 25 tutarsızlık AYNEN gelir (formül tablosu §6), ör.: 130'luk ve 150'lik 1S1Ç kartında bölen 120 (1, 2); MASRAF oranı kart başına farklı (3);
// Cam 130 1S2Ç kartının CM maliyeti elle girdi, zincirin sonucu %20 Maliyet'te kalır (4); Mika 120 1S2Ç kartının CM satırında etiket yok (5); profil
// tablosunun ilk satırında Giden Kğ elle (6); 2019 listesinde elle yazılmış hücreler TABAN olarak gelir (7–9); yan panelde "%20 Maliyet" etiketi ile
// %15 oranı (11); tesettür sütunu parlak sütunundan, yan panel parlak farkı ayrı (12–14); fark / montaj satırları hiçbir hesaba bağlı değil (15).

/** Sekme kodları ve ilk adları (Excel sırası). */
export const MALIYET_SEKMELER = Object.freeze([
  Object.freeze({ kod: "cam", ad: "Cam Maliyet" }),
  Object.freeze({ kod: "liste-1", ad: "Bayi Fiyat Listesi 1" }),
  Object.freeze({ kod: "mika", ad: "Mika Maliyet" }),
  Object.freeze({ kod: "liste-2", ad: "Bayi Fiyat Listesi 2" }),
]);

/** Zincir kartının adım işlemleri (sabit sıra; formül tablosu §2). */
export const ZINCIR_ISLEM = Object.freeze({ ara: "toplam", yuzde: "yuzde", toplama: "toplama", yuzde_ekle: "yuzde_ekle", bolme: "bolme", cm_elle: "elle" });
export const ZINCIR_SIRA = Object.freeze(["ara", "yuzde", "toplama", "yuzde_ekle", "bolme", "cm_elle"]);

// ---------- Zincir kartları (10 maliyet kartı + yan panel) ----------
const camSatirlari = () => [["Aliminyum", "Kgr"], ["Cam", "M2"], ["Fitil", "Kgr"], ["Mıknatıs", "Kgr"], ["Plastik Malz.", "Adet"], ["Tekerlek", "Adet"], ["Vida", "Adet"]];
const mikaSatirlari = (tekerlek = "Tekerlek") => [["Aliminyum", "Kgr"], ["Mika", "Kgr"], ["Fitil", "Kgr"], ["Mıknatıs", "Kgr"], ["Plastik Malz.", "Adet"], [tekerlek, "Adet"], ["Vida", "Adet"]];

/**
 * Zincir kartı: satır tutarı = miktar × birim fiyat; ARA = satırların toplamı; sonra sabit sırayla yüzde → toplama → yüzde ekle → böl.
 * bolen: null → bölme adımı yok; cmElle: CM maliyeti elle girdi (bölme yerine; zincire girmez).
 */
function zincir(kod, ad, satirlar, { yuzde, yuzdeEkle, bolme = null, cmElle = null, ara = "Ara", toplama = "" }) {
  const adimlar = [
    { kod: "ara", etiket: ara },
    { kod: "yuzde", etiket: yuzde[0], oran: yuzde[1] },
    { kod: "toplama", etiket: toplama },
    { kod: "yuzde_ekle", etiket: yuzdeEkle[0], oran: yuzdeEkle[1] },
  ];
  if (bolme) adimlar.push({ kod: "bolme", etiket: bolme[0], bolen: bolme[1] });
  if (cmElle !== null) adimlar.push({ kod: "cm_elle", etiket: cmElle });
  return {
    kod,
    tur: "zincir",
    ad,
    satirlar: satirlar.map(([satirAd, birim], index) => ({ id: `s${index + 1}`, ad: satirAd, birim })),
    adimlar,
    // Kartın sonucu: bölme varsa CM maliyeti, yoksa %… Maliyet (yan panel; Cam 130 1S2Ç — CM maliyeti elle olduğu için zincirin sonucu orada kalır).
    sonuc: bolme ? "bolme" : "yuzde_ekle",
  };
}

const CAM = [
  zincir("cam/100x100-oval-kabin", "100X100 Oval Kabin", camSatirlari(), { yuzde: ["KDV/18", 18], yuzdeEkle: ["%20 Maliyet", 20], bolme: ["Oval Kabin CM Maliyeti", 200] }),
  zincir("cam/100x100-kose-kabin", "100X100 Köşe Kabin", camSatirlari(), { yuzde: ["KDV/18", 18], yuzdeEkle: ["%20 Maliyet", 20], bolme: ["Köşe Kabin CM Maliyeti", 200] }),
  zincir("cam/170-2s2c-h182", "170 2S2Ç H:182", camSatirlari(), { yuzde: ["KDV/18", 18], yuzdeEkle: ["%20 Maliyet", 20], bolme: ["2S2Ç Kabin CM Maliyeti", 170] }),
  // Tutarsızlık 1: 130'luk kartta bölen 120 (Excel'deki gibi).
  zincir("cam/130-1s1c-h182-kabin", "130 1S1Ç H:182 Kabin", camSatirlari(), { yuzde: ["KDV/18", 18], yuzdeEkle: ["%20 Maliyet", 20], bolme: ["1S1Ç Kabin CM Maliyeti", 120] }),
  // Tutarsızlık 4: CM maliyeti elle (formül yok); zincirin sonucu %20 Maliyet.
  zincir("cam/130-1s2c-h182-kabin", "130 1S2Ç H:182 Kabin", camSatirlari(), { yuzde: ["KDV/18", 18], yuzdeEkle: ["%20 Maliyet", 20], cmElle: "1S2Ç Kabin CM Maliyeti" }),
];

const MIKA = [
  zincir("mika/100x100-oval-kabin", "100X100 Oval Kabin", mikaSatirlari(), { yuzde: ["Masraf%", 11], yuzdeEkle: ["%15 Maliyet", 15], bolme: ["Oval Kabin CM Maliyeti", 200] }),
  zincir("mika/100x100-kose-kabin", "100X100 Köşe Kabin", mikaSatirlari("Tekerlek Köşe"), { yuzde: ["Masraf%", 11], yuzdeEkle: ["%15 Maliyet", 15], bolme: ["Köşe Kabin CM Maliyeti", 200] }),
  zincir("mika/170-2s2c-h182", "170 2S2Ç H:182", mikaSatirlari(), { yuzde: ["Masraf%", 13], yuzdeEkle: ["%15 Maliyet", 15], bolme: ["2S2Ç Kabin CM Maliyeti", 170] }),
  // Tutarsızlık 2: 150'lik kartta bölen 120.
  zincir("mika/150-1s1c-h182-kabin", "150 1S1Ç H:182 Kabin", mikaSatirlari(), { yuzde: ["Masraf%", 17], yuzdeEkle: ["%15 Maliyet", 15], bolme: ["1S1Ç Kabin CM Maliyeti", 120] }),
  // Tutarsızlık 5: CM satırında etiket yok (Excel'de etiket yerinde bir sayı duruyordu); 25: "Masraf %" boşluklu.
  zincir("mika/120-1s2c-h182-kabin", "120 1S2Ç H:182 Kabin", mikaSatirlari(), { yuzde: ["Masraf %", 16], yuzdeEkle: ["%15 Maliyet", 15], bolme: ["", 120] }),
  // Yan panel: bölme yok; etiketler başka; tutarsızlık 11: "%20 Maliyet" etiketi, oran 15.
  zincir("mika/80-lik-yan-panel", "80 Lik Yan Panel", [["Alüminyum", "Kğ"], ["Mıka", "Kğ"], ["Plastık ve Vıda", "Ad"], ["Fitil", "Kğ"]], { yuzde: ["Masraf", 15], toplama: "Genel", yuzdeEkle: ["%20 Maliyet", 15] }),
];

// ---------- Profil gramaj tablosu ----------
// Giden Kğ = Boy × Br. Gramaj; Satır Top. = Alış Ft × Giden Kğ; altta iki toplam. Giden MT hiçbir hesaba girmez (tutarsızlık 22); ilk satırda Giden Kğ elle (6).
export const GRAMAJ_SUTUNLAR = Object.freeze([
  ["parca", "Parça"], ["giden_mt", "Giden MT"], ["boy", "Boy"], ["br_gramaj", "Br.Gramaj"], ["cins", "Cins"], ["giden_kg", "Giden Kğ"], ["alis_ft", "Alış Ft"], ["satir_top", "Satır Top."],
]);
const GRAMAJ = {
  kod: "mika/profil-agirliklari",
  tur: "gramaj",
  ad: "Profil Ağırlıkları Net",
  satirlar: ["Arka Sabit", "Duvar Dikmesi", "Köşe Dönüşü", "Haş Fitil", "Yan Fitil", "Köşe Mıknatısı", "Mıknatıs", "Karşılık 1s1ç", "Karşılık 1s2ç", "Plastik Profil", "İç Ray", "Dış Ray", "Askılık"]
    .map((parca, index) => ({ id: `s${index + 1}`, parca, cins: "Kgr", elleKg: index === 0 })),
};

// ---------- Bayi fiyat listeleri (matris) ----------
// Hücre ya TABAN (girdi) ya `kaynak hücre + hücrenin farkı` (K2: fark HÜCRE BAŞINA; Excel'deki "aynı sembol" yalnız ilk değer bilgisidir, boş gelir).
// Kaynak aynı matristen: aynı satırın başka sütunu, bir üst satır ya da ilk satır. K3: ölçü satırı ekle / sil YOK (tablo eklenen satırın kuralını vermiyor).
const cell = (r, c) => `r${r}c${c}`;

/** liste-1 düzeni: taban yalnız r1c1; taban sütununda satır kaynağı `anchor(r)`; c2 ve c3 aynı satırın c1'inden, c4 aynı satırın `c4From`'undan. */
function liste1(kod, ad, olculer, sutunlar, anchor, { c3From = 1, c4From = 3 } = {}) {
  const hucreler = {};
  olculer.forEach((_, index) => {
    const r = index + 1;
    hucreler[cell(r, 1)] = r === 1 ? "taban" : cell(anchor(r), 1);
    hucreler[cell(r, 2)] = cell(r, 1);
    hucreler[cell(r, 3)] = cell(r, c3From);
    hucreler[cell(r, 4)] = cell(r, c4From);
  });
  return matris(kod, ad, olculer, sutunlar, hucreler);
}

/** liste-2 düzeni: her sütun kendi zinciri (bir üst satır + fark); ilk satır ve `tabanlar` listesindeki hücreler TABAN (Excel'de elle yazılmış). */
function liste2(kod, ad, olculer, sutunlar, tabanlar = []) {
  const hucreler = {};
  const elle = new Set(tabanlar);
  olculer.forEach((_, index) => {
    const r = index + 1;
    for (let c = 1; c <= 4; c += 1) hucreler[cell(r, c)] = r === 1 || elle.has(cell(r, c)) ? "taban" : cell(r - 1, c);
  });
  return matris(kod, ad, olculer, sutunlar, hucreler);
}

function matris(kod, ad, olculer, sutunlar, hucreler) {
  return {
    kod,
    tur: "matris",
    ad,
    olcuBasligi: "Ölçü",
    olculer: olculer.map((metin, index) => ({ kod: `r${index + 1}`, ad: metin })),
    sutunlar: sutunlar.map((sutunAd, index) => ({ kod: `c${index + 1}`, ad: sutunAd })),
    hucreler,
  };
}

const range = (from, to, step = 10) => {
  const list = [];
  for (let start = from; start <= to; start += step) list.push(`${start} - ${start + step - 1}`);
  return list;
};
const kare = list => list.map(size => `${size} * ${size}`);
const L1_SUTUN = ["Beyaz Alm / Mika Cam", "Siyah Alm / Mika Cam", "Parlak Alm / Mika Cam", "Beyaz Alm / Tesettür Cam"];
// Excel'de üç matrisin ilk sütun başlığında "/" yok ("Beyaz Alm Mika Cam") — AYNEN.
const L1_SUTUN_B = ["Beyaz Alm Mika Cam", ...L1_SUTUN.slice(1)];
const L2_SUTUN = ["Beyaz / Polistren", "Beyaz 4 MM / Şeffaf", "Beyaz 4 MM / Dekoratif", "Beyaz 4 MM / Kumlama"];
const firstRow = () => 1;
const YAN_PANEL_OLCU = ["01-20", ...range(21, 91)];

const LISTE_1 = [
  // Taban sütununda çapa ilk satır; B7 (3. satır) bir üst satıra bağlı (tutarsızlık 21).
  liste1("liste-1/seri-2-sabit-2-acilir", "Seri 2 Sabit 2 Açılır", range(141, 231), L1_SUTUN, r => (r === 3 ? 2 : 1)),
  liste1("liste-1/1-sabit-1-calisir", "1 Sabit 1 Çalışır", range(101, 141), L1_SUTUN, firstRow),
  liste1("liste-1/seri-kose-girisli", "Seri Köşe Girişli", ["85 * 85", "90 * 90", "95 * 95", "100*100", "105*105", "110*110", "115*115", "120*120", "125*125"], L1_SUTUN, firstRow),
  // Taban sütunu zincir (her satır bir üstüne bağlı; tutarsızlık 21).
  liste1("liste-1/1-sabit-2-calisir", "1 Sabit 2 Çalışır", range(101, 141), L1_SUTUN_B, r => r - 1),
  liste1("liste-1/seri-oval-2-sabit-4-calisir", "Seri Oval 2 Sabit 4 Çalışır", ["80 * 80", "85 * 85", "90 * 90", "95 * 95", "100*100", "105*105", "110*110", "115*115", "120*120", "125*125"], L1_SUTUN_B, firstRow),
  // Yan Panel: parlak sütunu da taban sütunundan (ayrı fark; tutarsızlık 14).
  liste1("liste-1/seri-yan-panel", "Seri Yan Panel", YAN_PANEL_OLCU, L1_SUTUN_B, firstRow),
];

const LISTE_2 = [
  liste2("liste-2/seri-2-sabit-2-acilir", "Seri 2 Sabit 2 Açılır", range(121, 241), L2_SUTUN),
  // Elle yazılmış 80*80 / Şeffaf (I5) ve 130*130 satırının tamamı TABAN (tutarsızlık 7, 8).
  liste2("liste-2/seri-kose-girisli", "Seri Köşe Girişli", kare([70, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130]), L2_SUTUN, ["r2c2", "r12c1", "r12c2", "r12c3", "r12c4"]),
  // Elle yazılmış 130*130 / Polistren (B30) TABAN (tutarsızlık 9).
  liste2("liste-2/seri-oval-2-sabit-4-calisir", "Seri Oval 2 Sabit 4 Çalışır", kare([80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130]), L2_SUTUN, ["r11c1"]),
  liste2("liste-2/1-sabit-1-calisir", "1 Sabit 1 Çalışır", range(91, 161), L2_SUTUN),
  liste2("liste-2/1-sabit-2-calisir", "1 Sabit 2 Çalışır", range(91, 161), L2_SUTUN),
  liste2("liste-2/seri-yan-panel", "Seri Yan Panel", YAN_PANEL_OLCU, L2_SUTUN),
];

// ---------- Bilgi kartları (hiçbir hesaba bağlı değil; değerleri boş; tutarsızlık 15, 23) ----------
function bilgi(kod, ad, sutunlar, satirlar) {
  return { kod, tur: "bilgi", ad, sutunlar: sutunlar.map((sutunAd, index) => ({ kod: `d${index + 1}`, ad: sutunAd })), satirlar: satirlar.map((satirAd, index) => ({ id: `b${index + 1}`, ad: satirAd })) };
}
const BILGI_1 = [
  bilgi("liste-1/katlanir-kapi", "Katlanır Kapı Siyah Alüminyüm", ["Mika", "Cam"], ["70-90 Arası H190", "90-110 Arası H190", "Kumlama Farkı", "Parlak Alüminyüm Farkı"]),
  bilgi("liste-1/fark-satirlari", "Fark Satırları", ["Tutar"], ["Parlak Profil Farkı", "Siyah Profil Farkı", "Tesettür Mika Farkı", "Parlak Profil 40x40 Kutu MT", "Beyaz Profil 40x40 Kutu MT"]),
];
const BILGI_2 = [
  bilgi("liste-2/fark-satirlari", "Fark Satırları", ["Tutar"], ["Parlak Profil Farkı", "Tesettür Mika Farkı", "Parlak Profil 40x40 Kutu MT", "Beyaz Profil 40x40 Kutu MT"]),
  bilgi("liste-2/montaj-satirlari", "Montaj Satırları", ["Tutar"], ["Kabin Montajı", "Süperlüx Kabin Montajı", "Tekne Montajı", "Küvet Montajı"]),
];

const KARTLAR_BY_SEKME = { cam: CAM, "liste-1": [...LISTE_1, ...BILGI_1], mika: [...MIKA, GRAMAJ], "liste-2": [...LISTE_2, ...BILGI_2] };

const deepFreeze = value => {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
};

/** Şablonun bütün kartları (sekme sırasıyla; her kartta `sekme`). Donmuştur: değerler DB'de, şablon yalnız yapı + ilk ad / oran / bölen. */
export const MALIYET_KARTLAR = deepFreeze(MALIYET_SEKMELER.flatMap(sekme => KARTLAR_BY_SEKME[sekme.kod].map(kart => ({ ...kart, sekme: sekme.kod }))));
const BY_KOD = new Map(MALIYET_KARTLAR.map(kart => [kart.kod, kart]));
export const sablonKart = kod => BY_KOD.get(String(kod || "")) || null;
export const sekmeKartlari = sekme => MALIYET_KARTLAR.filter(kart => kart.sekme === sekme);

/** Şablondaki bütün görünen adlar (yazım düzeni denetimi için; test/yazim-duzeni.test.mjs). */
export function sablonAdlari() {
  const names = MALIYET_SEKMELER.map(sekme => sekme.ad);
  for (const kart of MALIYET_KARTLAR) {
    names.push(kart.ad);
    if (kart.tur === "zincir") {
      for (const satir of kart.satirlar) names.push(satir.ad, satir.birim);
      for (const adim of kart.adimlar) if (adim.etiket) names.push(adim.etiket);
    } else if (kart.tur === "gramaj") {
      for (const satir of kart.satirlar) names.push(satir.parca, satir.cins);
      for (const [, sutun] of GRAMAJ_SUTUNLAR) names.push(sutun);
    } else if (kart.tur === "matris") {
      names.push(kart.olcuBasligi, ...kart.olculer.map(olcu => olcu.ad), ...kart.sutunlar.map(sutun => sutun.ad));
    } else {
      names.push(...kart.sutunlar.map(sutun => sutun.ad), ...kart.satirlar.map(satir => satir.ad));
    }
  }
  return names;
}
