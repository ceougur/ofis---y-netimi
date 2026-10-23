# Bağımsız TUTAR kâhini — Netten Brüte ve e-SMM UBL tutarları (2.4.4 madde 31a, B3–B4)

Dil: **`destekofis-tutar/1`** (tohumlu girdi tablosu) · Yazıldığı gün: 22.10.2026 · Kâhin: `model.py` (Python 3, standart kütüphane, `python3 -I`) ·
Koşucu: `kos.mjs` · Komut: `node --disable-warning=ExperimentalWarning test/bagimsiz/tutar/kos.mjs --tohum 1-3 --adet 50` (tohum başına 50 satır + 11 çapa satırı — c11 23.10.2026 MM10 örneği; npm betiği `test:kahin-tutar` iş akışına eklenirken açılır).

## 0. Temiz oda ve kaynaklar

- **GİB:** GVK md. 94/1 (vergi kesintisi yapmaya mecbur olanlar: kamu, sermaye şirketi, kooperatif, dernek/vakıf, basit usul dışı ticaret ve
  serbest meslek erbabı — ticari faaliyeti olmayan gerçek kişi yok), md. 94/2-b (serbest meslek %20; programın ayar varsayılanı, kullanıcı
  değiştirmedi); KDV tevkifat oranları GİB UBL-TR kod listesinden (`tools/ebelge/sema/gib/UBL-TR_Codelist.xml` satır 17
  `WithholdingTaxTypeWithPercent`: 60290 → 602 = %90, 61650 → 616 = %50 — GİB dosyası, program kodu değil); 30.000 TL üstü nihai tüketici
  kimliği (KURALLAR-244 A6). GİB e-Arşiv Teknik Kılavuzu V1.19 (ebelge.gib.gov.tr, sha256 7763128f…9c31166d) §7 e-SMM standardı
  satır/belge yuvarlamasını **yazmıyor**; GİB e-SMM UBL kılavuzu ebelge.gib.gov.tr'de bulunamadı (esmmmevzuat.html yalnız portal
  kılavuzu e-SMM_Olusturma.pdf, sha256 4cd88758…ee647a, veriyor); UBL-TR şematronunda ESMM/0003 kuralı yok.
- **EDM (entegratörün belgesi):** `Ek_bilgi.txt` dip toplam anlamları — LineExtensionAmount "Brüt Ücret", TaxExclusiveAmount "Net Ücret
  Tutarı", TaxInclusiveAmount "Tahsil Edilen KDV tutarı", PayableAmount "Net Alınan Toplam"; örnek XML yalnız YAPI için (kalemde
  InvoicedQuantity "Net Ücret", PriceAmount "Net Tahsilat"); örnek SAYILARI tutarsız, kaynak değil. EDM programın gönderdiği XML'i bu
  anlamla okuduğu için [EDM] farkı **BULGU** sayılır.
- **SENARYO-DILI §6.1** (yarım birim sıfırdan uzağa) ve **§6.3** (kalem matrahı; KDV dahil: M = yuvarla(fiyat × 100 / (100 + oran)),
  KDV = fiyat − M).
- **[AJAN] madde 26** (KURALLAR-244): elle oran geçer; en küçük brüt (uzlaşım); KDV dahil fiyat = matrah + yuvarla(matrah × KDV);
  Netten Brüte kaydın kendi yolunda çözer. Örnek ÇIKTILARI beklenen sayılmadı (girdileri çapa satırı c01–c06).
