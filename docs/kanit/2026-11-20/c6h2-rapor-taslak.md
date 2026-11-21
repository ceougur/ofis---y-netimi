# Ç6-HESAP tur 2 — rapor taslağı (adım adım; kesilirse yeni ajan buradan sürdürür)

Taban c6h2-taban = 469a3d9b. Not defteri /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana (betikler: kahin.sh, hiz.sh + olc.mjs + hiz-hepsi.sh,
mutantlar.py + mutasyon.sh, kirmizi.sh, komsu-bul.sh + komsu.txt, yuk-a.sh, yuk-b.sh). Eski kod kopyası /dev/shm/c6h2-eski (git archive c6h2-taban).

## Adımlar
1. [x] Tasarım notu (docs/erp/C6-HESAP-TASARIM.md §6, §7, §8, §9, §10 B-d / B-e / B-f) — b21c0400.
2. [x] Bilanço hesabı + okuma ucu `GET /api/workspace/financial-statements/balance-sheet?date=` — dd3e93d5 (test/c6h-bilanco.test.mjs, test/c6h-bilanco-uc.test.mjs).
3. [x] Kesin Değil (Bilanço nedenleri: B-d mutabakat, Aktif ≠ Pasif, Kural Değişikliği Farkı) — dd865ecd.
4. [x] B-a — a105b993 (test/c6h-ba.test.mjs).
5. [x] S209 = B — f2e3aab9 (test/c6h-s209.test.mjs; test/c6h-degerleme.test.mjs beklentisi kararla değişti).
6. [ ] Bitiş: iki TZ, kırmızı kanıt, mutantlar (yuk-a.sh) → komşu + zorla + kâhin sonra (yuk-b.sh) → hacim (hiz-hepsi.sh, ÖZEL kilit; başka ajanın paylaşımlı yük kilidi bitince).

7. [x] d3b2da11 — brütleştirme hedef satırında kaynak adedi grup başına bir kez (sunum).

## Ara sonuçlar
- YÜK A (10:36–10:38 UTC, uç f2e3aab9; c6h2-yuk-a-ozet.log): yeni / değişen testler UTC 70/70, Europe/Istanbul 70/70 (kanit: c6h2-yeni-*). KIRMIZI (c6h2-taban kopyası, nedenler okundu):
  c6h-bilanco 1/1 kırmızı — "does not provide an export named 'balanceSheet'" (uç yok; diş mutantlarda) · c6h-bilanco-uc 8/8 — 404 "Endpoint bulunamadı." · c6h-ba 4/5 — DEĞERLE (aylar: Ocak 0 ≠ 24000,
  Aralık 26667 ≠ 2667; yıllık kesin testi eski kodda da yeşil — beklenen) · c6h-s209 3/3 — DEĞERLE (DSS −5000 ≠ 0; SMM 0 ≠ −5000; Bilanço testi "balanceSheet yok") · c6h-degerleme (yeni beklenti) 1/12 — −8000 ≠ 0.
  MUTASYON 15 mutant × 2 koşu (UTC, Europe/Istanbul) = 30/30 YAKALANDI (c6h2-mutasyon.log).
- YÜK B (10:39–10:57 UTC, uç d3b2da11; c6h2-yuk-b-ozet.log): yeni testler son uçta UTC 71/71, Europe/Istanbul 71/71 · G2 komşu (80 dosya, komsu-bul.sh) UTC 938/938, Europe/Istanbul 938/938 ·
  zorla bitir: ön koşul GERÇEKLEŞMEDİ, test YEŞİL 8/8 · zorla gozlem: ön koşul GERÇEKLEŞMEDİ, 7/8 — "dondurma 120000 ms'de bitmedi" (kanca kilit testindeki dondurmayı tutuyor; tur 1'in c6h-uc'si ile
  AYNI sonuç; açılış dondurmalı kurgu 2.5.1 — KULLANICI 20.11) · kâhin SONRA: defter 187 / 0 fark, cari 17253 / 0 fark (önceyle AYNI).
- HACİM (ÖZEL kilit; c6h2-hiz-*): geçerli koşu 10:58–11:05 (yük 0,5–1,4): Bilanço kilitsiz ortanca 4,66–4,75 sn, kilitli 6,22–6,81 sn (BÜTÇE AŞILDI → tasarım §10 B-g); olay döngüsü ≤ 27 ms;
  Gelir Tablosu önce / sonra %10'un altında. Hız düzeltmesi fe693f47 sonrası kilitsiz yinelemesi GEÇERSİZ (başlangıç yükü 4,35 — başka ajanın kilitsiz testleri; dosya adı -GECERSIZ-yuk), kilitli
  yinelemesi (yük 1,9 → 1,3) 6,50–6,79 sn ortanca, örnek sayılar ilk koşuyla AYNI (eşdeğerlik). Parça: c6h2-hiz-parca-2 (kilitsiz), c6h2-hiz-parca-kilitli (yük 2,0–2,4: tanı amaçlı).
- YÜK C (11:29–11:31, uç fe693f47): yeni testler iki TZ 71/71; mutasyon son uçta 30/30 YAKALANDI (c6h2-mutasyon-final.log).
6. [x] Bitiş tamam — rapor SubagentHandback ile.
- Kâhin ÖNCE (taban, 20.11 ~10:1x): defter 187 denetim 0 fark; cari 17253 denetim 0 fark (7 bilinen sınır), 0 yapım aşaması.
- Hacim ölçümü ilk denemede başka ajanın paylaşımlı yük kilidi (dk-t3duz eşdeğerlik koşusu) yüzünden başlamadı → yük parçaları önce, ölçüm sonra.
