# DAR KONTROL — Ç5-A TUR 2e (birleşim 7429fedc; önceki 04302dcf)

Kodu değiştirmedim, commit ya da push yapmadım. Çalışma ağacında yalnız `reset --hard 7429fedc` yaptım ve node_modules bağını ekledim (`git status -sb`: yalnız `?? node_modules`, son commit 7429fedc). /dev/shm'deki kopyalarımın hepsini tam yoluyla sildim.
Ortam (sonda): yük 3,2 / 4 çekirdek (başka işler de çalışıyordu), boş bellek 14 GB, boş disk 6,5 GB.

**Özet:** gerileme yok. YÜKSEK yok. Bir ORTA var; gerileme değil ve kullanıcıya sorulmalı. Ayrıca dört DÜŞÜK var.

## GERİLEMELER — YOK
Fiş ve aday kararı yokken birleşim öncesi (04302dcf) ile sonrası (7429fedc) BİREBİR aynı. Karşılaştırılan çıktılar: Mutabakat Testi, `/api/workspace/ledger`, Yevmiye, Hesap Mizanı, Alt Hesap Mizanı, Defter Mutabakatı, aday listesi ve bütün maddeler.
- Üç fikstür × iki TZ: surum-2.4.9-s127 (15 madde), surum-2.0.26-zincir (430 madde), s127-kilitsiz (9 madde).
- temiz-100k (153.803 madde), kilitsiz ve 30.06.2026 kilitli × iki TZ.
- Çıktı: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2e-q/esd-kos.out`
- Süreler aynı düzeyde (örnek: Mutabakat 7,2 ↔ 7,3 sn; kilitliyken 21,9 ↔ 20,5 sn). Bunlar paylaşılan kilitle, yük altında alındı; ölçüm sayılmaz.

## BULGULAR

### ORTA-1 — Kilit, sonraki yılda yazılmış düzeltme fişinin yılından GERİ alınınca ön izleme 2026'ya 671'li fiş öneriyor
Gerileme değil: eski kod aynı satırları öneriyor. Yeni test y5 bu davranışı bilerek sabitliyor: `test/kural-farki-yil-250.test.mjs:81` ("fişin yılı > eşleme yılı: fişin tersi").
- **Yer:** `server/lib/ledger-opening.mjs:377`. Fişin yılı eşleme yılından büyükse fişin bütün satırları eşlenmiş toplamdan düşülüyor. Bu yüzden 2027 fişinin 671 satırı, 2026 eşlemesinde 671'i ters çeviren bir satır üretiyor.
- **Betik:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2e-q/p/hedefli.mjs` (vaka A; v2.4.9 verisi).
- **Çıktı:** `hedefli-yeni-Europe_Istanbul.out` ve `hedefli-yeni-UTC.out` (iki TZ aynı); defter dökümü `a-dokum.out`. Hepsi aynı not defteri klasöründe.
- **Kurgu:** bugün 10.01.2027 → R1 (700) reddi → kilit 31.12.2026 → Fiş 2027-000001 (B 500 700 / A 671 700), satır "Düzeltildi".
- **(a) Kilit kaldırılıp 30.11.2026'ya konunca:**
  - Satır: "fazla 700 — ters kaydedin".
  - Ön izleme aynı anda 01.12.2026 tarihli B 671 700 / A 500 700 fişini öneriyor.
  - Kaydedilince satır kayboluyor ("tamam"). Ama defter yanlış:
    - 2026: 602 −700, 671 +700 (borç), 500 −700 → 2026 kârı 700 eksik, 2026 sonunda 500 Sermaye 700 fazla.
    - 2027: 671 −700, 500 +700 → 2027 kârı 700 fazla.
  - Doğru çare, 2027 fişini kendi yılında (2027 açık) ters kaydetmekti.
- **(b) Kilit doğrudan 30.11.2026'ya geri alınınca:**
  - Satır "kalan 700" diyor; ön izleme B 671 700 / A 602 700 öneriyor.
  - Kaydedilince 2026 mizanında 671 borç 700 ve 602 alacak 700 görünüyor (brüt yanlış, yıl neti aynı); satır "Düzeltildi (iki fiş)" diyor.
  - Eski kodda satır "Düzeltildi" diyordu, ön izleme yine fiş öneriyordu.
- **Kök neden:** S174 = A "fiş kendi yılında düzeltilmiş sayılır" kuralını yalnız fişin yılı < eşleme yılı için uyguluyor. Kilit geri alındığında (fişin yılı > eşleme yılı) karar metni iki okumaya açık.
- **Sınıf:** ORTA. Programın kendi yolundan (kilit ilerlet → fiş → kilidi geri al → ön izleme → kaydet) dönem sonucu kayıyor ve program sonra "tamam" diyor. Ancak seyrek (yıl sonunu aşmış kilidin geri alınması). → **KULLANICIYA SORULMALI** (aşağıda).

