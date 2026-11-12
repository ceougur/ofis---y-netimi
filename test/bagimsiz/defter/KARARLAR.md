# Bağımsız DEFTER kâhini — kurallar ve kararlar

Kâhin `kahin.py` (Python 3, yalnız standart kütüphane, `python3 -I`), koşucu `kos.mjs` (programı API'den sürer), karşılaştırıcı `karsilastir.mjs`, ana senaryo `senaryo.json`,
elle senaryolar `senaryolar/*.json` (2.5.0 Ç5 bakımı; programsız öz denetim `oz-test.py`). 2.4.3'teki kurallar `kahin.py` başındaki yorumdadır (MM3–MM5, 31b-MM3, 31b-MM8) ve
`--kural 2.4.9` ile AYNEN (bayt bayt) üretilir.

## 2.5.0 Ç5 bakımı (06.11.2026; BAŞ MİMAR KARARI B17 — "eski kâhinler Ç5 birleşmeden önce kodu görmeyen ajanla bakım")

Kural seti: **`2.5.0`** varsayılan (bu bölüm), **`--kural 2.4.9`** eski kâhinin beklentileri (2.4.3 + 31b, değişmeden). Bu dal ana dala Ç5-A ile birlikte girer; bugünkü
programla ayrışma BEKLENİR (açılış karşı hesabı, açılış tanıma, açılış evrakı, KG-5, S12).

### Temiz oda (ders 5, 40)
- **Okunan (karar metni):** CLAUDE.md (anayasa, dersler 1–48, SORU DÜZENİ, Açık iş DEVİR MODÜLÜ "2.5.0'a AÇILIŞ KAYITLARI DÜZENİ (30.10)"); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`;
  `docs/2.5.0-IS-LISTESI.md` A, C, D; `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` (tamamı); `…-EK-1.md` §0, §1, M1–M3, M7, §3–§7; `…-EK-2.md` başlık, soru 37–40, K-1; `…-EK-2B.md` §0, §1;
  `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §0, §6, §9, §13, §14 (ve bir aramada §1'in iki satırı ekrana geldi — kullanılmadı); bu klasörün dosyaları; cari kâhininin `KARARLAR.md`'si (başlık
  listesi, §0–§2, §4–§6, B1, C1–C12, §12) ve `kos.mjs`'inin istek satırları (uç / alan adı için).
- **Okunmayan:** `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (yalnız `kanit.mjs` çalıştırıldı), `docs/erp/C5-ACILIS-TASARIM.md`, `test/` altında iki kâhin klasörü dışındaki her şey,
  `docs/kanit/` altındaki başka ajanların dosyaları, git farkı / geçmiş içeriği. Program koşulmadı.

### Kurallar (kaynak her satırda)
- **D1 Açılış karşı hesabı 519** [KULLANICI 30.10 açılış düzeni "açılış karşı hesabı 500 değil geçici Eşleştirilecek Açılış Bakiyeleri"; kitap §3-M M-01, M-02, M-03, M-04, M-07; KG-1 A
  (çekirdek §13 KABUL); ad EK-2 soru 39]: Kasa açılışı B 100 / A 519; banka hesabı açılışı B 102 / A 519; ürün kartı açılış stoğu B 153 / A 519 (miktar × alış fiyatı — 18.10 MM4'ün "A 500"ü
  30.10 kararıyla 519'a); cari açılışı (Açılış Bakiyesi, açılış İŞARETLİ) borçlu B 120|320 / A 519, alacaklı B 519 / A 320|120. 500 Sermaye yalnız Açılış Eşleştirme Fişi'yle (M-11; bu
  kâhinde yok).
- **D2 Açılış açıklamadan TANINMAZ** [kitap M-02 "Açıklamadan değil, açılış işaretinden tanınır"; KG-4 A Borç Yaz 602.90 / Alacak Yaz 770.90 (çekirdek §13 "bugünkü 602 / 770 + .90");
  KG-16 A "Göçte 'Açılış Olabilir' listesi"]: 2.5.0'da girilen Borç Yaz / Alacak Yaz'ın açıklaması ne olursa olsun ("AÇILIŞ BAKİYESİ", "açılış", "Açilis", "ACILIS") açılış DEĞİLDİR:
  Borç Yaz C-01 B CH / A 602, Alacak Yaz C-02 B 770 / A CH. Liste (KG-16) yalnız GÖÇTE ve eski satırlar için (D6). Mizan ana hesap düzeyindedir (602.90 → 602, 770.90 → 770, 102.NN → 102,
  2.4.3'ten beri aynı).
- **D3 Açılış evrakı 602 / 770'e yazılmaz** [KULLANICI 30.10 (1) "açılış çekleri gelir / gidere yazılmaz"; kitap M-08, M-09; çekirdek §6]: cariye işlenmemiş açılış portföyü (Excel
  "Açılış portföyü") alınan çek B 101 / A 519 (senet 121); verilen, ödenmemiş çek B 519 / A 103 (senet 321).
- **D4 Karşılıksız dönen carisiz açılış evrakı** [KULLANICI S48 = A, 06.11 10:57]: program cariyi sorar; cari seçilirse cari borçlanır B CH / A 101|121 (cari bakiyesi + tutar);
  seçilmezse B 519 / A 101|121 ("açılış geri alınmış").
- **D5 Formdan carisiz evrak (açılış değil)** [KULLANICI S49 = A]: alınan çek / senet B 101|121 / A 649 (649.90); verilen B 770 (770.90) / A 103|321. Carisiz evrak cari bakiyesine ve
  alacak yaşlandırmasına girmez (müşterisi yok; MM5 "müşteri başına").
- **D6 Göç: "Açılış Olabilir" listesi** [KULLANICI KG-16 = A; S47 = A; S51 = A; BAŞ MİMAR B6, B8; S53 = A]: sürüm geçişinde (olay `goc`) eski (2.4.9'un yazdığı), açılış işaretsiz Borç / Alacak Yaz,
  açıklaması **"Açılış" ile başlıyorsa** (KG-16 metni "Açılış…"; B6: Türkçe küçük harf — İ→i, I→ı — ve ç→c, ı→i, ş→s katlaması; "Devir" / "Devreden" listeye GİRMEZ) listeye girer.
  Onay bekleyen kayıt 519'dadır (S47: borçlu B CH / A 519, alacaklı B 519 / A CH). `acilis_onay {karar: "onay"}` → M-02 / M-03 (519, mizan aynı); `{karar: "red"}` → C-01 / C-02 (602 / 770).
  Listeye girmeyen eski Borç / Alacak Yaz → C-01 / C-02. Silinenler'den geri alınan açılış (carinin başka açılışı varken) listeye girer (S51); göç öncesi yedekten / Silinenler'den dönen eski satır da
  aday olur (B8). Kilitsiz dönemin bütün maddeleri göçte yeni kurala geçer (S53 A: geçmiş yılın defteri de değişir).
- **D7 Kilitli dönem eski kuralla** [Ç3 (çekirdek §4; iş listesi Ç3) + KULLANICI S13 = A (GAP_RULE: eski sürümün kilidi 2.4.9 kuralının kopyasıyla donar) + BAŞ MİMAR B15 ("2.5.0" = 2.4.9 kopyası
  takma adı)]: `goc {kilit: L}` — tarihi ≤ L olan maddeler 2.4.9 kuralıyla DONAR (açılışlar 500; "Açılış…" açıklamalı eski Borç Yaz 500 — eski kâhinin cari açılış olayıyla aynı; açılış evrakı
  602 / 770). Tanımsız eski davranış (2.4.9'da "AÇILIŞ" / "açılış" / "Acilis" gibi büyük-küçük harf değişkeleri) kâhinde KURULMAZ (senaryo hata verir — beklenen değer kararda yok).
- **D8 Kural Farkı Düzeltme Fişi** [KULLANICI KG-15 = A; EK-1 M7 (BAŞ MİMAR KARARI, kullanıcıya gösterildi); BAŞ MİMAR B16]: `kural_farki_fisi` — kilidin ertesi günü (L + 1) tarihli fiş; her donmuş
  maddenin yeni kural ↔ eski kural farkı (hesap hesap). Aynı mali yıl: fark olduğu gibi (ör. B 500 / A 519, B 602 / A 519, B 519 / A 770). Önceki mali yıl: farktaki 6 / 7 sınıfı hesapların borç
  yönü 681'e, alacak yönü 671'e (M7: "açılış çekini 602'ye yazmışsa B 681 / A 519; 770'e yazmışsa B 519 / A 671"); 500 ↔ 519 olduğu gibi. Kilitli dönemde onay bekleyen KG-16 adayı varken fiş PASİF (B16 —
  `retler`'de "kural_farki_fisi"). Donmuş maddeler DEĞİŞMEZ (fiş ayrı satırdır).
- **D9 KG-5 Excel taksit kartı** [KULLANICI KG-5 = A; BAŞ MİMAR B5]: Excel'den (tablodan) yüklenen taksit kartı (T toplam, P önceden ödenen) açılış alacağıdır: TEK MADDE B CH (T − P) / A 519,
  tarihi yüklemenin (plan_imports.created_at) YEREL günü; P maddesiz. Gelir değildir.
- **D10 Kasa açılışından önce tarihli Kasa hareketi** [KULLANICI S12 = A ("bankadaki gibi reddedilir"); BAŞ MİMAR B11 (açılıştan önceye alınan DÜZELTME de red, T12)]: `kasa_gider`
  (Kasa açılışından önce tarihli) ve `kasa_duzelt {hareket, tarih}` (tarihi açılıştan önceye) REDDEDİLİR, madde yazılmaz / değişmez; beklenen ret `retler` listesinde. HTTP kodu kararda yok
  ("bankadaki gibi" — denetlenmez). Açılış tarihine eşit ya da sonrası kabul. Kasa hareketi: Kasa gideri, nakit tahsilat / ödeme. Kod yazılırken eklendi (program koşulmadan,
  karar metninden): **EK-2B madde 33 (TÜRETİLDİ; BAŞ MİMAR KARARI olarak gösterildi)** — Kasa açılışının tarihi Kasa'nın açılış dışı ilk hareketinden SONRA olamaz (aynı gün olur) → `kasa_acilis` ret.

### Senaryo dili ekleri (2.5.0)
`borc_yaz` / `alacak_yaz {tarih, cari, tutar, aciklama}` · `cek_carisiz {tarih, yon: alinan|verilen, evrak: cek|senet, tutar, no, vade}` · `acilis_evrak {tarih, yon, evrak, tutar, no, vade}` ·
`karsiliksiz {cek, tarih, cari?}` (açılış evrakında `cari` = programın sorusuna verilen yanıt; yoksa seçilmedi) · `excel_taksit_karti {tarih, cari, toplam, odenen}` ·
`kasa_gider {…, beklenen: "ret"}` · `kasa_duzelt {hareket, tarih}` · göç (yalnız model; sürücüde yol yok): `goc {tarih, kilit?}` (önceki olaylar 2.4.9'un yazdığı ESKİ kayıtlardır), `acilis_onay {kayit, karar}`,
`kayit_sil {kayit}`, `kayit_geri_al {kayit}`, `kural_farki_fisi {tarih?}`. Çıktıya `retler` (beklenen reddedilen olaylar) ve `acilisOlabilir` (onay bekleyen liste) eklendi.
Senaryo dosyasında `elleBeklenenTL` (elle hesaplanmış beklenenler, TL; `kismi` ise yalnız yazılan hesaplar) — yalnız `oz-test.py` okur.

### Senaryolar
- `senaryo.json` (programla koşar): 2.4.3 olayları + BY1…KDZ2 (D2 Türkçe büyük harf / ASCII "Acilis" / küçük harf açıklamalar, "Devir bakiyesi"; D5 alınan çek / senet, verilen çek; D3 açılış portföyü
  alınan çek / senet, verilen çek; D4 karşılıksız — cari seçilmedi / seçildi; D9 Excel kartı; D10 açılıştan önce tarihli gider ret, açılış günü kabul, önceye düzeltme ret, sonraya kabul).
  K_SON için KISMİ elle tablo (519, 500, 101, 121, 103, 602, 649, retler).
- `senaryolar/g1-goc-kilitsiz` (D6: S53, KG-16, S47, B6 katlama "AÇILIŞ FARKI", "Devreden bakiye" aday değil, onay / red), `g2-goc-kilitli` (D7 + D8: kilitli dönem eski kuralla, B16 fiş
  pasif, kilitli kaynak silinemez, M7 671 / 681; fiş sonrası 519 = yeni kuralla baştan kurulmuş defter), `g3-s51-b8-geri-alma` (B8 göç öncesi silinen eski satır geri alınınca aday; S51 açılış
  → sil → yeni açılış → geri al → liste, red → 602), `g4-yeni-kayitlar` (D1–D5, D9, D10 tam elle tablo; programla da koşulabilir), `g5-kasa-hareket-once` (sınır "hareket önce / açılış önce":
  EK-2B 33 + S12; programla da koşulabilir). g1–g3 yalnız model (göç).
- Aynı adlı iki cari: defter kâhininin cari çıktısı ADA göre (2.4.3'ten) → kurulmadı (DENENMEYEN; cari kâhininde d1 / d5).

### Değişen eski beklentiler (G3; hepsi D1'den, kararla ilgisiz eski beklenti DEĞİŞMEDİ)
`senaryo.json`'un her kontrol noktasında **500** → 0 ve **519** = açılışlar toplamı (KASA0 10.000 + B 50.000 + P1 stoğu 5.000 + M1A 5.000 + M5A 2.000 + M4A 5.000 − T1A 8.000; işaretli alacak).
Kaynak D1 (30.10 açılış düzeni; MM4'ün "stok açılışı A 500"ü de bu kararla). Öbür bütün hesaplar, cari bakiyeleri, stok, KDV, stopaj özeti, yevmiye sırası ve yaşlandırma 2.4.9 kuralıyla aynı
(eski olaylar için; yeni olaylar kendi kurallarıyla eklenir).

### Mutantlar (her kararın B seçeneği — değerle yakalanmalı; `oz-test.py` ve `kos.mjs` "tam senaryo")
14 açılış karşı hesabı 500 (30.10 öncesi) · 15 açıklaması "açılış" ile başlayan yeni Borç / Alacak Yaz açılış sayılır (M-02 B) · 16 açılış evrakı 602 / 770'e (30.10 (1) B) · 17 S48 B: karşılıksız
carisiz açılış evrakı gidere (770.90) · 18 S48: cari seçilse de 519 (cari borçlanmaz) · 19 S49 B: formdan carisiz evrak 519'a · 20 S49 C: formdan carisiz evrak 602 / 770 · 21 KG-5 B: Excel kartı yeni
satış (B CH T / A 600; B 519 P / A CH P) · 22 S47 B: onay bekleyen aday 602 / 770'te · 23 KG-16 B: liste yok (onay etkisiz, aday 602 / 770) · 24 B6 katlama yok (yalnız "Açılış" tam yazımı aday) ·
25 B6: "Devir" / "Devreden" de aday · 26 S51 B: geri alma reddedilir · 27 S53 B: göçte son tamamlanmış yılın 31 Aralık'ına kendiliğinden kilit · 28 Ç3 yok: kilitli dönem de yeni kurala geçer ·
29 KG-15 B: Kural Farkı fişi yazılmaz · 30 M7 B: önceki yılın farkı da 602 / 770'e · 31 B16 B: onay bekleyen aday varken fiş yazılır · 32 S12 B: açılıştan önce tarihli Kasa hareketi kabul ·
33 B11 B: açılıştan önceye alınan düzeltme kabul · 34 EK-2B 33 B: Kasa açılışı ilk hareketten sonraya kabul. `kos.mjs` "tam senaryo" mutasyonu 14–21, 32, 33'ü `senaryo.json`'da; `oz-test.py`
hepsini (14–34) bütün senaryolarda (`mutasyon` alanı hariç değerle) dener.

### KULLANICIYA SORULMALI (kâhin bu durumları KURMAZ — senaryoda görülürse hata verir) — SK-1 ve SK-2 YANITLANDI 06.11 12:16 (S65 = A, S66 = A; aşağıda "2.5.0 Ç5 bakımı 2")
- **SK-1 (KG-16 kapsamı; UÇ):** açıklamasında "açılış" ORTADA geçen eski Borç / Alacak Yaz ("2025 açılış farkı") listeye girsin mi? **A (öneri):** hayır — KG-16 metni "Açılış…" (açıklama bununla
  başlar); sıradan Borç / Alacak Yaz (602 / 770). **B:** evet, içinde geçen de aday (onaya kadar 519). **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-2 (S48 ↔ S49 arası; para):** formdan girilmiş CARİSİZ (açılış değil) alınan evrak karşılıksız dönerse? **A (öneri):** S48 gibi program cariyi sorar; seçilirse cari borçlanır (B CH / A 101),
  seçilmezse alışın tersi B 649.90 / A 101 (gelir geri alınır). **B:** seçilmezse B 770.90 / A 101 (gider). **C:** uç durum böyle kalsın (BİLİNEN SINIR).

### DENENMEYEN (neden)
- KG-5 "tek madde" ↔ iki madde (B CH T / A 519 T + B 519 P / A CH P): mizan BAKİYESİ aynı (yalnız borç / alacak sütun toplamı ve yevmiye satır sayısı ayrışır); koşucu mizandan yalnız bakiye okur →
  mutant 21 (600'e gelir) yakalanır, "P de madde" mutantı yakalanamaz. B5'in tarihi (yükleme günü ↔ kart tarihi) de bakiyeyle görünmez (kontrol noktaları kümülatif).
- B11'in değeri: tarih düzeltmesi kümülatif mizanı değiştirmez → yalnız `retler` (ret ↔ kabul) ile.
- EK-2B 33 (Kasa açılışının tarihini ilk hareketten sonraya düzeltme → ret): açılış düzeltme uç adı yok; kurulmadı.
- Göç senaryoları (D6–D8) programla koşulamaz: `kos.mjs` tek program kökünü açar (eski sürümle veri üretme yolu yok — ders 17, G6 göç takımının işi); yalnız `oz-test.py` (elle tablo + mutant).
- Açılış Eşleştirme Fişi (M-11), Bilanço "Kesin Değil — Onay Bekliyor" etiketi, Defter Mutabakatı bilgi satırı (S53 A'nın bildirim kısmı), Kural Farkı fişinin ön izleme ekranı: bu kâhinin çıktısında yok.
- KG-16'nın Türkçe katlamasında ğ / ö / ü (B6 yalnız ç / ı / ş der; "açılış" sözcüğünde yok).

### Eşleme notları (Ç5-A kod ajanı için; `kos.mjs`)
- `cari_acilis` artık AÇILIŞ İŞARETLİ gönderilir: cari açılırken `openingBalance` + `openingSide` (`auto` borçlu / `credit` alacaklı), `registeredOn` = açılış tarihi (cari kâhininin
  `cari_ac {acilis}` eşlemesiyle aynı alanlar). Açıklamalı Borç Yaz (eski eşleme) artık `borc_yaz` olayıdır.
- `borc_yaz` / `alacak_yaz`: `POST /accounts/:id/entries {kind: debt|credit, note: aciklama}` (eski `cari_acilis` eşlemesi). `cek_carisiz`: `POST /cheques` `accountId` olmadan.
- `beklenen: "ret"` olayı reddedilirse gönderilmiş sayılır ve `program.son.retler`'e yazılır (karşılaştırıcı "beklenen retler" denetimi; kabul edilirse mizan ve retler farkı).
  `kasa_gider` yanıtındaki kimlik saklanır (`kasa_duzelt` için). Senaryo yolu isteğe bağlı argüman (`node test/bagimsiz/defter/kos.mjs senaryolar/g4-…json`; göçsüz senaryolar).
  `karsilastir.mjs` ZORUNLU hesaplara 519 eklendi. `MUTASYONLAR`'a 14–21, 32, 33 eklendi (kahin.py `MUTASYONLAR_250`).
- UÇ ADI VERİLMEDİ (`UCLAR` null → olay ATLANAN, sonuç yeşil sayılmaz): `acilis_evrak` (Excel açılış portföyü), açılış evrakının `karsiliksiz`'inde cari seçimi, `excel_taksit_karti`
  (Tablodan Aktar / plan içe aktarımı; eski anahtar `legacyTableTransfer` gerekebilir), `kasa_duzelt` (Kasa hareketi tarih düzeltmesi). `kasa_gider {beklenen: "ret"}` reddedilirse başarı,
  kabul edilirse fark.

## 2.5.0 Ç5 bakımı 2 (06.11.2026; eski kâhinler bakımı 2 — kodu görmeyen AYRI el; bakım 1'in KULLANICIYA SORULMALI'ları yanıtlandı)

Kural seti adı değişmedi: **`2.5.0`** varsayılan = bakım 1 + bu bölüm; **`--kural 2.4.9`** AYNEN (bayt bayt; eski kâhinle eşdeğerlik kanıtta). Bu dal da ana dala Ç5-A ile birlikte girer.

### Kaynak (temiz oda; ders 5, 40)
- **Karar metni:** KULLANICI KARARI 06.11 12:16 UTC (AYNEN "önerilerini uygula"; iş listesi `a4ef1268` D "S65–S68 = A", sorular C S65–S68):
  S65 = A "'Açılış Olabilir' listesine yalnız açıklaması 'Açılış…' ile BAŞLAYAN eski kayıt girer; ortada geçen girmez." ·
  S66 = A "formdan carisiz (açılış değil) alınan evrak karşılıksız dönerse program cariyi sorar; seçilirse cari borçlanır, seçilmezse B 649.90 / A 101 (S49 geliri geri alınır)." ·
  S67 / S68 bu kâhinin konusu değil (takvim kalemi ve kapama sırası cari kâhininde — `test/bagimsiz/cari/KARARLAR.md` §14).
- **Okunan / okunmayan:** bakım 1'in alanıyla aynı (yukarıda "Temiz oda"); tam liste ajan raporunda. Program koşulmadı, programın davranışı aranmadı.

### Kurallar (bakım 1'in D4 / D6'sına ek; kaynak her satırda)
- **D6′ — S65 = A (SK-1 kapandı):** KG-16 adayı yalnız açıklaması "Açılış" ile BAŞLAYAN eski Borç / Alacak Yaz'dır; başlangıç B6 katlamasıyla okunur (Türkçe küçük harf + ç/ı/ş):
  "Açılış", "AÇILIŞ", "açılış farkı", "Acilis" ADAY; "2025 açılış farkı", "Yeniden açılış", "Devir açılış farkı" (ortada geçen) ADAY DEĞİL → sıradan C-01 / C-02 (602 / 770; KG-4 A).
  Silinenler'den geri alınan böyle eski kayıt da (B8) aday değil. Kâhin bu durumda artık hata vermez. **Yorum (ders 40):** S65 yalnız 2.5.0 listesini söyler; aynı açıklamalı kaydın
  DONMUŞ dönemdeki 2.4.9 karşılığı (D7 "tanımsız eski davranış") kararda hâlâ yok → D7 aynen (kâhin kurmaz).
- **D4′ — S66 = A (SK-2 kapandı):** formdan girilmiş CARİSİZ ALINAN evrak (S49: B 101|121 / A 649) karşılıksız dönünce program cariyi sorar — `karsiliksiz {cek, tarih, cari?}` (`cari` = programın
  sorusuna verilen yanıt; yoksa seçilmedi):
  - **seçilirse** cari borçlanır: B CH (120 müşteri / 320 tedarikçi — G-2) / A 101|121; cari bakiyesi + tutar, yaşlandırmada cari kalemi (MM5). S49'un A 649'u YERİNDE kalır — kararın
    "(S49 geliri geri alınır)" parantezi yalnız seçilmeyen dala bağlıdır (Ç-07 "müşteri yeniden borçlanır" düzeni; bakım 1'in S48 D4'üyle aynı biçim).
  - **seçilmezse** B 649 (649.90) / A 101|121 — S49 geliri geri alınır; kimse borçlanmaz.
  - Madde tarihi = karşılıksız işleminin tarihi (G-4).
  - **Yorum Y1 (harfiyen):** kilitli dönemde 2.4.9 kuralıyla donmuş (B 101 / A 602) ESKİ carisiz evrak kilitten SONRA karşılıksız dönerse de seçilmeyen dal B 649.90 / A 101'dir — karar metni hesabı
    açıkça veriyor; donmuş alış maddesi 602'de kalır (602 ↔ 649 sınıflama farkı KG-15 Kural Farkı Düzeltme Fişi'nin konusu — D8). Önceki mali yılda alınmış evrakta 649 bu yılda borç
    yazılır (karar metni yıl ayırmıyor; M7'nin 671 / 681'i yalnız kural farkı fişine özgü). Yeni para kuralı değil (S66 metni) → soru değil.
  - **Yorum Y2 (kitap G-7):** KİLİTLİ DÖNEM içinde tarihli karşılıksız (tarih ≤ L) REDDEDİLİR — "kilitli dönemde kaynak değişmez (409) ve kilitli dönemin maddeleri donmuştur"; madde
    yazılmaz, cari değişmez, olay `retler`'de (bakım 1'in kilitli kaynak `kayit_sil` reddiyle aynı düzen; HTTP kodu denetlenmez). S66'ya özgü değil, bütün karşılıksızlara uygulanır; kâhinde
    kilit yalnız göçte (`goc {kilit}`) var → yalnız göç senaryolarında görülür.
  - VERİLEN carisiz evrak karşılıksız dönmez (kararda yok) → kâhin kurmaz (hata).

### Senaryolar (bakım 2)
- `senaryolar/g6-s65-acilis-basi` (göç, yalnız model): "Açılış" / "AÇILIŞ" / "açılış farkı" / "Acilis" aday; "2025 açılış farkı" / "Yeniden açılış" / "Devir açılış farkı" aday değil; listede
  olmayan kaydın onayı ret; adayın reddi → 602; göç öncesi silinip göçten sonra geri alınan ortada-açılışlı kayıt aday değil (B8 × S65).
- `senaryolar/g7-s66-carisiz-karsiliksiz` (göçsüz; programla da koşulabilir — cari seçimi uç adı yok, ATLANAN): carisiz çek cari seçilerek, carisiz senet cari seçilmeden karşılıksız;
  portföyde kalan carisiz çek; cari bakiyesi + yaşlandırma.
- `senaryolar/g8-s66-kilitli-donem` (göç + kilit, yalnız model): donmuş eski carisiz evrakın kilitten sonra karşılıksızı (Y1), kilitsiz eski evrakın karşılıksızı cari seçilerek, kilitli
  dönem içinde tarihli karşılıksız ret (Y2).

### Mutantlar (bakım 2; değerle yakalanmalı — `oz-test.py`)
35 S65 B: ortada geçen "açılış" da aday · 36 S66 B: cari seçilmezse gidere (B 770 / A 101) · 37 S66: cari seçilse de cari borçlanmaz (B 649 / A 101) · 38 G-7 B: kilitli dönem içinde tarihli
karşılıksız kabul (madde donmuş döneme yazılır). `kos.mjs` "tam senaryo" listesine EKLENMEDİ (olayları `senaryo.json`'da değil — 22–31, 34 gibi elle senaryolarda).

### Değişen eski beklentiler (G3)
YOK — eski senaryolarda ortada geçen açılış açıklaması ve carisiz evrak karşılıksızı yoktu (bakım 1 kâhini bu durumlarda HATA veriyordu); `senaryo.json` (+ 2.5.0 olayları çıkarılmış 2.4.3 olay
dili hâli) ve g1–g5'in 2.5.0 ve 2.4.9 çıktısı, mutasyonsuz ve 1–34 mutantlarıyla, bakım 1 kâhiniyle (`a5a89a1f`) bayt bayt AYNI: 490/490 (kanıt `docs/kanit/2026-11-06/kahineski2-esdeger-defter-*`).
Yeni senaryolar bakım 1 kâhininde beklenen NEDENLE çöker (ders 7, 38): g6 "SK-1 … ortada geçen eski kayıt ('2025 açılış farkı')", g7 / g8 "SK-2 … carisiz (açılış değil) evrakın karşılıksızı".

### Eşleme notları (Ç5-A kod ajanı için; `kos.mjs`)
- S66 cari seçimi bakım 1'in S48 eşlemesini kullanır: `karsiliksiz {cek, tarih, cari}` → `UCLAR.karsiliksiz_cari` (uç adı Ç5-A'da verilir; verilene kadar olay ATLANAN, sonuç yeşil sayılmaz);
  cari seçilmeyen karşılıksız bugünkü `bounce` eşlemesiyle gider (açılış evrakı ve formdan carisiz evrak aynı). `kos.mjs`'te yalnız açıklama satırları güncellenir.

### KULLANICIYA SORULMALI (bakım 2)
YOK (S65 / S66 metni bu kâhinin durumlarını çözdü; Y1 / Y2 yorumdur — yukarıda gerekçeli, BAŞ MİMAR'a gösterilir).

### DENENMEYEN (bakım 2; neden)
- g6 / g8 programla koşulamaz (göç — bakım 1 ile aynı neden); g7'nin cari seçimi olayı uç adı verilene kadar ATLANAN.
- Kural Farkı fişinin karşılıksız dönmüş donmuş evrakla birlikte ön izlemesi (fiş yalnız alış maddesinin eski ↔ yeni farkını alır; ekran ön izlemesi bu kâhinin çıktısında yok).
- Karşılıksızdan sonra aynı evrakın yeniden işlem görmesi (karşılıksız evrakın tahsili / cirosu) — kararda yok.

## 2.5.0 Ç5 bakımı 3 (12.11.2026; eski kâhinler bakımı 13 — kodu görmeyen AYRI el)

Kural seti adı değişmedi (`2.5.0` varsayılan = bakım 1 + 2 + bu bölüm; `--kural 2.4.9` AYNEN). Bu bakımda PARA / DEFTER KURALI DEĞİŞMEDİ: yalnız bir senaryo ön koşulu, onun
denetimi ve kâhinin öz testi.

### Kaynak (temiz oda; ders 5, 40)
- **Karar metni:** ana oturumun girdi dosyası (12.11.2026; bu bakımın TEK girdisi) — (1) BAŞ MİMAR KARARI 12.11.2026, (2) öz test, (3) yapılmayacaklar (S127 konusu bu bakımın işi değil; başka kural
  değişikliği yok). Önceki kararlar yalnız bu dosyanın yukarıdaki bölümlerinden.
- **Okunan / okunmayan:** bakım 1'in alanı daraltılarak (bu klasör + girdi + CLAUDE.md + `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; `kos.mjs` yalnız olay eşlemesi için). Program koşulmadı, programın
  davranışı aranmadı; `docs/erp/**`, `docs/devir/**`, iş listesi bu bakımda OKUNMADI. Tam liste ajan raporunda.

### ÖK-1 — BAŞ MİMAR KARARI 12.11.2026 (senaryo dilinin ön koşulu; para / defter kuralı DEĞİL)
- **Metin (girdi (1), AYNEN):** "Ürünün 2.0.4 sürümünden beri var olan, 2.5.0'da DEĞİŞMEYEN bir giriş denetimi: Excel / Sheets'ten taksit kartı, aynı grupta aynı adla AÇIK bir kartı
  (taksitli faturanın kartı dahil) bulunan kişiye YÜKLENEMEZ; yükleme reddedilir, hiçbir kayıt oluşmaz. Bu bir muhasebeleştirme kuralı değildir (hiçbir kaydın hesabını / tutarını
  belirlemez); yalnız 'bu olay gerçekte kurulamaz' bilgisidir."
- **Neden kâhine girdi:** kâhin böyle bir `excel_taksit_karti` olayını kurulmuş sayıp sayı üretirse, gerçekte hiç oluşmayan bir kaydın beklentisi karşılaştırmada nedeni kararla
  açıklanamayan fark üretir (girdi: beş denetim, hepsi tek olaydan). Kâhin hiçbir maddenin hesabını / tutarını bu karardan almaz — yalnız olayı KURMAZ.
- **Kâhindeki karşılığı:** `excel_taksit_karti {cari}` olayı, AYNI CARİNİN o an AÇIK bir taksit kartı varken gelirse kâhin sayı ÜRETMEZ, hata verir ("ÖK-1 … kâhin kurmaz"). Açık taksit kartı (kâhinin
  senaryo dilinde yalnız iki kaynak):
  (i) aynı carinin DAHA ÖNCEKİ taksitli satış faturası (`fatura` `satis`, `odeme.taksit`) — iptal edilmemiş (`iptal` yok) ve kalanı (ödenecek − o faturanın `taksit_tahsil`leri) > 0;
  (ii) aynı carinin DAHA ÖNCEKİ `excel_taksit_karti`'sı — silinmemiş (`kayit_sil` yok) ve T − P > 0.
  Ön koşulu çiğneyen senaryo ders 7 / 38 gereği beklenen NEDENLE çöker (öz test `beklenenHata`).
- **EN DAR OKUMA** (girdi (1) son madde: "aynı cari + o an açık kartı var") ve **SUSTUĞUM SINIRLAR** (kâhinin senaryo dilinde karşılığı yok → uydurulmadı; bu durumlarda kâhin hata VERMEZ,
  olayı kurar — senaryolar bu durumlara Excel kartı KOYMAZ):
  - **SS-1 "aynı grupta":** grup kavramı senaryo dilinde yok → kâhin grup ayırmaz (tek grup gibi).
  - **SS-2 "aynı adla":** kâhin aynı CARİ'ye (kimlik) bakar; aynı adlı iki AYRI cari kâhinde kurulmaz (bakım 1 DENENMEYEN — defter kâhininin cari çıktısı ada göre). Senaryolarda Excel kartı alan
    carinin adı benzersizdir.
  - **SS-3 kapanmış / silinmiş kart:** kalanı 0'a inmiş taksitli fatura kartı, T = P Excel kartı, iptal edilmiş taksitli fatura, Silinenler'deki Excel kartı → "açık" SAYILMAZ.
  - **SS-4 taksit kartı dışındaki kayıtlar:** cari açılışı (`cari_acilis`), Borç / Alacak Yaz, cari seçilerek karşılıksız, açık hesap / peşin fatura, çek / senet → kâhin bunları "kart" SAYMAZ (karar
    yalnız taksit kartını ve "taksitli faturanın kartı"nı anıyor).
  - **SS-5 kartın kalanı:** yalnız o kartın `taksit_tahsil`leriyle düşer; genel tahsilat / çek / mahsup kartı kapatır mı — kararda yok.
  - **SS-6 2.4.9 kuralı:** Excel kartının 2.4.9 karşılığı zaten tanımsız (D9 — hata); değişmedi.
- **Girdi ↔ kâhin dili ayrımı (BAŞ MİMAR'a bildirilir):** girdi "`g4`'te M1'in açık bir kartı var" diyor. Kâhinin senaryo dilinde M1'in `g4`'teki olayları cari açılışı (M1A), Borç Yaz (BY1) ve cari
  seçilerek karşılıksız (AE2K) — SS-4 gereği hiçbiri taksit kartı değil → ESKİ `g4` bu denetimle hata VERMEZ. Programın M1'de neyi kart saydığı kararda yok; uydurulmadı. EX1 yine de taşındı (her
  okumada güvenli yere — aşağıda).

### EX1'in yeni yeri (girdi (1) a, d) — elle beklenenler, kâhin koşulmadan ÖNCE yazıldı
- **`senaryolar/g4-yeni-kayitlar.json`:** EX1 M1 (Elle Alfa Ltd.) → YENİ cari **M2 "Elle Excel Müşterisi Ltd."** (müşteri; senaryoda başka HİÇBİR olayı yok). Neden o: g4'ün öbür carisi T1
  tedarikçi — D9'un denediği yazım müşteri alacağı (B 120 (T − P) / A 519); tedarikçiye taşımak kuralın sınadığı hesabı değiştirirdi (kapsam daralır). M1'de kalmak ya da açılışı / Borç Yaz'ı olan
  bir cari, SS-4'ün öbür okumasında (programın onları kart sayması) yine çiğneyebilir; olaysız yeni cari HER okumada ön koşulu çiğnemez. Tarih (12.09), toplam (900), ödenen (300) AYNEN → D9 aynı
  tutarla, aynı günde sınanır. `kos.mjs` eşlemesi taşıyor (cari olayı + Excel satırında cari adı); eşleme değişmedi.
  Elle (TL; kaynak olay):
  - Mizan K1: DEĞİŞMEZ — 120 = 2.300 (alt cari değişir, ana hesap aynı), 519 = −8.500 (EX1 yine A 519 600), öbürleri aynen.
  - Cari bakiyeleri: Elle Alfa Ltd. 2.300 → **1.700** (M1A 1.000 + BY1 400 + AE2K 300; EX1 600 çıktı); Elle Excel Müşterisi Ltd. (yeni) **600** (EX1 T − P = 900 − 300); Elle Tedarik A.Ş. −650 aynen.
  - Yaşlandırma satırları: Elle Alfa Ltd. 2.300 → **1.700** (portföyde M1'in evrakı yok — AE2 karşılıksız); Elle Excel Müşterisi Ltd. (yeni) **600**. Toplam 2.300 → **2.300** (değişmez).
  - Stok, retler (KD1, KG0), onay listesi: DEĞİŞMEZ.
- **`senaryo.json` (tarama (d) — ÇİĞNİYOR):** EX1 (23.11, M2 Ahmet Yılmaz) geldiğinde M2'nin F13 taksitli satış kartı (23.09; KDV dahil 10 × 120 = 1.200; TK1 400 → kalan 800; iptal yok) AÇIK →
  kararın açık durumu ("taksitli faturanın kartı dahil"), SS'den bağımsız. → YENİ cari **M6 "Excel Kart Müşterisi Ltd."** (müşteri; başka olayı yok); tarih, toplam (6.000), ödenen (1.500) AYNEN.
  Elle (TL):
  - Mizan (bütün kontrol noktaları): DEĞİŞMEZ — EX1 23.11'de, yalnız K_SON'u etkiler; 120 ana hesapta aynı, 519 = −73.700 aynen.
  - Cari bakiyeleri: Ahmet Yılmaz 5.600 → **1.100** (F5 1.610 − peşin 1.610; F11 240 − iptal 240; F13 1.200 − TK1 400; F14 4.040 − havale 4.040; BY2 300; EX1 4.500 çıktı); Excel Kart Müşterisi
    Ltd. (yeni) **4.500**.
  - Yaşlandırma satırları: Ahmet Yılmaz 5.600 → **1.100** (portföy evrakı yok); Excel Kart Müşterisi Ltd. (yeni) **4.500**; toplam DEĞİŞMEZ.
  - KDV, stok, stopaj özeti, yevmiye sırası, retler: DEĞİŞMEZ.
- **g1–g3, g5–g8:** Excel taksit kartı yok → çiğneyen olay YOK.

### Senaryolar (bakım 3)
- `senaryolar/g9-ok1-acik-taksitli-fatura` ve `senaryolar/g9b-ok1-acik-excel-karti` — ön koşulu ÇİĞNEYEN senaryolar (`beklenenHata: "ÖK-1"`): taksitli satış kartı kısmen ödenmiş (kalan 800) iken / ilk
  Excel kartı açık (kalan 600) iken aynı cariye Excel kartı. Yalnız `oz-test.py`; programla KOŞULMAZ (kâhin hata verir — `kos.mjs` bunlarda beklenen hesaplayamaz).
- `g4` ve `senaryo.json`: EX1 olaysız yeni cariye (yukarıda); elle tablolara cari bakiyeleri ve yaşlandırma satırları (`yaslandirmaCariler`) eklendi.

### Mutant (bakım 3; `oz-test.py`)
39 ÖK-1 denetimi yok (çiğneyen senaryo sessizce sayı üretir) — g9 / g9b'de "beklenen çöküş kalktı" diye yakalanır. EX1'in kuralı için bakım 1 mutantları taşınan olayla DEĞERLE (çöküş değil): 21 (KG-5 B)
kontrol mizanında 519 ve 600'ü değiştirir (g4 K1: 519 −8.500 → −7.600, 600 0 → −900; `senaryo.json` K_SON: 519 −73.700 → −67.700, 600 −67.300 → −73.300; cari / yaşlandırma T − P net aynı), 14 (500)
519 / 500'ü (g4 K1: 519 −8.500 → +600, 500 → −9.100). Kanıt `docs/kanit/2026-11-12/kahineski13-mut-ex1.out`. `kos.mjs` "tam senaryo" listesine EKLENMEDİ (kos.mjs
değiştirilmedi; ÖK-1 çiğneyen senaryo programla koşulmaz).

### `oz-test.py` ekleri (bakım 3)
`beklenenHata` (senaryo kâhinde beklenen metinle çökmeli; çökmezse ya da başka nedenle çökerse kırmızı; mutantın çöküşü kaldırması yakalanma sayılır) ve `yaslandirmaCariler` (müşteri başına
yaşlandırma satırı). Öz test bakım öncesi tabanda (`a55e47e4`) iki saat diliminde YEŞİLDİ (171/171); bakımdan sonra 181/181 (UTC ve Europe/Istanbul). Yeni öz test ESKİ kâhinle (bakım 2) beklenen
NEDENLE kırmızı: g9 / g9b "çökmedi — sayı üretti" (178/180).

### Değişen eski beklentiler (G3; hepsi EX1'in taşınmasından — ÖK-1)
Bakım 2 kâhini (eski senaryolar) ↔ bakım 3 kâhini (yeni senaryolar), her senaryo × iki kural × mutant 0–39: fark YALNIZ `senaryo.json` ve `g4`'te, YALNIZ yukarıda elle yazılan cari bakiyesi ve
yaşlandırma satırlarında (eski cari −T+P, yeni cari +T−P; mizan, toplamlar, KDV, stok, retler aynen); g1–g3, g5–g8 bayt bayt AYNI (BEKLENMEYEN 0 — sayılar ajan raporu / kanıt
`docs/kanit/2026-11-12/kahineski13-*`). Yeni kâhin ESKİ `senaryo.json`'da ÖK-1 nedeniyle çöker (beklenen — çiğneyen olay), ESKİ `g4`'te çökmez (SS-4).

### Eşleme notları (`kos.mjs` — değiştirilmedi)
Yeni cariler (`g4` M2, `senaryo.json` M6) `cari` olayıyla açılır (açılışsız: `registeredOn` 2026-01-01); EX1'in Excel satırı carinin ADINI taşır (eşleme aynen). Yeni olay türü / alan YOK.

### KULLANICIYA SORULMALI / BAŞ MİMAR KARARI GEREKİYOR (bakım 3)
- **BM-1 (bildirim; kural değil):** girdi `g4`'te M1'in açık kartı olduğunu söylüyor, kâhin dilinde M1'in olaylarından hiçbiri taksit kartı değil (SS-4). Programın M1'de neyi kart saydığı (cari
  açılışı mı, "AÇILIŞ BAKİYESİ" açıklamalı Borç Yaz mı, cari seçilerek karşılıksız mı) kâhinin konusu değil, ama bu bir KART TANIMI farkıdır: başka bir senaryoda Excel kartı açılışı / Borç Yaz'ı olan
  bir cariye konursa kâhin sayı üretir, program reddeder. **A (öneri):** kâhin en dar okumada kalsın; senaryolar Excel kartını yalnız olaysız cariye koysun (bu bakımda yapıldı). **B:** baş mimar kart
  sayılan kayıtları karar metniyle yazsın; kâhin ÖK-1'i genişletir. **C:** uç durum böyle kalsın (BİLİNEN SINIR).

### DENENMEYEN (bakım 3; neden)
- SS-1 … SS-5'in sınırları (grup, aynı adlı ayrı cari, kapanmış / iptal / silinmiş kart, taksit kartı dışı kayıt, genel tahsilatla kapanan kart): kararda yok → senaryo KURULMADI (kâhin bu durumlarda
  hata vermez; beklentisi yazılmadı).
- Program koşulmadı (görev gereği; `npm run test:kahin-defter` ana oturumda).
