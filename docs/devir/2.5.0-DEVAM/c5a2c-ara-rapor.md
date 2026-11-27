# Ç5-A tur 2c — kod ajanının ARA raporu (13.11.2026; AYNEN; ajan raporu kanıt değil — ana oturum yeniden koşar; dar kontrole VERİLMEZ)

# Ç5-A TUR 2c — ARA RAPOR

Bu turda İş 3, İş 1 ve İş 8 bitti. Commit'leri, testleri ve kanıtları var. Kalan üç işe (DÜŞÜK-2, İş 5 ek testleri, İş 2'nin eksik örneği) bağlam yetmeyeceği için başlamadım (ders 46). Yarım iş yok.

İş 1'in bir kabul ölçütü karşılanmadı. Açılış Eşleştirme ön izlemesi 100 bin satırda 1,6–3,3 sn sürüyor; ölçüt ≤ 0,5 sn. Ayrıntısı HIZ başlığında, karar sorusu aşağıda (1. madde).

- **Dal ve durum:** `worktree-agent-abcc7bb2b583ce32f`, taban `c5a2c-taban` (3548840e), PUSH YOK. Ağaçta yalnız `?? node_modules` var.
- **Ortam (22:01 UTC):** yük 0,62 / 4 çekirdek, bellek boş 10 GB, disk boş 7,6 GB.

## BU TURUN DEĞİŞTİRDİĞİ GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

**1. Yönetim › Sistem › Dönem Kilidi kartına iki yeni düğme**

*Açılış Olabilir Kayıtlar* (İş 3; S47 = A, S51 = A, B16):
- Önce ekran yoktu; şimdi pencere var.
- Kolonlar: Tarih, Cari, Tür, Tutar, Açıklama, Durum, Dönem (Kilitli / Açık), İşlem.
- Tek karar: Açılış (Onayla) / Açılış Değil (Reddet). Toplu karar: kutuyla seçip Seçilenleri Onayla / Reddet. Satırda ve bildirimde Geri Al.
- Süzgeç: Onay Bekleyenler / Tümü. Liste 200'lük sayfalarla.
- Aynı adlı iki cari, cari no / telefonla ayrılıyor.
- Toplu düğmeler pasifken nedeni görünür yazıyla çıkıyor.

*Açılış Eşleştirme* (İş 1; M-11):
- Önce uç da ekran da yoktu; şimdi ikisi de var.
- Pencerede: fiş tarihi, 519'un gün sonu bakiyesi, açılış türlerine göre dökümü, hedef satırları (+ Satır Ekle), Ön İzleme (519 satırı kendiliğinden), onay kutusu, Fişi Kaydet, yazılmış fişler ve Ters Kaydet.
- Pasif nedenleri görünür yazıyla: bakiye yok, kilitli tarih, ileri tarih.

**2. Uçlar** (yetki `system.manage`; Muhasebe 403)
- `/api/workspace/opening-review`:
  - `?limit=&offset=` → sayfa + `total` + satırda `locked`;
  - `?counts=1` → `lockedCandidate` ile;
  - `POST` toplu karar: aynı işlemde; listede olmayan kimlik varsa 404 ve hiçbir karar yazılmaz;
  - `decision: "undo"`: kararlı satır yeniden onay bekler, defterde 519.
- Sayfasız liste çıktısı tur 1'deki gibi. Tek karar yanıtına yalnız `previous` alanı eklendi.
- `GET /api/admin/ledger/opening-match`, `POST …/preview`, `POST …/opening-match`.
- Ret kodları:

| Kod | Durum | Kâhin karşılığı |
|---|---|---|
| `opening-match-account` 400 | izinsiz hedef | ESLESTIRME_HESAP |
| `opening-match-inverse` 409 | 519 ters bakiyeye geçer | ESLESTIRME_TERS |
| `opening-match-direction` 409 | 519 büyür | — |
| `opening-match-nothing` 409 | 519 bakiyesi 0 | — |
| `opening-match-zero` 400 | hedeflerin neti 0 | — |
| `period-locked` 409 | kilitli tarih | — |
| `date-future` 400 | ileri tarih | — |

**3. Örnek maddeler**
- Boş şirket (Kasa 1.000, cari 300, tedarikçi 200, banka 5.000, stok 200 → 519 = 6.300 alacak):
  - fiş 10.03: B 519 4.000 / A 500 4.000 → kalan 519 3.300 alacak;
  - ikinci fiş: A 500 2.000 + A 570 1.300 → 519 = 0.
