# MUHASEBE SÜRÜCÜSÜ BAKIMI 3 — ajan raporu (AYNEN; ajan a379fddb29e23d196)

## MUHASEBE SÜRÜCÜSÜ BAKIMI 3: RAPOR

Dalı `surucu3-taban` (9c09f18d) noktasına sıfırladım (`git reset --hard`), `git log` ile doğruladım. İş 9 commit oldu, son kanıt commit'i **8a5118ef**. Dal: `worktree-agent-a379fddb29e23d196`. Push yapmadım. Kâhin klasörüne, `server/` ve `client/` klasörlerine yazmadım.

**Kısa sonuç:** Sınama ağacında 117 senaryoyu iki saat diliminde koştum. Sınıflanmamış fark kalmadı (SINIFLANMADI, red farkı, uygulanamayan olay, sınıfsız adım hepsi 0). Kalan 112 kırmızının hepsi P, K ya da R olarak sınıflandı. Bu turda koda giren kurallardan U kalmadı. Ana dalla karşılaştırmada açıklanmayan fark yok. İki bilinçli hata da yakalandı. Kullanıcıya üç soru var (aşağıda).

### 1. Sürücüde değişen eşlemeler (önce → sonra)

**BUGÜN görünümü (`karsilastir.py`):**
- Kaldırılan dönüşümler: C5-ACILIS-519, C5-EVRAK-ACILIS, C5-EVRAK-KARSILIKSIZ, C5-CARI-ACIKLAMA, KG5-EXCEL, KG16-ACIKLAMA, C1-ALT-90, KG15 = B.
- Ç5-B kuyruk raporlarının (gecikmiş, kartlar, açık fatura) eski karşılığı kalktı. Yalnız bekleyen pakete (Ç7b, D) bağlı satırlarda eski kural duruyor.
- Ödeme Hatırlatma artık U ve kimliği Ç5-C. Kural Farkı'nın "0" karşılığı kalktı. S12 için yazılan `kasa_acilistan_once` ve `kasa_acilis_ilk` U satırları kalktı.

