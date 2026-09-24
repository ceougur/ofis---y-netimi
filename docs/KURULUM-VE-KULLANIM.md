# DestekOfis — Kurulum ve Kullanım Kılavuzu (v1.3)

## 1. Sistem düzeni

Ofisteki bir bilgisayar **sunucu** olur: veriler bu bilgisayarda tutulur ve DestekOfis burada bir Windows servisi olarak çalışır. Diğer bilgisayarlar **personel bilgisayarı**dır; yalnızca sunucuyu kendiliğinden bulan küçük bir başlatıcı kurulur, veri tutmazlar.

- Sunucu bilgisayar açık kaldığı sürece sistem çalışır; kimsenin oturum açmasına gerek yoktur.
- Windows ağ profili **Özel (Private)** olmalıdır (kurulum bunu sizin için ayarlayabilir).
- Modemde sunucuya sabit IP (DHCP rezervasyonu) vermek önerilir ama zorunlu değildir: personel bilgisayarları sunucuyu ağda kendiliğinden bulur.

## 2. Sunucu kurulumu

1. `DestekOfis-Kurulum-<sürüm>.exe` dosyasını sunucu olacak bilgisayarda çalıştırın (yönetici izni ister).
2. Kurulum türü olarak **Sunucu bilgisayar**ı seçin.
3. İsteğe bağlı görevler: *Masaüstüne kısayol* ve *Ağ profili 'Ortak' ise 'Özel' yap* (önerilir).
4. Kurulum şunları kendiliğinden yapar:
   - Programı `C:\HukukOfisiMerkezi` klasörüne kurar (Node.js çalışma zamanı dahil; ayrıca bir şey kurmanız gerekmez).
   - **DestekOfis Sunucu** Windows servisini oluşturur: bilgisayar açılınca oturum açılmadan, penceresiz başlar; kapanırsa kendiliğinden yeniden başlar.
   - Güvenlik duvarına yalnızca Özel/Etki alanı ağları için TCP ve UDP **5123** izni ekler.
   - Servisi başlatıp çalıştığını doğrular.
5. Son ekranda *DestekOfis'i şimdi aç* ile giriş ekranına geçin.

Klasörler:

| Klasör | İçerik |
|---|---|
| `data\` | Veritabanı (`hukuk-ofisi.sqlite`). Güncelleme ve kaldırmada **silinmez**. |
| `backups\` | Otomatik ve elle alınan yedekler. **Silinmez**. |
| `logs\` | Servis ve kurulum günlükleri. |
| `app\`, `runtime\`, `bin\`, `launcher\` | Program dosyaları. |

## 3. Personel bilgisayarı kurulumu

1. Aynı kurulum dosyasını personel bilgisayarında çalıştırın ve **Personel bilgisayarı**nı seçin.
2. Masaüstündeki **DestekOfis** simgesine çift tıklayın. Başlatıcı sunucuyu ağda bulur ve DestekOfis'i uygulama penceresinde (Edge veya Chrome) açar. Bulduğu adresi hatırlar; sonraki açılışlar anında olur.
3. Sunucu bulunamazsa "Yeniden dene" penceresi çıkar: sunucunun açık ve aynı ağda olduğunu kontrol edin.

İsterseniz tarayıcıdan doğrudan da bağlanabilirsiniz: yönetim panelindeki **Sistem** sekmesi sunucunun adreslerini gösterir (ör. `http://192.168.1.50:5123`).

Başlatıcıya adresi elle vermek için (nadiren gerekir): `C:\HukukOfisiMerkezi\launcher\DestekOfis.exe -sunucu 192.168.1.50`. Kayıtlı adresi unutturmak için: `DestekOfis.exe -sifirla`.

## 4. İlk giriş ve güvenlik

- İlk hesap: **admin / Ofis2026!**. Bu varsayılan parolayla giriş, güvenlik için **yalnızca sunucu bilgisayarın kendisinden** yapılabilir; sistem ilk girişte yeni parola belirlemenizi zorunlu tutar.
- Parolalar en az 10 karakter olmalı ve harf ile rakam içermelidir.
- Aynı kullanıcı adıyla 5 hatalı denemeden sonra giriş 15 dakika kilitlenir.
- Parola değişince diğer cihazlardaki oturumlar kapanır.

