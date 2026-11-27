## Ç7a tur 2b — teslim raporu

Dal `worktree-agent-a39ae245edbf12bf8`, taban `c7a3-taban` (5ba59cbc), uç `cdd7e586`. Push yapılmadı. Dört iş de bitti, commit'li; yarım iş yok.

Ortam (12:1x UTC): yük 1,23 / 4 çekirdek, boş bellek 6 GB, boş disk 8,2 GB. Taban kopyaları ve ayrı worktree'yi tam yollarıyla sildim.

### Değişen davranışlar (önce → sonra)

**1. KG-6: POS komisyonu satış gününe yazılıyor**
Dayanak: KG-6 = A (05.11 (5)), S177 = A, S178 = A.
- **Yevmiye.** Örnek: 08.10'da 10.000 TL POS tahsilatı, %2,5, valör 12.10.
  - Önce: 08.10'da yalnız B 108.01 10.000 / A 120. 12.10'da B 102.01 9.750 · B 653 250 / A 108.01 10.000.
  - Sonra: 08.10'da ayrıca B 653 250 / A 108.01 250 (yeni madde `pos-commission:<kayıt>`). 12.10'da B 102.01 9.750 / A 108.01 9.750; 653 satırı yok.
  - Taksitli satışta bütün taksitlerin kesintisi satış gününe yazılır: 3 × 140 = 420.
  - Oransal iadede, iade edilen kesinti iade gününe ters yazılır (B 108 / A 653).
- **Elle Onay (S177 = A).** Komisyon Farkı onayın gününde kalır: 13.10'da B 102.01 9.740 · B 653 10 / A 108.01 9.750.
- **KDV kipi (S178 = A) değişmedi.** Bunu bekçi testi denetliyor; tabanda da yeşil olması bekleniyor.
- **Ekranlar.**
  - Değişenler: Hesap Planı Mizanı'nda 653 artık satış dönemine düşüyor. 108 ve Alt Hesap Mizanı'ndaki 108.POS valöre kadar net alacak gösteriyor.
  - Değişmeyenler: POS raporları, Banka Masraf Raporu ve İşlem Kartı. Gün fişinin saklı satırları aynen duruyor; test bu satırları da okuyor.
- **Tek kaynak:** yeni dosya `server/lib/bank/pos-commission.mjs`. Defterin türetmesi, defter beklenenleri (Defter Mutabakatı, Mutabakat Testi, süzgeçli kapı) ve Alt Hesap Mizanı aynı küme ve kesinti formülünü kullanıyor.
- **108 eksi bakiye (kitabın sonucu).** "İade Edilmez" İptal İadesi'nde 108.01 valörlere kadar −420 görünür, yani bankaya borç. Her Komisyon Tahsili'nde kapanır.

**2. Kart faizi formunda alan adı.** Kart seçiliyken alanın adı "Banka Hesabı" yerine "Kredi Kartı".

**3. "Açılışta Sayıldı" işareti (BAŞ MİMAR KARARI 14.11 10:17 (2)).**
- Hesabı Atanmamış listesinde satırlar kalıyor; yanlarında "Açılışta Sayıldı" rozeti ve açıklama notu var. Listenin toplamı kovayla aynı.
- Banka raporlarında satır kalıyor ama tutar ve bakiye hücreleri boş; açıklamada "Açılışta Sayıldı (Giriş X; toplama girmez)" yazıyor. Özet, TOPLAM ve devir bu satırları düşüyor. Etkilenen raporlar:
  - Banka Bakiye, Banka / Para Birimi Bazında Bakiye, Banka Hareket, Günlük / Aylık Banka;
  - Cari / Fatura / Taksit ve Banka Hareketleri;
  - Banka ve POS Hareketleri (hesap ya da Hesabı Atanmamış seçiliyken).
- Ayrım tek kaynaktan: `opening-cover` (isCovered / COVER_SQL).
- Kasa yolundan gelen "Banka ve POS (Tümü)" (cash.report) değişmedi; Kasa raporları değişmez kararı (03.10.2026).

