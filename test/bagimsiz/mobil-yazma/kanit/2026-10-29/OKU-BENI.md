# Kanıt — 29.10.2026

| Kayıt | Commit | Sonuç | Not |
|---|---|---|---|
| `kahin-mobil-yazma.{json,log}` | 2f7cb314 | BAŞARISIZ 135/136 (çıkış 1) | Tek kırmızı **H2** — TESTİN kendi hatası, kâhin değil (ders 6: kök neden): H2 cari kâhininin `/3` senaryolarını yalnız 2.4.6 kipinde taradı; cari `KARARLAR.md` C10b "Mutasyon taraması `/3` dosyalarını HER kipte iki kural setiyle (2.4.6 + 2.4.5)" ister ve mutant 99 yalnız 2.4.5 kipinde anlamlıdır. H2 iki kiple düzeltildi; mobil kâhinin bütün öbür testleri (A–G, H1) yeşildi. |
| `kahin-mobil-yazma-son.{json,log}` | 2ecad44c | GEÇTİ 136/136 (çıkış 0) | H2 düzeltmesinden sonra; cari kâhini 141/141 mutant |
| `kahin-mobil-yazma-teslim.{json,log}` | teslim commit'i (kayıtta) | kayıttaki gibi | Fark iletisinde akış beklentisi 'elle' yerine 'akış' diye anılır (yalnız ileti) |

Komut: `KANIT_DIR=test/bagimsiz/mobil-yazma/kanit node tools/kanit.mjs kos <ad> -- python3 -I test/bagimsiz/mobil-yazma/kahin_test.py` (depo kökünden).
Bilerek kırmızı kanıt: `../kirmizi/2026-10-29/`.
