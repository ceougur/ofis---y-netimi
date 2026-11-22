# İzleyen tur 4 — S255 = A (rapor taslağı)

Taban 6a1d19d1 · dal worktree-agent-ad3ee8a705a609628 · not defteri `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3`.

## Adımlar ve sonuçlar
1. Taban doğrulandı (6a1d19d1); eski kod kopyası `izt4-ad3/eski` (git worktree --detach 6a1d19d1). v2.4.9 kodu `test/guvenilirlik/surumler.mjs` ile (git archive server/client/tools/package.json; ikinci
   worktree açılmadı — o anda disk 5,4 GB'tı, 5 GB sınırı).
2. Taban davranışı dar kontrolün betiğiyle (SC5 / SC7) yeniden üretildi — `izt4-kos/taban-sc57.txt` (bağlı 600 / 900 / 1.200: kart T0 / K600).
3. Tasarım notu §22 (koddan önce) — e85a39c2.
4. Kod + sınama 20bd65d5; ekran beb3019b; sınama eki c3187823; kanıt 8dbb125a; hız 4c1bdffe, d32aca83 (davranış aynı).
5. Sınama `test/izt4-s255-bagli-odeme-250.test.mjs` 17: yeni UTC 17/17, İstanbul 17/17; eski UTC 3/17, İstanbul 3/17 (14 kırmızı — 'kart penceresi Tahsil 0 / Kalan 600'; 3 yeşil bekçi).
6. Mutantlar (ayrı kopya): M1 13 kırmızı; M2 3; M5 3; M3 / M4 / M6 ilk sınamada yaşadı → B4a (kapatan + defter) ve B11 eklendi → üçü de kırmızı.
7. Ekran `senaryo-izt4-250`: yeni 21/21, eski 12/21.
8. v2.4.9 verisi: kartsız 4 sınıf FARK YOK; bakiye hiçbir sınıfta değişmedi; fark yalnız 'kart + bağlı ödeme' sınıflarında (`izt4-kos/v249-fark.md`).
9. Temiz 100 bin veride 1.484 carinin kuyruk sonucu eski = yeni (0 fark) — `izt4-kos/hiz/esdeger-fark.txt`.
10. Kâhinler iki TZ: cari 24.613 / 24.613 (0 fark), defter 187 / 187; yapım listesi 0 → 0.
11. Komşular (367 dosya): UTC 3.984 / 3.984; İstanbul — ilk koşu süre sınırında kesildi (495 üst düzey sınama, kırmızı yok), yeniden koşuluyor.
12. Hız: `izt4-kos/hiz/tablo-2.md` (3 tur, d32aca83) + kuyruk mikro ölçümü (848 kartlı cari, `mikro2-sonuc.txt`: en iyi 13.443,7 → 13.718,6 ms, ortanca 16.085,3 → 14.710,5 ms).
