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
