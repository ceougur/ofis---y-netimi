# Cari kâhini bakımı 24 — rapor taslağı (adım adım; kesilirse buradan sürdürülür)

Taban: `de403915`. Girdi: `docs/devir/2.5.0-DEVAM/kahin-cari24-kararlar.md` (tek kaynak). Program kodu OKUNMADI (yalnız bağdaştırıcı ve yoklama betikleriyle kara kutu).
Ortam (başlangıç 10:2x UTC): yük 0,07 / 4 çekirdek, bellek boş ~14 GB, disk boş 8,6 GB.

## Adımlar
1. [10:2x] Kara kutu yoklaması (yalnız eşleme): `yokla1.mjs` (plan uçlarının varlığı — oturumsuz 404 / 401 / 405 ayrımı; `PUT /plans/:id {status}`), `yokla3.mjs` (Kartı Kapat / iade / Yeniden Aç / iade iptali /
   fatura Düzenle). Çıktılar `kahin-cari24-kanit/kahin-cari24-yokla{1,3}.log`. Kapanış günü gövdeden verilemiyor (sunucunun bugünü); kesilmiş fatura Düzenle 409 `invoice-not-draft`.
2. [10:35] Yorum commit'i — KARARLAR.md §36 (Y24-1 … Y24-9, SK-42 … SK-44), ders 40: önce kural.
3. [~10:50] Elle senaryolar d53 / d54 / d55 (250ea8d6) — model DEĞİŞMEDEN önce, karar metinlerinden (üreteç `uret-d53.py`).
4. [~11:20] Kod (a7e999f2): model (Kartı Kapat dil eki, kart küçülmesi, iade iptali, Düzenle, SUS alanları), bağdaştırıcı eşlemesi, mutantlar 334–340. İlk koşuda elle tablolar: d53 / d54'te yalnız P6 / A6 (ikinci kart
   faturayı içine alıyordu → kâhinin SK-20 susması) farklı → senaryo değiştirildi (ikinci kart tek elle Borç) — sonra d53 271/271, d54 128/128, d55 72/72; mutantlar 334–340 elle tabloda yakalandı. Öz test ilk koşu 7.676/7.678
   (2 kırmızı: d8 B — bakım 1'den beri SUS olan taksitli faturanın iadesi artık tanımlı → karar gereği elle tablo güncellendi, `elle-guncelle.py`).
   NOT (açıkça): ilk program önizlemesi yük 6,45 / 4 iken başladı (görev metni: 4'ün üstündeyse tek seferlik bekle — bekleme atlandı; önizleme kanıt sayılmadı). Taksitli faturanın kartı ilk eşlemede plan listesinin
   `invoiceId`'sinden aranıyordu (alan yok — yoklama 4) → fatura kartının `planId`'si.
5. Program önizlemesi (yeni senaryolar, `--mutasyonsuz`, kanıt değil): S234 / S237 örnekleri (P1 / P2), kapanmış kart Yeniden Aç / yeniden kapat, kendi kartlı fatura (P5 / A5), iki kart (P6 / A6), açık kart A1 / A2 kâhinle AYNI.
   Farklar: (i) Düzenle 409 invoice-not-draft (girdi §1 (e) — yapım aşaması); (ii) iade iptalinde geri gelen tutar kartın SON taksitine ekleniyor (KAPSAM (c) 'küçülmenin tersi' değil — d55 B1 gecikmiş 0 ↔ 300, taksit satırı);
   (iii) d55 B2 küçülme açık kalanı aşınca program kartın Tahsil Edilen'ini 300'e düşürüp Kalan 300 gösteriyor, iade belgesi açık 0 ((4) 'fazlası carinin avansı' — kâhin Kalan 0, açık iade belgesi 300).
6. [10:54–12:45] Kanıt koşuları (kos.sh; hepsi flock -s): temel UTC / İstanbul (öz test 7.678/7.678, G3 639/639, elle fark 106/106, yeni elle 471/471, eski kâhinde 340/471 kırmızı — iki TZ bayt bayt aynı; G3 İstanbul ilk
   denemede kilit beklerken 40 dk sınırında kesildi, tek başına yeniden koşuldu); program UTC / İstanbul 22.775/22.832 (57 fark, liste iki TZ'de aynı); program ↔ eski kâhin (d54 / d55) 295/308; yapım aşaması üretilen 57 →
   depoya yalnız Düzenle 38 ("Ç7b"); P-1 (iade iptali son taksite) 5 fark ve P-2 (fazlası avans) 14 fark listeye girmedi (program şüphesi).
7. KARARLAR §36 sonuç bölümleri (C8ac, C10ac, senaryolar, C0ac, program ↔ kâhin, yapım aşaması, KULLANICIYA SORULMALI, DENENMEYEN, 2.5.1, kanıt) + YAPIM-ASAMASI.json.
