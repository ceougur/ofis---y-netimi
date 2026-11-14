# Ç5-A TUR 3c: rapor (ajan raporudur, kanıt sayılmaz; ana oturum yeniden koşar)

Dal `worktree-agent-a21e56c46518ba374`, taban `c5a3c-taban` (06dde4aa), uç **4ecbee10**. Push yapılmadı. Ağaç temiz; izlenmeyen tek şey `node_modules` bağı.

Commit'ler sırasıyla:
- cb975d89: tasarım §19, koddan önce yazıldı.
- 8d10b8c4: İş 1, defter kuralı.
- c0c8d1fc: İş 2, sınır, kalıcı test ve mutasyon dosyası.
- 60413f8c: v2.4.9 fikstürü ve testi.
- becc610c: `doubtfulKeepOf` ayrımı ve kaynak taramasına istisnalar.
- 2990dfb0: form yardım metni ve yeni ekran senaryosu.
- cd140d55: test güçlendi, mutasyon 15 / 15.
- 2346e056: işaretli tahsilatta ileti bugünkü gibi bırakıldı.
- 704f0563: §19.7 sonuçlar.
- 4ecbee10: Kanıt commit'i.

## 1. Gözlenebilir davranış değişiklikleri
Hepsi şüpheli kaydı açık müşteri carisinde geçerli.

1. **Kapatılacak Fatura bağlı tahsilat** (nakit, havale, POS, Kredi Kartına İade):
   - Önce: her zaman A 120.
   - Sonra: faturanın, tahsilattan önceki anda kuyrukta şüpheli sayılan payı kadar A 128 (o payı tutan kayıttan), kalanı A 120.
   - S168 örneği (F1 1.000 → şüpheliye alma 1.000 → F2 500 → Normal Cari Hesaba İşle 400):

   | Tahsilat | Önce | Sonra |
   |---|---|---|
   | F2'ye bağlı nakit 300 | 409 | 200, A 128 300 (128 = 700, 120 = 100) |
   | F1'e bağlı nakit 300 | 409 | 200, A 128 300 |
   | F2'ye bağlı nakit 100 | A 120 100 | A 128 100 (128 = 900) |
   | F2'ye bağlı 500 | 409 | A 128 400 + A 120 100 (128 = 600, 120 = 0) |
   | F2'ye bağlı 700 | 409 | yine 409, ileti değişti (madde 3) |
   | bağsız nakit 300 | A 128 300 | değişmedi |

2. **Faturaya bağlı çek / senet**:
   - Önce: her zaman en eski açık kayıttan A 128.
   - Sonra: madde 1'deki kural.
   - Kuyrukta payı olmayan (kayıttan sonra kesilmiş) faturaya bağlı çek 400: A 128 400 → A 120 400.
   - F2'ye bağlı çek 500: A 128 500 → A 128 400 + A 120 100.
   - İki kayıtlı caride pay, faturayı tutan ikinci kayıttan düşüyor; önce en eski kayıttan düşüyordu.
3. **"Normal Cari Hesaba İşle" sınırı**:
   - İşaretli tahsilatta değişiklik yok.
   - Bağlı tahsilatta sınır yalnız 120'ye düşen kısma uygulanıyor; pay, yazımın aynı işleminde ölçülüyor.
   - Ret iletisi (F2'ye bağlı 700): "Normal cari hesaba işlenecek kısım (300,00 TL; 700,00 TL tahsilatın 400,00 TL'si faturanın şüpheli alacaktaki payından düşüyor) carinin şüpheli dışı borç bakiyesini (100,00 TL) aşıyor; … Tutarı 500,00 TL'ye indirin ya da Kapatılacak Fatura bağını kaldırın." İşlem geri alınıyor, satır yazılmıyor.
4. **Bağlı evrakın 120'ye düşen kısmı şüpheli dışı borcu aşınca artık kapı reddediyor** (S155 iletisiyle; 409 ledger-integrity). Örnek: F1 1.000 → şüpheliye alma 1.000 → F2 500 → F2'ye bağlı çek 900.
   - Önce: kabul, A 128 900.
   - Sonra: ret ("borç 600,00 TL, açık şüpheli 1.000,00 TL").
   - Kullanıcıya soruluyor (§9, Soru 1).
