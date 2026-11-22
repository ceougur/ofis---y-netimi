# İzleyen tur 2 — rapor

## Özet
- 5 işten 4'ü kodlandı: İş 1 (S241), İş 2 (kapsam seçimi), İş 4 (iade Düzenle'si), İş 5 (stok iadesi).
- İş 3 (Düzenle azaltma hızı) KODLANMADI. Kök neden ölçüldü ama dosya sınırının dışında (`lib/integrity-scope.mjs`). Öneri prototipte ölçüldü: 8.004 → 228 ms. Karar baş mimarda.
- Yeni sınama (17 test):
  - Yeni kodda iki saat diliminde yeşil.
  - Eski kodda (288b91dc) 5/17. Kalan 12 test beklenen nedenle kırmızı.
- Mutasyon: 4 mutantın 4'ü yakalandı.
- G2 komşu taraması (183 dosya), son kod değişikliğinden sonra: iki saat diliminde 2145/2145.
- Kâhin ↔ program iki saat diliminde 0 fark. Yapım aşaması listesi 38 → 38, aynı.
- Hız: kötüleşen yol yok (ölçüm 2). Ölçüm 1 kötüleşme gösterdi; düzeltildi.
- Ekran:
  - senaryo-izt2-250: yeni 24/24, eski 17/24.
  - Komşu senaryolar 21/21 yeşil.
- Push yok, zamanlanmış görev yok.

## Taban, dal, commit'ler
- Taban: 288b91dc (reset doğrulandı).
- Dal: worktree-agent-a00386bc926cebc74, uç 2cc450bb.
- Commit'ler (hepsi `Co-Authored-By: Claude <noreply@anthropic.com>`, model adı yok):

| Commit | İçerik |
|---|---|
| f9342aaa | tasarım §20 (koddan önce) |
| 73a83274 | sınama (koddan önce) |
| a395ffcd | İş 1 + 2 + 4 kod |
| 0d54234f | İş 5 sınaması |
| a89ed2a0 | İş 5 kod |
| ea04b495 | ekran senaryosu |
| 8fcf5be4 | kanıt |
| efb7d9e3 | Y1 / Y2 sınaması |
| bc890b61 | komşu beklentileri |
| 417d7239 | kanıt |
| 9084dce6 | kanıt |
| 30248179 | §20.7 |
| c25c53fd | hız düzeltmesi |
| d58105fd | kanıt |
| 2cc450bb | kanıt |

## Değişen yollar (288b91dc..uç; +1068 / −64)

| Dosya | + / − | Ne değişti |
|---|---|---|
| `server/lib/cover-scope.mjs` (YENİ, saf) | +125 | kart kapsamı yardımcısı: s2, ownSaleOf, chooseCover, editCutsOf, withEditCuts |
| `server/lib/invoice-settle.mjs` (kapama defteri) | +60 / − | seçim chooseCover'dan; newestFirst kalktı; withEditCuts |
| `server/lib/obligation-queue.mjs` (kuyruk) | +65 / − | coverEvent seçimi yardımcıdan; buildObligations / doubtfulBefore withEditCuts |
| `server/lib/obligation-input.mjs` | +11 | editCuts sütunu; `accountSettleInput withDue` |
| `server/routes/invoices.mjs` | +86 | editCutsFor / putEditCuts / shrinkCoversByEdit dönüşü / undoReturnCuts; settledFor withDue |
| `server/routes/stock.mjs` (yalnız iade yolu) | +41 | trimReturn / undoReturnCuts |

- Testler:
  - `test/izt2-izleyen-tur-250.test.mjs`: yeni, 17 test.
  - `test/e2e/senaryo-izt2-250.mjs` ve `package.json` `test:senaryo-izt2-250`: yeni.
  - Beklentisi karar numaralı yorumla değişen: `test/iade-224.test.mjs` G2 ve `test/t3hiz-esdegerlik-250.test.mjs` hakem sütunu.
- Belge: `docs/erp/C7B-FATURA-TASARIM.md` §20.1–§20.7.
- Dokunulmayanlar: `lib/account-lines.mjs` (önce değişti, hız için geri alındı), `test/bagimsiz/**`, YAPIM-ASAMASI.json, ci.yml, release.yml.
- Göç yok.

## İşler