**4. Kılavuz.** "+ Kart Faizi" formunda Kredi Kartı alanı ve Hesabı Atanmamış'ta "Açılışta Sayıldı" için kısa notlar eklendi. PDF yeniden üretildi; `pdf-denetle` 39/39.

### Değişen kod
- `routes/ledger.mjs`: `rows()` içine `posCommission` ve `posSettled`, `refs()` içine `commissionGl` (yalnız okuyan ekler) ve bir import satırı.
- `general-ledger.mjs`:
  - satış günü maddesi;
  - `netCommission` (gün fişini netler);
  - `JOURNAL_CLASS` içinde `"pos-commission": 38`.
- `bank/money-lines.mjs`:
  - `groups()` POS beklenenini düzeltiyor;
  - `classifiedTotals` ve `keyTotals` için `uncounted` seçeneği.
- `bank/accounts.mjs`: Alt Hesap Mizanı'nın 108.POS düzeltmesi ve listede `counted` alanı.
- `bank/opening-cover.mjs`: test kipi rapor iş parçacığına da geçiyor (`HUKUK_TEST_COVER_OFF`, yalnız test için).
- `report-center.mjs`: yukarıdaki raporlar.
- `client/assets/hof-bank.js`: alan adı ve rozet.
- Kılavuz HTML ve PDF.

### Okuyucular (ders 10)
- Yevmiye, Hesap Planı Mizanı, Alt Hesap Mizanı, Defter Mutabakatı, Mutabakat Testi, kapı (tam ve süzgeçli), dondurma / ruleDiff, Kural Farkı Düzeltme Fişi.
- Muhasebe sürücüsü, mutabakat motoru, defter kaynak taraması.
- 2.4.9 kopyası (`ledger-rule-249`) kendi satır okuyucusunu kullandığı için etkilenmedi; donmuş defter testleri komşu koşusunda yeşil.

### Kabul koşulları
- **A — defter kâhini:** taban 187/187, yeni 187/187.
- **B — cari kâhini:** taban 17.136/17.136, yeni 17.136/17.136. Yapım aşaması listesi kendi kopyamda yeniden üretildi: 0 kayıt, depodakiyle bayt bayt aynı.
- **C — muhasebe sürücüsü** (s08, s11, s12, s23, s37, s72 × 2 saat dilimi):

  | | AYNI | U | SINIFLANMADI | sınıfsız adım farkı |
  |---|---|---|---|---|
  | taban | 218 | 36 | 0 | 10 |
  | yeni | 234 | 20 | 0 | 42 |

  - **Ç7a-KG6 (3 senaryo / 8 denetim) KALKTI.** Ç7a-KG19 1/4 kaldı (S175 = C, beklenen).
  - Öbür bekleyenler aynen: D2–D4, Ç5-ACILIS-519, Ç7b-KG3.
  - 32 yeni adım farkının nedeni: `karsilastir.py`'nin BUGÜN görünümü hâlâ KG6 = 'B' kabul ediyor (`bugun_dal`, satır 335). Farklar tam olarak KG-6 kaymasının çiftleri (satış günü −S, valör +S). **Sürücü eşlemesi ana oturumun işi**; `test/bagimsiz` dosyalarına dokunmadım.
  - Sürücü çıkışı tabanda da yenide de 1.
- **D — v2.4.9 kilitli verisi:** yeni test `pos-komisyon-v249-250` iki saat diliminde 4/4, tabanda 0/4.
  - Sınıf sınıf elle hesaplanan fark:
    - C1 (ikisi kilitli): satış günü {653 +250, 108.01 −250}, 04.03 gün fişi {−250, +250}.
    - C4 iade: satış +125, iade −50, satışın gün fişi −125, iadenin 10.03 gün fişi +50.
    - C5 (taksitli, çekim kilitli): +420.
    - C2 (çekim kilitli, valör açık): +100.
    - C3 (ikisi açık): farkta yok.
    - Toplam: 653 +520 / 108.01 −520.
  - Donmuş defter değişmedi.
  - Kural Farkı Düzeltme Fişi KG-6 maddelerini almıyor: 108.01 alt defter hesabı (C5 B14 (a), S76 = A); fark ayrı listede.
  - "Kilidi Aç → Yeniden Kilitle" sonrası KG-6 farkı kalmıyor. Q1 653 = 845, 108 = 15.480.
  - Açık dönemdeki yeni satış yeni kuralla yazılıyor.
