# İzleyen tur 4 — S255 = A (rapor taslağı; adım adım güncellenir)

Taban 6a1d19d1 · dal worktree-agent-ad3ee8a705a609628 · not defteri `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3`.

## Adımlar
1. Taban doğrulandı (6a1d19d1); eski kod kopyası `izt4-ad3/eski` (git worktree --detach 6a1d19d1). Disk 5,4 GB → v2.4.9 için ikinci worktree AÇILMADI (5 GB sınırı); v2.4.9 kodu
   `test/guvenilirlik/surumler.mjs` (git archive server/client/tools/package.json, önbellek) ile.
2. Taban davranışı dar kontrolün betiğiyle (SC5 / SC7) yeniden üretildi — `izt4-kos/taban-sc57.txt` (bağlı 600 / 900 / 1.200: kart T0 / K600).
3. Tasarım notu §22 (koddan önce) — commit e85a39c2.
4. Kod + sınama — commit 20bd65d5; ekran senaryosu — beb3019b; sınama eki (B4a kapatanlar + defter, B11) — c3187823.
5. Sınama `test/izt4-s255-bagli-odeme-250.test.mjs` 17: yeni kod UTC 17/17, İstanbul 17/17; eski kod UTC 3/17, İstanbul 3/17 (14 kırmızı, neden 'kart penceresi Tahsil 0 / Kalan 600';
   yeşil kalan 3 bekçi: B1 300, B1 bağsız 900, B9).
6. Mutantlar (ayrı kopya `izt4-ad3/mut`): M1 (sıra 3 tutulan yok) 13 kırmızı; M2 (defter bağlı ödeme kapsananı da kapatır) 3; M5 (defter 'fazla' düzeltmesi yok) 3; M3 / M4 / M6 ilk sınamada YAŞADI →
   B4a'ya kapatan + defter denetimi, B11 eklendi → M3 (kuyrukta yazım sırası yok) B4a kırmızı, M4 (sıra 4 koruması yok) B11 kırmızı, M6 (defterde yazım sırası yok) B4a kırmızı.
7. Ekran `test/e2e/senaryo-izt4-250.mjs`: yeni 21/21, eski 12/21.
8. v2.4.9 verisi (o sürümün gerçek koduyla) eski ↔ yeni sınıf karşılaştırması: kartsız 4 sınıf FARK YOK; bakiye hiçbir sınıfta değişmedi; fark yalnız 'kart + bağlı ödeme' sınıflarında — `izt4-kos/v249-fark.md`.
9. Mahsup Et (KULLANICIYA SORULMALI): eski = yeni (bu tur değiştirmedi) — `izt4-kos/mahsup-p9.txt`.
10. Komşular, kâhinler, hız: sürüyor (aşağıya eklenecek).
