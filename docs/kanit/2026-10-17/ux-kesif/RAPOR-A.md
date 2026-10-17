# Keşif Testi A — Cari, Kasa, Taksit, Kayıtlar, Menü, Yetki (2.4.3, 17.10.2026)

Ortam: depo `claude/hopeful-goodall-6nmtcj` HEAD 274b7ad (ürün kodu 2.4.3), `bootVersion(CURRENT)`, `HUKUK_LICENSE_URL=http://127.0.0.1:9`,
Playwright Chromium (headless), tr-TR. Ürün koduna, testlere ve git'e dokunulmadı. Betikler: `ux-kesif-A/k*.mjs`, ham günlük `ux-kesif-A/gunluk.txt`,
hiza taraması `ux-kesif-A/hiza.txt`, ekran görüntüleri `ux-kesif-A/shots/` (96 adet). Veri kopyası koşu sonunda silindi.

Veri (API'den, programın kendisi üretti — `serve.mjs`): 56 cari (aynı adlı iki "Ahmet Yılmaz" No 1 / No 53, 80+ karakterlik unvan, ğüşıöç'lü adlar,
6 tedarikçi), 12 aya yayılmış borç/tahsilat (~200 satır), 14 cariye bağlı taksit kartı + 40 taksit tahsilatı, 59 kasa hareketi, 25 kayıt (tablo),
kullanıcılar `personel1` (Personel) ve `muhasebe1` (Muhasebe). Ekrandan insan hızında (40–80 ms tuş aralığı, Tab, gerçek tıklama) yürütüldü.
Kâhin: ekrandaki her sayı veri tabanından ayrı SQL ile (programın formülü kullanılmadan) hesaplanıp karşılaştırıldı.

Özet: **YÜKSEK 1 · ORTA 8 · DÜŞÜK 13** (toplam 22). Para/sayı tutarlılığı (kasa, cari listesi, raporlar, ay sınırı, ekstre) denenen her yerde DOĞRU çıktı;
en önemli bulgu aynı adlı cari açılınca kaydın kendiliğinden yeni cariye bağlanması ve kayıttan girilen tahsilatın yanlış cariye düşmesi.

---

## YÜKSEK

### A1 — Aynı adla açılan yeni cari tablodaki kayda kendiliğinden bağlanıyor; kayıttan girilen tahsilat borçlu kişiye değil yeni, boş cariye yazılıyor
- Ekran: Cari → + Yeni Cari; ana sayfa kayıt detay kartı → Tahsilat.
- Yeniden üretim:
  1. Veride "Ahmet Yılmaz" adlı iki cari (No 1 borçlu ₺5.421, No 53) ve BORÇLU sütunu "Ahmet Yılmaz" olan kayıt 2026/100 var (hiçbir cari bağlı değil).
  2. Cari → + Yeni Cari → Ad alanına "Ahmet Yılmaz" yaz, Tab.
  3. Form "2 cari aynı adla kayıtlı: No 1 … No 53. Aynı kişiyse yeni cari açmayın" uyarısını gösteriyor VE aynı anda "Tablodaki Kayıt: Tabloda aynı adlı
     kayıt bulundu ve seçildi" diyerek 2026/100'ü kendiliğinden seçiyor. Kaydet → onay sorulmadan No 57 açılıyor (`accounts.case_key = '2026/100'`).
  4. Ana sayfada kayıt 2026/100'ü aç → Tahsilat → başlık yalnız "Ahmet Yılmaz · Tahsilat · Cariden para alındı…" (hangi cari No olduğu yazmıyor) → 321 → Enter.
- Beklenen: tahsilat borçlu kişiye (No 1) gitmeli ya da en azından hangi cariye yazılacağı (No, telefon) formda görünmeli; üç aynı adlı cari varken kayıt
  sessizce en son açılana bağlanmamalı.
- Gözlenen (DB): No 1 tahsilat 2.166 → 2.166 (değişmedi), No 57 0 → 321; bildirim "Tahsilat kaydedildi. Bakiye ₺321,00 Alacaklı". Ana sayfa
  "Toplam Borç / Ödemeler" ₺12.771 → ₺13.092 (borçlu müşteri, firmanın borcu gibi görünüyor); Raporlar "Alacaklılar" ₺13.092.
