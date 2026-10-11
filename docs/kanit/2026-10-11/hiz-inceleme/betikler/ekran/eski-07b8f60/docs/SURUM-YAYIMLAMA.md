# Sürüm yayımlama (bakımcı kılavuzu)

Kurulumlar sunucu açılışında `ceougur/ofis---y-netimi` deposunun **GitHub Releases** sayfasına bakar. Bir yayının kurulumlara ulaşması için içinde şu iki dosya bulunmalıdır:

| Dosya | İçerik |
|---|---|
| `destekofis-guncelleme-<sürüm>.zip` | Uygulama sürümü (sunucu + arayüz). Node.js çalışma zamanı ve servis ayarları içinde **yoktur**. |
| `destekofis-guncelleme.json` | İmzalı bildirge: sürüm, kanal, sürüm notları, paket boyutu ve SHA-256 özeti, gereksinimler. |

İsteğe bağlı olarak kurulum dosyası (`DestekOfis-Kurulum-<sürüm>.exe`) da eklenir; yeni müşteriler ve elle güncelleme için. Otomatik yayın ayrıca sitenin "Demoyu indir" düğmesinin indirdiği sürümsüz `DestekOfis-Kurulum.exe` ile kullanım kılavuzunu (`DestekOfis-Kullanim-Kilavuzu.pdf`) ekler.

Kurulum, yayın etiketindeki sürüm (`v1.3.1` → `1.3.1`) kendi sürümünden yeniyse bildirgeyi indirir, **imzayı uygulamaya gömülü açık anahtarla doğrular**, etiket ile bildirge sürümünün aynı olduğunu, paket boyutunu ve özetini denetler; ancak ondan sonra kurar.

## İmza anahtarı

- Anahtar kimliği: `destekofis-2026-1` · açık anahtar: `server/lib/update-keys.mjs` (parmak izi `2817e154132ada8a`).
- **Gizli anahtar** (`destekofis-2026-1.pem`) depoya asla girmez. Bir kopyasını parola yöneticisinde veya şifreli bir USB'de saklayın. Bu anahtarı ele geçiren biri tüm kurulumlara güncelleme gönderebilir; kaybederseniz yeni güncelleme yayımlayamazsınız (kurulum dosyasıyla yeni anahtara geçmek gerekir).
- GitHub Actions için: depo → *Settings → Secrets and variables → Actions → New repository secret* → ad `DESTEKOFIS_RELEASE_KEY`, değer `.pem` dosyasının tüm içeriği.

**Anahtar değiştirme (rotasyon):** `node tools/release-keygen.mjs destekofis-2027-1` ile yeni anahtar üretin → açık anahtarı `update-keys.mjs`'e **ekleyin** → bu sürümü **eski** anahtarla yayımlayın → kurulumlar bu sürüme geçtikten sonra yeni anahtarla imzalamaya başlayın ve eski anahtarı listeden çıkarın.

## A) Otomatik yayın (GitHub Actions)

1. `package.json` içindeki `version` alanını yükseltin ve `CHANGELOG.md` başına `## <sürüm> — <başlık>` bölümünü yazın (sürüm notları buradan alınır).
2. Değişiklikleri gönderin, ardından etiketleyin: `git tag v1.3.1 && git push origin v1.3.1`.
3. `release.yml` sırasıyla: testler → e2e → Windows kurulum dosyası + gerçek Windows'ta kurulum/servis/kaldırma testi → imzalı güncelleme paketi → GitHub Release. Herhangi bir adım başarısızsa yayın yapılmaz.

**Terminal olmadan (web arayüzünden, v2.0.1):** `DESTEKOFIS_RELEASE_KEY` sırrı tanımlıysa GitHub → **Releases → Draft a new release** → *Choose a tag* alanına `v2.0.1` yazıp *Create new tag* (hedef: `master`) → başlık `DestekOfis 2.0.1` → **Publish release** yeterlidir; dosya yüklemeyin. Etiket oluşunca `release.yml` testleri ve gerçek Windows kurulum testini çalıştırır, ardından imzalı güncelleme paketini, bildirgeyi, kurulum dosyalarını ve kılavuzu **mevcut yayına ekler** (yaklaşık 30–40 dk). Bu dosyalar eklenene kadar kurulumlar yayını görmez; eklenince bir sonraki denetimde (açılışta ve saatte bir) bulunur: açılışta bulunan hemen kurulur, gün içinde bulunan arka planda indirilip sunucunun bir sonraki açılışında (ya da boşta / mesai dışında) kurulur. Testlerden biri başarısız olursa hiçbir dosya eklenmez; *Actions* sekmesinde kırmızı görünür ve yayın kurulumlara ulaşmaz.

