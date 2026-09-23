# Hukuk Ofisi Merkezi
## Kullanım ve Kurulum Kılavuzu

## 1. Sistem düzeni

Bir bilgisayar **server** olarak seçilir. Bu bilgisayar mümkünse sürekli açık kalmalı, Windows Private ağ profilinde çalışmalı ve düzenli yedeklenmelidir. Diğer ofis bilgisayarları **client** olarak yalnızca web tarayıcısı ile bağlanır.

Örnek:

```text
Server IP: 192.168.1.50
Uygulama adresi: http://192.168.1.50:5123
```

Server bilgisayarının IP adresi değişmemelidir. Modem DHCP rezervasyonu veya sabit yerel IP kullanılması önerilir.

## 2. Server bilgisayarına ilk kurulum

1. ZIP’i server bilgisayarında kalıcı bir klasöre çıkarın. Örnek: `C:\HukukOfisiMerkezi`.
2. Server bilgisayarına Node.js 22 veya daha yeni LTS sürümünü kurun.
3. Windows ağ profilinin **Private/Özel** olduğundan emin olun.
4. PowerShell’i **Yönetici olarak** açın.
5. Proje klasörüne geçin:

```powershell
cd C:\HukukOfisiMerkezi
```

6. Ağ kuralını ve Windows başlangıç görevini kurun:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-server.ps1
```

7. İlk test için `start-server.cmd` dosyasını çalıştırın.
8. Server bilgisayarında tarayıcıdan `http://127.0.0.1:5123` adresini açın.
9. Başka bir bilgisayarda `ipconfig` ile server IPv4 adresini öğrenin ve client tarayıcıdan `http://SERVER-IP:5123` adresini açın.

İlk yönetici hesabı:

```text
Kullanıcı adı: admin
Parola: Ofis2026!
```

İlk girişten hemen sonra parola değiştirme akışını kullanın. Varsayılan parolayı uzun süre bırakmayın.

## 3. Client bilgisayardan bağlanma

Client bilgisayara Node.js veya veritabanı kurulması gerekmez. Chrome veya Edge açıp server adresini yazın:

```text
http://192.168.1.50:5123
```

İstenirse ZIP içindeki `open-client.cmd` dosyasıyla adres açılabilir:

```text
open-client.cmd http://192.168.1.50:5123
```

Yönetici kullanıcı yönetimi için aynı server üzerinde `http://SERVER-IP:5123/admin.html` adresini açın. Bu ekranda yeni kullanıcı oluşturabilir, kullanıcıları pasifleştirebilir ve kendi parolanızı değiştirebilirsiniz.

Her client kendi tarayıcısında kullanıcı hesabıyla giriş yapar. Tüm client’lar aynı merkezi dosya ve operasyon kayıtlarını görür.

## 4. Kullanıcı oluşturma

İlk kullanıcıyla admin olarak giriş yaptıktan sonra `admin.html` yönetim ekranını kullanın. Ekran açılmıyorsa veya teknik bakım gerekiyorsa yönetici API’si aşağıdaki örnek çağrıyla da kullanılabilir:

```javascript
fetch('/api/admin/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username: 'personel1',
    name: 'Yeni Personel',
    role: 'personel',
    password: 'Guclu-Parola-2026!'
  })
}).then(r => r.json()).then(console.log)
```

Geçerli roller: `admin`, `avukat`, `personel`, `muhasebe`.

Bu teknik yönetim adımı geçici kullanım içindir. Üretim öncesinde kullanıcı yönetiminin arayüz üzerinden yapılması önerilir.

## 5. Günlük kullanım

Giriş yaptıktan sonra mevcut dosya takip arayüzü açılır. Arama alanından dosya numarası, borçlu, müvekkil, alacaklı veya telefon bilgisiyle arama yapılabilir. Bir kayıt seçildiğinde sağ detay alanından not, telefon, tahsilat, görev ve haciz işlemleri yapılabilir.

