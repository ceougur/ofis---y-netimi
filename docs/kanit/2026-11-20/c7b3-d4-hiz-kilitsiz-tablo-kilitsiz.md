| yol | durum taban / yeni | taban en iyi | yeni en iyi | taban ortanca | yeni ortanca | olay döngüsü en çok taban / yeni | oran (ortanca) | hüküm |
|---|---|---|---|---|---|---|---|---|
| Taksitler Geciken listesi — yazımdan önce (GET plans?status=overdue) | 200 / 200 | 780.2 | 797.5 | 892.1 | 854.6 | 1820.3 / 1784.7 | 0.96 | tamam |
| Cari kartı / ekstre + gecikmiş (GET accounts/:id) | 200 / 200 | 241.4 | 222.5 | 266.3 | 241.6 | 340.3 / 295.4 | 0.91 | tamam |
| Mizan + mutabakat (GET ledger) | 200 / 200 | 3491.8 | 3376.4 | 3667.9 | 3433.0 | 4265.6 / 3860.9 | 0.94 | tamam |
| Mutabakat Testi (GET ledger/integrity) | 200 / 200 | 7879.8 | 7682.3 | 8163.1 | 7688.6 | 8455.7 / 8589.9 | 0.94 | tamam |
| YAZIM taksitli satış faturası | 200 / 200 | 240.5 | 245.5 | 253.5 | 261.7 | 0.0 / 0.0 | 1.03 | tamam |
| Fatura kartı (GET invoices/:id, İptal Et notu) | 200 / 200 | 126.7 | 128.1 | 131.1 | 133.2 | 0.0 / 0.0 | 1.02 | tamam |
| YAZIM taksit tahsilatı | 200 / 200 | 1239.3 | 1243.3 | 1328.0 | 1313.9 | 0.0 / 0.0 | 0.99 | tamam |
| YAZIM satıştan iade (taksitli — kart küçülmesi) | 200 / 200 | 740.8 | 524.0 | 773.1 | 543.7 | 923.3 / 673.7 | 0.70 | tamam |
| YAZIM taksitli satış (tahsilatsız) | 200 / 200 | 230.7 | 226.6 | 240.7 | 243.3 | 329.8 / 0.0 | 1.01 | tamam |
| YAZIM fatura iptali (taksitli, tahsilatsız) | 200 / 200 | 134.1 | 163.5 | 143.0 | 176.7 | 0.0 / 0.0 | 1.24 | KÖTÜLEŞEN |
| YAZIM satış faturası (açık, kapsayan kartlı cari) | 200 / 200 | 198.4 | 204.8 | 208.6 | 221.3 | 247.3 / 278.4 | 1.06 | tamam |
| YAZIM fatura iptali (açık, kapsayan kartlı cari) | 200 / 200 | 126.6 | 154.5 | 133.8 | 158.8 | 131.5 / 0.0 | 1.19 | KÖTÜLEŞEN |
| YAZIM satış faturası (açık, kapsayan kartlı cari) — silme için | 200 / 200 | 203.4 | 202.8 | 222.3 | 214.2 | 248.9 / 287.3 | 0.96 | tamam |
| YAZIM fatura silme (açık, kapsayan kartlı cari) | 200 / 200 | 155.6 | 181.2 | 159.2 | 188.4 | 0.0 / 0.0 | 1.18 | KÖTÜLEŞEN |
| YAZIM faturasız stok iadesi (cariye, kapsayan kartlı cari — trimCovers) | 200 / 200 | 280.6 | 101.4 | 285.2 | 103.6 | 297.8 / 138.4 | 0.36 | tamam |
| YAZIM fatura iptali (tahsilatlı kendi kart — S15; tabanda 409) | 409 / 200 | 41.1 | 164.2 | 41.8 | 172.6 | 40.2 / 170.7 | 4.13 | KARŞILAŞTIRILMAZ (durum farklı) |
| Taksitler Geciken listesi (GET plans?status=overdue) | 200 / 200 | 780.4 | 1812.2 | 848.3 | 1878.6 | 10.3 / 13.3 | 2.21 | KÖTÜLEŞEN |
| Kapsayan kartlı cari kartı (GET accounts/:id) | 200 / 200 | 212.1 | 194.9 | 237.9 | 211.3 | 276.8 / 250.0 | 0.89 | tamam |
GEÇERSİZ bloklar: yok
