## Ç7b TUR 2f (devam ajanı) — RAPOR

Bu turda hiçbir ÜRÜN dosyası değişmedi. `git diff c7b2f-taban2..HEAD -- server client tools package.json .github` boş. Önceki ajan da ürün dosyasına dokunmamıştı. Bu turun bütün commit'leri test ve kanıt dosyası.

Dal ucu: `worktree-agent-a207e4248e7dd70da` = **b85d9e27**. Taban `c7b2f-devam` = 2865ab8d olarak doğrulandı. PUSH YOK, zamanlanmış görev kurulmadı.

Ortam (sonda): yük 1,15 / 4 çekirdek, kullanılabilir bellek ~12 GB, boş disk 7,9 GB. Başta disk 4,6 GB'tı (5 GB'ın altı). Bu yüzden eski kod kopyası ve veri kopyaları /dev/shm'de tutuldu ve sonda tam yolla silindi.

### A–G sayıları
**Önceki ajanın yaptıkları** (kanıt dosyalarından aktarıldı, yeniden koşulmadı):

- **D — eski sürüm sınıf testi** (`test/c7b-eski-surum-sinif-250.test.mjs`, v2.4.9'un gerçek kodu)
  - Yeni kodda iki TZ 7 / 7, çıkış 0.
  - Tabanda (c7b2-taban) iki TZ 1 / 7, 6 kırmızı, çıkış 1.
  - Kırmızının nedeni iletide okundu: `no such column: vat_period`, ".90 alt hesapları / 601 / 336.90 yok", kural farkı 11 madde tutmuyor, B-6 ve Kasım yönü.
- **F — değişmezler** (`test/c7b-degismez-250.test.mjs`, tohum 11 ve 23)
  - Yeni kodda iki TZ 2 / 2.
  - Tabanda 0 / 2: tohum 11 adım 5'te, tohum 23 adım 2'de düşüyor.
  - Mutabakat çekirdeği 500 işlem × 2 tohum: taban ve yeni iki TZ'de 2 / 2 yeşil. Bakiye parmak izi taban = yeni (`c7b2f-F-bakiye-*.json`).
- **Mutasyon taraması: 16 mutant.**
  - İlk koşu 14 / 16 yakaladı. Kaçan 2 ve 4'ün testi düzeltildi.
  - İkinci tam koşu iki TZ'de 16 / 16 YAKALANDI. Hepsi değerle (kırmızı sayıları aşağıdaki tabloda).
- **G — ekran**
  - `senaryo-c7b-kabul-250` iki TZ 34 / 34 (önce 30 / 30, E adımı eklenince 34). Tabanda UTC 20 geçti, 5 kaldı.
  - `senaryo-kdv-donemi-250` iki TZ 22 / 22.
- **G2 komşu:** taramayla 48 dosya, iki TZ 508 / 508.
- **Zorlama kipleri** (bitir / gozlem):
  - eski-surum-sinif: ön koşul GERÇEKLEŞTİ, ön koşullu yeşil 1 / 1 (iki TZ, iki kip).
  - degismez: ön koşul GERÇEKLEŞMEDİ, çünkü açılışta bekleyen dondurma yok. Kırmızı sayılmadı (çıkış 2 = "gerçekleşmedi").

**Bu turda yaptıklarım:**

- **A** (`npm run test:kahin-defter`): iki TZ 187 / 187, çıkış 0. Tur öncesi de 187 / 187 (önceki ajan).
- **B** (`npm run test:kahin-cari`): iki TZ 17.582 / 17.582, çıkış 0 (7 bilinen sınır dahil).
  - Yapım aşaması listesi kendi kopyamda (`KAHIN_YAPIM_ASAMASI`) yeniden üretildi: **0 kayıt**. Eski listeyle fark: yeni 0, kapanan 0, değeri değişen 0. Depodaki liste boş.
- **C** (muhasebe sürücüsü, 120 senaryo × iki TZ; dosyalarına dokunmadım)
  - SINIFLANMADI 0, red farkı 0, sınıfsız adım 0, K 0, öz denetim bozukluğu 0. Toplam # tests 7780 / pass 7578 / fail 62 / skipped 140.
  - **P:** P6 (taksit bağı düzeltme yolu) ve P7 (aynı adlı Excel kartı). Bunlara ek olarak **P4** (s14 gecikme zammı V-03, api_yok; iki TZ'de birer adet) çıktı. Bu, "P yalnız P6 / P7" beklentisiyle çelişiyordu. Ders 6 gereği s14'ü Ç7b'den önceki kodda (c7b2-taban) koştum: aynı P4 orada da var (iki TZ, 60 / 62). Yani eski bir fark, Ç7b'nin değil; sınıflamada 05.11'den beri duruyor.
  - **R:** R-S192-BAG-SONRA (iki TZ'de 13'er) ve R-B5 (yalnız UTC, 2).
  - Ç7b / ATANMAMIŞ-S4 / ATANMAMIŞ-ALT-90 farkları KALKTI. Bekleyen Ç7b kimlikleri yalnız tur 3'ün işleri: "Ç7b (S15 = A)", "Ç7b-(4)" (kart küçültme), "Ç7b-(6)" (Kartı Kapat 'Borçta Kalsın').
- **E — hız:** aşağıda.

### Mutant tablosu (ikinci tam koşu, iki TZ aynı; önceki ajan)
| # | Mutant | Yakalayan test (kırmızı / test) |
|---|---|---|
| 1 | gider türü yok sayılır → hep 770 | kitap-turetme 2 / 7 |
| 2 | belgesizde KDV ayrılır | degismez 2 / 2 |
| 3 | belgesiz satışta .90 düşer | eski-surum 5 / 7 |
| 4 | kayıt tahsilatı 649'a yazılır | degismez 2 / 2 |
| 5 | 601 ↔ 600 | eski-surum 5 / 7 |
| 6 | satıştan iade KDV'si hep 391 | eski-surum 3 / 7 |
| 7 | alıştan iade KDV'si hep 191 | eski-surum 3 / 7 |
| 8 | S4 azaltan fark taşınmaz | eski-surum 2 / 7 |
| 9 | KDV İndirim Dönemi yok sayılır | eski-surum 2 / 7 |
| 10 | eski onayla Kartı Kapat kabul edilir | kart-kapat-onay 2 / 2 |
| 11 | carisiz Kasa girişi 649 ana hesapta | eski-surum 5 / 7 |
| 12 | Borç Yaz 602 ana hesapta | eski-surum 5 / 7 |
| 13 | taksit Yeni Borç 602'de kalır | degismez 2 / 2 |
| 14 | B-6 işareti yok sayılır | eski-surum 5 / 7 |
| 15 | kural geçiş günü yok sayılır | eski-surum 5 / 7 |
| 16 | Defter Mutabakatı 336'ya kayıt tahsilatı katılmaz | degismez 2 / 2 |

Sonuç: 16 / 16 yakalandı, kaçan 0.

### E — hız tablosu
Koşullar:
- Veri: temiz 100 bin satırın taze kopyası, her blokta yeniden.
- Taban: c7b2-taban; yeni: 2865ab8d (ürün kodu aynı).
- Özel kilit, TZ Europe/Istanbul, her blokta 5 tekrar.
- Bütün yanıtlar 200; geçersiz blok (yük > 2) 0.
- Hüküm kuralı: hem en iyide hem ortancada %10'dan kötü ve fark ≥ 5 ms.

**Kilitli kip** (4 blok, yük 0,98–1,28): **GEÇTİ, kötüleşen 0.**
- AÇILIŞ 18.366 → 18.259 ms; DONMA 6.238 → 6.166 ms.
- Mizan 2.300 / 2.433 → 2.189 / 2.346.
- Defter Mutabakatı 12.675 / 13.280 → 12.092 / 13.075.
- Mutabakat Testi 7.427 / 8.065 → 7.517 / 7.699.
- KDV Mahsup ön izleme 2.973 / 3.161 → 2.938 / 3.061.
- KDV Mahsup yazımı 2.789 / 3.331 → 2.849 / 2.888.
- Kartı Kapat 776 / 847 → 770 / 835.
- Bütün oranlar ≤ 1,03.

**Kilitsiz kip, birinci ölçüm** (4 blok, taban → yeni sırası, yük 1,22–1,34): **KALDI, 3 kötüleşen.**

| Yol | Taban en iyi / ortanca (ms) | Yeni en iyi / ortanca (ms) | Oran (en iyi, ortanca) |
|---|---|---|---|
| KDV Mahsup ön izleme | 2.693 / 2.748 | 2.984 / 3.104 | 1,11 / 1,13 |
| KDV Mahsup listesi | 1.303 / 1.345 | 1.463 / 1.530 | 1,12 / 1,14 |
| YAZIM KDV Mahsup fişi | 2.542 / 2.699 | 2.868 / 3.117 | 1,13 / 1,15 |

Öbür bütün yollar geçti; Mizan 1,04 / 1,10 ile sınırdaydı.

**Kilitsiz kip, ikinci ölçüm** (6 blok, ters sıra yeni → taban, yük 0,92–1,21): **GEÇTİ, kötüleşen 0.**
- KDV Mahsup ön izleme 1,10 / 1,03; listesi 1,06 / 1,05; yazımı 1,06 / 0,99.
- Mizan 1,01 / 1,06.

İki ölçüm ÇELİŞKİLİ. Tanı (özel kilitle):
- KDV'nin yeni aylık tablosu (figureTable) eski monthFigures ×2'den hızlı: 23,5 ms'ye karşı 39,6 ms. Aynı maddelerde sonuç eşit.
- `ledger.build()` ayrı süreçlerde 1.309 → 1.446 ms ölçüldü. CPU profilinde ise eşit çıktı (1.519 → 1.496 ms). Öz süre farkı build başına yaklaşık +25 ms (journal / classOf / applyDoubtful).
- Yeni ihracat payı alt sorgusu (`exportJson`, rows().invoices) 100 bin veride yaklaşık +20 ms tutuyor.
- KDV Mahsup ön izlemesi ve yazımı build()'i iki kez, listesi bir kez çağırıyor. Bu yüzden build'deki her oynama bu üç yolda büyüyor.
- Gerçek ek maliyet tahminen ~%3; %11–15 büyük olasılıkla süreç arası gürültü. Ancak birinci ölçüm kalıcı kanıt olarak depoda duruyor; hükmü ana oturumun ölçümü vermeli.

Olay döngüsü değerleri tablolarda var. Birçok satırda 0 ms çıkıyor; bu, ölçüm kalıbının sınırı (aşağıda DOĞRULANMADI'da).

### KULLANICIYA SORULMALI
Yok.

### BAŞ MİMAR KARARI GEREKİYOR
1. **E'nin hükmü.** Seçenekler:
   - (a) Ana oturumun hüküm ölçümü, ajan yükü yokken. **Öneri: a.**
   - (b) Küçük bir hız düzeltmesi: `exportJson` alt sorgusundan önce veri tabanında 301 / 302 istisna kodlu kalem var mı diye tek bir `LIMIT 1` ön denetimi; yoksa NULL. Yaklaşık −20 ms; dosya sınırının içinde (ledger.mjs B-3). Bunu kodlamadım: tek başına hükmü değiştirmez ve kabul turunu eşdeğerlik testi + G2 komşu yinelemesiyle genişletir. Ölçüm yine kaldırırsa bir sonraki temiz ajana verilebilir.
2. **Ekran senaryosunun GÖZLEM'i (önceki ajan, DÜŞÜK).** "Farkı Doğuran Kayıtlar"ın "Hesap Farkı" sütunu alt hesabı göstermiyor. Örnek: "649 +₺300,00 · 649 −₺300,00" yazıyor, hangisinin 649.90 olduğu okunmuyor. Öneri: Ç6-EKRAN ya da 2.5.1. Para farkı yok.

### DOĞRULANMADI
- E'nin kesin hükmü (iki ölçüm çelişiyor; yukarıda).
- "Olay döngüsü en çok" değerlerinin bir kısmı 0 ms. Ölçüm kalıbında (ana oturumun olc-c5a2 kalıbı) histogram istek bitmeden sıfırlanıyor; olay döngüsü değeri tam okunmuyor.

### DENENMEYEN
- Görev metninin mutant örneklerinden ikisi ayrı mutant olarak yok:
  - "Kartı Kapat'ta kalanı düş": yalnız 10 (eski onay) var.
  - "kural sürümünü artırma": yalnız 15 (geçiş günü) var.
- `c7b-degismez-250`'nin zorlama kipleri: ön koşul (açılışta bekleyen dondurma) gerçekleşmedi.
- Ekran senaryosunun taban kırmızısı yalnız UTC'de.
- Tam `npm test` (ana oturumun işi), Windows / CI.
- Hız ölçümü yalnız Europe/Istanbul TZ'de.

### CI listesine eklenecek
- `test/e2e/senaryo-c7b-kabul-250.mjs`
- `test/e2e/senaryo-kdv-donemi-250.mjs` (ikisi de ci.yml'de yok)

Not: `test/c7b-kabul-250-mutasyon.mjs` elle koşulan mutasyon betiği.

### Commit'ler (c7b2f-devam..HEAD)
- d9c5e258 — E kanıtı: kilitsiz ve kilitli ölçüm, karşılaştırma, betikler.
- 01352f29 — E ikinci kilitsiz ölçüm ve tanı (profil).
- d187b0aa — madde 7: A / B / C tur sonu.
- b33b5422 — P4'ün eski kodda da var olduğunun kanıtı.
- b85d9e27 — A / B / C koşu betiği.

Önceki ajanın commit'leri: a73e2705, 43d6e228, 4d7b911e, bb4ae1a0, be1938a4, e3199d5e, 709bb3f0, 473e4a96, 2865ab8d. Kanıtların hepsi `docs/kanit/2026-11-20/c7b2f-*` altında.

### Ana oturumun yeniden koşacağı komutlar
Dal b85d9e27'de çalıştırılır. `KANIT_DIR` her komutta senin kendi kanıt klasörün.

- **A ve B, iki TZ:**
  ```
  TZ=<UTC|Europe/Istanbul> HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<klasör> node tools/kanit.mjs kos x -- npm run test:kahin-defter
  TZ=<UTC|Europe/Istanbul> HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=<klasör> node tools/kanit.mjs kos x -- npm run test:kahin-cari
  ```
- **Yapım aşaması listesi** (kendi kopyanla):
  ```
  KAHIN_YAPIM_ASAMASI=<kopya> node test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz
  ```
- **C:**
  ```
  node test/bagimsiz/muhasebe-surucu/kos.mjs --cikti <klasör>
  python3 -I docs/kanit/2026-11-20/c7b2f-ABC-surucu-sinif.py <klasör> test/bagimsiz/muhasebe-surucu/siniflama.json
  ```
- **D / F**, iki TZ ve taban kopyası:
  ```
  node --test test/c7b-eski-surum-sinif-250.test.mjs test/c7b-degismez-250.test.mjs
  ```
- **Mutasyon:**
  ```
  node test/c7b-kabul-250-mutasyon.mjs
  ```
- **Ekran:**
  ```
  PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 node test/e2e/senaryo-c7b-kabul-250.mjs
  ```
  Aynısı `senaryo-kdv-donemi-250.mjs` için.
- **Hız** (özel kilit, taban klasörü /dev/shm'de yeniden açılmalı):
  ```
  timeout -k 5 7100 bash docs/kanit/2026-11-20/c7b2f-E-hiz2.sh <kilitsiz|kilitli> 5
  python3 -I docs/kanit/2026-11-20/c7b2f-E-hiz-karsilastir.py <çıktı>
  ```
  Ölçüm betiği `docs/kanit/2026-11-20/c7b2f-E-olc-c7b.mjs.txt`. Kullanmadan önce `.mjs` uzantısıyla not defterine kopyalanmalı ve içindeki not defteri yolları düzeltilmeli.

Not defterim (betikler, küçük çıktılar): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2f-dv`. Önceki ajanın not defteri `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2f-ag` (~193 MB) benim yolum değil, silmedim.
