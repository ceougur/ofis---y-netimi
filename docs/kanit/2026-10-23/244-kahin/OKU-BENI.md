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

### Tur 4 — C3 kişi gruplaması ([KULLANICI] 23.10.2026; kapsam boşluğu: aday 15'te kâhin 1967/1967 iken bağımsız dar kontrol D1 gerilemesini yakaladı)

| Kayıt | Ne | Sonuç |
|---|---|---|
| KIRMIZI kirmizi-aday15-cari-c3 | 15 senaryo (b3d yeni; rastgele tohumlarda "Üyeler" sekmesi) + 31 mutant, ADAY 15 kodunda (KAHIN_PROGRAM_KOKU=/home/user/wt/aday15, salt okunur) — kırmızı BEKLENİR | 92 fark (hepsi BULGU KULLANICI) · 0 okuma hatası · 0 yakalanmayan mutasyon |

Neden (ham çıktı, ders 38): farkların HEPSİ farklı adların aynı kimlikle tek satırda birleşmesi — b3d: Mehmet Kara + Zeynep Ak (11111111111), Ece Su + Ufuk Ay
(0000000000), Gül Tan + Ali Can (2222222222), Can Er + Hande Öz (gerçek TCKN 11223344550; satır etiketi yalnız ilk ad); rastgele 1: T1/012 + T1/013 (11111111111),
rastgele 2: T2/014–016 (yer tutucu). Aynı ad farklı kimlik (etiketinde "(TC …)"), aynı ad aynı kimlik, kimliksiz satırın tek kimliğe katılması ve iki sekmede aynı
kişi aday 15'te kurala uygun (fark yok). Kâhin hatası düzeltildi (ders 6): ilk koşuda aynı dosya no'yu iki kimlikli bir adın kimliksiz satırıyla kullandım; program
o satırı ayrı kişi yaptı — kural bu durumu söylemiyor → kâhinde TANIMSIZ, senaryoda o satır tek kimlikli ada taşındı, İNCELE olarak raporda.

### Tur 4 ek — C3 tamamlayıcıları (baş mimar kararları 23.10.2026: kimliksiz satır; kimlik sütunu tutar değildir)

