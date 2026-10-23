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

### Tur 3 (23.10.2026, ana oturum iletileri: cari B3 K1–K5 [KULLANICI 03:12 UTC], e-Belge K38 N1 + açıklaması, K43–K45 [KULLANICI])

| Kayıt | Ne | Sonuç |
|---|---|---|
| ebelge-model-k43-k45-n1 | e-Belge model birim testleri (N1 açıklaması, K43, K44, K45 eklendi) | 114/114 |
| ebelge-mutasyon-k43-k45-n1 | mutantlar M1–M54 (yeni M49–M54) | 55/55 öldü (temel dahil) |
| KIRMIZI kirmizi-aday8-ebelge-senaryo-k43-k45-n1 | 27 hedefli senaryo, aday 8 (54bf0e6) kodunda — kırmızı BEKLENİR | 5 senaryo kırmızı, 25 fark / 1 ihlal: e6 adım 4/30 400 chronology (silinen FIS tarihi bağlıyor — N1); e7 K41b (önceki tur); k43 adım 3 gönderim sonrası "sent" olan belge geç "bulunamadı" ile none/eUnsent'e döndü (ek.gonderimSonrasi kanıtı), adım 7 sorgu 200 (409 yok), I25 ardıl; k44 ETTN'siz durum yanıtında belge "gönderildi" (B2, S1); k45 adım 21/22/24 izsiz belgede süre dolunca yine GetInvoiceStatus |
| KIRMIZI kirmizi-aday8-cari-k1-k5 | 14 senaryo (b3b, b3c yeni) + 27 mutant, aday 8 kodunda — kırmızı BEKLENİR | 103 fark (hepsi BULGU KULLANICI): K1 aynı sekmede tekrar eden dosya no ilk satırla; K3 Tutar + Tahsil Edilen → 0; K2 "birden çok sekmede" notu yok; K4 dört rapor aynı (740.000) ama K1/K3 yüzünden 1.020.000 değil; K5 Kasa sayfası 403 olan kullanıcı Nakit Akışı'nda Kasa girişini görüyor · 0 okuma hatası · 0 yakalanmayan mutasyon |

Kırmızıların nedeni iletide/ham çıktıda okundu (ders 38). Kâhin hatası düzeltildi (ders 6): ilk koşuda K5 kullanıcı adı 2 karakterdi (program reddetti → 401) ve
dosya no başına borç yıl başı–bugün raporundan okunuyordu (b3b'de Ödeme Sözü tarihi bugünden sonra → satır raporda yok); kullanıcı adı `kahin-<ad>`, borç geniş dönem
raporundan, K5 için kurulum denetimi (Kasa sayfası 200 ise okuma hatası). K44 çakışma iletisi ilk sürümde "numarası kullanıldı, silinmez" notunu da çakışma sayıyordu →
kalıplar daraltıldı. Yeşil koşular ana oturumda aday 12'de.

### Tur 3 ek — K2 değişti ([KULLANICI] 23.10.2026 04:09 UTC: farklı sekmede aynı dosya no AYRI borç ve ayrı vade kalemi + "ayrı sayıldı" notu)

| Kayıt | Ne | Sonuç |
|---|---|---|
| KIRMIZI kirmizi-aday8-cari-k2-0409 | 14 senaryo (b3c yeni K2'ye göre: 2026/301 ve 2026/304 iki dönem sekmesinde, Ödeme Sözü takvim penceresinde, K4 açık) + 27 mutant, aday 8 kodunda | 126 fark (hepsi BULGU KULLANICI) · 0 okuma hatası · 0 yakalanmayan mutasyon |

Neden (ham çıktı, ders 38): aday 8 farklı sekmedeki aynı dosya no'yu BİR KEZ sayıyor — Tablodaki Kişiler ve Tahsilat Takvimi yalnız ilk sekmenin ilk satırını alıyor
(b3c Takvim kalemleri: 301 → yalnız "2025 Aidat" 1.200, 304 → yalnız 600; ikinci sekmenin kalemi düşüyor — kararın gerekçesiyle aynı); not ne raporda ne Takvim'de
var; ayrıca K1 (302 tek satır) ve K3 (303: Takvim 2.500 = Ödenecek Tutar, ödenen düşülmüyor; Tablodaki Kişiler'de 0) → K4'te Tablodaki Kişiler 2.200, öbür üç rapor 4.700,
kâhin 6.300. Takvim kalemleri koşucunun ham çıktısına eklendi (`k*:takvim`; b3c tek başına yeniden koşuldu — ilk kayıt bu alandan önce alındı).
