# KDV Özeti küçük tur 6 — rapor (taslak; adım adım yazılır)

Taban: `t251-m1k6-taban` (d3f22e6c). Kapsam: tur 5 dar kontrolünün ORTA-1'i (YALNIZ METİN) — karar (1)(a)–(d). Sayılar DEĞİŞMEZ.

## 0. NASIL BOZULUR (koddan önce)

Eksenler:
- **Uyuşmazlığın yönü** (devredeni aynı, S4 emilimi farklı olan fiş): (E) zincir emilimi fişinkinden EKSİ — önceki 'güncel değil'
  (İ artmış) ay zincire bugünkü İ'siyle girdi, fiş saklı İ'lerle kesildi → fiş azalmayı DÜŞMEMİŞ; (A) zincir emilimi fişinkinden ARTI
  (dar kontrol L — araya giren mahsupsuz ay azalmayı zincirde zaten düştü) → metin AYNEN kalmalı. Karışık: aynı raporda biri E biri A.
- **Fişin kesilme anı**: değişiklikten SONRA ön izlemeyle (A1) / değişiklikten ÖNCE sırayla doğru (B0 — ödenmiş, doğru fiş 'uyuşmuyor' görünür).
- **Onarım yolu**: notun söylediği yol uygulanınca not KALKMALI ve rapor = fişler = 391 − 191. Yalnız bu ayı geri al (A2 — sonuç vermez,
  bugünkü metin bunu söylüyor) / 'güncel değil' ilk aydan başlayarak geri al + sırayla (A3 / B2 — sonuç verir).
- **Onarımın ay adı**: güncel olmayan İLK ay (Şubat); iki 'güncel değil' ay varsa ilki; 'güncel değil' ay yıl önceyse (Aralık 2026) yıl adıyla;
  yanlış ay (uyuşmayan ayın kendisi / son 'güncel değil') = hata.
- **Aralık**: tam (Ocak–Nisan) / tek ay (Nisan) / 'güncel değil' ayı DIŞARIDA bırakan kısmi aralık (Mart–Nisan) / 'güncel değil' ayı içeren
  aralık (Şubat–Nisan — kısa not ÇIKMAZ, ayın kendi notu var) / 'güncel değil' ay aralık dışında ama aralığı ETKİLEMİYOR (yalnız 391'i değişen,
  ödenecek yönde kesilmiş ay; ya da aradaki fiş zinciri sıfırlıyor) → kısa not ÇIKMAZ (gereksiz not da hata) / yıl dönümü (Bu Yıl, önceki yılda
  'güncel değil' ay) / Tüm Zamanlar (başı yok → kısa not yok).
- **Saat dilimi**: TZ=UTC ve TZ=Europe/Istanbul.
- **Ekran = PDF = Excel**: yeni not satırı ve değişen uyuşmazlık metni üçünde aynı (ders 11).
- **Sayılar**: hiçbir aralıkta sayı değişmez (rastgele üreteçte taban = yeni); hız: yeni SQL yok (ders 47).
