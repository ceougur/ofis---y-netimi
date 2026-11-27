# Cari kâhini bakımı 12 — GİRDİLER (ana oturumun yazdığı özet dosya; ders 5 koruması)

Bu dosya kâhine bakım 11'in SK-25 sorusunun kullanıcı yanıtını verir. Programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez.

## Kullanıcıya gösterilen soru (AYNEN)

S128 — kartın içinde fatura ve elle borç dışında kalem varsa (para kuralı; uç durum). Taksitler'den açılan kart carinin bütün açık borcuna eşit ve içine stok veresiye satışı gibi başka türden bir kalem de girmiş. Karta gelen ödeme hangi kalemi düşürsün? Örnek: 01.03 stok veresiye satışı S 400, 02.03 elle borç X 300, 15.03 kart 700, 10.04 karta 300 ödeme.
- A (öneri): türüne bakılmadan eskiden yeniye — S açığı 100, X Kalan 300. S122 ve S126'da verilen kararın devamı.
- B: önce fatura ve elle borçlar — X Kalan 0, S açığı 400.
- C: uç durum böyle kalsın (BİLİNEN SINIR olarak yazılır; kâhin bu durumda susar).
Bakiye ve kart kalanı üç seçenekte de 400.

Aynı iletide bilgi olarak gösterilen (kullanıcı itiraz etmedi → kalır): bakım 11'in Y11-7'si — S126 kuralı içinde yalnız faturalar olan (elle borç olmayan) açık borca eşit karta da uygulanır (eskiden yeniye).

## KARAR (kullanıcı 11.11.2026, AYNEN: "ikiside a")

S128 = A (PARA KURALI): Taksitler'den açılan kart carinin bütün açık borcuna eşitse ve içine fatura / elle borç dışında bir kalem de girdiyse (stok veresiye satışı, karşılıksız kalemi, başka kartın ya da taksitli faturanın taksiti) karta gelen ödeme kalemleri TÜRÜNE BAKILMADAN, kartın içine alma sırasıyla ESKİDEN YENİYE düşürür. Örnek: 01.03 stok veresiye satışı S 400 · 02.03 elle borç X 300 · 15.03 kart 700 · 10.04 karta 300 ödeme ⇒ S açığı 100, X Kalan 300 (bakiye 400, kart kalanı 400).

NOT (ana oturum): (1) karar yalnız "açık borca EŞİT kart, içinde fatura / elle borç dışında kalem de var" durumunu yanıtlar; S110, S120, S122, S126, S2, S50, S99, S101 kararlarının ve bakım 11'in kurallarının YERİNE geçmez. (2) Bakım 11'in Y11-7'si (yalnız faturalı kart) KALIR — artık 'baş mimarın değerlendirmesine' notu kalkar, kullanıcıya gösterildi. (3) "Eskiden yeniye"nin vade ↔ belge sırası ayrışması (S125 = C BİLİNEN SINIR, SK-23) AYNEN: iki sıra farklı pay veriyorsa SUS. (4) Kararın saydığı dört tür (stok veresiye satışı, karşılıksız kalemi, başka kartın taksiti, taksitli faturanın taksiti) için: kararın metninden ve kâhinin yürürlükteki kurallarından TEK okuma çıkıyorsa değer yaz (gerekçesiyle); bir türde "kalemin açığı / kalanı" kavramı kâhinde tanımlı değilse ya da iki okuma varsa o alt durumda SUS ve "KULLANICIYA SORULMALI" yaz (iki seçenek + öneri; uç durumsa üçüncü seçenek "Uç durum böyle kalsın (BİLİNEN SINIR)"). (5) "Karta gelen ödeme"nin iki yolu için bakım 10'un Y10-2 okuması, silme / geri yükleme için Y10-5 geçerli sayılır. (6) Cari "açık toplamı = bakiye" değişmezi her değer carisinde elle tabloda denetlenir. Kendi yorumunla kesinleştirme.
