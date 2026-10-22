| Şirket | Olgu | Sonuç | Karar / not | Sayılar |
|---|---|---|---|---|
| * | şirket listesi | EŞİT |  | {"count": 2} |
| * | kullanıcı ayse | EŞİT |  | {"permissions": 18} |
| * | kullanıcı mehmet | EŞİT |  | {"permissions": 40} |
| * | kullanıcı admin | BELGELİ | K-19 Personel Özlük (yeni yetkiler yalnız yöneticide) | {"gained": ["staff.manage", "staff.view"]} |
| * | kullanıcı zeynep | EŞİT |  | {"permissions": 6} |
| * | roller | EŞİT |  | {} |
| 001 | cari bakiyeleri (tek tek) | EŞİT |  | {"count": 3211, "sum": 1144290996} |
| 001 | mizan (her hesap) | EŞİT |  | {"accounts": 22} |
| 001 | mizan toplamı | EŞİT |  | {"debit": 5216296356, "credit": 5216296356, "difference": 0} |
| 001 | defter mutabakatı | EŞİT |  | {"checks": 16} |
| 001 | Mutabakat Testi sapmaları | EŞİT |  | {"failures": 0} |
| 001 | Mutabakat Testi denetimleri | EŞİT |  | {"ok": 87, "newOk": []} |
| 001 | dönem kilidi | EŞİT |  | {"lockedUntil": "2026-04-22"} |
| 001 | Kasa (toplam, yol başına, satırlar) | EŞİT |  | {"totals": {"in": 8380228.65, "out": 3615860.77, "balance": 4764367.88}, "rows": 2045} |
| 001 | banka hesapları (tek tek) | EŞİT |  | {"accounts": 2} |
| 001 | Banka özeti | EŞİT |  | {} |
| 001 | çek/senet (tek tek: durum, tutar, cari, fatura) | EŞİT |  | {"count": 413, "byStatus": {"portfolio": 33, "collected": 151, "endorsed": 91, "paid": 54, "bounced": 84}} |
| 001 | taksit kartları (tek tek) | EŞİT |  | {"count": 225} |
| 001 | taksit toplamları | EŞİT |  | {"total": 376515420, "paid": 16940000, "remaining": 359575420, "overdue": 295935819, "overdueCount": 1034, "month": 40741144, "count": 225} |
| 001 | stok (tek tek) | EŞİT |  | {"count": 40} |
| 001 | KDV mahsup fişleri | EŞİT |  | {"count": 13} |
| 001 | tablo (veri oturumu) | EŞİT |  | {"hasData": true, "label": "MUSTERILER.xlsx", "rowCount": 10040, "tabs": ["Borçlular", "Ödeme Sözleri", "Taksitler"]} |
| 001 | şüpheli alacaklar | EŞİT |  | {} |
| 001 | Gönderilecekler | EŞİT |  | {"count": 3} |
| 001 | seri adları | EŞİT |  | {"paper": "FIS", "earsiv": "EAR", "efatura": "EFT", "smm": "SMM", "esmm": "ESM", "internal": "IAD"} |
| 001 | faturalar (tür, durum, numara, ETTN, tarih, cari, profil, e-Belge durumu, tutar) | EŞİT |  | {"count": 1220, "byProfile": {"TEMELFATURA": 68, "EARSIVFATURA": 308, "KAGIT": 844}, "byEStatus": {"waiting": 7, "none": 808, "sent": 358, "withdrawn": 36, "cancelled": 11}} |
| 001 | faturaların ödeme durumu | BELGELİ | K-UX18/F2/F3 karşılıksız evrak kapamadan çıkar (madde 15, 31a; kararlar 22.10.2026) | {"invoices": 72, "caris": 57, "reopenedMinor": 60469689, "payState": {"overdue→overdue": 59, "paid→overdue": 13}, "byKind": {"sale": 56, "purchase": 14, "smm": 2}} |
| 001 | ANLIK DURUM · faturalar | BELGELİ | K-UX18 (açık fatura farkı = faturaların farkı) | {"openSale": [6482295.68, 7032569.44], "openPurchase": [1183531.79, 1237954.92]} |
| 001 | e-Belge kartları (İptal Et / Gönder / Bırak düğmeleri) | BELGELİ | K-23 iptal süresi iletimden 8 gün (madde 23) | {"cards": 1220, "iptalKapandi": 277, "sureIcindeAcikKalan": 2} |
| 001 | sıradaki numara · paper | EŞİT |  | {"next": "FIS2026000000254", "givenMax": 253} |
| 001 | sıradaki numara · earsiv | EŞİT |  | {"next": "EAR2026000000001", "givenMax": 0} |
| 001 | sıradaki numara · efatura | EŞİT |  | {"next": "EFT2026000000001", "givenMax": 0} |
| 001 | sıradaki numara · smm | EŞİT |  | {"next": "SMM2026000000074", "givenMax": 73} |
| 001 | sıradaki numara · internal | EŞİT |  | {"next": "IAD2026000000015", "givenMax": 14} |
| 001 | sıradaki numara · esmm | BELGELİ | K-24 e-SMM açık (server.mjs esmmEnabled) | {"next": "ESM2026000000001"} |
| 001 | rapor alacak-yaslandirma | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 55027376, "purchaseDelta": 5442313, "total": [1178, 1178], "badCount": 0} |
| 001 | rapor fatura-satis | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 55027376, "purchaseDelta": 5442313, "total": [903, 903], "badCount": 0} |
| 001 | rapor fatura-alis | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 55027376, "purchaseDelta": 5442313, "total": [254, 254], "badCount": 0} |
| 001 | rapor acik-faturalar | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 55027376, "purchaseDelta": 5442313, "total": [782, 795], "badCount": 0} |
| 001 | rapor kayit-tahsilatlari | BELGELİ | K-5 metin: rapor adı "Kayıt Tahsilatları" (madde 5) | {} |
| 001 | rapor merkezi (öbür raporlar) | EŞİT |  | {"equalReports": 57} |
| 001 | Tablodaki Kişiler (kayıt başına borç / alacak) | BELGELİ | K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a) | {"changed": 834, "byReason": {"aynı anahtar iki sekmede (K-5c)": 579, "ilk sekme dışı (K-31a F4 sekme başına analiz)": 240, "kayda bağlı cari (K-5)": 131, "kayda bağlı / carisinin taksit kartı (K-31a F1/F5)": 114}} |
| 001 | Vade Takip (kayıt başına kalemler) — Toplam Borç → Kalan Borç | BULGU | B1: belgesiz yan etki (7d51d60 madde 5b borç kolonu seçimi) | {"keys": 1101, "minorBefore": 2228970000, "minorAfter": 1669670000, "sample": [{"key": "2026/01369", "before": [["Ödeme sözü", 1787443200000, 150000, "gecikmis"], ["Ödeme sözü", 1790467200000, 60000, "gecikmis"], ["Ödeme sözü", 1792713600000, 3900000, "yakl… |
| 001 | Tahsilat Takvimi / ödeme sözü (kayıt başına kalemler) — Toplam Borç → Kalan Borç | BULGU | B1: belgesiz yan etki (7d51d60 madde 5b borç kolonu seçimi) | {"keys": 965, "minorBefore": 1963440000, "minorAfter": 1470050000, "sample": [{"key": "2026/01369", "before": [["Ödeme Sözü", "2026-10-23", 3900000, "upcoming", false], ["Söz Tarihi", "2026-08-23", 150000, "overdue", false], ["Söz Tarihi", "2026-09-27", 600… |
| 001 | Tahsilat Takvimi / ödeme sözü (kayıt başına kalemler) | BELGELİ | K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a) | {"changed": 72, "byReason": {"vadeli fatura kalemi, fatura yeniden açıldı (K-UX18)": 72}} |
| 001 | Nakit Akışı | BELGELİ | K-5 / K-31a F5 (Beklenen / Gerçekleşen; Kasa giriş-çıkışı aynı) | {} |
| 002 | cari bakiyeleri (tek tek) | EŞİT |  | {"count": 926, "sum": 648978838} |
| 002 | mizan (her hesap) | EŞİT |  | {"accounts": 22} |
| 002 | mizan toplamı | EŞİT |  | {"debit": 3713962588, "credit": 3713962588, "difference": 0} |
| 002 | defter mutabakatı | EŞİT |  | {"checks": 16} |
| 002 | Mutabakat Testi sapmaları | EŞİT |  | {"failures": 0} |
| 002 | Mutabakat Testi denetimleri | EŞİT |  | {"ok": 87, "newOk": []} |
| 002 | dönem kilidi | EŞİT |  | {"lockedUntil": ""} |
| 002 | Kasa (toplam, yol başına, satırlar) | EŞİT |  | {"totals": {"in": 4583346.15, "out": 1948017.41, "balance": 2635328.74}, "rows": 886} |
| 002 | banka hesapları (tek tek) | EŞİT |  | {"accounts": 2} |
| 002 | Banka özeti | EŞİT |  | {} |
| 002 | çek/senet (tek tek: durum, tutar, cari, fatura) | EŞİT |  | {"count": 159, "byStatus": {"portfolio": 14, "pending": 1, "endorsed": 44, "collected": 54, "bounced": 28, "paid": 18}} |
| 002 | taksit kartları (tek tek) | EŞİT |  | {"count": 101} |
| 002 | taksit toplamları | EŞİT |  | {"total": 203211090, "paid": 5350000, "remaining": 197861090, "overdue": 154313767, "overdueCount": 419, "month": 17416282, "count": 101} |
| 002 | stok (tek tek) | EŞİT |  | {"count": 40} |
| 002 | KDV mahsup fişleri | EŞİT |  | {"count": 13} |
| 002 | tablo (veri oturumu) | EŞİT |  | {"hasData": true, "label": "MUSTERILER.xlsx", "rowCount": 1710, "tabs": ["Borçlular", "Ödeme Sözleri", "Taksitler"]} |
| 002 | şüpheli alacaklar | EŞİT |  | {} |
| 002 | Gönderilecekler | EŞİT |  | {"count": 2} |
| 002 | seri adları | EŞİT |  | {"paper": "FIS", "earsiv": "EAR", "efatura": "EFT", "smm": "SMM", "esmm": "ESM", "internal": "IAD"} |
| 002 | faturalar (tür, durum, numara, ETTN, tarih, cari, profil, e-Belge durumu, tutar) | EŞİT |  | {"count": 621, "byProfile": {"KAGIT": 469, "EARSIVFATURA": 126, "TEMELFATURA": 26}, "byEStatus": {"none": 449, "waiting": 4, "withdrawn": 20, "sent": 145, "cancelled": 3}} |
| 002 | faturaların ödeme durumu | BELGELİ | K-UX18/F2/F3 karşılıksız evrak kapamadan çıkar (madde 15, 31a; kararlar 22.10.2026) | {"invoices": 25, "caris": 19, "reopenedMinor": 21267417, "payState": {"overdue→overdue": 18, "paid→overdue": 7}, "byKind": {"sale": 20, "purchase": 5}} |
| 002 | ANLIK DURUM · faturalar | BELGELİ | K-UX18 (açık fatura farkı = faturaların farkı) | {"openSale": [4137931.25, 4336605.42], "openPurchase": [443971.71, 457971.71]} |
| 002 | e-Belge kartları (İptal Et / Gönder / Bırak düğmeleri) | BELGELİ | K-23 iptal süresi iletimden 8 gün (madde 23) | {"cards": 621, "iptalKapandi": 113, "sureIcindeAcikKalan": 2} |
| 002 | sıradaki numara · paper | EŞİT |  | {"next": "FIS2026000000130", "givenMax": 129} |
| 002 | sıradaki numara · earsiv | EŞİT |  | {"next": "EAR2026000000001", "givenMax": 0} |
| 002 | sıradaki numara · efatura | EŞİT |  | {"next": "EFT2026000000001", "givenMax": 0} |
| 002 | sıradaki numara · smm | EŞİT |  | {"next": "SMM2026000000090", "givenMax": 89} |
| 002 | sıradaki numara · internal | EŞİT |  | {"next": "IAD2026000000011", "givenMax": 10} |
| 002 | sıradaki numara · esmm | BELGELİ | K-24 e-SMM açık (server.mjs esmmEnabled) | {"next": "ESM2026000000001"} |
| 002 | rapor alacak-yaslandirma | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 19867417, "purchaseDelta": 1400000, "total": [438, 438], "badCount": 0} |
| 002 | rapor fatura-satis | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 19867417, "purchaseDelta": 1400000, "total": [480, 480], "badCount": 0} |
| 002 | rapor fatura-alis | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 19867417, "purchaseDelta": 1400000, "total": [106, 106], "badCount": 0} |
| 002 | rapor acik-faturalar | BELGELİ | K-UX18 (yalnız değişen faturaların / carilerin Ödenen-Kalan hücreleri) | {"saleDelta": 19867417, "purchaseDelta": 1400000, "total": [428, 435], "badCount": 0} |
| 002 | rapor kayit-tahsilatlari | BELGELİ | K-5 metin: rapor adı "Kayıt Tahsilatları" (madde 5) | {} |
| 002 | rapor merkezi (öbür raporlar) | EŞİT |  | {"equalReports": 57} |
| 002 | Tablodaki Kişiler (kayıt başına borç / alacak) | BELGELİ | K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a) | {"changed": 202, "byReason": {"aynı anahtar iki sekmede (K-5c)": 140, "ilk sekme dışı (K-31a F4 sekme başına analiz)": 60, "kayda bağlı cari (K-5)": 34, "kayda bağlı / carisinin taksit kartı (K-31a F1/F5)": 30}} |
| 002 | Vade Takip (kayıt başına kalemler) — Toplam Borç → Kalan Borç | BULGU | B1: belgesiz yan etki (7d51d60 madde 5b borç kolonu seçimi) | {"keys": 167, "minorBefore": 338570000, "minorAfter": 255480000, "sample": [{"key": "2025/00114", "before": [["Ödeme sözü", 1788825600000, 220000, "gecikmis"], ["Ödeme sözü", 1791849600000, 2020000, "gecikmis"]], "after": [["Ödeme sözü", 1788825600000, 2200… |
| 002 | Vade Takip (kayıt başına kalemler) | BELGELİ | K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a) | {"changed": 3, "byReason": {"kayda bağlı cari (K-5)": 3, "aynı anahtar iki sekmede (K-5c)": 2}} |
| 002 | Tahsilat Takvimi / ödeme sözü (kayıt başına kalemler) — Toplam Borç → Kalan Borç | BULGU | B1: belgesiz yan etki (7d51d60 madde 5b borç kolonu seçimi) | {"keys": 143, "minorBefore": 289130000, "minorAfter": 215620000, "sample": [{"key": "2025/00114", "before": [["Ödeme Sözü", "2026-10-13", 2020000, "overdue", false], ["Söz Tarihi", "2026-09-08", 220000, "overdue", false]], "after": [["Ödeme Sözü", "2026-10-… |
| 002 | Tahsilat Takvimi / ödeme sözü (kayıt başına kalemler) | BELGELİ | K-5 / K-31a F1-F4-F5 / K-5c (madde 5, 31a) | {"changed": 28, "byReason": {"kayda bağlı cari (K-5)": 3, "aynı anahtar iki sekmede (K-5c)": 2, "vadeli fatura kalemi, fatura yeniden açıldı (K-UX18)": 25}} |
| 002 | Nakit Akışı | BELGELİ | K-5 / K-31a F5 (Beklenen / Gerçekleşen; Kasa giriş-çıkışı aynı) | {} |
| 001 | veri dosyası: şema sürümü | BELGELİ | göç v31 + v32 | {"integrity": "ok"} |
| 001 | veri dosyası: tablolar ve satır sayıları | BELGELİ | K-19 staff_members (boş) + ayar satırları (K-v32 numberFloor, K-16 Başlarken) | {"newTables": ["staff_members"], "lostTables": [], "counts": [["settings", 27, 29]], "numberFloor": "{\"FIS2026\":{\"seq\":253,\"number\":\"FIS2026000000253\",\"issueDate\":\"2026-10-21\"}}"} |
| 002 | veri dosyası: şema sürümü | BELGELİ | göç v31 + v32 | {"integrity": "ok"} |
| 002 | veri dosyası: tablolar ve satır sayıları | BELGELİ | K-19 staff_members (boş) + ayar satırları (K-v32 numberFloor, K-16 Başlarken) | {"newTables": ["staff_members"], "lostTables": [], "counts": [["settings", 21, 23]], "numberFloor": "{\"FIS2026\":{\"seq\":125,\"number\":\"FIS2026000000125\",\"issueDate\":\"2026-09-17\"}}"} |
