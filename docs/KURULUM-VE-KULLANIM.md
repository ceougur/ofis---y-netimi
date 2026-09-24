# DestekOfis — Kurulum ve Kullanım Kılavuzu (v1.1)

## 1. Sistem düzeni

Bir bilgisayar **sunucu** olarak seçilir. Sürekli açık kalmalı, Windows ağ profili **Özel (Private)** olmalı ve düzenli yedeklenmelidir. Diğer bilgisayarlar **istemci** olarak yalnızca tarayıcıyla bağlanır; istemcilere Node.js veya veritabanı kurulmaz.

```text
Sunucu IP : 192.168.1.50   (modemde sabit IP / DHCP rezervasyonu önerilir)
Adres     : http://192.168.1.50:5123
```

## 2. Sunucu kurulumu

1. Paketi kalıcı bir klasöre çıkarın: `C:\HukukOfisiMerkezi`.
2. Node.js 22 veya üzeri LTS sürümünü kurun.
3. Ağ profilinin **Özel** olduğunu kontrol edin.
4. İlk test: `start-server.cmd` → tarayıcıda `http://127.0.0.1:5123`.
5. Açılışta otomatik çalışma ve güvenlik duvarı kuralı için PowerShell'i **yönetici olarak** açıp:

```powershell
cd C:\HukukOfisiMerkezi
Set-ExecutionPolicy -Scope Process Bypass
.\install-server.ps1
```

> Faz 1 ile bu adımlar tek bir `setup.exe` ile otomatikleşecek ve sunucu Windows servisi olarak oturum açılmadan çalışacak.

## 3. İlk giriş ve güvenlik

- İlk hesap: **admin / Ofis2026!**. Sistem ilk girişte yeni parola belirlemenizi **zorunlu** tutar.
- Parolalar en az 10 karakter olmalı ve harf ile rakam içermelidir.
- Aynı kullanıcı adıyla 5 hatalı denemeden sonra giriş 15 dakika kilitlenir.
- Parola değişince diğer cihazlardaki oturumlar kapanır.

## 4. Kullanıcılar ve roller

Yönetim paneli: `http://SUNUCU-IP:5123/admin.html` (kenar çubuğundaki kullanıcı kartında **Yönetim**).

| Rol | Yapabildikleri |
|---|---|
| Yönetici | Her şey: kullanıcılar, yedekler, sistem, veri kaynağı, silme, raporlar |
| Avukat | Tüm dosya işlemleri, kayıt silme, veri kaynağı yönetimi, raporlar, değişiklik geçmişi |
| Personel | Not, telefon, tahsilat, haciz, görev, mesaj, yeni kayıt, hücre düzeltme |
| Muhasebe | Personel yetkileri + raporlar |

Yeni kullanıcıya verilen ilk parola, kullanıcının ilk girişinde değiştirilir (önerilen ayar). Kullanıcıyı pasifleştirmek kayıtlarını silmez; açık oturumlarını kapatır.

## 5. Veri kaynağı (Excel veya Google Sheets)

Kaynak **ofis geneli tek ayardır**; yönetici veya avukat bir kez tanımlar, herkes aynı tabloyu görür.

- **Excel/CSV:** Sol menü → *Tabloyu değiştir* → dosya seçin. Dosya sunucuya yüklenir. Aynı adla yeniden yüklenen dosya, ofisin düzeltmelerini koruyarak tabloyu günceller.
- **Google Sheets:** Sheet'in tam bağlantısını yapıştırıp *Sheet'i analiz et*. Sheet'te *Paylaş → Bağlantıya sahip olan herkes → Görüntüleyici* açık olmalıdır.
- Kaynak dosyanın kendisi hiçbir zaman değiştirilmez; düzeltmeler, silmeler ve yeni kayıtlar sunucuda saklanır ve tabloya işlenir.

## 6. Günlük kullanım

- **Arama:** Dosya no, borçlu, müvekkil veya telefon yazın; *Enter* ilk sonuca gider, *Ctrl+K* aramaya odaklanır.
- **Dosya işlemleri:** Detay panelindeki *WhatsApp, Not, Telefon, Tahsilat, Görev, Haciz, Düzenle* düğmeleri. Tüm işlemler detayın altındaki **İşlem geçmişi**nde işlemi yapanla birlikte görünür.
- **Hücre düzeltme:** Tablo hücresinin üzerine gelince çıkan ✎ düğmesi. Aynı alanı iki kişi aynı anda değiştirirse sistem uyarır.
- **Satır silme:** Satırın solundaki × (yönetici/avukat). Silme geri alınabilir.
- **Görevler:** Kenar çubuğu → *Görevler*; size atananlar rozetle gösterilir.
- **Haciz uyarıları:** Bir yılını dolduracak hacizler 30 gün önceden listelenir, son 7 gün vurgulanır.
- **Ödeme sözleri:** Tabloda ödeme sözü kolonu varsa aktif sözler üstte kayan şeritte görünür; *Ödendi / İptal* ile kapatılır.

## 7. Yedekleme ve geri dönüş

- Sunucu açıkken 6 saatte bir otomatik yedek alınır; açılışta son yedek eskiyse hemen alınır. Son 30 yedek saklanır.
- Yönetim paneli → *Yedekler*: anında yedek alın ve indirin. Komutla: `npm run backup`.
- Sürüm yükseltmelerinde veritabanı değişmeden önce otomatik tam yedek alınır (`...-pre-migration-...sqlite`).
- `backups` klasörünü düzenli olarak harici diske veya NAS'a kopyalayın.

**Yedekten dönüş:** sunucuyu kapatın → `data\hukuk-ofisi.sqlite` dosyasını güvenli bir adla saklayın → seçtiğiniz yedeği `data\hukuk-ofisi.sqlite` olarak kopyalayın → sunucuyu başlatın.

## 8. Sorun giderme

| Belirti | Kontrol |
|---|---|
| Sunucu açılmıyor | Node.js 22+ kurulu mu? `start-server.cmd` penceresindeki mesaj; port 5123 başka programda mı? |
| İstemci bağlanamıyor | Sunucu IP'si doğru mu, ağ profili Özel mi, güvenlik duvarında 5123 izni var mı? |
| Giriş kilitlendi | 15 dakika bekleyin veya yöneticiden parola sıfırlamasını isteyin. |
| Tablo görünmüyor | Yönetici/avukatın veri kaynağı tanımlaması gerekir. Sheets için paylaşım iznini kontrol edin. |
| "Veri kaynağı değiştirildi" uyarısı | Başka bir kullanıcı kaynağı değiştirdi; *Yenile*'ye basın. |
| Sağlık kontrolü | `http://SUNUCU-IP:5123/api/health` → `"status":"ok"` |

## 9. Güvenlik kuralları

- 5123 portunu internete açmayın; sistem yalnızca ofis ağında (LAN) kullanılmalıdır.
- Kullanılmayan hesapları pasifleştirin.
- Sunucu bilgisayarı uyku moduna geçmemeli; `backups` klasörü istemcilere yazılabilir paylaşılmamalıdır.

## 10. Güncelleme (elle, Faz 2'ye kadar)

1. Kullanıcıları bilgilendirin ve yönetim panelinden yedek alın.
2. Sunucuyu kapatın.
3. Yeni paketi ayrı bir klasöre çıkarın; `data` ve `backups` klasörlerini yeni klasöre taşıyın.
4. Sunucuyu başlatın; veritabanı otomatik yükseltilir (öncesinde yedek alınır).
5. `/api/health` ve bir kullanıcıyla giriş yaparak kontrol edin.
