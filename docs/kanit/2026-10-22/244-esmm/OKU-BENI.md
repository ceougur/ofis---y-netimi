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

## Madde 21 — GİB e-SMM belgesi (UBL, ProfileID ESMM)
- `m21-yeni-yesil`: test/esmm-ubl.test.mjs — yeni kodda 13/13 (A–E makbuzları GERÇEK API'den; beklenen sayılar GİB kuralından elle: GIB-ESMM-KAYNAK.md).
- `m21-eski-163dd5d`: aynı test 163dd5d kopyasında — 13 testin 11'i başarısız, 2 geçen (UBL 2.1 XSD ve kâğıt SMM gerilemesi; eski kodda da yeşil olmaları beklenir).
- `m21-mutasyon-U1…U13`: `betikler/mutasyon.mjs betikler/m21-mutasyon.json m21-mutasyon` (liste `betikler/m21-mutasyon.py` ile üretildi) — 13/13 yakalandı.
  U5 (Tahsil Edilen KDV'den tevkifat düşmüyor) programın kendi tutarlılık denetimine takılır: D makbuzunun XML'i üretilmez (500), `before` kancası
  düşer, 12 test iptal (çıkış 1) — sessiz geçmez; ayrıca birim testi `esmmAmounts` denetimini doğrudan sınar.
- `m21-ebelge-ilgili` 346/346, `m21-fatura-216` 12/12, `m21-kahin-ebelge-senaryolar` (bağımsız e-Belge kâhini, kayıtlı 9 senaryo) 0 fark 0 ihlal,
  `m21-e2e-entegrator-240` (Chromium) 73/73.
- `m21-stopaj-yuvarlama-olcum.txt` (`betikler/stopaj-yuvarlama-olcum.mjs`, 100.000 makbuz, tohum 4242): çok kalemli makbuzda "kalem kalem yuvarlanmış
  stopaj toplamı" belge stopajından %23 (2 kalem) – %49 (5 kalem) makbuzda 1–2 kuruş ayrışır; programın XML'i kalem paylarını belge stopajına kuruşu
  kuruşuna dağıtır (Σ = belge). EDM/GİB'in kalem stopajını kendisi yeniden hesaplayıp hesaplamadığı DOĞRULANMADI (madde 24: 2 × 100,03 makbuzu).
- `m21-yapi-edm-ornegi.txt` (`betikler/yapi-karsilastir.py`): EDM e-SMM örneği ↔ programın `m21-ornek-esmm-A.xml`'i (`betikler/ubl-dok.mjs`) — vergi,
  dip toplam ve kalem yolları aynı; farklar taraf/adres ayrıntısı ve programın ek öğeleri (Signature, SendingType, PaymentMeans).
