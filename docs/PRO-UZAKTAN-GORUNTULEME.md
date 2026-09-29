# DestekOfis Pro — Uzaktan görüntüleme (çekmecede, onay bekliyor)

Durum: kullanıcı "başla" dedi (29.09.2026); bu belge iş planıdır. Yeni oturum önce en alttaki **Oturum devri** bölümünü okur.
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
- Site: mevcut demonun yanına **"Pro demo indir"** düğmesi. Standart demo Standart deneme, Pro demo Pro deneme açar
  (kullanıcı kararı: Standart demo kullanana Pro deneme verilmez). Deneme bilgisayar başına bir kez olduğundan Standart
  demodan sonra aynı bilgisayarda Pro deneme başlatılamaz. Hangi demonun indirildiği kurulum dosyasındaki işaretle
  (ör. ayrı dosya adı `DestekOfis-Pro-Kurulum.exe`, içerik aynı) deneme isteğine taşınır; yöntem 1. adımda seçilir.
- **Sitede fiyat yazılmaz** (kullanıcı kararı, 29.09.2026): mevcut sürümde olduğu gibi yalnız demo indirilir; lisans almak
  isteyen arar, fiyat telefonda bildirilir.
- **Pro, Vercel'e konmaz** (kullanıcı kararı): telefon sayfası ve kapıcı yalnız Cloudflare'de çalışır; Vercel Hobby'nin
  ticari kullanım riskine ve kotasına Pro trafiği eklenmez. Site ve lisans servisi şimdilik Vercel'de kalır.
- Lisans süresi biter ya da engellenirse sunucu yüklemeyi durdurur, Worker o ofisin dosyasını vermez.

## Paket kuralları (kullanıcı kararları, 29.09.2026)

- **Tek program, tek kod, tek kurulum, tek güncelleme.** Düzeltmeler herkese gider. Yeni özellik, kullanıcı açıkça
  "Pro'ya özel" demedikçe herkese gelir. Şu an Pro'ya özel tek şey uzaktan görüntüleme.
- **Operatör merkezi → Lisans tanımla:** "Paket: Standart / Pro" seçimi. Mevcut lisanslar Standart. Pro'ya geçişte yeni
  anahtar verilmez: lisansta Pro seçilir, program bir sonraki denetimde (ya da "Lisansı şimdi denetle" ile) Pro olur.
  İnternetsiz `DOLIS1.` kodu da paket bilgisini taşır.
- **Operatör paketi her zaman iki yöne değiştirebilir** (yanlış seçimi düzeltmek için). "Pro lisanslı müşteri Standart'a
  düşürülmez" bir işletme kuralıdır, program engellemez; Pro → Standart değiştirirken operatöre onay sorusu çıkar.
- **Pro demodan Standart lisansa geçiş kabul:** operatör Standart lisans verir. Program Standart açılır, veriler olduğu
  gibi kalır; yükleme durur, buluttaki kopya silinir, eşli cihazlar "uzaktan görüntüleme kapalı" görür.
- **Pro'yu denemek yalnız lisansla:** "14 gün Pro dene" yok. Standart programda yalnız yöneticinin gördüğü küçük
  **"Pro'ya yükselt"** düğmesi: Pro'yu anlatan kısa kart, satıcının telefonu, **"Beni arayın"** (lisans servisine tek
  istek; operatör merkezinde "Pro talebi" rozeti ve hareket kaydı; lisans Pro yapılınca talep kendiliğinden kapanır).
  Talep gönderildikten sonra düğme "Talep gönderildi" olur.

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
3. **Pro fiyatı** sitede yazılmaz; telefonda bildirilir. Operatör merkezinde lisans verirken Standart / Pro seçilir.
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

## Oturum devri (yeni oturum önce bunu okur)

**Hazır olanlar (kullanıcı yaptı, 29.09.2026):**
- Ayrı Cloudflare hesabı (satıcının; kullanıcının kişisel hesabından ayrı), iki adımlı giriş açık, R2 etkin. Ücretsiz
  sınırlar ödeme sayfasında teyit edildi: 10 GB, ayda 1 milyon yazma, 10 milyon okuma. İlk bakışta kova ve Worker yoktu.
- API belirteci oluşturuldu ve Claude Code bulut ortamına **API kimlik bilgisi** olarak eklendi (`api.cloudflare.com`;
  vekil sunucu isteğe kendisi ekler). Hesap numarası ortam değişkeni `CLOUDFLARE_ACCOUNT_ID`. Ağ erişimi "Güvenilir".
  Bu ayarlar yalnız ayarlar kaydedildikten **sonra açılan** oturumlarda vardır. Yükleme oturumunda ilk iş
  `GET /client/v4/user/tokens/verify` ile belirteci ve yetkilerini doğrulamak.
- Belirteç, parola, kurtarma kodları sohbete, depoya, zip'e **asla** yazılmaz; kullanıcıdan yapıştırması istenmez.
- İsteğe bağlı, kullanıcı onaylamadı: 1 USD fatura uyarısı.

**Araçlar:**
- Cloudflare bağlayıcısı (MCP): R2 kova oluştur/listele, Worker listele/oku, KV, D1, belge arama. Worker **yükleyemez**;
  Worker ve Pages yükleme API ile, belirteç olan oturumda yapılır.
- Bu ortamdan `destek-ofis.vercel.app`, `*.workers.dev`, `*.pages.dev` erişimi engelli olabilir; canlı deneme için
  kullanıcı ağ erişimine alan ekler (ekran görüntüsüyle tarif edilir).
- Supabase bağlayıcısı çalışır (proje `lvzaeekyovhquljzesye`, şema `lisans`). Vercel bağlayıcısının projeye erişimi yok.
  Operatör merkezi `ceougur/destekofis` deposunda; PR birleşince Vercel kendisi yayımlar.

**Çalışma biçimi (kullanıcıyla):**
- Basit Türkçe, teknik olmayan, tıklanacak yeri tek tek söyleyen anlatım; kullanıcı ekran görüntüsüyle sorar.
  Cloudflare ve ortam ayarlarında deneyimi az; ondan istenen adım en aza indirilir.
- Sıra: kod ve testler → iş akışı testleri → paket (zip + SHA256SUMS) kullanıcıya → kullanıcı doğrular → PR ve yayın.
  Birleştirme ve yayın kullanıcı onayıyla (kullanıcı istediğinde PR'ı Claude açar ve birleştirir). Yayından sonra yayın
  dosyaları indirilip yereldeki derlemeyle bayt bayt karşılaştırılır.
- Kod bu oturumda yazılır; yalnız Cloudflare'e yükleme için yeni oturum gerekir. Kullanıcı o oturuma
  "Pro'yu Cloudflare'e yükle, devir notunu oku" yazar.

**İlerleme** (adım bitince işaretlenir):
- [ ] 1 Lisans paketi (Standart/Pro, Pro demo, Pro'ya yükselt, operatör merkezi)
- [ ] 2 Sunucu özeti, şifreleme, yükleme zamanlayıcısı
- [ ] 3 Yönetim: izin, QR, cihaz listesi, silme ve anahtar yenileme
- [ ] 4 Worker, R2, Pages (kod burada; yükleme ayrı oturumda)
- [ ] 5 Site "Pro demo indir", operatör Cloudflare sayaçları
- [ ] 6 İş akışı testleri, belge, kılavuz, paket
