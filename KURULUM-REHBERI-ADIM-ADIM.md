# Hukuk Ofisi Merkezi — Adım Adım Kurulum Rehberi
### (Bilgisayar deneyimi az olan kişiler için)

Bu rehber, programı ofiste **ilk kez kuracak kişi** için yazılmıştır. Adımları sırayla, atlamadan uygulayın. Her adımın sonunda "✅ Kontrol" kısmı vardır; o kontrol tutmadan bir sonraki adıma geçmeyin.

---

## 0. Önce kısaca: Bu program nasıl çalışıyor?

- Ofisteki **bir bilgisayar "ana bilgisayar" (server)** olur. Program ve tüm kayıtlar bu bilgisayarda durur.
- Diğer bilgisayarlar (**client**) hiçbir şey kurmaz. Sadece **Chrome** veya **Edge** tarayıcısını açıp ana bilgisayarın adresini yazar. Örnek: `http://192.168.1.50:5123`
- Tüm bilgisayarlar aynı kayıtları görür. Birinin yaptığı değişikliği diğerleri sayfayı yenileyince görür.

```text
      [ Modem / Router ]
        |      |      |
   (kablo veya aynı Wi-Fi)
        |      |      |
  [ANA BİLGİSAYAR]  [Client 1]  [Client 2] ...
   program + veri    tarayıcı    tarayıcı
```

> **Önemli:** Ana bilgisayar kapalıysa veya uykudaysa kimse programı kullanamaz.

---

## 1. Kurulum için yanınızda olması gerekenler

Bir **USB bellek** hazırlayın ve içine şunları koyun:

| # | Ne? | Nereden? | Not |
|---|---|---|---|
| 1 | **Program klasörü** (ZIP) | GitHub'daki `ceougur/ofis---y-netimi` sayfası → yeşil **Code** düğmesi → **Download ZIP**. Ya da size verilen teslim ZIP'i. | İçinde `server`, `client`, `tools` klasörleri ve `start-server.cmd`, `install-server.ps1`, `open-client.cmd`, `package.json` dosyaları olmalı. |
| 2 | **Node.js kurulum dosyası** (Windows 64-bit `.msi`) | https://nodejs.org → **LTS** yazan sürüm | **22.13 veya daha yeni** olmalı (22 veya 24 LTS uygundur). İnternet varsa kurulum sırasında da indirebilirsiniz. |
| 3 | Bu rehber (yazdırılmış hali) | — | Kurulum sırasında el altında olsun. |
| 4 | Yönetici (admin) Windows şifresi | Ofis sorumlusu | Ana bilgisayara program kurmak için gerekli. |
| 5 | (Tavsiye) Harici disk / ikinci USB | — | Günlük yedekleri kopyalamak için. |

**Başka hiçbir şey gerekmez.** Ek veritabanı programı (SQL vb.), `npm install` komutu veya lisans gerekmez. Client bilgisayarlara hiçbir şey kurulmaz.

---

## 2. Ana bilgisayarı (server) seçmek — nasıl bir bilgisayar olmalı?

| Özellik | Gereken |
|---|---|
| İşletim sistemi | Windows 10 veya Windows 11 (64-bit) |
| Donanım | Sıradan bir ofis bilgisayarı yeterli (4 GB RAM ve üzeri, 1 GB boş disk) |
| Açık kalma | Mesai boyunca **sürekli açık** kalmalı, uykuya geçmemeli |
| Ağ bağlantısı | Mümkünse modeme **kablo (Ethernet)** ile bağlı olmalı; Wi-Fi de çalışır ama kablo daha sağlamdır |
| Kullanıcı | Windows'ta her gün aynı kullanıcı hesabıyla oturum açılmalı (program o kullanıcı oturum açınca kendiliğinden başlar) |

---

## 3. Ağ (bağlantı) ayarları — en önemli kısım

Programın çalışması için **internet şart değildir**, ama bilgisayarların **aynı ofis ağında** olması şarttır.

### 3.1 Tüm bilgisayarlar aynı modeme/ağa bağlı olmalı

- Ana bilgisayar ve client'lar **aynı modem/router**'a (kablo veya aynı Wi-Fi adı) bağlı olmalı.
- **Misafir Wi-Fi** (Guest) ağı kullanmayın; misafir ağlar bilgisayarların birbirini görmesini engeller.
- Wi-Fi ayarlarında "AP izolasyonu / istemci izolasyonu" açıksa kapatılmalıdır (bunu genelde internet sağlayıcısı veya ofisin bilgi işlemcisi yapar).

### 3.2 Ağ profilini "Özel" (Private) yapın — ana bilgisayarda

