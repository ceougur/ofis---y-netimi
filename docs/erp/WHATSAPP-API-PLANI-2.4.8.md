# WhatsApp Otomatik Gönderim (Meta WhatsApp Cloud API) — 2.4.8 Planı

> Tarih: 30.10.2026 (P0 + 0b; Verimor planının yerine Meta'ya göre yeniden yazıldı). DURUM: PLAN — kod yok. İş listesi `docs/2.4.8-IS-LISTESI.md` (W1–W8, D0, K0).
> Ürün kararlarının kaynağı CLAUDE.md "SIKIŞTIRMA ÖNCESİ DURUM 6" + "KARAR → 2.4.8"; kısa tarihçe §12. Kullanıcıya sorular §11.
>
> KAYNAKLAR
> 1. Meta WhatsApp Business Platform belgeleri, `https://developers.facebook.com/documentation/business-messaging/whatsapp/<sayfa>.md` (30.10.2026 okundu): access-tokens,
>    messaging-limits, throughput, pricing (01.10.2026 tarifesi), business-phone-numbers/media, messages/document-messages, messages/send-messages, templates/template-media,
>    templates/components, templates/template-management, templates/template-categorization, templates/template-quality, support/error-codes, webhooks/overview,
>    webhooks/override, webhooks/reference/messages/status, business-phone-numbers/registration, embedded-signup/overview, embedded-signup/implementation,
>    embedded-signup/versions, embedded-signup/onboarding-customers-as-a-tech-provider, embedded-signup/onboarding-business-app-users (birlikte kullanım),
>    solution-providers/app-review, local-storage. Belgelerin kopyası depoya KONMAZ (depo herkese açık); kâhin ajanı (K0) sayfaları kaynağından okur.
> 2. Araştırma ve resmî Türkiye tarifesi: `docs/erp/WHATSAPP-ENTEGRATOR-ARASTIRMA.md` (ekler: tarife, birlikte kullanım şartı).
> 3. Kod (30.10.2026, bu dal): `server/routes/whatsapp.mjs` (targets / log / history, `waNumber`, `statementText`), `client/assets/hof-whatsapp.js` (wa.me Otomatik Sıra,
>    `statementPdf` → `/api/workspace/accounts/:id/ekstre.pdf`), `server/routes/overview.mjs` (`ekstre()` + `/api/workspace/overview/ekstre.pdf`, dönemli, `overview.view`),
>    `server/lib/secret-box.mjs`, `server/lib/net-proxy.mjs` + `config.fetchImpl`, `server/lib/permissions.mjs`, `server/app.mjs` (`KEEP_SETTINGS` "whatsapp" öneki),
>    `server/lib/migrations.mjs` (son sürüm 39; `message_sends`), `server/lib/einvoice/kullanim-defteri.mjs` (şirket dosyası dışı defter düzeni), `bulut/kapi/kapi.mjs` +
>    `bulut/kapi/tunel.mjs` (kapıcı ve tünel), `server/lib/tunnel/manager.mjs` (tünelin açık olma kuralı).
>
> İŞARET: "(D0)" = Meta belgesinde okunmadı ya da belirsiz; D0'da kullanıcının test uygulamasıyla ya da ilgili Meta sayfasıyla doğrulanır, doğrulanmadan kod ona dayanmaz.

## 1. Amaç ve kararlar

- Bugün (koddan): toplu gönderim wa.me ile; her kişide WhatsApp'ta **Gönder**'e kullanıcı basar (2.0.14 Otomatik Sıra yalnız sıradaki sohbeti açar). PDF sohbete
  eklenemez, kişinin adıyla iner. Ek kusur: penceredeki dönem yalnız METNE uygulanır; inen PDF (`/api/workspace/accounts/:id/ekstre.pdf`) bütün hareketleri basar.
- Hedef (kullanıcı kararları, AYNEN): müşteri carileri SEÇER → **Gönder**; her kişiye kendi dönemli ekstre PDF'i + kısa mesaj tek iletide, toplu da tekli de kendiliğinden
  gider (başta tek "N kişiye gönderilsin mi?" onayı). Yalnız 2 sabit BİLGİLENDİRME (utility) şablonu: `destekofis_ekstre` (PDF başlıklı) ve `destekofis_odeme_hatirlatma`.
  Kampanya, serbest metin, şablona ek cümle, pazarlama şablonu YOK. Herkese açık (Pro kilidi yok). API ayarı yapılmamış kurulumda bugünkü wa.me yolu ("Kendi WhatsApp'ımla",
  kampanya şablonu dahil) olduğu gibi kalır.
- Meta Cloud API, ENTEGRATÖRSÜZ; İKİ BAĞLANMA YOLU, ikisi de düz açık (gizli bayrak / kapıcı anahtarı / "yakında" yazısı YOK — kullanıcı kararı); gönderim çekirdeği TEK:
  - **Yol 1 "Elle Bağla"**: müşterinin KENDİ Meta uygulaması (direct developer), kalıcı System User belirteci + Phone Number ID + WABA ID programa girilir. Vergi kaydı /
    Meta onayı gerekmez; şart: numara WhatsApp'ta (uygulamada) KAYITLI OLMAMALI (ör. sabit hat, sesli kod); 24 saatte 250 farklı kişi. Kurulumda DestekOfis bir kez destek verir.
  - **Yol 2 "WhatsApp'ı Bağla"**: Embedded Signup + birlikte kullanım (müşterinin telefondaki WhatsApp Business numarası). Meta yalnız Tech Provider / Solution Partner'a
    açar → DestekOfis Tech Provider olunca (vergi kaydı → işletme doğrulaması → App Review) çalışır; kodu 2.4.8'de yazılır, düğme o güne dek de görünür.
- Ürün kuralları (§11'in eski kararları, geçerli): "Aydınlatma Metni Hazırla"; Ayarlar'daki bir kez onay "Aydınlatma metnimi okudum, carilerime ulaştıracağım" işaretlenmeden
  toplu gönderim BAŞLAMAZ; ekstre şablonunun alt satırı "KVKK aydınlatma metni için firmamıza başvurabilirsiniz." (55 karakter; Meta alt satır sınırı 60); cari kartında
  "WhatsApp Mesajı İstemiyor" (toplu gönderimden çıkar); PDF seçilen döneme uyar (devir + dönem hareketleri + dönem sonu bakiye; "Tüm Hareketler" = bütün hesap), metinle aynı
  dönem ve aynı bakiye; günlük sınırı aşan kişiler ertesi pencereye kuyruklanır.
- GEÇERSİZ (Verimor'a özgü): X-API-Key, `header_media.link`, durum yoklaması, IP başına 60/dk, şablonların Verimor'a e-postayla tanıtılması, kapıcıda 3 gün şifreli PDF
  (PDF artık programdan doğrudan Meta'ya yüklenir — §2.3; DestekOfis PDF saklamaz).

## 2. Meta API özeti (kod buna dayanır)

### 2.1 Taban, kimlik, sürüm
- `https://graph.facebook.com/<sürüm>/…`, HTTPS + JSON, `Authorization: Bearer <belirteç>`. Belgelerdeki güncel sürüm **v26.0**; program sürümü tek sabitte tutar
  (`server/lib/whatsapp/meta-graph.mjs`), adres `config.whatsappGraphUrl`'den (testte 127.0.0.1). Graph sürümlerinin kullanım ömrü ve kaldırılma takvimi (D0).
- Belirteç türleri: direct developer → **System User** belirteci (Business Settings → System Users → Generate token; izinler `business_management`,
  `whatsapp_business_management`, `whatsapp_business_messaging`; "token expiration preference" seçilir — seçenekler ve "süresiz" (D0)). Tech Provider → **Business Integration
  System User** belirteci (Embedded Signup kodunun değişimiyle, müşteriye özel). Belirteç opak dizgedir, uzunluğu değişir — uzunluk sınırı konmaz, ayrıştırılmaz.
- Varlığa erişimi olmayan belirteç `code 200` (HTTP 200 değil) hatası döner; System User'a hem WhatsApp hesabı hem Messaging hesabı için erişim verilmiş olmalı.
- Hesap modeli değişiyor (beta): WABA → WhatsApp hesabı (WAAC) + Messaging hesabı; mevcut `waba_id` değişmez, artık Messaging hesabı kimliğidir. Kod yalnız `waba_id` kullanır.

### 2.2 Şablon iletisi
- `POST /<PHONE_NUMBER_ID>/messages` `{ messaging_product: "whatsapp", recipient_type: "individual", to: "+90…", type: "template", template: { name, language: { code },
  components: [ { type: "header", parameters: [ { type: "document", document: { id: <MEDIA_ID>, filename } } ] }, { type: "body", parameters: [ { type: "text", text } … ] } ] } }`.
  Belge başlığında yüklenmiş medya `id` ile gönderilir (Meta `link` yerine `id` öneriyor). Yanıt: `contacts[].wa_id` + `messages[].id` (`wamid.…`). Kabul ≠ teslim.
- Numara `+` ve ülke koduyla verilir (Meta: `+` yoksa İŞLETME numarasının ülke kodu eklenir → yanlış kişi riski). Bugünkü `waNumber()` çıktısı ("905…") `+` ile gönderilir.
- `language.code` Türkçe için `tr` (D0: supported-languages sayfası). Değişken biçimi konumsal `{{1}}…` (adlı değişken de var; konumsal seçildi). Değişken değerinde satır sonu /
  sekme / çok boşluk yasağı ve uzunluk sınırı (D0) → program değerleri tek satıra indirir, kısaltır.
- Gönderim isteğinde `biz_opaque_callback_data` alanı (durum kancasında geri gelir; iş kimliği taşır) — alan durum kancası başvurusunda var, istek tarafı (D0).
- İleti ömrü (TTL): şablonlarda varsayılan **30 gün** (telefon kapalıysa Meta 30 gün dener); utility şablonda TTL kısaltılabilir — izin verilen aralık (D0; §11 S2).
- Teslim sırası garanti değil (toplu gönderimde önemsiz).

### 2.3 Medya (ekstre PDF'i)
- `POST /<PHONE_NUMBER_ID>/media` (multipart: `file`, `type=application/pdf`, `messaging_product=whatsapp`) → medya `id`. API'nin verdiği medya kimliği **30 gün** geçerli,
  dosya Meta'da şifreli 30 gün durur; `DELETE /<MEDIA_ID>` ile erken silinir. PDF en çok 100 MB. Yanlış MIME türü `131053`.
- Henüz teslim edilmemiş iletinin medyası silinirse ne olur (D0) → silme yalnız kesin durumdan (teslim / başarısız / süresi doldu) sonra (§11 S3).

### 2.4 Şablon oluşturma ve izleme
- `POST /<WABA_ID>/message_templates` `{ name, language, category: "UTILITY", components }`; ad `^[a-z0-9_]+$`; aynı ad + dil ikinci kez `100/2388024`. Gövde ≤ 1024,
  alt satır ≤ 60 karakter. Değişkenli gövde örnek değer (`example`) ister.
- BELGE BAŞLIKLI şablon oluşturulurken örnek dosya **Resumable Upload API** ile yüklenip `example.header_handle` verilir. Resumable Upload uygulama kimliği (App ID) ister →
  Yol 1'de App ID belirteçten okunabiliyor mu (D0); okunamıyorsa "Elle Bağla"ya dördüncü, gizli olmayan alan "Uygulama Kimliği (App ID)" eklenir.
- İzleme: `GET /<WABA_ID>/message_templates?fields=name,language,status,category,quality_score` (durum `APPROVED` / `PENDING` / `REJECTED` / `PAUSED` / `DISABLED`; kalite
  `GREEN` / `YELLOW` / `RED` / `UNKNOWN`). Program bunu her toplu gönderimden önce ve günde bir okur — web kancasından bağımsız tek doğru kaynak (şablon kancaları ayrıca
  yalnız uygulamanın varsayılan adresine gider; §3).
- KATEGORİ RİSKİ: 09.04.2025'ten beri UTILITY diye gönderilen şablonu Meta içeriğe bakıp **MARKETING olarak onaylar**; onaylı utility şablon da sonradan (kötüye kullanımda
  haber vermeden) marketing'e alınabilir; 60 gün içinde yeniden inceleme istenir. KURAL: program yalnız `category = UTILITY` ve `status = APPROVED` şablonla gönderir;
  marketing'e alınmışsa gönderimi başlatmaz ("Meta şablonu Pazarlama'ya aldı; WhatsApp Yöneticisi'nden yeniden inceleme isteyin") — pazarlama ücreti (0,0109 USD, 12 kat) ve
  ürün kararı nedeniyle. Metinde tanıtım/teşekkür dışı cümle yok.
- Düzenleme: onaylı şablon 30 günde 10, 24 saatte 1 kez; kategori düzenlenemez; silinen onaylı şablonun adı 30 gün kullanılamaz → yeni metin gerekirse yeni ad (`…_v2`).
- Duraklatma: düşük kalitede `PAUSED` (`132015`), çok kez duraklatılan `DISABLED` (`132016`, yeni şablon gerekir).

### 2.5 Sınırlar ve hız
- **Gönderim sınırı** (işletme portföyü düzeyinde, kayan 24 saatte, müşteri hizmeti penceresi DIŞINDA teslim edilen FARKLI kişi; portföydeki bütün numaralar ve uygulamalar
  paylaşır): yeni portföy 250 → işletme doğrulaması ya da 30 günde 2.000 kaliteli teslimle 2.000 → son 7 günde sınırın yarısı kullanılıp kalite iyiyse 6 saatte bir basamak:
  10.000 → 100.000 → sınırsız. Güncel sınır `GET /<PHONE_NUMBER_ID>?fields=whatsapp_business_manager_messaging_limit` (`TIER_250` …; eski `messaging_limit_tier` kalktı).
  Sınır aşılınca dönen hata kodu (D0).
- Hız: numara başına 80 ileti/sn (birlikte kullanımda sabit 20); aşımda `130429`. Aynı kişiye kısa sürede çok ileti `131056`. WABA istek sınırı `80007`, uygulama istek sınırı `4`.
  Program bunlara hiç yaklaşmaz (tek işçi, iletiler arası ~1 sn; §6 W2).
- Kayıt (`POST /<PHONE_NUMBER_ID>/register`, 6 haneli iki adımlı doğrulama PIN'i): numara başına 72 saatte 10 deneme (`133016`); birlikte kullanımda kayıt adımı ATLANIR.

### 2.6 Ücret (Meta, 01.10.2026 tarifesi; kaynak araştırma eki)
- Yalnız TESLİM EDİLEN ileti ücretlidir. Türkiye: utility **0,0009 USD**, marketing 0,0109, authentication 0,0009, service 0,0009. Utility hacim kademesi aylık (0–100.000
  liste fiyatı; KOBİ'de hep liste fiyatı).
- DÜZELTME (01.10.2026): müşteri hizmeti penceresi içindeki utility iletisi artık ÜCRETLİ (`pricing.type` `free_customer_service` → `regular`); ücretsiz yalnız "ücretsiz giriş
  penceresi" (tıkla-WhatsApp reklamı) ve numara başına ayda ilk 1.000 service iletisi (bizim şablonlarımızı kapsamaz). Fiyat yılda en çok 4 kez (çeyrek başı), ≥ 1 ay önce duyurulur.
- Ücreti Meta müşterinin kendi kartından çeker (müşterinin Messaging hesabına ödeme yöntemi eklenmeden gönderim olmaz — Tech Provider müşterisi için Meta açıkça yazıyor;
  Yol 1'de ödeme yöntemi yokken davranış (D0); ödeme sorunu `131042`). Para birimi hesap açılışında seçilir, TRY yok. DestekOfis'e ücret yükü yok.
- Durum kancasındaki `pricing.billable` iletinin ücretli olup olmadığını söyler; `pricing_analytics` alanı aylık karşılaştırma için var (D0: alan ve yetki).

### 2.7 Hata kodları (programın davranışı §6 W2'de)
- Belirteç / yetki: `0`, `190` (süresi doldu), `10`, `200–299`, `131005`. Hesap: `368`, `131031` (kısıtlandı/kapatıldı), `131042` (ödeme), `133010` / `131045` (numara kayıtsız),
  `131057` (bakım). Şablon: `132001` (yok / onaysız / dil), `132000` (değişken sayısı), `132012` / `132018` (değişken biçimi), `132007` (ilke), `132015` / `132016` (duraklatıldı /
  kapatıldı). Alıcı: `131026` (WhatsApp kullanmıyor, koşulları kabul etmemiş, eski sürüm), `131049` (ekosistem sağlığı — 24 saat bekle), `131021` (alıcı = gönderen).
  Geçici: `131000`, `131016`, `130429`, `80007`, `4`, `131056`. Parametre: `100`, `131008`, `131009`, `135000`. Medya: `131053`.
- Teslim hataları (`131026` …) kabul edilmiş iletide sonradan DURUM KANCASINDA `failed` + `errors[]` olarak gelir; hangi kodların yanıtta, hangilerinin yalnız kancada
  geldiği (D0) → durum bilgisi olmadan "numara WhatsApp kullanmıyor" görülemeyebilir (§3).

### 2.8 Embedded Signup (yalnız Yol 2)
- Facebook JS SDK `FB.login({ config_id, response_type: "code", override_default_response_type: true, extras })`; sonuçta pencereye `WA_EMBEDDED_SIGNUP` olayıyla `waba_id`,
  `phone_number_id` ve değişim KODU döner (kod ömrü **30 sn**). Kod yalnız **Allowed domains** + **Valid OAuth redirect URIs** listesindeki HTTPS sayfasından döner → sayfa
  programda (localhost) olamaz, DestekOfis'in sabit alanında durur (§11 S4). Joker alt alan kabulü (D0).
- Sürüm: v2/v3 15.10.2026'da kalktı (sürümsüz istek v4 sayılır); **v5** 20.10.2026'da çıktı ve birlikte kullanımı VARSAYILAN açar (`featureType` gerekmez); v4'te
  `featureType: "whatsapp_business_app_onboarding"`. Plan v5 kullanır; Embedded Signup Builder'daki "Check a launch config" ile denetlenir.
- Kod değişimi SUNUCUDAN: `GET /oauth/access_token?client_id&client_secret=<App Secret>&code` → business belirteci. Sonra `POST /<WABA_ID>/subscribed_apps` (kanca aboneliği;
  `override_callback_uri` + `verify_token` ile müşteri başına adres verilebilir), normal akışta `POST /<PHONE_NUMBER_ID>/register` (PIN), müşteri ödeme yöntemi ekler.
- Birlikte kullanım (oturum olayı `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`): kayıt ATLANIR; WA Business ≥ 2.24.17; uygulamanın kanca ucu kancaları "kabul edip işleyebilmeli";
  bağlantıdan sonra **24 saat içinde** kişi + geçmiş eşitlemesi başlatılmazsa müşteri çıkarılır, akış yinelenir (eşitleme bir kez yapılabilir); telefon ~14 gün kullanılmazsa
  bağlantı düşer (`PRIMARY_INACTIVITY`); toplu yayın listeleri salt okunur olur. Meta, uygulamada gönderilen iletilerin (`smb_message_echoes`) programda gösterilmesini istiyor —
  programda sohbet görünümü YOK (kapsam dışı) → App Review'da sorun olup olmadığı (D0, Tech Provider aşaması). BİLİNEN RİSK.
- Bağlama sınırı: 7 günde 10 yeni müşteri; işletme doğrulaması + App Review + Access Verification ile 200. Deneme: 30 günlük sandbox hesabı akışı ve kod değişimini sınar,
  ileti gönderemez.

## 3. Durum bilgisi (teslim / okundu / başarısız)

Gerçekler: Meta'da ileti durumunu SORGULAMA ucu belgelerde bulunmadı (D0) → durum yalnız **web kancasıyla** (`messages` alanı → `statuses[]`: `sent` / `delivered` / `read` /
`failed` + `errors[]` + `pricing`) gelir. Kanca adresi UYGULAMA düzeyinde tektir; `messages` alanı için WABA ya da numara başına başka adres (`override_callback_uri`) verilebilir;
şablon ve hesap kancaları override desteklemez (hep varsayılan adrese). 200 dışı yanıtta Meta **7 güne kadar** azalan sıklıkla yeniden dener, aynı bildirim birden çok gelebilir.
Uygulama Dev modundayken "bazı kancalar gönderilmez" (hangileri D0) — direct developer'ın kendi uygulamasını Live'a alması için gerekenler (D0).

Seçenekler:

| | Nasıl | Artı | Eksi |
|---|---|---|---|
| A. Kancasız | Yalnız gönderim yanıtı: "Meta Kabul Etti" + `wamid` | Kurulum en basit; internete açık uç yok | Teslim/okundu yok; WhatsApp kullanmayan numara (`131026`) GÖRÜLMEZ, başarısız da "gönderildi" görünür; ücretli (teslim) sayı bilinmez |
| B. Kapıcıda saklayan kanca | Meta → `kapi.destekofis.net`; kapıcı olayları saklar, program çeker | Program kapalıyken de birikir | DestekOfis kişisel veri (telefon + durum; birlikte kullanımda sohbet içeriği) SAKLAR; kapıcıda yeni depo/temizlik |
| C. Kapıcıdan GEÇEN kanca (ÖNERİ) | Meta → `https://<ofis>.destekofis.net/wa/kanca/<gizli yol>` → kapıcı yalnız bu yolu cihazsız geçirir → ofisin tüneli → program | DestekOfis SAKLAMAZ (yalnız geçiş); program kapalıysa kapıcı 503 döner, Meta 7 gün yeniden dener (kuyruk Meta'da); iki yol AYNI program ucu | Tünel WhatsApp bağlıyken de açık olmalı (M4 kuralı değişir, §6 W9); 7 günden uzun kapalı program → "Durum Bilinmiyor" |

ÖNERİ C (her iki yol aynı uç):
- Program bağlanınca adresi KENDİSİ kaydeder: `POST /<WABA_ID>/subscribed_apps { override_callback_uri, verify_token }` (Yol 1'de müşterinin belirteciyle — direct developer'da
  uygulamanın önce varsayılan kanca adresi ve `messages` alanı aboneliği gerekip gerekmediği (D0); gerekiyorsa DestekOfis kurulum desteğinde bir kez girilir).
- Doğrulama: Yol 2'de kapıcı imzayı (X-Hub-Signature-256, DestekOfis App Secret; başlık adı ve algoritma D0) denetler, geçersizi düşürür. Yol 1'de imza müşterinin App Secret'ıyla
  atılır — "Elle Bağla" 3 alanı korunsun diye App Secret İSTENMEZ: adres program üretimi 32 baytlık gizli yol taşır + program yalnız kendi kaydındaki `wamid`'lerin durumunu yazar,
  bilinmeyen olay düşer (sahte olay yalnız kendi iletisinin görünen durumunu bozabilir; para/kayıt etkisi yok). Gelen müşteri iletileri, `history`, `smb_*` kancaları 200 ile
  KABUL edilir, içerik SAKLANMAZ (kapsam dışı).
- D0'da kullanıcının Dev moddaki "DestekOfis Mesaj" uygulamasıyla durum kancasının gelip gelmediği denenir; gelmezse ve Live'a almak müşteri için ağırsa Yol 1 A'ya düşer
  (kullanıcıya söylenir; §11 S1).

## 4. Güvenlik

- Belirteç (her iki yol) şirket ayarında `secret-box` ile şifreli (`whatsapp.meta.tokenSealed`; e-Belge entegratör parolası düzeni, `server/routes/invoices.mjs` `secrets()`).
  İstemciye GERİ DÖNMEZ ("Kayıtlı", son 4 karakter); günlüğe, denetim kaydına (`audit`), hata iletisine, PDF'e, mobil özete girmez. Yedek başka makineye taşınırsa anahtar
  (secret.key) gelmez → yeniden bağlanılır. Şirket Verisini Sıfırla'da korunur (`KEEP_SETTINGS` "whatsapp"). Test: kaynak + yanıt + günlük taraması belirteç izi arar.
- Phone Number ID, WABA ID, App ID gizli değildir (ekranda görünür). Kanca gizli yolu ve `verify_token` belirteç gibi saklanır.
- DestekOfis **App Secret**'ı (Yol 2) yalnız kapıcıda (`wrangler secret put`), hiçbir dosyaya, programa, belgeye girmez. Kapıcı business belirtecini SAKLAMAZ: programın oturum
  başlatırken verdiği geçici açık anahtarla şifreleyip en çok 10 dk tutar, program imzalı istekle alır, sonra silinir (§6 W7).
- Yetki: bağlantı ayarları yalnız yönetici (`system.manage`); gönderim YENİ yetki `whatsapp.send` "WhatsApp ile Otomatik Gönder" (varsayılan yalnız yönetici, kişiye
  verilebilir — para harcar). wa.me yolu bugünkü gibi `accounts.view`. Dönemli PDF rota yetkisi (`overview.view`) değil, gönderim yetkisi altında sunucu içinden üretilir.
- Salt okunur lisans (bitti / engellendi; `license.status().writable` false): yeni gönderim başlamaz, işçi durur, bekleyenler "Lisans Nedeniyle Durdu"; kanca kabulü sürer.
- Ağ: dış istekler `config.fetchImpl` (vekil sunucu ayarı, TLS kapatılmaz), 15 sn zaman aşımı. Testler gerçek Meta'ya GİTMEZ: `config.whatsappGraphUrl` testte 127.0.0.1;
  kaynak tarayan izolasyon testi (ders 30 düzeni, `test/lisans-servisi-izolasyonu.test.mjs` gibi): test/ ve tools/ altında `graph.facebook.com` ile gerçek istek yok.

## 5. Veri / KVKK

- Veri sorumlusu müşteridir (kendi carisine kendi WhatsApp hesabından gönderir). Meta'ya (yurt dışı) aktarım: telefon, ad, bakiye, dönem, PDF içeriği → KVKK md. 9; Cloud API
  yerel saklama bölgelerinde Türkiye YOK (AB/Almanya, İsviçre, Birleşik Krallık seçilebilir; kayıtta `data_localization_region` — 2.4.8'de kullanılmaz, istek gelirse).
  "Aydınlatma Metni Hazırla" bu aktarımı (Meta + WhatsApp altyapısı, yurt dışı) yazar; taslak baş mimar, son hâli kullanıcı.
- DestekOfis VERİ İŞLEYEN olduğu yerler: (1) öneri C'de durum kancaları (alıcı telefonu, durum, hata; birlikte kullanımda gelen ileti/geçmiş içeriği) kapıcıdan GEÇER,
  saklanmaz — iki yolda da; (2) Yol 2'de belirteç değişimi kapıcıdan geçer. PDF DestekOfis'ten GEÇMEZ (program → Meta). Eski "kapıcıda 3 gün PDF" kalktı. Lisans sözleşmesine
  veri işleme maddesi (kullanıcının işi) bu iki geçişi yazar; Cloudflare alt işleyen.
- Meta ilkesi "yalnız izin vermiş (opt-in) kişilere gönder" der; ürün kararı (bir kez onay + "WhatsApp Mesajı İstemiyor") korunur. BİLİNEN RİSK: şikâyet/engelleme kaliteyi,
  kalite sınırı ve şablonu düşürür → program kaliteyi izler (§6 W5) ve kılavuz "yalnız iş ilişkisi olan cariye" der.
- Gönderilen PDF Meta'da en çok 30 gün durur; kesin durumdan sonra silinmesi önerilir (§11 S3). Programda iş kaydı mesaj METNİ değil değişken değerleri + PDF adı tutar.

## 6. Uygulama adımları (iş listesi maddeleriyle)

Yeni modül klasörü `server/lib/whatsapp/`; rota `server/routes/whatsapp.mjs` (genişler; wa.me uçları aynen kalır); istemci `client/assets/hof-whatsapp.js` (+ ayar paneli
`client/assets/hof-whatsapp-ayar.js`, Yönetim altında, `hof-mobile-devices.js` düzeni).

**W1 [XH] Ayarlar + yetki + "Elle Bağla" + Meta istemcisi**
- `server/lib/whatsapp/meta-graph.mjs`: sürüm sabiti, `send`, `uploadMedia`, `deleteMedia`, `phoneInfo` (`whatsapp_business_manager_messaging_limit`, `throughput`, kalite ve
  görünen ad alanları D0), `templates`, `createTemplate`, `resumableUpload`, `subscribeApp`; hatayı `{ code, subcode, httpStatus, title, retry: "never|later|unknown" }` sınıfına
  çevirir (§2.7). Belirteç yalnız bu modülün çağrısında açılır.
- Ayarlar (şirket başına; `settings` "whatsapp." öneki): `whatsapp.meta.mode` (`manual` / `embedded`), `phoneNumberId`, `wabaId`, `appId` (D0), `tokenSealed`, `hookPathSealed`,
  `verifyTokenSealed`, `dailyCap` (elle alt sınır), `ttlHours` (§11 S2), `ack` (bir kez onay: kim, ne zaman, metin sürümü).
- "Elle Bağla" penceresi: 3 alan (+ D0'a göre App ID) → **Bağlantıyı Sına** (`phoneInfo` + `templates` okunur: numara, görünen ad, sınır basamağı, şablon durumu) → kaydet →
  şablonlar (W5) + kanca kaydı (W9). **Kendime Deneme Gönder**: yöneticinin kendi numarasına ekstre (şablon + PDF + durum uçtan uca).
- Yetki: `whatsapp.send` → `server/lib/permissions.mjs` PERMISSIONS + yetki havuzu etiketleri; göçle mevcut rollere VERİLMEZ (yalnız yönetici).

**W2 [XH] Gönderim çekirdeği: kuyruk + işçi + göç + sınır**
- Göç v40 (`server/lib/migrations.mjs`): `wa_batches` (id, kind `statement|reminder`, period, created_by/at, state, pause_reason, sayılar) + `wa_jobs` (id, batch_id, account_id,
  phone_e164, template, lang, params_json, pdf_name, period_from/to, state, media_id, wamid, attempt, error_code/text, next_at, sending_at, accepted/sent/delivered/read/failed_at,
  billable, `UNIQUE(batch_id, account_id)`) + `accounts.wa_opt_out` (W6). `message_sends` DOKUNULMAZ (CHECK kısıtı yeni durumları almaz); cari kartı geçmişi ikisini birleştirir.
- İş durumları (ekranda): Bekliyor → Hazırlanıyor (PDF + medya yükleme) → **Gönderiliyor** (istekten ÖNCE yazılır) → Meta Kabul Etti (`wamid`) → Gönderildi → Teslim Edildi →
  Okundu; ya da Başarısız (kod + Türkçe neden), Sonucu Belirsiz, Sınır Nedeniyle Bekliyor, Duraklatıldı, İptal, Süresi Doldu (TTL + 1 saat geçti, teslim yok), Durum Bilinmiyor
  (kanca 7 günde gelmedi). Durum yalnız İLERİ gider (`read` geldikten sonra gelen `delivered` yok sayılır; Meta "read yalnız delivered'dan sonra" der).
- Her iş ANINDA üretilir: değişkenler (ad, firma, dönem, bakiye) ve PDF AYNI cari okumasından (metin = PDF). Tek işçi, bütün şirketler; iletiler arası ~1 sn; işler arası olay
  döngüsüne sıra verilir (2.4.7 M-H2 dersi).
- ÇİFT GÖNDERİM YOK: Cloud API'de tekrar anahtarı belgelenmemiş (D0) ve ileti sorgulanamaz → yanıtsız istek (zaman aşımı, ağ, gövdesiz 5xx, program kapandı) **Sonucu
  Belirsiz** olur ve KENDİLİĞİNDEN yeniden gönderilmez; kanca `biz_opaque_callback_data` = iş kimliği ile gelirse çözülür; kullanıcı "Yine de Gönder" derse "çift gidebilir"
  uyarısıyla (e-Belge Sonucu Belirsiz düzeni). Medya yükleme yanıtsızsa yeniden yüklenir (öksüz medya 30 günde düşer).
- Hata sınıfı → davranış: belirteç/yetki/hesap/ödeme/numara (`0`, `190`, `10`, `200–299`, `131005`, `368`, `131031`, `131042`, `133010`, `131045`) ve şablon (`132001`,
  `132000`, `132012`, `132018`, `132007`, `132015`, `132016`) → toplu iş İLK hatada DURAKLAR, nedeni söylenir; alıcı (`131026`, `131021`, `131009` numara) → o iş Başarısız,
  sürer; `131049` → o kişi 24 saat sonra en çok bir kez; geçici (`131000`, `131016`, `130429`, `80007`, `4`, `131057`) → artan bekleme (30 sn → 15 dk), 5 kez art arda → duraklar;
  `131056` → o kişi 1 dk sonra.
- GÜNLÜK SINIR: sınır = min(Meta basamağı (`phoneInfo`, gönderimden önce ve 6 saatte bir), `dailyCap`). Sayaç makine düzeyinde, şirket dosyası DIŞINDA, WABA kimliğine göre
  (`server/lib/einvoice/kullanim-defteri.mjs` düzeni: ayrı SQLite, yalnız ekleme) — iki şirket aynı portföyü kullanırsa ve yedekten geri yükleme sayacı sıfırlamasın diye.
  Kayan 24 saatte "Meta Kabul Etti" olmuş FARKLI alıcı sayılır; sınıra gelince kalanlar "Sınır Nedeniyle Bekliyor", pencere açılınca (en eski kabul + 24 sa) kendiliğinden sürer.
  Meta'nın portföy sayacı programın dışındaki gönderimleri de sayar → sınır hatası (kodu D0) gelirse kalanlar 24 saat bekler.
- Program kapanırsa iş kaldığı yerden sürer; 24 saatten eski toplu iş kendiliğinden SÜRMEZ (Devam Et / İptal Et sorulur). Yedekten Geri Yükle, Şirket Verisini Sıfırla, verinin
  başka makineye taşınması sonrası bitmemiş işler DURUR (kurulum kimliği + şirket kimliği iş kaydında; eşleşmezse "Taşınan Veri — Durduruldu"), eski işler dirilmez.

**W3 [XH] PDF: dönemli ekstre + medya yükleme**
- `server/routes/overview.mjs` `ekstre()` + `ekstreRows` + `tablePdf` çağrısı ortak bir üreticiye taşınır (`server/lib/statement-pdf.mjs`; Cari Ekstre PDF'i ile aynı içerik,
  aynı sayı — ekran/PDF/Excel kuralı); rota davranışı değişmez (fark testi). wa.me yolundaki `statementPdf` de seçilen dönemi geçirir (S5 kararı: bugünkü kusur kapanır).
- Dosya adı kişinin adıyla (`Ekstre <Ad> <dönem>.pdf`, Türkçe karakter korunur; dosya adı kuralı D0 değil — Meta `filename` uzantıyı ister). Yükleme `uploadMedia`; kesin durumdan
  sonra `deleteMedia` (§11 S3); PDF diske yazılmaz (bellekte).

**W4 [H] Arayüz**
- WhatsApp penceresinde yol seçimi: **Otomatik (WhatsApp Business API)** (bağlıysa varsayılan) / **Kendi WhatsApp'ımla (Tek Tek)** (bugünkü). Otomatik yolda şablon yalnız
  Ekstre ya da Ödeme Hatırlatma (kampanya/serbest metin görünmez). Özet: kişi, geçersiz numara, "WhatsApp Mesajı İstemiyor", bugünkü sınırdan kalan, sınır nedeniyle yarına
  kalacak, tahmini süre → **Gönderimi Başlat (N Kişi)** → tek onay. Bir kez onay işaretli değilse düğme pasif + nedeni görünür yazı.
- **WhatsApp Gönderimleri** listesi (toplu işler, durum sayıları, Duraklat / Devam Et / İptal Et / Başarısızları Yeniden Dene — yalnız kesin Başarısız; Sonucu Belirsiz ayrı
  "Yine de Gönder"). İlerleme sunucudan; pencere kapanınca da sürer. Cari kartı → Son Gönderimler: yol (Otomatik / Elle), durum, neden.
- **Bu Ay Gönderilen İleti Sayısı** (Yönetim → WhatsApp): "Meta Kabul Etti" ve "Teslim Edilen (Ücretli)" ayrı; yaklaşık ücret = teslim × 0,0009 USD ("Meta faturası esastır;
  ay sınırı Meta hesabının saat dilimine göredir"). Kaynak programın kaydı; `pricing_analytics` karşılaştırması (D0) sonra.
- Yazım düzeni (her sözcüğün ilk harfi büyük; cümleler cümle düzeninde) ve UI kuralları; ders 12 (insan hızı, Tab).

**W5 [H] Şablonlar**
- Bağlanınca program 2 şablonu kendisi açar (yoksa): `destekofis_ekstre` (BELGE başlığı, örnek PDF Resumable Upload ile; gövde "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın
  {{3}} dönemine ait ekstresi ektedir. Güncel bakiye: {{4}}."; alt satır "KVKK aydınlatma metni için firmamıza başvurabilirsiniz.") ve `destekofis_odeme_hatirlatma` (gövde
  "Sayın {{1}}, {{2}} firmasındaki hesabınızda {{3}} vadeli {{4}} tutarında ödemeniz bulunmaktadır. Güncel bakiye: {{5}}. Ödeme yaptıysanız bu mesajı dikkate almayınız.").
  Dil `tr`, kategori `UTILITY`. Son metin W5'te; değişirse yeni ad (§2.4).
- İzleme (§2.4): durum + kategori + kalite ekranda ("Şablonlar Onay Bekliyor" / "Onaylandı" / "Reddedildi: neden" / "Pazarlama'ya Alındı" / "Duraklatıldı"); `APPROVED` +
  `UTILITY` değilse gönderim başlamaz. Kalite `RED` → uyarı; telefon numarası sınır basamağı düşerse uyarı.
- Programda Kopyala / şablon rehberi YOK (karar); müşteri şablonla uğraşmaz.

**W6 [H] "Aydınlatma Metni Hazırla" + "WhatsApp Mesajı İstemiyor"**
- Firma unvanı / adresi / e-postası ile hazır metin (WhatsApp + Meta altyapısı, yurt dışı aktarım md. 9, amaç: cari hesap bildirimi), PDF ve düz metin. Taslak baş mimar,
  son onay kullanıcı (hukukçu gözüyle). Cari kartı işareti `accounts.wa_opt_out` (Excel yüklemede kolon eşlemesi sonraya).

**W7 [XH] "WhatsApp'ı Bağla" (Embedded Signup v5, birlikte kullanım)**
- Akış: program `POST` kapıcı `/v1/ofis/<ofis>/wa/oturum` (ofis imzalı, M3 düzeni; geçici açık anahtar) → tarayıcıda Embedded Signup sayfası (§11 S4; FB SDK, `config_id`) →
  sayfa kodu + `waba_id` + `phone_number_id` + olay türünü kapıcıya verir → kapıcı 30 sn içinde kodu değiştirir (App Secret yalnız kapıcıda) → belirteci oturum anahtarıyla
  şifreleyip en çok 10 dk tutar → program imzalı istekle alır (kapıcıdan silinir) → program: `subscribed_apps` + override (W9), birlikte kullanım DEĞİLSE `register` (PIN programca
  üretilir, şifreli saklanır), birlikte kullanımda 24 saat içinde kişi + geçmiş eşitlemesini başlatır (içerik saklanmaz) → şablonlar (W5) → "Meta'da Ödeme Yöntemi Ekleyin" adımı.
- Uygulamanın varsayılan kanca adresi `https://kapi.destekofis.net/wa/meta` (şablon/hesap kancaları buraya; imza denetlenir, 200, saklanmaz). Kapıcı değişikliği canlıya yalnız
  kullanıcı onayıyla (2.4.7 düzeni); kapıcı + mobil testleri yeniden koşulur.
- Tech Provider olana dek gerçek bağlama çalışmaz; sınama sandbox hesabıyla (kod değişimi + varlık okuma) ve sahte Meta ile. Düğme düz açık (karar).

**W8 [M] Kılavuz** — "Elle Bağla" adımları (Meta uygulaması, System User, belirteç, numara şartı), "WhatsApp'ı Bağla", sınırlar, ücret, aydınlatma; Chrome çevirisini kapatın
(Meta paneli bozuluyor), uygulama adında "WhatsApp" geçemez ("<Firma> Mesaj"). PDF yeniden üretimi (ders 42). Claude Docs "Meta WhatsApp Kurulum Rehberi" + "Kullanıcı
Bilgilendirmesi" ile uyumlu (Verimor ifadeleri çıkar).

**W9 [XH] Durum web kancası (ÖNERİ — iş listesinde yok; §11 S1'e bağlı)**
- Kapıcı (`bulut/kapi/kapi.mjs`): canlı kapıda yalnız `GET|POST /wa/kanca/<gizli yol>` cihaz denetimi OLMADAN geçer (gövde ≤ 3 MB, çerez yok, `x-do-kapi` işareti), Yol 2 imzası
  burada denetlenir; tünel yoksa 503 (Meta 7 gün dener). `/wa/meta` varsayılan uç.
- Program: GET doğrulama (`hub.verify_token` → `hub.challenge`), POST `statuses[]` → `wamid` ile işi bul, durumu ileri yaz, `pricing.billable` kaydet; yinelenen olay etkisiz.
- Tünel kuralı (`server/lib/tunnel/manager.mjs` "Ne zaman açık"): lisans yazılabilir VE (eşli cihaz / bekleyen karekod VAR ya da **WhatsApp bağlı**). Bu M4 BAŞ MİMAR KARARI'nın
  genişlemesidir → kullanıcı onayı (S1) ve mobil testleri.

**D0 [XH]** (W1–W3 sonrası): §2–§3'teki "(D0)" maddeleri belgeye/denemeye karşı; kullanıcının "DestekOfis Mesaj" uygulaması + test numarasıyla programdan TEK gerçek gönderim
(belirteci kullanıcı programa kendisi girer; sohbete/dosyaya/günlüğe yazılmaz): şablon açma (Resumable Upload + App ID), onay, PDF'li ekstre kendi telefonuna, Dev modda durum
kancası gelir mi, `messaging_limit` okunur mu, test numarasıyla gönderilebilecek alıcı sınırı.

**K0 [XH]** (P0 sonrası): kodu GÖRMEYEN ajan Meta belgelerinden sahte Graph sunucusu (`test/sahte-meta/`; ileti, medya yükleme/silme, şablon açma/listeleme/kategori değişimi,
Resumable Upload, `phoneInfo`, hata kodları §2.7, 429/throughput, gecikme, yanıt kaybı, durum kancasının gecikmeli/yinelenen/sırasız gönderimi, 7 gün yeniden deneme) +
beklenen sonuç tablosu (kime, hangi PDF, hangi değişkenler, kaç kez, hangi durum).

## 7. Sıra ve süre

P0 → K0 ∥ W1 → W2 → W3 ∥ W5 ∥ W6 → W9 (S1 yanıtına göre) → W4 → D0 → W7 → W8 → T. MZ bağımsız ve İLK (Aralık'tan önce). Tahmin ~6–8 iş günü (doğrulama dahil); devir 2.5.0
en geç 1 Aralık'ta başlamalı → 2.4.8 ~20 Kasım'a dek yayında. "Bitti" için D0 gerçek gönderimi + elle kabul gerekir; Yol 2'nin gerçek bağlaması Tech Provider'a kalır (BİLİNEN SINIR).

## 8. Nasıl bozulur? (0b — son hâli; testler buradan çıkar)

- ÇİFT: zaman aşımından sonra yeniden deneme; yanıt gelmeden program kapanır / elektrik gider ("Gönderiliyor" anında süreç öldürülür); iki kullanıcı aynı cariye aynı anda;
  aynı toplu iş iki kez başlatılır (çift tık, iki sekme); "Başarısızları Yeniden Dene" kabul edilmiş işte; yedekten geri yüklemeyle eski işler dirilir; aynı veri iki bilgisayarda
  açılır; aynı kanca olayı iki kez gelir (Meta yeniden deneme); medya yüklendi, ileti yanıtsız → yeniden yükleme + çift ileti.
- KAYIP: güncelleme kurulumu / servis yeniden başlaması sırasında; şirket değiştirme; disk dolu; Meta'ya ulaşılamıyor; kanca 7 günden uzun ulaşamadı (program kapalı, tünel
  kapalı); tünel kuralı WhatsApp'ı saymadı; kapıcı 200 döndü ama programa iletmedi.
- YANLIŞ KİŞİ: kuyruktayken carinin telefonu değişti (iş üretilirken okunan numara kullanılır — ve bu kayda geçer); aynı adlı iki cari; hücrede birden çok numara (`waNumber`
  ilkini alır); sabit hat / yurt dışı numara; `+` olmadan gönderim (işletme ülke kodu eklenir); cari silindi / pasif / "WhatsApp Mesajı İstemiyor" sonradan işaretlendi.
- YANLIŞ İÇERİK: başka carinin PDF'i (medya kimliği karışması); PDF ile mesajdaki bakiye farklı; dönem sınırı (ay sonu, ayın 1'i, yıl dönümü); Türkçe karakter, emoji, çok
  uzun ad, adda satır sonu (değişken temizliği); tutar biçimi (1.250,00 TL); alacaklı (eksi) bakiye metni; TTL içinde gecikmeli teslimde bayat bakiye.
- HESAP / META: belirteç yanlış / süresi doldu (`190`) / iptal edildi / izin eksik (`10`, `200`); System User'a varlık erişimi verilmemiş; App ID gerekli ama yok; numara kayıtlı
  değil (`133010`) / WhatsApp uygulamasında kayıtlı (Yol 1 şartı) / kayıt denemesi sınırı (`133016`); ödeme yöntemi yok ya da reddedildi (`131042`); hesap kısıtlandı (`368`,
  `131031`); şablon yok / dili farklı / Beklemede / Reddedildi / **Pazarlama'ya alındı** / Duraklatıldı (`132015`) / Kapatıldı (`132016`) / müşteri WhatsApp Yöneticisi'nde
  sildi ya da değiştirdi; değişken sayısı (`132000`) / biçimi (`132012`, `132018`); medya süresi doldu (30 gün) ya da teslimden önce silindi; yanlış MIME (`131053`); 24 saatte
  250 kişi sınırı (portföyün başka gönderimleri de sayar); kalite düştü → sınır basamağı düştü; `131049`; throughput (`130429`); bakım (`131057`); numara WhatsApp kullanmıyor
  (`131026`, kancada gelir); Meta sürüm kaldırması (Graph v26.0, Embedded Signup v4/v5); birlikte kullanımda 24 saatte eşitleme yapılmadı → bağlantı düştü; telefon 14 gün
  kullanılmadı (`PRIMARY_INACTIVITY`); Dev moddaki uygulamada kanca gelmiyor.
- GÜVENLİK: belirteç istemciye / günlüğe / denetime / hata iletisine / yedeğe / mobil özete sızar; yetkisiz kullanıcı gönderir; salt okunur lisansta gönderim; kanca gizli yolu
  tahmin edilir / sahte durum olayı; kapıcı başka ofisin olayını iletir (WABA → ofis karışması); kapıcı belirteci saklar ya da 10 dk'dan uzun tutar; App Secret programa düşer;
  Embedded Signup kodu iki kez kullanılır ya da başka ofisin oturumuna bağlanır.
- TARİH: gece yarısı ve kayan 24 saat sayacı; ay başı ("Bu Ay" sayacı; Meta saat dilimi farkı); sahte saat (ders 13); uzun koşuda gün değişimi (ders 22); TTL sonu.
- ÖLÇEK: 2.000+ carilik toplu gönderimde masaüstü yanıt süresi ve bellek (PDF üretimi iş başına, birikmez); 250 sınırında birkaç güne yayılan iş; kanca yağmuru (3× giden).
- ESKİ VERİ: v2.4.7 `message_sends` kayıtları göçte bozulmaz; eski sürümlerden zincirleme göç (v39 → v40); eski yedek geri yüklenince sayaç defteri azalmaz.
- TEST: testten gerçek Meta'ya istek (izolasyon testi); sahte Meta'nın programla aynı elden çıkması (K0 bağımsız).

## 9. Test planı

- Birim/API: gerçek program, sahte Meta (K0) ve yerel kapıcıya karşı; §2.7'deki her kod; kesinti (yanıt kaybı, gövdesiz 5xx); sahte saat; durum kancası yinelenen/sırasız/gecikmeli.
- Kırmızı kanıt: yeni testler v2.4.7'nin AYRI kopyasında (`git worktree`, benzersiz klasör — ders 23, 25) kırmızı, nedeni okunur (ders 7, 38); dönemli PDF kusuru eski kodda kırmızı.
- Arıza: "Gönderiliyor" anında süreç öldürülür / ağ kesilir / disk dolu → yeniden başlat: çift yok, kayıp yok (sayılar sahte Meta'nın kaydından); yedek tatbikatı (gönderim →
  yedek → geri yükle → işler dirilmez, sayaç azalmaz).
- Arayüz e2e: tekli + toplu, insan hızı + klavye (ders 12); 1.000 carilik toplu (`test/e2e/senaryo-whatsapp.mjs` genişler); "Kendi WhatsApp'ımla" yolu bozulmadı (ders 9, 10);
  her seçenek (ekstre/hatırlatma × dönem × yalnız borçlu; ders 11); yetkisiz kullanıcı; salt okunur lisans.
- Kâhin (K0) kodu görmeyen elden; ajanlar arası onay kanıt değil (ders 5, 16, 40).
- Ölçüm: 2.000 carilik toplu gönderim sırasında masaüstü p95 (`flock`, ders 15). Kapıcı değişirse kapıcı + mobil testleri; tünel kuralı değişirse mobil özet ölçümü (2.4.7 kuralı).
- Windows: CI 4 platform + windows.yml ×2 (ders 1, 18); dosya adları (ders 33); kaynak tarayan testler CRLF (ders 27).
- D0 (gerçek Meta, bir kez): kullanıcının test numarasıyla programdan tek gönderim; belirteç sohbete/dosyaya/günlüğe YAZILMAZ, kullanıcı programa kendisi girer.
- Elle kabul (kullanıcı): kendi Meta uygulamasıyla kendi telefonuna tekli ekstre + 3 kişilik toplu; PDF açılır, tutarlar ekrandakiyle aynı; başarısız numaranın nedeni görünür.

## 10. Kapsam dışı (2.4.8'de YOK)

Serbest metin ve kampanya API'den; gelen yanıtları / sohbetleri programda görmek; makbuz/fatura PDF'i WhatsApp'la (aynı altyapıyla sonraki sürüm); telefondan (mobil)
WhatsApp gönderimi; SMS yedeği; yerel saklama bölgesi seçimi; `pricing_analytics` karşılaştırması (D0'dan sonra); ikinci sağlayıcı.

## 11. Kullanıcıya sorular (öneriyle)

- **S1 Durum bilgisi (teslim / okundu / başarısız).** A) Kapıcıdan GEÇEN web kancası (§3 C): program adresi Meta'ya kendisi kaydeder; durumlar DestekOfis'te saklanmadan
  kapıcıdan geçer; tünel WhatsApp bağlıyken de açık kalır (mobil kuralı genişler). B) Kancasız: yalnız "Meta Kabul Etti"; WhatsApp kullanmayan numara ve teslim edilmeyen ileti
  görünmez. ÖNERİ A (D0'da Dev moddaki uygulamada durum kancası gelmezse Yol 1 B'ye düşer ve size söylenir).
- **S2 Teslim süresi (TTL).** Telefonu kapalı kişiye Meta varsayılan 30 gün dener; geç teslimde bakiye bayat olur. A) Utility şablonda süre kısaltılır (öneri 3 gün;
  Meta'nın izin verdiği aralık D0'da okunur); teslim edilmezse "Süresi Doldu". B) Meta varsayılanı 30 gün. ÖNERİ A.
- **S3 Gönderilen PDF Meta'da.** A) Teslim / başarısız / süresi doldu kesinleşince program PDF'i Meta'dan siler (KVKK: en az saklama). B) Meta 30 gün sonra kendisi siler.
  ÖNERİ A.
- **S4 "WhatsApp'ı Bağla" sayfasının yeri.** Meta bağlama sayfasını sabit bir HTTPS alanında ister. A) Kapıcıda (`kapi.destekofis.net/wa/bagla`; kod değişimiyle aynı yerde, site
  PR'ı gerekmez; canlıya sizin onayınızla). B) Sitede (`destekofis.net`, `ceougur/destekofis` PR'ı; kod değişimi yine kapıcıda). ÖNERİ A.

## 12. Karar geçmişi (kısa; tam metin CLAUDE.md ve `docs/GECMIS-KARARLAR.md`)

- 30.10 ~03:40 UTC: 2.4.8 WhatsApp planı istendi (Verimor, EDM modeli). ~04:05: S1–S5 öneriler kabul (herkese; MZ 2.4.8'e; "WhatsApp Mesajı İstemiyor" + bir kez onay; PDF
  seçilen döneme uyar; PDF kapıcıda 3 gün — Meta'da GEÇERSİZ). ~04:20: sıfır sürtünme, gerekirse DestekOfis bir kez kurulum desteği; seç → Gönder. ~04:30: programda Kopyala /
  şablon rehberi YOK; 2 sabit adlı şablon (Verimor'a e-posta — Meta'da program API ile açar).
- ~10:30: yalnız 2 bilgilendirme şablonu, kampanya/serbest metin YOK; onay metni "aydınlatma metnime ekledim". ~10:45: "Aydınlatma Metni Hazırla"; onay "Aydınlatma metnimi
  okudum, carilerime ulaştıracağım" işaretlenmeden toplu gönderim başlamaz; ekstre şablonuna KVKK alt satırı.
- ~11:05–14:10: Verimor yanıtsız / telekom aboneliği şartı → BIRAKILDI; araştırma (Meta doğrudan önerildi); direct developer'da birlikte kullanım yok (Meta şartı); sanal numara
  doğrulanmamış portföyde reddedildi (#2494070).
- ~14:30: yön Meta Cloud API, entegratörsüz, Tech Provider hedefi. ~14:40: 2.4.8'de yapılır, vergi kaydı beklenmez. ~14:50 / ~15:00: iki yol da DÜZ AÇIK, gizli bayrak / kapıcı
  anahtarı / "yakında" yazısı YOK.
- 30.10 (P0, bu belge): PDF programdan Meta'ya yüklenir (kapıcıda PDF saklama kalktı); şablonlar program tarafından API ile açılır; Embedded Signup v5; S1–S4 yanıt bekler.
