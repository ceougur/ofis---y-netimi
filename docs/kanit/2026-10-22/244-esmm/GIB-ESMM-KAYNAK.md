# e-SMM belgesi (iş listesi 21) — kâhin kaynakları (22.10.2026)

Beklenen sayılar (test/esmm-ubl.test.mjs) programın kodundan DEĞİL, aşağıdaki GİB kurallarından elle hesaplandı (ders 5). Dosyalar depoya
konmadı (büyük PDF); adres + sha256 ile tekrar indirilip doğrulanabilir.

| Kaynak | Adres | sha256 |
|---|---|---|
| GİB e-Arşiv Teknik Kılavuzu V1.19 (Ekim 2026) | https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-Arsiv_Teknik_Kilavuzu_V.1.19.pdf | 7763128fa1258024a53e30bbe68be9773bfcfa7a59fbd2d5eaf8e1a29c31166d |
| GİB e-Arşiv paketi v1.1_9 (eArsivVeri.xsd: serbestMeslekMakbuz şeması) | https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/earsiv_paket_v1.1_9.zip | 37cb15b2564782372d83ca54646e2562a00980cb8d6029b409b14f01692c7c56 (eArsivVeri.xsd 57aba2a1…) |
| GİB UBL-TR Kılavuzları (Kod Listeleri V1.43) | https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/UBLTR_1.2.1_Kilavuzlar.zip | 0f7c720da5d9f0e9d25ef929f03d1ecd04871bda924ecb1a6b71b5e8fba0710a (Kod Listeleri PDF 25c4fca1…) |

## Kurallar (kaynaktan)
- e-Arşiv Teknik Kılavuzu §3.3.6 `serbestMeslekMakbuz` (GİB'in e-SMM veri tanımı; EDM GİB'e bu raporu gönderir):
  `toplamTutar` "e-Serbest Meslek Makbuzunun vergi hariç toplam tutarı" (= brüt ücret); `odenecekTutar` "ödenecek tutar";
  `vergiBilgisi/vergi`: `matrah`, `vergiKodu` (e-Fatura Kod Listeleri), `vergiTutari`, `vergiOrani` — belge düzeyinde; `tevkifat` ayrı (kod, tutar, oran);
  `gonderimSekli` KAGIT / ELEKTRONIK (zorunlu). §7: e-SMM biçimi GİB'ce UBL olarak tanımlanmaz ("genel tanınırlığa sahip format"; verisi şemaya uygun).
- Kod Listeleri V1.43 §1.9 Vergi Kodları: **0003 Gelir Vergisi Stopajı (GV STOPAJI)**, **0015 Gerçek Usulde Katma Değer Vergisi (KDV GERCEK)**.
  §2.2 ProfileID listesinde ESMM YOK → "ESMM" EDM'nin profilidir; GİB şematronu (tools/ebelge/sema/gib) e-SMM'yi denetlemez. Uygunluk: OASIS UBL 2.1 XSD.
- Hesap: stopaj = brüt ücret (matrah) × oran (GVK md. 94; belge düzeyinde, kuruşa yuvarlı); KDV = matrah × oran (GİB UBL-TR: kalem başına);
  Net Ücret = brüt − stopaj; Tahsil Edilen KDV = KDV − KDV tevkifatı; Net Alınan = Net Ücret + Tahsil Edilen KDV.

## Yapının kaynağı (kâhin değil)
EDM'nin e-SMM örnek UBL'i ve Ek_bilgi.txt (kullanıcının yüklediği EDM belgeleri; depoya girmez): LineExtension = Brüt Ücret, TaxExclusive = Net Ücret,
TaxInclusive = Tahsil Edilen KDV, Payable = Toplam Net Alınan; TaxTotal'da 0003 (sıra 1) + 0015 (sıra 2); kalemde InvoicedQuantity (NIU) = Net Ücret,
Price = Net Tahsilat. EDM örneğinin SAYILARI kâhin değildir (KDV %18, matrah 0). Yol karşılaştırması: `m21-yapi-edm-ornegi.txt` — vergi, dip toplam ve
kalem yolları birebir; farklar yalnız taraf/adres ayrıntısı (programın e-Fatura/e-Arşiv'de EDM'nin kabul ettiği taraf yapısı) ve programın ek öğeleri
(Signature, SendingType, PaymentMeans).
