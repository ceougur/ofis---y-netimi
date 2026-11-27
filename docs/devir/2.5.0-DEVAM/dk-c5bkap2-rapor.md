# Dar kontrol — Ç5-B kapanış 2 (ajan ad45265e6d959fc54; 13.11.2026 04:45–05:52 UTC; fark a1e21511^1..a1e21511) — RAPOR (AYNEN)

DAR KONTROL — Ç5-B KAPANIŞ 2 (birleşim a1e21511; fark `a1e21511^1..a1e21511`, test/bagimsiz hariç) — RAPOR

Sonuç: YÜKSEK yok. 1 ORTA var: S129 = A eksik uygulanmış, bir ekran unutulmuş. Ayrıca 1 ORTA adayı var (gerçek programın kuyruk çekirdeğinde üretildi, API'de üretilmedi) ve 5 DÜŞÜK var. Para kuralında iki okumalı yeni durum çıkmadı; yalnız S129'un iade gösterimi için bir sunum sorusu var. Kod değiştirmedim, commit / push yapmadım.
Kapsayıcı 05:07'de yeniden başladı. Kesilen iki koşuyu (önce kodunda tohum 91001 ve 101001) baştan koştum, yarım çıktılara dayanmadım.
Ortam: yük 1,45 / 4 çekirdek, boş bellek 13 GB, boş disk 9,7 GB (05:50 UTC).

---

## GERİLEMELER

**Para / bakiye / gecikmiş açısından gerileme bulunmadı.** Karşılaştırdığım sürümler a1e21511^1, 8d6ea9c9^1 ve v2.4.9 (gerçek koduyla üretilmiş veri). Bir istisnayı ayrıca yazıyorum:

**G-T (tutarlılık gerilemesi; a1e21511^1'e göre) = ORTA-A.** Kayda bağlı kartta, kaydın detay kartındaki "Taksit planı" bölümünün TOPLAMLARI artık kart penceresinden farklı.
- a1e21511^1'de iki ekran aynı toplamı gösteriyordu: 0 / 900.
- Şimdi kart penceresi Tahsil Edilen 500 · Kalan 400 gösteriyor, kayıt bölümü Ödenen 0 · Kalan 900.
- Satır düzeyindeki ayrışma a1e21511^1'de de vardı: pencerede 0 / 100 / 300, bölümde 300 / 300 / 300.
- Para kuralı değişmedi; S129'un uygulaması bu ekranda eksik. Fren sorusu açısından: toplamlar için evet, para için hayır.

---

## KAPANIŞ TABLOSU

Önceki kapanışın betiklerini kendi kopyamda koştum. Hepsi ürünü çağırıyor (API, ya da ürünün `buildObligations` işlevi).

| Önceki bulgu | Betik | a1e21511^1 | a1e21511 | Sonuç |
|---|---|---|---|---|
| ORTA-1 (S110: tutar 1.000 → 800, akan saat) | `satis-kart.mjs akan` | gecikmiş 1.200, kural S120, Borç 500 @19.11 takvimden kayıp | gecikmiş 700, kural S110-satis, Borç 500 @19.11 ayrı kalem, 200 @05.09 | KAPANDI |
| ORTA-1, v2.4.9 verisi (G1) | `goc.mjs oku` | 1.200 | 700 | KAPANDI |
| ORTA-1, 8d6ea9c9^1 verisi | `goc.mjs uret` (c5b0 kodu) → `oku` (yeni kod) | — | G1 700, G8 1.000 | KAPANDI |
| ORTA-2 (Σ kalem ↔ bakiye) | `sigma-bozan.mjs` | Σ 960 / bakiye 940, gecikmiş 960 | 940 / 940, gecikmiş 940 | KAPANDI (küçük caride) |
| ORTA-2, rastgele, kendi tohumlarım (5 küme, UTC + İstanbul) | `saf-rastgele2.mjs` | 322.000 caride Σ farkı 46, gecikmiş > bakiye 30 | 322.000 caride Σ farkı 0, gecikmiş > bakiye 0; en çok 236 geçiş | KAPANDI |
| ORTA-2, satır sayısı ≥ 1.667 olan cari | `saf-dolgu*.mjs` | — | Σ = bakiye; ama gecikmiş farklı | KISMEN → ORTA-B adayı |
| DÜŞÜK-2 (yaşayan 10 mutant) | `mutant-yeni.mjs` | 10 yaşıyordu | 9 öldü; K1 yaşıyor (olası eşdeğer) | KISMEN |
| DÜŞÜK-3 (motor alt sınırı) | `motor-mutant.sh` | mutant A yakalanmıyordu | mutant A tohum 7'de 1. işlemde, tohum 11'de 42. işlemde "alt sınır" iletisiyle yakalanıyor; mutantsız tohum 7: 500 işlem, çıkış 0 | KAPANDI |
| DÜŞÜK-4 (form çelişkisi) | `ekran-s118.mjs` (insan hızı + Tab; görüntüye baktım) | açıklama "40 gün gecikti", satır "Ödendi" | açıklama "Kartın kendi tahsilatlarına göre kalanı 900 · sıradaki 1. taksit (carinin avansıyla kapalı görünüyor)" | KISMEN → DÜŞÜK-C |
| DÜŞÜK-1 (kilit × bağsız kart tahsilatı) | `karar3.mjs` D2 | — | ^1 ile aynı | 2.5.1'e bırakıldı |
| Kapsam dışı 1: Vade Takip'te Ödeme Sözü | — | — | — | AÇIK (S130 turu) |
| Kapsam dışı 2: v2.4.9'da kapatılmış kartın taksitleri | `goc` G4 | Ödendi / 0 | Ödendi / 0 | S144 = C |
| DOĞRULANMADI: yetkisi kısıtlı kullanıcıya fazla veri | `bayat2.mjs` (personel) | — | personelin takviminde fatura kalemi 0, sürüm sonu 0001; mutant N11 testte ölüyor | KAPANDI (takvim) |
| DOĞRULANMADI: K1 / K3 eşdeğer mi | mutant | — | K3 ölüyor, K1 yaşıyor | K1 açık |

Ek kontroller:
- **S133–S135 sayıları değişmedi.** `karar2.mjs` C1 (gecikmiş 0), C1b (500), C2 ve `karar3.mjs` D1 ^1 ile aynı. Bütün karar2 / karar3 çıktısı yalnız S129 gösterim alanlarında farklı.
- **Saat dilimi.** komsu1 ve s129 UTC ile İstanbul'da birebir aynı.

---

## BULGULAR

### ORTA-A — S129 = A eksik: kaydın detay kartındaki "Taksit planı" kartın kendi hesabını gösteriyor
- **Dosya:** `server/routes/plans.mjs:1540–1544` (`forCase` → `shape`; `withQueue` / `shownTotals` yok). İstemci `client/assets/hof-workspace.js:112–119` (`casePlanHtml`: `t.paid`, `t.remaining`, `item.remaining`).
- **Betik:** `betik/kayit-kart.mjs` → `kanit/kayit-{yeni,once}.json`. Kartın `case_key` alanını veri tabanından yazdım (kayıt bağı kurulumu yerine; okuma yolu aynı).
- **Kurgu:** Borç 900 → Mevcut Borç kartı 900 (3 × 300) → karta bağlanmadan tahsilat 500.

| | Kart penceresi | Kayıt detayı "Taksit planı" |
|---|---|---|
| a1e21511 | Tahsil Edilen 500 · Kalan 400; satırlar Ödenen 300 / 200 / 0 | Ödenen 0 · Kalan 900; satırlar 300 / 300 / 300 |
| a1e21511^1 | 0 · 900 (satırlar 0 / 100 / 300) | 0 · 900 (satırlar 300 / 300 / 300) |

- **Karar metni:** S129 "ekranda tek sayı" diyor. Bu ekran önceki raporun alan / yer listesinde yoktu; liste eksikti.
- **Sakınca:** yanlış para görünümü (Kalan 900, oysa cari bakiyesi 400). Bu yüzden ORTA.
- **En küçük düzeltme:** `forCase` aynı `withQueue(…, queueOf())` görünümünü versin. Form sınırı için `ownRemaining` alanı zaten var (S118 = B).
- **Not:** Tahsilat penceresi de `openPlanCollect` ile bu uçtan açılıyor; açılışını ekrandan denemedim.

### ORTA-B ADAYI (API'de ÜRETİLMEDİ — DOĞRULANMADI'ya da yazıldı) — çok satırlı caride yakınsama sınırı 12; güvenli kapanış gecikmişi değiştiriyor
- **Dosya:** `server/lib/obligation-queue.mjs:218–247` (`prepaidPassLimit`: 20.000 / satır; 1.667 satırın üstünde sınır yine 12) ve `settleExcess` (:754–783).
- **Betik:** `betik/saf-dolgu-gec.mjs` (PAD=900, TZ=Europe/Istanbul, tohum 71001 × 150 × 40) → `kanit/dolgugec-40.json`. Aynı kurgunun başına kendi içinde kapanmış 900 çift (Borç 10 + aynı gün tahsilat 10) eklenince sonuç ürünün kuyruk işleviyle şöyle değişiyor:
  - 113 kurgunun 113'ü yakınsamıyor (12 geçiş; dolgusuzda 14–31 geçiş).
  - Σ kalem = bakiye her kurguda tutuyor.
  - 3 kurguda açık taksit dağılımı ve gecikmiş değişiyor. Örnek, tohum 71085 cari 8: gecikmiş (gün 200) dolgusuz 877,00 → dolgulu 792,00. Kart M'nin taksitleri 497 / 413 → 412 / 498.
- **Kök neden:** güvenli kapanış, yakınsamış sonucun yerine geçen yaklaşık bir sonuç veriyor. Carinin kapanmış geçmişi uzadıkça sonuç değişiyor.
- **Sakınca:** gecikmiş tutar (para görünümü). API'de üretilirse ORTA.
- **Öneri:** büyük caride ölçüm geçişini yalnız ön ödemeli kartların kalemlerine daraltıp sınırı yükseltmek. Ya da kuralı "yakınsayana dek" olarak bırakıp hızı ölçmek.
- **Baş mimar görev metninde** "yakınsayana kadar" deniyordu; kod büyük caride bunu yapmıyor.

### DÜŞÜK-A — S129: aynı kurguda kartın "Tahsil Edilen / Kalan"ı carinin kapanmış eski geçmişine bağlı (S143 = C ailesinin yeni yüzü)
- **Betik:** `betik/sigma-dolgu.mjs 0,200` (API, akan saat) → `kanit/dolgu2-yeni.json`, `dolgu-once.json`.
- **Sayılar** (aynı kurgu: geriye tarihli Alacak + kart tahsilatı):

| | Dolgu 0 | Dolgu 200 (eski, kapanmış Borç 10 + tahsilat 10 çiftleri) |
|---|---|---|
| a1e21511 (gösterim) | Tahsil Edilen 560 · Kalan 250 | 810 · 0 |
| a1e21511^1 (kendi hesabı) | 490 | 490 |

- Bakiye, gecikmiş ve açık kalemler iki durumda da aynı (940).
- Saf koşu (`saf-dolgu.mjs`, PAD=100, yakınsamış): 59 kurgunun 40'ında "Tahsil Edilen" değişiyor.
- **Kök neden:** S101 ölçüm kümesi (`card.measure.set`, s2 kuralında carinin karttan önceki bütün borçları) çoktan kapanmış borçları da sayıyor. Bu ölçüm önceden de vardı; S129 onu ekrana taşıdı.
- **Sakınca:** bakiye ve gecikmiş doğru, yalnız gösterim. DÜŞÜK; S143 = C kapsamına ek olarak yazılmalı.

### DÜŞÜK-B — S129: faturasız stok iadesi "Tahsil Edilen" sayılıyor; faturalı iade sayılmıyor (KULLANICIYA SORULMALI aşağıda)
- **Betik:** `betik/iade.mjs` → `kanit/iade-yeni.json`.
- Borç 500 + satış kartı 1.000 + faturasız stok iadesi 300: Tahsil Edilen 300, satır Ödenen 300, kart hareketi 0. Bağsız tahsilat 300 ile birebir aynı görünüm.
- Taksitli fatura 2 × 500 + iade faturası 1 adet: kart 500'e küçülüyor, Tahsil Edilen 0.
- `plans.mjs:283–287`'nin açıklaması "iade … tahsil edilen sayılmaz" diyor; kuyruğun `collected` alanı (obligation-queue.mjs:1041) ise faturasız iadeyi sayıyor.
- **Sakınca:** bakiye 1.200 aynı; para / bakiye değişmiyor. DÜŞÜK.

### DÜŞÜK-C — DÜŞÜK-4'ün kalan yüzü: "Kalanı Aşan Tutar" sorusu "kalan 900" diyor, arkadaki pencere "Kalan 400" gösteriyor
- **Kanıt:** `kanit/ekran-s118-yeni/03-901-soru.png` (görüntüye baktım).
- Form açıklaması "kartın kendi tahsilatlarına göre kalanı" diye niteliyor; sunucunun soru metni nitelemiyor.
- Ayrıca "Ödendi · Kalan 0" görünen satırda ₺ düğmesi var. Bu S118 = B gereği.
- **Sakınca:** yalnız metin. **Öneri:** soru metnine aynı niteleme ("kartın kendi tahsilatlarına göre kalanı").

### DÜŞÜK-D — yaşayan mutant N4
- Kart kaynağı belleğine işlem içinde de yazılması (`plans.mjs:1662` `!store.inTransaction` koşulunun kalkması) hiçbir testi kırmıyor.
- **Öneri:** geri alınan satış + kart işleminden sonra kaynak belleğinin boş kaldığını denetleyen test.

### DÜŞÜK-E — eski sürüm fark fikstürü: karar dayanağı ve kapsam
- **V4 Kartı Kapat** farkı (v2.4.9 "Kapalı / 300" → "Ödendi / 0") "M1e" ile açıklanmış. M1e bunu söylemiyor; doğru dayanak S144 = C.
- **V2** farkı "S110 + S2 + S50 + KS7(a)" ile açıklanmış. Kararı açıkça veren S140 = A yazılmamış (S110 tek başına "2.4.9'daki gibi" der).
- **Fikstürün karşılaştırdığı alanlar** gecikmiş, taksit kalanı, durum, sekme, Vade Takip ve zil. Kart toplamı (Tahsil Edilen / Kalan) ve satır Ödenen'i yok. Bu yüzden S129'un v2.4.9'a göre gösterim farkı fark testinde hiç görünmüyor (ders 53 (b) sınıf eksiği).
- **Hâlâ YOK sınıflar:** karşılıksız çek / senet, Şüpheli Alacak, faturalı satış iadesi + iade geri ödemesi, Mahsup Et, Silinenler'den dönen kayıt, Tablodan Aktar kartı, kilit (yalnız P), eksik / tam ayrımı.
- **Fikstür kaynağı:** `uretim.json` "kod: v2.4.9 (ccf0b0ca)" diyor; 46 eski sınıf aynı. Üretimi yeniden koşmadım; v2.4.9 kodunu ve verisini kendi `goc` koşumda ayrıca kullandım.

---

## ORTA-1 KOMŞULARI (`betik/komsu1.mjs` → `kanit/k1-{c5b0,once,yeni}.json`, akan saat; İstanbul saat diliminde de aynı)
Tanıma kalıcı bağa dayanıyor: kartın açılış izindeki `saleMoveId`. Eski veride izdeki bir önceki satırdan çıkarılıyor. Göç yok, sadece okuma yapılıyor; yarıda kesilme ya da iki kez koşma sorunu yok.

| Kurgu | c5b0 | once | yeni |
|---|---|---|---|
| Satış düzenlendi 1.000 → 900 | gecikmiş 500 | 900 (S120) | 500 (S110-satis), Borç 500 ayrı |
| Kart sil + geri al (tutar 800) | 700 | 700 | 700 |
| İki satış + iki kart, ikinci kart 800 | 1.200 | 1.200 | 1.200 |
| Tutarı büyüt 1.200 | 409 cover-grow | 409 | 409 |
| Borçsuz satış kartı 800 | 700 | 700 | 700 |
| Taksit sil / ekle | 500 | 500 | 500 |
| Elle kart 1.000 → 800 (S133 ailesi) | 700 | 1.200 | 1.200 |

- **Satış silinip Silinenler'den geri alınınca** üç kodda da aynı sonuç: gecikmiş 1.500, taksitler [500, 0]. Kapsam dışı gözlem; bu farktan değil.
- **Eski veri, iz sırası:** v2.0.13, v2.1.0 ve v2.4.9 kaynağında `stock.out` izi `plan.created`'dan hemen önce yazılıyor.
- **Yedekten geri yükleme:** şirket örneği kapatılıp yeniden açılıyor (company-backups.mjs:694). Kodu okudum; ayrıca koşmadım.

## GEÇERSİZ KILMA TABLOSU (bu farkın yeni bellekleri)
Takvim gövdesi belleği (`dues.mjs bodyOf`) hesap belleğinin sonuç nesnesine bağlı; yeni bir geçersiz kılma koşulu eklemiyor. Kart kaynağı belleği hiç düşmüyor, ama kaynak değişmez (kart kimliği rastgele).
Betik `betik/bayat2.mjs`: her adımdan sonra takvim sürümü (= içerik) yönetici + personel için okunuyor, sonra sunucu kapatılıp aynı veriyle yeniden açılıyor (baştan kurulan) ve karşılaştırılıyor.

| Yazım | Düşüren | Durağan saat | Akan saat | a1e21511^1 |
|---|---|---|---|---|
| bağsız tahsilat | sonuç nesnesi | eşit | eşit | eşit |
| kart tutarı 1.000 → 800 | plan izi (MAX updated_at) | **farklı** | eşit | farklı (aynı) |
| gün dönümü +3 | gün | eşit | eşit | eşit |
| kilit koy / kaldır | — | eşit | eşit | eşit |
| Ödeme Sözü | hareket izi | eşit | eşit | eşit |
| sil / Silinenler'den geri al | sayı | eşit | eşit | eşit |
| süreç dışı yazım (fatura vadesi) | — | **farklı** | **farklı** | farklı (aynı) |
| tahsilat sil; kart tahsilatı düzelt | sayı / an | eşit | eşit | eşit |
| iki yetki | görünürlük anahtarı | personelin takviminde fatura 0, gövdeler ayrı | — | — |

- İki "farklı" satır bu farktan değil, önceden de öyleydi. Durağan saatteki fark ders 14 gereği gerçek kurulumda yok. Süreç dışı yazımda takvim belleği `data_version`'a bakmıyor.
- **Excel toplu yükleme:** gövdem 400 aldı; DENENMEDİ.
- **Şirket değişimi:** yalnız kodu okudum.

## ZİL OKUMASI (`betik/zil-ekran.mjs`, `betik/zorla.sh`)
- **Ekrandan yazım:** cari kartından "+ Tahsilat" ya da "Borç Yaz"; gerçek tıklama, insan hızı, Tab; ardından zil hemen açıldı. 4 / 4 denemede ilk açılışta güncel; ilk açılış kayıttan 0,86–1,58 sn sonra (yeni), 0,75–0,80 sn sonra (once). Ürün davranışı değişmemiş.
- **Zorlama** (takvim yanıtı 6 sn bekletildi):
  - Yeni yardımcı: 51 geçti, 0 kaldı; 12 "bekletildi" satırı, yani ön koşul oluştu.
  - Önce kopyası, ESKİ test + eski yardımcı: 35 geçti, 5 kaldı ("zilde: []" ×4; E5'te "1. taksit 500" — ekrandan 200 tahsilattan sonra bile bayat); 9 "bekletildi" satırı.
- **Değerlendirme:** yardımcı bayatlığı 45 sn'ye kadar tolere ediyor ve beklediği süreyi yazmıyor (ders 34). Takvim yanıtı yavaşsa zil panelinin bayat göstermesi ürün davranışı ve önceden de vardı.
- **Öneri:** yardımcı bekleme süresini yazsın, 5 sn'yi aşarsa uyarsın.

## İNTEGRITY / KİLİT
Değişiklik yalnız `ownPaid ?? paid` ile kartın kendi hesabını okumak. karar3 (kilitli / kilitsiz D1, D2) ve karar1 türü örnekler ^1 ile aynı; Mutabakat Testi her koşuda "tamam".

## TEST GEVŞETMELERİ VE MUTANTLAR
- **Beklentisi değişen testler** (banka-230-k8, bulgu-223, tablodan-aktar-244, tyk-api, tyk-tur2a / 2b2, tyk-son, iade-210, ux18, guvenilirlik dökümü): `totals.*` alanı `own*` alanına taşınmış. Gösterilen sayı ayrı denetleniyor. `skip` / `todo` yok.
- **raporlar-209 ve senaryo-raporlar:** Geciken 1.000 → 300. Dayanak S129 + S50 (alınan senet bağsız para).
- **Motordaki "Taksit Kartları Ödenen" denetimi:** artık "rapor = liste" (program ↔ program) ve "kendi = model". Raporun gösterilen sayısı bağımsız modelle karşılaştırılmıyor; bilinçli bir gevşetme.
- **Mutantlar** (taban: 369 test, 368 geçti, 0 kaldı, 70 sn):
  - Önceki yaşayanlar: K3, K5, K6, K8, K22, K24, K25, K28, K35 öldü. K1 yaşıyor.
  - Yeni 14 mutantın 13'ü öldü: N1, N2, N3, N5, N6, N7, N8, N9, N10, N11, N12, N13, N14. N4 yaşıyor (DÜŞÜK-D).

## ÖLÇÜM
**ÖLÇÜLEMEDİ.** Özel ölçüm kilidi 05:49, 05:50 ve 05:51'de (UTC) doluydu; makinede başka bir tam test koşusu paylaşımlı kilidi tutuyordu. Yük 1,45–2,48. Bekleme döngüsü kurmadım. Betik hazır: `betik/olc-soguk.sh` (c5b0 / once / yeni; kod kopyaları silindi, yeniden `git archive` gerekir).

## BAŞ MİMAR YORUMUNUN DEĞERLENDİRMESİ (12.11 17:51, tek düzeltme turunun kapsamı)
Beş maddenin hepsi karar metinleriyle uyumlu ve uygulanmış. Eksik kalanlar:
- (2) "yakınsayana kadar" büyük caride sınırlandı (ORTA-B adayı).
- (3) S129 için verilen alan / yer listesi, kaydın detay kartını içermiyordu (ORTA-A).
- Kaynak bilgisi bir şema alanında değil, denetim izinde. Devir veya kesim yeni bir veri dosyası açarsa kart kaynağı taşınmayabilir (Ç5-A / D3–D6 için not).

## KULLANICIYA SORULMALI
**SORU-1 (S129 × iade; seyrek değil).** Taksit kartının "Tahsil Edilen"i faturasız stok iadesini sayar mı? Örnek: Borç 500 + satış kartı 1.000 + faturasız iade 300. Her iki okumada bakiye 1.200 ve Kalan 700 aynı; değişen yalnız Tahsil Edilen.
- A: Sayar (program bugün: Tahsil Edilen 300; iade bağsız ödeme sayılıyor — KS7 a).
- B: Saymaz (Tahsil Edilen 0, satır Ödenen boş, Kalan yine 700).
- C: Böyle kalsın (BİLİNEN SINIR).
- Öneri: B.

İş listesi C / D'de S129, S140 ve S144 bu durumu söylemiyor.

## DOĞRULANMADI
- ORTA-B'nin API'de yeniden üretimi (oynatıcı taksitli faturayı desteklemiyor).
- Kayıt detayından açılan Tahsilat penceresinin sayıları (ekrandan).
- K1'in eşdeğer olup olmadığı.

## DENENMEYEN
- Soğuk ölçüm (kilit doluydu).
- Excel / Sheets toplu yükleme (istek gövdem reddedildi).
- Şirket değişimi, yedekten geri yükleme (yalnız kod okuması).
- Tablodan Aktar ve Excel bakiyeli kartın ORTA-1 komşuluğu: K22 dişi ve N mutantları dışında ayrıca koşmadım.
- Gece yarısı zorlaması (gün dönümü sahte saatle denendi).
- WhatsApp metni (Ç5-C) ve mobil özetin ayrı uçtan okunması (mobil liste ucuna yönleniyor; toplamlar listeyle aynı).
- İletinin önceki sürümüyle karşılaştırması.

## BIRAKILAN KLASÖRLER
- /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap2-r4/betik (`kos.sh` ROOT'u kod kopyasından alır; kopyalar silindi: `git archive <ref> ':!docs/kanit'` + node_modules bağı)
- /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap2-r4/kanit (ham çıktılar, ekran görüntüleri `ekran-s118-*`, `zil-*`, `s129-*-dosya` PDF / Excel)
- /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap2-r4/goc (v2.4.9 ve c5b0 ile üretilmiş veriler)

Süren arka plan işim yok.
