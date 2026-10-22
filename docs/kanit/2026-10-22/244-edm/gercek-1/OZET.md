# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit 0c1035d · başlangıç 22.10.2026 13:07:17 · bitiş 22.10.2026 13:08:26 (TR) · denetim 25/36 geçti · çıkış 1

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim kaldı (2 kalan) · b-makbuz kaldı (2 kalan) · c-durum kaldı (3 kalan) · d-resmi-pdf kaldı (3 kalan) · e-iptal kaldı (1 kalan) · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026740556630 | 8f84a18d-dadf-41f2-bb53-594beb388f9a | 20.10.2026 | — | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Hata | — |
| G2 | e-SMM | TES2026740556631 | 36fd0d8d-e7a2-4fe8-ae09-2797302f5736 | 21.10.2026 | — | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Hata | — |
| G3 | e-Arşiv | TEA2026402997236 | 82dbc44d-a51b-486b-b204-eab6cec8ff50 | 20.10.2026 | 22.10.2026 13:07:32 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026402997237 | 9706de4e-2673-4b30-93d7-a2dde3e91d89 | 21.10.2026 | 22.10.2026 13:07:40 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026740556632 | 56d56213-51ff-4b7a-95a1-377f8418d284 | 21.10.2026 | — | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Hata | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 28, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
