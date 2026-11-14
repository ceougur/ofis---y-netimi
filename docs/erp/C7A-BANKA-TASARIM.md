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

## 3. KG-19 — tasarım (KODLANMAZ — S175 = C, kullanıcı 14.11 06:31; valörlü transfer bugünkü gibi, 108.90 açılmaz; BİLİNEN SINIR; metin 2.5.1'de A'ya geçilirse diye durur)

Hedef türetme (rows() `bankLines`'a `e.value_date` + `e.type` gelirse): `transfer` (ve ters kaydı) başlığında `value_date` > `date` ise alıcı hesabın para satırı (rol bank, D, ref ≠
bank_ref) iki maddeye bölünür: işlem gününde B 108.90 / A 102.gönderen (+ ücret satırları), valör gününde B 102.alıcı / A 108.90. Ters kaydın kendi tarihi (KG-18) ve asıl valörün
ilişkisi ayrıca (aşağıda S-b). 108.90 "Yoldaki Transferler" PLAN_SUBS'a (hesap planı alt hesap tanımı, Ç1 düzeni). Okuyucular: Alt Hesap Mizanı (Banka) tek kaynaktan (C3 §13 notu),
Mutabakat (102.alıcı ↔ program; 108.90 değişmezi = yoldaki transferlerin toplamı), dondurma (kilit çıkış ile valör arasına düşerse kural farkı), Nakit Akışı, Banka Bakiye Raporu.
Takvim: valör günü transferde KULLANICININ girdiği tarihtir (tatile düşerse program kaydırmaz — vouchers.mjs valueDate yalnız aralık denetimi); S21 / S27 POS valörü içindir (§6).

## 4. KG-6 — tasarım (tur 2: S177 = A, S178 = A; ayrıntılı tasarım §13.3)

Hedef türetme: POS satışının (pos_sales, rol sale) satış gününde B komisyon hesabı (Banka Ayarları; varsayılan 653) / A 108.POS = satışın kesintisi (BSMV / vergisiz kip; taksitli
satışta BÜTÜN taksitlerin toplamı); gün fişi maddesinde 653 satırı türetmede 108'e katlanır (A 108 brüt − kesinti = net; B 102 net). İade (refund kalemi) ve İadede Komisyon: iade
edilen kesinti iade gününde ters (KG-20 A: yalnız banka iade ederse B 108 / A komisyon hesabı). Veri: rows() satış başına { date, posGlSub, deduction(BSMV/vergisiz), kalemlerin
kapandığı gün fişi } ister (pos_items toplu SQL, satış başına tek satır — ders 47). Okuyucular: 108 mutabakatı (money-lines beklenenı brütten nete), POS raporları (sayıları DEĞİŞMEZ —
yalnız defter maddesi), Banka Masraf Raporu (POS komisyonu satırı gün fişinden okunuyor — tarihi değişmez mi? karar), dondurma (çekim kilitli / valör açık → kural farkı), Gelir
Tablosu dönemselliği.

## 5. K-14 / K-15 — tasarım (tur 2: S179 = A; ayrıntılı tasarım §13.2)

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

