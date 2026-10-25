# Bağımsız MALİYET HESAP KARTI kâhini (2.4.6 madde 0c)

Dil: **`destekofis-maliyet/1`** · Yazıldığı gün: 25.10.2026 · Kâhin: `kahin.py` (Python 3, yalnız standart kütüphane, `python3 -I`) ·
Üretici: `uretici.py` → `kabul.json` · Koşucu: `kos.py` · Kendi testi: `test_kahin.py` · Excel denetimi (yalnız yerel): `excel_denetle.py`.
Windows'ta `python3` yerine `python` (ya da `py -3`); betikler çıktıyı UTF-8'e kendileri ayarlar.

## 0. Temiz oda

- **Okunan tek hesap kaynağı:** not defterindeki `dusakabin-analiz/FORMUL-TABLOSU.md` (müşteri Excel'inden FİYATSIZ çıkarılmış düzen: sekme,
  kart, malzeme adı, birim, hücre adresi, işlem türü, oran, bölen, kaynak hücre, fark sembolü Δn). Ayrıca kurallar için: CLAUDE.md (anayasa,
  dersler), `docs/2.4.6-IS-LISTESI.md` madde 0c, ana oturumun görev iletisindeki kullanıcı kararları (boş yapı; oran/bölen hazır ve değişir;
  işlem sırası sabit; eklenen satır yalnız satır kuralına; tutarsızlıklar AYNEN; ara değer yuvarlanmaz; etiket ile oran ayrı; modül hiçbir yere
  bağlanmaz).
- **Okunmayanlar:** `server/**`, `client/**` (program henüz yazılmadı; yazılsa da bakılmaz), not defterindeki `RAPOR.md`, `excel-hucreler.txt`,
  `kahin-ciftleri.json`, `girdi/`, `betik2/OZEL-*` (müşteri verisi). Bu klasörde müşteri fiyatı, miktarı, fark tutarı, firma adı YOK; bütün sayılar
  tohumlu üreticinin türettiği değerlerdir.
- **Aynı el yasağı (ders 5):** program geliştiricisi `kahin.py` şablonunu ve `kabul.json`'u KAYNAK olarak kullanmaz; programın şablonu FORMÜL
  TABLOSU'ndan ayrı yazılır. Program tarafına verilecek tek şey bu belgenin §6 sözleşmesidir.
