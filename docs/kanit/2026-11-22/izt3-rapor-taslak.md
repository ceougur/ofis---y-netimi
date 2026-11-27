# İzleyen tur 3 — rapor taslağı (adım adım)

Taban 3b420085 (izt3-taban). Dal worktree-agent-ae8c8568d72566f15. Push yok.

## Adım 1 — tasarım §21 (koddan önce) — 4c86c710
- §21.1 rowid yeniden kullanımı; §21.2 stok iadesinde canlı yenileme; §21.3 Nasıl bozulur?

## Adım 2 — İş 1 sınaması (koddan önce) — b46e08ef; kod — 6d6d4145
- Kod: `server/lib/integrity-scope.mjs derive` — son hâli bu işlemde store ile EKLENMİŞ rowid'de (capture.inserted) kimlik farkı = silinen + eklenen iki satır. Eklenmemiş rowid (UPDATE SET id) bugünkü gibi "kimlik değişti" → tam kapı.
  Önceki turun prototipinden farkı: prototip her kimlik farkını bölüyordu; burada yalnız eklenmiş rowid (güvenlik çekirdeğinde en dar gevşetme). Yalnız okuyan yardımcı yok.
- Sınama `test/izt3-kapi-rowid-250.test.mjs` 14 test (iki kip × 6 + bulanıklaştırma 2):
  - Yeni kod: UTC 14/14, Europe/Istanbul 14/14 (`izt3-kos/is1-yeni-*.txt`).
  - Eski kod (3b420085): iki TZ 12/14. Kırmızı 2 = P1 (üretim + test kipi), ileti: `hiçbir COMMIT 'kimlik değişti' ile tam kapıya düşmez: [["full(stock_moves: kimlik değişti)"] ×3]` — beklenen neden.
  - Yakalama sınamaları (Y1–Y4, K1–K5, D1–D4) ve bulanıklaştırma ESKİ kodda da yeşil (tasarım gereği: davranış aynı kalmalı); dişleri mutantla:
    - m1 (kimlik değişimi hiç sayılmaz): 3 kırmızı — K3/K4 (üretim: K4 yolu "full(bulgu: bank:event)"), bulanıklaştırma tohum 31 (4 eşdeğerlik ihlali), tohum 37 kilitli (68 ihlal; çoğu period-lock).
    - m2 (eklenmemiş rowid de bölünür = prototip): 1 kırmızı — K4 D8 bekçisi.
  - Bulanıklaştırma sayıları eski = yeni: tohum 31 135/160 aynı rowid, kabul 89, ret 46; tohum 37 (kilitli) 144/160, kabul 25, ret 119; eşdeğerlik ihlali 0.
- Eski ↔ yeni EŞDEĞERLİK dökümü (`izt3-kos/kapi.mjs`, 14 senaryo, her biri taze sunucu): üretim ve test kipinde 14/14 sonuç birebir aynı (durum, 409 kodları, tarama bulguları, sayılar); değişen yalnız kapı yolu:
  eski üretim {stock_moves kimlik değişti ×3, cash_entries kimlik değişti ×2}, yeni {scoped ×4 (Düzenle ×3), full(bulgu: bank:event) ×1, cash_entries kimlik değişti ×1 (K4 — D8 aynen)}.

