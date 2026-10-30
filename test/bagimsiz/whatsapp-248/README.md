# WhatsApp Otomatik Gönderim — Bağımsız Kâhin ve Sahte Meta Sunucusu (DestekOfis 2.4.8, K0)

Bu klasör, 2.4.8'deki **Meta WhatsApp Cloud API ile toplu gönderimin** (plan `docs/erp/WHATSAPP-API-PLANI-2.4.8.md`, iş listesi `docs/2.4.8-IS-LISTESI.md`
madde K0) bağımsız kâhinidir:

1. **Sahte Meta Graph sunucusu** (`sahte-meta/`, Node, bağımlılıksız `node:http`) — yalnız Meta'nın resmî belgelerinden (30.10.2026 okunan .md sayfaları;
   kopyaları depoya KONMADI). Belgede olmayan her davranış **D0** diye işaretli (aşağıda liste). Gerçek Meta'ya hiçbir istek gitmez (yalnız 127.0.0.1).
2. **Kâhin modeli** (`kahin/kahin.py`, Python, yalnız standart kütüphane — programdan AYRI dil) — toplu gönderimin beklenen sonucu, YALNIZ planın ürün
   kurallarından. İlk sürümde (ec4c8176) planın sustuğu 32 nokta "PLAN SUSUYOR" diye listelenmiş, 15'i serbest seçim olarak iki yönlü verilmişti; plan **§7a**
   (30.10.2026, programın davranışına bakılmadan — ders 40; K1–K3 ürün sahibi, öbürleri baş mimar kararı + ürün sahibi "önerilerin uygun") hepsini kararlaştırdı.
   Kâhin artık bu kararlara **SABİT**: serbest seçim yok (`kahin.SERBEST = {}`), her kuralın kaynak satırında "§7a n". Kararın açık bıraktığı ayrıntılar
   aşağıda "Kâhin yorumları"nda (teyit gerekir).
3. **Senaryo kümesi** (`kahin/senaryolar.py` → `kahin/senaryolar.json`) — 139 senaryo, plan §8 "Nasıl bozulur?" başlıklarının hepsi + §7a kararlarının her biri.

**Bağımsızlık.** Programın kodu (`server/`, `client/`, `bulut/`) GÖRÜLMEDEN yazıldı (KANIT KURALI 2, ders 5). Okunanlar: CLAUDE.md, plan, iş listesi,
araştırma belgesi, Meta belge sayfaları (send-messages, document-messages, media, template-media, components, template-management, template-categorization,
template-quality, error-codes, webhooks overview / override / status reference, messaging-limits, throughput, access-tokens, registration, embedded-signup
implementation / tech-provider onboarding / versions, pricing) ve bu klasörün düzeni için `test/bagimsiz/edm-sayac/` README'si.
Plan §6 K0 klasör olarak `test/sahte-meta/` yazıyor; görev bu klasörü (`test/bagimsiz/whatsapp-248/`) verdi.

**Bağımsızlığın sınırı.** Elle beklenen ile model aynı elden (bu kâhin) çıktı: bağımsızlık PROGRAMA göredir. Kendi içindeki dişi: (a) elle beklenen ↔ model
iki ayrı türetme, (b) mutasyon testi (60 bilerek hata — 23'ü §7a kararlarının tersi —, her biri en az bir senaryoda yakalanıyor), (c) değişmezler (ör. "Bu Ay"
teslim = Teslim + Okundu iş sayısı, başarılı işte hata kodu yok, metin bakiyesi = PDF bakiyesi), (d) beklenen şablon metinleri plan dosyasından okunup
karşılaştırılır (H).

## Dosyalar

