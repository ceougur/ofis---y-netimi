# UD DÜZELTME TURU 2 — RAPOR

Ortam (bitişte): yük 0,5 / 4 çekirdek, bellek boş 12 GB, disk boş 5,6 GB.

**Kısaca:** Önceki ajanın düzeltmeleri doğrulandı. Mutabakat tohum 2, 3, 6, 7 ve 10 artık yeşil. Üç kırmızı kalıyor:
- **Tohum 8:** aynı günde şüpheli kaydın sırası. Hata 2.4.9'da da var. Bir para / sıra kuralı sorusu, kullanıcıya gitmeli.
- **Uzun 10.000 (tohum 11):** iki denemede de 6900 saniyeye sığmadı. Sonuç BELİRSİZ.
- **Kâhin cari:** 598 fark aynen duruyor, hiçbiri kapanmadı. Bunlar UD düzeltmesiyle ilgisiz, 2.5.0'da doğmuş ayrı bir küme. 167'sinde v2.4.9 kâhinle aynı sonucu veriyor, yani gerileme adayı.

Kâhine dokunmadım. Ürün koduna da yeni değişiklik yapmadım. PUSH YOK.

## ÖNCEKİ AJANIN COMMIT'LERİ — DOĞRULAMA
- **Taban:** worktree yanlış tabandan açılmıştı (master b7ac47a7). `git merge udfix-e7934c5e` yalnız CLAUDE.md ve GECMIS-KARARLAR'da çakıştı. Bunun nedeni master tabanıydı, yamalar değil. Birleştirmeyi geri aldım, dalı çalışma dalının ucu 4d9d147a'ya `reset --hard` ile kurdum ve yeniden birleştirdim; çakışma olmadı → 3175b26c.
- **Benim commit'lerim:** 5fea60d6 ve 3974c939. İkisi de yalnız kanıt (docs/kanit/2026-11-26/).
- **Yeni test `test/tyk-kilit-olcum-250`:**
  - Yeni kodda 8/8 geçti, iki saat diliminde.
  - Eski kodda (e7934c5e, git archive ile ayrı kopya) 1/8, iki saat diliminde de **beklenen nedenle**:
    - `Σ kalem 211926.73 ≠ bakiye 211719.68`
    - `taksitli fatura açığı 1068.72 > kartın kendi kalanı 781,40`
    - rastgele üreteçte `tohum 7001 cari 30: Σ kalem -1982.12 ≠ bakiye -2007.57`
  - "Üretici sınıfı gördü" alt testi eski kodda yalnız sayaç eksik kaldığı için düşüyor; bu ikincil.
- **Mutantlar:** KD2-d, KD4-a ve KD4-b ÖLDÜ. Üç mutantlık bu koşu GEÇTİ (3/3).
- **Ek tarama:** aynı üreteçle 400 tohum × 250 = 100.000 cari tarandı. İki değişmez de tuttu (44/44). Tarama sınıfları: kilit izinin değiştirdiği 5.472 cari, ön ödeme ölçümlü 888 cari, taksitli fatura denetimi 137.930.

## 1. KÖK NEDENLER (koddan ve en küçük örnekten)

**cd33accd — tohum 2 / 3 / 7**
- **En küçük örnek, programın HTTP uçlarıyla (8 adım):**
  1. Taksitli satış F1 5.944,84 (6 taksit)
  2. Alacak 32.083,69 (24.08)
  3. F2 250.811,27 (02.09, vade 29.09)
  4. Dönem kilidi 30.08
  5. Stoktan satış 393,67 (21.09)
  6. C1'e Taksit Tahsilatı 4.817,64
  7. Mevcut Borç kartı C2 207,05
  8. C2'ye Taksit Tahsilatı 8.528,77; ardından kilit kaldırılır
