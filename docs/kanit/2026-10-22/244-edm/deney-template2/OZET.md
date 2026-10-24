# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit dc49a8c · başlangıç 22.10.2026 14:15:58 · bitiş 22.10.2026 14:17:40 (TR) · denetim 55/55 geçti · çıkış 0

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum geçti · d-resmi-pdf geçti · e-iptal geçti · f-bulunamadi geçti · h-hata-kodlari bilgi

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026634450823 | a5e22fd5-2fda-4fda-9a24-87d63db9aaf9 | 20.10.2026 | 22.10.2026 14:16:05 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | Kabul (iletildi) | — |
| G2 | e-SMM | TES2026634450824 | 4622ba7c-2551-4a61-8378-4c007dd38139 | 21.10.2026 | 22.10.2026 14:16:11 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | Kabul (iletildi) | — |
| G3 | e-Arşiv | TEA2026321242097 | efc8f120-94ec-4bb9-9e29-9fea778d2b36 | 20.10.2026 | 22.10.2026 14:16:08 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | Kabul (iletildi) | — |
| G4 | e-Arşiv | TEA2026321242098 | 258eb71e-b03e-41e6-9a21-73c53425a1c2 | 21.10.2026 | 22.10.2026 14:16:13 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | Kabul (iletildi) | — |
| G5 | e-SMM | TES2026634450825 | a495342f-6daf-409d-b362-de788c6a6a6e | 21.10.2026 | 22.10.2026 14:16:16 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | Kabul (iletildi) | — |
| B1 | e-SMM | TES2026634450826 | 279cbae6-c52a-4102-9d72-207b9ddea176 | 22.10.2026 | 22.10.2026 14:16:18 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İptal Edildi | 22.10.2026 14:17:37 |
| B2 | e-SMM | TES2026634450827 | df6366c1-0eef-4afa-8ca7-da90f74030cf | 22.10.2026 | 22.10.2026 14:16:20 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | Kabul (iletildi) | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 40, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