- **E — hız** (temiz 100 bin satır + 26 POS satışı; özel ölçüm kilidi; yük 1,1–1,4):
  - Kötüleşen yol yok.
  - Kilitsiz kip iki kez ölçüldü. İlk ölçümde iki yol eşikte görünmüştü:
    - POS Komisyon Raporu: kodu değişmedi.
    - Banka Genel Bakış: 39 → 48 ms.

    İkinci ölçümde ikisi de eşiğin altında; iki ölçümün en iyileri birlikte en çok +8%.
  - Kilitli kipte bütün yollar eşiğin altında.
  - Ham çıktılar: `docs/kanit/2026-11-14/c7a3-hiz-*`.
- **F — rastgele sıra** (400 işlem × 2 tohum): taban 2/2, yeni 2/2. Kapı ortancası 18/21 → 20/20 ms; en çok 37/42 → 39/39 ms.
  - Motorun 108 modeli KG-6'yı biliyor: bekleyen kalemlerin komisyonu düşüyor.
  - Her KG-6 testinde her adımdan sonra Mutabakat Testi temiz.
- **G — ekran senaryoları:**
  - kart-faizi-250: 26/26 (alan adı denetimi eklendi).
  - banka-210: 428/428.
  - banka-210-eski-satir: 29/29.
  - banka-210b: 90/90.
  - banka-210-temel: 80/80.
  - banka-220: 76/76.
  - pos-220: 113/113.
  - pos-kart-249: 383/383.
  - raporlar: 87/87.
  - banka-rapor-243: 38/38.
  - senaryo-211: 59/59.
  - tahsile-ver-220: 140/140.
  - acilis-duzeni-250: 27/27.
- **Diğer:**
  - **Komşular** (taramayla 156 dosya): 1.751/1.751 UTC, 1.751/1.751 Europe/Istanbul.
  - **Yeni ve ilgili testler** (6 dosya): 28/28 iki saat diliminde.
  - **Dondurma zorlaması:** iki yeni test `bitir` ve `gozlem` kiplerinde yeşil; v249 testinde ön koşul (açılışta bekleyen dondurma) gerçekleşti.

### Yeni testlerin tabanda kırmızısı (ders 38)
- `pos-komisyon-satis-gunu-250`: tabanda 1/8 geçiyor (6. test KDV bekçisi, beklenen), 7 kalıyor. Nedenler "08.10 B 653 250 / A 108.01 250", "420 = 3 × 140", "iade günü B 108.01 100 / A 653 100", "250 + 12,50", "yalnız yeni satış (200)".
- `pos-komisyon-v249-250`: tabanda 0/4. Nedenler: C1 farkı yok; 108.01 ayrı listede değil; 653 = 845 değil.
- `hesapsiz-isaret-250`: tabanda 0/5. Nedenler: `counted` alanı yok; raporda 9.700, beklenen 5.700.

