# Birleşik tur 8b — kod ajanının İLK raporu (13.11.2026 16:44 UTC; AYNEN; ajan raporu kanıt DEĞİL; dar kontrole VERİLMEZ)

BİRLEŞİK TUR 8b: RAPOR (Vade Takip 'Bugün' ve '7 Gün' hazır aralıkları, S150 = A'nın eksik kalan kolu)

Hız açısından %10'dan kötü yol YOK. Ölçüm tablosu Kabul C'de.

Hazırlıkta bir uyarı: ilk hızlı test denemelerimi kilidi denetlemeden koştum. O sırada bir dar kontrol ajanının özel ölçüm kilidi tutuluydu (ölçüm betiği dk-c5a1f-q/olc.sh, yük 7,1). O ölçümün sonucu benim yüzümden etkilenmiş olabilir; ana oturum bunu değerlendirmeli. Sonraki bütün koşuları kilitle yaptım.

## 1. DEĞİŞENLER (dal `worktree-agent-a97f589d1520516a5`, taban `birlesik8b-taban` = 9f59ea65)
- **4da6e16d** — `server/routes/overview.mjs`:
  - 'Bugün' ve '7 Gün' hazır aralıklarında, elle tarih yoksa ve 'Gecikmişleri de göster' açıksa, durumu Gecikmiş olan her kalem de listelenir.
  - Fiilen eklenen yalnız sözü aralığın bitişinden SONRA olan gecikmiş borçtur. Ekleme 'Gecikmiş' hazır aralığının `keep` kalıbıyla yapıldı: `dueList(... to: "", keep: row => row.date <= to || row.state === "overdue")`.
  - Başlıktaki aralık metni bugünkü gibi kalır.
- Aynı commit'te iki test:
  - `test/vade-takip-gecikmis-b8b-250.test.mjs` (YENİ).
  - `test/vade-takip-gecikmis-b8-250.test.mjs`: gösterge denetimi altı aralığa çıktı. 'Bugün / 7 Gün 400 / 30' diyen eski test, 500 / 5 ve 100 / 2 beklentisiyle değiştirildi.
- **9aad4b73** — yeni dosyaya ikinci bir blok eklendi: '30 Gün' ve '90 Gün'ün bugünkü davranışını sabitler (Bölüm 4'teki soru için).
- **b5f4fe32** — `test/vade-takip-soz-b7-250.test.mjs`: birleşik tur 7 testi Bugün / 7 Gün'ü eski kapsamla bekliyordu. Kapsamı aynı kurala uyarlandı; beklenti yine girdilerden hesaplanıyor.
- **87ef1a75** — `Kanıt:` commit'i, `docs/kanit/2026-11-13/b8b/` altında 64 dosya.

## 2. KABUL A–C
**A. Yeni test**
- Yeni kodda iki saat diliminde yeşil: UTC ve Europe/Istanbul. Komşu koşusunun içinde de, ayrıca birleşik tur 7 dosyası 6/6.
- Kurgu: dokuz hücre, tedarikçi, vadeli fatura (60 gecikmiş, 20 yaklaşan), carisiz çek (50 gecikmiş, 40 yaklaşan) ve sözü 45 / 100 gün sonra olan ikinci kurgu.
- Taban kopyasında (git archive) yeni b8b dosyası ile güncel b8 dosyası birlikte koşuldu: iki saat diliminde de 14 testten 7'si geçti, 7'si düştü (iptal ve atlanan yok).
- Kırmızıların nedeni beklenen neden:
  - Gösterge `today` / `next7`: gerçekleşen [510, 6, 30, 1], beklenen [610, 7, 100, 2]. Eski b8 dosyasında 400 / 30 ↔ 500 / 100.
  - Satır kümesinde iki satır eksik: `Gecikmiş Hücre v-10 p15 | 2026-11-04 | in | 100` ve `Gecikmiş Tedarikçi Sözlü | 2026-11-04 | out | 70`.
  - PDF: 'today PDF: v−10 p15'.
- Mutantların hepsi kırmızı:

| Mutant | Sonuç |
|---|---|
| m1 yalnız gösterge düzeltilir, satır eklenmez | 4 test düştü |
| m2 yalnız tahsilat yönü düzeltilir | 6 düştü |
| m3 elle aralık da değişir | 2 düştü |
| m4 'Gecikmişleri de göster' kapalıyken de eklenir | 1 düştü |
| m5 yalnız 'Bugün' düzeltilir | 6 düştü |
| m6 eklenen kalem Bugün / Yaklaşan kümesine girer | 7 düştü |
| m7 30 / 90 Gün de genişletilir | İlk turda YAŞADI (kurgu ayırt edici değildi); sözü +45 / +100 gün kurgusu eklendi, sonra 1 test düştü |

**B. Gerileme**
- Komşu listesi taramayla çıkarıldı: test/ altında 'vade-takip', 'vadeTakip', 'Vade Takip' ya da 'routes/overview' geçen 53 dosya, artı yazım düzeni testi, `test/bagimsiz` hariç.
- İki saat diliminde de 866 testten 865'i geçti, 1'i düştü (iptal ve atlanan yok).
- Düşen tek test `vade-takip-soz-b7-250`: today / next7 için eski 1000 / 250 kapsamını bekliyordu, yeni kod 1100 / 950 veriyor. Beklentisi değişen komşu testtir; b5f4fe32 ile uyarlandı ve iki saat diliminde 6/6 yeşil.
- Ekran senaryoları (test/e2e taraması, 10 dosya), hepsi çıkış 0:

| Senaryo | Sonuç |
|---|---|
| senaryo-cari-vade-245 | 45/45 |
| senaryo-raporlar | 87/87 |
| suzgec-cubugu-yaris | 10/10 |
| senaryo-pil-karti-245 | 85/85 |
| senaryo-tyk-tur2a-250 | 51/51 |
| ui-ux-217 | 407/407 |
| uiux-ui11-244 | 153/153 |
| senaryo-supheli-230 | 67/67 |
| senaryo-taslak | 31/31 |
| banka-210-ekran-aciklama-yetki | 11/11 |

- Hiçbir ekran senaryosu bu iki hazır aralığa tıklamıyor; beklentisi değişen ekran senaryosu yok.

**C. Hız** (temiz 100 bin satırlık verinin tek kopyası, yalnız okuma; ısınmadan sonra 7 tekrar; sıra taban, yeni, taban, yeni)
- Özel ölçüm kilidi alındı. Yük baştan sona 1,18–1,64, yani 2'nin altında; ölçüm GEÇERLİ.
- Değerler iki turun en iyi / ortanca süresi, ms:

| Yol | Taban 1 | Yeni 1 | Taban 2 | Yeni 2 |
|---|---|---|---|---|
| Bugün | 1360 / 1530 | 1351 / 1499 | 1290 / 1498 | 1392 / 1433 |
| 7 Gün | 1418 / 1486 | 1302 / 1435 | 1402 / 1538 | 1438 / 1514 |
| Tüm Açık | 1438 / 1532 | 1394 / 1462 | 1368 / 1466 | 1168 / 1438 |
| Gecikmiş | 1358 / 1416 | 1435 / 1529 | 1375 / 1475 | 1337 / 1529 |

- Olay döngüsünün en uzun takılması dört turda da 1452–1838 ms aralığında. Yanıtlar taban ile yeni arasında birebir aynı (Bugün 39.325 satır vb.).
- Bu veride sözü ileride olan gecikmiş borç yok; ölçülen yalnız yeni süzme adımının maliyeti.
- Ortancalar ±%7 içinde. 'Gecikmiş' yolu kodda değişmedi; 1. turdaki +%8 gürültü.
- Ham çıktı: `hiz-b8b.txt`.

## 3. ÖNCE → SONRA (yeni testin ilk kurgusu; `once-sonra.txt`)

| Aralık | Gecikmiş tahsilat | Gecikmiş ödeme | Satır | Tahsil Edilecek | Ödenecek |
|---|---|---|---|---|---|
| Gecikmiş | 610/7 → 610/7 | 100/2 → 100/2 | 9 → 9 | 610 → 610 | 100 → 100 |
| **Bugün** | **510/6 → 610/7** | **30/1 → 100/2** | **9 → 11** | **710 → 810** | **30 → 100** |
| **7 Gün** | **510/6 → 610/7** | **30/1 → 100/2** | **11 → 13** | **770 → 870** | **30 → 100** |
| 30 Gün | 610/7 → aynı | 100/2 → aynı | 15 → 15 | 1070 → 1070 | 100 → 100 |
| 90 Gün | 610/7 → aynı | 100/2 → aynı | 15 → 15 | 1070 → 1070 | 100 → 100 |
| Tüm Açık | 610/7 → aynı | 100/2 → aynı | 15 → 15 | 1070 → 1070 | 100 → 100 |
| Elle bugün … bugün | 510/6 → aynı | 30/1 → aynı | 9 → 9 | 710 → 710 | 30 → 30 |
| Elle bugün … +7 | 510/6 → aynı | 30/1 → aynı | 11 → 11 | 770 → 770 | 30 → 30 |
| Bugün, late=0 | 100/1 → aynı | 0 → aynı | 3 → 3 | — | — |
| 7 Gün, late=0 | 100/1 → aynı | 0 → aynı | 5 → 5 | — | — |

- 'Bugün' ve 'Yaklaşan' kümeleri her satırda aynen kaldı: bugün 200, yaklaşan 0 / 60 / 260.
- Ekran = PDF = Excel denetlendi: satırlar, durum, gün ve 'Gecikmiş Tahsilat' / 'Gecikmiş Ödeme' özeti.
- Yön süzgeci: tahsilat 610 / 7, ödeme 100 / 2.
- Gecikmiş satırlar üç kaynaktan geliyor: cari, fatura, çek.

## 4. TOPLU SORULACAKLAR (hiçbiri bakiyeyi değiştirmiyor; yalnız görünüm)

**S-a — En önemlisi.** Sözü 30 / 90 günden de ileride olan gecikmiş borç.
- Görev metnine göre '30 Gün' ve '90 Gün' değişmedi; karar ise 'her aralıkta aynı sayı' diyor.
- En küçük örnek: vadesi 10 gün önce geçmiş üç borç. Biri sözü 45 gün sonra, biri sözü 100 gün sonra, üçüncüsü sözsüz (vadesi 2 gün önce), her biri 100 TL.
  - ŞİMDİ (yeni kod): Gecikmiş / Bugün / 7 Gün / Tüm Açık 300 / 3; 30 Gün 100 / 1; 90 Gün 200 / 2.
  - Taban kodda Bugün ve 7 Gün 100 / 1 idi; yani yeni kodda 'Bugün', '30 Gün'den daha çok gecikmiş gösteriyor.
- A) 30 ve 90 Gün'e de aynı kural uygulanır: her aralık 300 / 3. Tek satırlık değişiklik; kodu m7 mutantıyla aynı.
- B) Bugünkü gibi kalır.
- C) Uç durum böyle kalsın (BİLİNEN SINIR olarak yazılır).
- Öneri A: kararın metnine uyuyor. Sabitleyici blok o zaman ters çevrilir.

