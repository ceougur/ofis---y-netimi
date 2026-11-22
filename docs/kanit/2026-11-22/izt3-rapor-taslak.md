# İzleyen tur 3 — rapor taslağı (adım adım)

Taban 3b420085 (izt3-taban). Dal worktree-agent-ae8c8568d72566f15. Push yok.

## Adım 1 — tasarım §21 (koddan önce) — 4c86c710
- §21.1 rowid yeniden kullanımı; §21.2 stok iadesinde canlı yenileme; §21.3 Nasıl bozulur?

## Adım 2 — İş 1 sınaması (koddan önce) — b46e08ef; kod — 6d6d4145
- Kod: `server/lib/integrity-scope.mjs derive` — son hâli bu işlemde store ile EKLENMİŞ rowid'de (capture.inserted) kimlik farkı = silinen + eklenen iki satır. Eklenmemiş rowid (UPDATE SET id) bugünkü gibi "kimlik değişti" → tam kapı.
  Önceki turun prototipinden farkı: prototip her kimlik farkını bölüyordu; burada yalnız eklenmiş rowid (güvenlik çekirdeğinde en dar gevşetme). Yalnız okuyan yardımcı yok.
- Sınama `test/izt3-kapi-rowid-250.test.mjs` 14 test (iki kip × 6 + bulanıklaştırma 2):
  - Yeni kod: UTC 14/14, Europe/Istanbul 14/14 (`izt3-kos/is1-yeni-*.txt`).
  - Eski kod (3b420085): iki TZ 12/14. Kırmızı 2 = P1 (üretim + test kipi), ileti: `hiçbir COMMIT 'kimlik değişti' ile tam kapıya düşmez: [["full(stock_moves: kimlik değişti)"] ×3]` — beklenen neden.
  - Yakalama sınamaları (Y1–Y4, K1–K5, D1–D4) ve bulanıklaştırma ESKİ kodda da yeşil (tasarım gereği: davranış aynı kalmalı); dişleri mutantla:
    - m1 (kimlik değişimi hiç sayılmaz): 3 kırmızı — K3/K4 (üretim: K4 yolu "full(bulgu: bank:event)"), bulanıklaştırma tohum 31 (4 eşdeğerlik ihlali), tohum 37 kilitli (68 ihlal; çoğu period-lock).
    - m2 (eklenmemiş rowid de bölünür = prototip): 1 kırmızı — K4 D8 bekçisi.
  - Bulanıklaştırma sayıları eski = yeni: tohum 31 135/160 aynı rowid, kabul 89, ret 46; tohum 37 (kilitli) 144/160, kabul 25, ret 119; eşdeğerlik ihlali 0.
- Eski ↔ yeni EŞDEĞERLİK dökümü (`izt3-kos/kapi.mjs`, 14 senaryo, her biri taze sunucu): üretim ve test kipinde 14/14 sonuç birebir aynı (durum, 409 kodları, tarama bulguları, sayılar); değişen yalnız kapı yolu:
  eski üretim {stock_moves kimlik değişti ×3, cash_entries kimlik değişti ×2}, yeni {scoped ×4 (Düzenle ×3), full(bulgu: bank:event) ×1, cash_entries kimlik değişti ×1 (K4 — D8 aynen)}.
