# Madde 24 — gerçek EDM test ortamı deneyleri (22.10.2026, ana oturum)

Deneyler ayrık kopyada (/home/user/wt/edm-gercek) KAYDA ALINMAYAN geçici yamalarla koşuldu; yama koşudan hemen sonra geri alındı (git restore). Kimlik bilgisi
yalnız ortam değişkeninde; çıktılar betik tarafından maskelendi ve tarandı.

| Klasör | Taban | Geçici yama | Sonuç |
|---|---|---|---|
| deney-kisi | 959b667 | VKN'li satıcıya `<cac:Person>` (FirstName "DENEYAD", FamilyName "DENEYSOYAD") | 51/51; EDM e-SMM görüntüsü düzenleyen adını Person'dan bastı ("DENEYAD DENEYSOYAD" ilk satır) → EDM düzenleyenin adını yalnız Person'dan basar |
| deney-sablon | f57245a (Person satırı çıkarılarak) | programın görünüm şablonu (viewXslt) e-SMM'ye de gömüldü | e-SMM'ler reddedildi: "Object reference not set to an instance of an object." (EDM hata kodu 11032) → e-SMM görüntüsünü ve karekodunu EDM'nin şablonu çizer; programın şablonu gömülemez |

Koşu sırası: gercek-1 (0c1035d; e-SMM şema hatası: adres caddeSokak) → gercek-2 (35d2a55; 47/47 ama resmî PDF'te adres iki kez) → gercek-3 (959b667;
adres bir kez, 51/51; unvan yok) → deney-kisi → gercek-4 (f57245a; Person'da FamilyName yok → 11029) → deney-sablon → gercek-5 (32e59c0; 55/55, unvan ve
adres doğru). Bütün koşularda e-SMM karekodu (EDM'nin) yalnız ETTN içerir — GİB Karekod Standardı V1.2 §2.4'ün istediği tutar alanları YOK (EDM'ye soruldu).
