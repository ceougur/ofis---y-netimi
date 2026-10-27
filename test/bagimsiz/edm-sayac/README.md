# EDM Gönderim Sayacı — Temiz Oda Kâhini (2.4.7, B1 + B2)

Bu klasör, 2.4.7'de eklenecek **EDM'nin kabul ettiği e-Belge gönderimleri sayacının** (B1) ve lisans denetimine giden
`usage` alanının (B2) bağımsız kâhinidir. Kâhin, programın kodu (server/, client/, test/ altındaki program testleri)
**görülmeden**, yalnız karar metninden yazıldı (CLAUDE.md ders 5, KANIT KURALI 2):

- CLAUDE.md → "2.4.7 KAPSAMI — EDM İŞ ORTAKLIĞI"
- `docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` §3.3 (B1, B2; C1 ve kör noktalar bağlam olarak)
- `docs/erp/2.4.7-IS-LISTESI.md` → "Nasıl bozulur?"

Metnin sustuğu ya da çelişkili olduğu her noktada kâhin **karar vermez** (ders 40, 43). Her seçenek bir parametredir;
`kabul.json` 2⁵ = 32 parametre birleşiminin hepsinin beklenen sayılarını taşır. Hangi birleşimin geçerli olduğuna
kullanıcı karar verir (aşağıda "Açık sorular").

Bağımsızlığın sınırı: model, elle yazılmış uç beklentiler ve rastgele üreticinin akış beklentisi aynı elden (bu kâhin)
çıktı. Bağımsızlık PROGRAMA göredir, kendi içinde değil. Kendi içindeki dişi mutasyon testi gösterir (aşağıda).

## Dosyalar

| Dosya | İçerik |
|---|---|
| `kahin.py` | Model (yalnız standart kütüphane) + komut satırı (`hesapla`, `karsilastir`) |
| `senaryolar.py` | 39 elle yazılmış uç senaryo (beklenen değerler ELLE) + tohum 1–3 rastgele senaryo üreticisi; `kabul.json`'u yazar |
| `kabul.json` | 42 senaryo, 3.323 olay; her senaryoda 32 birleşimin beklenen sayıları (aynı sonuç veren birleşimler grup) |
| `kahin_test.py` | Kâhinin kendi testi (A–E, G) + 42 mutasyon (F); TAP çıktısı + `# tests/pass/fail` özeti |
| `kanit/` | `tools/kanit.mjs kos` kayıtları (çıkış kodu, sayılar, ham çıktı, commit) |

## Nasıl koşulur

```sh
python3 -I test/bagimsiz/edm-sayac/senaryolar.py            # kabul.json'u yeniden üretir (model ≠ elle/üretici beklentisi → yazmaz, çıkış 1)
python3 -I test/bagimsiz/edm-sayac/senaryolar.py --belge 5000 # büyük hacimle yalnız denetim (dosya yazılmaz)
KANIT_DIR=test/bagimsiz/edm-sayac/kanit node tools/kanit.mjs kos kahin-sayac -- python3 -I test/bagimsiz/edm-sayac/kahin_test.py
python3 -I test/bagimsiz/edm-sayac/kahin.py hesapla olaylar.json --referans 2026-11-05T10:00:00+03:00 --param ay=gonderim
python3 -I test/bagimsiz/edm-sayac/kahin.py karsilastir test/bagimsiz/edm-sayac/kabul.json program.json --birlesim "ay=…;anahtar=…;e11048=…;pencere=…;geri_yukleme=…"
```

Python 3.11+ (geliştirmede 3.13). `-I` ile koşar; modüller kendi klasörlerinden açık yolla yüklenir, `__pycache__` yazılmaz.

## Kurallar (metinden alıntı)

