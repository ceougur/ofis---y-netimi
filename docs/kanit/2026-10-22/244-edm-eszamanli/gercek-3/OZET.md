# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit e070d42 · başlangıç 22.10.2026 17:55:19 · bitiş 22.10.2026 17:57:09 (TR) · denetim 136/136 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 1 (en çok eşzamanlı 1); SendSMM 20 (en çok eşzamanlı 20); sözleşme (WSDL) okuma 1
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":4266,"medyan":6993,"enCok":8349} ms, Kes, Sonra Gönder {"en":71,"medyan":253,"enCok":323} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":1751,"medyan":1840,"enCok":1910}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":549,"medyan":576,"enCok":601}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 1 (en çok eşzamanlı 1), SendSMM en çok eşzamanlı 20.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-9066c74d <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026342600914 | 44d54116-cf08-491a-8a09-b952db02e80e | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026342600914 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026342600915 | b40b1c38-1f01-40dd-889f-200113de263a | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026342600915 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026342600916 | e5fe22f8-9ddb-4628-9565-8f61e409b777 | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026342600916 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026342600917 | fa10f85c-bfa5-4e8b-9dcb-b6ebbecc3a8a | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026342600917 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026342600918 | 34befb4b-80d0-4602-98b2-3cdeded1dbc1 | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026342600918 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026342600919 | b4c60c1c-8848-44bd-b7b5-0f65d5ce3d6d | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026342600919 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026342600920 | fb0d295f-6ff4-485b-bfa7-de2b395a5d97 | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026342600920 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026342600921 | 9967ca09-b166-4e48-816a-926ab064f616 | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026342600921 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026342600922 | 07fec4ce-bf75-4ede-9c17-c8c12f1ea8d0 | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026342600922 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026342600923 | 514ec404-d459-418c-a671-baa123dd6919 | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026342600923 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026342600924 | 02b36150-fc55-4252-94af-dceb719adb81 | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026342600924 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026342600925 | f33ae0ee-34f3-454a-bfca-e5f651d0f763 | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026342600925 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026342600926 | 4706431d-59a3-49b5-9e22-7c09b6297659 | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026342600926 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026342600927 | f9a39d53-0f9f-4440-9265-7f8bbaf4c2c2 | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026342600927 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026342600928 | 2cfa2ee9-1639-4960-81cc-8808b8ef84ef | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026342600928 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026342600929 | 3375ed8f-fb0b-4cf9-b783-34a0a336c2ca | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026342600929 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026342600930 | 5e2c1ed4-1e45-4a8c-8464-a1086debf11a | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026342600930 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026342600931 | 6f3b926e-336b-40a8-a554-429ca9131d2a | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026342600931 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026342600932 | 9631d593-5c9c-4c56-b2be-9bd124d7dac7 | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026342600932 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026342600933 | 49ae8fd4-2602-4c5e-834d-52f1eff53993 | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026342600933 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026342600934 | d09511e7-398f-4e33-914e-de3f050e7cb6 | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026342600934 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026342600935 | f6bcfa48-e4b6-4476-8b74-2617ae4ef861 | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026342600935 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026342600936 | 08233387-73d7-4a72-9dad-bd41e06cd085 | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026342600936 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026342600937 | da7ac87f-3b76-488b-bb92-581909e000b4 | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026342600937 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026342600938 | c2a4580c-3e96-4278-8a7f-19b433ec1b52 | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026342600938 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026342600939 | 705333ef-ce80-4815-a800-b7eb759a2db2 | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026342600939 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026342600940 | b8c45f15-37eb-4533-9d98-5845620a8e70 | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026342600940 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026342600941 | 56889627-9dc2-4d2e-8c75-7c8b91b321d3 | 22.10.2026 | 17:55 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026342600941 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026342600942 | f590fd1b-897a-4dfc-9a00-7908e509581a | 22.10.2026 | 17:55 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026342600942 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026342600943 | 91a997f3-f657-411d-8a89-dcce51331728 | 22.10.2026 | 17:55 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026342600943 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 152, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
