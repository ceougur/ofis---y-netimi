# Ç5 — Açılış Düzeni ve B1 (Tek "Gecikmiş" Tanımı): Tasarım Notu (2.5.0)

Durum: TASARIM (06.11.2026, Ç5 tasarım ajanı; xhigh). KOD YOK: kod ajanı Ç3 tur 3 kapanınca bu notla başlar. Taban 06e9debf.
Kaynaklar (yalnız karar metinleri; her hedef kural kaynağıyla yazıldı): `CLAUDE.md` (anayasa, dersler 1–48, SORU DÜZENİ), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`,
`docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` (§6 Ç5, §8, §9, §13, §14), kural kitabı + EK-1 / EK-2 / EK-2B, `docs/devir/DEVIR-PLANI.md` (G0, G2, G7, G14),
`docs/erp/C2-FIS-DEFTERI-TASARIM.md` (§4, §5, §10 K6, §11), `docs/erp/C3-DONDURMA-TASARIM.md` (§4, §5, §8, §11, §13), `docs/2.5.0-IS-LISTESI.md` (A Ç5 satırı + EK'ler,
C, D: 05.11 "hepsi A", S1–S5, 21:08 S7 / S8, 21:30 (1)–(7), 06.11 S7-a … S46), kâhin README'si `test/bagimsiz/muhasebe/README.md` (yalnız README; kâhin kodu okunmadı) ve sürücünün
el sınıflaması `test/bagimsiz/muhasebe-surucu/siniflama.json` (P1, U-S2, U-M13). Kâhine uydurma YOK (ders 40): bu not kâhinin beklediğini yalnız bilgi olarak anar.

---

## 0. Özet ve paket bölme önerisi

Ç5'in iş listesindeki kapsamı (açılış düzeni + B1 + S7 ailesi + S11 / S12 ailesi + S14 / S25 / S39) TEK bir kod paketine sığmaz: dört ayrı dosya kümesine
dokunur ve üçü başka çalışan işlerle çakışır (§7). Öneri (BAŞ MİMAR KARARI GEREKİYOR — B1, §9):

| Paket | İçerik | Defter kuralı değişir mi | Dosya kümesi | Başlayabilir |
|---|---|---|---|---|
| Ç5-K (Kasa açılış kuralları) | S12, S20, S26, S40, S44, S45, Z9, R8 / EK-2B 33 | Hayır | cash-opening, routes/cash, bank/module-ref, routes/trash, integrity (uyarı) | ŞİMDİ (Ç3 tur 3 ile çakışmaz) |
| Ç5-B (B1 — Tek Yükümlülük Kuyruğu) | S1, S2, karar (1)(2)(3)(5), M1a–f, S8, S11, S18, S19, M13 kuyruğu, fatura durumu, Vade Takip, zil | Hayır (kapama ve gecikmiş türetilmiş görünümdür) | invoice-settle, routes/invoices, routes/accounts, lib/accounts, overview, dues, plans (görünüm), mobile | Ç3 tur 3 ile paralel (report-center satırı sonra) |
| Ç5-A (açılış düzeni — defter) | 519, KG-5, KG-15, KG-16, açılış evrakı, Açılış Eşleştirme Fişi, açılış sınıfı, kural sürümü, S14 / S25 / S39 (128 ↔ 120) | EVET | general-ledger, routes/ledger, ledger-snapshots (RULE_HISTORY), bank/voucher, bank/settings, integrity, migrations, routes/accounts (KG-16), admin.js | Ç3 tur 3 BİTİNCE |
| Ç5-C (WhatsApp elemesi) | S7, S7-a, S7-b, S16, S17, S22, S23, S29, S34 + ad önerisi | Hayır | whatsapp/queue, routes/whatsapp | W-3 ve WhatsApp tur 1 BİRLEŞİNCE; Ç5-B ile AYNI birleşimde (§2.12) |

Sıra: Ç5-K ‖ Ç5-B (şimdi) → Ç5-A (Ç3 tur 3 sonrası; S14 ailesi Ç5-B'nin kuyruğunu kullanır) → Ç5-C (Ç5-B ile birlikte birleşir) → Ç7a / Ç7b. İş listesindeki "Ç5 ‖ Ç7a"
dosya ayrık DEĞİLDİR (ikisi de `journal()`, `rows()`, `LEDGER_RULE_VERSION`, bank/voucher'a dokunur) → Ç7a, Ç5-A'dan SONRA ya da Ç5-B ile paralel (§7).

---

## 1. Koddan bugünkü durum (taban 06e9debf; dosya:satır)

### 1.1 Açılış nerede tanınıyor, karşı hesabı ne
| Modül | Tanıma | Yevmiye (bugün) | Yer |
|---|---|---|---|
| Kasa | `cash_entries.is_opening = 1` (işaret; göç 22) | B 100 / A 500 | general-ledger.mjs:368; lib/cash-opening.mjs:16-21 |
| Cari | AÇIKLAMADAN: `opening = note => /^açılış/i.test(…)` — `is_opening` (göç 35) defterde OKUNMUYOR | borçlu B CH / A 500, alacaklı B 500 / A CH; açılış sayılmayan Borç Yaz 602, Alacak Yaz 770 | general-ledger.mjs:235, :414-415; routes/ledger.mjs:87-94 (SELECT'te `is_opening` yok) |
| Taksit (Excel) | `plan_entries.opening = 1` (göç 14; yalnız Excel / tablo yüklemesi yazar: routes/plans.mjs:1608, çağıran yalnız :1255); kart `plans.import_id` (göç 14) | kart B CH T / A 602 (kartın Kayıt Tarihi), "Açılış (devir)" B 500 / A CH P (yükleme günü) | general-ledger.mjs:429, :444 |
| Stok | `stock_moves.is_opening = 1` (göç 29) | B 153 / A 500 (miktar × birim fiyat) | general-ledger.mjs:468; integrity.mjs:468-486 (`stock:opening` denetimi "B 153 / A 500") |
| Banka / kart / kredi | `fin_events` açılış fişi; satırlar `bank_lines`'ta HESAP KODUYLA SAKLI | 102 ↔ 500; kart / kredi 500 ↔ 309 / 300; Devir Kapanışı (`closing`) 102.00 / 108.00 ↔ 500 | bank/voucher.mjs:22-23 (`ROLE_GL.opening/closing = ["500"]`), :100-120; general-ledger.mjs:551-563 (saklanan kod aynen) |
| Çek / senet | Açılış İŞARETİ YOK. Excel "carilere dokunmadan" yüklemesi ilk olayın notuna "Açılış portföyü (Excel/Sheets)" yazar (routes/cheques.mjs:838; v2.0.13'ten beri aynı metin, git show v2.0.13 :551) | "Cariye işlenmemiş evrak": alınan B 101 / A **602**, verilen B **770** / A 103, karşılıksız (carisiz) B **770** / A 101 | routes/ledger.mjs:146-179 (`free-in` / `free-out` / `free-bounce`), :203-210 (`build()` 120/320/336 → 770 / 602) |

Ek olgular:
- Cari açılışının Türkçe büyük harf hatası (sürücü P1) koddan yeniden üretildi (node 22, bu ağaç): `/^açılış/i` → "Açılış bakiyesi" true, "AÇILIŞ" **false**, "AÇILIŞ BAKİYESİ" **false**, "Açilış" false;
  `s.toLocaleLowerCase("tr-TR").startsWith("açılış")` → üçü de true. JS'nin `i` bayrağı (u ile de) "I" ↔ "ı" katlamaz.
- Göç 35 (migrations.mjs:1353-1370) carinin AÇIKLAMASI TAM "Açılış bakiyesi" olan İLK elle Borç / Alacak satırını işaretledi; cari başına en çok bir işaret (`openingEntryOf`,
  routes/accounts.mjs:578, `LIMIT 1`). Form ve Excel cari yüklemesi işaretli yazar (routes/accounts.mjs:612, :1476). Silinenler'den dönüşte işaret yükten, yoksa 2.4.5 kuralıyla;
  carinin başka açılışı varsa İŞARETSİZ döner (routes/accounts.mjs:1900-1905).
- Sonuç (2.4.9 kuralı): (a) işaretli ama açıklaması değiştirilmiş açılış 602 / 770'e (gelir / gider) gider; (b) işaretsiz ama "Açılış…" açıklamalı satır (2.4.6'dan sonra elle girilmiş,
  ikinci açılış, Silinenler'den işaretsiz dönen) 500'e gider; (c) "AÇILIŞ…" büyük harfli satır 602 / 770'e gider.
- Açılış evrakı tanınamaz: `build()` yalnız "cariye işlenmemiş" evrakı görür (cari satırı olmayan); formdan carisiz (yalnız keşideci adıyla, routes/cheques.mjs:370) alınan çek
  de aynı kurala düşer (açılış değil ama aynı 602 / 770).
- 500'ün adı "Açılış ve Devir Bakiyeleri", MSUGT V.A (general-ledger.mjs:133); 519 Ç1'de eklendi ama hiçbir olay yazmıyor (:135). 501–503, 52x, 54x planda YOK (M-11'in hedefleri).
  Banka Ayarları sabit eşlemesi "Açılış ve Devir Bakiyeleri — 500" (bank/settings.mjs:157); fiş meta adları (bank/vouchers.mjs:997); kılavuz "açılış stoku 153'te (karşılığı açılış hesabı 500)"
  (docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html:384).
- `bank_lines` kilit izinde KODUYLA (`bank_lines_lock`: role, gl …; integrity.mjs:188-191) → saklı satırın kodunu göçle değiştirmek kilitli dönemin kaynak izini bozar.
- Modül açılışları kendi modüllerinin sınıfında (JOURNAL_CLASS cash 32, account 34, plan-entry 33, stock-open 22, bank 39; general-ledger.mjs:606-631); kitap G-4 / M-01'in
  "açılış sınıfı (günün başı)" yalnız saklanan fişlerde (`voucher-open`: 1).

### 1.2 Mutabakat ve fiş koruması
- `expected()` 500 / 519'u DENETLEMİYOR (routes/ledger.mjs:234-331). Fiş koruması K6: `subledgerAccounts()` = `expected(every)`'nin anahtarları (routes/ledger.mjs:356); 500, 519,
  5xx bu kümede değil → bugün Açılış Eşleştirme Fişi 519 / 5xx'e yazılabilir. 519 `expected()`'e eklenirse K6 eşleştirme fişini 400 ile reddeder (§2.8).

### 1.3 Kural sürümü ve donmuş dönem
- `LEDGER_RULE_VERSION = "2.5.0"` (general-ledger.mjs:20), `RULE_HISTORY = ["2.4.9", "2.5.0"]`, `GAP_RULE = RULE_249` (ledger-snapshots.mjs:29, :39); `ruleDiff()` :796.
- Kural tuzağı testi: "2.5.0 iken güncel türetme = 2.4.9 kopyası; Ç5 / Ç7 ilk kural değişikliğinde bu testi ve LEDGER_RULE_VERSION'ı bilerek değiştirir" (test/donmus-defter-250.test.mjs:404).
- Kayıt defteri testi: RULE_HISTORY'nin ilk iki öğesi ["2.4.9", "2.5.0"], son öğe = LEDGER_RULE_VERSION, SON HARİÇ her sürümün `server/lib/ledger-rule-<noktasız>/index.mjs` kopyası
  var, her kuralın bekleyen koşusu donar ve "donmuş = canlı (bugün kurallar tutarda aynı)" (test/donmus-defter-tur1-250.test.mjs:259-290). Ç5 bunu kırar → §3.

### 1.4 B1 — bugün "gecikmiş" ekranlar arasında farklı
| Yol | Bugünkü tanım | Yer |
|---|---|---|
| Cari kartı "Geciken" | YALNIZ açık taksit kartlarının vadesi geçmiş taksitleri | lib/accounts.mjs:127-128 (`plan.totals.overdue`), :143 |
| Cari listesi + "Geciken taksiti olan" süzgeci | aynı (taksit) | routes/accounts.mjs:290-315; süzgeç adı overview.mjs:278, report-center.mjs:61 |
| Anlık Durum | `accounts().list().totals.overdue` (taksit) | overview.mjs:165-175 |
| WhatsApp Ödeme Hatırlatma (önizleme / açma / gönderim anı) | `account.totals.overdue` > 0 (taksit); {{3}} en eski gecikmiş TAKSİT vadesi | lib/whatsapp/queue.mjs:140-145, :524, :1393, :1411; waFacts routes/accounts.mjs:212; elle toplu routes/whatsapp.mjs:137 |
| Vade Takip, zil, takvim, nakit akışı | birleşik liste: taksit (plans.dueItems), vadeli / sözlü elle borç (accounts.openDueItems — Beklenen Ödeme Tarihi varsa O tarih), fatura (invoices.dueItems), çek, planlı banka | accounts.mjs:1800-1847; overview.mjs:365-400, :640; dues.mjs:47-108 |
| Fatura durumu ("Vadesi Geçti", Kalan) | `settleLedger`: bağlı ödeme önce, kalan bağsız ödemeler EN ESKİ BELGEDEN, HAVUZ (ödeme tarihine bakmadan); ayrı borç yazan kart "kendi defteri" (kuyruğa girmez); Mevcut Borç kartı EN YENİ borçtan kapsar; karşılıksız evrakın kapattığı fatura kendi tarihiyle yeniden açılır (UX18); karşı yönlü fatura yalnız Mahsup Et | invoice-settle.mjs:1-50, :176-260; CLOSER_MODES "Otomatik (en eski)" :74 |
| Mobil özet | `side=overdue` süzgeci (aynı liste) | lib/mobile.mjs:31 |
Şüpheli alacak (S7) hiçbir eleme yolunda YOK ("Şüpheli Alacağı Var" metni kodda yok). `list()` mutabakat kapısında da çağrılır (routes/ledger.mjs:240 `accounts().list`) → TYK `list()`'in
içine konursa HER para yazımının kapısı yavaşlar (§6).

### 1.5 Şüpheli caride alacak satırı (defter)
`doubtfulSkipOf` (lib/doubtful-gl.mjs:30-31): YALNIZ tahsilat (`kind === "in"`) ve (işaret ∨ fatura peşini ∨ Kapatılacak Fatura bağı) → 120'de kalır; öbür alacaklar (faturaya bağlı
alınan EVRAK dahil) en eski kayıttan 128'den düşer. Faturanın şüpheliye aktarılıp aktarılmadığına bakılmaz (S14 / S25 / S39 bunu değiştirir; sürücü R4-SUPHELI-EVRAK-FATURA-BAGI).

### 1.6 Kasa açılışı
Kural (cash-opening.mjs:1-11, routes/cash.mjs:261-269): yalnız yönetici; bir kez (409 cash-opening-exists); tarih ilk nakit hareketinden sonra olamaz (409 cash-opening-after-first).
Açılıştan ÖNCE tarihli yeni nakit hareketi bugün KABUL (S12 yok). Banka karşılığı: module-ref.mjs:76 / vouchers.mjs:250 / accounts.mjs:1038 "bank-before-opening".

### 1.7 Ölçüm (bugünkü yollar; ders 47 — Ç5-B'nin tabanı)
Veri: programın kendi ürettiği `scratchpad/c3-olcum-veri/n-100000` (Ç3 ölçüm verisi, kapi-olcum aracıyla mutabakat motorundan büyütülmüş; 001: 1.484 cari, 102.820 cari satırı,
34.026 fatura, 13.992 kart, 80.136 stok hareketi; şema 47) — KOPYASI `scratchpad/c5t-olcum/n-100000`'de açıldı (ders 25). Komut:
`HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=<…> flock scratchpad/olcum.lock node scratchpad/c5t-olcum/olc.mjs <bu ağaç> <kopya> 3`; createApp aynı süreçte, `monitorEventLoopDelay`
(5 ms) ile istek başına olay döngüsü en çok. Makine yükü YÜKSEK (başka ajanlar): koşu 1 load 4,7→5,8; koşu 2 load 7,8→8,6 → sayılar üst sınırdır, karşılaştırma değil.
| Yol | Koşu 1 (TZ İstanbul) ilk / medyan · döngü | Koşu 2 (TZ UTC) ilk / medyan · döngü |
|---|---|---|
| Cari kartı (en kalabalık cari, 129 satır) | — | 348 / 348 ms · 343 ms |
| Cari listesi (bütün cariler) | 982 / 982 ms · 1.027 ms | 929 / 1.203 ms · 1.313 ms |
| Anlık Durum | 8.359 / 105 ms · 8.355 ms (ilk istek önbellek kurar) | 8.986 / 107 ms · 8.976 ms |
| Vade Takip | 1.774 / 1.774 ms · 1.762 ms | 2.729 / 2.367 ms · 2.340 ms |
| Elle toplu WhatsApp alıcıları (waFacts × 1.484) | 4.212 / 4.001 ms · 4.198 ms | 5.766 / 4.981 ms · 5.759 ms |
| Ana Defter (mizan + mutabakat, `build()`) | 4.321 / 4.321 ms · 4.320 ms | 5.804 / 4.724 ms · 5.801 ms |
| Fatura listesi (kapama durumları) | 4.954 / 769 ms · ölçülemedi (0) | 6.337 / 1.021 ms · ölçülemedi (0) |
Ham çıktı: `scratchpad/c5t-olcum/olc-1.txt`, `olc-2.txt`. 1.000.000 satır ÖLÇÜLMEDİ. Yorum: bütün cariler için kapama (`allSettled`) soğuk kurulumu ana iş parçacığında saniyeler
sürüyor (Anlık Durum ilk isteği ~8 sn olay döngüsü) — B1'in "her cari için gecikmiş" ihtiyacı bunun üstüne kurulursa ders 47 ihlali büyür (§6).

---

## 2. Hedef kurallar (her biri kaynağıyla; karar metni çözmüyorsa §8 / §9)

### 2.1 Hesap planı
- 519 "Eşleştirilecek Açılış Bakiyeleri" (KG-1 A; EK-2 39: ad "(Geçici)"siz; Bilanço satırı V.G "(Geçici)"lı) — zaten var.
- 500'ün adı Tek Düzen adıyla "Sermaye" (kitap §2 "500 Sermaye … yalnız eşleştirme fişiyle"; iş listesi E 05.11 RİSKLER "500 adı … açılışlar Ç5'te 519'a geçene kadar"). Ad değişikliği
  kural değildir (C3 §5) ama Bilanço V.A'nın anlamı değişir → Ç6'dan önce.
- EKLENECEK (M-11 hedefleri; çekirdek §13 "500–503, 52x, 54x, 570, 580, 590 / 591"): 501 Ödenmemiş Sermaye (−), 502 Sermaye Düzeltmesi Olumlu Farkları, 503 Sermaye Düzeltmesi
  Olumsuz Farkları (−), 520–529 ve 540–549 (Tek Düzen adlarıyla) — sınıflama mali müşavir A'da doğrulanır; kesin liste ve MSUGT kalemleri (V.A / V.B / V.C) Ç1'in denetim testine
  girer (`test/hesap-plani-sinif-250.test.mjs`).

### 2.2 Modül açılışlarının karşı hesabı 519 (30.10 (2); kitap 3-M; S4)
| Olay | Hedef madde | Kaynak |
|---|---|---|
| Kasa açılışı (işaretli) | B 100 / A 519 | M-01 |
| Cari açılışı (`is_opening = 1` ya da KG-16 onaylı) | borçlu B CH / A 519; alacaklı B 519 / A CH | M-02, M-03; KG-16 |
| Banka hesabı açılışı | B 102.NN / A 519 (KMH ters) | M-04 |
| Şirket kartı / kredi açılış borcu | B 519 / A 309.NN · 300.NN | M-05, M-06 |
| Devir Kapanışı (Hesabı Atanmamış 102.00 / 108.00'ın açılış öncesi bakiyesi; `closing` rolü) | 500 yerine 519 | K-14 (sonucu), plan §6 "ROLE_GL opening / closing" |
| Stok açılışı | B 153 / A 519 | M-07 |
| Açılış evrakı (Excel "Açılış portföyü") — alınan / verilen | B 101.0x / 121.0x / A 519 · B 519 / A 103 / 321 | M-08, M-09; 30.10 (1) |
| Excel / tablo taksit kartı (T toplam, P önceden ödenen) | TEK madde B CH (T − P) / A 519; P maddesiz; tarih = yükleme açılış tarihi | KG-5 A (05.11 "hepsi A"); H-06 |
- Banka: saklı kod DEĞİŞMEZ (bank_lines "500" kalır; `ROLE_GL` değişmez) — `opening` / `closing` rolü TÜRETMEDE 519'a okunur (§9 B3). Aynı yardımcı (ör. `effectiveGl(line)`)
  İşlem Kartı / Banka Fişi görünümü, Alt Hesap Mizanı (Banka) ve Banka Ayarları'nın sabit eşleme satırı tarafından da okunur (ders 10: aynı kodun BÜTÜN okuyanları).
- KG-5 madde tarihi: kitap H-06 "yükleme açılış tarihi" (önceden yazılmış metin) — kartın `plan_entries.opening` satırlarının tarihi; P = 0 kartta bu satır yok → §9 B5.
- Ç7a / Ç7b'ye kalan aynı satırlar: taksit kartı "Yeni Borç" (H-03) 602 → 600.90 (KG-2, Ç7b); Kartı Kapat 689 (karar (6), Ç7b); Borç Yaz / Alacak Yaz .90 alt hesabı (KG-4, Ç7b);
  "Hesapsız (Açılıştan Önce)" hareketin 102.00 ara adımı (K-14 tarihi, Ç7a). Ç5-A bu satırlarda yalnız 500 → 519'a ve açılış tanımasına dokunur.

### 2.3 Açılış işaretten tanınır, açıklamadan değil (plan §6; DEVIR-PLANI G0)
- Cari: `rows()` `e.is_opening`'i okur; `journal()` `opening(note)` yerine `row.isOpening === 1 || KG-16 onaylı`. Açıklama yalnız gösterimdir. Taksit, Kasa, stok zaten işaretten.
- Açılış evrakı: bkz. §2.5 ve §9 B4 (işaret sütunu mu, olay notu mu).

### 2.4 KG-16 "Açılış Olabilir" listesi (05.11 "hepsi A"; iş listesi A Ç5 EK sürücü)
- Göç (GÖÇ GEREKİR; numarayı ana oturum verir): `account_entries` (source '', kind debt / credit, `is_opening = 0`) içinden açıklaması — baştaki boşluk atılıp `toLocaleLowerCase("tr-TR")`
  ve harf katlama (ç→c, ı/i→i, ş→s) sonrası — "acilis" ile başlayan HER satır ADAY işaretini alır. Böylece "AÇILIŞ", "Açilış", "Acilis" ve ikinci "Açılış bakiyesi" de listeye girer
  (P1). Katlamanın genişliği: §9 B6.
- Kullanıcı onaylarsa M-02 / M-03 (519), reddederse C-01 / C-02 (bugünkü Borç Yaz / Alacak Yaz kuralı; .90 alt hesabı Ç7b'de). Onay BEKLERKEN hangi hesap: KULLANICIYA SORULMALI §8 S-Ç5-1.
- Onay / ret satırın tutarını, tarihini, yönünü DEĞİŞTİRMEZ; `is_opening` (Açılış Bakiyesi formunun satırı, cari başına bir) ile KARIŞMAZ → ayrı sütun (§9 B7).
- Liste göç anına bağlıdır ("göçte"): göçten sonra elle girilen "Açılış…" açıklamalı Borç Yaz aday OLMAZ (sıradan Borç Yaz). İki istisna sorusu: Silinenler'den / yedekten dönen eski satır
  (§8 S-Ç5-5, §9 B8).

### 2.5 Açılış evrakı ve karşılıksız açılış çeki
- Excel "Açılış portföyü" (ilk olay notu ya da yeni işaret): alınan B 101.01 (121.01) / A 519; verilen B 519 / A 103 (321). 602 / 770'e YAZILMAZ (M-08, M-09; 30.10 (1)).
- Cariye işlenmemiş açılış evrakı karşılıksız / iade dönerse (bugün B 770 / A 101, müşteriye borç yok): karar metni yok → §8 S-Ç5-2.
- Formdan carisiz alınan / verilen evrak (açılış DEĞİL): bugün 602 / 770; 30.10 kararı yalnız "açılış çekleri" der → §8 S-Ç5-3.
- Carili Excel portföyü ("carilere dokunmadan", keşideci adı tek cariyle eşleşmiş) karşılıksız dönünce carinin borç satırı yazılır (`hasDebt`; routes/ledger.mjs:154-156): Ç5'te
  B CH / A 101 (Ç-07) — açılış evrakı 519'da, karşılıksız cari alacağı doğurur; net B CH / A 519 (açılıştaki alacak cariye geçer). Yeni kural yok.

### 2.6 Açılış sınıfı (kitap G-4, M-01 "açılış sınıfı, günün başı")
Bütün modül açılış maddeleri (Kasa, cari, banka açılış / Devir Kapanışı, stok, açılış evrakı, KG-5 kartı) aynı gün olağan maddelerden ÖNCE: `JOURNAL_CLASS`'ta açılış sınıfı.
Madde KİMLİĞİ DEĞİŞMEZ (`cash:<id>`, `account:<id>` … donmuş satırlar, ruleDiff ve kapının `account:` sahip eşlemesi kimliğe bağlı) → maddeye sınıf alanı, `journalOrder` önce onu okur
(§9 B9). Yalnız gösterim sırası: bakiye, mizan, şüpheli ayırması değişmez (journalOrder yorumu general-ledger.mjs:592-605).

### 2.7 Açılış Eşleştirme Fişi (M-11; plan §6; C2 §11 "M-11 kısıtları Ç5'in denetimi")
- Ç2 `vouchers.post({ type: "opening-match", … })`; sınıf açılış; yetki `system.manage` (Ç2 fiş yetkisi; Muhasebe 403 — plan §13 2.5.1 GÖRÜŞ).
- Satırlar: bir yanda 519, öbür yanda hedefler 500–503, 520–549, 570, 580, 590, 591 "ve gerekirse öteki bilanço hesapları" — alt defter hesapları HARİÇ (K6: `subledgerAccounts()`; 100, 102, 120 …
  fişle yazılmaz). Kâhin red kodları: ESLESTIRME_HESAP (izinsiz hesap), ESLESTIRME_TERS (519 ters bakiyeye geçer).
- Tutar: Σ hedef = 519'un fiş tarihi GÜN SONU bakiyesi ya da bir kısmı; 519'u ters bakiyeye geçiremez (aynı gün açılışları dahil). Birden çok kez yapılabilir; kilitli tarihe 409 (Ç2 §5);
  ters kaydı Ç2 HTTP ucuyla (R-03). Fişten SONRA açık dönemde bir açılış silinir / değişirse 519 ters bakiyeye düşebilir → engellenmez, Bilanço "Kesin Değil — Tamamlanmamış Açılış /
  Ters Bakiye 519" (Ç6) + Defter Mutabakatı bilgi satırı.
- Ekran: Yönetim → Dönem Kilidi'nin yanında "Açılış Eşleştirme" (519 bakiyesi, açılış türlerine göre dökümü, hedef satırları, ön izleme, kaydet). Yer: §9 B10.
- Devir (D3–D4, Ç5'te DEĞİL): devir açılış fişi (N-13) 519'u arşivin kapanış bilançosuyla kendiliğinden eşleştirir (S4); arşivde eşleştirilmemiş 519 aynen taşınır (plan §6). Ç5 bunun
  için yalnız 519'u tutarlı türetir ve eşleştirme denetimini ortak işleve koyar (D4 aynı denetimle).

### 2.8 519 ve 500 mutabakatı (plan §6 "500 artık mutabakatta denetlenir")
İkinci yükleyici (SQL, modüllerin kendi tablolarından): 519 = −(Σ modül açılışları: Kasa işaretli, cari işaretli + KG-16 onaylı, banka açılış / kapanış satırları, KG-5 kartları (T − P),
stok açılış değeri, açılış evrakı) + Σ fiş satırlarının 519'u; 500 = Σ fiş satırlarının 500'ü. Biçim (`expected()`'e mi, ayrı denetime mi): §9 B2 — `expected()`'e girerse K6 eşleştirme
fişini reddeder ve Kural Farkı Düzeltme Fişi canlı mutabakatı kırar (§3.4). `stock:opening` denetimi (integrity.mjs:468-486) "B 153 / A 519" olur.

### 2.9 Kasa açılış kuralları — Ç5-K (S12, S20, S26, S40, S44, S45, Z9; EK-2B 33)
- S12 = A: Kasa açılışından ÖNCE tarihli yeni nakit hareketi 409 (kod önerisi `cash-before-opening`; kâhin KASA_ACILIS_ONCE). Kapsam (kâhin yorumu T9, karar metniyle uyumlu): 100'e yazan
  HER kaynak — Kasa Giriş / Çıkış, nakit tahsilat / ödeme (taksit dahil), kayıt tahsilatı, Bankadan Kasaya / Kasadan Bankaya, çekin Kasa'dan tahsili, verilen evrakın nakit ödemesi, nakit vergi
  ödemesi, Kasa'ya yansıyan stok, nakit iadeli satış iadesi. Aynı gün OLUR (açılış günün başı). Açılış yoksa kural yok. Tek yer: nakit yolunun ortak denetimi (para satırı yazan her yol
  bank.post / module-ref'ten geçer — K6 statik testi; bank-before-opening'in ikizi). Düzeltmede (T12 türetmesi) de red → §9 B11 değerlendirme.
- S20 = A: geri yüklenen yedekte / eski sürüm verisinde açılıştan önceki nakit satırı AYNEN gelir; Mutabakat Testi uyarı (yeni denetim "Kasa Açılışından Önce Tarihli Hareket", düzey uyarı).
- S26 / S40 / S44 = A: böyle bir kaydın tarihi değişmeden tutarı, açıklaması, carisi, fatura / taksit bağı, "Normal Cari Hesaba İşle" seçimi düzeltilebilir; uyarı sürer. Z9 (BAŞ MİMAR
  KARARI 07:59): Silinenler'den geri alınan da aynı. S45 = A: Kapatılacak Fatura ya da taksit kartıyla bağlıysa carisinin düzeltilmesi "önce bağı kaldırın" ile red.
- R8 / EK-2B 33: Kasa açılışı ilk nakit hareketinden sonraya DÜZELTMEDE de 409 — bugün düzeltme yolunda `openingAfter` koşuluyla çağrılıyor (routes/cash.mjs:533; giriş :319, :350);
  kod ajanı koşulun bütün düzeltme biçimlerini (tarih, tutar, Kasa ↔ açılış dönüşümü) kapsadığını doğrular.

### 2.10 B1 — tek "gecikmiş" tanımı: Tek Yükümlülük Kuyruğu (TYK) — Ç5-B
Tek saf modül (öneri `server/lib/obligation-queue.mjs`; `invoice-settle.mjs`'in dağıtımının YERİNE, sınıflaması `classifyLine` aynen) — bir carinin satırlarından kuyruk, açık kalemler,
fatura durumu, gecikmiş(t), şüpheli kuyruğu. Kurallar (yalnız karar metninden):
1. Kapsam (M1a BAŞ MİMAR KARARI, gösterildi): açılış, fatura kalanı, Borç Yaz, karşılıksız evrak, müşteriye para iadesi, devir açık kalemi (D4), taksit kartı taksitleri TEK kuyrukta.
   Bugünkü "ayrı borç yazan kart kendi defteridir" (invoice-settle.mjs:25-27) KALKAR → §8 S-Ç5-4 (kör nokta).
2. Taksit kartı (M1e, H-01/H-02/H-03, KG-5): kart açıldığı gün alttaki kalemi TÜKETİR, kuyruğa yalnız taksitler girer; Mevcut Borç kartı tüketimi S2 sırasıyla (bugün EN YENİ borçtan →
   DEĞİŞİR). Kart küçülmesi (karar (4)) ve Kartı Kapat kalanı (karar (6), M1d) Ç7b'de — TYK arayüzü kalanı "kapatma tarihli tek kalem" olarak almaya hazır olur; 2.5.0'dan ÖNCE
   kapatılmış kartın kalanı kuyrukta borç DEĞİLDİR (karar (6) "önceden kapatılmış kartlar olduğu gibi kalır") → Ç7b'nin işareti.
3. Bağlar önce + karar (2): bağ (peşin, Kapatılacak Fatura, Mahsup Et, çek / senet bağı, kart tahsilatı, iade → asıl fatura) hedefini her durumda kapatır; hedefi önceden kapatmış bağsız ödeme
   serbest kalır ve KENDİ tarihinde yeniden dağılır. Karar (3): kilitli / devredilmiş dönemde bağsız kapanmış kalem kilit sonrası bağla yeniden açılmaz; bağ bağsız gibi dağılır, program
   kayıtta yazar (iş listesi E: "Kilit iletisi (S11 sunumu) → baş mimar, Ç5'te" → §9 B12).
4. Bağsız ödeme karar (1) + S2: KENDİ tarihinde (o gün dahil) açık borçlara, sıra vade ↑ → belge tarihi ↑ → giriş sırası (ders 31); aynı gün önce borç kalemleri; sonradan doğan borca kaymaz,
   kapanmış kalem yeniden açılmaz. Bugünkü "en eski belgeden, havuz" DEĞİŞİR (sürücü U-S2-ACIK-FATURA). CLOSER_MODES "Otomatik (en eski)" → "Otomatik (vadesi en önce gelen)".
5. Vade (S1 A, M1b): vadesiz kalemin vadesi belge / işlem günü → ERTESİ GÜN gecikmiş; M1f: gecikmiş ⇔ vade < bugün (vade günü gecikmiş değil), tatil kaydırması YOK; "bugün" = yerel
   tarih + sahte saat (`config.now`). Ekran (M1b TEKNİK): fatura / Borç Yaz formunda Vade boşsa "Peşin (Belge Tarihi)". Ödeme Sözü (Beklenen Ödeme Tarihi) ↔ gecikmiş → §8 S-Ç5-6.
6. Karşılıksız (S8 = A, UX18 aynen): evrakın kapattığı fatura yeniden açılır, KENDİ vadesine kadar gecikmez; vadesizde karşılıksız günü gecikmiştir. S11 / S18 / S19 = A: kilitli dönemde
   kapanmış kalem kilit sonrası karşılıksızla yeniden açılmaz; karşılıksız tutar (avans evrakta TAMAMI) ayrı borç kalemi (vade = karşılıksız günü); karar karşılıksızın yazıldığı andaki kilide
   göre BİR KEZ verilir (kilit sonradan ilerlerse değişmez → yazım anındaki kilit SAKLANIR: kayda "L" damgası; §9 B12; iş listesi "S19'da R3 bağ üzerinden okunuyor (Y12) — Ç5'te").
   S24 (devir) D4'ün işi.
7. Netleşme (karar (5) "Bakiyeden Netleşsin"): alış faturası / Alacak Yaz satış borcuna kendi tarihinde uygulanır; gecikmiş ≤ net borç; bize alacaklı kişiye hatırlatma gitmez. FATURA DURUMU
   (Açık / Ödendi) ayrı görünüm: karşı yönlü iki fatura birbirini yalnız Mahsup Et ile kapatır (kâhin R5). Eleme adı "Net Borcu Yok" önerisi → §9 B13.
8. Şüpheli (M13, S3 / S7 = A): J-01 açık borç kalemlerini S2 sırasıyla şüpheli kuyruğuna taşır (fatura "Şüpheli Alacakta"), J-06 kendi vadeleriyle döndürür; şüpheli tutar ayrı alan,
   otomatik hatırlatmaya girmez (cari bazında, S7 / EK-2 29).
9. Değişmezler (EK-1 §4): 0 ≤ gecikmiş ≤ max(0, CH); Σ açık borç − Σ açık alacak = CH bakiyesi (128 hariç; şüpheli kuyruğu = 128); kart ile alttaki borç birlikte sayılmaz; cari kartı = cari
   listesi = Anlık Durum = WhatsApp seçimi = Vade Takip tutarı (çekirdek §9.11).
KULLANAN YOLLAR (hepsi BİRLİKTE değişir, ders 10): cari kartı "Geciken" (adı "Gecikmiş Borç"; taksit sayısı yerine kalem sayısı), cari listesi + süzgeç ("Gecikmiş Borcu Olan";
overview.mjs:278, report-center.mjs:61 — report-center Ç3 tur 3'ün dosyası, §7), Anlık Durum, mobil özet süzgeci, WhatsApp (Ç5-C), Vade Takip / zil / takvim / nakit akışı (cari
kalemleri TYK'dan TEK kaynak — bugünkü üç kaynak (plans.dueItems + accounts.openDueItems + invoices.dueItems) birleşik listede aynı borcu bir kez göstermeli; Mevcut Borç kartının
"covered" kuralı TYK'nın tüketmesiyle aynı), fatura listesi / kartı (durum, Kalan, "Vadesi Geçti", Kapatanlar), cari kartı elle borç "Kalan", cari ekstresi PDF / Excel, Kapatılacak Fatura
önerisi, Devir (D4 açık kalemleri M2 ile buradan). Mutabakat kapısının `list()` çağrısı TYK HESAPLAMAZ (bayrak; §6).

### 2.11 Şüpheli ↔ TYK defter kuralı — Ç5-A (S14, S25, S39 = A; DEFTER DEĞİŞİR)
Şüpheli kaydı açık caride faturaya BAĞLI alacak (alınan çek / senet S14, nakit / havale / POS S25 (c), Kredi Kartına İade S39): faturanın şüpheli kuyruğundaki kısmı 128'den (o kalemi
taşıyan kayıttan), kalanı 120; kısmen aktarılmış faturada ÖNCE şüpheli kısım (S25 (a)); faturanın açık kısmını aşan fazla carinin bağsız alacağı (120, sınırsız; S25 (b)). Bugünkü
`doubtfulSkipOf` (bağ = her zaman 120; evrak = her zaman 128) değişir → defterin 120 / 128 ayrımı TYK'nın M13 dağılımına bağlanır (yalnız şüpheli kaydı olan cariler için kuyruk kurulur;
ikinci yükleyici `lib/bank/doubtful.mjs doubtfulCredits` aynı kuralla). Kural sürümüne girer (§3); kilitli dönemdeki 120 ↔ 128 farkı fişle düzeltilemez → §9 B14.

### 2.12 WhatsApp Ödeme Hatırlatma elemesi — Ç5-C ("kime kaç kez", ders 45; WK kâhini önce)
Otomatik seçim: TYK gecikmiş > 0, şüpheli kaydı açık cari HARİÇ ("Şüpheli Alacağı Var" etiketiyle görünür; S7). Elle seçilen şüpheli caride iletide ŞÜPHESİZ gecikmiş, şüpheli kalemler hariç
net borçla sınırlı (S17); şüphesiz gecikmiş yoksa "Gecikmiş Borç Yok" (S7-a). Kuyruktayken kayıt açılan, elle seçilmemiş cari gönderim anında "Atlandı — Şüpheli Alacağı Var" (S7-b; S22 —
Yine de Gönder'den sonra açılsa da). Sonucu Belirsiz işte Yine de Gönder elle seçim sayılır, şüphesiz tutarla (S16); kayıt açıkken yeniden basış bekleyen işi elle sayar, yeni iş açılmaz (S23);
şüphesiz tutar gönderim anına kadar doğarsa gönderim anındaki tutar (S29, S34). {{3}} = en eski gecikmiş AÇIK KALEM vadesi (taksit değil), {{4}} = (şüphesiz) gecikmiş, {{5}} = bakiye.
BİRLEŞİM KURALI: Ç5-B `totals.overdue`'nun anlamını değiştirir; WhatsApp bu alanı okur (queue.mjs:141) → Ç5-B, Ç5-C olmadan ana dala girerse şüpheli cariye ve faturası gecikmiş herkese
hatırlatma açılır (S7 ihlali). Ya ikisi aynı birleşimde ya Ç5-B eski alanı (`overdueInstallments`) korur ve WhatsApp Ç5-C'ye kadar onu okur (§9 B1).

---

## 3. Kural sürümü, donmuş dönem ve Kural Farkı Düzeltme Fişi

3.1 Ç5-A defter kuralını değiştirir (500 → 519, açılış tanıma, KG-5, açılış evrakı, 128 ↔ 120). Kilitli dönem Ç3 sayesinde DEĞİŞMEZ: göç 47'nin donmuş satırları 2.4.9 kuralıyladır;
2.5.0 ile konmuş kilit o anın güncel kuralıyla donmuştur. Kural değişince `ledger:rule-diff` "Kural Değişikliği Farkı" uyarısı (C3 §8) görünür; sessiz değişiklik yok.

3.2 ETİKET (C3 §5 "Ç5 / Ç7 her türetme değişikliğinde yükseltir" + "önceki güncel kural AYNEN kopyalanır"): bugünkü "2.5.0" kuralı = 2.4.9 kopyası + saklanan fiş (kural tuzağı testi bunu
tutarda kanıtlar). Seçenekler ve öneri: §9 B15. Hangisi seçilirse: kural tuzağı testi BİLEREK değişir ("güncel ≠ 2.4.9; fark yalnız Ç5 kural kimliklerinde": P1, KG-5, M-08/09, 519, S14);
kayıt defteri testinin "donmuş = canlı" satırı eski kurallar için "donmuş = o kuralın türetmesi" olur; GAP_RULE 2.4.9 kalır (S13); 2.4.9 kopyasının sha256'sı değişmez.

3.3 KURAL FARKI DÜZELTME FİŞİ (KG-15 A; EK-1 M7; C3 §11 `ruleDiff()`):
- Tarih = kilit + 1 (ilk açık gün); sınıf olağan; tür `rule-diff-correction`; ön izleme + onay; yetki `system.manage`. Kilit bugünse tarih yarın → 400 date-future (C2 §11) → düğme pasif +
  nedeni ("Kilit bugünün tarihinde; düzeltme fişi yarın yazılabilir").
- Satırlar `ruleDiff()`'ten: BİLANÇO hesapları (1–5 sınıfı) kilit günü SONUNDAKİ BİRİKİMLİ farkla (yıl yıl değil — örn. KG-5 kartında CH farkı 2024'te +T, 2025'te −T, birikimde 0 → satır yok);
  SONUÇ hesapları (6 / 7) yıl yıl: farkın yılı = fişin yılı → eski kuralın hesabının tersi (602 / 770 …), önceki yıl → gelir yönlü 671, gider yönlü 681; yalnız bilanço içi (500 ↔ 519) →
  B 500 / A 519 ya da ters. Örnek (KG-5, Excel kartı 2024'te kayıtlı, 2025'te yüklenmiş, kilit 31.12.2025): B 681 T / A 500 P / A 519 (T − P).
- Değişmez (kâhin EK-1 §4 (9)): fişten sonra 1–5 sınıfı karma bakiyeleri (donmuş ≤ L + canlı > L) = yeni kuralla baştan türetilmiş defter (59x ve hesaplanmış satırlar hariç).
- "Düzeltildi" farkındalığı: Ç3'ün `ledger:rule-diff` uyarısı kilitli dönemi karşılaştırır, fiş açık dönemdedir → uyarı sonsuza dek kalır. Ç5: "düzeltilmemiş fark = ruleDiff − Σ
  rule-diff-correction fişleri (hesap eşlemesiyle)"; 0 ise uyarı "Düzeltildi (Fiş 2026-00000N)" bilgisine iner, Bilanço'nun "Kesin Değil — Kural Değişikliği Farkı" nedeni düşer (Ç6).
  Dosya: ledger-snapshots.mjs (Ç3 tur 3'ün dosyası) ya da Ç5'in kendi modülü (§7).
- SIRA: göçteki KG-16 adayları kilitli dönemde de olabilir. Önce Açılış Olabilir listesi tamamlanır, sonra Kural Farkı fişi (aksi hâlde onay sonrası ikinci fiş gerekir) — ekran sırayı
  zorlar (§9 B16). Onay / ret kilitli satırın kaynak izine girmez (`account_entries` izinde yalnız id, cari, tür, tutar, tarih, yol; integrity.mjs:125) → kilitli satırda da yapılabilir;
  donmuş dönem değişmez, fark fişle.
- ALT DEFTER HESABI farkı (S14 ailesinin 120 ↔ 128'i): fiş K6 ile yazılamaz VE yazılsa canlı mutabakatı bozar (canlı türetme zaten yeni kural + fiş = çift düzeltme; 120 / 128 `expected()`'te)
  → §9 B14.

3.4 NEDEN 519 `expected()`'e girmemeli (§9 B2): canlı mutabakat (alt defter ↔ güncel kuralla BÜTÜN zaman) Kural Farkı fişini de görür; fiş, donmuş dönemle güncel kural arasındaki
farkı kapatmak için yazıldığından canlı türetmeye eklenince o hesapta "fazla" kalır. 500 / 519 / 602 / 770 / 671 / 681 alt defter hesabı olmadığı için bugün sorun yok; 519 alt defter
sayılırsa olur.

3.5 Kilitsiz geçmiş yıllar: kilit konmamış şirkette Ç5 kuralı BÜTÜN geçmişe uygulanır (açık dönem = türetme, G-7). Geçen yılın açılış çekleri / Excel kartları gelirden (602) 519'a geçer
→ beyan edilmiş ama kilitlenmemiş yılın raporu değişir → §8 S-Ç5-7 (kör nokta).

---

## 4. "Nasıl bozulur?" (önce yazıldı; testler buradan)
Ç5-A (defter)
1. Sıra: açılış önce / hareket önce (cari, Kasa, banka, stok); aynı gün açılış + hareket (açılış sınıfı önce); açılışın tarihi sonradan öne / geriye alınır.
2. Açıklama: "Açılış bakiyesi", "AÇILIŞ", "AÇILIŞ BAKİYESİ", "Açilış", "  açılış farkı", "Devreden" (işaretli) — işaretli + açıklaması değişmiş → 519; işaretsiz "Açılış…" → aday.
3. Aynı adlı iki cari, ikisinin de açılışı; bir carinin iki "Açılış bakiyesi" satırı (biri işaretli, biri aday).
4. Eski sürüm verisi GERÇEK kodla (ders 17, G6): v2.0.26 (göç 35 öncesi; yalnız açıklama), v2.4.6 (işaret var, açıklaması değiştirilmiş açılış), v2.4.9 (kilitli + kilitsiz yıl; Excel
   kartı, açılış portföyü, banka / kart / kredi açılışı, stok açılışı, Devir Kapanışı) → 2.5.0 (Ç5) göçü: kilitli dönemin Yevmiye / Mizan'ı BİREBİR 2.4.9; açık dönem farkı yalnız Ç5 kural
   kimliklerinde; Kural Farkı fişi ön izleme tutarları bağımsız hesapla eşit.
5. Excel taksit kartı (KG-5): P = 0 / P = T / P > 0; kartın Kayıt Tarihi < yükleme günü (yıl farkı); Geri Al (import undo); açılış satırının tutarı / tarihi düzeltilir; kart silinir / Silinenler'den döner.
6. Açılış evrakı: Excel portföyü (alınan / verilen, çek / senet, carili / carisiz), tahsile ver → karşılıksız; ciro; tahsil; formdan carisiz evrak; eski verideki "Açılış portföyü" notlu olay.
7. Açılış silinip yeniden girilir (cari / Kasa / banka); eski açılış Silinenler'den geri alınır (iki açılış).
8. Kilitli dönem: kilitli dönemde açılış; KG-16 adayının kilitli dönemde onayı / reddi; Kural Farkı fişi (aynı yıl / önceki yıl / bilanço içi); kilit bugünken fiş; fişin ters kaydı; kilidi aç →
   yeniden kilitle (güncel kuralla donar, fiş artık fazla mı?) — bkz. §9 B16.
9. Açılış Eşleştirme: kısmi, iki kez, 519'u ters çeviren, izinsiz hesap (102, 120, 600), eşleştirmeden sonra açılışın silinmesi, aynı istek iki kez, kilitli tarih, Muhasebe rolü 403.
10. İki şirket (fiş, işaret, aday listesi karışmaz); geri yükleme (göç öncesi yedek → göç yeniden koşar, aday listesi yeniden kurulur; göç sonrası yedek → aynen); Şirket Verisini Sıfırla.
11. Gün dönümü: KG-5 yükleme günü yerel tarih (gece 00:00–03:00 İstanbul / UTC ayrışması, ders 22), kilit + 1, 31.12 / 01.01; iki TZ.
Ç5-K (Kasa)
12. Açılıştan bir gün önce / aynı gün / sonra nakit: her kaynak (12 yol); açılışsız Kasa; açılış sonradan girilir; düzeltmede tarihi açılıştan önceye çekme; yedekten / eski sürümden gelen
    açılış öncesi satır (S20) + tutar / açıklama / cari / bağ düzeltmesi (S26, S40, S44) + bağlıysa cari düzeltmesi (S45 red) + Silinenler'den (Z9).
Ç5-B (TYK)
13. S2 / karar (1): bağsız ödeme vadesi önce gelene; ödemeden sonra doğan borç; aynı gün borç + ödeme; giriş sırası ↔ belge tarihi ters (ders 31: anahtarlar ters çevrilerek).
14. Bağ sonradan (karar (2)): Kapatılacak Fatura / Mahsup Et / iade, hedef önceden bağsız kapanmış; kilitli dönemde (karar (3)).
15. Karşılıksız: kilit öncesi / sonrası alınmış, kilit öncesi / sonrası karşılıksız (S8, S11, S18 avans, S19 kilit sonradan ilerler); ciro dönüşü (tedarikçi tarafı).
16. Taksit: fatura kartı, Mevcut Borç kartı (kısmi, S2 sırası), Yeni Borç / Excel kartı; cari tahsilatı ayrı kartın taksitine düşer mi (§8 S-Ç5-4); iade kartı küçültür (Ç7b).
17. Netleşme: aynı kişi müşteri + tedarikçi; alış > satış (alacaklı → hatırlatma yok); Mahsup Et.
18. Vadesiz fatura / Borç Yaz / açılış ertesi gün gecikmiş; vade günü gecikmiş değil; Ödeme Sözü ileri tarihli (§8 S-Ç5-6).
19. Şüpheli: J-01 kuyruğu, J-06 dönüş, şüpheli + şüphesiz gecikmiş, faturaya bağlı evrak / nakit / kart iadesi (S14, S25, S39) — defter 128 / 120 ile kuyruk aynı.
20. Bütün ekranlar aynı sayı: cari kartı = liste = Anlık Durum = mobil = WhatsApp = Vade Takip = fatura durumu; iki kullanıcı aynı anda tahsilat + liste (önbellek bayatlığı).
21. Güncelleme anında kuyrukta bekleyen Ödeme Hatırlatma işi (gönderim anında yeni tanımla değerlendirilir: eleme ve {{4}} tutarı değişebilir — "kime kaç kez" ilke 1–3 ile).
Ç5-C (WhatsApp) — WK kâhininin S7 ailesi senaryoları (README §16–§23) + ilke 5 (geri yüklenen veri).

---

## 5. Test planı (kod ajanının yazacağı; her karar ≥ 1 test + karşı mutant; eski kodda BEKLENEN NEDENLE kırmızı, ders 7 / 38)
Dosya adları öneri; ad Windows'ta açılır (ders 33). Her koşu `tools/kanit.mjs kos`, iki TZ (UTC + Europe/Istanbul).
| Test | Karar | İçerik | Karşı mutant (yakalamalı) |
|---|---|---|---|
| test/acilis-519-250.test.mjs | §2.2, M-01…M-09, KG-5 | her modül açılışı tek madde, karşı 519; Kasa / cari / banka / kart / kredi / Devir Kapanışı / stok / evrak; KG-5 tek madde (T−P) yükleme günü | açılışlardan birini 500'e döndür; KG-5'i iki madde yaz; P'yi maddeye ekle |
| test/acilis-tanima-250.test.mjs | §2.3, P1 | işaretli + açıklaması değişmiş → 519; işaretsiz "Açılış…" → aday kuralı; "AÇILIŞ" büyük harf | `opening(note)`'u geri koy; Türkçe katlamayı kaldır |
| test/acilis-olabilir-250.test.mjs | KG-16 | göç adayları (5 yazım), onay → 519, ret → C-01/02, onay beklerken (§8 S-Ç5-1), kilitli satırda onay, iki şirket, göç öncesi yedeğin geri yüklenmesi | adaylığı göç dışında da ver; onayı `is_opening`'e yaz |
| test/acilis-evraki-250.test.mjs | M-08/09, §8 S-Ç5-2/3 | Excel portföyü (işaret / not), formdan carisiz evrak, karşılıksız | portföyü 602'de bırak; carisizi 519'a al |
| test/acilis-eslestirme-250.test.mjs | M-11 | izinli / izinsiz hesap, ters bakiye, kısmi + iki kez, aynı istek, kilit 409, Muhasebe 403 | ters bakiye denetimini kaldır; alt defter hesabına izin ver |
| test/kural-farki-fisi-250.test.mjs | KG-15, M7 | v2.4.9 GERÇEK koduyla üretilmiş kilitli veri (git archive v2.4.9, ders 23) → göç → fiş ön izleme (aynı yıl / önceki yıl / bilanço içi) → kayıt → karma bakiyeler = yeni kuralla baştan türetme; "Düzeltildi"; kilit bugün → pasif + neden | 671/681 yerine 602; birikimli yerine yıl yıl bilanço; fişi canlı mutabakata say |
| test/acilis-mutabakat-519-250.test.mjs | §2.8 | 519 / 500 ikinci yükleyici = defter; fiş satırları dahil; stock:opening "519" | yükleyiciden KG-5'i düşür |
| test/donmus-defter-250 (kural tuzağı) + tur1 (kayıt defteri) | §3.2 | BİLEREK değişir (G3 gerekçesi: bu not §3.2 + seçilen B15) | — |
| test/kasa-acilis-once-250.test.mjs | S12, S20, S26, S40, S44, S45, Z9, R8 | 12 nakit yolu × (önce / aynı gün / sonra), düzeltme, geri yükleme, Silinenler | bir yolu denetimden çıkar; aynı günü reddet |
| test/tyk-250.test.mjs (+ özellik testi) | §2.10 | S1, S2, karar (1)(2)(3)(5), M1e, S8, S11, S18, S19, M13; değişmezler rastgele 500 sırada (tohumlu; ders 31 anahtar ters çevirme) | havuz okuması (karar (1) B); belge sırası (S2 B); kart + alttaki borç birlikte; vade ≤ bugün |
| test/b1-ekranlar-esit-250.test.mjs | çekirdek §9.11 | cari kartı = liste = Anlık Durum = mobil = WhatsApp önizleme = Vade Takip = fatura durumu (aynı cari, 3 tarih) | bir yolu eski tanıma döndür |
| test/supheli-baglı-alacak-250.test.mjs | S14, S25, S39 | defter 128 / 120 = TYK şüpheli kuyruğu; ikinci yükleyici aynı | bağlı evrakı her zaman 128'e yaz |
| WhatsApp (Ç5-C) | S7 ailesi | WK kâhini ↔ program sürücüsü (test/bagimsiz/whatsapp-248) | kâhinin mutantları |
| e2e | ders 12, 28, 37 | senaryo-defter-243 (açılış satırları), senaryo-banka-210 (banka açılışı 519), açılış eşleştirme ekranı (insan hızı + klavye), Açılış Olabilir listesi, cari kartı "Gecikmiş Borç", Vade Takip; ders 37: adayda ci.yml'nin BÜTÜN e2e listesi | — |
KÂHİN / SÜRÜCÜ:
- Muhasebe kâhini (test/bagimsiz/muhasebe) zaten Ç5 kurallarıyla kurulu → Ç5-A / Ç5-B birleşince SÜRÜCÜ (test/bagimsiz/muhasebe-surucu) birleşmiş ağaçta koşar (G5); `siniflama.json`'da Ç5
  kimlikli satırlar (P1-ACILIS-BUYUK-HARF, U-S2-ACIK-FATURA, U-M13-ACIK-FATURA, R4) KALKMALI; kalan farklar yalnız Ç7a / Ç7b / D4 kimlikli; listede olmayan her yeni fark önce hata (ders 6).
- ESKİ KÂHİNLER KIRILIR: `test/bagimsiz/defter/kahin.py` açılışları 500'e yazar (satır 6, 126-142) ve `test/bagimsiz/cari` fatura kapamasını bugünkü FIFO / ayrı kart kuralıyla modeller
  (`npm run test:kahin-defter`, `test:kahin-cari`; tam kapıda koşar). Kod ajanı bunlara DOKUNMAZ (ders 40) → §9 B17.
- Mutasyon: para çekirdeği (açılış karşı hesabı, KG-5 tutarı, TYK dağıtımı, 128 / 120) — `test/bagimsiz/muhasebe/mutasyon.py` kâhin tarafı; program tarafı yukarıdaki karşı mutantlar
  (Ç2 / Ç3'ün mutasyon dosyası deseni).
- G2 komşu taraması: değişen her dosyayı adıyla ya da API yoluyla anan BÜTÜN testler (test/ grep: "500" + defter / mizan → ~60+ dosya, banka-210-* ailesi dahil) + sema-kapisi-bs7 + geri yükleme
  testleri (ders 10 06.11 eki: ortak katmana / ayara / yedeğe yazan değişiklik — KG-16 göçü ve işaret sütunu buna girer). Her beklenti değişikliği G3 gerekçeli.
- Ders 41: Ç5-A ve Ç5-B yapısal → adayda BİR KEZ tam `npm test`. Ders 48: göç / yedek geri yüklemesine dokunan testler yazıldığı gün Windows CI'de.
- Kılavuz: "karşılığı açılış hesabı 500" cümlesi + Açılış Eşleştirme / Açılış Olabilir hap bilgisi → HTML + PDF (`docs/kilavuz/pdf-uret.mjs`, `pdf-denetle.mjs`; ders 42).

---

## 6. Hacim bütçesi (ders 47; ölçüm §1.7, aynı veri kopyasıyla önce / sonra, flock)
| Yol | 100.000 satır | 1.000.000 satır | Olay döngüsü | Desen |
|---|---|---|---|---|
| `build()` / Ana Defter (Ç5-A: 519, KG-5, işaret okuma) | bugünkü ±%5 (taban 4,3–4,7 sn yüklü makinede) | bugünkü ±%5 (ölçülür) | değişmez (Ç3 / Ç6 işi) | yeni sorgu yok; `is_opening` aynı satırda, KG-5 tek alt sorgu |
| 519 / 500 ikinci yükleyici (kapıda) | ≤ 20 ms | ≤ 200 ms | — | SQL SUM'lar (cash / account / plan / stock / bank_lines / cheques / voucher_lines) |
| KG-16 göçü | ≤ 2 sn | ≤ 20 sn | göç (açılış) | tek UPDATE (aday kuralı SQL + JS katlama tek geçiş) |
| Açılış Eşleştirme / Kural Farkı ön izleme | ≤ 3 sn (worker) | ölçülür | ≤ 50 ms | 519 bakiyesi SQL; `ruleDiff()` Ç3'ün worker'ında |
| TYK tek cari (cari kartı) | ≤ +20 ms (bugün 348 ms, 129 satır) | aynı (cari başına) | — | saf işlev, cari satırları |
| TYK bütün cariler (liste, Anlık Durum, mobil, WhatsApp, Vade Takip, zil) SOĞUK | ≤ 2 sn VE ana iş parçacığı dışında (bugün `allSettled` ~4–9 sn ana iş parçacığında) | ölçülür; hedef ≤ 30 sn worker, ilerleme | ≤ 50 ms | cari başına önbellek (anahtar: carinin parmak izi — satır sayısı / son rowid / tutar toplamı); soğuk kurulum rapor iş parçacığında ya da açılışta arka planda |
| TYK yazımdan sonra | yalnız dokunulan cari ≤ 20 ms | aynı | ≤ 50 ms | dokunulan cari kümesi (kapının "dokunulan varlıklar"ı) |
| Mutabakat kapısının `list()`'i | DEĞİŞMEZ (TYK hesaplamaz) | — | — | bayrak (`withOverdue: false`) |
| WhatsApp önizleme (2.000 cari) | ≤ 2 sn (ders 47 örneği) | — | ≤ 50 ms | TYK önbelleğinden, waFacts başına ağır okuma YOK |
Not: 1 M ölçümü bu turda YOK; Ç5-B geliştirme sırasında 100.000'de ölçülür (son adayı beklemeden), 1 M ölçümü Ç6 / D3 ölçümleriyle birlikte.

---

## 7. Dosya sınırı ve sıralama
Çalışan / sıradaki işlerin dosyaları: Ç3 tur 3 — `lib/ledger-snapshots.mjs`, `lib/ledger-freeze-worker.mjs`, `routes/ledger.mjs`, `lib/period.mjs`, `client/assets/admin.js`,
`routes/report-center.mjs`; Ç3 küçük işler — report-center.mjs:719, routes/ledger.mjs:440, admin.js:1055-1068; D2 — companies, company-backups, app.mjs, migrations 48–49; W-3 /
WhatsApp tur 1 — `lib/whatsapp/**`, app-webhook; Ç2 tur 3 — ledger-vouchers, bank/repair, integrity (koşullu).
| Paket | Dokunacağı dosyalar | Çakışma | Sıra |
|---|---|---|---|
| Ç5-K | lib/cash-opening.mjs, routes/cash.mjs, lib/bank/module-ref.mjs (nakit dalı) ya da ortak para denetimi, routes/trash.mjs, lib/integrity.mjs (yeni uyarı denetimi), testler | integrity.mjs ↔ Ç2 tur 3 (koşullu) | ŞİMDİ (Ç2 tur 3 integrity'ye dokunursa onun birleşiminden sonra) |
| Ç5-B | YENİ lib/obligation-queue.mjs, lib/invoice-settle.mjs, routes/invoices.mjs (allSettled, entryStates, paymentStates, dueItems), routes/accounts.mjs (detail, list, waFacts, openDueItems), lib/accounts.mjs, routes/overview.mjs, routes/dues.mjs, routes/plans.mjs (görünüm), lib/mobile.mjs, client hof-accounts.js / hof-overview / fatura ekranı adları | report-center.mjs:61 süzgeç adı (Ç3 tur 3) | Ç3 tur 3 ile paralel; report-center satırı Ç3 tur 3 birleşince; WhatsApp'a dokunan alan Ç5-C ile aynı birleşimde |
| Ç5-A | lib/general-ledger.mjs (journal, CHART, JOURNAL_CLASS, LEDGER_RULE_VERSION), routes/ledger.mjs (rows, build, ikinci yükleyici, fiş uçları), lib/ledger-snapshots.mjs (RULE_HISTORY, "Düzeltildi"), YENİ lib/ledger-opening.mjs (eşleştirme + kural farkı fişi kurucu, aday listesi), lib/bank/voucher.mjs (effectiveGl), lib/bank/settings.mjs, lib/bank/vouchers.mjs (meta adı), lib/doubtful-gl.mjs + lib/bank/doubtful.mjs (S14), lib/integrity.mjs (stock:opening, 519 denetimi), lib/migrations.mjs (GÖÇ GEREKİR: KG-16 aday / onay sütunu; §9 B4'e göre evrak işareti), routes/accounts.mjs (aday listesi uçları), routes/cheques.mjs (Excel portföyü işareti), client admin.js (Açılış Eşleştirme, Kural Farkı, Açılış Olabilir ekranları), kılavuz + PDF | routes/ledger.mjs, ledger-snapshots.mjs, admin.js (Ç3 tur 3); migrations.mjs (D2 48–49 — numara ana oturumdan); ledger-vouchers (Ç2 tur 3: Ç5-A yalnız `post` çağırır, dosyaya dokunmaz) | Ç3 tur 3 + Ç3 küçük işler BİRLEŞİNCE; Ç5-B'den sonra (S14 kuyruğu) |
| Ç5-C | lib/whatsapp/queue.mjs (eligibility, overdueOf, gönderim anı), routes/whatsapp.mjs (statementText, targets), WhatsApp ekranı metinleri | W-3, WhatsApp tur 1 | ikisi birleşince; Ç5-B ile aynı birleşim (§2.12) |
Ç7a / Ç7b: `journal()`, `rows()`, bank/voucher, LEDGER_RULE_VERSION'a Ç5-A ile aynı yerlerden dokunur → Ç5-A'dan SONRA (Ç7a, Ç5-B ile paralel olabilir).

---

## 8. KULLANICIYA SORULMALI (para / kapama / "kime kaç kez" — ders 43, 45; 5 dk yetkisi YOK; SORU DÜZENİ: uç durumda üçüncü seçenek)
- **S-Ç5-1 (KG-16, onay beklerken):** Güncellemede "Açılış Olabilir" listesine giren eski kayıt (açıklaması "Açılış…" ama açılış işareti yok), kullanıcı onaylayana ya da reddedene kadar
  defterde nerede dursun? **A (öneri):** onay gelene kadar bugünkü gibi açılış sayılsın (519) ve Bilanço "Kesin Değil — Açılış Olabilir Kayıtlar Onay Bekliyor" desin (2.4.9'da bu satırlar zaten
  açılış hesabındaydı; onaylanmazsa gelir / gidere döner). **B:** onay gelene kadar sıradan Borç / Alacak Yaz (gelir / gider) sayılsın; onaylanınca açılışa geçsin.
- **S-Ç5-2 (karşılıksız açılış evrakı):** Excel'den "carilere dokunmadan" yüklenmiş (cariye işlenmemiş) açılış çeki / senedi karşılıksız dönünce (bugün gider yazılıyor, kimse borçlanmıyor):
  **A (öneri):** program kişiyi (cariyi) sorar; seçilirse cari yeniden borçlanır (B Cari / A 101 — öteki karşılıksızlarla aynı); seçilmezse açılış geri alınmış sayılır (B 519 / A 101) ve
  açılış eşleştirmesi yeniden gerekir. **B:** gider yazılsın (B 770.90 "Sınıflandırılmamış" / A 101; bugünkü davranışın sınıflandırılmış hâli). **C:** uç durum böyle kalsın (BİLİNEN SINIR;
  bugünkü 770).
- **S-Ç5-3 (formdan carisiz evrak — açılış değil):** Cari seçmeden, yalnız keşideci / lehtar adıyla formdan alınan ya da verilen çek / senet (30.10 kararı yalnız "açılış çekleri" der):
  **A (öneri):** açılış sayılmaz; Kasa'nın carisiz giriş / çıkışı gibi alınan 649.90, verilen 770.90 "Sınıflandırılmamış" (KG-3'ün carisiz Kasa girişi kararıyla aynı aile). **B:** bütün cariye
  işlenmemiş evrak açılış sayılsın (519). **C:** bugünkü gibi 602 / 770 kalsın.
- **S-Ç5-4 (kör nokta: ayrı taksit kartı ve bağsız tahsilat):** Müşterinin "Yeni Borç" ya da Excel'den gelen ayrı taksit kartı var; cari kartından kart seçilmeden bir tahsilat alındı. Bu tahsilat
  vadesi gelmiş KART TAKSİTİNİ kapatsın mı? (Bugün kapatmaz: kart "kendi defteri"; mali müşavirin tek kuyruk modeli — gösterilen BAŞ MİMAR KARARI M1a — kapatır.) **A (öneri):** evet, tek
  kuyruk: vadesi önce gelen borç hangisiyse (fatura ya da taksit) o kapanır; Taksitler ekranı, zil ve takvim de bunu gösterir ("Cari tahsilatıyla kapandı"). **B:** hayır, kart taksitleri yalnız
  kart tahsilatıyla kapanır; cari tahsilatı önce kart dışı borçlara gider (kâhin bu kurala göre güncellenir).
- **S-Ç5-5 (uç: ikinci açılışın geri alınması):** Carinin açılış bakiyesi silindi, yenisi girildi, sonra eskisi Silinenler'den geri alındı (bugün işaretsiz döner; yeni kuralda gelir / gider
  sayılırdı). **A (öneri):** geri alınan satır "Açılış Olabilir" listesine girer, kullanıcı onaylar. **B:** geri alma reddedilir ("Carinin açılış bakiyesi var; önce onu silin"). **C:** uç durum
  böyle kalsın (sıradan Borç / Alacak Yaz; BİLİNEN SINIR).
- **S-Ç5-6 (Ödeme Sözü ↔ gecikmiş):** Borcun vadesi geçti ama müşteri ileri bir tarihe Ödeme Sözü verdi (Beklenen Ödeme Tarihi). **A (öneri):** borç gecikmiş sayılır (raporlar, cari kartı
  aynı), ama söz tarihi gelene kadar otomatik Ödeme Hatırlatma'ya girmez ("Ödeme Sözü Var" etiketiyle görünür, istenirse elle seçilir). **B:** söz tarihi gelene kadar gecikmiş de sayılmaz.
  **C:** söz hatırlatmayı değiştirmez (yalnız vade esas).
- **S-Ç5-7 (kör nokta: kilitsiz geçmiş yıl):** Dönem kilidi konmamış şirkette güncelleme geçmiş yılların defterini de yeni kuralla gösterir (ör. geçen yılın açılış çekleri ve Excel taksit kartları
  gelirden açılışa geçer; beyannameye esas alınmışsa rapor değişir). **A (öneri):** böyle olsun; güncelleme notunda ve Defter Mutabakatı'nda "Kilitlenmemiş geçmiş yıl yeni kuralla hesaplandı"
  bilgisi + "yılı kilitleyin" önerisi. **B:** göçte kilit yoksa son tamamlanmış yılın 31 Aralık'ına kendiliğinden kilit konup eski kuralla dondurulsun (kullanıcıya bildirilir; o yıla düzeltme
  ancak kilit açılarak). **C:** uç durum böyle kalsın (BİLİNEN SINIR, bilgi satırı da yok).

## 9. BAŞ MİMAR KARARI GEREKİYOR (mimari; seçenek + öneri + gerekçe; kullanıcıya gösterilir, ders 40)
- **B1 Paket bölme:** (a) Ç5-K / Ç5-B / Ç5-A / Ç5-C (§0) — ÖNERİ; (b) tek paket. Gerekçe: üç küme ayrı çakışma takvimine bağlı; ders 46 (ajan başına bağlam); Ç5-K ve Ç5-B Ç3 tur 3'ü
  beklemeden başlar (takvim: 1 Ocak). Ek: Ç5-B ile Ç5-C AYNI birleşim ya da Ç5-B WhatsApp'ın okuduğu eski alanı (`overdueInstallments`) Ç5-C'ye kadar korur — öneri ikincisi (Ç5-B erken
  birleşir, WhatsApp davranışı Ç5-C'de tek seferde değişir).
- **B2 519 / 500 denetimi:** (a) ayrı "Açılış Karşılığı" denetimi (ikinci yükleyici; Mutabakat Testi + Defter Mutabakatı satırı; kapıda ucuz SQL) — ÖNERİ; (b) `expected()`'e 519 / 500 +
  K6 istisnası + fiş satırlarının beklenene eklenmesi. Gerekçe: (b) K6'nın "alt defter hesabına fiş yok" anlamını gevşetir ve Kural Farkı fişi canlı mutabakatı kırar (§3.4).
- **B3 Banka açılış / kapanış kodu:** (a) saklı `bank_lines.gl` "500" kalır, türetme ve bütün görünümler ortak yardımcıyla 519 okur — ÖNERİ; (b) yeni fişler 519 saklar, eskiler türetmede
  çevrilir; (c) göçle eski satırlar 519 yapılır. Gerekçe: (c) kilit izini bozar (`bank_lines_lock` kodu içerir); (b) 2.4.9 aynı dosyayı açarsa (BS-7 öncesi kod kapıyı bilmez) beyaz listesi
  519'u "yasak" görür, kapısı sorun sayar; (a) tek dönüşüm yeri.
- **B4 Açılış evrakının işareti:** (a) göçle `cheques.is_opening` (Excel yüklemesi yazar; göç ilk olay notundan "Açılış portföyü (Excel/Sheets)" doldurur) — ÖNERİ; (b) her türetmede ilk olayın
  notunu okumak (göç yok). Gerekçe: Ç5'in ilkesi "açılış işaretten" (plan §6); not program yazar ama sorgu her türetmede olay tablosuna ek birleşim ister; işaret kilit izine EKLENMEZ
  (kaynak izi sürümü değişmesin; LOCK_SQL_VERSION) — bu bilinçli bir sınırdır (C3 B listesi "kaynak izinin kapsamadığı türetme alanları").
- **B5 KG-5 madde tarihi (P = 0 kart):** (a) `plan_imports.created_at`'ın YEREL günü (yükleme anı; göç yok) — ÖNERİ; (b) kartın Kayıt Tarihi; (c) göçle `plans.opening_on`. Gerekçe: kitap H-06
  "yükleme açılış tarihi"; P > 0'da açılış satırlarının tarihi zaten yükleme günü. BİLİNEN SINIR: kartın Kayıt Tarihi < yükleme günü ise cari ekstresinde kart Kayıt Tarihi'nde, defterde
  yükleme gününde görünür (aradaki tarihlerde Cari Mizanı ↔ Hesap Planı Mizanı tarih bazında ayrışır; tüm zaman mutabakatı tutar).
- **B6 KG-16 eşleşme genişliği:** Türkçe küçük harf + ç/ı/ş katlama + baştaki boşluk; "Devir", "Devreden" GİRMEZ — ÖNERİ (karar metni "Açılış…" der; liste yalnız aday, yanlış pozitif onayla elenir).
- **B7 KG-16 sütunu:** (a) yeni `account_entries.opening_review` ('' | candidate | confirmed | rejected; GÖÇ GEREKİR) — ÖNERİ; (b) `is_opening`'i çok değerli yapmak. Gerekçe: `is_opening`
  "cari başına bir Açılış Bakiyesi satırı" anlamıyla 8+ yerde okunuyor (openingEntryOf LIMIT 1, Silinenler, form); karışırsa form ikinci satırı düzeltir. Yer: Cariler → "Açılış Olabilir
  Kayıtlar" + zil bildirimi; yetki `accounts.manage` (onay) — Muhasebe dahil mi, kullanıcıya gösterilir.
- **B8 Göç sonrası gelen eski satır:** göç öncesi yedeğin geri yüklenmesi göçü yeniden koşar (aday kuralı uygulanır); Silinenler'den dönen 2.4.x yükü (işaretsiz "Açılış…") ADAY olur (Z9
  benzetmesi: silinmeden önceki hâliyle döner, göçte aday olacaktı) — ÖNERİ; S-Ç5-5 bunun özel hâli.
- **B9 Açılış sınıfı:** madde kimliği korunur, maddeye `cls` alanı (açılış), `journalOrder` önce onu okur — ÖNERİ (kimlik değişirse donmuş satırlar, ruleDiff madde sayısı ve kapının
  `account:` sahip eşlemesi bozulur).
- **B10 Ekranların yeri:** Yönetim → Dönem Kilidi yanına "Açılış Eşleştirme" ve "Kural Farkı Düzeltme" (yetki `system.manage`); Cariler'e "Açılış Olabilir Kayıtlar" — ÖNERİ.
- **B11 S12 düzeltmede (kâhin T12 türetmesi):** düzeltme de reddedilir (EK-2 §4 (8) değişmezi + "bankadaki gibi kaydetmez") — ÖNERİ; S26 / S40 / S44 tarih değişmeyen düzeltmeyi zaten ayırıyor.
- **B12 Kilit bağımlı kapama kararlarının saklanması (karar (3), S11, S19 "bir kez"):** (a) karşılıksız / bağ satırına yazım anındaki kilit damgası (GÖÇ GEREKİR, para alanı değil) — ÖNERİ;
  (b) her türetmede güncel kilit (S19 = A'ya aykırı). Program iletisi (S11 sunumu): "Bu fatura kilitli dönemde (GG.AA.YYYY) kapandığı için yeniden açılmadı; karşılıksız tutar ayrı borç
  olarak yazıldı." Y12 ("S19'da R3 bağ üzerinden okunuyor") değerlendirmesi: bağ ve karşılıksız AYNI damgayı kullanır.
- **B13 Eleme adı:** net borcu olmayan (alacaklı / sıfır) kişide "Net Borcu Yok", gecikmiş kalemi olmayan borçluda "Gecikmiş Borç Yok" — ÖNERİ (WK güncellemesi 13 notu; kime / kaç kez değişmez).
- **B14 Alt defter hesabında kural farkı (S14 ailesi 120 ↔ 128):** (a) fişle düzeltilmez; Bilanço / Defter Mutabakatı "Kural Değişikliği Farkı (120 / 128)" kalır, çözüm C3 §7'nin yolu
  (Kilidi Aç → Yeniden Kilitle) — ÖNERİ; (b) `rule-diff-correction`'a K6 istisnası + `expected()`'e fiş satırları. Gerekçe: cari bakiyesi (120 + 128) değişmez, fark yalnız sınıflama; (b) K6 ve
  canlı mutabakatın dişini zayıflatır. Kullanıcıya BİLİNEN SINIR olarak söylenir.
- **B15 Kural sürümü etiketi:** (a) "2.5.0" kaydı 2.4.9 kopyasının takma adı + fiş (kural tuzağı testi tutar eşitliğini kanıtlıyor; ayrı kopya yok), Ç5-A tek yeni etiket açar ("2.5.0-defter");
  Ç7a / Ç7b yayından önce AYNI etiketi genişletir; C3 §5'in "her değişiklikte kopya" kuralı yayın sınırında uygulanır (2.5.1 değiştirirse `ledger-rule-250defter/`) — ÖNERİ; (b) her paket
  ayrı etiket + AYNEN kopya (C3 §5 harfiyen: Ç5, Ç7a, Ç7b → üç kopya × dört dosya + eşdeğerlik testleri); (c) "2.5.0" yayından önce yeniden tanımlanır. Gerekçe: yayımlanmamış ara kurallar
  hiçbir müşteri dosyasında bekleyen koşu olarak bulunamaz (yalnız geliştirme verisi); (a) C3 testinin anlamını korur (bilinen önek, kopya ya da kanıtlı takma ad). Kayıt defteri testi
  "kopya YA DA eşdeğerlik testli takma ad" diye güncellenir (G3 gerekçesi bu madde).
- **B16 KG-16 ↔ Kural Farkı fişi sırası:** ekran, kilitli dönemde onay bekleyen aday varken Kural Farkı fişini "önce Açılış Olabilir listesini tamamlayın" nedeniyle pasif tutar — ÖNERİ.
  Kilit açılıp yeniden konarsa (güncel kuralla yeniden donar) önceki Kural Farkı fişi fazla kalır → ekran bunu algılar ("Fiş artık fazla; ters kaydedin") ve ters kayıt önerir.
- **B17 Eski kâhinler (defter 2.4.3, cari 2.4.x):** (a) kodu görmeyen ajanla bakım (yalnız Ç5 karar metinlerinden; "kâhin önce" — Ç5-A / Ç5-B birleşmeden ÖNCE) — ÖNERİ; (b) emekliye ayırıp
  kapsamlarını muhasebe kâhinine taşımak (önce kapsam karşılaştırması gerekir). Gerekçe: ikisi tam kapının parçası; ders 40 gereği kod ajanı dokunamaz.

## 10. DOĞRULANMADI / DENENMEYEN (bu tasarım turu)
- Kod koşulmadı (yalnız ölçüm, §1.7); 1 M ölçümü yok; ölçüm makinesi yüklü (load 4,7–8,6).
- R8'in düzeltmede bütün biçimleri kapsayıp kapsamadığı (routes/cash.mjs:533 `openingAfter` koşulu) koddan tam izlenmedi — kod ajanı ilk iş doğrular.
- `routes/whatsapp.mjs` statementText'in {{4}} dışındaki ileti metinleri ve WhatsApp ekranı adları ayrıntılı taranmadı (Ç5-C).
- Zil / takvim önbelleğinin (dues.mjs `fingerprint`) TYK önbelleğiyle bayatlık ilişkisi tasarlanmadı — Ç5-B'nin ilk adımı.
- Kâhin kodu okunmadı (yalnız README); kâhinin `kartlar` raporundaki taksit kalanının bağsız tahsilatı içerip içermediği README'den kesin değil (EK-2B 35 (5) "kartın taksitlerine dağılmış bağsız
  ödemeler" içerdiğini gösteriyor) → S-Ç5-4.
- Mevzuat birincil metinleri bu turda açılmadı (kitap §10'daki sınır aynen).

---

## 11. Ç5-A tur 1 (kod ajanı, 11.11.2026; taban `c5a-taban` b4d207e3) — KODDAN ÖNCE yazıldı

Kapsam: defterin TÜRETME çekirdeği + veri / göç + uçlar (§2.1–§2.6, §2.8, §3.1, §3.2, §3.5; B2–B9, B15; S47, S48, S49, S51, S53). TUR 2'ye: §2.7 Açılış Eşleştirme Fişi ve
ekranı, §3.3 Kural Farkı Düzeltme Fişi + "Düzeltildi" (B16), "Açılış Olabilir Kayıtlar" EKRANI + zil, §2.11 (S14 / S25 / S39; B14), kılavuz. Ç7a / Ç7b satırlarında
(602 → 600.90, 689, .90 alt hesapları, 102.00 ara adımı) yalnız 500 → 519 ve açılış tanıması.

### 11.1 §1'in dosya:satırlarının bugünkü karşılığı (taban b4d207e3)
| §1 | Bugün |
|---|---|
| general-ledger.mjs:20 `LEDGER_RULE_VERSION` | :20 (aynı) |
| :133 500 adı, :135 519 | :133, :135 |
| :235 `opening(note)` | :235; okuyan :414-415 (cari Borç / Alacak Yaz) |
| :368 Kasa açılışı | :368 |
| :429 kart B CH T / A 602, :444 "Açılış (devir)" B 500 | :429, :444 |
| :468 stok açılışı | :468 |
| :551-563 banka fişi (saklı kod aynen) | :550-563 |
| :606-631 JOURNAL_CLASS | :606-631; `classOf` :632, `journalOrder` :633 |
| routes/ledger.mjs:87-94 cari SELECT (`is_opening` yok) | :99-107 |
| routes/ledger.mjs:146-179 free-in / free-out / free-bounce, :203-210 `build()` 770 / 602 | :162-187, :215-225 |
| routes/ledger.mjs:234-331 `expected()`, :356 `subledgerAccounts` | :246-343, :368 |
| ledger-snapshots.mjs:29 GAP_RULE, :39 RULE_HISTORY | :29, :41; kayıt defteri `rules` :227; donmuş satırın sınıfı `classOf` :52-55 (madde kimliğinden) |
| — | ledger-freeze-worker.mjs:30-37 (iş parçacığının kural kaydı: yalnız 2.4.9 ve güncel) |
| bank/voucher.mjs:22-23 ROLE_GL, :100-120 | :22-23, `openingLines` :96-108, `carryLines` :110-121 |
| bank/settings.mjs:157, bank/vouchers.mjs:997 | :157, :997 |
| — İşlem Kartı görünümü | bank/movements.mjs:178-186 `voucherLines` (gl + glName saklı koddan) |
| integrity.mjs:468-486 `stock:opening` | :466-489 |
| routes/cheques.mjs:370 carisiz evrak, :838 "Açılış portföyü" | :372-373 (cari de keşideci de yoksa 400 — S49'un önünde), :838; karşılıksız :578-640 |
| routes/accounts.mjs:1900-1905 Silinenler'den dönüş | :2061 `restoredOpening` (DOSYA SINIRI DIŞI — Ç5-B tur 2b-2; §11.6) |
| test/donmus-defter-250:404, tur1:259-290 | :418, :259-290 |

### 11.2 Kural başına değişen yol
| Kural | Değişen yol |
|---|---|
| §2.1 hesap planı | ACCOUNT_PLAN: 500 "Sermaye"; 501–503, 520–529 ve 540–549'un Tek Düzen hesapları; MSUGT V.B Sermaye Yedekleri, V.C Kâr Yedekleri; PLAN_SUBS 649.90 "Sınıflandırılmamış" (S49) |
| §2.2 519 | journal(): Kasa, cari, stok, kart / KG-5, açılış evrakı; banka satırı türetmede `effectiveGl(line)` (bank/voucher.mjs; saklı "500" + rol opening / closing → 519); aynı yardımcı İşlem Kartı (movements.mjs voucherLines), Banka Ayarları sabit satırı, fiş meta adları |
| §2.3 işaret | rows(): `e.is_opening`, `e.opening_review` okunur; journal(): `opening(note)` KALKAR |
| §2.4 KG-16 | göç 48: `account_entries.opening_review` ('' / candidate / confirmed / rejected); candidate + confirmed → 519, rejected → 602 / 770; uçlar YENİ routes/opening-review.mjs (`accounts.manage`) |
| §2.5 evrak | göç 49: `cheques.is_opening` (ilk olayın notu "Açılış portföyü (Excel/Sheets)"); Excel yüklemesi işaretli yazar; rows() free satırlarında `isOpening`; build(): açılış → 519, açılış değil → alınan 649.90 / verilen 770.90 (S49), carisiz karşılıksız: açılış B 519 / A 101, açılış değil B 649.90 / A 101 (S66 — kâhin bakımı 2 KARARLAR D4′); S48 cari seçimi: karşılıksız ucunda `accountId` (carisiz evrakta) → carinin borç satırı (B CH / A 101) |
| §2.6 sınıf | maddeye `cls` (açılış = 2; voucher-open 1'den sonra, belgelerden önce); `journalOrder` ve donmuş satırın sınıfı önce `cls`'i okur; kimlik değişmez |
| §2.8 denetim | integrity.mjs: "Açılış Karşılığı (519 / 500)" denetimi (ikinci yükleyici, modül tablolarından SQL + fiş satırları); `stock:opening` → 519; `expected()`'e GİRMEZ (K6 değişmez) |
| §3 kural sürümü | LEDGER_RULE_VERSION "2.5.0-defter"; RULE_HISTORY ["2.4.9", "2.5.0", "2.5.0-defter"]; "2.5.0" = 2.4.9 kopyasının takma adı (LEDGER_RULE_ALIASES; kayıt defteri + iş parçacığı) |
| S53 | Mutabakat Testi / Defter Mutabakatı: kilitsiz geçmiş yılda 519 / 649.90 / 770.90 maddesi varsa uyarı satırı "Kilitlenmemiş Geçmiş Yıl Yeni Kuralla Hesaplandı" + "yılı kilitleyin" |

### 11.3 Değişen kodu okuyanlar (ders 10; tarama `grep general-ledger.mjs / ROLE_GL / ledger().build|check|book`)
| Okuyan | Etki | Ne yapılır |
|---|---|---|
| Yevmiye Defteri, Hesap Planı Mizanı, Mizan, Ana Defter (report-center :658-706, :1707; GET ledger) | 500 → 519, KG-5 tek madde, sıra | kendiliğinden (journal); e2e senaryo-defter-243 |
| Alt Hesap Mizanı (report-center :965) | 649.90 yeni alt hesap | ad PLAN_SUBS'tan — rapor adları okuyor mu denenir |
| Defter Mutabakatı (report-center :707) | yeni denetim satırı integrity().run()'dan gelir | kendiliğinden (rapor denetimleri listeler) |
| Mutabakat Testi + kapı (integrity.mjs run) | yeni denetim yalnız tam taramada (COMMIT'te değil) | §6 bütçesi ≤ 20 ms |
| İşlem Kartı / Banka Fişi görünümü (movements.mjs :178) | saklı 500 | effectiveGl (DOSYA SINIRI: movements.mjs listede yok — tek satır, raporda) |
| Banka Ayarları sabit eşleme (settings.mjs :157), fiş meta adları (vouchers.mjs :997) | ad / kod | 519 "Eşleştirilecek Açılış Bakiyeleri" |
| bütünlük kapısının süzgeçli yolu (integrity-scope partyBalances / subBalances) | cari ve alt hesap bakiyesi DEĞİŞMEZ (yalnız karşı hesap) | komşu testleri |
| donmuş defter (ledger-snapshots dondurma, ruleDiff, iş parçacığı) | yeni kural etiketi; "2.5.0" takma ad | kayıt defteri + tuzak testleri G3 |
| 2.4.9 kopyası (ledger-rule-249) | journalOrder'ı güncel dosyadan içe aktarır — `cls`'siz maddede sıra AYNI | kopya sha256 değişmez |
| tax.mjs (KDV mahsubu: 391 / 191 / 190) | etkilenmez | — |
| mobil özet, cari kartı, cari listesi, Vade Takip | defter okumaz | — |
| ikinci yükleyiciler (expected(), doubtfulExpected) | 500 / 519 yok; 649.90 alt defter hesabı değil | — |

### 11.4 "Nasıl bozulur?" (§4 + bugünkü kod)
§4 1–8, 10, 11 (Ç5-A) aynen; bugünkü koddan eklenenler: (a) 2.4.9 kopyası güncel `journalOrder`'ı kullanır → `cls` alanı kopyanın maddelerinde yok, sıra değişmemeli; (b) iş parçacığı kural
kaydı ayrı (ledger-freeze-worker) → "2.5.0" bekleyen koşusu orada da tanınmalı; (c) `free-bounce` açılış evrakında cari seçilince cheque.account_id değişir → `free-in` hâlâ cariye
işlenmemiş evrak (alacak satırı yok), `hasDebt` 1 → free-bounce yazılmaz (çift karşılıksız yok); (d) KG-5 kartının açılış satırları (plan_entries.opening) Geri Al / silme / Silinenler
yoluyla P değişince tek maddenin tutarı değişir (T − P); (e) carisiz import kartı (127) da KG-5 (party plan:<id>); (f) "Mevcut Borcu Taksitlendir" (covers) içe aktarım kartı yeni alacak
değildir → KG-5 tek madde YOK, açılış satırı B 519 / A CH (bugünkü B 500'ün 519'u); (g) Silinenler'den dönen cari satırı routes/accounts.mjs'te — dosya sınırı dışı (§11.6).

### 11.5 Hız etkisi (§6)
`rows()`'a iki sütun (aynı satır), kart sorgusuna üç alt sorgu (`opening` toplamı, yükleme damgası — plan_entries(plan_id) ve plan_imports birincil anahtarı), evrak sorgusuna bir sütun:
build() ±%5 hedefi. Yeni denetim yedi SUM (tam taramada). Göç 48: tek UPDATE + JS katlama yalnız "a/A/Ä"… ile başlayan elle satırlarda; göç 49: tek UPDATE (ilk olay). Ölçüm: temiz
100 bin kopyası, önce / sonra (kanıt docs/kanit/2026-11-11/c5a1-*).

### 11.6 Dosya sınırının dışında kalan ve TUR 2 / ana oturuma bırakılan bağlantı noktaları
- B8 / S51 (Silinenler'den dönen satır aday): routes/accounts.mjs (Ç5-B tur 2b-2'nin dosyası; YAZILMAZ). Bağlantı noktası: `restoredOpeningReview(payload, restoredIsOpening)`
  (lib/ledger-opening.mjs) — accounts.mjs'teki INSERT'e `opening_review` sütunu olarak tek değer. Göç öncesi yedeğin geri yüklenmesi (B8'in öbür yarısı) göçü yeniden koşar → bu turda.
- S48'in ekran sorusu: hof-cheques.js karşılıksız penceresine isteğe bağlı cari seçici (yeni ekran dosyası yok).

---

## 12. Ç5-A tur 1b (kod ajanı, 11.11.2026; taban `c5a1b-taban` 653b8a8f = tur 1 ucu) — KODDAN ÖNCE yazıldı

Kapsam (görev metni; iş listesi D "BAŞ MİMAR KARARI 11.11 13:26 … TUR 1b" ve "KULLANICI KARARI 11.11 13:29 … S127 = A"): (1) S127; (2) üç eski sürüm karşılaştırma dosyası;
(3) carisiz evrak Alacak Yaşlandırması'na girmez; (4) yeni testin eski kod kırmızısı; (5) defter / cari kâhini SÜRÜCÜLERİNİN eşlemesi + muhasebe sürücüsündeki 519 farkının kökü;
(6) hız. Tur 2'nin işleri (Açılış Eşleştirme Fişi, Kural Farkı Düzeltme Fişi, "Açılış Olabilir Kayıtlar" ekranı + zil, S14 / S25 / S39, kılavuz), S51 (routes/accounts.mjs),
Ç7a / Ç7b satırları, tek kuyruk, WhatsApp, Bilanço / Gelir Tablosu KAPSAM DIŞI.

### 12.1 S127 = A — "bir olay tek kez yazılır" (KULLANICI KARARI 11.11 13:29, AYNEN iş listesi D)
Yeniden üretim (ders 6; v2.4.9 etiketinin gerçek kodu ayrı kopyada, tur 1'in c5a1-v249-veri.mjs betiği, TZ Europe/Istanbul): v2.4.9'da gen + kilit 31.12.2025 → mizan 120 = 12.300,
Mutabakat Testi tamam; aynı veri tur 1 koduyla (`DONDUR=1 … read`, şema 49) → mizan 120 = 20.700, cariler 2.300 + 3.100 + 4.500 + 2.400 = 12.300, Mutabakat Testi
`ledger:rule-diff` (kararın sayılarıyla aynı).
KÖK NEDEN: karma okuma (C3 §9: ≤ kapsam donmuş + > kapsam canlı) kartın maddesini İKİ kuralda iki farklı güne koyar. Eski kural (2.4.9; kilitli yıl o kuralla donmuş): `plan:<id>`
B CH T / A 602 Kayıt Tarihi'nde (≤ kilit → DONMUŞ) + "Excel'de ödenmiş (açılış)" satırları (P) B 500 / A CH yükleme gününde (> kilit). Yeni kural (KG-5, B5): TEK madde B CH (T − P)
/ A 519 yükleme gününde (> kilit → CANLI). Karma: T (donmuş) + (T − P) (canlı) → 120'de T − P kadar ÇİFT (örnek: 4.500 + 2.400 = 6.900 — 13.400 − 800 + 1.200 + 6.900 = 20.700).
KURAL (kararın uygulanışı): eski kuralla (KG-5'ten önceki kural: "2.4.9" ve takma adı "2.5.0") donmuş bir dönem ile kartın iki kuraldaki yerleşimi KİLİT SINIRININ İKİ YANINA
düşüyorsa kart "eski kurala bağlı" (S127) sayılır ve canlı türetmede de BÜTÜNÜYLE ESKİ YAPISIYLA yazılır: kart maddesi Kayıt Tarihi'nde T, açılış satırları (P) kendi
günlerinde ayrı madde — kilitli yılın donmuş defterindeki madde ile canlı türetme AYNI madde kimliği + AYNI tarih + AYNI cari tutarı; karma okumada ikinci kez yazılmaz.
Hesaplar güncel kuralın açılış karşı hesabıyla (kart B CH T / A 519, açılış satırı B 519 / A CH — bütün öbür kilitli kayıtlar gibi; bankanın saklı "500"ünün türetmede 519
okunması (B3) ile aynı ilke): böylece "eski ↔ yeni kural farkı" (602 ↔ 519) öbür kilitli kayıtlar gibi `ledger:rule-diff`'te görünür, 120'de kartın çift sayımından doğan fark
kalmaz; "Açılış Karşılığı" (B2) aynı kalır (−T + P = −(T − P)). BAŞ MİMAR YORUMU (dar kontrol değerlendirir; kullanıcıya gösterilir): "bütünüyle eski kuralıyla" = kartın madde
yapısı ve tarihleri eski kuraldaki gibi; açık dönemdeki açılış satırının karşı hesabı 2.4.9'un 500'ü değil güncel açılış hesabı 519 (30.10 açılış düzeni). Eski 500 harfiyen
yazılsaydı (a) açık dönemde 500 Sermaye'ye fişsiz satır düşer, "Açılış Karşılığı (500 = fişler)" bozulur, (b) kartın 602 ↔ 519 farkı Kural Değişikliği Farkı'nda HİÇ görünmezdi —
karar metninin parantezine aykırı. İki okuma arasındaki fark yalnız açık dönemdeki P satırının 500 / 519 sınıflamasıdır (cari, Kasa, banka DEĞİŞMEZ).
Sınır (her satır sayıyla denenir — sonuçlar kanıt dosyasında ve raporda):
| | Durum | Beklenen |
|---|---|---|
| (i) | kart kilitten ÖNCE kayıtlı, kilitten SONRA yüklenmiş, yıl ESKİ kuralla donmuş (kararın örneği) | kart eski yapıda; mizan 120 = cariler; kilitli yevmiye bayt bayt aynı |
| (ii) | aynı, P > 0 ve P = 0 | ikisinde de çift yok; P = 0'da açılış satırı yok |
| (iii) | kart da yükleme de kilitli yılın içinde (§3.3 örneği) | DEĞİŞMEZ (iki yerleşim de donmuş dönemde; kart yeni kuralla, fark ruleDiff'te yıl yıl) |
| (iv) | kart da yükleme de açık dönemde | DEĞİŞMEZ (yeni kural, KG-5) |
| (v) | kilit güncellemeden SONRA konmuş (yeni kuralla donar) | özel işlem YOK; çift / eksik yok |
| (vi) | Kilidi Aç → Yeniden Kilitle | yıl yeni kuralla yeniden donar; kart artık yeni kuralla; çift / eksik yok |
| (vii) | kart silinir / Silinenler'den döner, Geri Al (import undo), açılış satırı düzeltilir | kilit kuralının izin verdiği her yolda 120 = cariler |
| (viii) | kilitsiz veri | hiçbir şey değişmez (donmuş koşu yok → kural devreye girmez) |
| ters | eski kuralın tarihi AÇIK dönemde, yeni kuralın tarihi eski kuralla donmuş yılda (Kayıt Tarihi > yükleme günü) | aynı ilke: kart eski yapıda (ne çift ne EKSİK); üretilemezse "üretilemedi" |
Bağlılığın belirlenmesi (değişen yol): `routes/ledger.mjs rows()` kart satırlarına `pinnedOld` (ve açılış satırlarına `planPinned`) koyar; karar `lib/ledger-opening.mjs`'in yeni işlevinden:
eski kurallı bölge = `ledger_snapshot_runs`'un sırayla yeniden oynatılması (tamamlanmış freeze kesitleri, thaw kırpar; bekleyen eski kurallı koşunun (göç penceresi) kesiti de
eski bölge — ara dilim o kuralla canlı türetilir). Kart ancak yerleşimleri bölgenin iki yanına düşüyorsa aday; aday için (ileri yön) kartın eski maddelerinden biri DONMUŞ
satırlarda gerçekten var mı (`ledger_snapshots` tarih indeksiyle, kimlik + eski kural) okunur — donmadan sonra açılmış / Silinenler'den dönmüş kart eski yapıya bağlanmaz. Ters
yönde (yeni yerleşim eski bölgede, kart maddesi bölge dışında) kart eski yapıda yazılır (yeni kural maddeyi donmuş döneme koyar → karma okumada görünmezdi).
`journal()` (general-ledger.mjs) `pinnedOld` kartı: `plan:<id>` Kayıt Tarihi'nde B CH T / A 519; açılış satırları B 519 / A CH (tur 1'in "Mevcut Borcu Taksitlendir" açılış satırı
dalı). Kural etiketi DEĞİŞMEZ ("2.5.0-defter": kural yayımlanmadı; B15 — aynı etiket genişler).
Okuyucular (ders 10; build() / journal() okuyan her yol): Yevmiye Defteri, Hesap Planı Mizanı, GET ledger mizanı (karma), Mutabakat Testi + kapı (canlı), `ledger:rule-diff` / ruleDiff,
Defter Mutabakatı, "Açılış Karşılığı", S53 bilgi satırı, dondurma (iş parçacığı dahil — aynı rows()), bütünlük kapısının süzgeçli yolu (rows(filter): karar kart başına aynı),
İşlem Kartı / KDV (etkilenmez), 2.4.9 kopyası (kendi rows'u; etkilenmez). Cari / taksit / Kasa / banka / stok ekranları defter okumaz.
Nasıl bozulur?: kural fazla geniş (açık dönem kartı / (iii) kartı da eski yapıya geçer — karşı mutant); kural yok (çift — karşı mutant); thaw sonrası eski kesit sayılır (vi'de çift);
bekleyen 2.4.9 koşusu sürerken (göç penceresi) çift; donmadan sonra açılan kart eski yapıya bağlanır (eksik); filtreli rows() başka karar verir (kapı sahte fark); iki TZ (yükleme
günü yerel); ters yönde eksik; P satırının tarihi düzeltilip sınırı geçer; kart silinir (kilit izin veriyorsa).
Hız: donmuş koşu yoksa tek `sqlite_master` + koşu tablosu okuması (küçük tablo); eski kurallı kesit varsa KG-5 kartları + açılış satırları için TEK SQL, yalnız sınırı aşan adaylar için
tarih indeksli tekil okuma. build() ±%5 hedefi (§6); ölçüm §12.6.
KALICI TEST (ders 53 (b)): v2.4.9 etiketinin gerçek koduyla (bootVersion) üretilmiş kilitli veri + v2.4.9'un kendi okuduğu sayılar fikstür (`test/fixtures/surum-2.4.9-s127/`, içerik
deposu surum-nesneler; üretici `test/guvenilirlik/s127-v249-veri.mjs`); test her sınıfı güncel kodla okur, v2.4.9 sayılarıyla karşılaştırır; her fark karar numarasıyla
"beklenen farklar"da, yazılı olmayan fark testi kırar.

### 12.2 Üç eski sürüm karşılaştırma dosyası (banka-210-goc-zinciri, banka-210-altin, banka-220-senet-121)
Değişen yol: `test/guvenilirlik/defter-olgulari.mjs` — Ç5-A'nın BİLİNÇLİ farkları için madde düzeyinde, karar numaralı "beklenen fark" katlaması: YALNIZ canlı (yeni kurallı)
bölgedeki maddelerde (donmuş / bekleyen 2.4.9 koşusunun bölgesi zaten eski kural), YALNIZ açılış karşılığı satırlarında ve tutar korunarak: (K1) açılış sınıfı maddelerin 519 satırı
→ 500 (Kasa, cari işaretli / aday, banka açılış / Devir Kapanışı, stok, Mevcut Borç açılış satırı; KG-1, M-01 … M-07, S47); (K2) açılış evrakı 519 → 602 (alınan) / 770 (verilen,
karşılıksız) (M-08 / M-09, S48); (K3) formdan carisiz evrak 649.90 → 602 (alınan) / 770 (karşılıksız) (S49, S66); (K4) KG-5 kartı tek madde → eski iki madde (T ve P veri
tabanından; KG-5 = A, H-06); (K5) 500'ün adı "Sermaye" ↔ "Açılış ve Devir Bakiyeleri" (§2.1). Dişi koruyan iddialar: katlanacak her 519 satırı açılış sınıfında; canlı bölgede fiş
dışında 500 satırı YOK; KG-5 maddesinin tutarı = T − P (veri tabanı); katlamadan sonra 519 / 649.90 kalmaz. Mutasyon: bir açılışı 500'de bırak, bir tahsilatı 519'a yaz, KG-5'e P'yi
ekle → test kırılmalı. Nasıl bozulur?: katlama genel "500 = 519" olur (dişsiz); donmuş bölge yanlışlıkla katlanır; bekleyen koşu yarışında bölge sınırı kayar (sınır = max(kapsam,
bekleyen eski koşunun günü)).

### 12.3 Carisiz evrak Alacak Yaşlandırması'na girmez (BAŞ MİMAR KARARI 11.11; S49 = A + kural kitabı MM5 "müşteri başına")
Değişen yol: `server/routes/report-center.mjs` "alacak-yaslandirma" `build()` — portföydeki alınan evrak döngüsünde carisi olmayan evrak atlanır; carili (Excel'den keşideci adıyla
eşleşmiş "carilere dokunmadan" dahil; S48'in cari seçtiği) evrak carisinin satırında kalır. Okuyucular (ders 10; `cheques().flows()` taraması): Alacak Yaşlandırma (ekran / PDF /
Excel aynı build'den), mobil (MOBILE_REPORT_IDS, aynı rapor ucu) → değişir; Nakit Akış, Vade Takip / zil / takvim, Banka Nakit Akış, Çek / Senet Vade Dağılımı, tahsildeki evrak
→ DEĞİŞMEZ (portföy / nakit görünümü; karar yalnız yaşlandırma). Nasıl bozulur?: carili evrak da düşer (karşı mutant); TOPLAM ≠ satırlar. Hız: yok (aynı döngü).

### 12.4 Yeni testin eski kod kırmızısı (ders 7, 38)
`test/acilis-519-250.test.mjs`: hazırlık adımları istek yanıtlarını TOPLAR, iddia etmez; her test kendi ön koşulunu kendi iddiasıyla sınar; `lib/ledger-opening.mjs` yalnız onu
sınayan testte dinamik içe aktarılır; eski şemada olmayan sütuna hazırlık yazmaz. Ürün davranışı değişmez. Aynı kusur tur 1'in öbür yeni / güncellenen testlerinde taranır.

### 12.5 Kâhin sürücüleri (YALNIZ sürücü dosyaları)
Defter (`test/bagimsiz/defter/kos.mjs`): UCLAR acilis_evrak / karsiliksiz_cari / excel_taksit_karti / kasa_duzelt (tur 1 önerisi; grup adı hilesi YOK). EX1 ailesi: programın
"Aynı adla açık kart var" koruması (v2.0.4'ten beri) DEĞİŞMEZ, sürücüde gizlenmez → kök neden + BAŞ MİMAR KARARI GEREKİYOR. Cari (`test/bagimsiz/cari/kos.mjs`): (i) mizan okunduysa
500 / 519 sıfır bakiyede 0; (ii) KARSILIKSIZ_CARI eşlemesi. Muhasebe sürücüsü DOKUNULMAZ; rastgele senaryodaki 519 farkının kökü raporlanır.

### 12.6 Hız (ders 47, 53)
Tur 1'in düzeneği kendi kopyamda (`scratchpad/c5a1b-olcum/`); yollar: Ana Defter (build + karma mizan), Yevmiye, Defter Mutabakatı, Mutabakat Testi, Alacak Yaşlandırma, açılış
(göç + donma); üç sütun: c5a-taban / tur 1 ucu / tur 1b ucu; `flock -x -n`, yük > 2 → GEÇERSİZ.

### 12.7 Sonuç (kodla birlikte; ayrıntı ve sayılar docs/kanit/2026-11-11/c5a1b-* ve teslim raporunda)
- S127: kararın örneğinde (v2.4.9 gerçek kodu) mizan 120 v2.4.9 12.300 → tur 1 20.700 → tur 1b 12.300; kilitli 2025 mizanı ve Yevmiye Defteri bayt bayt aynı; `ledger:rule-diff`
  hesapları tur 1'de 120 / 500 / 519 / 602 / 649 / 770 (120'de 8.400 — çift sayım), tur 1b'de 500 / 519 / 602 / 649 / 770 (120 yok; kartın 8.400'ü 602 ↔ 519 farkında). Kalıcı test
  (`test/s127-tek-kez-250.test.mjs`, fikstür surum-2.4.9-s127 / -kilitsiz): i, ii (P > 0, P = 0), iii, iv, v, vi, vii, viii ve TERS yön (v2.4.9'da Kayıt Tarihi sonradan
  ileri alınınca ÜRETİLDİ: tur 1'de kart açık dönemde hiç yazılmıyordu — EKSİK) sayıyla. Göç penceresinde (bekleyen 2.4.9 koşusu donmadan) de 120 = cariler.
- Ters yönün üretimi: v2.4.9 Excel yüklemesinde ileri Kayıt Tarihi'ni yükleme gününe çeker; ters yön ancak kilitten önce Kayıt Tarihi kart düzeltmesiyle ileri alınınca doğar
  (fikstürde 20.01.2026'da 10.11.2025 → 15.01.2026 / 20.01.2026).
- KG-5 dışında Ç5-A'nın madde TARİHİNİ değiştirdiği başka kural YOK (tur 1 farkındaki her `post(…)` çağrısının tarih bağımsız değişkeni tarandı: yalnız `plan:` maddesi `localDayOf
  (importedAt)`; açılış sınıfı (`cls`) yalnız sırayı değiştirir).
- Eski sürüm karşılaştırması: katlama `test/guvenilirlik/defter-olgulari.mjs` (`c5aOpeningFold`); ayrıca kural farkının kapı tabanına yazdığı kayıt (yalnız `ledger:rule-diff` getiren
  taban satırı, fark Ç5-A ile açıklanmışsa) sayılmaz.
- Katlamanın dişi: c5a-taban kodunda (Ç5-A yok) 2.0.26 verisi 'Ç5-A katlaması — kural dışı fark' ile kırmızı (92 fişsiz 500). Mutant 20'nin ilk hâli (Kasa açılışı 500'de
  kalır) eski sürüm verisinde YAKALANMADI: 2.0.16–2.0.26 fikstürlerinde Kasa açılışı yok (2.2.0'da geldi) — mutant cari açılışına (Borç Yaz) taşındı, yakalandı; Kasa
  açılışının 519'u mutant 1'de (acilis-519-250). BİLİNEN SINIR: katlamanın Kasa / banka / stok açılışı dalları eski sürüm verisiyle sınanmıyor (o sınıflar fikstürde yok).
- Muhasebe sürücüsü (rastgele-2) 519 farkı 75.300 = tek carisiz açılış çeki (evrak_acilis + evrak_karsiliksiz): program karşılıksızda carisiz evrakın açılışını 519'a geri
  yazar (B 519 / A 101); kâhinin karşılıksız maddesinde cari satırı var (sürücünün çevirisi karsilastir.py bu satırı 770'e çeviriyor) — sürücü karşılıksız adımında cari
  göndermiyor (program.mjs evrak_karsiliksiz). Cari sürücüsündeki aynı eşleme (KARSILIKSIZ_CARI) 7 kaydı kapattı. Muhasebe sürücüsüne dokunulmadı (görev sınırı);
  tanı kopyasında `v.cari` gönderildi, fark değişmedi → kâhin olayındaki cari alanının adı bilinmiyor (kâhin dosyaları okunmadı) — DOĞRULANMADI, sürücü bakımına.

---

## 13. Ç5-A tur 1c (kod ajanı, 12.11.2026; taban `c5a1c-taban` a55e47e4 = tur 1b ucu) — KODDAN ÖNCE yazıldı

Kapsam (görev metni docs/devir/2.5.0-DEVAM/c5a1c-istem.txt): (1) HIZ — defteri okuyan her yol Ç5-A öncesinin (`c5a-taban`) en çok %10 üstünde (en iyi ve ortanca), hiçbiri tur 1b
ucundan kötü değil, DAVRANIŞ AYNI; (2) B7 TEST YARIŞI (test/banka-210-gg-tarama "iki yol aynı sonucu vermeli" ara sıra kırmızı). Tur 2'nin işleri, kâhin dosyaları, S127 /
yaşlandırma kuralları KAPSAM DIŞI.

### 13.1 Profil (ders 47; ölçüm kilidiyle, yük 1,2; 100 bin satırlık şablonun kendi kopyası, kilitsiz; beş okuma yolu × 2, açılış hariç; ham çıktı docs/kanit/2026-11-12/c5a1c-profil-*)
İşlev başına KAPSAYICI süre (11 türetme), c5a-taban → tur 1b ucu: `build()` 24.520 → 27.101 ms (+2.581); bunun içinde `rows()` 20.526 → 22.883 (+2.357; `leanRows` öz süresi 8.477 → 10.387,
`iterate` 12.624 → 13.059), `journal()` + `build()` öz süresi 1.757 → 2.140 (+383; tabandaki carisiz evrak döngüsü journal()'a taşındı), sıralama (`journalOrder` kapsayıcı) 1.734 → 1.577.
Mutabakat Testi / Defter Mutabakatı `run()` öz süresi 523 → 873 (+350; yeni "Açılış Karşılığı" bloğunun JS'i: iki `ledgerBalanceOf` + `unlockedPastYears` — üç ayrı tam geçiş), `get`
(SQL) 795 → 1.053 (+258; `openingCounterpart`'ın SQL'i).
OKUMA: ek sürenin ~%90'ı `rows()`'un SATIR DÖNÜŞÜMÜ — tur 1'in kaynak sorgularına eklediği kolonlar bütün satırlarda okunur, kopyalanır ve (metinse) havuzlanır: cari satırlarına
`isOpening` + `openingReview` (102.295 satır × 2), kartlara `importId` + `importedAt` + `openingPaid` (13.992 × 3; ikisi ilişkili alt sorgu), taksit satırlarına `planImported`
(8.162), evraka `isOpening` (11.660), banka satırına `role` (339). Satır başına ek kolon ~1 µs (sözlük kipli satır + kopya); 100 bin satırlık şirkette türetme başına ~210 ms. Bu
kolonların DEĞERİ satırların çok küçük bir kısmında anlamlı (açılış işaretli / aday cari satırı, yüklenen kart); öbür satırlarda 0 / ''.

### 13.2 Değişiklikler (her biri DAVRANIŞ AYNI; okuyucular ders 10; "nasıl bozulur?")
| # | Değişen yol | Ne | Okuyucular | Nasıl bozulur? |
|---|---|---|---|---|
| H1 | routes/ledger.mjs `rows()` cari satırları | `is_opening` / `opening_review` ana sorgudan çıkar; açılış işaretli ya da aday / onaylı satırların kimlik → değerleri AYRI küçük sorguyla okunur ve YALNIZ o satır nesnelerine aynı değerlerle yazılır (öbürlerinde alan yok → `isOpeningEntry` yine false: 0 / '' / rejected ile aynı) | yalnız `journal()` (rows() başka yere verilmez: build() → GET ledger, Yevmiye, Hesap Planı / Alt Hesap Mizanı, Defter Mutabakatı, Mutabakat Testi, kapının süzgeçli yolu build(filter), dondurma iş parçacığı, ruleDiff) | süzgeçli build(filter) işaretsiz kalır (küçük sorgu süzgeçsiz okunur, yalnız gelen satırlar işaretlenir); evrakın carisiz satırları (free-in / free-out, kendi `isOpening`'leri) yanlışlıkla işaretlenir (işaretleme free satırlar eklenmeden ÖNCE); eski şema (kolon yok) |
| H2 | routes/ledger.mjs `rows()` kart / taksit satırları | `importId` / `importedAt` / `openingPaid` ve `planImported` ana sorgulardan çıkar; yalnız yüklenen kartlar (import_id ≠ '') için ayrı sorgu, değerler aynı SQL ifadeleriyle o kart nesnelerine / o kartların taksit satırlarına | yalnız `journal()` (KG-5 tek madde, açılış satırının maddesizliği); `oldRulePinnedPlans` DEĞİŞMEZ | süzgeçli yol; carisi silinmiş kart; kartın yükleme kaydı yok (importedAt '' → kartın tarihi); Mevcut Borcu Taksitlendir kartı (covers) |
| H3 | general-ledger.mjs `journal()` sonu | `out.sort(journalOrder)` → aynı karşılaştırmanın önceden hesaplanmış anahtarlarla (tarih, sınıf, yazım sırası, kimlik) kararlı sıralaması (`journalSort`); `journalOrder` AYNEN (2.4.9 kopyası ve donmuş defter onu kullanır) | journal() çıktısının sırası (Yevmiye Defteri, donmuş satırların run_seq'i, ruleDiff örnek sırası) | eşit anahtarlı iki maddenin sırası (kararlı sıralama aynı girdi sırasını korur — journalOrder ile aynı); `cls`'li madde; `seq`'siz madde (Infinity); sınıfı bilinmeyen önek (90) |
| H4 | ledger-opening.mjs `openingCounterpart` cari açılışı toplamı (integrity.mjs'e DOKUNULMAZ — görev metni integrity.mjs'i yalnız İş 2'ye açıyor) | `JOIN` → `CROSS JOIN` (yalnız birleşim sırası; iç birleşim aynı): satırlar koşulla süzülür, cari yalnız eşleşen satır için aranır (100 bin satırda ~40 → ~20 ms, tam tarama başına) | "Açılış Karşılığı (519 / 500)" denetimi (Mutabakat Testi, Defter Mutabakatı, arka plan taraması) | silinmiş cari (a.deleted_at), açılışı olmayan veri (toplam 0) |
H1 / H2 küçük sorguları satır sayısıyla orantılı değildir (işaretli satır sayısı kadar); büyük şirkette bile birkaç bin satır. İLK PLANDAN DÜŞÜLEN (kod yazılmadan, ölçüyle): "Açılış Karşılığı"
bloğunun üç JS geçişini (iki `ledgerBalanceOf` + `unlockedPastYears`; profilde tam tarama başına ~25 ms / 7.000 ms) tek geçişe indirmek integrity.mjs'i değiştirmeyi ya da dizi kimliğine
bağlı bir önbelleği gerektirir — kazanç %0,4, risk değmez. H2'nin ilk biçimi (süzgeçsiz kimlik sorgusu her türetmede) süzgeçli kapı yolunda yazım başına ~2,4 ms tam tarama ekliyordu →
süzgeçli yolda sorgu okunan kartlarla sınırlandı.

### 13.3 Eşdeğerlik (ders 47)
Aynı veri kopyasında c5a1c-taban ↔ tur 1c: GET ledger (mizan + mutabakat), Yevmiye Defteri, Hesap Planı Mizanı, Alt Hesap Mizanı, Defter Mutabakatı, Mutabakat Testi denetim
listesi, Alacak Yaşlandırma, Açılış Olabilir listesi — 100 bin şablonu kilitsiz + kilitli, depodaki eski sürüm fikstürleri, iki TZ; betik ve ham çıktı docs/kanit/2026-11-12/c5a1c-*.
Kalıcı test (yeni dosya; eşdeğerlik testidir, eski kodda kırmızı BEKLENMEZ): journalSort ≡ sort(journalOrder) (gerçek maddeler, karıştırılmış girdi, eşit anahtarlar); H1 / H2'nin
işaret yolu (süzgeçli ve süzgeçsiz build) veri tabanının kolonlarından bağımsız hesaplanan beklenenle; H4 tek geçiş ≡ eski üç geçiş. Dişi: çıktıyı bozan mutantla kırmızı.

### 13.4 B7 yarışı (İş 2) — koddan kök neden
- 2.0.26 fikstürü kilitli → açılışta göç 47'nin bekleyen 2.4.9 koşusu; app.mjs sırası: `integrity.start()` (taban) → `setImmediate(runPending)` (dondurma arkada, iş parçacığında).
- `snapshots.checks()` (ledger-snapshots.mjs): "Kural Değişikliği Farkı" yalnız KAPSAM (tamamlanmış dondurma) varken listelenir ve yalnız `ok: false` iken görünür. Ç5-A'dan önce güncel kural
  = 2.4.9 kopyası → dondurma bitince de fark yok → görünmez (yarış görünmüyordu). Ç5-A ile 2.4.9 ↔ 2.5.0-defter farkı var → dondurma bitince denetim listeye girer (64 → 65).
- Testin iki taraması (arka plan iş parçacığı, sonra satır içi) dondurmanın bitiş anının iki yanına düşünce sahte "iki yol farklı". Zorlama: ürünün YALNIZ TEST kancası
  (`__testFreezeHook` "before-done") ile dondurma son adımda tutulur (test/b7-dondurma-yaris-zorla.mjs + test/fixtures/dondurma-yaris-zorla-yukle.mjs); uyku yok.
- Test düzeltmesi: karşılaştırmadan önce ön koşul ürünün durumundan (`snapshots.runPending()` süren işi bekler; `state().pending` null, kapsam = kilit); iddialar aynen. Yeni test:
  sürerken iki yol aynı (kural farkı yok), bitince arka plan taraması ATLANMADAN yeniden koşar (dondurmanın yazımı total_changes'ı değiştirir) ve farkı görür.
- Ürün değerlendirmesi (rapor): taban (`integrity.start`) dondurmadan ÖNCE alındığı için kural farkı tabanda yok → dondurmadan sonraki ilk tarama onu "yeni sapma" sayar (C3 §8 "kapının
  tabanında" beklentisiyle çelişir) — BULGU; sayıyla rapor, düzeltme seçenekleri BAŞ MİMAR KARARI GEREKİYOR (zil / günlük davranışı).

---

## 14. Ç5-A tur 1d (kod ajanı, 12.11.2026; taban `c5a1d-taban` 595abf87 = tur 1c ucu) — KODDAN ÖNCE yazıldı

Kapsam (görev metni docs/devir/2.5.0-DEVAM/c5a1d-istem.txt): İş A (kural farkının yanlış alarmı — BAŞ MİMAR KARARI 12.11), İş C (B7 zorlamasına yeni kip), İş D (komşular, senet-121'in
ara sıra kırmızısı), İş E (tur 1c'nin koşmadığı kabul koşulları), İş B (kilitli veride Alacak Yaşlandırma'nın ilk çağrısı), İş F (kilitli veride evrak yazımı). Tur 2'nin işleri, kâhin
dosyaları, S127 / yaşlandırma kuralları KAPSAM DIŞI.

### 14.1 Yeniden üretim (koddan önce; c5a1d-taban, fikstür surum-2.0.26-zincir — kilit 05.10.2026, bugün 08.10.2026; TZ Europe/Istanbul; sonda scratchpad/c5a1d-is/sonda.mjs)
| Adım | c5a1d-taban |
|---|---|
| açılış | bekleyen 2.4.9 koşusu var; taban satırı yalnız "İleri tarihli hareket (Çek/Senet Hareketleri)"; kural farkı tabanda YOK (kapsam boş → denetim listede yok) |
| dondurma biter (ürünün runPending'i) → ilk ARKA PLAN taraması | bulgu `ledger:rule-diff (44)`; Mutabakat Günlüğü +1 "scan" satırı; zil 1 (`integrity.alert` [ledger:rule-diff]); sunucu günlüğü "Mutabakat taraması: kapının görmediği 1 yeni sapma (Kural Değişikliği Farkı (Kilitli Dönem: 05.10.2026 ve Öncesi))." |
| sonra satır içi tarama (Mutabakat Testi yolu) / ikinci arka plan taraması | bulgu yok (imza artık `known`'da); denetim listesinde `ledger:rule-diff` ok false, 44 madde, fark 127.800 |
| programın yeniden açılması | taban satırı YENİDEN yazılır: "Kural Değişikliği Farkı (Kilitli Dönem: 05.10.2026 ve Öncesi); İleri tarihli hareket …" + sunucu "güncelleme öncesinden kalan 2 sapma var (Kural Değişikliği Farkı …)" — kural farkı burada da "sapma" adıyla |
| yeniden açılıştan sonraki ilk yazım (Kasa girişi) | tam kapı, neden "taban sapması (all)" (`familyOf('ledger:rule-diff')` = "all"; integrity-scope.mjs) — ilk tam kapı yazımından sonra taban kapının kendi koşusuyla yenilendiği için yalnız oturumun ilk yazımı |
Kök neden (koddan): `integrity.mjs` `settleScan` (iki tarama yolunun ortak işleyicisi) "yeni sapma"yı `failures − notice − known` diye bulur; `known` açılışta `start()`'ın tabanıdır. Kural farkı
(`ledger:rule-diff`, `severity: "warning"`, ok false) notice DEĞİL → sapma kümesinde. Açılışta dondurma bekliyorsa (app.mjs: önce `integrity.start()`, sonra `setImmediate(runPending)`)
denetim yoktur; dondurma bitince ilk tarama onu "yeni" bulur. Yeniden açılışta ise tabana "sapma" olarak girer.

### 14.2 Seçilen yol: kural farkı "yeni sapma" karşılaştırmasının DIŞINDA (uyarı; sapma değil)
`integrity.mjs`'te sapma kümesini kuran iki yer (`start()` tabanı ve `settleScan`) `ledger:rule-diff`'i notice gibi DIŞARIDA bırakır (tek yardımcı: `driftsOf`). Denetimin kendisi
(`result.checks` / `result.failures` — Mutabakat Testi satırı ok false + madde sayısı + fark; Defter Mutabakatı; Kural Değişikliği Farkı raporu; `ruleDiff()`) DEĞİŞMEZ.
Gerekçe (karar metninin iki seçeneği karşılaştırıldı):
- (a) "dondurma bitince tabana al": dondurmanın bitişini kapıya bildirmek (ledger-snapshots `freezeRun` → integrity) + bayat tarama yarışı (iş parçacığının anlık görüntüsü bitişten önce
  alınmış, sonuç bitişten sonra işlenir) için kapsam işareti gerekir — iki dosya, yeni durum; yeniden açılışta tabana "sapma" diye girmeyi (14.1 son iki satır) ÇÖZMEZ (karar: "sapma
  sayılmaması"). (b) dışarıda tutmak: tek dosya (integrity.mjs), tek yardımcı; yeniden açılış, kilit değişimi, geri yükleme, ikinci şirket aynı kuralla; kapı yolunu değiştirmez
  (denetim zaten kapıda koşmaz — C3 §8 K3: `run({ events })` dokunulan olayla çağrılınca `snapshots.checks` atlanır). (b) seçildi.
- C3 §8'in "kapının tabanında" sözünün anlamı "yeni işlemleri ENGELLEMEZ"dir (aynı cümle); (b) bunu korur: denetim kapıda koşmadığı için hiçbir yazımı engellemez. (b)'nin yan etkisi
  yeniden açılışta tabandan çıkmasıdır → `baselineFamilies`'te "all" oluşmaz → oturumun ilk yazımı süzgeçli yolda kalabilir (sonuç aynı: süzgeç ↔ tam kapı eşdeğerliği gateVerify'da
  denetlenir; yalnız yol ucuzlar).
- integrity-scope.mjs'e (familyOf) DOKUNULMAZ (dosya sınırı); (b) onu gerektirmez.

### 14.3 Değişen yardımcının okuyucuları (ders 10; `start` / `settleScan` / `known` / `baseline` / `baselineFamilies` taraması)
| Okuyucu | Etki |
|---|---|
| Mutabakat Günlüğü (`integrity_log`: "baseline" açılışta, "scan" taramada) — Yönetim → Mutabakat Testi altındaki günlük (`GET /api/workspace/ledger/integrity` `log`), `recent()` | kural farkı ne taban ne tarama satırına girer (başka sapmalar aynen) |
| zil (`integrity.alert`, yöneticiler) + sunucu günlüğü ("kapının görmediği N yeni sapma", "güncelleme öncesinden kalan N sapma") | kural farkı yüzünden yayımlanmaz / yazılmaz; başka sapmalar aynen |
| `lastScan.findings` | kural farkı girmez |
| COMMIT kapısı: `baseline` (tam kapının "taban sapması mı" kararı), `baselineFamilies` (süzgecin tam kapıya yönlendirmesi), `legacyRows` | kapının kendi koşusunda kural farkı zaten yok (dokunulan olayla run) → karar aynı; yalnız yeniden açılıştan sonraki ilk yazımın YOLU ("all" yok) |
| Mutabakat Testi (`scan().result`), Defter Mutabakatı (`run().checks`), arka plan sonucu, Kural Değişikliği Farkı raporu | DEĞİŞMEZ (sonuç nesnesi aynı) |
| noticeGrowth (Kasa uyarısının artışı) | DEĞİŞMEZ (yalnız notice'leri sayar) |

### 14.4 "Nasıl bozulur?" (önce yazıldı; testler buradan — sonuçlar kodla birlikte 14.6'da)
1. Dondurma sürerken tarama: denetim yok → bulgu yok (değişmez).
2. Dondurma bittikten sonraki İLK tarama (arka plan VE satır içi ayrı): günlük satırı, zil, sunucu "yeni sapma" YOK; denetim listesinde kural farkı satırı VAR (ok false, sayı, fark).
3. İkinci tarama: aynı (sessiz).
4. Dondurmadan sonra programın yeniden açılması: taban satırına / sunucu "kalan sapma" iletisine kural farkı GİRMEZ; ilk tarama sessiz; denetim satırı VAR.
5. Kilitsiz veri (dondurma yok): denetim hiç yok; gerçek sapma eskisi gibi bulunur (gerileme yok).
6. Kilit tarihinin oturum içinde değişmesi / Kilidi Aç → Yeniden Kilitle / yeniden dondurma: kural farkının sayısı / tutarı değişir — kullanıcının (kapının gördüğü) işinin sonucudur, "kapının
   görmediği yeni sapma" DEĞİL → sessiz (önce: imza değiştiği için zil çalardı — aynı yanlış alarm ailesi).
7. Kural farkının TUTARININ sonradan değişmesi (aynı kapsam, aynı kural): olası nedenler (i) kilitli dönemin kaynağının kapı dışından değişmesi → `period-lock` ("Kapanmış dönem … kapının
   görmediği bir yolla değişti") ve `ledger:snapshot` ("Donmuş Dönemin Kaynağı Değişti") ayrı sapma olarak BULUNUR (bu düzeltme onlara dokunmaz); (ii) donmuş satırların dışarıdan
   değişmesi → `ledger:snapshot` "Satırları Değişmiş" BULUNUR; (iii) kapının kabul ettiği açık dönem yazımının kilitli dönemin CANLI türetmesini kaydırması (ör. eski kurala bağlı kart)
   → kapının gördüğü iş, sapma değil (Kural Farkı Düzeltme Fişi — tur 2 — farkı okur). Değerlendirme: kural farkının tutarı tek başına "kapının görmediği yazım" kanıtı değildir;
   gerçek nedenler kendi denetimleriyle bulunur → yeni sapma SAYILMAZ. Para / bakiye / kapama kuralı değil (yalnız bildirim sınıflaması; defter, mizan, fark tutarı aynı) →
   KULLANICIYA SORULMASI gerekmez; BAŞ MİMAR YORUMU olarak rapora yazılır. (i) testte sınanır.
8. Kural farkıyla AYNI taramada gerçek bir sapma (kapı dışı bozuk kuruşlu Kasa satırı): o sapma bulunur, günlüğe yazılır, zil + sunucu iletisi çıkar; kural farkı listede yok.
9. Yedekten geri yüklenen kilitli eski veri: geri yükleme = dosya takası + açılış → 4 ile aynı yol.
10. İkinci şirket: her şirketin kendi kapısı / tarama işleyicisi — aynı kural (yardımcı şirkete özgü durum tutmaz).
11. Arka plan taraması ↔ satır içi tarama ↔ yazma kapısı: iki tarama yolu aynı `settleScan`'den geçer; kapı kural farkını hesaplamaz → üçü tutarlı.
12. Genişletme hatası (mutant): "dondurmadan sonra hiçbir şey yeni sapma sayılmaz" → 8 yakalar; geri alma (mutant) → 2 yakalar.

### 14.5 İş A — sonuç (kodla birlikte; kanıt docs/kanit/2026-11-12/c5a1d-isA-*)
Değişen: `lib/integrity.mjs` — tek yardımcı `driftsOf` (notice ve `ledger:rule-diff` dışarıda), `start()` tabanı ve `settleScan` ondan okur. app.mjs ve ledger-snapshots.mjs'e DOKUNULMADI.
Sonda (surum-2.0.26-zincir, TZ Europe/Istanbul; c5a1d-taban → tur 1d):
| Adım | Önce | Sonra |
|---|---|---|
| dondurmadan sonraki ilk ARKA PLAN taraması | bulgu `ledger:rule-diff (44)`; Mutabakat Günlüğü +1 "scan"; zil 1 (`integrity.alert` [ledger:rule-diff]); sunucu "kapının görmediği 1 yeni sapma (Kural Değişikliği Farkı …)" | bulgu yok; günlük +0; zil 0; sunucu iletisi yok |
| ilk tarama SATIR İÇİ (Mutabakat Testi ucu; ayrı açılış) | `lastScan.findings` [ledger:rule-diff]; günlük +1 | [] ; +0 |
| denetim listesindeki uyarı | `ledger:rule-diff` ok false, 44 madde, fark 127.800 | AYNEN |
| yeniden açılış | taban satırı "Kural Değişikliği Farkı (Kilitli Dönem: 05.10.2026 ve Öncesi); İleri tarihli hareket …"; sunucu "kalan 2 sapma" | taban satırı yalnız "İleri tarihli hareket …"; "kalan 1 sapma" |
| yeniden açılıştan sonraki ilk yazım (gateVerify kipinde) | tam kapı, neden "taban sapması (all)" | tam kapı, neden "doğrulama" (gateVerify'ın kendisi; üretim kipinde süzgeçli yol) |
| aynı taramada gerçek sapma (kapı dışı 1,005 TL Kasa satırı) | 4 bulgu (kural farkı + cents:cash_entries + money:report + money:event); günlük 1; zil 1 | 3 bulgu (kural farkı YOK); günlük 1; zil 1; sunucu iletisi Kuruş… |
"Nasıl bozulur?" (14.4) sonuçları: 1 değişmez (denetim yok); 2–4 kalıcı testte (iki TZ) sessiz + uyarı satırı var; 5 kalıcı testte (kilitsiz S127 fikstürü) gerçek sapma bulunur; 6 kapı kural farkını hiç
hesaplamadığı için kilit değişimi / yeniden dondurma yeni sapma üretmez (gerekçe 14.4; ayrı test YOK — DENENMEYEN); 7 (i) kalıcı testte: kilitli dönemin Kasa satırı kapı dışından değişince
`period-lock` VE `ledger:snapshot` yeni sapma (günlük 1, zil 1), kural farkı bulgu değil; 7 (ii)–(iii) DENENMEYEN (gerekçe 14.4); 8 kalıcı testte; 9 geri yükleme = açılış (DENENMEYEN —
yol 4 ile aynı); 10 DENENMEYEN (şirkete özgü durum yok); 11 iki tarama yolu ayrı açılışlarda sınandı; 12 mutantlar: geri alma (fail 4) ve "dondurmadan sonra hiçbir şey" (fail 2) ve
"her uyarı düzeyli denetim dışarıda" (fail 1) iki TZ'de YAKALANDI. Eski kod (c5a1d-taban kopyası) 1/5: [1] arka plan "kural farkı yeni sapma sayılmamalı: ["ledger:rule-diff"]",
[3] "yeniden açılışın taban satırında kural farkı olmamalı", [1] satır içi "satır içi ilk taramada bulgu yok … ['ledger:rule-diff']", [2] "kural farkı bulgu değil"; [4] (kilitsiz) eski
kodda da yeşil (gerileme denetimi).

### 14.6 İş C — B7 zorlamasının kendi kusuru ve 'gozlem' kipi
- KÖK NEDEN (yeniden üretildi; çağrı yığını): zorlama, programın açılış runPending çağrısını "sarmalayıcının setImmediate'i koşana kadarki çağrılar" diye ayırıyordu. bootVersion'ın listen'ı
  çözülünce test runPending'i programın setImmediate'inden ÖNCE çağırabiliyor → testin çağrısı "açılışın" sayılıp kanca bırakılmıyor, test de kancayı bekliyordu (ürün asılması değil).
  Düzeltme: kanca dosyası app.mjs'teki TEK açılış çağrısını yükleme anında işaretler (bulunamazsa yükleme düşer; donmuş defteri olmayan eski sürümün app.mjs'i zorlanmadan geçer).
- 'gozlem' kipi: testin İLK adımı (kendi runPending beklemesi ya da ilk arka plan taraması) başladığında kanca dondurmayı GERÇEKTEN tutuyordu (before-done'a vardığı olayla beklenir,
  adımın kendi beklemesiyle yarışır — asılma yok); bırakma o adım gözlenerek: runPending'de hemen, taramada tarama bittikten sonra. Ön koşul = ilk adımda kanca tutuyordu + bırakma adımla +
  sonra bitti. Sayılar: yeni test 20/20 ön koşul + yeşil (UTC, İstanbul); eski test (tur 1b kopyası + yeni yardımcılar) 20/20 ön koşul + kırmızı "iki yol aynı sonucu vermeli" (iki TZ);
  gg-tarama normal koşu 20 × iki TZ yeşil.
- B7 dosyasının tur 1c iddiaları İş A'dan ETKİLENMEZ: kural farkı sonucun `checks`'inde kalır (İş A yalnız bulgu / günlük / zil / tabanı değiştirir) — "sürerken iki yol aynı", "bitince
  arka plan taraması atlanmadan yeniden koşar ve farkı görür" satırları değişmedi.

### 14.7 İş F — kilitli veride evrak yazımı (ders 47)
- PROFİL (100 bin şablonu, kilit 2026-06-30, 2.4.9'la donmuş; yüklü makinede — sayılar oran içindir): evrak yazımının kapısı s.cheque 1,0 (c5a-taban) → 4,3 ms (tur 1c); süzgeçli
  `build({ cheques: [1] })` 0,62 → 3,59 ms, `build({ parties: [1 hafif cari] })` 0,86 → 3,96 ms (tur 1b'de de aynı). CPU profili: süzgeçli build başına ~2,5 ms `oldRulePinnedPlans`
  (S127 bağlılık kararı: her çağrıda BÜTÜN yüklenen kartlar + açılış satırları + aday başına donmuş satır okuması).
- DEĞİŞİKLİK (davranış aynı): routes/ledger.mjs `rows()` kararı kart / taksit satırı okunmadıysa SORMAZ; süzgeçli yolda yalnız okunan kartlar (+ taksit satırlarının kartları) için sorar
  (`oldRulePinnedPlans(store, { ids })`). Karar kart başına (kartın kendi maddeleri + koşu tablosunun bölgesi) → sonuç = süzgeçsiz karar ∩ ids. Sonra: süzgeçli build 0,88 / 1,2 ms,
  kapıda s.cheque 1,3 ms. Okuyucular: yalnız `journal()` (pinnedOld / planPinned) — süzgeçsiz türetme (GET ledger, Yevmiye, mizanlar, Mutabakat Testi, dondurma, ruleDiff) kararı
  eskisi gibi bütün kartlar için alır (kart okunmadıysa işaretlenecek nesne yok).
- Eşdeğerlik: test/defter-hiz-esdegerlik-tur1d-250.test.mjs (S127 kilitli / kilitsiz, 2.0.26; iki TZ) + tur 1c'nin H2 testi; mutasyon (4 mutant) kanıtta; 100 bin eşdeğerliği İş E (a).

### 14.8 İş B — kilitli veride Alacak Yaşlandırma'nın ilk çağrısı
- KÖK NEDEN (sonda; yüklü makinede — oran): Alacak Yaşlandırma defter OKUMAZ. Ölçüm düzeninde ondan hemen önce Mutabakat Testi koşar; tur 1c'de bu tarama kural farkını "yeni sapma" sayıp
  Mutabakat Günlüğü'ne satır YAZIYORDU (İş A'nın yanlış alarmı) → bağlantının total_changes'ı arttı → total_changes anahtarlı önbellekler (routes/plans.mjs iade kesimleri, routes/invoices.mjs
  settleKey, lib/bank/money-lines.mjs, lib/bank/collections.mjs) geçersiz → ilk Alacak Yaşlandırma onları yeniden kurdu. İkinci turda Mutabakat Testi yeni bulgu yazmadığı için fark yok.
  Sonda: ilk çağrı tur 1c 3.040 ms (günlükte 1 "scan" satırı), c5a-taban 2.367 ms, tur 1d 2.070 ms; ikinci çağrılar ≈ eşit. İş A ile giderildi (ayrı kod değişikliği YOK).

### 14.9 İş D — komşular
- senet-121 "eski sürümün verisi yeni kuralla": KÖK NEDEN (zorla üretildi, DONDURMA_YARIS=bitir; ders 20): eski sürüm (v2.1.0) verisi kilitli → açılışta bekleyen 2.4.9 dondurması arkada; Mutabakat
  Testi dondurma BİTTİKTEN sonra okunursa Ç5-A'nın kural farkı (banka açılışı 500 → 519: 100.000; formdan carisiz senet 649 → 602: 200; 2 madde, fark 100.200) `ok: false` yapıyordu
  ("false !== true"). Doğal koşuda Mutabakat Testi çoğunlukla dondurma bitmeden geldiği için yeşildi (yanlış nedenle). İş A'nın düzelttiği davranış DEĞİL (İş A sonucun ok'unu
  değiştirmez) — ama aynı dondurma yarışı. Düzeltme (test): ön koşul ürünün durumundan (runPending SINIRLI); iddia GÜÇLENDİ: kural farkı dışında hiçbir denetim düşmez, kural farkı YALNIZ
  kararın açıkladığı hesaplarda ve senaryonun elle yazılmış tutarlarında (500 / 519 / 602 / 649), Mutabakat Günlüğü'nde tarama satırı YOK (bu iddia İş A'yı sayıyla gösterir: yeni test
  eski üründe 5/5 kırmızı "Mutabakat Günlüğü'ne tarama (sapma) satırı yazılmaz"). Sayılar: yeni test bitir 10/10 + gozlem 10/10 ön koşul + yeşil × iki TZ; eski test bitir 10/10 ön koşul +
  kırmızı (beklenen neden) × iki TZ. NOT: git archive kopyasında etiket yoktur → eski sürüm karşılaştırması ATLANIR (ilk koşu geçersizdi; etiketler GIT_DIR ile — zorlama betiği artık
  atlanan testi ayrıca yazar).
- Yedi dosya × iki kip (UTC; c5a1d-isD-yedi-dosya-ozet.txt): senet-121 tut / bitir yeşil (ön koşul var); tahsile-ver bitir yeşil, tut KIRMIZI — zorlamanın yapısı: kanca dondurmayı
  before-done'da süresiz tutarken test kilidi kaldırınca PUT period-lock süren dondurmayı iptal edip bekler (`cancel()` yalnız iş parçacığını sonlandırır; kancadaki bekleme iptali görmez)
  → istek 300 sn'de düşer (yeniden üretildi: satır 327 `lockPeriod("")`); üründe kanca yoktur, before-done'da bekleme yoktur → KAPALI (zorlamanın yapay asılması). goc: bitir yeşil, tut
  aynı nedenle kırmızı (satır 296 kilidi kaldırma). iade-210-onarim: bitir yeşil; tut ön koşulu oluşmadı (dondurma test bitene kadar before-done'a varmadı — test dondurma SÜRERKEN koştu,
  yeşil) → iddiaları kart / taksit tutarlarını okur, iki durumda da yeşil → KAPALI. gg-kapi: iki kip yeşil (ön koşul var) → KAPALI. fis-defteri-kayit: dönem kilidi yok (postAll kilitsiz) →
  dondurma yok → KAPALI. koruma-taban: tut yeşil (ön koşul oluşmadı), bitir KIRMIZI 5 fikstürde "tam kapıyı tetikleyen taban sapması: ledger:rule-diff→all" → YARIŞA AÇIK: testin taban
  modeli Mutabakat Testi'nin failures'ı (notice hariç) idi; İş A'dan sonra ürünün tabanı (driftsOf) kural farkını içermez. Düzeltme (test): şirketin bekleyen dondurması SINIRLI beklenir,
  taban = ürünün sapma kümesi; yazım yolu iddiası (Borç Yaz ve Kasa Giriş süzgeçli yolda) AYNEN — kural farkı olan şirkette de. Sonra: 20/20 × iki TZ, bitir 20/20 yeşil.
- İş A'nın komşuları (Mutabakat Günlüğü / bulgu / zil / taban okuyan 38 test dosyası, taramayla) G2 listesinin içinde (İş E (b)).

### 14.10 İş E — kabul koşulları ve ölçüm durumu (kanıt docs/kanit/2026-11-12/c5a1d-isE-*)
- (a) 100 bin eşdeğerlik (aynı şablonun ayrı kopyaları; kilitsiz + kilitli; iki TZ; 15 çıktı: GET ledger iki biçim, Yevmiye üç dönem, Hesap Planı Mizanı iki dönem, Alt Hesap Mizanı, Defter
  Mutabakatı, Mutabakat Testi, Alacak Yaşlandırma, Açılış Olabilir iki biçim, build() ve süzgeçli build): tur 1b ucu ↔ tur 1c ucu 4 çift × 15 = hepsi birebir. Tur 1c ucu ↔ tur 1d ucu
  (100 bin + bütün sürüm fikstürleri) 42 çift: 30 birebir; 12 çiftte (kilitli: 100 bin × 2 TZ, 2.0.24 / 2.0.25 / 2.0.26-turler / 2.0.26-zincir / 2.4.9-s127 × 2 TZ) YALNIZ Mutabakat Testi
  yanıtının `log` alanı: tabanda 1 fazla "scan" satırı "Kural Değişikliği Farkı (Kilitli Dönem: …)" — günlük dışı bütün alanlar (denetim listesindeki kural farkı satırı dahil) AYNI. Başka fark YOK.
- (b) G2: 121 dosya (tur 1c + bu turun ürün dosyalarını adıyla / API yoluyla anan + İş A okuyucuları + kabul E'nin iki dosyası) 1.364/1.364 × iki TZ (son kod).
- (c) e2e: defter / mizan / dondurma / Mutabakat Testi ekranlarına dokunan 34 senaryo (tarama + Ç5-A'nın iki senaryosu + run.mjs): 33 geçti; senaryo-iz1-kasa-acilis Ç5-A tur 1'den beri
  bu dalda 19/21 (c5a1d-taban kopyasında aynı iki satır: "500 = −25.000"): beklentisi M-01'e göre (B 100 / A 519, 500 boş) güncellendi → 21/21 × iki TZ.
- İş B / İş F ÖLÇÜMÜ (flock -x): ÖLÇÜLEMEDİ — tur sonunda ölçüm kilidi ana oturumun Ç5-B aday e2e koşusunda (paylaşımlı) tutuluyordu; bekleme döngüsü kurulmadı (ders 50). Düzenek hazır:
  scratchpad/c5a1d-olcum/hepsi.sh (c5a-taban · tur 1c · tur 1d kilitli + taban / tur 1d kilitsiz; kos.sh = c5a1b-olcum'un kopyası, çıktı c5a1d-olcum/olc-*.txt).

## 15. Ç5-A tur 1e (kod ajanı, 12.11.2026; taban `c5a1e-taban` c40c012d = çalışma dalı ucu, Ç5-A birleşimi 8e90f9cf içinde) — KODDAN ÖNCE yazıldı

Kapsam (görev metni docs/devir/2.5.0-DEVAM/c5a1e-istem.txt; dar kontrol raporu docs/devir/2.5.0-DEVAM/dk-c5a1-rapor.md): İş 1 G-1 (kilitli dönemin kapı dışı bozulması), İş 2 G-2 (S51 = A —
Silinenler'den dönen satırın KG-16 durumu), İş 3 ORTA-3 (göç 48 ön süzgecinin boşluk kümesi), İş 4 DÜŞÜK-1 / DÜŞÜK-2 (yalnız test). Tur 2'nin işleri, istemci, kâhin, Ç5-B'nin dosyaları
KAPSAM DIŞI. Tur 1d'nin kararı ("kural farkı sapma kümesinin DIŞINDA") AYNEN kalır: `driftsOf` değişmez, ilk taramanın yanlış alarmı geri gelmez.

### 15.1 Kök neden (koddan; dar kontrolün tablosu)
Türetmenin Ç5-A ile gelen girdileri — `cash_entries.is_opening`, `account_entries.is_opening`, `account_entries.opening_review`, `cheques.is_opening`, `plans.import_id` +
`plan_imports.created_at` — kilit izinde (integrity.mjs LOCK_SQL) YOK (B4 / göç 48 / 49 "bilinçli sınır"). Kilitli dönemin kaynak değişikliğini bulan üç mekanizma (kapının kilit izi →
`period-lock`; donmuş defterin kaynak izi → `ledger:snapshot` "Donmuş Dönemin Kaynağı Değişti"; taramadaki `period-lock`) bu alanları görmez. Tur 1d'den önce bu değişiklik yalnız
"Kural Değişikliği Farkı"nın imzası değiştiği için (yan etkiyle) bulunuyordu; tur 1d kural farkını sapma kümesinden çıkarınca (doğru) bulunmaz oldu. Yani tur 1d'nin "kapı dışı değişiklik
kendi denetimleriyle bulunur" cümlesi bu beş alan için yanlıştı — eksik olan, onların kendi denetimleriydi.

### 15.2 Seçilen yol (BAŞ MİMAR KARARI GEREKİYOR — görev metninin önerdiği yoldan farklı; gerekçe aşağıda, ana oturum değerlendirir)
(1) DÖRT İŞARET KİLİT İZİNE GİRER (B4'ün "işaret kilit izine EKLENMEZ" sınırı bu dört alan için kaldırılır): LOCK_SQL'e `since: "2.5.0"` girdileri — kilitli dönemdeki açılış işaretli Kasa
satırları (`cash_entries` is_opening = 1), açılış işaretli cari satırları (`account_entries` is_opening = 1), açılış evrakı (`cheques` is_opening = 1, alış / veriliş tarihi kilitte), Kayıt
Tarihi kilitte olan YÜKLENMİŞ kartlar (`plans.import_id` + yüklemenin `plan_imports.created_at`'ı). Satır KİMLİKLERİYLE girerler (sayı / toplam değil): sayısı ve tutarı değişmeden yalnız
hesap dağılımını değiştiren yazım (bir carinin işareti 1→0, başka carinin aynı tutarlı satırı 0→1) da izi değiştirir. LOCK_SQL_VERSION "2.5.0" KALIR (2.5.0 yayımlanmadı; eski sürümlerin
izleri `since` ile aynen). Süzgeç (integrity-scope.mjs LOCK_FIELDS) aynı alanları bilir — kapı ↔ süzgeç eşdeğerliği korunur. Sonuç: kapı dışı değişiklik bugünkü kilitli kaynak değişikliği
gibi bulunur — tarama: `period-lock` ("kapının görmediği bir yolla değişti") + `ledger:snapshot` ("Donmuş Dönemin Kaynağı Değişti") → Mutabakat Günlüğü + zil + sunucu iletisi; yeniden
açılışta donmuş defterin kaynak izi (koşuda saklı) yine tutmaz → `ledger:snapshot` SAPMA olarak Mutabakat Testi'nde ve açılış taban satırında kalır; kural farkının açıklaması
(`ruleDiffHint`) "kaynak kayıtlar değişti" der. Çözüm kullanıcıda: Kilidi Aç → Yeniden Kilitle (Ç3'ün bugünkü yolu).
(2) KG-16 DURUMU (`opening_review`) KİLİT İZİNE GİRMEZ (K8-2: kilitli satırda kapıdan geçerek değişir) — onun yerine satır başına KAPININ YAZDIĞI DURUM tutulur: yeni sütun
`account_entries.opening_review_gate` (GÖÇ 50; göçte `opening_review`'in kopyası). Durumu yazan her program yolu (göç 48 + 50, KG-16 kararı, Silinenler'den geri alma) iki sütunu AYNI
işlemde yazar. Tam taramada (açılış, Mutabakat Testi, arka plan, Defter Mutabakatı — COMMIT'te DEĞİL) yeni denetim `opening:review` "Açılış Olabilir Kararları (Kapının Yazdığıyla Aynı)":
iki sütunu farklı satır sayısı; yalnız bozukken görünür (sağlıklı şirketin denetim listesi değişmez). Kilitli / açık dönem ayrımı yok (açık dönemdeki kapı dışı değişiklik de defteri
519 ↔ 602 / 770 sessizce kaydırıyordu). Satır, Açılış Olabilir listesinden yeniden karar verilince düzelir (karar iki sütunu yazar; iki sütundan biri kararlıysa satır karar alır).
NEDEN ÖNERİLEN YOL (kural farkı dökümünün parmak izini kalıcı taban yapmak) DEĞİL:
- Parmak izi "kilitli dönemin canlı türetmesi değişti" der; kapıdan geçen her meşru değişiklik, ayrı bir "açıklayan olay" olarak bildirilmedikçe yanlış alarmdır. Kilitli dönemin canlı
  türetmesini kapıdan geçerek değiştiren yollar bu turun dosya sınırının DIŞINDA da var: Kayıt Tarihi kilitten sonra olup yüklemesi kilitte olan kartın silinmesi / yüklemenin geri alınması
  (plans / plan-transfer), cariye işlenmemiş açılış evrakının sonradan cariye bağlanması, defteri etkileyen ayar değişiklikleri. Her biri tur 1d'nin düzelttiği yanlış alarm ailesinden yeni
  bir üye olurdu (DERS 46 izlemesi: gerileme riski).
- Yeniden açılış güvencesi: taban "kapının bildiği olayda AYNI İŞLEMDE" yenilenecekse olayın anında parmak izi gerekir = tam türetme (100 bin satırda ~3 sn) her KG-16 kararında / her biten
  dondurmada; ucuz yol (taban "bayat" işaretlenip sonraki taramada yenilenir) bayat penceresindeki kapı dışı yazımı yutar — program kapanmadan önceki son yazım hemen her zaman bu penceredir.
- Seçilen yol veri düzeyinde: kapıdan geçen yazım bu dört işareti kilitli satırda HİÇ değiştirmez (tarama: yalnız göçler ve INSERT'ler yazar; kilitli tarihe INSERT / DELETE zaten 409),
  `opening_review_gate`'i kapının kendi yolları yazar → yeni yanlış alarm yüzeyi yok; "aynı işlem" yapı gereği (iz veriden hesaplanır; gölge sütun aynı UPDATE / INSERT'te); taban
  diye ayrı bir şey tutulmaz → "her taramada yenilenen / açılışta sessizce yenilenen taban" kusuru doğamaz; maliyet birkaç SQL.
- Yalnız kilit izine alan eklemek TEK BAŞINA yetmezdi (dar kontrol): `opening_review` için doğru — o yüzden (2).
SINIR (BİLİNEN SINIR adayı; ana oturuma): Kayıt Tarihi kilitten SONRA, yükleme günü kilitte olan kart (KG-5 maddesi kilitli dönemde) izde yok — yerel gün SQL'de hesaplanamıyor; UTC gününe
genişletmek meşru geri almayı reddettirirdi. Bu kartın kapı dışı değişikliği yalnız kural farkının sayısında görünür (Ç5-A öncesi kuralda kart kilitli döneme hiç düşmüyordu; yeni sınır
KG-5'in kendisinden). Kâhin / tur 2 notu: Kural Farkı Düzeltme Fişi, `ledger:snapshot` kaynak / satır bozukluğu ya da `opening:review` sapması varken yazılmamalı (fark kural farkı değildir).

### 15.3 "Nasıl bozulur?" (önce yazıldı; testler buradan — sonuçlar kodla birlikte 15.6'da)
1. Dondurma sürerken tarama ve bittikten sonraki ilk tarama: kural farkı yine sapma DEĞİL (tur 1d testi AYNEN yeşil); yeni izin girdileri dondurmanın kaynak iziyle kapının iziyle aynı
   tanımla hesaplanır → dondurma bitince `adoptLock` / kaynak izi karşılaştırması yanlış "değişti" demez.
2. Kapı dışı yazım (beş tür: Kasa işareti 0→1, cari işareti 0→1 ve 1→0, KG-16 durumu, evrak işareti, kartın yükleme bağı): satır içi tarama VE arka plan taraması → bulgu + Mutabakat Günlüğü
   "scan" satırı + zil; Mutabakat Testi'nde sapma.
3. Programın yeniden açılması (kapalıyken yapılan kapı dışı yazım): açılışın tam taramasında sapma (Mutabakat Testi'nde, açılış taban satırında, sunucu iletisinde) — sessizce
   kaybolmaz (kaynak izi koşuda, gölge sütun satırda saklı). Açılışta zil yok (taban sapması — bugünkü düzen; o an bağlı ekran yok).
4. Sayı ve tutar aynı, yalnız hesap dağılımı değişir (iki carinin işaretleri yer değiştirir): bulunur.
5. Meşru olaylar (hepsi SESSİZ: bulgu / günlük / zil yok, yazım reddedilmez): kilitli satırda KG-16 onayı ve reddi (K8-2); kilidin ilerletilmesi / kaldırılması / yeniden kilitleme (yeni
   dondurma); yedekten geri yükleme; Şirket Verisini Sıfırla; sürüm güncellemesi (göç 50 ilk açılışta gölgeyi doldurur; kural sürümü izi etkilemez); Silinenler'den geri alma (S51).
6. İki şirket: iz ve gölge şirketin kendi dosyasında; bir şirketteki kapı dışı yazım öbürünü etkilemez.
7. Yarıda kesilme: gölge sütun ile durum aynı işlemde (karar: aynı `store.tx`; geri alma: aynı INSERT); iz ayrı yazılmaz.
8. Kapı ↔ süzgeç: kilitli satırda işaret değiştiren bir mağaza yazımı (testte) süzgeçte de "kilitli dönem" → tam kapı → 409 (eşdeğerlik ihlali yok).
9. Mutantlar (testin dişi): işaretler izden çıkar; izde kimlik yerine yalnız sayı / toplam (dağılım kaybolur); karar gölgeyi yazmaz (meşru olayda yanlış alarm); açılışta / her taramada gölge
   durumdan kopyalanır (kapı dışı yazım yutulur) — hepsi kırmızı olmalı.

## 16. Ç5-A tur 1f (kod ajanı, 13.11.2026; taban `c5a1f-taban` 2e257e21 = çalışma dalı ucu, tur 1e birleşimi d2d39258 içinde) — KODDAN ÖNCE yazıldı

Kapsam (görev metni docs/devir/2.5.0-DEVAM/c5a1f-istem.txt; dar kontrol raporu docs/devir/2.5.0-DEVAM/dk-c5a1e-rapor.md G-1', DÜŞÜK-A; kaynak taraması
docs/devir/2.5.0-DEVAM/c5a-turetme-girdileri-tarama.md; S146 = A): türetmenin okuduğu, kilit izinde OLMAYAN alanların kapı dışı değişikliği bulunur. Defter KURALLARI ve
sayıları değişmez (yalnız TESPİT). Tur 1d'nin kararı (kural farkı sapma DEĞİL — `driftsOf`) ve tur 1e'nin girdileri (dört işaret + yükleme bağı / damgası, `opening_review_gate`)
AYNEN kalır. Tur 2'nin işleri, istemci, kâhin KAPSAM DIŞI.

### 16.1 Kanıt düzeneği (koşuldu; betikler ve ham çıktılar not defteri `c5a1f-is/`, kanıtı docs/kanit/2026-11-13/c5a1f-*)
- Veri: v2.4.9'un GERÇEK koduyla API'den (`sablon.mjs`; ders 17, 23): banka hesabı + Kasa → Banka transferi, carili / carisiz çekler (biri kilitte karşılıksız, ikisi kilitte bankaya
  tahsile verilmiş, biri tahsil edilmiş), cariye stok satışı + iade + peşin satış, stopajlı ve tevkifatlı alış faturası + satış faturası, taksit kartı (elle tahsilat + çekle
  tahsilat), Excel'den kart (önceden ödenen = açılış taksit satırı), şüpheli alacak + sonrasında tahsilat; hepsi 01–09.10.2026, kilit 10.10.2026 (v2.4.9'da konur), bugün 20.10.2026.
- (a) `alan.mjs`: güncel kodla açılış + dondurma; ayrı bağlantıyla TEK alan değişir; "canlı türetme değişti mi" = `ledger.build()` maddelerinin tarihi ≤ kilit satırlarının
  (tarih | hesap | alt hesap | cari | borç | alacak) çoklu kümesi önce ↔ sonra (fark satır sayısı); ayrıca satır içi + arka plan taraması (bulgu, Mutabakat Günlüğü, zil).
- (b) `mesru2.mjs`: kilitli tarihli satırlarda kapıdan geçen meşru yollar (yanıt kodu + sessiz mi + canlı türetme farkı).
- Ölçümler Europe/Istanbul; kalıcı testler iki TZ.

### 16.2 Alan tablosu (taban c5a1f-taban; "önce" = tabanda kapı dışı değişiklikte satır içi taramanın bulgusu / günlük / zil)
| Alan | (a) kilitli canlı türetme değişir mi (betik: fark satırı) | (b) kilitli tarihli satırda meşru yazım (kaynak + betik) | önce: bulgu / günlük / zil | (c) seçilen yol | sınıf |
|---|---|---|---|---|---|
| cash_entries.transfer_id (temizle / koy) | EVET (2 / 2: 102 ↔ 770, 649 ↔ 102) | YOK (yalnız INSERT: transfer, Silinenler'den geri alma; kilitli tarihe INSERT / DELETE zaten izde) | gl:102 + bank:sub + bank:event + bank:transfer / 1 / 1 (başka denetim görüyor) | iz girdisi `cash_transfer_lock` | 1 |
| account_entries.source ('cheque' → '') | EVET (2: 770 / 649.90 doğar) | YOK (yalnız INSERT) | **0 / 0 / 0** | iz girdisi `account_source_lock` | 1 |
| account_entries.source_id (başka evrak; başka stok hareketi) | evrak: EVET (2) · stok: koşullu (0 — aynı nedenli hareket) | YOK | evrak: gl:101 + cheque:account / 1 / 1 · stok: stock:account / 1 / 1 | aynı girdi | 1 |
| account_entries.doubtful_skip (0 → 1) | EVET (2: 128 → 120; yalnız şüpheli kaydı olan carinin tahsilatında) | YOK (cari hareketi düzenleme kilitte 409 — betik) | **0 / 0 / 0** | iz girdisi `account_doubtful_skip_lock` | 1 |
| plan_entries.cheque_id (temizle) | EVET (2: 100 / 649.90) | YOK (yalnız INSERT; çekli satır düzenlenmez) | money:event / 1 / 1 | iz girdisi `plan_entries_bond_lock` | 1 |
| plan_entries.opening (0 → 1; 1 → 0) | 0→1: EVET (2: 100 → 519) · yüklenen kartın açılış satırı 1 → 0: 0 (kart S127 ile eski kurala bağlı) | YOK | 0→1: **0 / 0 / 0** · 1→0: money:event / 1 / 1 | aynı girdi | 1 |
| stock_moves.reason (cari satışı / peşin satış → 'preturn') | EVET (2 / 2: 600 → 153) | YOK (stok hareketi düzenleme kilitte 409) | **0 / 0 / 0** | iz girdisi `stock_reason_lock` | 1 |
| invoices.gl_json (600 → 602; 770 → 760) | EVET (2 / 2) | YOK (taslakta yazılır; kesilmiş faturada kilit 409; numaralama yalnız açıklama) | **0 / 0 / 0** | iz girdisi `invoices_gl_lock` | 1 |
| invoices.try_withheld / try_stoppage (+10 TL) | EVET (2 / 2: 360) | YOK | balance + invoice:try / 1 / 1 | aynı girdi | 1 |
| cheque_collections.event_id (başka kaydın başlığı) | EVET (4: 101.01 / 101.02 tutarı 350 → 150) | YOK (yalnız INSERT; kapanış close_event_id'i yazar) | cheque:collections / 1 / 1 | iz girdisi `cheque_collections_event_lock` | 1 |
| plans.created_at (Kayıt Tarihi boşken) | koşullu: yalnız `registered_on = ''` kartta (madde tarihi created_at'ın günü) | YOK — API boş Kayıt Tarihi yazmaz (PUT registeredOn "" → 200, değer AYNEN 01.10.2026: betik); göç 9 boşları doldurur | taban verisinde boş kart yok; boşaltmanın kendisi mevcut `plans` girdisinde | iz girdisi `plans_unregistered_lock` (normal veride satır üretmez) | 1 |
| cheque_events.created_at (karşılıksız; aynı evrakta ikinci karşılıksız olayı) | koşullu: birden çok karşılıksız olayında madde tarihi (son oluşturulanın günü) — dışarıdan kilit SONRASI tarihli ikinci olay: 2 (madde kilitli dönemden çıkar) | YOK (karşılıksız son durum; geri alma kilitte 409 — betik) | **0 / 0 / 0** | `cheques_bounce_lock` (durumla birlikte) | 1 |
| cheques.status | koşullu: yalnız kilitte karşılıksız olayı olan evrakta (bounced → portfolio: 2); olaysız portfolio → bounced: 0 | VAR ama kilitli karşılıksızı olan evrakta YOK: karşılıksız son durum, geri alma kilitte 409 (betik); öbür evrakta bugünkü tahsil / ciro / karşılıksız 200 (betik) | unbounce: **0 / 0 / 0** · olaysız bounce: gl:101 / 1 / 1 | (ii) yerine DAR iz girdisi: yalnız kilitte karşılıksız olayı olan evrakın durumu + seçilen karşılıksız günü + borç satırı var mı (`cheques_bounce_lock`) — meşru yazımı olmayan alt küme | 2 → dar |
| cheques.account_id | koşullu: carili → '' (2: cariye işlenmemiş evrak maddesi doğar, çift madde); carisiz → cari: 0 | VAR: carisiz evrakın karşılıksızında cari seçimi (betik 200, türetme farkı 0); düzenleme kilitte 409 (betik; coreChanged) | carili → '': gl:101 + cheque:collections / 1 / 1 · carisiz → cari: 0 / 0 / 0 (türetme de değişmez) | (ii) yerine TÜRETİLEN OLGU izi: kilitli dönemde "cariye işlenmemiş" sayılan evrak kümesi (`cheques_free_lock`; türetmenin süzgeciyle aynı koşul) — meşru cari seçimi kümeyi değiştirmez | 2 → olgu |
| account_entries.invoice_id | koşullu: yalnız şüpheli kaydı olan carinin TAHSİLATINDA 120 ↔ 128 (2) | **VAR ve kilitli türetmeyi DEĞİŞTİRİYOR**: kilit yokken 09.10 tarihli tahsilat 15.10 tarihli faturaya bağlanabiliyor (200); kilitten sonra fatura bugün iptal → 200, bağ kalkar (K4, 2.3.0), kilitli 09.10 maddesi 120 → 128 (fark 2), SESSİZ (0 / 0 / 0). POS kesinti bağlama da bağ yazar (kilit denetimi yok; satırlar sağlayıcı carisinin — şüpheli yalnız müşteride) | **0 / 0 / 0** | (iii) KODLANMAZ — BAŞ MİMAR KARARI GEREKİYOR (16.4) | 2 |
| account_entries.opening_review | (tur 1e) | (tur 1e: K8-2) | (tur 1e) | DOKUNULMAZ (kopya + `opening:review`); durum ile kopyanın BİRLİKTE dışarıdan değişmesi BİLİNEN SINIR (BAŞ MİMAR KARARI, görev metni) | 2 |

Açıklama alanları ((a) HAYIR — tutar / hesap değişmez; kalıcı testin istisna listesinde): payments.note, cash_entries.description, account_entries.note, plan_entries.note,
stock_moves.note, cheque_events.note, cheques.serial_no, invoices.number, fin_events.no / description, ledger_vouchers.description, doubtful_*.note, doubtful_receivables.created_at /
created_by (yalnız listeleme), stock_items.name / unit, accounts.name / ref_no (şüpheli kaydının etiketi). Taramanın "DOĞRULANMADI" hücreleri: (b) hücreleri yukarıdaki betik
satırlarıyla kapandı; `fin_events.description` / `no` (açıklama) ve `vat_offsets.*` (mevcut `vat_offsets_lock`) betikle denenmedi — açıklama ya da zaten izde.

### 16.3 SINIF 3 (satır dışı girdiler)
| Girdi | Kilitli defteri değiştirir mi | Bugün gören denetim (betik) | Karar |
|---|---|---|---|
| Banka hesabının alt hesabı (`bank_accounts.gl_sub`) | EVET (dışarıdan 102.01 → 102.99: fark 4) | bank:sub + bank:voucher / günlük 1 / zil 1 (tabanda bulunuyor). Kapıdan: PUT glSub → 200 ama değer DEĞİŞMEZ (alan düzenlenemez; betik) | iz girdisi GEREKMEZ (kapıdan değişmiyor; dışarıdan değişince mevcut denetim görüyor) |
| POS alt hesabı (`pos_terminals.gl_sub`) | EVET (kod okuması) | süzgeç tam kapıya yollar (FULL_TABLES); dış değişikliği gören denetim DOĞRULANMADI (POS kurulumu bu düzenekte yok) | BİLİNEN SINIR adayı (karar baş mimarın) |
| Sunucunun saat dilimi | Yalnız yüklenen kartın (KG-5) yükleme damgasının YEREL günü — kilit sınırına denk gelen damgada madde kilitli dönemin öbür yanına geçer | hiçbiri (§15.2 SINIR ile aynı aile) | BİLİNEN SINIR adayı (ucuz kapatma yok: yerel gün SQL'de hesaplanamıyor) |
| Aynı tarihli satır sırası (rowid) | Mizanı değiştirmez; aynı gün şüpheli kayıt ↔ tahsilat bağında 120 / 128 dağılımı (seq) | hiçbiri. VACUUM INTO (yedek) rowid'i KORUYOR (betik `vacuum.mjs`: boşluklu metin anahtarlı tabloda 133 / 133 aynı) — SQLite'ın belgelenmiş garantisi değil | BİLİNEN SINIR adayı (yalnız dış araç / elle müdahale ya da SQLite davranışı değişirse) |

### 16.4 BAŞ MİMAR KARARI GEREKİYOR — cari satırının fatura bağı (`account_entries.invoice_id`)
Bulgu (betikle üretildi): kilitli tarihli tahsilatın bağı, kilit SONRASI tarihli faturanın bugünkü iptaliyle kapıdan geçerek (200) değişiyor ve şüpheli kaydı olan caride kilitli
dönemin canlı türetmesini 120 ↔ 128 kaydırıyor; hiçbir denetim görmüyor (kural farkının sayısında görünür — tur 2'nin fişi bunu "kural farkı" diye yazar). Aynı alanın kapı dışı
değişikliği de görünmez. Yanlış alarmsız iz girdisiyle kapatılamaz: kopya deseni iptalin meşru değişikliğini "kapının yazdığı" diye kabul eder ama kilitli türetmenin meşru
değişmesini engellemez; düz iz girdisi iptali 409'a çevirir (yeni 409 — K4 kararının davranışı değişir).
- A: kilitli tarihli TAHSİLAT ('in') satırının bağı değişecekse (fatura iptali, POS bağlama) 409 "kapanmış dönem" + iz girdisi (satır, bağ var mı) — kilitli defter hiç değişmez; bedel:
  böyle bir faturayı iptal etmek için önce kilidi açmak gerekir (yalnız kilitli tarihli tahsilatı bağlanmış faturada; seyrek).
- B: iptal bağı koparır ama kilitli tarihli satırın bağı KALIR (yalnız açık dönemdeki satırların bağı kalkar) — para kuralı değişir (K4): KULLANICIYA SORULMALI (ders 43).
- C: Uç durum böyle kalsın (BİLİNEN SINIR): yalnız şüpheli kaydı olan carinin, kilit sonrası faturaya bağlanmış kilitli tahsilatı; kapı dışı değişiklik görünmez.
Öneri: A (kilitli dönem kapıdan geçerek değişmez ilkesi). Para kuralına dokunduğu için kullanıcıya sorulmalı. Bu turda KODLANMADI.

### 16.5 Seçilen yol (SINIF 1 + dar SINIF 2) ve süzgeç
- LOCK_SQL'e dokuz girdi (`since: "2.5.0"`; LOCK_SQL_VERSION "2.5.0" KALIR — 2.5.0 yayımlanmadı; eski sürüm izleri `since` ile aynen; alanı olmayan eski şemada `requires` ile atlanır):
  `cash_transfer_lock`, `account_source_lock` (kaynak + kaynak kimliği + şüpheli işareti; hız için tek girdi — 16.8), `plan_entries_bond_lock`, `stock_reason_lock`, `invoices_gl_lock`, `cheque_collections_event_lock`,
  `plans_unregistered_lock`, `cheques_bounce_lock`, `cheques_free_lock`. Hepsi satır KİMLİKLERİYLE (dağılım değişimi de izi değiştirir); bağ / işaret alanlarında değeri boş / 0 olan
  satır dışarıda (boş → dolu yeni satır olarak görünür; eski veride satır sayısı küçük).
- Süzgeç (integrity-scope LOCK_FIELDS + özel denetimler) aynı alanları bilir: LOCK_FIELDS'e transfer_id, source, source_id, doubtful_skip, cheque_id, opening, reason, gl_json,
  try_withheld, try_stoppage; tahsil kaydının verilme bloğuna event_id; Kayıt Tarihi boş kart; kilitli evrakın carisi; kilitli karşılıksızı olan evrakın durumu ve karşılıksız
  olayları; kilitli evrakın "cariye işlenmemiş" olgusunu değiştirebilecek bağlı satırlar (evrağa bağlı alış / veriliş cari satırı, evrakla taksit satırı). Kilitli evrakın bugünkü
  tahsili / cirosu tam kapıya DÜŞMEZ (hız; 16.7).
- Kapıyı / taramayı çağıran yollar DEĞİŞMEZ (tur 1e ile aynı üç yer: COMMIT tam kapısı, taramanın period-lock'u, donmuş defterin kaynak izi).

### 16.6 "Nasıl bozulur?" (önce yazıldı; testler buradan)
1. Her SINIF 1 alanı ve dar SINIF 2 olgusu kapı dışından değişir → satır içi VE arka plan taraması: period-lock + ledger:snapshot, Mutabakat Günlüğü 1, zil 1.
2. Program kapalıyken yazım → açılışta ledger:snapshot sapması (taban satırı, sunucu iletisi; açılışta zil yok — tur 1e düzeni).
3. Sayı / tutar aynı, yalnız hesap dağılımı (600 → 602; iki satırın nedeni yer değiştirir) → bulunur.
4. Meşru olaylar sessiz (bulgu / günlük / zil yok, yanıt kodu tabandakiyle AYNI): eski tarihli evrakın bugünkü tahsili, cirosu, karşılıksızı (carili, carisiz, carisiz + cari seçimi),
   tahsile verilmiş evrakın bugünkü tahsili, kilitli karşılıksızı geri alma (409 AYNEN), açık dönem fatura iptali, taksit kartı kapatma, kilitli kart silme (409 AYNEN), Açılış Olabilir
   onayı / reddi, kilidi ilerletme / kaldırma / yeniden koyma, yedek → geri yükleme, Şirket Verisini Sıfırla, eski sürüm verisiyle güncelleme.
5. Eski şema (alan yok): `requires` girdiyi atlar; 2.4.9'un kaydettiği izle karşılaştırma `since` ile aynen (K11).
6. Kapı ↔ süzgeç eşdeğerliği: kilitli satırda yeni alanı değiştiren mağaza yazımı süzgeçte de "kilitli dönem" → tam kapı → 409 (eşdeğerlik ihlali değil); gateVerify'lı testler her COMMIT'te.
7. Kalıcı kaynak tarama testi: türetmenin okuduğu yeni bir sütun ne izde ne istisna listesinde → kırmızı; izden sütun çıkarılırsa → kırmızı.
8. Mutantlar: her yeni iz girdisi çıkar; süzgeçten alan çıkar → kırmızı olmalı.

### 16.7 Hız (ders 47, 53)
İz on sorgu büyür (her biri kilitli dönemin satırlarını indeksli koşulla bir kez); `cheques_free_lock` kilitli evrak başına iki NOT EXISTS (idx_plan_entries_cheque,
idx_account_entries_source). Değişen yollar: tam kapı (kilit izine dokunan yazım), tarama (Mutabakat Testi), açılış, dondurmanın kaynak izi; süzgeçte yalnız evrak / evrağa bağlı
satırlarda tek indeksli sorgu. Ölçüm: temiz 100 bin satırlık veride taban ↔ yeni (ölçüm kilidiyle; sonuç kodla birlikte 16.8'de).

### 16.8 Sonuç (kodla birlikte; kanıt docs/kanit/2026-11-13/c5a1f-*)
- Değişen ürün dosyaları: `lib/integrity.mjs` (LOCK_SQL'e dokuz girdi, `since: "2.5.0"`; iz önbelleği — hız), `lib/integrity-scope.mjs` (LOCK_FIELDS'e on alan; tahsil kaydının verilme bloğuna
  event_id; Kayıt Tarihi boş kart; `chequeLockRelevant` — evrak olguları). Göç / şema / istemci değişmedi.
- Önce → sonra (`alan.mjs`, v2.4.9 verisi, kilit 10.10): her izlenen alanın kapı dışı değişikliği satır içi taramada `ledger:snapshot` + `period-lock`, Mutabakat Günlüğü 1, zil 1
  (taban: dokuz alanda 0 / 0 / 0, öbürlerinde yalnız başka bir denetimin yan bulgusu). Değişmeyen: fatura bağı (§16.4, bilerek), olaysız karşılıksız durumu ve carisiz evrağa cari
  yazımı (türetme de değişmiyor), yüklenen kartın kilit SONRASI tarihli açılış satırı (§15.2 SINIR ailesi; money:event görüyor), banka alt hesabı (bank:sub görüyor).
- Meşru yollar (`mesru2.mjs` + kalıcı test [4] / [5] / [6]): yanıt kodları tabanla AYNI (200 / 409), hepsi sessiz. Yeni 409 alan istek YOK.
- Kalıcı testler: `test/kilit-izi-alanlar-250.test.mjs` (16 tür × satır içi + arka plan / kapalıyken; meşru; geri yükleme / sıfırlama; v2.0.26 ve v2.4.9 güncellemesi; süzgeç ↔
  kapı; DÜŞÜK-A) ve `test/defter-kaynak-iz-250.test.mjs` (EXPLAIN tabanlı kaynak tarama: 30 sorgu, 188 sütun; izde 128, istisna 27 + 4 korumalı tablo, rowid 16).
- DÜŞÜK-A: N3 kaynak tarama testiyle, N17 / N18 [8] ile öldü; N7 EŞDEĞER (ulaşılamaz dal): kapının kapsamı (lib/db.mjs SCOPE_TABLES) plan_imports'u yakalamaz — süzgecin
  yükleme denetimi hiçbir yazımda çalışmaz; aynı işlemde para tablosuyla plan_imports yazan mağaza yazımı gateVerify'da "eşdeğerlik ihlali", üretimde kabul edilir (tarama sonra
  period-lock bulur). Meşru yazan yol yok. BAŞ MİMAR KARARI (rapor): SCOPE_TABLES'a plan_imports + keys() eşlemesi ya da ölü dalın kaldırılması.
- Komşu düzeltmesi: `test/goc-243-stok-acilis.test.mjs` göç öncesi izi sürümsüz alıyordu (eski şemada sütunu olan yeni girdileri de sayıyordu) → iki taraf 2.4.2 tanımıyla (K11 deseni).
- HIZ (temiz 100 bin; kanıt c5a1f-hiz1-* ve c5a1f-hiz2-*): (1) ÖLÇÜM KİLİDİYLE (yük 0,9–1,3; geçerli) ilk kodda kilitli veride Mutabakat Testi ortanca 13.016 → 14.687 ms
  (+12,8 %, eşik aşıldı), kilit izinin kendisi 1.930 → 2.807 ms (+45,5 %), donma +8,9 %, kilitli evrağın bugünkü tahsili 54 → 61 ms (+12,3 %; taban dağılımı 46–69 ms), öbür
  yollar ±10 % içinde. Tanı (prof.mjs): yeni girdiler tabloları yeniden tarıyor (cari kaynağı 271 ms, şüpheli işareti 126 ms, stok nedeni 112 ms, fatura kırılımı 101 ms) ve
  Mutabakat Testi izi İKİ kez hesaplıyor (period-lock + donmuş defterin kaynak izi). (2) Düzeltme: iz aynı veri durumunda önbellekten (anahtar total_changes + data_version +
  schema_version; açık işlemde kullanılmaz — eşdeğerlik testi + üç önbellek mutantı yakalandı), şüpheli işareti cari kaynağıyla tek taramada, süzgeçte karşılıksız dışı durum
  geçişinde sorgu yok. (3) Düzeltmeden sonra ÖLÇÜM KİLİDİ ALINAMADI (ana oturumun ekran senaryoları / kâhin koşusu 1,5 saatten uzun paylaşımlı kilit tuttu) → yalnız TANI ölçümü
  paylaşımlı kilitle (yük 0,6–3,5; kilitsiz kipin üç turu GEÇERSİZ): kilitli Mutabakat Testi 14.000 → 10.039 ms (−28 %), donma +12 % (gürültülü), Borç Yaz +21 % (gürültülü;
  ilk geçerli ölçümde −10 %). (4) RESMÎ KABUL (ölçüm kilidiyle, yük 0,96–1,91 — geçerli; c5a1f-hiz3-*): kilitsiz kipte bütün yollar −19 % … +4,5 %; kilitli kipte Mutabakat
  Testi 13.765 → 9.156 ms (−33,5 %), Borç Yaz −1,8 %, evrak yazımı +0,4 %, kilitli evrağın bugünkü tahsili −11,7 %, açılış −5,6 %; DONMA (kilit konunca arka planda bir kez)
  7.856 → 8.696 ms (+10,7 % — eşiği 0,7 puan AŞIYOR; dondurma iş parçacığının kendi bağlantısında iz bir kez hesaplanır, önbellek yardım etmez); kilit izinin kendisi +22,6 %.
  Karar ana oturumun (BAŞ MİMAR KARARI GEREKİYOR — rapor).
- Kaynak tarama testinin sınırı: dizin sırasıyla okunan sütun (ORDER BY'ın dizinden karşılandığı `cheque_events.created_at`) EXPLAIN'de Column olarak görünmez — o sütunun
  koruması davranış testinde ([1] ikinci karşılıksız olayı).

## 17. Ç5-A tur 2 (kod ajanı, 13.11.2026; taban `c5a2-taban` 7e8d3228) — KODDAN ÖNCE yazıldı
Görev metni docs/devir/2.5.0-DEVAM/ (Ç5-A tur 2). Girdi: tur 1f dar kontrol raporu (dk-c5a1f-rapor.md), D 12.11 15:57 (4), D 13.11 10:40 (S160), D 13.11 17:19, D 13.11 17:30 (S164 = C +
süreç kuralı). Sıra: 0 → 7 → 5 → 6 → 1 → 2 → 3 → 4 → 8; bir iş (kod + test + commit) bitmeden sonrakine geçilmez; tur 1'in türetme kurallarına dokunulmaz.

### 17.1 İş 0 — Yönetim › Sistem'deki Mutabakat satırı (EY-1)
- Yeniden üretim (taban; fikstür surum-2.0.26-zincir, kilit 05.10.2026, bugün 08.10.2026; açılış dondurması bitti + ilk tarama): satır KIRMIZI "Mutabakat: 2 denetimde sapma var
  (Kural Değişikliği Farkı (Kilitli Dönem: 05.10.2026 ve Öncesi), İleri tarihli hareket (Çek/Senet Hareketleri) — eski sürümden kalan 1 satır; …)". Kural farkı 44 madde.
  Kök neden: istemci (client/assets/admin.js loadIntegrity) yalnız `notice` işaretini uyarı sayıyor; `ledger:rule-diff` sunucuda `severity: "warning"` ama `notice` DEĞİL (notice'in
  anlamı başka: noticeGrowth → günlük + zil). Sunucuya dokunulmaz (günlük / zil / Mutabakat Testi sonucu aynı kalsın — görev metni).
- Değişen yol: YALNIZ istemci — admin.js loadIntegrity: `ledger:rule-diff` sapma listesinden ayrılır, ayrı "Uyarı (yeni işlemleri engellemez): <ad> — N madde, fark X. … fark Yönetim ›
  Kural Farkı Düzeltme ile ilk açık güne alınır." cümlesi; renk: gerçek sapma varsa kırmızı, yalnız eski sürüm satırı / uyarı / kural farkı varsa sarı. "Düzeltildi (Fiş …)" İş 2'de
  (sunucu alanı gelince aynı cümle değişir).
- Okuyucular (ders 10): `#adm-integrity-status` — e2e senaryo-kasa-acilis-uyari-250, senaryo-donem-kilidi-ilerleme-250, senaryo-226, senaryo-213 (taramayla); kural farkı olmayan veride
  metin bayt bayt aynı (yeni cümle boş; "N denetim tamam" sayısından yalnız kural farkı satırı düşer — o veride 0).
- Nasıl bozulur: kural farkı + gerçek sapma birlikte (kırmızı kalmalı, kural farkı ayrı cümlede); yalnız kural farkı (sarı, "N denetim tamam" + uyarı); kural farkı + notice (iki uyarı
  cümlesi); kural farkı 0 (görünmez — sunucu ok olanı listelemez).

### 17.2 İş 7 — dar kontrol 1f'in DÜŞÜK'leri (yalnız test / ölü dal; ürün davranışı DEĞİŞMEZ)
- DÜŞÜK-1 (goc-243 ara sıra kırmızı): test ön koşulu ürünün durumundan kurar (`snapshots.runPending()` beklenir) ve tek sonucu ADIYLA bekler: kilitli Masa açılışının (15.09, 5.000)
  Kural Değişikliği Farkı yalnız 500 (+5.000) ↔ 519 (−5.000); başka sapma yok. Zorlama 'bitir' + 'gozlem' kiplerinde yeşil; eski test 'bitir'de beklenen nedenle kırmızı.
- DÜŞÜK-2 (yaşayan sekiz mutant Y2, Y3, Y5, Y10, Y11, Y12, Y18, Y23): her biri için DEĞERLE yakalayan test (kilit-izi-alanlar-250 ailesine) — sütun düşerse iz / süzgeç farkı.
- DÜŞÜK-3: kaynak tarama testine 'istisnadaki sütun izde olmamalı' denetimi.
- DÜŞÜK-4: süzgeçteki ulaşılamayan dal (`plan_imports`, SCOPE_TABLES dışında) — SİLİNİR (ulaşılır kılmak db.mjs'e dokunmayı gerektirir; db.mjs bu turun dosya sınırı dışında; kapı
  dışı değişikliği taramadaki `plans_import_lock` zaten görüyor).

### 17.3 İş 5 — S160 = A (kilitli tahsilatın fatura bağını düşüren işlem 409)
- Taramayla bağı düşüren yollar (grep `invoice_id = ''` / `DELETE FROM invoices` / `SET invoice_id`): (a) fatura iptali — routes/invoices.mjs `cancel` (cari hareketinin bağı +
  Kapatılacak Fatura ile bağlanan evrak olayının bağı); bunu çağıran HER yol: iptal ucu, e-Belge iptal akışları (önce `dryRun` — ret EDM'ye gitmeden), silme (`deleteInvoice` →
  `cancel`), Banka'dan Ters Kaydet (bank/vouchers.mjs → `cancel(fromBank)`); (b) cari hareketini düzenleme (accounts.mjs) — kilitli satır zaten 409; (c) evrak / cari hareketi Silinenler'den
  geri yükleme (bağ düşebilir) — kilitli tarihli geri yükleme zaten 409 (`restoreDate`); (d) mahsup fişini kaldırma — kilitli tarihte zaten 409 ve mahsup defteri değiştirmez.
- Kural: `cancel`'ın yazımında, dönem kilidi varken bu faturaya bağlı (`invoice_id`) kilit tarihli ya da öncesi bir TAHSİLAT (cari hareketi `kind = 'in'`) ya da Kapatılacak Fatura ile
  bağlanmış ALINAN evrak olayı (`cheque_events.kind = 'receive'`, evrak faturanın kendi evrakı değil) varsa 409 `period-locked-bond`; ileti en eski kilitli tahsilatın tarihini söyler ve
  "Değişiklik için yönetici dönem kilidini açmalı" der. Kural carinin şüpheli durumuna BAĞLANMAZ (S160 metni). Yardımcı lib/period.mjs'te (`assertBondOpen`).
- Ödeme (`out`) ve verilen evrak (`issue`) bağı: karar metni "tahsilat" der; bağları defteri değiştirmez (doubtfulSkipOf yalnız `in`) → kurala ALINMAZ; BAŞ MİMAR KARARI GEREKİYOR
  (raporda).
- Nasıl bozulur: kilit açık (serbest); kilit dışı tahsilat bağlı (serbest); kilit kaldır → iptal → yeniden kilitle (çalışır); kilit tam tahsilat günü (= ret); iki tahsilat (biri kilitli);
  silme yolu; e-Belge iptalinde dryRun; Banka'dan Ters Kaydet (komisyon faturasının kilitli aydaki iade satırı bağlıysa artık 409 — raporda); iade faturası iptali.
- Hız: iptal başına iki dizinli sorgu (account_entries.invoice_id, cheque_events.invoice_id) — yalnız kilit varken.

### 17.4 İş 6 — POS komisyon faturası kuşkusu (K-b (i); DOĞRULANMADI)
`linkFees` (bank/pos.mjs:518) kilit denetimi olmadan o ayın kesinti / iade satırlarına bağ yazar; `in` (komisyon iadesi) satırı bağlanınca doubtfulSkipOf 128 → 120 değişebilir (yalnız
sağlayıcı carisinin açık şüphelisi varsa). Önce programın kendi yolundan (POS kur → satış → iade → ay kilidi → komisyon faturası kaydı) üretilir; üretilirse KODLANMAZ → KULLANICIYA SORULMALI.

### 17.5 İşler 1–4, 8 (plan; ayrıntı kodla birlikte bu bölüme eklenir)
- İş 1 Açılış Eşleştirme Fişi: routes/ledger.mjs'e ön izleme + kaydet uçları (`system.manage`), doğrulama ledger-opening.mjs'te (izinli hedef: 500–503, 520–549, 570, 580, 590, 591 ve
  alt defter dışı bilanço hesapları; 519'u fiş tarihi gün sonunda ters bakiyeye geçirme reddi — aynı gün açılışları dahil); `vouchers.post({ type: "opening-match", cls: "opening" })`.
  Ekran Yönetim › Dönem Kilidi yanında. Açılış Karşılığı denetiminin fiş satırlarını gördüğü SAYIYLA gösterilir.
- İş 2 Kural Farkı Düzeltme Fişi + "Düzeltildi": §3.3; satırlar `ruleDiff().balances` — bilanço hesapları birikimli, sonuç hesapları yıl yıl (fişin yılı → eski hesabın tersi; önceki yıl
  → 671 / 681); alt defter hesabı farkı (120 ↔ 128) fişe girmez, ekranda nedeniyle. Ön izleme farkın HANGİ maddeden geldiğini satır satır gösterir (S164 = C: program dışı yazım
  bozulması sessizce fişe girmesin). "Düzeltildi": düzeltilmemiş fark = ruleDiff − Σ rule-diff-correction (hesap eşlemesiyle); 0 → `ledger:rule-diff` öğesinde `corrected: { no }`;
  tarama / zil / günlük bu öğeyi zaten sapma saymıyor (tur 1d) — değişmez.
- İş 3 Açılış Olabilir Kayıtlar ekranı + zil (uçlar tur 1'de, routes/opening-review.mjs); B16 sıra zorlaması.
- İş 4 Şüpheli ↔ kuyruk defter kuralı (§2.11) — kuyruğun dağılımı okunur, kuyruk kodu değişmez.
- İş 8 kılavuz (HTML + PDF aynı turda).

### 17.6 İş 6 — sonuç (programın KENDİ yolu; betik docs/kanit/2026-11-13/c5a2-betik/pos-bag*.mjs; çıktı c5a2-is6-*.json)
- ÜRETİLDİ (taban ve yeni kodda AYNI): KDV kipli POS (Sağlayıcı Carisi), Eylül'de iki satış (kesinti 660, 04.09), birinin tam iadesi (komisyon iadesi `in` 300, 14.09), Eylül kilidi,
  "Şimdi Oluştur" (taslak 01.10) → "Kaydet": `linkFees` kilitli Eylül'ün İKİ satırına bağ yazar (bağlı 0 → 1). Sağlayıcı carisi TEDARİKÇİ ise şüpheliye alınamaz (409
  doubtful-customer-only) → kilitli defter farkı 0. Sağlayıcı carisi MÜŞTERİ türündeyse (program kabul ediyor) ve 08.09'da 200 şüpheliye alınmışsa: kilitli dönemin canlı türetmesinde
  14.09 satırı "A 128 200 + A 120 100" → "A 120 300" (fark 2 satır); tarama bulgusu yok, Mutabakat Günlüğü 0, zil 0. Cari bakiyesi iki okumada aynı (sınıflama farkı).
- S160'ın söylemediği durum (bağ DÜŞÜRMEK değil YAZMAK) → KODLANMADI; KULLANICIYA SORULMALI (raporda; öneri: uç durum BİLİNEN SINIR).

### 17.7 Ara rapor durumu (13.11.2026)
BİTTİ (commit'li, kanıtlı): İş 0, İş 5, İş 6 (yeniden üretim; soru), İş 7'nin DÜŞÜK-1 / -3 / -4. KALAN (yeni temiz ajana — ders 46): İş 7 DÜŞÜK-2 (sekiz yaşayan mutantın testi),
İş 1, 2, 3, 4, 8. İş 0'ın "Düzeltildi (Fiş …)" cümlesi İş 2'ye bağlı.

### 17.8 Tur 2b (kod ajanı, 13.11.2026; taban `c5a2b-taban` c3dc4a36 = tur 2a ucu) — KODDAN ÖNCE yazıldı
Sıra (görev metni): İş 4 → İş 2 → İş 3 → İş 1 → İş 8 → DÜŞÜK-2 → İş 5 ek testleri. Tur 2a'nın işleri (0, 5, 6, DÜŞÜK-1 / -3 / -4) yeniden yapılmaz.

**İş 4 (§2.11; S14 / S25 / S39 = A) — DURDU (kodlanmadı; BAŞ MİMAR KARARI GEREKİYOR + KULLANICIYA SORULMALI).** Bugünkü kodda yeniden üretim (betik not defterinde
`c5a2b-q4/betik/is4-uret.mjs`; F1 1.000 (−60), şüpheliye al 1.000 (−40), F2 500 (−30, kayıttan SONRA), F1'e bağlı nakit 400 (−20), bağsız nakit 100 (−15), F2'ye bağlı çek 300 (−10)):
defter `A 120 400` (bağlı nakit; S25 (c) 128 bekler) · `A 128 100` (bağsız; değişmez) · `A 128 300` (F2'ye bağlı çek; S14 "sonradan kesilmiş fatura 120" bekler). Kuyruğun DIŞA verdiği
şüpheli dağılımı (`buildObligations().doubtful`) aynı veride SON durumda `F1 500 + F2 100` — F2 kayıttan sonra kesildiği hâlde M13'ün ikinci geçişiyle ("yetmezse sonrakilerden")
kuyrukta. Durma nedenleri: (1) kural "TAHSİLAT ANINDAKİ" dağılımı ve "o kalemi TAŞIYAN kaydı" ister; kuyruk yalnız bugünkü (son) durumu, kalem başına toplam olarak (kayıt kimliği yok)
verir — eksik alan (görev metni: "eksik bir alan gerekiyorsa DUR ve raporla"); (2) döngü: kuyruğun girdisi (`doubtfulRecords` kalanları) defterin ikinci yükleyicisinden
(`doubtfulState`) gelir; kural defteri kuyruğa bağlarsa ikisi birbirine bağlanır — ancak tahsilat tahsilat ilerleyen (zamana göre) bir kuyruk çağrısıyla çözülür; (3) M13'ün ikinci
geçişi ↔ S14 metni ("sonradan kesilmiş fatura 120") yukarıdaki örnekte AYRIŞIR (iki okuma, para / defter kuralı — ders 43); (4) sınır (SUPHELI_NORMAL_ASIM yalnız 120'ye kalan
kısma — kâhin Y4 / Z6) routes/accounts.mjs'te (`assertNormalRoom` → `doubtfulSkipOf`), dosya sınırı dışında. Kod, test, kâhin değişmedi.

**İş 2 — Kural Farkı Düzeltme Fişi + "Düzeltildi" (§3.3; B14, B16; S76 = A; KG-15 A; EK-1 M7).**
- Değişen yol: lib/ledger-opening.mjs'e saf plan işlevi (`ruleDiffCorrectionPlan`) + yazılmış düzeltmelerin toplamı (`postedRuleDiffCorrections`); lib/ledger-snapshots.mjs
  `ruleDiff({ detail })` (isteğe bağlı: fark doğuran her maddenin hesap başına farkı — ön izlemenin "hangi kayıttan" listesi; varsayılan çıktı AYNEN) ve `checks()`'te kural farkı
  öğesine düzeltme durumu; routes/ledger.mjs'e iki uç (GET ön izleme, POST kaydet; `system.manage`); istemci Yönetim › Sistem'de "Kural Farkı Düzeltme" penceresi + İş 0 satırının
  "Düzeltildi" cümlesi.
- Kural: tarih = kilit + 1; satırlar `ruleDiff().balances`'tan — 1–5 sınıfı hesaplar kilit günü sonundaki BİRİKİMLİ farkla (hesap + alt hesap + cari başına, yıllar toplanır);
  6 / 7 sınıfı yıl yıl: fark yılı = fişin yılı → aynı hesap (eski kuralın hesabının tersi), önceki yıl → borç yönlü fark 681, alacak yönlü fark 671. ALT DEFTER hesabı (K6:
  `subledgerAccounts()`; 120 / 128 …) fişe YAZILMAZ (B14 (a)); birikimli farkı sıfır olmayan alt defter hesabına katkı veren maddelerin BÜTÜN farkı fişin dışında kalır (S76 = A:
  "bu fark fişle düzeltilmez") — böylece fiş her zaman dengeli; dışarıda kalan fark ön izlemede nedeniyle ("alt defter hesabı; Kilidi Aç → Yeniden Kilitle") görünür.
  Ön izleme, satırların yanında farkı doğuran maddeleri (kimlik, tarih, kaynak, açıklama, hesap başına donmuş ↔ güncel) satır satır gösterir (S164 = C: program dışı yazımın bozduğu
  satır sessizce fişe girmesin); kayıt yalnız ön izlemenin özeti (satırların imzası) gönderilince yazılır — ön izlemeden sonra fark değiştiyse 409 (iki kişi aynı anda).
- Düğme pasif + görünür neden: kilit yok; kilit bugün ("Kilit bugünün tarihinde; düzeltme fişi yarın yazılabilir" — fiş ucunun 400 date-future'ı); kilitli dönemde onay bekleyen
  Açılış Olabilir kaydı (B16: "önce Açılış Olabilir listesini tamamlayın"; sunucu da 409); düzeltilecek fark yok. Sunucu aynı nedenlerle reddeder (ekran tek kapı değil).
- "Düzeltildi": düzeltilmemiş fark = plan (ruleDiff'ten) − Σ etkin rule-diff-correction fişleri (ters kaydı olanlar düşer; hesap + alt hesap + cari eşlemesiyle; 671 / 681
  eşlemesi son düzeltmenin yılıyla). Hepsi 0 ve dışarıda kalan alt defter farkı yoksa öğe `ok` olur ve "… — Düzeltildi (Fiş 2026-00000N)" adıyla bilgi olarak listede kalır
  (Mutabakat Testi uyarısız döner — D 12.11 15:57 (4)); dışarıda kalan alt defter farkı varsa uyarı sürer, ipucu B14'ü söyler. Düzeltme fazla kalırsa (kilit kaldırıldı ya da
  yeniden kilitlendi — donmuş dönem güncel kuralla döndü) öğe kilit olmasa da görünür: "Kural Farkı Düzeltme Fişi fazla: … fişi ters kaydedin". Tarama / zil / Mutabakat Günlüğü:
  `ledger:rule-diff` zaten sapma kümesinin dışında (tur 1d) — değişmez (sayıyla gösterilir).
- Okuyucular (ders 10; tarama `ruleDiff|rule-diff`): integrity.mjs run (Mutabakat Testi, açılış, arka plan taraması), report-center.mjs Defter Mutabakatı (öğe adı + "Tutarlı"),
  admin.js loadIntegrity, muhasebe sürücüsü (salt okur), testler kural-farki-* / donmus-defter-* / goc-243 / s127 / banka-220-senet-121 / koruma-taban / kilit-izi-alanlar /
  senaryo-acilis-duzeni-250. Düzeltme fişi olmayan veride çıktı bayt bayt aynı (yeni alan yok).
- Nasıl bozulur (§4 (8) + bugünkü kod): fiş → ters kayıt (uyarı geri gelir); iki fiş (ikincisi yalnız kalanı); aday onayından sonra ikinci fiş (B16 sırası); kilit ilerletilir
  (fiş donmuş döneme girer — karşılaştırma dışı); Kilidi Aç / Yeniden Kilitle (fazla düzeltme uyarısı); kilit bugün; ileri / geri yıl (31.12 kilit → 01.01 fiş, önceki yıl 671 / 681;
  iki TZ); aynı istek iki kez (replayed); iki kişi aynı anda (imza); yetkisiz (Muhasebe 403); eski kurala bağlı Excel kartı (S127; iki yön) çift düzeltilmez (değişmez sayıyla);
  program dışı yazımın kural farkına karışması (S164 = C — ön izlemede kaynak satırı); yedekten geri yükleme (fiş yedekle gelir; durum yeniden hesaplanır).
- Hız: ön izleme = bir `ruleDiff` (Mutabakat Testi'nin zaten yaptığı) + fiş toplamı (tek SQL); `checks()`'e yalnız fiş toplamı SQL'i (fiş yoksa tek `LIMIT 1`). Ölçüt: 100 bin satırda
  ön izleme ≤ 0,5 sn hedef; Mutabakat Testi tabanın %10'u içinde.
- Ekran: Yönetim › Sistem › Dönem Kilidi kartının altında "Kural Farkı Düzeltme" düğmesi → pencere (kilit, fiş tarihi, satırlar, dışarıda kalanlar, kaynak maddeler, onay kutusu,
  "Fişi Kaydet"); pasifse nedeni görünür yazı.

### 17.9 Tur 2b — İş 2 sonucu (kodla birlikte; kanıt docs/kanit/2026-11-13/c5a2b-*)
- Değişen yol: server/lib/ledger-opening.mjs (`nextDayOf`, `PRIOR_YEAR_ACCOUNTS`, `ruleDiffCorrectionPlan`, `postedRuleDiffCorrections` — dosyanın sonu); server/lib/ledger-snapshots.mjs
  (`ruleDiff({ detail })`; `checks()`'te kural farkı öğesine `correction` / `corrected`, `createLedgerSnapshots({ subledger })`); server/routes/ledger.mjs (GET / POST
  /api/admin/ledger/rule-diff-correction, `subledger: () => subledgerAccounts()`); istemci client/assets/hof-kural-farki.js (yeni), client/admin.html (düğme + betik), client/assets/admin.js
  (`loadIntegrity` Düzeltildi / fazla düzeltme cümlesi + yenileme olayı).
- v2.4.9 verisi (surum-2.4.9-s127; kilit 31.12.2025): fiş 01.01.2026 = B 500 11.900 / B 681 10.400 / A 519 22.300 (9 kaynak madde: Kasa açılışı, cari açılışı, 3 Excel kartı (ikisi S127'nin eski
  kurala bağlı kartı), 4 "Excel'de ödenmiş" satırı). Beklenen fikstürün v2.4.9 mizanından + ham tablolardan (2025'in 602'si = yüklenen kartların T'si). Fişten sonra 1–5 sınıfı karma =
  baştan türetme (100 10.800, 120 15.500, 519 −26.300, 500 0) — S127 kartı ÇİFT düzeltilmez; 6. sınıf: kilitli yılın 602'si donmuş defterde kalır, 2026'da 681 karşılığı (§3.3 tasarımı).
- v2.0.26 verisi (kilit 05.10.2026; aynı yıl): fiş 06.10.2026 = B 500 127.800 / A 519 127.800 (44 madde); eski sürümden kalan ileri tarihli evrak satırı ayrı ve aynen kalır.
- Mutabakat Testi: fişten sonra uyarısız (failures yalnız gerçek eski sürüm satırı); öğe "… — Düzeltildi (Fiş 2026-000001)"; Mutabakat Günlüğü +0, zil 0 (fiş, ters kayıt, ikinci fiş).
- Kilitli kaynağın kapı dışı değişikliği (S164 = C örneği; [7]): ön izleme bozulan kaydı "fişle düzeltilmez" diye listeler, 120 farkını dışarıda gösterir, fiş satırları değişmez; kayıt
  kapı tarafından 409 ledger-integrity ile reddedilir (fiş yazılmaz).
- Kalıcı test test/kural-farki-duzeltme-250.test.mjs 7 / 7 (UTC + Europe/Istanbul); tabanda 7 / 7 kırmızı (uç yok: 404 / ön izleme alanları yok). Mutasyon
  test/kural-farki-duzeltme-250-mutasyon.mjs 10 / 10 yakalandı. Ekran senaryosu senaryo-acilis-duzeni-250 (İş 2 adımları eklendi) 27 / 27 iki TZ; tabanda İş 2 adımları kırmızı
  (düğme yok). Komşular (32 dosya, taramayla) 337 / 337 × iki TZ; senaryo-kasa-acilis-uyari-250 20 / 20, senaryo-donem-kilidi-ilerleme-250 39 / 39, senaryo-226 22 / 22,
  senaryo-213 64 / 64, senaryo-211 59 / 59.
- Kâhinler: defter 187 / 187 (yeni ve taban, iki TZ); cari 16.449 / 16.449 (yeni = taban), yapım aşaması listesi 41 → 41 (fark yok — listede 'Ç5-A' paketi kaydı yok); muhasebe sürücüsü
  yeni ↔ taban gerileme denetimi 226 / 226, program çıktısı BİREBİR (sürücü iki tarafta aynı 862 sınıflanmış / bekleyen fark).
- HIZ (E): ÖLÇÜLEMEDİ — ölçüm kilidi (`flock -x`) 19:20–20:00 tek seferlik 40 dk beklemede alınamadı (ana oturumun e2e yığını paylaşımlı kilidi tutuyordu); düzenek hazır
  (c5a2b-betik/olc.mjs + kos.sh + hepsi.sh: taban ↔ yeni, kilitsiz + kilitli, iki TZ, 3 tur, ön izleme yolu eklendi). Değişen yollar: Mutabakat Testi / Defter Mutabakatı / açılış
  taraması (`checks()` + tek SQL; düzeltme fişi yoksa `LIMIT 1` sorgusu), yeni ön izleme (bir `ruleDiff` + plan). Ana oturum ölçer.
- BİLİNEN SINIRLAR: 671 / 681 eşlemesi son etkin düzeltmenin yılıyla (kilit yıl sonunu düzeltmeden sonra aşarsa kalan fark yeni yıla göre önerilir); kilit kaldırılınca fiş
  otomatik ters kaydedilmez (fazla düzeltme uyarısı + Ters Kaydet — kilit kaldırmanın fiş varken engellenip engellenmeyeceği BAŞ MİMAR değerlendirmesine).

### 17.10 Tur 2c (kod ajanı, 13.11.2026; taban `c5a2c-taban` 3548840e = tur 2b ucu) — KODDAN ÖNCE yazıldı
Sıra (görev metni): İş 3 → İş 1 → İş 8 → İş 7 DÜŞÜK-2 → İş 5 ek testleri → İş 2'nin eksik örneği (S164 = C ikinci örnek). İş 4 bu turda YAPILMAZ (kullanıcı kararı bekliyor); tur 2a / 2b'nin
işleri ve tur 1'in türetme kuralları değişmez. Ekranlar tur 2b'nin bağlamasıyla (BAŞ MİMAR 13.11 (ii)): client/admin.html'e düğme + betik etiketi, her ekran yeni istemci dosyası.

**İş 3 — Açılış Olabilir Kayıtlar ekranı + zil (§2.4; S47 = A, S51 = A; B16; tur 1e DÜŞÜK-3 sayfalama / toplu karar).**
- Yeniden üretim (taban): uçlar var (GET liste, POST tek karar); ekran YOK, zilde aday yok, toplu karar yok, sayfalama yok, kararı geri almak (aday durumuna dönüş) YOK; Kural Farkı penceresi
  aday varken pasif, neden "… (Cariler › Açılış Olabilir Kayıtlar)" diyor ama o ekran yok (yönlendirme yok).
- Değişen yol: lib/ledger-opening.mjs `createOpeningReview` — `list({ all, limit, offset })` (toplam + sayfa; parametresiz çağrı AYNEN eski çıktı), `counts()` (zil için tek SQL;
  kilitli dönemdeki aday sayısı ayrıca), `decide(id, "candidate")` (kararı geri al: yalnız kararlı satır; onay / ret gibi para alanına dokunmaz, kapının kopyasıyla aynı işlemde),
  `decideMany(ids, decision)` (aynı işlemde; en çok 1.000; listede olmayan kimlik varsa HİÇBİRİ yazılmaz — 404); routes/opening-review.mjs: GET `?counts=1`, `?limit=&offset=`, POST
  `/api/workspace/opening-review` (toplu: { ids, decision }), tek karar ucunda `decision: "undo"`; yetki aynen `accounts.manage` (tur 1). İstemci: client/assets/hof-acilis-olabilir.js (yeni
  pencere: Tarih, Cari, Tür, Tutar, Açıklama, Durum, Kilitli Dönemde; tek / toplu Açılış (Onayla) / Açılış Değil (Reddet) / Karar Bekliyor'a Geri Al; bildirimde Geri Al), admin.html'e
  "Açılış Olabilir Kayıtlar" düğmesi + betik; admin.js'te yalnız `#system/acilis-olabilir` adresinin pencereyi açması; hof-alerts.js'te yalnız aday sayısı (system.manage; "Yönetim →
  Sistem" bağlantısı bu adrese); Kural Farkı penceresinin aday nedeni yanına "Açılış Olabilir Kayıtları Aç" bağlantısı ve sunucu nedenindeki yer adı "Yönetim › Sistem › Açılış Olabilir
  Kayıtlar" (B10'dan sapma: Cariler sayfasının istemci dosyası Ç5-B'nin — dosya sınırı; BAŞ MİMAR KARARI GEREKİYOR raporda).
- Okuyucular (ders 10; tarama `opening-review|createOpeningReview|rule-diff-candidates`): app.mjs (bağlama), test acilis-519-250, kg16-geri-alma-250, kural-farki-duzeltme-250 (+ mutasyon
  [5] düzenli ifadesi), defter-hiz-esdegerlik-250, kilit-izi-alanlar-250, bank-post-izinli.json (ham yazım etiketi `ledger.opening-review` — aynı etiket); e2e senaryo-acilis-duzeni-250
  (Kural Farkı penceresi), senaryo-211 (yazım düzeni gezintisi), yazim-duzeni testi.
- Nasıl bozulur: boş liste; tek kayıt; aynı adlı iki cari; kilitli satır (onay / ret yapılır, kilit izi ve donmuş defter değişmez, Kural Farkı'nda görünür); toplu kararda listede olmayan
  kimlik (hiçbiri yazılmaz); aynı karar tekrarı (değişiklik yok); geri al → aday (defter 519 — S47); onay → geri al → ret; iki kişi aynı anda (son karar geçerli, ikisi de 200; liste
  yenilenir); Muhasebe rolü (uçlar 200 — tur 1 yetkisi; ekran Yönetim'de, Yönetim'e giremez); personel 403; geri yükleme / Silinenler (S51 tur 1e'de — değişmez); sayfalama sınırları
  (limit 0 / çok büyük / eksi).
- Hız: liste sayfası `LIMIT/OFFSET` (dizin opening_review'da yoksa tam tarama — aday satırı az; 100 bin satırda ölçülür ≤ 0,5 sn); zil sayısı tek GROUP BY.

**İş 1 — Açılış Eşleştirme Fişi + ekranı (§2.7; M-11; B10; kâhin red kodları ESLESTIRME_HESAP / ESLESTIRME_TERS).**
- Yeniden üretim (taban): fiş türü `opening-match` tanımlı (ledger-vouchers.mjs), hiçbir uç yazmıyor; muhasebe sürücüsü `acilis_eslestir` olayını "uygulanmadı (Ç5-ESLESTIRME)" diye
  geçiyor (sürücü test/bagimsiz/** — DEĞİŞMEZ; eşleme ana oturumun işi).
- Kural (lib/ledger-opening.mjs `openingMatchPlan` — saf): hedef satırları bilanço hesabı (1–5 sınıfı, hesap planında), 519 DEĞİL, alt defter hesabı DEĞİL (K6 `subledgerAccounts()`)
  → aksi 400 `opening-match-account`; her satır tek taraflı > 0 kuruş; 519 satırı = −(hedeflerin net borcu) kendiliğinden; 519'un fiş tarihi GÜN SONU bakiyesi (karma defter = Yevmiye /
  Mizan'ın okuduğu; aynı günün açılışları ve önceki eşleştirme / kural farkı fişleri dahil) b ise fişten sonra b' = b − net: b < 0 iken b ≤ b' ≤ 0, b > 0 iken 0 ≤ b' ≤ b; b' ters işarete
  geçerse 409 `opening-match-inverse` (ESLESTIRME_TERS); |b'| > |b| (519'u büyüten — "bir kısmı" değil) 409 `opening-match-direction`; b = 0 409 `opening-match-nothing`; 519'u
  değiştirmeyen fiş (net 0) 400. Tarih: varsayılan bugün; kilitli tarih 409 (Ç2 `post` `period-locked`), ileri tarih 400 (Ç2). Kısmi ve birden çok kez yapılabilir; ters kaydı Ç2 ucuyla.
- Uçlar (routes/ledger.mjs; `system.manage`; Muhasebe 403): GET `/api/admin/ledger/opening-match?date=` (519 gün sonu bakiyesi, açılış türlerine göre dökümü — karma defterin 519
  satırları madde kaynağına göre, toplamı = bakiye; izinli hedef hesaplar; yazılmış etkin eşleştirme fişleri), POST `…/opening-match/preview` (ön izleme: satırlar + 519 satırı + b';
  reddi yazmadan döner), POST `…/opening-match` ({ requestId, date, lines, confirm: true } — yazım anında YENİDEN doğrulanır: iki kişi aynı anda ikincisi güncel bakiyeyle ret alır).
- Mutabakat: tur 1'in "Açılış Karşılığı" (integrity.mjs) bütün fiş satırlarının 519 / 500'ünü zaten okur (`openingCounterpart.parts.vouchers519 / vouchers500`) → yeni kod yok, SAYIYLA
  doğrulanır. Fişten sonra açık dönemde açılış silinir / değişir de 519 eşleştirmenin tersine geçerse ENGELLENMEZ → aynı blokta BİLGİ satırı `opening:519-inverse` (ok, info; zil /
  tarama / günlük değişmez — `ledger:unlocked-years` kalıbı): "Eşleştirilecek Açılış Bakiyeleri (519) Eşleştirme Fişlerinin Tersine Geçti". Ç6 aynı veriyi (`openingMatchState`)
  "Kesin Değil — Ters Bakiye 519" için okur.
- Okuyucular (ders 10): integrity.mjs tam tarama (Mutabakat Testi, açılış, arka plan taraması, Defter Mutabakatı — report-center), muhasebe sürücüsü (fişi yevmiyeden salt okur), Yevmiye /
  Mizan (fiş satırları voucherJournalRows'tan — değişmez), Kural Farkı (açık dönem fişi kilit ilerleyince donmuş defterde; ruleDiff iki tarafta da aynı fiş satırı — fark doğmaz).
- Nasıl bozulur (§4 (9)): kısmi; iki kez; 519'u ters çeviren; izinsiz hesap (102, 120, 600, 519); aynı gün açılışı (dahil); fişten sonra açılışın silinmesi (bilgi satırı); aynı istek iki
  kez (replayed); iki kişi aynı anda; kilitli tarih; ileri tarih; Muhasebe 403; ters kayıt (519 geri gelir); v2.4.9 kilitli verisi (kural farkı fişinden önce / sonra); kilit fişin üstüne
  ilerler.
- Hız: ön izleme / GET = bir karma `book({ to: date })` + toplama (Yevmiye'nin okuduğu yol); 100 bin satırda ≤ 0,5 sn hedef — ölçülür; Mutabakat Testi'ne bilgi satırı için tek fiş
  SQL'i (fiş yoksa `LIMIT 1`).

**İş 8 — kılavuz:** yalnız 'nasıl yapılır' (Açılış Olabilir Kayıtlar, Kural Farkı Düzeltme, Açılış Eşleştirme); HTML + PDF aynı commit'te (ders 42).
**İş 7 DÜŞÜK-2:** sekiz yaşayan mutant (Y2, Y3, Y5, Y10, Y11, Y12, Y18, Y23 — dar kontrolün tanımı) için değerle yakalayan test; ürün davranışı DEĞİŞMEZ.
**İş 5 ek testleri:** Banka'dan Ters Kaydet ve e-Belge iptal akışı — kilitli tahsilat bağlıyken 409 + kilitli defter aynı (+ e-Belge'de dış servise HİÇ gidilmedi); kilit dışında serbest.
**İş 2'nin eksik örneği:** S164 = C ikinci örnek — kilitli tahsilatın fatura bağı kapı dışından değişince Kural Farkı ön izlemesi kaynağı gösteriyor mu, fiş satırlarına giriyor mu
(test/kural-farki-duzeltme-250.test.mjs'e vaka; ürün kodu değişmez).

### 17.11 Tur 2c — sonuçlar (kodla birlikte; kanıt docs/kanit/2026-11-13/c5a2c-*)
- İş 3 (BİTTİ): uçlara sayfalama + toplam, zil sayısı (`?counts=1`; kilitli dönemdeki aday `lockedCandidate`), toplu karar (aynı işlemde; listede olmayan kimlikte 404, hiçbiri yazılmaz),
  "undo" (karar geri alınır, satır yeniden onay bekler — S47: defterde 519); sayfasız liste çıktısı tur 1'in AYNI. Ekran Yönetim › Sistem › "Açılış Olabilir Kayıtlar" (B10'dan sapma:
  Cariler'in istemci dosyası Ç5-B'nin — BAŞ MİMAR değerlendirmesine); zil yalnız system.manage (pencere Yönetim'de); Kural Farkı aday nedeni yeri söyler ("Yönetim › Sistem › Açılış
  Olabilir Kayıtlar") ve "Açılış Olabilir Kayıtları Aç" ile pencereye geçirir. Aynı adlı iki carinin satırı cari no / telefonla ayrılır (sayfalı listede).
- İş 1 (BİTTİ): `openingMatchBalance` (karma defterden 519 gün sonu bakiyesi + açılış türlerine göre döküm; cariye işlenmemiş evrakın maddesi `account:free-*` → Açılış Evrakı),
  `openingMatchTargets` (1–5 sınıfı, 519 değil, K6 değil, ayrıca 153 / 136 / 159 / 198 / 340 — stok değeri ve bilançonun brüt gösterim hesapları; BAŞ MİMAR değerlendirmesine),
  `openingMatchPlan` (ret kodları opening-match-account / -inverse / -direction / -nothing / -zero / -line), `openingMatchState` (Mutabakat bilgi satırı `opening:519-inverse`). Bilgi
  satırı CANLI türetmeye (Mutabakat'ın okuduğu) bakar: Kural Farkı fişi ters kaydedilince karma defterde (Mizan) 519 ters görünür ama canlı türetmede 0'dır — o fark "Kural
  Değişikliği Farkı" uyarısındadır (iki ayrı uyarı yok). Açılış Karşılığı denetimi fiş satırlarını görür (sayıyla: parts.vouchers519 = 730.000 kuruş; 519 / 500 tutarlı).
- v2.4.9 kilitli verisi (kabul D; test/acilis-duzeni-v249-250): Kural Farkı fişi B 500 6.370 / B 602 2.800 / A 519 9.170 — 2.4.9 "Açılış…" açıklamalı Borç Yaz'ı AÇIKLAMADAN açılış
  sayıyordu (§2.3) → kilitli aday onayında farkı 500 → 519 (ilk beklenen 602 YANLIŞTI; sayı karar metniyle yeniden kuruldu). Eşleştirme 519 11.670 → 0; ters kayıtla uyarı geri.
- İş 8 (BİTTİ): kılavuz 17. bölüme üç madde (Açılış Olabilir Kayıtlar, Kural Farkı Düzeltme, Açılış Eşleştirme); PDF yeniden üretildi ve denetlendi.
- HIZ (kabul E; temiz 100 bin satır, kendi kopya, ölçüm kilidi; docs/kanit/2026-11-13/c5a2c-olcum): var olan yolların hiçbiri kötüleşmedi (Mizan, Yevmiye, Hesap / Alt Hesap Mizanı,
  Defter Mutabakatı, Mutabakat Testi, Alacak Yaşlandırma, iki yazım yolu, Kural Farkı ön izlemesi — kilitsiz + kilitli); Açılış Olabilir sayfasız liste ilk ölçümde eşiğe değdi, 8 turla
  yinelendi: taban en iyi 65,0 / ortanca 68,0 ms ↔ yeni 58,2 / 68,6 ms (kötüleşme yok). YENİ yollar: sayfalı liste ~0,1 sn, zil sayısı ~0,03 sn (≤ 0,5 sn); Açılış Eşleştirme GET /
  ön izleme kilitsiz 1,6–2,0 sn, kilitli 3,0–3,3 sn, olay döngüsü de o kadar tutuluyor → ≤ 0,5 sn ÖLÇÜTÜ KARŞILANMADI (bir karma `book()` = bütün yevmiye türetmesi). Çare seçenekleri
  ve öneri raporda (BAŞ MİMAR KARARI GEREKİYOR); bu turda değiştirilmedi.
- Kâhinler: defter 187 / 187 (yeni + taban, iki TZ); cari 16.449 / 16.449 (yeni = taban), yapım aşaması 41 → 41 (fark yok; 'Ç5-A' paketi kaydı yok); muhasebe sürücüsü taban = yeni
  (8.456 test, 862 sınıflanmış / bekleyen fark, 44 atlanan), gerileme 226 / 226 — `acilis_eslestir` olayı sürücüde hâlâ "uygulanmadı (Ç5-ESLESTIRME)": sürücü eşlemesi
  (test/bagimsiz/** — bu turda değişmez) ana oturumun işi.

### 17.12 Tur 2d (yalnız test; taban `c5a2d-taban` 04926fb5 = tur 2c ucu; kanıt docs/kanit/2026-11-13/c5a2d-*)
- DÜŞÜK-2'nin sekiz mutantı: Y2, Y3, Y5, Y11, Y18, Y23 yeni testlerle ölür (kilit-izi-alanlar-250: üç kapı dışı vaka + [9] kapıdan iki adım + [10] kaynaklı satırda işaret + [11] v2.4.9'un gerçek izi = güncel kodun 2.4.9 tanımı); Y10, Y12 EŞDEĞER (süzgecin para denetimleri aynı yazımı yakalar — yanıt, ileti, tarama aynı; yalnız iç karar etiketi farklı; sonda betiği kanıtta).
- S160 = A ek testleri (s160-iptal-yollari-250): Banka'dan Ters Kaydet / Düzelt ve e-Arşiv iptali 409 (EDM'ye istek yok, kilitli defter aynı); kilit dışı serbest; kilit kaldır → iptal → yeniden kilit; ödeme / verilen evrak bağı kurala girmez. (a)'daki kilitli tahsilat bağı arayüz yolundan kurulamaz (savunma katmanı).
- S164 = C ikinci örneği (kural-farki-duzeltme-250 [8]): kilitli tahsilatın fatura bağı kapı dışından yazılınca 120 / 128 farkı ön izlemede kaynağıyla dışarıda, fiş yalnız gerçek kural farkı. Ürün kodu değişmedi.
