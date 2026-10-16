# EDM test ortamı — portala taslak (LoadInvoice) davranışı (16.10.2026, İz 7.3)

Amaç: "EDM portalına taslak yükleme" seçeneğini tasarlamadan ÖNCE EDM'nin gerçek davranışını görmek. Gerçek EDM test servisi
(test.edmbilisim.com.tr), programın EDM istemcisi (`server/lib/einvoice/edm.mjs` loadDraft / sendDraft / status / cancelEArchive),
programın kendi vekil modülü. Kimlik bilgisi yalnız oturuma yüklenen dosyadan; çıktılar maskeli; depoya alınan 7 dosya kullanıcı adı ve
parola için tarandı (sızıntı yok). Canlı ortam kullanılmadı.

Komut: `NODE_EXTRA_CA_CERTS=… node probe.mjs <kimlik-dosyası> ./cikti` ve `node probe2.mjs …` (çıktılar `probe-cikti.log`, `probe2-cikti.log`).

Görülen (ham çıktıdan):
- e-Arşiv (DOA2026806748741) ve e-Fatura (DOF2026892600315) LoadInvoice → durum `LOAD - SUCCEED`.
- AYNI ETTN ile ikinci LoadInvoice kabul edildi ve içeriği DEĞİŞTİRDİ: resmî PDF'te ikinci yüklemenin tutarı (e-Fatura 334,00 / 400,80 TL;
  e-Arşiv'de yalnız matrah 111 → 112 değiştirilmişti, PDF 112,00 gösteriyor) — `resmi-pdf-tutarlar.txt`.
- Taslağı gönderme: SendInvoice, INVOICE CONTENT boş + UUID → e-Arşiv SEND-SUCCEED; e-Fatura SEND-PROCESSING (test ortamında 5 dk içinde bitmedi).
- Gönderilmiş taslağı ikinci kez gönderme → EDM hata 11028 ("faturası gönderilemez"); gönderilmiş belgeyi yeniden yükleme → 11056
  ("Daha önce yüklediğiniz bir fatura'yi tekrar yüklemeye çalıştınız").
- e-Arşiv taslağı (DOA2026806748742) CancelInvoice ile iptal → `CANCELLED - SUCCEED`.
- İlk denemede "eFatura belge" carisi e-Fatura işaretsiz olduğu için e-Arşiv'e düştü (DOA2026806748743); probe2 e-Fatura carisiyle yeniden yaptı.
Tasarıma etkisi: programda taslak düzenlenebilir ve "Taslağı Yenile" ile EDM'deki kopya güncellenir; programdan gönderimde önce son hâl yüklenir
sonra gönderilir (defter = e-Belge); 11056/11028 → belge portaldan gönderilmiş demektir, durum EDM'den okunur.

## Programın kendi API'siyle uçtan uca (dört seçenek AÇIK) — `program.mjs`, `program-cikti.log`
e-Fatura DOF2026352275183: kalem "Kombi" Seri No SN-EDM-001 / Lot No LOT-2026-10 + "Montaj"; 2.000 nakit + 3.000 kart peşin, kalan vadeli.
- XML (`-ilk.xml`): XSD 0 hata, GİB şematronu 0 hata; PaymentMeansCode 10, 48, 42 (+ IBAN); not "Cari hesap bakiyeniz (16.10.2026 itibarıyla, bu fatura
  dahil): 7.600,00 TL borç" — ELLE: (10.000 + 500) × 1,20 = 12.600 − 5.000 peşin = 7.600.
- Portala Taslak Yükle → durum "draft" (EDM LOAD - SUCCEED) → Düzenle (10.000 → 11.000; draftStale true) → Taslağı Yenile (draftStale false) → Gönder
  (önce son hâl yüklenir) → SEND - PROCESSING … ~7 dk sonra "sent" → resmî PDF (`-resmi.pdf`, `program-resmi-sayfa1.png`): EDM belgeyi bizim
  şablonla çizdi — kalemin altında "Seri No: SN-EDM-001 · Lot No: LOT-2026-10", "Ödeme Şekli: Nakit, Kredi Kartı, Havale / EFT", Ödenecek 13.800,00 TL
  (ELLE 11.500 × 1,20), bakiye notu 8.800,00 TL borç (13.800 − 5.000), IBAN.
- e-Arşiv DOA2026352275183: Portala Taslak Yükle → programda İptal → EDM'de CancelInvoice → "cancelled".
BULGU (bu denemeden): peşin ödeme satırları PaymentDueDate = belge tarihi taşıyordu; görünüm "Son Ödeme Tarihi"ni ilk satırdan okuduğu için vade
ileri tarihliyken belge tarihini gösterecekti (bu denemede vade girilmediği için görünmedi — betik vadeyi yanlış alana yazmıştı). Testte kırmızı
üretildi (ebelge-240-ek-secenekler "400 nakit + 500 kart…"), düzeltildi: peşin satıra son ödeme tarihi yazılmaz; şablon vadeyi belge tarihinden
farklı olan satırdan okur.
