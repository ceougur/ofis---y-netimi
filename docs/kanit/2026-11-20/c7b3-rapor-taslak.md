# Ç7b tur 3 — devam 2 ajanının rapor taslağı (adım adım büyür)

Görev metni: docs/devir/2.5.0-DEVAM/c7b3-devam2-istem.txt (+ c7b3-istem.txt, c7b3-devam-istem.txt). Taban `c7b3-devam2` = 7b6ec843 (doğrulandı). ESKİ KOD `c7b3-taban` = b85d9e27
(önceki ajanın kopyası scratchpad/c7b3-d2/taban — YALNIZ OKUNDU; yeni testlerin dosyaları orada HEAD'dekiyle bayt bayt aynı, kopyalama yapılmadı). Not defteri scratchpad/c7b3-d3.
Bu ajan ÜRÜN KODUNA DOKUNMADI (yapılmış işler önceki ajanların; burada son kodda kabul A–G baştan).

## 1. Turun testleri son kodda (7b6ec843), iki TZ + taban kırmızısı — kanıt c7b3-t1-*

| Test | yeni UTC | yeni İstanbul | taban UTC | taban İstanbul | tabandaki kırmızının nedeni (ileti okundu) |
|---|---|---|---|---|---|
| c7b-tur3-kart-250 | 9 / 9 | 9 / 9 | 1 / 9 (8 kırmızı) | 1 / 9 | (4) '06.11 kesilir (en önce gelen açık), 06.12 kalır' — taban sondan keser; faturasız iade '01.07'den küçülme; S216 'iade: karar (4) — 06.11 kesildi' adımı; S15 İptal Et 409 plan-has-payments; S206 / S210 'kart kapalı, tutar = tahsilat'; S217 iletisi; trim 'kart 400 küçüldü (tutar 0) ve kapandı'. Geçen 1 test: 'iade kalanı aşarsa fazlası avans; parası geri verilen iade kartı küçültmez' (davranış değişmedi — beklenen) |
| c7b-tur3-eski-surum-250 (v2.4.9 gerçek kodu) | 5 / 5 | 5 / 5 | 2 / 5 | 2 / 5 | S15 iptal 409; S210 'kart kapalı, tutar = tahsilat'; S217 iletisi regex eşleşmedi. Geçen 2: üreticinin doğruluğu + güncellemeden sonra aynen (beklenen) |
| ertelenen-224 (beklenti bilerek değişti) | 35 / 35 | 35 / 35 | — | — | tabanda test dosyası farklı (eski beklenti) — koşulmadı |
| obligation-input-250 (beklenti bilerek değişti) | 2 / 2 | 2 / 2 | — | — | aynı |
| tyk-birlesik8-ekranlar-250 (beklenti bilerek değişti) | 12 / 12 | 12 / 12 | — | — | aynı |
