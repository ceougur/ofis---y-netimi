# WhatsApp Otomatik Gönderim (Verimor API) — 2.4.8 Planı

> DURUM: PLAN — kod yok. Kullanıcı 30.10.2026 ~03:40 UTC: "sürekli ertelediğim ama müşterilerin talep ettiği whatsapp toplu gönderim işini planlayalım 2.4.8 için …
> belge ve dökümanlarını incele apilerini vs kontrol et. planlamanı yap, 2.4.7 kontrolleri bitince ben başla dediğimde başlarsın."
> "başla"da madde 0a ile `docs/2.4.8-IS-LISTESI.md` açılır (BELGE_YOLLARI'na eklenir); bu plan oraya bağlanır. Sorular §11'de, yanıtlanınca buraya işlenir.
>
> KAYNAKLAR
> 1. Kullanıcının yüklediği "EDM Modeli WhatsApp Entegrasyon Sunumu" (2 sayfa; müşterinin kendi Verimor hesabı ve API anahtarıyla doğrudan gönderim).
> 2. Verimor resmî belgeleri, docs.verimor.com.tr (30.10.2026 indirildi): WhatsApp API Giriş, Hata Yönetimi ve Yeniden Deneme, Mesaj Durumu Takibi, Fatura ve Ödeme
>    Bildirimi, WhatsApp Business yardım sayfaları (Kurulum, Meta Hesabını Bağlama, Mesaj Şablonları, Yeni Şablon Oluşturma, API Anahtarları, Sorun Çözümleri) ve
>    API referans sayfasına gömülü OpenAPI 3.1 şeması "Verimor WhatsApp API 1.0.0". Belgelerin kopyası depoya KONMAZ (depo herkese açık); tam metin
>    `https://docs.verimor.com.tr/llms-full.txt` (sha256 ba194abf…a1a4, 30.10.2026), şema (çıkarılan YAML sha256 e385af71…c5a4). Kâhin ajanı belgeyi kaynağından okur.
> 3. Meta WhatsApp Business Platform belgeleri (Messaging Limits, Pricing, changelog) ve Türk mevzuatı (aşağıda kaynağıyla).
> 4. Mevcut kod: `server/routes/whatsapp.mjs`, `client/assets/hof-whatsapp.js` (v2.0.13 + 2.0.14 Otomatik Sıra), `server/lib/secret-box.mjs`, `server/lib/net-proxy.mjs`,
>    `server/routes/accounts.mjs` (cari ekstre PDF), `server/routes/overview.mjs` (dönemli ekstre PDF).
> 5. Kullanıcının Verimor satış ekibine 29.10.2026 22:16'da gönderdiği e-posta (test ortamı, belge, şablon yönetimi, webhook, SDK soruları) — yanıt bekleniyor.

## 1. Bugünkü durum ve müşterinin sorunu

- Toplu gönderim wa.me bağlantısıyla: program her kişinin sohbetini hazır açar, WhatsApp'ta **Gönder**'e kullanıcı basar (2.0.14 Otomatik Sıra yalnız sıradaki sohbeti
  açar). 300 cari = 300 kez Gönder.
- Ekstre PDF'i sohbete eklenemez: kişinin adıyla iner, kullanıcı sohbete sürükler (tekli de toplu da iki adım). wa.me yalnız metin taşır.
- Ek kusur (koddan): gönderim penceresindeki dönem (Bu Ay / Geçen Ay / Son 3 Ay / Tüm Hareketler) yalnız METNE uygulanıyor; inen PDF
  (`/api/workspace/accounts/:id/ekstre.pdf`) carinin BÜTÜN hareketlerini basıyor. Dönemli PDF ayrı rotada var (`/api/workspace/overview/ekstre.pdf`, devir satırıyla).
- Kök neden (2.0.14 kararı): kendiliğinden gönderim ve dosya eki ancak resmî WhatsApp Business Platform (API) ile olur; resmî olmayan otomasyon numarayı kapattırır.

## 2. Çözüm özeti — EDM modeli (baş mimar: UYGUN)

- Müşteri kendi Verimor hesabını açar, WhatsApp Business numarasını Verimor panelinde (OİM) Meta'ya bağlar, şablonlarını onaylatır, API anahtarı oluşturup DestekOfis'e
  yapıştırır. Mesaj ücreti müşterinin Verimor kredisinden düşer; DestekOfis yalnız köprüdür (EDM e-Belge modeliyle aynı). Numara kısıtlanırsa yalnız o müşterinin hattı etkilenir.
- **Tek cari:** Cari kartı → WhatsApp → Ekstre Gönder → ön izleme (mesaj + PDF adı) → **Gönder**. WhatsApp penceresi açılmaz; mesaj ve PDF tek seferde gider.
- **Toplu:** Cari Listesi'nden seç (hepsi / süzgeç / N cari) → özet (kişi, geçersiz numara, günlük sınır, tahmini süre) → **Gönderimi Başlat** → arka planda sırayla;
  pencere kapatılabilir; sonuç listesi (Gönderildi / İletildi / Okundu / Başarısız + neden); **Başarısızları Yeniden Dene**.
- PDF seçilen döneme uyar (devir + dönem hareketleri + dönem sonu bakiye; "Tüm Hareketler" = bütün hesap) — metin ile PDF aynı dönem ve aynı bakiye (BAŞ MİMAR KARARI
  adayı, §11 S5).
- API ile gidenler: Ekstre (PDF ekli), Ödeme Hatırlatma, Geciken Ödeme, Ödeme Alındı (bugünkü "Teşekkür"). API ile GİTMEYENLER: serbest metin (Meta 24 saat kuralı) ve
  Kampanya Duyurusu (Verimor müşteri anahtarıyla pazarlama şablonuna 403 verir; ticari ileti İYS onayı ister) → bugünkü "Kendi WhatsApp'ımla" yolu YERİNDE KALIR.
- API ayarı yapılmamış kurulumda her şey bugünkü gibi çalışır.

## 3. Sunum ↔ Verimor resmî belgesi

| Sunumdaki | Resmî belge (30.10.2026) | Sonuç |
|---|---|---|
| `Authorization: Bearer` başlığı | `X-API-Key` başlığı | YANLIŞ — belgeye göre |
| `POST /v1/messages/utility` | Aynı; taban `https://wapi.verimor.com.tr` | DOĞRU |
| `header_media_url` parametresi | `header_media: { link, filename }` | Alan adı farklı |
| Saniyede 10–20 istek | IP başına dakikada 60 istek, durum sorguları DAHİL; aşılınca 429 | YANLIŞ — 250 kişi ≈ 5 dk, 2.000 ≈ 40 dk |
| Redis / RabbitMQ kuyruğu | Verimor'un kendi kuyruğu var (202 = kuyruğa alındı) | Programda SQLite'ta kalıcı iş tablosu (§6.4) |
| S3/Blob geçici PDF bağlantısı | Medya yükleme ucu YOK; herkese açık bağlantı zorunlu, Meta gönderim sırasında indirir | DOĞRU — DestekOfis kapıcısında şifreli geçici bağlantı (§6.3) |
| Kontör biterse API hata döner | Belgede yok | Verimor'a sorulacak (§10) |
| 250 → 2.000 (vergi levhası) → 10.000 → sınırsız | Meta: 250 → 2.000 (işletme doğrulaması) → 10.000 → 100.000 → sınırsız; işletme portföyü düzeyinde, 24 saatte farklı kişi | DOĞRU |
| Şablonu Verimor'dan onaylatma | OİM panelinde oluşturulur, Meta onaylar; API'den şablon yönetimi YOK | DOĞRU (yalnız panel) |
| — | Pazarlama şablonu müşteri anahtarıyla 403 | Kampanya API'de yok |
| — | Coexistence: numara WhatsApp Business uygulamasında da kullanılmaya devam eder | Müşteri mevcut numarasını kullanabilir |
| — | Tekrar anahtarı (idempotency) YOK; "yeniden denemeden önce kendi kaydınıza bakın" | Çift gönderim koruması programda (§6.4) |
| — | WhatsApp API için durum webhook'u belgelenmemiş | Yoklama (§6.5) |

## 4. Verimor WhatsApp API — belge özeti

- Taban `https://wapi.verimor.com.tr`, HTTPS + JSON, kimlik `X-API-Key`. Anahtar OİM → Entegrasyonlar → WhatsApp Business → **API Anahtarları**'nda oluşturulur,
  YALNIZ BİR KEZ gösterilir, **İptal Et** ile kapatılır. Gönderen numarayı anahtar belirler (istekte gönderen alanı yok). Altyapı ortağı Connexease; Meta Cloud API ya da
  Connexease geçidi — "API sözleşmesi her iki modda da aynı".
- **Gönderim** `POST /v1/messages/utility` (Hizmet şablonu) / `POST /v1/messages/otp` (Doğrulama): `to` ("905XXXXXXXXX", ülke kodlu, boşluksuz — bugünkü `waNumber()`
  çıktısıyla aynı biçim), `template_name` (OİM'de Onaylı, birebir), `language` (varsayılan `tr`), `parameters` (gövde `{{1}}…` değerleri, metin, sırayla; değişkensiz
  şablonda gönderilmez), `header_media` (`link` herkese açık HTTP(S) — zorunlu; `filename` — belgede görünen ad; YALNIZ belge/görsel/video başlıklı şablonda, medyasızda
  gönderilmez), `use_tenant_queue` (yüksek hacim için hesaba özel kuyruk, varsayılan false). Başlığında değişkenli metin/konum olan şablon desteklenmez.
- **Yanıt** `202 {id (UUID), status "pending", wa_message_id null, task_id, message}`.
- **Durum** `GET /v1/messages/{id | wa_message_id}`; `GET /v1/messages?to&wa_message_id&status&category&template_name&since&until&limit(≤100)&offset` (yeniden eskiye,
  `total`). Durumlar `pending → sent → delivered → read`, ya da `failed` (`error_message` Türkçe). Okundu bilgisi kapalı alıcıda `delivered`'da kalır. Verimor, tek tek sık
  sorgu yerine `status=failed&since=…` toplu sorgu öneriyor.
- **Hatalar** 401 (anahtar yok / geçersiz / iptal: "Invalid or inactive API key"), 403 (pazarlama şablonu: "Pazarlama şablonları harici API'den gönderilemez."), 404 (mesaj
  yok ya da başka hesabın), 422 (alan eksik; "[132000] Başlık medyası eksik / fazla", "[132000] Şablon parametre sayısı uyuşmuyor", geçersiz `link`), 429 ("Rate limit
  exceeded: 60 per 1 minute"), 5xx / zaman aşımı. Yeniden deneme YALNIZ 429 (60 sn bekle), 5xx ve ağ hatasında; 401/403/422 kalıcı.
- **Şablon** (yalnız OİM paneli): ad küçük harf/rakam/alt çizgi; Başlık ≤ 60, Mesaj İçeriği ≤ 1024, Alt Bilgi ≤ 60; kategori Pazarlama / Hizmet / Doğrulama; durum Onaylı /
  Beklemede / Reddedildi / Durduruldu; **Düzenle** bütün içeriği yeniden onaya gönderir. 24 saat kuralı: kişi son 24 saatte yazmadıysa yalnız onaylı şablon gider.
- **Kurulum**: OİM → Entegrasyonlar → WhatsApp Business → Kur → bağlantı tipi **Cloud API** (yeni / uygulamada kullanılmayan numara) ya da **Coexistence** (numara WhatsApp
  Business uygulamasında kullanılmaya devam eder) → Meta penceresi (30 dk oturum; doğrulama TELEFON ARAMASIYLA, SMS yok; numaranın Türk ya da Verimor numarası olması
  gerekmez; Meta İşletme Yöneticisi yoksa kurulumda açılır).
- `GET /health` kimliksiz sağlık denetimi.
- **Belgede OLMAYAN** (§10'da soru): kredi yetersizliğinin nasıl döndüğü, bakiye sorgusu, test ortamı, WhatsApp durum webhook'u, 60/dk sınırının yükseltilmesi,
  `use_tenant_queue` koşulları, bağlantının açık kalması gereken süre, fiyat, iş ortaklığı.

## 5. Meta kuralları ve mevzuat (planı bağlar)

- İşletmenin başlattığı mesaj yalnız ONAYLI ŞABLONLA; serbest metin ancak kişi son 24 saatte yazdıysa.
- Kategori: Hizmet (utility) = ekstre, ödeme hatırlatma, ödeme alındı. Tanıtım cümlesi eklenirse Meta şablonu Pazarlama'ya alabilir → Verimor 403. Kılavuzda uyarı.
- Şablon değişkeninde satır sonu / sekme / 4'ten çok ardışık boşluk olmaz (onayda ret, gönderimde 132018) → bugünkü çok satırlı ekstre METNİ API'de kullanılmaz;
  hareketler PDF'te, mesaj kısa.
- Gönderim sınırı (Meta "Messaging Limits"; işletme portföyü düzeyinde, kayan 24 saatte FARKLI kişi): doğrulanmamış işletme 250 (kullanıcı 30.10: "meta business üyesi
  olmadan facebookla numara eşleştirince günlük 250" — aynı); işletme doğrulamasıyla (vergi levhası) 2.000; kaliteyle 10.000 → 100.000 → sınırsız. Program kendi sayacıyla
  sınırı aşmaz (Ayarlar'da Günlük Kişi Sınırı, varsayılan 250).
- Ücret: Meta mesaj başına, kategoriye göre (Temmuz 2025'ten); açık müşteri penceresindeki hizmet mesajı ücretsiz. Türkiye hizmet mesajı 2026'da düştü (kaynaklar 0,0009–0,0055 $
  arasında çelişkili — Meta resmî fiyat kartı ve Verimor fiyatıyla teyit). Ücret müşterinin Verimor kredisinden; DestekOfis'e yük yok.
- Rıza: Meta politikası kişiden WhatsApp'tan mesaj alma izni ister; şikâyet/engelleme kaliteyi düşürür → sınır düşer, şablon durdurulur (§11 S4).
- Türk mevzuatı (hukukçu/mali müşavir teyidi önerilir): Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik md. 6 "Onay gerektirmeyen durumlar" — devam eden
  ilişkide tahsilat, borç hatırlatma, bilgi güncelleme bildirimleri, reklam içermedikçe önceden onay gerektirmez → ekstre ve ödeme bildirimleri uygun; kampanya ticari
  iletidir → İYS (API kapsamı dışında).
- KVKK: veri sorumlusu müşteridir; Meta'ya (yurt dışı) aktarım müşterinin Verimor sözleşmesi ve aydınlatma metniyle. DestekOfis PDF'i geçici taşırsa (§6.3) veri işleyen
  olur → KVKK metnine bir cümle (§11 S2).

## 6. Mimari

### 6.1 Sağlayıcı istemcisi (`server/lib/whatsapp/verimor.mjs`)
- Yalnız Verimor (kapsam). İşlevler: gönder (utility), mesaj sorgula, liste sorgula, sağlık. Ağ katmanı EDM ile aynı (`config.fetchImpl` / vekil sunucu ayarı,
  `net-proxy.mjs`); 10 sn zaman aşımı; TLS kapatılmaz.
- Adres yapılandırmadan; testlerde yalnız 127.0.0.1 sahte Verimor. Ders 30 benzeri kaynak tarayan izolasyon testi: hiçbir test/araç gerçek `wapi.verimor.com.tr`'ye gitmez.

### 6.2 Ayarlar (şirket başına — EDM Entegratör Ayarları gibi)
- API anahtarı `secret-box` ile şifreli (v2.0.15 entegratör parolası düzeni; anahtar şirketin veri klasöründe). İstemciye GERİ DÖNMEZ ("Kayıtlı" + son 4 hane); günlüğe,
  denetim kaydına, hata iletisine, PDF'e girmez; yedek başka makineye taşınırsa yeniden girilir. Verisini Sıfırla'da korunur (KEEP_SETTINGS'te `whatsapp` öneki var).
- Şablon adları (varsayılanlar §6.6) + dil; Günlük Kişi Sınırı (250); **Bağlantıyı Sına** (`GET /v1/messages?limit=1` → 200 anahtar geçerli / 401 geçersiz);
  **Kendime Deneme Gönder** (kendi numarasına ekstre → durum izlenir; şablon + parametre + PDF uçtan uca).
- Yetki: ayarlar yalnız yönetici; gönderim YENİ yetki "WhatsApp ile Otomatik Gönder" (varsayılan yalnız yönetici, kişiye verilir — para harcar). wa.me yolu bugünkü gibi
  `accounts.view`.

### 6.3 PDF bağlantısı (Verimor dosya yüklemeyi kabul etmiyor → herkese açık bağlantı)
- ÖNERİ (b): Program PDF'i mevcut üreticiyle (`tablePdf`; dönemli ekstre `overview.mjs` ile aynı içerik) üretir, rastgele anahtarla AES-256-GCM şifreler, 2.4.7 kapıcısına
  (Worker + R2) yükler (ofis kapıcı kaydıyla imzalı; lisans/deneme kuralı mobil ile aynı). Bağlantı `kapi.destekofis.net/b/<rastgele kimlik>/<anahtar>/<dosya adı>.pdf`:
  Worker R2'deki şifreli dosyayı alır, bağlantıdaki anahtarla çözüp `application/pdf` verir. Anahtar DestekOfis'te SAKLANMAZ (yalnız bağlantıda; bağlantı yalnız
  Verimor/Meta'ya gider); bu yolda istek adresi günlüğe yazılmaz; dosya durum kesinleşince program siler, en geç 3 günde R2 yaşam kuralı siler.
- ELENEN (c) ofisin kendi tüneli: program kapanınca bağlantı ölür (Verimor kuyruğu Meta'ya sonra iletebilir); tünel yalnız mobil kurulu ofislerde.
- ELENEN (a) Verimor'a yükleme: uç yok.
- Canlı Cloudflare değişikliği (Worker yolu + R2 yaşam kuralı) yalnız kullanıcı onayıyla (2.4.7 düzeni). Kapıcı değişince kapıcı + mobil testleri yeniden koşulur.

### 6.4 Kalıcı kuyruk ve işçi (sunumdaki Redis/RabbitMQ yerine)
- Program tek süreç + SQLite → yeni tablolar `wa_batches` + `wa_jobs` (göç). `message_sends`'in CHECK kısıtı (`status IN ('sent','skipped')`) yeni durumları almaz → API
  gönderimleri ayrı tabloda, cari kartı geçmişi ikisini birleştirir; eski kayıtlar dokunulmaz.
- İş durumu: Bekliyor → Gönderiliyor → Kabul Edildi (Verimor `id`) → Gönderildi / İletildi / Okundu / Başarısız; ayrıca Sonucu Belirsiz, Duraklatıldı, İptal.
- Hız: bütün şirketler için TEK işçi (sınır IP başına); dakikada en çok ~50 gönderim (kalan pay durum sorgularına); 429'da 60 sn bekleme; 5xx/ağda artan bekleme.
- Her iş ANINDA üretilir: parametreler (ad, bakiye, dönem) ve PDF aynı cari okumasından → mesaj ile PDF tutarlı. İşler arasında olay döngüsüne sıra verilir (2.4.7 M-H2 dersi).
- ÇİFT GÖNDERİM YOK: istekten ÖNCE "Gönderiliyor" yazılır. Yanıt gelmezse (zaman aşımı, ağ, program kapandı) iş **Sonucu Belirsiz** olur ve Verimor'da kaydı aranır:
  `GET /v1/messages?to=…&template_name=…&since=<deneme − 1 dk>` → bulunursa kimliği alınır; 2 dk sonra da yoksa iş yeniden sıraya girer. Körlemesine yeniden gönderim YOK
  (e-Belge "Sonucu Belirsiz" düzeni).
- Yapılandırma hatası (401 / 403 / 422) → toplu iş İLK hatada DURAKLAR (aynı hata hepsinde tekrarlar) ve nedeni söylenir. Durum sorgusunda aynı nedenle art arda 5 başarısız
  (şablon durduruldu, kredi bitti …) → duraklar.
- Günlük sınır: son 24 saatte gönderilen farklı kişi programın kendi kaydından; sınıra gelince kalanlar "Sınır Nedeniyle Bekliyor", pencere açılınca kendiliğinden sürer.
- Program kapanırsa iş kaldığı yerden sürer; 24 saatten eski toplu iş kendiliğinden SÜRMEZ, kullanıcıya sorulur (Devam Et / İptal Et). Yedekten Geri Yükleme, Verisini Sıfırla
  ya da verinin başka makineye taşınmasından sonra bitmemiş işler DURDURULUR (eski gönderimler dirilmez).
- Lisans salt okunura düşerse (bitti / engellendi) gönderim durur.

### 6.5 Durum takibi
- Webhook yok → yoklama: liste sorgusu (`limit=100`, `since` = toplu işin başı) gönderimden 1 dk, 5 dk, 30 dk, 2 sa, 24 sa sonra; `delivered` / `read` / `failed` kesin;
  24 saatte hâlâ `sent` → "İletim Bekliyor" (telefon kapalı). Sorgular dakikalık sınırdan pay alır.

### 6.6 Şablonlar (müşteri OİM'de oluşturur; program metni hazır verir — **Kopyala**)

| Ad (varsayılan) | Başlık | Mesaj İçeriği (öneri; son metin W5'te) | Değişken |
|---|---|---|---|
| `destekofis_ekstre` | Belge (PDF) | Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Güncel bakiye: {{4}}. | 4 |
| `destekofis_odeme_hatirlatma` | — | Sayın {{1}}, {{2}} firmasındaki hesabınızda {{3}} vadeli {{4}} tutarında ödemeniz bulunmaktadır. Güncel bakiye: {{5}}. Ödeme yaptıysanız bu mesajı dikkate almayınız. | 5 |
| `destekofis_geciken_odeme` | — | Sayın {{1}}, {{2}} firmasındaki hesabınızda vadesi geçmiş {{3}} tutarında ödemeniz bulunmaktadır. Güncel bakiye: {{4}}. | 4 |
| `destekofis_odeme_alindi` | — | Sayın {{1}}, {{2}} tarihli {{3}} tutarındaki ödemeniz alınmıştır. Güncel bakiye: {{4}}. Teşekkür ederiz. | 4 |

- Kategori Hizmet, dil Türkçe; Alt Bilgi isteğe bağlı. Müşteri adı değiştirirse programdaki ad alanını günceller; değişken sayısı farklıysa 422 "[132000] Şablon parametre
  sayısı uyuşmuyor" → açık uyarı. Değerler metin olarak biçimlenir (1.250,00 TL, 15.10.2026); satır sonu/sekme temizlenir, uzunluk sınırlanır.

### 6.7 Arayüz
- Mevcut WhatsApp penceresinde gönderim yolu: **Otomatik (WhatsApp Business API)** — API ayarlıysa varsayılan — / **Kendi WhatsApp'ımla (Tek Tek)**.
- Otomatik yolda hazırlık aynı (alıcılar, dönem, şablon, Yalnız Borçlu Carilere Gönder); **Gönderimi Başlat (N Kişi · Yaklaşık X Dk)**; ilerleme sunucudan; pencere kapanınca
  da sürer; **WhatsApp Gönderimleri** listesi (toplu işler, durum sayıları, Duraklat / Devam Et / İptal Et / Başarısızları Yeniden Dene).
- Cari kartı → Son Gönderimler: yol (Otomatik / Elle), durum, neden. Yazım düzeni (her sözcüğün ilk harfi büyük) ve UI kuralları.

### 6.8 Kapsam dışı (2.4.8'de YOK)
- Serbest metin ve kampanya API'den; gelen yanıtları programda görmek; makbuz/fatura PDF'i WhatsApp'la (aynı altyapıyla sonraki sürüm); telefondan (mobil) WhatsApp
  gönderimi; WhatsApp kullanmayan numaraya SMS yedeği (Verimor SMS — sonraki); ikinci sağlayıcı.

## 7. Maddeler (taslak; "başla"da `docs/2.4.8-IS-LISTESI.md`)

| # | Sınıf | İş | Bağımlılık |
|---|---|---|---|
| 0a | [M] | İş listesi dosyası + BELGE_YOLLARI (2.4.7 0a gibi; eski araçta kırmızı) | — |
| 0b | [M] | "Nasıl bozulur?" listesinin son hâli (§8) | — |
| D0 | [XH] | Verimor doğrulaması: §4 özeti koda karşı; Verimor yanıtları (§10); kullanıcının hesabıyla TEK gerçek gönderim kendi numarasına (anahtarı kullanıcı programa girer) | Verimor yanıtı, hesap |
| K0 | [XH] | Kâhin + sahte Verimor: kodu GÖRMEYEN ajan docs.verimor.com.tr'den sahte sunucu (202/401/403/404/422/429/5xx, gecikme, durum ilerleyişi, liste süzgeçleri, Meta'nın bağlantıyı indirmesi) + beklenen sonuç tablosu (kime, hangi PDF, kaç kez) | — |
| W1 | [XH] | İstemci + ayarlar + yetki (§6.1–6.2) | K0 |
| W2 | [XH] | Kuyruk + işçi + göç (§6.4) | W1 |
| W3 | [XH] | PDF geçici bağlantısı (program + kapıcı Worker + R2; canlı kurulum kullanıcı onayıyla) (§6.3) | — |
| W4 | [H] | Arayüz (§6.7) + dönemli PDF (§2) | W2 |
| W5 | [M] | Şablon rehberi (metinler + Kopyala, ad eşleme) + rıza işareti (§11 S4) | — |
| W6 | [H] | Durum yoklaması (§6.5) | W2 |
| W7 | [M] | Kılavuz (Verimor kurulumu, Coexistence, şablonlar, sınırlar) + PDF (ders 42); site metni yayından sonra | W4 |
| MZ | [XH] | (§11 S3) Mutabakat motoru yıl dönümü düzeltmesi — Aralık'tan önce | — |
| T | [XH] | Doğrulama: bağımsız gözden geçirme → tam kapı → CI → windows.yml ×2 + UD paralel → paket → teslim | hepsi |

## 8. Nasıl bozulur? (ilk liste; 0b'de tamamlanır)

- ÇİFT: zaman aşımı sonrası yeniden deneme; yanıt gelmeden program kapanır / elektrik gider; iki kullanıcı aynı cariye aynı anda; aynı toplu iş iki kez başlatılır (çift tık);
  Yeniden Dene kabul edilmiş işte; yedekten geri yüklemeyle eski işler dirilir; aynı veri iki bilgisayarda açılır.
- KAYIP: güncelleme kurulumu / servis yeniden başlaması sırasında; şirket değiştirme; disk dolu; kapıcıya ulaşılamıyor (PDF yüklenemedi).
- YANLIŞ KİŞİ: kuyruktayken carinin telefonu değişti; aynı adlı iki cari; hücrede birden çok numara; sabit hat; yurt dışı numara; cari silindi / pasif.
- YANLIŞ İÇERİK: başka carinin PDF'i; PDF ile mesajdaki bakiye farklı; dönem sınırı (ay sonu, ayın 1'i); Türkçe karakter, emoji, çok uzun ad, adda satır sonu; tutar biçimi;
  alacaklı (eksi) bakiye metni.
- HESAP / META: anahtar yanlış / iptal; şablon yok / adı ya da dili farklı / Beklemede / Reddedildi / Durduruldu / Pazarlama'ya alındı (403); değişken sayısı farklı (422);
  kredi bitti; 24 saatte 250 kişi sınırı; 429; numara WhatsApp kullanmıyor; Meta bağlantıyı indiremedi (süre doldu, kapıcı kapalı).
- GÜVENLİK: anahtar istemciye / günlüğe / denetime / hata iletisine / yedeğe sızar; yetkisiz kullanıcı gönderir; salt okunur lisansta gönderim; PDF bağlantısı tahmin edilir
  ya da süresiz kalır; Worker başka ofisin dosyasını verir; bağlantı anahtarı günlüğe düşer.
- TARİH: gece yarısı (24 saat sayacı), sahte saat (ders 13), uzun koşuda gün değişimi (ders 22).
- ÖLÇEK: 2.000+ carilik toplu gönderimde masaüstü yanıt süresi; bellek; 60/dk sınırında süre.
- ESKİ VERİ: v2.4.7 `message_sends` kayıtları göçte bozulmaz; eski sürümlerden zincirleme göç.
- TEST: testlerden gerçek Verimor'a istek (izolasyon testi).

## 9. Test planı (anayasa + dersler)

- Birim/API: gerçek program, sahte Verimor + yerel kapıcıya karşı (dış istek yok); her hata kodu; kesinti; sahte saat.
- Kırmızı kanıt: yeni testler v2.4.7'nin AYRI kopyasında kırmızı, nedeni okunur (ders 7, 23, 38).
- Arıza: "Gönderiliyor" anında süreç öldürülür / ağ kesilir / disk dolu → yeniden başlat: çift yok, kayıp yok (sayılar sahte Verimor'un kaydından).
- Arayüz e2e: tekli + toplu, insan hızı + klavye (ders 12); 1.000 carilik toplu (senaryo-whatsapp genişler); "Kendi WhatsApp'ımla" yolu bozulmadı (ders 9, 10).
- Kâhin (K0) kodu görmeyen elden; ajanlar arası onay kanıt değil (ders 5, 16).
- Ölçüm: 2.000 carilik toplu gönderim sırasında masaüstü p95 (2.4.7 M-H2 düzeni, `flock` — ders 15).
- Windows: CI 4 platform + windows.yml ×2 (ders 1, 18); dosya adları (ders 33).
- UD son adayda bir kez; kapıcı değişirse kapıcı + mobil testleri; özet üreticisi değişirse mobil özet ölçümü (2.4.7 kuralı).
- Elle kabul (kullanıcı): kendi Verimor hesabıyla kendi telefonuna tekli ekstre + 3 kişilik toplu; PDF açılır, tutarlar ekrandakiyle aynı; başarısız numaranın nedeni görünür.

## 10. Verimor'a ek sorular (29.10 e-postasına ek)

Belgeden YANITLANANLAR: API belgesi ve örnek JSON (docs.verimor.com.tr), şablon yönetimi (yalnız OİM paneli), SDK (resmî yok; belgede Node.js/Python örnekleri),
webhook (WhatsApp API için belgelenmemiş). KALANLAR:
1. Test/sandbox ortamı ya da deneme kredisi var mı?
2. Kredi bitince API ne döner (HTTP kodu mu, `failed` + `error_message` mı; sabit kod/metin)? Bakiye sorgulama ucu var mı?
3. WhatsApp API için durum webhook'u (delivered / read / failed) var mı, planlanıyor mu?
4. 60 istek/dk sınırı hesap bazında yükseltilebilir mi? `use_tenant_queue` kimler için, ücreti var mı, toplu ekstrede önerilir mi?
5. `header_media.link` Verimor kuyruğunda en uzun ne kadar bekleyebilir (bağlantıyı kaç saat açık tutalım)? Belge boyut sınırı? `filename`'de Türkçe karakter sorunu var mı?
6. Türkiye hizmet (utility) mesajı fiyatı (Meta + Verimor), paketler, aylık sabit ücret?
7. İş ortaklığı: DestekOfis üzerinden açılan hesaplar için gelir paylaşımı; isteklerde iş ortağı kimliği (EDM'deki APPLICATION_NAME gibi) gönderilebilir mi?
8. Coexistence'ta API'den giden mesajlar WhatsApp Business uygulamasında görünür mü?
9. (Kullanıcı 30.10.2026 ~04:15 UTC: "şablonları verimor panelinde bir kez oluşturup metaya onaylatmak müşteri için imkansız görev") Şablon oluşturma API'si var mı/planlanıyor mu? Yoksa DestekOfis'ten gelen hesaplarda DestekOfis'in hazır şablonlarını (ekstre + ödeme hatırlatma) Verimor kurulumda KENDİLİĞİNDEN oluşturup onaya gönderebilir mi (iş ortağı şablon kütüphanesi)? Meta'nın hazır Şablon Kütüphanesi (anında onaylı hizmet şablonları) panelde kullanılabiliyor mu?
   YEDEK YOL (Verimor hayır derse): şablon sayısı 4'ten 2'ye (ekstre + ödeme hatırlatma); programda adım adım rehber + her alan için Kopyala + ekran görüntülü kılavuz; isteyen müşteriye DestekOfis uzaktan kurulum desteği (~10 dk).

## 11. Kullanıcı kararları (öneriyle sorulan)

KARAR (kullanıcı, 30.10.2026 ~04:05 UTC: "önerilerin uygun") → S1–S5 ÖNERİLDİĞİ GİBİ: herkese; PDF kapıcıda şifreli en çok 3 gün; mutabakat motoru
yıl düzeltmesi 2.4.8'e (MZ); "WhatsApp Mesajı İstemiyor" işareti + bir kez izin onayı; PDF seçilen döneme uyar. Aynı iletide soru "toplu pdf ve toplu ekstre metnini
gönderebilecek mi?" → yanıt EVET: toplu ve tekli, her kişiye kendi PDF'i + kısa ekstre metni (ad, firma, dönem, güncel bakiye) tek mesajda; hareket listesi
PDF'te (şablon değişkeni çok satır taşıyamaz — bugünkü uzun metin API'de yok).


- S1 Pro'ya özel mi, herkese mi? ÖNERİ herkese (mobil gibi; ücreti müşteri Verimor'a öder; 2.0.14'teki "ayrı Pro özelliği" notunun yerine).
- S2 PDF bağlantısı §6.3 (b): DestekOfis kapıcısında şifreli, en çok 3 gün, sonra silinir? ÖNERİ evet (KVKK metnine bir cümle).
- S3 2.4.8'e mutabakat motoru yıl düzeltmesi de girsin mi (yalnız test altyapısı; Aralık'tan önce zorunlu)? ÖNERİ evet; öbür SONRAKİ SÜRÜM maddeleri (lisans hoşgörüsü,
  Cloudflare limit kartı, içe aktarma istek kimliği, kapıcı temizlik yarışı) ayrı.
- S4 Rıza: ÖNERİ cari kartında "WhatsApp Mesajı İstemiyor" işareti (toplu gönderimden çıkarılır) + Ayarlar'da bir kez "carilerimden izin aldım" onayı; cari başına izin
  ZORUNLU DEĞİL. (Alternatif: yalnız izni işaretli carilere gönderim — müşteriye her cariyi işaretleme yükü.)
- S5 PDF dönemi: ÖNERİ seçilen dönem (devir + dönem hareketleri + dönem sonu bakiye), metinle aynı; "Tüm Hareketler" bütün hesap. (Bugün PDF dönemden bağımsız.)

KARAR (kullanıcı, 30.10.2026 ~04:20 UTC: "müşteri sürtünmesi 0 olmalı. olmazsa biz 1 kez destek olalım. toplu gönderim için seçip gönder dediğinde toplu
gitmeli pdf ya da mesajları"): (1) HEDEF SIFIR SÜRTÜNME — öncelik Verimor'un şablonları kurulumda kendiliğinden açması (soru 9); (2) olmazsa DestekOfis müşteriye
BİR KEZ kurulum desteği verir (Verimor hesabı + numara + şablon + API anahtarı); program rehberi (2 şablon, Kopyala) yine yapılır; (3) kurulumdan sonra müşteri
yalnız SEÇER → GÖNDER: PDF'li ekstreler ya da mesajlar toplu, kendiliğinden gider; tek tek onay/Gönder YOK (yalnız başta bir "N kişiye gönderilsin mi?" onayı).
Kabul ölçütü (elle kabul + e2e): seçim → tek tık → bütün kişiler kuyrukta, kullanıcıdan başka adım istenmez.

KARAR (kullanıcı, 30.10.2026 ~04:30 UTC: "kopyala yapıştır falan olmayacak. şablonları verimora tanıttırırız mail atarak bir şekilde. müşteri toplu seçip
gönder dediğinde gitmeli başka bir şeyle uğraşmadan"): programda şablon rehberi / Kopyala YOK (W5'in rehber kısmı ve §6.2'deki şablon adı alanları KALKAR). Şablonlar
SABİT ADLA (`destekofis_ekstre` belge başlıklı + `destekofis_odeme_hatirlatma`; 2 şablon) DestekOfis'ten Verimor'a e-postayla tanıtılır; Verimor her DestekOfis
müşterisinin hesabında bunları kurulumda açıp onaya gönderir (şablon Meta'da HESAP BAŞINA — bu Verimor'dan istenecek; e-posta metni kullanıcıya hazırlanır).
Müşterinin programdaki tek işi API anahtarını yapıştırmak (+ Bağlantıyı Sına); sonra seç → Gönder. Şablon yoksa/onaysızsa program açık uyarı verir ("Verimor
hesabınızda DestekOfis şablonları henüz hazır değil") ve gönderimi başlatmaz.

## 12. Süre ve sıra

- D0 Verimor yanıtına ve müşteri hesabına bağlı; kod sahte Verimor'la ilerler, "bitti" için gerçek gönderim (elle kabul) gerekir.
- Tahmin ~5–7 iş günü (doğrulama dahil). Devir 2.5.0 en geç 1 Aralık'ta başlamalı (hatırlatıcı 23.11) → 2.4.8 ~20 Kasım'a dek yayında olmalı.
- Ağ: docs.verimor.com.tr ve verimor.com.tr izinli (30.10; www.verimor.com.tr değil — belge için gerekmiyor). Canlı deneme bu ortamdan yapılacaksa `wapi.verimor.com.tr`
  ayrıca izinlenir ve test anahtarını kullanıcı ortam gizlisi olarak kendisi girer (değeri sohbete/dosyaya yazılmaz); gerekmezse elle kabul yeterli.
