| yol | durum taban / yeni | taban en iyi | yeni en iyi | taban ortanca | yeni ortanca | olay döngüsü en çok taban / yeni | oran (ortanca) | hüküm |
|---|---|---|---|---|---|---|---|---|
| Cari kartı / ekstre + gecikmiş (GET accounts/:id) | 200 / 200 | 163.4 | 148.6 | 174.1 | 178.3 | 257.9 / 185.1 | 1.02 | tamam |
| Mizan + mutabakat (GET ledger) | 200 / 200 | 2324.5 | 2376.2 | 2457.9 | 2484.4 | 0.0 / 2608.9 | 1.01 | tamam |
| Mutabakat Testi (GET ledger/integrity) | 200 / 200 | 5077.0 | 5081.2 | 5893.3 | 5305.6 | 6870.3 / 6174.0 | 0.90 | tamam |
| YAZIM taksitli satış faturası | 200 / 200 | 170.7 | 228.9 | 192.9 | 251.6 | 0.0 / 250.0 | 1.30 | KÖTÜLEŞEN |
| Fatura kartı (GET invoices/:id, İptal Et notu) | 200 / 200 | 91.4 | 144.5 | 94.6 | 149.6 | 125.3 / 0.0 | 1.58 | KÖTÜLEŞEN |
| YAZIM taksit tahsilatı | 200 / 200 | 864.3 | 829.9 | 868.2 | 870.1 | 0.0 / 0.0 | 1.00 | tamam |
| YAZIM satıştan iade (taksitli — kart küçülmesi) | 200 / 200 | 536.0 | 506.5 | 550.5 | 525.3 | 721.9 / 0.0 | 0.95 | tamam |
| YAZIM taksitli satış (tahsilatsız) | 200 / 200 | 163.9 | 216.4 | 187.4 | 248.8 | 199.9 / 0.0 | 1.33 | KÖTÜLEŞEN |
| YAZIM fatura iptali (taksitli, tahsilatsız) | 200 / 200 | 101.7 | 321.5 | 115.1 | 375.3 | 123.9 / 0.0 | 3.26 | KÖTÜLEŞEN |
| YAZIM satış faturası (açık, kapsayan kartlı cari) | 200 / 200 | 143.0 | 197.8 | 162.8 | 235.4 | 0.0 / 0.0 | 1.45 | KÖTÜLEŞEN |
| YAZIM fatura iptali (açık, kapsayan kartlı cari) | 200 / 200 | 90.8 | 283.8 | 106.9 | 343.3 | 134.7 / 345.0 | 3.21 | KÖTÜLEŞEN |
| YAZIM satış faturası (açık, kapsayan kartlı cari) — silme için | 200 / 200 | 139.6 | 191.0 | 163.4 | 230.1 | 0.0 / 0.0 | 1.41 | KÖTÜLEŞEN |
| YAZIM fatura silme (açık, kapsayan kartlı cari) | 200 / 200 | 105.1 | 310.1 | 128.7 | 366.2 | 145.8 / 0.0 | 2.85 | KÖTÜLEŞEN |
| YAZIM faturasız stok iadesi (cariye, kapsayan kartlı cari — trimCovers) | 200 / 200 | 197.2 | 195.6 | 239.0 | 229.0 | 0.0 / 0.0 | 0.96 | tamam |
| YAZIM fatura iptali (tahsilatlı kendi kart — S15; tabanda 409) | 409 / 200 | 31.5 | 328.4 | 38.5 | 387.0 | 0.0 / 0.0 | 10.05 | KARŞILAŞTIRILMAZ (durum farklı) |
| Taksitler Geciken listesi (GET plans?status=overdue) | 200 / 200 | 551.8 | 1290.6 | 580.2 | 1389.9 | 13.6 / 12.9 | 2.40 | KÖTÜLEŞEN |
| Kapsayan kartlı cari kartı (GET accounts/:id) | 200 / 200 | 144.0 | 129.5 | 161.6 | 167.5 | 225.8 / 220.3 | 1.04 | tamam |
GEÇERSİZ bloklar: yok
