# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 02a6acd · başlangıç 22.10.2026 16:30:46 · bitiş 22.10.2026 16:30:50 (TR) · denetim 134/134 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 4 (en çok eşzamanlı 4); SendSMM 20 (en çok eşzamanlı 6); sözleşme (WSDL) okuma 2
- ya-eszamanli-kayit: BULGU ADAYI (N4): 4 Login AYNI ANDA — programın giriş denetimi tek uçuş değil (oturum önbelleği boşken her istek kendi girişini yapar)
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":280,"medyan":505,"enCok":803} ms, Kes, Sonra Gönder {"en":94,"medyan":511,"enCok":800} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":5,"medyan":9,"enCok":12}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":1,"medyan":2,"enCok":27}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 4 (en çok eşzamanlı 4), SendSMM en çok eşzamanlı 6. Sahte EDM: zorla hayır, arıza yok.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-607c3ec6 <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026412434065 | b5119aef-a516-41b0-b787-2975b3e6f02a | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026412434065 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026412434064 | bedb8dd4-8e4b-45d2-a8d0-f4b6959bb4ca | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026412434064 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026412434067 | ff7410d1-f08d-49dc-8d16-69624ebc4993 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026412434067 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026412434066 | f956df2b-f672-4b23-829d-7d623e90df2d | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026412434066 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026412434068 | 74c0f391-6129-48ec-a046-fab3d461d964 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026412434068 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026412434069 | 55075331-83d6-41c6-83a6-f74740028e4b | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026412434069 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026412434070 | d593bcb5-710d-46b7-81f8-a0576726ea7d | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026412434070 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026412434071 | 7e4c85b1-4d8b-4417-be5b-b4273202ba19 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026412434071 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026412434072 | 5e300817-068d-40cd-8c74-7356efa0ae33 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026412434072 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026412434073 | 3996f5ac-d9e8-4400-b7a3-9891f67e22d1 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026412434073 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026412434074 | 2afe9952-e3f9-4fa3-bdfd-35df3ec361a9 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026412434074 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026412434075 | 6e1b5f20-a547-421b-983a-b34e3578c05b | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026412434075 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026412434076 | 8f5a36de-8002-4e4b-a71a-43b7ef970867 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026412434076 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026412434077 | 98a7a040-b3c5-4acd-b973-00d242c70d65 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026412434077 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026412434078 | f7cadebc-ec3a-452e-8e1b-4cb6bc2119df | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026412434078 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026412434079 | aa96e28b-7a0a-4ec6-820b-f052c928a9eb | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026412434079 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026412434080 | abfc4d32-db0e-4db5-97e4-609459adbfb8 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026412434080 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026412434081 | 57788753-7bad-4fb3-b551-b7341582988e | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026412434081 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026412434082 | 90b3869d-2834-4b7f-a501-622eec36bdad | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026412434082 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026412434083 | 2cfd3f44-1e01-46c0-a265-4e5f87cf04c9 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026412434083 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026412434084 | c239f323-5d1a-4075-a9a5-990c3b806213 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026412434084 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026412434085 | 756e7899-b284-4c63-a692-cee09c307aa4 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026412434085 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026412434086 | d5925915-c583-4097-85b1-c94a5a92af73 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026412434086 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026412434087 | f3ade101-66d8-4027-9ac0-152fb10b7227 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026412434087 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026412434088 | 477525f6-af16-4315-a48f-fdd1456bb5b3 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026412434088 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026412434089 | 4214568b-246c-485e-8611-9bb78e42eb8e | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026412434089 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026412434090 | df95e6a0-5ac3-45fa-984c-9d1a6dd908c4 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026412434090 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026412434091 | 8c259fe9-e971-4ae4-8108-0079d52df6a8 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026412434091 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026412434092 | 0eca443d-17b2-4ded-ace5-a692da63fcb8 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026412434092 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026412434093 | a1cbaa44-ecaa-4a04-b836-7be63d98d35f | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026412434093 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
