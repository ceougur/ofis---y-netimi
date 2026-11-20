# Ç6-HESAP tur 2 — rapor taslağı (adım adım; kesilirse yeni ajan buradan sürdürür)

Taban c6h2-taban = 469a3d9b. Not defteri /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana (betikler: kahin.sh, hiz.sh + olc.mjs + hiz-hepsi.sh,
mutantlar.py + mutasyon.sh, kirmizi.sh, komsu-bul.sh + komsu.txt, yuk-a.sh, yuk-b.sh). Eski kod kopyası /dev/shm/c6h2-eski (git archive c6h2-taban).

## Adımlar
1. [x] Tasarım notu (docs/erp/C6-HESAP-TASARIM.md §6, §7, §8, §9, §10 B-d / B-e / B-f) — b21c0400.
2. [x] Bilanço hesabı + okuma ucu `GET /api/workspace/financial-statements/balance-sheet?date=` — dd3e93d5 (test/c6h-bilanco.test.mjs, test/c6h-bilanco-uc.test.mjs).
3. [x] Kesin Değil (Bilanço nedenleri: B-d mutabakat, Aktif ≠ Pasif, Kural Değişikliği Farkı) — dd865ecd.
4. [x] B-a — a105b993 (test/c6h-ba.test.mjs).
5. [x] S209 = B — f2e3aab9 (test/c6h-s209.test.mjs; test/c6h-degerleme.test.mjs beklentisi kararla değişti).
6. [ ] Bitiş: iki TZ, kırmızı kanıt, mutantlar (yuk-a.sh) → komşu + zorla + kâhin sonra (yuk-b.sh) → hacim (hiz-hepsi.sh, ÖZEL kilit; başka ajanın paylaşımlı yük kilidi bitince).

7. [x] d3b2da11 — brütleştirme hedef satırında kaynak adedi grup başına bir kez (sunum).

## Ara sonuçlar
- YÜK A (10:36–10:38 UTC, uç f2e3aab9; c6h2-yuk-a-ozet.log): yeni / değişen testler UTC 70/70, Europe/Istanbul 70/70 (kanit: c6h2-yeni-*). KIRMIZI (c6h2-taban kopyası, nedenler okundu):
  c6h-bilanco 1/1 kırmızı — "does not provide an export named 'balanceSheet'" (uç yok; diş mutantlarda) · c6h-bilanco-uc 8/8 — 404 "Endpoint bulunamadı." · c6h-ba 4/5 — DEĞERLE (aylar: Ocak 0 ≠ 24000,
  Aralık 26667 ≠ 2667; yıllık kesin testi eski kodda da yeşil — beklenen) · c6h-s209 3/3 — DEĞERLE (DSS −5000 ≠ 0; SMM 0 ≠ −5000; Bilanço testi "balanceSheet yok") · c6h-degerleme (yeni beklenti) 1/12 — −8000 ≠ 0.
  MUTASYON 15 mutant × 2 koşu (UTC, Europe/Istanbul) = 30/30 YAKALANDI (c6h2-mutasyon.log).
- Kâhin ÖNCE (taban, 20.11 ~10:1x): defter 187 denetim 0 fark; cari 17253 denetim 0 fark (7 bilinen sınır), 0 yapım aşaması.
- Hacim ölçümü ilk denemede başka ajanın paylaşımlı yük kilidi (dk-t3duz eşdeğerlik koşusu) yüzünden başlamadı → yük parçaları önce, ölçüm sonra.