| Kayıt | Ne | Sonuç |
|---|---|---|
| KIRMIZI kirmizi-aday15-cari-c3-tamamlayici | 15 senaryo (b3d: "2026 Aidat"ta 2026/401'in kimliksiz satırı, "Firmalar" sekmesi "Vergi No" geçerli/geçersiz VKN; üreteç "Firmalar" sekmesi — başlık Vergi No / Vergi Numarası / Vergi Kimlik) + 34 mutant, ADAY 15 kodunda — kırmızı BEKLENİR | 537 fark (hepsi BULGU KULLANICI) · 0 okuma hatası · 0 yakalanmayan mutasyon (ilk koşuda mutant 33 yaşadı → b3d'ye geçerli VKN'li Yeşil AŞ satırı, üreteçte yer tutucu + gerçek kimlik aynı adda her tohumda) |

Neden (ham çıktı, ders 38; her fark aşağıdakilerden birine düştü — sınıflama betiği not defterinde): (1) Vergi No / Numarası / Kimlik başlıklı sekmenin satırları raporda HİÇ
yok (sütun tutar sayılıyor — b3d 21, rastgele 119 + 112 fark); (2) farklı adların aynı değerle birleşmesi (D1; yer tutucu ve gerçek TCKN); (3) kimliksiz satır: çok kimlikli
adın aynı dosya no'lu kimliksiz satırı ayrı "kimliksiz" kişiye gidiyor (b3d 2026/401: "Ayşe Yıldız" 150 ayrı satır; rastgele 14 + 14); (4) sağlama hanesi tutmayan yer
tutucu tek kimlikli adda ayrı kişi yapıyor (rastgele 21 + 21). Borç farkları gruplamanın sonucudur (rapor satırı kişi toplamı).

### Tur 5 — karar A (vergi sütunu borç değildir) ve kayıt anahtarı sürekliliği (23.10.2026)

| Kayıt | Ne | Sonuç |
|---|---|---|
| KIRMIZI kirmizi-aday16-cari-vergi-anahtar | 17 senaryo (b3e, b3f yeni; üreteçte "Faturalar") + 39 mutant, ADAY 16 kodunda (salt okunur) — (1)'de kırmızı BEKLENİR | 41 fark (BULGU 26, İNCELE 15 — Genel Toplam − ödenen YAYGIN) · 0 okuma hatası · 0 yakalanmayan mutasyon |

Neden (ham çıktı, ders 38): (1) KDV (ve b3e "Vergili Satış"ta Vergi / Vergi Tutarı / Tevkifat sütunlarından en az biri) tutar sayılıyor → Tutar + KDV + Genel Toplam,
Tutar + KDV sekmelerinin kişileri raporda HİÇ yok (b3e Kemal Uz, Leyla Su, Mert Ay, Okan Ak, Rıza Ok; rastgele 1 KDV'li Faturalar); Ücret + Stopaj, Kalan Borç önceliği ve
rastgele 2'nin ÖTV + Genel Toplam + Tahsil Edilen sekmesi aday 16'da kurala uygun; (2) borç sütunu belirlenemeyen sekmenin (Aidat + Ek Ücret) kişisi raporda notsuz
kayboluyor (Tülin Er); (3) b3f: aynı dosya Yerine koy'da tahsilat kalıyor (anahtar aynı), ama geçersiz Vergi No (Oya Er) / TC (Sami Er) silinip yeniden yüklenince satır
anahtarı değişiyor ("satir:c7ae…" → "satir:1b06…") ve kayda bağlı tahsilat düşüyor (alacak 60 / 90 → 0) — geçersiz değer kayıt kimliğine giriyor.

### Tur 6 — tablo bağ sürekliliği (baş mimar kararı 23.10.2026)

| Kayıt | Ne | Sonuç |
|---|---|---|
| KIRMIZI kirmizi-aday16-cari-bag-surekliligi | 19 senaryo (b3g, b3h yeni) + 43 mutant, ADAY 16 kodunda | 68 fark (BULGU 50) · 0 okuma hatası · 0 yakalanmayan mutasyon |
| KIRMIZI kirmizi-r31e-e-cari-bag-surekliligi | aynı, is/r31e-e (E1/E2 düzeltmesi, 6838d3e) kodunda | 29 fark (BULGU 26) · 0 okuma hatası · 0 yakalanmayan mutasyon — b3e ve rastgele YEŞİL (karar A düzeltmesi tutuyor) |

Neden (ham çıktı, ders 38; iki ağaçta bağ sürekliliği farkları aynı): (1) Yerine koy'da yeni kolon (E-posta) + bir satırın tutar değişimi tablodaki BÜTÜN kayıt tahsilatlarını
ve cari bağını koparıyor (b3g k2: Nur Ak 50, Oya Er 60, Can Su 30, Deniz Ay 40, Ali Veli 10 + 20, Ece Naz carisinin 25'i → 0) — Dosya No'suz satırın anahtarı satır içeriğinin
özeti; Dosya No kolonu eklenince de kopuyor (b3h k2); aynı içerik geri yüklenince bağ geri görünüyor (b3h k3 — veri silinmemiş); (2) hiçbir yüklemede uyarı ya da onay yok
(b3g t3 "Ali Veli", t4 "Oya Er"/"Deniz Ay"; b3h t4 "Kaan Uz" çift satırı) — commit onaysız 200; (3) Devamı olarak ekle (merge) mevcut 2. satırı (Lale Ak, tahsilatı 200)
yeni dosyanın 2. satırıyla (Yeni Kişi) değiştiriyor — Lale Ak raporda yok; (4) b3f k4 (geçersiz değer silinince tahsilat kopuyor) aynı bulgunun parçası.

### Tur 6 ek — NETLEŞTİRME (aynı içerik = mevcut kayıt; Devam uyarısı; seçeneğe göre uyarı) — ADAY 17 (e5fc407)

| Kayıt | Ne | Sonuç |
|---|---|---|
| aday17-cari-bag-netlestirme | 19 senaryo (b3g v2'de aynı adlı satırın tutarı değişir — konum eşleşmesi; v3 ters sıra — aynı içerik; b3h "Açıklama" sütunu, Devam'da aynı içerikli Kaan Uz + başka hücresi farklı Lale Ak) + 45 mutant, ADAY 17 kodunda | 2 fark (BULGU 2) · 0 okuma hatası · 0 yakalanmayan mutasyon |

İki farkın nedeni TEK (ham çıktı, ders 38): b3h t4 Devamı olarak ekle — "Lale Ak" (aynı kişi + aynı tutar 2.000, Açıklama Ekim → Kasım) için önizlemede uyarı ve onay yok
(`bonds.merge.samePerson` 0); program bu satırı İKİNCİ KAYIT değil, mevcut Lale Ak kaydının GÜNCELLEMESİ sayıyor (`preview.merge.updated` 1, bağ taşındı, rapor Lale Ak 2.000 /
alacak 200). Kâhin kararın "(yani ikinci kez eklenecek)" ifadesine göre uyarı + onay bekliyor — Devamı olarak ekle'nin aynı kişili satırı güncellemesi karar sahibince teyit
edilmeli. Ara kâhin hataları (düzeltildi): koşucu uyarı adlarını öbür seçeneğin `bonds.merge.duplicates`'ından okuyordu (NETLEŞTİRME (3)); Devam'da aynı içerikli satır aynı
anahtarı taşıdığı için grup eşlemesi son kaydı seçiyordu (ilk kayıt kazanır).
