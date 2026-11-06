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
3. **Senaryo kümesi** (`kahin/senaryolar.py` → `kahin/senaryolar.json`) — 318 senaryo (güncelleme 12 ile; aşağıdaki döküm 291'e kadar, + W3 1 + **güncelleme 11** 18: SW1 3, SW2 2, SD1837 3, SD1915 5, SW4 3, S7 2 — §16 + **güncelleme 12** 8: S7A 3, S7B 5 — §17): 145 (plan §8 "Nasıl bozulur?" başlıklarının hepsi + §7a kararlarının ve R1–R3'ün her biri)
   + 34 **kâhin güncellemesi 2** (31.10.2026, ürün sahibi kararları K1–K8; §7) + 19 **kâhin güncellemesi 3** (★ soruların yanıtları D1–D8; §8) + 12 **kâhin güncellemesi 4** (N2–N5 yanıtları E1–E4 + N6; §9) + 5 **güncelleme 5** (P1/P2 → F1/F2; §10) + 16 **güncelleme 6** (G0 ilke + G1–G5; §11) + 5 **güncelleme 7** (G6; §12) + 8 **güncelleme 8** (H1–H4; §13) + 29 **güncelleme 9** (01.11.2026 kullanıcı onaylı 8 davranış J1–J8 + n3 BİLİNEN SINIR J9; §14) + 8 **güncelleme 9b** (S9-1 / S9-2 kararları J10–J11; §14.10–14.12) + 3 **güncelleme 9c** (ekstre içeriği açılışta, J12; §14.13–14.14) + 7 **güncelleme 10** (2.4.9 W: teslim süresi 30 gün W1 + W-KÖK W2; §15).

**Bağımsızlık.** Programın kodu (`server/`, `client/`, `bulut/`) GÖRÜLMEDEN yazıldı (KANIT KURALI 2, ders 5). Okunanlar: CLAUDE.md, plan, iş listesi,
araştırma belgesi, Meta belge sayfaları (send-messages, document-messages, media, template-media, components, template-management, template-categorization,
template-quality, error-codes, webhooks overview / override / status reference, messaging-limits, throughput, access-tokens, registration, embedded-signup
implementation / tech-provider onboarding / versions, pricing) ve bu klasörün düzeni için `test/bagimsiz/edm-sayac/` README'si.
Plan §6 K0 klasör olarak `test/sahte-meta/` yazıyor; görev bu klasörü (`test/bagimsiz/whatsapp-248/`) verdi.