### DÜŞÜK-1 (K-a) — Yıl sonundan sonra "fazla" ipucu "ters kaydedin" diyor, ekrandan ters kayıt 409 alıyor
- **Yer:** `server/lib/ledger-snapshots.mjs:1146`.
- **Betik:** hedefli.mjs vaka B; çıktı aynı dosyalarda.
- Ekran gövdesiyle (`{ requestId }`, tarihsiz — `client/assets/hof-kural-farki.js:93`) yapılan ters kayıt 409 period-locked alıyor. Nedeni: asıl fişin tarihi 2026 ve 2026 kilitli.
- API'den 2027 tarihli ters kayıt (S180 = A) "tamam" diyor ama 2027'de 602 borç 700 kalıyor.
- Ön izleme ise B 681 700 / A 500 700 öneriyor. Bu M7'ye uygun: 2027'de 681 +700.
- Sakınca: ekrandan yanlış defter oluşmuyor (409 engelliyor) → DÜŞÜK.
- **Öneri:** fişin yılı < eşleme yılı ise ipucu "ön izlemedeki fişi kaydedin" desin.
- Kapsam dışı not (bu fark değiştirmedi): `hof-kural-farki.js:88` onay metni "bugünün tarihiyle yazılır" diyor, sunucu ise asıl fişin tarihini kullanıyor.

### DÜŞÜK-2 (K-a tutarlılığı; uç durum) — "Fazla" önerisinde 602 satırı 681'e gidiyor, 671 satırı ise 671 olarak ters çevriliyor
- **Betik:** hedefli.mjs vaka D.
- 2025 farkı 2026 fişinde 671'e düzeltilmiş, sonra 2027'de fazla olmuş: öneri B 671 700 / A 500 700.
- Aynı yılın 602'li fişi aynı durumda: öneri B 681 700 / A 500 700.
- Net sonuç ikisinde de doğru; yalnız hesap seçimi farklı → soru (öneri: C).

### DÜŞÜK-3 — Yaşayan mutantlar (eksik test; ürün bugün doğru)
- **K-c-satir-yili (E6) eşdeğer DEĞİL.** Vaka A(b)'de mutantta satır "Düzeltildi" diyor, ön izleme 700 öneriyor. Gerçek kodda satır "kalan 700" (`hedefli-mutant-Kc.out`). Testler yakalamıyor.
- **P3-yon-ham** (671 / 681 yönü kalan farktan değil, ham farktan): saf girdide gerçek kod B 681 700, mutant B 671 700 üretiyor (`p/p3-saf.mjs`). Kısmi fazla düzeltme + yıl sonu testi yok.
- **Y2-ortu-once** (`cover || lock`): kilit ≠ örtü yalnız dondurma sürerken oluyor (ön izleme pasif). Gözlenebilir fark üretemedim → eşdeğer adayı.

### DÜŞÜK-4 (SÜREÇ KURALI: kapı dışı) — Yönetici denetimi kapı kopyasına bakmıyor
- **Yer:** `server/routes/opening-review.mjs:47`. Denetim yalnız `opening_review <> ''`'ye bakıyor; `decide` ise `opening_review_gate` kararlıysa da kabul ediyor.
- **Betik:** `p/kapidisi.mjs`.
- Muhasebe kilitli R1'e ret verdi: 403. `opening_review` dışarıdan '' yapıldı (kapı kopyası 'candidate' kaldı). Muhasebe yine ret verdi: 200, satır `rejected/rejected`.
- Programın kendi yolundan üretemedim → DÜŞÜK, BİLİNEN SINIR.

## RASTGELE SIRA (ders 17)
`p/sira.mjs`: 300 tohum × 16 adım × iki TZ × eski / yeni kod. Adımlar: tek / toplu karar (onay / ret / Geri Al), kilit ileri / geri / kaldır (30.11, 29.12, 30.12, 31.12, 01.01, 09.01), fiş, ters kayıt, gün (31.12 → 01.01 → 10.01 → 2028).

| Değişmez | Yeni kod | Eski kod |
|---|---|---|
| I1: satır kalanı = ön izleme toplamı | 0 ihlal | **36 ihlal (ORTA-1 deseni)** |
| I2: kayıttan sonra ön izleme "nothing" | 0 | 0 |
| I4: 2027 fişinde 602, 2026 fişinde 671 / 681 olmaz | 0 | 0 |
| I3: program "tamam" derken defter = karar | 45 ihlal, hepsi S180 = A (API'den sonraki yıl tarihli ters kayıt: 2027'de 602 +700) | aynı 45 |