**Yeni sınıflar:**
- **SUSMA:** kâhinin sustuğu yer. Geçti sayılmaz, `# skipped` olarak sayılır. Üç kaynağı var:
  - `susmalar` (S168): listelenen carinin 120 ve 128 bakiyeleri ayrı değil toplam olarak karşılaştırılır; 129/644 satırları ile gecikmiş, açık fatura ve hatırlatma raporları karşılaştırılmaz.
  - Ara adım: açılış sonraki bir olayda geliyorsa kâhin o adımda susar (s11, s37'deki koşu hatası buydu).
  - S11.
- **ÖLÇÜLEMEDİ:** siniflama.json'da elle verilen eşleme sınırı.
- Bir siniflama kuralı yalnız tek saat diliminde geçerli olabilir (`tz` alanı).

**Program eşlemeleri (`program.mjs`):**
- **Kural Farkı Düzeltme Fişi:** önce ön izleme okunur. Düğme pasifse kayıt "ekran" reddi olarak yazılır. Değilse imzayla onaylanıp fiş yazılır. Saat en az kilit + 1'e ilerler.
- **`fis_ters`:** senaryonun son etkin düzeltme fişi, Ters Kaydet ucuyla ve kâhinin tarihiyle (API'nin `date` alanı) ters kaydedilir. Bu ekran yolu değil: ekran tarih göndermez, onay metni "bugünün tarihiyle" der; bu iş listesinde 2.5.1 maddesi olarak duruyor.
- **`acilis_onayla`, `acilis_eslestir`, `carisiz_evrak`:** programın kendi uçlarına eşlendi. `evrak_karsiliksiz` için cari seçimi eklendi.
- **2.4.9 kurallı kilit artık eski sürümde konur:** sınanan program bu veriyi göçle açınca kilitli dönem 2.4.9 kopyasıyla donar. Önceki sürücü kilidi yeni programda koyuyordu, bu yüzden Kural Farkı hiç doğmuyordu (s30, s49, s93, s111).
- **Göç:** göçün kendi farkı ayrı bir adım olarak yazılır, eski sürüm adımları karşılaştırılmaz. Kilitten ve göçten sonra dondurmanın bitmesi beklenir.
- **Kart Borcuna Aktar (K-15):** "açılıştan önce" senaryonun alanından değil, kartın kendi açılış olayından türetilir.
- **Silme ve geri yükleme:** Kasa açılışı ve cari satırları için eklendi (R8 ve S51).
- **Cari düzeltmesi (Ç5-B):** gövdede `accountId` gönderilir.
- **Formdaki peşin:** ilgili cari satırı eşlenir; tutar düzeltmesi fatura Düzenle'den, bağ değişimi 409 ile.
- **Cari açılışı:** cari ilk gerektiği olayda açılışıyla birlikte açılır; kayıtta "onceden" diye işaretlenir, karşılaştırıcı kâhinde de o adımda uygular.
- **Taksit kartı tahsilatının carisi** değiştirilmek istenirse "ekran" reddi yazılır (formda Cari alanı yok).
- **Excel kartı (B5):** yükleme anında ve yükleme anı sırasıyla yapılır.
- **Kural Farkı raporu:** fiş varsa ön izlemenin kalan satırları artı alt defter farkı okunur; fiş yoksa ham fark.
- **Sürücü hataları da düzeltildi:**
  - Havale peşini banka hesabı açılmadan gidiyordu, program onu hesabı atanmamış (102.00) yazıyordu.
  - Carisiz açılış evrakı keşidecisiz gidiyordu, hiç açılmıyordu.
- Ödeme Sözü artık "uygulanmadı" (U, kimlik Ç5-C), çünkü yalnız hatırlatma elemesini değiştiriyor.
- Kâhin notu 6 ve 7 zaten karşılanıyordu: POS'lar `bsmv_incl` kipinde kurulu, `s127_tek_yazim` karşılaştırılmıyor.

### 2. Sayılar (iki saat dilimi birlikte, 117 senaryo)

| Koşu | AYNI | U | P | K | R | SINIFLANMADI | ÖLÇÜLEMEDİ | SUSMA | Diğer | fail |
|---|---|---|---|---|---|---|---|---|---|---|
| Taban (9c09f18d, eski sürücü) | 6.670 | 966 | 18 | 0 | 2 | 356 | 42 | – | red farkı 30 · uygulanamayan 180 · sınıfsız adım 220 · koşu hatası 4 | 810 |
| Sınama (yeni sürücü, son koşu) | 6.590 | 892 | 50 | 44 | 18 | **0** | 116 | 14 | red farkı **0** · uygulanamayan **0** · sınıfsız adım **0** · koşu hatası 0 | 112 |

- Son koşuda öz denetim bozuk 0, değişmez 0. Toplam `# tests` 7.724, `# pass` 7.482, `# skipped` 130.
- Saat dilimine özgü tek fark s91'deki R'dir (yalnız UTC).
- **Ana oturumun ön koşusuyla aynı 18 senaryoda:** ön koşu AYNI 700 · U 50 · SINIFLANMADI 98 · red farkı 4 · uygulanamayan 12 · sınıfsız adım 32 · koşu hatası 4 idi. Şimdi AYNI 792 · U 38 · K 20 · R 12 · ÖLÇÜLEMEDİ 8 · SUSMA 2; sınıflanmamış hiçbir şey ve koşu hatası yok.
- **`susmalar` yüzünden atlananlar:** 10 rapor satırı (rastgele-1'de 4, rastgele-2'de 4, s68'de 2) ve 4 adım (s68). Ayrıca 8 ara adım (s11 ve s37) ve S11'den 4 satır (s95).

### 3. P listesi (program hatası ya da eksik yol)

- **P7, yeni — aynı adlı iki kişi (s91):** Excel'den taksit kartı yüklerken aynı adlı ikinci kişinin kartı atlanıyor.
  - Kök neden: `server/routes/plans.mjs:1405-1406`. Yinelenen kart sorgusu yalnız ada bakıyor (`name = ? COLLATE NOCASE`), telefona ve cariye bakmıyor.
  - Örnek: C1 ve C2 ikisi de "Ahmet Yılmaz". C1'in 20,00'lık kartı açılmıyor; program 120 = 12,00, kâhin 32,00.
  - v2.4.9'da ve ana dalda da aynı; gerileme değil.
  - Ders: anayasadaki "aynı adlı iki kişi" kuralı. Önem: düşük-orta.
- **P6, yeni — taksit kartı bağı düzeltilemiyor (s103, s81, s82, s94):** cari tahsilatının taksit kartı bağı tek kayıt düzeltmesiyle değişmiyor; kart tahsilatının Düzenle formunda Cari alanı da yok.
  - Kök neden: `server/routes/accounts.mjs` PUT entries gövdesinde kart alanı yok (yaklaşık 1180. satır); `routes/plans.mjs` PUT entries kartı değiştirmiyor.
  - Bu S44 = A ve S79 = A kararlarıyla çelişiyor ("bağ düzeltmesi kabul"). Önem: düşük (satır silinip yeniden girilebiliyor).
- **Eski, hâlâ geçerli:** P2 (s05, alış iadesi KDV'si, Ç7b), P4 (s14, gecikme zammı tek başına girilemiyor, 2.5.1), P5 (s43, S4 kuralı).
- **Kaldırılanlar:** P3 kalktı, kart faizi artık uygulanıyor. R5'i U'ya çevirdim (S15 = A, Ç7b'nin işi).
- **Doğrulanmamış gözlem:** sahte saat geri alınınca Excel yüklemesi 500 `gate-equivalence` (`dates:future:plan_entries`) verdi. Gerçek kullanımda saat ileri akar; sürücü artık yükleme anı sırasıyla koşuyor, bu yüzden P sayılmadı.

### 4. K listesi (kâhin şüphesi; dayanak alıntılarıyla)

- **s93 (B14) — kâhinin 2.4.9 modeli gerçek v2.4.9 koduyla tutmuyor:** şüpheli caride faturaya bağlı çeki gerçek v2.4.9 B 101 / **A 128** yazıyor (sürücünün eski sürüm okuması, olay 4). Kâhinin 2.4.9 modeli 120'ye yazıyor (README K3 "120'de kalanlar: … Kapatılacak Fatura bağlı tahsilat"; kâhin kendi README'sinde "2.4.9'un gerçek eşleşmesi DOĞRULANMADI" diyor). Sonuç: programda alt defter kural farkı doğmuyor, B14 bu senaryoyla sınanamadı.
- **s78 (S39):** müşteriye kartla ödeme yokken "Kredi Kartına İade" girilmiş. Dayanak (GECMIS-KARARLAR): "P1-b (müşteride 'Kredi Kartına İade' kutusu yalnız caride kartla Ödeme varsa; KULLANICI KARARI)".
- **s104:** formdaki peşin P2, senaryoda Kasa açılışından sonra sıralanmış. Programda peşin faturayla aynı anda girildiği için Kasa açılışı reddediliyor (R8).
- **s108:** kâhin taksit kartı tahsilatını S155 sınırına sokmuyor (borç 7,50 < açık şüpheli 8,00). Dayanak: S155 = A, "tek kural, bütün kayıt türlerinde (tahsilat, …) aynı". 22. olaydaki red bunun sonucu.
- **s42:** S192 = A'ya göre kâhinin M13 ile tek kuyruğun ayrıştığı yerde susması gerekiyor; açık fatura raporunda susmuyor (F1 1.000 / F2 200, program 700 / 500; toplam aynı).
- **s51:** muhasebe kâhini S120 = A'yı kurmamış ("yalnız ELLE borçları eskiden yeniye içine alır"). 02.03 gecikmişi kâhinde 300, programda 500; bakiye aynı.

### 5. R listesi (karar belirsiz)

- **s111 (S180'in alt durumu):** 2026'nın tek düzeltme fişi 2027'de ters kaydedilince program 2027 için yeni bir fiş öneriyor (B 500 700 / A 671 700). Kâhin "kural farkı yok" diyor. Ana dalda da aynı.
- **s62:** Açılış Eşleştirme 127'ye yazamıyor; programda 127 carisiz taksit kartlarının alt defter hesabı.
- **s91 (yalnız UTC):** Excel kartının günü programda makinenin yerel günü, kâhinde İstanbul günü.

### 6. Bekleyen kural farkları (UTC; kimlik: senaryo / denetim)

D2–D4 28/30 · D4-(7) 1/1 · D4-GERI-AL 1/1 · Ç5-C 25/138 · Ç7b-KG2 18/118 · Ç7b-F06 4/74 · Ç7b-KG24 4/42 · Ç7b-KG8 4/22 · Ç7b-(6) 2/12 · Ç7b-(4) 2/3 · Ç7b (S15 = A) 2/3 · Ç7b-KG3 1/6 · Ç7b-KG7 1/1 · Ç5-B1 1/1 · GÖRÜNÜM-YOK (açık kalemler) 30/76 · GÖRÜNÜM-YOK (kilit bağ notu) 1/1.

Bu turda kapanması gerekenlerin (Ç7a KG-6 / K-14 / K-15 / KG-19, Ç5-KG15, S168, S181, R8) hiçbiri listede yok.

- "Ç5-B1 1/1" tek satır. Satırın kimliğinde Ç7b de bulunduğu için U olarak kaldı (eski kural karşılığı Ç7b paketine bağlı).
- GÖRÜNÜM-YOK satırları U sayılıyor, ama gerçekte programda okunacak uç yok; yani karşılaştırılmadı.

### 7. Gerileme denetimi ve testin dişi

**Gerileme:** "eski" = ana dal `claude/epic-thompson-w0lc2l`. Bugünkü ucu **98579e9b**; görev metnindeki 542a85d5 değil. Aynı sürücüyle sınamayla karşılaştırdım: 234 koşunun 200'ü birebir, 34'ü (17 senaryo) farklı. Hepsi pakete atfedildi, sınamada her biri kâhinle AYNI; açıklanmayan fark 0.
- **Ç7a D-07 (kart faizi artık uygulanıyor):** rastgele-1, -2, -3, s13.
- **Ç7a KG-6 (komisyon satış günü, 653):** s08, s23, s72, s75, s77, rastgele-1, -2, -3.
- **Ç7a K-14 / K-15:** s11, s37, s110.
- **Tur 3 (S168 / S181):** s68, s74, s112, s105 (redden kabule), s75 (120 / 128 / 129 / 644), s78 (yalnız red kodu değişti).

**Testin dişi:** sınama kodunun iki ayrı kopyasında birer bilinçli hata.
- **Mutant 1:** KG-6 komisyonu valör gününe geri alındı (`pos-commission.mjs` içinde `SCOPE … AND 1 = 0`). s08, s23, s72, s75 ve s77'de yakalandı: SINIFLANMADI 16, sınıfsız adım 48, fail 78.
- **Mutant 2:** hesapsız hareket sınırı en erken açılışa çekildi (`opening-cover.mjs` içinde MAX → MIN). s110'da yakalandı: SINIFLANMADI 18, fail 34.
- Hatasız sınamada bu senaryolarda sınıflanmamış fark yok.

### 8. Ana oturumun yeniden koşacakları

Komut (çalışma ağacında, ortak kilitle):
```
flock -s -w 3600 <scratchpad>/olcum.lock node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/kos.mjs --senaryo s30,s111,s110,s113,s68 --cikti <klasör> --veri <klasör>
```
Beklenen (iki saat dilimi toplam): **AYNI 250 · U 4 · P 0 · K 0 · R 14 · SINIFLANMADI 0 · ÖLÇÜLEMEDİ 8 · SUSMA 2 (adım 4) · red farkı 0 · koşu hatası 0**. R'nin 12'si rapor satırı, 2'si red; çıkış kodu 1 olur, çünkü R kırmızı sayılıyor.

Senaryo başına (her saat dilimi):

| Senaryo | Beklenen |
|---|---|
| s30 | AYNI 43, geri kalanı 0 |
| s111 | AYNI 15, R 6, 14. olayda R red |
| s110 | AYNI 34, ÖLÇÜLEMEDİ 4 |
| s113 | AYNI 8 |
| s68 | AYNI 25, U 2, SUSMA 1 (adım 2) |

Gerileme için: `python3 -I test/bagimsiz/muhasebe-surucu/gerileme.py <ana dal çıktısı> <sınama çıktısı>` → 34 / 234 farklı.

### 9. Kullanıcıya sorulmalı

1. **S180'in söylemediği alt durum (defter kuralı, ders 43):** kilit yıl sonunu geçtikten sonra 2026'nın TEK düzeltme fişi 2027'de ters kaydedilirse ne olsun?
   - **A** (kâhinin okuması): kural farkı yeniden açılmaz. 2027'de 500 alacak 700 olarak kalır, 671 = 0.
   - **B** (programın bugünkü davranışı): fark yeniden önerilir ve 671'e yazılır. 2027'de 500 = 0, 671 alacak 700.
   - **C:** uç durum böyle kalsın (BİLİNEN SINIR).
   - **Önerim B:** fark gerçek olduğu için A'da sermaye hesabında açılış olmayan 700 kalır. Yaygın programlarda nasıl yapıldığına dair doğrulanmış dayanak yok.
2. **127'ye eşleştirme (s62):**
   - **A:** 127 eşleştirmede hedef olamaz; kâhin senaryosu bunu carisiz Excel kartıyla kursun.
   - **B:** eşleştirme 127'ye yazabilsin.
   - **C:** uç durum (BİLİNEN SINIR).
   - **Önerim A.**
3. **B5'teki "yerel gün":** Excel kartı maddesinin günü hangi saat dilimine göre?
   - **A:** makinenin saat dilimi (program böyle yapıyor).
   - **B:** her zaman İstanbul (kâhin böyle yapıyor).
   - **C:** uç durum böyle kalsın.
   - Bakiye değişmiyor, yalnız gün kayıyor; kurulumlar Türkiye saatinde. **Önerim C.**

### 10. Denenmeyenler ve sınırlar

- **Eski sürüm sınırı:** senaryoda `yedekten` olayından önce yer alan olaylar da eski sürümde koşuluyor. Bu yüzden S51 (s87) ve B11 (s92) programda sınanamadı; ilgili satırlar ÖLÇÜLEMEDİ. Kâhin bakımında yedekten olayları ayrı senaryoya alınmalı.
- **K'ler yüzünden sınanamayanlar:** B14 (s93) ve S39 (s78).
- **s110'un ara raporu mz1:** kâhinin dilinde açılışı olmayan kart hesabı var, programda her kartın açılış tarihi var; ÖLÇÜLEMEDİ.
- **Uygulanmayanlar (U):** Ödeme Sözü (Ç5-C), Devir (D2–D4). Açık kalem ve kilit bağ notu raporları programdan okunmuyor (GÖRÜNÜM-YOK).
- **Fiş ters kaydı** ekran yoluyla değil, API'nin tarih alanıyla sınandı.
- **S177, S178, S182, S184, S185 ve Devir Kapanışı** kâhinin dilinde yok.
- Kâhinin `kural_farki` raporu ile programın ön izlemesini fiş varken kalan satırlar üzerinden karşılaştırdım. 671/681 eşlemesi yalnız fiş varken bu yoldan görülüyor.

### Dosyalar

- Kanıt (8a5118ef): `docs/kanit/2026-11-14/` altında `surucu3-{taban,sinama,eski,mutant1,mutant2}.{json,log}`, `surucu3-gerileme.txt`, `surucu3-gerileme-atif.txt`, `surucu3-mutantlar.txt`, `surucu3-sinama-ozet.json.gz`, `surucu3-eski-ozet.json.gz`.
- Kod: `test/bagimsiz/muhasebe-surucu/` altında `kos.mjs`, `program.mjs`, `karsilastir.py`, `siniflama.json` (41 kural).
- Not defteri (kalıcı değil): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/surucu3-a379/`. Ana dal kopyası `…/surucu3-a379/eski`, mutantlar `…/surucu3-a379/mutant1` ve `…/surucu3-a379/mutant2` altında duruyor; işin bitince tam yoluyla silinebilir. `/dev/shm` altındaki kendi klasörümü sildim.
- Ortam: yük 0,9 / 4 çekirdek, boş bellek 10 GB, boş disk 9,7 GB.
