| yol | durum taban / yeni | taban en iyi | yeni en iyi | taban ortanca | yeni ortanca | olay döngüsü en çok taban / yeni | oran (ortanca) | hüküm |
|---|---|---|---|---|---|---|---|---|
| Taksitler Geciken listesi — yazımdan önce (GET plans?status=overdue) | 200 / 200 | 777.8 | 856.2 | 876.4 | 914.1 | 2162.2 / 1947.2 | 1.04 | tamam |
| Cari kartı / ekstre + gecikmiş (GET accounts/:id) | 200 / 200 | 244.4 | 235.4 | 261.1 | 277.5 | 306.2 / 318.8 | 1.06 | tamam |
| Mizan + mutabakat (GET ledger) | 200 / 200 | 3439.3 | 3483.4 | 3734.6 | 3589.5 | 4974.4 / 4496.3 | 0.96 | tamam |
| Mutabakat Testi (GET ledger/integrity) | 200 / 200 | 14409.3 | 14162.0 | 14945.8 | 14961.1 | 0.0 / 14160.0 | 1.00 | tamam |
| YAZIM taksitli satış faturası | 200 / 200 | 245.4 | 248.3 | 253.6 | 271.2 | 272.9 / 0.0 | 1.07 | tamam |
| Fatura kartı (GET invoices/:id, İptal Et notu) | 200 / 200 | 124.9 | 132.3 | 141.4 | 145.0 | 0.0 / 0.0 | 1.03 | tamam |
| YAZIM taksit tahsilatı | 200 / 200 | 1251.8 | 1257.3 | 1349.6 | 1324.3 | 0.0 / 1354.8 | 0.98 | tamam |
| YAZIM satıştan iade (taksitli — kart küçülmesi) | 200 / 200 | 755.2 | 537.1 | 802.6 | 561.7 | 849.3 / 642.8 | 0.70 | tamam |
| YAZIM taksitli satış (tahsilatsız) | 200 / 200 | 238.2 | 231.0 | 245.5 | 244.4 | 0.0 / 0.0 | 1.00 | tamam |
| YAZIM fatura iptali (taksitli, tahsilatsız) | 200 / 200 | 140.9 | 170.9 | 145.5 | 174.2 | 172.9 / 0.0 | 1.20 | KÖTÜLEŞEN |
| YAZIM satış faturası (açık, kapsayan kartlı cari) | 200 / 200 | 202.1 | 209.3 | 211.2 | 214.4 | 0.0 / 222.2 | 1.02 | tamam |
| YAZIM fatura iptali (açık, kapsayan kartlı cari) | 200 / 200 | 133.3 | 165.6 | 134.9 | 168.4 | 0.0 / 189.9 | 1.25 | KÖTÜLEŞEN |
| YAZIM satış faturası (açık, kapsayan kartlı cari) — silme için | 200 / 200 | 206.0 | 208.9 | 215.9 | 219.3 | 0.0 / 247.2 | 1.02 | tamam |
| YAZIM fatura silme (açık, kapsayan kartlı cari) | 200 / 200 | 161.5 | 192.9 | 163.5 | 200.4 | 184.3 / 199.8 | 1.23 | KÖTÜLEŞEN |
| YAZIM faturasız stok iadesi (cariye, kapsayan kartlı cari — trimCovers) | 200 / 200 | 276.8 | 105.0 | 308.1 | 108.5 | 0.0 / 134.7 | 0.35 | tamam |
| YAZIM fatura iptali (tahsilatlı kendi kart — S15; tabanda 409) | 409 / 200 | 45.2 | 178.9 | 47.4 | 191.6 | 45.9 / 0.0 | 4.04 | KARŞILAŞTIRILMAZ (durum farklı) |
| Taksitler Geciken listesi (GET plans?status=overdue) | 200 / 200 | 825.1 | 2003.8 | 912.5 | 2022.4 | 17.0 / 13.0 | 2.22 | KÖTÜLEŞEN |
| Kapsayan kartlı cari kartı (GET accounts/:id) | 200 / 200 | 222.2 | 197.2 | 246.4 | 233.4 | 280.8 / 285.0 | 0.95 | tamam |
GEÇERSİZ bloklar: yok
