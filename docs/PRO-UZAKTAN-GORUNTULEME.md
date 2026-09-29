# DestekOfis Pro — Uzaktan görüntüleme (çekmecede, onay bekliyor)

Durum: tasarım kararlaştırıldı (29.09.2026), kod yazılmadı. Kullanıcı "başla" deyince bu belge iş planıdır.
Bu belgedeki kararlar kullanıcıyla tek tek konuşularak alındı; değiştirmeden önce kullanıcıya sorulur.

## Amaç

Ofis dışındaki yetkili kişi telefondan, tabletten ya da başka bilgisayardan **kasa, cari, stok, taksit ve ANLIK DURUM**
bilgilerini **yalnız görüntüler** (ilk sürümde kayıt girişi yok). Maliyet hedefi: sıfır (tek masraf isteğe bağlı alan adı).

## Neden bu yol (reddedilen seçenekler)

| Seçenek | Karar | Neden |
| --- | --- | --- |
| Verinin Supabase'e kopyalanıp Vercel'de ayrı panel (ilk beyin fırtınası) | Reddedildi | Kullanıcılar Supabase'te değil, ofis sunucusunda; müşterinin mali verisi bizde okunur halde durur (KVKK "veri işleyen" yükü; sitemiz "veri ofiste kalır" diyor); Supabase ücretsiz 500 MB tüm müşterilere ortak ve 7 gün istek yoksa durur; Vercel Hobby ticari kullanıma kapalı. |
| Cloudflare Tunnel ile canlı erişim | Şimdilik reddedildi (ileride "telefondan kayıt girme" için ikinci adım) | Sunucu bilgisayar sürekli açık, uykusuz ve internete bağlı olmalı; elektrik/internet kesilince ve ofiste kimse yokken müdahale edilemez. |
| Müşterinin kendi Google Drive'ı | Reddedildi | Telefonda Google girişi ve izin ekranları; her müşteride ayrı kurulum. |
| App Store / Play Store uygulaması | Reddedildi | Apple yıllık ücret ve sürüm onayı; maliyetsiz hedefe aykırı. |

**Seçilen yol: şifreli özet kopyası.** Kayıt yalnız ofis sunucusunda girildiği için sunucu kapalıyken veri değişmez;
son kopya zaten en güncel haldir. Telefonun canlı bağlantıya ihtiyacı yoktur.

## Mimari

1. **Sunucu (ofis):** Pro lisanslıysa değişiklikten sonra özeti hazırlar (kasa, cari bakiyeleri ve son hareketler, stok,
   taksitler, ANLIK DURUM), sıkıştırır, **şifreler** ve yükler.
   - En çok 15 dakikada bir yükler; 10 dakika hareketsizlikte bir kez daha; değişiklik yoksa hiç (gece/hafta sonu sıfır).
   - Ofis başına günde en çok 20 yükleme. Her ofiste tek dosya, üzerine yazılır.
2. **Bulut: Cloudflare (tek hesap, satıcının).**
   - **R2** (dosya deposu): her ofisin şifreli dosyası.
   - **Worker** (kapıcı): yalnız lisanslı + Pro sunucunun yazmasına, eşlenmiş cihazın yalnız kendi ofisinin dosyasını
     okumasına izin verir. Yazma yetkisi lisans servisinin imzaladığı belirteçle doğrulanır.
   - **Pages**: telefonun açtığı sayfa (ana ekrana eklenebilen web uygulaması).
   - Ücretsiz alt adres (`*.pages.dev` / `*.workers.dev`) yeter; `destekofis.net` alınırsa ona taşınır.
3. **Telefon:** dosyayı indirir, **kendi içinde çözer** ve gösterir; üstte "Son güncelleme: SS:DD". Yalnız açılınca ve
   ekran aşağı çekilince sorar (sürekli sorgu yok); dosya değişmemişse yeniden indirmez.

**Şifreleme:** anahtar yalnız ofis sunucusunda ve eşlenmiş cihazlarda. Cloudflare ve biz dosyanın içini okuyamayız.
Zarf şifreleme: veri anahtarı her cihazın kendi anahtarıyla ayrıca sarılır; cihaz silinince veri anahtarı yenilenir,
kalan cihazlara yeni anahtar kendiliğinden gider, silinen cihaz bir sonraki güncellemeden itibaren hiçbir şey açamaz.

## Yetki ve cihaz eşleme (kullanıcının istediği biçim)

- **Yönetim → Kullanıcılar:** kullanıcı başına **"Uzaktan bağlanabilir"** kutusu. İşaretsiz olan için QR üretilemez.
- **SMS / e-posta / kod gönderme yok** (maliyet ve yönetim yükü — kullanıcı kararı).
- Telefon ayarlarındaki cihaz bilgisi (seri no, IMEI, cihaz adı) **web sayfasından okunamaz**; bu yüzden "cihaz bilgisini
  elle ekleyip eşleştirme" yerine **QR ile eşleme** kullanılır:
  1. Yönetici "Cihaz ekle" → tek kullanımlık, birkaç dakika geçerli QR.
  2. Kişi QR'ı okutur → cihaz eşlenir, kişi o cihazın kilidini seçer: **parmak izi / yüz (passkey)** ya da **4–6 haneli PIN**.
  3. Panelde "Ahmet · iPhone · eklendiği tarih · son giriş" satırı; yönetici istediği an siler.
  4. Sonraki girişler: simge → parmak izi/yüz/PIN → içeri. Eşleme **bir kez** yapılır.