5. **Kuyruğun şüpheli dağılımı ve gecikmiş tutar** bağlı alacaklı şüpheli carilerinde değişiyor, çünkü kayıtların kalanı değişiyor. Örnek: F2'ye bağlı 100'den sonra kuyruk 1.000 → 900 (F1 600 + F2 300). Kuyruğun kodu ve kapama sırası değişmedi.
6. **v2.4.9'dan gelen kilitli veri**: kilitli dönemin 120 / 128'i donmuş kalıyor. Fark "Kural Değişikliği Farkı" uyarısında görünüyor. Düzeltme fişi ön izlemesinde kaynağıyla "fişle düzeltilmez" diye listeleniyor; fiş satırı yok, "Düzeltildi" gelmiyor.
7. **Kredi Kartına İade + fatura bağı + caride kartla ödeme yok**: hata önceliği değişti. Önce sınır 409'u, şimdi kart iadesi 400 iletisi çıkıyor (sürücü s78).
8. **Tahsilat formunun Kapatılacak Fatura yardım metni** yeni kuralı anlatıyor (`client/assets/hof-accounts.js`, yalnız metin).
9. **Taksitli faturaya eskiden kalmış `invoice_id` bağı**: kuyruk bu bağı yok saydığı için bağsız kurala düşüyor; önce A 120 idi. Yalnız eski veride oluşur.

## 2. Kuyruğun yeni iki dış alanı ve eşdeğerlik
- `lib/obligation-queue.mjs` yeni dışa açık işlev `doubtfulBefore(input, { lineId, include })` veriyor:
  - (a) Satırdan önceki anki dağılım; sıralama kuyruğun kendi anahtarıyla (tarih → gün sınıfı → kayıt anı → yazım sırası).
  - (b) Kalem başına `records: [{ recordId, minor }]`.
