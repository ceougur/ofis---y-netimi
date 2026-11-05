# 2.4.9 B2 / R2 / B3 — süre ölçümü, makine BOŞKEN (05.11.2026, 08:46–09:20 UTC)

Ölçüm ajanı yalnız ölçtü: ürün kodu değişmedi, commit/push yok. Bu klasör (`olcum-249-q5n8/cikti`) ana oturumca depoya (ör. `docs/kanit/2026-11-05/249-b2-b3-bos-makine/`) taşınır.

## Kod, ortam
- YENİ = ana depo `/home/user/ofis---y-netimi`, dal `claude/compassionate-galileo-f9kghg`, HEAD **5a22228a** (`git diff 78976042 HEAD -- server client package.json` BOŞ → ürün kodu 78976042 ile aynı); ağaç temiz.
- ESKİ = `git archive e3f74093` (not defterinde ayrı kopya `olcum-249-q5n8/eski-e3f74093`, ders 23/25); test/b2-249 + test/isz-248 HEAD'den bindirildi (03.11 kopyasıyla bayt bayt aynı), node_modules sembolik bağ, npm komutu YOK. Ölçümden sonra silindi.
- Açılış/göç kök neden denetimi için ayrıca `git archive 91d2a200` (03.11 B3 ölçümünün commit'i; test/isz-248 + test/t9-248 HEAD'den) — ölçümden sonra silindi.
- linux x64, 4 çekirdek, 16 GB, Node v22.22.0. `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30), Meta/lisans/kapıcı yerel sahte (test/isz-248/ortak.mjs).
- Her koşu `flock /tmp/destekofis-olcum.lock` + `flock scratchpad/tam-npm-test.lock` altında TEK TEK (ders 15); her koşunun `.uptime` dosyasında önce/sonra `uptime`, `df`, en çok CPU kullanan 5 süreç.
- Başta (basta-makine.txt): yük 0,13 / 0,22 / 0,32; `df -h /` 13 GB boş (≥ 5 GB, ders 24); başka ağır süreç YOK. Koşular sırasında yük 1 dk ortalaması ≤ ~1,3 — kendi ardışık koşularımızın kalıntısı (ps'de yabancı süreç yok; yalnız kendi bitmiş chrome'umuz ve anlık git status). 03.11 ölçümleri yük ~4,6–5,1 altındaydı.

## Komutlar
`betikler/zincir.sh yeni-taban eski-taban yeni-iade yeni-ek ekran-yeni hazir-bes-bin yeni-bes-bin hazir-gecmis yeni-gecmis b3-uret b3-dosya b3-goc` (zincir.txt: hepsi çıkış 0),
sonra `betikler/acilis-ab.sh` (açılış dönüşümlü 3 çift) ve goc-ab (aynı kalıpla gecmis-40 göç+açılış dönüşümlü 2 çift; komut acilis-ab.sh ile aynı, `--veri t9-4c8e1d/gecmis-40 --goc`).
Tablolar: `node test/b2-249/olcum-tablo.mjs cikti` → olcum-tablo.log (14/14 ok); `node test/r2-249/olcum-tablo.mjs cikti` → r2-olcum-tablo.log (6/6 ok). B3 koşuları `tools/kanit.mjs kos` ile (KANIT_DIR=cikti/kanit): 3/3, 2/2, 3/3 GEÇTİ.

## Veri (hepsi programın kendi API'siyle üretilmiş)
- taban: `b2-kod-a954/hazir-taban` — 03.11 B2 ölçümünün AYNI hazır verisi (salt okunur kaynak; her koşu taze kopya). Eski ↔ yeni aynı veri (ders 15).
- iade: `r2-249-aa56/hazir-iade` — 03.11 R2 ölçümünün AYNI hazır verisi (4.021 cari, 1.030 iade, 1.001 coverCuts'lı; salt okunur). B2'nin 03.11 iade kopyası silinmişti; R2'ninki aynı betikle (ek-hazirla iade) üretilmişti.
- bes-bin: YENİDEN ÜRETİLDİ `test/b2-249/ek-hazirla.mjs hazir-taban → olcum-249-q5n8/hazir-bes-bin bes-bin` (HEAD koduyla): 5.000 cari, reddedilen 0 (03.11 özetiyle aynı sayılar).
- gecmis: YENİDEN ÜRETİLDİ `test/b2-249/esitlik-hazirla.mjs t9-4c8e1d/gecmis-40 → olcum-249-q5n8/hazir-gecmis` (HEAD koduyla). FARK: "silinmiş cari" sınıfı 2.4.9 kuralıyla REDDEDİLDİ
  (şirket 001'de 15, 002'de 3: "Bu carinin 1 cari hareketi var. Hareketi olan cari silinmez; …" — C1 hareketli cari kuralı, bilinçli ürün değişikliği). Sonuç: 001'de 3.036 cari (03.11: 3.021),
  silinmiş cari 0. Ölçüm 2.000 seçili kişiyle yapıldığından etkisi ihmal edilir; eşitlik verisi olarak kullanılacaksa bu sınıf eksik (ölçüm için değil).
- B3: `t9-4c8e1d/taban-2910` (209 MB, v44) ve `t9-4c8e1d/gecmis-40` (v44), salt okunur; betikler taze kopya alır.

## B2 + R2 — hücre: süre / olay döngüsü en çok / başka kullanıcı en çok (ms); yeni 2 tekrar ";" ile
| set · istek | kişi | ESKİ e3f74093 (bugün, 1 tekrar) | YENİ 5a22228a (bugün, boş makine) | 03.11 YENİ (yük ~5) | bütçe |
|---|---|---|---|---|---|
| taban · Ekstre Bu Ay | 2.000 | 25.479/25.238/25.262 | 1.026/843/812 ; 925/701/709 | 1.002/799/788 ; 969/754/816 | ≤ 2.000 |
| taban · Ekstre Geçen Ay | 2.000 | 24.891/24.688/24.674 | 1.107/857/887 ; 886/683/666 | 971/719/747 ; 1.108/824/886 | ≤ 2.000 |
| taban · Ekstre Son 3 Ay | 2.000 | 25.918/25.729/25.701 | 854/670/639 ; 871/645/650 | 834/636/615 ; 848/652/632 | ≤ 2.000 |
| taban · Ekstre Tüm Hareketler | 2.000 | 27.518/27.141/27.275 | 936/699/709 ; 983/787/753 | 985/769/748 ; 1.012/781/785 | ≤ 2.000 |
| taban · Mesaj | 2.000 | 24.713/24.464/24.502 | 724/532/508 ; 813/615/603 | 845/625/637 ; 769/564/560 | ≤ 2.000 |
| taban · Tümüne Ekstre | 3.021 | 38.813/38.626/38.593 | 1.314/1.106/1.094 ; 1.523/1.236/1.295 | 1.543/1.234/1.315 ; 1.404/1.136/1.182 | ≤ 3.000 |
| taban · Tümüne Mesaj (aktif) | 2.986 | 35.399/35.125/35.182 | 1.647/1.415/1.430 ; 1.535/1.275/1.316 | 1.223/1.031/1.007 ; 1.280/1.086/1.076 | ≤ 3.000 |
| bes-bin · Tümüne Ekstre | 5.000 | — | 2.017/1.718/1.741 ; 1.776/1.373/1.474 | 2.389/1.933/2.121 ; 2.015/1.549/1.709 | ≤ 5.000 |
| bes-bin · Tümüne Mesaj | 5.000 | — | 1.445/1.224/1.226 ; 1.342/1.134/1.121 | 1.784/1.455/1.543 ; 1.809/1.538/1.589 | ≤ 5.000 |
| gecmis · Ekstre Bu Ay | 2.000 | — | 1.025/806/801 ; 901/716/685 | 809/631/594 ; 913/716/698 | ≤ 2.500 |
| gecmis · Ekstre Tüm | 2.000 | — | 1.035/800/804 ; 1.040/807/812 | 1.054/841/824 ; 1.130/876/905 | ≤ 2.500 |
| gecmis · Mesaj | 2.000 | — | 910/731/700 ; 741/561/530 | 950/741/738 ; 882/672/712 | ≤ 2.500 |
| iade · Ekstre Bu Ay (ilk 2.000) | 2.000 | — | 887/663/674 ; 822/608/609 | R2 sonrası 1.386/945/1.141 ; 1.295/1.016/1.075 | ≤ 2.000 |
| iade · Tümüne Ekstre | 4.021 | — | 1.385/1.159/1.159 ; 1.684/1.359/1.456 | R2 sonrası 1.850/1.550/1.609 ; 2.021/1.633/1.784 | ≤ 3.000 |
| R2 · alıcı listesi son 2.000 (iade carileri) | 2.000 | — | 777/554/565 ; 792/535/582 | 804/555/589 ; 787/519/619 | ≤ 2.000 |
| R2 · otomatik önizleme son 2.000 | 2.000 | — | 814/539/611 ; 668/439/464 | 765/524/563 ; 641/426/438 | ≤ 2.000 |
| R2 · otomatik önizleme Tümüne | 4.014 | — | 1.132/910/927 ; 1.294/1.027/1.087 | 1.288/1.033/1.080 ; 1.461/1.211/1.257 | ≤ 3.000 |
| R2 · cari kartı 200 tek istek (bilgi) | 200 | — | istek p50 26,7 / 26,3 ms, en çok 329 / 301 ms | p50 30,2 / 28,5, en çok 396 / 393 ms | — |

Eski ↔ yeni (taban, aynı veri): 24,7–38,8 sn → 0,7–1,6 sn (25–35 kat); eski kodda olay döngüsü süre kadar kilitli (başka kullanıcı 24–38 sn bekler). 03.11 eski: 24,6–38,9 sn — aynı düzey.

## Ekran (Playwright, taban, "Süzgeçteki 2986 cariye ekstre", yeni kod, 2 tekrar; ekran-yeni.json)
| ölçü | bugün | 03.11 (ekran2-yeni) |
|---|---|---|
| tıklama → pencere dolu | 2.707 ; 2.082 ms | 2.168 ; 1.791 ms |
| /targets yanıtı (pencere açılışı / dönem değişimi) | 98 / 111 ; 36 / 137 ms | 35 / 1.625 ; 1.461 / 100 ms |
| Yalnız Borçlu / geri | 791 / 875 ; 489 / 509 ms | 437 / 411 ; 421 / 433 ms |
| tek kişi işareti | 1.109 ; 425 ms | 610 ; 360 ms |
| Hepsini Seç | 356 ; 420 ms | 469 ; 494 ms |
| Ekstre Dönemi değişimi (yeniden çizim dahil) | 2.157 ; 2.180 ms | 2.199 ; 2.383 ms |
İlk tekrar her iki günde de ikinciden yavaş (tarayıcı ısınması); ikinci tekrarlar 03.11 ile aynı düzey. İstemci tarafı yeniden çizim (prepare() 2.986 satır) sunucuyu kilitlemez; B2 kapsamı dışı, bütçesi yok.
Eski kod ekranı bugün koşulmadı (03.11: 43,9 sn'de "Sunucu zamanında yanıt vermedi", ERR_ABORTED).

## B3 (wa_job_pdfs, göç v45) — tasarım B3-6 ölçümü, yalnız YENİ kod (dal ucu)
Üretim `test/t9-248/wa-gecmis-uret.mjs --veri taban-2910 --toplam 100 --bas 0 --adet 10 --olc` (10 × 2.000, 20.023 iş satırı) + `b3-dosya-olcum.mjs`; göç `b3-dosya-olcum.mjs --veri gecmis-40 --goc`.
| ölçü | bugün 5a22228a | 03.11 sonra 91d2a200 (yük ~4,6) | 03.11 önce eski |
|---|---|---|---|
| şirket dosyası (taban 185,1) | 260,4 MB (+75,3) | 267,6 (+82,5) | 274,7 (+89,6) |
| wa_jobs toplam / sayfa içi boş / yük | 16,2 / 3,0 (%18,5) / 13,0 MB | 16,2 / 3,0 / 13,0 | 31,3 / 18,0 / 13,0 |
| bütün dosya sayfa içi boş / yük; boş sayfa listesi | 19,8 / 180,3; 52,1 MB | 19,8 / 180,3; 59,2 | 34,8 / 180,3; 51,3 |
| VACUUM INTO (yedek) | 197,5 MB, 616 ms | 197,5 MB, 803 ms | 197,5, 980 ms |
| tepe açık PDF (bakımdan önce) | 1.619 satır, wa_job_pdfs 52,3 MB | 1.539, 49,2 MB | 1.733 satırda |
| bakım sonrası PDF tutan iş | 0 (wa_job_pdfs 0 satır) | 0 | 0 |
| iş başına p50 / p95 / en çok | 27–29 / 38–40 / 114–383 ms | 29–36 / 45–70 / 168–903 | 29–32 / 44–62 |
| gönderim sırasında olay döngüsü en çok | 50–316 ms | 135–717 | 141–1.064 |
| bakım turu (gönderim sonu) / olay döngüsü | 3–92 / ≤ 11,3 ms | 19–116 / ≤ 15,3 | 12–167 |
| 10 gönderim toplam süre | 660 sn | 797 sn | — |
| yeniden açılış (b3-dosya-olcum) / olay döngüsü | 6.200 / 6.220 ms | 5.703 / 5.771 | 5.830 / 5.859 |
| bakım ×5 (yeniden açılmış dosya) | 89–118 ms | 86–112 | 144–200 |
| göç v45 (gecmis-40, 434,2 MB): yedek / toplam | 777 / 901 ms; wa_job_pdfs 1 satır 33.320 B, pdf_blob 0, dosya 434,2 MB | 1.164 / 1.320 | — |
| açılış (göç dahil) gecmis-40 | 8.594 ms | 7.259 | 6.194 (göç yok) |

Kabul ölçütleri (B3-6, önceden yazılı): dosya artışı ≤ 21,5 + 66 + %10 = 96,3 MB → 75,3 ✓; "wa_jobs boş ≤ %10" → gerçek akışta %18,5 ✗ — 03.11 ile AYNI, kayıtlı BİLİNEN SINIR (kaynak durum bildirimleriyle satır büyümesi, PDF değil); iş başına süre / olay döngüsü gerilemesi yok ✓ (bugün daha iyi — boş makine).

### Açılış süresi 03.11'den uzun görünüyor → dönüşümlü kök neden denetimi (ders 6)
Tek koşuda açılış 6.200 ms (03.11 5.703) ve göçlü açılış 8.594 ms (03.11 7.259). Aynı veriyle HEAD ↔ 91d2a200 dönüşümlü koşuldu:
- acilis-ab/ (b3 sonrası dosya, 3 çift): HEAD 7.138 / 6.441 / 6.106 ms; 91d2a200 6.392 / 6.539 / 6.288 ms. Bakım ×5 ikisinde 80–140 ms.
- goc-ab/ (gecmis-40 göç + açılış, 2 çift): HEAD göç 917 / 906, açılış 9.726 / 8.758 ms; 91d2a200 göç 878 / 787, açılış 8.327 / 9.770 ms.
Hüküm: iki kod aynı aralıkta (± ~1 sn koşudan koşuya gürültü; açılışın büyük kısmı 185–434 MB dosyanın ilk okunması). 91d2a200 → 78976042 sunucu değişiklikleri (20 dosya) açılışta GERİLEME yaratmıyor. Not: açılış süresince olay döngüsü açılış kadar meşgul (6–10 sn) — program sunucu açılmadan önce, istek hizmeti başlamadan; 03.11'de ve eski kodda da aynı, B3 kapsamı dışı.

## Bütçe hükmü
B2 (§6): 14/14 hücre bütçe içinde (süre VE olay döngüsü en çok); en yüksek: Tümüne Mesaj 2.986 → 1.647 ms / 1.415 ms (bütçe 3.000), 5.000 → 2.017 / 1.718 ms (bütçe 5.000).
R2: 6/6 bütçe içinde; Tümüne 4.021 → 1.684 / 1.359 ms; önizleme 4.014 → 1.294 / 1.027 ms. B3: kabul ölçütleri 03.11 ile aynı sonuç (wa_jobs boş %18,5 kayıtlı BİLİNEN SINIR).
03.11'e göre belirgin kötüleşen değer YOK. Tek fark Tümüne Mesaj (aktif) 2.986: 1,54–1,65 sn (03.11 1,22–1,28) — bütçenin yarısı; 03.11 yük altındaydı, bugünkü boş makinede daha yavaş çıkması tek
kümelik (2 tekrar) dalgalanma ile uyumlu; ham çıktıda hata/ret yok (durum 200, başka kullanıcı hatası 0). Ekranda ilk tekrar yavaş (ısınma), ikinci tekrar aynı düzey.

## DENENMEYEN
- Eski kod yalnız taban setinde 1 tekrar (görev gereği); bes-bin / gecmis / iade / önizleme / ekranda eski kod bugün ölçülmedi (karşılaştırma 03.11 eski değerleriyle).
- "gecmis" setinde silinmiş cari sınıfı yok (2.4.9 C1 kuralı silmeyi reddetti) — ölçüm etkisi ihmal edilir.
- B3'te eski kod bugün ölçülmedi; 40 gönderim (BULGU 3 ile birebir) bugün de ölçülmedi; eşzamanlı çok kullanıcı ölçümü yok; Windows'ta ölçüm yok.
