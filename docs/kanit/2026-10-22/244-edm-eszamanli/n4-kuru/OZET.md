# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 51c3074 · başlangıç 22.10.2026 16:58:27 · bitiş 22.10.2026 16:58:32 (TR) · denetim 135/135 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 1 (en çok eşzamanlı 1); SendSMM 20 (en çok eşzamanlı 4); sözleşme (WSDL) okuma 1
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":185,"medyan":451,"enCok":691} ms, Kes, Sonra Gönder {"en":77,"medyan":456,"enCok":690} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":5,"medyan":6,"enCok":13}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":1,"medyan":2,"enCok":22}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 1 (en çok eşzamanlı 1), SendSMM en çok eşzamanlı 4. Sahte EDM: zorla hayır, arıza yok.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-0b8d30f4 <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026346382673 | e395724b-0adc-43ba-9fe4-a02182087554 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026346382673 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026346382674 | 89015c11-7a99-491c-a33f-644012c773a3 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026346382674 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026346382675 | 3f6c4312-d1b5-4570-b286-171e3a8625be | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026346382675 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026346382676 | 711ad521-9c34-45fe-bd6f-0cfea9124390 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026346382676 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026346382677 | 04c681ab-b61b-4a15-af82-23fad3dbfb9a | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026346382677 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026346382678 | f7a82eea-c049-430e-a979-c3631de2d136 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026346382678 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026346382679 | 21ee15e9-5ff8-461b-b978-1c4705b9703e | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026346382679 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026346382680 | e7e5f416-a4ee-40a4-beb7-ad41c4fc5722 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026346382680 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026346382681 | a70fbf8f-fc6e-46a4-965f-4930a9d04152 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026346382681 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026346382682 | 2e27f070-200d-4162-8bd4-4832866d65ee | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026346382682 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026346382683 | d2e28061-6460-420b-bd2f-b27ae560389a | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026346382683 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026346382684 | 2119cecd-383a-40eb-9d4f-449bf113894e | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026346382684 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026346382685 | ac2b52d5-295f-4fbd-a9d4-0d7afca6ab2c | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026346382685 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026346382686 | 6dc98534-bd86-4cbe-aeb4-dc3a65d1b4ee | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026346382686 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026346382687 | 1b645505-6006-4554-bc47-fd58affb0818 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026346382687 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026346382688 | f2626eb6-fb72-44de-8137-9dbd21fd7fbd | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026346382688 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026346382689 | d7f57d6c-24d1-4b9a-9569-effdadfe3bee | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026346382689 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026346382690 | 5215b6f9-401c-4038-b3f0-51ad8d63c58e | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026346382690 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026346382691 | 3e4275db-d099-454a-839c-8dbaa6ea1c8b | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026346382691 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026346382692 | 7a22b836-d29c-4a44-a173-3af23faf11bf | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026346382692 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026346382693 | 97d117a2-8a8c-4021-82f7-290b2c9b98c8 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026346382693 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026346382694 | 19ed9203-3e86-4a5d-90c8-2f721a73adfc | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026346382694 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026346382695 | 3a39d59a-83ac-40a8-b315-892954ea101e | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026346382695 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026346382696 | d7fec1dd-5796-4877-88d4-3294952c26e8 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026346382696 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026346382697 | 445b4038-bc63-4eb3-b1cc-3f2f9ae89c29 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026346382697 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026346382698 | 02a87702-a767-41b1-9c0f-207218e55137 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026346382698 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026346382699 | 080fece2-6883-4608-9470-5c85ade8ff8a | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026346382699 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026346382700 | 951fb48a-ea6d-4a08-b171-6d28e9d02c38 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026346382700 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026346382701 | b810436c-618d-49ad-8fc4-b8fd48141727 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026346382701 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026346382702 | eb09289f-e874-4a29-b59c-de1cf797d148 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026346382702 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
