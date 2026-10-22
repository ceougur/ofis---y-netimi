# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit f57245a · başlangıç 22.10.2026 13:37:33 · bitiş 22.10.2026 13:38:28 (TR) · denetim 27/38 geçti · çıkış 1

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim kaldı (2 kalan) · b-makbuz kaldı (2 kalan) · c-durum kaldı (3 kalan) · d-resmi-pdf kaldı (3 kalan) · e-iptal kaldı (1 kalan) · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026282855495 | 0d5303b2-5e44-42c7-b102-5a933d289235 | 20.10.2026 | — | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Hata | — |
| G2 | e-SMM | TES2026282855496 | 2ba31f33-5c2d-4e10-b8da-1dc9ef91bd71 | 21.10.2026 | — | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Hata | — |
| G3 | e-Arşiv | TEA2026625356540 | 655d171d-bdbd-4414-8649-41824a7746f5 | 20.10.2026 | 22.10.2026 13:37:41 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026625356541 | 2612df22-635d-4dcd-bb46-0dc4dfc4594e | 21.10.2026 | 22.10.2026 13:37:46 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026282855497 | d60c1050-fbfd-4f3e-84ac-c60090e15df7 | 21.10.2026 | — | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Hata | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 28, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
