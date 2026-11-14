# Ç7a — Kitap Türetme Kuralları: Banka — Tasarım Notu (2.5.0)

Kod ajanı, 14.11.2026; taban `c7a-taban` (12b23fc6). KODDAN ÖNCE yazıldı (görev metni `docs/devir/2.5.0-DEVAM/c7a-istem.txt`). Kapsam satırı (iş listesi A, AYNEN):
"Ç7a | [XH] | KİTAP TÜRETME KURALLARI — banka (sürücü 05.11 'hiçbir işe atanmamış'; Ç3'ten SONRA): KG-6 POS komisyonu satış günü, KG-19 valörlü transfer 108.90, K-14 / K-15
hesapsız (açılıştan önce) hareketlerin karşılığı geçici hesap, D-07 kart faizi / gecikme bedeli (P3: bugün kredi kartında Faiz / Masraf fişi 400) | BAŞ MİMAR KARARI 05.11".

Kaynaklar (beklenenin kaynağı — ders 5, 32): kural kitabı 3-K (K-05, K-07, K-14, K-15), 3-D (D-01 … D-07), 3-T (T-03, T-06), §9 KG-6 / KG-19 / KG-20; kullanıcı kararları 05.11 17:16 "hepsi A"
((5) KG-6 POS komisyonu satış günü), S21 = A, S27 = A; C3 §5 / §8 / §13; C5 §2, §3, §17; muhasebe sürücüsü `siniflama.json` (P3) ve karşılaştırıcının DEĞİŞİM tablosu (KG6-POS-TARIH,
KG19-YOLDAKI, K14-HESAPSIZ). Kâhin MODEL dosyaları okunmadı.

## 0. Özet — en önemli bulgu (DUR, raporla)

Defter `journal(rows)` (server/lib/general-ledger.mjs) YALNIZ `routes/ledger.mjs rows()`'un verdiği satırlardan türetilir. Banka tarafında `rows().bankLines` olay başlığından
yalnız `date, no, description` taşır (routes/ledger.mjs:219 — `e.value_date`, `e.type`, `e.bank_ref`, `e.pos_id` YOK); `rows().refs()` banka hesabından yalnız `kind, gl, glSub`
taşır (routes/ledger.mjs:41-46 — `opening_date` ve Devir Kapanışı sınırı YOK); POS satışının kalemleri (`pos_items`: satış günü, komisyon, vergi, valör) satırlarda HİÇ yok.
Üç kural bu bilgiyi ister:

| Kural | Türetmenin istediği | rows()'ta var mı |
|---|---|---|
| D-07 kart faizi | — (yeni olay; satırlar yazım anında saklanır) | gerek yok → **YAPILDI** (§2) |
| KG-19 valörlü transfer | transfer başlığının `value_date`'i, gönderen / alıcı hesap | YOK |
| KG-6 komisyon satış günü | satışın günü ve komisyonu (pos_items / pos_sales), gün fişinin hangi kalemleri kapattığı | YOK |
| K-14 / K-15 hesapsız | hesapların açılış tarihleri ve Devir Kapanışı sınırı (açılıştan önce mi?) | YOK |

`server/routes/ledger.mjs` görev metninin YAZILMAZ listesinde (dosya sınırı) → KG-19, KG-6, K-14 / K-15 KODLANMADI; §9'da BAŞ MİMAR KARARI GEREKİYOR (en küçük ek: rows()'a üç
alan) ve her kuralın kararların söylemediği alt durumları KULLANICIYA SORULMALI diye yazıldı. Yazım anında farklı satır saklamak (bank_lines) çözüm DEĞİL: eski veri (kilitli
v2.4.9 verisi dahil) yeniden türetilmez, kural farkı görünmez, aynı açık dönemde iki kural olur; eski satırları değiştirmek göç ister (görev metni: "Yeni GÖÇ gerekiyorsa DUR").

## 1. Bugünkü maddeler (koddan; ders 6 — sayılar §8'deki sürücü koşusundan doğrulanır)

Örnekler kâhin senaryolarının olaylarıyla (s08, s12, s37, s11). Tutarlar TL.

