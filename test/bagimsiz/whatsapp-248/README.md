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
3. **Senaryo kümesi** (`kahin/senaryolar.py` → `kahin/senaryolar.json`) — 367 senaryo (güncelleme 17 ile; aşağıdaki döküm 291'e kadar, + **güncelleme 17** 14: S34 2, S35 2, S36 2, S37 2, S38 2, S33 2, S41 2 — §22; + **güncelleme 16** 11: S29 4, S30 3, S31 2, S32 2 — §21; + W3 1 + **güncelleme 11** 18: SW1 3, SW2 2, SD1837 3, SD1915 5, SW4 3, S7 2 — §16 + **güncelleme 12** 8: S7A 3, S7B 5 — §17 + **güncelleme 13** 8: S16 4, S17 2, NB5 2 — §18 + **güncelleme 14** 6: S22 6 — §19 + **güncelleme 15** 10: S23 5, SW3 5 — §20): 145 (plan §8 "Nasıl bozulur?" başlıklarının hepsi + §7a kararlarının ve R1–R3'ün her biri)
   + 34 **kâhin güncellemesi 2** (31.10.2026, ürün sahibi kararları K1–K8; §7) + 19 **kâhin güncellemesi 3** (★ soruların yanıtları D1–D8; §8) + 12 **kâhin güncellemesi 4** (N2–N5 yanıtları E1–E4 + N6; §9) + 5 **güncelleme 5** (P1/P2 → F1/F2; §10) + 16 **güncelleme 6** (G0 ilke + G1–G5; §11) + 5 **güncelleme 7** (G6; §12) + 8 **güncelleme 8** (H1–H4; §13) + 29 **güncelleme 9** (01.11.2026 kullanıcı onaylı 8 davranış J1–J8 + n3 BİLİNEN SINIR J9; §14) + 8 **güncelleme 9b** (S9-1 / S9-2 kararları J10–J11; §14.10–14.12) + 3 **güncelleme 9c** (ekstre içeriği açılışta, J12; §14.13–14.14) + 7 **güncelleme 10** (2.4.9 W: teslim süresi 30 gün W1 + W-KÖK W2; §15).

**Bağımsızlık.** Programın kodu (`server/`, `client/`, `bulut/`) GÖRÜLMEDEN yazıldı (KANIT KURALI 2, ders 5). Okunanlar: CLAUDE.md, plan, iş listesi,
araştırma belgesi, Meta belge sayfaları (send-messages, document-messages, media, template-media, components, template-management, template-categorization,
template-quality, error-codes, webhooks overview / override / status reference, messaging-limits, throughput, access-tokens, registration, embedded-signup
implementation / tech-provider onboarding / versions, pricing) ve bu klasörün düzeni için `test/bagimsiz/edm-sayac/` README'si.
Plan §6 K0 klasör olarak `test/sahte-meta/` yazıyor; görev bu klasörü (`test/bagimsiz/whatsapp-248/`) verdi.

