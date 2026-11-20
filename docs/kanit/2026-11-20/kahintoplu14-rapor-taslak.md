# Toplu kâhin bakımı 14 (muhasebe 14 + cari 22) — rapor taslağı (adım adım)

- Adım 0 (hazırlık): `git reset --hard kahin-toplu14-taban` → 15f023f1; muhasebe son bakım e779340f (bakım 13), cari son bakım a52d2768 (bakım 21b) — doğrulandı. node_modules bağı kuruldu.
  Eski kâhin kopyası (değişiklikten ÖNCE): `scratchpad/kahintoplu14-eski/` (git archive HEAD test/bagimsiz/muhasebe test/bagimsiz/cari).
- Adım 1 (yorum commit'i e75937dc, ders 40): muhasebe README "Kâhin bakımı 14" (İ1–İ9, KULLANICIYA SORULMALI 1–3), cari KARARLAR "§34 bakım 22" (Y22-1 … Y22-5).
  Önemli bulgu: A1 (S200) bakım 13'te KURULMAMIŞTI (kâhin SUSUYORDU — README bakım 13 Ü21 + KS 1) → bu bakımda kurulur.
- Adım 2 (senaryo + test commit'i cccba81f, model değişmeden ÖNCE): muhasebe s118–s121, s58 C2, Bakim14 (6 test), bakım 13 test_A7'nin susan örneği; cari d51 (yeni), d50 I2 / I3.
  Eski kâhinle hızlı koşu: muhasebe 223 testten 12 kırmızı (hepsi beklenen nedenle — S120 susması, S210 / S213 / S220 yok); cari d50 + d51 105 denetimden 36 kırmızı (hepsi SK-41 alanı).
- Adım 3 (model commit'i 54ec97d3): muhasebe ilk koşuda 223/223 (yalnız Dosyalar — beklenen yeniden yazıldı); G3 63.204/63.204 BEKLENMEYEN 0 (A2-S210-S211 19 — yalnız s58; YENI 8). Cari d50 + d51 105/105.
- Adım 4 (39aa0612): mutasyon.py MUTASYON_ARALIK + kos.sh. Kanıt koşuları başladı: utc temel.
- Adım 5 (UTC temel, commit 39aa0612): muh-test 223/223; muh-eski-kirmizi 12/223 kırmızı (beklenen nedenle); muh-g3 63.204/63.204 (A2-S210-S211 19, YENI 8); muh-yeni-mutantlar 16/16 öldü;
  cari-oz 6.936/6.936; cari-mutasyon 295/295; cari-g3 625/625 (59 fark: S210-S211 kalkan 15 / yeni 40, GENEL yeni 4; BEKLENMEYEN 0); elle-yeni 105/105; kirmizi-eski 36 kırmızı (beklenen); elle-fark 104/104;
  g1-tara 105/105; mutant-senaryo 1.224/1.224; genis-tarama geçti; ozet-tara yazıldı. Sırada: IST temel, mut1 / mut2 × iki TZ.
- Adım 6 (IST temel, commit 320a86dd): bütün sayılar UTC ile aynı (muh 223/223, eski kırmızı 12, G3 63.204, yeni mutant 16/16; cari oz 6.936, mutasyon 295, G3 625, elle 105, eski kırmızı 36, fark 104, g1 105, mutant ↔ senaryo 1.224, geniş tarama 2.201/2.201); G3 dökümleri ve özet taraması iki TZ'de bayt bayt aynı.
- Adım 7 (UTC mutasyon, commit d05bcb6d): mut1 (0:165) 165/165 öldü, mut2 (165:330) 165/165 öldü → 330/330 (temel 217 test yeşil).
