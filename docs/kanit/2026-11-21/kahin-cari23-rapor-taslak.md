# Cari kâhini bakımı 23 — rapor taslağı (adım adım; kesilirse buradan sürdürülür)

Taban: `s229-uc` = 81e587b8. Girdi: `scratchpad/kahin-cari23-kararlar.md` (tek kaynak). Program kodu OKUNMADI (yalnız bağdaştırıcıyla kara kutu).

## Adımlar
1. [00:45] Yorum commit'i 3ac77c46 — KARARLAR.md §35 (Y23-1 … Y23-6), ders 40: önce kural.
2. [~01:10] Kara kutu yoklaması (d52 taslağı, `kos.mjs --mutasyonsuz`): programın fatura kartı yanıtında `open` (gösterilen), `ownOpen` / `inPlan` YALNIZ kartın aldığı kısım > 0 iken var;
   'Taksitte' belge durumu `status`'ta DEĞİL, ödeme durumu `payState` = "installment" ('Taksitte'); Faturalar listesi `GET /api/workspace/invoices` → `invoices[]` aynı alanlarla. Eşleme buna göre düzeltildi
   (`status` → `payState`; `inPlan` yokken `ownOpen` da yoksa kartın aldığı kısım 0).
3. Kod commit'i acda62f9 — eşleme, `kontrol_gosterilen`, S200 kolu (`_tyk`), d52 / d35 / d36 elle tabloları, mutantlar 329–333. Öz test 7.135/7.135 (koşu öncesi, not defteri).
4. Kanıt koşuları: (sürüyor)
