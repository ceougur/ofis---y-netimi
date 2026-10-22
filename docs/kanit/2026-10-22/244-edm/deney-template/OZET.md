# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit 60a411f · başlangıç 22.10.2026 14:10:33 · bitiş 22.10.2026 14:11:46 (TR) · denetim 55/55 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum geçti · d-resmi-pdf geçti · e-iptal geçti · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026670595466 | e60a533c-9558-4f0e-88f4-6ee739e63466 | 20.10.2026 | 22.10.2026 14:10:41 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Kabul (iletildi) | — |
| G2 | e-SMM | TES2026670595467 | acaed480-bff7-498e-b2e2-e2e986eeb8bd | 21.10.2026 | 22.10.2026 14:10:46 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Kabul (iletildi) | — |
| G3 | e-Arşiv | TEA2026614853828 | 5a4a6a73-f0f9-4baa-9d5d-6e465b9f02b7 | 20.10.2026 | 22.10.2026 14:10:44 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026614853829 | d074164c-e7eb-4f18-ac57-4b6a9b1ca54f | 21.10.2026 | 22.10.2026 14:10:49 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026670595468 | 4f0c8adb-263f-4dca-90f5-a4b09c916313 | 21.10.2026 | 22.10.2026 14:10:51 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Kabul (iletildi) | — |
| B1 | e-SMM | TES2026670595469 | 45dc5815-6f11-4486-ada3-7dfb5ff0475a | 22.10.2026 | 22.10.2026 14:10:53 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İptal Edildi | 22.10.2026 14:11:43 |
| B2 | e-SMM | TES2026670595470 | 03dc29fd-5d50-4a0c-a9ee-d8d80f92082d | 22.10.2026 | 22.10.2026 14:10:55 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 39, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