### 1.1 KG-6 — POS komisyonu (s08 P1: 10.08 POS tahsilatı 1.000, komisyon 25, valör 12.08)
- Bugün: 10.08 `account:` B 108.POS / A 120 1.000 (T-03; general-ledger.mjs moneyAccount card → 108.sub). 12.08 POS Gün Sonu fişi (`pos_settlement`, saklı satırlar —
  bank/pos.mjs:895-915 settleGroup): B 102.B1 975 · B 653 25 / A 108.POS 1.000. Komisyon VALÖR günü (kitap KG-6 B = D-01).
- Kitap (KG-6 = A; kullanıcı 05.11 (5)): 10.08 B 108.POS 1.000 / A 120; 10.08 B 653 25 / A 108.POS 25 (komisyon çekim günü); 12.08 B 102.B1 975 / A 108.POS 975 (valörde net).
  Hesap: s08'in elle beklenenleri "gt/kalemler/G" (653) — KG-6 tablosundaki "hesap 760" önerisi sınıflamadır ve kâhin 653'te; bu tur hesabı DEĞİŞTİRMEZ (Banka Ayarları'ndaki
  komisyon hesabı, varsayılan 653, aynen).
- Değişmez (kitap): 108.POS gün gün = bankaya geçmemiş NET alacak (brüt − yazılmış komisyon). Bugün 108.POS = brüt (mutabakat beklenenı da brüt: bank/money-lines.mjs).
- Ayrıca gün fişi KDV kipinde (ödeme kuruluşu) kesintiyi sağlayıcı carisine yazar (A 108 / B 320.sağlayıcı — writeFee; pos.mjs:921-926), override (Ekstre ile / Elle Onay)
  farkı 653'e ya da sağlayıcıya valör günü, yeniden planlama ters kaydı, iade kalemleri (refund) ve komisyon iadesi (İadede Komisyon) iade kaleminin valöründe.

### 1.2 KG-19 — valörlü transfer (s12: 27.02 B1 → B2 500, valör 02.03)
- Bugün: bank/vouchers.mjs:256 "Valör … Bilgidir; satır işlem tarihinde yazılır" — 27.02 B 102.B2 500 / A 102.B1 500 (K-05 gibi); `fin_events.value_date` = 02.03 yalnız bilgi.
  Programın banka bakiyesi (Hareketler yürüyen bakiye, Banka Bakiye Raporu, Gerçek Banka) alıcıya 27.02'de girer.
- Kitap (K-07, KG-19 A): 27.02 B 108.90 500 / A 102.B1 500; 02.03 B 102.B2 500 / A 108.90 500. Valör aynı günse doğrudan (K-05).

### 1.3 K-14 — Hesapsız (Açılıştan Önce) hareket (s11: hesapsız havale tahsilatı)
- Bugün: "Hesapsız (Açılıştan Önce)" (bank/module-ref.mjs NONE; satır `fin_ref = ''`) → moneyAccount("bank", "") = 102.00 "Hesabı Atanmamış Eski Hareketler": B 102.00 / A CH. Devir
  Kapanışı (sihirbaz; voucher.mjs:119 carryLines) 102.00'ın D−1'e kadarki bakiyesini B 519 / A 102.00 ile kapatır (saklı "500" → effectiveGl 519). Bankaya Geçmiş Say (voucher.mjs:134
  reclassLines) B 102.k / A 108.00.
- Kitap (K-14): hareketin tarihinde B G (519) / A CH (tahsilatta; ödemede ters). "Para zaten banka açılış bakiyesinin içinde → çift sayım olmaz." Olay listesi Devir Kapanışı ve
  Bankaya Geçmiş Say'ı da sayar.

### 1.4 K-15 — Kart Borcuna Aktar (s37: 15.01 açılıştan önce kart ödemesi 200; kart açılışı 01.02 1.000; 10.02 kartla ödeme 300)
- Bugün: hesapsız kart ödemesi (method card, fin_ref '', kurumsal) → moneyAccount("card", "") = 108.00: 15.01 B 320 / A 108.00 200; sonradan "Kart Borcuna Aktar" (legacy reclass)
  B 108.00 / A 309.k. 10.02 kart hesabıyla: B 320 / A 309.k 300 (T-06).
