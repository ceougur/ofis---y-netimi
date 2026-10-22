# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit 0289fe3 · başlangıç 22.10.2026 16:41:11 · bitiş 22.10.2026 16:41:25 (TR) · denetim 45/46 geçti · çıkış 2 · DURDU: eşzamanlı istekte 1 belgede EDM girişi reddedildi (A03): betik durdu, Tümünü Gönder / Durum Sorgula yapılmadı (hesap kilitlenmesin)

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit kaldı (1 kalan)

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 20 (en çok eşzamanlı 18); SendSMM 19 (en çok eşzamanlı 18); sözleşme (WSDL) okuma 20
- ya-eszamanli-kayit: BULGU ADAYI (N4): 18 Login AYNI ANDA — programın giriş denetimi tek uçuş değil (oturum önbelleği boşken her istek kendi girişini yapar)
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":1810,"medyan":6193,"enCok":7877} ms, Kes, Sonra Gönder {"en":89,"medyan":208,"enCok":292} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 20 (en çok eşzamanlı 18), SendSMM en çok eşzamanlı 18.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-7fc6557a <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026412701048 | a5c3d69c-4591-4a9c-9ed9-f8412cd1cfe6 | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | sorulmadı |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026412701051 | 6bf925f5-7834-47d8-9af3-6455d0741137 | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | sorulmadı |
| A03 | A Kaydet ve Gönder | fatura2 | — | aa09bad7-0f6f-4811-affb-efd0a2436a5c | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Gönderilmedi | sorulmadı |
| A04 | A Kaydet ve Gönder | yonetici | TES2026412701054 | 013e1ae8-1e29-4cd2-be30-26949c110069 | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | sorulmadı |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026412701050 | 6cc8a201-5ec1-40c5-8721-46617ea3e37e | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | sorulmadı |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026412701053 | ac02ffed-a13c-48da-bc13-df49ebd99c75 | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | sorulmadı |
| A07 | A Kaydet ve Gönder | yonetici | TES2026412701049 | 5875d101-f3c0-4b80-b2f2-b6125e42c867 | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | sorulmadı |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026412701056 | e123cf1e-8ecc-43b9-902c-6058206dcdf5 | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | sorulmadı |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026412701055 | 6ad91b2b-8f69-4474-a541-943d1dfe20ff | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | sorulmadı |
| A10 | A Kaydet ve Gönder | yonetici | TES2026412701059 | 639db922-5473-432b-b952-1807faa345d4 | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | sorulmadı |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026412701052 | e7da635a-5f4d-4824-898b-6bcef7a989e9 | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | sorulmadı |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026412701066 | e80acbde-5a41-4e8d-b3c4-5cbfc3d0188c | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | sorulmadı |
| A13 | A Kaydet ve Gönder | yonetici | TES2026412701058 | 3a52dd06-4841-4674-90d1-d6ac2dfb4921 | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | sorulmadı |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026412701064 | 630fc589-c11b-420f-b256-6a1056a8ecd4 | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | sorulmadı |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026412701061 | 815b844f-e7dc-459e-b1a8-dd3332f2c2bf | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | sorulmadı |
| A16 | A Kaydet ve Gönder | yonetici | TES2026412701057 | 5375d00f-7f0b-43a3-b414-0a07db274129 | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | sorulmadı |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026412701062 | e2d2b8e7-b5bf-42e9-afe3-1daccb4ab39c | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | sorulmadı |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026412701063 | bf1b50ed-931a-4faf-8a6a-19532c244473 | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | sorulmadı |
| A19 | A Kaydet ve Gönder | yonetici | TES2026412701060 | ed72c0c3-a66b-4fd6-a3b9-108d26b8fe18 | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | sorulmadı |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026412701065 | 30b9f4de-3737-41d9-9ecb-b218d20c40c8 | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | sorulmadı |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | — | 416a4522-5fa0-49f0-a3ea-efac8911341f | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Gönderilmedi | sorulmadı |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | — | e830110c-162a-4266-87e5-fc1cfec281ec | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Gönderilmedi | sorulmadı |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | — | d70c67c0-dfba-45f8-a10a-425b5de045a1 | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Gönderilmedi | sorulmadı |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | — | c1de9eb0-98f7-4980-bb13-2b8c8f3bfe67 | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Gönderilmedi | sorulmadı |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | — | f3aa92c3-325e-41ec-9401-54d91d3421a3 | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Gönderilmedi | sorulmadı |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | — | 429e7140-bba6-4b37-9a9f-9dcd61410986 | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Gönderilmedi | sorulmadı |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | — | 9966c7f7-1494-4eb1-b74e-0db370201d8b | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Gönderilmedi | sorulmadı |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | — | 2004c127-0b1a-4558-95ea-4b0a7f654ea4 | 22.10.2026 | 16:41 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Gönderilmedi | sorulmadı |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | — | 69b25525-5283-4f15-84cf-75c7f2e59bd1 | 22.10.2026 | 16:41 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Gönderilmedi | sorulmadı |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | — | 3f0aed5c-ce90-440f-9fe6-36af2d100e91 | 22.10.2026 | 16:41 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Gönderilmedi | sorulmadı |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 65, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
