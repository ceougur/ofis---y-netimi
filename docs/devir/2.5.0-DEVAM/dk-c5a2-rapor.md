# DAR KONTROL — Ç5-A TUR 2 (birleşim bc20ef31; ek kapsam 1e63eaa7 test/yapim-asamasi-kapisi)

Ortam (sonda, 05:28 UTC): yük 1,07 / 4 çekirdek, boş bellek 13 GB, boş disk 6,1 GB. Kod değiştirmedim, commit / push yapmadım. Kendi ağacımı yalnız `claude/epic-thompson-w0lc2l`'ye sıfırladım ve node_modules bağını ekledim. Kendi kopyalarımı (iki `git worktree`, arşiv kopyası, büyük veri kopyaları) sildim.

Özet: gerileme yok; bir ORTA bulgu var (kullanıcıya sorulmalı); DÜŞÜK'ler eksik test ve bir ekran sorunu.

## GERİLEMELER
**YOK.** Hem fiş yokken hem aday kararı yokken birleşim öncesi (40d9dd18) ile sonrasının defter çıktıları BİREBİR aynı çıktı. Karşılaştırılan çıktılar: Mutabakat Testi, Defter Mutabakatı, Yevmiye, Hesap Planı Mizanı, Alt Hesap Mizanı, `/api/workspace/ledger`, sayfasız aday listesi ve bütün yevmiye maddeleri.
- Programın kendi ürettiği üç eski sürüm verisi: surum-2.4.9-s127 (kilitli), surum-2.0.26-zincir (kilitli), surum-2.4.9-s127-kilitsiz. Hepsi TZ=UTC ve Europe/Istanbul'da 7/7 aynı.
- temiz-100k (153.803 madde): kilitsiz ve 30.06.2026 kilitli olarak BİREBİR.
- Kanıt: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/esd-kos.out` ve `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/buyuk-esd.out`.
- Bilanço / Gelir Tablosu ekranı bu dalda yok; karşılaştırılmadı.

## YENİ BULGULAR

### ORTA-1 — Kilit yıl sonunu aşınca Kural Farkı ön izlemesi yanlış bir fiş öneriyor; Mutabakat aynı anda "Düzeltildi" diyor (K-d gerçek programda üretildi)
- **Yer:**
  - `server/routes/ledger.mjs:610` (correctionView): 671 / 681 eşleme yılı = yeni fişin tarihinin yılı (kilit + 1).
  - `server/lib/ledger-snapshots.mjs` checks() ("Eşleme yılı" satırı): eşleme yılı = son etkin düzeltme fişinin yılı.
  - `server/lib/ledger-opening.mjs` ruleDiffCorrectionPlan: daha önce yazılmış fişler, kendi yıllarına bakılmadan güncel eşlemeyle düşülüyor.
- **Betik:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/p/p1-yil.mjs`
- **Çıktılar:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/p1-ist.out` ve `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/p1-utc.out` (iki saat diliminde aynı sonuç).
- **Kurgu (programın kendi yolu; veri v2.4.9'un gerçek koduyla):**
  1. v2.4.9'da 02.10.2026 tarihli "Açılış bakiyesi" Borç Yaz 700 girildi, kilit 05.10.2026.
  2. Güncel kodda aday reddedildi. Ön izleme `B 500 700 / A 602 700` önerdi, fiş 06.10.2026'ya yazıldı (Fiş 2026-000001). Mutabakat "Düzeltildi" dedi. Buraya kadar doğru.
  3. Bugün 10.01.2027, kilit 31.12.2026'ya ilerletildi:
     - Mutabakat: ok, "— Düzeltildi (Fiş 2026-000001)".
     - Kural Farkı ön izlemesi aynı anda **etkin** ve `B 602 700 / A 671 700` (tarih 01.01.2027) öneriyor.
  4. Bu fiş kaydedilince:
     - 2027 defteri: 602 +700 borç (2027 satış hasılatı 700 eksik), 671 −700 (Önceki Dönem Gelirleri 700 fazla).
     - 2026 defteri değişmiyor (602 −700).
     - Mutabakat yine "Düzeltildi (Fiş 2026-000001, Fiş 2027-000001)" diyor; yanlış fiş hiçbir yerde görünmüyor.
- **Kök neden:** aynı yılda yazılmış düzeltme sonuç hesabına (602) gitti. Kilit yıl sonunu aşınca o yılın farkları "önceki yıl" sayılıp 671 / 681'e eşleniyor ve yazılmış fişten düşülüyor. Ekranla Mutabakat farklı yıl kuralı kullanıyor.
- **Neden sık görülür:** 2.4.9'dan aylık kilitle gelen her müşteride, yayın 1 Şubat 2027 olduğu için Ocak ayı farkları aynı yıla düşer. Yıl sonu kilidi geçilince ön izleme bu fişi önerir.
- **Önerilen en küçük düzeltme (karar kullanıcıda):** yazılmış her düzeltmenin farkı, o fişin kendi yılına göre eşlenip düşülsün; ön izleme ile Mutabakat tek yıl kuralını paylaşsın. O zaman ön izleme "Fişle düzeltilebilen fark kalmadı" der. Ayrıca iki yılı ayıran (bugünün yılı ≠ kilit + 1 yılı) kalıcı test gerekir; aşağıdaki N11 mutantı yaşadı.
- Bu, defter kuralına dokunuyor → **KULLANICIYA SORULMALI** (aşağıda). İş listesi C'de aynı soru yok (671 / 681 geçen satırlar: 755 ve 757; ikisi de bu durumu sormuyor).

### DÜŞÜK-1 — Açılış Olabilir Kayıtlar: sayfadaki kayıtlar toplu kararla bitince liste boş görünüyor ve sayfa düğmeleri kayboluyor
- **Yer:** `client/assets/hof-acilis-olabilir.js` — karardan sonra `refresh()` başlangıç noktasını (offset) sıfırlamıyor; `pager()` toplam ≤ 200 olunca hiç çizilmiyor.
- **Betik:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/p/ui-yuru.mjs` (gerçek tıklama). Görüntü: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/ui/1-toplu-onay-sonrasi.png`.
- **Ne oldu:** 250 aday vardı. 2. sayfadaki 50 kayıt seçilip onaylandı. Özet "Onay bekleyen 200 kayıt" diyor; tablo "Onay bekleyen kayıt yok." diyor; satır 0, sayfa düğmesi 0. Kullanıcı süzgeci değiştirmeden ya da pencereyi kapatıp açmadan kalan 200 kaydı göremiyor.
- **Sakınca süzgeci:** para / defter / veri kaybı yok → DÜŞÜK.
- **Öneri:** offset ≥ toplam ise offset'i son dolu sayfaya çek.

### DÜŞÜK-2 — Yaşayan yeni mutantlar (eksik test; kod bugün doğru)
Ayrıntı aşağıdaki mutant bölümünde. Sakınca: bugün yanlış para üretmiyorlar; N4 ve N11 ileride sessiz yanlış "Düzeltildi" ya da yanlış fişi kaçırır → DÜŞÜK (test eksikliği).

### DÜŞÜK-3 — "Fazla düzeltme" ipucundaki yer adı eksik
`server/lib/ledger-snapshots.mjs` ipucu "Yönetim › Kural Farkı Düzeltme'den ters kaydedin" diyor; ekranın yeri "Yönetim › Sistem › Kural Farkı Düzeltme". Metin sorunu.

### DÜŞÜK-4 (yetki — K-f) — Muhasebe ve avukat rolü API'den kilitli dönemdeki adaya karar veriyor
- **Betik:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/p/p4-yetki-sira.mjs`; çıktı `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/p4-ist.out`.
- **Ne oldu:** muhasebe kilitli adayı reddetti (200). Yönetici fişi yazdı, Mutabakat "Düzeltildi" dedi. Sonra avukat "undo" yaptı (200): yöneticinin Mutabakat'ı uyarıya döndü (kalan 700 TL) ve ön izleme "önce Açılış Olabilir listesini tamamlayın" diye pasifleşti.
- Donmuş defter değişmiyor, uyarı sessiz değil, işlem kaydı kimin yaptığını yazıyor (`account.opening.rejected/Dk muhasebe`, `account.opening.reopened/Dk avukat`) → DÜŞÜK.
- Ekran yalnız yöneticide, uç `accounts.manage`'da. Tutarlılık için kilitli dönemdeki satırın kararı `system.manage`'a bağlanabilir (baş mimar kararı).

