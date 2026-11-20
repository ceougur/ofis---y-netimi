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