- **[AJAN] madde 20–21:** program stopajı belge toplamından yuvarlayıp kalemlere kuruşu kuruşuna dağıtıyor (Σ kalem = belge).
- **Okunmayanlar:** server/**, client/**, test/e2e/**, docs/kanit/**, iş listesi, git farkları. Uçlar: `test/netten-brute-244.test.mjs`,
  `test/esmm-ubl.test.mjs` ÇAĞRI satırları (POST /api/workspace/invoices/gross-from-net {…form, net} → unitPrice, gross, stoppageRate,
  stoppage, net, vat, withheld, payable; POST /api/workspace/invoices {scenario:"smm", …}; GET /invoices/:id (netTotal, stoppageTotal,
  vatTotal, withheldTotal, payableTotal, stoppageRate, lines[net, vat, vatRate, base, discount, withholdingCode, withheld]); GET
  /invoices/:id/ubl.xml; PUT /api/workspace/invoices/settings {seller, efatura, earsiv, esmm}) + kara kutu yoklaması.

## 1. Kurallar

| No | Kural | Etiket |
|---|---|---|
| B3.1 | Stopaj oranı: elle yazılan oran geçer; yazılmadıysa tüzel/ticari alıcıda %20, gerçek kişi (TCKN'li, nihai tüketici 11111111111 dahil) alıcıda 0 | GİB (elle oran gerçek kişide: AJAN) |
| B3.2 | Kaydedilen makbuzda Net Ücret (brüt − stopaj) = Netten Brüte'ye yazılan tutar (çözüm varsa) | GİB (özelliğin tanımı) |
| B3.3 | Brüt = Net Ücreti veren EN KÜÇÜK brüt; birim fiyat KDV hariçte = brüt − öbür kalemler, KDV dahilde = matrah + yuvarla(matrah × KDV) | AJAN (iki dalda farklıysa ÇATAL) |
| B3.4 | Öbür kalemler Net Ücreti zaten karşılıyorsa (ilk kaleme > 0 brüt kalmıyorsa) Netten Brüte reddeder | AJAN |
| B3.5 | KDV = yuvarla(kalem matrahı × oran), belge KDV'si = Σ kalem | GİB (KDV K. md. 20; kalem başına) |
| B3.6 | Stopaj = yuvarla(belge brütü × oran) — **23.10.2026: ÇATAL karara bağlandı, dal A (belge düzeyi)**: 31b MM10 ([KULLANICI] 22.10 21:27 UTC "MM10 … tek yuvarlama kuralı"; ana oturumun kural metni "KDV kalem başına, stopaj makbuz toplamı üzerinden; çok kalemli makbuzda ≤ 1 kuruş fark beklenir; mevcut model böyle, değişmedi"). Dal B (kalem kalem) yalnız bilgi. Ek denetim `mm10KdvStopajFarkiKurus`: iki kalemli, KDV hariç, iskontosuz, KDV oranı = stopaj oranı makbuzda KDV − stopaj ≤ 1 kuruş (üç ve daha çok kalemde 2 kuruşa çıkabildiğinden denetlenmez) | KULLANICI (MM10); GİB tek dalda |
| B3.7 | KDV tevkifatı = yuvarla(KDV × pay/payda) kalem başına — **ÇATAL** kalem / belge düzeyi | GİB tek dalda, ÇATAL iki dalda |
| B3.8 | Ödenecek = Net Ücret + KDV − tevkifat (programın kendi tutarlarıyla) | GİB (SMM "Net Tahsil Edilen") |
| B3.9 | Netten Brüte ön hesabı (gross, stoppage, net, vat, withheld, payable) = kaydedilen makbuz | AJAN |
| A6 | Nihai tüketici (11111111111) + 30.000 TL üstü toplam → kayıt reddedilir | GİB |
| B4.1–4 | XML LegalMonetaryTotal: LineExtension = brüt; TaxExclusive = brüt − stopaj; TaxInclusive = KDV − tevkifat; Payable = Net Ücret + Tahsil Edilen KDV | EDM |
| B4.5–7 | 0003 GV stopajı tutarı ve oranı; 0015 KDV toplamı; WithholdingTaxTotal = tevkifat | EDM |
| B4.8 | Σ kalem LineExtensionAmount = belge | GİB/UBL |
| B4.9–10 | Σ kalem 0003 = belge stopajı; her kalemin stopajı kendi matrah × oranından en çok 1 kuruş sapar | AJAN |
| B4.11–12 | Kalem InvoicedQuantity = kalem brüt − kalem stopajı; PriceAmount = InvoicedQuantity + kalem KDV − kalem tevkifatı; Σ PriceAmount = Payable | EDM |

Türetme denetimleri (B3.5–B3.8, B4) programın KAYDETTİĞİ kalem matrahlarını girdi alır (`--program`), böylece bir birim fiyat farkı bütün
türetmelere taşmaz; beklenen sonuç kuralın kendisidir.

## 2. Nasıl bozulur? → girdi

Alıcı türü (tüzel / TCKN'li kişi / nihai tüketici), elle oran (0, 10, 15, 17, 20), KDV 1/10/20, KDV dahil, 602/616 tevkifat (ilk ve ek
kalemde), 1–2 ek kalem (farklı KDV), iskonto (%10, %12,5: yalnız Net Ücret ve türetmeler), Net 0,01 TL … 1 milyar TL; çözümsüz (öbür
kalemler büyük); 30.000 TL eşiği. Çapa satırları c07 (2 × 100,03 benzeri dağıtım) ve c08 (üç kalem, iki tevkifat — çatal örneği).

## 3. Mutasyonlar

`model.py --mutasyonlar` (7): kişiye %20 stopaj, en büyük brüt, KDV dahilde matrahı fiyat sanmak, kalem kalem stopaj, 602'yi 5/10 sanmak,
TaxInclusive = Net + KDV, tevkifatın düşülmemesi. Her biri en az bir tohumda bir denetimi değiştirmeli.

## 4. Sonuç (22.10.2026, fd0b0fc)

Farksız. ÇATAL dalları programda: **stopaj belge düzeyinde** (dal A; c08: 125,00, kalem kalem 125,01), **tevkifat kalem kalem** (c08:
52,51, belge düzeyi 52,50), KDV kalem kalem. GİB her iki dalı da yazmıyor → İNCELE (mali müşavir: stopajda belge, KDV/tevkifatta kalem
yuvarlaması aynı makbuzda bir arada).