İki TZ aynı. S180 ihlallerini ekrandan üretemedim (ekran ters kayda tarih göndermiyor). Rastgele yürüyüş ORTA-1'in yolunu bulmadı; onu hedefli vaka A buldu.
Çıktılar: `sira-yeni-*.out`, `sira-eski-*.out`.

## Yıl dönümü tablosu (vaka C; iki TZ aynı)
Hepsinde satırlar `B 500 700` ile birlikte.

| Kilit | Bugün | Fiş tarihi | Sonuç |
|---|---|---|---|
| 30.12 | 31.12 | 31.12 | A 602 700 → kaydedildi, Düzeltildi |
| 31.12 | 31.12 | 01.01.2027 | A 671 700, pasif (lock-today) |
| 31.12 | 01.01 | 01.01.2027 | A 671 700 → kaydedildi |
| 01.01.2027 | 01.01 | 02.01.2027 | pasif (lock-today) |
| 01.01.2027 | 10.01 | 02.01.2027 | A 671 700 → kaydedildi |
| 30.12 | 10.01.2027 | 31.12 | A 602 700 (yıl, fişin yılı) |
| 29.12 | 30.12 | 30.12 | A 602 700 |

## EŞZAMANLILIK / SİLİNENLER / YEDEK / İKİ ŞİRKET
Betik `p/es.mjs`, iki TZ.
- **İki yönetici aynı anda onay ↔ ret:** 200 / 200; sonuncusu kazanıyor, ikisi de işlem kaydında.
- **Muhasebe + yönetici aynı anda Geri Al:** 403 / 200.
- **İki fiş aynı anda:** 200 / 409 rule-diff-nothing; tek fiş yazıldı.
- **Toplu karar ↔ kilit değişikliği aynı anda:** istekler sıraya giriyor; önce kilit giderse toplu karar 403 ve hiçbiri yazılmıyor; yarım yazım yok.
- **Silinenler:**
  - Kilitli satır silinemiyor (409).
  - Açık dönemdeki reddedilmiş aday silinip geri alınınca `rejected` olarak dönüyor; fiş ve satır tutarlı.
- **Yedek → ters kayıt + Geri Al → geri yükleme (001, yeniden açılış):** ön izleme, satır, kararlar ve yıl bazında defter AYNI.
- **002 şirketi:** aday, fiş ve satır boş; 001'e karışmıyor.

## YETKİ TABLOSU
Vaka E5; kilit 10.11.2026 (R2 kilit gününde, R3 açık). Reddedilen hiçbir istek veri tabanında iz bırakmadı (durum, kapı kopyası, işlem kaydı ve fiş sayısı değişmedi).

| Rol | Kilitli / kilit günü (karar, Geri Al) | Açık satır | Toplu (açık + kilitli) | Toplu (yalnız açık) | Ön izleme / fiş |
|---|---|---|---|---|---|
| personel | 403 | 403 | 403 | 403 | 403 / 403 |
| avukat | 403 opening-review-locked | 200 | 403 | 200 | 403 / 403 |
| muhasebe | 403 opening-review-locked | 200 | 403 | 200 | 403 / 403 |
| yönetici | 200 | 200 | 200 | 200 | 200 |

Aynı adlı iki carinin 403 iletisi kayıtları yalnız tarih ve tutarla ayırıyor.

