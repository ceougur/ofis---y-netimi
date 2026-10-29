# EDM Test Ortamı — e-SMM uçtan uca (2.4.4 iş listesi 24)

**Test portalı:** https://test.edmbilisim.com.tr/EFaturaUI21ea/ (Entegratör Ayarları'ndaki test kullanıcı adı ve parolasıyla) → e-Arşiv belgeleri portalın e-Arşiv bölümünde; e-SMM için portalda sarı "SMMM Portalı Girişi" düğmesi.
**Kip:** gerçek EDM test ortamı (yasal geçerliliği olmayan test belgeleri).

Commit be788316 · başlangıç 29.10.2026 08:31:51 · bitiş 29.10.2026 08:49:40 (TR) · denetim 43/51 geçti · çıkış 1

Adımlar: hazirlik geçti · a-baglanti geçti · hazirlik-cariler geçti · g-toplu-gonderim geçti · b-makbuz geçti · c-durum kaldı (7 kalan) · d-resmi-pdf geçti · e-iptal kaldı (1 kalan) · f-bulunamadi geçti · h-hata-kodlari bilgi

Bilgi (denetim değil):
- d-resmi-pdf: B1 TES2026167099700: resmî PDF'te düzenleyenin unvanı (DENEME TICARET LTD. STI.) YOK — e-SMM, VKN'li düzenleyen: EDM test ortamı şablonu unvanı basmaz (EDM yanıtı 22.10.2026); denetim değil
- d-resmi-pdf: B2 TES2026167099701: resmî PDF'te düzenleyenin unvanı (DENEME TICARET LTD. STI.) YOK — e-SMM, VKN'li düzenleyen: EDM test ortamı şablonu unvanı basmaz (EDM yanıtı 22.10.2026); denetim değil
- d-resmi-pdf: G1 TES2026167099697: resmî PDF'te düzenleyenin unvanı (DENEME TICARET LTD. STI.) YOK — e-SMM, VKN'li düzenleyen: EDM test ortamı şablonu unvanı basmaz (EDM yanıtı 22.10.2026); denetim değil

| Kod | Belge Türü | Belge No | ETTN / UUID | Belge Tarihi | Gönderim (TR) | Alıcı | Brüt | Stopaj | KDV | Net Ödenecek | EDM Son Durum | İptal (TR) |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| G1 | e-SMM | TES2026167099697 | ad245aec-6d66-42da-b875-ed07ce175425 | 27.10.2026 | 29.10.2026 08:32:02 | Deneme Müvekkil Danışmanlık A.Ş. | 500,00 | 100,00 | 100,00 | 500,00 | İşleniyor | — |
| G2 | e-SMM | TES2026167099698 | 4dbea0fa-65b8-405f-ac3f-7218b30df576 | 28.10.2026 | 29.10.2026 08:32:07 | Deneme Müvekkil Danışmanlık A.Ş. | 600,00 | 120,00 | 120,00 | 600,00 | İşleniyor | — |
| G3 | e-Arşiv | TEA2026180220674 | 9407060c-8aa1-4696-8aa7-a1a7d2b7d48c | 27.10.2026 | 29.10.2026 08:32:05 | Ahmet Yılmaz | 300,00 | — | 60,00 | 360,00 | İşleniyor | — |
| G4 | e-Arşiv | TEA2026180220675 | 5b4404e9-f660-4e94-9280-66b6512345cd | 28.10.2026 | 29.10.2026 08:32:10 | Ahmet Yılmaz | 400,00 | — | 80,00 | 480,00 | İşleniyor | — |
| G5 | e-SMM | TES2026167099699 | 972fa98c-6c24-45e8-9374-9e5a24e8af25 | 28.10.2026 | 29.10.2026 08:32:12 | Deneme Müvekkil Danışmanlık A.Ş. | 700,00 | 140,00 | 140,00 | 700,00 | İşleniyor | — |
| B1 | e-SMM | TES2026167099700 | 95487aad-25c7-49b6-ab03-51c40af72d09 | 29.10.2026 | 29.10.2026 08:32:14 | Deneme Müvekkil Danışmanlık A.Ş. | 1.000,00 | 200,00 | 200,00 | 1.000,00 | İşleniyor | — |
| B2 | e-SMM | TES2026167099701 | ee9b1abc-df66-4914-a0a0-7bea7c61b636 | 29.10.2026 | 29.10.2026 08:32:16 | Deneme Müvekkil Danışmanlık A.Ş. | 200,06 | 40,01 | 40,02 | 200,07 | İşleniyor | — |

Brüt: e-SMM'de brüt ücret, e-Arşiv'de KDV hariç tutar. Net Ödenecek: e-SMM'de brüt − stopaj + KDV (tahsil edilecek), e-Arşiv'de KDV dahil toplam.
Bekçi: izin verilen dış istek 235, reddedilen 0. Kimlik bilgisi bu dosyalarda yoktur.
