## Ç7b TAKSİT KÜÇÜK TURU (c7bt): P7 (S219 = A) yapıldı, S200 okundu. Dal ucu `9f50442b` (worktree-agent-ab1c286758106cc24), taban c7b3b-taban = b3a59f2a, PUSH yok

### Ekranda ve sayılarda değişenler (önce → sonra)
Değişen ekran: **Taksitler → Excel / Sheets'ten Yükle** sonuç bildirimi.

- **Telefonu farklı iki "Ahmet Yılmaz" (C1 0532 100 00 01, C2 0532 100 00 02):**
  - Önce: "1 kart oluşturuldu. 1 satır atlandı (Aynı adla açık kart var)". C2'nin kartı da borcu da açılmıyordu (bakiye 0, defter 120 +3.000).
  - Sonra: "2 kart oluşturuldu", atlanan satır yok. C1 bakiyesi 3.000, C2 bakiyesi 2.000, defter 120 +5.000.
- **Telefonsuz "Ahmet Yılmaz" satırı (aynı adlı iki telefonlu kişi var):**
  - Önce: satır atlanıyordu, neden "Aynı adla açık kart var".
  - Sonra: yine atlanıyor, neden "Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin". Kart, cari ve borç açılmıyor.
- **Aynı Excel ikinci kez:** "0 kart oluşturuldu. 2 satır atlandı (Aynı adla açık kart var)". Kart, cari ve 120 değişmiyor (önce de böyleydi).
- **Kilitli dönem:** aynı adlı ikinci kişinin satırı artık kilit nedeniyle atlanıyor (önce ad nedeniyle). Satırın carisi geri alınıyor, yükleme durmuyor.
- **Telefonsuz satır, aynı grupta tek telefonsuz cari (kartsız) ve başka kişinin telefonlu kartı:** önce atlanıyordu, şimdi kart o telefonsuz cariye açılıyor. Aşağıdaki 1. soruya bakın.

### Değişen dosyalar
- `server/routes/accounts.mjs`: kişi eşleştirme kuralı artık tek yerde (`samePerson`). `matchPerson` bunu kullanıyor. `planPerson` kişinin carisini yazmadan buluyor; `createFromPlan` da aynı yardımcıyı kullanıyor, davranışı değişmedi. Yeni dışa açılan `planDuplicate` "aynı kişi", "kesin değil" ya da "başka kişi" sonucunu veriyor.
- `server/routes/plans.mjs`: Excel yüklemesinde açık kartlar (ad + grup, sahibin carisi ve telefonu) yükleme başına **bir kez** okunuyor. Ad karşılaştırması veri tabanıyla aynı: yalnız ASCII harfler katlanıyor. Yüklemede açılan kart listeye ekleniyor. Karar `planDuplicate` ile veriliyor.
- `test/c7bt-ayni-adli-excel-karti-250.test.mjs` (yeni, 11 test), `test/e2e/senaryo-c7bt-ayni-ad-250.mjs` (yeni ekran senaryosu), `test/plans.test.mjs` (bir beklentinin neden metni).
- Kılavuz: `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html` (aynı adlı iki kişi için Telefon kolonu cümlesi) ve `client/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf`. PDF yeniden üretildi, `pdf-denetle` 39/39, kılavuz testleri 17/17.

### Tarama (aynı denetimi taşıyan yollar)
- "Aynı adla açık kart var" ve yalnız ada bakan kart sorgusu yalnız `plans.mjs` içindeki Excel yüklemesinde var.
- Ön izleme (`plans/import/preview`) yinelenen kart saymıyor.
- Tablodan Aktar (`plan-transfer.mjs`) kendi telefonlu kuralıyla çalışıyor, yalnız ada bakmıyor; değiştirilmedi.
- Toplu Taksitlendir cari kimliğiyle çalışıyor; değiştirilmedi.

