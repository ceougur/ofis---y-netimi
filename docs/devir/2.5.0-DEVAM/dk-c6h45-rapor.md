# DAR KONTROL: Ç6-HESAP tur 4 + 5 (uç 7af0f4b4, karşılaştırma 7af0f4b4^1, tur 4 kodu f73f4f5a)

Ortam (bitişte): yük 1,35 / 4 çekirdek, bellek boş 2 GB (kullanılabilir 7 GB), disk boş 6,2 GB.
Ağaç: worktree 7af0f4b4'te. Yalnız `node_modules` bağı izlenmeyen dosya olarak duruyor. Commit ya da push yok. Eski kod kopyaları silindi.

## GERİLEME: YOK
Bu farkın dokunmadığı çıktıların eski ve yeni kodda birebir aynı olduğu iki saat diliminde (UTC ve Europe/Istanbul) gösterildi:

- **v2.4.9 kilitli fikstürler:** 12 sınıfın her biri dört aşamada denendi: fişten önce, fiş, kilit 30.09'a ilerletildi, kilit 31.12.2025'e geri çekildi. Toplam 507 Bilanço ve Gelir Tablosu yanıtı alındı.
  - `kesinDegil` ve `bilgi` alanları dışında her alan (sayılar, satırlar, dipnotlar, Aktif = Pasif) eski kodla aynı: 507 / 507, iki saat diliminde. UTC ile İstanbul arasında da 507 / 507 aynı.
  - Betik: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c6h45-ag/betik/s-fis.mjs`; karşılaştırma `betik/sayi-fark.py`.
- **Temiz 100 bin (taze kopya):** kilitsiz, kilit 31.12.2025 ve kilit 30.06.2026 aşamalarının her birinde 15 okuma yapıldı: üç mizan, dört Bilanço, dört Gelir Tablosu, üç değerleme ve cari listesi.
  - Yanıtların özetleri eski ve yeni kodda aynı: 45 / 45, iki saat diliminde (`betik/s-buyuk.mjs`, çıktılar `buyukS-*.json`).
  - Dönem Kilidi süresi (PUT + dondurmanın bitişi), UTC: eski 8.764 / 6.830 ms, yeni 9.235 / 6.850 ms. İstanbul: eski 9.566 / 7.056 ms, yeni 9.637 / 6.837 ms.
  - Bu süreler yük 3–4,5 altında alındı; kabul ölçümü değil, yalnız eğilim.
- **Komşu yığını (yeni kod):** 447 / 447 GEÇTİ, iki saat diliminde, iptal ve atlanan yok (`komsu-*.out`).
  - Kapsam: c6h-*, donmus-defter-*, kural-farki-*, devir-d2-*, sema-kapisi-bs7, backup, banka-210-gg-geri-yukle, fis-defteri-*, yedek-220, createapp-acilis-geri-alma, sirket-ayir, accounts-stock, kilit-izi-alanlar, c7b-sifirla, defter-turu-c4.

## BULGU-1 — ORTA (gerileme değil; K1'deki ORTA-2 kararının eksik uygulanması)
**Sorun:** Kilit, fişin yılının başından önceye geri çekilirse fişi içeren Gelir Tablosu'nda "Kural Değişikliği Farkı" nedeni hiç çıkmıyor. Aynı gün Bilanço nedeni KALAN tutarla gösteriyor.

- **Yer:** `server/lib/financial-statements.mjs:477`. KALAN yalnız `if (cover && cover >= start)` bloğunun içinde hesaplanıyor; `cover < start` olunca `posted` / `correction` hiç kurulmuyor.
- **Betik:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c6h45-ag/betik/s-fis.mjs`, s3 aşaması. Özetler `betik/s3tablo.py` ve `betik/gt770.py` ile alındı. İki saat diliminde aynı.
  - Adımlar: fiş 01.07.2026'da yazılır, sonra kilit 31.12.2025'e geri çekilir.
  - Yönetim'in planı fazla düzeltmenin tersini öneriyor (KALAN ≠ 0).

| Sınıf | Yönetim KALAN | Bilanço 20.10.2026 nedeni | GT 01.01–20.10.2026 nedeni |
|---|---|---|---|
| kasa | 770 +300 / 770.90 −300 | "770: 300,00 TL", "770 (770.90): −300,00 TL" | YOK |
| pos | 602 −1.000 / 602.90 +1.000 | KALAN ile | YOK |
| stok | 600 / 600.90 ±400, 610 / 610.90 ±100 | KALAN ile | YOK |
| elle-borc-alacak | 770 +700 / 770.90 −700 | KALAN ile | YOK |