**İş 1 — S241 = A** (Düzenle ile kartın kalanından fazla azaltma)
- Kural: Düzenle azalışı iade gibi kayda geçer ve iki görünüm aynı sayıyı gösterir.
- Kayıt: azalış bir kartı kestiyse faturanın `payment_json.editCuts` alanına yazılır: `{at, date, amount, cuts, items}`.
- Okuma: kuyruk ve kapama defteri girdiyi okurken her kaydı o anda faturaya gelen yapay bir iade gibi görür (`withEditCuts`).
  - Fatura satırı brüt tutara döner.
  - Kartın coverTotal / coverGross değerine kesinti eklenir.
  - Bakiye, ekstre ve defter değişmez.
- Artış (S242 = A): kayıtları en yeniden geriye artış kadar düşürür; kart büyümez.
- Cari değişirse ya da fatura taksitli olursa kayıtlar düşer (BİLİNEN SINIR).
- Sayılar (taban → yeni):
  - Kart penceresi 600 / 300 / 300 → 600 / 600 / 0.
  - Cari kartı özeti ve Taksitler listesi de aynı. Kartın kendi hesabı zaten 600 / 600 / 0 idi.
  - Bakiye −300 (aynı).
- Testler:
  - K1a / K1k: eski kodda kırmızı, nedeni "kart penceresi kendi hesapla AYNI" değil.
  - K1o, K2, K2b: bekçi; eski kodda da yeşil.

**İş 2 — kapsam seçimi tek yardımcıda** (D 18:28 (2))
- Kuyruğun S110 / S120 / S123 seçimi `chooseCover`'a AYNEN taşındı.
- Kapama defteri aynı işlevi kendi kalemleriyle çağırıyor; elle borcun Vade Tarihi `withDue` ile okunuyor. İade, İptal Et, Düzenle ve iptal penceresi bu seçimi okuyor.
- Örnek: A 600 + B 600, elle kart 600.

| Olay | Taban | Yeni |
|---|---|---|
| Kapama defteri kartı hangi faturaya bağlıyor | B | A (kuyrukla aynı) |
| B İptal Et | kart kapanıyordu | kart değişmez |
| A İptal Et | kart değişmiyordu | kart kapanır (S211) |
| A'ya iade | kart değişmiyordu | kart 300 |
| B'ye iade | kart 300 oluyordu | kart değişmez |

- A1–A6 (S110-elle ve S120 dahil): eski kodda 6/6 kırmızı.
- Satışla açılan kartta sonuç değişmez.

**İş 3 — Düzenle azaltma hızı: KODLANMADI**
- CPU profili: 8,0 sn'nin ~7,1 sn'si kapının TAM denetimi (`integrity.mjs check → run`).
- Kapı gerekçesi: `stock_moves: kimlik değişti`.
  - Düzenle faturanın stok hareketlerini silip yeniden yazıyor.
  - En son yazılmış satırların rowid'i yeniden kullanılıyor.
  - Süzgeç, aynı rowid'de farklı kimliği "bilinmeyen" sayıp tam kapıya düşüyor.
  - Etkilenen yollar: yeni kaydedilmiş faturanın Düzenle'si ve aynı faturanın ikinci Düzenle'si.
- Öneri: `lib/integrity-scope.mjs` (dosya sınırı DIŞI). Aynı rowid + farklı kimlik = silinen ve eklenen iki ayrı satır.
- Prototip (kod değil; `izt2-kos/oneri-integrity-scope.py`):
  - Süre 8.004 → 228 ms, kapı scoped yolda.
  - Kapı sınamaları 94/94 (gateVerify eşdeğerliği dahil).

**İş 4 — iade Düzenle'si**
- İade iptali ve iade Düzenle'si tek yardımcıda (`undoReturnCuts`).
- Eski etkiler geri alındıktan sonra kapsayan kart ve KENDİ kart kayıtlı taksitlere geri büyür; yeni iade sonra yeniden keser.
- Kaydı olmayan eski iade bugünkü gibi davranır.
- Sayılar: kendi kart 10.10 600 → 10.10 300 + 10.12 300; 20.11 gecikmiş 300 → 0.
- R1 eski kodda kırmızı. R2 bekçi.

**İş 5 — faturasız stok iadesi**
- Yoklandı (taban):
  - İade kartı küçültüyor (10.12 kesiliyor).
  - Silinince kart GERİ BÜYÜMÜYOR: bakiye 600, kart 600, gecikmiş 600.
  - Düzeltme 1 → 2 kartı küçültmüyor: kart 600, borç 0.
