| Şirket | Olgu | Sonuç | Karar / not | Sayılar |
|---|---|---|---|---|
| * | şirket listesi | EŞİT |  | {"count": 2} |
| * | kullanıcı ayse | EŞİT |  | {"permissions": 18} |
| * | kullanıcı mehmet | EŞİT |  | {"permissions": 40} |
| * | kullanıcı admin | BELGELİ | K-19 Personel Özlük (yeni yetkiler yalnız yöneticide) | {"gained": ["staff.manage", "staff.view"]} |
| * | kullanıcı zeynep | EŞİT |  | {"permissions": 6} |
| * | roller | EŞİT |  | {} |
| 001 | cari bakiyeleri (tek tek) | EŞİT |  | {"count": 3211, "sum": 1097056626} |
| 001 | mizan (her hesap) | EŞİT |  | {"accounts": 22} |
| 001 | mizan toplamı | EŞİT |  | {"debit": 5127058427, "credit": 5127058427, "difference": 0} |
| 001 | defter mutabakatı | EŞİT |  | {"checks": 16} |
| 001 | Mutabakat Testi sapmaları | EŞİT |  | {"failures": 0} |
| 001 | Mutabakat Testi denetimleri | EŞİT |  | {"ok": 87, "newOk": []} |
| 001 | dönem kilidi | EŞİT |  | {"lockedUntil": "2026-04-23"} |
| 001 | Kasa (toplam, yol başına, satırlar) | EŞİT |  | {"totals": {"in": 8807550.77, "out": 3824492.98, "balance": 4983057.79}, "rows": 2064} |
| 001 | banka hesapları (tek tek) | EŞİT |  | {"accounts": 2} |
| 001 | Banka özeti | EŞİT |  | {} |
| 001 | çek/senet (tek tek: durum, tutar, cari, fatura) | EŞİT |  | {"count": 430, "byStatus": {"portfolio": 33, "pending": 4, "collected": 175, "bounced": 83, "endorsed": 82, "paid": 53}} |
| 001 | taksit kartları (tek tek) | EŞİT |  | {"count": 228} |
| 001 | taksit toplamları | EŞİT |  | {"total": 367042040, "paid": 19280000, "remaining": 347762040, "overdue": 289710180, "overdueCount": 1028, "month": 45003649, "count": 228} |
| 001 | stok (tek tek) | EŞİT |  | {"count": 40} |
| 001 | KDV mahsup fişleri | EŞİT |  | {"count": 13} |
| 001 | tablo (veri oturumu) | EŞİT |  | {"hasData": true, "label": "MUSTERILER.xlsx", "rowCount": 10240, "tabs": ["Borçlular", "Ödeme Sözleri", "Taksitler", "Servis Ücretleri", "Aidatlar"]} |
| 001 | şüpheli alacaklar | EŞİT |  | {} |
| 001 | Gönderilecekler | EŞİT |  | {"count": 0} |
| 001 | seri adları | EŞİT |  | {"paper": "FIS", "earsiv": "EAR", "efatura": "EFT", "smm": "SMM", "esmm": "ESM", "internal": "IAD"} |
| 001 | Silinenler (çöp kutusu) | EŞİT |  | {"count": 6, "byKind": {"invoice": 6}, "faturaSilinen": 18, "faturaSilinenNumarasiCanlida": 0} |
| 001 | geri yükleme uyarısı (30b; göçte yok) | EŞİT |  | {} |
| 001 | Yevmiye (bütün satırlar) | BELGELİ | MM8 aynı gün sırası belge → tahsilat/ödeme (karar 22.10.2026; satır kümesi her gün aynı) | {"satir": [10873, 10873], "gun": 288, "kumesiDegisenGun": [], "kumesiDegisenGunSayisi": 0, "sirasiDegisenGun": 284, "kuralaUymayanGunSonra": [], "kuralaUymayanGunSonraSayisi": 0, "kuralaUymayanGunOnce": 281, "islemSiniflari": {"Satış faturası": "belge", "St… |
| 001 | faturalar (tür, durum, numara, ETTN, tarih, cari, profil, e-Belge durumu, tutar) | EŞİT |  | {"count": 1178, "byProfile": {"KAGIT": 822, "EARSIVFATURA": 295, "TEMELFATURA": 61}, "byEStatus": {"none": 794, "sent": 342, "cancelled": 10, "waiting": 4, "withdrawn": 28}} |
| 001 | faturaların ödeme durumu | BELGELİ | K-UX18/F2/F3 karşılıksız evrak kapamadan çıkar (madde 15, 31a; kararlar 22.10.2026) | {"invoices": 62, "caris": 53, "reopenedMinor": 45658895, "payState": {"overdue→overdue": 48, "paid→overdue": 14}, "byKind": {"sale": 48, "purchase": 13, "smm": 1}} |
| 001 | ANLIK DURUM · faturalar | BELGELİ | K-UX18 (açık fatura farkı = faturaların farkı) | {"openSale": [5902483.02, 6308531.69], "openPurchase": [894240.1, 944780.38]} |
| 001 | e-Belge kartları (İptal Et / Gönder / Bırak düğmeleri) | BELGELİ | K-23 iptal süresi iletimden 8 gün (madde 23) | {"cards": 1178, "iptalKapandi": 268, "sureIcindeAcikKalan": 0} |
| 001 | sıradaki numara · paper | BELGELİ | K-v32 / numara tekil: verilmiş fiş numarası bir daha verilmez (karar 22.10.2026) | {"givenMax": 259, "givenLiveMax": 259, "silinenYukseltti": false, "eskiSurumYenidenVerirdi": true} |
| 001 | sıradaki numara · earsiv | EŞİT |  | {"next": "EAR2026000000001", "givenMax": 0, "givenLiveMax": 0} |
| 001 | sıradaki numara · efatura | EŞİT |  | {"next": "EFT2026000000001", "givenMax": 0, "givenLiveMax": 0} |
| 001 | sıradaki numara · smm | BELGELİ | K-v32 + E6: verilmiş numara (silinenler dahil) bir daha verilmez (kararlar 22.10.2026) | {"givenMax": 67, "givenLiveMax": 66, "silinenYukseltti": true, "eskiSurumYenidenVerirdi": true} |
| 001 | sıradaki numara · internal | EŞİT |  | {"next": "IAD2026000000015", "givenMax": 14, "givenLiveMax": 14} |
| 001 | sıradaki numara · esmm | BELGELİ | K-24 e-SMM açık (server.mjs esmmEnabled) | {"next": "ESM2026000000001"} |
| 001 | rapor alacak-yaslandirma | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 40604867, "purchaseDelta": 5054028, "total": [1163, 1163], "badCount": 0} |
| 001 | rapor fatura-satis | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 40604867, "purchaseDelta": 5054028, "total": [850, 850], "badCount": 0} |
| 001 | rapor fatura-alis | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 40604867, "purchaseDelta": 5054028, "total": [256, 256], "badCount": 0} |
| 001 | rapor acik-faturalar | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 40604867, "purchaseDelta": 5054028, "total": [719, 733], "badCount": 0} |
| 001 | rapor yevmiye | BELGELİ | MM8 aynı gün sırası (ön izlemenin ilk 200 satırı; TOPLAM, özet ve bütün satırların günlük kümesi aynı — yukarıda) | {"diffKeys": ["rowsDigest"]} |
| 001 | rapor kayit-tahsilatlari | BELGELİ | K-5 metin: rapor adı "Kayıt Tahsilatları" (madde 5) | {} |
| 001 | rapor merkezi (öbür raporlar) | EŞİT |  | {"equalReports": 56} |
| 001 | Tablodaki Kişiler — kayıt borcu (30a/E2/E3/U2) | BELGELİ | 30a Kalan Borç önceliği + E2 boşsa Toplam + E3 gün/adet tutar değil + U2 söz borç değil, dosya no tek kayıt (kararlar 22.10.2026) | {"kayit": 9640, "kuralli": 9640, "borcOnce": 18814730000, "borcSonra": 17445830000, "fark": 1368900000, "ayristirma": {"30a Toplam−Kalan (ilk sekme)": 1744200000, "K-31a F4 Taksitler (Toplam)": -317220000, "K-31a F4 + E3 Servis (Aylık Ücret; Kalan Gün değil… |
| 001 | Tablodaki Kişiler (kayıt başına tahsilat) | BELGELİ | K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a) | {"changed": 452, "byReason": {"aynı anahtar iki sekmede (K-5c)": 28, "kayda bağlı cari (K-5)": 134, "ilk sekme dışı (K-31a F4 sekme başına analiz)": 406, "kayda bağlı / carisinin taksit kartı (K-31a F1/F5)": 114}} |
| 001 | Vade Takip (kayıt başına kalemler) — Toplam Borç → Kalan Borç | BELGELİ | 30a: Kalan Borç önceliği (aday 6 B1; kullanıcı kararı 22.10.2026 ~16:55 "önerin uygun") | {"keys": 1048, "minorBefore": 2110710000, "minorAfter": 1582580000} |
| 001 | Tahsilat Takvimi / ödeme sözü (kayıt başına kalemler) — Toplam Borç → Kalan Borç | BELGELİ | 30a: Kalan Borç önceliği (aday 6 B1; kullanıcı kararı 22.10.2026 ~16:55 "önerin uygun") | {"keys": 917, "minorBefore": 1856510000, "minorAfter": 1391060000} |
| 001 | Tahsilat Takvimi / ödeme sözü (kayıt başına kalemler) | BELGELİ | K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a) | {"changed": 62, "byReason": {"vadeli fatura kalemi, fatura yeniden açıldı (K-UX18)": 62}} |
| 001 | Nakit Akışı | BELGELİ | MM6 Kasa sütunları = 2.4.3 Kasa Hareketleri toplamı; Beklenen farkı = Vade Takip farkı (30a); Gerçekleşen K-5/F5 | {"kasaRaporu243": {"giris": 294637461, "cikis": 48276296}, "beklenenFarki": -528130000, "vadeTakipFarki": -528130000, "gerceklesenFarki": 14593106} |
| 002 | cari bakiyeleri (tek tek) | EŞİT |  | {"count": 926, "sum": 556322937} |
| 002 | mizan (her hesap) | EŞİT |  | {"accounts": 22} |
| 002 | mizan toplamı | EŞİT |  | {"debit": 3530509108, "credit": 3530509108, "difference": 0} |
| 002 | defter mutabakatı | EŞİT |  | {"checks": 16} |
| 002 | Mutabakat Testi sapmaları | EŞİT |  | {"failures": 0} |
| 002 | Mutabakat Testi denetimleri | EŞİT |  | {"ok": 87, "newOk": []} |
| 002 | dönem kilidi | EŞİT |  | {"lockedUntil": ""} |
| 002 | Kasa (toplam, yol başına, satırlar) | EŞİT |  | {"totals": {"in": 4428060.17, "out": 1876720.54, "balance": 2551339.63}, "rows": 892} |
| 002 | banka hesapları (tek tek) | EŞİT |  | {"accounts": 2} |
| 002 | Banka özeti | EŞİT |  | {} |
| 002 | çek/senet (tek tek: durum, tutar, cari, fatura) | EŞİT |  | {"count": 170, "byStatus": {"portfolio": 11, "pending": 1, "collected": 65, "endorsed": 37, "bounced": 33, "paid": 23}} |
| 002 | taksit kartları (tek tek) | EŞİT |  | {"count": 83} |
| 002 | taksit toplamları | EŞİT |  | {"total": 164411940, "paid": 6060000, "remaining": 158351940, "overdue": 123436372, "overdueCount": 362, "month": 15238770, "count": 83} |
| 002 | stok (tek tek) | EŞİT |  | {"count": 40} |
| 002 | KDV mahsup fişleri | EŞİT |  | {"count": 13} |
| 002 | tablo (veri oturumu) | EŞİT |  | {"hasData": true, "label": "MUSTERILER.xlsx", "rowCount": 1780, "tabs": ["Borçlular", "Ödeme Sözleri", "Taksitler", "Servis Ücretleri", "Aidatlar"]} |
| 002 | şüpheli alacaklar | EŞİT |  | {} |
| 002 | Gönderilecekler | EŞİT |  | {"count": 0} |
| 002 | seri adları | EŞİT |  | {"paper": "FIS", "earsiv": "EAR", "efatura": "EFT", "smm": "SMM", "esmm": "ESM", "internal": "IAD"} |
| 002 | Silinenler (çöp kutusu) | EŞİT |  | {"count": 13, "byKind": {"invoice": 13}, "faturaSilinen": 19, "faturaSilinenNumarasiCanlida": 7} |
| 002 | geri yükleme uyarısı (30b; göçte yok) | EŞİT |  | {} |
| 002 | Yevmiye (bütün satırlar) | BELGELİ | MM8 aynı gün sırası belge → tahsilat/ödeme (karar 22.10.2026; satır kümesi her gün aynı) | {"satir": [4794, 4794], "gun": 288, "kumesiDegisenGun": [], "kumesiDegisenGunSayisi": 0, "sirasiDegisenGun": 280, "kuralaUymayanGunSonra": [], "kuralaUymayanGunSonraSayisi": 0, "kuralaUymayanGunOnce": 226, "islemSiniflari": {"Satış faturası": "belge", "Stok… |
| 002 | faturalar (tür, durum, numara, ETTN, tarih, cari, profil, e-Belge durumu, tutar) | EŞİT |  | {"count": 620, "byProfile": {"KAGIT": 485, "EARSIVFATURA": 116, "TEMELFATURA": 19}, "byEStatus": {"none": 474, "sent": 132, "withdrawn": 11, "waiting": 2, "cancelled": 1}} |
| 002 | faturaların ödeme durumu | BELGELİ | K-UX18/F2/F3 karşılıksız evrak kapamadan çıkar (madde 15, 31a; kararlar 22.10.2026) | {"invoices": 24, "caris": 21, "reopenedMinor": 18233866, "payState": {"paid→overdue": 2, "overdue→overdue": 22}, "byKind": {"purchase": 5, "sale": 19}} |
| 002 | ANLIK DURUM · faturalar | BELGELİ | K-UX18 (açık fatura farkı = faturaların farkı) | {"openSale": [3807178.41, 3962398.43], "openPurchase": [491547.21, 518665.85]} |
| 002 | e-Belge kartları (İptal Et / Gönder / Bırak düğmeleri) | BELGELİ | K-23 iptal süresi iletimden 8 gün (madde 23) | {"cards": 620, "iptalKapandi": 105, "sureIcindeAcikKalan": 0} |
| 002 | sıradaki numara · paper | BELGELİ | K-v32 / numara tekil: verilmiş fiş numarası bir daha verilmez (karar 22.10.2026) | {"givenMax": 110, "givenLiveMax": 110, "silinenYukseltti": false, "eskiSurumYenidenVerirdi": true} |
| 002 | sıradaki numara · earsiv | EŞİT |  | {"next": "EAR2026000000001", "givenMax": 0, "givenLiveMax": 0} |
| 002 | sıradaki numara · efatura | EŞİT |  | {"next": "EFT2026000000001", "givenMax": 0, "givenLiveMax": 0} |
| 002 | sıradaki numara · smm | BELGELİ | K-v32 + E6: verilmiş numara (silinenler dahil) bir daha verilmez (kararlar 22.10.2026) | {"givenMax": 120, "givenLiveMax": 119, "silinenYukseltti": true, "eskiSurumYenidenVerirdi": true} |
| 002 | sıradaki numara · internal | EŞİT |  | {"next": "IAD2026000000009", "givenMax": 8, "givenLiveMax": 8} |
| 002 | sıradaki numara · esmm | BELGELİ | K-24 e-SMM açık (server.mjs esmmEnabled) | {"next": "ESM2026000000001"} |
| 002 | rapor alacak-yaslandirma | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 15522002, "purchaseDelta": 2711864, "total": [428, 428], "badCount": 0} |
| 002 | rapor fatura-satis | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 15522002, "purchaseDelta": 2711864, "total": [466, 466], "badCount": 0} |
| 002 | rapor fatura-alis | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 15522002, "purchaseDelta": 2711864, "total": [120, 120], "badCount": 0} |
| 002 | rapor acik-faturalar | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 15522002, "purchaseDelta": 2711864, "total": [428, 430], "badCount": 0} |
| 002 | rapor yevmiye | BELGELİ | MM8 aynı gün sırası (ön izlemenin ilk 200 satırı; TOPLAM, özet ve bütün satırların günlük kümesi aynı — yukarıda) | {"diffKeys": ["rowsDigest"]} |
| 002 | rapor kayit-tahsilatlari | BELGELİ | K-5 metin: rapor adı "Kayıt Tahsilatları" (madde 5) | {} |
| 002 | rapor merkezi (öbür raporlar) | EŞİT |  | {"equalReports": 56} |
| 002 | Tablodaki Kişiler — kayıt borcu (30a/E2/E3/U2) | BELGELİ | 30a Kalan Borç önceliği + E2 boşsa Toplam + E3 gün/adet tutar değil + U2 söz borç değil, dosya no tek kayıt (kararlar 22.10.2026) | {"kayit": 1630, "kuralli": 1630, "borcOnce": 3075900000, "borcSonra": 2883150000, "fark": 192750000, "ayristirma": {"30a Toplam−Kalan (ilk sekme)": 294470000, "K-31a F4 Taksitler (Toplam)": -82320000, "K-31a F4 + E3 Servis (Aylık Ücret; Kalan Gün değil)": -… |
| 002 | Tablodaki Kişiler (kayıt başına tahsilat) | BELGELİ | K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a) | {"changed": 142, "byReason": {"aynı anahtar iki sekmede (K-5c)": 16, "kayda bağlı cari (K-5)": 34, "kayda bağlı / carisinin taksit kartı (K-31a F1/F5)": 30, "ilk sekme dışı (K-31a F4 sekme başına analiz)": 123}} |
| 002 | Vade Takip (kayıt başına kalemler) — Toplam Borç → Kalan Borç | BELGELİ | 30a: Kalan Borç önceliği (aday 6 B1; kullanıcı kararı 22.10.2026 ~16:55 "önerin uygun") | {"keys": 159, "minorBefore": 319660000, "minorAfter": 241520000} |
| 002 | Tahsilat Takvimi / ödeme sözü (kayıt başına kalemler) — Toplam Borç → Kalan Borç | BELGELİ | 30a: Kalan Borç önceliği (aday 6 B1; kullanıcı kararı 22.10.2026 ~16:55 "önerin uygun") | {"keys": 135, "minorBefore": 270220000, "minorAfter": 201660000} |
| 002 | Tahsilat Takvimi / ödeme sözü (kayıt başına kalemler) | BELGELİ | K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a) | {"changed": 24, "byReason": {"vadeli fatura kalemi, fatura yeniden açıldı (K-UX18)": 24}} |
| 002 | Nakit Akışı | BELGELİ | MM6 Kasa sütunları = 2.4.3 Kasa Hareketleri toplamı; Beklenen farkı = Vade Takip farkı (30a); Gerçekleşen K-5/F5 | {"kasaRaporu243": {"giris": 123506720, "cikis": 23590441}, "beklenenFarki": -78140000, "vadeTakipFarki": -78140000, "gerceklesenFarki": 2772035} |
| 001 | veri dosyası: şema sürümü | BELGELİ | göç v31 + v32 | {"integrity": "ok"} |
| 001 | veri dosyası: tablolar ve satır sayıları | BELGELİ | K-19 staff_members (boş) + ayar satırları (K-v32 numberFloor, K-16 Başlarken) | {"newTables": ["staff_members"], "lostTables": [], "counts": [["settings", 27, 29]], "numberFloor": "{\"FIS2026\":{\"seq\":259,\"number\":\"FIS2026000000259\",\"issueDate\":\"2026-10-07\"},\"SMM2026\":{\"seq\":67,\"number\":\"SMM2026000000067\",\"issueDate\… |
| 002 | veri dosyası: şema sürümü | BELGELİ | göç v31 + v32 | {"integrity": "ok"} |
| 002 | veri dosyası: tablolar ve satır sayıları | BELGELİ | K-19 staff_members (boş) + ayar satırları (K-v32 numberFloor, K-16 Başlarken) | {"newTables": ["staff_members"], "lostTables": [], "counts": [["settings", 21, 23]], "numberFloor": "{\"FIS2026\":{\"seq\":110,\"number\":\"FIS2026000000110\",\"issueDate\":\"2026-10-05\"},\"FIS2025\":{\"seq\":73,\"number\":\"FIS2025000000073\",\"issueDate\… |

### tatbikat: 46/46 denetim geçti
- ✓ C10 001 göçten sonra (geri yükleme yok) Fatura'da geri yükleme uyarısı yok (30b) — {"notice": null}
- ✓ C10 002 göçten sonra (geri yükleme yok) Fatura'da geri yükleme uyarısı yok (30b) — {"notice": null}
- ✓ C3 001 2.4.3'ten kalan 0 bekleyen e-Belge 2.4.4'ten Tümünü Gönder ile gitti; numara sırası = tarih sırası — {"pendingBefore": 0, "pendingAfter": 0, "cancelledPending": [], "turns": [{"ok": 0, "failed": []}], "sent": 0, "eStatus": {}, "orderBad": [], "oldest": null}
- ✓ C1 001 bırakılan fiş numarası verilmiş en büyükten sonra (A FIS2026000000260, B FIS2026000000261); gönderilen A'nın fişi Kâğıt Fatura No'da — {"leftA": "FIS2026000000260", "leftB": "FIS2026000000261", "givenMax": 259, "aPaperNo": "FIS2026000000260", "aNumber": "TEA2026118068995", "aEStatus": "sent", "sentA": true}
- ✓ C2 001 e-SMM "Kâğıt Makbuz Olarak Bırak" SMM numarası verilmiş en büyükten sonra (SMM2026000000068) — {"got": "SMM2026000000068", "givenMax": 67}
- ✓ C2b 001 bırakılan kâğıt makbuz e-SMM olarak gönderilemez (istek reddedilir; kart ve EDM değişmez)
- ✓ C3 001 e-Arşiv / e-SMM / e-Fatura gönderildi (sahte EDM) — {"earsiv": ["TEA2026118068994", "sent"], "esmm": ["TES2026602224625", "ESMM", "sent"], "efatura": ["TEF2026660694265", "sent"], "smmSent": 1, "violations": []}
- ✓ C5 001 çalışmadan sonra Mutabakat Testi'nde yeni sapma yok, mizan dengede — {"newFailures": [], "trialTotals": {"debit": 5128053427, "credit": 5128053427, "difference": 0}, "cashDelta": 350}
- ✓ C5 001 yeniden açılan faturaya 100 TL Kapatılacak Fatura'lı tahsilat açığı 100 TL azaltır — {"invoice": "TEF2026660694264", "before": 2937600, "after": 2927600}
- ✓ C3 002 2.4.3'ten kalan 0 bekleyen e-Belge 2.4.4'ten Tümünü Gönder ile gitti; numara sırası = tarih sırası — {"pendingBefore": 0, "pendingAfter": 0, "cancelledPending": [], "turns": [{"ok": 0, "failed": []}], "sent": 0, "eStatus": {}, "orderBad": [], "oldest": null}
- ✓ C1 002 bırakılan fiş numarası verilmiş en büyükten sonra (A FIS2026000000111, B FIS2026000000112); gönderilen A'nın fişi Kâğıt Fatura No'da — {"leftA": "FIS2026000000111", "leftB": "FIS2026000000112", "givenMax": 110, "aPaperNo": "FIS2026000000111", "aNumber": "TEA2026508235316", "aEStatus": "sent", "sentA": true}
- ✓ C2 002 e-SMM "Kâğıt Makbuz Olarak Bırak" SMM numarası verilmiş en büyükten sonra (SMM2026000000121) — {"got": "SMM2026000000121", "givenMax": 120}
- ✓ C2b 002 bırakılan kâğıt makbuz e-SMM olarak gönderilemez (istek reddedilir; kart ve EDM değişmez)
- ✓ C3 002 e-Arşiv / e-SMM / e-Fatura gönderildi (sahte EDM) — {"earsiv": ["TEA2026508235315", "sent"], "esmm": ["TES2026484027801", "ESMM", "sent"], "efatura": ["TEF2026573878145", "sent"], "smmSent": 2, "violations": []}
- ✓ C5 002 çalışmadan sonra Mutabakat Testi'nde yeni sapma yok, mizan dengede — {"newFailures": [], "trialTotals": {"debit": 3531504108, "credit": 3531504108, "difference": 0}, "cashDelta": 350}
- ✓ C5 002 yeniden açılan faturaya 100 TL Kapatılacak Fatura'lı tahsilat açığı 100 TL azaltır — {"invoice": "TEA2026508235298", "before": 1141200, "after": 1131200}
- ✓ C4 2.4.4'te verilen kâğıt/fiş/SMM numaraları biçimde ve eski verilmişlerle çakışmıyor — {"given": ["FIS2026000000260", "FIS2026000000261", "SMM2026000000068", "FIS2026000000111", "FIS2026000000112", "SMM2026000000121"]}
- ✓ C6 002 yedek → çalış → geri yükle: olgular yedek anıyla aynı — {"diff": [], "backup": "destekofis-002-2026-10-23T05-11-58-803Z-manuel.sqlite"}
- ✓ C10 002 geri yüklemeden sonra Fatura'da tek seferlik uyarı VAR (yalnız bu şirkette) — {"notice": {"at": "2026-10-23T05:12:14.336Z", "backupAt": "2026-10-23T05:11:58.803Z", "edoc": true, "test": true, "canDismiss": true}, "otherNotice": null}
- ✓ C10 002 uyarı kapatılınca gider — {"dismissed": {"dismissed": true, "restoreNotice": null}}
- ✓ C7 002 geri yüklemesi 001'i değiştirmedi — {"diff": []}
- ✓ C8 002 geri yüklemeden sonra numaralar yedek anının sırasından sürer, veride tekrar yok — {"dup": [], "eskiVeridekiTekrar": 6, "w3Fis": "FIS2026000000113", "momentNextPaper": "FIS2026000000113", "w2Fis": "FIS2026000000113"}
- ✓ C8 002 GÖZLEM: ara dönemde EDM'ye gitmiş e-Arşiv numarası (TEA2026508235317) geri yüklemeden sonra yeniden verildi mi
- ✓ C6 001 geri yükleme (001: yeniden açılışta) uygulandı — {"staged": {"ok": true, "name": "destekofis-001-2026-10-23T05-12-36-065Z-manuel.sqlite", "safety": "destekofis-001-2026-10-23T05-12-57-468Z-geri-yukleme-oncesi-001.sqlite", "by": "user-61f098f5-db43-45cf-b8cb-6795908a1508", "byName": "Ofis yöneticisi", "at": "2026-10-23T05:12:58.133Z"}}
- ✓ C6 001 yedek → çalış → geri yükle: olgular yedek anıyla aynı — {"diff": [], "backup": "destekofis-001-2026-10-23T05-12-36-065Z-manuel.sqlite"}
- ✓ C10 001 geri yüklemeden sonra Fatura'da tek seferlik uyarı VAR (yalnız bu şirkette) — {"notice": {"at": "2026-10-23T05:12:58.117Z", "backupAt": "2026-10-23T05:12:36.065Z", "edoc": true, "test": true, "canDismiss": true}, "otherNotice": null}
- ✓ C10 001 uyarı kapatılınca gider — {"dismissed": {"dismissed": true, "restoreNotice": null}}
- ✓ C7 001 geri yüklemesi 002'i değiştirmedi — {"diff": []}
- ✓ C8 001 geri yüklemeden sonra numaralar yedek anının sırasından sürer, veride tekrar yok — {"dup": [], "eskiVeridekiTekrar": 9, "w3Fis": "FIS2026000000262", "momentNextPaper": "FIS2026000000262", "w2Fis": "FIS2026000000262"}
- ✓ C8 001 GÖZLEM: ara dönemde EDM'ye gitmiş e-Arşiv numarası (TEA2026118068996) geri yüklemeden sonra yeniden verildi mi
- ✓ C9 002 2.4.3 yedeği (destekofis-002-2026-10-23T01-54-08-054Z-manuel.sqlite) 2.4.4'e geri yüklendi: şema 32, numara tabanı göçtekiyle aynı
- ✓ C9 002 geri yüklenen 2.4.3 yedeğinin olguları göç ölçüsüyle (aynı veri, göç açılışta) aynı — {"diff": []}
- ✓ C10 002 2.4.3 yedeği geri yüklenince de uyarı VAR; kapatılınca gider — {"notice": {"at": "2026-10-23T05:13:39.717Z", "backupAt": "2026-10-23T01:54:08.054Z", "edoc": true, "test": true, "canDismiss": true}}
- ✓ C7 002 2.4.3 yedeğinin geri yüklenmesi 001'i değiştirmedi — {"diff": []}
- ✓ C9 001 2.4.3 yedeği (destekofis-001-2026-10-23T01-54-07-703Z-manuel.sqlite) 2.4.4'e geri yüklendi: şema 32, numara tabanı göçtekiyle aynı
- ✓ C9 001 geri yüklenen 2.4.3 yedeğinin olguları göç ölçüsüyle (aynı veri, göç açılışta) aynı — {"diff": []}
- ✓ C10 001 2.4.3 yedeği geri yüklenince de uyarı VAR; kapatılınca gider — {"notice": {"at": "2026-10-23T05:14:00.409Z", "backupAt": "2026-10-23T01:54:07.703Z", "edoc": true, "test": true, "canDismiss": true}}
- ✓ C7 001 2.4.3 yedeğinin geri yüklenmesi 002'i değiştirmedi — {"diff": []}
- ✓ C11k 001 G1: kapanmış dönem (2026-04-23) tarihli silinmiş belge (FIS2026000000215, 2026-04-14) geri yüklenmez (409), Silinenler'de kalır; Mutabakat Testi'nde yeni sapma yok; Kasa girişi 200 — {"status": 409, "message": "Bu satış faturası 14.04.2026 tarihli; 23.04.2026 ve öncesi kapatılmış (kilitli) dönemdir. Değişiklik için yönetici dönem kilidini açmalı.", "still": 1, "newFailures": [], "kasa": [200, ""], "kilitliTarihliSilinen": 2}
- ✓ C11 001 E6: numarası canlı belgede olan silinmiş belge YOK (veride bu durum oluşmadı) — {"items": 4}
- ✓ C11 001 E6: numarası boşta olan silinmiş belge (SMM2026000000067) kendi numarasıyla geri gelir — {"status": 200, "message": "Serbest Meslek Makbuzu SMM2026000000067 geri geldi (iptal edilmiş, etkisiz).", "back": ["SMM2026000000067", "cancelled"]}
- ✓ C11 001 E6: sıradaki kâğıt/fiş/SMM/iç numara verilmiş en büyükten (silinenler dahil) sonra; geri yükleme sıradakini değiştirmedi
- ✓ C11k 002 G1: kapanmış dönem tarihli silinmiş belge YOK (kilit yok) — {"trashInvoices": 13}
- ✓ C11 002 E6: numarası (SMM2026000000098) canlı başka belgede olan silinmiş belge geri yüklenmez (409), Silinenler'de kalır
- ✓ C11 002 E6: numarası boşta olan silinmiş belge (SMM2026000000120) kendi numarasıyla geri gelir — {"status": 200, "message": "Serbest Meslek Makbuzu SMM2026000000120 geri geldi (iptal edilmiş, etkisiz).", "back": ["SMM2026000000120", "cancelled"]}
- ✓ C11 002 E6: sıradaki kâğıt/fiş/SMM/iç numara verilmiş en büyükten (silinenler dahil) sonra; geri yükleme sıradakini değiştirmedi

### donus: 6/6 denetim geçti

### kesinti: 79/79 denetim geçti

### za: 185/185 denetim geçti

### zb: 104/104 denetim geçti