## TEST DİŞİ
- **Birleşim öncesi kodda (kendi kopyamda) kırmızı:**
  - kural-farki-yil-250: 6 / 7 kırmızı. Nedeni `ruleDiffCorrectionYear is not a function`; y7 ise "fiş 1'in 700'ü yeniden önerilmez" (ORTA-1'in kendisi).
  - acilis-olabilir-yetki-250: 3 / 3 kırmızı (200 ≠ 403).
  - kural-farki-duzeltme-250: 1 kırmızı (ipucunda ekranın yeri).
  - s160-kilitli-tahsilat-bagi-250: 8 / 8 yeşil (yalnız test eklendi; beklenen).
  - Ekran senaryosu senaryo-acilis-olabilir-250: eskide 43 / 45 ("satır 0"), yenide 45 / 45.
- **Yeni kodda UTC'de dört test yeşil:** 7 / 3 / 8 / 8.
- **Mutantlar (15):**
  - ÖLDÜ (12): Y1, Y3, T1 (ters kaydın yılı), P1, P2, B1 (toplu süzme), B2 (toplu yalnız ilk), K1 (kilit günü `<`), U1 (Geri Al serbest), Y4 (yetki), M1 (ileti sayısı), L1 (liste ofseti; ekran 42 / 45).
  - YAŞADI (3): Y2, P3, K-c (DÜŞÜK-3).
  - Taban 6 dosya yeşil. Çıktı: `mutant.out`, `e2e-mutant-L1.out`.
- **G2 komşular** (taramayla 42 test dosyası): iki TZ'de 426 / 426.

## BAŞ MİMAR KARARLARI
- **K-a — Kısmen doğru.** B 681 / A 500 M7'nin sonucu ve ön izleme ile satır tutarlı. Ama ipucunun önerdiği ters kayıtla çelişiyor (ekranda 409; API'de S180 → 2027'de 602). Ayrıca 671'li fişin fazlasında 681 değil 671 kullanılıyor (DÜŞÜK-1, DÜŞÜK-2).
- **K-b — Ekranda çıkmaz yok.** Ekran yalnız yöneticide (`system.manage`) ve yönetici hiç reddedilmiyor. Bütün olarak ret yalnız API'deki Muhasebe / Avukat'ı etkiliyor. Açık satırlar ayrı toplu kararla 200 alıyor, ileti yöneticiye kalan kayıtları sayıyor. Kilit sonradan ilerleyince Geri Al yönetici yetkisine geçiyor; test bunu sınıyor, ben ayrıca denemedim.
- **K-c — Eşdeğer değil.** Kilit geri alınınca gözlenebilir fark var (DÜŞÜK-3).
- **K-d — Tutarlı.** Ön izleme, Mutabakat ve Yönetim satırı aynı byYear okumasını kullanıyor. Yeni kodda 9.600 adımda I1 sıfır ihlal; 45 sonraki yıl tarihli ters kayıt dahil.

## KULLANICIYA SORULMALI
İş listesi C / D'de aynı soru yok (aramada tur 2e kayıtları dışarıda tutuldu).

**Soru 1 (ORTA-1, defter kuralı):** kilit, yazılmış düzeltme fişinin yılından geriye alınırsa ne olsun?
- **A (öneri):** sonraki yılın fişi kendi yılında sayılır. Kilitli döneme fiş önerilmez. Fiş fazlaysa ipucu "Fiş 2027-… kendi yılında ters kaydedin" der; fark kapanmışsa "Düzeltildi".
  - Mizan 2026: 671 = 0, 500 = 0. Mizan 2027: (a)'da 0, (b)'de 671 −700.
- **B:** bugünkü davranış.
  - (a)'da 2026 kârı 700 eksik, 2027 kârı 700 fazla; 2026 sonu 500 +700 fazla.
  - (b)'de 2026'da 671 borç 700 / 602 alacak 700.
- **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- Kaygı: ürün riski (dönem sonucu kayıyor, program "tamam" diyor). Seyrek.
- Yaygın programlarda: doğrulanmış dayanak yok.

**Soru 2 (DÜŞÜK-2):** önceki yılın 671'li fişi yeni yılda fazla görünürse karşı hesap ne olsun?
- **A:** 681 (M7'ye tutarlı).
- **B:** bugünkü davranış — 671 ters çevrilir.
- **C (öneri):** uç durum böyle kalsın; net sonuç ikisinde de aynı.

## DOĞRULANMADI
- Y2 mutantının eşdeğerliği.
- "Ekran yalnız yöneticide": koddan okudum (admin.html + `HOF.can("system.manage")`), ekranda denemedim.

## DENENMEYEN
- Windows.
- Mobil yazma.
- 450 adaylık sayfa senaryosu (3. sayfa bitince 2. sayfaya dönme).
- Silinmiş evrakın Silinenler'den, iptal edilmiş faturaya geri alınması (yalnız test eklendi).
- Ayrı hız ölçümü (dışlayıcı kilitle ölçmedim).
- Eski sürüm 2.0.26 zincirinde düzeltme fişi.

## NOT DEFTERİ KLASÖRÜ
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2e-q`
- `p/`: betikler (ortak, sablon, sira, hedefli, es, a-dokum, kapidisi, p3-saf, mutant.py, mutkopya.py, esd).
- `*.out`: çıktılar. `hedefli-yeni-ist.out` İLK koşudur, yıl bazındaki defter sayıları yanlış yardımcıyla alındı (`book({from})` açık dönemi süzmüyor); onun yerine `hedefli-yeni-Europe_Istanbul.out` geçerli.
- `kanit/`: kanit aracının çıktıları.
- Önceki dar kontrolün betiklerinin kopyası: `eski-p/`.
