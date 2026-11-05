# Meta App Review — iki video için çekim senaryosu

05.11.2026. Uygulama: **DestekOfis Mesaj** (App ID 1505264761663625). Tech Provider → App Review → "Record video documentation".
Meta iki izin için ayrı ayrı video ister: **whatsapp_business_messaging** (ileti gönderme) ve **whatsapp_business_management** (hesap/şablon yönetimi).
Videolar kullanıcının bilgisayarındaki programdan çekilir (Elle Bağla, 03.11'de uçtan uca çalıştı). Müşteri verisi görünmez: yalnız deneme carisi.

## Hazırlık (bir kez)
1. Programda **deneme carisi** açın: Ad `Test Customer (Demo)`, cep telefonu = kendi numaranız (Meta deneme numarasının gönderebildiği kayıtlı alıcı).
   Bu cariye küçük bir borç hareketi girin ki ekstrede satır olsun. Gerçek müşteri adı / telefonu ekranda görünmesin.
2. Telefonunuzdaki iletiyi aynı videoda göstermek için tarayıcıda **web.whatsapp.com**'u kendi numaranızla açın (ya da telefonun ekran kaydını ayrıca alın).
3. Ekran kaydı: Windows'ta **Ekran Alıntısı Aracı → Kaydet** (ya da Win + Alt + R). Ekran çözünürlüğü okunur olsun; ses gerekmez.
4. Açıklama yazıları: kayıttan sonra Windows'taki **Clipchamp** ile videoya aşağıdaki İngilizce yazılar eklenir (Metin → başlık). Her yazı ilgili adımın üstünde 3–4 sn.

## Video 1 — whatsapp_business_messaging (yaklaşık 1–2 dk)
| Adım | Ekranda yapılacak | Eklenecek İngilizce yazı |
|---|---|---|
| 1 | Programı açın, yönetici olarak girin. | `DestekOfis — accounting software. The business sends account statements to its own customers via the WhatsApp Cloud API.` |
| 2 | **Yönetim → WhatsApp**: bağlantı "Bağlı", numara görünür. | `The business's WhatsApp Business Account is connected to the DestekOfis Mesaj app.` |
| 3 | Cariler'de `Test Customer (Demo)`'yu seçin → **WhatsApp ile Ekstre Gönder**. | `The user selects a customer and chooses "Send statement via WhatsApp".` |
| 4 | Gönderim yolu **WhatsApp ile Otomatik Gönder**, dönem seçin → **Başla** → "Gönderime Başlansın mı?" onayı. | `The app sends an approved utility template (account statement) with a PDF through the Cloud API.` |
| 5 | web.whatsapp.com'a geçin: ileti ve ekstre PDF'i gelmiş. | `The customer receives the message on WhatsApp.` |
| 6 | Programa dönün: cari kartı **Son Gönderimler**'de durum **Teslim Edildi / Okundu**. | `Delivery and read statuses are received via webhooks and shown in the app.` |

## Video 2 — whatsapp_business_management (yaklaşık 1 dk)
| Adım | Ekranda yapılacak | Eklenecek İngilizce yazı |
|---|---|---|
| 1 | **Yönetim → WhatsApp**: hesap kimliği, numara, Kalite, Gönderim Sınırı alanları. | `The app reads the WhatsApp Business Account: phone number, quality rating and messaging limit.` |
| 2 | **Şablonları Denetle ve Oluştur**'a basın; iki şablonun durumu (Onaylı) görünür. | `The app creates and checks its two utility message templates (account statement, payment reminder).` |
| 3 | (İsteğe bağlı) business.facebook.com → WhatsApp Manager → Message templates: aynı iki şablon. | `The templates created by the app in WhatsApp Manager.` |
| 4 | **Kendime Deneme Gönder** → telefonda/web'de deneme iletisi. | `Connection test message sent from the app.` |

## İnceleme formuna yazılacak açıklamalar (İngilizce, kopyala-yapıştır)
**whatsapp_business_messaging:**
DestekOfis is desktop accounting software for small businesses. Each business connects its own WhatsApp Business Account to our app (Embedded Signup with coexistence, or manual connection). The app uses whatsapp_business_messaging only to send two approved utility templates to the business's own customers: an account statement (with a PDF) and a payment reminder. No marketing messages are sent. Delivery and read statuses are received through webhooks and shown in the app. Incoming messages and chat history are not stored.

**whatsapp_business_management:**
The app uses whatsapp_business_management to read the connected WhatsApp Business Account and phone number (display name, quality rating, messaging limit), to create and check the status of its two utility message templates, to subscribe the app to the account's webhooks, and to register the phone number when needed. It does not manage any other assets.

## Notlar
- business_management (05.11, 2.5.0 oturumunun uyarısı): W-1 belirteç yenilemesi (POST /<CLIENT_BUSINESS_ID>/system_user_access_tokens) bu izni ister (Meta belgesi doğrulandı). App Review'da izin ancak uygulamada KULLANILAN bir özellikle gösterilebilir; W-1 2.5.0'da yazılacağı için bu ilk başvuruya girmez — KARAR (kullanıcı 05.11 "a"): W-1 bitince ikinci App Review. Eklenirse yapılandırma 1468332482078262'nin Permissions adımına da eklenir.
- Video "Record video documentation" adımı işletme doğrulaması bitince açılır (05.11'de kilitliydi).
- Embedded Signup (WhatsApp'ı Bağla) akışı Tech Provider onayından önce gerçek müşteriyle gösterilemez; inceleme Elle Bağla akışıyla yapılır. İnceleyen isterse WhatsApp'ı Bağla videosu onaydan sonra eklenir.
- Meta'nın barındırdığı "Meta-hosted embedded signup" bağlantısı (sayfada v4 ile üretiliyor) KULLANILMAZ; program kendi sayfasını (kapi.destekofis.net/wa/bagla, v5) açar.
