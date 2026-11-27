# 2.5.1 Mİ tur 2 — Müşteri İstekleri Kod Ajanı Raporu (taslak, adım adım)

Görev metni: `docs/devir/2.5.1-DEVAM/mi2-istem.txt` (ana ağaçta). Taban: etiket `t251-mi-tur1` = c674b41b (Mİ tur 1'in dal ucu).
İşler: (1) tek borç sırasının girdisine sızan görünen numaranın çıkarılması (hakem testi), (2) TEK NUMARA HER YERDE (S-Mİ1-1 = A), (3) Cari Listesi'nde
"Tahsilat Dönemi:" etiketinin her durumda görünmesi.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

Her madde için beklenen: kart penceresinde görünen numara (vade sırası, 1..n, boşluksuz) = makbuz = taksit kartı PDF'i = Taksitler listesi (ekran / PDF / Excel)
= cari ekstresi (ekran / PDF / Excel) = WhatsApp metni = Tablo = zil / takvim / Vade Takip = Rapor Merkezi = mobil özet; para / bakiye / gecikmiş / tahsilat sayıları
DEĞİŞMEZ; tek borç sırasının girdisi bayt bayt aynı.

1. **Taksiti silinmiş kart** (saklanan sıra 1, 3 kalır): ekran "1., 2." → makbuz, PDF, Excel, ekstre, WhatsApp da "2. taksit" yazmalı ("3." değil).
2. **Vadesi öne alınmış taksit** (saklanan 3, vadesi en erken): her yerde "1."; öbürleri "2.", "3." (eski "3., 1., 2." görünümü hiçbir çıktıda kalmamalı).
3. **Araya eklenen taksit** ("Taksit Ekle", vadesi mevcutlardan önce; saklanan MAX+1): her yerde vade sırasıyla numaralanır.
4. **Aynı vadeli iki taksit**: sıra saklanan sıraya göre (vade eşitse `seq`); ters çevrilirse numaralar takas olur — bütün çıktılar aynı kuralla (tek yardımcı).
5. **Kapatılmış / yeniden açılmış kart**: numara kartın durumundan bağımsız (kapanış sırayı değiştirmez); yeniden açılınca aynı numara.
6. **"Borçta Kalsın" ile kapanan kart**: kuyruk vadesi kapanış ertesi güne kayar (kuyruğun girdisi) — görünen numara KARTIN taksit sırası (vade değişmiş gibi
   yeniden sıralanmaz); numara kuyruğun girdisine girmez.
7. **Excel'den yüklenen kart** (açılış = önceden ödenen): açılış ilk taksitleri kapatır; numara yine kartın sırası; açılış satırının makbuzu yok.
8. **Kısmen ödenmiş taksit**: makbuz "N. taksit (vade …)" — N görünen numara; kalan / ödenen sayıları değişmez.
9. **İade ile küçülen kart** (iade kesimi son / açık taksitten): kesilen taksit silinmez, numara değişmez; silinirse (1) gibi.
10. **Silinip geri yüklenen kart** (Silinenler'den geri): numara geri yüklemeden önceki ile aynı.
11. **İki kartlı cari**: her kartın numarası KENDİ kartının sırası; ekstre satırı doğru kartın numarasını yazar.
12. **Makbuz tahsilattan SONRA taksit silinirse**: makbuz anlık üretiliyorsa yeniden açılınca YENİ görünen numarayı yazar (önceden basılmış kâğıtla fark —
    teslim notuna); tahsilat silinen taksite bağlıysa bağı en eski açık taksite kayar → makbuz o taksitin numarasını yazar.
13. **İki şirket**: her şirket kendi kartlarının sırası; şirketler arası bellek sızmaz (kuyruk girdisi örnek başına).
14. **Dönem kilidi**: numara gösterimi kilitten etkilenmez; kilitli dönemdeki taksit silinemez (bugünkü kural) — numara kayması da olmaz.
15. **Eski sürümden gelen veri** (saklanan sırası boşluklu / çift kart): göç YOK; görünen numara her açılışta saklanan veriden hesaplanır.
16. **Tek borç sırasının girdisine sızma**: görünen numara alanı kuyruğun girdisine (cari defteri satırları, kart haritası, taksit listesi) GİRMEMELİ; hakem
    dosyası (`test/fixtures/obligation-input-250-hakem.json`) DEĞİŞMEZ.
17. **Saklı metinler**: gönderilmiş WhatsApp iletisinin donmuş içeriği / kayıtlı açıklamalar YENİDEN YAZILMAZ; anlık üretilen çıktılar yeni numarayı yazar.
18. **Cari Listesi dönem seçicisi**: dönem seçilince "Tahsilat Dönemi:" etiketi kaybolmamalı (tarih aralığı alanları açıldığında da görünür).
19. **Para sayıları**: hiçbir senaryoda bakiye / kalan / gecikmiş / tahsilat sayısı değişmemeli (değişirse DUR — hata).

## SON RAPOR

### Değişen gözlenebilir davranışlar (önce → sonra)
Örnek (testteki kart, ELLE): 3 taksitli kart (06.08 / 06.09 / 06.10.2026), 2. taksit SİLİNDİ → saklanan sıra 1, 3; 06.10 vadeli taksite 400 TL tahsilat.
1. **Tahsilat makbuzu (PDF)**: "Açıklama 3. taksit (vade 06.10.2026)" → "2. taksit (vade 06.10.2026)".
2. **Taksit kartı PDF'i / Yazdır**: No sütunu "1., 3." → "1., 2.".
3. **Taksitler listesi (ekran + PDF)**: "06.10.2026 · 3. taksit" → "06.10.2026 · 2. taksit" (ekran: "N. taksit · gün").
4. **Cari ekstresi** (cari kartı ekranı, cari ekstre PDF'i, Anlık Durum ekstresi ekran / PDF / Excel, Rapor Merkezi Cari Ekstre ve Tüm Cari Hareketleri, mobil cari hareketleri):
   "Taksit Tahsilatı · 3. taksit" → "Taksit Tahsilatı · 2. taksit".
5. **WhatsApp ekstresi** (elle / wa.me metni ve Otomatik Gönder'in ekstre PDF'i): aynı satır "· 2. taksit".
6. **Rapor Merkezi** Taksit Tahsilatları, Taksit Vadeleri, Geciken Taksitler: Taksit sütunu "3. taksit" → "2. taksit" (ekran / PDF / Excel; mobil).
7. **Zil / takvim**: "3. taksit" → "2. taksit"; **Vade Takip / nakit akışı**: "3. taksit (kalan)" → "2. taksit (kalan)".
8. **Tablo** (kayda bağlı kart): taksit bloğu No ve "Sıradaki N. taksit", işlem geçmişi "taksit tahsilatı · N. taksit" görünen numarayla.
9. **Fatura penceresi "Bu Faturayı Kapatanlar"** (taksitli fatura; vadesi öne alınan 3. taksite tahsilat): "Taksit Tahsilatı · 3. taksit" → "· 1. taksit".
10. **Cari Listesi** dönem seçicisi: "Tahsilat Dönemi:" etiketi artık seçenekten ayrı ve HER durumda görünür (önce yalnız ilk seçeneğin metniydi — "Bugün" / "Tarih Aralığı"
    seçilince ve Grup Özeti'nde kayboluyordu); ilk seçenek "Tahsilat Dönemi: Yok" → "Yok".
11. Silme / vade değişikliği / öne ekleme OLMAYAN kartta hiçbir yerde numara değişmez (görünen = saklanan). Para / bakiye / gecikmiş / tahsilat sayıları DEĞİŞMEDİ
    (testte elle: kart 2.000 / 1.400 / 600, cari bakiyesi 600; kâhinler tur 1 ile aynı).

## 1. DÜZELTME (karar 1) — görünen numara kuyruğun girdisinden çıktı

**Kök neden (tur 1):** `lib/plans.mjs allocate` taksit satırına ve `next`'e `no` ekliyordu. `allocate` çıktısı cari kartının kart listesine (`routes/plans.mjs forAccount`
→ `shape`) gider; o liste carinin defterini kurar (`lib/accounts.mjs accountLedger`) ve defter Tek Yükümlülük Kuyruğu'nun girdisidir (`invoices.obligationsFor(id, ledger)`).
Hakem testi (`test/obligation-input-250.test.mjs`, ikinci vaka — `obligation-input-250-zincir-hakem.json`; özetinde `kartListesi: forAccount(...)` var) bu yüzden beş cari sınıfında
"hakemden farklı çıktı" verdi: fark YALNIZ `kartListesi[0].items[i].no` ve `kartListesi[0].next.no` alanlarıydı (kuyruğun kendi çıktısı aynıydı — ana oturumun bulgusunu yerelde
yeniden ürettim: `HAKEM_YAZ_ZINCIR=<not defteri>` ile şimdiki çıktıyı yazıp hakemle alan alan karşılaştırdım; İadeli Kart'ın bilinen farkı (`changedByRule`) dışında tek fark `no`).

**Çözüm (seçim ve gerekçe):** numara üretimi `allocate`'ten ÇIKTI; tek kaynak YENİ `server/lib/plan-item-no.mjs` (gösterim katmanı):
- `compareItems` (`lib/plans.mjs`, dışa açıldı): kartın taksit sırası (vade, vade eşitse saklanan sıra) — `allocate` de AYNI işlevle sıralar (sıra kuralı tek yerde).
- `itemNumbers(items)` → taksit → numara; `planItemNumbers(store, planIds)` toplu (tek sorgu); `numberedView` (pencere / Tablo / PDF girdisi), `withNo` (sıradaki taksit),
  `itemText` ("N. taksit"), `planInLabel` (defter satırının metin kalıbı — `accountLedger` de bu kalıbı saklanan sırayla kullanır), `numberedLines` (defter satırlarının
  GÖSTERİLEN metni), `numbersOfPlans`.
- Kuyruğun girdisi olan yollar numarasız ve saklanan sırayla AYNEN: `allocate`, `forAccount`, `accounts.detail(..., { withRemaining: false })` (fatura kapamasının / kuyruğun
  defter okuması — `routes/invoices.mjs` 708 / 854 / 5419, `routes/plans.mjs queueBuild`), `allLedgers()` varsayılanı (kuyruğun toplu girdisi), `ledgerPlansByAccount`.
  Ekrana / çıktıya giden yollar numarayı bu modülden ekler (aşağıdaki tarama tablosu). Neden bu seçim: (i) `allocate` para dağıtımını yapan saf motor — çıktısına görünüm alanı
  koymak her girdiye sızdırır; (ii) `withRemaining` bayrağı zaten "defter okuması (kuyruk / kapama)" ↔ "ekran" ayrımıydı (yorumuyla), gösterimi ona bağlamak yeni bayrak açmaz;
  (iii) `obligation-queue.mjs` DEĞİŞMEDİ.
- Hakem dosyaları (`test/fixtures/obligation-input-250-hakem.json`, `-zincir-hakem.json`) `git diff t251-taban..HEAD -- test/fixtures/` BOŞ.
- `test/plans.test.mjs`: tur 1'in eklediği `no: 2` beklentisi tabana döndü (allocate'te alan yok).

**Ek sınama:** `test/mi2-kuyruk-girdisi-251.test.mjs` (4) — taksiti SİLİNMİŞ ve vadesi ÖNE ALINMIŞ iki kartlı cari (+ bağsız cari tahsilatı): `allocate`, `forAccount`, defter
okuması, toplu defter, kart haritası, kuyruğun çıktısı — hiçbirinde `no` anahtarı yok; defter okumasında metin SAKLANAN sırayla ("Taksit Tahsilatı · 3. taksit" ×2); cari kartı
ekranı ve `allLedgers({ numbered: true })` görünen numarayla ("· 1. taksit", "· 2. taksit"); bakiye iki yolda aynı ve ELLE 4.050; satırların kimlik / borç / alacak / tarihi iki
yolda aynı (yalnız metin farklı).

## 2. TEK NUMARA HER YERDE (karar 3) — TARAMA tablosu

Tarama: `git grep -n -E "\}\. taksit|\.seq\b|itemSeq|next\.seq|AS itemSeq|i\.seq AS"` (server, client, bulut) + taksit numarası yazan her metin kalıbı ("N. taksit", "· N. taksit", "No"
sütunu), çağıranlar `git grep -n -E "allLedgers\(|accountLedger\(|viewOf\(|waFacts\(|\.detail\(|planStatementPdf|receiptPdf|forCase\(|entriesForCase\(|openItems\(|dueItems\("`.

| # | Yer (ekran / çıktı) | Tur 1'de | Şimdi | Kod |
|---|---|---|---|---|
| 1 | Taksit kartı penceresi (No sütunu, düğme adları, "N. taksiti düzelt", "Hangi Taksite", sil onayı, hareket satırı "· N. taksit") | görünen (allocate'ten) | görünen (detailView → numberedView) | routes/plans.mjs detailView / writeView |
| 2 | Tahsilat makbuzu PDF'i "N. taksit (vade …)" | SAKLANAN | görünen | lib/plan-report.mjs receiptPdf (girdisi detailView) |
| 3 | Taksit kartı PDF'i / Yazdır (taksit satırı No) | SAKLANAN | görünen | lib/plan-report.mjs planStatementPdf |
| 4 | Taksitler listesi ekranı "N. taksit · gün" | SAKLANAN | görünen | routes/plans.mjs list() next.no + client/assets/hof-plans.js |
| 5 | Taksitler listesi PDF'i (Sıradaki Vade) | SAKLANAN | görünen | routes/plans.mjs liste.pdf |
| 6 | Taksitler listesi Excel'i | — (böyle bir çıktı YOK; ekranda Excel düğmesi yok) | — | — |
| 7 | Cari kartı ekstresi (ekran), cari ekstre PDF'i, Anlık Durum ekstresi (ekran / PDF / Excel), Rapor Merkezi Cari Ekstre (+ Ayrıntılı), mobil cari hareketleri | SAKLANAN ("Taksit Tahsilatı · N. taksit") | görünen | routes/accounts.mjs detail (withRemaining = gösterim) → numberedLines |
| 8 | WhatsApp elle (wa.me) ekstre metni | SAKLANAN | görünen | routes/accounts.mjs waFacts → numberedLines (routes/whatsapp.mjs statementText) |
| 9 | WhatsApp Business API ekstre PDF'i (gönderim anı) | SAKLANAN | görünen (gönderim anında üretilir) | lib/whatsapp/queue.mjs → accounts.detail |
| 10 | Tüm Cari Hareketleri (Rapor Merkezi; ekran / PDF / Excel; mobil) | SAKLANAN | görünen | report-center cari-hareketleri → allLedgers({ numbered: true }) |
| 11 | Taksit Tahsilatları (Rapor Merkezi; ekran / PDF / Excel; mobil) | SAKLANAN | görünen | report-center taksit-tahsilatlari (planItemNumbers) |
| 12 | Taksit Vadeleri ve Geciken Taksitler (Rapor Merkezi; ekran / PDF / Excel; mobil) | SAKLANAN | görünen | report-center installmentReport (itemNumbers) |
| 13 | Zil / takvim (dues) kalem etiketi "N. taksit" | SAKLANAN | görünen | routes/plans.mjs dueItems |
| 14 | Vade Takip ve nakit akışı kalemi "N. taksit (kalan)" | SAKLANAN | görünen | routes/plans.mjs openItems |
| 15 | Tablo: kaydın taksit bloğu (No, "Sıradaki N. taksit"), kayıt detayının Taksit Planı | SAKLANAN (istemci seq okuyordu) | görünen | routes/plans.mjs forCase → numberedView + client/assets/hof-workspace.js |
| 16 | Tablo: kaydın işlem geçmişi "taksit tahsilatı · N. taksit" | SAKLANAN | görünen | routes/plans.mjs entriesForCase → itemNo + hof-workspace.js |
| 17 | Cari Listesi "… gün gecikti (N. taksit)" (Mİ-1) | görünen | görünen (summariesByAccount → withNo) | routes/plans.mjs summariesByAccount / queueBrief |
| 18 | Cari kartının taksit kartı özeti (next.no; ekranda numara yazılmıyor, tur 1 testi okuyor) | görünen | görünen | routes/accounts.mjs planSummaryOf |
| 19 | 409 iletisi "Seçilen N. taksit ödendi" | görünen | görünen | routes/plans.mjs assertRoom (itemNumbers) |
| 20 | **EKLENDİ (görev metninde yoktu):** fatura penceresi "Bu Faturayı Kapatanlar" — taksitli faturanın kartından alınan tahsilat "Taksit Tahsilatı · N. taksit" | SAKLANAN | görünen | routes/invoices.mjs fatura ayrıntısı → numberedClosers |
| 21 | Ödeme Hatırlatma / WhatsApp şablonları, wa.me hazır metinleri ({Sıradaki Taksit} = tarih · tutar) | numara YAZMIYOR | — | lib/whatsapp/*, client/assets/hof-whatsapp.js |
| 22 | Excel'den yükleme önizlemesi "N. taksit" (insight/schedules) | yeni kartın 1..n'i (saklanan = görünen) | dokunulmadı | lib/insight/schedules.mjs |
| 23 | Tablo'nun Excel kolonlarından okunan "2. Taksit" (insight/dues) | kullanıcının tablosundaki metin | dokunulmadı (bizim numaramız değil) | lib/insight/dues.mjs |
| 24 | Rapor Merkezi Taksit Kartları / cari kartı "sıradaki" satırları | numara YAZMIYOR (tarih · tutar) | — | — |
| 25 | Cari makbuzu (cari tahsilatı) | taksit numarası yok | — | routes/accounts.mjs makbuz.pdf |
| 26 | İade belgesinin kesilen taksit kaydı (coverCutItems, `seq`) | SAKLI iç veri, ekranda yazılmıyor | dokunulmadı (iade iptali aynı taksite geri yazmak için kimlik + sıra) | routes/invoices.mjs |

### Anlık üretilen ↔ saklı metin (karar 3)

| Çıktı | Nasıl üretiliyor | Yeni numara ne zaman görünür |
|---|---|---|
| Makbuz PDF'i (taksit) | ANLIK — her açılışta kart + hareketten (makbuz NO'su saklı, açıklama metni saklanmıyor) | hemen; önceden basılmış / gönderilmiş makbuz kâğıdı eski numarayı taşıyabilir |
| Taksit kartı PDF'i / Yazdır, Taksitler listesi PDF'i, cari ekstre PDF / Excel, Anlık Durum ekstresi, Rapor Merkezi raporları (PDF / Excel) | ANLIK | hemen |
| Kart penceresi, Taksitler listesi, Cari Listesi, cari kartı, Tablo, zil / takvim, Vade Takip, nakit akışı, fatura penceresi | ANLIK | hemen |
| WhatsApp elle (wa.me) metni | ANLIK hazırlanır; gönderilen metin `message_sends.body` olarak SAKLANIR | yeni hazırlanan metin yeni numarayla; saklı metin YENİDEN YAZILMADI |
| WhatsApp Business API gönderimi | ekstre PDF'i gönderim anında üretilir; gönderilen içerik iş kaydında SAKLANIR ("Gittiği anki içerik") | yeni gönderim yeni numarayla; saklı içerik YENİDEN YAZILMADI |
| Mobil özet (bulut özeti) | Rapor Merkezi / cari kartı uçlarından ANLIK üretilir, buluta SAKLI kopya yüklenir | bir sonraki özet yüklemesinde (en geç ~15 dk; veri değişince) |
| İade belgesinin kesilen taksit kaydı, Değişiklik Geçmişi (denetim) kayıtları | SAKLI iç veri (saklanan sıra / kimlik) | DEĞİŞMEDİ (ekranda taksit numarası olarak yazılmıyor) |
| Saklanan sıra `plan_items.seq` | SAKLI veri | DEĞİŞMEDİ (göç yok) |

### Değişen dosyalar (t251-mi-tur1..dal ucu; 17 dosya, +592 / −44)
- YENİ `server/lib/plan-item-no.mjs` — görünen taksit numarasının TEK kaynağı.
- `server/lib/plans.mjs` — `allocate` numara üretmez (tur 1'in `no`'su çıktı); `compareItems` dışa açıldı (allocate aynı işlevle sıralar).
- `server/lib/accounts.mjs` — defter satırının metni `planInLabel` kalıbıyla (çıktı bayt bayt aynı; saklanan sıra).
- `server/lib/plan-report.mjs` — makbuz ve kart PDF'i görünen numara.
- `server/routes/plans.mjs` — detailView / list / summariesByAccount / queueBrief / dueItems / openItems / forCase / entriesForCase / 409 iletisi.
- `server/routes/accounts.mjs` — detail (gösterim yolu), waFacts, planSummaryOf, allLedgers({ numbered }).
- `server/routes/invoices.mjs` — fatura ayrıntısının kapatanları (numberedClosers).
- `server/routes/report-center.mjs` — Tüm Cari Hareketleri, Taksit Tahsilatları, Taksit Vadeleri / Geciken Taksitler (YALNIZ numara gösterimi).
- `client/assets/hof-plans.js` (Taksitler listesi), `client/assets/hof-workspace.js` (Tablo), `client/assets/hof-accounts.js` + `hof-ui.css` (etiket).
- Testler: YENİ `test/mi2-tek-numara-251.test.mjs` (12), `test/mi2-kuyruk-girdisi-251.test.mjs` (4); `test/e2e/senaryo-mi1-251.mjs` (+5 denetim), `test/e2e/senaryo-mi2-251.mjs`
  (+4 denetim, yeni adım 7); `test/plans.test.mjs` TABANA döndü.
- DEĞİŞMEDİ: `server/lib/obligation-queue.mjs`, hakem dosyaları, `test/bagimsiz/**`, göçler, Değersiz / şüpheli, KDV, devir, `package.json`, `tools/**`, `.github/**`, kılavuz.

### Yeni / değişen testler: kırmızı (tur 1 kodu, AYRI kopya `git worktree add --detach /dev/shm/mi2-t2/eski t251-mi-tur1`) ↔ yeşil
| Test | Tur 1 kodunda (UTC ve İstanbul aynı) | Tur 2 kodunda |
|---|---|---|
| obligation-input-250 (hakem) | 1/2 — "hakemden farklı çıktı … ilk\|001\|OZ 001 Silinen Kart · … Stok Taksit" (BEKLENEN neden) | 2/2 (komşu koşusunda iki TZ) |
| mi2-kuyruk-girdisi-251 (4) | 2/4 — "allocate çıktısında 'no' yok" (allocate / forAccount'ta `no`), "ekran: … 1., … 2." (ekran saklanan sırayı yazıyor) | 4/4 iki TZ |
| mi2-tek-numara-251 (12) | 2/12 (geçen: kart penceresi ve 409 — tur 1'de zaten görünen) — makbuz "Açıklama 3. taksit (vade 06.10.2026)", kart PDF'i `["1. 06.08.2026","3. 06.10.2026"]`, liste PDF'i, cari ekstresi, Rapor Merkezi Cari Ekstre "… · 3. taksit", WhatsApp, zil, aynı vade makbuzu "3. taksit (vade 06.08.2026)", Tablo `itemNo` yok, fatura kapatanı "Taksit Tahsilatı · 3. taksit" | 12/12 iki TZ |
| e2e senaryo-mi1-251 (12) | 9/12 — makbuz "3. taksit (vade 13.11.2026)", cari ekstresi "Taksit Tahsilatı · 3. taksit", Taksitler listesi "2. taksit" | 12/12 |
| e2e senaryo-mi2-251 (27) | 23/27 — dört etiket denetimi `{"text":"","visible":false,…}` (etiket yok; ilk seçenek "Tahsilat Dönemi: Yok") | 27/27 |
Ham çıktılar: `docs/kanit/2026-11-27/mi2-251/mi2-eski-*.log|json`, `mi2-e2e-eski-*.log`, ekran görüntüleri `ekran-eski-*` / `ekran-yeni-*`.

### Kabul koşulları
- **A. Kâhin (iki TZ):** test:kahin-cari 107 senaryo, 25.298 / 25.298 denetim, 0 fark, 7 bilinen sınır, 0 yapım aşaması; test:kahin-defter 187 denetim, 0 fark,
  0 yakalanmayan mutasyon — tur 1 raporundaki sayılarla AYNI (`mi2-kahin-*`).
- **B. Hakem:** obligation-input-250 iki TZ yeşil (komşu koşusunda); hakem dosyaları `git diff t251-taban..HEAD -- test/fixtures/` BOŞ.
- **C. Komşular (karar 2):** 277 test dosyası, 3.177 test — UTC 3.177 / 3.177 GEÇTİ (24,7 dk), Europe/Istanbul 3.177 / 3.177 GEÇTİ (24,6 dk); commit 51109662
  (`mi2-komsu-utc.json`, `mi2-komsu-europe-istanbul.json`). Tur 1'in bütün testleri (mi1-taksit-no-251, mi2-grup-ozeti-251, plans) listede.
  **Komşu listesinin çıkarılışı:** `git grep -l -E -f komsu-desen.txt -- 'test/*.test.mjs'` → `komsu-liste.txt` (ikisi kanıt klasöründe). Desen = değişen HER işlevin adı ve
  onu çağıranlar: `allocate(`, `compareItems`, `plan-item-no`, `forAccount`, `summariesByAccount`, `queueBrief`, `queueSummaryOf`, `withQueue`, `queueLedger`, `dueItems`,
  `openItems`, `forCase`, `entriesForCase`, `allLedgers`, `waFacts`, `accountLedger`, `obligationsFor`, `allObligations`, `ledgerPlansByAccount`, `planStatementPdf`, `receiptPdf`,
  `plan-report`, `statementText`, `closers`, `installment-paid` + uçlar (`makbuz.pdf`, `ekstre.pdf|xlsx`, `liste.pdf`, `/api/workspace/plans`, `/api/workspace/dues`, `vade-takip`,
  `nakit-akisi`, `taksit-tahsilatlari`, `taksit-vadeleri`, `geciken-taksitler`, `cari-hareketleri`, `cari-ekstre`, `whatsapp/targets`, `/cases/`, `overview/ekstre`, `report-center`)
  + metin (`Taksit Tahsilatı`, `itemSeq`, `next.seq`, `.seq`) + istemci dosyaları (`hof-plans`, `hof-workspace`, `hof-accounts`, `data-period`, `hof-ui.css`) + kaynak tarayanlar
  (`lib/plans.mjs`, `lib/accounts.mjs`, `yazim-duzeni`).
- **D. Mutantlar — 19 / 19 YAKALANDI** (aşağıda). **E.** Yeni sınamalar tur 1 kodunda BEKLENEN NEDENLE kırmızı (yukarıdaki tablo; makbuz "3. taksit", hakem kırmızı).

### Mutant tablosu (`betik-mutantlar.sh.txt`, `mi2-mutantlar-ozet.log`; her biri kanit kaydıyla, TZ=UTC)
| Mutant | Değişiklik | Sonuç (kırmızı test sayısı) |
|---|---|---|
| t2-saklanan-sira-makbuz (istenen: bir çıktı yolunda saklanan sıra) | makbuz `itemText(item.no)` → `item.seq` | YAKALANDI (2) |
| t2-girdiye-sizdir (istenen: girdiye geri sızdır) | forAccount `shape` → `numberedView(shape)` | YAKALANDI (2: hakem + girdi sınaması) |
| t2-girdi-defter-numarali | defter okuması (withRemaining: false) da numaralı | YAKALANDI (1) |
| t2-ayni-vade-ters (istenen) | compareItems aynı vadede `b.seq - a.seq` | YAKALANDI (1) |
| t2-etiket-donemde-gizli (istenen) | etiket yalnız dönem yokken | YAKALANDI (3 e2e denetimi) |
| t2-ekstre-numarasiz | cari kartı ekstresi numarasız | YAKALANDI (3) |
| t2-zil-saklanan-sira | zil etiketi `item.seq` | YAKALANDI (1) |
| t2-whatsapp-numarasiz | waFacts satırları numarasız | YAKALANDI (1) |
| t2-fatura-kapatanlar | kapatanlar numarasız | YAKALANDI (1) |
| t1-mi1-saklanan-sira (tur 1) | itemNumbers saklanan sıra | YAKALANDI (14) |
| t1-mi2-* (tur 1'in 9 mutantı: tedarikçi ödemesi, açılış toplama, grupsuz düşür, alt grup katma, dönem bir gün, silinmiş kart, silinmiş cari, çek ↔ senet, ödeme yapanlara açılış) | aynen | hepsi YAKALANDI (7 / 7 / 1 / 2 / 9 / 1 / 1 / 2 / 1) |

### Hız
ÖLÇÜLEMEDİ. Betik hazır (`betik-olc-mi2.mjs.txt`: tur 1 ↔ tur 2, temiz-100k kopyaları, Cari Listesi, en hareketli carinin kartı, zil, Taksitler listesi, Vade Takip,
Tüm Cari Hareketleri, Taksit Tahsilatları, Taksit Vadeleri; ABBA). `flock -x -w 1800` 30 dk içinde özel kilidi alamadı (başka ajanların paylaşımlı koşuları; sonra yük 5–9) —
`mi2-olcum-OLCULEMEDI.txt`. Kod olarak eklenen iş: kart başına küçük sıralama (taksit sayısı kadar) ve Tüm Cari Hareketleri / Taksit Tahsilatları'nda bütün taksitleri okuyan TEK
sorgu (id, kart, sıra, vade) + satır metni geçişi; cari başına ek sorgu YOK (ders 47). Ana oturum hız kabulünde bu yolları ölçmeli (ders 53).

### KULLANICIYA SORULMALI
Yok (para / kapama / defter kuralı ayrışması çıkmadı; para sayıları değişmedi).

### BAŞ MİMAR KARARI GEREKİYOR (uygulandı, değerlendirilmeli)
1. Gösterim ↔ girdi ayrımı `accounts.detail`'in mevcut `withRemaining` bayrağına bağlandı (true = ekran / çıktı → numaralı satır metni; false = fatura kapamasının / kuyruğun defter
   okuması → saklanan sıra). Yeni bir defter okuması yazan, kuyruğa girdi verecekse `withRemaining: false` vermeli — kural `routes/accounts.mjs` ve `lib/plan-item-no.mjs`
   yorumlarında; ayrıca `test/mi2-kuyruk-girdisi-251` ve hakem korur.
2. Fatura penceresinin "Bu Faturayı Kapatanlar"ı kapsama EKLENDİ (görev metninde yoktu; taramada bulundu). Yalnız fatura AYRINTISI; liste satırlarının kapatanları (ekranda yazılmıyor)
   ve kuyruğun kendi çıktısı saklanan sırayla kaldı.
3. Cari kartının taksit kartı özetinde `next.no` (ekranda yazılmıyor) tur 1 sınamasının beklentisi olduğu için korundu (`planSummaryOf`; waFacts da aynı eşlemeyle).
4. Etiket `<span>` olarak seçiciden ÖNCE kondu (seçici `<label>` içine alınınca biçemi kayboluyordu — ekran görüntüsüyle görüldü, düzeltildi).

### SONRAKİ SÜRÜME (2.5.1 / sonraki tur)
- Rapor Merkezi'nin grup kısmı (tur 1'den — görev (d)).
- Kuyruğun çıktısındaki (iç) satır metinleri saklanan sırayla kalıyor; ekrana yalnız fatura ayrıntısının kapatanları çıkıyor ve o çevriliyor. Başka bir ekran ileride kuyruğun kapanış
  metnini doğrudan gösterirse `numberedClosers` benzeri çeviri gerekir (şimdilik başka yer yok — tarandı).
- Hız ölçümü (yukarıda ÖLÇÜLEMEDİ).

### DOĞRULANMADI
- WhatsApp Business API (Otomatik Gönder) ekstre PDF'inin numarası: kod yolu `accounts.detail` (gösterim) — sahte Meta ile uçtan uca denenmedi; elle (wa.me) metni sınandı.
- Mobil (cari hareketleri, raporlar): kod yolu masaüstüyle aynı uçlar — mobil ekranda denenmedi; buluta yüklenen özet bir sonraki yüklemede yenilenir.
- Windows: dosyaya dokunan yeni test yok; CI'de okunacak.

### DENENMEYEN
"Borçta Kalsın" ile kapanmış kartın numarası (kod: numara kartın kendi vadesinden — `planDueDate`; sınamada yok); Excel'den yüklenen kart (açılış) ve iade ile küçülen kart (tur 1'de
numara sınandı; çıktı yollarında ayrıca denenmedi); silinip geri yüklenen kart (hakem senaryosunda "Silinen Kart" var — girdi tarafı); iki şirket (hakem iki şirketli — girdi
tarafı; çıktı yollarında tek şirket); dönem kilidi; eski sürümden gelen gerçek veri (göç yok, numara her istekte saklanan veriden hesaplanır); nakit akışı raporunun PDF / Excel'i
(etiket openItems'tan — Vade Takip ekranı sınandı); Rapor Merkezi PDF / Excel'i yalnız Taksit Tahsilatları için dosyadan okundu.

### BİLİNEN SINIRLAR
Önceden basılmış / gönderilmiş makbuz, ekstre, WhatsApp iletisi eski (saklanan) numarayı taşıyabilir — yalnız taksiti silinmiş, vadesi değiştirilmiş ya da araya eklenmiş kartlarda;
saklanan metinler yeniden yazılmadı (karar 3).

### Teslim notu için tek cümle
Taksit numaraları artık her yerde (ekran, makbuz, ekstre, WhatsApp, raporlar) kartın vade sırasıyla 1, 2, 3… diye boşluksuz yazılıyor; taksiti silinmiş ya da vadesi değiştirilmiş
kartlarda daha önce verilmiş makbuz veya ekstredeki taksit numarası yenisinden farklı olabilir (tutarlar değişmedi).

### CI listesine eklenecek
`test/e2e/senaryo-mi1-251.mjs`, `test/e2e/senaryo-mi2-251.mjs` (tur 1'den; bu turda genişledi). Yeni birim testleri `test/**/*.test.mjs` deseniyle zaten koşar.

### Kılavuz metni önerisi
- **Taksit numarası:** Taksitler vade sırasına göre 1, 2, 3… diye numaralanır. Bir taksiti silerseniz ya da vadesini değiştirirseniz numaralar kendiliğinden yeniden sıralanır;
  makbuz, ekstre, WhatsApp mesajı ve raporlarda aynı numara yazar.
- **Tahsilat dönemi (Cari):** Listenin üstündeki "Tahsilat Dönemi" seçicisinden Bugün, Dün, Bu Hafta, Bu Ay ya da Tarih Aralığı'nı seçin; "Yok" seçilince tahsilat sütunu gizlenir.

### Commit listesi (t251-mi-tur1..dal ucu)
36c3dca2 rapor: nasıl bozulur · c881e793 kod + birim testleri (karar 1, 3) · 51109662 etiket + ekran senaryoları (karar 4) · (kanıt) · (rapor). Dal ucu: aşağıdaki son commit.

### Ana oturumun yeniden koşacağı komutlar (eski kod: `git worktree add --detach <yol> t251-mi-tur1`; eski kopyaya yalnız iki yeni test dosyası)
- `TZ=UTC` ve `TZ=Europe/Istanbul`: `HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/obligation-input-250.test.mjs test/mi2-kuyruk-girdisi-251.test.mjs test/mi2-tek-numara-251.test.mjs test/mi1-taksit-no-251.test.mjs test/mi2-grup-ozeti-251.test.mjs test/plans.test.mjs`
- `PLAYWRIGHT_BROWSERS_PATH=<pw-1194> node test/e2e/senaryo-mi1-251.mjs` ve `… senaryo-mi2-251.mjs` (eski: `DEPO=<eski kök>`)
- `npm run test:kahin-cari`, `npm run test:kahin-defter` (iki TZ)
- komşular: `git grep -l -E -f docs/kanit/2026-11-27/mi2-251/komsu-desen.txt -- 'test/*.test.mjs'` → `node --test --test-concurrency=1 <liste>` (iki TZ; ~25 dk her biri)
- mutantlar: `bash docs/kanit/2026-11-27/mi2-251/betik-mutantlar.sh.txt` (içindeki M yolunu `betik-mutant.py.txt`'nin kopyasına çevirerek)
- hız: `flock -x <olcum.lock> node betik-olc-mi2.mjs.txt'nin .mjs kopyası <kök> <temiz-100k kopyası> <etiket> 5` (taban ve yeni, ABBA)
