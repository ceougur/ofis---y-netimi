# Ç6-HESAP tur 3 — rapor taslağı (adım adım; kesilirse yeni ajan buradan sürdürür)

Ağaç: agent-ab54e5fc492a09964 · taban c6h2-uc = 4b9d6c5e · not defteri /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana
Eski kod kopyası /dev/shm/c6h3-eski (git archive c6h2-uc); v2.4.9 kopyası /dev/shm/c6h3-v249 (git archive v2.4.9 = ccf0b0ca).

## Adımlar
1. [x] Tasarım notu §8 "B-g (b) TASARIMI" + §10 B-g kararı — commit 051cf1bd.
2. [x] B-g (b) kodu: `frozenSums` (ledger-snapshots.mjs sonu), `frozenPartOf` + `frozen` girdileri (financial-statements.mjs); eşdeğerlik testi test/c6h-esdegerlik.test.mjs
   (API verisi 6 aşama × 12 t × 11 dönem + saf işlev 3 kapsam) — commit a715cdd7. Yedi Ç6 testi + yeni test: UTC 77/77, İstanbul 77/77.
3. [ ] Hacim 100 bin: eski (c6h2-uc) ↔ yeni AYNI kopyada, kilitsiz / kilitli; yanıtların sha256 özeti karşılaştırılır (eşdeğerlik 100 binde).
   İlk deneme 13:56 GEÇERSİZ (başta yük 2,50 > 2) — durduruldu, betik iyileştirildi (2. şirket her tekrarda farklı gün), 14:03'te yeniden.
4. [ ] Hacim 1 M.
5. [ ] Eski sürüm sınıf testi: fikstür test/fixtures/c6h-v249 (üretici uret.mjs.txt — v2.4.9 gerçek kodu, 13 sınıf × kilitsiz / kilitli), test test/c6h-v249-sinif.test.mjs.
6. [ ] Durum ve sıra (iki şirket, yedek, aynı gün sırası) + mutantlar son kodda.
7. [ ] Komşu (G2), kâhin önce / sonra.
