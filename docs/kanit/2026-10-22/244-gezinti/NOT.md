# 2.4.4 madde 30c — kullanıcı gözüyle günlük iş akışı (ana oturum, 22.10.2026 16:40–17:15 UTC)

Kalite çıtası ("bir özellik bitince kullanıcı gözüyle ekranı aç, günlük iş akışını baştan sona yürüt") ve GÖZDEN GEÇİRME (7) / 3 (4) gereği.
Kod: çalışma dalı (aday 5 0c1ae0d + belgeler; aday 6'dan farkı yalnız EDM giriş katmanı ve araçlar). Program üretim bayraklarıyla (edocEnabled, edocLive,
esmmEnabled), sahte EDM (test/einvoice-mock.mjs, e-Fatura + e-SMM) ile; gerçek EDM'ye ve lisans servisine çıkılmadı (HUKUK_LICENSE_URL=http://127.0.0.1:9).
Sürücü: `sunucu.mjs` (programı + sahte EDM'yi + CDP'li tek Chromium'u açar) ve `adim.mjs` (her adımda aynı sekmeye bağlanır, adımı çalıştırır, ekranı alır,
pencere başlıklarını, bildirimleri ve konsol hatalarını yazar). Her alan gerçek tıklama + insan hızında yazım + Tab ile dolduruldu (ders 12).

## Yürünen akış ve görülen sayılar
1. Giriş → Başlarken 5 adım (madde 16). Şirket adı "Deneme Ticaret Ltd." → Başlarken 1/5; firma unvanı şirket adından dolu geldi (çift giriş yok).
2. Fatura Ayarları → Firma Bilgisi (VKN, vergi dairesi, adres, il/ilçe, e-posta) → kaydedildi; bozuk MERSİS değeri "MERSİS numarası 16 haneli olmalı" ile
   reddedildi (sürücünün kaydırdığı alan — ürün doğru). Entegratör Ayarları (Test Ortamı, sahte EDM adresi) → Bağlantıyı Test Et "Bağlantı kuruldu" →
   Etiketleri Getir → GB/PK seçildi → Başlarken 3/5.
3. Banka sihirbazı: Ziraat · Ana TL Hesabı · 102.01 · ₺50.000,00, Bakiye Doğrulandı → Başlarken 4/5.
4. + Yeni Cari: Müvekkil Ticaret A.Ş. (tüzel, VKN) → Mükellef Sorgula: e-Fatura mükellefi işaretlendi, PK etiketi yazıldı, "Unvanı Bununla Değiştir" önerisi;
   açılış bakiyesi ₺10.000 → kart: Borç ₺10.000, Bakiye Borçlu ₺10.000.
5. Hizmet Satışı faturası 5.000 + KDV %20 = ₺6.000 (yazıyla "Altı Bin Türk Lirası"). Firma e-Belge kullanıcısı işaretli DEĞİLKEN form kâğıt fişe (FIS…001)
   düştü → G1. "e-Fatura mükellefiyim / e-Arşiv kullanıcısıyım" işaretlenince: TEF2026862199245, "Alıcı e-Fatura mükellefi: e-Fatura kesilir." → Kaydet ve
   Gönder → "e-Fatura EDM'ye iletildi". Kartta kapalı Düzenle/Sil'in nedeni yazıyor.
6. Faturadan + Tahsilat Ekle → Çek / Senet: Kapatılacak Fatura seçili geldi, kural formda yazıyor (UX18) → Portföye Al → fatura "Ödendi", kartta "Genel Toplam"
   (UX17); cari: Borç ₺16.000 / Alacak ₺6.000 / Tahsil ₺0 / Bakiye ₺10.000; Kasa değişmedi.
7. + Taksit Planı: "Carinin Mevcut Borcu" ₺10.000 → 5 × ₺2.000 (01.11.2026–01.03.2027); carinin defterine ikinci kez borç yazılmadı.
8. Karttan nakit tahsilat ₺2.000 (tutar sıradaki taksitle dolu) → 1. taksit Ödendi, Kalan ₺8.000; Kasa ₺2.000 (tek satır "Taksit Tahsilatı").
9. Çek "Karşılıksız / İade İşaretle" → fatura yeniden AÇIK ₺6.000; cari Borç ₺22.000 / Alacak ₺8.000 / Bakiye ₺14.000 = açık fatura 6.000 + taksit kalanı 8.000;
   taksit kartı değişmedi; 001'de "Tahsilat Alınmadı · Vadesi Bugün" uyarısı.
