TEK ADAY DÜZELTME TURU — beşinci ajanın raporu (devam 4)

Bu turda kalan dört işin hepsi bitti. Ürün kodunda değişiklik yok; yalnız senaryo-banka-210'un beklentisi değişti. Bütün koşular yeşil, kırmızılar beklenen nedenle. Push yapılmadı.

**Taban ve dal**
- Taban `t3duz-devam4` = 7ce23130; `git reset --hard` sonrası uç doğrulandı.
- Dal `worktree-agent-a1804bd47c97d3000`, uç **46217d81** (tabanın üstünde 51 commit).
- Ayrıntı ve ham çıktılar: `docs/kanit/2026-11-20/t3duz-rapor-taslak.md`, `t3duz-ozet.txt`, `t3duz-*.log` / `.json`.

## Önceki ajanların işi (yeniden yapılmadı)
| Commit | İş | Değişen dosyalar |
|---|---|---|
| 24bafd08 | G1 | `server/routes/report-center.mjs`, test `hesapsiz-tumu-250` |
| 0612d825 | B1 | `server/lib/doubtful-gl.mjs`, `server/lib/bank/doubtful.mjs` |
| 9db9b69d | S212 | `server/lib/obligation-queue.mjs` |
| 8f7ef5f6 | DÜŞÜK (a): N7, N8, N11 testleri | yalnız testler |
| 29eb3a5c | DÜŞÜK (b): S181 | `server/routes/cheques.mjs` |
| c8d2a3ef | M12 testi | test |
| a79ccace, 06ba2531 | komşu beklentileri | test |
| fc8bd9d3, 8b66b074, db2ba915, 68b26267, 7aa16bdf | hız işleri | `report-center.mjs`, `bank/money-lines.mjs`, `bank/doubtful.mjs` |

Kök nedenler, iki TZ sayıları (100 / 100) ve taban kırmızısı (98 test, 14 kırmızı, 5 iptal; her biri beklenen nedenle) taslakta.

- **Kâhinler önce / sonra:** `test:kahin-cari` 17.253 / 17.253, `test:kahin-defter` 187 / 187; iki yanda da yeşil.
- **Sürücü:** R-S192-BAG-SONRA yeni kodda artık ateşlemiyor (rastgele-1'de 13 → 0, rastgele-2'de 3 → 0 adım). Kural sınıflamada duruyor, silinmedi.
- **Komşular:** 223 dosya, iki TZ'de 2.590 / 2.590.

## Bu ajanın işi

### (1) senaryo-banka-210 adım 46 — commit 78d5aaab
Beklenti karar numarasıyla ("BEKLENTİ BİLEREK DEĞİŞTİ", G1, S214 = A) uyarlandı:
- Dönem Giriş 26.500 → 21.500.
- Dönem Sonu 165.484,25 → 160.484,25.
- 20.09'daki eski havale satırı raporda kalıyor, "Açılışta Sayıldı" işaretli, tutar hücreleri boş.

Yeni sayılar aynı koşunun defteriyle tutuyor: adım 41'de Gerçek Banka 160.484,25, adım 42'de Banka Bakiye TOPLAM Giriş 21.500, adım 45'te 102.00 hesabı yok.

| Koşu | TZ | Sonuç |
|---|---|---|
| Yeni kod | UTC | 429 / 429 |
| Yeni kod | İstanbul | 429 / 429 |
| Taban kodu + yeni test | UTC | 426 / 429 kırmızı |

Tabandaki kırmızının nedeni beklenen: özet 26.500 / 165.484,25 ve işaretli satır yok. Taban kopyasının `server/` ve `client/` klasörleri `git archive t3duz-taban` ile bire bir denetlendi.

Önceki ajanın "taban" adlı, commit'lenmemiş, yarıda kalmış koşusu adım 46'yı yeni beklentiyle yeşil gösteriyordu. Hangi kodda koşulduğu okunamadı; kanıt sayılmadı.

### (2) Ekran senaryoları
Hepsinde çıkış 0; başarısız, iptal, atlanan yok.

- **UTC, kalanlar:** cari-vade-245 45, ekstre-ayrinti-245 37, iade-246 26, kart-faizi-250 26, banka-230-hareket-yaris 37, suzgec-cubugu-yaris 20, senaryo-211 59, banka-210-yaris 10, ui-ux-217 407.
- **İstanbul, değişen yollar:** supheli-kuyruk-250 15, supheli-230 67, banka-rapor-243 38, ux18-244 27, kasa-acilis-uyari-250 20, pos-kart-249 383, banka-210 429.
- **Ek komşular, UTC:** `money-lines.mjs` ve `cheques.mjs` bütün banka ve evrak yollarında kullanıldığı için taramayla 16 senaryo daha eklendi. banka-210b 90, banka-220 76, pos-220 113, tahsile-ver-220 140, 214 48, 215 73, 219 74, 222 60, 224 69, 226 22, defter-243 33, form-izolasyon-243 188, iz32-230 41, senaryo-rapor 87, tyk-tur2a-250 51, banka-210-kart-onbellek 49.

