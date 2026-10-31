# WhatsApp Otomatik Gönderim — Bağımsız Kâhin ve Sahte Meta Sunucusu (DestekOfis 2.4.8, K0)

Bu klasör, 2.4.8'deki **Meta WhatsApp Cloud API ile toplu gönderimin** (plan `docs/erp/WHATSAPP-API-PLANI-2.4.8.md`, iş listesi `docs/2.4.8-IS-LISTESI.md`
madde K0) bağımsız kâhinidir:

1. **Sahte Meta Graph sunucusu** (`sahte-meta/`, Node, bağımlılıksız `node:http`) — yalnız Meta'nın resmî belgelerinden (30.10.2026 okunan .md sayfaları;
   kopyaları depoya KONMADI). Belgede olmayan her davranış **D0** diye işaretli (aşağıda liste). Gerçek Meta'ya hiçbir istek gitmez (yalnız 127.0.0.1).
2. **Kâhin modeli** (`kahin/kahin.py`, Python, yalnız standart kütüphane — programdan AYRI dil) — toplu gönderimin beklenen sonucu, YALNIZ planın ürün
   kurallarından. İlk sürümde (ec4c8176) planın sustuğu 32 nokta "PLAN SUSUYOR" diye listelenmiş, 15'i serbest seçim olarak iki yönlü verilmişti; plan **§7a**
   (30.10.2026, programın davranışına bakılmadan — ders 40; K1–K3 ürün sahibi, öbürleri baş mimar kararı + ürün sahibi "önerilerin uygun") hepsini kararlaştırdı.
   Kâhin artık bu kararlara **SABİT**: serbest seçim yok (`kahin.SERBEST = {}`), her kuralın kaynak satırında "§7a n". Kararın açık bıraktığı ayrıntılar
   aşağıda "Kâhin yorumları"nda (teyit gerekir). §7a'nın **revizyonu R1–R3** (30.10.2026 15:18 UTC, plan §7a sonu "REVİZYON ÖNERİSİ" + KARAR, programın
   davranışı görülmeden) da sabit: R1 Meta'ya hiç ulaşılamıyorsa "Bağlantı Bekleniyor", R2 kategori her 100 iletide / en geç 10 dakikada, R3 daha önce
   gönderilmiş dönem uyarısı (varsayılan Bunları Çıkar).
