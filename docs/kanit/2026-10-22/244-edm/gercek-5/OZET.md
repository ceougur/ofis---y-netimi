# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit 32e59c0 · başlangıç 22.10.2026 13:41:33 · bitiş 22.10.2026 13:42:44 (TR) · denetim 55/55 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum geçti · d-resmi-pdf geçti · e-iptal geçti · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026155510665 | a59508d1-2311-4f12-825a-730f65e881b3 | 20.10.2026 | 22.10.2026 13:41:40 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Kabul (iletildi) | — |
| G2 | e-SMM | TES2026155510666 | 7b5beee5-f19f-4ad1-ae96-8afef6460bc8 | 21.10.2026 | 22.10.2026 13:41:45 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Kabul (iletildi) | — |
| G3 | e-Arşiv | TEA2026778201412 | 4924647a-7d3a-4045-b4c8-7d4f4c189b57 | 20.10.2026 | 22.10.2026 13:41:43 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026778201413 | 5f709034-4584-430e-bbab-6511f000ac08 | 21.10.2026 | 22.10.2026 13:41:48 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026155510667 | 99b6f5b3-b7f6-4151-8704-1eef41365f4c | 21.10.2026 | 22.10.2026 13:41:50 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Kabul (iletildi) | — |
| B1 | e-SMM | TES2026155510668 | e1dc872c-e382-40a6-b9b2-8f721037d200 | 22.10.2026 | 22.10.2026 13:41:52 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İptal Edildi | 22.10.2026 13:42:41 |
| B2 | e-SMM | TES2026155510669 | 100406cd-ab1a-4119-af87-0067d6a796bd | 22.10.2026 | 22.10.2026 13:41:54 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 39, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
