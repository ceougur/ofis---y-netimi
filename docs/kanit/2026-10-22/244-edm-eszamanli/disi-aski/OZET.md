# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 02a6acd · başlangıç 22.10.2026 16:31:14 · bitiş 22.10.2026 16:31:23 (TR) · denetim 133/134 geçti · çıkış 1

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit kaldı (1 kalan) · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 4 (en çok eşzamanlı 4); SendSMM 20 (en çok eşzamanlı 6); sözleşme (WSDL) okuma 2
- ya-eszamanli-kayit: BULGU ADAYI (N4): 4 Login AYNI ANDA — programın giriş denetimi tek uçuş değil (oturum önbelleği boşken her istek kendi girişini yapar)
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":375,"medyan":599,"enCok":3000} ms, Kes, Sonra Gönder {"en":92,"medyan":585,"enCok":804} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":6,"medyan":10,"enCok":13}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":1,"medyan":2,"enCok":27}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 4 (en çok eşzamanlı 4), SendSMM en çok eşzamanlı 6. Sahte EDM: zorla hayır, arıza aski.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-2cdfd36c <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026313693891 | f8395e2d-0535-4750-97a4-4090e579b50b | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026313693891 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026313693890 | 727d8eb5-c962-4c8a-986f-3f2d93d294e7 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026313693890 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026313693893 | 007ff91d-2307-4f2e-b698-1379f6f56904 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026313693893 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026313693892 | a8e80217-c301-4157-a55d-6676c56c76c1 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026313693892 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026313693894 | eed852d7-6b0b-4490-a81f-15a95e7f28cc | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026313693894 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026313693895 | a7ac329e-9462-455c-afb6-6a84df970e10 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026313693895 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026313693896 | c2e3a0e4-9703-49d9-be10-85def55488d4 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026313693896 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026313693897 | fa13c653-7c4b-44b9-80a4-bf1ce0dc9d75 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026313693897 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026313693898 | a0f1bf98-4ccb-44f2-93f1-fd139db7f778 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026313693898 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026313693899 | 24e7e9a3-d975-4dd6-990c-a83b30955103 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026313693899 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026313693900 | b76d1dea-cdd1-4967-900a-4d8a11a34c2e | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026313693900 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026313693901 | 5fe4c378-f39b-4f1b-a45a-6e8fec47e7ef | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026313693901 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026313693902 | 1d67a694-3a75-469f-8401-f1752d1cdc96 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026313693902 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026313693903 | 9c3d7497-dd04-479b-83d2-69bc7a714ac4 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026313693903 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026313693904 | 9f6f3c7e-d302-4a08-9762-07351e1e91dc | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026313693904 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026313693905 | 85308589-43c5-4670-b4f6-433764494da7 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026313693905 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026313693906 | 6ebee38c-972e-463f-bcce-68c214e6131d | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026313693906 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026313693907 | b2bf34db-2cbd-4cb3-a215-ce6b17baf82c | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026313693907 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026313693908 | 0e8eb233-e875-453d-8900-29fdd7053f4a | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026313693908 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026313693909 | 77618223-c421-4da2-9c72-1d519a1b2587 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026313693909 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026313693910 | 82561057-4bd7-4c02-8b6c-9edcd04de6ac | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026313693910 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026313693911 | 4e2ae42d-c15f-49e3-9ccb-21988935442a | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026313693911 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026313693912 | 87d05a3e-0098-44b8-905b-c9ca782f7972 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026313693912 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026313693913 | 000acb76-087f-4aff-8437-e5105efe5ba5 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026313693913 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026313693914 | 5c3efa85-fd0c-4452-8661-f016b457a2fe | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026313693914 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026313693915 | 020e37e4-054d-4a92-bd07-af2bb55292bb | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026313693915 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026313693916 | dfdd004e-4103-4cf3-bd02-02f9445ac0ee | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026313693916 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026313693917 | 96809e67-d843-4eed-a782-7565b07b93f3 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026313693917 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026313693918 | 886a9e0c-12d7-426b-a2da-3802277c0bc2 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026313693918 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026313693919 | 0c9db71c-6b9e-4df0-b472-5d0f96dffde2 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026313693919 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