3. **Senaryo kümesi** (`kahin/senaryolar.py` → `kahin/senaryolar.json`) — 179 senaryo: 145 (plan §8 "Nasıl bozulur?" başlıklarının hepsi + §7a kararlarının ve R1–R3'ün her biri)
   + 34 **kâhin güncellemesi 2** (31.10.2026, ürün sahibi kararları K1–K8; §7).

**Bağımsızlık.** Programın kodu (`server/`, `client/`, `bulut/`) GÖRÜLMEDEN yazıldı (KANIT KURALI 2, ders 5). Okunanlar: CLAUDE.md, plan, iş listesi,
araştırma belgesi, Meta belge sayfaları (send-messages, document-messages, media, template-media, components, template-management, template-categorization,
template-quality, error-codes, webhooks overview / override / status reference, messaging-limits, throughput, access-tokens, registration, embedded-signup
implementation / tech-provider onboarding / versions, pricing) ve bu klasörün düzeni için `test/bagimsiz/edm-sayac/` README'si.
Plan §6 K0 klasör olarak `test/sahte-meta/` yazıyor; görev bu klasörü (`test/bagimsiz/whatsapp-248/`) verdi.

**Bağımsızlığın sınırı.** Elle beklenen ile model aynı elden (bu kâhin) çıktı: bağımsızlık PROGRAMA göredir. Kendi içindeki dişi: (a) elle beklenen ↔ model
iki ayrı türetme, (b) mutasyon testi (97 bilerek hata — 30'u §7a kararlarının ya da R1–R3'ün tersi, 30'u K1–K8'in tersi (M68–M97) —, her biri en az bir senaryoda yakalanıyor), (c) değişmezler (ör. "Bu Ay"
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
| `kahin/senaryolar.py` | 179 senaryo (girdi + ELLE beklenen); modelle karşılaştırır, aynıysa `senaryolar.json` yazar |
| `kahin/senaryolar.json` | Her senaryo: girdi, elle beklenen, modelin bütün beklenen sonucu; üstte `sablonlar` (programın açması beklenen 2 şablonun metni, §7a 23 + W5) |
| `kahin/kahin_test.py` | Kâhinin kendi testi (A–H) + mutasyon; TAP + `# tests/pass/fail` |

## Nasıl koşulur (depo kökünden)

```sh
node tools/kanit.mjs kos 248-k0-r13-sahte-meta -- node --test test/bagimsiz/whatsapp-248/sahte-meta/sunucu.test.mjs
node tools/kanit.mjs kos 248-k0-r13-sahte-meta-mutasyon -- node test/bagimsiz/whatsapp-248/sahte-meta/mutasyon.mjs   # TMPDIR'de benzersiz kopyalar
node tools/kanit.mjs kos 248-k0-r13-senaryolar -- python3 -I test/bagimsiz/whatsapp-248/kahin/senaryolar.py   # senaryolar.json (elle ≠ model → yazmaz, çıkış 1)
node tools/kanit.mjs kos 248-k0-r13-kahin -- python3 -I test/bagimsiz/whatsapp-248/kahin/kahin_test.py
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
(`baslat` [etiket, seçim SIRASIYLA, şablon, dönem, kullanıcı, `istek` = istek kimliği, `onceki` = R3 uyarısındaki seçim "cikar" (varsayılan) / "gonder"], `kontrol`, `cari` [telefon / istemiyor / silindi / pasif / ad /
hareket_ekle / vadeler], `kapat`, `ac`, `cokme` [o carinin isteği anında süreç ölür, `istek_ulasti`], `tunel`, `kanca_kuyrugu`, `lisans`, `duraklat`/`devam`/
`iptal`, `basarisizlari_yeniden_dene`, `yine_de_gonder`, `geri_yukle`/`sifirla`/`tasindi`, `meta_basamak`, `meta_sablon` [durum / kategori], `meta_kapali`,
`sahte_kanca` [İMZASIZ olay: `wamid` ya da `is` (gerçek işin wamid'i), `durum`, `kod`, `opaque`]), `ozet_cikti`. `meta_davranis.kanca` olayları Meta'nındır
(kapıcıda imzası doğrulanmış sayılır, §7a 3).

**Çıktı** (beklenen; `[{secimler: [{}], sonuc}]` — serbest seçim kalmadığından TEK grup): `baslamadi` (etiket → neden: `bagli_degil` / `yetki_yok` /
`lisans_salt_okunur` / `onay_yok` / `sablon_uygun_degil`, §7a 29 sırasıyla), `elenen` (etiket → cari → neden: `telefonsuz` / `gecersiz` / `istemiyor` /
`silindi` / `pasif` / `gecikmis_borc_yok` / `zaten_kuyrukta` / `daha_once_gonderildi`), `onceki_uyari` (R3: etiket → {sayi, son (son kabulün
günü)}), `olusmadi` (bütün seçilenler elendiği için kaydı OLUŞMAYAN toplu işler, §7a 31), `ayni_istek`
(aynı istek kimliğiyle gelen başlatma → ilk toplu iş, §7a 9), `toplular` (durum `aktif`/`duraklatildi`/`baglanti_bekleniyor`/`iptal`; neden: hata kodu, `kullanici`,
"Şablon Pazarlama'ya Alındı" ya da "Bağlantı Bekleniyor"), `durum_sayilari`, `isler` ("T1/A" → durum, telefon, şablon, değişkenler, pdf {cari_ad, donem_bas, donem_son, devir, hareket_sayisi,
donem_sonu_bakiye}, dosya_adi {on_ek, son_ek}, hata_kodu, post, kabul, meta_ileti, medya_yukleme, medya_silme, atlanma_nedeni), `meta` (cari başına POST /
programın bildiği kabul / Meta'daki ileti / medya yükleme / silme, toplamlar), `kontroller` (kontrol anında durum sayıları, iş durumları, toplam POST/kabul,
pencere içindeki farklı alıcı, silinen medya, toplu iş durumları), `bu_ay` (§7a 19: WABA → ay (teslim zamanı, Türkiye saati) → {teslim (Teslim + Okundu), yaklasik_usd}),
`degismez` (iç denetim sayaçları; hep 0).

**Yaprak türleri:** düz değer = kesin; `{"biri": [...]}` = zaman serbestliği (program bunlardan biri olmalı; bugünkü 179 senaryoda HİÇ yok — D2 testi); `{"secenek": [...], "susuyor": neden}` = karar metni hangisi olduğunu söylemiyor (§7; program seçeneklerden biri olmalı);
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
metin bakiyesi = PDF bakiyesi; aynı cari + şablon + dönem daha önce gönderilmişse (Meta Kabul Etti ve sonrası) uyarı, varsayılan çıkarılır
("Daha Önce Gönderildi"), "Yine de Gönder" bayrağıyla gider (R3); ekstre {{3}} "01.10.2026 – 31.10.2026", {{4}} dönem sonu bakiyesi (K3 şablonu); hatırlatma {{3}} en eski gecikmiş vade, {{4}} vadesi
geçmiş toplam, {{5}} güncel bakiye; tutar "1.250,00 TL", eksi "1.234,56 TL (Alacaklı)"; değişken tek satır; tek işçi; "Gönderiliyor" istekten önce; yanıtsız →
Sonucu Belirsiz, kendiliğinden yeniden YOK, toplu iş SÜRER; bağlantı hiç kurulamadı → iş Başarısız sayılmaz, deneme sayacı artmaz,
toplu iş "Bağlantı Bekleniyor", bağlantı dönünce kendiliğinden sürer (R1); medya geçerliyse aynısı, yoksa yeniden yüklenir; hesap/şablon hatası
İLK hatada DURAKLAR (hatayı alan Başarısız, bekleyenler Duraklatıldı); alıcı hatası (131026, 131021, 131009) ve sınıfsız/tanınmayan kod o iş Başarısız, sürer;
Meta'nın yanıt verdiği geçici hata (131000, 131016, 130429, 80007, 4, 131057, 1, 2, 133004) 30 sn → 2 dk → 15 dk sonra Başarısız, toplu işte 5 art arda (medya hataları dahil,
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
kabulü sürer; şablon kategorisi toplu iş sürerken her 100 iletide ve en geç 10 dakikada bir okunur (R2), MARKETING → iş durur ("Şablon Pazarlama'ya Alındı"); kapalıyken kancayı Meta 7 güne kadar
yeniden dener; "Bu Ay" = TESLİM (Teslim + Okundu), teslim ayı (Türkiye saati), WABA kapsamı, yaklaşık ücret = teslim × 0,0009 USD; bilinmeyen wamid düşer.

## 3. Senaryo kümesi

**145 senaryo** (`kahin/senaryolar.json`): TEMEL 5 · ÇİFT 18 (R3: 4) · KAYIP 7 (R1: 3) · YANLIŞ KİŞİ 15 · YANLIŞ İÇERİK 12 · HESAP / META 54 (hesap/yetki kodları 9, şablon
hatası gönderimde 7, sınıfsız kodlar 12, şablon başlatmada 7 + sürerken Pazarlama'ya alınma 2, geçici 12, alıcı/131049 5) · ÖLÇEK 11 (300 / 600 / 2.000 / 500 × 9
kanca / 300 + Pazarlama / 300 + Pazarlama 100 iletide, sınır hatası, 131048) · TARİH 8 (gece yarısı kayan pencere, ay sonu, 1 Ocak yıl dönümü, TTL sonu, kancasız iki yol, 24 saatten eski /
genç iş) · ŞİRKET 3 · GÜVENLİK 12 (ret sırası üç senaryo, imzasız sahte olaylar üç senaryo, lisans dönüşü). Her senaryoda elle beklenen (yalnız plandan) ve
modelin tam sonucu var. Önceki sürümlere göre değişen beklentiler: aşağıda §5.

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
| 9 | Aynı cari + şablon + dönem için bekleyen/gönderilmekte iş varken o cari elenir ("Zaten Kuyrukta"); süre penceresi yok; aynı istek kimliği tek toplu iş. **R3:** daha önce gönderilmişse (Meta Kabul Etti ve sonrası) uyarı, varsayılan "Bunları Çıkar", açık "Yine de Gönder" bayrağıyla gider | `cift` işareti kalktı; `istek` + `zaten_kuyrukta`; R3 `onceki`, `daha_once_gonderildi`, `onceki_uyari` | CIFT-06 (`ayni_istek`), CIFT-07 (R3: A çıkarılır, T2 oluşmaz), CIFT-07b (bayrakla A'ya ikinci ileti), CIFT-08, CIFT-14, CIFT-15/16/17 (yeni) |
| 10 | Sonucu Belirsiz'den sonra toplu iş SÜRER | `belirsiz_sonrasi` kalktı | CIFT-04, CIFT-05 |
| 11 | Bağlantı kurulamadı → geçici. **R1:** iş Başarısız sayılmaz, deneme sayacı artmaz; toplu iş "Bağlantı Bekleniyor", bağlantı dönünce kendiliğinden sürer | `baglanti_kurulamadi` kalktı; `baglanti_bekleniyor` | KAYIP-05 (Başarısız değil, dönünce Teslim), KAYIP-06 (üçü gider), KAYIP-07 (yeni) |
| 12 | 1, 2, 133004 geçici; 100, 131008, 135000, 131053, 131047, 131050, 131051, 130403, 131064, 131063, 133016, tanınmayan → iş Başarısız, sürer; 131048 + sınır aşımı → bekler | kâhin bu kodlu senaryoları artık REDDETMEZ | HATA-SINIFSIZ-* (12), GECICI-1/2/133004, SINIR-07 |
| 13 | Hatayı alan iş Başarısız (kodlu), bekleyenler Duraklatıldı | — | HESAP-* (B Başarısız, Devam Et ile C), SABLON-GONDERIM-*, GECICI-02 |
| 14 | 131049 → "Meta Bekletti (24 Saat Sonra Yeniden)", PDF silinmez, aynı medya | `PLAN-SUSUYOR:131049-bekleme` kalktı | ALICI-131049-* (medya 1 yükleme) |
| 15 | Medya geçerliyse aynısı; geçici 30 sn → 2 dk → 15 dk sonra Başarısız (R1: yalnız Meta'nın yanıt verdiği hatada); "5 art arda" başarıyla sıfırlanır, medya hataları sayılır | `medya_tekrar` kalktı; iş başı deneme sayacı | GECICI-03 (3 hata → kabul), GECICI-03b (4 hata → Başarısız), CIFT-02, KAYIP-07 |
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
| 27 | Şablon kategorisi başlarken + sürerken (**R2:** her 100 iletide ve en geç 10 dakikada bir); MARKETING → iş durur ("Şablon Pazarlama'ya Alındı") | okuma sayacı + 10 dk zamanlayıcı | SABLON-PAZARLAMA-ARADA, SABLON-PAZARLAMA-10-DK (B gönderilmez), OLCEK-04, OLCEK-05 (100 iletide durur) |
| 28 | Onay toplu ve tekli gönderimde şart; Kendime Deneme hariç | tekli/Kendime Deneme modellenmedi | GUV-04 |
| 29 | Ret sırası bağlı değil → yetki → lisans → onay → şablon | — | GUV-10/11/12 (yeni) |
| 30 | Meta sınır hatasında aynı WABA'nın BÜTÜN işleri 24 saat | `sinir_hatasi_kapsam` kalktı | SINIR-04 (T2/E bekler), SIRKET-03 (öbür WABA sürer) |
| 31 | Hepsi elenince toplu iş kaydı OLUŞMAZ | `bos_toplu` → `olusmadi` | KISI-13 |
| 32 | Başarılı işin hata kodu temizlenir | değişmez denetimi (C) | CIFT-09, GECICI-01, SINIR-07, ALICI-131049-bir-kez |

**Kâhin yorumları** (§7a metninin açık bıraktığı ayrıntı; kâhin bir okumayı seçti — programla fark çıkarsa önce bunlar ürün sahibine/baş mimara sorulur, kâhin
programa UYDURULMAZ, ders 40/43):
1. §7a 15 "3 deneme" = 3 YENİDEN deneme (toplam 4 POST; 30 sn, 2 dk, 15 dk beklemeleri; 4. hatada Başarısız — ilk hatadan ~17,5 dk sonra). R1'in
   "(5xx, 1, 2, 133004)" listesi örnek sayıldı: Meta'nın yanıt verdiği bütün geçici kodlar (130429, 80007, 4, 131057 dahil) bu diziyle işlenir.
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
8. §7a 27 + R2: okuma bekleyen işi olan toplu işte; "ileti" = Meta Kabul Etti olan ileti (toplu iş başına sayılır); 100. iletiden sonra, sıradaki gönderimden
   ÖNCE okunur; her okuma hem sayacı hem 10 dakikalık süreyi baştan başlatır; MARKETING görülünce toplu iş durur, bekleyenler Duraklatıldı.
9. §7a 19 Türkiye saati = UTC+3 (yaz saati yok).
10. R1: "Bağlantı Bekleniyor" toplu işin durumu; işler "Bekliyor"da kalır, hata kodu yazılmaz; bağlantı dönünce kâhin HEMEN sürdürür (programın bağlantıyı
    yoklama aralığı serbest — denetimler dönüşten en az 30 dk sonra); bağlantı hataları "5 art arda"ya sayılmaz.
11. §7a 24 "24 saatten eski" = toplu işin başlatıldığı andan; açılışta yalnız "Bekliyor" işler sorulur.
12. §7a 6 geçerli biçimler: "+" ile 8–15 hane; "00" öneki; 0 + 10 hane, 90 + 10 hane ve 10 hane (ilk hane 0 değil) → Türkiye (Meta da "+"sız numaraya işletme ülke
    kodunu ekler); "+90" ile 12 hane dışı geçersiz.
13. §7a 2 "pasif" cari silinmiş gibi elenir (neden "pasif").
14. Yanıtsız medya yüklemesi beklemeden yeniden denenir (W2), ama "5 art arda"ya sayılır.
15. R3 "Meta Kabul Etti ve sonrası" = Meta Kabul Etti, Gönderildi, Teslim Edildi, Okundu; Süresi Doldu ve Başarısız "gönderilmiş" SAYILMAZ (CIFT-15, CIFT-16) — K3 (P3) ile ürün sahibi kararı oldu;
    uyarıdaki "son tarih" = o carilere ait son kabulün günü; ~~R3 yalnız dönemli ekstrede uygulanır~~ → kâhin güncellemesi 2: K1 (★5) ile Ödeme Hatırlatma'da da
    "aynı (yerel) gün" uygulanır; Tüm Hareketler'de de (aynı seçim, 7 gün) — §7.

**Kararların sonuçları** (kâhin bunları BEKLER; ürün sahibine bildirilmesi gerekenler):
- R3 sonrası: gönderilmiş cari aynı şablon + dönemle yeniden seçilirse varsayılan çıkarılır; ikinci ileti yalnız açık "Yine de Gönder" ile (CIFT-07 / 07b).
  Süresi Doldu ya da Başarısız olmuş cari uyarısız yeniden gider (kâhin yorumu 15).
- R2 sonrası: kategori MARKETING'e geçtikten sonra en çok 100 ileti (≈ 1,09 USD) ya da 10 dakika gönderim sürer (OLCEK-05, SABLON-PAZARLAMA-10-DK).
- R1 sonrası: internet kesintisinde iş Başarısız olmaz, toplu iş bekler. Meta'nın kendisi ~17,5 dakika boyunca 5xx/1/2/133004 dönerse iş yine Başarısız olur;
  toplu işte 5 art arda hatada durur (GECICI-02, GECICI-03b).
- §7a 16: kanca yolu hiç çalışmayan kurulumda (ör. tünel kapalı, kanca kaydı yapılmamış) iş "Meta Kabul Etti"de kalır ve PDF Meta'dan program tarafından silinmez
  (Meta medyayı 30 günde kendisi siler) (TARIH-03, KAYIP-02).

**Hâlâ planda olmayan** (kâhin denetlemez ya da modellemez): "Tüm Hareketler"de {{3}} dönem metni (ICERIK-08, `plan_susuyor` yaprağı); §7a 24'te açılışta sorulan
işin ekran durumu adı (kâhin iç adı `PLAN-SUSUYOR:24-saatten-eski-devam-sorusu`, TARIH-05); PDF dosya adındaki dönemin biçimi (§7a 21 "mevcut düzen + dönem";
kâhin yalnız "Ekstre <ad> " öneki ve ".pdf" soneki); R3'ün dönemsiz ödeme hatırlatmasına uygulanıp uygulanmadığı (kâhin: uygulamaz,
senaryosuz); R1'de "Bağlantı Bekleniyor" sırasında işlerin ekran durumu (kâhin: Bekliyor) ve programın bağlantıyı yoklama aralığı; Devam Et'te şablon kategorisinin yeniden okunup okunmadığı; tekli gönderim ve "Kendime Deneme Gönder"
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

## 7. Kâhin güncellemesi 2 — ürün sahibi kararları K1–K8 (31.10.2026)

**Kaynak ve bağımsızlık.** Programın kodu (`server/`, `client/`, `bulut/`, `test/whatsapp-*.test.mjs`, `test/e2e/`) bu güncellemede de GÖRÜLMEDİ. Kurallar yalnız
kullanıcının 31.10.2026 karar metinlerinden (AYNEN `kahin.KARARLAR`'da ve `senaryolar.json` "kararlar" alanında; kaynak CLAUDE.md "Açık iş" KARAR satırları +
`docs/2.4.8-IS-LISTESI.md`) ve ana oturumun görev metnindeki K1–K8 özetinden türetildi. Karar metninin bir kısmı kullanıcının değil baş mimarın / ana oturumun
okuması — `KARARLAR[k]["kaynak_turu"]` bunu yazar ve aşağıdaki **KÂHİN SUSUYOR** listesine girer (ders 40). Sürücü (`surucu.mjs`) okundu (yalnız HTTP uçları),
programa karşı KOŞULMADI (görev: düzeltme ajanı sürüyor; hedef commit sonra bildirilecek).

**Eski beklentiler değişmedi.** 145 eski senaryonun modelin TAM sonucu bayt bayt aynı (karşılaştırma `git show HEAD:…/senaryolar.json` ile; I4 testi eski
senaryolarda yeni yaprak/alan olmadığını denetler). Yeni kurallar yalnız yeni durumlarda (hazır dönem seçimi, Tüm Hareketler / hatırlatma tekrarı, etiketli yeniden
deneme, teslimsiz kapanan işe geç teslim, yedek dönüşü, liste) devreye giriyor.

### 7.1 Kurallar (kâhinde)

| Karar | Kural (kâhin) | Kod |
|---|---|---|
| K1 | Dönem eşliği: Bu Ay / Geçen Ay → gösterdikleri **takvim ayı** ("ay", YYYY-AA; seçim adı fark etmez); Son 3 Ay / Tüm Hareketler → **aynı seçim** + önceki gönderim son **7 gün** içinde (kayan 7 × 24 sa); özel aralık **birebir** (bas, son); Ödeme Hatırlatma → **aynı yerel gün** (★5). "Daha Önce Gönderildi" (R3) ve "Zaten Kuyrukta" aynı eşlikle | `donem_coz`, `eslesir`, `kuyrukta` |
| K2 | Son 3 Ay / Tüm Hareketler'de kuyrukta aynı seçimle bekleyen iş varsa kişi bekleyen işin **yaşına bakılmadan** "Zaten Kuyrukta" | `kuyrukta` (7 gün yok) |
| K3 | Süresi Doldu ve Başarısız (teslim yok) "Daha Önce Gönderildi" **sayılmaz**; o iletiye sonradan delivered/read gelirse **sayılır** | `sayilir` |
| K4 | Yeniden Dene / Yine de Gönder **asıl işin döneminde** (dönem başlatmada çözülür, taşınır; eşlik anahtarı da) | `Toplu.coz`, `tasi` |
| K5 | Asıl iş "Yine de Gönder" ile açıldıysa bu karar Başarısızları Yeniden Dene'ye ve işteki Yine de Gönder'e **taşınır**: yalnız asıl işin **açılışından önceki** gönderimler yok sayılır; açılıştan **sonra** başka işle aynı kişiye aynı dönem giden yine elenir; "sonra" **programın saatiyle** (çözülen belirsiz iletide gönderim anı, Meta'nın bildirim saati değil). Karar yoksa sınır yok | `karar_siniri`, `onceden_gonderildi(sinir)` |
| K6 | Başarısızları Yeniden Dene'de önceki iletisi **Sonucu Belirsiz** kalan kişi "Sonucu Belirsiz" nedeniyle elenir; K5 sınırı bu elemeye **uygulanmaz** (açılıştan önce belirsiz kalan da eler); öneri: iş dosyada duruyorsa **yalnız işteki Yine de Gönder**, iş dosyada yoksa (geri yükleme sonrası) **yeni gönderim**; işteki Yine de Gönder bu elemeye takılmaz | `belirsiz_kaynagi`, `yeniden_dene` |
| K7 | Meta Bekletti (131049): 2. denemesi reddedilen, **iptal** edilen, **geri yükleme / taşıma** ile duran (teslim yok) "Daha Önce Gönderildi" **sayılmaz**; geç delivered/read gelirse **sayılır** | `sayilir`, `kanca_isle` |
| K8 | Gönderimler: **en yeni önce**, **30'ar** sayfa, **imleçli** Daha Fazla Göster (araya yeni gönderim girince sayfa kaymaz), Başlangıç/Bitiş **yerel gün, iki uç dahil**, Başlangıç > Bitiş **ret** | `liste` |

Yeni iç yapı: her gönderim denemesi ("Gönderiliyor" anında açılan talep) `kayitlar`'da; **makine defteri** (`defter`) geri yüklemede kalır, taşımada yeni makinede boş
başlar; R3 / Sonucu Belirsiz denetimi = makine defteri ∪ şirket dosyasındaki işlerin kendi denemeleri (kâhin yorumu 18). `yedek_al` / `geri_yukle {yedek}` önceden
alınmış yedeğe dönüş (yedekten sonra açılan işler dosyadan çıkar; Meta'daki iletileri, "Bu Ay" ve defter kalır).

**Yeni olay / çıktı alanları** (yalnız kullanıldığında çıktıya girer — eski senaryolar etkilenmez): dönem `{"secim": "bu_ay"|"gecen_ay"|"son_3_ay"}`;
`basarisizlari_yeniden_dene {etiket, hedef: "asil"}` ve `yine_de_gonder {etiket}` → `yeniden.<etiket> = {elenen: {cari: neden}, alinan: [cari], oneri:
"isteki_yine_de_gonder"|"yeni_gonderim"|null}` (neden: `daha_once_gonderildi` / `sonucu_belirsiz`); `yedek_al {ad}`, `geri_yukle {yedek}`; `liste {ad, bas, son,
devam}` → `listeler.<ad> = {etiketler, daha_fazla}` ya da `{ret: "bas_son_ters"}`; `bitis` (ufuk).

### 7.2 Senaryolar (34) ve mutasyonlar (30)

| Karar | Senaryolar | Sınır | Mutasyon (yakalayan) |
|---|---|---|---|
| K1 | K1-01 ay sonu Bu Ay → 1'i Geçen Ay · K1-02 31.12 → 01.01 · K1-03 yarım ay Bu Ay → tam ay Geçen Ay (+ Yine de Gönder) · K1-04 Zaten Kuyrukta ay dönümü (23:00 → 00:30) · K1-05 Son 3 Ay 6./8. gün + Tüm ≠ Son 3 Ay · K1-06 Tüm Hareketler 6g23s / 8g1s · K1-07 hatırlatma aynı yerel gün (23:50 / 23:55 / 00:10 — UTC'de aynı gün) · K1-08 hatırlatma Zaten Kuyrukta · K1-09 Bu Ay ≠ Geçen Ay (farklı ay) · K1-10 özel aralık birebir | ay sonu, yıl dönümü, 6./8. gün, gece yarısı, UTC/yerel | M68 K1-01, M69 K1-03, M70/M71/M75 K1-05, M73/M74 K1-07, M96 K1-09 |
| K2 | K2-01 Son 3 Ay 8 gündür duraklatılmış · K2-02 Tüm Hareketler 9 gün + iptalden sonra gider | 8./9. gün | M72 K2-01 |
| K3 | K3-01 Başarısız sayılmaz (ay dönümü) · K3-02 Meta Bekletti 2. deneme reddi + geç teslim sayılır | — | M76 K3-02 (M67 eski) |
| K4 | K4-01 31.10 Bu Ay → 01.11 yeniden deneme Ekim ekstresi · K4-02 31.12 → 01.01 · K4-03 Son 3 Ay Yine de Gönder seçimi taşır | ay sonu, yıl dönümü | M87 K4-01, M88 K4-03 |
| K5 | K5-01 karar yeniden denemeye taşınır · K5-02 açılıştan sonra başka işle giden elenir · K5-03 saat kayması (Meta'nın bildirimi açılıştan önceyi gösteriyor) · K5-04 işteki Yine de Gönder · K5-05 karar yokken geç teslim sayılır | saat kayması | M80, M81, M82, M83, M95 |
| K6 | K6-01 yeniden denemesi belirsiz → elenir, öneri işteki Yine de Gönder · K6-02 kararla açılmış işte de elenir · K6-03 açılıştan ÖNCE belirsiz, geri yükleme sonrası (öneri yeni gönderim) · K6-04 hiç Başarısız olmamış belirsiz aday değil | geri yükleme | M84 K6-01, M97 K6-02, M85/M86 K6-03, M22 (eski) K6-04 |
| K7 | K7-01 2. deneme reddi · K7-02 iptal · K7-03 iptal + geç teslim · K7-04 geri yükleme · K7-05 taşıma + geç teslim | iptal, geri yükleme, taşıma | M77 K7-01, M78 K7-02, M79 K7-04 |
| K8 | K8-01 65 + 1 gönderim, 30'ar, araya yeni gönderim (imleç kaymaz), kaydı oluşmayan listede yok · K8-02 yerel gün sınırları (23:59:30, 00:00:30, 23:59:50, 00:00:10; UTC'de farklı gün) + ters aralık · K8-03 süzgeç + imleç | gece yarısı, UTC/yerel | M89/M90/M91 K8-01, M92/M93/M94 K8-02 |

Kâhinin kendi testi: 199/199 (A–I + F mutasyon 97/97; I: dönem çözümü birim denetimi, karar izlenebilirliği, yeniden deneme/liste iç tutarlılığı, eski 145
senaryoda yeni alan yok); kanıt `docs/kanit/2026-10-31/248-kahin2-kendi-testi.{log,json}`.

### 7.3 Kâhin yorumları (16–20; teyit gerekir — kâhin programa UYDURULMAZ)
16. K1 "son 7 gün": önceki gönderim anından kayan 7 × 24 saat; senaryolar sınırdan uzak (6. / 8. gün, 6g23s / 8g1s) — iki okuma aynı sonucu verir.
17. "Bu Ay" bitişi (bugün / ay sonu) ve "Son 3 Ay" uçları karar metninde yok: kâhin olası okumaların hepsini hesaplar, ayrışan yaprak `{"plan_susuyor"}`
    (eşlik bundan bağımsız). "Geçen Ay" = önceki takvim ayının tamamı (K1 "tam ay Geçen Ay").
18. R3 / Sonucu Belirsiz kaynağı = makine defteri ∪ şirket dosyasındaki işlerin denemeleri; geri yüklemede defter kalır, taşımada defter boş (dosyadaki iş kalır).
19. Gönderimler listesinde gönderimin tarihi = toplu işin açılış anı; liste = şirket dosyasındaki toplu işler.
20. Yeniden deneme yanıtındaki `elenen` yalnız ADAYLARI (asıl işte Başarısız olanlar) içerir; hiç Başarısız olmamış Sonucu Belirsiz kişi adayı değil (§6 W4 "yalnız
    kesin Başarısız").

### 7.4 KÂHİN SUSUYOR — kullanıcıya sorulacaklar (★ = kime / kaç kez, ders 43: 5 dk yetkisi yok)
1. ★ **Sonucu Belirsiz kişi YENİ toplu işte "Zaten Kuyrukta" mı?** Kâhin yorumu 3 (§7a 10 "belirsiz iş bekler") EVET; BAŞ MİMAR ★2 (Grup 5) HAYIR (ne Zaten Kuyrukta
   ne Daha Önce Gönderildi). K6'nın 11:45 sorusu ("onaysız 'yeni gönderim başlatın' yolu") ★2'yi varsayıyor. Bu yüzden 09:35 kararının "iş dosyada dururken açılıştan
   ÖNCE belirsiz kalmış ileti" yolu kâhinde kurulamadı; yalnız geri yükleme sonrası yolu var (K6-03). Seçenekler: A ★2 (hayır; K6/09:35/11:45 metinlerinin
   varsaydığı) / B yorum 3 (evet). Karar gelene dek kâhin yorum 3'te kalır (eski 145 senaryonun beklentisi değişmesin diye).
2. ★ Ödeme Hatırlatma "aynı gün" (K1 görev metninde; belgedeki kaynak BAŞ MİMAR ★5, kullanıcı kararı değil) — kâhin uyguladı (yerel gün). Ayrıca dünden bekleyen
   hatırlatma bugünkü yeni hatırlatmayı "Zaten Kuyrukta" ile eler mi? (kâhin: toplu işin açıldığı gün anahtarı → elemez; senaryo YAZILMADI).
3. "Bu Ay" bitiş günü ve "Son 3 Ay" tarih uçları (yorum 17).
4. "Son 7 gün" kayan 168 saat mi, takvim günü mü; tam 7. gün dahil mi (yorum 16).
5. ★ Son 3 Ay / Tüm Hareketler'de yeniden deneme / Yine de Gönder için "7 gün": yeni gönderimin anına mı, asıl işin dönemine (açılış günü) mi göre? K4 (dönem taşınır)
   ile K1 (7 gün) çatışabilir; kâhin gönderim anını kullanır, senaryo iki okumanın aynı sonucu verdiği yerde (K4-03).
6. ★ Özel aralık ile birebir aynı tarihli hazır seçim (Bu Ay/Geçen Ay) aynı dönem mi (dk4 DÜŞÜK-1; 2.5.0'da sorulacak, BİLİNEN SINIR) — senaryo yok.
7. Teslimsiz kapanan işe (Başarısız / İptal / Durduruldu / Taşınan) geç teslim gelince EKRAN durumu ve hata kodu — `{"secenek"}` (iptal için "Teslim Edildi" baş mimar
   kararı var, kullanıcı kararı değil).
8. İptal / geri yükleme / taşıma ile duran işin PDF'i Meta'dan silinir mi (§11 S3 yalnız teslim / başarısız / süresi doldu) — `{"plan_susuyor"}`.
9. ★ Asıl işte Başarısız, sonraki denemesi kabul edilmiş / bekleyen kişi için asıl işte yeniden Başarısızları Yeniden Dene: elenir mi, neden ne — `{"plan_susuyor"}`, senaryo yok.
10. ★ Sonucu Belirsiz elemesinin eşliği: aynı şablon + dönem eşliği mi; Son 3 Ay / Tüm'de 7 gün var mı; Yine de Gönder ile aşılmış eski belirsiz deneme sayılır mı
    (kâhin: yalnız aynı eşlik anahtarı; şu an Belirsiz duran iş ya da yalnız defterde kalan belirsiz deneme; aşılmış deneme sayılmaz).
11. K5 sınırında gönderim açılışla AYNI ANA denk gelirse (dk6 baş mimar: "önce" sayılır) — senaryo yok (kâhinde gönderim hep açılıştan adım kadar sonra).
12. K8: retry / Yine de Gönder'in açtığı toplu işler listede ayrı satır mı; tek uçlu süzgeç (yalnız Başlangıç / yalnız Bitiş) kabul mü; tam 30'un katında Daha Fazla
    Göster görünür mü (`{"plan_susuyor"}`); K8'in "en yeni önce / yerel gün / iki uç dahil / ters aralık ret" ayrıntısı kullanıcının 08:20 metninde değil, görev metninden.
13. ★ Geri yüklemeden sonra yalnız makine defterinde kalan KABUL edilmiş ileti R3'te sayılır mı (kâhin: sayar) — senaryo yalnız Belirsiz için (K6-03).
14. ★ Taşımadan sonra (yeni makine) dosyadaki teslim edilmiş iş R3'te sayılır mı — kâhin sayar (dosyadan); BAŞ MİMAR ★6 "taşınan veride bilgi yok" aksini der — senaryo
    yalnız geç teslim (K7-05; iki okuma aynı sonuç).
15. Önceden var: T2-6 baş mimar (4) "içerik ilk hazırlıkta donar" kâhinde yok (§7a 1 her gönderimde okur); ★4 "Tüm Hareketler bugüne kadar" kâhinde "bütün hesap" —
    yeni senaryolarda yeniden denemeler arası hareket değişmez, ileri tarihli hareket yok (etkisiz).

### 7.5 Sürücü için gereken eşlemeler (programa karşı koşmadan önce; sürücü bugün bunları bilmiyor)
- **S-1 `bitis`**: sürücü ufku sabit 10 gün; K1-03 (+19g2s), K7-01/02/04 (kısa ufuk) senaryonun `bitis`'ini ister.
- **S-2 hazır dönem**: `{"secim": "bu_ay"|"gecen_ay"|"son_3_ay"}` → programın hazır dönem değeri (bugün yalnız "tum" → preset "all" eşli).
- **S-3 yeniden deneme**: `hedef: "asil"` → asıl toplu iş (bugün hep son toplu iş); `etiket` → yanıtın elenen (neden), alınan ve öneri (iletideki yol) →
  `sonuc.yeniden`; 400 "Gönderilebilecek kişi yok" de okunur. **S-4** `yine_de_gonder {etiket}` aynı. **S-5** `yedek_al {ad}` + `geri_yukle {yedek}` (bugün geri
  yüklemede o an yedek alıp hemen dönüyor). **S-6** `liste` → Gönderimler ucu (sayfa, imleç, Başlangıç/Bitiş) → `sonuc.listeler`. **S-7** ATLAMA'ya "Sonucu Belirsiz" →
  `sonucu_belirsiz`. **S-8** sürücünün kendi mutasyon denetimi yeni eşlemelere genişletilir (kâhin aynı elden yazdıysa ders 5 riski: sürücü eşlemesi kâhinden
  bağımsız denetlenmeli). `{"secenek"}` yaprağı `kahin.py karsilastir`'da (sürücü değişikliği gerekmez).

### 7.6 DENENMEYEN
- Programa karşı sürücü koşusu (görev gereği; hedef commit bildirilince).
- 09:35'in "iş dosyada dururken açılıştan önce belirsiz" yolu (7.4 madde 1); hatırlatmada günler arası Zaten Kuyrukta; özel aralık ↔ hazır seçim; "aynı an" sınırı;
  tam 7. gün; tek uçlu süzgeç; yeniden deneme toplu işlerinin listede görünüşü; Süresi Doldu + geç teslim (sahte Meta TTL'i saklamıyor — TTL senaryoları zaten ayrışıyor,
  yeni eklenmedi); iki şirket / aynı WABA ile K1–K8; Kendime Deneme Gönder; çökme ("Gönderiliyor" anında) + K5/K6.
