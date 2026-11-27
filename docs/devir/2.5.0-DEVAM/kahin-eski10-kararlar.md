# Cari kâhini bakımı 10 — GİRDİLER (ana oturumun yazdığı özet dosya; ders 5 koruması)

Bu dosya kâhine bakım 9'un dört susma sınırının (SK-20 … SK-23) kullanıcı yanıtlarını verir. Programın hesap / görünüm davranışı hakkında hiçbir bilgi içermez.

## Kullanıcıya gösterilen sorular (AYNEN; F = fatura; X, Y, Z = elle borç; kart Taksitler'den açılıyor)

S122 (bakım 9'un SK-21'i) — karta ödeme gelince hangi elle borcun "Kalan"ı düşer? Uç durum değil: birden çok elle borcu içine alan her kartta, her taksit ödemesinde çıkar. Örnek: F 600 + X 500 + Y 700, kart 900 (içinde X 500 + Y'nin 400'ü). Karta 300 ödeme geliyor.
- A (öneri): eskiden yeniye → X Kalan 200, Y Kalan 700.
- B: en yeniden → X Kalan 500, Y Kalan 400.
Bakiye, kart kalanı, gecikmiş tutar ve takvim ikisinde de aynı; değişen yalnız elle kayıtların "Kalan" sütunu.

S123 (SK-20) — elle borçların toplamı karttan azsa? (uç durum) Örnek: F 600 + X 300, kart 500. A: kart önce elle borçları, kalanını faturadan alır. B: kart reddedilir. C: uç durum böyle kalsın (bilinen sınır).

S124 (SK-22) — karta eşit iki elle borç var, önlerinde başka bir elle borç duruyorsa? (uç durum) Örnek: F 600 + Z 300 + X 900 + Y 900, kart 900. A: eskiden yeniye → kartta Z 300 + X'in 600'ü. B: karta eşit olanlardan en eskisi → kartta X 900. C: uç durum böyle kalsın (bilinen sınır).

S125 (SK-23) — "eskiden yeniye" belge tarihine göre mi, vadeye göre mi? (uç durum) Örnek: X 500 (02.03, vadesi 30.03) + Y 700 (05.03, vadesi 10.03) + F 600, kart 900. A: vade sırası. B: belge tarihi. C: uç durum böyle kalsın (bilinen sınır).

## KARAR (kullanıcı 11.11.2026, AYNEN: "s122 a şıkı, diğerleri c")

- S122 = A (PARA KURALI): Taksitler'den açılan kart birden çok elle borcu içine aldıysa karta gelen ödeme elle borçların 'Kalan'ını kartın içine alma sırasıyla, ESKİDEN YENİYE düşürür. Örnek: fatura F 600 + elle borç X 500 + elle borç Y 700, kart 900 (içinde X 500 + Y'nin 400'ü); karta 300 ödeme ⇒ X Kalan 200, Y Kalan 700 (bakiye, kart kalanı, gecikmiş ve takvim değişmez).
- S123 = C, S124 = C, S125 = C: üçü de UÇ DURUM — BİLİNEN SINIR. Kural konmadı; kâhin SK-20, SK-22, SK-23'te SUSMAYA DEVAM EDER. Bu üç kayıt artık "KULLANICIYA SORULMALI" değil "BİLİNEN SINIR (kullanıcı kararı S123 / S124 / S125 = C)" diye anılır (susma davranışı değişmez; yalnız neden metni / KARARLAR başlığı).

NOT (ana oturum): (1) S122 yalnız kartın içine BİRDEN ÇOK elle borç aldığı durumu yanıtlar; S110, S120, S2, S50, S101 kararlarının YERİNE geçmez; tek kalem içeren kartta bakım 9'un kuralı aynen. (2) "Karta gelen ödeme" sözünün kapsamı (kartın taksit tahsilatı; karta pay düşen bağsız tahsilat — bakım 9'un H10 / H11 senaryolarındaki iki yol) karar metninden tek okumayla çıkıyorsa değer yaz; çıkmıyorsa o yolda SUS ve "KULLANICIYA SORULMALI" yaz (iki seçenek + öneri; uç durumsa üçüncü seçenek "Uç durum böyle kalsın (BİLİNEN SINIR)"). (3) Ödemenin geri alınması / silinmesi / düzeltilmesi sonrası 'Kalan' için karar ayrı bir şey söylemiyor: geri alınan ödeme hiç yapılmamış gibi okunabiliyorsa (kâhinin öbür geri alma kurallarıyla aynı) öyle; tek okuma çıkmıyorsa SUS. Kendi yorumunla kesinleştirme.
