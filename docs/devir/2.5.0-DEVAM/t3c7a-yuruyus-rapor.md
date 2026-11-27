## TEK ADAY EKRAN YÜRÜYÜŞÜ — RAPOR (ajan raporudur, kanıt sayılmaz; ana oturum yeniden koşar)

### Dal ve durum
- Dal `worktree-agent-a47fc9ca741d7db39`, taban `sinama-t3c7a` = 58a6ca63, uç **0e926228**. Push yapılmadı.
- Ürün kodu değişmedi: 58a6ca63..uç arasındaki 8 dosyanın hepsi `docs/kanit/2026-11-19/t3c7a-yuruyus/` altında.
- Commit'ler: 47066108 (betiğin ilk hâli), 4d085f9c (geliştirme düzeltmeleri), bdcd35d1 (aday çıktısı), 0e926228 (taban çıktısı ve fark).
- Ortam: aday koşusu yük 4,00 iken başladı. Yükü başka oturumun `test/bagimsiz/muhasebe/mutasyon.py` süreçleri tutuyordu; sınır "4'ten büyük" olduğu için eşikteydi. Taban koşusu yük 2,4'te başladı. Rapor anında yük 1,8 / 4 çekirdek, bellek boş 7 GB, disk boş 7,6 GB.

### Dosyalar (tam yollar)
- **Betik:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/t3yy-yuruyus/yuruyus-t3c7a.mjs`
  - Depodaki kopyası `docs/kanit/2026-11-19/t3c7a-yuruyus/yuruyus-t3c7a.mjs` ile bayt bayt aynı (cmp + sha256 `aday.sha` denetimi).
  - Çağrı: `HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=…/pw-1194 ROOT=<kod> OUT=<klasör> node yuruyus-t3c7a.mjs`
- **Aday koşusu** (ROOT = worktree, 58a6ca63): çıkış **0**, ADIM YARIDA **0**.
  - Çıktı: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/t3yy-yuruyus/aday.out`
  - Görüntüler (42 adet): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/t3yy-yuruyus/aday/`
- **Taban koşusu** (ROOT = `git worktree add --detach … claude/epic-thompson-w0lc2l` = cc17d632): çıkış **0**, ADIM YARIDA **0**.
  - Çıktı: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/t3yy-yuruyus/taban.out`
  - Görüntüler (40 adet): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/t3yy-yuruyus/tabankosu/`
  - Taban kopyası `git worktree remove --force` ile kaldırıldı.
- **Depodaki metin kanıtı:** `aday.out`, `taban.out`, `aday-uclu.tsv`, `taban-uclu.tsv`, `aday-d-ozet.txt`, `taban-d-ozet.txt`, `uclu-taban-aday-farki.diff`.
- **Geliştirme koşusu 1:** `…/t3yy-yuruyus/gelistirme1/` ve `gelistirme1.out`. Betik hatalarını buldu (sütun adları, belge serisinin tarih sırası, tek POS); kanıt sayılmaz.

### Üçlüler: BEKLENEN ↔ EKRAN ↔ VERİ TABANI / DEFTER (aday)
Sahte saat 08.10.2026; C bölümü 10.01.2027.

**A — Ç7a (hepsi tuttu)**
- Hesap açılmadan önce girilen havaleler kovaya düşüyor: 6.700 = 6.700. 20.09 havale 5.000 ekrandan girildi (Tab ile, insan hızında), kayıt veri tabanında.
- Hesaplar açıldıktan sonra Hesabı Atanmamış kovası: beklenen 2.700 ↔ ekran ₺2.700 ↔ özet 2.700, defterde 102.00 = 2.700.
- Eski Hareketler listesi: 4 satır; 20.09 ve 25.09'da "Açılışta Sayıldı" rozeti (2 satır); Havale toplamı ₺2.700. Görüntü `04-A-eski-hareketler.png`.
- Defter: 20.09 B 519 5.000 / A 120 ve 25.09 B 120 / A 519 1.000; 30.09'a kadar 519 = 4.000.
- Açılış Eşleştirme 519 dökümünde "Hesapsız Hareketler (Açılıştan Önce)" ₺4.000 Borç = defter 4.000 (`05-A`).
- **+ Kart Faizi formu:**
  - Tab'dan sonra odak BSMV / KKDF alanına (`taxAmount`) geçiyor.
  - Kart seçiliyken alan adı "Kredi Kartı".
  - Önizleme "Kart Borcuna Eklenen ₺210,00".
- Kart faizi kaydı:
  - Kart borcu ekranda ₺5.210, API'de −5.210.
  - Fiş 08.10: B 780 200 · B 780 10 / A 309.01 210.
  - Ziraat 100.000 değişmedi; mizanda 780 = 210.
- **POS tahsilatı 10.000 ekrandan girildi.** Tek POS olduğu için form onu kendiliğinden seçti; önizleme "Komisyon %2,50 (₺250,00) · Valör 12.10.2026".
  - Defter 08.10: B 108.01 10.000 / A 120, ayrıca `pos-commission` B 653 250 / A 108.01 250.
  - Mizan: 653 = 250, 108 = 9.750.
- **POS Komisyon Raporu:** "Ekim 2026": Komisyon ₺238,10 + BSMV ₺11,90 = 250 (BSMV dahil kip), Net ₺9.750. Defterdeki 653 08.10'da 250, yani aynı dönemde aynı tutar. Rapor aylık gruplandığı için gün düzeyinde eşleşme ekrandan görülemiyor.
- **12.10'da Şimdi Aktar ekrandan basıldı** (`12-A`):
  - Gün fişi B 102.01 9.750 / A 108.01 9.750; 653 satırı yok.
  - 653 = 250 (08.10'da), 108 = 0, Ziraat 109.750.
- Mutabakat Testi bulgusuz.

**B — Ç5-A tur 3 (S168 = B; hepsi tuttu)**
- Kurulum: 120 = 100, 128 = 1.000.
- F2'ye bağlı 300 (ekrandan, Tab ile, tarih −10 gün): form kapandı; 120 = 100, 128 = 700.
- F2'ye bağlı 200 (bugün): 120 = 0, 128 = 600.
- Etiketler (`17-B-s168-hareketler.png`):
  - İşaretli 400: "Normal Cariye İşlendi".
  - 300'lük satır: etiketsiz.
  - 200'lük satır: "Kısmen Normal Cariye İşlendi (₺100,00)".
- Payı 0 olan cari, F2'ye bağlı 200: 120 = 300, 128 = 1.000; etiket "Normal Cariye İşlendi". Etiketin üç hâli de görüldü.
- Alacak Yaşlandırma, ekran ve API aynı:
  - S168: 31–60 gün 600, Şüpheli 600, Toplam 600.
  - Payı 0: 1–30 gün 300, 31–60 gün 1.000, Şüpheli 1.000, Toplam 1.300.
- Mizan 120 = 300, 128 = 1.600 (ekran ve API). Mutabakat Testi bulgusuz.

**C — Ç5-A tur 2f (S185 = A; hepsi tuttu)**
Veri: v2.4.9'un gerçek koduyla 02.10'a 700 "Açılış bakiyesi", kilit 05.10. Güncel kodla Açılış Olabilir'de bu kayıt ekrandan reddedildi; veri tabanında `rejected`.
- Kilit ekrandan 31.12.2026'ya alındı. Ön izleme B 500 700 / A 671 700. Onay kutusuna Tab ile ulaşıldı, Boşluk ile işaretlendi, Fişi Kaydet basıldı.
  - Sonuç: Fiş 2027-000001, 01.01.2027.
  - Mutabakat satırı "Düzeltildi (Fiş 2027-000001)".
- **(b) Kilit doğrudan 30.11.2026'ya alındı:**
  - Pencere pasif: "Fişle düzeltilebilen fark kalmadı."; uç `rule-diff-nothing`, satır yok.
  - Satır "Düzeltildi (Fiş 2027-000001)".
  - Mizan 2026: 602 = 0, 671 = 0. 2027 devirli bakiye: 500 = 0, 671 = −700.
- **(a) Kilit önce kaldırıldı, sonra 30.11.2026'ya alındı:**
  - Pencere pasif, kod `rule-diff-own-year`, neden metni fiş numarasıyla. Mutabakat satırında kendi yılı ipucu var.
  - Ters Kaydet (onay sorusu görüldü): fiş 2027-000002 `reversal`, 01.01.2027.
  - Ardından pencere "Düzeltilecek kural farkı yok."; mutabakat satırı temiz.
  - Mizan 2026: 602 = −700, 500 = 0, 671 = 0. 2027'de 500 = 0, 671 = 0.

### Taban ↔ aday farkları (hepsi kararların beklediği yönde)
Ayrıntı `uclu-taban-aday-farki.diff` dosyasında.
- **A:**
  - Tabanda kova 6.700 (aday 2.700), rozet yok, 30.09'a kadar 519 = 0 ve 519 dökümünde satır yok.
  - "+ Kart Faizi" tabanda yok; betik "TABANDA YOK" yazdı.
  - POS: tabanda 08.10'da 653 yok; 12.10 gün fişi B 102.01 9.750 · B 653 250 / A 108.01 10.000.
- **B:**
  - Tabanda bağlı 300 ve bağlı 200 reddedildi: form kapanmadı, veri tabanı değişmedi (120 = 100, 128 = 1.000).
  - Kısmi etiket yok. Payı 0 olan durum iki tarafta aynı.
  - Tabanda Yaşlandırma'da S168 Toplam 1.100; mizan 120 = 400, 128 = 2.000.
- **C:**
  - (b) tabanda pencere etkin ve 602 / 671 öneriyor (kural farkı uyarısı sürüyor).
  - (a) tabanda B 500 700 / A 671 700 öneriyor, neden yazmıyor.
- **D (hız düzeltmesi): `d-ozet.txt` 302 satır, taban ile aday BAYT BAYT AYNI** (sha256 44a1ea41…). Karşılaştırılanlar:
  - Cari Listesi'nin KPI'ı ve bütün satırları;
  - üç kalabalık cari için kart KPI'ı, şüpheli bölümü, bütün hareket ve fatura satırları ve API detayı;
  - Cari Listesi ve Bakiyeler ile Alacak Yaşlandırma (ekran ve API özeti);
  - Mutabakat Testi.
  - Veri: K1 120 fatura + 60 tahsilat (yarısı bağlı) + 10 Borç Yaz; K2 40 fatura + şüpheli 20.000 + 15 bağsız tahsilat; K3 tedarikçi 8 alış.

### ADIM YARIDA
- Son iki koşuda yok.
- Eksik kalan tek şey: tabandaki B1/B2 ret iletisinin metni okunamadı. Betiğin `metin()` sınırı 600 karakterde kesti; ret ve veri tabanının değişmediği okundu ama iletinin kendisi BİLİNMİYOR (ders 4). Beklenen 409 `doubtful-normal-exceeds` c5a3 raporundan biliniyor, bu koşuda görülmedi.

### BULGU (ürün kodu düzeltilmedi)
1. **(Bilinen, 2.5.1 listesinde.)** Kural Farkı penceresindeki Ters Kaydet onayı "Ters kayıt fişi bugünün tarihiyle yazılır" diyor. Fiş 01.01.2027 tarihiyle yazıldı, bugün 10.01.2027. Kanıt `34-Ca-ters-kaydet-sorusu.png` ve ledger_vouchers.
2. **(DÜŞÜK, görünüm.)** Kural Farkı penceresi pasifken (kendi yılı durumu) başlık yine "Fiş tarihi (ilk açık gün): 01.12.2026 … fark bu fişle ilk açık güne alınır" diyor. Aynı neden metni hem uyarıda hem düğme altında iki kez yazıyor. Kanıt `33-Ca-kural-farki-30-11-a.png`.
3. **Mantık boşluğu görülmedi:** A, B ve C'de 38 üçlünün hepsi beklenenle tuttu, D taban ile aynı.
   - Not: Ca3'te Mutabakat API'si `ok=false` (`ledger:rule-diff`) döndü; ekran bunu "Uyarı (yeni işlemleri engellemez)" diye gösteriyor (tur 2 İş 0 tasarımı).
4. **Yazım düzeni:** kural dışı ad adayı 0. Tarama yalnız başlık, düğme, kolon ve alan adlarına bakıyor; cümleler hariç.

### DENENEN
- Ders 3: her adımda yanıt, ekran ve veri tabanı ya da defter okundu.
- Ders 12: Tab ile ve insan hızında 110 ms gecikmeyle yazım; tahsilat ve kart faizi formlarında. Onay kutusuna Tab ile ulaşılıp Boşluk ile işaretlendi.
- Ders 13: sahte saat; saat 12.10'a ve 2027'ye ilerletildi.
- Ders 39: pencere seçicisi TOP. Ders 30 uygulandı.
- Ders 34: her soru yanıtı nedeniyle yazıldı.
- v2.4.9'un gerçek koduyla üretilmiş veri. Kilit ekrandan konup kaldırıldı.
- Ekran görüntülerine bakıldı: 04, 05, 12, 17, 33 ve D kartı.

### DENENMEYEN
- Ön koşullar API'den girildi (nedeni çıktıda yazılı): hesap ve POS tanımı, faturalar, şüpheliye alma, 25.09 / 01.10 / 03.10 havaleleri, D verisinin hacmi.
- Kartla ödeme (K-15), POS taksitli satış ve iade, Kurulum Sihirbazı ve Devir Kapanışı.
- Banka Hareket Raporu'nun "Hesabı Atanmamış" süzgeci.
- Aynı gün iki bağlı tahsilat (ders 31 sırası): bilerek farklı günlere konuldu.
- (B) vakası (DÜŞÜK-1 ipucu), iki şirket, yetkisiz kullanıcı, UTC saat dilimi (koşular yalnız `TZ=Europe/Istanbul`).
- Hız ölçümü yapılmadı. Ekranda yazılan "açılış ms" değerleri yalnız bilgi.