- Ölçüm: 3 aynı adlı cari, 1 kayıt kendiliğinden bağlandı, 321 TL yanlış cariye.
- Görüntü: `shots/k9-02-yeni-cari-ayni-ad.png`, `shots/k9-03-yeni-cari-kaydet.png`, `shots/k13-03-kayit-tahsilat-form.png`, `shots/k14-01-kayit-tahsil-sonrasi.png`,
  `shots/k22-01-anlik-banka.png`.
- Not: Ön koşul kullanıcının aynı-ad uyarısını geçmesi; ama uyarı ile kendiliğinden bağlama aynı formda çelişiyor ve tahsilat formu cariyi ayırt etmiyor.

## ORTA

### A2 — Bağlı carisi olan kayıttan girilen tahsilat kaydın İŞLEM GEÇMİŞİ'nde görünmüyor
- Ekran: kayıt detay kartı → Tahsilat; İŞLEM GEÇMİŞİ.
- Adımlar: A1'in 4. adımı → sayfayı yenile → 2026/100'ü aç.
- Beklenen: tahsilat satırı + "Toplam Tahsilat" geçmişte. Gözlenen: geçmişte yalnız not var; tahsilat yok. Raporlar → "Kayıt Kartından Tahsilatlar"
  (Bu Yıl) boş. Koddan: `server/routes/workspace.mjs:334` geçmiş yalnız `payments` tablosunu okuyor; bağlı cari yolunda tahsilat `account_entries`'e yazılıyor.
- Görüntü: `shots/k15-detay-panel.png`.

### A3 — Aynı adlı cari uyarısı var ama kaydet onaysız geçiyor (çift/üçlü cari)
- Ekran: + Yeni Cari. Adımlar: A1 adım 2–3. Beklenen: "Yine de yeni cari aç?" sorusu (fatura/eksi kasa gibi). Gözlenen: tek tıkla No 57 açıldı,
  bildirim "Cari açıldı." (3,85 sn). Ölçüm: cari sayısı 56 → 57. Görüntü: `shots/k9-02-yeni-cari-ayni-ad.png`.

### A4 — Dolu form Esc ya da arka plana tıklamayla uyarısız kapanıyor, girilen veri kayboluyor
- Ekran: Cari → + Yeni Cari (25 alanlı form); cari kartı → + Tahsilat.
- Adımlar: (a) + Yeni Cari → "Kaybolacak Kişi" + telefon yaz → Esc. (b) + Yeni Cari → "Arka Plan Tık" yaz → pencere dışına (10,380) tıkla.
  (c) + Tahsilat → 999 yaz → Esc.
- Beklenen: "Girdiğiniz bilgiler kaybolacak, kapatılsın mı?" (fatura formu bunu soruyor — e2e şablonundaki `closeAll` onay düğmesine basıyor).
- Gözlenen: üçünde de pencere sorusuz kapandı, veri kayboldu. Görüntü: `shots/k21-02-yeni-cari-esc.png`, `shots/k5-02-esc-kirli.png`.

### A5 — Cari Sil onayı "taksit kartı olan cari silinmez" diyor ama Sil düğmesini sunuyor; basınca hata
- Ekran: cari kartı (No 1, 1 taksit kartı) → Sil.
- Adımlar: Cari → No 1 → Sil → onay penceresi "… Taksit kartı olan cari silinmez." → Sil.
- Beklenen (ürün kuralı "pasif düğmenin nedeni görünür yazı"): Sil pasif + neden ya da onaya gelmeden ileti.
- Gözlenen: 409 + kırmızı bildirim "Bu carinin 1 taksit kartı var. Önce kartları silin ya da başka cariye taşıyın; kapatılan kartlar da sayılır."
  Ölçüm: bildirim 5.451 ms, 18 sözcük. Görüntü: `shots/k19-01-cari-sil.png`, `shots/k19-02-cari-sil-sonrasi.png`.

### A6 — Aynı bildirim üst üste yığılıyor ve cari kartının araç çubuğunu örtüyor
- Ekran: cari kartı. Adımlar: A5'i 6 kez arka arkaya yap.
- Gözlenen: 4 özdeş kırmızı bildirim (en fazla 4 sınırı) üst ortada (top 14 → 294 px) "Cari Ekstre - PDF / Yazdır / Düzenle" düğmelerinin üstünde;
  tekilleştirme yok. Görüntü: `shots/k19-03-yigilma.png`.

