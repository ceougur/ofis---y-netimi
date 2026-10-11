# Eksik test turu dalı — ana oturumun kendi kırmızı/yeşil koşuları (10.10.2026)

Dal `worktree-agent-a9996cccca67b1040` (uç 7814bcf). Her koşu `tools/kanit.mjs kos`; kayıtlar `2026-10-10/` (JSON + ham çıktı). Linux, Node v22.22.0.

| Bulgu | Test | Düzeltmeden önce | Düzeltme | Kırmızının nedeni (ham çıktıdan) |
|---|---|---|---|---|
| R1 iade geri ödemesi kapaması | banka-210-rapor-bulgu | 3b57042: 1/6 (R1a, R1b, R1d, R1e + R2 kırmızı) | 1249a0c: 5/6 (yalnız R2 kalır) | açık satış "Ödendi", alış faturası hayalet ödeme |
| R2 Gider Raporu gruplaması | banka-210-rapor-bulgu | 1249a0c: R2 kırmızı | b5f2ba3: 6/6 | türler tek satır |
| R3 eşleşmiş satır koruması | banka-210-eslesmis | cbf889d: 0/7 | 31b7117: 7/7 | iki yönden plana aykırı: yalnız açıklama 409 (plan: serbest), çek geri al / fatura peşin tutar 200 (plan: 409) |
| D2 Düzenle formunda numara | senaryo-banka-210b (arayüz) | 7814bcf + 2112990^ istemcisi: 62/63 | 7814bcf: 63/63 | "Kaydedilince Verilecek No FIS…002; beklenen FIS…001" |
| Test süzgeci (Failed to fetch) | banka-210-fetch-yaris.mjs | eski süzgeç 0/3 (ön koşul 3/3 oluştu) | yeni süzgeç 3/3 (ön koşul 3/3) | sunucu reddinde yeni süzgeç hatayı SAYIYOR 3/3 (`toplayıcının saydığı hata 1`) |
| R4, R5 | bkz. `../ana-oturum-r4r5/OZET.md` | | | |

Windows: bu koşular yalnız Linux; Windows sonucu birleşmeden sonra CI'den okunacak.