Kanıt docs/kanit/2026-11-14/c7a-*. Tabanın yeniden üretimi (c7a-taban'ın arşiv kopyası; muhasebe sürücüsü, gerçek program, UTC ve Europe/Istanbul aynı; kuruş → TL):
- s08 (KG-6): 10.08 POS tahsilatı B 108.01 1.000 / A 120 1.000; 12.08 gün fişi B 102.01 975 · B 653 25 / A 108.01 1.000; 22.08 POS iadesi (valörden önce) B 120 100 / A 108.01 100;
  P3'ün gün fişi B 102.01 290 · B 653 10 / A 108.01 300 (iade netleşir, komisyon iadesi yok — İadede Komisyon "İade Edilmez").
- s12 (KG-19): 27.02 valörlü transfer (valör 02.03) B 102.02 500 / A 102.01 500 — işlem gününde, 108.90 yok. Ücretli transfer 01.02: B 102.02 1.000 · B 770 5,25 / A 102.01 1.005,25.
- s37 (K-15): 15.01 açılıştan önce kart ödemesi B 320 200 / A 108.00 200 (kâhin: A 519); 01.02 kart açılışı B 519 1.000 / A 309.01; 10.02 B 320 300 / A 309.01.
- s11 (K-14): 20.12.2025 hesapsız havale tahsilatı B 102.00 70 / A 120 70 (kâhin: B 519); 01.01.2026 banka açılışı B 102.01 1.000 / A 519.
- s13 (D-07): 04.03 kart faizi 20 → api_yok "400 … faiz gideri Vadesiz, Ticari ya da Diğer TL hesaptan girilir".
- Sürücünün BEKLEYEN kimlikleri (taban): Ç7a-KG6 3 senaryo / 8 denetim (s08, s23, s72), Ç7a-KG19 1 / 4 (s12), Ç7a-K14-K15 2 / 12 (s11, s37).
Kabul sayıları (A–G) teslim raporunda.

## 9. BAŞ MİMAR KARARI GEREKİYOR (mimari; seçenek + öneri + gerekçe — ders 40) — tur 1'in soruları; KARARLAR (iş listesi D 14.11 06:27): B1 = A, B2 etiket aynı, B3 ayar kalır (varsayılan S27), B4 kart ücreti 2.5.1

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

## 10. KULLANICIYA SORULMALI (para / defter — ders 43; SORU DÜZENİ; yanıta kadar ne kodda ne kâhinde kesinleşir) — YANITLANDI 14.11 06:31 ("bana sorun varsa önerilerini uygula"): S-a = S175 = C, S-b = S176 DÜŞTÜ, S-c = S177 = A, S-d = S178 = A, S-e = S179 = A

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

## 12. Sonuç (kodla birlikte; kanıt docs/kanit/2026-11-14/c7a-*)

- D-07 YAPILDI (commit cc02ec13 sunucu + test + mutasyon; 87c7dd12 ekran + ekran senaryosu + kılavuz / PDF). KG-19, KG-6, K-14 / K-15 KODLANMADI — §0 / §9 B1 (dosya sınırı)
  ve §10 S-a … S-e kararlarını bekler. Kural sürümü değişmedi (D-07 türetmeyi değiştirmez; B2).
- Yeni test test/kart-faizi-250.test.mjs: yeni kodda 3/3 (UTC, Europe/Istanbul); tabanda 0/3 — neden "400 … faiz gideri Vadesiz, Ticari ya da Diğer TL hesaptan girilir"
  (bank-account-invalid) ve planlı kart faizinin nedeni yok. Mutasyon test/c7a-banka-250-mutasyon.mjs 5/5 YAKALANDI (kabulü geri al; 309 ↔ 102 — kapı 409 ledger-integrity 102.00 sapması;
  BSMV düşer; planlı kart faizi kabul; 780 ↔ 770).
- Komşular (G2 taraması; 25 dosya): 305/305 iki saat diliminde. Ekran: yeni senaryo test/e2e/senaryo-kart-faizi-250.mjs 23/23 iki saat diliminde, tabanda 3 geçti / 5 kaldı ("+ Kart Faizi"
  yok); senaryo-banka-210 428/428, -temel 80/80, 210b 90/90, gg243-banka-kart-aciklama 11/11, senaryo-211 59/59, banka-210-planli-yaris 19/19, banka-210-kart-onbellek-yaris 49/49.
- Kâhinler: defter 187/187 önce = sonra; cari 17.136/17.136 önce = sonra, yapım aşaması listesi kendi kopyamda yeniden üretildi, DEĞİŞMEDİ (boş). Muhasebe sürücüsü (226 koşu): program çıktısı
  218 koşuda bayt bayt aynı; farklı 8 = rastgele-1/2/3 ve s13 × 2 saat dilimi — kart_faiz olayları artık uygulanıyor (api_yok → yapıldı, B 780 / A 309.01); sınıflar AYNI 6.528 / U 1.022 /
  SINIFLANMADI 376 önce = sonra, P 54 → 18 (P3-KART-FAIZI-YOLU-YOK'un 36 olay farkı kalktı; yeni fark yok). Ç7a-KG6 (3 senaryo / 8 denetim), Ç7a-KG19 (1 / 4), Ç7a-K14-K15 (2 / 12) AYNEN
  bekliyor. Sürücü tabanda da kırmızı (çıkış 1; SINIFLANMADI'lar Ç5'ten sonra eskiyen BUGÜN görünümünden — ana oturumun bekleyen "muhasebe sürücüsü karşılaştırması" işi).
- Rastgele sıra (test/mutabakat, 400 işlem × 2 tohum, her 20 işlemde doğrulama): taban 2/2, yeni 2/2.
- Hız: ÖLÇÜLEMEDİ — ölçüm kilidi doluydu (başka oturum); bekleme döngüsü kurulmadı. Değişen yol yalnız Banka Fişi yazımının hesap türü denetimi (sabit küme üyeliği).

## 13. Tur 2 (14.11.2026; taban `c7a2-taban` 5abefb4c; görev metni `docs/devir/2.5.0-DEVAM/c7a2-istem.txt`) — KODDAN ÖNCE yazıldı

Kararlar (AYNEN iş listesi D / C): S175 = C (KG-19 kodlanmaz; sürücüdeki Ç7a-KG19 farkı KALIR), S176 DÜŞTÜ, S177 = A, S178 = A, S179 = A; B1 = A (rows() / refs()'e yalnız okuyan
ekler), B2 (kural sürümü etiketi "2.5.0-defter" aynı kalır), B3 (arife ayarı kalır), B4 (kart yıllık ücreti 2.5.1). Sıra: veri kaynağı (0) → K-14 / K-15 (3) → KG-6 (1) → kart
formundaki alan adı (4) → kılavuz (5).

### 13.1 Veri kaynağı (iş 0; `server/routes/ledger.mjs` YALNIZ rows() / refs())
- `refs().cover` = açılış sınırları (yeni yardımcı `server/lib/bank/opening-cover.mjs` `coverBounds(store)`; tek SQL): `bank` = max(Devir Kapanışı günü, silinmemiş TL Vadesiz /
  Ticari / Diğer hesapların EN GEÇ açılış tarihi), `card` = max(Devir Kapanışı, silinmemiş TL kredi kartlarının EN GEÇ açılışı), `pos` = Devir Kapanışı günü. Devir Kapanışı = etkin en
  geç `carry_close` günü (accounts.carryBoundary ile aynı SQL).
- `rows().bankLines` satırına `eventType` ve `baseType` (ters kaydın asıl türü — Devir Kapanışı zincirini tanımak için). Valör / referans bu turda GEREKMEDİ (KG-19 yok; KG-6
  kalemden okur).
- KG-6 için `rows().posCommission` (§13.3) ve `refs().commissionGl`.
- 2.4.9 kopyası (ledger-rule-249, kendi ledger-rows.mjs'i) etkilenmez: yeni alanları okumaz.

### 13.2 K-14 / K-15 (S179 = A) — "açılışta sayılmış" hesapsız satır
TANIM (tek kaynak `opening-cover.mjs`; defter, tek kaynağın defter beklenenleri, kova, Alt Hesap Mizanı ve 519 ikinci yükleyicisi AYNI tanımı kullanır). Hesabı atanmamış
(fin_ref / ref '') para satırı "açılışta sayılmış"tır ⟺
- modül satırı, havale yolu (102.00): tarih < cover.bank;
- modül satırı, kart yolu (108.00), yön ÇIKIŞ (kurumsal kartla ödeme — Kart Borcuna Aktar havuzu): tarih < cover.card;
- modül satırı, kart yolu, yön GİRİŞ (POS tahsilatı — Bankaya Geçmiş Say havuzu; POS'un açılış tarihi yoktur): tarih < cover.pos (yalnız Devir Kapanışı);
- Banka Fişi satırı: Devir Kapanışı ve ters kaydının satırı HER ZAMAN (kapanışın kapattığı küme tanım gereği açılıştadır); öbürleri (Bankaya Geçmiş Say / Kart Borcuna Aktar'ın 108.00
  tarafı) tarih < cover.pos.
"<" (eşit değil): açılış günü D'nin gün başındaki bakiyedir (plan §10.3); D günlü satır açılıştan SONRADIR (pickRef'in "none" kabulüyle aynı ölçü).
Hesap kümesi: silinmemiş, TL, durum fark etmez (pasif hesabın açılışı defterde durur; silinen hesabın açılışı ters kaydedilir). pickRef yalnız ETKİN hesaplara bakar; türetme duruma
bakarsa bir hesabı pasife almak geçmiş günlerin defterini değiştirirdi → BAŞ MİMAR KARARI GEREKİYOR (öneri: durum fark etmez — kodlanan).
Yön ayrımı (kart yolu): program bugün 108.00'ı iki havuza yönle ayırıyor (reclassAvailable: giriş = Bankaya Geçmiş Say, çıkış = Kart Borcuna Aktar); tanım aynı ayrımı kullanır.
Uç durum (KULLANICIYA SORULMALI — uç durum seçeneğiyle): hesapsız POS İADESİ (çıkış) kart ailesine, kurumsal karta gelen hesapsız İADE (giriş) POS ailesine düşer.

DEFTER (journal; olağan madde, açılış sınıfı DEĞİL, hareketin tarihinde): açılışta sayılmış satırın 102.00 / 108.00 tarafı 519 (alt hesapsız). Örnek s11: 20.12.2025 hesapsız havale
tahsilatı 70 → B 519 70 / A 120 70 (bugün B 102.00). s37: 15.01 kart ödemesi 200 (kart açılışı 01.02) → B 320 200 / A 519 200 (bugün A 108.00). Devir Kapanışı: B 519 X / A 519 X → aynı
hesabın iki yanı netlenir, madde YAZILMAZ (519 bakiyesi değişmez; mizanın devir hızı şişmez); ters kaydı da. Bankaya Geçmiş Say / Kart Borcuna Aktar: 108.00 tarafı yalnız küme
koşulunda 519 (yeni aktarımda olanaksız — havuz aşağıda).
TEK KAYNAK (money-lines): `groups()` (yalnız defter beklenenleri: Defter Mutabakatı / Mutabakat Testi / kapı) açılışta sayılmış satırı yol "opening" altında verir (102 / 108 / alt
hesap beklenenine GİRMEZ); `verifyReport` ve `balances()` (Kasa penceresi) ham gruplarla (değişmez). `unassigned` / `unassignedWays` (kova: Banka Genel Bakış, Hesaplar, ANLIK DURUM,
Nakit Akış, Birleşik Rapor; Alt Hesap Mizanı 102.00 / 108.00) ve `periodGroups` (Alt Hesap Mizanı dönemli) aynı satırları DÜŞER (S179 = A'nın parçası).
519 İKİNCİ YÜKLEYİCİ (`ledger-opening.mjs openingCounterpart`): yeni tür `parts.unassigned` = açılışta sayılmış satırların işaretli toplamı (giriş +, çıkış −; Devir Kapanışı'nın para
tarafı dahil — `parts.bank`'taki kapanış satırını netler). Açılış Eşleştirme dökümünde ayrı tür "Hesapsız Hareketler (Açılıştan Önce)". Değişmez: 519 = −(Σ modül açılışları) + fişler
+ bu satırlar.
KOVA LİSTESİ (Hesabı Atanmamış Eski Hareketler): satırlar listelenmeye devam eder (bağlanabilen bağlanınca 519'dan çıkar, hesaba girer); bakiye (totals) yalnız kalan küme.
Kart Borcuna Aktar havuzu: başlangıç max(Devir Kapanışı, hedef kart açılışı, cover.card) — açılışta sayılmış ödeme havuza girmez (tek kartta değişmez; çok kartta en geç açılıştan önceki
ödeme artık aktarılmaz — S179 = A). Bankaya Geçmiş Say havuzu değişmez. Kurulum Sihirbazı ön izlemesinin "sonra" kovası kurulumdan sonraki sınırlarla.
KİLİTLİ DÖNEM: donmuş defter DEĞİŞMEZ; eski veride kilitli tarihteki hesapsız satır (102.00 → 519) ve Devir Kapanışı maddesi ruleDiff'te "Kural Değişikliği Farkı" (madde sayısı +
hesap / alt hesap tutarı); Kural Farkı Düzeltme Fişi ilk açık güne taşır (Ç5-A düzeni).
NASIL BOZULUR (testler buradan): açılış günü tam D ('<' ↔ '≤'); iki hesap farklı açılış (en geç ↔ en erken); hesap pasife / silinir; Devir Kapanışı + Geri Al; satır hesaba atanır / geri
alınır; kart ödemesi açılıştan önce / sonra; POS tahsilatı (giriş) açılıştan önce; kilitli dönemde kalan eski satır; eski sürüm (v2.4.9) verisi; iki şirket (sınırlar şirket deposundan);
kapı (süzgeçli kurulum) — tek satır yazımında 409 çıkmamalı; Silinenler'den geri yükleme; Hesap Planı Mizanı ↔ Alt Hesap Mizanı.

### 13.3 KG-6 (S177 = A, S178 = A) — POS komisyonu satış (çekim) günü
- Veri (`rows().posCommission`, toplu SQL — ders 47; satış başına satır, gün fişi parçaları json): BSMV / vergisiz kipteki (pos_sales.tax_kind ≠ vat; S178 = A) satış ve iade kayıtlarının
  (durum ≠ repair) void olmayan kalemleri; kesinti = komisyon + (vergi hariç kipte vergi) + sabit ücret (gün fişinin dayTotals'ıyla AYNI formül); iade kalemi eksi (İadede Komisyon,
  KG-20 A). Parça: kalemin gün fişi (event_id; bekleyen '').
- Defter: satış (iade) GÜNÜNDE madde `pos-commission:<satış>`: B komisyon hesabı / A 108.POS (iadede ters). Komisyon hesabı: parçanın gün fişindeki saklı gider satırının hesabı; bekleyen
  parçada Banka Ayarları'ndaki güncel hesap (varsayılan 653).
- Etkin gün fişi (pos_settlement) maddesi: kapattığı kalemlerin S'i gider satırından ve 108 alacağından düşer → 102 = net, 108 = net; kalan gider satırı yalnız Komisyon Farkı (Ekstre
  ile / Elle Onay — S177 = A: valörün gününde). Ters kaydedilmiş gün fişinin kalemi yoktur (pos.mjs denetimi) → ters kayıt saklı satırlarla aynen.
- KDV kipi (ödeme kuruluşu): DEĞİŞMEZ (S178 = A; sağlayıcı carisinin ekstresi aynı).
- Tek kaynak: `groups()` 108 / 108.POS beklenenine kesintiyi işler (süzgeçli kurulumda: dahil satışların bütün parçaları −, dahil gün fişlerinin parçaları +; süzgeçsizde = −bekleyen).
  Alt Hesap Mizanı 108.POS aynı kuralla.
- POS raporları ve Banka Masraf Raporu (fiş satırlarından okur) DEĞİŞMEZ.
- Kilitli dönem: çekim kilitli / valör açık → satış günü maddesi donmuş defterde yok → ruleDiff; gün fişi açık dönemde net; Kural Farkı Düzeltme Fişi.
- Sabit kalır: oran / vergi kipi satış anında pos_sales / pos_items'a yazılır (POS kartı güncellemesi bekleyen kalemi değiştirmez); modül satırı düzeltilince satış void + yeni satış.
  Komisyon hesabı ayarı sonradan değişirse bekleyen parçanın satış günü maddesinin hesabı değişir (kilitliyse ruleDiff) — BİLİNEN SINIR adayı.

### 13.3a Tur 2'nin durumu (ARA RAPOR; kanıt docs/kanit/2026-11-14/c7a2-*)
- İş 0 (veri kaynağı — K-14 kısmı) ve iş 3 (K-14 / K-15) YAPILDI (commit'ler df68e175, aa2133c4, 8da5f5f5, 20b68330). KG-6 (iş 1), alan adı (iş 4), kılavuz (iş 5) BAŞLAMADI —
  yeni temiz ajana (ders 46). KG-6'nın veri kaynağı eki (rows().posCommission / posSettle, refs().commissionGl) iş 1 ile birlikte yazılır (§13.3; taslak: satış başına toplu SQL,
  parça = kalemin gün fişi; etkin gün fişinde S kadar gider ve 108 alacağı düşer; groups() 108.POS beklenenine −bekleyen kesinti; Alt Hesap Mizanı 108.POS aynı kural).
- Uygulamada §13.2'den sapma (sonuç): Hesabı Atanmamış LİSTESİ (legacy rows) ve Banka raporlarının "Hesabı Atanmamış" seçimi (rapor merkezi — dosya sınırı dışı) açılışta sayılmış
  satırları göstermeye DEVAM eder; yalnız BAKİYE (kova: Banka Genel Bakış, Hesaplar, ANLIK DURUM, Nakit Akış, Birleşik Rapor, Hesabı Atanmamış toplamı, Alt Hesap Mizanı) düşer.
  Sonuç: Banka Bakiye Raporu'nun özetindeki "Hesabı Atanmamış Eski Hareketler" (satırlardan toplanır) Banka Genel Bakış'tan büyük görünebilir → BAŞ MİMAR KARARI GEREKİYOR (rapor).
- Kurulum Sihirbazı'nın Devir Kapanışı tutarı ham kalır (D'den önceki BÜTÜN bağsız satırlar — 2.4.9 kuralıyla da tutarlı); defterde B 519 / A 519 netlenir.

### 13.4 Okuyucular (ders 10)
Yevmiye Defteri, Hesap Planı Mizanı, Alt Hesap Mizanı, Defter Mutabakatı, Mutabakat Testi (102 / 108 / alt hesap / 519 "Açılış Karşılığı"), kapı (integrity-scope süzgeçli kurulumu —
groups({ ids, events }) ile), dondurma / ruleDiff / Kural Farkı Düzeltme Fişi, Açılış Eşleştirme (519 dökümü), Banka Genel Bakış / Hesaplar / ANLIK DURUM / Nakit Akış / Birleşik Rapor
(kova), Hesabı Atanmamış Eski Hareketler (liste + havuz), Kurulum Sihirbazı ön izlemesi, mobil özet (kova summary() üzerinden), yedek / geri yükleme (veri değişmez; türetme). Banka /
POS raporları, Banka Masraf Raporu, Kasa penceresi: DEĞİŞMEZ.

## 14. Tur 2b (14.11.2026; taban `c7a3-taban` 5ba59cbc; görev metni `docs/devir/2.5.0-DEVAM/c7a2-istem.txt` + `c7a3-ek.txt`) — KODDAN ÖNCE yazıldı

Kararlar (AYNEN iş listesi D / C): S177 = A (sonradan değişen oran / vergi kipi ya da valörde farklı gelen net: fark değişikliğin / valörün gününde), S178 = A (KG-6 yalnız BSMV /
vergisiz kipte; KDV kipi bugünkü gibi), S182 = C, S183 = A, S184 = A (K-14 / K-15 kodu DEĞİŞMEZ), BAŞ MİMAR KARARI 14.11 10:17 (2): açılışta sayılmış hesapsız satırlar Hesabı
Atanmamış LİSTESİNDE ve banka raporlarının satırlarında 'Açılışta Sayıldı' işaretiyle KALIR, özet / TOPLAM satırları bu satırları DÜŞER (toplam = kova). Sıra: KG-6 → kart formundaki
alan adı → liste / rapor işareti → kılavuz + PDF.

### 14.1 KG-6 — bugünkü madde ↔ kitabın maddesi (örnek: Ziraat POS BSMV Dahil, Tek Çekim %2,5, valör 2 iş günü; 08.10 satış 10.000)
- Bugün: 08.10 B 108.01 10.000 / A 120 10.000 (T-03). 12.10 gün fişi (saklı satırlar): B 102.01 9.750 · B 653 250 / A 108.01 10.000. 08.10–11.10 arası 108.01 = 10.000 (brüt).
- Kitap (KG-6 = A, kullanıcı 05.11 (5); D-01 "komisyon tarihi ve hesabı KG-6"): 08.10 B 108.01 10.000 / A 120; 08.10 B 653 250 / A 108.01 250 (satış günü); 12.10 B 102.01 9.750 /
  A 108.01 9.750 (valörde net). 08.10–11.10 arası 108.01 = 9.750 (bankaya geçmemiş NET alacak).
- Taksitli (12.10 satış 12.000, 3 taksit %3,5 = 420; kalemler 140 × 3): 12.10 B 653 420 / A 108.01 420 (BÜTÜN taksitler); her valörde B 102.01 3.860 / A 108.01 3.860.
- İade (D-04, KG-20 A): İade Edilmez → kesinti iadesi 0, iade günü madde yok; Oransal / Tam → iade günü B 108.01 / A 653 (iade edilen kesinti); iade kaleminin gün fişi 108'i net.
- KDV kipi (S178 = A): bugünkü gibi — gün fişinde B 320.sağlayıcı / A 108 (valör günü); satış günü maddesi YOK.

### 14.2 Türetme (tek kaynak `server/lib/bank/pos-commission.mjs`)
KÜME: POS kalemi (pos_items rol sale / refund, durum pending / settled) ∧ kaydı (pos_sales) void ya da repair DEĞİL ∧ kaydın vergi türü KDV değil. Kalemin kesintisi
σ = (komisyon + (vergi hariç kipte vergi) + sabit ücret kalemi) × (iade kaleminde −1) — gün fişinin dayTotals'ı ile AYNI formül (pos-math deductionOf + fee_minor).
- Satış (iade) günü maddesi `pos-commission:<kayıt>` (yevmiye sınıfı 38: para / cari satırlarından sonra, Banka Fişi'nden önce): kaydın tarihinde B komisyon hesabı Σσ / A 108.POS Σσ
  (Σσ < 0 → ters yön). Komisyon hesabı kalem kalem: bankaya geçmiş kalemde gün fişinin saklı gider satırının hesabı (yoksa güncel ayar), bekleyen kalemde Banka Ayarları'ndaki
  güncel hesap (gl.commission, varsayılan 653).
- Etkin gün fişi (pos_settlement): S = o fişe bağlı küme kalemlerinin Σσ'sı; madde türetmede 108 satırı (saklı, alacak yönlü işaretli v) → v − S, gider satırı (saklı, borç yönlü
  işaretli x) → x − S (satır yoksa güncel hesapla açılır, sıfırsa yazılmaz); 102 satırı DEĞİŞMEZ. Kalan gider = Komisyon Farkı (Ekstre ile / Elle Onay; S177 = A valörün gününde)
  + onarım bekleyen (repair) kayıtların kesintisi. Ters kaydedilmiş gün fişinin kalemi yoktur (kalemler bekleyene döner) → asıl ve ters kayıt saklı satırlarla birbirini götürür.
- Defter beklenenleri (money-lines groups — Defter Mutabakatı, Mutabakat Testi, kapı): POS'un (yol card, ref = POS) beklenenine −Σσ(kapsamdaki kayıtlar) + Σσ(kapsamdaki gün fişleri).
  Süzgeçsizde = −Σσ(bekleyen); süzgeçli kapıda kayıt kapsamı "kaydın işlem başlığı olaylarda", gün fişi kapsamı "gün fişi olaylarda" — rows() ile AYNI süzgeç (iki taraf aynı SQL'den).
- Alt Hesap Mizanı (tüm zamanlar ve dönem): 108.POS'un devir / borç / alacak'ı aynı maddelerle (satış günü maddesinin alacağı, gün fişi satırının v → v − S değişimi yönüyle).
- POS raporları, Banka Masraf Raporu, POS Bekleyen, Hesap Detayı (POS), Nakit Akış: saklı satırlardan / kalemlerden okur → DEĞİŞMEZ.

### 14.3 Okuyucular (ders 10)
Yevmiye, Hesap Planı Mizanı, Alt Hesap Mizanı (108.POS), Defter Mutabakatı ve Mutabakat Testi (108, bank:sub:108.POS), kapı (tam ve süzgeçli), dondurma / ruleDiff / Kural Farkı
Düzeltme Fişi (653 sonuç hesabı; 108 alt defter hesabı → farkı sıfır olmayan madde fişin dışında, "Kilidi Aç → Yeniden Kilitle"), Gelir Tablosu / Bilanço (Ç6; 653 dönemselliği),
muhasebe kâhini sürücüsü, rastgele sıra motoru (test/mutabakat; 108 modeli bekleyen net), defter kaynak taraması (kilit izi / istisna). 2.4.9 kopyası (ledger-rule-249) kendi satır
okuyucusuyla → ETKİLENMEZ.

### 14.4 Nasıl bozulur? (testler buradan)
Sıra (satış → valör / iade → valör / iki satış aynı gün fişinde); valör günü değişir (Şimdi Aktar — erken aktarım); POS ayarı sonradan değişir (oran / vergi kipi: kayıtta saklı; yalnız
düzeltme void + yeni kayıt); komisyon hesabı ayarı değişir (bekleyen kalemin hesabı değişir — BİLİNEN SINIR adayı; bankaya geçmiş kalem gün fişinin hesabında kalır); Elle Onay /
Ekstre ile farklı net (Komisyon Farkı valör gününde); iade (İade Edilmez / Oransal / Tam; bekleyen kaleme düşen / iade valörüne kalan); İptal İadesi; kayıt silinir (void) / Silinenler'den
döner; ters kayıt (yeniden planlama); taksitli satış; sabit ücret; KDV kipi (değişmez); onarım bekleyen kayıt; iki POS / iki hesap; iki şirket; eski sürüm (v2.4.9) kilitli verisi
(çekim kilitli / valör açık; ikisi kilitli; ikisi açık; iade; Şimdi Aktar); yıl dönümü (satış Aralık, valör Ocak); yarıda kesilme (türetme saf; yazım yok).
Karşı mutantlar: komisyonu valör gününe geri al; komisyon hesabını değiştir; KDV kipini de satış gününe al; taksitli satışta yalnız ilk kalemin kesintisi; gün fişinin 108'ini netleme;
beklenende bekleyeni düşmeme; repair / void kaydı kümeye al; iade kaleminin işaretini çevir.

### 14.5 Kart formundaki alan adı (iş 4) ve kılavuz (iş 5)
- Faiz formunda kart seçiliyken hesap kutusunun adı "Banka Hesabı" yerine "Kredi Kartı" (yazım düzeni; formun öbür kipleri aynen).
- Kılavuz: "Kart faizi nasıl girilir" + "Hesabı Atanmamış listesinde 'Açılışta Sayıldı'" kısa nasıl yapılır; PDF aynı turda (ders 42). Defter maddesi anlatımı kılavuza girmez.

### 14.6 Liste / rapor işareti (BAŞ MİMAR KARARI 14.11 10:17 (2))
Ayrım TEK kaynaktan (opening-cover isCovered — defterin kullandığı koşul): Hesabı Atanmamış listesinin satırına `counted` + görünür "Açılışta Sayıldı"; listenin toplamı = kova (zaten
unassignedTotals). Banka raporlarında (Hesabı Atanmamış seçimi) satırlar kalır, işaret sütunu / etiketiyle; dönem başı / sonu, giriş / çıkış toplamları ve özet bu satırları düşer.
