# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 02a6acd · başlangıç 22.10.2026 16:31:06 · bitiş 22.10.2026 16:31:10 (TR) · denetim 132/134 geçti · çıkış 1

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu kaldı (1 kalan) · yf-degismezler kaldı (1 kalan) · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 4 (en çok eşzamanlı 4); SendSMM 20 (en çok eşzamanlı 6); sözleşme (WSDL) okuma 2
- ya-eszamanli-kayit: BULGU ADAYI (N4): 4 Login AYNI ANDA — programın giriş denetimi tek uçuş değil (oturum önbelleği boşken her istek kendi girişini yapar)
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":286,"medyan":494,"enCok":742} ms, Kes, Sonra Gönder {"en":98,"medyan":498,"enCok":740} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":6,"medyan":8,"enCok":13}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":1,"medyan":2,"enCok":22}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 4 (en çok eşzamanlı 4), SendSMM en çok eşzamanlı 6. Sahte EDM: zorla hayır, arıza cift.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-106a4a9e <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026444338965 | e1bd5b88-87eb-4b8b-a8d0-394a6e52f59f | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026444338969 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026444338964 | 9e495025-d50a-4caa-87a4-4e0adf22ee6c | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026444338964 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026444338967 | 0ff17080-ced4-4954-86be-6132cc066ae7 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026444338967 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026444338966 | 7b2c1739-84ff-4851-94a4-11f37815a3ee | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026444338966 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026444338968 | 06acc3ee-77e8-4b8d-aa1a-1b01b76bd4e1 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026444338968 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026444338969 | 3cf5f479-e2e1-415c-81a2-e54bdc6cfc2a | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026444338969 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026444338970 | 7d04c124-f8a2-4ec0-8a28-3d496a147670 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026444338970 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026444338971 | 005a674c-3093-4238-acf5-df42fc6af64e | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026444338971 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026444338972 | 3c14cdf2-6083-4e03-9fb8-ff90623c0414 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026444338972 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026444338973 | bcf97b5d-2ecc-43db-8b03-3b71d171df2f | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026444338973 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026444338974 | 310cf6ce-5385-4473-b810-21a1bc6fdc69 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026444338974 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026444338975 | ff9a10b2-6986-416d-8eff-4f42197bdfdc | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026444338975 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026444338976 | 1bd6df79-6382-49a3-8b49-beef0f544d46 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026444338976 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026444338977 | ae25dfc3-bdf8-433a-81c9-bbf8e2e8d78a | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026444338977 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026444338978 | bbb54ce7-91cc-4959-aca2-64ca097758e6 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026444338978 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026444338979 | fa7b25a1-d59a-46e1-8c93-3bde909a6b67 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026444338979 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026444338980 | 344371d0-2069-4f04-8e0b-8de19e45ef7e | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026444338980 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026444338981 | 8084218b-156f-4f77-91a7-6a3eeb085e94 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026444338981 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026444338982 | c0850a30-98f8-47b7-96c6-87f4e97c0d48 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026444338982 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026444338983 | 214673d4-e356-489f-be11-3ba82675bfa5 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026444338983 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026444338984 | fb59524e-7d3d-4ecb-8349-6f4a34779643 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026444338984 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026444338985 | 1886eb51-a703-4205-a13d-442af0bbd6f5 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026444338985 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026444338986 | b878999d-fc6f-4b47-858d-3aa9ac124dc9 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026444338986 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026444338987 | d63cd6d7-aad8-4cd7-8c8d-47997be98dd9 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026444338987 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026444338988 | e7d6f2df-decc-4d54-9668-574816810604 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026444338988 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026444338989 | 6698f39b-53d2-42d1-8aab-53bae22c21c7 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026444338989 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026444338990 | e9f78b16-1e18-458a-832b-288b0aa5ec83 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026444338990 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026444338991 | d5fd66a5-9803-455d-a6db-d2a900adb653 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026444338991 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026444338992 | ce5c751d-4de3-4a0e-85ce-c7e21dac98e7 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026444338992 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026444338993 | fad0824f-2c9d-4afd-ae6c-bf0e24181fad | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026444338993 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
