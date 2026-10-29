# Kanıt — 29.10.2026

| Kayıt | Commit | Sonuç | Not |
|---|---|---|---|
| `kahin-mobil-yazma.{json,log}` | 2f7cb314 | BAŞARISIZ 135/136 (çıkış 1) | Tek kırmızı **H2** — TESTİN kendi hatası, kâhin değil (ders 6: kök neden): H2 cari kâhininin `/3` senaryolarını yalnız 2.4.6 kipinde taradı; cari `KARARLAR.md` C10b "Mutasyon taraması `/3` dosyalarını HER kipte iki kural setiyle (2.4.6 + 2.4.5)" ister ve mutant 99 yalnız 2.4.5 kipinde anlamlıdır. H2 iki kiple düzeltildi; mobil kâhinin bütün öbür testleri (A–G, H1) yeşildi. |
| `kahin-mobil-yazma-son.{json,log}` | 2ecad44c | GEÇTİ 136/136 (çıkış 0) | H2 düzeltmesinden sonra; cari kâhini 141/141 mutant |
| `kahin-mobil-yazma-teslim.{json,log}` | cf0f0411 | GEÇTİ 136/136 (çıkış 0) | TESLİM koşusu (bütün kod ve kabul.json bu commit'te; sonraki commit'ler yalnız kanıt). Fark iletisinde akış beklentisi 'akış' diye anılır |
| `kahin-cari-mevcut.{json,log}` | cf0f0411 | GEÇTİ 7.408/7.408 denetim (çıkış 0) | MEVCUT cari kâhininin program karşılaştırması (`npm run test:kahin-cari`, HUKUK_LICENSE_URL yerel — ders 30): 39 senaryo, 0 fark, 7 bilinen sınır (BILINEN.json b3y), 0 yakalanmayan mutasyon, 12 atlanan (2.4.5 kararıyla geçersiz). Programın kodu okunmadı, yalnız koşuldu |

Komut: `KANIT_DIR=test/bagimsiz/mobil-yazma/kanit node tools/kanit.mjs kos <ad> -- python3 -I test/bagimsiz/mobil-yazma/kahin_test.py` (depo kökünden).
Bilerek kırmızı kanıt: `../kirmizi/2026-10-29/`.
