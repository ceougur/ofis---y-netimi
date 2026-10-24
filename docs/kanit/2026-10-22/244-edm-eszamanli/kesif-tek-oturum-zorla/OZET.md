# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 02a6acd · başlangıç 22.10.2026 16:31:24 · bitiş 22.10.2026 16:31:48 (TR) · denetim 117/136 geçti · çıkış 1

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit kaldı (18 kalan) · yb-tumunu-gonder kaldı (1 kalan) · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 39 (en çok eşzamanlı 20); SendSMM 39 (en çok eşzamanlı 20); sözleşme (WSDL) okuma 2
- ya-eszamanli-kayit: BULGU ADAYI (N4): 20 Login AYNI ANDA — programın giriş denetimi tek uçuş değil (oturum önbelleği boşken her istek kendi girişini yapar)
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":1053,"medyan":2205,"enCok":2812} ms, Kes, Sonra Gönder {"en":87,"medyan":205,"enCok":324} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":28,"fatura2 başka oturumda gönderildi":28}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":28,"hata":0,"enCokEszamanli":1,"sureMs":{"en":303,"medyan":603,"enCok":904}},"smm:GetSMMStatus":{"sayi":2,"hata":0,"enCokEszamanli":1,"sureMs":{"en":22,"medyan":23,"enCok":23}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 39 (en çok eşzamanlı 20), SendSMM en çok eşzamanlı 20. Sahte EDM: zorla evet, arıza tek-oturum.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-d1ca133c <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026128367439 | 0a08d0c7-1f1c-4484-b7b1-92b791cd9f66 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026128367439 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026128367438 | 217a95f9-266f-4af1-ac65-a66e5a4a6cdc | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026128367438 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026128367441 | 796146ed-d025-4016-9f1d-73c4ddbe986e | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026128367441 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026128367440 | e6283018-523a-4652-a311-552a619e7820 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026128367440 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026128367442 | 7f944cd0-bc51-4d85-ac5f-452c4d8f95ba | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026128367442 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026128367443 | e1b9d46e-68f0-495c-921b-676a8cd47e6d | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026128367443 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026128367444 | 5112b021-4671-49dc-a94b-d13b899e2197 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026128367444 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026128367445 | 7e0b4c5b-2964-4b16-8556-ccc461d64da8 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026128367445 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026128367446 | 8ed8750e-d266-4832-afae-eb4e6ad591cb | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026128367446 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026128367447 | 4d2cff58-61ae-4bb7-af15-b8a80afef0a8 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026128367447 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026128367448 | 48182dee-f976-4868-8f60-0cc0e3530de4 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026128367448 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026128367449 | bb779be7-3f9a-4445-b6b0-13c89fd7f783 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026128367449 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026128367450 | 5bbfbaae-4c4d-44fb-9f97-0efe5d05fa29 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026128367450 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026128367451 | 6936e40b-0702-4ad0-bfa6-08da7b99cd3f | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026128367451 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026128367452 | 85b6817c-957b-40bf-9ac9-adf3935dc55b | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026128367452 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026128367453 | c4e60db0-adff-49d8-8ace-55e0e082f64a | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026128367453 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026128367454 | f530bd58-a09c-4c49-a9e1-3c797ba286c7 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026128367454 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026128367455 | 106991f9-ad7e-4073-9cab-b163c4a44348 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026128367455 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026128367456 | b11bf893-8cc2-422a-9f42-2064fca163c0 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026128367456 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026128367457 | 2884dabc-1d3f-45d7-884f-f3e266eb26fc | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026128367457 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026128367458 | ef4b8793-35f5-4b7f-896a-16fc90e7a08b | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026128367458 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026128367459 | 992cabb1-cb6f-4ee4-a43f-2c0848cff8bc | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026128367459 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026128367460 | 613edca3-f50a-4f88-bd0e-2fce9e33bcca | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026128367460 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026128367461 | 0d4c84b7-c00a-45a7-8c74-497ed7965c99 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026128367461 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026128367462 | 32f35f03-d9a3-45e1-a26a-8b1508277e5f | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026128367462 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026128367463 | b57aadfc-c793-4a0a-bad8-f2426ed5ae32 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026128367463 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026128367464 | 763a3e24-ecdc-4045-9bed-2304cd8ef586 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026128367464 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026128367465 | 32344c5a-107d-4cd2-a5a6-b5e8894a01fe | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026128367465 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026128367466 | f9c9a9b3-3881-4fb0-ba1c-e4e8537e5cf1 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026128367466 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026128367467 | d18e755a-e62e-42ae-a908-b2fe9fb5b29f | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026128367467 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