- **Sonuç:** e7934c5e'de Σ açık kalem 211.926,73 ≠ bakiye 211.719,68. Yeni kodda Σ = 211.719,68. Aynı veri kilitsiz girilince e7934c5e'de de doğru çıkıyor.
- **Ne yanlış sayılıyordu:**
  - C1'in taksitleri kilitli dönemde Alacak'la bağsız kapanmıştı.
  - Karar (3) gereği C1'e sonradan alınan kart tahsilatı bağsız paraya dönüşüyor. Bu para, vadesi önce gelen stok borcunu kapatıyor; o borç C2'nin taşıyacağı borçtu.
  - S101 ölçümü yalnız sınırsız geçişte yapılıyordu. Sınırsız geçişte tahsilat C1'e bağlı kaldığı için ölçüm bu kapanışı görmüyordu.
  - Son (sınırlı) geçişte C2 hiçbir borç tüketmiyor, ama tahsilatı borcu olmayan bir taksiti kapatıyordu. Kalemler bakiyeyi 207,05 aşıyordu.
- **Değişiklik neden doğru:** ölçüm sınırlı geçişte de yakınsayana dek yineleniyor. Kural aynı S101 = A kuralı.
  - Kilit izi olmayan carinin kod yolu değişmedi.
  - İlk ölçümü kararlı olan caride sonuç eskisiyle aynı.
  - **Hata düzeltmesidir, kural yorumu değil.**

**fa87ae7b — tohum 6 (34 satırlık fikstür)**
- **Ne yanlış sayılıyordu:**
  - Karar (3)'ün sınırı ("kilitli dönemde bağsız kapanmış kısım") bütün bağların serbest sayıldığı ölçüm geçişinde ölçülüyordu.
  - Son geçişte o bağsız para başka kaleme gidiyordu. Bağ, sınır kadar kısılmış kalıyordu.
  - Sonuçta taksit ne bağsız parayla ne bağla kapanıyordu: fatura açığı 1.068,72, kartın kendi kalanı ise 781,40.
- **Değişiklik:** sınır, son geçişte kilit gününe kadar *gerçekten* bağsız kapanan tutara indiriliyor (yalnız azalır, en çok 12 tur). Bu fikstürde sonuç kilitsiz hâliyle aynı (781,40).
- **Kural yorumu mu?** Hayır, tutarlılık düzeltmesi. Karar (3) yalnız gerçekten bağsız kapanmış kısmı korur. Eski kod, kapanmamış bir kısım için bağı kısıyordu.
- **BAŞ MİMAR NOTU:** "Gerçek kapanış = son geçişteki dağılım" seçimi bir uygulama tercihidir. İstenirse kullanıcıya gösterilebilir.

**0296d755 — motor modeli, S206 (tohum 8 işlem 3332, uzun 11 işlem 6089)**
- Program S206/S211 = A gereği kapanmış kartı "kapalı" gösteriyordu. Model kartı açık sayıyor, motor bunu uyuşmazlık diye yazıyordu.
- Tohum 8'de 3332 artık geçiyor.

## 2. S206 dayanağı (iş listesi C, satır 553; AYNEN)
"A: S15 bu karta da uygulanır — kart kapanır, kartın tahsilatı avans olur (sonradan kesilen 500'lük fatura 200 açık). B: kart açık kalır … C: uç durum böyle kalsın (BİLİNEN SINIR). ÖNERİ A = UYGULANDI"

**Ders 40 değerlendirmesi:**
- Kapanma kuralı ve "tutar = net tahsilat" karara dayanıyor; programdaki karşılığı plans.mjs closeForInvoice / settleCoverOnCancel.
- **Ancak** model, kartın faturayı içine alıp almadığını kendisi kurmuyor. Faturadan sonra açılmış aday kartlardan programın kapattığını benimsiyor. Tek denetimi: tutar = kendi tahsilatı = modelin tahsilatı.
- Bu kısmi bir uydurmadır: "hangi kart kapanmalı" sorusu motorda bağımsız sınanmıyor. Bağımsız sınama kâhinde var (bakım 21, S206 = A). Bakiye değişmezi de bundan etkilenmez.
- Bunu kabul edilebilir buluyorum ama kayda geçmeli. Motora kapsam modeli eklemek 2.5.1'e.
- Benimsenen kartın gerçekten faturayı içerdiği tek tek doğrulanmadı.