## 5. Kullanıcılar, roller ve ofis adı

Yönetim paneli: kenar çubuğundaki kullanıcı kartında **Yönetim** (veya `http://SUNUCU:5123/admin.html`). Sunucu bilgisayarda Başlat menüsü → *DestekOfis yönetim paneli*.

| Rol | Yapabildikleri |
|---|---|
| Yönetici | Her şey: kullanıcılar, yedekler, sistem, veri kaynağı, silme, raporlar |
| Avukat | Tüm dosya işlemleri, kayıt silme, veri kaynağı yönetimi, raporlar, değişiklik geçmişi |
| Personel | Not, telefon, tahsilat, haciz, görev, mesaj, yeni kayıt, hücre düzeltme |
| Muhasebe | Personel yetkileri + raporlar |

Yeni kullanıcıya verilen ilk parola, kullanıcının ilk girişinde değiştirilir (önerilen ayar). Kullanıcıyı pasifleştirmek kayıtlarını silmez; açık oturumlarını kapatır.

**Sistem** sekmesinde **ofis adını** girin: giriş ekranında ve personel bilgisayarlarının yaptığı sunucu aramasında bu ad görünür. Aynı sekme sürümü, veritabanı boyutunu, son yedeği ve bağlantı adreslerini gösterir.

## 6. Veri kaynağı (Excel veya Google Sheets)

Kaynak **ofis geneli tek ayardır**; yönetici veya avukat bir kez tanımlar, herkes aynı tabloyu görür.

- **Excel/CSV:** Sol menü → *Tabloyu değiştir* → dosya seçin. Dosya sunucuya yüklenir. Aynı adla yeniden yüklenen dosya, ofisin düzeltmelerini koruyarak tabloyu günceller.
- **Google Sheets:** Sheet'in tam bağlantısını yapıştırıp *Sheet'i analiz et*. Sheet'te *Paylaş → Bağlantıya sahip olan herkes → Görüntüleyici* açık olmalıdır.
- Kaynak dosyanın kendisi hiçbir zaman değiştirilmez; düzeltmeler, silmeler ve yeni kayıtlar sunucuda saklanır ve tabloya işlenir.

## 7. Günlük kullanım

- **Arama:** Dosya no, borçlu, müvekkil veya telefon yazın; *Enter* ilk sonuca gider, *Ctrl+K* aramaya odaklanır.
- **Dosya işlemleri:** Detay panelindeki *WhatsApp, Not, Telefon, Tahsilat, Görev, Haciz, Düzenle* düğmeleri. Tüm işlemler detayın altındaki **İşlem geçmişi**nde işlemi yapanla birlikte görünür.
- **Hücre düzeltme:** Tablo hücresinin üzerine gelince çıkan ✎ düğmesi. Aynı alanı iki kişi aynı anda değiştirirse sistem uyarır.
- **Satır silme:** Satırın solundaki × (yönetici/avukat). Silme geri alınabilir.
- **Görevler:** Kenar çubuğu → *Görevler*; size atananlar rozetle gösterilir.
- **Haciz uyarıları:** Bir yılını dolduracak hacizler 30 gün önceden listelenir, son 7 gün vurgulanır.
- **Ödeme sözleri:** Tabloda ödeme sözü kolonu varsa aktif sözler üstte kayan şeritte görünür; *Ödendi / İptal* ile kapatılır.

## 8. Yedekleme ve geri dönüş

- Sunucu açıkken 6 saatte bir otomatik yedek alınır; açılışta son yedek eskiyse hemen alınır. Son 30 yedek `C:\HukukOfisiMerkezi\backups` klasöründe saklanır.
- Elle yedek: yönetim paneli → *Yedekler* → *Şimdi yedek al* (indirilebilir) veya Başlat menüsü → DestekOfis → *Yedek al*.
- Sürüm yükseltmelerinde veritabanı değişmeden önce otomatik tam yedek alınır (`...-pre-migration-...sqlite`).
- `backups` klasörünü düzenli olarak harici diske veya NAS'a kopyalayın.