| No | Alıntı | Modeldeki karşılığı |
|---|---|---|
| K1 | "EDM'nin KABUL ETTİĞİ gönderimler ay × tür sayılır: e-Fatura (TEMEL/TİCARİ), e-Arşiv, e-SMM." (devir §3.3 B1) | Sayılan = kabul edildiği bilinen belge; tür `efatura` / `earsiv` / `esmm` |
| K2 | "Append-only kayıt." (B1) | Sayılmış belge sayaçtan hiçbir olayla düşmez (iptal, silme dahil) |
| K3 | "Aynı ETTN + ortam BİR kez sayılır; yeniden deneme, 11048 'zaten gönderilmiş', durum sorgusu ve iptal sayıyı artırmaz." (B1) | Tekilleme anahtarı (ortam, ETTN); bu olaylar sayı eklemez |
| K4 | "Sonucu belirsiz gönderimin sonradan kesinleşmesi düşünülür." (B1) | Belirsiz sayılmaz; kabul olarak kesinleşince bir kez sayılır |
| K5 | "Test ve canlı ayrı tutulur." (B1) | Çıktı ve anahtar ortama göre ayrı |
| K6 | "Geriye dönük doldurma YOK: eski sürümler 'DestekOfis' gönderdiği için hak ediş 2.4.7 ile başlar." (B1) | Yalnız olay listesindeki (2.4.7) olaylar; `gecmis` yok sayılır |
| K7 | "Şirketler toplanır." (B1) | Çıktıda şirket yok |
| K8 | "`/v1/check` gövdesine `usage`: son 3 ayın TOPLAM sayıları (delta değil)." (B2) | `usage`: pencere aylarının mutlak sayıları + pencere toplamı |
| K9 | C1: "`lisans.edoc_usage` (makine + ay + ortam) … doğrulamalı üzerine yazma: ay YYYY-MM, negatif olmayan tam sayı" | `usage` ay × ortam × tür satırları (YYYY-MM, ≥ 0 tam sayı); ayrıca tek toplam |
| — | Kör nokta: "EDM portalından kesilen belgeler … sayılmaz." | Portal belgesi olay akışında yoktur; modelde olay türü yok |

## Varsayımlar (V1…; metnin açıkça söylemediği ama kâhinin seçtiği okuma)

- **V1** Ay, Türkiye yerel saatine (sabit UTC+3) göre takvim ayıdır. Ofsetli saat (`Z`, `+00:00`) TR saatine çevrilir; ofsetsiz saat TR
  yerel sayılır; 2017'den eski tarih girdi hatasıdır. (Metin saat dilimi söylemiyor. Görev tanımı "zaman: ISO yerel saat" diyor ve
  "ay sınırını UTC ile al"ı hata sayıyor. EDM'nin ay sonu raporunun hangi saat dilimiyle kesildiğini kullanıcı EDM'ye sorabilir.)
- **V2** "Yeniden deneme artırmaz" = aynı anahtar önceden sayıldıysa ek sayı yok. Red ya da belirsizden sonra EDM'nin kabul ettiği
  yeniden deneme SAYILIR (K1); ayı, yeniden denemenin anıdır, çünkü kabul eden istek odur (U09, U33).
- **V3** İptal ve silme sayıyı düşürmez (K2 + K3). EDM'nin iptalde kontör iade edip etmediği kullanıcının EDM'ye sorusudur (S6).
- **V4** Sonucu belirsiz gönderim kesinleşene dek sayılmaz; kesinleşmeyen belirsiz hiç sayılmaz.
- **V5** "Yetim" kesinleşme SAYILMAZ: aynı (ortam, ETTN) için olay listesinde önceden bir belirsiz deneme yoksa (2.4.6'da belirsiz kalmış belge
  ya da başka ortamın belirsizi), kesinleşme isteği eski sürümün "DestekOfis" adıyla gitmiştir (K6). Örnekler: U20, U34.
- **V6** "Gönderim anı" seçeneğinde (S1-b) EDM'nin kabul ettiği deneme, son red'den sonraki İLK belirsiz denemedir; red'den sonra belirsiz yoksa
  ilk belirsiz deneme (U16, U17, U40).
