# WhatsApp Küçük İşler Tur 1 — Tasarım Notu (2.5.0; bildirim yolu)

Durum: KODDAN ÖNCE yazıldı (06.11.2026, tur 1 kod ajanı, taban 3fe5a92d). Kapsam: S33, S41, S43 (kullanıcı kararları AYNEN, `docs/2.5.0-IS-LISTESI.md` D),
dar kontrol DÜŞÜK-2 (kipin WABA'ya bağlılığı), WE + BS-7 sonrası BAŞ MİMAR KARARI (kapıda boş "Verify Token" satırı gizlenir), yan ölçüm (salt okunur lisansta
Webhook Bilgileri). "Kime kaç kez" kuralı DEĞİŞMEZ; genel ilke (31.10) (1)–(5) aynen.

## 0. Kararlar (AYNEN)
- **S33 = A**: Yol 2'de "bildirim yolu çalışıyor" işaretini yalnız İMZALI (Meta imzası doğrulanmış) bildirim koyar (ilke 2).
- **S41 = A**: Meta'da WABA'nın alternatif bildirim adresi yokken teslim / teslim edilemedi bildirimi UYGULAMA DÜZEYİ adrese (/wa/kanca/…) gelirse, bu kurulumda kaydı olan
  WABA'nın bildirimi alternatif adresle AYNI kurallarla işlenir (Yol 1 imzasız kabul, Yol 2 yalnız imzalı) ve Meta'daki adres hemen yeniden denetlenir. (Baş mimar kararı (5)
  "uygulama düzeyi POST işlenmez" bu durum için KALKTI.)
- **S43 = A**: wamid'i tanınmayan (bu kurulumun göndermediği) bildirim işareti KOYMAZ. Kâhin okuması Y18-13 (BAŞ MİMAR KARARI listesinde): bu kurulumun gönderip yanıtı
  kaybolmuş iletisinin bildirimi iş kimliğiyle tanınır ve işareti koyar.

## 1. Bugün (3fe5a92d) — koddan
- İşaret İKİ yerde tutuluyor; bakım turu (`queue.mjs` maintain, W-3'ün dosyası — DEĞİŞMEZ) ikisinin en yenisine bakıyor (son 7 gün → teslim bilgisi gelmeyen iş TTL + 1 sa'te
  "Süresi Doldu"):
  1. **WABA düzeyi** — makine defteri `hook_seen` (`hook.mjs:158` `hooks.hookSeen(hook.wabaId)`): WABA'nın gizli yoluna gelen HER POST, imza, tanınma ve şirket denetiminden
     ÖNCE koyuyor. Aynı WABA'daki BÜTÜN şirketler okuyor.
  2. **Şirket düzeyi** — şirketin `whatsapp.hookSeen` ayarı (`queue.applyStatuses` başında): kanca o şirketin bildirimini işlemeye verince. Kanca bunu yalnız sahibi bulunan
     (wamid / imzalı iş kimliği / taşınan veri) ve şirketin kipine göre kabul edilen (Yol 2'de yalnız imzalı — `hook.mjs:215`) bildirimde çağırıyor.
- Sonuç: (1) S33'ü (Yol 2'de imzasız tek POST işaret koyuyor), S43'ü (tanınmayan wamid işaret koyuyor) ve S33 ETKİLEŞİMİNİ (aynı WABA'da 001 Yol 1'in meşru imzasız bildirimi
  002 Yol 2'nin işaretini koyuyor — dar kontrol s5, 06.11 ölçüldü: 002'nin işi `expired`) bozuyor. (2) zaten S33 / S43 ile uyumlu.
- Uygulama düzeyi adres (`hook.mjs` appLevel): POST okunur, 200, İŞLENMEZ (karar 5). Meta'da alternatif adres yoksa teslim bilgisi kaybolur → iş "sent" kalır → süre dolunca
  "Süresi Doldu" → iletiyi almış kişi aynı dönemde yeniden "gönderilecek" (dar kontrol s3).
