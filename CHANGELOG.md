# Değişiklik günlüğü

Sürümler [anlamsal sürümleme](https://semver.org/lang/tr/) kurallarına uyar.

## 1.1.0 — Sağlamlaştırma (Faz 0)

Ürün adı **DestekOfis** oldu. Veritabanı otomatik olarak yükseltilir; yükseltmeden önce `backups/` altına tam yedek alınır.

### Güvenlik
- Ödeme sözü şeridindeki XSS açığı kapatıldı; tüm eklenti arayüzü kaçışlı (escape) çıktı üretir.
- Rol bazlı yetki matrisi sunucuda uygulanıyor (yönetici, avukat, personel, muhasebe). Kayıt silme yönetici/avukat, raporlar yönetici/avukat/muhasebe, veri kaynağı yönetimi yönetici/avukat ile sınırlı.
- Giriş deneme sınırı: aynı kullanıcı adı ve IP için 15 dakikada 5 hatalı denemeden sonra geçici kilit.
- Varsayılan yönetici parolası (`Ofis2026!`) ve yöneticinin verdiği geçici parolalar ilk girişte zorunlu olarak değiştirilir. Parola politikası: en az 10 karakter, harf ve rakam.
- Parola değişince diğer cihazlardaki oturumlar kapanır; pasifleştirilen kullanıcının oturumu hemen düşer.
- Google Sheets okuma ucu artık oturum gerektiriyor.
- Başka siteden gelen değiştirici istekler (CSRF) ve JSON olmayan gövdeler reddediliyor; güvenlik başlıkları ve sıkı içerik güvenlik politikası (CSP) eklendi.
- Statik dosya sunucusunda klasör dışına çıkma açığı ihtimali kapatıldı.
- Excel ayrıştırma yalıtılmış bir Worker'da çalışıyor (SheetJS 0.18.5'in bilinen açıklarına karşı koruma).

### Merkezileşme
- Excel/CSV artık yalnızca yükleyen tarayıcıda kalmıyor: sunucuya kaydedilip ofisin ortak kaynağı oluyor. Aynı adla yeniden yükleme düzeltmeleri koruyarak tabloyu günceller.
- Veri kaynağı, senkron sıklığı ve kolon eşlemesi ofis genelinde tek ayar; her bilgisayarda ayrı ayrı girilmesi gerekmiyor. v1.0.0'daki tarayıcı ayarı ilk yetkili girişte otomatik taşınır.
- Detaydaki "Notu kaydet" notları sunucuda saklanıyor; tarayıcıdaki eski notlar ilk açılışta otomatik aktarılır.
- Hücre düzeltmeleri, silmeler ve yeni kayıtlar sunucuda birleştirilerek tabloya işleniyor; arama, filtre, dışa aktarma ve sayaçlar artık bunları da görüyor.

### Hata düzeltmeleri
- `npm run backup` yanlış klasörü (proje klasörünün bir üstünü) kullanıyordu.
- Yedekler artık `VACUUM INTO` ile tutarlı alınıyor; sunucu açılışında son yedek eskiyse yedek alınıyor (her akşam kapanan sunucularda yedek hiç alınamıyordu).
- "Yeni kayıt" düğmesi olmayan bir uca gidiyordu.
- Mesaj, haciz ve düzeltme kayıtlarında işlemi yapanın adı "undefined" görünüyordu.
- Tamamlanan görev raporu kullanıcı adını değiştirince bozuluyordu.
- Senkron veya düzenleme sonrası seçili dosya ve yazılmakta olan not kayboluyordu.
- Yeni kurulumlarda geliştiricinin Google Sheet bağlantısı varsayılan kaynak olarak açılıyordu.

### Arayüz
- D harfli DestekOfis logosu, yeni giriş ekranı, bildirimler ve erişilebilir pencereler (klavye, odak yönetimi).
- Dosya detayında **işlem geçmişi** (not, telefon, tahsilat, haciz, görev) ve işlemi yapan kişi.
- **Görevler** penceresi (bana atananlar, tüm açık görevler, tamamlama) ve kenar çubuğunda rozetler.
- Satır silme geri alınabilir; hücre düzeltme ve toplu "Düzenle" penceresi; sürüm çakışması uyarısı.
- Yeni kayıt formu tablonun tüm kolonlarından oluşturuluyor.
- Kullanıcı kartı: profil, parola değiştirme, yönetim paneli ve çıkış.
- Yeni yönetim paneli: kullanıcılar (rol, pasifleştirme, parola sıfırlama, oturum kapatma), yedekler (al, indir), değişiklik geçmişi, sistem durumu.
- Yazı tipleri (DM Sans, Manrope) sunucudan geliyor; internet olmadan da aynı görünüm.
- Kullanılmayan ~360 KB Manus çalışma zamanı ve ölü kod kaldırıldı; tek, toplu DOM izleyici ile daha akıcı arayüz.

### Altyapı
- Sunucu modüllere ayrıldı (`server/lib`, `server/routes`), bağımlılıksız yapı korundu.
- Veritabanı şema sürümleme (migration) altyapısı.
- 60+ otomatik test (`npm test`) ve Playwright ile uçtan uca tarayıcı testi (`npm run test:e2e`).
- `npm run package` ile doğrulanmış dağıtım paketi, GitHub Actions CI iş akışı.

## 1.0.0 — Merkezi server/client ilk sürüm
- Node.js + SQLite merkezi sunucu, cookie oturumu, audit kaydı, 6 saatlik yedek.
