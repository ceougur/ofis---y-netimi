# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 02a6acd · başlangıç 22.10.2026 16:31:02 · bitiş 22.10.2026 16:31:06 (TR) · denetim 129/134 geçti · çıkış 1

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder kaldı (1 kalan) · yc-durum kaldı (1 kalan) · yd-resmi-pdf kaldı (1 kalan) · ye-edm-okuyucu kaldı (2 kalan) · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 4 (en çok eşzamanlı 4); SendSMM 20 (en çok eşzamanlı 6); sözleşme (WSDL) okuma 2
- ya-eszamanli-kayit: BULGU ADAYI (N4): 4 Login AYNI ANDA — programın giriş denetimi tek uçuş değil (oturum önbelleği boşken her istek kendi girişini yapar)
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":255,"medyan":445,"enCok":674} ms, Kes, Sonra Gönder {"en":88,"medyan":449,"enCok":672} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":5,"medyan":7,"enCok":16}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":1,"medyan":1,"enCok":27}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 4 (en çok eşzamanlı 4), SendSMM en çok eşzamanlı 6. Sahte EDM: zorla hayır, arıza kayip.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-f0ab433c <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026814147978 | 8bcbb43f-35e1-4199-b8dd-4825e287a7db | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | EDM'de YOK |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026814147977 | 0c67cdc1-79ab-497c-97be-dc1f0d9e8b02 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026814147977 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026814147980 | 43d6d31f-713d-4542-a722-38bec2f48a7c | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026814147980 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026814147979 | 57b0e69f-afe1-4174-829d-b012a37f581a | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026814147979 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026814147981 | e5286fd4-95ba-41f7-b26e-a9ae0e114034 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026814147981 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026814147982 | c069f020-2ef2-4acc-a554-f237a3ce49d9 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026814147982 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026814147983 | b789bf9c-e509-4d0d-aaf2-e5e699722fb5 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026814147983 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026814147984 | 5f35fdf6-b870-42b4-af83-33baa65b7a3b | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026814147984 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026814147985 | c7eded35-6d2e-4836-ade0-4333cf38bc2d | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026814147985 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026814147986 | 69c705a5-9830-43e7-bbca-0796f8228da7 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026814147986 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026814147987 | bd74bd49-5f31-48d4-bdec-c1178f5377ff | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026814147987 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026814147988 | 4a03905b-64b6-4f28-8f61-4931b7de0b7c | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026814147988 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026814147989 | 9bd6357d-801b-46d8-87b8-09ddc1cdb6a4 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026814147989 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026814147990 | d4f6a139-c755-4c31-90f9-8bbacb678530 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026814147990 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026814147991 | 55848929-9afb-4f87-9d57-6469d7453603 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026814147991 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026814147992 | 563f3246-e2c2-48bc-90df-fa4dad21a092 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026814147992 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026814147993 | ec6d23a0-6a4a-4773-b8d9-e7dcc74f2691 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026814147993 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026814147994 | 5e0d5cc3-561c-400d-8f03-0ba0ae4b2540 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026814147994 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026814147995 | 2a4aea49-f885-4238-a034-2129215797a4 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026814147995 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026814147996 | 8abefc72-64f5-4d9b-bd61-360bc6728f53 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026814147996 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026814147997 | c810fc79-1428-4bb5-bfad-7046a691a6b2 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026814147997 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026814147998 | 65566017-96fb-4232-b123-b5d9b7065cc6 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026814147998 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026814147999 | 5ef1239d-8d5e-4407-b8a9-cdda1b8fd4d0 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026814147999 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026814148000 | b32cd158-5770-4615-88c2-af8703c4b2ff | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026814148000 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026814148001 | 2fd7b7f8-0f94-45b5-91b7-eed97924d324 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026814148001 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026814148002 | c2ce25c5-d997-47b0-8e9b-812e0bf8e1af | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026814148002 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026814148003 | b7b927b6-c5d0-41a7-aa34-157ce79eb065 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026814148003 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026814148004 | 734d5911-a16f-4798-ae39-60881b4cf8c0 | 22.10.2026 | 16:31 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026814148004 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026814148005 | f284b128-7531-492c-88f8-e39e96a4fa87 | 22.10.2026 | 16:31 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026814148005 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026814148006 | 6df33c25-8dc7-4743-a2ca-f14e2255e6f1 | 22.10.2026 | 16:31 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026814148006 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
