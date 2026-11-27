# M1 KÜÇÜK TUR 4 — KDV Özeti: her 'güncel değil' ayında sonraki aya bu ayın bugünkü devredeni (S-M1K3-1 = A) — RAPOR (TASLAK)

Taban `t251-m1k3` (36b77d4b, küçük tur 3'ün dal ucu) → dal ucu: bu raporun son commit'i. PUSH YOK. Mahsup fişi, ön izleme ve defter DEĞİŞMEZ — yalnız KDV Özeti'nin gösterimi.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)
1. (a) Ödenecek yönde kesilmiş fişli ay YALNIZ satış KDV'sinin azalmasıyla devredene döner → sonraki aya bugünkü devreden (300) taşınmalı; Nisan Önceki 300 / Ödenecek 0 / Sonraki 100,
   Mart–Nisan 0 / Sonraki 100 (= 391 − 191) + Nisan satırında 'Zincirle Uyuşmayan Mahsup Fişi' (yön farkı cümlesiyle).
2. (b) Devreden yönde kesilmiş fişli ayda İndirilecek KDV ARTAR (geç gelen alış) → sonraki aya bugünkü devreden (900); Nisan 900 / 100, Mart–Nisan 100 + not.
3. (c) İkisi birden aynı ayda (İ artar + 391 azalır / artar) — 'güncel değil'; sonraki aya bugünkü devreden; aralık = 391 − 191.
4. Ödenecek fişli ay ödenecek KALIR (391 artar ya da İ artar ama ödenecek kalır) → taşınan 0 = fişin 0'ı; DEĞİŞMEZ olmalı (sayılar tabanla aynı).
5. Fişli ay 'güncel' (değişmemiş) ya da yalnız İ azalmış (S-DKM1-1 = A) → fişin devredeni taşınır; DEĞİŞMEZ (bugünkü devreden taşınırsa azalma iki kez sayılır).
6. Karma ay (S-M1K-1 = A) — DEĞİŞMEZ.
7. Araya mahsupsuz ay (Mart güncel değil → Nisan mahsupsuz → Mayıs fişli): Nisan zincirle, Mayıs uyuşmazlık notu.
8. Yıl dönümü (Aralık / Ocak; Bu Yıl ön ayarı).
9. İki ardışık 'güncel değil' ay (Mart ve Nisan ikisi de fişten sonra değişmiş): ikinci ayın fişi zincirle uyuşmuyorsa ay zincirle hesaplanır; aralık = 391 − 191.
10. Geri al + sırayla yeniden mahsup (onarım) sonrası rapor = fişler (notlar kalkar).
11. Ön izleme / fiş satırları tabanla birebir (yalnız rapor görünümü değişir); ekran = PDF = Excel; iki şirket ayrı; iki saat dilimi.
12. S4 etkileşimi: 'güncel değil' ayında İ artışı sonraki aylara S4 taşıması olarak İKİNCİ kez geçmemeli (artış min(0, …) ile taşınmaz; devredenle bir kez).
