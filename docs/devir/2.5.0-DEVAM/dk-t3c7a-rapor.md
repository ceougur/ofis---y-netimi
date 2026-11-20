# DAR KONTROL t3c7a — TEK ADAY (a678f86d^1 → a678f86d) RAPORU

Ortam (son okuma): yük 1,10 / 4 çekirdek, boş bellek 4 GB (14 GB kullanılabilir), boş disk 5,9 GB. Koşular sırasında yük zaman zaman 4–5'e çıktı; büyük yeni koşular yük 4'ün altına inince başladı. Worktree a678f86d'de ve temiz. Kendi commit'im yok. Kod kopyalarım silindi.

**Özet:** Para / bakiye kaybı yok. İki ORTA bulgu var: G1 (gerileme) ve B1 (aynı gün sırası).

## GERİLEMELER

**G1 — ORTA.** Konu: "Banka ve POS Hareketleri" raporu, Hesap = Tüm Hesaplar. Bu rapor 2.4.3'ten beri Banka grubunda.
- **Ne oluyor:** Ç7a, açılıştan önceki hesapsız satırları ("Açılışta Sayıldı") defterde 519'a, kovada da toplam dışına aldı. Tüm Hesaplar seçimi ise hâlâ Kasa yolundan geliyor (`server/routes/report-center.mjs:1601` `cash().report`). Bu yolda o satırlar işaretsiz kalıyor ve toplama giriyor.
- **Betik:** `b/c7a-tumu.mjs`. Veri: hesapsız 20.09 havale +5.000, 25.09 −1.000, 22.09 POS +3.000, 03.10 +2.000; Ziraat açılışı 01.10, 100.000.
- **Birleşim öncesi kod:** Tüm Hesaplar Dönem Sonu 109.000 = defter (102: 106.000 + 108: 3.000) = Ziraat 100.000 + Atanmamış 9.000. Üçü tutarlı.
- **Yeni kod, Yol = Banka ve POS (Tümü):** rapor 109.000, işaretli satır 0. Buna karşı defter 102 + 108 = 105.000; Ziraat 100.000 + Atanmamış seçimi 5.000 = 105.000. Fark 4.000.
- **Yeni kod, Yol = Banka (Havale / EFT):** rapor 106.000, defter 102 = 102.000.
- **Ne bozuluyor:** anayasanın "her raporda alt TOPLAM" kuralı ve K4'ün "toplam = kova, ekrandan ekrana tek sayı" sözü.
- **Kök neden:** report-center.mjs:1561 koşulu `markCounted` yolunu yalnız hesap / atanmamış / ccard / loan seçiminde kullanıyor.
- **En küçük düzeltme:** Tüm Hesaplar için de `scopedLines` + `keyTotals({ uncounted: true })` yolu. Ya da `cash.report` satırlarına `markCounted` uygulanır.

**Kalan çıktılarda gerileme yok:**
- Temiz 100 bin veride (iki şirket, iki saat dilimi) birleşim öncesi ↔ sonrası birebir aynı: cari kartı (şirket başına 120), Cari Listesi (dört süzgeç), Alacak Yaşlandırma, Vade Takip, zil, taksit listesi.
- Fark yalnız mizan, Alt Hesap Mizanı, kova ve Anlık Durum'da. Bunlar K-14 gereği; sayılar aşağıda "Kullanıcıya gösterilmeli" (2)'de.
- Küçük zengin veride farklar yalnız şüpheli kaydı + bağlı tahsilatı olan 5 caride çıktı (şirket 002). İkisini elle hesapladım; farklar S14 / S25 / S168 = B kuralının sonucu. Örnek: 3f2273 carisinde bağlı çekin faturasının kuyruk payı 0, çek 120'den düşüyor; 128 300 → 500. Mizanda 120 → 128 kayması 1.000; Alacak Yaşlandırma'nın şüpheli toplamı 6.200 = 128.

## İLK MADDELER

**1. Aynı gün bağlı + bağsız tahsilat — "sıra toplamı değiştirmez" iddiası ÇÜRÜTÜLDÜ (B1).**
- Senaryo: Fatura 1 1.000 (vade ileride) → şüpheliye alma 1.000 → Normal Cari 400 (geriye tarihli) → Fatura 2 500 (vade erken). Aynı gün: bağsız işaretsiz 200 (U) ve Fatura 2'ye bağlı 300 (L).
- Sonuç kimlik (UUID) sırasına bağlı, yazım sırasına bağlı değil. 10 + 6 cari, iki saat dilimi:
  - kimlik U<L: 120 / 128 = 0 / 600; L = A120 100 + A128 200; kart gecikmiş 0; şüpheli kuyruk 600; sonraki "Normal Cari 100" → 409.
  - kimlik L<U: 100 / 500; L = A128 300; gecikmiş 100; kuyruk 500; aynı 100 → 200.