## DEĞİŞMEZLER TABLOSU
| Kurgu | Değişmez | Sonuç |
|---|---|---|
| 19 izinli hedefin HER birine 1 TL eşleştirme fişi, sonra ters kayıt (s127) | Mutabakat Testi ile Defter Mutabakatı'nda yeni sapma yok | YOK (`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/p2-utc.out`) |
| 16 izinsiz hesap API'den doğrudan (100, 102, 120, 128, 153, 320, 519, 600, 602, 136, 340, 191, 391, 360, 999, boş) | ön izleme ve kayıt 400 opening-match-account | 16/16 ret |
| Eşleştirme fişi yazılıyor | cari bakiyeleri değişmez | aynı |
| İki eşzamanlı tam eşleştirme fişi | biri 200, öbürü 409 opening-match-inverse | doğru |
| 900,01 TL / ters yön / iki satır net 0 / 3 ondalık / yanlış alt hesap | 200 (bakiye yeterliydi) / 409 direction / 400 zero / 400 line / 400 account | beklenen |
| Fişten sonra açılış silinir | 519 ters bakiyeye geçer, engellenmez, bilgi satırı çıkar (`ok` + `info`, 519 700 / eşl. 1.200); fiş ters kaydedilince satır düşer | doğru (p3b) |
| Kilitli tarihe fiş | 409 period-locked | doğru |
| Yedek → ters kayıt → geri yükleme (şirket 002) | 519 −600 ve 1 etkin fiş geri gelir; 001'de fiş yok | doğru (p3) |
| Karar → fiş → Geri Al → onay → ikinci fiş | kalan 700, sonra "Düzeltildi (2 fiş)" | doğru (p4) |
| Fişten sonra kilidi kaldır → kilitli kaydı değiştir (700 → 900) → yeniden kilitle | "fazla" uyarısı 700 (doğru tutar), ön izleme karşı fişi öneriyor | sessiz değil (K-c) |

