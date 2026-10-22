# EDM Test Ortamı — eşzamanlı e-SMM (2.4.4 iş listesi 24b) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit 02a6acd · başlangıç 22.10.2026 16:30:50 · bitiş 22.10.2026 16:31:02 (TR) · denetim 136/136 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · hazirlik-kullanicilar geçti · ya-eszamanli-kayit geçti · yb-tumunu-gonder geçti · yc-durum geçti · yd-resmi-pdf geçti · ye-edm-okuyucu geçti · yf-degismezler geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- ya-eszamanli-kayit: soğuk başlangıç: programın EDM oturum ve sözleşme önbelleği boşaltıldı (sabah ilk gönderim / program yeniden açıldı); her istek kendi girişini dener
- ya-eszamanli-kayit: EDM e-SMM servisine Login: 20 (en çok eşzamanlı 20); SendSMM 20 (en çok eşzamanlı 20); sözleşme (WSDL) okuma 2
- ya-eszamanli-kayit: BULGU ADAYI (N4): 20 Login AYNI ANDA — programın giriş denetimi tek uçuş değil (oturum önbelleği boşken her istek kendi girişini yapar)
- ya-eszamanli-kayit: süreler: Kaydet ve Gönder {"en":798,"medyan":1246,"enCok":1571} ms, Kes, Sonra Gönder {"en":79,"medyan":169,"enCok":264} ms; 30 sn'yi aşan Kaydet ve Gönder 0 (arayüzün kayıt zaman aşımı 30 sn: aşanlarda ekran "sunucuda sürüyor olabilir" derdi)
- yb-tumunu-gonder: iki oturumun sonuçları: {"fatura1 gönderdi":10,"fatura2 başka oturumda gönderildi":10}; yeniden basış 0 (arayüz iletisi "kalan belge olursa Tümünü Gönder'e yeniden basın")
- yb-tumunu-gonder: EDM: {"smm:SendSMM":{"sayi":10,"hata":0,"enCokEszamanli":1,"sureMs":{"en":304,"medyan":605,"enCok":904}},"smm:GetSMMStatus":{"sayi":20,"hata":0,"enCokEszamanli":1,"sureMs":{"en":21,"medyan":22,"enCok":47}}}
- ye-edm-okuyucu: okuyucu GetSMM biçimi: HEADER_ONLY Y
- yf-degismezler: aynı gün içinde saat ↔ numara ters komşu çifti: 0 (eşzamanlı kayıtta numara kayıt işleminin sırasıyla verilir, saat formun açıldığı/kaydın başladığı anı taşır; GİB sıra kuralı tarih düzeyindedir — denetim değil)

Eşzamanlılık: 20 Kaydet ve Gönder + 10 Kes, Sonra Gönder AYNI ANDA, 3 kullanıcı oturumundan (yönetici, fatura1, fatura2); B'yi fatura1 ve fatura2 AYNI ANDA Tümünü Gönder ile gönderdi. Soğuk başlangıç (programın EDM oturum önbelleği boştu). e-SMM servisine Login 20 (en çok eşzamanlı 20), SendSMM en çok eşzamanlı 20. Sahte EDM: zorla evet, arıza yok.

Belgeler İPTAL EDİLMEDİ. Portalda Not alanında "Eşzamanlı deneme ESZ-dae061ef <kod>" yazar. Alıcılar test alıcısıdır (VKN'li iki şirket, TCKN'li kişi 10000000146), gerçek kişi değildir.

