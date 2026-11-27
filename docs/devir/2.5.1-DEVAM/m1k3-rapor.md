# M1 KÜÇÜK TUR 3 — KDV Özeti: yalnız satış KDV'si değişen devreden yönlü mahsuplu ay (S-M1K2-1 = A) — RAPOR TASLAĞI

Taban `t251-m1k2` (f2412ba9, küçük tur 2'nin dal ucu). PUSH YOK. Mahsup fişi, ön izlemesi ve defter DEĞİŞMEZ — yalnız Rapor Merkezi'nin KDV Özeti görünümü.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)
1. Devreden yönde (fiş 'sonraki döneme devreden' yazmış) yalnız 391 ARTIŞI, yön aynı kalır (kararın örneği: Mart 800 → 700; Nisan fişi 800'le kesilmiş) — sonraki aya bugünkü devreden
   taşınmazsa Mart–Nisan 391 − 191'den sapar; uyuşmazlık notu çıkmazsa kullanıcı onarımı bilemez.
2. Devreden yönde yalnız 391 AZALIŞI (devreden büyür: 800 → 900) — aynı kural ters işaretle.
3. Devreden yönde yalnız 391 artışı ödenecek yöne DÖNDÜRÜR (fiş devreden 800, bugün ödenecek 200) — sonraki aya 0 mı (bugünkü devreden) 800 mü (fişin) taşınır.
4. Ödenecek yönde yalnız 391 değişimi (yön aynı) — DEĞİŞMEMELİ (taşınan devreden zaten 0 = fişinki).
5. Ödenecek yönde yalnız 391 azalışı yönü devredene DÖNDÜRÜR (fiş ödenecek, bugün devreden) — kararın söylemediği durum: aralık toplamı 391 − 191'den sapıyorsa KODLANMAZ, sorulur.
6. Sonraki ayın fişi ESKİ devredenle kesilmiş (uyuşmazlık notu) / YENİ devredenle kesilmiş (onarımdan sonra; not yok, sayı aynı).
7. Arada mahsupsuz ay (Mart güncel değil → Nisan mahsupsuz → Mayıs fişli) — zincir mahsupsuz aydan bugünkü devredenle geçer; Mayıs fişi defterin devredeniyle uyuşmaz.
8. Yıl dönümü (Aralık fişi devreden, Aralık'a satış; Ocak'ta fiş) — Bu Yıl'ın 'Önceki Dönemden Devreden' satırı bugünkü devredeni gösterir.
9. İki şirket — bir şirketin değişikliği öbürünü etkilemez.
10. Aralık özetleri (Mart–Nisan, Bu Yıl, Tüm Zamanlar) = 391 − 191 (Ödenecek − Sonraki + Önceki); ay satırları; ekran = PDF = Excel.
11. 'Mahsup Edilmemiş Ay' 6 ay sınırı ve kopuk fiş notları DEĞİŞMEZ.
12. Karma ay ile birlikte (karma ay + sonraki ayda yalnız 391) — iki kural zincirde ardışık; her değişiklik bir kez.
13. İ arttı (güncel değil) devreden yönde — kararın kapsamı dışı ('YALNIZ satış KDV'si'); davranış DEĞİŞMEMELİ, sapma varsa sorulur.
14. S4 taşımalı karma (önceki fişli ayın azalması bu aya taşınmış + bu ayın 391'i değişmiş) — tek okuma mı.
15. A kipi (defter devredeni) — kural yalnız zincirde; A kipi DEĞİŞMEZ.
16. Ön izleme / fiş satırları / defter taban ile BİREBİR (iki TZ).
