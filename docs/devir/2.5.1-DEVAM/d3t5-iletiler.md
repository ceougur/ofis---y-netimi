# Devir iletileri kataloğu (DEVİR NEDEN DURDU — 2.5.1 D3)

Kaynak: testlerin ön izleme yanıtından KAYDETTİĞİ gerçek iletiler (elle yazılmış değil) — `test/devir-d3-ileti-katalog.mjs` üretti. Her neden için ilk örnek; "Kaynak" verinin nasıl kurulduğunu söyler
(API: programın kendi API'si; ham veri: API'nin üretemediği eski sürüm / göç durumu; olgu: program tutarlı veride üretmediği için olgu düzeyinde). İç kod (`kod`) makine alanıdır, kullanıcıya gösterilmez.

Neden sayısı: 56 (durdurur 46, uyarı 10); kayıtlı ileti 176.
Katalog taraması (iç kod / İngilizce / alan adı / tablo adı / ISO tarih / nokta ondalık — kayıtlı 176 iletinin bütün kullanıcı alanları): 0 ihlal.

## Devri Durduran Nedenler

### Son İşlem Tarihi Yıl Sonu Değil (`DEVIR_K_31_ARALIK`)

- **Ne oldu:** Seçilen son işlem tarihi (30.06.2026) bir yılın son günü değil.
- **Neden duruyor:** Devir yalnız yıl sonunda (31 Aralık) yapılır. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Devir İçin Son İşlem Tarihi olarak geçmiş bir yılın 31 Aralık'ını seçin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: ön izleme reddi: {"company":"sirket-001","cutoff":"2026-06-30"} — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 2

### Yıl Henüz Bitmedi (`DEVIR_K_GELECEK`)

- **Ne oldu:** Seçilen son işlem tarihi (31.12.2027) bu yılın ya da gelecek bir yılın sonu (bugün 15.03.2027).
- **Neden duruyor:** Devir yalnız bitmiş bir yıl için yapılır; yıl bitmeden devredilirse yılın kalan kayıtları yanlış yıla düşer. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Geçmiş bir yılın 31 Aralık'ını seçin.
  2. Bu yılı devretmek için yıl bittikten sonra yeniden deneyin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: ön izleme reddi: {"company":"sirket-001","cutoff":"2027-12-31"} — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 2

### Cari Bakiye Tipi Seçilmedi (`DEVIR_SECENEK`)

- **Ne oldu:** Cari Bakiye Tipi geçerli bir seçenek değil.
- **Neden duruyor:** Carilerin açılış satırları bu seçime göre hesaplanır. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Borç ve Alacakları Aktar ya da Sadece Bakiyeyi Aktar'ı seçin.
  2. Ön İzleme'yi yeniden başlatın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: ön izleme reddi: {"company":"sirket-001","cutoff":"2026-12-31","option":"hepsi"} — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 2

### Açılış Olabilir Kayıtları Onaylayın (`acilis-olabilir`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 kayıt "Açılış Olabilir" listesinde onay bekliyor.
- **Neden duruyor:** Bu kayıtların açılış mı olağan hareket mi olduğu devirden sonra yalnız Devri Yenile ile değiştirilebilir.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Açılış Olabilir Kayıtlar'ı açın.
  2. Her kaydı onaylayın ya da reddedin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Açılış Olabilir Kayıtlar
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: ham veri (eski sürüm / göç benzetimi); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 4

### Bekleyen Banka İşi (`banka-isi`)

- **Ne oldu:** 1 banka / POS işi bekliyor (ör. ay sonu komisyon faturası); en eskisinin tarihi 31.12.2026.
- **Neden duruyor:** Bekleyen iş devirden sonra tamamlanırsa kaydı yanlış yıla düşer.
- **Ne yapmalı:**
  1. Banka › Bekleyen İşler'i açın.
  2. İşleri tamamlayın ya da iptal edin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Banka › Bekleyen İşler
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: ham veri (eski sürüm / göç benzetimi); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 4

### Hesap Tamamlanamadı (`beklenmeyen-hata`)

