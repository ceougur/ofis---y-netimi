## Ç5-A TUR 2f — RAPOR

Dal `worktree-agent-a46c87e85c8b28c2f`, taban `c5a2f-taban` (807c70f6, tur 2e birleşimi 7429fedc içinde), uç **6898b82d**. Push yapmadım.
Ortam (sonda, 13:52 UTC): yük 1,08 / 4 çekirdek, boş bellek 5 GB (kullanılabilir 14 GB), boş disk **5,0 GB**. Diskte boş yer tur boyunca 4,9–5,8 GB arasında gidip geldi. Benim / üzerindeki dosyalarım küçük (büyük kopyalar /dev/shm'deydi), düşüşün kaynağı başka işler.

### 1. Değişen gözlenebilir davranışlar (önce → sonra; v2.4.9'un gerçek koduyla üretilen veri, iki TZ'de aynı)
Ortak kurgu: bugün 10.01.2027, R1 700 reddedildi, kilit 31.12.2026, Fiş 2027-000001 (01.01.2027, B 500 700 / A 671 700) yazıldı, satır "Düzeltildi".

**Vaka A(b) — kilit doğrudan 30.11.2026'ya geri alınıyor**
- Önce:
  - Kural Farkı Düzeltme ön izlemesi etkin, 01.12.2026 tarihli B 671 700 / A 602 700 öneriyor.
  - Yönetim satırı "kalan 700" diyor.
  - Öneri kaydedilince satır "Düzeltildi (iki fiş)" oluyor. Defter: 2026'da 602 −700 ve 671 +700 (borç); 2027'de 671 −700.
- Sonra:
  - Ön izleme pasif: "Fişle düzeltilebilen fark kalmadı." (`rule-diff-nothing`), satır yok. POST 409 döner.
  - Mutabakat Testi ve Yönetim satırı "Düzeltildi (Fiş 2027-000001)" diyor.
  - Defter: 2026'da 671 = 0 ve 602 = 0; 2027'de 500 +700, 671 −700.
  - Kilit 2026'dayken R2 300 reddedilince yalnız 01.12.2026 tarihli B 519 300 / A 602 300 öneriliyor. Fiş 2026-000001 kaydedilince satır iki fişle "Düzeltildi" diyor; 2026'da 602 −300, 671 = 0 (y10).
  - Yıl dönümü kolu (kilit 30.12.2026, bugün 01.01.2027) de aynı sonucu veriyor.

**Vaka A(a) — kilit önce kaldırılıp 30.11.2026'ya konuyor**
- Önce:
  - Satır "artık fazla — ters kaydedin" diyor; ön izleme aynı anda B 671 700 / A 500 700 öneriyor.
  - Öneri kaydedilince program "tamam" diyor ama defter yanlış: 2026'da 500 −700, 602 −700, 671 +700; 2027'de 500 +700, 671 −700.
- Sonra:
  - Ön izleme pasif, yeni kod `rule-diff-own-year`. Neden metni: "Kural Farkı Düzeltme Fişi (Fiş 2027-000001) kilitli dönemin farkından fazla (kilit, fişin yılından geriye alındı); bu döneme fiş önerilmez. Fişi aşağıdaki Yazılmış Düzeltme Fişleri'nden kendi yılında ters kaydedin; kalan fark varsa sonra burada görünür." POST 409 döner.
  - Yönetim satırı uyarı veriyor: `over` true, `remainderMinor` 0, `ownYear` ["Fiş 2027-000001"], `ownYearMinor` 70.000.
  - İpucu: "Kural Farkı Düzeltme Fişi (Fiş 2027-000001) kilitli dönemin farkından fazla (kilit, fişin yılından geriye alındı) — fişi kendi yılında, Yönetim › Sistem › Kural Farkı Düzeltme'den ters kaydedin; kalan fark varsa sonra ön izlemede görünür."
  - Ekranın tarihsiz Ters Kaydet'i 200 dönüyor: Fiş 2027-000002, 01.01.2027 tarihli. Sonra satır kalkıyor, ön izleme "Düzeltilecek kural farkı yok." diyor.
  - Defter: 2026'da 500 = 0, 602 −700, 671 = 0; 2027'de hepsi 0.

**Vaka B (DÜŞÜK-1)** — 2026 fişi 06.10.2026 tarihli; 2027'de kilit kaldırılıp 31.12.2026'ya konuyor.
- Ön izleme değişmedi: 01.01.2027 tarihli B 681 700 / A 500 700.
- İpucu önce "… artık fazla — Yönetim › Sistem › Kural Farkı Düzeltme'den ters kaydedin." idi.
- Şimdi: "… artık fazla. Fişin tarihi kilitli dönemde olduğu için ters kaydı yazılamaz — Yönetim › Sistem › Kural Farkı Düzeltme'de ön izlemedeki fişi kaydedin; fazla ilk açık güne alınır."
- Tarihsiz ters kayıt yine 409 `period-locked` alıyor; defter sonuçları aynı.
- Kural: etkin bir fişin tarihi kilit gününde ya da öncesindeyse ön izleme metni verilir. Bu, aynı yıl içinde kilidin fişin tarihini aştığı komşu durumu da kapsıyor (aşağıda DENENMEYEN).

**Vaka C (yıl dönümü tablosu)** — 7 satırın 7'si yeni ve tabanda birebir aynı, iki TZ'de.

**Vaka D** — fiş satırları aynı (S186 = C: 671'li fişin fazlası B 671 700 / A 500 700; 602'li fişin fazlası B 681 700 / A 500 700). Yalnız ipucu B'deki gibi değişti.

**Fişin yılı eşleme yılından sonra olan fiş yoksa çıktı tur 2e ile birebir aynı.** Yeni kod yalnız böyle bir fiş varken çalışıyor. Tek istisna, kilitli fişteki "fazla" ipucu (B / D).

Hedefli karşılaştırmanın sonucu (`c5a2f-ozet/hedefli-fark.out`):
- A değişti (bilerek).
- B ve D'de yalnız ipucu değişti.
- C birebir aynı.
- İstanbul ile UTC arasında 0 fark var, yeni kodda da tabanda da.

### 2. Kod (tek yıl tanımı korundu; ikinci tanım yazmadım)
- `server/lib/ledger-opening.mjs` `ruleDiffCorrectionPlan`:
  - Önce yılı ≤ eşleme yılı olan fişler tur 2e'nin kuralıyla düşülüyor.
  - Ardından yılı daha sonra olan fişler, yıl sırasıyla ve kendi yıllarının eşlemesiyle düşülüyor.
  - Fiş bir satırında farkı aşıyorsa `ownYearOver`a giriyor ve eşleme yılına **hiç satır önerilmiyor**.
  - Kısmen kapanan kova birden çok hesaba bölünmeyi gerektirirse bugünkü kural uygulanıyor (aşağıda KULLANICIYA SORULMALI).
- `server/lib/ledger-snapshots.mjs` `checks()`: kendi yılı ipucu ve DÜŞÜK-1 ipucu.
- `server/routes/ledger.mjs` ön izleme: `rule-diff-own-year` nedeni.
- İstemciye dokunmadım: Yönetim satırı `over` iken ipucunu zaten gösteriyor.

### 3. Testler (`test/kural-farki-yil-250.test.mjs`)
- **Taban (807c70f6, ayrık worktree):** 6/10, iki TZ. Kırmızıların nedenlerini iletide okudum:
  - y5: B 671 700 / A 500 700 geliyor, satır yok bekleniyor.
  - y8: A 602 700 / B 671 700 geliyor, satır yok bekleniyor.
  - y7: eski ipucu metni.
  - y10: "2026'ya ikinci fiş önerilmez" — A 602 700 / B 671 700 geliyor.
  - y9 (P3) tabanda da yeşil, çünkü ürün zaten doğru; dişini mutant gösteriyor.
- **Yeni kod:** 10/10, iki TZ.
- Beklentisi değişen hücreler:
  - **y5 son kısmı:** "fişin tersi" B 671 700 / A 500 700 → satır yok + `ownYearOver` [{2027, 70.000}].
  - **y7 adım 6:** ipucu "… ters kaydedin." → ön izleme metni. Tarihsiz ters kaydın 409 aldığı da ayrıca sınanıyor.
- Yeni hücreler:
  - y8: saf; iki yön, kısmi fazla, iki fiş ve bölünmüş kova (bugünkü davranış sabitlendi).
  - y9: P3.
  - y10: program; vaka A'nın iki kolu, R2 ve kendi yılında ters kayıt.

### 4. Mutantlar
11 mutant × 3 koşu (İstanbul ve UTC'de yıl + düzeltme testleri; üçüncü koşu İstanbul'da yalnız yıl testiyle, iletiler okunarak). Mutasyonsuz taban her koşuda yeşil.

| Mutant | Sonuç | Yakalayan test ve değer |
|---|---|---|
| S1 (sonraki yılın fişi eşlenmiş toplamdan düşülür) | ÖLDÜ 3/3 | y5, y8, y10 — B 671 700 / A 500 700 ≠ [] |
| S2 (ipucu eski metin) | ÖLDÜ 3/3 | y7 |
| S3 (fazla fiş fazla sayılmaz) | ÖLDÜ 3/3 | `ownYearOver` [] ≠ 700; kod `rule-diff-nothing` |
| S4 (fazla varken satır önerilir) | ÖLDÜ 3/3 | y8 |
| S5 (bölünmüş kova kalanı ilk hesaba) | ÖLDÜ 3/3 | A 602 200 / A 671 50 ≠ sabitlenen bugünkü davranış |
| S6 (ön izleme nedeni yok) | ÖLDÜ 3/3 | y10 |
| S7 (kova çevrilmez) | ÖLDÜ 3/3 | y8, y10 |
| S8 (kendi yılı ipucu yok) | ÖLDÜ 3/3 | y10 |
| K-c (satırın yılı = son etkin fişin yılı) | ÖLDÜ 3/3 | y10 — `remainderMinor` 70.000 ≠ 0 |
| P3 (yön ham farktan) | ÖLDÜ 3/3 | y9 — B 671 700 ≠ B 681 700 |
| Y2 (örtü kilitten önce) | **YAŞADI 3/3** | — |

**Y2'nin gerekçesi:** kilit ile örtü ikisi de dolu ve farklı olunca ancak ayrışıyor. Bu yalnız dondurma sürerken ya da "Dondurma Bekliyor" durumunda (bekleyen dondurmanın kuralı bu programda yok) oluyor. O durumda ön izleme zaten pasif (`rule-diff-freezing`). Kalıcı durumda kilit = örtü olduğu için mutant eşdeğer. Geçici durumda gözlenebilir bir fark ÜRETMEDİM (aşağıda DOĞRULANMADI).

### 5. Rastgele sıra (dar kontrolün `sira.mjs` betiğinin kopyası; 300 tohum × 16 adım × iki TZ, yeni kod)
- I1 = 0, I2 = 0, I4 = 0 ihlal.
- I3-S180 = 45 ihlal, dar kontrolle aynı (S180 = A kaynaklı).
- Ancak yürüyüş yeni yola neredeyse hiç girmedi: 300 tohumda yalnız 8 tane 2027+ fiş, `rule-diff-own-year` 0 kez.
- Bu yüzden kilit geri ağırlıklı bir değişke yazdım (`sira-geri.mjs`, gün 2027'den başlıyor):
  - Yeni kod, iki TZ: fişin yılı > eşleme yılı olan 15 adım (4'ü own-year, 5'i "Düzeltildi"); I1, I2, I4 = 0; I3-S180 = 52.
  - Taban, aynı değişke: aynı 15 adım ama own-year 0, "Düzeltildi" 0; ihlal yine I3-S180 52.
- Değişmezler ORTA-1'i yakalamıyor, çünkü yürüyüş o durumda fiş kaydetmiyor. ORTA-1'i hedefli vaka A ve y10 kanıtlıyor.

### 6. Komşular, ekran senaryoları, kâhinler, hız
- **Komşular:** 35 dosya. Değişen üç dosyayı ya da Kural Farkı uçlarını adıyla anan testler, tur 2e'nin listesi ve yazım düzeni testi (taramayla; liste `c5a2f-ozet/komsu.txt`). Sonuç 338/338, iki TZ (sayı kanit'in üst düzey test sayısı).
- **Ekran senaryoları**, iki TZ:
  - senaryo-acilis-olabilir-250: 45/45
  - senaryo-acilis-eslestirme-250: 29/29
  - senaryo-acilis-duzeni-250: 27/27
- **Kâhinler** değişmedi: defter 187/187 (iki TZ), cari 17.136/17.136 (İstanbul).
- **Hız** (kaba; dışlayıcı ölçüm kilidiyle, yük 1,1–1,6, temiz 100 bin veri, iki tur, taban ↔ yeni). Değerler iki turun en iyi süreleri (ms):

| Yol | Kilit | Taban (tur 1 / tur 2) | Yeni (tur 1 / tur 2) |
|---|---|---|---|
| Kural Farkı ön izleme | geri 30.11.2026 (yeni yol) | 3.836 / 3.890 | 3.651 / 3.871 |
| Mutabakat Testi | geri 30.11.2026 | 7.658 / 7.836 | 7.101 / 7.935 |
| Defter Mutabakatı | geri 30.11.2026 | 10.205 / 9.985 | 9.623 / 10.525 |
| Kural Farkı ön izleme | 31.12.2026 | 3.890 / 4.223 | 3.436 / 4.069 |
| Mutabakat Testi | 31.12.2026 | 7.660 / 8.063 | 7.474 / 8.316 |
| Defter Mutabakatı | 31.12.2026 | 9.715 / 10.376 | 9.863 / 10.730 |

  Olay döngüsünde en uzun bekleme iki tarafta aynı düzeyde (ilk Mutabakat çağrısı ~18 sn). En kötü fark +%5,4, ±%10 gürültünün içinde. Kötüleşen yol yok. Kayıt (POST) yolu ölçülmedi.

### 7. Ana oturumun yeniden koşacağı komutlar
- `TZ=UTC` ve `TZ=Europe/Istanbul`, `HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/kural-farki-yil-250.test.mjs` → **10/10**.
- Taban kırmızısı: `git worktree add --detach <yol> c5a2f-taban`, ardından yeni testi kopyala → **6/10** (y5, y7, y8, y10 kırmızı).
- Komşular: `c5a2f-ozet/komsu.txt` → 338/338.
- Üç ekran senaryosu → 45 / 29 / 27.
- Mutantlar: `c5a2f-ozet/betik/mutant.py`, /dev/shm/c5a2f-k1/mut altında 06e82c2f'nin ayrık worktree'sini ister (sildim; yeniden açılmalı) → 10 ölür, Y2 yaşar.
- Hedefli: `p/sablon.mjs` → `p/hedefli.mjs` (`KOD=<kod>`).

### 8. Ekran yürüyüşü adımları (ana oturum için)
Tek bir v2.4.9 verisinden iki kopya hazırlayın: v2.4.9'da 02.10.2026 "Açılış bakiyesi" 700 Borç Yaz, kilit 05.10.2026. Her kopyayı güncel kodla bugün 10.01.2027'de açın: Açılış Olabilir'de R1'i reddedin, öbür adayları onaylayın. Dönem Kilidi'ni 31.12.2026'ya alın, Kural Farkı penceresinde B 500 700 / A 671 700'ü görüp Fişi Kaydet. Sonra:
- **(b) Kilidi doğrudan 30.11.2026'ya alın:** pencere pasif, "Fişle düzeltilebilen fark kalmadı."; Mutabakat satırı "Düzeltildi (Fiş 2027-000001)"; 2026 mizanında 671 = 0.
- **(a) Öbür kopyada kilidi kaldırın, sonra 30.11.2026'ya alın:** pencere pasif ve nedeni fiş numarasıyla görünüyor; Mutabakat satırı kendi yılı ipucunu veriyor. Ters Kaydet (01.01.2027) → satır kalkar.
- **(B) 2026 fişi yazılmış bir kopyada:** 2027'de kilidi kaldırıp 31.12.2026'ya alın → ipucu "ön izlemedeki fişi kaydedin", pencerede B 681 700 / A 500 700.

### 9. Commit'ler
- 06e82c2f — kod ve test
- 23b1bab8 — tasarım notu §17.15
- 6898b82d — Kanıt: `docs/kanit/2026-11-14/c5a2f-*` ve `c5a2f-ozet/` (taban kayıtları, mutant çıktıları, hız, betikler)

### 10. KULLANICIYA SORULMALI (kodlanmadı; bugünkü davranış kaldı ve y8'de sabitlendi)
**Durum:** kilit fişin yılından geri alındıktan sonra, sonraki yılın fişinin 671 satırı aynı yöndeki iki farkı kısmen karşılıyor.

**En küçük örnek:** 2027 fişi B 500 700 / A 671 700, 2026'nın 602 farkını (700) düzeltti. Kilit 30.11.2026'ya alındıktan sonra 2025'in 602 farkı (50) da doğdu. Kalan 50'nin hangi hesaba yazılacağını karar söylemiyor (`c5a2f-ozet/soru-ornek.out`).
- **A (öneri):** fiş önce eşleme yılının (2026) farkını kapatmış sayılır → öneri B 500 50 / A 671 50. 2026 mizanında 671 alacak 50, 602 değişmez; 2027'de 671 −700.
- **B:** önce en eski yılın farkı kapanmış sayılır → öneri B 500 50 / A 602 50. 2026'da 602 alacak 50.
- **C: Uç durum böyle kalsın (BİLİNEN SINIR)** — bugünkü: B 500 50 / A 602 700 / B 671 650. 2026'da 602 alacak 700 ve 671 borç 650: net aynı (−50) ama brüt yanlış.
- Kaygı: para kaybolmuyor, yalnız hesap seçimi değişiyor; durum çok seyrek. Yaygın programlar için doğrulanmış dayanak yok.

**Değerlendirmenize iki tasarım seçimim:**
1. Fiş fazlaysa ön izleme o fiş kendi yılında ters kaydedilene kadar **hiçbir satır önermiyor**, öbür düzeltilmemiş farklar dahil. Kısmi kapamada fiş dengesiz kalmasın diye böyle yaptım; ters kayıttan sonra kalan fark öneriliyor.
2. Yılı eşleme yılından küçük ya da eşit olan fişler önce, sonraki yılın fişleri sonra düşülüyor. Bu sıra yalnız çift düzeltmede sonucu değiştirir.

### 11. DOĞRULANMADI
- Y2'nin gözlenebileceği geçici durumu (dondurma sürerken ya da "Dondurma Bekliyor") programdan üretmedim.
- Yeni ön izleme nedeninin pencerede nasıl göründüğünü ekranda görmedim; istemci değişmedi, metin `[data-rule-diff-reason]` alanına gidiyor.

### 12. DENENMEYEN
- Windows.
- Tam `npm test` (ana oturumun işi).
- Ana oturumun ekran yürüyüşü.
- Aynı yıl içinde kilidin fişin tarihini aştığı "fazla" ipucu (kod yolu aynı koşul, ama ayrı test yok).
- Sonraki yılın fişi varken yedek / geri yükleme.
- 2.0.26 zincirinde sonraki yılın fişi.
- İki kişinin aynı anda kayıt yapması.
- Mobil.
- Kural Farkı kaydının (POST) süresi.

### 13. Kapsam dışı notlar
- Ters Kaydet onayındaki "bugünün tarihiyle yazılır" cümlesi yanlış (sunucu fişin kendi tarihini kullanıyor); dokunmadım.
- DÜŞÜK-4 dokunulmadı.

### 14. Not defteri ve temizlik
Not defteri klasörüm: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2f-k1`. İki ayrık worktree'yi (taban, mut) `git worktree remove` ile, /dev/shm/c5a2f-k1'i tam yoluyla sildim. Çalışma ağacımda yalnız `?? node_modules` var.