- Mutabakat Testi her iki durumda temiz.
- Testteki "aynı gün" hücresi (`test/supheli-kuyruk-defter-250.test.mjs:204`) ayırt edici değil.

**2. Tur 3 mutantları.**
- supheli-kuyruk-defter: 3 tekrar × 2 saat dilimi koştu. M12 6 koşunun 3'ünde yaşadı (tekrar 1 iki dilim, tekrar 3 UTC); öbür 14 mutant hep öldü. Ara sıra yaşamanın kökü B1.
- obligation-input 14/14, iki koşu.

**3. Ç7a mutantları.**
- 24/24, iki koşu.
- Kapıyı kendi kopyamda kapatıp (`DK_GATE_OFF`) yalnız redle yakalananları yeniden koştum: M2, M6, M7, M12, M18, M19 değer iddiasıyla ölüyor. Örnek: "20.09 B 519 / A 120", "420 = 3 × 140", "12.10 B 102.01 9.750".
- M13, M14, M20 beklenen tarafının mutantı; Mutabakat Testi taramasının değeriyle ölüyor. Ürün belirtisi zaten yanlış alarm olduğu için bu doğru belirti.

**4. KG-6 elle hesap.**
- Kural kitabı satırından elle hesap:
  - 10.000 × %2,5 = 250: satış günü B 653 / A 108.01; 12.10'da B 102.01 9.750 / A 108.01 9.750.
  - 12.000 × %3,5 = 420 (3 × 140), satış gününde.
  - Oransal iade 4.000 → iade günü B 108 100 / A 653 100.
  - BSMV Hariç: 250 + 12,50 = 262,50.
  - Elle Onay 9.740 → onay / valör günü 10 TL Komisyon Farkı (S177 = A).
  - KDV kipinde satış günü maddesi yok (S178 = A).
- Program bu sayıları veriyor: pos-komisyon-satis-gunu 8/8 yeşil. Eski kodda 7/8 kırmızı, beklenen nedenle.
- Motor modeli komisyonu kendi formülüyle hesaplıyor (programla karşılaştırılıyor). Ama "bekleyen kesinti 108'den düşer" kuralı ürünle aynı elden.
- Yeni mutant N7 (komisyon hesabı ayarı okunmaz, hep 653) yaşıyor → ayarın test edilmediği anlamına gelir (DÜŞÜK).
- Ayrı bir iptal / pos-sil elle senaryosu koşmadım.

**5. "Banka ve POS (Tümü)" ↔ kova.** G1 ile aynı bulgu: K4'e aykırı.
- Hesabı Atanmamış seçiminde K4 doğru uygulanmış: Dönem Sonu 5.000 = kova (havale 2.000 + POS 3.000); 2 satır "Açılışta Sayıldı" işaretli, toplama girmiyor.
- Ziraat seçimi 100.000.

**6. Hız düzeltmesinin eşdeğerliği — BİREBİR.** Karşılaştırma hız tabanı 9c09f18d ↔ a678f86d.
- **Küçük veri:** 2 şirket, 60 cari, 31 şüpheli, 21 bağlı tahsilat, 7 bağlı çek, 21 kart, 19 silinmiş satır; aynı ad, aynı gün. 86 döküm etiketi, iki saat diliminde fark 0. Etiketler: liste + dört süzgeç, bütün kartlar, Alacak Yaşlandırma, Vade Takip, zil, taksit, mizan, alt hesap, kova, Anlık Durum.
- **100 bin veri:** 266 etiket, iki saat diliminde fark 0.
- **Bellek açık ↔ kapalı (`LINKED_MEMO_TEST.off`):** her adımda ayırıcı + yevmiye + kalanlar karşılaştırıldı. 3 tohum × 80–100 rastgele adım; fark 0, tarama 0.
- **Yedek → değişiklik → geri yükle (şirket 002, hemen uygulanan geri yükleme):** sayılar yedektekiyle aynı.

## BULGULAR