- v2.4.9 kilitli verisi (kilit 30.06.2026):
  - Kural Farkı fişi 01.07: B 500 6.370 / B 602 2.800 / A 519 9.170;
  - eşleştirme 20.11: A 500 10.000 + A 570 1.670 / B 519 11.670.

**4. Mutabakat Testi / Defter Mutabakatı**
- Yeni BİLGİ satırı `opening:519-inverse`: "Eşleştirilecek Açılış Bakiyeleri (519) Eşleştirme Fişlerinin Tersine Geçti".
- Yalnız eşleştirme fişinden sonra açılış silinir ya da değişir de 519 fişin yönünün tersine geçerse çıkıyor; işlem engellenmiyor (§2.7).
- Sapma değil (ok, info): zil, tarama ve Mutabakat Günlüğü değişmez (sayıyla: günlük +0).

**5. Zil (system.manage)**
- "Sistem" grubunda "N kayıt onay bekliyor" bildirimi. Yönetim → Sistem bağlantısı `#system/acilis-olabilir` adresiyle pencereyi açıyor.

**6. Kural Farkı penceresi (tur 2b)**
- Aday nedeninin metni "(Cariler › …)" → "(Yönetim › Sistem › Açılış Olabilir Kayıtlar)" oldu.
- Yanına "Açılış Olabilir Kayıtları Aç" düğmesi eklendi. Tur 2b'nin başka davranışı değişmedi.

**7. Diğer**
- İşlem geçmişine üç etiket: `account.opening.confirmed`, `account.opening.rejected`, `account.opening.reopened`.
- Kılavuz 17. bölüme üç "nasıl yapılır" maddesi; PDF yeniden üretildi.

## İş 3 — sayılar
- **Yeniden üretim (taban):** uçlar vardı; ekran, zil, toplu karar, geri al ve sayfalama yoktu; neden metni olmayan bir ekranı gösteriyordu.
- **Değişen yol:** `server/lib/ledger-opening.mjs` (`createOpeningReview`: list / counts / decide undo / decideMany), `server/routes/opening-review.mjs`, `server/routes/ledger.mjs:617` (neden metni), yeni `client/assets/hof-acilis-olabilir.js`, `client/admin.html` (düğme + betik), `client/assets/admin.js` (hash + 3 etiket), `client/assets/hof-alerts.js` (yalnız aday sayısı), `client/assets/hof-kural-farki.js` (yönlendirme).
- **Okuyucular (taramayla):** app.mjs, acilis-519-250, kg16-geri-alma-250, kural-farki-duzeltme-250 (+ mutasyon [5] düzenli ifadesi hâlâ tutuyor), defter-hiz-esdegerlik(-tur1d), kilit-izi-alanlar-250, bank-post-izinli.json (ham yazım etiketi aynı).
- **Test `test/acilis-olabilir-250.test.mjs`:** 5/5 UTC + İstanbul.
  - Tabanda 5/5 kırmızı; nedenler okundu: sayfa alanı yok, toplu uç 405, undo 400, neden metni eski.
- **Mutasyon `test/acilis-olabilir-250-mutasyon.mjs`:** 7/7 değerle yakalandı.
- **Ekran senaryosu `test/e2e/senaryo-acilis-olabilir-250.mjs`:** 34/34 İstanbul + UTC; tabanda 3/11 (düğme ve zil yok).
  - Kapsadığı: v2.4.9 verisi, gerçek tıklama, Tab + Boşluk, iki kişi aynı anda, boş liste, Muhasebe Yönetim'e giremez.
  - Ekran görüntülerine baktım.
- **Komşular:**
  - birim testleri 13 dosya, 159/159 × iki TZ;
  - ekran senaryoları (İstanbul): acilis-duzeni-250 27/27, 211 59/59, 213 64/64, 226 22/22, kasa-acilis-uyari-250 20/20, donem-kilidi-ilerleme-250 39/39.

## İş 1 — sayılar
- **Açılış Karşılığı fiş satırlarını görüyor (sayıyla):** `parts.vouchers519` 730.000 kuruş; opening:519 defter 0 = beklenen 0, opening:500 −6.000 = −6.000.
- **Testler, iki TZ (UTC + İstanbul):**

