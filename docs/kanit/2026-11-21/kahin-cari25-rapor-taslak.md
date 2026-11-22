# Cari kâhini bakımı 25 — rapor (taslak; son hâli SubagentHandback ile)

Ayrıntı: `test/bagimsiz/cari/KARARLAR.md` §37. Kanıt: `docs/kanit/2026-11-21/kahin-cari25-kanit/`, araçlar `docs/kanit/2026-11-21/kahin-cari25-arac/` (`kos.sh utc|ist temel|program|program-eski|yapim|put`).

- Düzenle eşlemesi: `fatura_duzenle` → `POST /api/workspace/invoices/:id/edit` (gövde ayrıntıdan; `payment.rest` = ayrıntının `payment.mode`'u — ayrıntıdaki `rest` tutardır). Eski PUT ucu kesilmişte 409 (bağdaştırıcı mutantı `KAHIN_DUZENLE_UC=put`: d57 197/258).
- Önceki 38 Düzenle kaydı: 38'i de KAPANDI (program Düzenle'yi yapıyor, değerler kâhinle aynı).
- Yeni kurallar: S238 (senaryo — kapanmış kart), S239, S240, S241, S242, §3 + SUS SK-45 / SK-46 / SK-47. Elle 530 denetim (d56 359, d57 171).
- Öz test 8.298/8.298 (iki TZ), mutant 147/147 (341–347 DEĞERLE), G3 654/654 (BEKLENMEYEN 0).
- Program ↔ kâhin (eski liste) 23.976/24.062 iki TZ (86 fark aynı); yeni listeyle 24.014/24.029 (15 P + 33 Ç7b).
- Yapım aşaması: 38 → 33 (kapanan 38, yeni 33 — Ç7b: S241 azaltma 5, §3 28; değişen 0).
- Eski kâhin kırmızısı: 124/530 elle denetim; program ↔ eski kâhin 945/1.021.
- P-1 (S239 çok kalemli S200 kartı, d56 Q1), P-2 (S242 taksitli fatura, d57 P1).
- KULLANICIYA SORULMALI: SK-45, SK-46, SK-47 (UÇ); P-1 / P-2 soruları gerekirse.