**B1 — ORTA (ders 31; programın kendi yolu, süreç kuralı dışı).**
- Yer: `server/lib/doubtful-gl.mjs:66` (`by`) ve `:112` (`tie: credit.key`). Anahtar: SQL yükleyicide `server/lib/bank/doubtful.mjs:91` `'account:' || e.id`; yevmiye yükleyicide `doubtful-gl.mjs:271` `${entry.id}#i`.
- Kök neden: ayırıcı aynı gün, aynı sınıftaki alacakları rastgele UUID'ye göre işliyor. Tur 3'ten beri bağlı satırın payı (`linked`, `doubtfulBefore`) "o ana kadar işlenen" kümeye (`done`) bağlı. Bu yüzden 120/128 dağılımı, kuyruk, gecikmiş ve sonraki işlemin kabul / reddi kimliğe bağlı hâle geldi. Bakiye değişmiyor; iki yükleyici kendi arasında tutarlı.
- Betik ve çıktılar: `b/aynigun.mjs`, `aynigun.out`.
- En küçük düzeltme: aynı sınıf içinde sıra yazım sırası olsun (rowid / created_at — kuyruğun `at` / rank'i). İki yükleyici de bu bilgiyi taşımalı. Kalıcı test bu senaryoyla, 2 yazım sırası × 2 kimlik sırası.
- Kullanıcıya soru değil; kural ders 31'de yazılı.

**DÜŞÜK** (sakınca süzgeci: para / defter / veri kaybı / KVKK yok):
- Yaşayan yeni mutantlar = eksik test:
  - N5: rapor işaretinde `if (line.ref) continue` kalkınca test fark etmiyor; test verisinde tek açılış günü var.
  - N7: komisyon hesabı ayarı (S187 davranışı) test edilmiyor.
  - N8: Hesabı Atanmamış listesinde kart çıkışı rozeti.
  - N11: ipucunda kilit = fiş günü eşitliği.
- S181 = B çek yolu ileti metni: red doğru (409, ledger-integrity, satır yazılmıyor) ama ileti "kaydı şüpheliye alma tarihinden sonraya girin" diyor. Nakit yolundaki "Tutarı 500'e indirin / bağı kaldırın" önerisini vermiyor.

## Tablolar

**Permütasyon / rastgele sıra.**
- İşlemler: fatura, bağlı / bağsız / Normal Cari tahsilat, bağlı çek, şüpheliye alma, Şüpheliden Çıkar, kart, sil, Silinenler'den geri alma, düzeltme.
- Tohum 1 (İstanbul, 80 adım, 49 başarılı), tohum 2 (UTC, 100 adım, 55), tohum 3 (UTC, 100 adım, 66): bellek farkı 0, tarama 0.
- Reddedilenler beklenen kodla döndü: doubtful-before-debt, doubtful-exceeds-balance, doubtful-closed, doubtful-normal-exceeds.

**Eşzamanlılık.** İki oturum aynı cariye, sınırın yalnız birine yettiği iki bağlı 300 tahsilatı aynı anda yazdı: 200 + 409, tek satır yazıldı, 120 / 128 = 200 / 1.000, tarama temiz.

**S181 = B yolları** (her redde satır farkı 0):
- Bağlı nakit 900 → 409 doubtful-normal-exceeds.
- Bağlı çek 900 → 409 ledger-integrity.
- Çek düzeltmesi 300 → 900 → 409.
- Bağsız çek 900 → 200 (karşılaştırma için).

**Test dişi (eski kod e7e9cea1, iki saat dilimi; hepsi beklenen nedenle kırmızı):**

| Test | Eski kodda sonuç | Neden |
|---|---|---|
| supheli-kuyruk-defter | 17/24 kırmızı | 409 ↔ 200 (S168 eski ret) |
| supheli-etiket-pay | 2/3 kırmızı | 'kısmi 100' ↔ 'tam' |
| hesapsiz-acilis | 5/5 kırmızı | kova 6.700 |
| hesapsiz-isaret | 5/5 kırmızı | 970.000 ↔ 570.000 |
| kart-faizi | 3/3 kırmızı | 400 "faiz gideri Vadesiz… hesaptan girilir" |
| pos-komisyon-satis-gunu | 7/8 kırmızı | — |
| kural-farki-yil (yeni hâli) | 2/8 kırmızı | — |
| defter-kaynak-iz (yeni hâli) | 1/2 kırmızı | — |

**Yeni mutantlar (15; dört bölümden ikişer ve fazlası):**
- Değerle ölenler (8): N2, N3 (tur 3); N4 (Ç7a); N9, N10 (tur 2f); N12, N13, N14 (hız).
- Eşdeğer (3): N1 (ekran yalnız > 0 iken gösteriyor), N6 (void kalem her zaman void kayıtta), N15 (arama yalnız bakiye alanını döndürüyor; arama ↔ liste fark 0).
- Yaşayan (4): N5, N7, N8, N11 (yukarıda DÜŞÜK).

## K1–K6 değerlendirmesi

- **K1:** Uyuyor (S185 = A ve S196 = C metinleriyle). İki tasarım seçimi N9 ve N10 mutantlarıyla değerle sınanıyor. Not: fiş fazlayken başka hesaplardaki ilgisiz farklar da önerilmiyor; ters kayıtla geri alınabilir, kabul edilebilir.
- **K2:** UYMUYOR → G1. "Kasa raporları değişmez" (03.10.2026) kararı Tahsilat raporlarındaki açılışla ilgili; bu rapor ise 2.4.3'ten beri Banka grubunda. K4 ile çelişiyor; yalnız "Tümü" değil, Tüm Hesaplar'daki üç Yol seçeneğini de kapsıyor.
- **K3:** Uyuyor; yalnız belge işi.
- **K4:** Liste ve hesap / atanmamış seçimlerinde sayıyla doğrulandı; Tüm Hesaplar'da ihlal (G1).
- **K5:** Uyuyor; c7a M10 değerle ölüyor.
- **K6:** Ölçmedim → DENENMEYEN.

## KULLANICIYA SORULMALI / GÖSTERİLMELİ

1. **G1, K2 korunacaksa:**
   - A (öneri): Tüm Hesaplar yolu da "Açılışta Sayıldı"yı uygulasın; rapor = defter = kova.
   - B: BİLİNEN SINIR (rapor açılış öncesi hesapsız net kadar fazla gösterir).
   - Mizan iki seçenekte de aynı; uç durum değil (açılıştan önce hesapsız havalesi olan her müşteri).
2. **S184 = A'nın büyüklük etkisi (bilgi; S184 C/D'de sorulup öneriyle uygulanmıştı).** Temiz 100 bin veri, şirket 001: hesapsız kart çıkışları 519'a geçerken POS girişleri 108.00'da kalıyor.
   - 108.00: 6.314.542,02 → 55.832.433,27
   - 102.00: 15.308.342,58 → 3.989.613,41
   - 519: −116.309,08 → −38.315.471,16
   - Anlık Durum'da "Hesabı Atanmamış" toplamı: 21,6 milyon → 59,8 milyon
   - Seçenekler: A (öneri) böyle kalsın; güncelleme notuna "Hesabı Atanmamış (Kart) bakiyesi artabilir, Devir Kapanışı ile kapanır" yazılsın. B: S184 = B (yeni kod turu).
   - Aynı gün sırası (B1) için C/D'de önceden sorulmuş bir soru bulamadım.

