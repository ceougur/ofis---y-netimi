# Ç7a tur 2 — ARA RAPOR: K-14 / K-15 bitti; KG-6, alan adı ve kılavuz başlamadı

Dal `worktree-agent-a72dc7db7f2bd153a`. Taban `c7a2-taban` (5abefb4c), uç `5ba59cbc`. Push yapılmadı.
Ortam (10:2x UTC): yük 0,45 / 4 çekirdek, boş bellek 8 GB, boş disk 10 GB.

**Kısaca:** Tasarım notu, iş 0 (veri kaynağı, K-14 kısmı) ve iş 3 (K-14 / K-15) bitti. Kodlandı, test edildi, commit'li, kanıtı depoda. İş 1 (KG-6), iş 4 (kart formundaki alan adı) ve iş 5 (kılavuz) BAŞLAMADI. Bağlamım daraldığı için durdum. Bu üçü yeni temiz ajana verilmeli (ders 46). Yarım iş yok.

## Bu turun değiştirdiği davranışlar (S179 = A; kural kitabı K-14 / K-15)
- **Defter.** Hesabı atanmamış satır, yolunun EN GEÇ açılış tarihinden ya da Devir Kapanışı gününden önceyse artık 102.00 / 108.00'a değil 519'a yazılır. Olağan madde, hareketin tarihinde.
  - Kart yolunda ayrım yöne göre: çıkış (kurumsal kartla ödeme) kart hesaplarının en geç açılışına bakar; giriş (POS tahsilatı) yalnız Devir Kapanışı'na bakar.
  - Örnekler:
    - 20.09 hesapsız havale 5.000 (açılış 01.10): önce B 102.00 / A 120 → şimdi B 519 / A 120.
    - 15.09 kartla ödeme 400 (kart açılışı 01.10): önce A 108.00 → şimdi A 519.
    - Açılış günündeki (01.10) satır 102.00'da kalır. Ölçü "küçüktür", eşit değil.
- **Devir Kapanışı maddesi** artık B 519 / A 519 olarak netlenir ve Yevmiye'de görünmez. 519 bakiyesi değişmez. Sihirbazın kapanış tutarı ham kalır (2.4.9 kuralıyla da tutarlı).
- **Hesap kümesi:** silinmemiş TL hesaplar; durum fark etmez (pasif hesap da sayılır). Silinen hesabın açılışı ters kaydedildiği için sayılmaz.
- **Kova bakiyesi** aynı satırları düşer: Banka Genel Bakış, Hesaplar, ANLIK DURUM, Nakit Akış, Birleşik Rapor, Hesabı Atanmamış toplamı ve Alt Hesap Mizanı (102.00 / 108.00). Örnek (sihirbaz testi): kova 6.000 → 2.000.
- **Açılış Eşleştirme 519 dökümü:** yeni tür "Hesapsız Hareketler (Açılıştan Önce)".
- **Kart Borcuna Aktar havuzu** kart hesaplarının en geç açılışından başlar. Tek kartta değişmez; çok kartta daralır.
- **Kurulum Sihirbazı** ön izlemesindeki "sonra" kovası kurulumdan sonraki sınırlarla hesaplanır.
- **Değişmeyenler:** Hesabı Atanmamış LİSTESİ ve Banka raporlarındaki "Hesabı Atanmamış" seçimi açılışta sayılmış satırları göstermeye devam eder. Kasa penceresi değişmez. Kasa, cari, stok ve taksit bakiyeleri değişmez.

## Commit'ler
- 8292d3c4 — tasarım notu, koddan önce (`docs/erp/C7A-BANKA-TASARIM.md` §13)
- df68e175 — iş 0:
  - `routes/ledger.mjs`: `refs().cover` ve `rows().bankLines`'a `ref` / `carry`.
  - Rows / refs dışında yalnız import ve `MATCH_PARTS` etiketi.
  - Yeni dosya `server/lib/bank/opening-cover.mjs`.
- aa2133c4 — iş 3: `general-ledger.mjs`, `bank/money-lines.mjs`, `bank/accounts.mjs`, `ledger-opening.mjs`, yeni test, değişen beklentiler
- 8da5f5f5 — kabul D testi
- 20b68330, 3593f4ea, 6bba474c, 45294636 — mutasyon taraması
- 01297bd5 — tasarım notu §13.3a (durum)
- 5ba59cbc — Kanıt: `docs/kanit/2026-11-14/c7a2-*`