- `hub.mjs` modeOf: özet bu WABA'nınsa özetin kipi, değilse makine defterindeki (şirket + WABA) kip — kod DOĞRU; testi yok (dar kontrol m5 sağ kaldı).

## 2. İşaretin yeri — KİPE GÖRE, ŞİRKET + İMZA düzeyinde
- **WABA düzeyinde işaret KALKAR** (kanca `hooks.hookSeen` çağırmaz). İşaret yalnız ŞİRKET düzeyinde: kancanın o şirkete işlemesi için verdiği bildirim (sahibi bu kurulumun
  o şirketi, WABA'sı bildirimin WABA'sı) — Yol 1'de imzasız da, Yol 2'de YALNIZ imzalı (kip şirketin kaydından; `hook.mjs:215` aynen). Bu yol `queue.applyStatuses`'tan
  geçer (dosyasına dokunulmaz).
- Neden WABA düzeyi tümden kalkıyor (BAŞ MİMAR KARARI — ders 40; "kime kaç kez"e İLKEYLE, ilke 2): aynı WABA'yı iki şirket farklı Meta uygulamalarıyla kullanabilir (001 Elle
  Bağla = müşterinin uygulaması, 002 WhatsApp'ı Bağla = DestekOfis uygulaması); bildirimin geldiği yol uygulamaya göredir. Bir şirketin (imzalı ya da imzasız) bildirimi öbür
  şirketin yolunun çalıştığını KANITLAMAZ. Yanlış işaret → öbür şirketin teslim bilgisi gelmeyen işi "Süresi Doldu" → almış olabilecek kişiye aynı dönem ikinci ileti (ilke 2
  ihlali). İşaretsizlik ise güvenli taraftır: iş "Meta Kabul Etti"de kalır, kişi "Daha Önce Gönderildi", R3 "Yine de Gönder" açık (ilke 4: çıkmaz yok).
- BEDELİ (bilgi; kullanıcıya gösterilsin): aynı WABA'yı AYNI kipte kullanan iki şirkette bir şirketin bildirimi öbürünü artık işaretlemez — öbür şirketin işi ancak kendi
  bildirimi geldiyse (son 7 gün) "Süresi Doldu" olur. Tek şirkette davranış AYNI. Kâhinin aynı WABA'lı iki senaryosu (SIRKET-01, J1-03) her iletiye bildirim aldığı için
  etkilenmez.
- Tanınma sırası (S43 + Y18-13; `hook.mjs:170` aynen): (a) wamid makine defterinde (kabulü yazan şirket) → (b) YALNIZ imzalı bildirimde iş kimliği
  (`biz_opaque_callback_data` → talebi yazan şirket; yanıtı kaybolmuş, "Sonucu Belirsiz" iletinin bildirimi) → (c) taşınan veride wamid şirket dosyasında. Hiçbiri değilse
  tanınmaz: işlenmez, işaret koymaz (J6 penceresinde 503 aynen). Yol 1'de iş kimliği yolu açılmaz (imzasız, §7a 3 / P5 aynen — S41 "aynı kurallar").
- S33 sorusundaki ölçülen durum: Yol 2'de imzasız tek bildirim → işaret yok → teslim bilgisi gelmeyen iş TTL + 1 sa sonra "Meta Kabul Etti"de kalır, aynı dönemde
  "Daha Önce Gönderildi" (gönderilecek GÖRÜNMEZ).

## 3. Uygulama düzeyi adres (S41)
- GET doğrulaması aynen. POST: gövde okunur / ayrıştırılır (413 / 400 aynen); her `entry`'nin WABA'sı `entry.id` (Meta: whatsapp_business_account olayında WABA kimliği).
  "Bu kurulumda kaydı olan WABA" = makine defterinde Bildirim Yolu kaydı olan (`hookOf`, kaldırılmış kayıt dahil — alternatif adresin geç bildirimleri de böyle kabul edilir) YA DA
  bir şirketin o WABA'daki kipi bilinen (`modeOf`) WABA. Kaydı olmayan WABA'nın bildirimi düşer (200; işlenmez, saklanmaz).
