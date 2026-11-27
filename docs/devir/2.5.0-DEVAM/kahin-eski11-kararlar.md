# Cari kâhini bakımı 11 — GİRDİLER (ana oturumun yazdığı özet dosya; ders 5 koruması)

Bu dosya kâhine bakım 10'un SK-24 sorusunun kullanıcı yanıtını verir. Programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez.

## Kullanıcıya gösterilen soru (AYNEN)

S126 — bakiye kadar açılan kartta ödeme hangi kalemi düşürür? Uç durum değil: müşterinin bütün borcu taksitlendirildiğinde her taksit ödemesinde çıkar. Taksitler'den açılan kart carinin bütün açık borcuna eşit ve içinde fatura da var. Örnek: fatura F 600 + elle borç X 300, kart 900. Karta 300 ödeme geliyor.
- A (öneri): S122'deki kuralın aynısı, fatura dahil eskiden yeniye → F açık 300, X Kalan 300.
- B: önce elle borçlar → X Kalan 0, F açık 600.
Bakiye, kart kalanı, gecikmiş tutar ve takvim ikisinde de aynı; değişen yalnız hangi kalemin "ödendi" göründüğü.

Aynı iletide bilgi olarak gösterilen (kullanıcı itiraz etmedi → kalır): S122 = A kuralı, bakiye kadar açılan ve içindeki kalemlerin hepsi elle borç olan karta da uygulanır (örnek: X 500 + Y 400, kart 900, ödeme 300 → X Kalan 200, Y 400) — bakım 10'un Y10-3'ü.

## KARAR (kullanıcı 11.11.2026, AYNEN: "a")

S126 = A (PARA KURALI): Taksitler'den açılan kart carinin BÜTÜN açık borcuna eşitse ve içine fatura da girdiyse karta gelen ödeme kalemleri S122'deki kuralın aynısıyla, fatura DAHİL kartın içine alma sırasıyla, ESKİDEN YENİYE düşürür. Örnek: fatura F 600 + elle borç X 300, kart 900; karta 300 ödeme ⇒ F açık 300, X Kalan 300 (bakiye, kart kalanı, gecikmiş ve takvim değişmez).

NOT (ana oturum): (1) karar yalnız "açık borca EŞİT kart, içinde fatura + elle borç" durumunu yanıtlar; S110, S120, S122, S2, S50, S99, S101 kararlarının YERİNE geçmez. (2) Kartın içine giren öbür kalem türleri (yalnız faturalar — elle borç yok; stok veresiye satışı; karşılıksız kalemi; başka kartın taksiti …) ve "eskiden yeniye"nin vade ↔ belge sırası ayrışması (S125 = C BİLİNEN SINIR) için karar ayrı bir şey söylemiyor: kararın metninden ve kâhinin yürürlükteki kurallarından TEK okuma çıkıyorsa değer yaz (gerekçesiyle), çıkmıyorsa o alt durumda SUS ve "KULLANICIYA SORULMALI" yaz (iki seçenek + öneri; uç durumsa üçüncü seçenek "Uç durum böyle kalsın (BİLİNEN SINIR)"). (3) "Karta gelen ödeme"nin iki yolu (kartın taksit tahsilatı; karta pay düşen bağsız tahsilat) için bakım 10'un Y10-2 okuması geçerli sayılır. (4) Fatura açığı ile cari "açık toplamı = bakiye" değişmezi her değer carisinde elle tabloda denetlenir. Kendi yorumunla kesinleştirme.