## Testler
- **Yeni test `test/hesapsiz-acilis-250.test.mjs`:** 5/5 hem UTC hem Europe/Istanbul. Tabanda 0/5, her biri kendi nedeniyle:
  - 102.00 ≠ 519;
  - kova 6.700;
  - Devir Kapanışı maddesi yevmiyede duruyor;
  - 108.00 ≠ 519;
  - 'none' satırı 102.00'da.
- **Kabul D testi `test/hesapsiz-acilis-v249-250.test.mjs`:** v2.4.9'un gerçek koduyla üretilmiş kilitli veri. 3/3 iki saat diliminde. Taban `git worktree --detach` kopyasında 0/3, nedenleri doğru.
  - Kural farkı dört kaynakta elle hesapla birebir: H1 102.00 −5.000 / 519 +5.000; K1 108.00 +1.000 / 519 −1.000; H2 102.00 −700 / 519 +700; Devir Kapanışı 102.00 +5.000 / 108.00 −1.000 / 500 −4.000.
  - Donmuş defter değişmedi.
  - Kural Farkı Düzeltme Fişi 01.04: 102.00 −700 farkı alt defter hesabı olduğu için fişe yazılmıyor, ayrı listede. Fişten sonra opening:519 ve bank:sub temiz.
  - Açık dönemde yeni hesapsız satır B 519.
- **İki yeni test birlikte (kanıt):** 8/8 UTC, 8/8 Istanbul; tabanda 0/8.
- **Mutasyon:** 14/14 yakalandı, değerle (5 D-07 + 9 K-14).
  - 6, 7, 12, 14 ("küçüktür" ↔ "küçük eşit", yön ayrımı kalkar, satır banka tarafına, beklenen 102.00): kapı 500 gate-equivalence ile yakalandı — süzgeçli kapı temiz dedi, tam kapı gl:102 / 108'de reddetti.
  - 8 (en geç ↔ en erken), 10 (pasif hesap sayılmaz), 11 (netleme kalkar), 13 (519 ikinci yükleyicisi): kendi denetimleriyle yakalandı.
  - 9 (kova düşmez): Alt Hesap Mizanı 102.00 = 6.700 ile yakalandı.

## Kabul koşulları
- **A — defter kâhini:** 187/187 önce, 187/187 sonra.
- **B — cari kâhini:** 17.136/17.136 önce ve sonra. Yapım aşaması listesi kendi kopyamda yeniden üretildi; 0 kayıt, önceki listeyle aynı.
- **C — muhasebe sürücüsü:** yalnız 6 senaryo koşuldu (s08, s11, s12, s23, s37, s72 × 2 TZ).

  | | AYNI | U | SINIFLANMADI | adım farkı |
  |---|---|---|---|---|
  | taban | 194 | 60 | 12 | 10 |
  | yeni | 218 | 36 | 0 | 10 |

  - **Ç7a-K14-K15 KALKTI** (tabanda 2 senaryo / 12 denetim).
  - Ç7a-KG6 3/8 bekliyor (KG-6 kodlanmadı). Ç7a-KG19 1/4 bekliyor (S175 = C).
  - Adım farkı sayısı aynı (10), ama s11 ve s37'nin hesap açılışı adımının içeriği değişti: açılan hesap eski satırları o adımda yeniden sınıflıyor. Kâhin ise 519'u satırın kendi adımında bekliyor. Bu, S179 = A'nın sonucu; sürücü eşlemesi ana oturumun işi.
  - 226 koşuluk tam sürücü **KOŞULMADI**.
- **D — eski sürüm verisi:** yukarıda.
- **E — hız: ÖLÇÜLEMEDİ.** Bağlam yüzünden ara rapor verdim; ölçümü ana oturum yapacak. Değişen yollar:
  - her türetmede (refs) ve her kapı yazımında (groups) iki küçük sınır sorgusu;
  - para satırı başına bir CASE (groups, unassignedWays, periodGroups);
  - 519 ikinci yükleyicisinde bir bağsız satır sorgusu;
  - Banka Fişi satırında ters kayıtta bir alt sorgu.
  - İlk sürümde kapı planı testi `fin_events` tür taramasını yakaladı. Sınır sorgusu hesabı atanmamış fiş satırlarının dizinine taşındı; test şimdi yeşil.
