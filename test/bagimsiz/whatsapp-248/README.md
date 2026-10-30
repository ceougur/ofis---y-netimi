# WhatsApp Otomatik Gönderim — Bağımsız Kâhin ve Sahte Meta Sunucusu (DestekOfis 2.4.8, K0)

Bu klasör, 2.4.8'deki **Meta WhatsApp Cloud API ile toplu gönderimin** (plan `docs/erp/WHATSAPP-API-PLANI-2.4.8.md`, iş listesi `docs/2.4.8-IS-LISTESI.md`
madde K0) bağımsız kâhinidir:

1. **Sahte Meta Graph sunucusu** (`sahte-meta/`, Node, bağımlılıksız `node:http`) — yalnız Meta'nın resmî belgelerinden (30.10.2026 okunan .md sayfaları;
   kopyaları depoya KONMADI). Belgede olmayan her davranış **D0** diye işaretli (aşağıda liste). Gerçek Meta'ya hiçbir istek gitmez (yalnız 127.0.0.1).
2. **Kâhin modeli** (`kahin/kahin.py`, Python, yalnız standart kütüphane — programdan AYRI dil) — toplu gönderimin beklenen sonucu, YALNIZ planın ürün
   kurallarından. Planın sustuğu her yer bir **serbest seçim**dir (aşağıda "PLAN SUSUYOR"); kâhin karar VERMEZ (ders 40, 43), her seçeneğin sonucunu ayrı verir.
3. **Senaryo kümesi** (`kahin/senaryolar.py` → `kahin/senaryolar.json`) — 103 senaryo, plan §8 "Nasıl bozulur?" başlıklarının hepsi.

**Bağımsızlık.** Programın kodu (`server/`, `client/`, `bulut/`) GÖRÜLMEDEN yazıldı (KANIT KURALI 2, ders 5). Okunanlar: CLAUDE.md, plan, iş listesi,
araştırma belgesi, Meta belge sayfaları (send-messages, document-messages, media, template-media, components, template-management, template-categorization,
template-quality, error-codes, webhooks overview / override / status reference, messaging-limits, throughput, access-tokens, registration, embedded-signup
implementation / tech-provider onboarding / versions, pricing) ve bu klasörün düzeni için `test/bagimsiz/edm-sayac/` README'si.
Plan §6 K0 klasör olarak `test/sahte-meta/` yazıyor; görev bu klasörü (`test/bagimsiz/whatsapp-248/`) verdi.

**Bağımsızlığın sınırı.** Elle beklenen ile model aynı elden (bu kâhin) çıktı: bağımsızlık PROGRAMA göredir. Kendi içindeki dişi: (a) elle beklenen ↔ model
iki ayrı türetme, (b) mutasyon testi (37 bilerek hata, her biri en az bir senaryoda yakalanıyor), (c) kapsam testi (senaryonun bildirmediği serbest seçim
sonucu değiştirmemeli).

## Dosyalar

| Dosya | İçerik |
|---|---|
| `sahte-meta/sunucu.mjs` | Sahte Graph sunucusu: `sahteMetaBaslat()` + denetim uçları `/__sahte/*`; `node sunucu.mjs --port 0` ayrı süreç |
| `sahte-meta/hatalar.mjs` | Meta hata kataloğu (belgedeki `details` aynen) + D0 HTTP durum eşlemesi + hata gövdesi |
| `sahte-meta/kanca.mjs` | Durum kancası gövdesi (belge biçimi), imza (D0), doğrulama isteği (D0), Meta yeniden deneme kuyruğu (7 gün) |
| `sahte-meta/sunucu.test.mjs` | Sahte sunucunun kendi testleri (node --test, 34) |
| `sahte-meta/mutasyon.mjs` | Testlerin dişi: sunucuya 18 bilerek hata, her biri ayrı geçici kopyada; her biri en az bir testi kırmızı yapmalı |
| `kahin/kahin.py` | Model + komut satırı (`hesapla`, `karsilastir`) |
| `kahin/senaryolar.py` | 103 senaryo (girdi + ELLE beklenen); modelle karşılaştırır, aynıysa `senaryolar.json` yazar |
| `kahin/senaryolar.json` | Her senaryo: girdi, elle beklenen, modelin bütün beklenen sonucu (serbest seçim gruplarıyla) |
| `kahin/kahin_test.py` | Kâhinin kendi testi (A–G) + mutasyon; TAP + `# tests/pass/fail` |

## Nasıl koşulur (depo kökünden)