- Ofis şifresi uzaktan kontrol edilmez (sunucu kapalı olabilir); eşlemede bir kez sorulur.
- **Açık cihazlar ve uzaktan giriş kaydı** panelde görünür; tek tuşla kaldırılır.
- Yeniden eşleme gereken durumlar: telefon değişir/sıfırlanır, ana ekran simgesi ya da tarayıcı verisi silinir, yönetici
  cihazı ya da izni kaldırır, Pro lisans biter (yenilenince eşlemeler geri gelecek şekilde tasarlanacak).
  Gerekmeyenler: bilgisayar şifresi değişir, başka cihaz silinir, program güncellenir, sunucu günlerce kapalı kalır.

## Telefonda kurulum

- **QR** okutulunca açılan sayfa cihazı tanır.
- **iPhone/iPad:** sayfa kendini ana ekrana ekleyemez; sayfa üç adımlık yol gösterir (Paylaş → Ana Ekrana Ekle → simgeden aç).
  Ana ekrandaki simge Safari'den ayrı hafıza kullanır ve Safari'nin kullanılmayan site verisini silme kuralından muaftır;
  bu yüzden **eşleme simgeden yapılır**.
- **Android:** Chrome "Uygulamayı yükle" düğmesini kendisi gösterir.
- Simge şart değil; yer imiyle de girilir.
- Parmak izi / yüz yalnız https adreste çalışır (Cloudflare adresleri https).

## Pro sürüm ve site

- **Ayrı program yazılmaz:** aynı program, Pro özellikleri lisansla açılır (lisans belirtecine `plan: "pro"`).
- Operatör merkezi: lisans verirken **Standart / Pro** seçimi; Altyapı limitleri kartına Cloudflare sayaçları (günlük
  Worker isteği, aylık R2 yazma) eklenir, %70'te uyarı.
- Site: mevcut demonun yanına **"Pro demo"** düğmesi; aynı kurulum dosyası, deneme 30 gün Pro özellikleriyle açılır.
- Lisans süresi biter ya da engellenirse sunucu yüklemeyi durdurur, Worker o ofisin dosyasını vermez.

## Kapasite hesabı (1.000 ofis × 3 kullanıcı, ofis başına 1.000'er kasa/cari/taksit/stok)

Kullanıcı / cihaz sayısı sınırı yok; Cloudflare istek sayar. Ücretsiz sınırlar hesap açılırken fiyat sayfasından teyit edilecek.

| Kalem | Tahmin | Ücretsiz sınır (bilinen) |
| --- | --- | --- |
| Depolama | ofis başına ~200 KB, toplam ~200 MB | 10 GB |
| R2 yazma / ay | ~600 bin | 1 milyon |
| R2 okuma / ay | ~900 bin | 10 milyon |
| Worker isteği / gün | ~50 bin | 100 bin |
| Veri çıkışı | birkaç yüz GB | R2'de ücretsiz |

Sınır aşılırsa o gün yeni istekler reddedilir; telefon son kopyayı göstermeye devam eder, ofis programı etkilenmez;
ertesi gün sıfırlanır. Kalıcı çözüm Workers ücretli planı (aylık ~5 USD).

## Başlamadan önce kullanıcıdan gerekenler

1. **Cloudflare hesabı** (ücretsiz, satıcı adına; iki adımlı giriş açık). Worker'ın API anahtarı gizli değişken olarak
   saklanır; hiçbir depoya, zip'e, belgeye girmez.
2. **Alan adı** isteğe bağlı (`destekofis.net`); alınmazsa Cloudflare'in ücretsiz alt adresi kullanılır.
3. **Pro fiyatı** ve Standart → Pro yükseltme yolu.
4. **KVKK metni ve kılavuz** için tek paragraf: "özet şifreli kopya olarak saklanır; anahtar yalnız ofiste ve eşlenmiş
   cihazlarda; satıcı içeriği okuyamaz".

## Kapsam dışı (ileride)

- Telefondan kayıt girişi (tahsilat, stok hareketi): sunucunun açık olmasını gerektirir → Cloudflare Tunnel ikinci adım.
- Bildirim (push) gönderme.

## İş sırası (başlanınca)

1. Lisans: `plan` alanı, operatör merkezinde Standart/Pro, deneme = Pro.
2. Sunucu: özet üretici (mevcut ANLIK DURUM / rapor motoru üzerine), şifreleme, yükleme zamanlayıcısı, sayaçlar.
3. Yönetim: "Uzaktan bağlanabilir" kutusu, Cihaz ekle (QR), cihaz listesi, silme ve anahtar yenileme, giriş kaydı.
4. Cloudflare: Worker (yetki), R2, Pages (telefon arayüzü: kasa, cari, stok, taksit, ANLIK DURUM; iPhone/Android kurulum yolu).
5. Site: "Pro demo" düğmesi; operatör merkezinde Cloudflare sayaçları.
6. İş akışı testleri: boş veri, sunucu kapalıyken açma, cihaz silme sonrası erişim kesilir, lisans bitince durur, iki
   ofisin verisi karışmaz, aynı adlı iki kişi, iPhone ve Android'de gerçek cihaz provası; belge, kılavuz, paket.
