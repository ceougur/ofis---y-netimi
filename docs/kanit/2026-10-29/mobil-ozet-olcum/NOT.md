# 2.4.7 mobil özet hız ölçümü (29.10.2026)

Kullanıcı isteği: "hız testi falan yaptık mı?" → "uzun doğrulama bitene kadar yapalım, önerini uygula". Ayrıntı ve karar: docs/2.4.7-IS-LISTESI.md "MOBİL ÖZET ÖLÇÜMÜ", CLAUDE.md KARAR 29.10 ~20:40.

Ortam: linux x64, 4 çekirdek, 16 GB, Node v22.22.0; ölçümler tek tek (flock /tmp/destekofis-olcum.lock, ders 15); her ölçüm aynı veri kopyasının taze kopyasında.

## Veri (programın kendi API'si; ders "test verisi programın kendi verisi")
`node tools/olcek-210.mjs --asama veri --islem-002 0 --klasor <not defteri>` (dc70b634'teki araç düzeltmesiyle: legacyCasePayments/legacyTableTransfer açık):
001 100.084 para satırı (3.000 cari, motor tohum 2101 × 2000 uyuşmazlık 0 + doldurma), 002 12.138 satır (veri2.log). 002 motoru atlandı:
ilk denemede (veri.log) 002 tohum 2102'de kronoloji farkı — bağımsız ajan + ana oturum: motor modeli yıl bilmiyor, ÜRÜN HATASI DEĞİL (iş listesi
"MOBİL ÖZET ÖLÇÜMÜ YAN BULGUSU"; tohum2102-tek.log tek şirkette temiz).

## Betik
`mobil-ozet-olcum.mjs.txt` (not defterinde .mjs): GERÇEK program + yerel kapıcı (createKapi) + sahte lisans servisi (dış istek yok).
A özetsiz masaüstü (60 sn; olcek10 Muhasebe), B1/B3 1 ve 3 kullanıcı özet (×3), C özet art arda hazırlanırken masaüstü (60 sn, en kötü durum),
D telefon (kapıcıdan özet okuma + çözme, canlı giriş, canlı uçlar), E özet bölümlerinin boyutu.

## Koşular
| Dosya | Kod | Not |
|---|---|---|
| olcum.log / sonuc.json | 03e0f55a öncesi (a3a5f814) | B3'te 413 kapi-buyuk ile durdu; masaüstü "cariHareketleri" yanlış uç (405) — o sütun GEÇERSİZ (ders 3) |
| olcum2.log | a3a5f814 | düzeltilmiş betik: B3 3/3 413, C masaüstü p95 ~10 sn, E /api/mobil/cash 13.011.717 B |
| olcum-kasa-deneme.log | deneme (yalnız Kasa dönüşümü) | özet 450 KB / 1,35 MB; C hâlâ ~10 sn |
| olcum-profil.log / sonuc-profil.json | deneme | CPU profili: kesintisiz 10–11 sn, accounts.mjs detail/list |
| olcum-deneme2.log | deneme (Kasa + setImmediate) | C p95 159–435 ms |
| olcum-son.log / sonuc-son.json | 03e0f55a (son kod) | B1 450.372 B 3,2–3,7 sn; B3 1.348.161 B ~10 sn, 3/3 ok; C p95 172–393 ms, en çok 1,6 sn; telefon Kasa 341 B |

Not: D'deki "/api/workspace/accounts" 404 betiğin yanlış yolu (telefon /api/mobil/accounts kullanır); özetin iç isteği etkilenmez.

## Kalıcı test (ders 7, 23, 38)
test/mobil-ozet-olcek-247.test.mjs — eski kod a3a5f814 (git archive kopyası): eski-kod-a3a5f814-kirmizi-1/2.log 3/3 KIRMIZI beklenen nedenle;
yeni kod: 2026-10-29/yeni-kod-03e0f55a-yesil.* 3/3; CI #920 03e0f55a 7/7 (4 platform npm test).