| Dosya | İçerik |
|---|---|
| `sahte-meta/sunucu.mjs` | Sahte Graph sunucusu: `sahteMetaBaslat()` + denetim uçları `/__sahte/*`; `node sunucu.mjs --port 0` ayrı süreç |
| `sahte-meta/hatalar.mjs` | Meta hata kataloğu (belgedeki `details` aynen) + D0 HTTP durum eşlemesi + hata gövdesi |
| `sahte-meta/kanca.mjs` | Durum kancası gövdesi (belge biçimi), imza (D0), doğrulama isteği (D0), Meta yeniden deneme kuyruğu (7 gün) |
| `sahte-meta/sunucu.test.mjs` | Sahte sunucunun kendi testleri (node --test, 34) |
| `sahte-meta/mutasyon.mjs` | Testlerin dişi: sunucuya 18 bilerek hata, her biri ayrı geçici kopyada; her biri en az bir testi kırmızı yapmalı |
| `kahin/kahin.py` | Model + komut satırı (`hesapla`, `karsilastir`) |
| `kahin/senaryolar.py` | 139 senaryo (girdi + ELLE beklenen); modelle karşılaştırır, aynıysa `senaryolar.json` yazar |
| `kahin/senaryolar.json` | Her senaryo: girdi, elle beklenen, modelin bütün beklenen sonucu; üstte `sablonlar` (programın açması beklenen 2 şablonun metni, §7a 23 + W5) |
| `kahin/kahin_test.py` | Kâhinin kendi testi (A–H) + mutasyon; TAP + `# tests/pass/fail` |

## Nasıl koşulur (depo kökünden)