Yapılan işlemler artık yalnızca o bilgisayarda değil, merkezi server veritabanında tutulur. Başka bir client sayfayı yenilediğinde aynı değişiklikleri görür.

Hücre düzeltmelerinde iki kullanıcı aynı alanı aynı anda değiştirirse, eski sürümün üzerine sessizce yazmak yerine çakışma yanıtı üretilir. Bu durumda sayfayı yenileyip en güncel veriyi kontrol edin.

## 6. Server’ın durumu

Server penceresinde aşağıdaki benzeri kayıt görünmelidir:

```text
Hukuk Ofisi merkezi sunucusu http://0.0.0.0:5123
```

Tarayıcıda sağlık kontrolü:

```text
http://SERVER-IP:5123/api/health
```

Başarılı yanıt `status: ok` içermelidir.

## 7. Manuel yedekleme

Server çalışıyor olsa da manuel yedek alınabilir:

```powershell
cd C:\HukukOfisiMerkezi
npm run backup
```

Yedekler `backups` klasöründe oluşur. Bu klasörü her gün harici diske veya NAS’a kopyalayın. Sadece aynı diskte duran yedek, disk arızasına karşı koruma sağlamaz.

## 8. Yedekten geri dönme

1. Server’ı kapatın.
2. Geri dönülecek `.sqlite` dosyasını seçin.
3. Mevcut `data\hukuk-ofisi.sqlite` dosyasını güvenli bir isimle saklayın.
4. Seçilen yedeği `data\hukuk-ofisi.sqlite` olarak kopyalayın.
5. Server’ı yeniden başlatın.
6. Bir client’tan giriş yapıp dosya ve audit kayıtlarını kontrol edin.

## 9. Sorun giderme

| Belirti | Kontrol |
|---|---|
| Server açılmıyor | Node.js 22+ kurulu mu, `start-server.cmd` penceresindeki hata ne? |
| Client bağlanamıyor | Server IP’si doğru mu, Windows ağ profili Private mı, TCP 5123 firewall kuralı var mı? |
| Login reddediliyor | Kullanıcı adı/parola doğru mu, kullanıcı admin tarafından pasifleştirildi mi? |
| Değişiklik görünmüyor | Client sayfasını yenileyin; `/api/health` ile server’ı kontrol edin. |
| Aynı alan çakışması | Sayfayı yenileyin ve son değeri kontrol ederek tekrar kaydedin. |
| Veriler kayboldu sanılıyor | `data` ve `backups` klasörlerini, ayrıca doğru server IP’sini kontrol edin. |

## 10. Güvenlik kuralları

- Port `5123` internetten erişilebilir hale getirilmemelidir.
- Windows ağ profili Public ise doğrudan firewall’ı gevşetmeyin.
- Varsayılan admin parolası değiştirilmelidir.
- Kullanılmayan kullanıcılar pasifleştirilmelidir.
- Yedek klasörü client bilgisayarlara yazma yetkisiyle paylaşılmamalıdır.
- Server bilgisayarı uykuya geçmeyecek şekilde ayarlanmalıdır.
- Server klasörü ağ paylaşımı olarak yayınlanmamalıdır; client’lar yalnızca HTTP adresine bağlanmalıdır.

## 11. Kapatma ve güncelleme

Güncellemeden önce:

1. Tüm client kullanıcılarını bilgilendirin.
2. `npm run backup` ile yedek alın.
3. Server’ı kapatın.
4. Yeni ZIP’i ayrı bir klasöre çıkarın; eski klasörü silmeyin.
5. Gerekirse `data` ve `backups` klasörlerini kontrollü olarak yeni kurulum klasörüne taşıyın.
6. Server’ı başlatın ve `/api/health` ile kontrol edin.
7. Bir admin ve bir personel hesabıyla temel işlem testi yapın.

Eski çalışır sürüm ayrı klasörde tutulduğu için sorun halinde eski `start-server.cmd` veya önceki kurulum kullanılabilir.
