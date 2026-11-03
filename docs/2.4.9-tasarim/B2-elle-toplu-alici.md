# B2 (2.4.9) — Elle toplu WhatsApp gönderiminin alıcı listesi: TASARIM NOTU (kod yazılmadan önce; ana oturum onayı bekler)

> Kaynak: docs/2.4.9-IS-LISTESI.md B2 [H] (KARAR 03.11 "SORU 2 → B1–B4 KAPSAMDA"); docs/2.4.8-IS-LISTESI.md "SORU (kullanıcı ~16:40 UTC …)" satırı (KARAR "2.4.9'a bırak":
> "elle yolun alıcı listesi BİLİNEN SINIR + 2.4.9 (aynı yöntemle; Bakiye/Gecikmiş/son tahsilat sütunları için eşitlik testi)"); İş Z tasarımı ve kanıtı
> docs/kanit/2026-11-01/248-isz-tasarim-notu.md, 248-isz-OKU-BENI.md. Kurallar: ders 47 (toplu yolda öğe başına ağır okuma yok; büyük veride erken ölç), ders 15 (ölçümler tek tek,
> aynı veri kopyası), ders 5/7/10/13/23/38, BAĞIMSIZ DOĞRULAMA PRENSİBİ. Bu notta ÜRÜN KODU DEĞİŞMEDİ; ön ölçüm not defterinde, depo dışı kopyalarda yapıldı (§8).

## 1. Kanıt (dosya:satır; HEAD e3f74093)

Sunucu — `server/routes/whatsapp.mjs`:
- :96–153 `POST /api/workspace/whatsapp/targets` (yetki `accounts.view`, :97). Seçim: `all: true` → `service.list(...)` + `except` (:103–107), yoksa `ids` (:108); en çok
  `MAX_TARGETS = 5000` (:49, :110).
- **:116–121 kişi başı `service.detail(id, user)`** — TAM cari kartı; hata fırlatırsa kişi listeden SESSİZCE düşer (`catch { continue; }`). :101 modül denetimi `service.detail`.
- :122–150 kartın okunan alanları (§2). :151 `audit(user, "whatsapp.prepared", …)` (yan etki — aynen kalır). :152 yanıt `{ kind, office, range, today, recipients }`.
- :87–92 `lastSends` — seçilen bütün cariler için TEK sorgu (`message_sends`, dizin `idx_message_sends_account (account_id, created_at)`, migrations.mjs:867). Sorun değil.
- **:52 `tl` her çağrıda `new Intl.NumberFormat("tr-TR", …)` kurar**; :58–79 `statementText` her tutar satırında `tl` çağırır (en çok 20 hareket + devir + bakiye + gecikmiş +
  sıradaki taksit ≈ 21–24 çağrı/kişi). Bu notun İKİNCİ bulgusu (§8): biçimleyici kurulumu çağrı başına ~41 µs → 2.000 kişilik "Tüm Hareketler" ekstresinde +1,3 sn.

