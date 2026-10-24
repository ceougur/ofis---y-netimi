# 2.4.5 madde 9 — kullanıcı gözüyle ekran gezintisi (ajan gezinti-245, 24.10.2026 19:25–20:00 UTC)

Kod: dal `is/gezinti-245` = aday245-1 `6e58c0a` (ürün kodu değişmedi). Program `sunucu.mjs` ile ÜRÜN varsayılanıyla açıldı (server.mjs bayrakları; durum.json:
`legacyCasePayments: false`, `legacyTableTransfer: false`), SAHTE AKAN SAAT 21.10.2026 10:00 TR'den (config.now; tarayıcı saati de aynı), sahte EDM, lisans
servisi ölü adres (ders 30), Chromium 1366×768, sunucu + tarayıcı `flock kos.lock` altında. Her adım `adim.mjs` (CDP ile aynı sekme): gerçek tıklama, insan hızında
yazım (30–45 ms), Tab; tarih alanları `fill` ile (Chromium tarih kutusunda Tab gün/ay/yıl parçaları arasında dolaşıyor — bkz. adım 24). Sayılar her adımda API'den ve
veri tabanından (salt okunur sqlite) okundu. Girdi tablosu `tablo-uret.mjs` (uydurma kişiler, göreli tarih; `indirilen/girdi-Gezinti-Dosyalar.xlsx`).
Ekran görüntüleri `ekran/` (55 seçili, 128 renge indirildi), indirilen PDF/Excel `indirilen/`, başlık ve sayı dökümü `baslik-ve-sayilar.txt`.

## Adım sonuçları

