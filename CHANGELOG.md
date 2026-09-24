# Değişiklik günlüğü

Sürümler [anlamsal sürümleme](https://semver.org/lang/tr/) kurallarına uyar.

## 1.3.2 — Güncelleme sonrası ekran yenileme

- Güncelleme çok hızlı bittiğinde yönetim panelindeki sürüm, çalışma süresi ve son yedek kutucukları eski bilgiyi göstermeye devam ediyordu. Artık güncelleme bitince yönetim paneli yeni sürümle kendiliğinden yeniden yüklenir.
- Dosya takip ekranı açık olan bilgisayarlar sunucunun güncellendiğini fark eder ve "DestekOfis … sürümüne güncellendi" şeridiyle sayfayı yenilemeyi önerir (yazılmakta olan bir not kaybolmasın diye kendiliğinden yenilemez).

## 1.3.1 — Otomatik güncelleme denemesi

- Otomatik güncelleme zincirini gerçek bir kurulumda sınamak için yayımlanan sürüm: 1.3.0 kurulu sunucular bu sürüme kendiliğinden geçer. İşlevsel bir değişiklik yoktur.
- Yönetim paneli → Sistem → Güncellemeler kartında "1.3.1 sürümüne güncellendi" yazısı görünür.

## 1.3.0 — GitHub'dan otomatik güncelleme (Faz 2)

### Otomatik güncelleme
- Sunucu her açılışta GitHub Releases'ta yeni sürüm olup olmadığına bakar. Varsa uygulama çalışmaya devam ederken arka planda indirilir ve doğrulanır; ardından kısa bir bakım penceresinde ("Sistem güncelleniyor, lütfen 1 dakika sonra tekrar deneyin.") yeni sürüme geçilir. Açık ekranlar sistem hazır olunca kendiliğinden yenilenir.
- Gün içinde kendiliğinden güncelleme yapılmaz. İnternet açılışta henüz hazır değilse ilk 30 dakika içinde birkaç kez yeniden denenir.
- `data` ve `backups` klasörlerine dokunulmaz; geçişten hemen önce veritabanının tam yedeği alınır (`...-guncelleme-oncesi-<sürüm>.sqlite`).
- Yeni sürüm açılamaz veya sağlık kontrolünden geçemezse önceki sürüme kendiliğinden dönülür (gerekirse veritabanı da güncelleme öncesi hâline alınır) ve o sürüm bir daha kendiliğinden denenmez. Geçiş sırasında elektrik kesilirse sonraki açılışta aynı denetim yapılır.

### Güvenlik
- Güncellemeler Ed25519 ile imzalanır; uygulama yalnızca kendine gömülü anahtarla imzalanmış bildirgeleri kabul eder. Paket boyutu ve SHA-256 özeti birebir denetlenir, eski sürüme düşürme yapılmaz, zip içeriği güvenli yollarla açılır.
- Servis hesabı yalnızca `app` klasörüne yazabildiğinden güncellemeler çalışma zamanına (Node.js) ve servis ayarlarına dokunamaz; bunlar yalnızca kurulum dosyasıyla değişir. Daha yeni bir çalışma zamanı gerektiren sürümler için yönetim paneli kurulum dosyasıyla güncellemeyi önerir.

### Yönetim paneli
- **Sistem → Güncellemeler**: kurulu sürüm, son denetim, bulunan yeni sürüm ve sürüm notları; *Güncellemeleri denetle* ve *Şimdi güncelle* düğmeleri, indirme ilerlemesi, son güncellemenin sonucu.
- Açılışta otomatik güncellemeyi kapatma/açma ve **Deneme (beta)** kanalı: ön sürüm olarak yayımlanan sürümler yalnızca beta kanalındaki kurulumlara gider.

### Kurulum ve yayın
- Eski bir kurulum dosyası, otomatik güncellemeyle gelmiş daha yeni sürümü geri almaz; kurulum yalnızca daha yeni veya aynı sürümü etkinleştirir.
- `npm run release` imzalı güncelleme paketini üretir; `v*` etiketiyle GitHub Actions testleri, gerçek Windows'ta kurulum testini ve yayımlamayı kendiliğinden yapar.

## 1.2.0 — Tek tıkla kurulum ve Windows servisi (Faz 1)

### Kurulum
- **DestekOfis-Kurulum.exe** (Inno Setup, Türkçe): *Sunucu bilgisayar* veya *Personel bilgisayarı* seçilir. Node.js çalışma zamanı pakete gömülü; ayrıca bir şey kurmak gerekmiyor. Varsayılan klasör `C:\HukukOfisiMerkezi`.
- Sunucu **DestekOfis Sunucu** Windows servisi olarak çalışır: bilgisayar açılınca oturum açılmadan ve penceresiz başlar, kapanırsa kendiliğinden yeniden başlar. Servis kısıtlı bir sanal hesapla (`NT SERVICE\DestekOfis`) çalışır ve yalnızca kendi veri/yedek/günlük klasörlerine yazabilir.
- Güvenlik duvarına yalnızca Özel/Etki alanı ağları ve yalnızca DestekOfis çalışma zamanı için TCP/UDP 5123 izni eklenir; istenirse ağ profili Özel yapılır.
- Güncelleme kurulumu ve kaldırma `data` ve `backups` klasörlerine dokunmaz. v1.0/v1.1 elle kurulumdan geçişte eski veritabanı olduğu gibi kullanılır; eski zamanlanmış görev ve güvenlik duvarı kuralı temizlenir.

### Sunucu keşfi ve başlatıcı
- Personel bilgisayarlarındaki **DestekOfis** simgesi sunucuyu ağda UDP yayınıyla (`HukukOfisiServerNerede`) kendiliğinden bulur, adresi hatırlar ve DestekOfis'i Edge/Chrome uygulama penceresinde açar. IP adresi değişse de yeniden bulur.

### Servis yöneticisi
- Açılış, yeniden başlatma ve çökme sırasında kullanıcılar kendiliğinden yenilenen markalı bir bakım sayfası görür; uygulama çökerse birkaç saniye içinde yeniden başlatılır.
- Varsayılan parolayla ilk giriş güvenlik için yalnızca sunucu bilgisayarın kendisinden yapılabilir.
- Eski servis günlükleri otomatik temizlenir (son 10 günlük saklanır).
- SSL denetimi yapan antivirüs/güvenlik duvarı olan ağlarda Google Sheets bağlantısı için Windows sertifika deposuna da güvenilir.

### Yönetim paneli
- **Sistem** sekmesinde ofis adı düzenlenebiliyor (giriş ekranında ve ağ keşfinde görünür); personel bilgisayarlarının bağlanabileceği adresler kopyalanabilir biçimde listeleniyor; servis altında çalışma durumu gösteriliyor.

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