## DOĞRULANMADI
- Geri yüklemeden sonra bellek damgasının (total_changes | data_version) eski bir değerle çakışması: şirket 002'nin hemen uygulanan geri yüklemesinde yeniden üretilemedi. Şirket 001'in bekletilen geri yüklemesi yeniden başlatma istediği için betikle denenmedi.

## DENENMEYEN
- v2.4.9'un gerçek koduyla göç (etiket worktree'si). Yalnız ajanın v249 testleri kopyamda yeşil.
- Bütün e2e senaryoları, ekran yürüyüşü.
- POS çekimi ↔ valör aktarımının eşzamanlılığı; aynı anda iki Kural Farkı fişi.
- Testlerin ötesinde Kural Farkı fişi ↔ kilit ileri / geri ↔ ters kayıt permütasyonları, yıl dönümü.
- Rol × uç yetki matrisi (yeni uç yok; yetki kodu değişmedi).
- K6 hız ölçümü.
- KG-6'da iptal / sil için ayrı elle hesap.

## Not defteri
Klasör: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-t3c7a-x`
- Betikler `b/` altında.
- Bulgu ve İlk Maddeler: `aynigun.out`, `mut1.out`, `kapi-kapali.out`, `yeni-mutant.out`, `eski-kirmizi.out`, `rastgele.out`, `ara-notlar.md`
- Eşdeğerlik: `kucuk-eski-yeni-UTC.txt`, `e100k-eski-yeni-UTC.txt`, `b100k-hiz.log`, `e100k.log`
- Küçük veri: `kucuk/`

Yerine koyduklarım: worktree'deki docs/kanit klasörleri disk için geçici silindi ve `git checkout` ile geri getirildi; node_modules bağı kaldırıldı.
