# Ç6-HESAP tur 3 — rapor taslağı (adım adım; kesilirse yeni ajan buradan sürdürür)

Ağaç: agent-ab54e5fc492a09964 · taban c6h2-uc = 4b9d6c5e · not defteri /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana (betikler betik/)
Eski kod kopyası /dev/shm/c6h3-eski (git archive c6h2-uc); v2.4.9 kopyası /dev/shm/c6h3-v249 (git archive v2.4.9 = ccf0b0ca); kırmızı kopya /dev/shm/c6h3-kirmizi
(c6h2-uc + yeni test + YALNIZ yeni yardımcılar frozenSums / frozenPartOf — ders 51); 1 M veri /dev/shm/c6h3-1m/n-1000000 (2,8 GB; programın yolu tools/kapi-olcum.mjs --yalniz-kur).

## Adımlar
1. [x] Tasarım notu §8 "B-g (b) TASARIMI" + §10 B-g kararı — 051cf1bd.
2. [x] B-g (b) kodu + eşdeğerlik testi (test/c6h-esdegerlik.test.mjs) — a715cdd7. Ç6 testleri UTC 77/77, İstanbul 77/77.
3. [x] Hacim 100 bin (kanıt 00416203): yanıt özetleri eski ↔ yeni AYNI; kilitli Bilanço ortanca 7,1–8,0 → 5,5–6,2 sn; GT 4,1–4,2 → 3,5–3,7 sn; bütçe hâlâ aşılıyor; parça ayrıştırması
   (check() 3,5–4,0 sn, donmuş SQL 1,2–1,6 sn). Kilitsiz ilk koşu yeni önce → sıra ters YİNELENECEK.
4. [~] Hacim 1 M: veri üretildi (001 818.077 + 002 82.431 para satırı; Mutabakat Testi taban sapması yok); kilitsiz yeni ölçülüyor.
5. [x] Sınıf testi (74e420e3): 13 sınıf × 2 kip, 64 fark, hepsi karar numaralı; UTC + İstanbul geçti.
6. [ ] Mutantlar (47: tur 1 15 + tur 2 15 + tur 3 E 17) son kodda iki TZ; kırmızı kanıt (c6h3-kirmizi); dondurma zorlama bitir / gozlem.
7. [ ] Komşu (184 dosya) iki TZ; kâhin önce (c6h2-uc) / sonra.
