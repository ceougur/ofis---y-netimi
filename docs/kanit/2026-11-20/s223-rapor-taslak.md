# S223 küçük turu — rapor taslağı (adım adım)

Taban: c7b-aday = df7e93ca. Karar: S223 = A, S228 = A (görev metni docs/devir/2.5.0-DEVAM/s223-istem.txt).

## 0. NASIL BOZULUR (koddan önce)
1. Büyük / küçük harf: 'AHMET YILMAZ' ↔ 'Ahmet Yılmaz' (SQLite NOCASE yalnız A–Z katlar: 'I' → 'i', oysa Türkçe 'ı').
2. I / ı ve İ / i her konumda: 'İLKER IŞIK' ↔ 'İlker Işık', 'ILGIN' ↔ 'Ilgın' (baş, orta, son harf).
3. İngilizce olmayan harfler hiç katlanmıyor: 'ŞÜKRÜ ÖZÇELİK' ↔ 'Şükrü Özçelik', 'ĞÜLER' gibi (Ş Ğ Ü Ö Ç).
4. Boşluk: çift boşluk, baş / son boşluk, sekme, bölünmez boşluk (U+00A0) — NOCASE eşit saymaz.
5. Unicode yazım farkı: 'İ' ayrık noktalı ('I' + U+0307) — NFC ile birleşir.
6. Var olan ÇİFT cari (S228): 'Ahmet Yılmaz' + 'AHMET YILMAZ' ikisi telefonsuz, aynı grupta → Türkçe katlamada iki aday; bugünkü
   bağlantı (yazımı birebir olan) KORUNMALI; yalnız bugün hiç bulunamayan satır Türkçe katlamayla bulunmalı.
7. Aynı dosyada aynı kişi iki satır, biri büyük harfle: ilk satırın açtığı cari / kart ikinciye görünmeli (yükleme içi harita).
8. Telefonlu satır + aynı adlı (Türkçe katlamayla) FARKLI telefonlu cari → FARKLI kişi kalır (yeni cari).
9. Cari No + ad (cari Excel): aynı No + büyük harfli ad → aynı cari; farklı No → değil.
10. Tablodaki kayıt bağı (case_key) önceliği bozulmamalı; başka kayda bağlı cari kullanılmamalı (v2.0.8).
11. Silinmiş cari aday OLMAMALI (deleted_at).
12. Telefonsuz satır + aynı grupta tek / birden çok (Türkçe katlamayla) cari: tek → o; çok → şüpheli (yeni cari / atlama, bugünkü gibi).
13. Aynı Excel ikinci kez: telefonsuz / No'suz cari satırı yine yeni cari açar (2.0.19 kuralı AYNEN); taksitte çift kart açılmaz.
14. Ön izleme ↔ yükleme aynı sonuç (Tablodan Aktar: ön izlemede 'match' denen kişi aktarımda da o cariye).
15. Geri Al: yalnız kendi açtığı cariyi / kartı siler (eşleşen var olan cari silinmez).
16. Kilitli dönem: satır kilit nedeniyle atlanınca iç işlem geri alınır; yükleme içi haritaya eklenen (geri alınmış) cari sonraki satıra ADAY OLMAMALI.
17. İki şirket: harita şirket başına (store başına) — öbür şirketin carisi görünmemeli.
18. Cari Excel 'Güncelle' kipi: eşleşen carinin adı satırdaki yazımla değişir; haritada yeni adıyla bulunmalı (eski adla bulunmamalı).
19. Çek / senet içe aktarma önbelleği: anahtar Türkçe küçük harf, sorgu NOCASE → aynı dosyada 'AHMET YILMAZ' ve 'Ahmet Yılmaz' ilk satırın sonucunu paylaşıyor.
20. Yinelenen kart anahtarı (taksit Excel): yalnız ASCII katlıyor → 'AHMET YILMAZ' satırı 'Ahmet Yılmaz' kartını görmüyor → çift kart.
21. İngilizce klavyeyle harf DEĞİŞİMİ ('IBRAHIM' ↔ 'İbrahim', 'Yilmaz' ↔ 'Yılmaz') — KAPSAM DIŞI; yalnız davranış yazılır
    (NOCASE bugün 'YILMAZ' ↔ 'Yilmaz'ı eşit sayıyor; S228 = A sırası bunu korur: bugünkü karşılaştırma önce).
