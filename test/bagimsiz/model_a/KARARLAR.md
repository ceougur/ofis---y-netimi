# Model A: Kararlar

Model A, `destekofis-senaryo/2` (sürüm 1'den güncelleme: en altta) senaryolarını işleyen bağımsız bir muhasebe kâhinidir. Bu belge, kâhinin kendi verdiği
kararları sayar. Kurallar `test/bagimsiz/SENARYO-DILI.md` belgesindedir. Bu kararlar ise o belgenin açık bıraktığı ya da
yalnız "senaryo kurmaz" dediği yerlerde kâhinin nasıl davrandığını anlatır. Her kararda dayanak alıntısı ve kararın
etiketi var (SENARYO-DILI §1'deki anlamlarla).

## Temiz oda

- **Okunan kaynaklar:**
  - `docs/BANKA-MODULU-PLAN.md` (Sürüm 3)
  - `docs/BANKA-MODULU-TALIMAT.md`
  - `test/bagimsiz/SENARYO-DILI.md`
  - `test/bagimsiz/senaryolar/kabul-1-16.json` ve `kabul-1-16.beklenen.json`
- **Okunmayanlar:** `server/`, `client/`, `tools/`, `test/` altındaki öbür dosyalar, git geçmişi, `docs/*KANIT*.md`,
  `docs/*ESLEME*.md` ve `test/bagimsiz/model_b/`.
- **CLAUDE.md:** Oturuma kendiliğinden yüklendi ve programın bazı davranışlarını anlatıyor. Kaynak olarak kullanılmadı.
  Formüller ve kurallar yalnız yukarıdaki üç belgeden alındı.
- **Çalışma koşulları:** Kâhin yalnız standart kütüphaneyle çalışır (`python3 -I`). Programın hiçbir dosyasını içe
  aktarmaz. Tutarlar her yerde tamsayı kuruştur; kayan nokta kullanılmaz. Ağa ve saate başvurmaz.

## Sonuçlar

### Kabul 1–16

`python3 -I test/bagimsiz/model_a/model.py test/bagimsiz/senaryolar/kabul-1-16.json --plan-denetimi` çıkış kodu 0
döndü ve "28 yaprak, hepsi tuttu" yazdı. Kâhin, planın `kontrol` adımlarındaki 28 sayının hepsini veriyor.

Kâhin çıktısı, elle yazılmış `kabul-1-16.beklenen.json` dosyasıyla da alan alan birebir aynı (`kaynak` ve `notlar`
dışında). Son mizan şöyle:

| Hesap | Borç | Alacak |
|---|---|---|
| 100 | 10.000,00 | |
| 102.01 | 90.000,00 | |
| 102.02 | 70.000,00 | |
| 120 | 0 | 0 |
| 391 | | 3.333,33 |
| 500 | | 150.000,00 |
| 600 | | 16.666,67 |

Borç ve alacak toplamı 170.000'de dengede.

**Plan ile kâhin arasında çelişki çıkmadı.** İlk denetim koşusu 4 fark yazdı. Neden ne planın sayısıydı ne de kâhinin
yorumu: denetim aracı `mizan.102.01.borc` yolunu noktadan bölüyor, böylece `102.01` anahtarını iki parçaya ayırıyordu.
Araç yolu artık demet olarak tutuyor; aynı koşu 28/28 verdi. Kâhinin hesap kodunda değişiklik gerekmedi.

### Birim testleri

`python3 -I test/bagimsiz/model_a/test_model.py` 42 testi koşuyor, hepsi geçiyor. Beklenen sayılar elle, plandan
hesaplandı:
- PLAN §3.7 #3, #11–#18
- §3.9 min formülü
- §12.5 adım 6, 27 ve 37
- SENARYO-DILI §14

Testlerin dişi bir mutasyon denemesiyle sınandı: modele bilerek 14 farklı hata enjekte edildi.
- İlk turda 13'ünü testler yakaladı.
- Sağ kalan mutasyon "KDV dahil kalemde KDV = rh(M·r/100)" idi; testteki tutarlarda iki formül aynı sonucu veriyordu.
- İki formülü ayıran bir kalem eklendi: brüt 100,05, %20 dahil → matrah 8.338, KDV 1.667 (öbür formül 1.668 verir).
- Sonra 14 mutasyonun hepsi yakalandı.

### Çıkış kodları

| Kod | Anlamı |
|---|---|
| 0 | Çıktı stdout'ta |
| 1 | Kullanım hatası |
| 2 | Senaryo geçersiz; neden stderr'de |
| 3 | Kâhin değişmezi bozuldu (fiş dengesi, mizan dengesi, cari değişmezi) |
| 4 | `--plan-denetimi`: plan sayısı tutmadı |

## Kararlar (K-n)

Kâhinin stderr iletileri ve `belirsizler` alanı bu numaraları anar.

### K-1 · "Senaryo kurmaz" kuralları ve kâhinin karar vermediği durumlar → çıkış 2

- **Dayanak:** SENARYO-DILI §13/6 ("§12'deki 'senaryo kurmaz' kurallarına uyuluyor") ve §1 [BELİRSİZ-n] satırı ("Kâhin
  karar vermez").
- **Davranış:** Statik denetimle görülebilenler senaryo çalıştırılmadan reddedilir. Çalışma anında ortaya çıkanlar ilgili
  adımda yakalanır ve senaryonun tamamı geçersiz sayılır; o noktaya kadarki çıktı da yazılmaz:
  - eksi stok (BELİRSİZ-14)
  - kalanı aşan taksit tahsilatı (BELİRSİZ-6)
  - bağlı ödemenin açığı aşması (BELİRSİZ-10)
  - silinmiş eşi olan Benzer İşlem anahtarı (BELİRSİZ-19)
  - planda olmayan yetki birleşimi (BELİRSİZ-18)
  - Kasa okumalarının ayrışması (BELİRSİZ-20)
- Kâhinin kendi eklediği "planda tanımsız" durumlar (K-6, K-9, K-12, K-13, K-14 ve aşağıdakiler) de aynı biçimde çıkış
  2'dir. Kâhin yanıt uydurmaz.

### K-2 · Bir adımda birden çok ihlal

- **Dayanak:** SENARYO-DILI §5.6: "Senaryo bir adımda tek ihlal kurar; kurarsa karşılaştırıcı o adımda yalnız durum
  sınıfını (4xx) karşılaştırır". PLAN §9.2/1: "Her uçta `requirePermission`".
- **Davranış:**
  - 403 kesindir ve tek başına yazılır; öbür denetimlere bakılmaz [ÇIKARIM].
  - Kalan ihlaller (girdi, kilit, açılış öncesi, Benzer İşlem, eksi bakiye) toplanır.
  - Farklı (durum, kod) çifti birden çoksa ret `{"durum": "4xx", "kod": null, "kodDayanak": null}` yazılır.
    `belirsizler`e `{"alan": "retler.<id>", "neden": "BELİRSİZ-17 ([...])"}` eklenir.
  - Aynı (durum, kod) çifti birkaç kez çıkarsa tek ret sayılır. Örnek: ileri tarih ile 3 ondalıklı ham tutar, ikisi de
    400 ve kodsuz.
- **Sıra:** Girdi ihlali (grup 2) varsa istek kimliğine bakılmaz. Aynı kimlik ve aynı gövdeli yineleme ise kilit, Benzer
  İşlem ve eksi bakiye denetimlerinden önce gelir, ret değildir (§5.6 sırası).

### K-3 · İstek kimliğinde "gövde"nin olağanlaştırılması

- **Dayanak:** SENARYO-DILI §5.4: "Gövde = adımın id, ad, not, istekKimligi, benzerOnay, yineDeKaydet, ayniAnda dışındaki
  bütün alanları". PLAN §3.10/1 ve §3.3 adım 1: "aynı kimlik + farklı içerik → 409".
- **Davranış:** Gövde, programa gerçekten gidecek içerik olarak karşılaştırılır.
  - `kullanici` yoksa `Y` sayılır.
  - Deftere yazan işlemlerde `tarih` yoksa o günün tarihi yazılır.
  - Takma ad tanımlayan iç alanlar karşılaştırmaya girmez: `odeme.taksit.ad` ve `banka_masraf.fatura`. Bunlar koşucuda
    kalır, programa gitmez.
  - Anılan takma adlar varlık kimliğine çevrilir. Böylece bir yinelemenin takma adıyla anılan varlık, asıl adla
    anılanla aynı sayılır.
- **Etiket:** ÇIKARIM. Koşucu programa takma ad değil kimlik gönderir (§10).

### K-4 · Yinelenen adımın takma adları ve çıktıdaki ad

- **Dayanak:** SENARYO-DILI §5.4: "ad'ı önceki adımın hareketini anar".
- **Davranış (sürüm 2, D4 — hakem KAHIN-K4-YINELENEN-AD üzerine DEĞİŞTİ):** Yinelenen adımın her takma adı, önceki
  başarılı adımın oluşturduğu varlığı anar (`ad`, taksit kartı adı, KDV'li masrafın fatura adı) **ve çıktı haritalarında
  ikinci anahtar olarak aynı değerle yazılır** (`faturalar`, `taksitKartlari`, `bankaHesaplari`, `hesapKodlari`,
  `eksiBakiyeDenetimi`, `cariler`, `stok`). Örnek: `F2`, `F1`'in yinelemesi ise `faturalar` hem `F1`'i hem `F2`'yi aynı
  değerle taşır. (Sürüm 1'deki "yalnız ilk ad" kararı dilin §8.3 "her … adı" kuralına aykırıydı.)
- **Etiket:** ÇIKARIM (§5.4 + §8.3).

### K-5 · Benzer İşlem dizinine peşin satırlar ve iade geri ödemeleri de girer

- **Dayanak:** PLAN §3.10/2: "Hedef: taksit kalemi (seçilmemişse kart), fatura (Kapatılacak Fatura ya da peşin satırın
  faturası)". SENARYO-DILI §5.4: "Aynı anahtarlı etkin (silinmemiş) önceki satır varsa…".
- **Davranış:**
  - Hesaba bağlı fatura peşini, iade geri ödemesi ve KDV'li masrafın peşini **kendileri hiç ret almaz**; hedefleri o
    adımda açılan belgedir.
  - Ama "önceki satır" olarak dizine girerler. Örnek: aynı gün, aynı hesap, cari ve tutarla "Kapatılacak Fatura = o
    belge" seçen bir `cari_tahsilat` → 409 `bank-similar`.
- **Etiket:** ÇIKARIM. Program farklıysa İNCELE.

### K-6 · Açılış ve Açılışı Düzelt eksi bakiye denetimine girmez

- **Dayanak:** PLAN §10.3: "Açılış bakiyesinin anlamı: Açılış tarihi D'nin gün başındaki banka bakiyesi S". A.1/5:
  "Açılış gününün başındaki bakiye". §3.9 denetimi işlemler için yazar; açılışı anmaz.
- **Davranış:** `hesap_ac` ve `acilis_duzelt` K7 denetiminden geçmez. Ancak denetim uygulansaydı ihlal çıkacak bir durum
  kurulursa senaryo geçersizdir (çıkış 2). Bu durum, doğrulanmış ve kredi dışı bir hesapta açılıştan ya da düzeltmeden
  sonra min formülünün limit altına düşmesidir.
- **Etiket:** BELİRSİZ (model).

### K-7 · BELİRSİZ-1 statik olarak denetlenir

- **Dayanak:** SENARYO-DILI §3.1: "`kasaEksiBakiye` … Kasa'dan çıkış içeren senaryoda zorunlu".
- **Davranış:** Kasa'yı azaltabilecek bir adımdan önce `kasaEksiBakiye` (başlangıçta ya da bir `ayar` adımında)
  verilmemişse senaryo geçersizdir. Bu adımlar:
  - `kasa_hareket` çıkış
  - nakit `cari_odeme`
  - `kasa_banka` kasadan bankaya
  - nakit peşinli alış faturası
  - nakit geri ödemeli satıştan iade
  - Kasa'yı artırmış bir hareketin silinmesi
- Çalışma anında da aynı denetim yapılır (güvenlik ağı).

### K-8 · BELİRSİZ-20: Kasa'da geriye tarihli azalış

- **Dayanak:** SENARYO-DILI §12/20: "§3.9 formülü banka hesabı için yazılı — Senaryo Kasa hareketlerini tarih sırasıyla
  yazar".
- **Davranış:** Bütün geriye tarihli Kasa hareketleri yasaklanmaz. Kasa'yı azaltan her adımda üç okuma hesaplanır:
  - (a) son durum
  - (b) min(işlem günü, son durum)
  - (c) işlem gününden başlayarak her günün bakiyesinin en düşüğü
- Üçü aynı sonucu (ihlal var/yok) veriyorsa sonuç kullanılır; ayrışıyorsa senaryo geçersizdir. Banka hesaplarında
  planın formülü (b) kullanılır [PLAN §3.9].

### K-9 · KDV kipli banka masrafında vadeli hesap

- **Dayanak:** SENARYO-DILI §4.20: hesap "102 türü hesap"; KDV kipi "`pesin: [{yol: havale, … hesap: H}]` gibi işlenir
  (§4.13 kuralları)". §5.2'ye göre vadeli hesap havalede uygun değildir. PLAN §3.5: "Vadeli … Hayır; yalnız transfer ve
  faiz".
- **Davranış:** İki kural çelişiyor. KDV kipinde vadeli hesap → senaryo geçersiz.
  - Pasif, kart ya da kredi hesabı → 400 `bank-account-invalid` ("Banka Fişi … pasif hesap → 400").
  - BSMV ve Yok kiplerinde vadeli hesap izinlidir (§4.19'daki "102 türü" tanımı).

### K-10 · Geri ödenmemiş iadeye "Kapatılacak Fatura" ile bağlı ödeme

- **Dayanak:** SENARYO-DILI §7 kural 4 ve kural 5. Kural 5 "iadenin tutarı" der; bağlı ödemeyle sırası tanımsız.
- **Davranış:** Kâhin önce kural 4'ü, sonra kural 5'i uygular ve iadenin kalan tutarını kullanır. O carinin
  `faturalar.*.acik` ve `taksitKartlari.*` alanları `belirsizler`e "K-10" nedeniyle yazılır.

### K-11 · Ham tutar (`<alan>Ham`)

- **Dayanak:** SENARYO-DILI §6.2.
- **Biçim:** `^-?[0-9]+(,[0-9]+)?$` biçiminde olmayan ham değer senaryo hatasıdır. Programın "1.234,56" ya da harfli
  girdiyi nasıl çözeceği bilinmiyor.
- **Banka ucu:** 2'den çok ondalık, eksi, sıfır ya da 1e12 TL üstü → 400 (§6.2).
- **`acilisBakiyesiHam`:** 3+ ondalık → 400 (§4.4). Sıfır serbesttir ("0 olabilir"). Eksi yalnız vadesiz, ticari ve
  diğer hesapta serbesttir (§3.3 istisnası). Öbür türlerde eksi → 400 [ÇIKARIM: banka ucu "eksi → 400"].
- **Modül ucu:** 3+ ondalık, sıfırdan uzağa yarım yuvarlamayla (rh) kuruşa çevrilir. Örnek: "1,005" → 1,01;
  "0,004" → 0 → 400. Eksi ya da 1e12 TL üstü → 400.

### K-12 · Belgeden önce tarihli bağlı ödeme ve taksit tahsilatı

- **Dayanak:** Plan susuyor. Yalnız iade için kural var: "iade tarihi < asıl fatura tarihi → 4xx" (§4.14) ve PLAN §4.6
  "İade tarihi satış tarihinden önce olamaz".
- **Davranış:** `kapatilacakFatura`'lı tahsilat ya da ödemenin tarihi belgeden önceyse senaryo geçersizdir. Taksit
  tahsilatının tarihi faturadan önceyse de aynısı geçerlidir.

### K-13 · Pasif hesaptaki satır

- **Dayanak:** SENARYO-DILI §4.5 yalnız "Pasif hesap hiçbir formda seçilemez" der. Pasif hesaptaki eski satırın
  silinmesini, ters kaydını ya da açılış düzeltmesini tanımlamaz.
- **Davranış:** Bu üç durum senaryo geçersizdir.

### K-14 · IBAN ve hesap kodu yazımı

- **Dayanak:** Plan, karşılaştırmanın büyük/küçük harfe ve boşluğa duyarlılığını söylemiyor. Cari IBAN'ının
  doğrulanmasını da söylemiyor (yalnız banka hesabı: Aşama 3 "Geçersiz IBAN → 400").
- **Davranış:**
  - Banka IBAN'ı boşluksuz ve büyük harfle yazılır; aksi senaryo hatasıdır.
  - Geçersiz cari IBAN'ı senaryo hatasıdır.
  - Yalnız harf büyüklüğüyle ayrışan iki hesap kodu senaryo hatasıdır. Birebir aynı kod → "4xx" (§4.4).

### K-15 · Ters kaydın tarihi kilitli güne düşerse

- **Dayanak:** PLAN §3.8 ve A.1/12: "Ters fiş tarihi: asıl fiş açık dönemdeyse aynı tarih, kilitliyse bugün".
- **Davranış:** Kilit bugüne eşitse "bugün" de kilitlidir. Ters fiş genel tarih kuralına takılır: 409 `period-locked`
  [ÇIKARIM, §5.1].

### K-16 · Dönem kilidi

- **Dayanak:** SENARYO-DILI §4.3: "Sonradan geri alınmaz".
- **Davranış:** Önceki kilitten daha erken bir `kilitTarihi` senaryo hatasıdır (geri alma sayılır). `bugun`'den sonraki
  kilit de senaryo hatasıdır ([YAYGIN] satırı).

### K-17 · Silme yetkisi: hesabı atanmamış satır ve Banka Fişleri

- **Dayanak:** PLAN §9.2/4: "Nakit ve hesabı atanmamış satırlarda bugünkü kural sürer". SENARYO-DILI §5.5 yalnız "nakit
  hedef" der.
- **Davranış:**
  - 102.00/108.00'e yazılmış hedef, "nakit hedef" satırındaki yetkiyle silinir: personel kendi girdiğini 200, muhasebe B.
  - Banka Fişi, transfer ve ters kayıt hedefleri "hesaba bağlı hedef" yetkisiyle değerlendirilir: personel 403, muhasebe
    B. Yönetici için sonuç "4xx" (silinmez).

### K-18 · Kasa'da "Yine de Kaydet"

- **Dayanak:** SENARYO-DILI §5.5 yalnız "yineDeKaydet bir banka hesabının Uyar'ını geçiyorsa → personel B" der. PLAN §2.5:
  bugün eksi bakiye denetimi yalnız nakitte vardır.
- **Davranış:** Kasa Uyar'ını her rol geçebilir. Banka Uyar'ını personel geçerse senaryo hatasıdır.

### K-19 · İskonto oranı "0"

- **Dayanak:** §6.3 iskontolu ve iskontosuz KDV dahil formülleri farklıdır.
- **Davranış:** `iskontoOrani: "0"` iskontosuz sayılır [YAYGIN]. %100 ve üstü senaryo hatasıdır (sıfır tutarlı kalem).

### K-20 · Sıfır tutarlı satır ve mizanda "hareket görmüş"

- **Dayanak:** §4.4: "S = 0: satır yok"; §8.2: "Hareket görmüş her hesap yazılır".
- **Davranış:**
  - Sıfır tutarlı yevmiye satırı hiç yazılmaz: KDV 0, stopaj 0, ücretsiz transferde 770.
  - Mizan yalnız etkin (silinmemiş) satırı olan hesapları yazar. Silinen hareketin hesabında başka satır yoksa o hesap
    mizanda görünmez.
  - Karşılaştırıcı eksik anahtarı {0, 0} saydığı için (§9/2) bu fark yaratmaz.

### K-21 · BELİRSİZ-4'ün denetimi

- **Dayanak:** §5.4: "senaryo aynı gün, aynı hesap ve aynı tutarlı ikincisini yalnız `benzerOnay: true` ile yazar".
- **Kapsam:** Kasa↔Banka (hesaba bağlı), transfer ve Banka Fişleri.
- **Davranış:** Bu işlemlerde aynı gün, aynı ana tutar ve ortak hesabı olan önceki **başarılı** bir işlem varsa ikinci
  adım `benzerOnay: true` taşımalıdır; yoksa senaryo hatasıdır. Ana tutar `tutar`, `brut` ya da `anapara`dır. Önceki
  işlemin silinmiş ya da ters kaydedilmiş olması bunu değiştirmez.

### K-22 · BELİRSİZ-5: hafta sonu ve resmî tatil

- **Dayanak:** §12/5: "Hesaba bağlı tahsilat/ödeme hafta içi tarihle yazılır". PLAN §3.10/2: "Pencere aynı iş günüdür".
- **Davranış:**
  - Hafta sonu yalnız hesaba bağlı `cari_tahsilat`, `cari_odeme` ve `taksit_tahsilat`'ta denetlenir.
  - Resmî tatil denetlenmez; plandaki tatil listesi kaynaklarda yok.
- **BİLİNEN SINIR:** Program resmî tatildeki satırı sonraki iş gününün penceresine sayıyorsa kâhin Benzer İşlem'i
  kaçırabilir. Hafta sonu tarihli bir fatura peşini ile pazartesi tarihli tahsilat arasında da aynı durum olabilir.

### K-23 · BELİRSİZ-19

- **Davranış:** Benzer İşlem Açık iken, kapsamdaki bir satırın etkin eşi yok ama **silinmiş** eşi varsa ve `benzerOnay`
  verilmemişse senaryo geçersizdir.

### K-24 · Eşzamanlı gruplar (`ayniAnda`)

- **Dayanak:** §5.8.
- **Davranış:**
  - Bütün grupların bütün sıralamalarının çarpımı koşulur (en çok 20.000 koşu; üstü senaryo hatası).
  - Herhangi bir sıralamada senaryo hatası çıkarsa senaryo geçersizdir.
  - Aynı grupta tanımlanan bir takma ad o grupta anılamaz.
  - `alternatifler` tekilleştirilir ve kararlı sıradadır. Her alternatif kendi `belirsizler`ini taşır; üst düzeyde
    hepsinin birleşimi yazılır.
  - `retler`, `yinelenenler` ve `atlananlar` her alternatifte **senaryodaki adım sırasıyla** listelenir, yürütme
    sırasıyla değil (§8.5 "Liste sırası adım sırasıdır").

### K-25 · Eksi bakiye: işlem tarihi ve birden çok hesap

- **Dayanak:** §5.3.
- **Davranış:**
  - `d`, işlemin o hesabı azaltan satırlarının tarihidir (silmede silinen satırın tarihi). Bu dilde bir adımın bütün
    satırları aynı tarihlidir.
  - Engelle ihlali varsa `cash-blocked` yazılır; `yineDeKaydet` etkisizdir.
  - Yalnız Uyar ihlali varsa `cash-negative` yazılır, ya da `yineDeKaydet` ile geçer.
  - Aynı adımda ikisi birden olursa K-2 uygulanır.
  - Kredi (300), 102.00 ve 108.00 denetlenmez. 309 için limit `kartLimiti`dir, vadeli hesapta limit 0'dır.

### K-26 · Taksit ayrıntıları

- `taksitNo` kartın taksit sayısını aşarsa senaryo hatasıdır. Taksit tutarlarının bölüştürülmesi hesaplanmaz:
  `taksitNo` yalnız Benzer İşlem hedefini değiştirir. `installment-paid` K8 kapsamı dışındadır (SENARYO-DILI kapsamı).
- Taksit kartı toplamı sıfır olacaksa (peşin = toplam) ya da `"tamami"` sıfır verirse senaryo hatasıdır.
- Fatura açığı ile kart kalanının eşitliği (§7 kural 3) kâhinin cari değişmeziyle her `kontrol` adımında ve sonda
  denetlenir.

### K-27 · İade ayrıntıları

- İadenin iadesi senaryo hatasıdır.
- KDV'li banka masrafının faturası alış faturası sayılır; tek kalemi vardır (hizmet, 770) ve iade edilebilir.
- Aynı iadede aynı kalem iki kez yazılamaz.

### K-28 · Kasa elle hareketinde "açılış" sözcüğü

- **Dayanak:** §4.9: "'açılış' sözcüğü geçmez (bkz. §4.8)". PLAN §11.1 A8.
- **Davranış:** Açıklamada "açılış" ya da "acilis" geçerse (büyük/küçük harf ve Türkçe I/İ dönüşümüyle) senaryo
  hatasıdır.

### K-29 · BELİRSİZ-15'in koşulu

- **Davranış:** Bir ürün hem stoklu alış faturasında hem satış faturasında yer almışsa, sırası ne olursa olsun, o
  andan itibaren `mizan.153` ve `mizan.621` `belirsizler`e yazılır. `kontrol` anlarında da aynı koşula bakılır.
- Kâhin 621 yazmaz; 153'ü yalnız alış ve alıştan iade matrahıyla tutar.

### K-30 · `belirsizler` yolları

- Bir carinin açıkları belirsizse yazılan yollar:
  - `faturalar.<ad>.acik`
  - her taksit kartı için `taksitKartlari.<ad>.toplam`, `.odenen`, `.kalan` (§7 "taksitKartlari.* alanları")
- Birden çok neden varsa virgülle birleştirilir ("BELİRSİZ-11, BELİRSİZ-9").
- `kontrol` anındaki yollar `araDurumlar.<id>.` önekini taşır.

### K-31 · Kredi hesabı ve politika

- **Dayanak:** BELİRSİZ-2 ve BELİRSİZ-3.
- **Davranış:**
  - Kredi hesabı `bakiyeDogrulandi: true` ile açılamaz ya da düzeltilemez; aksi senaryo hatasıdır.
  - `hesap_eksi_politika` yalnız 102 ya da 309 türünde ve yalnız doğrulanmış hesapta kullanılır; aksi senaryo hatasıdır.
  - `eksiBakiyeDenetimi`'nde kredi hesabı her zaman `kontrol_yok` yazılır (doğrulanmamış hesap kuralı, §5.3).

### K-32 · BELİRSİZ-21: Kasa↔Banka hesabı

- Verilen ya da kendiliğinden seçilen hesap vadesiz ya da ticari değilse (diğer, vadeli) senaryo hatasıdır.
- Pasif, kart ya da kredi hesabı → 400 `bank-account-invalid` (§5.2/4).
- Uygun hesap yoksa banka bacağı 102.00'a yazılır (§5.2/1); bu satır hesaba bağlı sayılmaz.

### K-33 · Fatura peşini

- `"tamami"` = toplam − öbür peşin satırlar. Sonuç eksiyse "Σ peşin > toplam" → "4xx"; sıfırsa senaryo hatasıdır.
- Satışta `kart` yolu ve alışta taksit, statik olarak senaryo hatasıdır (§13/7).
- Peşin satırın hesabı §5.2'ye göre seçilir. Açılıştan önceki tarih → `bank-before-opening`.

## Sürüm 2 güncellemesi (10.10.2026, dil `destekofis-senaryo/2`)

Güncelleyen: bağımsız kâhin ajanı (temiz oda: `server/` ve `client/` okunmadı; kaynak SENARYO-DILI.md sürüm 2, plan ve baş
mimarın 10.10.2026 kararları). Değişiklikler dilin "Sürüm 2 değişiklikleri" tablosundaki D1–D7'yi uygular:

- **D1 (§7 kural 6, KARAR):** geri ödenmemiş iadenin kural 5'ten artanı, aynı carinin asıl türdeki (satıştan iade → taksitsiz
  satış faturaları; alıştan iade → alış ve KDV'li masraf faturaları) en eski açık belgelerini kapatır; kalan iade belgesinin
  açığıdır. Bağsız satırların dağıtımı kural 7 oldu. BELİRSİZ-9 kalktı; BELİRSİZ-7 artanı olan satıştan iadeyi de kapsar.
- **D4 (§5.4, §8.3):** yinelenen adımın takma adları çıktıda ikinci anahtar olarak (K-4 değişti, yukarıda); gövde kuralı K-3 zaten böyleydi.
- **D5–D7:** KMH limiti ve eksi açılış vadesiz dışında 4xx; KMH'yi aşan eksi açılış BELİRSİZ-23; vadeli hesapta banka masrafı
  (BSMV/Yok) ve diğer gelir/gider 400 `bank-account-invalid`, faiz gideri / kart borcu kaynağı / kredi hedefi-kaynağı / KDV
  kipli masraf BELİRSİZ-24; kredi anaparası kalan borcu aşarsa ve ters kayıt kredi hesabını borç bakiyesine çevirirse
  BELİRSİZ-25 (çıkış 2).
- **Hakem bulgusu KAHIN-A-YINELEME-SIRASI düzeltildi:** işlem fonksiyonu bir "senaryo kurmaz" denetimiyle (BELİRSİZ-4, 6, 10, 14, 24, 25 …) durursa ve adım başarılı önceki adımın aynı gövdeli yinelemesiyse adım etkisiz yinelemedir (dil §5.4 son madde; §5.6 sırası 3 → 4).
- Testler: `test/bagimsiz/test_surum2.py` (iki kâhine ortak, 18 test, beklenenler dilden elle) + bu klasördeki testler;
  mutasyon: sürüm 2 kurallarına konan 16 hatanın 16'sı yakalandı (model_a 9, model_b 7).
