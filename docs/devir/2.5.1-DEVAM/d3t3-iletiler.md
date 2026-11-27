# Devir iletileri kataloğu (DEVİR NEDEN DURDU — 2.5.1 D3 tur 3)

Kaynak: testlerin ön izleme yanıtından KAYDETTİĞİ gerçek iletiler (elle yazılmış değil) — `test/devir-d3-ileti-katalog.mjs` üretti. Her neden için ilk örnek; "Kaynak" verinin nasıl kurulduğunu söyler
(API: programın kendi API'si; ham veri: API'nin üretemediği eski sürüm / göç durumu; olgu: program tutarlı veride üretmediği için olgu düzeyinde). İç kod (`kod`) makine alanıdır, kullanıcıya gösterilmez.

Neden sayısı: 39 (durdurur 29, uyarı 10); kayıtlı ileti 64.

## Devri Durduran Nedenler

### Gönderilecek e-Belge (`e-belge-bekleyen`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 e-Belge Gönderilecekler'de bekliyor (ör. numarasız belge — Ayşe Demir, 31.12.2026, 1.200,00 TL).
- **Neden duruyor:** Gönderilmemiş belge yeni yılda gönderilirse arşivdeki kaydıyla ayrışır; bu belgeler gönderilmeden ya da iptal edilmeden devir başlatılmaz.
- **Ne yapmalı:**
  1. Faturalar › Gönderilecekler'i açın.
  2. Gönderilecek belgeleri Gönder ile gönderin.
  3. Gönderilmeyecek belgeyi iptal edin.
  4. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar › Gönderilecekler
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Listeden Silinen e-Belge (`e-belge-listeden-silinen`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 e-Belge Listeden Sil ile gönderilmeyecek olarak bırakılmış (ör. FIS2026000000001 — Ayşe Demir, 31.12.2026, 1.200,00 TL).
- **Neden duruyor:** Bu belgeler yeni yılda gönderilirse numara sırası çakışabilir.
- **Ne yapmalı:**
  1. Faturalar › Gönderilecekler'de bu belgeleri bulun.
  2. Belgeyi gönderin ya da iptal edin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar › Gönderilecekler
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Sonucu Belirsiz e-Belge Gönderimi (`e-belge-belirsiz`)

- **Ne oldu:** 1 e-Belgenin gönderim sonucu henüz belli değil (ör. TEA2026000000001 — Ayşe Demir, 31.12.2026, 1.200,00 TL).
- **Neden duruyor:** Belgenin gidip gitmediği bilinmeden devredilirse yeni yılda ikinci kez gönderilebilir ya da hiç gönderilmemiş kalabilir.
- **Ne yapmalı:**
  1. Faturalar'da belgeyi açın.
  2. Durum Sorgula ile sonucunu öğrenin.
  3. Gitmediyse yeniden gönderin; gittiyse başka bir şey yapmanız gerekmez.
  4. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Taslak Fatura (`taslak-fatura`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 taslak fatura var (ör. numarasız belge — Ayşe Demir, 15.12.2026, 1.200,00 TL).
- **Neden duruyor:** Taslak fatura devirde ne arşive ne yeni yıla kesin kayıt olarak geçer.
- **Ne yapmalı:**
  1. Faturalar'da taslakları açın.
  2. Taslağı kaydedin ya da silin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Bekleyen Banka İşi (`banka-isi`)

- **Ne oldu:** 1 banka / POS işi bekliyor (ör. ay sonu komisyon faturası).
- **Neden duruyor:** Bekleyen iş devirden sonra tamamlanırsa kaydı yanlış yıla düşer.
- **Ne yapmalı:**
  1. Banka › Bekleyen İşler'i açın.
  2. İşleri tamamlayın ya da iptal edin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Banka › Bekleyen İşler
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: ham veri (eski sürüm / göç benzetimi); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 2

### Açılış Olabilir Kayıtları Onaylayın (`acilis-olabilir`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 kayıt "Açılış Olabilir" listesinde onay bekliyor.
- **Neden duruyor:** Bu kayıtların açılış mı olağan hareket mi olduğu devirden sonra yalnız Devri Yenile ile değiştirilebilir.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Açılış Olabilir Kayıtlar'ı açın.
  2. Her kaydı onaylayın ya da reddedin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Açılış Olabilir Kayıtlar
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: ham veri (eski sürüm / göç benzetimi); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 2

### Program Güncellemesi Gerekiyor (`plan-siniflandirilmamis-tablo`)

- **Ne oldu:** Veri dosyasında devirde ne olacağı bu sürümde tanımlı olmayan bir tablo var.
- **Neden duruyor:** Tanımsız tablonun kayıtları devirde kaybolabilir ya da iki yılda birden kalabilir.
- **Ne yapmalı:**
  1. Programı en son sürüme güncelleyin.
  2. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: ham veri (eski sürüm / göç benzetimi); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 2

### Defter Mutabakatı (`defter-mutabakati`)

- **Ne oldu:** Ana Defter alt defterlerle tutmuyor: 120 Alıcılar (Müşteri Carileri): fark 500,00 TL.
- **Neden duruyor:** Tutmayan defterle devredilirse yeni yılın açılış bakiyeleri yanlış olur.
- **Ne yapmalı:**
  1. Raporlar › Ana Defter › Defter Mutabakatı'nı açın.
  2. Farkı gösteren hesabın kayıtlarını düzeltin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: (a) kural kancası: W1 maddesine B 120 / A 600 500,00 TL (Ana Defter ≠ cari bakiyesi); K 31.12.2026 — kaynak: API + test kancası; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 2

### Bu Yıl Zaten Devredilmiş (`plan-yil-kapanmis`)

- **Ne oldu:** 2026 yılı için Kapanış Fişi zaten yazılmış.
- **Neden duruyor:** Bir yıl yalnız bir kez devredilir; ikinci devir bakiyeleri iki kez taşır.
- **Ne yapmalı:**
  1. Devir İçin Son İşlem Tarihi olarak henüz devredilmemiş yılın 31 Aralık'ını seçin.
  2. Bu yılın devrini değiştirmek istiyorsanız Devri Yenile'yi kullanın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: plan sorunu (olgu düzeyi): yil-kapanmis — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Dönem Sonucu Tutmuyor (`plan-donem-sonucu-farki`)

- **Ne oldu:** 2026 yılının dönem sonucu Gelir Tablosu'nda 1.200,00 TL, kapanışta 1.000,00 TL (fark 200,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Hesap planında olmayan bir gelir / gider hesabına kayıt varsa kaydı düzeltin.
  3. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): donem-sonucu-farki — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Önceki Yıl Sonucu Tutmuyor (`plan-onceki-yil-dengesiz`)

- **Ne oldu:** 2025 yılının Önceki Yıl Sonucu Fişi dengede değil (fark 50,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): onceki-yil-dengesiz — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Gelir ve Gider Hesapları Kapanmıyor (`plan-sonuc-hesabi-kaldi`)

- **Ne oldu:** Kapanıştan sonra gelir / gider hesaplarında bakiye kalıyor: 600 Yurt İçi Satışlar (Stok) -15,00 TL.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp bu hesapların kayıtlarını denetleyin.
  2. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): sonuc-hesabi-kaldi — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Maliyet Hesabı Kapanmıyor (`plan-yedi-sinifi-kaldi`)