## 3. Yeniden koşular (ürün kodu 3175b26c)
| Koşu | Sonuç |
|---|---|
| Mutabakat 5.000, tohum 2 | YEŞİL |
| Tohum 3 | YEŞİL |
| Tohum 6 | YEŞİL |
| Tohum 7 | YEŞİL |
| Tohum 10 | YEŞİL |
| Tohum 8 | KIRMIZI, tek fark: işlem 2608 supheli-tahsil |
| Uzun 10.000, tohum 11 | İki kez zaman aşımı (124): bir kez dört koşu paralelken, bir kez tek başına. Günlükte ✗ yok; kaç işleme ulaşıldığı okunamadı → BELİRSİZ. Yerelde 7000 sn'ye sığmıyor. |
| Kâhin cari 1-30 × 120 (mutasyonlu) | 175.073 / 175.671 — 598 fark, UD ile birebir; 0 kapandı, 0 yeni |
| CI kâhin cari | 25.164 / 25.164, iki saat diliminde |
| CI kâhin defter | 187 / 187, iki saat diliminde |
| Komşu taraması (33 dosya, test/ taramasıyla) | 401 / 401, iki saat diliminde |

Ek durumlar:
- Yapım aşaması listesindeki kayıtlar: 0.
- Kâhin klasöründe e7934c5e'ye göre fark yok.

**Tohum 8 farkı — en küçük örnek (HTTP, 6 adım):**
1. Borç 33.847,62
2. Şüpheliye Al 924,56 (20.09)
3. 26.09: Şüpheliden Çıkar
4. 26.09: Şüpheliye Al 33.847,62
5. 26.09: tahsilat 23.236,09 → **409** "120 = −924,56"

Aynı tahsilat ertesi gün girilince 200 dönüyor. v2.4.9'da da aynı 409 → **ÖNCEDEN VAR.**
- **Kök neden:** aynı günün sınıf sırası "al → karşılık → değersiz → alacak → çıkar" (plan K3, doubtful-gl ORDER). Çıkarma yazım sırasında önce yapılmış olsa da sırada en sona düşüyor. Bu yüzden tahsilat önce çıkarılmış eski kayda yazılıyor ve kapı reddediyor.
- **Sınıf: (d).** Program K3'e uyuyor, motorun beklentisi bu reddi bilmiyor.

**Kâhin cari'nin 598 farkı — sınıflama:**
- **431 fark** kâhinin "2.5.0 kararıyla değişen" sınıfında.
- **167 fark "SINIF DIŞI".** Bunların hepsinde v2.4.9 programı kâhinle aynı sonucu veriyor; yani bu farklar 2.5.0'da doğmuş, gerileme adayı (ders 6).
  - 123'ü tek senaryodan geliyor (s1-13), tek zincirden.
- Farklar 16 senaryoda. 'Değersiz' adımları silinince yalnız 3 senaryo temizleniyor, çoğu sürüyor.
- **En küçük örnekler (yeni = aday, v2.4.9 = kâhin):**
  - **KC-1 (s1-13, 6 adım):**
    - Fatura G1 → aynı gün G1'e bağlı tahsilat → Şüpheliye Al 4.421,71 → Değersiz 4.421,71.
    - Değersiz reddediliyor: "kalan 1.545,26".
    - Tahsilat bağsız girilince, ya da şüpheliye alma ertesi güne / tahsilat bir önceki güne kaydırılınca geçiyor.
    - Değersiz'in sınır denetimi (lib/bank/doubtful.mjs:584) kaydın gün sonu kalanını okuyor. Bu kalan, S25(c) = A'nın aynı gündeki bağlı payını içeriyor.
    - Sınıf: (b) şüphesi ya da (d).
  - **KC-2 (s1-27, 10 adım, tedarikçi):** alış faturası A1'in açığı: program 130,57, kâhin ve v2.4.9 741,16. Sınıf belirlenmedi.
  - **KC-3 / KC-4 (s1-3):** 'Değersiz' sonrası S96 'Tahsil Edilecek Borç' tutarı ve s047 Kalan. Bunlar 2.5.0 sınıfında.