## Adım 3 — İş 2 sınaması (koddan önce) — 483f8a47; kod — d4b2a864; ekran — 5ac159f5
- `routes/stock.mjs` (yalnız iade yolu): `publishCards`; PUT / DELETE / Silinenler'den geri yükleme değişen kartları `plans` + `planId` ile; geri yüklemede `accounts` da.
- Sınama `test/izt3-stok-iade-canli-250.test.mjs` 5: yeni iki TZ 5/5; eski iki TZ 2/5 — kırmızı iletiler `olaylar: stock cash accounts@A` (düzeltme), `stock accounts@A` (silme), `stock cash` (geri yükleme): beklenen neden (plans yok; geri yüklemede accounts da yok).
- Ekran `test/e2e/senaryo-izt3-250.mjs` (iki tarayıcı: yönetici Stok penceresinden Düzelt / Sil + Yönetim › Silinenler'den Geri Yükle; gözcünün ekranına dokunulmaz): yeni 18/18, eski 16/18 —
  eski kırmızı 2: geri yüklemeden sonra gözcünün kart penceresi Kalan ₺900,00 (veri tabanı 300) ve Taksitler listesi ₺900,00 (bayat). Görüntüler `izt3-ekran/` (yeni-04 ₺300,00 · eski-04 ₺900,00 — baktım).
  İlk koşuda beklentim yanlıştı (geri yüklenen hareket Miktar 2'lik hâli → kart 300, ben 600 yazmıştım); sayı programla değil iadenin kendi tutarıyla (600) düzeltildi.

## Adım 4 — Komşular, kâhin
- G2 (335 dosya — `test/` taraması: gateVerify / integrity / ledger/integrity / period-lock / kapı / ledger_snapshot / dondur / sema-kapisi / trash/restore / stok hareketi; varsayılan gateVerify açık olduğundan bu dosyaların her yazımı süzgeç ↔ tam kapı eşdeğerlik denetimi):
  UTC 3527/3527 (commit 5ac159f5), Europe/Istanbul 3527/3527 (b68b2f97 — yalnız belge farkı); fail 0, cancelled 0, skipped 0.
- Kâhin (5ac159f5): cari 103 senaryo / 24.062 denetim 0 fark iki TZ; defter 187 denetim 0 fark iki TZ; yapım listesi kendi kopyada: 4 → 4, yeni 0 / kapanan 0 / değeri değişen 0 (yalnız paket etiketi metni farklı — bilinen üretici nüansı).

## Adım 5 — Hız (özel kilit dışarıda, 3 tur dönüşümlü, taze temiz-100k, TZ Europe/Istanbul; `izt3-hiz/tablo-1.md`, ham `sonuc-1.txt`)
- Geçerli: her ölçüm başında yük < 1,5 (1,09–1,44); GEÇERSİZ tur yok. KÖTÜ (ortanca VE en iyi > +%10) yol YOK.
- Düzenle (azaltma) 6.393 → 161 ms (−%97,5), büyük azaltma 6.469 → 146 ms, YENİ fatura Düzenle azaltma 6.613 → 145 ms; olay döngüsü tabanda ~7 sn kilitli → yenide ≤ 181 ms.
  Kapı yolu: tabanda azaltma / büyük azaltma / yeni fatura azaltması 3 turda da `full(stock_moves: kimlik değişti)` (11 / 11), yenide hepsi `scoped`.
- Öbür yollar ortanca farkı: kart penceresi +%3,4 (en iyi −%1,1), fatura kartı +%0,5, Düzenle aynı içerik −%3,8, iade yazımı −%1,7, stok iadesi yazım / düzeltme / silme / geri yükleme −%1,7 / −%2,9 / +%4,6 / −%0,7,
  sıradan stok düzeltme / silme +%3,8 / +%2,1 (5 ms düzeyinde), bütünlük taraması +%8,1 (en iyi +%5,1; tam tarama kodu değişmedi — `run`), Dönem Kilidi kilitle 0, aç +%19,3 (tek ölçüm, en iyi 0 — 23 ms düzeyinde gürültü).
- Olay döngüsü 0,0 okunan satırlar ölçüm aracının nüansı (önceki turdan biliniyor — 2.5.1).

## Adım 6 — Komşu ekran senaryoları (UTC, commit 2047b2f8; `izt3-kos/e2e-komsu-ozet-UTC.txt`)
- 19 senaryonun 19'u çıkış 0: izt3-250 18/18 (UTC; İstanbul'da da 18/18), izt2-250 24, izt-250 20, dkfix-250 21, 217 65/65, 216 54/54, banka-210b 90, banka-210-eski-satir 29, fatura-243 61, kdv-donemi-250 22,
  duzeltme-kilidi-250 79, duzeltme-kilidi-tur3-250 110, iade-246 26, cari-243 70, kasa-acilis-uyari-250 20/20, pos-220 113, entegrator-240 81, banka-210-kart-onbellek-yaris 49, uiux-b-243 58.
- Seçim: `test/e2e` taraması — Düzenle (`data-act="modify"` / `/edit`) ya da stok hareketi silme / düzeltme / Silinenler'den geri yükleme kullanan senaryolar (+ izt / izt2 / dkfix).