```sh
node tools/kanit.mjs kos 248-k0-sabit-sahte-meta -- node --test test/bagimsiz/whatsapp-248/sahte-meta/sunucu.test.mjs
node tools/kanit.mjs kos 248-k0-sabit-sahte-meta-mutasyon -- node test/bagimsiz/whatsapp-248/sahte-meta/mutasyon.mjs   # TMPDIR'de benzersiz kopyalar
node tools/kanit.mjs kos 248-k0-sabit-senaryolar -- python3 -I test/bagimsiz/whatsapp-248/kahin/senaryolar.py   # senaryolar.json (elle ≠ model → yazmaz, çıkış 1)
node tools/kanit.mjs kos 248-k0-sabit-kahin -- python3 -I test/bagimsiz/whatsapp-248/kahin/kahin_test.py
python3 -I test/bagimsiz/whatsapp-248/kahin/kahin.py hesapla senaryo.json
python3 -I test/bagimsiz/whatsapp-248/kahin/kahin.py karsilastir beklenen.json program.json
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

**Girdi** (senaryo): `baslangic` (ISO, yerel saat dilimi), `cariler` (`id, ad, telefon, istemiyor, silindi, pasif, sirket, hareketler[{tarih, borc, alacak}],
vadeler[{vade, kalan}]` — hatırlatma için açık kalemler), `ayar`
(`bagli, onay, gunluk_ust_sinir, lisans_yazilabilir`), `kullanicilar` (`whatsapp.send`), `firmalar`, `wabalar` (şirket → WABA), `meta` (`basamak`, şablon
durum/kategori), `meta_davranis` (`mesaj` alıcı başına n. POST yanıtı; `medya` genel sıra; `kanca` iletiye Meta'nın göndereceği durumlar), `olaylar`
(`baslat` [etiket, seçim SIRASIYLA, şablon, dönem, kullanıcı, `istek` = istek kimliği], `kontrol`, `cari` [telefon / istemiyor / silindi / pasif / ad /
hareket_ekle / vadeler], `kapat`, `ac`, `cokme` [o carinin isteği anında süreç ölür, `istek_ulasti`], `tunel`, `kanca_kuyrugu`, `lisans`, `duraklat`/`devam`/
`iptal`, `basarisizlari_yeniden_dene`, `yine_de_gonder`, `geri_yukle`/`sifirla`/`tasindi`, `meta_basamak`, `meta_sablon` [durum / kategori], `meta_kapali`,
`sahte_kanca` [İMZASIZ olay: `wamid` ya da `is` (gerçek işin wamid'i), `durum`, `kod`, `opaque`]), `ozet_cikti`. `meta_davranis.kanca` olayları Meta'nındır
(kapıcıda imzası doğrulanmış sayılır, §7a 3).

**Çıktı** (beklenen; `[{secimler: [{}], sonuc}]` — serbest seçim kalmadığından TEK grup): `baslamadi` (etiket → neden: `bagli_degil` / `yetki_yok` /
`lisans_salt_okunur` / `onay_yok` / `sablon_uygun_degil`, §7a 29 sırasıyla), `elenen` (etiket → cari → neden: `telefonsuz` / `gecersiz` / `istemiyor` /
`silindi` / `pasif` / `gecikmis_borc_yok` / `zaten_kuyrukta`), `olusmadi` (bütün seçilenler elendiği için kaydı OLUŞMAYAN toplu işler, §7a 31), `ayni_istek`
(aynı istek kimliğiyle gelen başlatma → ilk toplu iş, §7a 9), `toplular` (durum `aktif`/`duraklatildi`/`iptal`; neden: hata kodu, `kullanici` ya da "Şablon
Pazarlama'ya Alındı"), `durum_sayilari`, `isler` ("T1/A" → durum, telefon, şablon, değişkenler, pdf {cari_ad, donem_bas, donem_son, devir, hareket_sayisi,
donem_sonu_bakiye}, dosya_adi {on_ek, son_ek}, hata_kodu, post, kabul, meta_ileti, medya_yukleme, medya_silme, atlanma_nedeni), `meta` (cari başına POST /
programın bildiği kabul / Meta'daki ileti / medya yükleme / silme, toplamlar), `kontroller` (kontrol anında durum sayıları, iş durumları, toplam POST/kabul,
pencere içindeki farklı alıcı, silinen medya), `bu_ay` (§7a 19: WABA → ay (teslim zamanı, Türkiye saati) → {teslim (Teslim + Okundu), yaklasik_usd}),
`degismez` (iç denetim sayaçları; hep 0).

**Yaprak türleri:** düz değer = kesin; `{"biri": [...]}` = zaman serbestliği (program bunlardan biri olmalı; bugünkü 139 senaryoda HİÇ yok — D2 testi);
`{"plan_susuyor": …}` = denetlenmez (yalnız ICERIK-08 "Tüm Hareketler" dönem metni); `{"kisaltilabilir": tam}` = program tam değeri ya da önekini verebilir
(D0 uzunluk sınırı).

**İki uç:** her senaryo 2 kez koşar: işçi adımı ∈ {hızlı 0,5 sn, yavaş 5 sn} (planın "~1 sn"i). Sıra artık plan kuralı (§7a 5, seçim sırası); geçici bekleme
dizisi sabit (§7a 15: 30 sn → 2 dk → 15 dk).
**Ufuk:** benzetim olay kalmayınca ya da başlangıçtan 10 gün sonra biter (senaryoların en geç denetimi +8 gün; TTL 73 sa ve 7 gün kuralı içinde).
"Son durum" = bu ufuktaki durum.

**Planın kâhine aktarılan kuralları** (kaynak satırları kodda): seçim → tek onay; bağlantı / yetki / lisans / onay / şablon (APPROVED + UTILITY) yoksa
BAŞLAMAZ, ret nedeni bu sırayla (§7a 29); telefonsuz / E.164'e çevrilemeyen / İstemiyor / silinmiş / pasif / (hatırlatmada) gecikmiş borcu olmayan / aynı cari +
şablon + dönem için bekleyen ya da gönderilmekte işi olan ("Zaten Kuyrukta", süre penceresi yok, iki kullanıcı/sekme dahil) cari elenir; sabit hat ve yurt dışı
ELENMEZ (K1); aynı telefonlu iki cari iki ileti (K2); aynı istek kimliği tek toplu iş; hepsi elenince toplu iş kaydı oluşmaz; aynı cari bir iş; gönderim sırası =
seçim sırası; iş verisi (telefon, ad, bakiye, PDF) GÖNDERİM ANINDA okunur, kuyrukta İstemiyor/silinmiş/pasif olan "Atlandı"; numara '+' ve ülke koduyla; değişkenler
+ PDF AYNI okumadan, PDF seçilen döneme (devir + dönem hareketleri uçlar dahil + dönem sonu; dönem sonundan sonraki hareket girmez; "Tüm Hareketler" = bütün hesap),
metin bakiyesi = PDF bakiyesi; ekstre {{3}} "01.10.2026 – 31.10.2026", {{4}} dönem sonu bakiyesi (K3 şablonu); hatırlatma {{3}} en eski gecikmiş vade, {{4}} vadesi
geçmiş toplam, {{5}} güncel bakiye; tutar "1.250,00 TL", eksi "1.234,56 TL (Alacaklı)"; değişken tek satır; tek işçi; "Gönderiliyor" istekten önce; yanıtsız →
Sonucu Belirsiz, kendiliğinden yeniden YOK, toplu iş SÜRER; bağlantı hiç kurulamadı → geçici; medya geçerliyse aynısı, yoksa yeniden yüklenir; hesap/şablon hatası
İLK hatada DURAKLAR (hatayı alan Başarısız, bekleyenler Duraklatıldı); alıcı hatası (131026, 131021, 131009) ve sınıfsız/tanınmayan kod o iş Başarısız, sürer;
geçici (131000, 131016, 130429, 80007, 4, 131057, 1, 2, 133004, bağlantı) 30 sn → 2 dk → 15 dk sonra Başarısız, toplu işte 5 art arda (medya hataları dahil,
başarılı gönderimle sıfır) → durur; 131056 → 1 dk; 131049 → "Meta Bekletti", PDF silinmez, 24 saat sonra aynı medyayla en çok bir kez; günlük sınır = min(Meta
basamağı [başlarken + 6 saatte bir okunur], elle üst sınır), kayan 24 saatte "Meta Kabul Etti" olmuş FARKLI alıcı, pencerede sayılmış alıcı geçer, makine düzeyi +
WABA'ya göre (iki şirket aynı WABA → ortak; geri yükleme azaltmaz); sınırda kalanlar "Sınır Nedeniyle Bekliyor", pencere açılınca sürer; Meta sınır hatası ve
131048 → aynı WABA'nın BÜTÜN işleri 24 saat; durum yalnız ileri (read'den sonra delivered, delivered/read'den sonra failed yok sayılır; read = teslim edildi —
Meta); yinelenen kanca etkisiz; Sonucu Belirsiz YALNIZ imzalı olay + iş kimliğiyle çözülür (sayaç ve pencereye girer), imzasız olay düşer; kanca yolu çalışıyorsa
(son 7 günde kanca) TTL 3 gün + 1 saat → Süresi Doldu, çalışmıyorsa "Meta Kabul Etti"de kalır; Süresi Doldu'dan sonra gelen teslim yazılır (zaman = kanca
timestamp'i); kesin durumda (teslim / başarısız / süresi doldu) PDF Meta'dan silinir, bir kez; başarılı işin hata kodu temizlenir; "Başarısızları Yeniden Dene"
yalnız kesin Başarısız; "Yine de Gönder" Sonucu Belirsiz'i yeniden gönderir (çift gidebilir); kapanış: kaldığı yerden sürer, "Gönderiliyor" → Sonucu Belirsiz; 24
saatten eski toplu işte SINIR / Meta Bekletti bekleyeni sürer, öbürü açılışta sorulur; geri yükleme / sıfırlama → "Durduruldu (Geri Yükleme)", taşıma → "Taşınan
Veri — Durduruldu", kendiliğinden sürmez; salt okunur lisans → yeni başlamaz, bekleyenler "Lisans Nedeniyle Durdu", lisans dönünce de kendiliğinden SÜRMEZ, kanca
kabulü sürer; şablon kategorisi toplu iş sürerken saatte bir okunur, MARKETING → iş durur ("Şablon Pazarlama'ya Alındı"); kapalıyken kancayı Meta 7 güne kadar
yeniden dener; "Bu Ay" = TESLİM (Teslim + Okundu), teslim ayı (Türkiye saati), WABA kapsamı, yaklaşık ücret = teslim × 0,0009 USD; bilinmeyen wamid düşer.

## 3. Senaryo kümesi

**139 senaryo** (`kahin/senaryolar.json`): TEMEL 5 · ÇİFT 14 · KAYIP 6 · YANLIŞ KİŞİ 15 · YANLIŞ İÇERİK 12 · HESAP / META 54 (hesap/yetki kodları 9, şablon
hatası gönderimde 7, sınıfsız kodlar 12, şablon başlatmada 7 + sürerken Pazarlama'ya alınma 2, geçici 12, alıcı/131049 5) · ÖLÇEK 10 (300 / 600 / 2.000 / 500 × 9
kanca / 300 + Pazarlama, sınır hatası, 131048) · TARİH 8 (gece yarısı kayan pencere, ay sonu, 1 Ocak yıl dönümü, TTL sonu, kancasız iki yol, 24 saatten eski /
genç iş) · ŞİRKET 3 · GÜVENLİK 12 (ret sırası üç senaryo, imzasız sahte olaylar üç senaryo, lisans dönüşü). Her senaryoda elle beklenen (yalnız plandan) ve
modelin tam sonucu var. Önceki sürüme göre değişen beklentiler: aşağıda §5.

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
11. Medya başlıklı şablonda `example.header_handle` zorunlu ve Resumable Upload'tan; değişkenli gövdede örnek zorunlu (100); "… {{4}}." (noktayla biten) gövde 2388299 SAYILMAZ (sahte sunucunun varsayımı; plan §7a 23 ekstre gövdesini "İyi günler dileriz." ile bitirerek riski kaldırdı).
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

## 5. Plan §7a kararları kâhinde (ilk sürümün "PLAN SUSUYOR" 1–32 listesiyle aynı numaralar)

| § | Karar (plan §7a) | Kâhinde | Senaryo (değişen beklenti) |
|---|---|---|---|
| 1 | Veri GÖNDERİM ANINDA okunur | `uretim_ani` kalktı | KISI-01 (yeni numara), ICERIK-09 (3.000,00 TL), ICERIK-12 |
| 2 | Kuyrukta İstemiyor / silinmiş / pasif → ELENİR ("Atlandı" + neden) | `kuyruk_degisimi` kalktı; durum "Atlandı", `atlanma_nedeni` | KISI-09, KISI-10 (POST 0), KISI-15 |
| 3 | Sonucu Belirsiz yalnız imzalı olay + iş kimliğiyle çözülür; imzasız düşer; çözülen sayaç/pencereye girer | `belirsiz_cozum` kalktı; imzasız sahte olay tümüyle düşer | CIFT-01/04 Teslim Edildi; GUV-06 Sonucu Belirsiz kalır — artık İHLAL DEĞİL, beklenen davranış; GUV-09 |
| 4 | Pencerede sayılmış alıcı GEÇER | `sinir_mevcut_alici` kalktı | SINIR-05 (A Teslim), KISI-12 |
| 5 | Sıra = seçim sırası | ters sıra ucu kalktı | — (hepsi) |
| 6 | (K1) Geçersiz = E.164'e çevrilemeyen; sabit hat / yurt dışı ELENMEZ | `sabit_hat`, `yurtdisi` kalktı; `numara()` 10 hane ve "00" öneki | KISI-05 (131026 → Başarısız), KISI-06, KISI-07, KISI-11 |
| 7 | Ayırıcılar "/", ",", ";", satır sonu | satır sonu eklendi | KISI-14 |
| 8 | (K2) Aynı telefon iki cari → iki ileti | — | KISI-12 (yeni) |
| 9 | Aynı cari + şablon + dönem için bekleyen/gönderilmekte iş varken o cari elenir ("Zaten Kuyrukta"); süre penceresi yok; aynı istek kimliği tek toplu iş | `cift` işareti kalktı; `istek` + `zaten_kuyrukta` | CIFT-06 (`ayni_istek`), CIFT-07 (A'ya İKİNCİ ileti), CIFT-08, CIFT-14 |
| 10 | Sonucu Belirsiz'den sonra toplu iş SÜRER | `belirsiz_sonrasi` kalktı | CIFT-04, CIFT-05 |
| 11 | Bağlantı kurulamadı → geçici | `baglanti_kurulamadi` kalktı; kod "BAGLANTI" | KAYIP-05 (~17,5 dk'da Başarısız), KAYIP-06 |
| 12 | 1, 2, 133004 geçici; 100, 131008, 135000, 131053, 131047, 131050, 131051, 130403, 131064, 131063, 133016, tanınmayan → iş Başarısız, sürer; 131048 + sınır aşımı → bekler | kâhin bu kodlu senaryoları artık REDDETMEZ | HATA-SINIFSIZ-* (12), GECICI-1/2/133004, SINIR-07 |
| 13 | Hatayı alan iş Başarısız (kodlu), bekleyenler Duraklatıldı | — | HESAP-* (B Başarısız, Devam Et ile C), SABLON-GONDERIM-*, GECICI-02 |
| 14 | 131049 → "Meta Bekletti (24 Saat Sonra Yeniden)", PDF silinmez, aynı medya | `PLAN-SUSUYOR:131049-bekleme` kalktı | ALICI-131049-* (medya 1 yükleme) |
| 15 | Medya geçerliyse aynısı; geçici 30 sn → 2 dk → 15 dk sonra Başarısız; "5 art arda" başarıyla sıfırlanır, medya hataları sayılır | `medya_tekrar` kalktı; iş başı deneme sayacı | GECICI-03 (3 hata → kabul), GECICI-03b (4 hata → Başarısız), CIFT-02 |
| 16 | Kanca yolu çalışıyorsa TTL + 1 sa Süresi Doldu, yoksa Meta Kabul Etti'de kalır; "Durum Bilinmiyor" KALKAR | `kancasiz_son` ve "Durum Bilinmiyor" kalktı | KAYIP-02, TARIH-03 (Meta Kabul Etti, PDF silinmez), TARIH-03b (yeni) |
| 17 | Süresi Doldu'dan sonra teslim yazılır; zaman = kanca timestamp'i | `gec_teslim` kalktı | ICERIK-10 (Teslim Edildi) |
| 18 | delivered/read'den sonra failed yok sayılır | — | TEMEL-05 (yeni) |
| 19 | "Bu Ay" = TESLİM (Teslim + Okundu), teslim ayı (Türkiye saati), WABA kapsamı; geri yüklemede azalmaz; Kendime Deneme sayılmaz | `teslim_ay` kalktı; `bu_ay` tek görünüm: WABA → ay → {teslim, yaklasik_usd}; kabul kovası yok | TARIH-01, ICERIK-03/10/11 (teslim ayı), SIRKET-01/02 |
| 20 | Hatırlatma {{3}} en eski gecikmiş vade, {{4}} vadesi geçmiş toplam, {{5}} güncel bakiye; gecikmişi olmayan elenir | `vadeler` girdisi | TEMEL-02, ICERIK-12 |
| 21 | Dönem metni "01.10.2026 – 31.10.2026" | `donem_metni()` | hepsi (eskiden `{"donem": [..]}` yaprağı) |
| 22 | Eksi "1.234,56 TL (Alacaklı)"; 2 ondalık; uçlar dahil; dönem sonundan sonrası girmez | `para()` | ICERIK-06, ICERIK-07 (0,005 → 0,01), ICERIK-02 |
| 23 | (K3) Ekstre gövdesi "… Dönem sonu bakiyesi: {{4}}. İyi günler dileriz." | `kahin.SABLONLAR` + `senaryolar.json` `sablonlar`; H testi plan metniyle karşılaştırır | sahte sunucu testinin şablon fikstürü de güncellendi |
| 24 | 24 saatten eski toplu işte SINIR bekleyeni sürer, öbürü açılışta sorulur | `eski_toplu_sinir` kalktı | TARIH-04 (K1 POST 2), TARIH-05, TARIH-06 |
| 25 | Lisans dönünce "Lisans Nedeniyle Durdu" kendiliğinden SÜRMEZ | Devam Et sürdürür | GUV-08 (yeni) |
| 26 | Geri yükleme/sıfırlama → "Durduruldu (Geri Yükleme)" | `PLAN-SUSUYOR:geri-yukleme-durdu` kalktı | CIFT-12, CIFT-14 |
| 27 | Şablon kategorisi başlarken + sürerken saatte bir; MARKETING → iş durur ("Şablon Pazarlama'ya Alındı") | saatlik okuma | SABLON-PAZARLAMA-ARADA, -SAAT-ICINDE, OLCEK-04 |
| 28 | Onay toplu ve tekli gönderimde şart; Kendime Deneme hariç | tekli/Kendime Deneme modellenmedi | GUV-04 |
| 29 | Ret sırası bağlı değil → yetki → lisans → onay → şablon | — | GUV-10/11/12 (yeni) |
| 30 | Meta sınır hatasında aynı WABA'nın BÜTÜN işleri 24 saat | `sinir_hatasi_kapsam` kalktı | SINIR-04 (T2/E bekler), SIRKET-03 (öbür WABA sürer) |
| 31 | Hepsi elenince toplu iş kaydı OLUŞMAZ | `bos_toplu` → `olusmadi` | KISI-13 |
| 32 | Başarılı işin hata kodu temizlenir | değişmez denetimi (C) | CIFT-09, GECICI-01, SINIR-07, ALICI-131049-bir-kez |

**Kâhin yorumları** (§7a metninin açık bıraktığı ayrıntı; kâhin bir okumayı seçti — programla fark çıkarsa önce bunlar ürün sahibine/baş mimara sorulur, kâhin
programa UYDURULMAZ, ders 40/43):
1. §7a 15 "3 deneme" = 3 YENİDEN deneme (toplam 4 POST; 30 sn, 2 dk, 15 dk beklemeleri; 4. hatada Başarısız — ilk hatadan ~17,5 dk sonra).
2. §7a 15 "5 kez art arda" toplu iş düzeyinde (farklı işlerin ardışık geçici hataları birlikte sayılır); 5. hatayı alan iş Başarısız (§7a 13). Devam Et toplu
   sayacı sıfırlar, iş başı deneme sayacını sıfırlamaz; "Başarısızları Yeniden Dene" sıfırlar.
3. §7a 9 "bekleyen/gönderilmekte" = Bekliyor, Hazırlanıyor, Gönderiliyor, Sınır Nedeniyle Bekliyor, Duraklatıldı, Meta Bekletti, Lisans Nedeniyle Durdu, açılışta
   sorulan ve Sonucu Belirsiz (§7a 10 "belirsiz iş bekler"); Meta Kabul Etti / Gönderildi / kesin durumlar ve Durduruldu (Geri Yükleme) / Taşınan sayılmaz.
   Eşleşme aynı şirket + cari + şablon + dönem.
4. §7a 3 imzasız olay wamid'i bilinse de düşer (GUV-09); §7a 16 "kanca yolu çalışıyor" = aynı WABA'da son 7 günde imzalı ve programın tanıdığı bir iletiye ait
   kanca işlendi.
5. §7a 20 "vadesi geçmiş" = vade < bugün ve kalan > 0 (vadesi bugün olan gecikmiş değil — TEMEL-02 H carisi); {{5}} bugüne kadarki hareketlerin bakiyesi.
6. §7a 22 yuvarlama yarım yukarı (0,005 → 0,01); sıfıra yuvarlanan eksi (−0,004) "0,00 TL" (Alacaklı eki yok).
7. §7a 14 "Meta Bekletti" işi §7a 24'te Sınır gibi kendiliğinden sürer; §7a 26'da durur.
8. §7a 27 saatlik okuma toplu iş başlatıldığı andan saatte bir, bekleyen işi varken; MARKETING görülünce toplu iş durur, bekleyenler Duraklatıldı.
9. §7a 19 Türkiye saati = UTC+3 (yaz saati yok).
10. Bağlantı kurulamadı hatasının kodu kâhinde "BAGLANTI" (Meta kodu yok; programın gösterdiği kod sürücüde eşlenir).
11. §7a 24 "24 saatten eski" = toplu işin başlatıldığı andan; açılışta yalnız "Bekliyor" işler sorulur.
12. §7a 6 geçerli biçimler: "+" ile 8–15 hane; "00" öneki; 0 + 10 hane, 90 + 10 hane ve 10 hane (ilk hane 0 değil) → Türkiye (Meta da "+"sız numaraya işletme ülke
    kodunu ekler); "+90" ile 12 hane dışı geçersiz.
13. §7a 2 "pasif" cari silinmiş gibi elenir (neden "pasif").
14. Yanıtsız medya yüklemesi beklemeden yeniden denenir (W2), ama "5 art arda"ya sayılır.

**Kararların sonuçları** (kâhin bunları BEKLER; ürün sahibine bildirilmesi gerekenler):
- §7a 9 (süre penceresi yok): gönderilmiş (Meta Kabul Etti / Teslim Edildi) cari aynı şablon + dönemle yeniden seçilirse İKİNCİ ileti gider (CIFT-07; iki sekmede
  ilki bitmişse de). Yalnız bekleyen iş korunur.
- §7a 27 (saatte bir): kategori MARKETING'e geçtikten sonra en çok ~1 saat ileti gider ve Meta'nın Pazarlama ücretiyle (0,0109 USD) ücretlenebilir
  (SABLON-PAZARLAMA-SAAT-ICINDE).
- §7a 15: ~17,5 dakikalık internet kesintisinde iş Başarısız olur; üç ya da daha çok işte 5. hatada toplu iş durur (KAYIP-05/06) — "Başarısızları Yeniden Dene" gerekir.
- §7a 16: kanca yolu hiç çalışmayan kurulumda (ör. tünel kapalı, kanca kaydı yapılmamış) iş "Meta Kabul Etti"de kalır ve PDF Meta'dan program tarafından silinmez
  (Meta medyayı 30 günde kendisi siler) (TARIH-03, KAYIP-02).

**Hâlâ planda olmayan** (kâhin denetlemez ya da modellemez): "Tüm Hareketler"de {{3}} dönem metni (ICERIK-08, `plan_susuyor` yaprağı); §7a 24'te açılışta sorulan
işin ekran durumu adı (kâhin iç adı `PLAN-SUSUYOR:24-saatten-eski-devam-sorusu`, TARIH-05); PDF dosya adındaki dönemin biçimi (§7a 21 "mevcut düzen + dönem";
kâhin yalnız "Ekstre <ad> " öneki ve ".pdf" soneki); Devam Et'te şablon kategorisinin yeniden okunup okunmadığı; tekli gönderim ve "Kendime Deneme Gönder"
(§7a 19/28) senaryosuz.

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
- başlatma: başlamadıysa neden; elenenler ve nedeni (telefonsuz, geçersiz, istemiyor, silindi, pasif, gecikmiş borç yok, zaten kuyrukta); toplu iş kaydı
  oluşmadıysa bunun bilgisi; aynı istek kimliği tanındıysa hangi toplu işe bağlandığı; iş sayısı;
- her iş: cari, telefon (E.164, '+'), şablon adı + dil, değişken değerleri, PDF adı, PDF baytları (sahte sunucu `medya/<id>` → sürücü PDF metninden cari adı,
  dönem, devir, hareket sayısı, dönem sonu bakiye), ekran durumu, hata kodu, wamid, medya kimliği, POST sayısı, kabul/teslim zamanları;
- toplu iş: duraklatıldı mı + neden kodu;
- "Bu Ay Gönderilen İleti Sayısı": teslim edilen (Teslim + Okundu) ve yaklaşık USD — WABA ve ay (teslim ayı) başına;
- sınır sayacı: penceredeki farklı alıcı (WABA başına), sonraki açılış;
- sahte sunucu kaydı: alıcı başına POST (deneme dahil), Meta'daki ileti (kabul), medya yükleme/silme, kanca teslimleri, belirteç sızıntısı, geçersiz medyayla
  gönderim denemesi; ayrıca program günlüğü/yanıtları/yedekte belirteç izi (sürücü tarar).

**Eşleme:** kâhin cari kimliği ↔ program cari kimliği; toplu etiketi (T1…) ↔ toplu iş kimliği; iş anahtarı "T1/A" ↔ programın iş kimliği (kancadaki opaque =
programın iş kimliği); `meta_davranis` → sahte kurallar (`mesaj` → `{yol: "messages", to, deneme, yanit}`; `yanitsiz_kabul` → `{koptu: "sonra"}`;
`yanitsiz_red` → `{koptu: "once"}`; `{sinir: true}`; `medya` → `{yol: "media", deneme: n}`; `kanca` → `durumGonder` sahte saatle; `kanca_kuyrugu` →
`kuyruguIsle`; `meta_kapali` → sahte sunucuyu kapat; `sahte_kanca` → `kanca/ham` İMZASIZ). Sürücü program durumunu kâhinin sonuç yapısında üretir ve
`kahin.py karsilastir` ile karşılaştırır; "ozet_cikti" senaryolarında yalnız toplamlar ve durum sayıları.
