# Cari kâhini bakımı 23 — ajan raporu (AYNEN; ajan a86d75eced6cfa436)

# Cari kâhini bakımı 23 (S229 / S230 / S200): rapor

Taban `s229-uc` (81e587b8). Dal ucu **2dbcd218**. Dal `worktree-agent-a86d75eced6cfa436`, ağaç `/home/user/ofis---y-netimi/.claude/worktrees/agent-a86d75eced6cfa436`; push yapılmadı. Programın kodu (`server/`, `client/`, `test/*.test.mjs`) okunmadı, program yalnız bağdaştırıcıyla dışarıdan kullanıldı. Kural kaynağı yalnız girdi dosyasıydı.

**Sonuç:** program ↔ kâhin iki saat diliminde de **21.673/21.673, fark 0**. Aynı programda eski kâhin **46 fark** veriyor. Yapım aşaması listesi yeniden üretildi, **boş**.

**Bilmeniz gereken iki şey:**
- **S200 kâhine kural olarak girdi.** Bu alan eskiden SK-20 (S123 = C) diye susuyordu. S229'un kendi örneği de bu alanda olduğu için kâhin kartın içine alma sırasını kurmadan yeni denetimi yazamıyordu. Kurulmasaydı "kısmen alınan fatura" kâhinde hiç oluşamazdı.
- **E = 0 okuması bu kâhinin yorumudur.** Elle borç hiç yokken kart yalnız faturalardan alıyor. Kararın harfi kapsıyor, ama üzerinde ayrıca durmanız gerekir; ayrıntısı S200 maddesinde.

## Yapılan eşleme (girdi §2)
Kara kutu yoklamasında iki şey çıktı:
- **`ownOpen` / `inPlan` her yanıtta yok:** programın fatura yanıtında yalnız kartın aldığı kısım 0'dan büyükse geliyor.
- **'Taksitte' belge durumunda değil:** `status` alanında değil, ödeme durumu alanı `payState` = "installment" olarak geliyor.

Ham alanlar `docs/kanit/2026-11-21/kahin-cari23-kanit/yokla1-d52-ham.json` dosyasında. Bu yüzden ilk eşlemem (`status`) düzeltildi. Son eşleme:

| Anahtar | Okunduğu alan |
|---|---|
| `fatura:<ad>:acik` (beklenti değişmedi) | `ownOpen`, yoksa `open` |
| `gosterilen` | `open` |
| `kartta` | `inPlan`; `inPlan` ve `ownOpen` ikisi de yoksa 0; `ownOpen` varken `inPlan` yoksa "alan yok" |
| `taksitte` | `payState` = "installment" |
| `liste:gosterilen` / `liste:taksitte` | `GET /api/workspace/invoices` → `invoices[]` satırı |

## Yeni denetimin kuralı (KARARLAR.md §35)
- **Gösterilen açık (Y23-2):** kendi açık − kartın aldığı kısım; kâhinde bu kuyruk kalanına eşit. Dayanak S229 A'nın "(cari kartının gecikmişi ve Vade Takip ile aynı)" sözü ve S230 A'nın "kartın aldığı kısım kartın taksitlerinden tahsil edilir" sözü. `kartta` = kendi − gösterilen, KAPSAM (b)'den.
- **'Taksitte' (Y23-3):** kart faturanın tamamını aldıysa gösterilen 0 ve 'Taksitte' (S229 / S230 A).
- **Kartın almadığı fatura (Y23-4):** gösterilen = kendi açık, `kartta` 0, 'Taksitte' değil (KAPSAM (b)).
- **S200 (Y23-5):** kart önce bütün elle borçları, eksik kısmı taksitsiz satış faturalarından eskiden yeniye alır.
  - Başka tür kalem varsa (stok, karşılıksız, başka kartın ya da taksitli faturanın taksiti) SK-20 susması aynen sürer (d40 Q8).
  - Karta sonradan gelen ödemede içine alma sırası ile belge sırası ayrışırsa SK-23 (S125 = C) susması sürer; d36 J14 buna geçti.
  - **E = 0 okuması:** elle borç hiç yokken kart yalnız faturalardan alıyor (d52 P6, iz `s200e0`). Ayrıca görmeniz için işaretledim.