Etiket `-beta.1` gibi bir ek içeriyorsa (ör. `v1.4.0-beta.1`) yayın **ön sürüm** olarak işaretlenir ve yalnızca *Deneme (beta)* kanalındaki kurulumlara gider.

## B) Elle yayın

1. Paketi üretin: `node tools/release.mjs --anahtar C:\gizli\destekofis-2026-1.pem` (beta için `--kanal beta`). Çıktı: `dist/guncelleme/`.
2. GitHub → depo → **Releases → Draft a new release**.
3. *Choose a tag* → `v1.3.1` yazıp *Create new tag* (etiket, `package.json` sürümüyle aynı olmalı).
4. Başlık: `DestekOfis 1.3.1`; açıklamaya `dist/guncelleme/SURUM-NOTLARI.md` içeriğini yapıştırın.
5. `destekofis-guncelleme-1.3.1.zip` ve `destekofis-guncelleme.json` dosyalarını sürükleyip bırakın (isteğe bağlı: kurulum dosyası).
6. Beta ise *Set as a pre-release* kutusunu işaretleyin. **Publish release**.

Etiket GitHub'da oluştuğunda `release.yml` yine çalışır: testleri ve gerçek Windows kurulum testini yapar. Yayında imzalı güncelleme dosyaları zaten varsa (elle yüklenmişse) onlara **dokunmaz**; yalnızca eksik olanları (Windows'ta sınanmış kurulum dosyası, kılavuz; sır tanımlıysa ve yüklenmemişse imzalı paket) ekler. Yayını önce *taslak* (draft) olarak kaydederseniz kurulumlar onu görmez; hazır olduğunuzda *Publish release* ile yayımlarsınız.

## Site (destek-ofis.vercel.app)

- **Demo düğmesi** yayına bağlıdır (`releases/latest/download/DestekOfis-Kurulum.exe`): yayında sürümsüz `DestekOfis-Kurulum.exe` varsa site kendiliğinden yeni sürümü indirir.
- **Kullanım kılavuzu düğmesi yayına bağlı DEĞİLDİR**: site kendi kopyasını verir (`ceougur/destekofis` → `web/indir/DestekOfis-Kullanim-Kilavuzu.pdf`; demo indirilince kılavuz yeni sekmede açılsın diye sitede barındırılır). Her sürümde bu dosya `client/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf` ile değiştirilip site deposunda PR açılır ve birleştirilir; yapılmazsa siteden eski kılavuz iner (2.0.3–2.0.14 arasında böyle kaldı, 2.0.15'te düzeltildi: ceougur/destekofis#3).

## Kurallar

- Yayımlanmış bir sürümün dosyalarını değiştirmeyin; hatalı bir sürümü düzeltmek için daha yüksek numaralı yeni bir sürüm yayımlayın. Yayını silmek, onu kurmuş sunucuları geri almaz.
- Bir sürüm kurulumlarda açılamazsa sunucu kendiliğinden önceki sürüme döner ve o sürümü bir daha kendiliğinden denemez; düzeltilmiş sürüm yeni numarayla gelmelidir.
- Güncelleme paketi Node.js çalışma zamanını ve servis ayarlarını değiştiremez. Bunları gerektiren bir sürüm için bildirgeye gereksinim yazılır (`requires.node`, `requires.bootstrap`, `--en-dusuk`); eski kurulumlar o sürümü otomatik kurmaz, yönetim paneli kurulum dosyasını önerir.
- Veritabanı göçleri yalnızca ekleyici olmalıdır (önceki sürüm yeni şemayla çalışabilmeli); geri dönüşte gerekirse güncelleme öncesi yedek kullanılır.
- Büyük değişiklikleri önce beta kanalında bir test sunucusunda deneyin.

## Sorun giderme

| Belirti | Olası neden |
|---|---|
| Kurulumlar yeni sürümü görmüyor | Yayın taslak (draft) veya ön sürüm; etiket `v` + sürüm biçiminde değil; `destekofis-guncelleme.json` eksik; depo özel yapılmış (özel depo için güncelleme kaynağı Vercel üzerinden sunulmalı). |
| "İmzası doğrulanamadı" | Paket güvenilmeyen bir anahtarla imzalanmış veya bildirge elle değiştirilmiş. |
| "Etiket ile bildirge uyuşmuyor" | Yanlış etikete yanlış paket yüklenmiş. |
| "Özeti tutmuyor" | Zip dosyası bildirge üretildikten sonra değişmiş veya eksik yüklenmiş. |