10. Raporlar: Cari Ekstre (Bu Yıl) Borç 22.000 / Alacak 8.000 / Bakiye 14.000 + TOPLAM satırı; Vade Takip (Bu Ay) tahsil edilecek ₺6.000 (fatura; Aralık'taki
    taksitler ay dışında); Nakit Akış: bugün ₺52.000 (Kasa 2.000 + Banka 50.000), beklenen giriş ₺6.000, 30 gün sonu ₺58.000.
11. Yönetim → + Yeni Şirket "002 · Av. Selin Yıldız Hukuk Bürosu" → sınırda "+ Yeni Şirket" kayboldu (en fazla 2). 002: cari listesi boş (ayrım). Firma: Gerçek
    Kişi, TCKN, Ad/Soyad; Entegratör + "e-SMM kullanıcısıyım" → Kaşe/İmza açıklamasında e-SMM cümlesi (pencere yeniden açılınca — G2).
12. 002: Kuzey İnşaat A.Ş. (VKN) → Serbest Meslek Makbuzu brüt 10.000, KDV %20 2.000, stopaj %20 −2.000, Tahsil Edilecek ₺10.000 → TES2026386706780, "e-SMM
    kesilir" → Kaydet ve Gönder → "e-SMM EDM'ye iletildi"; "İade kapalı: Serbest meslek makbuzundan iade belgesi olmaz"; cari Bakiye ₺10.000. Personel Raporu boş
    durumu (Çalışanlar / Ayrılanlar / + Yeni Personel).
13. 001'e dönüş: 002'nin carisi ve makbuzu görünmüyor; 001'in kendi kayıtları yerinde (iki yönlü ayrım).

## Bulgular (ürün)
- G1 (UX, kalıcı karar "pasif düğmenin nedeni görünür yazı" ile aynı ilke): entegratör bağlantısı kurulu ama firma "e-Fatura mükellefiyim / e-Arşiv
  kullanıcısıyım" işaretli değilken fatura formu kâğıt fişe (FIS serisi) düşüyor; formda NEDEN kâğıt olduğu yazmıyor (e-Belge'de "e-Fatura kesilir" notu var,
  kâğıtta not boş — hof-invoices.js:1832); "Kaydet ve Gönder" düğmeleri kalem girilince sessizce kayboluyor (2.4.2 tasarımı: belge türü hesaplamadan sonra
  belli olur). Başlarken'de e-Belge işareti adımı yok.
- G2 (UI): Fatura Ayarları açıkken Entegratör Ayarları'nda e-SMM işareti değişince Fatura Ayarları'ndaki işarete bağlı açıklama (Kaşe / İmza e-SMM cümlesi)
  yenilenmiyor; pencere kapatılıp açılınca doğru.
- G3 (metin): makbuz (SMM) onay penceresi "Gönderildikten sonra düzenlenemez; yanlışsa iptal ya da iade gerekir" diyor; makbuzda iade yok (kartta "İade kapalı:
  Serbest meslek makbuzundan iade belgesi olmaz; yanlışsa iptal edin").

## Ürün dışı (test ortamı — ders 14)
- "Ücretsiz deneme henüz başlamadı … salt okunur" bildirimi: lisans servisi bu kapsayıcıda bilerek ölü adres (gerçek kurulumda deneme kendiliğinden başlar).
- Tarih kutuları ABD biçiminde (10/22/2026): başsız Chromium'un yerel biçimi; gerçek Edge'de tr-TR.
- Entegratör ekranında "vekil sunucu (http://127.0.0.1:…)": kapsayıcının ortam değişkeni.
- Sahte EDM'nin durum iletisi "EDM'de paketleniyor. BASARIYLA TAMAMLANDI" (gerçek EDM koşularında son durum "Kabul (iletildi)" — 24/24b kanıtları).
- Sürücü hatası (ürün değil): "etiketten sonraki giriş" seçicisi Fatura Ayarları'nda alanları bir kaydırdı; alanlar data-s ile düzeltildi.

## Denenmeyen
Excel / Sheets'ten kayıt ve cari yükleme, Tablodan Aktar, stoklu satış, alış faturası, iade, POS/havale tahsilatı, banka hareketi eşleme, şüpheli alacak, yedek /
geri yükleme (madde 30 göç ajanında), e-SMM iptali ve resmî görüntü, Personel kaydı ekleme, yetkisiz kullanıcı, gerçek Windows + Edge.
