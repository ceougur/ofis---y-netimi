# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 02a6acd · başlangıç 22.10.2026 16:31:10 · bitiş 22.10.2026 16:31:14 (TR) · denetim 132/134 geçti · çıkış 1

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum kaldı (1 kalan) · yd-resmi-pdf kaldı (1 kalan) · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 4 (en çok eşzamanlı 4); SendSMM 20 (en çok eşzamanlı 6); sözleşme (WSDL) okuma 2
- ya-eszamanli-kayit: BULGU ADAYI (N4): 4 Login AYNI ANDA — programın giriş denetimi tek uçuş değil (oturum önbelleği boşken her istek kendi girişini yapar)
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":296,"medyan":478,"enCok":660} ms, Kes, Sonra Gönder {"en":124,"medyan":481,"enCok":654} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":5,"medyan":6,"enCok":12}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":1,"medyan":2,"enCok":20}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 4 (en çok eşzamanlı 4), SendSMM en çok eşzamanlı 6. Sahte EDM: zorla hayır, arıza durum.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-eba95d0c <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026474777241 | 5ee9cee2-a787-488c-9ca7-ad5927c3e9eb | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Hata | TES2026474777241 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026474777240 | 386ae7b4-b0f4-47bf-8d32-cd26c23ae6d5 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026474777240 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026474777243 | 2f73593e-8f45-43ca-9fac-7abf6a274c06 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026474777243 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026474777242 | beca8786-84b2-415e-b38e-e5c410bbe765 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026474777242 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026474777244 | f2ced5a7-aa10-48a4-8aaf-20deea17f3ab | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026474777244 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026474777245 | 75d97fb8-54d8-49e0-9fcf-3a2af87ac4e3 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026474777245 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026474777246 | c9301cc2-94a7-4da4-9863-040c6bf9500e | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026474777246 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026474777247 | c5d7b10d-6c64-497f-973e-2d2c855f3949 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026474777247 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026474777248 | a97ab401-2ab4-4140-a992-83774db6898b | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026474777248 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026474777249 | 1b0700cc-ddd8-4b34-97dc-ea3a487936a5 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026474777249 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026474777250 | 86db5753-a55d-487a-9a43-04cc302fd7d3 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026474777250 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026474777251 | 6e6a1af8-a361-45c4-9e6b-ab20d6a34e20 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026474777251 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026474777252 | 194c8a2c-3778-41ef-9bb4-1fcc549c0307 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026474777252 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026474777253 | 37b57bb8-3673-4c39-944e-30d97b8f7fb7 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026474777253 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026474777254 | 26091300-2d15-4130-bcc6-6fefd19d5f56 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026474777254 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026474777255 | 900bbb77-2752-4852-9a78-55a5e5c302a9 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026474777255 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026474777256 | 842d3a66-c968-49d0-a36d-c189cad41102 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026474777256 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026474777257 | 091a6484-ac67-4fdc-805e-93e776428f11 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026474777257 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026474777258 | 1190c747-99f2-4e14-9ee3-75ed895b94aa | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026474777258 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026474777259 | 0c5a3861-5580-4b90-b74c-7111d46bf943 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026474777259 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026474777260 | e77cd718-51a0-4ec9-86da-2ee8464c6493 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026474777260 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026474777261 | 52fc75c8-b453-4106-96f8-a14438ff28d3 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026474777261 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026474777262 | 827ebc14-e5fc-4267-94ba-ad8f741bbe54 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026474777262 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026474777263 | 83159a72-aa9a-4bb7-9b2e-ef72004cf2af | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026474777263 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026474777264 | bf042d68-9d9f-470f-bf28-b26b54697c36 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026474777264 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026474777265 | 56c4d4f9-8a92-453f-87f0-8d324fa06e14 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026474777265 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026474777266 | 498b302d-a7e9-48b1-841e-bc80d988efec | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026474777266 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026474777267 | 3192de2a-02f7-4fd2-baca-7dcbd110a371 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026474777267 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026474777268 | 6ab7d309-347c-4e97-9441-5a07badd382d | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026474777268 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026474777269 | 2569ac7d-590e-4c50-9498-e6714dc421cd | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026474777269 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
