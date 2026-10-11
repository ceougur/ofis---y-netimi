# model_b — Kâhinin Kararları

Kâhin: `test/bagimsiz/model_b/model.py` (Python 3, yalnız standart kütüphane, tamsayı kuruş, ağ ve saat yok).
Dil sürümü: `destekofis-senaryo/2` (sürüm 1'den güncelleme: en altta).

## Temiz oda beyanı

- **Okunan kaynaklar:** yalnız şu dosyalar.
  - `docs/BANKA-MODULU-PLAN.md`
  - `docs/BANKA-MODULU-TALIMAT.md` (madde 3–11 ve 43)
  - `test/bagimsiz/SENARYO-DILI.md`
  - `test/bagimsiz/senaryolar/kabul-1-16.json`
- **Okunmayanlar:** `server/`, `client/`, `tools/`, `test/` (yukarıdakiler hariç), `test/bagimsiz/model_a/`,
  `docs/*KANIT*.md`, `docs/*ESLEME*.md` ve git geçmişi.
- **Beklenen dosyanın sırası:** `kabul-1-16.beklenen.json` kâhin çıktısı üretildikten **sonra** açıldı ve yalnız ikinci
  karşılaştırma olarak kullanıldı.
- **CLAUDE.md:** oturuma kendiliğinden yüklendi ve programın bazı davranışlarını anlatıyor (fatura kapama gibi). Kaynak
  olarak kullanılmadı. Planda dayanağı olmayan her kural aşağıda karar olarak yazılı.

## Kabul 1–16 sonucu

- Planın sayıları birebir tuttu: `kontrol` adımlarındaki `planBeklenen` yapraklarının **28/28**'i, fark **0**. Bu sayılar
  kabul 1–16'nın sekiz `kontrol` adımından geliyor.
- **Sayı uyuşmazlığı yok.** Ne planın sayısında ne bu kâhinin yorumunda düzeltme gerekmedi.
- Elle yazılmış `kabul-1-16.beklenen.json` ile yaprak yaprak karşılaştırıldı: 252 yaprak aynı. Yalnız `kaynak`
  (`kahin` / `plan-elle`) ve beklenen dosyadaki serbest `notlar` alanı farklı.
- Planın başka sayıları da bağımsız senaryolarla üretildi (`test_model.py`):
  - **§3.7 #11 ücretli transfer:** Ziraat 89.994,75; 770 = 5,25.
  - **§3.7 #12–18:** BSMV dahil 10,50 → 10,00 + 0,50. KDV dahil 120 → 770 100 + 191 20. Faiz 1.000 / %15 → 850 / 150 /
    1.000. Ayrıca kart borcu, kredi ve diğer gelir/gider.
  - **§12.5 adım 33 mizanı (ödeme yolundan bağımsız satırlar):** 600 = 35.000, 610 = 2.500, 391 = 6.500; Ürün A 9,
    Ürün B 6.
  - **§12.5 adım 37:** Engelle'de eşzamanlı iki ödeme → iki alternatif, birinde `cash-blocked`.
  - **Talimat 11:** taksit Ödendi; cari −10.000; Garanti +10.000.
  - **SENARYO-DILI §14** örneği.

## Doğrulama komutları

```
python3 -I test/bagimsiz/model_b/model.py test/bagimsiz/senaryolar/kabul-1-16.json   # çıktı JSON, çıkış 0
python3 -I test/bagimsiz/model_b/test_model.py                                       # 46 test
python3 -I test/bagimsiz/model_b/mutasyon.py                                         # 22 mutant, 22 yakalanır
```

- **Bayt bayt aynılık:** aynı senaryoya iki koşu aynı baytları verir (`test_cli_bayt_bayt_ayni`).
- **Kâhinin kendi değişmezleri:** biri bozulursa kâhin çıkış 3 ile durur. Denetlenenler:
  - her fişte Σ borç = Σ alacak
  - mizan dengesi
  - §7 cari değişmezi
  - eksi belge açığı ve eksi stok olmaması
- **Geçersiz senaryo** çıkış 2 ile durur; stdout boş kalır, neden stderr'e yazılır.

## Kararlar

Biçim: **K-no. Karar.** — dayanak (plan ya da dil alıntısı) ve gerekçe. Koddaki `K<no>` yorumları bu numaralara bakar.

**K1. Açılış eksi bakiye denetimine girmez.**
- Kapsam: `hesap_ac` ve `acilis_duzelt`'in yazdığı açılış satırları; bunlar §5.3 denetimine girmez.
- Dayanak:
  - PLAN §3.10/§10.3: "Açılış tarihi D'nin gün başındaki banka bakiyesi S".
  - K7: "Açılış bakiyesi bilinçli girilene … kadar denetim 'Kontrol Yok'tur".
- Gerekçe: Açılış bankanın beyan ettiği gerçektir, hareket değildir. Örnek: borçlu açılan kurumsal kart limit
  girilmemişse `cash-negative` almamalı.
- Durum: plan açıkça söylemiyor (İNCELE).

**K2. Sıfır tutarlı isteğe bağlı alanlar ücretsiz/faizsiz sayılır.**
- `transfer.ucret: "0"` ücretsizdir; `ucretVergi` gerekmez.
- `kredi_odeme.faiz: "0"` faizsizdir.
- Ham biçimde (`ucretHam: "0"`, `faizHam: "0"`) banka ucu kuralı geçer: 400.
- Dayanak: PLAN §12.5 adım 15–16 "Transfer Ziraat → Garanti 20.000, **ücret 0**".

**K3. Dil belgesinde çelişki: ret mi, geçersiz senaryo mu? → Ret seçildi.**
- Çelişen yerler:
  - §13/8: "transfer'de ucret varsa ucretVergi var; banka_masraf KDV kipinde saglayici ve fatura var" (geçerlilik).
  - §5.6: "400 girdi (… `ucretVergi` eksik)".
  - §4.20 tablosu: "KDV kipinde `saglayici` yok → 4xx".
- Seçilen ret kodları:
  - `ucretVergi` eksik → **400**
  - KDV kipinde `saglayici` yok → **"4xx"**
- Gerekçe: ret programda gözlenebilir bir "Nasıl Bozarım" durumudur.
- İstisna: `saglayici` var ama `fatura` takma adı yoksa senaryo **geçersizdir**, çünkü oluşan fatura çıktıda
  adlandırılamaz.
- **Dil sürümü 2'de netleşmeli.**

**K4. Yinelenen adımın takma adları önceki varlığı anar.**
- Yinelenen adımın (istek kimliği, aynı gövde) `ad` alanı ve iç içe adları önceki adımın varlığına bağlanır. İç içe
  adlar: faturadaki `taksit.ad` ve KDV'li masraftaki `fatura`.
- Çıktı haritalarına **iki ad da** yazılır (`faturalar`, `taksitKartlari`, `bankaHesaplari`, …) ve değerleri aynıdır.
- `ozet` ve `mizan` hesap kodundan hesaplandığı için çift sayım olmaz.
- Dayanak:
  - §5.4: "`ad`'ı önceki adımın hareketini anar".
  - §8.3: "açılmış her banka hesabının takma adı".
- **Koşucu da iki adı yazmalı;** yazmazsa fark İNCELE'dir.

**K5. §7 kural 5'te "iadenin tutarı" = iadenin 1–4 sonrası kalanı.**
- Satıştan iadeye `kapatilacakFatura` ile bağlı ödeme yapılmışsa, iadenin kapanan kısmı asıl faturadan **ikinci kez
  düşülmez**.
- Gerekçe: aksi hâlde §7 değişmezi bozulur.
  - Örnek: satış 1.000, açık iade 300, iadeye bağlı ödeme 300 → bakiye 1.000.
  - Kuralın harfiyle: asıl 700, iade −300 → değişmez tutmaz.

**K6. Ham tutar biçimi.**
- Tanınan biçim yalnız `-?rakamlar(,rakamlar)?`. Nokta, binlik ayırıcı ve bilimsel gösterim → **400**.
- Modül uçları: ondalık kaç hane olursa olsun `rh` ile kuruşa yuvarlanır ("1,005" → 1,01). Yuvarlanınca sıfır kalan
  değer → 400 ("0,004").
- Banka uçları: 2'den çok ondalık → 400.
- `acilisBakiyesiHam`: sıfır olabilir; eksi yalnız vadesiz, ticari ve diğer türünde olabilir (§3.3 istisnası). Öbür
  türlerde eksi → 400.
- Dayanak: PLAN §5.1 ve §2.1. Bu biçim seçimi YAYGIN.

**K7. `cari_ac`'ta geçersiz IBAN → 400 ret.**
- Dil cari için ret yazmıyor; `hesap_ac` kuralıyla tutarlı tutuldu.
- Dayanak: PLAN §9.2/9 "IBAN `isValidIban`".

**K8. Silme yetkisinde "nakit hedef" = hesaba bağlı olmayan her hedef.**
- Kapsam: nakit, 102.00 ve 108.00 satırları.
- Dayanak: PLAN §9.2/4 "Nakit ve hesabı atanmamış satırlarda bugünkü kural sürer".
- Ek: `kasa_banka` hesaba bağlıysa (hesap atanmışsa) "hesaba bağlı hedef" satırına girer.

**K9. Hesap uygunluğu (§5.2 dışındaki işlemler).**
- Banka Fişi (masraf BSMV/Yok, faiz, diğer), transfer, kart borcu ve kredi işlemlerinde hesap 102 türünde olmalı:
  vadesiz, ticari, **vadeli** ya da diğer.
- Kart ya da kredi hesabı, ya da pasif hesap → **400 `bank-account-invalid`**.
- KDV kipli masraf "§4.13 kurallarıyla peşin havale" olduğundan havale uygunluğu geçer: vadeli uygun değildir.
- Dayanak: PLAN §3.5 "Vadeli … yalnız transfer ve faiz".

**K10. BELİRSİZ-5 denetimi yalnız hafta sonunu yakalar.**
- Hesaba bağlı `cari_tahsilat`, `cari_odeme` ya da `taksit_tahsilat` Cumartesi/Pazar tarihliyse → geçersiz senaryo.
- **Resmî tatiller denetlenmez** (ör. 29.10). Senaryo yazarı Benzer İşlem'e girebilecek satırları tatile yazmamalı
  (bilinen sınır).

**K11. Bir adımda birden çok ihlal (BELİRSİZ-17).**
- Kâhin önceliği en yüksek olanı `retler`'e yazar.
- Ayrıca `belirsizler`'e `{"alan": "retler.<adım id>", "neden": "BELİRSİZ-17"}` ekler.
- Sınır: eksi bakiye yalnız başka ihlal yokken sınanır; başka bir ihlalle birlikteliği sayılmaz.

**K12. Aynı öncelik içindeki sıra.**
- Ret önceliği §5.6'daki sıradır. Aynı öncelikte koddaki ekleme sırası geçerli; örnekler:
  - kilit → açılış öncesi → Σ peşin > T
  - kilit → açılış kuralları
  - ters edilemez / iki kez → kilit
- Senaryo tek ihlal kurduğu için sonuca etkisi yoktur.

**K13. Kasa'nın Uyar'ını her rol geçebilir.**
- `yineDeKaydet` ile Kasa'nın Uyar'ını geçmek her role açıktır.
- Dayanak: §5.5 tablosu yalnız **banka hesabının** Uyar'ını geçmeyi personel için B sayıyor; o durum geçersiz
  senaryodur.

**K14. BELİRSİZ-20: Kasa satırları tarih sırasıyla.**
- 100 hesabına yazan her yeni satırın tarihi, etkin Kasa satırlarının en geç tarihinden önce olamaz → aksi geçersiz
  senaryo.
- Kapsam: fatura peşini, iade geri ödemesi, Kasa↔Banka ve nakit tahsilat/ödeme dahil.

**K15. `acilis_duzelt` ve dönem kilidi.**
- Eski açılış tarihi kilitliyse → **409** (kod yok). Dayanak: PLAN §3.8 "Kilitli açılış düzeltilmez".
- Eski açılış açık, yeni tarih kilitliyse → **409 `period-locked`** (genel tarih kuralı §5.1).

**K16. "Hesaba bağlı ilk hareket" (`bank-opening-after-first`).**
- Hesabın alt hesabına satır yazan etkin her fiş sayılır; ters kayıt fişleri dahil.
- Sayılmayanlar: açılış ve açılış tersi; silinmiş hareketler.
- Yeni tarih ilk hareketle **aynı gün olabilir**. Dayanak: "ilk hareketten **sonra** olamaz".

**K17. Dönem kilidi ileri gidemez, geri alınamaz.**
- `donem_kilidi` bugünden sonraki tarihe ya da mevcut kilitten önceki tarihe → geçersiz senaryo.
- Dayanak: dilde kilit kaldırma yok; §4.3 "bugun'den sonra olamaz [YAYGIN]".

**K18. Stopaj ve sıfır satırlar.**
- `stopajOrani` %100'ü aşarsa → geçersiz senaryo.
- Tutarı 0 olan fiş satırı yazılmaz (stopaj 0, net 0, faiz 0, ücret 0). Mizan bakiyesini değiştirmez.

**K19. Sıfır tutarlı taksit kartı açılmaz.**
- Taksitli faturada kartın tutarı (T − Σ peşin) 0 ise → geçersiz senaryo.

**K20. Benzer İşlem'in "önceki satır" havuzu.**
- Havuzda fatura peşin satırları ve iade geri ödemeleri de vardır; hedefleri kendi belgeleridir.
- Bunlar **yeni** satır olarak hiçbir zaman reddedilmez.
- Sonuç: aynı gün, aynı hesap ve aynı tutarla **o faturaya** `kapatilacakFatura` bağlı bir `cari_tahsilat` →
  `bank-similar`.
- Dayanak: PLAN §3.10/2 "Hedef: … fatura (Kapatılacak Fatura ya da peşin satırın faturası)".

**K21. Kredi hesabının politikası `kontrol_yok` yazılır.**
- `eksiBakiyeDenetimi`'nde kredi hesabı `kontrol_yok` görünür; BELİRSİZ-2 gereği hep doğrulanmamış açılır.
- Kâhin kredi hesabını eksi bakiye için denetlemez.

**K22. `tarih` alanı yalnız deftere tarihli yazan işlemlerde.**
- Deftere tarihli yazmayan işlemlerde `tarih` → geçersiz senaryo ("bilinmeyen alan").
- Bu işlemler: `hesap_ac`, `acilis_duzelt`, `hesap_durum`, `hesap_eksi_politika`, `cari_ac`, `urun_ac`, `stok_giris`,
  `ayar`, `donem_kilidi`, `ters_kayit`, `sil`, `saat`, `kontrol`.
- Dayanak: §3.2 "Deftere yazmayan işlemlerde … kullanılmaz"; ters kaydın ve silmenin tarihi kuralla belirlenir.

**K23. IBAN ve kod karşılaştırması.**
- IBAN'da boşluklar atılır ve büyük harfe çevrilir. Aynı IBAN denetimi bu normalleştirilmiş biçimle yapılır.
- Hesap Kodu birebir metin karşılaştırılır.

**K24. Engelle ihlali ile Uyar ihlali aynı adımda.**
- `yineDeKaydet` yoksa → `cash-blocked` + BELİRSİZ-17 işareti.
- `yineDeKaydet` varsa → yalnız Engelle ihlali kalır.

**K25. Belirsiz carinin taksit kartları yaprak yaprak işaretlenir.**
- §7 Kesinlik gereği belirsiz sayılan carinin kartları `belirsizler`'e yaprak yaprak yazılır:
  `taksitKartlari.<ad>.toplam|odenen|kalan`.

**K26. BELİRSİZ-15 sıradan bağımsız işaretlenir.**
- Hem stoklu alışı hem satışı olan ürün varsa (sıra fark etmez) `mizan.153` ve `mizan.621` `belirsizler`'e girer.
- Aynı işaret, koşul o anda geçerliyse `araDurumlar`'a da yazılır.

**K27. "Hareket görmüş hesap" (§8.2) = en az bir etkin satırı olan hesap.**
- Hareketi silinmiş hesap mizanda görünmeyebilir.
- Karşılaştırıcı eksik anahtarı {0, 0} saydığından fark doğmaz.

**K28. Alternatifli çıktının biçimi.**
- Üst düzeyde yalnız `dil`, `senaryo`, `kaynak`, `alternatifler` ve `belirsizler` (bütün alternatiflerin birleşimi)
  yazılır.
- Alternatifler kanonik JSON metnine göre sıralı ve tekildir. Her alternatif §8.1 alanlarının tamamını taşır.
- Gruplar birden çoksa her durum dalı ayrı ayrı sürdürülür.

**K29. Çıkış kodları.**
- 0 = başarı
- 2 = geçersiz senaryo ya da okunamayan dosya
- 3 = kâhin değişmezi bozuldu

**K30. `hesap_durum` aynı duruma: etkisiz başarı.**
- Ret değildir.

**K31. Silme ve ters kaydın hedefleri.**
- `sil`:
  - Hedefi dilde olmayan bir varlık türüyse (fatura, hesap …) → geçersiz senaryo.
  - Banka Fişi, transfer ya da ters kayıt hareketiyse → "4xx".
- `ters_kayit`:
  - KDV'li masraf, `kasa_banka` ya da `ters_kayit` hedefi → geçersiz senaryo (BELİRSİZ-16).
  - Listede olmayan öbür hareketler (ör. `cari_tahsilat`) → "4xx".

**K32. BELİRSİZ-10 kapasitesi.**
- Bağlı (`kapatilacakFatura`) satırın tutarı, belgenin **kural 1–4 sonrası** açığını aşarsa → geçersiz senaryo.
  - FIFO dahil edilmez.
  - Bu satır hariç tutulur; aynı belgeye bağlı öbür etkin satırlar düşülür.
  - Geri ödenmiş iade belgesinin kapasitesi 0'dır.
- Bağlanan belge: aynı carinin **taksitsiz** belgesi. Tahsilatta satış ya da alıştan iade; ödemede alış, satıştan iade
  ya da KDV'li masraf faturası. Aksi geçersiz senaryo.

**K33. BELİRSİZ-4 denetimi geniş tutuldu.**
- Kapsam: Kasa↔Banka, transfer ve Banka Fişi ailesi. Tür, yön, silinmiş ya da ters kaydedilmiş olmasına bakılmaz.
- Önceki bir hareketle aynı gün, ortak bir hesap (hesapsız Kasa↔Banka'da 102.00) ve aynı ana tutar varsa
  `benzerOnay: true` istenir; yoksa geçersiz senaryo.
- Ana tutar: tutar; faizde brüt; kredi ödemesinde anapara.
- Gerekçe: `similarOk:true` göndermek programda zararsızdır. Programın bu işlemlerde ne yaptığı belirsizdir.

**K34. BELİRSİZ-19: silinmiş satırla aynı anahtar.**
- Silinmiş bir satırla aynı Benzer İşlem anahtarını taşıyan yeni hesaba bağlı satırda `benzerOnay: true` yoksa →
  geçersiz senaryo.
- Yalnız Benzer İşlem Uyarısı açıkken denetlenir.

**K35. Peşinde `"tamami"` sıfır çıkarsa geçersiz senaryo.**
- Öbür peşin satırlar faturayı tam karşılıyorsa `"tamami"` 0 olur → geçersiz.
- Öbür satırların toplamı T'yi aşıyorsa `"tamami"` hesaplanmaz; adım "Σ peşin > T" (4xx) ile reddedilir.

**K36. "Azalan hesap" ve Kasa politikası.**
- §5.3'teki "azalan hesap" = adımın satırlarının o hesaptaki **net** etkisi < 0. Fatura peşin satırları birlikte
  netlenir.
- Kasa'yı azaltan bir adım geldiğinde Kasa politikası verilmemişse → geçersiz senaryo (BELİRSİZ-1). Denetim adım
  çalışırken yapılır; Kasa'yı azaltan silme de buna girer.

**K37. Takma ad tanımları istek gövdesine girmez.**
- §5.4 gövdesinden yalnız senaryoda var olan takma ad **tanımları** çıkarılır: faturadaki `odeme.taksit.ad` ve KDV'li
  masraftaki `fatura`. Programa gönderilmezler.
- Gerekçe: aynı fatura isteği yeni bir kart adıyla yinelendiğinde 409 değil yineleme olmalı.
- **Bu hata önce kâhinde vardı; deneme koşusunda bulundu ve düzeltildi** (`test_fatura_yinelemesi_taksit_adi_govdede_degil`).

**K38. Cari hesabı belge türünden değil cari türünden gelir.**
- Satış faturası "tedarikçi" türü cariye kesilirse cari satırı 320'ye gider.
- Dayanak: §4 gösterimi "c(X) = X carisinin hesabı: müşteri → 120, tedarikçi → 320".

**K39. Yineleme kuralları.**
- Yineleme yalnız **başarılı** önceki adıma göre yapılır. O adımın hareketi sonradan silinmiş olsa da yeni adım yine
  yinelemedir; etkisi yoktur.
- Aynı kimlikle gelen adımda 403 ya da 400 ihlali varsa yineleme değil ret yazılır (öncelik 1–2, §5.6).

**K40. Kullanıcı `Y` her zaman vardır.**
- `kullanicilar`'da yoksa eklenir; `Y`'ye başka rol verilmişse → geçersiz senaryo (§3.1).

## Programla karşılaştırmada dikkat (İNCELE adayları)

- **K1:** borçlu açılan kart ya da KMH'li eksi açılış ile Uyar.
- **K3:** `ucretVergi` / `saglayici` eksikliği.
- **K4:** yinelenen adımın ikinci takma adı.
- **K5:** bağlı ödemeli açık iade.
- **K20:** peşinli faturaya aynı gün aynı tutarda bağlı tahsilat.
- **§4.8 Kasa açılışı:** kâhin `B 100 / A 500` yazar (YAYGIN). Program 649 yazarsa İNCELE.

## Sürüm 2 güncellemesi (10.10.2026, dil `destekofis-senaryo/2`)

Güncelleyen: bağımsız kâhin ajanı (temiz oda: `server/` ve `client/` okunmadı; kaynak SENARYO-DILI.md sürüm 2, plan ve baş
mimarın 10.10.2026 kararları). Değişiklikler dilin "Sürüm 2 değişiklikleri" tablosundaki D1–D7'yi uygular:

- **D1 (§7 kural 6, KARAR):** geri ödenmemiş iadenin kural 5'ten artanı, aynı carinin asıl türdeki (satıştan iade → taksitsiz
  satış faturaları; alıştan iade → alış ve KDV'li masraf faturaları) en eski açık belgelerini kapatır; kalan iade belgesinin
  açığıdır. Bağsız satırların dağıtımı kural 7 oldu. BELİRSİZ-9 kalktı; BELİRSİZ-7 artanı olan satıştan iadeyi de kapsar.
- **D4 (§5.4, §8.3):** yinelenen adımın takma adları çıktıda zaten yazılıyordu (K4); gövdede anılan takma adlar artık varlık kimliğine çevrilir ve deftere yazan işlemde `tarih` o günün tarihiyle gövdeye girer (model_a K-3 ile aynı anlam).
- **D5–D7:** KMH limiti ve eksi açılış vadesiz dışında 4xx; KMH'yi aşan eksi açılış BELİRSİZ-23; vadeli hesapta banka masrafı
  (BSMV/Yok) ve diğer gelir/gider 400 `bank-account-invalid`, faiz gideri / kart borcu kaynağı / kredi hedefi-kaynağı / KDV
  kipli masraf BELİRSİZ-24; kredi anaparası kalan borcu aşarsa ve ters kayıt kredi hesabını borç bakiyesine çevirirse
  BELİRSİZ-25 (çıkış 2).
- **Hakem bulgusu KAHIN-B-KASA-HAREKET-SIL düzeltildi:** doğrulayıcı `kasa_hareket`'in `ad`ını hareket olarak tanımlar (§4.9 "silinecekse zorunlu"); Kasa elle hareketi silinebilir.
- Testler: `test/bagimsiz/test_surum2.py` (iki kâhine ortak, 18 test, beklenenler dilden elle) + bu klasördeki testler;
  mutasyon: sürüm 2 kurallarına konan 16 hatanın 16'sı yakalandı (model_a 9, model_b 7).