**Bağımsızlığın sınırı.** Elle beklenen ile model aynı elden (bu kâhin) çıktı: bağımsızlık PROGRAMA göredir. Kendi içindeki dişi: (a) elle beklenen ↔ model
iki ayrı türetme, (b) mutasyon testi (164 bilerek hata — 30'u §7a kararlarının ya da R1–R3'ün tersi, 30'u K1–K8'in (M68–M97), 11'i D1–D8'in (M98–M108), 9'u E1–E4 + N6'nın (M109–M117), 2'si F1/F2'nin (M118–M119), 9'u G0–G5'in (M120–M128), 2'si G6'nın (M129–M130), 6'sı H1–H4'ün (M131–M136), 16'sı J1–J9'un (M137–M153; M149 güncelleme 9b'de kalktı) 9'u J10–J11'in (M154–M162) 2'si J12'nin (M163–M164), 1'i J7 düzeltmesinin (M165) ve 5'i W1/W2'nin (M166–M170; M7 de W1'e göre TERSİNE çevrildi), 1'i W3'ün (M171) ve 18'i güncelleme 11'in (M172–M189; M151 artık SW1'in tersi), 9'u güncelleme 12'nin (M190–M198) tersi — toplam 197, her biri en az bir senaryoda yakalanıyor), (c) değişmezler (ör. "Bu Ay"
teslim = Teslim + Okundu iş sayısı, başarılı işte hata kodu yok, metin bakiyesi = PDF bakiyesi), (d) beklenen şablon metinleri plan dosyasından okunup
karşılaştırılır (H).

## Dosyalar

| Dosya | İçerik |
|---|---|
| `sahte-meta/sunucu.mjs` | Sahte Graph sunucusu: `sahteMetaBaslat()` + denetim uçları `/__sahte/*`; `node sunucu.mjs --port 0` ayrı süreç |
| `sahte-meta/hatalar.mjs` | Meta hata kataloğu (belgedeki `details` aynen) + D0 HTTP durum eşlemesi + hata gövdesi |
| `sahte-meta/kanca.mjs` | Durum kancası gövdesi (belge biçimi), imza (D0), doğrulama isteği (D0), Meta yeniden deneme kuyruğu (7 gün) |
| `sahte-meta/sunucu.test.mjs` | Sahte sunucunun kendi testleri (node --test, 35) |
| `sahte-meta/mutasyon.mjs` | Testlerin dişi: sunucuya 19 bilerek hata, her biri ayrı geçici kopyada; her biri en az bir testi kırmızı yapmalı |
| `kahin/kahin.py` | Model + komut satırı (`hesapla`, `karsilastir`) |
| `kahin/senaryolar.py` | 318 senaryo (girdi + ELLE beklenen); modelle karşılaştırır, aynıysa `senaryolar.json` yazar |
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
`sahte_kanca` [İMZASIZ olay: `wamid` ya da `is` (gerçek işin wamid'i), `durum`, `kod`, `opaque`]; güncelleme 11: `baglanti_suresi_doldu` / `yeniden_baglan` {`sirket`},
`baslat.supheli_elle`, `vadeler[].supheli` — §16), `ozet_cikti`. `meta_davranis.kanca` olayları Meta'nındır
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

**Yaprak türleri:** düz değer = kesin; `{"biri": [...]}` = zaman serbestliği (program bunlardan biri olmalı; bugünkü 244 senaryoda HİÇ yok — D2 testi); `{"secenek": [...], "susuyor": neden}` = karar metni hangisi olduğunu söylemiyor (§7; program seçeneklerden biri olmalı);
`{"plan_susuyor": …}` = denetlenmez (yalnız ICERIK-08 "Tüm Hareketler" dönem metni); `{"kisaltilabilir": tam}` = program tam değeri ya da önekini verebilir
(D0 uzunluk sınırı).

**İki uç:** her senaryo 2 kez koşar: işçi adımı ∈ {hızlı 0,5 sn, yavaş 5 sn} (planın "~1 sn"i). Sıra artık plan kuralı (§7a 5, seçim sırası); geçici bekleme
dizisi sabit (§7a 15: 30 sn → 2 dk → 15 dk).
**Ufuk:** benzetim olay kalmayınca ya da başlangıçtan 10 gün sonra biter (senaryoların en geç denetimi +8 gün; 7 gün kuralı içinde); senaryonun `bitis`i varsa odur (güncelleme 10'un 30 günlük senaryoları +29 g 3 sa … +31 g 3 sa).
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
(son 7 günde kanca) TTL + 1 saat → Süresi Doldu (TTL: güncelleme 10'dan beri Meta'nın şablon listesinde bildirdiği değer, yoksa 30 gün; iş KABUL ANINDAKİ değerle — §15; eskiden 3 gün), çalışmıyorsa "Meta Kabul Etti"de kalır; Süresi Doldu'dan sonra gelen teslim yazılır (zaman = kanca
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
30. Meta TTL'den sonra teslim edilmeyen iletiyi düşürür (belge); kâhin TTL'yi kabul anından sayar. Güncelleme 10: Meta'nın şablon listesinde `message_send_ttl_seconds` bildirip bildirmediği belirsiz (W tasarım §7 T2) — sahte Meta yalnız senaryo verdiyse bildirir; API medya kimliği 30 gün (belge) → 30 günlük süreden sonra Meta'da silme yok.

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
   sorulan ~~ve Sonucu Belirsiz (§7a 10 "belirsiz iş bekler")~~ — güncelleme 3 (D1, kullanıcı "b"): Sonucu Belirsiz artık "Zaten Kuyrukta" DEĞİL, yeni toplu
   işte ayrı "Sonucu Belirsiz" nedeniyle elenir; Meta Kabul Etti / Gönderildi / kesin durumlar ve Durduruldu (Geri Yükleme) / Taşınan sayılmaz.
   Eşleşme aynı şirket + cari + şablon + dönem eşliği (K1 + D4; hatırlatmada gün bakılmadan — D2 b).
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
> GÜNCELLEME 3 (31.10.2026): ★ maddeler 1, 2, 5, 6, 9, 10, 13, 14 kullanıcı tarafından yanıtlandı → D1–D8 (§8). ★ olmayan 3, 4, 7, 8, 11, 12, 15 kullanıcı
> kararıyla 2.5.0 / BİLİNEN SINIR (plan_susuyor kalır). Kalan ve yeni çıkan sorular §8.4'te.
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

## 8. Kâhin güncellemesi 3 — ★ soruların yanıtları D1–D8 (31.10.2026)

Kaynak: iş listesi "★ SORU n/8" (kullanıcı yanıtları; metinler AYNEN `kahin.KARARLAR` D1–D8). Program kodu yine GÖRÜLMEDİ; sürücüye (`surucu.mjs`) dokunulmadı
(sürücü eşlemesini başka ajan `is/surucu2-248`'de yazıyor). Yeni olay türü YOK.

### 8.1 Kurallar (kâhinde)

| Karar | Kural (kâhin) | Kod |
|---|---|---|
| D1 (madde 1 "b") | Sonucu Belirsiz kalmış kişi YENİ toplu işte de **"Sonucu Belirsiz"** ile elenir (aynı şablon + dönem eşliği; Son 3 Ay / Tüm'de son 7 gün); R3'teki toplu "Yine de Gönder" bu elemeyi GEÇMEZ; çaresi işteki Yine de Gönder. Sonucu Belirsiz artık KUYRUKTA kümesinde değil (eski yorum 3 düştü) | `baslat`, `belirsiz_kaynagi(yalniz_dosya)`, `KUYRUKTA` |
| D2 (madde 2 "a") | Hatırlatma: (a) R3 aynı yerel gün (K1-07); (b) süren hatırlatma işi varken yenisi **gün bakılmadan** "Zaten Kuyrukta" | `kuyrukta` |
| D3 (madde 5 "a") | Son 3 Ay / Tüm'de yeniden deneme ve Yine de Gönder için 7 gün **yeni gönderim anından** geriye | `eslesir(pencere_t)` |
| D4 (madde 6 "b") | Özel aralık ↔ hazır seçim (Bu Ay = ayın 1'i – bugün; Geçen Ay = önceki ayın 1'i – son günü) tarihleri birebir aynıysa aynı dönem (R3 + Zaten Kuyrukta) | `donem_coz` "tarih", `donem_eslesir` |
| D5 (madde 9 "a") | Asıl işte Başarısız, sonraki denemesi kabul / teslim edilmiş kişi asıl işten yeniden denenince "Daha Önce Gönderildi", bekliyorsa "Zaten Kuyrukta" | `yeniden_dene` |
| D6 (madde 10 "a") | Yine de Gönder ile **aşılmış** eski belirsiz deneme de sayılır ("Sonucu Belirsiz" — yeni toplu işte ve yeniden denemede); eşlik aynı, Son 3 Ay / Tüm'de 7 gün o denemenin gönderim anından | `belirsiz_kaynagi` |
| D7 (madde 13 "a") | Geri yüklemeden sonra yalnız makine defterinde kalan KABUL R3'te sayılır | `onceden_gonderildi` |
| D8 (madde 14 "a") | Taşınan veride dosyadaki Meta Kabul Etti / Teslim Edildi / Okundu ileti R3'te sayılır (BAŞ MİMAR ★6 düştü) | `onceden_gonderildi` |

### 8.2 Senaryolar (19 yeni + 1 yeniden kurulan) ve mutasyonlar (11)

| Karar | Senaryo | Sınır | Mutasyon (yakalayan) |
|---|---|---|---|
| D1 | D1-01 yeni toplu işte elenir + R3'teki Yine de Gönder geçmez + işteki Yine de Gönder ile gider · D1-02 ay sonu (Bu Ay → Geçen Ay) · D1-03 Son 3 Ay 6g23s / 7g1s | ay sonu, 7 gün | M101, M102, M107 (D1-01); M108 (K6-03) |
| D2 | D2-01 dünden bekleyen hatırlatma bugünküyü eler (yerel ve UTC'de başka gün) · D2-02 3 gündür bekleyen + 3 gün sonra serbest | gece yarısı, günler arası | M105 (D2-01) |
| D3 | D3-01 yeniden deneme 6g23s elenir / 7g1s gider (asıl iş açılışına göre her ikisi de elenirdi) · D3-02 Yine de Gönder 6g23s / 7g2s (Tüm Hareketler; belirsiz 8. günde 7 günü geçmiş) | 6g23s / 7g1s | M98 (D3-01, D3-02) |
| D4 | D4-01 aynı gün Bu Ay ↔ özel 01.10–15.10 (01.10–14.10 gider) · D4-02 ay sonu Bu Ay → 01.11 özel 01.10–31.10 · D4-03 31.12 özel 01.12–31.12 → 01.01 Geçen Ay "Zaten Kuyrukta" | ay sonu, yıl dönümü, gece yarısı | M106 (D4-01, D4-03) |
| D5 | D5-01 sonraki denemesi teslim → "Daha Önce Gönderildi" · D5-02 sonraki denemesi sınırda → "Zaten Kuyrukta" | — | M99 (D5-01, D5-02) |
| D6 | D6-01 aşılmış belirsiz yeni toplu işte eler · D6-02 yeniden denemede eler (öneri işteki Yine de Gönder) · D6-03 Son 3 Ay 6g23s / 7g1s | 7 gün | M100 (D6-01…03) |
| D7 | D7-01 geri yükleme sonrası defterdeki kabul · D7-02 ay sonu + gece yarısı | ay sonu | M103 (D7-01) |
| D8 | D8-01 taşınan veride Teslim / Okundu / Meta Kabul Etti · D8-02 taşınan veride Yine de Gönder | — | M104 (D8-01; K7-05 de) |

**Değişen eski beklentiler:** 145 eski senaryonun hiçbiri değişmedi (yorum 3 hiçbir eski senaryoda etkili değildi — Sonucu Belirsiz kalmış kişi hiç yeniden seçilmiyordu).
Güncelleme 2'nin **K4-03** senaryosu D6 yüzünden iki nedenli oldu (aşılmış belirsiz + teslim edilmiş Yine de Gönder → "Sonucu Belirsiz" mi "Daha Önce Gönderildi" mi
karar metninde yok, §8.4 N3) → **yeniden kuruldu**: `K4-03-son-3-ay-yine-de-gonder-secim-tasinir` → `K4-03-son-3-ay-yeniden-deneme-secim-tasinir` (Yine de Gönder yerine
Başarısızları Yeniden Dene; K4 denetimi ve M88 aynı). Başka değişen yok (karşılaştırma `git show 79367d92:…/senaryolar.json` ile tam sonuç).

Kâhinin kendi testi: **220/220** (F mutasyon **108/108**; yeni I5: D4'ün iki okuması hiçbir senaryoda beklentiyi değiştirmez; I6: Sonucu Belirsiz artık Zaten Kuyrukta
değil); kanıt `docs/kanit/2026-10-31/248-kahin3-kendi-testi.{log,json}`.

### 8.3 Kâhin yorumları (21–23; teyit gerekir)
21. (güncelleme 4: E1 ile TEYİT EDİLDİ) D1'in yeni toplu iş elemesi yalnız şirket dosyasındaki belirsiz denemeye bakar; geri yüklemeyle dosyadan çıkıp YALNIZ makine defterinde kalan belirsiz deneme yeni toplu
    işte ELEMEZ (D1'in çaresi "işteki Yine de Gönder" ancak iş dosyadayken var; 11:45 kararı bu durumda "yeni gönderim başlatın" der). Başarısızları Yeniden Dene'de
    defterdeki belirsiz yine eler (öneri "yeni gönderim", K6-03). M108 bunun tersidir.
22. ~~Yeniden denemede kişi BAŞKA bir işte de bekliyorsa (D5 yalnız kendi sonraki denemesini söyler) "Zaten Kuyrukta" ile elenir; elenme sırası Sonucu Belirsiz →
    Zaten Kuyrukta → Daha Önce Gönderildi; yeni toplu işte Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi (yalnız ilk neden yazılır, R3 uyarısına girmez).~~
    → güncelleme 4: E2 (sıra HER YERDE Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi) + N6 (başka işte bekleyen "Zaten Kuyrukta") kullanıcı kararı oldu.
23. (güncelleme 6: G2 ile İKİ okuma birlikte — `donem_eslesir`) D4 "o gün" = hazır seçimin KENDİ günü (Bu Ay 15.10'da gönderildiyse tarihleri 01.10–15.10); öbür okuma (özel aralığın günündeki hazır seçim) OKUMA_Y olarak
    hesaplanır — I5 bütün senaryoların iki okumada aynı sonucu verdiğini denetler.

### 8.4 KÂHİN SUSUYOR — güncelleme 3'ten sonra kalan / yeni (★ = kime / kaç kez)
> GÜNCELLEME 4 (31.10.2026): N2, N3, N4, N5 kullanıcı tarafından yanıtlandı → E1–E4; N6 → "Zaten Kuyrukta" (§9). N7, N8 kullanıcı kararıyla 2.5.0 / BİLİNEN SINIR.
- **N1 (bilgi):** 09:35'in "iş dosyada dururken, açılıştan ÖNCE belirsiz kalmış ileti" yolu D1'den sonra da KURULAMIYOR: D1 aynı eşlikle yeni toplu işte eler → kişi
  asıl işe hiç giremez (pencere "yeni gönderim anından" yalnız büyür). Tek kurulabilen yol geri yükleme sonrası defter (K6-03; yorum 21).
- **N2 ★:** yalnız makine defterinde kalan belirsiz deneme yeni toplu işte eler mi (yorum 21: elemez; D1 "aynı eşlik" der, kaynak demez).
- **N3 ★:** birden çok eleme nedeni aynı anda (Zaten Kuyrukta / Sonucu Belirsiz / Daha Önce Gönderildi): hangisi yazılır, R3 uyarı sayısına girer mi (yorum 22).
- **N4 ★:** hatırlatmada Sonucu Belirsiz eşliği: "dönem eşliği" = aynı gün → dünkü belirsiz hatırlatma bugünküyü ELEMEZ (bekleyen de sayılmıyor) — senaryo yok.
- **N5 ★:** D5 ile D3 sınırı: sonraki denemesi 7 günden önce kabul edilmiş (Son 3 Ay / Tüm) kişi asıl işten yeniden denenince — D5 "Daha Önce Gönderildi" mi, D3 gereği
  gider mi (kâhin: ikisini de yapmaz — `{"plan_susuyor"}`, kişi yeniden gönderilmez) — senaryo yok.
- **N6:** yorum 22'nin başka işte bekleyen kişi kısmı — senaryo yok.
- **N7:** D4 "o gün" iki okuması (yorum 23) — farklı günlü durum (ör. 15.10 Bu Ay ↔ 20.10'da özel 01.10–15.10) senaryosuz.
- **N8 (bilgi):** D4 metni "Bu Ay = ayın 1'i – bugün" der; kâhin bunu yalnız EŞLİKTE kullanır, ekstre İÇERİĞİNDE (PDF dönem sonu, {{3}}) madde 3 kararı gereği
  `plan_susuyor` kalır — D4 madde 3'ün "Bu Ay" yarısını da kapatıyor olabilir (koordinatöre).
- ★ olmayan 3, 4, 7, 8, 11, 12, 15 (§7.4): kullanıcı kararıyla 2.5.0 / BİLİNEN SINIR.

### 8.5 Sürücü için (README §7.5'e ek; yeni olay türü yok)
- **S-9:** başlatma özetinde yeni neden **"Sonucu Belirsiz" → `sonucu_belirsiz`** (D1; S-7'deki ATLAMA eşlemesi başlatmada da); yeniden deneme yanıtında
  **"Zaten Kuyrukta" → `zaten_kuyrukta`** (D5) ve "Daha Önce Gönderildi" (D5) S-3'ün neden eşlemesine.
- **S-10:** D3-02 `bitis: "+15d4h"` (S-1); yeni senaryoların çoğu güncelleme 2'nin olaylarını kullanır (yedek_al / geri_yukle {yedek} — D7; etiketli ve `hedef:"asil"`
  yeniden deneme — D3, D5, D6; hazır dönem seçimi — D1, D4, D7).

### 8.6 DENENMEYEN (güncelleme 3)
- Programa karşı sürücü koşusu (görev: sürücü eşlemesi başka ajanda).
- N1 yolu (kurulamıyor); N2, N4, N5, N6, N7 senaryosuz; iki şirket (cari şirkete özgü — eşlik zaten şirket başına, ayrı senaryo yazılmadı); hatırlatma + D1/D6.

## 9. Kâhin güncellemesi 4 — N2–N5 yanıtları E1–E4 + N6 (31.10.2026)

Kaynak: ana oturumun iletisi (kullanıcı kararları AYNEN `kahin.KARARLAR` E1–E4, N6). Program kodu yine GÖRÜLMEDİ; `surucu.mjs`'e dokunulmadı. Yeni olay türü YOK.

### 9.1 Kurallar
| Karar | Kural (kâhin) | Kod |
|---|---|---|
| E1 (N2 "a") | Yalnız makine defterinde kalan belirsiz deneme yeni toplu işte ELEMEZ; Başarısızları Yeniden Dene'de eler (öneri "yeni gönderim") — yorum 21 teyit | `belirsiz_kaynagi(yalniz_dosya)` |
| E2 (N3 "a") | TEK neden; sıra HER YERDE (yeni toplu iş, Başarısızları Yeniden Dene, işteki Yine de Gönder) Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi; Zaten Kuyrukta / Sonucu Belirsiz ile elenen R3 uyarısına girmez, R3'te Yine de Gönder seçilse de gitmez. İşteki Yine de Gönder artık Zaten Kuyrukta'yı da denetler (Sonucu Belirsiz'i değil — onaylı yol, K6) | `baslat`, `yeniden_dene`, `yine_de_gonder` |
| E3 (N4 "a") | Hatırlatmada Sonucu Belirsiz eşliği aynı YEREL gün (dünkü belirsiz bugünküyü elemez) | `eslesir(belirsiz=True)` |
| E4 (N5 "a") | Son 3 Ay / Tüm'de asıl işten yeniden denemede sonraki denemenin kabul/teslimi yeni gönderim anından 7 gün içindeyse "Daha Önce Gönderildi", eskiyse yeniden gönderilir | `yeniden_dene` |
| N6 | Yeniden denemede başka işte bekleyen kişi "Zaten Kuyrukta" | `kuyrukta` |

### 9.2 Senaryolar (12) ve mutasyonlar (9)
| Karar | Senaryo | Sınır | Mutasyon (yakalayan) |
|---|---|---|---|
| E1 | E1-01 dosyada (B) ↔ yalnız defterde (A) belirsiz: yeni işte B elenir A alınır; yeniden denemede A "Sonucu Belirsiz" (öneri yeni gönderim); yeni gönderimle gider (+ K6-03) | geri yükleme | M108 (K6-03, E1-01) |
| E2 | E2-01 yeni iş üçlü (R3 + aşılmış belirsiz + bekleyen; Yine de Gönder) · E2-02 yeni iş belirsiz + R3, Yine de Gönder (uyarı yalnız B) · E2-03 yeniden deneme bekleyen + defterde belirsiz · E2-04 yeniden deneme üçlü · E2-05 yeniden deneme belirsiz + R3 · E2-06 işteki Yine de Gönder "Zaten Kuyrukta" | 8. gün (Son 3 Ay), 25 saat (sınır penceresi) | M109 (E2-03), M110 (E2-05), M111 (E2-06), M112 + M113 (E2-01) |
| E3 | E3-01 23:50 / 23:55 / 00:10 (yerel yeni gün, UTC aynı gün) · E3-02 aynı gün yeniden deneme | gece yarısı yerel ≠ UTC | M114, M115 (E3-01) |
| E4 | E4-01 Son 3 Ay 6g23s elenir / 7g1s gider · E4-02 Tüm Hareketler aynı | 6g23s / 7g1s | M116 (E4-01) |
| N6 | N6-01 başka işte sınırda bekleyen | — | M117 (N6-01) |

**Değişen eski beklentiler: YOK** (198 senaryonun tam sonucu `git show 1f4ab323:…/senaryolar.json` ile bayt bayt aynı; yeniden deneme sırası değişikliği ve işteki Yine de Gönder'in
Zaten Kuyrukta denetimi hiçbir eski senaryoda etkili değildi). Kâhinin kendi testi **232/232**, F mutasyon **117/117**; kanıt `docs/kanit/2026-10-31/248-kahin4-kendi-testi.{log,json}`.

### 9.3 KÂHİN SUSUYOR — güncelleme 4'ten sonra
- **P1 ★ (güncelleme 5: F1 ile yanıtlandı — kâhin okuması teyit):** işteki Yine de Gönder'de BAŞKA bir denemenin Sonucu Belirsiz'i (defterdeki ya da aşılmış eski deneme) eler mi? Kâhin: elemez (K6: onaylı yol; E2 yalnız sırayı
  söyler). Senaryo yok.
- **P2 ★ (güncelleme 5: F2 ile yanıtlandı — kâhin okuması teyit):** hatırlatmada asıl işin yeniden denemesi ERTESİ gün: belirsizin "aynı gün" eşliği yeniden denemenin gününe mi (E3 → elemez, gider), asıl işin gününe mi (K4)
  göre? Kâhin yeniden denemenin gününü kullanır; senaryo yalnız aynı gün (E3-02).
- **P3 (bilgi):** iç denetim "kesin olmayan durumda PDF silinmiş" işin BÜTÜN denemelerinin PDF'ini sayıyor; E4'te Başarısız ilk denemenin PDF'i silinmiş, sonraki deneme
  yalnız "Meta Kabul Etti"de kalırsa denetim yanlış ihlal verir → E4-02 teslim bildirimiyle kuruldu, "yalnız kabul" hâli DENENMEYEN. Sürücü ajanına (S-11): bu sayaç
  yalnız SON denemenin PDF'ine bakmalı.
- N7, N8: kullanıcı kararıyla 2.5.0 / BİLİNEN SINIR (plan_susuyor kalır).

### 9.4 Sürücü için
- **S-11:** yeni olay türü yok. Yeni nedenler başlatma özetinde ve yeniden deneme yanıtında S-7 / S-9 eşlemeleriyle (Zaten Kuyrukta, Sonucu Belirsiz, Daha Önce
  Gönderildi); işteki Yine de Gönder yanıtında da "Zaten Kuyrukta" → `zaten_kuyrukta` (E2-06). İç denetim sayacı `kesin_oncesi_medya_silme` yalnız işin SON denemesinin
  PDF'ine bakmalı (P3).

### 9.5 DENENMEYEN (güncelleme 4)
- Programa karşı sürücü koşusu; P1, P2 (ertesi gün) senaryoları; E4'ün "yalnız Meta Kabul Etti" hâli (P3); hatırlatmada E2 çakışmaları.

## 10. Kâhin güncellemesi 5 — P1 / P2 yanıtları F1 / F2 (31.10.2026)

Kaynak: ana oturumun iletisi (kullanıcı kararları AYNEN `kahin.KARARLAR` F1, F2). İki karar da kâhinin mevcut okumasını teyit etti → **kural değişmedi**; yalnız senaryo,
mutasyon ve kendi testi eklendi. Program kodu görülmedi; `surucu.mjs`'e dokunulmadı; yeni olay türü yok.

| Karar | Senaryo | Sınır | Mutasyon (yakalayan) |
|---|---|---|---|
| F1 (P1 "a"): işteki Yine de Gönder başka denemenin Sonucu Belirsiz'iyle (başka iş / defter / aşılmış eski) elemez; bekleyen ileti varsa "Zaten Kuyrukta" eler | F1-01 iki belirsiz iş TX/TY (Son 3 Ay, 8. gün), TX'te Yine de Gönder gider · F1-02 aşılmış belirsiz + TY'de sınırda bekleyen → "Zaten Kuyrukta" · F1-03 aşılmış eski belirsizden sonra ikinci Yine de Gönder gider | 8. gün | M118 (F1-01; F1-03 de) |
| F2 (P2 "a"): hatırlatmanın yeniden denemesinde "aynı gün" yeniden denemenin yerel günü | F2-01 Pazartesi 23:40 Başarısız, 23:45 yeniden deneme belirsiz, 23:50 "Sonucu Belirsiz", Salı 00:10 (UTC'de Pazartesi) gider · F2-02 Salı yeni hatırlatma gider, Salı yeniden deneme "Daha Önce Gönderildi" (aynı gün R3) | gece yarısı yerel ≠ UTC | M119 (F2-01) |

**Değişen eski beklentiler: YOK** (210 senaryonun tam sonucu `git show 083ee0b0:…/senaryolar.json` ile bayt bayt aynı). Kendi testi **237/237**, F mutasyon **119/119**;
kanıt `docs/kanit/2026-10-31/248-kahin5-kendi-testi.{log,json}`. Kalan KÂHİN SUSUYOR: §9.3 P3 (bilgi, sürücü S-11) ve 2.5.0 / BİLİNEN SINIR maddeleri.

## 11. Kâhin güncellemesi 6 — G0 genel ilke + G1–G5 (31.10.2026)

Kaynak: ana oturumun iletisi (kullanıcı kararları AYNEN `kahin.KARARLAR` G0–G5). Program kodu görülmedi; `surucu.mjs`'e dokunulmadı.

### 11.1 Kurallar
| Karar | Kâhinde | Değişti mi |
|---|---|---|
| G0 (1, 4) | Asıl işte Başarısız, sonraki denemesi teslimsiz duran (Durduruldu / Taşınan / İptal / Süresi Doldu / Atlandı) kişi asıl işten yeniden denenince GÖNDERİLİR — eski `plan_susuyor` yaprağı **İLKEYLE** çözüldü | evet (`yeniden_dene`) |
| G0 (4) + D6 | İşteki Yine de Gönder, asıl işte belirsiz KALAN denemede de (`hedef: "asil"`, şu anki deneme Başarısız olsa da) çalışır — çıkmaz yok (D6-02 / D6-01'in önerdiği yol) **İLKEYLE** | evet (`yine_de_gonder`) |
| G0 (3) | Son 3 Ay / Tüm'de tam 7. gün aynı dönem (`<=`) **İLKEYLE**; asıl işin açılışıyla AYNI ANDA giden "sonra" sayılır (elenir) **İLKEYLE** — ikisi de senaryosuz (kâhinde gönderim anı iki zaman ucunda farklı) | evet (sınırlar) |
| G0 (2), (5) | Belirsiz eler / taşınan-geri yüklenen veride aynı kurallar — zaten böyle | hayır |
| G1 | Özel aralık / hazır seçim tarihi ("o gün") toplu işin açıldığı gün; yeniden denemede asıl işin günü; sınırla ertesi güne kayan aynı dönem — zaten böyle (iş başlatmada çözülür, K4) | hayır |
| G2 | D4'ün İKİ okuması birlikte: hazır seçimin o günkü tarihleri (03.11 Bu Ay ↔ 05.11 özel 01.11–03.11) VE kendi günlerinde Bu Ay'a eşit iki özel aralık (01.11–03.11 @03.11 ↔ 01.11–05.11 @05.11) aynı dönem | evet (`donem_eslesir`; eski I5 sağlamlık denetimi kalktı, yerine birim denetimi) |
| G3 | Taşınan veride dosyadaki belirsiz eler (yeni iş + yeniden deneme), işteki Yine de Gönder çalışır; dosyadan gelen kabul/teslime 7 gün + K5 sınırı — zaten böyle | hayır |
| G4 | Sıfırlamayla duran teslimsiz Meta Bekletti sayılmaz, geç teslim sayılır — zaten böyle (kâhinde sıfırlama §7a 26 düzeninde: işler "Durduruldu (Geri Yükleme)") | hayır |
| G5 | Meta Bekletti sonrası belirsiz kalan 2. deneme kişiyi "Sonucu Belirsiz" ile eler, Yine de Gönder çalışır — zaten böyle | hayır |

### 11.2 Senaryolar (16) ve mutasyonlar (9)
| Karar | Senaryo | Sınır | Mutasyon |
|---|---|---|---|
| G0 | G0-01 sonraki deneme geri yüklemeyle durdu → yeniden gider · G0-02 asıl işte belirsiz kalan denemeye Yine de Gönder | — | M127, M128 |
| G1 | G1-01 özel 01.10–15.10 @15.10 23:00 sınır 1 → B 16.10'da, 20.10 özel 01.10–20.10 elenir · G1-02 Bu Ay aynı · G1-03 yeniden deneme ertesi gün 02:00 | gece yarısı, ertesi gün | M122 |
| G2 | G2-01 03.11 Bu Ay ↔ 05.11 özel · G2-02 iki özel aralık kendi günlerinde · G2-03 04.11 00:10 (UTC 03.11) Bu Ay = 01.11–04.11 | gece yarısı yerel ≠ UTC | M120, M121, M123 |
| G3 | G3-01 yeni iş · G3-02 yeniden deneme · G3-03 Son 3 Ay 6g23s / 7g1s · G3-04 K5 sınırı | 7 gün | M124 (+ M104, M80) |
| G4 | G4-01 sıfırlama → gider · G4-02 sıfırlama + geç teslim → elenir | — | M125 (+ M79, M76) |
| G5 | G5-01 2. deneme belirsiz → elenir, Yine de Gönder gider · G5-02 2. deneme imzalı teslimle çözüldü → "Daha Önce Gönderildi" | 24 saat | M126 |

**Değişen eski beklentiler: YOK** (215 senaryonun tam sonucu `git show adf735b6:…/senaryolar.json` ile bayt bayt aynı — İLKEYLE değişiklikler ve G2 birleşimi hiçbir eski senaryoda etkili değil). Kendi testi
**253/253**, F mutasyon **128/128**; kanıt `docs/kanit/2026-10-31/248-kahin6-kendi-testi.{log,json}`.

### 11.3 Plan_susuyor kalan "kime kaç kez" yaprağı: YOK
Kalan `plan_susuyor` / `secenek` yaprakları kime-kaç-kez değil: ekstre içerik tarih uçları (Bu Ay bitişi / Son 3 Ay — madde 3, 2.5.0), "Tüm Hareketler" dönem metni,
hatırlatmada gecikmiş borcu olmayanın değişkenleri (yalnız M44), Gönderimler'de tam sayfada Daha Fazla Göster, teslimsiz kapanan işe geç teslimin EKRAN durumu
(K3/K7), İptal / geri yükleme / taşıma ile duran işin PDF silinmesi (S3).

### 11.4 Sürücü için
- **S-12:** `yine_de_gonder {hedef: "asil"}` → ASIL toplu işteki iş (bugün sürücü son toplu işteki işi seçer) — G0-02.
- **S-13:** `sifirla` sürücüde geri yükleme gibi (o an yedek + geri yükle); kâhin §7a 26 düzenini (işler "Durduruldu (Geri Yükleme)", dosya kalır) kullanır. Gerçek
  "Şirket Verisini Sıfırla" carileri ve işleri silerse G4'ün "geç teslim sayılır" yolu bambaşka işler (cari kimliği değişir) → gerçek sıfırlama eşlemesi ve beklentisi
  ayrıca konuşulmalı (BİLGİ; kâhin karar vermez).
- **S-14:** G1-01/02'de günlük sınır 1 (`ayar.gunluk_ust_sinir`, mevcut).

### 11.5 DENENMEYEN
- Programa karşı sürücü koşusu; G0 (3) sınırları (tam 7. gün, aynı an) — kâhinde iki zaman ucu farklı gönderim anı verdiği için senaryolanamadı; gerçek sıfırlamanın veri
  silme etkisi (S-13); hatırlatmada G1 (karar yalnız ekstre).

## 12. Kâhin güncellemesi 7 — G6 (31.10.2026)

Kaynak: ana oturumun iletisi — baş mimar, G0 (3) "dönem eşliğinde şüphede aynı dönem" **İLKEYLE** (AYNEN `kahin.KARARLAR` G6). Program kodu görülmedi; `surucu.mjs`'e dokunulmadı.

### 12.1 Kural
"Son 3 Ay" / "Tüm Hareketler" gönderiminin **o günkü** tarihleri (toplu işin açıldığı gün; yeniden denemede asıl işin günü — G1) özel aralığın tarihleriyle birebir aynıysa
aynı dönem: "Daha Önce Gönderildi" (R3), "Zaten Kuyrukta", "Sonucu Belirsiz"; iki yön (önce hazır seçim / önce özel aralık). R3 ve Sonucu Belirsiz eşliğinde Son 3 Ay / Tüm'ün
7 gün penceresi geçerli (`<=`, G0 (3)); 7 günden eski kayıt ayrı dönem. Değişiklik: `donem_coz` (`tarihler`), `donem_eslesir` (secim ↔ aralik), `eslesir` (pencere), iş ve
deneme kayıtlarında `tarihler`.

**KÂHİN SUSUYOR → BAŞ MİMAR KAYDI (ders 40; karşılaştırmadan ÖNCE, kâhin tarafında):**
1. "Son 3 Ay"ın o günkü tarihleri = kâhinin dört okumasının BİRLEŞİMİ (G0 (3) şüphede aynı dönem; ör. 30.10'da 30.07–30.10 da 01.08–30.10 da eşleşir). Program tek okuma
   kullanıyorsa öbür okumadaki senaryo farkı program hatası değil, okuma farkıdır → ana oturuma sorulur.
2. "Tüm Hareketler"in o günkü tarihleri = KİŞİNİN ilk hareketinin tarihi – o gün (karar metni "Tüm Hareketler"in başlangıcını söylemiyor; G6-02 bu okumaya yaslanır).
   Hareketsiz kişide tarih yok → özel aralıkla eşleşmez.
3. "Zaten Kuyrukta" çapraz eşlikte de yaş penceresi yok (06:45 "a" kararı: kuyrukta bekleyen iş yaşa bakmadan eler) — **İLKEYLE**.

### 12.2 Senaryolar (5) ve mutasyonlar (2)
| Senaryo | Ne | Sınır | Mutasyon |
|---|---|---|---|
| G6-01 | Son 3 Ay @30.10 → 6g23s özel 30.07–30.10 elenir, 7g1s gider | 7 gün | M129, M130 |
| G6-02 | özel 15.01–30.10 → aynı gün Tüm Hareketler: Y (ilk hareket 15.01) elenir, Z (10.02) gider | kişi başına | — |
| G6-03 | 01.11 00:30 (UTC 31.10) Son 3 Ay sınırda bekleyen → özel 01.09–01.11 "Zaten Kuyrukta" | gece yarısı yerel ≠ UTC | (+ M123) |
| G6-04 | Tüm Hareketler belirsiz → özel aralık "Sonucu Belirsiz", Yine de Gönder gider | — | — |
| G6-05 | 30.10 23:00 Son 3 Ay başarısız → 31.10 01:00 yeniden deneme gider → 31.10 10:00 özel 30.07–30.10 elenir (asıl işin günü) | gece yarısı + G1 | (+ M122) |

M129 (eşleşme yok) ve M130 (çapraz eşlikte pencere yok) G6-01'de yakalanıyor. **Değişen eski beklentiler: YOK** (231 senaryonun tam sonucu `git show 3e94f51d:…/senaryolar.json`
ile aynı). Kendi testi **258/258**, F mutasyon **130/130**; kanıt `docs/kanit/2026-10-31/248-kahin7-kendi-testi.{log,json}`.

### 12.3 Sürücü için
- **S-15:** Özel aralık `donem: {"bas","son"}` ile hazır seçim (`SON3`, `"tum"`) aynı senaryoda; sürücünün iki eşlemesi de (S-2) gerekir. Program "Son 3 Ay"ı tek okumayla
  çözüyorsa G6-01 / G6-05'teki özel aralığın o okumaya uyup uymadığı önce okunur (12.1-1).

### 12.4 DENENMEYEN
- Programa karşı sürücü koşusu; hareketsiz kişide Tüm Hareketler ↔ özel aralık (12.1-2; senaryosuz); hatırlatmada G6 (karar yalnız ekstre).

## 13. Kâhin güncellemesi 8 — H1 (kullanıcı) + H2–H4 (baş mimar, G0 İLKEYLE) (31.10.2026)

Kaynak: ana oturumun iletisi (metinler AYNEN `kahin.KARARLAR` H1–H4). Program kodu görülmedi; `surucu.mjs`'e dokunulmadı. Kâhinin "Tüm Hareketler" = kişinin ilk
hareketi – o gün okuması (G6-02, §12.1-2) DEĞİŞMEDİ.

### 13.1 Kurallar
| Karar | Kâhinde | Değişti mi |
|---|---|---|
| H1 | İşteki Yine de Gönder o anki Sonucu Belirsiz denemeleri "kaynak" olarak yeni denemeye yazar; yeni deneme R3'te sayılınca (kabul ve sonrası / teslim) kaynak artık Sonucu Belirsiz elemez → kişi "Daha Önce Gönderildi", yol R3 Yine de Gönder. Yeni deneme Başarısız / Sonucu Belirsiz kalırsa kaynak elemeye devam eder (D6/F1 aynen) | evet (`yine_de_gonder`, `kayit_ac`, `belirsiz_kaynagi`) |
| H2 | Taşımada "Gönderiliyor" kalan iş Sonucu Belirsiz (Taşınan değil); dosyadaki belirsiz kişiyi eler, işteki Yine de Gönder çalışır | kural evet, sonuç hayır (kâhinde "Gönderiliyor" yalnız çökmeyle kalır, açılış onu zaten Sonucu Belirsiz yapıyordu) |
| H3 | İş şirket dosyasında yokken (yedeğe dönüş) gelen İMZALI geç olay: wamid biliniyorsa o denemenin teslimi sayılır; bilinmiyorsa iş kimliğiyle (opaque) defterdeki SON deneme, yalnız sonucu belli değilse (Sonucu Belirsiz / Gönderiliyor) kabul edilmiş sayılır | evet (`dosyasiz_kanca`; önce yok sayılıyordu) |
| H4 | R3 uyarısındaki "son gönderim" = sayılan (kabul / teslim edilmiş) son denemenin anı (programın saati, K5), yerel gün | hayır (kâhin zaten böyle; şimdi mutasyonla korunuyor) |

**KÂHİN YORUMLARI (ders 40; karşılaştırmadan ÖNCE, kâhin tarafında; ana oturuma):**
1. H1 "kabul/teslim edilince" = yeni deneme R3'te SAYILINCA. Kabulden sonra Süresi Doldu kalan deneme sayılmaz (K3), kaynak da elemeye devam eder
   (G0 2: almış olabilirse elenir; aradaki boşlukta kişi uyarısız gitmesin). Senaryosuz.
2. H1 zinciri: işteki Yine de Gönder o işin O ANKİ BÜTÜN Sonucu Belirsiz denemelerini kaynak alır (önceki Yine de Gönder'in belirsiz kalan denemesi dahil). Program yalnız
   en son denemeyi kaynak alıyorsa zincirde ayrışır; senaryosuz.
3. H3 sıfırlama: kâhinde "Şirket Verisini Sıfırla" işleri dosyada bırakır (§7a 26, S-13); orada geç kabul/teslim zaten sayılıyordu. H3 kâhinde yalnız yedeğe dönüşle senaryolandı.
4. H3 failed: dosyada olmayan işin sonucu belli olmayan son denemesine imzalı "failed" gelirse kâhin onu Başarısız yapar (kesin almadı; G0 1, 5 — dosyadaki işte de böyle).
   Senaryosuz.
5. H3 "Bu Ay": dosyada olmayan işin geç teslimi §7a 19 "Bu Ay" sayacına kâhinde girmez (değişmedi; karar metni yalnız R3'ü söylüyor). Senaryoların hiçbiri "Bu Ay"a bakmıyor.

### 13.2 Senaryolar (8) ve mutasyonlar (6)
| Senaryo | Ne | Sınır | Mutasyon |
|---|---|---|---|
| H1-01 | belirsiz → Yine de Gönder teslim → yeni gönderim "Daha Önce Gönderildi" (son 30.10) → R3 Yine de Gönder ile gider | — | M131 |
| H1-02 | Yine de Gönder Başarısız → R3 Yine de Gönder'li yeni gönderimde de "Sonucu Belirsiz"; asıl işte yeniden Yine de Gönder teslim → "Daha Önce Gönderildi" | — | M132 |
| H1-03 | 31.10 23:40 Son 3 Ay belirsiz → 01.11 00:10 (UTC 31.10) Yine de Gönder teslim → "Daha Önce Gönderildi", son 01.11 → R3 Yine de Gönder | gece yarısı yerel ≠ UTC | (+ M131, M136) |
| H2-01 | çökme (istek gitmedi) → taşıma → açılış: Sonucu Belirsiz, yeni gönderimde elenir, işteki Yine de Gönder ile teslim | — | M133 |
| H2-02 | çökme (istek ulaştı) → taşıma → yeni bilgisayarda kanca işi çözer → "Daha Önce Gönderildi" | — | (+ M133) |
| H3-01 | yedekten sonra açılan iş belirsiz → yedeğe dönüş → 3 saat sonra imzalı kanca → "Daha Önce Gönderildi" | — | M134 |
| H3-02 | yedekten sonra açılan iş Meta Bekletti → yedeğe dönüş → geç imzalı teslim → "Daha Önce Gönderildi" | — | (+ M134) |
| H4-01 | 31.10 00:30 (UTC 30.10) teslim; 01.11 R3 Yine de Gönder Başarısız; uyarıdaki son gönderim 31.10 | gece yarısı yerel ≠ UTC | M135, M136 |

**Değişen eski beklentiler: YOK** (236 senaryonun tam sonucu `git show 2eb354e3:…/senaryolar.json` ile aynı). Yeni 8 senaryo eski kâhinle (2eb354e3) koşuldu: H1-01,
H1-02, H1-03, H3-01, H3-02 eski kâhinde FARKLI (kural değişti); H2-01, H2-02, H4-01 aynı (zaten böyleydi). Kendi testi **266/266**, F mutasyon **136/136**; kanıt
`docs/kanit/2026-10-31/248-kahin8-kendi-testi.{log,json}`. (İlk koşu 263/266 kırmızıydı: H3'te `bilinen_ihlal` post_toplam bildirilmemişti, H2'de `kontrol` zamanı zaman
ucuna bağlıydı — ikisi de senaryo yazımı; kâhin kuralı değişmedi.)

### 13.3 Sürücü için
- **S-16:** H3: Meta'nın imzalı kancası iş şirket dosyasında YOKKEN gelir (yedeğe dönüşten sonra). Sahte Meta kancayı geciktirebilmeli (`kanca.<cari>.<n>` gecikmesi,
  mevcut). `meta.post` dosyadan çıkan işin POST'unu saymaz → H3 senaryolarında `meta.post` beklenmedi (`bilinen_ihlal` post_toplam, GERI_IHLAL).
- **S-17:** H2: `cokme` + `tasindi` (program kapalıyken) + `ac` sırası; sürücüde taşıma eşlemesi (S-13 gibi) çökmeden sonra, açılıştan önce.

### 13.4 DENENMEYEN
- Programa karşı sürücü koşusu; 13.1'deki senaryosuz yorumlar (Süresi Doldu, zincir, failed, "Bu Ay"); gerçek sıfırlamanın işleri silmesi (S-13).

## 14. Kâhin güncellemesi 9 — 01.11.2026 kullanıcı onaylı 8 davranış (J1–J8) + n3 BİLİNEN SINIR (J9)

### 14.1 Kaynak ve bağımsızlık
Kaynak YALNIZ CLAUDE.md "Açık iş" iki KARAR satırı (AYNEN `kahin.KARARLAR` J1–J9): **KARAR 01.11.2026 06:28 UTC** ("önerini uygula" → "Hepsini onaylıyorum": 8 WhatsApp
davranışı, madde (1)–(8) → J1–J8) ve **KARAR 01.11.2026 05:58 UTC** ("Şimdi durdur" + "Bilinen sınır": n3 → J9). Bunlara ek olarak G0 genel ilkesi (31.10.2026 12:40) ve
önceki güncellemelerin kararları. Program kodu (`server/`, `client/`, `bulut/`), program testleri, düzeltme ajanı kanıtları (`248-dk*fix-*`), tasarım notları ve dar kontrol
betikleri GÖRÜLMEDİ; iş listesinden yalnız n3 sorusunun tek satırı (514–515: "aynı kişi + aynı dönem için kuyruktaki İKİNCİ iş, birincinin geç teslimi geldikten sonra da
gidiyor … yalnız Meta'nın failed/131049 sonrası geç teslimiyle"; A/B seçenekleri) okundu. Bu bölümün 14.2–14.4'ü kodlamadan ve programla karşılaştırmadan ÖNCE yazıldı (ders 40).

### 14.2 Güncelleme 9 yorumları (kâhinin okuması; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y9-1 | "Teslim" = İMZALI delivered/read bildirimi, programın tanıdığı bir DENEMEYE: wamid biliniyorsa o deneme; wamid bilinmiyorsa iş kimliği (opaque) → o işin sonucu belli olmayan (kabul bilinmeyen, Sonucu Belirsiz / Gönderiliyor kalmış) SON denemesi — H3'ün dosyasız düzeni artık dosyadaki işte de | J1 + §7a 3 + H3 |
| Y9-2 | "Her durumda": iş Meta Bekletti (bekleyen), Duraklatıldı / Lisans Nedeniyle Durdu (Meta Bekletti'den), İptal, Durduruldu (Geri Yükleme), Taşınan, Başarısız, Süresi Doldu, şirket dosyasında yok (yedeğe dönüş) ya da şirket silinmiş olsa da deneme TESLİM sayılır → aynı dönemde "Daha Önce Gönderildi" (R3 eşliği — dönem, 7 gün, K5 sınırı — DEĞİŞMEZ) | J1 |
| Y9-3 | "İş yeniden açılmaz": teslimsiz kapanmış iş geç teslimle gönderime dönmez (POST artmaz); Başarısızları Yeniden Dene o kişiyi "Daha Önce Gönderildi" ile eler (R3/D5 düzeni). Ekran durumu önceki gibi `secenek` (K3/K7 KÂHİN SUSUYOR 7 — değişmedi) | J1 |
| Y9-4 | "Şirket silinmiş" kâhinde yeni olay `sirket_sil {sirket}`: şirket dosyası (toplu işler, işler) KALICI olarak gider; makine defteri, "Bu Ay", sınır penceresi ve Meta'daki iletiler kalır; geç bildirim defterdeki denemeye yazılır (teslim / başarısız). Gözlem: aynı WABA'yı paylaşan öbür şirketin "Bu Ay"ı + kanca yanıtı (200, J6) | J1, J3, J6 |
| Y9-5 | Dosyadaki işin "aşılmış" (Yine de Gönder ile geride kalmış) Sonucu Belirsiz denemesine iş kimliğiyle gelen geç bildirim o DENEMEYE yazılır: delivered/read → teslim (R3 + "Bu Ay"), sent → kabul (R3), failed → Başarısız (kişi almadı). Eski kâhin bunu düşürüyordu (yalnız şu an Sonucu Belirsiz duran iş çözülüyordu). İşin ekran durumu: iş Meta Kabul Etti / Gönderildi'deyse teslimle Teslim Edildi (wamid'i bilinen eski denemenin teslimiyle aynı); eski denemenin failed'ı işin ŞU ANKİ denemesine dokunmaz | J1, J3 + G0 (1, 3) |
| Y9-6 | J2 "iş kapanır" = iş Teslim Edildi (read ise Okundu) olur — §7a 17 "gerçek bilgi yazılır" düzeni; 24 sa sonraki 2. deneme GİTMEZ (POST 1); kesin duruma geçtiği için PDF Meta'dan silinir (§11 S3); "Bu Ay" +1 | J2 + §7a 17 + S3 |
| Y9-7 | Meta Bekletti iken toplu iş duraklatılmış (Duraklatıldı) ya da lisans salt okunura geçmiş (Lisans Nedeniyle Durdu) iş hâlâ "Meta Bekletti'deki ileti"yi taşır: teslim gelince iş yine kapanır, Devam Et 2. denemeyi GÖNDERMEZ | J2 ("2. deneme gitmez") + J1 ("durdurulmuş olsa da") |
| Y9-8 | J3: imzalı failed, programın tanıdığı ve TESLİM EDİLMEMİŞ bir denemeye (wamid ya da iş kimliği) gelince o deneme Başarısız sayılır → R3'te sayılmaz, kişi yeniden gönderilebilir. Dosyada olmayan işin wamid'i bilinen KABUL'üne gelen failed da (eski kâhin bunu yok sayıyordu, D7 gereği kabul sayılmaya devam ediyordu → DEĞİŞTİ). Delivered/read'den sonra gelen failed yine yok sayılır (§7a 18; J3 teslimi geri almaz). Dosyada olmayan işin 131049 failed'ı da "almadı" (Meta Bekletti 2. denemesi olamaz; K7). Sıfırlama kâhinde işleri dosyada bırakır (S-13) — orada failed zaten işleniyordu | J3 + §7a 18 + K7 |
| Y9-9 | J4: Süresi Doldu (3 gün + 1 saat payı, §6 W2 / S2 A) işin Meta'nın kabul ettiği SON denemesinin kabul anından; Meta Bekletti 2. denemesi ve Yine de Gönder TTL'yi yeniden başlatır; eski bir denemenin sonradan (iş kimliğiyle) öğrenilen kabulü TTL'yi geri çekmez. Kâhin zaten böyleydi (kural değişmedi; yeni senaryo + mutasyon) | J4 |
| Y9-10 | J5: "Bu Ay Gönderilen" = teslim edilen DENEME sayısı (iş değil); ay = o denemenin İLK teslim bildiriminin zamanı (Türkiye saati, §7a 19); WABA kapsamı; aynı denemenin yinelenen ya da sonraki (read) bildirimi bir daha saymaz; dosyada olmayan işin ve silinmiş şirketin denemeleri DAHİL. Bekletme sonrası iki teslim → 2 (kişiye 2 ileti: J5 metninde BİLİNEN SINIR) | J5 + J1 |
| Y9-11 | J6 kâhine KANCA YANIT katmanı olarak eklendi (çıktıda `kanca_yanitlari {"200", "503"}` yalnız senaryo `kanca_yanit_cikti: true` ise). Programa ULAŞAN her İMZALI bildirim: (a) bildirim kaydedilemiyorsa (`bildirim_yazilamaz`; şirketin dosyası yazılamıyorsa da) 503; (b) bildirimin şirketi geçici açılamıyorsa (`sirket_acilamaz`) 503; (c) wamid'i TANINMAYAN bildirim, program bir Meta yanıtı beklerken (yeni Meta davranışı `gec_kabul`: Meta kabul eder, HTTP yanıtı programın zaman aşımından ÖNCE gecikmeli gelir) ilk görülmesinden en çok 5 dk 503; (d) öbür her durumda 200 (silinmiş — kalıcı — şirket, yinelenen, bekleyen yanıt yokken tanınmayan → 200 ve düşer). 503 alan bildirimi Meta yineler (kâhinde `kanca_kuyrugu` olayı; sahte Meta kuyruğu). Program kapalı / tünel kapalıyken bildirim programa ULAŞMAZ (eski düzen) ve imzasız bildirim kapıcıda düşer — ikisi de sayıma girmez | J6 + D0 20 |
| Y9-12 | J6 "aynı numarayı başka araçla kullananda o aracın bildirimleri de": başka aracın (bilinmeyen wamid, iş kimliği yok) imzalı bildirimi yanıt beklenirken 503, Meta yineleyince (yanıt artık beklenmiyorsa) 200 ve düşer; programın işlerine etkisi yok | J6 |
| Y9-13 | J6 eşgüçlülük: 503'ten sonra yinelenen bildirimle son durum, tek bildirimin vereceği durumla aynı (Teslim Edildi, "Bu Ay" 1, POST 1) | J6 + görev metni |
| Y9-14 | J7 "defterde onarım bekleyen kabul" = Meta'nın kabul ettiği, makine defterine yazılmış ama şirket dosyasına yazılamamış deneme; kâhinde Meta yanıtı geldiği anda `dosya_yazilamaz {sirket}` açıksa oluşur (iş dosyada Gönderiliyor kalır). Varken yeni toplu gönderim BAŞLAMAZ, `baslamadi` nedeni `onarim_bekleyen_kabul` (§7a 29 sırasının SONUNDA). Onarım = dosya yazılabilir olunca iş Meta Kabul Etti; onarımın ZAMANI karar metninde yok → senaryo onarımdan sonra programı kapatıp açar (iki okuma aynı sonuç). §6 W2 "Gönderiliyor istekten önce yazılır" gereği dosyası yazılamayan şirketin işçisi istek göndermez | J7 + §6 W2 |
| Y9-15 | J8 "Tüm Hareketler'in kişiye özel dönemi" tanımı karar metninde yok: kâhinin G6 KAYIT'ı (ilk hareket – o gün) ile öbür okuma (ilk hareket – son hareket) BİRLİKTE — **İLKEYLE G0 (3)** "şüphede aynı dönem" (G6'daki Son 3 Ay birleşimi gibi). Program tek okuma kullanırsa J8-01 / J8-02'den biri ayrışır → OKUMA FARKI, ana oturuma | J8 + G0 (3) |
| Y9-16 | J8 "o günün Bu Ay/Geçen Ay'ı" = Tüm Hareketler gönderiminin (toplu işin açıldığı — G1) günündeki Bu Ay (ayın 1'i – o gün) / Geçen Ay (önceki ayın 1'i – son günü) — D4 tarihleri; eşitse Tüm Hareketler o kişi için O AYIN dönemidir (K1: o takvim ayını gösteren her Bu Ay / Geçen Ay ile aynı dönem — G2 kanon düzeni). Öbür yön (Bu Ay / Geçen Ay gönderiminin KENDİ günündeki tarihleri Tüm'ün kişiye özel dönemine eşit) de aynı dönem (G2 düzeni, G0 3) | J8 + D4 + G1 + G2 |
| Y9-17 | J8 çapraz eşlikte (Tüm ↔ Bu Ay / Geçen Ay) R3 ve Sonucu Belirsiz için Son 3 Ay / Tüm'ün 7 gün penceresi geçerli (G6 düzeni); Zaten Kuyrukta yaşa bakmaz (K2). Senaryolar 7 gün içinde | J8 + K1 + K2 + G6 |
| Y9-18 | J8 "hareketsiz carinin dönemi iletideki dönem": kâhin Tüm Hareketler ileti dönem metnini bilmiyor (ICERIK-08 `plan_susuyor`) → hareketsiz cari için çapraz eşlik HESAPLANMAZ (G6 KAYIT 12.1-2 gibi), senaryo YOK (14.4 S9-2) | J8 + ICERIK-08 |
| Y9-19 | J9 (n3, BİLİNEN SINIR — bugünkü davranış, 2.5.0'da düzelir): aynı kişi + aynı dönem için birinci iş teslimsiz kapanmışken (İptal / Başarısız) açılan ve kuyrukta bekleyen İKİNCİ iş, birincinin geç teslimi geldikten SONRA da gönderilir (gönderim anında R3 yeniden denetlenmez) → kişiye 2 ileti, "Bu Ay" 2. Kâhin bunu BEKLER; senaryo `bilinen_sinir: "n3"` ile işaretli; A seçeneğinin modeli mutasyon (M151) olarak durur — program A'ya geçerse fark "BİLİNEN SINIR kalktı" diye okunur | J9 |

### 14.3 Önceki güncellemelerle çelişen yerler (yeni KARAR geçer)
- **Güncelleme 8 yorum 5** ("dosyada olmayan işin geç teslimi §7a 19 'Bu Ay'a girmez") → **KALKTI** (J1 "geri yüklenmiş / şirket silinmiş olsa da" + J5 "her teslim edilen denemeyi"); M138 eski kuralı tutar.
- **§2 C değişmezi "Bu Ay teslim = Teslim + Okundu İŞ sayısı"** (§7a 19'un kâhin okuması) → J5 ile DENEME sayısı; değişmez artık yalnız her işin tek iletisi olduğu senaryolarda eşitlik, öbürlerinde Teslim + Okundu ≤ Σ "Bu Ay" ≤ Meta'daki ileti.
- **Meta Bekletti'deki iletiye gelen teslim** eski kâhinde YOK SAYILIYORDU (iş durum makinesinde değildi; ne R3 ne "Bu Ay") → J2 ile iş kapanır (Y9-6).
- **"131049 sonrası teslim"**: Meta Bekletti 2. denemesi gittikten SONRA 1. iletinin teslimi eski kâhinde yalnız R3'e giriyor, "Bu Ay"a girmiyordu (iş zaten Teslim) → J5 ile 2 sayılır.
- **Güncelleme 8 yorum 4** (dosyasız failed → Başarısız) → J3 ile TEYİT ve genişleme (wamid'i bilinen kabul de; Y9-8).
- **Aşılmış belirsiz denemenin geç bildirimi** eski kâhinde düşüyordu → Y9-5.
- K3/K7 ekran durumu `secenek` (KÂHİN SUSUYOR 7) DEĞİŞMEDİ: J1 "iş yeniden açılmaz" sayımı söyler, ekran adını söylemez.

### 14.4 KULLANICIYA SORULMALI / KÂHİN SUSUYOR (kodlanmadı — ana oturuma)
- **S9-1 ★ — KAPANDI (kullanıcı 07:07 "Gitmesin" + 07:11 kapsam; §14.10–14.11, J10):** onaylı Yine de Gönder ile yeniden gönderime alınmış ama HENÜZ GİTMEMİŞ işin ESKİ (aşılmış) denemesinin teslimi gelirse yeni deneme gider mi? A: gitmez (J2 düzeni / G0 3 "aldıysa elenir"); B: gider (kullanıcı "iki kez gidebilir" onayını verdi). Kâhin iş durumuna dokunmaz (bugünkü düzen: gider); SENARYO YOK (kâhinde bekleme anı sıfıra yakın).
- **S9-2 — KAPANDI (kullanıcı 07:07 + 07:11; J11):** Tüm Hareketler'de {{3}} dönem metni (hareketli ve hareketsiz cari) plan/kararlarda yok (ICERIK-08); J8'in "iletideki dönem"i bunu varsayar → hareketsiz cari için J8 senaryosuz.
- **S9-3 — KAPANDI (güncelleme 9b: tek okuma, Y9c-7; M149 kalktı, M157 eski birleşimi tutar):** J8 kişiye özel dönemin iki okuması birlikte (Y9-15). Program tek okuma kullanıyorsa ayrışan senaryo OKUMA FARKIDIR.
- **S9-4 (bilgi):** J6 "en çok 5 dk"nın ölçüsü (bildirimin ilk görülmesinden mi, bekleyen yanıtın başından mı) — kime kaç kez değil (gecikme/kayıp); senaryolar bu sınıra yaklaşmaz.
- **S9-5 (bilgi):** J7 onarım bekleyen kabulün BAŞKA şirkette yeni gönderimi engelleyip engellemediği ve öbür ret nedenleriyle sırası; senaryo yalnız tek şirket, öbür ret nedeni yokken.
- **S9-6 (bilgi):** J8 çapraz eşlikte 7 gün penceresi (Y9-17, G6 düzeni) ile G0 (3) "şüphede aynı dönem" 7 günden eski durumda çatışabilir; senaryosuz.

### 14.5 Kodlama sırasında eklenen kâhin ayrıntıları (programa bakılmadan; 14.2'nin uzantısı)
- **Y9-16 ek:** Tüm Hareketler kişi için bir ayın dönemiyse (kanon), kendi gününde o aya eşit özel aralıkla da (G2 2. yarısı) aynı dönem (J8-06). Son 3 Ay'a kanon verilmez (J8 yalnız Tüm Hareketler'i söyler).
- **Y9-5 ek:** aşılmış denemenin iş kimliğiyle öğrenilen kabulü programın bildiği kabullere girer (iş çıktısında `kabul` sayısı +1; `kabul ≤ meta_ileti ≤ post` değişmezi korunur).
- **Y9-11 ek:** "yanıt beklenirken" = program açıkken HERHANGİ bir işin Meta yanıtı bekleniyor (`gec_kabul` penceresi); tanınmayan bildirimin "ilk görülmesi" (wamid, durum, Meta zamanı) anahtarıyla.
- **Girdi biçimi:** `meta_davranis.kanca` anahtarı iş de olabilir (`"T1/B"`; önceki öncelik: iş → cari → `*`) — aynı kişinin farklı işlerindeki ilk iletileri ayırmak için; eski senaryolarda böyle anahtar yok.
- **İşçi:** şirket dosyası yazılamıyor (`dosya_yazilamaz`) ya da şirket geçici açılamıyorken (`sirket_acilamaz`) o şirketin işçisi istek göndermez (§6 W2 "Gönderiliyor istekten önce yazılır"); senaryolarda o sırada başka iş yok.

### 14.6 Senaryolar (29) ve mutasyonlar (17)
| Karar | Senaryo | Sınır | Mutasyon (yakalayan) |
|---|---|---|---|
| J1 | J1-01 Meta Bekletti iken duraklatılmış işe teslim → kapanır, Devam Et göndermez · J1-02 Süresi Doldu → 4. gün teslim → "Daha Önce Gönderildi", "Bu Ay" Kasım · J1-03 silinmiş şirket: geç teslim (ortak WABA "Bu Ay" 2) + geç failed, 6 × 200 · J1-04 aşılmış belirsiz geç teslim → "Bu Ay" 2 · J1-05 aşılmış belirsiz geç teslim, Yine de Gönder Başarısız → "Daha Önce Gönderildi" (eski: Sonucu Belirsiz) · J1-06 Meta Bekletti ret + geç teslim → yeniden deneme "Daha Önce Gönderildi" | silinmiş şirket, ay dönümü | M137 (J1-01), M138 + M146 (J1-03), M152 (J1-04) |
| J2 | J2-01 Meta Bekletti + teslim → Teslim Edildi, POST 1, PDF silinir · J2-02 read → Okundu | 24 sa | M139 (J2-01) |
| J3 | J3-01 yedeğe dönüş sonrası defterdeki kabule geç failed → gider · J3-02 sıfırlama sonrası geç failed · J3-03 aşılmış belirsizin geç failed'ı + Yine de Gönder Başarısız → gider (eski: Sonucu Belirsiz) · J3-04 eski denemenin failed'ı şu anki kabulü bozmaz | geri yükleme, sıfırlama | M140 (J3-01), M153 (J3-04), M152 (J3-03 de) |
| J4 | J4-01 Meta Bekletti 2. denemesinden 73 sa (80. sa Gönderildi, 98. sa Süresi Doldu) · J4-02 Yine de Gönder kabulünden 73 sa | 73 sa | M141 (J4-01) |
| J5 | J5-01 bekletme sonrası iki teslim → 2 (BİLİNEN SINIR) · J5-02 01.11 01:00 (UTC 31.10) teslim → Ekim 1 + Kasım 1 | gece yarısı yerel ≠ UTC | M142 (J5-01) |
| J6 | J6-01 gecikmeli yanıt: A'nın 2 bildirimi + başka aracın bildirimi 503, yinelenince 200 (3 × 200, 3 × 503), son durum tek bildirimle aynı · J6-02 şirket geçici açılamaz (2 × 200, 1 × 503) · J6-03 bildirim kaydedilemez | 5 dk penceresine yaklaşılmaz | M143 (J6-01), M144 (J6-02), M145 (J6-03, J7-02) |
| J7 | J7-01 onarım bekleyen kabul → yeni gönderim BAŞLAMAZ ("onarim_bekleyen_kabul"); onarım + yeniden açılış sonrası A "Daha Önce Gönderildi", C gider · J7-02 onarım sırasında gelen bildirim yinelenir, tek ileti | yeniden açılış | M147 (J7-01) |
| J8 | J8-01 Tüm (01.11–05.11) ↔ aynı gün Bu Ay · J8-02 Tüm (01.10–31.10, ilk–son hareket) ↔ aynı gün Geçen Ay · J8-03 03.11 Tüm kanon → 05.11 Bu Ay · J8-04 Tüm bekleyen ↔ Bu Ay "Zaten Kuyrukta" · J8-05 31.10 23:30 Tüm → 01.11 00:30 Geçen Ay · J8-06 03.11 özel (Kasım kanonu) → 05.11 Tüm | ay sonu, gece yarısı yerel ≠ UTC, 2 gün | M148 (J8-01), M149 (J8-02), M150 (J8-03), M123 (J8-05 de) |
| J9 | J9-01 Meta Bekletti → İptal → ikinci iş duraklatılmış → geç teslim → Devam Et ile 2. ileti · J9-02 failed → ikinci iş → geç teslim → 2. ileti (ikisi `bilinen_sinir: n3`) | — | M151 (J9-01; A seçeneği) |

**Eski kâhinle (9086b097, ayrı `git archive` kopyası) yeni 29 senaryo:** 21'i FARKLI, 8'i AYNI. AYNI olanlar zaten böyleydi: J1-02, J1-06 (K3/§7a 17), J3-02 (sıfırlamada iş dosyada), J3-04 (eski kâhin
eski denemenin failed'ını düşürüyordu — iş yine Gönderildi kalıyordu), J4-01/J4-02 (TTL zaten son kabulden), **J9-01/J9-02 (n3 bugünkü davranış — eski kâhin de 2 ileti
bekliyordu)**. FARKLI'ların 6'sı yalnız yeni girdi türünden (J1-03 `sirket_sil`, J6-01 `gec_kabul`, J6-02/03, J7-01/02 yeni olaylar — eski kâhin tanımıyor); 15'i kural farkı
(J1-01, J1-04, J1-05, J2-01, J2-02, J3-01, J3-03, J5-01, J5-02, J8-01…06). Karşılaştırmada eski kopyaya YALNIZ iş anahtarlı kanca planı satırı taşındı (girdi biçimi, kural değil).
Kanıt `docs/kanit/2026-11-01/248-kahin9-eski-kahinle-yeni-senaryolar.txt`.

### 14.7 Değişen eski beklentiler (244 eski senaryonun TAM model sonucu, `git show 9086b097:…/senaryolar.json` ile)
**4 senaryo değişti, hepsinde YALNIZ `bu_ay`; elle beklenenlerin hiçbiri değişmedi (244/244 elle = model):**
| Senaryo | Eski → yeni | Neden (KARAR) |
|---|---|---|
| E4-01-son-3-ay-sonraki-teslim-7-gun | `bu_ay.W1` {2026-10: 1} → {2026-10: 1, 2026-11: 1} | J5: aynı işin iki teslim edilen denemesi (Y1 30.10, Y3 06.11) ayrı sayılır |
| E4-02-tum-hareketler-sonraki-teslim-7-gun | aynı | J5 |
| H3-01-geri-yukleme-dosyasiz-gec-kabul | `bu_ay.W1.2026-10.teslim` 1 → 2 | J1 + J5: dosyada olmayan işin geç teslimi "Bu Ay"a girer (güncelleme 8 yorum 5 kalktı) |
| H3-02-geri-yukleme-meta-bekletti-gec-teslim | `bu_ay` {} → {W1: {2026-10: 1}} | J1 + J5 (aynı) |
Öbür 240 senaryonun tam sonucu bayt bayt aynı. Kanıt `docs/kanit/2026-11-01/248-kahin9-eski-244-fark.txt`.

### 14.8 Sürücü için (S-18 … S-26; programa karşı koşmadan önce gereken yeni eşlemeler)
- **S-18 iş anahtarlı kanca planı:** `meta_davranis.kanca["T1/B"]` → sahte Meta kuralı o işin iletisine (opaque = programın iş kimliği) bağlanmalı; öncelik iş → cari → `*`.
- **S-19 `gec_kabul`:** `{"gec_kabul": "+10s"}` → sahte Meta `{gecikmeMs: 10000}` ama süre PROGRAMIN zaman aşımından KISA olmalı — **gecikme < 15 sn** (programın Meta istek zaman aşımı 15 sn; 9d) (D0: zaman aşımı bilinmiyor; programın değeri okunup senaryo süresi altında kaldığı doğrulanmalı — değilse senaryo GEÇERSİZ, fark sayılmaz). Kanca bu sırada (yanıttan ÖNCE) programa ulaşmalı.
- **S-20 kanca yanıt sayımı:** `kanca_yanit_cikti` senaryolarında sahte Meta'nın programa yaptığı İMZALI kanca POST'larının HTTP kodları sayılır (`{"200": n, "503": m}`); bağlantı kurulamayan / program kapalı teslimler ve imzasız olaylar sayılmaz. `kanca_kuyrugu` olayı = sahte Meta kuyruğunu işlet (`/__sahte/kanca/kuyruk`).
- **S-21 `sahte_kanca` + `imzali: true`:** başka aracın bildirimi — sahte Meta'nın İMZALI ama bilinmeyen wamid'li, opaque'sız olayı (`kanca/ham` imzalı).
- **S-22 `sirket_sil {sirket}`:** programda şirketi kalıcı sil (Şirketi Sil); sonra öbür şirkette (aynı WABA) "Bu Ay" okunur; silinen şirketin toplu işleri / işleri sonuçtan düşer (`toplular`, `isler` yalnız kalan şirket); `meta.post` dosyadaki işlerden (bilinen ihlal `post_toplam`).
- **S-23 `sirket_acilamaz {sirket, acik}`:** şirket dosyasını geçici açılamaz yap (ör. başka süreçte özel kilit) ve geri al; **`bildirim_yazilamaz {acik}`:** bildirim kaydı yazılamaz (ör. bildirim/defter dosyası yazma kilidi); ~~`dosya_yazilamaz {sirket, acik}`~~ (9d'de KALKTI) → **`defter_yazilamaz {acik}`:** GÖNDERİM DEFTERİ (makine düzeyi) yazmaya kapalı, şirket dosyası yazılabilir (J7, §14.15). Sürücü her birinin gerçekten oluştuğunu (programın yanıtı/günlüğü) okumalı — oluşmadıysa senaryo GEÇERSİZ.
- **S-24 J7 okunacak:** yeni gönderim başlatma yanıtının nedeni → `baslamadi.<etiket> = "onarim_bekleyen_kabul"` (programın Türkçe nedeni eşlenir); onarımdan sonra `kapat` / `ac`.
- **S-25 `bilinen_sinir`:** `n3` / `J5` işaretli senaryoda fark çıkarsa önce "BİLİNEN SINIR kalktı mı" diye okunur (J9-01/02: POST 1 çıkarsa program A seçeneğine geçmiş demektir — hata değil, ana oturuma).
- **S-26 J8:** dönem `"tum"` + hareket tarihleri 1'i / ay sonu olan cariler (P, Q, S); program "kişiye özel dönem"i tek okumayla hesaplıyorsa J8-01 ya da J8-02'den biri ayrışır → OKUMA FARKI (14.4 S9-3).
- Gözlemler: iş durumları (kontrol anlarında), `meta.post`, `bu_ay` (WABA × ay), `elenen` / `olusmadi` / `onceki_uyari`, `yeniden`, `baslamadi`, `kanca_yanitlari`, `isler.*.medya_silme`.

### 14.9 Kanıt ve DENENMEYEN
- Kendi testi **296/296** (F mutasyon **153/153**; yeni I7: BİLİNEN SINIR işaretleri + kanca yanıt sayıları); senaryolar **273/273** elle = model; kanıt `docs/kanit/2026-11-01/248-kahin9-*`.
- DENENMEYEN: programa karşı sürücü koşusu (görev gereği; S-18…S-26 eşlemeleri yazılmadı); S9-1 (bekleyen Yine de Gönder + eski denemenin teslimi); hareketsiz cari J8 (S9-2); J6 5 dk sınırı (S9-4);
  J7 başka şirkete etkisi / öbür ret nedenleriyle sırası (S9-5); J8 7 günden eski çapraz eşlik (S9-6); gerçek "Şirket Verisini Sıfırla"nın işleri silmesi (S-13); sahte Meta sunucusu testleri
  YENİDEN KOŞULMADI (sahte-meta/ değişmedi).

### 14.10 Güncelleme 9b — S9-1 ve S9-2 kullanıcı kararları (KARAR 01.11.2026 07:07 UTC) — yorumlar (kodlamadan ve karşılaştırmadan ÖNCE)
Kaynak: CLAUDE.md "Açık iş" KARAR 07:07 UTC (AYNEN `kahin.KARARLAR` J10 = S9-1 "Gitmesin", J11 = S9-2 "İlk hareket – gönderim günü"). Program kodu görülmedi.
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y9b-1 | İşteki Yine de Gönder ile yeniden gönderime alınmış, yeni denemesi HENÜZ İSTEK OLARAK GİTMEMİŞ iş (Bekliyor / Sınır Nedeniyle Bekliyor / Duraklatıldı / Lisans Nedeniyle Durdu / açılışta sorulan) için eski (aşılmış) denemenin imzalı delivered/read bildirimi gelirse yeni deneme GİTMEZ: iş Teslim Edildi (read → Okundu) olur — J2 Y9-6 düzeni (PDF silinir, "Bu Ay" o deneme için +1), sonra "Daha Önce Gönderildi". Eski denemenin "sent"i (kabul) ya da failed'ı (almadı, J3) işi kapatmaz — yeni deneme gider | J10 (S9-1) + G0 (3) |
| Y9b-2 | **İLKEYLE G0 (3)** (kullanıcı kararı değil, aynı kural): Başarısızları Yeniden Dene ile yeniden gönderime alınmış işte de eski (Başarısız sayılmış) denemenin geç teslimi gelirse yeniden deneme GİTMEZ (J1 "teslim her durumda" + ilke 3 "aldıysa elenir") | J1 + G0 (3) |
| Y9b-3 | Tüm Hareketler {{3}} = "<ilk hareket> – <gönderim günü>"; ilk hareket = carinin EN ESKİ hareket tarihi; gönderim günü = iletinin GERÇEKTEN gönderildiği yerel gün (G1 metnindeki "gönderim günü" anlamında — toplu işin açıldığı gün değil; günlük sınırla ertesi güne kayan kişinin metni ertesi günü yazar). Hareketsiz cari "<gönderim günü> – <gönderim günü>". ICERIK-08'in `plan_susuyor` yaprağı KALKAR. PDF içeriği DEĞİŞMEZ (bütün hesap, devir 0; S9-2 yalnız {{3}}'ü söyler) | J11 (S9-2) + G1 |
| Y9b-4 | S9-3 yeniden: J8 "kişiye özel dönem" = iletideki dönem (J8 "hareketsiz carinin dönemi iletideki dönem" + S9-2) = ilk hareket – gün → TEK OKUMA; Y9-15'in "ilk – son hareket" okuması DÜŞER (J8-02'nin beklentisi değişir: Q'nun dönemi 01.10–05.11 ≠ Geçen Ay → gider). Kalan tek ayrım "gün": eşlikte G1 "toplu işin açıldığı gün", iletide S9-2 "gönderim günü"; ikisi ayrı düşerse (sınırla ertesi gün) bir denemenin dönemi İKİ gün ucuyla da eşleşir — **İLKEYLE G0 (3)** şüphede aynı dönem. Yeni toplu işin kendi bağlamı açılış günüyle (gönderim günü henüz yok) | J8 + J11 + G1 + G0 (3) |
| Y9b-5 | Hareketsiz cari artık eşleşir: dönemi (gün, gün); ayın 1'inde o günün Bu Ay'ına eşit → o ayın dönemi (Y9-16 kanonu); özel aralık (gün – gün) ile G6 eşliği; 7 gün penceresi (Y9-17) aynen. Y9-18 ve 14.4 S9-2 KAPANDI | J8 + J11 |

### 14.11 Güncelleme 9b eki — S9-1 kapsamı ve S9-2 günü (KARAR 01.11.2026 07:11 UTC) — yorumlar (kodlamadan ve karşılaştırmadan ÖNCE)
Kaynak: CLAUDE.md KARAR 07:11 UTC (AYNEN `kahin.KARARLAR` J10 ve J11'e eklendi) + ana oturumun iletisi ("iş 'Atlandı — Daha Önce Gönderildi', Bu Ay değişmez" — bu ayrıntı
CLAUDE.md satırında YOK, yalnız iletide; ana oturum teyit etsin). **14.10'un Y9b-2'si, Y9b-3'ün "gerçekten gönderildiği gün" kısmı ve Y9b-4'ün gün birleşimi bu kararla DÜŞTÜ.**
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y9c-1 | S9-1 yalnız BELİRSİZLİK ONAYLARINI kapsar: (a) Sonucu Belirsiz işteki Yine de Gönder (asıl işte belirsiz kalan denemeye verilen dahil — G0-02 yolu) iş üzerinde "belirsizlik onayı" izi bırakır. Yeni ileti henüz istek olarak gitmemişken o işin ESKİ bir iletisinin imzalı delivered/read bildirimi gelirse yeni ileti GİTMEZ: iş **Atlandı**, atlanma nedeni **daha_once_gonderildi**; PDF silinir (teslim kesin durum, §11 S3) | J10 (07:11 a) + ileti |
| Y9c-2 | (c) Başarısızları Yeniden Dene YALNIZ (a) zincirindeki işte kapsanır (iş daha önce belirsizlik onayıyla gönderildiyse iz yeniden denemeye taşınır). Zincir dışındaki düz yeniden denemede eski iletinin geç teslimi yeni iletiyi DURDURMAZ — ikinci kopya gider (J1 gereği teslim yine sayılır: R3, "Bu Ay") | J10 (07:11 c) |
| Y9c-3 | (b) Yeni gönderimde R3 "Daha Önce Gönderildi" uyarısına rağmen bilerek seçilen Yine de Gönder KAPSANMAZ: önceki işin iletisi bu yeni iş beklerken teslim edilse de yeni ileti gider (ikinci kopya — kullanıcının bilerek verdiği karar; J9 n3 ile karışmaz: n3'te uyarı yoktu) | J10 (07:11 b) |
| Y9c-4 | "Bu Ay değişmez" (yalnız iletide) = ATLANAN yeni ileti hiçbir şey saymaz; eski iletinin teslimi J5 ("her teslim edilen denemeyi sayar", kullanıcı kararı) gereği SAYILIR. Öbür okuma (eski teslim de sayılmaz) J5 ile çelişir → kâhin J5'i uygular; ana oturum teyit etsin | J5 + ileti |
| Y9c-5 | S9-2 günü: "gönderim günü" = gönderimin (toplu işin) AÇILDIĞI, ekstre ve bakiyenin hazırlandığı gün; gönderim sınırla ertesi güne kaysa da {{3}} açılış gününde kalır. Yeniden deneme / Yine de Gönder asıl işin açılış gününü taşır (K4 + G1). Tüm Hareketler {{3}} = "<ilk hareket> – <açılış günü>", hareketsiz "<açılış günü> – <açılış günü>" | J11 (07:11) + G1 + K4 |
| Y9c-6 | "Metin PDF ile aynı": Tüm Hareketler PDF'inin dönem uçları da {{3}} ile aynı (`pdf.donem_bas` = ilk hareket / hareketsizde açılış günü, `pdf.donem_son` = açılış günü; eskiden None). Devir 0 ve hareketler "bütün hesap" olarak DEĞİŞMEZ (açılış gününden SONRA tarihli hareketin PDF'e girip girmediği karar metninde yok — senaryolarda böyle hareket yok; bilgi) | J11 (07:11 "metin PDF ile aynı") |
| Y9c-7 | J8 eşliği: kişiye özel dönem = iletideki dönem = ilk hareket – AÇILIŞ günü → TEK okuma, gün birleşimi YOK (G1 ile de aynı gün). S9-3 KAPANDI | J8 + J11 + G1 |
| Y9c-8 | KARAR "ekstre ve bakiyenin hazırlandığı gün" der; kâhin içerik okumasını §7a 1 gereği (veri GÖNDERİM ANINDA okunur — ICERIK-09, KISI-01, ICERIK-12) DEĞİŞTİRMEDİ; yalnız {{3}}/PDF dönem günü açılış günü. Program içeriği açılışta donduruyorsa ICERIK-09 ailesi ayrışır — bu §7.4 madde 15'teki bilinen fark (T2-6 baş mimar "içerik ilk hazırlıkta donar"); bilgi, ana oturuma | §7a 1 + J11 |

### 14.12 Güncelleme 9b sonuçları (senaryolar, mutasyonlar, değişen beklentiler, sürücü, kanıt)
**Senaryolar (8):**
| Karar | Senaryo | Mutasyon (yakalayan) |
|---|---|---|
| J10 (a) | J10-01 işteki Yine de Gönder SINIRDA bekliyor, eski iletinin teslimi → Atlandı (daha_once_gonderildi), POST 1, "Bu Ay" 2 (eski teslim J5 ile sayılır) · J10-02 Yine de Gönder + hemen Duraklat → Atlandı, Devam Et göndermez | M154 (J10-01; J10-02 de) |
| J10 (c) | J10-03 (a) zinciri: belirsiz → Yine de Gönder Başarısız → 1. iletinin geç failed'ı → Başarısızları Yeniden Dene duraklatıldı → 1. iletinin teslimi → yeniden deneme GİTMEZ (Atlandı) · J10-04 düz yeniden deneme (onay izi yok) → eski teslime rağmen GİDER (2 ileti) | M154 (J10-03), M160 (J10-04) |
| J10 (b) | J10-05 T1 kabul (teslimsiz) → T2'de R3 Yine de Gönder, duraklatıldı → T1 teslim → T2/B GİDER (ikinci kopya) | M161 (J10-05) |
| J11 | J11-01 05.11 23:30 Tüm, sınır 1: R ertesi gün gider ama {{3}} ve PDF "15.10.2026 – 05.11.2026" (açılış günü) · J11-02 hareketsiz: 01.11 Tüm "01.11.2026 – 01.11.2026" → 03.11 Bu Ay elenir; 05.11 Tüm "05.11.2026 – 05.11.2026" → Bu Ay gider, özel 05.11–05.11 elenir · J11-03 ertesi güne kayan U: 07.11 özel 01.11–06.11 GİDER, özel 01.11–05.11 elenir | M155, M158 (J11-01), M156 (J11-02), M159 (J11-03), M157 (J8-02), M162 (ICERIK-08) |

**Mutasyon:** 161/161 (M149 kalktı — güncelleme 9b'de doğru model oldu; yeni M154–M162).

**Değişen beklentiler** (tam model sonucu; kanıt `docs/kanit/2026-11-01/248-kahin9b-fark-*.txt`):
- J11 (S9-2 + 07:11) — Tüm Hareketler `degiskenler[2]` `{"plan_susuyor"}` → "<ilk hareket> – <açılış günü>" ve `pdf.donem_bas/donem_son` None → aynı tarihler: **ICERIK-08** (elle de: "10.09.2026 – 30.10.2026", PDF 2026-09-10 / 2026-10-30), **K1-05** (elle de: T2/Y PDF 2026-01-15 / 2026-10-31), K1-06, K2-02, D3-02, E4-02, G6-02, G6-04 (yalnız tam sonuç), güncelleme 9'un J8-01, J8-03, J8-04, J8-05 (yalnız tam sonuç).
- S9-3 tek okuma (Y9c-7) — **J8-02**: Q artık ELENMEZ (dönemi 01.10–05.11 ≠ Geçen Ay); elle değişti (elenen {} , T2 iki iş, POST Q 2).
- Güncelleme 9'dan beri değişmeyen: E4-01 (J5), H3-01/H3-02 (J1 + J5) §14.7'deki gibi. Öbür eski senaryoların tam sonucu bayt bayt aynı (9086b097'ye göre 244'ün 11'i, da86a2df'ye göre 273'ün 13'ü değişti).

**Sürücü için (S-27 … S-31):**
- **S-27 (J10 a/c):** işteki Yine de Gönder / Başarısızları Yeniden Dene'den HEMEN sonra (aynı anda) Duraklat ya da günlük üst sınırla bekletme; 1. iletinin gecikmeli imzalı kancası (iş anahtarlı plan, S-18). Okunacak: iş durumu "Atlandı" + atlanma nedeni "Daha Önce Gönderildi" → `daha_once_gonderildi`; POST sayısı; Devam Et sonrası yeni POST yok.
- **S-28 (J10 c):** 1. iletiye önce `failed` sonra `delivered` (aynı wamid) kancası; programın yeniden denemeyi kabul ettiği (alınan) okunur.
- **S-29 (J10 b):** T2 başlatmada R3 uyarısında "Yine de Gönder" (`onceki: "gonder"`) + aynı anda Duraklat; T1'in teslimi; Devam Et → T2/B POST'u.
- **S-30 (J11):** Tüm Hareketler ileti değişkeni {{3}} ve PDF'teki dönem metni okunur (iki tarih); günlük sınırla ertesi güne kayan kişide de açılış günü beklenir. PDF'te "bütün hesap" (devir 0, hareket sayısı) aynen.
- **S-31 (J11 hareketsiz):** hareketi olmayan cari kurulur (`hareketler: []`); sahte saat 01.11 / 03.11 / 05.11.

**KÂHİN SUSUYOR / bilgi (9b):** Y9c-4 ("Bu Ay değişmez" — eski teslim J5 ile sayılır; ana oturum teyit), Y9c-6 (açılıştan sonra tarihli hareketin Tüm Hareketler PDF'ine girip girmediği),
Y9c-8 (içerik okuma anı §7a 1 ↔ KARAR "ekstre ve bakiyenin hazırlandığı gün"; ICERIK-09 ailesi). DENENMEYEN: programa karşı sürücü koşusu.

**Kanıt:** kendi testi **304/304** (F mutasyon **161/161**), `TZ=UTC` ve `TZ=Europe/Istanbul`; senaryolar 281/281 elle = model; `docs/kanit/2026-11-01/248-kahin9b-*`.

### 14.13 Güncelleme 9c — ekstre içeriği açılışta hazırlanır (KARAR 01.11.2026 07:11 seçenek metni) — yorumlar (kodlamadan ve karşılaştırmadan ÖNCE)
Kaynak: kullanıcının 07:11'de seçtiği seçeneğin metni AYNEN (ana oturum iletisi; `kahin.KARARLAR` J12): "'Gönderim günü' = gönderimin açıldığı, ekstrenin ve bakiyenin hazırlandığı gün.
İleti metni PDF'teki dönem ve bakiyeyle aynı kalır (ekstre tarihi = düzenleme tarihi, yaygın uygulama)." — sorunun metni "Ekstre PDF'i ve bakiye açılış gününde hazırlanıyor".
Ana oturum: bu karar §7a 1'in "içerik gönderim anında okunur" yorumunun ekstre için YERİNE geçer.
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y9d-1 | Ekstre İÇERİĞİ — {{1}} cari adı, {{2}} firma, {{3}} dönem, {{4}} bakiye, PDF (cari adı, dönem, devir, hareketler, dönem sonu bakiyesi), dosya adı — toplu işin AÇILIŞINDA hazırlanır; gönderim ertesi güne kaysa, kuyrukta hareket girse, Başarısızları Yeniden Dene / Yine de Gönder ile yeniden gönderilse de DEĞİŞMEZ (aynı iş = aynı ekstre; K4). ICERIK-09'un beklentisi değişir (kuyrukta giren hareket ekstreye girmez) | J12 + K4 |
| Y9d-2 | §7a 1'in öbür kısmı DEĞİŞMEZ: telefon ve eleme denetimleri (İstemiyor / silinmiş / pasif / E.164'e çevrilemeyen → Atlandı, §7a 2) GÖNDERİM ANINDA (KISI-01, KISI-09/10/15). Ödeme Hatırlatma (PDF'siz: vade, gecikmiş toplam, güncel bakiye) gönderim anında okunmaya devam eder (ICERIK-12) — karar metni ekstreyi ve PDF'i söylüyor; bilgi, ana oturum teyit etsin | §7a 1, §7a 2 + J12 |
| Y9d-3 | Y9c-6 ÇÖZÜLDÜ: Tüm Hareketler içeriği açılış gününe kadar (≤ açılış günü) tarihli hareketler; açılış gününden SONRA tarihli hareket PDF'e, hareket sayısına ve bakiyeye GİRMEZ (dönem = ilk hareket – açılış günü + §7a 22 "dönem sonundan sonraki hareket girmez"); devir 0 | J11 + J12 + §7a 22 |
| Y9d-4 | Y9c-4 teyit (ana oturum): atlanan yeni ileti sayılmaz, eski iletinin teslimi J5 ile sayılır; "Atlandı" / "Bu Ay değişmez" adlandırması BAŞ MİMAR KARARI | ana oturum |
| Y9d-5 | Kâhin iç düzeni: içerik `baslat`'ta hesaplanır (eski M58'in içerik yarısı artık doğru model); M58 bundan sonra yalnız "telefon başlatmada okunur"; yeni M163 = eski düzen (ekstre içeriği gönderim anında) | J12 |

### 14.14 Güncelleme 9c sonuçları
- **Kâhinde:** ekstre içeriği `baslat`'ta hazırlanır (`hazir`), işe ilk işçi ziyaretinde yazılır ve bir daha okunmaz (gönderilmemiş işin çıktısı eskisi gibi boş kalır — sürücü içeriği Meta'ya gidenden okur); telefon ve eleme her gönderimde; hatırlatma gönderim anında; Tüm Hareketler içeriği ve kişiye özel dönem ≤ açılış günü tarihli hareketlerle.
- **Senaryolar (3):** J12-01 Yine de Gönder açılıştaki ekstreyi gönderir (kuyrukta giren 1.000 TL girmez; 2.000,00 TL) · J12-02 Tüm Hareketler: açılıştan sonra tarihli hareket girmez (05.10–30.10, 300,00 TL); yalnız ileri tarihli hareketi olan cari hareketsiz gibi (30.10–30.10, 0,00 TL) · J12-03 sınırla ertesi gün + kuyrukta hareket → açılıştaki gibi.
- **Mutasyonlar (2):** M163 (ekstre içeriği gönderim anında — eski §7a 1 yorumu) ← ICERIK-09; M164 (açılıştan sonra tarihli hareket girer) ← J12-02. M58 artık "telefon başlatmada" (← KISI-01). Toplam **163/163**.
- **Değişen beklentiler:** yalnız **ICERIK-09** (elle de): T2/B {{4}} "3.000,00 TL" → "2.000,00 TL", PDF dönem sonu 3000.00 → 2000.00, hareket sayısı 2 → 1 (J12). 9b'nin öbür 280 senaryosunun tam sonucu bayt bayt aynı; 9086b097'ye göre 244 eski senaryonun 12'si değişti (§14.7 + §14.12 + ICERIK-09). Kanıt `docs/kanit/2026-11-01/248-kahin9c-*`.
- **Sürücü (S-32):** ekstre içeriği (Meta'ya giden değişkenler + PDF) kuyrukta giren hareketten, ertesi güne kaymadan ve Yine de Gönder'den etkilenmez; `cari.hareket_ekle` olayı programa kuyruktayken girilir. Hatırlatma değişkenleri gönderim anında (ICERIK-12 aynen).
- **Bilgi (ana oturum):** Y9d-2 — Ödeme Hatırlatma'nın gönderim anında okunması sürdü (karar ekstre / PDF der).
- **Kanıt:** kendi testi **307/307** (F **163/163**), `TZ=UTC` ve `TZ=Europe/Istanbul`; senaryolar 284/284.

### 14.15 Güncelleme 9d — J7 yorum DÜZELTMESİ + J7 senaryo düzeneği (kodlamadan ve karşılaştırmadan ÖNCE)
Kaynak: kullanıcıya 01.11.2026 06:28'de onaya sunulan ve AYNEN onaylanan liste metninin 7. maddesi (ana oturum iletisi; `kahin.KARARLAR` J7'ye eklendi): "Gönderim defteri
onarılmadan yeni gönderim başlamaz. Meta'nın kabulü deftere yazılamadıysa yeni gönderim düğmesi pasif kalır ve ekranda nedeni yazar. Böylece ikinci ileti gitmez."
CLAUDE.md'deki "defterde onarım bekleyen kabul varken" bunun özetidir.
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y9e-1 | **Y9-14 DÜŞTÜ** (ters okumaydı: "defterde var, şirket dosyasına yazılamadı"). "Onarım bekleyen kabul" = Meta'nın kabul ettiği (şirket dosyasında iş Meta Kabul Etti olabilir) ama kabulün GÖNDERİM DEFTERİNE yazılamadığı deneme. Kâhinde yeni olay `defter_yazilamaz {acik}` (makine düzeyindeki gönderim defteri yazılamıyor); Meta yanıtı geldiğinde açıksa iş dosyada Meta Kabul Etti olur, denemenin kabulü defterde EKSİK kalır (onarım bekler). Eski `dosya_yazilamaz` olayı ve onun onarım yolu KALKTI | liste metni madde 7 |
| Y9e-2 | Onarım bekleyen kabul varken yeni toplu gönderim BAŞLAMAZ, neden `onarim_bekleyen_kabul` (aynen); onarım = defter yeniden yazılabilir olunca eksik kabul deftere yazılır; onarımdan sonra yeni gönderim başlar ve aynı kişi aynı dönemde "Daha Önce Gönderildi" (ikinci ileti gitmez) | liste metni madde 7 |
| Y9e-3 | Defter yazılamazken gelen bildirim kaydedilemez → 503 (J6 a; Meta yineler); işçi yeni istek göndermez (§6 W2 "Gönderiliyor istekten önce yazılır" — talep deftere yazılamaz) | J6 + §6 W2 |
| Y9e-4 | Senaryo düzeneği (kural değil): `gec_kabul` gecikmesi programın Meta istek zaman aşımının (15 sn — sürücü README S-19 kuralı) ALTINDA olmalı; J7 senaryoları +10 sn'ye indirildi (J7-01/J7-02'nin +20 sn'si GEÇERSİZ sayılıyordu) | ana oturum + sürücü |

### 14.16 Güncelleme 9d sonuçları
- **Kâhinde:** `dosya_yazilamaz` olayı, `onar()` ve işin "Gönderiliyor'da onarım" yolu KALKTI; yerine `defter_yazilamaz {acik}`: Meta yanıtı gelince iş dosyada Meta Kabul Etti, denemede `onarim`
  işareti (kabul defterde eksik); işaret varken yeni gönderim `onarim_bekleyen_kabul` ile başlamaz; defter yazılabilir olunca işaret kalkar; defter yazılamazken bildirim 503 ve
  işçi istek göndermez. 14.2 Y9-11'deki "(şirketin dosyası yazılamıyorsa da)" ve 14.5 "İşçi" maddesindeki `dosya_yazilamaz` bu güncellemeyle geçersiz.
- **Senaryolar:** J7-01 ve J7-02 yeni düzenekte (`defter_yazilamaz` +7 sn → +5 dk; `gec_kabul` +10 sn < 15 sn). Beklenen sonuçları AYNI; J7-02'ye kanca yanıt sayımı eklendi
  ({"200": 4, "503": 2} — onarım sırasında A'nın 2 bildirimi 503, yinelenince 200; C'nin 2 bildirimi 200). Öbür 282 senaryonun girdisi ve beklenen sonucu AYNI
  (`docs/kanit/2026-11-01/248-kahin9d-fark-9c.txt`; araç `248-kahin9-araclar/fark_json.py` — eski girdi yeni kâhinde koşulamadığı için adla karşılaştırır).
- **Mutasyon:** M165 (defter yazılabilir olunca onarım yapılmaz) ← J7-01; M147 ← J7-01; toplam **164/164**.
- **Sürücü:** S-19 "gecikme < 15 sn"; S-23 `defter_yazilamaz` = gönderim defteri (makine düzeyi) yazma kilidi, şirket dosyası yazılabilir; programın kabulü deftere yazamadığı
  (günlük / yanıt) okunmalı, oluşmadıysa senaryo GEÇERSİZ. S-24 aynen (neden `onarim_bekleyen_kabul`, onarımdan sonra kapat / aç).
- **Kanıt:** kendi testi **307/307** (F **164/164**), `TZ=UTC` ve `TZ=Europe/Istanbul`; `docs/kanit/2026-11-01/248-kahin9d-*`.

## 15. Kâhin güncellemesi 10 — 2.4.9 W: teslim süresi 30 gün (KULLANICI KARARI 03.11.2026) — yorumlar (kodlamadan ve programla karşılaştırmadan ÖNCE)

### 15.1 Kaynak ve bağımsızlık
Kaynak YALNIZ karar metinleri (AYNEN `kahin.KARARLAR` W1): `docs/2.4.9-IS-LISTESI.md` "KULLANICI KARARI (03.11 ~18:45 UTC, W SORU T0)" satırı ve
`docs/2.4.9-tasarim/W-whatsapp-sablon.md` §15 "KULLANICI KARARI + ANA OTURUM ONAYI (03.11.2026 ~18:50 UTC)" (karar metni olarak; §7 SORU T0/T1/T2 ve §8 "Nasıl bozulur?"
yalnız sorunun ve düşen soruların bağlamı için okundu). Öncekiler aynen: §7a 16 (kanca yolu + TTL + 1 sa), §6 W2, J4 ("son kabul ettiği denemeden"), K3/P3 (Süresi Doldu
"Daha Önce Gönderildi" sayılmaz), WhatsApp "KİME KAÇ KEZ" genel ilkesi (CLAUDE.md). Program kodu (`server/`, `client/`, `bulut/`), program testleri ve W kod ajanının kanıtları
GÖRÜLMEDİ. Sürücüden (`surucu.mjs`) yalnız TTL ayarının yeri, şablon kurulumu (sahte Meta'ya verilen şablon nesnesi), `sending-settings` satırı, ufuk ve mutasyon tablosu
okundu. Sahte Meta'dan (`sahte-meta/sunucu.mjs`) şablon nesnesi ve medya ömrü (30 gün) okundu.

### 15.2 Yorumlar (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y10-1 | Teslim süresi (TTL) = Meta'nın şablon listesinde O ŞABLON için bildirdiği değer (Meta alanı `message_send_ttl_seconds`; kâhin girdisi `meta.sablonlar.<ad>.teslim_suresi_sn`), yoksa **30 gün**. Program TTL göndermez/düzenlemez — kâhin bunu yalnız Meta'nın bildirdiği değer üzerinden görür | §15 "Meta listesinin bildirdiği değer varsa o, yoksa 30 gün (+1 sa)" |
| Y10-2 | Pay: "Süresi Doldu" = son kabul + süre + **1 saat** (§6 W2 / §7a 16 "TTL + 1 sa" genel kural; §15 30 günün yanında "(+1 sa)"). Kâhin payı Meta'nın bildirdiği değere de uygular; ama bu bir okumadır (§15 parantezi yalnız 30 günün yanında) → hiçbir senaryo [süre, süre + 1 sa] aralığında DENETİM yapmaz ve o aralıkta olay yoktur; payı yalnız 30 günde (metinde açık) W1-01 denetler | §15 + §7a 16 |
| Y10-3 | Ölçü noktası değişmedi: Meta'nın SON kabul ettiği deneme (J4); J4 metnindeki "(3 gün)" §15 ile yerini Y10-1'e bıraktı | J4 + §15 |
| Y10-4 | 2.4.8'in 72 saatlik teslim süresi ayarı ("ttlHours", 2.4.8'in 72 sa varsayılanı) **okunmaz**: kâhin girdisi `ayar.eski_ttl_saat` etkisiz (yalnız M7 okur). "Eski kurulumlarda 72 sa ile açılmış şablon varsa liste değeri geçerli" → listede değer varsa Y10-1 | §15 "ttlHours ayarı ve 72 saat varsayılanı KALKAR", "Kayıtlı eski TTL … kayıtları okunmaz, zarar vermez" |
| Y10-5 | §7a 16 aynen: kanca yolu (aynı WABA'da son 7 günde imzalı, tanınan kanca) çalışmıyorsa Süresi Doldu yazılmaz, iş Meta Kabul Etti / Gönderildi'de kalır | §7a 16 |
| Y10-6 | 30 gün dolmadan Meta Kabul Etti / Gönderildi kalan kişi aynı dönemde **"Daha Önce Gönderildi"** (R3 "Meta Kabul Etti ve sonrası", yorum 15 — değişmedi; İLKEYLE (2) "almış olabilirse elenir") ve R3 **"Yine de Gönder"** yolu açık (İLKEYLE (4) "çıkmaz yok"); Süresi Doldu'dan sonra K3/P3 (sayılmaz) aynen | R3 + K3/P3 + ilke (2), (4); §15 "SORU T1 ve T2 bu kararla DÜŞER" |
| Y10-7 | **Meta davranışı (kural değil):** Meta API medya kimliğini 30 günde kendisi siler (Meta belgesi; sahte Meta `medyaOmruMs`, §1). 30 günlük süreden sonra (Süresi Doldu = kabul + 30 gün + 1 sa) programın PDF silmesi Meta'da bir şey silmez → çıktıdaki `medya_silme` (Meta'da silinen) yalnız 30 günü dolmamış medyayı sayar; 30 günden eski medya yeniden kullanılmaz (§7a 15 "medya geçerliyse aynısı, yoksa yeniden yüklenir"). Eski senaryoların hiçbirinde etkisi yok (en uzun ufuk +19 gün) | Meta belgesi + §11 S3 + §7a 15 |
| Y10-8 | Teslim süresi şablon başına (Meta'nın TTL'i şablonun özelliği): ekstre şablonunda bildirilen değer Ödeme Hatırlatma'ya geçmez | Y10-1 |
| Y10-9 | Eski TTL senaryoları (CIFT-16, ICERIK-10, TARIH-02, TARIH-03, TARIH-03b, J1-02, J4-01, J4-02) kurallarının (P3, §7a 16/17, J1, J4) dişi kalsın diye Meta'nın listede **12 saat** (43.200 sn — iş listesindeki karar satırına göre Meta'nın utility'de izin verdiği en uzun özel süre) bildirdiği düzene alınır (test düzeneği; kural değil); denetim anları 12 + 1 sa'e göre kaydırılır, beklenen DEĞERLER aynı kalır. GUV-09'un konusu imzasız olay: varsayılanda (30 gün) kalır, iş 10 günlük ufukta Gönderildi'de kalır (eski: 73. saatte Süresi Doldu) | düzenek |

### 15.2b W-KÖK (KULLANICI 03.11.2026 ~20:05 UTC, "W-KÖK 2.4.9'A ALINDI"; AYNEN `kahin.KARARLAR` W2) — yorumlar (kodlamadan ÖNCE; ana oturumun iletisiyle geldi)
Kaynak: `docs/2.4.9-IS-LISTESI.md` son satır: "iş KABUL ANINDAKİ teslim süresiyle değerlendirilir (Meta listesindeki süre sonradan kısalırsa önceden kabul edilmiş iş eski süreyle; o an
süre bilinmiyorsa 30 gün) — İLKEYLE (ilke 2 'almış olabilirse elenir'), yeni soru yok". Ana oturum: program bu kuralı HENÜZ uygulamıyor (kod ayrı turda) → W2 senaryolarında
program ↔ kâhin ayrışması BEKLENİR ("beklenen ayrışma (kod henüz yok)").
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y10-10 | Her kabulde (programın kabulü öğrendiği an — J4'ün kabul anı) o işin şablonu için Meta listesinin O ANKİ değeri (yoksa 30 gün) işe yazılır; Süresi Doldu bu değerle ölçülür; listede sonradan olan değişiklik o kabulü etkilemez. Meta Bekletti 2. denemesi / Yine de Gönder yeni bir kabuldür: o anın değerini alır (J4 + W2) | W2 + J4 |
| Y10-11 | "O an süre bilinmiyorsa 30 gün" = kabul anında Meta listesinde değer yoksa 30 gün; sonradan 12 sa bildirilse de o iş 30 günle değerlendirilir (W2-01). Kâhin "kabul anındaki değer"i Meta'nın o anki listesinden alır; programın o ana dek son OKUDUĞU değerle ayrışabileceği an (liste programın son okumasından sonra ama kabulden önce değişirse) senaryosuz (S10-5) | W2 |
| Y10-12 | Kısalma: kabul anında 30 gün bildirilmiş, sonra 12 sa → o iş 30 gün (W2-02). Kişi o arada aynı dönemde "Daha Önce Gönderildi" (İLKEYLE 2), R3 "Yine de Gönder" açık (İLKEYLE 4); süre değiştikten sonra kabul edilen YENİ iş yeni süreyle (12 sa) | W2 + ilke (2), (4) |
| Y10-13 | **Uzama SENARYOSUZ (iki okuma, ders 43 — §15.3 S10-6 SORU):** kabul anında 12 sa, sonra 30 gün. Kuralın ana cümlesi "kabul anındaki süre" → 12 sa (kâhin modeli böyle); ama gerekçe ilke 2 "almış olabilirse elenir" ve Meta'nın süreyi gönderim anında mı yoksa güncel şablondan mı uyguladığı belgesiz (D0) → şüphede uzun süre de okunabilir | W2 + ilke (2) |

### 15.3 KÂHİN SUSUYOR / bilgi (ana oturuma; senaryosuz)
- **S10-1 (bilgi):** Y10-2 — Meta değeri bildirdiğinde 1 saatlik payın uygulanıp uygulanmadığı. Kişiye kaç ileti gittiğini yalnız [süre, süre + 1 sa] aralığında yeni gönderim
  başlatılırsa değiştirir; senaryolar bu aralıkta denetim/olay içermez (program iki okumadan birini kullanabilir).
- **S10-2 (bilgi):** Meta 12 sa bildirirse (şablonun süresi Meta panelinde elle kısaltılmışsa) §7 SORU T1'in penceresi geri gelir: program / tünel kapalıyken teslim bildirimi
  Meta kuyruğunda beklerken açılışta Süresi Doldu yazılabilir → P3 gereği aynı dönemde ikinci ekstre. Karar T1'i "30 günde pratikte yok" diye düşürdü; program TTL göndermediği için bu
  ancak elle değiştirilmiş şablonda olur.
- **S10-3 (bilgi):** Toplu iş sürerken Meta'nın bildirdiği değer değişirse hangi okumanın (gönderim anı / programın son okuması) geçerli olduğu karar metninde yok; kâhin değeri
  Meta'nın o anki listesinden alır, senaryolarda değer değişmez.
- **S10-5 (bilgi):** Y10-11 — "kabul anındaki süre" Meta'nın o anki listesi mi, programın o ana dek son okuduğu değer mi: ancak liste programın son okumasıyla kabul arasında
  değişirse ayrışır; senaryosuz.
- **S10-6 — KAPANDI (KULLANICI KARARI 03.11 ~21:00 UTC, §15.7: B — etkin süre = max(kabul anındaki, güncel)):** ~~SORU — iki okuma, ders 43; kâhin senaryoyla kesinleştirmedi:~~ Meta listesindeki süre kabulden SONRA UZARSA (ör. kabul anında 12 sa, sonra 30 gün) önceden kabul edilmiş iş
  hangi süreyle değerlendirilir? **A (kâhin modeli; kararın ana cümlesi "iş KABUL ANINDAKİ teslim süresiyle değerlendirilir"):** kabul anındaki 12 sa → 13. saatte Süresi Doldu,
  kişi aynı dönemde yeniden gönderilebilir (P3). **B (ilke 2 "almış olabilirse elenir", şüphede uzun süre):** iki değerin uzunu (30 gün) → kişi "Daha Önce Gönderildi", Yine de
  Gönder açık. Meta'nın süreyi iletinin gönderildiği andaki şablondan uyguladığı belgede açık değilse (D0) B güvenli taraftır; belgede açıksa A fiziksel olarak doğrudur.
- **S10-4 (bilgi, bu güncellemenin kapsamı dışı):** KARAR 01.11.2026 10:40 "Gittiği anki içerik" kâhinin J12'siyle (ekstre içeriği AÇILIŞTA) çelişir; kâhinin bu karara göre
  güncellenmesi 2.4.9 iş listesinde C (SONRAYA). Sürücü koşusunda ICERIK-09 / J12-01 / J12-03 bu yüzden ayrışabilir — W farkı değildir.

### 15.4 Güncelleme 10 sonuçları (kâhin, senaryolar, mutasyonlar, değişen beklentiler, sürücü, kanıt)
- **Kâhinde:** `TTL = 72 sa` kalktı → `ttl_listeden()` (Meta'nın o şablon için o anki listesi `teslim_suresi_sn`, yoksa `TTL_VARSAYILAN` 30 gün; `ayar.eski_ttl_saat` okunmaz) +
  `ttl_suresi()` (W2: `programa_kabul`'de işe yazılan `ttl_kabul`); Süresi Doldu = son kabul + süre + `TTL_PAYI` (1 sa); `meta_sablon` olayı `teslim_suresi_sn`'yi de değiştirir;
  `MEDYA_OMRU` 30 gün: `medya_t` (yükleme anları), `silme_n` (Meta'da GERÇEKTEN silinen) — çıktıdaki `medya_silme` artık `silme_n`; 30 günden eski medya yeniden kullanılmaz.
  `KARARLAR` W1 (03.11 18:45 + §15) ve W2 (W-KÖK 20:05) AYNEN.
- **Yeni senaryolar (7):**

| Karar | Senaryo | Sınır | Mutasyon (yakalayan) |
|---|---|---|---|
| W1 | W1-01 Meta bildirmez + 2.4.8 72 sa ayarı: 4. gün Gönderildi, 5. gün "Daha Önce Gönderildi", 28. gün C kanca yolunu canlı tutar, 30 g 30 dk Gönderildi (pay), 30 g 2 sa Süresi Doldu (Meta'da silme 0), sonra aynı dönem gider | 30 gün, 1 sa pay, medya 30 gün | M7, M167, M168 |
| W1 | W1-02 29. gün "Daha Önce Gönderildi" (İLKEYLE 2), R3 Yine de Gönder ile ikinci ileti (İLKEYLE 4) | 29. gün | (M7 de) |
| W1 | W1-03 Meta ekstre için 12 sa, hatırlatma için bildirmez: A ekstresi 13,5. saatte Süresi Doldu, D hatırlatması 4. gün Gönderildi; A'ya aynı dönem yeniden | şablon başına | M166, M169 |
| W1 | W1-04 31.10 20:00 gönderim, 12 sa: 01.11 07:30 Gönderildi, 09:30 Süresi Doldu, 02.11 geç teslim (Kasım), 03.11 "Daha Önce Gönderildi" (son 31.10) | ay sonu, gece yarısı | — |
| W1 | W1-05 Meta bildirmez; Meta Bekletti 2. denemesi 24. saatte kabul: 30 g 12 sa Gönderildi, 31 g 2 sa Süresi Doldu, Meta'da silme 0 | 30 gün + J4 | (M141 J4-01'de) |
| W2 | W2-01 kabulde bilinmiyor (30 gün), 14. saatte liste 12 sa: A Süresi Doldu OLMAZ, 16. saatte "Daha Önce Gönderildi", Yine de Gönder gider; sonra kabul edilen C 12 sa ile Süresi Doldu | kısalma | M170 |
| W2 | W2-02 kabulde 30 gün bildirilmiş, 20. saatte 12 sa'e kısalır: A eski süreyle, "Daha Önce Gönderildi"; sonra kabul edilen C 12 sa ile Süresi Doldu | kısalma | (M170 de) |

- **Mutasyonlar:** M7 TERSİNE çevrildi ("TTL 3 gün yerine 30 gün" → "Meta bildirmezse 2.4.8'in 72 sa'i"), yeni M166–M170; ayrıca M41 (kanca yolu yokken Süresi Doldu) 30 günde
  10 günlük ufukta dişsiz kalmıştı → TARIH-03 12 sa düzenine alındı, yine yakalanıyor. Toplam **169/169**.
- **Değişen eski senaryolar (9; 284'ün tam sonucunda 6'sı değişti, 278'i bayt bayt aynı — `docs/kanit/2026-11-03/kahin-w/eski-284-tam-sonuc-fark.txt`):**
  - Meta 12 sa bildirir düzenine alınan (Y10-9; elle beklenen DEĞERLER aynı): CIFT-16, TARIH-03, J1-02 (zamanlar da aynı); ICERIK-10 (K1/K2 11 sa 30 dk / 13 sa 30 dk,
    teslim +2 g), TARIH-02 ve TARIH-03b (K1/K2 11 sa 30 dk / 13 sa 30 dk), J4-01 ve J4-02 (K1/K2 30 sa / 38 sa).
  - Beklentisi değişen: **GUV-09** — iş 10 günlük ufukta Gönderildi'de kalır, PDF silinmez (eski: 73. saatte Süresi Doldu, PDF silinir; elle de değişti).
  - Eski kâhinle (a0962e7a, ayrı `git archive` kopyası) yeni/değişen 16 senaryo: **13 kırmızı, 3 aynı** (CIFT-16, TARIH-03, J1-02 — 12 sa ile 72 sa'in aynı sonucu verdiği
    düzenek değişiklikleri) — `docs/kanit/2026-11-03/kahin-w/eski-kahin-a0962e7a-ile-yeni-ve-degisen-senaryolar.txt`.
- **Sahte Meta:** şablon nesnesine `message_send_ttl_seconds` (D0: yalnız senaryo verdiyse listede ve tek okumada görünür); yeni test (35/35) ve mutasyon (19/19).
- **Sürücü (S-33):** `ttlSaat = 72` kalktı → `ttlSureleri` (senaryonun Meta değerleri + olaylardaki `meta_sablon teslim_suresi_sn` + 30 gün); aday anlar her süre için süre ve süre + 1 sa
  (S10-1'in iki okuması); şablon nesnesine `message_send_ttl_seconds`; `meta_sablon` olayında sahte Meta'daki değer değişir; `ayar.eski_ttl_saat` → programa
  `PUT …/sending-settings {ttlHours}` denenir ve HTTP kodu nota yazılır (karar §15: 400); eşleme mutasyonu `SW-teslim-suresi-verilmez` (W1-03, TARIH-02, W2-02).

### 15.5 Programa karşı sürücü koşusu (03.11.2026; program = a0962e7a, W kodu ed54565c dahil; kâhin c70c77e0) — AYRIŞMALAR (programa uydurulmadı, ders 40)
Koşular (`docs/kanit/2026-11-03/kahin-w/`): yeni + değişen 17 senaryo × hızlı / yavaş × `TZ` Europe/Istanbul / UTC (dördü de aynı sonuç: 0/17 tam eşit; davranış farkı 0 olanlar
yalnız G1 gösterim sınıfıyla ayrışıyor); eski kâhinle (a0962e7a, ayrı çalışma ağacı) aynı programa karşı değişen 10 senaryo; tanı koşusu (programın şablon okuma alanları);
eşleme mutasyonu `SW-teslim-suresi-verilmez` (W1-03); bütün 291 senaryo (hızlı uç) hem W kodlu programa (a0962e7a) hem W ÖNCESİ programa (bb68798a, ayrı çalışma ağacında
yeni kâhinle) — iki koşunun senaryo başına davranış farkı listeleri **291/291 AYNI** (`iki-program-kosusu-fark-bb68798a-a0962e7a.txt`): W kodu kâhinin gördüğü hiçbir davranışı
değiştirmedi; A1 W kodundan ÖNCE de vardı. Bütün koşu: 25 tam eşit, 196 yalnız gösterim sınıfı, 70 davranış farkı (12'si aşağıdaki A1/A2 kümesi, 1'i A3, 58'i W'den bağımsız —
`tum-kosu-siniflama.txt`).
| # | Ayrışma | Senaryolar | Sınıf |
|---|---|---|---|
| A1 | **Program Meta'nın şablon listesinde bildirdiği teslim süresini uygulamıyor:** 12 sa (43.200 sn) düzeninde iş 13,5. saatte de 10 günlük ufukta da Gönderildi / Meta Kabul Etti kalıyor, Süresi Doldu yazılmıyor, PDF silinmiyor; P3 gereği gitmesi beklenen aynı dönem iletisi "Daha Önce Gönderildi" ile eleniyor (CIFT-16 T2, W1-03 T3 oluşmuyor). Tanı: program şablon okumalarından birinde `fields=…,message_send_ttl_seconds` istiyor, sahte Meta 43200 dönüyor; sahte Meta'ya değer hiç verilmeyince (eşleme mutasyonu) programın davranışı DEĞİŞMİYOR (W1-03: 35 fark aynı) → program değeri okuyor gibi ama Süresi Doldu'ya bağlamıyor. Kural: §15 "Meta listesinin bildirdiği değer varsa o". Etki yönü güvenli (kişi almış sayılır, ikinci ileti gitmez, Yine de Gönder açık) ama karar metnine aykırı | CIFT-16, ICERIK-10, TARIH-02, TARIH-03b, J1-02, J4-01, J4-02, W1-03, W1-04, W2-01 (C), W2-02 (C) | W davranış farkı — kök neden kodda (kâhin kodu görmedi) |
| A2 | **W-KÖK (W2) — BEKLENEN AYRIŞMA (kod henüz yok):** W2-01/W2-02'nin ayrışması bugün yalnız A1'den (liste değiştikten SONRA kabul edilen C Süresi Doldu olmuyor). W-KÖK'ün asıl parçası (önceden kabul edilmiş A eski süreyle → Gönderildi, "Daha Önce Gönderildi", Yine de Gönder gider) programda RASTLANTIYLA uyuyor: program listedeki değeri hiç uygulamadığı için. A1 + W-KÖK kodu gelince W2-01/02 yeniden koşulmalı (A'nın Süresi Doldu OLMAMASI asıl denetim) | W2-01, W2-02 | beklenen ayrışma (kod henüz yok) |
| A3 | İmzasız (`wa0`) sahte "delivered" (gerçek işin opaque'ıyla) programda işi Teslim Edildi yapıyor (+2 sa'te). Eski kâhinle aynı programa karşı da aynı K1 farkı → W değişikliğinden BAĞIMSIZ. Kâhin §7a 3'e göre "imzasız düşer" der; sürücünün `imzali` kipinde kapıcı imzasızı `wa0` diye geçirir (Elle Bağla'da kapıcı müşterinin uygulama sırrını bilmez — sürücü başlığı) → ana oturum sınıflasın (bilinen Yol 1 düzeni mi, hata mı) | GUV-09 | W'den bağımsız |
| A4 | Program artı bakiyeye " (Borçlu)" ekliyor — sürücünün G1 gösterim sınıfı (her senaryoda) | hepsi | gösterim, W'den bağımsız |
| A5 | **W'den bağımsız 58 senaryo** (W öncesi programda AYNI fark listesi; bu güncellemenin konusu değil, ana oturuma): Tüm Hareketler PDF dönem uçları sürücüde `None` (ICERIK-08, K1-05/06, K2-02, D3-02, E4-02, G6-02/04, J8-01…05, J11-01…03, J12-02/03), ICERIK-09 (S10-4 "Gittiği anki içerik" ↔ J12), sınır penceresi sayısı (`pencere_farkli_alici`: CIFT-02/09, ALICI-131049-iki-kez, SINIR-05, K6-01/03/04, D6-03, E1-01, G5-01, J1-03, J10-04), `toplam_kabul_program` (H3-01, J1-04/05, J3-03/04), taşıma "Bu Ay" (CIFT-13, D8-01/02, G3-03/04), Meta'ya ulaşılamaz (KAYIP-05/06), sıfırlama (G4-01/02, J3-02), ret sırası (GUV-10/11), J10-01…03 (S9-1), G6-01/05, H2-02, E2-03, J1-01, J6-01, ICERIK-04 (emoji PDF) | 58 | W'den bağımsız |
| — | **Uyanlar (davranış farkı 0):** 30 gün varsayılanı, 2.4.8'in 72 sa'i okunmuyor (`PUT sending-settings {ttlHours: 72}` → **400**, karar §15), 29. gün "Daha Önce Gönderildi" + R3 Yine de Gönder, 30 gün + 1 sa pay, Meta Bekletti 2. kabulünden 30 gün (J4), 30 günden sonra Meta'da PDF silme 0 (Y10-7), kancasız yol (TARIH-03), TTL içinde geç teslim (ICERIK-11). Program hiçbir istekte teslim süresi GÖNDERMİYOR (tanı notu: 0) | W1-01, W1-02, W1-05, TARIH-03, ICERIK-11 | uyuyor |

### 15.6 DENENEN / DENENMEYEN
- DENENEN: kâhinin kendi testi 314/314 (F mutasyon 169/169) `TZ=UTC` ve `TZ=Europe/Istanbul`; senaryolar 291/291 elle = model; eski 284'ün tam sonucunda 6'sı değişti (yalnız
  §15.4'tekiler); eski kâhinle yeni/değişen 16 senaryo 13 kırmızı; sahte Meta 35/35, mutasyon 19/19; sürücü §15.5; sahte Meta'yı kullanan program e2e'leri
  `senaryo-tarih-248` 43/43 ve `senaryo-is-akisi-248` 184/184 (ilk denemeler ORTAM yüzünden düştü: node_modules'teki Playwright headless_shell-1194 istiyor, /opt'ta 1243 var —
  not defterinde yalnız bu koşu için bağ klasörü + `PLAYWRIGHT_BROWSERS_PATH`; kanıt dosyaları yeşil yeniden koşuyla yazıldı).
- DENENMEYEN: 2.4.8'in GERÇEK koduyla (v2.4.8) yazılmış `ttlHours` kaydının 2.4.9'da okunmadığı (sürücü yalnız 2.4.9 ucunu dener → 400; eski kayıt üretilmedi); S10-1 pay aralığı,
  S10-2 (12 sa'te bildirim kuyrukta + açılış), S10-3 (süre toplu iş sürerken değişir — W2 dışında), S10-5, S10-6 (süre uzar — SORU); Yol 1 gerçekçi kip (`--kip yol1`) ve Yol 2 kipi; sürücünün yavaş ucu ve `TZ=UTC` yalnız 17 hedef senaryoda (bütün koşu yalnız hızlı uç, Europe/Istanbul); sürücünün `--mutasyon-denetimi` bütün tablosu
  (yalnız yeni `SW-teslim-suresi-verilmez` W1-03'te tek tek koşuldu — program değeri uygulamadığı için bugün DİŞSİZ görünür, A1 düzelince anlamlı olur).

### 15.7 Güncelleme 10b — S10-6 KULLANICI KARARI (03.11.2026 ~21:00 UTC; AYNEN `kahin.KARARLAR` W3) — yorumlar (kodlamadan ÖNCE)
Kaynak: `docs/2.4.9-IS-LISTESI.md` son satır (AskUserQuestion; kâhinin S10-6 sorusu): "süre kabulden sonra UZARSA önceden kabul edilmiş iş UZUN süreyle (30 gün) değerlendirilir →
etkin süre = max(kabul anındaki, güncel); kabulde bilinmiyorsa 30 gün". Ana oturum: program bu kuralı henüz uygulamıyor (W-KÖK kodu ayrı ajanda) — bu turda programa karşı KOŞULMADI.
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y10-14 | Etkin süre = max(kabul anında işe yazılan süre, Meta listesinin DEĞERLENDİRME ANINDAKİ değeri); kabulde değer yoksa kabul süresi 30 gün (W2). Kısalma W2 ile aynı sonuç (max eskiyi tutar); uzama → uzun süre (Y10-13'ün A okuması DÜŞTÜ, B oldu) | W3 + W2 |
| Y10-15 | Kâhinde "güncel" = Meta listesinin o anki değeri, listede değer yoksa 30 gün (W1 "yoksa 30 gün"). Listenin değeri sonradan TAMAMEN kaldırması (bildirmemeye geçmesi) karar metninde yok — senaryosuz (S10-7) | W1 + W3 |
| Y10-16 | Uzama Süresi Doldu YAZILDIKTAN SONRA gelirse iş yeniden açılmaz (Süresi Doldu kesin durum; J1 "iş yeniden açılmaz" düzeni) — karar metni bu anı söylemiyor, senaryosuz (S10-8) | J1 düzeni |
- **S10-7 (bilgi, senaryosuz):** Y10-15. **S10-8 (bilgi, senaryosuz):** Y10-16.
- Senaryo W3-01 (kabulde 12 sa, 6. saatte liste 30 gün → 14. saatte Süresi Doldu YOK, Gönderildi; 15. saatte aynı dönem "Daha Önce Gönderildi", uyarıda "Yine de Gönder" ile gider);
  W2-01 / W2-02 (kısalma yarısı) kaynak satırına "+ W3". Mutasyon M171 = S10-6'nın A okuması (yalnız kabul anındaki süre; max yok).
- **Sonuç (10b):** `ttl_suresi()` = max(`ttl_kabul`, `ttl_listeden()` o anki); KARARLAR W3 AYNEN; yeni senaryo W3-01; yeni mutasyon M171 (← W3-01). Senaryolar **292/292** elle = model;
  kendi testi **315/315** (F mutasyon **170/170**) `TZ=UTC` ve `TZ=Europe/Istanbul`; önceki 291 senaryonun tam sonucu bayt bayt AYNI (W2-01/02 yalnız kaynak satırı); önceki kâhinle
  (e37016de) W3-01 KIRMIZI, W2-01/02 aynı — `docs/kanit/2026-11-03/kahin-w3/`. Programa karşı KOŞULMADI (ana oturum: W-KÖK kodu ayrı ajanda; W3-01'de ayrışma beklenir).
  Sürücüde değişiklik gerekmedi (`meta_sablon teslim_suresi_sn` ve aday anlar güncelleme 10'da var).

## 16. Kâhin güncellemesi 11 — 2.5.0 kararları (S-W1, S-W2, 18:37, 19:15, S-W4, S7)

### 16.1 Kaynak ve bağımsızlık
Kaynak YALNIZ karar metinleri (AYNEN `kahin.KARARLAR` SW1, SW2, SD1837, SD1915, SW4, S7): `docs/2.5.0-IS-LISTESI.md` D bölümü (05.11 ~16:48, ~18:37, ~18:55 S3, ~19:15,
21:08 satırları) ve C bölümü (S7 sorusunun iki seçeneği), `docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md` §0, §1 (W-1 (a) satırı), §3, §4, §4a, plan 2.4.8 `docs/erp/WHATSAPP-API-PLANI-2.4.8.md`
(§2.7, §3, §4, §6 W1–W2, §7a, §11) ve ana oturumun görev iletisindeki karar özetleri (S-W4'ün "Kod 102 bu kararın DIŞINDA" cümlesi yalnız iletide). Okunan başka dosya:
CLAUDE.md, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu README, `kahin/*`, `sahte-meta/sunucu.mjs` (belirteç denetimi `yetkiDenetle`, istek yönlendirme ve kural eşleme bölümü),
`sahte-meta/hatalar.mjs` ve `surucu.mjs` içinde yalnız `belirtec` / `suresi_dolmus` / `debug_token` araması (iki satır: sabit belirteç adı ve sahte Meta'ya verilen belirteç nesnesi).
Program kodu (`server/`, `client/`, `bulut/`, `tools/`), program testleri, `docs/kanit/`, iş listesinin B ve E bölümleri ve git geçmişi / farkı GÖRÜLMEDİ. Programa karşı KOŞULMADI.
Bu bölümün 16.2–16.4'ü kodlamadan ÖNCE yazıldı (ders 40); 16.5–16.8 kodlamadan sonra.

### 16.2 Yorumlar (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y11-1 | **S-W1 "İkinci de gitsin"** = kâhinin J9 kuralı (gönderim anında R3 yeniden denetlenmez; kuyruktaki ikinci iş, birincinin iletisi Meta'da teslim beklerken ya da geç teslimi geldikten sonra da gider → kişiye 2 ileti, "Bu Ay" 2 — J5). Kural DEĞİŞMEZ; BİLİNEN SINIR değil KARAR: J9-01/02'nin `bilinen_sinir: n3` işareti kalkar, kaynakları SW1. M151 (A seçeneği: gönderimden önce R3 bir kez daha) artık "kararın tersi" | SW1 + J9 + J5 |
| Y11-2 | "Teslimi beklenen ('Meta Kabul Etti') ileti varken kuyruktaki ikinci iş": programda birinci iş Meta Kabul Etti / Gönderildi iken aynı kişi + dönem için ikinci iş yalnız R3 "Yine de Gönder" ile açılabilir (öbür yollar Zaten Kuyrukta / Sonucu Belirsiz / Daha Önce Gönderildi ile eler) — o yol J10 (07:11 b) ile zaten "ikinci kopya gider". Programda teslimsiz kapanmış ama iletisi Meta'da duran birinci iş (Meta Bekletti → İptal, failed, Başarısız) J9 yoludur; plan §3 madde 4'ün çeşitleri (geç teslim ikinci iş beklerken / 7 gün sonra / birinci Başarısız kalır) yeni senaryolarla | SW1 + P6 §3 madde 4 |
| Y11-3 | **S-W2 "Sayılmasın"** = programın kayan 24 saatlik FARKLI alıcı sayacında (§6 W2: "Meta Kabul Etti" olmuş farklı alıcı) Süresi Doldu yazılmış DENEMENİN kabulü sayılmaz; aynı alıcının pencere içinde sayılan başka kabulü (başka cari aynı telefon — K2, başka iş) varsa alıcı yine sayılır. Süresi Doldu yazıldığı andan sonraki sınır kararları ve `pencere_farkli_alici` gözlemi bunu yansıtır | SW2 + §6 W2 |
| Y11-4 | Süresi Doldu'dan SONRA teslim gelirse (§7a 17 Teslim Edildi) deneme artık "Süresi Doldu ileti" değildir → kabulü (kabul anıyla) yeniden sayılır. Senaryosuz (teslim pencere içinde gelmiyor) | SW2 + §7a 17 |
| Y11-5 | Sınır Nedeniyle Bekleyen kişinin, Süresi Doldu ile boşalan yere NE ZAMAN geçtiği karar metninde yok (kime / kaç kez değil): kâhin bekleyenin açılış zamanını yeniden hesaplamaz; Süresi Doldu'dan sonra yeni başlatılan iş hemen değerlendirilir. Senaryolar bekleyen kişiyi o aralıkta denetlemez | SW2 |
| Y11-6 | S-W2 yalnız Süresi Doldu'yu söyler: kabulden sonra failed (Başarısız) olan deneme §6 W2 gereği sayılmaya devam eder (kâhin değişmedi). P6 §1 SORU 2 satırındaki "deliveryFailed sayaçtan düşer" programın bugünkü davranışının anlatımıdır, karar değil → 16.4 bilgi | SW2 + §6 W2 |
| Y11-7 | **18:37 "bağlantının süresi dolduğunda"** = programın izlediği (W-1 a) belirteç süresinin dolması — yeni olay `baglanti_suresi_doldu {sirket}`: o andan bağlantı 'Süresi Doldu', Meta da o belirteci 190 ile reddeder. Bağlantı ŞİRKET başına (2.4.8 §6 W1 "Ayarlar (şirket başına)") | SD1837 + P6 W-1 (a) |
| Y11-8 | "kuyruktaki / süren toplu gönderim işleri" = o şirketin `aktif` ya da R1 `baglanti_bekleniyor` toplu işleri → toplu iş `duraklatildi` (süre izlemeyle: neden `baglanti_suresi_doldu`); içindeki Bekliyor / Sınır Nedeniyle Bekliyor / Hazırlanıyor / Meta Bekletti işler 'Duraklatıldı' (§7a 13 düzeni). Meta Kabul Etti / Gönderildi işlere dokunulmaz (ileti gitti; teslim / Süresi Doldu bildirimi sürer). Kullanıcının duraklattığı toplu iş öyle kalır | SD1837 + §7a 13 |
| Y11-9 | "yeniden bağlanınca 'Devam Et' ile" — yeni olay `yeniden_baglan {sirket}` (yeni geçerli belirteç): duran toplu işi KENDİLİĞİNDEN sürdürmez, 'Devam Et' gerekir | SD1837 |
| Y11-10 | "yalnız kalan kişilere gider, kimseye ikinci ileti gitmez" = Devam Et yalnız Duraklatıldı (ve bugünkü gibi açılışta sorulan / Lisans) işleri Bekliyor'a alır; Meta Kabul Etti / Gönderildi / Teslim / Okundu / Başarısız / Sonucu Belirsiz / Atlandı iş yeniden gönderilmez (Sonucu Belirsiz yine yalnız işteki Yine de Gönder — G0 2) | SD1837 + G0 (2) |
| Y11-11 | "süre dolunca gönderim başlatılamaz" (PLAN P6 §1 W-1 (a), karar değil): bağlantı 'Süresi Doldu' iken yeni toplu gönderim BAŞLAMAZ, neden `baglanti_suresi_doldu`; ret sırasında `bagli_degil`'den hemen sonra (bağlantı durumu, yetkiden önce — kâhin yorumu; senaryoda başka ret nedeni yok) | P6 §1 W-1 (a) + §7a 29 |
| Y11-12 | **19:15 "Meta anahtarı reddederse (190)… o anda iletisi gitmeyen kişi"** = o kişinin isteği — ileti POST'u ya da (ekstrede) PDF yüklemesi — 190 alırsa kişi Başarısız OLMAZ: 'Duraklatıldı' (bekleyenlerle), iletisi kesin gitmedi → R3'te sayılmaz, Sonucu Belirsiz değil (ilke 1). Bağlantı 'Süresi Doldu' olur (S-W4 metni "bağlantı 'Süresi Doldu' olur" 190 için de; 19:15 "süre doldu ya da iptal"), toplu iş ve o şirketin öbür süren toplu işleri Duraklatıldı (Y11-8; bugünkü §6 W2 "İLK hatada DURAKLAR"). Belirteç Meta'da yeniden bağlanana dek geçersiz kalır (sonraki her istek reddedilir) | SD1915 + SW4 + SD1837 + G0 (1) |
| Y11-13 | PDF: 190 ileti isteğinde geldiyse yüklenmiş PDF silinmez (iş kesin değil — §11 S3) ve Devam Et'te aynı medya kullanılır (§7a 15); PDF yüklemesinde geldiyse medya yok, Devam Et'te yüklenir. Geçici hata sayaçları ("5 art arda", iş başı deneme) 190/0'dan etkilenmez | SD1915 + §11 S3 + §7a 15 |
| Y11-14 | Meta Bekletti işin 2. denemesi 190 / 0 ile reddedilirse 2. deneme GİTMEMİŞTİR: iş yine Meta Bekletti iletisini taşır; o ileti beklerken teslim edilirse iş kapanır, Devam Et 2. denemeyi göndermez — **İLKEYLE G0 (3)** + J2 | SD1915 + J2 + G0 (3) |
| Y11-15 | **S-W4**: kod 0 her yerde 190 ile aynı (Y11-12…14). Kod 102 bu kararın DIŞINDA: kâhinde bugünkü hâliyle (§7a 12 tanınmayan kod → o iş Başarısız, toplu iş sürer, bağlantı Süresi Doldu olmaz) | SW4 + §7a 12 |
| Y11-16 | Geri yükleme / sıfırlama / taşıma (ilke 5): 190/0 ile bekleyen ve süre dolunca duran işler bugünkü §7a 26 / §6 W2 kuralıyla durur ("Durduruldu (Geri Yükleme)" / "Taşınan Veri — Durduruldu"), dirilmez; reddedilen deneme R3'te SAYILMAZ (kesin gitmedi) → yeniden bağlandıktan sonraki yeni toplu işte kişi elenmez, bir kez gider | G0 (1, 5) + SD1915 + §7a 26 |
| Y11-17 | **S7**: girdi `vadeler[].supheli: true` = o açık kalem şüpheli alacak kaydına (icra / dava) alınmış; "kaydı açık" = böyle bir kalemin kalanı > 0. Yalnız Ödeme Hatırlatma (karar metni); Ekstre değişmez | S7 (+ 18:55 S3) |
| Y11-18 | "otomatik listeye girmesin… 'Şüpheli Alacağı Var' etiketiyle görünür" = Ödeme Hatırlatma başlatmasında seçimdeki şüpheli kaydı açık cari ELENİR, neden `supheli_alacak` (ileti gitmez); "istenirse elle seçilir" = başlatmada `supheli_elle: [cari]` ile ayrıca seçilen cari elenmez, gider. Eleme sırası: silindi / pasif / İstemiyor / numara → `supheli_alacak` → `gecikmis_borc_yok` → Zaten Kuyrukta → Sonucu Belirsiz → R3 | S7 + §7a 20 + E2 |
| Y11-19 | "iletide şüphelisiz gecikmiş tutar yazar" = elle seçilen şüpheli caride {{4}} şüpheli OLMAYAN vadesi geçmiş kalemlerin toplamı; {{3}} aynı kalemlerin en eskisi (kâhin yorumu: §7a 20'nin {{3}} / {{4}}'ü aynı kalemlerden); {{5}} güncel bakiye için karar metni bir şey söylemiyor → `plan_susuyor`. İçerik bugünkü gibi gönderim anında (Y9d-2) | S7 + §7a 20 |

### 16.3 Önceki güncellemelerle çelişen yerler (yeni KARAR geçer)
- §2 / §5 §7a 13 "hesap/şablon hatası İLK hatada DURAKLAR, **hatayı alan Başarısız**" → 190 ve 0'da hatayı alan Başarısız DEĞİL, bekleyenlere döner + bağlantı Süresi Doldu (SD1915, SW4). Öbür
  hesap kodları (10, 200–299, 131005, 368, 131031, 131042, 133010, 131045) ve şablon kodları AYNEN. → **HESAP-0** beklentisi değişir (B Duraklatıldı; senaryoya yeniden bağlanma olayı
  eklenir — 18:37 "yeniden bağlanınca Devam Et").
- §14.2 Y9-19 / §14.6 J9 "n3 BİLİNEN SINIR, 2.5.0'da düzelir" + §14.8 S-25 (n3 kısmı) → KARAR (SW1): fark çıkarsa BİLİNEN SINIR değil KARAR ihlali.
- §6 W2 "Kayan 24 saatte 'Meta Kabul Etti' olmuş FARKLI alıcı sayılır" → Süresi Doldu deneme sayılmaz (SW2). 12 sa düzenindeki eski senaryoların `pencere_farkli_alici` gözlemi değişebilir (16.6).
- P6 §3 madde 3 ("Durduruldu + Yine de Gönder") kâhinde hiç kodlanmamıştı; 18:37 ile geçersiz (M189 o okumayı tutar).

### 16.4 KÂHİN SUSUYOR / KULLANICIYA SORULMALI (ana oturuma)
**KULLANICIYA SORULMALI (kime / kaç kez — kodlanmadı; senaryo bu duruma girerse kâhin `ValueError` verir):** → ikisi de KAPANDI: kullanıcı 06.11.2026 03:35 UTC "hepsi A",
güncelleme 12 (§17) ile kodlandı.
- **S7-a ★** Elle seçilen şüpheli alacaklı caride şüphesiz gecikmiş borç YOKSA (bütün gecikmiş borcu şüpheli): A) "Gecikmiş Borç Yok" ile elenir — iletide yazılacak şüphesiz gecikmiş
  tutar yok (ÖNERİ; §7a 20 düzeni); B) ileti yine gider ({{4}} 0,00 TL ya da şüpheli tutarla).
- **S7-b ★** Ödeme Hatırlatma kuyruktayken (gönderimden önce) şüpheli alacak kaydı AÇILAN, elle seçilmemiş cari: A) gönderim anında 'Atlandı — Şüpheli Alacağı Var' (ÖNERİ; §7a 2
  "eleme denetimleri gönderim anında" + S7 "otomatik gitmez"); B) başlatmadaki seçimle gider (şüphesiz tutarla).

**KÂHİN SUSUYOR — `secenek` yaprağı (kime / kaç kez DEĞİŞMEZ; program seçeneklerden birini vermeli):**
- **Yeniden bağlanmadan Devam Et** (karar metni yalnız "yeniden bağlanınca Devam Et ile" der): (a) reddedilir / etkisiz — toplu iş Duraklatıldı kalır (W-1 (a) "süre dolunca gönderim
  başlatılamaz"); (b) kabul edilir, işler Bekliyor, bağlantı Süresi Doldu iken işçi istek göndermez, yeniden bağlanınca sürer; (c) kabul edilir, işçi dener, Meta reddeder → 19:15 düzeni
  (kişi bekleyenlere, toplu iş yine Duraklatıldı). Üçünde de yeniden bağlanmadan kimseye ileti gitmez, yeniden bağlanıp Devam Et'ten sonra kalan herkese bir kez gider; kâhin üç okumayı
  koşar, ayrışan yapraklar (istek sayısı, toplu iş / iş durumu) `secenek`.
- 190 / 0 ile duran toplu işin neden adı (hata kodu ya da 'Bağlantı Süresi Doldu'); 190 / 0 alıp bekleyen işin hata kodu (kod ya da boş); S7'de {{5}} (`plan_susuyor`).

**KÂHİN SUSUYOR — modellenmedi (senaryo bu duruma girerse kâhin `ValueError` verir):** bağlantı Süresi Doldu iken işteki Yine de Gönder / Başarısızları Yeniden Dene; Meta belirteci
geçersizken (program bilmiyor) yeni toplu gönderim başlatma (başlatmadaki şablon okuması reddedilir); Meta'nın şablon / basamak okumasına 190 / 0 dönmesi (kâhin okumayı Meta'nın
durumundan yapar; senaryolarda belirteç geçersizken okuma zamanı gelmez).

**Bilgi:** Y11-4 (Süresi Doldu sonrası teslim yeniden sayılır), Y11-5 (bekleyenin boşalan yere geçiş anı), Y11-6 (failed kabul pencerede sayılır; program "deliveryFailed"ı da düşürüyorsa
ana oturum sınıflasın — yalnız bekleme süresi), Y11-7 / Y11-8 şirket başına bağlantı (iki şirket aynı WABA — senaryosuz), R1 "Bağlantı Bekleniyor" + süre dolması (senaryosuz).

### 16.5 Kâhinde (kodlama) — senaryolar (18) ve mutasyonlar (18)
Kod: `KARARLAR` SW1, SW2, SD1837, SD1915, SW4, S7 (AYNEN); olaylar `baglanti_suresi_doldu {sirket}`, `yeniden_baglan {sirket}`; başlatmada `supheli_elle`; `vadeler[].supheli`;
`belirtec_reddi()` (190 / 0 → Duraklatıldı + `sure_doldu()`; Meta Bekletti 2. denemesi reddedildiyse iş yine o iletiyi taşır), `sure_doldu()` (şirketin süren toplu işleri),
`pencere_kumesi()` deneme başına (`pencere_kayit`; Süresi Doldu deneme sayılmaz), `gecikmis()` şüphesiz kalemler, `supheli_acik()`, başlatma reddi `baglanti_suresi_doldu`;
`hesapla_tek()` yeniden bağlanmadan Devam Et'e düşen koşuda üç okumayı (`DEVAM_OKUMALARI`) koşar ve `secenek_birlestir()` ile birleştirir. Çıktıda yeni yaprak yalnız yeni durumlarda:
toplu iş nedeni `{"secenek": [kod, "baglanti_suresi_doldu"]}` (190 / 0 ile duran), bekleyen işin `hata_kodu` `{"secenek": [kod, null]}`, S7'de {{5}} `plan_susuyor`.

| Karar | Senaryo | Sınır | Mutasyon (yakalayan) |
|---|---|---|---|
| SW1 | SW1-01 geç teslim ikinci iş 130429 ile 30 sn beklerken gelir → 2 ileti · SW1-02 geç teslim 7 gün sonra (Ekim 1 + Kasım 1) · SW1-03 birinci Başarısız kalır → tek ileti; J9-01/02 (işaretsiz, kaynak SW1) | 30 sn bekleme, 7 gün, ay dönümü | M151 (J9-01; SW1-01 de) |
| SW2 | SW2-01 sınır 1, 12 sa: Süresi Doldu'dan sonra pencere 0, yeni B hemen gider · SW2-02 aynı telefonlu A2 teslim → alıcı yine sayılır, C sınırda | 13. saat (12 sa + 1 sa pay) | M178 (SW2-01), M187 (SW2-02) |
| SD1837 | SD1837-01 süre dolunca T1 + T2 Duraklatıldı, yeniden bağlanınca sürmez, T1 Devam Et → yalnız C, D (B Gönderildi'ye ikinci ileti yok), T2 bekler · SD1837-02 yeniden bağlanmadan Devam Et (üç okuma; `secenek`) · SD1837-03 süre dolunca yeni gönderim başlamaz | 24 sa pencere, 26 / 30 sa | M175, M176, M177, M189 (SD1837-01); M179 (SD1837-03) |
| SD1915 | SD1915-01 ileti isteğinde 190 → bekleyenlere, aynı PDF · SD1915-02 PDF yüklemesinde 190 · SD1915-03 Meta Bekletti 2. denemesi 190 + 1. ileti teslim → iş kapanır (İLKEYLE G0 3 + J2) · SD1915-04 geri yükleme · SD1915-05 taşıma (kod 0) | 24 sa (Meta Bekletti), geri yükleme, taşıma | M172, M174, M185 (SD1915-01); M184 (SD1915-02); M186 (SD1915-03); M188 (SD1915-04) |
| SW4 | HESAP-0 (değişti) · SW4-01 kod 0 → aynı şirketin öbür toplu işi de durur · SW4-02 kod 0 PDF yüklemesinde · SW4-03 kod 102 bugünkü gibi (Başarısız, toplu sürer, sonraki gönderim başlar) | — | M173 (SW4-01), M180 (SW4-03) |
| S7 | S7-01 şüpheli kaydı açık SA ve VI 'supheli_alacak' ile elenir, kalanı 0 olan KK ve A gider · S7-02 SA elle seçilir: {{3}} 12.10.2026, {{4}} 200,00 TL, {{5}} `plan_susuyor`; Ekstre etkilenmez | kalan 0 (kayıt kapalı) | M181 (S7-01), M182, M183 (S7-02) |

Mutasyonlar M172–M189 (açıklamalar `kahin.MUTASYONLAR`): hepsi değerle (elle beklenen) yakalanıyor — istisnayla yakalanan yok. Kâhinin kendi testine I8 eklendi: `secenek_birlestir`
birim denetimi; üç okumada kime / kaç kez alanları (elenen, oluşmayan, R3 uyarısı, "Bu Ay", başlatma reddi, kabul, Meta'daki ileti) AYNI; belirteç kodları (190, 0 evet; 102, 10 hayır;
M180 / M173 birim); S7-a, S7-b ve bağlantı Süresi Doldu iken yeniden deneme kâhinde hata veriyor (kodlanmadı). I2'ye yeni kararlar, I4'e yeni başlıklar (`senaryolar.YENI_250`), I7'ye
"n3 işaretli senaryo kalmadı" eklendi.

**Eski kâhinle (26003126, ayrı kopya) yeni / değişen 21 senaryo:** 14 KIRMIZI, 7 AYNI. İlk koşuda 11 kırmızı yalnız "bilinmeyen olay"dandı (zayıf kanıt, ders 38) → eski kopyaya YALNIZ iki
yeni olay etkisiz tanıtılıp yeniden koşuldu: yine 14 KIRMIZI ve her birinde beklenen neden görülüyor (190 / 0 alan Başarısız ↔ Duraklatıldı; süre dolunca toplu iş aktif ↔ duraklatildi;
başlatma reddi yok; S7 elemesi yok; {{4}} şüpheli dahil). AYNI 7: J9-01/02 + SW1-01…03 (S-W1 bugünkü davranış — kural değişmedi), SW4-03 (102 değişmedi), SW2-02 (deneme başına sayımı
korur; eski kâhinde A2 aynı alıcıyı zaten sayıyordu — M187 içindir). Kanıt `docs/kanit/2026-11-05/wk250-*` (`wk250-OKU.txt`).

### 16.6 Değişen eski beklentiler (292 eski senaryonun TAM model sonucu, 26003126 `senaryolar.json` ile)
280'i bayt bayt aynı (girdi + elle + tam sonuç). Değişen 12:
| Senaryo | Değişen | Neden (KARAR) |
|---|---|---|
| HESAP-0 | girdi (+ `yeniden_baglan` 50. dakikada), elle ve tam sonuç: B Başarısız → Duraklatıldı → Devam Et ile Teslim; B POST 1 → 2; K1 `medya_silme` 2 → 1 (B'nin PDF'i silinmez); "Bu Ay" 2 → 3 | SW4 + SD1915 + SD1837 |
| J9-01, J9-02 | yalnız girdi `bilinen_sinir: n3` kalktı, kaynak / açıklama "KARAR SW1"; tam sonuç AYNI | SW1 |
| ICERIK-10, TARIH-02, J4-01, J4-02, W2-02 | yalnız `kontroller.K2.pencere_farkli_alici.W1` 1 → 0 | SW2 |
| TARIH-03b | yalnız `kontroller.K2.pencere_farkli_alici.W1` 2 → 1 | SW2 |
| W1-03 | yalnız `kontroller.K2.pencere_farkli_alici.W1` 3 → 2 | SW2 |
| W1-04, W2-01 | yalnız `kontroller.K2.pencere_farkli_alici.W1` 2 → 1 | SW2 |
Pencere değişiklikleri P6 §4'ün "`pencere_farkli_alici` ailesindeki TTL farkları kural farkı olarak kapanır" cümlesiyle uyumlu; bu 9 senaryonun elle beklenenleri değişmedi. Kanıt
`docs/kanit/2026-11-05/wk250-eski-292-tam-sonuc-fark.txt`.

### 16.7 Sürücü için (S-34 … S-41; programa karşı koşmadan önce gereken yeni eşlemeler)
- **S-34 `baglanti_suresi_doldu {sirket}`:** programın izlediği belirteç süresi (W-1 a) o anda dolmalı ve sahte Meta'da o belirteç `suresi_dolmus` (`/__sahte/belirtec`) olmalı. Programın
  süreyi nereden öğrendiği (Meta `debug_token` `expires_at`? kullanıcı girişi?) kâhinde bilinmiyor; sahte Meta'da süre ucu YOK (D0) → sürücü programın süre kaynağını sahte saatle bu ana denk
  getirmeli; olay oluşmadıysa (program süreyi bilmedi) senaryo GEÇERSİZ.
- **S-35 `yeniden_baglan {sirket}`:** Elle Bağla ile YENİ geçerli belirteç (sahte Meta'da yeni `gecerli` belirteç); toplu işler Devam Et'siz sürmemeli.
- **S-36 `{"hata": 190 | 0}` kuralı (mesaj ya da medya):** kâhin bu yanıttan SONRA belirteci yeniden bağlanana dek geçersiz sayar (sonraki her istek reddedilir) → sürücü kuraldan sonra sahte
  Meta belirtecini de `suresi_dolmus` (190) / `iptal` (0) yapmalı; senaryolarda yeniden bağlanmadan yapılan istek yalnız SD1837-02'nin (c) okumasında var.
- **S-37 okunacaklar:** bekleyen işin ekran durumu `Duraklatıldı` (Başarısız DEĞİL) ve hata kodu (`secenek`); toplu iş durma nedeni (190 / 0 → kod ya da "Bağlantı Süresi Doldu" → `secenek`;
  süre izlemeyle duran → `baglanti_suresi_doldu`); başlatma reddi nedeni → `baglanti_suresi_doldu`; S7 elemesi ("Şüpheli Alacağı Var") → `supheli_alacak`.
- **S-38 `secenek` (yeniden bağlanmadan Devam Et):** `kahin.py karsilastir` yaprak başına denetler (sürücü değişikliği gerekmez); program Devam Et'te şablon okuyup 190 alırsa istek sayısı (a)
  okumasının değerini verir — o da seçenekte.
- **S-39 S7:** cari `vadeler[].supheli: true` → programda o kalem için şüpheli alacak kaydı (icra / dava) açılır (Ç5'in arayüzü / ucu — kâhin bilmiyor); başlatmada `supheli_elle: [cari]` →
  o cari ELLE seçilir; programın otomatik listesinde etiketli görünüp seçilmeyen cari → `elenen` `supheli_alacak`. Program S7'yi henüz uygulamıyorsa (Ç5 sonra) S7-01/02'de ayrışma BEKLENİR.
- **S-40 n3:** J9-01/02 ve SW1-* `bilinen_sinir` taşımaz → POST 1 çıkarsa KARAR (SW1) ihlali; S-25'in n3 kısmı geçersiz.
- **S-41 `pencere_farkli_alici`:** Süresi Doldu deneme sayılmaz (deneme başına; aynı alıcının sayılan başka kabulü varsa alıcı sayılır).

### 16.8 Kanıt ve DENENMEYEN
- **Kanıt:** senaryolar **310/310** elle = model (`wk250-senaryolar`); kâhinin kendi testi **334/334**, F mutasyon **188/188** (`wk250-kahin`; `TZ=Europe/Istanbul` ile de 334/334 —
  `wk250-kahin-tz-istanbul`); eski kâhinle karşılaştırma ve 292'nin tam sonuç farkı `docs/kanit/2026-11-05/wk250-*`. Sahte Meta'ya DOKUNULMADI (testleri yeniden koşulmadı).
- **DENENMEYEN:** programa karşı sürücü koşusu (görev gereği; S-34…S-41 yazılmadı); sahte Meta'da belirteç süresi ucu (S-34, D0); program bilmeden Meta'da iptal edilen belirteç
  (senaryo kurulmadı — ilk Meta isteğinin şablon okuması mı kişinin isteği mi olduğu programa bağlı; kâhin kural ve süre olayıyla kurar); şablon / basamak okumasında 190 / 0; bağlantı Süresi
  Doldu iken Yine de Gönder / Başarısızları Yeniden Dene (kâhin hata verir); iki şirket aynı WABA, birinin bağlantısı Süresi Doldu; R1 "Bağlantı Bekleniyor" + süre dolması; Süresi Doldu
  sonrası pencere içinde teslim (Y11-4); Sınır'da bekleyenin boşalan yere geçiş anı (Y11-5); failed kabulün pencerede sayımı (Y11-6, bilgi); S7-a / S7-b (KULLANICIYA SORULMALI); S7'nin B1 / S1 /
  S8 ortak gecikmiş tanımıyla birleşimi (Ç5 + muhasebe kâhini — `vadeler` girdisinin üretimi bu kâhinde değişmedi); Meta Bekletti işin 18:37 ile duraklatılıp Devam Et'te 24 saat beklemeden
  gönderilmesi (kâhinin eski Devam Et düzeni, senaryosuz); "Şirket Verisini Sıfırla"nın 190 / süre durumundaki etkisi (S-13 düzeni, senaryosuz).
- **Bilgi (eski):** M5 ve M108 26003126'da da istisnayla (KeyError) yakalanıyordu; bu güncellemede değişmedi.

## 17. Kâhin güncellemesi 12 — S7-a, S7-b (06.11.2026)

### 17.1 Kaynak ve bağımsızlık
Kaynak YALNIZ karar metinleri (AYNEN `kahin.KARARLAR` S7A, S7B): `docs/2.5.0-IS-LISTESI.md` D bölümü "KULLANICI KARARI 06.11 03:35 UTC (AYNEN: 'hepsi A')" satırının S7-a / S7-b
maddeleri ve C bölümündeki iki seçenekli soru metni (SORULDU 05.11 21:56 → YANITLANDI 06.11 03:35); önceki S7 (05.11 21:08) ve 18:55 S3 kararları (`KARARLAR` S7, aynen); WhatsApp
"kime kaç kez" genel ilkesi (CLAUDE.md "2.4.8 KARARLARI"; P6 §0). Okunan başka dosya: CLAUDE.md, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu README, `kahin/*`,
`docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md`, `docs/erp/WHATSAPP-API-PLANI-2.4.8.md` (§1, §6, §7a), `docs/2.5.0-IS-LISTESI.md` A, C ve D bölümleri; `surucu.mjs` içinde yalnız
`supheli` / `şüpheli` (sonuç yok) ve `vadeler` araması (4 satır: `vadeleriKur` adı, kalan > 0 süzgeci, iki çağrı) — sürücünün S7 girdisini eşleyip eşlemediğini görmek için.
`sahte-meta/` bu güncellemede okunmadı (S7 Meta davranışı değil). Program kodu (`server/`, `client/`, `bulut/`, `tools/`), program testleri, `docs/kanit/` (kendi kanıtı dışında),
iş listesinin B ve E bölümleri, git geçmişi / farkı ve öbür ajanların raporları GÖRÜLMEDİ. Programa karşı KOŞULMADI. Eski kâhinle karşılaştırma git'ten değil, taban ağaçtaki
(b12a03d6) `kahin/*` dosyalarının değişiklikten ÖNCE not defterine alınmış kopyasıyla. Bu bölümün 17.2–17.4'ü kodlamadan ÖNCE yazıldı ve ayrı commit'lendi (ders 40); 17.5–17.8 kodlamadan sonra.

### 17.2 Yorumlar (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y12-1 | **S7-a**: "şüphesiz gecikmiş borç" = Y11-19'daki küme: vade < bugün (YEREL gün, §7a 20 kâhin yorumu 5), kalan > 0, şüpheli alacak kaydına alınmamış (`supheli` işaretsiz) kalem. Elle seçilen şüpheli alacaklı caride bu küme BOŞSA cari "Gecikmiş Borç Yok" (`gecikmis_borc_yok`) ile ELENİR: ileti gitmez, POST 0, iş açılmaz; seçilenlerin hepsi elenirse toplu iş kaydı oluşmaz (§7a 31). Küme boş değilse S7 elle yolu aynen (Y11-19: {{3}} / {{4}} şüphesiz kalemlerden) | S7A + S7 + Y11-19 + §7a 20 |
| Y12-2 | S7-a GÖNDERİM ANINDA da uygulanır: Ödeme Hatırlatma'nın eleme denetimi ve değişkenleri gönderim anında (§7a 1–2, Y9d-2; kâhinin §7a 20 elemesi zaten iki anda da). Başlatmada şüphesiz gecikmişi olan elle seçilmiş cari, kuyruktayken şüphesiz kalemi kapanır (kalan 0) ya da şüpheli kaydına alınırsa gönderim anında "Atlandı", neden `gecikmis_borc_yok`. Karar metni anı söylemiyor; kâhin yorumu (ileti gitmez yönü — ilke 1–4 ile çelişmez) | S7A + §7a 2 + Y9d-2 |
| Y12-3 | **Elle ↔ otomatik seçim**: "elle seçim" S7'de "Şüpheli Alacağı Var" etiketli cari için tanımlı ("ekranda … etiketiyle görünür, istenirse elle seçilir"). Kâhin girdisi `baslat.supheli_elle` yalnız BAŞLATMA ANINDA açık şüpheli kaydı olan cariye uygulanır ve işe "elle" işareti yazılır. `secim`de olup `supheli_elle`de olmayan etiketli cari = otomatik liste → `supheli_alacak` (Y11-18 aynen). Başlatmada etiketi OLMAYAN cari `supheli_elle`de verilirse kâhin HATA verir (girdi tutarsız: etiketsiz cari için programda ayrı bir "elle seçim" yok — sürücü bunu üretemez; kâhin anlam uydurmaz) | S7 + S7B ("elle seçilmemiş müşteri") |
| Y12-4 | **S7-b "kuyruktayken" / "gönderim anı" sınırı**: kuyruktayken = toplu iş açılıp iş yazıldıktan sonra, işçinin o kişinin isteğini göndermek için ele aldığı ana kadar (Bekliyor, Sınır Nedeniyle Bekliyor, Duraklatıldı → Devam Et, Lisans Nedeniyle Durdu / açılışta sorulan → Devam Et, Meta Bekletti → 24 sa sonraki 2. deneme). Gönderim anı = işçinin işi Hazırlanıyor'a almadan hemen önceki eleme denetimi (§7a 2 "Atlandı" ile aynı an: silindi / pasif / İstemiyor / numara denetimi). Bu andan SONRA (Hazırlanıyor / Gönderiliyor / Meta Kabul Etti …) açılan şüpheli kaydı etkisizdir (ileti gitti); kâhinde bu aralık sıfır uzunlukta — senaryosuz | S7B + §7a 1–2 + §6 W2 ("Gönderiliyor istekten önce") |
| Y12-5 | **S7-b atlama**: elle işaretsiz işin carisinin gönderim anında açık şüpheli kaydı varsa iş "Atlandı", atlanma nedeni `supheli_alacak` ("Şüpheli Alacağı Var", karar metnindeki ad); POST yok, deneme açılmaz → R3'te ve "Zaten Kuyrukta"da SAYILMAZ (ilke 1: kesin almadı; Atlandı kuyrukta değildir). Gönderme yolu (ilke 4): yeni Ödeme Hatırlatma'da elle seçim — aynı gün de (Zaten Kuyrukta / Sonucu Belirsiz / R3 elemesi doğmaz). Meta Bekletti 2. denemesinde atlanan kişinin 1. iletisi K7 gereği "Daha Önce Gönderildi" sayılmaz (sonradan teslim gelirse J1 gereği sayılır — bugünkü düzen) | S7B + G0 (1, 4) + K7 + J1 |
| Y12-6 | Gönderim anındaki sıra: silindi / pasif / İstemiyor → numara → `supheli_alacak` (S7-b: açık kayıt + elle işaretsiz) → `gecikmis_borc_yok` (§7a 20; S7-a dahil, şüphesiz kalemler). Başlatma sırası Y11-18 ile aynı. Hem kuyrukta şüpheli açılan hem şüphesiz gecikmişi kalmayan elle işaretsiz cari `supheli_alacak` (yalnız neden adı; ileti iki durumda da gitmez) | Y11-18 + S7B |
| Y12-7 | **Elle seçilmiş müşterinin kuyrukta şüpheli olması**: elle işaretli iş (başlatmada etiketliydi) kuyruktayken YENİ bir şüpheli kalem açılsa da ya da kaydı kapanıp yeniden açılsa da elle kalır → S7 elle yolu: gönderim anındaki şüphesiz gecikmiş tutarla gider; şüphesiz gecikmiş kalmadıysa S7-a (Y12-2). Kuyrukta şüpheli kaydı KAPANAN (bütün şüpheli kalemlerin kalanı 0) cari artık etiketsizdir: S7 / S7-b dışında, bütün gecikmişiyle gider ({{5}} güncel bakiye; `plan_susuyor` S7S yalnız kayıt açıkken) | S7 + S7B + Y11-17 ("kaydı açık" = kalanı > 0) |
| Y12-8 | **Elle işaretin taşınması**: Devam Et ve Başarısızları Yeniden Dene AYNI işin (aynı toplu işin kararıyla) yeniden gönderimidir; elle işareti işte kalır (K4 / K5 düzeni: asıl işin dönemi ve kararı yeniden denemeye taşınır). Başarısızları Yeniden Dene TOPLU bir işlemdir, elle seçim DEĞİLDİR: elle işaretsiz işte (kuyruktayken ya da Başarısız iken) açılan şüpheli kaydı gönderim anında S7-b ile atlatır; yol: yeni gönderimde elle seçim (K3: Başarısız deneme sayılmaz). Kâhin yorumu — ana oturum teyit etsin | S7B + K4 / K5 + K3 |
| Y12-9 | S7 / S7-a / S7-b yalnız Ödeme Hatırlatma (Y11-17). Ekstre işinde kuyruktayken açılan şüpheli kaydı etkisiz; `supheli_elle` Ekstre başlatmasında anlamsız (yok sayılır — S7-02'deki Ekstre düzeni) | S7 + Y11-17 |
| Y12-10 | **İlke denetimi (ders 45)**: S7-a elemesi §7a 20 "Gecikmiş Borç Yok" ile aynı türdendir (hatırlatılacak şüphesiz borç yok — çift işlem elemesi değil); şüphesiz borç doğunca hatırlatma, her zaman Ekstre yolu açık. S7-b atlamasının yolu Y12-5. İkisi de ilke (1)–(5) ile ÇELİŞMEZ: kimseye ikinci ileti doğurmaz, almamış kişi sayılmaz, elenen / atlanan kişinin yolu kalır; geri yüklenen / taşınan veride aynı kural (§7a 26 ile duran iş zaten durur). Çelişen tek yer 17.4 S7-c (KODLANMADI) | G0 (1)–(5) |

### 17.3 Önceki güncellemelerle çelişen yerler (yeni KARAR geçer)
- §16.4 "KULLANICIYA SORULMALI S7-a ★ / S7-b ★" (kâhin `ValueError`) → KAPANDI (S7A, S7B = A). §16.5'in "S7-a, S7-b … kâhinde hata veriyor" cümlesi ve kâhinin kendi testi I8'in aynı
  denetimi tersine döner: artık hesaplanır ve A sonucunu verir (yeni denetim I9).
- Y11-18 "istenirse elle seçilir … elle seçilen cari elenmez, gider" → S7-a ile daraldı: şüphesiz gecikmiş YOKSA elle seçilen de elenir. M183 ("elle seçilen de elenir") yine kararın tersidir —
  yalnız şüphesiz gecikmişi OLAN caride (S7-02).
- `supheli_elle` girdisi artık yalnız başlatmada etiketli cariye (Y12-3). Eski senaryolarda yalnız S7-02 kullanıyor (SA etiketli) — beklenti değişmez.

### 17.4 KULLANICIYA SORULMALI / KÂHİN SUSUYOR (ana oturuma)
**KULLANICIYA SORULMALI (kime / kaç kez — KODLANMADI; senaryo bu duruma girerse kâhin `ValueError` verir):**
- **S7-c ★** Ödeme Hatırlatma işi Sonucu Belirsiz kaldı; işteki "Yine de Gönder" (ya da o belirsizlik zincirindeki Başarısızları Yeniden Dene — J10 c) basıldığında carinin şüpheli
  alacak kaydı AÇIK ve iş elle işaretli DEĞİL (kayıt sonuç beklenirken açıldı). S7-b metni "toplu gönderim kuyruktayken" der; Sonucu Belirsiz iş kuyrukta değildir (D1) ve Yine de Gönder kişiye özel,
  onaylı bir işlemdir — iki okuma:
  A) Yine de Gönder ELLE SEÇİM sayılır → ileti şüphesiz gecikmiş tutarla gider (yoksa S7-a "Gecikmiş Borç Yok") — ÖNERİ: ilke (2)'nin "tek yol işteki onaylı Yine de Gönder" yolu açık kalır;
     onay penceresinde "Şüpheli Alacağı Var" etiketi görünmeli.
  B) S7-b gibi gönderim anında "Atlandı — Şüpheli Alacağı Var" → aynı gün yeni gönderimde de D1 + E3 gereği "Sonucu Belirsiz" ile elenir: o gün ÇIKMAZ (ilke 4), ertesi gün yeni gönderimde
     elle seçimle gider.
  (Elle işaretli işte Yine de Gönder Y12-8 gereği elle kalır → gider; soru yalnız elle işaretsiz iş.)

**Bilgi / ana oturuma (kodlanmadı; kime kuralı, bu görevin kapsamı dışında):**
- **(5) × S7**: 05.11 21:30 kararı (5) "gecikmiş tutar carinin net borcunu aşmaz … bize alacaklı kişiye hatırlatma gitmez" WhatsApp kâhininde YOK (girdi `vadeler` = açık kalemler; bakiyeyle
  sınırlanmaz). (5) Ç5'in ortak gecikmiş tanımıyla programa girince Ödeme Hatırlatma'nın kime gideceği değişir → WK'ye ayrı bakım gerekir. Ayrıca elle seçilen şüpheli caride "şüphesiz gecikmiş
  tutar"ın net borçla nasıl sınırlanacağı (min(şüphesiz gecikmiş, net borç) mı; net borçtan şüpheli kalemler düşülerek mi) karar metinlerinde yok → para / kime sorusu (ders 43). Bu güncellemenin
  senaryolarında net borç (hareketlerden bakiye) ≥ şüphesiz gecikmiş — iki okuma ayrışmaz.

### 17.5 Kâhinde (kodlama) — senaryolar (8) ve mutasyonlar (9)
Kod: `KARARLAR` S7A, S7B (AYNEN); `gecikmis()` yerel günle (M198 UTC günü); `supheli_acik()` kalan > 0 (M194 kalanına bakmaz); `baslat`: elle seçilen şüpheli caride §7a 20 denetimi
şüphesiz kalemlerle → `gecikmis_borc_yok` (eski `ValueError` S7-a kalktı; M190 B seçeneği), `supheli_elle` yalnız Ödeme Hatırlatma'da ve başlatmada etiketli cariye (değilse girdi hatası);
`isci` (gönderim anı): silindi / pasif / İstemiyor → numara → `supheli_alacak` (açık kayıt + elle işaretsiz; M192 B seçeneği, M195 Meta Bekletti 2. denemesi hariç) → `gecikmis_borc_yok`
(M191 elle şüpheli caride yalnız başlatmada; M197 sıra ters); eski `ValueError` S7-a / S7-b kalktı, yerine belirsizlik onayı (`belirsiz_onay`) taşıyan elle işaretsiz işte S7-c `ValueError`;
elle işareti işte kalır (M193 Devam Et / `tasi`'de siler); `kuyrukta()` M196 (S7-b ile atlanan işi kuyrukta sayar). Yeni olay / çıktı alanı YOK (mevcut `cari.vadeler`, `baslat.supheli_elle`,
`atlanma_nedeni`).

| Karar | Senaryo | Sınır | Mutasyon (yakalayan) |
|---|---|---|---|
| S7A | S7A-01 dört elle seçilmiş şüpheli cari: SA2 (şüphesiz kalemin vadesi gelmedi), SC (vadesi BUGÜN), SD (şüphesiz kalem kapalı) "Gecikmiş Borç Yok", SB (150,00 TL) gider; yalnız SA2'li T2'nin kaydı oluşmaz · S7A-02 sınırda bekleyen elle SE / SF / SH: şüphesiz kalem ödenir / şüpheliye alınır / kısmen ödenir → SE, SF gönderim anında "Atlandı — Gecikmiş Borç Yok" (POST 0), SH gönderim anındaki 180,00 TL ile · S7A-03 30.10 23:50 vadesi bugün → elenir; 31.10 00:10 yerel (UTC'de 30.10) → gider | vade = bugün, kalan 0, gece yarısı yerel ≠ UTC, 24 sa sınır | M190 (S7A-01), M191 (S7A-02), M198 (S7A-03) |
| S7B | S7B-01 sınırda bekleyen B7 (tek gecikmiş kalemi şüpheliye — neden yine `supheli_alacak`) ve D7 (bir kalemi şüpheliye) Atlandı, C7 gider; ertesi gün D7 elle seçilince gider (Zaten Kuyrukta / R3 yok — çıkmaz yok) · S7B-02 duraklatılmışken X7'ye kayıt açılır → Devam Et'te Atlandı; elle seçilmiş SE7'ye yeni şüpheli kalem → 200,00 TL ile gider · S7B-03 kayıt kuyrukta açılıp kapanır (kalan 0) → bütün gecikmişle ve güncel bakiyeyle gider · S7B-04 Meta Bekletti 2. denemesi gönderim anı → Atlandı, POST 1 · S7B-05 Başarısızları Yeniden Dene: R7 Atlandı, elle işaretli RE7 gider | Devam Et, 24 sa sınır, Meta Bekletti 24 sa, yeniden deneme, kalan 0, sıra | M192, M196, M197 (S7B-01); M193 (S7B-02); M194 (S7B-03); M195 (S7B-04) |

M190–M198 hepsi DEĞERLE (elle beklenen) yakalanıyor — istisnayla yakalanan yok. Kâhinin kendi testine **I9** eklendi: güncelleme 11'in S7-a / S7-b hata yolları (I8'deki iki girdi) artık A sonucunu
veriyor; S7-c (işteki Yine de Gönder + sonuç beklenirken açılan kayıt, elle işaretsiz) ve girdi tutarsızlığı (etiketsiz cariye `supheli_elle`) hata veriyor; elle işaretli işte Yine de Gönder hesaplanıyor
(POST 2); Ekstre başlatmasında `supheli_elle` sonucu değiştirmiyor. I8'in S7 kısmı I9'a taşındı; I2'ye S7A / S7B, I4'e başlıklar (`senaryolar.YENI_250`).

**Eski kâhinle (taban b12a03d6, değişiklikten ÖNCE alınmış kopya) yeni 8 senaryo:** 7 KIRMIZI, 1 AYNI. KIRMIZI'ların hepsinde neden beklenen: eski kâhinin "KULLANICIYA SORULMALI S7-a / S7-b …
kodlanmadı" hatası (kural yoktu). AYNI: S7B-03 (gönderim anında kayıt kapalı — eski kâhin de bütün gecikmişle gönderiyordu; M194 içindir). Ek (bilgi, ders 38): eski kopyada YALNIZ bu üç hata
satırı bellekte etkisiz kılınınca (karar yokken düşülecek yol: başlatmada §7a 20, gönderim anında şüpheli denetimi yok = S7-b'nin B'si) S7A-01/02/03 + S7B-03 AYNI, S7B-01/02/04/05 KIRMIZI ve
her birinde beklenen neden görülüyor (kuyrukta kaydı açılan elle işaretsiz cari gidiyor: X7 / R7 POST 1 → 2, MB7 2. deneme gidiyor, D7 T1'de gidip T2'de "Daha Önce Gönderildi"). S7-a'nın A'sı
§7a 20 düzeninin doğal devamıdır; S7A senaryolarının B'ye karşı dişi M190 / M191. Kanıt `docs/kanit/2026-11-06/wk12-eski-kahinle-yeni-senaryolar*.txt`.

### 17.6 Değişen eski beklentiler
YOK: 310 eski senaryonun girdi + elle + TAM model sonucu (başlık / kaynak / açıklama dahil) bayt bayt aynı (taban b12a03d6'nın değişiklikten önce alınmış `senaryolar.json` kopyasıyla);
üst alanlardan yalnız `kararlar`'a S7A, S7B eklendi. Kanıt `docs/kanit/2026-11-06/wk12-eski-310-tam-sonuc-fark.txt`.

### 17.7 Sürücü için (S-42 … S-46; programa karşı koşmadan önce gereken yeni eşlemeler)
- **S-42 `vadeler[].supheli`:** S-39 aynen — o kalem için programda şüpheli alacak kaydı (icra / dava) açılır. Sürücüde bugün YOK (`vadeleriKur` kalan > 0 süzgeciyle kalemleri kuruyor; `supheli`
  araması sonuç vermedi). Kuyruktayken `cari {vadeler}` olayı (kalemin şüpheli kaydına alınması, kaydın kapanması = kalan 0, şüphesiz kalemin ödenmesi) programda O ANDA yapılmalı (Ç5'in arayüzü /
  ucu — kâhin bilmiyor); yapılamadıysa senaryo GEÇERSİZ. `hareket_ekle` ödemesi aynı anda.
- **S-43 `baslat.supheli_elle`:** programın Ödeme Hatırlatma listesinde "Şüpheli Alacağı Var" etiketli carinin ELLE işaretlenmesi; etiketsiz cariye verilmez (kâhin girdi hatası, Y12-3).
- **S-44 okunacaklar:** başlatma özetinde elle seçilen şüpheli carinin "Gecikmiş Borç Yok" → `elenen` `gecikmis_borc_yok` (S7A-01 / 03, oluşmayan T2); iş ekranında "Atlandı" + neden
  "Şüpheli Alacağı Var" → `atlanma_nedeni` `supheli_alacak`, "Gecikmiş Borç Yok" → `gecikmis_borc_yok`; atlanan işin POST'u (0; Meta Bekletti'de 1); yeniden deneme yanıtının `alinan`'ı (S7B-05).
- **S-45 zaman:** S7A-03 başlangıcı 30.10.2026 23:50 yerel — program ve sahte Meta aynı sahte saatte (`config.now`, `/__sahte/saat`); "bugün" programın YEREL günü; iki koşu `TZ=Europe/Istanbul`
  ve `TZ=UTC` (ders 13, 22).
- **S-46:** program S7-a / S7-b'yi henüz uygulamıyorsa (Ç5 sonra) S7A / S7B senaryolarında ayrışma BEKLENİR (S-39 düzeni) — Ç5 birleşince yeniden koşulur. S7-c'ye giren senaryo yok (kâhin hata
  verir). (5) × S7 (17.4): Ç5 (5)'i uygularsa programın gecikmiş tutarı bakiyeyle netleşir — bu senaryolarda net borç ≥ şüphesiz gecikmiş (iki okumada da aynı), ayrışma doğmamalı.

### 17.8 Kanıt ve DENENMEYEN
- **Kanıt** (`docs/kanit/2026-11-06/wk12-*`): senaryolar **318/318** elle = model (`wk12-senaryolar`); kâhinin kendi testi **343/343**, F mutasyon **197/197** (`wk12-kahin`, `TZ=UTC`;
  `wk12-kahin-tz-istanbul` 343/343); eski kâhinle yeni 8 senaryo (ham + nötr kopya); 310 eski senaryonun tam sonuç farkı; araçlar `wk12-araclar/`. Sahte Meta'ya DOKUNULMADI (testleri koşulmadı).
- **DENENMEYEN:** programa karşı sürücü koşusu (görev gereği; S-42…S-46 yazılmadı); S7-c (KULLANICIYA SORULMALI); (5) × S7 (bilgi); elle işaretli carinin kaydı kuyrukta kapanıp YENİDEN açılması
  (Y12-7; kâhinde işaret işte kalır — senaryosuz); Lisans Nedeniyle Durdu / açılışta sorulan işin Devam Et'te atlanması (Y12-4; Duraklatıldı ile aynı yol — ayrı senaryo yok); gönderim anından
  SONRA (Hazırlanıyor / Gönderiliyor) açılan kayıt (Y12-4; sıfır aralık); geri yükleme / taşıma ile duran işte S7 (§7a 26 düzeni, senaryosuz); iki şirket (cari şirkete özgü); Meta Bekletti'de
  atlanan işin 1. iletisine geç teslim (J1 düzeni, senaryosuz); bağlantı Süresi Doldu (SD1837) ile S7-b birleşimi (Devam Et yolu aynı, senaryosuz).

## 18. Kâhin güncellemesi 13 — S16, S17, karar (5) (06.11.2026)

### 18.1 Kaynak ve bağımsızlık
Kaynak YALNIZ karar metinleri (AYNEN `kahin.KARARLAR` S16, S17, NB5): `docs/2.5.0-IS-LISTESI.md` D bölümü "KULLANICI KARARI 06.11 04:50 UTC (AYNEN: 'benden beklediğin cevapların hepsine A
yap')" satırının S16 / S17 maddeleri, C bölümündeki iki seçenekli soru metni (SORULDU 06.11 04:05 → YANITLANDI 04:50), D bölümü "KULLANICI KARARLARI 05.11 (21:30 UTC'de işlendi …)" satırının
(5) maddesi; önceki S7 / S7-a / S7-b kararları (`KARARLAR` S7, S7A, S7B, aynen); WhatsApp "kime kaç kez" genel ilkesi (CLAUDE.md "2.4.8 KARARLARI"; P6 §0). Okunan başka dosya: CLAUDE.md,
`docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu README, `kahin/*`, `docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md`, `docs/erp/WHATSAPP-API-PLANI-2.4.8.md` (§1, §6, §7a), `docs/2.5.0-IS-LISTESI.md` A, C ve
D bölümleri; `surucu.mjs` içinde yalnız `supheli|şüpheli` (sonuç yok), `yine_de_gonder` (4 satır: belirsiz önerisi, öneri mutantı, olay dalı adı, `yeniden` çıktısının kuruluşu) ve `alacak`
(1 satır: hareketin borç ya da alacak tutarı) araması — sürücünün Yine de Gönder yanıtını ve alacak hareketini eşleyip eşlemediğini görmek için. `sahte-meta/` okunmadı (bu kararlar Meta
davranışı değil). Program kodu (`server/`, `client/`, `bulut/`, `tools/`), program testleri, `docs/kanit/` (kendi kanıtı dışında), iş listesinin B ve E bölümleri, git geçmişi / farkı ve öbür
ajanların raporları GÖRÜLMEDİ. Programa karşı KOŞULMADI. Eski kâhinle karşılaştırma git'ten değil, taban ağaçtaki (e6e5610f) `kahin/*` dosyalarının değişiklikten ÖNCE not defterine alınmış
kopyasıyla. Bu bölümün 18.1–18.4'ü kodlamadan ÖNCE yazıldı ve ayrı commit'lendi (ders 40); 18.5–18.9 kodlamadan sonra.

Ön tarama (kodlamadan önce, eski kâhinle; yalnız girdi okuması): 318 senaryonun Ödeme Hatırlatma içeren 22'sinde hiçbir işte vadesi geçmiş toplam > net borç ya da net borç ≤ 0 yok →
(5) / S17'nin eski beklentileri değiştirmesi BEKLENMİYOR (18.7'de tam sonuç farkıyla denetlenir).

### 18.2 Yorumlar (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y13-1 | **S16 tetiği**: "Sonucu Belirsiz iş beklerken şüpheli alacak kaydı açıldıysa" = Ödeme Hatırlatma işinde işteki "Yine de Gönder" BASILDIĞI ANDA carinin şüpheli alacak kaydı AÇIK (Y11-17: kalanı > 0 `supheli` kalem; vadesine bakılmaz) ve iş elle işaretsiz. Başka yoldan bu duruma gelinmez: kayıt başlatmada açık olsaydı iş açılmazdı (Y11-18), kuyruktayken açılsaydı gönderim anında atlanırdı (S7B); geriye iş Sonucu Belirsiz iken (ya da gönderim anından sonra) açılan kayıt kalır. Kayıt beklerken açılıp basmadan ÖNCE kapandıysa (bütün şüpheli kalemlerin kalanı 0) tetik YOK: iş elle işaretsiz, etiket yok, S7 dışında (Y12-7 düzeni) | S16 + Y11-17 + Y12-7 |
| Y13-2 | **"elle seçim sayılır"** = işe elle işareti yazılır (Y12-3'teki işaret); Y12-7 / Y12-8 düzeni sürer: işaret işte kalır (kayıt kapanıp açılsa da), Devam Et ve o belirsizlik zincirindeki Başarısızları Yeniden Dene (aynı işin yeniden gönderimi, J10 c) taşır. Gönderim anında S7 elle yolu: ileti şüphesiz tutarla ({{3}} / {{4}} şüphesiz kalemlerden — Y11-19, S17 sınırıyla; {{5}} `plan_susuyor` S7S aynen) | S16 + S7 + Y12-7 / Y12-8 |
| Y13-3 | **"(yoksa elenir)"**: basma anında şüphesiz tutar (Y13-8 sınırıyla) yoksa kişi Yine de Gönder YANITINDA elenir (`yeniden.<etiket>.elenen`), iş alınmaz ve Sonucu Belirsiz kalır (ilke 2: almış olabilir; yol yine işteki Yine de Gönder — şüphesiz borç doğunca — ya da ertesi gün yeni gönderimde elle seçim, E3). "elenir" sözcüğü S7-a'nın başlatma elemesiyle aynı, S7-b'nin "gönderim anında atlanır"ından ayrı → kâhin modeli basma anı. Basmadan sonra gönderim anına kadar şüphesiz tutar biterse Y12-2 aynen: "Atlandı — Gecikmiş Borç Yok". Ad: şüphesiz vadesi geçmiş kalem kümesi boşsa `gecikmis_borc_yok` (S7-a aynen), değilse (net sınırı) Y13-7 seçeneği. Sıra: bu denetim Yine de Gönder'in öbür elemelerinden (Zaten Kuyrukta → Daha Önce Gönderildi) ÖNCE (başlatma sırası Y11-18: gecikmiş denetimi Zaten Kuyrukta'dan önce). KÂHİN SUSUYOR (18.4): elemenin basma anında değil yalnız gönderim anında yapılması (iş alınır, hemen "Atlandı") — kime / kaç kez aynı (ileti gitmez) → iki okuma koşulur, ayrışan yapraklar `secenek` | S16 + S7A + Y12-2 + G0 (2, 4) |
| Y13-4 | **"onay penceresinde 'Şüpheli Alacağı Var' yazar"**: işteki Yine de Gönder'in onay penceresi basma anında şüpheli kaydı açık olan Ödeme Hatırlatma carisi için etiketi gösterir → kâhin çıktısı `yeniden.<etiket>.supheli_etiketi` = [cari] (YALNIZ boş değilse; eski çıktılar değişmez). Pencere yanıttan önce açıldığından kişi sonra elense de (Y13-3, Zaten Kuyrukta, Daha Önce Gönderildi) etiket görünür; iş zaten elle işaretli olsa da görünür (S7 "ekranda … etiketiyle görünür"). Ekstre işinde etiket ve S16 yok (Y12-9); Başarısızları Yeniden Dene'nin onayında etiket karar metninde yok (modellenmedi) | S16 + S7 + Y12-9 |
| Y13-5 | S16'nın işareti yalnız basma anındaki açık kayıttan doğar. Basma anında kayıt YOKSA iş elle işaretsiz kalır; bu işte (belirsizlik onayıyla gönderilecekken) kayıt SONRADAN açılırsa iki karar da tam uymaz → 18.4 **S7-d ★** (KODLANMADI; kâhin hata verir — eski S7-c hatasının daralmış hâli) | S16 + S7B |
| Y13-6 | **Karar (5) "gecikmiş tutar carinin net borcunu aşmaz (alış faturası düşülür)"**: net borç = carinin hareketlerinden bakiye (borç − alacak; alış faturası alacak tarafında), {{5}} güncel bakiyeyle AYNI kesim (tarih ≤ bugün, YEREL gün — kâhin yorumu 5). Ödeme Hatırlatma {{4}} = min(vadesi geçmiş açık kalemlerin toplamı, net borç). {{3}} DEĞİŞMEZ: en eski vadesi geçmiş açık kalemin vadesi ("faturaların Açık / Ödendi durumu yalnız Mahsup Et ile" — netleşme kalemi kapatmaz). Başlatmada ve gönderim anında (Y9d-2: hatırlatma içeriği gönderim anında) | NB5 + §7a 20 + Y9d-2 |
| Y13-7 | **Karar (5) "bize alacaklı kişiye hatırlatma gitmez"**: vadesi geçmiş kalemi olan kişide sınırlanmış tutar ≤ 0 (net borç ≤ 0; sıfır da — 0,00 TL'lik hatırlatma anlamsız, görev metni "net borç ≤ 0") → ELENİR: başlatmada `elenen`, gönderim anında "Atlandı" (§7a 2 düzeni), Yine de Gönder'de (S16 işinde) Y13-3. Eleme ADI karar metninde YOK → `{"secenek": ["gecikmis_borc_yok", "net_borc_yok"]}` (kime / kaç kez iki adda aynı: ileti gitmez). Sıra: … → `gecikmis_borc_yok` (vadesi geçmiş kalem kümesi BOŞ — eski ad aynen, eski senaryolar değişmez) → net sınırı (bu yorum) → Zaten Kuyrukta → Sonucu Belirsiz → R3. Gönderim anında: … → `supheli_alacak` (S7-b) → `gecikmis_borc_yok` → net sınırı. BAŞ MİMARA ÖNERİ (ad): ayrı "Net Borcu Yok" — kalem bazında vadesi geçmiş faturası görünen kişide "Gecikmiş Borç Yok" yanıltıcı | NB5 + §7a 20 + Y11-18 + Y12-6 |
| Y13-8 | **S17 "şüpheli kalemler HARİÇ net borç"** = net borç (Y13-6) − açık şüpheli kalemlerin kalanı toplamı (Y11-17: kalanı > 0 `supheli` kalem; vadesi gelmemiş şüpheli kalem DE düşülür — "şüpheli kalemler" hepsini der). Elle seçilmiş şüpheli alacaklı caride {{4}} = min(şüphesiz vadesi geçmiş toplam, şüphesiz net borç). Bu tutar ≤ 0 → "şüphesiz tutar yok" → ELENİR (S16 "yoksa elenir" + S7-a + (5); başlatmada, gönderim anında, Yine de Gönder'de), ad Y13-7 gibi. Şüphesiz net borç ≤ toplam net borç olduğundan (5)'in iki koşulu kendiliğinden sağlanır. Kayıt kapalıysa (kalanlar 0) düşülecek bir şey yok — formül (5)'e iner | S17 + NB5 + S7A + Y11-17 |
| Y13-9 | (5) ve S17 yalnız Ödeme Hatırlatma ("hatırlatma gitmez", "iletideki gecikmiş tutar"); Ekstre değişmez — bize alacaklı kişiye Ekstre "… TL (Alacaklı)" ile gider (§7a 22) | NB5 + S17 + §7a 22 |
| Y13-10 | **İlke denetimi (ders 45)**: S16 A ilke (2)'nin "tek yol işteki onaylı Yine de Gönder"ini açık tutar (B'nin "o gün çıkmaz"ı yok); Y13-3 / Y13-7 / Y13-8 elemeleri §7a 20 türündendir (hatırlatılacak tutar yok — çift işlem elemesi değil): iletiyi doğurmaz, almamış kişiyi saymaz (elenen / atlanan iş deneme açmaz → R3'te ve Zaten Kuyrukta'da yok), yol kalır (borç doğunca hatırlatma, her zaman Ekstre); geri yüklenen / taşınan veride aynı kural (bakiye ve kalemler dosyadan). Çelişen tek yer 18.4 S7-d (KODLANMADI) | G0 (1)–(5) |

### 18.3 Önceki güncellemelerle çelişen yerler (yeni KARAR geçer)
- §17.4 "KULLANICIYA SORULMALI S7-c ★" (kâhin `ValueError`) → KAPANDI (S16 = A). Kâhinin gönderim anındaki S7-c hatası DARALIR: yalnız S7-d (Y13-5). Kâhinin kendi testi I9'un (c) denetimi tersine döner
  (aynı girdi artık hesaplanır: elle işaretlenir, şüphesiz tutarla gider) — yeni denetim I10.
- §17.4 "Bilgi / ana oturuma: (5) × S7" → KAPANDI (S17 + (5) kodlandı).
- §2 / §5 §7a 20 "{{4}} vadesi geçmiş toplam … gecikmiş borcu olmayan elenir" → (5) ile {{4}} net borçla sınırlı; vadesi geçmiş kalemi olsa da net borcu ≤ 0 olan da elenir.
- Y11-19 / Y12-1 "{{4}} şüpheli OLMAYAN vadesi geçmiş kalemlerin toplamı", "şüphesiz gecikmiş borç = bu küme" → S17 ile şüphesiz net borçla sınırlı; S7-a'nın "şüphesiz gecikmiş borç yok"u = sınırlanmış tutar ≤ 0.
- M182 ("{{4}} şüpheli tutarı da içerir") S17'den sonra yalnız toplamı değiştirirse sınır onu geri keser → mutant aynı anlamda (şüpheli dahil tutar) sınırı da şüpheli dahil hesaplar (18.5).

### 18.4 KULLANICIYA SORULMALI / KÂHİN SUSUYOR (ana oturuma)
**KULLANICIYA SORULMALI (kime / kaç kez — KODLANMADI; senaryo bu duruma girerse kâhin `ValueError` verir):**
- **S7-d ★** Ödeme Hatırlatma işi Sonucu Belirsiz; işteki "Yine de Gönder" basıldığı anda şüpheli kaydı YOKTU (iş elle işaretsiz kaldı, etiket görünmedi); iş gönderim beklerken (Sınır Nedeniyle
  Bekliyor / Duraklatıldı → Devam Et / Başarısız → o zincirdeki Başarısızları Yeniden Dene) carinin şüpheli alacak kaydı AÇILDI. S7-b metni "toplu gönderim kuyruktayken … elle seçilmemiş müşteri"
  der, S16 metni "Sonucu Belirsiz iş beklerken … açıldıysa Yine de Gönder elle seçim sayılır" der — ikisi de bu sıraya tam uymaz:
  A) (ÖNERİ) S7-b gibi gönderim anında "Atlandı — Şüpheli Alacağı Var" (kullanıcı onaylarken kişiyi şüpheli görmedi — S7 "otomatik gitmez"); yol: işteki Yine de Gönder yeniden (o an kayıt açık →
     S16 ile elle → şüphesiz tutarla gider) ya da ertesi gün yeni gönderimde elle seçim — çıkmaz yok;
  B) Yine de Gönder kişiye özel onaylı seçimdir → elle sayılır, şüphesiz tutarla gider (yoksa elenir).

**KÂHİN SUSUYOR — `secenek` yaprağı (kime / kaç kez DEĞİŞMEZ; program seçeneklerden birini vermeli):**
- **S16 elemenin anı** (Y13-3): (a) basma anında — Yine de Gönder yanıtında elenir, iş Sonucu Belirsiz kalır (MODEL); (b) gönderim anında — iş alınır, gönderim anında "Atlandı" (aynı ad). Kâhin
  iki okumayı koşar (`s16_an`: `basma` / `gonderim`); ayrışan yapraklar (`yeniden.<etiket>.elenen` / `alinan`, iş durumu, durum sayıları, ara denetimler) `secenek`. İki okumada kime / kaç kez
  (ileti, kabul, Meta'daki ileti, "Bu Ay", yeni toplu işte elenen, R3) AYNI olmalı; ayrışırsa (b'de gönderim beklerken şüphesiz borç doğup ileti giderse) kâhin HATA verir — KULLANICIYA SORULMALI,
  senaryosuz. (b) okumasında yeniden basma asıl işte (`hedef: "asil"`) yapılır.
- **(5) / S17 net elemesinin adı** (Y13-7): `gecikmis_borc_yok` ya da `net_borc_yok`.

**Bilgi (kodlanmadı / senaryosuz):**
- Netleşmede {{3}}: kâhin en eski açık kalemi gösterir (Y13-6); netleşme "en eskiden düşülür" okunursa net borç en eski kalemin kalanından küçükken {{3}} değişebilir — senaryolarda netleşme en eski
  kalemin kalanını aşmaz (iki okuma aynı).
- İşteki Yine de Gönder'de şüpheli OLMAYAN carinin §7a 20 / (5) denetimi kâhinde (eskiden beri) yalnız gönderim anında; basma anında değil (S16 yalnız şüpheli kayıtlı cariyi söyler) — senaryosuz.
- İleri tarihli (tarihi bugünden sonra) hareket net borca girmez (Y13-6 kesimi) — senaryosuz.
