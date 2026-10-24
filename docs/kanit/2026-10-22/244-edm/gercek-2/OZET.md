# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit 35d2a55 · başlangıç 22.10.2026 13:15:31 · bitiş 22.10.2026 13:16:42 (TR) · denetim 47/47 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum geçti · d-resmi-pdf geçti · e-iptal geçti · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026705389762 | 25c328cf-15bc-478b-9091-7b1642c6c99a | 20.10.2026 | 22.10.2026 13:15:38 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Kabul (iletildi) | — |
| G2 | e-SMM | TES2026705389763 | 31373910-c64c-41bd-988c-74c3718258b8 | 21.10.2026 | 22.10.2026 13:15:43 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Kabul (iletildi) | — |
| G3 | e-Arşiv | TEA2026336860325 | bd667f37-f021-4d71-9986-1baf3bb3eb7e | 20.10.2026 | 22.10.2026 13:15:41 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026336860326 | 452e3d0e-ac11-483d-90c2-22f0e4b37078 | 21.10.2026 | 22.10.2026 13:15:46 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026705389764 | fea3fd5a-2cbd-4406-8f4d-571798c72aba | 21.10.2026 | 22.10.2026 13:15:48 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Kabul (iletildi) | — |
| B1 | e-SMM | TES2026705389765 | 17f4eb04-53ff-49fe-9e83-30a03dea0c56 | 22.10.2026 | 22.10.2026 13:15:50 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İptal Edildi | 22.10.2026 13:16:38 |
| B2 | e-SMM | TES2026705389766 | 0c3695af-f788-4c64-bd72-71ea9724c052 | 22.10.2026 | 22.10.2026 13:15:52 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 39, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
