# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 51c3074 · başlangıç 22.10.2026 16:58:57 · bitiş 22.10.2026 16:59:09 (TR) · denetim 136/136 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 1 (en çok eşzamanlı 1); SendSMM 20 (en çok eşzamanlı 20); sözleşme (WSDL) okuma 1
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":1070,"medyan":1371,"enCok":1678} ms, Kes, Sonra Gönder {"en":90,"medyan":185,"enCok":281} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- ya-eszamanli-kayit: ön koşul (zorla, soğuk): önbellek boşken aynı anda 20 SendSMM, sahte EDM'de en çok eşzamanlı Login 1
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":303,"medyan":604,"enCok":907}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":21,"medyan":23,"enCok":41}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 1 (en çok eşzamanlı 1), SendSMM en çok eşzamanlı 20. Sahte EDM: zorla evet, arıza tek-oturum.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-fe4ba10b <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026814695130 | ef8e1cd7-1636-4c4d-b894-fb987f4312ee | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026814695130 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026814695131 | 29973a35-5444-4f17-80f2-e88ef2e93e30 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026814695131 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026814695132 | fb464ee1-858a-4589-8990-a166d1897809 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026814695132 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026814695133 | b0ad1339-b389-477a-a3c1-5418691faabd | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026814695133 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026814695134 | 8f9c822f-53c4-48ec-a26b-679d3151d793 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026814695134 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026814695135 | 5369b0a4-f900-4dac-aed7-618533d4a288 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026814695135 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026814695136 | bb2d6dd0-5def-48d0-ae19-d7846a5d1da9 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026814695136 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026814695137 | 75284f65-fe68-4547-a58d-85f2a0407284 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026814695137 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026814695138 | 65acefcd-26ee-4bd1-a9f1-ec2ca46a9884 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026814695138 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026814695139 | 25037d78-a0de-4195-8573-d73e203a1c72 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026814695139 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026814695140 | 8a1b8149-7ede-4712-b75c-8a5ae93af3ac | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026814695140 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026814695141 | f72665e8-57fd-4de1-aae9-107018f1eb7e | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026814695141 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026814695142 | 262ab2f8-3ca0-413d-9e24-613c29d42ee0 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026814695142 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026814695143 | 6cad802d-4b0c-4a8a-bead-23cf8dabab00 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026814695143 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026814695144 | 1118b61a-eb96-41ab-b8b2-fee8d4202306 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026814695144 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026814695145 | 3f96be0b-c63e-4be8-bb9e-d3c0061f34ec | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026814695145 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026814695146 | 9d8f4050-998b-435b-9b37-480fd2d85b83 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026814695146 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026814695147 | 404334ac-785f-4144-a092-c2b892de0fab | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026814695147 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026814695148 | 2e9e0b71-678d-41f9-bf3c-ce92b86235cd | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026814695148 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026814695149 | 70f5a332-7517-401e-8f8d-37a97cda74dc | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026814695149 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026814695150 | 0f3ee693-dbe0-45e6-a4de-e32137536de9 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026814695150 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026814695151 | 431e7528-45b9-41f4-8416-9cd1cb1ed5d7 | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026814695151 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026814695152 | ca52b31a-db40-4a0a-843b-b2d1a248aac6 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026814695152 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026814695153 | 6723cdf2-a744-42d7-a565-c7aa4b5ab15a | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026814695153 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026814695154 | 343e0ff6-7ab5-4e24-bc96-8722bbddaa1d | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026814695154 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026814695155 | c942a632-8738-4fb1-8bd8-de797448d5a3 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026814695155 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026814695156 | fbe6b99d-604a-46e9-8169-b8f7914a70b9 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026814695156 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026814695157 | 20010f62-aa9c-4e22-834b-e528c6e69bcd | 22.10.2026 | 16:58 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026814695157 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026814695158 | 8f28ed65-ddd6-422c-8eab-516d43230e18 | 22.10.2026 | 16:58 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026814695158 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026814695159 | 87903c82-b640-4984-9ce2-9991cdfed9e0 | 22.10.2026 | 16:58 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026814695159 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