1. Sağ alttaki ağ simgesine (Wi-Fi veya kablo simgesi) tıklayın → **Ağ ve İnternet ayarları**.
2. Bağlı olduğunuz ağın **Özellikler**ine girin.
3. **Ağ profili türü** kısmında **Özel ağ (Private)** seçin.

> ✅ Kontrol: Ayarlarda ağın altında "Özel ağ" yazıyor olmalı. "Ortak/Genel (Public)" yazıyorsa client'lar bağlanamaz.

### 3.3 Ana bilgisayarın IP adresi SABİT olmalı

Client'lar ana bilgisayara bir "adres" (IP) üzerinden ulaşır, örneğin `192.168.1.50`. Bu adres değişirse herkes bağlantıyı kaybeder.

**Önce adresi öğrenin:**
1. Başlat menüsüne `cmd` yazın, **Komut İstemi**'ni açın.
2. `ipconfig` yazıp Enter'a basın.
3. **IPv4 Adresi** satırındaki sayıyı not edin (örn. `192.168.1.50`).

**Sabitleme (iki yoldan biri):**
- **Tavsiye edilen:** Modem arayüzünde bu bilgisayar için **DHCP rezervasyonu / Statik DHCP** tanımlanması. (İnternet sağlayıcınızın müşteri hizmetleri veya bilgi işlemci bunu birkaç dakikada yapar.)
- **Alternatif:** Windows ağ ayarlarından IP'yi elle (statik) girmek. Yanlış girilirse internet kesilebilir; emin değilseniz yardım alın.

> ✅ Kontrol: Bilgisayarı yeniden başlatıp tekrar `ipconfig` yazın. IPv4 adresi **aynı** kalmalı.

### 3.4 Port bilgisi

- Program **5123** numaralı "kapıyı" (TCP port 5123) kullanır.
- Bu kapı kurulum betiği tarafından **yalnızca ofis içi (Özel) ağ için** otomatik açılır (bkz. Adım 5).
- **Modemde port yönlendirme YAPMAYIN.** Program internete açılmamalıdır; sadece ofis içinden kullanılır.

### 3.5 İnternet ne zaman gerekir?

| Durum | İnternet gerekli mi? |
|---|---|
| Programı kullanmak, kayıt eklemek, arama yapmak | Hayır |
| Excel/CSV dosyası yüklemek | Hayır |
| **Google Sheets** bağlantısından veri çekmek | **Evet** (ana bilgisayarda) |
| WhatsApp bağlantılarını açmak | Evet (tıklayan bilgisayarda) |
| Node.js'i indirmek (kurulum sırasında) | Evet (ya da USB'de getirin) |

---

## 4. Ana bilgisayara kurulum

### Adım 4.1 — Program klasörünü yerine koyun

1. USB'deki ZIP dosyasını masaüstüne kopyalayın.
2. ZIP'e sağ tıklayın → **Tümünü ayıkla...**
3. Hedef olarak `C:\HukukOfisiMerkezi` yazın → **Ayıkla**.
4. Açılan klasörün içine bakın. Doğrudan şunları görmelisiniz: `server`, `client`, `tools`, `start-server.cmd`, `install-server.ps1`...
   - Eğer içinde tek bir klasör daha varsa (ör. `ofis---y-netimi-main`), **o klasörün içindekileri** `C:\HukukOfisiMerkezi` içine taşıyın.

> ⚠️ Programı **Masaüstü**, **İndirilenler** veya **OneDrive** klasöründe bırakmayın. `C:\HukukOfisiMerkezi` en güvenlisidir.

> ✅ Kontrol: `C:\HukukOfisiMerkezi\start-server.cmd` dosyası var.

### Adım 4.2 — Node.js kurun

1. Node.js `.msi` dosyasına çift tıklayın.
2. Tüm pencerelerde **Next (İleri)** deyin, lisansı kabul edin, varsayılan ayarları değiştirmeyin.
3. "Tools for Native Modules" kutusu çıkarsa **işaretlemeyin** (gerekli değil).
4. **Finish** ile bitirin.
5. Bilgisayarı yeniden başlatın (tavsiye edilir).

> ✅ Kontrol: Başlat → `cmd` → **Komut İstemi**'ne `node -v` yazın. `v22.13.0` veya daha büyük bir sayı (ör. `v22.20.0`, `v24.x.x`) görmelisiniz. "tanınmıyor" yazıyorsa Node.js kurulumu tamamlanmamıştır; tekrar kurun.

### Adım 4.3 — Güvenlik duvarı ve otomatik başlatma kurulumu

1. Başlat menüsüne `PowerShell` yazın.
2. **Windows PowerShell**'e **sağ tıklayın → Yönetici olarak çalıştır** → Evet.
3. Açılan mavi/siyah pencereye sırayla aşağıdaki satırları yazın (her satırdan sonra Enter):