**Yedekten dönüş:**

1. Servisi durdurun: Başlat → *Hizmetler* (services.msc) → **DestekOfis Sunucu** → *Durdur* (veya yönetici komut isteminde `net stop DestekOfis`).
2. `data\hukuk-ofisi.sqlite` dosyasını güvenli bir adla saklayın; varsa yanındaki `-wal` ve `-shm` dosyalarını da taşıyın.
3. Seçtiğiniz yedeği `data\hukuk-ofisi.sqlite` adıyla kopyalayın.
4. Servisi başlatın (`net start DestekOfis`).

## 9. Servis yönetimi

- Servis adı **DestekOfis Sunucu** (kısa adı `DestekOfis`). Hizmetler penceresinden durdurulup başlatılabilir.
- Servis güvenlik için kısıtlı bir sanal hesapla (`NT SERVICE\DestekOfis`) çalışır; yalnızca kendi veri, yedek ve günlük klasörlerine yazabilir.
- Günlükler: `C:\HukukOfisiMerkezi\logs\servis.log` (1 MB'ı aşınca servis açılışında kenara ayrılır, son 10 günlük saklanır) ve `logs\kurulum.log`.
- Servis ayarları bozulduysa: yönetici komut isteminde `C:\HukukOfisiMerkezi\bin\servis-kur.cmd` servisi onarır.
- Uygulama beklenmedik biçimde kapanırsa servis yöneticisi onu birkaç saniye içinde yeniden başlatır; bu sırada kullanıcılar kendiliğinden yenilenen bir bakım sayfası görür.

## 10. Sorun giderme

| Belirti | Kontrol |
|---|---|
| Başlatıcı "sunucu bulunamadı" diyor | Sunucu bilgisayar açık mı? Aynı ağda mısınız? Sunucuda ağ profili Özel mi? Sunucuda Hizmetler'de *DestekOfis Sunucu* çalışıyor mu? |
| Tarayıcı bağlanamıyor | Yönetim paneli → Sistem'deki adresi deneyin; güvenlik duvarında *DestekOfis HTTP (TCP 5123)* kuralı açık mı? |
| "Sistem başlatılıyor / yeniden başlatılıyor" sayfası | Birkaç saniye bekleyin; sayfa kendiliğinden yenilenir. Uzun sürerse `logs\servis.log` dosyasına bakın. |
| "Sunucu başlatılamadı" sayfası | Sunucu bilgisayarı yeniden başlatın; sürerse `logs\servis.log` ile destek isteyin. |
| Varsayılan parolayla giriş reddedildi | İlk giriş yalnızca sunucu bilgisayarın kendisinden yapılabilir. |
| Giriş kilitlendi | 15 dakika bekleyin veya yöneticiden parola sıfırlamasını isteyin. |
| Tablo görünmüyor | Yönetici/avukatın veri kaynağı tanımlaması gerekir. Sheets için paylaşım iznini kontrol edin. |
| "Veri kaynağı değiştirildi" uyarısı | Başka bir kullanıcı kaynağı değiştirdi; *Yenile*'ye basın. |
| Güncelleme denetlenemiyor | Sunucunun internete çıkabildiğini kontrol edin. Antivirüsün "SSL/HTTPS taraması" özelliği bağlantıyı engelliyor olabilir. Ayrıntı: `logs\servis.log`. |
| "Sürüm açılamadı; önceki sürüme dönüldü" | Sistem güvendedir ve önceki sürümle çalışır. Panelden *Yine de kur* ile yeniden deneyebilir veya destek isteyebilirsiniz. |
| Sağlık kontrolü | `http://SUNUCU:5123/api/health` → `"status":"ok"` |

## 11. Güvenlik kuralları

- 5123 portunu internete açmayın (modemde port yönlendirme yapmayın); sistem yalnızca ofis ağında (LAN) kullanılmalıdır.
- Kullanılmayan hesapları pasifleştirin.
- Sunucu bilgisayar uyku moduna geçmemeli (Güç seçenekleri → Uyku: Hiçbir zaman).
- `backups` ve `data` klasörlerini ağda paylaşıma açmayın.

## 12. Güncelleme

**Otomatik (önerilen, varsayılan):** Sunucu her açıldığında yeni sürüm olup olmadığına bakar. Yeni sürüm varsa DestekOfis çalışmaya devam ederken arka planda indirilir ve doğrulanır; ardından yaklaşık bir dakikalık bir geçişle yeni sürüme geçilir. Bu sırada kullanıcılar *"Sistem güncelleniyor, lütfen 1 dakika sonra tekrar deneyin."* sayfasını görür; sistem hazır olunca ekranlar kendiliğinden yenilenir.

- Güncelleme yalnızca sunucu açılışında yapılır; gün içinde çalışırken kendiliğinden güncellenmez.
- `data` ve `backups` klasörlerine dokunulmaz. Geçişten hemen önce veritabanının tam yedeği alınır (`backups\...-guncelleme-oncesi-<sürüm>.sqlite`).
- Yeni sürüm açılamazsa sistem **kendiliğinden önceki sürüme döner** ve o sürümü bir daha denemez; yönetim paneli durumu bildirir.
- Güncellemeler dijital olarak imzalıdır; imzası veya içeriği tutmayan paketler kurulmaz.

**Yönetim paneli → Sistem → Güncellemeler:** kurulu sürümü, son denetimi ve bulunan yeni sürümün notlarını gösterir.

- *Güncellemeleri denetle* ile hemen bakabilir, *Şimdi güncelle* ile beklemeden kurabilirsiniz (kullanıcıların az olduğu bir saatte yapın).
- *Sunucu açılışında yeni sürümü kendiliğinden kur* seçeneğini kapatırsanız güncellemeler yalnızca siz *Şimdi güncelle* dediğinizde kurulur.
- *Güncelleme kanalı*: **Kararlı** (önerilen) veya **Deneme (beta)**. Beta kanalı yeni özellikleri herkesten önce alır; üretimde kararlı kanal önerilir.
- Bir sürüm çalışma zamanı değişikliği gerektiriyorsa panel bunu bildirir; o sürümü kurulum dosyasıyla kurun.

**Kurulum dosyasıyla (elle):** Yeni sürümün kurulum dosyasını sunucuda çalıştırın: aynı klasöre kurulur, servis kısa süre durup yeni sürümle başlar, veriler korunur. Eski bir kurulum dosyası, otomatik güncellemeyle gelmiş daha yeni bir sürümü geri almaz. Personel bilgisayarlarında başlatıcıyı güncellemek genellikle gerekmez.

Güncelleme için sunucunun internete (github.com) erişebilmesi gerekir. İnternet yoksa sistem mevcut sürümle normal çalışmaya devam eder.

## 13. Kaldırma

Ayarlar → Uygulamalar → **DestekOfis** → Kaldır. Servis ve güvenlik duvarı kuralları kaldırılır; **veriler ve yedekler korunur** (`C:\HukukOfisiMerkezi\data`, `backups`). Yeniden kurduğunuzda kaldığınız yerden devam edersiniz. Verileri de silmek istiyorsanız klasörü kaldırmadan sonra elle silin.

## 14. Eski kurulumdan (v1.0 / v1.1 elle kurulum) geçiş

Kurulum dosyasını aynı bilgisayarda çalıştırıp **Sunucu bilgisayar** seçmeniz yeterlidir. Kurulum `C:\HukukOfisiMerkezi` klasörünü kullanır; eski `data\hukuk-ofisi.sqlite` veritabanı olduğu gibi kullanılır ve gerekiyorsa yedek alınarak yükseltilir. Eski zamanlanmış görev ("Hukuk Ofisi Merkezi Server") ve eski güvenlik duvarı kuralı kendiliğinden kaldırılır. Eski sürüm farklı bir klasördeyse önce onu durdurup `data` klasörünü `C:\HukukOfisiMerkezi\data` içine kopyalayın.