| # | Adım | Beklenen | Gözlenen | Ekran | Sonuç |
|---|---|---|---|---|---|
| 1a | Şirket adı, Firma Bilgileri (unvan, VKN, VD, adres), Tabela Adı "Yıldız Yapı Market", Yalnız Tabela Adı | kaydedilir | settings `office.reportHeader` = {signName, mode:"sign"} | 06a, 07 | GEÇTİ |
| 1b | Yalnız Tabela Adı: Ayrıntılı Ekstre PDF+Excel, Cari Listesi PDF+Excel, kart Cari Ekstre PDF | başlık yalnız tabela | 5 dosyada 1. satır "Yıldız Yapı Market", unvan yok | 74 | GEÇTİ |
| 1c | Tabela Adı ve Firma Bilgileri: aynı raporlar + Kasa Dökümü, Raporlar→Cari Ekstre, Tablo Raporu PDF | tabela + unvan + VKN/VD + adres | 9 dosyada 4 satırlık başlık | 76a | GEÇTİ |
| 1d | Fatura PDF (iki modda) | unvan DEĞİŞMEZ | iki PDF'te de "Yıldız Yapı Malzemeleri Ticaret Ltd. Şti." (tabela yok) | — | GEÇTİ |
| 2a | Excel yükle (Borçlu Telefon, Borçlu TC Kimlik No, Alacak Tutarı, Söz Tarihi, Duruşma Tarihi) | 3 kayıt, kolon türleri | 3 kayıt; Telefon/T.C. NO/TUTAR/SON TARİH kesin | 10, 11 | GEÇTİ |
| 2b | Telefon hücresi | ham, tıklayınca wa.me | "5367715055", "10000000146"; tık → https://wa.me/905367715055 | 12, 13 | GEÇTİ |
| 2c | Kayıt kartında Tahsilat | YOK | DOM'da "Tahsilat" geçen düğme/bağlantı 0; kartta WhatsApp·Not·Telefon·Görev·Haciz·Belge·Düzenle | 13 | GEÇTİ |
| 2d | Taksitler | Tablodan Aktar YOK, Son Aktarımlar VAR | düğme yok; Son Aktarımlar açılıyor ("Henüz aktarım yok"); POST from-table 410 `table-transfer-closed`; POST cases/:key/payments 410 `case-payments-closed` | 16, 17 | GEÇTİ |
| 2e | Zil / takvim | tablo TUTAR kalemi yok, duruşma VAR | dues.items 0 (Söz Tarihi kalemi yok), deadlines 2 (Duruşma 25.10 / 26.10); şerit yok | 15 | GEÇTİ |
| 2f | Tablo Raporları | "(Muhasebe Kaydı Değil)" | "Tablodaki Toplam Borç (Muhasebe Kaydı Değil)" 36.550,50; kolonlar da etiketli | 19 | GEÇTİ |
| 3 | "Önce cari açın" | Açılış Bakiyesi BOŞ | arayüzde bu yola düğme kalmadı (2c, 2e); kodda kalan yol (HOF.workspace.payment) doğrudan çağrıldı → Yeni Cari: ad/telefon dolu, `openingBalance` "" | 20 | GEÇTİ |
| 4a | Cari aç (Ayşe Demir, TCKN) → Borç Yaz 10.000, Vade 24.10 (bugün+3) | due_date, takvimde kalem | DB debt 10000 due 2026-10-24; dues `account` "Tahsil Edilecek Borç" 10000 upcoming; şerit + zil "3 gün kaldı" | 26, 27, 28, 29 | GEÇTİ |
| 4b | Beklenen Ödeme 23.10 (Düzelt ✎) | pil o güne kayar, "(Ödeme Sözü)" | expected_date 2026-10-23; dues dueDate 23.10, label "… (Ödeme Sözü)", "2 gün kaldı" | 30, 31 | GEÇTİ |
| 4c | Pil kartı | Cariyi Aç / Tahsilat Gir (tutar = Kalan), Ödendi Say yok | kart: Tahsilat Gir · Cariyi Aç; form tutarı 10.000,00 | 32, 33 | GEÇTİ |
| 4d | Kısmi 4.000 → kalan 6.000 | kalem küçülür, sonra kapanır | kalem 6.000; ikinci form 6.000,00 dolu → dues boş, şerit kalktı, kayıt "Kapandı" (remaining 0) | 35, 36 | GEÇTİ |
| 4e | Kasa | iki tahsilat | Kasa ₺10.000 = 4.000 + 6.000 "Cari Tahsilat · Ayşe Demir" | 37 | GEÇTİ |
| 5a | Satış faturası vadeli (2 × 3.000 + %20 = 7.200, vade 26.10) + alış faturası (5.000 + %20 = 6.000, vade 27.10) + planlı banka gideri 1.500 (23.10) | üç kalem | dues: invoice in 7200, invoice out 6000, bank 1500 | 47, 52, 57 | GEÇTİ |
| 5b | Pil kartları | satış: Tahsilat Gir + Fatura Kartını Aç; alış: Ödeme Gir + Fatura Kartını Aç; banka: Planlı İşlemleri Aç; Ödendi Say yok | aynen; Ödeme Gir → "Alış Faturası KZY… Ödeme Yap"; Planlı İşlemleri Aç → Banka planlı listesi; Fatura Kartını Aç → FIS…001 kartı | 63, 66a, 66, 67a, 67, 68 | GEÇTİ |
| 5c | Tabloda BAŞKA kayıt (2026/102, cariye bağlı Mehmet Kaya) seçiliyken fatura pili → Tahsilat Gir 2.000 | faturanın kendi formu, doğru cari | form "Satış Faturası FIS2026000000001 · Tahsilat Ekle"; DB: in 2000 account=Ayşe Demir, invoice_id=FIS…001; Mehmet Kaya'ya satır YOK; fatura Kalan 5.200 | 64, 65 | GEÇTİ |
| 5d | Zil aynı kaynaklar (başka kayıt seçili) | aynı düğmeler | zil: banka Planlı İşlemleri Aç; satış Tahsilat Gir + Fatura Kartını Aç; alış Ödeme Gir + Fatura Kartını Aç; Tahsilat Gir → FIS…001 formu | 69, 91 | GEÇTİ |
| 6a | Ayrıntılı Ekstre (cari kartından) | kalemler girintili, Genel Toplam = cari bakiyesi | "› Montaj Hizmeti 2 Adet 3.000 · KDV'siz 6.000 · %20 · 7.200" (girinti 22 px); Genel Toplam 17.200 / 12.000 / 5.200 B = cari bakiyesi 5.200 | 71, 72 | GEÇTİ |
| 6b | Raporlar'dan | aynı | Raporlar → Tüm Raporlar → Cari Ekstre + "Fatura Kalemlerini Göster"; Raporlar → **Cari Ekstre** sekmesinde seçenek YOK (bkz. B3) | 70 | KISMEN |
| 6c | PDF ve Excel | ekran = PDF = Excel | üçünde Dönem 17.200 / 12.000, Genel Toplam 5.200 B, kalem satırı aynı | baslik-ve-sayilar.txt | GEÇTİ |
| 7a | Vade Takip satırına tıkla | doğru kart | cari vade → Mehmet Kaya cari kartı; fatura → FIS…001; planlı banka → Banka planlı; duruşma → tablo kaydı 2026/103 | 81, 82-* | GEÇTİ |
| 7b | Personel (rol varsayılanı) | 4–6'da görmemesi gerekenleri görmez | dues yalnız `account` (Mehmet Kaya 3.250,50) — fatura ve banka kalemi yok; /invoices 403, /bank/plans 403, Anlık Durum 403; menüde Fatura/Banka/Kasa/Raporlar yok; cari kartında Ayrıntılı Ekstre / PDF / Borç Yaz yok; "Faturaya Bağlı" → "Fatura ekranı fatura yetkisi olan hesaplara açıktır."; pil kartı Tahsilat Gir (3.250,50) + Cariyi Aç | 87, 88, 89a, 89 | GEÇTİ |

