# R4 / R5 — ana oturumun kendi kırmızı/yeşil koşusu (10.10.2026)

Testler eksik test turu dalından (`worktree-agent-a9996cccca67b1040`); her koşu `tools/kanit.mjs kos` ile, kayıtlar `2026-10-10/` altında
(JSON + ham çıktı). Komut: `node --disable-warning=ExperimentalWarning --test test/<dosya>.test.mjs` (Linux, Node v22.22.0).

| Test | Kod | Hüküm | Başarısızlık nedeni (ham çıktıdan) |
|---|---|---|---|
| iade-210-fazla-tahsilat (R5) | 9340b9c (düzeltmeden önce) | BAŞARISIZ 0/1 | kartın kalanı 1000, beklenen 1500 |
| iade-210-fazla-tahsilat (R5) | 326b87b (düzeltme) | GEÇTİ 1/1 | — |
| iade-210-fazla-tahsilat (R5) | v2.0.26 (5346ff8) + test dosyası | BAŞARISIZ 0/1 | kartın kalanı 1000, beklenen 1500 → canlıda VAR |
| iade-210-fazla-tahsilat (R5) | v2.0.23 (58798e9) + test dosyası | GEÇTİ 1/1 | → 2.0.24 G1 düzeltmesiyle gelmiş (ajan beyanıyla tutarlı) |
| sirket-yedek-klasor-210 (R4) | f241559 (düzeltmeden önce) | BAŞARISIZ 0/1 | B'nin yeni yedek klasörü silinmiş A'nınki (`005 - Işık Turizm`) |
| sirket-yedek-klasor-210 (R4) | af83d46 (düzeltme) | GEÇTİ 1/1 | — |
| sirket-yedek-klasor-210 (R4) | v2.0.26 + test dosyası | BAŞARISIZ 0/1 | aynı neden → canlıda VAR |
| sirket-yedek-klasor-210 (R4) | v2.0.23 + test dosyası | BAŞARISIZ 0/1 | aynı neden |

Sınır: R4 büyük/küçük harf duyarlı dosya sisteminde görünür (Linux). Müşteriler Windows'ta (NTFS büyük/küçük harf duyarsız); Windows'ta
etkisi bu koşuyla ÖLÇÜLMEDİ — test dalı birleşince CI'nin Windows işi aynı testi koşacak. Düzeltmeler henüz ana dala birleşmedi.