### Mutasyon: 24/24 yakalandı (5 D-07, 9 K-14, 10 KG-6)
- 18 (taksitte yalnız ilk kalem) ve 19 (gün fişinin 108'i netlenmez) programın kendi kapısında değerle yakalandı: "108 … 280,00 TL fark" ve "Çift yönlü kayıt (borç = alacak)" (409).
- İlk 21 numaralı mutant (void kalem kümeye girer) EŞDEĞER çıktı: void kalem yalnız void kayıtta olur ve kayıt koşulu onu zaten dışlar. Yerine "iade kalemleri kümeden düşer" mutantını koydum; değerle yakalandı.

### BEKLENTİ BİLEREK DEĞİŞTİ (hepsinde gerekçe yorumu var)
- **KG-6 yüzünden:**
  - pos-kabul: 108.01 10.000 → 9.750; 653 250 → 670; 108 12.000 → 11.580. Bunlar plan §12.5'in kabul sayılarıdır; kullanıcı kararı KG-6 = A ile değişti (ders 40).
  - pos-bozma: 2.000 → 1.950, 300 → 292,50.
  - pos-valor: İptal İadesi'nde 108.01 0 → −420.
  - 230-46: 1.500 → 1.462,50.
  - mutabakat motoru: 108 = bekleyen net.
  - defter-kaynak-iz: fikstüre kilitli POS verisi eklendi; 10 gerekçeli SINIF 3 istisnası (pos_items alanları, `pos_sales.status`, `settings.value`).
- **İşaret kararı yüzünden:** banka-210-raporlar ve raporlar-230-banka (açılışta sayılmış satır toplamlara, devre, günlük ve aylık tablolara ve bakiye raporuna girmez; satırda işaretli kalır).
- **Hız eşdeğerlik testi:** rapor iş parçacığı da ayrımsız kipte koşuyor.
- **Ekran senaryoları:**
  - banka-210'daki 10 kırmızının **7'si** ve eski-satir'daki **4 kırmızının hepsi tabanda da kırmızıydı** — tur 2'nin K-14 değişikliğinin sonucu; tur 2 ekran senaryosu koşmamıştı.
  - banka-210'un kalan 3'ü bu turun işaret değişikliğinden.
  - Hepsi S179 = A'ya göre elle düzeltildi; ikisi de yeşil.

### Kural sürümü
Etiket aynı kaldı ("2.5.0-defter", B2). Geliştirme verisinde kilitli dönem için kural farkı görünmesi beklenen davranış.

### BAŞ MİMAR KARARI GEREKİYOR
1. **"Banka ve POS (Tümü)" toplamı.** Kasa yolundan geldiği için (cash.report) açılışta sayılmış satırı toplamına katmaya devam ediyor; "Hesabı Atanmamış" seçimiyle iki farklı toplam görünebilir.
   - A: Kasa raporları değişmez kararı geçerli kalsın.
   - B: cash.report'a da işaret konsun.
   - Öneri: A, teslim notunda BİLİNEN SINIR olarak.
2. **Müşteri dosyasında kilitli dönem.** Kilitli dönemde POS satışı olan dosyada güncellemeden sonra kural farkı uyarısı Kural Farkı Düzeltme Fişi'yle kapanmaz; "Kilidi Aç → Yeniden Kilitle" gerekir (C5'in mevcut S76 = A düzeni). Güncelleme notuna yazılmalı.

### KULLANICIYA SORULMALI (uç durum)
- **Komisyon hesabı ayarı değişirse.** Banka Ayarları'ndaki komisyon hesabı sonradan değişirse, BEKLEYEN kalemin satış günü maddesi yeni hesaba geçer; satış kilitli dönemdeyse kural farkı doğar. Bankaya geçmiş kalem gün fişinin hesabında kalır.
  - A: böyle kalsın (BİLİNEN SINIR).
  - B: hesap satış anında saklansın (göç gerekir).
  - Öneri: A. Yaygın programlarda nasıl yapıldığı: DOĞRULANMADI.

### KAPSAM DIŞI BULGULAR
- **POS çekimi yazımı yavaş.** 100 bin satırlık veride bir POS çekimi kilitsiz ~5,2 sn, kilitli ~7,5 sn sürüyor; taban da aynı. POS tablolarına her yazım tam kapıya düşüyor (`integrity-scope` FULL_TABLES). Tohumlama sırasında yazım başına ~16 sn ölçtüm; 3.000 satış hedefi bu yüzden 26'da kaldı. POS ağırlıklı müşteri için ciddi; 2.5.1 hız işi.
- **CI listesi.** `senaryo-kart-faizi-250` hâlâ `ci.yml`'de yok; eklenmesi gerekiyor. Bu turda yeni ekran senaryosu yok.

### DOĞRULANMADI / DENENMEYEN / KOŞULMADI
- **DOĞRULANMADI:**
  - Çok POS satışlı veride KG-6'nın maliyeti (yalnız 26 satış ölçüldü).
  - POS raporlarının 100 bin satırlık veride eşdeğerliği: döküm boş satır döndü. Küçük veride testler saklı satırları okuyor.
  - Onarım Bekliyor ("repair") kayıtlarıyla KG-6 (API bu durumu üretemiyor).
  - Windows.
