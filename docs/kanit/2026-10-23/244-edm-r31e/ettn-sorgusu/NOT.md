# Gerçek EDM test ortamı — e-SMM durum yanıtı ETTN taşıyor mu? (31e İNCELE-1 / E1 bilinen sınır; ders 18)

23.10.2026 ~03:45 UTC, commit 9708b4a (is/r31e-e1). Salt okuma: GetSMMStatus, programın kendi EDM istemcisi (`createEdmSmmClient`, test adresi sabit, izin dışı
adres reddedilir). Kimlik yalnız komutun ortam değişkeninde; bu klasörde yok. Sorgulanan iki makbuz aynı gün `../gercek/` koşusunda gönderildi (G1, B2).

Sonuç (`sonuc.jsonl`): iki makbuzda EDM'nin durum yanıtındaki ETTN belgenin kendi ETTN'iyle AYNI (TES2026295644872 → 6cd4a435…, TES2026295644876 → b62ff951…),
durum "sent". Yani 11048'den sonra "bu belge mi" kararı (yanıttaki ETTN = belgenin ETTN'i) gerçek EDM'de çalışır; ETTN'siz yanıt (Sonucu Belirsiz kolu) gerçek
EDM'de görülmedi. e-Fatura/e-Arşiv'de aynı (docs/kanit/2026-10-16/edm-arayuz/adim10.log).