- **Ne oldu:** Devir ön izlemesi hesaplanırken beklenmeyen bir sorun çıktı ve hesap tamamlanamadı.
- **Neden duruyor:** Hesabın sonucu bilinmeden devir başlatılmaz. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Ön İzleme'yi yeniden başlatın.
  2. Sorun sürerse Mutabakat Testi'ni çalıştırın ve sonucunu destek ekibine iletin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: beklenmeyen hata: okuyucunun okuduğu sütun yok (ham veri) — kaynak: ham veri; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 2

### Defter Mutabakatı (`defter-mutabakati`)

- **Ne oldu:** Ana Defter alt defterlerle tutmuyor: 120 Alıcılar (Müşteri Carileri): fark 500,00 TL.
- **Neden duruyor:** Tutmayan defterle devredilirse yeni yılın açılış bakiyeleri yanlış olur.
- **Ne yapmalı:**
  1. Raporlar › Ana Defter › Defter Mutabakatı'nı açın.
  2. Farkı gösteren hesabın alt defterindeki (cari, kasa, banka, stok ya da evrak) kayıtlarını Ana Defter'le karşılaştırıp yanlış kaydı düzeltin.
  3. Farkı bulamazsanız Mutabakat Testi'ni çalıştırıp sonucunu destek ekibine iletin.
  4. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: (a) kural kancası: W1 maddesine B 120 / A 600 500,00 TL (Ana Defter ≠ cari bakiyesi); K 31.12.2026 — kaynak: API + test kancası; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 4

### Devir Denetimi Tutmuyor (`degismez-bilinmeyen-degismez`)

- **Ne oldu:** Devir denetimi tutmadı (beklenen 1.000,00 TL, bulunan 900,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-denge`)

- **Ne oldu:** Arşivin kapanış bilançosu dengede değil (fark 900,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-donem-sonucu`)

- **Ne oldu:** Kapanışta 590 / 591'e yazılacak dönem sonucu (900,00 TL) Gelir Tablosu'nun dönem net kârıyla (1.000,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-gecici-hesap`)

- **Ne oldu:** Yeni yılın 519 Eşleştirilecek Açılış Bakiyeleri (900,00 TL) arşivdeki bakiyesiyle (1.000,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-onceki-yillar`)

- **Ne oldu:** Kapanmamış önceki yılların sonucu (900,00 TL) Bilanço'daki geçmiş yıllar tutarıyla (1.000,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-sonuc-sifir`)

- **Ne oldu:** Kapanıştan sonra gelir / gider hesaplarında toplam 900,00 TL bakiye kalıyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-stok-acilis`)

- **Ne oldu:** Stok açılış değerlerinin toplamı (900,00 TL) arşivdeki 153 Ticari Mallar bakiyesiyle (1.000,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Stok'ta bu ürünlerin kesim günü ve öncesindeki hareketlerini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Stok
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-stok-dss`)

