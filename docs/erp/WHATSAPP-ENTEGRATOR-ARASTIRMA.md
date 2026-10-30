# WhatsApp Toplu Gönderim: Entegratör Karşılaştırması (DestekOfis 2.4.8)

Tarih: 30.10.2026 · Kaynak: yalnız bu oturumda açılan sayfalar (URL'ler her satırda ve §6'da). Ham sayfa kopyaları: `ham/` klasörü (yanında).

## 1. Öneri

**SONUÇ: DestekOfis, Meta'ya doğrudan "Tech Provider" olarak kaydolsun. Müşteriler kendi WhatsApp hesaplarını Embedded Signup ile DestekOfis uygulamasına bağlasın, mesajlar araya entegratör (BSP) girmeden Cloud API ile gitsin.**

Gerekçe:
- **Aylık sabit ücret yok, mesaj başına ek yok.** Müşteri yalnız Meta'nın ücretini öder, Meta da kendi kartından çeker. Türkiye utility ücreti ileti başına yaklaşık 0,0009 USD; bu sayı Twilio'nun Eylül 2026 tarihli sayfasındaki Meta ücretinden alındı (Meta'nın kendi tablosu açılamadı, §4). Karşılaştırma: 360dialog numara başına ayda 49 EUR, Twilio ileti başına 0,005 USD ek alıyor.
- **Telekom aboneliği ya da imza sirküleri gerekmiyor.** Numara, SMS ya da sesli arama ile gelen tek kullanımlık kodla doğrulanıyor. Müşteri mevcut WhatsApp Business uygulamasındaki numarasını da bağlayabiliyor (Coexistence).
- **PDF herkese açık bağlantı gerektirmiyor.** Program PDF'i Meta'ya kendisi yükleyebiliyor (medya kimliği 30 gün geçerli). Böylece kapıcıda 3 günlük şifreli PDF saklama gereği kalkabilir.
- **Durum webhook'u var ve Meta 7 gün yeniden deniyor.** Program kapalıyken düşen durumlar, program açılınca gelebilir.
- **BSP yolu da DestekOfis'i Meta işinden kurtarmıyor.** Infobip'e göre ISV'lerin 30.06.2025'ten itibaren Meta'da Tech Provider olması gerekiyor; Twilio da Tech Provider yolunu anlatıyor.

Bedeli:
- Müşterinin bir Facebook/Meta hesabı olmalı ve Meta'ya kendi kartını (USD/EUR) eklemeli.
- DestekOfis'in işleri: işletme doğrulaması, App Review (2 video) ve kod değişimi için küçük bir sunucu parçası (Cloudflare Worker).
- Başlangıçta haftada en çok 10 yeni müşteri bağlanabiliyor.

## 2. Karşılaştırma tablosu

"—" ya da "doğrulanamadı": açılan sayfada yazmıyor ya da sayfa açılmadı.

| Seçenek | Son müşterinin kurulumu ve süresi | Telekom aboneliği / imza sirküleri | DestekOfis'in tek seferlik işi | Aylık sabit (numara başına) | Mesaj başına ek | PDF yöntemi | Durum webhook'u | TL fatura / Türkçe destek | Kaynak |
|---|---|---|---|---|---|---|---|---|---|
| **Meta Cloud API + Embedded Signup, DestekOfis Tech Provider (doğrudan)** | Programda "Bağla" → Facebook/Meta girişi → işletme portföyü seç/oluştur → WhatsApp hesabı → numara + OTP (ya da Coexistence: WA Business uygulamasından onay) → görünen ad → Bitir → Meta'da kart ekle. Süre: "birkaç dakika" (Twilio ifadesi); kart ekleme ayrı. | HAYIR (SMS/ses OTP) | İşletme doğrulaması, Meta uygulaması, App Review (Advanced access: whatsapp_business_management + whatsapp_business_messaging; 2 video; ortalama ~24 saat), ES sayfası (HTTPS, izinli alan adı), kod değişimi için sunucu (app secret), webhook ucu | 0 | 0 (yalnız Meta ücreti; TR utility ~0,0009 USD/teslim, Twilio sayfasından) | Yükleme (`/PHONE_NUMBER_ID/media`, kimlik 30 gün) ya da link (önerilmez) | VAR (messages → statuses), 7 gün yeniden deneme, WABA/numara başına ayrı adres (override) | Meta faturası: para birimi listesinde TRY yok (USD/EUR…); e-Fatura doğrulanamadı; ES akışı Türkçe | developers.facebook.com (§6: 1–14) |
| **360dialog (iş ortağı, Direct-Paid)** | Doğrudan bağlantı: 360dialog kayıt sayfası → fiyat/ödeme sayfası → Meta Embedded Signup → izin ekranı. Süre doğrulanamadı. | Sayfada istenmiyor | 360dialog iş ortağı hesabı; bağlantı adresi (kodsuz) ya da Connect Button/özel akış; API anahtarı üretimi (müşteri izniyle). Ayrıca Meta Tech Provider olmak gerekir mi: doğrulanamadı | Direct-Paid'de müşteriye kanal ücreti: Regular 49 EUR / 59 USD (Premium 99 EUR). Partner-Paid'de iş ortağı planı 250 / 500 / 1.000 EUR (5 / 10 / 20 kanal dahil) | Meta ücreti aynen; kartla ödemede %4 işlem ücreti; pazarlama mesajı Marketing Messages API dışından giderse +%7 (bizi ilgilendirmez) | Yükleme önerilir (media ID) | Webhook var (iş ortağı + mesaj olayları) | Faturalama yalnız EUR/USD; Türkçe destek doğrulanamadı | docs.360dialog.com (§6: 15–20) |
| **Twilio (Tech Provider + Twilio alt hesabı)** | Embedded Signup (Twilio'da da aynı Meta akışı) → DestekOfis Senders API ile göndericiyi alt hesaba bağlar | HAYIR (Twilio numarası ya da kendi numarası + OTP) | Meta uygulaması + onay, Twilio "Partner Solution" bağlantısı (1–2. adım "genelde 3–4 hafta"), ES entegrasyonu, müşteri başına alt hesap | Sayfada numara başına WhatsApp sabit ücreti görülmedi | **+0,005 USD her ileti** (gelen/giden) + Meta ücreti (TR utility 0,0009 USD) | Yalnız Twilio ham sayfasında başlık: MediaUrl ayrıntısı açılmadı, doğrulanamadı | Twilio durum geri çağrısı: bu sayfalarda doğrulanamadı | USD; Türkçe destek doğrulanamadı | twilio.com (§6: 21–23) |
| **Infobip (Tech Provider, Infobip Solution Partner)** | Meta ES (Infobip üzerinden) | Sayfada istenmiyor | Meta'da TP adımlarının hepsi (portföy, uygulama, işletme doğrulaması, App Review) + "partner solution" + Infobip'te gönderici kaydı | doğrulanamadı | doğrulanamadı | doğrulanamadı | doğrulanamadı | doğrulanamadı | infobip.com/docs (§6: 24–25) |
| **Gupshup (ISV/TP)** | Meta TP üzerinden iş ortağı katılımı | doğrulanamadı | Meta Tech Provider yolu ("Gupshup Partner Onboarding via Meta's Tech Provider Program") | doğrulanamadı | doğrulanamadı | doğrulanamadı | doğrulanamadı | doğrulanamadı | docs.gupshup.io (§6: 26–27) |
| **Vonage** | doğrulanamadı | doğrulanamadı | doğrulanamadı | doğrulanamadı | Vonage platform ücreti **ileti başına** + Meta ücreti (tutar açılan sayfada yok) | Belge medya ileti türü ve şablon başlığı var (yöntem ayrıntısı doğrulanamadı) | İleti durum webhook'u anılıyor | doğrulanamadı | developer.vonage.com (§6: 28) |
| **Bird (MessageBird)** | doğrulanamadı | doğrulanamadı | doğrulanamadı | doğrulanamadı | doğrulanamadı | doğrulanamadı | Teslim olayları için webhook anılıyor | doğrulanamadı | bird.com/docs (§6: 29) |
| **Netgsm** | Netgsm abonesi ol → Facebook işletme + geliştirici hesabı aç → WABA + sistem kullanıcısı + yetki → numarayı WhatsApp'a kaydet | **EVET** (Netgsm sabit hat aboneliği; "Kurumsal aboneler kullanabilir") | Açılan sayfalarda iş ortağı/ISV modeli yok | Kurumsal WhatsApp hattı yılda 249 TL (vergiler dahil; yalnız WA Business uygulaması için numara) | WhatsApp API ürünü yalnız **OTP** paketi (fiyat sayfada yok); Meta ayrıca ücret alır | doğrulanamadı (OTP ürününde PDF yok) | İletim raporu var (panelde) | TL, Türkçe destek | netgsm.com.tr (§6: 30–32) |
| **İleti Merkezi** | — | — | — | — | — | — | — | — | Ana sayfada WhatsApp ürünü YOK ("whatsapp" sözcüğü geçmiyor) (§6: 33) |
| **Connexease (doğrudan)** | Gelen kutusu (inbox) SaaS paketi | doğrulanamadı | Açılan sayfada ISV/API iş ortaklığı yok | Paketler 179 / 279 / 479 / 999 USD ("starter yalnız yıllık"), ek telefon numarası 59 USD/ay, ek kullanıcı 19 USD | "Ekstra ATM" (aylık tekil müşteri) 0,032 USD | doğrulanamadı | doğrulanamadı | Türkçe site; USD fiyat; "Meta Business Partner" | connexease.com (§6: 34–35) |
| **Turkcell / Türk Telekom** | doğrulanamadı (sayfa bütçesi nedeniyle açılmadı) | — | — | — | — | — | — | — | — |
| **Verimor (Connexease altyapısı)**: önceki inceleme, bu oturumda yeniden açılmadı | Verimor'a telekom aboneliği (0850/coğrafi numara, şirket yetkilisi) | **EVET** (imza sirküleri) | API anahtarı alanı + 2 şablon (Verimor açar) | doğrulanamadı | doğrulanamadı | `header_media {link}`; yükleme yok | **YOK** (yoklama) | Türk firması; satış iş ortaklığı sorularına yanıt vermedi | docs.verimor.com.tr (önceki inceleme) |

**Örnek maliyet (ayda 500 ekstre, Türkiye, utility):** Meta doğrudan ≈ 500 × 0,0009 = **0,45 USD**. 360dialog Direct-Paid ≈ 49 EUR + 0,45 USD (+ kartla ödemede %4). Twilio ≈ 500 × (0,005 + 0,0009) = **2,95 USD**. Birim ücretler yukarıdaki kaynaklardan; Meta'nın TR ücreti dolaylı kaynaktan (§4).

## 3. Meta Embedded Signup + Tech Provider: ayrıntı

### 3.1 DestekOfis'in yapacakları (bir kez)
1. **Meta uygulaması ve işletme portföyü.** Uygulama Business türünde olmalı (Embedded Signup yardımcısı yalnız bu türde var) ve WhatsApp kullanım durumu eklenmeli. [1]
2. **İşletme doğrulaması.** Gerekenler: ad, adres, telefon, e-posta, web sitesi, bağlantı teyidi; işletme bulunamazsa belge. App Review'a ancak bundan sonra geçilir. [1]
3. **App Review.**
   - Advanced access istenecek izinler: `whatsapp_business_messaging` ve `whatsapp_business_management`. İkincisi olmadan müşteri hesabına yapılan çağrılar 200 hata kodu döner. [1][11]
   - İki ayrı ekran kaydı gerekir: biri programdan giden ve WhatsApp'ta alınan bir mesajı, öbürü şablon oluşturmayı gösterir. Bunun yerine API Setup cURL betiği ve WhatsApp Manager da kaydedilebilir. Ekran görüntüsü kabul edilmez; her izin için ayrı video ve yazılı açıklama gerekir. [1][11]
   - Uygulamada simge, gizlilik politikası ve kategori dolu olmalı. [1]
   - Süre: "ortalama ~24 saat". [11]
   - Gereksiz izin istemek, reddin yaygın nedeni. [11]
4. **Embedded Signup sayfası.**
   - Facebook JS SDK `FB.login` ile `config_id` (Facebook Login for Business yapılandırması) ve `response_type: 'code'` kullanılır. [3]
   - Kod ancak sayfanın alan adı **Allowed domains** ve **Valid OAuth redirect URIs** listesindeyse döner. Yalnız HTTPS kabul edilir ve sunucunun geçerli SSL sertifikası olmalı. [3]
   - **Sonuç:** Sayfa masaüstü programda (localhost) çalışamaz. DestekOfis'in sabit bir alan adında durmalı, ör. `destekofis.net` altında tek bir sayfa. Program bu sayfayı tarayıcıda açar. Her müşterinin tünel alt adını listeye eklemek ölçeklenmez; joker alan adı desteklenir mi açılan sayfada yazmıyor, doğrulanamadı.
   - **Hosted ES** seçeneği de var. Bu yolda sayfayı Meta barındırır ve DestekOfis yalnız bağlantı verir; ama akış özelleştirilemez. Müşteri kimlikleri `account_update` webhook'u (PARTNER_ADDED) ile gelir. Business token, DestekOfis'in **system token + app secret** (appsecret_proof) bilgisiyle alınır. Bu yolda da merkezi bir sunucu gerekir. [6]
5. **Kod değişimi (sunucu, zorunlu).**
   - Dönen kodun ömrü **30 saniye**. [3]
   - Kod, `GET /oauth/access_token` çağrısıyla `client_id` + `client_secret` (app secret) + `code` verilerek business token'a çevrilir. Belge açıkça "sunucudan sunucuya; istemciden değil" der. [4]
   - App secret programa konamaz. Kapıcıya (Cloudflare Worker) küçük bir uç eklenir: kodu alır, token'a çevirir ve token'ı **yalnız o müşterinin programına iletir, saklamaz**.
   - Business token müşteriye özeldir; Tech Provider yalnız bu token türünü kullanır. Token opak bir dizgedir, uzunluğu değişkendir. [2][9]
   - Belgede süre sonu yazmıyor; ömrü doğrulanamadı.
6. **Bağlantı sonrası API adımları** (sunucudan, müşterinin token'ıyla) [4]:
   - `POST /<WABA_ID>/subscribed_apps` ile webhook aboneliği,
   - `POST /<PHONE_NUMBER_ID>/register` ile numara kaydı (6 haneli PIN). Coexistence'ta bu adım atlanır. [2]
7. **Webhook.**
   - Uygulamanın tek bir callback adresi olur; WABA ya da numara başına başka adres (override) verilebilir. [2][12]
   - `messages` alanı gelen mesajları ve gönderilen mesajların durumunu taşır. [12]
   - 200 dışı yanıtta Meta, sıklığı azaltarak **7 güne kadar** yeniden dener; aynı bildirim birden çok gelebilir. [12]
   - **Sonuç:** Override ile müşterinin tünel adresi verilirse veri DestekOfis'ten geçmez. Program 7 günden uzun kapalı kalırsa durum kaybolur. Bu durumda gönderilen iletiler "sonucu bilinmiyor" sayılmalı; yoklama ucu olup olmadığı açılan sayfalarda doğrulanamadı.
8. **Bağlama sınırı.** Varsayılan olarak 7 günlük kayan pencerede **10 yeni müşteri**. İşletme doğrulaması, App Review ve **Access Verification** tamamlanınca 200'e çıkar; daha fazlası için Meta Business Partner olmak gerekir. [2] Access Verification sayfası açılmadı.
9. **Sürüm uyarısı.** Embedded Signup v2/v3 15.10.2026'da kaldırıldı; v4 kullanılmalı. Hesap modeli de değişiyor: WABA, WhatsApp hesabı (WAAC) ve Messaging account olarak ikiye ayrılıyor; mevcut `waba_id` değerleri çalışmaya devam ediyor. [2]
10. **Deneme.** 30 gün geçerli bir sandbox test hesabı alınabilir; bu hesapla mesaj gönderilemez. [2]

### 3.2 Son müşterinin yapacakları
- **Embedded Signup akışı** [2]:
  - Facebook ya da Meta Business kimliğiyle giriş (**Facebook hesabı gerekli**),
  - koşulları kabul,
  - işletme portföyü seç/oluştur,
  - WhatsApp hesabı seç/oluştur,
  - numara gir ve doğrula,
  - görünen adı yaz.
  - Akış Türkçe dahil 30 dilde ve Facebook dilinden kendiliğinden seçiliyor. [2]
  - Bilinen işletme verisi önceden doldurulursa ekran sayısı azalıyor; bu bilgi açılan sayfadaki bağlantıdan, sayfanın kendisi açılmadı. [2]
- **Numara doğrulaması.** SMS ya da sesli OTP; IVR'lı ya da yalnız giden aramalı hat kod alamaz (Twilio sayfası). [23]
- **Mevcut WhatsApp Business numarası (Coexistence)** [5]:
  - WA Business uygulaması **2.24.17+** olmalı ve uygulamada onay verilmeli.
  - Hız **20 ileti/sn** ile sabit.
  - Toplu yayın listeleri salt okunur olur; kaybolan mesajlar kapanır.
  - Bağlantıdan sonra 24 saat içinde geçmiş eşitlemesi başlatılmazsa yeniden bağlanmak gerekir.
- **Ödeme.** Tech Provider'ın kredi hattı yok. Müşteri, Messaging account'una **kendi kartını eklemeden mesaj gönderemez**; Meta API kullanımını müşteriye kendisi faturalar. [2][7]
  - Kredi hattını müşterilerine yalnız Solution Partner'lar paylaşabilir ve bu "uzun bir süreç". [7]
  - Para birimi hesap açılırken seçiliyor ve sonradan değişmiyor (taşıma API'si var). 16 para birimi var, listede **TRY yok** (USD, EUR, GBP…). [8]
- **Gönderim sınırı** (işletme portföyü başına, 24 saatte farklı alıcı) [10]:
  - Başlangıç **250**.
  - İşletme doğrulaması ya da 30 günde 2.000 kaliteli teslimle **2.000**.
  - Sonra kendiliğinden 10.000 → 100.000 → sınırsız: son 7 günde sınırın yarısı kullanılmış ve kalite iyiyse, 6 saat içinde bir basamak artar.
  - Ekstre gönderen tipik KOBİ için 250 / 2.000 yeterli olabilir; büyük müşteri işletme doğrulaması yapmalı.

### 3.3 Maliyet (Meta)
- Ücret yalnız **teslim edilen** iletiye, ileti başına; kategori ve ülke koduna göre. [8]
  - 01.10.2026'dan beri müşteri hizmetleri penceresi içindeki utility iletileri de yeniden ücretli.
  - Ücretsiz olanlar: reklamdan başlayan ücretsiz giriş penceresi ve numara başına ayda 1.000 hizmet iletisi. [8]
- Fiyat yılda en çok 4 kez (çeyrek başlarında) değişebilir; ücret tablosu değişikliğinin en az 1 ay önce duyurulması gerekiyor. [8]
- Türkiye'nin utility/authentication ücreti 01.04.2026'da **düşürüldü**. [8]
- **TR utility = 0,0009 USD/ileti** (pazarlama 0,0109 USD): Twilio sayfasının veri alanından; Twilio bu ücreti "aynen yansıtıyor", sayfa "Eylül 2026 itibarıyla güncel". [22]
- Meta'nın kendi CSV/PDF ücret tablosu açılamadı (§4).
- Hacim indirimi: utility'de aylık hacim basamakları var, ayrıntısı doğrulanamadı. [8]

### 3.4 PDF (ekstre)
- Belge iletisinde `id` (yüklenmiş medya) ya da `link` kullanılabiliyor; Meta "performans için `id` öneriyoruz" diyor. `filename` alanı var. [13]
- Medya yükleme: `POST /PHONE_NUMBER_ID/media`. Yükleme kimliği **30 gün** geçerli. Belge boyutu sınırı tabloda 100 MB görünüyor (.txt/.xls satırları okundu; PDF satırı açıkça okunmadı). [13][14]
- **Sonuç:** Program PDF'i doğrudan Meta'ya yükleyebilir. Herkese açık bağlantı ve kapıcıda saklama gerekmez; bu, plan §11'deki "kapıcıda 3 gün şifreli PDF" adımını gereksiz kılabilir.
- Açık nokta: *şablon* belge başlığında `id` verilebildiği şablon gönderim sayfasından doğrulanmadı (§4).

### 3.5 KVKK / veri konumu
- Cloud API "yerel saklama" bölgeleri arasında **Türkiye yok**. Avrupa için AB (Almanya, `DE`), İsviçre ve Birleşik Krallık seçilebiliyor. [15][16]
- Meta yurt dışı aktarımdır (md. 9). Bu, Verimor/BSP yolunda da geçerli; aydınlatma metni kararı sürer.

### 3.6 Riskler
1. **Müşteri sürtünmesi.** Facebook hesabı ve kart (USD/EUR) zorunlu; "sıfır sürtünme" tam sağlanmaz, ama telekom aboneliğinden çok daha hafif. Kredi hattı ancak Solution Partner olunarak ya da bir Solution Partner'la Multi-Partner Solution kurularak verilebilir. [7]
2. **Bağlama sınırı.** İlk aşamada 10 müşteri / 7 gün; satış başlamadan önce Access Verification alınmalı.
3. **Hesabın sahibi ve sorumluluk.** Uygulama DestekOfis adına. Bir müşterinin kötüye kullanımı uygulamanın itibarını etkileyebilir; ama yalnız 2 sabit utility şablonu olması riski azaltır. Müşteri WhatsApp Manager'a tam erişir ve bu erişim kısıtlanamaz. [2]
4. **Token güvenliği.** Business token müşterinin programında şifreli saklanırsa DestekOfis veri tutmamış olur. Ama token sızarsa o müşterinin WABA'sı kullanılabilir. Token'ı iptal/yenileme yolu açılan sayfalarda doğrulanamadı.
5. **Meta değişiklik hızı.** Bir yılda ES v4, hesap modeli ve ücret değişiklikleri oldu; bakım yükü süreklidir.

## 4. Açık sorular ve doğrulanamayanlar
- **Meta'nın kendi TR ücreti.** CSV/PDF tablosuna bağlantı .md sürümünde yok, HTML sürümü 400 döndü. `whatsappbusiness.com` vekil sunucuda 403 verdi. 0,0009 USD dolaylı kaynaktan (Twilio).
- **Şablon belge başlığında medya kimliği (`id`).** Şablon gönderim sayfası açılmadı. Yalnız şablon dışı belge iletisinde doğrulandı.
- **Business token ömrü ve iptali.**
- **Mesaj durumu yoklama ucu** (webhook'suz durum sorgusu).
- **Meta'nın Türkiye'ye e-Fatura / TL faturası.** TRY para birimi yok; fatura biçimi doğrulanamadı.
- **Allowed domains'te joker alt alan** (`*.destekofis.net`) kabulü.
- **Access Verification** adımları ve süresi.
- **İşletme doğrulamasının süresi** (DestekOfis için).
- **360dialog yolunda da Meta Tech Provider kaydı gerekir mi?** 360dialog'un kendi barındırdığı ES (Direct Link) için açılan sayfada istenmiyor. Infobip ise "bütün ISV'ler 30.06.2025'e kadar Tech Provider olmalı" diyor.
- **Infobip, Gupshup, Bird, Vonage ücretleri** ve ISV ayrıntıları (yalnız giriş sayfaları açıldı).
- **Turkcell / Türk Telekom WhatsApp ürünleri** açılmadı.
- **Netgsm'in utility/şablon API'si** var mı (açılan sayfalarda yalnız OTP var).
- Görünen ad onayı süresi.

## 5. ENGELLİ ALAN ADLARI
- `whatsappbusiness.com` (`business.whatsapp.com` buraya yönlendiriyor) → vekil sunucu **403**. Meta'nın etkileşimli ücret sayfası.
- `360dialog.com` / `www.360dialog.com` → vekil sunucu **403**. Docs alt alanı açıldı.
- `developers.facebook.com` HTML sürümü 400 döndü (engel değil). `.md` sürümleri 200; rapordaki Meta kaynakları bunlar.
- WebFetch aracı bütün alan adlarında ENOTFOUND verdi; bütün sayfalar curl ile (vekil sunucu, TLS doğrulaması açık) alındı.

## 6. Kaynaklar (açılan sayfalar)
Meta (developers.facebook.com/documentation/business-messaging/whatsapp/…, .md sürümleri; 30.10.2026):
1. …/solution-providers/get-started-for-tech-providers
2. …/embedded-signup/overview
3. …/embedded-signup/implementation
4. …/embedded-signup/onboarding-customers-as-a-tech-provider
5. …/embedded-signup/onboarding-business-app-users (Coexistence)
6. …/embedded-signup/hosted-es
7. …/solution-providers/overview
8. …/pricing ("01.10.2026'dan itibaren geçerli" güncellemesi)
9. …/access-tokens
10. …/messaging-limits (+ …/upcoming-messaging-limits-changes)
11. …/solution-providers/app-review
12. …/webhooks/overview
13. …/messages/document-messages
14. …/business-phone-numbers/media
15. …/local-storage
16. …/business-phone-numbers/registration
(ayrıca dizin: …/llms.txt; okunup kullanılmayan: …/throughput, …/solution-providers/partner-led-business-verification)

360dialog:
17. https://docs.360dialog.com/docs/get-started/pricing.md
18. https://docs.360dialog.com/partner/get-started/pricing.md
19. https://docs.360dialog.com/partner/get-started/billing-models.md
20. https://docs.360dialog.com/partner/onboarding/integrated-onboarding.md ve …/integrated-onboarding/using-direct-link.md (dizinler: /docs/llms.txt, /partner/llms.txt)

Twilio:
21. https://www.twilio.com/docs/whatsapp/isv/tech-provider-program
22. https://www.twilio.com/en-us/whatsapp/pricing ("Pricing current as of September 2026"; TR veri alanı: utility 0.000900, marketing 0.010900, Twilio sabit 0.005)
23. https://www.twilio.com/docs/whatsapp/isv/register-senders

Diğerleri:
24. https://www.infobip.com/docs/whatsapp
25. https://www.infobip.com/docs/whatsapp/tech-provider-program
26. https://docs.gupshup.io/ (+ https://docs.gupshup.io/llms.txt)
27. https://docs.gupshup.io/page/am-i-a-direct-customer-isv-or-tp.md
28. https://developer.vonage.com/en/messages/concepts/whatsapp
29. https://bird.com/docs
30. https://www.netgsm.com.tr/
31. https://www.netgsm.com.tr/sabit-telefon/kurumsal-whatsapp-hatti
32. https://www.netgsm.com.tr/whatsapp/wp-otp
33. https://www.iletimerkezi.com/
34. https://www.connexease.com/tr
35. https://www.connexease.com/tr/fiyatlar (https://www.connexease.com/tr/whatsapp → 404)

Not: Bütçe ~40 sayfaydı; dizin (llms.txt) ve erişim yoklamaları dahil ~45 istek yapıldı. Turkcell / Türk Telekom bu yüzden açılmadı.