| Test | Sonuç | Tabanda |
|---|---|---|
| `test/acilis-eslestirme-250.test.mjs` | 5/5 | 5/5 kırmızı (404 uç yok) |
| Kabul D: `test/acilis-duzeni-v249-250.test.mjs` | 5/5 | 5/5 kırmızı (sayfa alanı yok, eşleştirme ucu 404) |
| Ekran: `test/e2e/senaryo-acilis-eslestirme-250.mjs` | 29/29 | kırmızı (düğme yok) |

- **Kabul D'nin kapsamı:** v2.4.9 gerçek koduyla iki dönemde veri; aday → B16 → karar → Kural Farkı fişi → Düzeltildi → değişmez → eşleştirme → ters kayıt.
- **Kabul D'deki sınıf listesi:** Kasa, cari, tedarikçi, banka, stok, açılış evrakı, Excel kartı ve KG-16 adayı, her biri kilitli / açık dönemde.
  - 'Şüpheli kaydı olan cari' sınıfı İş 4'e bağlı; bu turda yok.
- **Kabul D'de beklentim yanlıştı, sayıyı karar metniyle yeniden kurdum:** 2.4.9 "Açılış…" açıklamalı Borç Yaz'ı açıklamadan açılış sayıyordu (§2.3). Onaylanan kilitli adayın farkı 602 → 519 değil, 500 → 519.
- **Bulunan ve düzeltilen:** cariye işlenmemiş evrakın maddesi `account:free-in:*` biçiminde. Dökümde "Cari Açılışları"na düşüyordu; artık "Açılış Evrakı" sayılıyor. İlk sürümün hatasıydı, commit'ten önce düzeltildi.
- **Mutasyon `test/acilis-eslestirme-250-mutasyon.mjs`:** 10/10 yakalandı.
- **Komşular** (integrity.mjs / ledger-opening / routes/ledger / `/api/admin/ledger` geçen bütün testler): 90 dosya, 1.000/1.000 × iki TZ, atlanan 0.

## İş 8
- Kılavuz HTML + PDF aynı commit'te.
- `pdf-denetle` 39/39, `test:kilavuz-metin` 947/947, kilavuz-surum ve kilavuz-pdf-surum 2 + 2, yazim-duzeni 6/6 (HEAD, iki TZ).

## KABUL KOŞULLARI
- **A (defter kâhini):** 187/187 — yeni UTC + İstanbul, taban UTC + İstanbul; 0 fark.
- **B (cari kâhini):**
  - taban = yeni = 16.449/16.449; ÖZET 16.490 denetim, 0 fark.
  - Yapım aşaması listesi kendi kopyamda yeniden üretildi: 41 → 41 (yeni 0, kapanan 0). 'Ç5-A' paketi kaydı yok; başka paket değişmedi.
- **C (muhasebe sürücüsü):**
  - taban = yeni: 8.456 test, 862 sınıflanmış / bekleyen fark, 44 atlanan; `gerileme.py` 226/226, program çıktısı birebir.
  - `acilis_eslestir` hâlâ "uygulanmadı (Ç5-ESLESTIRME)" (s18, s31, s62; 29 yer). Sürücü eşlemesi `test/bagimsiz/**`'da, ana oturumun işi.
  - Kalkan / yeni fark yok.
- **D:** yukarıda; 5/5 iki TZ.
- **E (hız):** aşağıda.
- **F (değişmezler):**
  - Σ borç = Σ alacak: Ç2 `post` + kapı.
  - Eşleştirme fişinden sonra 100 / 102 / 120 / 153 / 320 / 191 / 391 bakiyeleri aynı (testte).
  - Karma − baştan türetme = yalnız eşleştirme satırları (D[4]).
  - 1–5 sınıfı karma = baştan türetme (Kural Farkı fişinden sonra).
- **G (ekran):** iki yeni ekran ve iki senaryo yukarıda; yazım düzeni testi yeşil.

