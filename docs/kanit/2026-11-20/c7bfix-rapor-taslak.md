# Ç7b ADAY DÜZELTME TURU (YB-1 — Kartı Kapat onay kalanı) — rapor taslağı

Görev metni: docs/devir/2.5.0-DEVAM/c7bfix-istem.txt. Taban: surucu5-uc = fce3d272. Eski kod kopyası: /dev/shm/c7bfix-a66/eski (git worktree --detach surucu5-uc).

## 0. Nasıl bozulur? (koddan ÖNCE yazıldı; testler buradan)
1. Cari kartından (Taksit Tahsilatı DEĞİL) tahsilat: kısmi (500 / 3.000), tam (3.000), fazla (3.500 — gösterilen kalan 0): pencere Kalan X der → onay → TEK istekte kapanmalı.
2. Karışık: Taksit Tahsilatı + cari kartından tahsilat aynı kartta → gösterilen kalan = toplam − ikisi; tek onay.
3. Tahsilat SİLİNİR (YB-1'in asıl amacı): pencere Kalan X'i gösterdikten sonra cari tahsilatı ya da kart tahsilatı silinir → eski onay 409 KALMALI; 409'un 'güncel kalan'ı pencerenin YENİDEN göstereceği sayı (gösterilen kalan).
4. Kart tutarı değişir (onaydan sonra) → 409; güncel kalan gösterilen sayı.
5. Kalansız kart (gösterilen kalan 0 — S129 'Kalan 0 · Tamamlandı' kuyruktan; kartın kendi kalanı > 0): onay 0 → 200; sonra tutar büyür → 409.
6. Mevcut Borç kartı (coversBalance; taksitlere bölünmemiş kısım queueExtras 'rest'): gösterilen kalan = pencere; tek onay.
7. Borçta Kalsın ile kapanmış kartı Yeniden Aç → yine Kartı Kapat: gösterilen kalan (kuyruk) ile tek onay.
8. Eski kuralla kapanmış (frozen) kart: zaten kapalı → denetim girmez (status değişmez); Yeniden Aç → Kartı Kapat normal.
9. Carisiz eski kart (kuyruk yok): gösterilen = kartın kendi kalanı; tek onay.
10. İki kart aynı caride: cari tahsilatı kuyrukta önce eski karta gider; her kartın gösterilen kalanıyla tek onay.
11. Eski istemci (closeRemaining yok) → bugünkü gibi 200.
12. Şüpheli kuyruğundaki kısım (held): gösterilen kalan held'i içerir (pencere ne gösteriyorsa).
13. Kilitli gün (bugün kilitli) → kapatma reddi YB-1'den önce (bugünkü sıra).
14. İki TZ (UTC / Europe/Istanbul) — gün sınırı.
15. Yarış: denetim ile yazım aynı işlemde (store.tx, BEGIN IMMEDIATE) — araya başka yazım giremez.
16. Hız: denetim işlem içinde tek carinin kuyruğunu kurar → Kartı Kapat yazımı büyük caride ölçülür (ders 47).

## 1. Kök neden (doğrulandı) ve kod (commit db290c39)
- Yeniden üretim (ders 6): yeni test K1 tabanda (fce3d272) 409 'güncel kalan 3.000,00 TL' — ana oturumun en küçük örneğiyle AYNI (kart 3.000 / 3 taksit, cari kartından 500, pencere 2.500).
- Kök neden: `routes/plans.mjs` PUT'taki YB-1 denetimi `detail()` → `shape()` (allocate; kartın KENDİ hesabı) okuyordu; `queueFor` işlem içinde null döndürür (kuyruk yok) → pencerenin
  gösterdiği `detailView` (withQueue + queueFor) sayısıyla AYNI değil. Doğrulandı: invoices.obligationsOf işlem içinde önbelleğe okumadan / yazmadan kurar (yorum ve kod: `if (store.inTransaction) { … obligationsFor(…) }`).
- Seçim: karşılaştırma İŞLEMİN İÇİNDE (BEGIN IMMEDIATE; denetimle yazım arasına başka yazım — başka süreç dahil — giremez), tek carinin kuyruğu önbelleksiz kurulur
  (`queueBuild` = queueFor'un işlem denetimsiz gövdesi; `shownRemaining` = detailView'ın kuralı). queueFor / queueOf işlem içinde yine null (öbür yollar DEĞİŞMEDİ).
  İşlem dışı (araya await girmeden, store.tx'ten hemen önce) seçeneği de eşdeğerdi ama başka süreç yazımına karşı korumasız; maliyet aynı (tek carinin kuyruğu) — hız D'de ölçülür.
- Testler (`test/c7bfix-kart-kapat-kuyruk-250.test.mjs` 10 sınama + `test/c7b-kart-kapat-onay-250.test.mjs` 2): taban UTC 4 / 12 geçti (8 kırmızı, hepsi beklenen nedenle:
  K1 'güncel kalan 3.000,00', K2 '2.000,00', K3 güncel kalan 3.000 ≠ pencere 2.500, K4 3.600 ≠ 3.100, K5 '600,00', K6a '3.000,00', K7 '3.000,00', K8 '1.000,00'); İstanbul aynı 4 / 12.
  Yeni kod UTC 12 / 12, İstanbul 12 / 12. Ham çıktı docs/kanit/2026-11-20/c7bfix-kos/ (yeni koşular commit'ten önce — kirli ağaç; C'de commit'li yeniden).
- K8 GÖZLEMİ (ürün davranışı, YB-1 doğru çalışıyor): aynı caride iki kart, cari kartından 1.200 → eski kart pencere 0, yeni kart (ilk vade 08.01.2027) 800. Yeni kart Borçta Kalsın ile
  kapanınca kalanı kapanışın ertesi günü vadeli olur (S205 = A / S220 = A) ve tek kuyrukta eski kartın 3. taksitinden (08.11) öne geçer → eski kartın penceresi 0 → 333,34. Eski kartın
  önceki 'kalan 0' onayı eskimiştir → 409 (güncel kalan 333,34) — YB-1'in amacı. Bakiye 800 (2.000 − 1.200) iki okumada aynı.

## 2. TARAMA (`git grep -n -E "inTransaction|detail\(previous|closeRemaining" -- server` + `plan-close-stale` / `*-stale` kodları + Kartı Kapat çağıranları)
| Yer | Ne yapıyor | Kullanıcının gördüğü sayıyla karşılaştırma / sayı söyleme? | Hüküm |
|---|---|---|---|
| routes/plans.mjs PUT YB-1 (≈903) | onaylanan kalan ↔ güncel kalan | EVET — pencere (S129 = A) | DÜZELTİLDİ (bu tur) |
| routes/plans.mjs 878 (değişmedi kısa yolu) | detail() döndürür | hayır (yanıt sonra writeView ile) | aile dışı |
| routes/plans.mjs ≈1134–1146 (tahsilat sınırı 'Kalanı Aşan Tutar' / 'Bu kart ödendi' / seçilen taksit ödendi) | kartın KENDİ kalanı | sayı söyler — ama S118 = B kartın KENDİ kalanını AÇIKÇA buyurur (form da ownRemaining önerir) | aile dışı (karar gereği) |
| routes/plans.mjs closeForInvoice (≈1857) | fatura iptalinde kart kapanır | kullanıcı onayı yok | aile dışı |
| routes/accounts.mjs 262 (waFacts) / 321 (list) | işlem içinde TYK yok → eski anlam | görünüm; işlem içinde çağrılan karşılaştırma yok | aile dışı |
| invoices.mjs 669 / 853, obligation-input 122, account-lines, bank/*, ledger-snapshots | önbellek işlem içinde okunmaz / yazılmaz | hayır | aile dışı |
| öbür `*-stale` kodları (plan-stale, plan-entry-stale, account-stale, cash-*, cheque-, invoice-, stock-, staff-) | satır sürümü (updatedAt) karşılaştırır | tutar değil | aile dışı |
| plan-transfer 'stale' | ön izleme parmak izi | tutar değil (Tablodan Aktar kapalı, 410) | aile dışı |
| istemci: Kartı Kapat yalnız hof-plans.js closePlan; mobil / başka yol YOK | — | — | — |
AYNI AİLE: YOK (aynı desen — işlem içinde kuyruksuz okunan sayının pencerenin kuyruklu sayısıyla karşılaştırılması — başka yerde bulunmadı).

## 3. Ekran senaryoları
- senaryo-c7b-tur3-250'ye E adımı (cari kartından 500 → Kartı Kapat): YENİ kod 39 / 0; TABAN kod (DEPO=/dev/shm/c7bfix-a66/eski, aynı yeni senaryo) 36 / 3 — beklenen nedenle:
  'ikinci soru YOK: … Kalan ₺3.000,00 açıkken …', 'kart kapandı (veri tabanı)', 'TEK istek, 200 (gelen: [409])'. Görüntüler c7bfix-ekran/tur3-yeni/08–10, tur3-eski/08–10 (bakıldı:
  yeni — soru 'Kalan ₺2.500,00', kapanınca kart Kapalı, Kalan ₺2.500,00, bildirim 'Kart kapatıldı; kalan borç carinin borcunda kalır.'; eski — uyarı 'güncel kalan 3.000,00 TL' + ikinci soru 'Kalan ₺3.000,00').
- senaryo-c7b-kabul-250 E (İKİNCİ BULGU): neden — kart penceresi 'live:workspace.changed' olayıyla kendini yeniler (hof-plans.js refreshOpen / HOF.refresher; v2.0.22'den beri).
  Tur 2f (473e4a96) ile taban (fce3d272) arasında hof-plans.js'in yenileme koduna dokunan satır YOK (`git diff 473e4a96 fce3d272 -- client/assets/hof-plans.js` — 12 satır, hiçbiri
  refresh / live / loadPlan değil). Yani ürün davranışı DEĞİŞMEDİ; adım bir YARIŞTI (tıklama canlı olaydan önce gelirse eskimiş onay oluşur, sonra gelirse oluşmaz). Ön koşul artık zorla:
  E0 pencerenin kendini yenilediğini doğrular (100 TL → Kalan ₺800,00); E'de 300 TL tahsilat SORU EKRANDAYKEN girilir (veri tabanında okunur), 409 ağdan okunur ([409, 200]).
  YENİ kod 39 / 0; TABAN kod (DEPO=eski, yeni senaryo) 39 / 0 (bu adımın konusu YB-1'in kendisi, düzeltme değil — kart tahsilatında pencere = kartın kendi hesabı).
  NOT: kanıt json'unda 'commit 317e507' yazar (koşu worktree'den, DEPO ile eski kod) — kod DEPO'dur.
- senaryo-c7bt-ayni-ad-250 YENİ 21 / 0.

## 4. Mutantlar (kopya /dev/shm/c7bfix-a66/mut; mutant.py; testler c7bfix + c7b-kart-kapat-onay, UTC)
| Mutant | Sonuç | Yakalayan |
|---|---|---|
| m1 denetimi kaldır | 6 / 12 kırmızı | K3a/K4/K5b/K8 (200 geldi) + mevcut test iki sınama |
| m2 karşılaştırma kartın kendi hesabıyla (taban davranışı) | 8 / 12 kırmızı | K1–K8 |
| m3 409'da güncel kalanı kartın kendi hesabından söyle | 4 / 12 kırmızı | K3a (3.000 ≠ 2.500), K4 (3.600 ≠ 3.100), K5b (1.200 ≠ 400), K8 (1.000 ≠ 333,34) |
| m4 kalansız kartı (onay 0) denetim dışı bırak | 3 / 12 kırmızı | K5b, K8, mevcut 'kalansız kart' |
Özgün geri yüklendi (cmp aynı).