## PERMÜTASYON / RASTGELE SIRA
Rastgele sıra koşusu yapılmadı. Yalnız elle bir sıra denendi: ret → fiş → Geri Al → onay → fiş. Bu sırada defter ↔ fiş tutarlı kaldı. Bkz. DENENMEYEN.

## İPTAL YOLLARI TABLOSU (S160)
| Yol | Ret mi | Geride iz |
|---|---|---|
| Toplu iptal | evet (öğe başına 409, ileti tarih ve "yönetici dönem kilidini açmalı" diyor) | fatura `issued`, kilitli türetme farkı yok |
| Toplu silme | evet | fatura duruyor |
| Tek silme | 409 period-locked-bond | kilitli türetme farkı yok |
| Banka'dan Ters Kaydet, Düzelt, e-Arşiv iptali | evet (kalıcı test yeşil; N7 mutantını yakaladı) | — |

Betik: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/p/p5-s160.mjs`.

Koddan tarama: `account_entries.invoice_id`'yi boşaltan tek yer iptal (`invoices.mjs:2903`). İptali çağıranlar: silme, toplu iptal, toplu silme, e-Belge, Banka'dan Ters Kaydet. Mobil yazmada iptal yolu yok.

## YETKİ TABLOSU
| Rol | aday listesi / sayı / sayfa | toplu ve tek karar | Kural Farkı GET / POST | Eşleştirme GET / ön izleme / POST |
|---|---|---|---|---|
| avukat | 200 / 200 / 200 | 200 | 403 / 403 | 403 / 403 / 403 |
| muhasebe | 200 / 200 / 200 | 200 | 403 / 403 | 403 / 403 / 403 |
| personel | 403 / 403 / 403 | — | 403 / 403 | 403 / 403 / 403 |

Avukat ve muhasebenin karar yetkisi DÜŞÜK-4'te.

## YENİ MUTANTLAR (12; depodaki listelerden ve önceki raporlardan farklı)
Koşu kendi `git worktree` kopyamda, Europe/Istanbul. Mutantsız taban: 8/8, 5/5, 5/5, 10/10, 7/7, 5/5 yeşil. Çıktı: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/mutant.out`.

**Yakalananlar (5):**
- N2: yazılmış düzeltme toplamı ters kayıtları saymıyor.
- N5: 519 gün sonu bakiyesine sonraki günlerin açılışı da giriyor.
- N6: 519 ters bakiye bilgi satırının yönü ters.
- N7: S160 reddi Banka'dan Ters Kaydet'te atlanıyor.
- N8: toplu karar işlem (tx) dışında yazılıyor.