22. Hız: satır başına tam tablo taraması / 100 bin caride satır başına harita kurmak.

## 1. TARAMA (git grep nocase / toLowerCase / toLocaleLowerCase / toUpperCase + ad eşitliği arayan sorgular; server + client/assets)
| Yol (dosya:satır, taban) | Ne karşılaştırıyor | Kapsamda mı | Ne yapıldı |
|---|---|---|---|
| accounts.mjs matchExisting (cari Excel / Sheets yüklemesi) | Cari No + ad NOCASE; ad NOCASE + telefon 7+ hane | EVET | S228 sırası: NOCASE bulamazsa Türkçe katlamalı aday (yükleme başına harita); açılan / güncellenen cari haritaya |
| accounts.mjs matchPerson / planPerson / planDuplicate / createFromPlan (taksit Excel, Tablodan Aktar) | ad NOCASE + samePerson (telefon / telefonsuz + grup) | EVET | aynı sıra; index verilmezse (tek kart formu) bugünkü gibi |
| plans.mjs Excel yüklemesi cardKey (yinelenen kart) | yalnız A–Z katlayan bellek eşi | EVET | ikinci harita foldPersonName; NOCASE sonucu "" ise yalnız Türkçe katlamada aynı olan kartlara bakılır |
| plans.mjs recordIndex fold (tablodaki kayıt bağı) | zaten Türkçe (yerel kopya) | EVET (davranış aynı) | yerel fold → foldPersonName (tek yardımcı; sonuç aynı) |
| plan-transfer.mjs fold (bağsız kart, aynı ad sayımı) | zaten Türkçe (yerel kopya) | EVET (davranış aynı) | foldPersonName |
| plan-transfer.mjs ön izleme matchPerson + aktarım createFromPlan | NOCASE | EVET | ad haritası (ön izleme ve aktarım ayrı, aynı kural) |
| cheques.mjs içe aktarma findAccount | önbellek anahtarı Türkçe küçük harf, sorgu NOCASE | EVET | accounts.matchName (S228 sırası); önbellek adın kendisiyle |
| plans.mjs POST/PUT /plans (tek kart formu, cari seçilmeden) createFromPlan | NOCASE | HAYIR (içe aktarma değil) | değişmedi (index yok → bugünkü kural); BAŞ MİMAR'a not |
| plans.mjs 96 / 147, plan-transfer.mjs 218 / 430 (grup adı) | plan_groups NOCASE | HAYIR (grup adı, kişi değil) | değişmedi; grup adı farkı telefonsuz eşleşmeyi etkiler → BAŞ MİMAR KARARI GEREKİYOR maddesi |
| accounts.mjs 292–305, plans.mjs 444–455, cheques.mjs 197–219, hof-plan-transfer.js 104–277 (arama) | Türkçe küçük harf içerir | HAYIR | değişmedi |
| accounts.mjs 325 / 501 / 1819, plans.mjs 61 / 429 (ORDER BY name NOCASE) | sıralama | HAYIR (görünüm → 2.5.1) | değişmedi |
| accounts.mjs 529–530, 1605, 1697 (ek alan / tür etiketi) | Türkçe küçük harf | HAYIR | değişmedi |
| cheques.mjs 440 / 884 / 1017 (seri no + banka adı NOCASE, yinelenen evrak) | banka adı | HAYIR (kişi değil) | değişmedi |
| users / roles: auth.mjs 136, admin.mjs 59, app.mjs 101, mobile-remote.mjs 396, names.mjs nameConflict / resolveUserByName, access.mjs 77, workspace.mjs 22 | kullanıcı / rol adı | HAYIR (komşu, ders 10) | foldName DEĞİŞMEDİ |
| stock.mjs 246 / 328 / 679 / 738 / 809, invoices.mjs 1390 / 2748 / 5049 | stok / fatura satırı adı | HAYIR | değişmedi |
| hof-plans.js 650–665 (tek kart formunda cari önerisi, HOF.normalize) | istemci önerisi | HAYIR (içe aktarma değil) | değişmedi |