- Kitap (K-15): açılıştan önceyse 309 yerine G: 15.01 B 320 / A 519 200; açılıştan sonra B CH / A 309.k. s37 elle beklenen: 519 = +800 (açılış −1.000 borç karşılığı B 519 1.000, açılıştan
  önceki A 519 200), 309.KK1 = −1.300, 320|T1 = 0.

### 1.5 D-07 — kart faizi (sürücü P3)
- Bugün: kart hesabına Faiz Gideri 400 bank-account-invalid ("Şirket Kartı (Kredi Kartı): faiz gideri Vadesiz, Ticari ya da Diğer TL hesaptan girilir"; vouchers.mjs:46 TYPE_RULES
  interest_out.main = BANK_KINDS), Masraf da 400. Kart ekstresindeki faiz programa girilemez → 309 kart borcu ekstreden eksik.
- Kitap (D-07): işlem tarihi B 780 / A 309.NN, tutar (+ BS).

## 2. D-07 — seçilen yol (en küçük; yeni fiş türü / ekran YOK)

- `server/lib/bank/vouchers.mjs` TYPE_RULES.interest_out: `main` kart hesabını da kabul eder; satırlar var olan `interestOutLines` ile (voucher.mjs:201): B 780 faiz · B 780 BSMV / KKDF
  (rol tax) / A 309.k (moneyLine → roleOfAccount card). Gecikme bedeli de aynı fiştir (kitap D-07 tek satır; 780). Planlı İşlem'de kart seçilmez (`planMain` / `planPurpose`: "kart faizi
  planlanmaz, ekstre gelince Faiz Gideri olarak girilir") — plan Nakit Akış'ta "bankadan çıkış" sayılırdı (planFlows PLAN_OUT).
- Masraf (fee), Diğer Gider, Faiz Geliri kart hesabında 400 KALIR (kitapta kart için satır yok; gerekirse ayrı karar).
- Defter: türetme DEĞİŞMEZ (Banka Fişi satırları saklıdır, journal aynen alır) → kural sürümü değişmez, kilitli dönemde kural farkı doğmaz (eski veride bu olay yok; kilitli tarihe
  zaten yazılamaz — 409 period-locked).