### (3) Mutasyon
- **Tur 3 dosyası (önceki ajan):** M1–M18 iki TZ'de 18 / 18 yakalandı.
  - **M12 12 / 12 koşuda öldü:** ayrı koşularda 5 UTC + 5 İstanbul, artı iki tam koşu.
  - İlk 1a koşusu çıkış 1 verdi: B1'den sonra M4'ün aradığı satır kalmamıştı; 62f94abe ile uyarlandı.
- **Ç7a dosyası (bu ajan):** 1–24 iki TZ'de 24 / 24 yakalandı.
  - 6, 7, 12 ve 14 ürünün yazım kapısının reddiyle ("Kapı eşdeğerlik ihlali") yakalandı; 13 Mutabakat Testi'yle (`opening:519`). Bu beşi dar kontroldeki "beş mutant kapı reddiyle" maddesine karşılık geliyor. Kalan 19'u değer iletisiyle yakalandı.
- **Hız 3 eşdeğerliği (7aa16bdf'de yeniden):** H1–H5 iki TZ'de 5 / 5.
- **DÜŞÜK yolları (D1–D6: N11, N7, N8, G1 ×2, S181):** iki TZ'de 6 / 6.

**Dikkat — ilk DÜŞÜK koşusu D1'i (N11) "yakalanmadı" verdi.**
- Nedeni okundu: N11'in testi (`kural-farki-yil-250`, program bölümü) v2.4.9 etiketi ister. Git'siz kopyada bölüm atlanıyor ve düğüm koşucusu atlanan bölümü "skipped" sayısına katmıyor (özet "skipped 0" diyor).
- Etiketli `git worktree add --detach` kopyasında (ders 54) D1 iki TZ'de yakalandı. Testte açık yok.
- Aynı nedenle git'siz kopyada koşulan taban kırmızısı bu bölümü içermiyor. N11 tabanda zaten yeşil beklenen bir eksik testti; dişi D1 ile gösterildi.
- Mutasyon betiklerinin çıktısını kanıt aracı tanımıyor ("BELİRSİZ / özet yok"); sonuç betiğin kendi SONUÇ satırından okundu.

### (4) Rapor
Bu ileti ve `docs/kanit/2026-11-20/t3duz-rapor-taslak.md`.

## Hız
Bu ajan ölçmedi; hüküm ana oturumda. Önceki ajanın 68b26267'deki iki kip ölçümünde geçersiz blok 0, kötüleşen yok:
- Bağlı tahsilat / çek ve cari kartı yaklaşık %45 hızlandı (oran 0,49–0,59).
- Şüpheli Alacaklar raporu 0,08.
- "Banka ve POS (Tümü)" yıl 0,82–0,86; tüm zamanlar 0,96–1,07.
- Kasa penceresi 1,04–1,17 idi; 7aa16bdf bunun için geldi ve ölçülmedi.

## KULLANICIYA SORULMALI
Yok.

## Baş mimarın değerlendirmesine
`defter-kaynak-iz-250`'deki SINIF 3 istisnası (önceki ajan, a79ccace): B1'in okuduğu dört `created_at` / `issued_at` sütunu istisnaya alındı.

## DOĞRULANMADI / DENENMEYEN
- 7aa16bdf'nin hız hükmü (ana oturumda).
- Sürücünün s81 senaryosu: eski sürüm git etiketinden açılıyor, kopyada etiket yok; taban ve yeni aynı biçimde düşüyor.
- Ek 16 komşu senaryo yalnız UTC'de koşuldu.
- Taban kırmızısında v2.4.9'a bağlı program bölümleri atlandı (yukarıda).

## Commit'ler (t3duz-devam4..46217d81)
- Ürün kodu yok.
- 78d5aaab: e2e beklentisi.
- b4d2914b, a278820f, f4305189, a3c0b6fa, 9c87be9c, 46217d81: rapor taslağı.
- Geri kalanı her koşu için ayrı "Kanıt: … (TZ, çıkış)" commit'i.

## Yeniden koşu komutları
Betikler `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/t3duz-d4/`:
- **Tek parça:** `bash parca.sh <ad> <kök> <TZ> 2400 -- <komut>`
- **Ekran senaryoları:** `bash e2e-sira2.sh <liste> <TZ> <ek>` — listeler `e2e-utc-kalan.txt`, `e2e-ist.txt`, `e2e-ek-a.txt`, `e2e-ek-b.txt`.
- **Ç7a ve hız / DÜŞÜK mutasyonu:** `bash mut-sira.sh mut-b.txt`. Kopyalar `/dev/shm/t3duz-d4/yeni-c7a` ve `/dev/shm/t3duz-d4/yeni-d` olarak `git archive HEAD ':!docs/kanit'` + `node_modules` bağıyla yeniden kurulmalı (bitince silindiler).
- **D1:** etiketli worktree kopyasında `node mut-dusuk.mjs <worktree kopyası> <döküm klasörü>`.

## Ortam ve temizlik
- `/dev/shm` kopyalarımı ve geçici worktree'mi tam yolla sildim (`git worktree remove --force`, `prune`).
- Disk boş 6,2 GB; yük en çok yaklaşık 5,7'yi bir kez gördü (başka ajan); parçalar yük 4'ün altına inince başladı.
- Ağaçta yalnız izlenmeyen `node_modules` bağı var; commit'e girmedi.