- **DENENMEYEN:** Silinenler'den geri yükleme ve iki şirket için ayrı KG-6 testi (yalnız komşu testlerin kapsadığı kadar); Ekstre ile onay kipi (Elle Onay denendi).
- **KOŞULMADI:** tam `npm test` (görev gereği); `ci.yml`'nin bütün ekran senaryoları (13'ü koşuldu); 226 koşuluk tam muhasebe sürücüsü; ekran yürüyüşü.

### Windows'ta izlenecek (ders 48)
`pos-komisyon-v249-250` geçici klasör açıp siliyor.

### Bağlantı noktaları
- **Devir (N-11 "bekleyen POS kalemi … KG-6'ya göre net"):** `commissionByPos` bekleyen kesintiyi POS başına veriyor; devir bunu kullanabilir.
- **Ç6:** 653 artık dönemine düşüyor. 108 ters bakiye verebiliyor (İptal İadesi); Bilanço sınıflaması bunu bilmeli.

### Ana oturumun yeniden koşacakları
Hepsinin başına `HUKUK_LICENSE_URL=http://127.0.0.1:9`.
- `node --test test/pos-komisyon-satis-gunu-250.test.mjs test/pos-komisyon-v249-250.test.mjs test/hesapsiz-isaret-250.test.mjs` → 17/17, UTC ve `TZ=Europe/Istanbul`. Tabanda 1/8, 0/4, 0/5.
- `node test/c7a-banka-250-mutasyon.mjs --kopya <git archive HEAD kopyası>` → 24/24.
- `npm run test:kahin-defter` → 187; `npm run test:kahin-cari` → 17.136.
- `node test/mutabakat/kos.mjs --islem 400 --tohum 7 --tohumlar 2 --her 20` → 2/2.
- `node test/bagimsiz/muhasebe-surucu/kos.mjs --senaryo s08,s23,s72,s11,s37,s12` → Ç7a-KG6 bekleyenlerde yok.

### Ekran yürüyüşü adımları
1. POS tanımla, 10.000 TL tahsilat gir.
2. Yevmiye'de satış gününde B 653 250 / A 108.01 250 maddesini gör.
3. Saati valöre al, Şimdi Aktar: gün fişi B 102 9.750 / A 108 9.750, 653 satırı yok.
4. Kart hesabında "+ Kart Faizi": alan adı "Kredi Kartı" olmalı.
5. Hesap yokken hesapsız havale gir, sonra hesap aç.
6. Hesabı Atanmamış listesinde "Açılışta Sayıldı" rozetini ve toplam = kova olduğunu gör.
7. Banka Hareket Raporu'nda Hesabı Atanmamış seç: işaretli satırın hücreleri boş, toplam = kova.
8. Açılış Eşleştirme'de 519 dökümünde "Hesapsız Hareketler (Açılıştan Önce)" satırına bak.
9. Mizan'da 653, 108.01 ve 519'u kontrol et.

### Commit'ler
| Commit | İçerik |
|---|---|
| 428c1ac5 | tasarım notu §14 (koddan önce) |
| 3d716563 | KG-6 |
| e185fb58 | kabul D testi |
| e769bfeb | alan adı |
| e077ce06 | işaret |
| 3c1b5012 | kılavuz + PDF |
| 73eb37d6 | tasarım notu §14.7 |
| 11e030e7 | ekran senaryoları |
| ce5fc2e3 | mutasyon düzeltmesi |
| cdd7e586 | Kanıt: `docs/kanit/2026-11-14/c7a3-*` (47 dosya) |

Tasarım notu: `docs/erp/C7A-BANKA-TASARIM.md` §14 – §14.7.

**Not defteri klasörüm:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7a-t2b` (betikler, loglar, ölçüm, sürücü ve mutant çıktıları). Ölçüm betiği `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7a-t2b/olcum/olc-c7a3.mjs`.