**Yaşayanlar (7) — eksik test:**
- N1: alt defter dışlaması tek turda kalıyor (zincirleme dışlama vakası yok).
- N3: etkin düzeltme listesi ters kaydedilmiş fişleri de sayıyor (ekran yanlış fiş listeler, ipucu metni yanlış; testler görmüyor).
- N4: "Düzeltildi" dışarıda kalan alt defter farkına bakmıyor (test [8] fiş yazıp Düzeltildi durumunu sınamıyor).
- N9: zil sayısı kilit gününü saymıyor (sınır testi yok).
- N10: B16 sıra zorlaması kilit günündeki adayı saymıyor (sınır testi yok).
- N11: ön izleme yılı bugünün yılından alınıyor (yıl ayrımı testi yok; ORTA-1 ile bağlantılı).
- N12: S160 sorgusu silinmiş evrağa bakmıyor (silinmiş evrakla test yok; etkisi küçük).

## ESKİ KODDA KIRMIZI (ders 7, 38)
Yeni testler birleşim öncesi kodda beklenen nedenle kırmızı:

| Test | Sonuç (eski kod) | Neden |
|---|---|---|
| acilis-eslestirme-250 | 5/5 kırmızı | uç yok, 404 |
| kural-farki-duzeltme-250 | 7 kırmızı, 1 atlandı | uç / alan yok |
| s160-iptal-yollari-250 | 7/10 kırmızı | 200 dönüyor, 409 bekleniyor |
| s160-kilitli-tahsilat-bagi-250 | 6/7 kırmızı | 200 dönüyor, 409 bekleniyor |
| acilis-olabilir-250 (git worktree) | 5/5 kırmızı | 404 ve "undo" 400 |
| acilis-duzeni-v249-250 (git worktree) | 5/5 kırmızı | 404 |

Üç yeni ekran senaryosu eski kodda kırmızı:
- senaryo-acilis-duzeni-250: 8/12 başarısız.
- senaryo-acilis-olabilir-250: 8/11 başarısız.
- senaryo-acilis-eslestirme-250: 8/11 başarısız.

## ÖLÇÜM (ders 52: dışlayıcı kilitle, yük 1,07–1,40)
- **İki fiş varken (100k, kilit 30.06.2026; kural farkı düzeltme fişi + eşleştirme fişi), eski ↔ yeni, ikişer tur × 3 tekrar.** Kötüleşen yol yok.
  - Mutabakat Testi: 7,5–7,8 sn ↔ 7,5–7,8 sn.
  - Defter Mutabakatı: ~10 sn ↔ ~10 sn.
  - Yevmiye: 3,2–3,5 sn ↔ 3,4–3,6 sn.
  - Mizan: 2,1–2,9 sn ↔ 2,2–3,0 sn.
  - Alt Hesap Mizanı: 0,18–0,39 sn ↔ 0,19–0,36 sn.
  - Çıktı: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/hiz-fis.out`.
- **5.000 aday (v2.4.9 gerçek koduyla; 2.500'ü kilitli dönemde):**
  - Sayfasız liste: 47 → 43 ms. Mutabakat Testi: 130 → 134 ms (eski ↔ yeni).
  - Zil sayısı 4 ms; sayfa 6–13 ms.
  - Toplu karar (1.000 kayıt): 365–445 ms, olay döngüsü en çok 442 ms. Bu süre boyunca öbür istekler bekler; 0,5 sn'nin altında.
  - Toplu Geri Al 366 ms; Kural Farkı ön izleme 83 ms; tek karar 5 ms.
  - Çıktı: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8/hiz-aday.out`.

## BAŞ MİMAR KARARLARI
- **K-a — DOĞRU.** Kilitli ödeme alış faturasına bağlıyken fatura iptal edildi: bağ düştü, kilitli dönemin türetmesi farkı boş, Mutabakat ok. Defter `invoice_id`'yi yalnız tahsilatta ('in') okuyor.
- **K-b — Atlanan yol bulunamadı.** Toplu iptal, toplu silme, tek silme ve e-Belge iptali reddediliyor. Reddedilen istek geride iz bırakmıyor: fatura, bağ ve numara aynı.
  - e-Belge yolunda kayıt / iptal işlemi yapılmıyor. Ancak taslak durumdaki e-Belge'de, reddin tetiklendiği adımdan önce EDM'ye yalnız durum sorgusu gidiyor (`confirmDraft`). Bu önceden de vardı → DOĞRULANMADI'ya bakın.