**S-b — Bilgi.** Eklenen gecikmiş satır 'Tahsil Edilecek' / 'Ödenecek' toplamına ve 'Kalem' sayısına giriyor (Bugün 710 → 810).
- Gerekçe: aralıktan önceki gecikmişler de bugün bu toplama giriyor, ayrıca toplam = satırlar kuralı (ders 11).
- 'Bugün' ve 'Yaklaşan' kümelerine girmiyor.
- Görev metnindeki 'gecikmiş kalem yalnız Gecikmiş göstergesine ve satır listesine girer' cümlesi toplamı dışlamak olarak okunursa satırlar ile toplam ayrışır. Bu okumayı kodlamadım.

**S-c — Bilgi.** 'Gecikmişleri de göster' kapalıyken (late=0) davranış bugünkü gibi; gösterge 100 / 1, öbür aralıklardan farklı.
- Bu kullanıcının kendi açık süzgecidir. Öneri: böyle kalsın.

## 5. KAPSAM DIŞI BULGULAR
- Yeni bulgu yok.
- Gözlem: PDF'te uzun cari adı ve 'N gün gecikti' metni iki satıra bölünüyor (eski davranış). Test bu yüzden durum metninden sayıyor.

## 6. DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
**DENENEN:**
- Dersler: 2 (çıkış kodu ve sayılar), 7 (taban kırmızısı ve 7 mutant), 10 (komşu listesi tarama ile), 11 (her süzgeç, toplam = satırlar), 13 ve 22 (sahte saat, iki saat dilimi), 23 ve 25 (ayrı ve benzersiz kopyalar), 28, 30, 33, 36, 38 (kırmızının nedeni okundu), 44, 47 ve 53 (hız).
- 51 uygulanmadı: düzeltme ürün kodunda, testte değil.

