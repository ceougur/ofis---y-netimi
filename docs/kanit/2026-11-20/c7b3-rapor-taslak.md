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

## 2. Kabul A — defter kâhini (c7b3-abc-*)
`npm run test:kahin-defter`: taban (b85d9e27) UTC 187 / 187, İstanbul 187 / 187; yeni (7b6ec843) UTC 187 / 187, İstanbul 187 / 187 — 0 fark, 0 yakalanmayan mutasyon. Kırmızıya dönen denetim YOK.

## 3. Mutantlar (değerle; tek git worktree kopyası, her mutantta server/routes geri alınıp tek mutant; kart testi + eski sürüm testi (v2.4.9 gerçek kodu), iki TZ, İKİ koşu — c7b3-mut-*, c7b3-mut2-*)
| # | mutant | kart testi (iki TZ × 2 koşu) | eski sürüm testi | sonuç |
|---|---|---|---|---|
| 1 | küçülme son taksitten (eski yön) | 6 / 9 (3 kırmızı: '06.11 kesilir…', '01.07', 'iade: karar (4) — 06.11') | 5 / 5 | YAKALANDI |
| 2 | küçülme ödenmiş kısmı da keser | 6 / 9 | 5 / 5 | YAKALANDI |
| 3 | S15 iptali yine reddedilir | 7 / 9 | 3 / 5 | YAKALANDI |
| 4 | iptalde kartın tahsilatı silinir | 7 / 9 ('tahsilat carinin avansı') | 2 / 5 | YAKALANDI |
| 5 | kart küçültülmeden kapanır (kalan düşülür) | 6 / 9 | 2 / 5 | YAKALANDI |
| 6 | önceden kapatılmış tahsilatlı kartın faturası iptal edilir | 8 / 9 | 4 / 5 | YAKALANDI |
| 7 | kapsayan kart açık kalır (S206 trim yolu) | 8 / 9 ('kart 400 küçüldü (tutar 0) ve kapandı') | 5 / 5 | YAKALANDI |
| 8 | iptalde kapsayan kart küçülmez / kapanmaz | 6 / 9 | 4 / 5 | YAKALANDI |
Her mutant dört koşunun dördünde aynı sayıyla kırmızı (kararlı).