```powershell
cd C:\HukukOfisiMerkezi
Set-ExecutionPolicy -Scope Process Bypass
.\install-server.ps1
```

   Onay sorulursa `E` (Evet) veya `Y` yazıp Enter'a basın.

Bu betik iki şey yapar:
- Windows Güvenlik Duvarı'nda **5123 portunu yalnızca Özel ağ için** açar.
- Windows'ta oturum açıldığında programın **kendiliğinden başlamasını** ayarlar.

> ✅ Kontrol: Ekranda `Kurulum tamamlandı. Port: 5123` yazmalı.

### Adım 4.4 — Programı ilk kez başlatın

1. `C:\HukukOfisiMerkezi` klasöründe **`start-server.cmd`** dosyasına çift tıklayın.
2. Siyah bir pencere açılır ve şu satırı görürsünüz:

```text
Hukuk Ofisi merkezi sunucusu http://0.0.0.0:5123
```

   "ExperimentalWarning: SQLite..." gibi bir uyarı da görebilirsiniz; **bu normaldir**, önemsemeyin.

3. Windows bir güvenlik duvarı sorusu sorarsa **yalnızca "Özel ağlar"** kutusunu işaretleyip **Erişime izin ver** deyin.

> ⚠️ **Bu siyah pencereyi KAPATMAYIN.** Pencere kapanırsa program durur. Küçültebilirsiniz (alt çizgi `_` düğmesi).

### Adım 4.5 — Ana bilgisayarda deneyin

1. Chrome veya Edge'i açın.
2. Adres çubuğuna `http://127.0.0.1:5123` yazın.
3. Giriş ekranı gelmeli. İlk giriş bilgileri:

```text
Kullanıcı adı: admin
Parola:        Ofis2026!
```

4. **Hemen** `http://127.0.0.1:5123/admin.html` adresine gidip **admin parolasını değiştirin** ve yeni parolayı güvenli bir yere yazın.

> ✅ Kontrol: `http://127.0.0.1:5123/api/health` adresi açıldığında içinde `"status":"ok"` yazısı görünmeli.

### Adım 4.6 — Ana bilgisayarın uykuya geçmesini kapatın

1. Başlat → **Ayarlar** → **Sistem** → **Güç ve pil** (veya "Güç ve uyku").
2. **Ekran** kapanabilir, sorun değil.
3. **Uyku** ayarını (prize takılıyken) **Hiçbir zaman** yapın.

> Windows güncellemeleri bilgisayarı yeniden başlatabilir. Yeniden başladıktan sonra Windows'ta oturum açıldığında program kendiliğinden açılır (Adım 4.3 sayesinde). Oturum açılmazsa program başlamaz — sabah ana bilgisayarda oturum açıldığından emin olun.

---

## 5. Kullanıcıları oluşturma

1. Ana bilgisayarda veya herhangi bir bilgisayarda `http://SUNUCU-IP:5123/admin.html` adresine gidin (ör. `http://192.168.1.50:5123/admin.html`).
2. `admin` hesabıyla giriş yapın.
3. Her çalışan için ayrı bir kullanıcı oluşturun. Roller: `admin`, `avukat`, `personel`, `muhasebe`.
4. Kullanıcı adlarını ve ilk parolaları çalışanlara ayrı ayrı iletin.

> Ortak hesap kullanmayın; kimin ne yaptığı kayıtlarda kullanıcı adıyla tutulur.

---

## 6. Diğer bilgisayarlardan (client) bağlanma

Client bilgisayarlara **hiçbir program kurulmaz.** Sadece:

