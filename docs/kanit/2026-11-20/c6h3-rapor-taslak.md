# Ç6-HESAP TUR 3 RAPORU (kabul + B-g (b)) — taslak (son hâli SubagentHandback'te)

Ağaç agent-ab54e5fc492a09964 · taban c6h2-uc = 4b9d6c5e · not defteri /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana · PUSH yok.

## Değişen gözlenebilir davranış: YOK
B-g (b) yalnız hız. Kanıt: (1) eşdeğerlik testi (yeni okuma ↔ c6h2-uc bileşimi deepStrictEqual; 6 aşama × 12 t × 11 dönem + saf işlev 3 kapsam); (2) AYNI veri kopyasında eski kod ↔ yeni kod
uçların tam JSON sha256'sı: 100 bin 13 istek × 2 kip (iki şirket) AYNI; 1 M 7 istek kilitli AYNI.

## Hız (ortanca / en iyi, ms; olay döngüsü en çok; başta yük < 2 olan koşular)
100 bin KİLİTLİ: Bilanço 31.12.2026 eski 7.990 / 7.348 → yeni 5.929 / 5.184; 30.06 7.864 / 7.416 → 6.151 / 5.267; 31.03 7.099 / 6.619 → 5.725 / 5.226; 31.12.2025 7.481 / 6.507 → 5.534 / 5.152.
  GT yıl 2026 4.114 / 3.617 → 3.680 / 3.044; Ç2 4.202 / 3.842 → 3.458 / 3.193; Ç3 4.165 / 4.038 → 3.454 / 3.326. Değerleme 961 → 763. Şirket 2 Bilanço 905 → 832, GT 673 → 579.
100 bin KİLİTSİZ (aynı kod yolu): eski önce koşu Bilanço 31.12 5.299 / 5.125 ↔ yeni (yük 2,27 — GEÇERSİZ) 5.874 / 5.529; ilk koşu (yeni önce) eski 5.477 ↔ yeni 6.049; aynı süreçte A/B
  balanceSheetOf ortanca 4.793 ↔ 4.846, en iyi 4.527 ↔ 4.527 (+%1).
1 M KİLİTLİ: Bilanço 31.12 eski 71.732 / 68.078 → yeni 59.792 / 58.391 (en kötü 69.549); 30.06 71.951 / 69.071 → 58.290 / 56.870; GT yıl 36.150 / 34.484 → 33.019 / 31.493; Ç3 37.036 → 32.026.
1 M KİLİTSİZ (yeni): Bilanço 51.668 / 49.694; GT 32.786 / 30.900; değerleme 8.307 (olay döngüsü 145 ms).
Parça (100 bin, yeni, kilitli): check() 3,45–4,05 sn · donmuş SQL 1,16–1,62 · değerleme 0,44–0,48 · Bilanço hesabı 0,12–0,17.

## Sınıf testi: 13 sınıf × 2 kip, 64 fark (K1 18 + K1/KG-16 A 6 + KG-11 A 12 + KG-11 A/S-06 12 + çekirdek §13 / kitap §5.1 12 + §3.11b 4).
## Mutantlar: 47 × 2 TZ = 94: 92 yakalandı (209e0610), E3 yaşadı → eksik test (102.NN) eklendi → 1dd224f1'de E3, E4 yakalandı.
## Komşu 184 dosya: UTC 2187/2187; İstanbul (sürüyor).
