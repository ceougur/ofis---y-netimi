# Cari kâhini bakımı 28 — rapor taslağı (S255 = A, S254 = C)

Taban 6a1d19d1 · dal worktree-agent-a5cd991d0d986ba51 · girdi docs/devir/2.5.0-DEVAM/kahin-cari28-kararlar.md · KARARLAR.md §40.

## Yapılan
- §40 yorum (commit d26cae35, kod yok) → d60 elle tablosu (f4bde41e, kâhin koşulmadan) → kural kodu + mutantlar (91acc91d) → yapım aşaması paket adı (e00d9729) → araçlar (e7b0e9f3) → kanıt.
- S255 = A: kartın açılmasından SONRA faturaya bağlı tahsilat, ödemeden önceki son kart tüketiminin ardından faturanın gösterilen açığını (kuyruk kalanı) kapatır; fazlası kendi gününde tek kuyruğa.
- S254 = C: iki kart + faturasız stok iadesi bir kart taksitini kapatırsa carinin kuyruğu + kartların toplamı SUS; bakiye yazılır.

## Sayılar (UTC = Europe/Istanbul)
- öz test 9.357/9.357; mutantlar 358 / 359 / 360 DEĞERLE, 361 SUS kuralı — hepsi yakalandı.
- G3 670/670: değişen / kalkan / yeni 335 (S255 yeni 223, S254 kalkan 112), BEKLENMEYEN 0, yalnız etiket 2 (FV1 KULLANICI → BAŞ MİMAR); eşdeğerlik 536/536; fark yalnız d60.
- elle fark 113/113; d60 470/470 (ilk koşu); eski kâhin kırmızısı 205/470.
- program ilk koşu (UTC, liste boş): 25.101/25.164 — 63 fark, HEPSİ d60 (öbür 105 senaryo tam).

## P (program şüphesi)
- P-1: kartın içine aldığı faturaya bağlı ödemenin gösterilen açığı aşan kısmı programda kartın taksitlerine DÜŞMÜYOR. En küçük örnek d60 V2 (F 900, kart 600 = 3 × 200, bağlı 600, bugün 20.10):
  kâhin kart Tahsil 300 / Kalan 300, gecikmiş 0; program Tahsil 0 / Kalan 600, gecikmiş 200. Bakiye (300), fatura kendi açığı (300), gösterilen (0), kartta (300), 'Taksitte' İKİSİNDE AYNI.
  Aynısı V3 / V4 / V7 / V8 / V10 / V11 (k1). V9 (iade kartı 300'e küçültmüş, bağlı 300) programda kâhinle AYNI.

(son hâl SubagentHandback raporunda)

## Son hâl (13:1x UTC)
- program ↔ yeni kâhin son: 25.101/25.101 UTC ve Europe/Istanbul (0 fark, 63 yapım aşaması — 'S255 izleyen tur 4', 0 okuma hatası, 0 yakalanmayan mutasyon).
- program ↔ eski kâhin (d60): 428/440 — 12 fark yalnız Q1 (S254 alanı; program son açılan kartı küçültüyor — gözlem).
- yapım aşaması listesi 0 → 63 (hepsi d60; yeni 63 / kapanan 0 / değişen 0) — ayrı commit.
- KULLANICIYA SORULMALI: SK-52 (bağlı çek / senet), SK-53 (şüpheli paylı) — ikisi de UÇ, öneri C (BİLİNEN SINIR); kâhin SUS.