- **Susulan durumlar (Y23-6):** kartın aldığı kısmı ödenmiş (kendi açığı 0) faturanın durumu; taksitli fatura; net görünümlü ya da şüpheli kayıtlı caride kartlı fatura.

Kâhinin dili kartın aldığı kısmı zaten taşıyor (tüketilen ve kuyruk kalanı), bu yüzden girdi §1 (c)'deki "dil modellemiyorsa sus" koşulu uygulanmadı.

## Senaryolar
- **Yeni d52** (9 cari, 38 adım, 159 elle beklenen). Elle tablo kâhin koşulmadan karar metinlerinden yazıldı; ilk koşuda 159/159 tuttu. Kapsadığı durumlar:
  - P1: S229'un kendi örneği (gösterilen 20.000, kartta 30.000, gecikmiş 20.000).
  - Tam alınan fatura (P2), kısmi tahsil edilmiş ve sonra tam alınan fatura (P3).
  - İki kart (P4), bir faturayı iki kartın bölmesi (P6).
  - Kartsız (P5), alış (P7), S110 kendi borcu (P8), S200 iki fatura (P9).
- **d35 H8:** S200 ile değer aldı. **d36 J14:** SK-20'den SK-23'e geçti. İkisinde de adımlar değişmedi, değişen elle tablo izinli.

## Öz test ve mutasyon
- Öz test **7.135/7.135** (iki saat dilimi).
- Beş yeni mutant (329–333), hepsi elle tabloda değerle yakalandı:
  - 329: kart payını düşmeyi unut
  - 330: tam alınanı açık say
  - 331: S200 faturalardan en yeniden al
  - 332: S200 önce faturaları al
  - 333: S200 yok
- Bağdaştırıcının mutasyon taraması: 300 yakalandı, 0 yakalanmadı.
- Eski kâhinle karşılaştırma (G3):
  - Sonuç: **630/630**, BEKLENMEYEN 0. Eski kural setleri 504/504 bayt bayt aynı; G3 dökümü iki saat diliminde bayt bayt aynı.
  - Değişen yalnız yeni denetimler; 26.054'ün hepsi yeni. Faturanın kendi açığı dahil hiçbir eski beklenti değişmedi (KAPSAM (a)).
  - Dağılım: gösterim 25.985, S200 51, S200-E0 17, S200-SK18 1.
  - S200-SK18 kaydı, d52'deki ikinci kart adımının (kp6b) sonucu. Eski kâhinde bu cari tanımsız olduğu için adım SK-18 ile susuyordu.
  - İlk G3 koşusunda bu adım BEKLENMEYEN çıktı, elle farkta da 2 izinsiz satır vardı. Neden araç sınıflamasıydı; araç düzeltilip (d6fd46b5) yeniden koşuldu.

## Program ↔ kâhin
Taban dalın programı, `npm run test:kahin-cari` düzeni:

| Koşu | Sonuç |
|---|---|
| Yeni kâhin, UTC | 21.673/21.673, fark 0 (98 senaryo, 7 bilinen sınır, okuma hatası 0) |
| Yeni kâhin, Europe/Istanbul | aynı |
| Eski kâhin (bakım 22), aynı program | 17.602/17.648, **46 fark** |

Eski kâhinin 46 farkı: 16 fatura açığı, 15 açık toplamı, 15 "açık toplamı = bakiye" eşitliği. Senaryolara dağılımı c11 3, d34 3, d36 3, d37 31, d38 6. S229 kanıtındaki sayıyla aynı. Çevrimdışı, eski kâhin yeni elle tablolarda **85/532 kırmızı** veriyor (d52 75, d35 10); hepsi beklenen nedenle.

