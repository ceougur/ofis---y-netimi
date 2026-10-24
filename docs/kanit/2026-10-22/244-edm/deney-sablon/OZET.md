# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit f57245a · başlangıç 22.10.2026 13:39:30 · bitiş 22.10.2026 13:40:32 (TR) · denetim 27/38 geçti · çıkış 1

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim kaldı (2 kalan) · b-makbuz kaldı (2 kalan) · c-durum kaldı (3 kalan) · d-resmi-pdf kaldı (3 kalan) · e-iptal kaldı (1 kalan) · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026589829651 | a0f662f0-5aa3-4906-8791-94be76ec50a1 | 20.10.2026 | — | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Hata | — |
| G2 | e-SMM | TES2026589829652 | 76ca868c-8132-4aed-b78d-39bfaf55dd77 | 21.10.2026 | — | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Hata | — |
| G3 | e-Arşiv | TEA2026560394035 | ecbb04c9-f1ae-4a20-8074-cceb10e4ceaa | 20.10.2026 | 22.10.2026 13:39:39 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026560394036 | 4e4c2409-ed36-4527-b96c-a0305e0df822 | 21.10.2026 | 22.10.2026 13:39:47 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026589829653 | b3773650-c722-4293-8563-8bc38d49e41e | 21.10.2026 | — | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Hata | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 28, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
