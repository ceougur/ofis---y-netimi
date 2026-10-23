# 2.4.4 31a tur 2 — bağımsız kâhin kanıtları (23.10.2026)

Kâhin ürün kodunu (server/**, client/**) OKUMADI; kural kaynağı `KURALLAR-244-TUR2.md` (ana oturumun kural metinleri) + CLAUDE.md Açık iş + kâhin klasörlerinin
kendi belgeleri. Her kayıt `node tools/kanit.mjs kos 244-kahin/<ad> -- <komut>` ile (çıkış kodu + sayılar + ham çıktı). Program açan her koşu `flock …/kos.lock`
ve `HUKUK_LICENSE_URL=http://127.0.0.1:9` ile. Kâhin commit'leri: 34e94ea (kurallar), 7123816 (MM6 Kasa çıkışı), d1a5637 (tutar A6 taban çatalı); program kodu
54bf0e6 = aday 8 (değişmedi).

| Kayıt | Komut / ölçek | Sonuç |
|---|---|---|
| ebelge-model / ebelge-mutasyon | test_model.py · mutasyon.py | 99/99 · 45/45 mutant öldü (yeni M36–M44) |
| ebelge-senaryo | 24 hedefli senaryo (4 yeni: e1, e6, e7, mm4) | fark 0 · ihlal 0 · İNCELE 1 (K41-EFATURA-BELIRSIZ-YEREL) |
| ebelge-tohum1-3-islem120 / -dil2 | görevdeki ölçek; /3 ve /2 (taban diziyle aynı) | 0 / 0 (eski kâhinle /2'de 4 fark / 2 ihlal — aşağıda) |
| ebelge-uzun-tohum1-5-islem300 | Uzun Doğrulama parametreleri (--kucult --butce 25) | 0 / 0 |
| ebelge-ek-tohum6-20-islem300 | ek 15 tohum | 0 / 0 |
| cari-varsayilan | 12 senaryo (2 yeni: b3-u2-tablo-borcu, b5-u1-nihai-tuketici) + mutasyon 22 | 1632/1632 · 0 yakalanmayan |
| cari-uzun-tohum1-30-islem120 | Uzun Doğrulama parametreleri | 19636/19636 |
| defter | 31b-MM3 (F6R, F3R), 31b-MM8 (TH0) eklendi | 176/176 · 13 mutant yakalandı |
| tutar / tutar-a6catal | 1–3 × 50 | 3559/3559 |
| tutar-uzun-tohum1-20-adet200 | Uzun Doğrulama parametreleri, A6 çatalından ÖNCE | 2 fark (tohum 5 s053, tohum 11 s037 — A6 eşik tabanı; İNCELE) |
| tutar-uzun-tohum1-20-adet200-a6catal | aynı, çataldan sonra | 83119/83119 (2 not: a6Tabani) |
| KIRMIZI kirmizi-ad865f0-ebelge-senaryo | yeni kâhin ESKİ taban ad865f0 kodunda (ayrı kopya, ders 23; kayıttaki commit alanı çalışma ağacınındır) | fark 27 · ihlal 6 (e6 9/6: silinen FIS numarası yeniden verildi — I13/I26; e7 14: gönderilmiş/bekleyen belgede yerel iptal geçti; mm4 4: bırakılan makbuz) |
| KIRMIZI kirmizi-ad865f0-cari | aynı, KAHIN_PROGRAM_KOKU | 14 fark (BULGU 8): U1 adı belli 11111111111'li cariyi seçti; MM6 Nakit Akışı Kasa 0; U2 "Kalan Gün" 12 → 1.200 borç, aynı dosya iki sekmede 7.000 |
| KIRMIZI kirmizi-ad865f0-defter | aynı | 8 fark: satıştan iade 360 tarafında ve artı, alıştan iade 193 tarafında; yevmiye 05.10 tahsilat faturadan önce |
| eski-kahin-54bf0e6-tohum1-3-islem120 | ESKİ kâhin (tur 1) ŞİMDİKİ program kodunda | tohum 2: 4 fark / 2 ihlal — MODEL hatası (KARARLAR.md "/3 düzeltilen kâhin hataları") |

Kırmızıların nedeni iletide okundu (ders 38): her fark iddia edilen eski davranışın kendisi (ör. e7 adım 9–14 "200, iptal" — eski kod yerel iptali kabul ediyor).
E1 senaryosu (hedefli-244-e1-belirsiz) eski kodda da yeşil: bağlantı kopmasını 2.4.3 de "belirsiz" sayıyordu; E1'in asıl değişikliği (süreç yanıt gelmeden
KAPANIRSA iz) bu kâhinde benzetilemez → DENENMEYEN.