## 2. KOD (49e92fd5)
- lib/names.mjs: YENİ foldPersonName (foldName ile aynı sonuç, hızlı; 100 bin ad 45 ms ↔ foldName 355–518 ms) + foldedNameIndex (lazy, yükleme başına tek okuma). foldName değişmedi.
- accounts.mjs: matchExisting / matchPerson / planPerson / planDuplicate / createFromPlan isteğe bağlı index; personIndex, foldedCandidates (adayların GÜNCEL satırı: geri alınmış / silinmiş / adı değişmiş düşer), matchName (çek).
- plans.mjs: Excel yüklemesinde people haritası + foldedCards; recordIndex yerel fold → foldPersonName.
- plan-transfer.mjs: fold → foldPersonName; ön izleme ve aktarımda people haritası.
- cheques.mjs: findAccount → accounts.matchName, önbellek anahtarı ad.

## 3. TESTLER
- test/s223-turkce-ad-eslesme-250.test.mjs (12) + test/c7bt-ayni-adli-excel-karti-250.test.mjs (11) BEKLENTİSİ DEĞİŞTİ (ders 28).
- Yeni kod: UTC 23/23, Europe/Istanbul 23/23. Taban (c7b-aday, ayrı kopya, yeni testler): UTC 12/23 (11 kırmızı), İstanbul 12/23.
- Taban kırmızı nedenleri (ders 38): (0) 'foldPersonName yok'; (1) 'yeni cari açıldı: 7 !== 1'; (2) 'C-77 + büyük harfli ad aynı cari' (yeni cari);
  (4) 'kart var olan cariye bağlandı 0 !== 1'; (5) 'çift kart: 1'; (6) üçüncü cari + kart açıldı (AMBIGUOUS beklenirdi); (8) 'çift kart: 3';
  (9) Oya Ünlü linked 0 (yeni cari); (10) çek: büyük harfli keşideci bağlanmadı ('', ''), 'Deniz Işık' satırı önbellekten YANLIŞ cariye (DENİZ IŞIK);
  (11) Tablodan Aktar ön izleme 'new' (yeni cari); c7bt (11) "ırmak İnce" ikinci kart açıldı. Ham: s223-taban-utc.log, s223-taban-ist.log.

## G2. KOMŞULAR (git grep: içe aktarma uçları, from-table, lib/names.mjs, nameConflict / resolveUserByName / foldName, matchPerson / createFromPlan / planDuplicate, lib/access.mjs, roller — 57 dosya; liste s223-komsu-listesi.txt)
- UTC 837/837, Europe/Istanbul 837/837 (fail 0, cancelled 0, skipped 0). Ham: s223-komsu-utc.log.gz, s223-komsu-ist.log.gz.

## BULGU (kapsam dışı, yeniden üretildi) — grup adı
- Taksit Excel: 'Elif Su' (telefonsuz, grup 'Işık Servisi') → kart; sonra 'ELİF SU' (telefonsuz, grup 'IŞIK SERVİSİ') → YENİ grup 'IŞIK SERVİSİ' + YENİ cari + kart (çift grup, çift cari, çift borç).
  Neden: grup bulma (plans.mjs ensureGroup; plan-transfer groupExisting / groupId) NOCASE — kişi adı düzelse de telefonsuz eşleşme 'aynı grup' ister. 'ŞUBE A' ↔ 'Şube A' NOCASE'te eşit (Ş ikisinde büyük) — yalnız I/ı, İ/i ve küçük-büyük Türkçe harf farkı bozar.