## HIZ (kabul E)
Temiz 100 bin satır, kendi kopyam, `flock -x`, 3 tur × iki TZ × kilitsiz / kilitli. Ham çıktı `docs/kanit/2026-11-13/c5a2c-olcum`.
- **Var olan yolların hiçbiri kötüleşmedi:** Mizan, Yevmiye, Hesap Planı Mizanı, Alt Hesap Mizanı, Defter Mutabakatı, Mutabakat Testi, Alacak Yaşlandırma, iki yazım yolu, Kural Farkı ön izlemesi.
- **Eşiğe değen yol yinelendi:** Açılış Olabilir sayfasız liste ilk ölçümde %10'u aştı; 8 turla yeniden ölçüldü. Taban 65,0 / 68,0 ms ↔ yeni 58,2 / 68,6 ms (en iyi / ortanca) — kötüleşme yok.
- **Yeni yollar:** sayfalı liste ~0,1 sn, zil sayısı ~0,03 sn.
- **Ölçütü aşan yol:**
  - Eşleştirme GET / ön izleme: kilitsiz 1,6–2,0 sn, kilitli 3,0–3,3 sn.
  - Olay döngüsü de o kadar tutuluyor: o sırada öbür istekler bekliyor.
  - Bunu bir karma `book()` çağrısı (bütün yevmiye türetmesi) üretiyor.
- **Ölçüm geçerliliği:**
  - "kilitli yeni UTC" koşusu başta yük 2,02 olduğu için GEÇERSİZ işaretli; aynı kipin İstanbul koşusu geçerli.
  - İlk ölçüm denemesi kilit doluydu (`rc=99`), sonra kilit alındı.

## BAŞ MİMAR KARARI GEREKİYOR
1. **Eşleştirme ön izlemesinin hızı (öneri: a).**
   - (a) 519'un tarihli bakiyesini SQL'le hesapla: kilitli kısım donmuş defter tablosundan, açık kısım modül tablolarından. Ölçek ~0,05 sn. Rastgele tarihlerde `book()` ile eşdeğerlik testi kalıcı olur. Gerekçe: yeni bir hesap yolu açar ama hızlı ve denetlenebilir.
   - (b) Sonucu veri sürümüne göre önbelleğe al. İlk çağrı yine yavaş kalır.
   - (c) Yönetici ekranı, seyrek kullanılır diye BİLİNEN SINIR.
   - Not (kapsam dışı ölçüm): tur 2b'nin Kural Farkı ön izlemesi kilitli veride 4,1 sn; o da 0,5 sn ölçütünün üstünde.