- **Ne oldu:** 760 Pazarlama, Satış ve Dağıtım Giderleri yansıtmayla kapanmıyor (3,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp bu hesabın kayıtlarını denetleyin.
  2. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): yedi-sinifi-kaldi — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Hesap Bakiyesi Modülle Tutmuyor (`plan-modul-farki`)

- **Ne oldu:** 120 Alıcılar (Müşteri Carileri) (Kural Müşterisi) hesabının 31.12.2026 bakiyesi Ana Defter'de 4.000,00 TL, modülün açılışında 0,00 TL (fark 4.000,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp bu hesabın farkını giderin.
  2. Mutabakat Testi'ni çalıştırın; kırmızı madde kalmasın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): modul-farki — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Cari Bakiyesi Tutmuyor (`plan-cari-satir-farki`)

- **Ne oldu:** Kural Müşterisi carisinin devir satırları 31.12.2026 bakiyesini vermiyor (bakiye 700,00 TL, satırların toplamı 500,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Carinin ekstresini açıp kesim günü bakiyesini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Cari (kayıt: cari)
- Senaryo: plan sorunu (olgu düzeyi): cari-satir-farki — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Şüpheli Alacak Tutmuyor (`plan-supheli-farki`)

- **Ne oldu:** 129 Şüpheli Ticari Alacaklar Karşılığı (−) bakiyesi Ana Defter'de -500,00 TL, şüpheli alacak kayıtlarında 0,00 TL.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp şüpheli alacak hesabının farkını giderin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): supheli-farki — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Devir Denetimi Tutmuyor (`degismez-stok-dss`)

- **Ne oldu:** Kapanıştan sonra 153 Ticari Mallar bakiyesi (90,00 TL) dönem sonu stok değeriyle (100,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Mutabakat Testi'ni çalıştırın.
  3. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): degismez / stok-dss — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Devir Denetimi Tutmuyor (`degismez-vergi-191`)

- **Ne oldu:** 191 İndirilecek KDV açılışı (0,00 TL) arşivdeki bakiyesiyle (1,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Mutabakat Testi'ni çalıştırın.
  3. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): degismez / vergi-191 — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Son İşlem Tarihi Yıl Sonu Değil (`DEVIR_K_31_ARALIK`)

- **Ne oldu:** Seçilen son işlem tarihi (30.06.2026) bir yılın son günü değil.
- **Neden duruyor:** Devir yalnız yıl sonunda (31 Aralık) yapılır. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Devir İçin Son İşlem Tarihi olarak geçmiş bir yılın 31 Aralık'ını seçin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: ön izleme reddi: {"company":"sirket-001","cutoff":"2026-06-30"} — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Yıl Henüz Bitmedi (`DEVIR_K_GELECEK`)

- **Ne oldu:** Seçilen son işlem tarihi (31.12.2027) bu yılın ya da gelecek bir yılın sonu (bugün 15.03.2027).
- **Neden duruyor:** Devir yalnız bitmiş bir yıl için yapılır; yıl bitmeden devredilirse yılın kalan kayıtları yanlış yıla düşer. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Geçmiş bir yılın 31 Aralık'ını seçin.
  2. Bu yılı devretmek için yıl bittikten sonra yeniden deneyin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: ön izleme reddi: {"company":"sirket-001","cutoff":"2027-12-31"} — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Cari Bakiye Tipi Seçilmedi (`DEVIR_SECENEK`)

- **Ne oldu:** Cari Bakiye Tipi geçerli bir seçenek değil.
- **Neden duruyor:** Carilerin açılış satırları bu seçime göre hesaplanır. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Borç ve Alacakları Aktar ya da Sadece Bakiyeyi Aktar'ı seçin.
  2. Ön İzleme'yi yeniden başlatın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: ön izleme reddi: {"company":"sirket-001","cutoff":"2026-12-31","option":"hepsi"} — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Hesap Tamamlanamadı (`beklenmeyen-hata`)

- **Ne oldu:** Devir ön izlemesi hesaplanırken beklenmeyen bir sorun çıktı ve hesap tamamlanamadı.
- **Neden duruyor:** Hesabın sonucu bilinmeden devir başlatılmaz. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Ön İzleme'yi yeniden başlatın.
  2. Sorun sürerse Mutabakat Testi'ni çalıştırın ve sonucunu destek ekibine iletin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: beklenmeyen hata: okuyucunun okuduğu sütun yok (ham veri) — kaynak: ham veri; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Ön İzleme Henüz Bitmedi (`devir-preview-running`)

- **Ne oldu:** Ön izleme tamamlanamadığı için Devir Raporu üretilemedi.
- **Neden duruyor:** Devir Raporu ön izlemenin sonucundan üretilir. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Ön İzleme'yi yeniden başlatın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: Devir Raporu istendi, ön izleme tamamlanamadı — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Ön İzleme Bulunamadı (`devir-preview-not-found`)

- **Ne oldu:** İstenen devir ön izlemesi bulunamadı (süresi dolmuş ya da program yeniden başlatılmış olabilir).
- **Neden duruyor:** Ön izlemeler yalnız program açıkken ve son birkaç tanesi saklanır. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Ön İzleme'yi yeniden başlatın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: bilinmeyen ön izleme kimliği — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Kilidi Açıp Yeniden Kilitleyin (`kural-farki-alt-defter`)

- **Ne oldu:** Kilitli dönemde (31.12.2026 ve öncesi) alt defter hesaplarında Kural Değişikliği Farkı var: Kural Müşterisi A — 120 Alıcılar (Müşteri Carileri): alacak yönünde 4.000,00 TL ve Kural Müşterisi A — 128 Şüpheli Ticari Alacaklar: borç yönünde 4.000,00 TL. Carinin toplamı 0,00 TL görünse de hesaplar ayrı ayrı tutmuyor.
- **Neden duruyor:** Alt defter hesabının (cari, banka, kasa, evrak) farkı Kural Farkı Düzeltme Fişi'yle düzeltilemez; düzeltilmeden devredilirse yeni yılın açılışı alt defterle tutmaz.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Dönem Kilidi'nde Kilidi Aç'ı seçin.
  2. Kilidi yeniden 31.12.2026 gününe koyun (Yeniden Kilitle); kilitli dönem güncel kuralla yeniden donar.
  3. Dondurma bitince Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Dönem Kilidi
- Senaryo: S-KD-1: aynı caride 120 −4.000 / 128 +4.000 (toplam 0), kilit 31.12.2026 — kaynak: API + kural kancası; test: `devir-d3-kural`; bu kodla kaydedilen ileti: 3

### Kural Farkı Eski Yılda Düzeltilmeli (`kural-farki-kilit`)

- **Ne oldu:** Dönem Kilidi 31.12.2026 gününde; kilitli dönemde (31.12.2026 ve öncesi) 1 kayıtta Kural Değişikliği Farkı var ve Kural Farkı Düzeltme Fişi kilit yüzünden 01.01.2027 tarihine, yani yeni yıla düşüyor (bugünkü fiş: 198 Diğer Çeşitli Dönen Varlıklar alacak 3.000,00 TL ve 681 Önceki Dönem Gider ve Zararları borç 3.000,00 TL).
- **Neden duruyor:** Fark 2026 ve öncesindeki kayıtlara ait; fiş yeni yılda yazılırsa 2026 yılının kârı yanlış devreder. Fiş 2026 içinde yazılınca 2026 yılının dönem sonucu 3.000,00 TL azalır.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Dönem Kilidi'nde kilidi 30.12.2026 gününe alın.
  2. Yönetim › Sistem › Kural Farkı Düzeltme Fişi'nde ön izlemedeki fişi kaydedin (tarihi 31.12.2026, tutarı 3.000,00 TL).
  3. Dönem Kilidi'ni yeniden 31.12.2026 gününe alın.
  4. Dondurma bitince Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Dönem Kilidi
- Senaryo: S-KD-2: kilit 31.12.2026, yeni kural 659 / 198 3.000,00 TL (fiş 01.01.2027'ye düşecekti) — kaynak: API + kural kancası; test: `devir-d3-kural`; bu kodla kaydedilen ileti: 3

### Kural Farkı Fişi Yeni Yılda (`kural-farki-fis-yeni-yilda`)

- **Ne oldu:** Kural Farkı Düzeltme Fişi Fiş 2027-000001 (01.01.2027, 3.000,00 TL) yeni yılın içinde yazılmış; düzelttiği fark 2026 ve öncesindeki kayıtlara ait.
- **Neden duruyor:** Fark ait olduğu yılda olmalı; fiş yeni yılda kalırsa 2026 yılının kârı yanlış devreder. Fiş 2026 içinde yazılınca 2026 yılının dönem sonucu 3.000,00 TL azalır.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Kural Farkı Düzeltme'de bu fişi Ters Kaydet ile geri alın.
  2. Yönetim › Sistem › Dönem Kilidi'nde kilidi 30.12.2026 gününe alın.
  3. Yönetim › Sistem › Kural Farkı Düzeltme Fişi'nde ön izlemedeki fişi kaydedin (tarihi 31.12.2026, tutarı 3.000,00 TL).
  4. Dönem Kilidi'ni yeniden 31.12.2026 gününe alın.
  5. Dondurma bitince Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Kural Farkı Düzeltme Fişi
- Senaryo: S-KD-2: kilit 31.12.2026 iken düzeltme fişi 01.01.2027'ye yazılmış — kaynak: API + kural kancası; test: `devir-d3-kural`; bu kodla kaydedilen ileti: 1

### Kural Farkı Düzeltme Fişi'ni Yazın (`kural-farki`)

- **Ne oldu:** Kilitli dönemde (30.06.2026 ve öncesi) 1 kayıtta düzeltilmemiş Kural Değişikliği Farkı var; Kural Farkı Düzeltme Fişi'nin yazacağı tutar 3.000,00 TL (198 Diğer Çeşitli Dönen Varlıklar alacak 3.000,00 TL ve 659 Diğer Olağan Gider ve Zararlar borç 3.000,00 TL).
- **Neden duruyor:** Kilitli dönemin defteri eski kuralla donmuş; fark düzeltilmeden devredilirse arşivin kapanışı güncel kuralla tutmaz.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Kural Farkı Düzeltme Fişi'ni açın.
  2. Ön izlemedeki fişi kaydedin (tarihi 01.07.2026).
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Kural Farkı Düzeltme Fişi
- Senaryo: S-3: kilit 30.06.2026, fiş 01.07.2026 (eski yılda) — kaynak: API + kural kancası; test: `devir-d3-kural`; bu kodla kaydedilen ileti: 2

### Dönem Kilidi Dondurması Sürüyor (`dondurma-suruyor`)

- **Ne oldu:** Kilitli dönemin defteri şu anda donduruluyor.
- **Neden duruyor:** Dondurma bitmeden kilitli dönemin kesin bakiyeleri okunamaz.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Dönem Kilidi'nde dondurmanın bitmesini bekleyin.
  2. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Dönem Kilidi
- Senaryo: olgu düzeyi: {"kuralFarki":{"satir":0,"altDefter":0,"tutarMinor":0,"dondurmaSuruyor":true}} — kaynak: olgu (ön denetim olgusu elle); test: `devir-d3-plan`; bu kodla kaydedilen ileti: 1

## Uyarılar

### Önce Aralık Mahsubunu Yapın (`aralik-mahsubu`)

- **Ne oldu:** Aralık 2026 KDV Mahsup Fişi yapılmamış.
- **Neden önemli:** Devirden sonra yalnız Devri Yenile ile yapılabilir; Aralık 2026 indirilecek ve hesaplanan KDV'si yeni yılın hiçbir mahsubuna girmez.
- **Ne yapmalı:**
  1. Vergi › KDV Mahsup Fişi'nde Aralık mahsubunu yapın.
  2. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Vergi › KDV Mahsup Fişi
- Senaryo: (a) uyarılar: Aralık mahsubu yok, 001, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Program Yeniden Başlatılacak (`yeniden-baslatma`)

- **Ne oldu:** İlk şirketin (001) devri programın yeniden başlatılmasını gerektirir.
- **Neden önemli:** Devir sırasında öbür kullanıcıların bağlantısı kesilir.
- **Ne yapmalı:**
  1. Devirden önce öbür kullanıcılara haber verin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: (a) uyarılar: Aralık mahsubu yok, 001, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Aralık Belgeleri Tamamlandı mı? (`erken-devir`)

- **Ne oldu:** Son işlem tarihinin üzerinden 20 gün geçti.
- **Neden önemli:** Geç gelen Aralık belgesi devirden sonra yalnız Devri Yenile ile girilebilir.
- **Ne yapmalı:**
  1. Aralık faturalarının geldiğini ve Aralık beyannamesinin verildiğini denetleyin.
- **Nereye:** Faturalar
- Senaryo: (a) uyarılar: Aralık mahsubu yok, 001, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Tekrarlayan Fatura Şablonu Taşınacak (`tekrarlayan-sablon`)

- **Ne oldu:** 1 etkin tekrarlayan faturanın 31.12.2026 ve öncesi tarihli şablonu var.
- **Neden önemli:** Şablon yeni yıla taslak olarak taşınır; tekrar yeni yılda bu taslaktan sürer.
- **Ne yapmalı:**
  1. Devirden sonra Faturalar'da taşınan şablonları gözden geçirin.
- **Nereye:** Faturalar
- Senaryo: API (sahte EDM): W1–W6, T1, R1–R3; bugün 05.01.2027 — kaynak: API; test: `devir-d3-olgu`; bu kodla kaydedilen ileti: 2

### İptal Süresi Dolmamış e-Belge (`iptal-suresi`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 e-Arşiv / e-SMM belgesinin iptal süresi dolmadı.
- **Neden önemli:** Arşivde iptal yapılamaz.
- **Ne yapmalı:**
  1. İptal edilecek belge varsa devirden önce Faturalar'da iptal edin.
- **Nereye:** Faturalar
- Senaryo: API (sahte EDM): W1–W6, T1, R1–R3; bugün 05.01.2027 — kaynak: API; test: `devir-d3-olgu`; bu kodla kaydedilen ileti: 2

### İçe Aktarmaların Geri Alınması Kapanacak (`ice-aktarma`)

- **Ne oldu:** 31.12.2026 ve öncesinde yapılmış 2 içe aktarma var.
- **Neden önemli:** Devirden sonra bu içe aktarmaların Geri Al'ı kullanılamaz.
- **Ne yapmalı:**
  1. Geri almak istediğiniz içe aktarma varsa devirden önce Taksitler'de Geri Al'ı kullanın.
- **Nereye:** Taksitler
- Senaryo: olgu düzeyi: Aralık mahsubu yok, 2 içe aktarma, 1 şablon, 1 gelen e-Fatura, 1 iptal süresi, eksi stok, kasa -5,00 TL, 001, bugün 10.01.2027 — kaynak: olgu (ön denetim olgusu elle); test: `devir-d3-plan`; bu kodla kaydedilen ileti: 1

### Alınmamış Gelen e-Fatura (`gelen-kutusu`)

- **Ne oldu:** Gelen e-Faturalar'da 31.12.2026 ve öncesi tarihli 1 belge alınmamış.
- **Neden önemli:** Aralık faturaları devirden önce alınmalı; sonra yalnız Devri Yenile ile girilebilir.
- **Ne yapmalı:**
  1. Faturalar › Gelen e-Faturalar'da belgeleri alın.
  2. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar › Gelen e-Faturalar
- Senaryo: olgu düzeyi: Aralık mahsubu yok, 2 içe aktarma, 1 şablon, 1 gelen e-Fatura, 1 iptal süresi, eksi stok, kasa -5,00 TL, 001, bugün 10.01.2027 — kaynak: olgu (ön denetim olgusu elle); test: `devir-d3-plan`; bu kodla kaydedilen ileti: 1

### Eksi Stokla Devreden Ürünler (`eksi-stok`)

- **Ne oldu:** 1 ürün eksi miktarla devredecek (değeri 0,00 TL).
- **Neden önemli:** Eksi miktar yeni yıla aynen geçer; ortalama maliyet yeni yılda sıfırdan başlar.
- **Ne yapmalı:**
  1. Ürün listesini Devir Raporu'nda görün.
  2. Eksik alış faturası varsa devirden önce girin.
- **Nereye:** Stok
- Senaryo: olgu düzeyi: Aralık mahsubu yok, 2 içe aktarma, 1 şablon, 1 gelen e-Fatura, 1 iptal süresi, eksi stok, kasa -5,00 TL, 001, bugün 10.01.2027 — kaynak: olgu (ön denetim olgusu elle); test: `devir-d3-plan`; bu kodla kaydedilen ileti: 1

### Eksi Kasa (`eksi-kasa`)

- **Ne oldu:** Kasa 31.12.2026 itibarıyla eksi bakiyede (-5,00 TL).
- **Neden önemli:** Eksi kasa yeni yıla eksi açılışla geçer.
- **Ne yapmalı:**
  1. Kasa hareketlerini denetleyin; eksik giriş varsa devirden önce girin.
- **Nereye:** Kasa
- Senaryo: olgu düzeyi: Aralık mahsubu yok, 2 içe aktarma, 1 şablon, 1 gelen e-Fatura, 1 iptal süresi, eksi stok, kasa -5,00 TL, 001, bugün 10.01.2027 — kaynak: olgu (ön denetim olgusu elle); test: `devir-d3-plan`; bu kodla kaydedilen ileti: 1

### WhatsApp Gönderimi Durdurulacak (`whatsapp-gonderim`)

- **Ne oldu:** 2 toplu WhatsApp gönderimi bitmedi (1 süren ve 1 duraklatılmış); 3 kişiye ileti henüz gitmedi.
- **Neden önemli:** Devir başlarken bu gönderimler Durduruldu (Devir) olur ve kendiliğinden sürmez; iletisi gitmemiş kişiler almamış sayılır.
- **Ne yapmalı:**
  1. Gönderimin bitmesini istiyorsanız devirden önce bitmesini bekleyin.
  2. Devirden sonra gerekirse yeni gönderim başlatın.
- **Nereye:** WhatsApp › Gönderimler
- Senaryo: S-C5C-9 eki: 001'de 1 süren (2 kişi) + 1 duraklatılmış (1 kişi) toplu gönderim — kaynak: API; test: `devir-d3-wa`; bu kodla kaydedilen ileti: 1