- **Görünen sonuç (kasa):** GT 2026'da 770 = −300,00 TL (eksi gider satırı), 770.90 = 750,00 TL. Dipnot 3 "Kasa ve banka 'Diğer Gider' çıkışları (750,00 TL)" diyor; geri çekmeden önce 450,00 TL idi. Kesin Değil'de yalnız `bilgi-amacli` var.
- **Geçerli kural:** tasarım §11.2 ve K1 metin kararı: fiş [a, b] içindeyse aynı KALAN; KALAN ≠ 0 ise neden KALAN tutarla.
- **Eski kodla karşılaştırma:** 7af0f4b4^1'de de GT nedensiz (`fis-eski-*.json`). Yani gerileme değil; tur 4 bu durumu kapsamadı. Testler (`c6h-kural-farki-fis`, `c6h-tek-okuma`) geri çekilme durumunda yalnız Bilanço'ya ve gt25'e bakıyor.
- **Etki:** Gelir Tablosu'nun 2.5.0'da ekranı yok (Ç6-EKRAN 2.5.1'de). Kullanıcı görmez, ama program çıktısı ve MA'nın incelediği çıktı uyarısız yanlış dağılım gösterir. Durum seyrek: fiş yazılmış ve kilit fişin yılından önceye çekilmiş olmalı.
- **En küçük düzeltme:** `incomeStatementOf` içinde `cover` dolu ama `< start` iken, `postedCorrectionsAt(store, to).active` içinde `date >= from` olan fiş varsa:
  - `fullRuleDiff(frozenPartOf(frozenSums(store, { from: "", through: cover })), [], live, cover)` ile `ruleDiffRemainder` hesaplanır (hesaplar 6 / 7 ve 153);
  - sonuç `ruleDiff = null` ile `correction` olarak geçirilir;
  - `ruleFacts` ham satır boşken KALAN ≠ 0 ise nedeni KALAN ile, = 0 ise hiçbir şey yazmaz.
  - Maliyet yalnız bu seyrek durumda bir donmuş toplam okuması.
- **Öneri:** ekransız 2.5.0'da düzeltilmezse 2.5.1'e (Ç6-EKRAN ile) ve BİLİNEN SINIRLAR'a yazılması baş mimarın kararı.

**YÜKSEK yok. Başka ORTA yok.**

## İLK MADDELER
1. **ORTA-1 (alt hesap / cari): DOĞRU.**
   - Yalnız alt hesabı değişen tutar artık fark veriyor: pos "602: 1.000,00 / 602 (602.90): −1.000,00"; kasa 770 ↔ 770.90 ve 649 ↔ 649.90; stok 600 / 610 ↔ .90.
   - Kasa, banka ve cari sınıflarında neden tutarları Yönetim planının satırlarıyla tutarlı. Örnek banka: 500 / 519 25.000,00 TL. Önceki yılların 6 / 7 farkı 671 / 681'e eşleniyor.
   - Cari boyutu Bilanço'da: komşu testteki "2026 · 120 · Ayşe Yılmaz: 100,00 TL".
   - Tablo tutarları eski kodla aynı (yukarıda, 507 / 507).
2. **ORTA-2: DOĞRU, BULGU-1 hariç.**
   - Fiş gününden itibaren Bilanço ve GT'de neden düşüyor, "Kural Farkı Düzeltildi (Fiş 2026-000001)" bilgi satırı geliyor. Yönetim de "rule-diff-nothing" diyor; banka, çek-senet, elle-borç-alacak, kasa, pos, satış faturası, stok, şüpheli, taksit sınıflarında.
   - Fişten önceki gün (bs0630) ve fişi içermeyen dönem (gt26a, 01.08–30.09) ham farkla aynen kalıyor.
   - Kilit fiş gününün ötesine ilerleyince (30.09) bilgi satırı sürüyor.
   - KALAN ≠ 0 ise Bilanço KALAN ile gösteriyor. GT'deki açık BULGU-1.
3. **S236 = A ve K2: DOĞRU.** Betik `betik/s-deger.mjs`; iki şirket, iki saat dilimi; UTC ile İstanbul 12 / 12 adım aynı.
   - Kilit 30.06.2026'dan sonra P 30 → 90 ve K 50 → 80 yapıldı: GT 2025, GT 1. yarı, Bilanço 31.12 ve 30.06 değişmedi. Açık dönem güncel kartla değişti.
   - Kilit 30.09'a ilerletilince yeni koşu o anın kartıyla kuruldu (koşu 2: K 80, P 90).
   - Yedek → kart değişikliği (P 10, H Hizmet) → geri yükleme → yeniden açılış: sayılar ve kartlar yedekteki hâliyle birebir.
   - Kilit 30.06'ya geri çekilince 3. çeyrek güncel kartla hesaplandı; yeniden kilitlenince koşu 4 yeni kartlarla kuruldu ve sayılar değişmedi.
   - 002 şirketi 001'deki kart değişikliklerinden etkilenmedi.
   - Toplanabilirlik her adımda tuttu: 1. yarı + 3. çeyrek + 4. çeyrek = GT 2026. Aktif = Pasif her adımda.
   - v2.4.9'dan göç (fikstür stok-kilitli), tetikleyiciler, göçün yeniden koşusu ve Şirket Verisini Sıfırla'nın `clearSnapshots`'ı `c6h-degerleme-dondurma` testinde ve komşu yığınında geçti. Şema kapısı ve geri yükleme komşu yığınında 447 / 447.
4. **Tur 5 eşdeğerliği: BİREBİR.**
   - Tur 4'ün gerçek kodu (f73f4f5a) ile yeni kodun yanıtları her alanıyla aynı: 507 / 507, iki saat diliminde. Kapsanan durumlar: fişten önce, fişten sonra, kilit fiş gününün ötesinde (through < kapsam), KALAN ≠ 0.
   - Alt defter farkı kurgusu (`betik/s-altdefter.mjs`; kasa fikstürü, fişten sonra kilitli 15.02.2026 Kasa çıkışı SQL ile 300 → 400 — kapı dışı, yalnız dalı denemek için): yeni = tur 4 (Bilanço ×2, GT ×2).
     - KALAN `{exact: false}` döndü, neden ham farkla yazıldı (K3 (3) ile aynı).
     - Alt defter kümesi BOŞ verilirse (mutant) sonuç `{exact: true, lines: [100 A 100,00; 770.90 B 100,00]}` oluyor, yani farklı çıktı. Bu kurgu bir testte o mutantı yakalardı; bugün test yok, aşağıda 2.5.1 maddesi.
5. **Testin dişi:** yeni testler birleşim öncesi kodda 32 / 32 KIRMIZI, yeni kodda 84 / 84 YEŞİL, iki saat diliminde. Kırmızıların nedeni okundu (ders 38):
   - **ORTA-1 testleri:** "Gelir Tablosu nedeni alt hesap satırlarıyla — null".
   - **S236 testleri:** "K 50 → 80: kilitli 2025 aynı — d −80000 / dss 90000"; göçte "dss 0 / gt25 79800".
   - **ORTA-2 testleri:** "bsNow: neden düştü — ham 500 / 519 sürüyor"; KALAN durumunda "770 300 bekleniyordu".
   - **Eşdeğerlik testleri** (c6h-tek-okuma; c6h-kural-farki-fis'in hızlı yol ↔ Yönetim testleri): "fullRuleDiff / postedCorrectionsAt işlevi yok". Bunlar yapı gereği eski kodda anlamlı kırmızı veremez (2.5.1 maddesi).

## HIZ
- **Bilinen sınır:** Gelir Tablosu'nun fiş içi süresi yeniden bulgu yazılmadı.
- **Yeni gözlem (DÜŞÜK, programın görünen bir yolu yok):** değerleme okuması donmuş kart sayısıyla büyüyor.
  - Ölçüm kurgusu: temiz 100 binde 12 aylık kilit + 24 kez kilit aç / yeniden kilitle → 36 dondurma koşusu, 38.160 kart satırı.
  - Değerleme ucu eski 703–857 ms, yeni 803–952 ms (≈ +100 ms, +%12–15). Bilanço ve GT gürültü içinde (+%0–5).
  - Dönem Kilidi süreleri aynı (aç / kapa ortancası eski 4.885 / 5.812 ms, yeni 4.822 / 4.755 ms). Olay döngüsü en çok yeni 84–105 ms.
  - Yanıt özetleri eski = yeni (`buyuk2S-*.json`, `betik/s-buyuk2.mjs`).
  - **Ölçüm geçerliliği:** özel kilit alınamadı. Başka oturumların paylaşılan kilitleri sürdü (tam npm test, izt3 g2-kos). Ölçüm paylaşılan kilitte ve yük 1,6–4,2 altında yapıldı, kabul ölçümü sayılmaz. Kendi özel kilitli koşularımı bekleme süreleri dolmadan kendim durdurdum.

## KULLANICIYA SORULMALI
Yok. BULGU-1 kural sorusu değil; karar metni açık.

## BAŞ MİMAR KARARLARI — değerlendirme
- **K1:**
  - (2) ORTA-1, ORTA-2 metin seçimi ve S236 = A uygulandı ve karar metnine uyuyor. Tek istisna BULGU-1: GT'de `kapsam < yıl başı` durumu.
  - Kabul maddeleri:
    - eski kodda kırmızı: tamam;
    - komşu: tamam;
    - göç, şema kapısı ve geri yükleme: tamam;
    - hız: yalnız eğilim, yukarıda.
  - (3) ve (4) uygun.
- **K2:**
  - (a) Dosya sınırına uyulmuş. `ledger-snapshots`'ta yalnız yeni işlevler, `insertRun` içinde tek çağrı, `clearSnapshots` ve tur 5'in `frozenSums` `ruleThrough` parametresi var. `migrations`'da yalnız sonda göç 54. `app.mjs`, `ledger-opening.mjs` ve `routes/ledger.mjs` değişmemiş.
  - (b) Süreklilik doğru: açık yılın dönem başı = donmuş dönem sonu; toplanabilirlik ve Aktif = Pasif her t'de; iki okuma arasında sayısal fark yok.
    - Not (kural sorusu değil, kararın doğrudan sonucu): yıl ortası kilitte, karta dayalı değerlenen (KG-10) üründe kart değişirse 153, kapsam günü ile ertesi gün arasında hareket olmadan sıçrıyor (30.06'da 650,00 → 01.07'de 950,00 TL); fark açık dönemin satışların maliyetine giriyor.
  - (c) KALAN tam `ruleDiff` olmadan hesaplanıyor (kod okundu). Eşdeğerlik yukarıda.
- **K3:**
  - (1) Seçenek (b) uygulandı. Eşdeğerlik birebir (507 / 507 ×2 saat dilimi + alt defter kurgusu).
  - (2) Üç testteki göç numarası değişikliği yalnız 53 → 54. c6h-bilanco-uc'un cari boyutlu beklentisi ve c6h-esdegerlik'in `party: true` başvurusu bilerek yapılmış ve tutarlı.
  - (3) Alt defter farkında nedenin ham farkla kalması yeniden üretildi; bilinen sınır olarak uygun.
  - (4) ve (5) uygun.

## SONRAKİ SÜRÜME (2.5.1) — DÜŞÜK
- Alt defter farkı olan kurgunun teste girmesi (boş alt defter kümesi mutantını yakalar; kurgu `betik/s-altdefter.mjs`).
- BULGU-1 durumunun testi (kilit fiş yılından önceye geri çekilince GT).
- Eşdeğerlik testlerinin eski kodda yalnız "işlev yok" diye kırmızı olması.
- Donmuş kart okumasının koşu × ürün ile büyümesi (≈ +100 ms / 38 bin satır). Öneri: yalnız kapsamla örtüşen en son koşuları okumak.

## DOĞRULANMADI
- Kilitten sonra Hizmet'ten Ürün'e çevrilen kalemin açık yıla 0 miktarla başlaması: ürün hizmet iken stok hareketi varsa eksi stok uyarısı çıkabilir. Kurgu kurulmadı.
- GT'de 6 / 7 KALAN = 0 iken bilanço hesaplarında KALAN ≠ 0 olunca GT'nin "Düzeltildi" demesi. Fikstürlerde böyle bir durum yok.

## DENENMEYEN
- Özel kilitli hız kabul ölçümü (kilit alınamadı).
- 1 M satır, Windows, tam npm test, e2e ve ekran, mutasyon koşusu.
- Açılış onarımı yeniden dondurması (tasarım §11.3'te bilinen sınır).
- Kilit isteği ile dondurmanın bitişi arasında kart değişikliği.
- v2.4.9'un iki şirketli göçü; yalnız tek şirket fikstürü denendi, iki şirket yeni veriyle denendi.

## Ana oturumun yeniden koşacağı komutlar
Not defteri klasörü `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c6h45-ag`.

- **BULGU-1 (s-fis):**
  `cd /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c6h45-ag && TZ=UTC flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 2400 node betik/s-fis.mjs <KOD> fis.json kasa pos stok elle-borc-alacak && python3 -I betik/s3tablo.py fis.json && python3 -I betik/gt770.py fis.json kasa gt26`
- **S236:**
  `TZ=UTC flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 900 node betik/s-deger.mjs <KOD> deger.json && python3 -I betik/ozet-deger.py deger.json`
- **Alt defter kurgusu:**
  `TZ=UTC flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 600 node betik/s-altdefter.mjs <KOD> alt.json`
- **Büyük veri birebir:** `timeout -k 5 7200 bash buyukS.sh` (paylaşılan kilit).
- **Kilit geçmişli değerleme süresi:** `timeout -k 5 7200 bash buyuk2.sh` (özel kilit). Bash `timeout` parametresi 7200000.

Kod klasörleri: yeni kod `/home/user/ofis---y-netimi/.claude/worktrees/agent-a805b8befcaddbd0c`. Eski kod ve tur 4 kodu `git archive 7af0f4b4^1` / `git archive f73f4f5a` + node_modules bağı ile yeniden kurulur (kopyalar silindi).