- **Ne oldu:** Kapanıştan sonra 153 Ticari Mallar bakiyesi (90,00 TL) dönem sonu stok değeriyle (100,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Stok'ta bu ürünlerin kesim günü ve öncesindeki hareketlerini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Stok
- Senaryo: plan sorunu (olgu düzeyi): degismez / stok-dss — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Devir Denetimi Tutmuyor (`degismez-stok-urun`)

- **Ne oldu:** 1 üründe kesim günü miktarı ya da değeri yeni yılın açılışıyla tutmuyor (Kalem: arşivde 6 Adet / 300,00 TL, açılışta 7 Adet / 350,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Stok'ta bu ürünlerin kesim günü ve öncesindeki hareketlerini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Stok
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 3

### Devir Denetimi Tutmuyor (`degismez-vergi-190`)

- **Ne oldu:** 190 Devreden KDV açılışı (900,00 TL) arşivdeki bakiyesiyle (1.000,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Vergi › KDV Mahsup Fişi'nde bu hesabın dönemlerini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Vergi › KDV Mahsup Fişi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-vergi-191`)

- **Ne oldu:** 191 İndirilecek KDV açılışı (0,00 TL) arşivdeki bakiyesiyle (1,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Vergi › KDV Mahsup Fişi'nde bu hesabın dönemlerini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Vergi › KDV Mahsup Fişi
- Senaryo: plan sorunu (olgu düzeyi): degismez / vergi-191 — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Devir Denetimi Tutmuyor (`degismez-vergi-193`)

- **Ne oldu:** 193 Peşin Ödenen Vergiler (Stopaj) açılışı (900,00 TL) arşivdeki bakiyesiyle (1.000,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Vergi › KDV Mahsup Fişi'nde bu hesabın dönemlerini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Vergi › KDV Mahsup Fişi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-vergi-360`)

- **Ne oldu:** 360 Ödenecek Vergi ve Fonlar (Tevkifat, Stopaj) açılışı (900,00 TL) arşivdeki bakiyesiyle (1.000,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Vergi › KDV Mahsup Fişi'nde bu hesabın dönemlerini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Vergi › KDV Mahsup Fişi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Denetimi Tutmuyor (`degismez-vergi-391`)

- **Ne oldu:** 391 Hesaplanan KDV açılışı (900,00 TL) arşivdeki bakiyesiyle (1.000,00 TL) tutmuyor.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Vergi › KDV Mahsup Fişi'nde bu hesabın dönemlerini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Vergi › KDV Mahsup Fişi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Ön İzleme Bulunamadı (`devir-preview-not-found`)

- **Ne oldu:** İstenen devir ön izlemesi bulunamadı (süresi dolmuş ya da program yeniden başlatılmış olabilir).
- **Neden duruyor:** Ön izlemeler yalnız program açıkken ve son birkaç tanesi saklanır. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Ön İzleme'yi yeniden başlatın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: bilinmeyen ön izleme kimliği — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Ön İzleme Henüz Bitmedi (`devir-preview-running`)

- **Ne oldu:** Ön izleme tamamlanamadığı için Devir Raporu üretilemedi.
- **Neden duruyor:** Devir Raporu ön izlemenin sonucundan üretilir. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Ön İzleme'yi yeniden başlatın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: Devir Raporu istendi, ön izleme tamamlanamadı — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 1

### Sonraki Yıl Devredilmiş (`devir-sonraki-yil-devredilmis`)

- **Ne oldu:** 2027 yılı zaten devredilmiş; seçilen 2026 yılı ondan önce.
- **Neden duruyor:** 2027 yılı devredildiğinde 2026 ve öncesindeki kayıtlar arşive geçti; devredilmiş yıldan önceki bir yıl ayrıca devredilemez.
- **Ne yapmalı:**
  1. Devir İçin Son İşlem Tarihi olarak 2027 yılından sonraki, henüz bitmiş ve devredilmemiş bir yılın 31 Aralık'ını seçin.
  2. Eski yılda düzeltme gerekiyorsa 2027 yılının devri için Devri Yenile'yi kullanın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: D4 benzetimi: 2027 devredilmiş, K 31.12.2026 — kaynak: API; test: `devir-d3-ikinci`; bu kodla kaydedilen ileti: 3

### Önceki Devir Yarıda Kalmış (`devir-yarim-kalmis`)

- **Ne oldu:** Veri dosyası 2026 yılının devredildiğini gösteriyor, ancak şirketin arşiv kaydında bu yılın arşivi yok.
- **Neden duruyor:** Önceki devir tamamlanmadan kesilmiş olabilir; durum netleşmeden yeni devir yapılırsa aynı yıl iki kez taşınabilir.
- **Ne yapmalı:**
  1. Programı kapatıp yeniden açın; yarıda kalan devir açılışta tanınırsa bu neden kalkar.
  2. Sorun sürerse Yönetim › Yedekler › Devir Yedekleri'ndeki devir öncesi yedeği silmeden destek ekibine haber verin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Yedekler › Devir Yedekleri
- Senaryo: D4 benzetimi: devir yılı ayarı var, arşiv kaydı yok — kaynak: API; test: `devir-d3-ikinci`; bu kodla kaydedilen ileti: 3

### Bu Yıl Zaten Devredildi (`devir-yil-devredilmis`)

- **Ne oldu:** 2026 yılı 10.02.2027 tarihinde zaten devredilmiş; şirketin 2026 arşivi kayıtlı.
- **Neden duruyor:** Bir yıl yalnız bir kez devredilir; ikinci devir aynı yılın bakiyelerini yeni yıla ikinci kez taşır ve kayıtlar çift sayılır.
- **Ne yapmalı:**
  1. 2026 yılında düzeltme yapmanız gerekiyorsa Yıl Sonu Devri'nde Devri Yenile'yi kullanın.
  2. Devri baştan yapmak istiyorsanız önce Devri Geri Al ile bu devri geri alın, sonra yeniden devredin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: API + D4 benzetimi (makeArchive): 2026 devredilmiş, K 31.12.2026 — kaynak: API; test: `devir-d3-ikinci`; bu kodla kaydedilen ileti: 4

### Dönem Kilidi Dondurması Sürüyor (`dondurma-suruyor`)

- **Ne oldu:** Kilitli dönemin defteri şu anda donduruluyor.
- **Neden duruyor:** Dondurma bitmeden kilitli dönemin kesin bakiyeleri okunamaz.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Dönem Kilidi'nde dondurmanın bitmesini bekleyin.
  2. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Dönem Kilidi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 3

### Gönderilecek e-Belge (`e-belge-bekleyen`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 e-Belge Gönderilecekler'de bekliyor (ör. numarasız belge — Ayşe Demir, 31.12.2026, 1.200,00 TL).
- **Neden duruyor:** Gönderilmemiş belge yeni yılda gönderilirse arşivdeki kaydıyla ayrışır; bu belgeler gönderilmeden ya da iptal edilmeden devir başlatılmaz.
- **Ne yapmalı:**
  1. Faturalar › Gönderilecekler'i açın.
  2. Gönderilecek belgeleri Gönder ile gönderin.
  3. Gönderilmeyecek belgeyi iptal edin.
  4. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar › Gönderilecekler
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 5

### Sonucu Belirsiz e-Belge Gönderimi (`e-belge-belirsiz`)

- **Ne oldu:** 1 e-Belgenin gönderim sonucu henüz belli değil (ör. TEA2026000000001 — Ayşe Demir, 31.12.2026, 1.200,00 TL).
- **Neden duruyor:** Belgenin gidip gitmediği bilinmeden devredilirse yeni yılda ikinci kez gönderilebilir ya da hiç gönderilmemiş kalabilir.
- **Ne yapmalı:**
  1. Faturalar'da belgeyi açın.
  2. Durum Sorgula ile sonucunu öğrenin.
  3. Gitmediyse yeniden gönderin; gittiyse başka bir şey yapmanız gerekmez.
  4. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 5

### Listeden Silinen e-Belge (`e-belge-listeden-silinen`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 e-Belge Listeden Sil ile gönderilmeyecek olarak bırakılmış (ör. FIS2026000000001 — Ayşe Demir, 31.12.2026, 1.200,00 TL).
- **Neden duruyor:** Bu belgeler yeni yılda gönderilirse numara sırası çakışabilir.
- **Ne yapmalı:**
  1. Faturalar › Gönderilecekler'de bu belgeleri bulun.
  2. Belgeyi gönderin ya da iptal edin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar › Gönderilecekler
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 5

### Kural Farkı Düzeltme Fişi'ni Yazın (`kural-farki`)

- **Ne oldu:** Kilitli dönemde (31.12.2026 ve öncesi) 2 kayıtta düzeltilmemiş Kural Değişikliği Farkı var; Kural Farkı Düzeltme Fişi'nin yazacağı tutar 3.000,00 TL (600 Yurt İçi Satışlar (Stok) borç 3.000,00 TL).
- **Neden duruyor:** Kilitli dönemin defteri eski kuralla donmuş; fark düzeltilmeden devredilirse arşivin kapanışı güncel kuralla tutmaz.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Kural Farkı Düzeltme Fişi'ni açın.
  2. Ön izlemedeki fişi kaydedin (tarihi 31.12.2026).
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Kural Farkı Düzeltme Fişi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 3

### Kilidi Açıp Yeniden Kilitleyin (`kural-farki-alt-defter`)

- **Ne oldu:** Kilitli dönemde (31.12.2026 ve öncesi) alt defter hesaplarında Kural Değişikliği Farkı var: Kural Müşterisi — 120 Alıcılar (Müşteri Carileri): borç yönünde 4.000,00 TL ve Kural Müşterisi — 128 Şüpheli Ticari Alacaklar: alacak yönünde 4.000,00 TL. Carinin toplamı 0,00 TL görünse de hesaplar ayrı ayrı tutmuyor.
- **Neden duruyor:** Alt defter hesabının (cari, banka, kasa, evrak) farkı Kural Farkı Düzeltme Fişi'yle düzeltilemez; düzeltilmeden devredilirse yeni yılın açılışı alt defterle tutmaz.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Dönem Kilidi'nde Kilidi Aç'ı seçin.
  2. Kilidi yeniden 31.12.2026 gününe koyun (Yeniden Kilitle); kilitli dönem güncel kuralla yeniden donar.
  3. Dondurma bitince Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Dönem Kilidi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 5

### Kural Farkı Fişi Yeni Yılda (`kural-farki-fis-yeni-yilda`)

- **Ne oldu:** Kural Farkı Düzeltme Fişi 2027/1 (02.01.2027, 3.000,00 TL) yeni yılın içinde yazılmış; düzelttiği fark 2026 ve öncesindeki kayıtlara ait.
- **Neden duruyor:** Fark ait olduğu yılda olmalı; fiş yeni yılda kalırsa 2026 yılının kârı yanlış devreder. Fiş 2026 içinde yazılınca 2026 yılının dönem sonucu 3.000,00 TL azalır.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Kural Farkı Düzeltme'de bu fişi Ters Kaydet ile geri alın.
  2. Yönetim › Sistem › Dönem Kilidi'nde kilidi 30.12.2026 gününe alın.
  3. Yönetim › Sistem › Kural Farkı Düzeltme Fişi'nde ön izlemedeki fişi kaydedin (tarihi 31.12.2026, tutarı 3.000,00 TL).
  4. Dönem Kilidi'ni yeniden 31.12.2026 gününe alın.
  5. Dondurma bitince Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Kural Farkı Düzeltme Fişi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Kural Farkı Eski Yılda Düzeltilmeli (`kural-farki-kilit`)

- **Ne oldu:** Dönem Kilidi 31.12.2026 gününde; kilitli dönemde (31.12.2026 ve öncesi) 2 kayıtta Kural Değişikliği Farkı var ve Kural Farkı Düzeltme Fişi kilit yüzünden 01.01.2027 tarihine, yani yeni yıla düşüyor (bugünkü fiş: 600 Yurt İçi Satışlar (Stok) borç 3.000,00 TL).
- **Neden duruyor:** Fark 2026 ve öncesindeki kayıtlara ait; fiş yeni yılda yazılırsa 2026 yılının kârı yanlış devreder. Fiş 2026 içinde yazılınca 2026 yılının dönem sonucu 3.000,00 TL azalır.
- **Ne yapmalı:**
  1. Yönetim › Sistem › Dönem Kilidi'nde kilidi 30.12.2026 gününe alın.
  2. Yönetim › Sistem › Kural Farkı Düzeltme Fişi'nde ön izlemedeki fişi kaydedin (tarihi 31.12.2026, tutarı 3.000,00 TL).
  3. Dönem Kilidi'ni yeniden 31.12.2026 gününe alın.
  4. Dondurma bitince Ön İzleme'yi yeniden başlatın.
- **Nereye:** Yönetim › Sistem › Dönem Kilidi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 4

### Ön İzlemeden Sonra Kayıt Girildi (`on-izleme-bayat`)

- **Ne oldu:** Onayladığınız ön izlemeden (05.01.2027 saat 10:15) sonra şirkette kayıt girildi ya da bir kayıt değişti.
- **Neden duruyor:** Devir, onayladığınız ön izlemenin sayılarıyla yapılmalı; araya giren kayıt açılış bakiyelerini değiştirir, bu yüzden devir durdu. Verileriniz değişmedi.
- **Ne yapmalı:**
  1. Yıl Sonu Devri'nde Ön İzleme'yi yeniden başlatın.
  2. Yeni ön izlemenin sayılarını ve Devir Raporu'nu inceleyin.
  3. Sayılar doğruysa devri yeniden onaylayın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Devir Hesabı Tutmuyor (`plan-bilinmeyen-sorun`)

- **Ne oldu:** Devir hesabında beklenmeyen bir tutarsızlık bulundu.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Mutabakat Testi'ni çalıştırın.
  2. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  3. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Yönetim › Sistem › Mutabakat Testi
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Cari Bakiyesi Tutmuyor (`plan-cari-satir-farki`)

- **Ne oldu:** Kural Müşterisi carisinin 120 Alıcılar (Müşteri Carileri) hesabındaki devir satırları 31.12.2026 bakiyesini vermiyor (bakiye 700,00 TL, satırların toplamı 500,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Carinin ekstresini açıp kesim günü bakiyesini denetleyin.
  2. Mutabakat Testi'ni çalıştırın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Cari (kayıt: cari)
- Senaryo: plan sorunu (olgu düzeyi): cari-satir-farki — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Dönem Sonucu Tutmuyor (`plan-donem-sonucu-farki`)

- **Ne oldu:** 2026 yılının dönem sonucu Gelir Tablosu'nda 1.200,00 TL, kapanışta 1.000,00 TL (fark 200,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp farkı gösteren hesabı bulun.
  2. Hesap planında olmayan bir gelir / gider hesabına kayıt varsa kaydı düzeltin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): donem-sonucu-farki — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Hesap Bakiyesi Modülle Tutmuyor (`plan-modul-farki`)

- **Ne oldu:** 120 Alıcılar (Müşteri Carileri) (Kural Müşterisi) hesabının 31.12.2026 bakiyesi Ana Defter'de 4.000,00 TL, Cari'nin açılışında 0,00 TL (fark 4.000,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp bu hesabın farkını giderin.
  2. Mutabakat Testi'ni çalıştırın; kırmızı madde kalmasın.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): modul-farki — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 17

### Önceki Yıl Sonucu Tutmuyor (`plan-onceki-yil-dengesiz`)

- **Ne oldu:** 2025 yılının Önceki Yıl Sonucu Fişi dengede değil (fark 50,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp 2025 yılının farkını gösteren hesabı bulun.
  2. Hesap planında olmayan bir gelir / gider hesabına kayıt varsa kaydı düzeltin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): onceki-yil-dengesiz — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Program Güncellemesi Gerekiyor (`plan-siniflandirilmamis-tablo`)

- **Ne oldu:** Veri dosyasında devirde ne olacağı bu sürümde tanımlı olmayan bir tablo var.
- **Neden duruyor:** Tanımsız tablonun kayıtları devirde kaybolabilir ya da iki yılda birden kalabilir.
- **Ne yapmalı:**
  1. Programı en son sürüme güncelleyin.
  2. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  3. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: ham veri (eski sürüm / göç benzetimi); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 4

### Gelir ve Gider Hesapları Kapanmıyor (`plan-sonuc-hesabi-kaldi`)

- **Ne oldu:** Kapanıştan sonra gelir / gider hesaplarında bakiye kalıyor: 600 Yurt İçi Satışlar (Stok) alacak yönünde 15,00 TL.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp bu hesapların kayıtlarını denetleyin.
  2. Hesap planında olmayan bir alt hesaba yazılmış kayıt varsa kaydı düzeltin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): sonuc-hesabi-kaldi — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Şüpheli Alacak Tutmuyor (`plan-supheli-farki`)

- **Ne oldu:** 129 Şüpheli Ticari Alacaklar Karşılığı (−) bakiyesi Ana Defter'de -500,00 TL, şüpheli alacak kayıtlarında 0,00 TL.
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Cari › Şüpheli Alacaklar'da carinin kayıtlarını denetleyin.
  2. Defter Mutabakatı'nı açıp şüpheli alacak hesabının farkını giderin.
  3. Mutabakat Testi'ni çalıştırın.
  4. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  5. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Cari › Şüpheli Alacaklar
- Senaryo: plan sorunu (olgu düzeyi): supheli-farki — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 5

### Maliyet Hesabı Kapanmıyor (`plan-yedi-sinifi-kaldi`)

- **Ne oldu:** 760 Pazarlama, Satış ve Dağıtım Giderleri yansıtmayla kapanmıyor (borç yönünde 3,00 TL).
- **Neden duruyor:** Devirden sonra arşivin kapanışı ile yeni yılın açılışı kuruşu kuruşuna aynı olmalı; tutmayan hesapla devir yapılırsa yeni yılın bakiyeleri yanlış başlar.
- **Ne yapmalı:**
  1. Defter Mutabakatı'nı açıp bu hesabın kayıtlarını denetleyin.
  2. Gider türü tanınmayan kayıt varsa gider türünü düzeltin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
  4. Sorun sürerse Devir Raporu'nu (PDF) destek ekibine iletin.
- **Nereye:** Raporlar › Ana Defter › Defter Mutabakatı
- Senaryo: plan sorunu (olgu düzeyi): yedi-sinifi-kaldi — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Bu Yıl Zaten Devredilmiş (`plan-yil-kapanmis`)

- **Ne oldu:** 2026 yılı için Kapanış Fişi zaten yazılmış.
- **Neden duruyor:** Bir yıl yalnız bir kez devredilir; ikinci devir bakiyeleri iki kez taşır.
- **Ne yapmalı:**
  1. Devir İçin Son İşlem Tarihi olarak henüz devredilmemiş yılın 31 Aralık'ını seçin.
  2. Bu yılın devrini değiştirmek istiyorsanız Devri Yenile'yi kullanın.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: plan sorunu (olgu düzeyi): yil-kapanmis — kaynak: olgu (program tutarlı veride üretmez); test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 3

### Taslak Fatura (`taslak-fatura`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 taslak fatura var (ör. numarasız belge — Ayşe Demir, 15.12.2026, 1.200,00 TL).
- **Neden duruyor:** Taslak fatura devirde ne arşive ne yeni yıla kesin kayıt olarak geçer.
- **Ne yapmalı:**
  1. Faturalar'da taslakları açın.
  2. Taslağı kaydedin ya da silin.
  3. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar
- Senaryo: (a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 5

## Uyarılar

### Önce Aralık Mahsubunu Yapın (`aralik-mahsubu`)

- **Ne oldu:** Aralık 2026 KDV Mahsup Fişi yapılmamış.
- **Neden önemli:** Devirden sonra yalnız Devri Yenile ile yapılabilir; Aralık 2026 indirilecek ve hesaplanan KDV'si yeni yılın hiçbir mahsubuna girmez.
- **Ne yapmalı:**
  1. Vergi › KDV Mahsup Fişi'nde Aralık mahsubunu yapın.
  2. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Vergi › KDV Mahsup Fişi
- Senaryo: (a) uyarılar: Aralık mahsubu yok, 001, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 4

### Eksi Kasa (`eksi-kasa`)

- **Ne oldu:** Kasa 31.12.2026 itibarıyla eksi bakiyede (-100,00 TL).
- **Neden önemli:** Eksi kasa yeni yıla eksi açılışla geçer.
- **Ne yapmalı:**
  1. Kasa hareketlerini denetleyin; eksik giriş varsa devirden önce girin.
- **Nereye:** Kasa
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Eksi Stokla Devreden Ürünler (`eksi-stok`)

- **Ne oldu:** 1 ürün eksi miktarla devredecek (değeri 0,00 TL).
- **Neden önemli:** Eksi miktar yeni yıla aynen geçer; ortalama maliyet yeni yılda sıfırdan başlar.
- **Ne yapmalı:**
  1. Ürün listesini Devir Raporu'nda görün.
  2. Eksik alış faturası varsa devirden önce girin.
- **Nereye:** Stok
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Aralık Belgeleri Tamamlandı mı? (`erken-devir`)

- **Ne oldu:** Son işlem tarihinin üzerinden 20 gün geçti.
- **Neden önemli:** Geç gelen Aralık belgesi devirden sonra yalnız Devri Yenile ile girilebilir.
- **Ne yapmalı:**
  1. Aralık faturalarının geldiğini ve Aralık beyannamesinin verildiğini denetleyin.
- **Nereye:** Faturalar
- Senaryo: (a) uyarılar: Aralık mahsubu yok, 001, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 4

### Alınmamış Gelen e-Fatura (`gelen-kutusu`)

- **Ne oldu:** Gelen e-Faturalar'da 31.12.2026 ve öncesi tarihli 1 belge alınmamış.
- **Neden önemli:** Aralık faturaları devirden önce alınmalı; sonra yalnız Devri Yenile ile girilebilir.
- **Ne yapmalı:**
  1. Faturalar › Gelen e-Faturalar'da belgeleri alın.
  2. Yıl Sonu Devri'ne dönüp Ön İzleme'yi yeniden başlatın.
- **Nereye:** Faturalar › Gelen e-Faturalar
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### İçe Aktarmaların Geri Alınması Kapanacak (`ice-aktarma`)

- **Ne oldu:** 31.12.2026 ve öncesinde yapılmış 1 içe aktarma var.
- **Neden önemli:** Devirden sonra bu içe aktarmaların Geri Al'ı kullanılamaz.
- **Ne yapmalı:**
  1. Geri almak istediğiniz içe aktarma varsa devirden önce Taksitler'de Geri Al'ı kullanın.
- **Nereye:** Taksitler
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### İptal Süresi Dolmamış e-Belge (`iptal-suresi`)

- **Ne oldu:** 31.12.2026 ve öncesi tarihli 1 e-Arşiv / e-SMM belgesinin iptal süresi dolmadı.
- **Neden önemli:** Arşivde iptal yapılamaz.
- **Ne yapmalı:**
  1. İptal edilecek belge varsa devirden önce Faturalar'da iptal edin.
- **Nereye:** Faturalar
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 3

### Tekrarlayan Fatura Şablonu Taşınacak (`tekrarlayan-sablon`)

- **Ne oldu:** 1 etkin tekrarlayan faturanın 31.12.2026 ve öncesi tarihli şablonu var.
- **Neden önemli:** Şablon yeni yıla taslak olarak taşınır; tekrar yeni yılda bu taslaktan sürer.
- **Ne yapmalı:**
  1. Devirden sonra Faturalar'da taşınan şablonları gözden geçirin.
- **Nereye:** Faturalar
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 3

### WhatsApp Gönderimi Durdurulacak (`whatsapp-gonderim`)

- **Ne oldu:** 2 toplu WhatsApp gönderimi bitmedi (1 süren ve 1 duraklatılmış); 3 kişiye ileti henüz gitmedi, bunların 1 kişisi sınır nedeniyle bekliyor.
- **Neden önemli:** Devir başlarken bu gönderimler Durduruldu (Devir) olur ve kendiliğinden sürmez; iletisi gitmemiş kişiler almamış sayılır.
- **Ne yapmalı:**
  1. Gönderimin bitmesini istiyorsanız devirden önce bitmesini bekleyin.
  2. Devirden sonra gerekirse yeni gönderim başlatın.
- **Nereye:** WhatsApp › Gönderimler
- Senaryo: olgu: bütün nedenler (K 31.12.2026, bugün 10.01.2027) — kaynak: olgu (program tutarlı veride çoğunu üretmez); test: `devir-d3-ileti-tum`; bu kodla kaydedilen ileti: 2

### Program Yeniden Başlatılacak (`yeniden-baslatma`)

- **Ne oldu:** İlk şirketin (001) devri programın yeniden başlatılmasını gerektirir.
- **Neden önemli:** Devir sırasında öbür kullanıcıların bağlantısı kesilir.
- **Ne yapmalı:**
  1. Devirden önce öbür kullanıcılara haber verin.
- **Nereye:** Ayarlar › Yıl Sonu Devri
- Senaryo: (a) uyarılar: Aralık mahsubu yok, 001, bugün 20.01.2027 — kaynak: API; test: `devir-d3-ileti`; bu kodla kaydedilen ileti: 4

