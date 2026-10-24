# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit 9708b4a · başlangıç 23.10.2026 06:26:43 · bitiş 23.10.2026 06:28:27 (TR) · denetim 52/52 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum geçti · d-resmi-pdf geçti · e-iptal geçti · f-bulunamadi geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- d-resmi-pdf: B1 TES2026295644875: resmî PDF'te düzenleyenin unvanı (DENEME TICARET LTD. STI.) YOK — e-SMM, VKN'li düzenleyen: EDM test ortamı şablonu unvanı basmaz (EDM yanıtı 22.10.2026); denetim değil
- d-resmi-pdf: B2 TES2026295644876: resmî PDF'te düzenleyenin unvanı (DENEME TICARET LTD. STI.) YOK — e-SMM, VKN'li düzenleyen: EDM test ortamı şablonu unvanı basmaz (EDM yanıtı 22.10.2026); denetim değil
- d-resmi-pdf: G1 TES2026295644872: resmî PDF'te düzenleyenin unvanı (DENEME TICARET LTD. STI.) YOK — e-SMM, VKN'li düzenleyen: EDM test ortamı şablonu unvanı basmaz (EDM yanıtı 22.10.2026); denetim değil

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026295644872 | 6cd4a435-74a7-4946-9f3a-0737deb7eaaa | 21.10.2026 | 23.10.2026 06:26:51 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Kabul (iletildi) | — |
| G2 | e-SMM | TES2026295644873 | 73433d29-7bfe-4154-bf4a-df63b7455ad0 | 22.10.2026 | 23.10.2026 06:26:56 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Kabul (iletildi) | — |
| G3 | e-Arşiv | TEA2026426940706 | 8f058d8d-ea69-4548-8590-e471c42647c5 | 21.10.2026 | 23.10.2026 06:26:54 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026426940707 | f29cb89a-b306-400e-937e-ebf57e7e61f5 | 22.10.2026 | 23.10.2026 06:27:00 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026295644874 | 076c2f2b-6311-4817-b01d-7df46c6ccf52 | 22.10.2026 | 23.10.2026 06:27:02 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Kabul (iletildi) | — |
| B1 | e-SMM | TES2026295644875 | 48b2bc22-26fb-4d2f-b62f-3c01da08566e | 23.10.2026 | 23.10.2026 06:27:04 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İptal Edildi | 23.10.2026 06:28:24 |
| B2 | e-SMM | TES2026295644876 | b62ff951-7a65-4786-93ce-1c29d2f1c7f8 | 23.10.2026 | 23.10.2026 06:27:06 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 38, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