1. Bilgisayarın ana bilgisayarla **aynı ağa** bağlı olduğundan emin olun.
2. Chrome veya Edge'i açın.
3. Adres çubuğuna ana bilgisayarın adresini yazın: `http://192.168.1.50:5123` (kendi IP'nizi yazın).
   - Başına `http://` yazmayı, sonuna `:5123` eklemeyi unutmayın.
4. Kullanıcı adı ve parolayla giriş yapın.
5. Kolaylık için:
   - Sayfayı **yer imlerine** ekleyin (Ctrl + D), **veya**
   - `open-client.cmd` dosyasını client'ın masaüstüne kopyalayın; çift tıklayınca adres sorar, adresi yazınca program açılır.

> ✅ Kontrol: Client'ta `http://SUNUCU-IP:5123/api/health` açıldığında `"status":"ok"` görünmeli.

---

## 7. Günlük kullanım — kısa özet

| Ne zaman? | Ne yapılır? |
|---|---|
| Sabah | Ana bilgisayarı açın ve Windows'ta oturum açın. Siyah server penceresi kendiliğinden açılır. |
| Gün içinde | Herkes tarayıcıdan adrese girip çalışır. Başkasının değişikliğini görmek için sayfayı yenileyin (F5). |
| Akşam | Client'lar kapatılabilir. **Ana bilgisayarı mümkünse açık bırakın** (otomatik yedek 6 saatte bir alınır). |
| Her gün / haftada bir | `C:\HukukOfisiMerkezi\backups` klasörünü harici diske veya USB'ye kopyalayın. |

### Elle yedek alma

Ana bilgisayarda `cmd` açıp:

```text
cd C:\HukukOfisiMerkezi
npm run backup
```

Yedek dosyası `backups` klasörüne kaydedilir. Son 30 yedek saklanır.

> ⚠️ **Asıl veri dosyası:** `C:\HukukOfisiMerkezi\data\hukuk-ofisi.sqlite`. Bu dosyayı ve `data` klasörünü asla silmeyin, ağda paylaşıma açmayın, client'lardan açmaya çalışmayın.

---

## 8. Sorun giderme

| Sorun | Ne yapmalı? |
|---|---|
| `start-server.cmd` açılıp "Node.js bulunamadi" diyor | Node.js kurulu değil ya da eski. Adım 4.2'yi tekrarlayın, bilgisayarı yeniden başlatın. |
| Siyah pencerede `EADDRINUSE` gibi bir hata yazıyor | Program zaten başka bir pencerede çalışıyor olabilir (5123 portu dolu). Görev çubuğunda açık başka bir siyah pencere var mı bakın; yoksa bilgisayarı yeniden başlatın. |
| Ana bilgisayarda açılıyor, client'ta açılmıyor | 1) Client ve ana bilgisayar aynı ağda mı? 2) Ana bilgisayarın ağ profili **Özel** mi? 3) IP adresi değişmiş mi (`ipconfig`)? 4) Adım 4.3'teki kurulum yapıldı mı? 5) Misafir Wi-Fi kullanılıyor mu? |
| Dün çalışıyordu, bugün kimse bağlanamıyor | Ana bilgisayar açık mı, oturum açılmış mı, siyah pencere açık mı? IP adresi değişmiş olabilir — `ipconfig` ile kontrol edin, gerekirse modemde IP rezervasyonu yaptırın. |
| "Bu siteye ulaşılamıyor" | Adresi kontrol edin: `http://` ile başlamalı, `:5123` ile bitmeli. `https://` **değil**. |
| Giriş yapamıyorum | Kullanıcı adı/parola doğru mu? Kullanıcı admin tarafından pasif yapılmış olabilir. |
| Google Sheets okunamadı | Sheets'te **Paylaş → Genel erişim → Bağlantıya sahip olan herkes → Görüntüleyici** seçilmeli. Ana bilgisayarda internet olmalı. |
| Yaptığım değişiklik diğer bilgisayarda görünmüyor | O bilgisayarda sayfayı yenileyin (F5). |
| "Çakışma" uyarısı | İki kişi aynı alanı aynı anda değiştirmiştir. Sayfayı yenileyip tekrar kaydedin. |

---

## 9. Güvenlik kuralları (kısaca)

- `admin / Ofis2026!` parolasını **ilk gün** değiştirin.
- Modemde **5123 portunu internete açmayın** (port yönlendirme yok).
- Ağ profili **Genel (Public)** ise güvenlik duvarını kapatmayın; ağ profilini **Özel** yapın.
- İşten ayrılan çalışanın kullanıcısını `admin.html` ekranından **pasif** yapın.
- `C:\HukukOfisiMerkezi` klasörünü ağda paylaşıma açmayın.
- Yedekleri başka bir diske düzenli kopyalayın.

---

## 10. Kurulum kontrol listesi (yazdırıp işaretleyin)

- [ ] Program klasörü `C:\HukukOfisiMerkezi` içinde
- [ ] `node -v` → v22.13 veya üzeri
- [ ] `install-server.ps1` yönetici olarak çalıştırıldı ("Kurulum tamamlandı")
- [ ] Ağ profili **Özel**
- [ ] Ana bilgisayarın IP adresi not edildi ve sabitlendi: `_______________`
- [ ] Uyku modu **Hiçbir zaman**
- [ ] `start-server.cmd` çalışıyor, `/api/health` → `status: ok`
- [ ] Admin parolası değiştirildi
- [ ] Çalışan kullanıcıları oluşturuldu
- [ ] Her client'ta adres yer imine eklendi: `http://_______________:5123`
- [ ] İlk elle yedek alındı (`npm run backup`) ve harici diske kopyalandı

Daha ayrıntılı teknik bilgi için: `KULLANIM-KILAVUZU-MERKEZI-SURUM.md` ve `PROJE-RAPORU-MERKEZI-SURUM.md`.