### A7 — Banka hesabı yokken "Kasadan Bankaya Yatır" onaysız kaydediliyor; bugünkü hareket "Eski Hareketler" adıyla hiçbir toplama girmiyor
- Ekran: Kasa → Kasadan Bankaya Yatır (banka hesabı tanımlı değil).
- Adımlar: 1000 yaz → Bankaya Yatır.
- Gözlenen: soru sorulmadan kaydedildi; Nakit Kasa 227.038 → 226.038; banka tarafı `fin_ref` boş; Anlık Durum "Gerçek Banka —" ve altında
  "Hesabı Atanmamış Eski Hareketler ₺1.000"; Banka ekranı "Gerçek Banka'ya ve hiçbir toplama girmez". Formda küçük yazı var ama kayıt anında onay yok;
  az önce girilen hareketin adı "Eski".
- Görüntü: `shots/k7-03-bankaya-yatir.png`, `shots/k21-01-bankaya-yatir-kaydet.png`, `shots/k22-02-banka.png`.

### A8 — Cari "Bakiye" taksit kalanını içeriyor ama yanındaki "Taksitten Kalan" kutusu bunu söylemiyor (toplanabilir sanılıyor)
- Ekran: cari kartı (No 1) ve Cari listesi üst kutuları.
- Gözlenen: Kart: "Bakiye ₺5.421 Borçlu" + "Taksitten Kalan ₺4.400" (DB: cari hareketleri 3.187 − 2.166 = 1.021; 1.021 + 4.400 = 5.421 → kalan bakiyenin İÇİNDE).
  Liste: "Borçlular ₺336.980" yanında "Taksitlerden Kalan ₺148.300" (336.980 = 188.680 + 148.300). Hiçbirinde "bakiyeye dahil" yazmıyor; kullanıcı
  9.821 / 485.280 diye toplayabilir. Sayılar doğru, ileti eksik. Görüntü: `shots/k3-01-kart.png`, `shots/k2-01-cari-liste.png`.

### A9 — "Tahsilat Alınmadı" bildirim kutusu sürekli dönüyor ve 1366×768'de kayıt detay panelini örtüyor
- Ekran: ana sayfa. Ölçüm: 5 sn örnekleme, 45 sn: kutu ~18 sn görünür, ~10 sn yok, sonra sıradaki geciken (1/5…) — kapatılmadıkça sürüyor;
  konum 976,622 → 1348,750 (372×128 px); detay panelinin TELEFON değerini ve işlem düğmelerini kapatıyor (personel ve yönetici).
- Görüntü: `shots/k1-01-acilis.png`, `shots/k16-01-personel-ana.png`, `shots/k12-01-ana-1920.png`.

## DÜŞÜK

- **A10 — Kayıttan sonra odak kayboluyor.** Cari kartı → + Tahsilat → Enter ile kaydet → `document.activeElement` = BODY (iki koşuda). Klavyeyle devam için
  fareye dönmek gerekiyor. (`gunluk.txt` "ENTER sonrası")
- **A11 — Hata bildirimi süresi sınırda.** Hata 5,2 sn (ölçülen 5.451 ms), 18 sözcüklük iletide ~6,4 sn gerekir; başarı bildirimleri 3,85 sn (kısa iletiler, yeterli),
  "Makbuz" düğmeli olanlar 7,25 sn.
- **A12 — Süzgeç satırında yükseklik farkı.** Cari listesi: "Cari Listesi – PDF" düğmesi 3 satıra kırılıyor, satırda 36 px seçici ~ 52 px düğme (1280/1366/1920
  hepsinde). Taksitler: seçiciler 36 px, Liste-PDF/Yazdır 32 px. (`hiza.txt`, `shots/k2-01-cari-liste.png`, `shots/k17-1280-10-taksitler.png`)
- **A13 — Kutu başlığı kesiliyor.** Ana sayfa "Toplam Borç / Ödemeler" 1280 ve 1366'da "Toplam Borç / Ödemel…" (136 > 118 px). (`shots/k1-01-acilis.png`)
- **A14 — Açılışta ara sıra düzen kayması.** 1366×768'de 7 yüklemenin 2'sinde CLS 0,071–0,073 (Sayfalar şeridi geç gelip tablo + detay panelini aşağı itiyor);
  öbürlerinde ≤ 0,01. Sayfa geçişlerinde (Cari/Kasa/Taksit/Raporlar 5 geçiş) CLS 0,0000; modal içerikleri ilk 50 ms karede dolu (Taksitler ilk karede 0 satır, 50 ms sonra 15).