- Kök nedenleri DOĞRULANMADI. Ayrı bir inceleme turu gerekiyor.

## 4–5. Eski kod kırmızısı ve v2.4.9
- Eski kod kırmızıları yukarıda.
- v2.4.9'da Tek Yükümlülük Kuyruğu ve karar (3) yok; tohum 3 / 6 sınıfı **2.5.0'da doğdu**. Aynı 8 adımda v2.4.9'un C1 kartı tahsilatı 4.817,64'ü kendi taksitlerine sayıyor, F2'nin açığı 242.489,55.
- Şüpheli sınıfı (tohum 8) ÖNCEDEN VAR.

## 6. Düzeltme
Yapılmadı. Kalanların ikisi para / sıra kuralı sorusu; kâhin farkları ise kapsamlı bir inceleme istiyor.

**Hız (ders 53):** cd33accd ve fa87ae7b, kilit duyarlı bağı olan carinin kuyruğunda ek geçiş ekliyor. Bu kuyruğu okuyan yollar: cari kartı, fatura listesi, Vade Takip, zil, takvim, mutabakat kapısı. Ölçümü ana oturum yapar.

## KULLANICIYA SORULMALI
- **S-UD8 (aynı gün Şüpheliden Çıkar → yeni Şüpheliye Al → tahsilat):**
  - A: Aynı gün, çıkarma tahsilattan önce yazıldıysa önce işlensin; tahsilat yeni kayda düşer, kabul edilir.
  - B: K3 sırası kalsın (red sürer).
  - C: Uç durum böyle kalsın (BİLİNEN SINIR).
  - **Öneri C.** 2.4.9'dan beri böyle, veri bozulmuyor, ertesi gün girilince geçiyor. Ama UD tohum 8'in yeşile dönmesi için motorun bu reddi beklemesi gerekiyor; bu bir test değişikliği.
- **S-KC1 (aynı gün, şüpheliye almadan önce yazılmış bağlı tahsilat):**
  - A: Değersiz sınırı aynı günün sırasına uysun; Değersiz önce gelir, tam tutar kabul edilir (kâhin ve 2.4.9 böyle).
  - B: Bugünkü red kalsın.
  - C: Uç durum böyle kalsın.
  - **Öneri A.**
- **UD kapısı için karar gerekiyor:** kâhin farkları 2.5.0'da çözülecek mi (yeni inceleme turu), yoksa 2.5.1'e mi kalacak? S262 yeniden açılmalı.

## DOĞRULANMADI
- Uzun 10.000 tohum 11 (iki kez zaman aşımı).
- 0296d755'te benimsenen kartın gerçekten faturayı içerdiği.
- Kâhin farklarının (KC-1 … KC-4) kök nedenleri.
- fa87ae7b'nin sınır döngüsü ile ön ödeme döngüsü arasında, sınırın yeniden düşmesi gereken bir durum. Kodda böyle bir durum için yineleme yok; 100.000 cari taramasında da görülmedi.

## SONRAKİ SÜRÜME (2.5.1)
- Mutabakat motoruna kapsam modeli (S110 / S120).
- Üreteçte tohum 7020 ve 7030 aynı sayıları veriyor; tohum çakışması şüphesi.
- `--her` > 1 olduğunda S206 adayı bir sonraki denetime kadar bekliyor.

## Dosyalar
- Kanıt: `docs/kanit/2026-11-26/` (ud2-*, `ud2-ornek/` içinde betikler, çıktılar ve kâhin özeti)
- Eski ve v2.4.9 kopyaları: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud2-r4k9/` (`eski`, `eski-kanca` — yalnız okuma kancalı, `v249`)
- Worktree'de `node_modules` bağı var; tam yolla kaldırılmalı.