- **F — rastgele sıra** (400 işlem × 2 tohum, her 20 işlemde doğrulama): yeni 2/2, taban 2/2. Kapı süresi ortanca 16 ms; en çok yeni 36 ms, taban 29 ms.
- **G — ekran:** bu turda istemci değişmedi; ekran senaryosu koşulmadı.

**Komşular** (taramayla bulunan 209 dosya + kabul D testi): 2.319/2.319 UTC, 2.319/2.319 Europe/Istanbul.

## Değişen mevcut beklentiler (hepsi S179 = A; testlerde "BEKLENTİ BİLEREK DEĞİŞTİ")
- `banka-210-ariza` A1: 102.00 6.000 → 2.000.
- `banka-210-gg2-devir`:
  - geri alınan kurulumlardan sonra kova 9.000 → 0 (en geç açılış 06.10);
  - 108.00 2.000 → 3.000 (kart ödemesi 519'a geçti).
- `banka-210-gg3-eski-satir` B1 (iki yer): kova → 0.
- `banka-210-sihirbaz`:
  - kova ve Alt Hesap Mizanı 6.000 → 2.000;
  - önce 102 = 106.000 → 102.000, 519 = −100.000 → −96.000;
  - tek atamadan sonra 102.00 4.000 → 0;
  - v2.0.26 fikstüründe "birebir eski hâl" için geçici hesap da siliniyor; hesap dururken 102 → 519 kayması ayrıca denetleniyor.
- `banka-210-raporlar`: model U102 satırını açılışta sayıyor (Alt Hesap Mizanı, ANLIK DURUM kovası).
- `raporlar-230-banka`: Nakit Akış özetinde Hesabı Atanmamış satırı yok (önce 5.000).
- `defter-kaynak-iz-250`: üç gerekçeli SINIF 3 istisnası eklendi (`bank_accounts.opening_date`, `bank_accounts.currency`, `fin_events.status`).
- `banka-210-hiz-esdegerlik`: 2.1.0 kâhini bu ayrımı bilmediği için karşılaştırma `COVER_TEST.off` ile ayrımsız kipte yapılıyor (yalnız test; üretimde etkisiz).

## BAŞ MİMAR KARARI GEREKİYOR
1. **Liste ve raporlarla kova bakiyesi tutarsız.** Banka Bakiye Raporu'nun özetindeki "Hesabı Atanmamış" değeri satırlardan toplandığı için Banka Genel Bakış'taki kovadan büyük görünebilir.
   - A: açılışta sayılmış satırlar bağsız okumadan da düşsün (liste, rapor merkezi). Denedim ve geri aldım: yaklaşık 10 rapor beklentisi değişiyor ve rapor merkezi dosya sınırımın dışında.
   - B: listede kalsın, "Açılışta Sayıldı" işaretiyle.
   - Öneri: A, tutarlılık için.
2. **Pasif hesabın da sınırda sayılması** kodlandı. Türetme hesabın durumuna bakarsa, bir hesabı pasife almak geçmiş günlerin defterini değiştirirdi.
3. **`routes/ledger.mjs`'te rows / refs dışı iki dokunuş:** import satırı ve `MATCH_PARTS` etiketi. Görevin kendi "519 dökümünde ayrı tür" maddesi için gerekliydi.

## KULLANICIYA SORULMALI (uç durumlar; öneri yazıldı, kodlanmadı)
- **Yön kuralının uç durumu:** hesapsız POS iadesi (çıkış) kart ailesine, kurumsal karta gelen hesapsız iade (giriş) POS ailesine düşer.
  - A: bugünkü yön kuralı kalsın. B: belge türünden ayrılsın. C: uç durum böyle kalsın (BİLİNEN SINIR).
  - Öneri C.
- **Sonradan açılan hesap kilitli dönemi etkiliyor.** Açık dönemde açılan yeni hesap en geç açılış tarihini ileri alırsa, kilitli dönemdeki hesapsız satırlar 519'a geçer. Bu Kural Değişikliği Farkı'nda görünür; ama 102.00 alt defter hesabı olduğu için Kural Farkı Düzeltme Fişi'ne yazılmaz.
  - A: kalsın (BİLİNEN SINIR). B: sınır kilit tarihinde dondurulsun.
  - Öneri A.
- **Açılıştan önceki POS tahsilatı** yalnız Devir Kapanışı'yla 519'a geçer; Devir Kapanışı yapılmazsa 108.00'da kalır. Kitabın K-14 satırı Bankaya Geçmiş Say'ı da sayıyor, ama S179'un metni yalnız havale ve kurumsal kartı söylüyor.
  - Öneri: bugünkü gibi, görev metnine uygun.

## Ana oturuma notlar
- **Süreç kusurları (dürüstlük için):**
  - Mutantların bir ara koşusunu yük 3,86 iken (3,5'in üstü) başlattım.
  - Kanıt dizisinin son küçük koşusu (yeni testler + taban) yük kilidinin dışında çalıştı.
  - Komşu koşusu sürerken `opening-cover.mjs`'yi bir kez düzenledim (eşdeğer değişiklik). Sonuçlar ayrıca yeniden koşuldu.
- **Kural Farkı fişinin 102.00'ı dışlaması:** fişten sonra Yevmiye / Mizan'daki 102.00 kilitli dönemden farklı kalabilir. Bu C5'in alt defter hesabı düzeni. DOĞRULANMADI.
- **Windows'ta erken izlenecekler (ders 48):** `hesapsiz-acilis-v249-250` geçici klasör açıp siliyor.
- **CI listesi:** yeni ekran senaryosu yok. İki yeni test `*.test.mjs` adlı; CI'ye otomatik giriyor mu doğrulamadım.
- **DENENMEYEN / KOŞULMADI:**
  - ekran yürüyüşü;
  - tam muhasebe sürücüsü;
  - hız ölçümü;
  - iki şirket ve Silinenler'den geri yükleme ayrı ayrı (komşu testlerin kapsadığı kadarı dışında);
  - tam `npm test` (görev gereği yok).
- **Ekran yürüyüşü için adımlar (iş 3):**
  1. Hesap yokken hesapsız havale ve kartla ödeme gir.
  2. Hesap ve kart aç.
  3. Banka Genel Bakış'ta kovanın düştüğünü gör.
  4. Hesabı Atanmamış listesinde satırların durduğunu gör.
  5. Açılış Eşleştirme'de "Hesapsız Hareketler (Açılıştan Önce)" satırına bak.
  6. Mizan'da 519 ve 102.00 / 108.00'ı kontrol et.
  7. Kurulum Sihirbazı'nı çalıştır, Devir Kapanışı maddesinin Yevmiye'de olmadığını gör, sonra Geri Al.
- **Yeniden koşulacak komutlar ve beklenen sayılar** (hepsinin başına `HUKUK_LICENSE_URL=http://127.0.0.1:9`):
  - `node --test test/hesapsiz-acilis-250.test.mjs test/hesapsiz-acilis-v249-250.test.mjs` → 8/8, UTC ve `TZ=Europe/Istanbul`.
  - `node test/c7a-banka-250-mutasyon.mjs --kopya <git archive HEAD kopyası>` → 14/14.
  - `npm run test:kahin-defter` → 187.
  - `npm run test:kahin-cari` → 17.136.
  - `node test/mutabakat/kos.mjs --islem 400 --tohum 7 --tohumlar 2 --her 20` → 2/2.
  - `node test/bagimsiz/muhasebe-surucu/kos.mjs --senaryo s11,s37,s12,s08,s23,s72` → Ç7a-K14-K15 bekleyenlerde yok.
- **İş 1–5 için yeni ajana:** KG-6'nın taslak tasarımı (veri, defter, beklenenler, Alt Hesap Mizanı) tasarım notunun §13.3 ve §13.3a bölümlerinde hazır. İş 4 ve iş 5 dokunulmadı.

Not defteri klasörüm (loglar, betikler, mutant ham çıktıları, sürücü çıktıları): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7a-t2q`. Taban kopyaları, ayrık worktree ve /tmp altındaki ham kâhin çıktılarını tam yollarıyla sildim.
