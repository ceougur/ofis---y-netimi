# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit b4f8709 · başlangıç 22.10.2026 17:07:20 · bitiş 22.10.2026 17:09:15 (TR) · denetim 136/136 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 1 (en çok eşzamanlı 1); SendSMM 20 (en çok eşzamanlı 20); sözleşme (WSDL) okuma 1
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":4322,"medyan":6745,"enCok":8095} ms, Kes, Sonra Gönder {"en":77,"medyan":208,"enCok":273} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":1866,"medyan":1962,"enCok":2044}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":546,"medyan":589,"enCok":753}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 1 (en çok eşzamanlı 1), SendSMM en çok eşzamanlı 20.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-9399cd9d <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026475826020 | e4872545-800d-4802-99ab-d7aefff7af1b | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026475826020 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026475826021 | 4618fa31-4e85-491d-84cc-f9e6bc9d80f0 | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026475826021 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026475826022 | 2b668fff-72d1-419b-b671-66b8c6e70127 | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026475826022 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026475826023 | 47bcf5e7-e4b1-42a2-a4a0-0b53b8b65acf | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026475826023 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026475826024 | b6e69e72-0933-4895-834c-1f2f648d5fab | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026475826024 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026475826025 | 7f56dd9e-c311-4935-90c0-bae6d9cab7c8 | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026475826025 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026475826026 | 8021fe95-7271-4142-868a-93d688202fb9 | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026475826026 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026475826027 | 0af22184-6a37-459e-81e0-f8b2840c05bc | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026475826027 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026475826028 | c5b42f0f-8143-41c5-890d-b390a4d692f7 | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026475826028 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026475826029 | 838b12de-2241-4930-b37e-904608ea8fcc | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026475826029 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026475826030 | 812078a5-20eb-4e4f-b6d1-672a696c115a | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026475826030 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026475826031 | 58fd3668-c3af-47b6-9314-4a39fbdf16e3 | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026475826031 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026475826032 | 5bc86ace-9281-40fa-b7f2-b78e58fdd6bd | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026475826032 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026475826033 | bdf5525c-a732-4cd8-b596-56529df838f3 | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026475826033 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026475826034 | cc64d921-fa98-429b-b053-7da8bf253d9a | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026475826034 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026475826035 | b5db3a72-cb89-463a-9bec-9f4583f1562e | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026475826035 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026475826036 | c56a9811-3e0e-4bda-86fa-bc981bc0187b | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026475826036 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026475826037 | 7f73a179-6cff-4a46-b9df-c6135c692c6f | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026475826037 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026475826038 | 5a3dd45a-7cb3-48e7-9d9d-4e0cdfcbd74f | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026475826038 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026475826039 | 921e53cd-6926-45df-b4c5-abbfd0659268 | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026475826039 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026475826040 | 53fb70a0-4af8-412c-a712-2087f7aad5c9 | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026475826040 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026475826041 | 10812f0b-4807-4beb-aea8-421f16ebb37c | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026475826041 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026475826042 | 0e0e50b9-f343-49b8-9bd9-e4261a60e71c | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026475826042 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026475826043 | 2b90acbd-1244-40cd-b9ff-172250a4f03f | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026475826043 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026475826044 | c343118e-819d-4377-a79e-9901d0f7ef83 | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026475826044 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026475826045 | 256a534c-614b-4861-9e1c-65625042793a | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026475826045 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026475826046 | ca260bd7-6ad6-47a2-af3e-1cd754ef6a64 | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026475826046 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026475826047 | 1c8b7d43-daeb-4e9b-ae79-5f52361ec0ee | 22.10.2026 | 17:07 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026475826047 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026475826048 | 1e7a7a52-491c-400b-b2b0-12a1e83a13a6 | 22.10.2026 | 17:07 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026475826048 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026475826049 | e30d902a-a67d-4319-bd29-5e7cb55eb1e5 | 22.10.2026 | 17:07 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026475826049 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 152, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