**Bağımsızlığın sınırı.** Elle beklenen ile model aynı elden (bu kâhin) çıktı: bağımsızlık PROGRAMA göredir. Kendi içindeki dişi: (a) elle beklenen ↔ model
iki ayrı türetme, (b) mutasyon testi (164 bilerek hata — 30'u §7a kararlarının ya da R1–R3'ün tersi, 30'u K1–K8'in (M68–M97), 11'i D1–D8'in (M98–M108), 9'u E1–E4 + N6'nın (M109–M117), 2'si F1/F2'nin (M118–M119), 9'u G0–G5'in (M120–M128), 2'si G6'nın (M129–M130), 6'sı H1–H4'ün (M131–M136), 16'sı J1–J9'un (M137–M153; M149 güncelleme 9b'de kalktı) 9'u J10–J11'in (M154–M162) 2'si J12'nin (M163–M164), 1'i J7 düzeltmesinin (M165) ve 5'i W1/W2'nin (M166–M170; M7 de W1'e göre TERSİNE çevrildi), 1'i W3'ün (M171) ve 18'i güncelleme 11'in (M172–M189; M151 artık SW1'in tersi), 9'u güncelleme 12'nin (M190–M198), 11'i güncelleme 13'ün (M199–M209), 3'ü güncelleme 14'ün (M210–M212), 10'u güncelleme 15'in (M213–M222), 13'ü güncelleme 16'nın (M223–M235), 15'i güncelleme 17'nin (M236–M250) tersi — toplam 249, her biri en az bir senaryoda yakalanıyor), (c) değişmezler (ör. "Bu Ay"
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
| `kahin/senaryolar.py` | 367 senaryo (girdi + ELLE beklenen); modelle karşılaştırır, aynıysa `senaryolar.json` yazar |
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
`sahte_kanca` [İMZASIZ olay: `wamid` ya da `is` (gerçek işin wamid'i), `durum`, `kod`, `opaque`]; güncelleme 17: yeni olay yok, yeni girdi `ayar.baglanti_yolu` (yol1 / yol2) ve kanca `adres` (alternatif / uygulama) — §22; güncelleme 16: yeni olay yok, `kvkk_sil` S30 / S32 ile genişledi — §21; güncelleme 11: `baglanti_suresi_doldu` / `yeniden_baglan` {`sirket`},
`baslat.supheli_elle`, `vadeler[].supheli` — §16; güncelleme 13: `hareketler[].belge` ("alis_faturasi"; kâhin yalnız tutarı okur) — §18; güncelleme 15: `kvkk_sil {id}` (KVKK silme talebi), `kontrol {icerik: true}` (içerik görünümü) — §20), `ozet_cikti`. `meta_davranis.kanca` olayları Meta'nındır
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

### 18.5 Kâhinde (kodlama) — senaryolar (8) ve mutasyonlar (11)
Kod: `KARARLAR` S16, S17, NB5 (AYNEN); `net_borc()` (hareketlerden bakiye, tarih ≤ bugün yerel gün, açık şüpheli kalemlerin kalanı düşülür), `hatirlatma_tutari()` ({{4}} = min(kalemler, net)),
`hatirlatma_engeli()` (başlatma, gönderim anı ve Yine de Gönder ORTAK: kalem kümesi boş → `gecikmis_borc_yok`, sınırlanmış tutar ≤ 0 → `NET_ENGEL` = `{"secenek": ["gecikmis_borc_yok",
"net_borc_yok"]}`); `yine_de_gonder`: S16 tetiği basma anındaki `supheli_acik`, etiket `supheli_etiketi`, elle işareti, basma okumasında eleme / gönderim okumasında iş alınır (`s16_bos`);
`isci`: eski S7-c hatası → **S7-d** (yalnız basma anında kaydı yokken sonra açılan, elle işaretsiz belirsizlik onayı işi), gönderim okumasında iki okumanın kime / kaç kez ayrışması → hata;
`tasi`: "Atlandı" işin asıl işten yeniden gönderiminde eski atlanma nedeni kalkar (yalnız gönderim okumasının yeniden basmasında olur — eski senaryolarda hiç olmuyor, 18.7);
`hesapla_tek` okumaları GENEL (`OKUMALAR` = devam_sd, s16_an; `okuma_birlesimleri()`; koşuda karşılaşılan her anahtarın bütün birleşimleri, devam_sd tek başına eskisiyle aynı sırayla).
Çıktıda yeni alan yalnız `yeniden.<etiket>.supheli_etiketi` (boş değilse). M182 ("{{4}} şüpheli tutarı da içerir") sınırı da şüpheli dahil hesaplar (18.3 son madde) — S7-02'de yine değerle yakalanıyor.

| Karar | Senaryo | Sınır | Mutasyon (yakalayan) |
|---|---|---|---|
| S16 | S16-01 belirsiz U'ya kayıt açılır → Yine de Gönder: etiket, elle, şüphesiz net 700 − 400 = 300 → 14.10.2026 / 300,00 TL; şüpheli kayıtlı EY'nin Ekstre Yine de Gönder'i etiketsiz, S7'siz gider · S16-02 tek gecikmiş kalem şüpheliye, öbürünün vadesi BUGÜN → elenir (`secenek`: yanıtta elenir / gönderim anında Atlandı), ertesi gün asıl işte yeniden basma → 30.10.2026 / 150,00 TL · S16-03 kayıt basmadan önce kapanır (kalan 0 + icra tahsili) → etiket yok, 15.10.2026 / 250,00 TL + güncel bakiye · S16-04 Yine de Gönder (elle) 131021 ile Başarısız, 1. iletinin geç failed'ı, zincirdeki Başarısızları Yeniden Dene işareti taşır → 16.10.2026 / 400,00 TL | vade = bugün → ertesi gün, kalan 0, 131021 + geç failed | M199, M201, M209 (S16-01); M200 (S16-02); M208 (S16-03) |
| S17 | S17-01 SN1 şüphesiz gecikmiş 300, şüphesiz net 200 → 200,00 TL; SN3 vadesi gelmemiş şüpheli kalem de düşülür → 250,00 TL; SN2 (şüphesiz net −50), SN4 (bize alacaklı), SN5 (şüphesiz net tam 0) elenir · S17-02 sınırda bekleyen SN6 / SN7'ye alış faturası → 31.10'da SN6 120,00 TL, SN7 "Atlandı" (POST 0) | şüphesiz net = 0, vadesi gelmemiş şüpheli kalem, 24 sa sınır | M202, M203 (S17-01; M205 de) |
| NB5 | NB5-01 P5 vadesi geçmiş 700, net 400 → 400,00 TL ({{3}} 05.10.2026 aynen); Q5 bize alacaklı, R5 net tam 0 → elenir; S5 net = gecikmiş (10.11 / 20.11 kalemi sayılmaz) → 250,00 TL; kalemsiz C eski ad `gecikmis_borc_yok`; Q5'e Ekstre "150,00 TL (Alacaklı)" · NB5-02 sınırda bekleyen V5 alacaklıya döner → 31.10'da "Atlandı" (POST 0), W5 gönderim anındaki net 150 ile | net = 0, net = gecikmiş, gün dönümü | M204, M205, M207 (NB5-01); M206 (NB5-02) |

M199–M209 hepsi DEĞERLE (elle beklenen) yakalanıyor — istisnayla yakalanan yok (M5, M108 eskiden beri istisnayla). Kâhinin kendi testine **I10** eklendi: s16_an iki okumasında kime / kaç kez
alanları (elenen, oluşmayan, R3 uyarısı, "Bu Ay", başlatma reddi, POST, kabul, Meta'daki ileti) AYNI ve her okumada Yine de Gönder yanıtında elenen ∩ alınan = ∅; S7-d iki yoldan (duraklatma, zincirdeki
yeniden deneme) ve iki okumanın ayrıştığı sıra hata veriyor; `supheli_etiketi` yalnız S16 senaryolarında; net elemesi başlatmada (5) ve gönderim anında (2) var. **I9 (c)** tersine döndü (eski S7-c
girdisi artık S16 ile hesaplanıyor: R7 19.10.2026 / 80,00 TL, POST 2). I3 seçenekli Yine de Gönder yanıtlarını atlar (okuma başına I10'da). I2'ye S16 / S17 / NB5, I4'e başlıklar (`senaryolar.YENI_250`).

### 18.6 Eski kâhinle karşılaştırma (taban e6e5610f, değişiklikten ÖNCE alınmış kopya; `kahin.py` sha256 6e063ef9…)
Yeni 8 senaryo: **7 KIRMIZI, 1 AYNI** (`wk13-eski-kahinle-yeni-senaryolar.txt`). Nedenler: S16-01 / 02 / 04 eski kâhinin "KULLANICIYA SORULMALI S7-c … kodlanmadı" hatası (kural yoktu);
S17-01 / 02, NB5-01 / 02 değerle ve BEKLENEN nedenle — {{4}} sınırsız (SN1 300, SN3 300, SN6 250, P5 700, W5 300), SN2 / SN4 / SN5 / Q5 / R5 elenmiyor (POST 1), SN7 / V5 gönderim anında gidiyor.
AYNI: S16-03 (kayıt basmadan önce kapalı — eski kâhin de bütün gecikmişle gönderiyordu; dişi M208). Ek (ders 38): eski kâhinin YALNIZ S7-c hata satırı etkisiz kılınmış nötr kopyasında
(karar yokken düşülecek yol: S7-b sırası = S16'nın B seçeneği) S16-01 / 02 / 04 yine KIRMIZI ve her birinde beklenen neden görülüyor: U / X / ZR "Atlandı — Şüpheli Alacağı Var", POST 1 (ileti
gitmiyor) ↔ beklenen 2, onay etiketi yok (`wk13-eski-kahinle-yeni-senaryolar-notr.txt`).

### 18.7 Değişen eski beklentiler
YOK: 318 eski senaryonun girdi + elle + TAM model sonucu (başlık / kaynak / açıklama dahil) bayt bayt aynı (taban e6e5610f'nin değişiklikten önce alınmış `senaryolar.json` kopyasıyla); üst alanlardan
yalnız `kararlar`'a S16, S17, NB5 eklendi (`wk13-eski-318-tam-sonuc-fark.txt`). Kodlamadan önceki ön taramayla (`wk13-on-tarama-net-borc.txt`: Ödeme Hatırlatma içeren 22 senaryoda net sınırına
takılan iş 0) tutarlı.

### 18.8 Sürücü için (S-47 … S-54; programa karşı koşmadan önce gereken yeni eşlemeler)
- **S-47 kayıt anı:** S16'da şüpheli kaydı iş Sonucu Belirsiz İKEN açılır (`cari {vadeler}` olayı; S-42 düzeni — Ç5'in arayüzü / ucu); S16-03'te kayıt basmadan önce kapanır (kalan 0) + icra
  tahsili `hareket_ekle` aynı anda. Olay programda O ANDA yapılamadıysa senaryo GEÇERSİZ.
- **S-48 onay etiketi:** işteki Yine de Gönder'in onay penceresindeki "Şüpheli Alacağı Var" → `yeniden.<etiket>.supheli_etiketi` = [cari]; etiket yoksa anahtar YOK. Sürücü `yeniden` çıktısını
  programın yanıtından kuruyor (`yine_de_gonder` araması, 4 satır) — etiket pencerede (ön yanıtta / ekranda) olduğundan ayrıca okunmalı; okunamazsa "okunamadı" (ders 4), boş sayılmaz.
- **S-49 S16 eleme anı:** program basma anında "Gecikmiş Borç Yok" ile elerse `yeniden.<etiket>.elenen`; işi alıp gönderim anında "Atlandı" verirse okuma (b) — ikisi de `secenek`. S16-02'nin
  ertesi günkü basması `hedef: "asil"` (asıl işin düğmesi).
- **S-50 alış faturası:** `hareketler[].belge: "alis_faturasi"` → programda ALIŞ FATURASI (alacak); tahsilat / ödeme olarak GİRİLMEZ (kalemleri kapatabilir — (5) "Açık / Ödendi durumu yalnız Mahsup
  Et ile"). Sürücü bugün hareketi yalnız tutarla giriyor (`alacak` araması, 1 satır: borç ya da alacak tutarı) — belge türü eşlemesi YOK → eklenmeli; girişten sonra programın açık kalemleri
  `vadeler` ile birebir tutmalı, tutmazsa senaryo GEÇERSİZ.
- **S-51 net eleme adı:** programın nedeni "Gecikmiş Borç Yok" → `gecikmis_borc_yok`; başka ad ("Net Borcu Yok", "Alacaklı" …) → `net_borc_yok` (ikisi de `secenek`).
- **S-52 S7-d:** giren senaryo yok (kâhin hata verir); sürücü bu sırayı kurmaz.
- **S-53 Ç5 öncesi:** program S16 / S17 / (5)'i henüz uygulamıyorsa bu 8 senaryoda ayrışma BEKLENİR (S-46 düzeni) — Ç5 birleşince yeniden koşulur.
- **S-54 zaman:** başlangıç 30.10.2026 10:00 yerel; S16-02'nin ikinci basması ve S17-02 / NB5-02 gönderimleri 31.10 (gün dönümü, YEREL gün — net borç ve "vadesi geçmiş" yerel güne göre);
  `TZ=Europe/Istanbul` ve `TZ=UTC` (ders 13, 22).

### 18.9 Kanıt ve DENENMEYEN
- **Kanıt** (`docs/kanit/2026-11-06/wk13-*`, kod commit'i 9f8276bd): senaryolar **326/326** elle = model (`wk13-senaryolar`, `TZ=UTC`; `wk13-senaryolar-tz-istanbul` 326/326); kâhinin kendi testi
  **352/352**, F mutasyon **208/208** (`wk13-kahin`, `TZ=UTC`; `wk13-kahin-tz-istanbul` 352/352); eski kâhinle yeni 8 senaryo (ham + nötr kopya); 318 eski senaryonun tam sonuç farkı; ön tarama;
  araçlar `wk13-araclar/`. Sahte Meta'ya DOKUNULMADI (testleri koşulmadı).
- **DENENMEYEN:** programa karşı sürücü koşusu (görev gereği; S-47…S-54 yazılmadı); S7-d (KULLANICIYA SORULMALI); S16 iki okumanın kime / kaç kez ayrıştığı sıra (kâhin hata verir, senaryosuz);
  işteki Yine de Gönder'de şüpheli OLMAYAN carinin basma anı (5) / §7a 20 denetimi (eski düzen: yalnız gönderim anı — senaryosuz); ileri tarihli hareketin net borca etkisi; netleşmede {{3}}'ün
  "en eskiden düşülür" okuması; Başarısızları Yeniden Dene onayında etiket; S16 sonrası Sınır'da bekleyen işte kaydın kapanıp yeniden açılması (Y12-7 düzeni — senaryosuz); iki şirket; geri yükleme /
  taşıma ile S16; Meta Bekletti 2. denemesinde (5); (5) ile Excel taksit / açılış kalemleri (`vadeler` girdisinin üretimi Ç5 + muhasebe kâhini); hareketlerde alış faturası dışı alacak türleri
  (kâhin yalnız tutarı okur).

## 19. Kâhin güncellemesi 14 — S22 (S7-d) (06.11.2026)

### 19.1 Kaynak ve bağımsızlık
Kaynak YALNIZ karar metni (AYNEN `kahin.KARARLAR` S22): `docs/2.5.0-IS-LISTESI.md` D bölümü "KULLANICI KARARI 06.11 05:30 UTC (AYNEN: 'a')" satırı ve C bölümündeki iki seçenekli soru metni
(SORULDU 06.11 05:29 → YANITLANDI 05:30); önceki S7 / S7-a / S7-b / S16 / S17 / (5) kararları (`KARARLAR` S7, S7A, S7B, S16, S17, NB5, aynen) ve kâhinde zaten olan F1, E2, E3, D1, K6, J3,
J10 metinleri (aynen); WhatsApp "kime kaç kez" genel ilkesi (CLAUDE.md "2.4.8 KARARLARI"; P6 §0). Okunan başka dosya: CLAUDE.md, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu README,
`kahin/*`, `docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md`, `docs/2.5.0-IS-LISTESI.md` YALNIZ C ve D bölümleri. `surucu.mjs` ve `sahte-meta/` bu güncellemede açılmadı ve aranmadı (S22 Meta
davranışı değil; yeni olay türü yok). Program kodu (`server/`, `client/`, `bulut/`, `tools/` — `kanit.mjs` yalnız çalıştırıldı), program testleri, `docs/kanit/` (kendi kanıtı dışında), iş
listesinin A, B ve E bölümleri ve öbür ajanların raporları GÖRÜLMEDİ; git'ten yalnız tabana hızlı ileri birleştirmenin ekrana düşen dosya adı listesi ve son üç commit iletisi (biçim için)
göründü, fark / içerik açılmadı. Programa karşı KOŞULMADI. Eski kâhinle karşılaştırma git'ten değil, taban ağaçtaki (549359b0) `kahin/*` dosyalarının değişiklikten ÖNCE not defterine
alınmış kopyasıyla (`kahin.py` sha256 ab151093…). Bu bölümün 19.1–19.4'ü kodlamadan ÖNCE yazıldı ve ayrı commit'lendi (ders 40); 19.5–19.9 kodlamadan sonra.

### 19.2 Yorumlar (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y14-1 | **S22 tetiği (eski S7-d)**: Ödeme Hatırlatma işi işteki Yine de Gönder ile (ya da o belirsizlik zincirindeki Başarısızları Yeniden Dene ile — J10 c: belirsizlik onayı izi yeniden denemeye taşınır, Y9c-1/2) gönderime alınmış; BASMA ANINDA carinin şüpheli kaydı YOKTU (Y13-1 tetiği yok → iş elle işaretsiz, etiket görünmedi — Y13-5); GÖNDERİM ANINDA (Y12-4: işçinin işi Hazırlanıyor'a almadan hemen önceki eleme denetimi) kayıt AÇIK (Y11-17: kalanı > 0 `supheli` kalem; vadesine bakılmaz). Kaydın NE ZAMAN açıldığı önemli değil: iş bekledikçe herhangi bir anda (Bekliyor, Sınır, Duraklatıldı, zincirde Başarısız iken ya da yeniden deneme beklerken, Meta Bekletti) — S7-b'nin "kuyruktayken"i gibi yalnız gönderim anındaki durum okunur | S22 + Y12-4 + Y13-1 / Y13-5 + J10 c |
| Y14-2 | **Sonuç "S7-b gibi"**: iş "Atlandı", atlanma nedeni `supheli_alacak` ("Şüpheli Alacağı Var" — S7-b ile aynı ad, karar metnindeki ad); POST yok, deneme (talep) açılmaz → R3'te ve "Zaten Kuyrukta"da SAYILMAZ (Y12-5 aynen; ilke 1). Belirsizlik onayının ESKİ denemesi (Sonucu Belirsiz) olduğu gibi kalır (yeni deneme gitmedi; ilke 2) | S22 + S7B + Y12-5 + G0 (1, 2) |
| Y14-3 | **Bekleme yolları** (hepsinde aynı gönderim anı denetimi): (a) Sınır Nedeniyle Bekliyor → pencere açılınca; (b) Duraklatıldı → Devam Et'ten sonraki ilk ziyaret; (c) zincirdeki Başarısızları Yeniden Dene — kayıt yeniden deneme basılmadan ÖNCE (iş Başarısız iken) ya da SONRA (yeniden deneme beklerken) açılsa da gönderim anında Atlandı (Başarısızları Yeniden Dene toplu işlemdir, elle seçim değildir — Y12-8; S7-b de iki anı ayırmaz); (d) Meta Bekletti 2. denemesi (Y12-4: S7-b'de gönderim anı sayılır — "S7-b gibi"); (e) Lisans Nedeniyle Durdu / açılışta sorulan → Devam Et (Duraklatıldı ile aynı yol — senaryosuz) | S22 soru metni ("Sınır, Duraklatıldı → Devam Et ya da zincirdeki yeniden deneme") + Y12-4 + Y12-8 + J10 c |
| Y14-4 | **Yol (ilke 4) "kayıt açıkken yeniden Yine de Gönder basılırsa S16 ile şüphesiz tutarla gider"** = atlanan kişinin asıl işteki Sonucu Belirsiz denemesine (G0-02 yolu, `hedef: "asil"`) yeniden Yine de Gönder; basma anında kayıt açık → S16 aynen (Y13-1…4): onay penceresinde "Şüpheli Alacağı Var" (`yeniden.<etiket>.supheli_etiketi`), elle işareti, şüphesiz tutarla (S17 sınırı; {{5}} `plan_susuyor` S7S) gider; şüphesiz tutar yoksa elenir (Y13-3, `s16_an` iki okuma). Atlandı iş yeniden gönderime alınınca eski atlanma nedeni kalkar (güncelleme 13 `tasi` düzeni). Aynı gün yeni toplu işte kişi "Sonucu Belirsiz" ile elenir (D1 + E3: asıl deneme hâlâ belirsiz, aynı yerel gün) → o gün tek yol işteki Yine de Gönder (G0 2); ertesi gün yeni gönderimde elle seçim de yol (E3 + S7) | S22 + S16 + G0 (2, 4) + D1 + E3 |
| Y14-5 | **Zincir (c) yolunun yolu**: zincirde yeniden denemenin kişiyi alabilmesi için 1. iletinin sonucu (geç "teslim edilemedi" — J3) gelmiş olmalı (K6: önceki iletisi belirsiz kalan yeniden denemede elenir) → asıl işte belirsiz deneme KALMAZ, kişi kesin almadı. Kâhinin bu durumda gösterdiği yol S7-b'nin yolu (Y12-5): yeni gönderimde elle seçim — aynı gün de (Zaten Kuyrukta / Sonucu Belirsiz / R3 doğmaz). Asıl işte yeniden Yine de Gönder kâhinde de mümkün (`hedef: "asil"`; kâhin asıl işin durumunu Sonucu Belirsiz tutar) ama 1. iletinin sonucu geldikten sonra programda bu düğmenin görünüp görünmediği karar metninde yok → senaryosuz (bilgi; iki yolda da tek ileti) | K6 + J3 + J10 c + Y12-5 + G0 (4) |
| Y14-6 | **Kayıt gönderim anından ÖNCE kapanırsa** (bütün şüpheli kalemlerin kalanı 0, ör. icra tahsili): gönderim anında açık kayıt yok → S22 / S7-b yok; iş elle işaretsiz ve etiketsiz → bütün (açık) gecikmişiyle ((5) net sınırıyla) ve güncel bakiyeyle ({{5}}) gider (Y12-7 / S16-03 düzeni). Kapanıp yeniden açılırsa gönderim anındaki durum geçer (açık → Atlandı) | S22 + Y11-17 + Y12-7 |
| Y14-7 | **Elle işaretli işte S22 yok**: iş başlatmada elle seçildiyse ya da basma anında kayıt açık olduğu için S16 ile elle işaretlendiyse, sonradan açılan yeni şüpheli kalem işareti değiştirmez (Y12-7 / Y13-2) → S7 elle yolu (gönderim anındaki şüphesiz tutarla). S22 yalnız elle İŞARETSİZ belirsizlik onayı işi. Ekstre işinde S22 yok (Y12-9; kuyrukta açılan şüpheli kaydı Ekstre'yi etkilemez) | S22 + Y12-7 + Y13-2 + Y12-9 |
| Y14-8 | **Sıra** (gönderim anı): silindi / pasif / İstemiyor → numara → `supheli_alacak` (S7-b + S22) → `gecikmis_borc_yok` / net ((5), S17) — Y12-6 aynen: S22 ile atlanan kişide şüphesiz tutar da yoksa neden yine `supheli_alacak` | Y12-6 + Y13-7 |
| Y14-9 | **Gün**: gönderim anı ve yeniden basma anı programın saatinde; "vadesi geçmiş" ve net borç YEREL güne göre (§7a 20 kâhin yorumu 5, S7A-03); bekleme gece yarısını geçerse gönderim / basma anının (yeni) yerel günü geçer — UTC günü değil | §7a 20 + Y12-1 + Y13-6 |
| Y14-10 | **İlke denetimi (ders 45)**: (1) atlanan yeni deneme gitmedi → hiçbir yerde sayılmaz; (2) eski deneme belirsiz → aynı gün yeni toplu işte "Sonucu Belirsiz" ile elenir, tek yol işteki onaylı Yine de Gönder — S22 bu yolu AÇIK tutar ("yol kalır"); (3) bu duruma girmez (kesin alan yok); (4) çıkmaz yok: Y14-4 / Y14-5; şüphesiz tutar yoksa S16 "yoksa elenir" §7a 20 türünden eleme, Ekstre her zaman açık; (5) geri yükleme / taşıma ile duran bekleyen iş §7a 26 ile durur, dirilmez; dosyadan gelen işte gönderim anı aynı kural. Kimseye ikinci ileti doğurmaz. Çelişen tek yer 19.4 S7-e (KODLANMADI) | G0 (1)–(5) |

### 19.3 Önceki güncellemelerle çelişen yerler (yeni KARAR geçer)
- §18.4 "KULLANICIYA SORULMALI S7-d ★" (kâhin `ValueError`) → KAPANDI (S22 = A). Kâhinin gönderim anındaki S7-d hatası KALKAR; kâhinin kendi testi I10'un (b) duraklatma ve (c) zincirdeki
  yeniden deneme denetimleri tersine döner (aynı girdiler hesaplanır: "Atlandı — Şüpheli Alacağı Var") — yeni denetim I11.
- Y13-5 / Y13-10 "→ 18.4 S7-d (KODLANMADI)" → Y14-1 / Y14-2 ile kodlandı. §18.8 S-52 "S7-d'ye giren senaryo yok (kâhin hata verir)" → geçersiz (19.8).
- I10 (e) "`supheli_etiketi` yalnız S16 senaryolarında" → S22 senaryolarının yolu S16 ile yeniden basma olduğundan (Y14-4) S22 başlığında da görünür; denetim S16 + S22'ye genişler.
- F1 ("işteki Yine de Gönder … kişide bekleyen ileti varsa 'Zaten Kuyrukta' yine eler") ile S22'nin "kayıt açıkken yeniden Yine de Gönder basılırsa S16 ile … gider" cümlesi yalnız bir anda
  çatışır → 19.4 S7-e (kodlanmadı).

### 19.4 KULLANICIYA SORULMALI / KÂHİN SUSUYOR (ana oturuma)
**KULLANICIYA SORULMALI (kime / kaç kez — KODLANMADI; senaryo bu duruma girerse kâhin `ValueError` verir):**
- **S7-e ★** Ödeme Hatırlatma; işteki Yine de Gönder basıldı (kayıt yoktu, iş elle işaretsiz), ileti gönderim beklerken (Sınır / Duraklatıldı / Meta Bekletti / zincirdeki yeniden deneme
  beklerken) şüpheli kaydı açıldı ve kullanıcı gönderim anı GELMEDEN asıl işte Yine de Gönder'e YENİDEN bastı (kayıt açık — onay penceresinde "Şüpheli Alacağı Var" görünür, Y13-4). S22'nin
  "kayıt açıkken yeniden Yine de Gönder basılırsa S16 ile şüphesiz tutarla gider" cümlesi zaman sınırı koymuyor; F1 (kullanıcı) "kişide bekleyen ileti varsa 'Zaten Kuyrukta' yine eler" der:
  A) (ÖNERİ) bekleyen iş S16 ile elle sayılır — yeni iş açılmaz, ikinci ileti doğmaz (F1'in amacı korunur); gönderim anında şüphesiz tutarla gider (yoksa elenir);
  B) F1 aynen: "Zaten Kuyrukta" ile elenir; bekleyen ileti gönderim anında S22 ile "Atlandı — Şüpheli Alacağı Var"; ancak ondan SONRA yeniden basılınca S16 ile gider.
  Kime / kaç kez: A'da o gönderim anında ileti gider, B'de gitmez (bir basış daha gerekir) → ders 43, 45. S22 senaryoları bu sıraya girmez (yeniden basma hep Atlandı'dan sonra).

**Bilgi (kodlanmadı / senaryosuz):**
- Y14-5: zincirde 1. iletinin sonucu geldikten sonra asıl işte yeniden Yine de Gönder düğmesinin programda görünüp görünmediği (kâhin izin verir; senaryo yeni gönderimde elle seçim yolunu kullanır).
- S22 ile atlanan işin eski (belirsiz) iletisine geç teslim gelirse deneme teslim sayılır (J1 / J5, R3), iş Atlandı kalır (yeni ileti zaten gitmedi); yolun yeniden basması o gün "Daha Önce
  Gönderildi" ile elenir (ilke 3) — bugünkü düzen, senaryosuz.
- Lisans Nedeniyle Durdu / açılışta sorulan → Devam Et (Y14-3 e) ve geri yükleme / taşıma ile duran işte S22 (§7a 26) — senaryosuz.

### 19.5 Kâhinde (kodlama) — senaryolar (6) ve mutasyonlar (3)
Kod: `KARARLAR` S22 (AYNEN); `isci` (gönderim anı): eski S7-d `ValueError` KALKTI — belirsizlik onayı taşıyan, elle işaretsiz işte açık kayıt S7-b ile aynı yoldan `supheli_alacak` ile
"Atlandı" (Y14-2; sıra Y12-6 aynen); `yine_de_gonder`: S7-e `ValueError` (kayıt açık + kişinin belirsizlik onaylı, elle işaretsiz işi hâlâ bekliyor — `KUYRUKTA`); `tasi` yalnız yorum.
Yeni olay / girdi / çıktı alanı YOK (mevcut `yine_de_gonder {hedef: "asil"}`, `cari {vadeler}`, `atlanma_nedeni`, `yeniden.<etiket>.supheli_etiketi`). Mutasyonlar (`kahin.MUTASYONLAR`):
M210 S22'nin B seçeneği (gönderim anında elle sayılır, şüphesiz tutarla gider), M211 yanlış etiket (J10'un `daha_once_gonderildi`'si), M212 yeniden basmada S16'nın elle sayması yok.

| Senaryo | Ne | Sınır | Mutasyon (yakalayan; değerle) |
|---|---|---|---|
| S22-01 | günlük sınır 1: SU ve SV'ye işteki Yine de Gönder (kayıt yok) sınırda bekler; 2. saatte ikisinin kaydı açılır → ertesi gün pencere açılınca Atlandı (`supheli_alacak`, POST 1); SU'ya asıl işte yeniden Yine de Gönder: etiket, elle → 15.10.2026 / 300,00 TL (şüphesiz net 800 − 500), POST 2; SV atlanmış kalır | 24 sa sınır, gün dönümü 30.10 → 31.10 | M210, M211, M212 (+ M192, M196, M199, M201) |
| S22-02 | Yine de Gönder + hemen duraklatma; kayıtlar açılır → Devam Et: DR ve DS Atlandı; DR yeniden basma → 18.10.2026 / 300,00 TL; DS aynı gün yeni gönderimde ELLE seçilse de "Sonucu Belirsiz" (T2 oluşmaz — ilke 2: o gün tek yol işteki Yine de Gönder) | aynı yerel gün (D1 + E3) | M210, M211, M212, M196 |
| S22-03 | zincir: Yine de Gönder 131021 ile Başarısız; ZM'nin kaydı Başarısız iken, 1. iletilerin geç failed'ı, Başarısızları Yeniden Dene + duraklatma, ZN'nin kaydı yeniden deneme beklerken açılır → Devam Et: ikisi Atlandı (POST 2); ZN aynı gün yeni gönderimde elle → 17.10.2026 / 400,00 TL (Y14-5 yolu) | kaydın iki anı (Y14-3 c), J3, K6 | M210, M211, M196 |
| S22-04 | iki iş duraklatılmışken kayıt açılır; KQ'nunki Devam Et'ten ÖNCE kapanır (kalan 0 + icra tahsili) → KQ etiketsiz, bütün gecikmiş + güncel bakiye (15.10.2026 / 250,00 TL / 250,00 TL); KA Atlandı | kalan 0 | M194 (KQ), M210, M211 (KA) |
| S22-05 | 31.10 23:30 yerel; 01.11 00:10 (UTC'de 31.10) Devam Et → Atlandı; 00:20 yeniden basma: YEREL güne göre 31.10 kalemi gecikmiş → 31.10.2026 / 300,00 TL; "Bu Ay" Ekim 1 + Kasım 1 (Türkiye saati) | ay sonu + gece yarısı yerel ≠ UTC | M198, M210, M212 (+ M196, M199, M201) |
| S22-06 | Yine de Gönder'in iletisi Meta Bekletti (131049); kayıt açılır → 24 sa sonraki 2. deneme Atlandı (2. deneme gitmez); ertesi gün yeniden basma → 16.10.2026 / 250,00 TL, POST 3 (Meta Bekletti iletisi K7 gereği sayılmaz) | 24 sa (Meta Bekletti) | M195, M210, M212 (+ M196, M199, M201) |

M210–M212 hepsi DEĞERLE (elle beklenen) yakalanıyor; M210 altı senaryonun altısında, M211 dördünde (S22-05 / 06'da yeniden basma eski atlama nedenini kaldırdığı için son ad görünmez), M212 dördünde
(`wk14-mutant-matrisi`). İstisnayla yakalanan yine yalnız M5, M108 (eskiden beri). Kâhinin kendi testine **I11** eklendi: I10'un eski (b) duraklatma ve (c) zincir girdileri artık "Atlandı — Şüpheli
Alacağı Var" (POST 1 / 2); aynı (b) girdisi M210 ile 14.10.2026 / 300,00 TL gidiyor (A ↔ B bu girdide ayrışıyor); S7-e girdisi (duraklatılmışken kayıt açıkken asıl işte yeniden basma)
`KULLANICIYA SORULMALI S7-e` veriyor; her S22 senaryosunda en az bir denetimde Atlandı. I10'dan (b) / (c) kalktı (I11'e tersine taşındı); I10 (e) `supheli_etiketi` S16 + S22 başlıklarında.
I2'ye S22, I4'e başlık (`senaryolar.YENI_250`), F ipuçlarına M210–M212.

### 19.6 Eski kâhinle karşılaştırma (taban 549359b0, değişiklikten ÖNCE alınmış kopya; `kahin.py` sha256 ab151093…)
Yeni 6 senaryo: **6 KIRMIZI, 0 AYNI**; hepsinde neden BEKLENEN: eski kâhinin "KULLANICIYA SORULMALI S7-d (README §18.4) … kodlanmadı" hatası (kural yoktu) — `wk14-eski-kahinle-yeni-senaryolar`.
Ek (ders 38, bilgi): eski kâhinin YALNIZ S7-d hata satırı etkisiz kılınmış nötr kopyasında 6 senaryonun 6'sı AYNI (`wk14-eski-kahinle-yeni-senaryolar-notr`): karar yokken düşülecek yol S7-b sırasıdır
ve bu S22'nin A seçeneğiyle aynıdır (kod değişikliği o satırın kalkmasıdır) → nötr kopya A'ya karşı kanıt DEĞİL; A ↔ B dişi M210 (6/6, değerle) ve I11 (b). S22-04'ün KQ kısmı tek başına eski kâhinde
de aynı sonucu verir (kayıt gönderim anında kapalı — S7-d'ye hiç girmez; dişi M194); senaryonun kırmızısını KA verir.

### 19.7 Değişen eski beklentiler
YOK: 326 eski senaryonun girdi + elle + TAM model sonucu (başlık / kaynak / açıklama dahil) bayt bayt aynı, sıra korunuyor (taban 549359b0'ın değişiklikten önce alınmış `senaryolar.json`
kopyasıyla); üst alanlardan yalnız `kararlar`'a S22 eklendi (`wk14-eski-326-tam-sonuc-fark`). Eski senaryoların hiçbiri S7-d durumuna girmiyordu (girseydi eski kâhin hata verirdi).

### 19.8 Sürücü için (S-55 … S-58; programa karşı koşmadan önce gereken eşlemeler)
- **S-55 kayıt anı:** S22'de şüpheli kaydı işteki Yine de Gönder'den SONRA, iş beklerken açılır (`cari {vadeler}` olayı; S-42 / S-47 düzeni — Ç5'in arayüzü / ucu); S22-03'te biri iş Başarısız iken,
  biri yeniden deneme beklerken; S22-04'te biri Devam Et'ten önce kapanır (kalan 0) + icra tahsili `hareket_ekle` aynı anda. Olay programda O ANDA yapılamadıysa senaryo GEÇERSİZ.
- **S-56 okunacaklar:** gönderim anında iş "Atlandı" + neden "Şüpheli Alacağı Var" → `atlanma_nedeni` `supheli_alacak`; atlanan işin POST'u (yeni istek yok); yeniden basmada onay penceresindeki
  etiket → `yeniden.<etiket>.supheli_etiketi` (S-48 aynen; okunamazsa "okunamadı", boş sayılmaz). §18.8 S-52 ("S7-d'ye giren senaryo yok") GEÇERSİZ.
- **S-57 yeniden basma:** `yine_de_gonder {hedef: "asil"}` (S-12) — atlanan kişinin ASIL işteki Sonucu Belirsiz denemesine basılır; Meta Bekletti / Sınır / zincir sırası S-27 düzeninde (Yine de Gönder
  ile hemen duraklatma ya da günlük üst sınır). S7-e sırası (iş beklerken yeniden basma) kurulmaz (kâhin hata verir).
- **S-58 zaman:** S22-05 başlangıcı 31.10.2026 23:30 yerel — program ve sahte Meta aynı sahte saatte; "bugün" programın YEREL günü; iki koşu `TZ=Europe/Istanbul` ve `TZ=UTC`. Program S22'yi
  henüz uygulamıyorsa (Ç5 sonra) bu 6 senaryoda ayrışma BEKLENİR (S-46 / S-53 düzeni) — Ç5 birleşince yeniden koşulur.

### 19.9 Kanıt ve DENENMEYEN
- **Kanıt** (`docs/kanit/2026-11-06/wk14-*`, OKU: `wk14-OKU.txt`): senaryolar **332/332** elle = model (`wk14-senaryolar`, `TZ=UTC`; `wk14-senaryolar-tz-istanbul` 332/332, `senaryolar.json` iki
  koşuda aynı sha256); kâhinin kendi testi **359/359**, F mutasyon **211/211** (`wk14-kahin`, `TZ=UTC`; `wk14-kahin-tz-istanbul` 359/359); eski kâhinle yeni 6 senaryo (ham + nötr kopya);
  326 eski senaryonun tam sonuç farkı; mutant matrisi; araçlar `wk14-araclar/`. Sahte Meta'ya ve sürücüye DOKUNULMADI (açılmadı, testleri koşulmadı).
- **DENENMEYEN:** programa karşı sürücü koşusu (görev gereği; S-55…S-58 yazılmadı); S7-e (KULLANICIYA SORULMALI — kâhin hata verir); zincirde 1. iletinin sonucundan sonra asıl işte yeniden
  Yine de Gönder (Y14-5, bilgi); Lisans Nedeniyle Durdu / açılışta sorulan → Devam Et yolu (Y14-3 e; Duraklatıldı ile aynı yol); kayıt kapanıp gönderim anından önce yeniden açılması (Y14-6 —
  gönderim anındaki durum); S22 ile atlanan işin eski iletisine geç teslim (19.4 bilgi); geri yükleme / taşıma ile S22; iki şirket; yeniden basmada şüphesiz tutar olmaması (S16 "yoksa elenir" —
  S16-02 düzeni, `s16_an`; S22 senaryolarında hep tutar var); Ekstre işinde Yine de Gönder'den sonra açılan kayıt (Y14-7 — Y12-9 aynen, senaryosuz).

## 20. Kâhin güncellemesi 15 — S23 (S7-e) + S-W3 (W-3 saklama süresi ve KVKK silme) (06.11.2026)

### 20.1 Kaynak ve bağımsızlık
Kaynak YALNIZ karar metinleri (AYNEN `kahin.KARARLAR` S23, SW3): `docs/2.5.0-IS-LISTESI.md` D bölümü "KULLANICI KARARI 06.11 06:03 UTC (AYNEN: 'a')" satırı ve C bölümündeki iki seçenekli soru metni
(SORULDU 06.11 06:01 → YANITLANDI 06:03); D bölümü "KULLANICI KARARLARI (05.11 ~16:48, WhatsApp, aynen)" satırının S-W3 kısmı; `docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md` §0, §1 W-3 satırı, §3 madde 6–7,
§4 S-W3, §4a S-W3 sorusu (A / B seçenekleri); önceki S7 / S7-a / S7-b / S16 / S17 / (5) / S22 ve kâhinde zaten olan F1, E2, E3, D1, D6, D7, D8, H1, J1, J3, J5, J10, J12, K6, R3 metinleri (aynen);
WhatsApp "kime kaç kez" genel ilkesi (CLAUDE.md "2.4.8 KARARLARI"; P6 §0). Okunan başka dosya: CLAUDE.md, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu README (tamamı), `kahin/*`,
`docs/2.5.0-IS-LISTESI.md` YALNIZ C ve D bölümleri. `surucu.mjs` ve `sahte-meta/` bu güncellemede açılmadı ve aranmadı (yeni olay `kvkk_sil` ve yeni denetim alanı sürücü notunda, 20.9).
Program kodu (`server/`, `client/`, `bulut/`, `tools/` — `kanit.mjs` yalnız çalıştırıldı), program testleri, `docs/kanit/` (kendi kanıtı dışında), iş listesinin A, B ve E bölümleri ve öbür ajanların
raporları GÖRÜLMEDİ; git'ten yalnız tabana hızlı ileri birleştirmenin ekrana düşen dosya adı / satır sayısı listesi (içerik değil) ve son commit iletileri (biçim için) göründü. Programa karşı KOŞULMADI.
Eski kâhinle karşılaştırma git'ten değil, taban ağaçtaki (b91d82b9) `kahin/*` dosyalarının değişiklikten ÖNCE not defterine alınmış kopyasıyla (`kahin.py` sha256 35efc96f…). Bu bölümün
20.1–20.5'i kodlamadan ÖNCE yazıldı ve ayrı commit'lendi (ders 40); 20.6–20.10 kodlamadan sonra.

### 20.2 Yorumlar — S23 (eski S7-e) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y15-1 | **S23 tetiği**: Ödeme Hatırlatma işi işteki Yine de Gönder ile (ya da o belirsizlik zincirindeki Başarısızları Yeniden Dene ile — J10 c, belirsizlik onayı izi) gönderime alınmış; o basmada şüpheli kaydı YOKTU (iş elle işaretsiz, etiket görünmedi — Y13-5); iş GÖNDERİM ANINDAN ÖNCE beklerken (Bekliyor, Sınır Nedeniyle Bekliyor, Duraklatıldı, Lisans Nedeniyle Durdu / açılışta sorulan, Meta Bekletti, zincirdeki yeniden deneme beklerken) carinin şüpheli kaydı açıldı (Y11-17: kalanı > 0 `supheli` kalem) ve kullanıcı ASIL işte (`hedef: "asil"`) kayıt AÇIKKEN Yine de Gönder'e yeniden bastı. Hazırlanıyor / Gönderiliyor (gönderim anı geçti, Y12-4) S23 dışındadır: F1 aynen "Zaten Kuyrukta" (kâhinde bu aralık sıfıra yakın — senaryosuz). Yeniden basma anında kayıt kapalıysa (bütün şüpheli kalemlerin kalanı 0) tetik yok: F1 aynen "Zaten Kuyrukta", iş elle işaretsiz kalır | S23 + Y12-4 + Y13-1 / Y13-5 + Y14-1 + F1 |
| Y15-2 | **"bekleyen iş S16 ile elle sayılır"** = bekleyen işe elle işareti yazılır (Y13-2 / Y12-3'teki işaret) ve işte kalır (Y12-7 / Y12-8: Devam Et, zincirdeki yeniden deneme, kayıt kapanıp açılsa da); onay penceresinde "Şüpheli Alacağı Var" görünür (S16 + Y13-4: `yeniden.<etiket>.supheli_etiketi` = [cari]). Yanıtta yeni çıktı alanı `yeniden.<etiket>.elle_sayilan` = [cari] (S23 tetiğinde anahtar VAR — eski çıktılarda yok); kişi `alinan`'a girmez (yeni iş / yeni deneme yok), `elenen`'e girmez ("Zaten Kuyrukta" uygulanmaz) | S23 + S16 + Y13-2 / Y13-4 |
| Y15-3 | **"yeni iş açılmaz"** = yeni deneme (talep) açılmaz, POST yok, işin durumu ve bekleme anı DEĞİŞMEZ: Sınır'daki iş pencere açılınca, Duraklatıldı Devam Et'le, Meta Bekletti 24 saat sonraki 2. denemede, zincirdeki yeniden deneme kendi sırasında gider — gönderim anı bekleyen işin kendi anıdır. Kişiye ikinci ileti doğmaz (F1'in amacı korunur) | S23 ("yeni iş açılmaz") + soru metni A + G0 (3) |
| Y15-4 | **"F1 'Zaten Kuyrukta' bu duruma uygulanmaz"** YALNIZ S23 tetiğinde (kayıt açık + elle işaretsiz + belirsizlik onaylı bekleyen iş). İş zaten elle işaretliyse (başlatmada elle seçildi, ilk basmada kayıt açıktı — S16, ya da S23 ile işaretlendi) yeniden basma F1 aynen: "Zaten Kuyrukta" (etiket görünür; işaret ve bekleme değişmez — iş zaten şüphesiz tutarla gidecek, kime / kaç kez aynı). Kayıt kapalıyken de F1 aynen | S23 + F1 + Y13-2 |
| Y15-5 | **"gönderim anında şüphesiz tutarla gider"** = gönderim anında S7 elle yolu: {{3}} / {{4}} şüphesiz vadesi geçmiş kalemlerden, S17 sınırıyla (şüphesiz net borç); {{5}} `plan_susuyor` S7S (kayıt açıkken); gönderim anında şüphesiz tutar yoksa S7-a / (5) / S17 gereği "Atlandı" (Y12-2; ad `gecikmis_borc_yok` ya da net elemesinde `secenek` — Y13-7). Kayıt gönderim anından önce kapanırsa iş elle kalır (Y12-7) ve bütün gecikmişle gider | S23 + S7 + S7A + S17 + Y12-2 / Y12-7 |
| Y15-6 | **Yeniden basma anında şüphesiz tutar YOKSA**: S16'nın "(yoksa elenir)" anı karar metninde yok (README §18.4 `s16_an`); S23 "gönderim anında" der ama "S16 ile" de der → iki okuma birlikte koşulur: (a) `basma` — yanıtta elenir (`elenen` = gecikmis_borc_yok / net), iş işaretsiz kalır → gönderim anında (kayıt hâlâ açıksa) S22 "Atlandı — Şüpheli Alacağı Var"; (b) `gonderim` — iş elle sayılır, gönderim anında S7-a "Atlandı — Gecikmiş Borç Yok". İkisinde de ileti gitmez → ayrışan yapraklar (yanıt, atlanma nedeni) `secenek`. Basmadan sonra gönderim anına kadar şüphesiz tutar DOĞARSA (kayıt açıkken) okumalar ayrışır (a: Atlandı, b: gider) → 20.5 **S23-a ★** (KODLANMADI; kâhin hata verir) | S23 + S16 + §18.4 |
| Y15-7 | J10 (S9-1) aynen: S23 ile elle sayılan bekleyen işin ESKİ (belirsiz) iletisine imzalı teslim gelirse yeni ileti gitmez ("Atlandı — Daha Önce Gönderildi", J10 a) — belirsizlik onayı izi işte kalır | J10 + S23 |
| Y15-8 | **Zincir yolu**: zincirdeki yeniden deneme beklerken (1. iletinin geç "teslim edilemedi"si gelmiştir — K6, J3) asıl işte Yine de Gönder düğmesinin programda görünüp görünmediği karar metninde yok (Y14-5 bilgisi aynen); S23 sorusunun metni bu yolu açıkça saydı ("zincirdeki yeniden deneme beklerken … asıl işte Yine de Gönder'e YENİDEN bastı") → kâhin hesaplar (asıl iş Sonucu Belirsiz tutulur). Program düğmeyi o anda göstermiyorsa o adım GEÇERSİZ (sürücü 20.9) | S23 soru metni + Y14-5 + J10 c |
| Y15-9 | **İlke denetimi (ders 45)**: (1) yeni deneme açılmaz, almamış kişi sayılmaz; (2) eski deneme belirsiz — tek yol işteki onaylı Yine de Gönder AÇIK ve S23 o yolu kullanır; (3) bu duruma girmez (kesin alan yok); (4) çıkmaz yok — şüphesiz tutar yoksa §7a 20 türünden eleme, Ekstre her zaman açık; (5) geri yükleme / taşıma ile duran bekleyen iş §7a 26 ile durur. İkinci ileti doğmaz. Çelişen tek yer 20.5 S23-a | G0 (1)–(5) |

### 20.3 Yorumlar — S-W3 (W-3 saklama süresi + KVKK silme) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y15-10 | **Silinen alanlar**: gönderim kaydının İÇERİĞİ (ileti değişkenleri; ekstre PDF'i ve kâhinin PDF özeti; PDF dosya adı — ad / bakiye / hareket taşırlar; Ekstre'nin açılışta hazırlanan içeriği — J12) ve TELEFON. Kâhin çıktısında silinmiş işin `telefon`, `degiskenler`, `pdf`, `dosya_adi` → null ve yeni alan `icerik_silindi: true` (YALNIZ silinmiş işte — eski çıktılar değişmez); `kontrol {icerik: true}` denetimi anlık içerik görünümünü verir (yeni, isteğe bağlı) | SW3 + P6 §1 W-3 ("wa_jobs, wa_job_pdfs, makine defteri") + J12 |
| Y15-11 | **Kalan anonim iz**: tarih (gönderim denemesinin anı — programın saati; R3 uyarısındaki "son tarih", Son 3 Ay / Tüm'ün 7 günü ve hatırlatmanın "aynı gün"ü buradan), dönem (eşlik anahtarı ve tarihleri), cari kimliği, şablon adı; kâhin yorumu: + denemenin SONUCU (kabul / teslim / başarısız / süresi doldu / belirsiz) ve iş durumu / sayaçlar (POST, kabul, Meta'daki ileti, "Bu Ay") — kişisel veri değildir ve P6'nın "'gönderildi' izi" bunlardan oluşur. İz yalnız GÜNÜ tutuyorsa 7 günlük pencere gün hassasiyetine düşer — senaryolar 7 gün sınırına yaklaşmaz (bilgi) | SW3 + P6 §1 W-3 |
| Y15-12 | **Kime / kaç kez**: anonim iz R3 / D1 / D6 / H1 / D7 / D8'de silinmemiş kayıtla AYNI çalışır → silinen kişi aynı dönemde "Daha Önce Gönderildi" (uyarı, varsayılan Bunları Çıkar) — P6 §4a A "aynı kişiye aynı dönemde ikinci ileti gitmez" (B'nin "yeniden gidebilir"inin karşıtı); R3 "Yine de Gönder" silinmiş kayıtta da açık — **İLKEYLE G0 (4)** (çıkmaz yok; iz silinmemiş kayıttan DAHA katı değil); sonraki dönem uyarısız gider. Kapanmış işteki Sonucu Belirsiz deneme izi (aşılmış belirsiz) aynen eler — **İLKEYLE G0 (2)** (iz sonucu taşımasaydı almış olabilecek kişiye ikinci ileti uyarısız giderdi) | SW3 + P6 §1 W-3 + §4a A + R3 + G0 (2, 3, 4) |
| Y15-13 | **"1 yıl" başlangıcı**: işin SON gönderim denemesinin anı (Gönderiliyor — içeriğin ve telefonun son kullanıldığı an); denemesi yoksa toplu işin açılış anı. Süre TAKVİM yılıyla: programın YEREL saat diliminde aynı tarih ve saat bir sonraki yıl (29 Şubat → 28 Şubat), an hassasiyetinde (gün yuvarlaması yok) — sınırdan ÖNCE içerik durur, sınırda ve SONRA silinir. Öbür başlangıç okumaları (toplu işin açılışı, kesinleşme / teslim anı) kâhin senaryolarında aynı sonucu verir (aralarında < 1 saat, denetimler sınırdan ±1–2 saat) — bilgi; senaryoların yılında 29 Şubat yok → 365 gün ↔ takvim yılı aynı | SW3 ("1 yıl sonra") |
| Y15-14 | **Silinme anı**: süre dolduğu an (program açıkken); program kapalıysa açılışta. Program silmeyi periyodik bir temizlik turunda yapıyorsa sürücü o turu sahte saatle denetimden önce tetikler; sınırdan sonra ±1 gün içinde başka anda siliniyorsa OKUMA FARKI (içerik alanı; kime / kaç kez değil) | SW3 |
| Y15-15 | **Silme talebi (KVKK)**: yeni olay `kvkk_sil {id}` — o anda o carinin (o şirkette) şirket dosyasındaki bütün işlerinin içeriği, telefonu ve PDF'i silinir; makine defterindeki denemeler kâhinde zaten içeriksizdir (yalnız iz). Talep CARİ başına (K2: aynı telefonlu başka cari etkilenmez — bilgi). Carinin kendisi (kart, telefon, hareketler, vadeler) DEĞİŞMEZ; talepte kartın telefonu da silindiyse ayrı `cari {telefon: null}` olayı | SW3 + P6 §3 madde 6 |
| Y15-16 | **Silmeden sonra yeni gönderim**: telefon GÖNDERİM ANINDA karttan okunur (§7a 1, 6) — silinen telefon hiçbir yolla (eski iş, makine defteri, önbellek) yeniden kullanılmaz; kart telefonu boşsa kişi "Telefonsuz" elenir (R3 denetiminden önce — başlatma sırası). İçerik yeni işte yeniden hazırlanır (yeni iş = yeni kayıt; J12 aynı iş içindir) | SW3 + §7a 1, 6 + J12 |
| Y15-17 | **"Bu Ay"** (J5): silinen işin teslimi sayılmaya devam eder (iz sonucu taşır; J1 "her durumda") — silme ne "Bu Ay"ı ne R3'ü azaltır | J5 + J1 + Y15-11 |
| Y15-18 | **Geri yükleme (ilke 5)**: yedekten dönen işe aynı süre kuralı — dönen işin başlangıcı 1 yıldan eskiyse içeriği DÖNDÜĞÜ ANDA silinir (dosyadan gelen içerik "1 yıl sonra" koşulunu taşır). R3 dosyadaki ya da defterdeki izle aynen (D7). Silme TALEBİNDEN ÖNCE alınmış yedek geri yüklenince talebin yeniden uygulanıp uygulanmadığı karar metninde yok → 20.5 **S-W3-c** (KVKK; kime / kaç kez DEĞİL): kâhin o işlerin içerik alanlarını denetlemez (`plan_susuyor`), R3 kesin | SW3 + G0 (5) + D7 |
| Y15-19 | **Taşıma** (defter boş): dosyadaki iz R3'te (D8) aynen; silinmiş içerik taşınan dosyada da yoktur — senaryosuz | SW3 + D8 + G0 (5) |
| Y15-20 | **Süre dolan / silinen iş bekliyorsa ya da Sonucu Belirsiz ise** (Bekliyor, Sınır, Duraklatıldı, Meta Bekletti, Lisans, açılışta sorulan, Hazırlanıyor / Gönderiliyor, Sonucu Belirsiz): karar metninde yok → 20.5 **S-W3-a ★** (KODLANMADI; kâhin hata verir). Kesin ya da kapanmış işte (Teslim / Okundu / Başarısız / Süresi Doldu / İptal / Atlandı / Durduruldu / Taşınan) ve teslimi beklenen işte (Meta Kabul Etti / Gönderildi — kancasız yol, §7a 16) silme kime / kaç kez'i değiştirmez: iz "gönderildi" olarak sayılır, geç teslim / failed ize yazılır (J1 / J3) | SW3 + G0 + §7a 16 + J1 / J3 |
| Y15-21 | **Silinmiş işin yeniden gönderimi** (Başarısızları Yeniden Dene / asıl işte Yine de Gönder): Ödeme Hatırlatma'da içerik ve telefon zaten gönderim anında okunur (Y9d-2) → yeniden gönderilir (yeni içerik işe yazılır, `icerik_silindi` kalkar); Ekstre'de içerik açılışta hazırlanmıştı (J12) ve silindi → 20.5 **S-W3-b ★** (KODLANMADI; kâhin hata verir) | SW3 + J12 + Y9d-2 |
| Y15-22 | Sınır penceresi (24 saatte farklı alıcı, telefonla — §6 W2): silme pencere sayacını azaltmaz (sayaç makine düzeyinde, 24 saatlik) — bilgi, senaryosuz | SW3 + §6 W2 + SW2 |
| Y15-23 | **İlke denetimi (ders 45)**: (1) silme ileti doğurmaz, kesin almamış kişi sayılmaz; (2) belirsiz iz eler (İLKEYLE); (3) aldıysa aynı dönemde elenir — iz bunun için kalır; (4) elenen kişinin yolu R3 "Yine de Gönder" (İLKEYLE) ve sonraki dönem; (5) geri yüklenen / taşınan veride aynı kural (Y15-18 / Y15-19). Çelişen yerler 20.5 | G0 (1)–(5) |

### 20.4 Önceki güncellemelerle çelişen yerler (yeni KARAR geçer)
- §19.4 "KULLANICIYA SORULMALI S7-e ★" (kâhin `ValueError`) → KAPANDI (S23 = A). Kâhinin `yine_de_gonder`'deki S7-e hatası KALKAR; kâhinin kendi testi I11 (d) tersine döner (aynı girdi hesaplanır:
  bekleyen iş elle sayılır, Devam Et'te şüphesiz tutarla gider) — yeni denetim I12. §19.8 S-57 "S7-e sırası kurulmaz (kâhin hata verir)" → geçersiz.
- F1 ("kişide bekleyen ileti varsa 'Zaten Kuyrukta' yine eler") → S23 tetiğinde uygulanmaz (Y15-4); öbür her durumda aynen.
- §2 / §7.1 "makine defteri ∪ şirket dosyası" kayıtları süresiz sayılıyordu → içerik + telefon + PDF 1 yıl sonra ya da talepte silinir; iz (Y15-11) R3'te aynen (kime / kaç kez değişmez).
- I10 (e) "`supheli_etiketi` yalnız S16 / S22" → S23 senaryolarında da (onay penceresi, Y15-2).

### 20.5 KULLANICIYA SORULMALI / KÂHİN SUSUYOR (ana oturuma)
**KULLANICIYA SORULMALI (kime / kaç kez — KODLANMADI; senaryo bu duruma girerse kâhin `ValueError` verir):**
- **S23-a ★** (S23 × S16 anı): yeniden basmada şüphesiz tutar yoktu (ör. şüphesiz kalemin vadesi bugün), gönderim anına kadar doğdu (ertesi gün gecikmiş) ve kayıt hâlâ açık —
  A) (ÖNERİ) iş S23 ile elle sayıldı → gönderim anında şüphesiz tutarla gider (S23 "gönderim anında şüphesiz tutarla"); B) basmada "Gecikmiş Borç Yok" ile reddedilmiş sayılır, iş işaretsiz
  kalır → gönderim anında S22 "Atlandı — Şüpheli Alacağı Var" (bir basış daha gerekir). Kime / kaç kez: A'da ileti gider, B'de gitmez.
- **S-W3-a ★** (silme / süre dolumu × bekleyen ya da belirsiz iş): silme talebi geldiğinde (ya da 1 yıl dolduğunda) kişinin bekleyen (Bekliyor / Sınır / Duraklatıldı / Meta Bekletti / Lisans /
  açılışta sorulan) ya da Sonucu Belirsiz işi varsa — A) (ÖNERİ) bekleyen iş gönderilmez ("Atlandı — Silme Talebi"; ilke 1: almadı, sayılmaz; yol: yeni gönderim), Sonucu Belirsiz denemenin
  izi kalır ve aynı dönemde eler (ilke 2; yol işteki Yine de Gönder — Ödeme Hatırlatma'da içerik gönderim anında, Ekstre'de S-W3-b'ye bağlı); B) bekleyen iş gönderim anında kart bilgisiyle
  gider (silme yalnız geçmiş kayıtları kapsar). Kime / kaç kez: A'da o ileti gitmez, B'de gider.
- **S-W3-b ★** (içeriği silinmiş Ekstre işinin yeniden gönderimi — Başarısızları Yeniden Dene / asıl işte Yine de Gönder): A) (ÖNERİ) bu yolla yeniden gönderilemez (düğme pasif + neden); yol yeni
  gönderim (Başarısız deneme R3'te sayılmaz → uyarısız gider); B) içerik açılış günü verisiyle yeniden üretilir ve iş gider. Kime / kaç kez: o yolla A'da gitmez, B'de gider.

**KULLANICIYA SORULMALI (KVKK uyumu — kime / kaç kez DEĞİL; kâhin içerik alanlarını `plan_susuyor` bırakır, R3 kesin):**
- **S-W3-c**: silme talebinden ÖNCE alınmış yedek geri yüklenince silinen içerik / telefon / PDF — A) (ÖNERİ) program talebi (anonim: cari kimliği + tarih) makine düzeyinde tutar ve geri yüklenen
  dosyada yeniden uygular; B) yedekteki hâli gelir (yedeklerin ayrıca silinmesi gerekir).

**KÂHİN SUSUYOR — `secenek` yaprağı:** Y15-6 (S23'te yeniden basmada şüphesiz tutar yokken yanıtın ve atlanma nedeninin iki okuması — ileti iki okumada da gitmez).

**Bilgi (senaryosuz):** Y15-1 Hazırlanıyor / Gönderiliyor anında yeniden basma (F1); Y15-8 zincirde düğmenin görünmesi; Y15-11 izin gün / an hassasiyeti; Y15-13 başlangıç okumaları ve 29 Şubat;
Y15-14 silme anı; Y15-15 K2 (aynı telefonlu öbür cari); Y15-19 taşıma; Y15-22 sınır penceresi. **İLKEYLE** (ana oturum iş listesine yazsın): Y15-12'nin iki maddesi (R3 Yine de Gönder
silinmiş kayıtta açık — G0 4; belirsiz iz eler — G0 2).

### 20.6 Kâhinde (kodlama) — senaryolar (10) ve mutasyonlar (10)
Kod: `KARARLAR` S23, SW3 (AYNEN). **S23:** `yine_de_gonder`'deki S7-e `ValueError` KALKTI → `s23` tetiği (iş `S23_BEKLEYEN` = Bekliyor / Sınır / Duraklatıldı / Lisans / açılışta sorulan /
Meta Bekletti; belirsizlik onayı; elle işaretsiz; kayıt açık; asıl işte) → `s23_yeniden_bas()`: elle işareti, yanıtta `elle_sayilan`, etiket; işin durumu, bekleme anı ve denemesi DEĞİŞMEZ;
basmada şüphesiz tutar yoksa `s23_an` iki okuma (`S23_OKUMALARI` = `gonderim` (model), `basma`), `isci`'de `s23_bos` — okumalar kime / kaç kez ayrışırsa (gönderim anında tutar doğdu, kayıt
açık) S23-a `ValueError`. Hazırlanıyor / Gönderiliyor ve elle işaretli iş eski yoldan (F1 "Zaten Kuyrukta"). **S-W3:** `yil_sonra()` (takvim yılı, yerel an, 29 Şubat → 28 Şubat),
`saklama_baslangici()` (son deneme; yoksa toplu işin açılışı), `saklama_bitisi()`, `saklama_zamani()` / `saklama_isle()` (benzetim çizelgesinde, program açıkken; ufku 1 yıldan kısa senaryoda
hiç bakılmaz — `saklama_alt`), `icerik_sil()` (bekleyen / Sonucu Belirsiz işte S-W3-a `ValueError`), `kvkk_sil` olayı, `kart_telefonu()` (başlatma + gönderim anı), `icerik_gorunum()` (sonuç +
`kontrol {icerik}`; talepten önceki yedekten dönen içerik `plan_susuyor` — S-W3-c), `tasi`: silinmiş Ekstre'de S-W3-b `ValueError`; Ödeme Hatırlatma yeniden gönderilince yeni içerik yazılır,
`icerik_silindi` kalkar (`icerik_t`). Yeni çıktı alanları YALNIZ yeni durumlarda: `yeniden.<etiket>.elle_sayilan` (S23 tetiği), `isler.<iş>.icerik_silindi` (silinmiş iş),
`kontroller.<ad>.icerik` (istenirse). Yeni olay: `kvkk_sil {id}`.

| Karar | Senaryo | Ne | Sınır | Mutasyon (yakalayan; değerle) |
|---|---|---|---|---|
| S23 | S23-01 | günlük sınır 1: SR / SV Yine de Gönder (kayıt yok) → sınırda; kayıtlar açılır; SR'ye kayıt açıkken yeniden basma → elle sayılır, iş SINIRDA kalır (POST 3 aynen); ikinci basma (artık elle) F1 "Zaten Kuyrukta"; ertesi gün SR 15.10.2026 / 300,00 TL (800 − 500) gider, SV S22 "Atlandı" | 24 sa sınır, ikinci basma | M213, M214 |
| S23 | S23-02 | Yine de Gönder + duraklatma; DK (kayıt açık) yeniden basma → elle, Devam Et'te 18.10.2026 / 300,00 TL; DT (kayıt YOK) yeniden basma → F1 "Zaten Kuyrukta", bütün gecikmişle 12.10.2026 / 400,00 TL / 400,00 TL; DL S22 "Atlandı" | kayıt var / yok | M213, M214 |
| S23 | S23-03 | zincir: Yine de Gönder 131021 → 1. iletinin geç failed'ı → Başarısızları Yeniden Dene + duraklatma → kayıt açılır → asıl işte yeniden basma → elle, Devam Et'te 17.10.2026 / 400,00 TL, POST 3 | Y15-8 | M213, M214 |
| S23 | S23-04 | Yine de Gönder iletisi Meta Bekletti; kayıt açılır; 2. denemeden ÖNCE yeniden basma → elle; 24 sa sonraki 2. deneme 16.10.2026 / 250,00 TL ile gider, POST 3 | 24 sa (Meta Bekletti) | M213, M214 |
| S23 | S23-05 | yeniden basmada şüphesiz tutar yok (öbür kalemin vadesi BUGÜN): `s23_an` iki okuma — yanıt (`elle_sayilan` / `elenen`) ve atlanma nedeni (`gecikmis_borc_yok` / `supheli_alacak`) `secenek`; aynı gün Devam Et: iki okumada da Atlandı, ileti gitmez | vade = bugün | M213, M214 |
| SW3 | SW3-01 | 02.11.2026 Geçen Ay → A, B; +364 g 22 sa içerik durur, +365 g 2 sa silinmiş (durum Teslim Edildi kalır); aynı dönem (özel Ekim 2026) "Daha Önce Gönderildi" (son 02.11.2026), toplu iş oluşmaz; R3 Yine de Gönder ile A'ya gider; Ekim 2027 B'ye gider | 1 yıl ±2 sa | M215, M216, M217, M220 |
| SW3 | SW3-02 | 01.11.2026 00:30 yerel (UTC 31.10); 31.10.2027 23:30 yerel durur, 01.11.2027 01:30 yerel silinmiş (UTC'de iki denetim de 31.10); aynı dönem "Daha Önce Gönderildi" (son 01.11.2026); "Bu Ay" Kasım 2026 + Kasım 2027 | gece yarısı yerel ≠ UTC, 1 yıl ±1 sa | M215, M216, M217, M220 |
| SW3 | SW3-03 | A ve C silme talebi (C'nin kart telefonu da silinir): içerik hemen silinir, B'ninki durur; aynı dönem: A, B "Daha Önce Gönderildi", C "Telefonsuz"; R3 Yine de Gönder ile A'ya yeni içerikle; Kasım'da A, B gider, C "Telefonsuz"; "Bu Ay" 4 + 2 | talep anı, sonraki dönem | M215, M218, M219, M221 |
| SW3 | SW3-04 | 1 yıl dolunca silinir; 1 yıl önce alınmış yedek geri yüklenir → dönen içerik DÖNDÜĞÜ ANDA silinir (ilke 5); aynı dönem "Daha Önce Gönderildi" | geri yükleme, 1 yıl | M215, M216, M222 |
| SW3 | SW3-05 | talep → talepten ÖNCEKİ yedek geri yüklenir: A'nın içerik alanları `plan_susuyor` (S-W3-c); aynı dönem A, B "Daha Önce Gönderildi" (kesin); R3 Yine de Gönder ile A'ya; "Bu Ay" 3 | geri yükleme + talep | M215, M219, M221 |

Mutasyonlar (`kahin.MUTASYONLAR`): M213 S23'ün B seçeneği (F1 "Zaten Kuyrukta", gönderim anında S22), M214 "yeni iş açılmaz"ın tersi (yeni iş + bekleyen iş, ikinci ileti), M215 S-W3'ün B seçeneği
(anonim iz de silinir), M216 / M217 saklama sınırı ±1 gün, M218 silinen telefon yeniden kullanılır (kart boşsa), M219 silme talebi içeriği silmez, M220 1 yıl UTC gününe göre, M221 silme talebi
"Bu Ay"ı düşürür, M222 geri yüklenen işe saklama kuralı uygulanmaz. Hepsi DEĞERLE (elle beklenen) yakalanıyor; matris (`wk15-mutant-matrisi`): M213 5, M214 5, M215 5, M216 3, M217 2, M218 1,
M219 2, M220 2, M221 2, M222 1 senaryoda. İstisnayla yakalanan yine yalnız M5, M108 (eskiden beri). Kâhinin kendi testine **I12** eklendi: I11'in eski (d) S7-e girdisi artık hesaplanıyor
(elle, 14.10.2026 / 300,00 TL, POST 2) ve M213 ile aynı girdide "Atlandı" (A ↔ B ayrışır); `s23_an` iki okumasında kime / kaç kez alanları AYNI, okuma başına `elle_sayilan` ∩ (elenen ∪ alınan)
= ∅; S23-a (tutar ertesi gün doğar) hata veriyor; `yil_sonra` birim denetimi; S-W3-a (bekleyen işte talep, belirsiz işte talep, 1 yıl dolarken bekleyen iş) ve S-W3-b (silinmiş Ekstre'nin yeniden
denemesi) hata veriyor; silinmiş Ödeme Hatırlatma'nın yeniden denemesi karttan hesaplanıyor (yeni içerik, `icerik_silindi` yok); yeni alanlar yalnız S23 / SW3'te. I11 (d) kalktı (I12'ye tersine
taşındı), I11 (e)'ye "S22'de S23 tetiği yok"; I10 (e) etiket S16 + S22 + S23; I2'ye S23, SW3; I4'e başlıklar (`senaryolar.YENI_250`); C'nin telefon denetimi `plan_susuyor` yaprağını atlar;
F ipuçlarına M213–M222.

### 20.7 Eski kâhinle karşılaştırma (taban b91d82b9, değişiklikten ÖNCE alınmış kopya; `kahin.py` sha256 35efc96f…)
Yeni 10 senaryo: **10 KIRMIZI, 0 AYNI** (`wk15-eski-kahinle-yeni-senaryolar`). S23-01…05: eski kâhinin "KULLANICIYA SORULMALI S7-e (README §19.4) … kodlanmadı" hatası (beklenen neden — kural
yoktu; görev metnindeki "S7-d kodlanmadı" bu tabanda S7-e'dir: S7-d güncelleme 14'te kapandı). SW3-01 / 02 / 04: değerle (içerik silinmiyor: `isler.T1/A.telefon` dolu, `icerik_silindi`
yok, `kontrol {icerik}` gözlemi yok). SW3-03 / 05: "bilinmeyen olay: kvkk_sil" (zayıf neden, ders 38). Ek (ders 38): eski kâhinin nötr kopyasında (YALNIZ S7-e koşulu etkisiz, `kvkk_sil` tanınır
ama etkisiz, `kontrol {icerik}` gözlemi — kural eklenmedi; `wk15-araclar/notr_kopya.py`) **10/10 değerle KIRMIZI** ve nedenler beklenen (`wk15-eski-kahinle-yeni-senaryolar-notr`): S23'lerde
karar yokken düşülecek yol F1'dir — yeniden basma "Zaten Kuyrukta", iş gönderim anında S22 ile "Atlandı — Şüpheli Alacağı Var", POST bir eksik (= S23'ün B seçeneği, M213); SW3'lerde içerik
silinmiyor. Nötr kopyada SW3'lerin R3 / "Bu Ay" / elenen yaprakları AYNI: anonim iz eski davranışın (kayıtlar hiç silinmiyordu) kime / kaç kez yüzünü korur — dişi M215 ve M221.

### 20.8 Değişen eski beklentiler
YOK: 332 eski senaryonun girdi + elle + TAM model sonucu (başlık / kaynak / açıklama dahil) bayt bayt aynı, sıra korunuyor (taban b91d82b9'ın değişiklikten önce alınmış `senaryolar.json`
kopyasıyla); üst alanlardan yalnız `kararlar`'a S23, SW3 eklendi (`wk15-eski-332-tam-sonuc-fark`). Eski senaryoların hiçbiri S7-e durumuna (girseydi eski kâhin hata verirdi) ve 1 yıl sınırına
(en uzun ufuk +31 gün) girmiyor, `kvkk_sil` kullanmıyor.

### 20.9 Sürücü için (S-59 … S-66; programa karşı koşmadan önce gereken eşlemeler)
- **S-59 S23 yeniden basma:** `yine_de_gonder {hedef: "asil"}` iş gönderim anından ÖNCE beklerken (Sınır, Duraklatıldı, Meta Bekletti, zincirdeki yeniden deneme) ve kayıt açıkken; §19.8 S-57'nin
  "S7-e sırası kurulmaz" notu GEÇERSİZ. Okunacaklar: yanıtta kişinin elle seçim olarak işaretlendiği → `elle_sayilan` (program bunu ayrı göstermiyorsa "okunamadı" — boş sayılmaz, ders 4);
  onay penceresindeki etiket → `supheli_etiketi` (S-48); işin durumu DEĞİŞMEMELİ, yeni iş / deneme açılmamalı (programın Gönderimler / iş listesinde yeni satır çıkarsa M214 düzeni — ayrışma).
  S23-03'te zincirdeki yeniden deneme beklerken asıl işte Yine de Gönder düğmesi programda yoksa o adım GEÇERSİZ (Y15-8).
- **S-60 S23-05:** `secenek` yaprakları `kahin.py karsilastir`'da (sürücü değişikliği gerekmez).
- **S-61 `kvkk_sil {id}`:** programın KVKK silme yolu (W-3 kodu; arayüzü / ucu kâhinde bilinmiyor) o carinin gönderim kayıtları için O ANDA tetiklenmeli; oluşmadıysa senaryo GEÇERSİZ. Kart
  telefonunun silinmesi ayrı `cari {telefon: null}` olayıdır (SW3-03 C).
- **S-62 `kontrol {icerik: true}`:** o anda programın iş ayrıntısından telefon, değişkenler, PDF (programın sakladığı PDF — sahte Meta'daki kopya değil; özetini sürücü PDF metninden üretir) ve
  dosya adı okunur; silinmişse alanlar `null` + `icerik_silindi: true` (programın "silindi" gösterimi kâhinde yok — alanların boş olması esas; anonim iz alanları — durum, sayaçlar — dolu kalmalı).
- **S-63 zaman:** SW3-01 / 02 / 04 sahte saatle ~365 gün ileri sarılır (program ve sahte Meta aynı saatte); program saklama temizliğini periyodik yapıyorsa sürücü denetimden önce o turu tetikler
  (Y15-14); SW3-02 gece yarısı (yerel ≠ UTC) — iki koşu `TZ=Europe/Istanbul` ve `TZ=UTC` (ders 13, 22).
- **S-64 geri yükleme:** SW3-04 (1 yıl sonra, 1 yıl önce alınmış yedek — dönen içerik o anda silinmeli), SW3-05 (talepten önceki yedek; `T1/A` içerik alanları `plan_susuyor`, denetlenmez — R3 kesin).
- **S-65 Meta medya ömrü:** 1 yıllık senaryolarda sahte Meta medyayı 30 günde siler (§1); kâhinin `medya_silme`'si (Meta'da silinen) teslim anında kesinleşmeyle sayılır (Y10-7 aynen).
- **S-66 Ç5 / W-3 öncesi:** program S23'ü (Ç5) ya da S-W3'ü (W-3) henüz uygulamıyorsa bu 10 senaryoda ayrışma BEKLENİR (S-46 / S-53 / S-58 düzeni) — kod birleşince yeniden koşulur.

### 20.10 Kanıt ve DENENMEYEN
- **Kanıt** (`docs/kanit/2026-11-06/wk15-*`, OKU: `wk15-OKU.txt`): senaryolar **342/342** elle = model (`wk15-senaryolar`, `TZ=UTC`; `wk15-senaryolar-tz-istanbul` 342/342, `senaryolar.json` iki
  koşuda aynı sha256); kâhinin kendi testi **370/370**, F mutasyon **221/221** (`wk15-kahin`, `TZ=UTC`; `wk15-kahin-tz-istanbul` 370/370); eski kâhinle yeni 10 senaryo (ham + nötr kopya);
  332 eski senaryonun tam sonuç farkı; mutant matrisi; araçlar `wk15-araclar/`. Sahte Meta'ya ve sürücüye DOKUNULMADI (açılmadı, testleri koşulmadı).
- **DENENMEYEN:** programa karşı sürücü koşusu (görev gereği; S-59…S-66 yazılmadı); S23-a, S-W3-a, S-W3-b (KULLANICIYA SORULMALI — kâhin hata verir, yalnız I12'de); S-W3-c (`plan_susuyor`);
  29 Şubat'ı geçen saklama süresi; başlangıç okumalarının (son deneme / açılış / teslim) ayrıştığı uzun bekleme; taşıma + silme (Y15-19); K2 — aynı telefonlu öbür cari (Y15-15); sınır penceresi +
  silme (Y15-22); Lisans Nedeniyle Durdu / açılışta sorulan → Devam Et yolunda S23 (Duraklatıldı ile aynı yol); Hazırlanıyor / Gönderiliyor anında yeniden basma (Y15-1); S23 ile elle sayılan işin
  eski iletisine geç teslim (Y15-7, J10 aynen); silinmiş Ödeme Hatırlatma'nın yeniden gönderimi (yalnız I12, senaryosuz); silmeden sonra aşılmış Sonucu Belirsiz izinin elemesi (Y15-12 İLKEYLE —
  senaryosuz); iki şirket.

## 21. Kâhin güncellemesi 16 — S29 (S23-a), S30 (S-W3-a), S31 (S-W3-b), S32 (S-W3-c) (06.11.2026)

### 21.1 Kaynak ve bağımsızlık
Kaynak YALNIZ karar metinleri (AYNEN `kahin.KARARLAR` S29, S30, S31, S32 olacak): `docs/2.5.0-IS-LISTESI.md` D bölümü "KULLANICI KARARI 06.11 06:52 UTC (AYNEN: 'a'; sorular C
bölümünde S29–S32, öneriyle soruldu; hepsi A)" satırı ve C bölümündeki iki seçenekli soru metni (SORULDU 06.11 06:50 → YANITLANDI 06:52) + aynı yerdeki "İLKEYLE (WK 15 …)" notu; önceki
S7 / S7-a / S7-b / S16 / S17 / (5) / S22 / S23 / S-W3 kararları ve kâhinde zaten olan D1, D6, E2, E3, F1, J1, J2, J3, J5, J10, J12, K3, K6, K7, R3 metinleri (aynen); WhatsApp "kime kaç kez"
genel ilkesi (CLAUDE.md "2.4.8 KARARLARI"; P6 §0). Okunan başka dosya: CLAUDE.md, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu README (1–152 ve 983–1571. satırlar: dosya düzeni, model özeti,
§16–§20), `kahin/*`, `docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md`, `docs/2.5.0-IS-LISTESI.md` YALNIZ C ve D bölümleri. `surucu.mjs` ve `sahte-meta/` açılmadı ve aranmadı (S29–S32 Meta
davranışı değil). Program kodu (`server/`, `client/`, `bulut/`, `tools/` — `kanit.mjs` yalnız çalıştırıldı), program testleri, `docs/kanit/` (kendi kanıtı dışında; `docs/kanit/2026-11-06/`
için yalnız `wk1*` dosya ADLARI listelendi, içerik açılmadı), iş listesinin A, B ve E bölümleri ve öbür ajanların raporları GÖRÜLMEDİ; git'ten yalnız tabana (ee344d86) hızlı ileri birleştirmenin
ekrana düşen dosya adı listesi (içerik değil) ve son üç commit iletisi (biçim için) göründü. Programa karşı KOŞULMADI. Eski kâhinle karşılaştırma git'ten değil, taban ağaçtaki (ee344d86)
`kahin/*` dosyalarının değişiklikten ÖNCE not defterine alınmış kopyasıyla (`kahin.py` sha256 429333a4…). Bu bölümün 21.1–21.7'si kodlamadan ÖNCE yazıldı ve ayrı commit'lendi (ders 40);
21.8–21.12 kodlamadan sonra.

### 21.2 Yorumlar — S29 (S23-a) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y16-1 | **S29 tetiği**: S23 tetiği aynen (Y15-1: belirsizlik onayıyla gönderim anından ÖNCE bekleyen, elle işaretsiz Ödeme Hatırlatma işi; kayıt AÇIKKEN asıl işte yeniden Yine de Gönder) ve O BASMADA şüphesiz tutar YOK (`hatirlatma_engeli`: şüphesiz vadesi geçmiş kalem kümesi boş ya da S17 / (5) ile sınırlanmış tutar ≤ 0) | S29 + S23 + Y15-1 / Y15-6 |
| Y16-2 | **Sonuç**: bekleyen iş S23 ile ELLE SAYILIR (S29 sorusunun A metni "iş S23 ile elle sayıldı → gönderim anında şüphesiz tutarla gider"; B "basmada reddedilmiş sayılır, iş işaretsiz → S22 Atlandı"): yanıtta `elle_sayilan` = [cari], `elenen` boş, onay penceresinde "Şüpheli Alacağı Var" (Y15-2); yeni iş / deneme yok, işin durumu ve bekleme anı değişmez (Y15-3). Gönderim anında S7 elle yolu: gönderim anında şüphesiz tutar VARSA {{3}} / {{4}} gönderim anındaki şüphesiz kalemlerden, S17 sınırıyla ({{5}} kayıt açıkken `plan_susuyor` S7S); YOKSA "Atlandı — Gecikmiş Borç Yok" (S7-a / Y12-2; net elemesinde Y13-7 `secenek`) | S29 + S23 + S16 + S7A + S17 |
| Y16-3 | **`s23_an` iki okuması KALKAR**: README §20 Y15-6'nın 'basma' okuması (yanıtta elenir, iş işaretsiz, gönderim anında S22) S29'un B seçeneğidir → tek okuma (eski 'gonderim'). Gönderim anına kadar tutar doğmasa da (S23-05) iş elle sayılmıştır: yanıt `elle_sayilan` [cari], atlanma nedeni `gecikmis_borc_yok` (seçeneksiz). Kâhinin S23-a `ValueError`'ı kalkar | S29 + Y15-6 |
| Y16-4 | **Gönderim anı ve gün**: işin kendi gönderim anı (Y15-3: Sınır → pencere açılınca, Duraklatıldı → Devam Et, Meta Bekletti → 24 sa sonraki 2. deneme, zincirdeki yeniden deneme). "Doğma" yolu karar metninde "yeni vadesi geçen kalem" (soru metni): bir kalemin vadesi gönderim anının YEREL gününde geçmiş olur (Y14-9, S7A-03), ya da kuyruktayken eski vadeli yeni şüphesiz kalem eklenir; hangi yolla doğduğu önemsizdir — gönderim anındaki durum okunur | S29 soru metni + Y14-9 + Y12-2 |
| Y16-5 | Kayıt gönderim anından ÖNCE kapanırsa iş elle kalır (Y12-7): bütün (açık) gecikmişiyle ((5) sınırı), {{5}} güncel bakiye; tutar yoksa "Gecikmiş Borç Yok" | Y12-7 + Y15-5 |
| Y16-6 | **Kapsam sınırı**: S29 yalnız YENİDEN basmayı (S23) söyler. İLK basmada (S16: iş Sonucu Belirsiz, basma anında kayıt açık, şüphesiz tutar yok) elemenin anı (`s16_an`, README §18.4) S29 metninde YOK → 21.7 **S29-a ★** (KODLANMADI; kâhinin §18.4 hatası sürer) | S29 + S16 + §18.4 |
| Y16-7 | **İlke denetimi (ders 45)**: (1) yeni deneme açılmaz; (2) eski belirsiz deneme durur, tek yol işteki onaylı Yine de Gönder (S29 o yolu kullanır); (3) girmez; (4) tutar yoksa §7a 20 türünden eleme, borç doğunca hatırlatma, Ekstre her zaman açık; (5) §7a 26 ile duran iş durur. İkinci ileti doğmaz | G0 (1)–(5) |

### 21.3 Yorumlar — S30 (S-W3-a) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y16-8 | **Tetik**: silme talebi (`kvkk_sil`, Y15-15) ya da 1 yıl dolumu (Y15-13 sınırı) ANINDA kişinin (aynı şirket) işinin o anki durumu. Talep kişinin bütün işlerine (her toplu iş, iki şablon) aynı anda | S30 + Y15-13 / Y15-15 |
| Y16-9 | **"Bekleyen" iş** = isteği Meta'ya henüz GİTMEMİŞ, gönderim sırası bekleyen iş: Bekliyor, Sınır Nedeniyle Bekliyor, Duraklatıldı (kullanıcı, hesap / şablon hatası, bağlantı süresi, 190 / 0 — hangi nedenle olursa), Lisans Nedeniyle Durdu, açılışta sorulan (24 saatten eski), Meta Bekletti (1. ileti Meta'da, 2. deneme bekliyor), Hazırlanıyor (istekten önce). **Zincir** = işteki Yine de Gönder ya da Başarısızları Yeniden Dene ile yeniden gönderime alınmış ve bu durumlardan birinde bekleyen iş — aynı küme. KAPSAM DIŞI: Gönderiliyor (istek gitti, yanıt bekleniyor — "almış olabilir"; kâhinde yalnız gecikmeli yanıt J6 / J7 ve çökmede) → KÂHİN SUSUYOR, modellenmedi (`ValueError`, senaryosuz); Meta Kabul Etti / Gönderildi ve kapanmış işler Y15-20 aynen (iz "gönderildi" ya da sonucunu taşır) | S30 + Y15-20 + §6 W2 |
| Y16-10 | **"bekleyen iş gönderilmez (telefon / içerik silindi)"**: içerik + telefon (+ Ekstre'nin açılışta hazırlanan içeriği, J12) O ANDA silinir ve iş GÖNDERİLMEZ: kâhinin modeli (okuma `aninda`) iş o anda "Atlandı" olur, atlanma nedeni kâhin adı `silme_talebi` (talep) / `saklama_suresi` (1 yıl) — karar metninde ad yok; programın gösterdiği teslimsiz kapanmış durumu (Atlandı / İptal / Durduruldu …) sürücü eşler. Kart telefonu silinmediğinden iş kuyrukta kalsaydı gönderim anında karttan giderdi — bu S30'un B seçeneğidir. Atlandı iş "Zaten Kuyrukta"da SAYILMAZ, yeni deneme açılmadığı için R3'te sayılmaz (ilke 1). Yol (ilke 4): yeni gönderim (telefon karttan, içerik yeni işte — Y15-16) | S30 + Y15-16 + G0 (1, 4) |
| Y16-11 | **İkinci okuma (`gonderimde`)**: iş içeriksiz / telefonsuz kuyrukta KALIR ve kendi gönderim anında (Y12-4: işçinin işi ele aldığı eleme denetimi) atlanır. İki okumada da ileti gitmez; ekrandaki ara durum (Atlandı ↔ bekleme durumu) ve Meta Bekletti'nin 1. iletisi teslim edilirse işin son durumu (Atlandı ↔ Teslim Edildi, J2) ayrışır → `secenek` (kime / kaç kez değil). Kime / kaç kez YALNIZ bir sırada ayrışır: talepten sonra, bekleyen iş henüz gönderim anına gelmeden aynı kişiye aynı dönem yeni gönderim ya da yeniden deneme (`aninda`: kuyrukta değil → gider; `gonderimde`: "Zaten Kuyrukta" → elenir, bekleyen iş de atlanır) → 21.7 **S30-a ★** (KODLANMADI; o sırada kâhin hata verir) | S30 + E2 + Y12-4 |
| Y16-12 | **Meta Bekletti**: 2. deneme gitmez; 1. iletinin geç teslimi J1 / J5 gereği denemeye yazılır (R3 "Daha Önce Gönderildi" + "Bu Ay"), iş Atlandı kalır (`aninda`; `gonderimde`de J2 ile kapanır — `secenek`). Teslim gelmezse 1. ileti K7 gereği SAYILMAZ (Meta Bekletti, teslim yok) | S30 + J1 + J2 + J5 + K7 |
| Y16-13 | **Sonucu Belirsiz iş**: içerik + telefon silinir, iş Sonucu Belirsiz KALIR — iz (denemenin sonucu BELİRSİZ) aynı dönemde eler: yeni toplu işte "Sonucu Belirsiz" (D1; Ödeme Hatırlatma'da aynı yerel gün — E3), yeniden denemede K6; Yine de Gönder ile aşılmış eski belirsiz deneme de (D6). Sonraki dönem (Ödeme Hatırlatma'da ertesi gün) uyarısız gider. İmzalı geç kabul / teslim gelirse H1 / J1 aynen (deneme kabul / teslim; iş Teslim olur, içerik silinmiş kalır; pencere sayacı alıcıyı silinmiş telefon yerine işin kimliğiyle sayar — Y15-22 "silme pencereyi azaltmaz"). Yol: işteki Yine de Gönder → Ekstre'de S31 ile kapalı (21.4), Ödeme Hatırlatma'da 21.7 S31-a | S30 + D1 + D6 + E3 + K6 + H1 + J1 |
| Y16-14 | **1 yıl dolumu + bekleyen iş**: süre başlangıcı Y15-13 aynen (son deneme; denemesi yoksa toplu işin açılışı). Kural İÇERİĞİ HENÜZ YAZILMAMIŞ bekleyen işe de uygulanır (Ödeme Hatırlatma içeriği gönderim anında hazırlanır — Y9d-2): 1 yıl dolunca iş gönderilmez (`saklama_suresi`). Eski düzende içeriksiz bekleyen işe saklama kuralı hiç bakılmıyordu | S30 + Y15-13 + Y9d-2 |
| Y16-15 | **İlke denetimi (ders 45)**: (1) bekleyen iş gitmez ve sayılmaz; (2) belirsiz iz aynı dönemde eler (S30 açık metni); (3) kabul / teslim edilmiş deneme izi aynen (Y15-12); (4) bekleyen işin yolu yeni gönderim; belirsiz Ekstre'de aynı dönem yolu kalmaz → 21.7 S30-b ★; (5) geri yükleme 21.5 | G0 (1)–(5) |

### 21.4 Yorumlar — S31 (S-W3-b) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y16-16 | **Tetik**: içeriği silinmiş (talep, 1 yıl ya da S32 ile geri yüklemede yeniden uygulanmış) EKSTRE işinin AYNI İŞ üzerinden yeniden gönderimi: Başarısızları Yeniden Dene (asıl iş ya da zincir, `hedef: "asil"` dahil) ve işteki Yine de Gönder (Sonucu Belirsiz — S30 ile artık mümkün). Devam Et kapsam dışı (S30 ile bekleyen iş zaten gönderilmez). Yeni toplu iş (R3 "Yine de Gönder" dahil) AYNI İŞ değildir — kapsam dışı (İLKEYLE WK 15: içeriği silinmiş kayıtta R3 Yine de Gönder açık) | S31 + S30 + C "İLKEYLE" notu |
| Y16-17 | **Sonuç "yeniden gönderilemez (neden görünür)"**: kişi o yeniden gönderime ALINMAZ; yanıtta `elenen` {cari: `icerik_silindi`} (kâhin adı; karar metninde ad yok — "neden görünür"); işin durumu değişmez (Başarısız / Sonucu Belirsiz kalır), POST yok, yeni deneme yok. Düğmenin pasif + neden yazısı aynı anlamdadır (sürücü eşler). Tek neden: içerik silinmiş denetimi E2 sırasından ÖNCE (iş kendisi gönderilemez; kime / kaç kez sıradan bağımsız — ileti gitmez) | S31 + E2 |
| Y16-18 | **Yol "yeni Ekstre gönderimi"**: yeni toplu iş = yeni kayıt; içerik yeni açılışta hazırlanır (J12), telefon karttan (Y15-16). Başarısız deneme R3'te sayılmaz → aynı dönem uyarısız gider (K3). Sonucu Belirsiz işte aynı dönem yeni gönderim S30 / D1 ile elenir → aynı dönemde yol kalmaz (21.7 S30-b ★); kâhin iki açık kararı aynen hesaplar, yol EKLEMEZ | S31 + K3 + S30 + D1 |
| Y16-19 | **Ödeme Hatırlatma**: karar metni YALNIZ Ekstre der. Ödeme Hatırlatma'da içerik zaten gönderim anında hazırlanır (Y9d-2) — S31'in gerekçesi (açılışta hazırlanmış içerik yeniden üretilemez) orada yok, ama "silinmiş kayıt yeniden gönderilmez" kuralı genel de okunabilir → iki okuma, kime / kaç kez ayrışır → 21.7 **S31-a ★** (KODLANMADI; kâhin hata verir). WK 15'in Y15-21 Ödeme Hatırlatma kısmı (karttan yeniden gönderilir) bir kâhin yorumuydu, karar değil — GERİ ÇEKİLDİ (I13'te tersine döner) | S31 + Y15-21 + Y9d-2 |

### 21.5 Yorumlar — S32 (S-W3-c) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y16-20 | **Silme talebi kaydı** (makine düzeyi, KVKK): YALNIZ şirket kodu + cari kimliği + talep anı — ad, telefon, içerik, PDF, dönem TUTMAZ (kâhinde `kvkk[(şirket, cari)] = an`; aynı kişinin sonraki talebi öncekini kapsar). Şirket dosyasına ve yedeğe GİRMEZ, geri yüklemede KALIR (makine defteri gibi, D7) | S32 ("makinede kayıtlı kalır") + SW3 (cari kimliği anonim izde) |
| Y16-21 | **Yeniden uygulama**: geri yükleme (dosya yedekteki hâline döner, §7a 26 ile bekleyen işler durur) BİTİNCE, AYNI ANDA: geri yüklenen dosyada o carinin (aynı şirket) içeriği talep anından ÖNCE yazılmış işlerinin içeriği + telefonu silinir (`icerik_silindi`). İçeriğin yazıldığı an: gönderim anı (`icerik_t`); Ekstre'nin açılışta hazırlanan içeriği için toplu işin açılış anı. Kontrol geri yüklemeyle aynı anda bile silinmiş gösterir ("GELMEZ") | S32 + Y15-18 |
| Y16-22 | **Talepten SONRA yazılmış içerik KALIR** (talep yalnız o ana kadarki kayıtları kapsar; yeni talep gerekir) → talepten sonra alınmış yedek geri yüklenince talepten sonraki gönderimin içeriği durur, talepten önceki (yedekte zaten silinmiş) içerik silinmiş kalır | S32 + Y15-15 |
| Y16-23 | Geri yüklenen dosyada BEKLEYEN iş: §7a 26 ile önce "Durduruldu (Geri Yükleme)" olur, sonra içeriği silinir; S30'un "Atlandı"sı yerine Durduruldu kalır (kâhin yorumu; iki durum da kuyrukta değil, sayılmaz, gitmez — kime / kaç kez aynı; senaryosuz, bilgi). Sonucu Belirsiz iş: içerik silinir, iz kalır (S30). 1 yıl kuralı aynen (Y15-18) | S32 + S30 + §7a 26 |
| Y16-24 | S31 ile: geri yüklemede içeriği yeniden silinen Ekstre işi yeniden gönderilemez (Y16-17). R3 / "Bu Ay" / Sonucu Belirsiz izi değişmez (Y15-12 / Y15-17) | S32 + S31 + SW3 |
| Y16-25 | **Taşıma**: talep kaydı "makinede"; başka bilgisayara taşınan veride (ve orada geri yüklenen eski yedekte) talebin yeniden uygulanıp uygulanmadığı karar metninde yok (ilke 5 "aynı bilgisayardaki kurallar" der) → 21.7 **S32-a** (KVKK — kime / kaç kez DEĞİL): kâhin yeni bilgisayarda geri dönen talep öncesi içeriği `plan_susuyor` bırakır (senaryosuz). Taşınan ANDAKİ dosyada talep zaten uygulanmıştır (kesin) | S32 + G0 (5) + Y15-19 |
| Y16-26 | **İlke denetimi (ders 45)**: (5) geri yüklenen veride aynı kurallar — S32'nin kendisi; silme kime / kaç kez'i değiştirmez (iz aynen) | G0 (5) |

### 21.6 Önceki güncellemelerle çelişen yerler (yeni KARAR geçer)
- §20.5 "KULLANICIYA SORULMALI S23-a ★" → KAPANDI (S29 = A); `s23_an` okuması ve S23-a `ValueError` kalkar. S23-05'in seçenekli yaprakları (yanıt, atlanma nedeni) kesinleşir (G3: tam sonucu değişir).
- §20.5 "S-W3-a ★" → KAPANDI (S30 = A); `icerik_sil`'in bekleyen / Sonucu Belirsiz işteki `ValueError`'ı kalkar (yerine Y16-10…14; Gönderiliyor KÂHİN SUSUYOR).
- §20.5 "S-W3-b ★" → KAPANDI (S31 = A, Ekstre); `tasi`'deki `ValueError` kalkar (yerine `elenen` `icerik_silindi`). Y15-21'in Ödeme Hatırlatma kısmı geri çekildi (21.7 S31-a).
- §20.5 "S-W3-c" (`plan_susuyor`) → KAPANDI (S32 = A): talepten önceki yedekten dönen içerik silinmiş (SW3-05'in `kontroller.K2.icerik.T1/A` yaprakları kesinleşir — G3).
- Y15-6 'basma' okuması → S29'un B seçeneği (mutant). I12 (b) / (c) / (e) / (f) tersine döner → I13.

### 21.7 KULLANICIYA SORULMALI / KÂHİN SUSUYOR (ana oturuma)
**KULLANICIYA SORULMALI (kime / kaç kez — KODLANMADI; senaryo bu duruma girerse kâhin `ValueError` verir):**
- **S29-a ★** (S29'un kapsamı — İLK basma): Ödeme Hatırlatma işi Sonucu Belirsiz, şüpheli kaydı açık; işteki Yine de Gönder İLK kez basıldığında şüphesiz tutar YOK, gönderim anına kadar doğuyor
  (S16 "yoksa elenir"in anı) — A) (ÖNERİ, S29 ile aynı düzen) iş alınır (elle), gönderim anındaki şüphesiz tutarla gider (tutar yoksa gönderim anında "Atlandı — Gecikmiş Borç Yok"); B) basmada
  "Gecikmiş Borç Yok" ile elenir, iş Sonucu Belirsiz kalır (borç doğunca yeniden basılır). Kime / kaç kez: A'da o gönderimde ileti gider, B'de bir basış daha gerekir.
- **S30-a ★** (bekleyen işin kapanma anı): silme talebi / 1 yıl dolumu anında bekleyen iş — A) (ÖNERİ, kâhinin modeli) o anda "Atlandı — Silme Talebi" (kuyruktan çıkar; talepten sonra aynı dönem
  yeni gönderim karttaki telefonla gider); B) içeriksiz kuyrukta kalır, kendi gönderim anında atlanır (o zamana kadar aynı dönem yeni gönderim "Zaten Kuyrukta" ile elenir — bir gönderim daha gerekir).