## Bulgular (ürün kodu değiştirilmedi)
- B1 ORTA (mantık): Tahsilat Takvimi şeridi tarih sırasız. Sunucu kalemleri kaynağa göre art arda ekler (routes/dues.mjs `items: [...items, ...planItems, ...chequeItems,
  ...invoiceItems, ...bankItems, ...accountDues.items(local), ...]`), istemci sıralamadan ilk 40'ı gösterir (hof-promises.js `items.slice(0, PILL_LIMIT)`). Gözlenen şerit:
  27.10 → 26.10 → 23.10 → **21.10 (bugün)**; bugün vadeli cari borcu EN SONDA (80). 2.4.5'in yeni `account` kaynağı listenin sonuna eklendiği için 40'tan çok fatura/taksit
  kalemi olan firmada cari vade pili hiç görünmeyebilir. Zil sıralı (69: 2 gün → 5 → 6). Sıralama eskiden de yoktu (d2cef7c aynı birleştirme), ama yeni kaynak riski artırıyor.
- B2 DÜŞÜK (yazım, eski): "Borç Yaz düzelt" pencere başlığı (hof-accounts.js:1017 `${ENTRY_LABEL[type]} düzelt`) → "Düzelt"; tablo kartında "Notu kaydet" düğmesi (paket app-*.js).
  senaryo-211 yakalamıyor.
- B3 DÜŞÜK (bulunabilirlik): Raporlar penceresinin ilk sekmesi "Cari Ekstre"de Fatura Kalemlerini Göster yok; seçenek "Tüm Raporlar → Cari Ekstre"de. İki ayrı "Cari Ekstre".
- B4 DÜŞÜK (ekran): Ayrıntılı Ekstre 15 kolon; 1366×768'de Borç / Alacak / Bakiye kolonları sağda kesik, yatay kaydırma gerekiyor (72). PDF'te Belge No "FIS20260000 / 00001"
  iki satıra bölünüyor.
- B5 DÜŞÜK (Excel): Ayrıntılı Ekstre Excel'inde Bakiye kolonu METİN ("10.000,00 TL B"), sıfır satırı sayı (0); Borç/Alacak sayı. Excel'de bakiye toplanamaz / süzülemez.
- B6 DÜŞÜK (mantık): Cari vade kalemi (pil, zil, Vade Takip) borç kaydının Açıklamasını göstermiyor ("Tahsil Edilecek Borç · 24.10.2026"); aynı caride iki vadeli borç ayırt edilemez.
- B7 DÜŞÜK (metin): Vade Takip alt notu "tahsilat ve ödeme kalemleri Taksit, Fatura, Çek / Senet ve Kasa'dan" — Cari (vadeli) ve Planlı Banka İşlemi yazmıyor. Pil kartında
  ödeme kalemi (alış faturası, banka gideri) için de "Beklenen"; zil başlığı "Yaklaşan tahsilatlar (7 gün)" ödemeleri de içeriyor. Pil etiketi "Planlı diğer gider" (küçük harf).
- B8 DÜŞÜK (metin, tablo kapısıyla çelişen eski ifadeler): sektör önerisi "Tahsilat ve Haciz araçları açık olur" (11); tablo bilgi şeridi "Ekim 2026 içindeki ödeme kayıtları
  öncelikli doğru veri olarak gösteriliyor"; Tablo Raporları kişi kolonunun adı "CARİ" (tablodaki kişiler cari değil); "önce cari açın" metni hâlâ "kaydedince tahsilat formu
  açılır … Açılış Bakiyesi'ne yazın" diyor ama arayüzde bu yola düğme kalmadı (kod yolu ölü).
- B9 DÜŞÜK (mantık): zil rozeti 'upcoming' kalemleri saymıyor — 4 gün sonraki duruşma sayılıyor (rozet 2), 2 gün sonraki ödeme sözü sayılmıyor. Eski tasarım.

## Test ortamı notları (ürün hatası DEĞİL, ders 14)
- PDF/Excel "Oluşturma: 21.10.2026 07:24" UTC yazıyor (Linux kapsayıcı TZ=UTC; sahte saat 10:24 TR). Gerçek kurulum Windows TR saatinde.
- Önizlemedeki "Söz Tarihi %50'i ileri tarihli": Excel çözümleme işçisi (Web Worker) sahte tarayıcı saatini almıyor (gerçek gün 24.10). Yönetim → Son Giriş gerçek saatle.
- Tarih kutusu ekranda aa/gg/yyyy (başsız Chromium'un yerel ayarı).

## DENENMEYEN
- Eski sürüm verisiyle (2.4.4 kayıt tahsilatları, Tablodan Aktar kartları) gezinti — Son Aktarımlar "Geri Al" ve eski tahsilatın Kasa'dan silinmesi ekrandan denenmedi.
- 002 şirketi, yedek/geri yükleme, Excel'den cari yükleme, taksitli fatura pili, çek pili, iade/iskonto/tevkifatlı faturada ayrıntılı ekstre, Gerçekleştir (planlı banka),
  Muhasebe rolü, gerçek Windows + Edge.