### Yeni ve değişen testler
- **P7 testi:** yenide iki saat diliminde 23/23 (plans.test ile birlikte).
  - Tabanda iki saat diliminde 9/10 kırmızı. Nedenler okundu: satırlar "Aynı adla açık kart var" ile atlandı, kartsız C2, eski neden metni, kilit yerine ad nedeni.
  - Test (2) "aynı Excel ikinci kez" tabanda doğası gereği yeşil; dişini mutantlar gösteriyor.
  - v2.4.9'un gerçek kodu aynı 9 kırmızıyı aynı nedenlerle veriyor: bugünkü davranış 2.4.9'dan geliyor, gerileme değil.
  - Test (11), hız düzeltmesinin eşdeğerlik testi: ad varyantlarında kararın veri tabanının karşılaştırmasıyla aynı olduğunu sınıyor.
- **Ekran senaryosu:** yenide 21/21, tabanda 15/21. Gerçek tıklama, Tab ve Enter, yavaşlatılmış tarayıcı. Ekran görüntülerine baktım: Taksitler listesinde telefonlarıyla iki ayrı Ahmet Yılmaz kartı görünüyor.

### Kabul maddeleri
- **A, kâhin-defter:** 187/187 önce ve sonra.
- **B, kâhin-cari:** 17.580/17.582 önce, sonra ve hız düzeltmesinden sonra. Kalan iki fark üç koşuda da aynı (d50 KI2 / KI3 toplam), yani bu turdan değil.
  - Kendi kopyamda üretilen yapım aşaması listesinde yalnız bu iki d50 kaydı var; bu turun yeni kaydı 0. Depodaki liste boş, dokunulmadı.
- **C, muhasebe sürücüsü** (sürücüye dokunmadım):
  - Taban: 7.580 / 7.756 geçti, 36 başarısız. Yeni: 7.594 / 7.760 geçti, 22 başarısız.
  - **Kalkan 16 fark:** P7-AYNI-ADLI-EXCEL-KARTI'nın hepsi (s91, iki saat dilimi).
  - **Kalan:** P6 (s81, s82, s94, s103) aynen; başka sınıf değişmedi.
  - **Yeni 2 fark, yalnız UTC:** s91 mz0 ana:120 program 3.200, kâhin 1.200; ana:519 −3.200 / −1.200.
  - Kök neden (okundu): TE1'in yükleme anı 09.03 22:30Z, UTC'de 09.03, İstanbul'da 10.03. Sınıflamada yalnız mz1 için yazılı olan UTC günü farkının aynısı. TE1'in kartı artık açıldığı için görünür oldu; İstanbul koşusunda fark yok. Program hatası değil; sınıflamaya mz0 satırı ana oturumun sürücü bakımında eklenmeli.
  - Hız düzeltmesinden sonraki sürücü fark listesi ilk yeni koşuyla birebir aynı.
- **D, eski sürüm:** v2.4.9 gerçek kodu yukarıdaki gibi aynı sonucu veriyor.
- **E, hız:** temiz 100 binlik veri, kendi kopyamda, özel kilit, 2.000 satır, 3 tur. Tablo aşağıda.
- **F, değişmezler:** rastgele sıra koşusu (400 işlem × 2 tohum) yenide ve tabanda 2/2. Mutabakat Testi yeni testlerin ve ekran senaryosunun sonunda tutarlı.
- **G, ekran:** yukarıda. Komşu ekran senaryosu senaryo-219 74/74 (hız düzeltmesinden önce ve sonra).
- **G2, komşular** (Excel taksit yüklemesi ve cari eşleştirmesine dokunan 30 test dosyası): hız düzeltmesinden sonra UTC 484/484, İstanbul 484/484.

### Hız tablosu
**İlk sürümde kötüleşme çıktı, düzelttim.**

| Ölçüm | Kod | Kilitsiz | Kilitli |
|---|---|---|---|
| Eşit iş, ilk kod (3dbe2009) | taban | 4,8 / 6,3 sn | 5,3 / 6,4 sn |
| Eşit iş, ilk kod (3dbe2009) | yeni | 10,8 / 10,6 / 10,1 sn | 15,4 / 11,9 / 9,5 sn |
| Düzeltmeden sonra (4f1a97fc) | taban | 7,72 sn | 6,51 / 5,91 sn |
| Düzeltmeden sonra (4f1a97fc) | yeni | **3,60 / 3,91 / 3,72 sn** | **4,47 sn** |

