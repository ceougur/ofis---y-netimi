# M2 TUR 3 — Değersiz Alacak sınırı: S-M2T2-1 = A + S-M2T2-2 = A (2.5.1; RAPOR TASLAĞI)

Taban: `t251-m2t2` (bf7e7d21). Görev metni: `docs/devir/2.5.1-DEVAM/m2t3-istem.txt`.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)
Eksenler: işlem (iptal / silme / e-Belge iptali / Ters Kaydet iptali — hepsi aynı iptal yolu; yeni satıştan iade; iadenin Düzenle'si; satış faturası / SMM / alıştan iade TUTARININ Düzenle ile düşürülmesi;
faturanın cari değiştirmesi — bu cari için tutar 0'a düşer) × sonuç (eksi değil / yalnız Değersiz yüzünden eksi / Değersiz olmadan da eksi / zaten eksiydi, daha da eksi).
1. S-M2T2-1: ret koşulundan "Değersiz olmasaydı ≥ 0" çıkınca, Değersiz satırı olan caride eksiye götüren iptal / iade her durumda ret. Bozulma yolları: (a) bakiyeyi DÜŞÜRMEYEN işlem (alış faturası
   iptali, iade küçültme) ret almamalı — "işlem bakiyeyi düşürdü" koşulu KALIR; (b) iletideki sayılar bu durumda yanlış anlatabilir ("Değersiz yüzünden") — ayrı neden cümlesi; "en çok" tutarı
   bakiye sınırıyla 0 olur → "yazılamazdı"; (c) Değersiz satırı olmayan caride (avanslı müşteri) iptal YİNE kabul — denetim hiç okumaz; (d) Değersiz satırı silindikten sonra aynı iptal kabul
   (iletinin "ne yapmalı"sı işe yarıyor mu).
2. S-M2T2-2: satış faturası Düzenle'si bugün denetimsiz. Bozulma yolları: (a) TUTAR ARTIŞI ya da tutarı değişmeyen Düzenle (not, tarih) ret almamalı; (b) aynı Düzenle'de peşin tahsilat EKLENMESİ
   bakiyeyi düşürür — bu bir tahsilattır, tutar düşürmesi değil (sıradan tahsilat Değersiz'den sonra reddedilmiyor) → denetim YALNIZ tutar düştüğünde (ya da cari değiştiğinde) devreye girer;
   (c) cari değiştirme: eski carinin bakiyesi düşer — eski cari denetlenir; (d) taksitli fatura Düzenle'si (kart yeniden kurulur) aynı yol; (e) iadenin Düzenle'si zaten denetimli (tur 2) — iki
   denetim çakışmamalı; (f) ileti eylemi "düzenleme" diye anlatmalı.
3. Birden çok Değersiz satırı: iletide son satır + toplam; ret koşulu toplamdan bağımsız.
4. Kilitli dönem: dönem kilidi denetimi önce gelir — kilitli faturada ileti kilit iletisi kalır.
5. İki saat dilimi (UTC, Europe/Istanbul): Düzenle azalışının kaydı bugünün tarihiyle; gün sınırı.
6. Hız yolu (liste / form ucu) DOKUNULMAZ — tur 2'nin eşdeğerlik testi AYNEN geçmeli.
7. Bağlı çekin karşılıksız çıkması bakiyeyi YÜKSELTİR — farklı kök, DOKUNULMAZ (yalnız rapora).
