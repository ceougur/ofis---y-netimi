# M5 mobil yazma kâhini bakımı (29.10.2026) — kanıt dizini

Kâhinin bakımcısı (kodu görmeyen ajan) R1–R3 farklarını yalnız karar metinlerinden kapattı; ayrıntı ve kaynaklar `test/bagimsiz/mobil-yazma/README.md`
"BAKIM 29.10.2026". Her kayıt `tools/kanit.mjs kos` çıktısıdır (çıkış kodu + sayılar + ham günlük + commit). Platform linux, Node v22.22.0.

| Kayıt | Komut | Commit | Sonuç |
|---|---|---|---|
| `program-once` | `HUKUK_LICENSE_URL=http://127.0.0.1:9 npm run test:kahin-mobil-yazma` (tam, `--haric`'siz) | 412ea60 (bakımdan önce, temiz ağaç) | 49/54, çıkış 1 — E02 çifti + R1–R3 |
| `kahin-test-once` | `python3 -I test/bagimsiz/mobil-yazma/kahin_test.py` | 412ea60 | 143/143, çıkış 0 |
| `kirmizi-eski-kahin-412ea60-bolum-I` | yeni `kahin_test.py --bolum I`, ESKİ kâhin kopyasında (`git archive 412ea607` → not defteri `kahin-bakim-r123-eski-412ea60/`; ders 23). Kayıttaki commit çalışma ağacınındır, koşan kod eski kopyadır | 6753ee7 (ağaç) / 412ea60 (koşan kâhin) | 0/3, çıkış 1 — beklenen nedenle: "12,345" 400, cariye [403, 404], iki ihlalde ilk kod |
| `kahin-test-sonra` | `python3 -I test/bagimsiz/mobil-yazma/kahin_test.py` | 6753ee7 | 152/152, çıkış 0; mutasyon 59/59 |
| `program-sonra` | aynı program karşılaştırması (tam, `--haric`'siz) | 6753ee7 | 52/54, çıkış 1 — yalnız E02 çifti (BİLİNEN KÂHİN FARKI) |
| `program-ci-bicimi` | `npm run test:kahin-mobil-yazma -- --haric E02-es-havale-pos-mobil,E02-es-havale-pos-masaustu` (ci.yml'deki biçim) | 38353aa | 52/52, çıkış 0 |

Tohumlar kabul kümesinde sabittir (rastgele R1–R3 = tohum 1–3, 1.200 olay; kâhin testinde ek tohum 4, 5.000 olay). Programın kodu ve `program.json*` çıktıları okunmadı;
yalnız karşılaştırmanın TAP / fark satırları okundu.