```sh
node tools/kanit.mjs kos 248-k0-sahte-meta -- node --test test/bagimsiz/whatsapp-248/sahte-meta/sunucu.test.mjs
node tools/kanit.mjs kos 248-k0-sahte-meta-mutasyon -- node test/bagimsiz/whatsapp-248/sahte-meta/mutasyon.mjs   # TMPDIR'de benzersiz kopyalar
node tools/kanit.mjs kos 248-k0-senaryolar -- python3 -I test/bagimsiz/whatsapp-248/kahin/senaryolar.py   # senaryolar.json (elle ≠ model → yazmaz, çıkış 1)
node tools/kanit.mjs kos 248-k0-kahin -- python3 -I test/bagimsiz/whatsapp-248/kahin/kahin_test.py
python3 -I test/bagimsiz/whatsapp-248/kahin/kahin.py hesapla senaryo.json
python3 -I test/bagimsiz/whatsapp-248/kahin/kahin.py karsilastir beklenen.json program.json --secim 'uretim_ani=baslatma,belirsiz_cozum=bilinmeyen_duser'
```

## 1. Sahte Meta sunucusu

Taban: `http://127.0.0.1:<port>/<sürüm>/…` (sürümsüz yol da kabul; `kaldirilmisSurumler` ile sürüm reddi D0). `Authorization: Bearer <belirteç>`.

| Uç | Davranış (kaynak) |
|---|---|
| `POST /<PHONE_NUMBER_ID>/messages` | Şablon iletisi (belge başlığı `document.id` ya da `link`, gövde değişkenleri), yanıt `contacts[{input, wa_id}]` + `messages[{id: wamid…}]`. `+` yoksa İŞLETME ülke kodu başa eklenir (belge tablosu). `biz_opaque_callback_data` saklanır, kancada geri gelir. Hatalar: 132001 (yok/onaysız/dil), 132015 PAUSED, 132016 DISABLED, 132000 değişken sayısı, 132018 değişken biçimi (D0 kuralı), 131053 silinmiş/süresi dolmuş medya (D0), 131021 gönderen = alıcı, 131047 şablonsuz ileti CSW dışında, 133010 kayıtsız numara, 131057 bakım, 131042 ödeme, 368/131031 kısıtlı, 131063 pazarlama kapalı, 130429 hız (80 mps), 131056 çift hız (D0 eşik, kapalı), gönderim sınırı (D0), 131026 WhatsApp kullanmayan alıcı (kancada; ayarla eşzamanlı) |
| `POST /<PHONE_NUMBER_ID>/media` | multipart (`messaging_product`, `file`, `type`) → `{id}`; tür/boyut tablosu (PDF 100 MB), MIME uyuşmazlığı 131053, eksik alan 100/131008 |
| `GET /<MEDIA_ID>` · `DELETE /<MEDIA_ID>` | url/mime_type/sha256/file_size/id; `phone_number_id` denetimi; `{success: true}`; medya ömrü 30 gün (belge); indirme belirteç ister |
| `POST /<WABA_ID>/message_templates` | ad `^[a-z0-9_]+$` ≤ 512 (100), aynı ad + dil 100 / 2388024, kategori/dil 100, gövde ≤ 1024 / alt satır ≤ 60 / başlık metni ≤ 60 → 2388040, baştaki/sondaki değişken 2388299, 250 şablon 2388019, belge başlığında Resumable Upload tutamağı; ilk durum ve kategori kararı senaryodan (UTILITY → MARKETING onayı, belge) |
| `GET /<WABA_ID>/message_templates` · `GET /<TEMPLATE_ID>` · `POST /<TEMPLATE_ID>` · `DELETE …/message_templates` | `fields`, `status` süzgeci, `quality_score {score, date}`, sayfalama; düzenleme sınırları (yalnız APPROVED/REJECTED/PAUSED; 2388039), ad/kimlik(ler)le silme, silinen onaylının adı 30 gün kapalı |
| `POST /<APP_ID>/uploads` · `POST|GET /upload:<id>` | Resumable Upload (TAMAMI D0) → `{h: "4::…"}` |
| `GET /<PHONE_NUMBER_ID>?fields=…` · `POST /<PHONE_NUMBER_ID>` | `whatsapp_business_manager_messaging_limit` ("TIER_250"…), `throughput`, `webhook_configuration`; `messaging_limit_tier` istenirse ret (D0); numara düzeyinde override adresi |
| `POST /<PHONE_NUMBER_ID>/register` · `/deregister` | 6 haneli PIN, 72 saatte 10 deneme → 133016, yanlış PIN 133005 |
| `GET|POST|DELETE /<WABA_ID>/subscribed_apps` | override ≤ 200 + verify_token; gövdesiz POST override'ı kaldırır |
| `GET /oauth/access_token` | Embedded Signup kodu → `{access_token, token_type: "bearer"}`; kod ömrü 30 sn (belge), ikinci kullanım ret (D0) |