## Yapım aşaması listesi
Önce 0 kayıt, kendi kopyada yeniden üretildikten sonra da 0 kayıt. Depodaki `test/bagimsiz/cari/YAPIM-ASAMASI.json` ile bayt bayt aynı olduğu için güncellenmesi gerekmedi.

## KULLANICIYA SORULMALI
Yeni soru yok. Programla fark görülürse sorulacak iki uç durum var:
- **Kartın aldığı kısmı tamamen ödenmiş faturanın durumu.** Seçenekler: A 'Ödendi' / B 'Taksitte' / C uç durum böyle kalsın.
- **Taksitli faturanın gösterimi.**

## SONRAKİ SÜRÜME (2.5.1)
Yok.

## DENENMEYEN
- Faturanın vade alanı: dilde yok, S229 örneğindeki vade belge tarihiyle kuruldu.
- Susulan üç durum: ödenmiş kartlı faturanın durumu, taksitli fatura, net görünümlü ya da şüpheli kayıtlı caride kartlı fatura.
- S200'ün öbür türlü kalemli alanı (SK-20 aynen).
- Kâhinin okumadığı ekranlar: Tahsilat Ekle / Mahsup Et formlarının önerdiği tutar, Anlık Durum'daki fatura toplamları, Açık Faturalar raporu.
- Defter ve mobil kâhini açılmadı.

## Değişen yollar
- `test/bagimsiz/cari/`: `model.py`, `kos.mjs`, `oz-test.py`, `KARARLAR.md`
- `test/bagimsiz/cari/senaryolar/`: `d52-c5-s229-s230-gosterilen-acik.json` (yeni), `d35-c5-s120-elle-borclar.json`, `d36-c5-s122-kart-odemesi.json`
- `docs/kanit/2026-11-21/kahin-cari23-arac/`: `kos.sh`, `uret-d52.py`, `elle-guncelle.py`, `karsilastir.py`, `elle-fark.py`, `elle-karsilastir.py`
- `docs/kanit/2026-11-21/kahin-cari23-kanit/` (koşu kanıtları)
- `docs/kanit/2026-11-21/kahin-cari23-rapor-taslak.md`

## Commit listesi
- 3ac77c46: yorum (önce kural, ders 40)
- acda62f9: kod, senaryolar, mutantlar
- b1317cdc: koşu betiği ve rapor taslağı
- d6fd46b5: araç düzeltmesi
- 43bf5f07: UTC kanıtı
- 7e20fd5c: İstanbul kanıtı, eski kâhin, yapım listesi
- 2dbcd218: KARARLAR §35 tamamlandı

## Ana oturumun yeniden koşacağı komutlar
Ağaçtan:
```
bash docs/kanit/2026-11-21/kahin-cari23-arac/kos.sh utc temel
bash docs/kanit/2026-11-21/kahin-cari23-arac/kos.sh ist temel
bash docs/kanit/2026-11-21/kahin-cari23-arac/kos.sh utc program
bash docs/kanit/2026-11-21/kahin-cari23-arac/kos.sh ist program
bash docs/kanit/2026-11-21/kahin-cari23-arac/kos.sh utc program-eski
bash docs/kanit/2026-11-21/kahin-cari23-arac/kos.sh utc yapim
```
- Eski kopya önceden kurulmalı: `git archive s229-uc test/bagimsiz/cari | tar -x -C /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-cari23/eski` (şu an duruyor).
- Betiğin içinde çalışma ağacı yolu sabit yazılı (`W=`); başka ağaçta koşulacaksa düzeltilmeli.
- Her koşu ~3–15 dk sürdü.
- G3 dökümü depoya girmedi (4,6 MB): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-cari23/kanit/kahin-cari23-g3-dokum-utc.json`

Arka planda işim kalmadı. Disk boş yer 6,0 GB.