- **S30-b ★** (S30 × S31 × ilke 4): Sonucu Belirsiz EKSTRE işinin içeriği silindi (talep / 1 yıl) → aynı dönem için yeni gönderim "Sonucu Belirsiz" ile elenir (S30), işteki Yine de Gönder
  kapalı (S31) → o dönem için gönderme yolu kalmaz (ilke 4 "çıkmaz yok" ile çatışır); sonraki dönem gider — A) (ÖNERİ) böyle kalır (S30 + S31 harfiyen; KVKK talebinde bulunan kişiye o dönemin
  ekstresi yeniden gitmez, 1 yıl sonra aynı dönem ekstresi pratikte istenmez); B) yeni Ekstre gönderiminde bu kişi "Sonucu Belirsiz" yerine R3 uyarısıyla gelir, onaylı "Yine de Gönder" ile gider
  (yol açık; iki kez gidebilir). Kâhin A'yı (iki açık kararı) hesaplar, yol eklemez — B seçilirse yeni senaryo / bakım gerekir.
- **S31-a ★** (Ödeme Hatırlatma): içeriği silinmiş Ödeme Hatırlatma işinin aynı iş üzerinden yeniden gönderimi (Başarısızları Yeniden Dene / işteki Yine de Gönder / asıl işte yeniden basma) —
  A) Ekstre gibi gönderilemez (neden görünür), yol yeni gönderim (Başarısız'da aynı gün; Sonucu Belirsiz'de ertesi gün — E3); B) (ÖNERİ) içerik zaten gönderim anında karttan hazırlanır →
  yeniden hazırlanıp gider (S31'in gerekçesi Ödeme Hatırlatma'da yok; Sonucu Belirsiz'de aynı gün çıkmaz doğmaz). Kime / kaç kez: o yolla A'da gitmez, B'de gider.

**KULLANICIYA SORULMALI (KVKK — kime / kaç kez DEĞİL; kâhin içerik alanlarını `plan_susuyor` bırakır):**
- **S32-a** (taşıma): talep kaydı makinede — başka bilgisayara taşınan veride ve orada geri yüklenen eski yedekte talep yeniden uygulansın mı — A) (ÖNERİ, ilke 5) talep kayıtları (yalnız şirket
  + cari kimliği + an) taşıma paketine girer, yeni bilgisayarda da uygulanır; B) yalnız taşındığı andaki dosya (talep uygulanmış hâli) gider, yeni bilgisayarda eski yedek geri yüklenirse içerik geri gelir.