- **V7** ETTN karşılaştırması büyük/küçük harf ve baş/son boşluk duyarsızdır (ETTN bir UUID'dir). Yalnız U31 bu varsayıma bağlıdır ve öyle etiketlidir.
- **V8** Aynı saniyedeki olayların sırası: deneme (kabul/red/belirsiz/yeniden deneme) → 11048 → durum sorgusu → kesinleşme → iptal → silme/bakım;
  aynı sınıfta giriş sırası (ders 31). Giriş listesinin sırası sonucu değiştirmez (D1).
- **V9** e-Fatura TEMEL ve TİCARİ tek tür (`efatura`); `profil` sayıyı etkilemez.
- **V10** Bir belgenin türü değişmez: aynı (ortam, ETTN) iki farklı türle gelirse girdi hatasıdır.
- **V11** Sayılar referans anına kadar (anı DAHİL) olaylarla hesaplanır; `usage` pencere ayları ortam × tür için sıfırla doldurulur.
- **V12** "Son 3 ay" takvim aylarıdır. Kayan 90 gün okuması dışlandı: C1 ay başına üzerine yazar, 90 gün ise pencerenin ilk ayını kısmi gönderip
  sunucudaki sayıyı düşürür. Hangi 3 ay olduğu S5'tir.
- **V13** Kâhin uzantısı olaylar: `belge_silindi` (sayı değişmez), `yedekten_geri_yuklendi` ve `sirket_sifirlandi` (etkileri S4'e bağlı).
  Yedek tatbikatı CLAUDE.md test kuralının parçası olduğu için eklendi.
- **V14** Hatalı girdi (bilinmeyen olay türü ya da alan, eksik/boş ETTN, geçersiz ortam/tür/profil/saat, aynı ETTN iki türle) sessizce atlanmaz,
  hata verir (ders 3, 4).

## AÇIK SORULAR (kullanıcıya sorulacak; kâhin karar vermez)

Her birinin parametre adı ve seçenekleri aşağıdadır. `kabul.json` hepsini taşır. Komut satırı varsayılanı (ilk seçenek) karar değildir.

**S1 — `ay`: Belirsiz gönderim sonradan "kabul" olarak kesinleşirse hangi aya yazılır?**
- (a) `kesinlesme`: programın kabulü öğrendiği anın ayı. Geçmiş aylar hiç değişmez; gönderilmiş `usage` geriye dönük düzelmez.
- (b) `gonderim`: belirsiz gönderimin (EDM'nin isteği aldığı anın) ayı. EDM'nin ay raporuna büyük olasılıkla daha yakındır, ama geçmiş ayı sonradan
  değiştirir. Kesinleşme 3 aylık pencereden sonra olursa o ay lisans sunucusuna HİÇ ulaşmaz (U27: Ağustos belirsizi Kasım'da kesinleşir, Eylül–Kasım
  penceresinde görünmez).
- Fark yalnız belirsiz ile kesinleşme farklı aylara düştüğünde çıkar (U10, U12, U15–U17, U27, U38, U40).

**S2 — `anahtar`: "Aynı ETTN + ortam BİR kez" şirketler arasında da mı geçerli?**
- (a) `ettn_ortam` (metnin harfi): aynı ETTN iki şirkette kabul edilirse bir kez sayılır.
- (b) `sirket_ettn_ortam`: her şirket ayrı sayılır. Şirketler ayrı EDM hesaplarıysa EDM iki kontör düşer.
- ÇELİŞKİ: ana oturumun görev metni "ETTN'yi şirketsiz tekille"yi bir HATA (mutasyon) olarak sayıyordu, yani (b)'yi varsayıyordu. Karar metni ise
  (a) diyor. Aynı ETTN iki şirkette ancak veri kopyalanınca oluşur (ör. bir şirketin yedeği öbür şirkete geri yüklenince). Ek sonuç: (a)'da belirsiz →
  kesinleşme ön koşulu da şirketler arasında taşınır (yapay U35). Kâhinin "şirket toplamı" değişmezi (D4) bu yüzden U35'te geçerli değildir.

**S3 — `e11048`: Belirsiz gönderimden sonra gelen 11048 (EDM yanıtında belgenin kendi ETTN'i) kesinleşme sayılır mı?**
- (a) `saymaz` (metnin harfi: "11048 sayıyı artırmaz"): ayrı bir durum sorgusu kesinleştirmedikçe sayılmaz. EDM kontörü düştüyse eksik sayılır.
- (b) `kesinlestirir`: açık bir belirsiz varken 11048 kabulün kanıtıdır (2.4.4 kararı: "11048'de belge yalnız EDM yanıtındaki KENDİ ETTN'iyle gönderilmiş
  sayılır"). Belirsizi olmayan 11048 (ilk olay, eski sürüm, kabulden sonra) iki seçenekte de sayılmaz.
- Program 11048'i kendisi "kesinleşti kabul" olayına çeviriyorsa iki seçenek aynı sonucu verir. Olay sözlüğünün programa eşlenmesi de bu sorunun parçasıdır (U15, U38).

**S4 — `geri_yukleme`: Yedekten Geri Yükle ve Şirket Verisini Sıfırla sayacı geri alır mı?**
- (a) `etkilemez`: append-only, EDM'nin kabulü yerel veriyle geri alınmaz.
- (b) `geri_alir`: sayaç şirket verisiyle birlikte geri döner. Geri yüklenen belge yeniden gönderilince EDM 11048 der ve belge bir daha sayılmaz. Sayı,
  EDM'nin saydığından AZ olur. C1'deki üzerine yazma da sunucudaki sayıyı düşürür.
- Metin "append-only" diyor ama sayacın nerede tutulduğunu (şirket veri dosyası mı, kurulum düzeyi mi) söylemiyor (U28, U29).

**S5 — `pencere`: `usage`'deki "son 3 ay" hangi aylar?**
- (a) `icinde_dahil`: içinde bulunulan ay + önceki 2 ay.
- (b) `tamamlanan`: tamamlanmış son 3 ay (içinde bulunulan ay gönderilmez).
- Ayrıca biçim: "son 3 ayın TOPLAM sayıları" ay başına mutlak sayılar mı, tek bir 3 aylık toplam mı? Kâhin ikisini de verir (`aylik` + `toplam`).
  C1 "makine + ay + ortam" satırı ay başına sayı gerektirir.

**S6 — (kullanıcının EDM sorusu; parametre değil)** EDM reddedilen ya da iptal edilen belgenin kontörünü düşüyor mu, iade ediyor mu? Kâhin metne göre
reddi saymaz, iptali düşürmez (K1, K2, K3, V3). EDM'nin yanıtı farklıysa K1/V3 ve kâhin yeniden yazılır.

## Giriş biçimi (olay sözlüğü)

Olay listesi bir JSON dizisidir (ya da `{"olaylar": […], "referanslar": […]}`). Belge olayı:

```json
{"sirket": "001", "ortam": "live|test", "tur": "efatura|earsiv|esmm", "ettn": "<UUID>", "olay": "<tür>",
 "zaman": "2026-10-31T23:59:59+03:00", "profil": "TEMEL|TICARI (isteğe bağlı, yalnız efatura)", "not": "isteğe bağlı"}
```

| `olay` | Anlamı (programdaki karşılığı önerisi) | Sayıya etkisi |
|---|---|---|
| `gonder_kabul` | Send* isteği, EDM başarı yanıtı | İlk kabulse +1 |
| `gonder_red` | Send* isteği, EDM hata/ret yanıtı | 0 |
| `gonder_belirsiz` | Send* isteği, kesinti/zaman aşımı (Sonucu Belirsiz) | 0 (kesinleşmeyi bekler) |
| `yeniden_deneme_kabul` | Red/belirsizden sonra yeniden gönderim, EDM kabul | İlk kabulse +1 (V2) |
| `belirsiz_kesinlesti_kabul` | Durum Sorgula belirsiz belgeyi "kabul edilmiş" buldu | Önceden belirsiz varsa ve ilk kabulse +1 (V5) |
| `belirsiz_kesinlesti_red` | Durum Sorgula "bulunamadı / reddedildi" | 0 |
| `zaten_gonderilmis_11048` | Yeniden gönderimde EDM 11048 (kendi ETTN'i) | 0, ya da S3-b'de belirsiz varsa kesinleşme |
| `durum_sorgusu` | Durum Sorgula, durum değişmedi | 0 |
| `iptal` | İptal (EDM kabul etti ya da yalnız programda) | 0, düşürmez |
| `belge_silindi` | Listeden Sil / Silinenler (uzantı) | 0, düşürmez |

Bakım olayları (uzantı, ETTN'siz): `{"sirket": "001", "olay": "yedekten_geri_yuklendi", "zaman": "…", "yedek_zamani": "…"}` ve
`{"sirket": "001", "olay": "sirket_sifirlandi", "zaman": "…"}`. Senaryodaki `gecmis` dizisi 2.4.7 öncesindeki (2.4.6) belgeleri anlatır. Yalnız program
sürücüsünün başlangıç verisidir; kâhin onu bilerek yok sayar (K6).

## Çıktı biçimi (iki taraf için ortak)

```json
{"sayilar": {"2026-10|live|efatura": 3, "2026-11|test|esmm": 1},
 "usage": {"2026-11-05T10:00:00+03:00": {"aylar": ["2026-09", "2026-10", "2026-11"],
                                         "aylik": {"2026-09|live|efatura": 0, "…": 0},
                                         "toplam": {"live|efatura": 2, "live|toplam": 3, "test|toplam": 0, "…": 0}}}}
```

`sayilar` bütün olaylarla hesaplanır; sıfırlar yazılmaz. `usage`, her referans için o ana kadarki (dahil) olaylarla hesaplanır.

## Programla karşılaştırma (beklenen arayüz)

1. **Saf işlev yolu (asgari):** program tarafı, yukarıdaki olay listesini alıp aynı çıktı biçimini veren bir işlev ve sürücü sağlar (ör.
   `node <sürücü> kabul.json > program.json`). `program.json` = `{"<senaryo adı>": {"sayilar": …, "usage": {…}}}`. Sonra:
   `python3 -I kahin.py karsilastir kabul.json program.json --birlesim "<kullanıcının seçtiği birleşim>"` → TAP, çıkış 0 yalnız bütün senaryolar aynıysa.
   Eksik senaryo ya da referans BOŞ değil, FARK sayılır (ders 4). Program `toplam` vermezse kâhin `aylik`'tan türetir.
2. **Uçtan uca yol (önerilen, en az uç senaryolar için):** sürücü her olayı programın gerçek yoluna çevirir: EDM sahte taşıyıcısı istenen yanıtı verir
   (başarı / hata / zaman aşımı / 11048), saat `config.now` ile olay anına alınır (ders 13, 22), Durum Sorgula / İptal / Listeden Sil / Yedekten Geri
   Yükle / Şirket Verisini Sıfırla gerçek uçlardan çağrılır. Her referansta `/v1/check` gövdesindeki `usage` sahte lisans sunucusunda okunur
   (`HUKUK_LICENSE_URL` yerel, ders 30). Programın üretemediği olay dizileri (ör. `yapay: true` olan U35) adıyla DENENMEYEN'e yazılır, atlanmaz (ders 8).
3. Birleşim seçilmeden karşılaştırma "geçti" sayılmaz. Kullanıcı S1–S5'i yanıtlayınca tek birleşim kesinleşir.

## Senaryolar (42)

U01 tek kabul (referans tam olay anında) · U02 ay sonu 23:59:59 / ayın 1'i 00:00 · U03 UTC, +00:00 ve ofsetsiz saat · U04 yıl dönümü + aynı ay numarası
başka yıl · U05 aynı ETTN iki şirkette (S2) · U06 aynı ETTN test ve canlıda · U07 11048 ilk olay (2.4.6'da gönderilmiş) · U08 iptal sonrası yeniden
gönderim (aynı ETTN + yeni ETTN) · U09 red sonrası aynı ETTN kabul (ay sınırı) · U10 sıra karışık (ters liste) · U11 belirsiz → kesinleşti, aynı ay ·
U12 belirsiz ay sınırında kesinleşti (S1, usage) · U13 belirsiz → red · U14 belirsiz sonuçsuz · U15 belirsiz → 11048 (S3) · U16 iki belirsiz →
kesinleşme · U17 red araya girer (V6) · U18 kabul sonrası gürültü · U19 iki kullanıcı aynı saniye · U20 yetim kesinleşme / 11048 (eski sürüm) ·
U21 eski sürümde kabul edilmiş belgeye 11048/durum/iptal · U22 türler ve profiller · U23 üç şirket toplanır · U24 boş · U25 usage penceresi
(ay sonu, ayın 1'i, ayın 5'i, ay sonu öncesi; referans sonrası olay) · U27 kesinleşme pencere dışı (S1 × S5) · U28 yedekten geri yükleme
(S4; referans geri yükleme anında) · U29 şirket verisi sıfırlandı (S4) · U30 belge silindi + aynı içerikle yeni belge · U31 ETTN harf farkı (V7) ·
U32 çok gürültü (55 olay) · U33 belirsiz → yeniden deneme kabul · U34 ortam değişti (test belirsizi canlıda kesinleşmiş) · U35 şirket çapraz
kesinleşme (yapay, S2) · U36 yalnız iptal · U37 artık yıl Şubat · U38 11048 sonra kesinleşme (S1 × S3) · U39 tekrarlanan red · U40 belirsiz → red →
kesinleşme (V6) · R1–R3 tohum 1–3, her biri 500 belge (~1.050 olay), 20 akış türü, 3 şirket, iki ortam, 14 ay (2026-10 → 2028-01), ay sınırına yığılmış
gönderimler, %5 UTC yazımlı saat, aynı ETTN başka şirkette / öbür ortamda; R1 kronolojik, R2–R3 karışık sıra; 4 referans (bir olayın tam anı, ayın 1'i
00:00, rastgele an, son olay + 1 gün). Ek: C4 tohum 4, 5.000 belge (10.276 olay; dosyaya yazılmaz).

## Mutasyonlar (42; `kahin_test.py` F)

11048'i say · iptali say · iptal düşürür · durum sorgusunu say · reddi say · belirsizi hemen say · kesinleşen reddi say · kesinleşen kabulü sayma ·
tekilleme yok · yeniden denemeyi ayrıca say · ortam anahtarda yok · ortam çıktıda karışık · şirket anahtarı ters · ay UTC · gece yarısı önceki aya ·
yıl bir kez okunur · girdi sırası · yetim kesinleşmeyi say · ay seçimi ters · gönderim anı red'i görmez · 11048 seçimi ters · TİCARİ sayılmaz ·
e-Arşiv/e-Fatura karışır · şirketler toplanmaz · pencere 2 ay · pencere seçimi ters · usage delta · referans sonrası dahil · referans anı hariç ·
kayan 90 gün · geri yükleme seçimi ters · geri yükleme bütün şirketleri geri alır · silme düşürür · ETTN harf duyarlı · geriye dönük doldurma ·
ay ilk olaydan · toplam yalnız son ay · gönderim anı son belirsiz · test sayılmaz · e-SMM sayılmaz · kesinleşme ön koşulu ortamsız · 11048
belirsizsiz kesinleştirir.

Bir mutasyon, uygulanabildiği HER birleşimde `kabul.json`'dan ayrışmalıdır. Ayrıca modelden bağımsız beklentiler (elle yazılmış uç değerler +
üreticinin akış bilgisi) de yakalamalıdır. Uygulanamayan birleşimler ve gerekçeleri:
- M20 ve M38 (gönderim anı) yalnız `ay=gonderim`'de anlamlıdır. M32 yalnız `geri_yukleme=geri_alir`'de, M42 yalnız `e11048=kesinlestirir`'de.
- M28 ve M29 `pencere=tamamlanan` + `ay=kesinlesme` + `geri_yukleme=etkilemez`'de davranışı değiştiremez. Referans anı ve sonrasındaki bir kabulün ayı,
  referansın ayından küçük olamaz; o ay "tamamlanan" pencerede yoktur ve sayaçtan bir şey düşmez.

## DENENEN

- 39 uç senaryoda (175 olay) elle yazılmış beklenen = model, 32 birleşimin hepsinde. 3 rastgele senaryoda (3.148 olay) ve 5.000 belgelik ek koşuda (10.276 olay)
  üreticinin akış beklentisi = model, 32 birleşimde.
- Değişmezler:
  - D1 karışık / ters sıra
  - D2 monotonluk (14 referans)
  - D3 ortam ayrımı
  - D4 şirket toplamı
  - D5 gürültü eklemek
  - D6 usage = sayılar ∩ pencere
  - D7 bakım yoksa geri_yukleme etkisiz
  - D8 alt/üst sınır
- 16 girdi doğrulaması (15 hatalı girdi reddedilir, 1 geçerli girdi kabul edilir).
- 42 mutasyonun hepsi uygulanabildiği her birleşimde hem kabul.json'ca hem bağımsız beklentilerce yakalandı.
- Komut satırı: `hesapla` ve `karsilastir` (aynı → 0, bir sayı bozuk → 1, eksik senaryo → 1).
- Dersler: 2 (çıkış kodu + sayılar, `kanit.mjs kos`), 3/4 (hatalı/eksik veri sessizce geçmez), 5 (kod görülmedi), 7 (mutasyon), 13/22 (ay sonu,
  ayın 1'i, yıl dönümü, artık yıl, UTC tuzağı), 17 (karışık sıra, eski sürüm verisi, geri yükleme), 31 (aynı saniye sırası), 40/43 (karar yerine parametre).

## DENENMEYEN

- Program tarafı: henüz yok. Kâhin programla karşılaştırılmadı; "Programla karşılaştırma" bölümündeki sürücü yazılınca koşulur.
- Gerçek EDM'nin yanıtları ve EDM'nin kendi aylık raporuyla karşılaştırma (kullanıcıda; A3 ve ay sonu).
- `usage`'in lisans sunucusunda (C1) saklanması, doğrulanması ve Operatör Merkezi'nde (C2) gösterilmesi: bu kâhinin kapsamı dışında.
- Rastgele senaryolarda yedekten geri yükleme ve şirket sıfırlama yok; yalnız U28/U29'da deneniyor.

## BİLİNEN SINIRLAR

- Model, elle beklentiler ve üretici aynı elden. Programa göre bağımsız, kendi içinde değil. Ortak bir yanlış okuma (ör. V2, V5) üçünde birden olabilir.
  Bu yüzden varsayımlar ayrıca listelendi.
- Parametre birleşimi kullanıcı yanıtlayana dek kesin değil: tek "doğru" sayı kümesi yok, 32 küme var.
- Olay sözlüğünün programın gerçek durumlarına eşlenmesi (özellikle 11048 ↔ kesinleşme, belirsizin hangi yanıtlarda oluştuğu) program tarafının işidir.
  Eşleme yanlışsa kâhin ile program aynı yanlış girdiyle ayrışmadan geçebilir (ders 5).
- Türkiye saat dilimi sabit UTC+3 alındı. Gelecekte yaz saati dönerse V1 güncellenir.

## Program tasarımı için kör noktalar (kâhinin gördüğü; karar değil)

1. **Sayacın yeri (S4):** Sayaç şirket veri dosyasındaysa Geri Yükle / Verisini Sıfırla / yeniden kurulum sayacı düşürür. C1'in "üzerine yazma"sı da
   sunucudaki sayıyı düşürür. Sayılar düşebiliyorsa sunucu tarafında ay başına "en büyük değeri koru" düşünülebilir.
2. **Gönderim ayı seçeneği (S1-b) + 3 aylık pencere:** Pencereden sonra kesinleşen belge sunucuya hiç ulaşmaz (U27).
3. **11048 eşlemesi (S3):** Belirsiz → yeniden gönder → 11048 akışında, kesinleşme ayrıca kaydedilmezse EDM'nin düştüğü kontör sayılmaz.
4. **Ortam değişimi:** Test'te belirsiz kalan belge Entegratör Ayarları Canlı'ya alındıktan sonra sorgulanırsa hangi ortama yazılacağı (U34; kâhin: sayılmaz).
5. **Aynı ETTN iki şirkette (S2):** Yedeği öbür şirkete geri yüklemek bunu üretir. Hangi şirketin EDM hesabının kontör düştüğü belirsizdir.
