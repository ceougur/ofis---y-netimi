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