- Eski hesaplama döngüsü ortak `holdDoubtful` yardımcısına alındı. `buildObligations`'ın dönüşüne alan eklenmedi; kalıcı test dönüşün anahtarlarını denetliyor.
- Eşdeğerlik (tur 3b'nin döküm betiği):

  | Veri | Sonuç |
  |---|---|
  | temiz 100 bin satır | bayt bayt aynı (1.892 satır, sha256 50e217fd…) |
  | v2.4.9 fikstürü tyk-fark-v249 | aynı (e08707ec…) |
  | temiz + programın API'siyle eklenmiş şüpheli + bağlı alacaklı cari | yalnız o cari farklı |
  | supheli-kuyruk-v249 | yalnız 120 / 128'i değişen 5 cari farklı |

- Farklı alanlar yalnız `doubtful.*`, `items[].doubtful`, `invoiceNet.doubtful` ve gecikmiş. Kalem kalanları, kapama ve kart alanları aynı.
- `obligationExtras(accountId, doubtful)` artık şüpheli kalanlarını dışarıdan alabiliyor; döngü bu parametreyle kırıldı.
- `account-lines.mjs`'e cari kümesine göre kart haritası `ledgerPlansOf(ids)` eklendi. Bütün harita 100 bin satırda yaklaşık 250 ms sürüyor. Taşınan gövdeler değişmedi. Eşdeğerlik kalıcı testte (silinmiş kart ve kart tahsilatı dahil).

## 3. Sınırı çağıran yollar (tarama)
- `routes/accounts.mjs` POST entries: yazım içinde, `normalAfter(entry.id)`.
- `routes/accounts.mjs` PUT entries: cari değişimi dahil.
- Başka çağıran yok:
  - Silinenler'den geri yükleme bugün de sınırı çağırmıyor; kapıdaki `doubtful:balance` denetimi tutuyor.
  - POS iadesi bir çıkış.
  - Taksit kartı aktarımını geri alma kartın kendi satırlarını taşıyor.
  - Fatura peşini değişmiyor.

## 4. Kabul koşulları
- **A, defter kâhini:** taban 187 / 187, yeni 187 / 187; iki saat diliminde de.
- **B, cari kâhini:** taban 16.459 / 16.459, yeni 16.456 / 16.459.
  - Yeni 3 fark tek senaryoda (d44 X9): şüpheliye aktarılmış faturaya bağlı nakit.
  - S25 (c) = A gereği program şimdi 128'den düşüp kabul ediyor; kâhin eski okumayla ret bekliyor. Bu bir kâhin bakımı.
  - Liste kendi kopyamda 31 → 34 (yeni 3, kapanan 0, değişen 0; paket "AYRIŞTIRILMADI"). Tabanda 'Ç5-A' paketli kayıt zaten yoktu. Başka paketlerin kayıtlarında değişiklik yok.
- **C, muhasebe sürücüsü:** başarısız 862 → 810.
  - Gerileme denetiminde 226 koşunun 12'si farklı.
  - s68 / s74 / s75 (S14 / S25): sınıflanmamış fark her saat diliminde 17 → 0, "aynı" sayısı +48.
  - s78: yalnız ret iletisinin önceliği (madde 7).
  - s108 / s109: ileti farkıydı, düzeltildi; sürücüyle yeniden koşuldu, tabanla aynı.
  - s68'de kalan 2 adım farkı S168'in alt durumu: kuyruk, SD şüpheliden çıkarılınca F7'yi SG'ye veriyor; kâhin "kalemin kendi kaydı / Şüpheliden Çıkar ile dönmüş fatura" okumasında. Karar S168 = B; kâhin bakımı bekliyor.
  - `siniflama.json` değiştirilmedi.
- **D, v2.4.9 verisi:** v2.4.9'un gerçek koduyla, programın API'siyle üretildi (fikstür `test/fixtures/supheli-kuyruk-v249`, üreticisi `uret.mjs.txt`; 7 sınıf, kilitli + kilitsiz).
  - Kural Değişikliği Farkı uyarısında 3 kaynak var: bağlı nakit 120 +400, bağlı çek 120 −400, S168 nakiti 120 +100.
  - Düzeltme fişi ön izlemesinde satır 0 (`rule-diff-nothing`); kaynaklar "dışarıda" listeleniyor.
  - Kilitsiz dönem yeni kuralla türetiliyor; açık dönemdeki bağlı 100 A 128 100'e düşüyor; Mutabakat Testi bulgusuz.
- **E, hız:** ÖLÇÜLEMEDİ. İki tek seferlik `flock -x -n` denemesinde de kilit doluydu; yük 3,3'tü (başka oturumun tam test koşusu).
- **F, değişmezler:** her testte Mutabakat Testi bulgusuz (iki yükleyici eşit: yevmiye 128 = Σ kalan, 120 = cari). Mizan 128 = 700, 120 = 100 ekran senaryosunda okundu.
- **G, ekran:** yeni senaryo `test/e2e/senaryo-supheli-kuyruk-250.mjs` iki saat diliminde 12 / 12.
  - Gerçek tıklama, Tab ve 120 ms'lik tuş gecikmesiyle: 700 → form kapanmıyor, ileti iki tutarı söylüyor, satır yazılmıyor.
  - Tutar 300'e düzeltilince kabul; veri tabanından okundu.
  - Ekran görüntüleri `docs/kanit/2026-11-14/c5a3c-ekran-*.png`.

## 5. Yeni testler, taban kırmızısı, mutantlar
- Kalıcı test `test/supheli-kuyruk-defter-250.test.mjs`: 24 vaka.
  - S168'in beş adımı, 500 / 700 tutarları, işaretli sınır.
  - 7 sınıf, iki kayıt, aynı gün sıra, düzeltme / silme.
  - `doubtfulBefore`, `ledgerPlansOf` eşdeğerliği, kilit, modüller arası döngülü yükleme, v2.4.9 fikstürü.
- İki saat diliminde 24 / 24. Tabanda 17 / 24 kırmızı; nedenleri: 409, eski 120 / 128 değerleri, `doubtfulBefore` / `ledgerPlansOf` / `linkedShares` yok, v2.4.9 değerleri.
- Mutasyon (`test/supheli-kuyruk-defter-250-mutasyon.mjs`): 15 / 15 değerle yakalandı.
  - İlk koşuda 12 / 15'ti. Testi güçlendirdim; ilk M5 eşdeğer mutant çıktı ve değiştirildi.

## 6. Komşu testler
- Tarama: değişen dosyaları adıyla, `/api/workspace/accounts` yolunu ya da "doubtful"ı anan 345 test dosyası. İki saat diliminde 3.869 / 3.869.
- Ekran senaryoları iki saat diliminde: senaryo-supheli-230 67 / 67, senaryo-banka-210 428 / 428.
- Kaynak taraması (`defter-kaynak-iz-250`) türetmenin yeni okuduğu üç sütunu buldu: `cheque_events.invoice_id`, `cheque_events.account_id`, `cheques.endorse_account_id`. Bunları `account_entries.invoice_id` ile aynı aileden, gerekçeli istisna olarak ekledim (S160 = A, S164 = C). Değerlendirme baş mimarda (§10).

## 7. Program ↔ kâhin farkları
- Cari kâhini X9: S25 (c) — kâhin bakımı gerekiyor.
- Sürücü s68 P4 / P5: S168'in alt durumu — "karar S168 = B, kâhin bakımı bekliyor". Sayılar: kâhin P4'te A 120 3.000 bekliyor; program SG'den A 128 2.000 + A 120 1.000. P5'te tersi.

## 8. Ana oturumun bilmesi gerekenler (kod değişmedi)
- `doubtfulSkipOf` bugünkü tanımında kaldı. Cari kartının "Normal Cariye İşlendi" etiketi bunu okuyor; `routes/accounts.mjs` detail bu turun dosya sınırı dışında.
- Defterin ayırıcısı yeni `doubtfulKeepOf`'u okuyor (işaret + fatura peşini).
- `docs/erp/C5-ACILIS-TASARIM.md` §19 + §19.7.

## 9. KULLANICIYA SORULMALI
**Soru 1 — S25 (b) ↔ S155 = A:** Faturaya bağlı evrakın 120'ye düşen kısmı (faturanın şüpheli payı yoksa ya da açığını aşıyorsa) şüpheli dışı borcu aşınca ne olsun? Örnek: F1 1.000 → şüpheliye alma 1.000 → F2 500 → F2'ye bağlı çek 900 (`c5a3c-pesin-avans-cek.txt`).
- A: Faturanın açığını aşan fazla, bağsız alacak gibi önce en eski açık şüpheli kayıttan (128), kalanı 120. Örnekte kabul: 128'den 400 + 120'den 500 → 128 = 600, 120 = 0.
- **B (öneri):** Bugünkü kod. Fazla 120'ye; 120 eksiye düşerse kapı reddeder. Örnekte ret. S155 = A'nın açık sözüyle tutarlı; kullanıcı evrakı bağsız girerse ya da tutarı bölerse kabul edilir.
- C: Uç durum böyle kalsın (BİLİNEN SINIR).
- Yaygın programlarda nasıl: doğrulanmış kaynak yok.

**§18.6 (1), fatura peşini:** ayırt edici örnek kurulamadı. Avanslı (120 < 0) cari, kayıt açıkken S155 kapısı yüzünden programın yolundan oluşamıyor. 120 ≥ 0 iken peşin anında yeni faturanın kuyruktaki payı 0, yani iki okuma aynı sonucu veriyor. DOĞRULANMADI.

## 10. BAŞ MİMAR KARARI GEREKİYOR / dosya sınırı
1. **"Normal Cariye İşlendi" etiketi:** etiket bugünkü tanımında (bağlı her satırda görünüyor); şimdi kısmen 128'den düşen bağlı satırda yanlış.
   - Öneri: etiket ayırıcının payından okunsun (pay 0 ise göster). `routes/accounts.mjs` detail'de, dosya sınırı dışında.
2. **Fatura iptali bildirimi** (`routes/invoices.mjs` `doubtfulRelinkText`: "şu an normal cari hesaba işli"): pay varken kısmen yanlış. Dosya YAZILMAZ listesinde.
3. **Kılavuz:** `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html:266` hâlâ "Kapatılacak Fatura bağlı tahsilat kendiliğinden normal cari hesaba işlenir" diyor. Kılavuz ve PDF (ders 42) güncellenmeli.
4. **Kaynak taraması istisnası** mı, kilit izine ekleme mi? Ben S164 = C'ye dayanarak istisnayı seçtim; baş mimar değerlendirsin.
5. Dosya sınırı yorumu: `client/assets/hof-accounts.js` cari kartı istemci dosyası (YAZILMAZ listesindeki ailede), ama görev metni "ilgili istemci dosyasında yalnız ileti / seçenek metni"ne izin veriyor. Yalnız yardım metnini değiştirdim.

## 11. Kapsam dışı bulgular
- Başka bir oturumun yükü (c5a2e muhasebe mutasyonu ve tam test) koşularım sırasında 1 dakikalık yükü 6'ya çıkardı; yeni koşu başlatmadım.
- Sürücü kanıt dosyaları `KANIT_DIR` verilmediğinde `docs/kanit`'e düşüyor; kanıt commit'ine dahil ettim.

## 12. DOĞRULANMADI / DENENMEYEN / KOŞULMADI
- Hız: ÖLÇÜLEMEDİ.
- B7 dondurma zorlama betiğinin `bitir` / `gozlem` kipleri koşulmadı; v2.4.9 vakası ürünün kendi `runPending`'ini bekliyor.
- Denenmedi: yedekten geri yükleme; Silinenler'den bağlı tahsilatın geri gelmesi (yalnız komşu testlerde); yetkisiz kullanıcı; kilidi aç → yeniden kilitle; iki kişinin aynı anda yazması (yalnız ardışık).
- Aynı gün sırasının toplamı değiştirmediği iki çiftle gösterildi; genel ispat yok.
- Tam `npm test` koşulmadı (ana oturumun işi).

## 13. CI listesine eklenecek
`test/e2e/senaryo-supheli-kuyruk-250.mjs`. ci.yml ve package.json değişmedi.

## 14. Ana oturumun yeniden koşacağı komutlar ve beklenen sayılar
- `node --test test/supheli-kuyruk-defter-250.test.mjs` → iki saat diliminde 24 / 24; taban kopyada 17 kırmızı.
- `node test/supheli-kuyruk-defter-250-mutasyon.mjs --kopya <git archive kopyası>` → 15 / 15.
- `npm run test:kahin-defter` → 187 / 187.
- `npm run test:kahin-cari` → 16.456 / 16.459, 3 fark d44 X9'da.
- Sürücü gerileme → 12 farklı koşu (s68, s74, s75, s78, s108, s109; s108 / s109 düzeltmeden sonra tabanla aynı).
- `node test/e2e/senaryo-supheli-kuyruk-250.mjs` → 12 / 12.
- Hız: `bash <not defteri>/c5a3c-k7/hiz.sh kilitsiz 3` ve `kilitli 3`. Önce hazır veriyi yeniden kur: temiz 100 bin satırı `/dev/shm/c5a3c-k7/hazir`'e kopyalayıp `node olc-hazir.mjs <not defteri>/c5a3c-k7/taban /dev/shm/c5a3c-k7/hazir` (betik, kopyanın `/dev/shm/c5a3c-k7/hazir`'de olmasını bekliyor).

## 15. Not defteri klasörleri
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7`: `taban/` ve `yeni/` kopyaları (88 MB'lık iki kopya; hiz.sh bunları kullanıyor), betikler, ham çıktılar.
- Kanıtın depodaki kopyası: `docs/kanit/2026-11-14/c5a3c-*` ve `c5a3c-betik/`.
- v2.4.9 çalışma ağacı ve `/dev/shm` kopyaları silindi. Disk boş alanı 6,8 GB.