**KÂHİN SUSUYOR — `secenek` yaprağı (kime / kaç kez DEĞİŞMEZ):** Y16-11 (`s30_an`: bekleyen işin ara / son ekran durumu ve atlanma nedeni anında mı gönderim anında mı).
**KÂHİN SUSUYOR — modellenmedi (`ValueError`, senaryosuz):** Gönderiliyor (istek gitti, yanıt bekleniyor) anında silme talebi / 1 yıl dolumu (Y16-9).
**Bilgi (senaryosuz):** Y16-23 (geri yüklenen bekleyen iş Durduruldu kalır); talep aynı anda birden çok şirkette (cari şirkete özgü); S30 ile Atlandı olan işte eski belirsiz iletinin geç teslimi
(J1 / J10 düzeni — deneme sayılır, iş Atlandı kalır).

### 21.8 Kâhinde (kodlama) — senaryolar (11) ve mutasyonlar (13)
Kod: `KARARLAR` S29, S30, S31, S32 (AYNEN). **S29:** `s23_yeniden_bas` basmada şüphesiz tutar yoksa da elle sayar (`S23_OKUMALARI` / `s23_an`, `S23_AN_SUSUYOR` ve `isci`'deki S23-a `ValueError`
KALKTI); gönderim anı denetimi aynen (S7 elle yolu, S17). **S30:** `S30_BEKLEYEN` (Y16-9), `icerik_sil`: Gönderiliyor → KÂHİN SUSUYOR `ValueError`; bekleyen iş → okuma `s30_an` (`aninda` model:
`atla` `silme_talebi` / `saklama_suresi`; `gonderimde`: `silme_bekliyor`, `isci` gönderim anında atlar, `kuyrukta` → `s30_kuyrukta` o işi eşlerse S30-a `ValueError`); Sonucu Belirsiz iş iz
olarak kalır; `saklanacak()` içeriği yazılmamış bekleyen işi de 1 yıl kuralına alır; `programa_kabul` telefonu silinmiş işte alıcıyı `silinmis:<iş>` ile sayar (Y16-13). **S31:** `s31_eler()`
(`yeniden_dene`, `yine_de_gonder`: içeriği silinmiş Ekstre → `elenen` `icerik_silindi`), `tasi`: içeriği silinmiş Ödeme Hatırlatma → S31-a `ValueError` (eski S-W3-b hatası kalktı).
**S32:** `talepleri_uygula()` geri yüklemeden sonra (`icerik_yazim_ani` < talep anı), `kvkk` makinede (yedeğe girmez); `tasindi` talepleri `kvkk_onceki`'ne taşır → `icerik_gorunum` yalnız
o durumda `plan_susuyor` (S32-a; güncelleme 15'in S-W3-c `plan_susuyor`'u kalktı). Yeni olay / girdi alanı YOK; yeni çıktı değerleri: atlanma nedeni `silme_talebi` / `saklama_suresi`, elenme
nedeni `icerik_silindi`, S30 ara durumlarında `secenek`.

