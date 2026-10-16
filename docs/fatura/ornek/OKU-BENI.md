# EDM Test Ortamı — 5 Senaryo Örnek Belge, Kontrol Listesi ve Yanıt Doğrulama

16.10.2026, gerçek EDM test ortamı (`https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc`). Belgeler DestekOfis'in **kendi API'siyle** oluşturuldu
(elle yazılmış XML değil); her XML UBL 2.1 XSD + GİB şematronundan geçti, gerçek EDM'ye gönderildi ve son durumu okundu. Kanıt: `cikti/`.

| Dosya | İçerik |
|---|---|
| `edm-ornek.mjs` | Kopyala-çalıştır betik: `NODE_USE_ENV_PROXY=1 node docs/fatura/ornek/edm-ornek.mjs <kimlik dosyası> <çıktı klasörü>` |
| `cikti/<senaryo>.json` | DestekOfis'e verilen gövde (`POST /api/workspace/invoices`) — ekrandaki formun karşılığı |
| `cikti/<senaryo>.xml` | Programın ürettiği UBL-TR 2.1 XML (EDM `SendInvoice` / `LoadInvoice` içeriği) |
| `kahin.py` | Bağımsız kâhin (Python, programın kodunu kullanmaz): JSON'dan beklenen tutarlar ↔ XML |
| `cikti/sonuc.json`, `cikti/edm-ornek-kosu.log` | Ham sonuç (kimlik bilgisi maskeli) |

## Sonuç (portaldan bakılabilir)

| # | Senaryo | Numara | ETTN | EDM son durum |
|---|---|---|---|---|
| 1 | Perakende: %1 / %10 / %20, satır + genel iskonto (e-Arşiv, kişi) | TEA2026233739842 | 2ec27890-5565-47d9-81eb-ac606adec396 | SUCCEED |
| 2 | Hizmet, KDV tevkifatlı 612 (9/10), e-Arşiv, firma | TEA2026233739843 | 6cedf9af-b0d3-4ce4-a932-1e21b26e3eaf | SUCCEED |
| 3a | Tevkifatlı e-Fatura 5/10 (616) | TEF2026233739842 | e45ec124-09a3-49ef-a106-4ff604943891 | Alıcıya ulaştı (SUCCEED) |
| 3b | Tevkifatlı e-Fatura 9/10 (602) | TEF2026233739843 | 36c8007e-a206-43f4-b5fe-1db5405a4c40 | Alıcıya ulaştı (SUCCEED) |
| 4 | Dövizli e-Fatura USD, kur 41,25 | TEF2026233739844 | b5666601-3f05-461b-a1dd-b2fc9b8d2347 | Alıcıya ulaştı (SUCCEED) |

Bağımsız kâhin (`kahin.py`): 5/5 senaryoda matrah ve ödenecek tutar XML ile birebir (`cikti/kahin-python.txt`).

## Kontrol listesi (her senaryoda doğrulanan düğümler)
- **Hepsi:** `cbc:ProfileID` (EARSIVFATURA / TEMELFATURA), `cbc:UUID` = belgenin ETTN'si = EDM'nin döndürdüğü UUID, `cbc:ID` seri + yıl + 9 hane,
  `cac:LegalMonetaryTotal` (`TaxExclusiveAmount` matrah, `PayableAmount` ödenecek), her KDV oranı için ayrı `cac:TaxSubtotal`, XSD 0 hata + GİB şematronu 0 hata.
- **1 Perakende:** kalem başına `cac:AllowanceCharge` (`ChargeIndicator=false`, `MultiplierFactorNumeric`, `Amount`, `BaseAmount`); 1. kalemde satır + genel
  iskonto birlikte (125,00 → 18,13 iskonto). **Yuvarlama kuralı:** iskonto TUTARLARI kuruşa yuvarlanır (12,50 + 5,63), net = brüt − iskontolar (106,87).
  Neti doğrudan yuvarlamak 106,88 verir; 1 kuruş fark (ilk koşuda bağımsız hesabımız böyle yaptı, program kuralı doğru ve tutarlı).
- **2 Hizmet:** `cac:WithholdingTaxTotal` (`TaxTypeCode` 612, `Percent` 90), `cbc:InvoiceTypeCode` TEVKIFAT; ödenecek = matrah + KDV − tevkif edilen KDV.
  **Satış faturasında gelir vergisi STOPAJI programda yok** (yalnız Serbest Meslek Makbuzu ve alış belgelerinde; e-SMM gönderimi kapsam dışı) — istenirse ayrı iş.