- **A15 — Yazım düzeni.** "Çalışma verisi" (H1/H2; program varsayılanı, `server/lib/dataset.mjs:555`), "Yönetim paneli" başlığı; hareket türü "Taksit tahsilatı",
  "Cari tahsilat" (cari kartı, Kasa, ekstre PDF) — aynı kolonda "Taksit Planı", "Borç", "Tahsilat" büyük; Roller açıklamasında "+ Yeni rol" (düğme "+ Yeni Rol").
- **A16 — Not Ekle'de klavyeyle kaydetme yok.** Ctrl+Enter ve Enter (metin alanı) kaydetmiyor; yalnız "Notu Kaydet".
- **A17 — Tab sırası uzun.** Ana sayfada Tab ana alandan başlıyor: zil, Rapor Al, 8 kutu, sonra Tahsilat Takvimi'nin 40 hapı; sol menü ve kayıt tablosu çok sonra.
  Zil (45) odağında görünür çerçeve yok. Tarih alanı 4 Tab durağı (gün/ay/yıl/takvim düğmesi; takvim düğmesinde odak görünmez — tarayıcı davranışı).
- **A18 — Kayıt tablosu dar.** 1366×768'de 5 kolonlu kayıt tablosu yatay kaydırma istiyor, TUTAR kolonu kesik; tutarlar "25000,00" biçimsiz (üstteki kutu "325.000").
  (`shots/k16-01-personel-ana.png`)
- **A19 — Personele yanlış yol.** Personel /admin.html: "…Raporlar → Tüm raporlar → İşlem geçmişi'nden görebilirsiniz" — personelin menüsünde Raporlar yok.
  (`shots/k16-05-personel-admin.png`)
- **A20 — Personel ana sayfasında boş bant.** Anlık Durum gizlenince üstte ~55 px boşluk kalıyor. (`shots/k16-01-personel-ana.png`)
- **A21 — Aynı adlılar bildirim/takvimde ayırt edilmiyor.** Tahsilat Takvimi hapları ve "Tahsilat Alınmadı" kutusu yalnız "Ahmet Yılmaz" yazıyor (No/telefon yok);
  cari listesi aramasında No + telefon var (orada sorun yok).
- **A22 — Cari ekstre PDF'inde alt TOPLAM satırı yok.** Toplamlar üstte özet kutularında; ürün kuralı "her raporda alt TOPLAM satırı" — ekstre için istisna mı, karar gerek.
  (pdftotext çıktısı: satırlar 3.187 / 2.166 / 6.000 / 800 / 800 → bakiye 5.421 borçlu, özetle aynı.)

Konsol/ağ: her girişte giriş sayfasındaki `401 GET /api/auth/me` (oturum yokken beklenen) dışında beklenmeyen 4xx/5xx yok; görülen 400/409'lar
bilerek tetiklenen doğrulamalar (geçersiz tutar, ileri tarih, eksi kasa, taksitli cari silme). `pageerror` 0. 1 sn'yi aşan istek 0.

---

## Denenen akışlar (sonuç)
- Giriş → ana sayfa 1280×720 / 1366×768 / 1920×1080; sol menü geçişleri (Cari, Kasa, Taksitler, Raporlar, Banka, Yönetim).
- Cari listesi: arama (aynı adlı 2 ve 3 kişi No + telefonla ayırt ediliyor), üst kutular ↔ SQL: Borçlular 336.980 / Alacaklılar 12.771 / Taksit kalan 148.300 / Geciken 61.380,28 — DOĞRU.
- Cari kartı: + Tahsilat (Tab sırası, Enter ile kayıt, çift tık → TEK kayıt, geçersiz tutar → satır içi Türkçe ileti, ileri tarih → anlaşılır ileti), bakiye ekranda
  6.044 → 4.793,50 → 3.543 ve SQL ile aynı; Cari Ekstre PDF ↔ kart aynı; Sil (taksitli) → A5.