- Kâhin cari / kasa / stok / fatura / defter DENETLEMEZ (modül hiçbir yere bağlı değil; bağsızlık madde 5'in kaynak tarayan testinde).

## 1. Komutlar

| Komut | Ne yapar | Son satır / çıkış |
|---|---|---|
| `python3 -I test/bagimsiz/maliyet/test_kahin.py` | kâhinin kendi testi (§8) | `N/M denetim geçti`; 0 yalnız hepsi geçerse |
| `python3 -I test/bagimsiz/maliyet/kos.py [-- <uyarlayıcı>]` | programı kabul dosyasıyla karşılaştırır (§6–§7) | 0 fark yok · 1 fark var · **3 BELİRSİZ** |
| `python3 -I test/bagimsiz/maliyet/uretici.py [--tohum 1-3] [--cikti -]` | `kabul.json`'u yeniden üretir (aynı tohum → aynı dosya) | dosya + senaryo sayısı |
| `python3 -I test/bagimsiz/maliyet/excel_denetle.py <hucreler.json>` | kâhini müşterinin Excel'inin kendi değerleriyle karşılaştırır (§9, yalnız yerel) | `N/M denetim geçti`; 3 okunamadı |

`kos.py` uyarlayıcıyı şu sırayla arar: `--` sonrasındaki komut → `MALIYET_UYARLAYICI` (komut dizgesi) → bu klasörde `uyarlayici.mjs` (`node` ile).
Hiçbiri yoksa **"BELİRSİZ — program yok"** yazar, çıkış 3, "denetim geçti" satırı yazmaz (ders 4). `tools/kanit.mjs kos` bu çıktıyı
"özet satırı tanınmadı" diye BAŞARISIZ sayar; asla GEÇTİ saymaz. npm betiği ve CI adımı ana oturumun işi
(`test/ci-kapi-listesi.test.mjs` her `test:kahin-*` betiğinin bir iş akışında koşmasını ister; program yokken kapıya konursa kırmızı olur).

## 2. Şablon (FORMÜL TABLOSU §2–§4'ten; `kahin.py` §1)

| Sekme kodu | Excel sırası | Kartlar (kod → tür) |
|---|---|---|
| `cam` | 1 | `cam/100x100-oval-kabin`, `cam/100x100-kose-kabin`, `cam/170-2s2c-h182`, `cam/130-1s1c-h182-kabin`, `cam/130-1s2c-h182-kabin` → zincir |
| `liste-1` | 2 | 6 matris: `seri-2-sabit-2-acilir`, `1-sabit-1-calisir`, `seri-kose-girisli`, `1-sabit-2-calisir`, `seri-oval-2-sabit-4-calisir`, `seri-yan-panel`; bilgi: `katlanir-kapi`, `fark-satirlari` |
| `mika` | 3 | `mika/100x100-oval-kabin`, `mika/100x100-kose-kabin`, `mika/170-2s2c-h182`, `mika/150-1s1c-h182-kabin`, `mika/120-1s2c-h182-kabin`, `mika/80-lik-yan-panel` → zincir; `mika/profil-agirliklari` → gramaj |
| `liste-2` | 4 | aynı 6 matris kodu (`liste-2/…`); bilgi: `fark-satirlari`, `montaj-satirlari` |

Kart adları yazım düzeninde (her sözcük büyük, ölçü/kod aynen: "100X100 Köşe Kabin", "170 2S2Ç H:182"); sekme ve kart adında marka ve yıl yok.
Şablonun formül sayımı tablonun §1'iyle aynı: cam 59, liste-1 186, mika 95, liste-2 214 = **554** (kalıp başına da aynı; `test_kahin.py` B).

**Zincir kartı** (10 maliyet kartı + yan panel). Satır: `tutar = miktar × fiyat` (CAM `=Miktar*Fiyat`, MİKA `=Fiyat*Miktar`). Adımlar SABİT sırayla:

| Kod | İşlem | Excel kalıbı | Kart başına değer (hazır gelir, değiştirilebilir) |
|---|---|---|---|
| `ara` | toplam | `=SUM(E2:E9)` (yan panel `=SUM(E33,E34,E35,E36)`) | — |
| `yuzde` | yüzde | `=ARA*p/100` → (ARA × p) / 100 | CAM 18 (etiket "KDV/18"); MİKA 11 / 11 / 13 / 17 / 16 ("Masraf%"); yan panel 15 ("Masraf") |
| `toplama` | toplama | `=ARA+yüzde` | etiket yok (yan panel "Genel") |
| `yuzde_ekle` | yüzde ekle | `=T*q/100+T` → ((T × q) / 100) + T | CAM 20 ("%20 Maliyet"); MİKA 15 ("%15 Maliyet"); yan panel **15, etiket "%20 Maliyet"** (tutarsızlık 11) |
| `bolme` | sabite bölme | `=Y/k` | CAM 200 / 200 / 170 / **120** (130'luk kart, tutarsızlık 1); MİKA 200 / 200 / 170 / **120** (150'lik kart, 2) / 120 |
| `cm_elle` | elle girdi | — | yalnız `cam/130-1s2c-h182-kabin` (H25, tutarsızlık 4): hiçbir adıma girmez; kartın `sonuc`u `yuzde_ekle` (K27) |

Yan panelde bölme yok; `sonuc` = `yuzde_ekle`. Öbür kartlarda `sonuc` = `bolme`.

**Gramaj** (`mika/profil-agirliklari`, 13 satır): `giden_kg = boy × br_gramaj` (R = O×P), `satir_top = alis_ft × giden_kg` (T = S×R);
`toplam.giden_kg` ve `toplam.satir_top` satırların toplamı. 1. satır ("Arka Sabit", R20) `giden_kg` ELLE girdidir (tutarsızlık 6); `giden_mt`
hiçbir hesaba girmez (22).

**Matris** (12 bayi fiyat listesi): hücre ya TABAN (girdi) ya `kaynak hücre + hücrenin farkı` (aynı matristen: aynı satırın başka sütunu,
bir üst satır ya da ilk satır). 2024 (`liste-1`): taban yalnız ilk satırın ilk hücresi; taban sütunu çoğunlukla ilk satıra (çapa), 2 Sabit 2
Açılır B7 ve 1 Sabit 2 Çalışır H20:H23 bir üst satıra bağlı (21); siyah C/I sütunu bazı matrislerde ilk satır Δ1 sonra Δ5 (13); tesettür E/K =
parlak + Δ3 (12); Yan Panel parlak = taban + Δ6 (14). 2019 (`liste-2`): her sütun kendi zinciri (bir üst satır + Δ1, Yan Panel Δ2); elle
yazılmış I5, H15:K15, B30 TABAN olarak gelir (7–9). Δ sembolleri yalnız "Excel'de aynı sayıydı" bilgisidir (K2).

**Bilgi** kartları (fark / montaj satırları, katlanır kapı metin bloğu): değerleri boş gelir, hiçbir hesaba bağlı değil (15, 23).

## 3. Hesap kuralları (özet)

Boş hücre 0 sayılır (V1); ara değerler yuvarlanmaz (V3); işlem sırası Excel'deki gibi soldan sağa (V5); eklenen satır kartın satır kuralına girer
(V6); silinen satır hiçbir toplama girmez (V7); ad hesaba girmez (V8); oran, bölen ve fiyat kart başınadır, sekmede ortak değildir (V10).
Bölen 0 ya da boş → K1.

## 4. Kabul dosyası (`kabul.json`)

```
{"dil": "destekofis-maliyet/1", "tohumlar": [1, 2, 3], "uretici": "...",
 "senaryolar": [ {"kimlik", "aile", "katman": "api"|"arayuz", "karar"?, "gerektirir"?, "aciklama"?, "adimlar": [...],
                  "beklenen": {"*" | "<seçenek>": [adım başına beklenen sonuç]}} ]}
```
Satır başına bir senaryo (git farkı okunur). `beklenen` karar gerektirmeyen senaryoda `"*"`; `karar` varsa her seçeneğin ayrı listesi
(`"ret"`, `"tanimsiz"`). Okuma adımının beklenen sonucu kart başına `{"goruntu", "kumeler", "kullanici", "ilk_oku"}`: `goruntu` şablonun varsayılan
adları ÇIKARILMIŞ görüntüdür (girdi + her ara adım + sonuç); `kullanici` kullanıcının ✎ ile yazdığı ad yolları; `ilk_oku` bu kartın ilk okunduğu adım.

**Sayılar (tohum 1–3):** 391 senaryo (api 366, arayüz 25; K1 kararlı 18, K2 hücre başına 12), 8.578 adım, 558 okuma adımı, **659 okuma × kart çifti**;
kâhin kendisiyle karşılaştırılınca 45.540 denetim (iki K1 seçeneği dahil).

## 5. Senaryo aileleri ve "nasıl bozulur?" listesi

| Aile (adet) | Ne dener |
|---|---|
| `bos` (25) | boş yapı: hesaplanan her değer 0, girdiler boş |
| `tek-satir` (12), `dolu` (36), `yari-bos` (11), `sekme` (2) | tek satır; bütün satırlar (3 tohum); yalnız miktar / yalnız fiyat; bütün sekme |
| `satir-ekle` (12), `satir-sil` (23) | ekle (adlı / adsız); sil (şablon ve eklenen satır, hepsini sil + yeniden ekle) |
| `sil-ayni-adla-ekle` (11) | **sil + aynı adla yeniden aç**: eski satırın değeri dönmez |
| `ad-degistir` (24) | **ad/kod değiştir**: kart, malzeme (iki satıra aynı ad), adım etiketi, birim, matris sütun / ölçü adı → sayılar aynı |
| `oran-degistir` (22), `bolen-degistir` (9), `bolen-sifir` (18, K1) | oran / bölen değişir, etiket değişmez; oran 0; bölen 0 ve boş |
| `negatif`, `ondalik`, `buyuk` (12'şer) | Excel gibi hesap; 6–9 basamak; 15 anlamlı basamak (tamsayı kuruş taşması) |
| `kaydet-yeniden-ac` (24), `yeniden-baslat` (3) | Kaydet → yeniden aç aynı; **yarıda kesilme**: program yeniden başlayınca son Kaydet |
| `elle` (4), `giden-mt` (1) | elle hücreler bağımsız (H25, R20, I5, H15:K15, B30); Giden Mt hesaba girmez |
| `taban` (12), `sembol` (24), `hucre-basina` (12, K2), `uc-degerler` (12), `taban-degistir` (12), `fark-degistir` (12) | fiyat listesi: boş fark = 0, sembol tutarlı farklar, hücre başına fark, uç değerler, taban / fark değişince bağlı hücreler |
| `bilgi` (2) | fark / montaj / katlanır kapı satırına yazmak hiçbir matrisi değiştirmez |
| `yalitim` (6) | **sıra / ortak hücre**: bir kartın oranı, böleni, aynı adlı malzemesinin fiyatı öbür kartları değiştirmez |
| `canli`, `cik` (arayüz, 25) | Kaydet'ten önce canlı hesap; değişiklikle Çık → soru; Kaydetmeden Çık → son kayıt; değişmemiş kartta soru YOK; kaydedilmeyen ✎ ad döner |
| `sablon` (1) | sekme / kart kodları, adım sırası, oran / bölen, elle hücreler, matris hücre kuralları, adlarda marka / yıl yok |

"İki kişi aynı anda" ve "eski sürümden gelen veri" bu kâhinde YOK (§13 DENENMEYEN).

## 6. Arayüz sözleşmesi (programın uyması gereken; uyarlayıcı sonradan yazılır)

### 6.1 Çağrı
`kos.py` uyarlayıcının **standart girdisine** `{"dil": "destekofis-maliyet/1", "senaryolar": [ {kimlik, aile, katman, adimlar, karar?, gerektirir?} ]}`
verir (beklenenler çıkarılmış). Uyarlayıcı **standart çıktıya** şunu yazar, çıkış 0 (standart hata serbest günlük):
```
{"dil": "destekofis-maliyet/1",
 "uyarlayici": {"ad": "...", "program_surumu": "2.4.6", "commit": "<sha>"},
 "beyan": {"katmanlar": ["api"] | ["api", "arayuz"], "K-BOLEN-0": "ret" | "tanimsiz", "K-FARK": "hucre" | "sembol",
           "bos_sifir_sayilir": false, "gosterim_basamak": null},
 "sonuclar": [ {"kimlik": "<senaryo>", "adimlar": [ <adım sonucu>, … (senaryonun adım sayısı kadar) ]} ]}
```
- Uyarlayıcı beklenen değer HESAPLAMAZ; yalnız programın döndürdüğünü / gösterdiğini okur. Her senaryo **boş şablonlu temiz şirkette**
  (sektör "Duşakabin Üretimi" seçili) başlar. Programı ayrı süreçte açan uyarlayıcı `HUKUK_LICENSE_URL=http://127.0.0.1:9` verir (ders 30).
- `beyan`daki kararlar (K1, K2) ürün sahibinin / baş mimarın kararından yazılır; beyan edilmeyen karar senaryoları KOŞULMAZ → BELİRSİZ.
- `ad: "kahin-sahte"` kâhinin kendisidir (`test_kahin.py`); koşucu onu yalnız `--kendi-testi` ile kabul eder.

### 6.2 Kimlikler
Sekme ve kart kodları §2'deki gibi. Şablon satırları Excel sırasıyla `s1…sN`; eklenen satır senaryonun verdiği kimlik (`e1`, `e2`…; uyarlayıcı
programın kimliğiyle eşler). Programın şablonunda adsız BOŞ satır varsa (Excel'in 9. / 23. satırı gibi) uyarlayıcı ona `bos1`, `bos2`… der; boş
kaldıkça karşılaştırmada yok sayılır. Adım kodları `ara`, `yuzde`, `toplama`, `yuzde_ekle`, `bolme`, `cm_elle`. Matris hücresi `r<satır>c<sütun>`:
satır = ölçü satırının sırası (1'den), sütun 1–4 = fiyat sütunları (ölçü sütunu sayılmaz). Matris satırı `r<n>`, sütun `c<n>`; bilgi satırı `b<n>`.

### 6.3 Adımlar ve adım sonucu
Adım sonucu: `{"durum": "tamam" | "ret" | "hata", "neden"?: "...", "soru"?: bool, "kartlar"?: {...}, "sablon"?: {...}}`. `ret` = program isteği
reddetti (doğrulama iletisi `neden`e); beklenmeyen `ret` FARKTIR (ders 3).

| `islem` | Alanlar | Anlamı |
|---|---|---|
| `ac` | — | Maliyet Hesap Kartı penceresini aç (kayıtlı hâl) |
| `kaydet` | — | penceredeki bütün kartları kaydet (altta **Kaydet**) |
| `cik` | `yanit`?: `kaydet` / `kaydetme` | **Çık**; kaydedilmemiş değişiklik varsa program sorar, uyarlayıcı `yanit`ı verir; sonuçta `soru` (sorudu mu) ZORUNLU. Beklenmeyen soruda uyarlayıcı "Kaydetmeden Çık" der, `soru: true` yazar ve standart hataya nedenini yazar (ders 34) |
| `yeniden_ac` | — | kaydedilmiş pencereyi kapatıp yeniden aç (API'de yeniden oku) |
| `yeniden_baslat` | — | programı (sunucuyu) kapatıp aç; pencere kapanır |
| `oku` | `kartlar`: [kod] | kartların o anki görüntüsü (§6.4); pencere açıksa ekrandaki / taslak, kapalıysa kayıtlı |
| `sablon_oku` | — | şablonun normal biçimi (§6.5) |
| `satir_yaz` | `kart`, `satir`, `alanlar` | zincir: `miktar`, `fiyat`, `ad`, `birim`; gramaj: `giden_mt`, `boy`, `br_gramaj`, `alis_ft`, `parca`, `cins`, elle satırda `giden_kg`. Değer `null` = hücreyi boşalt |
| `satir_ekle` | `kart`, `satir`, `alanlar`? | yeni satır (zincir / gramaj); eklenen gramaj satırında `giden_kg` hesaplanır |
| `satir_sil` | `kart`, `satir` | satırı sil |
| `ad_degistir` | `kart`, `hedef`: `kart` / `satir` / `adim` / `sutun` / `olcu`, `kimlik`?, `ad` | ✎ ile ad (zincirde malzeme adı, gramajda parça adı, bilgide satır adı; `adim` = etiket) |
| `oran_degistir` | `kart`, `adim`: `yuzde` / `yuzde_ekle`, `oran` | oranı değiştir (etiket değişmez) |
| `bolen_degistir` | `kart`, `bolen` | böleni değiştir (`0` ya da `null` → K1) |
| `elle_yaz` | `kart`, `adim`: `cm_elle`, `deger` | 130 1S2Ç kartının elle CM maliyeti |
| `taban_yaz` / `fark_yaz` | `kart`, `hucre`, `deger` | matris tabanı / formül hücresinin farkı. K2 = `sembol` ise uyarlayıcı farkı sembolün ortak değerine yazar (kabul dosyasında sembol başına aynı değer verilir; `hucre-basina` ailesi o zaman koşulmaz) |
| `bilgi_yaz` | `kart`, `satir`, `sira`, `deger` | bilgi satırının `sira`ncı hücresi (sayı ya da metin) |

### 6.4 Okuma görüntüsü (`oku` → `kartlar[kod]`)
Sayılar JSON sayısı (ham, yuvarlanmamış çift duyarlıklı); boş girdi `null`; hesaplanan değer boş girdide **0** (V1). NaN / sonsuz her zaman farktır.
```
zincir: {"ad", "satirlar": {"s1": {"ad", "birim", "miktar", "fiyat", "tutar"}, …},
         "adimlar": {"ara": {"etiket", "deger"}, "yuzde": {"etiket", "oran", "deger"}, "toplama": {"etiket", "deger"},
                     "yuzde_ekle": {"etiket", "oran", "deger"}, "bolme": {"etiket", "bolen", "deger", "hata": null | "SIFIRA_BOLME"},
                     "cm_elle": {"etiket", "deger"}}, "sonuc"}
gramaj: {"ad", "satirlar": {"s1": {"parca", "cins", "giden_mt", "boy", "br_gramaj", "giden_kg", "alis_ft", "satir_top"}, …},
         "toplam": {"giden_kg", "satir_top"}}
matris: {"ad", "sutunlar": {"c1": ad, …}, "olculer": {"r1": metin, …}, "hucreler": {"r1c1": {"taban", "deger"}, "r1c2": {"fark", "deger"}, …}}
bilgi:  {"ad", "satirlar": {"b1": {"ad", "degerler": [değer, …]}, …}}
```

### 6.5 Şablon (`sablon_oku` → `sablon`)
```
{"sekmeler": {"cam": {"ad", "kartlar": [kod, …]}, …},
 "kartlar": {"<kod>": zincir {"ad", "tur": "zincir", "satirlar": [s1…], "adim_sirasi": [kod…], "adim_islem": {kod: islem},
                              "oranlar": {"yuzde": p, "yuzde_ekle": q}, "bolen": k | null, "elle": ["cm_elle"] | []}
                    | gramaj {"ad", "tur": "gramaj", "satirlar": [...], "elle_kg": ["s1"]}
                    | matris {"ad", "tur": "matris", "satirlar": [r1…], "sutunlar": [c1…c4], "hucreler": {"r1c1": "taban", "r1c2": "r1c1", …}}
                    | bilgi {"ad", "tur": "bilgi", "satirlar": [b1…]}}}
```
`islem` değerleri: `toplam`, `yuzde`, `toplama`, `yuzde_ekle`, `bolme`, `elle`. Matris hücresinin değeri `"taban"` ya da kaynak hücre kimliği.

### 6.6 Katmanlar
`api`: her okuma Kaydet'ten sonra (sunucu hesabı). `arayuz`: Kaydet'ten önceki canlı hesap ve Çık sorusu (ekran). İstemci de hesap yapıyorsa
iki katman da koşulur (iki hesap ayrışabilir; öneri: istemci sunucunun hesabını göstersin ya da aynı çekirdeği kullansın). Arayüz uyarlayıcısı
ekrandaki gösterimi değil ham değeri okur (ör. `data-deger`); okuyamıyorsa `gosterim_basamak` beyan eder (tolerans ± yarım basamak); boş
gösterimi 0 sayılsın istiyorsa `bos_sifir_sayilir: true` (yalnız beklenen 0 olan hesapta geçerli). `--katman api` yalnız o katmanı seçer.

## 7. Karşılaştırma kuralları (`kahin.py` §3)

| Sınıf | Neye uygulanır | Kural |
|---|---|---|
| tam | girdiler (miktar, fiyat, oran, bölen, taban, fark, elle değer, gramaj girdileri, bilgi değerleri), `hata` | kesin eşit; `null` = `null` |
| yakın | hesaplar (tutar, adım değerleri, sonuç, Giden Kğ, Satır Top., toplamlar, matris değeri) | `|p − b| ≤ max(1e-9 × max(|p|, |b|), 1e-12)`; NaN / sonsuz / eksik → fark |
| ad | ✎ ile yazılan ad, etiket, birim, sütun / ölçü adı | kesin eşit (kullanıcının verisi aynen) |
| ilişkisel ad | kullanıcının yazmadığı her ad / etiket | programın bu karttaki **ilk** okumasındaki değeriyle aynı (oran değişince etiket değişmez) |
| küme | satır, adım, matris hücresi / ölçü / sütun kimlikleri | aynı küme; `bos<n>` boş satırlar yok sayılır |
| durum, soru | her adım; `cik` | beklenen `tamam` / `ret`; Çık sorusu var / yok |

Şablonun varsayılan adları karşılaştırılmaz (ürün kararı); yalnız sekme / kart adında marka ve yıl olmadığı denetlenir.

## 8. Kâhinin kendi testi (`test_kahin.py`) ve mutasyonlar

A. El hesapları (beklenen sayılar elle, dosyada yazılı): her kalıp (çarpım, toplam aralık / liste, yüzde, toplama, yüzde ekle, sabite bölme, sabit
fark), ÷120 kartları, elle CM, yan panel, gramaj (elle R20, Giden Mt), 2024 çapa / zincir / tesettür / yan panel, 2019 zinciri ve elle hücreleri,
boş kart, negatif, satır ekle / sil, aynı ad, oran değişince etiket, bölen 0 (iki seçenek), Kaydetmeden Çık. B. Şablon: §1 sayımı, §2 oran /
bölen tablosu, §4 yapı özeti, §6 elle hücreler, başvuru sınıfları, döngü yok. C. Kabul: tohumdan aynen yeniden üretim (ayrıştırılmış karşılaştırma,
CRLF'den bağımsız — ders 27), aile kapsamı, kendisiyle 0 fark. D. Mutasyon. E. Koşucunun çıkış kodları (program yok → 3 ve "geçti" yok; sahte
uyarlayıcı yalnız `--kendi-testi`; bozuk JSON / düşen uyarlayıcı / eksik karar beyanı / koşulmayan katman → 3; bozuk program → 1). F. Excel aracı
(sentetik döküm 0 fark; bozulan bölen / değer / elle hücre / kaynak yakalanır).

**Mutasyon (37, hepsi yakalanmalı; yakalanmayan = eksik senaryo):** `ara-son-satir-yok`, `yuzde-oran2`, `toplama-yuzdesiz`, `yuzde-ekle-carpan`,
`bolme-yanlis-kaynak`, `kurus-yuvarla-tutar`, `kurus-yuvarla-ara`, `cam5-cm-hesapla`, `cam4-bolen-130`, `mika9-bolen-150`, `yan-panel-oran-20`,
`oran-ortak`, `bolen-ortak`, `ortak-malzeme-fiyati`, `eklenen-satir-ara-disi`, `silinen-satir-sayilir`, `ad-ile-birlestir`, `bos-null`,
`gramaj-r20-hesapla`, `gramaj-giden-mt`, `gramaj-eklenen-toplam-disi`, `gramaj-toplam-elle-yok`, `matris-b7-capa`, `matris-h-zincir-capa`,
`matris-tesettur-tabandan`, `matris-fark-ilk-satir`, `matris-yan-panel-parlak-c3`, `matris-elle-zincir`, `matris-bos-fark-null`,
`fark-sembole-bagli`, `bilgi-bagli`, `bolen-sifir-sonsuz`, `kaydet-yuvarla-girdi`, `cik-soru-yok`, `cik-kaydetmeden-kaydeder`, `oran-etiket-bagli`,
`yeniden-baslat-kayip` (açıklamaları `kahin.MUTASYONLAR`). "Düzeltme" mutasyonları (130'luk kartta ÷130, 150'likte ÷150, yan panelde %20) Excel'deki
tutarsızlığı "düzelten" programı yakalar. Eşdeğer işlem sırası (ARA × (p/100)) fark sayılmaz; 0,004'lük sapma sayılır.

## 9. Excel'in kendi değerleriyle kabul (yalnız yerel, ana oturum)

Madde 0c kabulü: "kâhin = Excel'in kendi değerleri, 0 fark". Bu ajana müşteri dosyası yasaktı; denetimi ana oturum yerelde koşar. Döküm müşteri
verisidir: not defterinde kalır, depoya / kanıta girmez; araç değer yazmaz, yalnız sayı ve hücre adresi yazar.
```
# not defterinde (openpyxl yalnız orada; depoya girmez)
import json, openpyxl
f = openpyxl.load_workbook(YOL, data_only=False); v = openpyxl.load_workbook(YOL, data_only=True)
out = {"sekmeler": {}}
for i, (wf, wv) in enumerate(zip(f.worksheets, v.worksheets), 1):
    deg, form = {}, {}
    for satir in wf.iter_rows():
        for c in satir:
            if c.value is None: continue
            if isinstance(c.value, str) and c.value.startswith("="): form[c.coordinate] = c.value; deg[c.coordinate] = wv[c.coordinate].value
            else: deg[c.coordinate] = c.value
    out["sekmeler"][str(i)] = {"degerler": deg, "formuller": form}
json.dump(out, open(CIKTI, "w", encoding="utf-8"), ensure_ascii=False, default=str)
```
`python3 -I test/bagimsiz/maliyet/excel_denetle.py <CIKTI>` → KAPSAM (her Excel formülü şablonda; elle hücre formül değil), YAPI (formül metni
şablondan türetilenle aynı; fiyat listesinde `=<kaynak>+<sabit>` ve kaynak aynı), DEĞER (Excel girdileriyle kâhinin hesabı = Excel'in önbellek
değeri, göreli 1e-9). Beklenen: `N/N denetim geçti`.

## 10. KARAR GEREKİR (kâhin iki seçeneği de taşır; program `beyan`da birini yazar)

- **K1 (`K-BOLEN-0`) — bölen 0 ya da boş.** Excel `#SAYI/0!` gösterir. `ret`: bölen değişikliği reddedilir (alan altında "Bölen 0 olamaz"),
  bölen eski değerde kalır; `tanimsiz`: kaydedilir, yalnız bölme adımı boş + `SIFIRA_BOLME`, öbür adımlar hesaplanır. Hiçbir seçenekte 0 ya da
  sonsuz gösterilmez. **Öneri: `ret`** (yaygın form doğrulaması; tanımsız değer kaydedilmez; kart hiçbir yere bağlı olmadığından iki seçenek de
  güvenli). Boş bölen 0 sayılır (V2) → aynı karar.
- **K2 (`K-FARK`) — fiyat listesi farkı hücre başına mı, sembol başına mı.** Excel'de her formülün kendi sabiti var (aynı Δ yalnız tesadüfen /
  elle kopyalanmış aynı sayı). `hucre`: her formül hücresinin kendi farkı; `sembol`: aynı Δ'li hücreler tek ortak fark. **Öneri: `hucre`**
  (Excel'deki gibi; tutarsızlık 13 ve 15 ancak böyle aynen korunur; "sütuna uygula" kolaylığı sonradan eklenebilir). `sembol` seçilirse
  `hucre-basina` ailesi (12 senaryo) koşulmaz ve tutarsızlık 13'ün ifade edilip edilemeyeceği yeniden yazılır.
- **K3 — fiyat listesinde satır ekle / sil.** Tablo eklenen ölçü satırının kuralını vermiyor (çapa mı zincir mi, hangi fark). Kâhinde YOK
  (matriste `satir_ekle` senaryo hatasıdır). **Öneri:** bu sürümde fiyat listesinde satır ekle / sil YOK (yalnız taban, fark, ad); istenirse
  kural: 2019 bir üst satır + fark; 2024 taban sütunu ilk satır + fark, renk sütunları aynı satırın kuralı; yalnız son satır silinebilir.

## 11. AÇIK (formül tablosunun susturduğu ya da çeliştiği noktalar)

- A1 Sekme adları: marka ve yıl çıkınca iki liste "Liste Bayii" / "Liste Bayı" gibi neredeyse aynı kalıyor; ürün adı ürün sahibinin. Kâhin adları karşılaştırmaz.
- A2 `liste-1` = Excel'in 2. sekmesi (2024), `liste-2` = 4. sekmesi (2019) — Excel sırasından; kod eşlemesi.
- A3 Excel'in ARA aralığındaki boş / not satırı (kart başına 9. / 23. satır; MİKA notları "‹n›mt fitil") ürüne satır olarak gelecek mi. Kâhin: gelmez; gelirse boş kaldıkça yok sayılır (V3 kümesi). Notun sayısı müşteri verisi.
- A4 Yan panelin 37. satırı ARA listesinin DIŞINDA boş satır; kâhin taşımaz, eklenen her satır ARA'ya girer.
- A5 130 1S2Ç kartının elle CM maliyeti ekranda girdi alanı mı, hiç gösterilmez mi; kâhin: girdi alanı (`cm_elle`), boş gelir.
- A6 MİKA 120 1S2Ç'nin CM satırında etiket yok (G25'te sayı); kâhin: etiket boş, ✎ ile verilir.
- A7 Bilgi blokları (2024 fark satırları + katlanır kapı; 2019 fark + montaj) ürüne gelecek mi; kâhin: gelir, değerleri boş, bağsız. Alt yazılar (teslim süresi, adres, marka, "K.D.V hariçtir"), CAM M17/N17/Q17 başıboş sayılar, 2024 A1 `"` / D51 boşluk TAŞINMAZ. 2019 montaj satırındaki marka adı çıkarıldı ("Kabin Montajı").
- A8 Profil gramaj tablosu ve yan panel ayrı "kart" mı; kâhin: kart (gramaj / zincir).
- A9 Gösterim basamağı (CAM General, MİKA `#,##0.00`, liste ₺); kâhin ham değerle karşılaştırır.
- A10 Girdi sınırları (negatif miktar / fiyat / oran / bölen, en çok basamak, en büyük sayı); tablo susuyor; kâhin Excel gibi hesaplar, sınır koymaz (15 anlamlı basamağa kadar dener).
- A11 Değeri yazıp aynı değere geri alınca Çık sorusu sorulur mu; kâhin denemez.
- A12 Eklenen satırın yeri (sona / araya); sıra hesaba girmez, karşılaştırılmaz.
- A13 Matris hücresini elle değere çevirme (formül ↔ taban); kâhinde yok.
- A14 Kart / sekme ekle, sil, çoğalt; kâhinde yok (tablo kart kümesini sabit veriyor).
- A15 Kaydet pencere başına mı kart başına mı; kâhin: pencere başına (altta tek Kaydet / Çık).
- A16 Yeni satırın varsayılan adı / birimi; karşılaştırılmaz.
- A17 CAM `=Miktar*Fiyat`, MİKA `=Fiyat*Miktar`: IEEE çarpması değişmeli, sonuç aynı — kâhin ikisini ayrı tutar ama fark göremez (bilgi).
- A18 Excel'in toplama sonucunda sıfıra çok yakın değeri 0'a çekmesi; kâhin uygulamaz (mutlak 1e-12 toleransı kapsar).
- A19 Aynı kartı iki kişi aynı anda kaydederse (son yazan mı, 409 mu); kâhinde yok.

## 12. KÂHİN VARSAYIMI (kod yazılmadan verildi; programa bakılarak DEĞİŞTİRİLMEZ — ders 40)

- V1 Boş hücre 0: boş kartta hesaplanan her değer **0** (sayı), girdiler `null`. Gerekçe: tablodaki 8 kalıbın hiçbiri boşu ayrıca işlemez (IF yok); Excel `=B2*D2`, `SUM`, `÷k` boş girdide 0 verir; "ara değerler yuvarlanmaz" Excel aritmetiğini aynen ister. Ekranda boş gösterim `bos_sifir_sayilir` beyanıyla kabul edilir; API 0 vermeli.
- V2 Boş oran = 0, boş fark = 0, boş taban = 0, boş elle hücre = 0 (onu okuyan formülde); boş bölen = 0 → K1. Gerekçe V1.
- V3 Ara değerler yuvarlanmaz; karşılaştırma göreli 1e-9 / mutlak 1e-12 (formül tablosunun kendi yeniden hesap toleransı 1e-9). Kuruş yuvarlaması yakalanır.
- V4 Girdiler yuvarlanmadan saklanır (Kaydet → yeniden aç aynı çift duyarlıklı sayı; Excel 15 anlamlı basamak saklar).
- V5 İşlem sırası Excel formülündeki gibi soldan sağa: (ARA × p) / 100; ((T × q) / 100) + T. Matematikçe eşdeğer başka sıra tolerans içinde kalır.
- V6 Eklenen satır yalnız kartın satır kuralına girer: zincirde tutar → ARA; gramajda R = Boy × Br. Gramaj ve T = Alış × Giden Kğ → iki toplam. Elle kuralı (R20) eklenen satıra geçmez. Yan panelde de ARA'ya girer (A4).
- V7 Silinen satır hiçbir toplama girmez; aynı adla yeniden eklenen satır yeni satırdır (eski değer dönmez).
- V8 Ad (✎) yalnız metindir; hesaba girmez; aynı adlı iki satır iki satırdır; kullanıcının yazdığı ad aynen kalır (yazım düzeni uygulanmaz — kullanıcı verisi).
- V9 Etiket ile oran ayrı: oran değişince etiket değişmez (tutarsızlık 11 böyle doğmuş; kullanıcı kuralı).
- V10 Oran, bölen ve fiyat kart başına; bir karttaki değişiklik öbür kartı (aynı oranlı / aynı adlı malzemeli olanlar dahil) değiştirmez. Gerekçe: tablo §0 "ortak fiyat/oran hücresi YOK"; tutarsızlık 3, 16–20.
- V11 Elle hücreler girdi: CAM H25 (`cm_elle`), MİKA R20, 2019 I5, H15:K15, B30 (taban). Excel'deki değerleri müşteri verisi → boş gelir.
- V12 Fiyat listesi hücresi = kaynak hücrenin değeri + hücrenin kendi farkı (K2 varsayılanı `hucre`).
- V13 Bilgi satırları hiçbir hesaba bağlı değil (tutarsızlık 15 aynen).
- V14 Kimlik düzeni §6.2; uyarlayıcı eşler. Kart ve satır sırası karşılaştırılmaz (küme); adım sırası karşılaştırılır (işlem sırası sabit).
- V15 Şablonun varsayılan adları karşılaştırılmaz; sekme / kart adında marka ve yıl olmaz (denetlenir).
- V16 Her senaryo boş şablonlu temiz şirkette başlar.
- V17 Pencere başına tek Kaydet; Çık'ta kaydedilmemiş değişiklik varsa soru (Kaydet / Kaydetmeden Çık), yoksa soru yok; kaydedilmeyen ✎ ad da geri döner.
- V18 Yan panel: Ara → Masraf %15 → Genel (Masraf + Ara) → "%20 Maliyet" etiketli %15; bölme yok; sonuç son adım (tutarsızlık 11 aynen).
- V19 130 1S2Ç kartının sonucu %20 Maliyet adımı (K27); `cm_elle` yalnız yansıtılır, hiçbir adım onu okumaz.
- V20 Gramajda Giden Mt hiçbir hesaba girmez, Cins metin (tutarsızlık 22).
- V21 Program yeniden başlayınca son Kaydet'teki değerler aynen.

## 13. DENENEN / DENENMEYEN / BİLİNEN SINIRLAR

- **DENENEN** (25.10.2026, Linux, Python 3.13): `test_kahin.py` 119/119 (çıkış 0) — el hesapları, şablon sayımı 554, kabul yeniden üretimi,
  kâhin kendisiyle 45.540 denetim 0 fark, 37/37 mutasyon yakalandı, koşucu çıkış kodları (program yok → 3), Excel aracı sentetik döküm 1.308 denetim
  0 fark + 5 bozma yakalandı. Dersler: 2 (çıkış kodu + sayı), 3 (ret durumu denetlenir), 4 (program yok BELİRSİZ), 5 (temiz oda), 7 (mutasyon),
  25 (benzersiz geçici klasör), 27 (CRLF'den bağımsız karşılaştırma), 33 (Windows'ta açılan dosya adları), 34 (Çık sorusu var / yok), 36 (joker silme yok), 40 (varsayımlar önceden yazıldı).
- **DENENMEYEN:** programla karşılaştırma (program yok — koşucu BELİRSİZ); Excel'in kendi değerleriyle karşılaştırma (bu ajana müşteri dosyası
  yasak; §9 ana oturumda); Windows'ta koşu (yalnız Linux; Windows için UTF-8 çıktı ayarı ve `python` adı yazıldı, gerçek koşu görülmedi — ders 18);
  sektör görünürlüğü, yedek / geri yükleme, şirket sıfırlama, bağsızlık (madde 1, 3, 5 — kâhin kapsamı dışında); iki kişi aynı anda (A19);
  eski sürümden gelen veri (yeni modül); ses kaydındaki müşteri istekleri (dökülemedi).
- **BİLİNEN SINIRLAR:** kâhin ile programın şablonu aynı tablodan ayrı ellerle yazılır; tablonun kendi yanlışı (varsa) ikisinde de olur — bunu
  yalnız §9 Excel denetimi yakalar. Kabul dosyası yalnız tohum 1–3 (`--tohum` ile genişler). Arayüz katmanı 5 kartta (zincir ×3, gramaj, matris).
  Tolerans 1e-9 görelidir; çok büyük sayılarda (1e16 üstü) kuruş farkını göremez.