- Kaydı olan WABA'nın bildirimleri alternatif adresin İŞLEME YOLUNUN AYNISINDAN geçer (tek işlev; WABA = `entry.id`): sahip araması ve WABA eşleşmesi, Yol 2'de imzasız
  yazılmaz (401 / defter yolunda da), defter yazılamazsa / şirket meşgulse 503, J6 penceresi 503, yalnız defter yolu, işaret kuralı (§2).
- **"Meta'daki adres hemen yeniden denetlenir"**: kaydı olan WABA'nın `messages` bildirimi uygulama düzeyi adrese gelince (imzalı / imzasız, tanınan / tanınmayan — Meta'nın
  bu adrese göndermesi alternatif adresin eksik olduğunun işaretidir) arka planda, yanıtı bekletmeden:
  - Hangi çağrı: o WABA'ya bağlı bir şirketin `connection.ensureHook(ofisin adresi, { force: true })`'u — Bağlantıyı Sına'nın yolu: `GET /<WABA>/subscribed_apps` ile
    Meta'daki kayıtlı alternatif adres okunur; programınki değilse / yoksa `POST /<WABA>/subscribed_apps { override_callback_uri, verify_token }` ile yeniden kaydedilir
    (yeni gizli yol). Adres bizimkiyse dokunulmaz.
  - Şirket seçimi: önce bildirimin sahibi şirketler, sonra o WABA'da kipi bilinen şirketler; kaydı o WABA'da ve belirteçli, lisans yazılabilir, arka planda yazılabilir (şema kapısı
    + yazma kilidi — BS-7: kapılı şirkete hiç yazılmaz), belirteç süresi DOLMAMIŞ ilk şirket. Uygun şirket yoksa denetim yapılmaz, günlüğe yazılır.
  - Sıklık: WABA başına tek uçuş + en çok 15 dakikada bir (programın saatiyle; bellekte — program yeniden açılınca ilk bildirimde yine hemen). Meta her teslim / okundu için
    ayrı POST gönderir; her POST'ta Meta'ya istek gitmez. Bakım turunun saatlik denetimi aynen sürer.
  - Hata: Meta'ya ulaşılamazsa / Meta reddederse sonuç günlüğe yazılır; bildirimler bu arada uygulama düzeyi adreste İŞLENMEYE devam eder (kayıp yok); 15 dk sonraki ilk
    bildirimde ya da bakım turunda yeniden denenir. Kayıt düşerse Bildirim Yolu kartı "Kaydedilemedi" (registerHook aynen).
  - Neden force: bakım turunun yolu (force'suz) son denetimden / kayıttan sonra 1 saat bekler; "hemen" değil. Bu tetikte iki kurulum çekişmesi doğmaz: Meta bildirimi uygulama
    düzeyi adrese ancak o uygulamanın bu WABA'daki alternatif adresi YOKKEN gönderir (başka kurulumun adresi varsa bildirim oraya gider, buraya gelmez).
- Dosya sınırı: `connection.mjs` DEĞİŞMEZ (çağrılır). İzleme (tek uçuş + 15 dk + test için `settled()`) ortak katmanın uygulama düzeyi webhook nesnesinde
  (`app-webhook.mjs` `rechecks`); kanca onu kullanır.

## 4. DÜŞÜK-2 (hub.mjs modeOf — kod doğru, test eklenir)
- Özetteki kip YALNIZ özet o WABA'nınsa geçer; değilse makine defterindeki şirket + WABA kipi; yoksa null (Yol 1 sayılır — BAŞ MİMAR KARARI (1)). Test: birim (hub) + kanca
  üzerinden (şirket şimdi başka WABA'da Yol 2, eski WABA'daki Yol 1 iletisinin imzasız teslimi, şirket dosyası açılamıyor → defter yolunda YAZILIR, 200).

## 5. Webhook Bilgileri — kapıda boş belirteç (BAŞ MİMAR KARARI, WE + BS-7 dar kontrolü sonrası)
- `verifyToken` boşsa (kapılı 001, çift yok — `ready: false`) "Verify Token" satırı ve "Belirteci Kopyala" GİZLENİR; neden metni kalır. Callback satırı / düğmesi zaten
  `ready`'ye bağlı.

## 6. Yan ölçüm (kod DEĞİŞMEZ)
- Süresi dolmuş (salt okunur) lisansta Webhook Bilgileri'nin ilk GET'i çifti üretip 001'e yazıyor mu → ölçülür, rapora "BAŞ MİMAR KARARI GEREKİYOR" (iki seçenek + öneri).

## 7. Nasıl bozulur? (testler buradan)
1. **İki şirket aynı WABA, farklı kip** (001 Yol 1 + 002 Yol 2): 001'in meşru imzasız teslimi 002'yi işaretlemez (002'nin işi TTL + 1 sa sonra Meta Kabul Etti, "Daha Önce");
   001'in kendi işi kendi bildirimiyle işaretli (Yol 1 aynen: TTL + 1 sa'te Süresi Doldu). Ters yön: 002'nin imzalı bildirimi 001'i işaretlemez.
2. **İki şirket aynı WABA, aynı kip**: bir şirketin bildirimi öbürünü işaretlemez (§2 bedeli).
3. **Yol 2 imzasız tek bildirim** (sahte istek / kapıcıda uygulama sırrı eksik → her bildirim "wa0"): işaret yok, iş Meta Kabul Etti, kişi "Daha Önce Gönderildi"; sırrı
   düzelince Meta'nın yeniden denediği imzalı bildirim işlenir.
4. **Tanınmayan wamid** (Yol 2 imzalı, Yol 1 imzasız): 200, işaret yok. **İş kimliğiyle tanınan** (Yol 2 imzalı, yanıtı kaybolmuş ileti): işaret VAR.
5. **İmzasız sahte "failed"** (Yol 1): işlenir — BİLİNEN RİSK (Y17-26, kullanıcı kararıyla; değişmez). Yol 2'de imzasız "failed" yazılmaz.
6. **Uygulama düzeyi adres**: Yol 1 imzasız kabul (Teslim, R3 sayar); Yol 2 imzasız 401 (yazılmaz), imzalı işlenir; kaydı olmayan WABA düşer; WABA kimliği bildirimin sahibiyle
   uyuşmazsa düşer; adres denetimi: alternatif adres yoksa yeniden kaydedilir, bizimkiyse dokunulmaz; 15 dk içinde ikinci denetim yok, sonra yine; kapılı şirkette / salt okunur
   lisansta / süresi dolmuş belirteçte denetim yok.
7. **Yol değişimi** (aynı şirket Yol 1 → Yol 2): şirketin işareti şirket ayarındadır (`queue.mjs` — W-3'ün dosyası) ve kip değişince SIFIRLANMAZ: Yol 1 döneminde konmuş
   işaret Yol 2'ye geçişten sonra en çok 7 gün geçerli kalır. Etkisi yalnız şablonun teslim süresi 7 günden KISA ise (Meta'nın varsayılanı 30 gün; program süre yazmaz):
   TTL + 1 sa anında işaret 7 günden eskidir. → ölçülür, rapora (düzeltme `queue.mjs` / `connection.mjs` ister — bu turda yazılamaz).
8. **Geri yükleme / taşıma (ilke 5)**: şirket işareti şirket dosyasıyla gelir (yedek / taşınan dosyadaki an) — bugünkü şirket işaretiyle aynı; WABA işareti zaten yok. Uygulama
   düzeyi çift 001 yedeğinde korunur (COMMON_SETTINGS — WE + BS-7). Yeniden açılışta tek uçuş / 15 dk izi sıfırdır (ilk bildirimde hemen denetim).
9. **Sırrı eksik kapıcı**: §7 3. Uygulama düzeyi adrese gelen imzasız bildirim Yol 2'de 401; adres denetimi yine yapılır (Meta'ya yalnız okuma; adres bizimkiyse değişmez).
10. **Çok sayıda POST** (Meta her durumu ayrı yollar): adres denetimi 15 dk'da bir; işleme her POST'ta (eşgüçlü — yinelenen durum etkisiz).