**Belirteç:** yok / süresi dolmuş (190) / iptal (0) / ileti izni yok (10) / yönetim izni yok ya da varlık erişimi yok (200). Belirteç istek gövdesinde ya da
sorguda görülürse `sizintilar` kaydına düşer.

**Senaryo kuralları** (`meta.kural({...})` ya da `POST /__sahte/kural`): `{ yol: "messages"|"media"|"templates_post"|"phone_get"|…|"*", to?, sablon?, deneme?,
kez?: n|"hep", yanit }`; `yanit`: `{hata: kod, http?, details?}` · `{koptu: "once"}` (işlenmeden bağlantı kopar) · `{koptu: "sonra"}` (İŞLENİR — ileti Meta'da —
yanıt gitmez) · `{gecikmeMs}` (istemci zaman aşımına düşer, ileti yine kabul) · `{http: 5xx, islendi: false|true}` (gövdesiz 5xx) · `{bozuk: true}` ·
`{sinir: true}`. `deneme` aynı (yol, alıcı) için kaçıncı istek; medya isteğinde alıcı yoktur → medya kuralları GENEL sırayla.

**Denetim uçları** (`/__sahte/…`): `kayit` (istekler, mesajlar, medyalar, kancalar, sayılar: alıcı başına POST ve kabul, medya yükleme/silme, kopan
bağlantı, sızıntı, geçersiz medyayla gönderim), `sifirla`, `kur`, `kural`, `saat` (sahte saat: `{simdi}` ya da `{ilerle}`), `sablon` (durum/kategori/kalite),
`numara` (basamak, kayıt, bakım), `waba` (ödeme, kısıt), `belirtec`, `alici` (`whatsapp: false`), `kanca` (`{wamid, durum, hataKodu, tekrar, opaque, fiyat}`),
`kanca/ham` (sahte/başka WABA olayı), `kanca/kuyruk` (Meta yeniden denemesi; 7 gün), `kanca/dogrula` (GET doğrulama), `es-kodu`, `medya/<id>` (ham PDF).

Kanca adresi önceliği (belge): numara override → Messaging hesabı override → uygulama varsayılanı (`uygulama.kancaAdresi`). 200 dışı yanıtta kuyruk.

## 2. Kâhin modeli