| Kod | Aşama | Oturum | Belge No | ETTN / UUID | Belge Tarihi | Saat | Alıcı Türü | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | EDM'deki No (Bağımsız Okuyucu) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| A01 | A Kaydet ve Gönder | yonetici | TES2026710723643 | 23687220-c59e-4e65-b06c-2292f221a803 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | Kabul (iletildi) | TES2026710723643 |
| A02 | A Kaydet ve Gönder | fatura1 | TES2026710723642 | dc8e8212-32eb-433b-9f6a-5c8668464a99 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 2.500,50 | 500,10 | 500,10 | 2.500,50 | Kabul (iletildi) | TES2026710723642 |
| A03 | A Kaydet ve Gönder | fatura2 | TES2026710723645 | f12e1a75-e893-4f80-9c14-d33841cc9058 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 333,33 | 0,00 | 66,67 | 400,00 | Kabul (iletildi) | TES2026710723645 |
| A04 | A Kaydet ve Gönder | yonetici | TES2026710723644 | fc5f3021-85b0-4644-afd5-dea14ac0fe27 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | TES2026710723644 |
| A05 | A Kaydet ve Gönder | fatura1 | TES2026710723646 | e67f9b6e-0425-49c2-8188-52e811c1d85b | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.234,56 | 246,91 | 246,91 | 1.234,56 | Kabul (iletildi) | TES2026710723646 |
| A06 | A Kaydet ve Gönder | fatura2 | TES2026710723647 | 9b4b8048-f253-44f3-8166-a69c9b0816db | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 750,00 | 0,00 | 150,00 | 900,00 | Kabul (iletildi) | TES2026710723647 |
| A07 | A Kaydet ve Gönder | yonetici | TES2026710723648 | 92043680-0839-4e9d-9f02-6d75047e679d | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 99,99 | 20,00 | 20,00 | 99,99 | Kabul (iletildi) | TES2026710723648 |
| A08 | A Kaydet ve Gönder | fatura1 | TES2026710723649 | 52e59944-162f-46f3-b6d5-fbee6ba4f5e2 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 4.200,10 | 840,02 | 840,02 | 4.200,10 | Kabul (iletildi) | TES2026710723649 |
| A09 | A Kaydet ve Gönder | fatura2 | TES2026710723650 | ccf41baf-e1c0-47e9-8ae8-c0a992dcff57 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 15.000,00 | 0,00 | 3.000,00 | 18.000,00 | Kabul (iletildi) | TES2026710723650 |
| A10 | A Kaydet ve Gönder | yonetici | TES2026710723651 | 5c7e05a0-970f-4c02-bcac-76b20918d60e | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 812,47 | 162,49 | 162,49 | 812,47 | Kabul (iletildi) | TES2026710723651 |
| A11 | A Kaydet ve Gönder | fatura1 | TES2026710723652 | 89ead80e-eb95-497d-99f3-9d7423014e27 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 100,00 | 20,00 | 20,00 | 100,00 | Kabul (iletildi) | TES2026710723652 |
| A12 | A Kaydet ve Gönder | fatura2 | TES2026710723653 | f260ea71-6a32-4c70-8f81-d5f04411c25a | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 2.999,99 | 0,00 | 600,00 | 3.599,99 | Kabul (iletildi) | TES2026710723653 |
| A13 | A Kaydet ve Gönder | yonetici | TES2026710723654 | 6e405f28-c545-4a2b-b196-9720f537c3a3 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 5.000,05 | 1.000,01 | 1.000,01 | 5.000,05 | Kabul (iletildi) | TES2026710723654 |
| A14 | A Kaydet ve Gönder | fatura1 | TES2026710723655 | 197cc3f8-d925-4663-a60c-3af99f9fa789 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 455,45 | 91,09 | 91,09 | 455,45 | Kabul (iletildi) | TES2026710723655 |
| A15 | A Kaydet ve Gönder | fatura2 | TES2026710723656 | d76c4cf5-a8b6-4919-b60d-1e2517b8a510 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 120,00 | 0,00 | 24,00 | 144,00 | Kabul (iletildi) | TES2026710723656 |
| A16 | A Kaydet ve Gönder | yonetici | TES2026710723657 | e2b42841-e1e0-49e1-bd37-7c216ffd0e7d | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 7.777,77 | 1.555,55 | 1.555,55 | 7.777,77 | Kabul (iletildi) | TES2026710723657 |
| A17 | A Kaydet ve Gönder | fatura1 | TES2026710723658 | d7588d8f-f4cd-49a7-a33b-4c772654ec69 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 300,30 | 60,06 | 60,06 | 300,30 | Kabul (iletildi) | TES2026710723658 |
| A18 | A Kaydet ve Gönder | fatura2 | TES2026710723659 | 27bfb3b4-0a58-4884-a18c-1ed8283dc0f9 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 641,00 | 0,00 | 128,20 | 769,20 | Kabul (iletildi) | TES2026710723659 |
| A19 | A Kaydet ve Gönder | yonetici | TES2026710723660 | 988f1663-6102-45a8-ae72-86e6511884c9 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 18,18 | 3,64 | 3,64 | 18,18 | Kabul (iletildi) | TES2026710723660 |
| A20 | A Kaydet ve Gönder | fatura1 | TES2026710723661 | 09c4dc8c-5fe1-489f-8946-7a37954ba487 | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 1.999,95 | 399,99 | 399,99 | 1.999,95 | Kabul (iletildi) | TES2026710723661 |
| B01 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026710723662 | 5f724383-2d8e-4590-b34d-08ee420b1bb1 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 450,00 | 0,00 | 90,00 | 540,00 | Kabul (iletildi) | TES2026710723662 |
| B02 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026710723663 | 46769e9d-4c42-49de-8a85-5805ab7cea6b | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 1.250,75 | 250,15 | 250,15 | 1.250,75 | Kabul (iletildi) | TES2026710723663 |
| B03 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026710723664 | 4e464630-882a-4b74-a1d6-e1c37731aafe | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 88,88 | 17,78 | 17,78 | 88,88 | Kabul (iletildi) | TES2026710723664 |
| B04 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026710723665 | 2703e334-358c-45b9-a900-3c932193f704 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 1.000,00 | 0,00 | 200,00 | 1.200,00 | Kabul (iletildi) | TES2026710723665 |
| B05 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026710723666 | 288a9769-bfd4-4e09-9029-dec674f00757 | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 3.333,33 | 666,67 | 666,67 | 3.333,33 | Kabul (iletildi) | TES2026710723666 |
| B06 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026710723667 | 6d2a1384-3191-4f20-b497-0e51261df59a | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 66,67 | 13,33 | 13,33 | 66,67 | Kabul (iletildi) | TES2026710723667 |
| B07 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026710723668 | 4528c2ec-80ce-4993-ac18-c8ce965087b4 | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 9.999,99 | 0,00 | 2.000,00 | 11.999,99 | Kabul (iletildi) | TES2026710723668 |
| B08 | B Kes, Sonra Gönder → Tümünü Gönder | fatura2 | TES2026710723669 | 0490ea78-734f-40af-b705-bf687296fb1a | 22.10.2026 | 16:30 | VKN | Deneme Müvekkil Danışmanlık A.Ş. | 205,05 | 41,01 | 41,01 | 205,05 | Kabul (iletildi) | TES2026710723669 |
| B09 | B Kes, Sonra Gönder → Tümünü Gönder | yonetici | TES2026710723670 | b7d5ef92-0560-4db3-8373-b1de9dc43d8f | 22.10.2026 | 16:30 | VKN | Deneme Hukuk Danışmanlık Ltd. Şti. | 710,00 | 142,00 | 142,00 | 710,00 | Kabul (iletildi) | TES2026710723670 |
| B10 | B Kes, Sonra Gönder → Tümünü Gönder | fatura1 | TES2026710723671 | 025bcc69-f11a-4e59-957a-e6e720e59ade | 22.10.2026 | 16:30 | TCKN | Ahmet Yılmaz | 1.010,00 | 0,00 | 202,00 | 1.212,00 | Kabul (iletildi) | TES2026710723671 |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