- Eşit iş: 1.000 var olan ad ve aynı telefon (iki kodda da atlanır) + 1.000 yeni ad (iki kodda da açılır).
- İlk koddaki kötüleşme yaklaşık 2 kattı. Kök neden: her satırda 11.448 açık kartın hepsi taranıyordu.
- Düzeltmeden sonraki tabloda yalnız yükü 2'nin altındaki geçerli turlar var; geçersiz turlar ölçüm dosyasında işaretli.
- Sonuç: yeni kod en iyi değerde de ortancada da tabandan iyi, kötüleşme yok.
- Olay döngüsü en çok değeri yanıt süresine eşit; eskisi gibi tek atomik işlem.
- Kanıt: `c7bt-hiz-esit-ilk.txt` ve `c7bt-hiz-esit-son.txt`. Karma yük ayrıca `c7bt-hiz-karma.txt`'de; orada iş farklı olduğu için doğrudan kıyaslanmaz.

### S200 (s51) sonucu
- s51 (S120 durumu): önce ve sonra iki saat diliminde 9/9 aynı.
- S200 durumunun kendisi s51'de yok. Kâhin bu durumda bilerek susuyor (model hatası "S120 — elle borçlar kart tutarından az; kâhin susar", README bakım 13'te kullanıcıya sorulacak 1. madde). Bu yüzden program ↔ kâhin karşılaştırması yapılamıyor.
- Not defterindeki kopyada (depoya girmedi) s51'i S200 örneğine çevirip programı okudum:
  - 16.02 gecikmiş 20.000 (kart 0); 02.03 gecikmiş 50.000 (kart 30.000). Bu S200 = A ile aynı.
  - **Doğrulanmadı:** aynı anda Açık Faturalar raporu F1'i kalan 50.000 gösteriyor; A'nın metni "açık F1 20.000" diyor. Kâhin bu durumu kurmadığı için hükmedemedim. Kodlama yapmadım.

### Mutantlar
Hız düzeltmesinden sonra, iki saat diliminde: **9/9 öldü.**

| Mutant | Yakalayan test |
|---|---|
| M1 yalnız ada geri dönüş | 10 test |
| M2 telefonsuz belirsiz satırda kartı aç | (3) ve plans.test |
| M3 kart aramasında grup yok | (6) |
| M4 telefonsuz eşleşmede grup yok | (6) |
| M5 belirsizde hep aç | 4 test |
| M6 carisiz kartta telefona bakmadan "başka kişi" | (8) |
| M7 kendi cariye bakmadan "başka kişi" | (2), (5), (6) |
| M8 Türkçe harf katlama | (11) |
| M9 yüklemede açılan kart listeye eklenmez | (5) |