- K7 (eksi bakiye): kart limiti denetimi kart harcaması gibi uygulanır (GUARDED_KINDS card; Uyar → onayla, Engelle → 409). Ters Kaydet ve Düzelt genel yoldan.
- Ekran (`client/assets/hof-bank.js`): Faiz formunda Faiz Gideri seçilince hesap listesinde kredi kartları da çıkar (mainKinds(type, mode); Planlı İşlem'de çıkmaz); kart seçiliyken
  önizleme "Kart Borcuna Eklenen …"; kart hesabının Hesap Detayı'nda "+ Kart Faizi" düğmesi (pasif kartta düğme pasif ve neden yazısı — mevcut `why` düzeni).
- Okuyucular (ders 10): mizan / Alt Hesap Mizanı (309.k, 780 — saklı satır), Mutabakat Testi (309 = kart hesabının para satırları; money-lines rol card), Banka özeti (Kart ve Kredi Borcu),
  kart vadesi (cardDueFlows: kart bakiyesinden), Hareketler (kart hesabı süzgeci), İşlem Kartı (form: interest_out dalı movements.mjs:264), Banka Masraf Raporu (interest_out GİRMEZ —
  değişmedi), Gelir Tablosu (780 → H). Kasa / cari / stok / taksit dokunulmaz.

## 3. KG-19 — tasarım (KODLANMADI; §9 B1 kararı bekleniyor)

Hedef türetme (rows() `bankLines`'a `e.value_date` + `e.type` gelirse): `transfer` (ve ters kaydı) başlığında `value_date` > `date` ise alıcı hesabın para satırı (rol bank, D, ref ≠
bank_ref) iki maddeye bölünür: işlem gününde B 108.90 / A 102.gönderen (+ ücret satırları), valör gününde B 102.alıcı / A 108.90. Ters kaydın kendi tarihi (KG-18) ve asıl valörün
ilişkisi ayrıca (aşağıda S-b). 108.90 "Yoldaki Transferler" PLAN_SUBS'a (hesap planı alt hesap tanımı, Ç1 düzeni). Okuyucular: Alt Hesap Mizanı (Banka) tek kaynaktan (C3 §13 notu),
Mutabakat (102.alıcı ↔ program; 108.90 değişmezi = yoldaki transferlerin toplamı), dondurma (kilit çıkış ile valör arasına düşerse kural farkı), Nakit Akışı, Banka Bakiye Raporu.
Takvim: valör günü transferde KULLANICININ girdiği tarihtir (tatile düşerse program kaydırmaz — vouchers.mjs valueDate yalnız aralık denetimi); S21 / S27 POS valörü içindir (§6).

## 4. KG-6 — tasarım (KODLANMADI; §9 B1 kararı + §10 soruları bekleniyor)

Hedef türetme: POS satışının (pos_sales, rol sale) satış gününde B komisyon hesabı (Banka Ayarları; varsayılan 653) / A 108.POS = satışın kesintisi (BSMV / vergisiz kip; taksitli
satışta BÜTÜN taksitlerin toplamı); gün fişi maddesinde 653 satırı türetmede 108'e katlanır (A 108 brüt − kesinti = net; B 102 net). İade (refund kalemi) ve İadede Komisyon: iade
edilen kesinti iade gününde ters (KG-20 A: yalnız banka iade ederse B 108 / A komisyon hesabı). Veri: rows() satış başına { date, posGlSub, deduction(BSMV/vergisiz), kalemlerin
kapandığı gün fişi } ister (pos_items toplu SQL, satış başına tek satır — ders 47). Okuyucular: 108 mutabakatı (money-lines beklenenı brütten nete), POS raporları (sayıları DEĞİŞMEZ —
yalnız defter maddesi), Banka Masraf Raporu (POS komisyonu satırı gün fişinden okunuyor — tarihi değişmez mi? karar), dondurma (çekim kilitli / valör açık → kural farkı), Gelir
Tablosu dönemselliği.

## 5. K-14 / K-15 — tasarım (KODLANMADI; §9 B1 + §10 soruları)

Hedef türetme: `fin_ref = ''` para satırı (havale → 102.00, kurumsal kart ödemesi → 108.00) "açılıştan önce" ise banka / kart tarafı yerine 519 (açılış sınıfı DEĞİL — olağan madde,
hareketin tarihinde); Devir Kapanışı maddesinin 102.00 / 108.00 satırları aynı kümede 519 (madde kendi içinde sıfırlanır → yazılmaz ya da B 519 / A 519); Bankaya Geçmiş Say /
Kart Borcuna Aktar'ın 108.00 tarafı da. "Açılıştan önce"nin tanımı satırda saklı değil (module-ref pickRef "none" yalnız yazımda: tarih bir uygun hesabın açılışından ya da Devir
Kapanışı gününden önce) → türetmede yeniden hesaplanır: rows() hesapların açılış tarihlerini ve Devir Kapanışı sınırını vermeli. 519 dökümüne yeni tür ("Hesapsız Hareketler
(Açılıştan Önce)") ledger-opening.mjs'te; Mutabakat Testi'nin 519 denetimi (integrity) bu satırları bilmeli; 102.00 / 108.00 beklenenı (money-lines) aynı kümeyi düşmeli.

## 6. İş günü takvimi ↔ S21 / S27 (sınandı — server/lib/calendars/tr.mjs, business-days.mjs, bank/pos-math.mjs valueDateOf)

- S21 = A (resmî tatil → sonraki iş günü): valueDateOf İş Günü kuralında `calendar.valueDate(date, "business", n)`, Takvim Günü'nde sonra `adjust(following)`, Aynı Gün'de
  `adjust(following)`; taksit kalemleri `adjust(addMonths, "following")`. UYUMLU (sürücü K3-POS-VALOR-RESMI-TATIL: 23.04.2026 → 24.04.2026 programda bu kuralla).
- S27 = A (28 Ekim ve bayram arifesi yarım gün İŞ GÜNÜ, valör kaymaz; dinî bayram günleri tam gün tatil): `createTrCalendar({ halfDayIsBusiness })` varsayılan `true`; arife `half:
  true`, bayram günleri `half: false`. UYUMLU. AYRIŞMA RİSKİ: Banka Ayarları → Gelişmiş → "Yarım Gün (Arife)" seçeneği "İş Günü Sayılmaz" seçilirse (pos.mjs:87 / post.mjs:520
  `halfDay !== "holiday"`) arife tatil sayılır → S27'den sapar. Varsayılan S27'ye uygun; şirket ayarıyla değişebilmesi BAŞ MİMAR KARARI (§9 B3).
- Dinî bayram tarihleri YALNIZ takvim dosyasındakiler (2024–2031; Diyanet listesi 08.10.2026'da okunmuş); hafızadan tarih eklenmedi. Tablonun son yılı 2031 (needsUpdate zil uyarısı).

## 7. Nasıl bozulur? (önce yazıldı; testler buradan — D-07 için uygulananlar test/kart-faizi-250.test.mjs'te)

| # | Durum | D-07 | KG-19 / KG-6 / K-14 (kodlandığında) |
|---|---|---|---|
| 1 | Sıra değiştir (faiz önce / kart borcu ödemesi önce) | kart bakiyesi satırlarla yürür (test 1–3) | çıkış/valör ve çekim/valör ters sırada girilir |
| 2 | Valör günü değiştir (Düzelt) | — | 108.90 yeni valöre taşınır; kilitliyse ters kayıt |
| 3 | POS ayarı sonradan değişir (oran, valör, vergi kipi) | — | yeniden planlama ters kaydı: komisyon farkı hangi gün (S-c) |
| 4 | Şimdi Aktar / kısmi aktarım | — | komisyon çekim gününde kalır, aktarım net |
| 5 | İade / ters kayıt | Ters Kaydet → kart borcu eski hâl (test 3) | iade edilen komisyon iade gününde (KG-20) |
| 6 | Hesap sil + aynı adla yeniden aç | kart silinmişse 404 (genel yol) | yeni alt hesap kodu; eski satırlar eski koduyla |
| 7 | İki şirket | şirket başına hesap (genel yol) | rows() şirket deposundan |
| 8 | Eski sürüm verisi (v2.4.9 kilitli) | olay eski veride yok → kural farkı yok | kural farkı TAM görünmeli (kabul D) |
| 9 | Kilitli dönemde çekim + açık dönemde valör | kilitli tarihe 409 (test) | çekim maddesi donmuş; fark Kural Farkı Düzeltme Fişi'ne |
| 10 | Yıl dönümü (valör yeni yılda) | — | 108.90 / 108 net yıl sonu bakiyesi devre girer (s23) |
| 11 | Yarıda kesilme | tek işlem (bank.post) | türetme saf; yazım yok |
| 12 | Planlı İşlem'de kart | 400 (test) | — |
| 13 | Kart limiti aşımı | K7 Uyar / Engelle (genel) | — |

Karşı mutantlar (test/c7a-banka-250-mutasyon.mjs): D-07 kabulü geri al; kart faizinin para satırı 309 ↔ 102; BSMV düşer; planlı kart faizi kabul; 780 ↔ 770. Öbür kuralların
mutantları (komisyonu valöre geri al, 108.90'ı atla, valör = çıkış günü, tatil kaydırmasını kaldır, açılıştan önceki hareketi banka tarafına yaz, '<' ↔ '≤' açılış günü) kodla birlikte.

## 8. Yeniden üretim ve kabul sayıları

Kodla birlikte bu bölüme eklenir (kanıt docs/kanit/2026-11-14/c7a-*).

## 9. BAŞ MİMAR KARARI GEREKİYOR (mimari; seçenek + öneri + gerekçe — ders 40)

- **B1 — dosya sınırı (KG-19 / KG-6 / K-14 / K-15'in ön koşulu).** `server/routes/ledger.mjs rows()` (YAZILMAZ) türetmenin istediği alanları vermiyor (§0).
  Seçenek A (öneri): rows()'a en küçük ek, YALNIZ okuma — (i) `bankLines` sorgusuna `e.value_date AS valueDate, e.type AS eventType, e.bank_ref AS bankRef, l.ref AS ref`; (ii) `refs()`
  banka hesabına `opening_date AS openingDate` + `out.carryBoundary` (accounts.carryBoundary — Devir Kapanışı günü); (iii) `out.posSales` = POS satışı başına tek satır (pos_sales ⋈
  pos_items toplu SQL: satış günü, POS alt hesabı, BSMV / vergisiz kesinti toplamı, iade kesintisi; ders 47 — öğe başına okuma yok); süzgeçli kurulumda (kapı) `set.events` ile aynı
  süzgeç. Bu ekler 2.4.9 kopyasını (ledger-rule-249) etkilemez (o kendi ledger-rows.mjs'ini kullanır). Seçenek B: rows()'un banka bölümü `server/lib/bank/` altında bir yardımcıya
  taşınır, routes/ledger.mjs tek satırla çağırır (yine routes dosyasına dokunur). Gerekçe: türetme saf işlev; veri tek kapıdan (rows) gelmeli; yazım anında farklı satır saklamak eski
  veriyi kural farkına sokmaz (§0).
- **B2 — kural sürümü etiketi.** general-ledger.mjs B15 notu: "Ç7a / Ç7b yayından ÖNCE aynı etiketi genişletir" → `LEDGER_RULE_VERSION` "2.5.0-defter" kalır (D-07 türetmeyi zaten
  değiştirmez). Görev metni "yeni kural kimliği" diyor; B15 ile çelişki: KG-19 / KG-6 / K-14 kodlanınca aynı etiketin genişletilmesi önerilir (geliştirme verisinde "2.5.0-defter" ile
  donmuş koşu Ç5-A kuralıyla donmuştur → kural farkı olarak görünür; müşteri dosyasında bu etiket yok).
- **B3 — "Yarım Gün (Arife): İş Günü Sayılmaz" ayarı S27 = A'dan sapmaya izin veriyor (§6).** Seçenek A (öneri): ayar kalır (bankası arifede valör vermeyen şirket için), varsayılan S27;
  kılavuzda değil, Banka Ayarları yardım metninde "S27" davranışı. Seçenek B: ayar kaldırılır.
- **B4 — D-07'de Masraf (fee) kart hesabında.** Kart yıllık ücreti / ekstre ücreti kitabın D-07'si değildir (780 değil 770); bu tur yalnız Faiz Gideri'ni açtı. İstenirse ayrı küçük iş.

## 10. KULLANICIYA SORULMALI (para / defter — ders 43; SORU DÜZENİ; yanıta kadar ne kodda ne kâhinde kesinleşir)

İş listesi C / D'de ve C3 / C5 §8 / §9'da aynı soru ARANDI (python ile satır satır; "KG-19", "KG-6", "valör", "108.90", "Hesapsız", "K-14", "K-15"): KG-6 için yalnız 05.11 (5); KG-19 /
K-14 / K-15 için kullanıcı kararı yok (kitabın "K değil" satırları; S21 / S27 POS valörü için).

- **S-a (KG-19, gün gün değişmez).** Kitap K-07 alıcı hesabı VALÖRDE borçlandırır (gerekçe "banka ekstresiyle eşleşir"); program bugün alıcının bakiyesini İŞLEM gününde artırır
  (vouchers.mjs:256 "valör bilgidir"; Hareketler yürüyen bakiyesi, Banka Bakiye Raporu, Gerçek Banka). Defter KG-19'la değişirse arada 102.alıcı (defter) ≠ banka ekranı. Seçenek A
  (öneri): banka modülü de valörle — alıcı hesabın hareketi ve bakiyesi valör gününde (ekran, rapor, ekstre eşleştirme); defter 108.90 → ikisi gün gün aynı, ekstreyle eşleşir.
  Seçenek B: banka ekranları işlem gününde kalır, yalnız defter 108.90 → Mutabakat'ın gün gün değişmezi "102.alıcı + 108.90 (o transferin) = program bakiyesi" olur; kullanıcı iki
  farklı bakiye görür. Seçenek C (uç durum değil, ama geri alınabilir): KG-19 B — bugünkü gibi çıkış günü doğrudan alıcı hesaba, 108.90 yok. Yaygın programlarda nasıl: DOĞRULANMADI
  (belgesi okunmadı; hafızadan yazılmaz).
- **S-b (KG-19, ters kayıt).** Valörlü transferin Ters Kaydet'i (KG-18 A: ters kaydın girildiği gün) valörden ÖNCE girilirse 108.90 hangi gün kapanır? Seçenek A (öneri): ters kayıt
  günü iki madde de tersine (B 102.gönderen / A 108.90 ters kayıt günü; asıl valör maddesi hiç doğmaz). Seçenek B: asıl valör maddesi kalır, ters kayıt valörü de ters (iki gün).
- **S-c (KG-6, sonradan değişen komisyon).** Komisyon satış gününe yazılınca, satış kilitli dönemde kalıp oranı / vergi kipi sonradan değişirse (yeniden planlama) ya da valörde gerçek net
  farklı gelirse (Ekstre ile / Elle Onay "Komisyon Farkı") fark hangi gün? Seçenek A (öneri): fark değişikliğin / valörün gününde (bugünkü gibi; kilitli satış günü değişmez). Seçenek B:
  satış gününe (kilitliyse Kural Farkı Düzeltme Fişi'ne). Uç durum seçeneği: "Uç durum böyle kalsın (BİLİNEN SINIR)" — yalnız override farkı için.
- **S-d (KG-6, KDV kipi — ödeme kuruluşu).** KDV kipinde kesinti gider değil sağlayıcıya borçtur (gün fişi B 320.sağlayıcı / A 108; gider aylık komisyon faturasıyla — D-02). Seçenek A
  (öneri): KG-6 yalnız BSMV / vergisiz kipte; KDV kipinde kesinti bugünkü gibi valör gününde (carinin ekstresi değişmez). Seçenek B: KDV kipinde de satış gününde B 320 / A 108 (sağlayıcı
  carisinin ekstresi tarihleri değişir).
- **S-e (K-14 / K-15, "açılıştan önce"nin tanımı).** Hesapsız satırda hangi hesaba ait olduğu saklı değil. Seçenek A (öneri): tarih, o yolun (havale: banka hesapları; kurumsal kart:
  kart hesapları) EN GEÇ açılış tarihinden ya da Devir Kapanışı gününden önceyse (pickRef'in "none"u kabul ettiği küme) G; değilse 102.00 / 108.00 (Hesabı Atanmamış — kullanıcı
  "Bu Hesaba Ata" ile bağlar). Seçenek B: yalnız Devir Kapanışı yapılmışsa ve tarih o günden önceyse G; Devir Kapanışı yoksa 102.00 / 108.00 (kâhin s11 / s37 Devir Kapanışı'sız G bekler →
  B'de kâhin farkı kalır). Program bugün Hesabı Atanmamış kovasının bakiyesini ekranda gösterir: A'da o satırlar defterde 519'da, ekranda kovada → kovanın ekrandaki bakiyesi de aynı
  kümeyi düşmeli (karar A'nın parçası).

## 11. DOĞRULANMADI / DENENMEYEN (bu tasarım turu)
- Yaygın programların (Mikro, Netsis, Logo, AKINSOFT) valörlü transfer ve POS komisyonu düzeni: belge okunmadı → öneride dayanak yazılmadı.
- KG-6 / KG-19 / K-14 için eski sürüm (v2.4.9) kilitli verisinde kural farkı: kural kodlanmadığından üretilmedi.
