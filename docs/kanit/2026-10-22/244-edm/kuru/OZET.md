# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24) — KURU KOŞU

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**KURU KOŞU:** sahte EDM (yerel, ağa çıkmadı) — aşağıdaki numaralar EDM'de YOKTUR; yalnız özetin biçimini gösterir.

Commit fd0b0fc · başlangıç 22.10.2026 13:01:07 · bitiş 22.10.2026 13:01:09 (TR) · denetim 43/43 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum geçti · d-resmi-pdf geçti · e-iptal geçti · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026648892982 | 64e672b1-8d8d-4ffa-8e37-2795855889cd | 20.10.2026 | 22.10.2026 13:01:09 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Kabul (iletildi) | — |
| G2 | e-SMM | TES2026648892983 | 8da72c5c-0287-4c72-ad35-1d8063cde292 | 21.10.2026 | 22.10.2026 13:01:09 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Kabul (iletildi) | — |
| G3 | e-Arşiv | TEA2026534992908 | dd136664-68e5-4473-911b-a9ba15c0a97f | 20.10.2026 | 22.10.2026 13:01:09 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026534992909 | d16fbb2f-7972-4cdd-954e-41c2ecc5cb14 | 21.10.2026 | 22.10.2026 13:01:09 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026648892984 | 191465b2-cfb2-4721-b460-bd226a03cc18 | 21.10.2026 | 22.10.2026 13:01:09 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Kabul (iletildi) | — |
| B1 | e-SMM | TES2026648892985 | b98d7f4e-c2c5-467c-80c2-68b5d5d87c8b | 22.10.2026 | 22.10.2026 13:01:09 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İptal Edildi | 22.10.2026 13:01:09 |
| B2 | e-SMM | TES2026648892986 | 355774ec-782e-4e93-addb-594d59e5337c | 22.10.2026 | 22.10.2026 13:01:09 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 0, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