- **K-c — Sessiz kalmıyor.** Kilidi kaldırınca ve yeniden kilitleyince "fazla" uyarısı doğru tutarla (700) çıkıyor; ön izleme karşı fişi öneriyor.
- **K-d — Üretildi → ORTA-1, kullanıcıya sorulmalı.**
- **K-e — BİREBİR.** Fikstürler, iki saat dilimi ve 100k verinin kilitli / kilitsiz hâli.
- **K-f — DÜŞÜK-4.**
- **K-g — Uyumlu.** İzinli hedefler 255, 500–503, 520–523, 529, 540–542, 548, 549, 570, 580, 590, 591 — M-11'in saydıkları + "öteki bilanço hesapları". Hiçbiri bir denetimi bozmuyor.
- **K-h — Doğru.** Ters bakiyeye geçişte bilgi satırı çıkıyor, engelleme yok; ters kayıtla düşüyor. Bugünkü 519 ters bakiyedeyken ön izleme ters yönde bir fişe (B 500) izin veriyor — düzeltme yolu sayılabilir.
- **K-i — DOĞRULANMADI.** Y10 ve Y12 için programın kendi yolundan gözlenebilir bir fark üretemedim. Kilitli evraka program yolları zaten 409 alıyor; kapı dışı yazım süzgece uğramıyor.
- **K-j — Fişe sessizce girmiyor (test [8] yeşil).** Ama o vakada fiş yazıldıktan sonraki "Düzeltildi" durumu sınanmıyor (N4 yaşadı).
- **K-k — S47 / S51'e uyumlu.** Kilitli aday varken ön izleme pasif ve nedeni görünüyor; Geri Al'dan sonra fiş ↔ defter tutarlı. S51 (Silinenler'den dönen aday) denenmedi.
- **K-l — Beklenti doğru, test dişli.** Aracın (`tools/kanit.mjs:548`) "okunamadı" iletisi PATH boşken üretiliyor; "okunamayan = boş" mutantında ileti çıkmaz, `assert.match` düşer. Bu mutantı ayrıca koşmadım (koddan çıkarım).
- **K-m — Kötüleşme yok** (ölçüm yukarıda).

## KULLANICIYA SORULMALI (defter kuralı, ders 43)
**Soru:** Kural Farkı Düzeltme Fişi aynı yılda sonuç hesabına yazıldıktan sonra kilit yıl sonunu aşarsa ne olsun?

- **A (öneri):** yazılmış fiş kendi yılında düzeltilmiş sayılır. Yeni yılda fiş önerilmez; ön izleme ile Mutabakat aynı kuralı kullanır.
  - Mizan 2027: 602 = 0, 671 = 0.
- **B:** bugünkü davranış. Yeni yılda `B 602 / A 671` sınıflama fişi önerilir.
  - Mizan 2027: 602 +700 borç, 671 −700 alacak. 2026 iki seçenekte de aynı (602 −700).
- **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- **Yaygın programlarda:** önceki dönem düzeltmesi kapanmış yılın sonuç hesabını yeniden sınıflandırmaz. Bunu bir programın belgesinden doğrulamadım.

## DOĞRULANMADI
- K-i (Y10 / Y12) eşdeğerliği.
- POS komisyon faturası için "doğrudan iptali 409" cümlesi: koddan S160 reddiyle 409 alacağı görülüyor, programda koşulmadı.
- Taslak e-Belge iptalinde S160 reddinden önce EDM'ye durum sorgusu gitmesi (salt okuma; önceden de böyleydi).
- K-l mutantı (yalnız koddan).

## DENENMEYEN
- Kararların rastgele permütasyonu (yalnız elle bir sıra denendi).
- İki kişinin aynı adaya aynı anda karar vermesi.
- S51 (Silinenler'den geri yüklenen aday).
- Silinenler'den geri yüklenen açılış satırı: denedim ama çöp öğesini betik bulamadı.
- Mobil yazma.
- Ç6 / Bilanço ekranı (bu dalda yok).
- Windows.
- Eski sürüm v2.0.26 zincirinde eşleştirme fişi.
- Kilit bugünken ön izleme ekranda (kalıcı testte var, ben koşmadım).

## NOT DEFTERİ KLASÖRÜ
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a2-r8`
- `p/` — bütün betikler
- `*.out` — bütün çıktılar
- `ui/` — ekran görüntüleri
- `esd-*` — boş klasör kalıntıları
