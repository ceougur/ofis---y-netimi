# r31e N1 + Y8 — "Nasıl bozulur?" (KODDAN ÖNCE, 23.10.2026)
Taban: is/r31e-n1 = aday11 39382c4. Karar (5 dk yetkisi, 23.10 03:12 UTC): silinen kâğıt/fiş/SMM/iç belgenin NUMARASI kullanılmış kalır (E6); TARİHİ sıra-tarih
tabanını bağlamaz. Geri yükleme sırayı bozacaksa 409, belge Silinenler'de kalır. Sıra: numara (kalıcı) → kilit (G1) → sıra-tarih. e-Belge serileri DIŞI.

## Koddan (routes/invoices.mjs)
- Taban: invoice.numberFloor {seq, number, issueDate, deleted?} — EN BÜYÜK ayrılan numara (seriden ayrılan = e-Belgeye dönüşen ya da silinen).
- nextNumber → floor.seq (numara tabanı; DEĞİŞMEZ).
- lastIssued → floor (tarih dahil) = sıra-tarih tabanı: chronologyProblem (kayıt + form ön hesabı), editChronologyProblem (bekleyen dalı + komşu), withdraw,
  sendBlockOf (kâğıt serisi kolu), olderPending (e-Belge serisi; orada taban yok). Silinen belgenin tarihi BURADAN bağlıyor (N1).
- v32 scanPaperFloors: 2.4.3 verisinde taşınan numara (paper_no, invoice.withdrawn) + Silinenler'deki belge → en büyük sıra; en büyüğü silinmişse taşınan
  numaranın tarihi kayboluyor (yalnız silinenin tarihi kalıyor). v32 hiçbir yayımlanmış sürümde yok (v2.4.3 şema 30) → yeni şema sürümü gerekmez.

## Nasıl bozulur (testler buradan)
1. N1 kökü: fiş 1 (b−5) → fiş 2 b (yanlış) → Sil → b−3 yeni fiş → 200, FIS…003 (numara 002 yeniden verilmez); b−6 → 400 (canlı 001'den eski).
2. Toplu silme: en geç tarihli silinen belge seriyi o güne bağlamaz.
3. Silinen belge en büyük numarayken altta e-Belgeye taşınmış numara (canlı, tarihli) varsa onun tarihi taban kalır (silme onu silmez) — yeni yazımda ve v32'de.
4. Geri yükleme: büyük numaralı canlı belge daha eski tarihli → 409 (ileti numara + tarih; Silinenler'de kalır); küçük numaralı canlı belge daha yeni tarihli → 409;
   sıra bozulmuyorsa 200 kendi numarasıyla; iptal edilmiş belge de sırada (iptal edilmiş büyük numaralı belge de bozar).
5. Sıra: numara alınmış + kilitli + sıra bozuk → invoice-number-taken; kilitli + sıra bozuk → period-locked; yalnız sıra bozuk → sıra iletisi.
6. Düzenle: canlı belgenin tarihi silinen komşunun tarihine bağlı değil (ileri/geri alınabilir); geri yüklemede bu yine denetlenir.
7. Bırakma (Müşteri Fişi / Kâğıt Makbuz Olarak Bırak) ve e-Belge gönderim engeli: silinen fişin tarihi bırakmayı engellemez.
8. e-Belge serileri değişmez: e-Arşiv son numarası silinince (EDM'ye ulaşmamış) MAX(seq) kuralı aynen; kronoloji canlı belgelere göre (zaten).
9. Taslak / numarasız bekleyen silmek tabanı değiştirmez (E6 S4 aynen).
10. 002 şirketi kendi tabanını tutar (E6 S6 aynen; şirket başına store).
11. Eski taban kaydı (aday yapılarının yazdığı, kept alanı yok) okunur: silinmişse tarih bağlamaz, taşınan tarih bilinmez (yalnız test verisi).
12. Y8: 600 TL fatura + formdan 400 TL kendi çeki → Düzenle → taksitli 200 (M6q mutantında 409).
