# Cari kâhini bakımı 29 — rapor taslağı (S266 = A, S265 = C)

Dal: worktree-agent-a512c4c9a6a5549a7 (taban ud3-sinama = 35fbfe44). Kurallar: `test/bagimsiz/cari/KARARLAR.md` §41. Kanıt: `docs/kanit/2026-11-26/kahin-cari29-kanit/`.

## Özet
- S266 = A: yalın olmayan (KS8 / şüpheli / değersiz) caride bağsız Ödeme, kendi ANINDA açık olan alınan avansı kapatır. Alacak yönlü kalem yoksa iade geri ödemesi (K-b, KS8.1) bugünkü gibi önce, fazlası avansa; varsa avans ile Alacak tek vade sırası. Avans ↔ iade notu sırası iade geri ödemesini değiştirirse SUS (SK-54).
- S265 = C: tedarikçi + Alış İadesi + bağsız tahsilat + açık alış iadesi + aynı gün stok satışı / Alış İadesi → alış faturalarının açığı / gösterilen açığı SUS.

## Sayılar (iki TZ aynı)
| Koşu | Önce (taban kâhin) | Sonra |
|---|---|---|
| öz test | 9.357 (bakım 28) | 9.443 / 9.443 |
| G3 | — | 675 / 675, BEKLENMEYEN 0 (S266 284, SK54 12, S265 432, GENEL 4) |
| d61 elle (yeni kâhin) | — | 74 / 74 (ilk koşuda) |
| d61 eski kâhin kırmızısı | — | 50 / 74 kırmızı |
| program CI düzeni | 25.164 / 25.164 | 25.298 / 25.298 |
| program Uzun Doğrulama düzeni | 175.649 / 175.671 (22 fark) | 175.143 / 175.143 |
| yapım aşaması listesi | 0 | 0 (depodakiyle aynı) |

P listesi boş. SK-54 KULLANICIYA SORULMALI (öneri C — BİLİNEN SINIR).