| Karar | Senaryo | Ne | Sınır | Mutasyon (yakalayan; değerle) |
|---|---|---|---|---|
| S29 | S29-01 | Yine de Gönder + duraklatma; kayıt açılır; yeniden basmada tutar yok (NZ2: öbür kalem bugün vadeli; NY: 20.11) → ikisi elle; ertesi gün Devam Et: NZ2 30.10.2026 / 150,00 TL (500 − 350) gider, NY "Atlandı — Gecikmiş Borç Yok" | vade = bugün → ertesi gün | M223, M224 (+ M213, M214) |
| S29 | S29-02 | 31.10 23:30 yerel; 23:45 yeniden basma (tutar yok); 01.11 00:10 yerel (UTC'de 31.10) Devam Et → YEREL güne göre 31.10.2026 / 200,00 TL; "Bu Ay" Ekim 1 + Kasım 1 | gece yarısı yerel ≠ UTC, ay sonu | M223, M224, M198 |
| S29 | S29-03 | Yine de Gönder'in iletisi Meta Bekletti; kayıt açılır; yeniden basma (tutar yok); 24 sa sonraki 2. deneme: 30.10 kalemi gecikmiş, S17 sınırı (900 − 300 tahsilat − 400 şüpheli = 200) → 30.10.2026 / 200,00 TL, POST 3 | Meta Bekletti 24 sa, S17 gönderim anında | M223, M224 |
| S29 | S29-04 | sınır 1: SQ / SK sınırda; yeniden basma (tutar yok); SQ'ya eski vadeli yeni fatura (20.10) → pencere açılınca 20.10.2026 / 200,00 TL; SK'nin kaydı kapanır → ertesi gün bütün gecikmiş + güncel bakiye (30.10.2026 / 150,00 TL / 150,00 TL) | 24 sa sınır, yeni kalem, kayıt kapanır (Y16-5) | M223 (SQ), M224 (SK) |
| S30 | S30-01 | B (Duraklatıldı, hiç gitmedi), D (Meta Bekletti), E (zincir: Yine de Gönder + duraklatma) silme talebi → gönderilmez (ara durum `secenek`), Devam Et / 24 sa sonra Atlandı, POST yok; ertesi gün aynı dönem: B, D gider, E belirsiz izle "Sonucu Belirsiz"; E'nin asıl işinde Yine de Gönder `icerik_silindi` | üç bekleme yolu, Meta Bekletti 24 sa, D6 | M225, M226, M227, M228, M230, M231, M235 (+ M215, M219) |
| S30 | S30-02 | Ödeme Hatırlatma, sınır 2: SB (Sınır) ve BE (Sonucu Belirsiz) talep; lisans salt okunur → LS (Lisans) talep; Devam Et: SB, LS Atlandı; aynı gün BE "Sonucu Belirsiz" (E3), SB / LS yeni işle gider; ertesi gün BE gider | Sınır, Lisans, aynı yerel gün | M225, M226, M228 (+ M215, M219) |
| S30 | S30-03 | 02.11.2026: A gider, B (Ekstre) ve HC (Ödeme Hatırlatma, içerik yazılmadı) duraklatılır, D Sonucu Belirsiz; 1 yıl −2 sa içerik durur, +2 sa: B, HC gönderilmez (`saklama_suresi`, `secenek`), A / D içerik silinir; aynı dönem A "Daha Önce", D "Sonucu Belirsiz", B gider; HC'ye yeni hatırlatma | 1 yıl ±2 sa, içeriksiz bekleyen iş | M225, M226, M228, M229, M216, M217 (+ M215) |
| S31 | S31-01 | A, B Başarısız (131021), C gider; A talep; Başarısızları Yeniden Dene: A `icerik_silindi`, B alınır; aynı dönem yeni gönderimde A uyarısız, yeni içerikle gider | talep → yeniden deneme | M230, M235 (+ M219) |
| S31 | S31-02 | 1 yıl dolunca A (Başarısız) ve B (Sonucu Belirsiz) içeriği silinir; Yeniden Dene (A) ve Yine de Gönder (B) `icerik_silindi`; aynı dönem A gider, B "Sonucu Belirsiz" (S30-b); Ekim 2027 B'ye gider | 1 yıl, iki yol | M230, M231, M235, M226, M216, M217 |
| S32 | S32-01 | Y0 talepten ÖNCE, Y1 talepten SONRA (A'ya Kasım ekstresi arada); Y0 geri yükleme → A'nın Ekim içeriği silinmiş, B'ninki durur; Y1 → Ekim silinmiş, Kasım içeriği DURUR; aynı dönem ikisi "Daha Önce" | talep anı (öncesi / sonrası) | M232, M233, M234 (+ M215) |
| S32 | S32-02 | talepten önceki yedekte C Başarısız, D Sonucu Belirsiz; geri yükleme → ikisinin içeriği silinmiş (D Belirsiz kalır); Yeniden Dene / Yine de Gönder `icerik_silindi`; aynı dönem C gider, D "Sonucu Belirsiz" | geri yükleme × S31 × S30 | M232, M234, M226, M230, M231, M235 |

Mutasyonlar (`kahin.MUTASYONLAR`): M223 S29 B (eski `s23_an` 'basma' okuması), M224 tutar basma anına sabit (zaman sınırı), M225 S30 B (kartla gider), M226 belirsiz iz silinir, M227 / M228 bekleyen
kümesi dışı (Meta Bekletti; Duraklatıldı / Lisans / açılışta sorulan), M229 içeriksiz bekleyen işe 1 yıl kuralı yok, M230 S31 B (içerik yeniden üretilir), M231 yalnız Yeniden Dene kapalı, M232 S32 B
(yeniden uygulanmaz), M233 talepten sonraki içerik de silinir, M234 talep kaydı dosyada (yedekle döner), M235 neden görünmez. Hepsi DEĞERLE yakalanıyor — matris (`wk16-mutant-matrisi`, 13 yeni /
değişen senaryo): M223 5, M224 4, M225 3, M226 5, M227 1, M228 3, M229 1, M230 4, M231 3, M232 3, M233 1, M234 3, M235 4; istisnayla 0. İstisnayla yakalanan yine yalnız M5, M108 (eskiden beri).
Kâhinin kendi testine **I13** eklendi: (a) I12'nin eski S23-a girdisi S29 ile 30.10.2026 / 150,00 TL, POST 2 — M223 ile "Atlandı — Şüpheli Alacağı Var", POST 1 (A ↔ B ayrışır); (b) `s23_an` hiçbir
yerde yok; (c) `s30_an` iki okumasında kime / kaç kez alanları (elenen, oluşmayan, R3, "Bu Ay", başlatma reddi, yeniden deneme yanıtları, POST, kabul, Meta'daki ileti) AYNI (≥ 3 koşu); (d) S30-a sırası
(talep → aynı dönem yeni gönderim, bekleyen iş kapanmadan) `aninda` okumasında gider, iki okumayla hata; (e) Gönderiliyor anında talep KÂHİN SUSUYOR; (f) I12'nin eski S-W3-a girdileri hesaplanır
(bekleyen iş gönderilmez — M225 ile gider; belirsiz iz eler — M226 ile elemez; 1 yıl dolarken bekleyen iş `secenek`); (g) eski S-W3-b girdisi `icerik_silindi` (M230 ile gider), Ödeme Hatırlatma'nın
Yeniden Dene'si ve işteki Yine de Gönder'i S31-a hatası; (h) taşımadan sonra geri yüklenen talep öncesi içerik `plan_susuyor` (S32-a); (i) silinmiş belirsiz işe imzalı geç teslim (Teslim, içerik
silinmiş kalır, pencere 3, aynı dönem "Daha Önce"); (j) yeni adlar yalnız S30–S32 başlıklarında, S29 ≥ 2, S30 ≥ 3, S31 ≥ 2, S32 ≥ 2. I12'den (b), (c), (e), (f) kalktı (I13'e tersine taşındı); I12 (g),
I10 (e), I2, I4 (`senaryolar.YENI_250`) yeni başlıklarla genişledi; F ipuçlarına M223–M235.

### 21.9 Eski kâhinle karşılaştırma (taban ee344d86, değişiklikten ÖNCE alınmış kopya; `kahin.py` sha256 429333a4…)
Yeni 11 + değişen 2 senaryo: **13 KIRMIZI, 0 AYNI** (`wk16-eski-kahinle-yeni-senaryolar`). Yeni 11'in 10'u eski kâhinin "KULLANICIYA SORULMALI … kodlanmadı" hatasıyla (beklenen neden — kural yoktu):
S29-01…04 S23-a; S30-01/02/03, S31-02, S32-02 S-W3-a (bekleyen ya da Sonucu Belirsiz işte silme); S31-01 S-W3-b. S32-01 değerle: eski kâhinde talepten önceki yedekten dönen içerik `plan_susuyor`
(S-W3-c) ↔ beklenen silinmiş. Değişen S23-05 / SW3-05 değerle (seçenek ↔ kesin; `plan_susuyor` ↔ silinmiş). Ek (ders 38): eski kâhinin YALNIZ üç hata satırı etkisiz (`None and ValueError(…)`)
nötr kopyasında (`wk16-araclar/eski_kahinle.py --notr`; kural eklenmedi) **13/13 değerle KIRMIZI** ve nedenler beklenen (`wk16-eski-kahinle-yeni-senaryolar-notr`): S29'larda iki okuma kime / kaç
kez ayrışıyor (POST `secenek` [2, 1] — 'basma' okumasında ileti gitmiyor = S29'un B'si); S30'larda bekleyen işler karttaki bilgiyle GİDİYOR (POST 1, sonraki gönderimde "Daha Önce" / "Zaten
Kuyrukta" = S30'un B'si); S31'lerde silinmiş Ekstre YENİDEN gidiyor (alinan, POST +1 = S31'in B'si); S32'lerde içerik `plan_susuyor` / geri gelen içerikle yeniden deneme gidiyor (S32'nin B'si).

### 21.10 Değişen eski beklentiler
342 eski senaryonun 340'ı bayt bayt aynı (girdi + elle + TAM model sonucu + başlık / açıklama / kaynak; sıra korunuyor — taban ee344d86'nın değişiklikten önce alınmış `senaryolar.json` kopyasıyla,
`wk16-eski-342-tam-sonuc-fark`). Değişen 2 (G3 gerekçesi):
| Senaryo | Değişen | Neden (KARAR) |
|---|---|---|
| S23-05 | elle + tam sonuç: `yeniden.Y2.elenen` `secenek` → {}, `yeniden.Y2.elle_sayilan` `secenek` → ["NZ"], `isler.T1/NZ.atlanma_nedeni` `secenek` → `gecikmis_borc_yok`; açıklama + kaynak (ad tarihsel: "iki-okuma") | S29 (Y16-3) |
| SW3-05 | elle + tam sonuç: `kontroller.K2.icerik.T1/A`, `kontroller.K3.icerik.T1/A` ve `isler.T1/A` içerik alanları `plan_susuyor` → silinmiş (null + `icerik_silindi: true`); açıklama + kaynak (ad tarihsel: "icerik-susuyor") | S32 (Y16-21) |
Üst alanlardan yalnız `kararlar`'a S29, S30, S31, S32 eklendi (eski kararlar değişmedi).

### 21.11 Sürücü için (S-67 … S-74; programa karşı koşmadan önce gereken eşlemeler)
- **S-67 S29:** S-59 aynen (yeniden basma iş gönderim anından önce beklerken, kayıt açıkken); basmada şüphesiz tutar YOKKEN de programın yanıtı kişiyi elle saymalı (`elle_sayilan`); programın ayrıca "şu an
  şüphesiz tutar yok" bilgisi göstermesi `elenen` sayılmaz. Gönderim anında tutar doğarsa ileti gider; S29-02 gece yarısı — iki koşu `TZ=Europe/Istanbul` ve `TZ=UTC`.
- **S-68 S30:** `kvkk_sil` (S-61 aynen) bekleyen işte: programın gösterdiği teslimsiz kapanmış durum (Atlandı / İptal / Durduruldu …) ve nedeni → `Atlandı` + `silme_talebi` / `saklama_suresi`
  eşlenir; ara denetimdeki iş durumu `secenek` (anında / gönderim anında). Kartın telefonu talepte SİLİNMEZ (ayrı `cari {telefon: null}` olayı gerekir); bekleyen iş için hiçbir istek gitmemeli.
- **S-69 1 yıl:** S-63 aynen; saklama turu bekleyen işlere de bakmalı (içeriği hiç yazılmamış Ödeme Hatırlatma işi dahil — S30-03 HC).
- **S-70 S31:** içeriği silinmiş Ekstre işinde Başarısızları Yeniden Dene / işteki Yine de Gönder: düğme pasif + neden ya da yanıtta elenen → `elenen` `icerik_silindi`; neden okunamazsa "okunamadı"
  (ders 4), boş sayılmaz.
- **S-71 S32:** geri yükleme (S-64 aynen) ile AYNI ANDA içerik denetimi (`kontrol_ic`); talepten önceki yedekte içerik null; talepten sonraki yedekte talepten sonraki içerik dolu. Makine düzeyindeki
  talep kaydı yalnız şirket + cari kimliği + an tutmalı — sürücü programın kaydını okuyup ad / telefon / içerik OLMADIĞINI denetler (okunamazsa "okunamadı").
- **S-72:** silinmiş Sonucu Belirsiz işe imzalı geç teslim (I13 i): iş Teslim, içerik / telefon boş kalır, pencere alıcıyı sayar.
- **S-73:** S29-a, S30-a, S31-a sıralarına giren senaryo YOK (kâhin hata verir) — sürücü bu sıraları kurmaz; S30-b (belirsiz Ekstre aynı dönem yolu) yalnız açık kararlarla hesaplanır.
- **S-74 Ç5 / W-3 öncesi:** program S29'u (Ç5) ya da S30–S32'yi (W-3) henüz uygulamıyorsa bu 11 senaryoda (ve S23-05 / SW3-05'te) ayrışma BEKLENİR (S-66 düzeni) — kod birleşince yeniden koşulur.

### 21.12 Kanıt ve DENENMEYEN
- **Kanıt** (`docs/kanit/2026-11-06/wk16-*`, OKU: `wk16-OKU.txt`; kod commit'i 823ea335): senaryolar **353/353** elle = model (`wk16-senaryolar`, `TZ=UTC`; `wk16-senaryolar-tz-istanbul` 353/353,
  `senaryolar.json` iki koşuda aynı sha256); kâhinin kendi testi **382/382**, F mutasyon **234/234** (`wk16-kahin`, `TZ=UTC`; `wk16-kahin-tz-istanbul` 382/382); eski kâhinle yeni / değişen 13 senaryo
  (ham + nötr kopya); 342 eski senaryonun tam sonuç farkı; mutant matrisi; araçlar `wk16-araclar/`. Sahte Meta'ya ve sürücüye DOKUNULMADI (açılmadı, testleri koşulmadı).
- **DENENMEYEN:** programa karşı sürücü koşusu (görev gereği; S-67…S-74 yazılmadı); S29-a, S30-a, S31-a (KULLANICIYA SORULMALI — kâhin hata verir, yalnız I13); S30-b'nin B'si (yol eklenmedi);
  S32-a taşıma (yalnız I13, `plan_susuyor`); Gönderiliyor anında talep (modellenmedi); geri yüklenen dosyada BEKLEYEN iş (Y16-23, senaryosuz); S30'un açılışta sorulan (24 saatten eski) ve
  Hazırlanıyor yolları (Duraklatıldı ile aynı küme — senaryosuz; denenen yollar: Duraklatıldı, Meta Bekletti, zincir, Sınır, Lisans, 1 yıl Duraklatıldı); silinmiş belirsiz işe geç teslim (yalnız I13);
  talep iki şirket; S29'da gönderim anında net sınırının tutarı sıfıra indirmesi; 29 Şubat'ı geçen saklama süresi; S30 × S22 / S23 (bekleyen işte yeniden basma sonrası talep).

## 22. Kâhin güncellemesi 17 — S34 (S29-a), S35 (S30-a), S36 (S30-b), S37 (S31-a), S38 (S32-a) + S33, S41 (06.11.2026)

### 22.1 Kaynak ve bağımsızlık
Kaynak YALNIZ karar metinleri (AYNEN `kahin.KARARLAR` S34, S35, S36, S37, S38, S33, S41 olacak): `docs/2.5.0-IS-LISTESI.md` D bölümü "KULLANICI KARARI 06.11 08:06 UTC (AYNEN: "a"; sorular C
bölümünde S34–S40, öneriyle soruldu; … "a" = ÖNERİLER)" satırının S34–S38 maddeleri (S37'de öneri B), "KULLANICI KARARI 06.11 07:00 UTC" satırının S33 maddesi, "KULLANICI KARARI 06.11 08:08 UTC" satırının
S41 maddesi ve C bölümündeki iki seçenekli soru metinleri (S33: SORULDU 06:58 → 07:00; S34–S38: 07:39 → 08:06; S41: 08:04 → 08:08); ana oturumun görev metni ve S33 / S41 iletisi ("Yol 1 (Elle Bağla) imzasız
bildirim kabul etmeye devam eder"; "teslim bilgisi kaybolmaz, 'Süresi Doldu' yüzünden aynı dönemde ikinci ileti gitmez"); önceki S7 … S32 kararları ve kâhinde zaten olan D1, D6, D8, E2, E3, F1, H1, J1,
J2, J3, J5, J6, J12, K3, K6, K7, R3, W1 metinleri (aynen); WhatsApp "kime kaç kez" genel ilkesi (CLAUDE.md "2.4.8 KARARLARI"; P6 §0). Okunan başka dosya: CLAUDE.md, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`,
bu README (1–153, 189–200, 228–240, 942–966 ve 1113–1734. satırlar), `kahin/*`, `docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md`, `docs/2.5.0-IS-LISTESI.md` YALNIZ C ve D bölümleri. `surucu.mjs` ve
`sahte-meta/` açılmadı ve aranmadı. Program kodu (`server/`, `client/`, `bulut/`, `tools/` — `kanit.mjs` yalnız çalıştırıldı), program testleri, `docs/kanit/` (kendi kanıtı dışında), iş listesinin A, B ve
E bölümleri ve öbür ajanların raporları GÖRÜLMEDİ; git'ten yalnız tabana (7d6c6369 → 0b6f8136) hızlı ileri birleştirmenin ekrana düşen dosya adı / satır sayısı listesi (içerik değil), son commit iletileri
(biçim için) ve 0b6f8136'nın yalnız iş listesi farkı (S41 kararı; farkta E bölümünden bir kayıt satırı da göründü) göründü. Programa karşı KOŞULMADI. Eski kâhinle karşılaştırma git'ten değil, taban
ağaçtaki (7d6c6369) `kahin/*` dosyalarının değişiklikten ÖNCE not defterine alınmış kopyasıyla (`kahin.py` sha256 426498d0…). Bu bölümün 22.1–22.9'u kodlamadan ÖNCE yazıldı ve ayrı commit'lendi
(ders 40); 22.10–22.14 kodlamadan sonra.

### 22.2 Yorumlar — S34 (S29-a) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y17-1 | **S34 tetiği**: Ödeme Hatırlatma; işteki Yine de Gönder S16 yolundan (Y13-1: iş Sonucu Belirsiz — ya da `hedef: "asil"` ile asıl işteki Sonucu Belirsiz deneme: S22 yolunun yeniden basması Y14-4, S16-02'nin ertesi günkü basması dahil); basma ANINDA şüpheli kaydı açık ve basma anında şüphesiz tutar YOK (şüphesiz vadesi geçmiş kalem kümesi boş ya da S17 / (5) ile sınırlanmış tutar ≤ 0). Bekleyen işte yeniden basma (S23) S29'dur — değişmez | S34 + S16 + S29 + Y13-1 |
| Y17-2 | **Sonuç**: iş ALINIR (yanıtta `alinan` [cari], `elenen`'de yok), S16 ile elle sayılır (Y13-2), onay penceresinde "Şüpheli Alacağı Var" (Y13-4). Gönderim anında S7 elle yolu: şüphesiz tutar VARSA {{3}} / {{4}} gönderim anındaki şüphesiz kalemlerden, S17 sınırıyla ({{5}} kayıt açıkken `plan_susuyor` S7S); YOKSA "Atlandı — Gecikmiş Borç Yok" (net elemesinde Y13-7 `secenek`). "(S29 ile aynı)": gönderim anına kadar tutar doğmasa da iş alınmıştır (Y16-3 düzeni) — S34'ün B'si "basmada elenir"dir, A tek okumadır. Yine de Gönder'in öbür elemeleri (Zaten Kuyrukta → Daha Önce Gönderildi; F1, E2) aynen | S34 soru metni (A / B) + S29 (Y16-2/3) + S16 + S17 |
| Y17-3 | **`s16_an` iki okuması KALKAR**: README §18.4'ün 'basma' okuması (yanıtta elenir, iş Sonucu Belirsiz kalır) S34'ün B seçeneğidir → tek okuma (eski 'gonderim'). S16'nın "(yoksa elenir)" sözü gönderim anındaki "Atlandı — Gecikmiş Borç Yok" olarak gerçekleşir. Kâhinin "basma anında şüphesiz tutar yoktu, gönderim anında doğdu" `ValueError`'ı kalkar (I10 (d) tersine döner) | S34 + §18.4 |
| Y17-4 | **Gönderim anı ve gün**: işin kendi gönderim anı (Y15-3 / Y16-4 düzeni: hemen; Sınır → pencere açılınca; Duraklatıldı → Devam Et; Meta Bekletti → 24 sa sonraki 2. deneme; zincirdeki yeniden deneme); "vadesi geçmiş" ve net borç gönderim anının YEREL gününe göre (Y14-9). Kayıt gönderim anından önce kapanırsa iş elle kalır, bütün (açık) gecikmişiyle ((5) sınırı) ve güncel bakiyeyle gider (Y12-7 / Y16-5) | S34 + Y14-9 + Y16-4/5 |
| Y17-5 | **İlke denetimi (ders 45)**: (1) iş alınır ama ileti ancak tutar varsa gider; Atlandı iş sayılmaz; (2) eski belirsiz deneme durur, tek yol işteki onaylı Yine de Gönder — S34 o yolu kullanır; (3) girmez; (4) tutar yoksa §7a 20 türünden eleme, borç doğunca yeniden basma (asıl işte) ya da ertesi gün yeni gönderim, Ekstre her zaman açık; (5) §7a 26 ile duran iş durur. İkinci ileti doğmaz | G0 (1)–(5) |

### 22.3 Yorumlar — S35 (S30-a) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y17-6 | **S35 tetiği**: silme talebi (`kvkk_sil`) ANINDA kişinin (aynı şirket) BEKLEYEN işi — Y16-9 kümesi aynen (Bekliyor, Sınır Nedeniyle Bekliyor, Duraklatıldı, Lisans Nedeniyle Durdu, açılışta sorulan, Meta Bekletti, Hazırlanıyor; zincir dahil). **1 yıl dolumu**: S30 iki tetiği TEK kural olarak bağlar ("silme talebi ya da 1 yıl dolumu anında bekleyen iş gönderilmez"); S35'in yanıtladığı soru README §21.7 S30-a "silme talebi / 1 yıl dolumu anında bekleyen iş" diye sordu; ana oturumun görev metni "WK 16'nın s30_an seçenekli yaprakları S35 ile kesinleşir" der (S30-03'ün 1 yıl yaprakları dahil) → kâhin 1 yıl dolumunda da AYNI anı uygular. İş listesi C'deki S35 metni yalnız "silme talebinde" dediğinden bu genişletme ana oturumca BAŞ MİMAR KARARI olarak listelenmeli (ders 40); kime / kaç kez farkı yalnız "1 yıldır bekleyen iş + aynı dönem yeni gönderim" sırasında | S35 + S30 + §21.7 S30-a + görev metni |
| Y17-7 | **Sonuç**: iş O ANDA kapanır — durum "Atlandı", atlanma nedeni `silme_talebi` (= karar metnindeki "Atlandı — Silme Talebi"); 1 yıl dolumunda `saklama_suresi` (kâhin adı; karar metninde ad yok — sürücü eşler). İçerik + telefon silinir (S30); POST yok, deneme açılmaz; ara denetimde de "Atlandı" (WK 16'nın `secenek`'i kalkar) | S35 + S30 + Y16-10 |
| Y17-8 | **Kuyruktan çıkar**: talep anında kapanan iş "Zaten Kuyrukta"da SAYILMAZ (yeni toplu işte §7a 9, Başarısızları Yeniden Dene'de E2, işteki Yine de Gönder'de F1) → talepten sonra aynı kişiye aynı dönem yeni gönderim karttaki telefonla, yeni içerikle gider (S35 sorusunun A metni: "talepten sonra aynı dönem yeni gönderim karttaki telefonla gider" — README §21.7). R3'te sayılmaz (deneme yok — ilke 1). Ödeme Hatırlatma'da "aynı gün" eşlikleri aynen (E3 yerel gün) | S35 + §21.7 S30-a (A) + §7a 9 + E2 + F1 + G0 (1) |
| Y17-9 | **Meta Bekletti**: 1. ileti Meta'da (131049), 2. deneme bekliyor; talep anında "Atlandı", 2. deneme GİTMEZ; K7 gereği teslim gelmedikçe 1. ileti "Daha Önce Gönderildi" sayılmaz → aynı dönem yeni gönderim gider. 1. iletinin teslimi SONRADAN gelirse J1 / J5 gereği deneme teslim sayılır (R3 + "Bu Ay"), iş Atlandı kalır; o arada yeni gönderim gittiyse kişi iki ileti almış olur — K7'nin İptal / geri yükleme / taşıma ile duran Meta Bekletti düzeniyle AYNI (kullanıcı K7: teslim gelene kadar sayılmaz) → yeni soru değil, bilgi | S35 + K7 + J1 + J2 + J5 |
| Y17-10 | **Belirsiz işler (S30 aynen)**: S35 yalnız bekleyen işi kapatır; Sonucu Belirsiz iş iz olarak kalır (aynı dönem "Sonucu Belirsiz" ile eler — D1 / E3 / K6). Zincirde bekleyen iş (işteki Yine de Gönder / o zincirdeki yeniden deneme) talep anında Atlandı olur, asıl işteki eski belirsiz denemenin izi kalır → aynı dönem yeni gönderim "Sonucu Belirsiz" ile elenir; yol: Ekstre'de aynı dönem yok (S36), Ödeme Hatırlatma'da asıl işte Yine de Gönder (S37) | S35 + S30 + S36 + S37 + D1 + D6 |
| Y17-11 | **Kapsam dışı (S35 "bekleyen iş" der)**: Gönderiliyor anında (istek gitti, yanıt bekleniyor) talep / 1 yıl dolumu — S35 ile KESİNLEŞMEDİ → 22.9 **S35-a ★** (KODLANMADI; kâhinin Y16-9 `ValueError`'ı sürer, senaryosuz). Geri yüklenen dosyadaki bekleyen iş Y16-23 aynen (önce §7a 26 Durduruldu, sonra içerik silinir; S35'in "Atlandı"sı değil — kime / kaç kez aynı, bilgi). Meta Kabul Etti / Gönderildi ve kapanmış işler Y15-20 aynen | S35 + Y16-9 + Y16-23 + Y15-20 |
| Y17-12 | **İlke denetimi (ders 45)**: (1) kapanan iş gitmez ve sayılmaz; (2) belirsiz iz kalır; (3) kabul / teslim izi aynen; (4) kapanan işin kişisine aynı dönem yeni gönderim AÇIK (S35'in amacı — B'nin "Zaten Kuyrukta" çıkmazı yok); (5) geri yükleme Y16-23, taşıma S38. Tek ikinci ileti olasılığı Y17-9 (K7 düzeni) | G0 (1)–(5) + K7 |

### 22.4 Yorumlar — S36 (S30-b) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y17-13 | **S36 tetiği**: içeriği silinmiş (talep, 1 yıl, S32 ile geri yüklemede yeniden uygulanmış) Sonucu Belirsiz EKSTRE işi (asıl işteki belirsiz deneme izi). Aynı dönem: yeni gönderimde "Sonucu Belirsiz" ile elenir (D1 + S30) — R3 "Yine de Gönder" bayrağı (`onceki: "gonder"`) da bu elemeyi aşmaz (E2 sırası Zaten Kuyrukta → Sonucu Belirsiz → R3; D1); işteki Yine de Gönder ve Başarısızları Yeniden Dene S31 ile kapalı (`icerik_silindi`) → aynı dönem için gönderme yolu YOK. Sonraki dönem (dönem eşliği K1 / D4 dışı) uyarısız gider | S36 + S30 + S31 + D1 + E2 + K1 / D4 |
| Y17-14 | **Kâhinde değişiklik**: WK 16 iki açık kararı (S30, S31) aynen hesaplıyordu, S30-b için `ValueError` YOKTU (§21.7: "Kâhin A'yı hesaplar, yol eklemez") → S36 = A bugünkü hesapla AYNI: kod değişmez; `KARARLAR` S36 + senaryo + mutant (B: yeni gönderimde uyarıyla onaylı Yine de Gönder açık). İlke 4'ün BU duruma özel istisnası (kullanıcı onaylı) — kâhinin ilke denetimi bunu çıkmaz saymaz | S36 + §21.7 |
| Y17-15 | **Kapsam**: yalnız Ekstre (Ödeme Hatırlatma'da S37 ile asıl işte Yine de Gönder açık — ilke 4 orada korunur). Belirsiz değil Başarısız ise S31 + K3: aynı dönem yeni gönderim uyarısız gider (S36 dışı). İzin dönem eşliği bugünkü kurallarla: hazır seçimde takvim ayı, özel aralıkta birebir / aynı tarihli hazır seçim, Son 3 Ay / Tüm'de son 7 gün (D3) — 7 gün sonra aynı seçim yeniden gider (bilgi, senaryosuz). Geç imzalı kabul / teslim gelirse H1 / J1: iz "gönderildi" olur, kişi "Daha Önce Gönderildi" (R3 uyarısıyla Yine de Gönder açılır) | S36 + S37 + S31 + K3 + D3 + H1 + J1 |

### 22.5 Yorumlar — S37 (S31-a = B) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y17-16 | **S37 tetiği**: içeriği silinmiş (talep, 1 yıl, S32) ÖDEME HATIRLATMA işinin AYNI İŞ üzerinden yeniden gönderimi: Başarısızları Yeniden Dene (asıl iş ya da zincir, `hedef: "asil"` dahil), işteki Yine de Gönder (Sonucu Belirsiz) ve asıl işte yeniden Yine de Gönder (S16 / S22 yolu). Bekleyen işte yeniden basma (S23 / S29) bu duruma girmez: içerik silindiğinde bekleyen iş S35 ile Atlandı'dır | S37 + Y16-16 + S35 |
| Y17-17 | **Sonuç (B)**: yeniden gönderilir — içerik GÖNDERİM ANINDA karttan yeniden hazırlanır ({{1}}–{{5}} gönderim anındaki ad, firma, vadeler, hareketler, net sınırı; telefon karttan — silinen telefon kullanılmaz, Y15-16), işe yazılır, `icerik_silindi` kalkar. WK 15'in Y15-21 Ödeme Hatırlatma okuması (WK 16'da Y16-19 ile geri çekilmişti) artık KARAR. Yeniden gönderimin elemeleri aynen: E2 (Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi), F1, S7 / S16 / S22 şüpheli kuralları, §7a 20 / (5) / S17 gönderim anında; kart telefonu da silindiyse gönderim anında "Atlandı — Telefonsuz" (§7a 2, 6) | S37 + Y15-21 + Y9d-2 + Y15-16 + E2 + F1 |
| Y17-18 | **Talepten sonra yazılan içerik**: yeniden gönderimde işe yazılan yeni içerik S32 gereği KALIR (talep yalnız o ana kadar yazılmış kayıtları kapsar — Y16-22); kişi yeniden silme isterse yeni talep. 1 yıl kuralı yeni içeriğin son gönderim denemesinden yeniden başlar (Y15-13) | S37 + S32 (Y16-22) + Y15-13 |
| Y17-19 | **İlke denetimi (ders 45)**: (2) Ödeme Hatırlatma'da Sonucu Belirsiz kişinin aynı gün tek yolu (işteki Yine de Gönder) AÇIK kalır — ilke 4 korunur (Ekstre'de S36 istisnası); (1) Başarısız kişi yeniden denemede alınır, gitmediyse sayılmaz; (3) aynı gün kabul / teslim izi R3 ile eler. Kime / kaç kez yalnız "o yolla gider" yönünde değişir (karar B) | S37 + G0 (1)–(4) |

### 22.6 Yorumlar — S38 (S32-a) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y17-20 | **Taşıma paketi**: makinedeki silme talebi kayıtları (Y16-20: YALNIZ şirket kodu + cari kimliği + talep anı — ad, telefon, içerik, dönem yok) taşınan veriyle yeni bilgisayara gider ve oradaki makine düzeyi kayda eklenir; aynı kişide son talep anı geçer (Y16-20 "sonraki talep öncekini kapsar"). Makine defteri (gönderim denemeleri) TAŞINMAZ — D8 / §6 W2 aynen; karar metni yalnız talep kayıtlarını der | S38 + Y16-20 + D8 |
| Y17-21 | **Yeni bilgisayarda uygulanır**: taşınan andaki dosyada talepten önce yazılmış içerik zaten silinmiştir (kesin); yeni bilgisayarda geri yüklenen (eski bilgisayarda alınmış, talepten önceki) yedekte S32 aynen yeniden uygulanır — talep anından ÖNCE yazılmış içerik + telefon GELMEZ, SONRA yazılan kalır (Y16-21/22). Yeni bilgisayarda yapılan talep aynı kayda girer; zincirleme taşımada (ikinci taşıma) hepsi taşınır (ilke 5) | S38 + S32 (Y16-21/22) + G0 (5) |
| Y17-22 | **Kime / kaç kez değişmez** (S38 sorusu "ileti sayısını etkilemez"): yalnız içerik alanları; R3 taşınan dosyadaki izle (D8) aynen. Güncelleme 16'nın S32-a `plan_susuyor`'u kalkar — taşıma sonrası geri yüklenen talep öncesi içerik kesin silinmiş (`icerik_silindi`) | S38 + D8 + §21.5 Y16-25 |

### 22.7 Yorumlar — S33 ve S41 (bildirim yolu işareti, imza, adres) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y17-23 | **Kâhinde ne vardı**: §7a 3 — imzalı bildirim işlenir, imzasız (sahte) bildirim düşer; "bildirim (kanca) yolu çalışıyor" işareti (§7a 16, `son_kanca`) yalnız imzalı ve programın tanıdığı bir iletiye ait bildirimle (§5 kâhin yorumu 4); işaret yoksa iş TTL + 1 sa'te Süresi Doldu olmaz, "Meta Kabul Etti" / "Gönderildi"de kalır. Bağlantı yolu (Yol 1 Elle Bağla / Yol 2 WhatsApp'ı Bağla) ve bildirimin geldiği adres (WABA'nın alternatif adresi / uygulama düzeyi adres) MODELLENMİYORDU: Meta'nın bütün bildirimleri imzalı (kapıcıda doğrulanmış) sayılıyordu — bugünkü kâhin Yol 2 düzenidir | §7a 3, 16 + §5 yorum 4 |
| Y17-24 | **Yeni girdi alanları**: `ayar.baglanti_yolu` ∈ "yol1" \| "yol2" — yoksa "yol2" (eski senaryolar Yol 2 düzeninde, sonuçları bayt bayt aynı kalır); kanca `adres` ∈ "alternatif" (varsayılan) \| "uygulama" — `meta_davranis.kanca` öğesinin ek nesnesinde (`["delivered", "+5s", {"adres": "uygulama"}]`) ve `sahte_kanca` olayında | S33 + S41 (kâhin girdisi) |
| Y17-25 | **S33 (Yol 2)**: işareti yalnız İMZALI bildirim koyar → imzasız bildirim (wamid tanınsa da tanınmasa da) işareti KOYMAZ ve işlenmez (§7a 3 aynen). Kâhin zaten böyle (değişiklik yok); senaryo + mutant (B, bugünkü program: imzasız tek bildirim işareti koyar → TTL + 1 sa'te Süresi Doldu → aynı dönem ikinci ileti) | S33 + §7a 3, 16 + G0 (2) |
| Y17-26 | **Yol 1 "imzasız kabul"** (S41 karar metni "(Yol 1 imzasız kabul, Yol 2 yalnız imzalı)"; ana oturum: "Yol 1 imzasız bildirim kabul etmeye devam eder"): Yol 1'de kapıcı imzayı doğrulayamaz — Meta'nın bildirimleri İMZASIZ gelir ve Yol 2'de imzalı bildirim nasıl işleniyorsa öyle İŞLENİR (durum, teslim, R3, "Bu Ay", J6 yanıt katmanı, bildirim yolu işareti — tanınan iletiye aitse). Gerçek bildirimlerde Yol 1 = Yol 2. Kapıcı imzasız sahte bildirimi gerçeğinden ayıramadığından Yol 1'de `sahte_kanca` da işlenir: GUV-05 / 06 / 09'un "imzasız düşer" beklentisi Yol 2'ye özgüdür (o senaryolarda `baglanti_yolu` yok → Yol 2). **BİLİNEN RİSK (Yol 1, kullanıcı kararıyla)**: sahte "delivered" almamış kişiyi "Daha Önce Gönderildi" gösterir; sahte "failed" teslim edilmiş iletiyi Başarısız gösterip Başarısızları Yeniden Dene ile ikinci iletiye yol açabilir — bilgi (ana oturuma; README §15.5 A3'ün sınıfı: Yol 1 düzeni) | S41 + ana oturum iletisi + §7a 3 + §15.5 A3 |
| Y17-27 | **S41**: uygulama düzeyi adrese gelen bildirim, bu kurulumda kaydı olan WABA'nınsa (kâhinde: programın tanıdığı ileti / iş kimliği — kâhinin bütün iletileri kurulumun WABA'larından) alternatif adresle AYNI kurallarla işlenir: Yol 2'de imzalıysa işlenir (işareti de koyar), imzasızsa düşer; Yol 1'de imzasız kabul. Teslim bilgisi kaybolmaz → iş Teslim Edildi, R3 sayar; TTL + 1 sa "Süresi Doldu" yüzünden aynı dönemde ikinci ileti gitmez. Kaydı OLMAYAN WABA'nın bildirimi: tanınmayan wamid zaten düşer (§2 "bilinmeyen wamid düşer") — ayrıca modellenmedi (bilgi) | S41 + ana oturum iletisi + G0 (2, 3) |
| Y17-28 | **"Meta'daki adres hemen yeniden denetlenir"**: Meta yapılandırma okuması (subscribed_apps); ileti, sayaç, durum etkisi YOK → kâhin KAPSAMI DIŞI (sürücü notu 22.13). Baş mimar kararı (5) "uygulama düzeyi POST işlenmez" bu durum için KALKTI (S41) — kâhin o kararı hiç modellememişti (adres yoktu) → değişen eski beklenti yok | S41 |
| Y17-29 | **İlke denetimi (ders 45)**: S33 — almış olabilecek kişi (teslim bilgisi gelmeyen iş) sahte / doğrulanamayan tek bildirimle Süresi Doldu olup ikinci iletiye açılmaz (ilke 2); S41 — aldıysa aynı dönemde elenir (ilke 3), teslim bilgisi adres yüzünden kaybolmaz. Çelişen tek yer 22.9 S33-a | G0 (2, 3) |

### 22.8 Önceki güncellemelerle çelişen yerler (yeni KARAR geçer)
- §21.7 "KULLANICIYA SORULMALI S29-a ★" → KAPANDI (S34 = A); §18.4 "KÂHİN SUSUYOR S16 elemenin anı (`s16_an`)" → KAPANDI; S16-02'nin seçenekli yaprakları (yanıt, ara denetim) kesinleşir (G3).
  I10'un (a) iki okuma denetimi ve (d) "S16 iki okuma ayrışması" hatası tersine döner → I14.
- §21.7 "S30-a ★" → KAPANDI (S35 = A); `s30_an` ve `silme_bekliyor` kalkar; S30-01 / 02 / 03'ün seçenekli yaprakları kesinleşir (G3); I13 (c), (d), (f3) tersine döner → I14.
- §21.7 "S30-b ★" → KAPANDI (S36 = A) — hesap değişmez.
- §21.7 "S31-a ★" → KAPANDI (S37 = B): Y16-19'un "Y15-21 Ödeme Hatırlatma kısmı GERİ ÇEKİLDİ"si geri alınır (artık karar); `tasi`'deki `ValueError` kalkar; I13 (g)'nin S31-a hataları tersine döner → I14.
- §21.7 "S32-a" (`plan_susuyor`) → KAPANDI (S38 = A); I13 (h) tersine döner → I14.
- §5 / §2 "imzasız olay düşer" (GUV-05 / 06 / 09) → Yol 2'ye özgü (Yol 1'de imzasız kabul — S41, Y17-26); eski senaryolar Yol 2 düzeninde, beklenti değişmez.
- §15.5 A3 ("ana oturum sınıflasın: bilinen Yol 1 düzeni mi, hata mı") → S41 karar metniyle Yol 1 düzeni (bilgi; Yol 2 kipinde aynı davranış görülürse ayrışma).

### 22.9 KULLANICIYA SORULMALI / KÂHİN SUSUYOR (ana oturuma) — WK 16'dan kalanlar ve yeniler
**Bu kararlarla KESİNLEŞEN:** S29-a (S34), S30-a (S35), S30-b (S36), S31-a (S37), S32-a (S38); KÂHİN SUSUYOR `s16_an` (§18.4, S34) ve `s30_an` (§21.7 Y16-11, S35).

**KULLANICIYA SORULMALI (kime / kaç kez — KODLANMADI):**
- **S35-a ★** (KESİNLEŞMEDİ — WK 16'nın "Gönderiliyor anında talep" KÂHİN SUSUYOR'u; S35 yalnız "bekleyen iş" der): silme talebi / 1 yıl dolumu anında kişinin işi Gönderiliyor (istek gitti, yanıt
  bekleniyor) — A) (ÖNERİ, ilke 1–2 + S35 düzeni) içerik / telefon hemen silinir; isteğin sonucu ize yazılır (kabul → "gönderildi" izi, yanıtsız → Sonucu Belirsiz izi — S30); sonuç YENİDEN GÖNDERİM
  gerektirirse (Meta'nın geçici hatası 30 sn → 2 dk → 15 dk, 131049 Meta Bekletti, bağlantı yok R1) iş o anda S35 ile "Atlandı — Silme Talebi"; B) iş kendi yoluyla sürer — yeniden denemeler karttaki
  bilgiyle gider. Kime / kaç kez: B'de talepten sonra ikinci istek gider. Kâhinin Y16-9 `ValueError`'ı sürer (senaryosuz; programda aralık ~1 sn, kâhinde gecikmeli yanıt J6 / J7 ve çökme).
- **S33-a ★** (S33 × §5 yorum 4): S33 "işareti yalnız imzalı bildirim koyar" der — "her imzalı bildirim koyar" demez; Yol 1'de imzasız kabul (S41). Kâhin (2.4.8'den beri yorum 4): işareti YALNIZ programın
  tanıdığı bir iletiye (wamid ya da iş kimliği) ait kabul edilmiş bildirim koyar. Soru: wamid'i tanınmayan bildirim (Yol 2'de imzalı, Yol 1'de imzasız) "bildirim yolu çalışıyor" işaretini koysun mu —
  A) (ÖNERİ, ilke 2; kâhinin bugünkü yorumu) koymaz; B) kabul edilen her bildirim koyar (S33 sorusunda ölçülen bugünkü program davranışı; Yol 1'de sürer). Kime / kaç kez: B'de tanınmayan tek bildirimden
  sonra teslim bilgisi gelmeyen iş TTL + 1 sa'te Süresi Doldu olur, aynı dönem ikinci ileti mümkün (S33'ün Yol 2'de kapattığı yol Yol 1'de açık kalır). Kâhin yeni kodlama yapmaz (yorum 4 aynen); yeni
  senaryolar bu sıraya girmez; B seçilirse bakım gerekir.

**Ana oturum teyidi (BAŞ MİMAR KARARI olarak listelensin — ders 40):** Y17-6 (S35'in anı 1 yıl dolumunda da — görev metninden).

**KÂHİN SUSUYOR — `secenek` (sürer):** Y13-7 net elemesinin adı (`gecikmis_borc_yok` / `net_borc_yok`; Ç5'te "Net Borcu Yok" önerisi).

**Bilgi (senaryosuz):** Y17-9 (Meta Bekletti'nin geç teslimi + talepten sonraki yeni gönderim — K7 düzeni); Y17-26 Yol 1 sahte bildirim riski; Y16-23 (geri yüklenen bekleyen iş Durduruldu kalır — aynen);
talep aynı anda birden çok şirkette (cari şirkete özgü — aynen); S35 ile Atlandı olan zincir işinde eski belirsiz iletinin geç teslimi (J1 / J10 düzeni — deneme sayılır, iş Atlandı kalır).

### 22.10 Kâhinde (kodlama) — senaryolar (14) ve mutasyonlar (15)
Kod: `KARARLAR` S34, S35, S36, S37, S38, S33, S41 (AYNEN). **S34:** `yine_de_gonder`'de S16 basma anındaki tutar denetimi yalnız M236'da eler; iş alınır, `s34_t` (yalnız M237); `isci`'deki "S16 elemenin anı"
`ValueError`'ı kalktı; `S16_OKUMALARI`, `S16_AN_SUSUYOR` kalktı. **S35:** `icerik_sil`'de bekleyen iş o anda `atla` (`silme_talebi` / `saklama_suresi`); `s30_kuyrukta` ve S30-a `ValueError`'ı
kalktı; `S30_OKUMALARI`, `S30_AN_SUSUYOR` kalktı (`OKUMALAR` yalnız `devam_sd`); `silme_bekliyor` yalnız M238 / M240; Gönderiliyor anında talep `KULLANICIYA SORULMALI S35-a` `ValueError`'ı (eski
Y16-9 metni yerine). **S36:** hesap aynen; mutantlar için `silinmis_belirsiz_ekstre_t()` (M241) ve `belirsiz_kaynagi`'nda M242. **S37:** `tasi`'deki S31-a `ValueError`'ı kalktı; `s31_eler` Ödeme
Hatırlatma'yı elemez (M243 / M244 eler); içerik / telefon `isci`'de gönderim anında karttan (eskiden beri — Y9d-2). **S38:** `tasindi` talep kaydını (`kvkk`) taşır (M245 taşımaz, M246 anı
taşıma anı yapar); `kvkk_onceki` ve S32-a `plan_susuyor`'u kalktı. **S33 / S41 / Yol 1:** `self.yol` (`ayar.baglanti_yolu`, yoksa yol2; başka değer girdi hatası); Meta'nın kancası Yol 1'de
`imzali: False` yazılır, `kanca_al`'da Yol 1'de imzasız kabul edilir (M250 düşürür); `adres: "uygulama"` aynı kurallarla (M248 işlemez, M249 imza aramaz); `kanca_isle`'de imzasız bildirim M247'de
işareti koyar. Yeni girdi alanları: `ayar.baglanti_yolu`, kanca `adres` (meta_davranis.kanca ek nesnesi + `sahte_kanca`). Yeni olay / çıktı alanı YOK.

| Karar | Senaryo | Ne | Sınır | Mutasyon (yakalayan; değerle) |
|---|---|---|---|---|
| S34 | S34-01 | P1 / P2 Sonucu Belirsiz, kayıt açılır; İLK Yine de Gönder'de tutar yok → ikisi de ALINIR, duraklatılır; ertesi gün P1 30.10.2026 / 150,00 TL (500 − 350), P2 "Atlandı — Gecikmiş Borç Yok" | vade = bugün → ertesi gün, hiç doğmayan tutar | M236, M237, M200 |
| S34 | S34-02 | 31.10 23:30 yerel; 23:40 ilk basma (tutar yok) + duraklatma; 01.11 00:10 yerel (UTC'de 31.10) Devam Et → YEREL güne göre 31.10.2026 / 200,00 TL; "Bu Ay" Ekim 1 + Kasım 1 | gece yarısı yerel ≠ UTC | M236, M237, M198 |
| S35 | S35-01 | B (Duraklatıldı) ve D (Meta Bekletti) talep → anında Atlandı (`silme_talebi`); 70. dk aynı dönem yeni gönderim gider; D'nin 1. iletisinin geç teslimi deneme sayılır, iş Atlandı kalır (Y17-9, "Bu Ay" 4); sonra aynı dönem "Daha Önce" | talep anı, Meta Bekletti geç teslim | M238, M239, M225, M227, M228, M219, M221 |
| S35 | S35-02 | 31.10 23:00 Ödeme Hatırlatma: SH (Duraklatıldı) talep → anında Atlandı; 23:50 aynı gün SH'ye yeni hatırlatma gider, BH (Sonucu Belirsiz, içeriği silinmiş) aynı yerel gün elenir; 01.11 00:10 yerel BH'ye gider | gece yarısı yerel ≠ UTC (E3) | M238, M239, M114, M226 |
| S36 | S36-01 | A Sonucu Belirsiz, talep; aynı dönem yeni gönderim, R3 "Yine de Gönder" bayrağı, işteki Yine de Gönder ve 02.11 "Geçen Ay" (D4) — hepsinde elenir; Kasım gider | R3 bayrağı, D4 eşliği | M241, M242, M102, M226, M230, M231, M235 |
| S36 | S36-02 | Son 3 Ay: talepten sonra 1. gün (R3 bayrağıyla) ve 6 g 23 sa'te elenir, 7 g 2 sa'te gider | 7 gün (K1 / D3) | M241, M242, M102 |
| S37 | S37-01 | Ödeme Hatırlatma: RF / RT Başarısız, RB Sonucu Belirsiz; talep (RT'nin kart telefonu da silinir); Başarısızları Yeniden Dene RF ve RT'yi ALIR — RF karttan hazırlanan içerikle gider, RT "Atlandı — Telefonsuz"; RB'ye işteki Yine de Gönder gider | talep → aynı gün iki yol, silinen telefon | M243, M244, M218 |
| S37 | S37-02 | 02.11.2026 HF Başarısız, HB Sonucu Belirsiz; 1 yıl −2 sa içerik durur, +2 sa silinmiş; 1 yıl +3 sa Yeniden Dene + Yine de Gönder → ikisi karttan gider | 1 yıl ±2 sa | M243, M244 (+ M216, M217) |
| S38 | S38-01 | talep → Kasım ekstresi (talepten sonra) → Y1 → TAŞIMA → yeni bilgisayarda Y0: Ekim içeriği gelmez; Y1: Kasım içeriği durur; aynı dönem "Daha Önce" (dosyadaki iz) | talep anı öncesi / sonrası, taşıma | M245, M246, M232, M233, M234 |
| S38 | S38-02 | A talebi eski bilgisayarda, taşıma, C talebi yeni bilgisayarda; Y0 → ikisi gelmez; ikinci taşıma + Y0 → yine gelmez | taşıma öncesi + sonrası talep, zincirleme taşıma | M245, M232, M234 |
| S33 | S33-01 | Yol 2, teslim süresi 12 sa, Meta bildirimi yok; tanınmayan wamid'li ve B'nin wamid'li İMZASIZ bildirim işaret koymaz → iki iş 14. saatte Meta Kabul Etti, aynı dönem "Daha Önce" | TTL + 1 sa, işaretsiz yol | M247, M24 |
| S33 | S33-02 | Yol 1: Meta bildirimleri imzasız ve işlenir (A Teslim, B Gönderildi → işaret → 13 sa'te Süresi Doldu); C'ye imzasız SAHTE "delivered" de işlenir (BİLİNEN RİSK) → aynı dönem A, C elenir, B'ye gider | Yol 1, TTL | M250 |
| S41 | S41-01 | Yol 2: A'nın "delivered"ı ve B'nin iki bildirimi uygulama düzeyi adrese (imzalı) → Teslim; C'ye uygulama düzeyi adrese imzasız "delivered" düşer → 14. saatte C Süresi Doldu; aynı dönem A, B "Daha Önce", C gider | adres, imza, TTL | M248, M249, M24 |
| S41 | S41-02 | Yol 1: A'nın iki bildirimi uygulama düzeyi adrese İMZASIZ → kabul, Teslim; B 13 sa'te Süresi Doldu; aynı dönem A elenir, B gider | Yol 1 + uygulama adresi | M248, M250 |

Mutasyonlar (`kahin.MUTASYONLAR`): M236 S34 B (basmada elenir), M237 S34 tutar basma anına sabit, M238 S35 B (gönderim anına kadar kuyrukta), M239 talep anında kapanan iş "Zaten Kuyrukta" sayılır,
M240 S35 yalnız talepte (1 yıl dolumunda kuyrukta), M241 S36 B (R3 uyarısıyla onaylı gönderim), M242 S36 dönem sınırı (silinmiş belirsiz iz her dönemi eler), M243 S37 A (Ödeme Hatırlatma da elenir),
M244 S37 yol sınırı (yalnız Yeniden Dene açık), M245 S38 B (talepler taşınmaz), M246 S38 talep anı = taşıma anı, M247 S33 B (Yol 2'de imzasız işaret koyar), M248 S41 B (uygulama adresi işlenmez),
M249 uygulama adresinde imza aranmaz, M250 Yol 1'de de imzasız düşer. Hepsi DEĞERLE (elle beklenen) yakalanıyor — matris (`wk17-mutant-matrisi`, 14 yeni + 4 değişen senaryo): M236 3, M237 2,
M238 5, M239 5, M240 1 (S30-03), M241 4, M242 2, M243 2, M244 2, M245 2, M246 1, M247 1, M248 2, M249 1, M250 2; istisnayla 0. İstisnayla yakalanan yine yalnız M5, M108 (eskiden beri).
Kâhinin kendi testine **I14** eklendi: (a) `OKUMALAR` yalnız `devam_sd`, hiçbir beklenende `s16_an` / `s30_an` metni yok; I10'un eski (d) ayrışma girdisi S34 ile hesaplanır (alınır, 30.10.2026 /
150,00 TL, POST 2) — M236 ile basmada elenir (POST 1); (b) I13'ün eski S30-a girdisi: B anında Atlandı, yeni iş gider — M238 ile "Zaten Kuyrukta"; (c) 1 yıl dolarken bekleyen iş anında Atlandı
(`saklama_suresi`) — M240 ile Duraklatıldı kalır; (d) Gönderiliyor anında talep `KULLANICIYA SORULMALI S35-a`; (e) I13'ün eski S31-a girdileri (Yeniden Dene, işteki Yine de Gönder) karttan gider —
M243 iki yolda, M244 yalnız Yine de Gönder'de eler; (f) I13'ün eski S32-a girdisi (taşıma sonrası geri yükleme) silinmiş — M245 ile içerik geri gelir; (g) S36-01'de R3 bayrağı belirsiz elemesini aşmaz
— M241 ile gider; (h) geçersiz `baglanti_yolu` girdi hatası; (i) **gerçek bildirimlerde Yol 1 = Yol 2**: sahte bildirimsiz, bağlantı yolu vermeyen bütün senaryolar Yol 1'de aynı sonucu verir; (j) yeni
alanlar yalnız S33 / S41'de, her yeni başlık ≥ 2. I10 (a) / (d) ve I13 (c), (d), (e), (f3), (g) Ödeme Hatırlatma kısmı, (h) I14'e tersine taşındı; I10 (e) etiket listesine S34, I12 (g)'ye
S35–S38, I13 (j)'ye S35 / S36, I2'ye yedi karar, I4'e başlıklar (`senaryolar.YENI_250`), F ipuçlarına M236–M250. C değişmezinin "'Bu Ay' = Teslim + Okundu iş" eşitliği, talep anında kapanan
Meta Bekletti işinin 1. iletisi geç teslim edildiğinde (Y17-9; J10'un "Atlandı — Daha Önce Gönderildi" istisnasının kardeşi) eşitsizlik denetimine (Teslim + Okundu ≤ "Bu Ay" ≤ Meta'daki ileti)
düşer — ilk koşu S35-01'de bu eşitlik yüzünden kırmızıydı (`wk17-kahin-ilk-kos-degismez-kirmizi`), ve o koşuda M21 / M64 bu sahte kırmızıyla "yakalanmış" görünüyordu; düzeltmeden sonra
eski senaryolarında değerle yakalanıyorlar.

### 22.11 Eski kâhinle karşılaştırma (taban 7d6c6369, değişiklikten ÖNCE alınmış kopya; `kahin.py` sha256 426498d0…)
Yeni 14 + değişen 4 senaryo: **13 KIRMIZI, 5 AYNI** (`wk17-eski-kahinle-yeni-senaryolar`, iki saat diliminde aynı). KIRMIZI'ların nedeni BEKLENEN: S34-01 / 02 eski kâhinin "KULLANICIYA SORULMALI
(README §18.4, S16 elemenin anı) … kodlanmadı" hatası; S35-01 / 02 "KULLANICIYA SORULMALI S30-a … kodlanmadı"; S37-01 / 02 "KULLANICIYA SORULMALI S31-a … kodlanmadı"; S38-01 / 02 değerle (eski
kâhinde taşıma sonrası geri yüklenen talep öncesi içerik `plan_susuyor` — S32-a; kural yoktu); S33-02 değerle (eski kâhinde Yol 1 yok: imzasız sahte bildirim düşer, C Meta Kabul Etti → Süresi
Doldu, aynı dönem C'ye yeniden gider); değişen 4 değerle (`secenek` ↔ kesin). AYNI 5: S36-01 / 02 (S36 = A eski hesapla AYNI — Y17-14; dişi M241 / M242), S33-01 (eski kâhin zaten Yol 2 düzeni:
imzasız düşer, işaret yok — S33 değişiklik getirmez; dişi M247), S41-01 / 02 (eski kâhin adresi hiç modellemiyordu, bütün bildirimleri işliyordu = S41'in A'sı; Yol 1'deki Meta bildirimleri eski kâhinde
imzalı sayılıyordu — sonuç aynı; dişi M248 / M249 / M250). Ek (ders 38): eski kâhinin YALNIZ üç hata satırı `None and ValueError(…)` ile etkisiz kılınmış nötr kopyasında (kural eklenmedi;
`wk17-araclar/eski_kahinle.py --notr`) **11 KIRMIZI, 7 AYNI** (`wk17-eski-kahinle-yeni-senaryolar-notr`): S34'ler değerle (iki okuma kime / kaç kez ayrışıyor — `secenek`'li POST / yanıt; 'basma'
okumasında ileti yok = S34'ün B'si), S35'ler değerle (`secenek` ara durumlar + 'gonderimde' okumasında yeni gönderim "Zaten Kuyrukta" = S35'in B'si), S38'ler ve S33-02 yukarıdaki gibi; S37'ler
nötr kopyada AYNI — karar yokken düşülecek yol (hata satırı kalkınca içerik gönderim anında karttan yazılır) S37'nin B'sidir (Y15-21 okuması) → nötr kopya B'ye karşı kanıt DEĞİL; A ↔ B dişi M243 /
M244 (değerle) ve I14 (e).

### 22.12 Değişen eski beklentiler
353 eski senaryonun 349'u bayt bayt aynı (girdi + elle + TAM model sonucu + başlık / açıklama / kaynak; sıra korunuyor — taban 7d6c6369'un değişiklikten önce alınmış `senaryolar.json` kopyasıyla,
`wk17-eski-353-tam-sonuc-fark`). Değişen 4 (G3 gerekçesi; yaprak farkı `wk17-degisen-4-yaprak-fark` — her değişen yaprak `secenek` → modelin ilk okuması, başka fark yok):
| Senaryo | Değişen | Neden (KARAR) |
|---|---|---|
| S16-02 | elle + tam sonuç: `yeniden.Y1.elenen` `secenek` → {}, `yeniden.Y1.alinan` `secenek` → ["X"], `kontroller.K1.isler.T1/X` ve `durum_sayilari` `secenek` → "Atlandı"; açıklama + kaynak (ad tarihsel: "elenir") | S34 (Y17-3) |
| S30-01 | elle + tam sonuç: `kontroller.K2.isler` T1/E, T2/B, T3/D ve `durum_sayilari` `secenek` → "Atlandı"; açıklama + kaynak | S35 (Y17-7) |
| S30-02 | elle + tam sonuç: `kontroller.K1.isler` T1/LS, T1/SB ve `durum_sayilari` `secenek` → "Atlandı"; açıklama + kaynak | S35 (Y17-7) |
| S30-03 | elle + tam sonuç: `kontroller.K2.isler` T2/B, T3/HC ve `durum_sayilari` `secenek` → "Atlandı"; açıklama + kaynak | S35 + Y17-6 (1 yıl) |
Üst alanlardan yalnız `kararlar`'a S33, S34, S35, S36, S37, S38, S41 eklendi (eski kararlar değişmedi).

### 22.13 Sürücü için (S-75 … S-83; programa karşı koşmadan önce gereken eşlemeler)
- **S-75 S34:** ilk Yine de Gönder (S16 yolu; kayıt açık, şüphesiz tutar yok): programın yanıtında kişi ALINMIŞ olmalı (`alinan`; "şu an tutar yok" bilgisi gösterilse de `elenen` sayılmaz); gönderim anında
  tutar doğarsa ileti gider. S34-02 gece yarısı — iki koşu `TZ=Europe/Istanbul` ve `TZ=UTC` (ders 13, 22).
- **S-76 S35:** `kvkk_sil` (S-61 aynen) bekleyen işte: iş talep ANINDA "Atlandı" + neden "Silme Talebi" → `silme_talebi` (S-68'in "teslimsiz kapanmış durum" serbestliği KALKTI: durum Atlandı);
  1 yıl dolumunda neden `saklama_suresi` (programın adı eşlenir). Ara denetimler (`kontroller.*.isler`) artık kesin. S35-01'de D'nin Meta Bekletti iletisine geç teslim (sahte Meta'da 131049'dan
  sonra aynı wamid'e `delivered`, `varis` +3 sa) Meta'nın gerçekten göndereceği bir sıra mı — sahte Meta kipi gerekir; yoksa o adım GEÇERSİZ (sürücü notu).
- **S-77 S35-a:** Gönderiliyor anında talep sırası kurulmaz (kâhin hata verir).
- **S-78 S36:** R3 uyarı penceresinde "Yine de Gönder" seçilse de kişi "Sonucu Belirsiz" ile elenmeli (`onceki: "gonder"`).
- **S-79 S37:** içeriği silinmiş Ödeme Hatırlatma işinde Başarısızları Yeniden Dene / işteki Yine de Gönder: kişi alınmalı, iletinin değişkenleri ve telefon gönderim anında karttan; iş ayrıntısında
  içerik yeniden dolu (`icerik_silindi` yok); kart telefonu silinmişse "Atlandı — Telefonsuz".
- **S-80 S38:** `tasindi` = programın "başka bilgisayara taşıma" yolu (taşıma paketi + yeni kurulumda açma); yeni bilgisayarda geri yükleme (`geri_yukle`) eski bilgisayarda alınmış yedekle. Talep
  kaydının taşındığı (yalnız şirket + cari + an) sürücüde okunabiliyorsa okunur, okunamazsa "okunamadı" (ders 4). Zincirleme taşıma (S38-02) iki kez.
- **S-81 `ayar.baglanti_yolu`:** "yol1" = Elle Bağla (kapıcı uygulama sırrını bilmez — sahte Meta'nın bildirimleri imzasız ya da doğrulanamaz imzayla gönderilir), "yol2" = WhatsApp'ı Bağla (kapıcı
  imzayı doğrular). Alan yoksa senaryo Yol 2 kipinde koşulur; GUV-05 / 06 / 09 ve öbür sahte bildirim senaryoları Yol 1 kipinde koşulursa Y17-26 gereği AYRIŞIR (beklenti Yol 2'nindir).
- **S-82 kanca `adres`:** "uygulama" = sahte Meta bildirimi WABA'nın alternatif (override) adresine değil uygulama düzeyi adrese gönderir (WABA'da alternatif adres yok — gövdesiz subscribed_apps); alan
  yoksa alternatif adres. "Meta'daki adres hemen yeniden denetlenir" (S41) kâhinde yok: sürücü isterse sahte Meta kaydında o bildirimden sonra `GET /<WABA_ID>/subscribed_apps` isteğini sayar
  (bilgi; denetim değil).
- **S-83 Ç5 / W-3 / WhatsApp küçük işler öncesi:** program S34'ü (Ç5), S35–S38'i (W-3) ya da S33 / S41'i (WhatsApp küçük işler tur 1) henüz uygulamıyorsa bu 14 senaryoda (ve değişen 4'te) ayrışma
  BEKLENİR (S-74 düzeni) — kod birleşince yeniden koşulur.

### 22.14 Kanıt ve DENENMEYEN
- **Kanıt** (`docs/kanit/2026-11-06/wk17-*`, OKU: `wk17-OKU.txt`): senaryolar **367/367** elle = model (`wk17-senaryolar`, `TZ=UTC`; `wk17-senaryolar-tz-istanbul` 367/367, `senaryolar.json` iki
  koşuda aynı sha256); kâhinin kendi testi **397/397**, F mutasyon **249/249** (`wk17-kahin`, `TZ=UTC`; `wk17-kahin-tz-istanbul` 397/397; I14 (i) Yol 1 = Yol 2 denetimi 359 senaryo);
  ilk koşunun kırmızısı (`wk17-kahin-ilk-kos-degismez-kirmizi`: 395/397 — C değişmezi, 22.10);
  eski kâhinle yeni / değişen 18 senaryo (ham iki TZ + nötr kopya); 353 eski senaryonun tam sonuç farkı; değişen 4'ün yaprak farkı; mutant matrisi; araçlar `wk17-araclar/`. Sahte Meta'ya ve sürücüye
  DOKUNULMADI (açılmadı, testleri koşulmadı).
- **DENENMEYEN:** programa karşı sürücü koşusu (görev gereği; S-75…S-83 yazılmadı); S35-a ve S33-a (KULLANICIYA SORULMALI — kâhin S35-a'da hata verir, S33-a'da eski yorum 4 sürer; senaryosuz);
  1 yıl dolumu × aynı dönem yeni gönderim (Y17-6 — S30-03'te ara denetimle, ayrı senaryo yok); S35'in Sınır / Lisans / açılışta sorulan / Hazırlanıyor yolları (S30-02 Sınır + Lisans; öbürleri aynı
  küme — senaryosuz); S34'ün Sınır / Meta Bekletti / zincir yolları (S29 senaryolarıyla aynı düzen — senaryosuz); S37'nin asıl işte yeniden basma (S16 / S22 yolu) ve zincir yeniden denemesi; S36'nın
  geç imzalı teslim sonrası (H1 / J1) ve S32 ile geri yüklemede yeniden uygulanmış hâli; S38'de taşıma + 1 yıl ve taşıma + bekleyen iş (§7a 26 Taşınan); Yol 1'de J6 yanıt katmanı ve imzasız sahte
  "failed" (Y17-26 BİLİNEN RİSK — senaryosuz); kaydı olmayan WABA'nın uygulama düzeyi adrese gelen bildirimi (Y17-27 — tanınmayan wamid düşer); "Meta'daki adres yeniden denetlenir" (kapsam dışı);
  iki şirket; 29 Şubat.

## 23. Kâhin güncellemesi 18 — S42 (S35-a), S43 (S33-a) (06.11.2026)

### 23.1 Kaynak ve bağımsızlık
Kaynak YALNIZ karar metinleri (AYNEN `kahin.KARARLAR` S42, S43 olacak): `docs/2.5.0-IS-LISTESI.md` D bölümü "KULLANICI KARARI 06.11 08:54 UTC (AYNEN: "a"; sorular C bölümünde S42–S43,
öneriyle soruldu)" satırı, aynı yerdeki "BAŞ MİMAR KARARI 06.11 08:52 (ders 40; WK 17 Y17-6 …)" satırı (S35'in "talep anında kapanır" kuralı 1 yıl dolumunda da; BİLGİ cümleleri) ve C bölümündeki
iki seçenekli soru metinleri (SORULDU 06.11 08:52 → YANITLANDI 08:54); ana oturumun görev metni (WK 18: "1 yıl dolumunda 'Gönderiliyor' iş için de aynı an (Y17-6 BAŞ MİMAR KARARI)"; "Kâhin
2.4.8'den beri böyle yorumluyorsa yalnız karar kaynağını README'ye yaz + senaryo + mutant"); önceki S30, S31, S33, S35, S36, S37, S41 kararları ve kâhinde zaten olan §7a 3 / 9 / 10 / 12–16 / 30,
R1, R3, D1, E2, E3, H1, H2, J1, J3, J4, J6, K3, K5, K6, K7, SD1837, SD1915, SW3, SW4, W1 metinleri (aynen); WhatsApp "kime kaç kez" genel ilkesi (CLAUDE.md "2.4.8 KARARLARI"; P6 §0). Okunan
başka dosya: CLAUDE.md, `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`, bu README (1–152, 226–239 ve 1427–1932. satırlar; satır numarası listesi için başlık ve kelime araması), `kahin/*`,
`docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md`, `docs/2.5.0-IS-LISTESI.md` YALNIZ C ve D bölümleri. `surucu.mjs` ve `sahte-meta/` açılmadı ve aranmadı. Program kodu (`server/`, `client/`,
`bulut/`, `tools/` — `kanit.mjs` yalnız çalıştırıldı), program testleri, `docs/kanit/` (kendi kanıtı dışında), iş listesinin A, B ve E bölümleri ve öbür ajanların raporları GÖRÜLMEDİ; git'ten
yalnız çalışma dalının ucuna (75f1aad9) geçiş (hızlı ileri birleştirme ayrışan dal yüzünden reddedildi; içi boş ajan dalı `reset --hard 75f1aad9` ile uca alındı), dal ayrışma sayıları ve son commit
iletileri (biçim için) göründü. Programa karşı KOŞULMADI. Eski kâhinle karşılaştırma git'ten değil, taban ağaçtaki (75f1aad9) `kahin/*` dosyalarının değişiklikten ÖNCE not defterine alınmış
kopyasıyla (`kahin.py` sha256 d054e986…). Bu bölümün 23.1–23.5'i kodlamadan ÖNCE yazıldı ve ayrı commit'lendi (ders 40); 23.6–23.10 kodlamadan sonra.

### 23.2 Yorumlar — S42 (S35-a) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y18-1 | **S42 tetiği**: silme talebi (`kvkk_sil`) ANINDA kişinin (aynı şirket) işi "Gönderiliyor" — istek Meta'ya gitti (POST sayıldı), program yanıtı bekliyor. Kâhinde bu aralık yalnız GECİKMELİ YANITTA vardır: J6'nın `gec_kabul`'ü ve güncelleme 18'in genel gecikmeli yanıtı (Y18-9); öbür yanıtlar istekle aynı anda işlenir (aralık sıfır). Çökme / kapatma ile "Gönderiliyor" kalan iş program kapalıyken talep alamaz, açılışta Sonucu Belirsiz olur (§6 W2) — S42'nin "yanıt yok" koluyla aynı sonuç (bilgi). **1 yıl dolumu**: BAŞ MİMAR KARARI 06.11 08:52 (Y17-6: S35'in anı 1 yıl dolumunda da) + görev metni → aynı kural, atlanma nedeni `saklama_suresi`. Kâhinde saklama süresi işin SON gönderim denemesinden başlar (Y15-13) ve Gönderiliyor işin son denemesi o anki istektir → 1 yıl dolumu canlı bir istekle aynı ana DÜŞEMEZ (kod yolu aynı; senaryosuz, kâhinin kendi testinde doğrudan birim denetimi) | S42 + Y17-6 (BAŞ MİMAR) + görev metni + Y15-13 + §6 W2 + J6 |
| Y18-2 | **"içerik ve telefon HEMEN silinir"**: talep ANINDA, yanıt beklenmeden: değişkenler, PDF (ve kâhinin PDF özeti), dosya adı, Ekstre'nin açılışta hazırlanan içeriği (J12) ve telefon (Y15-10) → `icerik_silindi: true`, içerik görünümü silinmiş; iş o an "Gönderiliyor"da KALIR (ara denetimde "Gönderiliyor"). Giden istek geri alınamaz: POST, Meta'daki ileti ve medya sayıları değişmez. Sonradan gelen kabul 24 saatlik farklı alıcı penceresinde alıcıyı işin kimliğiyle sayar (Y16-13 aynen — silme pencereyi azaltmaz) | S42 + SW3 (Y15-10) + Y16-13 |
| Y18-3 | **"isteğin sonucu ize yazılır"**: gelen yanıt, talep yokmuş gibi AYNI kurallarla işlenir ve denemeye (anonim ize — Y15-11) yazılır; işin durumunu yanıt belirler (Y18-4…6). **Kabul** → deneme "kabul" ("gönderildi" izi): iş "Meta Kabul Etti" (içerik / telefon silinmiş), sonraki imzalı bildirimler (sent / delivered / read / failed) §7a 16–18 + J1 / J3 aynen, TTL + 1 sa Süresi Doldu aynen (W1, J4); aynı dönem yeni gönderimde "Daha Önce Gönderildi" (R3 uyarısı, varsayılan Bunları Çıkar); R3 "Yine de Gönder" açık (İLKEYLE WK 15 — içeriği silinmiş kayıtta da) ve karttaki telefonla, yeni içerikle gider | S42 + R3 + SW3 (Y15-11/12) + K5 + W1 |
| Y18-4 | **"yanıt yok → Sonucu Belirsiz izi kalır, aynı dönem elenir"**: zaman aşımı (yanıtsız; Meta'nın aldığı ya da almadığı belli değil) → iş ve deneme Sonucu Belirsiz (§7a 10, §6 W2); iz S30 gibi KALIR → aynı dönem yeni gönderimde "Sonucu Belirsiz" (D1; Ödeme Hatırlatma'da aynı YEREL gün — E3), yeniden denemede K6; R3 "Yine de Gönder" bayrağı da aşmaz (E2 sırası — S36). İmzalı geç kabul / teslim gelirse H1 / J1 aynen (Y16-13 — iş Teslim, içerik silinmiş kalır, kişi "Daha Önce Gönderildi"). İşteki Yine de Gönder: Ekstre'de S31 ile kapalı (aynı dönem yol yok — S36), Ödeme Hatırlatma'da S37 ile karttan hazırlanıp gider | S42 + S30 + D1 + E2 + E3 + K6 + H1 + J1 + S31 + S36 + S37 |
| Y18-5 | **"yanıt yeniden gönderim gerektirirse iş o anda 'Atlandı — Silme Talebi'"**: yeniden gönderim gerektiren yanıt = programın AYNI işi kendiliğinden (ya da Devam Et ile) yeniden göndereceği sonuç: Meta'nın yanıt verdiği geçici hata (§7a 15 dizisi 30 sn → 2 dk → 15 dk — dizinin sonu değilse), 131056 (1 dk), 131049 (Meta Bekletti, 24 sa — §7a 14), sınır hatası / 131048 (§7a 12, 30), belirteç reddi 190 / 0 (SD1915 + SW4: bekleyenlere döner). Kâhinde: yanıt işlendikten sonra iş S30'un bekleyen kümesindeyse (Y16-9). "O ANDA" = yanıtın geldiği an: iş "Atlandı", atlanma nedeni `silme_talebi` (1 yıl dolumunda `saklama_suresi` — Y18-1); yeniden gönderim GİTMEZ (POST yok, yeni deneme yok); kuyrukta sayılmaz (S35 / Y17-8 aynen) → talepten sonra aynı dönem yeni gönderim karttaki telefonla, yeni içerikle gider. Deneme kabul edilmediği için R3'te sayılmaz (ilke 1). Yanıtla gelen 131049'da Meta iletiyi REDDETTİ (ileti Meta'da yok — bildirimle gelen 131049'dan farklı; K7 / Y17-9 düzeni yalnız Meta'da iletisi duran Meta Bekletti işinde). Bağlantı kurulamadı (R1) aynı sınıftandır ama kâhinde Gönderiliyor penceresi açmaz (bağlantı denetimi istekle aynı anda) — senaryosuz | S42 + S35 (Y17-7/8) + §7a 12–15, 30 + R1 + SD1915 + SW4 + G0 (1, 4) |
| Y18-6 | **Kesin olumsuz yanıt** (alıcı hatası 131026 / 131021 / 131009, sınıfsız ya da tanınmayan kod, hesap / şablon hatası, geçici dizinin sonu, "5 art arda" ile duran toplu işte hatayı alan iş — §7a 12, 13, 15): yeniden gönderim GEREKTİRMEZ (program kendiliğinden yeniden göndermez; "Başarısızları Yeniden Dene" kullanıcının ayrı işi) → "isteğin sonucu ize yazılır": iş ve deneme Başarısız (kesin; R3'te sayılmaz — K3), içerik / telefon silinmiş. Sonraki yol: Başarısızları Yeniden Dene — Ekstre'de S31 ile `icerik_silindi` (elenir), Ödeme Hatırlatma'da S37 ile karttan gider; yeni gönderim uyarısız gider (K3) | S42 ("yeniden gönderim gerektirirse") + §7a 12, 13, 15 + K3 + S31 + S37 |
| Y18-7 | **Yanıtın öbür etkileri AYNEN** (yalnız işin kendisi kapanır): geçici hatanın toplu iş sayacı (§7a 15 "5 art arda"), sınır hatasının WABA bloğu (aynı WABA'nın öbür işleri 24 sa — §7a 30), belirteç reddinin bağlantı Süresi Doldu'su (öbür işler Duraklatıldı, yeni gönderim başlamaz — SD1837 / SD1915), hesap / şablon hatasının toplu iş duraklaması (§7a 13), başarılı kabulün sayaç sıfırlaması. Meta'nın bildirdiği durumu (sınır doldu, belirteç geçersiz) yok saymak öbür kişilerin gönderimini Meta'ya reddettirirdi — tek okuma (bilgi) | S42 + §7a 13, 15, 30 + SD1837 / SD1915 |
| Y18-8 | **İzin tarihi**: deneme (iz) GÖNDERİM ANINDA açılır, tarihi programın o anki saatidir (K5; Y15-11 "gönderim denemesinin anı"); yanıtın geldiği an izin tarihini DEĞİŞTİRMEZ (kabulün teslim süresi J4 / W1 gereği kabul anından — gecikmeli kabulde yanıt anı, J6 aynen). Gece yarısını geçen istekte Ödeme Hatırlatma'nın "aynı gün" eşlikleri (D2 a, E3) ve R3 "son tarih" gönderim anının YEREL günüyle | S42 + K5 + Y15-11 + D2 + E3 + J6 |
| Y18-9 | **Yeni girdi (senaryo düzeneği, kural değil)**: `meta_davranis.mesaj` yanıtı `{"gec": "+10s", "yanit": Y}` — Meta'nın yanıtı programa GECİKMELİ gelir, program o süre "Gönderiliyor"da bekler; Y ∈ "kabul" (J6 `gec_kabul` ile aynı), "yanitsiz_kabul" / "yanitsiz_red" (zaman aşımı: gecikme = programın vazgeçtiği an; Meta iletiyi aldı / almadı), `{"hata": kod}`, `{"sinir": true}`; ileti Meta'da yalnız "kabul" ve "yanitsiz_kabul"da. Yanıt beklenirken J6 penceresi açıktır (tanınmayan bildirime ≤ 5 dk 503). Süreler S-19 kuralına bağlı (kabul / hata < programın zaman aşımı) — sürücü 23.9 | J6 + §6 W2 + S-19 |
| Y18-10 | **İlke denetimi (ders 45)**: (1) kesin almadıysa sayılmaz — reddedilen / yeniden gönderilmeyen istek ize "kabul" olarak girmez, Atlandı iş sayılmaz; (2) almış olabilirse elenir — yanıtsız istek belirsiz iz bırakır (S42 açık metni), tek yol işteki Yine de Gönder (Ekstre'de S36 istisnası, Ödeme Hatırlatma'da S37); (3) aldıysa aynı dönemde elenir — kabul edilen istek "gönderildi" izi; (4) çıkmaz yok — Atlandı / Başarısız kişiye yeni gönderim açık, kabul edilene R3 Yine de Gönder; (5) Y18-11. İkinci ileti yalnız kullanıcının onaylı yollarından | G0 (1)–(5) |
| Y18-11 | **Kapanış / taşıma / geri yükleme** (bilgi, senaryosuz): talepten sonra yanıt gelmeden program kapanırsa açılışta Sonucu Belirsiz (§6 W2 — "yanıt yok" ile aynı); taşımada H2 aynen (Sonucu Belirsiz). İstek sürerken alınmış bir yedek yanıt geldikten SONRA geri yüklenirse dosyadan "Gönderiliyor" ama yanıtı beklenmeyen iş döner — kâhinin modeli yok → talep ya da 1 yıl dolumu ona denk gelirse `ValueError` (KÂHİN SUSUYOR; programda aralık ~1 sn) | §6 W2 + H2 + S32 |

### 23.3 Yorumlar — S43 (S33-a) (kâhinde; her birinin kaynağı)
| # | Yorum (kâhinde) | Kaynak |
|---|---|---|
| Y18-12 | **Kâhinde ne vardı (2.4.8'den beri, §5 kâhin yorumu 4)**: "kanca yolu çalışıyor" (§7a 16) = aynı WABA'da son 7 günde imzalı ve programın TANIDIĞI bir iletiye ait kanca işlendi (`kanca_isle`: iletinin sahibi bu kurulumun Meta'ya gönderdiği bir iş). S43 = A tam bu yorumdur (soru metni: "A öneri: koymaz (kâhinin 2.4.8'den beri yorumu)") → HESAP DEĞİŞMEZ; karar kaynağı `KARARLAR` S43'e, senaryo + mutant eklenir | S43 + §5 yorum 4 + §22.9 S33-a |
| Y18-13 | **"wamid'i tanınmayan (bu kurulumun göndermediği)"**: parantez sınıfı tanımlar — bu kurulumun GÖNDERMEDİĞİ iletiye ait bildirim (aynı WABA'daki başka uygulamanın / kurulumun iletisi, uydurma wamid). Bu kurulumun gönderip yanıtı kaybolmuş (Sonucu Belirsiz) iletisinin bildirimi, wamid'i o an programda kayıtlı olmasa da iş kimliğiyle tanınır (§22.9 S33-a: "wamid ya da iş kimliği"; H1) ve TANINMAYAN sınıfına GİRMEZ → işareti koyar (§7a 16 aynen). Kararın sınırıdır (mutant: tanıma yalnız wamid kaydıyla) — ana oturum teyidi (ders 40; yeni kural değil, 2.4.8 yorumu) | S43 parantezi + §5 yorum 4 + §22.9 S33-a + H1 |
| Y18-14 | **Kapsam — iki yol**: Yol 2'de (WhatsApp'ı Bağla) tanınmayan bildirim İMZALI gelse de (Meta'nın başka bir uygulamaya / kuruluma ait bildirimi) işareti koymaz; imzasız tanınmayan zaten düşer (S33). Yol 1'de (Elle Bağla) imzasız bildirim kabul edilir (S41, Y17-26) ama tanınmayan wamid'liyse işareti koymaz → S33'ün Yol 2'de kapattığı "tanınmayan tek bildirimle Süresi Doldu → aynı dönem ikinci ileti" yolu Yol 1'de de kapalı (S43 sorusunun B'si "Yol 1'de bugünkü program davranışı") | S43 + S33 + S41 + soru metni |
| Y18-15 | **İşlenme**: tanınmayan bildirim kabul edilir (imzalıysa J6 yanıtı 200 — bekleyen yanıt yokken; yanıt beklenirken ≤ 5 dk 503, J6 aynen) ve düşer: hiçbir işin durumunu, "Bu Ay"ı, R3'ü değiştirmez (§2 "bilinmeyen wamid düşer"). S43 yalnız işareti söyler — işlenme aynen | S43 + J6 + §2 |
| Y18-16 | **İlke denetimi (ders 45)**: (2) almış olabilecek kişi (teslim bilgisi gelmeyen iş) bu kurulumla ilgisiz bir bildirim yüzünden Süresi Doldu olup aynı dönemde ikinci iletiye açılmaz; (3) kabul edilmiş iş "Daha Önce Gönderildi" kalır; (4) R3 Yine de Gönder açık | G0 (2, 3, 4) |

### 23.4 Önceki güncellemelerle çelişen yerler (yeni KARAR geçer)
- §22.9 "KULLANICIYA SORULMALI S35-a ★" → KAPANDI (S42 = A); `icerik_sil`'deki S35-a `ValueError`'ı kalkar (yerine Y18-1…8; yanıtı beklenmeyen Gönderiliyor iş KÂHİN SUSUYOR — Y18-11). Kâhinin kendi
  testi I14 (d) tersine döner (aynı girdi hesaplanır: içerik hemen silinir, gecikmeli kabul ize yazılır) → I15.
- §21.3 Y16-9 ve §22.3 Y17-11 "KAPSAM DIŞI: Gönderiliyor … (`ValueError`, senaryosuz)", §21.7 "KÂHİN SUSUYOR — modellenmedi: Gönderiliyor anında silme talebi" → KAPANDI.
- §22.13 S-77 "Gönderiliyor anında talep sırası kurulmaz (kâhin hata verir)" → geçersiz (yerine S-84).
- §22.9 "KULLANICIYA SORULMALI S33-a ★" → KAPANDI (S43 = A — kâhinin yorum 4'ü aynen; hesap değişmez).
- I14 (j) "`baglanti_yolu` yalnız S33 / S41 başlıklarında" → S43 başlığında da (I15).

### 23.5 KULLANICIYA SORULMALI / KÂHİN SUSUYOR (ana oturuma)
**Bu kararlarla KESİNLEŞEN:** S35-a (S42), S33-a (S43); WK 16'nın "Gönderiliyor anında talep" KÂHİN SUSUYOR'u.

**KULLANICIYA SORULMALI:** YOK (iki karar da tek okumaya iniyor; yeni "kime kaç kez" sorusu doğmadı).

**KÂHİN SUSUYOR — modellenmedi (`ValueError`, senaryosuz):** yanıtı beklenmeyen "Gönderiliyor" iş (yalnız istek sürerken alınmış yedeğin yanıt geldikten sonra geri yüklenmesiyle — Y18-11).

**Ana oturum teyidi (ders 40 — karar metnindeki terimin kâhindeki tanımı; plan metninden türetildi, kâhin tek okuma görüyor; BAŞ MİMAR KARARI listesinde kullanıcıya gösterilsin):** Y18-5'in
sınıfı (131049 "24 saat sonra yeniden" §7a 14, sınır hatası "pencere açılınca sürer" §7a 30, 190 / 0 "bekleyenlere döner" SD1915 — planın kendi tanımıyla yeniden gönderim; WK 17'nin S35-a A metninde de
sayılmıştı); Y18-6 (kesin olumsuz yanıt — §7a 12 / 13 / 15 "o iş Başarısız" — program yeniden göndermez → Atlandı DEĞİL Başarısız); Y18-13 (iş kimliğiyle tanınan bu kurulum iletisinin bildirimi
işareti koyar — 2.4.8 yorum 4, S43 parantezi).

**Bilgi (senaryosuz):** Y18-1 (1 yıl dolumu canlı istekle aynı ana düşmez); Y18-5 bağlantı kurulamadı (R1), 131056 ve 190 / 0 yolları (kural aynı, senaryosuz); Y18-7; Y18-11; BAŞ MİMAR KARARI 06.11 08:52'nin
BİLGİ cümleleri (Meta Bekletti işinde talep anında kapanan işin ilk iletisi sonradan teslim edilebilir; Yol 1 imzasız sahte "failed") aynen (Y17-9, Y17-26).
