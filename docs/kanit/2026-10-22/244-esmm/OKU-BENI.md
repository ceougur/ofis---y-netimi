# 2.4.4 e-SMM kanıtları (iş listesi 20–21) — 22.10.2026

Komutlar `node tools/kanit.mjs kos 244-esmm/<ad> -- …` ile koşuldu (çıkış kodu + sayılar `<ad>.json`, ham çıktı `<ad>.log`).

## Madde 20 — EDM e-SMM bağdaştırıcısı (ESmmEDM.svc)
- `m20-yeni-yesil`: test/esmm-edm.test.mjs + test/soap-sozlesme-nitelik.test.mjs — yeni kodda 23/23.
- `m20-eski-163dd5d`: aynı testler 163dd5d'nin AYRI kopyasında (git archive; ders 23) — 6 test, 5 başarısız (esmm-edm içe aktarımı yok;
  nitelik denetimi 5 testin 4'ü kırmızı; 1'i olumlu durum, eski kodda da yeşil olması beklenir).
- `m20-mutasyon-M1…M8`: `betikler/mutasyon.mjs betikler/m20-mutasyon.json m20-mutasyon` — 8 mutasyonun 8'i yakalandı (her biri en az 1 kırmızı),
  dosyalar her mutasyondan sonra geri yazıldı ve özeti denetlendi.
- `m20-ebelge-ilgili`: e-Belge'ye dokunan 31 test dosyası, 321/321. `m20-kaynak-tarayan`: platform/yazım/lisans izolasyonu/CI listesi, 15/15.
- Sözleşme kâhini: `tools/ebelge/sema/edm/ESmmEDM-test-singleWsdl.xml` (EDM test WSDL'i, 22.10.2026 indirildi, sha256 25f1b03b… — KAYNAK.md).
