# EDM Gönderim Sayacı — Temiz Oda Kâhini (2.4.7, B1 + B2)

Bu klasör, 2.4.7'de eklenecek **EDM'nin kabul ettiği e-Belge gönderimleri sayacının** (B1) ve lisans denetimine giden
`usage` alanının (B2) bağımsız kâhinidir. Kâhin, programın kodu (server/, client/, test/ altındaki program testleri;
bu klasördeki `program-surucu.mjs` ve `fark-analiz.mjs` dahil) **görülmeden**, yalnız karar metninden yazıldı (CLAUDE.md ders 5,
KANIT KURALI 2):

- CLAUDE.md → "2.4.7 KAPSAMI — EDM İŞ ORTAKLIĞI"
- `docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` §3.3 (B1, B2; C1 ve kör noktalar bağlam olarak)
- `docs/erp/2.4.7-IS-LISTESI.md` → "Nasıl bozulur?"
- `docs/2.4.7-IS-LISTESI.md` → "KARARLAR — EDM sayacı" (S1–S5) ve "AÇIK SORU" → "KARAR" (F1, F2, sayaç defteri yedekte), 27.10.2026

Metnin sustuğu her noktada kâhin **karar vermedi** (ders 40, 43). Her seçenek bir parametre oldu, kullanıcı 27.10.2026'da seçti.
`kabul.json` 2⁵ = 32 birleşimin hepsini taşımaya devam eder (geri dönüş için). Program **seçilen birleşimle** karşılaştırılır:

```
ay=gonderim;anahtar=sirket_ettn_ortam;e11048=kesinlestirir;pencere=icinde_dahil;geri_yukleme=etkilemez
```

