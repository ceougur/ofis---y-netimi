# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit 959b667 · başlangıç 22.10.2026 13:31:43 · bitiş 22.10.2026 13:32:55 (TR) · denetim 51/51 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum geçti · d-resmi-pdf geçti · e-iptal geçti · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026482135493 | 8f1628e1-ba58-4eb5-b45b-8d0f5ff5126a | 20.10.2026 | 22.10.2026 13:31:50 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Kabul (iletildi) | — |
| G2 | e-SMM | TES2026482135494 | cb5ced93-2624-495b-bc22-6c3be7f829a4 | 21.10.2026 | 22.10.2026 13:31:55 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Kabul (iletildi) | — |
| G3 | e-Arşiv | TEA2026721667485 | 763169bc-cdaa-43c8-9dc3-09d40523f878 | 20.10.2026 | 22.10.2026 13:31:53 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026721667486 | dc0e0152-7984-4b1e-a160-838171177839 | 21.10.2026 | 22.10.2026 13:31:58 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026482135495 | 4edb43dd-bbf2-4990-8aae-a6d6ec42c939 | 21.10.2026 | 22.10.2026 13:32:00 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Kabul (iletildi) | — |
| B1 | e-SMM | TES2026482135496 | 3143d3af-347f-4a54-83b8-5efcd030775f | 22.10.2026 | 22.10.2026 13:32:02 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İptal Edildi | 22.10.2026 13:32:52 |
| B2 | e-SMM | TES2026482135497 | d9cd4d22-ff9b-4e4c-b1d7-6f174c83a742 | 22.10.2026 | 22.10.2026 13:32:04 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 39, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