- **3a / 3b Tevkifat:** `WithholdingTaxTotal` 616 → `Percent` 50 (5/10), 602 → 90 (9/10); tip TEVKIFAT; alıcı posta kutusu (PK) zorunlu.
- **4 Döviz:** `cbc:DocumentCurrencyCode` USD, bütün tutarlar USD, `cac:PricingExchangeRate` (`SourceCurrencyCode` USD, `TargetCurrencyCode` TRY,
  `CalculationRate` 41.25, `Date`); yazıyla tutar notu ("Yalnız Beş Yüz Dört ABD Doları"). TL karşılığı belge görünümünde "Döviz Kuru" ve "Ödenecek Tutar (TL)"
  satırlarıyla basılır (504 × 41,25 = 20.790,00 TL); XML'de ayrı TL tutar düğümü yok (GİB ve EDM kabul etti).

## 5 — Hatalı / eksik veri: iki katman
**(a) Program, EDM'ye göndermeden durdurur** (numara harcanmaz): geçersiz VKN `1234567891` → 400 "Vergi kimlik numarası (VKN) geçersiz: denetim hanesi tutmuyor";
9 haneli → "VKN 10, TCKN 11 haneli olmalı"; geçersiz TCKN → "denetim haneleri tutmuyor"; geçersiz KDV oranı (%7) → "KDV oranı %0, %1, %10, %20 olabilir";
ayrıca e-Fatura mükellefine e-Arşiv, posta kutusu bilinmeyen alıcı, eksik firma/alıcı bilgisi gönderimden önce durur.
Not: `1234567890` algoritmaya göre GEÇERLİ bir VKN'dir (örnek seçerken dikkat).

**(b) Bozulmuş XML doğrudan EDM'ye (`SendInvoice`) — EDM'nin SOAP Fault yanıtı:**

| Durum | EDM hata kodu | EDM iletisi (özet) |
|---|---|---|
| Alıcı VKN geçerli ama e-Fatura mükellefi değil (1234567890) | 11030 | Schematron: ProfileID TEMELFATURA geçersiz (e-Arşiv olmalı) |
| Alıcı VKN boş | 11030 | Schematron: schemeID VKN ise 10 haneli VKN yazılmalı |
| e-Fatura alıcısı TCKN 11111111111 | 11030 | Schematron: ProfileID geçersiz (e-Arşiv olmalı) |
| Ölçü birimi boş (`unitCode=""`) | 11059 | Geçersiz Ölçü Birim Kodu |
| KDV toplamı yok (`TaxTotal` silindi) | 11029 | Şema hatası (XSD) |
| Geçersiz posta kutusu (PK) | 11059 | Alıcının GİB posta kutusu etiketi hatalı |

EDM bu hataların hepsini **`SendInvoice` anında** SOAP Fault olarak döndürdü (belge oluşmadı, kontör düşmez). Program bu hataları `integrator-rejected` sayar:
belge "Hata" durumuna geçer, düzeltilip aynı numarayla yeniden gönderilir.

## Kod örneği — gönderim, UUID ve durum doğrulama, SOAP Fault yakalama
```js
import { createEdmClient } from "../../../server/lib/einvoice/edm.mjs";
const edm = createEdmClient({ baseUrl: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc", username, password });
// xml: programın ürettiği UBL-TR; number / uuid: XML'deki cbc:ID / cbc:UUID ile AYNI olmalı.
try {
  const sent = await edm.send({ xml, number, uuid, earchive: false, senderVkn: "3230512384", senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr",
    receiverVkn: "3230512384", receiverAlias: "urn:mail:defaultpk@edmbilisim.com.tr" });
  if (sent.uuid !== uuid) throw new Error(`EDM farklı UUID döndürdü: ${sent.uuid}`);           // 1) UUID doğrulama
  const st = await edm.status({ uuid, number, earchive: false });                             // 2) GetInvoiceStatus
  // st.status: processing | sent | accepted | rejected | error | cancelled; st.raw: EDM ham durumu (ör. "SEND - SUCCEED")
  console.log(st.status, st.raw, st.message);
} catch (error) {
  // 3) SOAP Fault: EDM hata kodu + ileti
  console.log(error.code /* integrator-rejected */, error.integratorCode /* 11030, 11029, 11059… */, error.message);
}
```
Taslak (gönderilmeden portala): `edm.loadDraft({ … })` (EDM `LoadInvoice`); taslağı gönderme `edm.sendDraft({ number, uuid, … })` (içeriksiz `SendInvoice`).
EDM'de "SendDraftInvoice" adında bir metot yoktur.