- Düzeltildi:
  - Kesim kaydı hareketin izine yazılıyor (`stock.return.cuts`).
  - Silme ve düzeltme aynı taksitlere geri büyütüyor (`growForInvoice items`); düzeltme sonra yeniden kesiyor.
  - Silinenler'den geri yükleme yeniden küçültüyor.
  - Kaydı olmayan eski hareket bugünkü gibi.
- Yeni sonuç: silmede taksitler kimlikleriyle geri geliyor, gecikmiş 300.
- S1 ve S3 eski kodda kırmızı. S2 bekçi.

**Yedek ve kilit (D 18:28 (6))**
- Y1: editCuts ve coverCutItems yedekle taşınıyor. Geri yüklemeden sonra kart 600 / 600 / 0; iade iptali aynı taksitlere dönüyor.
- Y2: kilitli dönemdeki faturanın Düzenle'si 409 (bugünkü gibi); Mutabakat Testi temiz.
- Y1 eski kodda kırmızı (kayıt yok).

## Testler ve sayılar
- **Yeni sınama:**
  - Yeni kod: UTC 16/16 ve İstanbul 16/16 (ilk koşu). Y1 eklendikten sonra 17/17.
  - Son kod değişikliğinden sonra G2 içinde iki saat diliminde yeşil.
  - Eski kod: 5/17 (UTC ve İstanbul). Kırmızı nedenleri: "kart penceresi kendi hesapla AYNI", "kapama defteri: kart A'yı kapsar", "A'ya iade → kart 300", "taksitler iade öncesiyle AYNI", "borç 0 — kart kalanı 0", "iade 300 hiç 600 olmamış gibi", "S241 kaydı yedekte".
- **Mutasyon** (UTC), 4/4 yakalandı:
  - m1 withEditCuts kapalı → K1a, K1k, Y1 kırmızı.
  - m2 newestFirst geri → A1–A6 kırmızı.
  - m3 Düzenle'de undo yok → R1 kırmızı.
  - m4 stok silmede undo yok → S1 kırmızı.
