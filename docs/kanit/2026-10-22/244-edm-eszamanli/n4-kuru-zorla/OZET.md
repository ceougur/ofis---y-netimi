# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 51c3074 · başlangıç 22.10.2026 16:58:32 · bitiş 22.10.2026 16:58:44 (TR) · denetim 136/136 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 1 (en çok eşzamanlı 1); SendSMM 20 (en çok eşzamanlı 20); sözleşme (WSDL) okuma 1
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":1007,"medyan":1305,"enCok":1605} ms, Kes, Sonra Gönder {"en":85,"medyan":167,"enCok":258} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- ya-eszamanli-kayit: ön koşul (zorla, soğuk): önbellek boşken aynı anda 20 SendSMM, sahte EDM'de en çok eşzamanlı Login 1
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":301,"medyan":604,"enCok":905}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":21,"medyan":23,"enCok":38}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 1 (en çok eşzamanlı 1), SendSMM en çok eşzamanlı 20. Sahte EDM: zorla evet, arıza yok.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-02e0d55c <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026731128821 | 65eccee3-a283-4b31-8418-a89bbb390f3a | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026731128821 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026731128822 | 7f8c144a-292a-482f-afbf-61d0d62ce9ac | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026731128822 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026731128823 | 3cac4b50-f8e3-4d62-9193-ac9163ccc386 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026731128823 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026731128824 | 126cd74d-99a2-4bee-bd03-b70a1314a9e8 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026731128824 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026731128825 | e771c83d-06c0-4e93-a8b3-2cb9ded78048 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026731128825 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026731128826 | bf3b7ff4-2f66-46b7-908e-55047fb6423e | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026731128826 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026731128827 | cd997943-724f-4236-aeaa-7e8c33a1dd05 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026731128827 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026731128828 | 424ef832-e883-47a0-8625-094d1a7bfa33 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026731128828 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026731128829 | e8b93af9-28fe-4649-afc0-7cdeaf5dbced | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026731128829 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026731128830 | 5fe83a01-49a8-44ab-aae3-70aecdd2f732 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026731128830 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026731128831 | c892799f-d5c2-49bd-afbd-45d1a0c273be | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026731128831 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026731128832 | 5fadf302-bb12-420b-8bec-14afa17ec3f0 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026731128832 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026731128833 | a99dfcc8-1b63-4116-a773-1230a16640b1 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026731128833 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026731128834 | 7b40f029-0bff-4400-9c78-0c81ea45b9f0 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026731128834 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026731128835 | 96571079-c858-4946-abfb-fd64dd8c3a47 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026731128835 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026731128836 | b8b436c6-4004-49ab-bb6c-fa864e2c3c68 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026731128836 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026731128837 | 09f20dc9-442f-495e-a42c-87619ea94b80 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026731128837 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026731128838 | fb23eb37-9500-45a9-aa4e-eed0ce6ff171 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026731128838 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026731128839 | db36a9e3-e451-4505-9375-324d48985a45 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026731128839 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026731128840 | a2d9425a-50af-4b26-8542-bd319e3d0383 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026731128840 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026731128841 | 4e9facbf-f18f-45bd-bc50-36ba00c14331 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026731128841 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026731128842 | 0c5189f8-3a76-4c65-af89-5d6bb1e75ac1 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026731128842 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026731128843 | 15d8ddc9-b63a-4d85-966e-757b33617fa2 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026731128843 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026731128844 | 60c47672-eb04-455d-b3f7-753d8fc65cca | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026731128844 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026731128845 | 9de4413b-fb51-47ff-87c6-fc67f4ce47db | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026731128845 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026731128846 | 32c6b133-3222-43a2-a210-472e2bc6c87b | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026731128846 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026731128847 | 92202382-d774-4214-9f60-634a28ff2382 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026731128847 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026731128848 | 620f2cb4-4247-45a0-95a8-db2f5ad1b449 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026731128848 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026731128849 | a6d8ee96-2dd1-4b4b-bfab-6a183ad40c8a | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026731128849 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026731128850 | d00c392d-dc5c-4da0-ab81-82fa295a815c | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026731128850 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