### KULLANICIYA SORULMALI (S219'un iki okumaya açık alt durumu; kart / borç açılıp açılmamasını etkiliyor)
1. **Telefonsuz satır, aynı grupta tek telefonsuz cari (kartı yok) ve başka kişinin telefonlu aynı adlı kartı.**
   - Kodlanan (A): kart o telefonsuz cariye açılır; cari kuralı kişiyi kesin seçiyor.
   - B: satır atlanır (S219'daki parantezin geniş okuması).
   - Öneri A. Uç durumsa üçüncü seçenek: böyle kalsın (bilinen sınır).
2. **Telefonlu satır ve aynı adlı telefonsuz carinin kartı.**
   - Kodlanan (A): satır atlanır, yeni nedenle. Aynı kişi önce telefonsuz yüklenmiş olabilir; çift borç açılmaz.
   - B: cari kuralı gibi yeni cariyle açılır.
   - Öneri A. Uç durumsa üçüncü seçenek: böyle kalsın.
- Yaygın programların bu durumdaki davranışını gösteren doğrulanmış bir kaynak okumadım.

### Bulgu (kapsam dışı, v2.4.9'dan beri) — programı etkiliyor, karar gerekiyor
- Veri tabanının ad karşılaştırması yalnız ASCII harfleri katlıyor. Bu yüzden "AHMET YILMAZ" ile "Ahmet Yılmaz" (I / ı) farklı ad sayılıyor.
- Aynı kişiler Excel'de büyük harfle yazılırsa hem cari eşleştirmesi hem kart denetimi yeni cari ve yeni kart açıyor: çift borç.
- Testin ilk hâlinde gördüm.
- Eşleştirme davranışını bu turda değiştirmem yasaktı.
- 2.5.0'da mı 2.5.1'de mi düzeltileceği ana oturumun kararı.

### SONRAKİ SÜRÜME (2.5.1)
- Sürücü sınıflaması: s91 mz0 (UTC) satırının eklenmesi ve P7 kurallarının kaldırılması (sürücü bakımı).
- P6 (karar gereği).
- Bildirim atlanan satırın numarasını göstermiyor, yalnız nedenini — görünüm ayrıntısı.

### DOĞRULANMADI
- S200'deki Açık Faturalar "kalan 50.000" gözlemi.
- Tablodaki kayda bağlı satır (yükleme kayıt bağıyla açık) için yeni test yazmadım. Tablodan Aktar testi (G2 içinde, yeşil) bu yolu sınıyor.

### DENENMEYEN
- Tam `npm test` (yapmamam istenmişti).
- Windows ve CI.
- v2.4.9'da kilitli veride güncelleme ve kural farkı akışı: bu tur kural farkı ya da defter değiştirmiyor; D maddesi aynı Excel sonucu olarak yapıldı.
- Karma yükün düzeltmeden sonra yeniden ölçümü.

### CI listesine eklenecek
- `test/e2e/senaryo-c7bt-ayni-ad-250.mjs` (package.json'a ve ci.yml'ye ben eklemedim).

### Commit listesi
- `7863d2e5` nasıl bozulur listesi
- `3dbe2009` kod
- `a096bcb7` kılavuz ve PDF
- `f1f993e4` plans.test
- `3095abe8` kanıt
- `bd08480a` ekran senaryosu
- `bc0463df`, `65bdd8c2`, `7856d294`, `8c3a9948`, `71c0b397` kanıt
- `4f1a97fc` hız düzeltmesi
- `a5aa2706`, `5dc4916a`, `9f50442b` kanıt

Kanıtlar `docs/kanit/2026-11-20/` altında `c7bt-*` adıyla; rapor taslağı `c7bt-rapor-taslak.md`, betikler de orada.

### Ortam
Yük 3,1 / 4 çekirdek, boş bellek yaklaşık 1 GB (kullanılabilir 4 GB), boş disk 8,3 GB. Taban, v2.4.9 ve mutant kopyalarını tam yollarıyla sildim.

### Ana oturumun yeniden koşacağı komutlar (dal ucunda, iki saat dilimi)
- P7 testi:
  - `TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/c7bt-ayni-adli-excel-karti-250.test.mjs test/plans.test.mjs`
  - aynısı `TZ=Europe/Istanbul` ile.
- Eski kod kırmızısı: `git archive c7b3b-taban ':!docs/kanit'` ayrı klasöre, yeni testi oraya kopyalayıp koşun; beklenen 9/10 kırmızı (11 testli son hâlde test (11) tabanda da yeşil).
- Ekran: `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 node test/e2e/senaryo-c7bt-ayni-ad-250.mjs` (eski kod için `DEPO=<eski kök>`).
- Kâhinler ve sürücü: `npm run test:kahin-defter`, `npm run test:kahin-cari`, `node test/bagimsiz/muhasebe-surucu/kos.mjs`.
- Hız: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7bt-ana/hiz-esit.sh` (betiğin kopyası depoda `docs/kanit/2026-11-20/c7bt-hiz-esit.sh`). Özel kilitle koşun; taban kökü yeniden çıkarılmalı, çünkü sildim.