2. **Açılış Olabilir ekranının yeri (B10'dan sapma).** Ekran Yönetim'de; Cariler'in istemci dosyası Ç5-B'nin olduğu için dosya sınırı izin vermedi. Uçların yetkisi tur 1'deki gibi `accounts.manage` kaldı: Muhasebe uçları kullanabiliyor ama Yönetim'e giremediği için ekranı yok. Zil de yalnız `system.manage` olana çıkıyor. Seçenekler:
   - (a) böyle kalsın;
   - (b) Ç5-B birleştikten sonra Cariler'e bir düğme eklensin.
3. **İzinli hedef listesi.** K6'nın alt defter hesaplarına ek olarak 153, 136, 159, 198 ve 340 da dışlandı.
   - 153: "fiş stok değerini değiştirmez" değişmezi için.
   - 136, 159, 198, 340: bilançonun hesapladığı brüt gösterim karşılıkları.
   - 255 gibi öteki bilanço hesapları izinli.
   - Değerlendirin.
4. **519'u büyüten fiş reddediliyor** (`opening-match-direction`). Dayanak M-11'in "bakiyesi ya da bir kısmı" ifadesi.
5. **Ters bakiye bilgi satırı canlı türetmeye bakıyor.** Kural Farkı fişi ters kaydedilince Mizan'da 519 9.170 borç görünüyor, canlı türetmede 519 = 0. Bu durumda yalnız "Kural Değişikliği Farkı" uyarısı çıkıyor, iki ayrı uyarı yok (D[5]).

## KULLANICIYA SORULMALI
Yok. Yeni para / kapama kuralı çıkmadı.

## KAPSAM DIŞI BULGULAR
- Program dışı yazım türünden yeni açık görmedim.
- Kural Farkı ön izlemesinin hızı yukarıda (1. madde).

## DENENMEYEN / KOŞULMADI
- **DENENMEYEN:**
  - Eşleştirme fişinin üstüne kilidin ilerlemesi;
  - iki şirket;
  - yedekten geri yükleme ve Silinenler ile eşleştirme;
  - ekranda iki kişinin aynı anda eşleştirmesi (yalnız API'de denendi);
  - Muhasebe kullanıcısının Açılış Olabilir uçlarını API'den kullanması (200, test var), ama ekranı yok.
- **KOŞULMADI:**
  - tam `npm test` (kural gereği) ve CI;
  - senaryo-211 son HEAD'de değil, İş 3 durumunda koşuldu (59/59); İş 1'in düğmesi için yazım düzeni testi yeşil.
- **YAPILMADI, kalan işler (yeni temiz ajana, sırayla):** İş 7 DÜŞÜK-2 (sekiz yaşayan mutant), İş 5 ek testleri, İş 2'nin eksik örneği (S164 = C ikinci örnek).

## CI listesine eklenecek
- `test/e2e/senaryo-acilis-olabilir-250.mjs`
- `test/e2e/senaryo-acilis-eslestirme-250.mjs`
- Önceki turlardan bekleyen `senaryo-acilis-duzeni-250`.

## Windows'ta izlenecek (ders 48)
- `acilis-duzeni-v249-250` ve `acilis-olabilir-250`: v2.4.9 kodunu açıyor, klasör siliyor.
- `acilis-eslestirme-250`: kilit ve dondurma.

## Ç6 / devir için hazır bıraktıklarım
- `openingMatchState`: "Kesin Değil — Ters Bakiye 519" için.
- `openingMatchBalance`: tarihli 519 ve dökümü.
- `OPENING_MATCH_EXCLUDED`.
- `counts().lockedCandidate`: "Onay Bekliyor" nedeni için.

## Ana oturumun yeniden koşacağı komutlar (beklenen)
Testlerin hepsi `HUKUK_LICENSE_URL=http://127.0.0.1:9` ile ve iki TZ'de koşulur.

| Komut | Beklenen |
|---|---|
| `node --test test/acilis-olabilir-250.test.mjs` | 5/5 |
| `node --test test/acilis-eslestirme-250.test.mjs` | 5/5 |
| `node --test test/acilis-duzeni-v249-250.test.mjs` | 5/5 (eski sürüm etiketi gerekiyor) |
| Tabanda (`git archive c5a2c-taban` kopyası) aynı üç test | hepsi kırmızı |
| `node test/acilis-olabilir-250-mutasyon.mjs --kopya <HEAD kopyası>` | 7/7 (eski sürüm etiketi için `GIT_DIR` verilir) |
| `node test/acilis-eslestirme-250-mutasyon.mjs --kopya <HEAD kopyası>` | 10/10 |
| `node test/e2e/senaryo-acilis-olabilir-250.mjs` | 34/34 |
| `node test/e2e/senaryo-acilis-eslestirme-250.mjs` | 29/29 |
| `npm run test:kahin-defter` | 187/187 |
| `npm run test:kahin-cari` | 16.449, liste 41 |

## Ana oturumun EKRAN YÜRÜYÜŞÜ için adımlar
1. v2.4.9 kilitli verisinde zil "N kayıt onay bekliyor" → Yönetim → Sistem → pencere kendiliğinden açılır.
2. Kural Farkı Düzeltme penceresinde aday nedeni ve "Açılış Olabilir Kayıtları Aç" → kilitli adayı onayla, açık adayı reddet (bildirimde Geri Al'ı da dene).
3. Kural Farkı penceresi → Fişi Kaydet → satırda "Düzeltildi".
4. Açılış Eşleştirme → 519 bakiyesi ve dökümü → 500 + 570 satırları → Ön İzleme → Tab + Boşluk ile onay → Fişi Kaydet.
5. Hesap Planı Mizanı'nda 519 = 0, 500 ve 570 yazılmış olmalı.
6. Kalanı aşan tutarda ret iletisi; Ters Kaydet ile 519 geri gelmeli.
7. Fiş tarihi kilitli bir güne alınınca pasif + neden.

## Commit'ler
| Commit | İçerik |
|---|---|
| 79af6509 | tasarım notu §17.10 (koddan önce) |
| 2e626dc4 | İş 3 sunucu |
| 68da324b | İş 3 ekran |
| 04effeb7 | İş 1 |
| bac717bb | İş 8 |
| ea6c50f8 | tasarım notu §17.11 (sonuçlar) |
| 04926fb5 | Kanıt: `docs/kanit/2026-11-13/c5a2c-*` (komşular, ekran görüntüleri, kâhinler, sürücü, ölçüm, betikler) |

## Not defteri klasörüm
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2c-q` — betikler, ham kanıt (`kanit/`), ölçüm düzeneği (`olcum/`), 7,8 MB. Kod kopyaları, sürücü çıktıları ve ölçüm veri kopyası silindi.

Kâhin araçları kendi `/tmp/kahin-*` klasörlerini bıraktı; joker silme yasak olduğu için dokunmadım.