**Girdi** (senaryo): `baslangic` (ISO, yerel saat dilimi), `cariler` (`id, ad, telefon, istemiyor, silindi, sirket, hareketler[{tarih, borc, alacak}]`), `ayar`
(`bagli, onay, gunluk_ust_sinir, lisans_yazilabilir`), `kullanicilar` (`whatsapp.send`), `firmalar`, `wabalar` (şirket → WABA), `meta` (`basamak`, şablon
durum/kategori), `meta_davranis` (`mesaj` alıcı başına n. POST yanıtı; `medya` genel sıra; `kanca` iletiye Meta'nın göndereceği durumlar), `olaylar`
(`baslat` [etiket, seçim SIRASIYLA, şablon, dönem, kullanıcı, `cift`], `kontrol`, `cari`, `kapat`, `ac`, `cokme` [o carinin isteği anında süreç ölür,
`istek_ulasti`], `tunel`, `kanca_kuyrugu`, `lisans`, `duraklat`/`devam`/`iptal`, `basarisizlari_yeniden_dene`, `yine_de_gonder`, `geri_yukle`/`sifirla`/
`tasindi`, `meta_basamak`, `meta_sablon`, `meta_kapali`, `sahte_kanca`), `serbest` (senaryonun bağlı olduğu PLAN SUSUYOR seçimleri), `ozet_cikti`.

**Çıktı** (beklenen; `[{secimler, sonuc}]` — aynı sonucu veren serbest seçim birleşimleri tek grupta): `baslamadi` (etiket → neden), `elenen` (etiket → cari →
neden), `bos_toplu`, `toplular` (durum `aktif`/`duraklatildi`/`iptal`/`soruluyor` — iç ad; neden kodu), `durum_sayilari`, `isler` ("T1/A" → durum, telefon,
şablon, değişkenler, pdf {cari_ad, donem_bas, donem_son, devir, hareket_sayisi, donem_sonu_bakiye}, dosya_adi {on_ek, son_ek}, hata_kodu, post, kabul,
meta_ileti, medya_yukleme, medya_silme), `meta` (cari başına POST / programın bildiği kabul / Meta'daki ileti / medya yükleme / silme, toplamlar), `kontroller`
(kontrol anında durum sayıları, iş durumları, toplam POST/kabul, pencere içindeki farklı alıcı, silinen medya), `bu_ay` (İKİ görünüm: `sirket`, `waba` →
ay → {kabul, teslim, yaklasik_usd}), `degismez` (iç denetim sayaçları; hep 0).

**Yaprak türleri:** düz değer = kesin; `{"biri": [...]}` = sıra/zaman serbestliği (program bunlardan biri olmalı); `{"plan_susuyor": …}` = denetlenmez;
`{"kisaltilabilir": tam}` = program tam değeri ya da önekini verebilir (D0 uzunluk sınırı).

**İki uç:** her birleşim 4 kez koşar: sıra ∈ {seçim, ters} × zaman ∈ {hızlı: 0,5 sn adım + 30 sn geçici bekleme, yavaş: 5 sn + 15 dk}.
**Ufuk:** benzetim olay kalmayınca ya da başlangıçtan 10 gün sonra biter (senaryoların en geç denetimi +8 gün; TTL 73 sa ve 7 gün kuralı içinde).
"Son durum" = bu ufuktaki durum.

**Planın kâhine aktarılan kuralları** (kaynak satırları kodda): seçim → tek onay; onay / yetki / lisans / bağlantı / şablon (APPROVED + UTILITY) yoksa
BAŞLAMAZ; İstemiyor / telefonsuz / geçersiz elenir; aynı cari bir iş; numara '+' ve ülke koduyla; değişkenler + PDF AYNI okumadan, PDF seçilen döneme (devir +
dönem hareketleri + dönem sonu; "Tüm Hareketler" = bütün hesap), metin bakiyesi = PDF bakiyesi; tutar "1.250,00 TL"; değişken tek satır; tek işçi;
"Gönderiliyor" istekten önce; yanıtsız → Sonucu Belirsiz, kendiliğinden yeniden YOK; medya yanıtsızsa yeniden yüklenir; hesap/şablon hatası İLK hatada
DURAKLAR; alıcı hatası (131026, 131021, 131009) o iş Başarısız, sürer; 131049 → 24 saat sonra en çok bir kez; geçici → artan bekleme, 5 art arda → durur;
131056 → 1 dk; günlük sınır = min(Meta basamağı [başlarken + 6 saatte bir okunur], elle üst sınır), kayan 24 saatte "Meta Kabul Etti" olmuş FARKLI alıcı,
makine düzeyi + WABA'ya göre (iki şirket aynı WABA → ortak; geri yükleme azaltmaz); sınırda kalanlar "Sınır Nedeniyle Bekliyor", pencere açılınca sürer;
Meta sınır hatası → kalanlar 24 saat; durum yalnız ileri (read'den sonra delivered yok sayılır; read = teslim edildi — Meta); yinelenen kanca etkisiz;
TTL 3 gün + 1 saat → Süresi Doldu; kesin durumda (teslim / başarısız / süresi doldu) PDF Meta'dan silinir, bir kez; "Başarısızları Yeniden Dene" yalnız
kesin Başarısız; "Yine de Gönder" Sonucu Belirsiz'i yeniden gönderir (çift gidebilir); kapanış: kaldığı yerden sürer, "Gönderiliyor" → Sonucu Belirsiz, 24
saatten eski toplu iş kendiliğinden sürmez; geri yükleme / sıfırlama / taşıma → bitmemiş işler durur; salt okunur lisans → yeni başlamaz, bekleyenler
"Lisans Nedeniyle Durdu", kanca kabulü sürer; kapalıyken kancayı Meta 7 güne kadar yeniden dener; "Bu Ay": Meta Kabul Etti + Teslim Edilen ayrı, yaklaşık
ücret = teslim × 0,0009 USD; bilinmeyen wamid düşer.

## 3. Senaryo kümesi

**103 senaryo** (`kahin/senaryolar.json`): TEMEL 4 · ÇİFT 13 · KAYIP 5 · YANLIŞ KİŞİ 11 · YANLIŞ İÇERİK 11 · HESAP / META 36 (hesap/yetki kodları 9, şablon
hatası gönderimde 7, şablon başlatmada 7, geçici 8, alıcı/131049 5) · ÖLÇEK 8 (300 / 600 / 2.000 / 500 × 9 kanca) · TARİH 6 (gece yarısı kayan pencere, ay sonu,
1 Ocak yıl dönümü, TTL sonu, kancasız, 24 saatten eski iş) · ŞİRKET 2 · GÜVENLİK 7. Her senaryoda elle beklenen (yalnız plandan) ve modelin tam sonucu var.

## 4. D0 varsayımları (Meta belgesinde yok ya da belirsiz — D0'da doğrulanır, program bunlara yaslanmadan önce)

Sahte sunucu:
1. HTTP durum kodları (Marketing Messages tablosu dışı): 0/190 → 401; 3/10/200–299/131005 → 403; 4/80007/130429/131056 → 429; 1/131000 → 500; 2/131016/133004 → 503; öbürü 400. Program HTTP durumuna değil `code`'a dayanmalı (Meta).
2. Hata `type` her kodda "OAuthException"; `message` = "(#kod) <details>" (başlık yalnız 130429 için belgede).
3. **Gönderim sınırı aşımının kodu ve biçimi**: varsayılan eşzamanlı 131048 (ayar: başka kod ya da "kabul + failed kancası"). Sahte sunucu KABUL edilen farklı alıcıyı sayar; Meta "teslim edilen" sayar.
4. Basamak adları TIER_2K / TIER_10K / TIER_100K (belgede yalnız TIER_250 ve TIER_UNLIMITED). Küçük sınır denemeleri için elle üst sınır (dailyCap) kullanılmalı.
5. Değişken metni: satır sonu, sekme, 5+ ardışık boşluk, boş değer → 132018 (kod belgeden: "v23.0'dan beri gönderimdeki parametre sorunları 132018"; kural D0); uzunluk sınırı kapalı (ayarlanabilir).
6. Silinmiş / 30 günü geçmiş / olmayan medya kimliğiyle gönderim → eşzamanlı 131053.
7. `file` parçasının Content-Type'ı `type`'tan farklıysa 131053; PDF içeriği "%PDF-" ile başlamazsa 131053.
8. Medya GET/DELETE hataları (yok, silinmiş, süresi dolmuş, `phone_number_id` uyuşmazlığı, ikinci DELETE) → 100; belirteçsiz indirme → 401.
9. **Resumable Upload akışının tamamı** (uç adları, `file_offset`, `OAuth` başlığı, `{h}` yanıtı, App ID denetimi).
10. Şablon oluşturma yanıtı `{id, status, category}`; ilk durum PENDING.
11. Medya başlıklı şablonda `example.header_handle` zorunlu ve Resumable Upload'tan; değişkenli gövdede örnek zorunlu (100); "… {{4}}." (noktayla biten) gövde 2388299 SAYILMAZ — plan şablonu böyle bitiyor, gerçek Meta reddederse metin değişmeli.
12. Desteklenen dil listesi ("tr" dahil; supported-languages sayfası yerelde yok).
13. Şablon yönetiminde kodu belgede olmayan retler (silinen onaylı adın 30 gün kapalı oluşu, onaylının kategori düzenlemesi, düzenleme sınırı, DISABLED silme, olmayan ad silme) → 100; REJECTED düzenlenince PENDING.
14. Şablon listesinde `name` süzgeci, varsayılan limit 25, imleç biçimi.
15. Numara alanları `display_phone_number`, `verified_name`, `quality_rating`, `code_verification_status`, `name_status`; `throughput` biçimi `{level}`; `messaging_limit_tier` ve bilinmeyen alan → 100.
16. Belirteçsiz GET → 200 ("Provide valid app ID", belge), belirteçsiz POST ve bilinmeyen belirteç → 190; ileti izni yok → 10.
17. Ödeme yöntemi yok (131042), hesap kısıtı (368/131031) EŞZAMANLI; WhatsApp kullanmayan alıcı (131026) varsayılan KANCADA (plan §2.7 de D0 der).
18. Kanca imzası `X-Hub-Signature-256: sha256=<HMAC-SHA256(uygulama gizli anahtarı, ham gövde)>`.
19. Kanca doğrulama `GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…` → gövde challenge.
20. Meta'nın kanca yeniden deneme aralıkları (1 dk, 5 dk, 15 dk, 1 sa, 3 sa, 6 sa, 12 sa, sonra 24 sa; 7 günde düşer — 7 gün belgeden).
21. `pricing` nesnesi delivered'da (delivered gelmezse read'de); belge "sent ile delivered/read'den birinde" der.
22. Override adresi ayarlanınca Meta'nın doğrulama isteği atıp atmadığı (sahte sunucu kendiliğinden atmaz; `/__sahte/kanca/dogrula`).
23. `oauth/access_token`: kodun ikinci kullanımı, yanlış gizli anahtar, süresi dolmuş kod → 100 (30 sn ömür belgeden).
24. Kaldırılmış Graph sürümü → 100; sürümsüz yol kabul.
25. 80 mps ölçümü gerçek zamanlı 1 sn pencere; 131056 eşiği (varsayılan kapalı).
26. `biz_opaque_callback_data` gönderim isteğinde kabul edilir, kancada geri gelir (plan §2.2: istek tarafı D0).
27. Şablonsuz ileti CSW dışında eşzamanlı 131047.
28. Birlikte kullanımdaki numarada deregister → 100.

Kâhin:
29. 60 karakteri aşan değişken değeri "kısaltılabilir" (Meta sınırı yerelde yok; plan "kısaltır" der).
30. Meta TTL'den sonra teslim edilmeyen iletiyi düşürür (belge); kâhin TTL'yi kabul anından sayar.

## 5. PLAN SUSUYOR (kâhin karar vermedi; `kahin.SERBEST` adı parantezde)

1. **İş üretim anı** (`uretim_ani`: başlatma / işleme): telefon, ad, bakiye, PDF toplu iş başlatılırken mi, işçi sırası gelince mi okunur. §6 W2 "Her iş ANINDA üretilir" ile §8 "iş üretilirken okunan numara kullanılır" iki türlü okunabiliyor. Kuyrukta telefon/bakiye değişince hangisi gider (KISI-01, ICERIK-09).
2. **Kuyruktayken "İstemiyor" işaretlenen / silinen cari** (`kuyruk_degisimi`): gönderilir mi elenir mi; §8 yalnız risk olarak anar (KISI-09, KISI-10).
3. **ÇELİŞKİ — Sonucu Belirsiz'in kancayla çözülmesi** (`belirsiz_cozum`): §6 W2 "kanca `biz_opaque_callback_data` = iş kimliği ile gelirse çözülür" ↔ §3 "program yalnız kendi kaydındaki wamid'lerin durumunu yazar, bilinmeyen olay düşer" (belirsiz işin wamid'i yoktur). Çözülürse "Meta Kabul Etti" sayacına ve sınır penceresine girer mi. GÜVENLİK: gizli yolu bilen sahte olayla Sonucu Belirsiz işi Meta'da ileti YOKKEN "Teslim Edildi" yaptırabilir ve sayaçları şişirir (GUV-06; kâhin bu ihlali bildirilmiş istisna olarak ölçer).
4. **Sınır doluyken penceresinde zaten sayılmış alıcı** (`sinir_mevcut_alici`: geçer / bekler) — FARKLI alıcı sayımında yer tutmaz; "kalanlar bekler" ile çelişir (SINIR-05).
5. **Toplu iş içindeki gönderim sırası** (seçim sırası, ad, cari kodu…). Bu yüzden "hangisi ertesi güne kalır" yalnız SAYI olarak beklenir (kâhin sıra × 2 uç).
6. **Sabit hat ve yurt dışı numara** (`sabit_hat`, `yurtdisi`): elenir mi; "geçersiz numara" ölçütü (uzunluk, ülke kodu, 10 haneli "532…", "00" öneki). Kâhin yalnız açık biçimleri kabul eder.
7. Hücrede birden çok numaranın **ayırıcıları** (plan yalnız "waNumber ilkini alır"); kâhin "/", ",", ";" varsayar.
8. **Aynı telefonlu iki farklı cari**: iki ileti mi (şema UNIQUE yalnız batch + account), tek mi.
9. **Çift başlatmanın tanınması**: süre penceresi, aynı seçim mi çakışan cari mi, aynı şablon + dönem mi, iki kullanıcı/sekme. §8 ÇİFT bunları çift sayar, mekanizma yok. Kâhin senaryoda `cift` işaretli başlatmada çakışan cariye ikinci ileti beklemez.
10. **Sonucu Belirsiz'den sonra toplu iş** (`belirsiz_sonrasi`: sürer / durur).
11. **Bağlantı hiç kurulamadı** (`baglanti_kurulamadi`): istek Meta'ya ulaşmadığı kesinken Sonucu Belirsiz mi (W2 "ağ"), geçici hata mı.
12. **Sınıfı planda olmayan kodlar**: 100, 131008, 135000 (§2.7 "parametre", W2'de sınıf yok), 131053 (yüklemede ve gönderimde), 131047, 131048, 131050, 131051, 130497, 131064, 131063, 130403, 133004, 133016, 1, 2, 33, tanınmayan kod ve Meta sınır aşım kodu (D0). Kâhin bu kodlu senaryoyu REDDEDER.
13. Duraklayan toplu işte hatayı alan işin ve bekleyenlerin ekran durumu (kâhin: hepsi "Duraklatıldı", planın durum listesinden — teyit gerekir).
14. **131049 beklemesi**: ekran adı (durum "yalnız ileri" kuralıyla çelişir: Meta Kabul Etti → yeniden bekleme), PDF'in silinip silinmeyeceği (S3 "başarısız = kesin → sil", ama 24 saat sonra yeniden gönderilecek); kancadaki ve eşzamanlı 131049 aynı mı.
15. **Yeniden denemede medya** (`medya_tekrar`: aynı medya kimliği / yeni yükleme) — geçici hata, Devam Et, Yine de Gönder, 131049 sonrası; 131056'da kaç kez 1 dk; geçici bekleme dizisi (30 sn → 15 dk arası); "5 kez art arda" sayacı neyle sıfırlanır, medya yükleme hataları sayılır mı; medya kaç kez yeniden yüklenir.
16. **ÇELİŞKİ — kancası hiç gelmeyen iş** (`kancasiz_son`): "Süresi Doldu (TTL + 1 saat, teslim yok)" ↔ "Durum Bilinmiyor (kanca 7 günde gelmedi)": TTL 3 gün olunca Durum Bilinmiyor'a hiç varılmaz.
17. **Süresi Doldu'dan sonra gelen delivered/read** (`gec_teslim`; Meta 7 gün yeniden dener): yok sayılır mı, Teslim Edildi yazılır mı; durum zamanı kanca `timestamp`'i mi varış mı.
18. delivered/read'den SONRA gelen failed.
19. **"Bu Ay" sayacı** (`teslim_ay`: kabul / teslim ayı): Teslim Edilen durumdan mı (Teslim + Okundu) `pricing.billable`'dan mı; saat dilimi; "Kendime Deneme Gönder" sayılır mı; kapsam şirket mi WABA mı (kâhin İKİ görünümü verir: `bu_ay.sirket`, `bu_ay.waba`); geri yüklemede (şirket dosyasındaysa) azalır mı.
20. Ödeme hatırlatma **{{3}} vade ve {{4}} tutar** kaynağı (en eski gecikmiş taksit mi, toplam vadesi geçmiş mi); vadesi olmayan cari.
21. **{{3}} dönem metninin** ve dosya adındaki `<dönem>`'in biçimi.
22. **Eksi (alacaklı) bakiye metni**; yuvarlama kuralı; ileri tarihli hareketin döneme girmesi; dönem uçları (kâhin iki ucu dahil sayar — W3 fark testi mevcut Cari Ekstre'ye bağlar).
23. **KÖR NOKTA — "{{4}} Güncel bakiye" etiketi**: plan "metinle aynı bakiye" (= PDF'in dönem sonu bakiyesi) der; geçmiş dönem ekstresinde mesaj "Güncel bakiye" diye dönem sonu bakiyesini yazar. Kâhin plan kuralını uygular (dönem sonu).
24. **ÇELİŞKİ — 24 saatten eski toplu iş** (`eski_toplu_sinir`): "kendiliğinden SÜRMEZ" ↔ "250 sınırında birkaç güne yayılan iş": açılışta sınır bekleyen eski iş sorulur mu sürer mi.
25. Lisans yeniden yazılabilir olunca "Lisans Nedeniyle Durdu" işler kendiliğinden sürer mi.
26. Geri yükleme / sıfırlama sonrası durmuş işlerin ekran adı ("Taşınan Veri — Durduruldu" yalnız kimlik uyuşmazlığına yazılmış).
27. Toplu iş **SÜRERKEN şablon Pazarlama'ya alınırsa** (Meta APPROVED kalır, ileti 12 kat ücretle gider): günlük denetimden önce iş durur mu; "günde bir" denetimin saati; şablon kancası yalnız uygulamanın varsayılan adresine gider (Yol 1'de müşterinin uygulaması).
28. Bir kez onay **tekli gönderimde** ve "Kendime Deneme Gönder"de de şart mı.
29. Aynı anda birden çok başlatma reddi nedeni varsa hangisi söylenir (kâhin sırası: bağlı değil → yetki → lisans → onay → şablon).
30. **Meta sınır hatasında "kalanlar 24 saat bekler"** (`sinir_hatasi_kapsam`): o toplu iş mi, aynı WABA'nın bütün işleri mi.
31. Bütün seçilenler elenince boş toplu iş kaydı oluşur mu (kâhin: `bos_toplu`).
32. Hatadan sonra başarılı olan işin hata kodu temizlenir mi (kâhin hata kodunu yalnız Başarısız/Duraklatıldı işte bekler; senaryolar sonradan başarılı işin kodunu denetlemez).

## 6. Programdan okunması gerekecek bilgiler (sürücü — ŞİMDİ YAZILMADI, program uçları yok)

**Kurulum (senaryo girdisi → program):** şirket(ler) + firma unvanı; cariler (ad, telefon, "WhatsApp Mesajı İstemiyor", silme) + hareketler (tarih, borç,
alacak); WhatsApp ayarı (Elle Bağla: belirteç, Phone Number ID, WABA ID, D0'a göre App ID), bir kez onay, elle günlük üst sınır; kullanıcılar ve
`whatsapp.send`; lisansı salt okunur yapma; `config.whatsappGraphUrl` = sahte sunucu; `config.now` (sahte saat) — program ve sahte sunucu AYNI saatte
(`/__sahte/saat`); durum kancası adresi (program kendisi `subscribed_apps` ile kaydediyorsa sahte sunucunun kaydından okunur).

**Eylemler:** toplu gönderim başlatma (seçim SIRASIYLA, şablon ekstre/hatırlatma, dönem {bas, son} ya da tümü; çift tık = aynı isteği iki kez); Duraklat /
Devam Et / İptal Et / Başarısızları Yeniden Dene / Yine de Gönder; programı düzgün kapat/aç; "Gönderiliyor" anında süreci öldür (sahte kural `koptu: "sonra"`
ya da `gecikmeMs` + öldürme; `istek_ulasti: false` için kural `koptu: "once"` ve öldürme); yedek al / geri yükle; Şirket Verisini Sıfırla; veri taşıma
(kurulum kimliği değişimi); cari düzenleme; işçiyi sahte saatle tetikleme (TTL denetimi, 6 saatlik basamak okuma, 131049 ve sınır beklemeleri).

**Okunacaklar:**
- başlatma: başlamadıysa neden; elenenler ve nedeni (telefonsuz, geçersiz, istemiyor, sabit hat, yurt dışı, çift); iş sayısı;
- her iş: cari, telefon (E.164, '+'), şablon adı + dil, değişken değerleri, PDF adı, PDF baytları (sahte sunucu `medya/<id>` → sürücü PDF metninden cari adı,
  dönem, devir, hareket sayısı, dönem sonu bakiye), ekran durumu, hata kodu, wamid, medya kimliği, POST sayısı, kabul/teslim zamanları;
- toplu iş: duraklatıldı mı + neden kodu;
- "Bu Ay Gönderilen İleti Sayısı": Meta Kabul Etti, Teslim Edilen (Ücretli), yaklaşık USD — ay başına, programın gösterdiği kapsamla;
- sınır sayacı: penceredeki farklı alıcı (WABA başına), sonraki açılış;
- sahte sunucu kaydı: alıcı başına POST (deneme dahil), Meta'daki ileti (kabul), medya yükleme/silme, kanca teslimleri, belirteç sızıntısı, geçersiz medyayla
  gönderim denemesi; ayrıca program günlüğü/yanıtları/yedekte belirteç izi (sürücü tarar).

**Eşleme:** kâhin cari kimliği ↔ program cari kimliği; toplu etiketi (T1…) ↔ toplu iş kimliği; iş anahtarı "T1/A" ↔ programın iş kimliği (kancadaki opaque =
programın iş kimliği); `meta_davranis` → sahte kurallar (`mesaj` → `{yol: "messages", to, deneme, yanit}`; `yanitsiz_kabul` → `{koptu: "sonra"}`;
`yanitsiz_red` → `{koptu: "once"}`; `{sinir: true}`; `medya` → `{yol: "media", deneme: n}`; `kanca` → `durumGonder` sahte saatle; `kanca_kuyrugu` →
`kuyruguIsle`; `meta_kapali` → sahte sunucuyu kapat). Sürücü program durumunu kâhinin sonuç yapısında üretir ve seçilen serbest birleşimle
`kahin.py karsilastir` ile karşılaştırır; "ozet_cikti" senaryolarında yalnız toplamlar ve durum sayıları.