Cari servisi — `server/routes/accounts.mjs`:
- :138–187 `detail()` — kartın ekran ekleri: `bank_accounts` kart kimlikleri (:145), şüpheli özeti (:152), iade etiketi (:155–160), `invoiceModule().entryStates` fatura kalanları
  (:165), `deleteBlock` (:181), **`openingEntryOf` (:183 → :561; İş Z profili: kart süresinin %83'ü — yanlış dizin `idx_account_entries_source`)**, `refundablesOf` (:186).
- :195–200 `waFacts()` — İş Z'nin eleme çekirdeği: `accountRow` (silinmiş/olmayan → 404, detail ile aynı) + `plans().forAccount` + `entriesOf` + `accountLedger`; `plans` aynı
  `planSummaryOf` (:135) eşlemesiyle. Ekran ekleri YOK.
- :248 `list()` — "Tümüne" yolunun seçimi; toplamlar tek sorguda (değişmez).

İstemci — `client/assets/hof-whatsapp.js`:
- :96–106 `load()` → `POST /targets` (gövde: seçim + `kind` + `preset`); :221–223 Ekstre Dönemi değişince YENİDEN `load()` (her dönem değişimi bir ağır istek daha);
  :325–339 yol seçimi (Otomatik ↔ "WhatsApp Web ile Gönder"; elle yol seçilince yüklenir).
- :32–43 `render` — mesaj değişkenleri: `{Ad}` name, `{Bakiye}`/`{Borç Durumu}` balance, `{Sıradaki Taksit}`/`{Sıradaki Taksit Satırı}` next, `{Vadesi Geçen}` overdue,
  `{Son Ödeme}` lastPayment, `{Firma}` office. :107 ekstrede metin sunucudan (`person.statement`).
- :119–150 `prepare()` — sayaçlar (valid / optOut / passive / geçersiz), "Yalnız Borçlu" (balance > 0,005), satırda phone, reason, lastSend.at, bakiye; :170 gönderim sırası.
- `client/assets/hof-core.js:394` istemci zaman aşımı 30 sn → bugün 3.014 caride (36–39 sn) pencere "Sunucu zamanında yanıt vermedi" der (§8 eski ölçüm).
- Çağıranlar: `client/assets/hof-accounts.js:278–292` `bulkWhatsapp` (seçilenler `ids` / başlıktaki kutu `allSelection()` :258 / seçimsiz "Tümüne" `{ all: true, ...filterBody() }`
  :120), `:1722` cari kartı → `HOF.whatsapp.forAccount` (:369–398) → tek kişilik `ids`. Mobil ve fatura ekranı bu ucu KULLANMAZ (grep: tek çağıran hof-whatsapp.js:99).

Ön ölçüm (bu not için, §8): ESKİ kod 2.000 cari **23,6–27,5 sn**, Tümüne 3.014 **36,3–38,8 sn**; olay döngüsü kilidi ≈ süre (başka kullanıcının cari listesi isteği 23–38 sn bekledi).
Tahmin ("~20+ sn") doğrulandı; 3.014'te istemcinin 30 sn sınırı aşılıyor.

## 2. Alıcı listesinin GERÇEKTEN kullandığı alanlar (koddan sayıldı: whatsapp.mjs:122–150 + statementText :58–79)

| yanıt alanı | karttan okunan | detail'de kaynak | waFacts'te |
|---|---|---|---|
| id, refNo, name, type, phone | `account.*` | accountRow | aynı accountRow |
| wa, valid, reason | `account.phone` → `waNumber`; `waOptOut === 1` → "WhatsApp Mesajı İstemiyor"; `status === "passive"` → "Pasif Cari" | accountRow | aynı |
| optOut, passive | `waOptOut`, `status` | accountRow | aynı |
| balance (**Bakiye**, Yalnız Borçlu, {Bakiye}, {Borç Durumu}) | `totals.balance` | accountLedger(entries, plans) | aynı işlev, aynı girdi* |
| next (**Sıradaki Taksit**) | `plans[].status === "active"` → `plans[].next` (dueDate, remaining ?? amount) en erken | forAccount → planSummaryOf | aynı |
| overdue (**Gecikmiş**, {Vadesi Geçen}) | `totals.overdueCount`, `totals.overdue` | accountLedger (kart toplamlarından) | aynı |
| lastPayment (**Son Tahsilat**, {Son Ödeme}) | `ledger` içinde kind `in` / `plan-in` son satır: date, credit | accountLedger.lines | aynı |
| lastSend | `message_sends` (karttan değil, :87–92 tek sorgu) | — | değişmez |
| statement (Ekstre metni) | `ledger` satırları: date, label, note, debit, credit, balance; `next`, `overdue`, `office`, `range` | accountLedger.lines | aynı |

\* Tek girdi farkı: detail `entries`'e ekran işaretleri ekler (`doubtfulSkip` boolean, `doubtfulNormal`, `editable`, `cardRefund`, `refundLabel`). `accountLedger` (lib/accounts.mjs:42–143)
bunlardan YALNIZ `doubtfulSkip`/`doubtfulNormal`'ı satıra taşır (:64–65) — alıcı listesi bu iki alanı OKUMAZ; `label`, `debit/credit`, `balance`, `totals` bunlara bağlı DEĞİL
(etiket yalnız origin/kind/method'dan, :58). Yani alıcı listesinin okuduğu her değer detail ↔ waFacts'te aynı işlevin aynı girdisinden çıkar. Okunmayanlar: `entries`, `side`,
`canManage`, `doubtful`, `deleteBlock`, `openingEntryId`, `refundables`, fatura kalanları.

## 3. İş Z'nin yeniden kullanılabilir parçaları

- **`accounts.waFacts(id, user)`** (accounts.mjs:195) — AYNEN; yeni işlev/ortak yardımcı YOK. İş Z dar kontrol 20: waFacts ↔ detail 46 okuma fark 0; planSummaryOf taşınması
  "elle alıcı listesi" dahil 57/57 (yani elle yol detail'den bugün de aynı eşlemeyi alıyor).
- Ölçüm düzeneği `test/isz-248/ortak.mjs` (`kurulum`: gerçek program, taze veri kopyası, sahte saat, sahte Meta ayrı süreç, `HUKUK_LICENSE_URL` ölü), `test/isz-248/yoklayici.mjs`
  (başka kullanıcı ayrı süreçte), `test/isz-248/olcum.mjs`'in `olc()` deseni (10 ms olay döngüsü sayacı + yanıttan sonra 60 ms). Bu not için uyarlanan betik:
  `<not defteri>/b2-tasarim-e3f7/olc-b2.mjs` (kod ajanı `test/b2-249/olcum.mjs` olarak depoya alır).
- Eşitlik: `test/isz-248/esitlik-hazirla.mjs` (göç edilmiş kopyada eleme sınıflarını SQL ile bir kez çoğaltır: pasif, istemiyor, silinmiş, telefon türleri, aynı telefon, hareketsiz,
  ileri tarihli) + `test/isz-248/esitlik-karsilastir.mjs` (ilk farklı yol). Bu not için: `<not defteri>/b2-tasarim-e3f7/karsilastir-b2.mjs`.
- Kalıcı test deseni `test/whatsapp-onizleme-olcek-248.test.mjs` (kur(): 15 sınıf cari + olmayan kimlik; `service.detail` sayaçla sarılır; `elemeAlanlari` eşitliği; kâhin = sınıf tanımı).
- Veri: T9 kopyaları `<not defteri>/t9-4c8e1d/taban-2910` (209 MB; 001: 3.014 cari, 3.012 telefonlu, 57.227 cari hareketi, 77 kart, 27 satış iadesi; 002: 614 cari) ve
  `gecmis-40` (563 MB; + 58 otomatik toplu iş). İkisi de programın kendi ürettiği veri (T9 üretimi). `message_sends` İKİSİNDE DE 0 satır (§5 E1'de üretilir).
- Kullanılmayanlar: `queuedRowsOf` ve defter `+k.period_key` (Z2/Z3) — elle yolda "Zaten Kuyrukta" / makine defteri yok.

## 4. Değişim (TEK değişim yeri: `server/routes/whatsapp.mjs`; ortak yardımcıya DOKUNULMAZ)

- **B2-1** :118 `service.detail(id, user)` → `service.waFacts(id, user)`; :101 denetimi `!service?.waFacts`. `try/catch → continue` aynen (404 silinmiş cari iki yolda da düşer).
- **B2-2** :52 `tl` modül düzeyinde TEK biçimleyiciyle: `const TL_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tl = value => \`${TL_FORMAT.format(Number(value) || 0)} TL\`;` — çıktı aynı (42.000 değerde bayt bayt aynı, Node 22.22.0; `Intl.NumberFormat` durumsuz).
- Prototip farkı (ölçülen): `<not defteri>/b2-tasarim-e3f7/prototip-yeni2.diff` (3 satır).
- DOKUNULMAYANLAR: `lastSends`, `list`, seçim/except/MAX_TARGETS, `statementText`'in mantığı, yanıt biçimi, audit, istemci (hof-whatsapp.js, hof-accounts.js), `waFacts`, `detail`,
  `planSummaryOf`, `accountLedger`, `openingEntryOf` (2.4.9 C listesinde SONRAYA), otomatik yol (queue.mjs).
- Ders 10 etkisi: değişen ortak yardımcı YOK → detail'in ve waFacts'in öbür çağıranları etkilenmez. `statementText` dışa aktarılır ama sunucuda tek çağıranı bu uçtur
  (test/whatsapp-213.test.mjs doğrudan içe aktarır).

**BİLİNÇLİ TEK FARK (BAŞ MİMAR KARARI adayı — İş Z (c) emsali; onay istenir):** eski kodda kartın bir EKRAN EKİ (entryStates, refundables, şüpheli özeti, deleteBlock, iade etiketi)
hata fırlatırsa kişi alıcı listesinden SESSİZCE düşerdi (sayaçlarda bile görünmez); yeni kodda bu ekler okunmadığı için kişi kendi doğru bakiye/taksit bilgisiyle listede görünür.
Olağan veride fark yok (§8: 7/7 gövde, 16.028 alıcı satırı birebir). Elle yolda gönderim anında yeniden kart okunmaz (otomatik yoldaki "gönderim anı tam kart" emniyeti burada yok) —
ama gönderilen içerik zaten yalnız waFacts alanlarından oluşur, ekran ekleri iletiye girmez. Değerlendirme: yeni davranış "boşa düşen kişi" (ilke 4 çıkmaz yok) açısından daha
doğru. "Kime" kuralına dokunduğu için (prensip §4 öz denetim 2) ana oturum bunu kullanıcıya göstermeli; öneri: İş Z (c) ile aynı → teslim notunda davranış notu.

**Seçenek olarak yazılan, ÖNERİLMEYENLER:** (a) `allLedgers` benzeri tek geçiş toplu SQL — `plans.forAccount`'un `next`/gecikmiş hesabını ikinci kez yazmak gerekir (aynı kuralın
iki eli; davranış riski yüksek, İş Z'den ayrışır). (b) Parça parça hazırlayıp araya `setImmediate` (olay döngüsüne sıra) — salt okuma ucu olduğu için atomiklik sorunu yok, ama
parçalar arasında giren bir tahsilat aynı listede iki farklı anın verisini verir; bütçe zaten tutuyor (§6) → gerekmez. (c) `openingEntryOf` dizin düzeltmesi — B2-1 bu sorguyu
yoldan çıkarır; cari kartı açılışındaki ~10 ms 2.4.9 C (SONRAYA).

## 5. Davranış AYNEN — eşitlik testi tasarımı

**E1 — büyük veri, eski ↔ yeni (kanıt koşusu, depoya `test/b2-249/esitlik-kos.mjs` + karşılaştırıcı):** eski kod `git archive <B2 öncesi commit> | tar -x` ayrı kopyada (ders 23, 25:
benzersiz klasör), yeni kod kendi kopyasında; aynı hazırlanmış verinin TAZE kopyası, aynı sahte saat (`fixed`), işçi elle. Her adımda yanıtın TAMAMI (`recipients` sırası,
`statement` metni dahil; `today`, `range`, `office`) derin eşitlik; fark → ilk farklı yol.
- Veri hazırlığı (bir kez, sonra iki yana kopyalanır): (1) taban-2910 + `esitlik-hazirla.mjs` sınıfları (pasif, istemiyor, silinmiş, boş/geçersiz/yurt dışı/sabit hat telefon, aynı
  telefonlu iki cari, hareketsiz, ileri tarihli); (2) **elle gönderim geçmişi programın kendi API'siyle** (`POST /whatsapp/log`, sent + skipped, 3 tur × 2.000 kişi; farklı tür) —
  `lastSend` dişli olsun (bugünkü veride 0 satır); (3) gecmis-40 (otomatik geçmiş; elle listeyi etkilememeli — bunun kanıtı); (4) iki şirket (002'de 614 cari).
- Gövdeler: `kind` statement × preset {thisMonth, lastMonth, last3, all} + message; seçim {2.000 `ids`, `all` + status active/passive/all, `all` + balance debtor/creditor/zero/nonzero/
  overdue, `all` + group/subgroup/q, `all` + except (100 kişi), tek kişilik `ids` (cari kartı yolu), silinmiş + olmayan kimlik karışık `ids`, 5.000 sınırı (5.000 ve 5.001 → 400 iletisi)}.
- Saat noktaları (ders 13; `today()` yerel tarihten): ayın 1'i 00:30, ay sonu 23:30, yıl dönümü 31.12 23:30 / 01.01 00:30, olağan gün; **TZ=UTC ve TZ=Europe/Istanbul** ayrı koşu.
- Ölçüt: bütün adımlar fark 0; karşılaştırıcının dişi bir kez gösterilir (bir alıcının `lastPayment.amount`'u elle bozulur → 1 fark).

**E2 — kalıcı test `test/whatsapp-elle-alici-249.test.mjs` (npm test'e girer; gerçek program, sahte saat, ders 30):** `kur()` İş Z testinin sınıfları + taksitli gecikmiş, mevcut borcu
taksitli, tahsilatlı (`in`) ve taksit tahsilatlı (`plan-in`) cari, açılış (devir) satırlı kart, iki elle gönderim kaydı.
1. YAPI: `/targets` çağrısında `service.detail` çağrı sayısı 0 (eski kodda kişi sayısı — beklenen kırmızı ileti: "alıcı listesi kişi başı tam cari kartı okuyor: 16 çağrı (beklenen 0)").
2. YAPI: hareketli + taksitsiz carilerde ekstre hazırlanırken `Intl.NumberFormat` kurulumu 0 (test `globalThis.Intl.NumberFormat`'ı sayaçlı vekille sarar; eski kodda tutar satırı
   kadar — beklenen ileti "ekstre metni her tutarda yeni biçimleyici kuruyor: N (beklenen 0)"). Not: `lib/accounts.mjs:18 tlText` taksit satırında kurar → bu denetim kartsız carilerde.
3. KÂHİN = SINIF TANIMI (ders 5): valid/reason (Pasif Cari, WhatsApp Mesajı İstemiyor, Telefon yok, Sabit hat …), silinmiş/olmayan listede YOK, balance, next (en erken aktif kart),
   overdue count/amount, lastPayment (`plan-in` son satırsa o), lastSend.at (yalnız `sent`), ekstrede devir/bakiye satırı — elle hesaplanmış sayılarla. Eski kodda da GEÇER.
4. ÇEKİRDEK ↔ KART: her sınıf carisinde §2 alanları (`elemeAlanlari` genişletilmiş: refNo, type, totals.balance/overdue/overdueCount, ledger {kind, date, label, note, debit,
   credit, balance}) `waFacts` ↔ `detail` derin eşit.
- Mutasyonlar (ayrı kopyada, hepsi KIRMIZI beklenir, ders 7/38): M1 waFacts'ta `plans: []` → (3)(4) next/overdue; M2 `lastPayment` süzgecinden `plan-in` çıkar → (3); M3 waOptOut
  denetimi `=== "1"` → (3) "≠ WhatsApp Mesajı İstemiyor"; M4 `TL_FORMAT` minimumFractionDigits 0 → (3) ekstre metni; M5 `detail`'e geri dönüş → (1); M6 tl yine çağrı başına → (2).
- Test kuralı ek durumları: boş seçim (400), tek kayıt, aynı adlı iki kişi (ayrı kimlik, ikisi de listede), ileri tarihli hareket (ekstrede dönem sonuna göre).

## 6. Hacim bütçesi (öneri; ders 47 — süre VE olay döngüsü en çok)

| istek | bütçe süre (en çok) | bütçe olay döngüsü en çok | ön ölçüm yeni (B2-1+B2-2) |
|---|---|---|---|
| 2.000 cari, her dönem + mesaj | ≤ 2 sn | ≤ 2 sn | 0,85–1,41 sn / 0,68–1,22 sn |
| Tümüne 3.014 (ekstre / mesaj) | ≤ 3 sn | ≤ 3 sn | 1,23–2,05 sn / 1,04–1,74 sn |
| 5.000 (MAX_TARGETS) | ≤ 5 sn (istemci 30 sn'den uzak) | ≤ 5 sn | ÖLÇÜLMEDİ (tahmin ~2,5–3,5 sn) |
| geçmişli veri (gecmis-40 + 6.000 elle gönderim) 2.000 | ≤ 2,5 sn | ≤ 2,5 sn | ÖLÇÜLMEDİ |
Kilit hâlâ süre kadar (eşzamanlı uç): başka kullanıcı en çok ~1–2 sn bekler (eskide 23–38 sn). Bütçeyi aşan tek koşu BİLİNEN SINIR yazılır, tekrarlı aşım = bulgu.

## 7. Ölçüm planı (ders 15, 24, 47)

1. `df -h /` ≥ 5 GB; bütün ağır koşular `flock /tmp/destekofis-olcum.lock` altında TEK TEK; `HUKUK_LICENSE_URL=http://127.0.0.1:9`.
2. Veri: taban-2910 ve gecmis-40'ın TAZE kopyası her koşuda (`kurulum` siler-kopyalar); E1 hazırlığındaki elle gönderim geçmişli kopya (aynı klasör iki yana).
3. Önce/sonra AYNI betik (`test/b2-249/olcum.mjs`, §8 betiğinin kalıcı hâli), eski kopya ↔ yeni kopya, her gövde 2 tekrar, sahte saat sabit; ölçülen: süre, olay döngüsü en çok,
   başka kullanıcının (ayrı süreç) en uzun beklemesi; ayrıca 5.000 kişilik seçim (taban'a esitlik-hazirla ile 5.000'e tamamlanmış kopya) ve "çok iadeli" nokta (aşağıda R2).
4. Ekran (Ölçek kuralı "sunucu + ekran"): Playwright ile bir kez "Tümüne WhatsApp Ekstre" (3.014) → pencere açılış süresi + kutu tıklama/“Yalnız Borçlu” yeniden çizim süresi
   (`prepare()` her değişimde 3.014 satırı yeniden yazar — istemci tarafı, sunucuyu kilitlemez; ölçülüp yazılır, bütçe aşımı ayrı bulgu, B2 kapsamı DEĞİL).
5. Ham çıktılar `tools/kanit.mjs kos` ile `docs/kanit/<gün>/249-b2-*`; bitmiş iş kopyaları kendi tam yoluyla silinir (ders 36).

## 8. Bu not için yapılan ön ölçüm (not defteri `/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/b2-tasarim-e3f7/`)

`git archive HEAD (e3f74093)` → eski, yeni (B2-1), yeni2 (B2-1 + B2-2) ayrı kopya; `olc-b2.mjs`, veri taban-2910 taze kopya, saat 02.11.2026 10:00 +03:00 sabit, flock, sırayla
(yeni 18:05, eski 18:06–18:13, yeni2 18:13 UTC). Hücre: süre / olay döngüsü en çok / başka kullanıcı en çok (ms), 2 tekrar:

| gövde | eski | yeni (B2-1) | yeni2 (B2-1+B2-2) |
|---|---|---|---|
| Ekstre Bu Ay 2.000 | 25.360 / 26.742 (kilit ≈ süre) | 1.251 / 1.237 | 944 / 1.034 (döngü 757 / 800) |
| Ekstre Geçen Ay 2.000 | 26.813 / 25.965 | 1.226 / 1.257 | 921 / 933 |
| Ekstre Son 3 Ay 2.000 | 26.982 / 26.778 | 1.189 / 1.242 | 1.383 / 991 |
| Ekstre Tüm Hareketler 2.000 | 27.539 / 26.639 | **2.538 / 2.405** | 942 / 1.413 |
| Mesaj 2.000 | 25.428 / 23.589 | 1.132 / 833 | 849 / 934 |
| Tümüne Ekstre (status all) 3.014 | 37.909 / 36.923 | 1.832 / 2.102 | 1.506 / 1.225 |
| Tümüne Mesaj (aktif) 3.014 | 38.797 / 36.291 | 1.237 / 1.675 | 1.305 / 2.045 |

Eşitlik (`karsilastir-b2.mjs`): eski ↔ yeni 7/7, eski ↔ yeni2 7/7 (16.028 alıcı satırı, ekstre metinleri dahil), çıkış 0. DİŞ SINIRLI: bu veride pasif 0, istemiyor 0, elle
gönderim geçmişi 0, sıradaki taksit/gecikmiş yalnız 8 kişi → kanıt DEĞİL, yalnız tasarımın tuttuğunu gösterir; asıl kanıt §5 E1. Mikro ölçüm: 42.000 `tl` çağrısı çağrı başına
biçimleyiciyle 1.719 ms, tek biçimleyiciyle 28 ms, çıktı aynı. Kopyalar ve iş klasörleri silindi; JSON/log/betik/diff duruyor.

## 9. Komşular (ders 9, 10)

- Cari listesi (`list`) — değişmez; "Tümüne" seçimi aynı yoldan (E1'de süzgeç seçenekleri). Cari kartı (`detail`) — değişmez (dokunulan yardımcı yok).
- Ekstre metni (`statementText`) — B2-2 yalnız biçimleyiciyi taşır; whatsapp-213 birim testi + E1 metin eşitliği. Mesaj şablon değişkenleri {Ad} {Bakiye} {Borç Durumu}
  {Sıradaki Taksit} {Sıradaki Taksit Satırı} {Vadesi Geçen} {Son Ödeme} {Firma} — istemci aynı alanlardan doldurur; E1 alan eşitliği + senaryo-whatsapp C adımı (şablonla gönderim).
- Tek cari WhatsApp (cari kartı → forAccount → aynı uç, tek `ids`), `/whatsapp/log`, `/whatsapp/history`, otomatik yol (plan(), gönderim anı) — dokunulmaz.
- Aynı DESEN başka yerde (KÖR NOKTA, B2 kapsamı DIŞI → 2.5.0 / DÜŞÜK öneri): çağrı başına `new Intl.NumberFormat` — `server/lib/accounts.mjs:18 tlText` (her taksit kartı satırında;
  mizan/allLedgers dahil), `server/lib/whatsapp/queue.mjs:105 moneyText`, `server/lib/integrity.mjs:60`, `server/lib/bank/doubtful.mjs:24`, `server/lib/bank/vouchers.mjs:772`.
  Çok kartlı şirkette (10.000 kart) `tlText` ~0,4 sn ekler; ölçülmeden düzeltilmez.

## 10. Test matrisi

| test | eski kodda | yeni kodda |
|---|---|---|
| E2 (1) tam kart sayımı | KIRMIZI "kişi başı tam cari kartı okuyor: N" | yeşil |
| E2 (2) biçimleyici sayımı | KIRMIZI "her tutarda yeni biçimleyici: N" | yeşil |
| E2 (3) sınıf kâhini, (4) çekirdek ↔ kart | yeşil (davranış aynı) | yeşil |
| M1–M6 mutasyon | — | hepsi KIRMIZI, beklenen nedenle |
| E1 büyük veri eşitlik × saat noktaları × 2 TZ | (eski = referans) | fark 0 |
| Ölçüm §7 | 23–39 sn | bütçe §6 içinde |
| Dar liste × UTC + Europe/Istanbul: whatsapp-213, whatsapp-w2-veri-248, whatsapp-w3-ekstre-248, whatsapp-onizleme-olcek-248, yeni test, waFacts/detail kullanan cari testleri | | yeşil |
| e2e: senaryo-whatsapp (CI DIŞI — elle, ders 8), senaryo-213 (CI dışı), senaryo-whatsapp-gonder-248 (CI), senaryo-is-akisi-248, senaryo-tarih-248 | | yeşil |
Windows: dosyaya dokunmayan değişiklik (ders 48 gerekmez); CI'nin Windows işleri adayda.

## 11. Riskler

- R1 ekran eki hatasında görünürlük farkı (§4 BİLİNÇLİ TEK FARK) — onay.
- R2 `plans().forAccount` kişi başı `returnCuts()` (routes/plans.mjs:1368, :1410) bütün `sale_return` faturalarını tarar: bu veride 27 iade, 2.000 çağrı 65 ms; iade sayısıyla doğrusal
  (İş Z dar kontrol 20 DOĞRULANMADI). Öneri: §7'de iadesi çok bir kopyada (güvenilirlik üreticisinin fatura-iade işlemleriyle program API'sinden) bir ölçüm; bütçe aşılırsa
  ayrı karar (forAccount'a önceden hesaplanmış kesinti — ortak yol, ders 10), aşılmazsa BİLİNEN SINIR.
- R3 hâlâ eşzamanlı: 2.000'de ~1 sn, 5.000'de ~3 sn kilit (bütçe içi; §4 (b) ileride).
- R4 E1'in dişi verinin sınıf çeşidine bağlı — hazırlıkta sınıf sayıları (pasif, istemiyor, lastSend, next, gecikmiş, plan-in) çıktıya yazılır, 0 olan sınıf = eksik kanıt.
- R5 İstemci tablosu 3.014 satırda yavaş olabilir (sunucu dışı; §7 adım 4 ölçer).

## 12. Ana oturumdan istenen onaylar

(a) B2-1 + B2-2, tek dosya; (b) §4 BİLİNÇLİ TEK FARK (İş Z (c) gibi davranış notu; kullanıcıya gösterim biçimi ana oturumda); (c) bütçe §6; (d) R2 ölçümü bu işte mi (öneri: evet,
tek ölçüm), (e) KÖR NOKTA §9 tlText vb. → 2.5.0; (f) ekran ölçümü §7 adım 4 bu işte (yalnız ölçüm).

## 13. ANA OTURUM ONAYI (03.11.2026 ~18:25 UTC) — kodlama bu bölümle birlikte okunur
(a) ONAY: B2-1 + B2-2, tek dosya (server/routes/whatsapp.mjs). (b) BİLİNÇLİ TEK FARK İLKEYLE kabul (WhatsApp "kime kaç kez" ilke 4 "çıkmaz yok": ekran eki
hatası yüzünden kişi listeden sessizce düşmez); iş listesine "İLKEYLE" yazıldı, teslim notunda davranış notu olarak gösterilir; kalıcı testte bu fark ayrıca bir hücreyle
belgelenir (eski kodda kişi düşer, yeni kodda görünür). (c) ONAY: bütçe §6 (2.000 ≤ 2 sn, 3.014 ≤ 3 sn, 5.000 ≤ 5 sn; olay döngüsü en çok aynı). (d) ONAY: R2 bu işte
tek ölçüm (çok iadeli kopya, programın kendi API'siyle üretilmiş). (e) KÖR NOKTA (tlText vb. Intl.NumberFormat deseni) → iş listesi C (2.5.0); bu işte dokunulmaz.
(f) ONAY: ekran ölçümü §7 adım 4 (yalnız ölçüm). E1 eşitliği programın ürettiği, dişi olan veriyle (pasif cari, mesaj istemeyen, elle gönderim geçmişi, çok taksitli cari VAR).