- + Yeni Cari: hiza, aynı ad uyarısı, kendiliğinden kayıt bağlama (A1/A3), Esc/arka plan (A4).
- Taksit: cari kartından + Taksit Planı (12.000 × 6), kart tahsilatı (2.000, tutar sıradaki taksitle öndolu), kalan 10.000; kartı Sil → Kasa ve "Tahsil Edilen 44.900" geri döndü.
- Kasa: + Tahsilat (350, Enter) → +350; − Ödeme 999.999 → "Kasa Eksiye Düşecek" onayı → Vazgeç, kasa değişmedi; satır sil (onaylı) → −350; Kasadan Bankaya Yatır (A7);
  Bankadan Kasaya Aktar formu; Bu Ay / Geçen Ay süzgeci ay sınırında (30.09 ve 01.10 hareketleri): Geçen Ay giriş 9.088 çıkış 1.913, Bu Ay giriş 5.254 çıkış 1.000,
  devreden 214.942 → 222.117 — SQL ile aynı.
- Kayıt detay kartı: Not (kaydedildi, geçmişte görünüyor), Telefon formu (açıldı, kaydedilmedi), Tahsilat (A1/A2).
- Raporlar (Bu Yıl varsayılan): Cari Mizanı dönem borç 404.453 / alacak 160.186; Cari Listesi ve Bakiyeler TOPLAM 541.594 / 220.284 / 321.310; Kasa Hareketleri
  175.401 / 11.016; Taksit Kartları 193.200 / 44.900 / 148.300 / 61.380,28; Cari Bazında Tahsilat 103.811 + 44.900 = 148.711 — hepsi SQL ile aynı.
- Bildirimler: süre ölçümü (MutationObserver), yığılma (A6), "Tahsilat Alınmadı" kutusu 45 sn (A9).
- Hiza/kırpılma taraması 13 ekran × 3 çözünürlük (`hiza.txt`): form alanları aynı hizada, yatay sayfa taşması yok, pencere ekrana sığıyor, para kolonları sağa yaslı.
- Yetkisiz kullanıcı (Personel): menüde Kasa/Fatura/Banka/Raporlar/Yönetim yok; Cari listesinde + Yeni Cari/Excel yok, kartta yalnız + Tahsilat/Yazdır
  (Borç Yaz/Ödeme/Sil gizli); Taksitler salt okunur; /admin.html "yalnız yönetici" iletisi (A19). Yönetici: Kullanıcılar sekmesi, kendi satırında Sil pasif.
- Yazım düzeni taraması (düğme, th, başlık, etiket, seçenek) 8 ekran (A15).

## Denenmeyenler
- Belge yükleme (sürükle-bırak, görüntüle/indir), Telefon kaydetme, Görev, Haciz, WhatsApp, Excel/Sheets'ten cari/taksit yükleme, Toplu Taksitlendir, Tablodan Aktar.
- Taksit Ödeme/İade, taksit tek tek düzeltme/silme, Otomatik Dağıt; cari Borç Yaz/Alacak Yaz/Ödeme kaydı (yalnız form açıldı); Pasife Al.
- Silinenler'den geri yükleme; iki kullanıcının aynı anda aynı cariye işlem yapması; Muhasebe rolüyle akış (yalnız kullanıcı oluşturuldu).
- Havale/POS/Çek yolu ile tahsilat (Banka modülü tanımsız), Banka Kurulum Sihirbazı.
- Yavaş ağ/CPU benzetimi (bütün istekler < 1 sn; yükleniyor göstergesi bu yüzden ölçülemedi).
- Gerçek Windows + Edge: headless Chromium tarih alanını ABD düzeninde (12/31/2026) gösterdi, "15112026" yazımı 11.12.2026 oldu — test ortamı (ders 14),
  bulgu SAYILMADI; Türkçe Edge'de gg.aa.yyyy beklenir, gerçek makinede bakılmalı.
- Kasa Dökümü PDF, Taksit Ekstresi PDF, Excel çıktıları (yalnız Cari Ekstre PDF okundu).

## Bilinen sınırlar / not
- "Bir kez görüldü" işaretli bulgu yok; A14 (CLS) ara sıra: 7 yüklemede 2.
- Veri API'den üretildi (eski sürüm verisi değil); mevcut iki aynı adlı cari kayda bağlı değildi — A1'in ön koşulu bu.
- Kâhin: ekrandaki sayılar ayrı SQL toplamlarıyla karşılaştırıldı (programın formülü kullanılmadı); taksit kartının cari borcuna eklenmesi kuralı SQL'de
  ayrıca doğrulandı (No 1: 3.187 + 6.000 = 9.187 borç, 2.166 + 1.600 = 3.766 alacak).
