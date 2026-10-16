# Karekod (zorunlu) ve GİB logosu — gerçek EDM test ortamı (16.10.2026, İz 9)
Kaynak: GİB "Karekod Standardı Kılavuzu" V.1.2 (Kasım 2023), https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/Karekod_Standardi_Kilavuzu_V.1.2.pdf,
sha256 0db9831aac2ca29e713024eedbef6f76514aef46edae919ce6236c93d95c8be4 (bu klasörde). Karekod belgenin sağ üst köşesinde, içerik JSON (§2.1, §2.2).

`karekod-edm.mjs`: programın API'siyle e-Fatura (2 × 500 %20 + 1 × 250 %10) ve e-Arşiv (1 × 300 %20) kaydedildi; programın PDF'i ve EDM'ye gönderildikten
sonra EDM'nin çizdiği RESMÎ PDF görüntüye çevrildi (pdftoppm 200 dpi) ve karekod programdan bağımsız çözücüyle (jsQR) okundu.
Sonuç (cikti.log): dört PDF'te de karekod okundu; konum sağ üst (soldan %80–82, üstten %4–10); okunan JSON ELLE hesaplanan tutarlarla birebir
(e-Fatura 1250.00 / 250.00+25.00 / 1000.00+200.00 / 1475.00; e-Arşiv 300.00 / 60.00 / 360.00), no/ETTN/tarih belgeyle aynı; resmî PDF'teki karekod
programın PDF'indekiyle aynı metin. GİB logosu resmî görüntüde "e-FATURA" başlığının üstünde (TEF…-resmi-sayfa-1.png).