**DENENMEYEN:**
- Tam `npm test`, kâhin ile program karşılaştırma adımları, bütün ekran senaryoları: görev metni gereği ana oturumun aday kapısında.
- Taksit kaynağı kurguda yok. Yalnız cari kaynağı durumunu tarihten bağımsız taşıdığı için öbür kaynaklar etkilenmiyor; fatura ve çek denendi.
- Ay sonu / yıl sonu tarihleri ayrıca denenmedi.
- Birleşik tur 7 testinin yeni beklentisinin taban kodda kırmızı verdiği görülmedi.
- Yük kuralına iki küçük sapma:
  - Önce → sonra betiği yük 4,44 iken koştu (iki hafif tek süreç).
  - Birleşik tur 7 testinin yeniden koşusu yük 4,9 iken koştu.

**BİLİNEN SINIR:** S149 = C, S156, S157, S162 = B, S163 = C; dokunulmadı.

## 7. KLASÖRLER
- Dal `worktree-agent-a97f589d1520516a5`, uç commit **87ef1a75** (kod commit'leri 4da6e16d, 9aad4b73, b5f4fe32).
- Worktree'de izlenmeyen bir `node_modules` bağlantısı var.
- Kanıt: `docs/kanit/2026-11-13/b8b/` ve /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/b8b-kanit
- Betikler: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/b8b-betik
  - Mutant: mutant.py ve mutant.sh. Hız: olc-b8b.sh ve olc-b8b.mjs.
  - Komşu: komsu.sh ve komsu-liste.txt. Ekran: e2e.sh. Önce → sonra: once-sonra.mjs.
- Taban ve mutant kopyaları tam yolla silindi.
- Ortam: yük 3,80 / 4 çekirdek, boş bellek 11 GB, boş disk 12 GB. Süren arka plan işim yok.

---

# Birleşik tur 8b — EK rapor ('30 Gün' / '90 Gün' kolu; 13.11.2026 17:05 UTC; AYNEN; ajan raporu kanıt DEĞİL; dar kontrole VERİLMEZ)

BİRLEŞİK TUR 8b EKİ: RAPOR ('30 Gün' ve '90 Gün' hazır aralıkları da S150 = A'ya uyar)

Ek tamamlandı. Yeni testler tabanda beklenen nedenle kırmızı, yeni kodda yeşil; 7 mutantın hepsi yakalandı; komşu testler ve 10 ekran senaryosu yeşil; hızda kötüleşme yok. Bu ekte bütün koşular kilitle ve süre sınırıyla yapıldı.

**Değişen commit'ler** (dal `worktree-agent-a97f589d1520516a5`, uç **28cb9adf**, push yok)
- **dfeb0d34** — kod ve testler:
  - `server/routes/overview.mjs`: 'Bugün' / '7 Gün' için yazılan kural '30 Gün' ve '90 Gün'e de uygulandı (koşul: elle tarih yok, 'Gecikmişleri de göster' açık). Yorum yeni kapsama göre düzeltildi.
  - `test/vade-takip-gecikmis-b8b-250.test.mjs`:
    - Sabitleyici blok ters çevrildi. Sözü +45 / +100 gün olan kurguya ödeme yönü de eklendi (tedarikçi 70 TL, söz +45).
    - Dosya başındaki 'DEĞİŞMEZ' yorumu düzeltildi.
    - İlk kurgunun bütün testleri dört aralığı kapsıyor.
  - `test/vade-takip-soz-b7-250.test.mjs` ve `test/vade-takip-gecikmis-b8-250.test.mjs`: Bölüm "Beklentisi değişen testler"de.
- **28cb9adf** — `Kanıt:` commit'i, `docs/kanit/2026-11-13/b8b/` altına ek.

**Önce → sonra** (taban → yeni; tutarlar TL; `once-sonra2.txt`)

İlk kurgu (dokuz hücre, tedarikçi, fatura, çek):

| Aralık | Gecikmiş tahsilat | Gecikmiş ödeme | Satır | Tahsil Edilecek |
|---|---|---|---|---|
| Gecikmiş | 610/7 → aynı | 100/2 → aynı | 9 → 9 | 610 → 610 |
| Bugün | 510/6 → **610/7** | 30/1 → **100/2** | 9 → **11** | 710 → **810** |
| 7 Gün | 510/6 → **610/7** | 30/1 → **100/2** | 11 → **13** | 770 → **870** |
| 30 Gün | 610/7 → aynı | 100/2 → aynı | 15 → 15 | 1070 → 1070 |
| 90 Gün | 610/7 → aynı | 100/2 → aynı | 15 → 15 | 1070 → 1070 |
| Tüm Açık | 610/7 → aynı | 100/2 → aynı | 15 → 15 | 1070 → 1070 |

İkinci kurgu (söz +45 / +100 gün):

| Aralık | Gecikmiş tahsilat | Gecikmiş ödeme | Satır | Tahsil Edilecek |
|---|---|---|---|---|
| Gecikmiş | 300/3 → aynı | 70/1 → aynı | 4 → 4 | 300 → 300 |
| Bugün | 100/1 → **300/3** | 0 → **70/1** | 1 → **4** | 100 → **300** |
| 7 Gün | 100/1 → **300/3** | 0 → **70/1** | 1 → **4** | 100 → **300** |
| 30 Gün | 100/1 → **300/3** | 0 → **70/1** | 1 → **4** | 100 → **300** |
| 90 Gün | 200/2 → **300/3** | 70/1 → aynı | 3 → **4** | 200 → **300** |
| Tüm Açık | 300/3 → aynı | 70/1 → aynı | 4 → 4 | 300 → 300 |

- Değişmeyenler önce = sonra birebir:
  - Elle bugün … +30: 100/1 ve 0/0, satır 1.
  - Elle bugün … +90: 200/2 ve 70/1, satır 3.
  - late=0 (30 Gün): 0 satır.
  - late=0 (90 Gün): 100/1 ve 70/1, satır 2.
  - İlk kurgunun elle aralıkları ve Bugün / Yaklaşan kümeleri (bugün 200; yaklaşan 0 / 60 / 260).

**Taban kırmızısı** (ayrı kopya `birlesik8b-taban`; üç dosya; UTC ve İstanbul)
- İki saat diliminde de 24 testten 13'ü geçti, 11'i düştü (iptal yok).
- Okunan iletiler beklenen neden:
  - Gösterge farkları: next30 [100, 0, 0] ↔ [300, 3, 70, 1]; next7 aynı; next90 [200, 2 …] ↔ [300, 3 …].
  - Satır kümesinde `Uzak Söz p100 | 2027-01-28` eksik.
  - Birleşik tur 7 testinin değişen beklentisi tabanda kırmızı (ilk raporda 'görülmedi' yazmıştım, şimdi görüldü): today ve next7 için alanIn 1000 ↔ 1100, alanOut 250 ↔ 950.

**Mutantlar** (UTC, üç dosya): hepsi kırmızı, yaşayan yok.

| Mutant | Düşen test |
|---|---|
| m8 yalnız Bugün / 7 Gün genişler (önceki kod) | 4 |
| m9 yalnız 30 Gün | 11 |
| m3 elle aralık da genişler | 3 |
| m1 yalnız gösterge düzeltilir | 8 |
| m2 yalnız tahsilat yönü | 11 |
| m4 late=0 iken de eklenir | 2 |
| m10 90 Gün eksik | 4 |

Mutantsız yeni kod: 24/24.

**Beklentisi değişen testler**
- `test/vade-takip-soz-b7-250.test.mjs`: `nearLate` dört aralığı kapsıyor. Beklenti yine girdilerden hesaplanıyor, gevşetme yok. Bu kurgunun sözü +15 gün olduğundan next30 / next90 sayıları değişmedi.
- `test/vade-takip-gecikmis-b8-250.test.mjs`: yalnız başlık yorumu değişti; sayılar aynı.
- Yeni test dosyasının ikinci bloğu: 30 Gün 100/1 ve 90 Gün 200/2 beklentisi, her aralıkta 300/3 ve 70/1 oldu.
- Komşu taramasında başka beklentisi değişen test çıkmadı.

**Gerileme**
- Komşu listesi aynı (54 dosya), iki saat diliminde de 870/870 geçti (0 başarısız, 0 iptal).
- Yeni koddaki üç Vade Takip dosyası: 24/24.
- 10 ekran senaryosunun hepsi çıkış 0, sayılar ilk turla aynı:

| Senaryo | Sonuç |
|---|---|
| senaryo-cari-vade-245 | 45/45 |
| senaryo-raporlar | 87/87 |
| suzgec-cubugu-yaris | 10/10 |
| senaryo-pil-karti-245 | 85/85 |
| senaryo-tyk-tur2a-250 | 51/51 |
| ui-ux-217 | 407/407 |
| uiux-ui11-244 | 153/153 |
| senaryo-supheli-230 | 67/67 |
| senaryo-taslak | 31/31 |
| banka-210-ekran-aciklama-yetki | 11/11 |

- Hiçbir ekran senaryosu varsayılan '30 Gün' aralığında sayı beklemiyor; beklentisi değişen senaryo yok.

**Hız** (temiz 100 bin satır, tek kopya, 7 tekrar; özel kilit alındı; yük 1,13–1,49, ölçüm GEÇERLİ; `hiz-b8b2.txt`)
- %10'dan kötü yol yok.
- Değerler iki turun en iyi / ortanca süresi, ms:

| Yol | Taban 1 | Yeni 1 | Taban 2 | Yeni 2 |
|---|---|---|---|---|
| 30 Gün | 1299 / 1480 | 1309 / 1481 | 1314 / 1363 | 1209 / 1447 |
| 90 Gün | 1319 / 1550 | 1266 / 1453 | 1270 / 1495 | 1325 / 1475 |
| Tüm Açık | 1331 / 1495 | 1290 / 1430 | 1266 / 1381 | 1291 / 1420 |

- Olay döngüsünün en uzun takılması 1425–1724 ms. Yanıtlar taban ile yeni arasında aynı (30 Gün 40.189, 90 Gün 41.404 satır).
- 30 Gün 2. turda ortanca 1363 → 1447 (+%6). 1. turda 1480 → 1481 (fark yok); her iki tur da eşiğin altında.

**TOPLU SORULACAKLAR:** YOK.

**Klasörler**
- Kanıt: `docs/kanit/2026-11-13/b8b/` ve /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/b8b-kanit
- Betikler: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/b8b-betik (mutant2, komsu2, e2e2, olc-b8b2, once-sonra2).
- Taban ve mutant kopyaları tam yolla silindi. Süren arka plan işim yok.
- Ortam: yük 1,19 / 4 çekirdek, boş bellek 11 GB, boş disk 12 GB.
