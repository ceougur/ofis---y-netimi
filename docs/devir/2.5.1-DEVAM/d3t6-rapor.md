# D3 TUR 6 — rapor taslağı (adım adım yazılır)

Taban: t251-d3t6-taban = d183d780 (doğrulandı: `git log --oneline -1` → d183d780 Merge branch 't251-sinama-3').
Görev: ORTA-1 — eski sürümde (2.0.13 öncesi) kapatılmış taksit kartı devir planında 'açık' sayılıyor; okuyucu kartın kapanış gününü programın tanımıyla okusun.

## 0. NASIL BOZULUR (koddan ÖNCE)
Kartın kapanış bilgisinin her biçimi (kapanış günü = programın tanımı `MAX(COALESCE(closed_at, substr(updated_at, 1, 10)), Kayıt Tarihi)`):
1. `closed_at` BOŞ (2.0.13 öncesi kapatılmış; göç 17 geriye doldurmadı) × kapanış (son güncelleme günü) K ÖNCESİ → K'de KAPALI olmalı (bulgu: planda AÇIK, kalan 700).
2. `closed_at` BOŞ × son güncelleme günü = K günü → K'de KAPALI (sınır: `<=` K).
3. `closed_at` BOŞ × son güncelleme günü K SONRASI (kart K'den sonra kapatılmış) → K'de AÇIK, kalan devreder (yedek "tarihsiz" okunursa yanlışlıkla kapalı sayılır).
4. `closed_at` DOLU (2.0.13+) × K öncesi / K günü / K sonrası → bugünkü davranış AYNEN (düzeltme bunu değiştirmemeli).
5. `close_rule` '2.4.9' (kalan silinir — göç 53 eski kapalı kartlara yazar) × Borçta Kalsın (2.5.0+; `closed_at` her zaman dolu) → kalanın carinin borcunda kalıp kalmaması (plan.mjs `kart-kalani`) değişmemeli.
6. Carili × CARİSİZ kart: carisiz kapalı kartın kalanı 127'ye 'cover' edilir; kapalı sayılmazsa 700 beklenir, defterde 0 → sebepsiz 'Hesap Bakiyesi Modülle Tutmuyor' durdurması (dar kontrolün DOĞRULANMADI maddesi). Carisiz kart program API'siyle (v2.0.6'dan beri her kart cariyle açılır; kartı olan cari silinmez) üretilebilir mi — ölçülecek.
7. Kayıt Tarihi kapanış gününden SONRA (kart geriye dönük açılıp eski güncelleme günüyle) → kapanış günü Kayıt Tarihi'ne çekilir (MAX); Kayıt Tarihi > K ise kart planda zaten yok.
8. Faturası iptal edilmiş kapalı kart (program `closed_at = bugün` yazar) ve Borçta Kalsın ile kapanmış kart → `closed_at` dolu, madde 4.
9. Veri kaynağı: v2.0.12 GERÇEK kodu (closed_at sütunu yok), v2.4.9 ve v2.5.0 (closed_at dolu) — eski sürümden gelen veri, sonra yeni kodla açılış (göç).
10. Saat dilimi: `updated_at` UTC anı; program günü `substr(…, 1, 10)` (UTC günü) alır — devir de aynı ifadeyi kullanmalı (iki TZ'de aynı sonuç).
11. Ön izleme sayıları (`sayilar.taksitKarti` açık / kalan / kapalı), Devir Raporu satırları ('n açık (… TL) · m kapalı', 'Kalan n Taksit'), carinin devir satırı ve 127 karşılığı birlikte.