- **G2 komşu taraması (183 dosya)** — liste `izt2-kos/g2-liste.txt`; değişen işlev adlarıyla `test/` taraması, önceki turun listesi ve coversBalance kullanan testler birleştirildi:
  - Koşu 1, UTC: 2142/2145.
    - iade-224 G2: newestFirst beklentisi → D 18:28 (2) ile düzeltildi.
    - t3hiz H1–H3: hakemde yeni sütun yoktu → eklendi.
  - Koşu 1, İstanbul: 2145/2145.
  - Koşu 2 (son kod değişikliği c25c53fd'den SONRA): iki saat diliminde 2145/2145. Altın test ve K1 farkı dahil.
- **Kâhin cari:** iki saat diliminde, iki koşuda da 101 senaryo / 22.832 denetim, 0 fark.
- **Kâhin defter:** 187/187, 0 fark, yakalanmayan mutasyon 0.
- **Yapım aşaması** (kendi kopyada): 38 → 38, birebir aynı.

## Hız
Koşullar: özel kilit, 3 tur dönüşümlü, temiz 100 bin verinin taze kopyası. Yük başta 1,04–1,36 (geçersiz tur yok). Tablo `izt2-hiz/tablo-2.md`.

| Yol | Taban en iyi / ortanca (ms) | Yeni en iyi / ortanca (ms) | Fark (ortanca) |
|---|---|---|---|
| kart penceresi GET | 40,8 / 43,3 | 40,6 / 43,7 | +0,9% |
| fatura kartı GET | 35,6 / 37,2 | 36,0 / 37,4 | +0,5% |
| cari kartı GET | 132,3 / 139,8 | 130,9 / 137,9 | −1,4% |
| Düzenle (aynı içerik) | 112,0 / 115,2 | 113,0 / 117,1 | +1,6% |
| Düzenle (azaltma) | 6260 / 6565 | 6071 / 6268 | −4,5% |
| Düzenle (büyük azaltma) | 6176 / 6285 | 5898 / 6609 | +5,1% |
| Kartı Kapat | 1028 / 1059 | 1026 / 1144 | +8,0% |
| iade yazımı (kapalı kart) | 140,0 / 153,6 | 142,8 / 153,0 | −0,4% |
| iade yazımı (açık kart) | 136,8 / 144,4 | 133,4 / 148,8 | +3,0% |
| iade İptal Et (kapalı kart) | 55,4 / 57,3 | 54,3 / 57,3 | 0 |
| iade İptal Et (açık kart) | 55,1 / 55,6 | 53,5 / 56,5 | +1,6% |
| fatura İptal Et (kartlı cari) | 109,8 / 117,1 | 106,5 / 123,9 | +5,8% |
| zil | 277 / 368 | 282 / 366 | −0,5% |
| Taksitler listesi | 1015 / 1124 | 968 / 1063 | −5,4% |
| Faturalar listesi | 557 / 606 | 549 / 616 | +1,7% |

- KÖTÜ (ortanca VE en iyi > +%10) yol yok.
- İŞARET: bazı satırlarda olay döngüsü en çok 0,0 okundu (izleyici yakalamadı — ölçüm nüansı).
- Ölçüm 1 (`tablo-1-kotulesme.md`) kötüleşme gösterdi: kart penceresi +%44, iade yazımı +%45 / +%59, fatura İptal Et +%30, Düzenle (aynı içerik) +%16.
  - Kök neden (profil `tani-*.txt`): bütün satış faturalarını tarayan editCuts sorgusu (17 ms, istek başına birkaç kez).
  - Düzeltme (c25c53fd): kesinti girdinin kendi faturalarından ekleniyor.

## Ekran (`docs/kanit/2026-11-21/izt2-ekran/`, görüntülere baktım)
- **01-s241-kart-penceresi:** Toplam ₺600, Tahsil Edilen ₺600 (%100), Kalan ₺0; iki taksit "Ödendi"; durum "Tamamlandı".
- **02-kapsam-liste:** A "Taksitte" (Açık —), B "Vadesi Geçti" ₺600; Düzenle'li fatura ₺300 "Ödendi".
- **03-kapsam-b-iptal-sonrasi-kart:** B'nin iptalinden sonra elle kart "Devam Ediyor", Kalan ₺600, iki taksit "Bekliyor".
- **04-iade-duzenle-sonrasi-kart:** iki satır 10.10 (Ödendi) ve 10.12 ₺300 (Bekliyor), Kalan ₺300. Sıra no "3." kaldı (2.5.1).
- Senaryo yeni 24/24, eski 17/24. 7 kırmızının hepsi beklenen yerlerde.
- Komşu ekran senaryoları 21/21, son koddan sonra 8 senaryo yeniden: izt, dkfix, c7b-tur3, c7b-kabul, kart-iade-gecmis, banka-210b, eski-satir, pos-220, entegrator-240, fatura-243, kdv-donemi, gg244 ×2, uiux-b-243, 216, 217, kart-onbellek-yaris, 213, 215, 224, iade-246.

## KULLANICIYA SORULMALI
**SK-43 — iadeyle küçülen taksit sonradan elle değiştirilir ya da silinir, sonra iade iptal edilir.** Para kuralı; uç durum.
- Kurulum: kart 900 (05.10 / 05.11 / 05.12), tahsilat 300, 01.11 iade 150 (05.11 300 → 150).
- Bugünkü davranış (taban = yeni; `p1-*.txt` ELLE-*):
  - **Tutar:** 05.11 elle 150 → 100, sonra iptal. 05.11 = 250; kart toplamı 900 ama taksitler 850 (50 taksitlendirilmemiş). 20.11 gecikmiş 300.
  - **Vade:** 05.11 → 25.11, sonra iptal. 25.11 = 300; 20.11 gecikmiş 0.
  - **Silme:** 05.11 silinir, sonra iptal. 05.11 eski kimliği ve vadesiyle 150 olarak yeniden açılır; toplam 900, taksitler 750. 20.11 gecikmiş 300.
- Seçenekler:
  - A: bugünkü gibi, kayıtlı taksite geri.
  - B: kullanıcı kesilen taksiti elle değiştirmişse geri gelen tutar son taksite.
  - C (ÖNERİ): Uç durum böyle kalsın (BİLİNEN SINIR).
- Yaygın programlarda: doğrulanmış kaynak okunmadı.

## BAŞ MİMAR KARARI GEREKEN
1. **İş 3 — Düzenle azaltmasının 6–7 sn sürmesi** (olay döngüsü kilitli). Düzeltme `lib/integrity-scope.mjs`'te, dosya sınırı dışında. Prototip ve ölçüm yukarıda.
   - Önerim: ayrı küçük tur. Kapsamı integrity-scope'ta rowid yeniden kullanımını silinen + eklenen iki satır saymak.
   - Sınaması: kapı eşdeğerliği (gateVerify) ve kapı sınamaları.
2. **Yeni lib dosyası:** `lib/cover-scope.mjs` (görevin "kart kapsamı yardımcıları" izniyle).
3. **Stok iadesinin kesim kaydı denetim izinde** (`audit_events` 'stock.return.cuts'; göç gerekmedi).
   - Emsal: satış kaynağı izi (saleSources).
   - İz yazılamayan "yalnız görüntülenen şirket" durumunda kayıt da yazılmaz. O kipte yazım zaten kapalı.
4. **Düzenle kaydının (S241) düştüğü durumlar:** cari değişimi ve faturanın taksitliye dönmesi. Kesinti yine yapılır, ama kart görünümü SK-42 (a) türü ayrışmaya dönebilir. Uç durum, BİLİNEN SINIR önerisi.

## SONRAKİ SÜRÜME (2.5.1)
- Silinen taksitten sonra kalan taksitin sıra no'su (ekranda "3.") — görünüm ayrıntısı, sayılar doğru.
- Stok hareketi düzeltme / silmesinde kart değişince `plans` canlı yenileme bildirimi gönderilmiyor. Diğer ekranlar yeniden açılınca doğru.
- Ölçüm nüansı: olay döngüsü 0,0 okunan satırlar.
- Açılış onarımının toplu kapama girdisi (`batchSettleInput`) elle borç Vade Tarihi'ni okumuyor. Yalnız kendi kartlı faturaların onarımı; kapsam seçimine etkisi yok sayılır, doğrulanmadı.

## DENENMEYEN
- Tam `npm test`, Windows, mutabakat ve güvenilirlik uzun koşuları.
- Mutasyonlar son hız düzeltmesinden (c25c53fd) önceki kodda koşuldu. m1 aynı işlevi kapattığı için geçerli sayıldı, yeniden koşulmadı.
- İki şirket; v2.4.9 gerçek verisi (G2'deki altın test ve göç testleri dışında).
- Ekran senaryoları yalnız İstanbul saat diliminde koşuldu.
- S241 + sonradan gerçek iade + iade iptali sırası yalnız mantıkla ele alındı (sınaması yok).
- Kayıtlı faturada iki azaltma + artış sırası yalnız tasarımda (K2b tek artış).
- İş 3 prototipi tam `npm test`'ten geçmedi.

## BİLİNEN SINIRLAR
- İş 3 kodlanmadıkça yeni kaydedilmiş ya da ikinci kez düzenlenen faturanın azaltması 6–7 sn sürüyor.
- Kâhinin 38 Düzenle kaydı açık (PUT ile POST farkı). Kâhin bakımı 25'e kaldı.
- Düzenle kaydı cari değişiminde ve taksitliye dönüşte düşer (yukarıda).
- Kaydı olmayan eski stok iadesinin silinmesinde kart bugünkü gibi geri büyümez.

## Ana oturumun yeniden koşacağı komutlar
Kilit kalıbı: `flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock …`

- **Yeni test:** `bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt2-a00/kos-test.sh <ağaç> <çıktı öneki> test/izt2-izleyen-tur-250.test.mjs`
  - Eski kopya için `git worktree add --detach … 288b91dc` ve yeni test dosyasını kopyala. Benim eski ağacım kaldırıldı.
- **G2:** `bash …/izt2-a00/g2-kos.sh <ek>` (liste `g2-tum.txt`).
- **Kâhin:** `bash …/izt2-a00/kahin.sh <ek>`
- **Ekran:** `bash …/izt2-a00/e2e-kos.sh <kod> <ek> senaryo-izt2-250 …`
- **Mutasyon:** `bash …/izt2-a00/mutant.sh` (proto ağacı gerekir).
- **Hız:** `flock -x -w 3600 …/olcum.lock timeout -k 5 6600 bash …/izt2-a00/hiz/kos.sh`, sonra `python3 -I …/izt2-a00/hiz/tablo.py …/izt2-a00/hiz/sonuc-2.txt`
  - kos.sh `$D/eski` bekler; ağacı yeniden kurmak gerekir.
- **İş 3 teşhisi:** `…/izt2-a00/hiz/prof2.mjs <kod> <kopya> <çıktı>` (kapı gerekçesini yazar).

## Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt2-a00`
- probe2/ (h.mjs, p1.mjs, çıktılar)
- hiz/ (prof*, hiz2/3, kos.sh, tablo.py)
- kos/ (bütün koşu çıktıları)
- Betikler: ed*.py, mutant.*, *.sh

Ortam: yük 1,6 / 4 çekirdek, bellek boş 2 GB (kullanılabilir 8 GB), disk boş 8,6 GB. Arka planda işim yok.
