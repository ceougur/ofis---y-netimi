# Cari kâhini bakımı 24 — rapor taslağı (adım adım; kesilirse buradan sürdürülür)

Taban: `de403915`. Girdi: `docs/devir/2.5.0-DEVAM/kahin-cari24-kararlar.md` (tek kaynak). Program kodu OKUNMADI (yalnız bağdaştırıcı ve yoklama betikleriyle kara kutu).
Ortam (başlangıç 10:2x UTC): yük 0,07 / 4 çekirdek, bellek boş ~14 GB, disk boş 8,6 GB.

## Adımlar
1. [10:2x] Kara kutu yoklaması (yalnız eşleme): `yokla1.mjs` (plan uçlarının varlığı — oturumsuz 404 / 401 / 405 ayrımı; `PUT /plans/:id {status}`), `yokla3.mjs` (Kartı Kapat / iade / Yeniden Aç / iade iptali /
   fatura Düzenle). Çıktılar `kahin-cari24-kanit/kahin-cari24-yokla{1,3}.log`. Kapanış günü gövdeden verilemiyor (sunucunun bugünü); kesilmiş fatura Düzenle 409 `invoice-not-draft`.
2. [10:35] Yorum commit'i — KARARLAR.md §36 (Y24-1 … Y24-9, SK-42 … SK-44), ders 40: önce kural.
