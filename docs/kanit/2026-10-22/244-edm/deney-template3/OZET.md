# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit ffa9067 · başlangıç 22.10.2026 14:48:19 · bitiş 22.10.2026 14:50:03 (TR) · denetim 55/55 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum geçti · d-resmi-pdf geçti · e-iptal geçti · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026807199676 | 2cce5db0-3b23-44d8-b545-3206bfb44ccb | 20.10.2026 | 22.10.2026 14:48:26 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Kabul (iletildi) | — |
| G2 | e-SMM | TES2026807199677 | cb0b1661-9cf0-4f76-886d-07efa7f15c65 | 21.10.2026 | 22.10.2026 14:48:31 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Kabul (iletildi) | — |
| G3 | e-Arşiv | TEA2026361196624 | 277a4b9c-0077-4ae6-bb5b-cceff29855c0 | 20.10.2026 | 22.10.2026 14:48:29 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026361196625 | e80a391e-0765-4568-8923-aa8c58c1d7d3 | 21.10.2026 | 22.10.2026 14:48:34 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026807199678 | 7a135bb5-6549-4368-903f-e1d453512d9f | 21.10.2026 | 22.10.2026 14:48:36 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Kabul (iletildi) | — |
| B1 | e-SMM | TES2026807199679 | 23ee3399-6582-40e0-8f1e-2220b2bfd595 | 22.10.2026 | 22.10.2026 14:48:38 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İptal Edildi | 22.10.2026 14:50:00 |
| B2 | e-SMM | TES2026807199680 | ae73f17c-2458-40ac-95e9-7721054c774c | 22.10.2026 | 22.10.2026 14:48:41 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 40, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
