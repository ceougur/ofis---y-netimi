# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit 959b667 · başlangıç 22.10.2026 13:33:27 · bitiş 22.10.2026 13:34:39 (TR) · denetim 51/51 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum geçti · d-resmi-pdf geçti · e-iptal geçti · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026227664239 | ba0138b5-bc10-4488-8cb4-3df9af1239de | 20.10.2026 | 22.10.2026 13:33:34 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Kabul (iletildi) | — |
| G2 | e-SMM | TES2026227664240 | 7ba57671-afce-484d-a970-d0c8f6296e93 | 21.10.2026 | 22.10.2026 13:33:40 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Kabul (iletildi) | — |
| G3 | e-Arşiv | TEA2026514090925 | 23e14bea-6705-4f1d-8ff9-af5896ce0763 | 20.10.2026 | 22.10.2026 13:33:38 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026514090926 | b2363ea7-9302-434d-8bdb-3639d0080a91 | 21.10.2026 | 22.10.2026 13:33:43 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026227664241 | e1e525ea-b155-4b91-93ee-69c1f30ab81f | 21.10.2026 | 22.10.2026 13:33:45 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Kabul (iletildi) | — |
| B1 | e-SMM | TES2026227664242 | 24d05808-40ec-43e3-9c7d-87ca84b22fa9 | 22.10.2026 | 22.10.2026 13:33:47 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İptal Edildi | 22.10.2026 13:34:35 |
| B2 | e-SMM | TES2026227664243 | dd26cee3-b517-449f-ad1c-c4ead7488a48 | 22.10.2026 | 22.10.2026 13:33:49 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 39, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
