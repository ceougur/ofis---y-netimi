# Cari kâhini bakımı 23 — rapor taslağı (adım adım; kesilirse buradan sürdürülür)

Taban: `s229-uc` = 81e587b8. Girdi: `scratchpad/kahin-cari23-kararlar.md` (tek kaynak). Program kodu OKUNMADI (yalnız bağdaştırıcıyla kara kutu).

## Adımlar
1. [00:45] Yorum commit'i 3ac77c46 — KARARLAR.md §35 (Y23-1 … Y23-6), ders 40: önce kural.
2. [~01:10] Kara kutu yoklaması (d52 taslağı, `kos.mjs --mutasyonsuz`): programın fatura kartı yanıtında `open` (gösterilen), `ownOpen` / `inPlan` YALNIZ kartın aldığı kısım > 0 iken var;
   'Taksitte' belge durumu `status`'ta DEĞİL, ödeme durumu `payState` = "installment" ('Taksitte'); Faturalar listesi `GET /api/workspace/invoices` → `invoices[]` aynı alanlarla. Eşleme buna göre düzeltildi
   (`status` → `payState`; `inPlan` yokken `ownOpen` da yoksa kartın aldığı kısım 0).
3. Kod commit'i acda62f9 — eşleme, `kontrol_gosterilen`, S200 kolu (`_tyk`), d52 / d35 / d36 elle tabloları, mutantlar 329–333. Öz test 7.135/7.135 (koşu öncesi, not defteri).
4. Kanıt koşuları (kos.sh; hepsi flock -s altında, ≤ 40 dk parça):
   - UTC temel (d6fd46b5): öz test 7.135/7.135 · G3 630/630 (BEKLENMEYEN 0; yeni 26.054 = GÖSTERİM-YENİ 25.985 + S200 51 + S200-E0 17 + S200-SK18 1; değişen / kalkan 0) · elle fark 105/105 · yeni elle 903/903 ·
     eski kâhin kırmızısı 85/532. (İlk temel koşusunda G3 1 BEKLENMEYEN — d52 adim:kp6b eski kâhinde SK-18 susmasıydı — ve elle farkta 2 izinsiz (desen h8x) → araç sınıfı / deseni düzeltildi d6fd46b5, yeniden koşuldu.)
   - İstanbul temel: aynı sayılar; G3 dökümü UTC ile bayt bayt aynı.
   - Program ↔ YENİ kâhin: UTC 21.673/21.673 fark 0, İstanbul 21.673/21.673 fark 0 (mutasyon taraması 0 YAKALANMADI).
   - Program ↔ ESKİ kâhin (bakım 22): 17.602/17.648 — 46 fark (16 fatura açığı, 15 acikToplam, 15 acikEsitBakiye).
   - Yapım aşaması listesi kendi kopyada yeniden üretildi: 0 kayıt (depodakiyle aynı).
5. KARARLAR §35 kod / kanıt bölümleri yazıldı (bu commit).
