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

### KULLANICIYA SORULMALI (kâhin bu durumları KURMAZ — senaryoda görülürse hata verir)
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
