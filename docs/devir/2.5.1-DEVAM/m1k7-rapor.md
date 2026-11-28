# KDV Özeti küçük tur 7 — rapor (taslak)

Taban: `t251-m1k6` (e99b6c95 — KDV Özeti küçük tur 6'nın dal ucu). Kapsam: tur 6 raporunun BAŞ MİMAR KARARI (1) — 'Zincirle Uyuşmayan Mahsup Fişi' notunun DEVREDEN FARKI
kolunda da onarım ayı kuralı. YALNIZ METİN: mahsup fişi, ön izleme, defter ve KDV Özeti'nin sayıları değişmez.

## 0. NASIL BOZULUR (koddan önce)
Eksen: devreden farkı kolu (fişin kullandığı devreden ≠ zincirin) × önceki ay durumu × önceki güncel olmayan fiş sayısı × yıl dönümü × fişin kesilme zamanı.
1. Önceki ay DEVREDEN yönde 'güncel değil' (S-M1K2-1 / S-M1K3-1: bugünkü devreden taşınır), sonraki ayın fişi eski devredenle → not 'güncel olmayan ilk aydan (Şubat 2026)'
   demeli; o adımlar uygulanınca not kalkmalı (tur 6 s5: D1 Mart'tan başlayınca kalmıyordu, D2 Şubat'tan başlayınca kalkıyordu; Ocak–Mayıs 2.400 = 391 − 191).
2. Önceki ay ÖDENECEK yönde 'güncel değil' (devreden 0 = 0 — çoğunlukla devreden farkı doğmaz); devreden farkı başka bir nedenle (mahsupsuz ay) doğarsa onarım ayı
   'güncel değil' aydan başlar (fazladan geri alma zararsız; not yine kalkmalı).
3. Önceki güncel olmayan fiş YOK (yalnız mahsupsuz ay — senaryo-kdv-zincir / kdv-ozeti-zincir 002): cümle AYNEN 'bu ayın ve sonraki mahsupları geri alıp …' — bozulmamalı.
4. İki 'güncel değil' ay: onarım İLKİNDEN (son değil — M2 mutantı).
5. Önceki zincirle uyuşmayan fiş (zincirleme devreden farkı: Şubat uyuşmuyor → Mart da): onarım ilk uyuşmayan aydan; tek uyuşmazlıkta (öncesiz) AYNEN.
6. Yıl dönümü: Aralık 2026 'güncel değil', Ocak 2027 fişi eski devredenle → '(Aralık 2026)' yılıyla; Bu Yıl (2027) aralığında not.
7. Fiş değişiklikten ÖNCE kesilmiş (sırayla doğru kesilmiş, sonra önceki ay değişti) / SONRA kesilmiş (ön izlemeyle): ikisinde de aynı not ve aynı onarım.
8. Aynı notta eksi yönlü (tur 6) + devreden farkı kalemi birlikte: onarım ayı ikisinin en eskisi (tek cümle) — iki onarım cümlesi yazılmamalı.
9. Eksi yön (tur 6) ve öbür yön (dar kontrol L) metinleri BOZULMAMALI; neden cümlesi ('… devredenle kesilmiş, sırayla mahsupta … olmalıydı') değişmemeli.
10. Aralık sonu notu: tek ay / kısmi aralıkta (aralık önceki güncel olmayan ayı içermiyor) da onarım ayı aralık dışındaki ayı adıyla söylemeli.
11. Saat dilimi: UTC ve İstanbul'da aynı metin; ekran = PDF (not başlığı; PDF kısaltır — tur 6 SONRAKİ SÜRÜME) = Excel (tam metin).
12. Sayılar: s2 üreteci taban ↔ yeni fark 0 (iki TZ); not farkı YALNIZ devreden kolunun onarım cümlesinde.
13. Hız: yeni sorgu yok; onarım ayı zincir adımında zaten tutulan aylardan (bellekte) bulunur.
