# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 51c3074 · başlangıç 22.10.2026 16:58:44 · bitiş 22.10.2026 16:58:56 (TR) · denetim 136/136 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 1 (en çok eşzamanlı 1); SendSMM 20 (en çok eşzamanlı 20); sözleşme (WSDL) okuma 1
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":1043,"medyan":1354,"enCok":1646} ms, Kes, Sonra Gönder {"en":94,"medyan":189,"enCok":263} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- ya-eszamanli-kayit: ön koşul (zorla, soğuk): önbellek boşken aynı anda 20 SendSMM, sahte EDM'de en çok eşzamanlı Login 1
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":303,"medyan":603,"enCok":903}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":22,"medyan":23,"enCok":36}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 1 (en çok eşzamanlı 1), SendSMM en çok eşzamanlı 20. Sahte EDM: zorla evet, arıza es-giris.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-2c78c488 <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026757579565 | 714d5644-84bd-40a3-886a-2153dac90b5a | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026757579565 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026757579566 | e64d3803-ae8f-4b40-9a1e-b01b983eed8c | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026757579566 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026757579567 | eb472d35-a943-4a16-9d59-179f5a302340 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026757579567 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026757579568 | 6bfa3825-5d4f-42ef-83aa-148b5da0303a | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026757579568 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026757579569 | b4bcc779-1749-4f86-8e08-ab9ff30be6c2 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026757579569 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026757579570 | 4b4da34d-c33e-443f-95b3-fe1e33fc2f8b | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026757579570 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026757579571 | 6cef0d92-980d-43e5-bc79-a200a3b3a11b | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026757579571 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026757579572 | d47624d9-c38c-47c6-9dc8-e453ffb9995d | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026757579572 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026757579573 | b973e8e1-0098-4dcc-93e8-59a312f3cbeb | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026757579573 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026757579574 | cfe94784-0095-42a2-8225-9b992a399a35 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026757579574 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026757579575 | 9f551e92-91b3-491c-a3b0-11b042e51d2f | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026757579575 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026757579576 | 13af4fa2-6f1a-4479-98f8-b58dbed14e26 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026757579576 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026757579577 | 3e64cffd-735e-433e-a8ea-483d2a1c1537 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026757579577 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026757579578 | aede17a4-e3dc-4e5f-9c47-47b71c576751 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026757579578 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026757579579 | c980b8c1-edcd-4678-901e-f463c46daf74 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026757579579 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026757579580 | f656f41a-1af8-4f0a-9c29-56b690f5f6a3 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026757579580 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026757579581 | 3fe5e963-d59b-4a62-9d7c-c52cedac2698 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026757579581 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026757579582 | 6479960a-800a-47dd-95b2-2526069c95c3 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026757579582 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026757579583 | d704f2e0-f1b5-4b19-a570-2d4177665876 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026757579583 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026757579584 | 3aa9cc85-7ae4-4090-9e1a-2ffb0c6f4d93 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026757579584 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026757579585 | 0f06067c-1dbf-484a-a321-a5aba4f5cd96 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026757579585 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026757579586 | 04dbc683-72b5-43f1-a6b9-c848f9d2bab3 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026757579586 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026757579587 | 22aacefd-d3a2-49f6-a131-9c866da17078 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026757579587 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026757579588 | 4b7a3600-078b-4482-94e8-f35c39d71fe9 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026757579588 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026757579589 | 1627aedf-9880-4a5b-a179-0c9a4adf15d2 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026757579589 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026757579590 | 2f356ae6-9d3f-4d9b-86ef-32a2ab157577 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026757579590 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026757579591 | 7d9972fc-23e5-4f76-b721-d61537471108 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026757579591 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026757579592 | 84f9b99b-6ad0-48e1-92ec-b6d74a644734 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026757579592 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026757579593 | d40154a3-f29b-4004-af1f-76edc2a17c97 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026757579593 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026757579594 | b882b540-9f02-42b7-9259-6ec1b6ae5c3e | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026757579594 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