(`kabul.json` → `secilen_birlesim`; `kahin.py`'nin varsayılanı.)

Bağımsızlığın sınırı: model, elle yazılmış uç beklentiler ve rastgele üreticinin akış beklentisi aynı elden (bu kâhin) çıktı.
Bağımsızlık PROGRAMA göredir, kendi içinde değil. Kendi içindeki dişi mutasyon testi gösterir (aşağıda).

## Dosyalar

| Dosya | İçerik |
|---|---|
| `kahin.py` | Model (yalnız standart kütüphane) + komut satırı (`hesapla`, `karsilastir`) |
| `senaryolar.py` | 47 elle yazılmış uç senaryo (beklenen değerler ELLE) + tohum 1–3 rastgele senaryo üreticisi; `kabul.json`'u yazar |
| `kabul.json` | 50 senaryo, 3.851 olay; her senaryoda 32 birleşimin beklenen sayıları (aynı sonuç veren birleşimler grup) |
| `kahin_test.py` | Kâhinin kendi testi (A–E, G) + 52 mutasyon (F); TAP çıktısı + `# tests/pass/fail` özeti |
| `kanit/` | `tools/kanit.mjs kos` kayıtları (çıkış kodu, sayılar, ham çıktı, commit); `kanit/<gün>/kirmizi/` bilerek kırmızı kanıt |
| `program-surucu.mjs`, `fark-analiz.mjs` | Ana oturumun program tarafı (kâhin bunları OKUMAZ) |

## Nasıl koşulur

```sh
python3 -I test/bagimsiz/edm-sayac/senaryolar.py            # kabul.json'u yeniden üretir (model ≠ elle/üretici beklentisi → yazmaz, çıkış 1)
python3 -I test/bagimsiz/edm-sayac/senaryolar.py --belge 5000 # büyük hacimle yalnız denetim (dosya yazılmaz)
KANIT_DIR=test/bagimsiz/edm-sayac/kanit node tools/kanit.mjs kos kahin-sayac-y2y5 -- python3 -I test/bagimsiz/edm-sayac/kahin_test.py
python3 -I test/bagimsiz/edm-sayac/kahin.py hesapla olaylar.json --referans 2026-11-05T10:00:00+03:00
python3 -I test/bagimsiz/edm-sayac/kahin.py karsilastir test/bagimsiz/edm-sayac/kabul.json program.json   # seçilen birleşimle
```

Python 3.11+ (geliştirmede 3.13). `-I` ile koşar; modüller kendi klasörlerinden açık yolla yüklenir, `__pycache__` yazılmaz.

## Kurallar (metinden alıntı)

| No | Alıntı | Modeldeki karşılığı |
|---|---|---|
| K1 | "EDM'nin KABUL ETTİĞİ gönderimler ay × tür sayılır: e-Fatura (TEMEL/TİCARİ), e-Arşiv, e-SMM." (devir §3.3 B1) | Sayılan = kabul edildiği bilinen belge; tür `efatura` / `earsiv` / `esmm` |
| K2 | "Append-only kayıt." (B1) | Sayılmış satır hiçbir belge olayıyla (iptal, silme) düşmez |
| K3 | "Aynı ETTN + ortam BİR kez sayılır; yeniden deneme, 11048 'zaten gönderilmiş', durum sorgusu ve iptal sayıyı artırmaz." (B1) | Tekilleme anahtarı; bu olaylar sayı eklemez |
| K4 | "Sonucu belirsiz gönderimin sonradan kesinleşmesi düşünülür." (B1) | Belirsiz sayılmaz; kabul olarak kesinleşince bir kez sayılır |
| K5 | "Test ve canlı ayrı tutulur." (B1) | Çıktı ve anahtar ortama göre ayrı |
| K6 | "Geriye dönük doldurma YOK: eski sürümler 'DestekOfis' gönderdiği için hak ediş 2.4.7 ile başlar." (B1) | Yalnız olay listesindeki (2.4.7) olaylar; `gecmis` yok sayılır |
| K7 | "Şirketler toplanır." (B1) | Çıktıda şirket yok |
| K8 | "`/v1/check` gövdesine `usage`: son 3 ayın TOPLAM sayıları (delta değil)." (B2) | `usage`: pencere aylarının mutlak sayıları + pencere toplamı |
| K9 | C1: "`lisans.edoc_usage` (makine + ay + ortam) … doğrulamalı üzerine yazma: ay YYYY-MM, negatif olmayan tam sayı" | `usage` ay × ortam × tür satırları (YYYY-MM, ≥ 0 tam sayı); ayrıca tek toplam |
| K10 | F1 (KARAR 27.10): "F1 = ikinci gönderimin ayı"; soru: "belirsiz → (EDM 'bulunamadı') → yeniden gönderim yine belirsiz → sonra kabul kesinleşir … EDM ilkini bulamadığını söyledi; EDM'nin kabul ettiği istek ikincisi" | `durum_bulunamadi` önceki açık gönderim izlerini kapatır; gönderim ayı ondan SONRAKİ ilk belirsiz deneme |
| K11 | F2 (KARAR 27.10): "F2 = sayılsın, ayı ilk açık gönderim izinin ayı"; soru: "belirsiz → yeniden gönderim reddedildi ('Hata') → sonra EDM kabul gösterir" | `gonder_red` önceki açık izi KAPATMAZ; sonraki kabul sayılır, ay ilk açık iz |
| K12 | KARAR 27.10: "sayaç defterinin kopyası her şirket yedeğine girer; geri yüklemede defter yalnız BİRLEŞTİRİLİR (eksik satırlar eklenir, var olan değişmez/silinmez) — geri yükleme sayacı hiç azaltmaz, taşınan kurulum yedekten defteri geri kazanır" | `yedek_alindi` defterin kopyasını alır; `yedekten_geri_yuklendi` yalnız eksik satırları ekler; `sayac_defteri_kayboldu` defteri boşaltır |
| K13 | Y2 (KARAR 27.10, "a"): "EDM 'aldım, reddettim' dediği gönderim sayılır, sonra kabul edilen yeniden gönderim yeni sayım AÇMAZ → ay İLK gönderimin ayı" | `belirsiz_kesinlesti_red` bir kesinleşmedir (kabul gibi); ay ilk açık iz; aynı anahtara sonraki kabul eklenmez |
| K14 | Y5 (KARAR 27.10, "a"): "sayaç dosyası kaybolursa program şirket dosyalarındaki izlerden yeniden kurar (yalnız ekler, çift yok)" | Bkz. "Y5 modeli" aşağıda |
| — | Y1 (BAŞ MİMAR KARARI, kural değil senaryo): "program belirsiz belgeyi yeniden göndermeden ÖNCE hep EDM'ye sorar" | Senaryolarda belirsizden sonraki her yeniden gönderimden önce `durum_bulunamadi` var; gönderilmemiş belgede sorgu (U44) `programda_uretilemez` |
| — | S1–S5 (KARARLAR 27.10): gönderimin ayı; şirket + ETTN + ortam; kendi ETTN'li 11048 kesinleşme; geri yükleme / sıfırlama sayacı ETKİLEMEZ (sayaç şirket dosyası dışında); son 3 ay = bu ay + önceki 2, ay başına satır | Seçilen birleşim (yukarıda) |
| — | Kör nokta: "EDM portalından kesilen belgeler … sayılmaz." | Portal belgesi olay akışında yoktur; modelde olay türü yok |

## Varsayımlar (V1…; metnin açıkça söylemediği ama kâhinin seçtiği okuma)

- **V1** Ay, Türkiye yerel saatine (sabit UTC+3) göre takvim ayıdır. Ofsetli saat (`Z`, `+00:00`) TR saatine çevrilir; ofsetsiz saat TR
  yerel sayılır; 2017'den eski tarih girdi hatasıdır.
- **V2** "Yeniden deneme artırmaz" = aynı anahtar önceden sayıldıysa ek sayı yok. Red ya da belirsizden sonra EDM'nin kabul ettiği
  yeniden deneme SAYILIR (K1); ayı yeniden denemenin anıdır, çünkü kabul eden istek odur (U09, U33).
- **V3** İptal ve silme sayıyı düşürmez (K2 + K3). EDM'nin iptalde kontör iade edip etmediği kullanıcının EDM'ye sorusudur (S6).
- **V4** Sonucu belirsiz gönderim kesinleşene dek sayılmaz; kesinleşmeyen belirsiz hiç sayılmaz.
- **V5** "Yetim" kesinleşme SAYILMAZ: aynı anahtar için olay listesinde önceden bir belirsiz deneme yoksa (2.4.6'da belirsiz kalmış belge,
  başka ortamın belirsizi) kesinleşme isteği eski sürümün "DestekOfis" adıyla gitmiştir (K6). Örnekler: U20, U34.
- **V6** (kaldırıldı) Kesin redde "iz kapatır" okuması Y2 kararıyla geçersiz oldu: kesin red artık bir sayımdır (K13).
- **V6c** "Gönderim izi" her gönderim isteğidir: belirsiz, reddedilen (`gonder_red`) ve 11048 alan yeniden gönderim. İlk açık iz, son "bulunamadı"dan
  sonraki ilk istektir. Y1 ile her yeniden gönderimden önce "bulunamadı" geldiğinden F2'nin "ilk açık izi", reddedilen yeniden gönderimin kendisidir
  (U40, U43). 11048'li yeniden gönderimin ayı o gönderimdir (Y3 / F1; U15, U42).
- **V6b** "Bulunamadı"dan sonra yeni deneme olmadan EDM kabul gösterirse (geç işlenmiş belge) sayılır (K1); ay bilinen ilk belirsiz denemedir (U44).
  Karar değildir; program ayrışırsa sorulur.
- **V7** ETTN karşılaştırması büyük/küçük harf ve baş/son boşluk duyarsızdır (ETTN bir UUID'dir). Yalnız U31 buna bağlıdır.
- **V8** Aynı saniyedeki olayların sırası: deneme (kabul/red/belirsiz/yeniden deneme) → 11048 → durum sorgusu / bulunamadı → kesinleşme → iptal →
  silme/bakım; aynı sınıfta giriş sırası (ders 31). Giriş listesinin sırası sonucu değiştirmez (D1).
- **V9** e-Fatura TEMEL ve TİCARİ tek tür (`efatura`); `profil` sayıyı etkilemez.
- **V10** Bir belgenin türü değişmez: aynı (ortam, ETTN) iki farklı türle gelirse girdi hatasıdır.
- **V11** Sayılar referans anına kadar (anı DAHİL) olaylarla hesaplanır; `usage` pencere ayları ortam × tür için sıfırla doldurulur.
- **V12** "Son 3 ay" takvim aylarıdır (S5 kararı: bu ay + önceki 2, ay başına satır).
- **V13** Kâhin uzantısı olaylar: `belge_silindi` (sayı değişmez), `yedek_alindi`, `yedekten_geri_yuklendi`, `sirket_sifirlandi`, `sayac_defteri_kayboldu`
  (yedek tatbikatı; CLAUDE.md test kuralı).
- **V14** Hatalı girdi (bilinmeyen olay türü ya da alan, eksik/boş ETTN, geçersiz ortam/tür/profil/saat, aynı ETTN iki türle, şirketsiz yedek,
  şirketli defter kaybı) sessizce atlanmaz, hata verir (ders 3, 4).
- **V15** "Sayaç defterinin kopyası her şirket yedeğine girer" harfiyle okundu: yedek, defterin TAMAMINI (iki şirketin satırları) taşır. 001'in yedeği
  geri yüklenince 002'nin kaybolan satırı da geri gelir (U47). Program yalnız o şirketin satırlarını kopyalıyorsa ayrışır; o zaman sorulur.
- **V16** Gönderim izleri ve "gönderildi" izleri şirket verisinde durur, sayaç defteri onların dışındadır.
  - Geri yükleme şirket verisini yedeğin anına döndürür. Yedekte kopya varsa ona, eski yedekte (kopya yoksa) yedek anından sonrakiler silinerek döner.
  - Şirket Verisini Sıfırla izleri siler. Defter iki durumda da değişmez (S4).

### Y5 modeli (K14)

1. Her sayılan satır sayaç defterine yazılır. Aynı anda belgenin şirketi için bir "gönderildi" izine de yazılır; iz, aynı satırın kopyasıdır (ayı ve
   anı dahil).
2. `yedek_alindi` iki şeyi alır: defterin tamamını (V15) ve o şirketin izlerini.
3. `yedekten_geri_yuklendi`: önce defter birleştirilir (K12), sonra şirketin izleri yedeğin anına döner. Yedekten sonra gönderilmiş belgelerin izi
   gider; defter satırları kalır.
4. `sirket_sifirlandi`: şirketin izleri silinir.
5. `sayac_defteri_kayboldu`: defter boşalır ve hemen bütün şirketlerin izlerinden yeniden kurulur. Her iz satırı defterde yoksa eklenir (yalnız
   ekleme, çift yok); ayı izdeki aydır.
6. İzi kalmamış satır (geri yüklemeyle ya da sıfırlamayla şirketten gitmiş) yalnız defter kopyası olan bir yedeğin birleştirilmesiyle döner (U46'da E2,
   U47'de 002). Ne izi ne kopyası kalan satır geri gelmez (U46'da E3).

## Açık sorular

S1–S5 kullanıcıca karara bağlandı (27.10.2026; yukarıdaki seçilen birleşim). Kalanlar karar değil, kâhin okumasıdır; program ayrışırsa kullanıcıya
sorulacak (ders 43):

- **V6c**: Reddedilen ve 11048 alan yeniden gönderim de "gönderim izi" mi (kâhin: evet; F2 + Y1'de ay reddedilen gönderim)?
- **V6b**: "Bulunamadı" sonrası yeni deneme olmadan kabul (kâhin: sayılır, ilk belirsizin ayı). Program bu diziyi üretemez (U44, Y4).
- **V15**: Yedekteki defter kopyası tamamı mı, yalnız o şirketin satırları mı (kâhin: tamamı)?
- **S6** (kullanıcının EDM'ye sorusu): Reddedilen / iptal edilen belgede kontör düşüyor mu, iade ediliyor mu? Yanıt "iade" ise K1/V3 ve kâhin değişir.

Seçilmeyen seçeneklerin ne anlama geldiği (geri dönüş için):
- S1 `ay=kesinlesme`: kesinleşme anının ayı.
- S2 `anahtar=ettn_ortam`: aynı ETTN iki şirkette tek sayılır.
- S3 `e11048=saymaz`: 11048 hiç kesinleştirmez.
- S4 `geri_yukleme=geri_alir`: sayaç şirket verisiyle geri döner; yedek defteri varsa şirketin satırları onunla değişir.
- S5 `pencere=tamamlanan`: içinde bulunulan ay gönderilmez.

## Giriş biçimi (olay sözlüğü — program sürücüsü bunları üretir)

Olay listesi bir JSON dizisidir (ya da `{"olaylar": […], "referanslar": […]}`). Belge olayı:

```json
{"sirket": "001", "ortam": "live|test", "tur": "efatura|earsiv|esmm", "ettn": "<UUID>", "olay": "<tür>",
 "zaman": "2026-10-31T23:59:59+03:00", "profil": "TEMEL|TICARI (isteğe bağlı, yalnız efatura)", "not": "isteğe bağlı"}
```

| `olay` | Anlamı (programdaki karşılığı önerisi) | Sayıya / ize etkisi |
|---|---|---|
| `gonder_kabul` | Send* isteği, EDM başarı yanıtı | İlk kabulse +1 |
| `gonder_red` | Send* isteği (ilk ya da yeniden), EDM hata/ret yanıtı | 0; önceki açık izi KAPATMAZ, kendisi de iz (K11, V6c) |
| `gonder_belirsiz` | Send* isteği, kesinti/zaman aşımı (Sonucu Belirsiz) | 0; yeni açık iz |
| `yeniden_deneme_kabul` | Red/belirsizden sonra yeniden gönderim, EDM kabul | İlk kabulse +1 (V2) |
| `belirsiz_kesinlesti_kabul` | Durum Sorgula: belge EDM'de kabul edilmiş | Önceden belirsiz varsa ve ilk kabulse +1; ay ilk açık iz (K10, K11) |
| `belirsiz_kesinlesti_red` | Durum Sorgula: belge EDM'de bulundu, reddedilmiş ("aldım, reddettim") | Önceden belirsiz varsa ve ilk sayımsa +1; ay ilk açık iz (K13, Y2) |
| **`durum_bulunamadi`** | Durum Sorgula (yeniden gönderimden ÖNCEKİ kendiliğinden sorgu dahil): EDM "bulunamadı" | 0; açık izleri kapatır (K10) |
| `zaten_gonderilmis_11048` | Yeniden gönderimde EDM 11048 (kendi ETTN'i) | Bir gönderim izidir; belirsiz varsa kesinleşme (S3), ay bu yeniden gönderim (V6c); yoksa 0 |
| `durum_sorgusu` | Durum Sorgula, durum değişmedi | 0 |
| `iptal` | İptal (EDM kabul etti ya da yalnız programda) | 0, düşürmez |
| `belge_silindi` | Listeden Sil / Silinenler | 0, düşürmez |

Bakım olayları (ETTN'siz):

| `olay` | Biçim | Etkisi |
|---|---|---|
| **`yedek_alindi`** | `{"sirket": "001", "olay": "yedek_alindi", "zaman": "…"}` | O andaki sayaç defterinin TAMAMININ kopyası bu yedeğe girer (K12, V15) |
| `yedekten_geri_yuklendi` | `{"sirket": "001", "olay": "yedekten_geri_yuklendi", "zaman": "…", "yedek_zamani": "…"}` | `yedek_zamani` = aynı şirketin bir `yedek_alindi` anı ise defter BİRLEŞTİRİLİR (eksik satır eklenir, var olan değişmez, silme yok). Eşleşen `yedek_alindi` yoksa (2.4.7 öncesi yedek) hiçbir şey olmaz |
| `sirket_sifirlandi` | `{"sirket": "001", "olay": "sirket_sifirlandi", "zaman": "…"}` | Sayaç etkilenmez (S4) |
| **`sayac_defteri_kayboldu`** | `{"olay": "sayac_defteri_kayboldu", "zaman": "…"}` (şirket alanı YOK) | Kurulumda sayaç defteri yok (yeni kurulum / taşıma): defter boşalır ve şirketlerdeki izlerden HEMEN yeniden kurulur (K14) |

Senaryodaki `gecmis` dizisi 2.4.7 öncesindeki (2.4.6) belgeleri anlatır. Yalnız program sürücüsünün başlangıç verisidir; kâhin onu
bilerek yok sayar (K6).

## Çıktı biçimi (iki taraf için ortak)

```json
{"sayilar": {"2026-10|live|efatura": 3, "2026-11|test|esmm": 1},
 "usage": {"2026-11-05T10:00:00+03:00": {"aylar": ["2026-09", "2026-10", "2026-11"],
                                         "aylik": {"2026-09|live|efatura": 0, "…": 0},
                                         "toplam": {"live|efatura": 2, "live|toplam": 3, "test|toplam": 0, "…": 0}}}}
```

`sayilar` bütün olaylarla hesaplanır; sıfırlar yazılmaz. `usage` her referans için o ana kadarki (dahil) olaylarla hesaplanır.

## Programla karşılaştırma (beklenen arayüz)

1. **Saf işlev yolu:** program tarafı olay listesini alıp aynı çıktı biçimini verir. `program.json` = `{"<senaryo adı>": {"sayilar": …, "usage": {…}}}`.
   Sonra `python3 -I kahin.py karsilastir kabul.json program.json` (varsayılan birleşim seçilendir) → TAP; çıkış 0 yalnız bütün senaryolar aynıysa.
   Eksik senaryo ya da referans FARK sayılır (ders 4). Program `toplam` vermezse kâhin `aylik`'tan türetir.
2. **Uçtan uca yol (önerilen):** sürücü her olayı programın gerçek yoluna çevirir. Program bir yeniden gönderimden önce kendiliğinden Durum
   Sorgula yapıyor ve sahte EDM "bulunamadı" diyorsa, bu ayrı bir `durum_bulunamadi` olayıdır. Senaryoda bu olay YOKSA sahte EDM o sorguda
   "bulunamadı" dememelidir (U16: iki belirsiz arasında bulunamadı yok → ay ilk deneme). Yedek / geri yükleme / defter kaybı programın gerçek yedek ve
   kurulum yollarıyla, saat `config.now` ile olay anında, `usage` sahte lisans sunucusunda (`HUKUK_LICENSE_URL` yerel, ders 30) okunur. Programın
   üretemediği diziler `programda_uretilemez: true` (U35, U44, U48) adıyla DENENMEYEN'e yazılır, atlanmaz (ders 8).

## Senaryolar (50)

- U01 tek kabul (referans tam olay anında) · U02 ay sonu 23:59:59 / ayın 1'i 00:00 · U03 UTC, +00:00 ve ofsetsiz saat · U04 yıl dönümü + aynı ay
  numarası başka yıl · U05 aynı ETTN iki şirkette · U06 aynı ETTN test ve canlıda · U07 11048 ilk olay (2.4.6'da gönderilmiş) · U08 iptal sonrası
  yeniden gönderim · U09 red sonrası aynı ETTN kabul · U10 sıra karışık
- U11 belirsiz → kesinleşti, aynı ay · U12 belirsiz ay sınırında kesinleşti · U13 **Y2** belirsiz → kesin red (sayılır) · U14 belirsiz sonuçsuz · U15 belirsiz → 11048 ·
  U16 iki belirsiz → kesinleşme · U17 **Y2** kesin red sonra kabul (yeni sayım yok) · U18 kabul sonrası gürültü · U19 iki kullanıcı aynı saniye · U20 yetim kesinleşme / 11048
- U21 eski sürümde kabul edilmiş belge · U22 türler ve profiller · U23 üç şirket toplanır · U24 boş · U25 usage penceresi · U27 kesinleşme pencere
  dışı · U28 yedekten geri yükleme · U29 şirket verisi sıfırlandı · U30 belge silindi + yeni belge · U31 ETTN harf farkı (V7)
- U32 çok gürültü · U33 belirsiz → yeniden deneme kabul · U34 ortam değişti · U35 şirket çapraz kesinleşme (yapay) · U36 yalnız iptal · U37 artık yıl ·
  U38 11048 sonra kesinleşme · U39 tekrarlanan red · U40 **F2** belirsiz → red → kabul
- **U41 F1** belirsiz → bulunamadı → yeniden belirsiz → kabul (Ekim / Kasım / Aralık ayrışır; usage) · **U42 F1 + 11048** · **U43 F2** belirsiz → red →
  belirsiz → kabul (ay ilk açık iz) · U44 bulunamadı sonrası yeni deneme olmadan kabul (V6b; programda üretilemez) · U45 bulunamadı → iptal (sayılmaz)
- **U46 Y5 + K12** (geri yükleme izleri götürür, defter kaybı izlerden yeniden kurulur, izi olmayan satır yedekten döner; sayı 1 → 3 → 4, geri yükleme hiç azaltmaz; 5 referans) ·
  U47 sıfırlanan şirketin satırı yalnız öbür şirketin yedeğinden döner (V15, K14) · U48 eski yedek + birleştirme var olanı değiştirmez (yapay)
- R1–R3 tohum 1–3, her biri 500 belge, 24 akış türü (F1, F1 + 11048, F2, bulunamadı → iptal dahil), 3 şirket, iki ortam, 14 ay, ay sınırına yığılmış
  gönderimler, %5 UTC yazımlı saat, aynı ETTN başka şirkette / öbür ortamda; R1 kronolojik, R2–R3 karışık; 4 referans. Ek: C4 tohum 4, 5.000 belge
  (11.304 olay; dosyaya yazılmaz).

## Mutasyonlar (52; `kahin_test.py` F)

M01–M42 (26.10): 11048'i say, iptali say, iptal düşürür, durum sorgusunu say, reddi say, belirsizi hemen say, kesin reddi sayma (Y2 ters, M07), kesin kabulü sayma, tekilleme
yok, yeniden denemeyi ayrıca say, ortam anahtarda yok, ortam çıktıda karışık, şirket anahtarı ters, ay UTC, gece yarısı önceki aya, yıl bir kez okunur,
girdi sırası, yetim kesinleşmeyi say, ay seçimi ters, gönderim anı kapanışı görmez, 11048 seçimi ters, TİCARİ sayılmaz, e-Arşiv/e-Fatura karışır,
şirketler toplanmaz, pencere 2 ay, pencere seçimi ters, usage delta, referans sonrası dahil, referans anı hariç, kayan 90 gün, geri yükleme seçimi ters,
geri yükleme bütün şirketleri geri alır, silme düşürür, ETTN harf duyarlı, geriye dönük doldurma, ay ilk olaydan, toplam yalnız son ay, gönderim anı son
belirsiz, test sayılmaz, e-SMM sayılmaz, kesinleşme ön koşulu ortamsız, 11048 belirsizsiz kesinleştirir.

Y2/Y5 (27.10, "a"):
- M07 Y2 ters: kesin red sayım açmaz. Eski M07 "kesin reddi say" Y2 ile doğru davranış oldu ve tersine çevrildi.
- M52 Y5 ters: kaybolan defter izlerden yeniden kurulmaz.

M50 artık yalnız `geri_yukleme=etkilemez`'de uygulanır: `geri_alir`'de defter izlerle birlikte döndüğü için kayıp + yeniden kurma defteri değiştirmez.

M43–M51 (27.10 kararları):
- M43 F1 ters: "bulunamadı" izi kapatmaz.
- M44 F2 ters: red sonrası kabul sayılmaz.
- M45 F2 ters: red izi kapatır, yani eski kâhin okuması.
- M46 geri yükleme defteri birleştirmez.
- M47 geri yükleme defteri yedekle değiştirir (azaltır).
- M48 birleştirme var olanı ezer.
- M49 birleştirme yalnız o şirketin satırları (V15 tersi).
- M50 defter kaybı yok sayılır.
- M51 "bulunamadı" kabul sayılır.

Bir mutasyon, uygulanabildiği HER birleşimde `kabul.json`'dan ayrışmalıdır. Modelden bağımsız beklentiler (elle + üretici) de yakalamalıdır.
Uygulanamayan birleşimler:
- M20, M38, M43, M45 yalnız `ay=gonderim`'de anlamlıdır.
- M32 yalnız `geri_yukleme=geri_alir`'de, M46–M49 yalnız `geri_yukleme=etkilemez`'de, M42 yalnız `e11048=kesinlestirir`'de anlamlıdır.
- M28 ve M29, `pencere=tamamlanan` + `ay=kesinlesme` + `geri_yukleme=etkilemez` birleşiminde davranışı değiştiremez: referans anı ve sonrasındaki bir
  kabulün ayı "tamamlanan" pencerede yoktur ve defterden bir şey düşmez.

## DENENEN

- 47 uç senaryoda elle yazılmış beklenen = model, 32 birleşimin hepsinde. 3 rastgele senaryoda ve 5.000 belgelik ek koşuda (11.304 olay) üreticinin akış
  beklentisi = model, 32 birleşimde.
- Değişmezler:
  - D1 karışık / ters sıra
  - D2 monotonluk
  - D3 ortam ayrımı
  - D4 şirket toplamı
  - D5 gürültü
  - D6 usage = sayılar ∩ pencere
  - D7 bakım yoksa geri_yukleme etkisiz; bakımlıda geri_alir toplamı ≤ etkilemez toplamı
  - D8 alt/üst sınır
- 19 girdi doğrulaması (18 hatalı girdi reddedilir, 1 geçerli girdi kabul edilir).
- 52 mutasyonun hepsi uygulanabildiği her birleşimde hem kabul.json'ca hem bağımsız beklentilerce yakalandı.
- Komut satırı: `hesapla` ve `karsilastir`.
- Dersler: 2, 3/4, 5, 6 (D4/D7 değişmez farkları yeniden üretildi, kök nedeni yazıldı), 7 (mutasyon + `kanit/…/kirmizi`), 13/22, 17, 31, 40/43.

## DENENMEYEN

- Program tarafıyla bu sürümün (K10–K12) karşılaştırması: ana oturumda, `program-surucu.mjs` güncellenince.
- Gerçek EDM'nin yanıtları ve EDM'nin aylık raporuyla karşılaştırma (kullanıcıda; A3 ve ay sonu).
- C1 (sunucuda saklama), C2 (Operatör Merkezi): bu kâhinin kapsamı dışında.
- Rastgele senaryolarda yedek / geri yükleme / defter kaybı yok; yalnız U28, U29, U46–U48'de.

## BİLİNEN SINIRLAR

- Model, elle beklentiler ve üretici aynı elden. Programa göre bağımsız, kendi içinde değil. V6, V6b, V15 ve V16 ortak okumadır.
- K12 gereği, son yedekten sonra yazılıp defterle birlikte kaybolan satır geri gelmez (U46'da E3). Hak ediş eksik kalır; kurulum taşınmadan önce yedek
  almak bunu önler.
- Olay sözlüğünün programın gerçek durumlarına eşlenmesi program tarafının işidir. Özellikle şu iki ayrım: yeniden gönderimden önceki kendiliğinden
  sorgunun `durum_bulunamadi` olarak yazılması ve "bulunamadı" ile "kesin red"in ayrılması. Eşleme yanlışsa kâhin ile program aynı yanlış girdiyle
  ayrışmadan geçebilir (ders 5).
- Türkiye saat dilimi sabit UTC+3 alındı.
